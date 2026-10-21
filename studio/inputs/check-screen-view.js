// The Check the screen page, in COACHES ONLY in the sidebar. It is a page of its own, not a document, and it is read only: it
// asks Sanity for the content (drafts too), runs the checks of tools/content-check.js and lists what it finds, grouped by
// area, each with a link to the document, the level and a plain fix. It never writes.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useRef, useState } from 'react';
import { useClient } from 'sanity';
import { IntentLink } from 'sanity/router';
import { styles } from './page-styles.js';
import { checkAnswer, cleanupLine, contentQuestion, reportOf, summaryLine } from '../tools/content-check.js';
import { countWords, keyOf, levelWords, stateWords, words } from './check-screen-parts.js';

const h = createElement;

const apiVersion = '2025-02-19';

const critical = 'var(--card-badge-critical-fg-color, #b91c1c)';
const caution = 'var(--card-badge-caution-fg-color, #92400e)';

const own = {
  item: Object.assign({ listStyle: 'none' }, styles.card, { margin: '0 0 12px' }),
  top: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', margin: '0 0 8px' },
  title: { fontWeight: 600, overflowWrap: 'anywhere', flex: '1 1 200px' },
  problem: { fontWeight: 700, color: critical },
  warning: { fontWeight: 700, color: caution },
  line: { lineHeight: 1.5, margin: '0 0 8px', overflowWrap: 'anywhere' },
  list: { margin: '0 0 16px', padding: 0 },
};

// Asks for the content and checks it. Gives back the report, or null when the content could not be read.
export async function readReport(client, now = new Date()) {
  try {
    const answer = await client.fetch(contentQuestion, {}, { perspective: 'raw' });
    return Object.assign(reportOf(checkAnswer(answer, now)), { cleanup: cleanupLine(answer) });
  } catch (error) {
    return null;
  }
}

function itemCard(item, index) {
  return h(
    'li',
    { key: keyOf(item, index), style: own.item, 'data-level': item.level },
    h(
      'div',
      { style: own.top },
      h('span', { style: item.level === 'problem' ? own.problem : own.warning }, levelWords(item.level)),
      h('span', { style: own.title }, item.doc.title),
      h('span', { style: styles.help }, stateWords(item.doc.state))
    ),
    h('p', { style: own.line }, item.message),
    h('p', { style: own.line }, h('strong', null, words.fix + ' '), item.fix),
    h(IntentLink, { intent: 'edit', params: { id: item.doc.id, type: item.doc.type }, style: styles.link, 'aria-label': words.open + ' ' + item.doc.title }, words.open)
  );
}

function groupBlock(group) {
  return h(
    'div',
    { key: group.area, 'data-block': group.area },
    h('h2', { style: styles.subheading }, group.area),
    h('p', { style: styles.muted }, countWords(group)),
    h('ul', { style: own.list }, group.items.map(itemCard))
  );
}

export function pageOf(state, check) {
  let body = null;
  if (state.busy) body = h('p', { style: styles.muted, 'aria-live': 'polite' }, words.reading);
  else if (state.failed) body = h('p', { style: styles.failed, role: 'alert' }, words.failed);
  else if (state.report) {
    body = [
      h('p', { key: 'summary', style: state.report.problems > 0 ? styles.failed : styles.text, 'data-line': 'summary', 'aria-live': 'polite' }, summaryLine(state.report)),
      h('p', { key: 'legend', style: styles.muted }, words.legend),
      state.report.cleanup ? h('p', { key: 'cleanup', style: styles.muted, 'data-line': 'cleanup' }, state.report.cleanup) : null,
      state.report.groups.map(groupBlock),
    ];
  }

  return h(
    'div',
    { style: styles.page },
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, words.title),
      h('p', { style: styles.text }, words.intro),
      h('p', { style: styles.muted }, words.drafts),
      h('button', { type: 'button', disabled: state.busy, style: styles.button, onClick: check }, words.button),
      body
    )
  );
}

export function CheckScreenView() {
  const client = useClient({ apiVersion: apiVersion });
  const [state, setState] = useState({ busy: true, failed: false, report: null });
  const running = useRef(0);

  function check() {
    const turn = ++running.current;
    setState({ busy: true, failed: false, report: null });
    readReport(client).then(report => {
      if (turn === running.current) setState({ busy: false, failed: report === null, report: report });
    });
  }

  useEffect(() => {
    check();
    return () => {
      running.current += 1;
    };
  }, []);

  return pageOf(state, check);
}
