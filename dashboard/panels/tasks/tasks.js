// What is blocked, what is being worked on, what is next and what just
// finished, in groups of up to two tasks.

import { rowBarMarkup } from '../../core/plate.js';
import { doubleSlash, statusMark } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';
import { parseLocalDateTime } from '../../core/time.js';

// Each row of the panel is 192px: a label and two 64px lines. Three rows
// fill the 708px panel, so at most three groups are shown, with at most two
// tasks in each. When more than three groups have tasks, the ones last in
// this list are left out, so a blocked task always shows and "recently
// done" goes first. The Open Tasks panel counts every task, so its numbers
// can be higher than the lines listed here.
// A status name must match marks.js, base.css (.mark-...) and tasks.css
// (.status-...). Its colour is in tokens.css (--status-progress for in-progress).
const groups = [
  { status: 'blocked', label: 'BLOCKED' },
  { status: 'in-progress', label: 'IN PROGRESS' },
  { status: 'up-next', label: 'UP NEXT' },
  { status: 'done', label: 'RECENTLY DONE' },
];

const dayMs = 24 * 60 * 60 * 1000;

// The tasks to show, grouped, at most three groups
function rowsFor(content, now = new Date()) {
  const doneDays = content.settings.doneDays;

  const tasks = visibleItems(content.tasks, now).filter(task => {
    if (!hasText(task.title)) return false;
    if (task.status !== 'done') return true;

    // a finished task stays for a while, then drops off
    const finished = parseLocalDateTime(task.finishedOn);
    return !finished || now - finished < doneDays * dayMs;
  });

  return groups
    .map(group => ({ group: group, tasks: tasks.filter(task => task.status === group.status) }))
    .filter(row => row.tasks.length > 0)
    .slice(0, 3);
}

export function hasContent(content) {
  return rowsFor(content).length > 0;
}

export function mount(host, content) {
  const rows = rowsFor(content);
  const lines = rows.map((row, index) => rowMarkup(row, index === rows.length - 1)).join('');

  host.innerHTML = `
    <section class="page tasks">
      <div class="header">
        <h2 class="title" data-slat="title">TASKS</h2>
        <div data-slat="tag">${doubleSlash()}</div>
      </div>

      <div class="rows">${lines}</div>
    </section>`;
}

// Every row is a slat, and the thin metal bar under it turns over with it.
// The last row has no bar under it, because the frame is there.
function rowMarkup(row, isLast) {
  // Only the first two tasks of a group fit, as explained above
  const lines = row.tasks
    .slice(0, 2)
    .map(task => {
      const subteam = hasText(task.subteam) ? `<div class="subteam">${escapeHtml(task.subteam)}</div>` : '';
      return `<div class="task-line"><div class="task-title">${escapeHtml(task.title)}</div>${subteam}</div>`;
    })
    .join('');

  return `
    <div class="row status-${row.group.status}" data-slat="item">
      ${isLast ? '' : rowBarMarkup(1124)}
      <div class="row-mark">${statusMark(row.group.status)}</div>
      <div class="row-text">
        <div class="row-label">${row.group.label}</div>
        ${lines}
      </div>
    </div>`;
}
