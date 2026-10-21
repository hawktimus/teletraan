// The Clean up expired items section of Settings: the switch, the days and the mode of the nightly clean up, what it did last, a
// button that lists what would be deleted now, and (only when Mode is Delete) a button that deletes that list. The Studio stays the
// source of truth: this reads Dashboard Settings from Sanity (through the control service), saves to the draft the Studio also
// uses, and publishes with its own button after the owner says yes. The write key is never in the browser. The markup functions
// touch nothing, so tests/control-cleanup.test.mjs can try them with node.

import { api, showResult, useStyles } from './api.js';
import { agoText, esc } from './render.js';
import { choiceHtml, switchHtml } from '../choice.js';
import { failedHtml, noWriteWords } from '../actions.js';
import { countChanged, mountDraftBar } from '../draft-bar.js';

export const publishQuestion = 'Publish to the wall puts every waiting change of Dashboard Settings on the wall, including edits made in the Studio. The Teletraan computer reads the clean up setting when it runs at 03:40. Publish now?';

// The question before anything is deleted: how many, and that a backup comes first
export function deleteQuestion(count) {
  const them = count === 1 ? 'it' : 'them';
  return 'Delete ' + count + (count === 1 ? ' document' : ' documents') + ' from the Studio now? A backup of ' + them + ' is saved on the Teletraan computer first, and docs/expired-cleanup.md says how to put ' + them + ' back.';
}

// "Last run: 3 hours ago, 4 on the list, 0 deleted" in plain words
export function statusWords(status, now = new Date()) {
  const info = status || {};
  if (!info.lastAt) return { last: 'Last run: not yet', problem: '' };
  const counts = (info.wouldDelete === null || info.wouldDelete === undefined ? '' : ', ' + info.wouldDelete + ' on the list') + (info.deleted === null || info.deleted === undefined ? '' : ', ' + info.deleted + ' deleted');
  return { last: 'Last run: ' + agoText(info.lastAt, now) + counts, problem: info.error || '' };
}

// The list that Show what would be deleted now got back
export function listHtml(preview) {
  const rows = preview.items.map(item =>
    '<li><strong>' + esc(item.title) + '</strong> <span class="note">' + esc(item.kind) + ', expired ' + esc(item.expiredOn) + ', ' + esc(item.ageDays) + (item.ageDays === 1 ? ' day' : ' days') + ' ago</span></li>').join('');
  const notes = preview.notes.map(note => '<li class="note">' + esc(note) + '</li>').join('');
  const head = preview.items.length === 0 ? '<p data-count>Nothing is old enough to delete.</p>' : '<p data-count><strong>' + preview.items.length + (preview.items.length === 1 ? ' document' : ' documents') + '</strong> would be deleted:</p>';
  return head + (preview.stop ? '<p class="warn">' + esc(preview.stop) + '</p>' : '') + (rows ? '<ul data-items>' + rows + '</ul>' : '') + (notes ? '<ul data-notes>' + notes + '</ul>' : '');
}

export function cleanupHtml(page, now = new Date()) {
  const setting = page.setting;
  const words = statusWords(page.status, now);
  const lines = [];
  if (!page.hasDocument) lines.push('<p class="warn">Dashboard Settings has not been published yet. Open it in the Studio, click Publish once, and come back.</p>');
  if (!page.canWrite) lines.push('<p class="warn">' + esc(noWriteWords) + '</p>');
  if (page.status && page.status.unreadable) lines.push('<p class="warn">What the last run did could not be read from Sanity just now.</p>');
  if (page.isDraft && page.studioNewer) lines.push('<p class="note">A draft is waiting. The computer uses the published setting until you press Publish to the wall.</p>');
  const deleting = page.published && page.published.cleanupMode === 'delete';
  const modes = choiceHtml({ name: 'cleanup-mode', label: 'Mode', items: [
    { value: 'list', label: 'Only show what would be deleted', checked: setting.cleanupMode === 'list', attrs: 'data-mode' },
    { value: 'delete', label: 'Delete the items', checked: setting.cleanupMode === 'delete', attrs: 'data-mode' },
  ] });

  return '<section class="card cleanup-card"><h2>Clean up expired items</h2>' +
    '<p data-last><strong>' + esc(words.last) + '</strong></p>' +
    (words.problem ? '<p class="warn" data-problem>' + esc(words.problem) + '</p>' : '') +
    lines.join('') +
    switchHtml({ checked: setting.cleanupEnabled, label: 'Clean up expired items every night at 03:40', attrs: 'data-enabled' }) +
    '<label class="pick"><span>Wait this many days after an item expired</span><input type="number" inputmode="numeric" min="1" max="365" step="1" data-days value="' + esc(setting.cleanupDeleteAfterDays) + '"></label>' +
    '<div class="pick"><span>Mode</span>' + modes + '</div>' +
    '<div data-draft></div>' +
    '<h3>What would be deleted now</h3>' +
    '<div class="buttons"><button type="button" class="act" data-preview>Show what would be deleted now</button></div>' +
    '<div data-list></div>' +
    '<p class="note">' + 'The Studio shows the same values in Dashboard Settings, Advanced, Clean up expired items. Nothing is deleted while the switch is off or Mode is Only show. Items edited in the last 2 days are never deleted. ' +
    (deleting ? 'Mode is Delete in the published settings.' : 'Mode is Only show in the published settings, so there is no delete button.') + '</p>' +
    '</section>';
}

// The values on the page, as the stored fields
export function readForm(container) {
  const days = container.querySelector('[data-days]').value.trim();
  const chosen = container.querySelector('[data-mode]:checked');
  return {
    cleanupEnabled: container.querySelector('[data-enabled]').checked,
    cleanupDeleteAfterDays: /^[0-9]{1,3}$/.test(days) ? Number(days) : NaN,
    cleanupMode: chosen ? chosen.value : 'list',
  };
}

export async function mountCleanup(container) {
  useStyles();
  container.innerHTML = '<p class="note">Reading the setting from Sanity.</p>';
  let page = null;
  let draft = null;

  // Drawing the card again is also the undo: it puts back the values that were loaded
  function draw() {
    container.innerHTML = cleanupHtml(page);
    draft = mountDraftBar(container.querySelector('[data-draft]'), {
      canWrite: () => page.canWrite,
      isDraft: () => page.isDraft,
      dirty: () => countChanged(page.setting, readForm(container)),
      problem: () => (Number.isNaN(readForm(container).cleanupDeleteAfterDays) ? 'Wait this many days should be a whole number from 1 to 365.' : ''),
      save: force => api('POST', '/cleanup/save', { setting: readForm(container), baseRev: page.rev, force: force }),
      publish: force => api('POST', '/cleanup/publish', { rev: page.rev, force: force, confirm: true }),
      reload: load,
      undo: draw,
      publishQuestion: publishQuestion,
      publishedWords: 'Published. The computer reads the setting when it runs at 03:40.',
    });
    container.querySelector('[data-preview]').addEventListener('click', event => preview(event.currentTarget));
  }

  async function load() {
    const answer = await api('GET', '/cleanup');
    if (!answer.ok) {
      container.innerHTML = failedHtml('The clean up setting', answer.error);
      return false;
    }
    page = answer.data;
    draw();
    return true;
  }

  async function preview(button) {
    showResult(button, 'working', 'Looking through the Studio. This takes a few seconds.');
    const answer = await api('POST', '/cleanup/preview', {});
    if (!answer.ok) return showResult(button, 'bad', answer.error);
    const holder = container.querySelector('[data-list]');
    holder.innerHTML = listHtml(answer.data);
    showResult(button, 'done', 'Nothing was deleted.');
    // The delete button exists only when the published Mode is Delete and there is something to delete
    const count = answer.data.items.length;
    if (page.published.cleanupMode === 'delete' && count > 0 && !answer.data.stop) {
      const row = document.createElement('div');
      row.className = 'buttons';
      row.innerHTML = '<button type="button" class="act" data-delete>Delete these now</button>';
      holder.append(row);
      row.querySelector('[data-delete]').addEventListener('click', event => remove(event.currentTarget, count));
    }
  }

  async function remove(button, count) {
    if (!window.confirm(deleteQuestion(count))) return showResult(button, 'wait', 'Nothing was deleted.');
    showResult(button, 'working', 'Saving a backup and deleting.');
    const answer = await api('POST', '/cleanup/delete', { confirmed: true, expected: count });
    if (!answer.ok) return showResult(button, 'bad', answer.error);
    const holder = container.querySelector('[data-list]');
    holder.innerHTML = '<p data-result><strong>' + esc(answer.data.result || 'Done.') + '</strong></p>' + listHtml(answer.data);
    // The status line is read again, so it shows this run
    const fresh = await api('GET', '/cleanup');
    if (fresh.ok) container.querySelector('[data-last]').innerHTML = '<strong>' + esc(statusWords(fresh.data.status).last) + '</strong>';
  }

  container.addEventListener('input', () => { if (draft) draft.paint(); });
  container.addEventListener('change', () => { if (draft) draft.paint(); });
  container.addEventListener('click', event => { if (event.target.closest('[data-act="retry"]')) load(); });
  await load();
}
