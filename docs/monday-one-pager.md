# Monday: one page for the project manager

The TV reads two Monday boards, Robotics Tasks and Completed Tasks. This page says how to keep them so the
TV is right. The detail is in docs/monday.md.

## How a task gets on the TV

Your task shows on the TV when it is a parent item, it has a department, and Show on TV? is not Hide.

The Teletraan computer (the small computer behind the TV) reads the boards about every 30 minutes (a coach
can change this) and copies each task to Sanity. A change in Monday can take that long to show. Sync Monday now
on the control page reads at once. The TV only reads the copy and never has the Monday key.

## Rules for the boards

1. **The group is the department.** Put a task in the group of its department: Build, Electrical,
   Programming, Design, CNC, Strategy, Operations, Business or Marketing. A task in the Done group takes its
   department from the Department column.
2. **Done is Done.** A task is in the Done list when its Status is Done, when it is in the Done group, or when
   it is on Completed Tasks. Everything else is Open.
3. **Team is Prime, Nova or General.** General shows for both teams.
4. **Show on TV? is Show to start with.** Pick Hide to keep a task off the TV.
5. **Work on the TV goes on parent items.** Subitems never show.
6. **The first person in Assigned is the contact.** The TV shows that first name only, or Unassigned.
7. **Fill in Timeline, Priority and Estimated Hours.** The last day of the Timeline is the Estimated Completion
   Date. The Overall progress chart is weighted by the hours.

## Do not change

The column ids and the label numbers are in `computer/scripts/monday-contract.sh`. Renaming a label is fine.
Deleting a column, or making a new one in its place, needs a coach to change that file.
