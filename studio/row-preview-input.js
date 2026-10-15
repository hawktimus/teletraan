// The Preview button of a Monday row in the Screens builder (schemas/screen.js). It stores nothing.
// A click opens the panel of the row in a frame below it (panel-preview.js), drawn in the style of
// the Screen being edited, for the team and the department the row has.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useContext, useState } from 'react';
import { ScreenContext } from './screen-context.js';
import { PanelPreview, previewNote } from './panel-preview.js';
import { previewAddress, words } from './preview-panels.js';

const h = createElement;

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const button = {
  boxSizing: 'border-box',
  minHeight: 44,
  padding: '8px 16px',
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 600,
  border: border,
  borderRadius: 4,
  background: primaryBackground,
  color: primaryText,
  cursor: 'pointer',
};

export function isMondayId(panel) {
  return typeof panel === 'string' && panel.indexOf('monday-') === 0;
}

// The team of a row for the address: a team code, or nothing for Both teams and a row with none
export function teamForAddress(team) {
  return team === 'prime' || team === 'nova' ? team : (typeof team === 'string' && team !== 'both' ? team : '');
}

// The form of a row of the main panel with the Preview button of a Monday row below it. A row that
// is not a Monday row is drawn as it was.
export function RowWithPreview(props) {
  const context = useContext(ScreenContext);
  const value = props.value || {};
  const [open, setOpen] = useState(false);
  const form = props.renderDefault(props);

  if (!isMondayId(value.panel)) return form;

  const address = previewAddress(value.panel, teamForAddress(value.team), typeof value.department === 'string' ? value.department : '', context.style);

  return h(
    'div',
    null,
    form,
    h('button', { type: 'button', style: button, onClick: () => setOpen(!open), 'aria-expanded': open }, open ? words.hide : words.button),
    open ? [previewNote(words.help), h(PanelPreview, { key: 'frame', address: address, title: words.button + ': ' + value.panel })] : null
  );
}
