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

## The rotation

- `viewOrder` (Dashboard Settings, Look tab) is the order. A view left out of it never plays. The starting order is General, Prime, Nova, Family.
- A view stays for its minutes (1 to 30). Then the next view in the order that has something to show comes. A view with nothing to show, or whose team has no document, is skipped. If only one view has something to show, it stays and no swap plays.
- The swap (the pull apart and re-form) plays at every change of view. Inside a view the panels change with the plain page change.
- The minutes stand still while an alert, an announcement, a talk, a demo, the night screen or a hidden transition has the screen. The view that was interrupted comes back at the panel that was next, because the lists are not touched.
- The control page can hold a view (`showView`), hold a panel (`holdPanel`), preview a theme (`previewTheme`) or pause the rotation (`pauseRotation`). The runtime reads them once a second through `activeRequests()` in `core/screen-requests.js`. A held panel is the only one the large panel plays, in the first view that has it. With `?style=` or `?team=` in the address the screen plays the first view and holds nothing.

## Monday rows

A Monday tasks row of a team view with no department stands for every Team lead that has tasks for the team. A Team lead with `monday: false` is left out, and one with no mark is on. It is worked out each time the list is read, so a new department needs no edit. A department with no tasks is left out. A row with a department of its own plays that department only.

## Names and the tag

- `generalViewName` (default General) and `generalViewTitle` (default Hawktimus Dashboard) are in Dashboard Settings, Look tab. The General and Family banners carry the title. A team view carries its team's name.
- The view tag is the name of the view at 30px in the team label color, at the far end of the banner. A team view is named for the short name of its team. Family has no tag.

## The look

The look of the views is not designed yet. A bar view is drawn in the bar layout in whatever theme is on (the held view asks for it in `core/style.js`, `layoutFor`). The theme of the day is `themeByWeekday` of Dashboard Settings. `mondayStyle` and the banner settings still come from the Screen documents, which are kept and read for that and to seed the views. The page carries `data-view`, `data-theme` and, on the large area, `data-page-number` for the report to the control page.

## Weather

The weather comes from Open-Meteo, which needs no key, so nothing about it is in `mini/local.env`. It is read every 15 minutes. A failed read keeps the last reading. A reading more than two hours old is dropped, and the panels draw dashes and no icon. Nothing in the weather code throws at the screen.

## Files

- `core/views.js`: the documents, the lists, the clock and the look of a step (no page).
- `core/views-run.js`: gives them the real screen.
- `core/view-apply.js`: the view held and the view written on the page.
- `tests/views.test.mjs`.
