// The TV charts of the Monday boards, one chart a row: Status by department (a bar of Done, In Progress and To Do for each
// department, with the counts), Overall progress (the estimated hours done over all the hours, or the tasks done over all
// the tasks when no task has hours) and the Timeline (the tasks with a Timeline in this month and the next two, by
// department). The row of the rotation says the chart, the team and, when it names one, the department: page is { chart, team,
// department }. With a department the chart is that department's alone. core/monday-views.js works out
// what is drawn. A chart with nothing to draw has nothing to show, and the rotation leaves the row out.

import { boardEmptyMarkup, boardHeader, countersMarkup, pageMarkup } from '../../core/monday-draw.js';
import { chartsView } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

export function hasContent(content, page) {
  return chartsView(content, new Date(), page) !== null;
}

const parts = [{ id: 'done', word: 'DONE' }, { id: 'progress', word: 'IN PROGRESS' }, { id: 'todo', word: 'TO DO' }];

function legendMarkup() {
  return `<div class="legend">${parts.map(part => `<span class="key"><i class="swatch part-${part.id}"></i>${part.word}</span>`).join('')}</div>`;
}

function percent(fraction) {
  return Math.round(fraction * 10000) / 100 + '%';
}

// A segment wide enough for its number carries it. The narrow ones are counted in the total at the end of the row.
const numberRoom = 0.08;

function statusMarkup(view) {
  const rows = view.rows.map(row => {
    const segments = parts.filter(part => row[part.id] > 0).map(part => {
      const share = row[part.id] / view.longest;
      return `<span class="segment part-${part.id}" style="width: ${percent(share)}">${share >= numberRoom ? row[part.id] : ''}</span>`;
    }).join('');
    return `<div class="status-row"><span class="name">${escapeHtml(row.name)}</span><span class="track">${segments}</span><span class="total">${row.total}</span></div>`;
  }).join('');
  return `${legendMarkup()}<div class="status-rows rows-${view.rows.length}${view.department !== '' ? ' one-department' : ''}">${rows}</div>${view.department !== '' ? oneDepartmentCounters(view.rows[0]) : ''}`;
}

// One department has one bar, so the numbers under it say what the bar holds
function oneDepartmentCounters(row) {
  return countersMarkup([
    { label: 'TASKS', value: row.total },
    { label: 'DONE', value: row.done },
    { label: 'IN PROGRESS', value: row.progress - row.blocked },
    { label: 'TO DO', value: row.todo },
    { label: 'STUCK', value: row.blocked },
  ]);
}

function progressMarkup(view) {
  return `
      <div class="progress">
        <span class="percent">${view.percent}%</span>
        <div class="progress-track"><span class="progress-fill" style="width: ${view.percent}%"></span></div>
        <p class="progress-words">${view.done} OF ${view.total} ${view.unit} DONE</p>
      </div>
      ${countersMarkup([{ label: 'TASKS DONE', value: view.tasks.done }, { label: 'TASKS OPEN', value: view.tasks.open }])}`;
}

function timelineMarkup(view) {
  const months = view.months.map(month => `<span class="month" style="left: ${percent(month.from)}">${month.name}</span>`).join('');
  const lines = view.months.map(month => `<i class="month-line" style="left: ${percent(month.from)}"></i>`).join('');
  const rows = view.rows.map(row => {
    const bars = row.bars.map(bar => `<i class="bar part-${bar.part} lane-${bar.lane} of-${row.lanes}" style="left: ${percent(bar.from)}; width: ${percent(bar.to - bar.from)}"></i>`).join('');
    return `<div class="lane-row"><span class="name">${escapeHtml(row.name)}</span><span class="lanes">${lines}${bars}</span></div>`;
  }).join('');
  const notes = [];
  if (view.hidden > 0) notes.push(view.hidden + ' MORE NOT DRAWN');
  if (view.without > 0) notes.push(view.without + ' WITH NO TIMELINE');
  const today = view.todayAt >= 0 && view.todayAt <= 1 ? `<i class="today" style="left: ${percent(view.todayAt)}"></i>` : '';

  return `
      ${legendMarkup()}
      <div class="timeline">
        <div class="months"><span class="name"></span><span class="lanes">${months}</span></div>
        ${rows}
        <div class="today-layer"><span class="name"></span><span class="lanes">${today}</span></div>
      </div>
      ${notes.length > 0 ? `<p class="notes">${escapeHtml(notes.join(' · '))}</p>` : ''}`;
}

export function markupFor(content, now, page) {
  const view = chartsView(content, now, page);
  if (!view) return pageMarkup('monday-charts', boardHeader('TV CHARTS', '', content, now), boardEmptyMarkup(content));

  const inner = view.chart === 'progress' ? progressMarkup(view) : view.chart === 'timeline' ? timelineMarkup(view) : statusMarkup(view);
  return pageMarkup('monday-charts chart-' + view.chart, boardHeader(view.title, view.team, content, now), inner);
}

export function mount(host, content, page) {
  host.innerHTML = markupFor(content, new Date(), page);
}
