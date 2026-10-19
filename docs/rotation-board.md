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

## Finding a row

Above the table:

- Search panel titles: type part of a title, such as robot or photo. The table keeps the rows that match the panel, the small
  panel, the View or the department.
- Show only rows that are skipped now: rows that are switched off, and rows that are on but have nothing to show.
- Show only placeholders: Robot status, Wireframe view, and any row whose Small panel is Mini panel idea 1. A placeholder row
  has the badge Placeholder: draws only a title, because the panel is not designed yet and draws a title and a dashed frame.
- Jump to: one button for each block, such as Robotics, rows 1 to 13. It scrolls to the group line of the block.

With a filter on, a line says how many rows of the list are shown. Filters only hide rows on the page. They change nothing in
the list.

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

## Automatic panels

Under the loop preview, a section called Automatic panels lists what the wall adds by itself. None of it is a row, so none of
it is in the table. It is open on a computer and closed on a phone. Each card says Added by the wall, not a row, when it comes
in, and whether the same panel can also be a row.

- The seven competition cards: Next match, Live rank, Results strip (the last matches, also called Match Statistics), Alliance
  board, Season timeline, District points and Last season at a glance. In Auto they come in from 2 days before an event. Only
  Live rank can also be a row (Competition: Rank).
- Above them, the mode of Dashboard Settings (Auto, Always or Off) with a link to the Competition page, and one line from the
  frc-status document the Mini writes, such as Next event: Wake on 12 March 2027: the cards start on 10 March 2027. With no
  event ahead it says No event is coming up: the cards are off.
- A Monday card row with no department: it expands to one step for each Team lead.
- The announcement bar and alerts, which sit on top of everything.
- Booked talks, which take the whole screen.
- The small panel on the right, and the banner, countdown and ticker that stay on screen.
- Season packs and subthemes. They are not panels.

The code is studio/tools/rotation-auto.js and studio/inputs/rotation-auto-parts.js.

## The buttons above the table

- Add row: pick a View and a Panel, then Add row. The new row goes at the end.
- Undo: puts back the list before the last change. The last twenty changes are kept until you leave the page.
- Fill from the standard order: replaces the list with the fifteen blocks the team chose, after a question. Undo brings your
  list back.

## What it writes

The board writes only the field rotationRows, to the draft of Dashboard Settings. It never publishes. A value of a row that the
board does not show stays on the row. The same list is in Dashboard Settings, Advanced, as the full form.

## Why the wall may not play a row

A row on the board is a plan. The wall skips a row that has nothing to show, and the board says so under the panel, for
example Skipped now: no Monday task is on the TV. It reads the published tasks and photos once when the page opens. The rules
are in skipNotes in studio/tools/rotation-board.js. A change is on the wall only after Publish all, so a draft that did not
publish (Publish all names it) is the other reason the wall differs from the board.

## Where the code is

- studio/inputs/rotation-board-view.js: the page and its actions.
- studio/inputs/rotation-board-parts.js: the drawing and the style sheet.
- studio/tools/rotation-board.js: the plain functions (groups, loop time, changes, save).
- studio/tools/rotation-find.js: the filters, the search, the Jump to links and the placeholder badge.
- studio/tools/rotation-titles.js: the one table of view and panel titles.
- studio/tools/rotation-auto.js and studio/inputs/rotation-auto-parts.js: the Automatic panels section.
- tests/rotation-board.test.mjs and tests/rotation-wall-path.test.mjs: the tests.
