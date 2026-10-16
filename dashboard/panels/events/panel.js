// The next few things on the team calendar, one row each. Four rows show at a time. Page one is the first
// four and page two the four after them, drawn one under the other in the same list. With a second page
// the panel is held for its time, then the list moves up by four rows and it is held again for the same time
// (scrollPages, which core/schedule.js reads, and scrollCard in frame.js). The pages are made by
// core/event-pages.js from the list in core/events.js, already filtered and sorted.

import { rowBarMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml } from '../../core/text.js';
import { eventDate, timeText } from '../../core/events.js';
import { chipWord, eventsPerPage, shownPages } from '../../core/event-pages.js';

// The pin of a pinned event, 44px square. Its colour is in panels/events/panel.css.
const pinMark = `
  <svg class="pin-mark" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
    <polygon points="12,2 32,2 32,9 12,9"/>
    <polygon points="17,9 27,9 27,22 35,29 35,33 9,33 9,29 17,22"/>
    <polygon points="20,33 24,33 24,42 22,44 20,42"/>
  </svg>`;

// The panel has content when a page has an event
export function hasContent(content) {
  return shownPages(content).length > 0;
}

// How many pages the panel has to hold for: one for each page that has events
export function scrollPages(content) {
  return Math.max(1, shownPages(content).length);
}

export function mount(host, content) {
  const pages = shownPages(content);
  const zone = (content.theme || {}).timeZone;
  const lines = pages.map((rows, index) => pageMarkup(rows, index === pages.length - 1, zone)).join('');

  host.innerHTML = `
    <section class="page events">
      <div class="header">
        <h2 class="title" data-slat="title">EVENTS</h2>
        <div data-slat="tag">${doubleSlash()}</div>
      </div>

      <div class="rows"><div data-scroll-list>${lines}</div></div>
    </section>`;
}

// The rows of one page. A page that is not the last is filled up to four places with empty ones, so the next
// page starts at the top of the window when the list has moved up. The fourth place of a page and the last
// row of the last page have no bar under them: the frame is there.
function pageMarkup(rows, isLastPage, timeZone) {
  const places = rows.map((row, index) => rowMarkup(row, index === eventsPerPage - 1 || (isLastPage && index === rows.length - 1), timeZone));

  while (!isLastPage && places.length < eventsPerPage) places.push('<div class="row row-blank"></div>');
  return places.join('');
}

// Every row is a slat, and the thin metal bar under it turns over with it.
// A row at the foot of the window has no bar under it, because the frame is there.
// The title line is the kind chip, the title, which is cut with an ellipsis when
// it does not fit, and the pin of a pinned event. An event from a calendar with no
// kind has no chip.
function rowMarkup(row, atFoot, timeZone) {
  const event = row.event;
  const date = eventDate(event, timeZone);

  // The line under the title: the dates if the event lasts several days, the
  // time unless it is an all-day event, then the place. The weekday and date
  // on the left already say when an all-day event starts.
  const line = [date.range, timeText(event), event.location].filter(Boolean).join(' · ');
  const word = chipWord(row.kind);

  return `
    <div class="row" data-slat="item">
      ${atFoot ? '' : rowBarMarkup(1124)}
      <div class="date">
        <div class="day-name">${date.weekday}</div>
        <div class="month-day">${date.monthDay}</div>
      </div>
      <div class="details">
        <div class="event-title">
          ${word ? `<span class="kind-chip">${word}</span>` : ''}
          <span class="event-name">${escapeHtml(event.title)}</span>
          ${row.forced ? pinMark : ''}
        </div>
        ${line ? `<div class="event-when">${escapeHtml(line)}</div>` : ''}
      </div>
    </div>`;
}
