// The Display tab has two columns from 1000 px, never three. The right one stays in view while the page scrolls: the large preview
// and, under it, the one bar of Save to draft, Publish to the wall, Refresh from Sanity and Undo. The left one is one stack of
// full width cards that scrolls: the strip of what is pushed, On the wall now, Theme, Announce and effects (tabs/push.js), then the
// Rotation rows and the Theme rotation of each weekday. What the wall says (ticker, calendar, roster, announcements, photos) is the
// Content tab. A phone has one column with the preview first.
// The Studio stays the source of truth for the rotation.
// This reads Dashboard Settings from Sanity (through the control service), lets the team reorder and change the rows,
// saves to the draft, and publishes with its own button. Before it saves it asks the service to compare the revision it
// loaded with the one in Sanity, and it asks before replacing a newer Studio edit. The write key is never in the browser.

import { registerTab } from '../tabs.js';
import { api, useStyles } from './api.js';
import { addChartRows, addDepartmentRows, addRow, copyRow, countWhere, isNovaRow, isPanelRow, mondayFieldNames, moveRow, photoRange, quickAction, removeRetired, removeRow, retiredCount, sameRows, secondsFrom, setPhotoValue, setRowValue, setShownWhere, wholeFrom, withKeys } from '../display-rows.js';
import { addRowHtml, checkHtml, chipHtml, conflictHtml, controlsHtml, newerHtml, motionHtml, playlistWords, quickHtml, rowsHtml, sourceHtml, summaryWords, themeHtml, titlesOf } from './display-parts.js';
import { largeHtml } from './display-preview-parts.js';
import { patchRows } from './display-patch.js';
import { startPictures } from './display-preview.js';
import { startPush } from './push.js';
import { chosen } from '../choice.js';
import { lead, moreToolsHtml, sentences, wireMoreTools } from '../guide.js';
import { quickBarHtml } from './render.js';

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

function motionChanges(page) {
  const changes = {};
  Object.keys(page.motion).forEach(name => {
    if (page.motion[name] !== page.savedMotion[name]) changes[name] = page.motion[name];
  });
  return changes;
}

function isDirty(page) {
  return !sameRows(page.rows, page.savedRows) || Object.keys(themeChanges(page)).length > 0 || Object.keys(motionChanges(page)).length > 0;
}

export async function mountDisplay(container) {
  useStyles();
  container.innerHTML = '<div class="tab display-page"><div class="display-split">' +
    // The right column comes first in the page, so a phone shows the preview before everything else
    largeHtml() +
    '<div class="display-left">' +
    lead('display') +
    // The strip is not a card: one slim line of what is pushed, with Cancel and Reset
    '<div class="pushed-strip" data-active></div>' +
    '<div data-now-box></div><div data-theme-now-box></div><div data-announce-box></div><div data-extension-slot="before"></div>' +
    '<section class="card"><h2>Rotation (what plays, in order)</h2>' + lead('display.rotation') +
    '<p class="word">The Studio is the source of truth: this reads from it and saves to the same draft as the Rotation board in the Studio.</p>' +
    '<div data-source></div></section>' +
    '<section class="card rows-card" data-rotation-card tabindex="-1"><h2>Rows</h2>' + lead('display.rows') + '<p class="word" data-summary></p><div data-rows></div></section>' +
    '<div data-add></div><div data-theme></div>' +
    moreToolsHtml('display', '<div data-quick-box></div><div data-motion-box></div>', sentences['display.more']) +
    '<div data-extension-slot="after"></div></div></div>' + quickBarHtml() + '</div>';
  wireMoreTools(container);
  const find = name => container.querySelector('[' + name + ']');
  const boxes = { nowBox: find('data-now-box'), themeNowBox: find('data-theme-now-box'), announceBox: find('data-announce-box'), strip: find('data-active'), conflict: find('data-conflict'), source: find('data-source'), summary: find('data-summary'), quick: find('data-quick-box'), rows: find('data-rows'), add: find('data-add'), theme: find('data-theme'), motion: find('data-motion-box'), bar: find('data-save-bar'), rotation: find('data-rotation-card') };

  let page = kept;
  let checkTimer = null;
  let revTimer = null;
  let armed = null;
  let gone = false;
  let pictures = null;
  let push = null;
  let timing = { today: '', timeZone: '', serverTime: '' };
  let report = null;
  const flashLine = find('data-save-flash');

  function flash(state, words) {
    flashLine.dataset.state = state;
    flashLine.textContent = words;
  }

  function paintTop() {
    page.dirty = isDirty(page);
    page.canUndo = page.history.length > 0;
    boxes.source.innerHTML = sourceHtml(page);
    boxes.bar.innerHTML = controlsHtml(page);
    boxes.conflict.innerHTML = conflictHtml(page.conflict) || newerHtml(page);
    boxes.summary.textContent = summaryWords(page.rows, page.checks, page.pageSeconds);
    paintPlaylist();
  }

  // The three lines of On the wall now that come from the rotation list and the report of the wall
  function paintPlaylist() {
    const words = playlistWords(page, report, titlesOf(page.choices));
    [['data-play-now', words.playing], ['data-play-next', words.next], ['data-play-loop', words.loop]].forEach(item => {
      const line = container.querySelector('[' + item[0] + ']');
      if (line) line.textContent = item[1];
    });
  }

  function paintRows() {
    // The cards that stay keep their element, so the small live picture in them is not loaded again (display-patch.js)
    patchRows(boxes.rows, rowsHtml(page.rows, page));
    boxes.quick.innerHTML = quickHtml(page.rows, page.choices);
    paintTop();
    if (!pictures) pictures = startPictures(container, () => page, titlesOf);
    pictures.rowsPainted();
  }

  function paintAll() {
    paintRows();
    boxes.add.innerHTML = addRowHtml(page.choices);
    boxes.theme.innerHTML = themeHtml(page.theme, page.choices, timing);
    boxes.motion.innerHTML = motionHtml(page.motion);
    paintTop();
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
    if (pictures) pictures.checksChanged();
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

  // A row is drawn again after each change, so the keyboard would lose its place. The control that was used gets the focus back.
  let usedControl = null;

  function refocus() {
    const used = usedControl;
    usedControl = null;
    if (!used) return;
    const card = boxes.rows.querySelector('[data-key="' + used.key + '"]');
    const found = card && Array.from(card.querySelectorAll('[data-field="' + used.field + '"]')).filter(input => used.radio ? input.value === used.value : true)[0];
    if (found) found.focus({ preventScroll: true });
  }

  function change(next, wantCheck) {
    page.history = page.history.concat([page.rows]).slice(-undoLimit);
    page.rows = next;
    page.conflict = null;
    paintRows();
    refocus();
    if (wantCheck) askCheck(false);
  }

  function take(data) {
    page = {
      hasDocument: data.hasDocument, rev: data.rev, updatedAt: data.updatedAt, isDraft: data.isDraft, studioNewer: data.studioNewer,
      canWrite: data.canWrite, rows: data.rows, savedRows: clone(data.rows), theme: clone(data.theme), savedTheme: clone(data.theme), motion: clone(data.motion), savedMotion: clone(data.motion),
      choices: data.choices, pageSeconds: data.pageSeconds, standardRows: data.standardRows, checks: data.wall.rows || {},
      wallProblem: data.wall.problem || '', loadedAt: data.serverTime, newerInStudio: false,
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
      if (!page) boxes.bar.innerHTML = '<div class="buttons"><button type="button" class="act" data-action="refresh">Refresh from Sanity</button></div>';
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
    page.latestRev = answer.data.rev;
    // A copy the person chose to ignore is not announced again until the Studio changes it once more
    if (answer.data.rev !== page.rev && answer.data.rev !== page.ignoredRev && !page.newerInStudio) {
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
    const motion = motionChanges(page);
    if (Object.keys(motion).length > 0) body.motion = motion;

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
    else if (action === 'edit-rows') {
      boxes.rotation.scrollIntoView({ block: 'start' });
      const first = boxes.rows.querySelector('select, input');
      (first || boxes.rotation).focus({ preventScroll: true });
    }
    else if (action === 'save') save(false);
    else if (action === 'publish') publish(false);
    else if (action === 'keep-editing') {
      page.conflict = null;
      if (page.newerInStudio) { page.newerInStudio = false; page.ignoredRev = page.latestRev; }
      paintTop();
      flash('done', '');
    }
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
    } else if (action === 'remove-retired') {
      const count = retiredCount(page.rows);
      if (count === 0) return;
      change(removeRetired(page.rows), true);
      flash('done', 'Removed ' + count + (count === 1 ? ' retired Monday row' : ' retired Monday rows') + ' on this page. Press Save to draft, then Publish to the wall. Undo brings them back.');
    } else if (action === 'add-departments' || action === 'add-charts') {
      const next = action === 'add-departments' ? addDepartmentRows(page.rows) : addChartRows(page.rows);
      const added = next.length - page.rows.length;
      if (added === 0) return;
      change(next, true);
      flash('done', 'Added ' + added + (added === 1 ? ' row' : ' rows') + ' at the end of the list. Press Save to draft, then Publish to the wall. Undo takes them away.');
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
      if (panel === '') return flash('bad', 'Pick a panel to add, then press Add row at the end.');
      change(addRow(page.rows, chosen(boxes.add.querySelector('.choices')), panel), true);
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
      usedControl = { key: card.dataset.key, field: target.dataset.field, value: target.value, radio: target.type === 'radio' };
      const index = indexOfKey(card.dataset.key);
      const name = target.dataset.field;
      if (name === 'shown') return change(setRowValue(page.rows, index, 'shown', target.checked), true);
      if (name === 'view' || name === 'panel') return change(setRowValue(page.rows, index, name, target.value), true);
      if (mondayFieldNames.includes(name)) return change(setRowValue(page.rows, index, name, target.value), true);
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
    if (target.dataset.motionField) page.motion[target.dataset.motionField] = target.value;
    else if (target.dataset.themeDay) {
      page.theme.themeByWeekday[target.dataset.themeDay] = target.value;
    }
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

  if (page && !gone) {
    push = startPush(container, { strip: boxes.strip, now: boxes.nowBox, theme: boxes.themeNowBox, announce: boxes.announceBox }, {
      choices: () => page.choices,
      rows: () => page.rows,
      selectedRow: () => (pictures && pictures.selected() ? page.rows.find(row => row._key === pictures.selected()) : null) || null,
      pictures: () => pictures,
      // Today, the time zone and the clock of the computer come with the answer, so Theme rotation can write the dates and mark today.
      // It is told again when the day changes.
      onState: state => {
        timing = { today: state.today, timeZone: state.timeZone, serverTime: state.serverTime };
        boxes.theme.innerHTML = themeHtml(page.theme, page.choices, timing);
        paintTop();
      },
      onReport: wall => {
        report = wall;
        paintPlaylist();
      },
      onPainted: paintPlaylist,
    });
    push.start();
  }

  return () => {
    gone = true;
    if (pictures) pictures.destroy();
    if (push) push.destroy();
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
