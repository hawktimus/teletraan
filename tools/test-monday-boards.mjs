// Tests for the rows and lines of the Monday Boards page in Studio (studio/monday-boards-parts.js):
// which boards are listed and in what order, what a row says about its items, its last read and
// whether Dashboard Settings has chosen it, and what the page does with a document of an odd shape.
// The helpers are plain functions, so nothing is installed and nothing touches the network. The page
// that draws them, and the reading of the two documents, are checked by studio/check-schemas.mjs.
//
//   node tools/test-monday-boards.mjs

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const studio = path.join(root, 'studio');
const parts = await import(pathToFileURL(path.join(studio, 'monday-boards-parts.js')).href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const now = new Date('2026-10-09T15:00:00.000Z');
const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();

const status = {
  lastSyncAt: ago(2),
  boards: [
    { id: '111', name: 'Build board', itemCount: 12 },
    { id: '222', name: 'Outreach board', itemCount: 1 },
    { id: '333', name: 'Parts board', itemCount: 0 },
  ],
  readings: [
    { boardId: '111', itemsRead: 12, readAt: ago(5), note: '' },
    { boardId: '444', itemsRead: 0, readAt: ago(5), note: 'monday gave no items for this board' },
  ],
};

function rowFor(rows, id) {
  return rows.filter(row => row.id === id)[0];
}

test('the chosen boards come first, then the others, each in the order the Mini wrote them', () => {
  const rows = parts.rowsOf(status, [{ boardId: '333', team: 'NOVA' }, { boardId: '111', team: 'PRIME' }], now);
  assert.deepEqual(rows.map(row => row.id), ['111', '333', '222']);
});

test('a row says the name, the items and whether the board is chosen and for which team', () => {
  const rows = parts.rowsOf(status, [{ boardId: '111', team: 'PRIME' }, { boardId: '333', team: '' }], now);
  const build = rowFor(rows, '111');

  assert.equal(build.name, 'Build board');
  assert.equal(build.items, '12 items');
  assert.equal(parts.chosenText(build), 'Chosen for PRIME');
  assert.equal(rowFor(rows, '222').items, '1 item', 'one item is not items');
  assert.equal(rowFor(rows, '333').items, '0 items');
  assert.equal(parts.chosenText(rowFor(rows, '333')), 'Chosen for both teams');
  assert.equal(parts.chosenText(rowFor(rows, '222')), 'Not chosen');
});

test('a chosen board says when it was last read, and a board that is not chosen says Not read', () => {
  const rows = parts.rowsOf(status, [{ boardId: '111', team: 'PRIME' }, { boardId: '333', team: 'PRIME' }], now);

  assert.equal(rowFor(rows, '111').read, 'Read 5 minutes ago');
  assert.equal(rowFor(rows, '333').read, 'Not read yet', 'chosen, and the Mini has no reading of it yet');
  assert.equal(rowFor(rows, '222').read, 'Not read');
});

test('only a chosen board that the token can see opens its tasks', () => {
  const rows = parts.rowsOf(status, [{ boardId: '111', team: 'PRIME' }, { boardId: '999', team: 'NOVA' }], now);

  assert.equal(rowFor(rows, '111').opens, true);
  assert.equal(rowFor(rows, '222').opens, false, 'not chosen');
  assert.equal(rowFor(rows, '999').opens, false, 'the token cannot see it');
});

test('a chosen board the token cannot see has a row with the reason, named by its number', () => {
  const rows = parts.rowsOf(status, [{ boardId: '999', team: 'NOVA' }], now);
  const missing = rowFor(rows, '999');

  assert.equal(missing.name, 'Board 999');
  assert.equal(missing.visible, false);
  assert.equal(missing.items, 'Items not counted');
  assert.equal(missing.note, 'The token cannot see this board, or the board number is wrong.');
  assert.equal(rows.length, 4);
});

test('the note of a reading is a sentence under its board', () => {
  const rows = parts.rowsOf(status, [{ boardId: '444', team: 'PRIME' }], now);
  assert.equal(rowFor(rows, '444').note, 'The token cannot see this board, or the board number is wrong.', 'a board that is not in the list gets the fixed reason');

  const seen = { boards: [{ id: '444', name: 'Parts', itemCount: 3 }], readings: [{ boardId: '444', itemsRead: 0, readAt: ago(1), note: 'monday gave no items for this board' }] };
  assert.equal(rowFor(parts.rowsOf(seen, [{ boardId: '444' }], now), '444').note, 'Monday gave no items for this board.');
  assert.equal(rowFor(parts.rowsOf(seen, [], now), '444').note, '', 'a board that is not chosen has no note');
});

test('a board with no name is named by its number, and a document of an odd shape is read as having nothing', () => {
  const rows = parts.rowsOf({ boards: [null, 'text', { id: 5 }, { id: '7', name: '', itemCount: 'many' }, { id: '' }], readings: 'text' }, [null, { boardId: 3 }, { boardId: '' }], now);

  assert.deepEqual(rows.map(row => [row.id, row.name, row.items, row.read]), [['7', 'Board 7', 'Items not counted', 'Not read']]);
  assert.deepEqual(parts.rowsOf(null, undefined, now), []);
  assert.deepEqual(parts.rowsOf('text', 'text', now), []);
});

test('the page says when the Mini last read Monday and what went wrong last, and nothing when it has no time or no error', () => {
  assert.equal(parts.updatedText(status, now), 'The Mini last read Monday 2 minutes ago.');
  assert.equal(parts.updatedText({}, now), '');
  assert.equal(parts.updatedText(null, now), '');

  assert.equal(parts.errorText({ lastError: 'monday refused the token' }), 'Monday refused the token.');
  assert.equal(parts.errorText({ lastError: 'Too many requests.' }), 'Too many requests.');
  assert.equal(parts.errorText({ lastError: '  ' }), '');
  assert.equal(parts.errorText({}), '');
  assert.equal(parts.errorText(null), '');
});

test('Choose boards goes to the board rows of Dashboard Settings, and the words are plain', () => {
  assert.deepEqual(parts.chooseTarget, { id: 'dashboardSettings', type: 'dashboardSettings', path: 'mondayBoards' });
  assert.equal(parts.chooseLabel, 'Choose boards');
  assert.equal(parts.mondayStatusId, 'monday-status');

  [parts.helpLine, parts.nothingYet, parts.noBoardsLine, parts.openLine, parts.publicLine, parts.unreadableLine, parts.settingsUnreadableLine].forEach(text => {
    assert.ok(!/[\u2014\u2013!]/.test(text), text);
    text.split(/[.?]\s+|[.?]$/).forEach(sentence => assert.ok(sentence.trim().split(/\s+/).length <= 20, sentence));
  });
});

test('the questions ask only for what the page shows, and the board rows come with the short name of the team', () => {
  assert.ok(parts.statusQuestion.includes('boards[]') && parts.statusQuestion.includes('readings[]') && parts.statusQuestion.includes('itemCount'));
  assert.ok(!parts.statusQuestion.includes('columns'), 'the columns of a board are not needed here');
  assert.ok(parts.entriesQuestion.includes('mondayBoards[]') && parts.entriesQuestion.includes('shortName'));
});

let failures = 0;
for (const entry of tests) {
  try {
    entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name);
    console.log(error);
  }
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
