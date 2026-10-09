// Night mode, the screensaver: the plain functions. They know nothing about
// the page, so tools/test-night.mjs can run them. core/night-screen.js draws
// the screen and frame.css moves the logo.
//
// Two questions are answered here.
//
//   When is it night? inNightWindow() and nightWanted(). The night starts and
//   ends at the fixed times in constants.js.
//
//   Where does the logo start, so that it never starts in a corner and still
//   reaches one now and then? nightPlan(). The logo is moved by two CSS
//   animations, one sideways and one downwards, each going back and forth
//   (direction alternate). Each reaches a wall once every `across` or `down`
//   seconds. It is in a corner when both reach a wall at the same moment. That
//   happens once every across x down seconds when the two numbers share no
//   factor (config.js, nightSpeeds), and only if the two animations start at
//   the right places. nightPlan() picks the places, with a negative animation
//   delay for each, from the one thing that is free to choose: when the first
//   corner hit comes. docs/night-mode.md has the same sum in words.

import { defaultSettings, defaultThemeSettings, nightFirstHit, nightSpeeds } from '../config.js';
import { nightEnd, nightStart } from './constants.js';

// How many colour pairs frame.css has for the logo (the rules for data-pair)
export const pairCount = 4;

// Two bounces closer together than this are one corner hit
export const cornerWindowMs = 100;

// Time of day

const clockFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

// True for 24 hour time with two digits each, such as 23:30 or 09:05
export function isClockTime(text) {
  return typeof text === 'string' && clockFormat.test(text);
}

function minutesOfDay(text) {
  const parts = text.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

const formatters = {}; // one per time zone, because making one is slow

// Minutes since midnight in a time zone, by the clock on the wall there. The
// parts are read by name and the zone is always given, so the Mini's own time
// zone never matters. A zone that Intl does not know falls back to the Theme
// page's default, so a slip cannot stop the screen.
export function minutesIn(timeZone, now) {
  if (!formatters[timeZone]) {
    try {
      formatters[timeZone] = makeFormatter(timeZone);
    } catch (error) {
      formatters[timeZone] = makeFormatter(defaultThemeSettings.timeZone);
    }
  }

  const parts = formatters[timeZone].formatToParts(now);
  const get = type => Number(parts.filter(part => part.type === type)[0].value);
  return (get('hour') % 24) * 60 + get('minute'); // some browsers write midnight as 24
}

function makeFormatter(timeZone) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

// True when the clock in the time zone is from start (included) up to end
// (not included). An end earlier than the start runs past midnight, so
// 23:30 to 11:30 is the night before and the morning after. The same start and
// end is no time at all. A start or end that cannot be read gives false.
export function inNightWindow(now, start, end, timeZone) {
  if (!isClockTime(start) || !isClockTime(end)) return false;

  const from = minutesOfDay(start);
  const to = minutesOfDay(end);
  if (from === to) return false;

  const at = minutesIn(timeZone, now);
  return from < to ? at >= from && at < to : at >= from || at < to;
}

// Whether the night screen should be up. override is the ?night= switch of the
// address: 'on' forces it, 'off' stops it. The preview switch forces it too,
// even when Use night mode is off, so an editor can see the look first. The
// start and end stored in the settings are not read.
export function nightWanted(settings, timeZone, now, override) {
  if (override === 'off') return false;
  if (override === 'on' || settings.nightPreview === true) return true;
  return settings.nightEnabled === true && inNightWindow(now, nightStart, nightEnd, timeZone);
}

// The bounce

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a, b) {
  return a / gcd(a, b) * b;
}

// True when the second is not within 15 percent of a wall, so the logo is in
// the open at that moment and not touching an edge
function awayFromWalls(second, seconds) {
  const part = (second % seconds) / seconds;
  return part >= 0.15 && part <= 0.85;
}

// Where the logo is along one axis, from 0 (the left or top wall) to 1 (the
// right or bottom wall), `seconds` after night mode started. This is what
// frame.css does with an animation of this duration and this (negative) delay
// that goes back and forth.
export function positionAt(seconds, duration, delay) {
  const turns = ((seconds + delay) / duration) % 2;
  return turns <= 1 ? turns : 2 - turns;
}

// The two durations and the two delays that start the bounce. speedName is a
// name in nightSpeeds, random() is Math.random (a test hands in its own).
// Returns { across, down, acrossDelay, downDelay, firstHit, repeatEvery }, all
// in whole seconds. frame.css gets the durations and the delays as negative
// numbers (the animation starts that far in).
//
// The logo is at a wall sideways at the moments that are a whole number of
// `across` seconds into the animation, and at a wall downwards at the moments
// that are a whole number of `down` seconds in. To have both at one moment,
// firstHit seconds after the start, each animation has to be started
// (across - firstHit mod across) seconds in, and (down - firstHit mod down) in.
// Then the logo is in a corner at firstHit and again every repeatEvery seconds,
// and at no moment before the first. A firstHit that puts either animation near
// a wall at time 0 is not used, so the logo never starts in a corner.
export function nightPlan(speedName, random) {
  const speed = nightSpeeds[Object.keys(nightSpeeds).includes(speedName) ? speedName : defaultSettings.nightSpeed];
  const across = speed.across;
  const down = speed.down;
  const repeatEvery = lcm(across, down);

  // The first hit comes within the range in config.js, and never later than
  // the repeat, because then an earlier hit would be the first
  const latest = Math.min(nightFirstHit.max, repeatEvery);
  const choices = [];
  for (let second = nightFirstHit.min; second <= latest; second++) {
    if (awayFromWalls(second, across) && awayFromWalls(second, down)) choices.push(second);
  }
  const firstHit = choices.length > 0 ? choices[Math.floor(random() * choices.length)] : nightFirstHit.min;

  return {
    across: across,
    down: down,
    acrossDelay: across - (firstHit % across),
    downDelay: down - (firstHit % down),
    firstHit: firstHit,
    repeatEvery: repeatEvery,
  };
}

// The next colour pair of the logo, going round
export function nextPair(current) {
  const number = Number.isInteger(current) && current >= 0 ? current : -1;
  return (number + 1) % pairCount;
}

// Tells a corner hit from an ordinary bounce. Call bounce('x' or 'y', time in
// milliseconds) every time the logo reaches a wall. It answers true on the
// second of two bounces that came within windowMs of each other, one of each
// axis, and forgets them so that the same pair is not counted twice.
export function makeCornerDetector(windowMs) {
  const last = { x: null, y: null };

  return {
    bounce(axis, time) {
      const other = axis === 'x' ? 'y' : 'x';
      if (last[other] !== null && Math.abs(time - last[other]) <= windowMs) {
        last.x = null;
        last.y = null;
        return true;
      }
      last[axis] = time;
      return false;
    },
  };
}
