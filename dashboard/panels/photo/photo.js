// A picture at a time from the photos in Studio, in the order set in Dashboard
// Settings (Screen tab). Only photos that are switched on and have not expired
// are used. While one is up, the next is already downloading.

import { cardMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { preloadImages } from '../../core/images.js';
import { creditText, hasRoomForCredit, makePhotoQueue, photoLayout, photosToShow, wholeShape } from '../../core/photos.js';

const missingMarkup = '<div class="missing">[Photo not available]</div>';

// The queue remembers the last photo shown, from one turn of the panel to the next
const queue = makePhotoQueue();

export function hasContent(content) {
  return photosToShow(content).length > 0;
}

// A card that is cut to its own shape keeps what the hotspot says. A photo with
// no hotspot (the sample photos) is centred. A photo shown whole is not cut, so
// it has no use for the hotspot.
function pictureStyle(photo, whole) {
  const focus = photo.focus;
  if (whole || !focus || !isFinite(focus.x) || !isFinite(focus.y)) return '';
  return ` style="object-position: ${Number(focus.x)}% ${Number(focus.y)}%"`;
}

// The picture card and the caption each turn over on their own, so each is a slat.
export function mount(host, content) {
  const turn = queue.take(photosToShow(content), content.settings && content.settings.photoOrder);
  const photo = turn.photo;
  const hasCaption = photo !== null && hasText(photo.caption);

  // The picture sits in a card, and where it goes and how big it is depends on the
  // Photo size setting, on whether there is a caption and on whether the photo is
  // shown whole, in the shape of the photo, or cut to the card (see photoLayout)
  const shape = wholeShape(photo, content.settings && content.settings.photoFit);
  const whole = shape !== null;
  const layout = photoLayout(content.settings && content.settings.photoScale, hasCaption, shape);
  const card = layout.card;
  const captionBox = layout.caption;

  const picture = photo ? `<img src="${escapeHtml(photo.address)}"${pictureStyle(photo, whole)} alt="">` : missingMarkup;
  const credit = photo ? creditText(photo) : '';
  const creditPlate = hasText(credit) && hasRoomForCredit(card.width) ? `<div class="credit">Photo: ${escapeHtml(credit)}</div>` : '';
  const caption = hasCaption
    ? `<div class="${whole ? 'caption centred' : 'caption'}" data-slat="item" style="left: ${captionBox.left}px; top: ${captionBox.top}px; width: ${captionBox.width}px">${escapeHtml(photo.caption)}</div>`
    : '';

  host.innerHTML = `
    <section class="page photo">
      <div class="header">
        <h2 class="title" data-slat="title">PHOTOS</h2>
        <div data-slat="tag">${doubleSlash()}</div>
      </div>

      <div class="${whole ? 'card whole' : 'card'}" data-slat="item" style="left: ${card.left}px; top: ${card.top}px; width: ${card.width}px; height: ${card.height}px">
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
