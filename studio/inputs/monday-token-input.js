// The Check the token note of the Monday tab (schemas/settingsMonday.js). The check runs on the control page, behind its
// PIN, so this field shows a plain note and a link to it (tools/monday-check.js). It sends nothing and stores nothing.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';
import { checkAddress, words } from '../tools/monday-check.js';

const h = createElement;

const styles = {
  says: { margin: '0 0 8px', fontSize: 14, lineHeight: 1.4 },
  link: { fontSize: 16, fontWeight: 600 },
};

export function MondayTokenInput() {
  return h(
    'div',
    null,
    h('p', { style: styles.says }, words.note + ' ' + words.wifi),
    h('a', { href: checkAddress, target: '_blank', rel: 'noopener noreferrer', style: styles.link }, words.link)
  );
}
