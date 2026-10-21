// The plain functions of the Rotation board (inputs/rotation-board-view.js): the blocks of the list, the loop time, the tiles of
// the preview strip, which columns and details a row has, and every change to the list. They know nothing about the page, so
// tests/rotation-board.test.mjs can run them with node.
//
// A change never loses a value. A row is copied with Object.assign, so a field the board does not show stays on the row.

import { defaultRotationRows } from './default-rotation.js';
import { panelTitleOf, viewEntry } from './rotation-titles.js';
import { mondayChartChoices, mondayDepartmentChoices, mondayListChoices, olderMondayPanels } from '../inputs/screen-panels.js';

export const settingsId = 'dashboardSettings';
export const draftId = 'drafts.dashboardSettings';

// How long a row with no seconds stays: pageSeconds of Dashboard Settings, 20 until it is set (dashboard/config-settings.js)
export const defaultPageSeconds = 20;
export const secondsRange = { min: 6, max: 120 };
export const photoRange = { count: { min: 1, max: 20 }, each: { min: 5, max: 60 } };
export const startingPhotos = { count: 4, each: 10 };

// The Robotics panels that use the wide layout. The other Robotics panels are split, so a small panel sits beside them.
// tests/rotation-board.test.mjs compares this list with roboticsWidePanels in dashboard/config-rotation.js.
export const wideRoboticsPanels = ['monday-department', 'monday-charts', 'roster', 'driveHours', 'robotStatus', 'wireframe'];

export const departmentHints = ['build', 'electrical', 'programming', 'design', 'strategy', 'business', 'operations', 'marketing'];

// The teams a Monday row can show: both (no team), Prime or Nova (mondayTeams in dashboard/config-lists.js)
export const mondayTeamChoices = [{ value: '', title: 'Both' }, { value: 'prime', title: 'Prime' }, { value: 'nova', title: 'Nova' }];

// The words under a row of one of the eleven Monday panels of the older sync (retiredWords in dashboard/config-lists.js)
export const retiredWords = 'Retired, use Department tasks.';

export function isRetired(row) {
  return Boolean(row) && olderMondayPanels.some(item => item.value === row.panel);
}

// A row of the older Monday tasks panel with one of the nine departments plays as Department tasks, open, for that department
// and the team of its view (upgradeMondayRow in dashboard/core/rotation.js). null for any other row.
export function upgradedRow(row) {
  if (!row || row.panel !== 'monday-tasks') return null;
  const department = String(row.department || '').trim().toLowerCase();
  if (!mondayDepartmentChoices.some(item => item.value === department)) return null;
  const team = row.view === 'prime' || row.view === 'nova' ? row.view : '';
  return Object.assign({}, row, { panel: 'monday-department', department: department, list: 'open' }, team ? { team: team } : {});
}

// What a stored row of an older Monday panel does now, in words, or nothing for any other row
export function retiredNote(row) {
  const upgraded = upgradedRow(row);
  if (upgraded) return 'Older Monday row: it plays as Department tasks, ' + choiceTitle(mondayDepartmentChoices, upgraded.department) + ', Open. Pick Department tasks to keep it.';
  return isRetired(row) ? retiredWords : '';
}

function choiceTitle(list, value) {
  return (list.filter(item => item.value === (value || ''))[0] || { title: '' }).title;
}

// A key for a row that has none: letters and digits, like the keys Studio makes
export function newKey() {
  return Math.random().toString(16).slice(2, 14).padEnd(12, '0');
}

// Every row with a _key, the rows without one (or with a key already used) given a new key. The rows are copies.
export function withKeys(rows) {
  const seen = {};
  return (Array.isArray(rows) ? rows : []).filter(row => row && typeof row === 'object').map(row => {
    let key = typeof row._key === 'string' && row._key !== '' && !seen[row._key] ? row._key : newKey();
    while (seen[key]) key = newKey();
    seen[key] = true;
    return Object.assign({}, row, { _key: key });
  });
}

export function standardRows() {
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

// What else the board reads from Dashboard Settings: how long a row with no seconds stays, and whether the Parts request address is set
export function settingsFrom(documents) {
  const found = Array.isArray(documents) ? documents : [];
  const source = found.filter(doc => doc && doc._id === draftId)[0] || found.filter(doc => doc && doc._id === settingsId)[0] || {};
  const pageSeconds = typeof source.pageSeconds === 'number' && source.pageSeconds > 0 ? source.pageSeconds : defaultPageSeconds;
  return { pageSeconds: pageSeconds, partsLink: typeof source.partsRequestUrl === 'string' && source.partsRequestUrl.trim() !== '' };
}

export function isShown(row) {
  return row.shown !== false;
}

// How long a row stays: a Photos row is its photos times the seconds of each, any other row its own seconds or pageSeconds
export function secondsOf(row, pageSeconds = defaultPageSeconds) {
  if (row.panel === 'photo') {
    const count = Number(row.photoCount) > 0 ? Number(row.photoCount) : startingPhotos.count;
    const each = Number(row.secondsPerPhoto) > 0 ? Number(row.secondsPerPhoto) : startingPhotos.each;
    return count * each;
  }
  return Number(row.seconds) > 0 ? Number(row.seconds) : pageSeconds;
}

// Rows that follow each other in one view are one block. Each block is { key, view, rows: [{ row, index }], count, shown, seconds },
// seconds counting only the rows that are shown.
export function blocksOf(rows, pageSeconds = defaultPageSeconds) {
  const blocks = [];
  rows.forEach((row, index) => {
    const view = row.view || '';
    let block = blocks[blocks.length - 1];
    if (!block || block.view !== view) {
      block = { key: row._key, view: view, rows: [], count: 0, shown: 0, seconds: 0 };
      blocks.push(block);
    }
    block.rows.push({ row: row, index: index });
    block.count += 1;
    if (isShown(row)) {
      block.shown += 1;
      block.seconds += secondsOf(row, pageSeconds);
    }
  });
  return blocks;
}

export function loopSeconds(rows, pageSeconds = defaultPageSeconds) {
  return rows.filter(isShown).reduce((total, row) => total + secondsOf(row, pageSeconds), 0);
}

// 580 gives 9 minutes 40 seconds, 60 gives 1 minute, 0 gives 0 seconds
export function durationWords(total) {
  const seconds = Math.max(0, Math.round(total));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const parts = [];
  if (minutes > 0) parts.push(minutes + (minutes === 1 ? ' minute' : ' minutes'));
  if (rest > 0 || minutes === 0) parts.push(rest + (rest === 1 ? ' second' : ' seconds'));
  return parts.join(' ');
}

export function loopWords(rows, pageSeconds = defaultPageSeconds) {
  const shown = rows.filter(isShown).length;
  if (shown === 0) return 'No row is shown, so the wall plays the standard order.';
  return 'A full loop takes ' + durationWords(loopSeconds(rows, pageSeconds)) + '.';
}

// The preview strip: a tile for each row in order, and a view change marker wherever the next row that plays is in another view.
// A hidden row is a tile that is skipped and starts no view change.
export function stripOf(rows, pageSeconds = defaultPageSeconds) {
  const items = [];
  let last = null;
  rows.forEach(row => {
    const shown = isShown(row);
    if (shown && last !== null && last !== (row.view || '')) items.push({ type: 'change', key: 'change-' + row._key, from: last, to: row.view || '' });
    items.push({ type: 'tile', key: row._key, title: panelTitleOf(row.panel) || 'Panel not chosen', view: row.view || '', seconds: secondsOf(row, pageSeconds), shown: shown });
    if (shown) last = row.view || '';
  });
  return items;
}

// Robotics rows are split or wide by their panel. The small panel column is for a Robotics row that is split.
export function layoutOf(row) {
  if ((row.view || '') !== 'robotics') return 'team';
  return wideRoboticsPanels.indexOf(row.panel) === -1 ? 'split' : 'wide';
}

export function hasSmallPanel(row) {
  return layoutOf(row) === 'split';
}

// What a Details panel offers for a row, by its panel. Each is { kind, field, label, help }. Every field says what it does in one line.
export function detailsFor(row) {
  const panel = row.panel;
  const list = [];

  if (panel === 'photo') {
    list.push({ kind: 'number', field: 'photoCount', label: 'Photos', help: 'How many photos the row shows, from 1 to 20.', min: photoRange.count.min, max: photoRange.count.max });
    list.push({ kind: 'number', field: 'secondsPerPhoto', label: 'Seconds per photo', help: 'How long each photo stays, from 5 to 60. The row stays photos times this.', min: photoRange.each.min, max: photoRange.each.max });
  }
  if (panel === 'monday-department') {
    list.push({ kind: 'choice', field: 'department', label: 'Department', help: 'The department whose tasks the panel shows. A row with no department is skipped.', choices: [{ value: '', title: 'Pick a department' }].concat(mondayDepartmentChoices) });
    list.push({ kind: 'choice', field: 'list', label: 'List', help: 'Open is To Do, In Progress, In Review and Stuck. Done is the done tasks, the newest first.', choices: mondayListChoices });
    list.push({ kind: 'choice', field: 'team', label: 'Team', help: 'The tasks of both teams, or of Prime or Nova. A task with the team General shows for both.', choices: mondayTeamChoices });
  }
  if (panel === 'monday-charts') {
    list.push({ kind: 'choice', field: 'chart', label: 'Chart', help: 'Status by department, Overall progress (by estimated hours) or the Timeline of this month and the next two.', choices: mondayChartChoices });
    list.push({ kind: 'choice', field: 'team', label: 'Team', help: 'The tasks of both teams, or of Prime or Nova. A task with the team General counts for both.', choices: mondayTeamChoices });
  }
  if (panel === 'roster' || panel === 'driveHours') {
    list.push({ kind: 'text', field: 'department', label: 'Department', help: 'The department shown, or two with a comma, such as business,marketing. Empty shows every department.' });
  }
  if (panel === 'events' || panel === 'team-leads' || panel === 'roster') {
    list.push({ kind: 'part', field: 'part', label: 'Page', help: 'Page 1 shows the first page, page 2 shows the next pages. All pages plays both.' });
  }
  if (row.side === 'qrParts') {
    list.push({ kind: 'link', field: 'side', label: 'Parts request link', help: 'The QR code opens the Parts request address of Dashboard Settings, Screen tab.' });
  }
  return list;
}

// The words in the Details cell, so a row says what it holds without opening
export function detailsSummary(row) {
  const words = [];
  if (row.panel === 'photo') words.push(startingCount(row.photoCount, startingPhotos.count) + ' photos, ' + startingCount(row.secondsPerPhoto, startingPhotos.each) + ' s each');
  if (row.panel === 'monday-department') {
    words.push(choiceTitle(mondayDepartmentChoices, row.department) || 'No department', row.list === 'done' ? 'Done' : 'Open', choiceTitle(mondayTeamChoices, row.team) || 'Both');
  } else if (row.panel === 'monday-charts') {
    words.push(choiceTitle(mondayChartChoices, row.chart || 'status'), choiceTitle(mondayTeamChoices, row.team) || 'Both');
  } else if (row.department) {
    words.push(row.department);
  }
  if (row.part) words.push('Page ' + row.part);
  if (row.side === 'qrParts') words.push('QR link');
  return words.join(', ');
}

function startingCount(value, fallback) {
  return Number(value) > 0 ? Number(value) : fallback;
}

export function qrStatus(partsLink) {
  return partsLink ? 'The link is set.' : 'The link is not set. Add the Parts request address in Dashboard Settings, Screen tab. Until then the code says LINK NOT SET.';
}

// Seconds typed as text: a whole number from 6 to 120 as a number, empty as '' and anything else as null (a problem)
export function secondsFrom(text) {
  const trimmed = String(text === undefined || text === null ? '' : text).trim();
  if (trimmed === '') return '';
  if (!/^\d+$/.test(trimmed)) return null;

  const number = Number(trimmed);
  return number >= secondsRange.min && number <= secondsRange.max ? number : null;
}

// A whole number inside a range as a number, or null when it is not
export function wholeFrom(text, range) {
  const trimmed = String(text === undefined || text === null ? '' : text).trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const number = Number(trimmed);
  return number >= range.min && number <= range.max ? number : null;
}

// The changes. Each gives new rows and leaves the rows it was given as they were.

export function setRowValue(rows, index, field, value) {
  if (index < 0 || index >= rows.length) return rows;

  const row = Object.assign({}, rows[index]);
  if (value === '' || value === undefined || value === null) delete row[field];
  else row[field] = value;
  const next = rows.slice();
  next[index] = row;
  return next;
}

// A Photos row also keeps seconds as photos times seconds each, the way the migration and the screen write it
export function setPhotoValue(rows, index, field, value) {
  const changed = setRowValue(rows, index, field, value);
  const row = changed[index];
  if (!row || row.panel !== 'photo') return changed;
  return setRowValue(changed, index, 'seconds', secondsOf(row));
}

export function moveRow(rows, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= rows.length || to < 0 || to >= rows.length) return rows;

  const next = rows.slice();
  const row = next.splice(index, 1)[0];
  next.splice(to, 0, row);
  return next;
}

// Drag and drop: the row at from lands where the row at to is
export function moveTo(rows, from, to) {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows;

  const next = rows.slice();
  const row = next.splice(from, 1)[0];
  next.splice(to, 0, row);
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

export function removeRows(rows, keys) {
  return rows.filter(row => keys.indexOf(row._key) === -1);
}

// The new row goes at the end of the list. Move it into place with the arrows or by dragging.
export function addRow(rows, view, panel) {
  const row = { _key: newKey(), view: view, panel: panel, shown: true };
  if (panel === 'photo') Object.assign(row, { photoCount: startingPhotos.count, secondsPerPhoto: startingPhotos.each, seconds: startingPhotos.count * startingPhotos.each });
  return rows.concat([row]);
}

// Show or hide several rows at once
export function setShown(rows, keys, shown) {
  return rows.map(row => (keys.indexOf(row._key) === -1 ? row : Object.assign({}, row, { shown: shown })));
}

// Retired Monday rows (olderMondayPanels in inputs/screen-panels.js). These functions take them out of the
// list and put the Department tasks and TV charts rows that replace them. They never touch any other row.

export const addedRowSeconds = 30;
export const mondayDepartmentIds = mondayDepartmentChoices.map(item => item.value);
export const mondayChartIds = mondayChartChoices.map(item => item.value);

export const isRetiredRow = row => isRetired(row);

export function retiredCount(rows) {
  return rows.filter(isRetiredRow).length;
}

// The same rows without the retired Monday rows. A list with none comes back as it was.
export function removeRetired(rows) {
  return retiredCount(rows) === 0 ? rows : rows.filter(row => !isRetiredRow(row));
}

// The departments that no Department tasks row has yet, in the order of the pickers
export function missingDepartments(rows) {
  return mondayDepartmentIds.filter(id => !rows.some(row => row.panel === 'monday-department' && row.department === id));
}

// The chart kinds that no TV charts row has yet. A row with no chart is the Status chart.
export function missingCharts(rows) {
  return mondayChartIds.filter(id => !rows.some(row => row.panel === 'monday-charts' && (row.chart || 'status') === id));
}

// One Department tasks row, open, for both teams, at the end of the list for each department that has none
export function addDepartmentRows(rows) {
  return rows.concat(missingDepartments(rows).map(id => ({ _key: newKey(), view: 'robotics', panel: 'monday-department', department: id, list: 'open', seconds: addedRowSeconds, shown: true })));
}

// One TV charts row, for both teams, at the end of the list for each chart kind that has none
export function addChartRows(rows) {
  return rows.concat(missingCharts(rows).map(id => ({ _key: newKey(), view: 'robotics', panel: 'monday-charts', chart: id, seconds: addedRowSeconds, shown: true })));
}

// Writes the rows to the draft of Dashboard Settings, and only the field rotationRows. The draft is made from the published
// document first when there is none, so the other fields are kept. It gives back a promise.
export const notPublished = 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.';

export async function saveRows(client, rows) {
  const published = await client.getDocument(settingsId);
  const draft = await client.getDocument(draftId);
  if (!draft && !published) throw new Error(notPublished);
  if (!draft) {
    const copy = Object.assign({}, published, { _id: draftId });
    ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
    await client.createIfNotExists(copy);
  }
  return client.patch(draftId).set({ rotationRows: rows }).commit();
}

// The last changes, newest last, kept in memory for Undo. Twenty are kept.
export function pushUndo(history, rows) {
  return history.concat([rows]).slice(-20);
}

// Why a row is skipped on the wall right now. The wall leaves out a row that has nothing to show: a Monday row with no task for
// its department, list and team, and a Photo row with no photo. The board asks for the tasks and photos the wall would read and
// writes a note under each such row. These rules are the ones of boardTasks, ofTeam and listOf in dashboard/core/monday-views.js,
// kept short: a note says there is nothing, and never says there is something. A row of a retired Monday panel always has its note.
export const skipQuestion = `{
  "tasks": *[_type == "task" && source == "monday" && show != false && showOnTv != false && showOnBoard != false && defined(department)] {
    "team": team->code,
    department,
    list,
    status,
    startDate,
    dueDate,
    expires
  },
  "photos": *[_type == "photo" && show != false] { expires }
}`;

function notExpired(item, now) {
  return !item || !item.expires || Date.parse(item.expires) > now.getTime();
}

function listOf(task) {
  if (task.list === 'open' || task.list === 'done') return task.list;
  return task.status === 'done' ? 'done' : 'open';
}

function teamWords(team) {
  return team === 'prime' || team === 'nova' ? 'the ' + team.charAt(0).toUpperCase() + team.slice(1) + ' team' : 'both teams';
}

// The note of a Monday row, or nothing when it has something to show
function mondayNote(row, tasks) {
  const team = row.team === 'prime' || row.team === 'nova' ? row.team : '';
  const ofTeam = tasks.filter(task => team === '' || !task.team || task.team === team);

  if (row.panel === 'monday-charts') {
    const drawn = row.chart === 'timeline' ? ofTeam.filter(task => task.startDate && task.dueDate) : ofTeam;
    if (drawn.length > 0) return '';
    return row.chart === 'timeline'
      ? 'Skipped now: no Monday task of ' + teamWords(team) + ' has a Timeline.'
      : 'Skipped now: no Monday task is on the TV for ' + teamWords(team) + '.';
  }

  const department = choiceTitle(mondayDepartmentChoices, row.department);
  if (department === '') return 'Skipped now: pick a Department in Details.';
  const list = row.list === 'done' ? 'done' : 'open';
  if (ofTeam.some(task => task.department === row.department && listOf(task) === list)) return '';
  return 'Skipped now: no ' + list + ' ' + department + ' task is on the TV for ' + teamWords(team) + '.';
}

// { rowKey: 'Skipped now: ...' } for the shown rows that have nothing to show, and every row of a retired Monday panel. data is
// what skipQuestion found, or null when it could not be read, and then only the retired rows have notes (the page says so in
// general words).
export function skipNotes(rows, data, now = new Date()) {
  const notes = {};
  const read = Boolean(data && Array.isArray(data.tasks) && Array.isArray(data.photos));
  const tasks = read ? data.tasks.filter(task => notExpired(task, now)) : [];
  const photos = read ? data.photos.filter(photo => notExpired(photo, now)) : [];

  (Array.isArray(rows) ? rows : []).forEach(row => {
    if (!row) return;
    const upgraded = upgradedRow(row);
    if (isRetired(row) && !upgraded) {
      notes[row._key] = retiredWords;
      return;
    }
    if (!read || !isShown(row)) return;

    if (row.panel === 'photo' && photos.length === 0) {
      notes[row._key] = 'Skipped now: no photos (every photo is hidden or past its expiry).';
      return;
    }
    const monday = upgraded || row;
    if (monday.panel !== 'monday-department' && monday.panel !== 'monday-charts') return;
    const note = mondayNote(monday, tasks);
    if (note !== '') notes[row._key] = note;
  });
  return notes;
}

export const skipHint = 'The wall skips a row with nothing to show. An example is a Department tasks row with no task in its list. A skipped row is marked under its panel.';
