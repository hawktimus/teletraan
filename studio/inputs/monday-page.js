// The Monday page, one line of the sidebar. It replaces Monday Tasks and Monday Boards, and has four tabs:
//
//   Boards       the board chosen for tasks and the one for milestones at the top, the groups of each, and the
//                other boards the token can see in a closed list below, as cards, with two choices on each: Show tasks from this
//                board and Show milestones from this board. It also says how often Monday is read, the
//                reads used today and a link to the Monday check on the control page
//   Items        the tasks of the chosen task board, grouped by department, with a Show on TV switch on each
//   Milestones   the milestones the Teletraan computer read, read only
//   Preview the panels   the pictures of the Monday panels (preview-panels-view.js)
//
// It is a page of its own, not a document. It writes only to drafts: the two board numbers and the read
// interval of Dashboard Settings, and the showOnTv field of a task. Publish all puts them on the screen.
// The words, the questions and the writing are in monday-page-parts.js, so node can test them.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { usePaneRouter } from 'sanity/structure';
import { checkAddress, words as checkWords } from '../tools/monday-check.js';
import { PreviewPanelsView } from './preview-panels-view.js';
import {
  words,
  statusQuestion,
  itemsQuestion,
  milestonesQuestion,
  settingsId,
  settingsDraftId,
  chosenFrom,
  boardCards,
  cardSections,
  countsQuestion,
  departmentCounts,
  missingLines,
  showMultiLevelNote,
  updatedText,
  errorText,
  budgetText,
  minutesFrom,
  saveBoardChoice,
  saveInterval,
  itemRows,
  departmentsOf,
  departmentTitle,
  noDepartmentKey,
  groupRows,
  detailLine,
  shownText,
  countLine,
  setShowOnTv,
  milestoneRows,
  milestoneLine,
} from './monday-page-parts.js';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

// The id the link to the old lists of tasks carries in place of a board number (structure.js)
export const oldTasksChild = 'old-tasks';

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const critical = 'var(--card-badge-critical-fg-color, #b91c1c)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const control = { boxSizing: 'border-box', minHeight: 44, padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: border, borderRadius: 4, maxWidth: '100%' };

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 16px' },
  column: { maxWidth: 800, margin: '0 auto' },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '16px 16px 0' },
  tab: Object.assign({}, control, { fontWeight: 600, background: 'transparent', color: 'inherit', cursor: 'pointer' }),
  tabOn: { background: primaryBackground, color: primaryText },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  subheading: { fontSize: 18, fontWeight: 600, margin: '24px 0 8px', overflowWrap: 'anywhere' },
  text: { lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  muted: { color: muted, fontSize: 14, lineHeight: 1.4, margin: '0 0 16px', overflowWrap: 'anywhere' },
  failed: { color: critical, lineHeight: 1.5, margin: '0 0 12px', overflowWrap: 'anywhere' },
  list: { listStyle: 'none', margin: '0 0 16px', padding: 0 },
  card: { boxSizing: 'border-box', margin: '0 0 8px', padding: '12px', border: border, borderRadius: 4 },
  cardOn: { borderColor: primaryText },
  name: { display: 'block', fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' },
  line: { display: 'block', marginTop: 2, fontSize: 14, color: muted, overflowWrap: 'anywhere' },
  problem: { display: 'block', marginTop: 2, fontSize: 14, color: critical, overflowWrap: 'anywhere' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 0', padding: 0, listStyle: 'none' },
  chip: { boxSizing: 'border-box', padding: '4px 12px', border: border, borderRadius: 16, fontSize: 14, overflowWrap: 'anywhere' },
  fold: { margin: '0 0 16px' },
  foldTitle: { display: 'flex', alignItems: 'center', minHeight: 44, fontWeight: 600, cursor: 'pointer' },
  roles: { display: 'flex', flexWrap: 'wrap', gap: '0 24px', marginTop: 8 },
  choice: { display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, cursor: 'pointer' },
  box: { width: 24, height: 24, flex: 'none' },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', margin: '0 0 16px' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 14, fontWeight: 600 },
  select: control,
  number: Object.assign({}, control, { width: 120 }),
  search: Object.assign({}, control, { width: '100%' }),
  button: Object.assign({}, control, { fontWeight: 600, background: primaryBackground, color: primaryText, cursor: 'pointer' }),
  plain: Object.assign({}, control, { fontWeight: 600, background: 'transparent', color: 'inherit', cursor: 'pointer' }),
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
  groupHead: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', margin: '24px 0 8px' },
  groupTitle: { fontSize: 18, fontWeight: 600, margin: 0, flex: '1 1 160px', overflowWrap: 'anywhere' },
  item: { boxSizing: 'border-box', margin: '0 0 8px', padding: '12px', border: border, borderRadius: 4 },
  itemOff: { opacity: 0.75 },
  itemTitle: { margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' },
};

// What the page reads: a promise of null when something fails, so the page says so and goes on
function safely(promise) {
  return promise.catch(() => null);
}

function labelled(label, input) {
  return h('label', { style: styles.field }, h('span', { style: styles.fieldLabel }, label), input);
}

function tabButton(current, name, label, change) {
  return h('button', { key: name, type: 'button', style: Object.assign({}, styles.tab, current === name ? styles.tabOn : null), 'aria-pressed': current === name, onClick: () => change(name) }, label);
}

// ---------------------------------------------------------------- Boards

// The groups of a board as plain chips: the title, and the number of tasks held when the group is a department
function groupChips(card) {
  if (!card.visible || card.groups.length === 0) return null;
  return h(
    'ul',
    { style: styles.chips, 'aria-label': words.groupsHeading, 'data-groups': card.id },
    card.groups.map(group => h('li', { key: group.title, style: styles.chip }, group.count === null ? group.title : group.title + ' · ' + group.count))
  );
}

function BoardCard(props) {
  const card = props.card;
  const chosen = card.task || card.milestones;

  return h(
    'li',
    { style: Object.assign({}, styles.card, chosen ? styles.cardOn : null), 'data-board': card.id },
    h('span', { style: styles.name }, card.name),
    h('span', { style: styles.line }, [card.items, card.read].join(' · ')),
    h('span', { style: card.visible ? styles.line : styles.problem }, card.status),
    card.note ? h('span', { style: styles.problem }, card.note) : null,
    groupChips(card),
    card.suggested ? h('span', { style: styles.line }, words.chooseThisHelp) : null,
    card.suggested ? h('button', { type: 'button', disabled: props.busy, style: Object.assign({}, styles.button, props.busy ? styles.disabled : null), onClick: () => props.choose('task', card.id) }, words.chooseThis) : null,
    h(
      'div',
      { style: styles.roles },
      h(
        'label',
        { style: styles.choice },
        h('input', { type: 'radio', style: styles.box, name: 'monday-task-board', checked: card.task, disabled: props.busy, onChange: () => props.choose('task', card.id) }),
        h('span', null, words.taskRole)
      ),
      h(
        'label',
        { style: styles.choice },
        h('input', { type: 'radio', style: styles.box, name: 'monday-milestone-board', checked: card.milestones, disabled: props.busy, onChange: () => props.choose('milestones', card.id) }),
        h('span', null, words.milestoneRole)
      )
    )
  );
}

function BoardsTab(props) {
  const client = props.client;
  const [read, setRead] = useState(null);
  const [tick, setTick] = useState(0);
  const [message, setMessage] = useState({ text: '', failed: false });
  const [busy, setBusy] = useState(false);
  const [minutes, setMinutes] = useState('');

  useEffect(() => {
    let stopped = false;

    Promise.all([
      safely(client.fetch(statusQuestion, { id: 'monday-status' }, { perspective: 'published' })),
      safely(Promise.all([client.getDocument(settingsDraftId), client.getDocument(settingsId)])),
    ]).then(([status, documents]) => {
      if (stopped) return;
      const chosen = chosenFrom(documents || []);
      // The chips of the task board carry the tasks held for each department: a question to Sanity, not to Monday
      const taskCard = boardCards(status && typeof status === 'object' ? status : null, chosen, new Date()).filter(card => card.task || card.suggested)[0];
      return safely(taskCard ? client.fetch(countsQuestion, { board: taskCard.id }, { perspective: 'published' }) : Promise.resolve([])).then(tasks => {
        if (stopped) return;
        setRead({ status: status, settingsUnreadable: documents === null, chosen: chosen, counts: departmentCounts(tasks || []) });
        setMinutes(String(chosen.everyMinutes));
      });
    });
    return () => {
      stopped = true;
    };
  }, [tick]);

  function saved(promise) {
    setBusy(true);
    return promise
      .then(() => {
        setMessage({ text: words.saved, failed: false });
        setTick(tick + 1);
      })
      .catch(error => setMessage({ text: words.problem + (error && error.message ? error.message : ''), failed: true }))
      .then(() => setBusy(false));
  }

  function choose(role, id) {
    return saved(saveBoardChoice(client, role, id));
  }

  function saveMinutes() {
    if (minutesFrom(minutes) === null) return setMessage({ text: words.intervalProblem, failed: true });
    return saved(saveInterval(client, minutes));
  }

  if (!read) return h('p', { style: styles.muted }, words.reading);

  const now = new Date();
  const status = read.status && typeof read.status === 'object' ? read.status : null;
  const cards = boardCards(status, read.chosen, now, read.counts);
  const sections = cardSections(cards);
  const cardList = list => h('ul', { style: styles.list, 'data-list': 'boards' }, list.map(card => h(BoardCard, { key: card.id, card: card, choose: choose, busy: busy })));
  const missing = missingLines(status, read.chosen);
  const updated = updatedText(status, now);
  const error = errorText(status);
  const budget = budgetText(status, now.toISOString().slice(0, 10));

  return h(
    'div',
    null,
    missing.map(line => h('p', { key: line.kind, role: 'alert', style: styles.failed, 'data-missing': line.kind }, line.text)),
    showMultiLevelNote(status, read.chosen) ? h('p', { style: styles.muted, 'data-note': 'multi-level' }, words.multiLevel) : null,
    read.settingsUnreadable ? h('p', { style: styles.failed }, words.settingsUnreadable) : null,
    h(
      'div',
      { style: styles.row },
      h('span', { style: styles.text }, checkWords.note),
      h('a', { href: checkAddress, target: '_blank', rel: 'noopener noreferrer', style: styles.text }, checkWords.link)
    ),
    updated ? h('p', { style: styles.muted }, updated) : null,
    error ? h('p', { style: styles.failed }, error) : null,
    message.text ? h('p', { role: message.failed ? 'alert' : 'status', style: message.failed ? styles.failed : styles.muted }, message.text) : h('p', { style: styles.muted }, words.saveNote),
    !status ? h('p', { style: styles.muted }, words.nothingYet) : cards.length === 0 ? h('p', { style: styles.muted }, words.noBoards) : cardList(sections.top),
    // Closed by default: the team works in two boards, and the rest are only here to choose from
    status && sections.others.length > 0
      ? h('details', { style: styles.fold, 'data-fold': 'other-boards' }, h('summary', { style: styles.foldTitle }, words.otherBoards + ' (' + sections.others.length + ')'), h('p', { style: styles.muted }, words.otherBoardsHelp), cardList(sections.others))
      : null,
    h('h2', { style: styles.subheading }, 'How often Monday is read'),
    h(
      'div',
      { style: styles.row },
      labelled(words.intervalLabel, h('input', { type: 'number', inputMode: 'numeric', style: styles.number, value: minutes, min: 5, max: 120, onChange: event => setMinutes(event.target.value) })),
      h('button', { type: 'button', disabled: busy, style: Object.assign({}, styles.plain, busy ? styles.disabled : null), onClick: saveMinutes }, 'Save')
    ),
    h('p', { style: styles.muted }, words.intervalHelp),
    budget ? h('p', { style: styles.text }, words.budgetLabel + ': ' + budget + '.') : null,
    h('p', { style: styles.muted }, words.publicLine)
  );
}

// ---------------------------------------------------------------- Items

function ItemRow(props) {
  const row = props.row;

  return h(
    'li',
    { style: Object.assign({}, styles.item, row.onTv ? null : styles.itemOff), 'data-task': row.id },
    h('p', { style: styles.itemTitle }, row.title),
    h('span', { style: styles.line }, detailLine(row)),
    h(
      'label',
      { style: styles.choice },
      h('input', { type: 'checkbox', style: styles.box, checked: row.switchOn, disabled: props.busy, onChange: () => props.toggle(row) }),
      h('span', null, words.showOnTv)
    ),
    h('span', { style: row.reason ? styles.problem : styles.line }, shownText(row))
  );
}

function ItemsTab(props) {
  const client = props.client;
  const [read, setRead] = useState(null);
  const [tick, setTick] = useState(0);
  const [filters, setFilters] = useState({ department: '', status: '', shown: '', search: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', failed: false });

  useEffect(() => {
    let stopped = false;

    safely(Promise.all([client.getDocument(settingsDraftId), client.getDocument(settingsId)])).then(documents => {
      const board = chosenFrom(documents || []).taskBoard;
      return safely(client.fetch(itemsQuestion, { board: board }, { perspective: 'raw' })).then(found => {
        if (!stopped) setRead({ board: board, found: found });
      });
    });
    return () => {
      stopped = true;
    };
  }, [tick]);

  function saved(promise) {
    setBusy(true);
    return promise
      .then(() => {
        setMessage({ text: words.saved, failed: false });
        setTick(tick + 1);
      })
      .catch(error => setMessage({ text: words.problem + (error && error.message ? error.message : ''), failed: true }))
      .then(() => setBusy(false));
  }

  function change(name, value) {
    setFilters(Object.assign({}, filters, { [name]: value }));
  }

  const oldLink = props.ChildLink ? h('p', { key: 'old', style: styles.muted }, h(props.ChildLink, { childId: oldTasksChild }, words.oldTasks), ' · ' + words.oldTasksLine) : null;
  if (!read) return h('p', { style: styles.muted }, words.reading);
  if (read.found === null) return h('div', null, h('p', { style: styles.failed }, words.itemsUnreadable), oldLink);

  const rows = itemRows(read.found, new Date());
  const groups = groupRows(rows, filters);

  return h(
    'div',
    null,
    h('p', { style: styles.text }, words.itemsIntro),
    h('p', { style: styles.muted }, 'Board ' + read.board + '. ' + countLine(rows)),
    message.text ? h('p', { role: message.failed ? 'alert' : 'status', style: message.failed ? styles.failed : styles.muted }, message.text) : null,
    rows.length === 0
      ? h('p', { style: styles.muted }, words.itemsNone)
      : h(
          'div',
          null,
          h(
            'div',
            { style: styles.row },
            labelled(
              words.department,
              h('select', { style: styles.select, value: filters.department, onChange: event => change('department', event.target.value) }, [h('option', { key: 'all', value: '' }, words.allDepartments)].concat(departmentsOf(rows).map(name => h('option', { key: name || noDepartmentKey, value: name === '' ? noDepartmentKey : name }, departmentTitle(name)))))
            ),
            labelled(
              words.status,
              h('select', { style: styles.select, value: filters.status, onChange: event => change('status', event.target.value) }, [h('option', { key: 'all', value: '' }, words.allStatuses)].concat([['blocked', 'Blocked'], ['in-progress', 'In progress'], ['in-review', 'In review'], ['up-next', 'Up next'], ['done', 'Done']].map(pair => h('option', { key: pair[0], value: pair[0] }, pair[1]))))
            ),
            labelled(
              words.shown,
              h('select', { style: styles.select, value: filters.shown, onChange: event => change('shown', event.target.value) }, h('option', { value: '' }, words.allShown), h('option', { value: 'on' }, words.onlyOn), h('option', { value: 'off' }, words.onlyOff))
            )
          ),
          labelled(words.search, h('input', { type: 'search', style: styles.search, placeholder: words.searchHelp, value: filters.search, onChange: event => change('search', event.target.value) })),
          groups.length === 0 ? h('p', { style: styles.muted }, words.itemsNoMatch) : null,
          groups.map(group =>
            h(
              'section',
              { key: group.department || noDepartmentKey, 'data-group': group.title },
              h(
                'div',
                { style: styles.groupHead },
                h('h2', { style: styles.groupTitle }, group.title + ' (' + group.rows.length + ')'),
                h('button', { type: 'button', disabled: busy, style: Object.assign({}, styles.plain, busy ? styles.disabled : null), onClick: () => saved(setShowOnTv(client, group.rows.map(row => row.id), false)) }, words.hideGroup),
                h('button', { type: 'button', disabled: busy, style: Object.assign({}, styles.plain, busy ? styles.disabled : null), onClick: () => saved(setShowOnTv(client, group.rows.map(row => row.id), true)) }, words.showGroup)
              ),
              h('ul', { style: styles.list }, group.rows.map(row => h(ItemRow, { key: row.id, row: row, busy: busy, toggle: item => saved(setShowOnTv(client, [item.id], !item.switchOn)) })))
            )
          )
        ),
    oldLink
  );
}

// ---------------------------------------------------------------- Milestones

function MilestonesTab(props) {
  const client = props.client;
  const [found, setFound] = useState(undefined);

  useEffect(() => {
    let stopped = false;

    safely(client.fetch(milestonesQuestion, {}, { perspective: 'published' })).then(result => {
      if (!stopped) setFound(result);
    });
    return () => {
      stopped = true;
    };
  }, []);

  if (found === undefined) return h('p', { style: styles.muted }, words.reading);
  if (found === null) return h('p', { style: styles.failed }, words.milestonesUnreadable);

  const rows = milestoneRows(found);
  return h(
    'div',
    null,
    h('p', { style: styles.text }, words.milestonesIntro),
    rows.length === 0
      ? h('p', { style: styles.muted }, words.milestonesNone)
      : h('ul', { style: styles.list, 'data-list': 'milestones' }, rows.map(row => h('li', { key: row.id, style: styles.item }, h('p', { style: styles.itemTitle }, row.name), h('span', { style: styles.line }, milestoneLine(row)))))
  );
}

// ---------------------------------------------------------------- the page

export function MondayPage() {
  const client = useClient({ apiVersion: apiVersion });
  const paneRouter = usePaneRouter();
  const [tab, setTab] = useState('boards');

  return h(
    'div',
    { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    h('div', { style: styles.tabs }, ['boards', 'items', 'milestones', 'preview'].map(name => tabButton(tab, name, words.tabs[name], setTab))),
    h(
      'div',
      { style: { flex: 1, minHeight: 0, overflowY: 'auto' } },
      h(
        'div',
        { style: styles.page },
        h(
          'div',
          { style: styles.column },
          h('h1', { style: styles.heading }, words.title),
          tab === 'boards' ? h('p', { style: styles.text }, words.intro) : null,
          tab === 'boards' ? h(BoardsTab, { client: client }) : null,
          tab === 'items' ? h(ItemsTab, { client: client, ChildLink: paneRouter.ChildLink }) : null,
          tab === 'milestones' ? h(MilestonesTab, { client: client }) : null,
          tab === 'preview' ? h(PreviewPanelsView) : null
        )
      )
    )
  );
}
