// Presentations from a Google Drive folder: the plain functions. They know nothing about the
// page, so a node test can run them, and the control service reads the same list with them.
// core/decks-run.js gives them the real screen.
//
// How it goes (docs/presentations-drive.md):
//   1. computer/scripts/decks-sync.sh looks at the Drive folder every 20 seconds and writes
//      decks/manifest.json in the data folder, with the pictures of each deck beside it.
//   2. A key on the TV opens the list (openKeys). The list is read again every few seconds
//      while it is open, so a file dropped in the folder shows without anyone asking.
//   3. A deck is picked on the TV, or on the control page, which hands the pick to the screen
//      with the next report of the wall (tidyDeckRequest, shouldPlayDeck).
//   4. The deck becomes a talk that starts now (deckTalk) and runs like a booked talk: title
//      card, slides, thanks card, the same keys (core/presentation.js).

import { shouldRunDemo } from './demo.js';
import { keyAction } from './presentation-input.js';
import { isRecord } from './text.js';

// Seconds and counts, fixed by how the screen works and not by Dashboard Settings
export const listSeconds = 5; // the list is read again this often while it is open
export const pickerSeconds = 60; // the list closes by itself this long after the last key
export const rowsShown = 8; // how many decks fit on the screen at once
export const deckMinutes = 240; // a picked deck has no slot, so it may run this long before it is ended

export const handledKey = 'teletraan-deck-request-handled';

// The keys that open the list while nothing else has the screen. F5 is what the play button of
// most clickers sends. A letter is looked up in lower case.
export const openKeys = ['F5', 'p'];

// Google's ids, which are also the names of the folders of pictures
const idPattern = /^[A-Za-z0-9_-]{10,100}$/;
const deckStates = ['ready', 'preparing', 'failed'];
const listStates = ['ok', 'no-folder', 'no-key', 'bad-key', 'api-off', 'not-shared', 'offline'];

function tidyDeck(raw) {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !idPattern.test(raw.id)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : '';
  if (name === '') return null;

  return {
    id: raw.id,
    name: name,
    kind: raw.kind === 'powerpoint' ? 'powerpoint' : 'slides',
    modified: typeof raw.modified === 'string' ? raw.modified : '',
    state: deckStates.includes(raw.state) ? raw.state : 'preparing',
    pages: Number.isInteger(raw.pages) && raw.pages > 0 ? raw.pages : 0,
    updating: raw.updating === true,
    error: typeof raw.error === 'string' ? raw.error.slice(0, 80) : '',
  };
}

// decks/manifest.json, always complete: { state, checkedAt, decks }. A file that is missing or
// cannot be read is the state 'missing' with no decks. A deck listed twice is kept once.
export function tidyDeckList(raw) {
  if (!isRecord(raw)) return { state: 'missing', checkedAt: '', decks: [] };

  const seen = new Set();
  const decks = (Array.isArray(raw.decks) ? raw.decks : []).map(tidyDeck).filter(deck => {
    if (deck === null || seen.has(deck.id)) return false;
    seen.add(deck.id);
    return true;
  });

  return {
    state: listStates.includes(raw.state) ? raw.state : 'missing',
    checkedAt: typeof raw.checkedAt === 'string' && !isNaN(Date.parse(raw.checkedAt)) ? raw.checkedAt : '',
    decks: decks,
  };
}

// True for a deck whose pictures are on the disk
export function canPlay(deck) {
  return isRecord(deck) && deck.state === 'ready' && deck.pages > 0;
}

export function findDeck(list, id) {
  return list.decks.find(deck => deck.id === id) || null;
}

// What a row says after the name of its deck
export function deckNote(deck) {
  if (deck.state === 'failed') return 'Could not be read: ' + (deck.error || 'ask a coach');
  if (deck.state === 'preparing' || deck.pages === 0) return 'Getting ready';
  return deck.pages + (deck.pages === 1 ? ' slide' : ' slides') + (deck.updating ? ', a newer version is on its way' : '');
}

// The one line under the list when the folder cannot be read, or '' when all is well. Every
// state but ok and offline is something a coach has to fix, and the line says where.
export function listNote(list) {
  const notes = {
    missing: 'The list is not ready yet. The Teletraan computer makes it a few seconds after it starts.',
    'no-folder': 'No Google Drive folder is named. Paste its link in Dashboard Settings, Presentations.',
    'no-key': 'The Google key is missing on the Teletraan computer (GOOGLE_API_KEY).',
    'bad-key': 'Google did not accept the key of the Teletraan computer (GOOGLE_API_KEY).',
    'api-off': 'The Google Drive API is not turned on for the key of the Teletraan computer.',
    'not-shared': 'Google would not list the folder. Share it with Anyone with the link as Viewer.',
    offline: 'Google Drive cannot be reached right now. The decks from before can still be played.',
  };
  return Object.prototype.hasOwnProperty.call(notes, list.state) ? notes[list.state] : '';
}

// How long ago the folder was looked at, in words, or '' when it never was
export function checkedText(list, now) {
  if (list.checkedAt === '') return '';
  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(list.checkedAt)) / 1000));
  if (seconds < 90) return 'Folder checked just now';
  if (seconds < 3600) return 'Folder checked ' + Math.round(seconds / 60) + ' minutes ago';
  return 'Folder checked more than an hour ago';
}

// A picked deck as a talk that starts now. Its id is not the id of any booked talk, deck names
// the folder of its pictures (slidesFolder in presentation-state.js), and its long slot means
// only the speaker ends it.
export function deckTalk(deck, now) {
  return {
    id: 'deck-' + deck.id,
    deck: deck.id,
    name: deck.name,
    topic: deck.pages + (deck.pages === 1 ? ' slide' : ' slides'),
    start: new Date(now.getTime()),
    minutes: deckMinutes,
    status: 'scheduled',
  };
}

export function closedPicker() {
  return { open: false };
}

// True for a key that opens the list. The caller checks that nothing else has the screen.
export function opensPicker(key) {
  const name = typeof key === 'string' && key.length === 1 ? key.toLowerCase() : key;
  return openKeys.includes(name);
}

// The list as it opens: the first deck is marked, and the time is kept so it can close by itself
export function openPicker(list, now) {
  return { open: true, id: list.decks.length > 0 ? list.decks[0].id : '', keyAt: now.getTime() };
}

// The place of the marked deck in the list. A deck that left the folder gives the first one.
export function markedIndex(picker, list) {
  const index = list.decks.findIndex(deck => deck.id === picker.id);
  return index === -1 ? 0 : index;
}

// The picker after the list was read again. The mark stays on its deck, and moves to the first
// one when that deck is gone. A picker that changes nothing gives back the one it was given.
export function keepMark(picker, list) {
  if (!picker.open) return picker;
  const id = list.decks.length > 0 ? list.decks[markedIndex(picker, list)].id : '';
  return id === picker.id ? picker : Object.assign({}, picker, { id: id });
}

// The picker with the mark moved to the deck under the mouse. The mouse pointer is hidden on the
// wall, so the marked row is the only sign of where it is. A picker that changes nothing gives back
// the one it was given.
export function markDeck(picker, list, id, now) {
  if (!picker.open || id === picker.id || findDeck(list, id) === null) return picker;
  return Object.assign({}, picker, { id: id, keyAt: now.getTime() });
}

// What a key does while the list is open: 'next', 'previous', 'first', 'last', 'play', 'close',
// or null for a key the list leaves alone. The keys of the clicker keep their meaning from a
// talk where they can: forward is down the list and back is up. The play button of some
// clickers sends F5 and Esc in turn, so the black screen key (B or the full stop) starts the
// marked deck as well.
export function pickerAction(key) {
  if (key === 'Enter' || key === ' ' || key === 'F5') return 'play';
  const action = keyAction(key);
  if (action === 'forward') return 'next';
  if (action === 'back') return 'previous';
  if (action === 'home') return 'first';
  if (action === 'end') return 'last';
  if (action === 'black') return 'play';
  return action === 'escape' ? 'close' : null;
}

// The picker after a key, and the deck to play if the key picked one: { picker, play }.
// A deck that is not ready cannot be picked, and the list stays open on it.
export function pressPickerKey(picker, key, list, now) {
  const action = picker.open ? pickerAction(key) : null;
  if (action === null) return { picker: picker, play: null };
  if (action === 'close') return { picker: closedPicker(), play: null };

  const touched = Object.assign({}, picker, { keyAt: now.getTime() });
  if (list.decks.length === 0) return { picker: touched, play: null };

  const index = markedIndex(picker, list);
  const last = list.decks.length - 1;
  if (action === 'play') {
    const deck = list.decks[index];
    return canPlay(deck) ? { picker: closedPicker(), play: deck } : { picker: touched, play: null };
  }

  const moves = { next: Math.min(last, index + 1), previous: Math.max(0, index - 1), first: 0, last: last };
  return { picker: Object.assign(touched, { id: list.decks[moves[action]].id }), play: null };
}

// The list closes by itself when nobody has pressed a key for pickerSeconds
export function pickerTimedOut(picker, now) {
  return picker.open && now.getTime() - picker.keyAt >= pickerSeconds * 1000;
}

// The rows on the screen: at most rowsShown decks, moved so that the marked one is among them.
// Gives { first, decks }: the place of the first row in the list, and the decks to draw.
export function shownRows(picker, list) {
  const index = markedIndex(picker, list);
  const first = Math.max(0, Math.min(index - Math.floor(rowsShown / 2), list.decks.length - rowsShown));
  return { first: first, decks: list.decks.slice(first, first + rowsShown) };
}

// A pick made on the control page, always complete: { id, requestedAt }. Anything that is not
// an id and a time is empty, which is no request.
export function tidyDeckRequest(raw) {
  const source = isRecord(raw) ? raw : {};
  const id = typeof source.id === 'string' && idPattern.test(source.id) ? source.id : '';
  const requestedAt = typeof source.requestedAt === 'string' && !isNaN(Date.parse(source.requestedAt)) ? source.requestedAt : '';
  return id === '' || requestedAt === '' ? { id: '', requestedAt: '' } : { id: id, requestedAt: requestedAt };
}

// A pick counts for a minute and is played once, the same guard as a demo (shouldRunDemo)
export function shouldPlayDeck(request, handled, now) {
  return request.id !== '' && shouldRunDemo(request.requestedAt, handled, now);
}
