// How things move.
//
// A panel labels its parts with data-part and calls enter() and exit().
// The tables below say what each part does and when, frame.css plays it,
// and the motion setting (full, calm or none) is handled here so no panel
// has to think about it. The speed setting is handled here too: every time
// below is a normal-speed time, and pace() says how much to stretch it.

import { speeds } from './config.js';

const page = document.documentElement;
const motionModes = ['full', 'calm', 'none'];
let motion = 'full';
let speed = 'normal';


// How each kind of panel is put together. One line per part:
//   part name: [effect, start time in ms, gap in ms between repeated parts]
// Rows and cards use the gap so they appear one after another.
// A part with no line here just appears and stays.
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

  // Grid 1, the large panel on the left. Tasks, events, photos and the rest use this.
  grid1: {
    'body':         ['unfold', 0],
    'header-left':  ['latch-left', 150],
    'header-right': ['latch-right', 150],
    'outline':      ['draw', 550],
    'seam':         ['draw', 900],
    'title':        ['fade', 1000],
    'tag':          ['fade', 1100],
    'divider':      ['draw', 1050, 100],
    'row':          ['fade', 1200, 120],
    'content':      ['fade', 1200],
    'stud':         ['servo', 1250, 50],
    'scan':         ['scan', 1000],
  },

  // Grid 2, the small panel on the right under the countdown
  grid2: {
    'body':         ['unfold', 0],
    'header-left':  ['latch-left', 100],
    'header-right': ['latch-right', 100],
    'outline':      ['draw', 450],
    'seam':         ['draw', 750],
    'label':        ['fade', 850],
    'row':          ['fade', 950, 100],
    'content':      ['fade', 950],
    'stud':         ['servo', 950, 50],
    'scan':         ['scan', 800],
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

  ticker: {
    'tag':     ['latch-left', 0],
    'message': ['fade', 300],
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
  if (mode !== 'full') stopCrt();
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
// open. Each act is a name that frame.css has rules for (it is set as
// data-act on the logo) and how many seconds it lasts at normal speed. The
// plates fly in once, before the first act. Between acts the logo is a
// still hawk. Calm and none leave it a still hawk all the time.
//
// An act has to be at least as long as the animations in it, or the next
// act would cut them off. The times in frame.css are multiplied by --pace
// and so are the times here, so the two stay matched at every Speed
// setting. If the setting changes in the middle of an act, playLogoAct
// also waits for the animations to finish.
export const logoEntrance = 3;  // the plates take 1.5 seconds, then the hawk is still

export const logoShow = [
  ['hover', 7],    // flies in place. Seven wingbeats are 6.3 seconds.
  ['rest', 5],
  ['soar', 7],     // spreads its wings and glides
  ['rest', 5],
  ['flex', 2.4],   // stretches both wings in three jerks
  ['rest', 5],
];

// Plays one act and says when it is over. Any mode but full motion gets a
// still hawk. Going through rest first makes an act that is already playing
// start again from the beginning.
export async function playLogoAct(logo, act, seconds) {
  logo.dataset.act = 'rest';
  if (motion === 'full') {
    void logo.getBoundingClientRect(); // lets the page notice the change before the next one
    logo.dataset.act = act;
  }
  await wait(seconds * 1000 * pace());
  await whenDone(logo);
}

let logoShowCount = 0;

export function startLogo(logo) {
  // Starting a logo again must give it one show, not two
  const id = String(++logoShowCount);
  logo.dataset.show = id;
  runLogoShow(logo, id).catch(error => console.error('The logo show stopped', error));
}

async function runLogoShow(logo, id) {
  const going = () => logo.isConnected && logo.dataset.show === id;

  if (motion === 'full') await playLogoAct(logo, 'assemble', logoEntrance);

  while (going()) {
    for (const [act, seconds] of logoShow) {
      if (!going()) return;
      await playLogoAct(logo, act, seconds);
    }
  }
}

// Ends the show on a logo and leaves it a still hawk (tools/logo.html uses it)
export function stopLogo(logo) {
  logo.dataset.show = '';
  logo.dataset.act = 'rest';
}

// A logo that hovers for as long as it is on screen (the announcements).
// Calm and none stop it in frame.css, so it needs no check here.
export function flyLogo(logo) {
  logo.dataset.act = 'fly';
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
