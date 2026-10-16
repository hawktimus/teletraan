// The first rows of a Screen. A Screen whose main panel list (B) is empty is filled once, when it
// is opened in Studio, from the Panel order that the screen follows now (screen-input.js). The
// dashboard works the list out the same way for a Screen that has none, so nothing goes blank
// before anyone opens Studio.
//
// The main panel rows come in this order: for each active team, in order, the team-specific large
// panels as rows with that team, then three Monday rows of that team (tasks, done and board); and after the last
// team, the large panels that are for both teams, with no team. Seconds carry over, and a row with
// none has none. A panel that is in the Panel order twice has two rows. A row that was switched
// off in the Panel order is left out: a row of a Screen has no switch, and it would start to show.
// The side panel rows (D) are the small rows of the same Panel order, in order, with no team.
//
// The Panel order is the list rotation.order of Dashboard Settings. While that is empty it is the
// older list rotation.grid1 (large panels) followed by rotation.grid2 (small panels). An older list
// that was never saved is the starting list, every panel of its area in the order of the pickers,
// because the page puts the starting settings under the saved ones (withDefaults in
// dashboard/core/content.js). A list that was saved empty stays empty. The dashboard works the rows
// out the same way (dashboard/core/screen-seed.js) and tools/test-screen-seed-parity.mjs checks both.
//
// Plain functions only, so that tools/test-screen-seed.mjs can run them with node.

import { largePanels, smallPanels, seededMondayPanels, teamSpecificPanels, idsOf } from '../inputs/screen-panels.js';
import { screenStyles } from '../inputs/screen-ids.js';

const largeIds = idsOf(largePanels);
const smallIds = idsOf(smallPanels);

// The style of the Monday rows when Dashboard Settings has none. The same as mondayStyle in
// defaultSettings in dashboard/config.js.
export const startingMondayStyle = 'minimal';

// The team the screen has when no team document is active. The same as the built-in team in
// dashboard/config.js.
export const builtInTeam = 'prime';

function startingRows(ids) {
  return ids.map(panel => ({ panel: panel, show: true }));
}

function rowsOf(list, ids) {
  return Array.isArray(list) ? list.filter(step => step && ids.indexOf(step.panel) !== -1) : startingRows(ids);
}

// The rows of the Panel order, large and small together, as the screen follows them now
export function currentOrder(rotation) {
  const source = rotation && typeof rotation === 'object' ? rotation : {};

  if (Array.isArray(source.order) && source.order.length > 0) return source.order;
  return rowsOf(source.grid1, largeIds).concat(rowsOf(source.grid2, smallIds));
}

function secondsOf(step) {
  return typeof step.seconds === 'number' && step.seconds > 0 ? { seconds: step.seconds } : {};
}

// The rows to start from. teamCodes are the codes of the active teams in order, such as
// ['prime', 'nova']. With none, the screen has only the built-in team.
export function seedRows(rotation, teamCodes) {
  const order = currentOrder(rotation).filter(step => step && step.show !== false);
  const large = order.filter(step => largeIds.indexOf(step.panel) !== -1);
  const small = order.filter(step => smallIds.indexOf(step.panel) !== -1);
  const teams = Array.isArray(teamCodes) && teamCodes.length > 0 ? teamCodes : [builtInTeam];
  const mainRows = [];

  teams.forEach(code => {
    large.filter(step => teamSpecificPanels.indexOf(step.panel) !== -1).forEach(step => {
      mainRows.push(Object.assign({ panel: step.panel, team: code }, secondsOf(step)));
    });
    seededMondayPanels.forEach(panel => mainRows.push({ panel: panel, team: code }));
  });
  large.filter(step => teamSpecificPanels.indexOf(step.panel) === -1).forEach(step => {
    mainRows.push(Object.assign({ panel: step.panel }, secondsOf(step)));
  });

  const sideRows = small.map(step => Object.assign({ panel: step.panel }, secondsOf(step)));
  return { mainRows: mainRows, sideRows: sideRows };
}

// Everything a Screen is filled with the first time it is opened. style is original, cybertron or
// minimal. settings is the published Dashboard Settings, or null when there is none. Minimal has
// no side panel, so it gets no side rows. The Monday style comes from the old setting.
export function seedScreen(style, settings, teamCodes) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const rows = seedRows(source.rotation, teamCodes);

  return {
    mainRows: rows.mainRows,
    sideRows: style === 'minimal' ? [] : rows.sideRows,
    mondayStyle: screenStyles.indexOf(source.mondayStyle) !== -1 ? source.mondayStyle : startingMondayStyle,
  };
}

// True while the main panel list has no rows, which is when a Screen is filled
export function needsSeed(screen) {
  return !screen || !Array.isArray(screen.mainRows) || screen.mainRows.length === 0;
}

// Every row needs a key of its own, such as main-3
export function withKeys(rows, prefix) {
  return rows.map((row, index) => Object.assign({ _key: prefix + '-' + (index + 1) }, row));
}
