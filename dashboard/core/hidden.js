// The hidden transitions: the plain functions. They know nothing about the
// page, so tools/test-effects.mjs can run them. core/hidden-run.js gives them
// the real screen, and core/hidden-transitions.js lists the transitions.
//
// When one plays:
//   1. At a page change of the large panel, each hidden transition has its
//      chance. Dashboard Settings (Advanced tab) says how many hours of screen
//      time it comes about once in, and the chance of one page change is the
//      seconds between page changes over those hours in seconds. A settings
//      page saved before the hours existed has none, and uses the percent
//      it has always had. One roll decides among all of them.
//      After any hidden transition has played, none comes about by chance for
//      hiddenGapHours (config.js). The time it played is kept in localStorage.
//   2. Someone can also push one from the Studio ("Play desktop reveal",
//      "Play red eyes"). That writes hiddenRequest into Dashboard Settings. A
//      push ignores the chances and the gap, but not the rules in holdReason below, and it
//      plays only once and only while it is less than a minute old, the same
//      guard as a demo (shouldRunDemo in core/demo.js). The one handled before
//      is kept in localStorage, so a Mini that restarts never plays it again.
//   3. It replaces the normal page change. It never plays in calm or no
//      motion, with the master switch off, or while an alert, an announcement,
//      a demo, night mode or another hidden transition has the screen.

import { defaultSettings, hiddenGapHours, limits, speeds } from '../config.js';
import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';
import { hiddenTransitions } from './hidden-transitions.js';

export const handledKey = 'teletraan-hidden-handled';
export const lastFiredKey = 'teletraan-hidden-last-fired';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isKind(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(hiddenTransitions, id);
}

// The names of the settings that hold a chance, one for each transition in the registry
export function chanceFields() {
  return Object.keys(hiddenTransitions).map(id => hiddenTransitions[id].chanceField);
}

// The names of the settings that hold the hours, one for each transition in the registry
export function hoursFields() {
  return Object.keys(hiddenTransitions).map(id => hiddenTransitions[id].hoursField);
}

// The hours a transition comes about once in, from 1 to 1000. Anything else is 0, which
// means not set: the settings page was saved before the hours existed.
export function tidyHours(value, field) {
  const limit = limits[field];
  if (!limit || typeof value !== 'number' || !isFinite(value) || value < limit.min) return 0;
  return Math.min(limit.max, value);
}

// The hiddenRequest of Dashboard Settings, always complete: { kind, requestedAt }.
// A kind the registry does not have, or a time that is not a time, is empty.
export function tidyHiddenRequest(raw) {
  const source = isRecord(raw) ? raw : {};
  const requestedAt = typeof source.requestedAt === 'string' && !isNaN(Date.parse(source.requestedAt)) ? source.requestedAt : '';

  return {
    kind: isKind(source.kind) ? source.kind : '',
    requestedAt: requestedAt,
  };
}

// The seconds between two page changes of the large panel, which is where the roll
// happens: Seconds per page, made longer or shorter by Speed. A row with seconds of
// its own changes that for one page, so the hours come out about right, not exact.
export function paceSecondsOf(settings) {
  const seconds = typeof settings.pageSeconds === 'number' && settings.pageSeconds > 0 ? settings.pageSeconds : defaultSettings.pageSeconds;
  return seconds * (speeds[settings.speed] || 1);
}

// The chance that one page change plays a transition that comes about once in this many
// hours. The page changes come every paceSeconds, so 20 seconds and 60 hours is 20 in
// 216000, which is 1 in 10800.
export function chancePerChange(everyHours, paceSeconds) {
  return paceSeconds / (everyHours * 3600);
}

// The handled request, kept under a name of its own in localStorage
export function readHandledRequest(storage) {
  return readHandled(storage, handledKey);
}

export function rememberHandledRequest(storage, requestedAt) {
  return rememberHandled(storage, requestedAt, handledKey);
}

// The kind that a push from the Studio asks for, or '' when there is none that
// should play: no push, an old one, one that was handled before, or one with a
// kind the screen does not have.
export function pushedKind(request, handled, now) {
  const tidy = tidyHiddenRequest(request);
  if (tidy.kind === '') return '';
  return shouldRunDemo(tidy.requestedAt, handled, now) ? tidy.kind : '';
}

// Why a hidden transition may not play now, or '' when it may.
//   settings  Dashboard Settings
//   state     what the screen is doing: { motion, takeover, demo, night, playing }
//             motion is 'full', 'calm' or 'none'. The others are true while an alert or
//             announcement, a demo, the night screen or a hidden transition has the screen.
// 'off' and 'motion' do not pass by themselves. 'busy' does: it is over when
// whatever has the screen lets go, so a push waits for it.
export function holdReason(settings, state) {
  if (settings.hiddenEnabled !== true) return 'off';
  if (state.motion !== 'full') return 'motion';
  if (state.takeover || state.demo || state.night || state.playing) return 'busy';
  return '';
}

// A chance as a percent from 0 to 100. Anything else is the starting value,
// which is what the dashboard does with a setting that is missing or silly.
function percentOf(value, field) {
  if (typeof value !== 'number' || !isFinite(value)) value = defaultSettings[field];
  if (typeof value !== 'number') return 0; // a new transition with no starting value yet
  return Math.min(100, Math.max(0, value));
}

// The time (milliseconds since 1970) that a hidden transition last played, from
// localStorage. A storage that cannot be read, or has nothing, gives 0, which is
// "none has played yet".
export function readLastFired(storage) {
  try {
    const firedAt = Number(storage.getItem(lastFiredKey));
    return isFinite(firedAt) && firedAt > 0 ? firedAt : 0;
  } catch (error) {
    return 0;
  }
}

// Remembers the time. False when the storage cannot be written: the runner then still
// knows it from its own memory until the page is reloaded.
export function rememberLastFired(storage, firedAt) {
  try {
    storage.setItem(lastFiredKey, String(firedAt));
    return true;
  } catch (error) {
    return false;
  }
}

// True while the gap after the last hidden transition is not over. A last time in the
// future means the clock moved, and holds nothing back.
export function gapHolds(lastFired, now) {
  if (typeof lastFired !== 'number' || lastFired <= 0) return false;

  const age = now.getTime() - lastFired;
  return age >= 0 && age < hiddenGapHours * 3600 * 1000;
}

// The share of the page changes that play this transition, as a percent from 0 to 100.
// The hours decide it. With none set, the older percent does.
function shareOf(settings, entry, paceSeconds) {
  const hours = tidyHours(settings[entry.hoursField], entry.hoursField);
  if (hours > 0) return Math.min(100, chancePerChange(hours, paceSeconds) * 100);
  return percentOf(settings[entry.chanceField], entry.chanceField);
}

// What happens at this page change of the large panel: null (the normal page
// change) or { kind, how }. how is 'chance', 'push' (from the Studio) or
// 'address' (the ?hidden= switch, for trying one).
//   settings  Dashboard Settings
//   state     see holdReason
//   handled   the push handled before, from readHandledRequest
//   now       a Date
//   lastFired when a hidden transition last played (see readLastFired), or 0. It holds
//             back a chance for hiddenGapHours. A push and the address ignore it.
//   random    a function that gives a number from 0 up to but not including 1,
//             like Math.random. Passing it in is what lets a test pick the number
//   address   the kind the address asked for, or ''. Once it plays, the caller forgets it.
export function chooseHidden(input) {
  if (holdReason(input.settings, input.state) !== '') return null;

  if (isKind(input.address)) return { kind: input.address, how: 'address' };

  const pushed = pushedKind(input.settings.hiddenRequest, input.handled, input.now);
  if (pushed !== '') return { kind: pushed, how: 'push' };

  if (gapHolds(input.lastFired, input.now)) return null;

  // One roll, shared out in the order of the registry: with 1 and 1 the first
  // percent of the way from 0 to 100 is the first kind, the next is the second.
  // Chances that add up to more than 100 leave the last ones no share.
  const roll = input.random() * 100;
  const pace = paceSecondsOf(input.settings);
  let from = 0;
  const kinds = Object.keys(hiddenTransitions);
  for (let index = 0; index < kinds.length; index++) {
    const share = shareOf(input.settings, hiddenTransitions[kinds[index]], pace);
    if (roll < from + share) return { kind: kinds[index], how: 'chance' };
    from += share;
  }
  return null;
}
