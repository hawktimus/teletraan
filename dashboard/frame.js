// How things move.
//
// Two kinds of thing move here.
//
//   Pages. The large panel, the small panel and the ticker each keep one
//   frame for good and swap only the page inside it. A page labels the
//   pieces that flip with data-slat, and this file numbers them
//   (numberSlats) and runs the page change (arrive, leave, retire). The
//   states and the motion are in frame.css, under "Persistent frames".
//
//   Whole panels. The banner, the countdown, the alert and the announcement
//   draw their own frame. They label their parts with data-part and call
//   enter() and exit(). The table below says what each part does and when,
//   and frame.css plays it.
//
// A third thing, the neon kit of the sidebar layout (Neon Prime), has its timing
// in frame-kit.js, and its shapes and keyframes in neon-kit.css.
//
// The file is split by its parts: frame-sequences.js (the table below), frame-pages.js (pages and whole
// panels), frame-effects.js and frame-logo.js (the effects that play now and then, and the logo), frame-kit.js,
// and frame-state.js (the settings they share). This file re-exports all of their public names.
//
// The motion setting (full, calm or none) is handled here so no panel has
// to think about it. The speed setting is handled here too: every time below
// is a normal-speed time, and pace() says how much to stretch it.

export { sequences } from './frame-sequences.js';
export {
  start, tickOnce, setMotion, setSpeed, pace, wait, onSecond, enter, exit, numberSlats, setPageChange, planChange,
  firstFinish, turnMs, arrive, leave, retire, scrollCard, moveArea, fadeNotice,
} from './frame-pages.js';
export {
  spinNormalSeconds, hawkActs, setNightCovers, setEffectsPaused, setHiddenPlaying, setSwapPlaying, pause, resume,
  isPaused, motionNow, weightNow,
} from './frame-effects.js';
export {
  setNameEffect, setCrt, setSpin, setHawk, setLogoAnimations, playNameEffect, playCrt, playGlitch, stopGlitch,
  slam, nudge, playLogoAct, startLogo, stopLogo, flyLogo,
} from './frame-logo.js';
export { kitGlitchGapSeconds, kitGlitchGap, setKit, setTakeoverCovers } from './frame-kit.js';
