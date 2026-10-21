// The one ordered list of the rotation, and the Robotics view (part of config.js, docs/views.md).
//
// rotationViews are the three views a row of the list can name. The stored view document keeps the key general, so
// robotics is its other name and rotationAliases says so. An old address or a stored value that says general still works.
export const rotationViews = ['robotics', 'prime', 'nova'];
export const rotationAliases = { general: 'robotics', family: 'robotics' };
export const rotationKeyOfView = { robotics: 'general', prime: 'prime', nova: 'nova' };

// The words the Robotics banner and team plate carry. There is no team number on the view.
export const roboticsTitle = 'HAWKTIMUS ROBOTICS';
// The title the General view had before Robotics. A stored title that is still this one reads as the new title.
export const olderGeneralTitle = 'Hawktimus Dashboard';

// transitionSeconds scales the whole panel and view transition (core/rotation.js, transitionSecondsOf)
export const transitionSecondsRange = { min: 2, max: 4, start: 3 };

// The panels that are drawn as a title and a dashed inner frame, so they can be placed in the list before they are designed
export const placeholderPanels = { robotStatus: 'ROBOT STATUS', wireframe: '3D VIEW' };

// Design and CNC are one department of the Team leads on the screen (the roster)
export const designDepartment = 'DESIGN · CNC';

// Rosters come from the Monday board and page at this many rows
export const rosterPageRows = 6;

// The Robotics view has two layouts, chosen for each row by its panel. wide is the bar layout (the countdown in the banner,
// the side column at the left) and every other panel is split (the main panel at the left, the countdown at the top right and
// Panel B at the bottom right, which is the standard layout).
export const roboticsWidePanels = ['monday-department', 'monday-charts', 'roster', 'driveHours', 'robotStatus', 'wireframe'];

// The default rotation: what Dashboard Settings, Rotation, is filled with when it is empty, and what the screen plays when the
// list has no row that is Shown (core/rotation.js). The same list is in studio/tools/default-rotation.js, and
// tests/default-rotation.test.mjs compares the two. Fifteen blocks, in the order the team asked for.
//
// A row is { view, panel, seconds, shown } and, when it needs it, department (a department of the Monday boards, or for the
// roster the name of a department of the Team leads, or two with a comma), list (open or done) and team (prime, nova, or empty
// for both) for Department tasks, chart for the TV charts, part (1 or 2: the first or the second page of a list), side (the
// small panel shown with the row) and photoCount with secondsPerPhoto. A row with no seconds follows Seconds per page.
const pair = (panel, side, extra) => Object.assign({ view: 'robotics', panel: panel, side: side, shown: true }, extra);

function pairBlock() {
  return [
    pair('leadership', 'sponsor-logo', { seconds: 20 }),
    pair('events', 'task-counts', { part: 1, seconds: 30 }),
    pair('events', 'forecast', { part: 2, seconds: 30 }),
    pair('sponsor-feature', 'next-event', { seconds: 15 }),
    pair('spotlight', 'miniIdea1'),
    pair('photo', 'qrParts', { photoCount: 4, secondsPerPhoto: 10, seconds: 40 }),
  ];
}

// The Monday block of the Robotics view: the open tasks of the four departments that belong to both teams (Business, Operations,
// Marketing and Strategy), then the three TV charts. The Condensed view shows only tasks that are for both teams. The tasks
// of one team play in that team's block, in departmentTaskRows.
function mondayRows() {
  const departments = ['business', 'operations', 'marketing', 'strategy'];
  const charts = ['status', 'progress', 'timeline'];
  return [].concat(
    departments.map(department => ({ view: 'robotics', panel: 'monday-department', department: department, list: 'open', seconds: 20, shown: true })),
    charts.map(chart => ({ view: 'robotics', panel: 'monday-charts', chart: chart, seconds: 30, shown: true })),
    [{ view: 'robotics', panel: 'roster', department: 'business,marketing', shown: true }],
  );
}

// The open tasks of departments in a team view, for that team
function departmentTaskRows(view, departments) {
  return departments.map(department => ({ view: view, panel: 'monday-department', department: department, list: 'open', team: view, seconds: 20, shown: true }));
}

// The two roster rows of a department of a team view
function departmentRows(view, department) {
  const row = part => ({ view: view, panel: 'roster', department: department, part: part, shown: true });
  return [row(1), row(2)];
}

function leadRows(view) {
  return [{ view: view, panel: 'team-leads', part: 1, shown: true }, { view: view, panel: 'team-leads', part: 2, shown: true }];
}

function lastRows(view) {
  return [
    { view: view, panel: 'robotStatus', shown: true }, { view: view, panel: 'wireframe', shown: true },
    { view: view, panel: 'driveHours', shown: true }, { view: view, panel: 'competition-rank', shown: true },
  ];
}

// Blocks 1 to 15: Robotics with the Monday block, Prime and Nova (Build with the Team leads), their Electrical rows,
// Robotics, Programming, Design and CNC, Robotics, Strategy, and the last four panels of each team. Each team block that has
// the roster of a department also has that department's open tasks for the team.
export function defaultRotationRows() {
  return [].concat(
    pairBlock(), mondayRows(),
    leadRows('prime'), departmentRows('prime', 'build'), departmentTaskRows('prime', ['build']),
    leadRows('nova'), departmentRows('nova', 'build'), departmentTaskRows('nova', ['build']),
    departmentRows('prime', 'electrical'), departmentTaskRows('prime', ['electrical']),
    departmentRows('nova', 'electrical'), departmentTaskRows('nova', ['electrical']),
    pairBlock(),
    departmentRows('prime', 'programming'), departmentTaskRows('prime', ['programming']),
    departmentRows('nova', 'programming'), departmentTaskRows('nova', ['programming']),
    departmentRows('prime', 'design'), departmentTaskRows('prime', ['design', 'cnc']),
    departmentRows('nova', 'design'), departmentTaskRows('nova', ['design', 'cnc']),
    pairBlock(),
    departmentRows('prime', 'strategy'), departmentRows('nova', 'strategy'),
    lastRows('prime'), lastRows('nova'),
  );
}
