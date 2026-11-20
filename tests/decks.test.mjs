// Tests for the presentations of the Google Drive folder: the plain functions of the list on the TV
// (dashboard/core/decks.js), the talk a picked deck becomes, and the control routes that list the decks and
// hand a pick to the screen (control/routes/decks.js, control/routes/now.js). Nothing is drawn and nothing
// leaves the process. The script that makes the list is tested in tests/decks-sync.test.mjs.
//
//   node tests/decks.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { makeWorld, repo } from './helpers/control-world.mjs';
import * as decksRoute from '../control/routes/decks.js';
import * as nowRoute from '../control/routes/now.js';
import { pickSeconds } from '../control/support/decks.js';
import {
  canPlay, checkedText, closedPicker, deckMinutes, deckNote, deckTalk, findDeck, keepMark, listNote, markDeck, markedIndex, openPicker, opensPicker,
  pickerAction, pickerSeconds, pickerTimedOut, pressPickerKey, rowsShown, shouldPlayDeck, shownRows, tidyDeckList, tidyDeckRequest,
} from '../dashboard/core/decks.js';
import { canRun, chipShown, dueTalk, isDeckTalk, nextState, idleState, pressKey, pressMouse, slideAddress, slidesFolder, slidesVersion, talkEnd } from '../dashboard/core/presentation.js';
import { graceMinutes } from '../dashboard/core/constants.js';

const read = name => fs.readFileSync(repo + name, 'utf8');
const now = new Date('2027-03-03T20:00:00Z');
const idA = '1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const idB = '1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const idC = '1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

function manifest(extra) {
  return Object.assign({
    ok: true, state: 'ok', checkedAt: '2027-03-03T19:59:50Z', folder: 'x',
    decks: [
      { id: idA, name: 'Drive train basics', kind: 'slides', modified: '2027-03-02T10:00:00.000Z', state: 'ready', pages: 12 },
      { id: idB, name: 'Safety week', kind: 'powerpoint', modified: '2027-03-01T10:00:00.000Z', state: 'preparing', pages: 0 },
      { id: idC, name: 'Scouting', kind: 'slides', modified: '2027-02-01T10:00:00.000Z', state: 'failed', pages: 0, error: 'not shared' },
    ],
  }, extra);
}

function many(count) {
  const decks = [];
  for (let place = 0; place < count; place++) decks.push({ id: '1D' + String(place).padStart(20, '0'), name: 'Deck ' + place, kind: 'slides', modified: '', state: 'ready', pages: 3 });
  return tidyDeckList({ state: 'ok', checkedAt: '', decks: decks });
}

test('the list is tidied: a file that cannot be read is empty, and a deck with a bad id, no name or a second copy is left out', () => {
  [null, undefined, 'text', 5, []].forEach(raw => assert.deepEqual(tidyDeckList(raw), { state: 'missing', checkedAt: '', decks: [] }));

  const list = tidyDeckList(manifest());
  assert.equal(list.state, 'ok');
  assert.deepEqual(list.decks.map(deck => deck.state), ['ready', 'preparing', 'failed']);
  assert.deepEqual(list.decks[0], { id: idA, name: 'Drive train basics', kind: 'slides', modified: '2027-03-02T10:00:00.000Z', state: 'ready', pages: 12, updating: false, error: '' });

  const odd = tidyDeckList({ state: 'surprise', checkedAt: 'yesterday', decks: [
    { id: '../../etc/passwd', name: 'Bad id', state: 'ready', pages: 3 },
    { id: idA, name: '   ', state: 'ready', pages: 3 },
    { id: idA, name: 'x'.repeat(200), state: 'new', pages: -4, kind: 'video' },
    { id: idA, name: 'Second copy', state: 'ready', pages: 3 },
    'text', null,
  ] });
  assert.equal(odd.state, 'missing');
  assert.equal(odd.checkedAt, '');
  assert.equal(odd.decks.length, 1);
  assert.deepEqual([odd.decks[0].name.length, odd.decks[0].state, odd.decks[0].pages, odd.decks[0].kind], [60, 'preparing', 0, 'slides']);
});

test('only a deck whose pictures are made can be played, and each row and each state has its words', () => {
  const list = tidyDeckList(manifest());
  assert.deepEqual(list.decks.map(canPlay), [true, false, false]);
  assert.deepEqual(list.decks.map(deckNote), ['12 slides', 'Getting ready', 'Could not be read: not shared']);
  assert.equal(deckNote(tidyDeckList(manifest({ decks: [{ id: idA, name: 'One', state: 'ready', pages: 1, updating: true }] })).decks[0]), '1 slide, a newer version is on its way');
  assert.equal(findDeck(list, idB).name, 'Safety week');
  assert.equal(findDeck(list, 'nothing'), null);

  assert.equal(listNote(list), '');
  ['missing', 'no-folder', 'no-key', 'bad-key', 'api-off', 'not-shared', 'bad-secret', 'bad-script', 'wrong-folder', 'offline'].forEach(state => {
    const note = listNote(tidyDeckList(manifest({ state: state })));
    assert.ok(note.length > 20 && note.endsWith('.'), state + ': ' + note);
  });
  assert.match(listNote(tidyDeckList(manifest({ state: 'no-folder' }))), /Dashboard Settings, Presentations/);
  assert.match(listNote(tidyDeckList(manifest({ state: 'bad-script' }))), /DECKS_SCRIPT_URL/);
  assert.match(listNote(tidyDeckList(manifest({ state: 'bad-secret' }))), /DECKS_SCRIPT_SECRET/);
  assert.match(listNote(tidyDeckList(manifest({ state: 'wrong-folder' }))), /another Drive folder/);

  assert.equal(checkedText(list, now), 'Folder checked just now');
  assert.equal(checkedText(list, new Date(now.getTime() + 10 * 60000)), 'Folder checked 10 minutes ago');
  assert.equal(checkedText(list, new Date(now.getTime() + 3 * 3600000)), 'Folder checked more than an hour ago');
  assert.equal(checkedText(tidyDeckList(null), now), '');
});

test('F5 and P open the list, and in it the keys of the clicker move the mark, start a deck or close it', () => {
  ['F5', 'p', 'P'].forEach(key => assert.equal(opensPicker(key), true, key));
  ['PageDown', 'Enter', ' ', 'Escape', 'x', undefined].forEach(key => assert.equal(opensPicker(key), false, String(key)));

  const actions = { PageDown: 'next', ArrowDown: 'next', ArrowRight: 'next', n: 'next', PageUp: 'previous', ArrowUp: 'previous', p: 'previous', Home: 'first', End: 'last', Enter: 'play', ' ': 'play', F5: 'play', b: 'play', '.': 'play', Escape: 'close', x: null, Tab: null };
  Object.keys(actions).forEach(key => assert.equal(pickerAction(key), actions[key], key));

  const list = tidyDeckList(manifest());
  let picker = openPicker(list, now);
  assert.deepEqual(picker, { open: true, id: idA, keyAt: now.getTime() });

  const later = new Date(now.getTime() + 5000);
  let pressed = pressPickerKey(picker, 'PageDown', list, later);
  assert.equal(pressed.picker.id, idB);
  assert.equal(pressed.picker.keyAt, later.getTime());
  assert.equal(pressed.play, null);

  // The marked deck is not ready, so it cannot be started and the list stays open on it
  pressed = pressPickerKey(pressed.picker, 'Enter', list, later);
  assert.equal(pressed.play, null);
  assert.equal(pressed.picker.open, true);
  assert.equal(pressed.picker.id, idB);

  pressed = pressPickerKey(pressed.picker, 'End', list, later);
  assert.equal(pressed.picker.id, idC);
  assert.equal(pressPickerKey(pressed.picker, 'PageDown', list, later).picker.id, idC, 'the mark does not go past the last deck');
  pressed = pressPickerKey(pressed.picker, 'Home', list, later);
  assert.equal(pressPickerKey(pressed.picker, 'PageUp', list, later).picker.id, idA, 'or before the first');

  const played = pressPickerKey(pressed.picker, 'b', list, later);
  assert.equal(played.play.id, idA);
  assert.equal(played.picker.open, false);

  assert.equal(pressPickerKey(picker, 'Escape', list, later).picker.open, false);
  assert.equal(pressPickerKey(picker, 'x', list, later).picker, picker, 'a key the list does not use changes nothing');
  assert.equal(pressPickerKey(closedPicker(), 'Enter', list, later).play, null, 'a closed list starts nothing');

  // An empty folder: every key but Esc only keeps the list open
  const empty = tidyDeckList(manifest({ decks: [] }));
  picker = openPicker(empty, now);
  assert.equal(picker.id, '');
  assert.equal(pressPickerKey(picker, 'Enter', empty, later).play, null);
});

test('the mark stays on its deck when the list changes, the list closes by itself, and long lists scroll', () => {
  const list = tidyDeckList(manifest());
  const picker = Object.assign(openPicker(list, now), { id: idB });

  const added = tidyDeckList(manifest({ decks: [{ id: '1NEWNEWNEWNEWNEWNEW', name: 'New', state: 'preparing', pages: 0 }].concat(manifest().decks) }));
  assert.equal(keepMark(picker, added), picker, 'a new deck above does not move the mark');
  assert.equal(markedIndex(picker, added), 2);

  const gone = tidyDeckList(manifest({ decks: manifest().decks.filter(deck => deck.id !== idB) }));
  assert.equal(keepMark(picker, gone).id, idA, 'a deck that left gives the first one');
  assert.equal(keepMark(picker, tidyDeckList(manifest({ decks: [] }))).id, '');
  assert.equal(keepMark(closedPicker(), list).open, false);

  assert.equal(pickerTimedOut(picker, new Date(now.getTime() + (pickerSeconds - 1) * 1000)), false);
  assert.equal(pickerTimedOut(picker, new Date(now.getTime() + pickerSeconds * 1000)), true);
  assert.equal(pickerTimedOut(closedPicker(), now), false);

  const long = many(20);
  const at = place => Object.assign(openPicker(long, now), { id: long.decks[place].id });
  assert.deepEqual([shownRows(at(0), long).first, shownRows(at(0), long).decks.length], [0, rowsShown]);
  assert.equal(shownRows(at(10), long).first, 10 - rowsShown / 2);
  assert.equal(shownRows(at(19), long).first, 20 - rowsShown);
  assert.deepEqual([shownRows(at(1), many(3)).first, shownRows(at(1), many(3)).decks.length], [0, 3]);
});

test('a picked deck is a talk that starts now, runs like a booked one and reads its pictures from the folder of the deck', () => {
  const deck = tidyDeckList(manifest()).decks[0];
  const talk = deckTalk(deck, now);
  assert.deepEqual(talk, { id: 'deck-' + idA, deck: idA, name: 'Drive train basics', topic: '12 slides', start: now, minutes: deckMinutes, status: 'scheduled' });
  assert.notEqual(talk.start, now, 'the start is a copy');
  assert.equal(canRun(talk), true);
  assert.equal(talkEnd(talk).getTime(), now.getTime() + (deckMinutes + graceMinutes) * 60000);

  const settings = { presentationsEnabled: true };
  assert.equal(dueTalk([talk], now, settings, new Set()).id, talk.id);
  assert.equal(dueTalk([talk], now, { presentationsEnabled: false }, new Set()), null, 'Run presentations off stops a deck too');

  assert.equal(slidesFolder(false, talk), 'data/live/decks/' + idA + '/');
  assert.equal(slidesFolder(true, talk), 'data/live/decks/' + idA + '/', 'a deck is never read from the sample folder');
  assert.equal(slidesFolder(false, { id: 'presentation-a1' }), 'data/live/slides/presentation-a1/');
  assert.equal(slidesFolder(true, { id: 'presentation-a1' }), 'data/sample/slides/presentation-a1/');

  // The browser may keep a picture for a week, so the time the pictures were made is part of the address:
  // a deck that was edited and made again never shows its old slides
  const made = { ok: true, pages: ['001.jpg'], fetchedAt: '2027-03-03T19:00:00Z' };
  assert.equal(slidesVersion(made), '2027-03-03T19:00:00Z');
  assert.equal(slidesVersion({ ok: true, pages: [] }), '');
  assert.equal(slidesVersion(null), '');
  assert.equal(slideAddress('data/live/decks/x/', '001.jpg', slidesVersion(made)), 'data/live/decks/x/001.jpg?v=2027-03-03T19%3A00%3A00Z');
  assert.equal(slideAddress('data/live/decks/x/', '001.jpg'), 'data/live/decks/x/001.jpg');

  // The title card comes up for as long as the pictures take to be counted, and then the deck is on its first slide
  // without a key. The card keeps which deck it is.
  const input = { now: now, talks: [talk], settings: settings, skipped: new Set(), announcing: false, slides: { ok: true, pages: ['001.jpg', '002.jpg'] } };
  let state = nextState(idleState(), input);
  assert.equal(state.name, 'title');
  assert.equal(state.talk.deck, idA);
  state = nextState(state, input);
  assert.deepEqual([state.name, state.count, state.slide, state.talk.deck], ['presenting', 2, 0, idA]);
  assert.equal(isDeckTalk(talk), true);
  assert.equal(isDeckTalk({ id: 'presentation-a1' }), false);

  // Any forward key moves on, Left Arrow and Page Up go back, and one Esc ends the deck and gives the screen back
  state = pressKey(state, 'PageDown', now);
  assert.equal(state.slide, 1);
  state = pressKey(state, 'ArrowLeft', now);
  assert.equal(state.slide, 0);
  state = pressKey(state, 'Escape', now);
  assert.deepEqual([state.name, state.reason], ['skipped', 'ended']);
  assert.equal(nextState(state, input).name, 'idle');

  // A booked talk keeps its Esc twice
  const booked = { id: 'presentation-a1', name: 'Anna', topic: 'Drive', start: now, minutes: 15, status: 'scheduled' };
  let slot = nextState(idleState(), Object.assign({}, input, { talks: [booked] }));
  slot = pressKey(nextState(slot, Object.assign({}, input, { talks: [booked] })), 'PageDown', now);
  assert.equal(slot.name, 'presenting');
  assert.equal(pressKey(slot, 'Escape', now).name, 'presenting', 'one Esc does nothing in a booked talk');
});

test('the mouse marks the row under it, a deck that is not in the list is ignored, and nothing changes when the mark is already there', () => {
  const list = tidyDeckList(manifest());
  const picker = openPicker(list, now);
  const later = new Date(now.getTime() + 5000);

  const moved = markDeck(picker, list, idB, later);
  assert.deepEqual([moved.id, moved.keyAt], [idB, later.getTime()], 'the time is kept, so the list does not close under a mouse in use');
  assert.equal(markDeck(moved, list, idB, later), moved);
  assert.equal(markDeck(picker, list, 'nothing', later), picker);
  assert.equal(markDeck(closedPicker(), list, idB, later).open, false);
});

test('a pick from the control page is played once, and only while it is under a minute old', () => {
  assert.deepEqual(tidyDeckRequest({ id: idA, requestedAt: '2027-03-03T19:59:30Z' }), { id: idA, requestedAt: '2027-03-03T19:59:30Z' });
  [null, {}, { id: idA }, { id: '../x', requestedAt: '2027-03-03T19:59:30Z' }, { id: idA, requestedAt: 'soon' }].forEach(raw => {
    assert.deepEqual(tidyDeckRequest(raw), { id: '', requestedAt: '' }, JSON.stringify(raw));
  });

  const fresh = tidyDeckRequest({ id: idA, requestedAt: '2027-03-03T19:59:30Z' });
  assert.equal(shouldPlayDeck(fresh, '', now), true);
  assert.equal(shouldPlayDeck(fresh, fresh.requestedAt, now), false, 'the one played before is not played again');
  assert.equal(shouldPlayDeck(tidyDeckRequest({ id: idA, requestedAt: '2027-03-03T19:50:00Z' }), '', now), false, 'ten minutes old');
  assert.equal(shouldPlayDeck(tidyDeckRequest(null), '', now), false);
});

function worldWith(list, answers) {
  return makeWorld([decksRoute, nowRoute], { answers: answers || { presentationsEnabled: { result: true } } }).then(world => {
    world.ctx.state = {};
    if (list !== null) {
      fs.mkdirSync(path.join(world.dataDir, 'decks'));
      fs.writeFileSync(path.join(world.dataDir, 'decks', 'manifest.json'), JSON.stringify(list));
    }
    return world;
  });
}

const report = () => ({ body: { panel: 'tasks' }, headers: { 'x-real-ip': '127.0.0.1' } });

test('the control page gets the list with the words of each deck, and an empty one when the file is missing', async () => {
  const world = await worldWith(manifest({ checkedAt: new Date().toISOString() }));
  const answer = (await world.router.call('GET', '/decks')).json;
  assert.equal(answer.state, 'ok');
  assert.equal(answer.note, '');
  assert.equal(answer.checked, 'Folder checked just now');
  assert.equal(answer.enabled, true);
  assert.equal(answer.wallReporting, false, 'no report from the screen yet');
  assert.deepEqual(answer.decks, [
    { id: idA, name: 'Drive train basics', kind: 'slides', note: '12 slides', canPlay: true },
    { id: idB, name: 'Safety week', kind: 'powerpoint', note: 'Getting ready', canPlay: false },
    { id: idC, name: 'Scouting', kind: 'slides', note: 'Could not be read: not shared', canPlay: false },
  ]);

  const none = (await (await worldWith(null)).router.call('GET', '/decks')).json;
  assert.equal(none.state, 'missing');
  assert.deepEqual(none.decks, []);
  assert.match(none.note, /not ready yet/);

  const offline = await makeWorld([decksRoute], { offline: true });
  assert.equal((await offline.router.call('GET', '/decks')).json.enabled, null, 'Sanity could not be asked');
});

test('Play hands the pick to the screen with its next report, for a minute, and writes nothing to Sanity', async () => {
  const world = await worldWith(manifest());
  assert.deepEqual((await world.router.call('POST', '/now', report())).json, { ok: true }, 'no pick yet');

  const played = await world.router.call('POST', '/decks/play', { body: { id: idA } });
  assert.equal(played.status, 200, JSON.stringify(played.json));
  assert.equal(played.json.name, 'Drive train basics');
  assert.equal(played.json.withinSeconds, 10);
  assert.ok(!world.fetched.some(item => item.url.includes('/data/mutate/')), 'nothing was written to Sanity');

  const answer = (await world.router.call('POST', '/now', report())).json;
  assert.equal(answer.ok, true);
  assert.equal(answer.deck.id, idA);
  assert.equal(shouldPlayDeck(tidyDeckRequest(answer.deck), '', new Date()), true, 'the screen accepts what the service hands it');
  assert.equal((await world.router.call('POST', '/now', report())).json.deck.id, idA, 'it rides on every report while it is new, and the screen plays it once');

  world.ctx.state.deckPick.requestedAt = new Date(Date.now() - (pickSeconds + 5) * 1000).toISOString();
  assert.deepEqual((await world.router.call('POST', '/now', report())).json, { ok: true }, 'an old pick is not handed over');
});

test('Play says why when it cannot: an unknown deck, one that is not ready, presentations off, or a screen that is not reporting', async () => {
  const world = await worldWith(manifest());
  const quiet = await world.router.call('POST', '/decks/play', { body: { id: idA } });
  assert.equal(quiet.status, 409);
  assert.match(quiet.json.error, /not reporting/);
  assert.equal(world.ctx.state.deckPick, undefined);

  await world.router.call('POST', '/now', report());
  const unknown = await world.router.call('POST', '/decks/play', { body: { id: '1ZZZZZZZZZZZZZZZZZZZZ' } });
  assert.equal(unknown.status, 404);
  assert.match(unknown.json.error, /not in the folder any more/);
  assert.equal((await world.router.call('POST', '/decks/play', { body: {} })).status, 404);

  const waiting = await world.router.call('POST', '/decks/play', { body: { id: idB } });
  assert.equal(waiting.status, 409);
  assert.match(waiting.json.error, /not ready yet/);

  const off = await worldWith(manifest(), { presentationsEnabled: { result: false } });
  await off.router.call('POST', '/now', report());
  const refused = await off.router.call('POST', '/decks/play', { body: { id: idA } });
  assert.equal(refused.status, 409);
  assert.match(refused.json.error, /Run presentations is switched off/);
  assert.equal(off.ctx.state.deckPick, undefined);
});

test('the page, the screen and the documents are wired to the same names', () => {
  const show = read('control/static/areas/show.js');
  assert.ok(show.includes("{ id: 'presentations', title: 'Presentations'") && show.includes('mount: mountDecks'));
  const page = read('control/static/tabs/decks.js');
  assert.ok(page.includes("api('GET', '/decks')") && page.includes("api('POST', '/decks/play', { id: deck.id })"));
  assert.ok(!page.includes('innerHTML'), 'file names are written as text, never as markup');

  const run = read('dashboard/core/decks-run.js');
  assert.ok(run.includes("liveFolder + 'decks/manifest.json'") && run.includes('window.addEventListener(answerEvent'));
  assert.ok(read('dashboard/core/now-report.js').includes('new CustomEvent(answerEvent, { detail: answer })'));
  assert.ok(read('dashboard/index.html').includes('<div id="decks" hidden></div>') && read('dashboard/index.html').includes('href="decks.css?v=0"'));
  const shell = read('dashboard/shell.js');
  assert.ok(shell.indexOf("'./core/decks-run.js'") > shell.indexOf("'./core/presentation-run.js'"), 'the list starts after the talk screen, so the key that picks a deck is not its first key');

  const doc = read('docs/presentations-drive.md');
  ['decks-sync.sh', 'install-decks.sh', 'GOOGLE_API_KEY', 'Anyone with the link', 'F5', '20 seconds', 'Run presentations'].forEach(word => assert.ok(doc.includes(word), 'docs/presentations-drive.md should mention ' + word));
  assert.ok(read('docs/presentations.md').includes('docs/presentations-drive.md'));
});

test('a picked deck gives the screen back after its last slide, and shows no slide number', () => {
  const talk = deckTalk(tidyDeckList(manifest()).decks[0], now);
  const input = { now: now, talks: [talk], settings: { presentationsEnabled: true }, skipped: new Set(), announcing: false, slides: { ok: true, pages: ['001.jpg', '002.jpg'] } };
  let state = nextState(nextState(idleState(), input), input);
  assert.equal(state.name, 'presenting');

  state = pressKey(state, 'PageDown', now);
  assert.equal(state.slide, 1);
  assert.equal(chipShown(state, now), false, 'a picked deck shows no slide number');

  const lastByKey = pressKey(state, 'PageDown', now);
  assert.equal(lastByKey.name, 'skipped', 'forward on the last slide ends the deck, with no thanks card');
  assert.equal(nextState(lastByKey, Object.assign({}, input, { skipped: new Set(['deck-' + idA]) })).name, 'idle', 'and the dashboard has the screen again');
  const lastByMouse = pressMouse(state, 'left', now);
  assert.equal(lastByMouse.name, 'skipped', 'a click on the last slide ends it too');
  assert.equal(pressKey(state, 'Escape', now).name, 'skipped');
});

await finish();
