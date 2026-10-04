// The plan for tonight's meeting, one line per time slot.

import { rowBarMarkup, cardMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { isVisible } from '../../core/content.js';
import { formatDate, parseLocalDateTime, sameDay } from '../../core/time.js';

const MAX_ROWS = 5;

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
  const lines = rows.map((row, index) => rowMarkup(row, index === rows.length - 1)).join('');

  const date = parseLocalDateTime(plan.date);
  const dateText = date ? `<span class="tag-text">${formatDate(date)}</span>` : '';

  // The heading and place are one card, a slat like each row below it
  host.innerHTML = `
    <section class="page tonight">
      <div class="header">
        <h2 class="title" data-slat="title">TONIGHT</h2>
        <div class="tag" data-slat="tag">${dateText}${doubleSlash()}</div>
      </div>

      <div class="plan" data-slat="item">
        ${cardMarkup(1096, 140)}
        <div class="heading">${escapeHtml(plan.heading)}</div>
        <div class="location">${escapeHtml(plan.location)}</div>
      </div>

      <div class="rows">${lines}</div>
    </section>`;
}

// Every row is a slat, and the thin metal bar under it turns over with it.
// The last row has no bar under it, because the frame is there.
function rowMarkup(row, isLast) {
  const lead = hasText(row.lead) ? `<div class="lead">${escapeHtml(row.lead)}</div>` : '';

  return `
    <div class="row" data-slat="item">
      ${isLast ? '' : rowBarMarkup(1124)}
      <div class="time">${escapeHtml(row.time)}</div>
      <div class="text">${escapeHtml(row.text)}</div>
      ${lead}
    </div>`;
}
