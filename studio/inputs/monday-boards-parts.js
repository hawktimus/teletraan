// The parts of the Monday Boards page that need no Studio: its words, the question it asks of
// Sanity, and the rows it shows for the boards the token of the Mini can see and the boards
// chosen in Dashboard Settings (the two of the Monday tab). monday-boards-view.js draws them. tests/schemas.test.mjs and
// tests/monday-boards.test.mjs read this file with node.

import { ageText } from './time-text.js';
import { isRecord, sentence } from './plain-values.js';

// The id the Mini writes to. mini/scripts/monday-sync.sh has the same one.
export const mondayStatusId = 'monday-status';

// The id of Dashboard Settings, the same as settingsId in structure.js
export const settingsId = 'dashboardSettings';

// Where Choose boards goes: the Task board block of Dashboard Settings, which sits on the Monday tab. Studio
// opens the tab that holds the field.
export const chooseTarget = { id: settingsId, type: 'dashboardSettings', path: 'mondayTaskBoard' };

// The id the link to the list of milestones carries in place of a board number (structure.js)
export const milestonesChild = 'milestones';
export const milestonesLabel = 'Milestones';
export const milestonesLine = 'The milestones the Mini made are a second list. Nothing in it can be changed.';

// The two boards of the Monday tab, with what each is for, when Dashboard Settings has not named them yet
export const taskBoardStart = '18435126893';
export const milestoneBoardStart = '18435272887';

export const helpLine = 'The Monday tab of Dashboard Settings names two boards: the task board and the milestones board. Pick them there.';
export const chooseLabel = 'Choose boards';
export const nothingYet = 'Nothing yet. The Mini writes this after it has read Monday. See the Monday tab of Dashboard Settings.';
export const noBoardsLine = 'The token of the Mini can see no boards.';
export const openLine = 'Click the name of a chosen board to open its tasks.';
export const publicLine = 'These names are saved in the dataset, which anyone can read. That includes the boards the screen does not use.';
export const unreadableLine = 'The list of boards could not be read. Refresh the page to try again.';
export const settingsUnreadableLine = 'The boards chosen in Dashboard Settings could not be read, so every board reads as not chosen.';

// Only what the page shows, so the question stays small. The boards of the status document come
// with their item counts, and the readings with when each chosen board was last read.
export const statusQuestion = '*[_id == $id][0] { lastSyncAt, lastError, "boards": boards[] { id, name, itemCount }, "readings": readings[] { boardId, itemsRead, readAt, note } }';
// The two boards of the Monday tab, each with what it is for. A page saved before the tab had them reads as the starting boards.
export const entriesQuestion = '*[_id == $id][0] { "entries": [ { "boardId": coalesce(mondayTaskBoard.boardId, "' + taskBoardStart + '"), "team": "the task board" }, { "boardId": coalesce(mondayMilestoneBoard.boardId, "' + milestoneBoardStart + '"), "team": "the milestones board" } ] }';

function list(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function itemsWord(count) {
  return count + (count === 1 ? ' item' : ' items');
}

// The published status document and the board rows of the published Dashboard Settings. This never
// fails: a document that cannot be read is reported as unreadable, and the page says so.
export async function readBoardsPage(client) {
  const read = { status: null, entries: [], statusUnreadable: false, entriesUnreadable: false };

  try {
    const found = await client.fetch(statusQuestion, { id: mondayStatusId }, { perspective: 'published' });
    read.status = isRecord(found) ? found : null;
  } catch (error) {
    read.statusUnreadable = true;
  }

  try {
    const found = await client.fetch(entriesQuestion, { id: settingsId }, { perspective: 'published' });
    read.entries = isRecord(found) ? list(found.entries) : [];
  } catch (error) {
    read.entriesUnreadable = true;
  }
  return read;
}

// The rows of the page: the chosen boards first, then the others, each group in the order the Mini
// wrote. A board that is chosen in Dashboard Settings and that the token cannot see has a row too, with
// the reason, because that is the board whose number is probably wrong. status is the document or
// null, entries is the board rows of Dashboard Settings, and now is the time to count the ages from.
//
// A row has: id, name, items (words), read (words), chosen, team (the name or empty), visible (the
// token can see the board), opens (the name is a link to the tasks of the board), and note.
export function rowsOf(status, entries, now) {
  const boards = isRecord(status) ? list(status.boards).filter(board => typeof board.id === 'string' && board.id !== '') : [];
  const readings = isRecord(status) ? list(status.readings) : [];
  const chosen = list(entries).filter(entry => typeof entry.boardId === 'string' && entry.boardId !== '');
  const entryOf = id => chosen.filter(entry => entry.boardId === id)[0] || null;
  const readingOf = id => readings.filter(reading => reading.boardId === id)[0] || null;

  function rowFor(id, board) {
    const entry = entryOf(id);
    const reading = entry ? readingOf(id) : null;
    const age = reading ? ageText(reading.readAt, now) : '';
    const team = entry && typeof entry.team === 'string' ? entry.team : '';
    let note = reading && typeof reading.note === 'string' && reading.note !== '' ? sentence(reading.note) : '';
    if (entry && !board) note = 'The token cannot see this board, or the board number is wrong.';

    return {
      id: id,
      name: board && typeof board.name === 'string' && board.name !== '' ? board.name : 'Board ' + id,
      items: board && typeof board.itemCount === 'number' ? itemsWord(board.itemCount) : 'Items not counted',
      read: entry ? (age ? 'Read ' + age : 'Not read yet') : 'Not read',
      chosen: Boolean(entry),
      team: team,
      visible: Boolean(board),
      opens: Boolean(entry) && Boolean(board),
      note: note,
    };
  }

  const rows = boards.map(board => rowFor(board.id, board));
  chosen.forEach(entry => {
    if (!rows.some(row => row.id === entry.boardId)) rows.push(rowFor(entry.boardId, null));
  });
  return rows.filter(row => row.chosen).concat(rows.filter(row => !row.chosen));
}

// The words after the name of a row: how many items, when it was last read, and whether it is chosen
export function chosenText(row) {
  if (!row.chosen) return 'Not chosen';
  return row.team ? 'Chosen for ' + row.team : 'Chosen for both teams';
}

// When the Mini last read Monday at all, in words, or nothing when the document has no time
export function updatedText(status, now) {
  const age = isRecord(status) ? ageText(status.lastSyncAt, now) : '';
  return age ? 'The Mini last read Monday ' + age + '.' : '';
}

// The last error of the Mini as a sentence, or nothing
export function errorText(status) {
  return isRecord(status) && typeof status.lastError === 'string' && status.lastError.trim() !== '' ? sentence(status.lastError) : '';
}
