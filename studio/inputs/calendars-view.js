// The Calendars page, under Events in the sidebar (structure.js). It is a page of its own, not a
// document. It lists the coming events that the Teletraan computer downloaded from BAND, read live
// from the document calendar-status (schemas/calendarStatus.js, computer/scripts/calendar-status.mjs):
// grouped by day, each with its state on the TV and a Show and Hide switch.
//
// The switch works on one event. Hiding makes a draft Calendar filter of scope one (schemas/
// calendarFilter.js) that matches the event by its calendar, title and start, and showing it again
// withdraws it. A draft reaches the TV when the editor clicks Publish all, so the page says so.
// Rules typed under Calendar filters still apply and are listed at the bottom in plain sentences.
// The calendar links are secrets and are kept on the control page, not here.
//
// The words, the rows, the states and the rules are in calendars-list-parts.js, so that node can test
// them. This file is written without JSX: h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { Link } from 'sanity/router';
import { calendarStatusId } from './calendars-view-parts.js';
import {
  words,
  dayIn,
  eventRows,
  groupByDay,
  stateOf,
  planSwitch,
  applySwitch,
  groupsAfter,
  readRuleGroups,
  filterRows,
  downloadLine,
  calendarLines,
  emptyNotice,
  rulesList,
  failureText,
} from './calendars-list-parts.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// The id of Dashboard Settings, the same as settingsId in structure.js
const settingsId = 'dashboardSettings';

// The list of Calendar filters in the sidebar is the list of the type calendarFilter
const filtersPath = '/structure/calendarFilter';

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const critical = 'var(--card-badge-critical-fg-color, #b91c1c)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 16px' },
  column: { maxWidth: 1000, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  help: { lineHeight: 1.5, margin: '0 0 8px' },
  muted: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '0 0 12px' },
  notice: { fontSize: 14, lineHeight: 1.4, margin: '0 0 12px', padding: '8px 12px', border: border, borderRadius: 4, background: primaryBackground, color: primaryText },
  problem: { color: critical, fontSize: 14, margin: '0 0 8px' },
  failure: { color: critical, margin: '8px 0 0', padding: '8px 0', fontSize: 14, position: 'sticky', bottom: 0, background: 'var(--card-bg-color, Canvas)', borderTop: border },
  status: { margin: '0 0 12px', padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 14 },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '0 0 16px' },
  field: { boxSizing: 'border-box', minHeight: 44, fontFamily: 'inherit', fontSize: 14, padding: '4px 12px', color: 'inherit', background: 'transparent', border: border, borderRadius: 4 },
  check: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 14 },
  day: { fontSize: 18, fontWeight: 600, margin: '16px 0 4px' },
  list: { margin: 0, padding: 0, listStyle: 'none' },
  badge: { display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4 },
  shown: { background: 'var(--card-badge-positive-bg-color, #dcfce7)', color: 'var(--card-badge-positive-fg-color, #166534)' },
  hidden: { background: 'var(--card-badge-caution-bg-color, #fef3c7)', color: 'var(--card-badge-caution-fg-color, #92400e)' },
  kind: { display: 'inline-block', fontSize: 12, padding: '1px 8px', border: border, borderRadius: 10, marginLeft: 8 },
  switchOn: { background: primaryText, borderColor: primaryText },
  button: { boxSizing: 'border-box', minHeight: 44, fontFamily: 'inherit', fontSize: 14, padding: '4px 12px', color: 'inherit', background: 'transparent', border: border, borderRadius: 4, cursor: 'pointer' },
  summary: { fontSize: 18, fontWeight: 600, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' },
};

// A row is a grid on a wide window and a card under 600 pixels. The rules cannot be written inline.
const css = [
  '.cal-row { display: grid; grid-template-columns: 96px minmax(0, 1fr) minmax(0, 220px) 64px; gap: 4px 12px; align-items: center; padding: 8px 0; border-top: ' + border + '; font-size: 14px; overflow-wrap: anywhere; }',
  '.cal-row-earlier { opacity: 0.5; }',
  '.cal-title { font-size: 16px; font-weight: 600; }',
  '.cal-sub { color: ' + muted + '; font-size: 13px; }',
  '.cal-switch { box-sizing: border-box; width: 56px; height: 44px; padding: 0; border: ' + border + '; border-radius: 22px; background: transparent; cursor: pointer; position: relative; }',
  '.cal-switch[disabled] { opacity: 0.4; cursor: default; }',
  '.cal-switch span { position: absolute; top: 9px; left: 9px; width: 24px; height: 24px; border-radius: 12px; background: currentColor; }',
  '.cal-switch[aria-checked="true"] span { left: 23px; background: #fff; }',
  '@media (max-width: 600px) {',
  '  .cal-row { display: block; margin: 8px 0; padding: 12px; border: ' + border + '; border-radius: 6px; }',
  '  .cal-row > * { display: block; margin: 0 0 6px; }',
  '  .cal-switch { display: block; margin: 8px 0 0; }',
  '}',
].join('\n');

// The Dashboard Settings calendars and the document of the computer, published. This never fails: a
// document that cannot be read is reported as unreadable, and the page says so.
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

// The time zone of the screen, from the Look page, or nothing
export async function readZone(client) {
  try {
    const zone = await client.fetch('*[_id == "theme"][0].timeZone', {}, { perspective: 'published' });
    return typeof zone === 'string' ? zone : '';
  } catch (error) {
    return '';
  }
}

function stateBadge(state) {
  return h('span', { style: Object.assign({}, styles.badge, state.id === 'shown' ? styles.shown : styles.hidden) }, state.text);
}

function eventItem(row, state, actions) {
  const reasons = [state.reason, state.note, state.pending ? words.applyNote : ''].filter(Boolean);
  const switchOff = !state.canSwitch || actions.busy || actions.groups === null;
  const label = (state.on ? 'Hide ' : 'Show ') + row.title;

  return h(
    'li',
    { key: row.key, className: 'cal-row' + (state.id === 'earlier' ? ' cal-row-earlier' : ''), 'data-state': state.id },
    h('span', null, row.time),
    h(
      'span',
      null,
      h('span', { className: 'cal-title' }, row.title),
      row.location ? h('span', { className: 'cal-sub', style: { display: 'block' } }, row.location) : null,
      h('span', { className: 'cal-sub', style: { display: 'block' } }, row.calendarName, row.kind ? h('span', { style: styles.kind }, row.kind) : null)
    ),
    h(
      'span',
      null,
      stateBadge(state),
      state.id === 'hidden-you' && !switchOff ? h('button', { type: 'button', style: Object.assign({}, styles.button, { marginLeft: 8 }), onClick: () => actions.toggle(row) }, words.undo) : null,
      reasons.map(text => h('span', { key: text, className: 'cal-sub', style: { display: 'block' } }, text))
    ),
    h('button', { type: 'button', role: 'switch', 'aria-checked': state.on, 'aria-label': label, className: 'cal-switch', style: state.on ? styles.switchOn : undefined, disabled: switchOff, onClick: () => actions.toggle(row) }, h('span'))
  );
}

function toolbar(model, actions, rows) {
  const calendars = rows.reduce((list, row) => (list.some(item => item.code === row.code) ? list : list.concat([{ code: row.code, name: row.calendarName }])), []);
  return h(
    'div',
    { style: styles.toolbar, 'data-block': 'filters' },
    h(
      'select',
      { style: styles.field, value: model.filters.calendar, 'aria-label': 'Calendar', onChange: event => actions.setFilter({ calendar: event.target.value }) },
      h('option', { value: '' }, 'All calendars'),
      calendars.map(item => h('option', { key: item.code, value: item.code }, item.name))
    ),
    h('input', { type: 'search', style: styles.field, value: model.filters.search, placeholder: 'Search', 'aria-label': 'Search the events', onChange: event => actions.setFilter({ search: event.target.value }) }),
    h('label', { style: styles.check }, h('input', { type: 'checkbox', checked: model.filters.hiddenOnly, onChange: event => actions.setFilter({ hiddenOnly: event.target.checked }) }), 'Hidden only')
  );
}

function rulesSection(model) {
  if (model.groups === null) return h('p', { style: styles.problem }, words.rulesUnreadable);

  const rules = rulesList(model.groups, model.now);
  return h(
    'details',
    { style: { margin: '24px 0 0' }, 'data-block': 'rules' },
    h('summary', { style: styles.summary }, 'Rules (' + rules.length + ')'),
    rules.length === 0 ? h('p', { style: styles.muted }, 'No rules. Add one under Calendar filters to hide or keep events.') : null,
    h('ul', { style: styles.list }, rules.map(rule => h('li', { key: rule.name, style: { padding: '6px 0', fontSize: 14 } }, h('strong', null, rule.name + '. '), rule.text))),
    h(Link, { href: filtersPath, style: Object.assign({}, styles.button, { display: 'inline-flex', alignItems: 'center', textDecoration: 'none', marginTop: 8 }) }, 'Open Calendar filters')
  );
}

// What the page shows. model is
//   read      what readCalendars gives, with zone, or null while it is being read
//   groups    the rules of ruleGroups, or null when they cannot be read
//   now       the time
//   filters   { calendar, search, hiddenOnly }
//   busy      true while a change is being saved
//   problem   the red line, or empty
// actions has toggle(row), setFilter(change) and busy and groups for the rows.
export function calendarsPage(model, actions) {
  const read = model.read;
  const header = [h('h1', { key: 'h', style: styles.heading }, 'Calendars'), h('p', { key: 'help', style: styles.help }, words.help), h('p', { key: 'links', style: styles.muted }, words.linksNote)];
  let body = [];

  if (!read) {
    body = [h('p', { key: 'wait', style: styles.muted }, 'Reading the calendars.')];
  } else {
    const rows = eventRows(read.status, read.entries, model.now, read.zone);
    const states = {};
    rows.forEach(row => {
      states[row.key] = stateOf(row, model.groups, model.now);
    });
    const shownRows = filterRows(rows, states, model.filters);
    const notice = emptyNotice(read.status);
    const lines = calendarLines(read.status, read.entries, model.now);
    const download = downloadLine(read.status, model.now);
    const pending = rows.filter(row => states[row.key].pending).length;
    const problems = [read.entriesUnreadable ? 'Dashboard Settings could not be read, so the calendar names are missing.' : '', read.statusUnreadable ? 'The list of events could not be read.' : ''].filter(Boolean);
    const today = dayIn(model.now, read.zone);

    body = [].concat(
      problems.map(text => h('p', { key: text, style: styles.problem }, text)),
      notice ? [h('p', { key: 'notice', style: styles.notice }, notice)] : [],
      download ? [h('p', { key: 'download', style: styles.muted }, download)] : [],
      lines.length > 0 ? [h('ul', { key: 'status', style: styles.status, 'data-block': 'status' }, lines.map(line => h('li', { key: line.code, style: line.failed ? { color: critical } : undefined }, h('strong', null, line.name + ': '), line.text)))] : [],
      pending > 0 ? [h('p', { key: 'pending', style: styles.notice }, pending + (pending === 1 ? ' change is waiting. ' : ' changes are waiting. ') + words.applyNote)] : [],
      rows.length > 0 ? [toolbar(model, actions, rows)] : [],
      rows.length === 0 && !notice ? [h('p', { key: 'none', style: styles.muted }, words.noEvents)] : [],
      rows.length > 0 && shownRows.length === 0 ? [h('p', { key: 'nomatch', style: styles.muted }, words.noMatch)] : [],
      groupByDay(shownRows, today).map(group => h('section', { key: group.day || 'unknown', 'data-day': group.day }, h('h2', { style: styles.day }, group.label), h('ul', { style: styles.list }, group.rows.map(row => eventItem(row, states[row.key], actions))))),
      model.groups !== null || rows.length > 0 ? [rulesSection(model)] : [],
      read.status ? [h('p', { key: 'public', style: Object.assign({}, styles.muted, { marginTop: 16 }) }, words.publicNote)] : [],
      model.problem ? [h('p', { key: 'failure', style: styles.failure }, model.problem)] : []
    );
  }

  return h('div', { style: styles.page }, h('style', { dangerouslySetInnerHTML: { __html: css } }), h('div', { style: styles.column }, header, body));
}

export function CalendarsView() {
  const client = useClient({ apiVersion: apiVersion });
  const [read, setRead] = useState(null);
  const [groups, setGroups] = useState([]);
  const [filters, setFilters] = useState({ calendar: '', search: '', hiddenOnly: false });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let stopped = false;

    Promise.all([readCalendars(client), readZone(client)]).then(found => {
      if (!stopped) setRead(Object.assign({}, found[0], { zone: found[1] }));
    });
    readRuleGroups(client).then(found => {
      if (!stopped) setGroups(found);
    });

    return () => {
      stopped = true;
    };
  }, []);

  // One change at a time. When it works the page keeps the new rules. When it fails the page keeps the
  // old ones and says why.
  async function toggle(row) {
    if (busy || groups === null) return;

    setBusy(true);
    setProblem('');
    try {
      const plan = planSwitch(row, groups, new Date());
      await applySwitch(client, plan, groups);
      setGroups(groupsAfter(groups, plan));
    } catch (error) {
      setProblem(failureText(error));
    }
    setBusy(false);
  }

  const actions = {
    busy: busy,
    groups: groups,
    toggle: toggle,
    setFilter: change => setFilters(state => Object.assign({}, state, change)),
  };
  return calendarsPage({ read: read, groups: groups, now: new Date(), filters: filters, busy: busy, problem: problem }, actions);
}
