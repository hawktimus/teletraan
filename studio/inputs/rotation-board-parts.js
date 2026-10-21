// The drawing of the Rotation board (part of rotation-board-view.js): the style sheet, the header, a group, a row, the row
// editor, the preview strip and the tools above the table. Each function gets what it draws and the actions to call, and
// returns elements, so tests/rotation-board.test.mjs can draw them with node.
//
// It is written without JSX, so it reads as plain JavaScript: h(tag, props, ...children) is React's createElement.

import { createElement } from 'react';
import {
  blocksOf, condensedWords, detailsFor, detailsSummary, durationWords, hasSmallPanel, isRetiredRow, isShown, loopWords, missingCharts, missingDepartments, playsCondensed, qrStatus, retiredNote, secondsOf, skipHint, stripOf,
} from '../tools/rotation-board.js';
import { blockId, filterBlocks, findingWords, hasFilter, jumpLinks, placeholderBadge, playsNowWords } from '../tools/rotation-find.js';
import { panelChoices, panelGroups, panelTitleOf, sideChoices, sidePanelGroups, viewEntry, viewTable } from '../tools/rotation-titles.js';

const h = createElement;

export const words = {
  title: 'Rotation',
  intro: 'The wall plays this list top to bottom. Drag a row to move it. Turn Show on screen off to skip a row. Seconds is how long it stays.',
  phone: 'On a phone, use the Up and Down buttons instead of dragging. A change is saved as a draft at once. Click Publish all in the top bar to put it on the screen.',
  reading: 'Reading Dashboard Settings.',
  empty: 'The list is empty, so the wall plays the standard order. Fill the list from it to change it.',
  saved: 'Saved as a draft. Click Publish all in the top bar.',
  problem: 'The change was not saved. ',
  secondsProblem: 'Use a whole number of seconds from 6 to 120, or leave it empty.',
  numberProblem: 'Use a whole number inside the range shown under the box.',
  confirmFill: 'Replace the whole list with the standard order? The rows you have now are replaced. Undo brings them back.',
  confirmDelete: 'Delete this row? Undo brings it back.',
  confirmDeleteMany: 'Delete the selected rows? Undo brings them back.',
  strip: 'What the wall plays',
  stripHelp: 'The rows in order. A grey tile is a row that is switched off and is skipped. A view change is where the wall swaps view.',
  skipped: 'skipped',
  viewChange: 'view change',
  skipHint: skipHint,
  small: 'Small panel',
  now: 'What the wall plays now.',
  smallHelp: 'The small panel beside a Robotics row in the split layout. Empty follows the small panels of the view.',
};

// The layout is classes, because a media query cannot sit in an inline style. Under 600 pixels the table is cards.
export const boardCss = `
.rb-wrap { overflow-x: auto; max-width: 100%; }
.rb-table { min-width: 960px; border: 1px solid var(--card-border-color, rgba(128, 128, 128, 0.4)); border-radius: 4px; }
.rb-line { display: grid; grid-template-columns: 36px 40px 40px 132px minmax(190px, 1fr) minmax(160px, 210px) 92px 88px 112px 168px; gap: 0 8px; align-items: center; padding: 4px 8px; border-top: 1px solid var(--card-border-color, rgba(128, 128, 128, 0.25)); }
.rb-head { font-weight: 600; font-size: 14px; border-top: 0; min-height: 44px; }
.rb-group { background: var(--rb-tint); border-left: 6px solid var(--rb-colour); min-height: 52px; }
.rb-group-name { grid-column: 3 / 9; font-weight: 600; overflow-wrap: anywhere; }
.rb-group-count { grid-column: 9 / 11; font-size: 14px; overflow-wrap: anywhere; }
.rb-row { border-left: 6px solid var(--rb-colour); }
.rb-row.rb-off { opacity: 0.6; }
.rb-cell { min-width: 0; overflow-wrap: anywhere; }
.rb-cell:empty { display: block; }
.rb-handle { cursor: grab; text-align: center; user-select: none; min-height: 44px; display: flex; align-items: center; justify-content: center; }
.rb-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.rb-editor { padding: 8px 16px 16px; border-top: 1px dashed var(--card-border-color, rgba(128, 128, 128, 0.4)); border-left: 6px solid var(--rb-colour); display: flex; flex-direction: column; gap: 12px; }
.rb-field { display: flex; flex-direction: column; gap: 2px; max-width: 480px; }
.rb-field label { font-weight: 600; font-size: 14px; }
.rb-help { font-size: 14px; line-height: 1.4; opacity: 0.8; overflow-wrap: anywhere; }
.rb-switch { box-sizing: border-box; width: 56px; min-height: 44px; border: 0; background: transparent; padding: 0; cursor: pointer; display: flex; align-items: center; }
.rb-track { display: block; width: 48px; height: 26px; border-radius: 13px; background: #9ca3af; position: relative; }
.rb-switch[aria-checked="true"] .rb-track { background: #16a34a; }
.rb-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 10px; background: #ffffff; }
.rb-switch[aria-checked="true"] .rb-knob { left: 25px; }
.rb-tools { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin: 0 0 16px; }
.rb-bulk { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin: 0 0 16px; padding: 8px 12px; border: 1px solid var(--card-border-color, rgba(128, 128, 128, 0.4)); border-radius: 4px; }
.rb-strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: stretch; margin: 0 0 16px; }
.rb-tile { box-sizing: border-box; border: 1px solid var(--card-border-color, rgba(128, 128, 128, 0.4)); border-top: 6px solid var(--rb-colour); border-radius: 4px; padding: 4px 8px; max-width: 100%; font-size: 14px; line-height: 1.3; }
.rb-tile.rb-off { opacity: 0.45; border-style: dashed; border-top-style: solid; }
.rb-tile b { display: block; overflow-wrap: anywhere; }
.rb-change { align-self: center; font-size: 14px; font-weight: 600; padding: 4px 8px; border-radius: 4px; border: 1px dashed currentColor; }
.rb-label { display: none; }
.rb-badge { display: inline-block; align-self: flex-start; font-size: 14px; font-weight: 600; padding: 2px 8px; border-radius: 4px; border: 1px dashed currentColor; overflow-wrap: anywhere; }
.rb-check { display: inline-flex; align-items: center; min-height: 44px; gap: 4px; }
@media (max-width: 600px) {
  .rb-wrap { overflow-x: visible; }
  .rb-table { min-width: 0; border: 0; }
  .rb-head { display: none; }
  .rb-line { display: flex; flex-direction: column; align-items: stretch; gap: 8px; padding: 12px; margin: 0 0 12px; border: 1px solid var(--card-border-color, rgba(128, 128, 128, 0.4)); }
  .rb-group { flex-direction: column; }
  .rb-handle { display: none; }
  .rb-cell:empty { display: none; }
  .rb-label { display: block; font-size: 14px; font-weight: 600; }
  .rb-actions button { flex: 1 1 44px; }
  .rb-editor { margin: -12px 0 12px; }
  .rb-field { max-width: 100%; }
}
`;

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const control = { boxSizing: 'border-box', minHeight: 44, padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: border, borderRadius: 4, maxWidth: '100%' };

export const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 16px' },
  column: { maxWidth: 1180, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  subheading: { fontSize: 16, fontWeight: 600, margin: '32px 0 8px' },
  text: { lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  muted: { color: muted, lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  failed: { color: 'var(--card-badge-critical-fg-color, #b91c1c)', lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  select: Object.assign({}, control, { width: '100%' }),
  number: Object.assign({}, control, { width: '100%' }),
  textBox: Object.assign({}, control, { width: '100%' }),
  button: Object.assign({}, control, { fontWeight: 600, background: primaryBackground, color: primaryText, cursor: 'pointer' }),
  plain: Object.assign({}, control, { fontWeight: 600, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: '4px 8px' }),
  check: { width: 24, height: 24, margin: 10 },
};

function colourVars(view) {
  const entry = viewEntry(view);
  return { '--rb-colour': entry.colour, '--rb-tint': entry.tint };
}

function groupedOptions(groups, current, blank) {
  const known = groups.reduce((all, group) => all.concat(group.panels), []);
  const out = blank ? [h('option', { key: '', value: '' }, blank)] : [];
  if (current && !known.some(item => item.value === current)) out.push(h('option', { key: current, value: current }, panelTitleOf(current) || current));
  groups.forEach(group => out.push(h('optgroup', { key: group.title, label: group.title }, group.panels.map(item => h('option', { key: item.value, value: item.value }, item.title)))));
  return out;
}

function viewOptions(current) {
  const list = viewTable.map(item => h('option', { key: item.value, value: item.value }, item.title));
  return current && !viewTable.some(item => item.value === current) ? [h('option', { key: current, value: current }, viewEntry(current).title)].concat(list) : list;
}

function cell(label, name, ...children) {
  return h('div', { className: 'rb-cell', role: 'cell', 'data-cell': name }, children.length > 0 && children[0] !== null ? h('span', { className: 'rb-label' }, label) : null, ...children);
}

export function headerRow(state, actions) {
  const rows = state.rows;
  const all = rows.length > 0 && rows.every(row => state.selected[row._key]);
  const names = ['', null, '#', 'View', 'Panel', words.small, 'Seconds', 'Show on screen', 'Details', ''];
  return h(
    'div',
    { className: 'rb-line rb-head', role: 'row', 'data-block': 'header' },
    names.map((name, at) => h('div', { key: at, role: 'columnheader' }, name === null
      ? h('input', { type: 'checkbox', checked: all, style: styles.check, 'aria-label': 'Select every row', onChange: event => actions.selectAll(event.target.checked) })
      : name))
  );
}

export function groupRow(block, state, actions) {
  const closed = Boolean(state.collapsed[block.key]);
  const keys = block.rows.map(item => item.row._key);
  const every = keys.every(key => state.selected[key]);
  const title = viewEntry(block.view).title;
  const count = block.count + (block.count === 1 ? ' row' : ' rows') + (block.shown < block.count ? ', ' + block.shown + ' shown' : '');

  return h(
    'div',
    { className: 'rb-line rb-group', role: 'row', style: colourVars(block.view), 'data-group': block.key, 'data-view': block.view },
    h('button', { type: 'button', style: styles.plain, 'aria-expanded': !closed, 'aria-label': (closed ? 'Open ' : 'Close ') + title + ' block', onClick: () => actions.toggleGroup(block.key) }, closed ? 'Open' : 'Close'),
    h('input', { type: 'checkbox', checked: every, style: styles.check, 'aria-label': 'Select the ' + title + ' block', onChange: event => actions.selectMany(keys, event.target.checked) }),
    h('div', { className: 'rb-group-name' }, title),
    h('div', { className: 'rb-group-count' }, count + ', ' + durationWords(block.seconds))
  );
}

function switchOf(row, index, state, actions) {
  const on = isShown(row);
  return h(
    'button',
    { type: 'button', role: 'switch', className: 'rb-switch', 'aria-checked': on, 'aria-label': 'Show on screen', disabled: state.busy, onClick: () => actions.edit(index, 'shown', !on) },
    h('span', { className: 'rb-track' }, h('span', { className: 'rb-knob' }))
  );
}

function secondsCell(row, index, state, actions) {
  if (row.panel === 'photo') return h('span', { 'data-computed': 'photo' }, secondsOf(row, state.settings.pageSeconds) + ' s from photos');
  return h('input', {
    key: row._key + ':' + (row.seconds === undefined ? '' : row.seconds), type: 'number', min: 6, max: 120, defaultValue: row.seconds === undefined ? '' : row.seconds, style: styles.number, 'aria-label': 'Seconds',
    placeholder: String(state.settings.pageSeconds), onBlur: event => actions.seconds(index, event.target.value),
  });
}

export function dataRow(item, count, state, actions) {
  const row = item.row;
  const index = item.index;
  const busy = state.busy;
  const open = state.open === row._key;
  const summary = detailsSummary(row);
  const small = hasSmallPanel(row);

  return h(
    'div',
    { key: row._key, role: 'presentation' },
    h(
      'div',
      { className: 'rb-line rb-row' + (isShown(row) ? '' : ' rb-off'), role: 'row', style: colourVars(row.view), 'data-row': row._key, onDragOver: event => event.preventDefault(), onDrop: event => { event.preventDefault(); actions.drop(index); } },
      h('div', { className: 'rb-cell rb-handle', role: 'cell', draggable: true, 'aria-label': 'Drag to move', title: 'Drag to move', onDragStart: event => actions.dragStart(index, event) }, '::'),
      h('div', { className: 'rb-cell', role: 'cell' }, h('input', { type: 'checkbox', checked: Boolean(state.selected[row._key]), style: styles.check, 'aria-label': 'Select row ' + (index + 1), onChange: event => actions.select(row._key, event.target.checked) })),
      cell('Position', 'number', String(index + 1)),
      cell('View', 'view', h('select', { value: row.view || '', style: styles.select, 'aria-label': 'View', onChange: event => actions.edit(index, 'view', event.target.value) }, viewOptions(row.view))),
      cell('Panel', 'panel', h('select', { value: row.panel || '', style: styles.select, 'aria-label': 'Panel', onChange: event => actions.panel(index, event.target.value) }, groupedOptions(panelGroups, row.panel)),
        state.skips && state.skips[row._key] ? h('span', { className: 'rb-help', 'data-skip': row._key }, state.skips[row._key]) : null,
        retiredNote(row) && !(state.skips && state.skips[row._key] === retiredNote(row)) ? h('span', { className: 'rb-help', 'data-retired': row._key }, retiredNote(row)) : null,
        placeholderBadge(row) ? h('span', { className: 'rb-badge', 'data-placeholder': row._key }, placeholderBadge(row)) : null),
      small
        ? cell(words.small, 'small', h('select', { value: row.side || '', style: styles.select, 'aria-label': words.small, onChange: event => actions.edit(index, 'side', event.target.value) }, groupedOptions(sidePanelGroups, row.side, 'Follows the view')))
        : h('div', { className: 'rb-cell', role: 'cell', 'data-cell': 'small' }, ...(playsCondensed(row) ? [h('span', { className: 'rb-help', 'data-condensed': row._key }, condensedWords)] : [])),
      cell('Seconds', 'seconds', secondsCell(row, index, state, actions)),
      cell('Show on screen', 'shown', switchOf(row, index, state, actions)),
      cell('Details', 'details', h('button', { type: 'button', style: styles.plain, 'aria-expanded': open, onClick: () => actions.toggleOpen(row._key) }, open ? 'Close' : (summary || 'Details'))),
      h(
        'div',
        { className: 'rb-cell rb-actions', role: 'cell' },
        h('button', { type: 'button', style: styles.plain, disabled: busy || index === 0, 'aria-label': 'Move up', onClick: () => actions.move(index, -1) }, 'Up'),
        h('button', { type: 'button', style: styles.plain, disabled: busy || index === count - 1, 'aria-label': 'Move down', onClick: () => actions.move(index, 1) }, 'Down'),
        h('button', { type: 'button', style: styles.plain, disabled: busy, 'aria-label': 'Duplicate row', onClick: () => actions.copy(index) }, 'Copy'),
        h('button', { type: 'button', style: styles.plain, disabled: busy, 'aria-label': 'Delete row', onClick: () => actions.remove(index) }, 'Delete')
      )
    ),
    open ? editorOf(row, index, state, actions) : null
  );
}

// The Details panel of a row: the fields its panel needs
export function editorOf(row, index, state, actions) {
  const fields = detailsFor(row);
  const entries = fields.map(item => {
    let input;
    if (item.kind === 'number') {
      const value = row[item.field] === undefined ? '' : row[item.field];
      input = h('input', { key: row._key + item.field + value, id: 'rb-' + item.field, type: 'number', min: item.min, max: item.max, defaultValue: value, style: styles.number, onBlur: event => actions.photo(index, item.field, event.target.value, item) });
    } else if (item.kind === 'text') {
      input = h('input', { key: row._key + item.field + (row[item.field] || ''), id: 'rb-' + item.field, type: 'text', list: 'rb-departments', defaultValue: row[item.field] || '', style: styles.textBox, placeholder: 'Every department', onBlur: event => actions.edit(index, item.field, event.target.value.trim()) });
    } else if (item.kind === 'choice') {
      const current = row[item.field] === undefined ? (item.field === 'list' ? 'open' : item.field === 'chart' ? 'status' : '') : String(row[item.field]);
      input = h('select', { id: 'rb-' + item.field, value: current, style: styles.select, onChange: event => actions.edit(index, item.field, event.target.value) },
        item.choices.map(choice => h('option', { key: choice.value, value: choice.value }, choice.title)));
    } else if (item.kind === 'part') {
      input = h('select', { id: 'rb-' + item.field, value: row.part ? String(row.part) : '', style: styles.select, onChange: event => actions.edit(index, 'part', event.target.value === '' ? '' : Number(event.target.value)) },
        [h('option', { key: '', value: '' }, 'All pages'), h('option', { key: '1', value: '1' }, 'Page 1 only'), h('option', { key: '2', value: '2' }, 'Page 2 on')]);
    } else if (item.kind === 'team') {
      input = h('p', { style: { margin: 0 }, 'data-team': row.view || '' }, viewEntry(row.view).title);
    } else {
      input = h('p', { style: { margin: 0 }, 'data-link': state.settings.partsLink ? 'set' : 'missing' }, qrStatus(state.settings.partsLink));
    }
    return h('div', { className: 'rb-field', key: item.field + item.kind, 'data-field': item.field }, h('label', { htmlFor: 'rb-' + item.field }, item.label), input, h('span', { className: 'rb-help' }, item.help));
  });
  const nothing = entries.length === 0 ? [h('p', { key: 'none', className: 'rb-help' }, 'This panel has no more settings. Seconds is set in the table.')] : [];

  return h('div', { className: 'rb-editor', role: 'group', 'aria-label': 'Details of row ' + (index + 1), 'data-editor': row._key }, ...entries, ...nothing);
}

// Above the table: a search over panel titles, two filters and a Jump to link for each block
export function findBar(state, actions, blocks) {
  return h(
    'div',
    { 'data-block': 'find' },
    h(
      'div',
      { className: 'rb-tools' },
      h('input', { type: 'search', value: state.search || '', style: Object.assign({}, styles.textBox, { width: 260 }), placeholder: 'Search panel titles', 'aria-label': 'Search panel titles', onChange: event => actions.pick('search', event.target.value) }),
      h('label', { className: 'rb-check' }, h('input', { type: 'checkbox', checked: Boolean(state.onlySkipped), style: styles.check, onChange: event => actions.pick('onlySkipped', event.target.checked) }), 'Show only rows that are skipped now'),
      h('label', { className: 'rb-check' }, h('input', { type: 'checkbox', checked: Boolean(state.onlyPlaceholders), style: styles.check, onChange: event => actions.pick('onlyPlaceholders', event.target.checked) }), 'Show only placeholders')
    ),
    h('p', { style: styles.muted, 'data-find': 'help' }, 'Skipped now means switched off, or on with nothing to show. A placeholder only draws a title until it is designed, such as Robot status.'),
    h(
      'div',
      { className: 'rb-tools', 'data-find': 'jump', role: 'navigation', 'aria-label': 'Jump to a block' },
      h('span', { style: { fontWeight: 600 } }, 'Jump to'),
      jumpLinks(blocks).map(link => h('button', { key: link.key, type: 'button', style: styles.plain, onClick: () => actions.jump(link.key) }, link.label))
    )
  );
}

export function tableOf(state, actions) {
  const all = blocksOf(state.rows, state.settings.pageSeconds);
  const filters = { onlySkipped: state.onlySkipped, onlyPlaceholders: state.onlyPlaceholders, search: state.search };
  const blocks = filterBlocks(all, filters, state.skips);
  const body = [];
  blocks.forEach(block => {
    body.push(h('div', { key: 'g' + block.key, id: blockId(block.key), role: 'presentation' }, groupRow(block, state, actions)));
    if (!state.collapsed[block.key]) block.rows.forEach(item => body.push(dataRow(item, state.rows.length, state, actions)));
  });
  const shownCount = blocks.reduce((total, block) => total + block.rows.length, 0);
  return h(
    'div',
    { className: 'rb-wrap' },
    findBar(state, actions, all),
    hasFilter(filters) ? h('p', { style: styles.muted, 'data-finding': 'count' }, findingWords(shownCount, state.rows.length)) : null,
    h('div', { className: 'rb-table', role: 'table', 'aria-label': 'Rotation' }, headerRow(state, actions), ...body),
    h('datalist', { id: 'rb-departments' }, ['build', 'electrical', 'programming', 'design', 'strategy', 'business', 'operations', 'marketing'].map(name => h('option', { key: name, value: name })))
  );
}

export function stripOfPage(state) {
  const items = stripOf(state.rows, state.settings.pageSeconds);
  return h(
    'div',
    { 'data-block': 'strip' },
    h('h2', { style: styles.subheading }, words.strip),
    h('p', { style: styles.text, 'data-loop': 'time' }, loopWords(state.rows, state.settings.pageSeconds)),
    h('p', { style: styles.muted }, words.stripHelp),
    h('div', { className: 'rb-strip', role: 'list' }, items.map(item => (item.type === 'change'
      ? h('div', { key: item.key, className: 'rb-change', role: 'listitem', 'data-change': item.key }, words.viewChange)
      : h('div', { key: item.key, className: 'rb-tile' + (item.shown ? '' : ' rb-off'), role: 'listitem', style: colourVars(item.view), 'data-tile': item.key }, h('b', null, item.title), item.shown ? item.seconds + ' s' : words.skipped))))
  );
}

export function toolsOf(state, actions) {
  const selected = Object.keys(state.selected).filter(key => state.selected[key]);
  const busy = state.busy;
  const tools = h(
    'div',
    { className: 'rb-tools', 'data-block': 'add' },
    h('select', { value: state.newView, style: Object.assign({}, styles.select, { width: 'auto' }), 'aria-label': 'View of the new row', onChange: event => actions.pick('newView', event.target.value) }, viewTable.map(item => h('option', { key: item.value, value: item.value }, item.title))),
    h('select', { value: state.newPanel, style: Object.assign({}, styles.select, { width: 'auto' }), 'aria-label': 'Panel of the new row', onChange: event => actions.pick('newPanel', event.target.value) }, groupedOptions(panelGroups, state.newPanel)),
    h('button', { type: 'button', style: styles.button, disabled: busy, onClick: () => actions.add() }, 'Add row'),
    h('button', { type: 'button', style: styles.plain, disabled: busy || state.history.length === 0, onClick: () => actions.undo() }, 'Undo'),
    h('button', { type: 'button', style: styles.plain, disabled: busy, onClick: () => actions.fill() }, 'Fill from the standard order')
  );
  const old = state.rows.filter(isRetiredRow).length;
  const departments = missingDepartments(state.rows).length;
  const charts = missingCharts(state.rows).length;
  const monday = old + departments + charts === 0 ? null : h(
    'div',
    { className: 'rb-tools', 'data-block': 'monday-rows' },
    old === 0 ? null : h('button', { type: 'button', style: styles.button, disabled: busy, onClick: () => actions.removeRetired() }, 'Remove retired Monday rows (' + old + ')'),
    departments === 0 ? null : h('button', { type: 'button', style: styles.plain, disabled: busy, onClick: () => actions.addDepartments() }, 'Add the ' + (departments === 9 ? 'nine' : departments + ' missing') + ' Department tasks rows (Robotics, Open)'),
    charts === 0 ? null : h('button', { type: 'button', style: styles.plain, disabled: busy, onClick: () => actions.addCharts() }, 'Add the ' + (charts === 3 ? 'three' : charts + ' missing') + ' TV charts rows')
  );
  const bulk = selected.length === 0 ? null : h(
    'div',
    { className: 'rb-bulk', 'data-block': 'bulk' },
    h('span', null, selected.length + (selected.length === 1 ? ' row selected' : ' rows selected')),
    h('button', { type: 'button', style: styles.plain, disabled: busy, onClick: () => actions.showSelected(true) }, 'Show on screen'),
    h('button', { type: 'button', style: styles.plain, disabled: busy, onClick: () => actions.showSelected(false) }, 'Hide'),
    h('button', { type: 'button', style: styles.plain, disabled: busy, onClick: () => actions.removeSelected() }, 'Delete selected'),
    h('button', { type: 'button', style: styles.plain, onClick: () => actions.selectAll(false) }, 'Clear selection')
  );
  return [tools, monday, bulk];
}

export { panelChoices, sideChoices };

// The line at the top of the page, from the published tasks and photos the board has read
export function nowLine(state) {
  return h('p', { style: styles.text, 'data-block': 'plays-now' }, h('b', null, words.now + ' '), playsNowWords(state.rows, state.skips, Boolean(state.data)));
}
