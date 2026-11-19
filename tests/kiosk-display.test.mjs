// Tests for kiosk_display in computer/scripts/lib.sh: which X screen the display scripts look at.
// A copy of lib.sh sits in a temporary computer/ folder with its own local.env, and TELETRAAN_X_DIR points at a folder
// that holds the fake X sockets, so nothing here reads the real computer.
//
//   node tests/kiosk-display.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-kiosk-display-'));
const scripts = path.join(work, 'computer/scripts');
const xDir = path.join(work, 'x11');
fs.mkdirSync(scripts, { recursive: true });
fs.mkdirSync(xDir);
fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(scripts, 'lib.sh'));

function writeEnv(text) {
  fs.writeFileSync(path.join(work, 'computer/local.env'), text);
}

// lib.sh finds local.env from the path of the script that reads it, so it is read from a script, as the real ones do.
fs.writeFileSync(path.join(scripts, 'ask.sh'), '#!/bin/bash\nset -euo pipefail\n. "$(dirname "$0")/lib.sh"\nkiosk_display\n');

function ask() {
  const run = spawnSync('bash', [path.join(scripts, 'ask.sh')], {
    env: { ...process.env, TELETRAAN_X_DIR: xDir },
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('no setting and no running screen gives :1', () => {
  writeEnv('SOMETHING_ELSE=1\n');
  assert.equal(ask(), ':1');
});

const server = net.createServer();
await new Promise((resolve) => server.listen(path.join(xDir, 'X0'), resolve));

check('no setting uses the screen that is running', () => {
  assert.equal(ask(), ':0');
});

check('the KIOSK_DISPLAY line wins over the running screen', () => {
  writeEnv("KIOSK_DISPLAY=':1'\n");
  assert.equal(ask(), ':1');
});

check('a missing local.env still finds the running screen', () => {
  fs.rmSync(path.join(work, 'computer/local.env'));
  assert.equal(ask(), ':0');
});

server.close();
fs.rmSync(work, { recursive: true, force: true });
console.log(`${passed} passed`);
