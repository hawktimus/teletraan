// What the Mini read from Monday, in one document with the fixed id 'monday-status'.
// deploy/scripts/monday-sync.sh writes it as a whole, so editors never open it: it is
// not in the sidebar or the New menu (structure.js, sanity.config.js). The Monday tab
// of Dashboard Settings shows when it was written and offers its boards and columns in
// the lists of a board entry (settingsMonday.js, ../monday-status-input.js and
// ../monday-pickers.js), and the screen reads its daily counts of open items.
//
// The dataset is public, so anyone who asks for this document can read the name of every
// board the token of the Mini can see, and the titles of their columns, whether or not
// the screen reads the board (docs/monday.md). It holds the first name of the account
// and no token. Every field is optional, because a value the Mini did not find is left
// out and never made up.

import { defineType, defineField, defineArrayMember } from 'sanity';

function textField(name, title, description) {
  return defineField({ name: name, title: title, type: 'string', description: description });
}

function numberField(name, title, description) {
  return defineField({ name: name, title: title, type: 'number', description: description });
}

const column = defineArrayMember({
  type: 'object',
  title: 'Column',
  fields: [
    textField('id', 'Column id', 'The id of the column on the board, which a board entry stores.'),
    textField('title', 'Column title', 'The title of the column as Monday shows it.'),
    textField('type', 'Column type', 'The kind of column, such as status, date or people.'),
  ],
  preview: {
    select: { title: 'title', id: 'id' },
    prepare(entry) {
      return { title: entry.title || 'Column with no title', subtitle: entry.id };
    },
  },
});

const board = defineArrayMember({
  type: 'object',
  title: 'Board',
  fields: [
    textField('id', 'Board number', 'The number of the board, which a board entry stores.'),
    textField('name', 'Board name', 'The name of the board as Monday shows it.'),
    numberField('itemCount', 'Items', 'How many items the board has.'),
    defineField({ name: 'columns', title: 'Columns', type: 'array', of: [column], description: 'The columns of the board.' }),
  ],
  preview: {
    select: { title: 'name', id: 'id' },
    prepare(entry) {
      return { title: entry.title || 'Board with no name', subtitle: entry.id };
    },
  },
});

const snapshot = defineArrayMember({
  type: 'object',
  title: 'Count',
  fields: [
    defineField({ name: 'date', title: 'Date', type: 'date', description: 'The day of the count.' }),
    numberField('open', 'Open items', 'How many items were not done that day, on the boards the screen reads.'),
  ],
  preview: {
    select: { title: 'date', open: 'open' },
    prepare(entry) {
      return { title: entry.title || 'Count with no date', subtitle: typeof entry.open === 'number' ? entry.open + ' open' : '' };
    },
  },
});

export default defineType({
  name: 'mondayStatus',
  title: 'Monday data from the Mini',
  type: 'document',
  readOnly: true,
  // Keeps it out of Studio's search, so it is not found by accident
  __experimental_omnisearch_visibility: false,
  fields: [
    textField('connectedAs', 'Connected as', 'The first name of the account the token belongs to. The Mini writes it.'),
    defineField({ name: 'lastSyncAt', title: 'Last sync', type: 'datetime', description: 'When the Mini last read Monday. The Mini writes it.' }),
    textField('lastError', 'Last error', 'What went wrong in the last run, in plain words. Empty when nothing did.'),
    defineField({ name: 'boards', title: 'Boards', type: 'array', of: [board], description: 'Every board the token can see, with its columns.' }),
    defineField({ name: 'snapshots', title: 'Daily counts', type: 'array', of: [snapshot], description: 'One count a day of the open items, 120 at most.' }),
  ],
  preview: {
    prepare: () => ({ title: 'Monday data from the Mini' }),
  },
});
