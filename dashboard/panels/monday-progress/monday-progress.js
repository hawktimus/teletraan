// The progress card of the Monday pass. On the left, one stacked bar for each Team lead entry that has board
// tasks: how many are in the backlog, in progress and done, and done out of all of them at its right. On the
// right, a line of the items left (the open tasks, all the board's tasks that are not done) from the daily
// counts in monday-status, with a dashed target line from the first count down to nothing on the date of the
// countdown. Both are plain SVG in a body of 1096 x 512, drawn once. The card always draws, with a sentence
// in place of what has no data, because the look rotation chooses it (core/monday.js, mondaySteps).

import { chartMarkup, cut, emptyMarkup, tagTextFor, textAt } from '../../core/competition-draw.js';
import { countdownMarker, todayOf, zoneOf } from '../../core/competition.js';
import { daysFromTo, shortDate } from '../../core/frc.js';
import { boardTasksFor, columns as stacks, groupByLead, leadEntries } from '../../core/monday.js';
import { pageMarkup } from '../../core/monday-draw.js';

// The bars. A row is 68px high with a bar of 44px in it, and there are six of them. The name of the lead is
// cut to fit its 216px, and the numbers of the row are at the right end of the bar's room.
export const mostRows = 6;
const ROW_TOP = 76;
const ROW_PITCH = 68;
const BAR = { left: 224, width: 324, height: 44 };
const NUMBERS_LEFT = 560;
const NAME_FITS = 7;
const LEGEND_Y = 44;

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
  const groups = groupByLead(boardTasksFor(content, now), leadEntries(content, now));

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

function barParts(bars) {
  const parts = [];
  const widest = Math.max(1, ...bars.rows.map(row => row.total));

  bars.rows.forEach((row, index) => {
    const top = ROW_TOP + index * ROW_PITCH;
    let counted = 0;
    let left = BAR.left;

    parts.push(textAt(0, top + 35, cut(row.name.toUpperCase(), NAME_FITS), 'lead'));
    stacks.forEach(stack => {
      // each stack ends where the count so far says, so rounding never makes the bar longer than its room
      counted += row[stack.id];
      const end = BAR.left + Math.round((counted / widest) * BAR.width);
      if (end > left) parts.push(`<rect class="seg seg-${stack.id}" x="${left}" y="${top}" width="${end - left}" height="${BAR.height}"/>`);
      left = end;
    });
    parts.push(textAt(NUMBERS_LEFT, top + 35, row.done + '/' + row.total, 'numbers'));
  });

  if (bars.more > 0) parts.push(textAt(0, ROW_TOP + (mostRows - 1) * ROW_PITCH + BAR.height + 40, '+' + bars.more + ' MORE', 'more'));
  return parts;
}

// A square and a word for each stack, along the top
function legendParts() {
  const parts = [];
  let left = 0;

  stacks.forEach(stack => {
    parts.push(`<rect class="seg seg-${stack.id}" x="${left}" y="${LEGEND_Y - 28}" width="28" height="28"/>`);
    parts.push(textAt(left + 40, LEGEND_Y, stack.label, 'legend'));
    left += 40 + stack.label.length * 29 + 28;
  });
  return parts;
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
  const tag = tagTextFor(content.monday, now);
  if (bars.rows.length === 0) return pageMarkup('monday-progress', 'PROGRESS', tag, emptyMarkup('No board items are showing yet.'));

  const line = lineFor(content, now);
  const parts = legendParts().concat(barParts(bars), line ? lineParts(line) : noLineParts());
  return pageMarkup('monday-progress', 'PROGRESS', tag, chartMarkup(describe(bars, line), parts));
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
