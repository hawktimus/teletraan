// Presentation mode on the page: the title card, the slides, the thanks card and the keys of
// the clicker (docs/presentations.md). core/presentation.js decides what happens and when.
// This file gives it the real screen: the one clock, the keys, localStorage, the pictures
// (panels/talk) and the hold on the rest of the dashboard (frame.pause).
//
// The talk is drawn in #talk, which is under #overlay, so an alert still covers it.

import * as frame from '../frame.js';
import { buildPage } from './panels.js';
import { takeoverRunning } from './takeover.js';
import { chipSeconds, chipShown, holdsScreen, idleState, keyAction, nextState, pictureOf, preloadAhead, preloadIndexes, pressKey, progressOf, readSkipped, rememberEnded, slideAddress, slideNumberText, slidePages, slidesFolder } from './presentation.js';

const root = document.documentElement;
const layer = document.getElementById('talk');
const manifestWaitMs = 10000; // a manifest that takes longer than this counts as missing

let getContent = null;
let storage = null;
let skipped = new Set(); // the talks that were skipped or are over
let testTalk = null; // the sample talk that Run presentation test started: not in the content, and its slides are in the sample folder whatever the content source is
let state = idleState();
let manifest; // the manifest.json of the talk on the title card: undefined until it has been read, null when there is none
let titles = 0; // how many title cards have come up, so an answer for an old one that arrives late is dropped
let folder = ''; // where the manifest and the pictures of the talk are
let card = null; // the title, not-ready or thanks card on the screen
let leaving = 0; // how many cards are fading out
let view = null; // the view that holds the slides, while the talk is on its slides
let shown = -1; // the place of the slide that is in the view
const images = new Map(); // the img of each slide near the one on screen, by place

// Even asking for localStorage can throw, for example when the browser has storage switched off
function savedStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

// getContent() returns the newest content. Start this after the takeovers, so that on a second
// when an announcement comes due, it has the screen before a title card looks.
export function startPresentations(contentGetter) {
  getContent = contentGetter;
  storage = savedStorage();
  skipped = readSkipped(storage);

  window.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', () => setTimeout(takeFocus, 0));
  frame.onSecond(look);
}

// Starts the sample talk now (core/presentation-test.js). It goes through the same states as a
// booked talk, so it waits for an announcement and ends the same ways.
export function startTestTalk(talk) {
  testTalk = talk;
  look(new Date());
}

// Once a second, and when a manifest arrives
function look(now) {
  const content = getContent();
  if (!content) return;

  step(nextState(state, {
    now: now,
    talks: testTalk ? content.presentations.concat([testTalk]) : content.presentations,
    settings: content.settings,
    skipped: skipped,
    announcing: takeoverRunning(),
    slides: manifest,
  }));
  drawChip(now);
  takeFocus();
}

function onKey(event) {
  if (!holdsScreen(state) || event.ctrlKey || event.altKey || event.metaKey) return;
  if (keyAction(event.key) === null) return;

  // Every key of the clicker is ours, so F5 does not reload the page and Space does not scroll it.
  // A key that is held down repeats, and a repeat must not skip slides or count as a second Esc.
  event.preventDefault();
  if (event.repeat) return;

  step(pressKey(state, event.key, new Date()));
  setTimeout(() => drawChip(new Date()), chipSeconds * 1000 + 50);
}

// A kiosk page gets the keys of the clicker only while it has focus. A click, a popup or the
// browser's own bar can take the focus away, and then the keys would go nowhere. So the layer
// takes it back for as long as a talk holds the screen.
function takeFocus() {
  if (holdsScreen(state) && !layer.hidden && document.activeElement !== layer) layer.focus({ preventScroll: true });
}

// Moves the screen to the next state. A state that is skipped or over is remembered first,
// so that the talk does not start again.
function step(next) {
  if (next === state) return;

  const before = state;
  state = next;
  rememberEnded(storage, skipped, state);

  try {
    show(before, state);
  } catch (error) {
    giveUp(error);
  }
}

function show(before, after) {
  if (before.name === 'idle') takeScreen(after);
  if (pictureOf(before) !== pictureOf(after)) changePicture(after);
  if (after.name === 'presenting') drawSlide(after);
  if (after.name === 'idle') releaseScreen();
  preload(after);
}

// A title card has come up: the rest of the dashboard waits, and the manifest is read again
// so that a deck that was fetched a minute ago is the one that shows
function takeScreen(first) {
  const content = getContent();
  const sample = Boolean(content.status && content.status.source === 'sample') || (testTalk !== null && first.talk.id === testTalk.id);
  folder = slidesFolder(sample, first.talk);
  manifest = undefined;
  images.clear();

  frame.pause('talk');
  layer.hidden = false;
  takeFocus();

  const reading = ++titles;
  readManifest(folder + 'manifest.json').then(answer => {
    if (reading !== titles) return;

    manifest = answer;
    look(new Date());
  });
}

// The manifest.json of a talk. null when there is none, when it cannot be read and when the
// server takes too long. It is never taken from the cache.
function readManifest(address) {
  const answer = fetch(address, { cache: 'no-store' })
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null);
  return Promise.race([answer, frame.wait(manifestWaitMs).then(() => null)]);
}

// A picture of the talk panel (panels/talk), built and not yet on the screen
function build(kind, talk) {
  return buildPage('talk', Object.assign({}, getContent(), { talkScreen: { kind: kind, talk: talk } })).element;
}

function changePicture(after) {
  const picture = pictureOf(after);
  leaveCard();
  if (view && picture !== 'slides') {
    view.remove();
    view = null;
    shown = -1;
    images.clear();
  }

  if (picture === 'none') {
    delete root.dataset.talk; // the dashboard shows again, under the card that is fading out
    return;
  }

  layer.dataset.ground = picture === 'slides' || picture === 'thanks' ? 'black' : 'plain';
  if (picture === 'slides') enterSlides(after.talk);
  else enterCard(picture, after.talk);
}

function enterCard(kind, talk) {
  card = build(kind, talk);
  layer.appendChild(card);
  frame.enter(card).then(() => {
    if (pictureOf(state) !== 'none') root.dataset.talk = 'on';
  });
}

// The slides go under the title card, which fades out over the first one
function enterSlides(talk) {
  view = build('slides', talk);
  shown = -1;
  layer.prepend(view);
  root.dataset.talk = 'on';
}

function leaveCard() {
  if (!card) return;

  const old = card;
  card = null;
  leaving += 1;
  frame.exit(old).then(() => {
    old.remove();
    leaving -= 1;
    releaseScreen();
  });
}

// The dashboard carries on once the last card has gone and no talk is on the screen
function releaseScreen() {
  if (state.name !== 'idle' || card !== null || leaving > 0) return;

  layer.hidden = true;
  delete root.dataset.talk;
  frame.resume('talk');
}

// Whatever fails here, the dashboard comes back, and the talk does not start again
function giveUp(error) {
  console.error('The screen for the talk failed. The dashboard comes back.', error);
  if (state.talk) rememberEnded(storage, skipped, { name: 'skipped', talk: state.talk });

  state = idleState();
  card = null;
  view = null;
  shown = -1;
  images.clear();
  layer.textContent = '';
  releaseScreen();
}

// The slide, the progress line and the slide number. The slide changes at once.
function drawSlide(after) {
  view.dataset.black = after.black ? 'on' : 'off';
  if (shown !== after.slide) {
    const host = view.querySelector('.slide-host');
    host.textContent = '';
    host.appendChild(imageFor(after.slide));
    shown = after.slide;
  }

  view.querySelector('.progress-line').style.transform = 'scaleX(' + progressOf(after) + ')';
  view.querySelector('.chip-count').textContent = slideNumberText(after);
  drawChip(new Date());
}

// The same img is put on the screen that was decoded ahead of time, so there is nothing to wait for
function imageFor(place) {
  if (!images.has(place)) {
    const image = new Image();
    image.className = 'slide';
    image.alt = '';
    image.src = slideAddress(folder, slidePages(manifest)[place]);
    images.set(place, image);
  }
  return images.get(place);
}

// Decodes the next slides, and lets go of the ones that are far behind or far ahead
function preload(after) {
  preloadIndexes(after).forEach(place => {
    if (!images.has(place)) imageFor(place).decode().catch(() => {});
  });

  if (after.name !== 'presenting') return;
  images.forEach((image, place) => {
    if (place < after.slide - 1 || place > after.slide + preloadAhead) images.delete(place);
  });
}

// The chip shows for a few seconds after a key. How it fades is in frame.css.
function drawChip(now) {
  if (!view || state.name !== 'presenting') return;

  const chip = view.querySelector('.chip');
  if (chipShown(state, now)) chip.dataset.shown = 'on';
  else if (chip.dataset.shown === 'on') chip.dataset.shown = 'out';
}
