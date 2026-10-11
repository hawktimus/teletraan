// The connection block at the top of the Monday tab of Dashboard Settings
// (schemas/settingsMonday.js). It reads the document monday-status, which the Mini writes
// with deploy/scripts/monday-sync.sh, and says who the token belongs to, when the Mini
// last read Monday, how many boards it can see, and what went wrong last. Below those it
// says how many boards the form has chosen and how many tasks the Mini has made, and when
// no board is chosen it says that the Mini writes no tasks. Under those is a line for each board
// row of the form: the name of the board, how many items the Mini read, how many of its tasks are on
// the TV, and when it was last read. A board that gave no items says why, such as a board number the
// token cannot see. The field stores nothing: this input never changes the value.
//
// If the document is missing it says No connection yet and what to do, and if it
// cannot be read it says so. A number that cannot be read is left out. None of this
// stops the form from opening.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient, useFormValue } from 'sanity';
import { ageText, clockText } from './time-text.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// The id the Mini writes to. deploy/scripts/monday-sync.sh has the same one.
export const mondayStatusId = 'monday-status';

// Only what the block shows, so the question stays small. names are the boards the token can
// see, and readings are what the Mini read from each board the form has chosen.
const question = '*[_id == $id][0] { connectedAs, lastSyncAt, lastError, "boards": count(boards), "names": boards[] { id, name }, "readings": readings[] { boardId, boardName, itemsRead, readAt, note } }';

// The tasks the Mini made from the boards, whether or not they are on the screen
const taskQuestion = 'count(*[_type == "task" && source == "monday" && !(_id in path("drafts.**"))])';

// The board of each task from the board that is on the TV, so the block can count them for each board
const shownQuestion = '*[_type == "task" && source == "monday" && showOnTv != false && show != false && !(_id in path("drafts.**"))].mondayBoardId';

// What to do when no board is chosen. The Mini writes a task only for a chosen board.
export const noBoardNote = 'No board is chosen yet, so the Mini writes no tasks. Add a board under Boards below.';

const styles = {
  note: { margin: 0, fontSize: 14, color: 'var(--card-muted-fg-color, inherit)' },
  advice: { margin: '8px 0 0', fontSize: 14 },
  line: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '0 0 4px', fontSize: 14 },
  label: { minWidth: 220, fontWeight: 600 },
  board: { margin: '12px 0 0' },
  reason: { margin: '0 0 4px 236px', fontSize: 14, color: 'var(--card-badge-caution-fg-color, #92400e)' },
};

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// 1 board, 3 boards, or None
function boardsText(count) {
  if (typeof count !== 'number' || count < 1) return 'None';
  return count + (count === 1 ? ' board' : ' boards');
}

// 1 task, 12 tasks, or None
function tasksText(count) {
  if (typeof count !== 'number' || count < 1) return 'None';
  return count + (count === 1 ? ' task' : ' tasks');
}

// The lines for a status document: a label and the words after it. A document
// with no time says Not yet.
export function describeMondayStatus(doc, now) {
  const source = isRecord(doc) ? doc : {};
  const age = ageText(source.lastSyncAt, now);
  const clock = clockText(source.lastSyncAt);

  return [
    { label: 'Connected as', text: typeof source.connectedAs === 'string' && source.connectedAs !== '' ? source.connectedAs : 'Not known' },
    { label: 'Last sync', text: age && clock ? age + ' (' + clock + ')' : 'Not yet' },
    { label: 'Boards the token can see', text: boardsText(source.boards) },
    { label: 'Last error', text: typeof source.lastError === 'string' && source.lastError !== '' ? source.lastError : 'None' },
  ];
}

// The lines below those: the boards the form has chosen and the tasks the Mini has made.
// Either is null when it could not be read, and its line is left out.
export function describeMondayWork(chosen, tasks) {
  const lines = [];
  if (typeof chosen === 'number') lines.push({ label: 'Boards chosen', text: boardsText(chosen) });
  if (typeof tasks === 'number') lines.push({ label: 'Tasks from the board', text: tasksText(tasks) });
  return lines;
}

function sentence(text) {
  const trimmed = String(text).trim();
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.?]$/.test(capital) ? capital : capital + '.';
}

function itemsRead(count) {
  return count + (count === 1 ? ' item read' : ' items read');
}

// The line of each board row of the form, as { key, label, text, reason }: the name of the board, how many
// items the Mini read, how many of its tasks are on the TV, and when it was last read. reason says why a
// board gave no items, or nothing. entries are the board rows of the form, doc is the status document
// or null, shown is the board numbers of the tasks on the TV or null when they could not be read, and now
// is the time to count the ages from. A row with no board yet has no line.
export function describeBoardRows(entries, doc, shown, now) {
  const source = isRecord(doc) ? doc : {};
  const names = Array.isArray(source.names) ? source.names.filter(isRecord) : null;
  const readings = Array.isArray(source.readings) ? source.readings.filter(isRecord) : [];
  const rows = [];

  (Array.isArray(entries) ? entries : []).forEach(entry => {
    const id = isRecord(entry) && typeof entry.boardId === 'string' ? entry.boardId : '';
    if (id === '' || rows.some(row => row.key === id)) return;

    const seen = names ? names.filter(board => board.id === id)[0] : undefined;
    const reading = readings.filter(item => item.boardId === id)[0];
    const unseen = Boolean(names) && !seen;
    const name = (seen && typeof seen.name === 'string' && seen.name !== '' ? seen.name : '') || (reading && typeof reading.boardName === 'string' ? reading.boardName : '') || 'Board ' + id;
    const read = unseen ? 0 : reading && typeof reading.itemsRead === 'number' ? reading.itemsRead : null;
    const age = reading && !unseen ? ageText(reading.readAt, now) : '';
    const onTv = Array.isArray(shown) ? shown.filter(item => item === id).length : null;

    let reason = '';
    if (unseen) reason = 'The token cannot see this board, or the board number is wrong.';
    else if (reading && typeof reading.note === 'string' && reading.note !== '') reason = sentence(reading.note);
    else if (!reading) reason = 'The Mini has not read this board yet. Wait for the next sync.';
    else if (read === 0) reason = 'The board has no items.';

    const text = [itemsRead(read === null ? 0 : read), onTv === null ? '' : onTv + ' shown on the TV', age ? 'Read ' + age : 'Not read yet'].filter(Boolean).join(' · ');
    rows.push({ key: id, label: name, text: text, reason: reason });
  });
  return rows;
}

// How many boards the form being edited has chosen. A field nobody has filled in has none.
// Anything that is not a list cannot be counted, so it gives null.
export function boardsChosen(value) {
  if (Array.isArray(value)) return value.length;
  return value === undefined || value === null ? 0 : null;
}

// The numbers of the boards of the tasks that are on the TV, one for each task, or null when they cannot be read
export async function readMondayShownBoards(client) {
  try {
    const found = await client.fetch(shownQuestion, {}, { perspective: 'published' });
    return Array.isArray(found) ? found.filter(item => typeof item === 'string') : null;
  } catch (error) {
    return null;
  }
}

// The published document. This never fails: a document that cannot be read is
// reported as unreadable, and the input says so.
export async function readMondayStatus(client) {
  try {
    const found = await client.fetch(question, { id: mondayStatusId }, { perspective: 'published' });
    return { doc: isRecord(found) ? found : null, unreadable: false };
  } catch (error) {
    return { doc: null, unreadable: true };
  }
}

// The number of tasks the Mini has made, or null when it cannot be read
export async function readMondayTaskCount(client) {
  try {
    const found = await client.fetch(taskQuestion, {}, { perspective: 'published' });
    return typeof found === 'number' && found >= 0 ? found : null;
  } catch (error) {
    return null;
  }
}

// What the block shows for what was read: null while it is being read, then
// { doc, unreadable }. now is the time to count the ages from. work is optional:
// { chosen, tasks, boards } with the boards chosen in the form and the tasks made, each a
// number or null, and the lines of describeBoardRows.
export function mondayStatusView(read, now, work) {
  if (!read) return h('p', { style: styles.note }, 'Reading the connection to Monday.');
  if (read.unreadable) return h('p', { style: styles.note }, 'The connection to Monday could not be read.');
  if (!read.doc) return h('p', { style: styles.note }, 'No connection yet. Add MONDAY_API_TOKEN to local.env on the Mini, then wait 10 minutes.');

  const counts = work || {};
  const lines = describeMondayStatus(read.doc, now).concat(describeMondayWork(counts.chosen, counts.tasks));

  return h(
    'div',
    null,
    lines.map(line => h('p', { key: line.label, style: styles.line }, h('span', { style: styles.label }, line.label), h('span', null, line.text))),
    counts.chosen === 0 ? h('p', { style: styles.advice }, noBoardNote) : null,
    (counts.boards || []).map(row =>
      h(
        'div',
        { key: 'board-' + row.key, 'data-board': row.key, style: styles.board },
        h('p', { style: styles.line }, h('span', { style: styles.label }, row.label), h('span', null, row.text)),
        row.reason ? h('p', { style: styles.reason }, row.reason) : null
      )
    )
  );
}

// Reading the form can fail while it opens. Then the number is null and its line is left out.
function useBoardsChosen() {
  try {
    return boardsChosen(useFormValue(['mondayBoards']));
  } catch (error) {
    return null;
  }
}

// The board rows of the form being edited, or an empty list when they cannot be read
function useBoardRows() {
  try {
    const found = useFormValue(['mondayBoards']);
    return Array.isArray(found) ? found : [];
  } catch (error) {
    return [];
  }
}

export function MondayStatusInput() {
  const client = useClient({ apiVersion: apiVersion });
  const chosen = useBoardsChosen();
  const rows = useBoardRows();
  const [read, setRead] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [shown, setShown] = useState(null);

  useEffect(() => {
    let stopped = false;

    readMondayStatus(client).then(result => {
      if (!stopped) setRead(result);
    });
    readMondayTaskCount(client).then(count => {
      if (!stopped) setTasks(count);
    });
    readMondayShownBoards(client).then(boards => {
      if (!stopped) setShown(boards);
    });

    return () => {
      stopped = true;
    };
  }, []);

  const now = new Date();
  return mondayStatusView(read, now, { chosen: chosen, tasks: tasks, boards: describeBoardRows(rows, read && read.doc, shown, now) });
}
