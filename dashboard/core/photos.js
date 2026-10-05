// What the Photo panel shows and in what order. The photos are Photo documents
// in Studio (core/sanity.js turns them into content.photos), or the list in the
// sample content. Nothing here touches the page, so the tests can run it.

import { defaultSettings } from '../config.js';
import { visibleItems } from './content.js';

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
// no seconds of its own it follows Seconds per photo, in the Photos tab.
export function ownSeconds(step, settings) {
  if (Number(step.seconds) > 0) return Number(step.seconds);
  if (step.panel === 'photo') return Number(settings.photoSeconds) > 0 ? Number(settings.photoSeconds) : defaultSettings.photoSeconds;
  return 0;
}
