// The Team action "Use the standard colors for this team". It writes the standard colors, metal,
// glow and trim of the team's code (team-standard.js) into the draft of the open Team document and
// shows what changed. It never publishes: nothing reaches the screen until Publish is clicked.
//
// It is written without JSX: h(tag, props, ...children) is React's createElement.

import { createElement, useState } from 'react';
import { useDocumentOperation } from 'sanity';
import { standardChanges, standardFor } from './team-standard.js';

const h = createElement;

export const replaceQuestion = 'Replace the colors of this team with the standard ones? Nothing is published until you click Publish.';

const lineStyle = { margin: '4px 0', overflowWrap: 'anywhere' };

function changeList(lines) {
  if (lines.length === 0) return h('p', { style: lineStyle }, 'This team already has the standard colors.');
  return h('ul', { style: { margin: '8px 0 0', paddingLeft: 20 } }, lines.map(line =>
    h('li', { key: line.label, style: lineStyle }, line.label + ': ' + line.from + ' to ' + line.to)));
}

export function useStandardColorsAction(props) {
  const { patch } = useDocumentOperation(props.id, props.type);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(null);

  const team = props.draft || props.published || null;
  const code = team && team.code;
  const standard = standardFor(code);
  const changes = standardChanges(team, code);

  if (props.type !== 'team') return null;

  let dialog;
  if (done) {
    dialog = { type: 'dialog', onClose: () => { setDone(null); props.onComplete(); }, header: 'Colors replaced in the draft', content: h('div', null, h('p', { style: lineStyle }, 'Nothing is published yet. Check the form, then click Publish.'), changeList(done)) };
  } else if (open) {
    dialog = {
      type: 'confirm',
      tone: 'caution',
      message: h('div', null, h('p', { style: lineStyle }, replaceQuestion), changeList(changes.lines)),
      onCancel: () => { setOpen(false); props.onComplete(); },
      onConfirm: () => {
        patch.execute([{ set: changes.set }]);
        setOpen(false);
        setDone(changes.lines);
      },
    };
  }

  return {
    label: 'Use the standard colors for this team',
    title: !standard ? 'Only the teams with the code prime or nova have standard colors.' : changes.lines.length === 0 ? 'This team already has the standard colors.' : 'Put the standard colors, metal and trim of this team into the draft. Nothing is published.',
    disabled: !standard || changes.lines.length === 0 || Boolean(patch.disabled),
    onHandle: () => setOpen(true),
    dialog: dialog,
  };
}
// Studio and tests/schemas.test.mjs tell actions apart by this name
useStandardColorsAction.action = 'useStandardColors';
