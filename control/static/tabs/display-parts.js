// The text of the Display tab as HTML strings. They take the answer of GET /control/api/display and the state of the page,
// and give markup with every value escaped. display.js puts the markup in the page and wires the buttons. Nothing here
// touches the page, so tests/control-display-page.test.mjs can try it with node.

import { blocksOf, condensedWords, countWhere, missingCharts, missingDepartments, retiredCount, durationWords, isNovaRow, isShown, mondayFieldsOf, playsCondensed, quickAction, quickPanels, loopSeconds, photoRange, secondsOf, viewWords } from '../display-rows.js';
import { agoText, esc } from './render.js';
import { thumbHtml } from './display-preview-parts.js';
import { dayWords, rowViewOf, weekDates } from '../push-lib.js';

const stateWords = { show: 'Will show', skip: 'Skipped', off: 'Off', unknown: 'Not known' };

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
    '<ul class="quicks">' + quickButton('quick-nova', '', 'Nova rows', countWhere(rows, isNovaRow)) + panels.join('') + '</ul>' + mondayCleanupHtml(rows) + '</section>';
}

// Old Monday rows out and the Department tasks and TV charts rows in. Each button names how many rows it changes and is left out
// when there is nothing to change. They change the list on this page only, like the quick buttons.
export function mondayCleanupHtml(rows) {
  const old = retiredCount(rows);
  const departments = missingDepartments(rows).length;
  const charts = missingCharts(rows).length;
  const item = (action, label, note) => '<li class="quick"><button type="button" class="act" data-action="' + action + '">' + esc(label) + '</button><span class="word">' + esc(note) + '</span></li>';
  const list = [];
  if (old > 0) list.push(item('remove-retired', 'Remove retired Monday rows (' + old + ')', 'The older Monday panels play nothing. Department tasks and the TV charts replace them.'));
  if (departments > 0) list.push(item('add-departments', 'Add the ' + (departments === 9 ? 'nine' : departments + ' missing') + ' Department tasks rows (Robotics, Open)', 'One row for each department that has none, at the end of the list, 30 seconds, both teams.'));
  if (charts > 0) list.push(item('add-charts', 'Add the ' + (charts === 3 ? 'three' : charts + ' missing') + ' TV charts rows', 'Status, progress and timeline, one row for each chart that has none, at the end of the list, 30 seconds.'));
  if (list.length === 0) return '<h3>Monday rows</h3><p class="word">No retired Monday rows, and every department and chart has a row.</p>';
  return '<h3>Monday rows</h3><ul class="quicks">' + list.join('') + '</ul>';
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

// info is { today, timeZone, serverTime } from the push state: today is marked, the next date of each weekday is counted from the
// clock of the Teletraan computer, and the time zone is shown. All three are empty until the first answer is read.
export function themeHtml(theme, choices, info = {}) {
  const dates = weekDates(info.serverTime || '', info.timeZone || '');
  const days = choices.weekdays.map(day => {
    const when = dates[day] || { date: '', today: false };
    const isToday = when.today || (!info.serverTime && day === info.today);
    return '<label class="trow" data-day="' + esc(day) + '"' + (isToday ? ' data-today="yes"' : '') + '>' +
      '<span class="tname">' + esc(dayWords[day] || day) + '</span>' +
      '<span class="tdate">' + esc(when.date) + (isToday ? ' <span class="dnow">today</span>' : '') + '</span>' +
      '<select data-theme-day="' + esc(day) + '" aria-label="Theme for ' + esc(dayWords[day] || day) + '">' + options(choices.themes, theme.themeByWeekday[day]) + '</select></label>';
  }).join('');
  return '<section class="card theme-card" data-theme-card><h2>Theme rotation (which theme plays each day)</h2>' +
    '<p class="word">The wall changes theme at midnight in the time zone of the Look page' + (info.timeZone ? ': ' + esc(info.timeZone) : '') + '. Change that on the Look page in the Studio.</p>' +
    '<div class="trows">' + days + '</div>' +
    '<h3>Names and timing</h3><div class="fields">' +
    field('Banner title for Robotics (up to 28 characters)', '<input type="text" maxlength="28" data-theme-title value="' + esc(theme.generalViewTitle) + '">') +
    field('Seconds for each transition (2 to 4)', '<input type="number" inputmode="decimal" min="2" max="4" step="0.5" data-theme-transition value="' + esc(theme.transitionSeconds === null ? '' : theme.transitionSeconds) + '">') +
    '</div><p class="note">The names of the Prime and Nova views are the names of their Team documents. The view of a row is in its card in the rotation above.</p>' +
    '<p class="note">Save to draft and Publish to the wall are under the preview, and they save these too.</p></section>';
}

// ----- the playlist -----

// The row the wall plays now, found from its report (panel and view), and the shown row after it. Rows that are off are passed over.
// A report that matches no row (a pushed panel, a card the wall adds) gives no position, and the card then says only what the wall shows.
export function playlistPosition(rows, report) {
  const shown = rows.filter(isShown);
  if (!report || !report.panel || shown.length === 0) return { now: null, next: null };
  const view = rowViewOf[report.view] || report.view || '';
  let at = shown.findIndex(row => row.panel === report.panel && (view === '' || row.view === view));
  if (at < 0) at = shown.findIndex(row => row.panel === report.panel);
  if (at < 0) return { now: null, next: null };
  return { now: shown[at], next: shown.length > 1 ? shown[(at + 1) % shown.length] : null };
}

function rowName(row, titles) {
  return (titles[row.panel] || row.panel || 'Panel not chosen') + ' (' + (viewWords[row.view] || 'no view') + ')';
}

// What the playlist is doing: what plays now, what comes next, how long a loop is. paused and report come from the push state and the
// wall report. The Edit button jumps to the Rotation rows.
export function playlistHtml(page, report, paused, titles) {
  const place = playlistPosition(page.rows, report);
  const shown = page.rows.filter(isShown);
  const playing = place.now ? rowName(place.now, titles) : report && report.panel ? (titles[report.panel] || String(report.panel).replace(/-/g, ' ')) + ' (not a row of the list)' : 'not known yet';
  const next = place.next ? rowName(place.next, titles) : place.now ? 'the same row again' : 'not known yet';
  const loop = shown.length === 0 ? 'No row is on, so the wall plays the standard order.' : shown.length + (shown.length === 1 ? ' row is on' : ' rows are on') + ', and a full loop takes ' + durationWords(loopSeconds(page.rows, page.pageSeconds)) + '.';
  return '<section class="card playlist-card" data-playlist-card><h2>Playlist</h2>' +
    (paused ? '<p class="warn" data-state="skip">The rotation is paused. The wall keeps the panel it shows.</p>' : '') +
    '<dl class="facts"><div><dt>Playing now</dt><dd data-play-now>' + esc(playing) + '</dd></div><div><dt>Next</dt><dd data-play-next>' + esc(next) + '</dd></div><div><dt>Loop</dt><dd>' + esc(loop) + '</dd></div></dl>' +
    '<div class="buttons"><button type="button" class="act" data-action="edit-rows">Edit</button></div>' +
    '<p class="note">Edit goes to the Rows below. Next, Pause and Back to schedule are in the card after this one.</p></section>';
}

// ----- motion (a section of its own) -----

const motionWords = [
  { value: 'full', title: 'Full' },
  { value: 'light', title: 'Light' },
  { value: 'calm', title: 'Calm' },
];

export function motionHtml(motion) {
  return '<section class="card"><h2>Motion</h2><div class="fields">' +
    field('Motion', '<select data-motion-field="motion">' + options(motionWords, motion.motion) + '</select>') +
    '</div><p class="note">Full plays every movement. Light plays one simple change at each panel and view change. Calm only fades. Every computer plays what this says, the TV computer too. A screen that cannot keep up in Full moves to Light by itself. Add ?motion=light to the address of one computer to try Light there.</p></section>';
}
