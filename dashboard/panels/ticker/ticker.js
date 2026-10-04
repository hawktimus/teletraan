// The ticker along the bottom: one line at a time, with a tag for its kind.
// The scheduler asks items() for the lines and mounts one with tickerLine set.

import { tagMarkup } from '../../core/plate.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';

// Longer words need a wider tag. The word is centred on the tag, and the
// slanted ends of the tag leave about 50px less room than its width.
const tags = {
  tip: { word: 'TIP', width: 208 },
  news: { word: 'NEWS', width: 208 },
  reminder: { word: 'REMINDER', width: 328 },
  thanks: { word: 'THANKS', width: 264 },
};

// The kinds an editor can choose for a tip or news entry
const noteKinds = ['tip', 'news', 'reminder'];

// Tips, news and reminders in the order they are stored, then a thank you
// from each sponsor that has one. An entry with no kind is shown as news.
export function items(content) {
  const notes = visibleItems(content.tipsAndNews)
    .filter(note => hasText(note.text))
    .map(note => ({ kind: noteKinds.includes(note.kind) ? note.kind : 'news', text: String(note.text).trim() }));

  const thanks = visibleItems(content.sponsors)
    .filter(sponsor => hasText(sponsor.thankYou))
    .map(sponsor => ({ kind: 'thanks', text: String(sponsor.thankYou).trim() }));

  return notes.concat(thanks);
}

export function mount(host, content) {
  const line = content.tickerLine || items(content)[0];

  host.innerHTML = `
    <section class="page ticker">
      ${line ? lineMarkup(line) : ''}
    </section>`;
}

function lineMarkup(line) {
  const tag = tags[line.kind] || tags.news;

  return `
    <div class="tag" data-slat="label">
      ${tagMarkup(tag.width)}
      <span>${tag.word}</span>
    </div>
    <div class="message" data-slat="content">${escapeHtml(line.text)}</div>`;
}
