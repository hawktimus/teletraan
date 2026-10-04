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

import { speeds } from './config.js';

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
    'title':      ['latch-left', 500],
    'team-plate': ['latch-left', 700],
    'clock':      ['latch-right', 700],
    'wordmark':   ['fade', 1000],
    'subtitle':   ['fade', 1000],
    'rule':       ['grow', 1100],
    'school':     ['fade', 1300],
    'status':     ['fade', 1500],
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

function whenDone(panel) {
  // very old browsers cannot report animations, so wait a fixed time instead
  if (!panel.getAnimations) return wait(2500 * pace());

  // animations that never end (the pulsing lamp) are not waited for
  const running = panel.getAnimations({ subtree: true })
    .filter(animation => animation.effect.getComputedTiming().endTime !== Infinity);

  // finished rejects when an animation is cancelled, which is fine here
  const done = Promise.all(running.map(animation => animation.finished.catch(() => {})));

  // never wait forever, for example if the window is hidden. The limit grows
  // with the pace, or a slow setting would be cut off while it still moves.
  return Promise.race([done, wait(5000 * pace())]);
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


// The team name effect. shell.js passes the two Dashboard Settings (the
// switch and the seconds between plays) to setNameEffect every time the
// content changes. The effect itself is the classes and keyframes under "The
// team name" in frame.css, on the letters that core/name.js builds.
//
// The logo's show decides when it may start, because the name and the logo
// must never move together. The show has a quiet moment in every cycle (the
// act called name), and the effect plays then if it is due. It is due once
// every nameEverySeconds, counted from the start of the show, so the first
// play is in the first cycle and the next is in the first cycle after the
// seconds are up. The seconds are real seconds. The Speed setting changes
// how fast the effect moves, not how often it plays.
let nameEffectOn = true;
let nameEverySeconds = 300;
let showStartedAt = 0;
let lastNameSlot = -1;

export function setNameEffect(on, everySeconds) {
  nameEffectOn = on !== false;
  nameEverySeconds = everySeconds > 0 ? everySeconds : 300;
}

function playNameEffectIfDue() {
  const slot = Math.floor((Date.now() - showStartedAt) / 1000 / nameEverySeconds);
  if (!nameEffectOn || slot === lastNameSlot) return;

  lastNameSlot = slot;
  playNameEffect();
}

// Plays the effect now and says when it is over. It does nothing in calm or
// none motion. To try it from the browser console on the dashboard page:
//   import('./frame.js').then(frame => frame.playNameEffect())
export async function playNameEffect() {
  const name = document.querySelector('[data-name-effect]');
  if (motion !== 'full' || !name || name.classList.contains('splitting')) return;

  name.classList.add('splitting');
  await whenDone(name);
  name.classList.remove('splitting');
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
  ['name', 2],      //  5  the logo is still, so the team name effect may play
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
  showStartedAt = Date.now();
  lastNameSlot = -1;
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
      if (act === 'name') playNameEffectIfDue();

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


// The old television effect. start() sets it going every few minutes.
let crtEveryMinutes = 0;
let crtSeconds = 0;

export function setCrt(everyMinutes) {
  crtEveryMinutes = everyMinutes || 0;
}

const CRT_MS = 2700; // a little longer than the 2.6 second animations in frame.css, before the pace

export function playCrt() {
  const crt = document.getElementById('crt');
  const world = document.getElementById('world');
  if (motion !== 'full' || !crt || !world || crt.classList.contains('playing')) return;

  crt.classList.add('playing');
  world.classList.add('crt-on');
  setTimeout(stopCrt, CRT_MS * pace());
}

// Also used when the motion setting changes to calm or none in the middle of it
function stopCrt() {
  const crt = document.getElementById('crt');
  const world = document.getElementById('world');
  if (crt) crt.classList.remove('playing');
  if (world) world.classList.remove('crt-on');
}

onSecond(() => {
  crtSeconds++;
  if (crtEveryMinutes > 0 && crtSeconds % (crtEveryMinutes * 60) === 0) playCrt();
});
