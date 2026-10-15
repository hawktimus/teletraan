// The lists of the board blocks on the Monday tab of Dashboard Settings
// (schemas/settingsMonday.js): a board picker that shows the names of the boards and
// stores the number of the one picked, and a column picker for each column field of the
// entry that lists the columns of that board only and stores the id of the one picked. Both
// read the document monday-status that the Mini writes (deploy/scripts/monday-sync.sh),
// so nobody types a number or an id.
//
// A column is listed with its title and its type in words, such as Due (Date), the columns
// that fit the field under Fits and the others under Other. When the board is changed, the
// column fields of the entry are cleared, because a column belongs to one board. If the
// Mini has not listed the columns of the board yet, the picker says to wait for the next sync.
//
// If the list of boards cannot be read, or the Mini has not listed any board, a picker is the
// plain box of the field and says why. Nothing is lost: a value that is stored but not in the
// list stays in the list, with a note.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useRef, useState } from 'react';
import { set, unset, useClient, useFormValue } from 'sanity';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// The id the Mini writes to. deploy/scripts/monday-sync.sh has the same one.
const mondayStatusId = 'monday-status';

// Only the boards and their columns, so the question stays small
const question = '*[_id == $id][0] { "boards": boards[] { id, name, "columns": columns[] { id, title, type } } }';

// The kinds of column that each column field of an entry is likely to take, by the type that Monday
// gives the column. The other columns are listed too, below these, because the type names are not
// certain (docs/monday.md, "If an answer looks different").
export const columnKinds = {
  status: ['status', 'color'],
  priority: ['status', 'color', 'dropdown'],
  due: ['date', 'timeline'],
  owner: ['people', 'multiple-person'],
  team: ['status', 'color', 'dropdown', 'text'],
  timeline: ['timeline'],
  hours: ['numbers', 'numeric'],
  date: ['date'],
  relation: ['board_relation', 'board-relation'],
};

// The type of a column in words. Monday has used two names for some types, and the other types are
// written out from their own name, such as long_text as Long text.
const typeWords = {
  color: 'Status',
  'multiple-person': 'People',
};

export function typeText(type) {
  if (typeof type !== 'string' || type === '') return '';
  if (typeWords[type]) return typeWords[type];

  const spaced = type.replace(/[-_]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// The title of a column and its type in words, such as Due (Date)
function columnLabel(column) {
  const kind = typeText(column.type);
  return (column.title || column.id) + (kind ? ' (' + kind + ')' : '');
}

// What the empty choice of each column field says
const emptyChoices = {
  status: 'Pick the column',
  priority: 'No priority column',
  due: 'No due date column',
  owner: 'No owner column',
  team: 'Use the group names',
  timeline: 'Pick the column',
  hours: 'Pick the column',
  date: 'Pick the column',
  relation: 'Pick the column',
};

const styles = {
  note: { margin: '8px 0 0', fontSize: 12, color: 'var(--card-muted-fg-color, inherit)' },
  list: { minWidth: 280, padding: 8, fontSize: 14 },
};

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The boards of the document, each with an id and a name and a list of columns. A board with no id, and a
// column with no id, cannot be picked and are left out.
export function cleanBoards(found) {
  const list = isRecord(found) && Array.isArray(found.boards) ? found.boards : [];

  return list
    .filter(board => isRecord(board) && typeof board.id === 'string' && board.id !== '')
    .map(board => ({
      id: board.id,
      name: typeof board.name === 'string' ? board.name : '',
      columns: (Array.isArray(board.columns) ? board.columns : [])
        .filter(column => isRecord(column) && typeof column.id === 'string' && column.id !== '')
        .map(column => ({ id: column.id, title: typeof column.title === 'string' ? column.title : '', type: typeof column.type === 'string' ? column.type : '' })),
    }));
}

// The published document. This never fails: a document that cannot be read is reported as
// unreadable, and the picker is the plain box.
export async function readMondayBoards(client) {
  try {
    const found = await client.fetch(question, { id: mondayStatusId }, { perspective: 'published' });
    return { boards: cleanBoards(found), unreadable: false };
  } catch (error) {
    return { boards: [], unreadable: true };
  }
}

// Every picker of the form asks for the same document, so one answer is kept for a few seconds
let recent = null;

function readOnce(client) {
  const now = Date.now();
  if (!recent || now - recent.at > 10000) recent = { at: now, answer: readMondayBoards(client) };
  return recent.answer;
}

// The lines of the board list: an empty line, then one for each board by its name. Two boards with the
// same name show their numbers too. A board that is stored but not in the list stays, with a note.
export function boardChoices(boards, currentId) {
  const choices = [{ id: '', label: 'Pick the board', group: '' }];

  boards.forEach(board => {
    const name = board.name || 'Board ' + board.id;
    const twice = boards.filter(other => (other.name || 'Board ' + other.id) === name).length > 1;
    choices.push({ id: board.id, label: twice ? name + ' (' + board.id + ')' : name, group: '' });
  });

  if (currentId && !choices.some(choice => choice.id === currentId)) {
    choices.push({ id: currentId, label: 'Board ' + currentId + ' (not in the list)', group: '' });
  }
  return choices;
}

// The lines of the column list of one board for one kind of column field: the empty line, the
// columns that fit the kind, then the other columns, each with its type in words. A column that is
// stored but not on the board stays, with a note. Nothing is given when the board is not in the list
// or the Mini has not listed its columns yet, and never the columns of another board.
export function columnChoices(boards, boardId, kind, currentId) {
  const board = boards.filter(item => item.id === boardId)[0];
  if (!board || board.columns.length === 0) return [];

  const fits = columnKinds[kind] || [];
  const choices = [{ id: '', label: emptyChoices[kind] || 'None', group: '' }];

  board.columns.filter(column => fits.indexOf(column.type) !== -1).forEach(column => {
    choices.push({ id: column.id, label: columnLabel(column), group: 'fits' });
  });
  board.columns.filter(column => fits.indexOf(column.type) === -1).forEach(column => {
    choices.push({ id: column.id, label: columnLabel(column), group: 'others' });
  });

  if (currentId && !choices.some(choice => choice.id === currentId)) {
    choices.push({ id: currentId, label: currentId + ' (not on the board)', group: '' });
  }
  return choices;
}

// The path of the field with this name in the same entry: the path of this field with its last
// name swapped
export function siblingPath(path, name) {
  return (Array.isArray(path) ? path.slice(0, -1) : []).concat(name);
}

// An empty line clears the field. A column or a board writes its id.
export function pickPatch(id) {
  return id ? set(id) : unset();
}

// A column belongs to one board. When the board of the entry is changed, a column that was picked
// for the board before is cleared. before is the board the entry had on the last render.
export function clearsOnNewBoard(before, boardId, value) {
  return before !== boardId && typeof value === 'string' && value !== '';
}

function optionOf(choice) {
  return h('option', { key: choice.id || 'none', value: choice.id }, choice.label);
}

// The list itself: the empty line and the lines with no group first, then the columns that fit under
// Fits and the others under Other
function listView(props, choices) {
  const current = typeof props.value === 'string' ? props.value : '';
  const own = choices.filter(choice => choice.group === '');
  const fits = choices.filter(choice => choice.group === 'fits');
  const others = choices.filter(choice => choice.group === 'others');
  const children = [own[0]].map(optionOf);

  if (fits.length > 0) children.push(h('optgroup', { key: 'fits', label: 'Fits' }, fits.map(optionOf)));
  if (others.length > 0) children.push(h('optgroup', { key: 'others', label: 'Other' }, others.map(optionOf)));
  own.slice(1).forEach(choice => children.push(optionOf(choice)));

  return h(
    'select',
    {
      id: props.id,
      value: current,
      style: styles.list,
      disabled: Boolean(props.readOnly),
      onChange: event => props.onChange(pickPatch(event.target.value)),
    },
    ...children
  );
}

// The plain box of the field with the reason under it
function plainView(props, reason) {
  const box = typeof props.renderDefault === 'function' ? props.renderDefault(props) : null;
  return h('div', null, box, h('p', { style: styles.note }, reason));
}

// What the board picker shows for what was read: null while it is being read, then { boards, unreadable }
export function boardPickerView(read, props) {
  if (!read) return h('p', { style: styles.note }, 'Reading the list of boards.');
  if (read.unreadable) return plainView(props, 'The list of boards could not be read, so type the board number.');
  if (read.boards.length === 0) return plainView(props, 'The Mini has not listed any boards yet, so type the board number.');

  return listView(props, boardChoices(read.boards, typeof props.value === 'string' ? props.value : ''));
}

// What a column picker says when the Mini has not listed the columns of the board it is for
export const waitForSync = 'Read the board first: wait for the next sync.';

// The same for a column picker. boardId is the board picked in the same entry, kind is a name in columnKinds.
export function columnPickerView(read, props, kind, boardId) {
  if (!read) return h('p', { style: styles.note }, 'Reading the list of columns.');
  if (read.unreadable) return plainView(props, 'The list of columns could not be read, so type the column id.');
  if (boardId === '') return h('p', { style: styles.note }, 'Pick the board first, then pick its column here.');

  const choices = columnChoices(read.boards, boardId, kind, typeof props.value === 'string' ? props.value : '');
  if (choices.length === 0) return h('p', { style: styles.note }, waitForSync);
  return listView(props, choices);
}

function useBoards() {
  const client = useClient({ apiVersion: apiVersion });
  const [read, setRead] = useState(null);

  useEffect(() => {
    let stopped = false;

    readOnce(client).then(result => {
      if (!stopped) setRead(result);
    });

    return () => {
      stopped = true;
    };
  }, []);

  return read;
}

export function BoardInput(props) {
  return boardPickerView(useBoards(), props);
}

function columnInput(kind) {
  return function MondayColumnInput(props) {
    const found = useFormValue(siblingPath(props.path, 'boardId'));
    const boardId = typeof found === 'string' ? found : '';
    const before = useRef(boardId);

    useEffect(() => {
      const clear = clearsOnNewBoard(before.current, boardId, props.value);
      before.current = boardId;
      if (clear) props.onChange(unset());
    }, [boardId]);

    return columnPickerView(useBoards(), props, kind, boardId);
  };
}

export const StatusColumnInput = columnInput('status');
export const PriorityColumnInput = columnInput('priority');
export const DueColumnInput = columnInput('due');
export const OwnerColumnInput = columnInput('owner');
export const TeamColumnInput = columnInput('team');
export const TimelineColumnInput = columnInput('timeline');
export const HoursColumnInput = columnInput('hours');
export const DateColumnInput = columnInput('date');
export const RelationColumnInput = columnInput('relation');
