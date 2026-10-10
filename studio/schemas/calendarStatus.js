// What each calendar brought in, in one document with the fixed id 'calendar-status'.
// The Mini writes it with deploy/scripts/status-write.sh calendar-status after each
// calendar download, so editors never open it: it is not in the sidebar or the New
// menu (structure.js, sanity.config.js), and the Calendars page shows it
// (calendars-view.js). The dashboard never reads it.
//
// The dataset is public, so anyone who asks for this document can read the titles of
// the coming events, including the ones a Calendar filter hides from the screen. It
// holds no calendar address (docs/calendars-page.md).
//
// Everything but the code is optional. A calendar the Mini has not downloaded yet has no
// time, and one with no file has no events.

import { defineType, defineField, defineArrayMember } from 'sanity';

const occurrence = defineArrayMember({
  type: 'object',
  title: 'Event',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', description: 'The title of the event as the calendar has it, cut at 60 characters.' }),
    defineField({ name: 'date', title: 'Date', type: 'string', description: 'The date as the screen writes it, such as FRI OCT 9.' }),
    defineField({ name: 'day', title: 'Day', type: 'string', description: 'The first day of the event written like 2026-10-09, in the time zone of the screen. A rule made on the Calendars page uses it.' }),
    defineField({ name: 'time', title: 'Time', type: 'string', description: 'The start time as the screen writes it. Empty for an event that lasts all day.' }),
    defineField({ name: 'shown', title: 'Shown on the screen', type: 'boolean', description: 'Off when a Calendar filter hides the event.' }),
    defineField({ name: 'rule', title: 'Rule', type: 'string', description: 'The name of the Calendar filter that hides the event. Empty when the event is shown.' }),
  ],
  preview: {
    select: { title: 'title', date: 'date', shown: 'shown' },
    prepare(event) {
      return { title: event.title || 'Event with no title', subtitle: [event.shown === false ? 'Hidden' : 'Shown', event.date].filter(Boolean).join(' · ') };
    },
  },
});

const calendar = defineArrayMember({
  type: 'object',
  title: 'Calendar',
  fields: [
    defineField({ name: 'code', title: 'Calendar code', type: 'string', description: 'The code of the calendar on the Mini, the same as in Dashboard Settings.' }),
    defineField({ name: 'fetchedAt', title: 'Last download', type: 'datetime', description: 'When the Mini last downloaded this calendar properly.' }),
    defineField({ name: 'error', title: 'Last error', type: 'string', description: 'Why the last download failed, in plain words. Empty when it worked.' }),
    defineField({ name: 'eventCount', title: 'Events in 30 days', type: 'number', description: 'How many events fall in the next 30 days, hidden ones included.' }),
    defineField({ name: 'hiddenCount', title: 'Hidden events', type: 'number', description: 'How many of those a Calendar filter hides from the screen.' }),
    defineField({ name: 'occurrences', title: 'Next events', type: 'array', of: [occurrence], description: 'The next 40 events, in date order, shown or hidden.' }),
  ],
  preview: {
    select: { title: 'code' },
    prepare(entry) {
      return { title: entry.title || 'Calendar with no code' };
    },
  },
});

export default defineType({
  name: 'calendarStatus',
  title: 'Calendar status',
  type: 'document',
  readOnly: true,
  // Keeps it out of Studio's search, so it is not found by accident
  __experimental_omnisearch_visibility: false,
  fields: [
    defineField({ name: 'updatedAt', title: 'Written at', type: 'datetime', description: 'When the Mini made this document. The Mini writes this.' }),
    defineField({ name: 'eventsNote', title: 'Why no events are listed', type: 'string', description: 'Set when the Mini could not list the coming events, such as when Node is not installed on it.' }),
    defineField({ name: 'calendars', title: 'Calendars', type: 'array', of: [calendar], description: 'One entry for each calendar line in local.env on the Mini.' }),
  ],
  preview: {
    prepare: () => ({ title: 'Calendar status' }),
  },
});
