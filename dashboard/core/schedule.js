// Decides which panel is on screen in each region, and for how long.
//
// Each region (grid1, grid2, ticker) steps through its list on its own timer.
// One rule links them: Grid 1 and Grid 2 never show the same topic at the
// same moment, so while Tasks is on the left, the task counts are skipped.
//
// How long a panel stays and the pause between panels follow the Speed
// setting (frame.pace()). Announcements and alerts do not: the editors give
// their seconds directly.

import * as frame from '../frame.js';
import { canShow, mountPanel, moduleOf, regionOf, topicOf } from './panels.js';

// The topic on screen in each grid region right now
const onScreen = { grid1: null, grid2: null };
const defaultSeconds = { grid1: 16, grid2: 12, ticker: 24 };
const shortestStay = 5; // seconds
let paused = false;

// While an alert or announcement covers the screen, the rotation stops
export function pauseRotation() {
  paused = true;
}

export function resumeRotation() {
  paused = false;
}

// Waits, but the clock stands still while paused. A time of zero or less (a
// mistake in the settings) still waits a second, so a loop can never spin
// without stopping.
async function hold(milliseconds) {
  let left = milliseconds > 0 ? milliseconds : 1000;
  while (left > 0) {
    await frame.wait(250);
    if (!paused) left -= 250;
  }
}

async function waitWhilePaused() {
  while (paused) await frame.wait(250);
}

// How long a panel stays, in milliseconds, with the Speed setting applied.
// Fast never takes a panel below 5 seconds, unless the editors asked for
// less than that to begin with.
function stayFor(value, region) {
  const number = Number(value);
  const seconds = number > 0 ? number : defaultSeconds[region];
  return Math.max(seconds * frame.pace(), Math.min(seconds, shortestStay)) * 1000;
}

// region is 'grid1' or 'grid2'
// getPlaylist() returns the list of { panel, show, seconds } for that region
// getContent() returns the newest content
export function startRotation(region, getPlaylist, getContent) {
  const otherRegion = region === 'grid1' ? 'grid2' : 'grid1';
  let position = -1;

  // The next panel in the list that is allowed on screen right now
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
      if (topic && topic === onScreen[otherRegion]) continue;

      position = index;
      onScreen[region] = topic; // set at once, so the other region sees it
      return step;
    }
    return null;
  }

  async function showOne(step) {
    const element = mountPanel(step.panel, getContent());
    try {
      await frame.enter(element);
      await hold(stayFor(step.seconds, region));
      await frame.exit(element);
    } finally {
      element.remove();
    }
  }

  // not awaited by the caller: this runs in the background and never ends
  async function loop() {
    while (true) {
      try {
        await waitWhilePaused();
        const step = chooseNext();

        if (step) {
          await showOne(step);
        } else {
          await frame.wait(1000);
        }
      } catch (error) {
        console.error('The ' + region + ' rotation hit a problem and will try again', error);
        await frame.wait(5000);
      }

      onScreen[region] = null;
      // a short pause, so the other region gets a turn at choosing too
      await frame.wait(500 * frame.pace());
    }
  }

  loop();
}

// The ticker shows one line at a time, swapped in place. The ticker panel
// supplies the list of lines with items(content).
export function startTicker(getSeconds, getContent) {
  let position = -1;

  async function loop() {
    while (true) {
      try {
        await waitWhilePaused();

        const module = moduleOf('ticker');
        const lines = module && module.items ? module.items(getContent()) : [];
        if (lines.length === 0) {
          await frame.wait(5000);
          continue;
        }

        position = (position + 1) % lines.length;
        const content = Object.assign({}, getContent(), { tickerLine: lines[position] });
        const element = mountPanel('ticker', content);
        try {
          await frame.enter(element);
          await hold(stayFor(getSeconds(), 'ticker'));
          await frame.exit(element);
        } finally {
          element.remove();
        }
      } catch (error) {
        console.error('The ticker hit a problem and will try again', error);
        await frame.wait(5000);
      }
    }
  }

  loop();
}

// Used by the hardware test (?stress): several panels arrive together, are
// held, and leave together.
export function startTogether(ids, getContent, holdSeconds) {
  async function loop() {
    while (true) {
      try {
        const shown = ids.map(id => mountPanel(id, getContent()));
        try {
          await Promise.all(shown.map(element => frame.enter(element)));
          await hold(holdSeconds * 1000);
          await Promise.all(shown.map(element => frame.exit(element)));
        } finally {
          shown.forEach(element => element.remove());
        }
      } catch (error) {
        console.error('The stress test hit a problem', error);
        await frame.wait(5000);
      }
    }
  }

  loop();
}
