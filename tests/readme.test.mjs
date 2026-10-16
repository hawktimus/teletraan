// The README names every folder of the repository and everything in tools/, and the coaches guide has the
// same table, so the two cannot drift apart.
//
//   node tests/readme.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const readme = fs.readFileSync(path.join(repo, 'README.md'), 'utf8');
const coaches = fs.readFileSync(path.join(repo, 'docs/coaches-guide.md'), 'utf8');

function tableOf(text) {
  const start = text.indexOf('| Folder | What it holds |');
  assert.ok(start !== -1, 'a Folder table');
  const end = text.indexOf('\n\n', start);
  return text.slice(start, end);
}

test('the README table has a line for each folder of the repository', () => {
  const table = tableOf(readme);
  ['dashboard', 'studio', 'control', 'mini', 'tools', 'tests', 'docs'].forEach(folder => {
    assert.ok(table.includes('| `' + folder + '/` |'), folder + ' has a line');
    assert.ok(fs.statSync(path.join(repo, folder)).isDirectory(), folder + ' exists');
  });
});

test('the line for tools/ names everything in tools/', () => {
  const line = tableOf(readme).split('\n').find(row => row.startsWith('| `tools/` |'));
  fs.readdirSync(path.join(repo, 'tools')).filter(name => name !== 'package.json').forEach(name => {
    assert.ok(line.includes(name), 'the tools line names ' + name);
  });
});

test('the coaches guide has the table of the README', () => {
  assert.equal(tableOf(coaches), tableOf(readme));
});

test('the README names no folder that is gone', () => {
  assert.ok(!/`deploy\//.test(readme), 'no deploy/ folder');
  assert.ok(!readme.includes('studio/README.md'), 'no studio/README.md');
});

finish();
