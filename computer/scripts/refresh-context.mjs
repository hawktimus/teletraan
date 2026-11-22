// What the pre-meeting refresh needs to know before it decides (computer/scripts/pre-meeting-refresh.sh): the settings and the
// time zone from the last good copy of the content, and the Band events of kind Meetings of the next day and
// the last one, read from the calendar files the computer already downloaded. It reads files only and prints one JSON object.
//
//   node refresh-context.mjs <data folder> [now in milliseconds]

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseIcs } from '../../dashboard/core/calendar-parse.js';
import { expandEvents } from '../../dashboard/core/calendar-expand.js';

const dayMs = 86400000;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

export function contextOf(dataFolder, nowMs) {
  const content = readJson(path.join(dataFolder, 'live', 'content.json'), { result: null }).result || {};
  const settings = content.settings && typeof content.settings === 'object' ? content.settings : {};
  const zone = content.theme && typeof content.theme.timeZone === 'string' ? content.theme.timeZone : '';

  const events = [];
  (Array.isArray(settings.calendars) ? settings.calendars : []).forEach(calendar => {
    if (!calendar || calendar.kind !== 'meetings' || calendar.show === false || !/^[a-z0-9_-]{1,40}$/.test(String(calendar.id))) return;
    try {
      const text = fs.readFileSync(path.join(dataFolder, 'calendars', calendar.id + '.ics'), 'utf8');
      expandEvents(parseIcs(text), new Date(nowMs - dayMs), new Date(nowMs + dayMs)).forEach(event => {
        events.push({ start: event.start.getTime(), end: event.end.getTime(), kind: 'meetings' });
      });
    } catch (error) {
      // a calendar that is not there or does not read adds no event
    }
  });

  return { settings: settings, zone: zone, events: events };
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const now = process.argv[3] ? Number(process.argv[3]) : Date.now();
  console.log(JSON.stringify(contextOf(process.argv[2], now)));
}
