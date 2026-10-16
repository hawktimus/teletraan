// The Countdown tab field of Dashboard Settings.

import { defineField } from 'sanity';
import { tooLong } from './fields.js';

// The same labels as defaultSettings.countdown in dashboard/config.js. The
// kickoff time is 12:00 noon in Holly Springs (17:00 UTC in January). A title
// is never cut off on the screen: over 28 characters it takes a second line
// (dashboard/core/countdown-title.js), and over 40 it would not fit even at
// the smallest size it is set in.
const titleWarning = 'Long titles wrap to two lines on the screen.';
export const countdownField = defineField({
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
      description: 'The title on the countdown while it counts to Kickoff, for example GAMEDROP. Over 28 characters wrap to two lines, and up to 40 fit.',
      initialValue: 'KICKOFF IN',
      validation: Rule => [Rule.max(28).warning(titleWarning), tooLong(Rule, 40)],
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
      description: 'The title on the countdown while it counts to Rollout. Over 28 characters wrap to two lines, and up to 40 fit.',
      initialValue: 'ROLLOUT IN',
      validation: Rule => [Rule.max(28).warning(titleWarning), tooLong(Rule, 40)],
    }),
    defineField({
      name: 'rollout',
      title: 'Rollout date and time',
      type: 'datetime',
      description: 'When Rollout is. Leave empty until the date is known.',
    }),
  ],
});

