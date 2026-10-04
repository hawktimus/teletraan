// Features one sponsor: its name, a few words about it and its logo. Each
// time the panel comes round it is the next sponsor in the list.

import { cardMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';
import { makeTurns } from '../../core/turns.js';

const nextSponsor = makeTurns();

function featurable(content) {
  return visibleItems(content.sponsors).filter(sponsor => hasText(sponsor.name));
}

export function hasContent(content) {
  return featurable(content).length > 0;
}

// The name is a card, and the blurb and the logo each turn over on their own,
// so each is a slat.
export function mount(host, content) {
  const sponsor = nextSponsor(featurable(content)) || {};

  const tier = sponsor.tier ? `<span class="tag-text">${escapeHtml(sponsor.tier)}</span>` : '';

  host.innerHTML = `
    <section class="page sponsor-feature">
      <div class="header">
        <h2 class="title" data-slat="title">SPONSOR</h2>
        <div class="tag" data-slat="tag">${tier}${doubleSlash()}</div>
      </div>

      <div class="story">
        <div class="name" data-slat="item">
          ${cardMarkup(1096, 128)}
          <div class="name-text">${escapeHtml(sponsor.name)}</div>
        </div>
        <div class="lower">
          <div class="blurb" data-slat="item">${escapeHtml(sponsor.blurb)}</div>
          ${logoMarkup(sponsor.logoAddress)}
        </div>
      </div>
    </section>`;

  hideBrokenLogo(host);
}

// The logo sits on white, in a card with a thin metal edge
function logoMarkup(address) {
  if (!address) return '';

  return `<div class="logo-card" data-slat="item">
    <div class="logo-card-picture"><img src="${escapeHtml(address)}" alt=""></div>
    ${cardMarkup(360, 280)}
  </div>`;
}

// If the picture cannot be loaded, the empty box goes away and the text
// takes the whole width
function hideBrokenLogo(host) {
  const logo = host.querySelector('.logo-card');
  if (!logo) return;

  logo.querySelector('img').addEventListener('error', () => logo.remove());
}
