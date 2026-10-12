// The milestones card of a Monday row: a row for each Team lead entry that has an open task with a due date,
// and two columns, This week and Next. A cell shows the task of that lead that is due soonest in that week, with
// its date under it, and a chip at the end of the row counts the tasks that are due later, such as +3 later.
// A week is Monday to Sunday, by the date today in the time zone of the Look page. A task that is already late is
// in This week, with its date in red. Only tasks from the board whose status is not done count. There are at most
// five rows, and +N MORE says how many entries did not fit. The card always draws, with a sentence when no task has
// a due date, because the Screen chooses it (core/monday.js, mondaySteps).

import { emptyMarkup } from '../../core/competition-draw.js';
import { todayOf } from '../../core/competition.js';
import { daysFromTo, shortDate } from '../../core/frc.js';
import { boardTasksFor, dueDateOf, dueSoonestFirst, groupByLead, leadEntries } from '../../core/monday.js';
import { headerMarkup, noRowsSentence, pageMarkup, teamNameShown } from '../../core/monday-draw.js';
import { escapeHtml } from '../../core/text.js';

// The two columns. A task that is due after Next is not in a column: the chip at the end of the row counts it.
export const weeks = [
  { id: 'this-week', label: 'THIS WEEK' },
  { id: 'next-week', label: 'NEXT' },
];
export const mostRows = 5;

// 1970-01-01 was a Thursday, so with three days added the count of weeks turns over on a Monday
function weekNumber(date) {
  return Math.floor((daysFromTo('1970-01-01', date) + 3) / 7);
}

// Which column a due date is in, counting from 0: this week, which includes every date before it, the
// week after, or later, which is 2. Both dates are plain dates, such as 2026-10-12.
export function weekIndexOf(date, today) {
  const ahead = weekNumber(date) - weekNumber(today);
  return ahead <= 0 ? 0 : ahead === 1 ? 1 : 2;
}

// The rows of the card: { today, rows, more }. A row is { name, cells, later }, where a cell is the task due
// soonest in that week, or null, and later is how many tasks are due after next week.
export function milestonesFor(content, now) {
  const today = todayOf(content, now);
  const open = boardTasksFor(content, now).filter(task => task.status !== 'done' && dueDateOf(task) !== '');

  const rows = groupByLead(open, leadEntries(content, now)).map(group => {
    const soonest = dueSoonestFirst(group.tasks);
    return {
      name: group.name,
      cells: weeks.map((week, index) => soonest.find(task => weekIndexOf(dueDateOf(task), today) === index) || null),
      later: soonest.filter(task => weekIndexOf(dueDateOf(task), today) === 2).length,
    };
  });
  return { today: today, rows: rows.slice(0, mostRows), more: Math.max(0, rows.length - mostRows) };
}

function cellMarkup(task, week, today) {
  if (!task) return `<div class="cell cell-${week.id} cell-empty"></div>`;

  const late = dueDateOf(task) < today ? ' late' : '';
  return `<div class="cell cell-${week.id}"><span class="cell-title">${escapeHtml(task.title)}</span><span class="cell-date${late}">${shortDate(dueDateOf(task))}</span></div>`;
}

function rowMarkup(row, today) {
  const later = row.later > 0 ? `<span class="later-chip">+${row.later} later</span>` : '';

  return `
        <div class="milestone-row"><div class="milestone-lead">${escapeHtml(row.name.toUpperCase())}</div>${row.cells.map((task, index) => cellMarkup(task, weeks[index], today)).join('')}<div class="later">${later}</div></div>`;
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const found = milestonesFor(content, now);
  const header = headerMarkup('MILESTONES', teamNameShown(), content.monday, now);
  if (found.rows.length === 0) {
    const rows = boardTasksFor(content, now).length > 0;
    return pageMarkup('monday-milestones', header, emptyMarkup(rows ? 'No open board items have a due date yet.' : noRowsSentence(content)));
  }

  const heads = weeks.map(week => `<div class="week-head">${week.label}</div>`).join('');
  const more = found.more > 0 ? `<div class="more">+${found.more} MORE</div>` : '';
  const inner = `
        <div class="milestone-row"><div class="milestone-lead"></div>${heads}<div class="later"></div></div>${found.rows.map(row => rowMarkup(row, found.today)).join('')}
      ${more}`;

  return pageMarkup('monday-milestones', header, inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
