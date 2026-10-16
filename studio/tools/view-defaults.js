// What each View starts with. The dashboard has the same shape as defaultViews in
// dashboard/config.js, and tests/schemas.test.mjs compares them when that name exists there.
// A row of panels is { panel, seconds } with a team on the Monday rows and, for the tasks row,
// no department: the screen plays one row for each Team lead that is on the Monday board.
//
//   layout       standard (banner, main panel, countdown and small panels) or bar (banner across the
//                top, a column at one side, one main panel). The look is not set here, only the arrangement
//   mirror       true puts the column on the other side
//   countdownIn  side (the side column over the small panels) or banner
//   viewTag      the name of the view in small letters at the far edge of the banner
//   teamChip     the team chip on the cards of the view
//   colors       team (the colors of the team document) or general (the colors of the screen)

export const monday = (panel, team) => ({ panel: panel, team: team, seconds: 30 });

function teamRows(team) {
  return [monday('monday-tasks', team), monday('monday-done', team), monday('monday-timeline', team), monday('monday-board', team)];
}

export const defaultViews = {
  general: {
    minutes: 6,
    layout: 'standard',
    mirror: false,
    countdownIn: 'side',
    viewTag: true,
    teamChip: false,
    colors: 'general',
    panels: [
      { panel: 'tonight', seconds: 45 },
      { panel: 'events', seconds: 60 },
      { panel: 'leadership', seconds: 20 },
      { panel: 'photo', photoCount: 4, secondsPerPhoto: 10 },
      { panel: 'sponsor-feature', seconds: 15 },
    ],
    sidePanels: [
      { panel: 'next-event', seconds: 30 },
      { panel: 'task-counts', seconds: 20 },
      { panel: 'safety-days', seconds: 20 },
      { panel: 'forecast', seconds: 15 },
      { panel: 'sponsor-logo', seconds: 15 },
    ],
  },
  prime: { minutes: 6, layout: 'bar', mirror: false, countdownIn: 'banner', viewTag: true, teamChip: true, colors: 'team', panels: teamRows('prime'), sidePanels: [] },
  nova: { minutes: 6, layout: 'bar', mirror: true, countdownIn: 'banner', viewTag: true, teamChip: true, colors: 'team', panels: teamRows('nova'), sidePanels: [] },
  family: {
    minutes: 2,
    layout: 'bar',
    mirror: false,
    countdownIn: 'banner',
    viewTag: false,
    teamChip: false,
    colors: 'general',
    panels: [
      { panel: 'monday-overall', seconds: 30 },
      { panel: 'monday-status-depts', seconds: 30 },
    ],
    sidePanels: [],
  },
};

// The two panels the Family view always plays. Its list of panels cannot be changed.
export const familyPanels = ['monday-overall', 'monday-status-depts'];
