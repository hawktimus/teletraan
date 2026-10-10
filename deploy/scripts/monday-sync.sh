#!/bin/sh
# Reads the Monday boards that the Monday tab of Dashboard Settings names and
# writes their items into Sanity as tasks (published documents with the ids
# task-monday-<item number>), so the screen can show them. It also writes the
# document monday-status, which the Monday tab uses to offer the boards and their
# columns, and keeps one count of the open items for each day. Needs curl and jq
# (docs/rebuilding-the-mini.md, step 18, and docs/monday.md).
#
#   monday-sync.sh           one run, which the timer starts every 10 minutes
#   monday-sync.sh --check   asks Monday who the token belongs to, and writes nothing
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
repo=$(dirname "$deploy")
config="$repo/dashboard/config.js"
env_file="$deploy/local.env"

# Everything that depends on how Monday writes its answers is in this block: the
# address, the version, the questions, and where each value sits in an answer. If
# Monday changes something, correct the line here and nowhere else. They were
# written from the public documentation of Monday and have not been tried against
# the live service (docs/monday.md, "If an answer looks different").
monday_address='https://api.monday.com/v2'
monday_version='2025-07'

# Who the token belongs to
monday_query_me='query { me { name } }'

# Who the token belongs to, and the boards it can see with their columns
monday_query_boards='query { me { name } boards(limit: 100, state: active, order_by: used_at) { id name type items_count columns { id title type } } }'

# The first page of the items of one board, and the pages after it. $columns lists
# the columns that are read.
monday_query_items='query ($board: [ID!], $columns: [String!], $limit: Int) { boards(ids: $board) { items_page(limit: $limit) { cursor items { id name group { title } column_values(ids: $columns) { id text } } } } }'
monday_query_more='query ($cursor: String!, $columns: [String!], $limit: Int) { next_items_page(limit: $limit, cursor: $cursor) { cursor items { id name group { title } column_values(ids: $columns) { id text } } } }'

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
def more_page: .data.next_items_page;
def page_cursor: .cursor;
def page_items: .items;
def item_id: .id;
def item_name: .name;
def item_group: (.group.title? // null);
def item_values: .column_values;
def value_column: .id;
def value_text: .text;
def error_messages: [(.errors[]?.message?), .error_message?] | map(strings);
'

# The longest title a task can have (studio/schemas/task.js), the longest first
# name (the same file), and the longest label read from Dashboard Settings
title_limit=22
contact_limit=12
label_limit=40

# Items read from one board, items asked for in one page, and requests to Monday in
# one run. A run that reaches the request limit stops and says so, and the next
# run starts again at the first board.
items_per_board=500
page_size=100
max_requests=60

# What monday-status keeps: boards, columns of a board, and daily counts
boards_kept=100
columns_kept=60
snapshots_kept=120

# Rows (a row is a task) sent to Sanity in one request
rows_per_write=100

# The subteam that tasks go to when no Team lead has the name of their group. It
# is made once, and it is not shown on the screen.
unmatched_id=subteam-unmatched
unmatched_name='[Unmatched]'

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
def due_date: [scan("(?<![0-9])(?:19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}(?![0-9])") | select(real_day)] | last;
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

# What the settings say, the teams, the Team leads, the tasks this script made
# earlier and the daily counts it kept. The dataset is public, so no token is sent.
# The ordinary host is used and not the cached one, because the answer must be the
# newest.
query='{
  "zone": *[_id == "theme"][0].timeZone,
  "owners": *[_id == "dashboardSettings"][0].mondayShowOwners,
  "boards": *[_id == "dashboardSettings"][0].mondayBoards[] {
    boardId, "team": team._ref, statusColumn, progressLabel, doneLabel,
    priorityColumn, priorityHigh, priorityMedium, priorityLow, dueColumn, ownerColumn, teamColumn
  },
  "teams": *[_type == "team" && !(_id in path("drafts.**"))] { _id },
  "subteams": *[_type == "subteam" && !(_id in path("drafts.**"))] { _id, name },
  "tasks": *[_type == "task" && source == "monday" && !(_id in path("drafts.**"))] {
    _id, title, "subteam": subteam._ref, "team": team._ref, status, priority, dueDate, contact, show
  },
  "snapshots": *[_id == "monday-status"][0].snapshots[] { date, open }
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

owners=false
if [ "$(jq -r '.result.owners' "$work/sanity.json")" = true ]; then
  owners=true
fi

# The board entries that can be used, as one list, and a line for each one that
# cannot be. A board needs a number, a team that exists and a status column.
jq -c --argjson label_limit "$label_limit" "$helpers"'
  (.result.teams | arrays | map(._id)) as $team_ids
  | [.result.boards | arrays | .[] | objects
      | {
          board: (.boardId | whole_text(30)),
          team: (.team | if type == "string" then . else "" end),
          status_column: (.statusColumn | column_name),
          progress: (.progressLabel | whole_text($label_limit) | if . == "" then "Working on it" else . end),
          done: (.doneLabel | whole_text($label_limit) | if . == "" then "Done" else . end),
          priority_column: (.priorityColumn | column_name),
          high: (.priorityHigh | whole_text($label_limit)),
          medium: (.priorityMedium | whole_text($label_limit)),
          low: (.priorityLow | whole_text($label_limit)),
          due_column: (.dueColumn | column_name),
          owner_column: (.ownerColumn | column_name),
          team_column: (.teamColumn | column_name)
        }] as $entries
  | def number_ok: .board | test("\\A[0-9]{1,20}\\z");
    def team_ok: .team as $team | any($team_ids[]; . == $team);
  {
    chosen: ([$entries[] | select(number_ok and team_ok and .status_column != null)] | first_of_each("board")),
    problems: [$entries[]
      | if number_ok | not then "A board in Dashboard Settings has no usable board number, so it was skipped."
        elif team_ok | not then "Board \(.board) has no team that exists, so it was skipped."
        elif .status_column == null then "Board \(.board) has no status column, so it was skipped."
        else empty end]
  }' "$work/sanity.json" > "$work/chosen.json"

jq -r '.problems[]' "$work/chosen.json" >> "$work/errors.txt"

# Whether every board was read to its end. Only then can a task whose item has
# gone be taken off the screen, and the count of the day be kept.
complete=yes
if [ -s "$work/errors.txt" ]; then
  complete=no
fi

chosen=$(jq '.chosen | length' "$work/chosen.json")
echo "monday: $chosen board(s) chosen in Dashboard Settings"

# The boards the token can see, with their columns, and who the token belongs to
jq -n --arg query "$monday_query_boards" '{query: $query}' > "$work/body.json"
ask "$work/body.json" "$work/boards-answer.json"

if [ "$outcome" = ok ] && ! jq -e "$paths"'board_list | arrays' "$work/boards-answer.json" > /dev/null 2>&1; then
  outcome=failed
  problem "Monday sent no list of boards."
fi

boards_read=no
if [ "$outcome" = ok ]; then
  boards_read=yes
fi

: > "$work/rows.ndjson"
items_read=0

# Reads the items of the chosen boards, but only when the list of boards worked,
# because a token that does not work gets no answer to anything
if [ "$boards_read" = yes ] && [ "$chosen" -gt 0 ]; then
  jq -r '.chosen[].board' "$work/chosen.json" > "$work/board-list.txt"

  while read -r board; do
    jq -c --arg board "$board" '.chosen[] | select(.board == $board)' "$work/chosen.json" > "$work/config.json"
    jq -c '[.status_column, .priority_column, .due_column, .owner_column, .team_column] | map(select(. != null)) | unique' "$work/config.json" > "$work/columns.json"
    : > "$work/items.ndjson"
    cursor=""
    read_all=no
    capped=no

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
        break
      fi

      jq -c "$paths$page"'
        | page_items | .[] | objects
        | {
            id: (item_id | tostring),
            name: item_name,
            group: item_group,
            values: (((item_values | arrays) // []) | map(select(type == "object") | {key: (value_column | tostring), value: (value_text // "")}) | from_entries)
          }' "$work/page.json" >> "$work/items.ndjson"

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
      if [ "$(wc -l < "$work/items.ndjson" | tr -d ' ')" -ge "$items_per_board" ]; then
        capped=yes
        break
      fi
    done

    if [ "$capped" = yes ]; then
      problem "Board $board has more than $items_per_board items, so only the first $items_per_board were read."
    fi
    if [ "$read_all" = no ]; then
      complete=no
    fi

    head -n "$items_per_board" "$work/items.ndjson" > "$work/items-kept.ndjson"
    items_read=$((items_read + $(wc -l < "$work/items-kept.ndjson" | tr -d ' ')))

    # One row for each item: what the screen would show of it, and whether it is open.
    # Only the In progress and Done labels are looked for. Any other status, or none,
    # is Backlog, so an item is never left out for having a label nobody listed.
    jq -n -c --slurpfile config "$work/config.json" --slurpfile items "$work/items-kept.ndjson" \
      --argjson owners "$owners" --argjson title_limit "$title_limit" --argjson contact_limit "$contact_limit" "$helpers"'
      $config[0] as $c
      | def text_of($column): if $column == null then "" else (.values[$column] // "" | if type == "string" then plain else "" end) end;
        def is_label($text; $label): $label != "" and ($text | ascii_downcase) == ($label | ascii_downcase);
        $items[]
        | text_of($c.status_column) as $state
        | {
            id: (.id | if test("\\A[0-9]{1,20}\\z") then . else null end),
            title: (.name | whole_text($title_limit)),
            team_text: ((if $c.team_column == null then "" else text_of($c.team_column) end) as $named | if $named != "" then $named else (.group | if type == "string" then plain else "" end) end),
            team: $c.team,
            status: (if is_label($state; $c.progress) then "in-progress"
              elif is_label($state; $c.done) then "done"
              else "up-next" end),
            priority: (if $c.priority_column == null then null
              else (text_of($c.priority_column) as $given
                | if is_label($given; $c.high) then "high"
                  elif is_label($given; $c.medium) then "medium"
                  elif is_label($given; $c.low) then "low"
                  else null end) end),
            due: (if $c.due_column == null then null else (text_of($c.due_column) | due_date) end),
            contact: (if $owners and $c.owner_column != null then (text_of($c.owner_column) | first_name($contact_limit)) else null end),
            open: (is_label($state; $c.done) | not)
          }
        | select(.id != null and .title != "")' >> "$work/rows.ndjson"
  done < "$work/board-list.txt"
fi

echo "monday: $items_read item(s) read"

# What to send to Sanity, in groups of mutations. A task that is new is made and
# filled in by the same group, so a task is never left empty. A task that exists is
# only touched when it differs from what the item says, and the script never sends
# Show on TV, so an editor's choice stays. A task whose item has gone is switched
# off, never deleted.
plan='
def reference($id): {_type: "reference", _ref: $id};

# The Team lead whose name is the group or the team column of the item, or the one
# for items that match nobody
def subteam_of($row; $subteams):
  if $row.team_text == "" then $unmatched_id
  else (([$subteams[] | select((.name | if type == "string" then plain | ascii_downcase else "" end) == ($row.team_text | ascii_downcase))][0]._id) // $unmatched_id) end;

# What a task should be, with a null for each value it should not have
def wanted_task($row; $subteam):
  {title: $row.title, subteam: $subteam, team: $row.team, status: $row.status, priority: $row.priority, dueDate: $row.due, contact: $row.contact, show: true};

# What a task is now, in the same shape. A task with no Show on screen is on.
def stored_task:
  {title, subteam, team, status, priority, dueDate, contact, show: (if .show == false then false else true end)};

# The patch that brings a task to what it should be. A value it should not have is unset.
def patch_of($id; $task):
  {patch: ({
      id: $id,
      set: ({title: $task.title, subteam: reference($task.subteam), team: reference($task.team), status: $task.status, show: true}
        + (if $task.priority == null then {} else {priority: $task.priority} end)
        + (if $task.dueDate == null then {} else {dueDate: $task.dueDate} end)
        + (if $task.contact == null then {} else {contact: $task.contact} end))
    } + ([("priority", "dueDate", "contact") as $name | select($task[$name] == null) | $name] as $absent | if ($absent | length) == 0 then {} else {unset: $absent} end))};

$sanity[0].result as $found
| ($found.subteams | arrays | map(select(._id | type == "string"))) as $subteams
| ($found.tasks | arrays | map(select(._id | type == "string")) | map({key: ._id, value: .}) | from_entries) as $earlier
| ($rows | unique_by(.id)) as $wanted
| ($wanted | map(
    . as $row
    | ("task-monday-" + $row.id) as $id
    | {id: $id, row: $row, task: wanted_task($row; subteam_of($row; $subteams)), before: ($earlier[$id] // null)}
  )) as $pairs
| ($pairs | map(select(.before == null))) as $created
| ($pairs | map(select(.before != null and (.before | stored_task) != .task))) as $changed
| (if $complete == "yes"
    then ($pairs | map({key: .id, value: true}) | from_entries) as $kept
      | [$earlier | to_entries[] | .value | select(.show != false) | select($kept[._id] | not)]
    else [] end) as $gone
| {
    groups: (
      (if any($pairs[]; .task.subteam == $unmatched_id) and (any($subteams[]; ._id == $unmatched_id) | not)
        then [[{createIfNotExists: {_id: $unmatched_id, _type: "subteam", name: $unmatched_name, show: false}}]]
        else [] end)
      + ($created | map([{createIfNotExists: {_id: .id, _type: "task", source: "monday", mondayId: .row.id}}, patch_of(.id; .task)]))
      + ($changed | map([patch_of(.id; .task)]))
      + ($gone | map([{patch: {id: ._id, set: {show: false}}}]))
    ),
    tasks: ($wanted | length),
    created: ($created | length),
    changed: ($changed | length),
    hidden: ($gone | length)
  }
'

failed=0

if [ "$boards_read" = yes ] && [ "$chosen" -gt 0 ]; then
  jq -n --slurpfile sanity "$work/sanity.json" --slurpfile rows "$work/rows.ndjson" \
    --arg complete "$complete" --arg unmatched_id "$unmatched_id" --arg unmatched_name "$unmatched_name" \
    "$helpers$plan" > "$work/plan.json"

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

  echo "monday: $(jq -r '"\(.tasks) task(s) wanted, \(.created) new, \(.changed) changed, \(.hidden) switched off"' "$work/plan.json")"
fi

# The document that Studio reads to offer the boards and columns, and to say when
# the Mini last looked. The daily count is added only when every board was read to
# its end, so a run that missed a board cannot write a count that is too low.
status_document='
def snapshot_list($old):
  [$old | arrays | .[] | objects
    | select((.date | type) == "string" and (.date | test("\\A[0-9]{4}-[0-9]{2}-[0-9]{2}\\z")))
    | select((.open | type) == "number")
    | {_key: .date, date, open: (.open | floor)}];

def with_today($snapshots):
  (if $count_today then (($snapshots | map(select(.date != $today))) + [{_key: $today, date: $today, open: $open}]) else $snapshots end)
  | sort_by(.date) | .[(0 - $snapshots_kept):];

def kept_columns:
  [board_columns | arrays | .[] | objects
    | select((column_id | type) == "string" and (column_id | test("\\A[A-Za-z0-9_-]{1,50}\\z")))
    | {_key: column_id, id: column_id, title: (column_title | whole_text(60))}
      + (column_type | if type == "string" and test("\\A[a-z_]{1,40}\\z") then {type: .} else {} end)]
  | first_of_each("id") | .[0:$columns_kept];

def kept_boards:
  [board_list | arrays | .[] | objects | select(board_is_offered)
    | select((board_id | tostring) | test("\\A[0-9]{1,20}\\z"))
    | (board_id | tostring) as $id
    | {_key: $id, id: $id, name: (board_name | whole_text(60)), itemCount: (board_items | if type == "number" and . >= 0 then floor else 0 end), columns: kept_columns}]
  | first_of_each("id") | .[0:$boards_kept];

{
  _id: "monday-status",
  _type: "mondayStatus",
  connectedAs: (me_name | first_name(12)),
  lastSyncAt: $now,
  lastError: ([$errors | split("\n")[] | select(. != "")] | unique | if length == 0 then null else (.[0:3] | join("; ") | .[0:300]) end),
  boards: kept_boards,
  snapshots: with_today(snapshot_list($sanity[0].result.snapshots))
}
| with_entries(select(.value != null))
'

status_written=no

if [ "$boards_read" = yes ]; then
  count_today=false
  if [ "$complete" = yes ] && [ "$chosen" -gt 0 ]; then
    count_today=true
  fi
  open=$(jq -s '[.[] | select(.open)] | length' "$work/rows.ndjson")

  jq -n --slurpfile sanity "$work/sanity.json" --slurpfile answer "$work/boards-answer.json" \
    --rawfile errors "$work/errors.txt" --arg now "$now_iso" --arg today "$today" \
    --argjson count_today "$count_today" --argjson open "$open" \
    --argjson boards_kept "$boards_kept" --argjson columns_kept "$columns_kept" --argjson snapshots_kept "$snapshots_kept" \
    "$paths$helpers"'$answer[0] | '"$status_document" > "$work/status.json"
  jq '{mutations: [{createOrReplace: .}]}' "$work/status.json" > "$work/write.json"
else
  # Monday did not answer, so what the last good run wrote is kept, and only the
  # reason is added to it
  jq -n --rawfile errors "$work/errors.txt" \
    '{mutations: [
        {createIfNotExists: {_id: "monday-status", _type: "mondayStatus"}},
        {patch: {id: "monday-status", set: {lastError: ([$errors | split("\n")[] | select(. != "")] | unique | .[0:3] | join("; ") | .[0:300])}}}
      ]}' > "$work/write.json"
fi

if write_to_sanity "$work/write.json"; then
  status_written=yes
  echo "monday: status written"
else
  failed=1
fi

# The time of this run goes to status-mini, when Monday answered and the status
# could be written. status-write.sh never stops this script.
if [ "$boards_read" = yes ] && [ "$status_written" = yes ]; then
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
