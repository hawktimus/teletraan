// The next few things on the team calendar and the Events Calendar entries, one row each.
// The list comes from core/events.js, already merged and sorted.

import { rowBarMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml } from '../../core/text.js';
import { eventDate, timeText } from '../../core/events.js';
import { asDate } from '../../core/time.js';

// Four rows of 144px fill the 576px body. The row height is in events.css.
const MAX_EVENTS = 4;

// When an event is over. An all-day event has no clock time, so it lasts
// at least to the end of its first day, even if the calendar gives no end.
function finishOf(event) {
  const start = asDate(event.start);
  const end = event.end ? asDate(event.end) : start;
  if (!event.allDay) return end;

  const nextMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return end > nextMidnight ? end : nextMidnight;
}

// The events that have not finished yet, so one that is happening now stays
function upcoming(content, now = new Date()) {
  return (content.events || [])
    .filter(event => !isNaN(asDate(event.start)) && finishOf(event) >= now)
    .slice(0, MAX_EVENTS);
}

export function hasContent(content) {
  return upcoming(content).length > 0;
}

export function mount(host, content) {
  const events = upcoming(content);
  const zone = (content.theme || {}).timeZone;
  const lines = events.map((event, index) => rowMarkup(event, index === events.length - 1, zone)).join('');

  host.innerHTML = `
    <section class="page events">
      <div class="header">
        <h2 class="title" data-slat="title">EVENTS</h2>
        <div data-slat="tag">${doubleSlash()}</div>
      </div>

      <div class="rows">${lines}</div>
    </section>`;
}

// Every row is a slat, and the thin metal bar under it turns over with it.
// The last row has no bar under it, because the frame is there.
function rowMarkup(event, isLast, timeZone) {
  const date = eventDate(event, timeZone);

  // The line under the title: the dates if the event lasts several days, the
  // time unless it is an all-day event, then the place. The weekday and date
  // on the left already say when an all-day event starts.
  const line = [date.range, timeText(event), event.location].filter(Boolean).join(' · ');

  return `
    <div class="row" data-slat="item">
      ${isLast ? '' : rowBarMarkup(1124)}
      <div class="date">
        <div class="day-name">${date.weekday}</div>
        <div class="month-day">${date.monthDay}</div>
      </div>
      <div class="details">
        <div class="event-title">${escapeHtml(event.title)}</div>
        ${line ? `<div class="event-when">${escapeHtml(line)}</div>` : ''}
      </div>
    </div>`;
}
