// Tests for the console keys of the Raspberry Pi copy (dashboard/core/console-keys.js) and the step back of the
// large panel (placeBefore in dashboard/core/schedule-hold.js). Nothing is drawn.
//
//   node tests/console-keys.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test, finish } from './helpers/runner.mjs';
import { consoleAction, consoleKeysFree, consoleKeysOn, quietMs } from '../dashboard/core/console-keys.js';
import { placeBefore } from '../dashboard/core/step-back.js';

const repo = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, repo), 'utf8');

test('the keys are on only when the address asks for them, so the screen on the wall never has them', () => {
  assert.equal(consoleKeysOn('?keys=console'), true);
  assert.equal(consoleKeysOn('?sample=1&keys=console'), true);
  ['', '?', '?keys', '?keys=', '?keys=other', '?sample=1', undefined, null].forEach(search => assert.equal(consoleKeysOn(search), false, String(search)));

  const shell = read('dashboard/shell.js');
  assert.ok(shell.includes("if (consoleKeysOn(window.location.search)) startOptional('./core/console-keys-run.js'"), 'the page loads the keys only behind the check');
  assert.equal(shell.split('console-keys-run.js').length, 2, 'and nowhere else');
});

test('X is next, Z is back, Esc leaves and Right Shift opens the control page', () => {
  assert.equal(consoleAction({ key: 'x', code: 'KeyX' }), 'next');
  assert.equal(consoleAction({ key: 'X', code: 'KeyX' }), 'next');
  assert.equal(consoleAction({ key: 'z', code: 'KeyZ' }), 'back');
  assert.equal(consoleAction({ key: 'Escape', code: 'Escape' }), 'leave');
  assert.equal(consoleAction({ key: 'Shift', code: 'ShiftRight' }), 'control');

  assert.equal(consoleAction({ key: 'Shift', code: 'ShiftLeft' }), null, 'the left Shift is only a Shift');
  ['a', 'Enter', ' ', 'PageDown', 'F5', 'p'].forEach(key => assert.equal(consoleAction({ key: key, code: '' }), null, key));
  assert.equal(consoleAction({ key: 'x', code: 'KeyX', repeat: true }), null, 'a held key acts once');
  ['ctrlKey', 'altKey', 'metaKey'].forEach(modifier => assert.equal(consoleAction({ key: 'x', code: 'KeyX', [modifier]: true }), null, modifier));
  assert.equal(consoleAction(null), null);
});

test('the keys do nothing while a talk or the list has the screen, and for a moment after', () => {
  assert.equal(consoleKeysFree(false, 0, 100000), true);
  assert.equal(consoleKeysFree(true, 0, 100000), false);
  assert.equal(consoleKeysFree(false, 100000 - quietMs + 1, 100000), false, 'the Esc that closed the list does not also leave');
  assert.equal(consoleKeysFree(false, 100000 - quietMs, 100000), true);
});

// A list of steps where some cannot be shown. nextFrom is what the loop of the large panel does: the first step
// after the standing place that can be shown, going round.
function listOf(shown) {
  return place => {
    for (let tries = 1; tries <= shown.length; tries++) {
      const index = (((place + tries) % shown.length) + shown.length) % shown.length;
      if (shown[index]) return index;
    }
    return -1;
  };
}

test('a step back stands where the step before is chosen next, and passes over steps that cannot be shown', () => {
  const all = listOf([true, true, true, true]);
  assert.equal(all(placeBefore(2, 4, all)), 1);
  assert.equal(all(placeBefore(0, 4, all)), 3, 'from the first step it goes round to the last');

  const gaps = listOf([true, false, false, true, true]);
  assert.equal(gaps(placeBefore(3, 5, gaps)), 0, 'the two steps with nothing to show are passed over');
  assert.equal(gaps(placeBefore(0, 5, gaps)), 4);

  const one = listOf([false, true, false]);
  assert.equal(one(placeBefore(1, 3, one)), 1, 'with one step to show, it is played again');
  assert.equal(placeBefore(0, 1, listOf([true])), -1);
});

test('the loop of the large panel and the Screens are wired to the step back', () => {
  const run = read('dashboard/core/schedule-run.js');
  assert.ok(run.includes('followRowSkips();\n        followStepBacks();'));
  assert.ok(run.includes("if (region !== 'grid1' || position < 0) return;"), 'only the large panel goes back');
  const keys = read('dashboard/core/console-keys-run.js');
  assert.ok(keys.includes("if (action === 'next' && !panelBusy()) moveOn(['grid1']);") && keys.includes("if (action === 'back' && !panelBusy()) backStep();"));
  assert.ok(keys.includes('return swapRunning() || takeoverRunning() || demoRunning() || nightIsUp() || hiddenPlaying();'), 'the keys wait for the same things as Next look now');
  assert.ok(!/method:/.test(keys), 'the watcher is only asked for an address, nothing is sent');
});

await finish();
