// An announcement for the bar under the banner of the TV (docs/announcements.md). It is live from its start
// to its end and shows for the team on the banner. It is not the full-screen announcement of Dashboard
// Settings that Play announcements plays: that covers the whole screen, and this is a thin bar.
// The dataset is public, so the text is public too.

import { defineType, defineField } from 'sanity';
import { teamField, tooLong, titleOf } from './fields.js';
import { clockIn, fallbackTimeZone } from './presentationTimes.js';
import { limits } from './limits.js';
import { noContact } from '../tools/content-rules.js';

const levels = [
  { title: 'Notice', value: 'notice' },
  { title: 'Important', value: 'important' },
];

// live, ends in 25 minutes, ends in 3 hours, starts in 2 days, or past
export function standing(startText, endText, now = Date.now()) {
  const start = Date.parse(startText);
  const end = Date.parse(endText);
  if (isNaN(start) || isNaN(end)) return '';

  const words = milliseconds => {
    const minutes = Math.max(1, Math.round(milliseconds / 60000));
    if (minutes < 60) return minutes + (minutes === 1 ? ' minute' : ' minutes');
    const hours = Math.round(minutes / 60);
    if (hours < 48) return hours + (hours === 1 ? ' hour' : ' hours');
    return Math.round(hours / 24) + ' days';
  };

  if (now >= end) return 'past';
  if (now < start) return 'starts in ' + words(start - now);
  return 'live, ends in ' + words(end - now);
}

function endWords(isoText) {
  const end = clockIn(isoText, fallbackTimeZone);
  return end ? 'until ' + end.weekday + ' ' + end.date + ', ' + end.time : '';
}

export default defineType({
  name: 'announcement',
  title: 'Announcement',
  type: 'document',
  fields: [
    defineField({
      name: 'text',
      title: 'Text',
      type: 'string',
      description: 'The line on the bar under the banner. Up to 90 characters. About 45 fit at full size, and a longer line is drawn smaller.',
      validation: Rule => [Rule.required().error('Write the text.'), tooLong(Rule, limits.announcementText), Rule.custom(noContact).warning()],
    }),
    defineField({
      name: 'start',
      title: 'Starts at',
      type: 'datetime',
      description: 'When the bar goes up on the TV.',
      validation: Rule => Rule.required().error('Pick when it starts.'),
    }),
    defineField({
      name: 'end',
      title: 'Ends at',
      type: 'datetime',
      description: 'When the bar comes down. It must be after the start.',
      validation: Rule => [
        Rule.required().error('Pick when it ends.'),
        Rule.custom((end, context) => {
          const start = context.document && context.document.start;
          if (!end || !start) return true;
          return Date.parse(end) > Date.parse(start) ? true : 'The end must be after the start.';
        }),
      ],
    }),
    teamField(),
    defineField({
      name: 'level',
      title: 'Level',
      type: 'string',
      description: 'Notice is the color of the team. Important is red.',
      options: { list: levels, layout: 'radio', direction: 'horizontal' },
      initialValue: 'notice',
      validation: Rule => [
        Rule.required().error('Pick notice or important.'),
        Rule.valid(levels.map(level => level.value)).error('Pick notice or important.'),
      ],
    }),
  ],
  orderings: [
    { title: 'Start, latest first', name: 'startLatest', by: [{ field: 'start', direction: 'desc' }] },
  ],
  preview: {
    select: { text: 'text', start: 'start', end: 'end', level: 'level' },
    prepare(item) {
      const important = item.level === 'important' ? titleOf(levels, item.level) : '';
      return { title: item.text || 'Announcement with no text', subtitle: [standing(item.start, item.end), important, endWords(item.end)].filter(Boolean).join(' · ') };
    },
  },
});
