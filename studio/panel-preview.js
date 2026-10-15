// The picture of a panel in the Studio: the dashboard in a frame, drawn at half size
// (preview-panels.js has the address and the size). It reads the published dataset, as the TV does.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';
import { frameSize, words } from './preview-panels.js';

const h = createElement;

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';

const styles = {
  box: { position: 'relative', width: frameSize.width, height: frameSize.height, maxWidth: '100%', overflow: 'hidden', border: border, background: '#000', margin: '8px 0 16px' },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: frameSize.canvasWidth,
    height: frameSize.canvasHeight,
    border: 0,
    transform: 'scale(' + frameSize.scale + ')',
    transformOrigin: '0 0',
  },
  note: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '0 0 4px' },
};

// address is from previewAddress(). title is for screen readers.
export function PanelPreview(props) {
  return h(
    'div',
    { style: styles.box, 'data-block': 'preview' },
    h('iframe', { src: props.address, title: props.title || words.button, style: styles.frame, loading: 'lazy' })
  );
}

export function previewNote(text) {
  return h('p', { style: styles.note }, text);
}
