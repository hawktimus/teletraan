// The next few things on the team calendar, one row each. The panel comes round twice in a row in
// the rotation: page one shows four events and page two the four after them. The pages are made by
// core/event-pages.js from the list in core/events.js, already filtered and sorted.

import { rowBarMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml } from '../../core/text.js';
import { eventDate, timeText } from '../../core/events.js';
import { chipWord, pageRows } from '../../core/event-pages.js';

// The pin of a pinned event, 44px square. Its colour is in events.css.
const pinMark = `
  <svg class="pin-mark" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
    <polygon points="12,2 32,2 32,9 12,9"/>
    <polygon points="17,9 27,9 27,22 35,29 35,33 9,33 9,29 17,22"/>
    <polygon points="20,33 24,33 24,42 22,44 20,42"/>
  </svg>`;

// The page is 1 or 2. A page with nothing on it does not run.
export function hasContent(content, page = 1) {
  return pageRows(content, page).length > 0;
}

export function mount(host, content, page = 1) {
  const rows = pageRows(content, page);
  const zone = (content.theme || {}).timeZone;
  const lines = rows.map((row, index) => rowMarkup(row, index === rows.length - 1, zone)).join('');

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
// The title line is the kind chip, the title, which is cut with an ellipsis when
// it does not fit, and the pin of a pinned event.
function rowMarkup(row, isLast, timeZone) {
  const event = row.event;
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
        <div class="event-title">
          <span class="kind-chip">${chipWord(row.kind)}</span>
          <span class="event-name">${escapeHtml(event.title)}</span>
          ${row.forced ? pinMark : ''}
        </div>
        ${line ? `<div class="event-when">${escapeHtml(line)}</div>` : ''}
      </div>
    </div>`;
}
