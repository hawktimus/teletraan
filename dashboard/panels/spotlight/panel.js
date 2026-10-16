// Puts one subteam in the spotlight: a headline and a few words about what
// it has been doing. Each time the panel comes round it is the next subteam.

import { cardMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';
import { makeTurns } from '../../core/turns.js';

const nextSubteam = makeTurns();

function spotlighted(content) {
  return visibleItems(content.subteams).filter(subteam =>
    subteam.spotlight && (subteam.spotlightHeadline || subteam.spotlightText));
}

export function hasContent(content) {
  return spotlighted(content).length > 0;
}

// The name is a card, and the headline, the text and the lead each turn over
// on their own, so each is a slat.
export function mount(host, content) {
  const subteam = nextSubteam(spotlighted(content)) || {};

  host.innerHTML = `
    <section class="page spotlight">
      <div class="header">
        <h2 class="title" data-slat="title">SPOTLIGHT</h2>
        <div data-slat="tag">${doubleSlash()}</div>
      </div>

      <div class="story">
        <div class="name" data-slat="item">
          ${cardMarkup(1096, 128)}
          <div class="name-text">${escapeHtml(subteam.name)}</div>
        </div>
        <div class="details">
          ${lineMarkup('headline', subteam.spotlightHeadline)}
          ${lineMarkup('text', subteam.spotlightText)}
          ${leadMarkup(subteam.lead)}
        </div>
      </div>
    </section>`;
}

// Nothing is drawn for a field the editors left empty, so it leaves no gap
function lineMarkup(className, text) {
  return text ? `<div class="${className}" data-slat="item">${escapeHtml(text)}</div>` : '';
}

function leadMarkup(lead) {
  return lead
    ? `<div class="lead" data-slat="item"><span class="lead-label">LEAD</span>${escapeHtml(lead)}</div>`
    : '';
}
