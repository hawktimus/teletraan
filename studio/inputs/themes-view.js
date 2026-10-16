// The Themes page, in the sidebar under Settings. It is a page of its own, not a document. It lists
// the themes and holds the weekday schedule: a picker for each day of the week that chooses the theme
// that plays that day. The schedule is the field themeByWeekday of Dashboard Settings; this page
// writes only that field, to the draft of Dashboard Settings, and Publish all puts it on the screen.
//
// A placeholder theme says so under its name. If Dashboard Settings has never been published the
// page says to open it and publish it once, as the Start here page did.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { themeChoices, themeWeekdays, tidyThemeByWeekday } from './theme-ids.js';

const h = createElement;

const apiVersion = '2025-02-19';

const settingsId = 'dashboardSettings';
const draftId = 'drafts.dashboardSettings';

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 32px' },
  column: { maxWidth: 760, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  subheading: { fontSize: 16, fontWeight: 600, margin: '32px 0 8px' },
  text: { lineHeight: 1.5, margin: '0 0 16px' },
  muted: { color: muted, lineHeight: 1.5, margin: '0 0 16px' },
  failed: { color: 'var(--card-badge-critical-fg-color, #b91c1c)', lineHeight: 1.5, margin: '0 0 16px' },
  list: { margin: '0 0 16px', paddingLeft: 24, lineHeight: 1.5 },
  day: { display: 'flex', alignItems: 'center', gap: 16, margin: '0 0 8px' },
  dayName: { minWidth: 120, fontWeight: 600 },
  select: { boxSizing: 'border-box', minHeight: 40, padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: border, borderRadius: 4 },
};

export const words = {
  intro: 'A theme is a style: frames, textures, type and transitions. Every view looks the same in every theme.',
  schedule: 'The theme of each day of the week',
  scheduleHelp: 'The day is the calendar day in the time zone of the Look page. The theme is picked at start-up and at the first row change after midnight. Click Publish all in the top bar to put a change on the screen.',
  reading: 'Reading Dashboard Settings.',
  notPublished: 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.',
  saved: 'Saved as a draft. Click Publish all in the top bar.',
  problem: 'The change was not saved. ',
};

// What the page asks for: the draft of Dashboard Settings and the published one, in the raw
// perspective, so that the draft wins when both exist
const question = '*[_id in [$draft, $published]]{ _id, _type, themeByWeekday }';

// The schedule to show, from the documents found: the draft first, then the published one. Nothing
// when neither exists.
export function scheduleFrom(documents) {
  const found = Array.isArray(documents) ? documents : [];
  const draft = found.filter(doc => doc && doc._id === draftId)[0];
  const published = found.filter(doc => doc && doc._id === settingsId)[0];
  const source = draft || published;
  return source ? tidyThemeByWeekday(source.themeByWeekday) : null;
}

// Writes the whole schedule to the draft of Dashboard Settings. The draft is made from the published
// document first when there is none, so the other fields are kept. It gives back a promise.
export async function saveSchedule(client, schedule) {
  const published = await client.getDocument(settingsId);
  const draft = await client.getDocument(draftId);
  if (!draft && !published) throw new Error(words.notPublished);
  if (!draft) {
    const copy = Object.assign({}, published, { _id: draftId });
    ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
    await client.createIfNotExists(copy);
  }
  return client.patch(draftId).set({ themeByWeekday: schedule }).commit();
}

function themeList() {
  return h(
    'ul',
    { style: styles.list, 'data-list': 'themes' },
    themeChoices.map(theme => h('li', { key: theme.id }, h('strong', null, theme.title), ' ', theme.description))
  );
}

function dayRow(day, schedule, change, busy) {
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

// The page for what it knows: schedule is null while reading or when there is no Dashboard Settings
export function pageOf(state, change) {
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
      h('h1', { style: styles.heading }, 'Themes'),
      h('p', { style: styles.text }, words.intro),
      themeList(),
      h('h2', { style: styles.subheading }, words.schedule),
      h('p', { style: styles.muted }, words.scheduleHelp),
      body,
      state.text ? h('p', { role: state.failed ? 'alert' : undefined, 'aria-live': 'polite', style: state.failed ? styles.failed : styles.muted }, state.text) : null
    )
  );
}

export function ThemesView() {
  const client = useClient({ apiVersion: apiVersion });
  const [state, setState] = useState({ read: false, schedule: null, busy: false, text: '', failed: false });

  useEffect(() => {
    let stopped = false;

    Promise.resolve()
      .then(() => client.fetch(question, { draft: draftId, published: settingsId }, { perspective: 'raw' }))
      .then(found => {
        if (!stopped) setState({ read: true, schedule: scheduleFrom(found), busy: false, text: '', failed: false });
      })
      .catch(() => {
        if (!stopped) setState({ read: true, schedule: null, busy: false, text: '', failed: false });
      });
    return () => {
      stopped = true;
    };
  }, []);

  function change(day, theme) {
    const schedule = Object.assign({}, state.schedule, { [day]: theme });
    setState(Object.assign({}, state, { schedule: schedule, busy: true, text: '', failed: false }));

    return saveSchedule(client, schedule)
      .then(() => setState({ read: true, schedule: schedule, busy: false, text: words.saved, failed: false }))
      .catch(error => setState({ read: true, schedule: state.schedule, busy: false, text: words.problem + (error && error.message ? error.message : ''), failed: true }));
  }

  return pageOf(state, change);
}
