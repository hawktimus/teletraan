// Tests for a Team document that was only partly updated. A color the document lacks comes from the set of its
// palette: a team with the inverted palette (Nova) gets the Nova values, and any other team the Prime ones, so a
// half-updated team is not gold with Prime's purple plates. The table in dashboard/config.js must equal the standard
// values the Studio action writes (studio/tools/team-standard.js). Nothing touches the network or a browser.
//
//   node tests/team-partial.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-partial-'));

fs.writeFileSync(path.join(work, 'package.json'), '{ "type": "module" }\n');
fs.mkdirSync(path.join(work, 'dashboard/core'), { recursive: true });
['dashboard/config.js'].concat(fs.readdirSync(path.join(root, 'dashboard')).filter(name => /^config-.*\.js$/.test(name)).map(name => 'dashboard/' + name))
  .concat(fs.readdirSync(path.join(root, 'dashboard/core')).filter(name => name.endsWith('.js')).map(name => 'dashboard/core/' + name))
  .forEach(file => copyModule(path.join(root, file), path.join(work, file)));

const config = await import(pathToFileURL(path.join(work, 'dashboard/config.js')).href);
const sanity = await import(pathToFileURL(path.join(work, 'dashboard/core/sanity.js')).href);
const { standardTeams } = await import(pathToFileURL(root + 'studio/tools/team-standard.js').href);

const novaOld = { primary: '#1B6FD6', plate: '#0E2A4A', accent: '#8FF0FF', neon: '#3FD8FF', pink: '#9BF0FF', background: '#050910', text: '#FFFFFF', body: '#07131F', label: '#C58CFF' };
const teamFrom = doc => sanity.normalizeContent({ teams: [Object.assign({ _id: 'x', _type: 'team', code: 'nova' }, doc)] }, new Date(0)).teams[0];

let passed = 0;
function test(name, run) {
  run();
  passed += 1;
  console.log('ok ' + name);
}

test('the inverted colors of the dashboard equal the Nova standard of the Studio', () => {
  assert.deepEqual(config.invertedColors, standardTeams.nova.colors);
});

test('an inverted team with no colors at all is the Nova set, headerInk included', () => {
  assert.deepEqual(teamFrom({ palette: 'inverted' }).colors, standardTeams.nova.colors);
});

test('an inverted team with only a main color keeps it and takes the rest from the Nova set', () => {
  const colors = teamFrom({ palette: 'inverted', colors: { primary: '#123456' } }).colors;
  assert.equal(colors.primary, '#123456');
  assert.equal(colors.plate, '#6B4C08');
  assert.equal(colors.body, '#241A04');
  assert.equal(colors.headerInk, '#1A1200');
});

test('an inverted team that holds the old blue set keeps all of it and gets the dark header ink', () => {
  const colors = teamFrom({ palette: 'inverted', colors: novaOld }).colors;
  assert.equal(colors.primary, '#1B6FD6');
  assert.equal(colors.plate, '#0E2A4A');
  assert.equal(colors.headerInk, '#1A1200');
});

test('a team with the standard palette or none still falls back to Prime', () => {
  [{}, { palette: 'standard' }, { palette: 'nonsense' }].forEach(doc => {
    const colors = teamFrom(Object.assign({ colors: { primary: '#123456' } }, doc)).colors;
    assert.equal(colors.plate, config.primeTeam.colors.plate);
    assert.equal(colors.headerInk, '#FFFFFF');
  });
});

test('a full Nova document reads as it is written', () => {
  const nova = teamFrom({ palette: 'inverted', metal: 'gold', colors: standardTeams.nova.colors });
  assert.deepEqual(nova.colors, standardTeams.nova.colors);
  assert.equal(nova.palette, 'inverted');
});

fs.rmSync(work, { recursive: true, force: true });
console.log(passed + ' passed');
