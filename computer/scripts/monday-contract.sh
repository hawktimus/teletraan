# Read by monday-sync.sh, never run. The two boards, their columns and labels, the questions to Monday,
# where each value sits in an answer, the limits, and the question to Sanity.
#
# Everything that depends on how Monday is set up or how it answers is in this file. If a board, a
# column or a label changes in Monday, correct the line here and nowhere else (docs/monday.md).
monday_address='https://api.monday.com/v2'
monday_version='2026-01'

# The two boards. Both are multi-level: a task is a parent item and its steps are subitems, which are
# never read. Completed Tasks has the same column ids as Robotics Tasks, and no Department column.
task_board='18435126893'
done_board='18435131682'

# The columns read, by id. Completed Tasks has no Department, Date Completed or Show on TV? column, so
# fewer of them are asked for there.
columns='{
  "department": "color_mm82nvea",
  "status": "color_mkv6tatz",
  "team": "color_mm82jgxg",
  "assigned": "multiple_person_mm82cqbx",
  "priority": "color_mm82wfy",
  "timeline": "timerange_mkyp8kx7",
  "hours": "numeric_mm82pw1a",
  "completed": "date_mm82kn5v",
  "show": "color_mm83p12x"
}'
task_board_columns='["department", "status", "team", "assigned", "priority", "timeline", "hours", "completed", "show"]'
done_board_columns='["status", "team", "assigned", "priority", "timeline", "hours"]'

# What each label number means. Students rename labels, so the number of a label is read and never
# its words. A number that is not in a table means: Status To Do, Team General, Priority none, Show on TV
# Show, and no department. The nine departments are also the group names of the boards.
labels='{
  "status": {"5": "up-next", "0": "in-progress", "1": "done", "2": "blocked", "3": "in-review"},
  "team": {"1": "prime", "0": "nova", "5": ""},
  "priority": {"2": "high", "0": "medium", "1": "low"},
  "hide": ["2"],
  "department": {"0": "electrical", "1": "build", "2": "programming", "3": "design", "4": "cnc", "6": "strategy", "7": "business", "8": "marketing", "9": "operations"},
  "departments": ["build", "electrical", "programming", "design", "cnc", "strategy", "operations", "business", "marketing"]
}'

# Who the token belongs to (--check)
monday_query_me='query { me { name } }'

# The first page of the items of one board, and the pages after it. A status column of a multi-level board
# answers only when the question asks for capabilities: [CALCULATED], and then as BatteryValue: a list of
# { key, count } where key is the number of a label as text. A people column gives the ids of the people,
# and their names come from a third question (monday_query_users).
item_fields='id name parent_item { id } group { id title } column_values(ids: $columns, capabilities: [CALCULATED]) { id type text ... on StatusValue { index } ... on BatteryValue { battery_value { key count } } ... on DateValue { date } ... on TimelineValue { from to } ... on PeopleValue { persons_and_teams { id kind } } }'
monday_query_items="query (\$board: [ID!], \$columns: [String!], \$limit: Int) { boards(ids: \$board) { name items_page(limit: \$limit) { cursor items { $item_fields } } } }"
monday_query_more="query (\$cursor: String!, \$columns: [String!], \$limit: Int) { next_items_page(limit: \$limit, cursor: \$cursor) { cursor items { $item_fields } } }"

# The names of the people a run found in Assigned. Only the first word of a name is ever kept.
monday_query_users='query ($ids: [ID!]) { users(ids: $ids, limit: 200) { id name } }'

# The question of monday-sync.sh --debug: the first two items of one board with every column
monday_query_debug='query ($board: [ID!]) { boards(ids: $board) { name hierarchy_type items_page(limit: 2) { items { id name parent_item { id } group { id title } column_values(capabilities: [CALCULATED]) { id type text ... on StatusValue { index } ... on BatteryValue { battery_value { key count } } ... on DateValue { date } ... on TimelineValue { from to } ... on PeopleValue { persons_and_teams { id kind } } } } } } }'

# Where each value sits in an answer, as jq functions. Each one is given the part of the answer it
# belongs to: the answer, a page, an item or one value of an item.
paths='
def me_name: (.data.me.name? // null);
def first_page: .data.boards[0].items_page;
def first_board_name: (.data.boards[0].name? // null);
def more_page: .data.next_items_page;
def page_cursor: .cursor;
def page_items: .items;
def item_id: .id;
def item_name: .name;
def item_parent: (.parent_item.id? // null);
def item_group: (.group.title? | strings);
def item_values: .column_values;
def value_column: .id;
def value_type: .type;
def value_text: .text;
def value_index: .index?;
def value_date: .date?;
def value_from: .from?;
def value_to: .to?;
# The ids of the people of a people column, people only (a team is left out)
def value_people: [(.persons_and_teams? // [])[]? | objects | select((.kind // "person") == "person") | .id | tostring];
# The label of a status column: its index, or for a multi-level board the key that most subitems carry
def value_battery: ((.battery_value? | if type == "array" then . elif type == "object" then [.] else [] end) | map(select(type == "object" and ((.key | tostring) | test("\\A[0-9]{1,6}\\z")))) | sort_by(-(.count | if type == "number" then . else 0 end)) | .[0].key? // null);
def users_list: (.data.users? // []);
def user_id: (.id | tostring);
def user_name: .name;
def first_board: (.data.boards[0]? // null);
def first_items: (((first_page | page_items | arrays) // [])[0:2]);
def board_kind: (.hierarchy_type? // null);
def error_messages: [(.errors[]?.message?), .error_message?] | map(strings);
'

# The longest project name (studio/schemas/task.js) and the longest first name
title_limit=40
contact_limit=12

# Items asked for in one page, and requests to Monday in one run: a page or two of each board and the
# names. A run that reaches the limit stops, says so, and deletes nothing.
page_size=200
max_requests=10

# The reads of Monday in one day (kiosk time zone). Past this the script waits for midnight. The free plan
# allows about 1,000.
daily_limit=900
daily_limit_message='Daily read limit reached. Reads start again at midnight.'

# The timer wakes the script every 5 minutes, and a run ends a little after the minute it was written, so a
# read that is this many seconds short of the setting still counts as due
slack_seconds=90

# Daily counts of open tasks kept in monday-status
snapshots_kept=120

# Rows (a row is a task) sent to Sanity in one request
rows_per_write=100

# The time zone of the screen is the one on the Look page. This is used until Sanity has been asked.
default_zone=America/New_York

# The read interval, 5 to 120 minutes, and the starting value
every_default=30

# What the Teletraan computer needs from Sanity: the time zone, the read interval, the teams and Team leads,
# the tasks it wrote earlier and what it knows of its own last read. The dataset is public, so no token is
# sent. The ordinary host is used and not the cached one, because the answer must be the newest.
query='{
  "zone": *[_id == "theme"][0].timeZone,
  "every": *[_id == "dashboardSettings"][0].mondayEveryMinutes,
  "teams": *[_type == "team" && !(_id in path("drafts.**"))] { _id, code },
  "subteams": *[_type == "subteam" && !(_id in path("drafts.**"))] { _id, name },
  "tasks": *[_type == "task" && source == "monday" && !(_id in path("drafts.**"))] {
    _id, title, department, list, status, "team": team._ref, "subteam": subteam._ref, contact, priority,
    startDate, dueDate, completedOn, estHours, showOnBoard, show, mondayBoardId, mondayBoardName,
    "old": defined(owners) || defined(milestoneIds) || defined(hiddenReason)
  },
  "known": *[_id == "monday-status"][0] { lastSyncAt, callsToday, callsDate },
  "snapshots": *[_id == "monday-status"][0].snapshots[] { date, open },
  "readings": *[_id == "monday-status"][0].readings[] { boardId, boardName, itemsRead, readAt, note }
}'
