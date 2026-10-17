// The parts of the Today page that need no Studio (today-view.js draws them): the words of the sections, the
// announcement documents turned into cards, and the full screen messages turned into rows and back. The page
// puts on the screen only what is stored: it renames and changes nothing. tests/studio-today.test.mjs reads this with node.

import { standing } from '../schemas/announcement.js';

// One plain sentence for each section: what it looks like on the TV
export const sections = {
  alert: {
    title: 'Alert',
    says: 'A message that covers the whole screen, over everything else, until you turn it off or its time comes.',
  },
  plate: {
    title: 'Announcements on the bar',
    says: 'One line on a bar under the banner, and two live ones take turns every 12 seconds.',
  },
  timed: {
    title: 'Full screen messages at set times',
    says: 'A card that covers the whole screen at a time of day, with a first line and a second line a few seconds later.',
  },
  links: {
    title: 'The rest of today',
    says: 'The agenda, the booked talks and the meeting days, where a booked talk takes the whole screen at its start time.',
  },
};

export const words = {
  reading: 'Reading the messages.',
  noPlate: 'No announcement on the bar. Click New announcement to add one.',
  noTimed: 'No full screen message is set. Click New message to add one.',
  noSettings: 'Dashboard Settings has not been published yet, so the alert and the full screen messages cannot be shown. Open it, click Publish once, and come back.',
  newPlate: 'New announcement',
  newTimed: 'New message',
  removeTimed: 'Remove this message',
  openForm: 'Open in the full form',
  pastTitle: 'Past announcements',
  noTeam: 'Both teams',
  teamLabel: 'Team',
  daysLabel: 'Days',
  daysHelp: 'Tick every day of the week it should play.',
  tickADay: 'Tick at least one day.',
  missing: 'That announcement could not be found. Reload the page.',
  textFirst: 'Write the text first. An announcement with no text is not published.',
};

// The link of a card opens its announcement in the full form: this prefix, then the id (structure.js, todayChildren)
export const announcementChildPrefix = 'announcement-';

export const links = [
  { id: 'agenda', label: 'Agenda items', says: 'The plan for the day, headed AGENDA on the screen.' },
  { id: 'presentations', label: 'Presentations', says: 'Booked talks: upcoming and past.' },
  { id: 'meetingDays', label: 'Meeting days', says: 'The days talks are given, and the order of the first talk.' },
];

// The id a draft and its published document share
export function baseId(id) {
  return String(id).replace(/^drafts\./, '');
}

export function teamOf(doc) {
  return doc && doc.team && typeof doc.team._ref === 'string' ? doc.team._ref : '';
}

// The announcement documents found (drafts and published, raw), one card for each, the draft winning. Live and
// coming ones first, soonest first, then the past ones, newest first.
export function cardsFrom(documents, now = Date.now()) {
  const found = (Array.isArray(documents) ? documents : []).filter(doc => doc && doc._type === 'announcement' && typeof doc._id === 'string');
  const ids = [];
  found.forEach(doc => {
    if (ids.indexOf(baseId(doc._id)) === -1) ids.push(baseId(doc._id));
  });

  const cards = ids.map(id => {
    const draft = found.filter(doc => doc._id === 'drafts.' + id)[0];
    const doc = draft || found.filter(doc2 => doc2._id === id)[0];
    return {
      id: id,
      isDraft: Boolean(draft),
      isNew: Boolean(draft) && !found.some(doc2 => doc2._id === id),
      text: doc.text || '',
      start: doc.start || '',
      end: doc.end || '',
      team: teamOf(doc),
      level: doc.level || 'notice',
      standing: standing(doc.start, doc.end, now) || (doc.text ? '' : 'draft'),
      document: doc,
    };
  });

  const past = card => card.standing === 'past';
  const byStart = (a, b) => Date.parse(a.start || 0) - Date.parse(b.start || 0);
  return {
    current: cards.filter(card => !past(card)).sort(byStart),
    past: cards.filter(past).sort((a, b) => byStart(b, a)),
  };
}

// The end of the day of the time given, in the local time of the computer, as ISO text
export function endOfDay(now = Date.now()) {
  const date = new Date(now);
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
}

// A new announcement: it starts now and ends at the end of the day. It is a draft, and it is not published until
// it has text and Publish all is clicked.
export function newAnnouncementFields(now = Date.now(), id = 'announcement-' + now.toString(36) + Math.random().toString(36).slice(2, 6)) {
  return {
    _id: 'drafts.' + id,
    _type: 'announcement',
    text: '',
    start: new Date(now).toISOString(),
    end: endOfDay(now),
    level: 'notice',
  };
}

// The documents found after one announcement was changed in its draft: the draft is made from the published
// document when there is none, and the fields are set on it
export function applyToDocuments(documents, id, fields, unset) {
  const found = Array.isArray(documents) ? documents : [];
  const draft = found.filter(doc => doc && doc._id === 'drafts.' + id)[0];
  const published = found.filter(doc => doc && doc._id === id)[0];
  const next = Object.assign({}, draft || published || { _type: 'announcement' }, { _id: 'drafts.' + id }, fields);
  (unset || []).forEach(name => delete next[name]);
  return found.filter(doc => !doc || doc._id !== 'drafts.' + id).concat([next]);
}

// The full screen messages of Dashboard Settings, as a list of rows. Nothing stored gives none.
export function timedRowsFrom(settings) {
  return settings && Array.isArray(settings.announcements) ? settings.announcements : [];
}

export const everyDay = [0, 1, 2, 3, 4, 5, 6];

export const weekdays = [
  { title: 'Sunday', short: 'Sun', value: 0 },
  { title: 'Monday', short: 'Mon', value: 1 },
  { title: 'Tuesday', short: 'Tue', value: 2 },
  { title: 'Wednesday', short: 'Wed', value: 3 },
  { title: 'Thursday', short: 'Thu', value: 4 },
  { title: 'Friday', short: 'Fri', value: 5 },
  { title: 'Saturday', short: 'Sat', value: 6 },
];

// A new row starts as the form of Dashboard Settings starts one. The key is how Studio tells the rows apart.
export function blankTimedRow(key = 'row' + Date.now().toString(36)) {
  return { _key: key, time: '', title: '', followUp: '', titleSeconds: 12, followUpSeconds: 10, days: everyDay.slice(), show: true };
}

// The list with one row changed. A row is changed by key, and the other rows are kept as they are.
export function withRow(rows, key, change) {
  return rows.map(row => {
    if (row._key !== key) return row;
    const next = Object.assign({}, row, change.set);
    (change.unset || []).forEach(name => delete next[name]);
    return next;
  });
}

export function withoutRow(rows, key) {
  return rows.filter(row => row._key !== key);
}

// The days of a row after a day is ticked or cleared, in week order
export function withDay(days, value, ticked) {
  const current = Array.isArray(days) ? days : [];
  const next = ticked ? current.concat(current.indexOf(value) === -1 ? [value] : []) : current.filter(day => day !== value);
  return next.sort((a, b) => a - b);
}

// The words that name a row in the list
export function rowTitle(row) {
  return [row.time, row.title].filter(Boolean).join('  ') || 'Empty message';
}
