// Title, day, time and place of the first event that has not finished yet.

import { rowBarMarkup } from '../../core/plate.js';
import { escapeHtml } from '../../core/text.js';
import { asDate, formatDate, formatTimeOfDay } from '../../core/time.js';

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

  host.innerHTML = `
    <section class="page next-event">
      <div class="label" data-slat="label">NEXT EVENT</div>

      <div class="content" data-slat="content">${event ? eventMarkup(event) : ''}</div>
    </section>`;
}

function eventMarkup(event) {
  const start = asDate(event.start);
  const time = event.allDay ? 'ALL DAY' : formatTimeOfDay(start);
  const location = event.location ? `<div class="location">${escapeHtml(event.location)}</div>` : '';

  return `
    <div class="title">${escapeHtml(event.title)}</div>
    <div class="bar-slot">${rowBarMarkup(628)}</div>
    <div class="when">${formatDate(start)} · ${time}</div>
    ${location}`;
}
