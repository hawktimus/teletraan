// Tests for computer/apps-script/decks-feed.gs, the Google Apps Script a coach pastes into script.google.com.
// The Google services it uses (DriveApp, PropertiesService, ContentService, Utilities) are replaced with small
// fakes, and the script runs in a sandbox, so nothing touches Google.
//
//   node tests/decks-feed.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const source = fs.readFileSync(path.join(repo, 'computer/apps-script/decks-feed.gs'), 'utf8');

const slides = 'application/vnd.google-apps.presentation';
const folder = '1FolderFolderFolderFolder';
const other = '1OtherOtherOtherOtherOther';
const secret = 'FAKESECRET_abcdefghijklmnopqrstuvwxyz';
const idA = '1AAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const idB = '1BBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function file(id, name, type, updated, parent) {
  return { id, name, type, updated: new Date(updated), parent, bytes: [37, 80, 68, 70, 45, 49] };
}

const library = [
  file(idA, 'Drive train basics', slides, '2027-03-01T10:00:00Z', folder),
  file(idB, 'Safety week', slides, '2027-03-02T10:00:00Z', folder),
  file('1CCCCCCCCCCCCCCCCCCCCCCCCCCCC', 'Budget', 'application/vnd.google-apps.spreadsheet', '2027-03-03T10:00:00Z', folder),
  file('1DDDDDDDDDDDDDDDDDDDDDDDDDDDD', 'Elsewhere', slides, '2027-03-04T10:00:00Z', other),
];

// The slides of a deck, as true when the slide is marked Skip slide
library[0].slides = [false, true, false];
library[1].slides = [false, false, false, false];
library[2].slides = [false];
library[3].slides = [false, true];

function iterator(items) {
  let index = 0;
  return { hasNext: () => index < items.length, next: () => items[index++] };
}

function wrap(item) {
  return {
    getId: () => item.id,
    getName: () => item.name,
    getMimeType: () => item.type,
    getLastUpdated: () => item.updated,
    getParents: () => iterator([{ getId: () => item.parent }]),
    getAs: type => ({ getBytes: () => (type === 'application/pdf' ? item.bytes : []) }),
  };
}

function load(properties) {
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => (name in properties ? properties[name] : null) }) },
    ContentService: {
      MimeType: { JSON: 'JSON', TEXT: 'TEXT' },
      createTextOutput: text => ({ text, kind: '', setMimeType(kind) { this.kind = kind; return this; }, getContent() { return this.text; } }),
    },
    MimeType: { GOOGLE_SLIDES: slides, PDF: 'application/pdf' },
    Utilities: { base64Encode: bytes => Buffer.from(bytes).toString('base64') },
    DriveApp: {
      getFolderById: id => ({ getFilesByType: type => iterator(library.filter(item => item.parent === id && item.type === type).map(wrap)) }),
      getFileById: id => {
        const found = library.find(item => item.id === id);
        if (!found) throw new Error('No item with the given ID could be found');
        return wrap(found);
      },
    },
    SlidesApp: {
      openById: id => {
        context.opened.push(id);
        const found = library.find(item => item.id === id);
        if (!found || !found.slides) throw new Error('Slides cannot open ' + id);
        return { getSlides: () => found.slides.map(hidden => ({ isSkipped: () => hidden })) };
      },
    },
    opened: [],
    logged: [],
    Date,
    JSON,
    Logger: { log: text => context.logged.push(text) },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

const good = { SECRET: secret, FOLDER_ID: folder };
const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

function ask(context, parameter) {
  return context.doGet({ parameter });
}

test('it answers denied to a wrong, missing or unset secret, and never lists anything', () => {
  const script = load(good);
  [undefined, '', 'wrong', secret.slice(0, -1), secret + 'x'].forEach(given => {
    assert.equal(ask(script, { action: 'list', folder, secret: given }).text, '{"error":"denied"}', String(given));
  });
  assert.equal(script.doGet({}).text, '{"error":"denied"}');
  assert.equal(ask(load({ FOLDER_ID: folder }), { action: 'list', folder, secret: 'anything' }).text, '{"error":"denied"}', 'no secret set: nothing is open');
  assert.equal(ask(load({ SECRET: secret }), { action: 'list', folder, secret }).text, '{"error":"denied"}', 'no folder set: nothing is open');
});

test('it lists only the Google Slides decks of its own folder, newest first, in the shape of the Drive API', () => {
  const answer = JSON.parse(ask(load(good), { action: 'list', folder, secret }).text);
  assert.deepEqual(answer, {
    files: [
      { id: idB, name: 'Safety week', mimeType: slides, modifiedTime: '2027-03-02T10:00:00.000Z' },
      { id: idA, name: 'Drive train basics', mimeType: slides, modifiedTime: '2027-03-01T10:00:00.000Z' },
    ],
  });
});

test('a folder other than its own is refused, even with the right secret', () => {
  assert.equal(ask(load(good), { action: 'list', folder: other, secret }).text, '{"error":"wrong-folder"}');
  assert.equal(ask(load(good), { action: 'pdf', id: idA, folder: other, secret }).text, '{"error":"wrong-folder"}');
  assert.equal(ask(load(good), { action: 'list', secret }).text, '{"error":"wrong-folder"}');
});

test('it sends the PDF of a deck in its folder as base64 text', () => {
  const answer = ask(load(good), { action: 'pdf', id: idA, folder, secret });
  assert.equal(answer.kind, 'TEXT');
  assert.equal(Buffer.from(answer.text, 'base64').toString('latin1'), '%PDF-1');
});

test('it never sends a file that is not a Slides deck of its folder, or an id that is not an id', () => {
  const script = load(good);
  ['1CCCCCCCCCCCCCCCCCCCCCCCCCCCC', '1DDDDDDDDDDDDDDDDDDDDDDDDDDDD', '1MissingMissingMissing'].forEach(id => {
    assert.equal(ask(script, { action: 'pdf', id, folder, secret }).text, '{"error":"not-found"}', id);
  });
  ['', '../../x', 'a b', undefined].forEach(id => {
    assert.equal(ask(script, { action: 'pdf', id, folder, secret }).text, '{"error":"not-found"}', String(id));
  });
  assert.equal(ask(script, { action: 'delete', folder, secret }).text, '{"error":"bad-action"}');
});

test('it says how many slides a deck has and which are hidden, counted from 1', () => {
  const script = load(good);
  assert.deepEqual(JSON.parse(ask(script, { action: 'skipped', id: idA, folder, secret }).text), { count: 3, skipped: [2] });
  assert.deepEqual(JSON.parse(ask(script, { action: 'skipped', id: idB, folder, secret }).text), { count: 4, skipped: [] });
  assert.equal(ask(script, { action: 'skipped', id: idA, folder, secret }).kind, 'JSON');
});

test('it opens only a Slides deck of its own folder to read the hidden slides, and only for the right secret', () => {
  const script = load(good);
  ['1CCCCCCCCCCCCCCCCCCCCCCCCCCCC', '1DDDDDDDDDDDDDDDDDDDDDDDDDDDD', '1MissingMissingMissing', '', '../x', undefined].forEach(id => {
    assert.equal(ask(script, { action: 'skipped', id, folder, secret }).text, '{"error":"not-found"}', String(id));
  });
  assert.equal(ask(script, { action: 'skipped', id: idA, folder: other, secret }).text, '{"error":"wrong-folder"}');
  assert.equal(ask(script, { action: 'skipped', id: idA, folder, secret: 'wrong' }).text, '{"error":"denied"}');
  assert.deepEqual(script.opened, [], 'no deck outside the folder, and nothing without the secret, is ever opened');
});

test('check() says how many decks it sees and how many slides of the newest are hidden', () => {
  const script = load(good);
  script.check();
  assert.equal(script.logged[0], 'Decks seen in the folder: 2');
  assert.ok(script.logged[1].includes('{"count":4,"skipped":[]}'), script.logged[1]);
});

test('a list answers as JSON, and an error inside Google becomes an error answer, not a crash', () => {
  assert.equal(ask(load(good), { action: 'list', folder, secret }).kind, 'JSON');
  const script = load(good);
  script.DriveApp.getFolderById = () => { throw new Error('Access denied: DriveApp'); };
  assert.equal(ask(script, { action: 'list', folder, secret }).text, '{"error":"failed"}');
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
