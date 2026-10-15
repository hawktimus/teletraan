// Tests for the places where the lanes of round 5 meet: the preview address of a Photos row, the
// milestone query that the Monday sync writes for, and the announcement plate that the screenshot
// tool looks for.
//
//   node tools/test-integration-round5.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = file => import(pathToFileURL(path.join(root, file)).href);
const { readStill, stillRow } = await load('dashboard/core/still.js');
const { announcement } = await load('tools/screenshots.mjs');
const { contentQuery } = await load('dashboard/core/sanity.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('a Photos row address carries its photos and the seconds of each, and other panels ignore them', () => {
  const row = stillRow(readStill('?panel=photo&photos=3&each=8'));
  assert.equal(row.photoCount, 3);
  assert.equal(row.secondsPerPhoto, 8);
  assert.equal('photoCount' in stillRow(readStill('?panel=photo')), false);
  assert.equal('photoCount' in stillRow(readStill('?panel=tasks&photos=3')), false);
});

test('the content query leaves out a milestone that the Mini switched off', () => {
  assert.ok(contentQuery.includes('*[_type == "milestone" && show != false]'));
});

test('the screenshot tool looks for the element that the dashboard keeps for an announcement', () => {
  const page = fs.readFileSync(path.join(root, 'dashboard/index.html'), 'utf8');
  const runner = fs.readFileSync(path.join(root, 'dashboard/core/notice-run.js'), 'utf8');
  assert.ok(page.includes('id="notice"'));
  assert.ok(runner.includes("addressHas('notice')"));
  assert.ok(announcement.address.includes('notice=1'));
  assert.ok(announcement.selector.startsWith('#notice'));
});

let failed = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('PASS  ' + entry.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + entry.name + '\n        ' + error.message);
  }
}
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' checks passed.');
process.exit(failed === 0 ? 0 : 1);
