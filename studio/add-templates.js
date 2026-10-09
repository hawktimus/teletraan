// What the plus button of a folder or a list makes. A template is a new document of one
// type with the starting values of its group: no team, so it shows for every team, the
// switch that puts it on the screen turned on and, for a tip, the kind set. A line of
// sidebarEntries in structure.js names a template in its add. sanity.config.js gives the
// templates to the Studio and keeps them out of the New menus, so only the line that
// names one offers it. Every type already has a plain template with its own name, so a
// template here needs an id of its own. check-schemas.mjs fails when a list has no template,
// when a template makes another type than its list shows, or when a value is not a field.

export const addTemplates = [
  { id: 'newPlan', title: 'Agenda item', schemaType: 'plan', value: { show: true } },
  { id: 'newPresentation', title: 'Presentation', schemaType: 'presentation', value: { status: 'scheduled' } },
  { id: 'newPresentationDay', title: 'Meeting day', schemaType: 'presentationDay', value: { open: true } },
  { id: 'pinnedTask', title: 'Pin a task', schemaType: 'task', value: { source: 'manual', showOnTv: true, show: true, status: 'up-next' } },
  { id: 'newTip', title: 'Tip', schemaType: 'tipOrNews', value: { kind: 'tip', show: true } },
  { id: 'newCalendarFilter', title: 'Calendar filter', schemaType: 'calendarFilter', value: { show: true } },
  { id: 'newPerson', title: 'Person', schemaType: 'person', value: { show: true } },
  { id: 'newSubteam', title: 'Team lead', schemaType: 'subteam', value: { show: true } },
  { id: 'newSponsor', title: 'Sponsor', schemaType: 'sponsor', value: { show: true } },
  { id: 'newPhoto', title: 'Photo', schemaType: 'photo', value: { show: true } },
];
