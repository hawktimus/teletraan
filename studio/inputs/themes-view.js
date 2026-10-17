// The theme list, the weekday pickers and the background choices of the Look page (look-view.js), and the page they
// were first made for, now kept for the tests. It is a page of its own, not a document. It lists
// the themes and holds the weekday schedule: a picker for each day of the week that chooses the theme
// that plays that day. The schedule is the field themeByWeekday of Dashboard Settings; the background of the
// Original theme is the field background. This page writes only those two fields, to the draft of Dashboard
// Settings, and Publish all puts them on the screen.
//
// If Dashboard Settings has never been published the
// page says to open it and publish it once, as the Start here page did.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { themeChoices, themeWeekdays, tidyThemeByWeekday } from './theme-ids.js';
import { backgroundChoices, backgroundIds } from './background-ids.js';

const h = createElement;

const apiVersion = '2025-02-19';

const settingsId = 'dashboardSettings';
const draftId = 'drafts.dashboardSettings';

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 16px' },
  column: { maxWidth: 760, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  subheading: { fontSize: 16, fontWeight: 600, margin: '32px 0 8px' },
  text: { lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  muted: { color: muted, lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  failed: { color: 'var(--card-badge-critical-fg-color, #b91c1c)', lineHeight: 1.5, margin: '0 0 16px' },
  list: { margin: '0 0 16px', paddingLeft: 24, lineHeight: 1.5 },
  day: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px', margin: '0 0 8px' },
  dayName: { minWidth: 120, fontWeight: 600 },
  choice: { display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 44, margin: '0 0 8px', cursor: 'pointer' },
  radio: { width: 24, height: 24, flex: '0 0 24px', margin: '10px 0 0' },
  select: { boxSizing: 'border-box', minHeight: 44, maxWidth: '100%', padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: border, borderRadius: 4 },
};

export const words = {
  intro: 'A theme is a style: frames, textures, type and transitions. Every view looks the same in every theme.',
  background: 'Background of the Original theme',
  backgroundHelp: 'It is drawn behind the panels when the day plays Original. The other themes draw their own. Calm motion draws each one still.',
  schedule: 'The theme of each day of the week',
  scheduleHelp: 'The day is the calendar day in the time zone of the Look page. The theme is picked at start-up and at the first row change after midnight. Click Publish all in the top bar to put a change on the screen.',
  reading: 'Reading Dashboard Settings.',
  notPublished: 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.',
  saved: 'Saved as a draft. Click Publish all in the top bar.',
  problem: 'The change was not saved. ',
};

// What the page asks for: the draft of Dashboard Settings and the published one, in the raw
// perspective, so that the draft wins when both exist
const question = '*[_id in [$draft, $published]]{ _id, _type, themeByWeekday, background }';

// The schedule to show, from the documents found: the draft first, then the published one. Nothing
// when neither exists.
export function scheduleFrom(documents) {
  const found = Array.isArray(documents) ? documents : [];
  const draft = found.filter(doc => doc && doc._id === draftId)[0];
  const published = found.filter(doc => doc && doc._id === settingsId)[0];
  const source = draft || published;
  return source ? tidyThemeByWeekday(source.themeByWeekday) : null;
}

// The background to show, from the documents found: the draft first, then the published one. Sweep when it has none
// or one that does not exist. Nothing when there is neither document.
export function backgroundFrom(documents) {
  const found = Array.isArray(documents) ? documents : [];
  const source = found.filter(doc => doc && doc._id === draftId)[0] || found.filter(doc => doc && doc._id === settingsId)[0];
  if (!source) return null;
  return backgroundIds.indexOf(source.background) !== -1 ? source.background : 'sweep';
}

// Writes the whole schedule to the draft of Dashboard Settings. The draft is made from the published
// document first when there is none, so the other fields are kept. It gives back a promise.
export function saveSchedule(client, schedule) {
  return saveFields(client, { themeByWeekday: schedule });
}

export function saveBackground(client, background) {
  return saveFields(client, { background: background });
}

async function saveFields(client, fields) {
  const published = await client.getDocument(settingsId);
  const draft = await client.getDocument(draftId);
  if (!draft && !published) throw new Error(words.notPublished);
  if (!draft) {
    const copy = Object.assign({}, published, { _id: draftId });
    ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
    await client.createIfNotExists(copy);
  }
  return client.patch(draftId).set(fields).commit();
}

export function themeList() {
  return h(
    'ul',
    { style: styles.list, 'data-list': 'themes' },
    themeChoices.map(theme => h('li', { key: theme.id }, h('strong', null, theme.title), ' ', theme.description))
  );
}

export function dayRow(day, schedule, change, busy) {
  return h(
    'label',
    { key: day.name, style: styles.day },
    h('span', { style: styles.dayName }, day.title),
    h(
      'select',
      { value: schedule[day.name], disabled: busy, style: styles.select, 'aria-label': day.title, onChange: event => change(day.name, event.target.value) },
      themeChoices.map(theme => h('option', { key: theme.id, value: theme.id }, theme.title))
    )
  );
}

function backgroundChoice(choice, state, changeBackground) {
  return h(
    'label',
    { key: choice.id, style: styles.choice },
    h('input', { type: 'radio', name: 'background', value: choice.id, checked: state.background === choice.id, disabled: state.busy, style: styles.radio, onChange: () => changeBackground(choice.id) }),
    h('span', null, h('strong', null, choice.title), ' ', choice.description)
  );
}

export function backgroundBlock(state, changeBackground) {
  if (!state.background || typeof changeBackground !== 'function') return null;
  return h(
    'div',
    { 'data-block': 'background' },
    h('h2', { style: styles.subheading }, words.background),
    h('p', { style: styles.muted }, words.backgroundHelp),
    backgroundChoices.map(choice => backgroundChoice(choice, state, changeBackground))
  );
}

// The page for what it knows: schedule is null while reading or when there is no Dashboard Settings
export function pageOf(state, change, changeBackground) {
  let body;

  if (!state.read) body = h('p', { style: styles.muted }, words.reading);
  else if (!state.schedule) body = h('p', { style: styles.failed, role: 'alert' }, words.notPublished);
  else body = h('div', { 'data-block': 'schedule' }, themeWeekdays.map(day => dayRow(day, state.schedule, change, state.busy)));

  return h(
    'div',
    { style: styles.page },
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, 'Themes and backgrounds'),
      h('p', { style: styles.text }, words.intro),
      themeList(),
      h('h2', { style: styles.subheading }, words.schedule),
      h('p', { style: styles.muted }, words.scheduleHelp),
      body,
      state.schedule ? backgroundBlock(state, changeBackground) : null,
      state.text ? h('p', { role: state.failed ? 'alert' : undefined, 'aria-live': 'polite', style: state.failed ? styles.failed : styles.muted }, state.text) : null
    )
  );
}

export function ThemesView() {
  const client = useClient({ apiVersion: apiVersion });
  const [state, setState] = useState({ read: false, schedule: null, background: null, busy: false, text: '', failed: false });

  useEffect(() => {
    let stopped = false;

    Promise.resolve()
      .then(() => client.fetch(question, { draft: draftId, published: settingsId }, { perspective: 'raw' }))
      .then(found => {
        if (!stopped) setState({ read: true, schedule: scheduleFrom(found), background: backgroundFrom(found), busy: false, text: '', failed: false });
      })
      .catch(() => {
        if (!stopped) setState({ read: true, schedule: null, background: null, busy: false, text: '', failed: false });
      });
    return () => {
      stopped = true;
    };
  }, []);

  function change(day, theme) {
    const schedule = Object.assign({}, state.schedule, { [day]: theme });
    setState(Object.assign({}, state, { schedule: schedule, busy: true, text: '', failed: false }));

    return saveSchedule(client, schedule)
      .then(() => setState(Object.assign({}, state, { schedule: schedule, busy: false, text: words.saved, failed: false })))
      .catch(error => setState(Object.assign({}, state, { busy: false, text: words.problem + (error && error.message ? error.message : ''), failed: true })));
  }

  function changeBackground(background) {
    setState(Object.assign({}, state, { background: background, busy: true, text: '', failed: false }));

    return saveBackground(client, background)
      .then(() => setState(Object.assign({}, state, { background: background, busy: false, text: words.saved, failed: false })))
      .catch(error => setState(Object.assign({}, state, { busy: false, text: words.problem + (error && error.message ? error.message : ''), failed: true })));
  }

  return pageOf(state, change, changeBackground);
}
