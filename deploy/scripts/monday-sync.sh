#!/bin/sh
# Reads the two Monday boards that the Monday tab of Dashboard Settings names (the task
# board and the milestones board) and writes their items into Sanity: a task for each
# parent item (published documents with the ids task-monday-<item number>) and a
# milestone for each milestone (milestone-monday-<item number>). It also writes the
# document monday-status, which the Monday tab uses to offer the boards and their columns
# and to say what was read. Needs curl and jq (docs/rebuilding-the-mini.md, step 18, and
# docs/monday.md).
#
#   monday-sync.sh           one run, which the timer starts every 5 minutes. The run reads
#                            Monday only when the last read is older than "How often" on the
#                            Monday tab, and otherwise ends without a word
#   monday-sync.sh --check   asks Monday who the token belongs to, and writes nothing
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
repo=$(dirname "$deploy")
config="$repo/dashboard/config.js"
env_file="$deploy/local.env"

# Everything that depends on how Monday writes its answers is in this block: the
# address, the version, the questions, and where each value sits in an answer. If
# Monday changes something, correct the line here and nowhere else. The questions use
# typed fragments, because a plain question for the values of columns gave empty values for status,
# date and relation columns (docs/monday.md, "If an answer looks different").
monday_address='https://api.monday.com/v2'
monday_version='2025-07'

# Who the token belongs to
monday_query_me='query { me { name } }'

# Who the token belongs to, and the boards it can see with their columns. It is asked for on the
# first read of a day, and when the Mini has no list yet, so the pickers of the Monday tab have it.
monday_query_boards='query { me { name } boards(limit: 100, state: active, order_by: used_at) { id name type items_count columns { id title type } } }'

# The first page of the parent items of one board, and the pages after it. $columns lists the
# columns that are read. Subitems are not asked for, and an item with a parent is left out.
monday_query_items='query ($board: [ID!], $columns: [String!], $limit: Int) { boards(ids: $board) { name items_page(limit: $limit) { cursor items { id name parent_item { id } column_values(ids: $columns) { id type text ... on StatusValue { label index } ... on BoardRelationValue { linked_item_ids } ... on DateValue { date } ... on TimelineValue { from to } ... on PeopleValue { persons_and_teams { id } } } } } } }'
monday_query_more='query ($cursor: String!, $columns: [String!], $limit: Int) { next_items_page(limit: $limit, cursor: $cursor) { cursor items { id name parent_item { id } column_values(ids: $columns) { id type text ... on StatusValue { label index } ... on BoardRelationValue { linked_item_ids } ... on DateValue { date } ... on TimelineValue { from to } ... on PeopleValue { persons_and_teams { id } } } } } }'

# Where each value sits in an answer, as jq functions. Each one is given the part
# of the answer it belongs to: the answer, a board, a column, a page, an item or
# one value of an item.
paths='
def me_name: (.data.me.name? // null);
def board_list: .data.boards;
def board_id: .id;
def board_name: .name;
def board_items: .items_count;
def board_columns: .columns;
def board_is_offered: ((.type // "board") == "board");
def column_id: .id;
def column_title: .title;
def column_type: .type;
def first_page: .data.boards[0].items_page;
def first_board_name: (.data.boards[0].name? // null);
def more_page: .data.next_items_page;
def page_cursor: .cursor;
def page_items: .items;
def item_id: .id;
def item_name: .name;
def item_parent: (.parent_item.id? // null);
def item_values: .column_values;
def value_column: .id;
def value_text: .text;
def value_label: .label?;
def value_index: .index?;
def value_linked: .linked_item_ids?;
def value_date: .date?;
def value_from: .from?;
def value_to: .to?;
def error_messages: [(.errors[]?.message?), .error_message?] | map(strings);
'

# What the Monday tab says when it says nothing: the boards, columns and index tables of the
# rebuilt workspace (docs/monday.md). It is the same data as mondayTaskBoard, mondayMilestoneBoard and
# mondayEveryMinutes in defaultSettings in dashboard/config.js, with a team written as its document id,
# and tools/test-monday-sync.mjs fails if they differ. An index is the contract and a label is not,
# because students rename labels. A department row with no Team lead is matched to the Team lead
# with the same name.
defaults='{
  "every": 30,
  "taskBoard": {
    "boardId": "18435126893",
    "departmentColumn": "color_mm82nvea",
    "statusColumn": "color_mkv6tatz",
    "teamColumn": "color_mm82jgxg",
    "priorityColumn": "color_mm82wfy",
    "showColumn": "color_mm83p12x",
    "assignedColumn": "multiple_person_mm82cqbx",
    "pocColumn": "multiple_person_mm8331h1",
    "timelineColumn": "timerange_mkyp8kx7",
    "hoursColumn": "numeric_mm82pw1a",
    "completedColumn": "date_mm82kn5v",
    "milestoneColumn": "board_relation_mm83phwy",
    "teamLabels": [{"index": 1, "team": "team-prime"}, {"index": 0, "team": "team-nova"}, {"index": 5}],
    "statusIndexes": {"todo": 5, "inProgress": 0, "inReview": 3, "stuck": 2, "done": 1},
    "priorityIndexes": {"high": 2, "medium": 0, "low": 1},
    "hideLabel": "Hide",
    "departmentLabels": [
      {"index": 0, "name": "Electrical"}, {"index": 1, "name": "Build"}, {"index": 2, "name": "Programming"},
      {"index": 3, "name": "Design"}, {"index": 4, "name": "CNC"}, {"index": 5, "name": "Unassigned", "neverShown": true},
      {"index": 6, "name": "Strategy"}, {"index": 7, "name": "Business"}, {"index": 8, "name": "Marketing"}, {"index": 9, "name": "Operations"}
    ]
  },
  "milestoneBoard": {
    "boardId": "18435272887",
    "dateColumn": "date_mm83y6zw",
    "teamColumn": "color_mm83be52",
    "departmentColumn": "color_mm83f77w",
    "statusColumn": "color_mm83ndkf",
    "teamLabels": [{"index": 109, "team": "team-prime"}, {"index": 8, "team": "team-nova"}, {"index": 5}],
    "statusIndexes": {"notStarted": 5, "onTrack": 1, "atRisk": 2, "done": 3},
    "departmentLabels": [
      {"index": 107, "name": "Build"}, {"index": 9, "name": "Electrical"}, {"index": 19, "name": "Programming"},
      {"index": 1, "name": "Design"}, {"index": 11, "name": "CNC"}, {"index": 104, "name": "Strategy"},
      {"index": 0, "name": "Business"}, {"index": 18, "name": "Marketing"}, {"index": 7, "name": "Operations"}, {"index": 5, "name": "All Departments"}
    ]
  }
}'

# A status column that nobody has set reports this index, in every column of both boards
unset_index=5

# The longest title a task can have (studio/schemas/task.js), the longest first
# name (the same file), and the longest name of a milestone (studio/schemas/milestone.js)
title_limit=22
contact_limit=12
milestone_limit=40

# Owners kept for a task, so a long list cannot fill the document
owners_kept=6

# Milestones kept for a task (studio/schemas/task.js)
milestones_kept=50

# Items asked for in one page, and requests to Monday in one run. A run that reaches the
# request limit stops and says so, and the next run starts again at the first board.
page_size=200
max_requests=4

# The reads of Monday in one day (kiosk time zone). Past this the script waits for midnight. The
# free plan allows about 1,000.
daily_limit=900
daily_limit_message='Daily read limit reached; reads resume at midnight.'

# The timer wakes the script every 5 minutes, and a run ends a little after the minute it was
# written, so a read that is this many seconds short of the setting still counts as due
slack_seconds=90

# What monday-status keeps: boards, columns of a board, and daily counts
boards_kept=100
columns_kept=60
snapshots_kept=120

# Rows (a row is a task) sent to Sanity in one request
rows_per_write=100

# The time zone of the screen is the one on the Look page. This is used until
# Sanity has been asked.
default_zone=America/New_York
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
    22) echo "Sanity refused it, so the token may be wrong or may not have Editor access" ;;
    28) echo "the server took too long to answer" ;;
    35|51|58|59|60) echo "the secure connection failed" ;;
    63) echo "the answer is too big" ;;
    *) echo "curl failed with exit code $1" ;;
  esac
}

usage() {
  echo "Usage: $0 [--check]" >&2
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
  *) usage ;;
esac
[ "$#" -le 1 ] || usage

monday_token=$(setting MONDAY_API_TOKEN)
write_token=$(setting SANITY_WRITE_TOKEN)

# A value that is missing, or still the placeholder from local.example.env that
# starts with [, means Monday is not set up yet. The timer's run ends without an
# error then, so the service does not show as failed. A run by hand says so.
not_set_up() {
  echo "$1 is not in local.env yet, so nothing was read. See docs/monday.md."
  exit 0
}

# A token is letters, digits and a few signs. Anything else would not be one, and
# must not be put in a curl setting.
looks_like_key() {
  if ! printf '%s' "$2" | grep -Eq '^[A-Za-z0-9_.-]+$'; then
    echo "$1 in local.env does not look like a token. Paste it again, with nothing else on the line." >&2
    exit 1
  fi
}

# The secret part of a request: Monday wants the token in a header. curl reads it
# on standard input, so it never shows in the process list.
secret_settings() {
  printf 'header = "Authorization: %s"\n' "$monday_token"
}

# The helpers the filters share. They are logic and not places in an answer, so
# they are not in the block at the top. \u0027 is the ' sign, which cannot be
# written inside a string that is in single quotes.
helpers='
def plain: explode | map(if . < 32 or . == 127 then 32 else . end) | implode | gsub(" +"; " ") | sub("^ "; "") | sub(" $"; "");
def safe_text: plain | gsub("[^A-Za-z0-9 ,.:()\u0027_-]"; " ") | gsub(" +"; " ") | sub("^ "; "") | sub(" $"; "") | .[0:120];
def whole_text($limit): if type == "string" then plain | .[0:$limit] | sub(" $"; "") else "" end;
def column_name: if type == "string" and test("\\A[A-Za-z0-9_-]{1,50}\\z") then . else null end;
def first_name($limit):
  if type != "string" then null
  else
    (plain | split(",")[0] // "" | plain | split(" ")[0] // "") as $word
    | if ($word | contains("@")) then null
      else ($word | gsub("[^\\p{L}\u0027.-]"; "") | sub("^[-.\u0027]+"; "") | sub("[-.\u0027]+$"; "") | .[0:$limit] | if . == "" then null else . end) end
  end;
def real_day: . as $day | (try (($day + "T00:00:00Z") | fromdateiso8601 | todate | .[0:10]) catch "") == $day;
def day_of: if type == "string" then ([scan("(?<![0-9])(?:19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}(?![0-9])") | select(real_day)] | first) else null end;
def first_of_each($key): reduce .[] as $item ([]; if any(.[]; .[$key] == $item[$key]) then . else . + [$item] end);
'

# Counts the requests made to Monday in this run, and why the run stopped asking
requests=0
stopped=""
outcome=failed

# Writes one problem of this run, in plain words, on a line of its own
problem() {
  printf '%s\n' "$1" >> "$work/errors.txt"
}

# Sends the question in file $1 to Monday and keeps the answer in file $2. Leaves one
# word in $outcome: ok, failed, refused (Monday turned the token away), limit (Monday
# says there were too many requests) or capped (this run has made all the requests it
# may). The problem is written in plain words.
ask() {
  outcome=failed
  if [ -n "$stopped" ]; then
    outcome=$stopped
    return 0
  fi
  if [ "$requests" -ge "$max_requests" ]; then
    stopped=capped
    outcome=capped
    problem "This run stopped after $max_requests requests to Monday and goes on at the next run."
    return 0
  fi
  requests=$((requests + 1))

  curl_status=0
  answer_code=$(secret_settings |
    curl --disable --silent --max-time 30 --connect-timeout 10 --max-filesize 10000000 --proto '=https' \
      --header 'Content-Type: application/json' --header "API-Version: $monday_version" \
      --request POST --data-binary "@$1" --output "$2" --write-out '%{http_code}' --config - "$monday_address" 2> /dev/null) || curl_status=$?

  if [ "$curl_status" -ne 0 ]; then
    problem "Monday did not answer, $(explain "$curl_status")."
    return 0
  fi

  case $answer_code in
    200)
      if ! jq empty "$2" > /dev/null 2>&1; then
        problem "Monday sent an answer that is not data."
        return 0
      fi
      said=$(jq -r "$paths$helpers"'error_messages | map(safe_text) | unique | .[0:2] | join("; ")' "$2" 2> /dev/null || true)
      if [ -n "$said" ]; then
        problem "Monday said: $said"
        return 0
      fi
      outcome=ok
      ;;
    401|403)
      stopped=refused
      outcome=refused
      problem "Monday refused the token. Check MONDAY_API_TOKEN in local.env."
      ;;
    429)
      stopped=limit
      outcome=limit
      problem "Monday says there were too many requests, so this run stopped. It goes on at the next run."
      ;;
    *)
      problem "Monday answered with code $answer_code."
      ;;
  esac
}

if [ "$mode" = check ]; then
  work=$(mktemp -d "${TMPDIR:-/tmp}/monday-check.XXXXXX")
  trap 'rm -rf "$work"' EXIT
  : > "$work/errors.txt"
  failed=0

  case $monday_token in
    ''|'['*)
      echo "FAIL  MONDAY_API_TOKEN is not in local.env"
      failed=1
      ;;
    *)
      looks_like_key MONDAY_API_TOKEN "$monday_token"
      jq -n --arg query "$monday_query_me" '{query: $query}' > "$work/body.json"
      ask "$work/body.json" "$work/answer.json"
      if [ "$outcome" = ok ]; then
        name=$(jq -r "$paths$helpers"'me_name | first_name(12) | strings' "$work/answer.json" 2> /dev/null || true)
        echo "OK    Monday accepts the token (connected as ${name:-nobody})"
      else
        echo "FAIL  $(tail -n 1 "$work/errors.txt")"
        failed=1
      fi
      ;;
  esac

  case $write_token in
    ''|'['*)
      echo "FAIL  SANITY_WRITE_TOKEN is not in local.env, so nothing can be written to Sanity"
      failed=1
      ;;
    *) echo "OK    SANITY_WRITE_TOKEN is in local.env" ;;
  esac

  exit "$failed"
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

mkdir -p "$monday"

# A run that starts while the last one is still going stops at once
exec 9> "$monday/.lock"
if ! flock -n 9; then
  echo "The last run is still going, so this one stops."
  exit 0
fi

# Nothing else is working while this run holds the lock, so a work folder that
# is still here was left by a run that a power cut or a reboot stopped
rm -rf "$monday"/.work.*
work=$(mktemp -d "$monday/.work.XXXXXX")
trap 'rm -rf "$work"' EXIT
: > "$work/errors.txt"

# Sends the mutations in file $1 to Sanity. Gives back 1 and writes the problem
# when Sanity does not take them.
write_to_sanity() {
  status=0
  printf 'header = "Authorization: Bearer %s"\n' "$write_token" |
    curl --disable --silent --fail --max-time 30 --connect-timeout 10 --proto '=https' --config - \
      --request POST --header 'Content-Type: application/json' --data-binary "@$1" \
      --output /dev/null "$host/v$version/data/mutate/$dataset" 2> /dev/null || status=$?

  if [ "$status" -ne 0 ]; then
    problem "Could not write to Sanity, $(explain "$status")."
    return 1
  fi
}

# What the settings say, the teams, the Team leads, what the Mini wrote earlier and what it
# knows of its own last read. The dataset is public, so no token is sent. The ordinary host is
# used and not the cached one, because the answer must be the newest.
query='{
  "zone": *[_id == "theme"][0].timeZone,
  "owners": *[_id == "dashboardSettings"][0].mondayShowOwners,
  "every": *[_id == "dashboardSettings"][0].mondayEveryMinutes,
  "taskBoard": *[_id == "dashboardSettings"][0].mondayTaskBoard {
    boardId, departmentColumn, statusColumn, teamColumn, priorityColumn, showColumn, assignedColumn,
    pocColumn, timelineColumn, hoursColumn, completedColumn, milestoneColumn,
    "teamLabels": teamLabels[] { index, "team": team._ref },
    statusIndexes, priorityIndexes, hideLabel,
    "departmentLabels": departmentLabels[] { index, name, "subteam": subteam._ref, neverShown }
  },
  "milestoneBoard": *[_id == "dashboardSettings"][0].mondayMilestoneBoard {
    boardId, dateColumn, teamColumn, departmentColumn, statusColumn,
    "teamLabels": teamLabels[] { index, "team": team._ref },
    statusIndexes,
    "departmentLabels": departmentLabels[] { index, name, "subteam": subteam._ref }
  },
  "teams": *[_type == "team" && !(_id in path("drafts.**"))] { _id },
  "subteams": *[_type == "subteam" && !(_id in path("drafts.**"))] { _id, name },
  "tasks": *[_type == "task" && source == "monday" && !(_id in path("drafts.**"))] {
    _id, title, "subteam": subteam._ref, "team": team._ref, status, priority, showOnBoard, contact, owners,
    startDate, dueDate, estHours, completedOn, milestoneIds, hiddenReason, show, mondayBoardId, mondayBoardName
  },
  "milestones": *[_type == "milestone" && !(_id in path("drafts.**"))] {
    _id, name, targetDate, "team": team._ref, "subteam": subteam._ref, status, show
  },
  "known": *[_id == "monday-status"][0] { lastSyncAt, lastError, callsToday, callsDate, "boards": count(boards) },
  "snapshots": *[_id == "monday-status"][0].snapshots[] { date, open },
  "readings": *[_id == "monday-status"][0].readings[] { boardId, boardName, itemsRead, readAt, note }
}'

status=0
curl --disable --silent --get --max-time 30 --connect-timeout 10 --max-filesize 10000000 --proto '=https' \
  --data-urlencode "query=$query" --data-urlencode 'perspective=published' \
  --output "$work/sanity.json" "$host/v$version/data/query/$dataset" 2> /dev/null || status=$?

if [ "$status" -ne 0 ] || ! jq -e '.result | objects' "$work/sanity.json" > /dev/null 2>&1; then
  echo "Could not get the settings from Sanity. Nothing was changed." >&2
  exit 1
fi

zone=$(jq -r '.result.zone | strings' "$work/sanity.json")
case $zone in
  ''|*[!A-Za-z0-9_+/-]*) zone=$default_zone ;;
esac
today=$(TZ="$zone" date +%Y-%m-%d)
now_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# How often the Mini reads, from 5 to 120 minutes, and how old the last read is. The timer wakes
# this script every 5 minutes, and a run that comes before the setting says so ends without a word.
every=$(jq -r --argjson defaults "$defaults" '.result.every | if type == "number" and . >= 5 and . <= 120 then floor else $defaults.every end' "$work/sanity.json")
due=$(jq -r --arg now "$now_iso" --argjson every "$every" --argjson slack "$slack_seconds" '
  def seconds: sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601;
  (try ((($now | seconds) - (.result.known.lastSyncAt | seconds))) catch null) as $age
  | if $age == null or $age < 0 or $age >= ($every * 60 - $slack) then "yes" else "no" end' "$work/sanity.json")
if [ "$due" = no ]; then
  exit 0
fi

# The reads made today. A new day starts at midnight in the time zone of the screen.
calls_before=$(jq -r --arg today "$today" '(.result.known | objects | select(.callsDate == $today) | .callsToday | numbers | floor) // 0' "$work/sanity.json")

# The settings of the two boards: what the Monday tab holds, with the starting values for whatever
# it does not hold (a page saved before the tab had these fields). A value that cannot be used is
# empty. A column id is letters, digits, hyphens and underscores.
jq -c --argjson defaults "$defaults" "$helpers"'
  def kept: if type == "object" then with_entries(select(.value != null)) else {} end;
  def fill($base): ($base * kept);
  def column_or_null: if type == "string" and test("\\A[A-Za-z0-9_-]{1,50}\\z") then . else null end;
  def board_or_null: if type == "string" and test("\\A[0-9]{1,20}\\z") then . else null end;
  def labels_or($base): if type == "array" then . else $base end;
  def fixed_columns($names): . as $b | reduce $names[] as $name ($b; .[$name] |= column_or_null);
  .result as $r
  | {
      owners: ($r.owners == true),
      taskBoard: (($r.taskBoard | fill($defaults.taskBoard))
        | .boardId |= board_or_null
        | fixed_columns(["departmentColumn", "statusColumn", "teamColumn", "priorityColumn", "showColumn", "assignedColumn", "pocColumn", "timelineColumn", "hoursColumn", "completedColumn", "milestoneColumn"])
        | .teamLabels |= labels_or($defaults.taskBoard.teamLabels)
        | .departmentLabels |= labels_or($defaults.taskBoard.departmentLabels)
        | .hideLabel |= whole_text(30)),
      milestoneBoard: (($r.milestoneBoard | fill($defaults.milestoneBoard))
        | .boardId |= board_or_null
        | fixed_columns(["dateColumn", "teamColumn", "departmentColumn", "statusColumn"])
        | .teamLabels |= labels_or($defaults.milestoneBoard.teamLabels)
        | .departmentLabels |= labels_or($defaults.milestoneBoard.departmentLabels)),
      subteams: ($r.subteams | arrays | map(select(._id | type == "string") | {_id, name: (.name | if type == "string" then plain | ascii_downcase else "" end)}))
    }' "$work/sanity.json" > "$work/settings.json"

owners=$(jq -r '.owners' "$work/settings.json")

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

# What each board entry needs to be read: a board number, and for the tasks the department and
# the status columns, because without them no task could be placed or told from a done one.
task_board=$(jq -r '.taskBoard.boardId // ""' "$work/settings.json")
milestone_board=$(jq -r '.milestoneBoard.boardId // ""' "$work/settings.json")
task_columns=$(jq -c '.taskBoard | [.departmentColumn, .statusColumn, .teamColumn, .priorityColumn, .showColumn, .assignedColumn, .pocColumn, .timelineColumn, .hoursColumn, .completedColumn, .milestoneColumn] | map(select(. != null)) | unique' "$work/settings.json")
milestone_columns=$(jq -c '.milestoneBoard | [.dateColumn, .teamColumn, .departmentColumn, .statusColumn] | map(select(. != null)) | unique' "$work/settings.json")
task_usable=yes
milestone_usable=yes
if [ -z "$task_board" ]; then
  task_usable=no
  problem "The task board in Dashboard Settings has no usable board number, so it was skipped."
elif [ "$(jq -r '.taskBoard | if .departmentColumn == null or .statusColumn == null then "no" else "yes" end' "$work/settings.json")" = no ]; then
  task_usable=no
  problem "The task board in Dashboard Settings has no Department or Status column, so it was skipped."
fi
if [ -z "$milestone_board" ]; then
  milestone_usable=no
  problem "The milestones board in Dashboard Settings has no usable board number, so it was skipped."
elif [ "$(jq -r '.milestoneBoard | if .dateColumn == null then "no" else "yes" end' "$work/settings.json")" = no ]; then
  milestone_usable=no
  problem "The milestones board in Dashboard Settings has no Target Date column, so it was skipped."
fi

# The boards the token can see, with their columns, and who the token belongs to. It is asked for on the
# first read of a day and when the Mini has no list yet, and is one of the requests of the run.
boards_listed=no
if [ "$calls_before" -eq 0 ] || [ "$(jq -r '.result.known.boards // 0' "$work/sanity.json")" -eq 0 ]; then
  jq -n --arg query "$monday_query_boards" '{query: $query}' > "$work/body.json"
  ask "$work/body.json" "$work/boards-answer.json"
  if [ "$outcome" = ok ] && jq -e "$paths"'board_list | arrays' "$work/boards-answer.json" > /dev/null 2>&1; then
    boards_listed=yes
  elif [ "$outcome" = ok ]; then
    problem "Monday sent no list of boards."
  fi
fi

: > "$work/readings.ndjson"

# Reads every page of one board. $1 is tasks or milestones, $2 the board number and $3 the columns
# as a list. The parent items are left in $work/<kind>-items.ndjson. Leaves read_all (yes when the
# board was read to its end) and board_title. A problem is written for a page that did not come.
read_board() {
  kind=$1
  board=$2
  printf '%s' "$3" > "$work/columns.json"
  : > "$work/$kind-items.ndjson"
  errors_before=$(wc -l < "$work/errors.txt" | tr -d ' ')
  cursor=""
  read_all=no
  board_title=""
  seen=yes

  while :; do
    if [ -z "$cursor" ]; then
      page='first_page'
      jq -n --arg query "$monday_query_items" --arg board "$board" --slurpfile columns "$work/columns.json" --argjson limit "$page_size" \
        '{query: $query, variables: {board: [$board], columns: $columns[0], limit: $limit}}' > "$work/body.json"
    else
      page='more_page'
      jq -n --arg query "$monday_query_more" --arg cursor "$cursor" --slurpfile columns "$work/columns.json" --argjson limit "$page_size" \
        '{query: $query, variables: {cursor: $cursor, columns: $columns[0], limit: $limit}}' > "$work/body.json"
    fi
    ask "$work/body.json" "$work/page.json"
    [ "$outcome" = ok ] || break

    if ! jq -e "$paths$page"' | page_items | arrays' "$work/page.json" > /dev/null 2>&1; then
      problem "Monday gave no items for board $board, so the account of the token may not be able to see it."
      seen=no
      break
    fi

    if [ -z "$cursor" ]; then
      board_title=$(jq -r "$paths$helpers"'first_board_name | whole_text(60)' "$work/page.json" 2> /dev/null || true)
    fi

    jq -c "$paths$page"'
      | page_items | .[] | objects
      | {
          id: (item_id | tostring),
          name: item_name,
          parent: (item_parent | if . == null then null else tostring end),
          values: (((item_values | arrays) // []) | map(select(type == "object") | {key: (value_column | tostring), value: {text: (value_text // ""), label: value_label, index: value_index, linked: value_linked, date: value_date, from: value_from, to: value_to}}) | from_entries)
        }' "$work/page.json" >> "$work/$kind-items.ndjson"

    cursor=$(jq -r "$paths$page"' | page_cursor | strings' "$work/page.json")
    if [ -z "$cursor" ]; then
      read_all=yes
      break
    fi
    case $cursor in
      *[!A-Za-z0-9_=+/.-]*)
        problem "Monday sent a place to carry on from that cannot be used, for board $board."
        break
        ;;
    esac
    if [ "${#cursor}" -gt 2000 ]; then
      problem "Monday sent a place to carry on from that is too long, for board $board."
      break
    fi
  done

  board_items=$(wc -l < "$work/$kind-items.ndjson" | tr -d ' ')
  board_note=""
  if [ "$(wc -l < "$work/errors.txt" | tr -d ' ')" -gt "$errors_before" ]; then
    board_note=$(tail -n 1 "$work/errors.txt")
  fi
  board_ok=false
  if [ "$read_all" = yes ] || [ "$seen" = no ]; then
    board_ok=true
  elif [ -z "$board_note" ]; then
    board_note="This run stopped before it read this board, and goes on at the next run."
  fi
  # What this run read from the board, for the Monday Boards page and the connection block. A board
  # that stopped half way keeps the reading of the run before, and only gets the reason.
  jq -n -c --arg board "$board" --arg name "$board_title" --argjson items "$board_items" --argjson ok "$board_ok" --arg note "$board_note" \
    '{board: $board, name: $name, items: $items, ok: $ok, note: $note}' >> "$work/readings.ndjson"
}

tasks_read=no
milestones_read=no
: > "$work/task-rows.ndjson"
: > "$work/milestone-rows.ndjson"

if [ "$task_usable" = yes ]; then
  read_board tasks "$task_board" "$task_columns"
  tasks_read=$read_all

  # One row for each parent item: what the screen would show of it. A department that is Unassigned
  # (or a label the table does not know, or a Team lead that does not exist) gives no Team lead, and
  # the task is written hidden. Status, priority, team and department are read by their index.
  jq -n -c --slurpfile cfg "$work/settings.json" --slurpfile items "$work/tasks-items.ndjson" \
    --argjson owners "$owners" --argjson unset "$unset_index" --argjson title_limit "$title_limit" \
    --argjson contact_limit "$contact_limit" --argjson owners_kept "$owners_kept" --argjson milestones_kept "$milestones_kept" "$helpers"'
    $cfg[0].taskBoard as $b
    | def value_of($column): if $column == null then {} else (.values[$column] // {}) end;
      def index_of($column): (value_of($column).index | if type == "number" then floor else null end);
      def row_of($table; $i): [$table[]? | objects | select(.index == $i)][0];
      ($cfg[0].subteams) as $subteams
      | $items[]
      | select(.parent == null)
      | (index_of($b.departmentColumn) // $unset) as $department
      | row_of($b.departmentLabels; $department) as $row
      | (if $row == null or $row.neverShown == true then null
         elif ($row.subteam | type) == "string" and any($subteams[]; ._id == $row.subteam) then $row.subteam
         else ([$subteams[] | select(.name == ($row.name | if type == "string" then plain | ascii_downcase else "" end))][0]._id) end) as $subteam
      | (index_of($b.statusColumn) // $unset) as $state
      | (index_of($b.priorityColumn)) as $rank
      | row_of($b.teamLabels; (index_of($b.teamColumn) // $unset)) as $team_row
      | (value_of($b.showColumn).label) as $show_label
      | (value_of($b.timelineColumn)) as $timeline
      | ([($timeline.text // "") | scan("(?<![0-9])(?:19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}(?![0-9])") | select(real_day)]) as $text_days
      | (value_of($b.hoursColumn).text | if type == "string" then (gsub(","; "") | try tonumber catch null) else null end) as $hours
      | {
          id: (.id | if test("\\A[0-9]{1,20}\\z") then . else null end),
          title: (.name | whole_text($title_limit)),
          team: (($team_row.team) | if type == "string" then . else "" end),
          subteam: ($subteam // ""),
          hidden: (if $subteam == null then "unassigned" else "" end),
          status: (if $state == $b.statusIndexes.done then "done"
            elif $state == $b.statusIndexes.inProgress then "in-progress"
            elif $state == $b.statusIndexes.inReview then "in-review"
            elif $state == $b.statusIndexes.stuck then "blocked"
            else "up-next" end),
          priority: (if $rank == null then null
            elif $rank == $b.priorityIndexes.high then "high"
            elif $rank == $b.priorityIndexes.medium then "medium"
            elif $rank == $b.priorityIndexes.low then "low"
            else null end),
          showOnBoard: (($b.hideLabel != "") and ($show_label | type) == "string" and ($show_label | plain | ascii_downcase) == ($b.hideLabel | plain | ascii_downcase) | not),
          contact: (value_of($b.pocColumn).text | first_name($contact_limit)),
          owners: (if $owners
            then ([value_of($b.assignedColumn).text | if type == "string" then split(",") else [] end | .[] | first_name($contact_limit) | select(. != null)]
              | reduce .[] as $name ([]; if index([$name]) then . else . + [$name] end) | .[0:$owners_kept])
            else [] end),
          startDate: (($timeline.from | day_of) // $text_days[0]),
          dueDate: (($timeline.to | day_of) // $text_days[-1:][0]),
          estHours: (if ($hours | type) == "number" and $hours >= 0 and $hours < 100000 then ($hours * 100 | round / 100) else null end),
          completedOn: (value_of($b.completedColumn) | (.date | day_of) // (.text | day_of)),
          milestones: ([value_of($b.milestoneColumn).linked | arrays | .[] | tostring | select(test("\\A[0-9]{1,20}\\z"))] | unique | .[0:$milestones_kept])
        }
      | select(.id != null and .title != "")' >> "$work/task-rows.ndjson"
fi

if [ "$milestone_usable" = yes ]; then
  read_board milestones "$milestone_board" "$milestone_columns"
  milestones_read=$read_all

  # One row for each milestone that has a target date and a name that does not start with EXAMPLE
  jq -n -c --slurpfile cfg "$work/settings.json" --slurpfile items "$work/milestones-items.ndjson" \
    --argjson unset "$unset_index" --argjson milestone_limit "$milestone_limit" "$helpers"'
    $cfg[0].milestoneBoard as $b
    | def value_of($column): if $column == null then {} else (.values[$column] // {}) end;
      def index_of($column): (value_of($column).index | if type == "number" then floor else null end);
      def row_of($table; $i): [$table[]? | objects | select(.index == $i)][0];
      ($cfg[0].subteams) as $subteams
      | $items[]
      | select(.parent == null)
      | (.name | whole_text($milestone_limit)) as $name
      | (value_of($b.dateColumn) | (.date | day_of) // (.text | day_of)) as $target
      | row_of($b.departmentLabels; (index_of($b.departmentColumn) // $unset)) as $row
      | (index_of($b.statusColumn) // $unset) as $state
      | {
          id: (.id | if test("\\A[0-9]{1,20}\\z") then . else null end),
          name: $name,
          targetDate: $target,
          team: ((row_of($b.teamLabels; (index_of($b.teamColumn) // $unset)).team) | if type == "string" then . else "" end),
          subteam: (if $row == null then ""
            elif ($row.subteam | type) == "string" and any($subteams[]; ._id == $row.subteam) then $row.subteam
            else (([$subteams[] | select(.name == ($row.name | if type == "string" then plain | ascii_downcase else "" end))][0]._id) // "") end),
          status: (if $state == $b.statusIndexes.done then "done"
            elif $state == $b.statusIndexes.onTrack then "on-track"
            elif $state == $b.statusIndexes.atRisk then "at-risk"
            else "not-started" end)
        }
      | select(.id != null and .name != "" and .targetDate != null and (.name | startswith("EXAMPLE") | not))' >> "$work/milestone-rows.ndjson"
fi

echo "monday: $(wc -l < "$work/task-rows.ndjson" | tr -d ' ') task(s) and $(wc -l < "$work/milestone-rows.ndjson" | tr -d ' ') milestone(s) read"

# What to send to Sanity, in groups of mutations. A document that is new is made and filled in by
# the same group, so it is never left empty. One that exists is only touched when it differs from
# what the item says, and the script never sends Show on TV, so an editor choice stays. A task or a
# milestone whose item has gone is switched off, never deleted.
plan='
def reference($id): {_type: "reference", _ref: $id};
def none_if_empty: if . == "" or . == [] then null else . end;

# What a task should be, with a null for each value it should not have
def wanted_task($row; $board; $board_name):
  {
    title: $row.title,
    subteam: ($row.subteam | none_if_empty),
    team: ($row.team | none_if_empty),
    status: $row.status,
    priority: $row.priority,
    showOnBoard: $row.showOnBoard,
    contact: $row.contact,
    owners: ($row.owners | none_if_empty),
    startDate: $row.startDate,
    dueDate: $row.dueDate,
    estHours: $row.estHours,
    completedOn: $row.completedOn,
    milestoneIds: ($row.milestones | none_if_empty),
    hiddenReason: ($row.hidden | none_if_empty),
    show: ($row.hidden == ""),
    mondayBoardId: $board,
    mondayBoardName: ($board_name | none_if_empty)
  };

# What a task is now, in the same shape. A task with no Show on screen is on.
def stored_task:
  {title, subteam, team, status, priority, showOnBoard, contact, owners, startDate, dueDate, estHours, completedOn, milestoneIds, hiddenReason,
   show: (if .show == false then false else true end), mondayBoardId, mondayBoardName};

def wanted_milestone($row):
  {name: $row.name, targetDate: $row.targetDate, team: ($row.team | none_if_empty), subteam: ($row.subteam | none_if_empty), status: $row.status, show: true};

def stored_milestone:
  {name, targetDate, team, subteam, status, show: (if .show == false then false else true end)};

# The patch that brings a document to what it should be. A value it should not have is unset.
def patch_of($id; $doc):
  {patch: ({
      id: $id,
      set: ($doc | with_entries(select(.value != null)) | if has("subteam") then .subteam |= reference(.) else . end | if has("team") then .team |= reference(.) else . end)
    } + ([$doc | to_entries[] | select(.value == null) | .key] as $absent | if ($absent | length) == 0 then {} else {unset: $absent} end))};

$sanity[0].result as $found
| ($found.tasks | arrays | map(select(._id | type == "string")) | map({key: ._id, value: .}) | from_entries) as $earlier
| ($found.milestones | arrays | map(select(._id | type == "string")) | map({key: ._id, value: .}) | from_entries) as $earlier_milestones
| ($task_rows | unique_by(.id) | map(. as $row | ("task-monday-" + $row.id) as $id | {id: $id, row: $row, task: wanted_task($row; $board; $board_name), before: ($earlier[$id] // null)})) as $pairs
| ($milestone_rows | unique_by(.id) | map(. as $row | ("milestone-monday-" + $row.id) as $id | {id: $id, row: $row, task: wanted_milestone($row), before: ($earlier_milestones[$id] // null)})) as $milestone_pairs
| ($pairs | map(select(.before == null))) as $created
| ($pairs | map(select(.before != null and (.before | stored_task) != .task))) as $changed
| ($milestone_pairs | map(select(.before == null))) as $milestones_created
| ($milestone_pairs | map(select(.before != null and (.before | stored_milestone) != .task))) as $milestones_changed
| (if $tasks_complete == "yes"
    then ($pairs | map({key: .id, value: true}) | from_entries) as $kept
      | [$earlier | to_entries[] | .value | select(.show != false) | select($kept[._id] | not)]
    else [] end) as $gone
| (if $milestones_complete == "yes"
    then ($milestone_pairs | map({key: .id, value: true}) | from_entries) as $kept
      | [$earlier_milestones | to_entries[] | .value | select(.show != false) | select($kept[._id] | not)]
    else [] end) as $milestones_gone
| {
    groups: (
      ($created | map([{createIfNotExists: {_id: .id, _type: "task", source: "monday", mondayId: .row.id}}, patch_of(.id; .task)]))
      + ($changed | map([patch_of(.id; .task)]))
      + ($gone | map([{patch: {id: ._id, set: {show: false}}}]))
      + ($milestones_created | map([{createIfNotExists: {_id: .id, _type: "milestone"}}, patch_of(.id; .task)]))
      + ($milestones_changed | map([patch_of(.id; .task)]))
      + ($milestones_gone | map([{patch: {id: ._id, set: {show: false}}}]))
    ),
    tasks: ($pairs | length),
    created: ($created | length),
    changed: ($changed | length),
    hidden: ($gone | length),
    milestones: ($milestone_pairs | length)
  }
'

failed=0

if [ "$tasks_read" = yes ] || [ "$milestones_read" = yes ]; then
  board_name=$(jq -r --arg board "$task_board" 'select(.board == $board) | .name' "$work/readings.ndjson" | head -n 1)
  jq -n --slurpfile sanity "$work/sanity.json" --slurpfile task_rows "$work/task-rows.ndjson" --slurpfile milestone_rows "$work/milestone-rows.ndjson" \
    --arg tasks_complete "$tasks_read" --arg milestones_complete "$milestones_read" --arg board "$task_board" --arg board_name "$board_name" \
    "$helpers$plan" > "$work/plan.json"
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

  echo "monday: $(jq -r '"\(.tasks) task(s) wanted, \(.created) new, \(.changed) changed, \(.hidden) switched off, \(.milestones) milestone(s)"' "$work/plan.json")"
fi

# The patch of the document that Studio reads to offer the boards and columns, and to say when
# the Mini last looked and how many reads it has used today. The daily count is added only when
# the task board was read to its end, so a run that missed it cannot write a count that is too low.
# A reading that failed keeps the figures of the run before.
status_patch='
def snapshot_list($old):
  [$old | arrays | .[] | objects
    | select((.date | type) == "string" and (.date | test("\\A[0-9]{4}-[0-9]{2}-[0-9]{2}\\z")))
    | select((.open | type) == "number")
    | {_key: .date, date, open: (.open | floor)}];

def with_today($snapshots):
  ($snapshots | map(select(.date != $today))) + [{_key: $today, date: $today, open: $open}]
  | sort_by(.date) | .[(0 - $snapshots_kept):];

def kept_columns:
  [board_columns | arrays | .[] | objects
    | select((column_id | type) == "string" and (column_id | test("\\A[A-Za-z0-9_-]{1,50}\\z")))
    | {_key: column_id, id: column_id, title: (column_title | whole_text(60))}
      + (column_type | if type == "string" and test("\\A[a-z_]{1,40}\\z") then {type: .} else {} end)]
  | first_of_each("id") | .[0:$columns_kept];

# What the run read from each board. A board that was read keeps the number of items and the time
# of this run. A board that stopped half way keeps the number and the time of the run before it, and only
# gets the reason. The reason of a board that gave no items is kept, and is left out when there is none.
def reading_list($old):
  [$readings[] | . as $r
    | ([$old | arrays | .[] | objects | select(.boardId == $r.board)][0] // {}) as $before
    | {
        _key: $r.board,
        boardId: $r.board,
        boardName: (if $r.name != "" then $r.name else $before.boardName end),
        itemsRead: (if $r.ok then $r.items else $before.itemsRead end),
        readAt: (if $r.ok then $now else $before.readAt end),
        note: (if $r.note != "" then $r.note else null end)
      }
    | with_entries(select(.value != null))];

def kept_boards:
  [board_list | arrays | .[] | objects | select(board_is_offered)
    | select((board_id | tostring) | test("\\A[0-9]{1,20}\\z"))
    | (board_id | tostring) as $id
    | {_key: $id, id: $id, name: (board_name | whole_text(60)), itemCount: (board_items | if type == "number" and . >= 0 then floor else 0 end), columns: kept_columns}]
  | first_of_each("id") | .[0:$boards_kept];

([$errors | split("\n")[] | select(. != "")] | unique | if length == 0 then null else (.[0:3] | join("; ") | .[0:300]) end) as $error
| {
    set: ({
        callsToday: $calls,
        callsDate: $today,
        readings: reading_list($sanity[0].result.readings)
      }
      + (if $tasks_read == "yes" then {lastSyncAt: $now, taskCount: ($rows | unique_by(.id) | length), hiddenUnassigned: ($rows | unique_by(.id) | map(select(.hidden != "")) | length)} else {} end)
      + (if $boards_listed == "yes" then {boards: ($answer[0] | kept_boards)} + ($answer[0] | me_name | first_name(12) | if . == null then {} else {connectedAs: .} end) else {} end)
      + (if $tasks_read == "yes" then {snapshots: with_today(snapshot_list($sanity[0].result.snapshots))} else {} end)
      + (if $error == null then {} else {lastError: $error} end)),
    unset: (if $error == null then ["lastError"] else [] end)
  }
'

# Stopped with nothing read: the reads still count, and the reason is kept for Studio
echo '{}' > "$work/boards-answer-empty.json"
[ -s "$work/boards-answer.json" ] || cp "$work/boards-answer-empty.json" "$work/boards-answer.json"

open=$(jq -s '[.[] | select(.hidden == "" and .status != "done")] | length' "$work/task-rows.ndjson")
calls_after=$((calls_before + requests))

jq -n --slurpfile sanity "$work/sanity.json" --slurpfile answer "$work/boards-answer.json" --slurpfile readings "$work/readings.ndjson" --slurpfile rows "$work/task-rows.ndjson" \
  --rawfile errors "$work/errors.txt" --arg now "$now_iso" --arg today "$today" --argjson calls "$calls_after" --argjson open "$open" \
  --arg tasks_read "$tasks_read" --arg boards_listed "$boards_listed" \
  --argjson boards_kept "$boards_kept" --argjson columns_kept "$columns_kept" --argjson snapshots_kept "$snapshots_kept" \
  "$paths$helpers$status_patch" > "$work/status-patch.json"
jq '{mutations: [{createIfNotExists: {_id: "monday-status", _type: "mondayStatus"}}, {patch: ({id: "monday-status", set: .set} + (if (.unset | length) == 0 then {} else {unset: .unset} end))}]}' "$work/status-patch.json" > "$work/write.json"

status_written=no
if write_to_sanity "$work/write.json"; then
  status_written=yes
  echo "monday: status written"
else
  failed=1
fi

# The time of this run goes to status-mini, when the task board was read and the status could
# be written. status-write.sh never stops this script.
if [ "$tasks_read" = yes ] && [ "$status_written" = yes ]; then
  "$deploy/scripts/status-write.sh" monday || true
fi

# What went wrong is also in the status, for Studio. Here it is for the journal.
if [ -s "$work/errors.txt" ]; then
  while read -r line; do
    echo "monday: $line" >&2
  done < "$work/errors.txt"
  failed=1
fi
exit "$failed"
