// A list of content documents on the Content tab (the ticker lines, the roster, announcements, photos): each item with its state,
// a Hide or Show button, Edit, Move up and down, Publish and Delete, and a form to add or change one. The form is the one of the
// All settings page (the fields are drawn from the Studio schema by settings-all-fields.js), so the limits, counters and warnings
// are the Studio's. Everything goes to the draft first, like the Studio, and Publish is a button of its own. A change made in the
// Studio meanwhile is a question, never an overwrite. The page calls mountList(body, options, ctx); ctx.api replaces the call to
// the control service (the tests do).
//
// Options a list may add: chips(item, now) for its own state chips, sort(items) for its own order, hideSwitch: false when the type
// has no Show switch, grid: true to lay the cards out as a grid, and addButton: false when the list is added to some other way.
// One list can hold several types (options.types, the roster does): each item remembers its own type, and a save, publish or delete
// goes to that type. Only options.type can be added. options.filters and options.keep add a filter box and a search box.

import { api as realApi, useStyles } from './api.js';
import { problemsIn } from '../settings-check.js';
import { changesOf, clone, getAt, sameValue, setAt, shownValues } from '../settings-all-values.js';
import { fieldView, h, refreshProblems } from '../settings-all-fields.js';
import { chipsOf, renumbered, sortItems } from './content-items.js';

// The form spec is large and the same for every list, so it is asked for once
let specRequest = null;

export function useContentStyles() {
  useStyles();
  [['settings-all-css', './settings-all.css'], ['content-css', './content.css']].forEach(([id, file]) => {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = new URL(file, import.meta.url).href;
    document.head.appendChild(link);
  });
}

export function button(text, attrs, onclick) {
  return h('button', Object.assign({ type: 'button', class: 'act quiet', text: text, onclick: onclick }, attrs));
}

export async function mountList(body, options, ctx = {}) {
  useContentStyles();
  const call = ctx.api || realApi;
  const root = h('div', { class: 'ct-list', 'data-type': options.type });
  body.replaceChildren(root);
  const types = options.types || [options.type];
  const page = { docSpec: null, specs: {}, filter: { kind: 'all', q: '' }, items: [], teams: [], canWrite: false, editing: null, adding: false, ask: null, working: false, flash: { state: '', words: '' }, error: '' };

  const word = options.noun;
  const typeOf = item => (item && item.type) || options.type;
  const nameOf = item => options.nameOf(item.document, typeOf(item));
  const nounOf = item => (options.nounOf && item ? options.nounOf(item) : word);
  const now = () => new Date();

  function say(state, words) {
    page.flash = { state: state, words: words };
    const line = root.querySelector('.ct-flash');
    if (line) { line.dataset.state = state; line.textContent = words; }
  }

  // ----- reading -----

  async function load() {
    if (!specRequest) specRequest = call('GET', '/spec');
    const [spec, ...lists] = await Promise.all([specRequest].concat(types.map(type => call('GET', '/docs/' + type))));
    if (!spec.ok) specRequest = null;
    const failed = !spec.ok ? spec : lists.filter(list => !list.ok)[0];
    if (failed) {
      page.error = failed.error;
      return false;
    }
    page.error = '';
    types.forEach(type => { page.specs[type] = spec.data.documents.filter(doc => doc.type === type)[0]; });
    page.docSpec = page.specs[options.type];
    page.items = [].concat(...lists.map((list, at) => list.data.items.map(item => Object.assign({ type: types[at] }, item))));
    page.teams = lists[0].data.teams;
    page.canWrite = lists[0].data.canWrite;
    return true;
  }

  async function reload(state, words) {
    page.working = false;
    page.ask = null;
    await load();
    if (words) page.flash = { state: state, words: words };
    draw();
  }

  // ----- the form -----

  function openForm(item) {
    page.editing = item;
    page.adding = !item;
    draw();
    const form = root.querySelector('.ct-editor');
    if (form) form.scrollIntoView({ block: 'nearest' });
  }

  function editor() {
    const item = page.editing;
    const fields = (item ? page.specs[typeOf(item)] : page.docSpec).fields;
    const state = { base: item ? shownValues(fields, item.document) : {}, values: shownValues(fields, item ? item.document : null), errors: {}, advice: {} };
    const box = h('section', { class: 'sa ct-editor', 'aria-label': item ? 'Edit ' + nounOf(item) : 'Add ' + word });
    const flash = h('p', { class: 'ct-note', role: 'status' });
    const fieldAt = path => fields.filter(field => field.name === path)[0];
    const extra = options.preview ? h('div', { class: 'ct-extra' }) : null;

    const form = {
      docId: item ? item.id : '',
      teams: page.teams,
      get: path => getAt(state.values, path),
      parentOf: () => state.values,
      set: (path, value) => { setAt(state.values, path, value); state.errors = {}; after(); },
      commit: () => {},
      redraw: () => {},
      undoField: path => { setAt(state.values, path, clone(getAt(state.base, path))); drawFields(); after(); },
    };
    const grid = h('div', { class: 'sa-fields' });
    const conflictSlot = h('div', { class: 'ct-slot' });
    const drawFields = () => grid.replaceChildren(...fields.map(field => fieldView(field, form, field.name, state.values)));

    // The advice that only the control service can work out (a full name, an email address): asked a moment after typing stops
    let asking = null;
    function showAdvice() {
      box.querySelectorAll('.sa-field').forEach(wrapper => {
        const warn = wrapper.querySelector(':scope > .sa-warn');
        const error = wrapper.querySelector(':scope > .sa-error');
        if (warn && warn.textContent === '' && error.textContent === '' && state.advice[wrapper.dataset.path]) warn.textContent = state.advice[wrapper.dataset.path];
      });
    }
    function askAdvice() {
      clearTimeout(asking);
      asking = setTimeout(async () => {
        const answer = await call('POST', '/docs/' + typeOf(item || { type: options.type }) + '/check', { set: item ? changesOf(fields, state.base, state.values).set : state.values });
        if (!answer.ok || !box.isConnected) return;
        state.advice = {};
        answer.data.warnings.forEach(one => { state.advice[one.path] = one.message; });
        showAdvice();
      }, 300);
    }

    function after() {
      box.querySelectorAll('.sa-field').forEach(wrapper => {
        const changed = Boolean(item) && !sameValue(getAt(state.base, wrapper.dataset.path), getAt(state.values, wrapper.dataset.path));
        wrapper.dataset.changed = changed ? 'yes' : 'no';
        wrapper.querySelector(':scope > .sa-head .sa-mark').hidden = !changed;
        wrapper.querySelector(':scope > .sa-head .sa-undo').hidden = !changed;
      });
      refreshProblems(box, fieldAt, form);
      showAdvice();
      Object.keys(state.errors).forEach(path => {
        const wrapper = Array.from(box.querySelectorAll('.sa-field')).filter(one => one.dataset.path === path)[0];
        if (wrapper) { wrapper.querySelector(':scope > .sa-error').textContent = state.errors[path]; wrapper.dataset.invalid = 'yes'; }
      });
      if (extra) options.preview(extra, state.values);
      askAdvice();
    }

    const conflictBox = answer => h('div', { class: 'ct-conflict', role: 'alert' },
      h('p', { text: answer.error + ' Saving now replaces only the fields you changed here. Everything else stays as the Studio has it.' }),
      h('div', { class: 'buttons' },
        button('Replace with my changes', { 'data-act': 'replace', class: 'act' }, () => save(true)),
        button('Reload from Sanity', { 'data-act': 'reload' }, () => { page.editing = null; reload('', 'Reloaded from Sanity.'); })));

    async function save(force) {
      const patch = changesOf(fields, state.base, state.values);
      if (item && patch.names.length === 0) return say('', 'Nothing changed.');
      const trouble = problemsIn(fields, patch.set, '', !item);
      if (trouble.length > 0) {
        trouble.forEach(one => { state.errors[one.path] = one.message; });
        flash.dataset.state = 'bad';
        flash.textContent = trouble[0].message;
        after();
        return;
      }
      page.working = true;
      flash.dataset.state = 'wait';
      flash.textContent = 'Saving to the draft.';
      const answer = item
        ? await call('POST', '/docs/' + typeOf(item) + '/' + item.id + '/save', { baseRev: item.rev, force: force, set: patch.set, unset: patch.unset })
        : await call('POST', '/docs/' + options.type, { set: patch.set });
      page.working = false;
      if (answer.ok) {
        page.editing = null;
        page.adding = false;
        const advice = (answer.data.warnings || []).map(one => one.message);
        return reload('done', 'Saved to the draft. It is not on the wall until you press Publish.' + (advice.length > 0 ? ' Check: ' + advice.join(' ') : ''));
      }
      if (answer.data && answer.data.conflict) {
        flash.dataset.state = 'bad';
        flash.textContent = 'The Studio has a newer copy. Nothing was saved.';
        return conflictSlot.replaceChildren(conflictBox(answer.data));
      }
      if (answer.data && answer.data.field) state.errors[answer.data.field] = answer.error;
      flash.dataset.state = 'bad';
      flash.textContent = answer.error;
      after();
    }

    box.append(h('h3', { class: 'ct-edit-title', text: item ? 'Edit ' + nounOf(item) : 'Add ' + word }));
    if (item && item.picture) box.append(h('p', { class: 'ct-pic' }, h('img', { class: 'ct-face', src: item.picture, alt: '', width: '48', height: '48' }), h('span', { text: 'The picture is added in the Studio. It shows here but cannot be changed here.' })));
    drawFields();
    box.append(conflictSlot, grid);
    if (extra) box.append(extra);
    box.append(
      h('div', { class: 'buttons' },
        button('Save to draft', { 'data-act': 'save', class: 'act', disabled: !page.canWrite }, () => save(false)),
        button('Cancel', { 'data-act': 'cancel' }, () => { page.editing = null; page.adding = false; draw(); })),
      flash);
    if (!page.canWrite) flash.textContent = 'SANITY_WRITE_TOKEN is not set on the Teletraan computer, so nothing can be saved here. Add it in Settings, Keys.';
    after();
    return box;
  }

  // ----- actions on one item -----

  async function act(item, path, body, doneWords) {
    page.working = true;
    say('wait', 'Working.');
    const answer = await call('POST', '/docs/' + typeOf(item) + '/' + item.id + path, body);
    page.working = false;
    if (answer.ok) return reload('done', doneWords);
    if (answer.data && answer.data.conflict) return reload('bad', answer.error + ' The list was read again.');
    page.ask = null;
    page.flash = { state: 'bad', words: answer.error };
    draw();
  }

  const toggleShow = item => act(item, '/save', { baseRev: item.rev, set: { show: item.document.show === false } }, 'Saved to the draft. Press Publish to put it on the wall.');
  const publish = item => act(item, '/publish', { confirm: true, rev: item.rev }, 'Published. The wall shows it within a minute.');
  const dropDraft = item => act(item, '/delete', { draftOnly: true, rev: item.rev }, 'The waiting changes were dropped.');
  const remove = item => act(item, '/delete', { confirm: true, rev: item.rev }, 'Deleted.');

  async function publishAll() {
    const waiting = page.items.filter(item => item.isDraft);
    page.working = true;
    say('wait', 'Publishing ' + waiting.length + '.');
    let done = 0;
    for (const item of waiting) {
      const answer = await call('POST', '/docs/' + typeOf(item) + '/' + item.id + '/publish', { confirm: true, rev: item.rev });
      if (!answer.ok) return reload('bad', 'Published ' + done + ' of ' + waiting.length + '. ' + answer.error);
      done += 1;
    }
    return reload('done', 'Published ' + done + '. The wall shows them within a minute.');
  }

  async function move(item, step, shown) {
    const changes = renumbered(shown.map(one => one.id), page.items, item.id, step);
    page.working = true;
    say('wait', 'Saving the new order to the drafts.');
    for (const change of changes) {
      const target = page.items.filter(one => one.id === change.id)[0];
      const answer = await call('POST', '/docs/' + typeOf(target) + '/' + change.id + '/save', { baseRev: target.rev, set: { order: change.order } });
      if (!answer.ok) return reload('bad', answer.error);
    }
    return reload('done', 'Saved the new order to the drafts. Press Publish to put it on the wall.');
  }

  // ----- drawing -----

  function chips(item) {
    const list = options.chips ? options.chips(item, now()) : chipsOf(item, now());
    return h('div', { class: 'ct-chips' }, list.map(chip => h('span', { class: 'ct-chip', 'data-chip': chip.id, text: chip.words })));
  }

  function askBox(item) {
    const ask = page.ask;
    const wording = {
      publish: ['Publish this ' + nounOf(item) + ' now? The wall shows it within a minute.', 'Publish now', publish],
      drop: ['Drop the waiting changes? The published copy stays as it is.', 'Drop my changes', dropDraft],
      delete: [item.published ? 'Delete this ' + nounOf(item) + ' from the wall and the Studio? This cannot be undone.' : 'Delete this draft? It was never published.', 'Delete', remove],
    }[ask.kind];
    return h('div', { class: 'ct-ask', role: 'group', 'aria-label': 'Confirm', 'data-ask': ask.kind },
      h('p', { text: wording[0] }),
      h('div', { class: 'buttons' },
        button(wording[1], { 'data-act': ask.kind + '-now', class: 'act', disabled: page.working }, () => wording[2](item)),
        button('Cancel', {}, () => { page.ask = null; draw(); })));
  }

  function row(item, shown) {
    const index = shown.indexOf(item);
    const off = item.document.show === false;
    const locked = !page.canWrite || page.working;
    const actions = h('div', { class: 'ct-actions' },
      options.hideSwitch === false ? null : button(off ? 'Show' : 'Hide', { 'data-act': 'toggle', 'aria-label': (off ? 'Show ' : 'Hide ') + nameOf(item), disabled: locked }, () => toggleShow(item)),
      button('Edit', { 'data-act': 'edit', 'aria-label': 'Edit ' + nameOf(item) }, () => openForm(item)),
      options.reorder ? button('Up', { 'data-act': 'up', 'aria-label': 'Move ' + nameOf(item) + ' up', disabled: locked || index <= 0 }, () => move(item, -1, shown)) : null,
      options.reorder ? button('Down', { 'data-act': 'down', 'aria-label': 'Move ' + nameOf(item) + ' down', disabled: locked || index === shown.length - 1 }, () => move(item, 1, shown)) : null,
      item.isDraft ? button('Publish', { 'data-act': 'publish', class: 'act', disabled: locked }, () => { page.ask = { kind: 'publish', id: item.id }; draw(); }) : null,
      item.isDraft && item.published ? button('Drop changes', { 'data-act': 'drop', disabled: locked }, () => { page.ask = { kind: 'drop', id: item.id }; draw(); }) : null,
      button('Delete', { 'data-act': 'delete', 'aria-label': 'Delete ' + nameOf(item), disabled: locked }, () => { page.ask = { kind: 'delete', id: item.id }; draw(); }));
    const card = h('article', { class: 'ct-item', 'data-id': item.id }, h('div', { class: 'ct-main' }, options.row(item, page), chips(item)), actions);
    if (page.ask && page.ask.id === item.id) card.append(askBox(item));
    return card;
  }

  function toolbar() {
    const waiting = page.items.filter(item => item.isDraft).length;
    const bar = h('div', { class: 'buttons ct-bar' },
      options.addButton === false ? null : button('Add ' + word, { 'data-act': 'add', class: 'act', disabled: !page.canWrite || page.working }, () => openForm(null)),
      button(waiting === 0 ? 'Nothing to publish' : 'Publish ' + waiting + ' waiting', { 'data-act': 'publish-all', disabled: waiting === 0 || !page.canWrite || page.working }, () => { page.ask = { kind: 'all', id: '' }; draw(); }),
      button('Refresh', { 'data-act': 'refresh', disabled: page.working }, () => reload('', 'Read again from Sanity.')));
    const parts = [bar];
    if (page.ask && page.ask.kind === 'all') {
      parts.push(h('div', { class: 'ct-ask', role: 'group', 'aria-label': 'Confirm', 'data-ask': 'all' },
        h('p', { text: 'Publish all ' + waiting + ' waiting? The wall shows them within a minute.' }),
        h('div', { class: 'buttons' },
          button('Publish now', { 'data-act': 'all-now', class: 'act' }, publishAll),
          button('Cancel', {}, () => { page.ask = null; draw(); }))));
    }
    return parts;
  }

  const kept = item => !options.keep || options.keep(item, page.filter.kind, page.filter.q.trim().toLowerCase());

  function sections() {
    const sorted = options.sort ? options.sort(page.items.filter(kept)) : sortItems(page.items.filter(kept), nameOf);
    if (options.sections) return options.sections(sorted, page).map(section => ({ section: section, shown: sorted }));
    return [{ section: { title: '', count: sorted.length, items: sorted }, shown: sorted }];
  }

  // The rows alone, so typing in the search box never rebuilds an open form
  function rows() {
    const parts = [];
    if (page.items.length === 0) parts.push(h('p', { class: 'ct-none', text: options.empty }));
    else if (page.items.filter(kept).length === 0) parts.push(h('p', { class: 'ct-none', text: 'Nobody matches. Clear the search or pick All.' }));
    sections().forEach(({ section, shown }) => {
      if (section.title) {
        parts.push(h('h3', { class: 'ct-group', text: section.title + ' (' + section.count + ')' }));
        (section.roles || [{ items: section.items }]).forEach(role => {
          if (role.title) parts.push(h('h4', { class: 'ct-role', text: role.title + ' (' + role.count + ')' }));
          role.items.forEach(item => parts.push(row(item, shown)));
        });
      } else if (options.grid) {
        parts.push(h('div', { class: 'ct-grid' }, section.items.map(item => row(item, shown))));
      } else {
        section.items.forEach(item => parts.push(row(item, shown)));
      }
    });
    return parts;
  }

  function filterBar(rowsHost) {
    const kind = h('select', { id: 'ct-filter-kind', 'aria-label': 'Show', 'data-filter': 'kind' }, options.filters.map(choice => h('option', { value: choice.id, text: choice.title })));
    kind.value = page.filter.kind;
    const search = h('input', { type: 'search', id: 'ct-filter-q', 'aria-label': 'Search by first name', placeholder: 'Search by first name', autocomplete: 'off', value: page.filter.q });
    const again = () => rowsHost.replaceChildren(...rows());
    kind.addEventListener('change', () => { page.filter.kind = kind.value; again(); });
    search.addEventListener('input', () => { page.filter.q = search.value; again(); });
    return h('div', { class: 'ct-filters' }, kind, search);
  }

  function draw() {
    if (page.error) {
      root.replaceChildren(h('div', { class: 'ct-error' }, h('p', { class: 'bad', text: page.error }), button('Try again', { 'data-act': 'again', class: 'act' }, () => reload('', ''))));
      return;
    }
    const parts = toolbar();
    parts.push(h('p', { class: 'ct-flash', role: 'status', 'data-state': page.flash.state, text: page.flash.words }));
    if (page.editing || page.adding) parts.push(editor());
    const rowsHost = h('div', { class: 'ct-rows' });
    if (options.filters) parts.push(filterBar(rowsHost));
    rowsHost.replaceChildren(...rows());
    parts.push(rowsHost);
    root.replaceChildren(...parts);
  }

  await load();
  draw();
  return { reload: (state, words) => reload(state || '', words || ''), items: () => page.items, canWrite: () => page.canWrite };
}
