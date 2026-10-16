// The zip check and the tree hash of the control service: names that climb out, links, a zip that unpacks to
// too much, a damaged file, the exclusion list, and the answer of the page's hash equal to the Mini's.
//
//   node tests/control-zip-hash.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { makeZip, sampleTree } from './helpers/zip-maker.mjs';
import { readZip, extractZip, nameProblem } from '../control/lib/zip.js';
import { treeHash, listFiles } from '../control/lib/tree-hash.js';
import { treeHashOfFiles, isExcluded } from '../control/static/tree-hash.js';
import { versionLabel as dashboardLabel } from '../dashboard/core/version-label.js';
import { versionLabel as pageLabel } from '../control/static/update-lib.js';

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-zip-'));
const repo = fileURLToPath(new URL('../', import.meta.url));

function writeTree(folder, files) {
  for (const name of Object.keys(files)) {
    fs.mkdirSync(path.dirname(path.join(folder, name)), { recursive: true });
    fs.writeFileSync(path.join(folder, name), files[name]);
  }
}

test('a zip of stored and deflated files unpacks with the same bytes, and a script keeps its run bit', () => {
  [false, true].forEach(stored => {
    const out = path.join(work, 'unpack-' + stored);
    const count = extractZip(makeZip(sampleTree(), { stored: stored }), out);
    assert.equal(count, 5);
    assert.equal(fs.readFileSync(path.join(out, 'dashboard/index.html'), 'utf8'), '<html></html>');
    assert.ok(fs.statSync(path.join(out, 'mini/scripts/kiosk.sh')).mode & 0o100, 'a file that starts with #! is run');
    assert.ok(!(fs.statSync(path.join(out, 'dashboard/index.html')).mode & 0o111));
  });
});

test('a zip made from a folder keeps working: the one folder around the files is taken off', () => {
  const wrapped = {};
  Object.keys(sampleTree()).forEach(name => { wrapped['teletraan/' + name] = sampleTree()[name]; });
  const out = path.join(work, 'wrapped');
  extractZip(makeZip(wrapped), out);
  assert.ok(fs.existsSync(path.join(out, 'dashboard/index.html')));
});

test('names that climb out, start at the top, use backslashes or hold a null are refused', () => {
  ['../evil.txt', 'a/../../evil.txt', '/etc/passwd', 'C:/x', 'a\\b', 'a\0b'].forEach(name => {
    assert.ok(nameProblem(name), name);
    assert.throws(() => readZip(makeZip({ [name]: 'x' })), /zip has/, name);
  });
  assert.equal(nameProblem('dashboard/index.html'), '');
});

test('a symbolic link, a damaged file, a bad zip and a zip that unpacks to too much are refused', () => {
  assert.throws(() => readZip(makeZip({ 'a': 'x', 'link': 'a' }, { symlink: 'link' })), /symbolic link/);
  const damaged = makeZip({ 'a.txt': 'hello hello hello' }, { stored: true });
  damaged[damaged.indexOf('hello')] = 0x58;
  assert.throws(() => readZip(damaged)[0].read(), /damaged/);
  assert.throws(() => readZip(Buffer.from('not a zip at all, just text')), /not a zip/);
  assert.throws(() => readZip(makeZip({ 'big.txt': Buffer.alloc(5000) }), { unpackedBytes: 1000 }), /unpacks to more/);
  assert.throws(() => readZip(makeZip({ a: '1', b: '2', c: '3' }), { entries: 2 }), /more than 2 files/);
});

test('the exclusion list leaves out the repository history, packages, keys and generated files', () => {
  ['.git/HEAD', 'studio/node_modules/x/y.js', '.DS_Store', 'dashboard/.DS_Store', 'mini/local.env', 'mini/local.env.bak', '.env', '_inputs/a.png', '_outputs/b.png',
    'dashboard/build.js', 'mini/build.txt', 'studio-dist/index.html', 'studio/static/dashboard/index.html', 'dashboard/data/live/x.json', 'RELEASE.json'].forEach(name => {
    assert.equal(isExcluded(name), true, name);
  });
  ['dashboard/index.html', 'mini/local.example.env', 'dashboard/build.example.js', 'studio/package.json', 'control/static/vendor/README-fflate.txt'].forEach(name => {
    assert.equal(isExcluded(name), false, name);
  });
});

test('the hash ignores excluded files and files outside the four folders, and changes with content, size and path', () => {
  const a = path.join(work, 'hash-a');
  writeTree(a, sampleTree());
  const base = treeHash(a);
  assert.match(base, /^[0-9a-f]{64}$/);

  writeTree(a, { 'dashboard/build.js': 'x', 'mini/local.env': 'SECRET', 'docs/readme.md': 'text', '.git/HEAD': 'ref', 'tests/x.test.mjs': '1' });
  assert.equal(treeHash(a), base);

  writeTree(a, { 'dashboard/index.html': '<html> </html>' });
  const changed = treeHash(a);
  assert.notEqual(changed, base);
  writeTree(a, { 'dashboard/index.html': '<html></html>' });
  assert.equal(treeHash(a), base);
  fs.renameSync(path.join(a, 'dashboard/index.html'), path.join(a, 'dashboard/other.html'));
  assert.notEqual(treeHash(a), base);
});

test('the page computes the same hash as the Mini for the same folder, for a fixture and for this repository', async () => {
  const a = path.join(work, 'hash-b');
  writeTree(a, sampleTree({ 'dashboard/big.bin': Buffer.alloc(70000, 7), 'control/static/x.js': 'é ü' }));
  const files = listFiles(a).map(name => ({ path: name, read: async () => fs.readFileSync(path.join(a, name)) }));
  assert.equal(await treeHashOfFiles(files), treeHash(a));

  const real = listFiles(repo).filter(name => !name.startsWith('studio/node_modules'));
  const again = real.map(name => ({ path: name, read: async () => fs.readFileSync(path.join(repo, name)) }));
  assert.equal(await treeHashOfFiles(again), treeHash(repo));
});

test('the version label is the same text on the screen and on the page', () => {
  [[14, 'a1b2c3d4e5f'], [3, ''], [undefined, 'a1b2c3d'], [undefined, ''], [0, 'zzz']].forEach(([version, commit]) => {
    assert.equal(pageLabel(version, commit), dashboardLabel(version, commit), version + ' ' + commit);
  });
  assert.equal(dashboardLabel(14, 'a1b2c3d4e5f'), 'v14 · a1b2c3d');
});

fs.rmSync(work, { recursive: true, force: true });
await finish();
