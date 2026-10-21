// The one bar for anything on the control page that saves a draft to Sanity: the same four words in the same order, the same
// line about unsaved changes, and the same card when the Studio changed the document meanwhile. Display, All settings, the
// Content lists, Screen, Scheduled reboot and Clean up expired items all draw it from here, so a student learns it once.
//
//   Save to draft         puts the changes on this page into the draft in Sanity. The wall does not change.
//   Publish to the wall   puts the whole draft on the wall.
//   Refresh from Sanity   reads the document again and drops the changes on this page.
//   Undo                  takes back the last change on this page.
//
// A page that does not need all four (a list saves in a form of its own) asks for the ones it needs with show, and they stay in
// this order. hook(name) says how a page finds its buttons: by data-action or by data-act. Markup is a string with every
// value escaped, so tests can read it with node.

import { agoText, esc } from './tabs/render.js';

export const actionWords = { save: 'Save to draft', publish: 'Publish to the wall', refresh: 'Refresh from Sanity', undo: 'Undo' };
export const actionOrder = ['save', 'publish', 'refresh', 'undo'];

export const byAction = name => 'data-action="' + name + '"';
export const byAct = name => 'data-act="' + name + '"';

// count is how many things are unsaved, or true when it is not counted
export function unsavedWords(count) {
  if (count === true) return 'You have unsaved changes.';
  const number = Number(count) || 0;
  if (number === 0) return 'No unsaved changes.';
  return number + (number === 1 ? ' unsaved change.' : ' unsaved changes.');
}

export const noWriteWords = 'SANITY_WRITE_TOKEN is not set on the Teletraan computer, so nothing can be saved here. Add it in Settings, Keys.';

// state: { dirty (a count or true), canSave, canPublish, canUndo, canRefresh (default true), working, show (a list of the words), note, extra }
// note is a sentence of plain text that goes under the unsaved line. extra is the markup of one more button for this page, such as Cancel,
// put after the four.
export function actionBarHtml(state, hook = byAction) {
  const show = state.show || actionOrder;
  const idle = !state.working;
  const enabled = {
    save: Boolean(state.canSave) && idle,
    publish: Boolean(state.canPublish) && idle,
    refresh: state.canRefresh !== false && idle,
    undo: Boolean(state.canUndo) && idle,
  };
  const quiet = { save: '', publish: '', refresh: ' quiet', undo: ' quiet' };
  const buttons = actionOrder.filter(name => show.includes(name)).map(name =>
    '<button type="button" class="act' + quiet[name] + '" ' + hook(name) + (enabled[name] ? '' : ' disabled') + '>' + actionWords[name] + '</button>').join('') + (state.extra || '');
  const dirty = state.dirty === undefined ? 0 : state.dirty;
  return '<div class="action-bar-buttons buttons" role="group" aria-label="Save and publish">' + buttons + '</div>' +
    '<p class="note unsaved" data-unsaved data-state="' + (dirty ? 'wait' : 'done') + '">' + esc(unsavedWords(dirty)) + '</p>' +
    (state.note ? '<p class="note">' + esc(state.note) + '</p>' : '');
}

// The question when the Studio has a newer copy than the one this page loaded. action is save or publish.
export function studioNewerHtml(conflict, hook = byAction) {
  if (!conflict) return '';
  const when = conflict.updatedAt ? ' It was last changed ' + esc(agoText(conflict.updatedAt)) + '.' : '';
  const publishing = conflict.action === 'publish';
  return '<section class="card studio-changed" data-conflict="' + esc(conflict.action) + '" role="alert"><h2>The Studio has a newer copy</h2>' +
    '<p>' + esc(conflict.error) + when + ' ' + (publishing
      ? 'Publishing now puts that newer draft on the wall.'
      : 'Saving now replaces what you changed here in the Studio draft. Anything else in the document stays as the Studio has it.') + '</p>' +
    '<div class="buttons">' +
    '<button type="button" class="act" ' + hook('overwrite') + '>' + (publishing ? 'Publish the newer draft' : 'Replace the Studio copy') + '</button>' +
    '<button type="button" class="act quiet" ' + hook('refresh') + '>' + actionWords.refresh + '</button>' +
    '<button type="button" class="act quiet" ' + hook('keep-editing') + '>Keep editing</button>' +
    '</div></section>';
}

// The softer card: the Studio changed the document after this page loaded it, and nothing was saved or published yet
export function studioChangedHtml(title, hook = byAction) {
  return '<section class="card studio-changed" data-newer role="alert"><h2>The Studio changed this</h2>' +
    '<p>' + esc(title) + ' changed in the Studio after this page loaded it. Press Refresh from Sanity to see the change, which drops anything you have not saved here. Or keep editing and decide when you save.</p>' +
    '<div class="buttons">' +
    '<button type="button" class="act" ' + hook('refresh') + '>' + actionWords.refresh + '</button>' +
    '<button type="button" class="act quiet" ' + hook('keep-editing') + '>Keep editing</button>' +
    '</div></section>';
}

// What a page says when its document could not be read: the reason, what to do, and the Refresh button
export function failedHtml(what, error) {
  return '<section class="card load-failed" role="alert"><h2>' + esc(what) + ' could not be read</h2><p>' + esc(error) + '</p>' +
    '<p class="note">Check that the Teletraan computer is on the internet, then press Refresh from Sanity.</p>' +
    '<div class="buttons"><button type="button" class="act" data-act="retry">' + actionWords.refresh + '</button></div></section>';
}
