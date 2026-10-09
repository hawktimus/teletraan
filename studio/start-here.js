// The Start here page, the first line of the sidebar (structure.js). It is a
// page of its own, not a document.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';

const h = createElement;

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 32px' },
  column: { maxWidth: 760, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  text: { lineHeight: 1.5, margin: '0 0 16px' },
};

export function StartHere() {
  return h(
    'div',
    { style: styles.page },
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, 'Start here'),
      h('p', { style: styles.text }, 'Teletraan I is the screen on the wall. After every change, click Publish all in the top bar.')
    )
  );
}
