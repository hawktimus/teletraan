#!/bin/bash
# Usage: expired-cleanup.sh [--dry-run | --delete-now] [--print]
#        expired-cleanup.sh --restore <backup file>
# Deletes items in Studio that expired a while ago, if the owner turned that on (docs/expired-cleanup.md). It reads
# the three cleanup fields of Dashboard Settings (cleanupEnabled, cleanupDeleteAfterDays, cleanupMode) from Sanity, asks
# for the documents of the types in cleanup-plan.mjs, lets cleanup-plan.mjs pick the ones to delete, and then:
#   mode list     writes the list and deletes nothing (the starting mode)
#   mode delete   writes the list, saves a backup of the documents, and only then deletes them
# teletraan-cleanup.timer starts it every night at 03:40. Nothing is deleted while cleanupEnabled is off.
#
#   --dry-run      the list only, whatever the setting says (the control page's Show what would be deleted now)
#   --delete-now   a run now, for the control page's Delete these now button; needs Mode: delete, ignores the switch
#   --print        prints the answer as tab separated lines for the control page instead of sentences
#   --restore F    puts the documents of backup file F back (documents that exist now are not touched)
#
# The files are kept in <data folder>/cleanup (list-*.txt and backup-*.json, 30 days). The token SANITY_WRITE_TOKEN is read
# from local.env by lib.sh, handed to curl on standard input, and never printed. Needs curl, jq, flock and node 18 or newer.
# The tests set CLEANUP_NOW (seconds).
set -euo pipefail
. "$(dirname "$0")/lib.sh"

keep_days=30
dry_run=no
delete_now=no
print=no
restore=''

usage() {
  echo "Usage: $0 [--dry-run | --delete-now] [--print]" >&2
  echo "       $0 --restore <backup file>" >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case $1 in
    --dry-run) dry_run=yes ;;
    --delete-now) delete_now=yes ;;
    --print) print=yes ;;
    --restore)
      [ "$#" -ge 2 ] || usage
      restore=$2
      shift
      ;;
    *) usage ;;
  esac
  shift
done
[ "$dry_run" = no ] || [ "$delete_now" = no ] || usage
[ -z "$restore" ] || [ "$dry_run$delete_now$print" = nonono ] || usage

say() {
  [ "$print" = yes ] || echo "cleanup: $*"
}

# A failure. The page gets the sentence as a line of its own and a good exit, so that the helper does not hide it.
problem=''
fail() {
  problem=$1
  if [ "$print" = yes ]; then
    printf 'error\t%s\n' "$1"
    return 0
  fi
  echo "cleanup: $1" >&2
  return 1
}

for tool in curl jq node flock; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    echo "The $tool command is missing, so the clean up cannot run. See docs/updating-the-computer.md." >&2
    exit 1
  fi
done

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
folder="$data/cleanup"
mkdir -p "$folder"
chmod 755 "$folder" 2> /dev/null || true

# A run that starts while the last one is still going stops at once
exec 9> "$folder/.lock"
if ! flock -n 9; then
  say "the last run is still going."
  exit 0
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

now=${CLEANUP_NOW:-$(date +%s)}
now_ms=$((now * 1000))
iso_now=$(date -u -d "@$now" '+%Y-%m-%dT%H:%M:%SZ' 2> /dev/null || date -u -r "$now" '+%Y-%m-%dT%H:%M:%SZ')
stamp=$(printf '%s' "$iso_now" | tr -d ':-')

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)
if ! printf '%s' "$project" | grep -Eq '^[a-z0-9]+$' ||
  ! printf '%s' "$dataset" | grep -Eq '^[A-Za-z0-9_-]+$' ||
  ! printf '%s' "$version" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "Could not read the project ID, dataset and API version from dashboard/config.js." >&2
  exit 1
fi
host="https://$project.api.sanity.io/v$version/data"

token=$(setting SANITY_WRITE_TOKEN)
case $token in
  ''|'['*)
    # The timer is quiet about a computer that has no key yet; a person who asked is told
    if [ "$dry_run$delete_now$restore" = nono ]; then
      say "SANITY_WRITE_TOKEN is not in local.env, so nothing is done."
      exit 0
    fi
    fail "SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys." || exit 1
    exit 0
    ;;
esac
if ! printf '%s' "$token" | grep -Eq '^[A-Za-z0-9_.-]+$'; then
  fail "SANITY_WRITE_TOKEN in local.env does not look like a token. Paste it again, with nothing else on the line." || exit 1
  exit 0
fi

# curl's exit code in plain words. curl's own messages can include the address, so they are not shown.
explain() {
  case $1 in
    6) echo "could not find the server, so the network may be down" ;;
    7) echo "could not connect to the server" ;;
    28) echo "Sanity took too long to answer" ;;
    35|51|58|59|60) echo "the secure connection failed" ;;
    63) echo "the answer is too big" ;;
    *) echo "curl failed with exit code $1" ;;
  esac
}

# The answer of Sanity to a request goes to a file; the HTTP code is the output. The key goes in on standard input.
# Usage: ask <answer file> <curl arguments>   (sets http_code, and curl_code when curl itself failed)
http_code=''
curl_code=0
ask() {
  local out=$1
  shift
  curl_code=0
  http_code=$(printf 'header = "Authorization: Bearer %s"\n' "$token" |
    curl --disable --silent --max-time 60 --connect-timeout 10 --max-filesize 50000000 --proto '=https' \
      --output "$out" --write-out '%{http_code}' --config - "$@" 2> /dev/null) || curl_code=$?
}

# Turns a failed ask into one sentence
why_failed() {
  if [ "$curl_code" -ne 0 ]; then
    echo "Sanity could not be reached ($(explain "$curl_code"))"
  else
    case $http_code in
      401|403) echo "Sanity said the token cannot do that (status $http_code). Make a new token with Editor access" ;;
      *) echo "Sanity did not answer as expected (status ${http_code:-none})" ;;
    esac
  fi
}

# ----- restore -----

if [ -n "$restore" ]; then
  if [ ! -f "$restore" ] || ! jq -e '(.documents | type) == "array" and (.documents | length) > 0' "$restore" > /dev/null 2>&1; then
    fail "That is not a backup file made by the clean up: $(basename "$restore")" || exit 1
    exit 0
  fi
  allowed=$(node "$computer/scripts/cleanup-plan.mjs" types)
  # Only the types the clean up may delete are put back, and without the fields Sanity sets itself
  jq -c --arg allowed "$allowed" '[.documents[] | select(._type as $t | ($allowed | split(" ")) | index($t)) | del(._rev, ._createdAt, ._updatedAt)]' "$restore" > "$work/restore.json"
  total=$(jq 'length' "$work/restore.json")
  restored=0
  start=0
  while [ "$start" -lt "$total" ]; do
    jq -c --argjson from "$start" '{mutations: [.[$from:($from + 20)][] | {createIfNotExists: .}]}' "$work/restore.json" > "$work/restore-body.json"
    ask "$work/restore-answer.json" --request POST --header 'Content-Type: application/json' --data-binary "@$work/restore-body.json" "$host/mutate/$dataset"
    if [ "$curl_code" -ne 0 ] || [ "$http_code" != 200 ]; then
      fail "$(why_failed). $restored of $total documents were put back." || exit 1
      exit 0
    fi
    restored=$((restored + $(jq -c --argjson from "$start" '[.[$from:($from + 20)][]] | length' "$work/restore.json")))
    start=$((start + 20))
  done
  say "put back $restored documents from $(basename "$restore"). A document that already exists was left as it is."
  exit 0
fi

# ----- the setting -----

query='*[_id == "dashboardSettings"][0]{cleanupEnabled, cleanupDeleteAfterDays, cleanupMode}'
ask "$work/setting.json" --get --data-urlencode "query=$query" --data-urlencode 'perspective=published' "$host/query/$dataset"
if [ "$curl_code" -ne 0 ] || [ "$http_code" != 200 ] || ! jq -e '.result | objects // (. == null)' "$work/setting.json" > /dev/null 2>&1; then
  fail "The setting could not be read. $(why_failed)." || exit 1
  exit 0
fi
jq -c '.result // {}' "$work/setting.json" > "$work/setting-raw.json"
enabled=$(jq -r '.cleanupEnabled == true' "$work/setting-raw.json")
mode=$(jq -r 'if .cleanupMode == "delete" then "delete" else "list" end' "$work/setting-raw.json")

if [ "$dry_run$delete_now" = nono ] && [ "$enabled" != true ]; then
  say "clean up is off in Dashboard Settings, so nothing is done."
  exit 0
fi
if [ "$delete_now" = yes ] && [ "$mode" != delete ]; then
  fail "Mode is List only, so nothing was deleted. Set Mode to Delete in Dashboard Settings and publish, then try again." || exit 1
  exit 0
fi

# Deleting happens in a timer run with Mode: delete, or when the owner asked for it with --delete-now
deleting=no
if [ "$dry_run" = no ] && [ "$mode" = delete ]; then deleting=yes; fi

# ----- the status the Studio shows -----

# Only a timer run or a Delete these now writes it. A preview changes nothing, not even this.
write_status() {
  [ "$dry_run" = no ] || return 0
  local would=$1 deleted=$2 text=$3
  text=$(printf '%s' "$text" | tr -c "A-Za-z0-9 :,.()/'-" '?' | cut -c 1-160)
  jq -nc --arg at "$iso_now" --argjson would "$would" --argjson deleted "$deleted" --arg error "$text" \
    '{at: $at, wouldDelete: $would, deleted: $deleted, error: $error}' > "$work/status.json"
  cp "$work/status.json" "$folder/status.json"
  chmod 644 "$folder/status.json" 2> /dev/null || true
  "$computer/scripts/status-write.sh" cleanup > /dev/null 2>&1 || true
}

stop_run() {
  write_status "${1:-0}" "${2:-0}" "$3"
  fail "$3" || exit 1
  exit 0
}

# ----- the plan -----

fields=$(node "$computer/scripts/cleanup-plan.mjs" fields)
type_list=$(node "$computer/scripts/cleanup-plan.mjs" types | sed 's/[^ ][^ ]*/"&"/g; s/" "/", "/g')
query="*[_type in [$type_list]]{$fields}"
ask "$work/docs.json" --get --data-urlencode "query=$query" --data-urlencode 'perspective=raw' "$host/query/$dataset"
if [ "$curl_code" -ne 0 ] || [ "$http_code" != 200 ] || ! jq -e '.result | arrays' "$work/docs.json" > /dev/null 2>&1; then
  stop_run 0 0 "The documents could not be read, so nothing was deleted. $(why_failed)."
fi

jq -c --argjson now "$now_ms" --slurpfile setting "$work/setting-raw.json" '{setting: $setting[0], nowMs: $now, docs: .result}' "$work/docs.json" > "$work/input.json"
if ! node "$computer/scripts/cleanup-plan.mjs" plan "$work/input.json" > "$work/plan.json"; then
  stop_run 0 0 "cleanup-plan.mjs failed, so nothing was deleted."
fi
planned=$(jq '.candidates | length' "$work/plan.json")
stopped=$(jq -r 'if .stop then "yes" else "no" end' "$work/plan.json")

# The list comes first, before anything is deleted
list_mode=$mode
[ "$deleting" = yes ] || list_mode=list
node "$computer/scripts/cleanup-plan.mjs" text "$work/plan.json" "$iso_now" "$list_mode" > "$folder/list-$stamp.txt"
chmod 644 "$folder/list-$stamp.txt" 2> /dev/null || true

# Files older than the keep time go. The names carry the stamp, the age is the age of the file.
find "$folder" -maxdepth 1 -type f \( -name 'list-*.txt' -o -name 'backup-*.json' \) -mtime "+$keep_days" -exec rm -f {} + 2> /dev/null || true

answer_lines() {
  node "$computer/scripts/cleanup-plan.mjs" lines "$1"
}

if [ "$stopped" = yes ]; then
  message=$(node "$computer/scripts/cleanup-plan.mjs" stop "$work/plan.json")
  [ "$print" = no ] || answer_lines "$work/plan.json"
  write_status "$planned" 0 "$message"
  say "$message"
  exit 0
fi

if [ "$deleting" = no ]; then
  write_status "$planned" 0 ""
  if [ "$print" = yes ]; then
    answer_lines "$work/plan.json"
  else
    say "$planned documents would be deleted (list only). The list is in $folder/list-$stamp.txt."
  fi
  exit 0
fi

if [ "$planned" -eq 0 ]; then
  write_status 0 0 ""
  [ "$print" = no ] || printf 'result\tNothing was old enough to delete.\n'
  say "nothing is old enough to delete."
  exit 0
fi

# ----- the backup, before anything is deleted -----

jq -c '{query: "*[_id in $ids]", params: {ids: [.candidates[].ids[]]}}' "$work/plan.json" > "$work/ask.json"
ask "$work/fresh.json" --request POST --header 'Content-Type: application/json' --data-binary "@$work/ask.json" "$host/query/$dataset?perspective=raw"
if [ "$curl_code" -ne 0 ] || [ "$http_code" != 200 ] || ! jq -e '.result | arrays | length > 0' "$work/fresh.json" > /dev/null 2>&1; then
  stop_run "$planned" 0 "The backup could not be made, so nothing was deleted. $(why_failed)."
fi
backup="$folder/backup-$stamp.json"
if ! ( umask 077; jq -c --arg at "$iso_now" --arg dataset "$dataset" '{createdAt: $at, dataset: $dataset, documents: .result}' "$work/fresh.json" > "$backup.partial" ) 2> /dev/null ||
  ! jq -e '(.documents | length) > 0' "$backup.partial" > /dev/null 2>&1 ||
  ! mv -f "$backup.partial" "$backup" 2> /dev/null; then
  rm -f "$backup.partial" 2> /dev/null || true
  stop_run "$planned" 0 "The backup file could not be written, so nothing was deleted."
fi

# Only documents that are still the copies that were planned
jq -c '.result' "$work/fresh.json" > "$work/fresh-docs.json"
node "$computer/scripts/cleanup-plan.mjs" verify "$work/plan.json" "$work/fresh-docs.json" > "$work/final.json"
final=$(jq '.candidates | length' "$work/final.json")

# ----- the deleting, one document at a time, so that one that Sanity refuses does not hold back the rest -----

deleted=0
refused=0
first_problem=''
{
  echo
  echo "Backup: $backup"
} >> "$folder/list-$stamp.txt"
jq -c '.candidates[]' "$work/final.json" > "$work/each.jsonl"
while IFS= read -r candidate; do
  printf '%s' "$candidate" | jq -c '{mutations: (.ids | map({delete: {id: .}}))}' > "$work/delete.json"
  ask "$work/delete-answer.json" --request POST --header 'Content-Type: application/json' --data-binary "@$work/delete.json" "$host/mutate/$dataset"
  line=$(printf '%s' "$candidate" | jq -r '"\(.label) | \(.title) | id \(.id)"')
  if [ "$curl_code" -eq 0 ] && [ "$http_code" = 200 ]; then
    deleted=$((deleted + 1))
    echo "Deleted: $line" >> "$folder/list-$stamp.txt"
    continue
  fi
  refused=$((refused + 1))
  echo "Not deleted: $line ($(why_failed))" >> "$folder/list-$stamp.txt"
  [ -n "$first_problem" ] || first_problem=$(why_failed)
  # A token that is turned away is turned away for every document
  case $http_code in
    401|403) break ;;
  esac
done < "$work/each.jsonl"

summary="Deleted $deleted of $planned documents."
[ "$final" -ge "$planned" ] || summary="$summary $((planned - final)) were edited while the run was going and were kept."
[ "$refused" -eq 0 ] || summary="$summary $refused could not be deleted: $first_problem."
echo "$summary" >> "$folder/list-$stamp.txt"

if [ "$refused" -gt 0 ]; then
  write_status "$planned" "$deleted" "$first_problem"
else
  write_status "$planned" "$deleted" ""
fi
if [ "$print" = yes ]; then
  printf 'result\t%s Backup: %s\n' "$summary" "$(basename "$backup")"
  answer_lines "$work/final.json"
else
  say "$summary Backup: $backup"
fi
[ "$refused" -eq 0 ] || exit 1
