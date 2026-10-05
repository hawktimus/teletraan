// Writes one CSV template for each kind of content into docs/content-templates/.
// The columns, limits and choices are read from the schemas in studio/schemas/,
// so a template cannot drift away from the Studio. Run it from the studio
// folder after any change to a schema:
//
//   node scripts/make-templates.mjs
//
// A template has three rows (docs/importing-from-csv.md explains them):
//   row 1  the column names. A list of rows or blocks is a numbered group of
//          columns, such as rows.1.time, rows.1.text, rows.2.time
//   row 2  what each column accepts, in words that import-csv.mjs reads back
//   row 3  a sample row. Its first cell is EXAMPLE and the importer skips it
//
// To add a field, change its schema and run this. If the field is a required
// one, add a sample value for it to `examples` below.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const studioFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutput = path.join(studioFolder, '..', 'docs', 'content-templates');

// Not rows of content. A photo is a picture that has to be uploaded in Studio,
// so it has no CSV template. The pages that exist once (Dashboard Settings,
// Theme) are listed in structure.js.
const skippedTypes = ['photo'];

// The columns whose words make the id of a row, in order. The id is the type
// plus a slug of these cells, so importing the same row twice changes nothing.
// A type that other types point to by name (subteam) must be named by one column.
const idColumns = {
  task: ['title'],
  plan: ['date', 'heading'],
  extraEvent: ['startDate', 'title'],
  sponsor: ['name'],
  tipOrNews: ['text'],
  subteam: ['name'],
  person: ['role', 'name'],
  customPanel: ['title'],
};

// Made-up values for the EXAMPLE row. Words in [square brackets] are marked
// placeholders, as in the sample content. A column with no value here is empty.
const examples = {
  task: { title: '[Task name]', subteam: '[Subteam A]', status: 'in-progress', order: '1', show: 'yes', expires: '2027-03-01 18:00' },
  plan: {
    heading: '[Plan heading]', date: '2027-01-12', location: '[Room or place]',
    'rows.1.time': '[6:00 PM]', 'rows.1.text': '[First thing]', 'rows.1.lead': '[Lead]',
    'rows.2.time': '[6:30 PM]', 'rows.2.text': '[Second thing]',
    show: 'yes',
  },
  extraEvent: { title: '[Event name]', startDate: '2027-03-12', endDate: '2027-03-13', startTime: '09:00', endTime: '17:00', location: '[Place]', show: 'yes' },
  sponsor: {
    name: '[Sponsor name]', tier: '[Tier]', blurb: '[A short line about the sponsor.]', thankYou: '[Thank you to our sponsor]',
    logoAddress: 'https://example.com/logo.png', order: '1', show: 'yes',
  },
  tipOrNews: { kind: 'tip', text: '[A tip for the team.]', order: '1', show: 'yes' },
  subteam: {
    name: '[Subteam A]', lead: '[Lead name]', spotlight: 'yes', spotlightHeadline: '[What the subteam did]',
    spotlightText: "[Two or three short sentences about the subteam's work.]", order: '1', show: 'yes',
  },
  person: { role: 'Captain', name: '[Person name]', showPhoto: 'yes', order: '1', show: 'yes' },
  customPanel: {
    title: '[Title]',
    'blocks.1._type': 'headingBlock', 'blocks.1.text': '[A heading]',
    'blocks.2._type': 'statBlock', 'blocks.2.value': '[00]', 'blocks.2.label': '[What it counts]',
    'blocks.3._type': 'progressBlock', 'blocks.3.label': '[What the bar measures]', 'blocks.3.percent': '50',
    order: '1', show: 'yes',
  },
};

// The real sanity package is not installed here, so a copy of the schemas is
// loaded next to a stand-in whose functions hand back what they are given.
export async function loadSchemas() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-templates-'));
  try {
    ['schemas', 'structure.js', 'themes.js', 'demo-screens.js', 'hidden-transitions.js'].forEach(name => fs.cpSync(path.join(studioFolder, name), path.join(folder, name), { recursive: true }));
    fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ type: 'module' }));
    const stub = path.join(folder, 'node_modules', 'sanity');
    fs.mkdirSync(stub, { recursive: true });
    fs.writeFileSync(path.join(stub, 'package.json'), JSON.stringify({ name: 'sanity', type: 'module', exports: './index.js' }));
    fs.writeFileSync(path.join(stub, 'index.js'), ['defineType', 'defineField', 'defineArrayMember'].map(name => 'export const ' + name + ' = value => value;').join('\n'));

    const schemas = await import(pathToFileURL(path.join(folder, 'schemas', 'index.js')).href);
    const structure = await import(pathToFileURL(path.join(folder, 'structure.js')).href);
    return { types: schemas.schemaTypes, singletons: structure.singletonTypes };
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

// A Rule that writes down what it is asked to do, so the limits can be read
// back without Sanity.
function makeRule(constraints) {
  const rule = { constraints: constraints };
  ['required', 'min', 'max', 'length', 'integer', 'positive', 'regex', 'uri', 'email', 'custom', 'unique', 'valid', 'error', 'warning', 'info'].forEach(name => {
    rule[name] = (...args) => makeRule(constraints.concat([{ name: name, args: args }]));
  });
  return rule;
}

function constraintsOf(item) {
  if (!item.validation) return [];
  return [].concat(item.validation(makeRule([]))).reduce((all, rule) => all.concat(rule.constraints), []);
}

function constraintNamed(constraints, name) {
  return constraints.filter(constraint => constraint.name === name)[0];
}

function limitOf(constraints, name) {
  const found = constraintNamed(constraints, name);
  return found ? found.args[0] : undefined;
}

// The first rule of a column says what kind of value it holds
function kindRule(field, constraints) {
  const list = field.options && field.options.list;
  const regex = constraintNamed(constraints, 'regex');
  const words = { boolean: 'yes/no', url: 'web address', date: 'date', datetime: 'datetime', string: 'text', text: 'text' };

  if (list) {
    list.forEach(choice => {
      if (/[/;]/.test(choice.value)) throw new Error(field.name + ': a choice may not contain / or ;');
    });
    return 'one of ' + list.map(choice => choice.value).join('/');
  }
  if (field.type === 'reference') return 'name of ' + field.to[0].type;
  if (field.type === 'number') return constraintNamed(constraints, 'integer') ? 'whole number' : 'number';
  if (regex && regex.args[1] && regex.args[1].name === '24 hour time') return 'time';
  if (!words[field.type]) throw new Error(field.name + ': the template maker does not know the type ' + field.type);
  return words[field.type];
}

// A list of strings is one cell with the lines between | marks
function rulesFor(field) {
  const constraints = constraintsOf(field);
  const member = field.of && field.of[0];

  if (field.type === 'array') {
    const each = limitOf(constraintsOf(member), 'max');
    return ['lines'].concat(limitOf(constraints, 'max') ? ['max ' + limitOf(constraints, 'max')] : [], each ? ['each max ' + each] : []);
  }
  const rules = [kindRule(field, constraints)];
  if (constraintNamed(constraints, 'required')) rules.push('required');
  // an empty cell gets what Studio fills in for a new item, unless the field is needed
  else if (field.initialValue !== undefined) rules.push('default ' + (field.type === 'boolean' ? (field.initialValue ? 'yes' : 'no') : field.initialValue));
  ['min', 'max'].forEach(name => {
    if (limitOf(constraints, name) !== undefined) rules.push(name + ' ' + limitOf(constraints, name));
  });
  return rules;
}

// A rule is { text, when }. A rule with a `when` only applies to that kind of block.
const plain = texts => texts.map(text => ({ text: text }));

// The columns of a list of objects: a group for each possible row or block.
// Blocks of different kinds share the columns that have the same field name.
function groupColumns(field, typesByName) {
  const count = limitOf(constraintsOf(field), 'max');
  if (!count) throw new Error(field.name + ': a list needs a limit on how many items it may hold');

  const kinds = field.of.map(member => (member.fields ? { name: 'object', fields: member.fields } : { name: member.type, fields: typesByName[member.type].fields }));
  const several = kinds.length > 1;
  const names = [];
  kinds.forEach(kind => kind.fields.forEach(f => { if (names.indexOf(f.name) === -1) names.push(f.name); }));

  const columns = [];
  for (let number = 1; number <= count; number++) {
    const start = field.name + '.' + number + '.';
    if (several) columns.push({ name: start + '_type', rules: plain(['one of ' + kinds.map(kind => kind.name).join('/'), 'required']) });
    names.forEach(name => {
      const rules = [];
      kinds.forEach(kind => {
        const inner = kind.fields.filter(f => f.name === name)[0];
        if (inner) rulesFor(inner).forEach(text => rules.push(several ? { text: text, when: kind.name } : { text: text }));
      });
      columns.push({ name: start + name, rules: rules });
    });
  }
  return columns;
}

function columnsFor(type, typesByName) {
  const columns = [];
  type.fields.forEach(field => {
    if (field.type === 'image') return; // pictures are uploaded in Studio, not imported
    const isGroup = field.type === 'array' && field.of[0].type !== 'string';
    if (isGroup) groupColumns(field, typesByName).forEach(column => columns.push(column));
    else columns.push({ name: field.name, rules: plain(rulesFor(field)) });
  });

  if (!idColumns[type.name]) throw new Error('Add ' + type.name + ' to idColumns in make-templates.mjs: it says which columns name a row.');
  idColumns[type.name].forEach((name, index) => {
    const column = columns.filter(item => item.name === name)[0];
    if (!column) throw new Error(type.name + ': idColumns names ' + name + ', which is not a column');
    column.rules.push({ text: 'id ' + (index + 1) });
  });
  return columns;
}

export function csvCell(text) {
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function templateFor(type, typesByName) {
  const columns = columnsFor(type, typesByName);
  const sample = examples[type.name];
  if (!sample) throw new Error('Add ' + type.name + ' to examples in make-templates.mjs.');

  Object.keys(sample).forEach(name => {
    if (!columns.some(column => column.name === name)) throw new Error(type.name + ': the example has a value for ' + name + ', which is not a column');
  });
  columns.forEach(column => {
    // a column in a numbered group is only needed when its group is used
    const needed = column.rules.some(rule => rule.text === 'required' && !rule.when) && column.name.indexOf('.') === -1;
    if (needed && !sample[column.name]) throw new Error(type.name + ': the example has no value for the required column ' + column.name);
  });

  const limits = column => column.rules.map(rule => (rule.when ? rule.text + ' if ' + rule.when : rule.text)).join('; ');
  const rows = [
    ['example'].concat(columns.map(column => column.name)),
    ['type ' + type.name].concat(columns.map(limits)),
    ['EXAMPLE'].concat(columns.map(column => sample[column.name] || '')),
  ];
  return rows.map(row => row.map(csvCell).join(',')).join('\n') + '\n';
}

// { type: csv text } for every kind of content. Pass the types and the names
// of the pages that exist once, as loadSchemas gives them.
export function makeTemplates(types, singletons) {
  const typesByName = {};
  types.forEach(type => { typesByName[type.name] = type; });

  const result = {};
  types.forEach(type => {
    if (type.type !== 'document' || singletons.indexOf(type.name) !== -1 || skippedTypes.indexOf(type.name) !== -1) return;
    result[type.name] = templateFor(type, typesByName);
  });
  return result;
}

if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.resolve(process.argv[2] || defaultOutput);
  const { types, singletons } = await loadSchemas();
  const files = makeTemplates(types, singletons);

  fs.mkdirSync(output, { recursive: true });
  Object.keys(files).forEach(name => fs.writeFileSync(path.join(output, name + '.csv'), files[name]));
  console.log('Wrote ' + Object.keys(files).length + ' templates to ' + output);
}
