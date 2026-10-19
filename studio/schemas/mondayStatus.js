// What the Teletraan computer read from Monday, in one document with the fixed id 'monday-status'.
// computer/scripts/monday-sync.sh writes it, so editors never open it: it is
// not in the sidebar or the New menu (structure.js, sanity.config.js). The Monday tab
// of Dashboard Settings shows when it was written and offers its boards and columns in
// the lists of the board blocks (settingsMonday.js, ../monday-status-input.js and
// ../monday-pickers.js), the Monday Boards page lists its boards (../monday-boards-view.js),
// and the screen reads its daily counts of open items and the time of the last read.
//
// The dataset is public, so anyone who asks for this document can read the name of every
// board the token of the Teletraan computer can see, and the titles of their columns, whether or not
// the screen reads the board (docs/monday.md). It holds the first name of the account
// and no token. Every field is optional, because a value the Teletraan computer did not find is left
// out and never made up.

import { defineType, defineField, defineArrayMember } from 'sanity';
import { textField, numberField } from './fields.js';

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
    textField('hierarchy', 'Kind of board', 'classic, or multi_level when the board has parent items with subitems. The Teletraan computer reads a multi-level board in another way.'),
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

const reading = defineArrayMember({
  type: 'object',
  title: 'Board reading',
  fields: [
    textField('boardId', 'Board number', 'The number of a board chosen in Dashboard Settings.'),
    textField('boardName', 'Board name', 'The name of the board as Monday shows it, when the token can see it.'),
    numberField('itemsRead', 'Items read', 'How many items the Teletraan computer read from the board the last time it could.'),
    defineField({ name: 'readAt', title: 'Read at', type: 'datetime', description: 'When the Teletraan computer last read the board.' }),
    textField('note', 'Note', 'Why the board gave no items or fewer than it has, in plain words. Empty when nothing went wrong.'),
  ],
  preview: {
    select: { title: 'boardName', id: 'boardId', items: 'itemsRead' },
    prepare(entry) {
      return { title: entry.title || 'Board ' + (entry.id || 'with no number'), subtitle: typeof entry.items === 'number' ? entry.items + ' items read' : '' };
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
  title: 'Monday data from the Teletraan computer',
  type: 'document',
  readOnly: true,
  // Keeps it out of Studio's search, so it is not found by accident
  __experimental_omnisearch_visibility: false,
  fields: [
    textField('connectedAs', 'Connected as', 'The first name of the account the token belongs to. The Teletraan computer writes it.'),
    defineField({ name: 'lastSyncAt', title: 'Last sync', type: 'datetime', description: 'When the Teletraan computer last read Monday. The computer writes it.' }),
    textField('lastError', 'Last error', 'What went wrong in the last run, in plain words. Empty when nothing did.'),
    defineField({ name: 'boards', title: 'Boards', type: 'array', of: [board], description: 'Every board the token can see, with its columns.' }),
    defineField({ name: 'readings', title: 'Board readings', type: 'array', of: [reading], description: 'One entry for each board chosen in Dashboard Settings: how many items the Teletraan computer read from it, when, and why a board gave none.' }),
    defineField({ name: 'snapshots', title: 'Daily counts', type: 'array', of: [snapshot], description: 'One count a day of the open items, 120 at most.' }),
    numberField('taskCount', 'Tasks', 'How many parent items the Teletraan computer read from the task board the last time, hidden ones included.'),
    numberField('hiddenUnassigned', 'Hidden, no department', 'How many of those tasks have no department, so they are kept off the TV.'),
    numberField('callsToday', 'Reads today', 'How many requests the Teletraan computer has made to Monday today. Past 900 it waits for midnight.'),
    defineField({ name: 'callsDate', title: 'Reads counted for', type: 'date', description: 'The day of the count of reads, in the time zone of the screen.' }),
  ],
  preview: {
    prepare: () => ({ title: 'Monday data from the Teletraan computer' }),
  },
});
