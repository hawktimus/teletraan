// The Monday cards: the plain functions that pick and rank what the cards draw. They know nothing
// about the page, so tests/monday-cards.test.mjs can run them. The board sync on the Teletraan computer
// (docs/editing-content.md, "The Monday cards") writes the rows of the team board into Sanity as
// tasks with the source monday, and keeps one count of open items a day in the document
// monday-status. The cards are the panels monday-tasks, monday-milestones and monday-progress, and
// monday-milestones-both and monday-progress-both for the rows that are for both teams.
//
// A team has board rows when a task from the board shows on the TV for it. Only then do the Monday rows of
// the Screens (core/screens.js) play for it. mondaySteps below gives the steps of its three cards, one
// page of the tasks card for each Team lead entry that has tasks, and bothSteps the two cards of both teams.

export {
  mostRows, rowsPerPage, shares, statuses, priorities, tidyMondayStatus, tasksFor, boardTasksFor, leadEntries,
  groupByLead, groupsFor, plainDateOf, rank, dueDateOf, rankTasks, dueSoonestFirst, pickRows, pagesOf, bothRows,
  mondaySteps, bothSteps, statusWords, visibleTasks, forTeam, forDepartment, overdue,
} from './monday-tasks.js';
export {
  dayNumber, progressHours, milestoneProgress, nextMilestones, everyMinutesOf, minutesSince, stale, staleWords,
  markUnreachable,
} from './monday-progress.js';
