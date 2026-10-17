// The form of a View (schemas/view.js): General, Prime, Nova or Family. It is the input of the whole
// document. Above the fields it draws the picker of the four views and the map: a picture of the
// screen with the letters of Start here, A Banner, B Main panel, C Countdown, D Side panel and
// E Ticker, in the arrangement of the view. A letter or a box opens its section below the map, as on
// a Screen (screen-input.js, which draws the picture).
//
// The first time a View is opened with no rows in its main panel list, this input fills it once
// (view-seed.js): the minutes, the arrangement, the team, the main panel rows and the side panel
// rows, from the Screens that were in use before the Views. The dashboard uses the starting values
// of defaultViews for a View that has none, so nothing goes blank before anyone opens Studio.
//
// If Dashboard Settings, the Screens or the teams cannot be read, the form still opens, and the
// View is filled the next time it is opened.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useRef, useState } from 'react';
import { set, useClient, useFormValue } from 'sanity';
import { usePaneRouter } from 'sanity/structure';
import { ScreenContext } from './screen-context.js';
import { pictureOf, openGroup } from './screen-input.js';
import { mapFor, letterGroups } from '../tools/screen-map.js';
import { pickerTeams } from './screen-parts.js';
import { viewType, viewKeys, viewTitles, viewIdOf, keyOfViewId } from './view-ids.js';
import { seedView, needsViewSeed, withKeys } from '../tools/view-seed.js';
import { defaultViews } from '../tools/view-defaults.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

const muted = 'var(--card-muted-fg-color, inherit)';

const styles = {
  switchRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 24px', margin: '0 0 16px' },
  switchLabel: { fontWeight: 600 },
  choice: { display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' },
  caption: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '8px 0 0' },
};

export const words = {
  picker: 'Editing view',
  teamsUnreadable: 'The teams could not be read, so only the built-in teams are shown.',
};

// What the form reads, from the published documents: the Panel order of Dashboard Settings and its
// countdown, the active teams in order, and the rows of the Screens that the views are first filled from.
export const sourcesQuestion =
  '{ "settings": *[_id == "dashboardSettings"][0]{ rotation, countdown }, "teams": *[_type == "team" && active != false] | order(order asc, _createdAt asc) { _id, name, shortName, code }, "screens": *[_type == "screen"]{ _id, mainRows, sideRows } }';

// The published settings, teams and Screens. This never fails: what cannot be read is reported,
// and the form still opens. unreadable is true when the read itself failed.
export async function readViewSources(client) {
  try {
    const found = await client.fetch(sourcesQuestion, {}, { perspective: 'published' });
    const source = found && typeof found === 'object' ? found : {};
    return {
      settings: source.settings && typeof source.settings === 'object' ? source.settings : null,
      teams: Array.isArray(source.teams) ? source.teams.filter(team => team && typeof team.code === 'string' && team.code !== '') : [],
      screens: Array.isArray(source.screens) ? source.screens : [],
      unreadable: false,
    };
  } catch (error) {
    return { settings: null, teams: [], screens: [], unreadable: true };
  }
}

// The patches that fill a View the first time. read is what readViewSources found. Nothing when the
// View already has rows, cannot be edited, or when what the rows come from could not be read.
// The key is written whenever it is missing, because the screen reads it.
export function fillPatches(value, key, read, readOnly) {
  if (readOnly) return [];
  const current = value || {};
  const patches = [];

  if (!current.key) patches.push(set(key, ['key']));
  if (!read || read.unreadable || !needsViewSeed(value)) return patches;

  const seed = seedView(key, read);
  ['minutes', 'layout', 'mirror', 'countdownIn', 'viewTag', 'teamChip', 'colors'].forEach(name => {
    if (current[name] === undefined) patches.push(set(seed[name], [name]));
  });
  if (seed.team && !current.team) patches.push(set(seed.team, ['team']));
  patches.push(set(withKeys(seed.panels, 'panels'), ['panels']));
  if (seed.sidePanels.length > 0 && !(Array.isArray(current.sidePanels) && current.sidePanels.length > 0)) patches.push(set(withKeys(seed.sidePanels, 'side'), ['sidePanels']));
  return patches;
}

// The map of a View: the bar arrangement or the standard one, as its Arrangement says, and with no
// Arrangement yet as its starting values say
export function mapOf(key, value) {
  const layout = (value && value.layout) || defaultViews[key].layout;
  return mapFor(layout === 'bar' ? 'minimal' : 'original', { main: ((value && value.panels) || []).length, side: ((value && value.sidePanels) || []).length });
}

// The picker of the four views: one radio for each. It opens the page of that view.
export function pickerOf(current, choose) {
  return h(
    'div',
    { style: styles.switchRow, role: 'radiogroup', 'aria-label': words.picker, 'data-block': 'picker' },
    h('span', { style: styles.switchLabel }, words.picker + ':'),
    viewKeys.map(key =>
      h(
        'label',
        { key: key, style: styles.choice },
        h('input', { type: 'radio', name: 'view-editing', checked: key === current, onChange: () => choose(key) }),
        h('span', null, viewTitles[key])
      )
    )
  );
}

export function ViewInput(props) {
  const client = useClient({ apiVersion: apiVersion });
  const paneRouter = usePaneRouter();
  const documentId = useFormValue(['_id']);
  const key = keyOfViewId(documentId) || keyOfViewId(props.value && props.value._id) || 'general';
  const [read, setRead] = useState(null);
  const latest = useRef(props);
  const section = useRef(null);
  latest.current = props;

  useEffect(() => {
    let stopped = false;

    readViewSources(client).then(result => {
      if (stopped) return;
      setRead(result);

      const now = latest.current;
      const patches = fillPatches(now.value, key, result, now.readOnly);
      if (patches.length > 0) now.onChange(patches);
    });

    return () => {
      stopped = true;
    };
  }, []);

  const open = openGroup(props.groups);
  const map = mapOf(key, props.value);

  // Opens the section of a letter, then brings it into view once the form has drawn it
  function choose(letter) {
    if (typeof props.onFieldGroupSelect === 'function') props.onFieldGroupSelect(letterGroups[letter]);
    setTimeout(() => {
      if (section.current && typeof section.current.scrollIntoView === 'function') section.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  const shared = {
    style: 'original',
    teams: pickerTeams(read ? read.teams : []),
    editing: key,
    settings: read ? read.settings : null,
    read: Boolean(read),
    unreadable: Boolean(read && read.unreadable),
  };

  return h(
    ScreenContext.Provider,
    { value: shared },
    h(
      'div',
      null,
      key === 'family' ? h('p', { style: styles.caption, 'data-note': 'old' }, words.oldView) : null,
      pickerOf(key, other => paneRouter.navigateIntent('edit', { id: viewIdOf(other), type: viewType })),
      read && read.unreadable ? h('p', { style: styles.caption }, words.teamsUnreadable) : null,
      pictureOf(map, open, choose),
      h('div', { ref: section, 'data-block': 'section' }, props.renderDefault(props))
    )
  );
}
