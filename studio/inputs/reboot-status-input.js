// The Next and last reboot line at the top of the Scheduled reboot section of Dashboard Settings
// (schemas/settingsReboot.js). It reads the document status-mini, which the Teletraan computer writes with
// computer/scripts/status-write.sh reboot, and shows two lines in plain words. The control page shows the same two
// lines from the same document. The field stores nothing.
//
// It is written without JSX: h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { readStatus } from './status-input.js';
import { ageText, clockText } from './time-text.js';

const h = createElement;

// The same version as the other status block
const apiVersion = '2025-02-19';

// The two lines for a status document. A computer that has not written them yet says so.
export function rebootLines(doc, now) {
  const source = doc && typeof doc === 'object' ? doc : {};
  const next = typeof source.nextRebootText === 'string' && source.nextRebootText !== '' ? source.nextRebootText : '';
  const age = ageText(source.lastRebootAt, now);
  const clock = clockText(source.lastRebootAt);
  const why = typeof source.lastRebootWhy === 'string' && source.lastRebootWhy !== '' ? ' (' + source.lastRebootWhy + ')' : '';
  return [
    { label: 'Next reboot', text: next || 'None planned' },
    { label: 'Last reboot', text: age && clock ? age + ', ' + clock + why : 'Not yet' },
  ];
}

const styles = {
  note: { margin: 0, fontSize: 14, color: 'var(--card-muted-fg-color, inherit)' },
  line: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '0 0 4px', fontSize: 14 },
  label: { minWidth: 'min(160px, 100%)', fontWeight: 600 },
};

export function rebootView(read, now) {
  if (!read) return h('p', { style: styles.note }, 'Reading the reboot status.');
  if (read.unreadable) return h('p', { style: styles.note }, 'The reboot status could not be read. Refresh the page to try again.');
  if (!read.doc) return h('p', { style: styles.note }, 'No status yet. The Teletraan computer writes it once the scheduled reboot has run.');
  return h('div', null, rebootLines(read.doc, now).map(line =>
    h('p', { key: line.label, style: styles.line }, h('span', { style: styles.label }, line.label), h('span', null, line.text))
  ));
}

export function RebootStatusInput() {
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

  return rebootView(read, new Date());
}
