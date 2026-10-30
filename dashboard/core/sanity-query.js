// The query for the content, the address of the query and the read of the local snapshot (part of sanity.js).
//
// The screen does not ask Sanity. The sync service of the Teletraan computer (computer/scripts/sync-service.mjs) asks it with
// contentQuery and writes the answer to data/live/content.json, and this file reads that file from the same server. The
// sync service uses queryUrl and contentQuery from here, so the question is written once.

import { liveFolder } from '../config.js';

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
// The Demo document is read with the rest too, and its changes reach the screen within seconds,
// so a click on Run demo shows quickly.
// No Demo document means no demo (core/demo.js).
// Events come from the BAND calendars (core/calendar.js). The Events Calendar
// entries in Studio are not read.
// The three Screens are sent with the ids that say which style each one is, and their rows as lists. A Screen
// that is missing, or whose list of rows is empty, is built from the Panel order (core/screens.js).
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
// The FRC data (frc-status) is one document that the Teletraan computer writes. It is sent as it is and
// core/frc.js cleans it. No document means no competition cards.
// The FRC news (frc-news) is one document that the Teletraan computer writes: the newest headlines of the FIRST blog, with
// a title, a date, categories and an address, and never the text of an article. core/news.js cleans it. No document means the
// FRC news panel has nothing to show.
// The board status (monday-status) is one document that the Teletraan computer writes. Only the sync time, the last error, the
// daily counts of open items and the list of projects are asked for, and core/monday.js cleans them. No document means the
// progress card has no line to draw. The tasks from the board come with the other tasks, above, and
// normalizeContent keeps only those (core/task-source.js).
export const contentQuery = `{
  "settings": *[_id == "dashboardSettings"][0] {
    ...,
    "rotation": rotation { ..., "grid1": coalesce(grid1, []), "grid2": coalesce(grid2, []) },
    "announcements": coalesce(announcements, []),
    "calendars": coalesce(calendars, [])
  },
  "theme": *[_id == "theme"][0],
  "demo": *[_id == "demo"][0],
  "tasks": *[_type == "task"] | order(_createdAt asc) {
    ...,
    "subteam": subteam->name,
    "subteamId": subteam._ref,
    "location": location->name,
    "locationShown": location->show != false,
    "team": team->code,
    "finishedOn": coalesce(finishedOn, _updatedAt)
  },
  "milestones": *[_type == "milestone" && show != false] | order(targetDate asc) {
    "id": _id,
    name,
    targetDate,
    status,
    "team": team->code,
    "subteamId": subteam._ref
  },
  "sponsors": *[_type == "sponsor"] | order(_createdAt asc) { ..., "team": team->code },
  "tipsAndNews": *[_type == "tipOrNews"] | order(_createdAt asc) { ..., "team": team->code },
  "notices": *[_type == "announcement"] | order(start asc) { _id, text, start, end, level, "team": team->code },
  "subteams": *[_type == "subteam"] | order(_createdAt asc) {
    ...,
    "id": _id,
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
    fit,
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
  "subthemes": *[_type == "subtheme"] | order(_createdAt asc) { name, enabled, start, end, priority, preset, "assets": assets[] { slot, "url": image.asset->url }, rules },
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
  "screens": *[_type == "screen"] | order(_id asc) {
    _id,
    "mainRows": coalesce(mainRows, []),
    "sideRows": coalesce(sideRows, []),
    nameEffectEveryMinutes,
    hawkEveryMinutes,
    swapSeconds,
    mondayStyle
  },
  "views": *[_type == "view"] | order(_id asc) {
    _id,
    title,
    "team": coalesce(team->code, team),
    layout,
    mirror,
    countdownIn,
    viewTag,
    teamChip,
    colors,
    minutes,
    "panels": coalesce(panels, []),
    "sidePanels": coalesce(sidePanels, [])
  },
  "frc": *[_id == "frc-status"][0],
  "news": *[_id == "frc-news"][0] { lastSyncAt, lastError, "items": coalesce(items, []) [] { title, link, date, categories, systemcore } },
  "monday": *[_id == "monday-status"][0] { lastSyncAt, lastError, "snapshots": coalesce(snapshots, []), "projects": coalesce(projects, []) },
  "mini": *[_id == "status-mini"][0] { lastCalendarSyncAt }
}`;

export const contentFile = liveFolder + 'content.json';
export const imageIndexFile = liveFolder + 'images/index.json';

const requestSeconds = 15;

// sanity is { projectId, dataset, apiVersion } from config.js. The ordinary host is used, not the cached one, so a
// change shows at once. base replaces the host, which is how a test of the sync service points at a fake.
export function addressOf(sanity, query, base) {
  return (base || 'https://' + sanity.projectId + '.api.sanity.io') + '/v' + sanity.apiVersion +
    '/data/query/' + sanity.dataset +
    '?query=' + encodeURIComponent(query) +
    '&perspective=published';
}

export function queryUrl(sanity, base) {
  return addressOf(sanity, contentQuery, base);
}

// The text of a file of the data folder, or a thrown error. The error has no words for the screen: callers keep what they
// have and log it (nothing here is ever drawn).
export async function fetchLocalText(file, seconds = requestSeconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), seconds * 1000);

  try {
    const response = await fetch(file, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('The file ' + file + ' answered ' + response.status);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

// What the content file holds: { syncedAt, result }, where result is the answer of contentQuery. Throws when the text is
// not that, so the caller keeps what it has.
export function resultOf(text) {
  const body = JSON.parse(text);
  if (!body || typeof body.result !== 'object' || body.result === null || Array.isArray(body.result)) {
    throw new Error('The content file has no result');
  }
  return body.result;
}

// Reads the content snapshot and returns the query result as the sync service got it
export async function fetchResult() {
  return resultOf(await fetchLocalText(contentFile));
}
