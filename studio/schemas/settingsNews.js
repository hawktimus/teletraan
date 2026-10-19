// The FRC news fields of Dashboard Settings: the switches and lists of the FRC news section of the Competition
// page (../inputs/news-section.js), which hides them here. The Teletraan computer reads newsEnabled, newsCategories
// and newsHiddenLinks (computer/scripts/news-sync.sh), and the screen reads all four (dashboard/core/news.js).
// They are the same names and starting values as in defaultSettings in dashboard/config-settings.js, and
// tests/schemas.test.mjs fails if they differ. None is required: Dashboard Settings published before they
// existed has none, and the screen reads that as the starting values.

import { defineField, defineArrayMember } from 'sanity';

// The starting categories, the same as newsCategories in dashboard/config-settings.js
export const startingNewsCategories = ['FRC', 'Control System'];

export const mostNewsCategories = 12;
export const mostHiddenLinks = 100;

export function newsFields() {
  return [
    defineField({
      name: 'newsEnabled',
      title: 'Read FRC news',
      type: 'boolean',
      group: 'competition',
      description: 'On reads the FIRST blog every 2 hours and lets the FRC news panel play. Off reads nothing and the panel is skipped.',
      initialValue: true,
    }),
    defineField({
      name: 'newsCategories',
      title: 'News categories',
      type: 'array',
      group: 'competition',
      of: [defineArrayMember({ type: 'string', validation: Rule => Rule.max(30).error('A category is up to 30 characters.') })],
      description: 'Only posts with one of these categories of the FIRST blog are kept. Leave empty for the starting two, FRC and Control System.',
      initialValue: startingNewsCategories,
      validation: Rule => Rule.max(mostNewsCategories).error('Up to ' + mostNewsCategories + ' categories.'),
    }),
    defineField({
      name: 'newsInTicker',
      title: 'Show news in the ticker',
      type: 'boolean',
      group: 'competition',
      description: 'On adds the newest three headlines to the ticker as FIRST: and the headline.',
      initialValue: false,
    }),
    defineField({
      name: 'newsHiddenLinks',
      title: 'Hidden headlines',
      type: 'array',
      group: 'competition',
      of: [defineArrayMember({ type: 'string', validation: Rule => Rule.max(300).error('An address is up to 300 characters.') })],
      description: 'The addresses of the headlines an editor hid. The FRC news section writes this list.',
      validation: Rule => Rule.max(mostHiddenLinks).error('Up to ' + mostHiddenLinks + ' hidden headlines. Show some again first.'),
    }),
  ];
}
