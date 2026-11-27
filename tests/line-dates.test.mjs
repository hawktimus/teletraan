// Tests for the dates written in ticker lines (dashboard/core/line-dates.js) and for the ticker
// leaving out a line with no Expires whose own date has passed.
//
//   node tests/line-dates.test.mjs

import assert from 'node:assert/strict';
import { datesIn, lineDatePassed } from '../dashboard/core/line-dates.js';
import { items } from '../dashboard/panels/ticker/panel.js';

let passed = 0;
function test(name, run) {
  run();
  passed += 1;
  console.log('ok ' + name);
}

const nov27 = new Date(2026, 10, 27, 1, 0, 0);

test('a line with no date never counts as passed', () => {
  ['Wear safety glasses at every machine', 'Measure Twice and Cut Once', 'Print the 3D parts first', 'You may 2 times', ''].forEach(text => {
    assert.equal(lineDatePassed(text, nov27), false, text);
  });
});

test('a deadline from yesterday has passed and one from tomorrow has not', () => {
  assert.equal(lineDatePassed('Declare interest for both drive teams by Nov 26th!', nov27), true);
  assert.equal(lineDatePassed('Declare interest for both drive teams by Nov 28th!', nov27), false);
});

test('the day itself counts until its end', () => {
  assert.equal(lineDatePassed('Forms due Nov 27', nov27), false);
  assert.equal(lineDatePassed('Forms due Nov 27', new Date(2026, 10, 28, 0, 0, 1)), true);
});

test('a date with no year is the nearest one, so spring dates seen in November are still to come', () => {
  assert.equal(lineDatePassed('HSHS will host the Wake County competition April 2-4', nov27), false);
  assert.equal(lineDatePassed('Game Drop is January 9th. Get Ready to Build!', nov27), false);
  assert.equal(lineDatePassed('Submit your Biocore T-Shirt design by Jan 23rd', nov27), false);
});

test('in a range the last day counts', () => {
  const april3 = new Date(2027, 3, 3, 12, 0, 0);
  const april5 = new Date(2027, 3, 5, 12, 0, 0);
  assert.equal(lineDatePassed('Volunteers wanted for April 2-4', april3), false);
  assert.equal(lineDatePassed('Volunteers wanted for April 2-4', april5), true);
});

test('long and short month names, a dot and the day endings are read', () => {
  assert.equal(datesIn('by Sept. 3rd', nov27).length, 1);
  assert.equal(datesIn('on December 1st and Dec 2', nov27).length, 2);
  assert.equal(datesIn('February 30', nov27).length, 0, 'a day that does not exist is not a date');
});

test('the ticker leaves out a stale line only when it has no Expires', () => {
  const content = {
    tipsAndNews: [
      { kind: 'tip', text: 'Declare interest by Nov 26th!' },
      { kind: 'tip', text: 'Sign up by Nov 26th', expires: '2026-12-31T12:00' },
      { kind: 'tip', text: 'Label your wires at both ends' },
    ],
    sponsors: [],
    news: { items: [] },
    settings: {},
  };
  const texts = items(content).map(line => line.text);
  const stale = lineDatePassed('Declare interest by Nov 26th!');
  assert.equal(texts.includes('Declare interest by Nov 26th!'), !stale);
  assert.ok(texts.includes('Sign up by Nov 26th'), 'an Expires set in Studio wins');
  assert.ok(texts.includes('Label your wires at both ends'));
});

console.log(passed + ' passed');
