// The Views: the plain functions. They know nothing about the page, so tests/views.test.mjs can run them.
// core/views-run.js gives them the real screen, and core/schedule.js asks them at every page of the large panel.
//
// How it goes (docs/views.md):
//   1. A View is one of four documents, General, Prime, Nova and Family. Its id says its key. It holds a layout (fixed by
//      the key), a team, the minutes it stays on the screen, the rows of the large panel and the rows of the small panel.
//      A document that is missing, or has no rows, is the view of defaultViews in config.js.
//   2. viewOrder of Dashboard Settings says the order they play in. The screen shows a view for its minutes and then
//      moves to the next one in the order that has something to show. A swap plays at every view change. Inside a
//      view the panels change with the plain page change.
//   3. The theme of the day (the Screens' schedule, core/screens.js) is drawn over whichever view plays. The Screen
//      documents stay as they were: they hold the banner settings and the Monday style, and the seed of the Views.
//   4. The minutes stand still while an alert, an announcement, a talk, a demo or the night screen has the screen, so
//      the view that was interrupted is the view that comes back, at the panel that was next.

export {
  longestName, viewOrderOf, tidyView, tidyViews, resolveView, viewNameOf, viewTitleOf, viewShowsTag,
} from './views-tidy.js';
export {
  viewSteps, viewSideSteps, playViewOf, dayThemeFor, viewPlan, viewLayoutOf, layoutOfStep, drawStyleFor, stepInView,
  lookForViewStep, cycleKey, cycleBlock, cycleSeconds, resetViews, holdPanelId, holdRowOf, findViewWithPanel, viewPlaylist,
  viewSidePlaylist, pairSide, tickView, holdBootView,
} from './views-play.js';
export { heldView, holdView } from './view-apply.js';
