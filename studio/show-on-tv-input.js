// The input of Show on TV on a task (schemas/task.js). A task made before the field
// existed has no value, and the TV shows it, so an empty value is drawn as on. Nothing
// is written until an editor clicks.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';
import { set } from 'sanity';

const h = createElement;

const styles = {
  choice: { display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' },
};

// Only a switch that was turned off hides the task
export function isShownOnTv(value) {
  return value !== false;
}

export function ShowOnTvInput(props) {
  const shown = isShownOnTv(props.value);

  return h(
    'label',
    { style: styles.choice },
    h('input', {
      type: 'checkbox',
      id: props.id,
      checked: shown,
      disabled: Boolean(props.readOnly),
      onChange: event => props.onChange(set(Boolean(event.target.checked))),
    }),
    h('span', null, shown ? 'Shown on the TV' : 'Not shown on the TV')
  );
}
