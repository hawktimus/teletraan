// A portrait: a framed picture of a person. The Roster panel draws one slot for its
// team lead, with the name and role under it. The Leadership and Team Leads panels
// draw rows instead (rowsMarkup below): the portrait at the left, the name, the role
// and a quiet line stacked beside it, and a chip at the right end. Leadership leaves
// the role empty, because its Role is the chip.
//
// The picture is the person's photo, or the silhouette when there is no photo,
// the photo is hidden, or it cannot be loaded. The silhouette is drawn once
// in index.html and every slot points at it with <use>.
//
// The sizes here are repeated in base.css (the section People portraits). Change
// them together. The Roster slot is the standard size, 292 square: the photo at
// 280 and the edge of the card around it. A row draws a portrait of 120 square at
// 100 percent, because four rows have to fit the 576 high body of the large panel.
//
// Four Portraits settings in Dashboard Settings (Screen tab) say how portraits are
// drawn. The Leadership size is for the Leadership rows. The Roster size is for the
// Team Leads rows and the Roster slot. Each is a percent: a row portrait is 120 at 100
// and 264 at 220. A bigger portrait needs a taller row, so a page holds fewer rows
// (rowLayout below), and the pages of Leadership and Team Leads carry on with the
// people that did not fit. A slot never grows past 100, because the names sit beside
// it. The shape (square, rounded or circle) and the frame (metal, a thin line or none)
// are one setting each and go for all three panels.

import { defaultPerson, defaultSettings, portraitFrames, portraitShapes } from '../config.js';
import { photoUrl, preloadImages } from './images.js';
import { cardMarkup } from './plate.js';
import { escapeHtml } from './text.js';
import { tidyScale, visibleItems } from './content.js';

export const rowsPerPage = 4; // the most rows on a page, at 100 percent and below

const portraitSize = 292;
const photoSize = 280;
const photoInset = 6; // from the edge of the card to the photo, (292 - 280) / 2
const slotScaleLimit = 100;
const rowPortraitSize = 120; // the portrait in a row at 100 percent
const bodyHeight = 576; // the rows fill the body of the large panel
const cornerCut = 24; // the corner cut of the rounded shape, as deep as it gets, in pixels on the screen
const lineWidth = 3; // the thin line frame

// The card of the standard portrait has its bottom right corner cut. In a box of 292 the cut runs
// from 34 above the foot of the right edge to 42 short of the right end of the foot. A picture
// with no metal edge round it is cut the same way, in percent of its box.
const cutDown = 34 / portraitSize;
const cutAcross = 42 / portraitSize;

// How many rows a page holds, by the largest size in percent that still has that many. A row is
// the body divided by the rows, and a portrait is at most 24px less than its row: 120 in 144,
// 166 in 192, 240 in 288 and 264 in 576.
const rowSteps = [
  { upTo: 100, rows: 4 },
  { upTo: 138, rows: 3 },
  { upTo: 200, rows: 2 },
  { upTo: 220, rows: 1 },
];

// The photo is always asked for at the full size, 280 square, whatever the
// portrait size setting says. One address for every size means the copy that
// was loaded ahead of time is the copy that is shown.

// The sizes of the portrait in the Roster slot, in pixels, at a percent of the standard
// size: the card, the photo inside it, and the space between the two. At 100 they are
// 292, 280 and 6. Every size is a whole number, and the photo is the card less the
// space on both sides, so the picture never runs under the edge. A percent above
// 100 is 100: the names sit beside the portrait in its 352 wide slot. A frame that is not
// metal has no space round the picture: the picture is the whole card.
export function portraitSizes(percent, frame = 'metal') {
  const factor = Math.min(tidyScale('rosterPortrait', percent), slotScaleLimit) / 100;
  const card = Math.round(portraitSize * factor);
  const inset = frame === 'metal' ? Math.round(photoInset * factor) : 0;

  return { card: card, photo: card - 2 * inset, inset: inset };
}

// The same three sizes for the portrait in a row. At 100 they are 120, 115 and 2: the
// picture sits in its card as it does at the standard size. At 220 they are 264, 254 and 5.
export function rowSizes(percent, frame = 'metal') {
  const card = Math.round(rowPortraitSize * tidyScale('leadershipPortrait', percent) / 100);
  const inset = frame === 'metal' ? Math.round(card * photoInset / portraitSize) : 0;

  return { card: card, photo: card - 2 * inset, inset: inset };
}

// How the rows of a page are laid out at a percent of the row portrait:
//   rows    how many rows a page holds, 4 at 100 and below
//   height  the height of a row, the body divided by the rows
// The portrait is centred in its row. The steps of rowSteps keep it 24px or more shorter than
// the row, for every percent from 60 to 220.
export function rowLayout(percent) {
  const size = tidyScale('leadershipPortrait', percent);
  const step = rowSteps.find(each => size <= each.upTo);

  return { rows: step.rows, height: bodyHeight / step.rows };
}

// The shape and the frame to draw with, from the settings. A value that is not in the lists of
// config.js is the starting value, as it is in the settings the content reader returns.
export function portraitLook(settings) {
  const source = settings || {};

  return {
    shape: portraitShapes.includes(source.portraitShape) ? source.portraitShape : defaultSettings.portraitShape,
    frame: portraitFrames.includes(source.portraitFrame) ? source.portraitFrame : defaultSettings.portraitFrame,
  };
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
// that person.
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

// The shape of a portrait
//
// Square is the card as it has always been, with the cut corner of the frame. Rounded cuts
// all four corners, 24px deep on the screen, or a quarter of the card when the card is
// small. Circle is a circle. Each is drawn twice: as the outline of the frame, and as the
// clip of the picture.

function cutOf(card) {
  return Math.min(cornerCut, Math.round(card / 4));
}

function tidyNumber(number) {
  return Math.round(number * 100) / 100;
}

function pointsText(points) {
  return points.map(point => tidyNumber(point[0]) + ',' + tidyNumber(point[1])).join(' ');
}

// The corners of an outline in a square box, clockwise from the top left, margin in from the edge
function outlineOf(shape, box, margin, cut) {
  const near = margin;
  const far = box - margin;

  if (shape === 'rounded') {
    return [[near + cut, near], [far - cut, near], [far, near + cut], [far, far - cut], [far - cut, far], [near + cut, far], [near, far - cut], [near, near + cut]];
  }
  return [[near, near], [far, near], [far, box * (1 - cutDown)], [box * (1 - cutAcross), far], [near, far]];
}

// One shape of a frame: a circle, or a polygon of the corners
function shapeMarkup(shape, className, box, margin, cut) {
  if (shape === 'circle') {
    return `<circle class="${className}" cx="${box / 2}" cy="${box / 2}" r="${box / 2 - margin}"/>`;
  }
  return `<polygon class="${className}" points="${pointsText(outlineOf(shape, box, margin, cut))}"/>`;
}

// The five layers of a metal edge, as plate.js draws them
const edgeLayers = ['edge-shadow', 'edge-rim', 'edge-face', 'edge-shade', 'edge-ridge'];

// The metal frame. The card is drawn at 292 and the browser draws it smaller, which keeps the
// metal edge in proportion. The square shape is the card plate.js draws. The others are drawn
// here the same way, with a corner cut that comes to 24px on the screen.
function metalFrame(look, card) {
  if (look.shape === 'square') return cardMarkup(portraitSize, portraitSize);

  const cut = cutOf(card) * portraitSize / card;
  const layers = edgeLayers.map(layer => shapeMarkup(look.shape, layer, portraitSize, 2, cut)).join('');

  return `<svg class="card-outline thin" width="${portraitSize}" height="${portraitSize}" viewBox="0 0 ${portraitSize} ${portraitSize}">
          ${shapeMarkup(look.shape, 'card-fill', portraitSize, 2, cut)}${layers}
        </svg>`;
}

// The thin line frame, drawn at the size of the card so it is 3px wide whatever the size
function lineFrame(look, card) {
  return `<svg class="card-outline" width="${card}" height="${card}" viewBox="0 0 ${card} ${card}">
          ${shapeMarkup(look.shape, 'portrait-line', card, lineWidth / 2, cutOf(card))}
        </svg>`;
}

function roundedClip(cut) {
  const far = 'calc(100% - ' + cut + 'px)';
  return `polygon(${cut}px 0, ${far} 0, 100% ${cut}px, 100% ${far}, ${far} 100%, ${cut}px 100%, 0 ${far}, 0 ${cut}px)`;
}

// The clip of the picture, as two CSS values: the usual one, and the one for the team trim that
// cuts the other corner (trim.css). Nothing for a square with a metal edge, which base.css and
// trim.css have always drawn.
function clipsOf(look, size) {
  if (look.shape === 'circle') return ['circle(50%)', 'circle(50%)'];
  if (look.shape === 'rounded') {
    const clip = roundedClip(Math.max(cutOf(size.card) - 2 * size.inset, 0));
    return [clip, clip];
  }
  if (look.frame === 'metal') return null;

  const down = tidyNumber((1 - cutDown) * 100) + '%';
  const across = tidyNumber((1 - cutAcross) * 100) + '%';
  const flipped = tidyNumber(cutAcross * 100) + '%';
  return [`polygon(0 0, 100% 0, 100% ${down}, ${across} 100%, 0 100%)`, `polygon(100% 0, 0 0, 0 ${down}, ${flipped} 100%, 100% 100%)`];
}

// The framed picture. The sizes go to base.css as three variables on the portrait, and a shape or
// frame other than the usual ones adds a class and, for the clip, two more variables.
function portraitMarkup(size, address, metal, look) {
  const picture = address
    ? `<img src="${escapeHtml(address)}" width="${size.photo}" height="${size.photo}" alt="">`
    : silhouetteMarkup();
  const clips = clipsOf(look, size);
  const variables = `--portrait-card: ${size.card}px; --portrait-photo: ${size.photo}px; --portrait-inset: ${size.inset}px`
    + (clips ? `; --portrait-clip: ${clips[0]}; --portrait-clip-flipped: ${clips[1]}` : '');
  const className = ['portrait', look.shape === 'square' ? '' : 'shape-' + look.shape, look.frame === 'metal' ? '' : 'frame-' + look.frame]
    .filter(Boolean)
    .join(' ');
  const photo = `<div class="portrait-photo">${picture}</div>`;

  // The metal edge is under the picture, and the thin line is drawn over its edge
  let inside = metalFrame(look, size.card) + '\n        ' + photo;
  if (look.frame === 'line') inside = photo + '\n        ' + lineFrame(look, size.card);
  if (look.frame === 'none') inside = photo;

  return `<div${metalAttribute(className, metal)} style="${variables}">
        ${inside}
      </div>`;
}

// One slot: { name, role, address, metal, scale, look }. The whole slot turns over as
// one piece when the page changes. role and metal may be empty. scale is the Roster
// size setting, a percent, and no scale is 100. look is portraitLook(settings), and no
// look is the usual one.
export function slotMarkup(slot) {
  const look = slot.look || portraitLook();

  return `
    <div${metalAttribute('slot', slot.metal)} data-slat="item">
      ${portraitMarkup(portraitSizes(slot.scale, look.frame), slot.address, undefined, look)}
      <div class="slot-name">${escapeHtml(slot.name)}</div>
      <div class="slot-role">${escapeHtml(slot.role)}</div>
    </div>`;
}

// One row: { name, role, line, chip, address, metal }. The metal is the frame of the picture
// only. The name is the first line beside the picture, the role the second and line the third.
// The chip is at the right end. role, line and chip may be empty, and then they are not drawn.
function rowMarkup(row, size, look) {
  return `
    <div class="person-row" data-slat="item">
      ${portraitMarkup(size, row.address, row.metal, look)}
      <div class="person-text">
        <div class="person-name">${escapeHtml(row.name)}</div>
        <div class="person-role">${escapeHtml(row.role)}</div>
        <div class="person-line">${escapeHtml(row.line)}</div>
      </div>
      <div class="person-chip">${escapeHtml(row.chip)}</div>
    </div>`;
}

// A page of rows, at most rowLayout(percent).rows of them, one under the other. percent is
// the size setting of the panel, and no percent is 100. look is portraitLook(settings). Each
// row is a slat, so it turns over by itself when the page changes. The class rows-4, rows-3 and
// so on tells base.css how many rows are on the page, and above 100 percent the rows are taller
// (--row-height, read by base.css).
export function rowsMarkup(rows, percent, look = portraitLook()) {
  const size = rowSizes(percent, look.frame);
  const layout = rowLayout(percent);
  const lines = rows.map(row => rowMarkup(row, size, look));
  const height = layout.height === bodyHeight / rowsPerPage ? '' : ` style="--row-height: ${layout.height}px"`;

  return `<div class="person-rows rows-${layout.rows}"${height}>${lines.join('')}</div>`;
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
