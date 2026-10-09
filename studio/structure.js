// The sidebar. To change the order, move a line in sidebarEntries below.
// Calendar events are not edited here: they come from the team's BAND
// calendars. The Events Calendar list is for the events that are not on BAND.
//
// One line is one entry:
//   kind 'list'     opens the list of one kind of document (type). With a filter it
//                   lists only the documents the filter keeps, and needs an id of its own
//   kind 'page'     opens the one document of its type, which has a fixed id
//   kind 'group'    opens a list of lists, with its lines under entries
//   kind 'divider'  a thin line between groups
// A new kind of document needs a line here: check-schemas.mjs fails without it.

// Pages that exist once. Each is a single document with a fixed id.
export const settingsType = 'dashboardSettings';
export const settingsId = 'dashboardSettings';
export const themeType = 'theme';
export const themeId = 'theme';
export const demoType = 'demo';
export const demoId = 'demo';
export const singletonTypes = [settingsType, themeType, demoType];

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// How a list is sorted when it opens
const byOrder = { field: 'order', direction: 'asc' };
const byStartDate = { field: 'startDate', direction: 'asc' };
const byName = { field: 'name', direction: 'asc' };
const newestDateFirst = { field: 'date', direction: 'desc' };
const newestUploadFirst = { field: '_createdAt', direction: 'desc' };
const byFirstTalk = { field: 'firstSlotAt', direction: 'asc' };
const soonestStart = { field: 'start', direction: 'asc' };
const latestStart = { field: 'start', direction: 'desc' };

// What a filter keeps. $since is a day ago, worked out when the sidebar opens in
// structure() below: Studio keeps a list live, and a live filter cannot use now().
// Both are UTC text, so comparing them as text compares the times. A talk with
// no start yet stays under Upcoming, so it can still be found.
const startedRecently = '!defined(start) || start >= $since';
const startedEarlier = 'defined(start) && start < $since';

export const sidebarEntries = [
  { kind: 'list', title: 'Tasks', type: 'task', sort: byOrder },
  { kind: 'list', title: 'Up Next', type: 'plan', sort: newestDateFirst },
  {
    kind: 'group',
    title: 'Presentations',
    id: 'presentations',
    entries: [
      { kind: 'list', title: 'Meeting days', type: 'presentationDay', sort: byFirstTalk },
      { kind: 'list', title: 'Upcoming talks', id: 'upcomingTalks', type: 'presentation', sort: soonestStart, filter: startedRecently },
      { kind: 'list', title: 'Past talks', id: 'pastTalks', type: 'presentation', sort: latestStart, filter: startedEarlier },
    ],
  },
  { kind: 'list', title: 'Events Calendar', type: 'extraEvent', sort: byStartDate },
  { kind: 'list', title: 'Calendar filters', type: 'calendarFilter', sort: byName },
  { kind: 'list', title: 'Subteams', type: 'subteam', sort: byOrder },
  { kind: 'list', title: 'Leadership', type: 'person', sort: byOrder },
  { kind: 'list', title: 'Teams', type: 'team', sort: byOrder },
  { kind: 'list', title: 'Sponsors', type: 'sponsor', sort: byOrder },
  { kind: 'list', title: 'Photos', type: 'photo', sort: newestUploadFirst },
  { kind: 'list', title: 'Tips and News', type: 'tipOrNews', sort: byOrder },
  { kind: 'list', title: 'Custom Panels', type: 'customPanel', sort: byOrder },
  { kind: 'divider' },
  { kind: 'page', title: 'Dashboard Settings', type: settingsType, id: settingsId },
  { kind: 'page', title: 'Theme', type: themeType, id: themeId },
  { kind: 'list', title: 'Places', type: 'place', sort: byName },
  { kind: 'page', title: 'Demo', type: demoType, id: demoId },
];

// A sidebar entry that opens the list of one kind of document
function listOf(S, entry, since) {
  const id = entry.id || entry.type;
  let list = S.documentTypeList(entry.type).title(entry.title).defaultOrdering([entry.sort]);
  if (entry.filter) {
    list = list
      .id(id)
      .apiVersion(apiVersion)
      .filter('_type == $type && (' + entry.filter + ')')
      .params({ type: entry.type, since: since });
  }
  return S.listItem().title(entry.title).id(id).child(list);
}

// A sidebar entry that opens a list of the lists under it
function groupOf(S, entry, since) {
  return S.listItem()
    .title(entry.title)
    .id(entry.id)
    .child(
      S.list()
        .title(entry.title)
        .id(entry.id)
        .items(entry.entries.map(inner => itemFor(S, inner, since)))
    );
}

// A sidebar entry that opens the one document of its type
function pageOf(S, entry) {
  return S.listItem()
    .title(entry.title)
    .id(entry.id)
    .child(
      S.document()
        .title(entry.title)
        .schemaType(entry.type)
        .documentId(entry.id)
    );
}

function itemFor(S, entry, since) {
  if (entry.kind === 'divider') return S.divider();
  if (entry.kind === 'list') return listOf(S, entry, since);
  if (entry.kind === 'group') return groupOf(S, entry, since);
  if (entry.kind === 'page') return pageOf(S, entry);
  throw new Error('structure.js: "' + entry.kind + '" is not a kind of sidebar entry. Use list, page, group or divider.');
}

export function structure(S) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return S.list()
    .title('Teletraan I')
    .items(sidebarEntries.map(entry => itemFor(S, entry, since)));
}
