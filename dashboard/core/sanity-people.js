// People, subteams, photos, talks and calendar filters (part of sanity.js).

import { defaultFilter, defaultPerson, defaultTalk, filterActions, limits, photoFits, talkStatuses } from '../config.js';
import { keepInRange } from './content.js';
import { keptSize, photoFocus, screenPhotoUrl, tidyPhoto } from './images.js';
import { trimText } from './text.js';
import { cleanObject, objectsIn, plainDate } from './sanity-tasks.js';

// A person with no photo, or one that cannot be used, has no photo at all.
// A missing "Show photo on screen" takes the default from config.js.
export function normalizePerson(raw) {
  const person = Object.assign({}, defaultPerson, raw);
  if (typeof person.showPhoto !== 'boolean') person.showPhoto = defaultPerson.showPhoto;
  if (typeof person.title === 'string' && person.title.trim() !== '') person.title = person.title.trim();
  else delete person.title;

  const photo = tidyPhoto(person.photo);
  if (photo) person.photo = photo;
  else delete person.photo;
  return person;
}

// The most members a subteam shows. Two pages of the roster panel hold 24.
// The Members field in studio/schemas/subteam.js has the same limit.
const maxMembers = 24;

// A subteam always has members: a list of first names, possibly empty. Only
// text is kept, without the spaces at the ends. A name that is empty, or the
// same as an earlier one apart from capital letters, is dropped, and so is
// every name after the 24th. The order the editors gave is kept.
// The photo of the lead is tidied like the photo of a person: none at all when it
// cannot be used, and a missing "Show photo on screen" takes the default.
export function normalizeSubteam(raw) {
  const subteam = Object.assign({}, raw);
  const names = Array.isArray(raw.members) ? raw.members : [];
  const seen = [];

  if (typeof subteam.showPhoto !== 'boolean') subteam.showPhoto = defaultPerson.showPhoto;
  const photo = tidyPhoto(subteam.photo);
  if (photo) subteam.photo = photo;
  else delete subteam.photo;

  subteam.members = [];
  names.forEach(name => {
    if (typeof name !== 'string') return;

    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (trimmed === '' || seen.indexOf(key) !== -1 || subteam.members.length >= maxMembers) return;

    seen.push(key);
    subteam.members.push(trimmed);
  });
  return subteam;
}

// A photo from Studio becomes { id, address, focus, size, caption, credit, fit,
// createdAt, show, expires }. The address is the one the screen asks for
// (images.js), focus is where the hotspot is in it and size is the part the
// editor kept, in pixels. fit is there only when the photo picked fill or
// whole: any other value, and none, mean it follows the Photo fit setting. A
// photo with no picture that can be used is dropped, since there is nothing to
// show. The sample photos are already like this, with an address and no more
// than a caption, a credit, a fit and a size.
function normalizePhoto(raw) {
  const picture = tidyPhoto(raw.image);
  if (!picture) return null;

  const photo = cleanObject({
    id: raw.id,
    createdAt: raw.createdAt,
    caption: raw.caption,
    credit: raw.credit,
    fit: photoFits.includes(raw.fit) ? raw.fit : undefined,
    show: raw.show,
    expires: raw.expires,
  });
  photo.address = screenPhotoUrl(picture);
  photo.focus = photoFocus(picture);
  const size = keptSize(picture);
  if (size) photo.size = size;
  return photo;
}

export function photosFrom(list) {
  return objectsIn(list).map(normalizePhoto).filter(photo => photo !== null);
}

// The same pattern as the Slides link field in studio/schemas/presentation.js
const deckLinkPattern = /^https:\/\/docs\.google\.com\/presentation\/d\/[A-Za-z0-9_-]+/;

// A talk from Studio becomes { id, name, subteam, topic, start, minutes, deckLink,
// status }. The name, subteam and title lose the spaces at their ends. The subteam
// is left out when it is empty, and so is a link that is not a Google Slides link
// (the link is checked as it is typed, with no trimming). start is a Date and
// minutes is 5 to 30, 15 when it cannot be used. A status that is not one of the
// four is scheduled. A talk is for the team in its team field, and for both when there is
// none. A talk with no id or no start that can be read is dropped, since nothing could find
// it or say when it runs. A talk that is cancelled, done or skipped stays, and
// core/presentation.js leaves it out.
function normalizeTalk(raw) {
  const start = typeof raw.start === 'string' ? new Date(raw.start) : null;
  if (typeof raw.id !== 'string' || raw.id === '' || !start || isNaN(start.getTime())) return null;

  const talk = { id: raw.id, name: trimText(raw.name) };
  const subteam = trimText(raw.subteam);
  if (subteam !== '') talk.subteam = subteam;

  talk.topic = trimText(raw.topic);
  talk.start = start;
  talk.minutes = keepInRange(raw.minutes, limits.talkMinutes, defaultTalk.minutes);

  if (typeof raw.deckLink === 'string' && deckLinkPattern.test(raw.deckLink)) talk.deckLink = raw.deckLink;

  talk.status = talkStatuses.includes(raw.status) ? raw.status : defaultTalk.status;

  const team = trimText(raw.team).toLowerCase();
  if (team !== '') talk.team = team;
  return talk;
}

export function presentationsFrom(list) {
  return objectsIn(list).map(normalizeTalk).filter(talk => talk !== null);
}


// A rule from the Calendar filters list becomes { name, action, words, days,
// calendar, fromDate, toDate }, with the show switch and the Hide after time kept
// as they are, and force kept when it is on (an Always show rule pins its events
// to page one of the Events panel). The words lose the spaces at their ends and
// the empty ones go.
// The days are a set of the numbers 0 to 6, Sunday first, in order. The calendar
// and the two dates are text, empty when there is none, and a date that is not
// like 2027-04-02 is none. An action that is not hide or show is hide, as the
// Studio field starts on Hide. A rule with no condition left would match every
// event, so it is dropped. A rule that is off or expired stays, and
// core/events.js leaves it out.
function normalizeFilter(raw) {
  const words = (Array.isArray(raw.words) ? raw.words : [])
    .filter(word => typeof word === 'string' && word.trim() !== '')
    .map(word => word.trim());
  const days = (Array.isArray(raw.days) ? raw.days : [])
    .filter((day, index, list) => Number.isInteger(day) && day >= 0 && day <= 6 && list.indexOf(day) === index)
    .sort((first, second) => first - second);

  const rule = {
    name: trimText(raw.name),
    action: filterActions.includes(raw.action) ? raw.action : defaultFilter.action,
    words: words,
    days: days,
    calendar: trimText(raw.calendar),
    fromDate: plainDate.test(raw.fromDate) ? raw.fromDate : '',
    toDate: plainDate.test(raw.toDate) ? raw.toDate : '',
  };
  if (raw.show === false) rule.show = false;
  if (raw.expires) rule.expires = raw.expires;
  if (raw.force === true) rule.force = true;

  const hasCondition = words.length > 0 || days.length > 0 || rule.calendar !== '' || rule.fromDate !== '' || rule.toDate !== '';
  return hasCondition ? rule : null;
}

export function filtersFrom(list) {
  return objectsIn(list).map(normalizeFilter).filter(rule => rule !== null);
}
