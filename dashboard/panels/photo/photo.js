// A picture at a time from the photos in Studio, in the order set in Dashboard
// Settings (Screen tab). Only photos that are switched on and have not expired
// are used. While one is up, the next is already downloading.

import { cardMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { preloadImages } from '../../core/images.js';
import { creditText, makePhotoQueue, photoLayout, photosToShow } from '../../core/photos.js';

const missingMarkup = '<div class="missing">[Photo not available]</div>';

// The queue remembers the last photo shown, from one turn of the panel to the next
const queue = makePhotoQueue();

export function hasContent(content) {
  return photosToShow(content).length > 0;
}

// The card cuts the photo to its own shape, so the hotspot decides what stays
// in view. A photo with no hotspot (the sample photos) is centred.
function pictureStyle(photo) {
  const focus = photo.focus;
  if (!focus || !isFinite(focus.x) || !isFinite(focus.y)) return '';
  return ` style="object-position: ${Number(focus.x)}% ${Number(focus.y)}%"`;
}

// The picture card and the caption each turn over on their own, so each is a slat.
export function mount(host, content) {
  const turn = queue.take(photosToShow(content), content.settings && content.settings.photoOrder);
  const photo = turn.photo;
  const picture = photo ? `<img src="${escapeHtml(photo.address)}"${pictureStyle(photo)} alt="">` : missingMarkup;
  const credit = photo ? creditText(photo) : '';
  const creditPlate = hasText(credit) ? `<div class="credit">Photo: ${escapeHtml(credit)}</div>` : '';
  const hasCaption = photo !== null && hasText(photo.caption);

  // The picture sits in a card, and where it goes and how big it is depends on the
  // Photo size setting and on whether there is a caption (see photoLayout)
  const layout = photoLayout(content.settings && content.settings.photoScale, hasCaption);
  const card = layout.card;
  const captionBox = layout.caption;
  const caption = hasCaption
    ? `<div class="caption" data-slat="item" style="left: ${captionBox.left}px; top: ${captionBox.top}px; width: ${captionBox.width}px">${escapeHtml(photo.caption)}</div>`
    : '';

  host.innerHTML = `
    <section class="page photo">
      <div class="header">
        <h2 class="title" data-slat="title">PHOTOS</h2>
        <div data-slat="tag">${doubleSlash()}</div>
      </div>

      <div class="card" data-slat="item" style="left: ${card.left}px; top: ${card.top}px; width: ${card.width}px; height: ${card.height}px">
        <div class="picture">${picture}</div>
        ${creditPlate}
        ${cardMarkup(card.width, card.height)}
      </div>
      ${caption}
    </section>`;

  const image = host.querySelector('.picture img');
  if (image) {
    image.addEventListener('error', () => {
      image.parentNode.innerHTML = missingMarkup;
    });
  }

  // Starts downloading the photo that comes next, so it is ready at the next page change
  if (turn.next && turn.next !== photo) preloadImages([turn.next.address]);
}
