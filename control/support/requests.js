// What each button of the Status tab writes. The screen reads these fields of Dashboard
// Settings (dashboard/core/screen-requests.js, announce.js, screens.js). Every request that holds
// something has an until time, so a hold that is forgotten ends on its own. This file builds the
// Sanity mutations and checks the input; routes/request.js sends them.

import { Refusal } from './http.js';

export const settingsId = 'dashboardSettings';

export const holdMinutes = { least: 1, most: 60 };
// The themes and the views come from the one list the screen reads them with, so the page, the service and the wall
// cannot disagree about them. The words are the names on the buttons: Robotics is general and Condensed is family.
import { longestMinutes, themeIds, viewKeys } from '../../dashboard/core/screen-requests.js';
import { defaultThemeByWeekday, scheduledThemeIds, weekdays } from '../../dashboard/config-lists.js';

export { themeIds, viewKeys };
export const themeNames = { original: 'Original', cybertron: 'Cybertron', retro: 'Retro', foundry: 'Foundry' };
export const viewNames = { general: 'Robotics', prime: 'Prime', nova: 'Nova', family: 'Condensed' };
const previewMinutes = 10;
export const themeMinutes = { least: 10, most: 120, usual: previewMinutes };
export const viewMinutes = { least: 10, most: 120, usual: 30 };
const pauseMinutes = { least: 5, most: 120, usual: 60 };
const noticeMinutes = 120;
// A theme or a view that stays until it is reset runs for this long at most, the same limit the wall obeys
export const stayHours = longestMinutes / 60;
export const noticeLongest = 90;

export const actions = ['next', 'pause', 'resume', 'hold', 'view', 'theme', 'announce', 'presentation-test', 'post-announcement', 'schedule'];

function stamp(now) {
  return new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function later(now, minutes) {
  return stamp(new Date(now).getTime() + minutes * 60000);
}

function minutesOf(input, range) {
  const wanted = input === undefined || input === null || input === '' ? range.usual : Number(input);
  if (!Number.isFinite(wanted) || wanted < range.least || wanted > range.most) {
    throw new Refusal(400, 'Minutes should be from ' + range.least + ' to ' + range.most + '.');
  }
  return Math.round(wanted);
}

// The end of a theme or view request. hours (1 to 24) or until (a time no more than 24 hours ahead) means it stays until
// a reset; otherwise it is a timed request of minutes in the range.
function endOf(body, now, range) {
  const hours = body.hours;
  const hasHours = hours !== undefined && hours !== null && hours !== '';
  const hasUntil = typeof body.until === 'string' && body.until !== '';
  const tooLong = new Refusal(400, 'A theme or a view can stay for 24 hours at most. Reset it to the schedule when you are done.');

  if (hasHours) {
    const number = Number(hours);
    if (!Number.isFinite(number) || number <= 0) throw new Refusal(400, 'Hours should be a number from 1 to ' + stayHours + '.');
    if (number > stayHours) throw tooLong;
    return later(now, Math.round(number * 60));
  }
  if (hasUntil) {
    const end = Date.parse(body.until);
    if (isNaN(end) || end <= new Date(now).getTime()) throw new Refusal(400, 'The end time has already passed.');
    if (end > new Date(now).getTime() + longestMinutes * 60000) throw tooLong;
    return stamp(end);
  }
  return later(now, minutesOf(body.minutes, range));
}

// A panel is held for a whole number of minutes the caller names. There is no default.
function holdMinutesOf(input) {
  const wanted = input === undefined || input === null || input === '' || typeof input === 'boolean' ? NaN : Number(input);
  if (!Number.isInteger(wanted) || wanted < holdMinutes.least || wanted > holdMinutes.most) {
    throw new Refusal(400, 'Hold a panel for a whole number of minutes from ' + holdMinutes.least + ' to ' + holdMinutes.most + '.');
  }
  return wanted;
}

const nothing = { holdPanel: { panel: '', until: '' }, showView: { key: '', until: '' }, previewTheme: { theme: '', until: '' }, pauseRotation: { until: '' } };

// The change to Dashboard Settings that an action makes, as { set } for a patch, or { create } for a new document
export function buildRequest(action, input, now = new Date()) {
  const body = input && typeof input === 'object' ? input : {};

  switch (action) {
    case 'next':
      return { set: { nextLookRequest: { requestedAt: stamp(now) } } };

    case 'pause':
      return { set: { pauseRotation: { until: later(now, minutesOf(body.minutes, pauseMinutes)) } } };

    case 'resume':
      return { set: { pauseRotation: nothing.pauseRotation } };

    case 'hold': {
      const minutes = holdMinutesOf(body.minutes);
      if (typeof body.panel !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(body.panel)) throw new Refusal(400, 'Pick a panel to hold from the list.');
      return { set: { holdPanel: { panel: body.panel, until: later(now, minutes) } } };
    }

    case 'view':
      if (!viewKeys.includes(body.key)) throw new Refusal(400, 'Pick one of the views: ' + viewKeys.join(', ') + '.');
      return { set: { showView: { key: body.key, until: endOf(body, now, viewMinutes) } } };

    case 'theme':
      if (!themeIds.includes(body.theme)) throw new Refusal(400, 'Pick one of the themes: ' + themeIds.join(', ') + '.');
      return { set: { previewTheme: { theme: body.theme, until: endOf(body, now, themeMinutes) } } };

    case 'announce':
      return { set: { announceRequest: { requestedAt: stamp(now) } } };

    case 'presentation-test':
      return { set: { presentationTestRequest: { requestedAt: stamp(now) } } };

    case 'schedule':
      return { set: nothing };

    case 'post-announcement': {
      const text = typeof body.text === 'string' ? body.text.trim().replace(/\s+/g, ' ') : '';
      if (text === '') throw new Refusal(400, 'Type the announcement first.');
      if (text.length > noticeLongest) throw new Refusal(400, 'An announcement is ' + noticeLongest + ' characters or fewer. This one has ' + text.length + '.');
      return { create: { _type: 'announcement', text: text, start: stamp(now), end: later(now, noticeMinutes), level: 'notice' } };
    }

    default:
      throw new Refusal(400, 'The Teletraan computer does not know that request.');
  }
}

// The Sanity mutations for a built request
export function mutationsFor(built) {
  if (built.create) return [{ create: built.create }];
  return [{ patch: { id: settingsId, set: built.set } }];
}

// The theme the schedule plays on a day, from themeByWeekday of Dashboard Settings and the time zone of the Look page
export function todayThemeOf(settings, zone, now = new Date()) {
  let day = '';
  try {
    day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: zone || 'America/New_York' }).format(now).toLowerCase();
  } catch (error) {
    day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' }).format(now).toLowerCase();
  }
  if (!weekdays.includes(day)) return scheduledThemeIds[0];
  const saved = settings && settings.themeByWeekday && typeof settings.themeByWeekday === 'object' ? settings.themeByWeekday[day] : '';
  return scheduledThemeIds.includes(saved) ? saved : defaultThemeByWeekday[day];
}

// The views in the order the schedule plays them. There is no view of the day: they follow each other.
export function todayViewsOf(settings) {
  const listed = settings && Array.isArray(settings.viewOrder) ? settings.viewOrder.filter((key, at, all) => viewKeys.includes(key) && all.indexOf(key) === at) : [];
  return listed.length > 0 ? listed : viewKeys.slice();
}
