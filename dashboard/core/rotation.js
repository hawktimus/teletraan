// The one ordered rotation list (docs/views.md, "The rotation"). The plain functions: they know nothing about the page, so
// tests/rotation.test.mjs can run them. core/views-play.js plays the list, and the transition code asks transitionKindFor.
//
// A row is { view, panel, seconds, shown } and, for the few panels that need it, department, part, side, photoCount and
// secondsPerPhoto, and for the two Monday panels list, chart and team.
// The list is Dashboard Settings, rotationRows (the stored name rotation is the Ticker block of the same page, so the list
// has this one). A hidden row keeps its place in the order and plays nothing. Rows that follow each other in the same view
// are one block, and the view changes only between blocks.
//
// A list with no shown row is not played: the screen plays the default rotation (config-rotation.js), and the Studio fills the
// list with it the first time Dashboard Settings is opened (migrateRotation here, and the same in
// studio/tools/rotation-migrate.js). The lists of the views are kept for migrateRotationFromViews.

import { defaultRotationRows, mondayCharts, mondayDepartments, retiredMondayPanels, rotationAliases, rotationKeyOfView, rotationViews, transitionSecondsRange } from '../config.js';
import { panels } from '../registry.js';
import { keepInRange } from './content.js';
import { isRecord } from './text.js';
import { resolveView, viewOrderOf } from './views-tidy.js';

export const agendaPanel = 'tonight';
const agendaSeconds = 45;

// The key of a view as a row says it: robotics, prime or nova. general (and the Family view, whose panels moved to
// Robotics) is robotics, and anything else is nothing.
export function rotationViewOf(name) {
  const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
  const named = rotationAliases[key] || key;

  return rotationViews.includes(named) ? named : '';
}

// The key the views code uses for a row's view: general for robotics
export function viewKeyOfRotation(view) {
  return rotationKeyOfView[view] || '';
}

function knownPanel(id) {
  const found = panels.find(item => item.id === id);
  return Boolean(found && found.region === 'grid1' && !found.testOnly);
}

function smallPanel(id) {
  const found = panels.find(item => item.id === id);
  return Boolean(found && found.region === 'grid2' && !found.testOnly && !found.lastResort);
}

// One of the nine departments of the Monday boards in lowercase, or '' for anything else
export function mondayDepartmentOf(value) {
  const name = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return mondayDepartments.some(entry => entry.value === name) ? name : '';
}

export function isRetiredPanel(id) {
  return retiredMondayPanels.includes(id);
}

// A row of the older Monday tasks panel with one of the nine departments plays as Department tasks, open, for that department
// and the team of its view. Every other row is given back as it is.
export function upgradeMondayRow(raw) {
  if (!isRecord(raw) || raw.panel !== 'monday-tasks' || mondayDepartmentOf(raw.department) === '') return raw;

  const view = rotationViewOf(raw.view);
  const row = Object.assign({}, raw, { panel: 'monday-department', department: mondayDepartmentOf(raw.department), list: 'open' });
  if (view === 'prime' || view === 'nova') row.team = view;
  else delete row.team;
  return row;
}

// The settings of a row of the two Monday panels: the department and the list, or the chart, and the team
function mondaySettings(raw, row) {
  if (row.panel === 'monday-department') {
    const department = mondayDepartmentOf(raw.department);
    if (department !== '') row.department = department;
    else delete row.department;
    row.list = raw.list === 'done' ? 'done' : 'open';
  }
  if (row.panel === 'monday-charts') row.chart = mondayCharts.some(entry => entry.value === raw.chart) ? raw.chart : 'status';
  if ((row.panel === 'monday-department' || row.panel === 'monday-charts') && (raw.team === 'prime' || raw.team === 'nova')) row.team = raw.team;
}

// One row, tidy, or null when it cannot be played at all (no view, no known panel). A row of one of the eleven older Monday
// panels is kept, marked retired, and plays nothing.
export function tidyRotationRow(given) {
  if (!isRecord(given)) return null;

  const raw = upgradeMondayRow(given);
  const view = rotationViewOf(raw.view);
  const panel = typeof raw.panel === 'string' ? raw.panel.trim() : '';
  if (view === '') return null;
  if (isRetiredPanel(panel)) return { view: view, panel: panel, shown: raw.shown !== false, retired: true };
  if (!knownPanel(panel)) return null;

  const row = { view: view, panel: panel, shown: raw.shown !== false };
  if (typeof raw.seconds === 'number' && isFinite(raw.seconds) && raw.seconds > 0) row.seconds = Math.round(keepInRange(raw.seconds, { min: 6, max: 120 }, 6));
  if (typeof raw.department === 'string' && raw.department.trim() !== '') row.department = raw.department.trim();
  mondaySettings(raw, row);
  if (raw.part === 1 || raw.part === 2) row.part = raw.part;
  if (typeof raw.side === 'string' && smallPanel(raw.side.trim())) row.side = raw.side.trim();
  if (panel === 'photo') {
    row.photoCount = Math.round(keepInRange(raw.photoCount, { min: 1, max: 20 }, 4));
    row.secondsPerPhoto = Math.round(keepInRange(raw.secondsPerPhoto, { min: 5, max: 60 }, 10));
    row.seconds = row.photoCount * row.secondsPerPhoto;
  }
  return row;
}

export function tidyRotationRows(list) {
  return (Array.isArray(list) ? list : []).map(tidyRotationRow).filter(row => row !== null);
}

// The rows the Studio has saved, tidy. Empty when it has none.
export function savedRotationRows(content) {
  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  return tidyRotationRows(settings.rotationRows);
}

// The rows the screen plays: the saved ones, or the default rotation (config-rotation.js) while the list has no row that is
// shown, so an untouched Studio plays the fifteen blocks
export function rotationRowsOf(content) {
  const saved = savedRotationRows(content);
  return saved.some(row => row.shown) ? saved : tidyRotationRows(defaultRotationRows());
}

// True when the Studio has a list with a row that is shown, which is the list that is played instead of the default one
export function rotationOn(content) {
  return savedRotationRows(content).some(row => row.shown);
}

// The blocks of a list: the shown rows that follow each other in one view, in order. A hidden row is not in a block, and
// shown rows of one view with only hidden rows between them are one block.
export function rotationBlocks(rows) {
  const blocks = [];

  rows.filter(row => row.shown).forEach(row => {
    const last = blocks[blocks.length - 1];
    if (last && last.view === row.view) {
      last.rows.push(row);
      return;
    }
    blocks.push({ view: row.view, key: viewKeyOfRotation(row.view), rows: [row] });
  });
  return blocks;
}

// A row as a row of the large panel of its view (core/screens.js, tidyMainRow). A team view gives its team to the row. The
// team a Monday row names is the team of its tasks (tasksTeam), not the team of the look.
export function mainRowOf(row, content) {
  const team = row.view === 'robotics' ? '' : resolveView(content, viewKeyOfRotation(row.view)).team;
  const main = { panel: row.panel, team: team };

  ['seconds', 'department', 'photoCount', 'secondsPerPhoto', 'side', 'part', 'list', 'chart'].forEach(name => {
    if (row[name] !== undefined) main[name] = row[name];
  });
  if (row.team !== undefined) main.tasksTeam = row.team;
  return main;
}

// Which transition goes between two rows: reformView when the view changes, reform inside a view. Before the first row
// there is nothing to change from, and the panel kind is the plain one. Until the transitions are drawn, the screen plays
// the page change for reform and the swap for reformView (core/views-run.js).
export function transitionKindFor(previousRow, nextRow) {
  const before = isRecord(previousRow) ? rotationViewOf(previousRow.view) : '';
  const after = isRecord(nextRow) ? rotationViewOf(nextRow.view) : '';

  return before !== '' && after !== '' && before !== after ? 'reformView' : 'reform';
}

// The kind of transition the screen is making now, for the code that draws it. views-run.js notes it at every step.
let kindNow = 'reform';

export function noteTransition(previousRow, nextRow) {
  kindNow = transitionKindFor(previousRow, nextRow);
  return kindNow;
}

export function transitionKindNow() {
  return kindNow;
}

// How many seconds the whole transition takes, from transitionSeconds of Dashboard Settings: 2 to 4, 3 when it is missing
export function transitionSecondsOf(content) {
  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  const range = transitionSecondsRange;

  return typeof settings.transitionSeconds === 'number' ? keepInRange(settings.transitionSeconds, range, range.start) : range.start;
}


// The migration

// The rows a view has now, as rows of the list. A photo row keeps its photos.
function rowsOfView(content, key) {
  const view = resolveView(content, key);
  const name = key === 'general' || key === 'family' ? 'robotics' : key;

  return view.panels.map(panel => {
    const row = { view: name, panel: panel.panel, shown: true };
    ['seconds', 'department', 'photoCount', 'secondsPerPhoto', 'list', 'chart'].forEach(field => {
      if (panel[field] !== undefined && panel[field] !== '') row[field] = panel[field];
    });
    if (panel.tasksTeam) row.team = panel.tasksTeam;
    return row;
  });
}

// Daily Agenda is the first row of every Robotics block that migration makes
function agendaFirst(rows) {
  const out = [];
  let start = 0;

  while (start < rows.length) {
    let end = start;
    while (end < rows.length && rows[end].view === rows[start].view) end += 1;
    const block = rows.slice(start, end);

    if (block[0].view === 'robotics') {
      const found = block.findIndex(row => row.panel === agendaPanel);
      const agenda = found >= 0 ? block.splice(found, 1)[0] : { view: 'robotics', panel: agendaPanel, seconds: agendaSeconds, shown: true };
      block.unshift(agenda);
    }
    out.push(...block);
    start = end;
  }
  return out;
}

// The list the Studio is filled with when it has none: the default rotation, fifteen blocks (config-rotation.js)
export function migrateRotation() {
  return tidyRotationRows(defaultRotationRows());
}

// The list built from the lists of the views, in the order of the views (viewOrder) and the order of each list, so that the
// wall plays what it played. Family, whose two panels were fixed, becomes Robotics rows. It is not the first fill any more.
export function migrateRotationFromViews(content) {
  const rows = [];

  viewOrderOf(content).forEach(key => rowsOfView(content, key).forEach(row => rows.push(row)));
  return tidyRotationRows(agendaFirst(rows));
}

// The panels of a settings tidy: the list, always an array of tidy rows (core/content-tidy.js)
export function tidyRotationSettings(settings) {
  settings.rotationRows = tidyRotationRows(settings.rotationRows);
  settings.transitionSeconds = transitionSecondsOf({ settings: settings });
}

