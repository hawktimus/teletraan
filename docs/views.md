# Views

The screen plays three views: Robotics, Prime and Nova. Robotics is the new name of General, which is kept as its other name in stored data, config and addresses (`general` still works in addresses and in the control page's requests). The Family view is not played any more: its two panels are Robotics rows, and its document is kept. A view is a layout, a team, the minutes it stays, the rows of the large panel and the rows of the small panel. Each is a document in the Studio (ids view-general, view-prime, view-nova, view-family). A document that is missing, or has an empty list, plays the starting view in `dashboard/config.js` (`defaultViews`), which has the shape of `studio/tools/view-defaults.js`. A view also carries `layout`, `mirror`, `countdownIn`, `viewTag`, `teamChip` and `colors`.

## What each view is

| View | Layout | Team | Minutes | Starting panels |
|------|--------|------|---------|-----------------|
| General | standard | none | 6 | Daily Agenda 45 s, Events 60 s, Leadership 20 s, Photos 4 x 10 s, Sponsors 15 s. Small panel: Next event 30 s, Task counts 20 s, Safety days 20 s, Weather 15 s, Sponsor logo 15 s |
| Prime | bar | Prime | 6 | TV charts: Status by department and Overall progress, 30 s each |
| Nova | bar, mirrored | Nova | 6 | The same for Nova |
| Family | bar | none | 2 | TV charts: Status by department (fixed) |

The bar layout has no small panel. Nova is mirrored because the Nova team has Mirror switched on.

## Where the older panels are

The starting rows hold the panels listed above and no more. Other panels are not in a starting row, so they appear only when a row for them is added to a view in the Studio: Tasks, Team leads, Subteam spotlight, Roster, Department tasks, Extra panels, the Season timeline and the team tile. Competition cards are not rows. They are mixed into the large panel of the view on the screen when they are due, in the team of that view. The announcement plate and the alert, talk and night screens come over any view. `tools/screenshots.mjs` takes each view in each theme with each team (`view-<view>-<theme>-<team>.png`).

## The rotation

One ordered list says what the large panel plays: Dashboard Settings, Look tab, Rotation (stored as `rotationRows`, because `rotation` is the name of the Ticker block on the same page). Each row is a view (Robotics, Prime or Nova), a panel, the seconds it stays and a Shown switch. Drag a row to move it. A row that is not Shown keeps its place in the order and plays nothing, so it can be turned back on without sorting again.

- The screen walks the list from the top and starts again at the end. Rows that follow each other in one view are a block. The view changes only between blocks, with the swap. Inside a block the panels change with the plain page change.
- A row whose panel has nothing to show right now (no Monday tasks, no photos, no events) is skipped, with no change and no gap. A block with nothing to show is skipped whole. If only one block has something to show, it stays and starts again.
- A block stays for the seconds of its rows that have something to show. A row with no seconds follows Seconds per page.
- The first time Dashboard Settings is opened with the list empty, the Studio fills it with the default rotation (below). Click Publish all to keep it. `rotationRows`, `transitionSeconds` and the Shown switch of a row all have starting values (an empty list, 3 seconds, on). Until the list has a Shown row the screen plays the default rotation.
- `viewOrder`, the minutes of a view and the rows of a view are hidden and marked Not used any more. They are kept, and the first fill reads them.
- `core/rotation.js` has `transitionKindFor(previousRow, nextRow)`. It says `reformView` when the view changes and `reform` inside a view. Until those two transitions are drawn, the screen plays the swap for the first and the page change for the second. `transitionSeconds` (Look tab, 2 to 4, starts at 3) is the length of a whole transition.
- The minutes stand still while an alert, an announcement, a talk, a demo, the night screen or a hidden transition has the screen. The view that was interrupted comes back at the panel that was next.
- The control page and the Studio menu can hold a view (`showView`: general, prime, nova or family, called Robotics, Prime, Nova and Condensed), hold a panel (`holdPanel`), preview a theme (`previewTheme`: original, cybertron, retro or foundry) or pause the rotation (`pauseRotation`). The runtime reads them once a second through `activeRequests()` in `core/screen-requests.js`. A held view plays all its blocks of the rotation list one after the other, and Condensed, which the list has no block for, plays the rows of its own document. A theme request has a slot of its own in `core/style.js` (`requestStyle`) that wins over the weekday theme, the rotation and an older preview, and the large panel moves on at once so the theme goes on in a swap within a few seconds. A held panel is the only one the large panel plays, in the first view that has it. With `?style=` or `?team=` in the address the screen plays the first view and holds nothing.

## The default rotation

An untouched Studio plays this list, and it is what the Rotation list is filled with the first time Dashboard Settings is opened with the list empty. The screen plays it too whenever the list has no row that is Shown. It is in `config-rotation.js` (`defaultRotationRows`) and in `studio/tools/default-rotation.js`, and `tests/default-rotation.test.mjs` pins both. A panel that has nothing to show right now is skipped with no change, so a department with nothing in its list leaves its Department tasks row out.

| Block | View | Rows, in order |
|-------|------|----------------|
| 1 | Robotics | Six pairs of the split layout, large panel and small panel: Leadership with Sponsor logo, Events part 1 with Task counts, Events part 2 with Weather forecast, Sponsor feature with Next event, Subteam spotlight with Mini panel idea 1, Photos with Parts request. Then the wide layout: Department tasks, open, for each of the nine departments (Build, Electrical, Programming, Design, CNC, Strategy, Operations, Business, Marketing), the three TV charts (Status by department, Overall progress, Timeline), and one roster for Business and Marketing |
| 2 | Prime | Team leads page 1 and 2, then the two roster rows of Build |
| 3 | Nova | The same for Nova |
| 4, 5 | Prime, Nova | The two roster rows of Electrical |
| 6 | Robotics | The six pairs of block 1, with no Monday rows |
| 7, 8 | Prime, Nova | The two roster rows of Programming |
| 9, 10 | Prime, Nova | The two roster rows of Design and CNC (one department of the Team leads, DESIGN · CNC) |
| 11 | Robotics | The six pairs again |
| 12, 13 | Prime, Nova | The two roster rows of Strategy |
| 14, 15 | Prime, Nova | Robot status, 3D view, Drive hours, Competition rank |

The two rows of a department of a team view are Team roster part 1 and part 2 (`roster`). The row names its department (`department`, a Team lead name in any case, or two with a comma) and the team comes from the view. A Department tasks row (`monday-department`) names one of the nine departments, a list (`list`, open or done) and a team (`team`, prime, nova, or none for both teams), and a TV charts row (`monday-charts`) names a chart (`chart`, status, progress or timeline) and a team (docs/monday.md).

| Named panel | Registry id |
|-------------|-------------|
| Leadership Roster | `leadership` |
| Upcoming Events 1 and 2 | `events`, `part` 1 and 2 |
| Sponsor Spotlight, Sponsor Logo Spotlight | `sponsor-feature`, `sponsor-logo` |
| Task Counts, Weather Forecast, Next Event | `task-counts`, `forecast`, `next-event` |
| Subteam Spotlight, Photos | `spotlight`, `photo` (4 photos of 10 seconds) |
| Mini Panel Idea 1 | `miniIdea1`, a title and a dashed inner frame |
| QR Code for Parts Request | `qrParts`, see below |
| Team Leads, Team Leads 2 | `team-leads`, `part` 1 and 2 |
| Team Roster 1, Team Roster 2 (Scroll) | `roster`, `part` 1 (six people) and 2 (the people after them, scrolled six at a time) |
| Department tasks, TV Charts | `monday-department`, `monday-charts` |
| Total Robot Status, 3D Wireframe of Robot | `robotStatus`, `wireframe` |
| Drive Hours Recorded | `driveHours`, new |
| Prime FRC Ranking, Nova FRC Ranking | `competition-rank`, in the team of the view |

- A row can name the small panel shown beside it (`side`, Small panel beside it). While the row is on the screen the small frame plays that panel, whatever the topic of the large one, and the next row moves it on. A row with no side leaves the small frame with the small panels of the view. In the wide layout there is no small frame.
- `part` is 1 or 2 for Events, Subteam roster and Team leads. Part 2 has nothing to show when the list fits on page 1, and the row is skipped.
- The Parts request panel draws a QR code of `partsRequestUrl` (Dashboard Settings, Screen tab, Parts request address). The address must start with https:// and be 200 characters or fewer. With none it shows PARTS REQUEST and LINK NOT SET and the rotation skips it. `core/qr.js` makes the code (byte mode, level M, versions 1 to 10), and `tests/qr.test.mjs` reads it back.
- Drive hours adds the hours of the Monday board for each person, the most hours first, six rows a page, scrolled, up to 18 people. The people and hours are those of the roster.
- The status pie shows the tasks of the team, or of the department of its row, by status, with the words of each status and its count beside it.
- Daily Agenda is not in the default rotation. Add a row for it in Dashboard Settings if it is wanted. The older lists of the views are kept and `migrateRotationFromViews` builds a list from them.

## Robotics

- The banner title is HAWKTIMUS ROBOTICS (Look tab, Title of the Robotics view; the older default title reads as the new one). The team plate shows both numbers, Prime first and then Nova, from the Team documents (`teamNumbersOf` in `core/teams.js`): one wide plate reading TEAM 3229 & TEAM 3426 in the standard layout, and two lines at 30px in the side column of the bar layout, the first in the label color and the second in the second accent. With one Team document it shows one number. The Prime view shows the number of Prime and the Nova view the number of Nova. The page chooses the plate from `html[data-view]` in `family-line.css`, so a change of view never leaves a wrong plate. While the sample content is on, its label sits over the hawk on this view.
- The look is the Prime look: its logo and colors. Items that are for one team show for Prime and the shared ones for both.
- A Monday board plays in the bar view of its team. A step whose panel is Department tasks or a TV chart, in a Robotics block, is played for the length of the step (`playViewOf` in `core/views-play.js`) in the Condensed view (the family view) when the tasks are for both teams, in the Prime view for Team Prime and in the Nova view for Team Nova. Condensed has only the tasks that are for both teams (`ofTeam` in `core/monday-views.js`), and a team page has the tasks of its team and the General ones. A Subteam roster row of Robotics with a team plays in that team's view too. A step in the Prime or Nova view takes that team's look and is left out when the team is not switched on. The step keeps its row and its block, so the clock and the rows do not change: only the view that is drawn does. The view change is the usual swap, into the board and out again when the next row is not a Monday board, and consecutive Monday rows stay in Condensed with no swap between them. The view the rotation was in is the one that comes back, because the next Robotics step plays in Robotics. A Monday row in a Prime or Nova block plays in that team's view, as before. The Condensed view shows both team numbers on its plate, like Robotics (`family-line.css`). The Rotation board and the Display tab say Plays in the Condensed view, Plays in the Prime view or Plays in the Nova view on such a row. An older monday-tasks row with a department is judged as the Department tasks row it plays as, so it is the same.
- Two layouts, chosen for each row by its panel (`roboticsWidePanels` in `config-rotation.js`). Split is the standard layout: the main panel at the left, the Gamedrop countdown with its red clock frame at the top right and Panel B at the bottom right. Wide is the bar layout: the countdown in the banner and the side column at the left. The two Monday panels, the roster and the two placeholders are wide, and every other panel is split. A change of layout between two rows is a swap. The layout is part of the look (`core/theme-apply.js`, `sameLook`), so a row that changes only the layout still reaches the page; before, a layout change that came with no change of style, team or view was dropped, and a split row after a wide one could stay in the bar layout with its small panel hidden. The Monday panels no longer reach the wide layout inside Robotics: they play in the Condensed view.
- Prime and Nova keep their structure. Nova is mirrored.
- There are no view chips, and a team's name is in the banner once on a page: the panel titles do not repeat it (BUILD TASKS, DONE, TIMELINE, BOARD) and the panels draw no team chip. The stored `viewTag` and `teamChip` fields are hidden and not read.
- Daily Agenda is the first row of every Robotics block that the migration makes.

## Departments, rosters and placeholders

- On the roster, Design and CNC are one department, DESIGN · CNC, with the tasks of both Team leads. Department tasks keeps Design and CNC apart, as the board does.
- The roster comes from the Monday board, not from Sanity: the people are the contacts of a department's tasks (the first person of the Assigned column) and their hours are the hours of those tasks (the Estimated Hours column). A page is one department and six rows. Only while the board has no owner at all does the roster show the older Team leads pages.
- Robot status (ROBOT STATUS) and Wireframe view (3D VIEW) are panels of the Rotation list that draw their title and a dashed inner frame, until they are designed.

## Monday rows

A Department tasks row plays one department, one list and both teams or one, and is left out while it has nothing to show. A row with no department plays nothing. A row of one of the eleven retired Monday panels plays nothing; an older tasks row with one of the nine departments plays as Department tasks, open, in the team of its view. The Team lead switch On the Monday board (`monday: false`) is hidden and not read any more: a row names its department.

## Names and the tag

- `generalViewName` and `generalViewTitle` (default HAWKTIMUS ROBOTICS) are in Dashboard Settings, Look tab. The Robotics banner carries the title. A team view carries its team's name.
- The view tag is not drawn any more. The name of a view is still worked out (`viewNameOf`) and written on the page for the control page.

## The look

The look of the views is not designed yet. A bar view is drawn in the bar layout in whatever theme is on (the held view asks for it in `core/style.js`, `layoutFor`). The theme of the day is `themeByWeekday` of Dashboard Settings. `mondayStyle` and the banner settings still come from the Screen documents, which are kept and read for that and to seed the views. The page carries `data-view`, `data-theme` and, on the large area, `data-page-number` for the report to the control page.

## Weather

The weather comes from Open-Meteo, which needs no key, so nothing about it is in `computer/local.env`. It is read every 15 minutes. A failed read keeps the last reading. A reading more than two hours old is dropped, and the panels draw dashes and no icon. Nothing in the weather code throws at the screen.

## Files

- `core/views.js`: the documents, the lists, the clock and the look of a step (no page).
- `core/views-run.js`: gives them the real screen.
- `core/view-apply.js`: the view held and the view written on the page.
- `core/rotation.js`: the rows, the blocks, the kind of transition and the migration.
- `tests/rotation.test.mjs`.
- `tests/views.test.mjs`.
