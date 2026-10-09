// Plays the hidden transitions (docs/hidden-transitions.md). Deciding when is in
// core/hidden.js, the list of transitions and what each one does is in
// core/hidden-transitions.js, and every move is in frame.css, in the sections
// "Hidden transitions" and "The blue glitch". This file is the glue: it asks at
// each page change of the large panel, sets the attributes the stylesheet reads,
// and waits.
//
// How a transition goes on the screen. #world carries data-hidden:
//   glitch  glitches over the screen, red or blue (data-tint says which)
//   break   the blocks fly apart in 3D. The standard layout has five (the banner, the
//           countdown, the large panel, the small panel and the ticker, marked
//           data-block in index.html), and the sidebar layout four (the top strip,
//           the sidebar, the large panel and the ticker, core/layout.js, blocksOf)
//   apart   the blocks are out of sight and #backdrop shows what is behind them.
//           The pages of all three areas are swapped now (core/areas.js)
//   fall    the screen is whole, showing the next pages, and its frames break: every piece
//           of metal falls into a pile, a cube rises out of it and, with data-lift added,
//           the pieces fly back (core/hidden-pile.js, "The frames fall and come back" in
//           frame.css). The rotation clock is held for as long as it lasts
//   build   the content comes back in as it does at the first assembly
// and nothing at all when no transition is playing. A glitch can also play while
// the blocks are apart, and then data-hidden stays apart and only data-tint is added.
//
// The four pictures (core/hidden-pictures.js) are loaded when this starts and sit
// in #backdrop, each one hidden until a step shows it, so a cut to one is one frame.
//
// Only one plays at a time, and never while an alert, an announcement, a demo or
// the night screen has the screen. If one of them starts in the middle, or the
// motion is no longer full, the transition ends at once and the screen goes back
// to normal.

import * as frame from '../frame.js';
import { hiddenAdvanceSeconds } from '../config.js';
import { allPictures, makePictureChooser, pictureAddress } from './hidden-pictures.js';
import { chooseHidden, holdReason, pushedKind, readHandledRequest, readLastFired, rememberHandledRequest, rememberLastFired } from './hidden.js';
import { hiddenTransitions } from './hidden-transitions.js';
import { makePile } from './hidden-pile.js';
import { preloadImages } from './images.js';
import { setHiddenOffer, startWholeScreen } from './areas.js';
import { moveOn, pauseRotation, resumeRotation, secondsUntilChange } from './schedule.js';
import { layoutNow, otherAreas } from './layout.js';
import { takeoverRunning } from './takeover.js';
import { pileTimes } from './transitions.js';

// How long the blocks take to fly apart, at normal speed. frame.css has the same number as
// --hidden-seconds in tokens.css, and it is the length of the fall of the frames too
// (pileTimes.fallMs in core/transitions.js). The last block starts .3 of it late and
// each block takes .6 of it, so all the blocks are apart after .9 of it.
const flySeconds = 1.6;
const apartAfter = 0.9;
const togetherAfter = 0.9; // the build: the backdrop fades out and the content comes in
const longestRest = 3000; // milliseconds to wait for the three areas to stop moving before giving up

const world = document.getElementById('world');
const backdrop = document.getElementById('backdrop');
const redWash = document.getElementById('red-wash');
const blueGlitch = document.getElementById('blue-glitch');

let getContent = null;
let storage = null;
let handled = ''; // the push handled before, as a time
let lastFired = 0; // when a hidden transition last started, in milliseconds since 1970. 0 is none yet.
let addressKind = ''; // a kind that ?hidden= asked for and that has not played yet
let addressOff = false; // ?hidden=off
let asked = ''; // the push the large panel has been asked to move on for
let playing = false;
let demoRunning = () => false; // set in startHidden, when the pieces are there
let nightIsUp = () => false;
let chooser = null; // picks the picture of each play, so the two of a set take turns
const pictureElements = {}; // file name -> the img in #backdrop, once the picture has loaded. A picture that failed is not here.
let showing = null; // the img on the backdrop now, or null
let pile = null; // the frames that fall at the end of this transition, or null
let rotationHeld = false; // this transition has paused the rotation clock

class Stopped extends Error {}

// True while a hidden transition plays. The announcements the Studio pushes
// (core/announce-run.js) ask, so they wait for it to be over.
export function hiddenPlaying() {
  return playing;
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
  getContent = contentGetter;
  storage = savedStorage();
  handled = readHandledRequest(storage);
  lastFired = readLastFired(storage);
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

  chooser = makePictureChooser(storage);
  loadPictures();
  // On the html element, where tokens.css works --time-hidden out from it
  document.documentElement.style.setProperty('--hidden-seconds', String(flySeconds));
  setHiddenOffer(offer);
  frame.onSecond(look);
}

// Loads the four pictures now and puts each one in #backdrop when it has loaded,
// hidden until a step shows it. One that fails to load is left out, and the step
// that would have used it takes the next picture of its set, or shows none.
function loadPictures() {
  const pictures = allPictures();

  preloadImages(pictures.map(pictureAddress)).then(results => {
    results.forEach((result, index) => {
      const picture = pictures[index];
      if (!result.ok) {
        console.error('The hidden transition picture ' + picture.file + ' did not load, so it is skipped');
        return;
      }

      const image = result.image;
      image.className = 'picture';
      image.alt = '';
      image.dataset.fit = picture.fit;
      if (picture.crisp) image.dataset.crisp = 'on';
      backdrop.appendChild(image);
      pictureElements[picture.file] = image;
      // Decoded now, not at the cut. Browsers that cannot do this just decode it when it first shows.
      if (image.decode) image.decode().catch(() => {});
    });
  });
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
    lastFired: lastFired,
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

    // Whatever started it, no other comes about by chance for a while (hiddenGapHours in config.js)
    lastFired = Date.now();
    rememberLastFired(storage, lastFired);

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
  showing = null;
  const picture = chooser.next(set, file => pictureElements[file] !== undefined);
  if (!picture) return;

  showing = pictureElements[picture.file];
  backdrop.style.setProperty('--picture-fill', picture.fill);
  backdrop.dataset.look = 'picture';
  showing.dataset.state = state;
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
      if (!world.dataset.hidden) world.dataset.hidden = 'glitch'; // while the blocks are apart, the screen stays apart
      if (!blue) frame.playGlitch(seconds);
      await sleep(seconds);

      // Over the empty backdrop no break follows to fade the layers out, so this takes them away
      if (world.dataset.hidden === 'apart') clearGlitch();
    },

    // The blocks fly apart and the backdrop shows behind them. When they are
    // apart the pages are swapped, and the areas that were waiting swap theirs.
    async breakApart(look) {
      backdrop.dataset.look = look;
      backdrop.hidden = false;
      world.dataset.hidden = 'break';
      moveOn(otherAreas(layoutNow())); // the areas the layout has besides the large one pick their next page and wait at the gate for this moment

      await sleep(flySeconds * apartAfter);
      world.dataset.hidden = 'apart';
      clearGlitch();
      swapPage();
      screen.apart();
    },

    wait: seconds => sleep(seconds),

    // The next picture of the set fades in
    async pictureIn(set, seconds) {
      backdrop.style.setProperty('--look-seconds', String(seconds));
      showPicture(set, 'in');
      await sleep(seconds);
      if (showing) showing.dataset.state = 'on';
    },

    // The next picture of the set is there at once, in the very next frame, and stays
    async pictureCut(set, seconds) {
      showPicture(set, 'on');
      await sleep(seconds);
    },

    // The picture fades out
    async pictureOut(seconds) {
      backdrop.style.setProperty('--look-seconds', String(seconds));
      if (showing) showing.dataset.state = 'out';
      await sleep(seconds);
    },

    // The screen comes back: the frames of the next screen fall into a pile, a cube rises and the
    // frames fly back (core/hidden-pile.js), and then the content comes in. The three parts
    // take 5 seconds at the most, and nothing else moves meanwhile. cameBack is the last part only,
    // since the rotation clock was held for the rest
    async rebuild() {
      screen.together();
      pauseRotation();
      rotationHeld = true;

      pile = makePile();
      if (!pile.empty) {
        world.dataset.hidden = 'fall';
        const plan = pile.release(Math.floor(Math.random() * 4294967296));
        await sleep(pileTimes.cubeAtMs / 1000);
        pile.showCube();
        await sleep((pileTimes.liftAtMs - pileTimes.cubeAtMs) / 1000);
        world.dataset.lift = ''; // the second pulse: the pieces lift
        await sleep((plan.lockedMs - pileTimes.liftAtMs) / 1000);
        pile.finish();
      }

      const started = performance.now();
      world.dataset.hidden = 'build';
      pile.contentIn();
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
  delete world.dataset.lift;
  if (rotationHeld) resumeRotation();
  rotationHeld = false;
  try {
    if (pile) pile.clear();
  } catch (error) {
    console.error('The frames of the hidden transition could not be put back', error);
  }
  pile = null;
  world.style.removeProperty('--glitch-seconds');
  backdrop.hidden = true;
  delete backdrop.dataset.look;
  backdrop.style.removeProperty('--look-seconds');
  backdrop.style.removeProperty('--picture-fill');
  Object.keys(pictureElements).forEach(file => delete pictureElements[file].dataset.state);
  showing = null;
  clearGlitch();
  frame.stopGlitch();
  frame.setHiddenPlaying(false);
  screen.end();
  playing = false;
}
