// The form of a Screen (schemas/screen.js): Original, Cybertron or Minimal. It is the input of the
// whole document. Above the fields it draws the Editing switch, Prime or Nova, and the map: a
// picture of the screen with the letters of Start here, A Banner, B Main panel, C Countdown,
// D Side panel and E Ticker. A letter or a box opens its section below the map and scrolls to it,
// and the box of the open section is highlighted. The sections are the tabs of the form, which
// Studio draws, so that opening one is Studio's own group choice (onFieldGroupSelect).
//
// The first time a Screen is opened with no rows in its main panel list, this input fills it once
// from the Panel order the screen follows now (screen-seed.js): the main panel rows, the side panel
// rows and the Monday style. The dashboard works the same rows out for a Screen that has none, so
// nothing goes blank before anyone opens Studio. The Editing switch is only state of this input:
// nothing of it is stored. It chooses which Team document the Banner section opens.
//
// If Dashboard Settings or the teams cannot be read, the form still opens, and the Screen is not
// filled until the next time it is opened.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useRef, useState } from 'react';
import { set, useClient, useFormValue } from 'sanity';
import { ScreenContext } from './screen-context.js';
import { mapFor, labelsFor, letterGroups } from '../tools/screen-map.js';
import { words, readSources, pickerTeams, teamCodes } from './screen-parts.js';
import { seedScreen, needsSeed, withKeys } from '../tools/screen-seed.js';
import { styleOfScreenId } from './screen-ids.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// Plain styles. The colours are the Studio's own variables, so the form follows the Studio's light
// and dark themes, and each has a fallback.
const muted = 'var(--card-muted-fg-color, inherit)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const styles = {
  switchRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 24px', margin: '0 0 16px' },
  switchLabel: { fontWeight: 600 },
  choice: { display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' },
  figure: { margin: '0 0 24px' },
  picture: { display: 'block', width: '100%', height: 'auto' },
  caption: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '8px 0 0' },
  screenEdge: { fill: 'none', stroke: 'var(--card-border-color, rgba(128, 128, 128, 0.6))', strokeWidth: 8 },
  box: { fill: 'none', stroke: primaryText, strokeWidth: 4, cursor: 'pointer' },
  boxOpen: { fill: primaryBackground, stroke: primaryText, strokeWidth: 10, cursor: 'pointer' },
  boxDashed: { fill: 'none', stroke: muted, strokeWidth: 4, strokeDasharray: '16 12' },
  badge: { fill: primaryText },
  badgeDashed: { fill: muted },
  letter: { fill: primaryBackground, fontWeight: 700 },
  name: { fill: primaryText, fontWeight: 700 },
  line: { fill: primaryText },
  lineDashed: { fill: muted },
};

// The group the form shows now, from the groups Studio gives the input
export function openGroup(groups) {
  const found = (Array.isArray(groups) ? groups : []).filter(group => group && group.selected)[0];
  return found ? found.name : '';
}

// The patches that fill a Screen the first time: the main panel rows, the side panel rows when
// the Screen has a side panel and none yet, and the Monday style when it has none. read is what
// readSources found. Nothing when the Screen already has rows, cannot be edited, or when what
// the rows come from could not be read.
export function fillPatches(value, style, read, readOnly) {
  if (readOnly || !read || read.unreadable || !needsSeed(value)) return [];

  const seed = seedScreen(style, read.settings, teamCodes(read.teams));
  const current = value || {};
  const patches = [set(withKeys(seed.mainRows, 'main'), ['mainRows'])];

  if (seed.sideRows.length > 0 && !(Array.isArray(current.sideRows) && current.sideRows.length > 0)) patches.push(set(withKeys(seed.sideRows, 'side'), ['sideRows']));
  if (!current.mondayStyle) patches.push(set(seed.mondayStyle, ['mondayStyle']));
  return patches;
}

// One box of the picture: its outline, the square with its letter, its name and the words under
// it. A box that opens something is a button for the keyboard and a screen reader.
function boxShapes(box, open, choose) {
  const labels = labelsFor(box);
  const opens = box.opens !== false;
  const isOpen = opens && letterGroups[box.letter] === open;
  const outline = box.dashed ? styles.boxDashed : isOpen ? styles.boxOpen : styles.box;
  const texts = [h('text', { key: 'name', x: labels.name.x, y: labels.name.y, style: Object.assign({ fontSize: labels.name.size }, box.dashed ? styles.lineDashed : styles.name) }, labels.name.text)].concat(
    labels.lines.map(line => h('text', { key: line.text, x: line.x, y: line.y, style: Object.assign({ fontSize: line.size }, box.dashed ? styles.lineDashed : styles.line) }, line.text))
  );
  const props = { key: box.key, 'data-letter': box.letter };

  if (opens) {
    Object.assign(props, {
      role: 'button',
      tabIndex: 0,
      'aria-pressed': isOpen,
      'aria-label': box.letter + ' ' + box.name,
      onClick: () => choose(box.letter),
      onKeyDown: event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          choose(box.letter);
        }
      },
    });
  }

  return h(
    'g',
    props,
    h('rect', { x: box.x, y: box.y, width: box.width, height: box.height, rx: 16, style: outline }),
    h('rect', { x: labels.badge.x, y: labels.badge.y, width: labels.badge.size, height: labels.badge.size, rx: 12, style: box.dashed ? styles.badgeDashed : styles.badge }),
    h('text', { x: labels.letter.x, y: labels.letter.y, textAnchor: 'middle', style: Object.assign({ fontSize: labels.letter.size }, styles.letter) }, labels.letter.text),
    texts
  );
}

// The picture of the screen, with a box for each part. open is the name of the group that is open.
export function pictureOf(map, open, choose) {
  return h(
    'figure',
    { style: styles.figure, 'data-block': 'map' },
    h(
      'svg',
      { viewBox: '0 0 ' + map.width + ' ' + map.height, role: 'group', 'aria-label': words.mapLabel, style: styles.picture },
      h('rect', { x: map.edge.x, y: map.edge.y, width: map.edge.width, height: map.edge.height, rx: 24, style: styles.screenEdge }),
      map.boxes.map(box => boxShapes(box, open, choose))
    ),
    h('figcaption', { style: styles.caption }, words.mapHelp)
  );
}

// The Editing switch: one radio for each team. It chooses which Team document the Banner section opens.
export function switchOf(teams, editing, choose) {
  return h(
    'div',
    { style: styles.switchRow, role: 'radiogroup', 'aria-label': words.editing, 'data-block': 'switch' },
    h('span', { style: styles.switchLabel }, words.editing + ':'),
    teams.map(team =>
      h(
        'label',
        { key: team.code, style: styles.choice },
        h('input', { type: 'radio', name: 'screen-editing', checked: team.code === editing, onChange: () => choose(team.code) }),
        h('span', null, team.label)
      )
    )
  );
}

export function ScreenInput(props) {
  const client = useClient({ apiVersion: apiVersion });
  const documentId = useFormValue(['_id']);
  const style = styleOfScreenId(documentId) || styleOfScreenId(props.value && props.value._id) || 'original';
  const [read, setRead] = useState(null);
  const [editing, setEditing] = useState('');
  const latest = useRef(props);
  const section = useRef(null);
  latest.current = props;

  useEffect(() => {
    let stopped = false;

    readSources(client).then(result => {
      if (stopped) return;
      setRead(result);

      const now = latest.current;
      const patches = fillPatches(now.value, style, result, now.readOnly);
      if (patches.length > 0) now.onChange(patches);
    });

    return () => {
      stopped = true;
    };
  }, []);

  const teams = pickerTeams(read ? read.teams : []);
  const chosen = teams.some(team => team.code === editing) ? editing : teams[0].code;
  const value = props.value || {};
  const map = mapFor(style, { main: (value.mainRows || []).length, side: (value.sideRows || []).length });
  const open = openGroup(props.groups);

  // Opens the section of a letter, then brings it into view once the form has drawn it
  function choose(letter) {
    if (typeof props.onFieldGroupSelect === 'function') props.onFieldGroupSelect(letterGroups[letter]);
    setTimeout(() => {
      if (section.current && typeof section.current.scrollIntoView === 'function') section.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  const shared = {
    style: style,
    teams: teams,
    editing: chosen,
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
      switchOf(teams, chosen, setEditing),
      read && read.unreadable ? h('p', { style: styles.caption }, words.teamsUnreadable) : null,
      pictureOf(map, open, choose),
      h('div', { ref: section, 'data-block': 'section' }, props.renderDefault(props))
    )
  );
}
