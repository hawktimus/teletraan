// A portrait slot: a framed picture of a person with the name and role
// under it. The Roster panel draws one for its team lead. The Leadership and
// Team Leads panels draw rows instead (rowsMarkup below): the picture at the
// left, the name beside it and the role at the right end.
//
// The picture is the person's photo, or the silhouette when there is no photo,
// the photo is hidden, or it cannot be loaded. The silhouette is drawn once
// in index.html and every slot points at it with <use>.
//
// The sizes here are the full size, 100 percent, and they are repeated in
// base.css (the section People portraits). Change them together. With the
// photo at 280 and the edge of the card around it, the portrait is 292 square.
// A row draws the same portrait smaller, 124 square, because four rows have to
// fit the 576 high body of the large panel.
//
// The Portrait size setting (Photos tab in Dashboard Settings) makes the whole
// portrait smaller in proportion: the card, its metal edge, the picture in it
// and the cut corners. Each slot is still 352 wide and each row is still 144
// high, and the names and roles keep their size, so a smaller portrait is only
// centred in the same space.

import { defaultPerson } from '../config.js';
import { photoUrl, preloadImages } from './images.js';
import { cardMarkup, rowBarMarkup } from './plate.js';
import { escapeHtml } from './text.js';
import { tidyScale, visibleItems } from './content.js';

export const rowsPerPage = 4;

const portraitSize = 292;
const photoSize = 280;
const photoInset = 6; // from the edge of the card to the photo, (292 - 280) / 2
const rowPortraitSize = 124;
const rowBarLength = 1124; // the same bar as the Events panel has between its rows

// The photo is always asked for at the full size, 280 square, whatever the
// Portrait size setting says. One address for every size means the copy that
// was loaded ahead of time is the copy that is shown.

// The sizes of a portrait, in pixels, at a percent of the full size: the card,
// the photo inside it, and the space between the two. At 100 they are 292, 280
// and 6. Every size is a whole number, and the photo is the card less the space
// on both sides, so the picture never runs under the edge.
export function portraitSizes(percent) {
  const factor = tidyScale('portraitScale', percent) / 100;
  const card = Math.round(portraitSize * factor);
  const inset = Math.round(photoInset * factor);

  return { card: card, photo: card - 2 * inset, inset: inset };
}

// The same three sizes for the portrait in a row. At 100 they are 124, 118 and
// 3: the picture sits in its card as it does at the full size.
export function rowSizes(percent) {
  const factor = tidyScale('portraitScale', percent) / 100;
  const card = Math.round(rowPortraitSize * factor);
  const inset = Math.round(photoInset * rowPortraitSize / portraitSize * factor);

  return { card: card, photo: card - 2 * inset, inset: inset };
}

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

// The attributes that give an element its metal: the class it already has, and
// for gold and silver the data-metal variants. red is a class, as for the
// countdown. Anything else leaves the frame the colour of the area it is in.
function metalAttribute(className, metal) {
  if (metal === 'red') return ` class="${className} red-metal"`;
  if (metal === 'gold' || metal === 'silver') return ` class="${className}" data-metal="${metal}"`;
  return ` class="${className}"`;
}

// The framed picture. The card is always drawn at the full size, and the
// browser draws it smaller when the portrait is smaller. That keeps the metal
// edge and the cut corner in proportion. The sizes go to base.css as three
// variables on the portrait.
function portraitMarkup(size, address, metal) {
  const picture = address
    ? `<img src="${escapeHtml(address)}" width="${size.photo}" height="${size.photo}" alt="">`
    : silhouetteMarkup();
  const variables = `--portrait-card: ${size.card}px; --portrait-photo: ${size.photo}px; --portrait-inset: ${size.inset}px`;

  return `<div${metalAttribute('portrait', metal)} style="${variables}">
        ${cardMarkup(portraitSize, portraitSize)}
        <div class="portrait-photo">${picture}</div>
      </div>`;
}

// One slot: { name, role, address, metal, scale }. The whole slot turns over as
// one piece when the page changes. role and metal may be empty. scale is the
// Portrait size setting, a percent, and no scale is 100.
export function slotMarkup(slot) {
  return `
    <div${metalAttribute('slot', slot.metal)} data-slat="item">
      ${portraitMarkup(portraitSizes(slot.scale), slot.address)}
      <div class="slot-name">${escapeHtml(slot.name)}</div>
      <div class="slot-role">${escapeHtml(slot.role)}</div>
    </div>`;
}

// One row: { name, role, address, metal }, as for a slot. The metal is the frame
// of the picture only. The thin bar under the row is left out for the last row,
// because the frame of the panel is there.
function rowMarkup(row, size, isLast) {
  return `
    <div class="person-row" data-slat="item">
      ${isLast ? '' : rowBarMarkup(rowBarLength)}
      ${portraitMarkup(size, row.address, row.metal)}
      <div class="person-name">${escapeHtml(row.name)}</div>
      <div class="person-role">${escapeHtml(row.role)}</div>
    </div>`;
}

// A page of rows, at most rowsPerPage of them, one under the other. scale is the
// Portrait size setting, a percent, and no scale is 100. Each row is a slat, so
// it turns over by itself when the page changes.
export function rowsMarkup(rows, scale) {
  const size = rowSizes(scale);
  const lines = rows.map((row, index) => rowMarkup(row, size, index === rows.length - 1));

  return `<div class="person-rows">${lines.join('')}</div>`;
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
