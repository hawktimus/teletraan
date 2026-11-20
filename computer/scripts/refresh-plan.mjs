// The pre-meeting refresh of the Teletraan computer, as plain functions. pre-meeting-refresh.sh (started by
// teletraan-refresh.timer every 5 minutes) does the fetching, the repairs and the logging, and asks this file what to do.
// The control page and the Studio show what it decided (docs/OPERATIONS.md, "The pre-meeting refresh").
//
// The picture is sacred in school hours: repairs go soft to hard.
//   1. read everything again (every source), then run the health check
//   2. everything green: reload the page only (the picture does not change) ... and reboot only when the computer has been
//      up more than 7 days, which is the one thing a green check cannot tell
//   3. anything amber: restart what is wrong (the sync service for a source or a service, the screen for a frozen page), and check again
//   4. still unhealthy after that: reboot, through the gate (computer/scripts/gate.sh)
//
// It never starts while a talk is booked within 30 minutes or a Band event of kind Meetings is on (15 minutes before it is
// counted as on). It waits, and gives up after 90 minutes past the time, saying why. It is a scheduled reboot as far as
// the budget goes: gate.sh reason "nightly", which is outside the recovery budget but still cannot reboot twice within ten minutes.
//
//   node refresh-plan.mjs <input.json>   prints the decision as JSON; writes nothing

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const defaults = { refreshEnabled: true, refreshTime: '13:30', refreshDays: [1, 2, 3, 4, 5] };
export const defaultZone = 'America/New_York';
export const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
// How long after the time a refresh may still start, while it waits for a talk or a meeting
export const waitMinutes = 90;
export const talkSoonMinutes = 30;
export const meetingBeforeMinutes = 15;
export const meetingAfterMinutes = 10;
export const maxUptimeDays = 7;

const minute = 60000;

export function settingsOf(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const days = Array.isArray(source.refreshDays) ? source.refreshDays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6) : null;
  return {
    refreshEnabled: typeof source.refreshEnabled === 'boolean' ? source.refreshEnabled : defaults.refreshEnabled,
    refreshTime: typeof source.refreshTime === 'string' && timePattern.test(source.refreshTime) ? source.refreshTime : defaults.refreshTime,
    refreshDays: days && days.length > 0 ? Array.from(new Set(days)).sort() : defaults.refreshDays.slice(),
  };
}

export function zoneOf(zone) {
  if (typeof zone !== 'string' || !/^[A-Za-z0-9_+/-]{1,40}$/.test(zone)) return defaultZone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch (error) {
    return defaultZone;
  }
}

// The date, weekday (0 is Sunday) and minutes since midnight of a moment in a zone
export function clockIn(ms, zone) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })
    .formatToParts(new Date(ms)).forEach(part => { parts[part.type] = part.value; });
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { date: parts.year + '-' + parts.month + '-' + parts.day, weekday: days[parts.weekday], minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// Is a Band event of kind Meetings on, counting meetingBeforeMinutes before it and meetingAfterMinutes after it?
//   events   [{ start, end, kind }] with times in milliseconds
export function meetingNow(events, nowMs) {
  return (Array.isArray(events) ? events : []).some(event => event && event.kind === 'meetings'
    && nowMs >= event.start - meetingBeforeMinutes * minute && nowMs <= (event.end > event.start ? event.end : event.start) + meetingAfterMinutes * minute);
}

// Is a talk booked to start inside the next talkSoonMinutes, or one that started and is still on?
//   talks   [{ start, minutes }]
export function talkSoon(talks, nowMs) {
  return (Array.isArray(talks) ? talks : []).some(talk => talk && Number.isFinite(talk.start)
    && nowMs >= talk.start - talkSoonMinutes * minute && nowMs <= talk.start + ((Number(talk.minutes) || 15) + 5) * minute);
}

// Should a refresh start now?
//   input { now (ms), settings, zone, state: { lastSlot }, talks, events }
// Gives { start, slot, reason, wait }: start true means begin; reason is a sentence for the log and the pages; wait is true while a
// talk or a meeting holds it back
export function decideStart(input) {
  const settings = settingsOf(input.settings);
  const zone = zoneOf(input.zone);
  const now = input.now;
  const clock = clockIn(now, zone);
  const none = reason => ({ start: false, slot: clock.date, reason: reason, wait: false });

  if (!settings.refreshEnabled) return none('The pre-meeting refresh is off.');
  if (!settings.refreshDays.includes(clock.weekday)) return none('Not a refresh day.');
  const [hour, minuteOfHour] = settings.refreshTime.split(':').map(Number);
  const slotMinutes = hour * 60 + minuteOfHour;
  if (clock.minutes < slotMinutes) return none('Not time yet.');
  if (clock.minutes - slotMinutes > waitMinutes) return none('The time has passed for today.');
  const state = input.state && typeof input.state === 'object' ? input.state : {};
  if (state.lastSlot === clock.date) return none('Already done today.');

  if (talkSoon(input.talks, now)) return { start: false, slot: clock.date, reason: 'Waiting: a talk is booked within 30 minutes.', wait: true };
  if (meetingNow(input.events, now)) return { start: false, slot: clock.date, reason: 'Waiting: a meeting is on.', wait: true };
  return { start: true, slot: clock.date, reason: 'Time for the refresh.', wait: false };
}

// What to do after the sources were read and the health check ran
//   input { failing: [names of checks that fail], uptimeSeconds, afterRepair: bool }
// Gives { action, services, reason }: action is reload, repair, reboot or done
export function decideRepair(input) {
  const failing = Array.isArray(input.failing) ? input.failing.map(String) : [];
  const uptimeDays = (Number(input.uptimeSeconds) || 0) / 86400;

  if (failing.length === 0) {
    if (input.afterRepair) return { action: 'done', services: [], reason: 'Repaired: everything is green now.' };
    if (uptimeDays > maxUptimeDays) return { action: 'reboot', services: [], reason: 'Everything is green, but the computer has been up ' + Math.floor(uptimeDays) + ' days.' };
    return { action: 'reload', services: [], reason: 'Everything is green: reloaded the page only.' };
  }
  if (input.afterRepair) return { action: 'reboot', services: [], reason: 'Still not healthy after the repair (' + failing.join(', ') + ').' };

  // What each failing check points at: a frozen or heavy page is a screen problem, the rest is the sync service
  const services = new Set();
  failing.forEach(name => {
    if (['frames', 'page', 'display', 'picture', 'memory'].includes(name)) services.add('screen');
    else services.add('sync');
  });
  return { action: 'repair', services: Array.from(services).sort(), reason: 'Not green (' + failing.join(', ') + '): restarting ' + Array.from(services).sort().join(' and ') + '.' };
}

// The words for the pages: "13:30 refresh: reloaded page only, all green"
export function words(last) {
  if (!last || typeof last !== 'object' || typeof last.decision !== 'string') return '';
  const time = typeof last.at === 'string' ? last.at : '';
  return (last.time || 'Refresh') + ' refresh: ' + last.decision + (time ? ' (' + time + ')' : '');
}

// realpath, because a temporary folder may be reached through a link (/var is /private/var on a Mac)
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(input.kind === 'repair' ? decideRepair(input) : decideStart(input)));
}
