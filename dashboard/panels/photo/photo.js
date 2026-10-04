// A picture at a time from the photo list, a random one each time the panel
// comes round.

import { cardMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';

const missingMarkup = '<div class="missing">[Photo not available]</div>';

let lastIndex = -1;

// Never the same picture twice in a row, unless there is only one
function pickPhoto(list) {
  if (list.length === 0) return null;

  let index = Math.floor(Math.random() * list.length);
  if (list.length > 1 && index === lastIndex) index = (index + 1) % list.length;
  lastIndex = index;
  return list[index];
}

// The picture sits in a card 1096px wide. With a caption under it the card is
// shorter. With no caption it is as tall as the cut corner of the frame
// allows. Both heights are used for the card's outline and for its box.
const CARD_WIDTH = 1096;
const CARD_HEIGHT_WITH_CAPTION = 464;
const CARD_HEIGHT_NO_CAPTION = 514;

function usablePhotos(content) {
  const photos = Array.isArray(content.photos) ? content.photos : [];
  return photos.filter(photo => photo && hasText(photo.address));
}

export function hasContent(content) {
  return usablePhotos(content).length > 0;
}

// The picture card and the caption each turn over on their own, so each is a slat.
export function mount(host, content) {
  const photo = pickPhoto(usablePhotos(content));
  const picture = photo ? `<img src="${escapeHtml(photo.address)}" alt="">` : missingMarkup;
  const hasCaption = photo !== null && hasText(photo.caption);
  const cardHeight = hasCaption ? CARD_HEIGHT_WITH_CAPTION : CARD_HEIGHT_NO_CAPTION;
  const caption = hasCaption ? `<div class="caption" data-slat="item">${escapeHtml(photo.caption)}</div>` : '';

  host.innerHTML = `
    <section class="page photo">
      <div class="header">
        <h2 class="title" data-slat="title">PHOTOS</h2>
        <div data-slat="tag">${doubleSlash()}</div>
      </div>

      <div class="card" data-slat="item" style="width: ${CARD_WIDTH}px; height: ${cardHeight}px">
        <div class="picture">${picture}</div>
        ${cardMarkup(CARD_WIDTH, cardHeight)}
      </div>
      ${caption}
    </section>`;

  const image = host.querySelector('.picture img');
  if (image) {
    image.addEventListener('error', () => {
      image.parentNode.innerHTML = missingMarkup;
    });
  }
}
