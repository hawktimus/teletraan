// Tests for the Robotics view (docs/views.md): its layouts chosen by the panel, its title and team plate, no view tag, the
// departments of the Team leads (Design and CNC as one), the roster from the Monday board and the two placeholder panels.
//
//   node tests/robotics.test.mjs

import assert from 'node:assert/strict';
import { config, contentOf, dashboardFolder, load, now, read, registry, runTests, task, test, views } from './helpers/monday-world.mjs';

const playing = await load('core/views.js');
const rosterModule = await load('core/roster.js');
const placeholder = await load('core/placeholder.js');
const leadDepartments = await load('core/lead-departments.js');

const lead = (id, name, order) => ({ id: id, name: name, order: order });
const board = () => contentOf([
  task({ title: '[A]', subteamId: 'lead-design', subteam: '[Design]', team: 'prime', contact: '[Ann]', owners: ['[Ann]'], estHours: 10 }),
  task({ title: '[B]', subteamId: 'lead-cnc', subteam: 'CNC', team: 'nova', contact: '[Ben]', owners: ['[Ben]', '[Ann]'], estHours: 6 }),
  task({ title: '[C]', subteamId: 'lead-business', subteam: 'Business', team: '', contact: '[Cy]', owners: ['[Cy]'], estHours: 4 }),
  task({ title: '[D]', subteamId: 'lead-build', subteam: '[Build]', team: 'prime', contact: '[Dee]', owners: ['[Dee]'], estHours: 3 }),
], raw => {
  raw.subteams = [lead('lead-build', '[Build]', 1), lead('lead-design', 'Design', 2), lead('lead-cnc', 'CNC', 3), lead('lead-business', 'Business', 4)];
});

test('the Robotics layout is chosen by the panel: wide for the Monday cards, the roster and the placeholders, split for the rest', () => {
  const content = board();
  const layout = panel => playing.layoutOfStep(content, { view: 'general', panel: panel });

  ['monday-department', 'monday-charts', 'roster', 'robotStatus', 'wireframe'].forEach(panel => assert.equal(layout(panel), 'bar', panel));
  ['tonight', 'events', 'leadership', 'photo', 'sponsor-feature'].forEach(panel => assert.equal(layout(panel), 'standard', panel));
  assert.equal(playing.layoutOfStep(content, { view: 'prime', panel: 'monday-department' }), 'bar', 'Prime keeps the layout of its document');
});

test('the title of the Robotics banner is HAWKTIMUS ROBOTICS and no view draws a tag', () => {
  const content = board();
  assert.equal(playing.viewTitleOf(content, 'general'), 'HAWKTIMUS ROBOTICS');
  assert.equal(config.roboticsTitle, 'HAWKTIMUS ROBOTICS');
  ['general', 'prime', 'nova'].forEach(key => assert.equal(playing.viewShowsTag(content, key), false));
});

test('the Robotics view shows both team numbers on the team plate, in both layouts', () => {
  ['panels/banner/panel.js', 'panels/bar-column/panel.js'].forEach(file => {
    const code = read(file);
    assert.ok(code.includes('teamNumbersOf(content)') && code.includes('number-second'), file + ' has both numbers');
  });
  const css = read('family-line.css');
  assert.ok(/html\[data-view="general"\] \.banner\[data-plate="two"\] \.team-plate \{ width: 940px; \}/.test(css), 'one wide plate in the standard layout');
  assert.ok(/html\[data-view="general"\] \.bar-column\[data-plate="two"\]/.test(css), 'two lines in the side column');
  assert.equal(config.roboticsPlate, undefined, 'there are no words for the plate in config');
});

test('Design and CNC are one department of the Team leads, DESIGN · CNC, with the tasks of both', () => {
  const content = board();
  const list = leadDepartments.departmentsOf(content, content.tasks, now);
  const design = list.find(item => item.name === config.designDepartment);
  assert.ok(design);
  assert.deepEqual(design.ids, ['lead-design', 'lead-cnc']);
  assert.equal(list.filter(item => /cnc|design/i.test(item.name) && item !== design).length, 0);
});

test('the roster comes from the owners of the board and their hours, six rows a page, Design and CNC together', () => {
  const content = board();
  const pages = rosterModule.mondayRosterPages(content, now, '');
  const design = pages.find(page => page.department === config.designDepartment);
  assert.deepEqual(design.rows, [{ name: '[Ann]', hours: 13 }, { name: '[Ben]', hours: 3 }]);

  const many = contentOf(Array.from({ length: 8 }, (_, index) => task({ title: '[T' + index + ']', contact: '[P' + index + ']', owners: ['[P' + index + ']'], estHours: 8 - index })));
  const build = rosterModule.mondayRosterPages(many, now, '').filter(page => page.department === '[Build]');
  assert.deepEqual(build.map(page => page.rows.length), [6, 2]);
  assert.equal(config.rosterPageRows, 6);
});

test('robotStatus and wireframe are registered large panels that draw a title and a dashed frame and nothing else', () => {
  ['robotStatus', 'wireframe'].forEach(id => {
    const found = registry.panels.find(panel => panel.id === id);
    assert.ok(found && found.region === 'grid1' && found.placeholder === true, id);
    assert.ok(read('panels/' + id + '/panel.js').includes('placeholderMarkup'));
    assert.ok(/border: 4px dashed/.test(read('panels/' + id + '/panel.css')));
  });
  assert.deepEqual(config.placeholderPanels, { robotStatus: 'ROBOT STATUS', wireframe: '3D VIEW' });
  const html = placeholder.placeholderMarkup('robotStatus', 'ROBOT STATUS');
  assert.ok(html.includes('>ROBOT STATUS</h2>') && html.includes('placeholder-frame'));
  assert.equal(html.replace(/<[^>]*>/g, '').trim(), 'ROBOT STATUS');
});

test('a Robotics row can name a placeholder, and general is robotics in the list', async () => {
  const rotation = await load('core/rotation.js');
  const rows = rotation.tidyRotationRows([{ view: 'general', panel: 'wireframe', shown: true, seconds: 20 }]);
  assert.deepEqual(rows.map(row => [row.view, row.panel]), [['robotics', 'wireframe']]);
  assert.ok(dashboardFolder.length > 0);
});

await runTests();
