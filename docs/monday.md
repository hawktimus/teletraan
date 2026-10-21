# Monday board

For the students and coaches who keep the task list. The team keeps its tasks in Monday. The Teletraan
computer reads them, keeps a copy in Sanity, and the TV shows the copy. This page says which boards are read,
how a task gets onto the TV, what the two Monday panels show, how to put them in the rotation, and what to
do when nothing shows up.

## The two boards

The computer reads two boards, by their numbers. Nothing about them is typed in the Studio.

| Board | Number | What it holds |
|---|---|---|
| Robotics Tasks | `18435126893` | Every task. One group for each department, and a Done group |
| Completed Tasks | `18435131682` | Old tasks that are finished. Every task here counts as done |

Both are multi-level boards: a task is a parent item, and its steps are subitems. Subitems are never read.

The numbers, the column ids and the label numbers are in one file, `computer/scripts/monday-contract.sh`.
If a column or a label changes in Monday, change that file and nothing else.

## How a task gets onto the TV

Your task shows on the TV when:

- it is a parent item (not a subitem), and
- it has a department, and
- the Show on TV? column does not say Hide.

The department is the group the task is in: Build, Electrical, Programming, Design, CNC, Strategy,
Operations, Business or Marketing. A task in the Done group, or in a group with another name, takes its
department from the Department column. A task with no department at all is left out.

A task is in one of two lists:

- Done, when its Status is Done, when it sits in the Done group, or when it is on Completed Tasks.
- Open, for everything else: To Do, In Progress, In Review and Stuck.

## What the computer reads from each task

| Monday column | Id | On the TV |
|---|---|---|
| Name | | Project |
| Status | `color_mkv6tatz` | Status: To Do 5, In Progress 0, Done 1, Stuck 2, In Review 3 |
| Department | `color_mm82nvea` | Department, when the group is not one |
| Team | `color_mm82jgxg` | Prime 1, Nova 0, General 5. General shows for both teams |
| Assigned | `multiple_person_mm82cqbx` | Contact: the first name of the first person, else Unassigned |
| Priority | `color_mm82wfy` | High 2, Medium 0, Low 1. Empty is No Priority |
| Timeline | `timerange_mkyp8kx7` | Estimated Completion Date: the last day. Empty is No Date |
| Date Completed | `date_mm82kn5v` | The order of the Done list |
| Estimated Hours | `numeric_mm82pw1a` | The Overall progress chart |
| Show on TV? | `color_mm83p12x` | Hide keeps the task off the TV |

Only first names reach Sanity, because the dataset is public. No email, no last name, no notes.

## The two panels

**Department tasks** (`monday-department`) is a table of one department, in one list, for both teams or one:

| Status | Project | Contact | Priority | Estimated Completion Date |
|---|---|---|---|---|

The title is the department and the list, such as BUILD TASKS or BUILD DONE. When the row names one team,
the team is at the right end of the header. The Open list is In Progress, In Review, Stuck, To Do, and the
earliest date first in each. The Done list is the newest Date Completed first. Four rows are in view; a longer
list moves up four rows at a time, and stops at 20 rows.

**TV charts** (`monday-charts`) is one chart a row:

- Status by department: a bar for each department, Done, In Progress (with In Review and Stuck) and To Do,
  with the counts.
- Overall progress: the estimated hours of the done tasks over all the hours. When no task has hours, the
  done tasks over all the tasks.
- Timeline: the tasks with a Timeline in this month and the next two, by department, with a red line for today.

A chart row can name one department. The Status chart is then one bar for that department with the numbers Tasks, Done, In Progress, To Do and Stuck under it (the bar counts Stuck inside In Progress). Progress and Timeline draw that department only. The title says which, such as BUILD STATUS or BUILD TIMELINE.

A row whose panel has nothing to show is skipped, and the Rotation board says why under the row.

## Which view plays which tasks

A task has a Team in Monday: Prime, Nova or General (stored with no team, for both teams). A Monday row plays in the view of its Team, and a view never shows a task of the other team.

| Row | Team of the row | Plays in | Tasks it shows |
|---|---|---|---|
| Business, Operations, Marketing, Strategy, or any department | Both (empty), in a Robotics block | Condensed | General tasks only |
| Build, Electrical, Programming, Design, CNC | Prime | Prime view | Prime tasks and General tasks |
| Build, Electrical, Programming, Design, CNC | Nova | Nova view | Nova tasks and General tasks |

- Condensed is the thin bar layout with the countdown across the top and no small panel. Prime and Nova are bar layouts too. A Robotics row of Prime or Nova swaps into that team's view for the step and back to Robotics after it. Two rows in the same view stay in it with no swap between them. An alert, an announcement or a talk covers the screen first.
- The view that plays is decided by the Team of the row when the stored view is Robotics, and the stored view is never changed. A row stored in the Prime or Nova view plays there whatever its Team says, and a Team Both row there has that team's tasks and the General ones, as it always had.
- Both on a Robotics row is only the General tasks. A department with no General task (CNC, for example) is left out of Condensed, and the Rotation board says so under the row.
- The Rotation board and the Display tab say Plays in the Condensed view, Plays in the Prime view or Plays in the Nova view on a Robotics row.
- A row held from Show a panel on the control page follows the same rules. The wall plays the row of the picture (`holdRow`, docs/control-page.md), so Department tasks for Build, Open and Prime plays in the Prime view, and the same row with Both teams from Robotics plays in Condensed. A department with no task to show gives no page, and the large frame has nothing to show until the hold ends.
- A Subteam roster row has the same Team: Prime or Nova counts that team's people, and in a Robotics block plays in that team's view. Both counts the people of both teams and the page names both, such as PRIME + NOVA.

## Putting a department on the TV

Open Rotation in the Studio sidebar. Add a row with the panel Monday: Department tasks, open Details and pick:

- Department: one of the nine.
- List: Open or Done.
- Team: Both, Prime or Nova.

For a chart, add Monday: TV charts and pick the Chart, the Department (All departments, or one of the nine) and the Team. A Subteam roster row has a Department (First with people, or one of the nine) and a Team. The Display tab of the control page has
the same dropdowns. The standard order has Business, Operations, Marketing and Strategy in Robotics for both teams, then the three charts, and Build, Electrical, Programming, Design and CNC, open, in the Prime view for Prime and again in the Nova view for Nova. Add the 14 Department tasks rows adds each missing department in its own view and team.

The eleven Monday panels of the older sync are retired. A stored row that names one stays in the list, plays
nothing, and says Retired, use Department tasks. An older tasks row with one of the nine departments plays as
Department tasks, Open, for that department.

## The Monday page

Monday in the Studio sidebar shows what the computer read, and answers one question: for a team, what is to do and
what is done in each department. It is read only. To change a task, change it in Monday.

- The first line says when the computer last read Monday and whether it worked, or the problem in plain words.
- Pick a Team: Both, Prime or Nova. A task with no team is for both teams, so it shows under Prime and under Nova. Both shows only those tasks, which is what Condensed plays.
- A tile for each of the nine departments says how many tasks are to do and how many are done. A department with
  nothing in it is greyed and says so, and is not hidden.
- Below, each department has a table of the To Do and In Progress tasks and a table of the Done tasks, with the
  five columns of the TV: Status, Project, Contact, Priority and Estimated Completion Date (the TV says DUE DATE, and DUE in the narrow layout). A table stops at the 20
  rows the TV holds and says how many more are in Monday. A phone shows each row as a small card.
- What the TV shows draws the first page (four rows) of one Department tasks row. Pick the Department, the List and
  the Team, as in a Rotation row. It says when the TV would leave the row out.

The page imports `departmentView` and its helpers from `dashboard/core/monday-views.js`, so the rows and their order
are the ones of the TV and cannot drift. The Studio dev server may read the dashboard folder because of the `vite`
line in `studio/sanity.cli.js`.

## How often it reads

A timer wakes `monday-sync.sh` every 5 minutes. It reads Monday when the last read is older than How often
on the Monday tab of Dashboard Settings (`mondayEveryMinutes`, 5 to 120 minutes, starting at 30). Sync Monday
now on the control page reads at once. A read is a page of each board and one question for the names.
Monday allows about 1,000 reads a day; past 900 the computer waits for midnight and says
Daily read limit reached. Reads start again at midnight.

## What it writes

- One task document for each task that shows on the TV, with the id `task-monday-<item number>`. A task whose
  item is gone is deleted, but only after both boards were read to the end.
- A task whose Show on TV? column says Hide is not written. The dataset is public, and anyone who asks it can
  read a task, so a hidden task keeps its title in Monday only. If an earlier run wrote it, the next run
  deletes it, with its draft. The Monday page says how many tasks say Hide (`hiddenCount` in
  `monday-status`) and nothing more. The Show on TV switch in Studio is different: a task switched off there
  stays in the dataset with its title, because the switch has to find it to turn it on again.
- The document `monday-status`: when it last read (`lastSyncAt`), the last problem in plain words
  (`lastError`), the reads of the day (`callsToday`), what it read from each board (`readings`), and the
  open and done tasks of each department (`departments`) and how many tasks say Hide (`hiddenCount`).

## If nothing shows up

1. Open the Monday page in the Studio. The first line says when the computer last read and what went wrong.
2. If it says the token was refused, paste a new MONDAY_API_TOKEN on the control page, Settings, Keys.
3. If it says Monday gave no items for a board, share the board with the account of the token.
4. If a department is empty, check the task: a parent item, in a department group, Show on TV? not Hide.
5. Press Sync Monday now on the control page, wait a minute and look again.
6. Still nothing: press Monday debug on the control page, Settings, Monitor Monday, with the board number, and send
   the answer to a coach. It shows how Monday answers for two items, with no token and no names of people.

On the computer, `computer/scripts/monday-sync.sh --check` checks the token, and
`computer/scripts/monday-sync.sh --debug 18435126893` prints the same answer as Monday debug.

## Setting it up

The token goes in `local.env` on the computer as MONDAY_API_TOKEN, through Settings, Keys on the control page.
The timer is installed once with `sudo computer/scripts/install-monday.sh`, and again when its unit files change.
