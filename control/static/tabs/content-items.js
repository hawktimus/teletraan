// The plain rules behind the Content blocks of the Display tab: what state an item is in, how a list is sorted and renumbered, how the
// roster is grouped by team and role, how a ticker line looks, and how a news headline is hidden. No page code, so node can test
// them (tests/control-content-items.test.mjs).

const ends = item => Date.parse(item.document && item.document.expires);

// The chips of an item: whether it is published, and whether the wall shows it. The shown document is the draft when there is one,
// so a switch that was just pressed is visible before Publish.
export function chipsOf(item, now) {
  const doc = item.document || {};
  const chips = [];
  if (!item.published) chips.push({ id: 'new', words: 'New, not published' });
  else if (item.isDraft) chips.push({ id: 'waiting', words: 'Changes waiting' });
  if (doc.show === false) chips.push({ id: 'hidden', words: 'Hidden' });
  else if (!isNaN(ends(item)) && ends(item) <= now.getTime()) chips.push({ id: 'expired', words: 'Expired' });
  else chips.push({ id: 'shown', words: item.published && !item.isDraft ? 'Shown' : 'Will show' });
  return chips;
}

// Order first (no order comes last), then the text
export function sortItems(items, nameOf) {
  const orderOf = item => (typeof item.document.order === 'number' ? item.document.order : Infinity);
  return items.slice().sort((a, b) => (orderOf(a) === orderOf(b) ? 0 : orderOf(a) < orderOf(b) ? -1 : 1) || String(nameOf(a)).localeCompare(String(nameOf(b))));
}

// The order numbers after a move, in tens so a later line fits between two: [{ id, order }] for the items whose number changes
export function renumbered(ids, items, id, step) {
  const at = ids.indexOf(id);
  const to = at + step;
  if (at < 0 || to < 0 || to >= ids.length) return [];
  const next = ids.slice();
  next.splice(to, 0, next.splice(at, 1)[0]);
  return next.map((one, index) => ({ id: one, order: (index + 1) * 10 }))
    .filter(change => items.filter(item => item.id === change.id)[0].document.order !== change.order);
}

// ----- the ticker -----

// The tag word the ticker draws for each kind, as in dashboard/panels/ticker/panel.js (tests/control-content-items.test.mjs compares)
export const tickerTags = { tip: 'TIP', news: 'NEWS', reminder: 'REMINDER', thanks: 'THANKS' };
export const tickerLimit = 52;
export const newsLineLimit = 90;

// The line as the ticker shows it: the tag of its kind (an entry with no kind is news) and the text with its edges trimmed.
// null when the line has no text, which the ticker skips.
export function tickerLine(kind, text) {
  const words = typeof text === 'string' ? text.trim() : '';
  if (words === '') return null;
  return { tag: tickerTags[kind] && kind !== 'thanks' ? tickerTags[kind] : tickerTags.news, text: words };
}

// A headline as the ticker shows it when Show news in the ticker is on: FIRST: and the title, cut to the longest line
export function newsLine(title) {
  const text = 'FIRST: ' + String(title).trim();
  return text.length <= newsLineLimit ? text : text.slice(0, newsLineLimit - 3).trim() + '...';
}

// The hidden links after a headline is hidden or shown, or the problem in words
export function hiddenAfter(list, link, hide, most) {
  const without = list.filter(one => one !== link);
  if (!hide) return { list: without, problem: '' };
  if (without.length >= most) return { list: list, problem: 'Up to ' + most + ' headlines can be hidden. Show some again first.' };
  return { list: without.concat([link]), problem: '' };
}

// ----- the roster -----

export const roleGroups = [
  { id: 'leadership', title: 'Leadership', roles: ['leadership'] },
  { id: 'mentors', title: 'Mentors and Coaches', roles: ['mentor', 'coach'] },
  { id: 'students', title: 'Students', roles: ['student'] },
  { id: 'parents', title: 'Parents', roles: ['parent'] },
];

export const roleTitles = { student: 'Student', mentor: 'Mentor', coach: 'Coach', parent: 'Parent', leadership: 'Leadership' };

// The three kinds of document that hold people. The Studio calls person Leadership and subteam Team leads (type names are stored
// names and stay as they are).
export const sourceTitles = { rosterPerson: 'Roster', person: 'Leadership', subteam: 'Team lead' };

// The name a person goes by in a list: a first name, the name of a leader, or the lead of a subteam
export function personName(item) {
  const doc = item.document || {};
  if (item.type === 'subteam') return doc.lead || '';
  return doc.firstName || doc.name || '';
}

// Which role group an item belongs to. A Leadership entry listed as Captain is leadership; Coach and Mentor are mentors and
// coaches. A team lead is leadership. An item with no type is a roster person.
export function roleGroupOf(item) {
  const doc = item.document || {};
  if (item.type === 'subteam') return 'leadership';
  if (item.type === 'person') return { Captain: 'leadership', Coach: 'mentors', Mentor: 'mentors' }[doc.role] || 'other';
  const found = roleGroups.filter(group => group.roles.includes(doc.role))[0];
  return found ? found.id : 'other';
}

// The filter on the roster: a role group, or everything
export const peopleFilters = [
  { id: 'all', title: 'All' },
  { id: 'students', title: 'Students' },
  { id: 'mentors', title: 'Mentors and coaches' },
  { id: 'parents', title: 'Parents' },
  { id: 'leadership', title: 'Leadership' },
];

// Whether a person shows under a filter and a search (lower case). The search looks at the first name, and at the subteam name
// and the members of a team lead, since those are first names too.
export function keepPerson(item, kind, query) {
  if (kind !== 'all' && roleGroupOf(item) !== kind) return false;
  if (query === '') return true;
  const doc = item.document || {};
  const words = [personName(item)];
  if (item.type === 'subteam') words.push(doc.name, ...(Array.isArray(doc.members) ? doc.members : []));
  return words.some(word => String(word || '').toLowerCase().includes(query));
}

// The people by team, then by role: [{ id, title, count, roles: [{ id, title, count, items }] }]. A team that has nobody is left out.
// Teams come in the order of the list, then Both teams. A person with no team is for both teams.
export function rosterGroups(items, teams) {
  const columns = teams.map(team => ({ id: team.id, title: team.name })).concat([{ id: '', title: 'Both teams' }]);
  const known = columns.map(column => column.id);
  const teamOf = item => {
    const ref = item.document.team && item.document.team._ref;
    return known.includes(ref) ? ref : '';
  };
  const sorted = sortItems(items, personName);
  const out = [];
  columns.forEach(column => {
    const here = sorted.filter(item => teamOf(item) === column.id);
    if (here.length === 0) return;
    const roles = roleGroups.map(group => ({ id: group.id, title: group.title, items: here.filter(item => roleGroupOf(item) === group.id) }));
    const other = here.filter(item => roleGroupOf(item) === 'other');
    if (other.length > 0) roles.push({ id: 'other', title: 'No role', items: other });
    const shown = roles.filter(group => group.items.length > 0).map(group => Object.assign(group, { count: group.items.length }));
    out.push({ id: column.id || 'both', title: column.title, count: here.length, roles: shown });
  });
  return out;
}

// A line under a person's name: job title, department
export function personLine(doc, departments) {
  const department = departments.filter(choice => choice.value === doc.department)[0];
  return [doc.jobTitle, department ? department.title : doc.department].filter(Boolean).join(' · ');
}
