// The text of the Display tab as HTML strings. They take the answer of GET /control/api/display and the state of the page,
// and give markup with every value escaped. display.js puts the markup in the page and wires the buttons. Nothing here
// touches the page, so tests/control-display-page.test.mjs can try it with node.

import { blocksOf, condensedWords, countWhere, durationWords, isNovaRow, isShown, mondayFieldsOf, playsCondensed, quickAction, quickPanels, loopSeconds, photoRange, secondsOf, viewWords } from '../display-rows.js';
import { agoText, esc } from './render.js';
import { thumbHtml } from './display-preview-parts.js';

const stateWords = { show: 'Will show', skip: 'Skipped', off: 'Off', unknown: 'Not known' };
const dayWords = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };

// The title of every panel in the choices, by id
export function titlesOf(choices) {
  const titles = {};
  [].concat(choices.panelGroups || [], choices.sideGroups || []).forEach(group => group.panels.forEach(panel => { titles[panel.value] = panel.title; }));
  return titles;
}

function options(list, selected) {
  return list.map(item => '<option value="' + esc(item.value) + '"' + (item.value === selected ? ' selected' : '') + '>' + esc(item.title) + '</option>').join('');
}

function panelOptions(choices, selected) {
  const known = titlesOf(choices)[selected] !== undefined;
  const groups = choices.panelGroups.map(group => '<optgroup label="' + esc(group.title) + '">' + options(group.panels, selected) + '</optgroup>').join('');
  // A panel the pickers no longer offer is kept in the list as it is, so opening the tab never changes a row
  return (known || !selected ? '' : '<option value="' + esc(selected) + '" selected>' + esc(selected) + ' (older panel)</option>') + groups;
}

// The line under the buttons: how many rows play, are skipped and are off, and how long a loop is
export function summaryWords(rows, checks, pageSeconds) {
  const counts = { show: 0, skip: 0, off: 0, unknown: 0 };
  rows.forEach(row => {
    const check = checks[row._key];
    counts[check ? check.state : isShown(row) ? 'unknown' : 'off'] += 1;
  });
  if (counts.unknown === rows.length && rows.length > 0) return rows.length + ' rows. The wall check is not available right now.';

  const parts = [counts.show + ' shown', counts.skip + ' skipped'];
  if (counts.unknown > 0) parts.push(counts.unknown + ' not known');
  parts.push(counts.off + ' switched off');
  const shownRows = rows.filter(isShown);
  return 'Right now the loop has ' + parts.join(', ') + '. ' +
    (shownRows.length === 0 ? 'No row is shown, so the wall plays the standard order.' : 'A full loop takes ' + durationWords(loopSeconds(rows, pageSeconds)) + ', counting every row that is on.');
}

// What the page says about where its copy came from and whether the Studio has moved on
export function sourceHtml(page) {
  const lines = [];
  if (!page.hasDocument) lines.push('<p class="warn">Dashboard Settings has not been published yet. Open it in the Studio, click Publish once, and come back.</p>');
  else lines.push('<p>' + (page.isDraft ? 'Showing the draft of Dashboard Settings. ' + (page.studioNewer ? 'It has changes that are not on the wall yet.' : 'It is the same as the wall.') : 'Showing the published list. There is no draft.') + ' Loaded ' + esc(agoText(page.loadedAt)) + '.</p>');
  if (page.newerInStudio) lines.push('<p class="warn" data-newer>The Studio copy is newer than what you loaded. Press Refresh from Sanity to see it. Changes you have not saved here will be dropped.</p>');
  if (!page.canWrite) lines.push('<p class="warn">SANITY_WRITE_TOKEN is not set on the Teletraan computer, so this tab can read but not save. Add it in Settings, Keys.</p>');
  return lines.join('');
}

// The buttons. Publish waits until the draft is saved here, because it publishes the whole draft.
export function controlsHtml(page) {
  const dirty = page.dirty;
  const canPublish = page.canWrite && page.isDraft && !dirty;
  return '<div class="buttons">' +
    '<button type="button" class="act" data-action="save"' + (page.canWrite && dirty ? '' : ' disabled') + '>Save to draft</button>' +
    '<button type="button" class="act" data-action="publish"' + (canPublish ? '' : ' disabled') + '>Publish to the wall</button>' +
    '<button type="button" class="act quiet" data-action="refresh">Refresh from Sanity</button>' +
    '<button type="button" class="act quiet" data-action="undo"' + (page.canUndo ? '' : ' disabled') + '>Undo</button>' +
    '</div>' +
    '<p class="note" data-state="' + (dirty ? 'wait' : 'done') + '">' + (dirty ? 'You have changes that are not saved.' : page.isDraft && page.studioNewer ? 'Saved as a draft. Publish puts every waiting change of Dashboard Settings on the wall, including edits made in the Studio.' : 'Nothing waiting.') + '</p>';
}

// The question asked before a newer Studio edit is overwritten, or before a draft that moved is published
export function conflictHtml(conflict) {
  if (!conflict) return '';
  const when = conflict.updatedAt ? ' It was last changed ' + esc(agoText(conflict.updatedAt)) + '.' : '';
  const save = conflict.action === 'publish';
  return '<section class="card" data-conflict role="alert"><h2>The Studio has a newer copy</h2>' +
    '<p>' + esc(conflict.error) + when + ' ' + (save ? 'Publishing now puts that newer draft on the wall.' : 'Saving now replaces what you changed here, the rows or the theme settings, in the Studio draft. Anything else in Dashboard Settings stays as the Studio has it.') + '</p>' +
    '<div class="buttons">' +
    '<button type="button" class="act" data-action="overwrite">' + (save ? 'Publish the newer draft' : 'Replace the Studio copy') + '</button>' +
    '<button type="button" class="act quiet" data-action="refresh">Refresh from Sanity and drop my changes</button>' +
    '<button type="button" class="act quiet" data-action="keep-editing">Keep editing</button>' +
    '</div></section>';
}

// ----- the rows -----

function field(label, inner) {
  return '<label class="pick"><span>' + esc(label) + '</span>' + inner + '</label>';
}

function detailsWords(row, titles) {
  const words = [];
  if (row.department && row.panel !== 'monday-department') words.push('Department: ' + row.department);
  if (row.part) words.push('Page ' + row.part);
  if (playsCondensed(row)) words.push(condensedWords);
  else if (row.side) words.push('Small panel: ' + (titles[row.side] || row.side));
  return words.join('. ');
}

export function chipHtml(check, row) {
  const state = check ? check.state : isShown(row) ? 'unknown' : 'off';
  return '<span class="chip" data-state="' + esc(state) + '">' + esc(stateWords[state]) + '</span>';
}

// The reason and the items of a row. The page swaps this alone when the wall check comes back, so a field being typed in is not redrawn.
export function checkHtml(check) {
  if (!check) return '<p class="reason" data-state="unknown">Checking what the wall would do.</p>';
  const items = check.items && check.items.length ? '<ul class="items">' + check.items.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul>' : '';
  return '<p class="reason" data-state="' + esc(check.state) + '">' + esc(check.reason) + '</p>' + items;
}

export function rowHtml(row, index, last, page) {
  const choices = page.choices;
  const titles = titlesOf(choices);
  const check = page.checks[row._key];
  const key = esc(row._key);
  const photo = row.panel === 'photo';
  const seconds = secondsOf(row, page.pageSeconds);

  const secondsField = photo
    ? field('Photos (' + photoRange.count.min + ' to ' + photoRange.count.max + ')', '<input type="number" inputmode="numeric" min="' + photoRange.count.min + '" max="' + photoRange.count.max + '" step="1" data-field="photoCount" value="' + esc(row.photoCount || 4) + '">') +
      field('Seconds per photo (' + photoRange.each.min + ' to ' + photoRange.each.max + ')', '<input type="number" inputmode="numeric" min="' + photoRange.each.min + '" max="' + photoRange.each.max + '" step="1" data-field="secondsPerPhoto" value="' + esc(row.secondsPerPhoto || 10) + '">')
    : field('Seconds (6 to 120, empty is ' + page.pageSeconds + ')', '<input type="number" inputmode="numeric" min="6" max="120" step="1" data-field="seconds" value="' + esc(row.seconds === undefined ? '' : row.seconds) + '">');

  return '<article class="drow" data-key="' + key + '" data-view="' + esc(row.view) + '" data-shown="' + (isShown(row) ? 'yes' : 'no') + '">' +
    thumbHtml(titles[row.panel] || row.panel || 'Panel not chosen') +
    '<div class="dhead"><h3><span class="num">' + (index + 1) + '</span> ' + esc(titles[row.panel] || row.panel || 'Panel not chosen') + '</h3>' +
    chipHtml(check, row) + '</div>' +
    '<div class="check-area">' + checkHtml(check) + '</div>' +
    '<div class="fields">' +
    field('View', '<select data-field="view">' + options(choices.views, row.view) + '</select>') +
    field('Panel', '<select data-field="panel">' + panelOptions(choices, row.panel) + '</select>') +
    secondsField +
    mondayFieldsOf(row, choices.monday).map(item => field(item.label, '<select data-field="' + esc(item.field) + '">' + options(item.choices, item.value) + '</select>')).join('') +
    '<label class="check"><input type="checkbox" data-field="shown"' + (isShown(row) ? ' checked' : '') + '> Show on screen</label>' +
    '</div>' +
    '<p class="word">Stays ' + seconds + ' seconds.' + (detailsWords(row, titles) ? ' ' + esc(detailsWords(row, titles)) + '.' : '') + '</p>' +
    '<div class="buttons small">' +
    '<button type="button" class="act quiet" data-action="up"' + (index === 0 ? ' disabled' : '') + '>Up</button>' +
    '<button type="button" class="act quiet" data-action="down"' + (last ? ' disabled' : '') + '>Down</button>' +
    '<button type="button" class="act quiet" data-action="copy">Copy</button>' +
    '<button type="button" class="act quiet" data-action="delete">Delete</button>' +
    '<button type="button" class="act quiet to-picture" data-action="to-preview">Show the picture</button>' +
    '</div></article>';
}

// Rows that follow each other in one view are one group, as on the Studio board. The wall changes view only between groups.
export function rowsHtml(rows, page) {
  if (rows.length === 0) return '<p class="word">The list is empty, so the wall plays the standard order. Use Fill from the standard order, or add a row.</p>';
  return blocksOf(rows, page.pageSeconds).map(block => {
    const first = block.rows[0].index + 1;
    const last = block.rows[block.rows.length - 1].index + 1;
    return '<section class="dgroup" data-view="' + esc(block.view) + '"><h3>' + esc(viewWords[block.view] || 'No view') + ', rows ' + first + ' to ' + last + '. ' +
      block.shown + ' of ' + block.count + ' on, ' + esc(durationWords(block.seconds)) + '.</h3>' +
      block.rows.map(item => rowHtml(item.row, item.index, item.index === rows.length - 1, page)).join('') + '</section>';
  }).join('');
}

function rowsWord(count) {
  return count + (count === 1 ? ' row' : ' rows');
}

// One quick button. The label says what it will do and to how many rows. Nothing is sent until Save to draft.
function quickButton(action, panel, name, counts) {
  if (counts.total === 0) return '<li class="quick"><span class="word">' + esc(name) + ': no rows in the list.</span></li>';
  const what = quickAction(counts);
  const label = (what.hide ? 'Hide ' : 'Show ') + (action === 'quick-nova' ? 'all ' + name : name) + ' (' + rowsWord(what.rows) + ')';
  return '<li class="quick"><button type="button" class="act' + (what.hide ? '' : ' quiet') + '" data-action="' + action + '"' + (panel ? ' data-panel="' + esc(panel) + '"' : '') + '>' + esc(label) + '</button>' +
    '<span class="word">' + esc(name) + ' has ' + rowsWord(counts.total) + ', ' + counts.on + ' on now.</span></li>';
}

// Quick hide: switches the Show on screen of many rows at once, to hide them for a while and bring them back later.
// It changes the list on this page only. Save to draft and Publish to the wall send it, like any other change.
export function quickHtml(rows, choices) {
  const titles = titlesOf(choices);
  const panels = quickPanels(rows).map(item => quickButton('quick-panel', item.panel, titles[item.panel] || item.panel, item));
  return '<section class="card" data-quick><h2>Quick hide</h2>' +
    '<p class="word">Switch Show on screen off for many rows at once, and on again later. The rows stay in the list with all their settings. Nothing is sent until you press Save to draft.</p>' +
    '<ul class="quicks">' + quickButton('quick-nova', '', 'Nova rows', countWhere(rows, isNovaRow)) + panels.join('') + '</ul></section>';
}

export function addRowHtml(choices) {
  return '<section class="card"><h2>Add a row</h2><div class="fields">' +
    field('View', '<select data-add="view">' + options(choices.views, 'robotics') + '</select>') +
    field('Panel', '<select data-add="panel">' + choices.panelGroups.map(group => '<optgroup label="' + esc(group.title) + '">' + options(group.panels, '') + '</optgroup>').join('') + '</select>') +
    '</div><div class="buttons"><button type="button" class="act" data-action="add">Add row at the end</button>' +
    '<button type="button" class="act quiet" data-action="standard">Fill from the standard order</button></div>' +
    '<p class="note">The new row goes at the end. Move it into place with Up and Down. Fill from the standard order replaces the list, and Undo brings it back.</p></section>';
}

// ----- the theme and view settings -----

export function themeHtml(theme, choices) {
  const days = choices.weekdays.map(day => field(dayWords[day] || day, '<select data-theme-day="' + esc(day) + '">' + options(choices.themes, theme.themeByWeekday[day]) + '</select>')).join('');
  return '<section class="card"><h2>Theme of each weekday</h2><div class="fields">' + days + '</div>' +
    '<div class="fields">' +
    field('Banner title for Robotics (up to 28 characters)', '<input type="text" maxlength="28" data-theme-title value="' + esc(theme.generalViewTitle) + '">') +
    field('Transition length in seconds (2 to 4)', '<input type="number" inputmode="decimal" min="2" max="4" step="0.5" data-theme-transition value="' + esc(theme.transitionSeconds === null ? '' : theme.transitionSeconds) + '">') +
    '</div><p class="note">The view of a row is in its card above. The theme changes at midnight in the time zone of the Look page.</p></section>';
}

// ----- motion (a section of its own) -----

const motionWords = [
  { value: 'full', title: 'Full' },
  { value: 'light', title: 'Light' },
  { value: 'calm', title: 'Calm' },
];
const kioskWords = [
  { value: 'light', title: 'Light' },
  { value: 'full', title: 'Full' },
];

export function motionHtml(motion) {
  return '<section class="card"><h2>Motion</h2><div class="fields">' +
    field('Motion', '<select data-motion-field="motion">' + options(motionWords, motion.motion) + '</select>') +
    field('Motion on the TV computer', '<select data-motion-field="motionOnKiosk">' + options(kioskWords, motion.motionOnKiosk) + '</select>') +
    '</div><p class="note">Full plays every movement. Light plays one simple change at each panel and view change. Calm only fades. The TV computer plays Light when Motion is Full, unless the second box says Full, so that it does not freeze. Add ?motion=full to the address of one computer to try Full there.</p></section>';
}

// ----- what the wall adds by itself -----

export function extrasHtml(extras, now = new Date()) {
  if (!extras || (!extras.tba && !extras.match13)) return '<section class="card"><h2>Competition data</h2><p class="word">No competition data was read.</p></section>';
  let html = '<section class="card"><h2>Competition data</h2><p class="word">The wall adds the competition cards by itself, so they are not rows. This is the data behind them.</p>';

  if (extras.tba) {
    const teams = extras.tba.teams.map(team => '<li>' + esc(team.team + (team.number ? ' ' + team.number : '')) + ': ' +
      esc(team.rank === null ? 'no rank yet' : 'rank ' + team.rank + (team.of ? ' of ' + team.of : '')) + (team.nextMatch ? ', next match ' + esc(team.nextMatch) : '') + '</li>').join('');
    html += '<h3>TBA (the frc-status document)</h3><p class="word">Read ' + esc(agoText(extras.tba.lastSyncAt, now)) + '.' + (extras.tba.lastError ? ' Last problem: ' + esc(extras.tba.lastError) : '') + '</p>' + (teams ? '<ul class="items">' + teams + '</ul>' : '');
  }
  if (extras.match13) {
    html += '<h3>Match13</h3><p class="word">Read ' + esc(agoText(extras.match13.generatedAt, now)) + (extras.match13.stale ? '. This is old.' : '.') + ' This stays on the Teletraan computer and is not saved to Sanity.</p>';
    html += extras.match13.events.map(event => '<h4>' + esc(event.key) + '</h4>' + (event.matches.length ? '<ul class="items">' + event.matches.map(match =>
      '<li>' + esc(match.key) + (match.redWin === null ? '' : ': red wins ' + match.redWin + ' percent') + (match.redScore === null ? '' : ', expected ' + Math.round(match.redScore) + ' to ' + Math.round(match.blueScore)) + (match.played ? ', played' : '') + '</li>').join('') + '</ul>' : '<p class="word">No matches yet.</p>')).join('');
  }
  return html + '</section>';
}
