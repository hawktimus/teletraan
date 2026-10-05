// An entry in the Events Calendar list: an event that is not on the BAND
// calendars. The dashboard merges these with the BAND events in core/events.js,
// sorts them by start, and drops each one once its last day has passed. No
// start time means an all-day event, which shows its date and no time. The
// type is still called extraEvent, which is what is stored in Sanity.
//
// There is no Hide after field: the dashboard drops a finished event itself.

import { defineType, defineField } from 'sanity';
import { showField, tooLong, subtitleFor } from './fields.js';

// 24 hour time with two digits for the hour and for the minutes
const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

const earliestDay = '2020-01-01';
const latestDay = '2099-12-31';
const dayMessage = 'Pick a date between the years 2020 and 2099.';

// The end date may be empty. When it is there it may not come before the start date.
function endsAfterStart(value, context) {
  const start = context.document && context.document.startDate;
  if (!value || !start) return true;
  return value >= start || 'The end date is before the start date.';
}

// The end time needs a start time, and on a one day event it may not come before it
function timeIsPossible(value, context) {
  const event = context.document || {};
  if (!value) return true;
  if (!event.startTime) return 'Add a start time first, or clear the end time.';

  const oneDay = !event.endDate || event.endDate === event.startDate;
  return !oneDay || value >= event.startTime || 'The end time is before the start time.';
}

// The list shows the dates, then the start time, and says when an event is over
function whenText(item) {
  const range = item.endDate && item.endDate !== item.startDate ? item.startDate + ' to ' + item.endDate : item.startDate;
  return [range, item.startTime].filter(Boolean).join(' ');
}

function isOver(item) {
  const last = item.endDate || item.startDate;
  return Boolean(last) && last < new Date().toISOString().slice(0, 10);
}

export default defineType({
  name: 'extraEvent',
  title: 'Events Calendar',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Event name',
      type: 'string',
      description: 'What the event is called on the screen. Up to 30 characters fit.',
      validation: Rule => [Rule.required().error('Give the event a name.'), tooLong(Rule, 30)],
    }),
    defineField({
      name: 'startDate',
      title: 'Start date',
      type: 'date',
      description: 'The first day of the event.',
      validation: Rule => [
        Rule.required().error('Pick the start date.'),
        Rule.min(earliestDay).max(latestDay).error(dayMessage),
      ],
    }),
    defineField({
      name: 'endDate',
      title: 'End date',
      type: 'date',
      description: 'Optional. The last day, for an event that lasts more than one day. Leave empty for one day.',
      validation: Rule => [
        Rule.min(earliestDay).max(latestDay).error(dayMessage),
        Rule.custom(endsAfterStart),
      ],
    }),
    defineField({
      name: 'startTime',
      title: 'Start time',
      type: 'string',
      description: 'Optional. 24 hour time with two digits, such as 18:30. Leave empty for an all-day event, which shows the date only.',
      validation: Rule => Rule.regex(timeFormat, { name: '24 hour time' }).error('Use 24 hour time with two digits, such as 18:30.'),
    }),
    defineField({
      name: 'endTime',
      title: 'End time',
      type: 'string',
      description: 'Optional. 24 hour time with two digits, such as 20:00. It needs a start time.',
      validation: Rule => [
        Rule.regex(timeFormat, { name: '24 hour time' }).error('Use 24 hour time with two digits, such as 20:00.'),
        Rule.custom(timeIsPossible),
      ],
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
      description: 'Optional. Where the event is. Up to 24 characters fit.',
      validation: Rule => tooLong(Rule, 24),
    }),
    showField(),
  ],
  orderings: [
    { title: 'Start date, soonest first', name: 'startDateSoonest', by: [{ field: 'startDate', direction: 'asc' }] },
    { title: 'Start date, latest first', name: 'startDateLatest', by: [{ field: 'startDate', direction: 'desc' }] },
  ],
  preview: {
    select: { title: 'title', startDate: 'startDate', endDate: 'endDate', startTime: 'startTime', location: 'location', show: 'show' },
    prepare(item) {
      const text = [whenText(item), item.location].filter(Boolean).join(' · ');
      const note = isOver(item) ? 'Over' : '';
      return { title: item.title || 'Event with no name', subtitle: subtitleFor([note, text].filter(Boolean).join(' · '), { show: item.show }) };
    },
  },
});
