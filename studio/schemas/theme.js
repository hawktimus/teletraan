// The look of the screen, in one document with the fixed id 'theme' (see
// structure.js). The dashboard reads it with the rest of the content and works
// out the theme and overlay in dashboard/core/theme.js. The starting values are
// the same as defaultThemeSettings in dashboard/config.js.
//
// The lists of themes and overlays come from ../themes.js, a copy of the
// dashboard's registries that check-schemas.mjs keeps in step.
//
// The editors see an overlay as a "seasonal pack": its accent colours and,
// for most of them, decorations along the edges of the screen
// (docs/seasonal-packs.md). Only the titles and descriptions say so. The names
// and stored values stay overlay and 'overlay', so nothing already saved changes.

import { defineType, defineField, defineArrayMember } from 'sanity';
import { tooLong } from './fields.js';
import { themes, overlays } from '../themes.js';

const themeChoices = themes.map(theme => ({ title: theme.name, value: theme.id }));
const overlayChoices = overlays.map(overlay => ({ title: overlay.name, value: overlay.id }));

// "No seasonal pack" is for Use a theme now only: it hides the pack the schedule would show
const noOverlay = { title: 'No seasonal pack', value: 'none' };

const kinds = [
  { title: 'Theme', value: 'theme' },
  { title: 'Seasonal pack', value: 'overlay' },
];

function ids(choices) {
  return choices.map(choice => choice.value);
}

// A time zone name Intl knows, such as America/New_York. Browsers that cannot
// list the names get a plain check of the shape of the name instead.
const zoneShape = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;
const zoneMessage = 'Use a time zone name such as America/New_York.';

function knownTimeZone(value) {
  if (!value) return true;

  if (typeof Intl.supportedValuesOf === 'function') {
    const known = Intl.supportedValuesOf('timeZone');
    return known.indexOf(value) !== -1 || value === 'UTC' || zoneMessage;
  }
  return zoneShape.test(value) || zoneMessage;
}

// A rule names the theme or the overlay, by its kind. The one that does not
// match the kind is hidden, and is not asked for.
function pickedFor(kind, message) {
  return (value, context) => {
    const parent = context.parent || {};
    return parent.kind === kind && !value ? message : true;
  };
}

// A rule that does not repeat needs an end that is not before its start.
// One that repeats may end before it starts: it runs over New Year.
function endsBeforeStart(rule) {
  if (!rule || rule.repeatsEveryYear || !rule.startDate || !rule.endDate) return true;
  return rule.endDate >= rule.startDate || 'The end date is before the start date. Turn on Repeats every year if the rule runs over New Year.';
}

const defaultThemeField = defineField({
  name: 'defaultTheme',
  title: 'Default theme',
  type: 'string',
  description: 'The look when Use a theme now and the schedule below say nothing. Neon Prime has a sidebar and no small frame, and reloads the screen once.',
  options: { list: themeChoices },
  initialValue: 'hawktimus',
  validation: Rule => [
    Rule.required().error('Pick a default theme.'),
    Rule.valid(ids(themeChoices)).error('Pick a theme from the list.'),
  ],
});

const useNowField = defineField({
  name: 'useNow',
  title: 'Use a theme now',
  type: 'object',
  description: 'Show a theme or a seasonal pack at once. This wins over the schedule. Leave a part empty to let the schedule decide it.',
  fields: [
    defineField({
      name: 'theme',
      title: 'Theme',
      type: 'string',
      description: 'Optional. The theme to show now. Leave empty to follow the schedule. Neon Prime has a sidebar and no small frame, and reloads the screen once.',
      options: { list: themeChoices },
      validation: Rule => Rule.valid(ids(themeChoices)).error('Pick a theme from the list.'),
    }),
    defineField({
      name: 'overlay',
      title: 'Seasonal pack',
      type: 'string',
      description: 'Optional. The pack to show now (its accent colours and decorations), or No seasonal pack to hide the scheduled one. Leave empty to follow the schedule.',
      options: { list: overlayChoices.concat([noOverlay]) },
      validation: Rule => Rule.valid(ids(overlayChoices).concat([noOverlay.value])).error('Pick a seasonal pack from the list.'),
    }),
    defineField({
      name: 'until',
      title: 'Until',
      type: 'datetime',
      description: 'Optional. Use a theme now stops at this time. Leave empty to keep it until you change it.',
      validation: Rule => Rule.min('2020-01-01T00:00:00Z').max('2099-12-31T23:59:00Z').error('Pick a time between the years 2020 and 2099.'),
    }),
  ],
});

const ruleMember = defineArrayMember({
  type: 'object',
  name: 'rule',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'What the rule is for, such as a holiday or an event. Only editors see it. Up to 24 characters.',
      validation: Rule => [Rule.required().error('Add a name.'), tooLong(Rule, 24)],
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      description: 'A theme rule changes the whole look. A seasonal pack rule changes the accent colours and adds decorations along the edges of the screen.',
      options: { list: kinds, layout: 'radio', direction: 'horizontal' },
      initialValue: 'theme',
      validation: Rule => [
        Rule.required().error('Pick a theme or a seasonal pack.'),
        Rule.valid(ids(kinds)).error('Pick a theme or a seasonal pack.'),
      ],
    }),
    defineField({
      name: 'theme',
      title: 'Theme',
      type: 'string',
      description: 'The theme to show on these dates. Neon Prime has a sidebar and no small frame, and reloads the screen once.',
      options: { list: themeChoices },
      hidden: ({ parent }) => !parent || parent.kind !== 'theme',
      validation: Rule => [
        Rule.custom(pickedFor('theme', 'Pick a theme.')),
        Rule.valid(ids(themeChoices)).error('Pick a theme from the list.'),
      ],
    }),
    defineField({
      name: 'overlay',
      title: 'Seasonal pack',
      type: 'string',
      description: 'The seasonal pack to show on these dates: its accent colours and its decorations.',
      options: { list: overlayChoices },
      hidden: ({ parent }) => !parent || parent.kind !== 'overlay',
      validation: Rule => [
        Rule.custom(pickedFor('overlay', 'Pick a seasonal pack.')),
        Rule.valid(ids(overlayChoices)).error('Pick a seasonal pack from the list.'),
      ],
    }),
    defineField({
      name: 'startDate',
      title: 'Start date',
      type: 'date',
      description: 'The first day the rule applies. It counts as part of the rule.',
      validation: Rule => [
        Rule.required().error('Add a start date.'),
        Rule.min('2020-01-01').max('2099-12-31').error('Pick a date between the years 2020 and 2099.'),
      ],
    }),
    defineField({
      name: 'endDate',
      title: 'End date',
      type: 'date',
      description: 'The last day the rule applies. It counts as part of the rule. With Repeats every year on, an end before the start runs over New Year.',
      validation: Rule => [
        Rule.required().error('Add an end date.'),
        Rule.min('2020-01-01').max('2099-12-31').error('Pick a date between the years 2020 and 2099.'),
      ],
    }),
    defineField({
      name: 'repeatsEveryYear',
      title: 'Repeats every year',
      type: 'boolean',
      description: 'On: only the month and day count, every year. Off: the rule applies once, on the exact dates.',
      initialValue: false,
    }),
  ],
  validation: Rule => Rule.custom(endsBeforeStart),
  preview: {
    select: { title: 'name', kind: 'kind', theme: 'theme', overlay: 'overlay', start: 'startDate', end: 'endDate' },
    prepare(rule) {
      const picked = rule.kind === 'overlay' ? rule.overlay : rule.theme;
      const dates = rule.start && rule.end ? rule.start + ' to ' + rule.end : '';
      return {
        title: rule.title || 'Rule with no name',
        subtitle: [rule.kind === 'overlay' ? 'Seasonal pack' : 'Theme', picked, dates].filter(Boolean).join(' · '),
      };
    },
  },
});

const scheduleField = defineField({
  name: 'schedule',
  title: 'Schedule',
  type: 'array',
  description: 'Rules that change the theme or add a seasonal pack on certain dates. For each kind, the first rule that covers today is used.',
  of: [ruleMember],
  validation: Rule => Rule.max(24).error('Too many rules. Up to 24 fit.'),
});

const timeZoneField = defineField({
  name: 'timeZone',
  title: 'Time zone',
  type: 'string',
  description: 'The time zone the schedule dates are read in, such as America/New_York. Up to 40 characters.',
  initialValue: 'America/New_York',
  validation: Rule => [
    Rule.required().error('Add a time zone.'),
    tooLong(Rule, 40),
    Rule.custom(knownTimeZone),
  ],
});

const seasonOverPanelsField = defineField({
  name: 'seasonOverPanels',
  title: 'Seasonal pieces over the panels',
  type: 'boolean',
  description: 'On: snow, leaves and other small pieces of a seasonal pack drift over the panels. Off: only its header pictures and edge decorations show.',
  initialValue: true,
});

export default defineType({
  name: 'theme',
  title: 'Theme',
  type: 'document',
  fields: [defaultThemeField, useNowField, scheduleField, timeZoneField, seasonOverPanelsField],
});
