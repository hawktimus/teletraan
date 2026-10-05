// Plays the hidden transitions (docs/hidden-transitions.md). Deciding when is in
// core/hidden.js, the list of transitions and what each one does is in
// core/hidden-transitions.js, and every move is in frame.css, in the section
// "Hidden transitions". This file is the glue: it asks at each page change of
// the large panel, sets the attributes the stylesheet reads, and waits.
//
// How a transition goes on the screen. #world carries data-hidden:
//   glitch  red glitches over the screen (only the red eyes have this)
//   break   the five blocks fly apart in 3D (the banner, the countdown, the large
//           panel, the small panel and the ticker, marked data-block in index.html)
//   apart   the blocks are out of sight and #backdrop shows what is behind them.
//           The pages of all three areas are swapped now (core/areas.js)
//   build   the blocks fly back together, showing the next screen
// and nothing at all when no transition is playing.
//
// Only one plays at a time, and never while an alert, an announcement, a demo or
// the night screen has the screen. If one of them starts in the middle, or the
// motion is no longer full, the transition ends at once and the screen goes back
// to normal.

import * as frame from '../frame.js';
import { hiddenAdvanceSeconds } from '../config.js';
import { backdropMarkup } from './hidden-art.js';
import { chooseHidden, holdReason, pushedKind, readHandledRequest, rememberHandledRequest } from './hidden.js';
import { hiddenTransitions } from './hidden-transitions.js';
import { setHiddenOffer, startWholeScreen } from './areas.js';
import { moveOn, secondsUntilChange } from './schedule.js';
import { takeoverRunning } from './takeover.js';

// How long the blocks take to fly apart, and the same again to fly back, at
// normal speed. frame.css has the same number as --hidden-seconds in tokens.css.
// The last block starts .3 of it late and each block takes .6 of it, so all the
// blocks are apart after .9 of it. Coming back they take .5 of it each and the
// last starts .18 of it late.
const flySeconds = 1.6;
const apartAfter = 0.9;
const togetherAfter = 0.9; // includes the backdrop fading out at the end
const longestRest = 3000; // milliseconds to wait for the three areas to stop moving before giving up

const world = document.getElementById('world');
const backdrop = document.getElementById('backdrop');
const redWash = document.getElementById('red-wash');

let getContent = null;
let storage = null;
let handled = ''; // the push handled before, as a time
let addressKind = ''; // a kind that ?hidden= asked for and that has not played yet
let addressOff = false; // ?hidden=off
let asked = ''; // the push the large panel has been asked to move on for
let playing = false;
let demoRunning = () => false; // set in startHidden, when the pieces are there
let nightIsUp = () => false;

class Stopped extends Error {}

// Even asking for localStorage can throw, for example when the browser has storage switched off
function savedStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

// getContent() returns the newest content. switchText is the ?hidden= switch:
// a kind from the list (play it at the next page change), or off.
export async function startHidden(contentGetter, switchText) {
  getContent = contentGetter;
  storage = savedStorage();
  handled = readHandledRequest(storage);
  addressOff = switchText === 'off';
  addressKind = Object.prototype.hasOwnProperty.call(hiddenTransitions, switchText) ? switchText : '';

  // The demo and the night screen are optional parts of the screen. If one did
  // not start, it is never in the way.
  try {
    demoRunning = (await import('./demo-runner.js')).demoRunning;
  } catch (error) {
    console.error('The hidden transitions cannot tell when a demo plays', error);
  }
  try {
    nightIsUp = (await import('./night-screen.js')).nightIsUp;
  } catch (error) {
    console.error('The hidden transitions cannot tell when the night screen is up', error);
  }

  backdrop.innerHTML = backdropMarkup();
  // On the html element, where tokens.css works --time-hidden out from it
  document.documentElement.style.setProperty('--hidden-seconds', String(flySeconds));
  setHiddenOffer(offer);
  frame.onSecond(look);
}

// What the screen is doing, as core/hidden.js wants it
function screenState() {
  return {
    motion: frame.motionNow(),
    takeover: takeoverRunning(),
    demo: demoRunning(),
    night: nightIsUp(),
    playing: playing,
  };
}

// Called at each page change of the large panel (core/areas.js). Returns null,
// or what areas.js plays in place of the page change.
function offer() {
  const content = getContent();
  if (addressOff || !content) return null;

  const choice = chooseHidden({
    settings: content.settings,
    state: screenState(),
    handled: handled,
    now: new Date(),
    random: Math.random,
    address: addressKind,
  });
  if (!choice) return null;

  return { play: swapPage => play(choice, content.settings.hiddenRequest.requestedAt, swapPage) };
}

// Once a second: a push from the Studio does not wait for a page change that is
// far away. When the large panel has more than hiddenAdvanceSeconds to go, it is
// asked to change page now, and that page change is where the push plays.
function look(now) {
  const content = getContent();
  if (!content || addressOff || playing) return;

  const request = content.settings.hiddenRequest;
  const wanted = addressKind || pushedKind(request, handled, now);
  if (wanted === '') {
    asked = '';
    return;
  }

  // Off and no motion never play it. Busy (an alert, an announcement, a demo,
  // night mode) waits for the screen to be free again.
  const reason = holdReason(content.settings, screenState());
  if (reason !== '') {
    if (reason === 'busy') asked = '';
    return;
  }

  const key = wanted + ' ' + request.requestedAt;
  if (asked === key) return;

  const left = secondsUntilChange('grid1');
  if (left === null) return; // the large panel is changing page this second. Look again.

  asked = key;
  if (left > hiddenAdvanceSeconds) moveOn(['grid1']);
}

// True when something else needs the screen, or the motion is no longer full
function interrupted() {
  return takeoverRunning() || demoRunning() || nightIsUp() || frame.motionNow() !== 'full';
}

// Waits this many seconds (at normal speed), and throws Stopped if the screen is
// needed by something else in the meantime. Looks every 100 ms.
async function sleep(seconds) {
  const end = performance.now() + seconds * 1000 * frame.pace();
  while (performance.now() < end) {
    if (interrupted()) throw new Stopped();
    await frame.wait(Math.min(100, Math.max(0, end - performance.now())));
  }
  if (interrupted()) throw new Stopped();
}

// A transition begins only when the areas are all at rest. A page change that is
// half done would be carried away with its block, which looks wrong.
async function waitForRest() {
  const until = performance.now() + longestRest;
  while (performance.now() < until) {
    if (interrupted()) return false;
    if (!document.querySelector('.area:not([data-state="shown"])')) return true;
    await frame.wait(100);
  }
  return false;
}

// Plays the transition. swapPage() puts the large panel's next page in; the other
// areas swap theirs by themselves (core/areas.js, startWholeScreen). Resolves with
// how many milliseconds the blocks took to fly back together, or 0 when the
// transition did not start or was stopped before it got that far.
async function play(choice, requestedAt, swapPage) {
  if (playing) return 0;
  playing = true;

  // From now on the other areas wait at the gate rather than change page
  const screen = startWholeScreen();
  let cameBack = 0;

  try {
    if (!await waitForRest()) return 0;

    // It starts now, so it counts as handled, and a restart will not play it again
    if (choice.how === 'push') {
      handled = requestedAt;
      rememberHandledRequest(storage, handled);
    }
    if (choice.how === 'address') addressKind = '';

    frame.setHiddenPlaying(true);
    const scene = makeScene(screen, swapPage);
    await hiddenTransitions[choice.kind].run(scene);
    cameBack = scene.cameBack();
  } catch (error) {
    if (!(error instanceof Stopped)) console.error('The hidden transition "' + choice.kind + '" failed', error);
  } finally {
    putBack(screen);
  }
  return cameBack;
}

// The steps a transition is made of (core/hidden-transitions.js lists them)
function makeScene(screen, swapPage) {
  let cameBackIn = 0;

  return {
    // Red glitches: the old television jumps, and a flat red layer flickers
    async glitch(seconds) {
      world.style.setProperty('--glitch-seconds', String(seconds));
      redWash.hidden = false;
      world.dataset.hidden = 'glitch';
      frame.playGlitch(seconds);
      await sleep(seconds);
    },

    // The blocks fly apart and the backdrop shows behind them. When they are
    // apart the pages are swapped, and the areas that were waiting swap theirs.
    async breakApart(look) {
      backdrop.dataset.look = look;
      backdrop.hidden = false;
      world.dataset.hidden = 'break';
      moveOn(['grid2', 'ticker']); // they pick their next page and wait at the gate for this moment

      await sleep(flySeconds * apartAfter);
      world.dataset.hidden = 'apart';
      redWash.hidden = true;
      swapPage();
      screen.apart();
    },

    wait: seconds => sleep(seconds),

    // Changes what the backdrop shows ('eyes', 'face' or 'gone') and waits
    show(look, seconds) {
      backdrop.style.setProperty('--look-seconds', String(seconds));
      backdrop.dataset.look = look;
      return sleep(seconds);
    },

    // The blocks fly back together, showing the next screen
    async rebuild() {
      screen.together();
      const started = performance.now();
      world.dataset.hidden = 'build';
      await sleep(flySeconds * togetherAfter);
      cameBackIn = performance.now() - started;
    },

    cameBack: () => cameBackIn,
  };
}

// The screen as it was, whatever happened: every attribute, layer and hold the
// transition set is taken away
function putBack(screen) {
  delete world.dataset.hidden;
  world.style.removeProperty('--glitch-seconds');
  backdrop.hidden = true;
  delete backdrop.dataset.look;
  backdrop.style.removeProperty('--look-seconds');
  redWash.hidden = true;
  frame.stopGlitch();
  frame.setHiddenPlaying(false);
  screen.end();
  playing = false;
}
