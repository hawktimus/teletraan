// The scheduled reboot of the Teletraan computer, as plain functions. scheduled-reboot.sh (started by
// teletraan-reboot.timer every 5 minutes) does the fetching, the files and the reboot, and asks this file what to do. The
// control page (control/support/reboot.js) uses the same starting values and the same checks, so the page, the Studio
// and the timer cannot disagree about what a setting means.
//
// The settings are five fields of Dashboard Settings (studio/schemas/settingsReboot.js):
//   rebootEnabled      off to start with
//   rebootTime         HH:MM in the time zone of the Look page, 03:30 to start with
//   rebootDays         the weekdays, 0 is Sunday, every day to start with
//   rebootSkipBusy     wait while a talk, an alert or an announcement is playing
//   rebootWaitMinutes  how long to wait before rebooting anyway, 30 to start with
//
// How a run decides: the slot is the most recent scheduled time that has passed. It is acted on only within 10 minutes
// of the slot (longer only while a run is waiting for a talk, an alert or an announcement, up to the wait), only once,
// only when the setting was already in effect before the slot, never within 10 minutes of boot and never within 6 hours
// of the last reboot (this plan's or any other: the uptime counts). A slot that was missed because the computer was off
// is not made up.
//
//   node reboot-plan.mjs <input.json> <state.json>   prints the decision as JSON; writes nothing

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { graceMinutes, noShowMinutes } from '../../dashboard/core/constants.js';

export const defaults = {
  rebootEnabled: false,
  rebootTime: '03:30',
  rebootDays: [0, 1, 2, 3, 4, 5, 6],
  rebootSkipBusy: true,
  rebootWaitMinutes: 30,
};

export const waitRange = { min: 1, max: 120 };
export const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
export const defaultZone = 'America/New_York';

// The guards that make a reboot loop impossible
export const minUptimeMinutes = 10;
export const minGapHours = 6;
// The timer wakes every 5 minutes, so a slot is acted on up to 10 minutes late
export const lateMinutes = 10;

const minute = 60000;

// ----- the setting -----

function usable(zone) {
  if (typeof zone !== 'string' || !/^[A-Za-z0-9_+/-]{1,40}$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch (error) {
    return false;
  }
}

export function zoneOf(zone) {
  return usable(zone) ? zone : defaultZone;
}

// What Sanity holds, with the starting value for anything missing or not usable. Used by the timer on a stored copy,
// so an old or damaged copy still gives a setting that is safe.
export function settingFrom(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const days = Array.isArray(source.rebootDays)
    ? Array.from(new Set(source.rebootDays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b)
    : defaults.rebootDays.slice();
  const wait = source.rebootWaitMinutes;
  return {
    rebootEnabled: source.rebootEnabled === true,
    rebootTime: typeof source.rebootTime === 'string' && timePattern.test(source.rebootTime) ? source.rebootTime : defaults.rebootTime,
    rebootDays: days,
    rebootSkipBusy: source.rebootSkipBusy === false ? false : true,
    rebootWaitMinutes: Number.isInteger(wait) && wait >= waitRange.min && wait <= waitRange.max ? wait : defaults.rebootWaitMinutes,
  };
}

// ----- time zones -----

// The offset of a zone from UTC at an instant, in milliseconds
function offsetAt(zone, ms) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(ms));
  const value = {};
  parts.forEach(part => { value[part.type] = Number(part.value); });
  return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second) - Math.floor(ms / 1000) * 1000;
}

// The instant of a wall clock time in a zone. A time that does not exist (the clock jumped over it) is the moment
// after the jump, and a time that happens twice is the first one, so a day has one slot.
export function instantOf(zone, year, month, day, hour, mins) {
  const wall = Date.UTC(year, month - 1, day, hour, mins);
  const first = wall - offsetAt(zone, wall);
  const second = wall - offsetAt(zone, first);
  if (first === second) return first;
  // Two offsets disagree: this is a day with a jump. Keep the one that shows the wanted wall clock, or the later one.
  const shows = ms => offsetAt(zone, ms) + ms === wall;
  if (shows(first)) return first;
  if (shows(second)) return second;
  return Math.max(first, second);
}

// The calendar date in a zone at an instant
function dateIn(zone, ms) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(ms));
  const value = {};
  parts.forEach(part => { value[part.type] = Number(part.value); });
  return { year: value.year, month: value.month, day: value.day };
}

// Every slot from a few days back to over a week ahead, oldest first
export function slotsAround(setting, zone, nowMs) {
  const [hour, mins] = setting.rebootTime.split(':').map(Number);
  const today = dateIn(zone, nowMs);
  const slots = [];
  for (let offset = -3; offset <= 9; offset += 1) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    if (!setting.rebootDays.includes(date.getUTCDay())) continue;
    slots.push(instantOf(zone, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, mins));
  }
  return slots.sort((a, b) => a - b);
}

// "Tue 03:30", in the zone of the screen
export function labelOf(ms, zone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms));
  const value = {};
  parts.forEach(part => { value[part.type] = part.value; });
  return value.weekday + ' ' + value.hour + ':' + value.minute;
}

// ----- is the screen busy -----

// busyData: { alert, announcements, talks } as the timer asks Sanity for them. A talk holds the screen from its start to
// the end of its minutes plus the wait and the overrun of the dashboard (core/constants.js); a reboot just before it
// would cut it off, so it counts from 10 minutes before.
export function busyReason(busyData, nowMs) {
  if (!busyData || typeof busyData !== 'object') return '';
  const alert = busyData.alert;
  if (alert && alert.on === true && (!alert.until || Date.parse(alert.until) > nowMs)) return 'an alert';
  const live = (Array.isArray(busyData.announcements) ? busyData.announcements : []).some(item => Date.parse(item.start) <= nowMs && Date.parse(item.end) > nowMs);
  if (live) return 'an announcement';
  const talk = (Array.isArray(busyData.talks) ? busyData.talks : []).some(item => {
    const start = Date.parse(item.start);
    const length = (Number.isFinite(item.minutes) ? item.minutes : 15) + noShowMinutes + graceMinutes;
    return start - 10 * minute <= nowMs && nowMs < start + length * minute;
  });
  return talk ? 'a talk' : '';
}

// ----- the decision -----

function keyOf(setting) {
  return [setting.rebootEnabled ? 'on' : 'off', setting.rebootTime, setting.rebootDays.join('')].join('|');
}

// The slot the run is about, if there is one: the latest that has passed, was not handled and is still inside its window
function dueSlot(setting, zone, nowMs, lastSlot, since) {
  const windowMs = (lateMinutes + (setting.rebootSkipBusy ? setting.rebootWaitMinutes : 0)) * minute;
  const passed = slotsAround(setting, zone, nowMs).filter(slot => slot <= nowMs);
  const latest = passed.length ? passed[passed.length - 1] : 0;
  if (latest === 0 || latest <= lastSlot || nowMs - latest > windowMs || latest < since) return 0;
  return latest;
}

// The next reboot to show: the first slot that is not handled and still has a window ahead of it. Empty when off.
export function nextSlotToShow(setting, zone, nowMs, lastSlot) {
  if (!setting.rebootEnabled || setting.rebootDays.length === 0) return 0;
  const windowMs = (lateMinutes + (setting.rebootSkipBusy ? setting.rebootWaitMinutes : 0)) * minute;
  const found = slotsAround(setting, zone, nowMs).find(slot => slot > lastSlot && slot + windowMs > nowMs);
  return found || 0;
}

// input:  { setting, zone, nowMs, uptimeSeconds, busyData }   busyData is null when Sanity could not be asked, which counts as not busy
// state:  { lastSlot, lastRebootAt, lastWhy, settingKey, settingSince, waiting }   times in milliseconds; waiting is the slot a run waits for
// Gives { action, line, why, slot, nextAt, nextText, state }. action is reboot, wait or none. state is what to keep.
export function decide(input, state) {
  const setting = settingFrom(input.setting);
  const zone = zoneOf(input.zone);
  const nowMs = input.nowMs;
  const before = state && typeof state === 'object' ? state : {};
  const lastSlot = Number.isFinite(before.lastSlot) ? before.lastSlot : 0;
  const lastRebootAt = Number.isFinite(before.lastRebootAt) ? before.lastRebootAt : 0;
  const key = keyOf(setting);
  const since = before.settingKey === key && Number.isFinite(before.settingSince) ? before.settingSince : nowMs;
  const next = Object.assign({}, before, { lastSlot: lastSlot, lastRebootAt: lastRebootAt, settingKey: key, settingSince: since });

  // The next reboot is worked out from the state the run keeps, so a run that reboots already shows the one after it
  const result = (action, line, why, slot, state) => {
    const kept = state || next;
    const upcoming = nextSlotToShow(setting, zone, nowMs, kept.lastSlot);
    return {
      action: action, line: line, why: why || '', slot: slot || 0, state: kept,
      nextAt: upcoming ? new Date(upcoming).toISOString() : '', nextText: upcoming ? labelOf(upcoming, zone) : '',
    };
  };

  if (!setting.rebootEnabled) return result('none', 'scheduled reboot is off.');
  if (setting.rebootDays.length === 0) return result('none', 'scheduled reboot has no days ticked, so it never runs.');

  const slot = dueSlot(setting, zone, nowMs, lastSlot, since);
  if (slot === 0) return result('none', 'no reboot due.');

  // Past the late minutes a slot counts only if an earlier run already started waiting for it. A computer that was off or
  // slow at the slot does not reboot half an hour later in the middle of a meeting.
  if (nowMs - slot > lateMinutes * minute && before.waiting !== slot) {
    return result('none', 'the slot of ' + labelOf(slot, zone) + ' was missed, so no reboot.', '', slot);
  }
  if (input.uptimeSeconds < minUptimeMinutes * 60) {
    return result('none', 'the computer started less than ' + minUptimeMinutes + ' minutes ago, so no reboot.', '', slot);
  }
  // The uptime counts too, so a reboot this plan did not make (the Sunday one of nightly.sh, a power cut) is also a gap
  if ((lastRebootAt > 0 && nowMs - lastRebootAt < minGapHours * 60 * minute) || input.uptimeSeconds < minGapHours * 3600) {
    return result('none', 'the computer was rebooted less than ' + minGapHours + ' hours ago, so the slot of ' + labelOf(slot, zone) + ' is skipped.', '', slot, Object.assign({}, next, { lastSlot: slot }));
  }

  const slotText = labelOf(slot, zone);
  const busy = setting.rebootSkipBusy ? busyReason(input.busyData, nowMs) : '';
  const rebooted = why => Object.assign({}, next, { lastSlot: slot, lastRebootAt: nowMs, lastWhy: why, waiting: 0 });
  if (busy !== '') {
    const waited = Math.floor((nowMs - slot) / minute);
    if (waited < setting.rebootWaitMinutes) {
      return result('wait', 'waiting for ' + busy + ' to finish (' + waited + ' of ' + setting.rebootWaitMinutes + ' minutes).', '', slot, Object.assign({}, next, { waiting: slot }));
    }
    const why = slotText + ', after waiting ' + setting.rebootWaitMinutes + ' minutes for ' + busy;
    return result('reboot', 'rebooting for ' + slotText + ' after waiting ' + setting.rebootWaitMinutes + ' minutes for ' + busy + '.', why, slot, rebooted(why));
  }
  const why = slotText + ', as scheduled';
  return result('reboot', 'rebooting for ' + slotText + '.', why, slot, rebooted(why));
}

// ----- as a command -----

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const input = readJson(process.argv[2]);
  if (!input) {
    console.error('reboot-plan: the input file could not be read.');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(decide(input, readJson(process.argv[3]))) + '\n');
}
