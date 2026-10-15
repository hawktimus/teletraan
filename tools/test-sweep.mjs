// Tests for tools/sweep.sh and the pre-push hook: a tracked file with a word of the list is a hit and exits 1, a clean
// repository exits 0, the word list itself and untracked files are left alone, names with a space are looked at, and the
// real repository is clean. The words in this file are built from pieces so that the sweep does not find them here.
//
//   node tools/test-sweep.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-sweep-'));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const tool = ['cla', 'ude'].join('');
const trailer = ['Co-Authored', 'By'].join('-');
const franchise = ['Star', 'Wars'].join(' ');

const gitEnv = Object.assign({}, process.env, {
  GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.invalid',
});

// A small repository with the sweep and the real word list in it, and these files tracked
function place(name, files, untracked = {}) {
  const root = path.join(work, name);
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'tools/sweep.sh'), path.join(root, 'tools/sweep.sh'));
  fs.copyFileSync(path.join(repo, 'tools/sweep-words.txt'), path.join(root, 'tools/sweep-words.txt'));
  Object.keys(files).forEach(file => fs.writeFileSync(path.join(root, file), files[file]));
  const git = args => assert.equal(spawnSync('git', ['-C', root].concat(args), { env: gitEnv, encoding: 'utf8' }).status, 0);
  git(['init', '-q']);
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'first']);
  Object.keys(untracked).forEach(file => fs.writeFileSync(path.join(root, file), untracked[file]));
  return spawnSync('/bin/sh', [path.join(root, 'tools/sweep.sh')], { cwd: root, encoding: 'utf8' });
}

test('a clean repository passes', () => {
  const result = place('clean', { 'a.txt': 'Robots build things.\n' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('clean'));
});

test('a tool name, a trailer and a franchise in tracked files are hits that name the file and the line, and the exit code is 1', () => {
  const result = place('hits', { 'a.txt': 'fine\nmade with ' + tool + '\n', 'b.md': trailer + ': someone <x@example.invalid>\n', 'c.txt': 'a ' + franchise.toLowerCase() + ' joke\n' });
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes('a.txt:2:'), result.stdout);
  assert.ok(result.stdout.includes('b.md:1:'), result.stdout);
  assert.ok(result.stdout.includes('c.txt:1:'), result.stdout);
});

test('a word inside a longer word is not a hit, and a file name with a space is looked at', () => {
  assert.equal(place('inside', { 'a.txt': 'the claudette plan\n' }).status, 0);
  const spaced = place('spaced', { 'My File.txt': tool + '\n' });
  assert.equal(spaced.status, 1);
  assert.ok(spaced.stdout.includes('My File.txt:1:'), spaced.stdout);
});

test('the word list is left out, and a file that is not tracked is not looked at', () => {
  const result = place('left-out', { 'a.txt': 'fine\n' }, { 'untracked.txt': tool + '\n' });
  assert.equal(result.status, 0, result.stdout);
  assert.ok(read('tools/sweep-words.txt').toLowerCase().includes(tool), 'the list holds the words');
});

test('a missing word list is an error and not a pass', () => {
  const root = path.join(work, 'no-list');
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'tools/sweep.sh'), path.join(root, 'tools/sweep.sh'));
  const result = spawnSync('/bin/sh', [path.join(root, 'tools/sweep.sh')], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 2);
});

test('the pre-push hook runs the sweep, and the coaches guide says how to turn it on', () => {
  const hook = read('.githooks/pre-push');
  assert.ok(hook.includes('tools/sweep.sh'));
  assert.ok(fs.statSync(path.join(repo, '.githooks/pre-push')).mode & 0o100, 'the hook can be run');
  assert.ok(fs.statSync(path.join(repo, 'tools/sweep.sh')).mode & 0o100, 'the sweep can be run');
  assert.ok(read('docs/coaches-guide.md').includes('git config core.hooksPath .githooks'));
});

test('no tracked file of the repository holds a word of the list', () => {
  const result = spawnSync('/bin/sh', [path.join(repo, 'tools/sweep.sh')], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
