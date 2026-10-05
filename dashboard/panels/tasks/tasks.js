// What is blocked, what is being worked on, what is next and what just
// finished. A task that is not done also shows who to ask (its contact) and
// where it is done (its location), on a line of its own under its name.

import { rowBarMarkup } from '../../core/plate.js';
import { doubleSlash, statusMark } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';
import { makePages } from '../../core/turns.js';
import { parseLocalDateTime } from '../../core/time.js';

// Each row of the panel is 192px: a label and up to two lines. Three rows fill
// the 708px panel, so a page is three rows and at most six lines.
//   a task with only a name is one line
//   a task with a contact or a location is two lines: the name, then the
//   contact and the location under it
// A row holds the tasks of one status, two lines at most, so it holds two plain
// tasks or one task with details. Every row has its status label, so a status
// with many tasks has several rows. When the rows do not fit on one page, the
// panel shows the next page each time it comes round, as the Leadership panel
// does (core/turns.js). Blocked is first and done is last, so a blocked task is
// always on the first page. The Open Tasks panel counts every task, however
// many pages there are.
// A status name must match marks.js, base.css (.mark-...) and tasks.css
// (.status-...). Its colour is in tokens.css (--status-progress for in-progress).
const groups = [
  { status: 'blocked', label: 'BLOCKED' },
  { status: 'in-progress', label: 'IN PROGRESS' },
  { status: 'up-next', label: 'UP NEXT' },
  { status: 'done', label: 'RECENTLY DONE' },
];

const dayMs = 24 * 60 * 60 * 1000;
const linesPerRow = 2;
const rowsPerPage = 3;

const nextPage = makePages(rowsPerPage);

// A finished task shows its name only, because nobody asks about it any more
function showsDetail(task) {
  return task.status !== 'done' && (hasText(task.contact) || hasText(task.location));
}

// All the rows, in order, for every page. A row is { group, tasks, lines }.
// This is exported for tools/test-content.mjs.
export function rowsFor(content, now = new Date()) {
  const doneDays = content.settings.doneDays;

  const tasks = visibleItems(content.tasks, now).filter(task => {
    if (!hasText(task.title)) return false;
    if (task.status !== 'done') return true;

    // a finished task stays for a while, then drops off
    const finished = parseLocalDateTime(task.finishedOn);
    return !finished || now - finished < doneDays * dayMs;
  });

  const rows = [];
  groups.forEach(group => {
    let row = null;
    tasks.filter(task => task.status === group.status).forEach(task => {
      const lines = showsDetail(task) ? 2 : 1;
      // a task goes in the row being filled if it fits, or else starts a new row
      if (!row || row.lines + lines > linesPerRow) {
        row = { group: group, tasks: [], lines: 0 };
        rows.push(row);
      }
      row.tasks.push(task);
      row.lines += lines;
    });
  });
  return rows;
}

export function hasContent(content) {
  return rowsFor(content).length > 0;
}

export function mount(host, content) {
  const rows = nextPage(rowsFor(content)).items;
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
  const lines = row.tasks.map(taskMarkup).join('');

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

// The name and subteam on one line. Under them, the contact and the location,
// or just the one that is there.
function taskMarkup(task) {
  const withDetail = showsDetail(task);
  const subteam = hasText(task.subteam) ? `<div class="subteam">${escapeHtml(task.subteam)}</div>` : '';
  const contact = withDetail && hasText(task.contact) ? `<span class="contact">${escapeHtml(task.contact)}</span>` : '';
  const location = withDetail && hasText(task.location) ? `<span class="location">${escapeHtml(task.location)}</span>` : '';
  const detail = contact || location ? `<div class="task-detail">${contact}${location}</div>` : '';

  return `<div class="task-line"><div class="task-title">${escapeHtml(task.title)}</div>${subteam}</div>${detail}`;
}
