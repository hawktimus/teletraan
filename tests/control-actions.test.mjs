// The one action bar of the control page (control/static/actions.js and draft-bar.js): the four words in one order, the unsaved line, the
// card for a newer Studio copy, and that every page that edits a document draws them from there.
//
//   node tests/control-actions.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { actionBarHtml, actionOrder, actionWords, byAct, byAction, failedHtml, studioChangedHtml, studioNewerHtml, unsavedWords } from '../control/static/actions.js';
import { countChanged } from '../control/static/draft-bar.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');

test('the four words and their order are the same for every page', () => {
  assert.deepEqual(actionWords, { save: 'Save to draft', publish: 'Publish to the wall', refresh: 'Refresh from Sanity', undo: 'Undo' });
  assert.deepEqual(actionOrder, ['save', 'publish', 'refresh', 'undo']);
  const html = actionBarHtml({ dirty: 2, canSave: true, canPublish: false, canUndo: true }, byAction);
  const at = ['Save to draft', 'Publish to the wall', 'Refresh from Sanity', 'Undo'].map(word => html.indexOf('>' + word + '<'));
  assert.ok(at.every(index => index > 0) && at.every((index, place) => place === 0 || index > at[place - 1]), 'in this order');
});

test('Save needs a change and a write key, Publish needs a saved draft, Undo needs something to take back, and a busy page presses nothing', () => {
  const html = actionBarHtml({ dirty: 0, canSave: false, canPublish: true, canUndo: false }, byAct);
  assert.match(html, /data-act="save" disabled/);
  assert.doesNotMatch(html, /data-act="publish" disabled/);
  assert.doesNotMatch(html, /data-act="refresh" disabled/);
  assert.match(html, /data-act="undo" disabled/);
  const busy = actionBarHtml({ canSave: true, canPublish: true, canUndo: true, working: true }, byAct);
  assert.equal((busy.match(/ disabled/g) || []).length, 4);
});

test('a page that needs only some of the words gets them in the same order, and one more button of its own', () => {
  const html = actionBarHtml({ show: ['save', 'undo'], dirty: 1, canSave: true, canUndo: true, extra: '<button type="button" class="act quiet" data-act="cancel">Cancel</button>' }, byAct);
  assert.ok(html.indexOf('Save to draft') < html.indexOf('Undo') && html.indexOf('Undo') < html.indexOf('Cancel'));
  assert.ok(!html.includes('Publish to the wall') && !html.includes('Refresh from Sanity'));
});

test('the unsaved line says the same thing on every page', () => {
  assert.equal(unsavedWords(0), 'No unsaved changes.');
  assert.equal(unsavedWords(1), '1 unsaved change.');
  assert.equal(unsavedWords(3), '3 unsaved changes.');
  assert.equal(unsavedWords(true), 'You have unsaved changes.');
  assert.match(actionBarHtml({ dirty: 2 }, byAct), /data-unsaved data-state="wait">2 unsaved changes\./);
  assert.match(actionBarHtml({}, byAct), /data-unsaved data-state="done">No unsaved changes\./);
});

test('the newer Studio copy is one card with the same three answers wherever it comes from', () => {
  const save = studioNewerHtml({ action: 'save', error: 'Dashboard Settings changed in the Studio.', updatedAt: '2026-10-18T12:00:00Z' }, byAction);
  assert.ok(save.includes('The Studio has a newer copy') && save.includes('Replace the Studio copy') && save.includes('Refresh from Sanity') && save.includes('Keep editing'));
  ['overwrite', 'refresh', 'keep-editing'].forEach(name => assert.ok(save.includes('data-action="' + name + '"'), name));
  assert.ok(studioNewerHtml({ action: 'publish', error: 'x', updatedAt: '' }, byAct).includes('Publish the newer draft'));
  assert.equal(studioNewerHtml(null), '');
  assert.ok(!studioNewerHtml({ action: 'save', error: '<script>', updatedAt: '' }).includes('<script>'));
  const soft = studioChangedHtml('Dashboard Settings', byAct);
  assert.ok(soft.includes('The Studio changed this') && soft.includes('Refresh from Sanity') && soft.includes('Keep editing'));
});

test('a page that cannot read its document says what failed, what to do, and has the Refresh button', () => {
  const html = failedHtml('The reboot schedule', 'The Teletraan computer could not be reached.');
  assert.ok(html.includes('The reboot schedule could not be read') && html.includes('could not be reached') && html.includes('Check that the Teletraan computer is on the internet') && html.includes('Refresh from Sanity'));
});

test('the editors count changes by field, and a value that is not a number counts as a change', () => {
  assert.equal(countChanged({ a: 1, b: [1, 2], c: true }, { a: 1, b: [1, 2], c: true }), 0);
  assert.equal(countChanged({ a: 1, b: [1, 2], c: true }, { a: 2, b: [1], c: true }), 2);
  assert.equal(countChanged({ a: 20 }, { a: NaN }), 1);
});

test('every page that edits a document draws the shared bar, and none has a bar of its own', () => {
  const users = {
    'control/static/tabs/display-parts.js': 'actionBarHtml',
    'control/static/tabs/settings-all.js': 'actionBarHtml',
    'control/static/tabs/content-list.js': 'actionBarHtml',
    'control/static/draft-bar.js': 'actionBarHtml',
  };
  Object.keys(users).forEach(file => assert.ok(read(file).includes(users[file]), file));
  ['control/static/tabs/settings-reboot.js', 'control/static/tabs/settings-cleanup.js', 'control/static/tabs/settings-screen.js'].forEach(file => {
    const text = read(file);
    assert.ok(text.includes('mountDraftBar('), file + ' uses the shared bar');
    assert.ok(!/data-save>|data-publish>|data-apply>|>Save and publish<|replaceQuestion/.test(text), file + ' has no bar or question of its own');
  });
  ['control/static/tabs/content-list.js', 'control/static/tabs/content-ticker.js', 'control/static/tabs/content-calendar.js'].forEach(file => {
    assert.ok(read(file).includes('actionWords'), file + ' names Publish to the wall from the one list of words');
  });
});

test('no button of the control page says only Publish, Save or Refresh: they say the shared words', () => {
  // the Log section reads lines of a log, not a document in Sanity, so its Refresh is not one of these
  const files = fs.readdirSync(repo + 'control/static/tabs').filter(name => name.endsWith('.js') && name !== 'settings-log.js').map(name => 'control/static/tabs/' + name);
  files.forEach(file => {
    const text = read(file);
    assert.ok(!/>Publish<\/button>|, 'Publish',|text: 'Publish'|button\('Publish'|button\('Refresh'|>Refresh<\/button>|button\('Save'/.test(text), file);
  });
});

await finish();
