// How many tasks are not finished, and how they split between in progress,
// up next and blocked.

import { plateMarkup, scanMarkup } from '../../core/plate.js';
import { visibleItems } from '../../core/content.js';

// A status name must match task-counts.css (.line-...). Colours are in tokens.css
// (--status-progress for in-progress, --status-next for up-next).
const openGroups = [
  { status: 'in-progress', words: 'in progress' },
  { status: 'up-next', words: 'up next' },
  { status: 'blocked', words: 'blocked' },
];

// Ten or more needs a smaller number to fit beside the lines
const BIG_COUNT_LIMIT = 10;

function countsFor(content) {
  const tasks = visibleItems(content.tasks);

  return openGroups.map(group => ({
    group: group,
    count: tasks.filter(task => task.status === group.status).length,
  }));
}

export function hasContent(content) {
  return visibleItems(content.tasks).length > 0;
}

export function mount(host, content) {
  const counts = countsFor(content);
  const open = counts.reduce((total, item) => total + item.count, 0);
  const size = open >= BIG_COUNT_LIMIT ? ' long' : '';

  const lines = counts
    .filter(item => item.count > 0)
    .map(item => `<div class="line line-${item.group.status}">${item.count} ${item.group.words}</div>`)
    .join('');

  host.innerHTML = `
    <section class="panel task-counts" data-sequence="grid2">
      ${plateMarkup('grid2')}
      ${scanMarkup('grid2')}

      <div class="label" data-part="label">OPEN TASKS</div>

      <div class="content" data-part="content">
        <div class="count${size}">${open}</div>
        ${lines ? '<div class="groove"></div>' : ''}
        <div class="lines">${lines}</div>
      </div>
    </section>`;
}
