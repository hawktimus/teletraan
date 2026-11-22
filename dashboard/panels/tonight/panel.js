// The agenda of today's meeting, one line per time slot.

import { rowBarMarkup, cardMarkup } from '../../core/plate.js';
import { pageWidth } from '../../core/page-width.js';
import { markBeside } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { textWidth } from '../../core/text-width.js';
import { visibleItems } from '../../core/content.js';
import { formatDate, parseLocalDateTime, sameDay } from '../../core/time.js';

const MAX_ROWS = 5;

// The first plan that is showing, is for today and is for the team on the screen, otherwise
// null. A plan with no date is always for today. A date that cannot be read counts as no
// date, so the plan still shows. Content with only a plan, and no list of plans, has that one.
function planFor(content, now = new Date()) {
  const plans = Array.isArray(content.plans) && content.plans.length > 0 ? content.plans : [content.plan];

  return visibleItems(plans.filter(Boolean), now).find(plan => {
    const date = parseLocalDateTime(plan.date);
    return !date || sameDay(date, now);
  }) || null;
}

function rowsOf(plan) {
  return (plan.rows || [])
    .filter(row => row && (hasText(row.time) || hasText(row.text) || hasText(row.lead)))
    .slice(0, MAX_ROWS);
}

// Every line of the panel, top to bottom: the rows of the plan, up to MAX_ROWS.
//   { kind: 'plan', time, text, lead }
export function rowsFor(content, now = new Date()) {
  const plan = planFor(content, now);
  return (plan ? rowsOf(plan) : []).map(row => ({ kind: 'plan', time: row.time, text: row.text, lead: row.lead }));
}

export function hasContent(content) {
  const now = new Date();
  return planFor(content, now) !== null;
}

export function mount(host, content) {
  const now = new Date();
  const rows = rowsFor(content, now);
  const plan = planFor(content, now) || {};
  const lines = rows.map((row, index) => rowMarkup(row, index === rows.length - 1)).join('');

  const date = parseLocalDateTime(plan.date);
  const dateWords = date ? formatDate(date) : '';
  const dateText = date ? `<span class="tag-text">${dateWords}</span>` : '';

  // The heading and place are one card, a slat like each row below it
  host.innerHTML = `
    <section class="page tonight">
      <div class="header">
        <h2 class="title" data-slat="title">AGENDA</h2>
        <div class="tag" data-slat="tag">${dateText}${markBeside(textWidth(dateWords, 600, 44))}</div>
      </div>

      <div class="plan" data-slat="item">
        ${cardMarkup(pageWidth() - 56, 140)}
        <div class="heading">${escapeHtml(plan.heading)}</div>
        <div class="location">${escapeHtml(plan.location)}</div>
      </div>

      <div class="rows">${lines}</div>
    </section>`;
}

// Every row is a slat, and the thin metal bar under it turns over with it.
// The last row has no bar under it, because the frame is there.
function rowMarkup(row, isLast) {
  const bar = isLast ? '' : rowBarMarkup(pageWidth() - 28);
  const lead = hasText(row.lead) ? `<div class="lead">${escapeHtml(row.lead)}</div>` : '';

  return `
    <div class="row" data-slat="item">
      ${bar}
      <div class="time">${escapeHtml(row.time)}</div>
      <div class="text">${escapeHtml(row.text)}</div>
      ${lead}
    </div>`;
}
