# Monday board

For the coaches, the project manager and the students who look after the Teletraan computer. The team
keeps its tasks on one Monday board and its milestones on another. The computer reads both and
keeps a copy in Sanity, and the screen draws the copy. This page says how the Monday side is
set up, what each column does on the screen, when a task shows on the TV, how often the computer
reads and how many reads a day it may use, what it writes, how to preview the panels, and
what to do when nothing shows up. The panels themselves are in the table "The eleven panels"
below, and the rows that play them are in docs/layouts.md.

The two boards were checked by hand on 2026-10-14. The Teletraan computer's script has not been tried
against the live Monday service: its questions and the places in the answers follow the
public documentation of Monday, and the tests use made-up answers of the same shape. If one
is wrong, see "If an answer looks different" below.

## The one-board setup

The task board is Robotics Tasks, board `18435126893`. It is a multi-level board: a task is a
parent item, and the steps of a task are subitems. The screen shows parents only. These are
its columns, by id. The ids and the label numbers are the contract. Students rename labels,
so the Teletraan computer reads the number of a label and never its words.

| Field | Column id | Type | Labels, as label and number |
|---|---|---|---|
| Department | `color_mm82nvea` | Status | Electrical 0, Build 1, Programming 2, Design 3, CNC 4, Unassigned 5 (default), Strategy 6, Business 7, Marketing 8, Operations 9 |
| Status | `color_mkv6tatz` | Status | In Progress 0, Done 1, Stuck 2, In Review 3, To Do 5 (default) |
| Team | `color_mm82jgxg` | Status | Nova 0, Prime 1, General 5 (default) |
| Priority | `color_mm82wfy` | Status | Medium 0, Low 1, High 2, none set 5 |
| Show on TV? | `color_mm83p12x` | Status | Show 5 (default), Hide |
| Assigned | `multiple_person_mm82cqbx` | People | |
| POC | `multiple_person_mm8331h1` | People | one person, the first one is used |
| Timeline | `timerange_mkyp8kx7` | Timeline | start and end day |
| Estimated Hours | `numeric_mm82pw1a` | Numbers | |
| Date Completed | `date_mm82kn5v` | Date | set by an automation when Status becomes Done |
| Notes | `text_mm82s03v` | Text | never read |
| Milestone | `board_relation_mm83phwy` | Board relation | links a task to a milestone |
| Subitems | `subtasks_mkps8zm9` | Subitems | never read |

The groups are one for each department, and Done. The group never decides anything. An
automation moves a finished task to Done and sets Date Completed. A task that is reopened
stays in the Done group, so the group cannot be trusted. Automations take 3 to 30 seconds, so a
task may read Department = Unassigned for a moment. That is normal.

The milestones board is Milestones, board `18435272887`. A milestone has a Name, a Target Date
(`date_mm83y6zw`), a Team (`color_mm83be52`: Prime 109, Nova 8, Both Teams 5), a Department
(`color_mm83f77w`: Build 107, Electrical 9, Programming 19, Design 1, CNC 11, Strategy 104,
Business 0, Marketing 18, Operations 7, All Departments 5) and a Status (`color_mm83ndkf`: Not
Started 5, On Track 1, At Risk 2, Done 3). A milestone with no Target Date, or a name that
starts with EXAMPLE, is skipped. There is no link from a milestone back to its tasks. The
screen finds them: the tasks of a milestone are the tasks whose Milestone column lists it.

The boards that the older Monday tab read, and the archived and copied boards
(`18435141525`, `18435131682`, `18435141092`, `18415964745`, `18415830886` and the CAD copy
`18415830249`), are never read.

## What each column does on the screen

| Column | On the screen |
|---|---|
| Department | Which Team lead a task belongs to, so which department panel shows it. Unassigned means no panel, ever. |
| Status | The status chip and the order of the rows: IN PROGRESS, IN REVIEW, STUCK, TO DO, DONE. Stuck shows in the red. |
| Team | Prime or Nova, or General, which counts for both teams. |
| Priority | The priority mark on a row, and the order of the To Do tasks: High, Medium, Low, none. |
| Show on TV? | Hide keeps the task off every panel. |
| Assigned | The first names of the people, only when Show owner first names on the TV is on. |
| POC | The first name after the title of a row. |
| Timeline | The start and the due day. The end day is the due date, and a task past it that is not done shows a red OVERDUE chip. The timeline panel draws the bars. |
| Estimated Hours | The weight of a task in the progress. A task with no hours counts as 1. |
| Date Completed | The order of the Done list, and the day shown on a done row. |
| Milestone | Which milestones a task counts toward. |
| Notes and Subitems | Nothing. They are never read. |

Only first names reach the screen. The Notes column is never read, so a last name or an email
typed there cannot get out.

## The Show on TV rule

A task shows on the TV when all of these are true:

- it has a department, and the department is not Unassigned
- it has a team, or General
- Show on TV? is Show, which is the default
- it is not a subitem
- its Show on TV switch in Studio is on (Monday, Items), and its Show on screen
  switch is on

In the words for students: your task shows on the TV when it has a department, a team or
General, Show on TV is Show, and it is not a subitem.

The Show on TV? column becomes `showOnBoard` on the task. The Show on TV switch in Studio is
`showOnTv`, and only an editor changes it. The Teletraan computer never writes it. Both must be on.

A task with Team = Prime and Department = Build shows on the Prime Build panel and on no Nova
panel. The same task with Team = General shows on the Build panel of both teams. Setting Show
on TV? to Hide removes the task from the screen after the next read. A task with Department =
Unassigned is written with Show on screen off and the reason `unassigned`, and the Teletraan computer counts
it in `hiddenUnassigned`, which the connection block shows as hidden for want of a department.

## Why status is the column and not the group

The Status column decides the status, and the group never does. A finished task moves to the
group Done, and if it is reopened by changing its Status to To Do, it stays in Done. A rule that
read the group would call it done. So a task in the group Done with the status To Do reads
To Do, and a task with the status Done is in the Done list of the screen, sorted by its Date
Completed, whatever group it sits in.

## How often it reads

The timer wakes the script every 5 minutes. The script does not read Monday every time. First
it asks Sanity, which costs nothing and needs no token, for two things: How often on the Monday
tab of Dashboard Settings (`mondayEveryMinutes`, a whole number from 5 to 120, starting at 30)
and the time of the last read in `monday-status`. If the last read is newer than the setting,
the run ends without a word and without asking Monday.

So a change to How often needs no new timer. Publish Dashboard Settings and the next wake
uses it. Thirty minutes is about 150 reads a day. The free plan allows about 1,000.

The screen uses the same number. A Monday panel shows `BOARD` and the minutes since the last
read in its header. When the last read is older than twice How often (an hour at 30 minutes),
the panel shows an amber STALE chip instead. The screen also keeps the last content it read
and draws it when Sanity cannot be reached, with the STALE chip on every Monday panel.

## The daily read budget

A read is one request to Monday. A run makes at most 4: the task board in pages of 200 items,
then the milestones board, and on the first run of a day the list of boards for the pickers.
`monday-status` keeps `callsToday` and `callsDate`, the day in the time zone of the screen. When
`callsToday` reaches 900, the script stops reading until midnight and writes the last error
"Daily read limit reached; reads resume at midnight." The connection block shows Reads today.
At 30 minutes the Teletraan computer uses about 150 of the 900, so the limit only matters when How often is
turned down to 5 minutes for a long time, or when something fails and retries.

## The Monday page

One line of the sidebar, Monday, under TASKS. It replaces Monday Tasks and Monday Boards. It has four tabs.

- **Boards**: a card for every board the token can see, with its name, how many items it has and when the
  Teletraan computer last read it. Each card has two choices: Show tasks from this board and Show
  milestones from this board. Click one and it is saved as a draft of Dashboard Settings, in the same two
  fields as before (the board of the Task board block and of the Milestones board block). Click Publish all
  in the top bar to put it on the screen. Each card says in plain words whether the computer can read the
  board. A note and a link open the Monday check on the control page, Settings, Monday, where Check the token
  asks Monday who the token belongs to. The page also holds the minutes
  between reads (5 to 120, the same setting as How often) and the reads used today out of 900.
- **Items**: the tasks of the chosen task board, grouped by department in the order Build, Electrical,
  Programming, Design, CNC, Strategy, Business, Operations, Marketing and General, then any other
  department, then tasks with no department. Filter by department, status and on or off the TV, or search
  a word of the title or an owner. Each task has a Show on TV switch, the one thing an editor changes, and
  each group has Hide all in this group and Show all in this group. A task the computer kept off the TV says
  why under its switch. A long title wraps and is never cut. The link Old manual tasks at the foot opens the
  two old lists, On the TV and Hidden, for tasks typed by hand before the team board was connected. Those
  tasks stay and are never shown on the screen.
- **Milestones**: the milestones the computer read, read only.
- **Preview the panels**: the pictures of the panels (see The preview).

If a chosen board is not among the boards the token can see, the top of the Boards tab says so in red with
the board number and what to do: in Monday open the board, click Share, and add the account the token
belongs to, or choose another board. Robotics Tasks, the board the team works in, is a multi-level board.
An older version of the Monday API did not list a multi-level board for a token, even when the token could
read it, so a missing Robotics Tasks may be this and not a wrong number. The first thing to check is that
the account of the token is a member of the board. If it is, press Monday debug on the control page (see
Multi-level boards below) and send the answer to a coach.

The switch on a task changes the draft of that task. The draft is a copy of the task as it was. Publish all
puts it on the screen, and the next read from Monday may change the other fields of the task again.

## The settings

Dashboard Settings, Monday tab, holds the connection from the Teletraan computer (it stores nothing), the Test
the token button, How often and Show owner first names. The Task board and Milestones board blocks are on
the Advanced tab, because the board is chosen on the Monday page and what is left in them is the contract:
the column ids and the label numbers. Nothing was removed, and the same fields are stored.

- **How often**: minutes between reads, 5 to 120. The Monday page changes the same field.
- **Task board** (Advanced tab): the board (it is chosen on the Monday page too), then a picker for each column: Department,
  Status, Team, Priority, Show on TV, Assigned, POC, Timeline, Estimated Hours, Date Completed
  and Milestone. A picker lists the columns of its board, the ones that fit under Fits and the
  others under Other. If the Teletraan computer has not listed the columns yet, it says "Read the board first:
  wait for the next sync." If a list cannot be read, the box is a plain one: type the board
  number or the column id.
  - **Team labels**: rows of a label number and a team. A blank team means both teams. They
    start as 1 for Prime, 0 for Nova and 5 for both.
  - **Status indexes**: To Do 5, In Progress 0, In Review 3, Stuck 2, Done 1.
  - **Priority indexes**: High 2, Medium 0, Low 1. Any other number means no priority.
  - **Hide label text**: Hide. It is the only label read by its words, because Hide has no fixed
    number.
  - **Department labels**: rows of a label number, a name and a Team lead. Leave the Team lead
    blank and the computer uses the Team lead with the same name. A row marked Never shown (Unassigned
    is) gives no Team lead, so its tasks stay off the TV. A number that has no row is treated the
    same way.
- **Milestones board**: the board, the Target Date, Team, Department and Status columns, and the
  same three tables (team labels 109, 8 and 5, status indexes, department labels). A milestone
  department that has no Team lead means all departments.
- **Show owner first names on the TV**: off to start with. On, the first names from Assigned go
  with a task. The first name of the POC is always kept.

Every value starts as the table above, in Studio, in `dashboard/config.js` and at the top of
`computer/scripts/monday-sync.sh`. `tests/schemas.test.mjs` and `tests/monday-sync.test.mjs`
fail when the three differ. The older Boards rows are hidden ("Not used any more") and the script
ignores them. What was typed in them is kept.

Renaming a label in Monday does not break the sync, because the number is read. Changing which
number means what is done in the tables here. A rename of a team in Sanity does not break it
either: the team labels point at the Team document, and Monday never sees the team name.

## What it writes

Tasks. Each parent item becomes one published task with the id `task-monday-` and the item's
number, created if missing and patched only when it changed. Its fields:

- `title`: the item's name, cut at 22 characters
- `team`: a reference to the Team, or nothing for General
- `subteam`: the Team lead of the department, or nothing when the department is Unassigned
- `status`: `up-next`, `in-progress`, `in-review`, `blocked` (Stuck) or `done`
- `priority`: `high`, `medium`, `low` or nothing
- `showOnBoard`: false when Show on TV? holds the Hide label
- `contact`: the first name of the POC, at most 12 characters
- `owners`: the first names from Assigned, up to 6, only when Show owner first names on the TV
  is on
- `startDate` and `dueDate`: the start and the end of the Timeline. A day that is not on the
  calendar gives nothing
- `estHours`: the hours, or nothing
- `completedOn`: Date Completed, or nothing
- `milestoneIds`: the numbers of the linked milestone items, up to 50
- `hiddenReason`: `unassigned` when the task has no department, and then `show` is off
- `mondayBoardId` and `mondayBoardName`, `show`, `source` (`monday`) and `mondayId`

The script never writes Show on TV (`showOnTv`). A task that has it keeps what an editor chose.

Milestones. Each milestone becomes one published `milestone` with the id `milestone-monday-` and
the item's number: `name` (40 characters), `targetDate`, `team` (nothing for both teams),
`subteam` (nothing for all departments), `status` (`not-started`, `on-track`, `at-risk` or `done`)
and `show`. Only the Teletraan computer writes them. Studio lists them read only on the Milestones tab of the
Monday page.

The document `monday-status`, which the Monday tab reads, and which the screen reads for the
time of the last read:

- `connectedAs`, `lastSyncAt` and `lastError`: the first name of the account, when the Teletraan computer last
  read the task board, and what went wrong in plain words
- `boards`: every board the account can see, with its columns, for the pickers and the Monday
  Boards page. It is read on the first run of a day
- `readings`: for the two boards, the items read, when, and a note when a board gave fewer
- `taskCount` and `hiddenUnassigned`: the tasks read, and how many have no department. The
  connection block shows "N tasks, M hidden (no department)"
- `callsToday` and `callsDate`: the reads used today
- `snapshots`: one count a day of the open tasks, 120 days at most

The connection block also shows "Reads every N minutes". The time of each good run goes into
`status-mini` with `status-write.sh monday`.

## When an item goes

The script never deletes anything. A task or milestone whose item is no longer on its board is
switched off: `show` goes off and a task shows on the Items tab of the Monday page as off the TV. If the item
comes back, so does the document. This happens only when the board was read to its end in that
run. A run that stopped at 4 requests, or met an error, switches nothing off. A milestone that
loses its date or is renamed to start with EXAMPLE is switched off the same way.

Tasks that the Teletraan computer made from the older boards are not on the new task board, so the first run
switches them off.

## The preview

The Studio is hosted at sanity.studio and cannot reach the Teletraan computer, so the preview runs on the
Studio's own copy of the dashboard. The dashboard accepts an address like this, and draws that
one panel in the style of that Screen, held still, with no rotation, no clock and no hidden
effects:

    /dashboard/?panel=monday-tasks&team=prime&dept=<Team lead id>&screen=original&still=1

Each Monday row of a view has a Preview button. It opens the panel in a 960 by 540
frame below the row, which is the 1920 by 1080 canvas at half size. The Monday page (the Monday Boards
page before it) has a Preview the panels tab that lists all eleven the same way. The preview reads the published
dataset, the same as the TV, so a draft shows only after Publish.

## The eleven panels

All are large panels, drawn in the Monday style. Headers show the team short name at the right
end of the title, and none when the panel is for both teams. A panel with nothing to show is
skipped by the view, as an empty Monday row is.

| Panel | Registry id | Picker row | What it shows |
|---|---|---|---|
| MQ01 to MQ04, tasks by team and department | `monday-tasks` | team and department | Up to 10 tasks of one department of one team, five to a page: status chip, title, POC, due date, priority, a red OVERDUE chip when late. Counters OVERDUE, OPEN and DONE below. |
| MQ05 and MQ06, done by team | `monday-done` | team | The last 6 done tasks of a team by Date Completed, all departments, with counters THIS WEEK, THIS SEASON and HOURS. |
| MQ07, status by department | `monday-status-depts` | none | One bar for each department with a task, in five parts: To Do, In Progress, In Review, Stuck, Done. At most eight rows. |
| MQ08, overall progress | `monday-overall` | none | A ring of hours done over hours planned, a bar for each team, and the next three milestones with days left. |
| MQ09, timeline by team | `monday-timeline` | team | Eight weeks, a row for each department, a bar for each task from start to due, a dashed red line for today. |
| MQ10 and MQ11, board by team | `monday-board` | team | Four columns: To Do, In Progress, Review (Stuck sits here with a red edge) and Done, two cards each. When the panel runs twice in a row, the second shows cards three and four. |
| Status pie by team | `monday-pie` | Rotation list only | A donut of the tasks of a team, or of one department of it, by status, with the count and the percent of each status in words beside it. |

A row of the Rotation list can name a department for the tasks, done, board, timeline and pie panels (a Team lead name such as build, or its id). The row then draws that department only, and a row with a department and no team is for both teams (docs/views.md, "The default rotation").

The older ids `monday-team`, `monday-milestones` and `monday-progress`, and the two both-teams
cards, stay in the code. They are hidden from the picker, and a saved row that names one plays
as `monday-tasks` for the first department of its team.

## The keys

- `MONDAY_API_TOKEN` in `computer/local.env` on the Teletraan computer. Monday wants it in a header on every
  request. The script hands it to curl on standard input, so it never shows in the process
  list, and it is never printed or saved. How to make one: below, and
  docs/rebuilding-the-computer.md, step 18.
- `SANITY_WRITE_TOKEN` in the same file, the one the status block uses
  (docs/rebuilding-the-computer.md, "Showing what the computer did in Studio").

Without either the script does nothing, says so in one line, and ends without an error, so the
service does not show as failed.

## Setting it up

1. Make the token. In Monday, click your picture at the top right, open Developers, then My
   access tokens, and copy the token. It needs the team mentor's yes, and the account it
   belongs to should see only the team's boards.
2. Add it to `local.env` on the Teletraan computer, in single quotes, on its own line
   (docs/rebuilding-the-computer.md, step 18).
3. Install the timer with `install-monday.sh`, and try the token with
   `monday-sync.sh --check`. The unit files changed with this version: the timer now wakes the
   script every 5 minutes, so run `sudo /opt/teletraan/computer/scripts/install-monday.sh` again
   after every update that touches `computer/systemd`.
4. Wait 5 minutes. Open Dashboard Settings, Monday tab. The block at the top says who the token
   belongs to, when the computer last read Monday, how often, how many reads it used today, and how
   many tasks it made. Until then it says No connection yet.
5. The two boards are already named and every column is set, because the starting values are the
   rebuilt workspace. Change a board or a column only when the workspace changes. Click Publish
   if you did.
6. Within How often minutes the tasks are on the Items tab of the Monday page. Turn Show on TV off on a
   task to keep it off the screen.

## Trying it

On the Teletraan computer:

    /opt/teletraan/computer/scripts/monday-sync.sh --check
    /opt/teletraan/computer/scripts/monday-sync.sh

`--check` asks Monday who the token belongs to and writes nothing. The second line is one run.
`--debug` and a board number prints how Monday answers for the first two items of that board (see
Multi-level boards below) and also writes nothing:

    /opt/teletraan/computer/scripts/monday-sync.sh --debug 18435126893

It reads only when the last read is old enough, so a run right after a good one prints nothing.
To force a read, set How often to 5 and wait. The journal has the lines of every run:

    sudo journalctl -u teletraan-monday.service -n 30

## If nothing shows up

Go down the list. Each step rules out one cause.

1. The connection block says connected. Connected as shows a first name, and Last sync shows a
   recent time. If it says No connection yet, the token is not in `local.env` on the Teletraan computer or the
   timer is not installed (Setting it up, steps 2 and 3).
2. The last error is empty. Daily read limit reached means wait for midnight or raise How often.
   Monday refused the token means the token is wrong or expired. The two board lines under the
   block show 0 items and the reason when a board number is wrong.
3. Wait How often minutes. Last sync shows when the computer last read.
4. Look on the Items tab of the Monday page. Tasks from the board in the connection block counts them,
   and says how many are hidden for want of a department.
5. Look at the task in Monday. It needs a department that is not Unassigned, a team or General,
   Show on TV? set to Show, and it must not be a subitem.
6. Look at the Show on TV switch of the row in Studio. A task with it off is in the list and not
   on the TV, and the computer never changes that switch.
7. If the board is on the list and still no task has a department, the board may be a multi-level board
   that was read in the wrong shape. Press Monday debug on the control page (Settings, Monday) and send
   the answer to a coach.
8. On the computer, run the line below and read the last lines. A line that starts with `monday:`
   says how many tasks and milestones were read, or what went wrong. The script never prints the
   token.

       sudo journalctl -u teletraan-monday.service -n 40

Eight tasks imported at the start carry timelines from May to July 2026, so they show as
overdue until someone resets them. That is expected.

## Limits

- 200 items in a request to Monday, and at most 4 requests in a run, so up to 800 tasks. A task
  board that needs a fifth request is read in part, and the last error says so
- At most 900 requests to Monday a day, counted in the time zone of the screen
- 100 documents in a request to Sanity
- At most 100 boards and 60 columns of a board are kept in `monday-status`
- A refusal for too many requests, or a refused token, ends the run, and the next run tries
  again. A run that went wrong keeps what the run before it wrote, and the last error is in
  `lastError`

## The dataset is public

Anyone can ask Sanity for these documents, because the dataset is public:

- the titles, departments, dates and hours of the tasks, the names and dates of the milestones,
  and the first names of owners when the owner switch is on
- the name of every board the account can see, the titles and types of their columns and their
  item counts, including the boards the screen does not read
- the first name of the account

Use a Monday account that can see only the team's boards, and leave Show owner first names on
the TV off unless students and parents have agreed to it. The token is never written in any
document or file.

## Multi-level boards

Robotics Tasks and Completed Tasks are multi-level boards (`hierarchy_type` is `multi_level`). A status
column of such a board does not answer as a `StatusValue`. It answers as a `BatteryValue`, a list of
`{ key, count }`, where `key` is the number of a label as text and `count` is how many items under the
parent have it. The sync handles this in four places:

- The list of boards asks for `hierarchy_type`, and each board in the list of the Boards tab is marked
  `classic` or `multi_level` (the field Kind of board in `monday-status`).
- A board that is `multi_level` in the list of this run, or in the list the last run wrote, is read with
  `monday_query_items_multi` and `monday_query_more_multi`. They ask for `column_values(capabilities: [CALCULATED])`,
  without which Monday leaves the status columns out, add `... on BatteryValue { battery_value { key count } }`
  and the settings of the chosen columns, which hold the label of every number. Any other board is read with
  the old questions, exactly as before, so Build Tasks and Milestones are unchanged.
- The key becomes the index and the label comes from the settings of the column, so Department, Status,
  Team, Priority and Show on TV work the same afterwards. A parent that has more than one key takes the key
  with the highest count, and the first one Monday lists when two have the same count.
- The timeline (`... on TimelineValue { from to }`) and the people are read as on any board. Subitems are
  left out, as before.

The API version is `monday_version` in `monday-contract.sh`, one line. It is 2026-01 now. The questions were
tried by hand against Robotics Tasks and answered the department, status, team and Show on TV of its items; the
sync itself has not run with them yet. If the Monday page still lists no tasks, press
Monday debug on the control page, Settings, Monday (it runs `monday-sync.sh --debug` with the board number
for you). It prints the kind of board, the API version and, for the first two items, each column with its id,
its type and the shape of its value. It holds item names and column ids, and no token and no names of
people: the text of a people or text column is replaced by `(hidden)`. Send what it prints to a coach, who
can correct the version or the shape in `monday-contract.sh`.

## If an answer looks different

The address, the version, the four questions and the places in the answers are in one file,
`computer/scripts/monday-contract.sh`, which `monday-sync.sh` reads: `monday_address`, `monday_version`,
`monday_query_me`, `monday_query_boards`, `monday_query_items`, `monday_query_more`,
`monday_query_items_multi`, `monday_query_more_multi`, `monday_query_debug`, and the
`paths` block of jq functions. Correct a line there and nowhere else. The questions use typed
fragments (`... on StatusValue { label index }` and the like), because a plain question gave
empty values for status, date and relation columns. Check one known item after any change.

To see what Monday really sends, use the API playground in Monday's developer center, in the
browser, so the token is never typed into a command line or a file. Compare the answer with the
names in the `paths` block.

`tests/monday-sync.test.mjs` checks the script with made-up answers of the same shape. Change the
made-up answer there when `monday-contract.sh` changes.

## What the tests cover

`tests/monday-sync.test.mjs` runs the script with a fake `curl`, the real `jq` and made-up
boards: one task for each status number, a General task, an Unassigned task, a Hide task, a
subitem, an EXAMPLE milestone and a milestone with no date, the settings that win over the
starting values, the owner names on and off, the hours and the dates, the quiet exit before
How often, the 900 reads a day, the four requests, a task or milestone that goes, errors from
Monday, and that no token is printed or saved. It also reads a made-up multi-level board (BatteryValue
and the labels of the column settings), checks that its tasks are the same as the classic board gives,
and runs `--debug`. It does not touch the network.
`tests/monday-settings.test.mjs` checks the settings on the screen's side,
`tests/monday-boards.test.mjs` the rows of the older Boards page, `tests/monday-page.test.mjs` the Monday
page, and
`tests/monday-docs.test.mjs` this page.
