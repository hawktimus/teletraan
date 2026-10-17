// The Colors field of a Team document. Above the colors it draws a row of swatches, so a coach sees the team at a glance,
// and the button Use the standard colors for this team, which is also in the menu beside Publish (tools/team-actions.js).
// The button shows what it would change first, and writes to the draft only. Nothing is published until Publish is clicked.
// Under them the twelve colors are the usual form, folded until they are opened.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useState } from 'react';
import { useDocumentOperation, useFormValue } from 'sanity';
import { standardChanges, standardFor } from '../tools/team-standard.js';

const h = createElement;

const hexColor = /^#[0-9A-Fa-f]{6}$/;

// The colors shown in the row, with the words that name them
export const swatchNames = [
  { name: 'primary', title: 'Main' },
  { name: 'plate', title: 'Plate' },
  { name: 'accent', title: 'Accent' },
  { name: 'neon', title: 'Neon' },
  { name: 'background', title: 'Background' },
  { name: 'text', title: 'Text' },
];

export const words = {
  button: 'Use the standard colors for this team',
  question: 'Replace the colors of this team with the standard ones? Nothing is published until you click Publish.',
  replace: 'Replace in the draft',
  cancel: 'Cancel',
  done: 'Colors replaced in the draft. Check the form, then click Publish.',
  already: 'This team already has the standard colors.',
  none: 'Only the teams with the code prime or nova have standard colors.',
};

// The swatches for the colors stored: a color that is not a hex color is left out
export function swatchesOf(colors) {
  const stored = colors && typeof colors === 'object' ? colors : {};
  return swatchNames.filter(item => hexColor.test(stored[item.name] || '')).map(item => ({ name: item.name, title: item.title, color: stored[item.name] }));
}

// What the button says it will do, from the team as it is in the form: the lines of change, or why there is nothing to do
export function standardState(team) {
  const code = team && team.code;
  const changes = standardChanges(team, code);
  if (!standardFor(code)) return { enabled: false, note: words.none, changes: changes };
  if (changes.lines.length === 0) return { enabled: false, note: words.already, changes: changes };
  return { enabled: true, note: '', changes: changes };
}

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';

const styles = {
  row: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 12px' },
  swatch: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 12, color: muted },
  chip: { width: 44, height: 44, boxSizing: 'border-box', borderRadius: 4, border: border },
  button: { boxSizing: 'border-box', minHeight: 44, maxWidth: '100%', padding: '8px 16px', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, border: border, borderRadius: 4, cursor: 'pointer' },
  note: { color: muted, margin: '8px 0 12px', overflowWrap: 'anywhere' },
  list: { margin: '8px 0', paddingLeft: 20, overflowWrap: 'anywhere' },
  buttons: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 12px' },
};

export function TeamColorsInput(props) {
  const team = useFormValue([]);
  const documentId = useFormValue(['_id']);
  const id = String(documentId || (team && team._id) || '').replace(/^drafts\./, '');
  const { patch } = useDocumentOperation(id, 'team');
  const [stage, setStage] = useState('');

  const state = standardState(team);
  const swatches = swatchesOf(props.value);

  function replace() {
    patch.execute([{ set: state.changes.set }]);
    setStage('done');
  }

  let below;
  if (stage === 'ask') {
    below = h(
      'div',
      { 'data-block': 'ask' },
      h('p', { style: styles.note }, words.question),
      h('ul', { style: styles.list }, state.changes.lines.map(line => h('li', { key: line.label }, line.label + ': ' + line.from + ' to ' + line.to))),
      h(
        'div',
        { style: styles.buttons },
        h('button', { type: 'button', style: styles.button, onClick: replace }, words.replace),
        h('button', { type: 'button', style: styles.button, onClick: () => setStage('') }, words.cancel)
      )
    );
  } else if (stage === 'done') {
    below = h('p', { style: styles.note, role: 'status' }, words.done);
  } else {
    below = h(
      'div',
      null,
      h('button', { type: 'button', style: styles.button, disabled: !state.enabled || Boolean(patch && patch.disabled), onClick: () => setStage('ask') }, words.button),
      state.note ? h('p', { style: styles.note }, state.note) : null
    );
  }

  return h(
    'div',
    null,
    h(
      'div',
      { style: styles.row, 'data-block': 'swatches' },
      swatches.map(item =>
        h('div', { key: item.name, style: styles.swatch }, h('div', { style: Object.assign({}, styles.chip, { background: item.color }), title: item.title + ' ' + item.color, role: 'img', 'aria-label': item.title + ' ' + item.color }), item.title)
      )
    ),
    below,
    props.renderDefault ? props.renderDefault(props) : null
  );
}
