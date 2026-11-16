// Presentations from a Google Drive folder, on the page: the list on the TV, the keys that open
// it and move in it, and the picks that come from the control page (docs/presentations-drive.md).
// core/decks.js decides what happens. This file gives it the real screen: the one clock, the
// keys, the mouse, localStorage, the list the Teletraan computer keeps (decks/manifest.json in
// the data folder) and the talk screen that plays the deck (core/presentation-run.js).
//
// The list is drawn in #decks, which is under #overlay, so an alert still covers it. The
// dashboard keeps running behind it.

import * as frame from '../frame.js';
import { liveFolder } from '../config.js';
import { readHandled, rememberHandled } from './demo.js';
import { answerEvent } from './now-report.js';
import { startDeckTalk, talkOnScreen } from './presentation-run.js';
import { takeoverRunning } from './takeover.js';
import { escapeHtml } from './text.js';
import {
  canPlay, checkedText, closedPicker, deckNote, deckTalk, findDeck, handledKey, keepMark, listNote, listSeconds, markedIndex,
  openPicker, opensPicker, pickerAction, pickerTimedOut, pressPickerKey, shouldPlayDeck, shownRows, tidyDeckList, tidyDeckRequest,
} from './decks.js';

const layer = document.getElementById('decks');
const listWaitMs = 4000; // a list that takes longer than this counts as missing

let getContent = null;
let storage = null;
let handled = ''; // the pick from the control page that was played last, so it is never played twice
let picker = closedPicker();
let list = tidyDeckList(null);
let readAt = 0; // when the list was last asked for, in milliseconds
let reads = 0; // how many times the list was asked for, so an answer that arrives late is dropped
let drawn = ''; // what is on the screen, so the list is drawn again only when it changes

// Even asking for localStorage can throw, for example when the browser has storage switched off
function savedStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

// getContent() returns the newest content. Start this after the talk screen (core/presentation-run.js):
// its key listener then runs first, so the key that picks a deck is not also the first key of the talk.
export function startDecks(contentGetter) {
  getContent = contentGetter;
  storage = savedStorage();
  handled = readHandled(storage, handledKey);

  window.addEventListener('keydown', onKey, true);
  layer.addEventListener('mousedown', onMouse);
  window.addEventListener(answerEvent, event => takeRequest(event.detail ? event.detail.deck : null));
  frame.onSecond(look);
}

// True while the list is on the screen
export function decksOpen() {
  return picker.open;
}

function presentationsOn() {
  const content = getContent();
  return Boolean(content && content.settings && content.settings.presentationsEnabled !== false);
}

// The list from the Teletraan computer. A file that is missing, cannot be read or takes too long is the
// empty list with the state 'missing'. It is never taken from the cache.
function readList() {
  const answer = fetch(liveFolder + 'decks/manifest.json', { cache: 'no-store' })
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null);
  return Promise.race([answer, frame.wait(listWaitMs).then(() => null)]).then(tidyDeckList);
}

function refresh() {
  const reading = ++reads;
  readAt = Date.now();
  readList().then(found => {
    if (reading !== reads || !picker.open) return;

    list = found;
    picker = keepMark(picker, list);
    draw(new Date());
  });
}

// Once a second: the list closes when something else takes the screen or nobody has pressed a
// key for a while, and it is read again every few seconds while it is open
function look(now) {
  if (!picker.open) return;

  if (takeoverRunning() || talkOnScreen() || pickerTimedOut(picker, now)) {
    close();
    return;
  }
  if (now.getTime() - readAt >= listSeconds * 1000) refresh();
  draw(now);
}

function open(now) {
  picker = openPicker(list, now);
  layer.hidden = false;
  draw(now);
  refresh();
}

function close() {
  picker = closedPicker();
  reads += 1;
  drawn = '';
  layer.hidden = true;
  layer.textContent = '';
}

function play(deck) {
  close();
  startDeckTalk(deckTalk(deck, new Date()));
}

function onKey(event) {
  if (event.ctrlKey || event.altKey || event.metaKey) return;

  if (!picker.open) {
    if (!opensPicker(event.key) || takeoverRunning() || talkOnScreen()) return;

    // F5 would load the page again. A key the list uses goes no further: the talk screen listens to the same
    // keys, and whichever of the two was started last must not take the key that picks a deck as its own first key.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) open(new Date());
    return;
  }

  const action = pickerAction(event.key);
  if (action === null) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  // A key that is held down may run down the list, but it must not start a deck or close the list
  if (event.repeat && (action === 'play' || action === 'close')) return;

  const pressed = pressPickerKey(picker, event.key, list, new Date());
  if (pressed.play !== null && presentationsOn()) {
    play(pressed.play);
    return;
  }
  picker = pressed.play === null ? pressed.picker : picker;
  if (picker.open) draw(new Date());
  else close();
}

// A click or a tap on a deck that is ready starts it. A click anywhere else closes the list.
function onMouse(event) {
  if (!picker.open || event.button !== 0) return;

  event.preventDefault();
  const row = event.target.closest('[data-deck]');
  const deck = row ? findDeck(list, row.dataset.deck) : null;
  if (deck && canPlay(deck) && presentationsOn()) play(deck);
  else if (!row) close();
}

// A pick made on the control page. It is played once, and only while it is new. A pick that
// arrives while a talk has the screen, or while Run presentations is off, is dropped: the
// control page refuses those before it sends them, so this is only for one that slips through.
function takeRequest(raw) {
  const request = tidyDeckRequest(raw);
  if (!shouldPlayDeck(request, handled, new Date())) return;

  handled = request.requestedAt;
  rememberHandled(storage, handled, handledKey);
  if (talkOnScreen() || !presentationsOn()) return;

  readList().then(found => {
    const deck = findDeck(found, request.id);
    if (deck && canPlay(deck) && !talkOnScreen()) play(deck);
  });
}

function rowMarkup(deck, marked) {
  return '<div class="decks-row" data-deck="' + escapeHtml(deck.id) + '" data-marked="' + (marked ? 'yes' : 'no') + '" data-state="' + deck.state + '">' +
    '<span class="decks-name">' + escapeHtml(deck.name) + '</span><span class="decks-note">' + escapeHtml(deckNote(deck)) + '</span></div>';
}

// What the list says when it has no rows
function emptyWords() {
  return list.state === 'ok' && list.decks.length === 0 ? 'The folder has no presentations yet. Put a Google Slides or PowerPoint file in it.' : '';
}

function draw(now) {
  const rows = shownRows(picker, list);
  const marked = markedIndex(picker, list);
  const below = list.decks.length - rows.first - rows.decks.length;
  const notes = [presentationsOn() ? '' : 'Run presentations is switched off in Dashboard Settings, so a deck cannot be started.', listNote(list), emptyWords()].filter(Boolean);
  const more = (rows.first > 0 ? rows.first + ' more above' : '') + (rows.first > 0 && below > 0 ? ', ' : '') + (below > 0 ? below + ' more below' : '');

  const markup = '<section class="decks-picker">' +
    '<div class="decks-title">Presentations</div>' +
    '<div class="decks-rows">' + rows.decks.map((deck, place) => rowMarkup(deck, rows.first + place === marked)).join('') + '</div>' +
    '<div class="decks-more"><span>' + escapeHtml(more) + '</span><span>' + escapeHtml(checkedText(list, now)) + '</span></div>' +
    notes.map(note => '<div class="decks-warning">' + escapeHtml(note) + '</div>').join('') +
    '<div class="decks-foot">Next or Back: choose. Enter or B: start. Esc: close.</div>' +
    '</section>';

  if (markup === drawn) return;
  drawn = markup;
  layer.innerHTML = markup;
}
