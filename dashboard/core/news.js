// The FRC news: headlines from the FIRST community blog. The Teletraan computer reads the blog feed and writes the
// document frc-news (computer/scripts/news-sync.sh, docs/frc-news.md). Only the headline, the date, the categories and
// the address are kept, never the text of an article. This file holds the plain functions that clean that document
// and pick what the panel (panels/frc-news) and the ticker draw, so tests/news.test.mjs can run them with node.

import { isRecord } from './text.js';

// Headlines older than this are not shown
export const newsMaxAgeDays = 60;
// How many headlines the panel draws at most, and how many the ticker takes
export const newsPanelCount = 5;
export const newsTickerCount = 3;
// The amber STALE chip shows when the list was last written longer ago than this
export const newsStaleHours = 12;
// A ticker line is at most this many characters, with the FIRST: in front
export const tickerLineLength = 90;
export const newsLinePrefix = 'FIRST: ';

const msPerHour = 60 * 60 * 1000;
const msPerDay = 24 * msPerHour;

function textOf(value, longest) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, longest) : '';
}

function timeOf(value) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return isNaN(time) ? null : time;
}

// One headline of the document, or null when it has no title or no date. A headline that has no address is kept, because the
// screen never links to it. The category list is short plain words.
export function tidyHeadline(raw) {
  if (!isRecord(raw)) return null;

  const title = textOf(raw.title, 140);
  const date = timeOf(raw.date) === null ? '' : raw.date;
  if (title === '' || date === '') return null;

  const categories = Array.isArray(raw.categories) ? raw.categories.map(name => textOf(name, 30)).filter(name => name !== '').slice(0, 8) : [];
  const systemcore = raw.systemcore === true || /system ?core/i.test(title + ' ' + categories.join(' '));
  return { title: title, link: textOf(raw.link, 300), date: date, categories: categories, systemcore: systemcore, source: 'FIRST' };
}

// The document, always complete: { lastSyncAt, lastError, items }. No document, or one that is not an object, is the empty
// list, which means the screen has nothing to show and the panel is skipped.
export function emptyNews() {
  return { lastSyncAt: '', lastError: '', items: [] };
}

export function tidyNews(raw) {
  if (!isRecord(raw)) return emptyNews();

  return {
    lastSyncAt: timeOf(raw.lastSyncAt) === null ? '' : raw.lastSyncAt,
    lastError: textOf(raw.lastError, 300),
    items: (Array.isArray(raw.items) ? raw.items : []).map(tidyHeadline).filter(item => item !== null),
  };
}

// The sample file gives its headlines as days ago and the sync as hours ago, so that the sample is never older than
// the limit. The times are on the hour, so reading the sample twice in a row gives the same content. Used only for
// ?sample=1 (core/sanity-content.js, normalizeSample).
export function tidySampleNews(raw, now = new Date()) {
  if (!isRecord(raw)) return emptyNews();

  const onTheHour = Math.floor(now.getTime() / msPerHour) * msPerHour;
  const ago = (days, hours) => new Date(onTheHour - days * msPerDay - hours * msPerHour).toISOString();
  const items = (Array.isArray(raw.items) ? raw.items : []).filter(isRecord).map(item => Object.assign({}, item, { date: typeof item.daysAgo === 'number' ? ago(item.daysAgo, 0) : item.date }));

  return tidyNews({ lastSyncAt: typeof raw.hoursAgo === 'number' ? ago(0, raw.hoursAgo) : raw.lastSyncAt, lastError: raw.lastError, items: items });
}

// The settings of the news, always complete (the FRC news section of the Competition page in the Studio)
export function tidyNewsSettings(settings, defaults) {
  if (typeof settings.newsEnabled !== 'boolean') settings.newsEnabled = defaults.newsEnabled;
  if (typeof settings.newsInTicker !== 'boolean') settings.newsInTicker = defaults.newsInTicker;
  settings.newsCategories = stringList(settings.newsCategories, defaults.newsCategories);
  settings.newsHiddenLinks = stringList(settings.newsHiddenLinks, []);
}

function stringList(value, fallback) {
  if (!Array.isArray(value)) return fallback.slice();
  return value.filter(item => typeof item === 'string' && item.trim() !== '').map(item => item.trim());
}

// The headlines the screen may draw, newest first: none when news is switched off, none that an editor hid, none older
// than the limit and none dated in the future by more than a day. At most count of them.
export function newsItems(content, now = new Date(), count = newsPanelCount) {
  const settings = content && content.settings ? content.settings : {};
  const news = content && content.news;
  if (!news || !Array.isArray(news.items) || settings.newsEnabled === false) return [];

  const hidden = Array.isArray(settings.newsHiddenLinks) ? settings.newsHiddenLinks : [];
  const oldest = now.getTime() - newsMaxAgeDays * msPerDay;
  const latest = now.getTime() + msPerDay;

  return news.items
    .filter(item => {
      const time = timeOf(item.date);
      return time !== null && time >= oldest && time <= latest && !(item.link !== '' && hidden.includes(item.link));
    })
    .sort((first, second) => timeOf(second.date) - timeOf(first.date))
    .slice(0, count);
}

// Whether the list is old: it was last written more than newsStaleHours ago. A list that was never written is not
// called stale, because the panel has nothing to show then.
export function newsIsStale(content, now = new Date()) {
  const news = content && content.news;
  const written = news ? timeOf(news.lastSyncAt) : null;
  return written !== null && now.getTime() - written > newsStaleHours * msPerHour;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Sep 23, in the time zone of the screen
export function newsDateLabel(date, zone = 'America/New_York') {
  const time = timeOf(date);
  if (time === null) return '';

  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'numeric', day: 'numeric' }).formatToParts(new Date(time));
  } catch (error) {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric' }).formatToParts(new Date(time));
  }
  const month = Number((parts.find(part => part.type === 'month') || {}).value);
  const day = (parts.find(part => part.type === 'day') || {}).value;
  return months[month - 1] + ' ' + day;
}

// A line cut at a word so that it is at most longest characters, with three dots when it was cut
export function cutAtWord(text, longest) {
  if (text.length <= longest) return text;

  const room = text.slice(0, longest - 3);
  const at = room.lastIndexOf(' ');
  return (at > longest / 2 ? room.slice(0, at) : room).replace(/[\s.,;:]+$/, '') + '...';
}

// The room the ticker line has, in pixels at 56px, and a line that is cut at a word to fit it and the 90 characters. The width
// is worked out with the advances below, so the screen never has to cut the line itself with its own three dots.
const tickerRoom = 1540;

function fitTickerLine(text) {
  let line = cutAtWord(text, tickerLineLength);
  while (line.length > 24 && lineWidth(line, 56, 500) > tickerRoom) line = cutAtWord(line.replace(/\.\.\.$/, ''), line.length - 6);
  return line;
}

// The lines the ticker adds when Show news in the ticker is on: the newest headlines as FIRST: <title>, each at most
// 90 characters and no wider than the ticker. Each is a news line, which the ticker draws with the NEWS tag.
export function newsTickerLines(content, now = new Date()) {
  const settings = content && content.settings ? content.settings : {};
  if (settings.newsInTicker !== true) return [];

  return newsItems(content, now, newsTickerCount).map(item => ({ kind: 'news', text: fitTickerLine(newsLinePrefix + item.title) }));
}

// The advance of each character from the space (32) to the tilde (126) in the body font, Atkinson Hyperlegible Next, in
// thousandths of the size, measured in the browser at weights 500 and 600. Without kerning, which only makes a word
// narrower, so a line that fits by this count fits on the screen. Any other character counts as the widest capital.
const advances = {
  500: [293, 293, 337, 697, 599, 939, 729, 180, 313, 313, 485, 601, 235, 366, 235, 408, 653, 420, 560, 586, 618, 596, 609, 521, 619, 585, 235, 235, 560, 621, 560, 507, 779, 647, 625, 650, 677, 580, 558, 704, 697, 405, 532, 644, 545, 838, 703, 727, 607, 737, 628, 599, 578, 688, 614, 868, 648, 605, 612, 326, 408, 344, 564, 383, 261, 536, 578, 495, 577, 548, 335, 572, 559, 271, 251, 518, 285, 860, 559, 559, 578, 584, 360, 486, 346, 551, 489, 707, 505, 478, 478, 359, 244, 359, 548],
  600: [303, 298, 362, 730, 604, 953, 727, 195, 324, 324, 485, 598, 252, 369, 253, 424, 656, 430, 569, 592, 621, 602, 617, 529, 621, 578, 253, 253, 564, 617, 564, 526, 780, 662, 634, 654, 683, 589, 562, 711, 699, 415, 546, 654, 548, 848, 710, 737, 617, 747, 639, 604, 592, 687, 628, 877, 666, 627, 615, 333, 424, 344, 573, 391, 274, 544, 587, 502, 586, 555, 349, 582, 565, 285, 255, 536, 301, 870, 565, 567, 587, 591, 368, 497, 360, 559, 509, 723, 522, 499, 492, 370, 249, 370, 543],
};

function lineWidth(text, size, weight) {
  const table = advances[weight] || advances[500];

  return Array.from(text).reduce((sum, character) => {
    const code = character.charCodeAt(0);
    return sum + (code >= 32 && code <= 126 ? table[code - 32] : 1010) / 1000 * size;
  }, 0);
}

// How many lines a title takes in a column of the given width, wrapping at spaces. extra is the width of what follows
// the last word on the last line (the SystemCore chip).
export function linesFor(title, size, width, extra = 0, weight = 500) {
  const words = title.split(' ');
  let lines = 1;
  let used = 0;

  words.forEach(word => {
    const need = lineWidth(word, size, weight) + (used === 0 ? 0 : lineWidth(' ', size, weight));
    if (used + need > width && used > 0) {
      lines += 1;
      used = lineWidth(word, size, weight);
    } else {
      used += need;
    }
  });
  if (extra > 0 && used + extra > width) lines += 1;
  return lines;
}

// The panel's layout, worked out here so it can be tested. The first headline is bigger. Every row has the same
// padding, and the window is 528px high. A title takes at most three lines: a longer one is cut at a word, the one case where a
// headline is cut. Rows are added while they fit, and at least one is always drawn.
export const newsLayout = {
  window: 528,
  column: 824,
  chip: 256,
  padding: 24,
  first: { size: 64, line: 72, weight: 600 },
  other: { size: 44, line: 52, weight: 500 },
  mostLines: 3,
};

export function fitHeadlines(items) {
  const rows = [];
  let used = 0;
  let full = false;

  items.forEach((item, index) => {
    const kind = index === 0 ? newsLayout.first : newsLayout.other;
    const extra = item.systemcore ? newsLayout.chip : 0;
    let title = item.title;

    while (linesFor(title, kind.size, newsLayout.column, extra, kind.weight) > newsLayout.mostLines) title = cutAtWord(title, Math.max(12, title.length - 8));
    const lines = linesFor(title, kind.size, newsLayout.column, extra, kind.weight);
    const height = lines * kind.line + newsLayout.padding;

    if (full || (rows.length > 0 && used + height > newsLayout.window)) {
      full = true;
      return;
    }
    rows.push({ item: item, title: title, lines: lines, big: index === 0, height: height });
    used += height;
  });
  return rows;
}
