// The panels the Studio can preview, and the address of a preview (docs/monday.md, "Preview").
// Plain functions and numbers only, so that tests/check-preview.test.mjs can read it with node.
//
// The Studio build copies dashboard/ to /dashboard/ beside the Studio (scripts/copy-dashboard.mjs), so the
// preview is the real screen on the Studio's own origin, reading the published dataset. The
// ids are those of dashboard/registry.js. The check tells which of them the registry lacks.

export const previewPath = '/dashboard/index.html';

export const previewScreens = ['original', 'cybertron', 'minimal'];

// The boards of the Monday panels, the status pies, Drive hours and the two small panels of the rotation, in order. slot is which Team lead of the team the row
// takes: 1 is the first by order, 2 the second. A panel with no slot takes no department.
export const previewPanels = [
  { id: 'tasks-prime-1', title: 'Prime tasks, first department', panel: 'monday-tasks', team: 'prime', slot: 1 },
  { id: 'tasks-prime-2', title: 'Prime tasks, second department', panel: 'monday-tasks', team: 'prime', slot: 2 },
  { id: 'tasks-nova-1', title: 'Nova tasks, first department', panel: 'monday-tasks', team: 'nova', slot: 1 },
  { id: 'tasks-nova-2', title: 'Nova tasks, second department', panel: 'monday-tasks', team: 'nova', slot: 2 },
  { id: 'done-prime', title: 'Prime done', panel: 'monday-done', team: 'prime', slot: 0 },
  { id: 'done-nova', title: 'Nova done', panel: 'monday-done', team: 'nova', slot: 0 },
  { id: 'status-depts', title: 'Status by department', panel: 'monday-status-depts', team: '', slot: 0 },
  { id: 'overall', title: 'Overall progress', panel: 'monday-overall', team: '', slot: 0 },
  { id: 'timeline-prime', title: 'Prime timeline', panel: 'monday-timeline', team: 'prime', slot: 0 },
  { id: 'board-prime', title: 'Prime board', panel: 'monday-board', team: 'prime', slot: 0 },
  { id: 'board-nova', title: 'Nova board', panel: 'monday-board', team: 'nova', slot: 0 },
  { id: 'pie-prime', title: 'Prime status pie', panel: 'monday-pie', team: 'prime', slot: 0 },
  { id: 'pie-nova', title: 'Nova status pie', panel: 'monday-pie', team: 'nova', slot: 0 },
  { id: 'drive-hours', title: 'Drive hours', panel: 'driveHours', team: '', slot: 0 },
  { id: 'frc-news', title: 'FRC news', panel: 'frc-news', team: '', slot: 0 },
  { id: 'parts-request', title: 'Parts request (small panel)', panel: 'qrParts', team: '', slot: 0 },
  { id: 'mini-idea-1', title: 'Mini panel idea 1 (small panel)', panel: 'miniIdea1', team: '', slot: 0 },
  // The Before and after cards. phase moves the dates of the competition data so that the card is drawn in its own phase (docs/frc-feed.md)
  { id: 'competition-preview', title: 'Event preview (Before and after)', panel: 'competition-preview', team: 'prime', slot: 0, phase: 'preview' },
  { id: 'competition-matches', title: 'Our matches (Before and after)', panel: 'competition-matches', team: 'prime', slot: 0, phase: 'matches' },
  { id: 'competition-recap', title: 'Event recap (Before and after)', panel: 'competition-recap', team: 'prime', slot: 0, phase: 'recap' },
];

// The registry ids the previews use, once each
export function previewRegistryIds(list = previewPanels) {
  return list.map(item => item.panel).filter((id, index, all) => all.indexOf(id) === index);
}

// The Team leads of a team in order, as the preview takes them: { _id } for each, first by order
export const departmentsQuestion = '*[_type == "subteam" && (!defined(team) || team->code == $code)] | order(order asc, _createdAt asc) [0...2] { _id }';

// The address of a preview. department is a Team lead _id, or empty. screen is one of previewScreens. phase is for the competition
// cards: the preview moves the dates of the published data into that phase.
export function previewAddress(panel, team, department, screen, phase) {
  const parts = ['panel=' + encodeURIComponent(panel)];

  if (team) parts.push('team=' + encodeURIComponent(team));
  if (department) parts.push('dept=' + encodeURIComponent(department));
  parts.push('screen=' + (previewScreens.indexOf(screen) !== -1 ? screen : 'original'));
  if (phase) parts.push('competition=1', 'phase=' + encodeURIComponent(phase));
  parts.push('still=1');
  return previewPath + '?' + parts.join('&');
}

// The size of the frame in the Studio: the 1920 by 1080 canvas at half scale
export const frameSize = { width: 960, height: 540, scale: 0.5, canvasWidth: 1920, canvasHeight: 1080 };

export const words = {
  button: 'Preview',
  hide: 'Hide the preview',
  tab: 'Preview the panels',
  boardsTab: 'Boards',
  help: 'Each panel is drawn by the real screen, from the published content, at half size. A change you have not published does not show.',
  screenLabel: 'Style',
  notMonday: 'Only the Monday rows have a preview.',
  noDepartment: 'This team has no Team lead yet, so the preview shows the panel with no department.',
  slow: 'The first picture takes a few seconds.',
};
