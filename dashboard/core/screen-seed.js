// The rows of a Screen built from the Panel order: the plain functions. They know nothing about the page, so
// tools/test-screen-seed.mjs can run them. core/screens.js plays them for a Screen that has no rows, and the Studio
// fills an empty list of rows with the same rule, written again there, so the first rows an editor sees are the ones
// the screen was playing.
//
// The Panel order is rotation in Dashboard Settings: one list, or the two older lists while it is empty
// (core/panel-order.js, playlistOf). The rows of the large panel come out in this order:
//   for each team, in the order of the Teams: its panels (the ones that follow the team, teamPanels in config.js), then
//   its three Monday rows (mondayRows); after the last team, the panels that are the same for both teams
// The rows of the small panel are the small panels of the same order, with no team.

import { mondayRows, teamPanels } from '../config.js';
import { playlistOf } from './panel-order.js';

function seedRow(step, team) {
  const row = { panel: step.panel };
  if (team !== undefined) row.team = team;
  if (typeof step.seconds === 'number' && step.seconds > 0) row.seconds = step.seconds;
  return row;
}

// The rows of the large panel. A row that is switched off is not carried over, because a row of a Screen has no
// switch. Seconds carry over, and a panel that comes twice comes twice. teams is a list of { code }.
export function seedMainRows(rotation, teams) {
  const large = playlistOf(rotation, 'grid1').filter(step => step.show !== false);
  const rows = [];

  teams.forEach(team => {
    large.filter(step => teamPanels.includes(step.panel)).forEach(step => rows.push(seedRow(step, team.code)));
    mondayRows.forEach(panel => rows.push({ panel: panel, team: team.code }));
  });
  large.filter(step => !teamPanels.includes(step.panel)).forEach(step => rows.push(seedRow(step, '')));
  return rows;
}

// The rows of the small panel: its small panels, in the order they have there
export function seedSideRows(rotation) {
  return playlistOf(rotation, 'grid2').filter(step => step.show !== false).map(step => seedRow(step));
}
