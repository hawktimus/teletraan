// The one settings page for the whole screen. It is a single document with the
// fixed id 'dashboardSettings' (see structure.js).

import { defineType, defineField } from 'sanity';
import { neverOrAtLeast, noteField, tooLong } from './fields.js';
import { statusBlockField } from './settingsStatus.js';
import { rotationField } from './settingsRotation.js';
import { announcementsField, announceRequestField } from './settingsAnnouncements.js';
import { logoFields } from './settingsLogo.js';
import { transitionsFields } from './settingsTransitions.js';
import { photosFields, portraitFieldsets } from './settingsPhotos.js';
import { nightFields } from './settingsNight.js';
import { rebootFields } from './settingsReboot.js';
import { hiddenFields } from './settingsHidden.js';
import { presentationsFields, presentationTestRequestField } from './settingsPresentations.js';
import { teamsFields } from './settingsTeams.js';
import { lookScheduleFields } from './settingsLook.js';
import { viewsFields } from './settingsViews.js';
import { rotationRowsFields } from './settingsRotationRows.js';
import { backgroundFields } from './settingsBackground.js';
import { previewRequestField } from './settingsPreview.js';
import { nextLookRequestField, competitionPreviewRequestField, screenRequestFields } from './settingsRequests.js';
import { competitionFields } from './settingsCompetition.js';
import { newsFields } from './settingsNews.js';
import { mondayFields } from './settingsMonday.js';
import { calendarsField, groupEventsByKindField } from './settingsCalendars.js';
import { countdownField } from './settingsCountdown.js';
import { settingsNames as shownOnLookPage } from '../inputs/look-parts.js';
import { settingsNames as shownOnCompetitionPage } from '../inputs/competition-parts.js';
import { newsNames as shownOnNewsSection } from '../inputs/news-parts.js';

// The five tabs, in order. Timing opens first. Studio has no folded tab, so Advanced, for the things that are set
// once and never touched again, is the last one. The look of the screen is on the Look page, the alert and the
// messages on the Today page, the competition cards on the Competition page, and the teams under Teams and views.
const groups = [
  { name: 'screen', title: 'Timing', default: true },
  { name: 'countdown', title: 'Countdown' },
  { name: 'monday', title: 'Monday' },
  { name: 'calendars', title: 'Calendars' },
  { name: 'advanced', title: 'Advanced' },
];

// A field of a tab that is gone is moved to Advanced (they are all hidden or set once), keeping its stored name
const tabOf = { look: 'advanced', presentations: 'advanced', competition: 'advanced' };

// The sections of the Timing and Advanced tabs. A section is a fieldset with one line that says what it holds.
const open = { collapsible: true, collapsed: false };
const sectionFieldsets = [
  { name: 'timing', title: 'Timing', description: 'How long a page stays up, how long a finished task stays, the safety days and the parts request address.', options: open },
  { name: 'banner', title: 'Banner', description: 'The big title across the banner while the Robotics rows play.', options: open },
  { name: 'presentations', title: 'Presentations', description: 'Booked talks take the whole screen at their start time. Turn them off to keep the screen as it is.', options: open },
  { name: 'night', title: 'Night mode', description: 'The screen at night, from 23:30 to 11:30: a bouncing logo or a dark screen.', options: open },
  { name: 'reboot', title: 'Scheduled reboot', description: 'Reboot the Teletraan computer at a time of day. The control page, Settings, shows the same values.', options: open },
  { name: 'hiddenTransitions', title: 'Hidden transitions', description: 'The desktop reveal and the red eyes, which come about once every few hours of screen time.', options: open },
  { name: 'other', title: 'Other', description: 'The connection text at the bottom of the screen, and fields kept for the older versions.', options: open },
];

// Which section a field is in, by its stored name
const sectionOf = {};
['pageSeconds', 'rotation', 'doneDays', 'safetyDaysSince', 'partsRequestUrl'].forEach(name => { sectionOf[name] = 'timing'; });
sectionOf.generalViewTitle = 'banner';
presentationsFields().concat([presentationTestRequestField()]).forEach(field => { sectionOf[field.name] = 'presentations'; });
nightFields().forEach(field => { sectionOf[field.name] = 'night'; });
rebootFields().forEach(field => { sectionOf[field.name] = 'reboot'; });
hiddenFields().forEach(field => { sectionOf[field.name] = 'hiddenTransitions'; });
['rotationRows', 'showConnectionStatus', 'contentSource'].forEach(name => { sectionOf[name] = 'other'; });

const motions = [
  { title: 'Full', value: 'full' },
  { title: 'Light', value: 'light' },
  { title: 'Calm', value: 'calm' },
];

// The values are the names in kioskMotions in dashboard/config.js
const kioskMotions = [
  { title: 'Light', value: 'light' },
  { title: 'Full', value: 'full' },
];

// The values are the names in metals in dashboard/config.js
const metals = [
  { title: 'Gold', value: 'gold' },
  { title: 'Silver', value: 'silver' },
];

// The values are the names in looks in dashboard/config.js
const looks = [
  { title: 'Polished (as now)', value: 'polished' },
  { title: 'Flat', value: 'flat' },
  { title: 'Plain', value: 'plain' },
];

// The values are the names in styles in dashboard/config.js
const styles = [
  { title: 'Original', value: 'original' },
  { title: 'Cybertron', value: 'cybertron' },
  { title: 'Minimal', value: 'minimal' },
];

// The values are the names in speeds in dashboard/config.js
const speeds = [
  { title: 'Very slow', value: 'very-slow' },
  { title: 'Slow', value: 'slow' },
  { title: 'Normal', value: 'normal' },
  { title: 'Fast', value: 'fast' },
];

// The same values as defaultTeam in dashboard/config.js
const teamField = defineField({
  name: 'team',
  title: 'Team',
  type: 'object',
  group: 'screen',
  hidden: true,
  description: 'Used only while no team is saved. The name, number and colors of each team are on its page under Teams and views.',
  fields: [
    defineField({
      name: 'name',
      title: 'Team name',
      type: 'string',
      description: 'Shown large in the banner. Up to 16 characters fit.',
      initialValue: 'HAWKTIMUS PRIME',
      validation: Rule => [Rule.required().error('Add the team name.'), tooLong(Rule, 16)],
    }),
    defineField({
      name: 'number',
      title: 'Team number',
      type: 'string',
      description: 'Digits only. Up to 5 characters fit.',
      initialValue: '3229',
      validation: Rule => [
        Rule.required().error('Add the team number.'),
        tooLong(Rule, 5),
        Rule.regex(/^\d+$/, { name: 'digits' }).error('Use digits only.'),
      ],
    }),
    defineField({
      name: 'school',
      title: 'School',
      type: 'string',
      description: 'Shown small in the banner. Up to 30 characters fit.',
      initialValue: 'HOLLY SPRINGS HIGH SCHOOL',
      validation: Rule => tooLong(Rule, 30),
    }),
  ],
});

// Content source is kept so that nothing already saved changes, but it is hidden and the
// screen ignores it: it always shows what the editors published. The made-up content is
// reached with ?sample=1 on the dashboard address (dashboard/core/source.js). It is not
// required, because nobody can fill in a hidden field.
const contentSources = [
  { title: 'Production', value: 'production' },
  { title: 'Sample', value: 'sample' },
];

const contentSourceField = defineField({
  name: 'contentSource',
  title: 'Content source',
  type: 'string',
  group: 'advanced',
  hidden: true,
  description: 'Not used any more. The screen always shows the content you publish here. Add ?sample=1 to its address to see made-up content.',
  options: { list: contentSources, layout: 'radio', direction: 'horizontal' },
  initialValue: 'production',
  validation: Rule => Rule.valid(contentSources.map(source => source.value)).error('Pick production or sample.'),
});

// The same starting value as defaultSettings.showConnectionStatus in
// dashboard/config.js. The text comes up by itself when Sanity cannot be
// reached, whatever this says (dashboard/core/connection.js).
const showConnectionStatusField = defineField({
  name: 'showConnectionStatus',
  title: 'Show connection status',
  type: 'boolean',
  group: 'advanced',
  description: 'Keeps a small text at the bottom right with the last Sanity read, the item counts and the calendar read time. It always shows when Sanity is unreachable.',
  initialValue: false,
});

// The look of the whole screen until a Screen has chosen the style, which is when it starts without saved content.
// It is hidden, and the value saved in it stays. The
// starting value is the same as defaultSettings.style in dashboard/config.js. dashboard/core/style.js turns the
// choice into the page switch the stylesheets read and into a layout: Minimal has the bar layout whatever the
// theme says, and Original and Cybertron have the layout of the theme. It is not required: Dashboard Settings
// published before this field existed has no style, which the screen reads as Original, and a required field
// would stop that page being published (an alert too) until somebody picked one.
const styleField = defineField({
  name: 'style',
  title: 'Style',
  type: 'string',
  group: 'look',
  hidden: true,
  description: 'Not used any more. Was: Original, Cybertron steel plates, or Minimal, whatever the theme. Themes and views choose the look now.',
  options: { list: styles, layout: 'radio', direction: 'horizontal' },
  initialValue: 'original',
  validation: Rule => Rule.valid(styles.map(style => style.value)).error('Pick original, cybertron or minimal.'),
});

const motionField = defineField({
  name: 'motion',
  title: 'Motion',
  type: 'string',
  group: 'screen',
  description: 'Full plays every movement. Light plays one simple change at each panel and view change and keeps the idle sweeps still. Calm only fades.',
  options: { list: motions, layout: 'radio', direction: 'horizontal' },
  initialValue: 'full',
  validation: Rule => Rule.required().error('Pick full, light or calm.'),
});

const motionOnKioskField = defineField({
  name: 'motionOnKiosk',
  title: 'Motion on the TV computer',
  type: 'string',
  group: 'screen',
  description: 'The TV computer plays Light even when Motion says Full, so that it does not freeze. Choose Full here only to try the full transitions on a spare computer.',
  options: { list: kioskMotions, layout: 'radio', direction: 'horizontal' },
  initialValue: 'light',
  validation: Rule => Rule.required().error('Pick light or full.'),
});

const speedField = defineField({
  name: 'speed',
  title: 'Speed',
  type: 'string',
  group: 'screen',
  description: 'How fast things move and how long each panel stays. Slow makes everything take longer, Fast makes it quicker. Normal is the standard speed.',
  options: { list: speeds, layout: 'radio', direction: 'horizontal' },
  initialValue: 'normal',
  validation: Rule => [
    Rule.required().error('Pick a speed.'),
    Rule.valid(speeds.map(speed => speed.value)).error('Pick very slow, slow, normal or fast.'),
  ],
});

const frameMetalField = defineField({
  name: 'frameMetal',
  title: 'Frame metal',
  type: 'string',
  group: 'screen',
  description: 'The metal of the banner, countdown and logo edges. Gold is warm antique brass, Silver is weathered steel. Page frames follow Frame finish, in the same section.',
  options: { list: metals, layout: 'radio', direction: 'horizontal' },
  initialValue: 'gold',
  validation: Rule => [
    Rule.required().error('Pick gold or silver.'),
    Rule.valid(metals.map(metal => metal.value)).error('Pick gold or silver.'),
  ],
});

const glintField = defineField({
  name: 'glint',
  title: 'Glint',
  type: 'boolean',
  group: 'screen',
  description: 'A bright spark runs once around each frame every few seconds. Turn it off for a calmer screen. Flat and Plain (Polish) have none.',
  initialValue: true,
});

// How much polish the frames have. The starting value is the same as
// defaultSettings.look in dashboard/config.js. dashboard/core/look.js turns the
// choice into the switches the stylesheets read. It is not required: Dashboard
// Settings published before this field existed has no look, which the screen
// reads as Polished, and a required field would stop that page being published
// (an alert too) until somebody picked one.
const lookField = defineField({
  name: 'look',
  title: 'Polish',
  type: 'string',
  group: 'screen',
  description: 'Polished is the default. Flat has plain edges and no glint. Plain also has no screws or // marks in headers. Flat and Plain are lighter on the computer.',
  options: { list: looks, layout: 'radio', direction: 'horizontal' },
  initialValue: 'polished',
  validation: Rule => Rule.valid(looks.map(look => look.value)).error('Pick polished, flat or plain.'),
});

// The screen glitch is in the Screen tab. The seconds between glitches can be
// 0, which means never, or 30 or more. The starting values are the same as
// defaultSettings.crt in dashboard/config.js: the glitch lasts 2.7 seconds today.
const crtField = defineField({
  name: 'crt',
  title: 'Screen glitch',
  type: 'object',
  group: 'screen',
  description: 'A short old television glitch that plays across the whole screen now and then. Calm motion never plays it.',
  fields: [
    defineField({
      name: 'on',
      title: 'Play the glitch',
      type: 'boolean',
      description: 'Turn this off to stop the glitch.',
      initialValue: true,
    }),
    defineField({
      name: 'everySeconds',
      title: 'Seconds between glitches',
      type: 'number',
      description: 'How often it plays, from 30 to 3600 seconds. Use 0 to never play it.',
      initialValue: 240,
      validation: Rule => [
        Rule.required().error('Enter the number of seconds, or 0 for never.'),
        Rule.integer().min(0).max(3600).error('Use 0 for never, or a whole number from 30 to 3600.'),
        Rule.custom(neverOrAtLeast(30)),
      ],
    }),
    defineField({
      name: 'durationSeconds',
      title: 'Glitch duration (seconds)',
      type: 'number',
      description: 'How long one glitch lasts, from 0.5 to 10 seconds, at Normal speed.',
      initialValue: 2.7,
      validation: Rule => [
        Rule.required().error('Enter the number of seconds.'),
        Rule.min(0.5).max(10).error('Use a number from 0.5 to 10.'),
      ],
    }),
  ],
});

const alertField = defineField({
  name: 'alert',
  title: 'Alert',
  type: 'object',
  group: 'screen',
  hidden: true,
  description: 'Set on the Today page, in the sidebar. A message that covers the whole screen until you turn it off.',
  fields: [
    defineField({
      name: 'on',
      title: 'Alert is on',
      type: 'boolean',
      description: 'Turn this on to cover the screen with the alert. Turn it off to take it down.',
      initialValue: false,
    }),
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
      description: 'The big words of the alert. Up to 24 characters fit.',
      validation: Rule => tooLong(Rule, 24),
    }),
    defineField({
      name: 'message',
      title: 'Message',
      type: 'text',
      rows: 3,
      description: 'The details under the headline. Up to 90 characters fit.',
      validation: Rule => tooLong(Rule, 90),
    }),
    defineField({
      name: 'until',
      title: 'Take down at',
      type: 'datetime',
      description: 'Optional. The alert takes itself down at this time. Leave empty to keep it up until you turn it off.',
    }),
  ],
});

// A row of a Screen, or the ticker, can have seconds of its own. With
// none it follows this. The small panel and ticker times are worked out from it
// as described at defaultSettings in dashboard/config.js.
const pageSecondsField = defineField({
  name: 'pageSeconds',
  title: 'Seconds per page',
  type: 'number',
  group: 'screen',
  description: 'How long each page stays up when it has no seconds of its own. The small panel stays three quarters as long and the ticker one and a half times as long.',
  initialValue: 20,
  validation: Rule => [
    Rule.required().error('Enter the number of seconds.'),
    Rule.integer().min(8).max(120).error('Use a whole number from 8 to 120.'),
  ],
});

const partsRequestUrlField = defineField({
  name: 'partsRequestUrl',
  title: 'Parts request address',
  type: 'string',
  group: 'screen',
  description: 'The address the Parts request QR code opens. Start with https://, 200 characters at most. Empty shows LINK NOT SET.',
  validation: Rule => Rule.max(200).error('Use 200 characters or fewer.').custom(value => (value === undefined || value === '' || /^https:\/\/\S+$/i.test(value) ? true : 'Start with https:// and use no spaces.')),
});

const doneDaysField = defineField({
  name: 'doneDays',
  title: 'Days finished tasks stay',
  type: 'number',
  group: 'screen',
  description: 'How many days a finished task stays on the Tasks panel, from 1 to 30.',
  initialValue: 7,
  validation: Rule => [
    Rule.required().error('Enter the number of days.'),
    Rule.integer().min(1).max(30).error('Use a whole number from 1 to 30.'),
  ],
});

const safetyDaysField = defineField({
  name: 'safetyDaysSince',
  title: 'Safety days start',
  type: 'date',
  group: 'screen',
  description: 'The date the safety day count starts from. The Safety Days panel counts the days since this date.',
});

// The two notes are hidden: they pointed at the pages that the Look page replaced.
const lookNoteField = noteField('lookNote', 'The theme of each day, the background, the motion, the logo and the seasonal packs are on the Look page, in the sidebar.', 'look');
const cycleNoteField = noteField('cycleNote', 'What plays, and in which order, is the Rotation page in the sidebar. A view holds its small panels and its arrangement in Views, under Teams and views.', 'look');

// The Look page (inputs/look-view.js) shows these fields, so the form does not: hidden, with the stored values kept.
// The two notes only pointed at the pages that the Look page replaced.
// The Competition page shows the competition cards. The Rotation page is the only door to the rotation list (its full
// form is kept, hidden). The Team section is hidden and kept as the fallback.
// The Photos page picks the photo source and the Drive folder, so the form does not.
const movedToPages = shownOnLookPage.concat(['lookNote', 'cycleNote'], shownOnCompetitionPage, shownOnNewsSection, ['rotationRows', 'photoSource', 'photoDriveFolder']);

function moved(field) {
  return movedToPages.indexOf(field.name) === -1 ? field : Object.assign({}, field, { hidden: true });
}

function placed(field) {
  const next = Object.assign({}, field);
  if (tabOf[next.group]) next.group = tabOf[next.group];
  if (next.name === 'generalViewTitle') next.group = 'screen';
  if (sectionOf[next.name]) next.fieldset = sectionOf[next.name];
  return next;
}

export default defineType({
  name: 'dashboardSettings',
  title: 'Dashboard Settings',
  type: 'document',
  groups: groups,
  fieldsets: portraitFieldsets.concat(sectionFieldsets),
  fields: [
    statusBlockField(),
    teamField,
    lookNoteField,
    cycleNoteField,
    ...viewsFields(),
    ...backgroundFields(),
    ...lookScheduleFields(),
    styleField,
    motionField,
    motionOnKioskField,
    speedField,
    frameMetalField,
    glintField,
    lookField,
    crtField,
    previewRequestField(),
    nextLookRequestField(),
    competitionPreviewRequestField(),
    ...screenRequestFields(),
    ...teamsFields(),
    ...logoFields(),
    ...transitionsFields(),
    countdownField,
    alertField,
    pageSecondsField,
    partsRequestUrlField,
    rotationField(),
    doneDaysField,
    safetyDaysField,
    ...photosFields(),
    announcementsField(),
    announceRequestField(),
    ...presentationsFields(),
    presentationTestRequestField(),
    ...nightFields(),
    ...rebootFields(),
    ...hiddenFields(),
    calendarsField,
    groupEventsByKindField,
    ...mondayFields(),
    ...competitionFields(),
    ...newsFields(),
    ...rotationRowsFields(),
    contentSourceField,
    showConnectionStatusField,
  ].map(moved).map(placed),
  preview: {
    prepare: () => ({ title: 'Dashboard Settings' }),
  },
});
