// The milestones card of both teams, the second to last card of the pass of both teams (core/monday.js,
// bothSteps). A row for each department and each team that has an open board task with a due date: the team,
// the department, the next milestone and its date. The rows alternate between the teams, a department's
// rows together, and there are ten at the most, five at a time, scrolled like the tasks card (scrollPages and
// scrollCard in frame.js). The card always draws, with a sentence when no task has a due date.

import { emptyMarkup } from '../../core/competition-draw.js';
import { todayOf } from '../../core/competition.js';
import { shortDate } from '../../core/frc.js';
import { bothRows, dueDateOf, dueSoonestFirst, mostRows, pagesOf } from '../../core/monday.js';
import { headerMarkup, markerMarkup, noRowsSentence, pageMarkup, rowsWindow, teamTagMarkup, teamsForBoth } from '../../core/monday-draw.js';
import { bothTeamsName } from '../../core/team-title.js';
import { escapeHtml } from '../../core/text.js';

// The rows of the card: { rows, total }. A row is { team, lead, task }, the open task of that department and
// team that is due soonest. total is the rows there are before the card cuts them to ten.
export function milestonesFor(content, now) {
  const rows = [];

  bothRows(content, teamsForBoth(content), now).forEach(row => {
    const open = row.tasks.filter(task => task.status !== 'done' && dueDateOf(task) !== '');
    if (open.length > 0) rows.push({ team: row.team, lead: row.lead, task: dueSoonestFirst(open)[0] });
  });
  return { rows: rows.slice(0, mostRows), total: rows.length };
}

// How many pages the card has to hold for
export function scrollPages(content) {
  return pagesOf(milestonesFor(content, new Date()).rows.length);
}

// A row: the team, the department, the milestone on one line and its date. A date that is past is marked late.
function rowMarkup(row, today) {
  const due = dueDateOf(row.task);
  const late = due < today ? ' late' : '';

  return `<div class="row">${teamTagMarkup(row.team)}<span class="department">${escapeHtml(row.lead.toUpperCase())}</span><span class="milestone">${escapeHtml(row.task.title)}</span><span class="date${late}">${shortDate(due)}</span></div>`;
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const found = milestonesFor(content, now);
  const header = headerMarkup('MILESTONES', bothTeamsName, content.monday, now);
  if (found.rows.length === 0) {
    const sentence = bothRows(content, teamsForBoth(content), now).length > 0 ? 'No open board items have a due date yet.' : noRowsSentence(content);
    return pageMarkup('monday-milestones-both', header, emptyMarkup(sentence));
  }

  const today = todayOf(content, now);
  const inner = `
      ${rowsWindow(found.rows.map(row => rowMarkup(row, today)))}
      ${markerMarkup(found.rows.length, 'MILESTONES')}`;

  return pageMarkup('monday-milestones-both', header, inner, true);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
