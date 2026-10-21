// Roster, a block of the Content section of the Display tab: everyone the wall knows by first name in one list, grouped by team and
// then by role with counts. It holds three kinds of document, each marked with where it lives: the Roster (rosterPerson), Leadership
// (person) and Team leads (subteam). All three are edited in place with the same form, Save to draft, Publish, Hide and Delete, and
// nothing is copied from one to another. Portraits are shown but only the Studio changes them. The whole dataset is public, so the
// forms take a first name and nothing that names or reaches a person.

import { h } from '../settings-all-fields.js';
import { mountList } from './content-list.js';
import { keepPerson, peopleFilters, personLine, personName, roleTitles, rosterGroups, sourceTitles } from './content-items.js';

const initial = text => (String(text || '?').trim().charAt(0) || '?').toUpperCase();

function picture(src, name) {
  return src
    ? h('img', { class: 'ct-face', src: src, alt: '', width: '48', height: '48', loading: 'lazy' })
    : h('span', { class: 'ct-face ct-initial', 'aria-hidden': 'true', text: initial(name) });
}

const until = doc => (doc.expires ? 'Until ' + new Date(doc.expires).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

// The grey line under the name, which depends on what the kind of document holds
function subLine(item, page) {
  const doc = item.document;
  if (item.type === 'subteam') {
    const members = Array.isArray(doc.members) ? doc.members.length : 0;
    return [(doc.name || 'No subteam') + ' lead', members === 0 ? '' : members + (members === 1 ? ' member' : ' members'), doc.spotlight ? 'In the spotlight' : '', until(doc)];
  }
  if (item.type === 'person') return [doc.title || 'No role', doc.role ? 'Listed with ' + doc.role : '', until(doc)];
  const field = page.specs.rosterPerson.fields.filter(one => one.name === 'department')[0];
  return [roleTitles[doc.role] || 'No role', personLine(doc, field && field.options ? field.options.list : []), until(doc)];
}

function personRow(item, page) {
  const name = personName(item);
  return h('div', { class: 'ct-person' },
    picture(item.picture, name),
    h('div', { class: 'ct-row' },
      h('p', { class: 'ct-title' }, name || 'No name', h('span', { class: 'ct-source', 'data-source': item.type, text: sourceTitles[item.type] })),
      h('p', { class: 'ct-sub', text: subLine(item, page).filter(Boolean).join(' · ') })));
}

export async function mountRoster(body, ctx = {}) {
  const listHost = h('div', { 'data-part': 'people' });
  body.replaceChildren(
    h('p', { class: 'word', text: 'Everyone by first name, with a role and a team. Each line says where it lives: Roster, Leadership or Team lead. Edit any of them here; they stay where they are. Portraits are added in the Studio; they show here but cannot be changed here. No panel of the wall shows the Roster list yet.' }),
    listHost);
  await mountList(listHost, {
    type: 'rosterPerson',
    types: ['rosterPerson', 'person', 'subteam'],
    noun: 'person',
    nounOf: item => ({ rosterPerson: 'person', person: 'Leadership entry', subteam: 'Team lead' })[item.type],
    empty: 'Nobody on the roster yet. Press Add person.',
    reorder: false,
    nameOf: (doc, type) => personName({ type: type, document: doc }) || 'Person with no name',
    row: personRow,
    sections: (sorted, page) => rosterGroups(sorted, page.teams),
    filters: peopleFilters,
    keep: keepPerson,
  }, ctx);
}
