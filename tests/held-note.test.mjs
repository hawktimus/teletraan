// Tests the note for a held view that has nothing to show (dashboard/core/held-note.js, now-report-parts.js,
// control/static/tabs/render.js). Nothing is drawn.
//
//   node tests/held-note.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-held-note-'));
fs.mkdirSync(path.join(work, 'dashboard/core'), { recursive: true });
fs.writeFileSync(path.join(work, 'package.json'), '{ "type": "module" }\n');
['held-note.js', 'now-report-parts.js'].forEach(file => copyModule(path.join(root, 'dashboard/core', file), path.join(work, 'dashboard/core', file)));
const base = pathToFileURL(path.join(work, 'dashboard/core')).href + '/';
const { heldNoteFor } = await import(base + 'held-note.js');
const { cleanReport, makeReport } = await import(base + 'now-report-parts.js');

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('a held view with no steps and only Monday rows says no Monday task is on the TV', () => {
  const note = heldNoteFor('Condensed', [], [{ panel: 'monday-overall' }, { panel: 'monday-status-depts' }]);
  assert.equal(note, 'The held view Condensed has nothing to show: no Monday task is on the TV. The wall stays on the schedule.');
});

test('a held view with no steps and other rows gives the general reason', () => {
  assert.match(heldNoteFor('Prime', [], [{ panel: 'roster' }]), /has no rows with something to show/);
  assert.match(heldNoteFor('Prime', [], []), /has nothing to show/);
});

test('a view with steps, or no view, has no note', () => {
  assert.equal(heldNoteFor('Prime', [{ panel: 'roster' }], [{ panel: 'roster' }]), '');
  assert.equal(heldNoteFor('', [], []), '');
});

test('the report keeps the note, cut to 200 characters, and an old report has an empty one', () => {
  assert.equal(cleanReport({ heldNote: 'x'.repeat(300) }).heldNote.length, 200);
  assert.equal(cleanReport({}).heldNote, '');
  assert.equal(makeReport({ heldNote: 'a note', requests: {} }).heldNote, 'a note');
});

test('the Now showing card shows the note under the Hold row, and only when there is one', () => {
  const text = fs.readFileSync(path.join(root, 'control/static/tabs/render.js'), 'utf8');
  assert.ok(text.indexOf("row('Held view'") > text.indexOf("row('Hold'"));
  assert.ok(text.includes('report.heldNote ?'));
});

test('the Studio view preview says a view with no data cannot show', () => {
  assert.match(fs.readFileSync(path.join(root, 'studio/tools/actions.js'), 'utf8'), /A view with no data cannot show/);
});

let failed = 0;
for (const { name, run } of tests) {
  try { await run(); console.log('ok   ' + name); } catch (error) { failed++; console.log('FAIL ' + name + '\n' + error.message); }
}
fs.rmSync(work, { recursive: true, force: true });
console.log(tests.length - failed + ' of ' + tests.length + ' passed');
process.exit(failed === 0 ? 0 : 1);
