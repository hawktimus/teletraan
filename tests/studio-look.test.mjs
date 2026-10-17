// Tests for the Look page of the Studio (studio/inputs/look-view.js, look-parts.js): the sections in order with one
// sentence each, one schedule, the rarely touched things folded under Advanced, and the rule that the page writes
// only the fields it shows, only to drafts, with every stored name kept. Dashboard Settings hides what the page shows.
//
//   node tests/studio-look.test.mjs

import assert from 'node:assert/strict';
import { openStudio, nodesWhere, wordsIn, fakeClient } from './helpers/studio-world.mjs';

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const studio = await openStudio();
const parts = await studio.load('inputs/look-parts.js');
const view = await studio.load('inputs/look-view.js');
const editor = await studio.load('inputs/field-editor-parts.js');
const settings = (await studio.load('schemas/dashboardSettings.js')).default;
const structure = await studio.load('structure.js');

function documents() {
  return [
    { _id: 'dashboardSettings', _type: 'dashboardSettings', motion: 'full', crt: { on: true, everySeconds: 240, durationSeconds: 2.7 }, themeByWeekday: { monday: 'original', tuesday: 'cybertron', wednesday: 'original', thursday: 'cybertron', friday: 'original', saturday: 'cybertron', sunday: 'original' }, background: 'sweep' },
    { _id: 'theme', _type: 'theme', seasonOverPanels: true, timeZone: 'America/New_York' },
  ];
}

async function opened(docs) {
  globalThis.studioClient = fakeClient(docs || documents());
  const page = studio.mount(view.LookView);
  await page.settle();
  return { page: page, client: globalThis.studioClient };
}

function block(tree, id) {
  return nodesWhere(tree, node => node.props && node.props['data-block'] === id)[0];
}

function control(tree, id) {
  const row = nodesWhere(tree, node => node.props && node.props['data-field'] === id)[0];
  return row && nodesWhere(row, node => node.type === 'input' || node.type === 'textarea' || node.type === 'select')[0];
}

const patches = client => client.calls.filter(call => call.patch);

test('the page has the six sections of the owner in order, then Advanced, each with one plain sentence on what it does on the TV', async () => {
  const { page } = await opened();
  assert.deepEqual(parts.sections.map(section => section.title), [
    'Theme by day of the week',
    'Background',
    'Seasonal decorations (subthemes and packs)',
    'Motion (full or calm)',
    'Frame polish',
    'Logo and name effects',
    'Advanced',
  ]);
  const ids = nodesWhere(page.tree(), node => node.props && node.props['data-block']).map(node => node.props['data-block']).filter((id, index, all) => parts.sections.some(section => section.id === id) && all.indexOf(id) === index);
  assert.deepEqual(ids, parts.sections.map(section => section.id));
  parts.sections.forEach(section => {
    assert.equal(section.says.split(/[.]\s*/).filter(Boolean).length, 1, section.id + ' should say one sentence');
    assert.ok(wordsIn(block(page.tree(), section.id)).indexOf(section.says) !== -1, section.id + ' should show its sentence');
    assert.ok(!/[—–!]/.test(section.title + section.says));
  });
});

test('there is one schedule: the weekday picker, with the dated rules as a link', async () => {
  const { page } = await opened();
  assert.match(wordsIn(block(page.tree(), 'theme')), /There is one schedule/);
  const pickers = nodesWhere(block(page.tree(), 'theme'), node => node.type === 'select');
  assert.equal(pickers.length, 7);
  const links = nodesWhere(page.tree(), node => node.type === 'ChildLink').map(node => node.props.childId);
  assert.deepEqual(links.filter((id, index) => links.indexOf(id) === index).sort(), ['rules', 'subthemes']);
});

test('Advanced is folded and holds what is rarely touched', async () => {
  const { page } = await opened();
  const advanced = block(page.tree(), 'advanced');
  assert.equal(advanced.type, 'details');
  ['pageChangeStyle', 'breakSeconds', 'silverChance', 'transitionSeconds', 'crt.on', 'crt.everySeconds', 'crt.durationSeconds'].forEach(name => assert.ok(control(advanced, name), name + ' should be under Advanced'));
  ['logoSpin', 'motion', 'look'].forEach(name => assert.ok(!control(advanced, name), name + ' should not be under Advanced'));
});

test('every field the page shows is in the schema with its stored name, and Dashboard Settings hides it', () => {
  const names = settings.fields.map(field => field.name);
  parts.settingsNames.forEach(name => {
    assert.ok(names.indexOf(name) !== -1, name + ' is still a field of Dashboard Settings');
    assert.equal(settings.fields.filter(field => field.name === name)[0].hidden, true, name + ' should be hidden in the form');
  });
  assert.deepEqual(parts.sections.filter(section => section.fields).reduce((all, section) => all.concat(section.fields), []).filter(name => name.indexOf('.') === -1).filter(name => names.indexOf(name) === -1), []);
  ['lookNote', 'cycleNote'].forEach(name => assert.equal(settings.fields.filter(field => field.name === name)[0].hidden, true));
  ['pageSeconds', 'doneDays', 'countdown', 'calendars'].forEach(name => assert.notEqual(settings.fields.filter(field => field.name === name)[0].hidden, true, name + ' is not on the Look page'));
  editor.specsOf(settings.fields, parts.sections.reduce((all, section) => all.concat(section.fields || []), []));
});

test('a weekday writes the whole schedule and nothing else to the draft of Dashboard Settings', async () => {
  const { page, client } = await opened();
  const select = nodesWhere(block(page.tree(), 'theme'), node => node.type === 'select' && node.props['aria-label'] === 'Wednesday')[0];
  select.props.onChange({ target: { value: 'retro' } });
  await page.settle();
  const made = patches(client);
  assert.equal(made.length, 1);
  assert.equal(made[0].patch, 'drafts.dashboardSettings');
  assert.deepEqual(Object.keys(made[0].set), ['themeByWeekday']);
  assert.equal(made[0].set.themeByWeekday.wednesday, 'retro');
  assert.equal(made[0].set.themeByWeekday.monday, 'original');
  assert.equal(client.stored.dashboardSettings.themeByWeekday.wednesday, 'original', 'the published document is untouched');
});

test('the background, motion and polish switches write one field each', async () => {
  const { page, client } = await opened();
  const radio = nodesWhere(block(page.tree(), 'background'), node => node.type === 'input' && node.props.value === 'rays')[0];
  radio.props.onChange();
  await page.settle();
  assert.deepEqual(patches(client).pop().set, { background: 'rays' });

  nodesWhere(control(page.tree(), 'motion') ? block(page.tree(), 'motion') : null, node => node.type === 'input' && node.props.value === 'calm')[0].props.onChange();
  await page.settle();
  assert.deepEqual(patches(client).pop().set, { motion: 'calm' });

  control(page.tree(), 'glint').props.onChange({ target: { checked: false } });
  await page.settle();
  assert.deepEqual(patches(client).pop().set, { glint: false });
});

test('the screen glitch writes the whole object with the other values kept', async () => {
  const { page, client } = await opened();
  control(page.tree(), 'crt.on').props.onChange({ target: { checked: false } });
  await page.settle();
  assert.deepEqual(patches(client).pop().set, { crt: { on: false, everySeconds: 240, durationSeconds: 2.7 } });
});

test('a number the field refuses is not saved and the row says what to do; 0 for never is saved', async () => {
  const { page, client } = await opened();
  control(page.tree(), 'logoSpinEvery').props.onBlur({ target: { value: '5' } });
  await page.settle();
  assert.equal(patches(client).length, 0);
  assert.match(wordsIn(nodesWhere(page.tree(), node => node.props && node.props['data-field'] === 'logoSpinEvery')[0]), /Use 0 for never, or 10 or more\./);
  control(page.tree(), 'logoSpinEvery').props.onBlur({ target: { value: '0' } });
  await page.settle();
  assert.deepEqual(patches(client).pop().set, { logoSpinEvery: 0 });
  control(page.tree(), 'breakSeconds').props.onBlur({ target: { value: '5' } });
  await page.settle();
  assert.match(wordsIn(nodesWhere(page.tree(), node => node.props && node.props['data-field'] === 'breakSeconds')[0]), /Use a number from 0\.3 to 2\./);
});

test('the pieces over the panels switch writes to the draft of the Look document only', async () => {
  const { page, client } = await opened();
  control(page.tree(), 'seasonOverPanels').props.onChange({ target: { checked: false } });
  await page.settle();
  const made = patches(client);
  assert.equal(made.length, 1);
  assert.equal(made[0].patch, 'drafts.theme');
  assert.deepEqual(made[0].set, { seasonOverPanels: false });
  assert.equal(client.calls.filter(call => call.publish).length, 0);
});

test('without Dashboard Settings the page says to publish it once', async () => {
  const { page } = await opened(documents().filter(doc => doc._id !== 'dashboardSettings'));
  assert.match(wordsIn(page.tree()), /Open it, click Publish once, and come back\./);
});

test('the sidebar line Look opens this page and links to the rules and the subthemes', () => {
  const line = structure.sidebarEntries.filter(entry => entry.title === 'Look')[0];
  assert.equal(line.kind, 'component');
  assert.equal(line.component, view.LookView);
  assert.equal(typeof line.children, 'function');
  assert.ok(!structure.sidebarEntries.some(entry => entry.title === 'Themes and backgrounds' || entry.title === 'Subthemes'), 'the old lines are gone');
});

test('the page keeps the phone rules', () => {
  ['look-view.js', 'look-parts.js'].forEach(file => {
    const text = studio.source('inputs/' + file);
    (text.match(/minHeight: \d+/g) || []).forEach(found => assert.ok(Number(found.replace(/\D/g, '')) >= 44, file + ' ' + found));
    assert.ok(!/\bwidth: [3-9]\d\d\b/.test(text), file + ' has a fixed width');
  });
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
