// Plays the swap (docs/layouts.md, "The swap"). Deciding what each piece does and when is in
// core/swap-plan.js, which has no page in it. This file finds the pieces on the page, measures them,
// hands them to the plan and plays the answer with element.animate(), so the moves are the ones the
// plan gives and nothing else: transform and opacity.
//
// A swap replaces the page change of the large panel (core/areas.js, setSwapOffer) when
//   - the look rotation has held a new style or team (queueSwap, called by core/look-rotation-run.js), or
//   - the page on screen or the page to come is a Monday card, which covers going from one card to the
//     next, entering the Monday block and leaving it.
// It never starts while an alert, an announcement, a talk, the demo, the night screen or a hidden
// transition has the screen, and not in calm or no motion. The page change is then the usual one, and a
// look that was held goes on in it.
//
// How it goes, with the times of swap-plan.js:
//   1. The frames show as their pieces (#world gets data-pieces, which frame.css reads). The pieces
//      pull apart, the content fades out and the logo becomes a hawk that lifts off.
//   2. At the moment the pieces are out, one step does it all: the look goes on, the large panel's page is
//      swapped, and the other areas swap theirs at the gate of core/areas.js, as in a hidden transition.
//      The pieces are measured again, in the new look, and each takes over from an old piece.
//   3. The pieces travel to their places, the content fades in, and the hawk lands.
// A change between two layouts reloads the page (core/layout-apply.js): then the screen stays apart
// until the page is gone, and the new page starts as the screen does.

import * as frame from '../frame.js';
import { panels } from '../registry.js';
import { setSwapOffer, startWholeScreen } from './areas.js';
import { setBusy } from './busy.js';
import { boltBox, boltCopy, boxOf, findBolts, findBoxes, findContent, findPlates, screenPlace } from './hidden-pile.js';
import { layoutIsReloading } from './layout-apply.js';
import { layoutNow, otherAreas } from './layout.js';
import { holdClock, moveOn } from './schedule.js';
import { contentFade, flapFrames, hawkShape, hawkTransform, planHawk, planPull, planReform, poseFrames, restPose, standardEaseText, swapTimes } from './swap-plan.js';
import { takeoverRunning } from './takeover.js';

const longestRest = 1500; // milliseconds to wait for the three areas to stop moving before giving up
const reloadWait = 8000; // how long the screen stays apart for a page that is about to reload
const hawkLiftMs = 350; // the hawk hovers and lifts until the new place is known, then flies
const hawkLiftPixels = 40;
const hawkLandMs = 150; // the hawk and the logo cross-fade for this long at the end
const hawkColors = ['--logo-purple', '--logo-tail', '--logo-far'];

let askBusy = () => false; // true while an announcement, the demo, the night screen or a hidden transition has the screen
let queued = false; // the look rotation has held a look, so the next page change of the large panel is a swap
let playing = false;

// The look rotation says that the look it has held goes on in the next page change of the large panel
export function queueSwap() {
  queued = true;
}

// True while a swap plays. The hidden transitions ask, so they wait for it to be over.
export function swapRunning() {
  return playing;
}

// busyElsewhere() is true while something else has the screen (core/look-rotation-run.js gives it)
export function startSwaps(busyElsewhere) {
  askBusy = busyElsewhere;
  setSwapOffer(offer);
}

function isMondayCard(id) {
  const panel = panels.find(item => item.id === id);
  return Boolean(panel && panel.monday);
}

// Called at each page change of the large panel, with the page on screen and the next one
function offer(old, next) {
  const looked = queued;
  queued = false;

  if (playing || frame.motionNow() !== 'full' || takeoverRunning() || askBusy()) return null;
  if (!looked && !isMondayCard(old.id) && !isMondayCard(next.id)) return null;

  return { play: swapPage => play(swapPage) };
}


// Finding the pieces

// The part of the screen an element is in, which is how an old piece and a new one are matched
function regionOf(element) {
  const region = element.closest('[id^="region-"]');
  return region ? region.id : '';
}

// Everything on the page that moves in a swap, measured on the 1920 x 1080 screen: the pieces of metal
// (swap-plan.js says what a piece is), the content that fades, and the logos. The areas whose frames
// are cut up are marked data-pile="pieces", so that frame.css shows their pieces.
function capture(stage, place) {
  const plates = findPlates(stage);
  const boxes = findBoxes(stage);
  const content = findContent(stage, boxes);
  const bolts = findBolts(stage, plates);
  const counts = {};
  const pieces = [];

  const numberIn = (kind, region) => {
    const key = kind + '|' + region;
    counts[key] = (counts[key] || 0) + 1;
    return counts[key] - 1;
  };
  const add = (kind, id, element, parent) => {
    const box = boxOf(element, place);
    const region = regionOf(element);
    const piece = { id: id, kind: kind, region: region, index: numberIn(kind, region), parent: parent, left: box.left, top: box.top, width: box.width, height: box.height, element: element, zoom: box.zoom };
    pieces.push(piece);
    return piece;
  };

  plates.forEach((plate, index) => add('plate', 'plate-' + index, plate, ''));
  boxes.forEach((region, index) => add('box', 'box-' + index, region, ''));

  bolts.forEach((bolt, index) => {
    const plate = plates.indexOf(bolt.closest('svg.plate'));
    const box = boxOf(bolt, place);
    const size = boltBox * pieces[plate].zoom;
    const middle = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const region = pieces[plate].region;

    pieces.push({ id: 'bolt-' + index, kind: 'bolt', region: region, index: numberIn('bolt', region), parent: 'plate-' + plate, left: middle.x - size / 2, top: middle.y - size / 2, width: size, height: size, element: null, bolt: bolt, middle: middle, zoom: 1 });
  });

  const logos = Array.from(stage.querySelectorAll('.logo'))
    .map(element => Object.assign({ element: element }, boxOf(element, place)))
    .filter(logo => logo.width > 0 && logo.height > 0);

  return { pieces: pieces, content: content, logos: logos };
}

// A bolt moves as a copy of its own in #pile, and the bolt on the frame is out of sight meanwhile
function makeCopy(piece, layer) {
  const size = piece.width;
  const copy = boltCopy(piece.bolt, piece.middle, size);

  piece.bolt.dataset.pile = 'released';
  layer.insertBefore(copy, document.getElementById('cube'));
  return copy;
}

// The element that moves for a piece
function targetOf(piece, layer, copies) {
  if (piece.kind !== 'bolt') return piece.element;

  if (!copies[piece.id]) copies[piece.id] = makeCopy(piece, layer);
  return copies[piece.id];
}


// The hawk

// The logo becomes a hawk, a copy of the logo over everything, that flaps on the spot and lifts. It flies
// when the new place is known (flyHawk). The logo itself is out of sight until the hawk lands.
function startHawk(run, logos, layer) {
  const old = logos[0];
  if (!old) return;

  const original = old.element;
  const clone = original.cloneNode(true);
  const styles = window.getComputedStyle(original);

  clone.classList.add('swap-hawk');
  clone.removeAttribute('data-team-logo');
  clone.querySelectorAll('.team-logo').forEach(picture => picture.remove());
  clone.dataset.act = 'swap';
  clone.style.cssText = 'position: absolute; left: ' + old.left + 'px; top: ' + old.top + 'px; width: ' + old.width + 'px; height: ' + old.height + 'px; margin: 0; transform-origin: 50% 50%;';
  const k = styles.getPropertyValue('--k');
  if (k) clone.style.setProperty('--k', k);
  hawkColors.forEach(name => clone.style.setProperty(name, styles.getPropertyValue(name))); // the old colors, until the top of the arc

  layer.appendChild(clone);
  hideLogo(run, original);

  const flap = flapFrames();
  const beat = { duration: Math.round(hawkShape.flapMs * frame.pace()), iterations: Infinity, easing: hawkShape.easing };
  const wings = [['.hawk-near-wing', flap.near], ['.hawk-far-wing', flap.far]];
  wings.forEach(wing => {
    const part = clone.querySelector(wing[0]);
    if (part) run.hawkAnimations.push(part.animate(wing[1], beat));
  });

  const lift = clone.animate(
    [{ transform: 'translate(0px, 0px) rotate(0deg) scale(1) scaleX(1)' }, { transform: 'translate(0px, ' + (-hawkLiftPixels) + 'px) rotate(0deg) scale(1) scaleX(1)' }],
    { duration: Math.round(hawkLiftMs * frame.pace()), easing: 'ease-out', fill: 'forwards' }
  );
  run.hawkAnimations.push(lift);
  run.hawk = { clone: clone, old: old, lift: lift };
}

function hideLogo(run, logo) {
  logo.style.visibility = 'hidden';
  run.hiddenLogos.push(logo);
}

// The new place is known: the hawk flies there in one arc, changes color at the top of it and lands
function flyHawk(run, logos, pace) {
  const hawk = run.hawk;
  if (!hawk) return;

  const target = logos[0];
  logos.forEach(logo => hideLogo(run, logo.element));

  const old = hawk.old;
  const from = { x: old.left + old.width / 2, y: old.top + old.height / 2, width: old.width, height: old.height };
  const to = target ? { x: target.left + target.width / 2, y: target.top + target.height / 2, width: target.width, height: target.height } : from;
  const plan = planHawk(from, to, swapTimes.hawkMs - hawkLiftMs, hawkLiftPixels);

  const frames = plan.keyframes.map(keyframe => ({ offset: keyframe.offset, transform: hawkTransform(keyframe, plan.direction) }));
  hawk.lift.cancel();
  run.hawkAnimations.push(hawk.clone.animate(frames, { duration: Math.round(plan.durationMs * pace), easing: 'linear', fill: 'forwards' }));
  run.hawkColorTimer = setTimeout(() => hawkColors.forEach(name => hawk.clone.style.removeProperty(name)), Math.round(plan.apexMs * pace));
}

// The hawk is gone and the logo is back, with a short fade between them
async function landHawk(run, pace) {
  const hawk = run.hawk;
  if (!hawk) return;

  const fade = Math.round(hawkLandMs * pace);
  hawk.clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, fill: 'forwards' });
  run.hiddenLogos.forEach(logo => {
    logo.style.removeProperty('visibility');
    logo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade });
  });
  run.hiddenLogos = [];
  await frame.wait(fade);
}


// The swap

function interrupted() {
  return takeoverRunning() || askBusy() || frame.motionNow() !== 'full';
}

// A swap begins only when the areas are all at rest. A page change that is half done would be carried
// away with its frame, which looks wrong.
async function waitForRest() {
  const until = performance.now() + longestRest;
  while (performance.now() < until) {
    if (interrupted()) return false;
    if (!document.querySelector('.area:not([data-state="shown"])')) return true;
    await frame.wait(100);
  }
  return false;
}

// Plays the swap. swapPage() puts the large panel's next page in and puts the held look on; the other
// areas swap their pages by themselves (core/areas.js, startWholeScreen). Resolves with how many
// milliseconds the pieces took to re-form, or 0 when the swap did not start or failed before the pages swapped.
async function play(swapPage) {
  if (playing) return 0;
  playing = true;

  const screen = startWholeScreen(false);
  const run = { animations: [], hawkAnimations: [], hawk: null, hawkColorTimer: null, hiddenLogos: [], copies: {} };
  let cameBack = 0;

  setBusy(true);
  frame.setSwapPlaying(true);
  holdClock(true);
  try {
    if (await waitForRest()) cameBack = await perform(run, screen, swapPage);
  } catch (error) {
    console.error('The swap failed', error);
  } finally {
    putBackPieces(run);
    putBackHawk(run);
    screen.together();
    screen.end();
    holdClock(false);
    frame.setSwapPlaying(false);
    setBusy(false);
    playing = false;
  }
  return cameBack;
}

async function perform(run, screen, swapPage) {
  const world = document.getElementById('world');
  const stage = document.getElementById('stage');
  const layer = document.getElementById('pile');
  const pace = frame.pace();
  const started = performance.now();
  const ms = normal => Math.round(normal * pace);
  const elapsed = () => (performance.now() - started) / pace; // milliseconds at normal speed
  const until = normal => frame.wait(Math.max(0, started + ms(normal) - performance.now()));
  const seed = Math.floor(Math.random() * 4294967296);

  // 1. The pieces pull apart
  world.dataset.pieces = '';
  layer.hidden = false;
  const before = capture(stage, screenPlace());
  const pull = planPull(before.pieces, seed);
  const beforeById = {};
  before.pieces.forEach(piece => { beforeById[piece.id] = piece; });

  pull.pieces.forEach(entry => {
    const piece = beforeById[entry.id];
    run.animations.push(targetOf(piece, layer, run.copies).animate(poseFrames(restPose, entry.out, piece.zoom), { delay: ms(entry.delayMs), duration: ms(entry.ms), easing: standardEaseText, fill: 'both' }));
  });
  const fade = contentFade();
  before.content.forEach(node => {
    run.animations.push(node.animate([{ opacity: 1 }, { opacity: 0 }], { delay: ms(fade.out.delayMs), duration: ms(fade.out.ms), easing: 'linear', fill: 'forwards' }));
  });
  startHawk(run, before.logos, layer);
  moveOn(otherAreas(layoutNow())); // the other areas pick their next pages and wait at the gate for the moment the screen is apart

  await until(swapTimes.switchMs);

  // 2. The look goes on and the pages swap, in one step, so that nothing is drawn in between
  const atMs = Math.min(elapsed(), swapTimes.reformEndMs - 100);
  swapPage();
  screen.apart();
  if (layoutIsReloading()) await frame.wait(reloadWait);

  run.animations.forEach(animation => animation.cancel());
  run.animations = [];
  Object.keys(run.copies).forEach(id => run.copies[id].remove());
  run.copies = {};
  document.querySelectorAll('[data-pile="released"]').forEach(bolt => { delete bolt.dataset.pile; });

  const place = screenPlace();
  const after = capture(stage, place);
  const reform = planReform(pull, before.pieces, after.pieces, atMs, seed + 1);
  const afterById = {};
  after.pieces.forEach(piece => { afterById[piece.id] = piece; });

  // 3. The pieces re-form, the content comes back and the hawk flies
  reform.pieces.forEach(entry => {
    const piece = afterById[entry.id];
    run.animations.push(targetOf(piece, layer, run.copies).animate(poseFrames(entry.from, entry.to, piece.zoom), { delay: ms(entry.delayMs), duration: ms(entry.ms), easing: standardEaseText, fill: 'both' }));
  });
  const left = swapTimes.reformEndMs - atMs;
  const hold = (fade.in.delayMs - atMs) / left;
  after.content.forEach(node => {
    run.animations.push(node.animate([{ opacity: 0 }, { opacity: 0, offset: hold }, { opacity: 1 }], { duration: ms(left), easing: 'linear', fill: 'both' }));
  });
  flyHawk(run, after.logos, pace);

  await until(swapTimes.reformEndMs);
  putBackPieces(run);

  if (run.hawk) {
    await until(swapTimes.hawkMs - hawkLandMs);
    await landHawk(run, pace);
  }
  return ms(left);
}

// The screen as it was, whatever happened: the animations, the copies of the bolts, the marks on the
// pieces and the content. It can be called at any time, and more than once.
function putBackPieces(run) {
  run.animations.forEach(animation => animation.cancel());
  run.animations = [];
  Object.keys(run.copies).forEach(id => run.copies[id].remove());
  run.copies = {};

  document.querySelectorAll('[data-pile]').forEach(element => { delete element.dataset.pile; });
  const world = document.getElementById('world');
  if (world) delete world.dataset.pieces;
}

function putBackHawk(run) {
  clearTimeout(run.hawkColorTimer);
  run.hawkAnimations.forEach(animation => animation.cancel());
  run.hawkAnimations = [];
  if (run.hawk) run.hawk.clone.remove();
  run.hawk = null;
  run.hiddenLogos.forEach(logo => logo.style.removeProperty('visibility'));
  run.hiddenLogos = [];

  const layer = document.getElementById('pile');
  if (layer) layer.hidden = true;
}
