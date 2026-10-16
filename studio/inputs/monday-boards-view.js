// The Monday Boards page, under TASKS in the sidebar (structure.js). It is a page of its own, not a
// document. It lists every board the token of the Teletraan computer can see, with the number of items, when the
// computer last read it and whether Dashboard Settings has chosen it. The Teletraan computer writes what it shows into
// the document monday-status (schemas/mondayStatus.js, computer/scripts/monday-sync.sh).
//
// Nothing is edited here. Choose boards opens Dashboard Settings at the board rows, which are on the
// Monday tab. The name of a chosen board opens the tasks of that board, in the same two lists as
// Monday Tasks, On the TV and Hidden. structure.js gives the page the function that builds them.
//
// If the document is missing it says Nothing yet, and if it cannot be read it says so. Neither stops
// the page from opening.
//
// The words and the rows are in monday-boards-parts.js, so that tests/schemas.test.mjs can read them with
// node. It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { usePaneRouter } from 'sanity/structure';
import {
  helpLine,
  chooseLabel,
  chooseTarget,
  milestonesChild,
  milestonesLabel,
  milestonesLine,
  nothingYet,
  noBoardsLine,
  openLine,
  publicLine,
  unreadableLine,
  settingsUnreadableLine,
  readBoardsPage,
  rowsOf,
  chosenText,
  updatedText,
  errorText,
} from './monday-boards-parts.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// Plain styles. The colours are the Studio's own variables, so the page follows
// the Studio's light and dark themes, and each has a fallback.
const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const critical = 'var(--card-badge-critical-fg-color, #b91c1c)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 32px' },
  column: { maxWidth: 760, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  help: { lineHeight: 1.5, margin: '0 0 16px' },
  muted: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '0 0 16px' },
  note: { color: critical, fontSize: 14, margin: '0 0 8px' },
  button: {
    boxSizing: 'border-box',
    minHeight: 44,
    padding: '8px 16px',
    margin: '0 0 24px',
    fontFamily: 'inherit',
    fontSize: 16,
    fontWeight: 600,
    border: border,
    borderRadius: 4,
    background: primaryBackground,
    color: primaryText,
    cursor: 'pointer',
  },
  rows: { margin: '0 0 16px', padding: 0, listStyle: 'none' },
  row: { padding: '12px 0', borderTop: border },
  name: { display: 'block', fontSize: 16, fontWeight: 600 },
  line: { display: 'block', marginTop: 2, fontSize: 14, color: muted },
  problem: { display: 'block', marginTop: 2, fontSize: 14, color: critical },
};

// One board. The name is a link to the tasks of the board when the board is chosen and the token sees it.
function boardItem(row, ChildLink) {
  const name = row.opens && ChildLink ? h(ChildLink, { childId: row.id }, row.name) : row.name;

  return h(
    'li',
    { key: row.id, style: styles.row, 'data-board': row.id },
    h('span', { style: styles.name }, name),
    h('span', { style: styles.line }, [row.items, row.read, chosenText(row)].join(' · ')),
    row.note ? h('span', { style: styles.problem }, row.note) : null
  );
}

// What the page shows for what was read: null while it is being read, then what readBoardsPage gives.
// links is { ChildLink, choose }: the link to the tasks of a board, and what the button does.
export function boardsPage(read, now, links) {
  const rows = read ? rowsOf(read.status, read.entries, now) : [];
  const updated = read ? updatedText(read.status, now) : '';
  const error = read ? errorText(read.status) : '';

  let body;
  if (!read) {
    body = h('p', { style: styles.muted }, 'Reading the boards.');
  } else if (read.statusUnreadable) {
    body = h('p', { style: styles.note }, unreadableLine);
  } else if (!read.status) {
    body = h('p', { style: styles.muted }, nothingYet);
  } else {
    body = [
      read.entriesUnreadable ? h('p', { key: 'entries', style: styles.note }, settingsUnreadableLine) : null,
      updated ? h('p', { key: 'updated', style: styles.muted }, updated) : null,
      error ? h('p', { key: 'error', style: styles.note }, error) : null,
      rows.length === 0 ? h('p', { key: 'none', style: styles.muted }, noBoardsLine) : h('ul', { key: 'rows', style: styles.rows, 'data-list': 'boards' }, rows.map(row => boardItem(row, links.ChildLink))),
      rows.some(row => row.opens) ? h('p', { key: 'open', style: styles.muted }, openLine) : null,
      links.ChildLink ? h('p', { key: 'milestones', style: styles.muted }, h(links.ChildLink, { childId: milestonesChild }, milestonesLabel), ' · ' + milestonesLine) : null,
      h('p', { key: 'public', style: styles.muted }, publicLine),
    ];
  }

  return h(
    'div',
    { style: styles.page },
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, 'Monday Boards'),
      h('p', { style: styles.help }, helpLine),
      h('button', { type: 'button', style: styles.button, onClick: links.choose }, chooseLabel),
      body
    )
  );
}

export function MondayBoardsView() {
  const client = useClient({ apiVersion: apiVersion });
  const paneRouter = usePaneRouter();
  const [read, setRead] = useState(null);

  useEffect(() => {
    let stopped = false;

    readBoardsPage(client).then(result => {
      if (!stopped) setRead(result);
    });

    return () => {
      stopped = true;
    };
  }, []);

  return boardsPage(read, new Date(), {
    ChildLink: paneRouter.ChildLink,
    choose: () => paneRouter.navigateIntent('edit', chooseTarget),
  });
}
