// Which documents the Control page edits from the Studio schemas, which of their fields it leaves out and why, and which tab
// and section each field sits in. schema-spec.js reads this. A field the plan does not name is drawn as the schema describes
// it, so a new field of the Studio shows up on the Control page by itself; tests/schema-spec.test.mjs fails when a field is
// neither drawn nor listed as skipped.
//
// The names are stored names and none is changed here.

import { sections as lookSections } from '../inputs/look-parts.js';
import { fieldNames as competitionNames } from '../inputs/competition-parts.js';
import { newsNames } from '../inputs/news-parts.js';

export const settingsId = 'dashboardSettings';
export const lookId = 'theme';
export const viewIds = ['view-general', 'view-prime', 'view-nova', 'view-family'];

const displayTab = 'The Display tab owns it.';
const motionCard = 'The Motion card of the Display tab owns it.';
const rebootCard = 'The Scheduled reboot card owns it.';
const cleanupCard = 'The Clean up expired items card owns it.';
const oneTime = 'A one-time request that a button writes (the Control page or the Studio). It is not a setting.';

// Dashboard Settings: the fields other cards or buttons own, and the ones that are not settings at all
const settingsSkip = {
  rotationRows: displayTab,
  themeByWeekday: displayTab,
  generalViewTitle: displayTab,
  transitionSeconds: displayTab,
  motion: motionCard,
  motionOnKiosk: 'Not used any more. Every computer plays the Motion setting. The stored value is kept and ignored.',
  rebootEnabled: rebootCard,
  rebootTime: rebootCard,
  rebootDays: rebootCard,
  rebootSkipBusy: rebootCard,
  rebootWaitMinutes: rebootCard,
  cleanupEnabled: cleanupCard,
  cleanupDeleteAfterDays: cleanupCard,
  cleanupMode: cleanupCard,
  rebootStatus: 'A status line that the Teletraan computer fills in. It is not a setting.',
  miniStatus: 'The status of the Teletraan computer, written by the Mini. It is not a setting.',
  holdPanel: oneTime,
  holdRow: oneTime,
  showView: oneTime,
  previewTheme: oneTime,
  pauseRotation: oneTime,
  previewRequest: oneTime,
  nextLookRequest: oneTime,
  competitionPreviewRequest: oneTime,
  announceRequest: oneTime,
  presentationTestRequest: oneTime,
  hiddenRequest: oneTime,
  team: 'A fallback used only while no team is saved. The name, number and colors of a team are edited under Teams.',
};

// The tabs of Dashboard Settings on the Control page. The first five are the tabs of the Studio form; Look, Competition,
// Photos and Today are pages of the Studio that show fields the form hides, so they get a tab here too.
const settingsTabs = [
  { id: 'screen', title: 'Timing', says: 'How long a page stays up, how long a finished task stays, the safety days and the parts request address.' },
  { id: 'look', title: 'Look', says: 'The look of the screen: speed, frame polish, logo and name effects, page changes and the screen glitch.' },
  { id: 'photos', title: 'Photos', says: 'The photo panel and the portraits of people.' },
  { id: 'countdown', title: 'Countdown', says: 'The countdown counts to Kickoff first, then to Rollout.' },
  { id: 'calendars', title: 'Calendars', says: 'Name each team calendar, say what kind it is and choose which ones show events.' },
  { id: 'monday', title: 'Monday', says: 'How often the boards are read and which columns hold what.' },
  { id: 'competition', title: 'Competition', says: 'When the competition cards come and the FRC news.' },
  { id: 'today', title: 'Today', says: 'The alert and the announcements that play at set times.' },
  { id: 'advanced', title: 'Advanced', says: 'Night mode, presentations, hidden transitions and the things set once.' },
];

// Which Look page section holds each field of Dashboard Settings
const lookSectionOf = {};
lookSections.forEach(section => {
  (section.fields || []).forEach(name => { lookSectionOf[name.split('.')[0]] = section.title; });
});
lookSectionOf.background = 'Background';

const photoNames = ['photoOrder', 'photoSource', 'photoDriveFolder', 'photoSeconds', 'portraitScale', 'photoScale', 'photoFit', 'leadershipPortrait', 'rosterPortrait', 'portraitShape', 'portraitFrame'];

function placeSettings(field) {
  if (lookSectionOf[field.name] && field.name !== 'motion') return { tab: 'look', section: lookSectionOf[field.name] };
  if (photoNames.includes(field.name)) return { tab: 'photos', section: field.fieldset === 'portraits' ? 'Portraits' : 'Photo panel' };
  if (competitionNames.includes(field.name)) return { tab: 'competition', section: 'Competition cards' };
  if (newsNames.includes(field.name)) return { tab: 'competition', section: 'FRC news' };
  if (field.name === 'alert' || field.name === 'announcements') return { tab: 'today' };
  return null;
}

const viewSkip = {
  key: 'The word that says which view this is. It is set when the view is made.',
  title: 'The name of the view, set when it is made.',
  sidePanels: 'The rows of small panels are edited on the Rotation board in the Studio.',
};

// The Studio hides these for the views they do not apply to (schemas/view.js)
const viewOnlyFor = {
  team: ['view-prime', 'view-nova'],
  layout: ['view-prime', 'view-nova', 'view-family'],
};

const subthemeSkip = {
  assets: 'Pictures are uploaded in the Studio.',
};

export const plan = {
  documents: [
    { id: settingsId, type: 'dashboardSettings', mode: 'singleton', title: 'Dashboard Settings', says: 'The one settings page of the screen.', tabs: settingsTabs, skip: settingsSkip, place: placeSettings },
    { id: lookId, type: 'theme', mode: 'singleton', title: 'Look rules', says: 'Dated rules for themes and seasonal packs, the time zone and the default theme.' },
    { type: 'view', mode: 'fixed', ids: viewIds, title: 'Views', says: 'The arrangement of each view: General, Prime, Nova and Family.', skip: viewSkip, onlyFor: viewOnlyFor },
    { type: 'team', mode: 'list', title: 'Teams', says: 'Name, number, colors, metal, glow, mirror and trim of each team.', skip: { palette: 'Not set by editors. Inverted is the Nova palette.' } },
    { type: 'customPanel', mode: 'list', title: 'Extra panels', says: 'The panels built from blocks.' },
    { type: 'subtheme', mode: 'list', title: 'Subthemes', says: 'Small pictures drawn on the frames between two dates.', skip: subthemeSkip },
    // Collections are content, edited in blocks of the Content tab (control/routes/collection-doc.js), not on the All settings page
    { type: 'tipOrNews', mode: 'collection', title: 'Ticker lines', says: 'The tips, news and reminders on the ticker.' },
    { type: 'rosterPerson', mode: 'collection', title: 'Roster', says: 'First names with a role and a team.' },
    // The existing people of the wall. The Studio calls the type person Leadership and the type subteam Team leads.
    { type: 'person', mode: 'collection', title: 'Leadership', says: 'The leadership list of the wall: name, role, team.' },
    { type: 'subteam', mode: 'collection', title: 'Team leads', says: 'The subteam leads of the wall, with their members.' },
    { type: 'announcement', mode: 'collection', title: 'Announcements', says: 'The line on the bar under the banner, between a start and an end.' },
    { type: 'photo', mode: 'collection', title: 'Photos', says: 'The photos of the Photo panel. The picture itself is added by an upload.', skip: { image: 'The picture is added by Add photo on the Content tab, or in the Studio. It is never replaced here.' } },
  ],
};

// Types the Control page does not edit, with the reason. The drift test lists them so that none is left out by accident.
export const leftOut = {
  task: 'Tasks are written by the Monday sync. Only the Show on TV switch changes, in the Studio.',
  plan: 'The daily agenda is content for the Studio.',
  presentationDay: 'Meeting days are content for the Studio.',
  presentation: 'Talks come from the booking form.',
  extraEvent: 'Not read by the screen.',
  calendarFilter: 'Calendar filters are content for the Studio.',
  sponsor: 'Sponsors have pictures and are content for the Studio.',
  place: 'Not read by the screen.',
  screen: 'The old Screens are stored for seeding only. The screen reads the views.',
  demo: 'Demo content is not shown on the screen.',
  status: 'Written by the Teletraan computer.',
  calendarStatus: 'Written by the Teletraan computer.',
  frcStatus: 'Written by the Teletraan computer.',
  frcNews: 'Written by the Teletraan computer.',
  mondayStatus: 'Written by the Teletraan computer.',
  milestone: 'Written by the Monday sync.',
};
