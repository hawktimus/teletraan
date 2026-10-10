// The tasks card of the Monday pass: the tasks of one Team lead entry in three columns, Backlog, In progress
// and Done, with room for two cards in each, and three numbers under them. The step of the look rotation
// says which entry: page 1 is the first entry that has tasks, page 2 the next, and so on (core/monday.js,
// mondaySteps). Inside a column the tasks are ranked by priority and then by due date, with the pinned
// tasks first. A task with Show on TV off never shows (visibleItems, through tasksFor).

import { emptyMarkup, tagTextFor } from '../../core/competition-draw.js';
import { todayOf } from '../../core/competition.js';
import { statusMark } from '../../core/marks.js';
import { columnsOf, dueDateOf, groupByLead, leadEntries, priorities, priorityText, tasksFor } from '../../core/monday.js';
import { leadTitleMarkup, pageMarkup, teamNameShown } from '../../core/monday-draw.js';
import { escapeHtml, hasText } from '../../core/text.js';

// The lead entries that have tasks, in the order of the Team leads list. Each is one page of the card.
function groupsFor(content, now) {
  return groupByLead(tasksFor(content, now), leadEntries(content, now));
}

export function hasContent(content, page = 1) {
  return groupsFor(content, new Date())[page - 1] !== undefined;
}

// The three numbers under the columns, for the tasks of one lead: how many open tasks are past their
// due date, how many are open at all (everything that is not done), and how many are done. today is a
// plain date in the time zone of the Look page.
export function factsOf(tasks, today) {
  const open = tasks.filter(task => task.status !== 'done');
  const late = open.filter(task => dueDateOf(task) !== '' && dueDateOf(task) < today);

  return [
    { label: 'OVERDUE', value: late.length },
    { label: 'OPEN', value: open.length },
    { label: 'DONE', value: tasks.length - open.length },
  ];
}

// A card is the title, and under it the priority and who it is for. Either of those may be missing.
function itemMarkup(task) {
  const priority = priorities.indexOf(task.priority) === -1 ? '' : `<span class="chip chip-${task.priority}">${priorityText[task.priority]}</span>`;
  const contact = hasText(task.contact) ? `<span class="contact">${escapeHtml(task.contact)}</span>` : '';
  const meta = priority || contact ? `<div class="meta">${priority}${contact}</div>` : '';

  return `<div class="item"><div class="item-title">${escapeHtml(task.title)}</div>${meta}</div>`;
}

// A column is its heading, with the status mark so that the status is a shape, a word and a colour, and its cards
function laneMarkup(column) {
  return `
        <div class="lane lane-${column.status}">
          <div class="lane-head"><span class="lane-mark">${statusMark(column.status)}</span><span class="lane-name">${column.label}</span></div>
          ${column.shown.map(itemMarkup).join('')}
        </div>`;
}

function factsMarkup(facts) {
  return facts.map(fact => `<div class="fact"><div class="fact-label">${fact.label}</div><div class="fact-number">${fact.value}</div></div>`).join('');
}

// The page as markup, for the time given and the page of the step. now is a Date.
export function markupFor(content, now, page = 1) {
  const group = groupsFor(content, now)[page - 1];
  const tag = tagTextFor(content.monday, now);
  if (!group) return pageMarkup('monday-tasks', 'TASKS', tag, emptyMarkup('No tasks from the team board are showing yet.'));

  const inner = `
      <div class="lanes">${columnsOf(group.tasks).map(laneMarkup).join('')}
      </div>
      <div class="facts">${factsMarkup(factsOf(group.tasks, todayOf(content, now)))}</div>`;

  return pageMarkup('monday-tasks', leadTitleMarkup(group.name, teamNameShown()), tag, inner);
}

export function mount(host, content, page = 1) {
  host.innerHTML = markupFor(content, new Date(), page);
}
