// The neon kit of the sidebar layout: its glitch and its burst (part of frame.js).

import { isBusy } from './core/busy.js';
import { frameState } from './frame-state.js';
import { isPaused, screenHeld } from './frame-effects.js';
import { pace, page } from './frame-pages.js';
import { areaIsChanging } from './frame-logo.js';

// The Neon Prime kit
//
// Moving neon for the theme with the sidebar layout (docs/layouts.md, "The kit").
// The shapes and every keyframe are in neon-kit.css. Most of the kit is plain CSS
// that runs for as long as the page says so, which it does with html[data-kit="on"]
// (showKit below). Two parts are events, and they are driven from here:
//
//   the name glitch   the team name glitches for a moment, at an irregular
//                     time: 12 to 25 seconds after the last one, a new number
//                     each time
//   the page burst    bars of glitch cross the large frame each time a new
//                     page starts to arrive in it (arrive, above)
//
// The kit is on when shell.js says so (setKit), and only while the motion is full
// and nothing covers the screen: the night screen, an alert or an announcement,
// or a hidden transition. In calm and none motion nothing of it moves. The two
// events are also silent while a demo plays (setEffectsPaused). A glitch that
// comes due when it may not play is skipped, never saved up for later, and the
// timers are cleared when the theme goes away (setKit(false)) or the motion
// leaves full.

// The seconds between two name glitches: a new number between these each time
export const kitGlitchGapSeconds = { least: 12, most: 25 };

// How long each lasts at normal speed. neon-kit.css times its keyframes to them
// (and to --pace, like every other time), so change them together.
const kitGlitchSeconds = 0.4;
const kitBurstSeconds = 0.3;

let kitOn = false; // the theme with the kit is on the page
let takeoverCovers = false; // an alert or an announcement covers the screen
let kitGlitchTimer = null; // waits for the next glitch
let kitGlitchEnd = null; // ends the glitch that is playing
let kitBurstEnd = null; // ends the burst that is playing

// The seconds to wait for the next glitch. random is Math.random, or a stand-in
// in the tests: it gives a number from 0 up to 1.
export function kitGlitchGap(random) {
  const gap = kitGlitchGapSeconds;
  return gap.least + Math.min(1, Math.max(0, random())) * (gap.most - gap.least);
}

// Called by shell.js each time a theme goes on the page, and by takeover.js
// when an alert or an announcement starts and ends.
export function setKit(on) {
  kitOn = on === true;
  showKit();
  if (kitOn && frameState.motion === 'full') armKitGlitch();
  else disarmKitGlitch();
}

export function setTakeoverCovers(covers) {
  const now = covers === true;
  if (now === takeoverCovers) return; // asked on every start and end, so only a change counts

  takeoverCovers = now;
  showKit();
}

// The parts that run by themselves, and the two events, may move now
function kitMoves() {
  return kitOn && frameState.motion === 'full' && !frameState.nightCovers && !takeoverCovers && !screenHeld() && !isPaused();
}

function kitMayFire() {
  return kitMoves() && !frameState.effectsPaused;
}

// Puts data-kit="on" on the html element while the kit may move, and takes it
// off the moment it may not, which stops every animation of the kit and ends any
// glitch or burst that is playing. It is written only when it changes, because
// writing it can make the browser restyle the page.
export function showKit() {
  if (kitMoves()) {
    if (page.dataset.kit !== 'on') page.dataset.kit = 'on';
    return;
  }

  if (page.dataset.kit !== undefined) delete page.dataset.kit;
  endKitEvents();
}

export function armKitGlitch() {
  if (!kitOn || kitGlitchTimer !== null) return;
  kitGlitchTimer = setTimeout(playKitGlitch, kitGlitchGap(Math.random) * 1000);
}

export function disarmKitGlitch() {
  clearTimeout(kitGlitchTimer);
  kitGlitchTimer = null;
  endKitEvents();
}

// The next glitch is set first, so that one that is skipped or fails never ends
// the series. It plays only when nothing else is playing: not the name effect,
// the logo or the glitch of the screen, and not while a page is changing or a transition runs.
function playKitGlitch() {
  kitGlitchTimer = null;
  armKitGlitch();

  try {
    const name = document.querySelector('[data-name-effect]');
    if (!name || !kitMayFire() || frameState.playing || areaIsChanging() || isBusy()) return;

    name.classList.add('glitching');
    kitGlitchEnd = setTimeout(endKitGlitch, kitGlitchSeconds * 1000 * pace());
  } catch (error) {
    console.error('The name glitch failed', error);
  }
}

function endKitGlitch() {
  if (kitGlitchEnd === null) return; // none is playing: nothing to look for in the page
  clearTimeout(kitGlitchEnd);
  kitGlitchEnd = null;

  const name = document.querySelector('[data-name-effect]');
  if (name) name.classList.remove('glitching');
}

// Called by arrive() for each page after the first in the large frame. It must
// never stop the page from arriving, whatever goes wrong here.
export function playKitBurst() {
  try {
    const pane = document.querySelector('.kit-pane');
    if (!pane || !kitMayFire() || pane.classList.contains('bursting')) return;

    pane.classList.add('bursting');
    kitBurstEnd = setTimeout(endKitBurst, kitBurstSeconds * 1000 * pace());
  } catch (error) {
    console.error('The page change burst failed', error);
  }
}

function endKitBurst() {
  if (kitBurstEnd === null) return;
  clearTimeout(kitBurstEnd);
  kitBurstEnd = null;

  const pane = document.querySelector('.kit-pane');
  if (pane) pane.classList.remove('bursting');
}

export function endKitEvents() {
  endKitGlitch();
  endKitBurst();
}
