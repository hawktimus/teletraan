// The sidebar. To change the order, move a line in sidebarEntries below.
// Calendar events are not edited here: they come from the team's BAND
// calendars. The Events Calendar list is for the events that are not on BAND.
//
// One line is one entry:
//   kind 'list'     opens the list of one kind of document (type)
//   kind 'page'     opens the one document of its type, which has a fixed id
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

// How a list is sorted when it opens
const byOrder = { field: 'order', direction: 'asc' };
const byStartDate = { field: 'startDate', direction: 'asc' };
const byName = { field: 'name', direction: 'asc' };
const newestDateFirst = { field: 'date', direction: 'desc' };
const newestUploadFirst = { field: '_createdAt', direction: 'desc' };

export const sidebarEntries = [
  { kind: 'list', title: 'Tasks', type: 'task', sort: byOrder },
  { kind: 'list', title: "Tonight's Plan", type: 'plan', sort: newestDateFirst },
  { kind: 'list', title: 'Events Calendar', type: 'extraEvent', sort: byStartDate },
  { kind: 'list', title: 'Subteams', type: 'subteam', sort: byOrder },
  { kind: 'list', title: 'Leadership', type: 'person', sort: byOrder },
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
function listOf(S, entry) {
  return S.listItem()
    .title(entry.title)
    .id(entry.type)
    .child(S.documentTypeList(entry.type).title(entry.title).defaultOrdering([entry.sort]));
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

function itemFor(S, entry) {
  if (entry.kind === 'divider') return S.divider();
  if (entry.kind === 'list') return listOf(S, entry);
  if (entry.kind === 'page') return pageOf(S, entry);
  throw new Error('structure.js: "' + entry.kind + '" is not a kind of sidebar entry. Use list, page or divider.');
}

export function structure(S) {
  return S.list()
    .title('Teletraan I')
    .items(sidebarEntries.map(entry => itemFor(S, entry)));
}
