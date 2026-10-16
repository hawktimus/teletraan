// The default rotation, the same list as defaultRotationRows in dashboard/config-rotation.js (tests/default-rotation.test.mjs
// compares the two). Dashboard Settings, Rotation, is filled with it when it is empty (inputs/rotation-input.js).
//
// Plain functions only, so that the test can run them with node.
//
// Fifteen blocks, in the order the team asked for. A row is { view, panel, seconds, shown } and, when it needs it, department (the name of a department of the Team leads, or
// two with a comma), part (1 or 2: the first or the second page of a list), side (the small panel shown with the row) and
// photoCount with secondsPerPhoto. A row with no seconds follows Seconds per page.
const pair = (panel, side, extra) => Object.assign({ view: 'robotics', panel: panel, side: side, shown: true }, extra);
const wide = (panel, department, seconds = 30) => ({ view: 'robotics', panel: panel, department: department, seconds: seconds, shown: true });

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

function businessRows() {
  return [
    wide('monday-tasks', 'business'), wide('monday-done', 'business'),
    wide('monday-tasks', 'operations'), wide('monday-done', 'operations'),
    wide('monday-tasks', 'marketing'), wide('monday-done', 'marketing'),
    { view: 'robotics', panel: 'roster', department: 'business,marketing', shown: true },
  ];
}

// The seven rows of a department of a team view
function departmentRows(view, department) {
  const row = (panel, extra) => Object.assign({ view: view, panel: panel, department: department, shown: true }, extra);

  return [
    row('monday-tasks', { seconds: 30 }), row('monday-done', { seconds: 30 }),
    row('roster', { part: 1 }), row('roster', { part: 2 }),
    row('monday-board', { seconds: 30 }), row('monday-pie', { seconds: 30 }), row('monday-timeline', { seconds: 30 }),
  ];
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

// Blocks 1 to 15: Robotics with the Business rows, Prime and Nova (Build with the Team leads), their Electrical rows,
// Robotics, Programming, Design and CNC, Robotics, Strategy, and the last four panels of each team
export function defaultRotationRows() {
  return [].concat(
    pairBlock(), businessRows(),
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
