// The one settings page for the whole screen. It is a single document with the
// fixed id 'dashboardSettings' (see structure.js).

import { defineType, defineField, defineArrayMember } from 'sanity';
import { tooLong } from './fields.js';
import { rotationField } from './settingsRotation.js';
import { announcementsField } from './settingsAnnouncements.js';

const groups = [
  { name: 'screen', title: 'Screen' },
  { name: 'countdown', title: 'Countdown' },
  { name: 'alert', title: 'Alert' },
  { name: 'panels', title: 'Panels' },
  { name: 'announcements', title: 'Announcements' },
  { name: 'calendars', title: 'Calendars' },
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

const motionField = defineField({
  name: 'motion',
  title: 'Motion',
  type: 'string',
  group: 'screen',
  description: 'Full plays all the movement. Calm only fades panels in and out, with no turning, glint or name effect.',
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
  description: 'The metal on the frame edges. Gold is warm antique brass, Silver is weathered steel.',
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

const nameTransformField = defineField({
  name: 'nameTransform',
  title: 'Name effect',
  type: 'boolean',
  group: 'screen',
  description: 'Now and then each letter of the team name splits apart, turns and locks back together. Turn it off to keep the name still.',
  initialValue: true,
});

const nameEveryField = defineField({
  name: 'nameEvery',
  title: 'Name effect every (seconds)',
  type: 'number',
  group: 'screen',
  description: 'How often the team name splits apart and locks back together, from 30 to 900 seconds.',
  initialValue: 300,
  validation: Rule => [
    Rule.required().error('Enter the number of seconds.'),
    Rule.integer().min(30).max(900).error('Use a whole number from 30 to 900.'),
  ],
});

const crtField = defineField({
  name: 'crt',
  title: 'Old TV effect',
  type: 'object',
  group: 'screen',
  description: 'A short old television effect that plays now and then across the screen.',
  fields: [
    defineField({
      name: 'on',
      title: 'Play the effect',
      type: 'boolean',
      description: 'Turn this off to stop the effect.',
      initialValue: true,
    }),
    defineField({
      name: 'everyMinutes',
      title: 'Minutes between plays',
      type: 'number',
      description: 'How often it plays, from 1 to 60 minutes.',
      initialValue: 4,
      validation: Rule => [
        Rule.required().error('Enter the number of minutes.'),
        Rule.integer().min(1).max(60).error('Use a whole number from 1 to 60.'),
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
    nameTransformField,
    nameEveryField,
    countdownField,
    alertField,
    pageSecondsField,
    rotationField(),
    doneDaysField,
    safetyDaysField,
    crtField,
    announcementsField(),
    calendarsField,
  ],
  preview: {
    prepare: () => ({ title: 'Dashboard Settings' }),
  },
});
