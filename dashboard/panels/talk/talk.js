// The full screen pictures of a booked talk: the title card, the card for slides that
// are not ready, the thanks card, and the view that holds the slides.
// core/presentation-run.js says which one to draw and puts the slide pictures in the view.

import { cardLines } from '../../core/presentation.js';
import { escapeHtml } from '../../core/text.js';

function cardMarkup(kind, talk) {
  const lines = cardLines(kind, talk);

  return `
    <section class="panel talk ${kind}" data-sequence="talk">
      <div class="ground" data-part="ground"></div>
      <div class="label" data-part="label">${escapeHtml(lines.label)}</div>
      <div class="headline" data-part="headline">${escapeHtml(lines.headline)}</div>
      <div class="detail" data-part="detail">${escapeHtml(lines.detail)}</div>
      <div class="prompt" data-part="prompt">${escapeHtml(lines.prompt)}</div>
    </section>`;
}

// The slides are added to .slide-host by presentation-run.js. The chip has no
// data-shown until the first key, so it starts out of sight.
function slidesMarkup(talk) {
  return `
    <section class="talk slides" data-black="off">
      <div class="slide-host"></div>
      <div class="progress" data-metal="gold"><div class="progress-line"></div></div>
      <div class="chip"><span class="chip-name">${escapeHtml(talk.name)}</span><span class="chip-count"></span></div>
    </section>`;
}

export function mount(host, content) {
  const screen = content.talkScreen;
  host.innerHTML = screen.kind === 'slides' ? slidesMarkup(screen.talk) : cardMarkup(screen.kind, screen.talk);
}
