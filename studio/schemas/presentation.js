// A booked talk. The booking form saves one, and a coach can add or change one
// here. Cancel a talk by setting its status to Cancelled, then use Publish all.
// The dataset is public, so the first name and the title are public too.

import { defineType, defineField } from 'sanity';
import { teamField, tooLong, titleOf } from './fields.js';
import { clockIn, fallbackTimeZone } from './presentationTimes.js';

// The name is a first name, so a space or a digit means a last name or
// something else is in there. A hyphen is fine, as in Mary-Anne.
function firstNameOnly(value) {
  if (typeof value === 'string' && /[\s\d]/.test(value)) return 'Use a first name only, with no spaces or numbers.';
  return true;
}

// A Google Slides share link, which has the id of the deck after /d/
const slidesLink = /^https:\/\/docs\.google\.com\/presentation\/d\/[A-Za-z0-9_-]+/;

const subteams = [
  { title: 'Build', value: 'Build' },
  { title: 'Programming', value: 'Programming' },
  { title: 'Design', value: 'Design' },
  { title: 'Electrical', value: 'Electrical' },
  { title: 'Outreach', value: 'Outreach' },
  { title: 'Business', value: 'Business' },
  { title: 'Other', value: 'Other' },
];

const statuses = [
  { title: 'Scheduled', value: 'scheduled' },
  { title: 'Cancelled', value: 'cancelled' },
  { title: 'Done', value: 'done' },
  { title: 'Skipped', value: 'skipped' },
];

// Thu 2:45 PM - Alex - the title of the talk
function talkLine(item) {
  const start = clockIn(item.start, fallbackTimeZone);
  return [start ? start.weekday + ' ' + start.time : '', item.name, item.topic].filter(Boolean).join(' - ');
}

export default defineType({
  name: 'presentation',
  title: 'Presentations',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'First name',
      type: 'string',
      description: 'The first name of the person giving the talk, with no last name. Up to 12 characters fit.',
      validation: Rule => [Rule.required().error('Add the first name.'), tooLong(Rule, 12), Rule.custom(firstNameOnly)],
    }),
    defineField({
      name: 'subteam',
      title: 'Subteam',
      type: 'string',
      description: 'Optional. The subteam the speaker is on. It shows on the title card.',
      options: { list: subteams },
      validation: Rule => Rule.valid(subteams.map(subteam => subteam.value)).error('Pick a subteam from the list.'),
    }),
    defineField({
      name: 'topic',
      title: 'Title shown on the TV',
      type: 'string',
      description: 'What the talk is called on the TV. Up to 40 characters fit.',
      validation: Rule => [Rule.required().error('Add a title for the talk.'), tooLong(Rule, 40)],
    }),
    defineField({
      name: 'start',
      title: 'Starts at',
      type: 'datetime',
      description: 'When the talk starts. The title card comes up on the TV at this time.',
      validation: Rule => Rule.required().error('Pick when the talk starts.'),
    }),
    defineField({
      name: 'minutes',
      title: 'Length of the talk',
      type: 'number',
      description: 'How many minutes the talk gets, from 5 to 30.',
      initialValue: 15,
      validation: Rule => [
        Rule.required().error('Enter the number of minutes.'),
        Rule.integer().min(5).max(30).error('Use a whole number from 5 to 30.'),
      ],
    }),
    defineField({
      name: 'deckLink',
      title: 'Slides link',
      type: 'url',
      description: 'The share link of the Google Slides deck. Anyone with the link must be able to view it.',
      validation: Rule => [
        Rule.required().error('Paste the link to the Google Slides deck.'),
        Rule.regex(slidesLink, { name: 'Google Slides link' }).error('Use a Google Slides link, which starts with https://docs.google.com/presentation/d/'),
      ],
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      description: 'Only Scheduled talks run on the TV. Pick Cancelled to drop a talk without deleting it.',
      options: { list: statuses, layout: 'radio', direction: 'horizontal' },
      initialValue: 'scheduled',
      validation: Rule => [
        Rule.required().error('Pick a status.'),
        Rule.valid(statuses.map(status => status.value)).error('Pick scheduled, cancelled, done or skipped.'),
      ],
    }),
    teamField(),
  ],
  orderings: [
    { title: 'Start, soonest first', name: 'startSoonest', by: [{ field: 'start', direction: 'asc' }] },
    { title: 'Start, latest first', name: 'startLatest', by: [{ field: 'start', direction: 'desc' }] },
  ],
  preview: {
    select: { start: 'start', name: 'name', topic: 'topic', subteam: 'subteam', status: 'status' },
    prepare(item) {
      const note = item.status && item.status !== 'scheduled' ? titleOf(statuses, item.status) : '';
      return { title: talkLine(item) || 'Talk with no details', subtitle: [note, item.subteam].filter(Boolean).join(' · ') };
    },
  },
});
