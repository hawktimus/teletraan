// The query for the content, the addresses and the fetch from Sanity (part of sanity.js).

import { classifyFailure } from './connection.js';

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
// The FRC data (frc-status) is one document that the Mini writes. It is sent as it is and
// core/frc.js cleans it. No document means no competition cards.
// The board status (monday-status) is one document that the Mini writes. Only the sync time and the
// daily counts of open items are asked for, and core/monday.js cleans them. No document means the
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
  "subthemes": *[_type == "subtheme"] | order(_createdAt asc) { name, enabled, start, end, priority, "assets": assets[] { slot, "url": image.asset->url }, rules },
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
  "monday": *[_id == "monday-status"][0] { lastSyncAt, lastError, "snapshots": coalesce(snapshots, []) },
  "mini": *[_id == "status-mini"][0] { lastCalendarSyncAt }
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
