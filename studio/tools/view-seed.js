// The first rows of a View. A View with no main panel rows is filled once, when it is opened in
// Studio (view-input.js). The rows come from the Screens that were in use before the Views: the
// main panel rows of the first Screen that has any, split by team. A row of Prime goes to Prime, a
// row of Nova to Nova and a row with no team to General. Family always plays its two panels, so the
// Monday rows for both teams go nowhere else. A view that finds no rows of its own starts with the
// rows of defaultViews (view-defaults.js). While no Screen has rows, they come from the Panel order
// the same way an empty Screen is filled (screen-seed.js).
//
// Plain functions only, so that tests/view-seed.test.mjs can run them with node.

import { seedRows } from './screen-seed.js';
import { defaultViews, familyPanels } from './view-defaults.js';

// The Screens in the order their rows are looked for
const screenOrder = ['screen-original', 'screen-cybertron', 'screen-minimal'];

function rowsOf(list) {
  return Array.isArray(list) ? list.filter(row => row && typeof row.panel === 'string' && row.panel !== '') : [];
}

// The rows a view is split from: { main, side }. screens is the Screen documents read from
// Sanity, rotation the Panel order of Dashboard Settings and teamCodes the codes of the active teams.
export function sourceRows(screens, rotation, teamCodes) {
  const found = Array.isArray(screens) ? screens : [];
  const withMain = screenOrder.map(id => found.filter(screen => screen && screen._id === id)[0]).filter(screen => screen && rowsOf(screen.mainRows).length > 0)[0];
  const withSide = screenOrder.map(id => found.filter(screen => screen && screen._id === id)[0]).filter(screen => screen && rowsOf(screen.sideRows).length > 0)[0];
  const seeded = seedRows(rotation, teamCodes);

  return {
    main: rowsOf(withMain ? withMain.mainRows : seeded.mainRows),
    side: rowsOf(withSide ? withSide.sideRows : seeded.sideRows),
  };
}

// A row without the keys Sanity adds, so the same row can be given a key of its own
function plainRow(row) {
  const copy = {};
  Object.keys(row).forEach(name => {
    if (name !== '_key' && name !== '_type') copy[name] = row[name];
  });
  return copy;
}

// The rows of the main panel of one view. A view that is for a team takes the rows of that team and
// General the rows with no team. Family takes none: its rows are the locked pair.
export function mainRowsFor(key, rows) {
  if (key === 'family') return familyPanels.map(panel => ({ panel: panel, seconds: 30 }));
  const mine = rows.filter(row => (key === 'general' ? !row.team : row.team === key)).map(plainRow);
  return mine.length > 0 ? mine : defaultViews[key].panels.map(plainRow);
}

// The side panel rows of one view. Only General has them.
export function sideRowsFor(key, rows) {
  if (key !== 'general') return [];
  return rows.length > 0 ? rows.map(plainRow) : defaultViews.general.sidePanels.map(plainRow);
}

// Everything a view is filled with the first time it is opened. read is { settings, teams, screens }
// as view-input.js reads them. team is the id of the team document of a team view, or nothing.
export function seedView(key, read) {
  const source = read || {};
  const teams = Array.isArray(source.teams) ? source.teams : [];
  const rotation = source.settings && typeof source.settings === 'object' ? source.settings.rotation : null;
  const rows = sourceRows(source.screens, rotation, teams.map(team => team.code));
  const start = defaultViews[key];
  const team = teams.filter(item => item.code === key)[0];

  const view = {
    key: key,
    minutes: start.minutes,
    layout: start.layout,
    mirror: start.mirror,
    countdownIn: start.countdownIn,
    viewTag: start.viewTag,
    teamChip: start.teamChip,
    colors: start.colors,
    panels: mainRowsFor(key, rows.main),
    sidePanels: sideRowsFor(key, rows.side),
  };
  if (team && team._id && (key === 'prime' || key === 'nova')) view.team = { _type: 'reference', _ref: team._id };
  return view;
}

// True while the main panel list has no rows, which is when a view is filled
export function needsViewSeed(view) {
  return !view || !Array.isArray(view.panels) || view.panels.length === 0;
}

// Every row needs a key of its own, such as panels-3
export function withKeys(rows, prefix) {
  return rows.map((row, index) => Object.assign({ _key: prefix + '-' + (index + 1) }, row));
}
