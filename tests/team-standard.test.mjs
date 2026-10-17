// Tests for the Team action "Use the standard colors for this team" (studio/tools/team-actions.js).
// The table of standard values (studio/tools/team-standard.js) must equal the built-in Prime team
// in dashboard/config.js and the two teams in docs/seed/teams.ndjson and the sample content, and the
// changes it works out must be right. Nothing touches the network or the dataset.
//
//   node tests/team-standard.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(root + file, 'utf8');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'team-standard-'));
fs.mkdirSync(path.join(scratch, 'dashboard'));
fs.writeFileSync(path.join(scratch, 'package.json'), '{"type":"module"}');
copyModule(root + 'dashboard/config.js', path.join(scratch, 'dashboard/config.js'));
const { primeTeam } = await import(pathToFileURL(path.join(scratch, 'dashboard/config.js')).href);
const { standardTeams, standardChanges, standardFor } = await import(pathToFileURL(root + 'studio/tools/team-standard.js').href);
const actionText = read('studio/tools/team-actions.js');
fs.rmSync(scratch, { recursive: true, force: true });

const seeded = read('docs/seed/teams.ndjson').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
const sample = JSON.parse(read('dashboard/data/sample/content.json')).teams;
const trim = ['bolts', 'cornerCut', 'headerNotch', 'grid', 'outlinedName', 'tickerLabel', 'countAccent'];

let passed = 0;
function test(name, run) {
  run();
  passed += 1;
  console.log('ok ' + name);
}

function valuesOf(team) {
  const out = { colors: Object.assign({}, team.colors), metal: team.metal, palette: team.palette || 'standard', glow: team.glow };
  trim.forEach(name => { out[name] = team[name] === undefined ? false : team[name]; });
  return out;
}

test('the table holds exactly prime and nova', () => {
  assert.deepEqual(Object.keys(standardTeams).sort(), ['nova', 'prime']);
  assert.equal(standardFor('other'), null);
});

test('prime equals the built-in team of dashboard/config.js', () => {
  assert.deepEqual(valuesOf(standardTeams.prime), valuesOf(primeTeam));
});

['prime', 'nova'].forEach(code => {
  test(code + ' equals the seed file and the sample content', () => {
    [seeded, sample].forEach(list => {
      const team = list.find(item => item.code === code);
      assert.deepEqual(valuesOf(standardTeams[code]), valuesOf(team), code);
    });
  });
});

test('nova is the inverted gold and purple palette of the order', () => {
  const nova = standardTeams.nova;
  assert.equal(nova.palette, 'inverted');
  assert.equal(nova.metal, 'gold');
  assert.deepEqual(
    [nova.colors.primary, nova.colors.plate, nova.colors.dark, nova.colors.body, nova.colors.background, nova.colors.accent, nova.colors.label, nova.colors.text, nova.colors.headerInk, nova.colors.retro],
    ['#D4A017', '#6B4C08', '#3D2A05', '#241A04', '#17110A', '#C86BFF', '#D9A6FF', '#FFFFFF', '#1A1200', '#E0A400']
  );
});

test('an old blue Nova document gets every standard value, and a standard one gets none', () => {
  const blue = { code: 'nova', name: 'Hawktimus Nova', colors: { primary: '#2B7FD6', plate: '#12335C', text: '#FFFFFF' }, metal: 'steel', glow: true, bolts: 'round' };
  const result = standardChanges(blue, 'nova');
  assert.equal(result.set.colors.primary, '#D4A017');
  assert.ok(!result.lines.some(line => line.label === 'Text color'), 'a value that already matches is not listed');
  assert.equal(result.set.metal, 'gold');
  assert.equal(result.set.palette, 'inverted');
  assert.equal(result.set.name, undefined, 'the name is never touched');
  assert.ok(result.lines.some(line => line.label === 'Main color' && line.from === '#2B7FD6' && line.to === '#D4A017'));
  const clean = standardChanges(Object.assign({}, standardTeams.nova, { code: 'nova' }), 'nova');
  assert.equal(clean.lines.length, 0);
  assert.deepEqual(clean.set, {});
});

test('a team with another code has no standard values', () => {
  assert.deepEqual(standardChanges({ code: 'zzz', colors: {} }, 'zzz').lines, []);
});

test('the action asks the question, patches the draft and never publishes', () => {
  assert.ok(actionText.includes('Replace the colors of this team with the standard ones? Nothing is published until you click Publish.'));
  assert.ok(actionText.includes('patch.execute'));
  assert.ok(!/publish\.execute|useDocumentOperation\([^)]*\)[^;]*publish\s*\}/.test(actionText.replace(/\/\/.*$/gm, '')), 'no publish operation');
  assert.ok(read('studio/sanity.config.js').includes('useStandardColorsAction'));
  assert.ok(read('studio/schemas/team.js').includes('Use the standard colors for this team'));
});

console.log('all ' + passed + ' passed');
