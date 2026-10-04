// Talks to Sanity: the one query, the addresses, and turning what comes back
// into the content shape in data/sample/content.json. The sample is cleaned the same way.

import { defaultSettings } from '../config.js';
import { parseLocalDateTime, sameDay } from './time.js';
import { fixSettingValues, visibleItems, withDefaults } from './content.js';

// Everything the screen needs, in one request. Lists come back in the order
// they were created, and normalizeContent puts the ones with an Order first.
// Sanity leaves out a list the editors have emptied, which would bring the
// default list back, so coalesce hands over an empty list instead. A Done
// task with no Finished on date counts as finished when it was last edited.
export const contentQuery = `{
  "settings": *[_id == "dashboardSettings"][0] {
    ...,
    "rotation": rotation { ..., "grid1": coalesce(grid1, []), "grid2": coalesce(grid2, []) },
    "announcements": coalesce(announcements, []),
    "calendars": coalesce(calendars, [])
  },
  "tasks": *[_type == "task"] | order(_createdAt asc) {
    ...,
    "subteam": subteam->name,
    "finishedOn": coalesce(finishedOn, _updatedAt)
  },
  "sponsors": *[_type == "sponsor"] | order(_createdAt asc),
  "tipsAndNews": *[_type == "tipOrNews"] | order(_createdAt asc),
  "subteams": *[_type == "subteam"] | order(_createdAt asc),
  "people": *[_type == "person"] | order(_createdAt asc),
  "plans": *[_type == "plan"] | order(date asc, _createdAt asc),
  "customPanels": *[_type == "customPanel"] | order(_createdAt asc)
}`;

const requestSeconds = 15;

// sanity is { projectId, dataset, apiVersion } from config.js. The ordinary
// host is used, not the cached one, so a change shows at once.
export function queryUrl(sanity) {
  return 'https://' + sanity.projectId + '.api.sanity.io/v' + sanity.apiVersion +
    '/data/query/' + sanity.dataset +
    '?query=' + encodeURIComponent(contentQuery) +
    '&perspective=published';
}

// The stream that says "something changed"
export function liveEventsUrl(sanity) {
  return 'https://' + sanity.projectId + '.api.sanity.io/v' + sanity.apiVersion +
    '/data/live/events/' + sanity.dataset;
}

// Asks Sanity for everything and returns the query result as it came.
// Throws when the answer cannot be used, so the caller keeps what it has.
export async function fetchResult(sanity) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestSeconds * 1000);

  try {
    const response = await fetch(queryUrl(sanity), { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Sanity answered with status ' + response.status);

    const body = await response.json();
    if (!body || typeof body.result !== 'object' || body.result === null) {
      throw new Error('Sanity sent no result');
    }
    return body.result;
  } finally {
    clearTimeout(timer);
  }
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
    tasks: itemsFrom(data.tasks),
    plan: firstShowingPlan(data.plans, now),
    sponsors: itemsFrom(data.sponsors),
    tipsAndNews: itemsFrom(data.tipsAndNews),
    subteams: itemsFrom(data.subteams),
    people: itemsFrom(data.people),
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

  ['tasks', 'sponsors', 'tipsAndNews', 'subteams', 'people', 'customPanels'].forEach(name => {
    content[name] = itemsFrom(data[name]);
  });
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

  // The choices, switches and numbers in a range are checked in content.js
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
