// Features one sponsor: its name, a few words about it and its logo. Each
// time the panel comes round it is the next sponsor in the list.

import { plateMarkup, scanMarkup, boltMarkup } from '../../core/plate.js';
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

export function mount(host, content) {
  const sponsor = nextSponsor(featurable(content)) || {};

  const tier = sponsor.tier ? `<span class="tag-text">${escapeHtml(sponsor.tier)}</span>` : '';

  host.innerHTML = `
    <section class="panel sponsor-feature" data-sequence="grid1">
      ${plateMarkup('grid1')}
      ${scanMarkup('grid1')}

      <div class="header">
        <h2 class="title" data-part="title">SPONSOR</h2>
        <div class="tag" data-part="tag">${tier}${doubleSlash()}</div>
      </div>

      <div class="story" data-part="content">
        <div class="name">${escapeHtml(sponsor.name)}</div>
        <div class="rod"></div>
        <div class="lower">
          <div class="blurb">${escapeHtml(sponsor.blurb)}</div>
          ${logoMarkup(sponsor.logoAddress)}
        </div>
      </div>
    </section>`;

  hideBrokenLogo(host);
}

// The logo is mounted in a steel frame with a brass bolt in each corner
function logoMarkup(address) {
  if (!address) return '';

  const bolts = [[12, 12], [348, 12], [12, 268], [348, 268]]
    .map(corner => boltMarkup(corner[0], corner[1], 24, 'brass'))
    .join('');

  return `<div class="logo">
    <img src="${escapeHtml(address)}" alt="">
    <svg class="logo-bolts" width="360" height="280" viewBox="0 0 360 280">${bolts}</svg>
  </div>`;
}

// If the picture cannot be loaded, the empty box goes away and the text
// takes the whole width
function hideBrokenLogo(host) {
  const logo = host.querySelector('.logo');
  if (!logo) return;

  logo.querySelector('img').addEventListener('error', () => logo.remove());
}
