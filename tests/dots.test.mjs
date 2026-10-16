// Tests for the three dots on the TV (dashboard/core/dots.js): green inside twice the interval, amber past
// it or with no read, red on an error, and Sanity green inside 5 minutes.
//
//   node tests/dots.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dotState, dotStates, mondayEvery, tidyMini } from '../dashboard/core/dots.js';

let passed = 0;
function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const now = new Date('2026-10-15T12:00:00Z');
const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();

check('Monday is green inside twice mondayEveryMinutes, amber past it', () => {
  const dot = (minutes, every) => dotStates({ monday: { lastSyncAt: ago(minutes), lastError: '' }, everyMinutes: every }, now).monday.color;
  assert.equal(dot(10, 30), 'green');
  assert.equal(dot(60, 30), 'green');
  assert.equal(dot(61, 30), 'amber');
  assert.equal(dot(11, 5), 'amber');
  assert.equal(dot(9, 5), 'green');
  assert.equal(mondayEvery({}), 30);
  assert.equal(mondayEvery({ mondayEveryMinutes: 500 }), 120);
});

check('Band is green inside 30 minutes (twice 15), amber past it', () => {
  const dot = minutes => dotStates({ calendarAt: ago(minutes) }, now).band.color;
  assert.equal(dot(29), 'green');
  assert.equal(dot(30), 'green');
  assert.equal(dot(31), 'amber');
});

check('Sanity is green for a good read inside 5 minutes, amber past that', () => {
  const dot = minutes => dotStates({ sanityAt: new Date(now.getTime() - minutes * 60000) }, now).sanity.color;
  assert.equal(dot(1), 'green');
  assert.equal(dot(5), 'green');
  assert.equal(dot(6), 'amber');
});

check('an error is red, whatever the age', () => {
  assert.equal(dotStates({ monday: { lastSyncAt: ago(1), lastError: 'bad token' } }, now).monday.color, 'red');
  assert.equal(dotStates({ calendarAt: ago(1), calendarErrors: 2 }, now).band.color, 'red');
  assert.equal(dotStates({ sanityAt: now, sanityFailed: true }, now).sanity.color, 'red');
  assert.match(dotStates({ monday: { lastSyncAt: ago(1), lastError: 'bad token' } }, now).monday.reason, /bad token/);
});

check('no read at all is amber with a reason, and bad input does not throw', () => {
  const states = dotStates(null, now);
  Object.values(states).forEach(state => { assert.equal(state.color, 'amber'); assert.match(state.reason, /no read/i); });
  assert.equal(dotState(undefined, now).color, 'amber');
  assert.equal(dotState({ at: 'soon' }, now).color, 'amber');
});

check('the part of status-mini the screen asks for is always complete', () => {
  assert.deepEqual(tidyMini(null), { lastCalendarSyncAt: '', calendarErrors: 0 });
  assert.deepEqual(tidyMini({ lastCalendarSyncAt: ago(3), calendarErrors: 2.7 }), { lastCalendarSyncAt: ago(3), calendarErrors: 2 });
  assert.equal(tidyMini({ lastCalendarSyncAt: 'x', calendarErrors: -1 }).calendarErrors, 0);
});

check('the dots are 16px, 28px apart, in the ticker row, and the page has the element', () => {
  const css = fs.readFileSync(new URL('../dashboard/status-dots.css', import.meta.url), 'utf8');
  assert.match(css, /width: 16px;\s*height: 16px/);
  assert.match(css, /data-dot="band"\] \{ top: 28px/);
  assert.match(css, /data-dot="sanity"\] \{ top: 56px/);
  const page = fs.readFileSync(new URL('../dashboard/index.html', import.meta.url), 'utf8');
  assert.match(page, /id="status-dots"/);
  assert.match(page, /status-dots\.css/);
});

console.log(passed + ' of ' + passed + ' checks passed.');
