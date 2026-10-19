# Read by monday-sync.sh, never run. The jq programs that turn the items into tasks and decide what is
# sent to Sanity. tests/monday-sync.test.mjs runs them on made-up answers.

# One row for each parent item of a board: what the screen shows of it. It is run once for each board with
#   $items     the items of the board (read_board in monday-requests.sh)
#   $board     the board number, and $done "yes" for Completed Tasks
#   $names     the first names of the people, by id
#   $labels    the label tables of monday-contract.sh, and the column ids as $columns
# The department is the group when the group is one of the nine departments, and the Department column
# otherwise (the Done group, a group with another name). An item with no department is left out.
task_rows='
def value_of($column): (.values[$column] // {});
def meaning($table; $column): ($labels[$table][(value_of($column).index // "") | tostring] // null);
def department_named: (if type == "string" then plain | ascii_downcase else "" end) as $text | if ($labels.departments | index([$text])) != null then $text else null end;
$items[]
| select(.parent == null)
| (.group | department_named) as $from_group
| ($from_group // meaning("department"; $columns.department)) as $department
| (meaning("status"; $columns.status) // "up-next") as $status
| (value_of($columns.timeline)) as $timeline
| ([($timeline.text // "") | scan("(?<![0-9])(?:19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}(?![0-9])") | select(real_day)]) as $text_days
| (value_of($columns.hours).text | if type == "string" then (gsub(","; "") | try tonumber catch null) else null end) as $hours
| (value_of($columns.assigned)) as $assigned
| (($assigned.people // [])[0]) as $first
| ((value_of($columns.show).index // "") | tostring) as $show
| {
    id: (.id | if test("\\A[0-9]{1,20}\\z") then . else null end),
    title: (.name | whole_text($title_limit)),
    department: $department,
    list: (if $status == "done" or ((.group | if type == "string" then plain | ascii_downcase else "" end) == "done") or $done == "yes" then "done" else "open" end),
    status: $status,
    team: (meaning("team"; $columns.team) // ""),
    contact: ((if $first == null then null else $names[$first] end) // ($assigned.text | first_name($contact_limit))),
    priority: meaning("priority"; $columns.priority),
    startDate: (($timeline.from | day_of) // $text_days[0]),
    dueDate: (($timeline.to | day_of) // $text_days[-1:][0]),
    completedOn: (value_of($columns.completed) | (.date | day_of) // (.text | day_of)),
    estHours: (if ($hours | type) == "number" and $hours >= 0 and $hours < 100000 then ($hours * 100 | round / 100) else null end),
    showOnBoard: (($labels.hide | index([$show])) == null),
    board: $board
  }
| select(.id != null and .title != "" and .department != null)
'

# What to send to Sanity, in groups of mutations. A task that is new is made and filled in by the same
# group, so it is never left empty. One that exists is only touched when it differs from what the item
# says. The script never sends Show on TV (showOnTv), so an editor choice stays. When both boards were read
# to the end, a task whose item has gone is deleted, and its draft with it.
plan='
def reference($id): {_type: "reference", _ref: $id};

# The team document of a team code, and the Team lead with the name of the department
def team_id($code): if $code == "" then null else ([$found.teams[]? | objects | select(.code == $code) | ._id][0] // null) end;
def subteam_id($department): ([$found.subteams[]? | objects | select((.name | if type == "string" then plain | ascii_downcase else "" end) == $department) | ._id][0] // null);
def board_name($id): ([$readings[] | select(.board == $id) | .name][0] // "" | if . == "" then null else . end);

# What a task should be, with a null for each value it should not have. The last three are fields of the
# older sync, which the screen no longer reads.
def wanted_task($row):
  {
    title: $row.title,
    department: $row.department,
    list: $row.list,
    status: $row.status,
    team: team_id($row.team),
    subteam: subteam_id($row.department),
    contact: $row.contact,
    priority: $row.priority,
    startDate: $row.startDate,
    dueDate: $row.dueDate,
    completedOn: $row.completedOn,
    estHours: $row.estHours,
    showOnBoard: $row.showOnBoard,
    show: true,
    mondayBoardId: $row.board,
    mondayBoardName: board_name($row.board)
  };

def stored_task:
  {title, department, list, status, team, subteam, contact, priority, startDate, dueDate, completedOn, estHours, showOnBoard,
   show: (if .show == false then false else true end), mondayBoardId, mondayBoardName};

def older_fields: {owners: null, milestoneIds: null, hiddenReason: null};

# The patch that brings a document to what it should be. A value it should not have is unset.
def patch_of($id; $doc):
  {patch: ({
      id: $id,
      set: ($doc | with_entries(select(.value != null)) | if has("subteam") then .subteam |= reference(.) else . end | if has("team") then .team |= reference(.) else . end)
    } + ([$doc | to_entries[] | select(.value == null) | .key] as $absent | if ($absent | length) == 0 then {} else {unset: $absent} end))};

($found.tasks | arrays | map(select(._id | type == "string")) | map({key: ._id, value: .}) | from_entries) as $earlier
| ($rows | unique_by(.id) | map(. as $row | ("task-monday-" + $row.id) as $id | {id: $id, row: $row, task: wanted_task($row), before: ($earlier[$id] // null)})) as $pairs
| ($pairs | map(select(.before == null))) as $created
| ($pairs | map(select(.before != null and ((.before | stored_task) != .task or .before.old == true)))) as $changed
| (if $complete == "yes"
    then ($pairs | map({key: .id, value: true}) | from_entries) as $kept
      | [$earlier | keys[] | select(startswith("task-monday-")) | select($kept[.] | not)]
    else [] end) as $gone
| {
    groups: (
      ($created | map([{createIfNotExists: {_id: .id, _type: "task", source: "monday", mondayId: .row.id}}, patch_of(.id; .task)]))
      + ($changed | map([patch_of(.id; .task + older_fields)]))
      + ($gone | map([{delete: {id: .}}, {delete: {id: ("drafts." + .)}}]))
    ),
    tasks: ($pairs | length),
    created: ($created | length),
    changed: ($changed | length),
    deleted: ($gone | length)
  }
'

# The patch of monday-status: when the boards were last read, what went wrong in plain words, the reads
# used today, what was read from each board, the open and done tasks of each department and one count of
# open tasks a day. A board that stopped half way keeps the reading of the run before, with the reason.
# The board list of the older sync is taken out, because the dataset is public.
status_patch='
def snapshot_list($old):
  [$old | arrays | .[] | objects
    | select((.date | type) == "string" and (.date | test("\\A[0-9]{4}-[0-9]{2}-[0-9]{2}\\z")))
    | select((.open | type) == "number")
    | {_key: .date, date, open: (.open | floor)}];

def with_today($snapshots; $open):
  ($snapshots | map(select(.date != $today))) + [{_key: $today, date: $today, open: $open}]
  | sort_by(.date) | .[(0 - $snapshots_kept):];

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

def department_counts:
  ($rows | unique_by(.id) | map(select(.showOnBoard))) as $shown
  | [$labels.departments[] as $name
      | {_key: $name, name: $name,
         open: ($shown | map(select(.department == $name and .list == "open")) | length),
         done: ($shown | map(select(.department == $name and .list == "done")) | length)}];

([$errors | split("\n")[] | select(. != "")] | unique | if length == 0 then null else (.[0:3] | join(" ") | .[0:300]) end) as $error
| ($rows | unique_by(.id) | map(select(.showOnBoard and .list == "open")) | length) as $open
| {
    set: ({
        callsToday: $calls,
        callsDate: $today,
        readings: reading_list($sanity[0].result.readings)
      }
      + (if $complete == "yes" then {
          lastSyncAt: $now,
          taskCount: ($rows | unique_by(.id) | length),
          departments: department_counts,
          snapshots: with_today(snapshot_list($sanity[0].result.snapshots); $open)
        } else {} end)
      + (if $error == null then {} else {lastError: $error} end)),
    unset: (["boards", "hiddenUnassigned", "connectedAs"] + (if $error == null then ["lastError"] else [] end))
  }
'
