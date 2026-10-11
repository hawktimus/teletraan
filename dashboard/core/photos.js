// What the Photo panel shows and in what order. The photos are Photo documents
// in Studio (core/sanity.js turns them into content.photos), or the list in the
// sample content. Nothing here touches the page, so the tests can run it.

import { defaultSettings, photoFits, speeds } from '../config.js';
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

// The fit a photo is drawn with: its own when it is fill or whole, otherwise the
// Photo fit setting, and the starting value when that is not a fit either.
export function fitOf(photo, settingFit) {
  if (photo && photoFits.includes(photo.fit)) return photo.fit;
  return photoFits.includes(settingFit) ? settingFit : defaultSettings.photoFit;
}

// The credit is a first name. Studio refuses a space, but a credit that got in
// another way is cut at its first word, so a last name never reaches the screen.
export function creditText(photo) {
  const words = String(photo.credit || '').trim().split(/\s+/);
  return words[0];
}

// Chooses the photos for each turn of the panel, and the one after them, so the
// panel can start loading that one while this turn is up.
//   random        the photos are dealt like cards: each one comes once before any comes
//                 again, and the first of a new round is never the last of the old one
//   newest-first  the photo after the one just shown, from the newest to the
//                 oldest, and the newest again after the oldest
// The photo chosen as "next" is the photo shown the next time, if it is still
// in the list then and the order setting has not changed. random is a function
// that gives a number from 0 up to but not including 1, so a test can pick the numbers.
export function makePhotoQueue(random = Math.random) {
  let shownKey = null;
  let upcomingKey = null;
  let upcomingOrder = null;
  let deck = []; // the keys not yet dealt in this round of random order

  // A random card that is not the one shown last and not one to leave out, and when
  // none is left, the start of a new round with every photo in it
  function deal(list, afterKey, leaveOut) {
    deck = deck.filter(key => list.some(photo => photoKey(photo) === key));
    const usable = () => deck.filter(key => key !== afterKey && !leaveOut.includes(key));

    let choices = usable();
    if (choices.length === 0) {
      deck = list.map(photoKey);
      choices = usable();
      if (choices.length === 0) choices = deck.filter(key => key !== afterKey);
    }

    const key = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
    deck.splice(deck.indexOf(key), 1);
    return list.find(photo => photoKey(photo) === key);
  }

  // leaveOut is the keys of the photos already in this turn. They are skipped
  // in random order, as long as there is any other photo to deal.
  function chooseAfter(list, order, afterKey, leaveOut) {
    if (list.length === 1) return list[0];

    if (order === 'newest-first') {
      // a photo that is not in the list gives -1, so the walk starts at the newest
      const position = list.findIndex(photo => photoKey(photo) === afterKey);
      return list[(position + 1) % list.length];
    }

    return deal(list, afterKey, leaveOut);
  }

  function take(list, order, leaveOut = []) {
    if (list.length === 0) {
      shownKey = null;
      upcomingKey = null;
      deck = [];
      return { photo: null, next: null };
    }

    const ordered = order === 'newest-first' ? newestFirst(list) : list;

    let photo = null;
    if (upcomingKey !== null && upcomingOrder === order) {
      photo = ordered.find(item => photoKey(item) === upcomingKey) || null;
    }
    // a list that grew from one photo to more must not show the same photo twice
    if (photo && ordered.length > 1 && photoKey(photo) === shownKey) photo = null;
    if (!photo) photo = chooseAfter(ordered, order, shownKey, leaveOut);

    const next = chooseAfter(ordered, order, photoKey(photo), leaveOut.concat(photoKey(photo)));
    shownKey = photoKey(photo);
    upcomingKey = photoKey(next);
    upcomingOrder = order;
    return { photo: photo, next: next };
  }

  return {
    // list is photosToShow(). Gives { photo, next }, or both null with no photos.
    take: take,

    // The photos of one turn of the panel, count of them one after another with no
    // photo twice (count is not more than the list, see turnPlan), and the photo that
    // comes first in the turn after. A list with no photos gives no photos and no next.
    takeTurn(list, order, count) {
      const photos = [];
      let next = null;

      for (let index = 0; index < count; index++) {
        const turn = take(list, order, photos.map(photoKey));
        if (turn.photo === null) break;
        photos.push(turn.photo);
        next = turn.next;
      }
      return { photos: photos, next: next };
    },
  };
}

// A photo stays up at least this many seconds
export const shortestHold = 8;

// How one turn of the panel is shared out: how many photos it shows and how many
// seconds each stays up. The seconds are the stay of the panel, shared evenly, with
// no photo up for less than shortestHold. When the photos are too many for that,
// the turn shows as many as fit, and the rest come in the turns after it (the queue
// carries on from the last photo shown). A stay shorter than shortestHold shows one
// photo for all of it.
export function turnPlan(photoCount, seconds) {
  if (!(photoCount > 0)) return { photos: 0, hold: seconds };

  const photos = Math.max(1, Math.min(photoCount, Math.floor(seconds / shortestHold)));
  return { photos: photos, hold: seconds / photos };
}

// The seconds a row of the Panels list has of its own, or 0 when it has none and
// the board's Seconds per page rules. The Photo panel is the exception: with
// no seconds of its own it follows Seconds per photo, in the Screen tab.
export function ownSeconds(step, settings) {
  if (Number(step.seconds) > 0) return Number(step.seconds);
  if (step.panel === 'photo') return Number(settings.photoSeconds) > 0 ? Number(settings.photoSeconds) : defaultSettings.photoSeconds;
  return 0;
}

// How long the Photo panel stays up each time it comes round, in seconds, with the
// Speed setting applied as the schedule applies it (core/schedule.js). The panel
// shares this out between its photos (turnPlan). Its row in Panel order is found in
// the order, or in the older list of large panels while the order is empty.
export function photoStay(settings) {
  const source = settings || {};
  const rotation = source.rotation || {};
  const rows = Array.isArray(rotation.order) && rotation.order.length > 0 ? rotation.order : rotation.grid1;
  const row = (Array.isArray(rows) ? rows : []).find(step => step && step.panel === 'photo');

  return ownSeconds(row || { panel: 'photo' }, source) * (speeds[source.speed] || speeds.normal);
}
