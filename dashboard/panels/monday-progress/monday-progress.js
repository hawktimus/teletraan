// The progress card of a Monday row. On the left, one stacked bar for each Team lead entry that has board
// tasks: how many are in the backlog, in progress and done, and done out of all of them at its right, with
// the legend over the bars and the totals of the team, such as 66 OPEN · 5 OVERDUE, under them. On the
// right, a line of the items left (the open tasks, all the board's tasks that are not done) from the daily
// counts in monday-status, with a dashed target line from the first count down to nothing on the date of the
// countdown. The line is plain SVG in a body of 1096 x 512, drawn once, and the rows are HTML on the left of
// it, so that the name of a department is cut off with an ellipsis at its real width. The card counts the
// same rows as the tasks card (groupsFor in core/monday.js). It always draws, with a sentence in place of
// what has no data, because the Screen chooses it (core/monday.js, mondaySteps).

import { chartMarkup, emptyMarkup, textAt, cut } from '../../core/competition-draw.js';
import { countdownMarker, todayOf, zoneOf } from '../../core/competition.js';
import { daysFromTo, shortDate } from '../../core/frc.js';
import { dueDateOf, groupsFor, statuses as stacks } from '../../core/monday.js';
import { headerMarkup, noRowsSentence, pageMarkup, teamNameShown } from '../../core/monday-draw.js';
import { escapeHtml } from '../../core/text.js';

// The bars. A row is 64px high with a bar of 44px in it, and there are six of them. The bar is as wide as this
// at the most, in a row of the department in 330px, the bar and the numbers.
export const mostRows = 6;
const BAR = { width: 206, height: 44 };

// The line. It is at most this many points. The plot is the part of the right side that the points and the
// target line are drawn in, and the dates of its two ends are written under it.
export const mostPoints = 12;
const PLOT = { left: 724, right: 1076, top: 208, bottom: 440 };
const TEXT_LEFT = 716;
const TEXT_RIGHT = 1096;
const LINE_WORDS_FIT = 17;

// The rows of the bars: { rows, more }. A row is { name, backlog, progress, done, total } and counts the board's
// tasks of that lead. A task from the board that has no lead entry, or a status that is not one of the three
// stacks, is not counted. more is how many lead entries did not fit in six rows.
export function barsFor(content, now) {
  const groups = groupsFor(content, now);

  const rows = groups.map(group => {
    const row = { name: group.name };
    stacks.forEach(stack => {
      row[stack.id] = group.tasks.filter(task => task.status === stack.status).length;
    });
    row.total = row.backlog + row.progress + row.done;
    return row;
  }).filter(row => row.total > 0);

  return { rows: rows.slice(0, mostRows), more: Math.max(0, rows.length - mostRows) };
}

// The most counts the line has room for, taken evenly from the first to the last, with both ends kept.
// A list that already fits is as it is.
export function thinOut(list, most) {
  if (list.length <= most) return list;

  const picked = [];
  for (let index = 0; index < most; index++) picked.push(list[Math.round(index * (list.length - 1) / (most - 1))]);
  return picked;
}

// The line of the items left, or null when there are fewer than two daily counts to draw it from. It is
// { points, target, first, last, endDate, label } where a point is { date, open, x, y } in the body, and target
// is { x1, y1, x2, y2 } for the dashed line to nothing on the date of the countdown, or null when the countdown
// has no date still to come. Dates are along the line by the day, so a missing day is a gap and not a step.
export function lineFor(content, now) {
  const counts = content.monday ? content.monday.snapshots : [];
  if (counts.length < 2) return null;

  const picked = thinOut(counts, mostPoints);
  const settings = content.settings && content.settings.countdown ? content.settings.countdown : {};
  const countdown = countdownMarker(settings, zoneOf(content), todayOf(content, now));

  const firstDay = picked[0].date;
  const lastDay = picked[picked.length - 1].date;
  const goal = countdown && countdown.date > lastDay ? countdown : null;
  const endDate = goal ? goal.date : lastDay;
  const span = Math.max(1, daysFromTo(firstDay, endDate));
  const high = Math.max(1, ...picked.map(count => count.open));

  const xOf = date => Math.round(PLOT.left + (daysFromTo(firstDay, date) / span) * (PLOT.right - PLOT.left));
  const yOf = open => Math.round(PLOT.bottom - (open / high) * (PLOT.bottom - PLOT.top));
  const points = picked.map(count => ({ date: count.date, open: count.open, x: xOf(count.date), y: yOf(count.open) }));

  return {
    points: points,
    target: goal ? { x1: points[0].x, y1: points[0].y, x2: xOf(goal.date), y2: PLOT.bottom } : null,
    first: points[0],
    last: points[points.length - 1],
    endDate: endDate,
    label: goal ? goal.label : '',
  };
}

// Words in lines of at most this many characters, for the sentence that stands where the line would be.
// SVG text does not wrap by itself.
export function wrapWords(text, fits) {
  const lines = [];
  text.split(' ').forEach(word => {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + word.length <= fits) lines[last] += ' ' + word;
    else lines.push(word);
  });
  return lines;
}

// One bar, the three stacks each as long as the count so far says, so that rounding never makes it longer than its room
function stackMarkup(row, widest) {
  const parts = [];
  let counted = 0;
  let left = 0;

  stacks.forEach(stack => {
    counted += row[stack.id];
    const end = Math.round((counted / widest) * BAR.width);
    if (end > left) parts.push(`<rect class="seg seg-${stack.id}" x="${left}" y="0" width="${end - left}" height="${BAR.height}"/>`);
    left = end;
  });
  return `<svg class="stack" width="${BAR.width}" height="${BAR.height}" viewBox="0 0 ${BAR.width} ${BAR.height}" aria-hidden="true">${parts.join('')}</svg>`;
}

function rowMarkup(row, widest) {
  return `<div class="bar-row"><span class="department">${escapeHtml(row.name.toUpperCase())}</span>${stackMarkup(row, widest)}<span class="count">${row.done}/${row.total}</span></div>`;
}

// A square and a word for each stack, along the top
function legendMarkup() {
  return `<div class="legend">${stacks.map(stack => `<span class="key"><span class="swatch seg-${stack.id}"></span>${stack.label}</span>`).join('')}</div>`;
}

// The open tasks of the team and how many of them are past their due date: every board task of every lead entry
// the card has a bar for, counted once. today is a plain date in the time zone of the Look page.
export function totalsFor(content, now) {
  const tasks = groupsFor(content, now).reduce((all, group) => all.concat(group.tasks), []);
  const open = tasks.filter(task => task.status !== 'done');
  const today = todayOf(content, now);

  return { open: open.length, overdue: open.filter(task => dueDateOf(task) !== '' && dueDateOf(task) < today).length };
}

// The totals line under the bars, and nothing longer
export function totalsText(totals) {
  return totals.open + ' OPEN · ' + totals.overdue + ' OVERDUE';
}

function lineParts(line) {
  const parts = [`<line class="axis" x1="${PLOT.left}" y1="${PLOT.bottom}" x2="${PLOT.right}" y2="${PLOT.bottom}"/>`];

  parts.push(textAt(TEXT_LEFT, 124, 'ITEMS LEFT', 'label'));
  if (line.label) parts.push(textAt(TEXT_LEFT, 172, 'TO ' + cut(line.label, 9), 'label'));

  if (line.target) parts.push(`<line class="target" x1="${line.target.x1}" y1="${line.target.y1}" x2="${line.target.x2}" y2="${line.target.y2}"/>`);
  parts.push(`<polyline class="line" points="${line.points.map(point => point.x + ',' + point.y).join(' ')}"/>`);
  line.points.forEach(point => parts.push(`<circle class="dot" cx="${point.x}" cy="${point.y}" r="9"/>`));

  // the latest count, over its dot and kept inside the plot
  const at = Math.min(PLOT.right - 20, Math.max(PLOT.left + 20, line.last.x));
  parts.push(textAt(at, line.last.y - 20, String(line.last.open), 'now', 'middle'));

  parts.push(textAt(TEXT_LEFT, 500, shortDate(line.first.date), 'when'));
  parts.push(textAt(TEXT_RIGHT, 500, shortDate(line.endDate), 'when', 'end'));
  return parts;
}

// What stands in place of the line, in the same room
function noLineParts() {
  return wrapWords('Items left needs counts from two days or more.', LINE_WORDS_FIT).map((words, index) => textAt(TEXT_LEFT, 124 + index * 52, words, 'note'));
}

function describe(bars, line) {
  const rows = bars.rows.map(row => row.name + ' ' + row.done + ' of ' + row.total + ' done').join(', ');
  const left = line ? ', items left ' + line.last.open + ' on ' + shortDate(line.last.date) : '';
  return 'Progress: ' + rows + left;
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const bars = barsFor(content, now);
  const header = headerMarkup('PROGRESS', teamNameShown(), content.monday, now);
  if (bars.rows.length === 0) return pageMarkup('monday-progress', header, emptyMarkup(noRowsSentence(content)));

  const line = lineFor(content, now);
  const widest = Math.max(1, ...bars.rows.map(row => row.total));
  const more = bars.more > 0 ? `<div class="more">+${bars.more} MORE</div>` : '';
  const inner = `
      ${chartMarkup(describe(bars, line), line ? lineParts(line) : noLineParts())}
      ${legendMarkup()}
      <div class="bars">${bars.rows.map(row => rowMarkup(row, widest)).join('')}</div>
      ${more}
      <div class="totals">${totalsText(totalsFor(content, now))}</div>`;

  return pageMarkup('monday-progress', header, inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
