// A portrait slot: a framed picture of a person with the name and role
// under it. The Leadership and Team Leads panels are rows of these.
//
// The picture is the person's photo, or the silhouette when there is no photo,
// the photo is hidden, or it cannot be loaded. The silhouette is drawn once
// in index.html and every slot points at it with <use>.
//
// The sizes here are repeated in base.css (the section People portraits).
// Change them together. With the photo at 280 and the edge of the card
// around it, the portrait is 296 square, and three slots fit across the
// large panel.

import { defaultPerson } from '../config.js';
import { photoUrl, preloadImages } from './images.js';
import { cardMarkup } from './plate.js';
import { escapeHtml } from './text.js';
import { visibleItems } from './content.js';

export const slotsPerPage = 3;

const portraitSize = 296;
const photoSize = 280; // the photo is asked for at exactly this size, 1 to 1 on the screen

// The address of the photo to show for a person, or an empty text for the
// silhouette. A person who has no value for the switch follows the default.
export function photoAddress(person) {
  if (!person || !person.photo) return '';

  const shown = typeof person.showPhoto === 'boolean' ? person.showPhoto : defaultPerson.showPhoto;
  return shown ? photoUrl(person.photo, photoSize, photoSize) : '';
}

// The person in a list with this name, if they are showing. The Team Leads
// panel uses it: a subteam's lead is only a name, so the lead's photo is the
// photo of the person with the same name. Capital letters and spaces at the
// ends do not matter.
export function personNamed(people, name) {
  const wanted = String(name || '').trim().toLowerCase();
  if (!wanted) return null;

  return visibleItems(people).find(person => String(person.name || '').trim().toLowerCase() === wanted) || null;
}

export function silhouetteMarkup() {
  return `<svg class="silhouette" width="${photoSize}" height="${photoSize}" viewBox="0 0 ${photoSize} ${photoSize}">
    <use href="#person-silhouette" width="${photoSize}" height="${photoSize}"/>
  </svg>`;
}

// The attribute that gives a slot's frame its metal. gold and silver are the
// data-metal variants. red is a class, as for the countdown. Anything else
// leaves the frame the colour of the area it is in.
function metalAttribute(metal) {
  if (metal === 'red') return ' class="slot red-metal"';
  if (metal === 'gold' || metal === 'silver') return ` class="slot" data-metal="${metal}"`;
  return ' class="slot"';
}

// One slot: { name, role, address, metal }. The whole slot turns over as one
// piece when the page changes. role and metal may be empty.
export function slotMarkup(slot) {
  const picture = slot.address
    ? `<img src="${escapeHtml(slot.address)}" width="${photoSize}" height="${photoSize}" alt="">`
    : silhouetteMarkup();

  return `
    <div${metalAttribute(slot.metal)} data-slat="item">
      <div class="portrait">
        ${cardMarkup(portraitSize, portraitSize)}
        <div class="portrait-photo">${picture}</div>
      </div>
      <div class="slot-name">${escapeHtml(slot.name)}</div>
      <div class="slot-role">${escapeHtml(slot.role)}</div>
    </div>`;
}

// A photo that cannot be loaded (the address is wrong, or there is no
// connection) is replaced by the silhouette. Call it with the page's element.
export function watchPhotos(element) {
  element.querySelectorAll('.portrait-photo img').forEach(image => {
    image.addEventListener('error', () => {
      image.parentNode.innerHTML = silhouetteMarkup();
    });
  });
}

// Starts loading the photos of the people on the next page
export function preloadPhotos(people) {
  preloadImages(people.map(photoAddress));
}
