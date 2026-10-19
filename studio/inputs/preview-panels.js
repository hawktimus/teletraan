// The panels the Studio can preview, and the address of a preview (docs/monday.md, "Preview").
// Plain functions and numbers only, so that tests/check-preview.test.mjs can read it with node.
//
// The Studio build copies dashboard/ to /dashboard/ beside the Studio (scripts/copy-dashboard.mjs), so the
// preview is the real screen on the Studio's own origin, reading the published dataset. The
// ids are those of dashboard/registry.js. The check tells which of them the registry lacks.

export const previewPath = '/dashboard/index.html';

export const previewScreens = ['original', 'cybertron', 'minimal'];

// The panels the previews list, in order: the two Monday panels, Drive hours, FRC news, the two small panels of the rotation
// and the Before and after cards. department, list and chart are what a row of the rotation says.
export const previewPanels = [
  { id: 'department-open', title: 'Build tasks, open', panel: 'monday-department', team: '', department: 'build', list: 'open' },
  { id: 'department-done', title: 'Build tasks, done', panel: 'monday-department', team: '', department: 'build', list: 'done' },
  { id: 'chart-status', title: 'Status by department', panel: 'monday-charts', team: '', chart: 'status' },
  { id: 'chart-progress', title: 'Overall progress', panel: 'monday-charts', team: '', chart: 'progress' },
  { id: 'chart-timeline', title: 'Timeline', panel: 'monday-charts', team: '', chart: 'timeline' },
  { id: 'drive-hours', title: 'Drive hours', panel: 'driveHours', team: '' },
  { id: 'frc-news', title: 'FRC news', panel: 'frc-news', team: '' },
  { id: 'parts-request', title: 'Parts request (small panel)', panel: 'qrParts', team: '' },
  { id: 'mini-idea-1', title: 'Mini panel idea 1 (small panel)', panel: 'miniIdea1', team: '' },
  // The Before and after cards. phase moves the dates of the competition data so that the card is drawn in its own phase (docs/frc-feed.md)
  { id: 'competition-preview', title: 'Event preview (Before and after)', panel: 'competition-preview', team: 'prime', phase: 'preview' },
  { id: 'competition-matches', title: 'Our matches (Before and after)', panel: 'competition-matches', team: 'prime', phase: 'matches' },
  { id: 'competition-recap', title: 'Event recap (Before and after)', panel: 'competition-recap', team: 'prime', phase: 'recap' },
];

// The registry ids the previews use, once each
export function previewRegistryIds(list = previewPanels) {
  return list.map(item => item.panel).filter((id, index, all) => all.indexOf(id) === index);
}

// The address of a preview. department is a department of the Monday boards (or a Team lead name for the roster), or empty.
// screen is one of previewScreens. phase is for the competition cards: the preview moves the dates of the published data into
// that phase. more holds list and chart, for the two Monday panels.
export function previewAddress(panel, team, department, screen, phase, more = {}) {
  const parts = ['panel=' + encodeURIComponent(panel)];

  if (team) parts.push('team=' + encodeURIComponent(team));
  if (department) parts.push('dept=' + encodeURIComponent(department));
  if (more.list) parts.push('list=' + encodeURIComponent(more.list));
  if (more.chart) parts.push('chart=' + encodeURIComponent(more.chart));
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
  help: 'Each panel is drawn by the real screen, from the published content, at half size. A change you have not published does not show.',
  screenLabel: 'Style',
  notMonday: 'Only the Monday rows have a preview.',
  slow: 'The first picture takes a few seconds.',
};
