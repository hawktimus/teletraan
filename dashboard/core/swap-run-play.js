// The queue of swaps, when one may start, and playing one (part of swap-run.js).

import * as frame from '../frame.js';
import { panels } from '../registry.js';
import { setSwapOffer, startWholeScreen } from './areas.js';
import { setBusy } from './busy.js';
import { screenPlace } from './hidden-pile.js';
import { layoutIsReloading } from './layout-apply.js';
import { holdClock, moveOn } from './schedule.js';
import { teamPending } from './teams.js';
import { lookIsWaiting } from './theme-apply.js';
import { contentFade, hawkMotionFor, planPull, planReform, poseFrames, pullEaseText, reformEaseText, restPose, swapReform, swapTimes } from './swap-plan.js';
import { takeoverRunning } from './takeover.js';
import { capture, flyHawk, landHawk, startHawk, targetOf } from './swap-run-copy.js';
import { reformRunning } from './reform-run.js';
import { reformOffer } from './transition-kinds.js';

const longestRest = 8000; // milliseconds to wait for the three areas to stop moving before giving up. A page change takes two seconds and the small areas may be in one
const regionWait = 1200; // milliseconds to wait, once the pieces are out, for the other areas to have chosen their pages
const reloadWait = 8000; // how long the screen stays apart for a page that is about to reload, which only a failed change of layout does
const calmFadeMs = 300; // the stage fades out and in, in calm motion, in this time each
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
  return playing || reformRunning();
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
  // The panel and view transitions come first (core/transition-kinds.js)
  const reformed = reformOffer({ motion: frame.motionNow(), looked: looked, monday: isMondayCard(old.id) || isMondayCard(next.id), busy: false, busyNow: () => takeoverRunning() || askBusy(), hold: holdClock });
  if (reformed) return reformed;
  // One Monday card to the next has no look to change, so in calm motion and with none it is the usual page change
  if (!looked && (frame.motionNow() !== 'full' || (!isMondayCard(old.id) && !isMondayCard(next.id)))) return null;

  const icon = hawkMotionFor({ motion: frame.motionNow(), team: teamPending(), fromMonday: isMondayCard(old.id), intoMonday: isMondayCard(next.id) });
  return { play: swapPage => play(swapPage, icon) };
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
  // Counted after the new look is measured, so the time that takes is not added to the end
  const atMs = elapsed();
  const endMs = Math.max(swapTimes.reformEndMs, atMs + swapReform.reformDelayMostMs + swapReform.travelLeastMs);
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
