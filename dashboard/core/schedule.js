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
// The list of the large panel is gone through in passes. At the end of every pass, before the next
// page is chosen, the look rotation is asked whether the screen moves to another look and another
// list (setLookHooks below, core/look-rotation-run.js).

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

// A swap (core/swap-run.js) holds the clock of the pages for as long as it plays: the seconds a page has
// left to stay do not run down. The areas still pick their next pages and swap them, which a pause
// would stop.
let clockHeld = 0;

export function holdClock(on) {
  clockHeld = Math.max(0, clockHeld + (on ? 1 : -1));
}

// Counts the calls to showPagesNow(). A page that was chosen before a call
// does not get its full stay.
let pagesRefreshed = 0;

// Counts the calls to restartRotation(). A loop that sees a new number starts its list again
// from the first panel.
let restarts = 0;

// Starts every list again from its first panel at its next page change, and leaves the frames and the
// pages where they are. Next look now uses it (core/look-rotation-run.js), for a new pass.
export function rewindRotation() {
  restarts += 1;
}

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

// The look rotation gives these two, once, when it starts (core/look-rotation-run.js):
//   atPass(now)   asked for the large panel at the end of every pass of its list, before the next page is
//                 chosen. It may take its time, for a swap of look that plays. It answers true when
//                 the list has to start again from its first panel, because the next pass is another one.
//   playlist(list)  the list the large panel follows: the Monday cards while a Monday pass is up,
//                 and the list it was given otherwise
let lookHooks = null;

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
      if (!rotationPaused() && clockHeld === 0) left -= 250;
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
// per photo (Screen tab, see ownSeconds in photos.js). Otherwise the whole
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

// How many pages a card is held for. A card with more rows than fit (the Monday cards, panels/monday-*)
// says so with scrollPages(content, page) in its script: it is held for its time, then its list moves up
// by a page of rows and it is held for the same time again. Every other panel is one page. A problem
// in the panel's answer is one page.
function pagesOfCard(id, content, page) {
  const module = moduleOf(id);
  if (!module || !module.scrollPages) return 1;

  try {
    return Math.max(1, Math.floor(Number(module.scrollPages(content, page))) || 1);
  } catch (error) {
    console.error('Panel "' + id + '" could not say how many pages it has', error);
    return 1;
  }
}

// How the small frame chooses its next page. Its list has three kinds of step (withStandIns in
// core/panel-order.js): the rows of Panel order, then the small panels the list does not name (standIn
// 'spare'), then the one that always has something to show (standIn 'last'). A round is tried only when
// every round before it found nothing. The rows come first, and no round before the third lets Grid 1 and
// Grid 2 show the same topic. A panel that is not in the list is better than a repeated topic, a repeated
// topic is better than an empty frame, and the panel that is always there is the last choice of all. A
// step that is switched off is skipped in every round. The large frame has the first round only.
const rounds = [
  { standIn: '', sameTopic: false },
  { standIn: 'spare', sameTopic: false },
  { standIn: '', sameTopic: true },
  { standIn: 'spare', sameTopic: true },
  { standIn: 'last', sameTopic: true },
];

// region is 'grid1' or 'grid2'
// getPlaylist() returns the list of { panel, show, seconds } for that region. A step of a panel with
// more than one page also has page, counting from 1 (withPages in core/panel-order.js), which is
// given to the panel's hasContent and mount.
// getContent() returns the newest content
// A region the layout does not have (the small frame in the sidebar layout,
// core/layout.js) is never started, so none of its panels is ever drawn.
export function startRotation(region, getPlaylist, getContent) {
  if (!hasRegion(layoutNow(), region)) return;

  const otherRegion = region === 'grid1' ? 'grid2' : 'grid1';
  let position = -1;
  let seenRestarts = restarts;
  let somePanelFailed = false; // set by pickPage when a panel could not be drawn

  // The large panel follows the list the look rotation gives it. A problem there leaves the list as it is.
  function readPlaylist() {
    const list = getPlaylist();
    if (region !== 'grid1' || !lookHooks) return list;

    try {
      return lookHooks.playlist(list);
    } catch (error) {
      console.error('The look rotation could not give the list of the large panel', error);
      return list;
    }
  }

  // The next step in the list that is allowed on screen right now, and whether getting to it goes
  // round the end of the list (the first pass has ended). It changes nothing. skip holds the places of
  // the steps that could not be drawn this time.
  function findNext(skip = []) {
    const playlist = readPlaylist();
    const content = getContent();
    const myRounds = region === 'grid2' ? rounds : rounds.slice(0, 1);

    for (const round of myRounds) {
      for (let tries = 1; tries <= playlist.length; tries++) {
        const index = (position + tries) % playlist.length;
        const step = playlist[index];
        if (step.show === false || skip.includes(index)) continue;
        if ((step.standIn || '') !== round.standIn) continue;
        if (regionOf(step.panel) !== region) continue; // a panel in the wrong list is ignored
        if (!canShow(step.panel, content, step.page)) continue;

        const topic = topicOf(step.panel);
        if (topic && !round.sameTopic && onScreen[otherRegion].includes(topic)) continue;

        return { index: index, step: step, wrapped: position + tries >= playlist.length };
      }
    }
    return null;
  }

  function chooseNext(skip) {
    const found = findNext(skip);
    if (!found) return null;

    position = found.index;
    return found.step;
  }

  // The next page would be the first of the list again, or there is none to show: the pass is over
  function passIsOver() {
    const found = findNext();
    return found === null || found.wrapped;
  }

  // A restart has been asked for: the list begins again at its first panel
  function followRestarts() {
    if (seenRestarts === restarts) return;

    seenRestarts = restarts;
    position = -1;
  }

  // The look rotation is asked once at the end of every pass of the large panel. A problem there
  // leaves the pass going on.
  async function askLookRotation() {
    if (region !== 'grid1' || !lookHooks || !passIsOver()) return;

    try {
      if (await lookHooks.atPass(new Date())) position = -1;
    } catch (error) {
      console.error('The look rotation could not move to the next pass', error);
    }
  }

  // The next page, built and ready, or null when nothing can be shown. A
  // panel that fails to draw is skipped and the one after it is tried, so
  // one bad panel can neither stop the region nor spin it.
  function pickPage() {
    const attempts = readPlaylist().length;
    const failed = [];
    somePanelFailed = false;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const step = chooseNext(failed);
      if (!step) return null;

      try {
        const page = buildPage(step.panel, getContent(), step.page);
        const topic = topicOf(step.panel);
        if (topic) onScreen[region].push(topic); // at once, so the other region sees it
        return { page: page, step: step, topic: topic, pages: pagesOfCard(step.panel, getContent(), step.page) };
      } catch (error) {
        somePanelFailed = true;
        failed.push(position);
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
        followRestarts();
        await askLookRotation();
        followRestarts(); // a swap of look can restart the lists
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
          const held = holdFor(stayFor(region, ownSeconds(next.step, settings), settings), arrivedAfter);
          await hold(held, since, region);

          // a card with more rows than fit moves its list up and is held again, for the same time. A
          // page that was ended early (changeCount moved) does not go on.
          for (let shown = 1; shown < next.pages && changeCount(region) === since; shown++) {
            frame.scrollCard(next.page.element, shown);
            await hold(held, since, region);
          }
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
