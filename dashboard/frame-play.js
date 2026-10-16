// Playing the effects: the timing settings, the name effect and the glitch (part of frame.js).

import { defaultSettings } from './config.js';
import { isBusy } from './core/busy.js';
import { frameState } from './frame-state.js';
import { crtNormalSeconds, defaultNameSeconds, effects, hawkEverySeconds, isPaused, lookEveryMs, nameEverySeconds, nameSeconds, screenHeld } from './frame-effects.js';
import { pace, page, wait, whenDone } from './frame-pages.js';
import { stopLogoEffects, stopNameEffect } from './frame-acts.js';

// Both set the switch, the seconds between plays and the seconds one play
// lasts. A missing or silly value becomes the fallback.
function setTiming(effect, on, everySeconds, seconds, fallback) {
  effect.on = on !== false;
  effect.everySeconds = everySeconds >= 0 ? everySeconds : fallback.everySeconds;
  effect.seconds = seconds > 0 ? seconds : fallback.seconds;
}

export function setNameEffect(on, everySeconds, seconds) {
  setTiming(effects.name, on, everySeconds, seconds, { everySeconds: nameEverySeconds, seconds: defaultNameSeconds });
}

export function setCrt(on, everySeconds, seconds) {
  setTiming(effects.glitch, on, everySeconds, seconds, { everySeconds: defaultSettings.crt.everySeconds, seconds: crtNormalSeconds });
}

export function setSpin(on, everySeconds, seconds) {
  setTiming(effects.spin, on, everySeconds, seconds, { everySeconds: defaultSettings.logoSpinEvery, seconds: defaultSettings.logoSpinDuration });
}

export function setHawk(on, everySeconds, seconds) {
  setTiming(effects.hawk, on, everySeconds, seconds, { everySeconds: hawkEverySeconds, seconds: defaultSettings.logoHawkDuration });
}

// The master switch, and the switch of the entrance. Turning the master off
// ends whatever the logo is doing at once.
export function setLogoAnimations(on, entrance) {
  frameState.logoAnimationsOn = on !== false;
  frameState.entranceOn = entrance !== false;
  if (!frameState.logoAnimationsOn) stopLogoEffects();
}

// Play an effect as soon as the rules above allow. To try one from the
// browser console on the dashboard page:
//   import('./frame.js').then(frame => frame.playNameEffect())
export function playNameEffect() {
  askToPlay('name', true);
}

export function playCrt() {
  askToPlay('glitch', true);
}

// An effect wants to start. A play asked for by hand plays even when its
// switch is off. A play that is going or waiting already is not asked for twice.
export function askToPlay(name, byHand) {
  if ((frameState.playing && frameState.playing.name === name) || frameState.waiting.some(entry => entry.name === name)) return;

  frameState.waiting.push({ name: name, byHand: byHand });
  startNextEffect();
}

function lookAtEffects() {
  if (frameState.motion !== 'full' || frameState.nightCovers || screenHeld()) return;
  if (isPaused()) return;
  if (isBusy()) endEffectsHeldByTransition();

  Object.keys(effects).forEach(name => {
    if (isDue(effects[name])) askToPlay(name, false);
  });
  startNextEffect();
}

// An effect plays on its own only when its own switch is on, and, for the
// logo's, the master switch too, and no demo has paused the effects
function isSwitchedOn(effect) {
  return !frameState.effectsPaused && effect.on && (!effect.logo || frameState.logoAnimationsOn);
}

function isDue(effect) {
  if (!isSwitchedOn(effect) || effect.everySeconds <= 0) return false;

  const now = performance.now();
  if (effect.lastStarted === null) {
    return now - effect.countFrom >= Math.min(effect.firstAfter, effect.everySeconds) * 1000;
  }
  return now - effect.lastStarted >= effect.everySeconds * 1000;
}

// Whether a waiting effect still wants to play. One that came due stops
// wanting to when its switch is turned off, and every one stops when the
// motion is no longer full, the night screen covers the picture, a hidden
// transition has the screen or the screen is paused.
function isWanted(entry) {
  const effect = effects[entry.name];
  return frameState.motion === 'full' && !frameState.nightCovers && !screenHeld() && !isPaused() && (entry.byHand || (isSwitchedOn(effect) && effect.everySeconds > 0));
}

// A transition runs: the name effect or the glitch that is playing, and that came due on its own,
// ends on the spot. The logo's acts are not touched, and neither is a play asked for by hand.
function endEffectsHeldByTransition() {
  if (!frameState.playing || frameState.playing.byHand) return;

  if (frameState.playing.name === 'name') stopNameEffect();
  else if (frameState.playing.name === 'glitch') stopCrt();
  else return;
  frameState.playing = null;
}

// Starts the first effect in line that may start, if nothing is playing and
// no area is changing page. A transition holds the ones that came due on their
// own. Called by askToPlay and every 250 ms.
function startNextEffect() {
  frameState.waiting = frameState.waiting.filter(isWanted);

  if (frameState.playing && effects[frameState.playing.name].cuttable && frameState.waiting.some(entry => entry.byHand)) {
    stopLogoEffects();
  }
  if (frameState.playing) return;

  const changing = areaIsChanging();
  const busy = isBusy();
  const index = frameState.waiting.findIndex(entry => {
    const effect = effects[entry.name];
    return effect.mayStart() && (effect.duringPageChange || (!changing && (entry.byHand || !busy)));
  });
  if (index === -1) return;

  const entry = frameState.waiting.splice(index, 1)[0];
  runEffect(entry.name, entry.byHand);
}

async function runEffect(name, byHand) {
  const effect = effects[name];
  const run = { name: name, byHand: byHand === true };
  frameState.playing = run;
  effect.lastStarted = performance.now();

  try {
    await effect.play(effect.seconds, run);
  } catch (error) {
    console.error('The ' + name + ' effect failed', error);
  }

  // An effect that was ended early (stopLogoEffects) is not playing any more,
  // and something else may have started since
  if (frameState.playing === run) frameState.playing = null;
}

// An area is changing page from the moment its old page starts to leave until
// the new page has arrived (any state but shown, see Persistent areas above)
export function areaIsChanging() {
  return Array.from(document.querySelectorAll('.area')).some(area => area.dataset.state !== 'shown');
}

let looking = false;

// Called by start(), so importing this file starts no timer
export function startLookingAtEffects() {
  if (looking) return;
  looking = true;
  setInterval(lookAtEffects, lookEveryMs);
}

// A number to multiply a time by: how many times as long as normal
export function scaleOf(seconds, normalSeconds) {
  return Math.round(seconds / normalSeconds * 1000) / 1000;
}


// The name effect: frame.css moves the letters while the name has the class
// splitting. --name-scale stretches all of its times, so the whole effect
// lasts the seconds in the setting on a name as long as the default.
export async function playNameEffectNow(seconds) {
  const name = document.querySelector('[data-name-effect]');
  const scale = scaleOf(seconds, defaultNameSeconds);
  const lastLetter = nameSeconds(name.querySelectorAll('.letter').length, scale) * 1000 * pace();

  name.style.setProperty('--name-scale', String(scale));
  name.classList.add('splitting');
  await whenDone(name, lastLetter + 1000); // a second more than it needs, in case it is held up
  name.classList.remove('splitting');
}

// The glitch: frame.js adds playing to #crt and crt-on to #world, and
// frame.css does the rest. It ends by the clock, a little after the last
// keyframe. run is the play the scheduler started it as: a glitch that was
// ended early (setHiddenPlaying) must not stop the next one when its clock runs out.
export async function playCrtNow(seconds, run) {
  const crt = document.getElementById('crt');
  const world = document.getElementById('world');

  page.style.setProperty('--crt-scale', String(scaleOf(seconds, crtNormalSeconds)));
  crt.classList.add('playing');
  world.classList.add('crt-on');
  await wait(seconds * 1000 * pace());
  if (!run || frameState.playing === run) stopCrt();
}

// The glitch now, for this many seconds at normal speed, and says when it is over.
// For the red glitches of a hidden transition, which has the effects held
// (setHiddenPlaying), so it is the only thing playing.
export function playGlitch(seconds) {
  return playCrtNow(seconds, null);
}

// Ends the glitch now, for a hidden transition that was stopped in the middle of it
export function stopGlitch() {
  stopCrt();
}

// Also used when the motion setting changes to calm or none in the middle of it
export function stopCrt() {
  const crt = document.getElementById('crt');
  const world = document.getElementById('world');
  if (crt) crt.classList.remove('playing');
  if (world) world.classList.remove('crt-on');
}
