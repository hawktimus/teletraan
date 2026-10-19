# Read by monday-sync.sh, never run. Where Monday and Sanity answers are read, the limits, and the question to Sanity.
# Everything that depends on how Monday writes its answers is in this block: the
# address, the version, the questions, and where each value sits in an answer. If
# Monday changes something, correct the line here and nowhere else. The questions use
# typed fragments, because a plain question for the values of columns gave empty values for status,
# date and relation columns (docs/monday.md, "If an answer looks different").
monday_address='https://api.monday.com/v2'
# Multi-level boards (hierarchy_type multi_level) leave status columns out of column_values unless the question asks
# for capabilities: [CALCULATED], and then answer them as BatteryValue. Tried by hand against the team's own board
# with a status, department, team and Show on TV column; if Settings, Monday debug shows empty values again, this block
# is where to look.
monday_version='2026-01'

# Who the token belongs to
monday_query_me='query { me { name } }'

# Who the token belongs to, and the boards it can see with their columns. It is asked for on the
# first read of a day, and when the Teletraan computer has no list yet, so the pickers of the Monday tab have it.
monday_query_boards='query { me { name } boards(limit: 100, state: active, order_by: used_at) { id name type hierarchy_type items_count columns { id title type } } }'

# The first page of the parent items of one board, and the pages after it. $columns lists the
# columns that are read. Subitems are not asked for, and an item with a parent is left out.
monday_query_items='query ($board: [ID!], $columns: [String!], $limit: Int) { boards(ids: $board) { name items_page(limit: $limit) { cursor items { id name parent_item { id } column_values(ids: $columns) { id type text ... on StatusValue { label index } ... on BoardRelationValue { linked_item_ids } ... on DateValue { date } ... on TimelineValue { from to } ... on PeopleValue { persons_and_teams { id } } } } } } }'
monday_query_more='query ($cursor: String!, $columns: [String!], $limit: Int) { next_items_page(limit: $limit, cursor: $cursor) { cursor items { id name parent_item { id } column_values(ids: $columns) { id type text ... on StatusValue { label index } ... on BoardRelationValue { linked_item_ids } ... on DateValue { date } ... on TimelineValue { from to } ... on PeopleValue { persons_and_teams { id } } } } } }'

# The same two questions for a multi-level board. A status column of such a board has no StatusValue: it
# answers BatteryValue, a list of { key, count } where key is the index of a label as text. The labels of the
# columns come with the first page, because a key alone does not say Hide or Show.
monday_query_items_multi='query ($board: [ID!], $columns: [String!], $limit: Int) { boards(ids: $board) { name columns(ids: $columns) { id settings_str } items_page(limit: $limit) { cursor items { id name parent_item { id } column_values(ids: $columns, capabilities: [CALCULATED]) { id type text ... on StatusValue { label index } ... on BatteryValue { battery_value { key count } } ... on BoardRelationValue { linked_item_ids } ... on DateValue { date } ... on TimelineValue { from to } ... on PeopleValue { persons_and_teams { id } } } } } } }'
monday_query_more_multi='query ($cursor: String!, $columns: [String!], $limit: Int) { next_items_page(limit: $limit, cursor: $cursor) { cursor items { id name parent_item { id } column_values(ids: $columns, capabilities: [CALCULATED]) { id type text ... on StatusValue { label index } ... on BatteryValue { battery_value { key count } } ... on BoardRelationValue { linked_item_ids } ... on DateValue { date } ... on TimelineValue { from to } ... on PeopleValue { persons_and_teams { id } } } } } }'

# The question of monday-sync.sh --debug: the first two items of one board with every column, in the typed shape
monday_query_debug='query ($board: [ID!]) { boards(ids: $board) { name hierarchy_type items_page(limit: 2) { items { id name parent_item { id } column_values { id type text ... on StatusValue { label index } ... on BatteryValue { battery_value { key count } } ... on BoardRelationValue { linked_item_ids } ... on DateValue { date } ... on TimelineValue { from to } ... on PeopleValue { persons_and_teams { id } } } } } } }'

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
def board_hierarchy: (.hierarchy_type? | if . == "multi_level" then "multi_level" else "classic" end);
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
def first_board: (.data.boards[0]? // null);
def first_items: (((first_page | page_items | arrays) // [])[0:2]);
def board_kind: (.hierarchy_type? // null);
def value_type: .type;
def value_column: .id;
def value_text: .text;
def value_label: .label?;
def value_index: .index?;
def value_linked: .linked_item_ids?;
def value_date: .date?;
def value_from: .from?;
def value_to: .to?;
def board_labels: ([.data.boards[0].columns[]? | objects | select(.id | type == "string") | {key: .id, value: ((.settings_str | if type == "string" then (try fromjson catch {}) else {} end) | (.labels? | if type == "object" then . else {} end))}] | from_entries);
def value_battery: ((.battery_value? | if type == "array" then . elif type == "object" then [.] else [] end) | map(select(type == "object" and ((.key | tostring) | test("\\A[0-9]{1,6}\\z")))) | sort_by(-(.count | if type == "number" then . else 0 end)) | .[0].key? // null);
def error_messages: [(.errors[]?.message?), .error_message?] | map(strings);
'

# What the Monday tab says when it says nothing: the boards, columns and index tables of the
# rebuilt workspace (docs/monday.md). It is the same data as mondayTaskBoard, mondayMilestoneBoard and
# mondayEveryMinutes in defaultSettings in dashboard/config.js, with a team written as its document id,
# and tests/monday-sync.test.mjs fails if they differ. An index is the contract and a label is not,
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

# What the settings say, the teams, the Team leads, what the Teletraan computer wrote earlier and what it
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
  "readings": *[_id == "monday-status"][0].readings[] { boardId, boardName, itemsRead, readAt, note },
  "listed": *[_id == "monday-status"][0].boards[] { id, hierarchy }
}'
