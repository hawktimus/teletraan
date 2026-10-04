// The ticker along the bottom: one line at a time, with a tag for its kind.
// The scheduler asks items() for the lines and mounts one with tickerLine set.

import { tagMarkup, boltMarkup } from '../../core/plate.js';
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
    <section class="panel ticker" data-sequence="ticker">
      ${stripMarkup()}
      ${line ? lineMarkup(line) : ''}
    </section>`;
}

// The steel bar the message sits on. It is made of the same parts as a plate,
// so base.css paints it. It starts 120px in, behind the tag, and is 1720 wide
// to reach the right end of the ticker (1840). The frame is the body moved in
// by 2 and the bevel by 5 (the plates do the same with inset() in plate.js).
// The bolt at the right end sits where the message never reaches.
const stripBody = '0,0 1720,0 1720,40 1690,64 0,64';
const stripFrame = '2,2 1718,2 1718,39 1689.3,62 2,62';
const stripBevel = '5,5 1715,5 1715,37.6 1688.2,59 5,59';

export function stripMarkup() {
  return `<svg class="plate strip" width="1720" height="64" viewBox="0 0 1720 64">
    <polygon class="body" points="${stripBody}"/>
    <polygon class="brush" points="${stripBody}"/>
    <polygon class="outline" points="${stripFrame}"/>
    <polygon class="bevel" points="${stripBevel}"/>
    ${boltMarkup(1698, 32, 24)}
  </svg>`;
}

function lineMarkup(line) {
  const tag = tags[line.kind] || tags.news;

  return `
    <div class="tag" data-part="tag">
      ${tagMarkup(tag.width)}
      <span>${tag.word}</span>
    </div>
    <div class="message" data-part="message">${escapeHtml(line.text)}</div>`;
}
