// What the plus button of a folder or a list makes. A template is a new document of one
// type with the starting values of its group: no team, so it shows for every team, the
// switch that puts it on the screen turned on and, for a tip, the kind set. A line of
// sidebarEntries in structure.js names a template in its add. sanity.config.js gives the
// templates to the Studio and keeps them out of the New menus, so only the line that
// names one offers it. Every type already has a plain template with its own name, so a
// template here needs an id of its own. tests/schemas.test.mjs fails when a list has no template,
// when a template makes another type than its list shows, or when a value is not a field.

// A new announcement starts now and ends in two hours, which is what the Post an announcement button on
// Start here and the plus button of Announcements both make. The value is a function, so the times are
// those of the click and not those of the day the Studio loaded.
export function announcementStart(now = Date.now()) {
  return { level: 'notice', start: new Date(now).toISOString(), end: new Date(now + 2 * 60 * 60 * 1000).toISOString() };
}

export const addTemplates = [
  { id: 'newPlan', title: 'Agenda item', schemaType: 'plan', value: { show: true } },
  { id: 'newPresentation', title: 'Presentation', schemaType: 'presentation', value: { status: 'scheduled' } },
  { id: 'newPresentationDay', title: 'Meeting day', schemaType: 'presentationDay', value: { open: true } },
  { id: 'newTip', title: 'Tip', schemaType: 'tipOrNews', value: { kind: 'tip', show: true } },
  { id: 'newAnnouncement', title: 'Announcement', schemaType: 'announcement', value: () => announcementStart() },
  { id: 'newCalendarFilter', title: 'Calendar filter', schemaType: 'calendarFilter', value: { show: true } },
  { id: 'newSubtheme', title: 'Subtheme', schemaType: 'subtheme', value: { enabled: true } },
  { id: 'newPerson', title: 'Person', schemaType: 'person', value: { show: true } },
  { id: 'newSubteam', title: 'Team lead', schemaType: 'subteam', value: { show: true } },
  { id: 'newSponsor', title: 'Sponsor', schemaType: 'sponsor', value: { show: true } },
  { id: 'newPhoto', title: 'Photo', schemaType: 'photo', value: { show: true } },
];
