// Days since the last incident, counted from the date set in Dashboard
// Settings.

import { rowBarMarkup } from '../../core/plate.js';
import { parseLocalDateTime, daysBetween } from '../../core/time.js';

// Two digits do not fit beside the caption with any room to spare, so from 10
// up the number is smaller and the caption goes under it
const BIG_NUMBER_LIMIT = 10;
const PLACEHOLDER = '[00]';

function sinceDate(content) {
  return parseLocalDateTime(content.settings.safetyDaysSince);
}

// The sample content has no date, but the panel is still shown so the
// layout can be seen
function isSample(content) {
  return Boolean(content.status) && content.status.source === 'sample';
}

// A date in the future counts as 0
function daysSince(since, now = new Date()) {
  return Math.max(0, daysBetween(since, now));
}

export function hasContent(content) {
  return sinceDate(content) !== null || isSample(content);
}

export function mount(host, content) {
  const since = sinceDate(content);
  const days = since ? daysSince(since) : null;

  const number = days === null ? PLACEHOLDER : String(days);
  const caption = (days === 1 ? 'DAY' : 'DAYS') + ' SINCE<br>LAST INCIDENT';

  const stacked = days === null || days >= BIG_NUMBER_LIMIT;

  // The placeholder's brackets are tall, so it gets a smaller number still
  let layout = '';
  if (stacked) layout = ' stacked';
  if (days === null) layout += ' placeholder';

  // A thin metal bar goes between the number and the caption, but only when
  // the caption is under the number
  const bar = stacked ? rowBarMarkup(628) : '';

  host.innerHTML = `
    <section class="page safety-days">
      <div class="label" data-slat="label">SAFETY</div>
      <div class="tape" data-slat="tag"></div>

      <div class="content${layout}" data-slat="content">
        <div class="number">${number}</div>
        <div class="caption">${bar}${caption}</div>
      </div>
    </section>`;
}
