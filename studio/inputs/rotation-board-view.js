// The Rotation page, the first line under SCREEN in the sidebar: a board of the rows the wall plays, in groups of one view,
// with a preview of the loop under it. It is a page of its own, not a document. It edits one field, rotationRows of
// Dashboard Settings (schemas/settingsRotationRows.js), and writes only that field, to the draft of Dashboard Settings,
// the way the Themes page writes themeByWeekday. Publish all puts it on the screen. Nothing here publishes.
//
// The plain functions are in tools/rotation-board.js and the drawing is in rotation-board-parts.js (docs/rotation-board.md).
// A change to a row keeps every other value of the row, including the ones the board does not show. The last twenty lists
// are kept in memory for Undo.
//
// It is written without JSX, so it reads as plain JavaScript: h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useRef, useState } from 'react';
import { useClient } from 'sanity';
import {
  addRow, copyRow, moveRow, moveTo, notPublished, pushUndo, removeRow, removeRows, rowsFrom, saveRows, secondsFrom, setPhotoValue, setRowValue,
  setShown, settingsFrom, skipNotes, skipQuestion, standardRows, startingPhotos, wholeFrom, defaultPageSeconds,
} from '../tools/rotation-board.js';
import { panelChoices, boardCss, stripOfPage, styles, tableOf, toolsOf, words } from './rotation-board-parts.js';
import { autoCss, autoSection } from './rotation-auto-parts.js';
import { blockId } from '../tools/rotation-find.js';
import { competitionModeFrom, frcQuestion } from '../tools/rotation-auto.js';

const h = createElement;

const apiVersion = '2025-02-19';
const settingsId = 'dashboardSettings';
const draftId = 'drafts.dashboardSettings';

export { words };

const question = '*[_id in [$draft, $published]]{ _id, _type, rotationRows, pageSeconds, partsRequestUrl, competitionMode }';

// The page for what it knows: rows is null while reading or when there is no Dashboard Settings
export function pageOf(state, actions) {
  let body;

  if (!state.read) body = h('p', { style: styles.muted }, words.reading);
  else if (!state.rows) body = h('p', { style: styles.failed, role: 'alert' }, notPublished);
  else {
    const tools = toolsOf(state, actions);
    body = h(
      'div',
      { 'data-block': 'board' },
      tools[0],
      tools[1],
      state.rows.length === 0 ? h('p', { style: styles.text, 'data-block': 'empty' }, words.empty) : tableOf(state, actions),
      state.rows.length === 0 ? null : stripOfPage(state),
      autoSection(state)
    );
  }

  return h(
    'div',
    { style: styles.page },
    h('style', null, boardCss + autoCss),
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, words.title),
      h('p', { style: styles.text }, words.intro),
      h('p', { style: styles.muted }, words.phone),
      h('p', { style: styles.muted, 'data-block': 'skip-hint' }, words.skipHint),
      body,
      state.text ? h('p', { role: state.failed ? 'alert' : undefined, 'aria-live': 'polite', style: state.failed ? styles.failed : styles.muted }, state.text) : null
    )
  );
}

export function RotationView(props) {
  const client = useClient({ apiVersion: apiVersion });
  const ask = props && typeof props.confirm === 'function' ? props.confirm : text => (typeof window !== 'undefined' ? window.confirm(text) : true);
  const [state, setState] = useState({
    read: false, rows: null, settings: { pageSeconds: defaultPageSeconds, partsLink: false }, busy: false, text: '', failed: false, open: '', collapsed: {}, selected: {}, history: [],
    newView: 'robotics', newPanel: panelChoices[0].value, dragging: -1, data: null, mode: 'auto', search: '', onlySkipped: false, onlyPlaceholders: false, frc: { read: false, doc: null, unreadable: false },
  });
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    let stopped = false;

    Promise.resolve()
      .then(() => client.fetch(question, { draft: draftId, published: settingsId }, { perspective: 'raw' }))
      .then(found => {
        if (!stopped) setState(Object.assign({}, latest.current, { read: true, rows: rowsFrom(found), settings: settingsFrom(found), mode: competitionModeFrom(found) }));
      })
      .catch(() => {
        if (!stopped) setState(Object.assign({}, latest.current, { read: true, rows: null }));
      });
    // What the wall can show, for the notes under skipped rows. It is read once, from what is published, and a failure only
    // means there are no notes.
    Promise.resolve()
      .then(() => client.fetch(skipQuestion, {}, { perspective: 'published' }))
      .then(data => {
        if (!stopped) setState(Object.assign({}, latest.current, { data: data }));
      })
      .catch(() => {});
    // The competition data the Mini wrote, for the status line of the Automatic panels. A failure only changes the line.
    Promise.resolve()
      .then(() => client.fetch(frcQuestion, {}, { perspective: 'published' }))
      .then(doc => {
        if (!stopped) setState(Object.assign({}, latest.current, { frc: { read: true, doc: doc || null, unreadable: false } }));
      })
      .catch(() => {
        if (!stopped) setState(Object.assign({}, latest.current, { frc: { read: true, doc: null, unreadable: true } }));
      });
    return () => {
      stopped = true;
    };
  }, []);

  function merge(extra) {
    setState(Object.assign({}, latest.current, extra));
  }

  // Shows the new rows at once, writes them, and says how it went. keepHistory false is Undo, which takes a list off the history.
  function change(rows, history) {
    const before = latest.current;
    if (rows === before.rows) return Promise.resolve();
    merge({ rows: rows, history: history || pushUndo(before.history, before.rows), busy: true, text: '', failed: false });

    return saveRows(client, rows)
      .then(() => merge({ rows: rows, busy: false, text: words.saved, failed: false }))
      .catch(error => merge({ rows: before.rows, history: before.history, busy: false, text: words.problem + (error && error.message ? error.message : ''), failed: true }));
  }

  const rowsNow = () => latest.current.rows;
  const selectedKeys = () => Object.keys(latest.current.selected).filter(key => latest.current.selected[key]);

  const actions = {
    edit: (index, field, value) => change(setRowValue(rowsNow(), index, field, value)),
    // A new panel keeps the row's other values, and a Photos row gets the photo values it needs
    panel: (index, panel) => {
      const changed = setRowValue(rowsNow(), index, 'panel', panel);
      return change(panel === 'photo' && !changed[index].photoCount ? setPhotoValue(setPhotoValue(changed, index, 'photoCount', startingPhotos.count), index, 'secondsPerPhoto', startingPhotos.each) : changed);
    },
    seconds: (index, text) => {
      const seconds = secondsFrom(text);
      if (seconds === null) return merge({ text: words.secondsProblem, failed: true });
      return change(setRowValue(rowsNow(), index, 'seconds', seconds));
    },
    photo: (index, field, text, item) => {
      const empty = String(text).trim() === '';
      const number = wholeFrom(text, { min: item.min, max: item.max });
      if (!empty && number === null) return merge({ text: words.numberProblem, failed: true });
      return change(setPhotoValue(rowsNow(), index, field, empty ? '' : number));
    },
    move: (index, delta) => change(moveRow(rowsNow(), index, delta)),
    copy: index => change(copyRow(rowsNow(), index)),
    remove: index => (ask(words.confirmDelete) ? change(removeRow(rowsNow(), index)) : Promise.resolve()),
    removeSelected: () => (ask(words.confirmDeleteMany) ? change(removeRows(rowsNow(), selectedKeys())).then(() => merge({ selected: {} })) : Promise.resolve()),
    showSelected: shown => change(setShown(rowsNow(), selectedKeys(), shown)),
    toggleOpen: key => merge({ open: latest.current.open === key ? '' : key }),
    toggleGroup: key => merge({ collapsed: Object.assign({}, latest.current.collapsed, { [key]: !latest.current.collapsed[key] }) }),
    select: (key, checked) => merge({ selected: Object.assign({}, latest.current.selected, { [key]: checked }) }),
    selectMany: (keys, checked) => merge({ selected: keys.reduce((all, key) => Object.assign(all, { [key]: checked }), Object.assign({}, latest.current.selected)) }),
    selectAll: checked => merge({ selected: checked ? rowsNow().reduce((all, row) => Object.assign(all, { [row._key]: true }), {}) : {} }),
    pick: (name, value) => merge({ [name]: value }),
    jump: key => {
      const line = typeof document !== 'undefined' ? document.getElementById(blockId(key)) : null;
      if (line && line.scrollIntoView) line.scrollIntoView({ block: 'start' });
    },
    add: () => change(addRow(rowsNow(), latest.current.newView, latest.current.newPanel)),
    fill: () => (ask(words.confirmFill) ? change(standardRows()) : Promise.resolve()),
    undo: () => {
      const history = latest.current.history;
      if (history.length === 0) return Promise.resolve();
      return change(history[history.length - 1], history.slice(0, -1));
    },
    dragStart: (index, event) => {
      merge({ dragging: index });
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
        const line = event.currentTarget && event.currentTarget.closest ? event.currentTarget.closest('[data-row]') : null;
        if (line && event.dataTransfer.setDragImage) event.dataTransfer.setDragImage(line, 0, 0);
      }
    },
    drop: to => {
      const from = latest.current.dragging;
      merge({ dragging: -1 });
      return from < 0 ? Promise.resolve() : change(moveTo(rowsNow(), from, to));
    },
  };

  return pageOf(Object.assign({}, state, { skips: state.rows ? skipNotes(state.rows, state.data) : {} }), actions);
}
