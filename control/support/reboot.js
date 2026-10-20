// What the Scheduled reboot card reads and writes in Dashboard Settings: the five reboot fields the Studio shows in the
// Advanced tab (studio/schemas/settingsReboot.js). Same stored names, same limits, written to the draft only.
// The meaning of a setting (the starting values and the limits) is in computer/scripts/reboot-plan.mjs, which the timer
// on the Teletraan computer uses too, so the card, the Studio and the timer cannot disagree.

import { settingFrom, timePattern, waitRange } from '../../computer/scripts/reboot-plan.mjs';
import { Refusal } from './http.js';

export const rebootFieldNames = ['rebootEnabled', 'rebootTime', 'rebootDays', 'rebootSkipBusy', 'rebootWaitMinutes'];

// What the Studio and the card show for the next and the last reboot: the lines the timer wrote to status-mini
export const statusQuery = '{ "status": *[_id == "status-mini"][0]{ nextRebootAt, nextRebootText, lastRebootAt, lastRebootWhy }, "zone": *[_id == "theme"][0].timeZone }';

// The setting the card shows: the stored values, with the starting value for anything missing
export function settingOf(source) {
  return settingFrom(source);
}

function text(value, longest) {
  return typeof value === 'string' ? value.trim().slice(0, longest) : '';
}

// The status lines for the card: plain text only
export function statusOf(result) {
  const status = result && result.status && typeof result.status === 'object' ? result.status : {};
  return {
    nextText: text(status.nextRebootText, 20),
    nextAt: text(status.nextRebootAt, 40),
    lastAt: text(status.lastRebootAt, 40),
    lastWhy: text(status.lastRebootWhy, 120),
    zone: text(result && result.zone, 40),
  };
}

// The fields that were sent, checked. A field that was not sent is not touched. Out of range values are refused in
// words, not corrected, so nobody finds a number changed behind them.
export function cleanSetting(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Refusal(400, 'The reboot settings should be an object.');
  const out = {};

  if (input.rebootEnabled !== undefined) {
    if (typeof input.rebootEnabled !== 'boolean') throw new Refusal(400, 'Reboot on a schedule should be on or off.');
    out.rebootEnabled = input.rebootEnabled;
  }
  if (input.rebootTime !== undefined) {
    if (typeof input.rebootTime !== 'string' || !timePattern.test(input.rebootTime)) throw new Refusal(400, 'Use 24 hour time with two digits, such as 03:30.');
    out.rebootTime = input.rebootTime;
  }
  if (input.rebootDays !== undefined) {
    const days = input.rebootDays;
    if (!Array.isArray(days) || days.length === 0 || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Refusal(400, 'Tick at least one day.');
    out.rebootDays = Array.from(new Set(days)).sort((a, b) => a - b);
  }
  if (input.rebootSkipBusy !== undefined) {
    if (typeof input.rebootSkipBusy !== 'boolean') throw new Refusal(400, 'Not while something is playing should be on or off.');
    out.rebootSkipBusy = input.rebootSkipBusy;
  }
  if (input.rebootWaitMinutes !== undefined) {
    const minutes = input.rebootWaitMinutes;
    if (!Number.isInteger(minutes) || minutes < waitRange.min || minutes > waitRange.max) throw new Refusal(400, 'Wait up to should be a whole number of minutes from ' + waitRange.min + ' to ' + waitRange.max + '.');
    out.rebootWaitMinutes = minutes;
  }
  if (Object.keys(out).length === 0) throw new Refusal(400, 'There is nothing to save.');
  return out;
}
