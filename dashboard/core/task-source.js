// Where a task comes from. A task from the team board has the source monday, and the board sync
// makes it. The screen draws only those. A task typed by hand, and any task made before the board
// existed, which has no source at all, stays in the dataset but is never drawn.

export function isFromBoard(task) {
  return Boolean(task) && task.source === 'monday';
}

// The tasks the screen may draw, in the order they have
export function fromBoardOnly(tasks) {
  return tasks.filter(isFromBoard);
}
