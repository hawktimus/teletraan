// The Monday page, one line of the sidebar. It is read only. It answers one question: for a team, what is to do and what is
// done in each of the nine departments. From the top: one line about the last read of the Teletraan computer, a Team picker,
// a tile for each department with its counts, a table of the to do and in progress tasks and a table of the done tasks for
// each department (the five columns of the TV), and "What the TV shows", the first page of one Department tasks row.
//
// The words and the rules are in monday-page-parts.js, so node can test them. The rows come from the dashboard's own code.
//
// It is written without JSX, so it reads as plain JavaScript: h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { Link } from 'sanity/router';
import {
  contentOf, controlLink, countLine, departmentTables, departments, generalCount, hiddenCount, lastReadLine, listChoices,
  mondayStatusId, question, rotationPath, teamChoices, tvPreview, words,
} from './monday-page-parts.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const critical = 'var(--card-badge-critical-fg-color, #b91c1c)';
const good = 'var(--card-badge-positive-fg-color, #15803d)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 16px' },
  column: { maxWidth: 960, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  subheading: { fontSize: 18, fontWeight: 600, margin: '32px 0 8px' },
  text: { lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  good: { color: good, fontWeight: 600, lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  failed: { color: critical, fontWeight: 600, lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  muted: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '0 0 8px', overflowWrap: 'anywhere' },
  teams: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 8px' },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, margin: '16px 0 24px' },
  section: { margin: '0 0 16px', border: border, borderRadius: 4 },
  summary: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 16px', minHeight: 44, padding: '4px 12px', cursor: 'pointer' },
  sectionBody: { padding: '0 12px 12px' },
  empty: { margin: '0 0 16px', padding: '4px 12px', minHeight: 44, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 16px', border: border, borderRadius: 4, opacity: 0.55 },
  title: { fontSize: 18, fontWeight: 600 },
  count: { fontSize: 14, fontWeight: 400, color: muted },
  listTitle: { fontSize: 16, fontWeight: 600, margin: '12px 0 4px' },
  field: { margin: '0 0 16px', minWidth: 0 },
  label: { display: 'block', fontWeight: 600, margin: '0 0 4px' },
  select: { boxSizing: 'border-box', minHeight: 44, maxWidth: '100%', padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: border, borderRadius: 4 },
  picks: { display: 'flex', flexWrap: 'wrap', gap: '0 16px' },
  link: { display: 'inline-flex', alignItems: 'center', minHeight: 44, textDecoration: 'underline', color: primaryText },
  preview: { padding: 12, border: border, borderRadius: 4, margin: '0 0 16px' },
  previewTitle: { fontSize: 18, fontWeight: 600, margin: '0 0 8px', overflowWrap: 'anywhere' },
};

function teamButton(choice, picked, pick) {
  const on = choice.value === picked;
  return h('button', {
    key: choice.value || 'both', type: 'button', 'aria-pressed': on, onClick: () => pick(choice.value),
    style: {
      boxSizing: 'border-box', minWidth: 88, minHeight: 44, padding: '8px 16px', fontFamily: 'inherit', fontSize: 16, fontWeight: 600,
      border: border, borderRadius: 4, cursor: 'pointer', background: on ? primaryBackground : 'transparent', color: on ? primaryText : 'inherit',
    },
  }, choice.title);
}

function pickerOf(label, choices, value, change) {
  return h('label', { style: styles.field },
    h('span', { style: styles.label }, label),
    h('select', { value: value, onChange: event => change(event.target.value), style: styles.select },
      choices.map(choice => h('option', { key: choice.value, value: choice.value }, choice.title))));
}

function cell(label, text) {
  return h('td', { 'data-label': label }, text);
}

// A table of the five columns of the TV. On a phone each row is a card (styleSheet below).
function tableOf(rows, more) {
  if (rows.length === 0) return h('p', { style: styles.muted }, words.emptyList);

  const head = h('tr', null, words.columns.map(name => h('th', { key: name, scope: 'col' }, name)));
  const body = rows.map((row, at) => h('tr', { key: at },
    cell(words.columns[0], row.statusWord),
    cell(words.columns[1], row.project),
    cell(words.columns[2], row.contact),
    cell(words.columns[3], row.priority),
    cell(words.columns[4], row.date)));
  return h('div', null,
    h('table', { className: 'monday-table' }, h('thead', null, head), h('tbody', null, body)),
    more > 0 ? h('p', { style: styles.muted }, '+' + more + ' more in Monday') : null);
}

// The page has to work on a phone, so a table becomes a stack of cards under 640 pixels. Inline styles cannot say that.
const styleSheet = `
.monday-table { border-collapse: collapse; width: 100%; font-size: 14px; table-layout: fixed; }
.monday-table th:nth-child(1) { width: 14%; }
.monday-table th:nth-child(2) { width: 34%; }
.monday-table th:nth-child(3) { width: 14%; }
.monday-table th:nth-child(4) { width: 14%; }
.monday-table td, .monday-table th { padding: 6px 8px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
.monday-table th { font-weight: 600; }
.monday-table td { border-top: 1px solid var(--card-border-color, rgba(128, 128, 128, 0.4)); }
@media (max-width: 640px) {
  .monday-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .monday-table, .monday-table tbody { display: block; width: 100%; }
  .monday-table tr { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; margin: 0 0 8px; padding: 4px 0; border: 1px solid var(--card-border-color, rgba(128, 128, 128, 0.4)); border-radius: 4px; }
  .monday-table td { display: block; min-width: 0; border-top: none; padding: 2px 8px; }
  .monday-table td::before { content: attr(data-label) ': '; color: var(--card-muted-fg-color, inherit); }
  .monday-table td:nth-child(2) { grid-column: 1 / -1; order: -1; font-weight: 600; font-size: 16px; }
  .monday-table td:nth-child(2)::before { content: none; }
}
`;

function tileOf(table) {
  const style = Object.assign(
    { boxSizing: 'border-box', minHeight: 44, padding: '8px 12px', textAlign: 'left', fontFamily: 'inherit', fontSize: 16, border: border, borderRadius: 4, background: 'transparent', color: 'inherit', cursor: table.empty ? 'default' : 'pointer' },
    table.empty ? { opacity: 0.55 } : {});
  return h('button', {
    key: table.value, type: 'button', style: style, disabled: table.empty, 'data-tile': table.value,
    onClick: () => {
      const section = document.getElementById('monday-' + table.value);
      if (section) {
        section.open = true;
        section.scrollIntoView({ block: 'start' });
      }
    },
  }, h('span', { style: { display: 'block', fontWeight: 600 } }, table.title), h('span', { style: styles.count }, table.empty ? 'No tasks' : countLine(table)));
}

function departmentBlock(table) {
  if (table.empty) {
    return h('div', { key: table.value, style: styles.empty, 'data-department': table.value, 'data-empty': 'yes' },
      h('span', { style: styles.title }, table.title), h('span', { style: styles.count }, words.emptyDepartment));
  }
  return h('details', { key: table.value, id: 'monday-' + table.value, open: true, style: styles.section, 'data-department': table.value },
    h('summary', { style: styles.summary }, h('span', { style: styles.title }, table.title), h('span', { style: styles.count }, countLine(table))),
    h('div', { style: styles.sectionBody },
      h('h3', { style: styles.listTitle }, words.openTitle + ' (' + table.open + ')'),
      tableOf(table.openRows, table.openMore),
      h('h3', { style: styles.listTitle }, words.doneTitle + ' (' + table.done + ')'),
      tableOf(table.doneRows, table.doneMore)));
}

// What a Department tasks row draws on its first page
function previewBlock(content, now, choice, change) {
  const view = tvPreview(content, now, choice);
  const shown = view === null
    ? h('p', { style: styles.muted, 'data-preview': 'skipped' }, words.previewSkipped)
    : h('div', { style: styles.preview, 'data-preview': 'shown' },
      h('p', { style: styles.previewTitle }, view.title + (view.team ? ' (' + view.team + ')' : '')),
      tableOf(view.rows, 0),
      h('p', { style: styles.muted }, 'Open ' + view.counts.open + ', done ' + view.counts.done +
        (view.pages > 1 ? '. The TV plays ' + view.pages + ' pages of four rows.' : '.') + (view.more > 0 ? ' +' + view.more + ' more in Monday.' : '')));
  return h('section', null,
    h('h2', { style: styles.subheading }, words.previewTitle),
    h('p', { style: styles.muted }, words.previewHelp),
    h('div', { style: styles.picks },
      pickerOf(words.departmentLabel, departments, choice.department, value => change({ department: value })),
      pickerOf(words.listLabel, listChoices, choice.list, value => change({ list: value })),
      pickerOf(words.previewTeamLabel, teamChoices, choice.team, value => change({ team: value }))),
    shown,
    h('p', { style: { margin: '8px 0 0' } }, h(Link, { href: rotationPath, style: styles.link }, words.rotation)));
}

export function MondayPage() {
  const client = useClient({ apiVersion: apiVersion });
  const [state, setState] = useState({ loading: true, failed: false, status: null, content: contentOf(null) });
  const [team, setTeam] = useState('');
  const [choice, setChoice] = useState({ department: departments[0].value, list: 'open', team: '' });

  useEffect(() => {
    let live = true;
    client.fetch(question, { statusId: mondayStatusId }, { perspective: 'published' })
      .then(found => { if (live) setState({ loading: false, failed: false, status: found ? found.status : null, content: contentOf(found) }); })
      .catch(() => { if (live) setState({ loading: false, failed: true, status: null, content: contentOf(null) }); });
    return () => { live = false; };
  }, [client]);

  const now = new Date();
  const read = lastReadLine(state.status, now);
  const tables = departmentTables(state.content, team, now);
  const hidden = hiddenCount(state.content, now);
  const general = generalCount(state.content, now);

  const body = state.loading
    ? [h('p', { key: 'reading', style: styles.text }, words.reading)]
    : state.failed
      ? [h('p', { key: 'failed', style: styles.failed }, words.unreadable)]
      : [
        h('p', { key: 'read', style: read.ok ? styles.good : styles.failed, 'data-read': read.ok ? 'ok' : 'problem' }, read.text),
        h('fieldset', { key: 'team', style: { border: 'none', padding: 0, margin: '0 0 8px', minWidth: 0 } },
          h('legend', { style: styles.label }, words.teamLabel),
          h('div', { style: styles.teams }, teamChoices.map(entry => teamButton(entry, team, setTeam)))),
        h('p', { key: 'help', style: styles.muted }, words.teamHelp + (general > 0 ? ' ' + general + ' of the tasks have no team.' : '') + (hidden > 0 ? ' ' + hidden + ' hidden from the TV.' : '')),
        h('div', { key: 'tiles', style: styles.tiles }, tables.map(tileOf)),
        h('div', { key: 'departments' }, tables.map(departmentBlock)),
        h('div', { key: 'preview' }, previewBlock(state.content, now, choice, change => setChoice(Object.assign({}, choice, change)))),
      ];

  return h('div', { style: styles.page },
    h('style', null, styleSheet),
    h('div', { style: styles.column },
      h('h1', { style: styles.heading }, words.title),
      h('p', { style: styles.text }, words.intro),
      ...body,
      h('p', { style: { margin: '24px 0 0' } }, h('a', { href: controlLink, target: '_blank', rel: 'noreferrer', style: styles.link }, words.control))));
}
