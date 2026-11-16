// The "What the computer is fixing" block at the top of the supervisor section of Dashboard Settings
// (schemas/settingsSupervisor.js). It reads the document status-mini, which the Teletraan computer writes with
// computer/scripts/status-write.sh supervisor, and shows three lines in plain words. The field stores nothing.
//
// Only the one sentence, whether the computer may act, and how many checks are failing are in the document. The detail
// of a check stays on the computer, where the control page reads it: the dataset is public, and what is wrong with a
// screen is not something to publish.
//
// It is written without JSX: h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { readStatus } from './status-input.js';
import { ageText, clockText } from './time-text.js';
import { apiVersion } from '../project.js';

const h = createElement;

// The same version as the other status blocks

// The lines for a status document. A computer that has not written them yet says so.
export function supervisorLines(doc, now) {
  const source = doc && typeof doc === 'object' ? doc : {};
  const words = typeof source.supervisorWords === 'string' && source.supervisorWords !== '' ? source.supervisorWords : '';
  const mode = source.supervisorMode === 'fix' ? 'Fix: it may repair itself.' : 'Watch only: it writes down what it would do and does nothing.';
  const failing = typeof source.supervisorFailing === 'number' ? source.supervisorFailing : null;
  const age = ageText(source.supervisorAt, now);
  const clock = clockText(source.supervisorAt);

  return [
    { label: 'What it is doing', text: words || 'Nothing written yet' },
    { label: 'Allowed to', text: mode },
    {
      label: 'Last checked',
      text: age && clock
        ? age + ', ' + clock + (failing === null ? '' : failing === 0 ? ', nothing failing' : ', ' + failing + (failing === 1 ? ' check failing' : ' checks failing'))
        : 'Not yet',
    },
  ];
}

const styles = {
  note: { margin: 0, fontSize: 14, color: 'var(--card-muted-fg-color, inherit)' },
  line: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '0 0 4px', fontSize: 14 },
  label: { minWidth: 'min(160px, 100%)', fontWeight: 600 },
};

export function supervisorView(read, now) {
  if (!read) return h('p', { style: styles.note }, 'Reading what the computer is fixing.');
  if (read.unreadable) return h('p', { style: styles.note }, 'It could not be read. Refresh the page to try again.');
  if (!read.doc) return h('p', { style: styles.note }, 'Nothing yet. The Teletraan computer writes this once the health checks are installed.');

  return h('div', null, supervisorLines(read.doc, now).map(line =>
    h('p', { key: line.label, style: styles.line }, h('span', { style: styles.label }, line.label), h('span', null, line.text))
  ));
}

export function SupervisorStatusInput() {
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

  return supervisorView(read, new Date());
}
