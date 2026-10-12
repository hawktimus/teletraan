// The panels a row of a Screen can name, and what a row may say about the team. The values are
// the ids in dashboard/registry.js: the large panels go in the main panel (B) and the small
// panels in the side panel (D). The Monday cards are offered as three rows, and the cards of
// both teams are the same rows with the team Both teams. check-schemas.mjs fails if a list
// differs from the registry.
//
// Plain functions and numbers only, so that tools/test-screen-seed.mjs can run them with node.

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

export const smallPanels = [
  { title: 'Task counts', value: 'task-counts' },
  { title: 'Next event', value: 'next-event' },
  { title: 'Weather forecast', value: 'forecast' },
  { title: 'Safety days', value: 'safety-days' },
  { title: 'Sponsor logo', value: 'sponsor-logo' },
];

// In the order a team plays them: the Build team card, then Milestones, then Progress
export const mondayPanels = [
  { title: 'Monday: Build team', value: 'monday-tasks' },
  { title: 'Monday: Milestones', value: 'monday-milestones' },
  { title: 'Monday: Progress', value: 'monday-progress' },
];

// The large panels whose items carry a Team field and are filtered by the team on the screen
// (visibleItems in dashboard/core/content.js). Photo and Upcoming events are for both teams:
// a photo has no team, and the events come from the calendars. The dashboard has the same list.
export const teamSpecificPanels = ['tasks', 'tonight', 'spotlight', 'team-leads', 'roster', 'leadership', 'sponsor-feature', 'custom'];

// The team of a row that is for both teams. Only the Milestones and Progress cards have one.
export const bothTeams = 'both';

export function idsOf(list) {
  return list.map(panel => panel.value);
}

// The title of a panel in the pickers, or nothing for a panel that is not in them
export function panelTitle(panel) {
  const found = largePanels.concat(smallPanels, mondayPanels).filter(item => item.value === panel)[0];
  return found ? found.title : '';
}

// What a row of the main panel may say about the team:
//   none       the panel is for both teams, so the row has no team
//   optional   a team, or blank to keep the team that is on the screen
//   one        a team (the Build team card is for one team)
//   oneOrBoth  a team or Both teams (Milestones and Progress)
export function teamKindOf(panel) {
  if (panel === 'monday-tasks') return 'one';
  if (idsOf(mondayPanels).indexOf(panel) !== -1) return 'oneOrBoth';
  return teamSpecificPanels.indexOf(panel) !== -1 ? 'optional' : 'none';
}

// The lines of the team picker of a row: { value, label }. teams is [{ code, label }], the active
// teams in order. A panel that is for both teams offers nothing.
export function teamChoices(panel, teams) {
  const kind = teamKindOf(panel);
  const named = (teams || []).map(team => ({ value: team.code, label: team.label }));

  if (kind === 'none') return [];
  if (kind === 'optional') return [{ value: '', label: 'Keep the team on the screen' }].concat(named);
  return kind === 'oneOrBoth' ? named.concat([{ value: bothTeams, label: 'Both teams' }]) : named;
}

// Why the team of a row is wrong, in plain words, or nothing when it is right
export function teamProblem(panel, team) {
  const value = typeof team === 'string' ? team : '';
  const kind = teamKindOf(panel);

  if (!panel) return '';
  if (kind === 'none') return value ? 'This panel is for both teams. Clear the team.' : '';
  if (kind === 'optional') return value === bothTeams ? 'Both teams is only for Monday rows. Pick a team or clear it.' : '';
  if (value === '') return kind === 'one' ? 'Pick the team for this Monday row.' : 'Pick a team, or Both teams, for this Monday row.';
  return kind === 'one' && value === bothTeams ? 'The Build team card is for one team. Pick a team.' : '';
}

// A team code in words, for the list line of a row
export function teamWord(code) {
  if (code === bothTeams) return 'Both teams';
  return typeof code === 'string' && code !== '' ? code.charAt(0).toUpperCase() + code.slice(1) : '';
}
