// The connection block at the top of the Competition tab of Dashboard Settings
// (schemas/settingsCompetition.js). It reads the document frc-status, which the
// Mini writes with deploy/scripts/frc-sync.sh, and says when the Mini last read the
// competition data, how many events it found for each team, and what went wrong
// last. The field stores nothing: this input never changes the value.
//
// If the document is missing it says No connection yet and what to do, and if it
// cannot be read it says so. Neither stops the form from opening.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { ageText } from './status-input.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// The id the Mini writes to. deploy/scripts/frc-sync.sh has the same one.
export const frcStatusId = 'frc-status';

// Only what the block shows, so the question stays small
const question = '*[_id == $id][0] { lastSyncAt, lastError, notes, "teams": teams[] { team, number, "events": count(events) } }';

const styles = {
  note: { margin: 0, fontSize: 14, color: 'var(--card-muted-fg-color, inherit)' },
  line: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '0 0 4px', fontSize: 14 },
  label: { minWidth: 220, fontWeight: 600 },
};

// The time as the editor's own computer shows it, such as Oct 9, 2026, 2:14 PM
function clockText(isoText) {
  const date = new Date(isoText);
  if (typeof isoText !== 'string' || isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// 1 event, 3 events, or None
function eventsText(count) {
  if (typeof count !== 'number' || count < 1) return 'None';
  return count + (count === 1 ? ' event' : ' events');
}

// The lines for a status document: a label and the words after it. A document
// with no time says Not yet, and one with no teams says so.
export function describeFrcStatus(doc, now) {
  const source = isRecord(doc) ? doc : {};
  const age = ageText(source.lastSyncAt, now);
  const clock = clockText(source.lastSyncAt);
  const lines = [{ label: 'Last sync', text: age && clock ? age + ' (' + clock + ')' : 'Not yet' }];

  const teams = Array.isArray(source.teams) ? source.teams.filter(isRecord) : [];
  if (teams.length === 0) lines.push({ label: 'Events found', text: 'No team was read' });
  teams.forEach(team => {
    const name = [team.team, team.number].filter(part => part !== undefined && part !== null && part !== '').join(' ');
    lines.push({ label: 'Events found, ' + (name || 'team'), text: eventsText(team.events) });
  });

  const notes = Array.isArray(source.notes) ? source.notes.filter(note => typeof note === 'string' && note !== '') : [];
  if (notes.length > 0) lines.push({ label: 'Notes', text: notes.join(' ') });

  lines.push({ label: 'Last error', text: typeof source.lastError === 'string' && source.lastError !== '' ? source.lastError : 'None' });
  return lines;
}

// The published document. This never fails: a document that cannot be read is
// reported as unreadable, and the input says so.
export async function readFrcStatus(client) {
  try {
    const found = await client.fetch(question, { id: frcStatusId }, { perspective: 'published' });
    return { doc: isRecord(found) ? found : null, unreadable: false };
  } catch (error) {
    return { doc: null, unreadable: true };
  }
}

// What the block shows for what was read: null while it is being read, then
// { doc, unreadable }. now is the time to count the ages from.
export function frcStatusView(read, now) {
  if (!read) return h('p', { style: styles.note }, 'Reading the competition data.');
  if (read.unreadable) return h('p', { style: styles.note }, 'The competition data could not be read.');
  if (!read.doc) return h('p', { style: styles.note }, 'No connection yet. Add TBA_AUTH_KEY to local.env on the Mini, then wait up to an hour.');

  return h(
    'div',
    null,
    describeFrcStatus(read.doc, now).map(line =>
      h('p', { key: line.label, style: styles.line }, h('span', { style: styles.label }, line.label), h('span', null, line.text))
    )
  );
}

export function FrcStatusInput() {
  const client = useClient({ apiVersion: apiVersion });
  const [read, setRead] = useState(null);

  useEffect(() => {
    let stopped = false;

    readFrcStatus(client).then(result => {
      if (!stopped) setRead(result);
    });

    return () => {
      stopped = true;
    };
  }, []);

  return frcStatusView(read, new Date());
}
