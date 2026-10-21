// The input of Show on TV on a task (schemas/task.js). A task made before the field
// existed has no value, and the TV shows it, so an empty value is drawn as on. Nothing
// is written until an editor clicks.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';
import { toggleSwitch } from './field-editor.js';
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

  return toggleSwitch({
    id: props.id,
    checked: shown,
    disabled: Boolean(props.readOnly),
    ariaLabel: 'Show on TV',
    onChange: value => props.onChange(set(Boolean(value))),
    label: shown ? 'Shown on the TV' : 'Not shown on the TV',
  });
}
