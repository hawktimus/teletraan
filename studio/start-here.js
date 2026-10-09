// The Start here page, the first line of the sidebar (structure.js). It is a
// page of its own, not a document. It has five blocks, top to bottom: what the
// screen is, a picture of the screen, the three steps of every meeting, five
// buttons that try the screen, and a line for the coaches' pages.
//
// The words and numbers that need no Studio are in start-here-parts.js, so that
// check-schemas.mjs can read them with node. The buttons send their requests
// through screen-requests.js, which the buttons beside Publish use as well.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useState } from 'react';
import { useClient } from 'sanity';
import { screen, areas, labelsOf, buttons, sentLine, problemWith } from './start-here-parts.js';
import { sendWithClient } from './screen-requests.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// Plain styles. The colours are the Studio's own variables, so the page follows
// the Studio's light and dark themes, and each has a fallback.
const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const critical = 'var(--card-badge-critical-fg-color, #b91c1c)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 32px' },
  column: { maxWidth: 760, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  subheading: { fontSize: 16, fontWeight: 600, margin: '32px 0 8px' },
  text: { lineHeight: 1.5, margin: '0 0 16px' },
  muted: { color: muted, lineHeight: 1.5, margin: '0 0 16px' },
  steps: { lineHeight: 1.5, margin: '0 0 16px', paddingLeft: 24 },
  figure: { margin: 0 },
  caption: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '8px 0 0' },
  picture: { display: 'block', width: '100%', height: 'auto' },
  screenEdge: { fill: 'none', stroke: 'var(--card-border-color, rgba(128, 128, 128, 0.6))', strokeWidth: 8 },
  box: { fill: primaryBackground, stroke: primaryText, strokeWidth: 4 },
  badge: { fill: primaryText },
  letter: { fill: primaryBackground, fontWeight: 700 },
  name: { fill: primaryText, fontWeight: 700 },
  feed: { fill: primaryText },
  row: { display: 'flex', flexWrap: 'wrap', gap: 12, margin: '16px 0' },
  cell: { flex: '1 1 130px', minWidth: 0 },
  button: {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 88,
    padding: '12px 8px',
    fontFamily: 'inherit',
    fontSize: 18,
    lineHeight: 1.25,
    fontWeight: 600,
    textAlign: 'center',
    border: border,
    borderRadius: 4,
    background: primaryBackground,
    color: primaryText,
    cursor: 'pointer',
  },
  link: { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
  says: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '8px 0 0' },
  failed: { color: critical, lineHeight: 1.5, margin: '0 0 16px' },
};

// Block 1
function whatItIs() {
  return h(
    'div',
    { 'data-block': 'what' },
    h('p', { style: styles.text }, 'Teletraan I is the screen on the wall, and Publish all is the last step of every change.')
  );
}

// One area of the picture: its box, the square with its letter, its name and the sidebar items that fill it
function areaShapes(area) {
  const labels = labelsOf(area);

  return h(
    'g',
    { key: area.letter },
    h('rect', { x: area.x, y: area.y, width: area.width, height: area.height, rx: 16, style: styles.box }),
    h('rect', { x: labels.badge.x, y: labels.badge.y, width: labels.badge.size, height: labels.badge.size, rx: 12, style: styles.badge }),
    h('text', { x: labels.letter.x, y: labels.letter.y, textAnchor: 'middle', style: Object.assign({ fontSize: labels.letter.size }, styles.letter) }, labels.letter.text),
    h('text', { x: labels.name.x, y: labels.name.y, style: Object.assign({ fontSize: labels.name.size }, styles.name) }, labels.name.text),
    labels.feeds.map(feed => h('text', { key: feed.text, x: feed.x, y: feed.y, style: Object.assign({ fontSize: feed.size }, styles.feed) }, feed.text))
  );
}

// Block 2
function pictureOfTheScreen() {
  return h(
    'div',
    { 'data-block': 'picture' },
    h('h2', { style: styles.subheading }, 'The screen'),
    h(
      'figure',
      { style: styles.figure },
      h(
        'svg',
        {
          viewBox: '0 0 ' + screen.width + ' ' + screen.height,
          role: 'img',
          'aria-label': 'The screen. A is the banner across the top. B is the main panel on the left. C is the countdown and D is the side panel, on the right. E is the ticker along the bottom.',
          style: styles.picture,
        },
        h('rect', { x: 4, y: 4, width: screen.width - 8, height: screen.height - 8, rx: 24, style: styles.screenEdge }),
        areas.map(areaShapes)
      ),
      h('figcaption', { style: styles.caption }, 'Each box is a part of the screen. The words in a box are the sidebar items that fill it.')
    )
  );
}

// Block 3
function threeSteps() {
  return h(
    'div',
    { 'data-block': 'steps' },
    h('h2', { style: styles.subheading }, 'Every meeting'),
    h(
      'ol',
      { style: styles.steps },
      h('li', null, 'Open Daily Agenda or Tasks.'),
      h('li', null, 'Make the change.'),
      h('li', null, 'Click Publish all in the top bar.')
    ),
    h('p', { style: styles.muted }, 'You edit on Draft, and the screen shows Published.')
  );
}

// One button and the line under it. The one that opens the screen is a link in a new tab.
function buttonCell(button, busy, send) {
  const words = h('p', { style: styles.says }, button.says);

  if (button.address) {
    const style = Object.assign({}, styles.button, styles.link);
    return h(
      'div',
      { key: button.id, style: styles.cell },
      h('a', { href: button.address, target: '_blank', rel: 'noopener noreferrer', title: 'Opens ' + button.address, style: style }, button.label),
      words
    );
  }

  const style = Object.assign({}, styles.button, busy ? styles.disabled : {});
  return h(
    'div',
    { key: button.id, style: styles.cell },
    h('button', { type: 'button', disabled: busy, style: style, onClick: () => send(button) }, button.label),
    words
  );
}

// Block 4. status is what happened to the last request: { text, failed, busy }
function tryTheScreen(status, send) {
  return h(
    'div',
    { 'data-block': 'buttons' },
    h('h2', { style: styles.subheading }, 'Try the screen'),
    h('div', { style: styles.row }, buttons.map(button => buttonCell(button, status.busy, send))),
    status.text ? h('p', { role: status.failed ? 'alert' : undefined, 'aria-live': 'polite', style: status.failed ? styles.failed : styles.muted }, status.text) : null
  );
}

// Block 5
function forCoaches() {
  return h(
    'div',
    { 'data-block': 'coaches' },
    h('p', { style: styles.muted }, 'Anything under Coaches only is for a coach, so ask a coach.')
  );
}

export function StartHere() {
  const client = useClient({ apiVersion: apiVersion });
  const [status, setStatus] = useState({ text: '', failed: false, busy: false });

  // Sends the request of a button. It gives back a promise that is done when the answer is on the page.
  function send(button) {
    setStatus({ text: 'Sending...', failed: false, busy: true });

    return Promise.resolve()
      .then(() => sendWithClient(client, button.request()))
      .then(() => setStatus({ text: sentLine, failed: false, busy: false }))
      .catch(error => setStatus({ text: problemWith(error), failed: true, busy: false }));
  }

  return h(
    'div',
    { style: styles.page },
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, 'Start here'),
      whatItIs(),
      pictureOfTheScreen(),
      threeSteps(),
      tryTheScreen(status, send),
      forCoaches()
    )
  );
}
