// The plain rules of the Content blocks (control/static/tabs/content-items.js): item chips, sort and renumber, the roster grouped by
// team and role, the ticker line, and the hidden news links. The ticker tags are compared with the ones the dashboard draws.
//
//   node tests/control-content-items.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chipsOf, hiddenAfter, newsLine, renumbered, rosterGroups, sortItems, tickerLine, tickerTags } from '../control/static/tabs/content-items.js';

let passed = 0;
function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const item = (id, document, extra = {}) => Object.assign({ id: id, document: document, published: true, isDraft: false }, extra);
const now = new Date('2026-10-21T12:00:00Z');

check('the ticker tags are the ones the dashboard ticker draws', () => {
  const source = fs.readFileSync(new URL('../dashboard/panels/ticker/panel.js', import.meta.url), 'utf8');
  Object.keys(tickerTags).forEach(kind => assert.ok(source.includes(kind + ": { word: '" + tickerTags[kind] + "'"), kind));
  assert.deepEqual(tickerLine('reminder', '  Sign it  '), { tag: 'REMINDER', text: 'Sign it' });
  assert.equal(tickerLine('tip', '   '), null, 'a line with no text is skipped');
  assert.equal(tickerLine(undefined, 'Hi').tag, 'NEWS', 'no kind is news');
  assert.equal(tickerLine('thanks', 'Hi').tag, 'NEWS', 'an editor cannot make a thank you line');
});

check('a news headline is cut to the ticker length with FIRST: in front', () => {
  assert.equal(newsLine('Short'), 'FIRST: Short');
  assert.equal(newsLine('x'.repeat(200)).length <= 90, true);
  assert.match(newsLine('x'.repeat(200)), /\.\.\.$/);
});

check('chips say whether an item is new, waiting, hidden, expired or shown', () => {
  assert.deepEqual(chipsOf(item('a', { show: true }), now).map(chip => chip.id), ['shown']);
  assert.deepEqual(chipsOf(item('a', { show: false }), now).map(chip => chip.id), ['hidden']);
  assert.deepEqual(chipsOf(item('a', { show: true, expires: '2026-10-01T00:00:00Z' }), now).map(chip => chip.id), ['expired']);
  assert.deepEqual(chipsOf(item('a', { show: true }, { published: false, isDraft: true }), now).map(chip => chip.id), ['new', 'shown']);
  assert.deepEqual(chipsOf(item('a', { show: false }, { isDraft: true }), now).map(chip => chip.id), ['waiting', 'hidden']);
});

check('items sort by order with no order last, and a move renumbers in tens only where it changes', () => {
  const list = [item('c', { order: 30, text: 'c' }), item('n', { text: 'n' }), item('a', { order: 10, text: 'a' }), item('b', { order: 20, text: 'b' })];
  const sorted = sortItems(list, one => one.document.text);
  assert.deepEqual(sorted.map(one => one.id), ['a', 'b', 'c', 'n']);
  assert.deepEqual(renumbered(['a', 'b', 'c', 'n'], list, 'b', -1), [{ id: 'b', order: 10 }, { id: 'a', order: 20 }, { id: 'n', order: 40 }]);
  assert.deepEqual(renumbered(['a', 'b'], list, 'a', -1), [], 'the first cannot go up');
});

check('the roster is grouped by team then role with counts, Both teams last, and an empty team left out', () => {
  const ref = id => ({ _type: 'reference', _ref: id });
  const teams = [{ id: 't1', name: 'Prime' }, { id: 't2', name: 'Nova' }];
  const people = [
    item('1', { firstName: 'Zed', role: 'student', team: ref('t1') }),
    item('2', { firstName: 'Amy', role: 'student', team: ref('t1') }),
    item('3', { firstName: 'Max', role: 'coach', team: ref('t1') }),
    item('4', { firstName: 'Pat', role: 'parent' }),
    item('5', { firstName: 'Lee', role: 'leadership', team: ref('gone') }),
    item('6', { firstName: 'Kim' }),
  ];
  const groups = rosterGroups(people, teams);
  assert.deepEqual(groups.map(group => [group.title, group.count]), [['Prime', 3], ['Both teams', 3]]);
  assert.deepEqual(groups[0].roles.map(role => [role.title, role.count]), [['Mentors and Coaches', 1], ['Students', 2]]);
  assert.deepEqual(groups[0].roles[1].items.map(one => one.document.firstName), ['Amy', 'Zed']);
  assert.deepEqual(groups[1].roles.map(role => role.title), ['Leadership', 'Parents', 'No role']);
});

check('a headline is hidden up to the most, and shown again by taking it out', () => {
  assert.deepEqual(hiddenAfter(['a'], 'b', true, 5), { list: ['a', 'b'], problem: '' });
  assert.deepEqual(hiddenAfter(['a', 'b'], 'a', false, 5), { list: ['b'], problem: '' });
  assert.match(hiddenAfter(['a', 'b'], 'c', true, 2).problem, /Up to 2/);
});

console.log('\n' + passed + ' of ' + passed + ' passed');
