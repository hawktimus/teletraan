// Days since the last incident, counted from the date set in Dashboard
// Settings.

import { plateMarkup, scanMarkup } from '../../core/plate.js';
import { parseLocalDateTime, daysBetween } from '../../core/time.js';

// Three digits do not fit beside the caption, so from 100 up the number is
// smaller and the caption goes under it
const BIG_NUMBER_LIMIT = 100;
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

  // The placeholder's brackets are tall, so it gets a smaller number still
  let layout = '';
  if (days === null) layout = ' stacked placeholder';
  else if (days >= BIG_NUMBER_LIMIT) layout = ' stacked';

  host.innerHTML = `
    <section class="panel safety-days" data-sequence="grid2">
      ${plateMarkup('grid2')}
      ${scanMarkup('grid2')}

      <div class="label" data-part="label">SAFETY</div>
      <div class="tape" data-part="label"></div>

      <div class="content${layout}" data-part="content">
        <div class="number">${number}</div>
        <div class="caption">${caption}</div>
      </div>
    </section>`;
}
