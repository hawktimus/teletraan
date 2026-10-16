// Decides which page is on screen in each region, and for how long.
//
// Each region (grid1, grid2, ticker) steps through its list on its own timer.
// One rule links them: Grid 1 and Grid 2 never show the same topic at the
// same moment, so while Tasks is on the left, the task counts are skipped. The
// small frame is the one exception, when nothing else would fill it (rounds below).
//
// A region keeps its frame and swaps only the page (areas.js). A page's
// seconds count from the moment it starts to arrive until it has left: the
// time it takes to arrive (about a second), the time it is held still, and
// the last second, when it leaves. The next page is chosen when the old one
// starts to leave, so the frame always knows what comes next.
//
// How long a page stays and the pause between pages follow the Speed
// setting (frame.pace()). Announcements and alerts do not: the editors give
// their seconds directly.
//
// The list of the large panel is the rows of the view that plays (core/views.js). When a row is chosen, before its
// page is built, the views are asked what look the row needs: the team, the style and the view it plays in
// (setLookHooks below, core/views-run.js).

export {
  pauseRotation, resumeRotation, holdClock, startListsOver, skipRow, setLookHooks, showPagesNow, restartRotation,
  moveOn, secondsUntilChange,
} from './schedule-hold.js';
export { startRotation, startRotationForLayouts, startTicker, startTogether } from './schedule-run.js';
