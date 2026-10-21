// What the Display tab reads and writes in Dashboard Settings. It writes the same stored fields the Studio does and renames
// none of them: rotationRows (the Rotation board), and themeByWeekday, generalViewTitle and transitionSeconds (the Look
// page). Saving goes to the draft, never to the published document. Publishing is a separate call.
//
// The functions here are plain: they check what the page sent, and build Sanity mutations. The route sends them.

import { randomBytes } from 'node:crypto';
import { defaultThemeByWeekday, kioskMotions, motions, scheduledThemeIds, weekdays } from '../../dashboard/config-lists.js';
import { rotationViewOf, tidyRotationRow } from '../../dashboard/core/rotation.js';
import { Refusal } from './http.js';
import { mostRows, photoRange, secondsRange, startingPhotos } from '../static/display-rows.js';

export const settingsId = 'dashboardSettings';
export const draftId = 'drafts.dashboardSettings';

// The fields of the document this tab touches. Nothing else is read or written.
// Whole documents, not a projection: Publish and the first Save copy a document, so a copy that left out _type or any other
// setting would be refused, or worse, would replace the settings with the few fields read.
export const settingsQuery = '*[_id in ["' + settingsId + '", "' + draftId + '"]]';

// The fields of a row the tab changes. Any other field on a stored row (the Studio may add one) is kept as it is.
const rowFields = ['view', 'panel', 'seconds', 'shown', 'department', 'part', 'side', 'photoCount', 'secondsPerPhoto', 'list', 'chart', 'team'];
export const titleLongest = 28;
export const transitionRange = { min: 2, max: 4 };

// ----- reading the document -----

// The draft and the published document out of one answer, and which one the tab shows: the draft when there is one, as the
// Studio board does. studioNewer is true when the draft is the later of the two, which means edits waiting to be published.
export function pickSettings(result) {
  const list = Array.isArray(result) ? result : [];
  const published = list.find(doc => doc && doc._id === settingsId) || null;
  const draft = list.find(doc => doc && doc._id === draftId) || null;
  const source = draft || published;
  return {
    published: published,
    draft: draft,
    source: source,
    rev: source ? source._rev || '' : '',
    updatedAt: source ? source._updatedAt || '' : '',
    isDraft: Boolean(draft),
    studioNewer: Boolean(draft && published && Date.parse(draft._updatedAt) > Date.parse(published._updatedAt)) || Boolean(draft && !published),
  };
}

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

// The theme and view settings the tab shows, whole: a day with no stored theme has its starting one
export function themeOf(source) {
  const stored = source && plain(source.themeByWeekday) ? source.themeByWeekday : {};
  const themeByWeekday = {};
  weekdays.forEach(day => {
    themeByWeekday[day] = scheduledThemeIds.includes(stored[day]) ? stored[day] : defaultThemeByWeekday[day];
  });
  return {
    themeByWeekday: themeByWeekday,
    generalViewTitle: source && typeof source.generalViewTitle === 'string' ? source.generalViewTitle : '',
    transitionSeconds: source && typeof source.transitionSeconds === 'number' ? source.transitionSeconds : null,
  };
}

// The Motion setting the tab shows (a small section of its own): motion is full, light or calm, and motionOnKiosk says what
// the TV computer plays when motion is full. An empty or unknown stored value is the starting one.
export function motionOf(source) {
  return {
    motion: source && motions.includes(source.motion) ? source.motion : 'full',
    motionOnKiosk: source && kioskMotions.includes(source.motionOnKiosk) ? source.motionOnKiosk : 'light',
  };
}

// ----- checking what the page sent -----

function whole(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

function present(value) {
  return value !== undefined && value !== null && value !== '';
}

function newKey() {
  return randomBytes(6).toString('hex');
}

// One row, checked, and merged over the stored row with the same key so a field the tab does not show is kept.
// Out of range values are refused with the row number, not corrected, so nobody finds a number changed behind them.
function cleanRow(input, number, stored, used) {
  const where = 'Row ' + number + ': ';
  if (!plain(input)) throw new Refusal(400, where + 'this is not a row.');

  const view = rotationViewOf(input.view);
  if (view === '') throw new Refusal(400, where + 'pick Robotics, Prime or Nova.');
  const panel = typeof input.panel === 'string' ? input.panel.trim() : '';
  if (tidyRotationRow({ view: view, panel: panel }) === null) throw new Refusal(400, where + 'pick a panel the wall can play.');

  const clean = { view: view, panel: panel, shown: true };
  if (present(input.shown)) {
    if (typeof input.shown !== 'boolean') throw new Refusal(400, where + 'Shown should be on or off.');
    clean.shown = input.shown;
  }

  if (panel === 'photo') {
    const count = present(input.photoCount) ? input.photoCount : startingPhotos.count;
    const each = present(input.secondsPerPhoto) ? input.secondsPerPhoto : startingPhotos.each;
    if (!whole(count) || count < photoRange.count.min || count > photoRange.count.max) throw new Refusal(400, where + 'Photos should be a whole number from ' + photoRange.count.min + ' to ' + photoRange.count.max + '.');
    if (!whole(each) || each < photoRange.each.min || each > photoRange.each.max) throw new Refusal(400, where + 'Seconds per photo should be a whole number from ' + photoRange.each.min + ' to ' + photoRange.each.max + '.');
    Object.assign(clean, { photoCount: count, secondsPerPhoto: each, seconds: count * each });
  } else if (present(input.seconds)) {
    if (!whole(input.seconds) || input.seconds < secondsRange.min || input.seconds > secondsRange.max) throw new Refusal(400, where + 'Seconds should be a whole number from ' + secondsRange.min + ' to ' + secondsRange.max + ', or empty.');
    clean.seconds = input.seconds;
  }

  if (present(input.department)) {
    const text = typeof input.department === 'string' ? input.department.trim() : '';
    if (text === '' || text.length > 60 || /[\u0000-\u001f<>]/.test(text)) throw new Refusal(400, where + 'Department should be plain words up to 60 characters, such as build or business,marketing.');
    clean.department = text;
  }
  if (present(input.list)) {
    if (input.list !== 'open' && input.list !== 'done') throw new Refusal(400, where + 'List should be open or done.');
    clean.list = input.list;
  }
  if (present(input.chart)) {
    if (!['status', 'progress', 'timeline'].includes(input.chart)) throw new Refusal(400, where + 'Chart should be status, progress or timeline.');
    clean.chart = input.chart;
  }
  if (present(input.team)) {
    if (input.team !== 'prime' && input.team !== 'nova') throw new Refusal(400, where + 'Team should be Prime, Nova or empty for both.');
    clean.team = input.team;
  }
  if (present(input.part)) {
    if (input.part !== 1 && input.part !== 2) throw new Refusal(400, where + 'Page should be 1 or 2.');
    clean.part = input.part;
  }
  if (present(input.side)) {
    const side = typeof input.side === 'string' ? input.side.trim() : '';
    if (tidyRotationRow({ view: view, panel: panel, side: side }).side !== side) throw new Refusal(400, where + 'pick a small panel from the list.');
    clean.side = side;
  }

  let key = typeof input._key === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(input._key) && !used[input._key] ? input._key : newKey();
  while (used[key]) key = newKey();
  used[key] = true;

  const kept = Object.assign({}, stored[key] || {});
  rowFields.forEach(name => delete kept[name]);
  return Object.assign(kept, clean, { _key: key });
}

// The list to store. storedRows is the list now in Sanity, for the fields the tab does not show.
export function cleanRows(input, storedRows) {
  if (!Array.isArray(input)) throw new Refusal(400, 'The rows should be a list.');
  if (input.length > mostRows) throw new Refusal(400, 'The list can have ' + mostRows + ' rows at most.');

  const stored = {};
  (Array.isArray(storedRows) ? storedRows : []).forEach(row => {
    if (plain(row) && typeof row._key === 'string') stored[row._key] = row;
  });
  const used = {};
  return input.map((row, index) => cleanRow(row, index + 1, stored, used));
}

// The theme and view fields that were sent, checked. A field that was not sent is not touched.
export function cleanTheme(input) {
  const out = {};
  if (input === undefined || input === null) return out;
  if (!plain(input)) throw new Refusal(400, 'The theme settings should be an object.');

  if (input.themeByWeekday !== undefined) {
    if (!plain(input.themeByWeekday)) throw new Refusal(400, 'The theme of each weekday should be a list of days.');
    out.themeByWeekday = {};
    weekdays.forEach(day => {
      if (!scheduledThemeIds.includes(input.themeByWeekday[day])) throw new Refusal(400, 'Pick a theme for ' + day.charAt(0).toUpperCase() + day.slice(1) + ': ' + scheduledThemeIds.join(', ') + '.');
      out.themeByWeekday[day] = input.themeByWeekday[day];
    });
  }
  if (input.generalViewTitle !== undefined) {
    const title = typeof input.generalViewTitle === 'string' ? input.generalViewTitle.trim().replace(/\s+/g, ' ') : '';
    if (title === '' || title.length > titleLongest) throw new Refusal(400, 'The banner title for Robotics should be 1 to ' + titleLongest + ' characters.');
    out.generalViewTitle = title;
  }
  if (input.transitionSeconds !== undefined) {
    const seconds = input.transitionSeconds;
    if (typeof seconds !== 'number' || !isFinite(seconds) || seconds < transitionRange.min || seconds > transitionRange.max) throw new Refusal(400, 'The transition length should be a number from ' + transitionRange.min + ' to ' + transitionRange.max + '.');
    out.transitionSeconds = seconds;
  }
  return out;
}

// The motion fields that were sent, checked. A field that was not sent is not touched.
export function cleanMotion(input) {
  const out = {};
  if (input === undefined || input === null) return out;
  if (!plain(input)) throw new Refusal(400, 'The motion settings should be an object.');

  if (input.motion !== undefined) {
    if (!motions.includes(input.motion)) throw new Refusal(400, 'Motion should be ' + motions.join(', ') + '.');
    out.motion = input.motion;
  }
  if (input.motionOnKiosk !== undefined) {
    if (!kioskMotions.includes(input.motionOnKiosk)) throw new Refusal(400, 'Motion on the TV computer should be ' + kioskMotions.join(' or ') + '.');
    out.motionOnKiosk = input.motionOnKiosk;
  }
  return out;
}

// ----- the mutations -----

function withoutSystemFields(doc) {
  const copy = Object.assign({}, doc);
  ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
  return copy;
}

// Save: write the fields to the draft. When there is no draft yet it is made from the published document first, as the
// Studio does, so the other fields are kept. ifRevisionID makes Sanity refuse the write if the draft changed since it was
// read, which closes the gap between the check and the write.
export function saveMutations(fields, current) {
  if (current.draft) {
    const patch = { id: draftId, set: fields };
    if (current.draft._rev) patch.ifRevisionID = current.draft._rev;
    return [{ patch: patch }];
  }
  if (!current.published) throw new Refusal(409, 'Dashboard Settings has not been published yet. Open it in the Studio, click Publish once, and come back.');
  return [
    { createIfNotExists: Object.assign(withoutSystemFields(current.published), { _id: draftId }) },
    { patch: { id: draftId, set: fields } },
  ];
}

// Publish: the draft becomes the published document and the draft is deleted, which is what the Studio Publish button does.
export function publishMutations(current) {
  if (!current.draft) throw new Refusal(409, 'There is nothing to publish. The Studio has no waiting changes in Dashboard Settings.');
  return [
    { createOrReplace: Object.assign(withoutSystemFields(current.draft), { _id: settingsId }) },
    { delete: { id: draftId } },
  ];
}
