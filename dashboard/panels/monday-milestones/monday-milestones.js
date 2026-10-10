// The milestones card of the Monday pass: a row for each Team lead entry that has an open task with a due date,
// and three columns, This week, Next week and Later. A cell shows the task of that lead that is due soonest in
// that week. A week is Monday to Sunday, by the date today in the time zone of the Look page. A task that is
// already late is in This week, with its date in red. Only tasks whose status is not done count. There are at
// most six rows, and +N MORE says how many entries did not fit. The card always draws, with a sentence when
// no task has a due date, because the look rotation chooses it (core/monday.js, mondaySteps).

import { emptyMarkup, tagTextFor } from '../../core/competition-draw.js';
import { todayOf } from '../../core/competition.js';
import { daysFromTo, shortDate } from '../../core/frc.js';
import { dueDateOf, dueSoonestFirst, groupByLead, leadEntries, tasksFor } from '../../core/monday.js';
import { pageMarkup } from '../../core/monday-draw.js';
import { escapeHtml } from '../../core/text.js';

export const weeks = [
  { id: 'this-week', label: 'THIS WEEK' },
  { id: 'next-week', label: 'NEXT WEEK' },
  { id: 'later', label: 'LATER' },
];
export const mostRows = 6;

// 1970-01-01 was a Thursday, so with three days added the count of weeks turns over on a Monday
function weekNumber(date) {
  return Math.floor((daysFromTo('1970-01-01', date) + 3) / 7);
}

// Which column a due date is in, counting from 0: this week, which includes every date before it, the
// week after, or later. Both dates are plain dates, such as 2026-10-12.
export function weekIndexOf(date, today) {
  const ahead = weekNumber(date) - weekNumber(today);
  return ahead <= 0 ? 0 : ahead === 1 ? 1 : 2;
}

// The rows of the card: { today, rows, more }. A row is { name, cells }, and a cell is the task due soonest
// in that week, or null.
export function milestonesFor(content, now) {
  const today = todayOf(content, now);
  const open = tasksFor(content, now).filter(task => task.status !== 'done' && dueDateOf(task) !== '');

  const rows = groupByLead(open, leadEntries(content, now)).map(group => {
    const soonest = dueSoonestFirst(group.tasks);
    return { name: group.name, cells: weeks.map((week, index) => soonest.find(task => weekIndexOf(dueDateOf(task), today) === index) || null) };
  });
  return { today: today, rows: rows.slice(0, mostRows), more: Math.max(0, rows.length - mostRows) };
}

function cellMarkup(task, week, today) {
  if (!task) return `<div class="cell cell-${week.id} cell-empty"></div>`;

  const late = dueDateOf(task) < today ? ' late' : '';
  return `<div class="cell cell-${week.id}"><span class="cell-title">${escapeHtml(task.title)}</span><span class="cell-date${late}">${shortDate(dueDateOf(task))}</span></div>`;
}

function rowMarkup(row, today) {
  return `
        <div class="milestone-row"><div class="milestone-lead">${escapeHtml(row.name.toUpperCase())}</div>${row.cells.map((task, index) => cellMarkup(task, weeks[index], today)).join('')}</div>`;
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const found = milestonesFor(content, now);
  const tag = tagTextFor(content.monday, now);
  if (found.rows.length === 0) return pageMarkup('monday-milestones', 'MILESTONES', tag, emptyMarkup('No open board items have a due date yet.'));

  const heads = weeks.map(week => `<div class="week-head">${week.label}</div>`).join('');
  const more = found.more > 0 ? `<div class="more">+${found.more} MORE</div>` : '';
  const inner = `
        <div class="milestone-row"><div class="milestone-lead"></div>${heads}</div>${found.rows.map(row => rowMarkup(row, found.today)).join('')}
      ${more}`;

  return pageMarkup('monday-milestones', 'MILESTONES', tag, inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
