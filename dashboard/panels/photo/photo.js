// The photos from Studio, in the order set in Dashboard Settings (Screen tab). Only
// photos that are switched on and have not expired are used. A photo fills the whole
// body of the panel, and when the stay is long enough the panel shows several, one
// after another. core/photos.js says how many and for how long (turnPlan), and frame.css
// does the change from one to the next. The next turn's first photo is already
// downloading while this turn is up.

import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { preloadImages } from '../../core/images.js';
import { creditText, fitOf, makePhotoQueue, photoStay, photosToShow, turnPlan } from '../../core/photos.js';

const missingMarkup = '<div class="missing">[Photo not available]</div>';

// The queue remembers the last photo shown, from one turn of the panel to the next
const queue = makePhotoQueue();

export function hasContent(content) {
  return photosToShow(content).length > 0;
}

// A photo that is cut to the panel keeps what the hotspot says. A photo with no
// hotspot (the sample photos) is centred. A photo shown whole is not cut, so it has
// no use for the hotspot.
function pictureStyle(photo, fit) {
  const focus = photo.focus;
  if (fit === 'whole' || !focus || !isFinite(focus.x) || !isFinite(focus.y)) return '';
  return ` style="object-position: ${Number(focus.x)}% ${Number(focus.y)}%"`;
}

// The caption and the credit on one plate. Neither: no plate.
function noteMarkup(photo) {
  const caption = hasText(photo.caption) ? `<div class="caption">${escapeHtml(photo.caption)}</div>` : '';
  const credit = creditText(photo);
  const byline = hasText(credit) ? `<div class="credit">Photo: ${escapeHtml(credit)}</div>` : '';

  return caption || byline ? `<div class="note">${caption}${byline}</div>` : '';
}

// One photo of the turn. The photos lie on top of each other, the first at the bottom,
// and --shot says which one this is, so frame.css knows when it comes in.
function shotMarkup(photo, shot, settingFit) {
  const fit = fitOf(photo, settingFit);

  return `<figure class="shot" data-fit="${fit}" style="--shot: ${shot}">
        <img src="${escapeHtml(photo.address)}"${pictureStyle(photo, fit)} alt="">
        ${noteMarkup(photo)}
      </figure>`;
}

// A photo that cannot be loaded is taken out, and the ones after it move up a place.
// If none is left the panel says so.
function skipShot(shot) {
  const body = shot.parentNode;
  shot.remove();

  const left = body.querySelectorAll('.shot');
  left.forEach((item, place) => item.style.setProperty('--shot', place));
  if (left.length === 0) body.innerHTML = missingMarkup;
}

// The body is one slat, and the photos inside it come and go on their own
export function mount(host, content) {
  const settings = content.settings || {};
  const plan = turnPlan(photosToShow(content).length, photoStay(settings));
  const turn = queue.takeTurn(photosToShow(content), settings.photoOrder, plan.photos);
  const shots = turn.photos.map((photo, shot) => shotMarkup(photo, shot, settings.photoFit)).join('');
  const hold = Math.round(plan.hold * 100) / 100;

  host.innerHTML = `
    <section class="page photo">
      <div class="header">
        <h2 class="title" data-slat="title">PHOTOS</h2>
        <div data-slat="tag">${doubleSlash()}</div>
      </div>

      <div class="photo-body" data-slat="item" style="--hold: ${hold}s">
      ${shots || missingMarkup}
      </div>
    </section>`;

  host.querySelectorAll('.shot img').forEach(image => {
    image.addEventListener('error', () => skipShot(image.closest('.shot')));
  });

  // Starts downloading the photo that opens the next turn, so it is ready at the next page change
  if (turn.next && !turn.photos.includes(turn.next)) preloadImages([turn.next.address]);
}
