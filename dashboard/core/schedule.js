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

// Counts the calls to startListsOver(). A loop that sees a new number plays its list from the first step, and
// nothing on screen is cleared.
let listResets = 0;

// The views (core/views-run.js) move to the next view: both lists begin again at the first step of the view
// that comes, at the next page change, while the frames and the page on screen stay as they are
export function startListsOver() {
  listResets += 1;
}

// Counts the calls to skipRow(). The loop of the large panel that sees a new number leaves the row it is on.
let rowSkips = 0;

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
function changeCount(region) {
  return pagesRefreshed + (moves[region] || 0);
}

// How many milliseconds of its stay each region still has to wait, while it is
// holding a page still. A region that is changing page has no entry.
const holdLeft = {};

// The Screens give these, once, when they start (core/views-run.js). The large panel asks them about its steps:
//   viewAs(step, run)  runs run() as the team the step is drawn for: its own, or the team on the screen when it has none.
//                  It is how a step is asked whether it has content, because the team goes on the screen only when the
//                  step is chosen
//   fits(step)     false when the step must be left out for now: a Monday card whose style cannot go on the page
//   begin(step)    asked when a step is chosen, before its page is built: holds the look the step needs, the team and
//                  the style, and queues the swap when the look changes
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

// Waits, but ends at once when the region is asked to move on (moveOn): a region with nothing to show must not make a swap
// wait for it (core/swap-run.js). since is changeCount(region) when the wait began.
async function waitUnlessAsked(milliseconds, since, region) {
  for (let waited = 0; waited < milliseconds && changeCount(region) === since; waited += 100) await frame.wait(100);
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

// How many pages a card is held for. A card with more rows than fit (the Monday cards, panels/monday-*, and
// the Events panel) says so with scrollPages(content, page) in its script: it is held for its time, then its
// list moves up by a page of rows and it is held for the same time again. Every other panel is one page. A problem
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

  runRotation(region, getPlaylist, getContent);
}

// The same, for a region that the layout may have later: the small frame, which a change of layout gives the screen
// while it runs (core/layout-apply.js). While the layout has no such region the list waits, and a swap that is
// about to give it asks it to move on, so that its first page is waiting at the gate when the layout changes
// (core/areas.js).
export function startRotationForLayouts(region, getPlaylist, getContent) {
  runRotation(region, getPlaylist, getContent);
}

function runRotation(region, getPlaylist, getContent) {
  const otherRegion = region === 'grid1' ? 'grid2' : 'grid1';
  let position = -1;
  let seenRestarts = restarts;
  let seenSkips = rowSkips;
  let somePanelFailed = false; // set by pickPage when a panel could not be drawn

  // The large panel asks the Screens about a step. A problem there leaves the step as it is.
  function askScreens(name, step, fallback) {
    if (region !== 'grid1' || !lookHooks) return fallback;

    try {
      return lookHooks[name](step);
    } catch (error) {
      console.error('The Screens could not answer ' + name + ' for a step of the large panel', error);
      return fallback;
    }
  }

  // Whether a step has content to show. The large panel asks as the team the step is drawn for.
  function hasContentFor(step, content) {
    const ask = () => canShow(step.panel, content, step.page);
    if (region !== 'grid1' || !lookHooks) return ask();

    try {
      return lookHooks.viewAs(step, ask);
    } catch (error) {
      console.error('The Screens could not say which team a step of the large panel is drawn for', error);
      return ask();
    }
  }

  // The next step in the list that is allowed on screen right now. It changes nothing. skip holds the places of
  // the steps that could not be drawn this time.
  function findNext(skip = []) {
    const playlist = getPlaylist();
    const content = getContent();
    const myRounds = region === 'grid2' ? rounds : rounds.slice(0, 1);

    for (const round of myRounds) {
      for (let tries = 1; tries <= playlist.length; tries++) {
        const index = (position + tries) % playlist.length;
        const step = playlist[index];
        if (step.show === false || skip.includes(index)) continue;
        if ((step.standIn || '') !== round.standIn) continue;
        if (regionOf(step.panel) !== region) continue; // a panel in the wrong list is ignored
        if (!askScreens('fits', step, true)) continue;
        if (!hasContentFor(step, content)) continue;

        const topic = topicOf(step.panel);
        if (topic && !round.sameTopic && onScreen[otherRegion].includes(topic)) continue;

        return { index: index, step: step };
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

  let seenListResets = listResets;

  function followListResets() {
    if (seenListResets === listResets) return;

    seenListResets = listResets;
    position = -1;
  }

  // A restart has been asked for: the list begins again at its first panel
  function followRestarts() {
    if (seenRestarts === restarts) return;

    seenRestarts = restarts;
    position = -1;
  }

  // Next look now has been pressed: the position goes to the last step of the row on screen, so that the step after it
  // is the first of the next row
  function followRowSkips() {
    if (seenSkips === rowSkips) return;

    seenSkips = rowSkips;
    if (region !== 'grid1') return;

    const playlist = getPlaylist();
    const current = playlist[position];
    if (!current || current.row === undefined) return;

    while (position + 1 < playlist.length && playlist[position + 1].row === current.row) position += 1;
  }

  // The next page, built and ready, or null when nothing can be shown. A
  // panel that fails to draw is skipped and the one after it is tried, so
  // one bad panel can neither stop the region nor spin it.
  function pickPage() {
    const attempts = getPlaylist().length;
    const failed = [];
    somePanelFailed = false;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const step = chooseNext(failed);
      if (!step) return null;

      askScreens('begin', step);
      try {
        const page = buildPage(step.panel, getContent(), step.page, step);
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

  // The layout has not got this region now. Nothing is chosen until the region is asked to move on, which the swap does for
  // a region that the next look brings, or until the layout has it. answered is the number of asks this list has acted on:
  // an ask that woke the list from its stay counts as one it has not.
  let answered = changeCount(region);

  async function waitForLayout() {
    while (!hasRegion(layoutNow(), region) && changeCount(region) === answered) await frame.wait(250);
    answered = changeCount(region);
  }

  // not awaited by the caller: this runs in the background and never ends
  async function loop() {
    while (true) {
      try {
        await waitForLayout();
        await waitWhilePaused();
        followRestarts();
        followListResets();
        followRowSkips();
        const since = changeCount(region);
        const next = pickPage();

        // Nothing could be drawn: leave the page that is on screen and try again
        if (!next && somePanelFailed) {
          await frame.wait(5000);
          continue;
        }

        // the old page leaves and the next arrives, or the region empties
        const arrivedAfter = await changePage(region, next ? next.page : null);
        onScreen[region] = next && next.topic && hasRegion(layoutNow(), region) ? [next.topic] : [];

        if (next) {
          const settings = getContent().settings;
          // The Photo panel of a Screen row knows how long its turn is: the photos it has times the seconds each stays
          const turnSeconds = next.page.element && next.page.element.dataset ? Number(next.page.element.dataset.stay) : 0;
          if (turnSeconds > 0) next.step = Object.assign({}, next.step, { seconds: turnSeconds });
          const held = holdFor(stayFor(region, ownSeconds(next.step, settings), settings), arrivedAfter);
          await hold(held, since, region);

          // a card with more rows than fit moves its list up and is held again, for the same time. A
          // page that was ended early (changeCount moved) does not go on.
          for (let shown = 1; shown < next.pages && changeCount(region) === since; shown++) {
            frame.scrollCard(next.page.element, shown);
            await hold(held, since, region);
          }
        } else {
          await waitUnlessAsked(1000, since, region); // nothing to show right now
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
          await waitUnlessAsked(5000, since, 'ticker');
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
