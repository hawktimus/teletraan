// Tests that install-remote.sh is one of the steps of Install everything and is safe in it: without SANITY_WRITE_TOKEN in
// local.env it says so in one plain line, changes nothing and ends with success, so the rest of the install goes on. The
// script is run from a copy of the computer folder with a made-up local.env. The Mac tool, computer/install.sh and the
// docs name the script (the Mac tool's order is also pinned in tests/teletraan-tool.test.mjs).
//
//   node tests/install-remote.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-install-remote-')));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  console.log('PASS  ' + name);
}

let counter = 0;
// A copy of the computer folder, with a local.env of the text given (or none)
function place(envText) {
  counter += 1;
  const folder = path.join(work, 'c' + counter);
  fs.cpSync(path.join(repo, 'computer'), path.join(folder, 'computer'), { recursive: true, filter: source => !source.endsWith('local.env') });
  if (envText !== null) fs.writeFileSync(path.join(folder, 'computer/local.env'), envText);
  const result = spawnSync('/bin/bash', [path.join(folder, 'computer/scripts/install-remote.sh')], { encoding: 'utf8', input: '\n' });
  return { status: result.status, text: result.stdout, errors: result.stderr };
}

check('with no local.env, or no SANITY_WRITE_TOKEN in it, it prints one plain line, installs nothing and succeeds', () => {
  [null, '', 'OTHER_KEY=x\n', 'SANITY_WRITE_TOKEN=\n'].forEach(text => {
    const run = place(text);
    assert.equal(run.status, 0, run.errors);
    assert.equal(run.text.trim().split('\n').length, 1, 'one line');
    assert.match(run.text, /SANITY_WRITE_TOKEN is not in local\.env yet, so the remote action service was not installed/);
    assert.equal(run.errors, '');
  });
});

check('with the key present it goes on to the checks that need root (and stops there when it is not run with sudo)', () => {
  const run = place('SANITY_WRITE_TOKEN=made-up-value-for-a-test\n');
  assert.notEqual(run.status, 0);
  assert.ok(!run.text.includes('made-up-value') && !run.errors.includes('made-up-value'), 'the value is never printed');
  assert.ok(/has to run with sudo|node is not installed/.test(run.errors), run.errors);
});

check('Install everything in the Mac tool and computer/install.sh both run it', () => {
  assert.match(read('tools/teletraan/teletraan-tool-deploy.sh'), /cleanup remote sync; do/);
  assert.match(read('computer/install.sh'), /install-remote\.sh/);
  assert.match(read('computer/install.sh'), /install-remote\.sh stopped \(exit \$\?\)\. Run it again by hand/);
});

check('the docs say that Install everything installs it and what happens without the key', () => {
  assert.match(read('docs/updating-the-computer.md'), /install-remote\.sh/);
  assert.match(read('docs/OPERATIONS.md'), /prints one line and installs nothing/);
});

console.log(passed + ' of ' + passed + ' checks passed.');
