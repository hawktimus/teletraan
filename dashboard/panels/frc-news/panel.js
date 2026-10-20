// FRC NEWS: the newest headlines from the FIRST community blog, five at most, newest first. The first one is bigger. A
// headline has its date, and a SystemCore chip when it is about the new control system. Only the headline is shown, never
// the article. The Teletraan computer reads the blog (computer/scripts/news-sync.sh), core/news.js picks and fits the
// headlines, and the rotation skips the panel when there are none or when news is switched off in the Studio.
// An amber STALE chip shows when the list was last written more than 12 hours ago.

import { rowBarMarkup } from '../../core/plate.js';
import { pageWidth } from '../../core/page-width.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml } from '../../core/text.js';
import { fitHeadlines, newsDateLabel, newsIsStale, newsItems } from '../../core/news.js';
import { timeZoneOf } from '../../core/theme.js';

export function hasContent(content) {
  return newsItems(content, new Date()).length > 0;
}

function rowMarkup(row, last, zone) {
  const chip = row.item.systemcore ? '<span class="chip" data-chip="systemcore">SYSTEMCORE</span>' : '';

  return `
    <div class="row${row.big ? ' row-big' : ''}" data-slat="item">
      ${last ? '' : rowBarMarkup(pageWidth() - 28)}
      <div class="date">${escapeHtml(newsDateLabel(row.item.date, zone))}</div>
      <div class="headline">${escapeHtml(row.title)}${chip}</div>
    </div>`;
}

export function markupFor(content, now) {
  const rows = fitHeadlines(newsItems(content, now));
  const zone = timeZoneOf(content);
  const late = newsIsStale(content, now);
  const stale = late ? '<span class="stale-chip">STALE</span>' + doubleSlash() : '';
  const body = rows.length === 0
    ? '<p class="empty" data-slat="item">No FRC news yet.</p>'
    : rows.map((row, index) => rowMarkup(row, index === rows.length - 1, zone)).join('');

  return `
    <section class="page frc-news">
      <div class="header">
        <h2 class="title" data-slat="title">FRC NEWS</h2>
        <div class="tag${late ? ' tag-stale' : ''}" data-slat="tag"><span class="ago">FROM FIRST</span>${stale}</div>
      </div>

      <div class="rows">${body}</div>
    </section>`;
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
