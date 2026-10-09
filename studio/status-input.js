// The Status of the Mini block at the top of the Screen tab of Dashboard
// Settings (schemas/settingsStatus.js). It reads the document status-mini,
// which the Mini writes with deploy/scripts/status-write.sh, and shows what the
// Mini last did in plain words. The field stores nothing: this input never
// changes the value.
//
// If the document is missing it says No status yet, and if it cannot be read it
// says so. Neither stops the form from opening.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// The id the Mini writes to. deploy/scripts/status-write.sh has the same one.
export const statusId = 'status-mini';

// The lines in the order they are shown: the field of the document, and the words before its time
export const statusLines = [
  { field: 'lastContentSeenAt', label: 'Last content update seen' },
  { field: 'lastCalendarSyncAt', label: 'Last calendar sync' },
  { field: 'lastSlidesFetchAt', label: 'Last slides fetch' },
  { field: 'lastMondaySyncAt', label: 'Last Monday sync' },
  { field: 'lastFrcSyncAt', label: 'Last FRC data sync' },
  { field: 'kioskStartedAt', label: 'Screen started' },
];

const styles = {
  note: { margin: 0, fontSize: 14, color: 'var(--card-muted-fg-color, inherit)' },
  line: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '0 0 4px', fontSize: 14 },
  label: { minWidth: 220, fontWeight: 600 },
};

// How long ago a time was, in words. A time that cannot be read gives nothing.
export function ageText(isoText, now) {
  const then = typeof isoText === 'string' ? Date.parse(isoText) : NaN;
  if (isNaN(then)) return '';

  const minutes = Math.round((now.getTime() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');

  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  return Math.round(hours / 24) + ' days ago';
}

// The time as the editor's own computer shows it, such as Oct 9, 2026, 2:14 PM
function clockText(isoText) {
  const date = new Date(isoText);
  if (typeof isoText !== 'string' || isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

// The lines for a status document: a label and the words after it. A time the
// Mini has not written yet says Not yet.
export function describeStatus(doc, now) {
  const source = doc && typeof doc === 'object' ? doc : {};

  return statusLines.map(line => {
    const age = ageText(source[line.field], now);
    const clock = clockText(source[line.field]);
    return { label: line.label, text: age && clock ? age + ' (' + clock + ')' : 'Not yet' };
  });
}

// The published status document. This never fails: a document that cannot be
// read is reported as unreadable, and the input says so.
export async function readStatus(client) {
  try {
    const found = await client.fetch('*[_id == $id][0]', { id: statusId }, { perspective: 'published' });
    return { doc: found && typeof found === 'object' ? found : null, unreadable: false };
  } catch (error) {
    return { doc: null, unreadable: true };
  }
}

// What the block shows for what was read: null while it is being read, then
// { doc, unreadable }. now is the time to count the ages from.
export function statusView(read, now) {
  if (!read) return h('p', { style: styles.note }, 'Reading the status of the Mini.');
  if (read.unreadable) return h('p', { style: styles.note }, 'The status of the Mini could not be read.');
  if (!read.doc) return h('p', { style: styles.note }, 'No status yet. The Mini writes it after its first job, once it has a write token.');

  return h(
    'div',
    null,
    describeStatus(read.doc, now).map(line =>
      h('p', { key: line.label, style: styles.line }, h('span', { style: styles.label }, line.label), h('span', null, line.text))
    )
  );
}

export function StatusInput() {
  const client = useClient({ apiVersion: apiVersion });
  const [read, setRead] = useState(null);

  useEffect(() => {
    let stopped = false;

    readStatus(client).then(result => {
      if (!stopped) setRead(result);
    });

    return () => {
      stopped = true;
    };
  }, []);

  return statusView(read, new Date());
}
