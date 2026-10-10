// The pages of the Events panel: which events are on page one, which are on page two, and the kind
// each one is. The panel shows four events on a page and comes round twice in a row in the rotation,
// page one and then page two (registry.js, withPages in core/panel-order.js). The plain functions
// only, so tools/test-event-pages.mjs can run them.
//
// With Group events by kind off the pages go by date. Page one is the pinned events first, then the
// next ones until it has four, and page two is the four after those. With it on, page one is the next
// Meetings, Deadlines and Other events and page two the next Competitions and Outreach events, four on
// each. Other goes with page one so that an event from a calendar nobody gave a kind to is never left
// to page two, which does not run when it is empty.
//
// A pinned event is one that an Always show rule with Pin to page one switched on matches (core/events.js,
// forcingRule). It comes first on page one, the earliest first, whatever its kind. At most three events are
// pinned, the earliest. The rest are shown or left out like any other event. In the code the word
// for a pinned event is forced, the name of the field in Studio.
//
// The kind of an event is the kind of its calendar in Dashboard Settings, Calendars.

import { calendarKinds, defaultCalendarKind } from '../config.js';
import { forcingRule } from './events.js';
import { asDate } from './time.js';

// Four rows of 144px fill the 576px body (panels/events/events.css)
export const eventsPerPage = 4;
export const mostForcedEvents = 3;

// Page two when the events are grouped. Every other kind is on page one.
const secondPageKinds = ['competitions', 'outreach'];

// The words in the chip before a title. Competition is cut to COMP: it is the longest word, and
// the chip takes its room from the title.
const chipWords = {
  meetings: 'MEETING',
  competitions: 'COMP',
  outreach: 'OUTREACH',
  deadlines: 'DEADLINE',
  other: 'OTHER',
};

// The names of the kinds as the Studio shows them. check-calendars.sh prints them.
const kindTitles = {
  meetings: 'Meetings',
  competitions: 'Competitions',
  outreach: 'Outreach',
  deadlines: 'Deadlines',
  other: 'Other',
};

// calendars is content.settings.calendars. A calendar with no kind, one that is not in the list, and an
// event whose calendar has no row are other.
export function kindOf(event, calendars) {
  const row = (Array.isArray(calendars) ? calendars : []).find(calendar => calendar && calendar.id === event.calendarId);
  return row && calendarKinds.includes(row.kind) ? row.kind : defaultCalendarKind;
}

export function chipWord(kind) {
  return chipWords[kind] || chipWords[defaultCalendarKind];
}

export function kindTitle(kind) {
  return kindTitles[kind] || kindTitles[defaultCalendarKind];
}

// When an event is over. An all-day event has no clock time, so it lasts
// at least to the end of its first day, even if the calendar gives no end.
function finishOf(event) {
  const start = asDate(event.start);
  const end = event.end ? asDate(event.end) : start;
  if (!event.allDay) return end;

  const nextMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return end > nextMidnight ? end : nextMidnight;
}

function byStart(first, second) {
  return asDate(first.event.start) - asDate(second.event.start);
}

// Both pages, as a list of two lists of rows. A row is { event, kind, forced }. The events are
// content.events, which core/events.js has filtered and sorted. One that has finished is not shown,
// so an event that is happening now stays. A page with no rows does not run.
export function eventPages(content, now = new Date()) {
  const settings = content.settings || {};
  const zone = (content.theme || {}).timeZone;

  const rows = (content.events || [])
    .filter(event => !isNaN(asDate(event.start)) && finishOf(event) >= now)
    .map(event => ({ event: event, kind: kindOf(event, settings.calendars), forced: false }))
    .sort(byStart);

  const forced = rows.filter(row => forcingRule(row.event, content.calendarFilters, zone, now) !== null).slice(0, mostForcedEvents);
  forced.forEach(row => {
    row.forced = true;
  });

  const others = rows.filter(row => !row.forced);
  const room = eventsPerPage - forced.length;

  if (settings.groupEventsByKind === true) {
    const second = others.filter(row => secondPageKinds.includes(row.kind));
    const first = others.filter(row => !secondPageKinds.includes(row.kind));
    return [forced.concat(first.slice(0, room)), second.slice(0, eventsPerPage)];
  }
  return [forced.concat(others.slice(0, room)), others.slice(room, room + eventsPerPage)];
}

// The rows of one page, counting from 1. A page that does not exist has none.
export function pageRows(content, page, now = new Date()) {
  return eventPages(content, now)[page - 1] || [];
}
