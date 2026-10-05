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
import { changePage, clearRegion } from './areas.js';

// The topics on screen in each grid region right now. While a page is
// leaving it holds two: the one going and the one coming.
const onScreen = { grid1: [], grid2: [] };
const shortestStay = 5; // seconds
const shortestHold = 1000; // milliseconds
let paused = false;

// While an alert or announcement covers the screen, the rotation stops
export function pauseRotation() {
  paused = true;
}

export function resumeRotation() {
  paused = false;
}

// Counts the calls to showPagesNow(). A page that was chosen before a call
// does not get its full stay.
let pagesRefreshed = 0;

// Every page on screen leaves early and the next ones are chosen from the
// newest content. Used when the screen switches between sample and real
// content, so pages of the old content do not stay for another 20 seconds.
export function showPagesNow() {
  pagesRefreshed += 1;
}

// Waits, but the clock stands still while paused. A time of zero or less (a
// mistake in the settings) still waits a second, so a loop can never spin
// without stopping. since is the value of pagesRefreshed when the page was
// chosen: if showPagesNow() was called after that, the wait ends.
async function hold(milliseconds, since) {
  let left = milliseconds > 0 ? milliseconds : 1000;
  while (left > 0 && pagesRefreshed === since) {
    await frame.wait(250);
    if (!paused) left -= 250;
  }
}

async function waitWhilePaused() {
  while (paused) await frame.wait(250);
}

// How long a page stays, in milliseconds, with the Speed setting applied.
// A row's own seconds win. Otherwise the whole board follows Seconds per
// page in Dashboard Settings: the small panel stays three quarters as long
// and the ticker one and a half times as long. The ticker's own seconds
// (Dashboard Settings, Panels) come in as ownSeconds too. Fast never takes a
// page below 5 seconds, unless the editors asked for less than that to begin
// with. The settings are read each time, so a change applies at the next page.
function stayFor(region, ownSeconds, settings) {
  const board = Number(settings.pageSeconds) > 0 ? Number(settings.pageSeconds) : defaultSettings.pageSeconds;
  const automatic = {
    grid1: board,
    grid2: Math.max(6, Math.round(board * 0.75)),
    ticker: Math.max(8, Math.round(board * 1.5)),
  };

  const seconds = Number(ownSeconds) > 0 ? Number(ownSeconds) : automatic[region];
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
export function startRotation(region, getPlaylist, getContent) {
  const otherRegion = region === 'grid1' ? 'grid2' : 'grid1';
  let position = -1;
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
        const since = pagesRefreshed;
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
          await hold(holdFor(stayFor(region, next.step.seconds, getContent().settings), arrivedAfter), since);
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

  async function loop() {
    while (true) {
      try {
        await waitWhilePaused();

        const since = pagesRefreshed;
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
        await hold(holdFor(stayFor('ticker', content.settings.rotation.tickerSeconds, content.settings), arrivedAfter), since);
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
  async function loop() {
    while (true) {
      try {
        const since = pagesRefreshed;
        const pages = ids.map(id => buildPage(id, getContent()));
        await Promise.all(pages.map(page => changePage(page.region, page)));
        await hold(holdSeconds * 1000, since);
      } catch (error) {
        console.error('The stress test hit a problem', error);
        ids.filter(id => regionOf(id)).forEach(id => clearRegion(regionOf(id)));
        await frame.wait(5000);
      }
    }
  }

  loop();
}
