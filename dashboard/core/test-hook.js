// A hook for the motion tests (tests/motion/README.md). It does nothing unless the address has both
// ?sample=1 and ?clock=fixed, so the wall never has it.
//
//   window.teletraanTest.play(name)   starts one transition now. The names are in plays below.
//   window.teletraanTest.sample()     where every piece of the screen is, on the 1920 x 1080 canvas
//   window.teletraanTest.hold(on)     the same hold that a swap or a hidden transition takes (core/busy.js)
//
// ?clock=fixed starts the clock of the page at Wednesday 14 October 2026, 14:00, and lets it run, so the
// night hours and the weekday themes are the same on every run.

import * as frame from '../frame.js';
import { isBusy, setBusy } from './busy.js';
import { previewTeam } from './teams.js';
import { boxOf, findBoxes, findContent, findPlates, screenPlace } from './hidden-pile.js';

const params = new URLSearchParams(window.location.search);
const active = params.get('sample') === '1' && params.get('clock') === 'fixed';

const views = ['general', 'prime', 'nova', 'family'];
const hourMs = 3600 * 1000;

function fixClock() {
  const RealDate = Date;
  const offset = new RealDate(2026, 9, 14, 14, 0, 0).getTime() - RealDate.now();

  class FixedDate extends RealDate {
    constructor(...parts) {
      if (parts.length === 0) super(RealDate.now() + offset);
      else super(...parts);
    }

    static now() {
      return RealDate.now() + offset;
    }
  }
  window.Date = FixedDate;
}

// The sample content is read again every 30 seconds. A change to it is made on its way to the page, and
// the reader is asked to look again now instead of waiting for its timer.
const patch = { settings: {} };
let reread = null;

function watchContent() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await realFetch(...args);
    if (!String(args[0]).includes('sample/content.json')) return response;

    const content = await response.json();
    content.settings = Object.assign({}, content.settings, patch.settings);
    return new Response(JSON.stringify(content), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const realInterval = window.setInterval.bind(window);
  window.setInterval = (callback, delay, ...rest) => {
    if (delay === 30000 && reread === null) reread = callback;
    return realInterval(callback, delay, ...rest);
  };
}

function changeSettings(settings) {
  Object.assign(patch.settings, settings);
  if (reread) reread();
}

function nextView() {
  const now = document.documentElement.dataset.view || views[0];
  return views[(views.indexOf(now) + 1) % views.length];
}

function hiddenAsk(kind) {
  return import('./hidden-run.js').then(module => module.askHidden(kind));
}

// The next page of a Monday card that scrolls
function scrollMonday() {
  const card = document.querySelector('[data-scroll-page]');
  if (!card) throw new Error('no Monday card that scrolls is on the screen');
  frame.scrollCard(card, Number(card.dataset.scrollPage));
}

// The photos begin their turn again, so that a run starts at the first photo
function restartPhotos() {
  document.querySelectorAll('.photo-body').forEach(body => {
    body.getAnimations({ subtree: true }).forEach(animation => {
      animation.cancel();
      animation.play();
    });
  });
}

const plays = {
  // The Views change: the pieces pull apart, the look goes on and they re-form (core/swap-run.js)
  'view-swap': (options) => {
    const key = options.view || nextView();
    changeSettings({ showView: { key: key, until: new Date(Date.now() + hourMs).toISOString() } });
  },

  // The team on the screen changes: Nova is mirrored, Prime is not
  // A preview wins over the team a step of the rotation holds, which teamMode does not
  'team-swap': (options) => {
    previewTeam(options.team || 'nova', Date.now() + hourMs);
    changeSettings({ teamMode: options.team || 'nova' });
  },

  // The desktop reveal (core/hidden-transitions.js): the blue glitch, the pile, the error screen and the cube
  'blue-screen': () => hiddenAsk('desktop'),
  'red-eyes': () => hiddenAsk('redEyes'),

  'monday-scroll': scrollMonday,
  'photo-cross': restartPhotos,

  // The name effect and the hawk come due on their own at once. Whether they play is up to the busy flag.
  'name-glitch': () => frame.setNameEffect(true, 1, 0),
  'hawk-flap': () => frame.setHawk(true, 1, 0),
};

// Every piece the swap and the pile move, in the 1920 x 1080 canvas. A piece has the kind and the
// place that core/swap-run.js gives it, so a test and the swap agree on what a piece is.
function sample() {
  const stage = document.getElementById('stage');
  const place = screenPlace();
  const plates = findPlates(stage);
  const boxes = findBoxes(stage);
  const content = findContent(stage, boxes);
  const pieces = [];

  const add = (kind, element, extra) => {
    const box = boxOf(element, place);
    const style = window.getComputedStyle(element);
    pieces.push(Object.assign({ kind: kind, left: box.left, top: box.top, width: box.width, height: box.height, opacity: Number(style.opacity), name: describe(element) }, extra));
  };
  plates.forEach(element => add('plate', element, {}));
  boxes.forEach(element => add('box', element, {}));
  content.forEach(element => add('content', element, { text: (element.textContent || '').trim().length > 0 }));
  Array.from(document.querySelectorAll('#pile .pile-bolt')).forEach(element => add('bolt', element, {}));
  return pieces;
}

// The same, with the frames shown as their pieces and nothing moving: where each piece belongs
function restPieces() {
  const world = document.getElementById('world');
  const had = world.hasAttribute('data-pieces');

  world.dataset.pieces = '';
  const pieces = sample();
  if (!had) delete world.dataset.pieces;
  return pieces;
}

function describe(element) {
  const region = element.closest('[id]');
  const own = element.id ? '#' + element.id : '.' + String(element.getAttribute('class') || element.tagName).trim().split(/\s+/).join('.');
  return (region && region !== element ? '#' + region.id + ' ' : '') + own;
}

if (active) {
  fixClock();
  watchContent();

  window.teletraanTest = {
    play: (name, options = {}) => {
      if (!plays[name]) throw new Error('no such play: ' + name);
      return plays[name](options);
    },
    names: Object.keys(plays),
    sample: sample,
    rest: restPieces,
    hold: on => setBusy(on, 'test'),
    busy: isBusy,
  };
}
