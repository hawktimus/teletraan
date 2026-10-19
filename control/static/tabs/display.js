// The Display tab: the rotation rows and the theme and view settings of the wall. The Studio stays the source of truth.
// This reads Dashboard Settings from Sanity (through the control service), lets the team reorder and change the rows,
// saves to the draft, and publishes with its own button. Before it saves it asks the service to compare the revision it
// loaded with the one in Sanity, and it asks before replacing a newer Studio edit. The write key is never in the browser.

import { registerTab } from '../tabs.js';
import { api, useStyles } from './api.js';
import { addRow, copyRow, countWhere, isNovaRow, isPanelRow, moveRow, photoRange, quickAction, removeRow, sameRows, secondsFrom, setPhotoValue, setRowValue, setShownWhere, wholeFrom, withKeys } from '../display-rows.js';
import { addRowHtml, checkHtml, chipHtml, conflictHtml, controlsHtml, extrasHtml, quickHtml, rowsHtml, sourceHtml, summaryWords, themeHtml } from './display-parts.js';

const undoLimit = 20;
const checkDelay = 600;
const revEvery = 60000;

// Kept while the page is open, so leaving the tab and coming back does not lose edits that are not saved
let kept = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function themeChanges(page) {
  const changes = {};
  const now = page.theme;
  const saved = page.savedTheme;
  if (!sameRows(now.themeByWeekday, saved.themeByWeekday)) changes.themeByWeekday = now.themeByWeekday;
  if (now.generalViewTitle !== saved.generalViewTitle && now.generalViewTitle.trim() !== '') changes.generalViewTitle = now.generalViewTitle;
  if (now.transitionSeconds !== saved.transitionSeconds && now.transitionSeconds !== null) changes.transitionSeconds = now.transitionSeconds;
  return changes;
}

function isDirty(page) {
  return !sameRows(page.rows, page.savedRows) || Object.keys(themeChanges(page)).length > 0;
}

export async function mountDisplay(container) {
  useStyles();
  container.innerHTML = '<div class="tab display-page">' +
    '<section class="card"><h2>Display</h2>' +
    '<p class="word">The rows the wall plays, top to bottom, and the theme of each weekday. The Studio is the source of truth: this reads from it and saves to the same draft the Studio Rotation board uses.</p>' +
    '<div data-source></div><div data-controls></div><p class="result" role="status" data-flash></p></section>' +
    '<div data-conflict></div>' +
    '<div data-quick-box></div><section class="card"><h2>Rows</h2><p class="word" data-summary></p><div data-rows></div></section>' +
    '<div data-add></div><div data-theme></div><div data-extras></div></div>';
  const find = name => container.querySelector('[' + name + ']');
  const boxes = { source: find('data-source'), controls: find('data-controls'), flash: find('data-flash'), conflict: find('data-conflict'), summary: find('data-summary'), quick: find('data-quick-box'), rows: find('data-rows'), add: find('data-add'), theme: find('data-theme'), extras: find('data-extras') };

  let page = kept;
  let checkTimer = null;
  let revTimer = null;
  let armed = null;
  let gone = false;

  function flash(state, words) {
    boxes.flash.dataset.state = state;
    boxes.flash.textContent = words;
  }

  function paintTop() {
    page.dirty = isDirty(page);
    page.canUndo = page.history.length > 0;
    boxes.source.innerHTML = sourceHtml(page);
    boxes.controls.innerHTML = controlsHtml(page);
    boxes.conflict.innerHTML = conflictHtml(page.conflict);
    boxes.summary.textContent = summaryWords(page.rows, page.checks, page.pageSeconds);
  }

  function paintRows() {
    boxes.rows.innerHTML = rowsHtml(page.rows, page);
    boxes.quick.innerHTML = quickHtml(page.rows, page.choices);
    paintTop();
  }

  function paintAll() {
    paintRows();
    boxes.add.innerHTML = addRowHtml(page.choices);
    boxes.theme.innerHTML = themeHtml(page.theme, page.choices);
    boxes.extras.innerHTML = extrasHtml(page.extras);
  }

  // The answer of the wall check goes into the cards in place, so a field being typed in is not redrawn
  function paintChecks() {
    page.rows.forEach(row => {
      const card = boxes.rows.querySelector('[data-key="' + row._key + '"]');
      if (!card) return;
      const check = page.checks[row._key];
      card.querySelector('.check-area').innerHTML = checkHtml(check);
      const chip = card.querySelector('.chip');
      chip.outerHTML = chipHtml(check, row);
    });
    boxes.summary.textContent = summaryWords(page.rows, page.checks, page.pageSeconds);
  }

  function askCheck(fresh) {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(async () => {
      const answer = await api('POST', '/display/check', { rows: page.rows, fresh: fresh === true });
      if (gone || !answer.ok) return;
      page.checks = answer.data.rows || {};
      page.wallProblem = answer.data.problem || '';
      paintChecks();
    }, checkDelay);
  }

  function change(next, wantCheck) {
    page.history = page.history.concat([page.rows]).slice(-undoLimit);
    page.rows = next;
    page.conflict = null;
    paintRows();
    if (wantCheck) askCheck(false);
  }

  function take(data) {
    page = {
      hasDocument: data.hasDocument, rev: data.rev, updatedAt: data.updatedAt, isDraft: data.isDraft, studioNewer: data.studioNewer,
      canWrite: data.canWrite, rows: data.rows, savedRows: clone(data.rows), theme: clone(data.theme), savedTheme: clone(data.theme),
      choices: data.choices, pageSeconds: data.pageSeconds, standardRows: data.standardRows, checks: data.wall.rows || {},
      extras: data.wall.extras, wallProblem: data.wall.problem || '', loadedAt: data.serverTime, newerInStudio: false,
      conflict: null, history: [], dirty: false, canUndo: false,
    };
    kept = page;
  }

  async function load(fresh) {
    flash('wait', 'Reading Dashboard Settings from Sanity.');
    const answer = await api('GET', '/display' + (fresh ? '?fresh=1' : ''));
    if (gone) return false;
    if (!answer.ok) {
      flash('bad', answer.error);
      if (!page) boxes.controls.innerHTML = '<div class="buttons"><button type="button" class="act" data-action="refresh">Refresh from Sanity</button></div>';
      return false;
    }
    take(answer.data);
    paintAll();
    flash('done', '');
    return true;
  }

  async function checkRev() {
    if (gone || !page) return;
    const answer = await api('GET', '/display/rev');
    if (gone || !answer.ok || !page) return;
    if (answer.data.rev !== page.rev && !page.newerInStudio) {
      page.newerInStudio = true;
      paintTop();
    }
  }

  async function save(force) {
    if (!isDirty(page)) return;
    const body = { baseRev: page.rev, force: force === true };
    if (!sameRows(page.rows, page.savedRows)) body.rows = page.rows;
    const theme = themeChanges(page);
    if (Object.keys(theme).length > 0) body.theme = theme;

    flash('wait', 'Saving to the draft.');
    const answer = await api('POST', '/display/save', body);
    if (!answer.ok) {
      if (answer.data && answer.data.conflict) {
        page.conflict = { action: 'save', error: answer.data.error, updatedAt: answer.data.current && answer.data.current.updatedAt };
        paintTop();
        boxes.conflict.scrollIntoView({ block: 'center' });
        flash('wait', 'Nothing was saved. Choose what to do about the newer Studio copy.');
        return;
      }
      flash('bad', answer.error);
      return;
    }
    const history = page.history;
    if (await load(true)) {
      page.history = history;
      paintTop();
      flash('done', 'Saved to the draft. Press Publish to the wall when you are ready.');
    }
  }

  async function publish(force) {
    flash('wait', 'Publishing.');
    const answer = await api('POST', '/display/publish', { rev: page.rev, force: force === true });
    if (!answer.ok) {
      if (answer.data && answer.data.conflict) {
        page.conflict = { action: 'publish', error: answer.data.error, updatedAt: answer.data.current && answer.data.current.updatedAt };
        paintTop();
        boxes.conflict.scrollIntoView({ block: 'center' });
        flash('wait', 'Nothing was published. Choose what to do about the newer draft.');
        return;
      }
      flash('bad', answer.error);
      return;
    }
    if (await load(true)) flash('done', 'Published. The wall picks the change up within a minute.');
  }

  function indexOfKey(key) {
    return page.rows.findIndex(row => row._key === key);
  }

  function onClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (!page && action !== 'refresh') return;
    const card = button.closest('.drow');
    const index = card ? indexOfKey(card.dataset.key) : -1;

    if (action !== 'delete') armed = null;
    if (action === 'refresh') load(true);
    else if (action === 'save') save(false);
    else if (action === 'publish') publish(false);
    else if (action === 'keep-editing') { page.conflict = null; paintTop(); flash('done', ''); }
    else if (action === 'overwrite') {
      const was = page.conflict && page.conflict.action;
      page.conflict = null;
      if (was === 'publish') publish(true);
      else save(true);
    } else if (action === 'undo') {
      if (page.history.length === 0) return;
      page.rows = page.history[page.history.length - 1];
      page.history = page.history.slice(0, -1);
      page.conflict = null;
      paintRows();
      askCheck(false);
    } else if (action === 'quick-nova' || action === 'quick-panel') {
      const test = action === 'quick-nova' ? isNovaRow : isPanelRow(button.dataset.panel);
      const what = quickAction(countWhere(page.rows, test));
      change(setShownWhere(page.rows, test, !what.hide), true);
      flash('done', (what.hide ? 'Hidden ' : 'Shown ') + what.rows + (what.rows === 1 ? ' row' : ' rows') + ' on this page. Press Save to draft to keep it.');
    } else if (action === 'up') change(moveRow(page.rows, index, -1), false);
    else if (action === 'down') change(moveRow(page.rows, index, 1), false);
    else if (action === 'copy') change(copyRow(page.rows, index), true);
    else if (action === 'delete') {
      if (armed !== card.dataset.key) {
        armed = card.dataset.key;
        button.textContent = 'Press again to delete';
        setTimeout(() => { armed = null; button.textContent = 'Delete'; }, 4000);
        return;
      }
      armed = null;
      change(removeRow(page.rows, index), false);
    } else if (action === 'add') {
      const panel = boxes.add.querySelector('[data-add="panel"]').value;
      if (panel === '') return flash('bad', 'Pick a panel to add.');
      change(addRow(page.rows, boxes.add.querySelector('[data-add="view"]').value, panel), true);
      flash('done', 'Row added at the end of the list.');
    } else if (action === 'standard') {
      if (armed !== 'standard') {
        armed = 'standard';
        button.textContent = 'Press again to replace the list';
        setTimeout(() => { armed = null; button.textContent = 'Fill from the standard order'; }, 4000);
        return;
      }
      armed = null;
      change(withKeys(page.standardRows), true);
    }
  }

  function onChange(event) {
    const target = event.target;
    const card = target.closest('.drow');

    if (card && target.dataset.field) {
      const index = indexOfKey(card.dataset.key);
      const name = target.dataset.field;
      if (name === 'shown') return change(setRowValue(page.rows, index, 'shown', target.checked), true);
      if (name === 'view' || name === 'panel') return change(setRowValue(page.rows, index, name, target.value), true);
      if (name === 'seconds') {
        const seconds = secondsFrom(target.value);
        if (seconds === null) return flash('bad', 'Seconds should be a whole number from 6 to 120, or empty.');
        return change(setRowValue(page.rows, index, 'seconds', seconds), false);
      }
      if (name === 'photoCount' || name === 'secondsPerPhoto') {
        const value = wholeFrom(target.value, name === 'photoCount' ? photoRange.count : photoRange.each);
        if (value === null) return flash('bad', name === 'photoCount' ? 'Photos should be a whole number from 1 to 20.' : 'Seconds per photo should be a whole number from 5 to 60.');
        return change(setPhotoValue(page.rows, index, name, value), false);
      }
      return;
    }
    if (target.dataset.themeDay) page.theme.themeByWeekday[target.dataset.themeDay] = target.value;
    else if ('themeTitle' in target.dataset) page.theme.generalViewTitle = target.value;
    else if ('themeTransition' in target.dataset) {
      const number = Number(target.value);
      page.theme.transitionSeconds = target.value.trim() === '' || !isFinite(number) ? null : number;
    } else return;
    flash('done', '');
    paintTop();
  }

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);

  if (page) {
    paintAll();
    askCheck(false);
  } else {
    await load(false);
  }
  revTimer = setInterval(checkRev, revEvery);

  return () => {
    gone = true;
    clearTimeout(checkTimer);
    clearInterval(revTimer);
    container.removeEventListener('click', onClick);
    container.removeEventListener('change', onChange);
  };
}

registerTab({
  id: 'display',
  title: 'Display',
  order: 15,
  render(container) {
    return mountDisplay(container);
  },
});
