// A meeting day with presentation slots. Coaches add one for each meeting that
// has talks. A day with no document here has no slots. The talks that get booked
// are in presentation.js.
//
// A slot starts at the first talk and then every slotMinutes until the last
// talk, which is a slot itself.

import { defineType, defineField } from 'sanity';
import { teamField } from './fields.js';
import { clockIn, dayIn, fallbackTimeZone, isTimeZone } from './presentationTimes.js';

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// The kiosk shows times in the zone of the Look page. Without an answer from
// Sanity, or with a name Intl does not know, it is the zone the Look page starts with.
async function kioskTimeZone(context) {
  try {
    const client = context.getClient({ apiVersion: apiVersion });
    const zone = await client.fetch('*[_id == "theme"][0].timeZone', {}, { perspective: 'published' });
    if (isTimeZone(zone)) return zone;
  } catch (error) {
    // no answer from Sanity: use the starting zone
  }
  return fallbackTimeZone;
}

// The last talk is a slot of the same meeting, so it is not before the first
// talk and it falls on the same day on the kiosk's clock
async function lastTalkFitsDay(value, context) {
  const first = context.document && context.document.firstSlotAt;
  if (!value || !first) return true;
  if (new Date(value) < new Date(first)) return 'The last talk is before the first talk.';

  const zone = await kioskTimeZone(context);
  return dayIn(value, zone) === dayIn(first, zone) || 'The last talk must be on the same day as the first talk.';
}

export default defineType({
  name: 'presentationDay',
  title: 'Meeting days',
  type: 'document',
  fields: [
    defineField({
      name: 'firstSlotAt',
      title: 'First talk starts',
      type: 'datetime',
      description: 'When the first talk starts. Leave a gap after the announcement, so the first talk does not start while it plays.',
      validation: Rule => Rule.required().error('Pick when the first talk starts.'),
    }),
    defineField({
      name: 'lastSlotAt',
      title: 'Last talk starts',
      type: 'datetime',
      description: 'When the last talk starts. It is on the same day as the first talk, and not before it.',
      validation: Rule => [Rule.required().error('Pick when the last talk starts.'), Rule.custom(lastTalkFitsDay)],
    }),
    defineField({
      name: 'slotMinutes',
      title: 'Length of each talk',
      type: 'number',
      description: 'How many minutes each talk gets, from 5 to 30. Talks start this far apart.',
      initialValue: 15,
      validation: Rule => [
        Rule.required().error('Enter the number of minutes.'),
        Rule.integer().min(5).max(30).error('Use a whole number from 5 to 30.'),
      ],
    }),
    defineField({
      name: 'closeMinutesBefore',
      title: 'Booking closes this long before a slot',
      type: 'number',
      hidden: true,
      description: 'Not edited here. The booking script reads it: how many minutes before a talk starts it can no longer be booked. It starts at 30.',
      initialValue: 30,
    }),
    defineField({
      name: 'open',
      title: 'Open for booking',
      type: 'boolean',
      description: 'Turn this off to close booking for this meeting day without deleting it.',
      initialValue: true,
    }),
    teamField(),
  ],
  orderings: [
    { title: 'First talk, soonest first', name: 'firstSlotSoonest', by: [{ field: 'firstSlotAt', direction: 'asc' }] },
    { title: 'First talk, latest first', name: 'firstSlotLatest', by: [{ field: 'firstSlotAt', direction: 'desc' }] },
  ],
  preview: {
    select: { first: 'firstSlotAt', last: 'lastSlotAt', open: 'open' },
    prepare(item) {
      const first = clockIn(item.first, fallbackTimeZone);
      const last = clockIn(item.last, fallbackTimeZone);
      const closed = item.open === false ? 'Closed for booking' : '';
      // Thu Oct 8, then 2:45 PM to 4:45 PM
      const slots = first ? first.time + (last && item.last !== item.first ? ' to ' + last.time : '') : '';
      return { title: first ? first.weekday + ' ' + first.date : 'Meeting day with no times', subtitle: [closed, slots].filter(Boolean).join(' · ') };
    },
  },
});
