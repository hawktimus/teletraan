// Tests for tools/screenshots.mjs with a stand-in for Playwright. No browser is started, nothing is
// installed and nothing touches the network.
//
//   node tests/screenshots.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tool = await import(pathToFileURL(path.join(root, 'tools', 'screenshots.mjs')).href);
const { panels } = await import(pathToFileURL(path.join(root, 'dashboard', 'registry.js')).href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const small = [
  { id: 'banner', region: 'banner' },
  { id: 'countdown', region: 'countdown' },
  { id: 'tasks', region: 'grid1', topic: 'tasks' },
  { id: 'photo', region: 'grid1', topic: 'photo' },
  { id: 'competition-rank', region: 'grid1', competition: true },
  { id: 'monday-tasks', region: 'grid1', monday: true },
  { id: 'monday-overall', region: 'grid1', monday: true },
  { id: 'monday-progress-both', region: 'grid1', monday: true },
  { id: 'forecast', region: 'grid2' },
  { id: 'stand-in-tile', region: 'grid2', testOnly: true },
];

const names = shots => shots.map(shot => shot.name);

test('every large panel is taken in three Screens for both teams', () => {
  const list = names(tool.planShots(small));
  assert.ok(list.includes('large-tasks-original-prime'));
  assert.ok(list.includes('large-photo-minimal-nova'));
  assert.equal(list.filter(name => name.startsWith('large-')).length, 2 * 3 * 2);
});

test('every small panel is taken in three Screens and a hardware test panel is left out', () => {
  const list = names(tool.planShots(small));
  assert.deepEqual(list.filter(name => name.startsWith('small-')), ['small-forecast-original', 'small-forecast-cybertron', 'small-forecast-minimal']);
  assert.ok(!list.some(name => name.includes('stand-in')));
});

test('a Monday panel has a team in its name only where it takes one', () => {
  const list = names(tool.planShots(small));
  assert.ok(list.includes('monday-tasks-cybertron-nova'));
  assert.ok(list.includes('monday-overall-minimal'));
  assert.ok(list.includes('monday-progress-both-original'));
  assert.ok(!list.some(name => name.startsWith('monday-overall') && /-(prime|nova)$/.test(name)));
});

test('competition cards are taken with ?competition=1 and the countdown in all three Screens', () => {
  const shots = tool.planShots(small);
  const card = shots.find(shot => shot.name === 'competition-rank-original-prime');
  assert.ok(card.url.includes('competition=1'));
  assert.ok(card.url.includes('sample=1') && card.url.includes('still=1'));
  assert.deepEqual(names(shots).filter(name => name.startsWith('countdown-')), ['countdown-original', 'countdown-cybertron', 'countdown-minimal']);
});

test('the swaps have a frame at 200, 400 and 800 ms and the announcement plate is in the plan', () => {
  const shots = tool.planShots(small);
  const swaps = shots.filter(shot => shot.kind === 'swap');
  assert.equal(swaps.length, 2);
  swaps.forEach(shot => assert.deepEqual(shot.frames, [200, 400, 800]));
  assert.deepEqual(names(shots).filter(name => name.startsWith('announcement-plate')), ['announcement-plate-original', 'announcement-plate-cybertron', 'announcement-plate-minimal']);
  assert.deepEqual(names(shots).filter(name => name.startsWith('photos-row-')), ['photos-row-original', 'photos-row-cybertron', 'photos-row-minimal']);
});

test('the real registry gives a plan with a name for each picture, and no name twice', () => {
  const list = names(tool.planShots(panels));
  assert.equal(new Set(list).size, list.length);
  assert.ok(list.every(name => /^[a-z0-9-]+$/.test(name)));
});

test('--only keeps the names that match, several patterns split by commas, with * for any text', () => {
  const keep = tool.onlyFilter('large-tasks-*-nova, swap');
  assert.ok(keep('large-tasks-minimal-nova'));
  assert.ok(keep('swap-team'));
  assert.ok(!keep('large-tasks-minimal-prime'));
  assert.ok(tool.onlyFilter('')('anything'));
  assert.ok(tool.onlyFilter('TASKS')('small-task-counts') === false);
  assert.ok(tool.onlyFilter('a.b')('a.b'));
  assert.ok(!tool.onlyFilter('a.b')('axb'));
});

test('the folder is named by the date', () => {
  assert.equal(tool.todayText(new Date(2026, 9, 5, 12)), '2026-10-05');
});

// A stand-in for Playwright. page.fail names an address whose panel throws, page.noPlate says the plate is absent.
function standIn(options = {}) {
  const opened = [];
  const playwright = {
    chromium: {
      launch: async () => ({
        newContext: async () => ({
          newPage: async () => {
            let url = '';
            let now = 0;
            return {
              on() {},
              route: async () => {},
              addInitScript: async () => {},
              goto: async address => { url = address; opened.push(address); },
              waitForFunction: async (run, argument) => { if (typeof argument === 'number') now = argument; },
              evaluate: async () => (options.fail && url.includes(options.fail) ? 'No panel called "x"' : now),
              waitForTimeout: async () => {},
              waitForSelector: async () => { if (options.noPlate) throw new Error('timeout'); },
              screenshot: async ({ path: file }) => fs.writeFileSync(file, 'png'),
              close: async () => {},
            };
          },
          close: async () => {},
        }),
        close: async () => {},
      }),
    },
  };
  return { playwright: playwright, opened: opened };
}

function inTemp(run) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-shots-'));
  return Promise.resolve(run(folder)).finally(() => fs.rmSync(folder, { recursive: true, force: true }));
}

test('a run writes one file for each picture and three for a swap', () => inTemp(async folder => {
  const { playwright, opened } = standIn();
  const shots = tool.planShots(small).filter(shot => ['large-tasks-original-prime', 'swap-team', 'countdown-minimal'].includes(shot.name));
  const result = await tool.runShots({ playwright: playwright, shots: shots, base: 'http://127.0.0.1:1', outFolder: path.join(folder, 'out'), limits: { settleMs: 0 } });

  assert.equal(result.failed.length, 0);
  assert.deepEqual(fs.readdirSync(path.join(folder, 'out')).sort(), ['countdown-minimal.png', 'large-tasks-original-prime.png', 'swap-team-200ms.png', 'swap-team-400ms.png', 'swap-team-800ms.png']);
  assert.ok(opened.every(address => address.startsWith('http://127.0.0.1:1/index.html?sample=1')));
}));

test('a panel that throws is listed, and the run goes on to the next picture', () => inTemp(async folder => {
  const { playwright } = standIn({ fail: 'panel=photo' });
  const shots = tool.planShots(small).filter(shot => ['large-photo-original-prime', 'large-tasks-original-prime'].includes(shot.name));
  const result = await tool.runShots({ playwright: playwright, shots: shots, base: 'http://x', outFolder: folder, limits: { settleMs: 0 } });

  assert.deepEqual(result.failed.map(item => item.name), ['large-photo-original-prime']);
  assert.match(result.failed[0].reason, /the panel threw/);
  assert.equal(result.written.length, 1);
  assert.match(tool.summaryLine(result), /1 pictures written, 1 failed \(large-photo-original-prime\)/);
}));

test('the announcement plate is skipped, not failed, while the page does not draw it', () => inTemp(async folder => {
  const { playwright } = standIn({ noPlate: true });
  const shots = tool.planShots(small).filter(shot => shot.name === 'announcement-plate-original');
  const result = await tool.runShots({ playwright: playwright, shots: shots, base: 'http://x', outFolder: folder, limits: { settleMs: 0 } });

  assert.equal(result.failed.length, 0);
  assert.deepEqual(result.skipped.map(item => item.name), ['announcement-plate-original']);
  assert.match(tool.summaryLine(result), /0 pictures written, 1 skipped \(announcement-plate-original\)/);
}));

test('Playwright is loaded when asked for, through import and then through require', async () => {
  const fake = { chromium: {} };
  assert.equal(await tool.loadPlaywright(async () => fake, () => { throw new Error('no'); }), fake);
  assert.equal(await tool.loadPlaywright(async () => { throw new Error('no'); }, () => fake), fake);
  assert.equal(await tool.loadPlaywright(async () => { throw new Error('no'); }, () => { throw new Error('no'); }), null);
});

test('the server gives the files of a folder to this computer and nothing outside it', () => inTemp(async folder => {
  fs.writeFileSync(path.join(folder, 'index.html'), '<p>hello</p>');
  const server = await tool.serveDashboard(folder);
  const get = address => new Promise(resolve => http.get(address, response => {
    let body = '';
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => resolve({ status: response.statusCode, body: body }));
  }));

  try {
    assert.deepEqual(await get('http://127.0.0.1:' + server.port + '/index.html?x=1'), { status: 200, body: '<p>hello</p>' });
    assert.equal((await get('http://127.0.0.1:' + server.port + '/missing.html')).status, 404);
    assert.equal((await get('http://127.0.0.1:' + server.port + '/..%2F..%2Fetc/passwd')).status, 404);
  } finally {
    await server.close();
  }
}));

test('tools/package.json lists Playwright as a development dependency only', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'package.json'), 'utf8'));
  assert.ok(manifest.devDependencies && manifest.devDependencies.playwright);
  assert.equal(manifest.dependencies, undefined);
  assert.ok(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split('\n').includes('_outputs/'));
});

let failed = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('PASS  ' + entry.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + entry.name + '\n        ' + error.message);
  }
}
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' checks passed.');
process.exit(failed === 0 ? 0 : 1);
