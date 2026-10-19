// The Match13 block of the Competition page. It reads the document status-mini, where the Teletraan computer
// writes the time, the state and the team count of its last read of Match13 (computer/scripts/status-write.sh
// match13). The forecasts themselves are not in Sanity: they stay on the Teletraan computer (docs/match13.md).
// It stores nothing, and if the document cannot be read it says so and the page still opens.
//
// It is written without JSX: h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { ageText } from './time-text.js';
import { isRecord } from './plain-values.js';

const h = createElement;

const apiVersion = '2025-02-19';

// The id the Teletraan computer writes to. computer/scripts/status-write.sh has the same one.
export const statusId = 'status-mini';

const question = '*[_id == $id][0] { match13At, match13State, match13Count }';

export const noKey = 'No Match13 key yet. Add it on the control page, Settings, Keys.';

const styles = {
  note: { margin: 0, fontSize: 14, color: 'var(--card-muted-fg-color, inherit)' },
  line: { margin: '0 0 4px', fontSize: 14 },
};

// The words for what the status document says. now is a Date.
export function match13Words(doc, now) {
  const source = isRecord(doc) ? doc : {};
  const age = ageText(source.match13At, now);
  if (age === '' || source.match13State === 'no-key') return noKey;

  switch (source.match13State) {
    case 'bad-key':
      return 'Match13 did not accept the key. Check it on the control page, Settings, Keys. Last tried ' + age + '.';
    case 'limit':
      return 'Match13 asked the Teletraan computer to wait. It reads again by itself. Last tried ' + age + '.';
    case 'down':
      return 'Match13 did not answer. The Teletraan computer reads again by itself. Last tried ' + age + '.';
    default: {
      const count = typeof source.match13Count === 'number' && source.match13Count > 0 ? ' It holds ' + source.match13Count + (source.match13Count === 1 ? ' team.' : ' teams.') : '';
      return 'Last read ' + age + '.' + count;
    }
  }
}

export async function readMatch13Status(client) {
  try {
    const found = await client.fetch(question, { id: statusId }, { perspective: 'published' });
    return { doc: isRecord(found) ? found : null, unreadable: false };
  } catch (error) {
    return { doc: null, unreadable: true };
  }
}

// What the block shows for what was read: null while it is being read, then { doc, unreadable }
export function match13View(read, now) {
  if (!read) return h('p', { style: styles.note }, 'Reading the Match13 status.');
  if (read.unreadable) return h('p', { style: styles.note }, 'The Match13 status could not be read. Refresh the page to try again.');
  return h('p', { style: styles.line }, match13Words(read.doc, now));
}

export function Match13StatusInput() {
  const client = useClient({ apiVersion: apiVersion });
  const [read, setRead] = useState(null);

  useEffect(() => {
    let stopped = false;
    readMatch13Status(client).then(result => {
      if (!stopped) setRead(result);
    });
    return () => {
      stopped = true;
    };
  }, []);

  return match13View(read, new Date());
}
