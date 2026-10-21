// Turns the Studio schema definitions into a plain "form spec" that the Control page draws its Settings forms from, so that no
// field is written by hand twice. Only plain functions: it takes the list of schema types (already loaded, with
// control/support/schema-load.js or with the real Studio) and a plan (schema-plan.js), and gives back JSON.
//
//   buildSpec(types, plan)  { documents: [...], skipped: [...] }
//
// What a field becomes: a name, a title, the one line description, a widget (text, textarea, number, switch, radio, select,
// color, date, datetime, checks, tags, team, group, list or studio-only), the choices, the limits the validation rules
// asked for, the starting value, and when the Studio hides it from the form. A field the Control page cannot edit safely is
// not dropped without a word: it is listed in skipped with the reason, and tests/schema-spec.test.mjs prints that list.
// Stored names are never changed here.

// ----- the rule recorder -----

const flagChecks = ['required', 'integer', 'positive', 'negative', 'unique', 'uri', 'email', 'uppercase', 'lowercase'];
const valueChecks = ['min', 'max', 'length', 'greaterThan', 'lessThan', 'precision'];

// A Rule that writes down what it was asked, so the limits of a field can be read without the Studio
function recordRules(validation) {
  const records = [];

  function chain() {
    const record = { level: 'error', message: '', checks: {}, customs: [] };
    records.push(record);
    const rule = {};
    flagChecks.forEach(name => { rule[name] = () => { record.checks[name] = true; return rule; }; });
    valueChecks.forEach(name => { rule[name] = value => { record.checks[name] = value; return rule; }; });
    rule.regex = (pattern, options) => {
      const named = typeof options === 'string' ? options : options && options.name;
      record.checks.regex = { source: pattern.source, flags: pattern.flags, name: named || '', invert: Boolean(options && options.invert) };
      return rule;
    };
    rule.valid = list => { record.checks.valid = Array.isArray(list) ? list : [list]; return rule; };
    rule.custom = fn => { record.customs.push(fn); return rule; };
    rule.error = message => { record.level = 'error'; if (message) record.message = message; return rule; };
    rule.warning = message => { record.level = 'warning'; if (message) record.message = message; return rule; };
    rule.info = message => { record.level = 'info'; if (message) record.message = message; return rule; };
    ['reference', 'assetRequired', 'fields', 'precision', 'keys'].forEach(name => { if (!rule[name]) rule[name] = () => rule; });
    return rule;
  }

  const Rule = new Proxy({}, { get: (target, name) => (...args) => {
    const made = chain();
    return typeof made[name] === 'function' ? made[name](...args) : made;
  } });

  const list = Array.isArray(validation) ? validation : [validation];
  list.forEach(item => {
    if (typeof item !== 'function') return;
    try { item(Rule); } catch (error) { /* a rule that needs the Studio is left unread */ }
  });
  return records;
}

// What the rules say, in the form the page and the server both use. The words are the messages the Studio shows.
function limitsOf(validation) {
  const out = { required: false, warn: {}, messages: {} };
  const customs = [];
  recordRules(validation).forEach(record => {
    const target = record.level === 'warning' ? out.warn : out;
    Object.keys(record.checks).forEach(name => {
      const value = record.checks[name];
      if (name === 'regex') {
        const rule = { source: value.source, flags: value.flags, name: value.name, message: record.message };
        (target.regex = target.regex || []).push(rule);
      } else if (name === 'valid') {
        target.valid = value;
        if (record.message && record.level !== 'warning') out.messages.valid = record.message;
      } else if (record.level === 'info') {
        // info is advice and refuses nothing
      } else if (flagChecks.includes(name)) {
        target[name] = true;
        if (record.message && record.level !== 'warning' && out.messages[name] === undefined) out.messages[name] = record.message;
      } else {
        // the first limit of a kind wins when two rules disagree, so the strictest is not hidden by order
        if (target[name] === undefined || (name === 'max' && value < target[name]) || (name === 'min' && value > target[name])) target[name] = value;
        if (record.message && record.level !== 'warning' && out.messages[name] === undefined) out.messages[name] = record.message;
        if (record.message && record.level === 'warning') (target.messages = target.messages || {})[name] = record.message;
      }
    });
    record.customs.forEach(fn => customs.push({ fn: fn, level: record.level, message: record.message }));
  });
  if (Object.keys(out.warn).length === 0) delete out.warn;
  if (out.regex === undefined) delete out.regex;
  if (customs.length > 0) out.custom = customs.length;
  Object.defineProperty(out, 'customs', { value: customs, enumerable: false });
  return out;
}

// ----- hidden -----

// A hidden that is a function reads other fields of the same item. When it reads exactly one of them and that one has a
// short list of choices (or is a switch), the form can follow it: showWhen says which values show the field.
function probeHidden(hidden, siblings) {
  const read = new Set();
  const spy = new Proxy({}, { get: (target, key) => { if (typeof key === 'string') read.add(key); return undefined; } });
  try {
    hidden({ parent: spy, document: spy, value: undefined, currentUser: null });
  } catch (error) {
    return { conditional: true };
  }
  const names = Array.from(read);
  if (names.length !== 1) return { conditional: true };
  const sibling = siblings.filter(field => field.name === names[0])[0];
  const values = sibling && sibling.options && Array.isArray(sibling.options.list)
    ? sibling.options.list.map(item => (item && typeof item === 'object' ? item.value : item))
    : sibling && sibling.type === 'boolean' ? [true, false] : null;
  if (!values) return { conditional: true, dependsOn: names[0] };
  try {
    const shows = values.filter(value => hidden({ parent: { [names[0]]: value }, document: { [names[0]]: value }, value: undefined, currentUser: null }) === false);
    return { conditional: true, dependsOn: names[0], showWhen: { field: names[0], values: shows } };
  } catch (error) {
    return { conditional: true, dependsOn: names[0] };
  }
}

// ----- one field -----

const uploadTypes = ['image', 'file', 'slug', 'geopoint', 'block', 'crossDatasetReference', 'globalDocumentReference'];
const textTypes = ['string', 'text', 'url', 'number', 'boolean', 'date', 'datetime'];

function titleOf(name) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());
}

function choicesOf(list) {
  return list.map(item => (item && typeof item === 'object' ? { title: String(item.title !== undefined ? item.title : item.value), value: item.value } : { title: String(item), value: item }));
}

function isRetired(field) {
  return typeof field.description === 'string' && /^Not (used|read) any more/.test(field.description);
}

function isNote(field) {
  return Boolean(field.components && field.components.field && field.readOnly);
}

function inputName(field) {
  return field.components && field.components.input ? field.components.input.name || 'custom' : '';
}

// Inputs that only draw an ordinary form in the Studio, so the plain widget does the same job
const plainInputs = ['TeamColorsInput', 'TeamInput'];

function teamReference(field) {
  const to = field.to || (field.of && field.of[0] && field.of[0].to) || [];
  return to.length === 1 && to[0].type === 'team';
}

// Converts one schema field. Returns { field } or { skip: 'reason' }.
function convert(field, siblings, state, trail, depth) {
  const path = trail.concat(field.name).join('.');
  const plan = state.plan;
  const reason = plan.skip && plan.skip[path];
  if (reason) return { skip: reason };
  if (isNote(field)) return { skip: 'A note in the Studio form. It stores nothing.' };
  if (field.hidden === true && isRetired(field)) return { skip: 'Not used any more. The screen does not read it, and the stored value is kept as it is.' };

  const out = {
    name: field.name,
    title: field.title || titleOf(field.name),
    description: field.description || '',
  };
  if (field.readOnly === true) out.readOnly = true;
  if (field.initialValue !== undefined && typeof field.initialValue !== 'function') out.initialValue = JSON.parse(JSON.stringify(field.initialValue));
  if (field.hidden === true) out.studioPage = true;
  else if (typeof field.hidden === 'function') Object.assign(out, probeHidden(field.hidden, siblings));

  const onlyFor = state.plan.onlyFor && state.plan.onlyFor[path];
  if (onlyFor) out.onlyFor = onlyFor;
  if (field.group) out.group = field.group;
  if (field.fieldset) out.fieldset = field.fieldset;

  const input = inputName(field);
  let type = field.type;
  let registered = null;
  if (!textTypes.includes(type) && !['object', 'array', 'reference'].includes(type)) {
    registered = state.types.get(type);
    if (registered && registered.type === 'object') type = 'object';
  }
  const source = registered || field;

  if (uploadTypes.includes(type)) return { skip: 'A picture or file upload. It is added in the Studio.' };
  if (input && !plainInputs.includes(input)) return { skip: 'Drawn by its own page in the Studio (' + input + '). Edit it there.' };

  out.validation = limitsOf(field.validation);
  if (field.options && Array.isArray(field.options.list)) out.options = { list: choicesOf(field.options.list), layout: field.options.layout || '' };

  if (type === 'reference') {
    if (!teamReference(field)) return { skip: 'A link to something other than a team. Pick it in the Studio.' };
    out.type = 'reference';
    out.widget = 'team';
    return { field: out };
  }

  if (textTypes.includes(type)) {
    out.type = type;
    if (type === 'boolean') out.widget = 'switch';
    else if (type === 'number') out.widget = out.options ? 'select' : 'number';
    else if (type === 'date') out.widget = 'date';
    else if (type === 'datetime') out.widget = 'datetime';
    else if (out.options) out.widget = out.options.layout === 'radio' || out.options.list.length <= 5 ? 'radio' : 'select';
    else if (type === 'text') out.widget = 'textarea';
    else if ((out.validation.regex || []).some(rule => rule.name === 'hex color')) out.widget = 'color';
    else out.widget = 'text';
    if (type === 'text' && field.rows) out.rows = field.rows;
    return { field: out };
  }

  if (type === 'object') {
    out.type = 'object';
    out.widget = 'group';
    const converted = convertAll(source.fields || [], state, trail.concat(field.name), depth);
    out.fields = converted;
    if (converted.length === 0) return { skip: 'An object with nothing the Control page can edit.' };
    return { field: out };
  }

  if (type === 'array') {
    const members = field.of || [];
    out.type = 'array';
    const first = members[0] || {};
    const primitive = members.length === 1 && textTypes.includes(first.type);
    if (primitive) {
      const list = (field.options && field.options.list) || (first.options && first.options.list);
      out.of = first.type;
      if (list) {
        out.widget = 'checks';
        out.options = { list: choicesOf(list), layout: '' };
      } else {
        out.widget = 'tags';
        out.memberValidation = limitsOf(first.validation);
      }
      return { field: out };
    }
    if (depth >= 1) return { skip: 'A list inside a list. Edit it in the Studio.' };
    out.widget = 'list';
    out.members = [];
    members.forEach(member => {
      const named = state.types.get(member.type) || member;
      if (member.type === 'reference' || member.type === 'image') {
        state.skipped.push({ document: state.doc, field: path + '[]', reason: 'A list of ' + (member.type === 'image' ? 'pictures' : 'links') + '. Edit it in the Studio.' });
        return;
      }
      if (named.type !== 'object') {
        state.skipped.push({ document: state.doc, field: path + '[]', reason: 'A list of ' + (named.type || 'something else') + ', which the Control page does not draw.' });
        return;
      }
      const before = state.skipped.length;
      const fields = convertAll(named.fields || [], state, trail.concat(field.name + '[]'), depth + 1);
      // An item that needs a picture cannot be made here, but one that exists can have its words changed
      const needsUpload = state.skipped.slice(before).some(item => /upload/.test(item.reason));
      if (fields.length === 0) {
        state.skipped.push({ document: state.doc, field: path + '[]', reason: 'A kind of list item with nothing the Control page can edit.' });
        return;
      }
      out.members.push({ type: member.type === 'object' ? (member.name || 'item') : member.type, title: member.title || named.title || titleOf(path), fields: fields, addable: !needsUpload });
    });
    if (out.members.length === 0) return { skip: 'A list the Control page cannot draw. Edit it in the Studio.' };
    return { field: out };
  }

  return { skip: 'A kind of field (' + type + ') the Control page does not draw.' };
}

function convertAll(fields, state, trail, depth) {
  const out = [];
  fields.forEach(field => {
    const result = convert(field, fields, state, trail, depth);
    const path = trail.concat(field.name).join('.');
    if (result.field) out.push(result.field);
    else state.skipped.push({ document: state.doc, field: path, reason: result.skip });
  });
  return out;
}

// ----- the documents -----

function placeFields(fields, type, plan) {
  const groups = type.groups || [];
  const sets = {};
  (type.fieldsets || []).forEach(set => { sets[set.name] = set.title; });
  fields.forEach(field => {
    const placed = plan.place ? plan.place(field, type) : null;
    if (placed) {
      field.tab = placed.tab;
      if (placed.section) field.section = placed.section;
    } else {
      const group = groups.filter(item => item.name === field.group)[0] || groups.filter(item => item.default)[0] || groups[0];
      field.tab = group ? group.name : 'all';
      if (field.fieldset && sets[field.fieldset]) field.section = sets[field.fieldset];
    }
    delete field.group;
    delete field.fieldset;
  });
}

export function buildSpec(types, plan) {
  const byName = new Map(types.map(type => [type.name, type]));
  const skipped = [];
  const documents = [];

  plan.documents.forEach(entry => {
    const type = byName.get(entry.type);
    if (!type) throw new Error('The plan names the type ' + entry.type + ', which the schemas do not have.');
    const state = { skipped: skipped, types: byName, plan: { skip: entry.skip || {}, place: entry.place, onlyFor: entry.onlyFor }, doc: entry.id || entry.type };
    const fields = convertAll(type.fields || [], state, [], 0);
    placeFields(fields, type, state.plan);

    const used = [];
    fields.forEach(field => { if (!used.includes(field.tab)) used.push(field.tab); });
    const tabs = (entry.tabs || (type.groups || []).map(group => ({ id: group.name, title: group.title, says: '' })))
      .filter(tab => used.includes(tab.id));
    used.filter(id => !tabs.some(tab => tab.id === id)).forEach(id => tabs.push({ id: id, title: titleOf(id), says: '' }));

    documents.push({
      id: entry.id || '',
      type: entry.type,
      mode: entry.mode,
      ids: entry.ids || [],
      title: entry.title || type.title,
      description: entry.says || type.description || '',
      tabs: tabs,
      fields: fields,
    });
  });

  return { version: 1, documents: documents, skipped: skipped };
}
