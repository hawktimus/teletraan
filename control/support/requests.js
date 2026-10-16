// What each button of the Now showing tab writes. The screen reads these fields of Dashboard
// Settings (dashboard/core/screen-requests.js, announce.js, screens.js). Every request that holds
// something has an until time, so a hold that is forgotten ends on its own. This file builds the
// Sanity mutations and checks the input; routes/request.js sends them.

import { Refusal } from './http.js';

export const settingsId = 'dashboardSettings';

export const holdMinutes = [10, 30];
export const viewKeys = ['general', 'prime', 'nova', 'family'];
export const themeIds = ['original', 'cybertron', 'retro'];
export const previewMinutes = 10;
export const viewMinutes = { least: 10, most: 120, usual: 30 };
export const pauseMinutes = { least: 5, most: 120, usual: 60 };
export const noticeMinutes = 120;
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
      const minutes = Number(body.minutes);
      if (!holdMinutes.includes(minutes)) throw new Refusal(400, 'Hold a panel for ' + holdMinutes.join(' or ') + ' minutes.');
      if (typeof body.panel !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(body.panel)) throw new Refusal(400, 'Pick a panel to hold.');
      return { set: { holdPanel: { panel: body.panel, until: later(now, minutes) } } };
    }

    case 'view':
      if (!viewKeys.includes(body.key)) throw new Refusal(400, 'Pick one of the views: ' + viewKeys.join(', ') + '.');
      return { set: { showView: { key: body.key, until: later(now, minutesOf(body.minutes, viewMinutes)) } } };

    case 'theme':
      if (!themeIds.includes(body.theme)) throw new Refusal(400, 'Pick one of the themes: ' + themeIds.join(', ') + '.');
      return { set: { previewTheme: { theme: body.theme, until: later(now, previewMinutes) } } };

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
      throw new Refusal(400, 'The Mini does not know that request.');
  }
}

// The Sanity mutations for a built request
export function mutationsFor(built) {
  if (built.create) return [{ create: built.create }];
  return [{ patch: { id: settingsId, set: built.set } }];
}
