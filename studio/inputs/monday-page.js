// The Monday page, one line of the sidebar. It is read only: one line about the last read of the Teletraan computer, then a
// small table for each of the nine departments with the five columns of the Department tasks panel, the open and done
// counts, and a link to the Rotation board, where a department is put on the TV. A link to the control page is the only
// way to the buttons of the Teletraan computer (Sync Monday now, Check the token, Monday debug).
//
// The words, the question and the rules are in monday-page-parts.js, so node can test them.
//
// It is written without JSX, so it reads as plain JavaScript: h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { Link } from 'sanity/router';
import { controlLink, countLine, departmentTables, lastReadLine, mondayStatusId, question, rotationPath, words } from './monday-page-parts.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const critical = 'var(--card-badge-critical-fg-color, #b91c1c)';
const good = 'var(--card-badge-positive-fg-color, #15803d)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 16px' },
  column: { maxWidth: 960, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  text: { lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  good: { color: good, fontWeight: 600, lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  failed: { color: critical, fontWeight: 600, lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  muted: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '0 0 8px', overflowWrap: 'anywhere' },
  section: { margin: '0 0 24px', padding: '12px', border: border, borderRadius: 4 },
  title: { fontSize: 18, fontWeight: 600, margin: '0 0 4px' },
  wrap: { overflowX: 'auto', maxWidth: '100%' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 14 },
  cell: { textAlign: 'left', padding: '6px 8px', borderTop: border, verticalAlign: 'top', overflowWrap: 'anywhere' },
  head: { textAlign: 'left', padding: '6px 8px', fontWeight: 600 },
  link: { display: 'inline-block', minHeight: 44, lineHeight: '44px' },
};

function tableOf(table) {
  if (table.rows.length === 0) return h('p', { style: styles.muted }, words.none);

  const head = h('tr', null, words.columns.map(name => h('th', { key: name, style: styles.head, scope: 'col' }, name)));
  const rows = table.rows.map((row, at) => h('tr', { key: at },
    h('td', { style: styles.cell }, row.status),
    h('td', { style: styles.cell }, row.project + (row.team ? ' (' + row.team + ')' : '')),
    h('td', { style: styles.cell }, row.contact),
    h('td', { style: styles.cell }, row.priority),
    h('td', { style: styles.cell }, row.date)));
  return h('div', { style: styles.wrap }, h('table', { style: styles.table }, h('thead', null, head), h('tbody', null, rows)));
}

function departmentBlock(table) {
  return h('section', { key: table.value, style: styles.section, 'data-department': table.value },
    h('h2', { style: styles.title }, table.title),
    h('p', { style: styles.muted }, countLine(table)),
    tableOf(table),
    h('p', { style: { margin: '8px 0 0' } }, h(Link, { href: rotationPath, style: styles.link }, words.rotation)));
}

export function MondayPage() {
  const client = useClient({ apiVersion: apiVersion });
  const [state, setState] = useState({ loading: true, failed: false, status: null, tasks: [] });

  useEffect(() => {
    let live = true;
    client.fetch(question, { statusId: mondayStatusId }, { perspective: 'published' })
      .then(found => { if (live) setState({ loading: false, failed: false, status: found ? found.status : null, tasks: found && Array.isArray(found.tasks) ? found.tasks : [] }); })
      .catch(() => { if (live) setState({ loading: false, failed: true, status: null, tasks: [] }); });
    return () => { live = false; };
  }, [client]);

  const now = new Date();
  const read = lastReadLine(state.status, now);
  const body = state.loading
    ? [h('p', { key: 'reading', style: styles.text }, words.reading)]
    : state.failed
      ? [h('p', { key: 'failed', style: styles.failed }, words.unreadable)]
      : [h('p', { key: 'read', style: read.ok ? styles.good : styles.failed, 'data-read': read.ok ? 'ok' : 'problem' }, read.text)]
        .concat(departmentTables(state.tasks, now).map(departmentBlock));

  return h('div', { style: styles.page },
    h('div', { style: styles.column },
      h('h1', { style: styles.heading }, words.title),
      h('p', { style: styles.text }, words.intro),
      h('p', { style: styles.text }, h('a', { href: controlLink, target: '_blank', rel: 'noreferrer', style: styles.link }, words.control)),
      ...body));
}
