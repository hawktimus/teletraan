// A picture at a time from the photo list, and the next one each time the
// panel comes round.

import { plateMarkup, scanMarkup, boltMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { makeTurns } from '../../core/turns.js';

const missingMarkup = '<div class="missing">[Photo not available]</div>';

const nextPhoto = makeTurns();

// The picture is set into a sunk window with a bolt in each corner. It is
// drawn over the picture, and not inside it, so it stays when a picture
// cannot be loaded. The light line is just below the picture.
const windowMarkup = `
  <svg class="window" width="1120" height="480" viewBox="0 0 1120 480">
    <line class="pocket-lit" x1="0" y1="474" x2="1120" y2="474"/>
    <rect class="pocket" x="2" y="2" width="1116" height="468"/>
    ${boltMarkup(22, 22, 28)}
    ${boltMarkup(1098, 22, 28)}
    ${boltMarkup(22, 450, 28)}
    ${boltMarkup(1098, 450, 28)}
  </svg>`;

// The caption sits in a sunk slot. Its right end is cut at the same angle as
// the corner of the plate and stays 8px clear of it.
const captionSlot = `
  <svg class="caption-slot" width="1120" height="80" viewBox="0 0 1120 80">
    <polygon class="pocket-lit" points="2,6 1112,6 1112,21 1045,74 2,74"/>
    <polygon class="pocket" points="2,4 1112,4 1112,19 1045,72 2,72"/>
  </svg>`;

function usablePhotos(content) {
  const photos = Array.isArray(content.photos) ? content.photos : [];
  return photos.filter(photo => photo && hasText(photo.address));
}

export function hasContent(content) {
  return usablePhotos(content).length > 0;
}

export function mount(host, content) {
  const photo = nextPhoto(usablePhotos(content));
  const picture = photo ? `<img src="${escapeHtml(photo.address)}" alt="">` : missingMarkup;

  host.innerHTML = `
    <section class="panel photo" data-sequence="grid1">
      ${plateMarkup('grid1')}
      ${scanMarkup('grid1')}

      <div class="header">
        <h2 class="title" data-part="title">PHOTOS</h2>
        <div data-part="tag">${doubleSlash()}</div>
      </div>

      <div class="picture" data-part="content">${picture}</div>
      <div class="picture-window" data-part="content">${windowMarkup}</div>
      <div class="caption-slot-box" data-part="content">${captionSlot}</div>
      <div class="caption" data-part="content">${escapeHtml(photo && photo.caption)}</div>
    </section>`;

  const image = host.querySelector('.picture img');
  if (image) {
    image.addEventListener('error', () => {
      image.parentNode.innerHTML = missingMarkup;
    });
  }
}
