// The Kept data page, the last line of Coaches only. It is a page of its own, not a document. It lists what the Studio
// keeps so that nothing is lost, with a link to open each: the three old Screens, the Condensed view and the old events
// calendar type. The wall does not use them, and some old values are read when a new list is empty, so nothing is
// deleted. The page changes nothing.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';
import { usePaneRouter } from 'sanity/structure';
import { styles } from './page-styles.js';
import { words, groups } from './kept-data-parts.js';

const h = createElement;

function groupBlock(group, ChildLink) {
  return h(
    'div',
    { key: group.id, 'data-block': group.id },
    h('h2', { style: styles.subheading }, group.title),
    h('p', { style: styles.muted }, group.says),
    h('ul', { style: styles.list }, group.items.map(item => h('li', { key: item.id }, ChildLink ? h(ChildLink, { childId: item.id }, words.open + ' ' + item.title) : item.title)))
  );
}

export function pageOf(ChildLink) {
  return h(
    'div',
    { style: styles.page },
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, words.title),
      h('p', { style: styles.text }, words.notUsed),
      h('p', { style: styles.text, 'data-line': 'keep' }, words.keep),
      groups.map(group => groupBlock(group, ChildLink))
    )
  );
}

export function KeptDataView() {
  const paneRouter = usePaneRouter();
  return pageOf(paneRouter && paneRouter.ChildLink);
}
