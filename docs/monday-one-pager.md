# Monday: one page for the project manager

The TV reads two Monday boards, Robotics Tasks and Milestones. This page says how to
keep them so the TV is right. The detail is in docs/monday.md.

## How a task gets on the TV

Your task shows on the TV when it has a department, a team or General, Show on TV is Show, and it is not a subitem.

The Teletraan computer (the small computer behind the TV) reads the boards about every 30 minutes (a coach can change this) and
copies each task to the Studio. A change in Monday can take that long to show. The TV
only reads that copy. It never talks to Monday, and it never has the Monday key.

## Rules for the Robotics Tasks board

1. **Every task needs a Department.** Unassigned never shows. A new task gets its
   department from the group it is made in, and the automation takes up to 30 seconds.
   The Studio counts the tasks hidden for this reason, so you can see them.
2. **Team is Prime, Nova or General.** General shows for both teams.
3. **Show on TV? is Show to start with.** Pick Hide to keep a task off the TV.
4. **Status is the Status column, never the group.** A reopened task can sit in the
   Done group. The TV reads its Status. Set a task to Done in the Status column, and
   the automation sets Date Completed and moves it to the Done group.
5. **Work on the TV goes on parent items.** Subitems never show.
6. **One POC for each task.** The TV shows the first name of the first person in POC.
   It never shows a last name or an email.
7. **Fill in Timeline and Estimated Hours.** The Timeline end is the due date. A task is
   overdue when its end is before today and it is not Done. Progress is weighted by
   hours, and a task with no hours counts as one hour.
8. **Link a task to a milestone** in the Milestone column to count it in that milestone.
9. **Stay on the board.** Do not move a task to another board. Moving a task resets its
   status columns. Do not edit the archived boards. The TV does not read them.

## Rules for the Milestones board

- A milestone needs a Target Date. One with no date is skipped.
- A name that starts with EXAMPLE is skipped. Keep the example row or delete it.
- Pick a Team (Prime, Nova or Both Teams) and a Department (or All Departments).
- Status is Not Started, On Track, At Risk or Done.

## What you can rename in Monday

You can rename a label, such as changing In Review to Needs Review. The TV goes by
the position of the label (its index), not its words. Do not delete a label and do not
change which one is which. Do not delete a column and add it again. A new column gets
a new id, and the Teletraan computer stops finding it.

## Settings you must not touch

In the Studio, Settings, Dashboard Settings, the **Monday** tab belongs to the coaches.
Leave all of it as it is:

- the two board ids, and the column of each field
- Team labels, Status indexes, Priority indexes and Department labels
- the Hide label text
- how often the Teletraan computer reads, and the switch that shows owners
- Choose boards on the Monday Boards page

If one of these looks wrong, tell a coach. You can change **Show on TV** on a single
task in Monday Tasks. That is the one switch in the Studio meant for you.

## Checks

- If a Monday panel on the TV shows a STALE chip, the Teletraan computer has not read Monday for a while.
  Tell a coach.
- If a task is missing, check the four conditions at the top of this page, then wait 30 minutes.
- Monday Boards in the Studio shows when each board was last read.
