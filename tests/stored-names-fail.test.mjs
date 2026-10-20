// Tests the test of the stored names: in a copy of the Studio, a renamed field, a removed field and a removed choice
// must fail tests/stored-names.test.mjs with a plain message, a new field must pass with a note, and --add must
// write the new name and never remove one.
//
//   node tests/stored-names-fail.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const tests = [];
const test = (name, run) => tests.push({ name: name, run: run });
const copies = [];

function copy(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-names-' + name + '-'));
  fs.cpSync(path.join(repo, 'studio'), path.join(root, 'studio'), { recursive: true, filter: file => !file.includes('node_modules') });
  fs.mkdirSync(path.join(root, 'tests/helpers'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tests/data'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'tests/stored-names.test.mjs'), path.join(root, 'tests/stored-names.test.mjs'));
  fs.copyFileSync(path.join(repo, 'tests/helpers/studio-world.mjs'), path.join(root, 'tests/helpers/studio-world.mjs'));
  fs.copyFileSync(path.join(repo, 'tests/data/stored-names.txt'), path.join(root, 'tests/data/stored-names.txt'));
  copies.push(root);
  return root;
}

const edit = (root, file, from, to) => {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, 'utf8');
  assert.ok(text.includes(from), file + ' no longer has ' + from + ', so this test must be updated');
  fs.writeFileSync(full, text.replace(from, to));
};

const run = (root, ...args) => {
  const result = spawnSync(process.execPath, [path.join(root, 'tests/stored-names.test.mjs')].concat(args), { encoding: 'utf8', env: Object.assign({}, process.env, { TELETRAAN_RUNNER: '' }) });
  return { code: result.status, text: result.stdout + result.stderr };
};

test('the schemas as they are pass', () => {
  const result = run(copy('clean'));
  assert.equal(result.code, 0, result.text);
});

test('a renamed field fails and names the old name and the new one', () => {
  const root = copy('rename');
  edit(root, 'studio/schemas/task.js', "name: 'dueDate'", "name: 'dueOn'");
  const result = run(root);
  assert.equal(result.code, 1);
  assert.match(result.text, /FAIL {2}a name stored in Sanity was removed or renamed/);
  assert.match(result.text, /"task\.dueDate" is gone \(renamed to one of: task\.dueOn/);
  assert.match(result.text, /Do instead: put the old name back/);
});

test('a removed choice fails', () => {
  const root = copy('choice');
  edit(root, 'studio/schemas/task.js', "value: 'in-review'", "value: 'reviewing'");
  const result = run(root);
  assert.equal(result.code, 1);
  assert.match(result.text, /"task\.status = in-review" is gone/);
});

test('a new field passes with a note, --add writes it, and no name is ever taken off the list', () => {
  const root = copy('add');
  assert.equal(run(root, '--add').code, 0); // the list first holds every name there is, so the one new field is the only one
  edit(root, 'studio/schemas/task.js', "defineField({\n    name: 'dueDate'", "defineField({\n    name: 'roomNumber',\n    type: 'string',\n  }),\n  defineField({\n    name: 'dueDate'");
  const before = run(root);
  assert.equal(before.code, 0, before.text);
  assert.match(before.text, /note {2}1 names are not on the list yet, such as task\.roomNumber/);

  const list = path.join(root, 'tests/data/stored-names.txt');
  fs.appendFileSync(list, 'task.aNameThatWasRetired\n');
  assert.equal(run(root).code, 1, 'a name on the list that no schema has is a failure');
  fs.writeFileSync(list, fs.readFileSync(list, 'utf8').replace('task.aNameThatWasRetired\n', ''));

  assert.equal(run(root, '--add').code, 0);
  assert.ok(fs.readFileSync(list, 'utf8').split('\n').includes('task.roomNumber'));
  assert.equal(run(root).code, 0);
});

let failed = 0;
for (const item of tests) {
  try {
    item.run();
    console.log('ok    ' + item.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + item.name + '\n' + error.message);
  }
}
copies.forEach(root => fs.rmSync(root, { recursive: true, force: true }));
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' tests passed.');
process.exitCode = failed > 0 ? 1 : 0;
