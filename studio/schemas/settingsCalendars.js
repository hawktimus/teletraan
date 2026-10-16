// The Calendars tab fields of Dashboard Settings: the list of BAND calendars and the grouping of events.

import { defineField, defineArrayMember } from 'sanity';
import { tooLong } from './fields.js';

// The Mini saves CALENDAR_BUILD_SEASON_URL as build_season.ics, so a code
// that is not lowercase letters, digits and underscores never finds its file
const calendarCode = /^[a-z0-9_]+$/;

// The values are the names in calendarKinds in dashboard/config.js. Other was the starting value once, so
// the screen counts it as no kind and gives its events no chip. It stays in the list so that a calendar saved
// as other is still valid, and it is the way to put a kind back to none.
const calendarKinds = [
  { title: 'Meetings', value: 'meetings' },
  { title: 'Competitions', value: 'competitions' },
  { title: 'Outreach', value: 'outreach' },
  { title: 'Deadlines', value: 'deadlines' },
  { title: 'Other (no chip)', value: 'other' },
];

// The same row as defaultSettings.calendars in dashboard/config.js. It has no kind: a calendar has none until
// somebody picks one.
export const calendarsField = defineField({
  name: 'calendars',
  title: 'Calendars',
  type: 'array',
  group: 'calendars',
  description: 'Name each team calendar, say what kind it is and choose which ones show events on the screen.',
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
          name: 'kind',
          title: 'Kind',
          type: 'string',
          description: 'Pick a kind to show a chip on each event from this calendar. Leave it blank for no chip.',
          options: { list: calendarKinds, layout: 'radio', direction: 'horizontal' },
          validation: Rule => Rule.valid(calendarKinds.map(kind => kind.value)).error('Pick meetings, competitions, outreach, deadlines or other.'),
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
        select: { title: 'name', code: 'id', show: 'show', kind: 'kind' },
        prepare(calendar) {
          const kind = calendarKinds.filter(item => item.value === calendar.kind).map(item => item.title)[0] || 'No chip';
          const subtitle = [calendar.show === false ? 'Hidden' : '', calendar.code, kind].filter(Boolean).join(' · ');
          return { title: calendar.title || 'Calendar with no name', subtitle: subtitle };
        },
      },
    }),
  ],
});

// The same starting value as defaultSettings.groupEventsByKind in dashboard/config.js
export const groupEventsByKindField = defineField({
  name: 'groupEventsByKind',
  title: 'Group events by kind',
  type: 'boolean',
  group: 'calendars',
  description: 'Off: both Events pages go in date order. On: page one has Meetings, Deadlines and Other, page two Competitions and Outreach.',
  initialValue: false,
});

