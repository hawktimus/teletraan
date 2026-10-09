// Presentation mode: the plain functions. They know nothing about the page, so
// a node test can run them. The code that draws the screen asks them what to
// show, and does the showing.
//
// How a talk goes (docs/presentations.md):
//
//   idle -> title -> presenting -> thanks -> idle
//             |
//             +-- no key for noShowMinutes (constants.js) -> skipped -> idle
//
//   idle        nothing shows. A scheduled talk is due from its start until its end,
//               and waits while an alert or an announcement has the screen.
//   title       the card with the speaker, the subteam and the title. The first
//               forward key or left click starts the talk. The wait for it runs from
//               the moment the card appeared, and the card is a copy of the talk, so
//               an edit in Studio does not change it. On the card that says the slides
//               are not ready, any click ends the talk at once.
//   presenting  one slide at a time. The talk ends at its start plus its minutes
//               plus graceMinutes (constants.js), whatever slide it is on.
//   thanks      the card after the last slide, for a few seconds.
//   skipped     the talk will not run. It lasts one look, then it is idle.
//
// Switching Run presentations off ends whatever is on the screen at once.
//
// The screen keeps one state and calls, in this order:
//   once a second  state = nextState(state, { now, talks, settings, skipped, announcing, slides })
//   on a key       state = pressKey(state, event.key, new Date())
//   on a click     state = pressMouse(state, mouseButton(event.button), new Date())
//   after each     rememberEnded(storage, skipped, state), so a talk that is skipped or over
//                  does not start again
// It holds the screen (frame.pause) for as long as holdsScreen(state) is true.
//
// A state is a plain object with a name and, except for idle, the talk. Times in a
// state are milliseconds. The rest of this file takes and gives Dates.

import { defaultTalk, liveFolder, sampleFolder } from '../config.js';
import { graceMinutes, noShowMinutes } from './constants.js';
import { asDate } from './time.js';

export const states = ['idle', 'title', 'presenting', 'thanks', 'skipped'];

// Seconds, fixed by how the screen works and not by Dashboard Settings
export const thanksSeconds = 5;
export const notReadySeconds = 60; // how long "Slides are not ready" shows before the mode lets go
export const escapeSeconds = 2; // the second Esc must come within this time of the first
export const chipSeconds = 3; // the slide number shows this long after a key
export const preloadAhead = 3; // how many slides are decoded before they are needed

// What each key does, by the name the browser gives it (event.key). A letter is
// looked up in lower case, so Caps Lock does no harm.
export const keyActions = {
  PageDown: 'forward',
  ArrowRight: 'forward',
  ArrowDown: 'forward',
  ' ': 'forward',
  Enter: 'forward',
  n: 'forward',
  F5: 'forward',
  PageUp: 'back',
  ArrowLeft: 'back',
  ArrowUp: 'back',
  p: 'back',
  b: 'black',
  '.': 'black',
  Home: 'home',
  End: 'end',
  Escape: 'escape',
};

// 'forward', 'back', 'black', 'home', 'end' or 'escape', or null for a key that
// presentation mode leaves alone
export function keyAction(key) {
  const name = typeof key === 'string' && key.length === 1 ? key.toLowerCase() : key;
  return Object.prototype.hasOwnProperty.call(keyActions, name) ? keyActions[name] : null;
}

// What each button of the mouse does, by the name mouseButton() gives it. A tap on a touch
// screen is a left click. null is nothing: the middle button is not used. A double click is
// not a button, see secondOfDoubleClick.
export const clickActions = {
  left: 'forward',
  right: 'back',
  middle: null,
};

// A second left click this many milliseconds or fewer after the click before it is half of a
// double click, and does nothing
export const doubleClickMs = 500;

const buttonNames = { 0: 'left', 1: 'middle', 2: 'right' };

// 'left', 'middle' or 'right' for the number the browser gives in event.button, or null for
// any other button
export function mouseButton(number) {
  return Object.prototype.hasOwnProperty.call(buttonNames, number) ? buttonNames[number] : null;
}

// 'forward' or 'back', or null for a button that presentation mode leaves alone
export function clickAction(button) {
  return Object.prototype.hasOwnProperty.call(clickActions, button) ? clickActions[button] : null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// When a talk is over, as a Date: its start, its minutes and the overrun it is
// allowed. The overrun is graceMinutes unless the caller names another one.
export function talkEnd(talk, overrunMinutes = graceMinutes) {
  const minutes = typeof talk.minutes === 'number' && talk.minutes > 0 ? talk.minutes : defaultTalk.minutes;
  return new Date(asDate(talk.start).getTime() + (minutes + overrunMinutes) * 60000);
}

// The key that the skipped set holds for a talk. It has the start in it, so a
// talk moved to another time in Studio is a new talk and can run again.
export function skipKey(talk) {
  return talk.id + ' ' + asDate(talk.start).getTime();
}

// Only a scheduled talk that Sanity has published and that has a start runs. The
// id of a draft starts with drafts., and the public dataset never sends one, but
// a draft must not start even so. The Daily Agenda panel lists the same talks.
export function canRun(talk) {
  if (!isRecord(talk) || typeof talk.id !== 'string' || talk.id.startsWith('drafts.')) return false;
  return talk.status === 'scheduled' && !isNaN(asDate(talk.start).getTime());
}

// The talk that is due now, or null: the one that started first among the talks
// that have started, are not over and have not been skipped or finished.
//   talks     content.presentations
//   now       a Date
//   settings  Dashboard Settings
//   skipped   a Set of skipKey texts
// Nothing is due while presentationsEnabled is off, or before the start.
export function dueTalk(talks, now, settings, skipped) {
  if (settings.presentationsEnabled === false) return null;

  let found = null;
  (Array.isArray(talks) ? talks : []).forEach(talk => {
    if (!canRun(talk)) return;

    const start = asDate(talk.start);
    if (now < start || now >= talkEnd(talk)) return;
    if (skipped.has(skipKey(talk))) return;
    if (found === null || start < asDate(found.start)) found = talk;
  });
  return found;
}

// The files of a manifest.json that can be shown, in order. Nothing for a manifest
// that is missing, that says ok: false, or that has no pages.
export function slidePages(manifest) {
  if (!isRecord(manifest) || manifest.ok !== true || !Array.isArray(manifest.pages)) return [];
  return manifest.pages.filter(page => typeof page === 'string' && page !== '');
}

// The address of the folder that holds a talk's manifest.json and its pictures
// (deploy/scripts/slides-sync.sh), with the slash at the end. The sample content has
// its own folder, like its calendars.
export function slidesFolder(sample, talk) {
  return (sample ? sampleFolder : liveFolder) + 'slides/' + encodeURIComponent(talk.id) + '/';
}

// The address of one picture of the manifest, so a file name can never leave the folder
export function slideAddress(folder, page) {
  return folder + encodeURIComponent(page);
}

export function idleState() {
  return { name: 'idle' };
}

// True for every state but idle. The screen is paused (frame.pause) for as long as it is.
export function holdsScreen(state) {
  return state.name !== 'idle';
}

// What the state puts on the screen: 'title', 'not-ready' (the title card gives way to the
// words that the slides are not ready), 'slides', 'thanks', or 'none' for idle and skipped.
// The screen draws again only when this changes.
export function pictureOf(state) {
  if (state.name === 'title') return state.notReadyAt === null ? 'title' : 'not-ready';
  if (state.name === 'presenting') return 'slides';
  return state.name === 'thanks' ? 'thanks' : 'none';
}

// The four lines of a card: a small one above, the big one, the one under it, and the one
// at the bottom. kind is 'title', 'not-ready' or 'thanks'. A line with nothing in it is not drawn.
export function cardLines(kind, talk) {
  if (kind === 'not-ready') return { label: '', headline: 'Slides are not ready.', detail: 'Ask a coach.', prompt: '' };
  if (kind === 'thanks') return { label: '', headline: 'Thank you', detail: talk.name, prompt: '' };
  return { label: talk.subteam || '', headline: talk.name, detail: talk.topic, prompt: 'Press the clicker to begin' };
}

// What the card keeps of a talk, so a later edit does not change it
function copyOfTalk(talk) {
  const copy = { id: talk.id, name: talk.name, topic: talk.topic, start: new Date(asDate(talk.start).getTime()), minutes: talk.minutes };
  if (talk.subteam) copy.subteam = talk.subteam;
  if (talk.deckLink) copy.deckLink = talk.deckLink;
  return copy;
}

function skippedState(talk, reason) {
  return { name: 'skipped', talk: talk, reason: reason };
}

function thanksState(talk, time) {
  return { name: 'thanks', talk: talk, since: time };
}

// The next state. It gives back the state it was given when nothing changes, so
// the screen can tell with ===.
//   state      the state now
//   input      { now, talks, settings, skipped, announcing, slides }
//     announcing  true while an alert or an announcement has the screen. A title waits for it.
//     slides      the manifest.json of the talk that is on the title card: undefined until it
//                 has been read, null when there is none, otherwise what it said
export function nextState(state, input) {
  if (input.settings.presentationsEnabled === false) return state.name === 'idle' ? state : idleState();

  if (state.name === 'idle') return startTitle(state, input);
  if (state.name === 'title') return keepTitle(state, input);
  if (state.name === 'presenting') return keepPresenting(state, input);
  if (state.name === 'thanks') return keepThanks(state, input);
  return idleState();
}

function startTitle(state, input) {
  if (input.announcing) return state;

  const talk = dueTalk(input.talks, input.now, input.settings, input.skipped);
  if (talk === null) return state;

  return { name: 'title', talk: copyOfTalk(talk), since: input.now.getTime(), count: 0, notReadyAt: null, escapedAt: null, clickedAt: null };
}

// The wait for the speaker ends at noShowMinutes, or when the slot is over if that
// comes first. Slides that cannot be shown get notReadySeconds, and then the talk
// is skipped. Slides that can are counted, so a forward key can start the talk.
function keepTitle(state, input) {
  const time = input.now.getTime();
  const noShow = noShowMinutes * 60000;
  if (time - state.since >= noShow || input.now >= talkEnd(state.talk)) return skippedState(state.talk, 'no-show');
  if (input.slides === undefined) return state;

  const count = slidePages(input.slides).length;
  if (count > 0) return state.notReadyAt === null && count !== state.count ? Object.assign({}, state, { count: count }) : state;

  const notReadyAt = state.notReadyAt === null ? time : state.notReadyAt;
  if (time - notReadyAt >= notReadySeconds * 1000) return skippedState(state.talk, 'not-ready');
  return notReadyAt === state.notReadyAt ? state : Object.assign({}, state, { notReadyAt: notReadyAt });
}

// A talk ends when its slot and the overrun are used up, on whatever slide it is
function keepPresenting(state, input) {
  return input.now >= talkEnd(state.talk) ? thanksState(state.talk, input.now.getTime()) : state;
}

function keepThanks(state, input) {
  return input.now.getTime() - state.since >= thanksSeconds * 1000 ? idleState() : state;
}

// True when this Esc comes within escapeSeconds of the one before it. Both are
// milliseconds, and the first is null when there has been none.
export function escapeTwice(previous, time) {
  return previous !== null && time - previous <= escapeSeconds * 1000;
}

// The state after a key. A key that changes nothing gives back the state it was given.
//   forward   in the title it starts the talk. On a slide it goes to the next one, and on the
//             last slide it goes to the thanks card.
//   back      the slide before, and not before the first
//   home, end the first slide and the last
//   black     black screen on or off. A forward, back, home or end key also ends it, so the
//             key always changes what is on the screen.
//   escape    twice within two seconds ends the talk. One does nothing.
export function pressKey(state, key, now) {
  const action = keyAction(key);
  return action === null ? state : pressAction(state, action, now.getTime());
}

// What an action does in the state the talk is in. A key and a click both come here.
function pressAction(state, action, time) {
  if (state.name === 'title') return pressOnTitle(state, action, time);
  if (state.name === 'presenting') return pressOnSlide(state, action, time);
  return state;
}

function pressOnTitle(state, action, time) {
  if (action === 'forward') {
    if (state.count === 0 || state.notReadyAt !== null) return state;
    return { name: 'presenting', talk: state.talk, count: state.count, slide: 0, black: false, keyAt: time, escapedAt: null, clickedAt: null };
  }
  if (action !== 'escape') return state;

  return escapeTwice(state.escapedAt, time) ? skippedState(state.talk, 'ended') : Object.assign({}, state, { escapedAt: time });
}

function pressOnSlide(state, action, time) {
  if (action === 'escape') {
    return escapeTwice(state.escapedAt, time) ? thanksState(state.talk, time) : Object.assign({}, state, { escapedAt: time, keyAt: time });
  }

  const last = state.count - 1;
  const shown = Object.assign({}, state, { keyAt: time });

  if (action === 'black') return Object.assign(shown, { black: !state.black });
  if (action === 'forward') return state.slide >= last ? thanksState(state.talk, time) : Object.assign(shown, { slide: state.slide + 1, black: false });
  if (action === 'back') return Object.assign(shown, { slide: Math.max(0, state.slide - 1), black: false });
  if (action === 'home') return Object.assign(shown, { slide: 0, black: false });
  return Object.assign(shown, { slide: last, black: false });
}

// True when this left click comes within doubleClickMs of the click before it that moved the
// talk. Both are milliseconds, and the first is null when there has been none.
export function secondOfDoubleClick(previous, time) {
  return typeof previous === 'number' && time >= previous && time - previous <= doubleClickMs;
}

// The state after a click of the mouse. button is 'left', 'middle' or 'right' (mouseButton).
// A click does what clickActions says, which is what the key of that action does, with two
// differences:
//   not ready  on the card that says the slides are not ready, any click ends the talk at once.
//              The talk is skipped, and the screen starts its rotation again (restartsRotation).
//   double     the second left click of a double click does nothing, so a double click on the
//              title card starts the talk and does not also skip its first slide. A click that
//              is left out does not start the time again.
// A click that changes nothing gives back the state it was given.
export function pressMouse(state, button, now) {
  const time = now.getTime();
  if (pictureOf(state) === 'not-ready') return skippedState(state.talk, 'not-ready');

  const action = clickAction(button);
  if (action === null) return state;
  if (action === 'forward' && secondOfDoubleClick(state.clickedAt, time)) return state;

  const next = pressAction(state, action, time);
  const moved = action === 'forward' && next !== state && next.name === 'presenting';
  return moved ? Object.assign({}, next, { clickedAt: time }) : next;
}

// True when a click took the talk off the card that says the slides are not ready. The screen then
// starts its rotation again from the first panel, with the first assembly of the frames.
export function restartsRotation(before, after) {
  return pictureOf(before) === 'not-ready' && after !== before;
}

// The context menu of the browser is switched off for as long as a talk holds the screen, and
// not otherwise. The right button goes back instead.
export function blocksContextMenu(state) {
  return holdsScreen(state);
}

// True for chipSeconds after a key press while a talk is on its slides
export function chipShown(state, now) {
  return state.name === 'presenting' && state.keyAt !== null && now.getTime() - state.keyAt < chipSeconds * 1000;
}

// The text of the slide number in the chip, such as 7 / 24
export function slideNumberText(state) {
  return (state.slide + 1) + ' / ' + state.count;
}

// How far along the progress line is, from 0 to 1
export function progressOf(state) {
  return state.name === 'presenting' && state.count > 0 ? (state.slide + 1) / state.count : 0;
}

// The slides to decode ahead of time, as places in the list: the first few while the
// title is up, and the few after the one on screen once the talk has started
export function preloadIndexes(state) {
  if (state.name !== 'title' && state.name !== 'presenting') return [];

  const first = state.name === 'title' ? 0 : state.slide + 1;
  const indexes = [];
  for (let place = first; place < first + preloadAhead && place < state.count; place++) indexes.push(place);
  return indexes;
}

// The skipped set is kept in localStorage so that a screen that restarts does not
// bring a skipped talk back. Even asking for localStorage can throw, so the caller
// passes it in (or null). The set itself is the fallback: a storage that fails still
// keeps the talk skipped for as long as the page is open.
export const skippedStorageKey = 'teletraan-talks-skipped';
const mostSkippedKept = 100;

export function readSkipped(storage) {
  try {
    const list = JSON.parse(storage.getItem(skippedStorageKey) || '[]');
    return new Set(Array.isArray(list) ? list.filter(item => typeof item === 'string') : []);
  } catch (error) {
    return new Set();
  }
}

// Adds the talk of a state that is skipped or over to the set, and saves the set.
// Gives back false when there was nothing to add or the storage could not be written.
export function rememberEnded(storage, skipped, state) {
  if (state.name !== 'skipped' && state.name !== 'thanks') return false;

  const key = skipKey(state.talk);
  if (skipped.has(key)) return false;
  skipped.add(key);

  try {
    storage.setItem(skippedStorageKey, JSON.stringify(Array.from(skipped).slice(-mostSkippedKept)));
    return true;
  } catch (error) {
    return false;
  }
}
