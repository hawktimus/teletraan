#!/bin/bash
# Usage: monday-sync.sh [--check]
# Reads the two Monday boards that the Monday tab of Dashboard Settings names (the task
# board and the milestones board) and writes their items into Sanity: a task for each
# parent item (published documents with the ids task-monday-<item number>) and a
# milestone for each milestone (milestone-monday-<item number>). It also writes the
# document monday-status, which the Monday tab uses to offer the boards and their columns
# and to say what was read. Needs curl and jq (docs/rebuilding-the-computer.md, step 18, and
# docs/monday.md).
#
#   monday-sync.sh           one run, which the timer starts every 5 minutes. The run reads
#                            Monday only when the last read is older than "How often" on the
#                            Monday tab, and otherwise ends without a word
#   monday-sync.sh --check   asks Monday who the token belongs to, and writes nothing
#   monday-sync.sh --debug <board number>
#                            prints how Monday answers for the first two items of one board
#                            (no token, no names of people), and writes nothing
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

# Nothing else is working while this run holds the lock, so a work folder that
# is still here was left by a run that a power cut or a reboot stopped
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
# first read of a day and when the Teletraan computer has no list yet, and is one of the requests of the run.
boards_listed=no
# Also when the list kept in Sanity was written before boards carried their kind, or does not hold the board the settings
# name: a list kept for the day would otherwise stay wrong after an update or a change of token.
if [ "$calls_before" -eq 0 ] || [ "$(jq -r '.result.known.boards // 0' "$work/sanity.json")" -eq 0 ] \
  || [ "$(jq -r '.result.known.unmarked // 0' "$work/sanity.json")" -gt 0 ] \
  || { [ -n "$task_board" ] && jq -e --arg id "$task_board" '(.result.known.boardIds // null) | if . == null then false else (index($id) | not) end' "$work/sanity.json" > /dev/null 2>&1; }; then
  jq -n --arg query "$monday_query_boards" '{query: $query}' > "$work/body.json"
  ask "$work/body.json" "$work/boards-answer.json"
  if [ "$outcome" = ok ] && jq -e "$paths"'board_list | arrays' "$work/boards-answer.json" > /dev/null 2>&1; then
    boards_listed=yes
  elif [ "$outcome" = ok ]; then
    problem "Monday sent no list of boards."
  fi
fi

: > "$work/readings.ndjson"


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

# Items came but none could be placed on a department: the usual cause is a multi-level board that was read as a
# classic one, whose status columns then come back empty
if [ "$task_usable" = yes ] && [ -s "$work/task-rows.ndjson" ] && [ "$(jq -s '[.[] | select(.hidden == "")] | length' "$work/task-rows.ndjson")" -eq 0 ]; then
  problem "No task from the task board has a Department. If it is a multi-level board, press Monday debug on the control page (Settings, Monday) and send the answer to a coach."
fi

echo "monday: $(wc -l < "$work/task-rows.ndjson" | tr -d ' ') task(s) and $(wc -l < "$work/milestone-rows.ndjson" | tr -d ' ') milestone(s) read"


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
  "$computer/scripts/status-write.sh" monday || true
fi

# What went wrong is also in the status, for Studio. Here it is for the journal.
if [ -s "$work/errors.txt" ]; then
  while read -r line; do
    echo "monday: $line" >&2
  done < "$work/errors.txt"
  failed=1
fi
exit "$failed"
