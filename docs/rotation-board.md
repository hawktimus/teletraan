# The Rotation board

Rotation is the first line under SCREEN in the Studio sidebar. It is a table of every row the wall plays, top to bottom.
Change a row and the change is saved as a draft at once. Click Publish all in the top bar to put it on the screen.

## The groups

Rows that follow each other in one view are one group. The group line shows the view, how many rows it has and how long the
rows that are on screen last together. Prime is purple, Nova is gold and Robotics is grey. Close a group to hide its rows
while you work. The checkbox on the group line selects all its rows.

The wall changes view only between groups. Moving a row into another group does not change its View. Change the View column
for that.

## The columns

- Handle: drag it to move the row. On a phone use the Up and Down buttons.
- Checkbox: select rows. Show on screen, Hide and Delete selected then work on all of them.
- #: the place of the row in the list.
- View: Robotics, Prime or Nova. A Monday card shows the team of its View.
- Panel: what the row plays, with the plain title, grouped by kind.
- Small panel: only for a Robotics row in the split layout. It names the small panel beside the row. Empty follows the small
  panels of the view. Rows in the wide layout and rows of Prime and Nova have no small panel, so the cell is empty.
- Seconds: how long the row stays, 6 to 120. Empty uses Seconds per page of Dashboard Settings. A Photos row shows its
  photos times seconds each.
- Show on screen: off keeps the row in its place and the wall skips it.
- Details: opens the fields of the panel of the row.
- Up, Down, Copy, Delete: move one place, make a copy under the row, and delete the row after a question.

## Details by panel

- Photo: Photos (1 to 20) and Seconds per photo (5 to 60).
- Monday cards: Department (empty shows every one) and the team, which follows the View.
- Subteam roster: Department and Page. Drive hours: Department.
- Upcoming events and Team leads: Page 1 or the next pages.
- A row whose small panel is the Parts request QR code: says whether the Parts request address is set. Set it in Dashboard
  Settings, Screen tab.

## What the wall plays

Under the table, one tile for each row in order, with its title, its seconds and the color of its view. A grey tile is a row
that is off and is skipped. The words view change mark where the wall swaps view. Above the tiles one line says how long a
full loop takes, counting only the rows that are on. A row whose panel has nothing to show at that moment is skipped by the
wall, so a real loop can be shorter.

## The buttons above the table

- Add row: pick a View and a Panel, then Add row. The new row goes at the end.
- Undo: puts back the list before the last change. The last twenty changes are kept until you leave the page.
- Fill from the standard order: replaces the list with the fifteen blocks the team chose, after a question. Undo brings your
  list back.

## What it writes

The board writes only the field rotationRows, to the draft of Dashboard Settings. It never publishes. A value of a row that the
board does not show stays on the row. The same list is in Dashboard Settings, Advanced, as the full form.

## Where the code is

- studio/inputs/rotation-board-view.js: the page and its actions.
- studio/inputs/rotation-board-parts.js: the drawing and the style sheet.
- studio/tools/rotation-board.js: the plain functions (groups, loop time, changes, save).
- studio/tools/rotation-titles.js: the one table of view and panel titles.
- tests/rotation-board.test.mjs: the tests.
