// The tasks card of a Monday row: the tasks of one Team lead entry as rows, up to ten, five at a time.
// The step of the Screen says which entry: page 1 is the first entry that has tasks, page 2 the
// next, and so on (core/monday.js, mondaySteps). The rows are ranked by priority, then due date, then
// title, in a mix of done, backlog and in progress tasks (pickRows). With more than five rows the card
// holds, then the list scrolls up by five rows and holds again (scrollPages, which core/schedule.js reads,
// and scrollCard in frame.js). A task with Show on TV off never shows (visibleItems, through tasksFor), and
// only tasks from the board count (boardTasksFor).

import { emptyMarkup } from '../../core/competition-draw.js';
import { todayOf } from '../../core/competition.js';
import { dueDateOf, groupsFor, pickRows, pagesOf } from '../../core/monday.js';
import { departmentHeader, headerMarkup, markerMarkup, noRowsSentence, pageMarkup, priorityMark, rowsWindow, statusChip, teamNameShown } from '../../core/monday-draw.js';
import { pageTeamName } from '../../core/team-title.js';
import { escapeHtml, hasText } from '../../core/text.js';

export function hasContent(content, page = 1) {
  return groupsFor(content, new Date())[page - 1] !== undefined;
}

// How many pages the card has to hold for: one, and one more for each five rows past the first five
export function scrollPages(content, page = 1) {
  const group = groupsFor(content, new Date())[page - 1];
  return group ? pagesOf(pickRows(group.tasks).length) : 1;
}

// The three numbers under the rows, for the tasks of one lead: how many open tasks are past their due date,
// how many are open at all (everything that is not done), and how many are done. today is a plain date in
// the time zone of the Look page.
export function factsOf(tasks, today) {
  const open = tasks.filter(task => task.status !== 'done');
  const late = open.filter(task => dueDateOf(task) !== '' && dueDateOf(task) < today);

  return [
    { label: 'OVERDUE', value: late.length },
    { label: 'OPEN', value: open.length },
    { label: 'DONE', value: tasks.length - open.length },
  ];
}

// A row: the status, the title on one line, the first name of the owner when there is one, and the priority
function rowMarkup(task) {
  const owner = hasText(task.contact) ? escapeHtml(task.contact) : '';

  return `<div class="row">${statusChip(task.status)}<span class="row-title">${escapeHtml(task.title)}</span><span class="owner">${owner}</span>${priorityMark(task.priority)}</div>`;
}

function factsMarkup(facts) {
  return facts.map(fact => `<div class="fact"><div class="fact-label">${fact.label}</div><div class="fact-number">${fact.value}</div></div>`).join('');
}

// The page as markup, for the time given and the page of the step. now is a Date.
export function markupFor(content, now, page = 1) {
  const group = groupsFor(content, now)[page - 1];
  if (!group) return pageMarkup('monday-tasks', headerMarkup('TASKS', teamNameShown(), content.monday, now), emptyMarkup(noRowsSentence(content)));

  const rows = pickRows(group.tasks);
  const inner = `
      ${rowsWindow(rows.map(rowMarkup))}
      <div class="facts">${factsMarkup(factsOf(group.tasks, todayOf(content, now)))}</div>
      ${markerMarkup(rows.length, 'TASKS')}`;

  const header = departmentHeader(group.name, pageTeamName(group.tasks, teamNameShown()), content.monday, now);
  return pageMarkup('monday-tasks', header, inner, true);
}

export function mount(host, content, page = 1) {
  host.innerHTML = markupFor(content, new Date(), page);
}
