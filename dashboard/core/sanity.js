// Talks to Sanity: the two queries, the addresses, and turning what comes back
// into the content shape in data/sample/content.json. The sample is cleaned the same way.

import { defaultFilter, defaultPerson, defaultSettings, defaultTalk, filterActions, limits, primeTeam, talkStatuses, teamTrim } from '../config.js';
import { parseLocalDateTime, sameDay } from './time.js';
import { fixSettingValues, isVisible, keepInRange, withDefaults } from './content.js';
import { logoUrl, photoFocus, screenPhotoUrl, tidyPhoto } from './images.js';
import { classifyFailure } from './connection.js';
import { pinnedFirst } from './task-source.js';
import { tidyFrc } from './frc.js';
import { tidyMondayStatus } from './monday.js';

// Everything the screen needs, in one request. Lists come back in the order
// they were created, and normalizeContent puts the ones with an Order first.
// Sanity leaves out a list the editors have emptied, which would bring the
// default list back, so coalesce hands over an empty list instead. A Done
// task with no Finished on date counts as finished when it was last edited.
// A task's location is the name of the place it points to. The query also asks
// whether that place is showing, and normalizeTask turns a hidden, deleted or
// nameless place into no location at all. The task itself stays.
// The Look document is read with the rest. Its empty schedule and its
// missing fields are the defaults, so nothing special is needed (core/theme.js).
// The Demo document is read with the rest too, and its changes come through the
// same live stream, so a click on Run demo reaches the screen within seconds.
// No Demo document means no demo (core/demo.js).
// Events come from the BAND calendars (core/calendar.js). The Events Calendar
// entries in Studio are not read.
// Styles by day and Team order are sent as lists too, and Team order as the codes of its teams. A list
// that is missing is a list that is empty: the screen then follows Style and Team mode (core/look-rotation.js).
// Calendar filter rules are cleaned in normalizeFilter. One that is off or past
// its Hide after time stays in the list, and core/events.js leaves it out.
// A person's photo, and the photo of a team lead, is sent as a plain address with its size, crop and
// hotspot (images.js builds the address the screen asks for). The photo's own record
// has names that start with an underscore, which normalizeContent drops.
// A Photo document is sent the same way, with its id and the time it was
// created (the underscore names are not kept, so they are asked for under
// plain ones). Hidden and expired photos stay in the list like the other items.
// A booked talk is sent the same way, with its id under a plain name. Only
// published talks come back, so a draft is never on the screen. A talk that is
// not scheduled stays in the list, and core/presentation.js leaves it out.
// The Teams come with the rest. Every kind of content that has a Team field is sent
// with the code of its team, or nothing when it is for both teams. A team that was
// deleted has no code either. A team's logo is sent like a person's photo.
// The FRC data (frc-status) is one document that the Mini writes. It is sent as it is and
// core/frc.js cleans it. No document means no competition cards.
// The board status (monday-status) is one document that the Mini writes. Only the sync time and the
// daily counts of open items are asked for, and core/monday.js cleans them. No document means the
// progress card has no line to draw. The tasks from the board come with the other tasks, above.
export const contentQuery = `{
  "settings": *[_id == "dashboardSettings"][0] {
    ...,
    "rotation": rotation { ..., "grid1": coalesce(grid1, []), "grid2": coalesce(grid2, []) },
    "announcements": coalesce(announcements, []),
    "calendars": coalesce(calendars, []),
    "dailyStyles": coalesce(dailyStyles, []),
    "teamOrder": coalesce(teamOrder[]->code, [])
  },
  "theme": *[_id == "theme"][0],
  "demo": *[_id == "demo"][0],
  "tasks": *[_type == "task"] | order(_createdAt asc) {
    ...,
    "subteam": subteam->name,
    "location": location->name,
    "locationShown": location->show != false,
    "team": team->code,
    "finishedOn": coalesce(finishedOn, _updatedAt)
  },
  "sponsors": *[_type == "sponsor"] | order(_createdAt asc) { ..., "team": team->code },
  "tipsAndNews": *[_type == "tipOrNews"] | order(_createdAt asc) { ..., "team": team->code },
  "subteams": *[_type == "subteam"] | order(_createdAt asc) {
    ...,
    "team": team->code,
    "photo": photo {
      "url": asset->url,
      "width": asset->metadata.dimensions.width,
      "height": asset->metadata.dimensions.height,
      crop,
      hotspot
    }
  },
  "people": *[_type == "person"] | order(_createdAt asc) {
    ...,
    "team": team->code,
    "photo": photo {
      "url": asset->url,
      "width": asset->metadata.dimensions.width,
      "height": asset->metadata.dimensions.height,
      crop,
      hotspot
    }
  },
  "photos": *[_type == "photo"] | order(_createdAt desc) {
    "id": _id,
    "createdAt": _createdAt,
    caption,
    credit,
    show,
    expires,
    "image": image {
      "url": asset->url,
      "width": asset->metadata.dimensions.width,
      "height": asset->metadata.dimensions.height,
      crop,
      hotspot
    }
  },
  "presentations": *[_type == "presentation"] | order(start asc, _createdAt asc) {
    "id": _id,
    name,
    subteam,
    topic,
    start,
    minutes,
    deckLink,
    status,
    "team": team->code
  },
  "plans": *[_type == "plan"] | order(date asc, _createdAt asc) { ..., "team": team->code },
  "calendarFilters": *[_type == "calendarFilter"] | order(_createdAt asc),
  "customPanels": *[_type == "customPanel"] | order(_createdAt asc) { ..., "team": team->code },
  "teams": *[_type == "team"] | order(order asc, _createdAt asc) {
    ...,
    "logo": logo {
      "url": asset->url,
      "width": asset->metadata.dimensions.width,
      "height": asset->metadata.dimensions.height,
      crop,
      hotspot
    }
  },
  "frc": *[_id == "frc-status"][0],
  "monday": *[_id == "monday-status"][0] { lastSyncAt, lastError, "snapshots": coalesce(snapshots, []) }
}`;

const requestSeconds = 15;
const probeSeconds = 5;

// sanity is { projectId, dataset, apiVersion } from config.js. The ordinary
// host is used, not the cached one, so a change shows at once.
function addressOf(sanity, query) {
  return 'https://' + sanity.projectId + '.api.sanity.io/v' + sanity.apiVersion +
    '/data/query/' + sanity.dataset +
    '?query=' + encodeURIComponent(query) +
    '&perspective=published';
}

export function queryUrl(sanity) {
  return addressOf(sanity, contentQuery);
}

// The stream that says "something changed"
export function liveEventsUrl(sanity) {
  return 'https://' + sanity.projectId + '.api.sanity.io/v' + sanity.apiVersion +
    '/data/live/events/' + sanity.dataset;
}

// The front page of the same host. Nothing is read from it: it only has to answer.
export function probeUrl(sanity) {
  return 'https://' + sanity.projectId + '.api.sanity.io/';
}

// An error for a read that failed. Its reason is one of the words in
// core/connection.js, which the status text on the screen shows.
function readFailure(message, failure) {
  const error = new Error(message);
  error.reason = classifyFailure(failure);
  return error;
}

// A plain request to the same host, with the mode 'no-cors'. The browser lets
// it through but does not let the page read the answer, so all it can say is
// whether the host answered. That is how a block by CORS (the host is there)
// is told from no network (it is not).
async function hostAnswers(sanity) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), probeSeconds * 1000);

  try {
    await fetch(probeUrl(sanity), { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    return true;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Asks Sanity and returns the whole answer. Throws when there is no answer in
// time or the status is bad, so the caller keeps what it has. The error has
// a reason (see readFailure). Pass sanity to find out why a read with no
// answer failed, which costs one more small request. Pass null to skip that.
async function fetchBody(url, seconds, sanity) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), seconds * 1000);

  try {
    let response;
    try {
      response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    } catch (error) {
      const timedOut = controller.signal.aborted;
      const hostAnswered = sanity ? await hostAnswers(sanity) : null;
      throw readFailure('Could not read from Sanity: ' + error.message, { timedOut: timedOut, hostAnswered: hostAnswered });
    }
    if (!response.ok) throw readFailure('Sanity answered with status ' + response.status, { status: response.status });

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Asks Sanity for everything and returns the query result as it came.
// Throws when the answer cannot be used, so the caller keeps what it has.
export async function fetchResult(sanity) {
  const body = await fetchBody(queryUrl(sanity), requestSeconds, sanity);
  if (!body || typeof body.result !== 'object' || body.result === null) {
    throw new Error('Sanity sent no result');
  }
  return body.result;
}

// Turns a query result into content. Hidden and expired items stay in the
// lists; the panels leave them out with visibleItems(), which leaves out the
// items of the other team as well. The one exception is plan, which is cut down
// to the plans that are showing and are for today. plans has all of them, and
// plan is the first, for the code that wants one. The Daily Agenda panel takes the
// first of plans that is for the team on the screen.
export function normalizeContent(result, now = new Date()) {
  const data = result || {};
  const settings = normalizeSettings(data.settings);
  const team = normalizeTeam(settings.team);
  delete settings.team;
  const plans = showingPlans(data.plans, now);

  return withDefaults({
    team: team,
    teams: teamsFrom(data.teams),
    settings: settings,
    theme: data.theme,
    demo: data.demo,
    tasks: pinnedFirst(itemsFrom(data.tasks).map(normalizeTask)),
    plan: plans[0] || null,
    plans: plans,
    sponsors: itemsFrom(data.sponsors),
    tipsAndNews: itemsFrom(data.tipsAndNews),
    subteams: itemsFrom(data.subteams).map(normalizeSubteam),
    people: itemsFrom(data.people).map(normalizePerson),
    photos: photosFrom(data.photos),
    presentations: presentationsFrom(data.presentations),
    calendarFilters: filtersFrom(data.calendarFilters),
    customPanels: customPanelsFrom(data.customPanels),
    frc: tidyFrc(data.frc),
    monday: tidyMondayStatus(data.monday),
  });
}

// The sample file is already in the content shape. It gets the same cleaning
// as content from Sanity, so a typing slip in either one is handled alike.
export function normalizeSample(raw) {
  const data = isRecord(raw) ? raw : {};
  const plans = itemsFrom(data.plans).map(withRows);
  const content = Object.assign({}, data, {
    team: normalizeTeam(data.team),
    teams: teamsFrom(data.teams),
    settings: normalizeSettings(data.settings),
    plan: isRecord(data.plan) ? withRows(withTeamCode(cleanObject(data.plan))) : plans[0] || null,
  });
  content.plans = plans.length > 0 ? plans : (content.plan ? [content.plan] : []);

  ['tasks', 'sponsors', 'tipsAndNews', 'subteams', 'people', 'customPanels'].forEach(name => {
    content[name] = itemsFrom(data[name]);
  });
  content.tasks = pinnedFirst(content.tasks.map(normalizeTask));
  content.subteams = content.subteams.map(normalizeSubteam);
  content.people = content.people.map(normalizePerson);
  content.photos = itemsFrom(data.photos).filter(photo => typeof photo.address === 'string');
  content.presentations = presentationsFrom(data.presentations);
  content.calendarFilters = filtersFrom(data.calendarFilters);
  content.frc = tidyFrc(data.frc);
  content.monday = tidyMondayStatus(data.monday);
  return withDefaults(content);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// An empty field is left out, so the defaults in config.js can fill it, and
// so is a row or block with nothing left in it. Names that start with an
// underscore are Sanity's own and are dropped.
function clean(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (Array.isArray(value)) return value.map(clean).filter(item => item !== undefined);

  if (typeof value === 'object') {
    const result = cleanObject(value);
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return value;
}

function cleanObject(object) {
  const result = {};
  Object.keys(object).forEach(key => {
    if (key.charAt(0) === '_') return;

    const value = clean(object[key]);
    if (value !== undefined) result[key] = value;
  });
  return result;
}

function hasOrder(item) {
  return typeof item.order === 'number' && isFinite(item.order);
}

// Items with an order come first, lowest first. The rest follow in the order
// they were stored. The position is kept so equal orders also stay in place.
function sortByOrder(list) {
  function compare(a, b) {
    const aHas = hasOrder(a.item);
    const bHas = hasOrder(b.item);
    if (aHas && bHas && a.item.order !== b.item.order) return a.item.order - b.item.order;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.position - b.position;
  }

  return list
    .map((item, position) => ({ item: item, position: position }))
    .sort(compare)
    .map(entry => entry.item);
}

function objectsIn(list) {
  return (Array.isArray(list) ? list : []).filter(item => item && typeof item === 'object');
}

// The team an item is for is the code of its team, or nothing when it is for both. The query
// sends the code. Anything else, such as the reference object in a copy saved before the
// query asked for the code, counts as nothing, so the item shows for both teams.
function withTeamCode(item) {
  const code = typeof item.team === 'string' ? item.team.trim().toLowerCase() : '';
  if (code === '') delete item.team;
  else item.team = code;
  return item;
}

function itemsFrom(list) {
  return sortByOrder(objectsIn(list).map(cleanObject).map(withTeamCode));
}

// A plan with no date, or a date that cannot be read, is for any day
function isForToday(plan, now) {
  const date = parseLocalDateTime(plan.date);
  return !date || sameDay(date, now);
}

function withRows(plan) {
  plan.rows = Array.isArray(plan.rows) ? plan.rows : [];
  return plan;
}

function showingPlans(plans, now) {
  return itemsFrom(plans).filter(item => isVisible(item, now) && isForToday(item, now)).map(withRows);
}

// A task's contact (a first name) and location (a place's name) are plain text
// or not there at all. The location goes when its place is hidden, deleted or
// has no name, and the flag the query adds is not kept. Nothing else about the
// task changes, so a hidden place never hides a task.
function normalizeTask(raw) {
  const task = Object.assign({}, raw);
  const placeHidden = task.locationShown === false;
  delete task.locationShown;

  ['contact', 'location'].forEach(name => {
    const text = typeof task[name] === 'string' ? task[name].trim() : '';
    if (text === '' || (name === 'location' && placeHidden)) delete task[name];
    else task[name] = text;
  });
  return task;
}

// A person with no photo, or one that cannot be used, has no photo at all.
// A missing "Show photo on screen" takes the default from config.js.
function normalizePerson(raw) {
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
function normalizeSubteam(raw) {
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

// A photo from Studio becomes { id, address, focus, caption, credit, createdAt,
// show, expires }. The address is the one the screen asks for (images.js) and
// focus is where the hotspot is in it. A photo with no picture that can be used
// is dropped, since there is nothing to show. The sample photos are already
// like this, with an address and no more than a caption and a credit.
function normalizePhoto(raw) {
  const picture = tidyPhoto(raw.image);
  if (!picture) return null;

  const photo = cleanObject({
    id: raw.id,
    createdAt: raw.createdAt,
    caption: raw.caption,
    credit: raw.credit,
    show: raw.show,
    expires: raw.expires,
  });
  photo.address = screenPhotoUrl(picture);
  photo.focus = photoFocus(picture);
  return photo;
}

function photosFrom(list) {
  return objectsIn(list).map(normalizePhoto).filter(photo => photo !== null);
}

// The same pattern as the Slides link field in studio/schemas/presentation.js
const deckLinkPattern = /^https:\/\/docs\.google\.com\/presentation\/d\/[A-Za-z0-9_-]+/;

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

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

  const talk = { id: raw.id, name: trimmed(raw.name) };
  const subteam = trimmed(raw.subteam);
  if (subteam !== '') talk.subteam = subteam;

  talk.topic = trimmed(raw.topic);
  talk.start = start;
  talk.minutes = keepInRange(raw.minutes, limits.talkMinutes, defaultTalk.minutes);

  if (typeof raw.deckLink === 'string' && deckLinkPattern.test(raw.deckLink)) talk.deckLink = raw.deckLink;

  talk.status = talkStatuses.includes(raw.status) ? raw.status : defaultTalk.status;

  const team = trimmed(raw.team).toLowerCase();
  if (team !== '') talk.team = team;
  return talk;
}

function presentationsFrom(list) {
  return objectsIn(list).map(normalizeTalk).filter(talk => talk !== null);
}

const plainDate = /^\d{4}-\d{2}-\d{2}$/;

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
    name: trimmed(raw.name),
    action: filterActions.includes(raw.action) ? raw.action : defaultFilter.action,
    words: words,
    days: days,
    calendar: trimmed(raw.calendar),
    fromDate: plainDate.test(raw.fromDate) ? raw.fromDate : '',
    toDate: plainDate.test(raw.toDate) ? raw.toDate : '',
  };
  if (raw.show === false) rule.show = false;
  if (raw.expires) rule.expires = raw.expires;
  if (raw.force === true) rule.force = true;

  const hasCondition = words.length > 0 || days.length > 0 || rule.calendar !== '' || rule.fromDate !== '' || rule.toDate !== '';
  return hasCondition ? rule : null;
}

function filtersFrom(list) {
  return objectsIn(list).map(normalizeFilter).filter(rule => rule !== null);
}

const hexColor = /^#[0-9A-Fa-f]{6}$/;
const teamCode = /^[a-z0-9]+$/;

// A team document from Studio becomes { code, name, shortName, number, logo, colors, mirror, the
// eight trim fields, active, order }. The code is lowercase letters and digits, and it is what the items point to,
// so a team without a usable one is dropped. The names are capitals, the way the team name
// has always been written in the banner, and a missing one is the other, or the code. The
// logo is the address of the picture at the width the screen needs (core/images.js), and
// empty when there is none or it cannot be used, which means the shared hawk. A sample file
// may give the logo as an address. A color that is not # and six hex digits is the Prime one.
// The mirror is off unless it is on, and the team is active unless it is switched off. A trim field
// that is missing or not one of its values is the Prime one (teamTrim in config.js).
function normalizeTeamDocument(raw) {
  const code = trimmed(raw.code).toLowerCase();
  if (!teamCode.test(code)) return null;

  const shortName = trimmed(raw.shortName).toUpperCase();
  const name = trimmed(raw.name).toUpperCase();
  const colors = {};
  Object.keys(primeTeam.colors).forEach(color => {
    const value = isRecord(raw.colors) ? trimmed(raw.colors[color]) : '';
    colors[color] = hexColor.test(value) ? value : primeTeam.colors[color];
  });

  return {
    code: code,
    name: name || shortName || code.toUpperCase(),
    shortName: shortName || name || code.toUpperCase(),
    number: typeof raw.number === 'number' ? String(raw.number) : trimmed(raw.number),
    logo: typeof raw.logo === 'string' ? raw.logo.trim() : logoUrl(raw.logo),
    colors: colors,
    mirror: raw.mirror === true,
    bolts: trimValue(raw, 'bolts'),
    cornerCut: trimValue(raw, 'cornerCut'),
    headerNotch: trimValue(raw, 'headerNotch'),
    grid: trimValue(raw, 'grid'),
    logoPose: trimValue(raw, 'logoPose'),
    nameStyle: trimValue(raw, 'nameStyle'),
    tickerLabel: trimValue(raw, 'tickerLabel'),
    countAccent: trimValue(raw, 'countAccent'),
    active: raw.active !== false,
    order: typeof raw.order === 'number' && isFinite(raw.order) ? raw.order : primeTeam.order,
  };
}

function trimValue(raw, name) {
  const value = trimmed(raw[name]);
  return Object.prototype.hasOwnProperty.call(teamTrim[name], value) ? value : primeTeam[name];
}

// The first team of a code is the one that counts. The list is in order.
function teamsFrom(list) {
  const seen = [];

  return itemsFrom(list).map(normalizeTeamDocument).filter(team => {
    if (team === null || seen.indexOf(team.code) !== -1) return false;

    seen.push(team.code);
    return true;
  });
}

function normalizeTeam(team) {
  const result = {};
  Object.keys(team || {}).forEach(key => {
    result[key] = String(team[key]);
  });
  return result;
}

function normalizeSettings(raw) {
  const settings = cleanObject(isRecord(raw) ? raw : {});

  if (isRecord(settings.rotation)) settings.rotation = normalizeRotation(settings.rotation);
  else delete settings.rotation;

  // The choices, switches and numbers in a range are checked in content.js.
  // That includes the screen glitch, where an old everyMinutes becomes seconds.
  fixSettingValues(settings);

  // The Studio keeps these four, hidden, but the screen uses the fixed values in constants.js
  ['nightStart', 'nightEnd', 'noShowMinutes', 'graceMinutes'].forEach(name => delete settings[name]);

  tidyList(settings, 'announcements', normalizeAnnouncements);
  tidyList(settings, 'calendars', calendars => calendars.filter(calendar => calendar.id));
  return settings;
}

// Something that is not a list is dropped, so that the default list is used.
// An empty list stays empty: the editors emptied it on purpose.
function tidyList(settings, name, tidy) {
  if (Array.isArray(settings[name])) settings[name] = tidy(settings[name]);
  else delete settings[name];
}

// Zero, a negative number or anything that is not a number would make the
// schedule spin without waiting, so it is not used
function isPositive(number) {
  return typeof number === 'number' && isFinite(number) && number > 0;
}

// The schedule needs a panel from every step. Seconds are optional: a row
// with none, or with a number that cannot be used, has no seconds at all and
// follows pageSeconds. The same goes for tickerSeconds.
function normalizeSteps(steps) {
  return steps
    .filter(step => step.panel)
    .map(step => {
      const row = { panel: step.panel, show: step.show !== false };
      if (isPositive(step.seconds)) row.seconds = step.seconds;
      return row;
    });
}

// order is the one list of panels (core/panel-order.js). Something that is not
// a list is dropped, so the two older lists decide, as they do for an empty one.
function normalizeRotation(rotation) {
  const result = Object.assign({}, rotation);

  ['grid1', 'grid2'].forEach(area => {
    result[area] = normalizeSteps(Array.isArray(result[area]) ? result[area] : defaultSettings.rotation[area]);
  });

  if (Array.isArray(result.order)) result.order = normalizeSteps(result.order);
  else delete result.order;

  if (!isPositive(result.tickerSeconds)) delete result.tickerSeconds;
  return result;
}

// The takeover code reads time and days on every second, so an announcement
// that cannot be read, or is switched off, is left out here, not there
function normalizeAnnouncements(list) {
  const fallback = defaultSettings.announcements[0];

  return list
    .filter(item => item.show !== false && /^\d{1,2}:\d\d$/.test(item.time || ''))
    .map(item => ({
      time: item.time,
      title: item.title || '',
      followUp: item.followUp || '',
      titleSeconds: isPositive(item.titleSeconds) ? item.titleSeconds : fallback.titleSeconds,
      followUpSeconds: isPositive(item.followUpSeconds) ? item.followUpSeconds : fallback.followUpSeconds,
      days: (Array.isArray(item.days) ? item.days : []).filter(day => Number.isInteger(day) && day >= 0 && day <= 6),
    }));
}

function customPanelsFrom(list) {
  const panels = objectsIn(list).map(panel => {
    const result = withTeamCode(cleanObject(panel));
    result.blocks = objectsIn(panel.blocks).filter(block => block._type).map(normalizeBlock);
    return result;
  });
  return sortByOrder(panels);
}

// The _type has to be read before cleanObject drops it.
// headingBlock becomes { type: 'heading' }, listBlock becomes { type: 'list' }.
function normalizeBlock(block) {
  const result = cleanObject(Object.assign({ type: String(block._type).replace(/Block$/, '') }, block));
  if (result.type === 'list' && !result.items) result.items = [];
  return result;
}
