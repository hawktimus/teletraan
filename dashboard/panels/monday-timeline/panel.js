// The timeline panel of a Monday row: eight weeks from the Monday before today, a row for each department that has
// a task with a Timeline (at most six), each task a bar from its start to its due date in the color of its status,
// and a dashed red line for today. The countdown date is a red marker when it falls inside the eight weeks. A task with
// no Timeline is not drawn, and the header says how many. It is one SVG, drawn twice: 1104 wide for the page, and
// 1379 wide for the bar layout (Minimal), where the main panel is wider (monday.css, layouts/bar.css), and the style
// sheet shows the one the layout needs. The text sizes are the ones of the order: week labels 28px, bar labels 32px.

import { countdownMarker, todayOf } from '../../core/competition.js';
import { timeZoneOf } from '../../core/theme.js';
import { boardEmptyMarkup, boardHeader, legendMarkup, pageMarkup } from '../../core/monday-draw.js';
import { timelineView } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

export const widths = { page: 1104, bar: 1379 };
const LEFT = 300;
const TOP = 40;
const ROW = 72;
const RIGHT = 12;

export function hasContent(content, page) {
  return timelineView(content, new Date(), page) !== null;
}

function barMarkup(bar, rowTop, gridLeft, grid) {
  const x = gridLeft + bar.from * grid;
  const width = Math.max(8, (bar.to - bar.from) * grid);
  const height = bar.lanes === 2 ? 34 : 48;
  const y = rowTop + (bar.lanes === 2 ? 2 + bar.lane * 34 : 12);

  return `<svg class="bar bar-${bar.status}" x="${round(x)}" y="${y}" width="${round(width)}" height="${height}"><rect width="100%" height="100%"/><text x="12" y="${height - (bar.lanes === 2 ? 7 : 12)}">${escapeHtml(bar.title)}</text></svg>`;
}

function round(number) {
  return Math.round(number * 10) / 10;
}

// The picture at one width. marker is the countdown date as { label, at } where at is its place in the eight weeks, or null.
function svgMarkup(view, width, marker, className) {
  const grid = width - LEFT - RIGHT;
  const week = grid / view.weeks.length;
  const bottom = TOP + view.rows.length * ROW;
  const columns = view.weeks.map((label, index) => `<line class="rule" x1="${round(LEFT + index * week)}" y1="${TOP - 4}" x2="${round(LEFT + index * week)}" y2="${bottom}"/><text class="week" x="${round(LEFT + index * week + 6)}" y="26">${escapeHtml(label)}</text>`).join('');
  const rows = view.rows.map((row, index) => {
    const top = TOP + index * ROW;
    return `<line class="rule rule-row" x1="0" y1="${top + ROW}" x2="${width}" y2="${top + ROW}"/><text class="dept" x="0" y="${top + 48}">${escapeHtml(row.name)}</text>${row.bars.map(bar => barMarkup(bar, top, LEFT, grid)).join('')}`;
  }).join('');

  const today = view.todayAt >= 0 && view.todayAt <= 1 ? `<line class="today" x1="${round(LEFT + view.todayAt * grid)}" y1="${TOP - 4}" x2="${round(LEFT + view.todayAt * grid)}" y2="${bottom}"/><text class="today-label" x="${round(LEFT + view.todayAt * grid)}" y="${bottom + 22}">TODAY</text>` : '';
  const gamedrop = marker ? `<line class="gamedrop" x1="${round(LEFT + marker.at * grid)}" y1="${TOP - 4}" x2="${round(LEFT + marker.at * grid)}" y2="${bottom}"/><text class="gamedrop-label" x="${round(LEFT + marker.at * grid)}" y="${bottom + 22}">${escapeHtml(marker.label)}</text>` : '';

  return `<svg class="${className}" viewBox="0 0 ${width} ${bottom + 24}" role="img" aria-label="Timeline">${columns}${rows}${today}${gamedrop}</svg>`;
}

// The countdown date as a place in the eight weeks, or null when it is outside them
function markerOf(content, now, view) {
  const found = countdownMarker(content.settings && content.settings.countdown ? content.settings.countdown : {}, timeZoneOf(content), todayOf(content, now));
  if (!found) return null;

  const day = Math.round(Date.parse(found.date + 'T00:00:00Z') / 86400000) - view.first;
  return day >= 0 && day < view.days ? { label: found.label, at: (day + 0.5) / view.days } : null;
}

export function markupFor(content, now, page) {
  const view = timelineView(content, now, page);
  if (!view) return pageMarkup('monday-timeline', boardHeader('TIMELINE', '', content, now, '8 WEEKS'), boardEmptyMarkup(content));

  const lead = '8 WEEKS' + (view.without > 0 ? ' · ' + view.without + ' WITHOUT DATES' : '');
  const marker = markerOf(content, now, view);
  const inner = `
      <div class="chart">${svgMarkup(view, widths.page, marker, 'picture picture-page')}${svgMarkup(view, widths.bar, marker, 'picture picture-bar')}</div>
      ${legendMarkup()}`;

  return pageMarkup('monday-timeline', boardHeader(view.title, view.team.name, content, now, lead), inner);
}

export function mount(host, content, page) {
  host.innerHTML = markupFor(content, new Date(), page);
}
