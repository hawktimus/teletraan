// Shows a sponsor's logo and name, the next sponsor each time the panel
// comes round.

import { cardMarkup } from '../../core/plate.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';
import { makeTurns } from '../../core/turns.js';

// Keep in step with .logo-card in sponsor-logo.css
const CARD_WIDTH = 560;
const CARD_HEIGHT = 176;

const nextSponsor = makeTurns();

function namedSponsors(content) {
  return visibleItems(content.sponsors).filter(sponsor => hasText(sponsor.name));
}

export function hasContent(content) {
  return namedSponsors(content).length > 0;
}

export function mount(host, content) {
  const sponsor = nextSponsor(namedSponsors(content));

  host.innerHTML = `
    <section class="page sponsor-logo">
      <div class="label" data-slat="label">SPONSOR</div>

      ${sponsor ? sponsorMarkup(sponsor) : ''}
    </section>`;

  // host is only a workbench, so the elements are found now, before the panel is moved onto the screen
  const image = host.querySelector('.logo');
  const body = host.querySelector('.content');
  if (image) image.addEventListener('error', () => showNameOnly(body));
}

// The logo sits in a purple card with a thin metal edge
function sponsorMarkup(sponsor) {
  const logo = sponsor.logoAddress
    ? `<div class="logo-card">${cardMarkup(CARD_WIDTH, CARD_HEIGHT)}<img class="logo" src="${escapeHtml(sponsor.logoAddress)}" alt=""></div>`
    : '';

  return `
    <div class="content ${logo ? 'with-logo' : 'name-only'}" data-slat="content">
      ${logo}
      <div class="name">${escapeHtml(sponsor.name)}</div>
    </div>`;
}

// A logo that cannot be loaded is dropped, and the name is shown larger instead
function showNameOnly(body) {
  body.classList.remove('with-logo');
  body.classList.add('name-only');
}
