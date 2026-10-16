// Every script in computer/scripts starts the same way: bash, a one-line usage, set -euo pipefail and the shared
// lib.sh, which holds the one reader of local.env and the one reader of dashboard/config.js.
//
//   node tests/computer-scripts.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const folder = path.join(repo, 'computer/scripts');
// Files that other scripts read: lib.sh, display.sh and the parts of monday-sync.sh and frc-sync.sh
const library = fs.readdirSync(folder).filter(name => name === 'lib.sh' || name === 'display.sh' || /^(monday|frc)-(?!sync\.sh)/.test(name));
const scripts = fs.readdirSync(folder).filter(name => name.endsWith('.sh') && !library.includes(name)).sort();

function read(name) {
  return fs.readFileSync(path.join(folder, name), 'utf8');
}

test('every script starts with bash, one usage line, set -euo pipefail and lib.sh', () => {
  assert.ok(scripts.length >= 20, 'the scripts are found');
  scripts.forEach(name => {
    const lines = read(name).split('\n');
    assert.equal(lines[0], '#!/bin/bash', name);
    assert.match(lines[1], /^# Usage: \S/, name + ' has a usage line');
    const strict = lines.indexOf('set -euo pipefail');
    assert.ok(strict > 1, name + ' has set -euo pipefail');
    assert.equal(lines[strict + 1], '. "$(dirname "$0")/lib.sh"', name + ' reads lib.sh next');
  });
});

test('the local.env reader and the config.js reader are in lib.sh and nowhere else', () => {
  const holders = (pattern) => scripts.concat(library).filter(name => pattern.test(read(name)));
  assert.deepEqual(holders(/^setting\(\) \{/m), ['lib.sh']);
  assert.deepEqual(holders(/^config_value\(\) \{/m), ['lib.sh']);
  assert.deepEqual(holders(/^env_file=/m), ['lib.sh']);
});

test('every script and the library have valid syntax', () => {
  scripts.concat(library).forEach(name => {
    const result = spawnSync('bash', ['-n', path.join(folder, name)], { encoding: 'utf8' });
    assert.equal(result.status, 0, name + ': ' + result.stderr);
  });
});

finish();
