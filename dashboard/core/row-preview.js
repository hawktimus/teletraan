// The address of the control page's Display tab (docs/control-page.md, "Pictures of a row"). It opens
//   /dashboard/?rowpreview=<one row as JSON>
// in a small frame, and the dashboard draws that one row and holds it, on the data the wall reads. Only plain
// functions are here, so tests/row-preview.test.mjs can read them with node.
//
// The JSON is a row of the rotation list: { view, panel, side, department, list, chart, team, part, photoCount,
// secondsPerPhoto }. A field that is not in that list is dropped, and a value that is too long or has odd characters
// makes the whole row unreadable, which draws an error line and never the live dashboard.
//
// A page with ?rowpreview= is read only: core/row-preview-guard.js stops writes, and shell.js leaves out the
// rotation, the takeovers, the hidden effects, the night screen, the heartbeat and the report to the control page.

import { viewKeys, viewTeams } from '../config.js';
import { upgradeMondayRow } from './rotation.js';

export const rowPreviewName = 'rowpreview';
export const longestRow = 1500;
export const unreadablePanel = 'row-unreadable';

// The rotation rows say robotics where the dashboard says general
// family is the Condensed view, which the control page can preview before it is pushed
const viewOfRow = { robotics: 'general', prime: 'prime', nova: 'nova', family: 'family' };
const wordFields = ['panel', 'view', 'side', 'department', 'list', 'chart', 'team'];
const numberFields = ['part', 'photoCount', 'secondsPerPhoto'];
const plainWord = /^[A-Za-z0-9._ -]{1,60}$/;

// The row in the address: { row } when it can be read, { error } when it cannot, null when the address has none.
// search is the part after the ? and may be a URLSearchParams.
export function readRowPreview(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
  if (!params.has(rowPreviewName)) return null;

  const text = params.get(rowPreviewName) || '';
  if (text.length > longestRow) return { error: 'The row is too long.' };

  let found;
  try {
    found = JSON.parse(text);
  } catch (error) {
    return { error: 'The row is not JSON.' };
  }
  if (!found || typeof found !== 'object' || Array.isArray(found)) return { error: 'The row is not an object.' };

  const row = {};
  for (const name of wordFields) {
    if (found[name] === undefined || found[name] === '') continue;
    if (typeof found[name] !== 'string' || !plainWord.test(found[name])) return { error: 'The ' + name + ' of the row is not plain text.' };
    row[name] = found[name];
  }
  for (const name of numberFields) {
    if (found[name] === undefined || found[name] === '') continue;
    if (!Number.isInteger(found[name]) || found[name] < 0 || found[name] > 999) return { error: 'The ' + name + ' of the row is not a small whole number.' };
    row[name] = found[name];
  }
  if (!row.panel || !/^[A-Za-z0-9-]+$/.test(row.panel)) return { error: 'The row has no panel.' };
  return { row: row };
}

// The switches of a row that the still address already reads (core/still.js). They are put in the page's own list,
// so the code after this needs nothing new. A row that cannot be read asks for a panel that does not exist, and the page
// writes the reason where the screenshot tool reads it (core/still-run.js).
export function useRowPreview(params, read) {
  // An older Monday row is drawn as the Department tasks row the wall plays, and a Monday row of Robotics in the Condensed view
  const row = upgradeMondayRow(read.row || { panel: unreadablePanel });
  const monday = row.panel.indexOf('monday-') === 0;
  // A Monday row of Robotics plays in the view of its team: Condensed for both teams, Prime or Nova for their own. A Roster row
  // of Robotics with a team plays in that team's view too (playViewOf in core/views-play.js).
  const own = row.team === 'prime' || row.team === 'nova' ? row.team : '';
  const robotics = viewOfRow[row.view] === 'general';
  const view = monday && robotics ? (own || 'family') : row.panel === 'roster' && robotics && own ? own : viewOfRow[row.view] || '';

  params.set('panel', row.panel);
  params.set('still', '1');
  params.set('small', '1');
  // A team view gives its team to the row. A Monday row names the team of its tasks in row.team, and with none has the team of its
  // view, as the wall does
  const team = monday || !view ? (row.team || viewTeams[view] || '') : viewTeams[view] || '';
  if (team !== '') params.set('team', team);
  if (view !== '' && viewKeys.includes(view)) params.set('view', view);
  if (row.department) params.set('dept', row.department);
  if (row.list) params.set('list', row.list);
  if (row.chart) params.set('chart', row.chart);
  if (row.side) params.set('side', row.side);
  if (row.part) params.set('part', String(row.part));
  if (row.photoCount) params.set('photos', String(row.photoCount));
  if (row.secondsPerPhoto) params.set('each', String(row.secondsPerPhoto));
  return params;
}
