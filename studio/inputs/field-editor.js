// The plain rows of a page of the Studio that shows some fields of a document (Today, Look, Competition). One row
// is one field: its title, its one line description and a control. A switch and a choice save when it is touched. A
// number or a line of text saves when you leave the box or press Enter. A value the field would refuse is not saved:
// the row says what to fix. field-editor-parts.js holds the parts that need no Studio.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';
import { styles, accent, outline, controlCss } from './page-styles.js';
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

// The rules for the focus ring. Every choice and switch draws them, so a page needs no other setup.
export function controlStyle() {
  return h('style', { key: 'tt-controls', dangerouslySetInnerHTML: { __html: controlCss } });
}

// A group of buttons, one of which is on (a radio list). The items are { key, label, checked, onPick }. The real
// radio lies invisible over each button, so the arrow keys, Tab and a screen reader work as they do on a radio.
// The chosen button is filled and has a check mark; the others are outlined.
export function choiceButtons({ name, label, items, disabled, multiple }) {
  const kind = multiple ? 'checkbox' : 'radio';
  return h(
    'div',
    { role: multiple ? 'group' : 'radiogroup', 'aria-label': typeof label === 'string' ? label : undefined, style: styles.buttons },
    controlStyle(),
    items.map(item =>
      h(
        'label',
        {
          key: item.key,
          className: 'tt-pick' + (disabled ? ' tt-busy' : ''),
          'data-checked': item.checked ? 'true' : 'false',
          style: Object.assign({}, styles.button1, item.checked
            ? { background: accent, border: '2px solid ' + accent, color: '#ffffff' }
            : { background: 'transparent', border: '2px solid ' + outline, color: 'inherit' }),
        },
        h('input', { type: kind, name: name, value: item.key, checked: Boolean(item.checked), disabled: Boolean(disabled), style: styles.overlay, onChange: () => item.onPick(!item.checked) }),
        h('span', { 'aria-hidden': 'true', style: styles.mark }, item.checked ? '\u2713' : ''),
        h('span', null, item.label)
      )
    )
  );
}

// A switch: a pill with a knob, the word On or Off and the text. It is a real checkbox with the role switch.
export function toggleSwitch({ checked, disabled, onChange, label, ariaLabel, id }) {
  const on = Boolean(checked);
  return h(
    'label',
    { className: 'tt-toggle' + (disabled ? ' tt-busy' : ''), style: styles.toggle, 'data-checked': on ? 'true' : 'false' },
    controlStyle(),
    h('input', { type: 'checkbox', role: 'switch', id: id, checked: on, disabled: Boolean(disabled), 'aria-label': ariaLabel, style: styles.overlay, onChange: event => onChange(event.target.checked) }),
    h(
      'span',
      { 'aria-hidden': 'true', className: 'tt-track', style: Object.assign({}, styles.track, on ? { background: accent, border: '2px solid ' + accent } : { background: 'transparent', border: '2px solid ' + outline }) },
      h('span', { style: Object.assign({}, styles.knob, { background: on ? '#ffffff' : outline, transform: on ? 'translateX(22px)' : 'translateX(0)' }) })
    ),
    h('span', { 'aria-hidden': 'true', style: styles.word }, on ? 'On' : 'Off'),
    label ? h('span', { style: { minWidth: 0 } }, label) : null
  );
}

function switchRow(spec, value, onSave, busy, problems) {
  return h(
    'div',
    { key: spec.id, style: styles.field, 'data-field': spec.id },
    toggleSwitch({
      checked: value,
      disabled: busy,
      ariaLabel: spec.title,
      onChange: checked => onSave(spec, checked),
      label: h('span', null, h('strong', null, spec.title), h('span', { style: styles.help }, spec.description)),
    }),
    problemLine(spec, problems)
  );
}

function choiceRow(spec, value, onSave, busy, problems) {
  return h(
    'fieldset',
    { key: spec.id, style: styles.fieldset, 'data-field': spec.id },
    h('legend', { style: styles.label }, spec.title),
    h('span', { style: styles.help }, spec.description),
    choiceButtons({
      name: spec.id,
      label: spec.title,
      disabled: busy,
      items: spec.choices.map(choice => ({ key: String(choice.value), label: choice.title, checked: value === choice.value, onPick: () => onSave(spec, choice.value) })),
    }),
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
    className: 'tt-field',
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
    controlStyle(),
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
