// Draws one field of the form spec as plain DOM: a switch, a number, radios or a select, text with a counter, a color with a swatch
// and a hex box, a date, ticks, a list of words, a Team select, a group and a list of items. The page code is settings-all.js.
//
// form is what the page gives every field:
//   form.docId             the id of the document
//   form.teams             the teams to pick from [{ id, name, code, active }]
//   form.get(path)         the value on the page now ('crt.everySeconds', 'calendars[1].name')
//   form.set(path, value)  changes it (and the page notes it as unsaved)
//   form.commit()          ends one edit, so Undo goes back one change at a time
//   form.redraw()          draws the tab again after a list changes its items

import { problemWith } from './settings-check.js';
import { fromLocalBox, itemLabel, move, newItem, toLocalBox, visible } from './settings-all-values.js';
import { choiceElement, switchElement } from './choice.js';

export function h(tag, attrs, ...children) {
  const element = document.createElement(tag);
  Object.keys(attrs || {}).forEach(name => {
    const value = attrs[name];
    if (value === false || value === undefined || value === null) return;
    if (name === 'class') element.className = value;
    else if (name === 'text') element.textContent = value;
    else if (name.startsWith('on')) element.addEventListener(name.slice(2), value);
    else element.setAttribute(name, value === true ? '' : value);
  });
  children.flat().forEach(child => { if (child !== undefined && child !== null && child !== false) element.append(child); });
  return element;
}

let counter = 0;
const nextId = () => 'sa-' + (counter += 1);

// What the limits of a field say, in a few plain words, for the line under it
export function hintOf(field) {
  const rules = field.validation || {};
  const parts = [];
  if (field.widget === 'number') {
    const range = rules.min !== undefined && rules.max !== undefined ? ' from ' + rules.min + ' to ' + rules.max : rules.min !== undefined ? ', at least ' + rules.min : rules.max !== undefined ? ', at most ' + rules.max : '';
    parts.push((rules.integer ? 'Whole number' : 'Number') + range);
  }
  if (rules.required) parts.push('Required');
  if (field.initialValue !== undefined && field.widget !== 'group' && field.widget !== 'list' && !Array.isArray(field.initialValue) && typeof field.initialValue !== 'object') parts.push('Starts at ' + startWords(field));
  return parts.join('. ');
}

function startWords(field) {
  const start = field.initialValue;
  if (field.widget === 'switch') return start ? 'On' : 'Off';
  const choice = field.options && field.options.list.filter(item => item.value === start)[0];
  return choice ? choice.title : String(start);
}

// ----- the pieces every field has -----

function problemLines(field, form, path, wrapper) {
  const error = wrapper.querySelector(':scope > .sa-error');
  const warn = wrapper.querySelector(':scope > .sa-warn');
  const value = form.get(path);
  const parent = form.parentOf(path);
  const bad = field.widget === 'group' || field.widget === 'list' ? '' : problemWith(field, value, parent);
  error.textContent = bad;
  warn.textContent = bad ? '' : field.widget === 'group' || field.widget === 'list' ? '' : problemWith(field, value, parent, 'warning');
  wrapper.dataset.invalid = bad ? 'yes' : 'no';
}

// The frame of a field: title, the unsaved mark, undo, the one-line description, the control, the hint and the problem lines.
// whole is true for a group or a list, whose title is a heading rather than a label.
function frame(field, form, path, control, id, whole) {
  const wrapper = h('div', { class: 'sa-field', 'data-path': path, 'data-widget': field.widget });
  const title = whole ? h('h3', { class: 'sa-title', text: field.title }) : h('label', { class: 'sa-title', for: id, text: field.title });
  const hint = hintOf(field);
  wrapper.append(
    h('div', { class: 'sa-head' },
      title,
      h('span', { class: 'sa-mark', hidden: true, text: 'Unsaved' }),
      h('button', { type: 'button', class: 'sa-undo', hidden: true, text: 'Undo', onclick: () => form.undoField(path) })),
    ...[
      field.description ? h('p', { class: 'sa-help', text: field.description }) : null,
      control,
      hint ? h('p', { class: 'sa-hint', text: hint }) : null,
      h('p', { class: 'sa-error', role: 'alert' }),
      h('p', { class: 'sa-warn' }),
    ].filter(Boolean),
  );
  return wrapper;
}

// ----- the controls -----

function switchControl(field, form, path, id) {
  const control = switchElement({ id: id, checked: form.get(path) === true });
  control.querySelector('input').addEventListener('change', event => { form.set(path, event.target.checked); form.commit(); });
  return control;
}

function numberControl(field, form, path, id) {
  const rules = field.validation || {};
  const input = h('input', { type: 'number', id: id, inputmode: rules.integer ? 'numeric' : 'decimal', step: rules.integer ? '1' : 'any', min: rules.min, max: rules.max });
  const value = form.get(path);
  input.value = value === undefined || value === null ? '' : String(value);
  input.addEventListener('input', () => form.set(path, input.value === '' ? undefined : Number(input.value)));
  input.addEventListener('change', () => form.commit());
  return input;
}

function choiceValue(field, text) {
  const match = field.options.list.filter(item => String(item.value) === text)[0];
  return match ? match.value : undefined;
}

function radioControl(field, form, path, id) {
  const name = nextId();
  const rules = field.validation || {};
  const list = rules.required || field.initialValue !== undefined ? field.options.list : [{ title: 'Not set', value: '' }].concat(field.options.list);
  const current = form.get(path);
  const group = choiceElement({
    name: name, id: id, labelledBy: id + '-t',
    items: list.map(item => ({ value: String(item.value), label: item.title, checked: item.value === '' ? current === undefined || current === null || current === '' : current === item.value })),
  });
  group.querySelectorAll('input').forEach((input, at) => {
    input.addEventListener('change', () => { form.set(path, list[at].value === '' ? undefined : list[at].value); form.commit(); });
  });
  return group;
}

function selectControl(field, form, path, id) {
  const select = h('select', { id: id });
  const rules = field.validation || {};
  if (!rules.required) select.append(h('option', { value: '', text: 'Not set' }));
  field.options.list.forEach(item => select.append(h('option', { value: String(item.value), text: item.title })));
  const current = form.get(path);
  select.value = current === undefined || current === null ? '' : String(current);
  select.addEventListener('change', () => { form.set(path, select.value === '' ? undefined : choiceValue(field, select.value)); form.commit(); });
  return select;
}

function textControl(field, form, path, id) {
  const rules = field.validation || {};
  const input = field.widget === 'textarea' ? h('textarea', { id: id, rows: field.rows || 3 }) : h('input', { type: 'text', id: id, autocomplete: 'off' });
  input.value = form.get(path) || '';
  const box = h('div', { class: 'sa-text' }, input);
  const warnAt = rules.warn && rules.warn.max;
  const limit = rules.max;
  if (limit) {
    const count = h('span', { class: 'sa-count' });
    const show = () => {
      const size = input.value.length;
      count.textContent = size + ' of ' + limit;
      count.dataset.state = size > limit ? 'over' : warnAt && size > warnAt ? 'warn' : 'ok';
    };
    input.addEventListener('input', show);
    show();
    box.append(count);
  }
  input.addEventListener('input', () => form.set(path, input.value === '' ? undefined : input.value));
  input.addEventListener('change', () => form.commit());
  return box;
}

function colorControl(field, form, path, id) {
  const value = form.get(path) || '';
  const swatch = h('input', { type: 'color', class: 'sa-swatch', 'aria-label': field.title + ' color picker', value: /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '#000000' });
  const hex = h('input', { type: 'text', id: id, class: 'sa-hex', maxlength: '7', spellcheck: 'false', autocomplete: 'off' });
  hex.value = value;
  swatch.addEventListener('input', () => { hex.value = swatch.value.toUpperCase(); form.set(path, hex.value); });
  swatch.addEventListener('change', () => form.commit());
  hex.addEventListener('input', () => {
    form.set(path, hex.value === '' ? undefined : hex.value);
    if (/^#[0-9a-f]{6}$/i.test(hex.value)) swatch.value = hex.value.toLowerCase();
  });
  hex.addEventListener('change', () => form.commit());
  return h('div', { class: 'sa-color' }, swatch, hex);
}

function dateControl(field, form, path, id) {
  const long = field.widget === 'datetime';
  const input = h('input', { type: long ? 'datetime-local' : 'date', id: id });
  const value = form.get(path);
  input.value = long ? toLocalBox(value) : value || '';
  input.addEventListener('change', () => {
    form.set(path, input.value === '' ? undefined : long ? fromLocalBox(input.value) : input.value);
    form.commit();
  });
  return input;
}

function checksControl(field, form, path, id) {
  const picked = () => (Array.isArray(form.get(path)) ? form.get(path) : []);
  const list = field.options.list;
  const group = choiceElement({ id: id, multiple: true, labelledBy: id + '-t', items: list.map(item => ({ value: String(item.value), label: item.title, checked: picked().includes(item.value) })) });
  group.querySelectorAll('input').forEach((input, at) => {
    input.addEventListener('change', () => {
      const item = list[at];
      const now = picked().filter(value => value !== item.value);
      if (input.checked) now.push(item.value);
      const order = list.map(one => one.value);
      form.set(path, now.sort((a, b) => order.indexOf(a) - order.indexOf(b)));
      form.commit();
    });
  });
  return group;
}

function tagsControl(field, form, path, id) {
  const holder = h('div', { class: 'sa-tags' });
  const listBox = h('ul', { class: 'sa-taglist' });
  const input = h('input', { type: field.of === 'number' ? 'number' : 'text', id: id, autocomplete: 'off', 'aria-label': 'Add to ' + field.title });
  const draw = () => {
    listBox.replaceChildren();
    const words = Array.isArray(form.get(path)) ? form.get(path) : [];
    words.forEach((word, index) => {
      listBox.append(h('li', {}, h('span', { text: String(word) }), h('button', {
        type: 'button', class: 'sa-small', text: 'Remove', 'aria-label': 'Remove ' + word,
        onclick: () => { form.set(path, words.filter((one, at) => at !== index)); form.commit(); draw(); },
      })));
    });
    if (words.length === 0) listBox.append(h('li', { class: 'sa-none', text: 'Nothing added.' }));
  };
  const add = () => {
    const text = input.value.trim();
    if (text === '') return;
    const words = Array.isArray(form.get(path)) ? form.get(path) : [];
    const value = field.of === 'number' ? Number(text) : text;
    const member = field.memberValidation;
    const bad = member ? problemWith({ title: field.title, widget: 'text', type: field.of, validation: member }, value, {}) : '';
    if (bad) { input.setCustomValidity(bad); input.reportValidity(); input.setCustomValidity(''); return; }
    form.set(path, words.concat([value]));
    form.commit();
    input.value = '';
    draw();
  };
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); add(); } });
  draw();
  holder.append(listBox, h('div', { class: 'sa-addrow' }, input, h('button', { type: 'button', class: 'sa-small', text: 'Add', onclick: add })));
  return holder;
}

function teamControl(field, form, path, id) {
  const name = nextId();
  const current = form.get(path);
  const picked = current && current._ref;
  const teams = form.teams.filter(team => team.active || team.id === picked);
  const list = [{ id: '', name: 'Both' }].concat(teams);
  const group = choiceElement({ name: name, id: id, labelledBy: id + '-t', items: list.map(team => ({ value: team.id, label: team.name, checked: team.id === '' ? !picked : team.id === picked })) });
  group.querySelectorAll('input').forEach((input, at) => {
    input.addEventListener('change', () => { form.set(path, list[at].id === '' ? undefined : { _type: 'reference', _ref: list[at].id }); form.commit(); });
  });
  return group;
}

// ----- a group and a list -----

function groupControl(field, form, path) {
  const box = h('div', { class: 'sa-inner' });
  field.fields.forEach(sub => box.append(fieldView(sub, form, path + '.' + sub.name, form.get(path) || {})));
  return box;
}

function listControl(field, form, path) {
  const box = h('div', { class: 'sa-items' });
  const items = Array.isArray(form.get(path)) ? form.get(path) : [];
  items.forEach((item, index) => {
    const member = field.members.length === 1 ? field.members[0] : field.members.filter(one => one.type === item._type)[0];
    const card = h('div', { class: 'sa-item', 'data-item': String(index) });
    const buttons = h('div', { class: 'sa-itembuttons' },
      h('button', { type: 'button', class: 'sa-small', text: 'Up', disabled: index === 0, 'aria-label': 'Move up', onclick: () => { form.set(path, move(items, index, -1)); form.commit(); form.redraw(); } }),
      h('button', { type: 'button', class: 'sa-small', text: 'Down', disabled: index === items.length - 1, 'aria-label': 'Move down', onclick: () => { form.set(path, move(items, index, 1)); form.commit(); form.redraw(); } }),
      h('button', { type: 'button', class: 'sa-small', text: 'Remove', onclick: () => { form.set(path, items.filter((one, at) => at !== index)); form.commit(); form.redraw(); } }));
    card.append(h('div', { class: 'sa-itemhead' }, h('strong', { text: itemLabel(field, item, index) }), buttons));
    if (member) member.fields.forEach(sub => card.append(fieldView(sub, form, path + '[' + index + '].' + sub.name, item)));
    else card.append(h('p', { class: 'sa-help', text: 'This kind of item is edited in the Studio.' }));
    box.append(card);
  });
  if (items.length === 0) box.append(h('p', { class: 'sa-none', text: 'Nothing here yet. Press the button below to add one.' }));
  const adds = field.members.filter(member => member.addable !== false);
  const most = field.validation && field.validation.max;
  if (adds.length > 0) {
    const row = h('div', { class: 'sa-addrow' });
    adds.forEach(member => row.append(h('button', {
      type: 'button', class: 'sa-small', disabled: most !== undefined && items.length >= most,
      text: field.members.length > 1 ? 'Add ' + member.title.toLowerCase() : 'Add an item',
      onclick: () => { form.set(path, items.concat([newItem(member)])); form.commit(); form.redraw(); },
    })));
    box.append(row);
  }
  return box;
}

// ----- one field -----

const controls = {
  switch: switchControl, number: numberControl, radio: radioControl, select: selectControl, text: textControl, textarea: textControl,
  color: colorControl, date: dateControl, datetime: dateControl, checks: checksControl, tags: tagsControl, team: teamControl,
};

// parent is the object this field sits in (the group or the list item), which a showWhen rule reads
export function fieldView(field, form, path, parent) {
  const id = nextId();
  let wrapper;
  if (field.readOnly) {
    wrapper = frame(field, form, path, h('p', { class: 'sa-readonly', text: String(form.get(path) === undefined ? '' : form.get(path)) || 'Not set' }), id, false);
  } else if (field.widget === 'group' || field.widget === 'list') {
    wrapper = frame(field, form, path, field.widget === 'group' ? groupControl(field, form, path) : listControl(field, form, path), id, true);
  } else {
    wrapper = frame(field, form, path, controls[field.widget](field, form, path, id), id, false);
    const title = wrapper.querySelector('.sa-title');
    if (['radio', 'checks', 'team'].includes(field.widget)) { title.id = id + '-t'; title.removeAttribute('for'); }
  }
  if (field.showWhen) {
    wrapper.dataset.showField = field.showWhen.field;
    wrapper.dataset.showValues = JSON.stringify(field.showWhen.values);
    wrapper.hidden = !visible(field, parent, form.docId);
  }
  problemLines(field, form, path, wrapper);
  return wrapper;
}

// Re-reads the problem lines of every field on the page after a change
export function refreshProblems(root, fieldAt, form) {
  root.querySelectorAll('.sa-field').forEach(wrapper => {
    const field = fieldAt(wrapper.dataset.path);
    if (field) problemLines(field, form, wrapper.dataset.path, wrapper);
  });
}
