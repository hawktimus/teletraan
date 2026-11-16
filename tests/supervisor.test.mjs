// Tests for the supervisor: the ladder, the reboot gate and degraded mode (computer/scripts/supervisor-plan.mjs and
// computer/scripts/ledger.mjs). Every one runs with a fake clock and made-up checks, so the whole thing can be walked
// through without a computer that is actually broken.
//
// What has to hold, and why each one matters:
//   a problem step 1 fixes never reaches step 2        the gentlest repair wins and nothing goes black
//   a problem nothing fixes reboots once, then stops   this is the loop breaker
//   a failing source with a working network never reboots  the school filter is not fixed by rebooting
//   three boots in an hour stops rebooting altogether  a boot loop ends
//   the first ten minutes after a boot stay gentle     a computer that just came back is given time
//   every reason shares the limits                     five repair paths cannot add up to five reboots
//   the ledger survives a reboot                       the limits are written down before the machine goes down
//
//   node tests/supervisor.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  afterBoot, gateReboot, limits, plan, readHealth, readLedger, stateWords, steps,
} from '../computer/scripts/supervisor-plan.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
let passed = 0;

function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const minute = 60000;
const hour = 60 * minute;
// A fixed moment, so nothing here depends on when the test is run
const start = Date.parse('2026-11-06T14:00:00Z');

// A health file to try things against. Each entry is a check: a number of minutes means it has been failing that long,
// and null means it passes.
function health(failing, nowMs = start) {
  const checks = {};
  Object.entries(failing).forEach(([name, minutesAgo]) => {
    checks[name] = { ok: minutesAgo === null, since: new Date(nowMs - (minutesAgo || 0) * minute).toISOString(), detail: 'made up' };
  });
  return readHealth({ checks: checks });
}

function ledgerOf(raw) {
  return readLedger(raw || {});
}

// One turn of the supervisor: what it would do, and the state it would keep
function turn(failing, raw, options = {}) {
  const nowMs = options.nowMs || start;
  const made = plan(health(failing, nowMs), ledgerOf(raw), {
    nowMs: nowMs,
    uptimeSeconds: options.uptimeSeconds === undefined ? 4 * 3600 : options.uptimeSeconds,
    networkOk: options.networkOk === undefined ? false : options.networkOk,
  });
  return made;
}

// ----- the ladder -----

check('the ladder has the five steps the documentation promises, in order', () => {
  assert.deepEqual(steps.map(step => step.action), ['reload', 'restart-service', 'restart-kiosk', 'restart-network', 'reboot']);
  assert.deepEqual(steps.map(step => step.minutes), [1, 5, 10, 20, 30]);
});

check('a problem failing for a minute gets the page loaded again and nothing else', () => {
  const made = turn({ frames: 2 });
  assert.equal(made.actions.length, 1);
  assert.equal(made.actions[0].action, 'reload');
  assert.equal(made.actions[0].step, 1);
});

check('a problem that step 1 fixed never reaches step 2', () => {
  // The check passes again, and the state goes back to the bottom of the ladder
  const made = turn({ frames: null }, { problems: { frames: { since: start - 3 * minute, lastStep: 1, lastActionAt: start - 3 * minute } } });
  assert.equal(made.actions.length, 0);
  assert.equal(made.problems.frames.lastStep, 0);
  assert.equal(made.problems.frames.since, 0);
  assert.ok(made.notes.some(note => /is fixed/.test(note)));
});

check('a step waits to see whether the last one worked before the next is tried', () => {
  const made = turn({ frames: 12 }, { problems: { frames: { since: start - 12 * minute, lastStep: 1, lastActionAt: start - 30 * 1000 } } });
  assert.equal(made.actions.length, 0, 'half a minute after an action, nothing else is tried');
});

check('the steps are climbed in order, one at a time', () => {
  const kept = { problems: { frames: { since: start - 12 * minute, lastStep: 1, lastActionAt: start - 5 * minute } } };
  const made = turn({ frames: 12 }, kept);
  assert.equal(made.actions.length, 1);
  assert.equal(made.actions[0].step, 2, 'the step after the one already taken, not the highest one that is due');
  assert.equal(made.actions[0].action, 'restart-service');
  assert.equal(made.actions[0].service, 'teletraan-kiosk');
});

check('a problem with no service of its own skips the service step', () => {
  // The display has no service to restart, so step 2 is not one of its steps at all
  const made = turn({ display: 12 }, { problems: { display: { since: start - 12 * minute, lastStep: 1, lastActionAt: start - 5 * minute } } });
  assert.equal(made.actions[0].step, 3, 'it goes to restarting the screen session');
});

check('only a network problem is offered the network step', () => {
  const screen = turn({ frames: 25 }, { problems: { frames: { since: start - 25 * minute, lastStep: 3, lastActionAt: start - 5 * minute } } });
  assert.equal(screen.actions.length, 0, 'a screen problem has no step 4, and step 5 is not due yet at 25 minutes');

  const net = turn({ network: 25 }, { problems: { network: { since: start - 25 * minute, lastStep: 1, lastActionAt: start - 5 * minute } } });
  assert.equal(net.actions[0].action, 'restart-network');
  assert.equal(net.actions[0].step, 4);
});

check('a paged problem never goes above restarting the screen in the first ten minutes after a boot', () => {
  const kept = { problems: { frames: { since: start - 40 * minute, lastStep: 3, lastActionAt: start - 5 * minute } } };
  const made = turn({ frames: 40 }, kept, { uptimeSeconds: 5 * 60 });
  assert.equal(made.actions.length, 0, 'no reboot five minutes after a boot');
});

// ----- the gate -----

check('an automatic reboot is refused inside ten minutes of any other reboot', () => {
  const answer = gateReboot({ reason: 'recovery', problem: 'frames', nowMs: start, uptimeSeconds: 4 * 3600 },
    ledgerOf({ reboots: [{ at: start - 4 * minute, reason: 'nightly' }] }));
  assert.equal(answer.allowed, false);
  assert.match(answer.why, /10 minutes is the most allowed/);
});

check('a person asking is refused inside ten minutes too', () => {
  const answer = gateReboot({ reason: 'remote', problem: '', nowMs: start, uptimeSeconds: 4 * 3600 },
    ledgerOf({ reboots: [{ at: start - 2 * minute, reason: 'recovery' }] }));
  assert.equal(answer.allowed, false, 'the ten minute gap holds for every reason');
});

check('a person asking is outside the automatic budget', () => {
  const busy = ledgerOf({
    reboots: [
      { at: start - 30 * minute, reason: 'recovery', problem: 'frames' },
      { at: start - 3 * hour, reason: 'watchdog', problem: 'frames' },
      { at: start - 5 * hour, reason: 'netwatch', problem: 'network' },
    ],
  });
  const automatic = gateReboot({ reason: 'recovery', problem: 'frames', nowMs: start, uptimeSeconds: 4 * 3600 }, busy);
  assert.equal(automatic.allowed, false, 'three automatic reboots in a day is the most allowed');

  const person = gateReboot({ reason: 'remote', problem: '', nowMs: start, uptimeSeconds: 4 * 3600 }, busy);
  assert.equal(person.allowed, true, 'and a person may still ask');
});

check('one automatic reboot in six hours', () => {
  const answer = gateReboot({ reason: 'watchdog', problem: 'frames', nowMs: start, uptimeSeconds: 10 * 3600 },
    ledgerOf({ reboots: [{ at: start - 2 * hour, reason: 'recovery', problem: 'frames' }] }));
  assert.equal(answer.allowed, false);
  assert.match(answer.why, /6 hours is the most allowed/);
});

check('the reasons share one budget, so five repair paths cannot make five reboots', () => {
  const mixed = ledgerOf({
    reboots: [
      { at: start - 7 * hour, reason: 'watchdog', problem: 'frames' },
      { at: start - 9 * hour, reason: 'netwatch', problem: 'network' },
      { at: start - 11 * hour, reason: 'recovery', problem: 'display' },
    ],
  });
  // Each of the three is old enough on its own, but together they are the day's limit
  ['recovery', 'netwatch', 'watchdog'].forEach(reason => {
    const answer = gateReboot({ reason: reason, problem: 'frames', nowMs: start, uptimeSeconds: 12 * 3600 }, mixed);
    assert.equal(answer.allowed, false, reason + ' is refused as well');
    assert.match(answer.why, /3 automatic reboots in a day/);
  });
});

check('a failing source while the network works never reaches a reboot', () => {
  const answer = gateReboot({ reason: 'recovery', problem: 'monday', nowMs: start, uptimeSeconds: 8 * 3600, networkOk: true }, ledgerOf({}));
  assert.equal(answer.allowed, false);
  assert.match(answer.why, /not something a reboot fixes/);

  // And the ladder agrees: it marks the step and says why instead of rebooting
  const made = turn({ monday: 40 }, { problems: { monday: { since: start - 40 * minute, lastStep: 2, lastActionAt: start - 5 * minute } } }, { networkOk: true });
  assert.equal(made.actions.length, 0);
  assert.ok(made.notes.some(note => /not something a reboot fixes/.test(note)));
});

check('nothing reboots in the first ten minutes after a boot', () => {
  const answer = gateReboot({ reason: 'recovery', problem: 'frames', nowMs: start, uptimeSeconds: 6 * 60 }, ledgerOf({}));
  assert.equal(answer.allowed, false);
});

check('a reason nobody recognises is refused', () => {
  const answer = gateReboot({ reason: 'because', problem: 'frames', nowMs: start, uptimeSeconds: 8 * 3600 }, ledgerOf({}));
  assert.equal(answer.allowed, false);
  assert.match(answer.why, /needs one of these reasons/);
});

// ----- degraded mode, the loop breaker -----

check('a problem nothing fixes reboots once and then stops', () => {
  // Thirty minutes of failing, nothing tried since: the reboot is allowed
  const first = turn({ frames: 35 }, { problems: { frames: { since: start - 35 * minute, lastStep: 4, lastActionAt: start - 5 * minute } } });
  assert.equal(first.actions.length, 1);
  assert.equal(first.actions[0].action, 'reboot');

  // The computer comes back and the same check is failing again: it stops rebooting for that problem
  const afterMs = start + 40 * minute;
  const boot = afterBoot(health({ frames: 5 }, afterMs), ledgerOf({
    boots: [afterMs - 10 * minute],
    reboots: [{ at: start, reason: 'recovery', problem: 'frames' }],
  }), { nowMs: afterMs, uptimeSeconds: 10 * 60 });

  assert.ok(boot.problems.frames.degradedSince > 0, 'automatic fixes for it are paused');
  assert.match(boot.problems.frames.degradedWhy, /did not fix/);
  assert.equal(boot.notifications.length, 1, 'and it is said once');

  // No second reboot for a day
  const stopped = ledgerOf({ problems: { frames: { degradedSince: afterMs, degradedWhy: boot.problems.frames.degradedWhy } } });
  const again = gateReboot({ reason: 'recovery', problem: 'frames', nowMs: afterMs + 5 * hour, uptimeSeconds: 6 * 3600 }, stopped);
  assert.equal(again.allowed, false);
  assert.match(again.why, /paused/);

  // But the gentle steps go on
  const gentle = plan(health({ frames: 5 }, afterMs + 5 * hour), stopped, { nowMs: afterMs + 5 * hour, uptimeSeconds: 6 * 3600, networkOk: false });
  assert.ok(gentle.actions.some(item => item.action === 'reload'), 'the page is still loaded again');
});

check('degraded mode lets go after a day of quiet', () => {
  const nowMs = start;
  const quietSince = nowMs - (limits.degradedHours + 1) * hour;
  const made = plan(health({ frames: null }, nowMs), ledgerOf({
    problems: { frames: { degradedSince: quietSince - hour, degradedWhy: 'it did not help', healthySince: quietSince } },
  }), { nowMs: nowMs, uptimeSeconds: 40 * 3600, networkOk: true });

  assert.equal(made.problems.frames.degradedSince, 0);
  assert.ok(made.notes.some(note => /on again/.test(note)));
});

check('three boots in an hour stops the computer rebooting itself at all', () => {
  const boot = afterBoot(health({ frames: 2 }), ledgerOf({
    boots: [start - 50 * minute, start - 30 * minute, start - 5 * minute],
  }), { nowMs: start, uptimeSeconds: 5 * 60 });

  assert.ok(boot.degradedAll, 'everything is paused, not just one problem');
  assert.match(boot.degradedAll.why, /3 times in an hour/);

  const stopped = ledgerOf({ degradedAll: { since: start, why: boot.degradedAll.why } });
  assert.equal(gateReboot({ reason: 'recovery', problem: 'frames', nowMs: start + hour, uptimeSeconds: 3600 }, stopped).allowed, false);
  assert.equal(gateReboot({ reason: 'nightly', problem: '', nowMs: start + hour, uptimeSeconds: 3600 }, stopped).allowed, false, 'the nightly reboot waits too');
  assert.equal(gateReboot({ reason: 'remote', problem: '', nowMs: start + hour, uptimeSeconds: 3600 }, stopped).allowed, true, 'only a person may');
});

// ----- the words the pages show -----

check('the state is said in plain words', () => {
  assert.equal(stateWords(health({}), ledgerOf({}), start), 'Everything is fine.');
  assert.match(stateWords(health({ frames: 6 }), ledgerOf({ problems: { frames: { lastStep: 2 } } }), start), /^Fixing: the screen is not drawing \(step 2 of 5\)\.$/);
  assert.match(stateWords(health({ frames: 6 }), ledgerOf({ problems: { frames: { degradedSince: start - hour, degradedWhy: 'it did not help' } } }), start), /^Automatic fixes are paused/);
});

// ----- the ledger on disk -----

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-ledger-'));
const ledgerFile = path.join(work, 'reboot-ledger.json');

function runLedger(args, env = {}) {
  return spawnSync(process.execPath, [path.join(repo, 'computer/scripts/ledger.mjs')].concat(args), {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      TELETRAAN_LEDGER: ledgerFile,
      NETWATCH_STATE: path.join(work, 'no-netwatch.json'),
      TELETRAAN_UPTIME_SECONDS: '14400',
      TELETRAAN_BOOT_ID: 'boot-one',
    }, env),
  });
}

check('the ledger says yes once and then no, and writes the reboot down before it happens', () => {
  const first = runLedger(['allow', 'recovery', 'frames'], { TELETRAAN_NOW_MS: String(start) });
  assert.equal(first.status, 0, first.stderr);

  const written = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  assert.equal(written.reboots.length, 1, 'recorded before the machine goes down, so it survives the reboot');
  assert.equal(written.reboots[0].reason, 'recovery');

  const second = runLedger(['allow', 'recovery', 'frames'], { TELETRAAN_NOW_MS: String(start + 5 * minute) });
  assert.equal(second.status, 3, 'refused, and 3 is the exit code that means refused rather than broken');
  assert.match(second.stdout, /10 minutes is the most allowed/);
});

check('the ledger as read back is the same ledger, so the limits hold across a reboot', () => {
  // The file written above stands in for one that survived a reboot
  const after = runLedger(['check', 'recovery', 'frames'], { TELETRAAN_NOW_MS: String(start + 2 * hour), TELETRAAN_BOOT_ID: 'boot-two' });
  assert.equal(after.status, 0);
  const answer = JSON.parse(after.stdout);
  assert.equal(answer.allowed, false, 'the reboot two hours ago is still counted');
  assert.match(answer.why, /6 hours/);
});

check('a boot is written down once for each boot', () => {
  runLedger(['boot'], { TELETRAAN_NOW_MS: String(start + 3 * hour), TELETRAAN_BOOT_ID: 'boot-three' });
  runLedger(['boot'], { TELETRAAN_NOW_MS: String(start + 3 * hour + minute), TELETRAAN_BOOT_ID: 'boot-three' });
  const written = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  assert.equal(written.boots.length, 1, 'the second call for the same boot adds nothing');
  assert.equal(written.bootId, 'boot-three');
});

check('clearing turns the automatic fixes back on', () => {
  fs.writeFileSync(ledgerFile, JSON.stringify({
    problems: { frames: { degradedSince: start, degradedWhy: 'it did not help' } },
    degradedAll: { since: start, why: 'a boot loop' },
  }));
  const result = runLedger(['clear'], { TELETRAAN_NOW_MS: String(start + hour) });
  assert.equal(result.status, 0);
  const written = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  assert.equal(written.degradedAll, null);
  assert.equal(written.problems.frames.degradedSince, 0);
});

check('the gate script passes the question through and keeps the refused exit code', () => {
  fs.writeFileSync(ledgerFile, JSON.stringify({ reboots: [{ at: start, reason: 'nightly' }] }));
  const result = spawnSync('/bin/bash', [path.join(repo, 'computer/scripts/gate.sh'), 'allow', 'recovery', 'frames'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      TELETRAAN_LEDGER: ledgerFile,
      NETWATCH_STATE: path.join(work, 'no-netwatch.json'),
      TELETRAAN_NOW_MS: String(start + 3 * minute),
      TELETRAAN_UPTIME_SECONDS: '14400',
      TELETRAAN_BOOT_ID: 'boot-one',
    }),
  });
  assert.equal(result.status, 3, result.stderr);
  assert.match(result.stdout, /10 minutes is the most allowed/);
});

check('the gate refuses without a reason, so nothing can reboot by accident', () => {
  const result = spawnSync('/bin/bash', [path.join(repo, 'computer/scripts/gate.sh'), 'allow'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /say why/);
});

fs.rmSync(work, { recursive: true, force: true });

console.log('\n' + passed + ' of ' + passed + ' supervisor checks passed');
