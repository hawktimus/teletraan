// The panels a row of a Screen or of the Rotation can name, and what a row may say about the team. The values are
// the ids in dashboard/registry.js: the large panels go in the main panel (B) and the small
// panels in the side panel (D). tests/schemas.test.mjs fails if a list differs from the registry.
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

// The panels a row of the rotation can name that no older list holds: the competition rank card, which the row plays for the team
// of its view, Drive hours, FRC news, and the two small panels that only a row can pair with a large one (rotationOnly in dashboard/registry.js)
export const rotationPanels = [{ title: 'Competition: Rank', value: 'competition-rank' }, { title: 'Competition: Team metrics', value: 'competition-team-metrics' }, { title: 'Drive hours', value: 'driveHours' }, { title: 'FRC news', value: 'frc-news' }];
export const pairedPanels = [
  { title: 'Mini panel idea 1', value: 'miniIdea1' },
  { title: 'Parts request (QR code)', value: 'qrParts' },
];

export const smallPanels = [
  { title: 'Task counts', value: 'task-counts' },
  { title: 'Next event', value: 'next-event' },
  { title: 'Weather forecast', value: 'forecast' },
  { title: 'Safety days', value: 'safety-days' },
  { title: 'Sponsor logo', value: 'sponsor-logo' },
];

// The two Monday panels (docs/monday.md). The ids are the ones of dashboard/config.js (mondayKinds).
export const mondayPanels = [
  { title: 'Monday: Department tasks', value: 'monday-department' },
  { title: 'Monday: TV charts', value: 'monday-charts' },
];

// The eleven Monday panels of the older sync (retiredMondayPanels in dashboard/config.js). They are offered nowhere. A stored
// row that names one keeps its place, plays nothing, and says Retired, use Department tasks.
export const olderMondayPanels = [
  'monday-tasks', 'monday-done', 'monday-status-depts', 'monday-overall', 'monday-timeline', 'monday-board', 'monday-pie',
  'monday-milestones', 'monday-progress', 'monday-milestones-both', 'monday-progress-both',
].map(id => ({ title: 'Retired Monday panel (' + id + ')', value: id }));

// The Monday rows an empty Screen is filled with for each team (mondayRows in dashboard/config.js)
export const seededMondayPanels = ['monday-charts'];

// What a row of each Monday panel says (mondayKinds in dashboard/config.js)
export const mondayKinds = { 'monday-department': 'department', 'monday-charts': 'chart' };

// The nine departments, the lists and the charts the Rotation board offers for the two Monday panels (the same lists as
// mondayDepartments, mondayLists and mondayCharts in dashboard/config-lists.js). The teams are in tools/rotation-board.js.
export const mondayDepartmentChoices = [
  { value: 'build', title: 'Build' }, { value: 'electrical', title: 'Electrical' }, { value: 'programming', title: 'Programming' },
  { value: 'design', title: 'Design' }, { value: 'cnc', title: 'CNC' }, { value: 'strategy', title: 'Strategy' },
  { value: 'operations', title: 'Operations' }, { value: 'business', title: 'Business' }, { value: 'marketing', title: 'Marketing' },
];
export const mondayListChoices = [{ value: 'open', title: 'Open' }, { value: 'done', title: 'Done' }];
export const mondayChartChoices = [{ value: 'status', title: 'Status by department' }, { value: 'progress', title: 'Overall progress' }, { value: 'timeline', title: 'Timeline' }];

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
  const found = largePanels.concat(smallPanels, pairedPanels, rotationPanels, placeholderPanels, mondayPanels, olderMondayPanels).filter(item => item.value === panel)[0];
  return found ? found.title : '';
}

// What a row of the main panel may say about the team:
//   none       the panel is for both teams, so the row has no team
//   optional   a team, or blank: the team on the screen, or for a Monday panel the tasks of both teams
export function teamKindOf(panel) {
  if (mondayKinds[panel]) return 'optional';
  return teamSpecificPanels.indexOf(panel) !== -1 ? 'optional' : 'none';
}

// Whether a row of this panel takes a department: Department tasks, one of the nine
export function takesDepartment(panel) {
  return mondayKinds[panel] === 'department';
}

// The lines of the team picker of a row: { value, label }. teams is [{ code, label }], the active
// teams in order. A panel that is for both teams offers nothing. Blank on a Monday row is both teams.
export function teamChoices(panel, teams) {
  if (teamKindOf(panel) === 'none') return [];
  const blank = mondayKinds[panel] ? 'Both' : 'Keep the team on the screen';
  return [{ value: '', label: blank }].concat((teams || []).map(team => ({ value: team.code, label: team.label })));
}

// Why the team of a row is wrong, in plain words, or nothing when it is right
export function teamProblem(panel, team) {
  const value = typeof team === 'string' ? team : '';

  if (!panel) return '';
  if (teamKindOf(panel) === 'none') return value ? 'This panel is for both teams. Clear the team.' : '';
  return value === bothTeams ? 'Pick a team, or leave it blank.' : '';
}

// A team code in words, for the list line of a row
export function teamWord(code) {
  if (code === bothTeams) return 'Both teams';
  return typeof code === 'string' && code !== '' ? code.charAt(0).toUpperCase() + code.slice(1) : '';
}
