// Tests for computer/scripts/pull.sh with real git in a temporary folder: a pull writes version.txt in one step, a pull
// with nothing new says nothing, a left over git lock, a disk with little room and a remote that cannot be reached each
// stop it with a message and change no file.
//
//   node tests/pull.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-pull-'));
const gitEnv = Object.assign({}, process.env, {
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
});

function git(folder, ...args) {
  const result = spawnSync('git', args, { cwd: folder, env: gitEnv, encoding: 'utf8' });
  assert.equal(result.status, 0, 'git ' + args.join(' ') + ': ' + result.stderr);
  return result.stdout.trim();
}

let counter = 0;

// An origin with one commit, a clone of it under root/ that has computer/scripts/pull.sh, and an empty data folder.
function setup() {
  counter += 1;
  const place = path.join(work, 'place' + counter);
  const origin = path.join(place, 'origin.git');
  const seed = path.join(place, 'seed');
  const root = path.join(place, 'root');
  const data = path.join(place, 'data');
  fs.mkdirSync(seed, { recursive: true });
  fs.mkdirSync(data);

  git(place, 'init', '--bare', '--initial-branch=main', origin);
  git(seed, 'init', '--initial-branch=main');
  fs.mkdirSync(path.join(seed, 'computer/scripts'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'computer/scripts/pull.sh'), path.join(seed, 'computer/scripts/pull.sh'));
  fs.copyFileSync(path.join(repoRoot, 'computer/scripts/lib.sh'), path.join(seed, 'computer/scripts/lib.sh'));
  fs.writeFileSync(path.join(seed, 'file.txt'), 'one\n');
  git(seed, 'add', '.');
  git(seed, 'commit', '-m', 'first');
  git(seed, 'remote', 'add', 'origin', origin);
  git(seed, 'push', '-u', 'origin', 'main');
  git(place, 'clone', origin, root);
  fs.writeFileSync(path.join(root, 'computer/local.env'), "TELETRAAN_DATA='" + data + "'\n");

  const bin = path.join(place, 'bin');
  fs.mkdirSync(bin);

  return {
    root: root,
    data: data,
    seed: seed,
    origin: origin,
    // Puts a new commit on the origin
    publish(text) {
      fs.writeFileSync(path.join(seed, 'file.txt'), text);
      git(seed, 'commit', '-am', 'change');
      git(seed, 'push');
    },
    // A df that reports this many kilobytes free
    freeKb(kb) {
      fs.writeFileSync(path.join(bin, 'df'), '#!/bin/sh\necho "Filesystem 1024-blocks Used Available Capacity Mounted"\necho "/dev/fake 100000000 1 ' + kb + ' 1% /"\n', { mode: 0o755 });
    },
    run() {
      const result = spawnSync('/bin/bash', [path.join(root, 'computer/scripts/pull.sh')], {
        cwd: root, env: Object.assign({}, gitEnv, { PATH: bin + ':' + process.env.PATH }), encoding: 'utf8', timeout: 60000,
      });
      return { status: result.status, out: result.stdout, err: result.stderr };
    },
    file() {
      return fs.readFileSync(path.join(root, 'file.txt'), 'utf8');
    },
    version() {
      const file = path.join(data, 'version.txt');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
    },
  };
}

let failures = 0;
let total = 0;
function test(name, run) {
  total += 1;
  try {
    run();
    console.log('ok    ' + name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + name + '\n      ' + (error && error.stack ? error.stack : error));
  }
}

test('a pull brings the new files and writes version.txt, and leaves no temporary file behind', () => {
  const place = setup();
  place.publish('two\n');
  const result = place.run();
  assert.equal(result.status, 0, result.err);
  assert.equal(place.file(), 'two\n');
  assert.equal(place.version(), git(place.root, 'rev-parse', 'HEAD'));
  assert.deepEqual(fs.readdirSync(place.data), ['version.txt']);
});

test('a pull with nothing new says nothing and keeps version.txt', () => {
  const place = setup();
  place.run();
  const before = place.version();
  const result = place.run();
  assert.equal(result.status, 0, result.err);
  assert.equal(result.out, '');
  assert.equal(place.version(), before);
});

test('a git lock left by a power cut stops the pull with a message that says what to do', () => {
  const place = setup();
  place.publish('two\n');
  fs.writeFileSync(path.join(place.root, '.git/index.lock'), '');
  const result = place.run();
  assert.equal(result.status, 1);
  assert.ok(result.err.includes('index.lock') && result.err.includes('Recovering'), result.err);
  assert.equal(place.file(), 'one\n');
});

test('a disk with less than 200 MB free stops the pull before any file is touched', () => {
  const place = setup();
  place.publish('two\n');
  place.freeKb(150000);
  const result = place.run();
  assert.equal(result.status, 1);
  assert.ok(result.err.includes('Less than 200 MB'), result.err);
  assert.equal(place.file(), 'one\n');
  assert.equal(place.version(), null);

  place.freeKb(500000);
  assert.equal(place.run().status, 0, 'with room again the next pull goes ahead');
  assert.equal(place.file(), 'two\n');
});

test('an answer from df that cannot be read does not stop the pull', () => {
  const place = setup();
  place.publish('two\n');
  fs.writeFileSync(path.join(path.dirname(place.root), 'bin/df'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  assert.equal(place.run().status, 0);
  assert.equal(place.file(), 'two\n');
});

test('a remote that cannot be reached fails the pull and keeps the files and version.txt', () => {
  const place = setup();
  place.run();
  const before = place.version();
  fs.renameSync(place.origin, place.origin + '.gone');
  const result = place.run();
  assert.notEqual(result.status, 0);
  assert.equal(place.file(), 'one\n');
  assert.equal(place.version(), before);
});

test('a history that cannot fast-forward stops the pull and changes no file', () => {
  const place = setup();
  fs.writeFileSync(path.join(place.root, 'file.txt'), 'local\n');
  git(place.root, 'commit', '-am', 'local change');
  place.publish('two\n');
  const result = place.run();
  assert.notEqual(result.status, 0);
  assert.ok(result.err.includes('Recovering'), result.err);
  assert.equal(place.file(), 'local\n');
});

fs.rmSync(work, { recursive: true, force: true });
console.log('\n' + (total - failures) + ' of ' + total + ' passed');
if (failures > 0) process.exitCode = 1;
