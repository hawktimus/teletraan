// The input of the Team field on tasks, sponsors and the other kinds of
// content (fields.js, teamField). It shows the field as a radio: Both, then one
// line for each active team, with the names read from the Teams list. Both is
// no reference at all, so content that has not been touched keeps showing for
// every team.
//
// If the teams cannot be read, only Both is shown, with a note, and a team
// that is already picked stays on the list so it can be seen and changed.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { set, unset, useClient } from 'sanity';

const h = createElement;

// The same version as the screen's own questions to Sanity
const apiVersion = '2025-02-19';

const teamsQuery = '*[_type == "team"] | order(order asc, name asc) { _id, name, active }';

const styles = {
  group: { display: 'flex', flexWrap: 'wrap', gap: '8px 24px' },
  choice: { display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' },
  note: { margin: '8px 0 0', fontSize: 12, color: 'var(--card-muted-fg-color, inherit)' },
};

// The lines of the radio. A team that is not active is left out, unless it is
// the one already picked.
export function teamChoices(teams, currentId) {
  const choices = [{ id: '', label: 'Both' }];

  (Array.isArray(teams) ? teams : []).forEach(team => {
    if (!team || typeof team._id !== 'string') return;
    if (team.active === false && team._id !== currentId) return;

    const name = team.name || 'Team with no name';
    choices.push({ id: team._id, label: team.active === false ? name + ' (not active)' : name });
  });

  if (currentId && !choices.some(choice => choice.id === currentId)) {
    choices.push({ id: currentId, label: 'A team that could not be read' });
  }
  return choices;
}

// Both clears the field. A team writes a reference to it.
export function teamPatch(id) {
  return id ? set({ _type: 'reference', _ref: id }) : unset();
}

// The teams that are published. This never fails: teams that cannot be read
// are no teams, and the input says so.
export async function readTeams(client) {
  try {
    const found = await client.fetch(teamsQuery, {}, { perspective: 'published' });
    return { teams: Array.isArray(found) ? found : [], unreadable: false };
  } catch (error) {
    return { teams: [], unreadable: true };
  }
}

export function TeamInput(props) {
  const client = useClient({ apiVersion: apiVersion });
  const [read, setRead] = useState({ teams: [], unreadable: false });

  useEffect(() => {
    let stopped = false;

    readTeams(client).then(result => {
      if (!stopped) setRead(result);
    });

    return () => {
      stopped = true;
    };
  }, []);

  const currentId = props.value && typeof props.value._ref === 'string' ? props.value._ref : '';
  const choices = teamChoices(read.teams, currentId);

  return h(
    'div',
    null,
    h(
      'div',
      { role: 'radiogroup', id: props.id, style: styles.group },
      choices.map(choice =>
        h(
          'label',
          { key: choice.id || 'both', style: styles.choice },
          h('input', {
            type: 'radio',
            name: props.id,
            checked: choice.id === currentId,
            disabled: Boolean(props.readOnly),
            onChange: () => props.onChange(teamPatch(choice.id)),
          }),
          h('span', null, choice.label)
        )
      )
    ),
    read.unreadable ? h('p', { style: styles.note }, 'The teams could not be read, so only Both is shown.') : null
  );
}
