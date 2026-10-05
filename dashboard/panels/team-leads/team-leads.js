// The lead of each subteam, a portrait each, three to a page. When there are
// more leads, each time the panel comes round it shows the next page.

import { doubleSlash } from '../../core/marks.js';
import { hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';
import { makePages } from '../../core/turns.js';
import { personNamed, photoAddress, preloadPhotos, slotMarkup, slotsPerPage, watchPhotos } from '../../core/portrait.js';

const nextPage = makePages(slotsPerPage);

function subteamsFor(content) {
  return visibleItems(content.subteams).filter(subteam => hasText(subteam.lead));
}

export function hasContent(content) {
  return subteamsFor(content).length > 0;
}

export function mount(host, content) {
  const page = nextPage(subteamsFor(content));
  const slots = page.items.map(subteam => leadSlot(subteam, content)).join('');

  host.innerHTML = `
    <section class="page team-leads">
      <div class="header">
        <h2 class="title" data-slat="title">TEAM</h2>
        <div class="tag" data-slat="tag">
          <span class="tag-text">TEAM LEADS</span>
          ${doubleSlash()}
        </div>
      </div>

      <div class="slots">${slots}</div>
    </section>`;

  watchPhotos(host);
  preloadPhotos(page.upcoming.map(subteam => personNamed(content.people, subteam.lead)));
}

// SUBTEAM NAME LEAD, or just LEAD when the subteam has no name
function labelFor(subteam) {
  const name = String(subteam.name || '').trim().toUpperCase();
  return name ? name + ' LEAD' : 'LEAD';
}

// A subteam has only the lead's name. The photo is the photo of the person
// with that name under Leadership, if there is one.
function leadSlot(subteam, content) {
  return slotMarkup({
    name: subteam.lead,
    role: labelFor(subteam),
    address: photoAddress(personNamed(content.people, subteam.lead)),
    scale: content.settings && content.settings.portraitScale,
  });
}
