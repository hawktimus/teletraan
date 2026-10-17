// The picture of a panel in the Studio: the dashboard in a frame, drawn at half size
// (preview-panels.js has the address and the size). It reads the published dataset, as the TV does.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useRef, useState } from 'react';
import { frameSize, words } from './preview-panels.js';

const h = createElement;

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';

const styles = {
  box: { position: 'relative', boxSizing: 'border-box', width: '100%', maxWidth: frameSize.width, aspectRatio: '16 / 9', overflow: 'hidden', border: border, background: '#000', margin: '8px 0 16px' },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: frameSize.canvasWidth,
    height: frameSize.canvasHeight,
    border: 0,
    transformOrigin: '0 0',
  },
  note: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '0 0 4px' },
};

// address is from previewAddress(). title is for screen readers.
// The frame is drawn at the size of the canvas and scaled to the width of the box, so it fits a phone too.
export function PanelPreview(props) {
  const box = useRef(null);
  const [scale, setScale] = useState(frameSize.scale);

  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver !== 'function') return undefined;

    const watcher = new ResizeObserver(() => setScale(element.clientWidth / frameSize.canvasWidth));
    watcher.observe(element);
    return () => watcher.disconnect();
  }, []);

  return h(
    'div',
    { ref: box, style: styles.box, 'data-block': 'preview' },
    h('iframe', { src: props.address, title: props.title || words.button, style: Object.assign({ transform: 'scale(' + scale + ')' }, styles.frame), loading: 'lazy' })
  );
}

export function previewNote(text) {
  return h('p', { style: styles.note }, text);
}
