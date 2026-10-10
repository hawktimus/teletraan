// Tests that the screen keeps the Monday tab of Dashboard Settings tidy: the boards are
// a list that starts empty, and the owner names are a switch that starts off. The Mini
// reads both (deploy/scripts/monday-sync.sh), the screen has no use for them, and a page
// saved before the fields existed must load. The fields themselves are checked in
// studio/check-schemas.mjs, and the script in tools/test-monday-script.mjs. Nothing is
// drawn and nothing touches the network.
//
//   node tools/test-monday-settings.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-monday-settings-'));
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.mkdirSync(path.join(workFolder, 'dashboard/themes/overlays'), { recursive: true });
fs.mkdirSync(path.join(workFolder, 'dashboard/data/sample'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'themes/registry.js', 'themes/overlays/registry.js', 'data/sample/content.json'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(workFolder, 'dashboard/core', file));
});
const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const { normalizeContent, normalizeSample } = await import(base + 'core/sanity.js');
const { withDefaults } = await import(base + 'core/content.js');
const sample = JSON.parse(fs.readFileSync(path.join(workFolder, 'dashboard/data/sample/content.json'), 'utf8'));

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const entry = {
  boardId: '111',
  team: { _type: 'reference', _ref: 'team-prime' },
  statusColumn: 'status',
  backlogLabel: 'Backlog',
  progressLabel: 'Working on it',
  doneLabel: 'Done',
};

test('the boards start as an empty list and the owner names start off', () => {
  assert.deepEqual(config.defaultSettings.mondayBoards, []);
  assert.equal(config.defaultSettings.mondayShowOwners, false);
  assert.deepEqual(sample.settings.mondayBoards, []);
  assert.equal(sample.settings.mondayShowOwners, false);

  const content = withDefaults({});
  assert.deepEqual(content.settings.mondayBoards, []);
  assert.equal(content.settings.mondayShowOwners, false);
});

test('a page saved before the fields existed has them at their starting values, on the screen and in the sample', () => {
  [normalizeContent({ settings: { pageSeconds: 30 } }).settings, normalizeSample({ settings: { pageSeconds: 30 } }).settings, normalizeSample(sample).settings].forEach(settings => {
    assert.deepEqual(settings.mondayBoards, []);
    assert.equal(settings.mondayShowOwners, false);
  });
});

test('boards that are not a list, and an owner switch that is not on or off, are the starting values', () => {
  [undefined, null, 'text', 7, true, { 0: entry }].forEach(odd => {
    assert.deepEqual(normalizeContent({ settings: { mondayBoards: odd } }).settings.mondayBoards, [], String(odd));
  });
  [undefined, null, 'text', 'yes', 1, {}, []].forEach(odd => {
    assert.equal(normalizeContent({ settings: { mondayShowOwners: odd } }).settings.mondayShowOwners, false, String(odd));
  });
});

test('a list of boards and an owner switch that is on are kept, and the shared starting list is never changed', () => {
  const settings = normalizeContent({ settings: { mondayBoards: [entry], mondayShowOwners: true } }).settings;
  assert.equal(settings.mondayBoards.length, 1);
  assert.equal(settings.mondayBoards[0].boardId, '111');
  assert.equal(settings.mondayShowOwners, true);
  assert.equal(JSON.stringify(settings).includes('_type'), false, 'the names that start with an underscore are dropped');

  settings.mondayBoards.push({ boardId: '222' });
  assert.deepEqual(config.defaultSettings.mondayBoards, []);
  assert.deepEqual(withDefaults({}).settings.mondayBoards, []);
});

test('a board entry saved with a Backlog label keeps it, and nothing on the screen reads it: every status but In progress and Done is Backlog', () => {
  const settings = normalizeContent({ settings: { mondayBoards: [entry] } }).settings;
  assert.equal(settings.mondayBoards[0].backlogLabel, 'Backlog', 'the saved value is kept');

  const read = folder => fs.readdirSync(folder, { withFileTypes: true }).reduce((names, item) => {
    const full = path.join(folder, item.name);
    if (item.isDirectory()) return names.concat(read(full));
    return item.name.endsWith('.js') && fs.readFileSync(full, 'utf8').includes('backlogLabel') ? names.concat(full) : names;
  }, []);
  assert.deepEqual(read(dashboardFolder), [], 'no dashboard file names the Backlog label');
});

test('the Monday settings change nothing else on the screen: every other setting is as it was', () => {
  const plain = normalizeContent({ settings: { pageSeconds: 30, speed: 'fast' } }).settings;
  const withBoards = normalizeContent({ settings: { pageSeconds: 30, speed: 'fast', mondayBoards: [entry], mondayShowOwners: true } }).settings;
  const rest = settings => Object.keys(settings).filter(name => !name.startsWith('monday') || name === 'mondayStyle').reduce((all, name) => Object.assign(all, { [name]: settings[name] }), {});

  assert.deepEqual(rest(withBoards), rest(plain));
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
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
