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
// The motion setting (full, calm or none) is handled here so no panel has
// to think about it. The speed setting is handled here too: every time below
// is a normal-speed time, and pace() says how much to stretch it.

import { defaultTeam, speeds } from './config.js';

const page = document.documentElement;
const motionModes = ['full', 'calm', 'none'];
let motion = 'full';
let speed = 'normal';


// How each kind of whole panel is put together. One line per part:
//   part name: [effect, start time in ms, gap in ms between repeated parts]
// Bolts, countdown segments and letters use the gap so they appear one after
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
    'school':       ['fade', 1300],
    'status':       ['fade', 1500],
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
    'scan':          ['scan', 1200],
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
};


export function start(options) {
  setMotion(options.motion);
  setSpeed(options.speed || 'normal');
  page.dataset.draw = options.draw === 'fade' ? 'fade' : 'stroke';
  tick();
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
  page.dataset.motion = mode;
  if (mode !== 'full') {
    stopCrt();
    restLogos();
  }
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


// One timer for the whole screen. Panels ask to be told when each second
// starts. Pass the panel's element as well, so the listener is dropped
// automatically once that panel has left the page.
const secondListeners = [];

export function onSecond(listener, element) {
  secondListeners.push({ listener: listener, element: element || null });
}

function tick() {
  // Set the next tick first, aiming for the start of the next second so the
  // digits stay on time. A listener that fails must not stop the clock.
  setTimeout(tick, 1000 - (Date.now() % 1000));

  const now = new Date();
  secondListeners.slice().forEach(entry => {
    if (entry.element && !entry.element.isConnected) {
      secondListeners.splice(secondListeners.indexOf(entry), 1);
      return;
    }
    try {
      entry.listener(now);
    } catch (error) {
      console.error(error);
    }
  });
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
//   xo     the old page's last second: bolts turn, the frame halves lift,
//          the slats pull back and turn edge-on.
//   xi     the new page arriving: slats turn in, halves drop, bolts lock.
//   shown  at rest. Nothing moves except the glint.
//   out    the whole area fades away (see retire).
//
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

  return whenDone(area).then(() => {
    // "shown" has no animation rules, so changing the motion setting
    // later cannot replay a page that is already on screen
    if (area.dataset.state === state) area.dataset.state = 'shown';
  });
}

// The old page's last second. When it is over the caller swaps in the next
// page and calls arrive(area, false), which carries straight on from here.
export function leave(area) {
  area.dataset.state = 'xo';
  return wait(turnMs());
}

// Takes the whole area away, frame and page, with a short fade. Used when
// the next page is not one that fits a frame, and when there is nothing to show.
export function retire(area) {
  area.dataset.state = 'out';
  return whenDone(area);
}


// Effects that play now and then
//
// Two effects play on a timer: the team name effect (the letters split and
// turn, see "The team name" in frame.css) and the screen glitch (the old
// television, see "The old television effect"). Dashboard Settings has the
// same three settings for each, under "Logo and effects": a switch, the
// seconds between plays (0 is never) and the seconds one play lasts. shell.js
// passes them to setNameEffect and setCrt every time the content changes.
//
// This is the one place that decides when an effect may start:
//   - Only one plays at a time.
//   - Neither starts while an area is changing page (leaving or arriving).
//   - The name effect starts only while the logo rests, and the logo does not
//     move again until the name effect is over, so the two never move together.
//   - Calm and none motion play neither.
// An effect that comes due when it may not start waits in line and starts as
// soon as it may. The line is looked at every 250 ms. Each effect counts its
// seconds from when it last started, so a long wait means one late play and
// never a burst of catch-up plays.
//
// The seconds between plays are real seconds. The seconds one play lasts are
// at normal speed, and the Speed setting stretches them like every other time.
//
// playNameEffect and playCrt ask for a play now, for the ?demo=crt address,
// the announcements and the browser console. They wait in the same line, and
// they play whatever the switch and the seconds between plays say.

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

// on is the switch, everySeconds is 0 for never, and seconds is how long one
// play lasts. lastStarted is when it last began, null if it has not yet.
const effects = {
  name: {
    on: true,
    everySeconds: 300,
    seconds: defaultNameSeconds,
    lastStarted: null,
    mayStart: () => !!document.querySelector('[data-name-effect]') && logoIsResting(),
    play: playNameEffectNow,
  },
  glitch: {
    on: true,
    everySeconds: 240,
    seconds: crtNormalSeconds,
    lastStarted: performance.now(),
    mayStart: () => !!document.getElementById('crt') && !!document.getElementById('world'),
    play: playCrtNow,
  },
};

let playing = null; // the name of the effect that is playing now, or null
let playingDone = Promise.resolve(); // settles when that effect is over
let waiting = []; // effects that want to start, first come first served: { name, byHand }

export function setNameEffect(on, everySeconds, seconds) {
  effects.name.on = on !== false;
  effects.name.everySeconds = everySeconds >= 0 ? everySeconds : 300;
  effects.name.seconds = seconds > 0 ? seconds : defaultNameSeconds;
}

export function setCrt(on, everySeconds, seconds) {
  effects.glitch.on = on !== false;
  effects.glitch.everySeconds = everySeconds >= 0 ? everySeconds : 240;
  effects.glitch.seconds = seconds > 0 ? seconds : crtNormalSeconds;
}

// Play the name effect or the glitch as soon as the rules above allow. To
// try one from the browser console on the dashboard page:
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
  if (playing === name || waiting.some(entry => entry.name === name)) return;

  waiting.push({ name: name, byHand: byHand });
  startNextEffect();
}

function lookAtEffects() {
  if (motion !== 'full') return;

  Object.keys(effects).forEach(name => {
    if (isDue(effects[name])) askToPlay(name, false);
  });
  startNextEffect();
}

function isDue(effect) {
  if (!effect.on || effect.everySeconds <= 0) return false;
  if (effect.lastStarted === null) return true;
  return performance.now() - effect.lastStarted >= effect.everySeconds * 1000;
}

// Whether a waiting effect still wants to play. One that came due stops
// wanting to when its switch is turned off, and every one stops when the
// motion is no longer full.
function isWanted(entry) {
  const effect = effects[entry.name];
  return motion === 'full' && (entry.byHand || (effect.on && effect.everySeconds > 0));
}

// Starts the first effect in line that may start, if nothing is playing and
// no area is changing page. Called by askToPlay and every 250 ms.
function startNextEffect() {
  waiting = waiting.filter(isWanted);
  if (playing || areaIsChanging()) return;

  const index = waiting.findIndex(entry => effects[entry.name].mayStart());
  if (index === -1) return;

  playingDone = runEffect(waiting.splice(index, 1)[0].name);
}

async function runEffect(name) {
  const effect = effects[name];
  playing = name;
  effect.lastStarted = performance.now();

  try {
    await effect.play(effect.seconds);
  } catch (error) {
    console.error('The ' + name + ' effect failed', error);
  }
  playing = null;
}

// An area is changing page from the moment its old page starts to leave until
// the new page has arrived (any state but shown, see Persistent areas above)
function areaIsChanging() {
  return Array.from(document.querySelectorAll('.area')).some(area => area.dataset.state !== 'shown');
}

// With no show running (tools/logo.html before Show is pressed) the logo is
// always at rest
function logoIsResting() {
  const logo = document.querySelector('.logo[data-show]');
  return !logo || !logo.dataset.show || logo.dataset.act === 'rest' || logo.dataset.act === 'name';
}

// The logo show waits here before an act that moves, if the name effect is
// still playing
function whenNameEffectIsOver() {
  return playing === 'name' ? playingDone : Promise.resolve();
}

let looking = false;

// Called by start(), so importing this file starts no timer
function startLookingAtEffects() {
  if (looking) return;
  looking = true;
  setInterval(lookAtEffects, lookEveryMs);
}


// The name effect: frame.css moves the letters while the name has the class
// splitting. --name-scale stretches all of its times, so the whole effect
// lasts the seconds in the setting on a name as long as the default.
async function playNameEffectNow(seconds) {
  const name = document.querySelector('[data-name-effect]');
  const scale = Math.round(seconds / defaultNameSeconds * 1000) / 1000;
  const lastLetter = nameSeconds(name.querySelectorAll('.letter').length, scale) * 1000 * pace();

  name.style.setProperty('--name-scale', String(scale));
  name.classList.add('splitting');
  await whenDone(name, lastLetter + 1000); // a second more than it needs, in case it is held up
  name.classList.remove('splitting');
}

// The glitch: frame.js adds playing to #crt and crt-on to #world, and
// frame.css does the rest. It ends by the clock, a little after the last
// keyframe.
async function playCrtNow(seconds) {
  const crt = document.getElementById('crt');
  const world = document.getElementById('world');

  page.style.setProperty('--crt-scale', String(Math.round(seconds / crtNormalSeconds * 1000) / 1000));
  crt.classList.add('playing');
  world.classList.add('crt-on');
  await wait(seconds * 1000 * pace());
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


// The logo's show: a list of acts that repeats for as long as the page is
// open. An act is a name that frame.css has rules for (it is set as data-act
// on the logo) and how many seconds it lasts at normal speed. The whole list
// is one cycle of 24 seconds, and the number after each act is the second of
// the cycle it starts. A third number means the act only plays every that many
// cycles. The rest of the time the logo rests for the same seconds.
//
// An act has to be at least as long as the animations in it, or the next act
// would cut them off. The times in frame.css are multiplied by --pace and so
// are the times here, so the two stay matched at every Speed setting. If the
// setting changes in the middle of an act, playLogoAct also waits for the
// animations to finish.
export const logoShow = [
  ['rest', 2],      //  0  the first time round this is boot: the plates fly in
  ['turn', 2, 3],   //  2  one full turn, every third cycle
  ['rest', 1],      //  4
  ['name', 2],      //  5  the logo is still. Like every rest, this is a time the team name effect may play
  ['rest', 6],      //  7
  ['robot', 3],     // 13  the wings fold into legs, the head lifts clear
  ['hawk-in', 2],   // 16  the plates break away and the hawk turns in
  ['flight', 4],    // 18  five wingbeats
  ['hawk-out', 2],  // 22  the hawk turns back into the plates
];

// Plays one act and says when it is over. Any mode but full motion gets the
// still emblem. An act that is already playing starts again from the
// beginning, which tools/logo.html needs.
export async function playLogoAct(logo, act, seconds) {
  if (logo.dataset.act === act && act !== 'rest') {
    logo.dataset.act = 'rest';
    void logo.getBoundingClientRect(); // lets the page notice the change before the next one
  }
  logo.dataset.act = motion === 'full' ? act : 'rest';

  await wait(seconds * 1000 * pace());
  await whenDone(logo);
}

let logoShowCount = 0;

export function startLogo(logo) {
  // Starting a logo again must give it one show, not two
  const id = String(++logoShowCount);
  logo.dataset.show = id;
  effects.name.lastStarted = null; // a new show gets the name effect in its first moment of rest
  runLogoShow(logo, id).catch(error => console.error('The logo show stopped', error));
}

async function runLogoShow(logo, id) {
  const going = () => logo.isConnected && logo.dataset.show === id;

  for (let cycle = 0; going(); cycle++) {
    for (let step = 0; step < logoShow.length; step++) {
      if (!going()) return;

      const [name, seconds, every] = logoShow[step];
      let act = name;
      if (every && (cycle + 1) % every !== 0) act = 'rest';
      if (cycle === 0 && step === 0) act = 'boot';

      // The name effect starts only while the logo rests (see Effects that
      // play now and then), so the logo waits for it before it moves
      if (act !== 'rest' && act !== 'name') await whenNameEffectIsOver();

      await playLogoAct(logo, act, seconds);
    }
  }
}

// Ends the show on a logo and leaves it a still emblem (tools/logo.html uses it)
export function stopLogo(logo) {
  logo.dataset.show = '';
  logo.dataset.act = 'rest';
}

// A logo that flies for as long as it is on screen (the announcements). It
// runs on --pace, so a change of Speed changes it while it flies. Calm and
// none show the hawk still, in frame.css.
export function flyLogo(logo) {
  logo.dataset.act = 'fly';
}

// Called when the motion setting leaves full: a logo in the middle of an act
// goes back to rest at once, because the act's pose would otherwise stay.
function restLogos() {
  document.querySelectorAll('.logo[data-show]').forEach(logo => { logo.dataset.act = 'rest'; });
}
