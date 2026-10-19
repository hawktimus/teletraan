// The line the report to the control page carries when a view that was asked for (showView) has nothing to show, so the
// wall stays on the schedule and someone can tell why. Plain functions: the page gives the steps.

import { isMondayPanel } from './screens-rows.js';

// '' when the held view has steps, or no view is held. steps is viewSteps() of the held view, rows its rows.
export function heldNoteFor(name, steps, rows) {
  if (!name || steps.length > 0) return '';

  const allMonday = rows.length > 0 && rows.every(row => isMondayPanel(row.panel));
  const reason = allMonday ? 'no Monday task is on the TV' : 'it has no rows with something to show';
  return 'The held view ' + name + ' has nothing to show: ' + reason + '. The wall stays on the schedule.';
}
