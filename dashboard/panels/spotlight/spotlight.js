// Puts one subteam in the spotlight: a headline and a few words about what
// it has been doing. Each time the panel comes round it is the next subteam.

import { plateMarkup, scanMarkup } from '../../core/plate.js';
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

export function mount(host, content) {
  const subteam = nextSubteam(spotlighted(content)) || {};

  host.innerHTML = `
    <section class="panel spotlight" data-sequence="grid1">
      ${plateMarkup('grid1')}
      ${scanMarkup('grid1')}

      <div class="header">
        <h2 class="title" data-part="title">SPOTLIGHT</h2>
        <div data-part="tag">${doubleSlash()}</div>
      </div>

      <div class="story" data-part="content">
        ${lineMarkup('name', subteam.name)}
        ${lineMarkup('headline', subteam.spotlightHeadline)}
        ${lineMarkup('text', subteam.spotlightText)}
        ${leadMarkup(subteam.lead)}
      </div>
    </section>`;
}

// Nothing is drawn for a field the editors left empty, so it leaves no gap
function lineMarkup(className, text) {
  return text ? `<div class="${className}">${escapeHtml(text)}</div>` : '';
}

function leadMarkup(lead) {
  return lead ? `<div class="lead"><span class="lead-label">LEAD</span>${escapeHtml(lead)}</div>` : '';
}
