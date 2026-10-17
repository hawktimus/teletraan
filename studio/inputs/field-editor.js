// The plain rows of a page of the Studio that shows some fields of a document (Today, Look, Competition). One row
// is one field: its title, its one line description and a control. A switch and a choice save when it is touched. A
// number or a line of text saves when you leave the box or press Enter. A value the field would refuse is not saved:
// the row says what to fix. field-editor-parts.js holds the parts that need no Studio.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';
import { styles } from './page-styles.js';
import { valueOf, toLocalInput, fromLocalInput } from './field-editor-parts.js';

const h = createElement;

// What a box holds, as the value to save: numbers are numbers, an empty box is no value, a date and time is ISO text
export function valueFromInput(spec, raw) {
  if (spec.kind === 'number') return raw === '' || raw === null || raw === undefined ? undefined : Number(raw);
  if (spec.kind === 'datetime') return fromLocalInput(raw) || undefined;
  return raw === '' ? undefined : raw;
}

function same(a, b) {
  return a === b || (a === undefined && b === '') || (a === '' && b === undefined);
}

function problemLine(spec, problems) {
  const text = problems && problems[spec.id];
  return text ? h('span', { role: 'alert', style: styles.failed }, text) : null;
}

function switchRow(spec, value, onSave, busy, problems) {
  return h(
    'label',
    { key: spec.id, style: styles.choice, 'data-field': spec.id },
    h('input', { type: 'checkbox', checked: Boolean(value), disabled: busy, style: styles.box, onChange: event => onSave(spec, event.target.checked) }),
    h('span', null, h('strong', null, spec.title), h('span', { style: styles.help }, spec.description), problemLine(spec, problems))
  );
}

function choiceRow(spec, value, onSave, busy, problems) {
  return h(
    'fieldset',
    { key: spec.id, style: styles.fieldset, 'data-field': spec.id },
    h('legend', { style: styles.label }, spec.title),
    h('span', { style: styles.help }, spec.description),
    spec.choices.map(choice =>
      h(
        'label',
        { key: String(choice.value), style: styles.choice },
        h('input', { type: 'radio', name: spec.id, value: String(choice.value), checked: value === choice.value, disabled: busy, style: styles.box, onChange: () => onSave(spec, choice.value) }),
        h('span', { style: { paddingTop: 10 } }, choice.title)
      )
    ),
    problemLine(spec, problems)
  );
}

function boxRow(spec, value, onSave, busy, problems) {
  const shown = spec.kind === 'datetime' ? toLocalInput(value) : value === undefined || value === null ? '' : String(value);
  const commit = event => {
    const wanted = valueFromInput(spec, event.target.value);
    if (!same(wanted, spec.kind === 'datetime' ? valueFromInput(spec, shown) : value)) onSave(spec, wanted);
  };
  const props = {
    id: 'field-' + spec.id,
    key: spec.id + ':' + shown,
    defaultValue: shown,
    disabled: busy,
    style: spec.kind === 'longtext' ? styles.area : styles.input,
    onBlur: commit,
    'aria-label': spec.title,
  };

  let box;
  if (spec.kind === 'longtext') box = h('textarea', Object.assign({ rows: spec.rows }, props));
  else {
    const type = spec.kind === 'number' ? 'number' : spec.kind === 'datetime' ? 'datetime-local' : spec.kind === 'date' ? 'date' : 'text';
    const extra = { type: type, onKeyDown: event => { if (event.key === 'Enter') event.target.blur(); } };
    if (spec.kind === 'number') Object.assign(extra, { inputMode: 'decimal', step: spec.integer ? 1 : 'any', min: spec.min, max: spec.max });
    box = h('input', Object.assign(extra, props));
  }

  return h(
    'div',
    { key: spec.id, style: styles.field, 'data-field': spec.id },
    h('label', { htmlFor: 'field-' + spec.id, style: styles.label }, spec.title),
    h('span', { style: styles.help }, spec.description),
    box,
    problemLine(spec, problems)
  );
}

// The rows for the specs, from the document that holds the values. problems is { [spec.id]: text }.
export function fieldRows(specs, document, onSave, busy, problems) {
  return specs.map(spec => {
    const value = valueOf(spec, document);
    if (spec.kind === 'switch') return switchRow(spec, value, onSave, busy, problems);
    if (spec.kind === 'choice') return choiceRow(spec, value, onSave, busy, problems);
    return boxRow(spec, value, onSave, busy, problems);
  });
}

// The line under a page that says what the last save did
export function saveLine(state) {
  if (!state || !state.text) return null;
  return h('p', { role: state.failed ? 'alert' : undefined, 'aria-live': 'polite', style: state.failed ? styles.failed : styles.muted }, state.text);
}
