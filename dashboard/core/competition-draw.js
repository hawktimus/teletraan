// What the competition cards share: the page with its header, the sentence a card says when it has
// nothing to show, the small pieces of SVG text, and the clock. They are plain functions that return
// markup, so tools/test-competition.mjs can run them. A card is a panel in panels/competition-*, and
// core/competition.js decides which of them are in the rotation.
//
// Every card draws on a body of 1096 x 512, 28 px in from the frame and 136 px down, which is the room
// the Extra panels use (panels/custom). An SVG chart is that size, and its numbers are pixels, so a
// font size in the stylesheet is the size on the screen. No chart has more than 8 bars or 12 points.

import { doubleSlash } from './marks.js';
import { escapeHtml } from './text.js';
import { minutesIn } from './night.js';
import { pad } from './time.js';
import { frcOf, todayOf, zoneOf } from './competition.js';
import { teamEntry, weekdayName } from './frc.js';
import { dateIn } from './theme.js';

export const bodySize = { width: 1096, height: 512 };

// The data is called old after this many hours. The Mini writes it about every 45 minutes at the
// least, and every 5 minutes while an event is on.
const staleHours = 2;

// Text cut to some characters, with an ellipsis counted in. The text is cut by characters, not code
// units, so a pair is never split.
export function cut(text, longest) {
  const letters = Array.from(typeof text === 'string' ? text.trim() : '');
  return letters.length <= longest ? letters.join('') : letters.slice(0, longest - 1).join('').replace(/\s+$/, '') + '…';
}

// A number for the screen: 31.2, 34, or a dash when the Mini did not find it
export function numberFor(value) {
  return typeof value === 'number' && isFinite(value) ? String(Math.round(value * 10) / 10) : '-';
}

// The EPA of a team on a card. The team on the screen has its own in its entry when the Mini did not
// write it beside the team.
export function epaOf(person, entry) {
  if (person.epa !== null) return person.epa;
  return person.number === entry.number ? entry.epa : null;
}

// 1 DAY, 5 DAYS
export function daysText(days) {
  return days + (days === 1 ? ' DAY' : ' DAYS');
}

// What a card knows about the team on the screen: its frc-status, its entry in it, and the clock in
// the time zone of the Look page
export function cardState(content, now = new Date()) {
  const frc = frcOf(content, now);
  return { frc: frc, entry: teamEntry(frc), now: now, zone: zoneOf(content), today: todayOf(content, now) };
}

// The words at the right end of the header, before the slashes: SAMPLE for sample data, and how old the
// data is when it is old
export function tagTextFor(frc, now) {
  if (!frc) return '';
  if (frc.sample === true) return 'SAMPLE';

  const written = Date.parse(frc.lastSyncAt);
  const hours = isNaN(written) ? 0 : Math.floor((now.getTime() - written) / (60 * 60 * 1000));
  if (hours < staleHours) return '';
  return hours < 48 ? hours + ' HR OLD' : Math.floor(hours / 24) + ' DAYS OLD';
}

// The page of a card: the header with the title and the tag, and the body. The body is one slat.
export function pageMarkup(cardId, title, tag, inner) {
  const tagText = tag ? `<span class="tag-text">${escapeHtml(tag)}</span>` : '';

  return `
    <section class="page competition ${cardId}">
      <div class="header">
        <h2 class="title" data-slat="title">${escapeHtml(title)}</h2>
        <div class="tag" data-slat="tag">${tagText}${doubleSlash()}</div>
      </div>

      <div class="body" data-slat="item">${inner}</div>
    </section>`;
}

// One plain sentence in place of the chart
export function emptyMarkup(sentence) {
  return `<p class="empty">${escapeHtml(sentence)}</p>`;
}

// A chart: one SVG the size of the body, with the words a screen reader says
export function chartMarkup(description, parts) {
  return `<svg class="chart" width="${bodySize.width}" height="${bodySize.height}" viewBox="0 0 ${bodySize.width} ${bodySize.height}" role="img" aria-label="${escapeHtml(description)}">${parts.join('')}</svg>`;
}

// A piece of text in a chart. The class sets the size, so the sizes are all in the stylesheet of the card.
export function textAt(x, y, text, cssClass, anchor) {
  const where = anchor ? ` text-anchor="${anchor}"` : '';
  return `<text x="${x}" y="${y}" class="${cssClass}"${where}>${escapeHtml(text)}</text>`;
}

// 2:45 PM, by the clock in the zone. Intl is not asked for the text because some versions put a
// narrow space before PM.
export function clockText(zone, moment) {
  const minutes = minutesIn(zone, moment);
  const hours = Math.floor(minutes / 60);
  return (hours % 12 || 12) + ':' + pad(minutes % 60) + ' ' + (hours < 12 ? 'AM' : 'PM');
}

// The clock, with the weekday in front when the moment is not today. today is a plain date in the zone.
export function whenText(zone, moment, today) {
  const clock = clockText(zone, moment);
  const date = dateIn(zone, moment);
  return date === today ? clock : weekdayName(date) + ' ' + clock;
}
