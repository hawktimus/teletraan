// The field component of a note (fields.js, noteField): one plain line in the
// form, with no label and no box to type in. The line is the description of
// the field, so it is written once.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';

const h = createElement;

const styles = {
  note: {
    margin: 0,
    padding: '8px 16px',
    fontSize: 14,
    borderLeft: '3px solid var(--card-border-color, currentColor)',
    color: 'var(--card-muted-fg-color, inherit)',
  },
};

export function NoteField(props) {
  const text = props.schemaType && typeof props.schemaType.description === 'string' ? props.schemaType.description : '';
  return text ? h('p', { style: styles.note }, text) : null;
}
