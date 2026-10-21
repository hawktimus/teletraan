// The checks behind the Check the screen page (inputs/check-screen-view.js). They read the content in the dataset, the drafts
// and the published documents, and list what would make the TV look bad or show nothing, each with a plain fix. Nothing is
// written. Plain functions only, so that node can run them: tests/content-check.test.mjs does, and the control page could.
//
//   const found = checkContent(documents, new Date());     // documents: what contentQuestion asks for, raw perspective
//   const report = reportOf(found);                         // grouped by area, with counts
//   console.log(reportText(report));
//
// A finding is { area, level, code, doc: { id, type, title, state }, field, message, fix }. level is 'problem' (the TV shows
// nothing, shows the wrong thing, or shows what must stay private) or 'warning' (it shows, but looks bad).
// The limits are the ones in schemas/limits.js, which the schemas refuse past.

import { limits } from '../schemas/limits.js';
import { colorTrouble, contactIn, creditTrouble, isBlank, isPast, looksLikeFullName, photoTrouble, rgbOf, sameness } from './content-rules.js';
import { rotationTrouble } from './content-check-rotation.js';

export const areas = ['Ticker', 'Today', 'Leadership', 'Team leads', 'Sponsors', 'Photos', 'Teams and views', 'Rotation', 'Events', 'Dashboard Settings', 'Extra panels'];

const typeAreas = {
  tipOrNews: 'Ticker',
  announcement: 'Today',
  plan: 'Today',
  presentation: 'Today',
  person: 'Leadership',
  subteam: 'Team leads',
  sponsor: 'Sponsors',
  photo: 'Photos',
  team: 'Teams and views',
  calendarFilter: 'Events',
  dashboardSettings: 'Dashboard Settings',
  customPanel: 'Extra panels',
};

const imageField = '{ ..., asset->{ _id, metadata { dimensions } } }';

// The question that finds everything the checks read. Ask it with the raw perspective, so drafts come back as well.
export const contentQuestion = `{
  "documents": *[_type in ["tipOrNews", "announcement", "plan", "presentation", "person", "subteam", "sponsor", "photo", "team", "calendarFilter", "dashboardSettings", "customPanel"]] {
    ...,
    "teamCode": team->code,
    image ${imageField},
    photo ${imageField},
    logo ${imageField}
  },
  "tasks": *[_type == "task" && source == "monday" && show != false && showOnTv != false && showOnBoard != false && defined(department)] {
    "team": team->code, department, list, status, startDate, dueDate, expires
  },
  "status": *[_id == "status-mini"][0] { lastCleanupAt, cleanupWouldDelete, cleanupDeleted, cleanupError }
}`;

// The documents one per page: the draft when there is one (it is what Publish all would put on the TV), else the published one
export function currentDocuments(documents) {
  const byId = {};

  (Array.isArray(documents) ? documents : []).forEach(doc => {
    if (!doc || typeof doc._id !== 'string' || typeof doc._type !== 'string') return;
    const draft = doc._id.indexOf('drafts.') === 0;
    const id = draft ? doc._id.slice('drafts.'.length) : doc._id;
    if (byId[id] && !draft) return;
    byId[id] = Object.assign({}, doc, { _id: id, _state: draft ? 'draft' : 'published' });
  });
  return Object.keys(byId).map(id => byId[id]);
}

function titleOf(doc) {
  const first = [doc.text, doc.heading, doc.name, doc.topic, doc.title, doc.lead, doc.caption].find(value => typeof value === 'string' && value.trim() !== '');
  if (first) return first.trim();
  if (doc._type === 'dashboardSettings') return 'Dashboard Settings';
  if (doc._type === 'photo') return 'Photo with no caption';
  return 'Untitled ' + doc._type;
}

function makeAdder(found) {
  return function add(doc, level, code, field, message, fix) {
    found.push({
      area: typeAreas[doc._type] || doc._type,
      level: level,
      code: code,
      doc: { id: doc._id, type: doc._type, title: titleOf(doc), state: doc._state || 'published' },
      field: field,
      message: message,
      fix: fix,
    });
  };
}

function isOn(doc) {
  return doc.show !== false;
}

function plural(count, word) {
  return count + ' ' + word + (count === 1 ? '' : 's');
}

// One typed text: missing, too long, or holding something private
function checkText(add, doc, field, label, limit, required) {
  checkValue(add, doc, field, doc[field], label, limit, required);
}

function checkValue(add, doc, field, value, label, limit, required) {
  if (isBlank(value)) {
    if (required) add(doc, 'problem', 'text-empty', field, 'The ' + label + ' is empty, so there is nothing to show.', 'Type the ' + label + ', or hide the item.');
    return;
  }
  const kind = contactIn(value);
  if (kind !== '') add(doc, 'problem', 'public-contact', field, 'The ' + label + ' has ' + kind + '. The dataset is public, so anyone can read it.', 'Take it out of the ' + label + ', then publish.');
  if (limit && value.trim().length > limit) {
    add(doc, 'warning', 'text-too-long', field, 'The ' + label + ' has ' + plural(value.trim().length, 'character') + '. Only ' + limit + ' fit, so the screen cuts it short.', 'Shorten the ' + label + ' to ' + limit + ' characters or fewer.');
  }
}

function checkFirstName(add, doc, field, label, value) {
  if (!isBlank(value) && looksLikeFullName(value)) {
    add(doc, 'warning', 'full-name', field, 'The ' + label + ' "' + value.trim() + '" looks like a full name. The screen is public and shows first names only.', 'Use the first name, or add a last initial such as Sam K.');
  }
}

function checkExpiry(add, doc, now) {
  if (isOn(doc) && doc.expires && isPast(doc.expires, now)) {
    add(doc, 'warning', 'expired', 'expires', 'Hide after has passed, so the screen no longer shows this. It still clutters the list.', 'Delete it, or move Hide after to a later date.');
  }
}

// The same line on two items that are both on
function checkRepeats(add, docs, key, label) {
  const first = {};
  docs.filter(isOn).forEach(doc => {
    const same = sameness(key(doc));
    if (same === '') return;
    if (first[same]) add(doc, 'warning', 'duplicate', 'text', 'This is the same ' + label + ' as "' + titleOf(first[same]) + '". It shows twice.', 'Delete one of them, or change one.');
    else first[same] = doc;
  });
}


// Each type

function checkTicker(add, docs, now) {
  docs.filter(isOn).forEach(doc => {
    checkText(add, doc, 'text', 'ticker line', limits.tickerLine, true);
    checkExpiry(add, doc, now);
  });
  checkRepeats(add, docs, doc => doc.text, 'ticker line');
}

function checkAnnouncements(add, docs, now) {
  docs.forEach(doc => {
    checkText(add, doc, 'text', 'announcement', limits.announcementText, true);
    const start = Date.parse(doc.start);
    const end = Date.parse(doc.end);
    if (isNaN(start)) add(doc, 'problem', 'no-start', 'start', 'The announcement has no start, so it never goes up.', 'Pick when it starts.');
    if (isNaN(end)) add(doc, 'problem', 'no-end', 'end', 'The announcement has no end, so it never goes up.', 'Pick when it ends.');
    if (!isNaN(start) && !isNaN(end) && end <= start) add(doc, 'problem', 'end-before-start', 'end', 'The announcement ends before it starts, so it never goes up.', 'Move the end to after the start.');
    else if (!isNaN(end) && end < now.getTime()) add(doc, 'warning', 'over', 'end', 'The announcement is over. It stays in the list.', 'Delete it, or move the dates.');
  });
  checkRepeats(add, docs, doc => doc.text, 'announcement');
}

function checkPlans(add, docs, now) {
  const today = now.toISOString().slice(0, 10);
  docs.filter(isOn).forEach(doc => {
    checkText(add, doc, 'heading', 'heading', limits.planHeading, true);
    checkText(add, doc, 'location', 'location', limits.planLocation, false);
    checkExpiry(add, doc, now);
    const rows = Array.isArray(doc.rows) ? doc.rows : [];
    if (rows.length === 0 && isOn(doc)) add(doc, 'warning', 'plan-no-rows', 'rows', 'The agenda item has no schedule rows, so the panel shows only the heading.', 'Add the schedule rows.');
    if (rows.length > limits.planRows) add(doc, 'warning', 'plan-rows', 'rows', 'The schedule has ' + rows.length + ' rows. Only ' + limits.planRows + ' fit.', 'Remove rows until ' + limits.planRows + ' are left.');
    rows.forEach((row, index) => {
      const where = 'row ' + (index + 1);
      checkValue(add, doc, 'rows', row && row.text, where + ' text', limits.planRowText, true);
      if (row && typeof row.time === 'string' && row.time.length > limits.planRowTime) add(doc, 'warning', 'text-too-long', 'rows', 'The time of ' + where + ' has ' + plural(row.time.length, 'character') + '. Only ' + limits.planRowTime + ' fit.', 'Shorten it, for example 6:00 PM.');
      if (row && typeof row.lead === 'string' && row.lead.length > limits.planRowLead) add(doc, 'warning', 'text-too-long', 'rows', 'The name of ' + where + ' has ' + plural(row.lead.length, 'character') + '. Only ' + limits.planRowLead + ' fit.', 'Use a first name.');
    });
    if (isOn(doc) && !doc.date) add(doc, 'warning', 'no-date', 'date', 'The agenda item has no date, so the screen shows it every day.', 'Pick the day it is for.');
    else if (isOn(doc) && doc.date < today) add(doc, 'warning', 'date-past', 'date', 'The agenda item is for ' + doc.date + ', which has passed, so the screen never shows it.', 'Move the date, or delete the item.');
  });
  checkRepeats(add, docs, doc => (doc.heading || '') + '|' + (doc.date || ''), 'agenda item');
}

function checkTalks(add, docs, now) {
  docs.forEach(doc => {
    checkText(add, doc, 'topic', 'title of the talk', 40, true);
    if (isBlank(doc.name)) add(doc, 'problem', 'text-empty', 'name', 'The talk has no speaker name.', 'Type the first name of the speaker.');
    else if (doc.name.trim().length > limits.leadMember) add(doc, 'warning', 'text-too-long', 'name', 'The speaker name has ' + plural(doc.name.trim().length, 'character') + '. Only ' + limits.leadMember + ' fit.', 'Use the first name.');
    checkFirstName(add, doc, 'name', 'speaker name', doc.name);
    const start = Date.parse(doc.start);
    if (isNaN(start)) {
      if (doc.status === 'scheduled' || !doc.status) add(doc, 'problem', 'no-start', 'start', 'The talk has no start time, so it never plays.', 'Pick the start time.');
    } else if ((doc.status === 'scheduled' || !doc.status) && start + (Number(doc.minutes) || 10) * 60000 < now.getTime() - 24 * 3600000) {
      add(doc, 'warning', 'talk-past', 'status', 'The talk was more than a day ago and is still marked Scheduled.', 'Change the status to Done, or delete the talk.');
    }
    if ((doc.status === 'scheduled' || !doc.status) && isBlank(doc.deckLink)) add(doc, 'warning', 'no-slides', 'deckLink', 'The talk has no slides link, so the screen shows the title card and the thank you card only.', 'Paste the Google Slides link.');
  });
}

function checkLeadership(add, docs, now) {
  docs.forEach(doc => {
    if (!isOn(doc)) return;
    checkText(add, doc, 'name', 'name', limits.personName, true);
    checkText(add, doc, 'title', 'role', limits.personRole, false);
    checkText(add, doc, 'line', 'line under the name', limits.personLine, false);
    checkFirstName(add, doc, 'name', 'name', doc.name);
    checkExpiry(add, doc, now);
    if (isBlank(doc.title) && isBlank(doc.role)) add(doc, 'problem', 'no-role', 'title', 'This person has no role, so the chip at the end of the row is empty.', 'Type the role, such as Coach or Co-President.');
    else if (isBlank(doc.title)) add(doc, 'warning', 'no-role', 'title', 'This person has no Role, so the chip shows only ' + String(doc.role).toUpperCase() + '.', 'Type the role, such as Co-President or Parent.');
    if (!['Coach', 'Captain', 'Mentor'].includes(doc.role) && !isBlank(doc.role)) add(doc, 'warning', 'odd-role', 'role', 'The "Listed with" value "' + doc.role + '" is not Coach, Captain or Mentor, so this person is listed last.', 'Pick Coach, Captain or Mentor.');
    if (!(doc.photo && doc.photo.asset) && doc.showPhoto !== false) add(doc, 'warning', 'no-portrait', 'photo', 'This person has no photo, so the screen draws a plain silhouette.', 'Add a square photo, or turn Show photo on screen off on purpose.');
  });
  checkRepeats(add, docs, doc => doc.name, 'person');
}

function checkLeads(add, docs, now) {
  docs.forEach(doc => {
    if (!isOn(doc)) return;
    checkText(add, doc, 'name', 'subteam name', limits.leadDepartment, false);
    checkText(add, doc, 'lead', 'lead name', limits.leadName, false);
    checkText(add, doc, 'line', 'line under the lead', limits.leadLine, false);
    checkFirstName(add, doc, 'lead', 'lead name', doc.lead);
    checkExpiry(add, doc, now);
    if (isBlank(doc.name) && isBlank(doc.lead)) add(doc, 'problem', 'text-empty', 'name', 'This team lead has no subteam name and no lead, so the screen leaves it out.', 'Type the subteam name and the lead, or hide the item.');
    else if (isBlank(doc.lead)) add(doc, 'warning', 'no-lead', 'lead', 'The subteam ' + doc.name.trim() + ' has no lead, so the screen shows [lead] in the row.', 'Type the lead, or leave the gap on purpose.');
    else if (!(doc.photo && doc.photo.asset) && doc.showPhoto !== false) add(doc, 'warning', 'no-portrait', 'photo', 'This lead has no photo, so the screen draws a plain silhouette.', 'Add a square photo, or turn Show photo on screen off on purpose.');

    const members = Array.isArray(doc.members) ? doc.members : [];
    if (members.length > limits.leadMembers) add(doc, 'warning', 'members-many', 'members', 'The roster has ' + members.length + ' names. Only ' + limits.leadMembers + ' fit.', 'Remove names until ' + limits.leadMembers + ' are left.');
    const seen = [];
    members.forEach(member => {
      if (isBlank(member)) return add(doc, 'warning', 'member-empty', 'members', 'The roster has an empty name.', 'Type the name, or remove the line.');
      if (member.trim().length > limits.leadMember) add(doc, 'warning', 'text-too-long', 'members', 'The name "' + member.trim() + '" has ' + plural(member.trim().length, 'character') + '. Only ' + limits.leadMember + ' fit.', 'Use the first name.');
      if (contactIn(member) !== '') add(doc, 'problem', 'public-contact', 'members', 'The name "' + member.trim() + '" has ' + contactIn(member) + '. The dataset is public.', 'Take it out.');
      checkFirstName(add, doc, 'members', 'roster name', member);
      if (seen.includes(sameness(member))) add(doc, 'warning', 'duplicate', 'members', 'The name "' + member.trim() + '" is on the roster twice.', 'Add a last initial to tell them apart, or remove one.');
      seen.push(sameness(member));
    });
    if (doc.spotlight === true) {
      checkText(add, doc, 'spotlightHeadline', 'spotlight headline', limits.spotlightHeadline, true);
      checkText(add, doc, 'spotlightText', 'spotlight text', limits.spotlightText, false);
    }
  });
  checkRepeats(add, docs, doc => doc.name, 'subteam');
}

function checkSponsors(add, docs, now) {
  docs.forEach(doc => {
    if (!isOn(doc)) return;
    checkText(add, doc, 'name', 'sponsor name', limits.sponsorName, true);
    checkText(add, doc, 'tier', 'tier', limits.sponsorTier, false);
    checkText(add, doc, 'blurb', 'sponsor blurb', limits.sponsorBlurb, false);
    checkText(add, doc, 'thankYou', 'thank-you line', limits.sponsorThanks, false);
    checkExpiry(add, doc, now);
    if (isBlank(doc.logoAddress)) add(doc, 'warning', 'no-logo', 'logoAddress', 'This sponsor has no logo address, so the Sponsor logo panel skips it.', 'Paste the web address of the logo picture.');
    else if (!/^https?:\/\/\S+$/i.test(doc.logoAddress.trim())) add(doc, 'problem', 'bad-logo', 'logoAddress', 'The logo address does not start with http:// or https://, so no picture loads.', 'Paste the full web address of the logo picture.');
  });
  checkRepeats(add, docs, doc => doc.name, 'sponsor');
}

function checkPhotos(add, docs, settings, now) {
  const seenPictures = {};
  docs.forEach(doc => {
    if (!isOn(doc)) return;
    checkText(add, doc, 'caption', 'caption', limits.photoCaption, false);
    checkExpiry(add, doc, now);
    const asset = doc.image && doc.image.asset;
    if (!asset) {
      add(doc, 'problem', 'no-picture', 'image', 'This photo has no picture, so the Photo panel skips it.', 'Upload the picture, or delete the item.');
      return;
    }
    photoTrouble(doc.image, doc.fit, settings.photoFit).forEach(item => {
      add(doc, item.level, item.level === 'problem' ? 'photo-tiny' : 'photo-size', 'image', item.message, 'Replace the picture with a bigger or wider one.');
    });
    const ref = asset._id || asset._ref;
    if (ref && seenPictures[ref]) add(doc, 'warning', 'duplicate', 'image', 'This is the same picture as "' + titleOf(seenPictures[ref]) + '". It shows twice.', 'Delete one of them.');
    else if (ref) seenPictures[ref] = doc;

    if (isBlank(doc.credit)) add(doc, 'warning', 'no-credit', 'credit', 'This photo has no credit, so the screen shows no Photo: line.', 'Type the first name of the person who took it.');
    else {
      const trouble = creditTrouble(doc.credit);
      if (trouble !== '') add(doc, contactIn(doc.credit) !== '' ? 'problem' : 'warning', 'bad-credit', 'credit', 'The credit "' + doc.credit.trim() + '" ' + trouble + '. The screen is public and shows a first name only.', 'Type one first name.');
      if (doc.credit.trim().length > limits.photoCredit) add(doc, 'warning', 'text-too-long', 'credit', 'The credit has ' + plural(doc.credit.trim().length, 'character') + '. Only ' + limits.photoCredit + ' fit.', 'Use the first name.');
    }
  });
}

function checkTeams(add, docs) {
  const codes = {};
  docs.forEach(doc => {
    checkText(add, doc, 'name', 'team name', limits.teamName, true);
    if (!isBlank(doc.number) && doc.number.trim().length > limits.teamNumber) add(doc, 'warning', 'text-too-long', 'number', 'The team number has ' + plural(doc.number.trim().length, 'character') + '. Only ' + limits.teamNumber + ' fit.', 'Use the FRC team number.');
    if (isBlank(doc.code)) add(doc, 'problem', 'text-empty', 'code', 'The team has no code, so items cannot be matched to it.', 'Type a lowercase code such as prime.');
    else if (codes[doc.code]) add(doc, 'problem', 'duplicate', 'code', 'Two teams have the code ' + doc.code + ', so the screen mixes them up.', 'Give each team its own code.');
    else codes[doc.code] = doc;

    const colors = doc.colors && typeof doc.colors === 'object' ? doc.colors : {};
    Object.keys(colors).forEach(name => {
      if (name.charAt(0) !== '_' && typeof colors[name] === 'string' && colors[name] !== '' && !rgbOf(colors[name])) {
        add(doc, 'problem', 'bad-color', 'colors', 'The ' + name + ' color "' + colors[name] + '" is not a color.', 'Use # and six characters from 0 to 9 and A to F, such as #6C18B6.');
      }
    });
    colorTrouble(doc.colors).forEach(item => add(doc, item.level, 'low-contrast', 'colors', item.message, 'Change the ' + item.field + ' color, then look at the team in Preview the screen.'));
  });
}

function checkFilters(add, docs, now) {
  const forced = docs.filter(doc => isOn(doc) && doc.action === 'show' && doc.force === true && !(doc.expires && isPast(doc.expires, now)));
  const signatures = {};
  docs.forEach(doc => {
    if (!isOn(doc)) return;
    checkExpiry(add, doc, now);
    if (doc.toDate && doc.toDate < now.toISOString().slice(0, 10)) add(doc, 'warning', 'rule-ended', 'toDate', 'The rule ended on ' + doc.toDate + '. It does nothing now.', 'Delete the rule.');
    if (doc.fromDate && doc.toDate && doc.toDate < doc.fromDate) add(doc, 'problem', 'rule-dates', 'toDate', 'The To date comes before the From date, so the rule never matches.', 'Fix the two dates.');

    if (doc.scope === 'one') {
      const filled = [doc.eventCalendar, doc.eventTitle, doc.eventStart].every(value => !isBlank(value));
      if (!filled) add(doc, 'problem', 'rule-one-event', 'eventTitle', 'This one event rule is missing the calendar, the title or the start, so it matches nothing.', 'Make the rule again from the Calendars page.');
    } else {
      const has = (Array.isArray(doc.words) && doc.words.some(word => !isBlank(word))) || (Array.isArray(doc.days) && doc.days.length > 0) || !isBlank(doc.calendar) || doc.fromDate || doc.toDate;
      if (!has) add(doc, doc.action === 'show' ? 'warning' : 'problem', 'rule-matches-all', 'words', 'This rule has no title words, days, calendar or dates, so it matches every event' + (doc.action === 'show' ? '.' : ' and hides them all.'), 'Add a title word, a day, a calendar or a date.');
    }
    const key = [doc.action, doc.scope === 'one' ? 'one' : 'many', (doc.words || []).map(sameness).filter(Boolean).sort().join(','), (doc.days || []).join(','), doc.calendar, doc.fromDate, doc.toDate, doc.eventTitle, doc.eventStart].join('|');
    if (signatures[key]) add(doc, 'warning', 'duplicate', 'name', 'This rule does the same as "' + titleOf(signatures[key]) + '".', 'Delete one of the two.');
    else signatures[key] = doc;
  });
  if (forced.length > 3) {
    add(forced[3], 'warning', 'pin-many', 'force', forced.length + ' rules pin events to page one. At most 3 events are pinned, so the others are not.', 'Turn Pin to page one off on all but 3 rules.');
  }
}

function checkCustomPanels(add, docs, now) {
  docs.forEach(doc => {
    if (!isOn(doc)) return;
    checkText(add, doc, 'title', 'panel title', 7, true);
    checkExpiry(add, doc, now);
    const blocks = Array.isArray(doc.blocks) ? doc.blocks : [];
    if (blocks.length === 0) add(doc, 'warning', 'panel-empty', 'blocks', 'This extra panel has no blocks, so it shows only its title.', 'Add blocks, or hide the panel.');
    if (blocks.length > 6) add(doc, 'warning', 'panel-many', 'blocks', 'This extra panel has ' + blocks.length + ' blocks. Only 6 fit.', 'Remove blocks until 6 are left.');
    JSON.stringify(blocks, (name, value) => {
      if (typeof value === 'string' && name !== '_type' && name !== '_key' && contactIn(value) !== '') add(doc, 'problem', 'public-contact', 'blocks', 'A block has ' + contactIn(value) + '. The dataset is public.', 'Take it out of the block.');
      return value;
    });
  });
}

function checkSettings(add, doc, photos, now) {
  const countdown = doc.countdown && typeof doc.countdown === 'object' ? doc.countdown : {};
  const kickoff = Date.parse(countdown.kickoff);
  const rollout = Date.parse(countdown.rollout);
  const over = date => !isNaN(date) && date < now.getTime();

  if (over(kickoff) && (isNaN(rollout) || over(rollout))) {
    add(doc, 'warning', 'countdown-over', 'countdown', 'Both countdown dates have passed, so the countdown has nothing left to count to.', 'Set a new Kickoff date, or a Rollout date, on the Countdown tab.');
  }
  ['kickoffLabel', 'rolloutLabel'].forEach(name => {
    if (typeof countdown[name] === 'string' && countdown[name].trim().length > 40) add(doc, 'warning', 'text-too-long', 'countdown', 'The ' + name + ' has more than 40 characters. It does not fit at the smallest size.', 'Shorten it to 40 characters or fewer.');
  });
  if (doc.photoSource === 'drive' && isBlank(doc.photoDriveFolder)) {
    add(doc, 'problem', 'no-drive-folder', 'photoDriveFolder', 'Photos come from a Google Drive folder, and no folder link is set, so no photo plays.', 'Paste the folder link on the Photos page, or pick Upload photos.');
  }
  if (doc.photoSource === 'drive' && photos.some(isOn)) {
    add(doc, 'warning', 'photos-unused', 'photoSource', 'The photos you uploaded do not play while the source is Google Drive folder.', 'Pick Both on the Photos page, or delete the uploaded photos.');
  }
}


// All of it

// Every finding for these documents, the problems first inside each area. documents are raw documents (drafts and published);
// tasks is the list contentQuestion asks for. now is a date.
export function checkContent(documents, now = new Date(), tasks = []) {
  const current = currentDocuments(documents);
  const ofType = type => current.filter(doc => doc._type === type);
  const settings = ofType('dashboardSettings')[0] || {};
  const found = [];
  const add = makeAdder(found);

  checkTicker(add, ofType('tipOrNews'), now);
  checkAnnouncements(add, ofType('announcement'), now);
  checkPlans(add, ofType('plan'), now);
  checkTalks(add, ofType('presentation'), now);
  checkLeadership(add, ofType('person'), now);
  checkLeads(add, ofType('subteam'), now);
  checkSponsors(add, ofType('sponsor'), now);
  checkPhotos(add, ofType('photo'), settings, now);
  checkTeams(add, ofType('team'));
  checkFilters(add, ofType('calendarFilter'), now);
  checkCustomPanels(add, ofType('customPanel'), now);
  if (settings._id) {
    checkSettings(add, settings, ofType('photo'), now);
    const data = {
      people: ofType('person'),
      subteams: ofType('subteam'),
      sponsors: ofType('sponsor'),
      customPanels: ofType('customPanel'),
      photos: ofType('photo').filter(isOn).map(photo => ({ expires: photo.expires })),
      tasks: tasks,
      teams: ofType('team'),
    };
    rotationTrouble(settings.rotationRows, data, now).forEach(item => {
      found.push({
        area: 'Rotation',
        level: item.level,
        code: item.code,
        doc: { id: settings._id, type: 'dashboardSettings', title: 'Dashboard Settings, Rotation', state: settings._state },
        field: item.field,
        message: item.message,
        fix: item.fix,
      });
    });
  }
  return found;
}

// Everything in one call, from the answer of contentQuestion: { documents, tasks }
// The one line about the automatic clean up of expired items (computer/scripts/expired-cleanup.sh): whether it is on, what it
// does and when. It reads the published Dashboard Settings, because that is what the Teletraan computer reads.
export function cleanupLine(answer) {
  const given = answer && typeof answer === 'object' ? answer : {};
  const docs = Array.isArray(given.documents) ? given.documents : [];
  const settings = docs.find(doc => doc && doc._id === 'dashboardSettings') || docs.find(doc => doc && doc._id === 'drafts.dashboardSettings') || {};
  const days = Number.isInteger(settings.cleanupDeleteAfterDays) && settings.cleanupDeleteAfterDays >= 1 && settings.cleanupDeleteAfterDays <= 365 ? settings.cleanupDeleteAfterDays : 14;
  let line;
  if (settings.cleanupEnabled !== true) {
    line = 'Automatic clean up is off, so expired items stay in the Studio until someone deletes them. Dashboard Settings, Advanced, Clean up expired items turns it on.';
  } else if (settings.cleanupMode === 'delete') {
    line = 'Automatic clean up is on: every night at 03:40 the Teletraan computer saves a backup and deletes items that expired more than ' + plural(days, 'day') + ' ago.';
  } else {
    line = 'Automatic clean up is on but only lists: every night at 03:40 it writes down the items that expired more than ' + plural(days, 'day') + ' ago and deletes nothing. Set Mode to Delete to have them deleted.';
  }
  const status = given.status && typeof given.status === 'object' ? given.status : null;
  if (status && typeof status.lastCleanupAt === 'string') {
    line += ' Last run: ' + status.lastCleanupAt.slice(0, 16).replace('T', ' ') + ' UTC, ' + (Number(status.cleanupWouldDelete) || 0) + ' on the list, ' + (Number(status.cleanupDeleted) || 0) + ' deleted.';
    if (typeof status.cleanupError === 'string' && status.cleanupError !== '') line += ' Problem: ' + status.cleanupError;
  }
  return line;
}

export function checkAnswer(answer, now = new Date()) {
  const given = answer && typeof answer === 'object' ? answer : {};
  return checkContent(given.documents, now, given.tasks || []);
}


// The report

const levelOrder = { problem: 0, warning: 1 };

// The findings grouped by area, in the order of the sidebar, the problems first inside an area.
// { problems, warnings, groups: [{ area, problems, warnings, items }] }
export function reportOf(findings) {
  const list = Array.isArray(findings) ? findings : [];
  const groups = areas
    .map(area => {
      const items = list.filter(item => item.area === area).sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
      return { area: area, problems: items.filter(item => item.level === 'problem').length, warnings: items.filter(item => item.level === 'warning').length, items: items };
    })
    .filter(group => group.items.length > 0);

  return {
    problems: list.filter(item => item.level === 'problem').length,
    warnings: list.filter(item => item.level === 'warning').length,
    groups: groups,
  };
}

export function summaryLine(report) {
  if (report.problems + report.warnings === 0) return 'Nothing to fix. Every check passed.';
  return plural(report.problems, 'problem') + ' and ' + plural(report.warnings, 'warning') + '.';
}

// The report as plain text, for a terminal or a message
export function reportText(report) {
  const lines = [summaryLine(report)];
  report.groups.forEach(group => {
    lines.push('', group.area.toUpperCase());
    group.items.forEach(item => {
      lines.push((item.level === 'problem' ? 'PROBLEM ' : 'WARNING ') + item.doc.title + ' (' + item.doc.type + ' ' + item.doc.id + '): ' + item.message, '    Fix: ' + item.fix);
    });
  });
  return lines.join('\n');
}
