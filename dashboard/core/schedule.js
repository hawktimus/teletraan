// Decides which page is on screen in each region, and for how long.
//
// Each region (grid1, grid2, ticker) steps through its list on its own timer.
// One rule links them: Grid 1 and Grid 2 never show the same topic at the
// same moment, so while Tasks is on the left, the task counts are skipped.
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

import * as frame from '../frame.js';
import { defaultSettings } from '../config.js';
import { buildPage, canShow, moduleOf, regionOf, topicOf } from './panels.js';
import { ownSeconds } from './photos.js';
import { changePage, clearRegion } from './areas.js';
import { hasRegion, layoutNow } from './layout.js';

// The topics on screen in each grid region right now. While a page is
// leaving it holds two: the one going and the one coming.
const onScreen = { grid1: [], grid2: [] };
const shortestStay = 5; // seconds
const shortestHold = 1000; // milliseconds
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
function rotationPaused() {
  return pauses > 0 || frame.isPaused();
}

// Counts the calls to showPagesNow(). A page that was chosen before a call
// does not get its full stay.
let pagesRefreshed = 0;

// Counts the calls to restartRotation(). A loop that sees a new number starts its list again
// from the first panel.
let restarts = 0;

// Counts, for each region, how many times it has been asked to move on at once
// (moveOn). Like pagesRefreshed, but for one region only.
const moves = { grid1: 0, grid2: 0, ticker: 0 };

// What a page that was chosen before an ask compares: both counts together.
// Both only ever grow, so the sum changes whenever either does.
function changeCount(region) {
  return pagesRefreshed + (moves[region] || 0);
}

// How many milliseconds of its stay each region still has to wait, while it is
// holding a page still. A region that is changing page has no entry.
const holdLeft = {};

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

// Waits, but the clock stands still while paused. A time of zero or less (a
// mistake in the settings) still waits a second, so a loop can never spin
// without stopping. since is changeCount(region) when the page was chosen: if
// showPagesNow() or moveOn() was called after that, the wait ends. region is
// null for the views that change all their panels together.
async function hold(milliseconds, since, region) {
  let left = milliseconds > 0 ? milliseconds : 1000;
  try {
    while (left > 0 && changeCount(region) === since) {
      if (region) holdLeft[region] = left;
      await frame.wait(250);
      if (!rotationPaused()) left -= 250;
    }
  } finally {
    if (region) delete holdLeft[region];
  }
}

async function waitWhilePaused() {
  while (rotationPaused()) await frame.wait(250);
}

// How long a page stays, in milliseconds, with the Speed setting applied.
// A row's own seconds win. The Photo panel's row, with none, follows Seconds
// per photo (Photos tab, see ownSeconds in photos.js). Otherwise the whole
// board follows Seconds per page in Dashboard Settings: the small panel stays
// three quarters as long and the ticker one and a half times as long. The
// ticker's own seconds (Dashboard Settings, Panels) come in as rowSeconds too.
// Fast never takes a page below 5 seconds, unless the editors asked for less
// than that to begin with. The settings are read each time, so a change
// applies at the next page.
function stayFor(region, rowSeconds, settings) {
  const board = Number(settings.pageSeconds) > 0 ? Number(settings.pageSeconds) : defaultSettings.pageSeconds;
  const automatic = {
    grid1: board,
    grid2: Math.max(6, Math.round(board * 0.75)),
    ticker: Math.max(8, Math.round(board * 1.5)),
  };

  const seconds = Number(rowSeconds) > 0 ? Number(rowSeconds) : automatic[region];
  return Math.max(seconds * frame.pace(), Math.min(seconds, shortestStay)) * 1000;
}

// How long the page is held still: its stay, less the time it took to arrive
// and the second it will take to leave
function holdFor(stay, arrivedAfter) {
  return Math.max(stay - arrivedAfter - frame.turnMs(), shortestHold);
}

// region is 'grid1' or 'grid2'
// getPlaylist() returns the list of { panel, show, seconds } for that region
// getContent() returns the newest content
// A region the layout does not have (the small frame in the sidebar layout,
// core/layout.js) is never started, so none of its panels is ever drawn.
export function startRotation(region, getPlaylist, getContent) {
  if (!hasRegion(layoutNow(), region)) return;

  const otherRegion = region === 'grid1' ? 'grid2' : 'grid1';
  let position = -1;
  let seenRestarts = restarts;
  let somePanelFailed = false; // set by pickPage when a panel could not be drawn

  // The next step in the list that is allowed on screen right now
  function chooseNext() {
    const playlist = getPlaylist();
    const content = getContent();

    for (let tries = 1; tries <= playlist.length; tries++) {
      const index = (position + tries) % playlist.length;
      const step = playlist[index];
      if (step.show === false) continue;
      if (regionOf(step.panel) !== region) continue; // a panel in the wrong list is ignored
      if (!canShow(step.panel, content)) continue;

      const topic = topicOf(step.panel);
      if (topic && onScreen[otherRegion].includes(topic)) continue;

      position = index;
      return step;
    }
    return null;
  }

  // The next page, built and ready, or null when nothing can be shown. A
  // panel that fails to draw is skipped and the one after it is tried, so
  // one bad panel can neither stop the region nor spin it.
  function pickPage() {
    const attempts = getPlaylist().length;
    somePanelFailed = false;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const step = chooseNext();
      if (!step) return null;

      try {
        const page = buildPage(step.panel, getContent());
        const topic = topicOf(step.panel);
        if (topic) onScreen[region].push(topic); // at once, so the other region sees it
        return { page: page, step: step, topic: topic };
      } catch (error) {
        somePanelFailed = true;
        console.error('Panel "' + step.panel + '" could not be drawn and is skipped', error);
      }
    }
    return null;
  }

  // not awaited by the caller: this runs in the background and never ends
  async function loop() {
    while (true) {
      try {
        await waitWhilePaused();
        if (seenRestarts !== restarts) {
          seenRestarts = restarts;
          position = -1;
        }
        const since = changeCount(region);
        const next = pickPage();

        // Nothing could be drawn: leave the page that is on screen and try again
        if (!next && somePanelFailed) {
          await frame.wait(5000);
          continue;
        }

        // the old page leaves and the next arrives, or the region empties
        const arrivedAfter = await changePage(region, next ? next.page : null);
        onScreen[region] = next && next.topic ? [next.topic] : [];

        if (next) {
          const settings = getContent().settings;
          await hold(holdFor(stayFor(region, ownSeconds(next.step, settings), settings), arrivedAfter), since, region);
        } else {
          await frame.wait(1000); // nothing to show right now
        }
      } catch (error) {
        console.error('The ' + region + ' rotation hit a problem and will try again', error);
        clearRegion(region);
        onScreen[region] = [];
        await frame.wait(5000);
      }
    }
  }

  loop();
}

// The ticker shows one line at a time, swapped in place. The ticker panel
// supplies the list of lines with items(content).
export function startTicker(getContent) {
  let position = -1;
  let seenRestarts = restarts;

  async function loop() {
    while (true) {
      try {
        await waitWhilePaused();
        if (seenRestarts !== restarts) {
          seenRestarts = restarts;
          position = -1;
        }

        const since = changeCount('ticker');
        const content = getContent();
        const module = moduleOf('ticker');
        const lines = module && module.items ? module.items(content) : [];
        if (lines.length === 0) {
          await changePage('ticker', null);
          await frame.wait(5000);
          continue;
        }

        position = (position + 1) % lines.length;
        let page;
        try {
          page = buildPage('ticker', Object.assign({}, content, { tickerLine: lines[position] }));
        } catch (error) {
          // the line on screen stays and the next line is tried
          console.error('A ticker line could not be drawn and is skipped', error);
          await frame.wait(5000);
          continue;
        }
        const arrivedAfter = await changePage('ticker', page);
        await hold(holdFor(stayFor('ticker', content.settings.rotation.tickerSeconds, content.settings), arrivedAfter), since, 'ticker');
      } catch (error) {
        console.error('The ticker hit a problem and will try again', error);
        clearRegion('ticker');
        await frame.wait(5000);
      }
    }
  }

  loop();
}

// Used by the hardware test (?stress) and by ?show=<panel id>: several
// panels arrive together, are held, and change together, over and over. The
// time given is how long each is held still.
export function startTogether(ids, getContent, holdSeconds) {
  // A panel of a region the layout does not have is left out. A name that is not
  // a panel stays, so building it reports the mistake as before.
  ids = ids.filter(id => regionOf(id) === null || hasRegion(layoutNow(), regionOf(id)));
  if (ids.length === 0) return;

  async function loop() {
    while (true) {
      try {
        const since = changeCount(null);
        const pages = ids.map(id => buildPage(id, getContent()));
        await Promise.all(pages.map(page => changePage(page.region, page)));
        await hold(holdSeconds * 1000, since, null);
      } catch (error) {
        console.error('The stress test hit a problem', error);
        ids.filter(id => regionOf(id)).forEach(id => clearRegion(regionOf(id)));
        await frame.wait(5000);
      }
    }
  }

  loop();
}
