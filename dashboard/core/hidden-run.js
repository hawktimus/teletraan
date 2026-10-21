// Plays the hidden transitions (docs/hidden-transitions.md). Deciding when is in
// core/hidden.js, the list of transitions and what each one does is in
// core/hidden-transitions.js, and every move is in frame.css, in the sections
// "Hidden transitions" and "The blue glitch". This file is the glue: it asks at
// each page change of the large panel, sets the attributes the stylesheet reads,
// and waits.
//
// How a transition goes on the screen. #world carries data-hidden:
//   glitch  glitches over the screen, red or blue (data-tint says which)
//   break   the collapse: every piece of metal falls into a pile along the bottom edge (core/hidden-pile.js,
//           "The frames collapse and come back" in frame.css) and the content fades away. #backdrop
//           fades in behind. When the content is gone the pages of all three areas are swapped
//           (core/areas.js)
//   apart   the pile lies, and the effect plays over it: the picture, or a glitch. Then the cube
//           rises, turns, pulses and shrinks, and, with data-lift added, the pieces rise from the pile
//           to their places. The rotation clock is held from the cube on
//   build   the frames are whole, #backdrop fades out and the content fades in
// and nothing at all when no transition is playing. While the metal is down #world also has
// data-pieces, which frame.css reads. A glitch can also play while the pile lies, and then data-hidden
// stays apart and only data-tint is added.
//
// The four pictures (core/hidden-pictures.js) are loaded when this starts and sit
// in #backdrop, each one hidden until a step shows it, so a cut to one is one frame.
//
// Only one plays at a time, and never while an alert, an announcement, a demo or
// the night screen has the screen. If one of them starts in the middle, or the
// motion is no longer full, the transition ends at once and the screen goes back
// to normal.

import * as frame from '../frame.js';
import { hiddenAdvanceSeconds, hiddenForceSeconds, hiddenWindowSeconds } from '../config.js';
import { setBusy } from './busy.js';
import { allPictures, makePictureChooser, pictureAddress } from './hidden-pictures.js';
import { chooseHidden, holdReason, pushedKind, tidyHiddenRequest, readHandledRequest, readLastFired, rememberHandledRequest, rememberLastFired } from './hidden.js';
import { hiddenTransitions } from './hidden-transitions.js';
import { makePile } from './hidden-pile.js';
import { findImageTypes, loadPicture } from './hidden-load.js';
import { finishRun, noteIgnored, noteStep, secondsText, setBrowser, setImageTypes, startRun } from './hidden-log.js';
import { setHiddenOffer, startWholeScreen } from './areas.js';
import { moveOn, pauseRotation, resumeRotation, secondsUntilChange } from './schedule.js';
import { layoutNow, otherAreas } from './layout.js';
import { swapRunning } from './swap-run.js';
import { takeoverRunning } from './takeover.js';
import { pileTimes } from './transitions.js';
import { Stopped, backdrop, blueGlitch, contentGoneAfter, flySeconds, hiddenState, longestRest, pictureElements, redWash, world } from './hidden-run-state.js';

// True while a hidden transition plays. The announcements the Studio pushes
// (core/announce-run.js) ask, so they wait for it to be over.
export function hiddenPlaying() {
  return hiddenState.playing;
}

// Plays that transition at the next page change of the large panel, as ?hidden=<kind> does. The motion tests ask.
export function askHidden(kind) {
  if (Object.prototype.hasOwnProperty.call(hiddenTransitions, kind)) hiddenState.addressKind = kind;
}

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
  hiddenState.getContent = contentGetter;
  hiddenState.storage = savedStorage();
  hiddenState.handled = readHandledRequest(hiddenState.storage);
  hiddenState.lastFired = readLastFired(hiddenState.storage);
  hiddenState.addressOff = switchText === 'off';
  hiddenState.addressKind = Object.prototype.hasOwnProperty.call(hiddenTransitions, switchText) ? switchText : '';

  // The demo and the night screen are optional parts of the screen. If one did
  // not start, it is never in the way.
  try {
    hiddenState.demoRunning = (await import('./demo-runner.js')).demoRunning;
  } catch (error) {
    console.error('The hidden transitions cannot tell when a demo plays', error);
  }
  try {
    hiddenState.nightIsUp = (await import('./night-screen.js')).nightIsUp;
  } catch (error) {
    console.error('The hidden transitions cannot tell when the night screen is up', error);
  }

  hiddenState.chooser = makePictureChooser(hiddenState.storage);
  setBrowser(navigator.userAgent);
  findImageTypes().then(setImageTypes).catch(() => {});
  loadPictures();
  // On the html element, where tokens.css works --time-hidden out from it
  document.documentElement.style.setProperty('--hidden-seconds', String(flySeconds));
  setHiddenOffer(offer);
  frame.onSecond(look);
}

// Loads the four pictures now and puts each one in #backdrop when it has loaded,
// hidden until a step shows it. One that fails to load is left out, and the step
// that would have used it takes the next picture of its set, or shows none. What each load gave
// (its time, its size or why it failed) is kept for the run log.
function loadPictures() {
  allPictures().forEach(picture => {
    loadPicture(pictureAddress(picture)).then(result => keepPicture(picture, result));
  });
}

function keepPicture(picture, result) {
  hiddenState.pictureFacts[picture.file] = result;
  if (!result.ok) {
    console.error('The hidden transition picture ' + picture.file + ' did not load (' + result.why + '), so it is skipped');
    return;
  }
  if (pictureElements[picture.file]) return;

  const image = result.image;
  image.className = 'picture';
  image.alt = '';
  image.dataset.fit = picture.fit;
  if (picture.crisp) image.dataset.crisp = 'on';
  backdrop.appendChild(image);
  pictureElements[picture.file] = image;
  // Decoded now, not at the cut. Browsers that cannot do this just decode it when it first shows.
  if (image.decode) image.decode().catch(() => {});
}

// A picture that failed at the start may only have met a busy moment of the web server. Before a transition plays,
// the missing ones are asked for once more, for four seconds at most, so one bad moment does not cost the picture for good.
async function retryMissingPictures() {
  const missing = allPictures().filter(picture => pictureElements[picture.file] === undefined);
  if (missing.length === 0) return;

  const tries = missing.map(picture => loadPicture(pictureAddress(picture) + '?again=' + Date.now(), 4000).then(result => keepPicture(picture, result)));
  await Promise.all(tries);
}

// What the screen is doing, as core/hidden.js wants it
function screenState() {
  return {
    motion: frame.motionNow() === 'full' && frame.weightNow() === 'light' ? 'light' : frame.motionNow(), // a hidden transition is not played in Light
    takeover: takeoverRunning(),
    demo: hiddenState.demoRunning(),
    night: hiddenState.nightIsUp(),
    playing: hiddenState.playing || swapRunning(),
  };
}

// Called at each page change of the large panel (core/areas.js). Returns null,
// or what areas.js plays in place of the page change.
function offer() {
  const content = hiddenState.getContent();
  if (hiddenState.addressOff || !content) return null;

  const choice = chooseHidden({
    settings: content.settings,
    state: screenState(),
    handled: hiddenState.handled,
    lastFired: hiddenState.lastFired,
    now: new Date(),
    random: Math.random,
    address: hiddenState.addressKind,
  });
  if (!choice) return null;

  return { play: swapPage => play(choice, content.settings.hiddenRequest.requestedAt, swapPage) };
}

// The words for why the screen cannot play a transition now
function busyWords() {
  const state = screenState();
  if (state.takeover) return 'an alert, announcement or talk is on';
  if (state.demo) return 'a demo is on';
  if (state.night) return 'night mode is on';
  return 'another transition was running';
}

const ignoredWords = { off: 'Allow hidden transitions is off (hiddenEnabled)', motion: 'motion is light, calm or none, not full' };
const logged = new Set(); // the requests already written to the log as ignored

function logIgnoredOnce(key, kind, words) {
  if (logged.has(key)) return;
  logged.add(key);
  noteIgnored(kind, words);
}

// A request that was never played and is older than the window ran out unseen. The log says so, once.
function noteExpired(request) {
  const tidy = tidyHiddenRequest(request);
  if (tidy.kind === '' || tidy.requestedAt === hiddenState.handled) return;

  const age = (Date.now() - Date.parse(tidy.requestedAt)) / 1000;
  if (age <= hiddenWindowSeconds || age > 3600) return;

  const key = tidy.kind + ' ' + tidy.requestedAt;
  const waited = hiddenState.pending.key === key && hiddenState.pending.why ? ', held by: ' + hiddenState.pending.why : '';
  logIgnoredOnce(key, tidy.kind, 'request older than ' + Math.round(hiddenWindowSeconds / 60) + ' min' + waited);
}

// Plays the push now, with no page change of the large panel: the same page comes back after the cube. Used
// when the panel stays long, is held, or the rotation is paused, so no page change comes in time.
function playWithoutPageChange(now) {
  hiddenState.pending.retryAt = now.getTime() + 5000; // a try that finds the areas moving is made again a little later
  const offered = offer();
  if (offered) offered.play(() => {}).catch(error => console.error('The hidden transition failed', error));
}

// Once a second: a push from the Studio does not wait for a page change that is
// far away. When the large panel has more than hiddenAdvanceSeconds to go, it is
// asked to change page now, and that page change is where the push plays. When no page change
// comes within hiddenForceSeconds (a held panel, a paused rotation), it plays without one.
function look(now) {
  const content = hiddenState.getContent();
  if (!content || hiddenState.addressOff || hiddenState.playing) return;

  const request = content.settings.hiddenRequest;
  const wanted = hiddenState.addressKind || pushedKind(request, hiddenState.handled, now);
  if (wanted === '') {
    hiddenState.asked = '';
    noteExpired(request);
    return;
  }

  const key = wanted + ' ' + request.requestedAt;
  if (hiddenState.pending.key !== key) hiddenState.pending = { key: key, since: now.getTime(), why: '', retryAt: 0 };

  // Off and no motion never play it. Busy (an alert, an announcement, a demo,
  // night mode) waits for the screen to be free again.
  const reason = holdReason(content.settings, screenState());
  if (reason !== '') {
    if (reason === 'busy') {
      hiddenState.asked = '';
      hiddenState.pending.why = busyWords();
    } else {
      logIgnoredOnce(key, wanted, ignoredWords[reason]);
    }
    return;
  }

  if (now.getTime() - hiddenState.pending.since >= hiddenForceSeconds * 1000 && now.getTime() >= hiddenState.pending.retryAt) {
    playWithoutPageChange(now);
    return;
  }
  if (hiddenState.asked === key) return;

  const left = secondsUntilChange('grid1');
  if (left === null) return; // the large panel is changing page this second. Look again.

  hiddenState.asked = key;
  if (left > hiddenAdvanceSeconds) moveOn(['grid1']);
}

// Light motion, calm and none play no hidden transition
function notFull() {
  return frame.motionNow() !== 'full' || frame.weightNow() === 'light';
}

// True when something else needs the screen, or the motion is no longer full
function interrupted() {
  return takeoverRunning() || hiddenState.demoRunning() || hiddenState.nightIsUp() || notFull();
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
// half done would be carried away with the pieces, which looks wrong.
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
// how many milliseconds the screen took to come back together, or 0 when the
// transition did not start or was stopped before it got that far.
async function play(choice, requestedAt, swapPage) {
  if (hiddenState.playing) return 0;
  hiddenState.playing = true;
  startRun(choice.kind);

  let screen = null;
  let cameBack = 0;
  let ignored = false;

  setBusy(true, 'hidden');
  try {
    await retryMissingPictures();

    // From now on the other areas wait at the gate rather than change page. The look stays as it is: the
    // frames fall into a pile, and a look that drew them again would leave some behind
    screen = startWholeScreen(true);
    if (!await waitForRest()) {
      ignored = true;
      noteIgnored(choice.kind, interrupted() ? 'stopped before it began: ' + interruptedWords() : 'the areas did not come to rest within ' + longestRest / 1000 + ' s');
      return 0;
    }

    // It starts now, so it counts as handled, and a restart will not play it again
    if (choice.how === 'push') {
      hiddenState.handled = requestedAt;
      rememberHandledRequest(hiddenState.storage, hiddenState.handled);
    }
    if (choice.how === 'address') hiddenState.addressKind = '';

    // Whatever started it, no other comes about by chance for a while (hiddenGapHours in config.js)
    hiddenState.lastFired = Date.now();
    rememberLastFired(hiddenState.storage, hiddenState.lastFired);

    frame.setHiddenPlaying(true);
    const scene = makeScene(screen, swapPage);
    await hiddenTransitions[choice.kind].run(scene);
    cameBack = scene.cameBack();
  } catch (error) {
    if (error instanceof Stopped) noteStep('stopped: ' + interruptedWords());
    else {
      noteStep('failed: ' + String(error && error.message ? error.message : error).slice(0, 50));
      console.error('The hidden transition "' + choice.kind + '" failed', error);
    }
  } finally {
    if (!ignored) finishRun();
    putBack(screen);
  }
  return cameBack;
}

// What took the screen from a transition, in words for the log
function interruptedWords() {
  if (takeoverRunning()) return 'an alert, announcement or talk began';
  if (hiddenState.demoRunning()) return 'a demo began';
  if (hiddenState.nightIsUp()) return 'night mode began';
  return 'motion is no longer full';
}

// Takes the glitch layers away, the red one and the blue one
function clearGlitch() {
  redWash.hidden = true;
  blueGlitch.hidden = true;
  delete world.dataset.tint;
}

// Puts the next picture of the set on the backdrop in this state: 'in' (it fades
// in) or 'on' (it is there at once). The backdrop takes the picture's own
// background colour, so a picture that does not fill the screen has no black bars.
// When no picture of the set can be shown, nothing changes on the backdrop.
function showPicture(set, state) {
  hiddenState.showing = null;
  const picture = hiddenState.chooser.next(set, file => {
    const ready = pictureElements[file] !== undefined;
    if (!ready) {
      const facts = hiddenState.pictureFacts[file];
      noteStep('picture ' + file + ' FAILED: ' + (facts ? facts.why : 'not loaded'));
    }
    return ready;
  });
  if (!picture) {
    noteStep('picture none, plain backdrop');
    return;
  }

  const facts = hiddenState.pictureFacts[picture.file];
  noteStep('picture ' + picture.file + ' loaded ' + facts.width + 'x' + facts.height + ' after ' + facts.ms + 'ms');
  hiddenState.showing = pictureElements[picture.file];
  backdrop.style.setProperty('--picture-fill', picture.fill);
  backdrop.dataset.look = 'picture';
  hiddenState.showing.dataset.state = state;
  hiddenState.shownAt = performance.now();
}

// How much of the picture shows: the opacity of the picture times that of every element it sits in
function shownOpacity(element) {
  let opacity = 1;
  for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    opacity *= Number(style.opacity);
    if (style.visibility === 'hidden' || style.display === 'none') return 0;
  }
  return opacity;
}

// Writes down what the page makes of the picture: its size on the screen and how solid it is
function noteOnScreen() {
  const image = hiddenState.showing;
  if (!image) return;

  const opacity = shownOpacity(image);
  const visible = !backdrop.hidden && image.offsetWidth > 0 && opacity > 0.9;
  noteStep('on screen ' + image.offsetWidth + 'x' + image.offsetHeight + ' opacity ' + opacity.toFixed(1) + (visible ? '' : ' NOT VISIBLE'));
}

// The steps a transition is made of (core/hidden-transitions.js lists them)
function makeScene(screen, swapPage) {
  let cameBackIn = 0;

  return {
    // Glitches. Red (the default): the old television jumps, and a flat red layer
    // flickers. Blue: the stage and its blocks jump about and tear, and the flat
    // blue layers in #blue-glitch flicker. frame.css does all of that moving, and
    // data-tint is how it knows which. Only the red uses the old television glitch.
    async glitch(seconds, tint = 'red') {
      const blue = tint === 'blue';
      world.style.setProperty('--glitch-seconds', String(seconds));
      world.dataset.tint = blue ? 'blue' : 'red';
      (blue ? blueGlitch : redWash).hidden = false;
      if (!world.dataset.hidden) world.dataset.hidden = 'glitch'; // while the pile lies, the state stays as it is
      if (!blue) frame.playGlitch(seconds);
      await sleep(seconds);

      // Over the empty backdrop no collapse follows to fade the layers out, so this takes them away
      if (world.dataset.hidden === 'apart') clearGlitch();
    },

    // The frames collapse into a pile and the backdrop shows behind them. When the content has faded
    // away the pages are swapped, and the areas that were waiting swap theirs. The pile stays down.
    async collapse(look) {
      const fell = performance.now();
      backdrop.dataset.look = look;
      backdrop.hidden = false;
      world.dataset.hidden = 'break';
      world.dataset.pieces = '';
      moveOn(otherAreas(layoutNow())); // the areas the layout has besides the large one pick their next page and wait at the gate for this moment

      hiddenState.pile = makePile();
      hiddenState.plan = hiddenState.pile.release(Math.floor(Math.random() * 4294967296));
      await sleep(contentGoneAfter);
      swapPage();
      screen.apart();

      await sleep(flySeconds - contentGoneAfter);
      world.dataset.hidden = 'apart';
      clearGlitch();
      noteStep('pile ' + secondsText(performance.now() - fell));
    },

    wait: seconds => sleep(seconds),

    // The next picture of the set fades in
    async pictureIn(set, seconds) {
      backdrop.style.setProperty('--look-seconds', String(seconds));
      showPicture(set, 'in');
      await sleep(seconds);
      noteOnScreen();
      if (hiddenState.showing) hiddenState.showing.dataset.state = 'on';
    },

    // The next picture of the set is there at once, in the very next frame, and stays
    async pictureCut(set, seconds) {
      showPicture(set, 'on');
      const look = Math.min(0.2, seconds);
      await sleep(look);
      noteOnScreen();
      await sleep(seconds - look);
    },

    // The picture fades out
    async pictureOut(seconds) {
      backdrop.style.setProperty('--look-seconds', String(seconds));
      if (hiddenState.showing) hiddenState.showing.dataset.state = 'out';
      await sleep(seconds);
    },

    // The screen comes back: a cube rises, turns, pulses and shrinks to a point, the pieces rise from the pile
    // to their places, and the content fades in (core/hidden-pile.js). The three parts take 5.5 seconds with the
    // collapse, and nothing else moves meanwhile. The rotation clock is held from the cube on. cameBack is the
    // rebuild only: the pieces rising and the content coming in
    async rebuild() {
      if (hiddenState.shownAt) noteStep('effect shown ' + secondsText(performance.now() - hiddenState.shownAt));
      screen.together();
      pauseRotation();
      hiddenState.rotationHeld = true;
      if (hiddenState.pile === null) return; // the show did not collapse the frames, so there is nothing to put back

      hiddenState.pile.showCube();
      await sleep(pileTimes.cubeMs / 1000);

      const started = performance.now();
      world.dataset.lift = ''; // the pieces rise
      await sleep(hiddenState.plan.riseMs / 1000);
      hiddenState.pile.finish();
      delete world.dataset.pieces;
      world.dataset.hidden = 'build';
      hiddenState.pile.contentIn();
      await sleep(pileTimes.contentMs / 1000);
      cameBackIn = performance.now() - started;
      noteStep('rebuild ok');
    },

    cameBack: () => cameBackIn,
  };
}

// The screen as it was, whatever happened: every attribute, layer and hold the
// transition set is taken away
function putBack(screen) {
  delete world.dataset.hidden;
  delete world.dataset.lift;
  delete world.dataset.pieces;
  if (hiddenState.rotationHeld) resumeRotation();
  hiddenState.rotationHeld = false;
  try {
    if (hiddenState.pile) hiddenState.pile.clear();
  } catch (error) {
    console.error('The frames of the hidden transition could not be put back', error);
  }
  hiddenState.pile = null;
  hiddenState.plan = null;
  world.style.removeProperty('--glitch-seconds');
  backdrop.hidden = true;
  delete backdrop.dataset.look;
  backdrop.style.removeProperty('--look-seconds');
  backdrop.style.removeProperty('--picture-fill');
  Object.keys(pictureElements).forEach(file => delete pictureElements[file].dataset.state);
  hiddenState.showing = null;
  hiddenState.shownAt = 0;
  clearGlitch();
  frame.stopGlitch();
  frame.setHiddenPlaying(false);
  if (screen) screen.end();
  setBusy(false, 'hidden');
  hiddenState.playing = false;
}
