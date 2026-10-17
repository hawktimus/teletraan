// Tests for the Teams and views part of the Studio: the two team pages open on a plain form (name, number, logo,
// metal and the colors on top, everything else folded under Advanced), the Colors field draws swatches and the
// standard colors button, no stored name changed, and the Team section of Dashboard Settings is hidden but kept.
//
//   node tests/studio-teams.test.mjs

import assert from 'node:assert/strict';
import { openStudio, nodesWhere, wordsIn } from './helpers/studio-world.mjs';

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const studio = await openStudio();
const team = (await studio.load('schemas/team.js')).default;
const settings = (await studio.load('schemas/dashboardSettings.js')).default;
const structure = await studio.load('structure.js');
const colorsInput = await studio.load('inputs/team-colors-input.js');
const standard = await studio.load('tools/team-standard.js');

// The names a team document has stored since before the Studio was cleaned up. None may be renamed or removed.
const storedNames = ['name', 'shortName', 'number', 'code', 'logo', 'colors', 'metal', 'palette', 'glow', 'mirror', 'bolts', 'cornerCut', 'headerNotch', 'grid', 'logoPose', 'nameStyle', 'outlinedName', 'tickerLabel', 'countAccent', 'active', 'order'];
const storedColors = ['primary', 'plate', 'accent', 'neon', 'pink', 'background', 'text', 'body', 'label', 'headerInk', 'dark', 'retro'];

function line(title, entries) {
  return entries.filter(entry => entry.title === title)[0];
}

test('no stored name of a team changed: every field is still there, and the twelve colors too', () => {
  assert.deepEqual(team.fields.map(field => field.name).sort(), storedNames.slice().sort());
  assert.deepEqual(team.fields.filter(field => field.name === 'colors')[0].fields.map(field => field.name), storedColors);
  assert.equal(team.name, 'team');
});

test('a team opens with the name, number, logo, metal and colors on top and the rest folded under Advanced', () => {
  const top = team.fields.filter(field => !field.fieldset && !field.hidden).map(field => field.name);
  assert.deepEqual(top, ['name', 'number', 'logo', 'metal', 'colors']);

  const box = team.fieldsets.filter(set => set.name === 'advanced')[0];
  assert.equal(box.title, 'Advanced');
  assert.equal(box.options.collapsible, true);
  assert.equal(box.options.collapsed, true);
  assert.ok(team.fields.filter(field => field.fieldset === 'advanced').map(field => field.name).indexOf('mirror') !== -1, 'the mirror switch is under Advanced');
  assert.ok(team.fields.filter(field => field.fieldset === 'advanced').map(field => field.name).indexOf('bolts') !== -1, 'the trim is under Advanced');
  assert.equal(team.fields.filter(field => field.name === 'colors')[0].options.collapsed, true, 'the twelve colors are folded');
});

test('the Colors field draws the swatches and the standard colors button, and every field still has a one line description', () => {
  const colors = team.fields.filter(field => field.name === 'colors')[0];
  assert.equal(colors.components.input, colorsInput.TeamColorsInput);
  team.fields.forEach(field => assert.ok(typeof field.description === 'string' && field.description.length > 0, field.name + ' needs a description'));
});

test('the swatches show only colors that are real hex colors', () => {
  const swatches = colorsInput.swatchesOf({ primary: '#6C18B6', plate: 'purple', accent: '#FACA2A' });
  assert.deepEqual(swatches.map(item => item.name), ['primary', 'accent']);
  assert.deepEqual(colorsInput.swatchesOf(undefined), []);
});

test('the button is off for a team with no standard colors and for one that already has them', () => {
  assert.equal(colorsInput.standardState({ code: 'robots', colors: {} }).enabled, false);
  assert.equal(colorsInput.standardState({ code: 'robots', colors: {} }).note, colorsInput.words.none);
  const prime = Object.assign({ code: 'prime' }, standard.standardTeams.prime);
  assert.equal(colorsInput.standardState(prime).enabled, false);
  assert.equal(colorsInput.standardState(prime).note, colorsInput.words.already);
  const changed = Object.assign({}, prime, { colors: Object.assign({}, prime.colors, { primary: '#000000' }) });
  assert.equal(colorsInput.standardState(changed).enabled, true);
  assert.equal(colorsInput.standardState(changed).changes.lines.length, 1);
});

test('the button asks first, then writes the standard colors to the draft and publishes nothing', async () => {
  const prime = Object.assign({ _id: 'drafts.team-prime', code: 'prime' }, standard.standardTeams.prime, { colors: Object.assign({}, standard.standardTeams.prime.colors, { primary: '#000000' }) });
  globalThis.studioForm = { '': prime, _id: 'drafts.team-prime' };
  globalThis.studioCalls = [];
  const page = studio.mount(colorsInput.TeamColorsInput, { value: prime.colors, renderDefault: () => 'THE TWELVE COLORS' });
  await page.settle();

  const swatches = nodesWhere(page.tree(), node => node.props && node.props['data-block'] === 'swatches')[0];
  assert.equal(nodesWhere(swatches, node => node.props && node.props.role === 'img').length, 6);
  assert.match(wordsIn(page.tree()), /THE TWELVE COLORS/);

  const button = nodesWhere(page.tree(), node => node.type === 'button' && wordsIn(node) === colorsInput.words.button)[0];
  assert.ok(button && button.props.disabled === false && button.props.style.minHeight >= 44, 'the button is on the form and big enough');
  button.props.onClick();
  await page.settle();
  assert.match(wordsIn(page.tree()), /Main color: #000000 to #6C18B6/);
  assert.equal(globalThis.studioCalls.length, 0, 'nothing is written before the question is answered');

  nodesWhere(page.tree(), node => node.type === 'button' && wordsIn(node) === colorsInput.words.replace)[0].props.onClick();
  await page.settle();
  assert.equal(globalThis.studioCalls.length, 1);
  assert.equal(globalThis.studioCalls[0].publish, undefined);
  assert.equal(globalThis.studioCalls[0].patch[0].set.colors.primary, '#6C18B6');
  assert.match(wordsIn(page.tree()), /Colors replaced in the draft/);
});

test('Cancel leaves the form alone', async () => {
  const prime = Object.assign({ _id: 'team-prime', code: 'prime' }, standard.standardTeams.prime, { colors: Object.assign({}, standard.standardTeams.prime.colors, { primary: '#000000' }) });
  globalThis.studioForm = { '': prime, _id: 'team-prime' };
  globalThis.studioCalls = [];
  const page = studio.mount(colorsInput.TeamColorsInput, { value: prime.colors });
  await page.settle();
  nodesWhere(page.tree(), node => node.type === 'button')[0].props.onClick();
  await page.settle();
  nodesWhere(page.tree(), node => node.type === 'button' && wordsIn(node) === colorsInput.words.cancel)[0].props.onClick();
  await page.settle();
  assert.equal(globalThis.studioCalls.length, 0);
  assert.ok(nodesWhere(page.tree(), node => node.type === 'button' && wordsIn(node) === colorsInput.words.button).length === 1);
});

test('the sidebar line Teams and views holds the two teams as pages and the Views folder', () => {
  const folder = line('Teams and views', structure.sidebarEntries);
  assert.equal(folder.kind, 'group');
  assert.deepEqual(folder.entries.map(entry => entry.title), ['Hawktimus Prime', 'Hawktimus Nova', 'Views']);
  assert.deepEqual(folder.entries.slice(0, 2).map(entry => entry.type + '/' + entry.id), ['team/team-prime', 'team/team-nova']);
  assert.deepEqual(folder.entries[2].entries.map(entry => entry.title + '=' + entry.id), ['Robotics=view-general', 'Prime=view-prime', 'Nova=view-nova']);
  assert.deepEqual(structure.teamPageIds, { prime: 'team-prime', nova: 'team-nova' });
});

test('the Team section of Dashboard Settings is hidden but kept with its three fields, and says where the team is now', () => {
  const field = settings.fields.filter(item => item.name === 'team')[0];
  assert.equal(field.hidden, true);
  assert.deepEqual(field.fields.map(item => item.name), ['name', 'number', 'school']);
  assert.match(field.description, /Used only while no team is saved/);
  assert.match(field.description, /Teams and views/);
});

test('the pages and the new input keep the phone rules', () => {
  const text = studio.source('inputs/team-colors-input.js');
  (text.match(/minHeight: \d+/g) || []).forEach(found => assert.ok(Number(found.replace(/\D/g, '')) >= 44, found));
  assert.ok(!/\bwidth: [3-9]\d\d\b/.test(text));
  assert.ok(/flexWrap: 'wrap'/.test(text) && /overflowWrap: 'anywhere'/.test(text), 'the swatches and the text wrap');
});

let failed = 0;
for (const item of tests) {
  try {
    await item.run();
    console.log('PASS  ' + item.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + item.name + '\n      ' + String(error && error.stack ? error.stack : error).split('\n').slice(0, 6).join('\n      '));
  }
}
studio.close();
console.log(failed === 0 ? tests.length + ' of ' + tests.length + ' checks passed.' : failed + ' of ' + tests.length + ' checks failed.');
process.exit(failed === 0 ? 0 : 1);
