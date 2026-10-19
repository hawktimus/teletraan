#!/bin/bash
# Usage: match13-sync.sh [--now | --check]
# Reads the forecasts of Match13 (https://match13.com) for the teams and events of the
# competition feed and writes the few numbers the forecast cards need into match13.json in the
# data folder. The screen reads that file from /dashboard/data/live/match13.json. Needs curl and jq
# (docs/match13.md).
#
# Match13 marks its answers private, and the Sanity dataset is public, so nothing from
# Match13 goes to Sanity. Only match13-status.json (a time, a state and a count) is sent to
# Studio, by status-write.sh match13.
#
#   match13-sync.sh          what the timer runs. It does its work every 30 minutes while a team has an
#                            event within 14 days or on, and every 6 hours otherwise
#   match13-sync.sh --now    one run now, whatever the time. The control page button uses this
#   match13-sync.sh --check  asks Match13 one question to see that the key works, and writes nothing
#
# Politeness: the key is sent in a curl config on standard input and never on a command line, a run
# makes at most 20 requests, an answer that has not changed is asked for with its ETag, a 429 stops
# the run and is waited out by its Retry-After, and a server error or a refused key stops it and
# waits an hour (six hours for a refused key). Match13 can revoke a key for abuse.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

host='https://actions.match13.com'
agent='Teletraan I wall dashboard of FRC team 3229 (match13-sync.sh)'
max_requests=20
busy_gap=1800
quiet_gap=21600
default_zone=America/New_York
default_district=fnc

usage() {
  echo "Usage: $0 [--now | --check]" >&2
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
case ${1:-} in
  '') ;;
  --now) mode=now ;;
  --check) mode=check ;;
  *) usage ;;
esac
[ "$#" -le 1 ] || usage

key=$(setting MATCH13_API_KEY)
data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
folder="$data/match13"

# The status line Studio shows. status-write.sh match13 sends it. count is how many teams the file holds.
write_status() {
  printf '{"at":"%s","state":"%s","count":%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "${2:-0}" > "$data/match13-status.json.new"
  mv -f "$data/match13-status.json.new" "$data/match13-status.json"
  "$computer/scripts/status-write.sh" match13 || true
}

case $key in
  ''|'['*)
    echo "There is no MATCH13_API_KEY in local.env yet, so nothing was read. See docs/match13.md."
    if [ -d "$data" ] && [ "$mode" != check ]; then
      if ! grep -q '"state":"no-key"' "$data/match13-status.json" 2> /dev/null; then write_status no-key 0; fi
    fi
    exit 0
    ;;
esac

if ! printf '%s' "$key" | grep -Eq '^[A-Za-z0-9_.-]+$'; then
  echo "MATCH13_API_KEY in local.env does not look like a key. Paste it again, with nothing else on the line." >&2
  exit 1
fi

# The key goes to curl on standard input, so it never shows in the process list
secret_settings() {
  printf 'header = "Authorization: Bearer %s"\n' "$key"
}

if [ "$mode" = check ]; then
  code=$(secret_settings | curl --disable --silent --max-time 30 --connect-timeout 10 --proto '=https' --user-agent "$agent" \
    --output /dev/null --write-out '%{http_code}' --config - "$host/v1/years" 2> /dev/null) || code=000
  case $code in
    200|304) echo "OK    Match13 accepted the key." ;;
    401) echo "FAIL  Match13 did not accept the key. Check MATCH13_API_KEY in the Keys section of Settings of the control page." ; exit 1 ;;
    429) echo "FAIL  Match13 says there were too many requests. Try again in a minute." ; exit 1 ;;
    *) echo "FAIL  Match13 did not answer (code $code)." ; exit 1 ;;
  esac
  exit 0
fi

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
sanity="https://$project.api.sanity.io"

umask 022
mkdir -p "$folder/sections"

exec 9> "$folder/.lock"
if ! flock -n 9; then
  echo "The last run is still going, so this one stops."
  exit 0
fi

now=$(date +%s)
state="$folder/state.json"
etags="$folder/etags.json"

state_value() {
  [ -f "$state" ] || return 0
  jq -r "$1 // empty" "$state" 2> /dev/null || true
}

# A key that was pasted since the last run starts over: the fingerprint is not the key
fingerprint=$(printf '%s' "$key" | cksum | cut -d ' ' -f 1)
if [ "$(state_value .fingerprint)" != "$fingerprint" ]; then
  rm -f "$state"
fi

if [ "$mode" = timer ] && [ -f "$state" ]; then
  wait_until=$(state_value .notBefore)
  last_run=$(state_value .lastRunAt)
  gap=$(state_value .gap)
  case $wait_until in ''|*[!0-9]*) wait_until=0 ;; esac
  case $last_run in ''|*[!0-9]*) last_run=0 ;; esac
  case $gap in ''|*[!0-9]*) gap=$busy_gap ;; esac
  if [ "$now" -lt "$wait_until" ]; then exit 0; fi
  if [ "$now" -ge "$last_run" ] && [ $((now - last_run)) -lt $((gap - 60)) ]; then exit 0; fi
fi
if [ "$mode" = now ] && [ -f "$state" ]; then
  # Even by hand, a refusal or a limit is waited out
  wait_until=$(state_value .notBefore)
  case $wait_until in ''|*[!0-9]*) wait_until=0 ;; esac
  if [ "$now" -lt "$wait_until" ]; then
    echo "Match13 asked this computer to wait ($(state_value .waitReason)), so nothing was read. The timer reads again when the wait is over."
    exit 0
  fi
fi

rm -rf "$folder"/.work.*
work=$(mktemp -d "$folder/.work.XXXXXX")
trap 'rm -rf "$work"' EXIT

# The teams of the screen, the time zone, and what the competition feed knows. The dataset is public, so no token is sent.
query='{
  "zone": *[_id == "theme"][0].timeZone,
  "teams": *[_type == "team" && !(_id in path("drafts.**")) && active != false] | order(order asc, _createdAt asc) { code, number },
  "frc": *[_id == "frc-status"][0] { season, "teams": teams[] { team, number, focusEvent, "events": events[] { key, startDate, endDate } } }
}'
status=0
curl --disable --silent --get --max-time 30 --connect-timeout 10 --max-filesize 10000000 --proto '=https' \
  --data-urlencode "query=$query" --data-urlencode 'perspective=published' \
  --output "$work/sanity.json" "$sanity/v$version/data/query/$dataset" 2> /dev/null || status=$?
if [ "$status" -ne 0 ] || ! jq -e '.result | objects' "$work/sanity.json" > /dev/null 2>&1; then
  echo "Could not get the teams from Sanity. Nothing was changed. Check that the Teletraan computer is online; the next run tries again." >&2
  exit 1
fi

zone=$(jq -r '.result.zone | strings' "$work/sanity.json")
case $zone in ''|*[!A-Za-z0-9_+/-]*) zone=$default_zone ;; esac
today=$(TZ="$zone" date +%Y-%m-%d)
year=$(TZ="$zone" date +%Y)
season=$(jq -r '.result.frc.season | numbers' "$work/sanity.json")
case $season in [0-9][0-9][0-9][0-9]) year=$season ;; esac
district=$(setting MATCH13_DISTRICT)
printf '%s' "$district" | grep -Eq '^[a-z]{2,4}$' || district=$default_district

# Our teams: the Team documents, with 3229 first. A number is one to five digits.
jq -c '[(.result.teams | arrays | .[] | objects | select((.number | type) == "string" and (.number | test("\\A *[1-9][0-9]{0,4} *\\z"))) | {code: (.code // ""), number: (.number | gsub(" "; "") | tonumber)})]
  | reduce .[] as $team ([]; if any(.[]; .number == $team.number) then . else . + [$team] end) | .[0:3]' "$work/sanity.json" > "$work/ours.json"
if [ "$(jq 'length' "$work/ours.json")" = 0 ]; then
  echo '[{"code":"prime","number":3229}]' > "$work/ours.json"
fi
jq -c '[.[].number]' "$work/ours.json" > "$work/numbers.json"

# The events to read: the focus event of each team, and any event that is on or within 14 days. Three at most, earliest first.
jq -c --arg today "$today" --argjson numbers "$(cat "$work/numbers.json")" '
  (($today + "T00:00:00Z" | fromdate) + 14 * 86400 | todate | .[0:10]) as $horizon
  | [.result.frc.teams | arrays | .[] | objects | select(.number as $n | $numbers | index($n))
     | . as $team | (.events // [])[] | select((.key | type) == "string" and (.key | test("\\A[0-9]{4}[a-z0-9]{2,12}\\z")))
     | select(.key == $team.focusEvent or ((.endDate // "9999") >= $today and (.startDate // "9999") <= $horizon))
     | {key, start: (.startDate // "9999-12-31"), end: (.endDate // "9999-12-31")}]
  | unique_by(.key) | sort_by(.start) | .[0:3]' "$work/sanity.json" > "$work/events.json"

busy=$(jq -r --arg today "$today" '(($today + "T00:00:00Z" | fromdate) + 14 * 86400 | todate | .[0:10]) as $h | [.[] | select(.end >= $today and .start <= $h)] | length' "$work/events.json")
gap=$quiet_gap
if [ "$busy" != 0 ]; then gap=$busy_gap; fi

[ -f "$etags" ] && jq -e 'objects' "$etags" > /dev/null 2>&1 || echo '{}' > "$etags"
: > "$work/errors.txt"
: > "$work/read.txt"
: > "$work/notes.txt"
requests=0
failures=0
stopped=''
outcome=stopped
retry_after=0

forget_etag() {
  jq --arg name "$1" 'del(.[$name])' "$etags" > "$etags.new" && mv -f "$etags.new" "$etags"
}

# Asks for one address. $1 is the name the reduced answer is kept under, $2 the address after the host and $3 a jq
# filter that keeps only the numbers a card needs (it is given $numbers, the numbers of our teams, and $ours). Leaves
# one word in $outcome: changed, same, missing (Match13 has nothing there), failed or stopped.
get() {
  name=$1
  where=$2
  filter=$3
  section="$folder/sections/$name.json"
  outcome=stopped
  if [ -n "$stopped" ]; then return 0; fi
  if [ "$requests" -ge "$max_requests" ]; then
    stopped=capped
    return 0
  fi
  requests=$((requests + 1))

  sent=$(jq -r --arg name "$name" '.[$name] // empty' "$etags" 2> /dev/null || true)
  if [ ! -f "$section" ] || ! printf '%s' "$sent" | grep -Eq '^(W/)?"[A-Za-z0-9_-]{4,100}"$'; then sent=''; fi
  set --
  if [ -n "$sent" ]; then set -- --header "If-None-Match: $sent"; fi

  curl_status=0
  code=$(secret_settings | curl --disable --silent --max-time 30 --connect-timeout 10 --max-filesize 5000000 \
    --proto '=https' --user-agent "$agent" --dump-header "$work/headers.txt" --output "$work/answer.json" \
    --write-out '%{http_code}' "$@" --config - "$host$where" 2> /dev/null) || curl_status=$?
  if [ "$curl_status" -ne 0 ]; then
    outcome=failed
    echo "Match13 did not answer ($name), curl exit code $curl_status." >> "$work/errors.txt"
    failures=$((failures + 1))
    if [ "$failures" -ge 2 ]; then stopped=network; fi
    return 0
  fi
  case $code in [0-9][0-9][0-9]) ;; *) code=000 ;; esac

  case $code in
    200|304|404) echo "$name" >> "$work/read.txt" ;;
  esac
  case $code in
    200)
      failures=0
      if jq -c --argjson numbers "$(cat "$work/numbers.json")" --argjson ours "$(cat "$work/ours.json")" "$filter" "$work/answer.json" > "$work/section.json" 2> /dev/null && [ -s "$work/section.json" ]; then
        mv -f "$work/section.json" "$section"
        etag=$(sed -n 's/^[Ee][Tt][Aa][Gg]: *//p' "$work/headers.txt" | tr -d '\r' | tail -n 1)
        if printf '%s' "$etag" | grep -Eq '^(W/)?"[A-Za-z0-9_-]{4,100}"$'; then
          jq --arg name "$name" --arg etag "$etag" '.[$name] = $etag' "$etags" > "$etags.new" && mv -f "$etags.new" "$etags"
        else
          forget_etag "$name"
        fi
        outcome=changed
      else
        outcome=failed
        echo "Match13 sent an answer that is not the shape expected ($name)." >> "$work/errors.txt"
      fi
      ;;
    304)
      failures=0
      if [ -f "$section" ]; then
        outcome=same
      else
        forget_etag "$name"
        outcome=failed
      fi
      ;;
    404)
      failures=0
      echo 'null' > "$section"
      forget_etag "$name"
      outcome=missing
      ;;
    401|403)
      outcome=failed
      stopped=refused
      ;;
    429)
      outcome=failed
      stopped=limit
      retry_after=$(sed -n 's/^[Rr][Ee][Tt][Rr][Yy]-[Aa][Ff][Tt][Ee][Rr]: *//p' "$work/headers.txt" | tr -d '\r ' | tail -n 1)
      case $retry_after in ''|*[!0-9]*) retry_after=300 ;; esac
      ;;
    5[0-9][0-9])
      outcome=failed
      failures=$((failures + 1))
      if [ "$failures" -ge 2 ]; then stopped=down; fi
      ;;
    *)
      outcome=failed
      echo "Match13 answered with code $code ($name)." >> "$work/errors.txt"
      ;;
  esac
}

# What a card needs, kept small: numbers are rounded to two places
round='def r: if type == "number" then (. * 100 | round / 100) else . end;'

filter_team='(. // {}) | {xp, xpFast, xpSlow, normXp, percentile, rank, xAuto, xTele, xEnd, epa, opr, dpr} | map_values(r)'
filter_history='[.events[]? | {eventKey, xpStart, xpEnd, xpMean, xpMax, sos, districtPoints: (.districtPoints.total // null)} | map_values(r)]'
filter_sim='($numbers) as $n | (.teams | sort_by(.meanRank)) as $by
  | {iterations, simmedAt, teamCount: (.teams | length),
     teams: ([$by[0:10][], ($by[] | select(.teamNumber as $t | $n | index($t)))] | unique_by(.teamNumber) | sort_by(.meanRank)
       | map({teamNumber, meanRank, meanRps, p5, p50, p95} | map_values(r)))}'
filter_field='($numbers) as $n
  | [.teams[] | {teamNumber, xp: (.xpEnd // .xpStart), xAuto, xTele, xEnd, epa, sos}] | sort_by(-(.xp // -1000)) | to_entries
  | map(.value + {rank: (.key + 1)}) as $all
  | {teamCount: ($all | length), average: ([$all[].xp | numbers] | if length == 0 then null else add / length end | r),
     top: ([$all[0:12][], ($all[] | select(.teamNumber as $t | $n | index($t)))] | unique_by(.teamNumber) | sort_by(.rank) | map(map_values(r)))}'
filter_matches='($numbers) as $n
  | [.matches[]? | select(.bye != true) | select((.teams // {}) | keys | any(. as $k | $n | map(tostring) | index($k)))
     | {key, unplayed: (.unplayed // false),
        pred: (.pred // {} | {winProb, redScore, blueScore, redRp1, redRp2, redRp3, blueRp1, blueRp2, blueRp3} | map_values(r)),
        teams: ((.teams // {}) | map_values(.xpPre | r))}]'
filter_district='($numbers) as $n
  | {source, capacity, cmpSlots, cmpCutline, pools: [.pools[]? | {name, capacity, autos, seatsByPoints, cutline}], teamCount: (.teams | length),
     ourTeams: [.teams[]? | select(.teamNumber as $t | $n | index($t))
       | {teamNumber, rank, total, pCmp, pDcmp, q10, q50, q90, mean, cmpStatus, dcmpStatus}]}'

# The events first, because they matter most on the days of an event
for index in $(jq -r 'keys[]' "$work/events.json"); do
  event=$(jq -r ".[$index].key" "$work/events.json")
  get "sim-$event" "/v1/events/$event/sim" "$round $filter_sim"
  get "matches-$event" "/v1/events/$event/matches" "$round $filter_matches"
  get "field-$event" "/v1/events/$event/teams" "$round $filter_field"
done
get "district-$district" "/v1/districts/$district/$year/teams" "$round $filter_district"
for number in $(jq -r '.[]' "$work/numbers.json"); do
  get "team-$number" "/v1/teams/$number/years/$year" "$round $filter_team"
  get "history-$number" "/v1/teams/$number/years/$year/events" "$round $filter_history"
done

finish_wait() {
  # $1 is the state word and $2 the seconds to wait before the timer asks again
  jq -n --argjson at "$now" --arg fp "$fingerprint" --argjson until "$((now + $2))" --arg reason "$3" --argjson gap "$gap" \
    '{lastRunAt: $at, fingerprint: $fp, notBefore: $until, waitReason: $reason, gap: $gap}' > "$state"
}

case $stopped in
  refused)
    finish_wait bad-key 21600 "the key was refused"
    echo "Match13 did not accept the key. Check MATCH13_API_KEY in the Keys section of Settings of the control page." >&2
    write_status bad-key 0
    exit 0
    ;;
esac

# A run that read nothing at all leaves the file as it was
read_any=$(wc -l < "$work/read.txt" | tr -d ' ')
state_word=ok
case $stopped in
  limit) state_word=limit ;;
  down|network) state_word=down ;;
esac

if [ "$state_word" != ok ] && [ "$read_any" = 0 ]; then
  seconds=3600
  if [ "$state_word" = limit ]; then seconds=$((retry_after + 5)); fi
  finish_wait "$state_word" "$seconds" "Match13 could not be read"
  echo "Match13 could not be read this time ($state_word). The next run tries again."
  write_status "$state_word" 0
  exit 0
fi

# One file for the screen
sections="$folder/sections"
read_section() {
  if [ -f "$sections/$1.json" ]; then cat "$sections/$1.json"; else echo null; fi
}

now_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo '{}' > "$work/teams.json"
for number in $(jq -r '.[]' "$work/numbers.json"); do
  jq --arg n "$number" --slurpfile year <(read_section "team-$number") --slurpfile history <(read_section "history-$number") \
    '.[$n] = (($year[0] // {}) + {history: ($history[0] // [])})' "$work/teams.json" > "$work/teams.new"
  mv -f "$work/teams.new" "$work/teams.json"
  if [ "$(read_section "team-$number")" = null ]; then
    echo "Match13 has no rating for team $number this season." >> "$work/notes.txt"
  fi
done

echo '{}' > "$work/events-out.json"
for index in $(jq -r 'keys[]' "$work/events.json"); do
  event=$(jq -r ".[$index].key" "$work/events.json")
  notes='[]'
  [ "$(read_section "sim-$event")" != null ] || notes=$(printf '%s' "$notes" | jq --arg text "Match13 has not simulated $event yet." '. + [$text]')
  [ "$(read_section "field-$event")" != null ] || notes=$(printf '%s' "$notes" | jq --arg text "Match13 has no ratings for the teams of $event yet." '. + [$text]')
  jq --arg key "$event" --argjson notes "$notes" --slurpfile sim <(read_section "sim-$event") --slurpfile field <(read_section "field-$event") --slurpfile matches <(read_section "matches-$event") \
    '.[$key] = {sim: $sim[0], field: $field[0], matches: ($matches[0] // []), notes: $notes}' "$work/events-out.json" > "$work/events-out.new"
  mv -f "$work/events-out.new" "$work/events-out.json"
done

district_note='[]'
[ "$(read_section "district-$district")" != null ] || district_note='["Match13 has no standings for the district yet."]'

jq -n --arg at "$now_iso" --argjson season "$year" --arg district "$district" --argjson ours "$(cat "$work/ours.json")" \
  --slurpfile teams "$work/teams.json" --slurpfile events "$work/events-out.json" --slurpfile standings <(read_section "district-$district") \
  --argjson districtNote "$district_note" '{generatedAt: $at, season: $season, ours: $ours, teams: $teams[0], events: $events[0],
    district: (($standings[0] // {ourTeams: []}) + {code: $district, notes: $districtNote})}' > "$work/match13.json"

size=$(wc -c < "$work/match13.json" | tr -d ' ')
if [ "$size" -gt 200000 ]; then
  echo "The Match13 file came out at $size bytes, which is too big, so it was not written." >&2
  exit 1
fi
mv -f "$work/match13.json" "$data/match13.json.new"
mv -f "$data/match13.json.new" "$data/match13.json"

count=$(jq '.teams | length' "$data/match13.json")
case $stopped in
  limit) finish_wait limit "$((retry_after + 5))" "Match13 said there were too many requests" ;;
  down|network) finish_wait down 3600 "Match13 did not answer" ;;
  *) jq -n --argjson at "$now" --arg fp "$fingerprint" --argjson gap "$gap" '{lastRunAt: $at, fingerprint: $fp, notBefore: 0, gap: $gap}' > "$state" ;;
esac
if [ -s "$work/errors.txt" ]; then cat "$work/errors.txt" >&2; fi
echo "match13: $requests requests, $count teams, state $state_word"
write_status "$state_word" "$count"
