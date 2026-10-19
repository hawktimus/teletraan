// The motion and speed settings, the clock, whole panels coming and going, and the page change of the areas (part of frame.js).

import { defaultSettings, speeds } from './config.js';
import { chooseFinish, chooseStyle } from './core/transitions.js';
import { makeSecondTimer } from './core/tick.js';
import { frameState } from './frame-state.js';
import { restLogos, startLookingAtEffects, stopCrt } from './frame-logo.js';
import { armKitGlitch, disarmKitGlitch, playKitBurst, showKit } from './frame-kit.js';
import { sequences } from './frame-sequences.js';

export const page = document.documentElement;
const motionModes = ['full', 'calm', 'none'];
let speed = 'normal';




export function start(options) {
  setMotion(options.motion);
  setSpeed(options.speed || 'normal');
  page.dataset.draw = options.draw === 'fade' ? 'fade' : 'stroke';
  if (options.still) return; // the still preview draws one picture and holds it (core/still.js)
  secondClock.start();
  startLookingAtEffects();
}

// One tick of the clock, for the still preview: the time is drawn once and then holds
export function tickOnce() {
  secondClock.tickOnce();
}

// 'full', 'calm' or 'none'. Anything else is ignored, because a wall
// display should carry on rather than stop.
export function setMotion(mode) {
  if (!motionModes.includes(mode)) {
    console.warn('motion must be full, calm or none, not "' + mode + '". Using full.');
    mode = 'full';
  }
  frameState.motion = mode;
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


// contentOnly is true at the end of a hidden transition (core/hidden-pile.js), when the frame
// has just been put back together: the parts that are the frame are left alone and only the
// content comes in
export function enter(panel, contentOnly = false) {
  const sequence = sequences[panel.dataset.sequence];
  if (!sequence) {
    throw new Error('No sequence called "' + panel.dataset.sequence + '" in frame.js');
  }

  panel.querySelectorAll('[data-part]').forEach(part => {
    const rule = sequence[part.dataset.part];
    if (!rule) return;
    if (contentOnly && isFramePart(part)) {
      delete part.dataset.fx;
      return;
    }

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

// A part that is drawn inside the plate of the panel, or the sweep of light over it
function isFramePart(part) {
  return part.closest('svg.plate') !== null || part.dataset.part === 'scan';
}

export function exit(panel) {
  panel.dataset.state = 'out';
  return whenDone(panel);
}

// limitMs is for an effect that can take longer than the usual five seconds
export function whenDone(panel, limitMs) {
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
  if (style === 'mechanical' && frameState.motion === 'full') return breakSecondsNow * 1000 * pace();
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
  return frameState.motion === 'none' ? 0 : 1000 * pace();
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

// A card that has more rows than fit (Department tasks, the Events panel) moves its list up by one page of
// rows: index is the page to show, counting from 0. The card, which is the page's own element, says which
// page is in view in data-scroll-page and in --scroll-page, which frame.css moves the list by and the page
// marker follows. In full motion the list takes 600 ms to get there, with the easing of the slats. In calm
// and none it is at its place at once.
export function scrollCard(card, index) {
  const list = card.querySelector('[data-scroll-list]');
  const before = Number(card.dataset.scrollPage || 1) - 1;

  card.dataset.scrollPage = String(index + 1);
  card.style.setProperty('--scroll-page', String(index));
  if (!list || frameState.motion !== 'full' || !list.animate) return;

  const place = step => 'translateY(calc(' + step + ' * var(--scroll-step, 0px) * -1))';
  list.animate([{ transform: place(before) }, { transform: place(index) }], { duration: 600 * pace(), easing: 'cubic-bezier(.5, 0, .2, 1)' });
}


// The announcement bar (core/notice-run.js) takes room from the panels under the banner. The panels
// are moved with the scale and translate properties, which do not touch the transform that the
// layouts and the hidden transitions already put on the same elements. In full motion the move takes
// the milliseconds given; in calm and none it is made at once. to is { scale, x, y }, x and y in pixels.
export function moveArea(element, to, milliseconds) {
  const from = { scale: element.style.scale || '1', translate: element.style.translate || '0px 0px' };
  const end = { scale: String(to.scale), translate: to.x + 'px ' + to.y + 'px' };

  element.style.scale = end.scale;
  element.style.translate = end.translate;
  if (frameState.motion !== 'full' || !element.animate) return;

  element.animate([from, end], { duration: milliseconds, easing: 'cubic-bezier(.5, 0, .2, 1)' });
}

// The bar comes in and goes out, and one announcement gives way to the other, by opacity alone.
// change is called when the bar is fully out, and the bar comes back to the opacity given.
// With calm or no motion it all happens at once.
export function fadeNotice(element, to, milliseconds, change) {
  if (frameState.motion !== 'full' || !element.animate) {
    if (change) change();
    element.style.opacity = String(to);
    return;
  }

  const out = element.animate([{ opacity: Number(element.style.opacity || 0) }, { opacity: 0 }], { duration: milliseconds / 2 });
  out.onfinish = () => {
    if (change) change();
    element.animate([{ opacity: 0 }, { opacity: to }], { duration: milliseconds / 2 });
    element.style.opacity = String(to);
  };
}
