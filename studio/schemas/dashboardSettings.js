// The one settings page for the whole screen. It is a single document with the
// fixed id 'dashboardSettings' (see structure.js).

import { defineType, defineField, defineArrayMember } from 'sanity';
import { neverOrAtLeast, tooLong } from './fields.js';
import { rotationField } from './settingsRotation.js';
import { announcementsField, announceRequestField } from './settingsAnnouncements.js';
import { logoFields, logoGroup } from './settingsLogo.js';
import { transitionsFields, transitionsGroup } from './settingsTransitions.js';
import { photosFields, photosGroup } from './settingsPhotos.js';
import { nightFields, nightGroup } from './settingsNight.js';
import { hiddenFields, hiddenGroup } from './settingsHidden.js';

const groups = [
  { name: 'screen', title: 'Screen' },
  logoGroup,
  transitionsGroup,
  { name: 'countdown', title: 'Countdown' },
  { name: 'alert', title: 'Alert' },
  { name: 'panels', title: 'Panels' },
  photosGroup,
  { name: 'announcements', title: 'Announcements' },
  nightGroup,
  hiddenGroup,
  { name: 'calendars', title: 'Calendars' },
  { name: 'source', title: 'Content source' },
  { name: 'connection', title: 'Connection' },
];

// The values are the names in contentSources in dashboard/config.js
const contentSources = [
  { title: 'Production', value: 'production' },
  { title: 'Sample', value: 'sample' },
];

const motions = [
  { title: 'Full', value: 'full' },
  { title: 'Calm', value: 'calm' },
];

// The values are the names in metals in dashboard/config.js
const metals = [
  { title: 'Gold', value: 'gold' },
  { title: 'Silver', value: 'silver' },
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
  description: 'The team details shown in the banner at the top of the screen.',
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

// The "Use sample content" and "Use production content" buttons (actions.js)
// set this field and publish. The dashboard reads it first, before anything
// else, and follows it while it runs. The starting value is the same as
// defaultSettings.contentSource in dashboard/config.js.
const contentSourceField = defineField({
  name: 'contentSource',
  title: 'Content source',
  type: 'string',
  group: 'source',
  description: 'Production shows the content you publish here. Sample shows made-up content with a SAMPLE CONTENT label, for trying things out.',
  options: { list: contentSources, layout: 'radio', direction: 'horizontal' },
  initialValue: 'production',
  validation: Rule => [
    Rule.required().error('Pick production or sample.'),
    Rule.valid(contentSources.map(source => source.value)).error('Pick production or sample.'),
  ],
});

// A time that has gone already makes the screen show production straight away
function hasPassed(value, context) {
  const onSample = context.document && context.document.contentSource === 'sample';
  if (onSample && value && new Date(value) <= new Date()) return 'This time has already passed, so the screen shows production.';
  return true;
}

const switchBackAtField = defineField({
  name: 'switchBackAt',
  title: 'Switch back to production at',
  type: 'datetime',
  group: 'source',
  description: 'Optional. While the source is Sample, the screen goes back to production at this time. Leave empty to stay on sample until you switch it.',
  validation: Rule => [
    Rule.min('2020-01-01T00:00:00Z').max('2099-12-31T23:59:00Z').error('Pick a time between the years 2020 and 2099.'),
    Rule.custom(hasPassed).warning(),
  ],
});

// The same starting value as defaultSettings.showConnectionStatus in
// dashboard/config.js. The text comes up by itself when Sanity cannot be
// reached, whatever this says (dashboard/core/connection.js).
const showConnectionStatusField = defineField({
  name: 'showConnectionStatus',
  title: 'Show connection status',
  type: 'boolean',
  group: 'connection',
  description: 'Keeps a small text at the bottom right with the last Sanity read, the item counts and the calendar read time. It always shows when Sanity is unreachable.',
  initialValue: false,
});

const motionField = defineField({
  name: 'motion',
  title: 'Motion',
  type: 'string',
  group: 'screen',
  description: 'Full plays all the movement. Calm only fades panels in and out, with no turning, glint, logo animations, name effect or screen glitch.',
  options: { list: motions, layout: 'radio', direction: 'horizontal' },
  initialValue: 'full',
  validation: Rule => Rule.required().error('Pick full or calm.'),
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
  description: 'The metal of the banner, countdown and logo edges. Gold is warm antique brass, Silver is weathered steel. Page frames follow Frame finish (Transitions tab).',
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
  description: 'A bright spark runs once around each frame every few seconds. Turn it off for a calmer screen.',
  initialValue: true,
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

// The same labels as defaultSettings.countdown in dashboard/config.js. The
// kickoff time is 12:00 noon in Holly Springs (17:00 UTC in January).
const countdownField = defineField({
  name: 'countdown',
  title: 'Countdown',
  type: 'object',
  group: 'countdown',
  description: 'The countdown on the screen counts to Kickoff first, then to Rollout.',
  fields: [
    defineField({
      name: 'kickoffLabel',
      title: 'Kickoff label',
      type: 'string',
      description: 'The words shown while counting to Kickoff. Up to 12 characters fit.',
      initialValue: 'KICKOFF IN',
      validation: Rule => tooLong(Rule, 12),
    }),
    defineField({
      name: 'kickoff',
      title: 'Kickoff date and time',
      type: 'datetime',
      description: 'When Kickoff starts. Once it has passed, the countdown moves on to Rollout.',
      initialValue: '2027-01-09T17:00:00.000Z',
    }),
    defineField({
      name: 'rolloutLabel',
      title: 'Rollout label',
      type: 'string',
      description: 'The words shown while counting to Rollout. Up to 12 characters fit.',
      initialValue: 'ROLLOUT IN',
      validation: Rule => tooLong(Rule, 12),
    }),
    defineField({
      name: 'rollout',
      title: 'Rollout date and time',
      type: 'datetime',
      description: 'When Rollout is. Leave empty until the date is known.',
    }),
  ],
});

const alertField = defineField({
  name: 'alert',
  title: 'Alert',
  type: 'object',
  group: 'alert',
  description: 'A message that covers the whole screen until you turn it off.',
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

// A row in the Panels lists, or the ticker, can have seconds of its own. With
// none it follows this. The small panel and ticker times are worked out from it
// as described at defaultSettings in dashboard/config.js.
const pageSecondsField = defineField({
  name: 'pageSeconds',
  title: 'Seconds per page',
  type: 'number',
  group: 'panels',
  description: 'How long each page stays up when it has no seconds of its own. The small panel stays three quarters as long and the ticker one and a half times as long.',
  initialValue: 20,
  validation: Rule => [
    Rule.required().error('Enter the number of seconds.'),
    Rule.integer().min(8).max(120).error('Use a whole number from 8 to 120.'),
  ],
});

const doneDaysField = defineField({
  name: 'doneDays',
  title: 'Days finished tasks stay',
  type: 'number',
  group: 'panels',
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
  group: 'panels',
  description: 'The date the safety day count starts from. The Safety Days panel counts the days since this date.',
});

// The Mini saves CALENDAR_BUILD_SEASON_URL as build_season.ics, so a code
// that is not lowercase letters, digits and underscores never finds its file
const calendarCode = /^[a-z0-9_]+$/;

// The same row as defaultSettings.calendars in dashboard/config.js
const calendarsField = defineField({
  name: 'calendars',
  title: 'Calendars',
  type: 'array',
  group: 'calendars',
  description: 'Name each team calendar and choose which ones show events on the screen.',
  initialValue: [{ id: 'team', name: 'Team calendar', show: true }],
  of: [
    defineArrayMember({
      type: 'object',
      title: 'Calendar',
      fields: [
        defineField({
          name: 'id',
          title: 'Calendar code',
          type: 'string',
          description: 'The code of the calendar on the Mini, in lowercase. Do not change it unless you were told to. Up to 20 characters.',
          validation: Rule => [
            Rule.required().error('Enter the calendar code.'),
            tooLong(Rule, 20),
            Rule.regex(calendarCode, { name: 'lowercase code' }).error('Use lowercase letters, digits and underscores only, such as team.'),
          ],
        }),
        defineField({
          name: 'name',
          title: 'Calendar name',
          type: 'string',
          description: 'A name people will recognise. Up to 20 characters.',
          validation: Rule => [Rule.required().error('Give the calendar a name.'), tooLong(Rule, 20)],
        }),
        defineField({
          name: 'show',
          title: 'Show on screen',
          type: 'boolean',
          description: 'Turn this off to leave this calendar out of the events on the screen.',
          initialValue: true,
        }),
      ],
      preview: {
        select: { title: 'name', code: 'id', show: 'show' },
        prepare(calendar) {
          const subtitle = [calendar.show === false ? 'Hidden' : '', calendar.code].filter(Boolean).join(' · ');
          return { title: calendar.title || 'Calendar with no name', subtitle: subtitle };
        },
      },
    }),
  ],
});

export default defineType({
  name: 'dashboardSettings',
  title: 'Dashboard Settings',
  type: 'document',
  groups: groups,
  fields: [
    teamField,
    motionField,
    speedField,
    frameMetalField,
    glintField,
    crtField,
    ...logoFields(),
    ...transitionsFields(),
    countdownField,
    alertField,
    pageSecondsField,
    rotationField(),
    doneDaysField,
    safetyDaysField,
    ...photosFields(),
    announcementsField(),
    announceRequestField(),
    ...nightFields(),
    ...hiddenFields(),
    calendarsField,
    contentSourceField,
    switchBackAtField,
    showConnectionStatusField,
  ],
  preview: {
    prepare: () => ({ title: 'Dashboard Settings' }),
  },
});
