// The Test the token button of the Monday tab (schemas/settingsMonday.js). It asks the Teletraan computer, through the
// control page, who the token belongs to (tools/monday-check.js) and shows the account name or the error. The
// field stores nothing.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useState } from 'react';
import { checkToken, words } from '../tools/monday-check.js';

const h = createElement;

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';

const styles = {
  button: {
    boxSizing: 'border-box',
    minHeight: 44,
    padding: '8px 16px',
    fontFamily: 'inherit',
    fontSize: 16,
    fontWeight: 600,
    border: border,
    borderRadius: 4,
    background: 'var(--card-badge-primary-bg-color, #dbeafe)',
    color: 'var(--card-badge-primary-fg-color, #1e40af)',
    cursor: 'pointer',
  },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
  says: { margin: '8px 0 0', fontSize: 14, lineHeight: 1.4 },
  failed: { margin: '8px 0 0', fontSize: 14, lineHeight: 1.4, color: 'var(--card-badge-critical-fg-color, #b91c1c)' },
};

// fetcher is what the button calls; the form gives the browser's fetch
export function MondayTokenInput(props) {
  const [state, setState] = useState({ text: '', failed: false, busy: false });
  const fetcher = props && typeof props.fetcher === 'function' ? props.fetcher : (...given) => fetch(...given);

  function test() {
    setState({ text: words.asking, failed: false, busy: true });
    return checkToken(fetcher).then(line => setState({ text: line.text, failed: line.failed, busy: false }));
  }

  return h(
    'div',
    null,
    h('button', { type: 'button', disabled: state.busy, style: Object.assign({}, styles.button, state.busy ? styles.disabled : {}), onClick: test }, 'Test the token'),
    state.text ? h('p', { role: state.failed ? 'alert' : undefined, 'aria-live': 'polite', style: state.failed ? styles.failed : styles.says }, state.text) : null
  );
}
