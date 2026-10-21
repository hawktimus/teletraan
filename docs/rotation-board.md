# The Rotation board

Rotation is the first line under SCREEN in the Studio sidebar. It is a table of every row the wall plays, top to bottom.
Change a row and the change is saved as a draft at once. Click Publish all in the top bar to put it on the screen.

The Display tab of the control page edits this same list from a phone (docs/control-page.md, The Display tab). It saves to the same draft, so the board and the tab show each other's changes after a refresh.

## What the wall plays now

The first line under the intro says, for example, Right now the loop has 80 rows shown, 3 skipped (no data), 24 switched off.
Shown rows have something to show. Skipped rows are on but have nothing to show (the note under their panel says why).
Switched off rows have Show on screen off. The line uses the list in the table and the published tasks and photos, read once
when the page opens. The Studio cannot reach the Mini, so it does not say which row is on the screen this second. The Now
showing tab of the control page does. The cards the wall adds by itself are not counted.

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
- View: Robotics, Prime or Nova.
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
- Monday: Department tasks: Department (one of the nine), List (Open or Done) and Team (Both, Prime or Nova). Monday: TV charts:
  Chart (Status by department, Overall progress or Timeline) and Team.
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
- Three more cards: Team metrics (one team, a page at a time: the season, the Match13 rating, the next match, the last results),
  Compare (Prime and Nova side by side) and the Match13 cards. Team metrics, Compare, Event preview, Our matches and Event recap come in
  Before and after and in Always, and not in Auto. Team metrics can also be a row (Competition: Team metrics), with the team of the row.
- Above them, the mode of Dashboard Settings (Auto, Always or Off) with a link to the Competition page, and one line from the
  frc-status document the Mini writes, such as Next event: Wake on 12 March 2027: the cards start on 10 March 2027. With no
  event ahead it says No event is coming up: the cards are off.
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
- Remove retired Monday rows (N): shown only when the list has rows of the eleven older Monday panels. It deletes exactly
  those rows and no other. An older Monday tasks row with a department goes too; the Department tasks rows replace it. Undo
  brings them back.
- Add the nine Department tasks rows (Robotics, Open): adds one Department tasks row, in Robotics, Open, for both teams,
  30 seconds, for each department that has no Department tasks row yet. The label says how many it adds, for example
  Add the 4 missing Department tasks rows. It is left out when every department has a row.
- Add the three TV charts rows: the same for the Status, Progress and Timeline charts, 30 seconds each, left out when each
  chart has a row.

These three buttons write only rotationRows to the draft, like the other buttons. The Display tab of the control page has the
same three, kept in step by tests/control-display.test.mjs.

## What it writes

The board writes only the field rotationRows, to the draft of Dashboard Settings. It never publishes. A value of a row that the
board does not show stays on the row. The same list is in Dashboard Settings, Advanced, as the full form.

## Why the wall may not play a row

A row on the board is a plan. The wall skips a row that has nothing to show, and the board says so under the panel, for
example Skipped now: no open Build task is on the TV for both teams. A row of one of the eleven retired Monday panels
says Retired, use Department tasks, and plays nothing; an older tasks row with a department says it plays as Department
tasks. It reads the published tasks and photos once when the page opens. The rules
are in skipNotes in studio/tools/rotation-board.js. A change is on the wall only after Publish all, so a draft that did not
publish (Publish all names it) is the other reason the wall differs from the board.

## Every panel is explained

A panel in dashboard/registry.js is either offered in the pickers of the board, listed as an automatic panel (the cards above),
or named as an old or internal panel with a reason (internalPanels in studio/tools/rotation-titles.js). The two stand-ins of the
hardware test are the internal ones. The retired Monday panels are not in the registry any more. tests/rotation-panels-explained.test.mjs fails with
the id of a panel that is none of these, so a panel cannot reach the wall without the Studio saying what it is.

## Pictures of a row

The Studio board shows a picture of a Monday row (the Preview button). The Display tab of the control page shows one for every row, a large one for the selected row and small ones on the rows, and they follow the settings on the page before they are saved. Both open the real dashboard with an address that holds one panel (docs/layouts.md, "Switches of the address"). How the control page keeps their cost down is in docs/control-page.md, "Pictures of a row".

## Where the code is

- studio/inputs/rotation-board-view.js: the page and its actions.
- studio/inputs/rotation-board-parts.js: the drawing and the style sheet.
- studio/tools/rotation-board.js: the plain functions (groups, loop time, changes, save).
- studio/tools/rotation-find.js: the filters, the search, the Jump to links and the placeholder badge.
- studio/tools/rotation-titles.js: the one table of view and panel titles.
- studio/tools/rotation-auto.js and studio/inputs/rotation-auto-parts.js: the Automatic panels section.
- tests/rotation-board.test.mjs, tests/rotation-wall-path.test.mjs, tests/rotation-auto.test.mjs, tests/rotation-find.test.mjs,
  tests/rotation-now-line.test.mjs and tests/rotation-panels-explained.test.mjs: the tests.
