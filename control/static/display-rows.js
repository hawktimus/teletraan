// The plain functions of the Display tab: the rows of the rotation list and every change to them. The page, the control
// service and tests/control-display.test.mjs all import this one file. It copies the rules of the Studio board
// (studio/tools/rotation-board.js) because the control page cannot import from the Studio folder, and the test runs both
// on the same rows so they cannot drift apart.
//
// A change never loses a value: a row is copied with Object.assign, so a field the tab does not show stays on the row.

export const secondsRange = { min: 6, max: 120 };
export const photoRange = { count: { min: 1, max: 20 }, each: { min: 5, max: 60 } };
export const startingPhotos = { count: 4, each: 10 };
// How long a row with no seconds stays until Dashboard Settings says (pageSeconds)
export const defaultPageSeconds = 20;
export const mostRows = 300;

export const viewWords = { robotics: 'Robotics', prime: 'Prime', nova: 'Nova' };

// The settings of a row of the two Monday panels, the same as the Details of the Studio board (studio/tools/rotation-board.js)
export const mondayFieldNames = ['department', 'list', 'chart', 'team'];

// The dropdowns of a row: [{ field, label, value, choices }] for Department tasks (Department, List, Team) and the TV charts
// (Chart, Team), none for any other panel. monday is the lists of choices the server sends (choices.monday).
export function mondayFieldsOf(row, monday) {
  if (!monday) return [];
  const team = { field: 'team', label: 'Team', value: row.team || '', choices: monday.teams };
  if (row.panel === 'monday-department') {
    return [
      { field: 'department', label: 'Department', value: row.department || '', choices: [{ value: '', title: 'Pick a department' }].concat(monday.departments) },
      { field: 'list', label: 'List', value: row.list === 'done' ? 'done' : 'open', choices: monday.lists },
      team,
    ];
  }
  if (row.panel === 'monday-charts') return [{ field: 'chart', label: 'Chart', value: row.chart || 'status', choices: monday.charts }, team];
  return [];
}

// A Monday row of the Robotics view plays in the Condensed view (dashboard/core/views-play.js, playViewOf), and its small panel is
// never drawn. An older monday-tasks row with a department plays as Department tasks, so it is the same. The nine departments are
// those of mondayDepartments in dashboard/config-lists.js.
export const condensedWords = 'Plays in the Condensed view';

export function playsCondensed(row) {
  if (row.view !== 'robotics') return false;
  const older = row.panel === 'monday-tasks' && mondayDepartmentIds.indexOf(String(row.department || '').trim().toLowerCase()) !== -1;
  return older || row.panel === 'monday-department' || row.panel === 'monday-charts';
}

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

export function isShown(row) {
  return row.shown !== false;
}

// A Photos row stays its photos times the seconds of each. Any other row stays its own seconds, or pageSeconds.
export function secondsOf(row, pageSeconds = defaultPageSeconds) {
  if (row.panel === 'photo') {
    const count = Number(row.photoCount) > 0 ? Number(row.photoCount) : startingPhotos.count;
    const each = Number(row.secondsPerPhoto) > 0 ? Number(row.secondsPerPhoto) : startingPhotos.each;
    return count * each;
  }
  return Number(row.seconds) > 0 ? Number(row.seconds) : pageSeconds;
}

// Rows that follow each other in one view are one block: { key, view, rows: [{ row, index }], count, shown, seconds }
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

// The new row goes at the end of the list. Move it into place with Up and Down.
export function addRow(rows, view, panel) {
  const row = { _key: newKey(), view: view, panel: panel, shown: true };
  if (panel === 'photo') Object.assign(row, { photoCount: startingPhotos.count, secondsPerPhoto: startingPhotos.each, seconds: startingPhotos.count * startingPhotos.each });
  return rows.concat([row]);
}

// Quick hide. These only change the shown field, so a hidden row keeps everything else and comes back with Show.
// The page sends them with the normal Save to draft, like any other change.

// Rows that the test accepts, as a count of all of them and of those that are on now
export function countWhere(rows, test) {
  const found = rows.filter(test);
  return { total: found.length, on: found.filter(isShown).length };
}

// The same rows with shown set on every row the test accepts. A list with nothing to change comes back as it was.
export function setShownWhere(rows, test, shown) {
  if (!rows.some(row => test(row) && isShown(row) !== shown)) return rows;
  return rows.map(row => (test(row) && isShown(row) !== shown ? Object.assign({}, row, { shown: shown }) : row));
}

export const isNovaRow = row => row.view === 'nova';
export const isPanelRow = panel => row => row.panel === panel;

// The panels that the Quick hide group lists: the ones named first, then every other panel in the list, in list order
export function quickPanels(rows, first = ['robotStatus', 'wireframe']) {
  const order = first.slice();
  rows.forEach(row => { if (row.panel && !order.includes(row.panel)) order.push(row.panel); });
  return order.map(panel => Object.assign({ panel: panel }, countWhere(rows, isPanelRow(panel))));
}

// What a quick button does now and how many rows it changes: hide the rows that are on, or, when none is on, show them all
export function quickAction(counts) {
  if (counts.on > 0) return { hide: true, rows: counts.on };
  return { hide: false, rows: counts.total };
}

// Retired Monday rows. The eleven Monday panels of the older sync play nothing now (retiredMondayPanels in
// dashboard/config-lists.js, which tests/control-display.test.mjs compares with this list). These functions take them out of the
// list and put the Department tasks and TV charts rows that replace them. They never touch any other row.
export const retiredMondayPanels = [
  'monday-tasks', 'monday-done', 'monday-status-depts', 'monday-overall', 'monday-timeline', 'monday-board', 'monday-pie',
  'monday-milestones', 'monday-progress', 'monday-milestones-both', 'monday-progress-both',
];
export const mondayDepartmentIds = ['build', 'electrical', 'programming', 'design', 'cnc', 'strategy', 'operations', 'business', 'marketing'];
export const mondayChartIds = ['status', 'progress', 'timeline'];
export const addedRowSeconds = 30;

export const isRetiredRow = row => Boolean(row) && retiredMondayPanels.includes(row.panel);

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

// True when two lists are the same rows with the same values, for "you have unsaved changes"
export function sameRows(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}
