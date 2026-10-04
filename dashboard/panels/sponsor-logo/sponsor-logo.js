// Shows a sponsor's logo and name, the next sponsor each time the panel
// comes round.

import { plateMarkup, scanMarkup } from '../../core/plate.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';
import { makeTurns } from '../../core/turns.js';

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
    <section class="panel sponsor-logo" data-sequence="grid2">
      ${plateMarkup('grid2')}
      ${scanMarkup('grid2')}

      <div class="label" data-part="label">SPONSOR</div>

      ${sponsor ? sponsorMarkup(sponsor) : ''}
    </section>`;

  // host is only a workbench, so the elements are found now, before the panel is moved onto the screen
  const image = host.querySelector('.logo');
  const body = host.querySelector('.content');
  if (image) image.addEventListener('error', () => showNameOnly(body));
}

function sponsorMarkup(sponsor) {
  const logo = sponsor.logoAddress
    ? `<div class="logo-slot"><img class="logo" src="${escapeHtml(sponsor.logoAddress)}" alt=""></div>`
    : '';

  return `
    <div class="content ${logo ? 'with-logo' : 'name-only'}" data-part="content">
      ${logo}
      <div class="name">${escapeHtml(sponsor.name)}</div>
    </div>`;
}

// A logo that cannot be loaded is dropped, and the name is shown larger instead
function showNameOnly(body) {
  body.classList.remove('with-logo');
  body.classList.add('name-only');
}
