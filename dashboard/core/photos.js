// What the Photo panel shows and in what order. The photos are Photo documents
// in Studio (core/sanity.js turns them into content.photos), or the list in the
// sample content. Nothing here touches the page, so the tests can run it.

import { defaultSettings, photoFits } from '../config.js';
import { tidyScale, visibleItems } from './content.js';

// Photos that are switched on, have not expired and have a picture to show
export function photosToShow(content, now = new Date()) {
  const photos = Array.isArray(content.photos) ? content.photos : [];
  return visibleItems(photos.filter(photo => photo && typeof photo.address === 'string' && photo.address !== ''), now);
}

// Sanity has no address for a sample photo, so its picture's address is its key
export function photoKey(photo) {
  return photo.id || photo.address;
}

// Newest photo first. A photo with no creation time (the sample photos) comes
// after the ones that have one, in the order it was in. The position breaks a
// tie so the order never depends on how the browser sorts.
export function newestFirst(list) {
  return list
    .map((photo, position) => ({ photo: photo, position: position, time: Date.parse(photo.createdAt) }))
    .sort((a, b) => {
      const aHasTime = isFinite(a.time);
      const bHasTime = isFinite(b.time);
      if (aHasTime && bHasTime && a.time !== b.time) return b.time - a.time;
      if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
      return a.position - b.position;
    })
    .map(entry => entry.photo);
}

// Where the Photo panel puts its picture card and the caption under it, in
// pixels of the large panel (1152 wide). These are the sizes at 100 percent. The
// card is 1096 wide, and 464 high with a caption under it or 514 without one.
// With a caption, the card, a gap of 16 and the caption (64 high) are 544 tall
// together, and they sit 142 from the top. The panel's header is above that, and
// the frame's cut corner is below and to the right.
const panelWidth = 1152;
const fullCard = { width: 1096, heightWithCaption: 464, heightWithoutCaption: 514 };
const boxTop = 142;
const captionGap = 16;
const captionHeight = 64;
const captionIndent = 24; // from the left edge of the card to the left edge of the caption
const captionRight = 1056; // where the caption stops, clear of the frame's cut corner
const smallestSide = 240; // the shortest side of a card that has the shape of its photo, at 100 percent
const narrowestCreditCard = 370; // a card narrower than this has no credit plate (see hasRoomForCredit)

// The Photo size setting makes the card smaller in proportion, and it stays in
// the middle of the panel. percent is the setting. Gives
//   card     { left, top, width, height }, to place the card and draw its edge
//   caption  { left, top, width }, directly under the card
// The caption's text size and height never change. It starts 24 in from the left
// edge of the card, as it does at full size, and it always stops at x = 1056, so
// it reaches the right of a smaller card, and a longer caption is not cut short.
// The card and the caption are centred together, in the same space they use at
// 100 percent, so at 100 nothing moves.
//
// shape is { width, height }, for a photo that is shown whole (wholeShape gives
// it). The card then takes the shape of the photo: as big as fits inside the
// card above, and made smaller by the Photo size setting in the same way. An
// extremely wide or tall photo gets a card whose short side is smallestSide at
// 100 percent, and the picture sits in the middle of it with the card colour
// beside or above and below. The caption is centred under the card (centredCaption).
export function photoLayout(percent, hasCaption, shape) {
  const factor = tidyScale('photoScale', percent) / 100;
  const fullHeight = hasCaption ? fullCard.heightWithCaption : fullCard.heightWithoutCaption;
  const whole = usableShape(shape);
  const full = whole ? wholeCard(whole, fullHeight) : { width: fullCard.width, height: fullHeight };
  const width = Math.round(full.width * factor);
  const height = Math.round(full.height * factor);

  const spaceHeight = fullHeight + (hasCaption ? captionGap + captionHeight : 0);
  const usedHeight = height + (hasCaption ? captionGap + captionHeight : 0);
  const left = Math.round((panelWidth - width) / 2);
  const top = boxTop + Math.round((spaceHeight - usedHeight) / 2);

  const card = { left: left, top: top, width: width, height: height };
  const captionTop = top + height + captionGap;
  if (whole) return { card: card, caption: centredCaption(card, captionTop) };

  const captionLeft = left + captionIndent;
  return {
    card: card,
    caption: { left: captionLeft, top: captionTop, width: captionRight - captionLeft },
  };
}

function isSize(number) {
  return typeof number === 'number' && isFinite(number) && number > 0;
}

function usableShape(shape) {
  return shape && isSize(shape.width) && isSize(shape.height) ? { width: shape.width, height: shape.height } : null;
}

// The card of a photo of this shape at 100 percent, before rounding. The
// biggest card of that shape inside fullCard.width by boxHeight, except that
// the shape is held between the narrowest and the widest that leave
// smallestSide for the short side.
function wholeCard(shape, boxHeight) {
  const narrowest = smallestSide / boxHeight;
  const widest = fullCard.width / smallestSide;
  const aspect = Math.min(widest, Math.max(narrowest, shape.width / shape.height));

  if (aspect * boxHeight <= fullCard.width) return { width: aspect * boxHeight, height: boxHeight };
  return { width: fullCard.width, height: fullCard.width / aspect };
}

// A card with the shape of its photo can be narrow, and a caption that began at
// its left edge would have no room. The caption is centred under the card
// instead, in the widest box that stops at captionRight and starts no further
// left than the caption does at full size. The panel centres the text in it.
function centredCaption(card, top) {
  const middle = card.left + card.width / 2;
  const half = Math.min(middle - ((panelWidth - fullCard.width) / 2 + captionIndent), captionRight - middle);
  return { left: Math.round(middle - half), top: top, width: Math.round(2 * half) };
}

// The fit a photo is drawn with: its own when it is fill or whole, otherwise the
// Photo fit setting, and the starting value when that is not a fit either.
export function fitOf(photo, settingFit) {
  if (photo && photoFits.includes(photo.fit)) return photo.fit;
  return photoFits.includes(settingFit) ? settingFit : defaultSettings.photoFit;
}

// The shape to give photoLayout for a photo that is shown whole, and null for
// one that is cut to the card. A photo with no size we can use is cut whatever
// its fit says, because a card cannot take the shape of nothing (the size is
// the part the editor kept, from keptSize in images.js).
export function wholeShape(photo, settingFit) {
  if (fitOf(photo, settingFit) !== 'whole') return null;
  return photo ? usableShape(photo.size) : null;
}

// The credit plate sits on the lower left of the picture, clear of the cut
// corner: at most the width of the card less 88px, with 48px of padding inside
// it. At 44px and the weight the plate uses (500), "Photo: Sam" is 227px wide
// (read from the font's tables, and "Photo: " alone is 139px), so a plate that
// holds it needs a card 363px wide. 370 leaves a few pixels over. On a narrower
// card the plate would show the first letters of the name and three dots, or
// only the dots, so it is left out. On a card up to about 600px a long name is
// cut with three dots. Only a photo shown whole has a card that narrow, since a
// card cut to the fixed shape is at least 658px wide.
export function hasRoomForCredit(cardWidth) {
  return cardWidth >= narrowestCreditCard;
}

// The credit is a first name. Studio refuses a space, but a credit that got in
// another way is cut at its first word, so a last name never reaches the screen.
export function creditText(photo) {
  const words = String(photo.credit || '').trim().split(/\s+/);
  return words[0];
}

// Chooses the photo for each turn of the panel, and the one after it, so the
// panel can start loading that one while this one is up.
//   random        a photo that is not the one just shown (unless it is the only one)
//   newest-first  the photo after the one just shown, from the newest to the
//                 oldest, and the newest again after the oldest
// The photo chosen as "next" is the photo shown the next time, if it is still
// in the list then and the order setting has not changed. random is a function
// that gives a number from 0 up to but not including 1, so a test can pick the numbers.
export function makePhotoQueue(random = Math.random) {
  let shownKey = null;
  let upcomingKey = null;
  let upcomingOrder = null;

  function chooseAfter(list, order, afterKey) {
    if (list.length === 1) return list[0];

    if (order === 'newest-first') {
      // a photo that is not in the list gives -1, so the walk starts at the newest
      const position = list.findIndex(photo => photoKey(photo) === afterKey);
      return list[(position + 1) % list.length];
    }

    const others = list.filter(photo => photoKey(photo) !== afterKey);
    const choices = others.length > 0 ? others : list;
    return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  }

  return {
    // list is photosToShow(). Gives { photo, next }, or both null with no photos.
    take(list, order) {
      if (list.length === 0) {
        shownKey = null;
        upcomingKey = null;
        return { photo: null, next: null };
      }

      const ordered = order === 'newest-first' ? newestFirst(list) : list;

      let photo = null;
      if (upcomingKey !== null && upcomingOrder === order) {
        photo = ordered.find(item => photoKey(item) === upcomingKey) || null;
      }
      // a list that grew from one photo to more must not show the same photo twice
      if (photo && ordered.length > 1 && photoKey(photo) === shownKey) photo = null;
      if (!photo) photo = chooseAfter(ordered, order, shownKey);

      const next = chooseAfter(ordered, order, photoKey(photo));
      shownKey = photoKey(photo);
      upcomingKey = photoKey(next);
      upcomingOrder = order;
      return { photo: photo, next: next };
    },
  };
}

// The seconds a row of the Panels list has of its own, or 0 when it has none and
// the board's Seconds per page rules. The Photo panel is the exception: with
// no seconds of its own it follows Seconds per photo, in the Screen tab.
export function ownSeconds(step, settings) {
  if (Number(step.seconds) > 0) return Number(step.seconds);
  if (step.panel === 'photo') return Number(settings.photoSeconds) > 0 ? Number(settings.photoSeconds) : defaultSettings.photoSeconds;
  return 0;
}
