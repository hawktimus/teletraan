#!/bin/sh
# Reads the public FRC data of each team in Sanity from The Blue Alliance (the
# read API, version 3) and from Statbotics, and writes what the screen shows into
# the document frc-status in Sanity: each team's events, next match, last
# results, rank, alliance, awards, rating and district points. The screen reads
# that document with the rest of the content. Needs curl and jq
# (docs/rebuilding-the-mini.md, step 17, and docs/frc-feed.md).
#
#   frc-sync.sh           one run, which the timer starts every 5 minutes. A run
#                         does its work about once an hour, and every 5 minutes
#                         while a team has an event on
#   frc-sync.sh --now     one run now, whatever the time
#   frc-sync.sh --check   asks The Blue Alliance one question to see that the key
#                         works, and writes nothing
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
repo=$(dirname "$deploy")
config="$repo/dashboard/config.js"
env_file="$deploy/local.env"

# Everything that depends on how the two services write their answers is in this
# block: the addresses, and where each value sits in an answer. If a service
# changes something, correct the line here and nowhere else. They were written
# from the public documentation of both services and have not been tried against
# the live services (docs/frc-feed.md, "If an answer looks different").
#
# An address has {team} (frc3229), {number} (3229), {year}, {event}
# (2027ncwak), {match} (2027ncwak_qm12) or {district} (2027nc) in it.
tba_host='https://www.thebluealliance.com/api/v3'
tba_status='/status'
tba_team_events='/team/{team}/events/{year}/simple'
tba_team_matches='/team/{team}/event/{event}/matches'
tba_rankings='/event/{event}/rankings'
tba_alliances='/event/{event}/alliances'
tba_event_teams='/event/{event}/teams/simple'
tba_awards='/team/{team}/awards/{year}'
tba_district_events='/district/{district}/events/simple'
tba_district_rankings='/district/{district}/rankings'
statbotics_host='https://api.statbotics.io/v3'
statbotics_team_year='/team_year/{number}/{year}'
statbotics_match='/match/{match}'

# The district whose events and points are read: the year and then this code
district_code=nc

# How many teams the district championship takes. Leave it empty until it is
# known. The cutoff is then the points of the team at that place in the list.
district_slots=

# Where each value sits in an answer, as jq functions. Each one is given one item
# of the list it belongs to: an event, a match, a ranking and so on.
paths='
def event_key: .key;
def event_name: .name;
def event_city: .city;
def event_start: .start_date;
def event_end: .end_date;
def event_is_championship: (.event_type == 2 or .event_type == 5);
def match_key: .key;
def match_level: .comp_level;
def match_set: .set_number;
def match_number: .match_number;
def match_time: (.time // .predicted_time);
def match_red_teams: .alliances.red.team_keys;
def match_blue_teams: .alliances.blue.team_keys;
def match_red_score: .alliances.red.score;
def match_blue_score: .alliances.blue.score;
def match_winner: .winning_alliance;
def ranking_list: .rankings;
def ranking_team: .team_key;
def ranking_rank: .rank;
def ranking_played: .matches_played;
def ranking_wins: .record.wins;
def ranking_losses: .record.losses;
def ranking_ties: .record.ties;
def ranking_points: .sort_orders[0];
def alliance_picks: .picks;
def team_key: .key;
def team_nickname: .nickname;
def award_name: .name;
def award_event: .event_key;
def district_ranking_team: .team_key;
def district_rank: .rank;
def district_points_total: .point_total;
def statbotics_epa: .epa.total_points.mean;
def statbotics_red_win: .pred.red_win_prob;
'

# At most this many requests to the two services in one run. A run that stops
# here carries on at the next one.
max_requests=60

# Seconds. The timer starts the script every 5 minutes. With no event on, a run
# is made when the last one was this long ago, and during an event when the last
# was the shorter time ago. The status is written again after refresh_gap even if
# nothing changed, so that the time in it shows the Mini is still looking.
quiet_gap=$((50 * 60))
event_gap=$((4 * 60))
refresh_gap=$((45 * 60))

# The next matches that get a win chance from Statbotics, the results and the
# daily snapshots kept in the status, and the awards listed
odds_matches=3
results_kept=8
snapshots_kept=120
awards_kept=20

# The time zone of the screen is the one on the Look page. This is used until
# Sanity has been asked.
default_zone=America/New_York

# What an ETag looks like, so nothing else is sent back to the service
etag_pattern='^(W/)?"[A-Za-z0-9._:+/=-]{1,100}"$'

# The value of a NAME=value line in local.env, without its quotes. Only the
# name asked for is read, because the other lines hold secrets.
setting() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

# The quoted value of "name: 'value'," in dashboard/config.js. The project
# ID, the dataset and the API version are kept there and nowhere else.
config_value() {
  [ -f "$config" ] || return 0
  sed -n "s/^[[:space:]]*$1:[[:space:]]*'\([^']*\)'.*/\1/p" "$config" | head -n 1
}

# curl's exit code in plain words. curl's own messages can include the address,
# so they are not shown.
explain() {
  case $1 in
    6) echo "could not find the server, so the network may be down" ;;
    7) echo "could not connect to the server" ;;
    28) echo "the server took too long to answer" ;;
    35|51|58|59|60) echo "the secure connection failed" ;;
    63) echo "the answer is too big" ;;
    *) echo "curl failed with exit code $1" ;;
  esac
}

service_name() {
  if [ "$1" = tba ]; then
    echo "The Blue Alliance"
  else
    echo "Statbotics"
  fi
}

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

tba_key=$(setting TBA_AUTH_KEY)
write_token=$(setting SANITY_WRITE_TOKEN)

# A value that is missing, or still the placeholder from local.example.env that
# starts with [, means the feed is not set up yet. The timer's run ends without an
# error then, so the service does not show as failed. A run by hand fails.
not_set_up() {
  echo "$1 is not in local.env yet, so nothing was read. See docs/frc-feed.md."
  if [ "$mode" = timer ]; then
    exit 0
  fi
  exit 1
}

# A key is letters, digits and a few signs. Anything else would not be one, and
# must not be put in a curl setting.
looks_like_key() {
  if ! printf '%s' "$2" | grep -Eq '^[A-Za-z0-9_.-]+$'; then
    echo "$1 in local.env does not look like a key. Paste it again, with nothing else on the line." >&2
    exit 1
  fi
}

case $tba_key in
  ''|'['*) not_set_up TBA_AUTH_KEY ;;
esac
looks_like_key TBA_AUTH_KEY "$tba_key"

if [ "$mode" = check ]; then
  folder=$(mktemp -d "${TMPDIR:-/tmp}/frc-check.XXXXXX")
  trap 'rm -rf "$folder"' EXIT
  failed=0

  status=0
  code=$(printf 'header = "X-TBA-Auth-Key: %s"\n' "$tba_key" |
    curl --disable --silent --max-time 30 --connect-timeout 10 --proto '=https' \
      --output "$folder/answer.json" --write-out '%{http_code}' --config - "$tba_host$tba_status" 2> /dev/null) || status=$?

  if [ "$status" -ne 0 ]; then
    echo "FAIL  The Blue Alliance did not answer, $(explain "$status")"
    failed=1
  elif [ "$code" = 200 ]; then
    echo "OK    The Blue Alliance accepts the key (season $(jq -r '.current_season | numbers' "$folder/answer.json" 2> /dev/null))"
  elif [ "$code" = 401 ] || [ "$code" = 403 ]; then
    echo "FAIL  The Blue Alliance refused the key. Check TBA_AUTH_KEY in local.env."
    failed=1
  else
    echo "FAIL  The Blue Alliance answered with code $code"
    failed=1
  fi

  case $write_token in
    ''|'['*)
      echo "FAIL  SANITY_WRITE_TOKEN is not in local.env, so nothing can be written to Sanity"
      failed=1
      ;;
    *) echo "OK    SANITY_WRITE_TOKEN is in local.env" ;;
  esac

  exit "$failed"
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
  echo "The data folder $data does not exist. See docs/rebuilding-the-mini.md." >&2
  exit 1
fi

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)

if ! printf '%s' "$project" | grep -Eq '^[a-z0-9]+$' ||
  ! printf '%s' "$dataset" | grep -Eq '^[A-Za-z0-9_-]+$' ||
  ! printf '%s' "$version" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "Could not read the project ID, dataset and API version from dashboard/config.js." >&2
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
    echo "Could not read the clock." >&2
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
  echo "Could not get the teams from Sanity. Nothing was changed." >&2
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

: > "$work/notes.txt"
: > "$work/errors.txt"
: > "$work/seen.txt"

requests=0
failures=0
stopped=""
statbotics_off=no
outcome=stopped

note() {
  printf '%s\n' "$1" >> "$work/notes.txt"
}

problem() {
  printf '%s\n' "$1" >> "$work/errors.txt"
}

# The values that go into an address have all been checked, so none holds a /
# or an &
team_key=""
team_number=""
event_key=""
match_key=""
district_key=""

fill() {
  printf '%s' "$1" | sed -e "s/{team}/$team_key/g" -e "s/{number}/$team_number/g" -e "s/{year}/$year/g" \
    -e "s/{event}/$event_key/g" -e "s/{match}/$match_key/g" -e "s/{district}/$district_key/g"
}

# Keeps or forgets the ETag of answer $1, from the headers in file $2
keep_etag() {
  etag=$(sed -n 's/^[Ee][Tt][Aa][Gg]: *//p' "$2" | tr -d '\r' | tail -n 1)
  if printf '%s' "$etag" | grep -Eq "$etag_pattern"; then
    jq --arg name "$1" --arg etag "$etag" '.[$name] = $etag' "$etags" > "$etags.new" && mv -f "$etags.new" "$etags"
  else
    forget_etag "$1"
  fi
}

forget_etag() {
  jq --arg name "$1" 'del(.[$name])' "$etags" > "$etags.new" && mv -f "$etags.new" "$etags"
}

# The secret part of a request: The Blue Alliance wants the key in a header.
# curl reads it on standard input, so it never shows in the process list.
secret_settings() {
  if [ "$1" = tba ]; then
    printf 'header = "X-TBA-Auth-Key: %s"\n' "$tba_key"
  fi
}

# Asks one service for one address, once in a cycle. $1 is tba or statbotics, $2
# is the name the answer is kept under in the cache folder and $3 is the address
# after the host. Leaves one word in $outcome: changed, same (as last time, or
# already read in this cycle), missing (the service has nothing there), failed,
# or stopped (nothing was asked).
get() {
  service=$1
  name=$2
  where=$3
  file="$cache/$name.json"
  outcome=stopped
  printf '%s\n' "$name" >> "$work/seen.txt"

  if grep -Fxq -- "$name" "$cycle"; then
    outcome=same
    return 0
  fi
  if [ -n "$stopped" ]; then
    return 0
  fi
  if [ "$service" = statbotics ] && [ "$statbotics_off" = yes ]; then
    return 0
  fi
  if [ "$requests" -ge "$max_requests" ]; then
    stopped=capped
    return 0
  fi
  requests=$((requests + 1))

  if [ "$service" = tba ]; then
    address="$tba_host$where"
  else
    address="$statbotics_host$where"
  fi

  # An ETag is only sent with the answer it belongs to still on disk
  sent=$(jq -r --arg name "$name" '.[$name] // empty' "$etags" 2> /dev/null || true)
  if [ ! -f "$file" ] || ! printf '%s' "$sent" | grep -Eq "$etag_pattern"; then
    sent=""
  fi
  set --
  if [ -n "$sent" ]; then
    set -- --header "If-None-Match: $sent"
  fi

  curl_status=0
  answer_code=$(secret_settings "$service" |
    curl --disable --silent --max-time 30 --connect-timeout 10 --max-filesize 5000000 \
      --proto '=https' --dump-header "$work/headers.txt" --output "$work/answer.json" \
      --write-out '%{http_code}' "$@" --config - "$address" 2> /dev/null) || curl_status=$?

  if [ "$curl_status" -ne 0 ]; then
    outcome=failed
    problem "$(service_name "$service") did not answer, $(explain "$curl_status")."
    failures=$((failures + 1))
    if [ "$failures" -ge 3 ]; then
      stopped=network
    fi
    return 0
  fi
  failures=0

  case $answer_code in
    [0-9][0-9][0-9]) ;;
    *) answer_code=000 ;;
  esac

  case $answer_code in
    200)
      if ! jq empty "$work/answer.json" > /dev/null 2>&1; then
        outcome=failed
        problem "$(service_name "$service") sent an answer that is not data ($name)."
        return 0
      fi
      if [ -f "$file" ] && cmp -s "$work/answer.json" "$file"; then
        outcome=same
      else
        mv -f "$work/answer.json" "$file"
        outcome=changed
      fi
      keep_etag "$name" "$work/headers.txt"
      printf '%s\n' "$name" >> "$cycle"
      ;;
    304)
      if [ -f "$file" ]; then
        outcome=same
        printf '%s\n' "$name" >> "$cycle"
      else
        forget_etag "$name"
        outcome=failed
        problem "$(service_name "$service") said nothing had changed, but the earlier answer is gone ($name)."
      fi
      ;;
    404)
      rm -f "$file"
      forget_etag "$name"
      outcome=missing
      printf '%s\n' "$name" >> "$cycle"
      ;;
    401|403)
      outcome=failed
      if [ "$service" = tba ]; then
        stopped=refused
        problem "The Blue Alliance refused the key. Check TBA_AUTH_KEY in local.env."
      else
        statbotics_off=yes
        note "Statbotics refused the request, so ratings and win chances were skipped."
      fi
      ;;
    429)
      outcome=failed
      stopped=limit
      problem "$(service_name "$service") says there were too many requests, so this run stopped. It goes on at the next run."
      ;;
    *)
      outcome=failed
      problem "$(service_name "$service") answered with code $answer_code ($name)."
      ;;
  esac
}

# The helpers the filters share. They are logic and not API paths, so they are
# not in the block at the top.
helpers='
def level_rank: if type == "string" then (({"qm": 0, "ef": 1, "qf": 2, "sf": 3, "f": 4})[.] // 5) else 5 end;
def match_order: [(match_level | level_rank), (match_set // 0), (match_number // 0)];
def played: ((match_red_score // -1) >= 0) and ((match_blue_score // -1) >= 0);
'

is_event_key() {
  printf '%s' "$1" | grep -Eq '^[0-9]{4}[a-z0-9]{1,20}$'
}

is_match_key() {
  printf '%s' "$1" | grep -Eq '^[0-9]{4}[a-z0-9]{1,20}_[a-z0-9]{1,12}$'
}

jq -r '.[] | "\(.code) \(.number)"' "$work/teams.json" > "$work/team-list.txt"
echo "frc: reading $(jq length "$work/teams.json") team(s) for the $year season"

while read -r code number; do
  team_key="frc$number"
  team_number=$number
  events_file="$cache/tba-events-$year-$team_key.json"

  get tba "tba-events-$year-$team_key" "$(fill "$tba_team_events")"

  # A team that The Blue Alliance does not know is left out without an error.
  # When the answer could not be had and there is nothing from before,
  # the team stays in the status with nothing in it.
  if [ ! -f "$events_file" ]; then
    if [ "$outcome" = missing ] || [ "$outcome" = same ]; then
      echo "team $code: not found on The Blue Alliance, skipped"
      jq -c --arg code "$code" 'map(select(.code != $code))' "$work/teams.json" > "$work/teams.new"
      mv -f "$work/teams.new" "$work/teams.json"
    fi
    continue
  fi

  # The events that are not over, earliest first. jq has checked the keys. They
  # are checked again because they become part of an address and a file name.
  jq -r --arg today "$today" "$paths"'
    [.[]? | objects
      | select((event_key | type) == "string" and (event_key | test("\\A[0-9]{4}[a-z0-9]{1,20}\\z")))
      | select((event_end | type) == "string" and event_end >= $today)]
    | sort_by(event_start)[] | event_key' "$events_file" > "$work/open.txt"

  echo "team $code: $(jq 'if type == "array" then length else 0 end' "$events_file") event(s) this season, $(grep -c . "$work/open.txt" || true) not over"

  while read -r event_key; do
    is_event_key "$event_key" || continue
    get tba "tba-matches-$team_key-$event_key" "$(fill "$tba_team_matches")"
    get tba "tba-rankings-$event_key" "$(fill "$tba_rankings")"
    get tba "tba-alliances-$event_key" "$(fill "$tba_alliances")"
    get tba "tba-teams-$event_key" "$(fill "$tba_event_teams")"
  done < "$work/open.txt"

  get tba "tba-awards-$year-$team_key" "$(fill "$tba_awards")"
  get statbotics "statbotics-team-$year-$team_number" "$(fill "$statbotics_team_year")"

  # The win chance of the next few matches of the event that is on or next
  focus=$(head -n 1 "$work/open.txt")
  if is_event_key "$focus" && [ -f "$cache/tba-matches-$team_key-$focus.json" ]; then
    jq -r --argjson count "$odds_matches" "$paths$helpers"'
      [.[]? | objects
        | select((match_key | type) == "string" and (match_key | test("\\A[0-9]{4}[a-z0-9]{1,20}_[a-z0-9]{1,12}\\z")))
        | select(played | not)]
      | sort_by(match_order)[0:$count][] | match_key' "$cache/tba-matches-$team_key-$focus.json" > "$work/upcoming.txt"

    while read -r match_key; do
      is_match_key "$match_key" || continue
      get statbotics "statbotics-match-$match_key" "$(fill "$statbotics_match")"
    done < "$work/upcoming.txt"

    # The rating of the other teams in the next match, to show beside each of them. The team being
    # read has its own already.
    next_match=$(head -n 1 "$work/upcoming.txt")
    if is_match_key "$next_match"; then
      jq -r --arg match "$next_match" --arg own "$team_key" "$paths"'
        [.[]? | objects | select(match_key == $match)
          | ((match_red_teams // []) + (match_blue_teams // []))[]? | strings
          | select(test("\\Afrc[1-9][0-9]{0,4}\\z")) | select(. != $own) | ltrimstr("frc")]
        | unique[]' "$cache/tba-matches-$team_key-$focus.json" > "$work/others.txt"

      own_number=$team_number
      while read -r team_number; do
        get statbotics "statbotics-team-$year-$team_number" "$(fill "$statbotics_team_year")"
      done < "$work/others.txt"
      team_number=$own_number
    fi
  fi
done < "$work/team-list.txt"

# One list of district events and one of district points, for every team
if [ "$(jq length "$work/teams.json")" -gt 0 ]; then
  district_key="$year$district_code"
  get tba "tba-district-events-$year" "$(fill "$tba_district_events")"
  get tba "tba-district-rankings-$year" "$(fill "$tba_district_rankings")"
fi

case $stopped in
  capped) note "This run stopped after $max_requests requests and goes on at the next run." ;;
esac

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

# The document. It has team numbers, nicknames, scores and ranks, and no people:
# the names of award winners and the long team names of the service are left out.
build='
def listing: if type == "array" then map(select(type == "object")) else [] end;
def numeric: if type == "number" then . else null end;
def lines($text): [$text | split("\n")[] | select(. != "")];
def stored($name): $bundle[0][$name];
def keyed:
  if type == "array" then
    to_entries | map(.value |= keyed | if (.value | type) == "object" then .value + {_key: (.key | tostring)} else .value end)
  elif type == "object" then map_values(keyed)
  else . end;
def iso: if type == "number" then (floor | todate) else null end;
def number_of: ltrimstr("frc") | tonumber? // null;

def match_label:
  (match_number | tostring) as $n
  | if match_level == "qm" then "Q" + $n
    elif match_level == "f" then "F" + $n
    else ((match_level // "") | ascii_upcase) + ((match_set // 0) | tostring) + "-" + $n end;

def epa_of($number):
  stored("statbotics-team-" + $year + "-" + $number)
  | if type == "object" then statbotics_epa | numeric else null end
  | if . == null then null else ((. * 100 | round) / 100) end;

def nickname($roster; $key): [$roster | listing[] | select(team_key == $key) | team_nickname | strings][0];
def person($roster; $key): {number: ($key | number_of), nickname: nickname($roster; $key), epa: epa_of($key | ltrimstr("frc"))};
def people($roster; $keys): [($keys // [])[] | strings | person($roster; .)];

def on_team($keys; $key): ($keys // []) | any(.[]; . == $key);
def color_of($key):
  if on_team(match_red_teams; $key) then "red"
  elif on_team(match_blue_teams; $key) then "blue"
  else null end;

def result_of($key):
  color_of($key) as $color
  | (match_winner // "") as $winner
  | {
      match: match_key,
      label: match_label,
      alliance: $color,
      scoreFor: (if $color == "red" then match_red_score elif $color == "blue" then match_blue_score else null end),
      scoreAgainst: (if $color == "red" then match_blue_score elif $color == "blue" then match_red_score else null end),
      won: (if $color == null or $winner == "" then null else $winner == $color end)
    };

def next_of($key; $roster):
  color_of($key) as $color
  | (stored("statbotics-match-" + match_key) | if type == "object" then statbotics_red_win | numeric else null end) as $odds
  | {
      match: match_key,
      label: match_label,
      level: match_level,
      number: match_number,
      time: (match_time | iso),
      alliance: $color,
      red: people($roster; match_red_teams),
      blue: people($roster; match_blue_teams),
      redWinProbability: $odds
    };

def rankings_of($event):
  stored("tba-rankings-" + ($event | event_key)) | if type == "object" then ranking_list | listing else [] end;

def ranking_fields($event; $key):
  rankings_of($event) as $list
  | ([$list[] | select(ranking_team == $key)][0]) as $row
  | if $row == null then null
    else {
      rank: ($row | ranking_rank | numeric),
      teamsRanked: ($list | length),
      matchesPlayed: ($row | ranking_played | numeric),
      record: ($row | {wins: ranking_wins, losses: ranking_losses, ties: ranking_ties}),
      rankingPoints: ($row | ranking_points | numeric)
    } end;

def empty_ranking: {rank: null, teamsRanked: null, matchesPlayed: null, record: null, rankingPoints: null};

# The rating of the team during an event: read while the event is on, kept after it, and none before it
def event_epa($event; $key; $old):
  if ($event | event_start) > $today then null
  elif ($event | event_end) >= $today then epa_of($key | ltrimstr("frc"))
  else (($old.epa // null) | numeric) end;

# The rank of an event that is over is no longer asked for. What was written
# while it was on stays, and is taken from the status written last time.
def event_entry($event; $key; $old):
  (if ($event | event_end) >= $today then ranking_fields($event; $key) else null end) as $fresh
  | {
      key: ($event | event_key),
      name: ($event | event_name),
      city: ($event | event_city),
      startDate: ($event | event_start),
      endDate: ($event | event_end),
      epa: event_epa($event; $key; $old)
    } + ($fresh // (if $old == null then empty_ranking else ($old | {rank, teamsRanked, matchesPlayed, record, rankingPoints}) end));

def alliance_of($event; $key; $roster):
  stored("tba-alliances-" + ($event | event_key)) | listing as $list
  | if ($list | length) == 0 then null
    else ([range(0; $list | length) | select(($list[.] | (alliance_picks // [])) | any(.[]; . == $key))][0]) as $at
      | {
          event: ($event | event_key),
          number: (if $at == null then null else $at + 1 end),
          picks: (if $at == null then [] else people($roster; $list[$at] | alliance_picks) end)
        }
    end;

def awards_of($key):
  [stored("tba-awards-" + $year + "-" + $key) | listing[] | {name: award_name, event: award_event}] | .[0:$awards_kept];

def district_rows: stored("tba-district-rankings-" + $year) | listing;

def district_of($key):
  district_rows as $rows
  | ([$rows[] | select(district_ranking_team == $key)][0]) as $row
  | if $row == null then null
    else {
      total: ($row | district_points_total | numeric),
      rank: ($row | district_rank | numeric),
      cutoff: (if $slots == null then null else ($rows | map(district_points_total // 0) | sort | reverse | .[$slots - 1]) end)
    } end;

def district_events:
  [stored("tba-district-events-" + $year) | listing | sort_by(event_start)[]
    | {key: event_key, name: event_name, city: event_city, startDate: event_start, endDate: event_end, championship: event_is_championship}]
  | .[0:30];

def snapshot_list($old):
  [$old | listing[]
    | select((.date | type) == "string" and (.date | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")))
    | {date, epa: (.epa | numeric), districtPoints: (.districtPoints | numeric)}];

# One snapshot a day, which the last run of the day keeps
def with_today($snapshots; $epa; $points):
  if $epa == null and $points == null then $snapshots
  else (($snapshots | map(select(.date != $today))) + [{date: $today, epa: $epa, districtPoints: $points}]) | sort_by(.date) | .[(0 - $snapshots_kept):]
  end;

($answer[0].result.previous | if type == "object" then . else {} end) as $previous
| ($previous.teams | listing) as $previous_teams

# When the season changes, the events of the old one are kept for the glance back
| def last_season($old):
  ($previous.season | numeric) as $was
  | ($old.events | listing) as $events
  | if $was != null and $was != ($year | tonumber) and ($events | length) > 0
    then {season: $was, events: $events}
    else ($old.lastSeason | if type == "object" then . else null end) end;

def team_doc($team):
  $team.key as $key
  | ([$previous_teams[] | select(.team == $team.code)][0] // {}) as $old
  | (stored("tba-events-" + $year + "-" + $key) | listing | map(select((event_key | type) == "string")) | sort_by(event_start)) as $all
  | ([$all[] | select((event_end // "") >= $today)][0]) as $focus
  | ($focus | if . == null then null else event_key end) as $focus_key
  | (if $focus == null then [] else stored("tba-matches-" + $key + "-" + $focus_key) | listing | map(select((match_key | type) == "string")) | sort_by(match_order) end) as $matches
  | (if $focus == null then null else stored("tba-teams-" + $focus_key) end) as $roster
  | ($matches | map(select(played))) as $done
  | ($matches | map(select(played | not))) as $to_play
  | [$all[] | . as $event | event_entry($event; $key; ([$old.events | listing[] | select(.key == ($event | event_key))][0]))] as $events
  | ($events | map(select(.key == $focus_key)) | .[0]) as $focus_event
  | {
      team: $team.code,
      number: ($team.number | tonumber),
      key: $key,
      events: $events,
      focusEvent: $focus_key,
      nextMatch: ($to_play[0] | if . == null then null else next_of($key; $roster) end),
      results: ($done | .[(0 - $results_kept):] | map(result_of($key))),
      ranking: (if $focus_event == null or $focus_event.rank == null then null
        else {event: $focus_key} + ($focus_event | {rank, teamsRanked, matchesPlayed, record, rankingPoints}) end),
      alliance: (if $focus == null then null else alliance_of($focus; $key; $roster) end),
      awards: awards_of($key),
      epa: epa_of($team.number),
      districtPoints: district_of($key)
    } as $doc
  | $doc + {
      snapshots: with_today(snapshot_list($old.snapshots); $doc.epa; ($doc.districtPoints | if . == null then null else .total end)),
      lastSeason: last_season($old)
    };

{
    _id: "frc-status",
    _type: "frcStatus",
    season: ($year | tonumber),
    lastSyncAt: $now,
    lastError: (lines($errors) | unique | if length == 0 then null else (.[0:3] | join("; ") | .[0:300]) end),
    notes: lines($notes),
    districtEvents: district_events,
    teams: [$teams[0][] | team_doc(.)]
  }
| keyed
'

if ! jq -n \
  --slurpfile bundle "$work/bundle.json" --slurpfile teams "$work/teams.json" --slurpfile answer "$work/sanity.json" \
  --arg year "$year" --arg today "$today" --arg now "$now_iso" --argjson slots "$slots" \
  --argjson results_kept "$results_kept" --argjson snapshots_kept "$snapshots_kept" --argjson awards_kept "$awards_kept" \
  --rawfile notes "$work/notes.txt" --rawfile errors "$work/errors.txt" \
  "$paths$helpers$build" > "$work/status.json"; then
  echo "Could not build the status from what was read." >&2
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

jq -n --arg zone "$zone" --argjson run "$now" --argjson wrote "$last_write" --argjson unfinished "$unfinished" \
  --slurpfile windows "$work/windows.json" \
  '{zone: $zone, lastRunAt: $run, lastWriteAt: $wrote, unfinished: $unfinished, windows: $windows[0]}' > "$state.new"
mv -f "$state.new" "$state"

echo "frc: $requests request(s) to the two services"

# The time of this run goes to status-mini, unless the services turned the run
# away or the status could not be written. status-write.sh never stops this script.
if [ "$failed" -eq 0 ] && [ "$stopped" != refused ] && [ "$stopped" != network ]; then
  "$deploy/scripts/status-write.sh" frc || true
fi

# What went wrong is also in the status, for Studio. Here it is for the journal.
if [ -s "$work/errors.txt" ]; then
  while read -r line; do
    echo "frc: $line" >&2
  done < "$work/errors.txt"
  failed=1
fi
exit "$failed"
