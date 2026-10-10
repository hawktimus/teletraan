// Where a task comes from. A task from the team board has the source monday, and the
// board sync makes it. Every other task is pinned: one an editor typed, and also any
// task made before the board existed, which has no source at all.

export function isFromBoard(task) {
  return Boolean(task) && task.source === 'monday';
}

// Pinned tasks first, then the ones from the board. Each group keeps the order it has.
// The panels show the tasks of one team at a time, so the order holds inside a team.
export function pinnedFirst(tasks) {
  return tasks.filter(task => !isFromBoard(task)).concat(tasks.filter(isFromBoard));
}
