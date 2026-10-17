// The Rotation page, the first line under SCREEN in the sidebar. It is a page of its own, not a document. It edits
// one field, rotationRows of Dashboard Settings, the list the wall plays top to bottom (schemas/settingsRotationRows.js),
// and writes only that field, to the draft of Dashboard Settings, the way the Themes page writes themeByWeekday.
// Publish all puts it on the screen.
//
// Each row has big buttons (44 pixels) instead of dragging, so it works on a phone. The details of a row that
// most rows do not use (department, part, small panel, photos) are behind More. A change to a row keeps every
// other value of the row, including the ones this page does not show.
//
// The pure functions at the top are tested with node (tests/rotation-page.test.mjs).
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useRef, useState } from 'react';
import { useClient } from 'sanity';
import { defaultRotationRows } from '../tools/default-rotation.js';
import { largePanels, mondayPanels, pairedPanels, panelTitle, placeholderPanels, rotationPanels, smallPanels } from './screen-panels.js';

const h = createElement;

const apiVersion = '2025-02-19';
const settingsId = 'dashboardSettings';
const draftId = 'drafts.dashboardSettings';

export const words = {
  title: 'Rotation',
  intro: 'The wall plays this list top to bottom. Drag a row to move it. Turn Shown off to skip a row. Seconds is how long it stays.',
  phone: 'On a phone, use the Up and Down buttons instead of dragging. A change is saved as a draft at once. Click Publish all in the top bar to put it on the screen.',
  reading: 'Reading Dashboard Settings.',
  notPublished: 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.',
  empty: 'The list is empty, so the wall plays the standard rotation. Start from it to change it.',
  start: 'Start from the standard rotation',
  saved: 'Saved as a draft. Click Publish all in the top bar.',
  problem: 'The change was not saved. ',
  secondsProblem: 'Use a whole number of seconds from 6 to 120, or leave it empty.',
  addTitle: 'Add a row',
  addHelp: 'The new row goes at the end. Move it up with the Up button.',
};

export const viewNames = [{ value: 'robotics', title: 'Robotics' }, { value: 'prime', title: 'Prime' }, { value: 'nova', title: 'Nova' }];

// The panels a row can name, in the order of the full form
export const panelChoices = largePanels.concat(rotationPanels, placeholderPanels, mondayPanels);
export const sideChoices = smallPanels.concat(pairedPanels);

// A key for a row that has none: letters and digits, like the keys Studio makes
export function newKey() {
  return Math.random().toString(16).slice(2, 14).padEnd(12, '0');
}

// Every row with a _key, the rows without one given a new key. The rows are copies.
export function withKeys(rows) {
  const seen = {};
  return (Array.isArray(rows) ? rows : []).filter(row => row && typeof row === 'object').map(row => {
    let key = typeof row._key === 'string' && row._key !== '' && !seen[row._key] ? row._key : newKey();
    while (seen[key]) key = newKey();
    seen[key] = true;
    return Object.assign({}, row, { _key: key });
  });
}

export function startingRows() {
  return withKeys(defaultRotationRows());
}

// The rows to show, from the documents found: the draft first, then the published one. null when neither exists.
export function rowsFrom(documents) {
  const found = Array.isArray(documents) ? documents : [];
  const draft = found.filter(doc => doc && doc._id === draftId)[0];
  const published = found.filter(doc => doc && doc._id === settingsId)[0];
  const source = draft || published;
  return source ? withKeys(source.rotationRows) : null;
}

// Moves the row at index up (delta -1) or down (1). Out of range gives the same rows.
export function moveRow(rows, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= rows.length || to < 0 || to >= rows.length) return rows;

  const next = rows.slice();
  const row = next.splice(index, 1)[0];
  next.splice(to, 0, row);
  return next;
}

// Changes one value of a row and keeps the rest. An empty value takes the field away.
export function setRowValue(rows, index, field, value) {
  if (index < 0 || index >= rows.length) return rows;

  const row = Object.assign({}, rows[index]);
  if (value === '' || value === undefined || value === null) delete row[field];
  else row[field] = value;
  const next = rows.slice();
  next[index] = row;
  return next;
}

// A copy of the row, with its own key, right under it
export function copyRow(rows, index) {
  if (index < 0 || index >= rows.length) return rows;

  const next = rows.slice();
  next.splice(index + 1, 0, Object.assign({}, rows[index], { _key: newKey() }));
  return next;
}

export function removeRow(rows, index) {
  if (index < 0 || index >= rows.length) return rows;
  return rows.filter((row, at) => at !== index);
}

export function addRow(rows, view, panel) {
  return rows.concat([{ _key: newKey(), view: view, panel: panel, shown: true }]);
}

// Seconds typed as text: a whole number from 6 to 120 as a number, empty as '' and anything else as null (a problem)
export function secondsFrom(text) {
  const trimmed = String(text === undefined || text === null ? '' : text).trim();
  if (trimmed === '') return '';
  if (!/^\d+$/.test(trimmed)) return null;

  const number = Number(trimmed);
  return number >= 6 && number <= 120 ? number : null;
}

// The words under the title of a row: what it does besides the panel
export function detailsOf(row) {
  const parts = [];
  if (row.department) parts.push('Department: ' + row.department);
  if (row.part) parts.push('Page ' + row.part);
  if (row.side) parts.push('With ' + (panelTitle(row.side) || row.side));
  if (row.photoCount) parts.push(row.photoCount + ' photos, ' + (row.secondsPerPhoto || 10) + ' seconds each');
  return parts.join(' · ');
}

export function viewTitleOf(view) {
  const found = viewNames.filter(item => item.value === view)[0];
  return found ? found.title : 'No view';
}

// Writes the rows to the draft of Dashboard Settings. The draft is made from the published document first when
// there is none, so the other fields are kept. It gives back a promise.
export async function saveRows(client, rows) {
  const published = await client.getDocument(settingsId);
  const draft = await client.getDocument(draftId);
  if (!draft && !published) throw new Error(words.notPublished);
  if (!draft) {
    const copy = Object.assign({}, published, { _id: draftId });
    ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
    await client.createIfNotExists(copy);
  }
  return client.patch(draftId).set({ rotationRows: rows }).commit();
}

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const control = { boxSizing: 'border-box', minHeight: 44, padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: border, borderRadius: 4, maxWidth: '100%' };

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 16px' },
  column: { maxWidth: 760, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  subheading: { fontSize: 16, fontWeight: 600, margin: '32px 0 8px' },
  text: { lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  muted: { color: muted, lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  failed: { color: 'var(--card-badge-critical-fg-color, #b91c1c)', lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  list: { listStyle: 'none', margin: '0 0 16px', padding: 0 },
  card: { boxSizing: 'border-box', margin: '0 0 8px', padding: '8px 12px', border: border, borderRadius: 4 },
  cardOff: { opacity: 0.6 },
  name: { fontWeight: 600, margin: 0, overflowWrap: 'anywhere' },
  details: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '2px 0 0', overflowWrap: 'anywhere' },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', margin: '8px 0 0' },
  field: { display: 'flex', alignItems: 'center', gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: 600 },
  select: control,
  number: Object.assign({}, control, { width: 96 }),
  text_: Object.assign({}, control, { width: '100%' }),
  check: { width: 24, height: 24 },
  button: Object.assign({}, control, { fontWeight: 600, background: primaryBackground, color: primaryText, cursor: 'pointer' }),
  plain: Object.assign({}, control, { fontWeight: 600, background: 'transparent', color: 'inherit', cursor: 'pointer' }),
  more: { display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0 0' },
};

function labelled(label, input) {
  return h('label', { style: styles.field }, h('span', { style: styles.fieldLabel }, label), input);
}

function optionsOf(choices, current, blank) {
  const list = choices.slice();
  if (current && !list.some(item => item.value === current)) {
    list.push({ value: current, title: panelTitle(current) || current });
  }
  const options = list.map(item => h('option', { key: item.value, value: item.value }, item.title));
  return blank ? [h('option', { key: '', value: '' }, blank)].concat(options) : options;
}

function moreFields(row, index, edit, busy) {
  const number = (field, label, min, max) =>
    labelled(label, h('input', {
      type: 'number', min: min, max: max, defaultValue: row[field] === undefined ? '' : row[field], disabled: busy, style: styles.number, 'aria-label': label,
      onBlur: event => edit(index, field, event.target.value === '' ? '' : Number(event.target.value)),
    }));

  return h(
    'div',
    { style: styles.more, 'data-more': row._key },
    labelled('Panel', h('select', { value: row.panel || '', disabled: busy, style: styles.select, 'aria-label': 'Panel', onChange: event => edit(index, 'panel', event.target.value) }, optionsOf(panelChoices, row.panel))),
    labelled('Department', h('input', { type: 'text', defaultValue: row.department || '', disabled: busy, style: styles.text_, 'aria-label': 'Department', placeholder: 'Empty plays every department', onBlur: event => edit(index, 'department', event.target.value.trim()) })),
    labelled('Page', h('select', { value: row.part ? String(row.part) : '', disabled: busy, style: styles.select, 'aria-label': 'Page', onChange: event => edit(index, 'part', event.target.value === '' ? '' : Number(event.target.value)) }, [h('option', { key: '', value: '' }, 'All pages'), h('option', { key: '1', value: '1' }, 'Page 1 only'), h('option', { key: '2', value: '2' }, 'Page 2 on')])),
    labelled('Small panel', h('select', { value: row.side || '', disabled: busy, style: styles.select, 'aria-label': 'Small panel', onChange: event => edit(index, 'side', event.target.value) }, optionsOf(sideChoices, row.side, 'The small panels of the view'))),
    number('photoCount', 'Photos', 1, 20),
    number('secondsPerPhoto', 'Seconds per photo', 5, 60)
  );
}

// One row of the list
export function rowCard(row, index, count, actions, state) {
  const busy = state.busy;
  const off = row.shown === false;
  const open = state.open === row._key;
  const details = detailsOf(row);

  const seconds = row.panel === 'photo' ? null : labelled('Seconds', h('input', {
    type: 'number', min: 6, max: 120, defaultValue: row.seconds === undefined ? '' : row.seconds, disabled: busy, style: styles.number, 'aria-label': 'Seconds', placeholder: 'Default',
    onBlur: event => actions.seconds(index, event.target.value),
  }));

  return h(
    'li',
    { key: row._key, style: Object.assign({}, styles.card, off ? styles.cardOff : {}), 'data-row': row._key },
    h('p', { style: styles.name }, (index + 1) + '. ' + (panelTitle(row.panel) || 'Panel not chosen') + (off ? ' (skipped)' : '')),
    details ? h('p', { style: styles.details }, details) : null,
    h(
      'div',
      { style: styles.controls },
      labelled('Shown', h('input', { type: 'checkbox', checked: !off, disabled: busy, style: styles.check, 'aria-label': 'Shown', onChange: event => actions.edit(index, 'shown', event.target.checked) })),
      labelled('View', h('select', { value: row.view || '', disabled: busy, style: styles.select, 'aria-label': 'View', onChange: event => actions.edit(index, 'view', event.target.value) }, optionsOf(viewNames.map(item => ({ value: item.value, title: item.title })), row.view))),
      seconds
    ),
    h(
      'div',
      { style: styles.controls },
      h('button', { type: 'button', style: styles.plain, disabled: busy || index === 0, 'aria-label': 'Move up', onClick: () => actions.move(index, -1) }, 'Up'),
      h('button', { type: 'button', style: styles.plain, disabled: busy || index === count - 1, 'aria-label': 'Move down', onClick: () => actions.move(index, 1) }, 'Down'),
      h('button', { type: 'button', style: styles.plain, disabled: busy, onClick: () => actions.copy(index) }, 'Copy'),
      h('button', { type: 'button', style: styles.plain, disabled: busy, 'aria-expanded': open, onClick: () => actions.toggle(row._key) }, open ? 'Less' : 'More'),
      h('button', { type: 'button', style: styles.plain, disabled: busy, onClick: () => actions.remove(index) }, 'Remove')
    ),
    open ? moreFields(row, index, actions.edit, busy) : null
  );
}

function addForm(state, actions) {
  return h(
    'div',
    { 'data-block': 'add' },
    h('h2', { style: styles.subheading }, words.addTitle),
    h('p', { style: styles.muted }, words.addHelp),
    h(
      'div',
      { style: styles.controls },
      labelled('View', h('select', { value: state.newView, style: styles.select, 'aria-label': 'View of the new row', onChange: event => actions.pick('newView', event.target.value) }, viewNames.map(item => h('option', { key: item.value, value: item.value }, item.title)))),
      labelled('Panel', h('select', { value: state.newPanel, style: styles.select, 'aria-label': 'Panel of the new row', onChange: event => actions.pick('newPanel', event.target.value) }, panelChoices.map(item => h('option', { key: item.value, value: item.value }, item.title)))),
      h('button', { type: 'button', style: styles.button, disabled: state.busy, onClick: () => actions.add() }, 'Add row')
    )
  );
}

// The page for what it knows: rows is null while reading or when there is no Dashboard Settings
export function pageOf(state, actions) {
  let body;

  if (!state.read) body = h('p', { style: styles.muted }, words.reading);
  else if (!state.rows) body = h('p', { style: styles.failed, role: 'alert' }, words.notPublished);
  else if (state.rows.length === 0) {
    body = h('div', { 'data-block': 'empty' }, h('p', { style: styles.text }, words.empty), h('button', { type: 'button', style: styles.button, disabled: state.busy, onClick: () => actions.start() }, words.start));
  } else {
    body = h(
      'div',
      { 'data-block': 'rows' },
      h('ol', { style: styles.list }, state.rows.map((row, index) => rowCard(row, index, state.rows.length, actions, state))),
      addForm(state, actions)
    );
  }

  return h(
    'div',
    { style: styles.page },
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, words.title),
      h('p', { style: styles.text }, words.intro),
      h('p', { style: styles.muted }, words.phone),
      body,
      state.text ? h('p', { role: state.failed ? 'alert' : undefined, 'aria-live': 'polite', style: state.failed ? styles.failed : styles.muted }, state.text) : null
    )
  );
}

const question = '*[_id in [$draft, $published]]{ _id, _type, rotationRows }';

export function RotationView() {
  const client = useClient({ apiVersion: apiVersion });
  const [state, setState] = useState({ read: false, rows: null, busy: false, text: '', failed: false, open: '', newView: 'robotics', newPanel: largePanels[0].value });
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    let stopped = false;

    Promise.resolve()
      .then(() => client.fetch(question, { draft: draftId, published: settingsId }, { perspective: 'raw' }))
      .then(found => {
        if (!stopped) setState(Object.assign({}, latest.current, { read: true, rows: rowsFrom(found) }));
      })
      .catch(() => {
        if (!stopped) setState(Object.assign({}, latest.current, { read: true, rows: null }));
      });
    return () => {
      stopped = true;
    };
  }, []);

  // Shows the new rows at once, writes them, and says how it went
  function change(rows, extra) {
    const before = latest.current;
    setState(Object.assign({}, before, extra || {}, { rows: rows, busy: true, text: '', failed: false }));

    return saveRows(client, rows)
      .then(() => setState(Object.assign({}, latest.current, { rows: rows, busy: false, text: words.saved, failed: false })))
      .catch(error => setState(Object.assign({}, latest.current, { rows: before.rows, busy: false, text: words.problem + (error && error.message ? error.message : ''), failed: true })));
  }

  const actions = {
    edit: (index, field, value) => change(setRowValue(latest.current.rows, index, field, value)),
    seconds: (index, text) => {
      const seconds = secondsFrom(text);
      if (seconds === null) return setState(Object.assign({}, latest.current, { text: words.secondsProblem, failed: true }));
      return change(setRowValue(latest.current.rows, index, 'seconds', seconds));
    },
    move: (index, delta) => change(moveRow(latest.current.rows, index, delta)),
    copy: index => change(copyRow(latest.current.rows, index)),
    remove: index => change(removeRow(latest.current.rows, index)),
    toggle: key => setState(Object.assign({}, latest.current, { open: latest.current.open === key ? '' : key })),
    pick: (name, value) => setState(Object.assign({}, latest.current, { [name]: value })),
    add: () => change(addRow(latest.current.rows, latest.current.newView, latest.current.newPanel)),
    start: () => change(startingRows()),
  };

  return pageOf(state, actions);
}
