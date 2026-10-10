// The connection block at the top of the Monday tab of Dashboard Settings
// (schemas/settingsMonday.js). It reads the document monday-status, which the Mini writes
// with deploy/scripts/monday-sync.sh, and says who the token belongs to, when the Mini
// last read Monday, how many boards it can see, and what went wrong last. The field
// stores nothing: this input never changes the value.
//
// If the document is missing it says No connection yet and what to do, and if it
// cannot be read it says so. Neither stops the form from opening.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { ageText, clockText } from './time-text.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// The id the Mini writes to. deploy/scripts/monday-sync.sh has the same one.
export const mondayStatusId = 'monday-status';

// Only what the block shows, so the question stays small
const question = '*[_id == $id][0] { connectedAs, lastSyncAt, lastError, "boards": count(boards) }';

const styles = {
  note: { margin: 0, fontSize: 14, color: 'var(--card-muted-fg-color, inherit)' },
  line: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '0 0 4px', fontSize: 14 },
  label: { minWidth: 220, fontWeight: 600 },
};

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// 1 board, 3 boards, or None
function boardsText(count) {
  if (typeof count !== 'number' || count < 1) return 'None';
  return count + (count === 1 ? ' board' : ' boards');
}

// The lines for a status document: a label and the words after it. A document
// with no time says Not yet.
export function describeMondayStatus(doc, now) {
  const source = isRecord(doc) ? doc : {};
  const age = ageText(source.lastSyncAt, now);
  const clock = clockText(source.lastSyncAt);

  return [
    { label: 'Connected as', text: typeof source.connectedAs === 'string' && source.connectedAs !== '' ? source.connectedAs : 'Not known' },
    { label: 'Last sync', text: age && clock ? age + ' (' + clock + ')' : 'Not yet' },
    { label: 'Boards the token can see', text: boardsText(source.boards) },
    { label: 'Last error', text: typeof source.lastError === 'string' && source.lastError !== '' ? source.lastError : 'None' },
  ];
}

// The published document. This never fails: a document that cannot be read is
// reported as unreadable, and the input says so.
export async function readMondayStatus(client) {
  try {
    const found = await client.fetch(question, { id: mondayStatusId }, { perspective: 'published' });
    return { doc: isRecord(found) ? found : null, unreadable: false };
  } catch (error) {
    return { doc: null, unreadable: true };
  }
}

// What the block shows for what was read: null while it is being read, then
// { doc, unreadable }. now is the time to count the ages from.
export function mondayStatusView(read, now) {
  if (!read) return h('p', { style: styles.note }, 'Reading the connection to Monday.');
  if (read.unreadable) return h('p', { style: styles.note }, 'The connection to Monday could not be read.');
  if (!read.doc) return h('p', { style: styles.note }, 'No connection yet. Add MONDAY_API_TOKEN to local.env on the Mini, then wait 10 minutes.');

  return h(
    'div',
    null,
    describeMondayStatus(read.doc, now).map(line =>
      h('p', { key: line.label, style: styles.line }, h('span', { style: styles.label }, line.label), h('span', null, line.text))
    )
  );
}

export function MondayStatusInput() {
  const client = useClient({ apiVersion: apiVersion });
  const [read, setRead] = useState(null);

  useEffect(() => {
    let stopped = false;

    readMondayStatus(client).then(result => {
      if (!stopped) setRead(result);
    });

    return () => {
      stopped = true;
    };
  }, []);

  return mondayStatusView(read, new Date());
}
