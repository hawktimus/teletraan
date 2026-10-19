// What the two Match13 cards share (panels/competition-forecast, panels/competition-qualify): the page with its
// header, where the amber STALE chip stands when the file is old, and the small words. Plain functions that
// return markup, so tests/match13.test.mjs can run them. Both cards draw on the same body of 1096 x 512 as the
// other competition cards (core/competition-draw.js).

import { markBeside } from './marks.js';
import { escapeHtml } from './text.js';
import { textWidth } from './text-width.js';
import { currentMatch13, match13Stale } from './match13.js';
import { frcOf } from './competition.js';
import { eventName } from './frc.js';

export { bodySize, chartMarkup, emptyMarkup, textAt } from './competition-draw.js';

// The words at the right end of the header: SAMPLE for the made up file, and the amber STALE chip when the file
// is old. The chip is 30px, like every chip.
export function tagMarkup(data, now) {
  if (data && data.sample === true) {
    return `<span class="tag-text">SAMPLE</span>${markBeside(textWidth('SAMPLE', 600, 44))}`;
  }
  if (match13Stale(data, now)) {
    return `<span class="stale-chip">STALE</span>${markBeside(textWidth('STALE', 700, 30) + 28)}`;
  }
  return markBeside(0);
}

// The page of a card, like pageMarkup in core/competition-draw.js with the tag above
export function pageMarkup(cardId, title, data, now, inner) {
  return `
    <section class="page competition ${cardId}">
      <div class="header">
        <h2 class="title" data-slat="title">${escapeHtml(title)}</h2>
        <div class="tag" data-slat="tag">${tagMarkup(data, now)}</div>
      </div>

      <div class="body" data-slat="item">${inner}</div>
    </section>`;
}

// 1ST, 2ND, 3RD, 4TH, 11TH, 21ST
export function ordinal(value) {
  const rounded = Math.round(value);
  const tens = rounded % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][rounded % 10] || 'TH';
  return rounded + suffix;
}

// The name of one of our teams on a card: PRIME, NOVA, or TEAM 1234 for a team with no code
export function teamLabel(ours, number) {
  const found = ours.find(team => team.number === number);
  const code = found ? found.code : '';
  return /^[a-z]{2,10}$/.test(code) ? code.toUpperCase() : 'TEAM ' + number;
}

// The name of an event by its key, from the events the competition feed holds, or the key itself
export function eventTitle(content, key, now) {
  const frc = frcOf(content, now);
  const events = [];
  if (frc && Array.isArray(frc.teams)) frc.teams.forEach(team => events.push(...team.events));
  if (frc && Array.isArray(frc.districtEvents)) events.push(...frc.districtEvents);
  const found = events.find(event => event.key === key);
  return found ? eventName(found) : key.toUpperCase();
}

// 80% from 0.8, with 0% and 100% kept for values that are those, and nothing in between rounded to either
export function percentText(value) {
  if (typeof value !== 'number' || !isFinite(value)) return '-';
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  if (percent === 0 && value > 0) return '1%';
  if (percent === 100 && value < 1) return '99%';
  return percent + '%';
}

export function dataNow() {
  return currentMatch13();
}
