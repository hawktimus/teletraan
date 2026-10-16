# Views

The screen plays four views in turn: General, Prime, Nova and Family. A view is a layout, a team, the minutes it stays, the rows of the large panel and the rows of the small panel. Each is a document in the Studio (ids view-general, view-prime, view-nova, view-family). A document that is missing, or has an empty list, plays the starting view in `dashboard/config.js` (`defaultViews`), which has the shape of `studio/tools/view-defaults.js`. A view also carries `layout`, `mirror`, `countdownIn`, `viewTag`, `teamChip` and `colors`.

## What each view is

| View | Layout | Team | Minutes | Starting panels |
|------|--------|------|---------|-----------------|
| General | standard | none | 6 | Daily Agenda 45 s, Events 60 s, Leadership 20 s, Photos 4 x 10 s, Sponsors 15 s. Small panel: Next event 30 s, Task counts 20 s, Safety days 20 s, Weather 15 s, Sponsor logo 15 s |
| Prime | bar | Prime | 6 | Monday tasks, Done, Timeline and Board, 30 s each |
| Nova | bar, mirrored | Nova | 6 | The same for Nova |
| Family | bar | none | 2 | Overall progress and Status by department (fixed) |

The bar layout has no small panel. Nova is mirrored because the Nova team has Mirror switched on.

## Where the older panels are

The starting rows hold the panels listed above and no more. Other panels are not in a starting row, so they appear only when a row for them is added to a view in the Studio: Tasks, Team leads, Subteam spotlight, Roster, the Monday milestone and progress cards, Extra panels, the Season timeline and the team tile. Competition cards are not rows. They are mixed into the large panel of the view on the screen when they are due, in the team of that view. The announcement plate and the alert, talk and night screens come over any view. `tools/screenshots.mjs` takes each view in each theme with each team (`view-<view>-<theme>-<team>.png`).

## The rotation

One ordered list says what the large panel plays: Dashboard Settings, Look tab, Rotation (stored as `rotationRows`, because `rotation` is the name of the Ticker block on the same page). Each row is a view (Robotics, Prime or Nova), a panel, the seconds it stays and a Shown switch. Drag a row to move it. A row that is not Shown keeps its place in the order and plays nothing, so it can be turned back on without sorting again.

- The screen walks the list from the top and starts again at the end. Rows that follow each other in one view are a block. The view changes only between blocks, with the swap. Inside a block the panels change with the plain page change.
- A row whose panel has nothing to show right now (no Monday tasks, no photos, no events) is skipped, with no change and no gap. A block with nothing to show is skipped whole. If only one block has something to show, it stays and starts again.
- A block stays for the seconds of its rows that have something to show. A row with no seconds follows Seconds per page.
- The first time Dashboard Settings is opened with the list empty, the Studio fills it from the lists of the views, in the order of the views and of each list, with Daily Agenda first in every Robotics block, and the Family rows become Robotics rows. Click Publish all to keep it. Until the list has a Shown row the screen plays the lists of the views as it did, so an untouched Studio changes nothing on the wall.
- `viewOrder`, the minutes of a view and the rows of a view are hidden and marked Not used any more. They are kept, and the first fill reads them.
- `core/rotation.js` has `transitionKindFor(previousRow, nextRow)`. It says `reformView` when the view changes and `reform` inside a view. Until those two transitions are drawn, the screen plays the swap for the first and the page change for the second. `transitionSeconds` (Look tab, 2 to 4, starts at 3) is the length of a whole transition.
- The minutes stand still while an alert, an announcement, a talk, a demo, the night screen or a hidden transition has the screen. The view that was interrupted comes back at the panel that was next.
- The control page can hold a view (`showView`, robotics or general), hold a panel (`holdPanel`), preview a theme (`previewTheme`) or pause the rotation (`pauseRotation`). The runtime reads them once a second through `activeRequests()` in `core/screen-requests.js`. A held panel is the only one the large panel plays, in the first view that has it. With `?style=` or `?team=` in the address the screen plays the first view and holds nothing.

## Monday rows

A Monday tasks row of a team view with no department stands for every Team lead that has tasks for the team. A Team lead with `monday: false` is left out, and one with no mark is on. It is worked out each time the list is read, so a new department needs no edit. A department with no tasks is left out. A row with a department of its own plays that department only.

## Names and the tag

- `generalViewName` (default General) and `generalViewTitle` (default Hawktimus Dashboard) are in Dashboard Settings, Look tab. The General and Family banners carry the title. A team view carries its team's name.
- The view tag is the name of the view at 30px in the team label color, at the far end of the banner. A team view is named for the short name of its team. Family has no tag.

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
