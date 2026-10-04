// The plan for tonight's meeting, one line per time slot.

import { plateMarkup, scanMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { isVisible } from '../../core/content.js';
import { formatDate, parseLocalDateTime, sameDay } from '../../core/time.js';

const MAX_ROWS = 5;

// 272 is where the first row starts: 124px (the top of the panel body)
// plus 148px for the heading and place. Each row is 80px tall. These
// numbers are repeated in tonight.css.
const FIRST_ROW_TOP = 272;
const ROW_HEIGHT = 80;

// The plan if there is one for today, otherwise null. A plan with no date
// is always for today. A date that cannot be read counts as no date, so
// the plan still shows.
function planFor(content, now = new Date()) {
  const plan = content.plan;
  if (!plan || !isVisible(plan, now)) return null;

  const date = parseLocalDateTime(plan.date);
  if (date && !sameDay(date, now)) return null;
  return plan;
}

function rowsOf(plan) {
  return (plan.rows || [])
    .filter(row => row && (hasText(row.time) || hasText(row.text) || hasText(row.lead)))
    .slice(0, MAX_ROWS);
}

export function hasContent(content) {
  return planFor(content) !== null;
}

export function mount(host, content) {
  const plan = planFor(content) || {};
  const rows = rowsOf(plan);
  const dividers = rows.map((row, index) => FIRST_ROW_TOP + index * ROW_HEIGHT);

  const date = parseLocalDateTime(plan.date);
  const dateText = date ? `<span class="tag-text">${formatDate(date)}</span>` : '';

  host.innerHTML = `
    <section class="panel tonight" data-sequence="grid1">
      ${plateMarkup('grid1', { dividers: dividers })}
      ${scanMarkup('grid1')}

      <div class="header">
        <h2 class="title" data-part="title">TONIGHT</h2>
        <div class="tag" data-part="tag">${dateText}${doubleSlash()}</div>
      </div>

      <div class="plan" data-part="content">
        <div class="heading">${escapeHtml(plan.heading)}</div>
        <div class="location">${escapeHtml(plan.location)}</div>
      </div>

      <div class="rows">${rows.map(rowMarkup).join('')}</div>
    </section>`;
}

function rowMarkup(row, index) {
  const lead = hasText(row.lead) ? `<div class="lead">${escapeHtml(row.lead)}</div>` : '';

  return `
    <div class="row" data-part="row" data-index="${index}">
      <div class="time">${escapeHtml(row.time)}</div>
      <div class="text">${escapeHtml(row.text)}</div>
      ${lead}
    </div>`;
}
