// Tests for the announcement bar (dashboard/core/notice.js): which announcements are live, the edges of the
// window, the team, two that take turns every 12 seconds, and none once they are past.
//
//   node tools/test-notice.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeContent, normalizeSample } from '../dashboard/core/sanity.js';
import { liveNotices, noticeUp, sizeFor, tidyNotices } from '../dashboard/core/notice.js';

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const start = '2026-10-15T14:00:00Z';
const end = '2026-10-15T16:00:00Z';
const at = text => Date.parse(text);

function notice(extra) {
  return Object.assign({ _id: 'a', text: 'Meeting moved to 5 pm', start: start, end: end, level: 'notice', team: '' }, extra);
}

test('it is live from its start up to but not including its end', () => {
  const list = [notice()];
  assert.equal(liveNotices(list, at('2026-10-15T13:59:59.999Z'), 'prime').length, 0);
  assert.equal(liveNotices(list, at(start), 'prime').length, 1);
  assert.equal(liveNotices(list, at('2026-10-15T15:59:59.999Z'), 'prime').length, 1);
  assert.equal(liveNotices(list, at(end), 'prime').length, 0);
});

test('a Date works as well as milliseconds', () => {
  assert.equal(liveNotices([notice()], new Date('2026-10-15T15:00:00Z'), 'prime').length, 1);
});

test('an announcement for no team is for both, and one for a team is for that team only', () => {
  const list = [notice({ _id: 'both' }), notice({ _id: 'nova', team: 'nova' })];
  const now = at('2026-10-15T15:00:00Z');
  assert.deepEqual(liveNotices(list, now, 'prime').map(item => item.id), ['both']);
  assert.deepEqual(liveNotices(list, now, 'nova').map(item => item.id), ['both', 'nova']);
});

test('none is up when nothing is live, and none is up once they are all past', () => {
  assert.equal(noticeUp([], Date.now()), null);
  const past = liveNotices([notice(), notice({ _id: 'b' })], at('2026-10-15T17:00:00Z'), 'prime');
  assert.equal(past.length, 0);
  assert.equal(noticeUp(past, at('2026-10-15T17:00:00Z')), null);
});

test('one live announcement is always the one up', () => {
  const live = liveNotices([notice()], at('2026-10-15T15:00:00Z'), 'prime');
  for (let second = 0; second < 60; second += 5) assert.equal(noticeUp(live, at('2026-10-15T15:00:00Z') + second * 1000).id, 'a');
});

test('two live announcements take turns every 12 seconds', () => {
  const list = [notice({ _id: 'a', start: '2026-10-15T14:00:00Z' }), notice({ _id: 'b', start: '2026-10-15T14:30:00Z' })];
  const base = Math.floor(at('2026-10-15T15:00:00Z') / 12000) * 12000;
  const live = liveNotices(list, base, 'prime');
  assert.deepEqual(live.map(item => item.id), ['a', 'b']);

  const seen = [0, 11, 12, 23, 24, 35, 36].map(second => noticeUp(live, base + second * 1000).id);
  assert.equal(seen[0], seen[1]);
  assert.notEqual(seen[1], seen[2]);
  assert.equal(seen[2], seen[3]);
  assert.equal(seen[4], seen[0]);
  assert.equal(seen[5], seen[0]);
  assert.equal(seen[6], seen[2]);
});

test('the order of two live announcements follows their start, then their id', () => {
  const list = [notice({ _id: 'z', start: '2026-10-15T14:10:00Z' }), notice({ _id: 'y', start: '2026-10-15T14:05:00Z' })];
  assert.deepEqual(liveNotices(list, at('2026-10-15T15:00:00Z'), 'prime').map(item => item.id), ['y', 'z']);
});

test('text with nothing in it, times that are not times and an end before the start are left out', () => {
  const list = [notice({ text: '   ' }), notice({ start: 'soon' }), notice({ end: '2026-10-15T13:00:00Z' }), notice({ _id: 'good' })];
  assert.deepEqual(tidyNotices(list).map(item => item.id), ['good']);
});

test('the text is cut to 90 characters and an unknown level is a notice', () => {
  const [item] = tidyNotices([notice({ text: 'x'.repeat(120), level: 'loud' })]);
  assert.equal(item.text.length, 90);
  assert.equal(item.level, 'notice');
  assert.equal(tidyNotices([notice({ level: 'important' })])[0].level, 'important');
});

test('tidying twice changes nothing', () => {
  const once = tidyNotices([notice()]);
  assert.deepEqual(tidyNotices(once), once);
});

test('a sample announcement is live only when it is asked for', () => {
  const list = [notice({ sample: true })];
  const now = at('2026-10-15T15:00:00Z');
  assert.equal(liveNotices(list, now, 'prime').length, 0);
  assert.equal(liveNotices(list, now, 'prime', true).length, 1);
});

test('a line that fits is drawn at 52 and a longer one at 44', () => {
  assert.equal(sizeFor('Meeting at 5 pm', 1760), 52);
  assert.equal(sizeFor('A'.repeat(60), 1760), 44);
});

test('the content has notices from the query, tidy, and an empty list without any', () => {
  const content = normalizeContent({ notices: [{ _id: 'n1', text: 'Hi', start: start, end: end, level: 'important', team: 'nova' }] });
  assert.equal(content.notices.length, 1);
  assert.equal(content.notices[0].team, 'nova');
  assert.deepEqual(normalizeContent({}).notices, []);
});

test('the sample content has one announcement, live only with ?notice=1', () => {
  const sample = JSON.parse(fs.readFileSync(new URL('../dashboard/data/sample/content.json', import.meta.url), 'utf8'));
  const content = normalizeSample(sample);
  assert.equal(content.notices.length, 1);
  assert.equal(liveNotices(content.notices, Date.now(), 'prime').length, 0);
  assert.equal(liveNotices(content.notices, Date.now(), 'prime', true).length, 1);
});

let failed = 0;
for (const item of tests) {
  try {
    await item.run();
    console.log('PASS  ' + item.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + item.name + '\n      ' + error.message);
  }
}
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' tests passed.');
process.exit(failed === 0 ? 0 : 1);
