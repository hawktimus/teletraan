// Tests for DRIVE HOURS (panels/driveHours and driveHoursPages in core/roster.js): the hours of the board added up for each
// person, the most first, six rows a page, scrolled, and skipped when nobody has hours.
//
//   node tests/drive-hours.test.mjs

import assert from 'node:assert/strict';
import { config, contentOf, load, now, read, registry, runTests, task, test, wordsOf } from './helpers/monday-world.mjs';

const roster = await load('core/roster.js');
const panel = await load('panels/driveHours/panel.js');

const person = (name, hours, extra) => task(Object.assign({ title: '[' + name + ']', contact: name, owners: [name], estHours: hours, status: 'in-progress' }, extra));
const crowd = () => contentOf([
  person('[Ann]', 10), person('[Ann]', 5), person('[Ben]', 20, { team: 'nova' }), person('[Cy]', 7), person('[Dee]', 3), person('[Eli]', 9), person('[Fay]', 1),
  person('[Gus]', 2), person('[Hal]', 4, { team: 'nova' }),
  task({ title: '[shared]', contact: '[Ivy]', owners: ['[Ivy]', '[Ann]'], estHours: 8 }),
  task({ title: '[nobody]', contact: '', owners: [], estHours: 50 }),
]);

test('the panel is a large panel of the registry with a script and a stylesheet, and it is wide in the Robotics view', () => {
  const entry = registry.panels.find(item => item.id === 'driveHours');
  assert.ok(entry && entry.region === 'grid1' && !entry.monday);
  assert.ok(config.roboticsWidePanels.includes('driveHours'));
});

test('the hours are added for each person, the most first, and a task with several owners is shared', () => {
  const both = roster.driveHoursPages(crowd(), now, '');
  assert.deepEqual(both.rows.slice(0, 3), [{ name: '[Ben]', hours: 20 }, { name: '[Ann]', hours: 19 }, { name: '[Eli]', hours: 9 }]);
  assert.ok(both.rows.some(item => item.name === '[Ivy]' && item.hours === 4));
  assert.ok(!both.rows.some(item => item.name === ''), 'a task with no owner adds no one');
});

test('a team view counts its own team, and the Robotics view both', () => {
  const prime = roster.driveHoursPages(crowd(), now, 'prime');
  const nova = roster.driveHoursPages(crowd(), now, 'nova');
  assert.ok(!prime.rows.some(item => item.name === '[Ben]') && prime.rows.some(item => item.name === '[Ann]'));
  assert.deepEqual(nova.rows, [{ name: '[Ben]', hours: 20 }, { name: '[Hal]', hours: 4 }]);
});

test('six rows make a page, and the panel is held once for each page', () => {
  const both = roster.driveHoursPages(crowd(), now, '');
  assert.equal(both.rows.length, 9);
  assert.equal(both.pages, 2);
  assert.equal(panel.scrollPages(crowd()), 2, 'the team on the screen has seven people');
  assert.equal(panel.scrollPages(contentOf([person('[Ann]', 3)])), 1);
});

test('a board with no hours has nothing to show', () => {
  assert.equal(roster.driveHoursPages(contentOf([]), now, '').rows.length, 0);
  assert.equal(panel.hasContent(contentOf([person('[Ann]', 0)])), false);
  assert.equal(panel.hasContent(crowd()), true);
});

test('the title is DRIVE HOURS, the page is the roster board, and the rows are padded to whole windows of six', () => {
  const host = { innerHTML: '' };
  panel.mount(host, crowd());
  const words = wordsOf(host.innerHTML);
  assert.ok(words.startsWith('DRIVE HOURS'));
  assert.ok(host.innerHTML.includes('roster-board') && host.innerHTML.includes('data-scroll-list'));
  const rows = host.innerHTML.match(/class="person[" ]/g) || [];
  assert.equal(rows.length % 6, 0);
  assert.ok(/\d+ HRS/.test(words));
});

test('the stylesheet and the script have no motion and no small text', () => {
  assert.ok(!/animation|transition|@keyframes|filter|blur/.test(read('panels/driveHours/panel.css')));
  assert.ok(!/font:\s*\d+\s+(\d)px/.test(read('panels/driveHours/panel.css')));
  assert.ok(!/animate|requestAnimationFrame/.test(read('panels/driveHours/panel.js')));
});

await runTests();
