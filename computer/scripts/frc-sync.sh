#!/bin/bash
# Usage: frc-sync.sh [--now | --check | --event <key> --to <file>]
# Reads the public FRC data of each team in Sanity from The Blue Alliance (the
# read API, version 3) and from Statbotics, and writes what the screen shows into
# the document frc-status in Sanity: each team's events, next match, last
# results, rank, alliance, awards, rating and district points. The screen reads
# that document with the rest of the content. Needs curl and jq
# (docs/rebuilding-the-computer.md, step 17, and docs/frc-feed.md).
#
#   frc-sync.sh           one run, which the timer starts every 5 minutes. A run
#                         does its work about once an hour, and every 5 minutes
#                         while a team has an event on
#   frc-sync.sh --now     one run now, whatever the time
#   frc-sync.sh --check   asks The Blue Alliance one question to see that the key
#                         works, and writes nothing
#   frc-sync.sh --event <key> --to <file>
#                         reads one past event (2026ncwak) from The Blue Alliance into a JSON
#                         file, for tools/frc-fixture.mjs (docs/frc-feed.md, "Try a card on a
#                         past event"). It needs only the key, and writes nothing to Sanity
set -euo pipefail
. "$(dirname "$0")/lib.sh"
. "$computer/scripts/frc-contract.sh"
. "$computer/scripts/frc-requests.sh"
. "$computer/scripts/frc-modes.sh"
. "$computer/scripts/frc-read.sh"
. "$computer/scripts/frc-programs.sh"

usage() {
  echo "Usage: $0 [--now | --check | --event <key> --to <file>]" >&2
  exit 1
}

for tool in curl jq; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    echo "The $tool command is missing. Install the packages with:" >&2
    echo "  sudo apt install curl jq" >&2
    exit 1
  fi
done

mode=timer
wanted_event=""
wanted_file=""
case ${1:-} in
  '') ;;
  --now) mode=now ;;
  --check) mode=check ;;
  --event)
    mode=event
    [ "$#" -eq 4 ] && [ "$3" = --to ] || usage
    wanted_event=$2
    wanted_file=$4
    ;;
  *) usage ;;
esac
if [ "$mode" != event ]; then
  [ "$#" -le 1 ] || usage
fi

tba_key=$(setting TBA_AUTH_KEY)
write_token=$(setting SANITY_WRITE_TOKEN)

case $tba_key in
  ''|'['*) not_set_up TBA_AUTH_KEY ;;
esac
looks_like_key TBA_AUTH_KEY "$tba_key"

if [ "$mode" = check ]; then
  run_check
fi

if [ "$mode" = event ]; then
  run_event
fi

case $write_token in
  ''|'['*) not_set_up SANITY_WRITE_TOKEN ;;
esac
looks_like_key SANITY_WRITE_TOKEN "$write_token"

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
frc="$data/frc"
cache="$frc/cache"

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

# The data folder is shown to the web server inside the container
umask 022
mkdir -p "$cache"

# A run that starts while the last one is still going stops at once
exec 9> "$frc/.lock"
if ! flock -n 9; then
  echo "The last run is still going, so this one stops."
  exit 0
fi

now=$(date +%s)
case $now in
  ''|*[!0-9]*)
    echo "Could not read the clock. Check that the date command works on the Teletraan computer." >&2
    exit 1
    ;;
esac

state="$frc/state.json"

# One value from state.json, which the last run left. Nothing when there is none.
state_value() {
  [ -f "$state" ] || return 0
  jq -r "$1 // empty" "$state" 2> /dev/null || true
}

# Whether it is time. A run that was stopped by the request limit goes on at the
# next start. Otherwise the wait since the last run depends on whether a team has
# an event today, by the dates the last run saw.
if [ "$mode" = timer ] && [ -f "$state" ]; then
  zone=$(state_value .zone)
  case $zone in
    ''|*[!A-Za-z0-9_+/-]*) zone=$default_zone ;;
  esac
  today=$(TZ="$zone" date +%Y-%m-%d)
  last_run=$(state_value .lastRunAt)
  case $last_run in
    ''|*[!0-9]*) last_run=0 ;;
  esac
  on_now=$(jq -r --arg today "$today" '[.windows[]? | select(.start <= $today and $today <= .end)] | length' "$state" 2> /dev/null || echo 0)
  if [ "$(state_value .unfinished)" != true ]; then
    needed=$quiet_gap
    if [ "$on_now" != 0 ]; then
      needed=$event_gap
    fi
    gap=$((now - last_run))
    if [ "$gap" -ge 0 ] && [ "$gap" -lt "$needed" ]; then
      exit 0
    fi
  fi
fi

# Nothing else is working while this run holds the lock, so a work folder that
# is still here was left by a run that a power cut or a reboot stopped
rm -rf "$frc"/.work.*
work=$(mktemp -d "$frc/.work.XXXXXX")
trap 'rm -rf "$work"' EXIT

# The teams, the time zone of the screen, and what this script wrote last time.
# The dataset is public, so no token is sent. The ordinary host is used and not
# the cached one, because the answer must be the newest.
query='{
  "zone": *[_id == "theme"][0].timeZone,
  "teams": *[_type == "team" && !(_id in path("drafts.**")) && active != false] | order(order asc, _createdAt asc) { code, number },
  "previous": *[_id == "frc-status"][0] { season, "teams": teams[] { team, events, lastSeason, snapshots } }
}'

status=0
curl --disable --silent --get --max-time 30 --connect-timeout 10 --max-filesize 10000000 --proto '=https' \
  --data-urlencode "query=$query" --data-urlencode 'perspective=published' \
  --output "$work/sanity.json" "$host/v$version/data/query/$dataset" 2> /dev/null || status=$?

if [ "$status" -ne 0 ] || ! jq -e '.result | objects' "$work/sanity.json" > /dev/null 2>&1; then
  echo "Could not get the teams from Sanity. Nothing was changed. Check that the Teletraan computer is online; the next run tries again." >&2
  exit 1
fi

zone=$(jq -r '.result.zone | strings' "$work/sanity.json")
case $zone in
  ''|*[!A-Za-z0-9_+/-]*) zone=$default_zone ;;
esac
today=$(TZ="$zone" date +%Y-%m-%d)
year=$(TZ="$zone" date +%Y)
now_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# The season is a plain four digit year, and the district code is part of an
# address, so both are checked
if ! printf '%s' "$year" | grep -Eq '^[0-9]{4}$' || ! printf '%s' "$district_code" | grep -Eq '^[a-z]{2,4}$'; then
  echo "The year or the district code is not usable." >&2
  exit 1
fi

slots=null
if printf '%s' "$district_slots" | grep -Eq '^[1-9][0-9]{0,3}$'; then
  slots=$district_slots
fi

# A team needs a code and a number of up to five digits. One without a number is
# skipped, and says so without it being an error.
jq -c '[.result.teams | arrays | .[] | objects
  | select((.code | type) == "string" and (.code | test("\\A[a-z0-9]{1,10}\\z")))
  | select((.number | type) == "string" and (.number | test("\\A *[1-9][0-9]{0,4} *\\z")))
  | {code, number: (.number | gsub(" "; "")), key: ("frc" + (.number | gsub(" "; "")))}]
  | reduce .[] as $team ([]; if any(.[]; .number == $team.number) then . else . + [$team] end)' \
  "$work/sanity.json" > "$work/teams.json"

jq -r '.result.teams | arrays | .[] | objects
  | select((.code | type) == "string" and (.code | test("\\A[a-z0-9]{1,10}\\z")))
  | select(((.number | type) == "string" and (.number | test("\\A *[1-9][0-9]{0,4} *\\z"))) | not)
  | "team \(.code): no team number, skipped"' "$work/sanity.json"

# The cycle is one pass over every address. A pass stopped by the request limit
# goes on at the next run, and cycle.txt says which answers it has already read.
# etags.json keeps the ETag of each answer, and cache/ keeps the answer itself,
# because a service that says "no change" does not send it again.
cycle="$frc/cycle.txt"
etags="$frc/etags.json"
if [ "$(state_value .unfinished)" != true ] || [ ! -f "$cycle" ]; then
  : > "$cycle"
fi
if ! jq -e 'objects' "$etags" > /dev/null 2>&1; then
  echo '{}' > "$etags"
fi
field_times="$frc/field-times.json"
if ! jq -e 'objects' "$field_times" > /dev/null 2>&1; then
  echo '{}' > "$field_times"
fi

: > "$work/notes.txt"
: > "$work/errors.txt"
: > "$work/seen.txt"
: > "$work/field-events.txt"

requests=0
field_requests=0
field_capped=no
failures=0
stopped=""
statbotics_off=no
outcome=stopped

# The values that go into an address have all been checked, so none holds a /
# or an &
team_key=""
team_number=""
event_key=""
match_key=""
district_key=""

read_everything

case $stopped in
  capped) note "This run stopped after $max_requests requests and goes on at the next run." ;;
esac
if [ "$field_capped" = yes ]; then
  note "Field strength: this run read $field_requests ratings from Statbotics, which is the limit. The rest are read at the next run."
fi
if [ "$statbotics_off" = yes ] && [ -s "$work/field-events.txt" ]; then
  note "Field strength and the chances of our matches were skipped, because Statbotics refused the request."
fi

# Everything read so far, by the name it is kept under, in one file for the
# filters below
echo '{}' > "$work/bundle.json"
for file in "$cache"/*.json; do
  [ -f "$file" ] || continue
  name=$(basename "$file" .json)
  jq --arg name "$name" --slurpfile body "$file" '.[$name] = $body[0]' "$work/bundle.json" > "$work/bundle.new"
  mv -f "$work/bundle.new" "$work/bundle.json"
done

# Answers that nothing asked for in this run are not kept
for file in "$cache"/*.json; do
  [ -f "$file" ] || continue
  name=$(basename "$file" .json)
  if ! grep -Fxq -- "$name" "$work/seen.txt"; then
    rm -f "$file"
    forget_etag "$name"
  fi
done

if ! jq -n \
  --slurpfile bundle "$work/bundle.json" --slurpfile teams "$work/teams.json" --slurpfile answer "$work/sanity.json" \
  --arg year "$year" --arg today "$today" --arg now "$now_iso" --argjson slots "$slots" \
  --argjson results_kept "$results_kept" --argjson snapshots_kept "$snapshots_kept" --argjson awards_kept "$awards_kept" \
  --argjson scheduled_kept "$scheduled_kept" --argjson field_kept "$field_kept" --argjson trend_points "$trend_points" \
  --rawfile field_events "$work/field-events.txt" \
  --rawfile notes "$work/notes.txt" --rawfile errors "$work/errors.txt" \
  "$paths$helpers$build" > "$work/status.json"; then
  echo "Could not build the status from what was read. The next run tries again." >&2
  exit 1
fi

# The same document without the time, to see whether anything changed
jq 'del(.lastSyncAt)' "$work/status.json" > "$work/compare.json"

last_write=$(state_value .lastWriteAt)
case $last_write in
  ''|*[!0-9]*) last_write=0 ;;
esac

write=no
if [ ! -f "$frc/written.json" ] || ! cmp -s "$work/compare.json" "$frc/written.json"; then
  write=yes
elif [ $((now - last_write)) -lt 0 ] || [ $((now - last_write)) -ge "$refresh_gap" ]; then
  write=yes
fi

failed=0

if [ "$write" = yes ]; then
  jq -n --slurpfile document "$work/status.json" '{mutations: [{createOrReplace: $document[0]}]}' > "$work/mutation.json"

  status=0
  printf 'header = "Authorization: Bearer %s"\n' "$write_token" |
    curl --disable --silent --fail --max-time 30 --connect-timeout 10 --proto '=https' --config - \
      --request POST --header 'Content-Type: application/json' --data-binary "@$work/mutation.json" \
      --output /dev/null "$host/v$version/data/mutate/$dataset" 2> /dev/null || status=$?

  if [ "$status" -eq 0 ]; then
    mv -f "$work/compare.json" "$frc/written.json"
    last_write=$now
    echo "frc: status written"
  else
    failed=1
    if [ "$status" -eq 22 ]; then
      echo "frc: Sanity refused the status, so the token may be wrong or may not have Editor access." >&2
    else
      echo "frc: could not write the status, $(explain "$status")." >&2
    fi
  fi
else
  echo "frc: nothing changed, status not written"
fi

# The dates of every event, so that the next start can tell whether one is on
jq -c "$paths"'
  [to_entries[] | select(.key | startswith("tba-events-")) | .value | arrays | .[] | objects
    | select((event_start | type) == "string" and (event_end | type) == "string")
    | select((event_start | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")) and (event_end | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")))
    | {start: event_start, end: event_end}]
  | unique | .[0:60]' "$work/bundle.json" > "$work/windows.json"

unfinished=false
case $stopped in
  capped|limit) unfinished=true ;;
esac
if [ "$field_capped" = yes ]; then
  unfinished=true
fi

jq -n --arg zone "$zone" --argjson run "$now" --argjson wrote "$last_write" --argjson unfinished "$unfinished" \
  --slurpfile windows "$work/windows.json" \
  '{zone: $zone, lastRunAt: $run, lastWriteAt: $wrote, unfinished: $unfinished, windows: $windows[0]}' > "$state.new"
mv -f "$state.new" "$state"

echo "frc: $requests request(s) to the two services, and $field_requests to Statbotics for the field strength"

# The time of this run goes to status-mini, unless the services turned the run
# away or the status could not be written. status-write.sh never stops this script.
if [ "$failed" -eq 0 ] && [ "$stopped" != refused ] && [ "$stopped" != network ]; then
  "$computer/scripts/status-write.sh" frc || true
fi

# What went wrong is also in the status, for Studio. Here it is for the journal.
if [ -s "$work/errors.txt" ]; then
  while read -r line; do
    echo "frc: $line" >&2
  done < "$work/errors.txt"
  failed=1
fi
exit "$failed"
