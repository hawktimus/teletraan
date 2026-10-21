// The working of the shared bar (actions.js) for a page that edits a few fields of one document: Scheduled reboot, Clean up
// expired items and the Screen fit. The page gives the small parts that differ, and this file does what every such page does:
// draws the four buttons and the unsaved line, saves to the draft, asks before a newer Studio copy is overwritten, asks before it
// publishes, reads the document again and takes a change back. The words are the same on every page.
//
// spec:
//   canWrite()         true when the Teletraan computer has the write key
//   note()             one more plain sentence for under the bar, or nothing
//   isDraft()          true when a draft is waiting in Sanity
//   dirty()            how many things on the page differ from what was loaded
//   problem()          a sentence when the page holds a value that cannot be saved, or ''
//   save(force)        asks the service to save, gives its answer { ok, data, error }
//   publish(force)     asks the service to publish, gives its answer
//   reload()           reads the document again and draws the page, gives true when it worked
//   undo()             puts the loaded values back on the page
//   publishQuestion    the question before publishing, or '' for none
//   publishedWords     what is said after a publish

import { showResult } from './tabs/api.js';
import { actionBarHtml, actionWords, byAct, studioNewerHtml } from './actions.js';

// How many of the named fields differ between what was loaded and what the page holds now. A number that is not a number differs.
export function countChanged(before, now) {
  return Object.keys(now).filter(name => JSON.stringify(before[name]) !== JSON.stringify(now[name])).length;
}

// A page that reads its document again draws itself again, with a new bar. The words of the result wait here for that new bar.
let carried = null;

export function mountDraftBar(box, spec) {
  box.innerHTML = '<div class="action-bar" data-bar></div><div data-conflict></div>';
  const bar = box.querySelector('[data-bar]');
  const conflictBox = box.querySelector('[data-conflict]');
  const state = { working: false, conflict: null };

  function paint() {
    const dirty = spec.dirty();
    const note = spec.note ? spec.note() : '';
    bar.innerHTML = actionBarHtml({
      dirty: dirty, canSave: spec.canWrite() && dirty > 0, canPublish: spec.canWrite() && spec.isDraft() && dirty === 0, canUndo: dirty > 0,
      working: state.working, note: note,
    }, byAct);
    conflictBox.innerHTML = state.conflict ? studioNewerHtml(state.conflict, byAct) : '';
  }

  // The line under the buttons, made by the first press (api.js showResult)
  const say = (state, words) => showResult(bar.querySelector('.buttons'), state, words);

  // Reads the document again and says the result on whichever bar is on the page afterwards
  async function reloadThen(words) {
    carried = { state: 'done', words: words };
    const worked = await spec.reload();
    if (!worked) { carried = null; return; }
    if (box.isConnected) { carried = null; paint(); say('done', words); }
  }

  async function run(label, work) {
    state.working = true;
    paint();
    say('working', label);
    try {
      return await work();
    } finally {
      state.working = false;
    }
  }

  async function save(force) {
    const problem = spec.problem();
    if (problem) { say('bad', problem); return; }
    const answer = await run('Saving to the draft.', () => spec.save(force));
    if (!answer.ok && answer.data && answer.data.conflict) {
      state.conflict = { action: 'save', error: answer.error, updatedAt: answer.data.current && answer.data.current.updatedAt };
      paint();
      say('wait', 'Nothing was saved. Choose what to do about the newer Studio copy.');
      return;
    }
    if (!answer.ok) { paint(); say('bad', answer.error); return; }
    state.conflict = null;
    await reloadThen('Saved to the draft. Press ' + actionWords.publish + ' when you are ready.');
  }

  async function publish(force) {
    if (!force && spec.publishQuestion && !window.confirm(spec.publishQuestion)) { say('wait', 'Nothing was published.'); return; }
    const answer = await run('Publishing.', () => spec.publish(force));
    if (!answer.ok && answer.data && answer.data.conflict) {
      state.conflict = { action: 'publish', error: answer.error, updatedAt: answer.data.current && answer.data.current.updatedAt };
      paint();
      say('wait', 'Nothing was published. Choose what to do about the newer draft.');
      return;
    }
    if (!answer.ok) { paint(); say('bad', answer.error); return; }
    state.conflict = null;
    await reloadThen(spec.publishedWords);
  }

  async function refresh() {
    state.conflict = null;
    await reloadThen('Read again from Sanity. Anything you had not saved was dropped.');
  }

  box.addEventListener('click', event => {
    const press = event.target.closest('button[data-act]');
    if (!press || press.disabled) return;
    const act = press.dataset.act;
    if (act === 'save') save(false);
    else if (act === 'publish') publish(false);
    else if (act === 'refresh') refresh();
    else if (act === 'undo') { spec.undo(); paint(); }
    else if (act === 'keep-editing') { state.conflict = null; paint(); }
    else if (act === 'overwrite') {
      const was = state.conflict && state.conflict.action;
      state.conflict = null;
      if (was === 'publish') publish(true); else save(true);
    }
  });

  paint();
  if (carried) {
    const words = carried;
    carried = null;
    say(words.state, words.words);
  }
  return { paint: paint, say: say };
}
