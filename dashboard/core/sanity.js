// Talks to Sanity: the two queries, the addresses, and turning what comes back
// into the content shape in data/sample/content.json. The sample is cleaned the same way.

import { defaultPerson, defaultSettings } from '../config.js';
import { parseLocalDateTime, sameDay } from './time.js';
import { fixSettingValues, visibleItems, withDefaults } from './content.js';
import { tidyPhoto } from './images.js';

// Everything the screen needs, in one request. Lists come back in the order
// they were created, and normalizeContent puts the ones with an Order first.
// Sanity leaves out a list the editors have emptied, which would bring the
// default list back, so coalesce hands over an empty list instead. A Done
// task with no Finished on date counts as finished when it was last edited.
// The Theme document is read with the rest. Its empty schedule and its
// missing fields are the defaults, so nothing special is needed (core/theme.js).
// Extra events that are switched off are left out here. A missing switch means
// on. The events are tidied and merged with the BAND ones in core/events.js.
// A person's photo is sent as a plain address with its size, crop and hotspot
// (images.js builds the address the screen asks for). The photo's own record
// has names that start with an underscore, which normalizeContent drops.
export const contentQuery = `{
  "settings": *[_id == "dashboardSettings"][0] {
    ...,
    "rotation": rotation { ..., "grid1": coalesce(grid1, []), "grid2": coalesce(grid2, []) },
    "announcements": coalesce(announcements, []),
    "calendars": coalesce(calendars, [])
  },
  "theme": *[_id == "theme"][0],
  "tasks": *[_type == "task"] | order(_createdAt asc) {
    ...,
    "subteam": subteam->name,
    "finishedOn": coalesce(finishedOn, _updatedAt)
  },
  "sponsors": *[_type == "sponsor"] | order(_createdAt asc),
  "tipsAndNews": *[_type == "tipOrNews"] | order(_createdAt asc),
  "subteams": *[_type == "subteam"] | order(_createdAt asc),
  "people": *[_type == "person"] | order(_createdAt asc) {
    ...,
    "photo": photo {
      "url": asset->url,
      "width": asset->metadata.dimensions.width,
      "height": asset->metadata.dimensions.height,
      crop,
      hotspot
    }
  },
  "plans": *[_type == "plan"] | order(date asc, _createdAt asc),
  "extraEvents": *[_type == "extraEvent" && show != false] | order(startDate asc, _createdAt asc),
  "customPanels": *[_type == "customPanel"] | order(_createdAt asc)
}`;

// The screen asks this first, to learn whether to show the sample or the
// editors' content (source.js). It is tiny, so it is quick and cheap to repeat.
export const sourceQuery = '*[_id == "dashboardSettings"][0] { contentSource, switchBackAt }';

const requestSeconds = 15;
const sourceRequestSeconds = 5;

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

export function sourceQueryUrl(sanity) {
  return addressOf(sanity, sourceQuery);
}

// The stream that says "something changed"
export function liveEventsUrl(sanity) {
  return 'https://' + sanity.projectId + '.api.sanity.io/v' + sanity.apiVersion +
    '/data/live/events/' + sanity.dataset;
}

// Asks Sanity and returns the whole answer. Throws when there is no answer in
// time or the status is bad, so the caller keeps what it has.
async function fetchBody(url, seconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), seconds * 1000);

  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Sanity answered with status ' + response.status);

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Asks Sanity for everything and returns the query result as it came.
// Throws when the answer cannot be used, so the caller keeps what it has.
export async function fetchResult(sanity) {
  const body = await fetchBody(queryUrl(sanity), requestSeconds);
  if (!body || typeof body.result !== 'object' || body.result === null) {
    throw new Error('Sanity sent no result');
  }
  return body.result;
}

// Asks Sanity for just contentSource and switchBackAt. Gives up after 5
// seconds, so a slow network does not hold the screen back. When Sanity
// answers that there is no Dashboard Settings document yet, the result is an
// empty object and the defaults apply. That is a good answer, not a failure.
// Throws when there is no usable answer.
export async function fetchSourceSettings(sanity) {
  const body = await fetchBody(sourceQueryUrl(sanity), sourceRequestSeconds);
  if (!isRecord(body) || !('result' in body) || (body.result !== null && !isRecord(body.result))) {
    throw new Error('Sanity sent no answer about the content source');
  }
  return body.result || {};
}

// Turns a query result into content. Hidden and expired items stay in the
// lists; the panels leave them out with visibleItems(). The one exception is
// plan, where the first plan that is showing and is for today wins.
export function normalizeContent(result, now = new Date()) {
  const data = result || {};
  const settings = normalizeSettings(data.settings);
  const team = normalizeTeam(settings.team);
  delete settings.team;

  return withDefaults({
    team: team,
    settings: settings,
    theme: data.theme,
    tasks: itemsFrom(data.tasks),
    plan: firstShowingPlan(data.plans, now),
    sponsors: itemsFrom(data.sponsors),
    tipsAndNews: itemsFrom(data.tipsAndNews),
    subteams: itemsFrom(data.subteams),
    people: itemsFrom(data.people).map(normalizePerson),
    extraEvents: itemsFrom(data.extraEvents),
    customPanels: customPanelsFrom(data.customPanels),
  });
}

// The sample file is already in the content shape. It gets the same cleaning
// as content from Sanity, so a typing slip in either one is handled alike.
export function normalizeSample(raw) {
  const data = isRecord(raw) ? raw : {};
  const content = Object.assign({}, data, {
    team: normalizeTeam(data.team),
    settings: normalizeSettings(data.settings),
    plan: isRecord(data.plan) ? withRows(cleanObject(data.plan)) : null,
  });

  ['tasks', 'sponsors', 'tipsAndNews', 'subteams', 'people', 'extraEvents', 'customPanels'].forEach(name => {
    content[name] = itemsFrom(data[name]);
  });
  content.people = content.people.map(normalizePerson);
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

function itemsFrom(list) {
  return sortByOrder(objectsIn(list).map(cleanObject));
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

function firstShowingPlan(plans, now) {
  const plan = visibleItems(itemsFrom(plans), now).find(item => isForToday(item, now));
  return plan ? withRows(plan) : null;
}

// A person with no photo, or one that cannot be used, has no photo at all.
// A missing "Show photo on screen" takes the default from config.js.
function normalizePerson(raw) {
  const person = Object.assign({}, defaultPerson, raw);
  if (typeof person.showPhoto !== 'boolean') person.showPhoto = defaultPerson.showPhoto;

  const photo = tidyPhoto(person.photo);
  if (photo) person.photo = photo;
  else delete person.photo;
  return person;
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
function normalizeRotation(rotation) {
  const result = Object.assign({}, rotation);

  ['grid1', 'grid2'].forEach(area => {
    const steps = Array.isArray(result[area]) ? result[area] : defaultSettings.rotation[area];

    result[area] = steps
      .filter(step => step.panel)
      .map(step => {
        const row = { panel: step.panel, show: step.show !== false };
        if (isPositive(step.seconds)) row.seconds = step.seconds;
        return row;
      });
  });

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
    const result = cleanObject(panel);
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
