// Tests for the theme folders (dashboard/styles/<theme>/): the four files of each, Retro as a marked copy of
// Original, the loader that finds a folder from an id, the bar layout keeping one drawing in every theme, and
// the inverted palette and the purple metal of a team.
//
//   node tests/theme-folders.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dash = root + 'dashboard/';
const read = file => fs.readFileSync(root + file, 'utf8');
const noComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\n\s*\n/g, '\n').trim();
const load = file => import(pathToFileURL(dash + file).href);

const config = await load('config.js');
const style = await load('core/style.js');
const loader = await load('core/style-loader.js');
const teams = await load('core/teams.js');
const sanity = await load('core/sanity.js');

let passed = 0;
function test(name, run) {
  try { run(); passed += 1; console.log('ok    ' + name); } catch (error) { console.log('FAIL  ' + name + '\n' + error.stack); process.exitCode = 1; }
}

test('the themes are original, cybertron and retro, and Minimal is not one of them', () => {
  assert.deepEqual(config.themeIds, ['original', 'cybertron', 'retro']);
  assert.equal(config.themeIds.includes('minimal'), false);
  assert.equal(fs.existsSync(dash + 'styles/minimal.css'), false);
  assert.equal(fs.existsSync(dash + 'styles/minimal'), false);
  assert.deepEqual(fs.readdirSync(dash + 'styles').sort(), config.themeIds.slice().sort());
});

test('every theme folder has theme.css, frame.css, tokens.css and transitions.js, and index.html links the three stylesheets', () => {
  const page = read('dashboard/index.html');
  config.themeIds.forEach(id => {
    ['theme.css', 'frame.css', 'tokens.css', 'transitions.js'].forEach(name => assert.ok(fs.existsSync(dash + 'styles/' + id + '/' + name), id + '/' + name));
    ['tokens.css', 'theme.css', 'frame.css'].forEach(name => assert.ok(page.includes('href="styles/' + id + '/' + name + '?v=0"'), id + '/' + name + ' is linked'));
  });
  assert.ok(page.indexOf('styles/cybertron/theme.css') < page.indexOf('layouts/bar-minimal.css'), 'the bar drawing comes after the themes');
});

test('the loader finds the folder from an id, and an id that is not a theme is the default theme', () => {
  assert.equal(loader.themeFolder('cybertron'), 'styles/cybertron/');
  assert.deepEqual(loader.themeSheets('retro'), ['styles/retro/tokens.css', 'styles/retro/theme.css', 'styles/retro/frame.css']);
  assert.equal(loader.themeFolder('minimal'), 'styles/original/', 'the old name is the Original theme');
  assert.equal(loader.themeFolder('oops'), 'styles/original/');
  assert.equal(loader.transitionsPath('cybertron'), 'styles/cybertron/transitions.js');
  assert.equal(style.themeOf('retro'), 'retro');
  assert.equal(style.isStyle('retro'), true);
});

test('ensureThemeSheets adds only the links a page lacks', () => {
  const links = ['styles/original/theme.css?v=7'];
  const added = [];
  const doc = {
    head: { appendChild: link => { added.push(link.href); } },
    createElement: () => ({}),
    querySelectorAll: () => links.map(href => ({ getAttribute: () => href })),
    querySelector: () => ({ getAttribute: () => links[0] }),
  };
  assert.equal(loader.ensureThemeSheets('original', doc), 2);
  assert.deepEqual(added, ['styles/original/tokens.css?v=7', 'styles/original/frame.css?v=7']);
  assert.equal(loader.ensureThemeSheets('original', null), 0);
});

test('every theme has a swap variant, and it is the pull apart of core/swap-plan.js', async () => {
  const plan = await load('core/swap-plan.js');
  for (const id of config.themeIds) {
    const variant = (await load('styles/' + id + '/transitions.js')).swapVariant;
    assert.equal(variant.name, 'pull-apart');
    assert.equal(variant.times, plan.swapTimes);
  }
  assert.equal((await loader.loadSwapVariant('cybertron')).name, 'pull-apart');
});

test('Retro is a marked copy of Original: the same rules, and the marker file says so', () => {
  const marker = dash + 'styles/retro/PLACEHOLDER';
  assert.ok(fs.existsSync(marker), 'the marker exists');
  if (!fs.existsSync(marker)) return;

  const original = noComments(read('dashboard/styles/original/theme.css'));
  const retro = noComments(read('dashboard/styles/retro/theme.css'));
  assert.equal(retro, original + '\nhtml[data-style="retro"] .rivets { display: inline; }', 'the one rule more shows the rivets, as base.css does for Original');
  ['tokens.css', 'frame.css'].forEach(name => assert.equal(noComments(read('dashboard/styles/retro/' + name)), noComments(read('dashboard/styles/original/' + name)), name));
  assert.equal(noComments(read('dashboard/styles/retro/transitions.js')).replace(/retro/g, 'original'), noComments(read('dashboard/styles/original/transitions.js')));
  assert.equal(style.shapesFor('retro'), style.shapesFor('original'), 'the same frames');
  assert.equal(style.hasSteel('retro'), false);
  const studio = read('studio/inputs/theme-styles.js');
  assert.ok(studio.includes('Retro is not designed yet; it looks like Original.'), 'the Studio says so');
  assert.ok(read('dashboard/styles/retro/theme.css').includes('PLACEHOLDER'));
});

test('the Studio list of themes is the one in config.js, in the same order', async () => {
  const list = (await import(pathToFileURL(root + 'studio/inputs/theme-styles.js').href)).themeStyles;
  assert.deepEqual(list.map(item => item.value), config.themeIds);
  assert.ok(list.every(item => item.title.length > 0));
});

test('the bar layout has Minimal\'s frames, steel and drawing in every theme', () => {
  config.themeIds.forEach(id => {
    assert.equal(style.shapesFor(id, 'bar'), 'minimal', id);
    assert.equal(style.hasSteel(id, 'bar'), true, id);
  });
  assert.equal(style.shapesFor('cybertron', 'standard'), 'cybertron');
  assert.equal(style.shapesFor('original', 'standard'), '');
  assert.equal(style.layoutFor('original', 'standard'), 'standard');
  assert.equal(style.layoutFor('minimal', 'standard'), 'bar', 'the old name still asks for the bar layout');

  const css = noComments(read('dashboard/layouts/bar-minimal.css'));
  assert.equal(/data-style/.test(css), false, 'the bar drawing names no theme');
  assert.ok(css.includes('html[data-layout="bar"] .rivets { display: inline; }'));
});

test('the inverted palette is the Nova one: a class, purple chips with white text, and the purple metal is optional', () => {
  assert.equal(config.teamPalettes.inverted, 'palette-inverted');
  assert.equal(config.teamPalettes.standard, '');
  assert.equal(config.primeTeam.palette, 'standard');

  const nova = sanity.normalizeContent({ teams: [{ _id: 'n', _type: 'team', code: 'nova', palette: 'inverted', metal: 'purple' }, { _id: 'p', _type: 'team', code: 'pr', palette: 'oops' }] }, new Date(0)).teams;
  assert.deepEqual([nova[0].palette, nova[0].metal, nova[1].palette, nova[1].metal], ['inverted', 'purple', 'standard', 'gold']);

  const classes = new Set();
  const page = { style: { setProperty() {} }, classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
  teams.applyTeamLook(nova[0], page);
  assert.deepEqual([...classes].sort(), ['metal-purple', 'palette-inverted']);
  teams.applyTeamLook(nova[1], page);
  assert.deepEqual([...classes], [], 'a team with the standard palette has neither class');

  const tokens = read('dashboard/tokens.css');
  assert.ok(/html\.palette-inverted \{\s*--team-chip: #6c18b6;\s*--team-chip-text: #ffffff;/.test(tokens));
  assert.ok(/html\.metal-purple \[data-metal\] \{/.test(tokens));
  assert.ok(tokens.includes(':not(.metal-steel):not(.metal-purple)'), 'gold is not forced on a team with purple');

  const seeded = read('docs/seed/teams.ndjson').split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert.equal(seeded.find(team => team.code === 'nova').palette, 'inverted');
  assert.equal(seeded.find(team => team.code === 'nova').metal, 'gold', 'the metal of the seed is gold; purple is a choice');
  assert.equal(seeded.find(team => team.code === 'prime').palette, undefined);
});

test('the chips read the chip tokens, so Prime keeps the accent and the dark ground', () => {
  const base = noComments(read('dashboard/base.css'));
  assert.ok(/\.person-chip \{[^}]*background: var\(--team-chip\);[^}]*color: var\(--team-chip-text\);/.test(base));
  assert.ok(/\.team-chip \{[^}]*color: var\(--team-chip-text\);\s*background: var\(--team-chip\);/.test(base));
  assert.ok(/:root \{\s*--team-chip: var\(--yellow\);\s*--team-chip-text: var\(--ground\);/.test(read('dashboard/tokens.css')));
});

console.log('\n' + passed + ' passed');
