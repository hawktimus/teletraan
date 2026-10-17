// The git path: computer/git/post-receive runs the install through sudo -n and the root wrapper, never through docker,
// and computer/git/install-tree-as-root.sh refuses what it should before it reads its config or runs docker.
// sudo, docker and git are fakes on the PATH or real throwaway repositories; nothing on this computer changes.
//
//   node tests/git-hook.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-hook-'));
const hook = path.join(repo, 'computer/git/post-receive');
const wrapper = path.join(repo, 'computer/git/install-tree-as-root.sh');
let count = 0;

function fakes(sudoBody) {
  const base = path.join(work, 'case' + count++);
  const bin = path.join(base, 'bin');
  const log = path.join(base, 'calls.log');
  fs.mkdirSync(bin, { recursive: true });
  const put = (name, text) => fs.writeFileSync(path.join(bin, name), text, { mode: 0o755 });
  put('sudo', '#!/bin/sh\necho "sudo $*" >> "' + log + '"\n' + sudoBody);
  put('docker', '#!/bin/sh\necho "docker $*" >> "' + log + '"\nexit 0\n');
  return { base: base, bin: bin, log: log, calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '') };
}

// A bare repository with one commit on main, and the line git gives a post-receive hook
function pushed(base) {
  const bare = path.join(base, 'bare.git');
  const clone = path.join(base, 'clone');
  const git = (cwd, ...args) => spawnSync('git', args, { cwd: cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  git(base, 'init', '--bare', '--initial-branch=main', bare);
  git(base, 'init', '--initial-branch=main', clone);
  fs.writeFileSync(path.join(clone, 'a.txt'), 'a');
  git(clone, 'add', '.');
  git(clone, 'commit', '-m', 'first');
  git(clone, 'push', bare, 'main');
  const sha = git(bare, 'rev-parse', 'main').stdout.trim();
  return { bare: bare, sha: sha };
}

function runHook(f, ref = 'refs/heads/main') {
  const p = pushed(f.base);
  const result = spawnSync('sh', [hook], { cwd: p.bare, input: '0000 ' + p.sha + ' ' + ref + '\n', encoding: 'utf8', env: { PATH: f.bin + ':' + process.env.PATH, HOME: f.base } });
  return { status: result.status, text: result.stdout + result.stderr, sha: p.sha };
}

test('the hook calls sudo -n with the wrapper path, a staging folder and a short commit, and never docker', () => {
  const f = fakes('exit 0\n');
  const r = runHook(f);
  assert.equal(r.status, 0, r.text);
  const lines = f.calls().trim().split('\n');
  assert.equal(lines.length, 1, f.calls());
  const m = lines[0].match(/^sudo -n \/usr\/local\/sbin\/teletraan-install-tree (\/var\/tmp\/teletraan-push\.\S+) ([0-9a-f]{4,40})$/);
  assert.ok(m, lines[0]);
  assert.ok(r.sha.startsWith(m[2]));
  assert.ok(!f.calls().includes('docker'));
  assert.ok(!fs.existsSync(m[1]), 'the staging folder is removed');
  assert.ok(!r.text.includes('stopped'));
});

test('a password prompt from sudo gives the sentence about the sudoers rule and the wall is unchanged', () => {
  const f = fakes('echo "sudo: a password is required" >&2\nexit 1\n');
  const r = runHook(f);
  assert.ok(r.text.includes('The install needs the sudoers rule. Run the installer again from the Mac tool (menu 1).'), r.text);
  assert.ok(r.text.includes('The install stopped. The wall is unchanged.'), r.text);
});

test('another failure keeps the old message only, and other branches are ignored', () => {
  const f = fakes('echo "boom" >&2\nexit 3\n');
  const r = runHook(f);
  assert.ok(r.text.includes('The install stopped. The wall is unchanged.') && !r.text.includes('sudoers rule'), r.text);
  const g = fakes('exit 0\n');
  runHook(g, 'refs/heads/other');
  assert.equal(g.calls(), '');
});

// The wrapper's refusals come before its config and docker, so they run here with a docker that must stay unused
function runWrapper(args, f) {
  const result = spawnSync('bash', [wrapper, ...args], { encoding: 'utf8', env: { PATH: f.bin + ':/usr/bin:/bin', HOME: f.base } });
  return { status: result.status, text: result.stdout + result.stderr };
}

test('the wrapper refuses an unknown number of arguments', () => {
  const f = fakes('exit 0\n');
  for (const args of [[], ['/var/tmp/teletraan-push.abc'], ['/var/tmp/teletraan-push.abc', 'abcd', 'extra']]) {
    assert.equal(runWrapper(args, f).status, 2, JSON.stringify(args));
  }
  assert.equal(f.calls(), '');
});

test('the wrapper refuses a folder outside /var/tmp, a wrong name, a nested folder, a symlink and a bad commit', () => {
  const f = fakes('exit 0\n');
  const outside = fs.mkdtempSync(path.join(work, 'teletraan-push.'));
  assert.equal(runWrapper([outside, 'abcd1234'], f).status, 2, 'outside /var/tmp');
  const wrongName = fs.mkdtempSync('/var/tmp/other.');
  const real = fs.mkdtempSync('/var/tmp/teletraan-push.');
  const link = '/var/tmp/teletraan-push.link' + process.pid;
  fs.symlinkSync(real, link);
  const nested = path.join(real, 'teletraan-push.inner');
  fs.mkdirSync(nested);
  try {
    assert.equal(runWrapper([wrongName, 'abcd1234'], f).status, 2, 'wrong name');
    assert.equal(runWrapper([link, 'abcd1234'], f).status, 2, 'symlink');
    assert.ok(runWrapper([link, 'abcd1234'], f).text.includes('link'));
    assert.equal(runWrapper([nested, 'abcd1234'], f).status, 2, 'nested');
    assert.equal(runWrapper(['/var/tmp/teletraan-push.nothere' + process.pid, 'abcd1234'], f).status, 2, 'missing');
    for (const bad of ['abc', 'ABCD1234', 'abcd; rm -rf /', '$(id)', 'abcg', 'a'.repeat(41), '']) {
      const r = runWrapper([real, bad], f);
      assert.equal(r.status, 2, 'commit ' + bad);
      assert.ok(r.text.includes('short hash'), r.text);
    }
  } finally {
    fs.rmSync(link, { force: true });
    fs.rmSync(real, { recursive: true, force: true });
    fs.rmSync(wrongName, { recursive: true, force: true });
  }
  assert.equal(f.calls(), '', 'docker was never called');
});

test('the wrapper with a good folder and commit goes on to the config and stops when it is missing', () => {
  const f = fakes('exit 0\n');
  const real = fs.mkdtempSync('/var/tmp/teletraan-push.');
  try {
    const r = runWrapper([real, 'abcd1234'], f);
    if (!fs.existsSync('/usr/local/etc/teletraan-install.conf')) {
      assert.equal(r.status, 2);
      assert.ok(r.text.includes('teletraan-install.conf is missing'), r.text);
    }
    assert.equal(f.calls(), '');
  } finally {
    fs.rmSync(real, { recursive: true, force: true });
  }
});

test('the wrapper runs docker as root with the ids, root and image of the config, then restarts the control service', () => {
  const f = fakes('exit 0\n');
  const conf = path.join(f.base, 'install.conf');
  fs.writeFileSync(conf, "ROOT='/opt/x'\nUID_GID='1000:1000'\nIMAGE='node:22-alpine'\n");
  const copy = path.join(f.base, 'wrapper.sh');
  fs.writeFileSync(copy, fs.readFileSync(wrapper, 'utf8').replace('conf=/usr/local/etc/teletraan-install.conf', 'conf=' + conf));
  const real = fs.mkdtempSync('/var/tmp/teletraan-push.');
  try {
    const result = spawnSync('bash', [copy, real, 'abcd1234'], { encoding: 'utf8', env: { PATH: f.bin + ':/usr/bin:/bin', HOME: f.base } });
    assert.equal(result.status, 0, result.stderr);
    const lines = f.calls().trim().split('\n');
    assert.equal(lines.length, 2, f.calls());
    assert.ok(lines[0].startsWith('docker run --rm -u 1000:1000 ') && lines[0].includes('-v /opt/x:/opt/teletraan') && lines[0].includes(real + ':/staging:ro') && lines[0].endsWith('node control/bin/install-tree.js /staging --from git --commit abcd1234 --note git push'), lines[0]);
    assert.equal(lines[1], 'docker restart teletraan-control');
  } finally {
    fs.rmSync(real, { recursive: true, force: true });
  }
});

test('the three scripts pass sh -n and bash -n', () => {
  for (const file of [hook, wrapper, path.join(repo, 'computer/install.sh')]) {
    for (const shell of ['sh', 'bash']) {
      if (shell === 'sh' && file.endsWith('install.sh')) continue;
      assert.equal(spawnSync(shell, ['-n', file]).status, 0, shell + ' ' + file);
    }
  }
});

fs.rmSync(work, { recursive: true, force: true });
await finish();
