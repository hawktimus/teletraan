// The next few things on the team calendar, one row each.

import { plateMarkup, scanMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml } from '../../core/text.js';
import { asDate, dayName, formatTimeOfDay } from '../../core/time.js';

const MAX_EVENTS = 4;

// Each row is 144px tall and the panel body starts 124px from the top, so
// the lines between rows are at 268, 412 and 556. The row height is
// repeated in events.css.
const ROW_HEIGHT = 144;
const BODY_TOP = 124;

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
  // a line at the top of every row except the first
  const dividers = events.map((event, index) => BODY_TOP + index * ROW_HEIGHT).slice(1);

  host.innerHTML = `
    <section class="panel events" data-sequence="grid1">
      ${plateMarkup('grid1', { dividers: dividers })}
      ${scanMarkup('grid1')}

      <div class="header">
        <h2 class="title" data-part="title">EVENTS</h2>
        <div data-part="tag">${doubleSlash()}</div>
      </div>

      <div class="rows">${events.map(rowMarkup).join('')}</div>
    </section>`;
}

// The date sits in a sunk plate with the same two cut corners as the panel.
// The first shape is 2px lower, so a light edge shows under the second. The
// purple band at the top holds the day name.
const dateTile = `
  <svg class="date-tile" width="136" height="124" viewBox="0 0 136 124">
    <polygon class="pocket-lit" points="20,4 134,4 134,102 116,120 2,120 2,22"/>
    <polygon class="pocket" points="20,2 134,2 134,100 116,118 2,118 2,20"/>
    <polygon class="date-band" points="4,21 21,4 132,4 132,54 4,54"/>
    <polyline class="date-band-lit" points="4,21 21,5 132,5"/>
    <line class="date-seam" x1="4" y1="55" x2="132" y2="55"/>
  </svg>`;

function rowMarkup(event, index) {
  const start = asDate(event.start);
  const when = event.allDay ? 'ALL DAY' : formatTimeOfDay(start);
  const where = event.location ? ' · ' + event.location : '';

  return `
    <div class="row" data-part="row" data-index="${index}">
      <div class="date">
        ${dateTile}
        <div class="day-name">${dayName(start)}</div>
        <div class="day-number">${start.getDate()}</div>
      </div>
      <div class="details">
        <div class="event-title">${escapeHtml(event.title)}</div>
        <div class="event-when">${escapeHtml(when + where)}</div>
      </div>
    </div>`;
}
