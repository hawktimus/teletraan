// What is up next at today's meeting, one line per time slot. The talks booked
// for today share the lines that the plan leaves free.

import { rowBarMarkup, cardMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';
import { defaultThemeSettings } from '../../config.js';
import { minutesIn } from '../../core/night.js';
import { canRun, talkEnd } from '../../core/presentation.js';
import { dateIn, isTimeZone } from '../../core/theme.js';
import { asDate, formatDate, pad, parseLocalDateTime, sameDay } from '../../core/time.js';

const MAX_ROWS = 5;
const TEXT_FITS = 18; // characters, the same as the text of a plan row (studio/schemas/plan.js)
const talksHeading = 'Talks today'; // the heading on the card when there are talks and no plan

// The end of the slot, with none of the overrun that the screen allows a speaker
const slotOnly = { graceMinutes: 0 };

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

function zoneOf(content) {
  const zone = content.theme && content.theme.timeZone;
  return isTimeZone(zone) ? zone : defaultThemeSettings.timeZone;
}

// The talks booked for today that are not over, soonest first. Today is the day on
// the wall clock in the Look time zone, as it is for events. A talk counts when it
// would run on the screen (canRun), and none count while Run presentations is off.
// A talk for the other team is not listed. It still runs at its time, whichever team is on.
function talksToday(content, now) {
  const settings = content.settings || {};
  if (settings.presentationsEnabled === false) return [];

  const zone = zoneOf(content);
  const today = dateIn(zone, now);
  const booked = (Array.isArray(content.presentations) ? content.presentations : []).filter(canRun);
  return visibleItems(booked, now)
    .filter(talk => dateIn(zone, asDate(talk.start)) === today && now < talkEnd(talk, slotOnly))
    .sort((first, second) => asDate(first.start) - asDate(second.start));
}

// 2:45 PM, by the clock in the zone. Intl is not asked for the text because some
// versions put a narrow space before PM.
function clockText(zone, moment) {
  const minutes = minutesIn(zone, moment);
  const hours = Math.floor(minutes / 60);
  return (hours % 12 || 12) + ':' + pad(minutes % 60) + ' ' + (hours < 12 ? 'AM' : 'PM');
}

// Cut to the width of a plan row's text, with the ellipsis counted in. The text is
// cut by characters, not code units, so a pair is never split.
function fitted(text) {
  const letters = Array.from(text);
  return letters.length <= TEXT_FITS ? text : letters.slice(0, TEXT_FITS - 1).join('').replace(/\s+$/, '') + '…';
}

function talkRow(talk, zone, now) {
  const start = asDate(talk.start);
  const live = start <= now;
  const words = [talk.name, talk.topic].filter(hasText).map(part => String(part).trim());

  return { kind: 'talk', time: clockText(zone, start), text: fitted(words.join(': ')), tag: live ? 'NOW' : 'TALK', live: live };
}

// Every line of the panel, top to bottom. The plan comes first and keeps all its
// rows. The talks fill the lines the plan leaves free, soonest first, the one in
// progress at the top. When they do not all fit, the last free line says how many
// are left out, so the panel never has more than MAX_ROWS lines. A plan of five rows
// leaves no line, and then no talk is shown.
//   { kind: 'plan', time, text, lead }
//   { kind: 'talk', time, text, tag, live }
//   { kind: 'more', text }
export function rowsFor(content, now = new Date()) {
  const plan = planFor(content, now);
  const rows = (plan ? rowsOf(plan) : []).map(row => ({ kind: 'plan', time: row.time, text: row.text, lead: row.lead }));
  const free = MAX_ROWS - rows.length;
  if (free === 0) return rows;

  const zone = zoneOf(content);
  const talks = talksToday(content, now);
  const shown = talks.length <= free ? talks : talks.slice(0, free - 1);
  const lines = rows.concat(shown.map(talk => talkRow(talk, zone, now)));
  if (shown.length < talks.length) lines.push({ kind: 'more', text: '+' + (talks.length - shown.length) + ' more' });
  return lines;
}

export function hasContent(content) {
  const now = new Date();
  return planFor(content, now) !== null || talksToday(content, now).length > 0;
}

export function mount(host, content) {
  const now = new Date();
  const rows = rowsFor(content, now);
  const plan = planFor(content, now) || (rows.length > 0 ? { heading: talksHeading } : {});
  const lines = rows.map((row, index) => rowMarkup(row, index === rows.length - 1)).join('');

  const date = parseLocalDateTime(plan.date);
  const dateText = date ? `<span class="tag-text">${formatDate(date)}</span>` : '';

  // The heading and place are one card, a slat like each row below it
  host.innerHTML = `
    <section class="page tonight">
      <div class="header">
        <h2 class="title" data-slat="title">UP NEXT</h2>
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
  const bar = isLast ? '' : rowBarMarkup(1124);
  if (row.kind === 'talk') return talkMarkup(row, bar);
  if (row.kind === 'more') return moreMarkup(row, bar);

  const lead = hasText(row.lead) ? `<div class="lead">${escapeHtml(row.lead)}</div>` : '';

  return `
    <div class="row" data-slat="item">
      ${bar}
      <div class="time">${escapeHtml(row.time)}</div>
      <div class="text">${escapeHtml(row.text)}</div>
      ${lead}
    </div>`;
}

// A talk is a row like the others, with a tag where a lead's name would be
function talkMarkup(row, bar) {
  return `
    <div class="row talk-row" data-slat="item">
      ${bar}
      <div class="time">${escapeHtml(row.time)}</div>
      <div class="text">${escapeHtml(row.text)}</div>
      <div class="talk-tag${row.live ? ' talk-now' : ''}">${escapeHtml(row.tag)}</div>
    </div>`;
}

function moreMarkup(row, bar) {
  return `
    <div class="row more-row" data-slat="item">
      ${bar}
      <div class="time"></div>
      <div class="text">${escapeHtml(row.text)}</div>
    </div>`;
}
