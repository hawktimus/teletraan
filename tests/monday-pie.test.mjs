// Tests for the status pie (dashboard/core/monday-pie.js, pieView in core/monday-views.js and panels/monday-pie): the slices, the
// counts by status for a team and for one department, the words and the sizes. The board is made up (tests/helpers/monday-world.mjs).
//
//   node tests/monday-pie.test.mjs

import assert from 'node:assert/strict';
import { config, contentOf, load, now, read, registry, runTests, task, test, views, wordsOf } from './helpers/monday-world.mjs';

const geometry = await load('core/monday-pie.js');
const panel = await load('panels/monday-pie/panel.js');

const board = () => contentOf([
  task({ title: '[A]', subteamId: 'lead-build', status: 'in-progress' }),
  task({ title: '[B]', subteamId: 'lead-build', status: 'in-progress' }),
  task({ title: '[C]', subteamId: 'lead-build', status: 'done', completedOn: '2026-10-14' }),
  task({ title: '[D]', subteamId: 'lead-build', status: 'blocked' }),
  task({ title: '[E]', subteamId: 'lead-electrical', status: 'up-next' }),
  task({ title: '[F]', subteamId: 'lead-electrical', status: 'done', completedOn: '2026-10-13' }),
  task({ title: '[G]', subteamId: 'lead-programming', team: 'nova', status: 'in-review' }),
], raw => {
  raw.subteams = [{ id: 'lead-build', name: 'Build', order: 1 }, { id: 'lead-electrical', name: 'Electrical', order: 2 }, { id: 'lead-programming', name: 'Programming', order: 3 }];
});

test('the panel is registered as a Monday card of a team, wide in the Robotics view, and offered in the builder', async () => {
  const entry = registry.panels.find(item => item.id === 'monday-pie');
  assert.ok(entry && entry.region === 'grid1' && entry.monday === true && entry.topic === 'monday');
  assert.equal(config.mondayKinds['monday-pie'], 'team');
  assert.ok(config.roboticsWidePanels.includes('monday-pie'));
  const picker = await import(new URL('../studio/inputs/screen-panels.js', import.meta.url).href);
  assert.ok(picker.rotationPanels.some(item => item.value === 'monday-pie'));
});

test('the slices go clockwise from the top, add up to 100 percent and cover the whole circle', () => {
  const slices = geometry.pieSlices([{ status: 'a', count: 1 }, { status: 'b', count: 1 }, { status: 'c', count: 1 }, { status: 'd', count: 0 }], 240, 240, 230, 130);
  assert.deepEqual(slices.map(item => item.status), ['a', 'b', 'c']);
  assert.equal(slices.reduce((sum, item) => sum + item.percent, 0), 100);
  assert.deepEqual(slices.map(item => item.percent).sort(), [33, 33, 34]);
  assert.equal(slices[0].from, 0);
  assert.equal(slices[2].to, 360);
  assert.ok(slices[0].path.startsWith('M240 10 A230 230 0 0 1'), 'the first slice starts at the top of the outer ring');
  assert.deepEqual(geometry.pieSlices([{ status: 'a', count: 0 }], 240, 240, 230, 130), []);
});

test('one status is a full ring, and a slice over half uses the large arc', () => {
  const full = geometry.pieSlices([{ status: 'a', count: 5 }], 240, 240, 230, 130);
  assert.equal(full[0].percent, 100);
  assert.ok(/ 0 1 1 /.test(full[0].path), 'a ring of 359.9 degrees uses the large arc');
  const half = geometry.slicePath(240, 240, 230, 130, 0, 200);
  assert.ok(half.includes(' 0 1 1 ') && half.includes(' 0 1 0 '));
  const small = geometry.slicePath(240, 240, 230, 130, 0, 90);
  assert.ok(small.includes(' 0 0 1 ') && small.includes(' 0 0 0 '));
  assert.equal(geometry.slicePath(240, 240, 230, 130, 0, 90), 'M240 10 A230 230 0 0 1 470 240 L370 240 A130 130 0 0 0 240 110 Z');
});

test('the pie of a team counts every status of its tasks, and of one department only that department', () => {
  const content = board();
  const team = views.pieView(content, now, { team: 'prime', department: '' });
  assert.equal(team.title, 'STATUS');
  assert.equal(team.total, 6);
  assert.deepEqual(team.legend.map(item => [item.status, item.name, item.count]), [['up-next', 'TO DO', 1], ['in-progress', 'IN PROGRESS', 2], ['in-review', 'REVIEW', 0], ['blocked', 'STUCK', 1], ['done', 'DONE', 2]]);
  assert.equal(team.legend.reduce((sum, item) => sum + item.percent, 0), 100);

  const build = views.pieView(content, now, { team: 'prime', department: 'build' });
  assert.equal(build.title, 'BUILD STATUS');
  assert.equal(build.total, 4);
  assert.deepEqual(build.slices.map(item => item.status), ['in-progress', 'blocked', 'done']);
});

test('a department with no task, and a team with none, have no pie', () => {
  const content = board();
  assert.equal(views.pieView(content, now, { team: 'prime', department: 'strategy' }), null);
  assert.equal(views.pieView(contentOf([]), now, { team: 'prime', department: '' }), null);
  assert.equal(panel.hasContent(contentOf([]), { team: 'prime', department: '' }), false);
  assert.equal(panel.hasContent(content, { team: 'prime', department: 'build' }), true);
});

test('a row with a department and no team is for both teams, as the Business rows are', () => {
  const content = contentOf([
    task({ title: '[A]', subteamId: 'lead-business', subteam: 'Business', team: '', status: 'done', completedOn: '2026-10-14' }),
    task({ title: '[B]', subteamId: 'lead-business', subteam: 'Business', team: 'nova', status: 'up-next' }),
  ], raw => {
    raw.subteams = [{ id: 'lead-business', name: 'Business', order: 1 }];
  });
  const view = views.pieView(content, now, { team: '', department: 'business' });
  assert.equal(view.total, 2);
  assert.equal(view.title, 'BUSINESS STATUS');
});

test('the markup has one path for each status, the total, the words and the percent', () => {
  const html = panel.markupFor(board(), now, { team: 'prime', department: 'build' });
  assert.equal((html.match(/<path class="slice /g) || []).length, 3);
  assert.ok(html.includes('BUILD STATUS'));
  const words = wordsOf(html);
  ['TO DO', 'IN PROGRESS', 'REVIEW', 'STUCK', 'DONE', 'TASKS'].forEach(word => assert.ok(words.includes(word), word));
  assert.ok(html.includes('class="pie-total"') && html.includes('>4</text>'));
  assert.ok(/50%/.test(words), 'two of four in progress is 50%');
  assert.ok(!/[–—!]/.test(html), 'no dash or exclamation mark');
  assert.ok(wordsOf(panel.markupFor(contentOf([]), now, { team: 'prime', department: '' })).includes('STATUS'));
});

test('the stylesheet uses tokens only, text of 44px or more, and no motion', () => {
  const css = read('panels/monday-pie/panel.css');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'no color written in the panel');
  Array.from(css.matchAll(/font:\s*[\d.]+\s+(\d+)px/g)).forEach(match => assert.ok(Number(match[1]) >= 44, 'font ' + match[1]));
  assert.ok(!/animation|transition|@keyframes|filter|blur|box-shadow/.test(css));
  assert.ok(!/animate|requestAnimationFrame/.test(read('panels/monday-pie/panel.js')));
});

await runTests();
