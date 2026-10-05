// The sidebar. Calendar events are not edited here: they come from the team's
// BAND calendars. Extra events are for the ones that are not on BAND.

// Pages that exist once. Each is a single document with a fixed id.
export const settingsType = 'dashboardSettings';
export const settingsId = 'dashboardSettings';
export const themeType = 'theme';
export const themeId = 'theme';
export const demoType = 'demo';
export const demoId = 'demo';
export const singletonTypes = [settingsType, themeType, demoType];

// A sidebar entry that opens the list of one kind of content
function listOf(S, title, type, ordering) {
  return S.listItem()
    .title(title)
    .id(type)
    .child(S.documentTypeList(type).title(title).defaultOrdering([ordering]));
}

// A sidebar entry that opens the one document of its type
function pageOf(S, title, type, id) {
  return S.listItem()
    .title(title)
    .id(id)
    .child(
      S.document()
        .title(title)
        .schemaType(type)
        .documentId(id)
    );
}

const byOrder = { field: 'order', direction: 'asc' };

export function structure(S) {
  return S.list()
    .title('Teletraan I')
    .items([
      listOf(S, 'Tasks', 'task', byOrder),
      listOf(S, "Tonight's Plan", 'plan', { field: 'date', direction: 'desc' }),
      listOf(S, 'Extra events', 'extraEvent', { field: 'startDate', direction: 'asc' }),
      listOf(S, 'Sponsors', 'sponsor', byOrder),
      listOf(S, 'Tips and News', 'tipOrNews', byOrder),
      listOf(S, 'Subteams', 'subteam', byOrder),
      listOf(S, 'Leadership', 'person', byOrder),
      listOf(S, 'Photos', 'photo', { field: '_createdAt', direction: 'desc' }),
      listOf(S, 'Custom Panels', 'customPanel', byOrder),
      pageOf(S, 'Dashboard Settings', settingsType, settingsId),
      pageOf(S, 'Theme', themeType, themeId),
      pageOf(S, 'Demo', demoType, demoId),
    ]);
}
