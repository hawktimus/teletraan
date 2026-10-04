// The next few things on the team calendar, one row each.

import { rowBarMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml } from '../../core/text.js';
import { asDate, dayName, formatTimeOfDay } from '../../core/time.js';

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
  const lines = events.map((event, index) => rowMarkup(event, index === events.length - 1)).join('');

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
function rowMarkup(event, isLast) {
  const start = asDate(event.start);
  const when = event.allDay ? 'ALL DAY' : formatTimeOfDay(start);
  const where = event.location ? ' · ' + event.location : '';

  return `
    <div class="row" data-slat="item">
      ${isLast ? '' : rowBarMarkup(1124)}
      <div class="date">
        <div class="day-name">${dayName(start)}</div>
        <div class="day-number">${start.getDate()}</div>
      </div>
      <div class="details">
        <div class="event-title">${escapeHtml(event.title)}</div>
        <div class="event-when">${escapeHtml(when + where)}</div>
      </div>
    </div>`;
}
