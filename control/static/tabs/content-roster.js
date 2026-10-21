// Roster, a block of the Content section of the Display tab: everyone on the roster grouped by team and then by role (Leadership,
// Mentors and Coaches, Students, Parents) with counts, and an add, edit, hide and delete form. Under it the Leadership and Team
// leads that the Studio already has, read only, with a link to edit them there. The portrait is shown but only the Studio changes
// it. The whole dataset is public, so the form takes a first name and nothing that names or reaches a person.

import { api as realApi } from './api.js';
import { h } from '../settings-all-fields.js';
import { mountList } from './content-list.js';
import { personLine, roleTitles, rosterGroups } from './content-items.js';

const initial = text => (String(text || '?').trim().charAt(0) || '?').toUpperCase();

function picture(src, name) {
  return src
    ? h('img', { class: 'ct-face', src: src, alt: '', width: '48', height: '48', loading: 'lazy' })
    : h('span', { class: 'ct-face ct-initial', 'aria-hidden': 'true', text: initial(name) });
}

function personRow(item, page) {
  const doc = item.document;
  const field = page.docSpec.fields.filter(one => one.name === 'department')[0];
  const line = personLine(doc, field && field.options ? field.options.list : []);
  return h('div', { class: 'ct-person' },
    picture(item.picture, doc.firstName),
    h('div', { class: 'ct-row' },
      h('p', { class: 'ct-title', text: doc.firstName || 'Person with no name' }),
      h('p', { class: 'ct-sub', text: [roleTitles[doc.role] || 'No role', line, doc.expires ? 'Until ' + new Date(doc.expires).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''].filter(Boolean).join(' · ') })));
}

async function mountStudioPeople(host, ctx) {
  const call = ctx.api || realApi;
  const answer = await call('GET', '/content/people');
  if (!answer.ok) {
    host.replaceChildren(h('p', { class: 'bad', text: answer.error }));
    return;
  }
  const list = (title, rows, sub) => h('div', { class: 'ct-readonly-list' },
    h('h4', { class: 'ct-role', text: title + ' (' + rows.length + ')' }),
    rows.length === 0 ? h('p', { class: 'ct-none', text: 'Nobody yet.' }) : null,
    rows.map(person => h('div', { class: 'ct-person', 'data-show': person.show ? 'yes' : 'no' },
      picture(person.picture, person.name),
      h('div', { class: 'ct-row' },
        h('p', { class: 'ct-title', text: person.name || 'No name' }),
        h('p', { class: 'ct-sub', text: [sub(person), person.team || 'Both teams', person.show ? '' : 'Hidden'].filter(Boolean).join(' · ') })))));
  host.replaceChildren(
    h('h3', { class: 'ct-group', text: 'Already in the Studio' }),
    h('p', { class: 'word', text: 'These are the Leadership and Team leads lists that feed the wall. They are shown here to read and are not copied into the roster. Edit them in the Studio.' }),
    list('Leadership', answer.data.leadership, person => person.role),
    list('Team leads', answer.data.teamLeads, person => [person.department, person.members + (person.members === 1 ? ' member' : ' members')].join(' · ')),
    h('p', {}, h('a', { class: 'act quiet ct-link', href: '/studio/', text: 'Open the Studio to edit them' })));
}

export async function mountRoster(body, ctx = {}) {
  const listHost = h('div', { 'data-part': 'people' });
  const studioHost = h('div', { 'data-part': 'studio-people' });
  body.replaceChildren(
    h('p', { class: 'word', text: 'Everyone on the team by first name, with a role and a team. Portraits are added in the Studio; they show here but cannot be changed here. No panel of the wall shows this roster yet.' }),
    listHost,
    studioHost);
  await mountList(listHost, {
    type: 'rosterPerson',
    noun: 'person',
    empty: 'Nobody on the roster yet. Press Add person.',
    reorder: false,
    nameOf: doc => doc.firstName || 'Person with no name',
    row: personRow,
    sections: (sorted, page) => rosterGroups(sorted, page.teams),
  }, ctx);
  await mountStudioPeople(studioHost, ctx);
}
