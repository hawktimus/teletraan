// The panels a row of a Screen can name, and what a row may say about the team. The values are
// the ids in dashboard/registry.js: the large panels go in the main panel (B) and the small
// panels in the side panel (D). The Monday cards are offered as three rows, and the cards of
// both teams are the same rows with the team Both teams. tests/schemas.test.mjs fails if a list
// differs from the registry.
//
// Plain functions and numbers only, so that tests/screen-seed.test.mjs can run them with node.

export const largePanels = [
  { title: 'Tasks', value: 'tasks' },
  { title: 'Upcoming events', value: 'events' },
  { title: 'Daily Agenda', value: 'tonight' },
  { title: 'Subteam spotlight', value: 'spotlight' },
  { title: 'Sponsor feature', value: 'sponsor-feature' },
  { title: 'Photo', value: 'photo' },
  { title: 'Leadership', value: 'leadership' },
  { title: 'Team leads', value: 'team-leads' },
  { title: 'Subteam roster', value: 'roster' },
  { title: 'Extra panel', value: 'custom' },
];

// The two panels that are placed in the Rotation list now and designed later. They draw their title and a dashed frame, and are
// not in the older lists (Panel order, the rows of a Screen), so a list built from those never holds them.
export const placeholderPanels = [
  { title: 'Robot status', value: 'robotStatus' },
  { title: 'Wireframe view', value: 'wireframe' },
];

export const smallPanels = [
  { title: 'Task counts', value: 'task-counts' },
  { title: 'Next event', value: 'next-event' },
  { title: 'Weather forecast', value: 'forecast' },
  { title: 'Safety days', value: 'safety-days' },
  { title: 'Sponsor logo', value: 'sponsor-logo' },
];

// The panels of the one task board, in the order the Studio offers them. The ids are the ones of dashboard/config.js
// (mondayKinds). The older Monday panels are not offered: a saved row that names one plays as the tasks panel.
export const mondayPanels = [
  { title: 'Monday: Tasks by team and department', value: 'monday-tasks' },
  { title: 'Monday: Done by team', value: 'monday-done' },
  { title: 'Monday: Status by department', value: 'monday-status-depts' },
  { title: 'Monday: Overall progress', value: 'monday-overall' },
  { title: 'Monday: Timeline by team', value: 'monday-timeline' },
  { title: 'Monday: Board by team', value: 'monday-board' },
  { title: 'Monday: Status pie by team', value: 'monday-pie' },
];

// The older Monday panels, only so that a saved row can still be named in a list line
export const olderMondayPanels = [
  { title: 'Monday: Milestones (older)', value: 'monday-milestones' },
  { title: 'Monday: Progress (older)', value: 'monday-progress' },
  { title: 'Monday: Milestones, both teams (older)', value: 'monday-milestones-both' },
  { title: 'Monday: Progress, both teams (older)', value: 'monday-progress-both' },
];

// The Monday rows an empty Screen is filled with for each team (mondayRows in dashboard/config.js)
export const seededMondayPanels = ['monday-tasks', 'monday-done', 'monday-board'];

// What a row of each Monday panel says about the team and the department (mondayKinds in dashboard/config.js)
export const mondayKinds = {
  'monday-tasks': 'department',
  'monday-done': 'team',
  'monday-status-depts': 'none',
  'monday-overall': 'none',
  'monday-timeline': 'team',
  'monday-board': 'team',
  'monday-pie': 'team',
};

// The large panels whose items carry a Team field and are filtered by the team on the screen
// (visibleItems in dashboard/core/content.js). Photo and Upcoming events are for both teams:
// a photo has no team, and the events come from the calendars. The dashboard has the same list.
export const teamSpecificPanels = ['tasks', 'tonight', 'spotlight', 'team-leads', 'roster', 'leadership', 'sponsor-feature', 'custom'];

// The team of a row of the older Monday panels that was for both teams. A row cannot be set to it now.
export const bothTeams = 'both';

export function idsOf(list) {
  return list.map(panel => panel.value);
}

// The title of a panel in the pickers, or nothing for a panel that is not in them
export function panelTitle(panel) {
  const found = largePanels.concat(smallPanels, placeholderPanels, mondayPanels, olderMondayPanels).filter(item => item.value === panel)[0];
  return found ? found.title : '';
}

// What a row of the main panel may say about the team:
//   none       the panel is for both teams, so the row has no team
//   optional   a team, or blank to keep the team that is on the screen
//   one        a team (the Monday panels of one team)
export function teamKindOf(panel) {
  if (mondayKinds[panel] === 'none') return 'none';
  if (mondayKinds[panel]) return 'one';
  if (olderMondayPanels.some(item => item.value === panel)) return 'one';
  return teamSpecificPanels.indexOf(panel) !== -1 ? 'optional' : 'none';
}

// Whether a row of this panel takes a department, a Team lead
export function takesDepartment(panel) {
  return mondayKinds[panel] === 'department';
}

// The lines of the team picker of a row: { value, label }. teams is [{ code, label }], the active
// teams in order. A panel that is for both teams offers nothing.
export function teamChoices(panel, teams) {
  const kind = teamKindOf(panel);
  const named = (teams || []).map(team => ({ value: team.code, label: team.label }));

  if (kind === 'none') return [];
  if (kind === 'optional') return [{ value: '', label: 'Keep the team on the screen' }].concat(named);
  return named;
}

// Why the team of a row is wrong, in plain words, or nothing when it is right
export function teamProblem(panel, team) {
  const value = typeof team === 'string' ? team : '';
  const kind = teamKindOf(panel);

  if (!panel) return '';
  if (kind === 'none') return value ? 'This panel is for both teams. Clear the team.' : '';
  if (kind === 'optional') return value === bothTeams ? 'Both teams is only for Monday rows. Pick a team or clear it.' : '';
  if (value === '') return 'Pick the team for this Monday row.';
  return value === bothTeams ? 'This Monday panel is for one team. Pick a team.' : '';
}

// A team code in words, for the list line of a row
export function teamWord(code) {
  if (code === bothTeams) return 'Both teams';
  return typeof code === 'string' && code !== '' ? code.charAt(0).toUpperCase() + code.slice(1) : '';
}
