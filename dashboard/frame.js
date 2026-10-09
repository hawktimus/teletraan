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
// in the last section of this file, and its shapes and keyframes in neon-kit.css.
//
// The motion setting (full, calm or none) is handled here so no panel has
// to think about it. The speed setting is handled here too: every time below
// is a normal-speed time, and pace() says how much to stretch it.

import { defaultSettings, defaultTeam, speeds } from './config.js';
import { chooseFinish, chooseStyle } from './core/transitions.js';
import { makeSecondTimer } from './core/tick.js';

const page = document.documentElement;
const motionModes = ['full', 'calm', 'none'];
let motion = 'full';
let speed = 'normal';


// How each kind of whole panel is put together. One line per part:
//   part name: [effect, start time in ms, gap in ms between repeated parts]
// Screws, countdown segments and letters use the gap so they appear one after
// another. A part with no line here just appears and stays. The effects are
// the data-fx rules at the top of frame.css.
export const sequences = {
  banner: {
    'title':        ['latch-left', 500],
    'team-plate':   ['latch-left', 700],
    'clock':        ['latch-right', 700],
    'wordmark':     ['fade', 1000],
    'subtitle':     ['fade', 1000],
    'rule':         ['grow', 1100],
    'line':         ['fade', 1100],
    'school':       ['fade', 1300],
    'sample-badge': ['fade', 1500],
  },

  countdown: {
    'body':          ['unfold', 200],
    'outline':       ['draw', 700],
    'lamp':          ['pop', 950],
    'label':         ['fade', 1000],
    'chevron-left':  ['latch-left', 900],
    'chevron-right': ['latch-right', 900],
    'days':          ['slam', 1100],
    'days-word':     ['fade', 1250],
    'time':          ['fade', 1300],
    'stripes':       ['grow', 1350],
    'segment':       ['pop', 1450, 35],
    'stud':          ['servo', 1300, 50],
    'rivets':        ['fade', 1350],
    'plate-id':      ['fade', 1400],
    'scan':          ['scan', 1200],
  },

  // The sidebar layout's one panel, in place of the banner and the countdown
  // (panels/side). The countdown's parts keep the names and the order they
  // have above, a little later, and the logo's own show runs beside them. The
  // team name, the clock and the weather are not here: they are in the strip,
  // outside the panel.
  side: {
    'body':          ['unfold', 800],
    'lamp':          ['pop', 1150],
    'label':         ['fade', 1200],
    'chevron-left':  ['latch-left', 1100],
    'chevron-right': ['latch-right', 1100],
    'days':          ['slam', 1300],
    'days-word':     ['fade', 1450],
    'time':          ['fade', 1500],
    'stripes':       ['grow', 1550],
    'segment':       ['pop', 1650, 35],
    'team-plate':    ['latch-left', 1400],
    'school':        ['fade', 1700],
    'sample-badge':  ['fade', 1900],
  },

  // The bar layout's two panels that stay on screen: the banner (panels/bar-banner) and
  // the side column (panels/bar-column). The banner draws its own frame, as the countdown
  // does: the plate unfolds, the lines are drawn, the decoration and the hex bolts come
  // after, and in Minimal so do the rivets, the rust and the id. The war clock is in the
  // war slot and arrives with it, so it has no parts of its own
  'bar-banner': {
    'body':         ['unfold', 200],
    'outline':      ['draw', 700],
    'title':        ['latch-left', 500],
    'war':          ['fade', 900],
    'decor':        ['fade', 1350],
    'rivets':       ['fade', 1350],
    'wear':         ['fade', 1350],
    'plate-id':     ['fade', 1400],
    'stud':         ['servo', 1300, 50],
  },
  'bar-column': {
    'clock':        ['latch-right', 700],
    'line':         ['fade', 900],
    'team-plate':   ['latch-left', 800],
    'school':       ['fade', 1100],
    'sample-badge': ['fade', 1300],
  },

  // Full screen: an alert from the editors
  alert: {
    'stripe':   ['grow', 0],
    'frame':    ['draw', 150],
    'headline': ['slam', 400],
    'message':  ['fade', 900],
    'stud':     ['servo', 500, 50],
    'scan':     ['scan', 600],
  },

  // Full screen: the 2:30 and 5:00 announcements
  announce: {
    'stripe':  ['grow', 0],
    'frame':   ['draw', 100],
    'logo':    ['fade', 200],
    'letter':  ['slam', 450, 55],
    'caption': ['fade', 1500],
    'stud':    ['servo', 500, 50],
    'scan':    ['scan', 900],
  },

  // Full screen: the cards of a booked talk, for the title, for slides that are not
  // ready and for the thanks (panels/talk). The slides themselves are not here, since
  // they change at once.
  talk: {
    'ground':   ['fade', 0],
    'label':    ['fade', 200],
    'headline': ['latch-left', 200],
    'detail':   ['latch-right', 350],
    'prompt':   ['fade', 1000],
  },
};


export function start(options) {
  setMotion(options.motion);
  setSpeed(options.speed || 'normal');
  page.dataset.draw = options.draw === 'fade' ? 'fade' : 'stroke';
  secondClock.start();
  startLookingAtEffects();
}

// 'full', 'calm' or 'none'. Anything else is ignored, because a wall
// display should carry on rather than stop.
export function setMotion(mode) {
  if (!motionModes.includes(mode)) {
    console.warn('motion must be full, calm or none, not "' + mode + '". Using full.');
    mode = 'full';
  }
  motion = mode;
  // Written only when it changes: shell.js calls this at every content change,
  // and writing the same value again can make the browser restyle the page,
  // which is not wanted in the middle of a page change
  if (page.dataset.motion !== mode) page.dataset.motion = mode;
  if (mode !== 'full') {
    stopCrt();
    restLogos();
  }
  showKit();
  if (mode === 'full') armKitGlitch();
  else disarmKitGlitch();
}

// 'very-slow', 'slow', 'normal' or 'fast'. Anything else is ignored, like
// setMotion. The number goes into --pace, which tokens.css multiplies into
// every time it defines, and which the code that waits reads with pace().
export function setSpeed(name) {
  if (!Object.keys(speeds).includes(name)) {
    console.warn('speed must be very-slow, slow, normal or fast, not "' + name + '". Using normal.');
    name = 'normal';
  }
  speed = name;
  if (page.dataset.speed === name) return; // see setMotion
  page.dataset.speed = name;
  page.style.setProperty('--pace', String(speeds[name]));
}

// How much longer than normal things take now: 2, 1.5, 1 or 0.75
export function pace() {
  return speeds[speed];
}

export function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}


// One timer for the whole screen, in core/tick.js. Panels ask to be told when
// each second starts. Pass the panel's element as well, so the listener is
// dropped automatically once that panel has left the page. A listener should
// touch the page only when what it shows has changed, and should not read
// the size or position of anything: it runs every second, even in the middle
// of a page change.
const secondClock = makeSecondTimer();

export function onSecond(listener, element) {
  secondClock.onSecond(listener, element);
}


export function enter(panel) {
  const sequence = sequences[panel.dataset.sequence];
  if (!sequence) {
    throw new Error('No sequence called "' + panel.dataset.sequence + '" in frame.js');
  }

  panel.querySelectorAll('[data-part]').forEach(part => {
    const rule = sequence[part.dataset.part];
    if (!rule) return;

    const effect = rule[0];
    const startMs = rule[1];
    const gapMs = rule[2] || 0;
    const index = Number(part.dataset.index || 0); // dataset values are always text

    part.dataset.fx = effect;
    part.style.setProperty('--delay', Math.round((startMs + index * gapMs) * pace()) + 'ms');
  });

  panel.dataset.state = 'in';
  return whenDone(panel).then(() => {
    // "shown" has no animation rules, so changing the motion setting
    // later cannot replay a panel that is already on screen
    if (panel.dataset.state === 'in') panel.dataset.state = 'shown';
  });
}

export function exit(panel) {
  panel.dataset.state = 'out';
  return whenDone(panel);
}

// limitMs is for an effect that can take longer than the usual five seconds
function whenDone(panel, limitMs) {
  // very old browsers cannot report animations, so wait a fixed time instead
  if (!panel.getAnimations) return wait(limitMs || 2500 * pace());

  // animations that never end (the pulsing lamp) are not waited for
  const running = panel.getAnimations({ subtree: true })
    .filter(animation => animation.effect.getComputedTiming().endTime !== Infinity);

  // finished rejects when an animation is cancelled, which is fine here
  const done = Promise.all(running.map(animation => animation.finished.catch(() => {})));

  // never wait forever, for example if the window is hidden. The limit grows
  // with the pace, or a slow setting would be cut off while it still moves.
  return Promise.race([done, wait(limitMs || 5000 * pace())]);
}


// Persistent areas and the page change
//
// The large panel (grid1), the small panel (grid2) and the ticker are areas.
// An area is made once, with its frame, and only the page inside it changes.
// The area carries the state, in data-state, and frame.css moves everything
// from that:
//
//   in     the first page. The frame assembles, then the page turns in.
//   xo     the old page leaving: the screws unscrew, then either the frame
//          halves lift and the slats turn edge-on (the slat change) or the
//          frame breaks into pieces that fold away (the mechanical change).
//   xi     the new page arriving: the pieces rebuild or the halves drop, the
//          slats turn in, the screws turn back in.
//   shown  at rest. Nothing moves except the glint.
//   out    the whole area fades away (see retire).
//
// Which of the two changes an area uses, and the metal its frame has after
// the change, are chosen at the start of every change (planChange). The area
// keeps the answers in data-change and data-metal, and frame.css reads them.

// A slat is a piece of page content that turns over when the page changes: a
// heading, a row, a card. A panel marks each one with data-slat="name", and
// the table below says in what order the slats turn and which way. A panel
// never has animation code of its own.
//
// order is the slat's place in the change, 0 first. other is true for a slat
// that turns the other way, so neighbours turn opposite ways.
const slatKinds = {
  title:   { order: 0, other: false }, // the big heading of a large panel
  tag:     { order: 0, other: true },  // the tag at the right end of that heading
  label:   { order: 0, other: false }, // the label of a small panel, or the tag of the ticker
  content: { order: 2, other: true },  // the main part of a small panel, or the ticker message
};

// The rows or cards of a large panel (data-slat="item") count 1, 2, 3 ... in
// the order they appear, and every second one turns the other way. After the
// sixth they all go together, so a long page still ends inside its second.
const lastItemOrder = 6;

// Gives each slat of a new page its order (--n) and its direction. Call it
// once, before the page goes on screen.
export function numberSlats(page) {
  let items = 0;

  page.querySelectorAll('[data-slat]').forEach(slat => {
    const name = slat.dataset.slat;
    let order;
    let other;

    if (name === 'item') {
      order = Math.min(items + 1, lastItemOrder);
      other = items % 2 === 1;
      items++;
    } else if (slatKinds[name]) {
      order = slatKinds[name].order;
      other = slatKinds[name].other;
    } else {
      console.warn('There is no slat called "' + name + '" in frame.js. It will not turn.');
      return;
    }

    slat.style.setProperty('--n', String(order));
    if (other) slat.dataset.turn = 'other';
  });
}

// The page change settings (the Look tab of Dashboard Settings), set by
// shell.js through setPageChange().
let breakSecondsNow = defaultSettings.breakSeconds;
let changeSettings = {
  style: defaultSettings.pageChangeStyle,
  finish: defaultSettings.frameFinish,
  silverChance: defaultSettings.silverChance,
};

// style is 'alternate', 'slat' or 'mechanical', finish is 'mostly-gold',
// 'alternate', 'gold' or 'silver', silverChance is a percent and breakSeconds
// is how long the frame takes to break apart (and the same again to rebuild)
// at normal speed. A value that does not fit is dealt with by
// chooseStyle and chooseFinish, and by fixSettingValues in core/content.js.
export function setPageChange(style, finish, silverChance, breakSeconds) {
  changeSettings = { style: style, finish: finish, silverChance: silverChance };
  if (breakSeconds > 0) {
    breakSecondsNow = breakSeconds;
    page.style.setProperty('--break-seconds', String(breakSeconds));
  }
}

// How long the old page takes to leave in each style, in milliseconds. The
// mechanical change breaks the frame apart in the break time (and the new page
// arrives in the same again), and frame.css reads --break-seconds for the
// motion itself. Only full motion has the mechanical change: calm is a fade and
// takes the slat change's time, and with motion off nothing waits.
function leaveMs(style) {
  if (style === 'mechanical' && motion === 'full') return breakSecondsNow * 1000 * pace();
  return turnMs();
}

// Decides the next change of this area, and says what it is: { style, finish }.
// The area's data-change and data-metal hold what it used last, which is how
// 'alternate' knows whose turn it is. The ticker has no frame, so it always
// uses the slat change and has no finish.
export function planChange(area) {
  if (area.dataset.area === 'ticker') return { style: 'slat', finish: null };

  return {
    style: chooseStyle(changeSettings.style, area.dataset.change || null),
    finish: chooseFinish(changeSettings.finish, changeSettings.silverChance, area.dataset.metal || null, Math.random),
  };
}

// The metal for a frame that is new, so its first assembly has one
export function firstFinish() {
  return chooseFinish(changeSettings.finish, changeSettings.silverChance, null, Math.random);
}

// How long the old page takes to leave and the new one to arrive, in
// milliseconds. frame.css fits every move of the change inside one second
// each, times the Speed setting. In calm the fade is shorter but takes the
// same turn, and in "none" nothing waits.
export function turnMs() {
  return motion === 'none' ? 0 : 1000 * pace();
}

// Puts the area in the state "in" (the first page of the area, so the frame
// assembles) or "xi" (a page that follows another), and says when it has
// arrived. The area then rests in "shown".
export function arrive(area, first) {
  const state = first ? 'in' : 'xi';
  area.dataset.state = state;
  if (!first && area.dataset.area === 'grid1') playKitBurst();

  return whenDone(area).then(() => {
    // "shown" has no animation rules, so changing the motion setting
    // later cannot replay a page that is already on screen
    if (area.dataset.state === state) area.dataset.state = 'shown';
  });
}

// The old page's last second. When it is over the caller swaps in the next
// page and calls arrive(area, false), which carries straight on from here.
// change is what planChange() answered for this area.
export function leave(area, change) {
  area.dataset.change = change.style;
  // The recolour attribute is for the stylesheet: a frame that changes metal
  // is out of sight while the metal changes (see frame.css)
  area.dataset.recolor = change.finish && change.finish !== area.dataset.metal ? 'yes' : 'no';
  area.dataset.state = 'xo';
  return wait(leaveMs(change.style));
}

// Takes the whole area away, frame and page, with a short fade. Used when
// the next page is not one that fits a frame, and when there is nothing to show.
export function retire(area) {
  area.dataset.state = 'out';
  return whenDone(area);
}


// Effects that play now and then
//
// Four effects play on a timer. Dashboard Settings has the same three
// settings for each: a switch, the seconds between plays (0 is never) and the
// seconds one play lasts. shell.js passes them to setNameEffect, setSpin,
// setHawk and setCrt every time the content changes.
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
// playNameEffect and playCrt ask for a play now, for the ?demo=crt address,
// the announcements and the browser console. They wait in the same line, and
// they play whatever the switches and the seconds between plays say. A play
// asked for by hand does not wait for the spin, the hawk or the entrance: it
// ends them on the spot. The announcement asks for the glitch between its two
// lines, and the banner is hidden under it, so the logo has nothing to finish.

const lookEveryMs = 250;

// How long the name effect lasts today, measured from the keyframes in
// frame.css: .8 s for a letter, and each letter after the first starts
// 45 ms later. On the default name that is the nameDuration in config.js.
// A different name takes a little more or less. The setting scales it all.
const nameLetterSeconds = 0.8;
const nameStaggerSeconds = 0.045;

function nameSeconds(letters, scale) {
  return (nameLetterSeconds + Math.max(0, letters - 1) * nameStaggerSeconds) * scale;
}

const defaultNameSeconds = nameSeconds(Array.from(defaultTeam.name).length, 1);

// The glitch lasts this long at normal speed. frame.css times its keyframes
// to 2.6 s of it, and --crt-scale in tokens.css stretches them all together.
const crtNormalSeconds = 2.7;

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
const hawkNormalSeconds = hawkActs.reduce((total, act) => total + act[1], 0);

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

const effects = {
  name: newEffect({
    everySeconds: defaultSettings.nameEvery,
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
    everySeconds: defaultSettings.logoHawkEvery,
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

let logoAnimationsOn = defaultSettings.logoAnimations; // the master switch
let entranceOn = defaultSettings.logoEntrance;
let showLogo = null; // the logo the effects above move: the one in the banner

let playing = null; // the run of the effect that is playing now, { name }, or null
let waiting = []; // effects that want to start, first come first served: { name, byHand }
let nightCovers = false; // the night screen covers the picture, so nothing behind it is worth playing
let effectsPaused = false; // a demo is playing: the effects that come due on their own wait
let hiddenPlaying = false; // a hidden transition has the whole screen: no effect starts, and none waits

// Called by the night screen (core/night-screen.js) when it covers the picture
// and when it lets go. While it covers, no effect starts and none waits, and
// one that is playing ends by itself. When it lets go, whatever is due plays,
// one at a time, as after any long wait.
export function setNightCovers(covers) {
  const now = covers === true;
  if (now === nightCovers) return; // asked every second, so only a change counts

  nightCovers = now;
  if (now) stopLogoEffects();
  showKit();
}

// Called by the demo runner (core/demo.js) for as long as a demo plays. The
// effects that come due on their own do not start and the ones waiting are
// dropped, and one that is playing in the logo ends. A play asked for by hand
// still goes ahead: the announcement a demo plays asks for the glitch between its lines.
export function setEffectsPaused(paused) {
  effectsPaused = paused === true;
  if (effectsPaused) stopLogoEffects();
  if (effectsPaused) endKitEvents();
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

function endEffectsPlaying() {
  stopLogoEffects();
  if (playing && playing.name === 'glitch') {
    stopCrt();
    playing = null;
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
  return motion;
}

// Both set the switch, the seconds between plays and the seconds one play
// lasts. A missing or silly value becomes the fallback.
function setTiming(effect, on, everySeconds, seconds, fallback) {
  effect.on = on !== false;
  effect.everySeconds = everySeconds >= 0 ? everySeconds : fallback.everySeconds;
  effect.seconds = seconds > 0 ? seconds : fallback.seconds;
}

export function setNameEffect(on, everySeconds, seconds) {
  setTiming(effects.name, on, everySeconds, seconds, { everySeconds: defaultSettings.nameEvery, seconds: defaultNameSeconds });
}

export function setCrt(on, everySeconds, seconds) {
  setTiming(effects.glitch, on, everySeconds, seconds, { everySeconds: defaultSettings.crt.everySeconds, seconds: crtNormalSeconds });
}

export function setSpin(on, everySeconds, seconds) {
  setTiming(effects.spin, on, everySeconds, seconds, { everySeconds: defaultSettings.logoSpinEvery, seconds: defaultSettings.logoSpinDuration });
}

export function setHawk(on, everySeconds, seconds) {
  setTiming(effects.hawk, on, everySeconds, seconds, { everySeconds: defaultSettings.logoHawkEvery, seconds: defaultSettings.logoHawkDuration });
}

// The master switch, and the switch of the entrance. Turning the master off
// ends whatever the logo is doing at once.
export function setLogoAnimations(on, entrance) {
  logoAnimationsOn = on !== false;
  entranceOn = entrance !== false;
  if (!logoAnimationsOn) stopLogoEffects();
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
function askToPlay(name, byHand) {
  if ((playing && playing.name === name) || waiting.some(entry => entry.name === name)) return;

  waiting.push({ name: name, byHand: byHand });
  startNextEffect();
}

function lookAtEffects() {
  if (motion !== 'full' || nightCovers || hiddenPlaying) return;
  if (isPaused()) return;

  Object.keys(effects).forEach(name => {
    if (isDue(effects[name])) askToPlay(name, false);
  });
  startNextEffect();
}

// An effect plays on its own only when its own switch is on, and, for the
// logo's, the master switch too, and no demo has paused the effects
function isSwitchedOn(effect) {
  return !effectsPaused && effect.on && (!effect.logo || logoAnimationsOn);
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
  return motion === 'full' && !nightCovers && !hiddenPlaying && !isPaused() && (entry.byHand || (isSwitchedOn(effect) && effect.everySeconds > 0));
}

// Starts the first effect in line that may start, if nothing is playing and
// no area is changing page. Called by askToPlay and every 250 ms.
function startNextEffect() {
  waiting = waiting.filter(isWanted);

  if (playing && effects[playing.name].cuttable && waiting.some(entry => entry.byHand)) {
    stopLogoEffects();
  }
  if (playing) return;

  const changing = areaIsChanging();
  const index = waiting.findIndex(entry => {
    const effect = effects[entry.name];
    return effect.mayStart() && (effect.duringPageChange || !changing);
  });
  if (index === -1) return;

  runEffect(waiting.splice(index, 1)[0].name);
}

async function runEffect(name) {
  const effect = effects[name];
  const run = { name: name };
  playing = run;
  effect.lastStarted = performance.now();

  try {
    await effect.play(effect.seconds, run);
  } catch (error) {
    console.error('The ' + name + ' effect failed', error);
  }

  // An effect that was ended early (stopLogoEffects) is not playing any more,
  // and something else may have started since
  if (playing === run) playing = null;
}

// An area is changing page from the moment its old page starts to leave until
// the new page has arrived (any state but shown, see Persistent areas above)
function areaIsChanging() {
  return Array.from(document.querySelectorAll('.area')).some(area => area.dataset.state !== 'shown');
}

let looking = false;

// Called by start(), so importing this file starts no timer
function startLookingAtEffects() {
  if (looking) return;
  looking = true;
  setInterval(lookAtEffects, lookEveryMs);
}

// A number to multiply a time by: how many times as long as normal
function scaleOf(seconds, normalSeconds) {
  return Math.round(seconds / normalSeconds * 1000) / 1000;
}


// The name effect: frame.css moves the letters while the name has the class
// splitting. --name-scale stretches all of its times, so the whole effect
// lasts the seconds in the setting on a name as long as the default.
async function playNameEffectNow(seconds) {
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
async function playCrtNow(seconds, run) {
  const crt = document.getElementById('crt');
  const world = document.getElementById('world');

  page.style.setProperty('--crt-scale', String(scaleOf(seconds, crtNormalSeconds)));
  crt.classList.add('playing');
  world.classList.add('crt-on');
  await wait(seconds * 1000 * pace());
  if (!run || playing === run) stopCrt();
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
function stopCrt() {
  const crt = document.getElementById('crt');
  const world = document.getElementById('world');
  if (crt) crt.classList.remove('playing');
  if (world) world.classList.remove('crt-on');
}


// Small moves while a panel is on screen

// Swap a number for a new one that drops in from above, hits, and settles
// with a small bounce, like a mechanical counter. The element must sit
// inside a parent with a fixed height and overflow: hidden, so only the
// new number shows.
export function slam(element, text) {
  element.textContent = text;
  if (motion !== 'full') return;

  element.animate(
    [
      { transform: 'translateY(-80%)', opacity: 0 },
      { transform: 'translateY(7%)', opacity: 1, offset: 0.55 },
      { transform: 'translateY(-3%)', offset: 0.8 },
      { transform: 'none' },
    ],
    { duration: 260 * pace(), easing: 'cubic-bezier(.5, 0, .2, 1)' }
  );
}

// The two chevrons beside the days number close in like jaws and open again
export function nudge(leftElement, rightElement) {
  if (motion !== 'full') return;

  const ease = 'cubic-bezier(.3, 0, .2, 1)';
  leftElement.animate(
    [
      { transform: 'none', easing: ease },
      { transform: 'translateX(14px)', offset: 0.35, easing: ease },
      { transform: 'none' },
    ],
    { duration: 700 * pace() }
  );
  rightElement.animate(
    [
      { transform: 'none', easing: ease },
      { transform: 'translateX(-14px)', offset: 0.35, easing: ease },
      { transform: 'none' },
    ],
    { duration: 700 * pace() }
  );
}


// The logo
//
// The logo's moves are effects like the others (see "Effects that play now
// and then" above): the entrance, the spin and the flying hawk. Each plays an
// act, or a few in a row, by setting data-act on the logo. frame.css has the
// rules for each act name.

// Plays one act and says when it is over. seconds is how long the act lasts at
// normal speed. Any mode but full motion gets the still emblem. An act that is
// already playing starts again from the beginning, which tools/logo.html needs.
export async function playLogoAct(logo, act, seconds) {
  if (logo.dataset.act === act && act !== 'rest') {
    logo.dataset.act = 'rest';
    void logo.getBoundingClientRect(); // lets the page notice the change before the next one
  }
  logo.dataset.act = motion === 'full' ? act : 'rest';

  await wait(seconds * 1000 * pace());
  await whenDone(logo);
}

// The logo can move: it is the banner's logo and it is on the page
function logoCanMove() {
  return !!showLogo && showLogo.isConnected;
}

// Whether the play that has this run should carry on moving this logo. It
// should not once it has been ended (stopLogoEffects), or when the logo has
// gone, or the master switch is off, or the motion is not full.
function logoIsGoing(logo, run) {
  return playing === run && showLogo === logo && logo.isConnected && logoAnimationsOn && motion === 'full';
}

// Back to the still emblem. The time scales go with it, so an act played by
// hand later (tools/logo.html) runs at its normal time.
function restLogo(logo) {
  logo.dataset.act = 'rest';
  logo.style.removeProperty('--spin-scale');
  logo.style.removeProperty('--hawk-scale');
}

// The entrance: the plates fly in
async function playEntranceNow(seconds, run) {
  const logo = showLogo;

  await playLogoAct(logo, 'boot', seconds);
  if (playing === run) restLogo(logo);
}

// The spin. --spin-scale stretches the time of the turn in frame.css, so the
// turn lasts the seconds in the setting.
async function playSpinNow(seconds, run) {
  const logo = showLogo;

  logo.style.setProperty('--spin-scale', String(scaleOf(seconds, spinNormalSeconds)));
  await playLogoAct(logo, 'turn', seconds);
  if (playing === run) restLogo(logo);
}

// The flying hawk: the four acts one after the other. --hawk-scale stretches
// every time in them in frame.css, and the acts here are stretched the same,
// so the whole sequence lasts the seconds in the setting.
async function playHawkNow(seconds, run) {
  const logo = showLogo;
  const scale = seconds / hawkNormalSeconds;

  logo.style.setProperty('--hawk-scale', String(scaleOf(seconds, hawkNormalSeconds)));
  for (const act of hawkActs) {
    if (!logoIsGoing(logo, run)) break;
    await playLogoAct(logo, act[0], act[1] * scale);
  }
  if (playing === run) restLogo(logo);
}

// Takes over the logo that the effects move, and starts them counting. The
// entrance plays first, if its switch and the master switch are on. Starting a
// logo again (tools/logo.html) starts it all again.
export function startLogo(logo) {
  showLogo = logo;
  restLogo(logo);

  // Anything waiting for the old logo is dropped, so the entrance comes first
  waiting = waiting.filter(entry => !effects[entry.name].logo);

  const now = performance.now();
  Object.keys(effects).forEach(name => {
    if (!effects[name].logo) return;
    effects[name].lastStarted = null;
    effects[name].countFrom = now;
  });

  if (logoAnimationsOn && entranceOn) askToPlay('entrance', true);
}

// Ends the effects on a logo and leaves it a still emblem (tools/logo.html uses it)
export function stopLogo(logo) {
  if (showLogo === logo) {
    showLogo = null;
    if (playing && effects[playing.name].logo) playing = null;
  }
  restLogo(logo);
}

// A logo that flies for as long as it is on screen (the announcements). It
// runs on --pace, so a change of Speed changes it while it flies. Calm and
// none show the hawk still, in frame.css. With the master switch off it is the
// still emblem.
export function flyLogo(logo) {
  logo.dataset.act = logoAnimationsOn ? 'fly' : 'rest';
}

// Ends whatever the logo is doing at once and leaves the still emblem. The
// play that was going sees it is no longer the one playing and stops by
// itself. Used by the master switch, and by a play asked for by hand.
function stopLogoEffects() {
  if (playing && effects[playing.name].logo) {
    if (playing.name === 'name') stopNameEffect();
    playing = null;
  }
  restLogos();
}

function stopNameEffect() {
  const name = document.querySelector('[data-name-effect]');
  if (name) name.classList.remove('splitting');
}

// Also called when the motion setting leaves full: a logo in the middle of an
// act goes back to rest at once, because the act's pose would otherwise stay.
function restLogos() {
  if (showLogo) restLogo(showLogo);
}


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
  if (kitOn && motion === 'full') armKitGlitch();
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
  return kitOn && motion === 'full' && !nightCovers && !takeoverCovers && !hiddenPlaying && !isPaused();
}

function kitMayFire() {
  return kitMoves() && !effectsPaused;
}

// Puts data-kit="on" on the html element while the kit may move, and takes it
// off the moment it may not, which stops every animation of the kit and ends any
// glitch or burst that is playing. It is written only when it changes, because
// writing it can make the browser restyle the page.
function showKit() {
  if (kitMoves()) {
    if (page.dataset.kit !== 'on') page.dataset.kit = 'on';
    return;
  }

  if (page.dataset.kit !== undefined) delete page.dataset.kit;
  endKitEvents();
}

function armKitGlitch() {
  if (!kitOn || kitGlitchTimer !== null) return;
  kitGlitchTimer = setTimeout(playKitGlitch, kitGlitchGap(Math.random) * 1000);
}

function disarmKitGlitch() {
  clearTimeout(kitGlitchTimer);
  kitGlitchTimer = null;
  endKitEvents();
}

// The next glitch is set first, so that one that is skipped or fails never ends
// the series. It plays only when nothing else is playing: not the name effect,
// the logo or the glitch of the screen, and not while a page is changing.
function playKitGlitch() {
  kitGlitchTimer = null;
  armKitGlitch();

  try {
    const name = document.querySelector('[data-name-effect]');
    if (!name || !kitMayFire() || playing || areaIsChanging()) return;

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
function playKitBurst() {
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

function endKitEvents() {
  endKitGlitch();
  endKitBurst();
}
