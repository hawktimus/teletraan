// A portrait slot: a framed picture of a person with the name and role
// under it. The Roster panel draws one for its team lead. The Leadership and
// Team Leads panels draw rows instead (rowsMarkup below): the picture at the
// left, the name beside it and the role at the right end.
//
// The picture is the person's photo, or the silhouette when there is no photo,
// the photo is hidden, or it cannot be loaded. The silhouette is drawn once
// in index.html and every slot points at it with <use>.
//
// The sizes here are the standard size, 100 percent, and they are repeated in
// base.css (the section People portraits). Change them together. With the
// photo at 280 and the edge of the card around it, the portrait is 292 square.
// A row draws the same portrait smaller, 124 square, because four rows have to
// fit the 576 high body of the large panel.
//
// The Portrait size setting (Screen tab in Dashboard Settings) makes the whole
// portrait bigger or smaller in proportion: the card, its metal edge, the
// picture in it and the cut corners. Each slot is still 352 wide, and the names
// and roles keep their size. A smaller portrait is only centred in the same
// space. A slot never grows past 100, because the names sit beside it. A row
// follows the setting up to 200, double: a bigger portrait needs a taller row,
// so a page holds fewer rows (rowLayout below), and the pages of Leadership and
// Team Leads carry on with the people that did not fit.

import { defaultPerson } from '../config.js';
import { photoUrl, preloadImages } from './images.js';
import { cardMarkup, rowBarMarkup } from './plate.js';
import { escapeHtml } from './text.js';
import { tidyScale, visibleItems } from './content.js';

export const rowsPerPage = 4; // the most rows on a page, at 100 percent and below

const portraitSize = 292;
const photoSize = 280;
const photoInset = 6; // from the edge of the card to the photo, (292 - 280) / 2
const slotScaleLimit = 100;
const rowPortraitSize = 124;
const rowBarLength = 1124; // the same bar as the Events panel has between its rows
const bodyHeight = 576; // the rows fill the body of the large panel
const barRoom = 20; // the bar between two rows needs 10px above and below the portrait
// The widest portrait that leaves the role 336px at the right end beside a name of 560px:
// the body is 1152 wide, the row has 28px at the left and 40px at the right and a gap of 24px
// on each side of the name, so 1152 - 68 - 48 - 560 - 336
const roleBesideLimit = 140;

// The photo is always asked for at the full size, 280 square, whatever the
// Portrait size setting says. One address for every size means the copy that
// was loaded ahead of time is the copy that is shown.

// The sizes of a portrait slot, in pixels, at a percent of the standard size: the
// card, the photo inside it, and the space between the two. At 100 they are 292,
// 280 and 6. Every size is a whole number, and the photo is the card less the
// space on both sides, so the picture never runs under the edge. A percent above
// 100 is 100: the names sit beside the portrait in its 352 wide slot.
export function portraitSizes(percent) {
  const factor = Math.min(tidyScale('portraitScale', percent), slotScaleLimit) / 100;
  const card = Math.round(portraitSize * factor);
  const inset = Math.round(photoInset * factor);

  return { card: card, photo: card - 2 * inset, inset: inset };
}

// The same three sizes for the portrait in a row. At 100 they are 124, 118 and
// 3: the picture sits in its card as it does at the standard size. At 200 they
// are 248, 238 and 5.
export function rowSizes(percent) {
  const factor = tidyScale('portraitScale', percent) / 100;
  const card = Math.round(rowPortraitSize * factor);
  const inset = Math.round(photoInset * rowPortraitSize / portraitSize * factor);

  return { card: card, photo: card - 2 * inset, inset: inset };
}

// How the rows of a page are laid out at a percent of the standard size:
//   rows     how many rows a page holds, 4 at 100 and below
//   height   the height of a row, the body divided by the rows
//   stacked  the role goes under the name instead of at the right end
// A row needs its portrait and 10px above and below it for the bar, so a bigger
// portrait leaves room for fewer rows. A portrait wider than roleBesideLimit
// leaves the role too little room beside the name, so the role goes under it.
export function rowLayout(percent) {
  const card = rowSizes(percent).card;
  const rows = Math.max(1, Math.min(rowsPerPage, Math.floor(bodyHeight / (card + barRoom))));

  return { rows: rows, height: bodyHeight / rows, stacked: card > roleBesideLimit };
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

// The address of the photo to show for a team lead, or an empty text for the
// silhouette. entry is a row of the Team Leads panel or a page of the Roster
// panel: { lead, photo, showPhoto }, where photo and showPhoto are only there
// when the Team lead entry has them. The lead's own photo comes first. With the
// switch off the lead has the silhouette, even when a person of the same name is
// in Leadership. With no photo of its own, the lead is shown with the photo of
// that person, as before there was a field for it.
export function leadAddress(entry, people) {
  if (!entry || entry.showPhoto === false) return '';
  if (entry.photo) return photoAddress(entry);

  return photoAddress(personNamed(people, entry.lead));
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

// A page of rows, at most rowLayout(scale).rows of them, one under the other. scale
// is the Portrait size setting, a percent, and no scale is 100. Each row is a slat,
// so it turns over by itself when the page changes. At 100 and below the markup is
// the one the rows always had. Above it the rows are taller (--row-height, read by
// base.css) and from roleBesideLimit up the class stacked puts the role under the name.
export function rowsMarkup(rows, scale) {
  const size = rowSizes(scale);
  const layout = rowLayout(scale);
  const lines = rows.map((row, index) => rowMarkup(row, size, index === rows.length - 1));
  const className = layout.stacked ? 'person-rows stacked' : 'person-rows';
  const height = layout.height === bodyHeight / rowsPerPage ? '' : ` style="--row-height: ${layout.height}px"`;

  return `<div class="${className}"${height}>${lines.join('')}</div>`;
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

// The same for team leads: the rows of the next page, with the people of Leadership
// whose photos a lead may borrow
export function preloadLeadPhotos(entries, people) {
  preloadImages(entries.map(entry => leadAddress(entry, people)));
}
