// The FIRST news headlines the Teletraan computer read, in one document with the fixed id 'frc-news'.
// computer/scripts/news-sync.sh writes it as a whole, so editors never open it: it is not in the sidebar or
// the New menu (structure.js, sanity.config.js). The FRC news section of the Competition page lists its
// headlines with a Hide switch each (../inputs/news-section.js), and the dashboard reads it to draw the
// FRC news panel and the ticker lines (dashboard/core/news.js).
//
// It holds the headline, the address, the date and the categories of each post of the FIRST community blog,
// and never the text of a post. The dataset is public, so anyone can read it. items are the headlines that show,
// newest first, and hiddenItems the ones an editor hid, so Studio can offer to show them again. Every field is
// optional. The fields are described in docs/frc-news.md.

import { defineType, defineField, defineArrayMember } from 'sanity';
import { textField } from './fields.js';

const headline = defineArrayMember({
  type: 'object',
  title: 'Headline',
  fields: [
    textField('title', 'Headline', 'The title of the post, cut to 140 characters.'),
    textField('link', 'Address', 'The address of the post on the FIRST site. The screen never links to it. The Hide switch matches by it.'),
    defineField({ name: 'date', title: 'Date', type: 'datetime', description: 'When the post was published.' }),
    defineField({ name: 'categories', title: 'Categories', type: 'array', of: [defineArrayMember({ type: 'string' })], description: 'The categories of the post, such as FRC or Control System.' }),
    defineField({ name: 'systemcore', title: 'About SystemCore', type: 'boolean', description: 'True when the title or a category says SystemCore. The panel draws a chip for it.' }),
    textField('source', 'Source', 'Where the post came from. Always FIRST.'),
  ],
  preview: {
    select: { title: 'title', date: 'date' },
    prepare(entry) {
      return { title: entry.title || 'Headline with no title', subtitle: entry.date || '' };
    },
  },
});

export default defineType({
  name: 'frcNews',
  title: 'FRC news from the Teletraan computer',
  type: 'document',
  readOnly: true,
  // Keeps it out of Studio's search, so it is not found by accident
  __experimental_omnisearch_visibility: false,
  fields: [
    defineField({ name: 'lastSyncAt', title: 'Last read', type: 'datetime', description: 'When the Teletraan computer last read the FIRST blog. The computer writes it.' }),
    textField('lastError', 'Last error', 'What went wrong in the last read, in plain words. Empty when nothing did. The computer writes it.'),
    defineField({ name: 'items', title: 'Headlines', type: 'array', of: [headline], description: 'The newest headlines of the chosen categories that nobody hid, 10 at most.' }),
    defineField({ name: 'hiddenItems', title: 'Hidden headlines', type: 'array', of: [headline], description: 'Headlines an editor hid, kept here so the FRC news section can offer to show them again.' }),
  ],
  preview: {
    prepare: () => ({ title: 'FRC news from the Teletraan computer' }),
  },
});
