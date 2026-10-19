// The default rotation, the same list as defaultRotationRows in dashboard/config-rotation.js (tests/default-rotation.test.mjs
// compares the two). Dashboard Settings, Rotation, is filled with it when it is empty (inputs/rotation-input.js).
//
// Plain functions only, so that the test can run them with node.
//
// Fifteen blocks, in the order the team asked for. A row is { view, panel, seconds, shown } and, when it needs it, department (a
// department of the Monday boards, or for the roster the name of a department of the Team leads, or two with a comma), list
// (open or done) and team for Department tasks, chart for the TV charts, part (1 or 2: the first or the second page of a list),
// side (the small panel shown with the row) and photoCount with secondsPerPhoto. A row with no seconds follows Seconds per page.
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

// The Monday block: the open tasks of each of the nine departments, then the three TV charts, for both teams
function mondayRows() {
  const departments = ['build', 'electrical', 'programming', 'design', 'cnc', 'strategy', 'operations', 'business', 'marketing'];
  const charts = ['status', 'progress', 'timeline'];
  return [].concat(
    departments.map(department => ({ view: 'robotics', panel: 'monday-department', department: department, list: 'open', seconds: 20, shown: true })),
    charts.map(chart => ({ view: 'robotics', panel: 'monday-charts', chart: chart, seconds: 30, shown: true })),
    [{ view: 'robotics', panel: 'roster', department: 'business,marketing', shown: true }],
  );
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
// Robotics, Programming, Design and CNC, Robotics, Strategy, and the last four panels of each team
export function defaultRotationRows() {
  return [].concat(
    pairBlock(), mondayRows(),
    leadRows('prime'), departmentRows('prime', 'build'),
    leadRows('nova'), departmentRows('nova', 'build'),
    departmentRows('prime', 'electrical'), departmentRows('nova', 'electrical'),
    pairBlock(),
    departmentRows('prime', 'programming'), departmentRows('nova', 'programming'),
    departmentRows('prime', 'design'), departmentRows('nova', 'design'),
    pairBlock(),
    departmentRows('prime', 'strategy'), departmentRows('nova', 'strategy'),
    lastRows('prime'), lastRows('nova'),
  );
}
