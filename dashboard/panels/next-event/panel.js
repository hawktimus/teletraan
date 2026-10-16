// Title, day, time and place of the first event that has not finished yet.
// The list comes from core/events.js, already merged and sorted.

import { rowBarMarkup } from '../../core/plate.js';
import { escapeHtml } from '../../core/text.js';
import { eventDate, timeText } from '../../core/events.js';
import { asDate } from '../../core/time.js';

// An event with no end time is over when it starts
function endOf(event) {
  const start = asDate(event.start);
  const end = event.end ? asDate(event.end) : start;
  return isNaN(end) ? start : end;
}

// An event that is happening now still counts as the next one
function nextEvent(content, now = new Date()) {
  return (content.events || []).find(event => !isNaN(asDate(event.start)) && endOf(event) >= now);
}

export function hasContent(content) {
  return nextEvent(content) !== undefined;
}

export function mount(host, content) {
  const event = nextEvent(content);
  const zone = (content.theme || {}).timeZone;

  host.innerHTML = `
    <section class="page next-event">
      <div class="label" data-slat="label">NEXT EVENT</div>

      <div class="content" data-slat="content">${event ? eventMarkup(event, zone) : ''}</div>
    </section>`;
}

function eventMarkup(event, timeZone) {
  // An event of several days shows its dates, an all-day event shows no time
  const time = timeText(event);
  const when = eventDate(event, timeZone).text;
  const location = event.location ? `<div class="location">${escapeHtml(event.location)}</div>` : '';

  return `
    <div class="title">${escapeHtml(event.title)}</div>
    <div class="bar-slot">${rowBarMarkup(628)}</div>
    <div class="when">${escapeHtml(time ? when + ' · ' + time : when)}</div>
    ${location}`;
}
