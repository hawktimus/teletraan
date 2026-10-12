# Monday board

For the coaches and the students who look after the Mini. The Mini reads the
team's Monday boards and keeps their items in Sanity as tasks, so the screen can
show what is in the backlog, what is being worked on and what is done. This page says
what it reads, what it writes, how often, how to set it up, what happens when an
item is deleted, and what to do when it stops or nothing shows up. The three cards
that draw the tasks on the screen are described in docs/layouts.md, "The Monday cards".

None of it has been tried against the live Monday service. The address, the
questions and the places in the answers were written from the public documentation
of Monday and the tests use made-up answers. If one is wrong, see "If an answer
looks different" below.

## What it reads

Monday, with the token of one account:

- the boards the account can see: number, name, how many items, and the id, title
  and type of each column. Sub item boards and documents are left out
- for each board named in Dashboard Settings, Monday tab: each item's name, the
  title of the group it is in, and the cells of the columns that the entry names
  (priority, due date, owner and subteam, and the status when the entry reads it from
  a column)

At most 500 items are read from a board, 100 at a time. At most 60 requests are
made to Monday in one run. The questions to Monday are in one block at the top of
`deploy/scripts/monday-sync.sh`.

Sanity, without a login, because the dataset is public: the Monday tab of Dashboard
Settings, the teams, the Team leads, the tasks that came from Monday earlier and the
daily counts kept in `monday-status`.

## What it writes

Tasks. Each item becomes one published task with the id `task-monday-` and the
item's number. Its fields:

- `title`: the item's name, cut at 22 characters, the most a task name can have
- `status`: the status of the item, as the board entry reads it (see "How the status is
  read" below). `in-progress` and `done` are what they say, and `up-next` is what the
  screen calls Backlog. No item is left out for having a status nobody listed. Blocked is
  never written
- `priority`: `high`, `medium` or `low` from the priority labels, or nothing
- `dueDate`: the day of the due date column, or nothing. A date column gives its day,
  and a timeline column gives its end day. A day and a time give the day, and a date
  that is not on the calendar gives nothing
- `contact`: the first name of the first owner, at most 12 characters, only when
  Show owner first names on the TV is on. Nothing else about a person is kept
- `subteam`: the Team lead whose name is the name of the board, capitals and spaces
  ignored, when the entry reads group names, because the groups are statuses then. When
  the entry reads a status column, it is the Team lead whose name is the name of the
  item's group. With a subteam column chosen, the name in that column is used instead, and
  the board or group when the cell is empty. An item that matches nobody goes to a Team
  lead called [Unmatched], which the script makes once, with the id `subteam-unmatched`,
  and switches off on the screen
- `team`: the team of the board entry. An entry with no team makes tasks with no team, which
  show for both teams
- `mondayBoardId` and `mondayBoardName`: the number and the name of the board, which
  Monday Tasks sorts by and Monday Boards uses to list the tasks of one board
- `show`: on. `source` is `monday` and `mondayId` is the item's number

The script never writes Show on TV (`showOnTv`). A task that has it keeps what an
editor chose, and a new task has none, which means on. A task is only written when
it differs from what the item says, so an item that did not change is not touched.

The document `monday-status` (type `mondayStatus`), which the Monday tab reads:

- `connectedAs`: the first name of the account the token belongs to
- `lastSyncAt` and `lastError`: when the Mini last read Monday, and what went wrong
  in plain words, or nothing
- `boards`: every board the account can see, with its number, name, item count and
  columns, whether or not it is named in Dashboard Settings. This is what the
  Monday tab offers in its lists, and what the Monday Boards page lists
- `readings`: one entry for each board named in Dashboard Settings, with its number, its
  name, how many items the Mini read from it, when, and a note that says why when a
  board gave no items or fewer than it has. A board the token cannot see, or whose number
  is wrong, is read as 0 items with the note. A board that stopped half way keeps the
  number and the time of the run before it and only gets the note. The connection block
  and the Monday Boards page show them
- `snapshots`: one count a day of the items that are not done, over the boards named
  in Dashboard Settings, 120 days at most. A day's count is made only when every board
  was read to its end

The Mini also writes the time of each run that worked into `status-mini`, with
`status-write.sh monday`, which the status block shows.

The script keeps nothing on the Mini but a lock file, `monday/.lock` in the data folder.
Sanity is its memory: the tasks it made before and the daily counts are read back at the
start of every run.

## How the status is read

Each board entry has Status comes from, with two choices. It starts as Group names, and an
entry saved before the choice existed reads group names too.

- Group names. The title of the group the item is in gives the status. Capitals, spaces
  and punctuation do not matter, so `To-Do` and `to do` are the same. In progress, working on
  it, doing and started give In progress. Done, complete, completed and finished give Done.
  To do, todo, backlog, not started and planned give Backlog, and so does every other
  title. The entry needs no status column and has no labels to set. The groups of a board
  are the statuses, so the subteam of its tasks comes from the name of the board, or
  from the subteam column when one is chosen.
- A status column. The cell of that column gives the status. The In progress label gives
  In progress, the Done label gives Done, and every other status is Backlog. The
  entry needs the column. The Backlog label is hidden and ignored.

The lists of columns in an entry show only the columns of the board picked in that entry,
each with its type in words, the ones that fit the field under Fits and the others under
Other. When the board is changed, the columns of the entry are cleared. If the Mini has not
listed the columns of a board yet, the list says to wait for the next sync.

## When an item goes

The script never deletes a task. A task whose item is no longer there is switched off:
its `show` goes off and it moves to the Hidden list under Monday Tasks. If the item comes
back, so does the task. This happens only when every board was read to its end in that
run. A run that missed a board, or stopped at 500 items or at 60 requests, switches
nothing off. An item that changes to a status nobody listed is not gone: it becomes
Backlog.

Taking a board out of the list in Dashboard Settings switches its tasks off at the
next run, because their items are no longer read. If the list is empty, or the page
has no list at all, the script only writes `monday-status` and leaves the tasks as they
were. Switch them off by hand with Show on TV, or put the board back.

The first run brings in every item on the board, finished ones too. A finished task
stays on the Tasks panel for the number of days in Days finished tasks stay (Screen
tab), counted from when the script made or last changed it.

## The dataset is public

Anyone can ask Sanity for these documents, because the dataset is public:

- the names of the tasks, and the first names of owners when the owner switch is on
- the name of every board the account can see, the titles and types of their columns
  and their item counts, including the boards the screen does not read
- the first name of the account

Use a Monday account that can see only the team's boards, and leave Show owner first
names on the TV off unless students and parents have agreed to it. The token is never
written in any document or file.

## The keys

- `MONDAY_API_TOKEN` in `deploy/local.env` on the Mini. Monday wants it in a header on
  every request. The script hands it to curl on standard input, so it never shows in
  the process list, and it is never printed or saved. How to make one: below, and
  docs/rebuilding-the-mini.md, step 18.
- `SANITY_WRITE_TOKEN` in the same file, the one the status block uses
  (docs/rebuilding-the-mini.md, "Showing what the Mini did in Studio").

Without either the script does nothing, says so in one line, and ends without an
error, so the service does not show as failed.

## When it runs

`teletraan-monday.timer` starts the script 2 minutes after the Mini boots and then
every 10 minutes after the end of the last run. A run that finds the last one still
going stops at once.

## Setting it up

1. Make the token. In Monday, click your picture at the top right, open Developers,
   then My access tokens, and copy the token. The menus have been named a little
   differently over time. It needs the team mentor's yes, and the account it belongs
   to should see only the team's boards.
2. Add it to `local.env` on the Mini, in single quotes, on its own line
   (docs/rebuilding-the-mini.md, step 18).
3. Install the timer with `install-monday.sh`, and try the token with
   `monday-sync.sh --check`.
4. Wait 10 minutes. Open Dashboard Settings in Studio, Monday tab. The block at the
   top says who the token belongs to, when the Mini last read Monday, how many boards
   are chosen and how many tasks the Mini has made. Until then it says No connection
   yet. Monday Boards, under TASKS in the sidebar, lists the boards the token can see.
5. Add an entry under Boards. Pick the board by name, pick the team (leave it blank when the board is for both teams), and choose where the
   status comes from. Group names is the starting choice: the group an item is in, such as
   To Do, In Progress or Done, gives its status. For A status column, pick the column, and
   change the two labels, which start as Working on it and Done, to the words the board uses.
   Every other status is Backlog. The priority column, the due date column, the owner
   column and the subteam column are optional. The lists show the columns of the board you
   picked. If a list cannot be read, the box is a plain one: type the board number, which is
   in the address of the board in Monday, or the column id, which Monday shows in the
   settings of the column. The block at the top then has a line for each entry: the
   items the Mini read, the tasks on the TV and when it last read the board.
6. Click Publish. Within 10 minutes the tasks are in Monday Tasks, On the TV. Turn Show
   on TV off on a row to keep it off the screen. Monday Boards, under TASKS in the
   sidebar, lists every board the token can see and which ones are chosen.

Up to 10 boards can be read. An entry needs its board, and its status column when the
status comes from a column. Its team is optional. An entry that is missing a board or a
column it needs is skipped, and the last error says which. An entry that names a team
that does not exist is skipped too.

## Trying it

On the Mini:

    /opt/teletraan/deploy/scripts/monday-sync.sh --check
    /opt/teletraan/deploy/scripts/monday-sync.sh

`--check` asks Monday who the token belongs to and writes nothing. The second line is
one run, whatever the time. It prints how many boards are chosen, how many items it
read, how many tasks it made, changed or switched off, and `monday: status written`.
The journal has the same lines:

    sudo journalctl -u teletraan-monday.service -n 30

## If nothing shows up

Go down the list. Each step rules out one cause.

1. The connection block says connected. Open Dashboard Settings, Monday tab. Connected
   as shows a first name, and Last sync shows a recent time. If it says No connection
   yet, the token is not in `local.env` on the Mini or the timer is not installed
   (Setting it up, steps 2 and 3).
2. A board is chosen. Boards chosen in the block is not None. Under Boards, an entry
   needs a board, and its Status column when the status comes from a column. The team is
   optional.
   With no entry the block says "No board is chosen yet, so the Mini writes no tasks",
   and the Mini only writes the list of boards. Click Publish after you add the entry,
   because the Mini reads the published settings. A line under the block for the entry
   shows 0 items read and a reason when the board number is wrong or the token cannot
   see the board.
3. Wait 10 minutes. The Mini reads the boards 10 minutes after its last run, and Last
   sync shows when that was.
4. Look under Monday Tasks, On the TV. Tasks from the board in the connection block counts
   them.
5. Look at the Show on TV switch of each row. A task with Show on TV off is in the
   list but not on the TV, and the Mini never changes that switch.
6. On the Mini, run the line below and read the last lines. A line that starts with
   `monday:` says how many boards are chosen, how many items were read and how many tasks
   were made, or what went wrong. The script never prints the token.

       sudo journalctl -u teletraan-monday.service -n 40

**Which status an item gets.** With Group names, the title of the group of the item decides
(see "How the status is read"), and an empty Status column does not matter. With A status
column, only two labels are looked for: the In progress label and the Done label of the board
entry. Capitals and spaces around a label do not matter. An item with the In progress label is
In progress, an item with the Done label is Done, and every other item is Backlog: Stuck, Not
started, any label nobody listed, and an empty status. Older entries may still hold a Backlog
label. Studio hides it and the Mini ignores it.

**Which due date an item gets.** A date column gives its day. A timeline column gives
two days joined by a dash, such as `2026-10-12 - 2026-10-20`, and the due date is the end
day, `2026-10-20`. The script takes the last real day written as year, month and day in
the text, so a column with one day works too. A day that is not on the calendar, or in a
year before 1900 or after 2099, is skipped. A text with no such day, such as a week or a
date written out in words, gives no due date, and the task has none.

## Limits

- At most 500 items from a board, 100 in a request, and 60 requests to Monday in a run.
  A board with more items says so in the last error and only its first 500 are read. A
  run that reaches 60 requests stops, and the next run starts again at the first board,
  so a board late in the list may never be read if the boards before it are big
- 100 tasks in a request to Sanity
- At most 100 boards and 60 columns of a board are kept in `monday-status`
- Monday limits how much a token may ask for. A refusal for too many requests ends the
  run, and the next run tries again
- A refused token ends the run at once. A run that went wrong keeps what the run before it
  wrote, and the last error is in `lastError`

## If an answer looks different

The address, the version, the four questions and the places in the answers are in one
block at the top of `deploy/scripts/monday-sync.sh`: `monday_address`, `monday_version`,
`monday_query_me`, `monday_query_boards`, `monday_query_items`, `monday_query_more`, and the
`paths` block of jq functions. Correct a line there and nowhere else. Monday keeps old
versions for a limited time, so `monday_version` is the first thing to try when every
answer is refused after a long time.

To see what Monday really sends, use the API playground in Monday's developer center, in the
browser, so the token is never typed into a command line or a file. Compare the answer with
the names in the `paths` block.

`tools/test-monday-script.mjs` checks the script with made-up answers of the same shape.
Change the made-up answer there when the block at the top changes.

## What the tests cover

`tools/test-monday-script.mjs` runs the script with a fake `curl`, the real `jq`, and made-up
boards: the statuses from group names and from a status column (every other status is Backlog)
and priorities, the due dates from date and timeline columns, the owner names on and off, the
subteam that matches nobody, the board of each task, what was read from each board, Show on TV
that is never written, a task that goes, the daily counts, the 500 items, the request limit,
errors from Monday, and that no token is printed or saved. It does not touch the network.
`tools/test-monday-settings.mjs` checks the two settings on the screen's side, and
`tools/test-monday-boards.mjs` the rows of the Monday Boards page.
