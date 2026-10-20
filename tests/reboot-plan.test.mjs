// Tests for computer/scripts/reboot-plan.mjs: the slots of the scheduled reboot in a time zone, across the days the clock
// jumps, the choice of days, the guards that make a reboot loop impossible, the skip rule and the settings that come
// back from a cache. Plain functions and fixed times; nothing is run on a real computer.
//
//   node tests/reboot-plan.test.mjs

import assert from 'node:assert/strict';
import { busyReason, decide, defaults, instantOf, labelOf, nextSlotToShow, settingFrom, slotsAround } from '../computer/scripts/reboot-plan.mjs';

let passed = 0;
function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const minute = 60000;
const hour = 60 * minute;
const ny = 'America/New_York';
const everyDay = [0, 1, 2, 3, 4, 5, 6];
const on = Object.assign({}, defaults, { rebootEnabled: true });
const at = text => Date.parse(text);

// ----- slots in a zone -----

check('03:30 is 07:30 UTC in New York in summer and 08:30 UTC in winter', () => {
  assert.equal(new Date(instantOf(ny, 2026, 7, 14, 3, 30)).toISOString(), '2026-07-14T07:30:00.000Z');
  assert.equal(new Date(instantOf(ny, 2026, 1, 14, 3, 30)).toISOString(), '2026-01-14T08:30:00.000Z');
});

check('the same wall clock time is a different instant in other zones, half hours included', () => {
  assert.equal(new Date(instantOf('Asia/Kolkata', 2026, 7, 14, 3, 30)).toISOString(), '2026-07-13T22:00:00.000Z');
  assert.equal(new Date(instantOf('Australia/Sydney', 2026, 7, 14, 3, 30)).toISOString(), '2026-07-13T17:30:00.000Z');
  assert.equal(new Date(instantOf('UTC', 2026, 7, 14, 3, 30)).toISOString(), '2026-07-14T03:30:00.000Z');
});

check('on the day the clocks go forward, 03:30 is after the jump and 02:30 (which does not exist) is the moment after it', () => {
  assert.equal(new Date(instantOf(ny, 2026, 3, 8, 3, 30)).toISOString(), '2026-03-08T07:30:00.000Z');
  assert.equal(new Date(instantOf(ny, 2026, 3, 8, 2, 30)).toISOString(), '2026-03-08T07:30:00.000Z');
  assert.equal(labelOf(instantOf(ny, 2026, 3, 8, 2, 30), ny), 'Sun 03:30');
});

check('on the day the clocks go back, a time that happens twice is the first one, so a day has one slot', () => {
  assert.equal(new Date(instantOf(ny, 2026, 11, 1, 1, 30)).toISOString(), '2026-11-01T05:30:00.000Z');
  const slots = slotsAround(Object.assign({}, on, { rebootTime: '01:30' }), ny, at('2026-11-01T12:00:00Z'));
  const onThatDay = slots.filter(slot => labelOf(slot, ny).startsWith('Sun') && Math.abs(slot - at('2026-11-01T12:00:00Z')) < 20 * hour);
  assert.equal(onThatDay.length, 1);
});

check('the slots keep the wall clock time through both changes', () => {
  const march = slotsAround(on, ny, at('2026-03-08T12:00:00Z')).map(slot => labelOf(slot, ny).slice(4));
  const november = slotsAround(on, ny, at('2026-11-01T12:00:00Z')).map(slot => labelOf(slot, ny).slice(4));
  assert.ok(march.every(time => time === '03:30'));
  assert.ok(november.every(time => time === '03:30'));
});

check('the day is the day in the zone of the screen, not in UTC', () => {
  // 02:00 UTC on Wednesday is still Tuesday evening in New York, so the slot of Tuesday has not come yet
  const monday = Object.assign({}, on, { rebootDays: [2] });
  const now = at('2026-10-21T02:00:00Z');
  assert.equal(labelOf(slotsAround(monday, ny, now).find(slot => slot > now), ny), 'Tue 03:30');
  assert.equal(new Date(slotsAround(monday, ny, now).find(slot => slot > now)).toISOString(), '2026-10-27T07:30:00.000Z');
});

// ----- the days -----

check('only the ticked days have a slot, and Sunday is 0', () => {
  const weekend = Object.assign({}, on, { rebootDays: [0, 6] });
  const labels = slotsAround(weekend, ny, at('2026-10-20T15:00:00Z')).map(slot => labelOf(slot, ny).slice(0, 3));
  assert.ok(labels.length > 0 && labels.every(day => day === 'Sat' || day === 'Sun'));
  const none = slotsAround(Object.assign({}, on, { rebootDays: [] }), ny, at('2026-10-20T15:00:00Z'));
  assert.deepEqual(none, []);
});

check('the next reboot shown is the first slot ahead, in the words Studio and the control page show', () => {
  const now = at('2026-10-20T15:00:00Z'); // Tuesday 11:00 in New York
  const next = nextSlotToShow(on, ny, now, 0);
  assert.equal(labelOf(next, ny), 'Wed 03:30');
  const tuesdays = nextSlotToShow(Object.assign({}, on, { rebootDays: [2] }), ny, now, 0);
  assert.equal(labelOf(tuesdays, ny), 'Tue 03:30');
  assert.equal(nextSlotToShow(Object.assign({}, on, { rebootEnabled: false }), ny, now, 0), 0);
});

// ----- a run -----

const slot = instantOf(ny, 2026, 10, 20, 3, 30); // Tue 03:30
const up = { uptimeSeconds: 40 * 3600 };
// The setting was already in effect a day before
const known = { settingKey: 'on|03:30|0123456', settingSince: slot - 24 * hour };
function run(input, state, when) {
  return decide(Object.assign({ setting: on, zone: ny, nowMs: when === undefined ? slot + 2 * minute : when }, up, input), state === undefined ? known : state);
}

check('a run at the slot reboots once, and says why in the words of the status line', () => {
  const result = run({});
  assert.equal(result.action, 'reboot');
  assert.equal(result.why, 'Tue 03:30, as scheduled');
  assert.equal(result.state.lastSlot, slot);
  assert.equal(result.state.lastRebootAt, slot + 2 * minute);
  assert.equal(result.nextText, 'Wed 03:30');
});

check('the next run, with the state the first one kept, does nothing even though the computer is still inside the window', () => {
  const first = run({});
  const second = run({}, first.state, slot + 7 * minute);
  assert.equal(second.action, 'none');
});

check('off does nothing, whatever the time', () => {
  const result = run({ setting: Object.assign({}, on, { rebootEnabled: false }) });
  assert.equal(result.action, 'none');
  assert.equal(result.nextText, '');
});

check('a time that is not a slot does nothing', () => {
  assert.equal(run({}, known, slot - 3 * hour).action, 'none');
  assert.equal(run({}, known, slot + 12 * minute).action, 'none');
});

check('a slot that the computer slept through is not made up later', () => {
  assert.equal(run({}, known, slot + 3 * hour).action, 'none');
});

check('guard: no reboot within 10 minutes of boot, and the slot is not used up', () => {
  const result = run({ uptimeSeconds: 9 * 60 });
  assert.equal(result.action, 'none');
  assert.equal(result.state.lastSlot, 0);
  // After 10 minutes the 6 hour guard takes over
  assert.match(run({ uptimeSeconds: 10 * 60 }).line, /rebooted less than 6 hours ago/);
});

check('guard: no reboot within 6 hours of the last one, and the slot is marked as handled', () => {
  const state = Object.assign({}, known, { lastRebootAt: slot - 5 * hour });
  const result = run({}, state);
  assert.equal(result.action, 'none');
  assert.equal(result.state.lastSlot, slot);
  assert.equal(run({}, Object.assign({}, known, { lastRebootAt: slot - 7 * hour })).action, 'reboot');
});

check('guard: a reboot this plan did not make counts too, because the uptime is under 6 hours', () => {
  const result = run({ uptimeSeconds: 5 * 3600 });
  assert.equal(result.action, 'none');
  assert.match(result.line, /rebooted less than 6 hours ago/);
  assert.equal(result.state.lastSlot, slot);
  assert.equal(run({ uptimeSeconds: 6 * 3600 }).action, 'reboot');
});

check('guard: a loop is impossible, because a reboot every 5 minutes for a day asks for one reboot', () => {
  let state = known;
  let reboots = 0;
  // The computer reboots at the first run, and every run after it sees a fresh boot or the saved state
  for (let when = slot; when < slot + 24 * hour; when += 5 * minute) {
    const result = decide(Object.assign({ setting: on, zone: ny, nowMs: when }, { uptimeSeconds: 20 * 3600 }), state);
    state = result.state;
    if (result.action === 'reboot') reboots += 1;
  }
  assert.equal(reboots, 1);
});

check('guard: a setting that has just been published does not reboot for a slot that is already past', () => {
  // The owner publishes 03:30 at 03:36 and the computer first sees it then: the slot of today is not used
  const result = run({}, {}, slot + 6 * minute);
  assert.equal(result.action, 'none');
  assert.equal(result.state.settingSince, slot + 6 * minute);
  // A new time is also a new setting
  const moved = run({ setting: Object.assign({}, on, { rebootTime: '03:35' }) }, known, slot + 6 * minute);
  assert.equal(moved.action, 'none');
});

check('the first run after a setting is seen, before its slot, keeps it and reboots at the slot', () => {
  const early = run({}, {}, slot - 2 * hour);
  assert.equal(early.action, 'none');
  const later = run({}, early.state, slot + 3 * minute);
  assert.equal(later.action, 'reboot');
});

// ----- the skip rule -----

const talk = { start: new Date(slot + 5 * minute).toISOString(), minutes: 15 };

check('busy text names what is playing: an alert, an announcement or a talk', () => {
  const now = slot;
  assert.equal(busyReason({ alert: { on: true } }, now), 'an alert');
  assert.equal(busyReason({ alert: { on: true, until: new Date(now - minute).toISOString() } }, now), '');
  assert.equal(busyReason({ alert: { on: false } }, now), '');
  assert.equal(busyReason({ announcements: [{ start: new Date(now - hour).toISOString(), end: new Date(now + hour).toISOString() }] }, now), 'an announcement');
  assert.equal(busyReason({ announcements: [{ start: new Date(now + hour).toISOString(), end: new Date(now + 2 * hour).toISOString() }] }, now), '');
  assert.equal(busyReason({ talks: [talk] }, now), 'a talk');
  assert.equal(busyReason({ talks: [talk] }, now - 30 * minute), '');
  assert.equal(busyReason({ talks: [talk] }, now + 40 * minute), '');
  assert.equal(busyReason(null, now), '');
});

check('while a talk is playing the run waits, and counts the minutes', () => {
  const result = run({ busyData: { talks: [talk] } }, known, slot + 2 * minute);
  assert.equal(result.action, 'wait');
  assert.match(result.line, /waiting for a talk/);
  assert.equal(result.state.lastSlot, 0);
});

check('after the wait the computer reboots anyway, and the reason says so', () => {
  const longTalk = { start: new Date(slot - 10 * minute).toISOString(), minutes: 90 };
  const first = run({ busyData: { talks: [longTalk] } }, known, slot + 2 * minute);
  const result = run({ busyData: { talks: [longTalk] } }, first.state, slot + 31 * minute);
  assert.equal(result.action, 'reboot');
  assert.equal(result.why, 'Tue 03:30, after waiting 30 minutes for a talk');
});

check('a run that waited reboots as soon as the screen is free', () => {
  const waiting = run({ busyData: { talks: [talk] } }, known, slot + 2 * minute);
  const result = run({ busyData: { talks: [] } }, waiting.state, slot + 12 * minute);
  assert.equal(result.action, 'reboot');
  assert.equal(result.why, 'Tue 03:30, as scheduled');
});

check('a computer that was late and is free does not reboot more than 10 minutes after the slot', () => {
  assert.equal(run({}, known, slot + 12 * minute).action, 'none');
  assert.match(run({}, known, slot + 12 * minute).line, /missed/);
});

check('with the skip rule off the screen is never waited for', () => {
  const result = run({ setting: Object.assign({}, on, { rebootSkipBusy: false }), busyData: { alert: { on: true } } });
  assert.equal(result.action, 'reboot');
});

check('when Sanity could not be asked what is playing, the reboot goes ahead on the schedule', () => {
  assert.equal(run({ busyData: null }).action, 'reboot');
});

check('the wait is part of the window, so a wait of 60 minutes can still end in a reboot', () => {
  const setting = Object.assign({}, on, { rebootWaitMinutes: 60 });
  const busyData = { alert: { on: true } };
  const first = run({ setting: setting, busyData: busyData }, known, slot + 2 * minute);
  const middle = run({ setting: setting, busyData: busyData }, first.state, slot + 50 * minute);
  assert.equal(middle.action, 'wait');
  assert.equal(run({ setting: setting, busyData: busyData }, middle.state, slot + 62 * minute).action, 'reboot');
  assert.equal(run({ setting: setting, busyData: busyData }, middle.state, slot + 75 * minute).action, 'none');
});

// ----- the stored setting -----

check('a stored copy that is missing, old or damaged gives a safe setting', () => {
  assert.deepEqual(settingFrom(null), defaults);
  assert.equal(settingFrom({ rebootEnabled: 'yes' }).rebootEnabled, false);
  assert.equal(settingFrom({ rebootTime: '3:30' }).rebootTime, '03:30');
  assert.equal(settingFrom({ rebootTime: '24:00' }).rebootTime, '03:30');
  assert.equal(settingFrom({ rebootWaitMinutes: 0 }).rebootWaitMinutes, 30);
  assert.equal(settingFrom({ rebootWaitMinutes: 121 }).rebootWaitMinutes, 30);
  assert.deepEqual(settingFrom({ rebootDays: [3, 3, 9, 'x', 1] }).rebootDays, [1, 3]);
  assert.deepEqual(settingFrom({ rebootDays: 'all' }).rebootDays, everyDay);
});

check('the starting values are off, 03:30, every day, wait while busy, 30 minutes', () => {
  assert.deepEqual(defaults, { rebootEnabled: false, rebootTime: '03:30', rebootDays: everyDay, rebootSkipBusy: true, rebootWaitMinutes: 30 });
});

check('a zone that is not a zone falls back to New York instead of stopping', () => {
  const result = run({ zone: 'Not/AZone' }, known, slot + 2 * minute);
  assert.equal(result.action, 'reboot');
  assert.equal(result.why, 'Tue 03:30, as scheduled');
});

check('with no days ticked the reboot never runs and the line says why', () => {
  const result = run({ setting: Object.assign({}, on, { rebootDays: [] }) });
  assert.equal(result.action, 'none');
  assert.match(result.line, /no days/);
});

console.log('\n' + passed + ' of ' + passed + ' checks passed.');
