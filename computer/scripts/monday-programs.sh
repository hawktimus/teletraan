# Read by monday-sync.sh, never run. The jq programs that decide what is sent to Sanity.
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

# The patch of the document that Studio reads to offer the boards and columns, and to say when
# the Teletraan computer last looked and how many reads it has used today. The daily count is added only when
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
    | {_key: $id, id: $id, name: (board_name | whole_text(60)), hierarchy: board_hierarchy, itemCount: (board_items | if type == "number" and . >= 0 then floor else 0 end), columns: kept_columns}]
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
