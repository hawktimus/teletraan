// All settings: every setting the Studio has, drawn from the Studio schemas (GET /control/api/spec), one document at a time. The
// tabs are the Studio's tabs and sections, each field shows its one-line description, and a search box finds a setting by
// words from its title or description. Save goes to the draft, Publish is a separate button, and a Studio copy that changed
// meanwhile is a question, never an overwrite. The shell of the Settings tab calls mountSettingsAll(container, ctx).
//
// ctx is optional: { api } replaces the call to the control service (the tests do), { documentId } picks the first document.
// The rules of the page are in settings-all-values.js and the drawing of one field is in settings-all-fields.js.

import { api as realApi, useStyles } from './api.js';
import { agoText } from './render.js';
import { problemsIn } from '../settings-check.js';
import { clone, changesOf, getAt, sameValue, searchFields, searchOthers, setAt, shownValues, visible } from '../settings-all-values.js';
import { fieldView, h, refreshProblems } from '../settings-all-fields.js';

const mostHistory = 60;

function useOwnStyles() {
  if (document.getElementById('settings-all-css')) return;
  const link = document.createElement('link');
  link.id = 'settings-all-css';
  link.rel = 'stylesheet';
  link.href = new URL('./settings-all.css', import.meta.url).href;
  document.head.appendChild(link);
}

export async function mountSettingsAll(container, ctx = {}) {
  useStyles();
  useOwnStyles();
  const call = ctx.api || realApi;
  const root = h('div', { class: 'tab sa' });
  container.replaceChildren(root);

  const page = { spec: null, docs: [], states: {}, docId: '', tab: '', query: '', publishing: false, working: '', flash: { state: '', words: '' } };
  let stopListening = () => {};

  // ----- a document's state -----

  function stateOf(id) {
    if (!page.states[id]) page.states[id] = { id: id, loaded: false, error: '', history: [], editing: false, conflict: null, studioChanged: false, errors: {} };
    return page.states[id];
  }

  const current = () => stateOf(page.docId);

  function docSpecFor(entry) {
    return page.spec.documents.filter(doc => doc.type === entry.type)[0];
  }

  async function load(state) {
    const answer = await call('GET', '/doc/' + encodeURIComponent(state.id));
    if (!answer.ok) {
      state.error = answer.error;
      return;
    }
    const data = answer.data;
    state.error = '';
    state.loaded = true;
    state.docSpec = page.spec.documents.filter(doc => doc.type === data.type)[0];
    Object.assign(state, { doc: data.document, rev: data.rev, updatedAt: data.updatedAt, isDraft: data.isDraft, studioNewer: data.studioNewer, canWrite: data.canWrite, teams: data.teams, title: data.title });
    state.base = shownValues(state.docSpec.fields, data.document);
    state.values = clone(state.base);
    state.history = [];
    state.editing = false;
    state.errors = {};
    state.studioChanged = false;
  }

  // ----- what is unsaved -----

  const changes = state => changesOf(state.docSpec.fields.filter(field => visible(field, state.values, state.id)), state.base, state.values);
  const dirty = state => Boolean(state.loaded && changes(state).names.length > 0);

  function fieldAt(state, path) {
    let fields = state.docSpec.fields;
    let field = null;
    let walked = '';
    path.replace(/\[(\d+)\]/g, '.$1').split('.').forEach(step => {
      if (/^\d+$/.test(step)) {
        const item = getAt(state.values, walked) || {};
        const member = field.members.length === 1 ? field.members[0] : field.members.filter(one => one.type === item._type)[0];
        fields = member ? member.fields : [];
        walked += '[' + step + ']';
        return;
      }
      field = fields.filter(one => one.name === step)[0] || null;
      walked += (walked ? '.' : '') + step;
      if (field) fields = field.fields || [];
    });
    return field;
  }

  function makeForm(state) {
    const snapshot = () => {
      if (state.editing) return;
      state.history.push(clone(state.values));
      if (state.history.length > mostHistory) state.history.shift();
      state.editing = true;
    };
    return {
      docId: state.id,
      teams: state.teams || [],
      get: path => getAt(state.values, path),
      parentOf: path => {
        const up = path.replace(/(\[\d+\]|\.[A-Za-z0-9_]+)$/, '');
        return up === path ? state.values : getAt(state.values, up) || {};
      },
      set: (path, value) => {
        snapshot();
        setAt(state.values, path, value);
        state.errors = {};
        afterChange();
      },
      commit: () => { state.editing = false; },
      redraw: () => drawPanel(),
      undoField: path => {
        snapshot();
        const was = clone(getAt(state.base, path));
        setAt(state.values, path, was);
        state.editing = false;
        drawPanel();
      },
    };
  }

  // ----- drawing -----

  const holes = {};
  const hole = name => holes[name] || (holes[name] = h('div', { 'data-hole': name }));

  function say(state, words) {
    page.flash = { state: state, words: words };
    const line = root.querySelector('.sa-flash');
    if (line) { line.dataset.state = state; line.textContent = words; }
  }

  function drawTop() {
    const select = h('select', { id: 'sa-doc', 'aria-label': 'Document' });
    page.docs.forEach(entry => {
      const other = page.states[entry.id];
      select.append(h('option', { value: entry.id, text: entry.title + (other && other.loaded && dirty(other) ? ' (unsaved)' : '') }));
    });
    select.value = page.docId;
    select.addEventListener('change', () => openDocument(select.value));

    const search = h('input', { type: 'search', id: 'sa-search', placeholder: 'glint, night mode, silver', autocomplete: 'off', value: page.query });
    search.addEventListener('input', () => {
      page.query = search.value.trim();
      drawPanel();
    });

    hole('top').replaceChildren(
      h('div', { class: 'sa-top' },
        h('div', { class: 'sa-pick' }, h('label', { for: 'sa-search', text: 'Find a setting' }), search),
        h('div', { class: 'sa-pick' }, h('label', { for: 'sa-doc', text: 'Settings page' }), select)),
    );
  }

  function drawTabs(state) {
    const bar = h('div', { class: 'sa-tabs', role: 'tablist', 'aria-label': 'Sections' });
    // A document with one tab (a team) needs no tab bar
    if (page.query !== '' || state.docSpec.tabs.length < 2) return bar;
    state.docSpec.tabs.forEach(tab => {
      const here = state.docSpec.fields.filter(field => field.tab === tab.id);
      const names = changes(state).names.filter(name => here.some(field => field.name === name));
      const button = h('button', { type: 'button', role: 'tab', class: 'sa-tab', 'data-tab': tab.id, 'aria-selected': String(tab.id === page.tab), onclick: () => { page.tab = tab.id; drawPanel(); } },
        tab.title, names.length > 0 ? h('span', { class: 'sa-badge', text: String(names.length), 'aria-label': names.length + ' unsaved' }) : null);
      bar.append(button);
    });
    return bar;
  }

  function drawFields(state, fields, form) {
    const grid = h('div', { class: 'sa-fields' });
    const shown = fields.filter(field => visible(field, state.values, state.id) || !field.onlyFor);
    if (page.query !== '') {
      shown.forEach(field => grid.append(fieldView(field, form, field.name, state.values)));
      return grid;
    }
    // A section holds all its fields together, in the order its first field appears
    const order = [];
    shown.forEach(field => { if (!order.includes(field.section || '')) order.push(field.section || ''); });
    order.forEach(name => {
      const box = name === '' ? grid : h('section', { class: 'sa-section' }, h('h2', { text: name }), h('div', { class: 'sa-fields' }));
      const target = name === '' ? grid : box.querySelector('.sa-fields');
      shown.filter(field => (field.section || '') === name).forEach(field => target.append(fieldView(field, form, field.name, state.values)));
      if (name !== '') grid.append(box);
    });
    return grid;
  }

  function drawPanel() {
    const state = current();
    if (!state.loaded) return;
    const form = makeForm(state);
    state.form = form;
    const fields = page.query === '' ? state.docSpec.fields.filter(field => field.tab === page.tab) : searchFields(state.docSpec, page.query);
    const panel = h('div', { class: 'sa-panel', role: 'tabpanel' });

    const tab = state.docSpec.tabs.filter(one => one.id === page.tab)[0];
    if (page.query === '') {
      if (tab && tab.says) panel.append(h('p', { class: 'sa-says', text: tab.says }));
      panel.append(drawFields(state, fields, form));
      if (fields.length === 0) panel.append(h('p', { class: 'sa-none', text: 'Nothing on this tab can be changed here.' }));
    } else {
      panel.append(h('p', { class: 'sa-says', text: fields.length === 0 ? 'No setting in ' + state.docSpec.title + ' matches "' + page.query + '".' : fields.length + (fields.length === 1 ? ' setting' : ' settings') + ' in ' + state.docSpec.title + ' match "' + page.query + '".' }));
      const grid = h('div', { class: 'sa-fields' });
      fields.forEach(field => {
        const tabName = state.docSpec.tabs.filter(one => one.id === field.tab)[0];
        const card = h('div', { class: 'sa-found' }, h('p', { class: 'sa-crumb', text: (tabName ? tabName.title : '') + (field.section ? ' / ' + field.section : '') }), fieldView(field, form, field.name, state.values));
        grid.append(card);
      });
      panel.append(grid);
      const others = searchOthers(page.spec, state.docSpec.type, page.query);
      if (others.length > 0) {
        const list = h('div', { class: 'sa-others' }, h('p', { class: 'sa-says', text: 'Also found on other pages:' }));
        others.forEach(other => {
          const entry = page.docs.filter(doc => doc.type === other.type)[0];
          if (!entry) return;
          list.append(h('button', { type: 'button', class: 'sa-small', text: other.title + ': ' + other.names.slice(0, 3).join(', '), onclick: () => openDocument(entry.id) }));
        });
        panel.append(list);
      }
    }
    hole('tabs').replaceChildren(drawTabs(state));
    hole('panel').replaceChildren(panel);
    drawBar();
    afterChange();
  }

  function drawBar() {
    const state = current();
    if (!state.loaded) { hole('bar').replaceChildren(); hole('notice').replaceChildren(); return; }
    const count = changes(state).names.length;
    const where = state.isDraft ? 'the waiting draft' : 'the published settings';
    const when = state.updatedAt ? ', changed ' + agoText(state.updatedAt, new Date()) : '';
    const status = h('p', { class: 'sa-status' },
      h('strong', { class: 'sa-unsaved', text: count === 0 ? 'No unsaved changes.' : count + (count === 1 ? ' unsaved change.' : ' unsaved changes.') }),
      ' Showing ' + where + when + '.');

    const save = h('button', { type: 'button', class: 'act', 'data-act': 'save', text: 'Save to draft', disabled: count === 0 || !state.canWrite || Boolean(page.working), onclick: () => saveNow(state, false) });
    const undo = h('button', { type: 'button', class: 'act quiet', 'data-act': 'undo', text: 'Undo', disabled: state.history.length === 0, onclick: () => undoOne(state) });
    const discard = h('button', { type: 'button', class: 'act quiet', 'data-act': 'discard', text: 'Discard my changes', disabled: count === 0, onclick: () => { state.history.push(clone(state.values)); state.values = clone(state.base); state.errors = {}; say('', 'Your changes were dropped.'); drawPanel(); } });
    const canPublish = state.isDraft && state.canWrite && count === 0 && !page.working;
    const publish = h('button', { type: 'button', class: 'act', 'data-act': 'publish', text: 'Publish', disabled: !canPublish, onclick: () => { page.publishing = !page.publishing; drawBar(); } });

    const buttons = h('div', { class: 'buttons' }, save, undo, discard, publish);
    const parts = [status, buttons];
    if (!state.canWrite) parts.push(h('p', { class: 'sa-line', 'data-state': 'bad', text: 'SANITY_WRITE_TOKEN is not set on the Teletraan computer, so nothing can be saved here. Add it in Settings, Keys.' }));
    if (state.isDraft && count > 0) parts.push(h('p', { class: 'sa-line', text: 'Save to draft first, then Publish.' }));
    if (page.publishing && canPublish) {
      parts.push(h('div', { class: 'sa-confirm', role: 'group', 'aria-label': 'Confirm' },
        h('p', { text: 'Publish ' + state.title + ' now? The wall shows it within a minute.' }),
        h('div', { class: 'buttons' },
          h('button', { type: 'button', class: 'act', 'data-act': 'publish-now', text: 'Publish now', onclick: () => publishNow(state, false) }),
          h('button', { type: 'button', class: 'act quiet', text: 'Cancel', onclick: () => { page.publishing = false; drawBar(); } }))));
    }
    parts.push(h('p', { class: 'sa-flash', role: 'status', 'data-state': page.flash.state, text: page.flash.words }));
    hole('bar').replaceChildren(h('div', { class: 'sa-bar' }, parts));

    const notice = [];
    if (state.conflict) notice.push(conflictCard(state));
    else if (state.studioChanged) notice.push(h('section', { class: 'card sa-conflict', role: 'alert' }, h('h2', { text: 'The Studio changed this' }), h('p', { text: state.title + ' changed in the Studio after this page loaded it. Refresh to see it, or keep editing and decide when you save.' }),
      h('div', { class: 'buttons' }, h('button', { type: 'button', class: 'act', 'data-act': 'refresh', text: 'Refresh from Sanity', onclick: () => refreshNow(state) }), h('button', { type: 'button', class: 'act quiet', 'data-act': 'keep', text: 'Keep editing', onclick: () => { state.studioChanged = false; drawBar(); } }))));
    hole('notice').replaceChildren(...notice);
  }

  function conflictCard(state) {
    const conflict = state.conflict;
    const when = conflict.updatedAt ? ' It was last changed ' + agoText(conflict.updatedAt, new Date()) + '.' : '';
    const publishing = conflict.action === 'publish';
    return h('section', { class: 'card sa-conflict', role: 'alert', 'data-conflict': conflict.action },
      h('h2', { text: 'The Studio has a newer copy' }),
      h('p', { text: conflict.error + when + ' ' + (publishing ? 'Publishing now puts that newer draft on the wall.' : 'Saving now replaces what you changed here in the Studio draft. Everything else in the document stays as the Studio has it.') }),
      h('div', { class: 'buttons' },
        h('button', { type: 'button', class: 'act', 'data-act': 'replace', text: publishing ? 'Publish that draft' : 'Replace with my changes', onclick: () => (publishing ? publishNow(state, true) : saveNow(state, true)) }),
        h('button', { type: 'button', class: 'act quiet', 'data-act': 'refresh', text: 'Refresh from Sanity', onclick: () => refreshNow(state) }),
        h('button', { type: 'button', class: 'act quiet', 'data-act': 'keep', text: 'Keep editing', onclick: () => { state.conflict = null; drawBar(); } })));
  }

  // Marks, counts and the rules that follow other fields, after any change
  function afterChange() {
    const state = current();
    if (!state.loaded) return;
    root.querySelectorAll('.sa-field').forEach(wrapper => {
      const path = wrapper.dataset.path;
      const changed = !sameValue(getAt(state.base, path), getAt(state.values, path));
      wrapper.dataset.changed = changed ? 'yes' : 'no';
      const head = wrapper.querySelector(':scope > .sa-head');
      head.querySelector('.sa-mark').hidden = !changed;
      head.querySelector('.sa-undo').hidden = !changed;
      if (wrapper.dataset.showField) {
        const parent = state.form.parentOf(path);
        wrapper.hidden = !JSON.parse(wrapper.dataset.showValues).includes(parent[wrapper.dataset.showField]);
      }
    });
    refreshProblems(root, path => fieldAt(state, path), state.form);
    Object.keys(state.errors || {}).forEach(path => {
      const wrapper = Array.from(root.querySelectorAll('.sa-field')).filter(one => one.dataset.path === path)[0];
      if (wrapper) { wrapper.querySelector(':scope > .sa-error').textContent = state.errors[path]; wrapper.dataset.invalid = 'yes'; }
    });
    const count = changes(state).names.length;
    const unsaved = root.querySelector('.sa-unsaved');
    if (unsaved) unsaved.textContent = count === 0 ? 'No unsaved changes.' : count + (count === 1 ? ' unsaved change.' : ' unsaved changes.');
    const save = root.querySelector('[data-act="save"]');
    if (save) save.disabled = count === 0 || !state.canWrite || Boolean(page.working);
    const discard = root.querySelector('[data-act="discard"]');
    if (discard) discard.disabled = count === 0;
    const undo = root.querySelector('[data-act="undo"]');
    if (undo) undo.disabled = state.history.length === 0;
    const publish = root.querySelector('[data-act="publish"]');
    if (publish) publish.disabled = !(state.isDraft && state.canWrite && count === 0 && !page.working);
    root.querySelectorAll('.sa-tab').forEach(button => {
      const here = state.docSpec.fields.filter(field => field.tab === button.dataset.tab);
      const n = changes(state).names.filter(name => here.some(field => field.name === name)).length;
      const badge = button.querySelector('.sa-badge');
      if (n > 0) {
        if (badge) { badge.textContent = String(n); badge.setAttribute('aria-label', n + ' unsaved'); } else button.append(h('span', { class: 'sa-badge', text: String(n), 'aria-label': n + ' unsaved' }));
      } else if (badge) badge.remove();
    });
    const option = root.querySelector('#sa-doc option[value="' + CSS.escape(state.id) + '"]');
    if (option) option.textContent = (page.docs.filter(entry => entry.id === state.id)[0] || { title: state.title }).title + (count > 0 ? ' (unsaved)' : '');
  }

  // ----- actions -----

  function undoOne(state) {
    const before = state.history.pop();
    if (!before) return;
    state.values = before;
    state.editing = false;
    state.errors = {};
    drawPanel();
  }

  async function reload(state, words) {
    await load(state);
    page.working = '';
    page.publishing = false;
    state.conflict = null;
    if (words) say('done', words);
    drawTop();
    drawPanel();
  }

  async function refreshNow(state) {
    say('wait', 'Reading from Sanity.');
    await reload(state, 'Refreshed from Sanity. Your unsaved changes were dropped.');
  }

  async function saveNow(state, force) {
    const patch = changes(state);
    if (patch.names.length === 0) return say('', 'There is nothing to save.');
    const trouble = problemsIn(state.docSpec.fields, patch.set, '', false);
    if (trouble.length > 0) {
      trouble.forEach(item => { state.errors[item.path] = item.message; });
      say('bad', trouble[0].message);
      afterChange();
      const first = Array.from(root.querySelectorAll('.sa-field')).filter(one => one.dataset.path === trouble[0].path)[0];
      if (first) first.scrollIntoView({ block: 'center' });
      return;
    }
    page.working = 'save';
    say('wait', 'Saving to the draft.');
    drawBar();
    const answer = await call('POST', '/doc/' + encodeURIComponent(state.id) + '/save', { baseRev: state.rev, force: force, set: patch.set, unset: patch.unset });
    page.working = '';
    if (answer.ok) return reload(state, 'Saved to the draft. It is not on the wall until you press Publish.');
    if (answer.data && answer.data.conflict) {
      state.conflict = { action: 'save', error: answer.data.error, updatedAt: answer.data.current && answer.data.current.updatedAt };
      say('bad', 'The Studio has a newer copy. Nothing was saved.');
      drawBar();
      root.querySelector('.sa-conflict').scrollIntoView({ block: 'center' });
      return;
    }
    if (answer.data && answer.data.field) state.errors[answer.data.field] = answer.error;
    say('bad', answer.error);
    drawBar();
    afterChange();
  }

  async function publishNow(state, force) {
    page.working = 'publish';
    say('wait', 'Publishing.');
    drawBar();
    const answer = await call('POST', '/doc/' + encodeURIComponent(state.id) + '/publish', { confirm: true, rev: state.rev, force: force });
    page.working = '';
    if (answer.ok) return reload(state, 'Published. The wall shows it within a minute.');
    if (answer.data && answer.data.conflict) {
      state.conflict = { action: 'publish', error: answer.data.error, updatedAt: answer.data.current && answer.data.current.updatedAt };
      say('bad', 'The draft changed in the Studio. Nothing was published.');
      drawBar();
      return;
    }
    say('bad', answer.error);
    drawBar();
  }

  async function openDocument(id) {
    page.docId = id;
    page.publishing = false;
    const state = stateOf(id);
    if (!state.loaded) {
      hole('panel').replaceChildren(h('p', { class: 'sa-says', text: 'Reading the settings.' }));
      hole('tabs').replaceChildren();
      hole('bar').replaceChildren();
      await load(state);
      if (page.docId !== id) return;
    }
    if (!state.loaded) {
      hole('panel').replaceChildren(h('section', { class: 'card' }, h('h2', { text: 'This page could not be read' }), h('p', { text: state.error }),
        h('div', { class: 'buttons' }, h('button', { type: 'button', class: 'act', text: 'Try again', onclick: () => openDocument(id) }))));
      return;
    }
    if (!state.docSpec.tabs.some(tab => tab.id === page.tab)) page.tab = state.docSpec.tabs[0] ? state.docSpec.tabs[0].id : '';
    drawTop();
    drawPanel();
  }

  // The Studio may change a document while this page is open. A look when the page comes back to the front is enough.
  async function checkStudio() {
    const state = current();
    if (document.hidden || !state.loaded || page.working) return;
    const answer = await call('GET', '/doc/' + encodeURIComponent(state.id));
    if (!answer.ok || answer.data.rev === state.rev) return;
    if (dirty(state)) { state.studioChanged = true; drawBar(); } else { await reload(state, 'The Studio changed this, so it was read again.'); }
  }

  // ----- start -----

  root.append(hole('top'), hole('tabs'), hole('notice'), hole('panel'), hole('bar'));
  root.querySelectorAll('[data-hole]').forEach(box => { box.className = 'sa-slot'; });

  async function start() {
    hole('panel').replaceChildren(h('p', { class: 'sa-says', text: 'Reading the settings.' }));
    const [spec, docs] = await Promise.all([call('GET', '/spec'), call('GET', '/docs')]);
    if (!spec.ok || !docs.ok) {
      hole('panel').replaceChildren(h('section', { class: 'card' }, h('h2', { text: 'All settings' }), h('p', { text: spec.ok ? docs.error : spec.error }),
        h('div', { class: 'buttons' }, h('button', { type: 'button', class: 'act', text: 'Try again', onclick: start }))));
      return;
    }
    page.spec = spec.data;
    page.docs = docs.data.documents;
    const first = ctx.documentId && page.docs.some(entry => entry.id === ctx.documentId) ? ctx.documentId : (page.docs[0] || {}).id;
    if (!first) { hole('panel').replaceChildren(h('p', { class: 'sa-says', text: 'There are no settings documents to show.' })); return; }
    await openDocument(first);
  }

  const onVisible = () => { if (!document.hidden) checkStudio(); };
  document.addEventListener('visibilitychange', onVisible);
  stopListening = () => document.removeEventListener('visibilitychange', onVisible);
  await start();
  return stopListening;
}
