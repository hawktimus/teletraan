// The FRC news section of the Competition page (competition-view.js). It shows the headlines the Teletraan computer read
// from the FIRST blog, each with a Show switch, the two switches and the list of categories, and when the blog was last
// read. Every change is written to the draft of Dashboard Settings, one field at a time, and never published: Publish all in
// the top bar puts it on the screen. The headlines come from the document frc-news, which only the computer writes.
//
// It is written without JSX: h(tag, props, ...children) is React's createElement. The words and the plain functions are in
// news-parts.js.

import { createElement, useEffect, useState } from 'react';
import { styles } from './page-styles.js';
import { isRecord } from './plain-values.js';
import { words, newsDocumentId, newsQuestion, hiddenLinksOf, categoriesOf, usesStartingCategories, addedCategory, removedCategory, rowsOf, changedHidden, shortDate, readLines } from './news-parts.js';

const h = createElement;

const chipStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 8px 0 12px', border: styles.card.border, borderRadius: 4 };
const flagStyle = { display: 'inline-block', padding: '0 8px', fontSize: 14, fontWeight: 600, border: styles.card.border, borderRadius: 4 };

// The published frc-news document, read once and again whenever it changes. A document that cannot be read is reported as
// unreadable, and the section says so. Studio's live stream is used when the client has one.
export function useNews(client) {
  const [state, setState] = useState({ read: false, doc: null, unreadable: false });

  useEffect(() => {
    let stopped = false;
    let subscription = null;

    const load = () =>
      Promise.resolve()
        .then(() => client.fetch(newsQuestion, { id: newsDocumentId }, { perspective: 'published' }))
        .then(found => {
          if (!stopped) setState({ read: true, doc: isRecord(found) ? found : null, unreadable: false });
        })
        .catch(() => {
          if (!stopped) setState({ read: true, doc: null, unreadable: true });
        });

    load();
    try {
      if (typeof client.listen === 'function') {
        subscription = client.listen('*[_id == $id]', { id: newsDocumentId }, { visibility: 'query' }).subscribe(() => load());
      }
    } catch (error) {
      subscription = null;
    }

    return () => {
      stopped = true;
      if (subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe();
    };
  }, []);

  return state;
}

function switchRow(name, title, says, checked, busy, onSave) {
  return h(
    'label',
    { key: name, style: styles.choice, 'data-news': name },
    h('input', { type: 'checkbox', checked: checked, disabled: busy, style: styles.box, onChange: event => onSave({ [name]: event.target.checked }) }),
    h('span', null, h('strong', null, title), h('span', { style: styles.help }, says))
  );
}

function categoriesBlock(settings, busy, draft, handlers) {
  const doc = settings.doc;
  const list = categoriesOf(doc);
  const chips = list.map(name =>
    h(
      'span',
      { key: name, style: chipStyle, 'data-category': name },
      h('span', null, name),
      h('button', { type: 'button', style: Object.assign({}, styles.button, { minWidth: 44, padding: '4px 12px' }), disabled: busy, 'aria-label': words.remove + ' ' + name, onClick: () => handlers.removeCategory(name) }, 'x')
    )
  );

  return h(
    'div',
    { 'data-news': 'newsCategories', style: styles.field },
    h('h3', { style: styles.label }, words.categories),
    h('span', { style: styles.help }, words.categoriesSays),
    h('div', { style: Object.assign({}, styles.row, { margin: '8px 0' }) }, chips),
    usesStartingCategories(doc) ? h('p', { style: styles.muted }, words.startingNote) : null,
    h(
      'div',
      { style: styles.row },
      h('input', { id: 'news-new-category', style: Object.assign({}, styles.input, { width: 'auto', flex: '1 1 200px' }), disabled: busy, 'aria-label': words.addCategory, placeholder: words.addCategory, defaultValue: '', key: 'category-box:' + list.join('|'), onChange: event => handlers.typeCategory(event.target.value), onKeyDown: event => { if (event.key === 'Enter') handlers.addCategory(); } }),
      h('button', { type: 'button', style: styles.button, disabled: busy, 'data-news-add': 'category', onClick: () => handlers.addCategory() }, words.add)
    ),
    draft.problem ? h('p', { role: 'alert', style: styles.failed }, draft.problem) : null
  );
}

function headlineRows(rows, busy, onToggle) {
  return rows.map(row =>
    h(
      'label',
      { key: row.link, style: styles.choice, 'data-headline': row.link },
      h('input', { type: 'checkbox', checked: !row.hidden, disabled: busy, style: styles.box, 'aria-label': words.show + ': ' + row.title, onChange: event => onToggle(row.link, !event.target.checked) }),
      h(
        'span',
        null,
        h('strong', null, row.title),
        h('span', { style: styles.help }, [shortDate(row.date), row.systemcore ? words.systemcoreFlag : '', row.hidden ? words.hiddenFlag : ''].filter(Boolean).join(' · '))
      )
    )
  );
}

// The section as a tree. model is { settings (the state of useDraftDocument), news (the state of useNews), draft ({ problem }), now }.
// handlers are save(fields, unset), toggle(link, hide), typeCategory(text), addCategory() and removeCategory(name).
export function newsBlock(model, handlers) {
  const settings = model.settings;
  const news = model.news;
  const doc = settings.doc;
  const busy = settings.busy;
  let body;

  if (!settings.read) body = h('p', { style: styles.muted }, words.reading);
  else if (!doc) body = h('p', { role: 'alert', style: styles.failed }, words.needsPublish);
  else {
    const enabled = doc.newsEnabled !== false;
    const rows = rowsOf(news.doc, doc);
    let list;

    if (!news.read) list = h('p', { style: styles.muted }, words.reading);
    else if (news.unreadable) list = h('p', { style: styles.muted }, words.unreadable);
    else if (rows.length === 0) list = h('p', { style: styles.muted }, words.noHeadlines);
    else list = h('div', { 'data-news': 'headlines' }, headlineRows(rows, busy, handlers.toggle));

    body = h(
      'div',
      null,
      switchRow('newsEnabled', words.enabled, words.enabledSays, enabled, busy, handlers.save),
      enabled ? null : h('p', { style: styles.muted }, words.offNote),
      switchRow('newsInTicker', words.inTicker, words.inTickerSays, doc.newsInTicker === true, busy, handlers.save),
      categoriesBlock(settings, busy, model.draft, handlers),
      h('h3', { style: styles.label }, words.headlines),
      h('span', { style: styles.help }, words.headlinesSays),
      list,
      h('p', { style: styles.muted, 'data-news': 'note' }, words.headlinesOnly)
    );
  }

  const lines = readLines(news.doc, model.now).map(line => h('p', { key: line.label, style: styles.row }, h('strong', null, line.label), h('span', null, line.text)));

  return h('div', { 'data-block': 'news' }, h('h2', { style: styles.subheading }, words.title), h('p', { style: styles.muted }, words.intro), news.read && !news.unreadable ? lines : null, body);
}

// The state and the handlers of the section, for the Competition page. settings is what useDraftDocument gives back.
export function useNewsSection(client, settings) {
  const news = useNews(client);
  const [draft, setDraft] = useState({ typed: '', problem: '' });

  const handlers = {
    save(fields, unset) {
      settings.save(fields, unset);
    },
    toggle(link, hide) {
      const change = changedHidden(hiddenLinksOf(settings.state.doc), link, hide);
      setDraft(previous => Object.assign({}, previous, { problem: change.problem }));
      if (change.problem) return;
      if (change.list.length === 0) settings.save({}, ['newsHiddenLinks']);
      else settings.save({ newsHiddenLinks: change.list });
    },
    typeCategory(text) {
      setDraft(previous => Object.assign({}, previous, { typed: text }));
    },
    addCategory() {
      const result = addedCategory(categoriesOf(settings.state.doc), draft.typed);
      setDraft(previous => ({ typed: result.problem ? previous.typed : '', problem: result.problem }));
      if (!result.problem) settings.save({ newsCategories: result.list });
    },
    removeCategory(name) {
      const rest = removedCategory(categoriesOf(settings.state.doc), name);
      setDraft(previous => Object.assign({}, previous, { problem: '' }));
      if (rest.length === 0) settings.save({}, ['newsCategories']);
      else settings.save({ newsCategories: rest });
    },
  };

  return { model: { news: news, draft: draft, now: new Date() }, handlers: handlers };
}
