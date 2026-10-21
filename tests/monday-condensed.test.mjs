// Tests for the rule "a Monday board plays in the Condensed view" (docs/monday.md, docs/views.md): a Monday row of a Robotics
// block plays in the Condensed view (family, the bar layout) for the length of the step, an older monday-tasks row is judged
// as the Department tasks row it plays as, no small panel is drawn in the bar layout, and the Studio board, the control page
// and the row preview say and draw the same.
//
//   node tests/monday-condensed.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentOf, dashboardFolder, load, now, read, runTests, task, test } from './helpers/monday-world.mjs';
import * as displayRows from '../control/static/display-rows.js';
import * as studioBoard from '../studio/tools/rotation-board.js';
import { chipHtml, rowsHtml } from '../control/static/tabs/display-parts.js';

const playing = await load('core/views.js');
const rotation = await load('core/rotation.js');
const rowPreview = await load('core/row-preview.js');
const still = await load('core/still.js');
const config = await load('config.js');

const tasks = [
  task({ title: '[A]', department: 'marketing', subteam: '[Build]' }),
  task({ title: '[B]', department: 'build' }),
  task({ title: '[C]', department: 'electrical', subteam: '[Electrical]', subteamId: 'lead-electrical' }),
];

const row = (view, panel, extra) => Object.assign({ view: view, panel: panel, seconds: 10, shown: true }, extra);
const oldRow = row('robotics', 'monday-tasks', { department: 'marketing' });

function content(rows) {
  return contentOf(tasks, raw => { raw.settings.rotationRows = rows; });
}

const plan = steps => steps.map(step => step.panel + ':' + step.view);

test('an older monday-tasks row with a department is a Department tasks step before any decision is made about it', () => {
  const found = content([row('robotics', 'leadership'), oldRow]);
  const steps = playing.viewSteps(found, 'general', now);

  assert.deepEqual(plan(steps), ['leadership:general', 'monday-department:family']);
  assert.equal(steps[1].page.department, 'marketing');
  assert.equal(steps[1].page.list, 'open');
  assert.equal(playing.layoutOfStep(found, steps[1]), 'bar', 'the layout is the one of the upgraded panel');
  assert.equal(rotation.upgradeMondayRow(oldRow).panel, 'monday-department');
  assert.equal(config.roboticsWidePanels.includes(oldRow.panel), false, 'the stored panel id alone would say split: it is never asked');
});

test('a Monday step of a Robotics block plays in the Condensed view, and the steps around it in Robotics', () => {
  const found = content([row('robotics', 'leadership'), row('robotics', 'monday-department', { department: 'build' }), row('robotics', 'monday-charts', { chart: 'status' }), row('robotics', 'leadership')]);
  const steps = playing.viewSteps(found, 'general', now);

  assert.deepEqual(plan(steps), ['leadership:general', 'monday-department:family', 'monday-charts:family', 'leadership:general']);
  assert.deepEqual(steps.map(step => playing.layoutOfStep(found, step)), ['standard', 'bar', 'bar', 'standard']);
  assert.equal(playing.layoutOfStep(found, steps[1]), playing.viewLayoutOf(found, 'family'), 'the Condensed view is the bar layout');
});

test('the Condensed steps keep the team of the Robotics look, and every row keeps its place', () => {
  const found = content([row('robotics', 'leadership'), row('robotics', 'monday-department', { department: 'build', team: 'prime' })]);
  const steps = playing.viewSteps(found, 'general', now);

  assert.equal(steps[1].team, steps[0].team, 'the look is the Robotics look: Prime');
  assert.equal(steps[1].page.team, 'prime', 'the tasks of the row are still the tasks of its team');
  assert.deepEqual(steps.map(step => step.row), [0, 1]);
});

test('a Monday row of a Prime or Nova block stays in that team view', () => {
  const found = content([row('prime', 'monday-department', { department: 'build' }), row('nova', 'monday-charts', { chart: 'status' })]);
  assert.deepEqual(plan(playing.viewSteps(found, 'prime', now)), ['monday-department:prime']);
  assert.deepEqual(plan(playing.viewSteps(found, 'nova', now)), ['monday-charts:nova']);
  assert.equal(playing.playViewOf('prime', 'monday-department'), 'prime');
  assert.equal(playing.playViewOf('general', 'events'), 'general');
  assert.equal(playing.playViewOf('general', 'monday-charts'), 'family');
});

test('a held Monday panel plays in the Condensed view too, and the boot look is the look of the Condensed view', () => {
  const found = content([row('robotics', 'monday-department', { department: 'build' }), row('robotics', 'leadership')]);
  playing.resetViews();
  const look = playing.holdBootView(found, now);

  assert.equal(playing.heldView(), 'family', 'the view that is held is the view of the first step');
  assert.equal(look.monday, true);
  playing.resetViews();
});

test('a card that comes from outside the rotation after a Monday board plays in the view the rotation is in, not in Condensed', () => {
  const found = content([row('robotics', 'monday-department', { department: 'build' }), row('robotics', 'leadership')]);
  playing.resetViews();
  playing.holdBootView(found, now);
  const card = { panel: 'competition-timeline', show: true, team: '' };

  assert.equal(playing.stepInView(card, found, 'family').view, 'general');
  assert.equal(playing.stepInView(card, found, 'general').view, 'general');
  assert.equal(playing.stepInView(card, found, 'prime').view, 'prime');
  playing.resetViews();
});

test('no small panel is drawn for a step in the bar layout', () => {
  playing.resetViews();
  assert.equal(playing.pairSide({ side: 'forecast', seconds: 10 }, 'standard'), true, 'a split step pairs its small panel');
  assert.deepEqual(playing.viewSidePlaylist(content([row('robotics', 'leadership')])).map(item => item.panel), ['forecast']);
  assert.equal(playing.pairSide({ side: 'forecast', seconds: 10 }, 'bar'), true, 'the small panel that was paired is moved on');
  assert.equal(playing.viewSidePlaylist(content([row('robotics', 'leadership')])).some(item => item.paired), false, 'and nothing new is paired in the bar layout');
  assert.equal(playing.pairSide({ side: 'forecast' }, 'bar'), false, 'nothing moves when nothing was paired');
  assert.deepEqual(playing.viewSideSteps(content([]), 'family'), [], 'the Condensed view has no small panel');
  playing.resetViews();
});

test('the layout is part of the look, so a change of layout inside a view reaches the page', () => {
  const code = read('core/theme-apply.js');
  assert.ok(code.includes('a.view === b.view && a.layout === b.layout'), 'sameLook compares the layout');
  assert.ok(code.includes('look.layout = layoutFor(look.style, layoutOf(look.theme));'), 'the wanted look carries the layout');
  const run = read('core/views-run.js');
  assert.ok(run.includes('if (pairSide(placed(step), layout)) moveOn([\'grid2\']);'), 'the layout of the step is asked before the small panel is paired');
  assert.ok(run.includes('const moved = heldView() !== \'\' && view !== heldView();'), 'a change of view is a swap, into the Condensed view and out of it');
});

test('the swap into and out of the Condensed view waits for what has the screen, as every view change does', () => {
  const run = read('core/views-run.js');
  assert.ok(run.includes('startSwaps(busyElsewhere, swapScaleNow)'), 'a swap never starts while a talk, an alert or an announcement has the screen');
  assert.ok(run.includes('frozen: busyElsewhere()'), 'the clock of the rows stands still then');
  const layout = read('core/layout-apply.js');
  assert.ok(layout.includes('busy && busy()'), 'a look with another layout waits for a swap or for a cover');
});

test('the Condensed view shows both team numbers on its plate, as Robotics does', () => {
  const css = read('family-line.css');
  assert.ok(css.includes('html:is([data-view="general"], [data-view="family"]) .banner[data-plate="two"] .team-plate { width: 940px; }'));
  assert.ok(css.includes('html:is([data-view="general"], [data-view="family"]) .bar-column[data-plate="two"] .bar-team .team-both {'));
});

test('the row preview draws an older Monday row as the Department tasks row, in the Condensed view', () => {
  const read1 = rowPreview.readRowPreview('rowpreview=' + encodeURIComponent(JSON.stringify(oldRow)));
  const params = rowPreview.useRowPreview(new URLSearchParams(), read1);

  assert.equal(params.get('panel'), 'monday-department');
  assert.equal(params.get('dept'), 'marketing');
  assert.equal(params.get('view'), 'family');
  assert.equal(params.get('team'), null, 'a Robotics row has no team');
  const asked = still.readStill(params);
  assert.equal(asked.layout, 'bar');
  assert.equal(asked.small, true, 'the row preview asks for a small panel, and the page leaves it out in the bar layout');
  assert.ok(read('core/still-run.js').includes("ask.small && ask.layout !== 'bar'"));

  const prime = rowPreview.useRowPreview(new URLSearchParams(), rowPreview.readRowPreview('rowpreview=' + encodeURIComponent(JSON.stringify(row('prime', 'monday-tasks', { department: 'build' })))));
  assert.equal(prime.get('panel'), 'monday-department');
  assert.equal(prime.get('view'), 'prime', 'a Prime row stays in the Prime view');
  assert.equal(prime.get('team'), 'prime');
});

test('the Studio board and the control page both say Plays in the Condensed view for a Monday row of Robotics, an older one included', () => {
  const cases = [
    [row('robotics', 'monday-department', { department: 'build' }), true],
    [row('robotics', 'monday-charts', { chart: 'status' }), true],
    [oldRow, true],
    [row('robotics', 'monday-tasks'), false],
    [row('robotics', 'leadership', { side: 'forecast' }), false],
    [row('robotics', 'roster'), false],
    [row('prime', 'monday-department', { department: 'build' }), false],
  ];

  cases.forEach(([item, wanted]) => {
    assert.equal(studioBoard.playsCondensed(item), wanted, 'studio ' + item.view + ' ' + item.panel);
    assert.equal(displayRows.playsCondensed(item), wanted, 'control ' + item.view + ' ' + item.panel);
  });
  assert.equal(studioBoard.condensedWords, displayRows.condensedWords);
  assert.equal(studioBoard.condensedWords, 'Plays in the Condensed view');
  assert.equal(studioBoard.layoutOf(oldRow), 'wide', 'the board judges the older row as the panel it plays as');
  assert.equal(studioBoard.hasSmallPanel(oldRow), false);
  assert.equal(studioBoard.hasSmallPanel(row('robotics', 'leadership')), true);
});

test('the Display tab note says the Condensed view in place of the small panel, for a Monday row', () => {
  const choices = { views: [{ value: 'robotics', title: 'Robotics' }], panelGroups: [{ title: 'Panels', panels: [{ value: 'monday-department', title: 'Department tasks' }, { value: 'leadership', title: 'Leadership' }] }], sideGroups: [{ title: 'Small', panels: [{ value: 'forecast', title: 'Weather forecast' }] }] };
  const rows = displayRows.withKeys([
    row('robotics', 'monday-department', { department: 'build', side: 'forecast' }),
    row('robotics', 'leadership', { side: 'forecast' }),
  ]);
  const html = rowsHtml(rows, { choices: choices, checks: {}, pageSeconds: 20, rows: rows, canWrite: true });

  assert.equal((html.match(/Plays in the Condensed view/g) || []).length, 1);
  assert.equal((html.match(/Small panel: Weather forecast/g) || []).length, 1, 'a split row still names its small panel');
  assert.ok(/Stays 10 seconds\. Plays in the Condensed view\./.test(html));
  assert.ok(typeof chipHtml === 'function');
});

test('the nine departments of the control page are the nine of the dashboard', () => {
  const folder = fileURLToPath(new URL('../control/static/display-rows.js', import.meta.url));
  const text = fs.readFileSync(folder, 'utf8');
  const listed = /mondayDepartmentIds = \[([^\]]*)\]/.exec(text)[1].split(',').map(item => item.trim().replace(/'/g, ''));

  assert.deepEqual(listed, config.mondayDepartments.map(item => item.value));
  assert.ok(fs.existsSync(path.join(dashboardFolder, 'family-line.css')));
});

await runTests();
