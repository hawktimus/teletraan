// The Publish all tool, in the Studio's top bar (docs/publish-all.md). It lists
// every document that has a draft, checks each ticked one with the Studio's own
// validation, and publishes the ones that pass, one transaction for each.
//
// The choosing, the transactions and the summary are in publish-all.js, which
// has tests. This file is the screen and the calls to Sanity.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient, useCurrentUser, useSchema, useWorkspace, validateDocument } from 'sanity';
import { settingsType, settingsId, themeType, themeId, demoType, demoId } from './structure.js';
import {
  draftQuery,
  chooseDrafts,
  pickAll,
  pickedAfterReload,
  pickedItems,
  publishSelected,
  buildSummary,
  labelOf,
  messageOf,
} from './publish-all.js';

const h = createElement;

// The same version as the schemas' own questions to Sanity
const apiVersion = '2025-02-19';

// The pages that exist once keep their fixed ids when they are published
export const singletonIds = {};
singletonIds[settingsType] = settingsId;
singletonIds[themeType] = themeId;
singletonIds[demoType] = demoId;

// Plain styles. The colours are the Studio's own variables, so the screen
// follows the Studio's light and dark themes, and each has a fallback.
const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const critical = 'var(--card-badge-critical-fg-color, #b91c1c)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 32px' },
  column: { maxWidth: 760, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  subheading: { fontSize: 16, fontWeight: 600, margin: '24px 0 8px' },
  muted: { color: 'var(--card-muted-fg-color, inherit)', lineHeight: 1.5, margin: '0 0 16px' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '16px 0' },
  list: { listStyle: 'none', margin: 0, padding: 0, border: border, borderRadius: 4 },
  row: { padding: '10px 12px' },
  label: { display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' },
  checkbox: { marginTop: 3 },
  type: { display: 'block', fontSize: 12, color: 'var(--card-muted-fg-color, inherit)' },
  title: { display: 'block', fontWeight: 600 },
  note: { display: 'block', fontSize: 12, color: critical, marginTop: 2 },
  button: { fontFamily: 'inherit', fontSize: 'inherit', padding: '8px 14px', border: border, borderRadius: 3, background: 'transparent', color: 'inherit', cursor: 'pointer' },
  primary: {
    fontWeight: 600,
    background: 'var(--card-badge-primary-bg-color, #dbeafe)',
    color: 'var(--card-badge-primary-fg-color, #1e40af)',
  },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
  error: { border: '1px solid ' + critical, borderRadius: 4, padding: '10px 12px', margin: '0 0 16px', color: critical },
  summaryList: { margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.5 },
  reasons: { margin: '2px 0 6px', paddingLeft: 20, color: 'var(--card-muted-fg-color, inherit)' },
};

function button(label, onClick, options) {
  const settings = options || {};
  const style = Object.assign({}, styles.button, settings.primary ? styles.primary : {}, settings.disabled ? styles.disabled : {});
  return h('button', { type: 'button', style: style, disabled: Boolean(settings.disabled), onClick: onClick }, label);
}

function draftRow(item, index, props, busy) {
  const rowStyle = Object.assign({}, styles.row, index === 0 ? {} : { borderTop: border });

  return h(
    'li',
    { key: item.id, style: rowStyle },
    h(
      'label',
      { style: styles.label },
      h('input', {
        type: 'checkbox',
        style: styles.checkbox,
        checked: props.picked[item.id] === true,
        disabled: busy,
        onChange: () => props.onToggle(item.id),
      }),
      h(
        'span',
        null,
        item.title === item.typeTitle ? null : h('span', { style: styles.type }, item.typeTitle),
        h('span', { style: styles.title }, item.title),
        item.problem ? h('span', { style: styles.note }, 'Will be skipped. ' + item.problem) : null
      )
    )
  );
}

function draftSection(props, items, count, busy) {
  return h(
    'div',
    null,
    h(
      'div',
      { style: styles.toolbar },
      button('Publish selected (' + count + ')', props.onPublish, { primary: true, disabled: busy || count === 0 }),
      button('Tick all', props.onTickAll, { disabled: busy }),
      button('Untick all', props.onUntickAll, { disabled: busy }),
      button('Refresh list', props.onRefresh, { disabled: busy })
    ),
    h('ul', { style: styles.list }, items.map((item, index) => draftRow(item, index, props, busy)))
  );
}

function listOf(entries, show) {
  return h('ul', { style: styles.summaryList }, entries.map(entry => h('li', { key: entry.id }, show(entry))));
}

function summarySection(summary) {
  return h(
    'div',
    null,
    h('h2', { style: styles.subheading }, summary.headline),
    summary.published.length > 0
      ? h('div', null, h('h3', { style: styles.subheading }, 'Published (' + summary.published.length + ')'), listOf(summary.published, entry => entry.label))
      : null,
    summary.skipped.length > 0
      ? h(
          'div',
          null,
          h('h3', { style: styles.subheading }, 'Skipped, still drafts (' + summary.skipped.length + ')'),
          listOf(summary.skipped, entry => [
            entry.label,
            h('ul', { key: 'reasons', style: styles.reasons }, entry.reasons.map((reason, number) => h('li', { key: number }, reason))),
          ])
        )
      : null,
    summary.failed.length > 0
      ? h(
          'div',
          null,
          h('h3', { style: styles.subheading }, 'Failed, still drafts (' + summary.failed.length + ')'),
          listOf(summary.failed, entry => [entry.label, h('div', { key: 'error', style: styles.reasons }, entry.error)])
        )
      : null
  );
}

// What the screen looks like for the state it is given. It keeps no state of its own.
export function PublishAllScreen(props) {
  const items = props.items;
  const busy = Boolean(props.progress);
  const count = items ? pickedItems(items, props.picked).length : 0;

  let status = '';
  if (props.progress) {
    status = props.progress.refreshing ? 'Updating the list...' : 'Publishing ' + props.progress.number + ' of ' + props.progress.total + ': ' + props.progress.label;
  }

  return h(
    'div',
    { style: styles.page },
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, 'Publish all'),
      h(
        'p',
        { style: styles.muted },
        'A draft is a change that is saved but not published, so it is not on the screen yet. Tick what to publish. Each one is checked first with the same rules as its Publish button, and one that fails is left as a draft with the reason.'
      ),
      props.problem ? h('div', { role: 'alert', style: styles.error }, props.problem) : null,
      items === null ? h('p', { style: styles.muted }, 'Loading drafts...') : null,
      items !== null && items.length === 0
        ? h(
            'div',
            null,
            props.problem ? null : h('p', { style: styles.muted }, 'There are no drafts. Everything that has been saved is published.'),
            button('Refresh list', props.onRefresh, { disabled: busy })
          )
        : null,
      items !== null && items.length > 0 ? draftSection(props, items, count, busy) : null,
      status ? h('p', { 'aria-live': 'polite', style: styles.muted }, status) : null,
      props.summary ? summarySection(props.summary) : null
    )
  );
}

function PublishAllTool() {
  const client = useClient({ apiVersion: apiVersion });
  const schema = useSchema();
  const workspace = useWorkspace();
  const currentUser = useCurrentUser();

  const [items, setItems] = useState(null); // null until the first load
  const [picked, setPicked] = useState({});
  const [problem, setProblem] = useState('');
  const [progress, setProgress] = useState(null); // null when nothing is being published
  const [summary, setSummary] = useState(null);

  // 'raw' is what includes drafts. It is also what the schemas ask for when they look for drafts.
  function load() {
    return client
      .fetch(draftQuery, {}, { perspective: 'raw' })
      .then(documents => {
        const found = chooseDrafts(documents, schema, singletonIds);
        setItems(found);
        setPicked(previous => pickedAfterReload(found, previous));
        setProblem('');
      })
      .catch(error => {
        setItems(previous => previous || []);
        setProblem('The drafts could not be loaded. ' + messageOf(error));
      });
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id) {
    setPicked(previous => Object.assign({}, previous, { [id]: previous[id] !== true }));
  }

  function publish() {
    const chosen = pickedItems(items, picked);
    if (chosen.length === 0 || progress) return;

    setSummary(null);
    setProblem('');
    setProgress({ number: 0, total: chosen.length, label: '' });

    publishSelected(chosen, {
      // The Studio's own validation, with the same schema, rules and current user as the Publish button
      validate: item => validateDocument({ document: item.doc, workspace: workspace, environment: 'studio', currentUser: currentUser }),
      // One call with a list of changes is one transaction
      commit: mutations => client.mutate(mutations),
      onProgress: (number, total, item) => setProgress({ number: number, total: total, label: labelOf(item) }),
    })
      .then(results => {
        setSummary(buildSummary(results));
        setProgress({ number: results.length, total: results.length, label: '', refreshing: true });
        return load();
      })
      .catch(error => {
        setProblem('Publishing stopped. ' + messageOf(error));
      })
      .then(() => setProgress(null));
  }

  return h(PublishAllScreen, {
    items: items,
    picked: picked,
    problem: problem,
    progress: progress,
    summary: summary,
    onToggle: toggle,
    onTickAll: () => setPicked(pickAll(items || [], true)),
    onUntickAll: () => setPicked(pickAll(items || [], false)),
    onRefresh: () => load(),
    onPublish: publish,
  });
}

// Studio adds this to the top bar (sanity.config.js)
export const publishAllTool = {
  name: 'publish-all',
  title: 'Publish all',
  component: PublishAllTool,
};
