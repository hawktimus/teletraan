// The checks of the Rotation list for the Check the screen report (content-check.js): rows the wall will always skip,
// two panels that show the same topic at once, a row that repeats the one above it, and rows for a team that is not there. Plain functions only.
//
// A row is { view, panel, side, part, department, list, chart, seconds, shown }. The panels and their topics are those of
// dashboard/registry.js (tests/content-check.test.mjs compares the two). The Rotation board already knows which Monday rows
// and Photo rows have nothing to show (skipNotes in rotation-board.js), so those notes are used and not worked out twice.

import { skipNotes, isShown, retiredNote } from './rotation-board.js';
import { panelTitleOf } from './rotation-titles.js';

// panel id: [topic, region]. Grid 1 and Grid 2 never show the same topic at once.
export const panelTopics = {
  tasks: ['tasks', 'grid1'],
  events: ['events', 'grid1'],
  tonight: ['plan', 'grid1'],
  spotlight: ['subteams', 'grid1'],
  'sponsor-feature': ['sponsors', 'grid1'],
  photo: ['photo', 'grid1'],
  leadership: ['people', 'grid1'],
  'team-leads': ['subteams', 'grid1'],
  roster: ['subteams', 'grid1'],
  driveHours: ['subteams', 'grid1'],
  'frc-news': ['news', 'grid1'],
  custom: ['custom', 'grid1'],
  robotStatus: ['robot', 'grid1'],
  wireframe: ['wireframe', 'grid1'],
  'competition-rank': ['competition', 'grid1'],
  'monday-department': ['monday', 'grid1'],
  'monday-charts': ['monday', 'grid1'],
  'task-counts': ['tasks', 'grid2'],
  'next-event': ['events', 'grid2'],
  forecast: ['weather', 'grid2'],
  'safety-days': ['safety', 'grid2'],
  'sponsor-logo': ['sponsors', 'grid2'],
  miniIdea1: ['mini', 'grid2'],
  qrParts: ['parts', 'grid2'],
};

// The panels of the Robotics view that use the wide layout, which has no small panel (wideRoboticsPanels in rotation-board.js)
const wideRoboticsPanels = ['monday-department', 'monday-charts', 'roster', 'driveHours', 'robotStatus', 'wireframe'];

function rowWords(row, index) {
  return 'Row ' + (index + 1) + ' (' + (panelTitleOf(row.panel) || row.panel || 'no panel') + ')';
}

function isLive(item, now) {
  if (!item || item.show === false) return false;
  return !item.expires || Date.parse(item.expires) > now.getTime();
}

function forTeam(item, code) {
  const own = item.teamCode || '';
  return code === '' || own === '' || own === code;
}

function teamOfView(view) {
  return view === 'prime' || view === 'nova' ? view : '';
}

// The one piece of text that tells two rows apart
function signature(row) {
  return [row.view, row.panel, row.side, row.part, row.department, row.list, row.chart, row.team].map(part => String(part === undefined ? '' : part)).join('|');
}

// What each panel needs to have something to show: a function from (live items of the team) to true when it has.
function needs(row, data, code) {
  const live = name => (data[name] || []).filter(item => forTeam(item, code));
  if (row.panel === 'leadership') return live('people').length > 0 ? '' : 'no person on Leadership is showing';
  if (row.panel === 'team-leads' || row.panel === 'roster') return live('subteams').length > 0 ? '' : 'no team lead is showing';
  if (row.panel === 'spotlight') return live('subteams').some(item => item.spotlight === true) ? '' : 'no subteam has In the spotlight turned on';
  if (row.panel === 'sponsor-feature') return live('sponsors').length > 0 ? '' : 'no sponsor is showing';
  if (row.panel === 'custom') return live('customPanels').length > 0 ? '' : 'no Extra panel is showing';
  return '';
}

function sideNeeds(row, data, code) {
  if (row.side !== 'sponsor-logo') return '';
  const logos = (data.sponsors || []).filter(item => forTeam(item, code) && typeof item.logoAddress === 'string' && item.logoAddress.trim() !== '');
  return logos.length > 0 ? '' : 'no sponsor with a logo is showing';
}

// The problems of the list, as { index, level, code, message, fix, field }. rows are the rows of the Rotation list, now is a
// date, and data holds the live lists the wall reads: { people, subteams, sponsors, customPanels, tasks, photos, teams }, each
// item with its teamCode, show, expires and other fields. tasks and photos are in the shape of skipQuestion in rotation-board.js.
export function rotationTrouble(rows, data, now = new Date()) {
  const list = (Array.isArray(rows) ? rows : []).map((row, index) => Object.assign({}, row, { _key: 'row' + index }));
  const live = {};
  ['people', 'subteams', 'sponsors', 'customPanels'].forEach(name => {
    live[name] = (data[name] || []).filter(item => isLive(item, now));
  });
  const found = [];
  const add = (index, level, code, message, fix) => found.push({ index: index, level: level, code: code, message: message, fix: fix, field: 'rotationRows' });

  if (list.length > 0 && !list.some(isShown)) {
    add(-1, 'warning', 'rotation-all-hidden', 'Every row of the Rotation is hidden, so the wall plays the standard list instead.', 'Turn Shown on for the rows you want, or leave it if the standard list is what you want.');
  }

  const notes = skipNotes(list, { tasks: data.tasks || [], photos: data.photos || [] }, now);
  const teamCodes = (data.teams || []).filter(team => team.active !== false).map(team => team.code);
  let before = null;

  list.forEach((row, index) => {
    const known = panelTopics[row.panel];
    const retired = retiredNote(row);
    const words = rowWords(row, index);

    if (retired !== '') {
      add(index, 'warning', 'rotation-retired', words + ' is a Monday panel from the older sync, so it plays nothing.', 'Change the panel to Department tasks or the TV charts, or delete the row.');
      return;
    }
    if (!known) {
      add(index, 'problem', 'rotation-unknown-panel', words + ' names a panel the wall does not have, so it is skipped.', 'Pick a panel from the list for this row, or delete the row.');
      return;
    }
    if (!isShown(row)) return;

    if (before !== null && signature(list[before]) === signature(row)) {
      add(index, 'warning', 'rotation-repeat', words + ' is the same as row ' + (before + 1) + ', right above it. The wall shows it twice in a row.', 'Delete one of the two rows, or change one of them.');
    }
    before = index;

    const view = teamOfView(row.view);
    if (view !== '' && !teamCodes.includes(view) && (data.teams || []).length > 0) {
      add(index, 'problem', 'rotation-no-team', words + ' is in the ' + view + ' view, and there is no active team with the code ' + view + ', so it is skipped.', 'Turn the team on under Teams and views, or move the row to the Robotics view.');
      return;
    }

    if (notes[row._key]) {
      add(index, 'problem', 'rotation-nothing-to-show', words + ' is skipped now. ' + notes[row._key].replace(/^Skipped now: /, ''), 'Add what it needs, or turn Shown off for the row.');
    } else {
      const missing = needs(row, live, view) || '';
      if (missing !== '') add(index, 'problem', 'rotation-nothing-to-show', words + ' is skipped now, because ' + missing + '.', 'Add what it needs, or turn Shown off for the row.');
    }

    if (row.side) {
      const same = panelTopics[row.panel][0] === (panelTopics[row.side] || [])[0];
      if (same) {
        add(index, 'warning', 'rotation-same-topic', words + ' and its small panel both show ' + panelTopics[row.panel][0] + ', so the screen says the same thing twice.', 'Pick a small panel about something else.');
      }
      const lacking = sideNeeds(row, live, view);
      if (lacking !== '') add(index, 'warning', 'rotation-side-empty', words + ' has the small panel Sponsor logo, and ' + lacking + '.', 'Add a logo address to a sponsor, or pick another small panel.');
      if (row.view === 'robotics' && wideRoboticsPanels.includes(row.panel)) {
        add(index, 'warning', 'rotation-side-unused', words + ' uses the wide layout, which has no small panel, so the small panel is not drawn.', 'Clear the small panel for this row.');
      }
    }

    if (typeof row.seconds === 'number' && row.seconds > 0 && row.seconds < 6 && row.panel !== 'photo') {
      add(index, 'warning', 'rotation-seconds', words + ' has ' + row.seconds + ' seconds. The wall never stays less than 6.', 'Use 6 seconds or more.');
    }
  });
  return found;
}
