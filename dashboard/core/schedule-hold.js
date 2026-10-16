// Holding, skipping and restarting the rotation of the pages (part of schedule.js).

import * as frame from '../frame.js';
import { clearRegion } from './areas.js';

// The topics on screen in each grid region right now. While a page is
// leaving it holds two: the one going and the one coming.
export const onScreen = { grid1: [], grid2: [] };
export const shortestStay = 5; // seconds
export const shortestHold = 1000; // milliseconds
let pauses = 0; // how many things have paused the rotation and not yet resumed it

// While an alert or announcement covers the screen, the rotation stops. A demo
// pauses it too, for all its steps. It is a count and not a switch, so the
// resume at the end of the announcement a demo plays does not start the pages
// while the demo is still going.
export function pauseRotation() {
  pauses += 1;
}

export function resumeRotation() {
  pauses = Math.max(0, pauses - 1);
}

// The rotation also waits while a talk holds the screen (frame.pause). That hold
// is kept in frame.js, apart from the count above.
export function rotationPaused() {
  return pauses > 0 || frame.isPaused();
}

// A swap (core/swap-run.js) holds the clock of the pages for as long as it plays: the seconds a page has
// left to stay do not run down. The areas still pick their next pages and swap them, which a pause
// would stop.
export let clockHeld = 0;

export function holdClock(on) {
  clockHeld = Math.max(0, clockHeld + (on ? 1 : -1));
}

// Counts the calls to showPagesNow(). A page that was chosen before a call
// does not get its full stay.
let pagesRefreshed = 0;

// Counts the calls to restartRotation(). A loop that sees a new number starts its list again
// from the first panel.
export let restarts = 0;

// Counts the calls to startListsOver(). A loop that sees a new number plays its list from the first step, and
// nothing on screen is cleared.
export let listResets = 0;

// The views (core/views-run.js) move to the next view: both lists begin again at the first step of the view
// that comes, at the next page change, while the frames and the page on screen stay as they are
export function startListsOver() {
  listResets += 1;
}

// The large area says which page of its card is on screen (data-page-number), for the report to the control page
export function notePageNumber(region, number) {
  if (region !== 'grid1' || typeof document === 'undefined' || typeof document.querySelector !== 'function') return;

  try {
    const area = document.querySelector('.area[data-area="grid1"]');
    if (area && area.dataset) area.dataset.pageNumber = String(number);
  } catch (error) {
    console.error('The page number could not be written', error);
  }
}

// Counts the calls to skipRow(). The loop of the large panel that sees a new number leaves the row it is on.
export let rowSkips = 0;

// Next look now (core/views-run.js): the large panel leaves the row on screen, with every step of it, and plays
// the first step of the next row within a quarter of a second
export function skipRow() {
  rowSkips += 1;
  moveOn(['grid1']);
}

// Counts, for each region, how many times it has been asked to move on at once
// (moveOn). Like pagesRefreshed, but for one region only.
const moves = { grid1: 0, grid2: 0, ticker: 0 };

// What a page that was chosen before an ask compares: both counts together.
// Both only ever grow, so the sum changes whenever either does.
export function changeCount(region) {
  return pagesRefreshed + (moves[region] || 0);
}

// How many milliseconds of its stay each region still has to wait, while it is
// holding a page still. A region that is changing page has no entry.
export const holdLeft = {};

// The Screens give these, once, when they start (core/views-run.js). The large panel asks them about its steps:
//   viewAs(step, run)  runs run() as the team the step is drawn for: its own, or the team on the screen when it has none.
//                  It is how a step is asked whether it has content, because the team goes on the screen only when the
//                  step is chosen
//   fits(step)     false when the step must be left out for now: a Monday card whose style cannot go on the page
//   begin(step)    asked when a step is chosen, before its page is built: holds the look the step needs, the team and
//                  the style, and queues the swap when the look changes
export let lookHooks = null;

export function setLookHooks(hooks) {
  lookHooks = hooks;
}

// Every page on screen leaves early and the next ones are chosen from the
// newest content. Used when the screen switches between sample and real
// content, so pages of the old content do not stay for another 20 seconds.
export function showPagesNow() {
  pagesRefreshed += 1;
}

// Starts the rotation again from the first panel of every list, as when the screen started.
// The pages go at once, without leaving, and each region makes its frame again, so the frames
// assemble. It is for a screen that is covered, such as by the card of a talk that is ending
// (core/presentation-run.js), where nobody sees the pages go.
export function restartRotation() {
  restarts += 1;
  onScreen.grid1 = [];
  onScreen.grid2 = [];
  ['grid1', 'grid2', 'ticker'].forEach(region => clearRegion(region));
  showPagesNow();
}

// Asks these regions (a list of 'grid1', 'grid2' and 'ticker') to move on to
// their next page now, within a quarter of a second. The hidden transitions use
// it (core/hidden-run.js). A region that is changing page at that moment
// carries on and then moves on again at once.
export function moveOn(regions) {
  regions.forEach(region => {
    if (region in moves) moves[region] += 1;
  });
}

// How many seconds until this region changes page by itself, or null when it is
// not holding a page still right now (it is changing page, or has nothing to show).
export function secondsUntilChange(region) {
  return region in holdLeft ? holdLeft[region] / 1000 : null;
}
