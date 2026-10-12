// Plays the swap (docs/layouts.md, "The swap"). Deciding what each piece does and when is in
// core/swap-plan.js, which has no page in it. This file finds the pieces on the page, measures them,
// hands them to the plan and plays the answer with element.animate(), so the moves are the ones the
// plan gives and nothing else: transform and opacity.
//
// A swap replaces the page change of the large panel (core/areas.js, setSwapOffer) when
//   - the Screens have held a new style or team, or gone into the Monday cards or out of them (queueSwap, called by
//     core/screens-run.js), or
//   - a look is waiting to go on, which is a preview, a team of Alternate mode or a theme from the Look page, or
//   - the page on screen or the page to come is a Monday card, in full motion, which covers going from one
//     card to the next, entering the Monday block and leaving it.
// It never starts while an alert, an announcement, a talk, the demo, the night screen or a hidden
// transition has the screen. The page change is then the usual one, and a look that was held goes on in it.
// Every time of a swap is stretched or shortened by the length the Screen it goes to gives (swapScale), on top of the
// Speed setting.
//
// How it goes in full motion, with the times of swap-plan.js:
//   1. The frames show as their pieces (#world gets data-pieces, which frame.css reads). The pieces
//      pull apart, the content fades out and the logo is copied: the copy stays where the logo was.
//   2. At the moment the pieces are out, one step does it all: the look goes on (the style, the team and
//      the layout), the large panel's page is swapped, and the other areas swap theirs, which they waited to
//      do at the gate of core/areas.js. The pieces are measured again, in the new look, and each takes
//      over from an old piece.
//   3. The pieces travel to their places, the content fades in, and the copy of the logo travels to the new place
//      of the logo with them. A team or a style that changes makes it flutter for a moment as a hawk. A Monday card on
//      either side only carries it, and never makes it a bird (hawkMotionFor in core/swap-plan.js). Then the copy and
//      the logo cross-fade.
// In calm motion the whole stage fades out, the look goes on, and the stage fades in. With motion off the
// look goes on at once. Neither has pieces. A change of layout is the same step in every case: the page does not
// reload for it (core/layout-apply.js, changeLayoutNow).

import * as frame from '../frame.js';
import { panels } from '../registry.js';
import { setSwapOffer, startWholeScreen } from './areas.js';
import { setBusy } from './busy.js';
import { boltBox, boltCopy, boxOf, findBolts, findBoxes, findContent, findPlates, screenPlace } from './hidden-pile.js';
import { layoutIsReloading } from './layout-apply.js';
import { holdClock, moveOn } from './schedule.js';
import { teamPending } from './teams.js';
import { lookIsWaiting } from './theme-apply.js';
import { birdFades, contentFade, flapFrames, hawkMotionFor, hawkShape, hawkTransform, planHawk, planPull, planReform, poseFrames, pullEaseText, reformEaseText, restPose, swapReform, swapTimes } from './swap-plan.js';
import { takeoverRunning } from './takeover.js';

const longestRest = 8000; // milliseconds to wait for the three areas to stop moving before giving up. A page change takes two seconds and the small areas may be in one
const regionWait = 1200; // milliseconds to wait, once the pieces are out, for the other areas to have chosen their pages
const reloadWait = 8000; // how long the screen stays apart for a page that is about to reload, which only a failed change of layout does
const calmFadeMs = 300; // the stage fades out and in, in calm motion, in this time each
const hawkColors = ['--logo-purple', '--logo-tail', '--logo-far'];
const otherRegions = ['grid2', 'ticker']; // the small frame and the ticker, in every layout: one that the layout does not have waits and drops its page

let askBusy = () => false; // true while an announcement, the demo, the night screen or a hidden transition has the screen
let swapScale = () => 1; // how many times the standard length the swap into the Screen on screen takes (core/screens.js, swapScaleOf)
let queued = false; // the Screens have held a look, so the next page change of the large panel is a swap
let playing = false;

// The Screens say that the look they have held goes on in the next page change of the large panel
export function queueSwap() {
  queued = true;
}

// The pace of everything a swap does: the Speed setting times the length of the Screen. A scale that is not a
// number above zero is the standard length.
function paceNow() {
  const scale = swapScale();
  return frame.pace() * (typeof scale === 'number' && isFinite(scale) && scale > 0 ? scale : 1);
}

// True while a swap plays. The hidden transitions ask, so they wait for it to be over.
export function swapRunning() {
  return playing;
}

// busyElsewhere() is true while something else has the screen, and scaleNow() is the scale of the swap into the Screen
// on screen (core/screens-run.js gives both)
export function startSwaps(busyElsewhere, scaleNow = () => 1) {
  askBusy = busyElsewhere;
  swapScale = scaleNow;
  setSwapOffer(offer);
}

// A look that nobody queued, a preview, a team that is waiting to go on or a theme from the Look page, still goes on in a swap
function lookWaiting() {
  return lookIsWaiting() || teamPending();
}

function isMondayCard(id) {
  const panel = panels.find(item => item.id === id);
  return Boolean(panel && panel.monday);
}

// Called at each page change of the large panel, with the page on screen and the next one
function offer(old, next) {
  const looked = queued || lookWaiting();
  queued = false;

  if (playing || takeoverRunning() || askBusy()) return null;
  // One Monday card to the next has no look to change, so in calm motion and with none it is the usual page change
  if (!looked && (frame.motionNow() !== 'full' || (!isMondayCard(old.id) && !isMondayCard(next.id)))) return null;

  const icon = hawkMotionFor({ motion: frame.motionNow(), team: teamPending(), fromMonday: isMondayCard(old.id), intoMonday: isMondayCard(next.id) });
  return { play: swapPage => play(swapPage, icon) };
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


// The icon

// The logo is copied into #pile, over everything, and the logo itself is out of sight until the copy lands. The copy
// stays where the logo was until the new place is known (flyHawk). It is a copy and not the logo that moves, because
// the banner is drawn again in the moment the look goes on, and a team's own picture is carried as it is.
function startHawk(run, logos, layer) {
  const old = logos[0];
  if (!old) return;

  const original = old.element;
  const clone = original.cloneNode(true);
  const styles = window.getComputedStyle(original);

  clone.classList.add('swap-hawk');
  clone.style.cssText = 'position: absolute; left: ' + old.left + 'px; top: ' + old.top + 'px; width: ' + old.width + 'px; height: ' + old.height + 'px; margin: 0; transform-origin: 50% 50%;';
  const k = styles.getPropertyValue('--k');
  if (k) clone.style.setProperty('--k', k);
  hawkColors.forEach(name => clone.style.setProperty(name, styles.getPropertyValue(name))); // the old colors, until the middle of the travel

  layer.appendChild(clone);
  hideLogo(run, original);
  run.hawk = { clone: clone, old: old };
}

function hideLogo(run, logo) {
  logo.style.visibility = 'hidden';
  run.hiddenLogos.push(logo);
}

// The new place is known: the copy travels there with the pieces, from the moment the look went on to the moment they are
// home, and takes the colors of the new look half way. icon is what hawkMotionFor said, and a slight swap makes the copy a
// hawk for a moment on the way (flutter). travelMs is how long the pieces take, at normal speed.
function flyHawk(run, logos, pace, icon, travelMs) {
  const hawk = run.hawk;
  if (!hawk) return;

  const target = logos[0];
  logos.forEach(logo => hideLogo(run, logo.element));

  const old = hawk.old;
  const from = { x: old.left + old.width / 2, y: old.top + old.height / 2, width: old.width, height: old.height };
  const to = target ? { x: target.left + target.width / 2, y: target.top + target.height / 2, width: target.width, height: target.height } : from;
  const plan = planHawk(from, to, travelMs, icon === 'slight' ? hawkShape.hopHeight : 0);

  const frames = plan.keyframes.map(keyframe => ({ offset: keyframe.offset, transform: hawkTransform(keyframe, plan.direction) }));
  run.hawkAnimations.push(hawk.clone.animate(frames, { duration: Math.round(plan.durationMs * pace), easing: 'linear', fill: 'forwards' }));
  run.hawkColorTimer = setTimeout(() => hawkColors.forEach(name => hawk.clone.style.removeProperty(name)), Math.round(plan.apexMs * pace));
  if (icon === 'slight') flutter(run, hawk.clone, pace);
}

// The emblem turns into the hawk and back in birdMs, and the wings beat. The animations end with the flutter, and the parts go
// back to what frame.css says: the emblem shown and the hawk hidden
function flutter(run, clone, pace) {
  const fades = birdFades();
  const flap = flapFrames();
  const beat = { duration: Math.round(hawkShape.birdMs / hawkShape.beats * pace), iterations: hawkShape.beats, easing: hawkShape.easing };
  const fade = { duration: Math.round(hawkShape.birdMs * pace), easing: 'linear' };

  clone.querySelectorAll('.emblem').forEach(part => run.hawkAnimations.push(part.animate(fades.emblem, fade)));
  clone.querySelectorAll('.hawk-part').forEach(part => run.hawkAnimations.push(part.animate(fades.hawk, fade)));
  [['.hawk-near-wing', flap.near], ['.hawk-far-wing', flap.far]].forEach(wing => {
    const part = clone.querySelector(wing[0]);
    if (part) run.hawkAnimations.push(part.animate(wing[1], beat));
  });
}

// The copy is gone and the logo is back, with a short fade between them
async function landHawk(run, pace) {
  const hawk = run.hawk;
  if (!hawk) return;

  const fade = Math.round(swapTimes.landMs * pace);
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
  return takeoverRunning() || askBusy();
}

// A swap begins only when the areas are all at rest. A page change that is half done would be carried
// away with its frame, which looks wrong. The gate (startWholeScreen) is up already, so no area starts
// another change: the ones that are changing page finish, and that is all there is to wait for.
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
async function play(swapPage, icon) {
  if (playing) return 0;
  playing = true;

  const screen = startWholeScreen(false);
  const run = { animations: [], hawkAnimations: [], hawk: null, hawkColorTimer: null, hiddenLogos: [], copies: {} };
  let cameBack = 0;

  setBusy(true, 'swap');
  frame.setSwapPlaying(true);
  holdClock(true);
  try {
    if (await waitForRest()) cameBack = frame.motionNow() === 'full' ? await perform(run, screen, swapPage, icon) : await performFade(run, screen, swapPage);
  } catch (error) {
    console.error('The swap failed', error);
  } finally {
    putBackPieces(run);
    putBackHawk(run);
    screen.together();
    screen.end();
    holdClock(false);
    frame.setSwapPlaying(false);
    setBusy(false, 'swap');
    playing = false;
  }
  return cameBack;
}

async function perform(run, screen, swapPage, icon) {
  const world = document.getElementById('world');
  const stage = document.getElementById('stage');
  const layer = document.getElementById('pile');
  const pace = paceNow();
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
    const target = targetOf(piece, layer, run.copies);
    run.animations.push(target.animate(poseFrames(restPose, entry.out, piece.zoom), { delay: ms(entry.delayMs), duration: ms(entry.ms), easing: pullEaseText, fill: 'both' }));
    // a little fainter for a moment before the look goes on, so that the new shape does not jump in
    run.animations.push(target.animate([{ opacity: 1 }, { opacity: swapReform.dipLeast }], { delay: ms(swapTimes.switchMs - swapReform.dipBeforeMs), duration: ms(swapReform.dipBeforeMs), easing: 'ease-in', fill: 'forwards' }));
  });
  const fade = contentFade();
  before.content.forEach(node => {
    run.animations.push(node.animate([{ opacity: 1 }, { opacity: 0 }], { delay: ms(fade.out.delayMs), duration: ms(fade.out.ms), easing: 'linear', fill: 'forwards' }));
  });
  startHawk(run, before.logos, layer);
  moveOn(otherRegions); // the other areas pick their next pages and wait at the gate for the moment the screen is apart

  await until(swapTimes.switchMs);
  await screen.waitForRegions(otherRegions, regionWait); // they are in place, which matters when the layout gives them or takes them away

  // 2. The look goes on and the pages swap, in one step, so that nothing is drawn in between
  const atMs = elapsed();
  const endMs = Math.max(swapTimes.reformEndMs, atMs + swapReform.reformDelayMostMs + swapReform.travelLeastMs);
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
  const reform = planReform(pull, before.pieces, after.pieces, atMs, seed + 1, endMs);
  const afterById = {};
  after.pieces.forEach(piece => { afterById[piece.id] = piece; });

  // 3. The pieces re-form, the content comes back and the hawk flies
  reform.pieces.forEach(entry => {
    const piece = afterById[entry.id];
    const target = targetOf(piece, layer, run.copies);
    run.animations.push(target.animate(poseFrames(entry.from, entry.to, piece.zoom), { delay: ms(entry.delayMs), duration: ms(entry.ms), easing: reformEaseText, fill: 'both' }));
    run.animations.push(target.animate([{ opacity: entry.fadesIn ? 0 : swapReform.dipLeast }, { opacity: 1 }], { duration: ms(swapReform.dipAfterMs), easing: 'ease-out', fill: 'both' }));
  });
  const left = endMs - atMs;
  const hold = (endMs - swapTimes.fadeMs - atMs) / left;
  after.content.forEach(node => {
    run.animations.push(node.animate([{ opacity: 0 }, { opacity: 0, offset: hold }, { opacity: 1 }], { duration: ms(left), easing: 'linear', fill: 'both' }));
  });
  flyHawk(run, after.logos, pace, icon, left);

  await until(endMs);
  putBackPieces(run);
  await landHawk(run, pace);
  return ms(left);
}

// Calm motion and no motion have no pieces. In calm the whole stage fades out, the look goes on while it is out of
// sight, and the stage fades in. With no motion the look goes on at once. The other areas wait at the gate as they do
// in the swap, because the layout may give them or take them away.
async function performFade(run, screen, swapPage) {
  const stage = document.getElementById('stage');
  const calm = frame.motionNow() === 'calm';
  const pace = paceNow();
  const ms = normal => Math.round(normal * pace);

  moveOn(otherRegions);
  if (calm) {
    run.animations.push(stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(calmFadeMs), easing: 'linear', fill: 'forwards' }));
    await frame.wait(ms(calmFadeMs));
  }
  await screen.waitForRegions(otherRegions, regionWait);

  swapPage();
  screen.apart();
  if (layoutIsReloading()) await frame.wait(reloadWait);

  if (!calm) return 0;

  run.animations.forEach(animation => animation.cancel());
  run.animations = [];
  run.animations.push(stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(calmFadeMs), easing: 'linear', fill: 'both' }));
  await frame.wait(ms(calmFadeMs));
  return ms(calmFadeMs);
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
