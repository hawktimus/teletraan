#!/bin/bash
# Usage: monday-sync.sh [--check | --debug <board number>]
# Reads the two Monday boards of the team, Robotics Tasks and Completed Tasks (their numbers and columns are
# in monday-contract.sh), and writes one task document for each parent item (task-monday-<item number>) into
# Sanity. A task whose item has gone is deleted. It also writes the document monday-status: when it last read,
# what went wrong, and the open and done tasks of each department. Needs curl and jq (docs/monday.md).
#
#   monday-sync.sh           one run, which the timer starts every 5 minutes. The run reads Monday only when
#                            the last read is older than "Read Monday every" in Dashboard Settings, Monday
#                            tab, or when Sync Monday now on the control page asked for a read
#   monday-sync.sh --check   asks Monday who the token belongs to, and writes nothing
#   monday-sync.sh --debug <board number>
#                            prints how Monday answers for the first two items of one board (no token, no
#                            names of people), and writes nothing
set -euo pipefail
. "$(dirname "$0")/lib.sh"
. "$computer/scripts/monday-contract.sh"
. "$computer/scripts/monday-requests.sh"
. "$computer/scripts/monday-check.sh"
. "$computer/scripts/monday-programs.sh"

usage() {
  echo "Usage: $0 [--check | --debug <board number>]" >&2
  exit 1
}

for tool in curl jq; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    echo "The $tool command is missing. Install the packages with:" >&2
    echo "  sudo apt install curl jq" >&2
    exit 1
  fi
done

mode=run
case ${1:-} in
  '') ;;
  --check) mode=check ;;
  --debug) mode=debug ;;
  *) usage ;;
esac
if [ "$mode" = debug ]; then
  [ "$#" -eq 2 ] || usage
  printf '%s' "$2" | grep -Eq '^[0-9]{1,20}$' || usage
else
  [ "$#" -le 1 ] || usage
fi

monday_token=$(setting MONDAY_API_TOKEN)
write_token=$(setting SANITY_WRITE_TOKEN)

if [ "$mode" = check ]; then
  run_check
fi
if [ "$mode" = debug ]; then
  run_debug "$2"
fi

case $monday_token in
  ''|'['*) not_set_up MONDAY_API_TOKEN ;;
esac
looks_like_key MONDAY_API_TOKEN "$monday_token"
case $write_token in
  ''|'['*) not_set_up SANITY_WRITE_TOKEN ;;
esac
looks_like_key SANITY_WRITE_TOKEN "$write_token"

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
monday="$data/monday"

if [ ! -d "$data" ]; then
  echo "The data folder $data does not exist. See docs/rebuilding-the-computer.md." >&2
  exit 1
fi

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)

if ! printf '%s' "$project" | grep -Eq '^[a-z0-9]+$' ||
  ! printf '%s' "$dataset" | grep -Eq '^[A-Za-z0-9_-]+$' ||
  ! printf '%s' "$version" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "Could not read the project ID, dataset and API version from dashboard/config.js. Check that projectId, dataset and apiVersion are in that file." >&2
  exit 1
fi
host="https://$project.api.sanity.io"

mkdir -p "$monday"

# A run that starts while the last one is still going stops at once
exec 9> "$monday/.lock"
if ! flock -n 9; then
  echo "The last run is still going, so this one stops."
  exit 0
fi

# Nothing else is working while this run holds the lock, so a work folder that is still here was left by a
# run that a power cut or a reboot stopped
rm -rf "$monday"/.work.*
work=$(mktemp -d "$monday/.work.XXXXXX")
trap 'rm -rf "$work"' EXIT
: > "$work/errors.txt"

status=0
curl --disable --silent --get --max-time 30 --connect-timeout 10 --max-filesize 10000000 --proto '=https' \
  --data-urlencode "query=$query" --data-urlencode 'perspective=published' \
  --output "$work/sanity.json" "$host/v$version/data/query/$dataset" 2> /dev/null || status=$?

if [ "$status" -ne 0 ] || ! jq -e '.result | objects' "$work/sanity.json" > /dev/null 2>&1; then
  echo "Could not get the settings from Sanity. Nothing was changed. Check that the Teletraan computer is online; the next run tries again." >&2
  exit 1
fi

zone=$(jq -r '.result.zone | strings' "$work/sanity.json")
case $zone in
  ''|*[!A-Za-z0-9_+/-]*) zone=$default_zone ;;
esac
today=$(TZ="$zone" date +%Y-%m-%d)
now_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# How often the Teletraan computer reads, from 5 to 120 minutes, and how old the last read is. The timer wakes
# this script every 5 minutes, and a run that comes before the setting says so ends without a word.
every=$(jq -r --argjson start "$every_default" '.result.every | if type == "number" and . >= 5 and . <= 120 then floor else $start end' "$work/sanity.json")
due=$(jq -r --arg now "$now_iso" --argjson every "$every" --argjson slack "$slack_seconds" '
  def seconds: sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601;
  (try ((($now | seconds) - (.result.known.lastSyncAt | seconds))) catch null) as $age
  | if $age == null or $age < 0 or $age >= ($every * 60 - $slack) then "yes" else "no" end' "$work/sanity.json")
# The Sync Monday now button leaves this file (control-helper.sh); a run within two minutes of it reads at once,
# because a button that waited for the setting looked as if it did nothing
if [ "$due" = no ] && [ -z "$(find /tmp/teletraan-monday-force -mmin -2 2> /dev/null)" ]; then
  exit 0
fi

# The reads made today. A new day starts at midnight in the time zone of the screen.
calls_before=$(jq -r --arg today "$today" '(.result.known | objects | select(.callsDate == $today) | .callsToday | numbers | floor) // 0' "$work/sanity.json")

# A run on a day that has used up the reads waits for midnight and says why. Nothing is asked of Monday.
if [ "$calls_before" -ge "$daily_limit" ]; then
  jq -n --arg message "$daily_limit_message" --arg today "$today" --argjson calls "$calls_before" '
    {mutations: [
      {createIfNotExists: {_id: "monday-status", _type: "mondayStatus"}},
      {patch: {id: "monday-status", set: {lastError: $message, callsToday: $calls, callsDate: $today}}}
    ]}' > "$work/write.json"
  write_to_sanity "$work/write.json" || true
  echo "monday: $daily_limit_message"
  exit 0
fi

: > "$work/readings.ndjson"

# The two boards, every page, parents and subitems (the rows leave the subitems out)
read_board tasks "$task_board" "$(jq -c -n --argjson columns "$columns" --argjson names "$task_board_columns" '[$names[] | $columns[.]]')"
tasks_read=$read_all
read_board done "$done_board" "$(jq -c -n --argjson columns "$columns" --argjson names "$done_board_columns" '[$names[] | $columns[.]]')"
done_read=$read_all

complete=no
if [ "$tasks_read" = yes ] && [ "$done_read" = yes ]; then
  complete=yes
fi

# The first names of the first person in Assigned of each parent item, in one question
cat "$work/tasks-items.ndjson" "$work/done-items.ndjson" > "$work/all-items.ndjson"
jq -s -c --argjson columns "$columns" '[.[] | select(.parent == null) | (.values[$columns.assigned].people // [])[0] | strings] | unique | .[0:200]' "$work/all-items.ndjson" > "$work/people.json"
echo '{}' > "$work/names.json"
if [ "$(jq 'length' "$work/people.json")" -gt 0 ]; then
  jq -n --arg query "$monday_query_users" --slurpfile ids "$work/people.json" '{query: $query, variables: {ids: $ids[0]}}' > "$work/body.json"
  ask "$work/body.json" "$work/users.json"
  if [ "$outcome" = ok ]; then
    jq -c --argjson limit "$contact_limit" "$paths$helpers"'[users_list | arrays | .[] | objects | {key: user_id, value: (user_name | first_name($limit))} | select(.value != null)] | from_entries' \
      "$work/users.json" > "$work/names.json" 2> /dev/null || echo '{}' > "$work/names.json"
  fi
fi

: > "$work/rows.ndjson"
for board in tasks done; do
  board_id=$task_board
  is_done=no
  if [ "$board" = done ]; then
    board_id=$done_board
    is_done=yes
  fi
  jq -n -c --slurpfile items "$work/$board-items.ndjson" --slurpfile names "$work/names.json" \
    --argjson labels "$labels" --argjson columns "$columns" --arg board "$board_id" --arg done "$is_done" \
    --argjson title_limit "$title_limit" --argjson contact_limit "$contact_limit" \
    "$helpers"'$names[0] as $names | '"$task_rows" >> "$work/rows.ndjson"
done

echo "monday: $(wc -l < "$work/rows.ndjson" | tr -d ' ') task(s) read"

failed=0

if [ "$tasks_read" = yes ] || [ "$done_read" = yes ]; then
  jq -n --slurpfile sanity "$work/sanity.json" --slurpfile rows "$work/rows.ndjson" --slurpfile readings "$work/readings.ndjson" \
    --arg complete "$complete" "$helpers"'$sanity[0].result as $found | '"$plan" > "$work/plan.json"
fi

if [ -s "$work/plan.json" ]; then
  groups=$(jq '.groups | length' "$work/plan.json")
  start=0
  while [ "$start" -lt "$groups" ]; do
    jq -c --argjson start "$start" --argjson count "$rows_per_write" \
      '{mutations: (.groups[$start:($start + $count)] | add)}' "$work/plan.json" > "$work/write.json"
    if ! write_to_sanity "$work/write.json"; then
      failed=1
      break
    fi
    start=$((start + rows_per_write))
  done

  echo "monday: $(jq -r '"\(.tasks) task(s), \(.created) new, \(.changed) changed, \(.deleted) deleted"' "$work/plan.json")"
fi

calls_after=$((calls_before + requests))

jq -n --slurpfile sanity "$work/sanity.json" --slurpfile readings "$work/readings.ndjson" --slurpfile rows "$work/rows.ndjson" \
  --rawfile errors "$work/errors.txt" --arg now "$now_iso" --arg today "$today" --argjson calls "$calls_after" \
  --arg complete "$complete" --argjson labels "$labels" --argjson snapshots_kept "$snapshots_kept" \
  "$helpers$status_patch" > "$work/status-patch.json"
jq '{mutations: [{createIfNotExists: {_id: "monday-status", _type: "mondayStatus"}}, {patch: ({id: "monday-status", set: .set} + (if (.unset | length) == 0 then {} else {unset: .unset} end))}]}' "$work/status-patch.json" > "$work/write.json"

status_written=no
if write_to_sanity "$work/write.json"; then
  status_written=yes
  echo "monday: status written"
else
  failed=1
fi

# The time of this run goes to status-mini, when both boards were read and the status could be written.
# status-write.sh never stops this script.
if [ "$complete" = yes ] && [ "$status_written" = yes ]; then
  "$computer/scripts/status-write.sh" monday || true
fi

# What went wrong is also in the status, for the Studio. Here it is for the journal.
if [ -s "$work/errors.txt" ]; then
  while read -r line; do
    echo "monday: $line" >&2
  done < "$work/errors.txt"
  failed=1
fi
exit "$failed"
