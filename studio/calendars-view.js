// The Calendars page, under Events in the sidebar (structure.js). It is a page of its own, not
// a document. On the left are the calendars of Dashboard Settings, with how many events each
// has and when it was last downloaded. On the right are the next 12 events of the calendar
// picked on the left, SHOWN or HIDDEN, with the name of the Calendar filter that hides it.
// The Mini writes what it shows into the document calendar-status (schemas/calendarStatus.js,
// deploy/scripts/calendar-status.sh). Nothing here changes a document: the names and switches
// are edited in Dashboard Settings.
//
// If a document is missing it says Nothing yet, and if one cannot be read it says so. Neither
// stops the page from opening.
//
// The words and the rows are in calendars-view-parts.js, so that check-schemas.mjs can read
// them with node. It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import {
  calendarStatusId,
  helpLine,
  settingsLine,
  publicLine,
  noCalendarsLine,
  nothingYet,
  rowsOf,
  detailOf,
  notesFor,
  updatedText,
} from './calendars-view-parts.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// The id of Dashboard Settings, the same as settingsId in structure.js
const settingsId = 'dashboardSettings';

// Plain styles. The colours are the Studio's own variables, so the page follows
// the Studio's light and dark themes, and each has a fallback.
const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const critical = 'var(--card-badge-critical-fg-color, #b91c1c)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 32px' },
  column: { maxWidth: 1000, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  help: { lineHeight: 1.5, margin: '0 0 16px' },
  note: { color: critical, fontSize: 14, margin: '0 0 8px' },
  muted: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '0 0 16px' },
  panes: { display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', margin: '0 0 16px' },
  left: { flex: '0 0 300px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  right: { flex: '1 1 380px', minWidth: 0 },
  row: {
    boxSizing: 'border-box',
    width: '100%',
    padding: '10px 12px',
    fontFamily: 'inherit',
    fontSize: 14,
    lineHeight: 1.4,
    textAlign: 'left',
    color: 'inherit',
    background: 'transparent',
    border: border,
    borderRadius: 4,
    cursor: 'pointer',
  },
  rowPicked: { borderColor: primaryText, background: primaryBackground, color: primaryText },
  rowName: { display: 'block', fontSize: 16, fontWeight: 600 },
  rowLine: { display: 'block', marginTop: 2 },
  problem: { color: critical, margin: '8px 0 0', fontSize: 14 },
  subheading: { fontSize: 20, fontWeight: 600, margin: '0 0 8px' },
  fact: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '0 0 4px', fontSize: 14 },
  factLabel: { minWidth: 200, fontWeight: 600 },
  events: { margin: '16px 0 0', padding: 0, listStyle: 'none' },
  event: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 12px', padding: '8px 0', borderTop: border, fontSize: 14 },
  eventDate: { minWidth: 96, fontWeight: 600 },
  eventTime: { minWidth: 72 },
  eventTitle: { flex: '1 1 200px', minWidth: 0 },
  badge: { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4 },
  shown: { background: 'var(--card-badge-positive-bg-color, #dcfce7)', color: 'var(--card-badge-positive-fg-color, #166534)' },
  hidden: { background: 'var(--card-badge-caution-bg-color, #fef3c7)', color: 'var(--card-badge-caution-fg-color, #92400e)' },
  rule: { flexBasis: '100%', color: muted, fontSize: 13 },
};

// The calendars of the published Dashboard Settings and the published status document. This
// never fails: a document that cannot be read is reported as unreadable, and the page says so.
export async function readCalendars(client) {
  const read = { entries: [], status: null, entriesUnreadable: false, statusUnreadable: false };

  try {
    const settings = await client.fetch('*[_id == $id][0]{ calendars }', { id: settingsId }, { perspective: 'published' });
    read.entries = settings && Array.isArray(settings.calendars) ? settings.calendars : [];
  } catch (error) {
    read.entriesUnreadable = true;
  }

  try {
    const found = await client.fetch('*[_id == $id][0]', { id: calendarStatusId }, { perspective: 'published' });
    read.status = found && typeof found === 'object' ? found : null;
  } catch (error) {
    read.statusUnreadable = true;
  }
  return read;
}

function leftSide(rows, chosen, select) {
  return h(
    'div',
    { style: styles.left, 'data-side': 'calendars' },
    rows.map(row => {
      const picked = row.code === chosen.code;
      return h(
        'button',
        {
          key: row.code,
          type: 'button',
          'aria-pressed': picked,
          style: picked ? Object.assign({}, styles.row, styles.rowPicked) : styles.row,
          onClick: () => select(row.code),
        },
        h('span', { style: styles.rowName }, row.name),
        h('span', { style: styles.rowLine }, 'Code ' + row.code),
        h('span', { style: styles.rowLine }, row.screen),
        h('span', { style: styles.rowLine }, row.count),
        h('span', { style: styles.rowLine }, row.download),
        row.problem ? h('span', { style: Object.assign({}, styles.rowLine, { color: critical }) }, row.problem) : null
      );
    }),
    h('p', { style: styles.muted }, settingsLine)
  );
}

function eventItem(event) {
  return h(
    'li',
    { key: event.key, style: styles.event },
    h('span', { style: styles.eventDate }, event.date),
    h('span', { style: styles.eventTime }, event.time),
    h('span', { style: styles.eventTitle }, event.title),
    h('span', { style: Object.assign({}, styles.badge, event.hidden ? styles.hidden : styles.shown) }, event.badge),
    event.rule ? h('span', { style: styles.rule }, event.rule) : null
  );
}

function rightSide(detail) {
  return h(
    'div',
    { style: styles.right, 'data-side': 'events' },
    h('h2', { style: styles.subheading }, detail.name + ' (' + detail.code + ')'),
    detail.facts.map(fact => h('p', { key: fact.label, style: styles.fact }, h('span', { style: styles.factLabel }, fact.label), h('span', null, fact.text))),
    detail.problem ? h('p', { style: styles.problem }, detail.problem) : null,
    detail.empty ? h('p', { style: styles.muted }, detail.empty) : null,
    detail.events.length > 0 ? h('ul', { style: styles.events }, detail.events.map(eventItem)) : null
  );
}

// What the page shows for what was read: null while it is being read, then what readCalendars
// gives. selected is the code picked on the left, and select picks one. now is the time to
// count the ages from.
export function calendarsPage(read, selected, select, now) {
  const rows = read ? rowsOf(read.entries, read.status, now) : [];
  const chosen = rows.filter(row => row.code === selected)[0] || rows[0];
  const notes = notesFor(read).map(text => h('p', { key: text, style: styles.note }, text));

  let body;
  if (!read) {
    body = h('p', { style: styles.muted }, 'Reading the calendars.');
  } else if (rows.length === 0) {
    const lines = [read.status ? '' : nothingYet, read.entries.length === 0 && !read.entriesUnreadable ? noCalendarsLine : ''];
    body = lines.filter(Boolean).map(text => h('p', { key: text, style: styles.muted }, text));
  } else {
    const updated = updatedText(read.status, now);
    body = [
      updated ? h('p', { key: 'updated', style: styles.muted }, updated) : null,
      h('div', { key: 'panes', style: styles.panes }, leftSide(rows, chosen, select), rightSide(detailOf(chosen, read.status, now))),
      read.status ? h('p', { key: 'public', style: styles.muted }, publicLine) : null,
    ];
  }

  return h(
    'div',
    { style: styles.page },
    h('div', { style: styles.column }, h('h1', { style: styles.heading }, 'Calendars'), h('p', { style: styles.help }, helpLine), notes, body)
  );
}

export function CalendarsView() {
  const client = useClient({ apiVersion: apiVersion });
  const [read, setRead] = useState(null);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    let stopped = false;

    readCalendars(client).then(result => {
      if (!stopped) setRead(result);
    });

    return () => {
      stopped = true;
    };
  }, []);

  return calendarsPage(read, selected, setSelected, new Date());
}
