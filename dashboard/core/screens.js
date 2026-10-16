// The Screens: the plain functions. They know nothing about the page, so tests/screens.test.mjs can run
// them. core/screens-run.js gives them the real screen, and core/schedule.js asks them at every page of the
// large panel.
//
// How it goes (docs/layouts.md, "The Screens"):
//   1. A Screen is one of three documents, Original, Cybertron and Minimal. Its id says its style. It holds the
//      rows of the large panel (area B), the rows of the small panel (area D), the minutes between the name
//      effect and between the flights of the hawk, the length of a swap and the style it uses while a Monday
//      row plays.
//   2. The Screen of the day is picked from the weekday in the time zone of the Look page (planFor). It is picked
//      at boot and at the first row change after midnight, because the plan is worked out again at every row.
//   3. The large panel plays the rows of the Screen of the day from the top and starts again at the end. The team on the
//      screen is a state: a row with a team other than the one on the screen is a swap into that team, and a row
//      with no team keeps it. A Monday row plays in the Monday style of the Screen. Going into it is a swap when the
//      style changes and so is coming out of it (lookForStep and changesBetween). In full motion every move from
//      a Monday card or to one is a swap, also with the same style (core/swap-run.js).
//   4. The small panel plays the side rows of the Screen that is on the screen, on its own timer.
//   5. A Screen with no rows, or with no document at all, plays rows built from the Panel order (seedMainRows
//      and seedSideRows), so nothing is blank before anyone has opened the Screens in the Studio.
//
// Next look now (a button on the Start here page) moves the large panel to the next row at once.

export {
  handledKey, isMondayPanel, isTeamCode, tidyMainRow, tidySideRow, tidyScreen, tidyScreens, weekdayIn,
  tidySchedule, screenStyleFor,
} from './screens-rows.js';
export {
  teamsOf, resolveScreen, planFor, heldLook, onScreenChange, holdScreenLook, currentScreen, cadenceOf, swapScaleOf,
  mainPlaylist, stepsOfRow, sidePlaylist, styleCanGoOn, lookForStep, changesBetween, walkSteps, bootLook,
  holdBootScreen, tidyNextLookRequest, makeNextLookRunner,
} from './screens-plan.js';
export { seedMainRows, seedSideRows } from './screen-seed.js';
