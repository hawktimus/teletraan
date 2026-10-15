// The Monday Boards page with two tabs: Boards (monday-boards-view.js, as it was) and Preview the
// panels, which lists every Monday panel with its picture (preview-panels.js has the list). The
// pictures are the dashboard in frames, so a frame opens only when its button is clicked: eleven
// screens at once would be slow to draw.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { MondayBoardsView } from './monday-boards-view.js';
import { PanelPreview, previewNote } from './panel-preview.js';
import { departmentsQuestion, previewAddress, previewPanels, previewScreens, words } from './preview-panels.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 32px' },
  tabs: { display: 'flex', gap: 8, margin: '0 0 16px' },
  tab: { minHeight: 44, padding: '8px 16px', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, border: border, borderRadius: 4, background: 'transparent', color: 'inherit', cursor: 'pointer' },
  tabOn: { background: primaryBackground, color: primaryText },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  help: { lineHeight: 1.5, margin: '0 0 16px', color: muted },
  switchRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 24px', margin: '0 0 16px' },
  choice: { display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' },
  item: { margin: '0 0 24px' },
  name: { fontSize: 16, fontWeight: 600, margin: '0 0 4px' },
};

// The Team lead _ids of each team code, read once: { prime: [id, id], nova: [id, id] }
function useDepartments(client) {
  const [found, setFound] = useState({});

  useEffect(() => {
    let stopped = false;

    ['prime', 'nova'].forEach(code => {
      client.fetch(departmentsQuestion, { code: code }).then(rows => {
        if (!stopped) setFound(before => Object.assign({}, before, { [code]: (rows || []).map(row => row._id) }));
      }).catch(() => {});
    });
    return () => {
      stopped = true;
    };
  }, []);

  return found;
}

function PreviewItem(props) {
  const [open, setOpen] = useState(false);
  const item = props.item;
  const ids = props.departments[item.team] || [];
  const department = item.slot > 0 ? ids[item.slot - 1] || '' : '';
  const address = previewAddress(item.panel, item.team, department, props.screen);

  return h(
    'div',
    { style: styles.item, 'data-preview': item.id },
    h('p', { style: styles.name }, item.title),
    item.slot > 0 && !department ? previewNote(words.noDepartment) : null,
    h('button', { type: 'button', style: styles.tab, onClick: () => setOpen(!open), 'aria-expanded': open }, open ? words.hide : words.button),
    open ? h(PanelPreview, { address: address, title: item.title }) : null
  );
}

export function PreviewPanelsView() {
  const client = useClient({ apiVersion: apiVersion });
  const departments = useDepartments(client);
  const [screen, setScreen] = useState('original');

  return h(
    'div',
    null,
    h('h1', { style: styles.heading }, words.tab),
    h('p', { style: styles.help }, words.help),
    h(
      'div',
      { style: styles.switchRow, role: 'radiogroup', 'aria-label': words.screenLabel },
      h('span', { style: { fontWeight: 600 } }, words.screenLabel + ':'),
      previewScreens.map(name =>
        h(
          'label',
          { key: name, style: styles.choice },
          h('input', { type: 'radio', name: 'preview-screen', checked: name === screen, onChange: () => setScreen(name) }),
          h('span', null, name.charAt(0).toUpperCase() + name.slice(1))
        )
      )
    ),
    previewPanels.map(item => h(PreviewItem, { key: item.id + screen, item: item, screen: screen, departments: departments }))
  );
}

export function MondayBoardsTabs() {
  const [tab, setTab] = useState('boards');
  const button = (name, label) => h('button', { key: name, type: 'button', style: Object.assign({}, styles.tab, tab === name ? styles.tabOn : null), 'aria-pressed': tab === name, onClick: () => setTab(name) }, label);

  return h(
    'div',
    { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    h('div', { style: Object.assign({}, styles.tabs, { padding: '16px 32px 0' }) }, button('boards', words.boardsTab), button('preview', words.tab)),
    h('div', { style: { flex: 1, minHeight: 0, overflowY: 'auto' } }, tab === 'boards' ? h(MondayBoardsView) : h('div', { style: styles.page }, h(PreviewPanelsView)))
  );
}
