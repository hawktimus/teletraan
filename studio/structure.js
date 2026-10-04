// The sidebar. Events are not here: they come from the team's BAND calendars.

export const settingsType = 'dashboardSettings';
export const settingsId = 'dashboardSettings';

// A sidebar entry that opens the list of one kind of content
function listOf(S, title, type, ordering) {
  return S.listItem()
    .title(title)
    .id(type)
    .child(S.documentTypeList(type).title(title).defaultOrdering([ordering]));
}

const byOrder = { field: 'order', direction: 'asc' };

export function structure(S) {
  return S.list()
    .title('Teletraan I')
    .items([
      listOf(S, 'Tasks', 'task', byOrder),
      listOf(S, "Tonight's Plan", 'plan', { field: 'date', direction: 'desc' }),
      listOf(S, 'Sponsors', 'sponsor', byOrder),
      listOf(S, 'Tips and News', 'tipOrNews', byOrder),
      listOf(S, 'Subteams', 'subteam', byOrder),
      listOf(S, 'Leadership', 'person', byOrder),
      listOf(S, 'Custom Panels', 'customPanel', byOrder),
      S.listItem()
        .title('Dashboard Settings')
        .id(settingsId)
        .child(
          S.document()
            .title('Dashboard Settings')
            .schemaType(settingsType)
            .documentId(settingsId)
        ),
    ]);
}
