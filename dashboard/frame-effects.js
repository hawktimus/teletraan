// The effects that play now and then, the holds on the screen and their timing (part of frame.js).

import { defaultScreen, defaultSettings, defaultTeam } from './config.js';
import { frameState } from './frame-state.js';
import { logoCanMove, playCrtNow, playEntranceNow, playHawkNow, playNameEffectNow, playSpinNow, stopCrt, stopLogoEffects } from './frame-logo.js';
import { endKitEvents, showKit } from './frame-kit.js';
import { page, weightNow } from './frame-pages.js';

// Effects that play now and then
//
// Four effects play on a timer. Dashboard Settings has the same three
// settings for each: a switch, the seconds between plays (0 is never) and the
// seconds one play lasts. shell.js passes them to setNameEffect, setSpin,
// setHawk and setCrt every time the content changes. The seconds between plays
// of the name effect and the hawk are the minutes of the Screen that is on the
// screen instead (core/screens.js, cadenceOf).
//
//   name    the team name effect: the letters split and turn (Look tab)
//   spin    the logo makes one full turn, drawn flat (Look tab)
//   hawk    the logo folds into a robot, changes into the hawk, flies and
//           changes back (Look tab)
//   glitch  the old television glitch over the whole screen (Screen tab)
//
// A fifth, the entrance, plays once when the logo starts: the four plates fly
// in. It has a switch and no timing. The logo settings also have a master switch
// (setLogoAnimations). Off, it stops the name effect, the spin, the hawk, the
// entrance and the flying logo of the announcements, and leaves the still
// emblem.
//
// This is the one place that decides when an effect may start:
//   - Only one plays at a time, so the logo never moves while the name effect
//     plays, and the spin and the hawk never overlap.
//   - None starts while an area is changing page (leaving or arriving). The
//     entrance is the one exception, because it plays as the screen starts,
//     beside the banner arriving.
//   - Calm and none motion play none of them.
// An effect that comes due when it may not start waits in line and starts as
// soon as it may. The line is looked at every 250 ms. Each effect counts its
// seconds from when it last started, so a long wait means one late play and
// never a burst of catch-up plays. Until its first play, a logo effect counts
// from the moment the logo starts, and plays firstAfter seconds in (or
// sooner, if its seconds between plays are fewer). Those are the seconds the
// old fixed 24 second show first played each of them at.
//
// The seconds between plays are real seconds. The seconds one play lasts are
// at normal speed, and the Speed setting stretches them like every other time.
//
// A transition holds the effects that come due on their own (core/busy.js): they do not start
// while one runs, and the name effect and the glitch end if one is playing when it starts. A play
// asked for by hand is not held.
//
// playNameEffect and playCrt ask for a play now, for the ?demo=crt address,
// the announcements and the browser console. They wait in the same line, and
// they play whatever the switches and the seconds between plays say. A play
// asked for by hand does not wait for the spin, the hawk or the entrance: it
// ends them on the spot. The announcement asks for the glitch between its two
// lines, and the banner is hidden under it, so the logo has nothing to finish.

export const lookEveryMs = 250;

// How often the name effect and the hawk play until a Screen says (core/screens.js, cadenceOf): the Screen gives the
// minutes, and the effects count in seconds
export const nameEverySeconds = defaultScreen.nameEffectEveryMinutes * 60;
export const hawkEverySeconds = defaultScreen.hawkEveryMinutes * 60;

// How long the name effect lasts today, measured from the keyframes in
// frame.css: .8 s for a letter, and each letter after the first starts
// 45 ms later. On the default name that is the nameDuration in config.js.
// A different name takes a little more or less. The setting scales it all.
const nameLetterSeconds = 0.8;
const nameStaggerSeconds = 0.045;

export function nameSeconds(letters, scale) {
  return (nameLetterSeconds + Math.max(0, letters - 1) * nameStaggerSeconds) * scale;
}

export const defaultNameSeconds = nameSeconds(Array.from(defaultTeam.name).length, 1);

// The glitch lasts this long at normal speed. frame.css times its keyframes
// to 2.6 s of it, and --crt-scale in tokens.css stretches them all together.
export const crtNormalSeconds = 2.7;

// The logo's acts. An act is a name that frame.css has rules for (set as
// data-act on the logo) and how many seconds it lasts at normal speed. An act
// has to be at least as long as the animations in it, or the next act would
// cut them off. The times in frame.css are multiplied by --pace and so are
// the times here, so the two stay matched at every Speed setting. If the
// setting changes in the middle of an act, playLogoAct also waits for the
// animations to finish.
const entranceSeconds = 2; // boot: the plates fly in (the animations take about 1 s)
export const spinNormalSeconds = 1.6; // turn: one full turn

// The flying hawk is these four acts one after the other: 11 seconds, which is
// logoHawkDuration in config.js
export const hawkActs = [
  ['robot', 3],     // the wings fold into legs, the head lifts clear
  ['hawk-in', 2],   // the plates break away and the hawk turns in
  ['flight', 4],    // five wingbeats
  ['hawk-out', 2],  // the hawk turns back into the plates
];
export const hawkNormalSeconds = hawkActs.reduce((total, act) => total + act[1], 0);

// An effect, with what most of them have in common filled in:
//   logo             the master switch of the logo settings stops it
//   on               the switch
//   everySeconds     0 is never
//   seconds          how long one play lasts, at normal speed
//   firstAfter       seconds from the logo starting to its first play
//   lastStarted      when it last began, null if it has not yet
//   countFrom        where the count to the first play starts
//   duringPageChange it may start while an area is changing page
//   cuttable         a play asked for by hand ends it and takes over
//   mayStart         whether it can play now
//   play             plays it, and says when it is over
function newEffect(fields) {
  return Object.assign({
    logo: true,
    on: true,
    everySeconds: 0,
    firstAfter: 0,
    lastStarted: null,
    countFrom: performance.now(),
    duringPageChange: false,
    cuttable: false,
  }, fields);
}

export const effects = {
  name: newEffect({
    everySeconds: nameEverySeconds,
    seconds: defaultNameSeconds,
    firstAfter: entranceSeconds, // the old show's first rest
    mayStart: () => !!document.querySelector('[data-name-effect]'),
    play: playNameEffectNow,
  }),
  spin: newEffect({
    everySeconds: defaultSettings.logoSpinEvery,
    seconds: defaultSettings.logoSpinDuration,
    firstAfter: 50, // the third pass of the old show, 2 seconds in
    cuttable: true,
    mayStart: logoCanMove,
    play: playSpinNow,
  }),
  hawk: newEffect({
    everySeconds: hawkEverySeconds,
    seconds: defaultSettings.logoHawkDuration,
    firstAfter: 13, // where the old show first started the robot act
    cuttable: true,
    mayStart: logoCanMove,
    play: playHawkNow,
  }),
  entrance: newEffect({
    seconds: entranceSeconds,
    duringPageChange: true,
    cuttable: true,
    mayStart: logoCanMove,
    play: playEntranceNow,
  }),
  glitch: newEffect({
    logo: false,
    everySeconds: defaultSettings.crt.everySeconds,
    seconds: crtNormalSeconds,
    lastStarted: performance.now(), // the first glitch comes after its seconds, counted from the page loading
    mayStart: () => !!document.getElementById('crt') && !!document.getElementById('world'),
    play: playCrtNow,
  }),
};


let hiddenPlaying = false; // a hidden transition has the whole screen: no effect starts, and none waits
let swapPlaying = false; // a swap (core/swap-run.js) has it, and holds it the same way

// Called by the night screen (core/night-screen.js) when it covers the picture
// and when it lets go. While it covers, no effect starts and none waits, and
// one that is playing ends by itself. When it lets go, whatever is due plays,
// one at a time, as after any long wait.
export function setNightCovers(covers) {
  const now = covers === true;
  if (now === frameState.nightCovers) return; // asked every second, so only a change counts

  frameState.nightCovers = now;
  if (now) stopLogoEffects();
  showKit();
}

// Called by the demo runner (core/demo.js) for as long as a demo plays. The
// effects that come due on their own do not start and the ones waiting are
// dropped, and one that is playing in the logo ends. A play asked for by hand
// still goes ahead: the announcement a demo plays asks for the glitch between its lines.
export function setEffectsPaused(paused) {
  frameState.effectsPaused = paused === true;
  if (frameState.effectsPaused) stopLogoEffects();
  if (frameState.effectsPaused) endKitEvents();
}

// Called by the hidden transitions (core/hidden-run.js) for as long as one has
// the screen. No effect starts and none waits, and whatever is playing ends on
// the spot: the logo goes back to its still emblem and the glitch stops. The
// effects that are due play one at a time once the screen is back together.
export function setHiddenPlaying(on) {
  hiddenPlaying = on === true;
  showKit();
  if (hiddenPlaying) endEffectsPlaying();
}

// Called by the swap (core/swap-run.js) for as long as it plays. It holds the screen as a hidden
// transition does: whatever is playing ends on the spot, nothing starts, and the neon kit is still.
export function setSwapPlaying(on) {
  swapPlaying = on === true;
  showKit();
  if (swapPlaying) endEffectsPlaying();
}

// True while a hidden transition or a swap has the whole screen
export function screenHeld() {
  return hiddenPlaying || swapPlaying;
}

function endEffectsPlaying() {
  stopLogoEffects();
  if (frameState.playing && frameState.playing.name === 'glitch') {
    stopCrt();
    frameState.playing = null;
  }
}

// One hold on the whole screen, for a talk in presentation mode. pause(reason)
// takes it and resume(reason) lets it go. Each reason is held once, and the hold
// lasts until every reason has been let go. While it lasts:
//   - no effect starts and none waits, and whatever plays ends on the spot, as for a
//     hidden transition
//   - the neon kit is still, and the glint and the seasonal pieces stop (html data-paused)
//   - core/schedule.js stops the page changes of all three areas
//   - takeoverRunning() in core/takeover.js is true, so the hidden transitions, the night
//     screen, the demo, Play announcements and the page reloads wait, and an announcement
//     that comes due is kept and plays when the hold is gone
// An alert still takes the screen: it overrides everything.
// When the hold is gone everything starts again by itself. What came due meanwhile plays
// then, one effect at a time, as after any long wait.
const holds = new Set();

export function pause(reason) {
  if (holds.has(reason)) return;

  holds.add(reason);
  if (holds.size > 1) return;
  page.dataset.paused = 'on';
  showKit();
  endEffectsPlaying();
}

export function resume(reason) {
  if (!holds.delete(reason) || holds.size > 0) return;

  delete page.dataset.paused;
  showKit();
}

// True while any reason holds the screen
export function isPaused() {
  return holds.size > 0;
}

// 'full', 'calm' or 'none', the motion setting as it is now
export function motionNow() {
  return frameState.motion;
}

// 'full' or 'light': how heavy the transitions are in full motion. Calm and none have no transitions to weigh.
export { weightNow };
