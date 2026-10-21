// The plain part of the All settings form: no page code, so node can test it (tests/settings-all-values.test.mjs). It works out what a
// field shows, what changed since the page loaded a document, which fields a search finds, and the patch to save.

export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

// Two values are the same when they print the same, an empty text and no value are the same, and so are a list with
// nothing in it and no list
export function sameValue(a, b) {
  const plain = value => (isEmpty(value) ? null : value);
  return JSON.stringify(plain(a)) === JSON.stringify(plain(b));
}

// ----- what a field shows -----

// The value to show for a field of a document: what is stored, or the starting value of the schema for a setting or a group
// that was never stored. A list or a set of ticks shows only what is stored, because an empty one means something else on the
// screen (the Studio fields say so in their descriptions).
export function shownValue(field, stored) {
  if (field.widget === 'group') {
    const own = isObject(stored) ? stored : {};
    const out = {};
    field.fields.forEach(sub => {
      const value = shownValue(sub, own[sub.name]);
      if (value !== undefined) out[sub.name] = value;
    });
    return out;
  }
  if (field.widget === 'list' || field.widget === 'tags' || field.widget === 'checks') return clone(stored);
  if (stored !== undefined && stored !== null) return clone(stored);
  return field.initialValue === undefined ? undefined : clone(field.initialValue);
}

export function shownValues(fields, doc) {
  const out = {};
  fields.forEach(field => {
    const value = shownValue(field, doc ? doc[field.name] : undefined);
    if (value !== undefined) out[field.name] = value;
  });
  return out;
}

// ----- which fields are on the page -----

// A field the Studio shows only for some values of another field, or only for some documents
export function visible(field, parent, docId) {
  if (field.onlyFor && !field.onlyFor.includes(docId)) return false;
  if (field.showWhen) {
    const value = parent ? parent[field.showWhen.field] : undefined;
    return field.showWhen.values.includes(value);
  }
  return true;
}

// ----- search -----

function wordsOf(field, section) {
  return [field.title, field.description, field.name, section || field.section || ''].join(' ').toLowerCase();
}

// A field matches when every word of the search is in its title, description, name or section, or in a field inside it
export function fieldMatches(field, query, section) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [wordsOf(field, section)];
  (field.fields || []).forEach(sub => text.push(wordsOf(sub)));
  (field.members || []).forEach(member => member.fields.forEach(sub => text.push(wordsOf(sub))));
  const all = text.join(' ');
  return words.every(word => all.includes(word));
}

// The fields of one document that a search finds, in order, each with its tab
export function searchFields(docSpec, query) {
  return docSpec.fields.filter(field => fieldMatches(field, query));
}

// What a search finds in the other documents, for the line that says "also found in Teams: Glow"
export function searchOthers(spec, currentType, query) {
  const found = [];
  spec.documents.forEach(doc => {
    if (doc.type === currentType) return;
    const names = doc.fields.filter(field => fieldMatches(field, query)).map(field => field.title);
    if (names.length > 0) found.push({ type: doc.type, title: doc.title, names: names });
  });
  return found;
}

// ----- changes -----

function pick(fields, source) {
  const out = {};
  fields.forEach(field => {
    if (source && Object.prototype.hasOwnProperty.call(source, field.name) && !isEmpty(source[field.name])) out[field.name] = source[field.name];
  });
  return out;
}

// An item of a list as the server wants it: only the fields of its kind, its key and its kind
function itemOut(field, item) {
  const member = field.members.length === 1 ? field.members[0] : field.members.filter(one => one.type === item._type)[0];
  const out = {};
  if (item._key) out._key = item._key;
  if (item._type) out._type = item._type;
  if (!member) return Object.assign({}, item);
  member.fields.forEach(sub => {
    if (!Object.prototype.hasOwnProperty.call(item, sub.name)) return;
    const value = item[sub.name];
    if (isEmpty(value)) return;
    out[sub.name] = valueOut(sub, value);
  });
  return out;
}

function valueOut(field, value) {
  if (field.widget === 'list' && Array.isArray(value)) return value.map(item => itemOut(field, item));
  if (field.widget === 'group' && isObject(value)) return pick(field.fields, value);
  return value;
}

// What a save sends for a group: only the sub-fields that changed, a cleared one as an empty text
function groupChange(field, was, now) {
  const out = {};
  field.fields.forEach(sub => {
    const before = isObject(was) ? was[sub.name] : undefined;
    const after = isObject(now) ? now[sub.name] : undefined;
    if (sameValue(before, after)) return;
    if (sub.widget === 'group') {
      const inner = groupChange(sub, before, after);
      if (Object.keys(inner).length > 0) out[sub.name] = inner;
    } else {
      out[sub.name] = isEmpty(after) ? '' : valueOut(sub, after);
    }
  });
  return out;
}

// The patch for a save: set and unset, and the names that changed. base is what the page showed when it loaded (shownValues),
// working is what is on the page now. A setting that was never stored and is still at its starting value is not sent.
export function changesOf(fields, base, working) {
  const set = {};
  const unset = [];
  fields.forEach(field => {
    if (field.readOnly) return;
    const was = base[field.name];
    const now = working[field.name];
    if (sameValue(was, now)) return;
    if (field.widget === 'group') {
      const inner = groupChange(field, was, now);
      if (Object.keys(inner).length > 0) set[field.name] = inner;
    } else if (isEmpty(now) || (Array.isArray(now) && now.length === 0 && field.widget !== 'list' && field.widget !== 'tags')) {
      unset.push(field.name);
    } else {
      set[field.name] = valueOut(field, now);
    }
  });
  return { set: set, unset: unset, names: Object.keys(set).concat(unset) };
}

// ----- lists -----

// The starting values of a new item of a kind of list
export function newItem(member) {
  const item = {};
  if (member.type !== 'item') item._type = member.type;
  member.fields.forEach(field => {
    const value = shownValue(field, undefined);
    if (value !== undefined) item[field.name] = value;
  });
  item._key = Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  return item;
}

// A name for an item in the list: the first text it has
export function itemLabel(field, item, index) {
  const member = field.members.length === 1 ? field.members[0] : field.members.filter(one => one.type === item._type)[0];
  const fields = member ? member.fields : [];
  const named = fields.filter(sub => ['name', 'title', 'text', 'label'].includes(sub.name)).concat(fields);
  const text = named.map(sub => item[sub.name]).filter(value => typeof value === 'string' && value !== '')[0];
  return (member && field.members.length > 1 ? member.title + ': ' : '') + (text || 'Item ' + (index + 1));
}

export function move(list, index, step) {
  const to = index + step;
  if (to < 0 || to >= list.length) return list;
  const copy = list.slice();
  copy.splice(to, 0, copy.splice(index, 1)[0]);
  return copy;
}

// ----- a value at a path ('crt.everySeconds', 'calendars[1].name') -----

export function setAt(root, path, value) {
  const steps = String(path).replace(/\[(\d+)\]/g, '.$1').split('.');
  let here = root;
  steps.slice(0, -1).forEach((step, index) => {
    if (here[step] === undefined || here[step] === null) here[step] = /^\d+$/.test(steps[index + 1]) ? [] : {};
    here = here[step];
  });
  const last = steps[steps.length - 1];
  if (value === undefined) delete here[last];
  else here[last] = value;
  return root;
}

export function getAt(root, path) {
  return String(path).replace(/\[(\d+)\]/g, '.$1').split('.').reduce((here, step) => (here === undefined || here === null ? undefined : here[step]), root);
}

// ----- dates -----

const two = number => String(number).padStart(2, '0');

// An ISO time as the text of a date and time box (in the time zone of the browser), and back
export function toLocalBox(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + two(date.getMonth() + 1) + '-' + two(date.getDate()) + 'T' + two(date.getHours()) + ':' + two(date.getMinutes());
}

export function fromLocalBox(text) {
  if (!text) return '';
  const date = new Date(text);
  return isNaN(date.getTime()) ? '' : date.toISOString();
}
