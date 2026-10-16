// The inputs inside the sections of a Screen (schemas/screen.js). Studio draws the fields below
// the map. These are the fields that need more than a box to type in:
//
//   BannerTeamInput  A Banner: the button that opens the Team document of the team the switch is on
//   CountdownInput   C Countdown: the title and dates from Dashboard Settings, read only, and the
//                    button that opens them there
//   TickerInput      E Ticker: the link that opens Tips and News in the sidebar
//   RowTeamInput     B Main panel: the team of a row, with the choices its panel allows
//   RowDepartmentInput  B Main panel: the department of a row of the tasks panel, one of the Team leads, beside the team
//
// The first three store nothing. The team of a row is the code of a team, Both teams, or nothing.
// The teams and the settings come from screen-context.js. The words and the plain functions are in
// screen-parts.js and screen-panels.js, so that check-schemas.mjs can read them with node.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useContext, useEffect, useState } from 'react';
import { set, unset, useClient, useFormValue } from 'sanity';
import { Link } from 'sanity/router';
import { usePaneRouter } from 'sanity/structure';
import { ScreenContext } from './screen-context.js';
import { words, countdownLines, departmentChoices, leadsQuestion, teamTarget, countdownTarget, tipsAndNewsPath } from './screen-parts.js';
import { teamChoices } from './screen-panels.js';

const h = createElement;

// Plain styles. The colours are the Studio's own variables, so the form follows the Studio's light
// and dark themes, and each has a fallback.
const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const styles = {
  note: { margin: '0 0 8px', fontSize: 14, lineHeight: 1.4, color: muted },
  line: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '0 0 4px', fontSize: 14 },
  label: { minWidth: 140, fontWeight: 600 },
  button: {
    boxSizing: 'border-box',
    minHeight: 44,
    padding: '8px 16px',
    fontFamily: 'inherit',
    fontSize: 16,
    fontWeight: 600,
    border: border,
    borderRadius: 4,
    background: primaryBackground,
    color: primaryText,
    cursor: 'pointer',
  },
  link: { display: 'inline-flex', alignItems: 'center', textDecoration: 'none' },
  group: { display: 'flex', flexWrap: 'wrap', gap: '8px 24px' },
  choice: { display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' },
};

// The team the switch above the map is on, or the first team when it is on none
export function teamEditing(context) {
  return context.teams.filter(team => team.code === context.editing)[0] || context.teams[0];
}

export function BannerTeamInput() {
  const context = useContext(ScreenContext);
  const paneRouter = usePaneRouter();
  const team = teamEditing(context);

  if (!team || !team.id) return h('p', { style: styles.note }, words.noTeamDocument);
  return h('button', { type: 'button', style: styles.button, onClick: () => paneRouter.navigateIntent('edit', teamTarget(team)) }, words.openTeam + ': ' + team.label);
}

// What the Countdown section shows, for what was read. change is what the button does.
export function countdownView(context, change) {
  let body;

  if (!context.read) body = h('p', { style: styles.note }, words.readingCountdown);
  else if (context.unreadable) body = h('p', { style: styles.note }, words.countdownUnreadable);
  else if (!context.settings) body = h('p', { style: styles.note }, words.noSettings);
  else {
    body = h(
      'div',
      { 'data-list': 'countdown' },
      countdownLines(context.settings.countdown).map(line => h('p', { key: line.label, style: styles.line }, h('span', { style: styles.label }, line.label), h('span', null, line.text)))
    );
  }

  return h(
    'div',
    null,
    h('p', { style: styles.note }, words.sharedCountdown),
    body,
    h('button', { type: 'button', style: styles.button, onClick: change }, words.changeCountdown)
  );
}

export function CountdownInput() {
  const context = useContext(ScreenContext);
  const paneRouter = usePaneRouter();
  return countdownView(context, () => paneRouter.navigateIntent('edit', countdownTarget));
}

// The time on screen of a Photos row: the photos times the seconds of each, read only. It stores nothing.
export function photoTotalText(count, each) {
  const photos = Number.isFinite(count) ? count : 4;
  const seconds = Number.isFinite(each) ? each : 10;
  return photos * seconds + ' seconds';
}

export function PhotoTotalInput(props) {
  const row = props.path.slice(0, -1);
  const count = useFormValue(row.concat('photoCount'));
  const each = useFormValue(row.concat('secondsPerPhoto'));
  return h('p', { style: Object.assign({}, styles.note, { fontWeight: 600 }) }, photoTotalText(count, each));
}

export function TickerInput() {
  return h(Link, { href: tipsAndNewsPath, style: Object.assign({}, styles.button, styles.link) }, words.openTips);
}

// A team the row has that the list does not offer, such as a team that was switched off, stays on
// the list so it can be seen and changed
export function rowChoices(panel, teams, current) {
  const choices = teamChoices(panel, teams);
  if (choices.length > 0 && current && !choices.some(choice => choice.value === current)) {
    choices.push({ value: current, label: words.unknownTeam + ' (' + current + ')' });
  }
  return choices;
}

export function RowTeamInput(props) {
  const context = useContext(ScreenContext);
  const panel = useFormValue(props.path.slice(0, -1).concat('panel'));
  const current = typeof props.value === 'string' ? props.value : '';
  const choices = rowChoices(panel, context.teams, current);
  const choose = value => props.onChange(value ? set(value) : unset());

  if (!panel) return h('p', { style: styles.note }, words.pickPanelFirst);
  if (choices.length === 0) {
    return h(
      'div',
      null,
      h('p', { style: styles.note }, words.bothTeamsPanel),
      current ? h('button', { type: 'button', style: styles.button, disabled: Boolean(props.readOnly), onClick: () => choose('') }, words.clearTeam) : null
    );
  }

  return h(
    'div',
    { role: 'radiogroup', id: props.id, style: styles.group },
    choices.map(choice =>
      h(
        'label',
        { key: choice.value || 'keep', style: styles.choice },
        h('input', { type: 'radio', name: props.id, checked: choice.value === current, disabled: Boolean(props.readOnly), onChange: () => choose(choice.value) }),
        h('span', null, choice.label)
      )
    )
  );
}

// The department of a row: the Team leads, as a list beside the team. It is stored as the id of the Team lead. The
// list is read when the row is drawn.
export function RowDepartmentInput(props) {
  const client = useClient({ apiVersion: '2025-02-19' });
  const team = useFormValue(props.path.slice(0, -1).concat('team'));
  const [leads, setLeads] = useState(null);
  const current = typeof props.value === 'string' ? props.value : '';

  useEffect(() => {
    let stopped = false;

    client
      .fetch(leadsQuestion, {}, { perspective: 'published' })
      .then(found => {
        if (!stopped) setLeads(Array.isArray(found) ? found : []);
      })
      .catch(() => {
        if (!stopped) setLeads([]);
      });
    return () => {
      stopped = true;
    };
  }, []);

  if (leads === null) return h('p', { style: styles.note }, words.readingDepartments);

  const choices = departmentChoices(leads, typeof team === 'string' ? team : '', current);
  return h(
    'select',
    { id: props.id, value: current, disabled: Boolean(props.readOnly), style: styles.button, onChange: event => props.onChange(event.target.value ? set(event.target.value) : unset()) },
    choices.map(choice => h('option', { key: choice.value || 'first', value: choice.value }, choice.label))
  );
}
