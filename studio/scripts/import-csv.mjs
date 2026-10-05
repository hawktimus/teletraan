// Turns filled-in CSV templates (docs/content-templates/) into import.ndjson, for
// `sanity dataset import`. Run it from the studio folder: node scripts/import-csv.mjs folder-or-file ...
// Row 2 of each CSV says what its columns accept; make-templates.mjs writes it. If any
// row breaks a rule nothing is written: fix the CSV and run it again. An id is the type
// plus the words of the row, so importing twice changes nothing.
import fs from 'node:fs';
import path from 'node:path';

// What each kind of cell must look like, how to say it, and what is stored
const kinds = {
  'yes/no': [/^(yes|no|true|false)$/i, 'yes or no', text => /^(yes|true)$/i.test(text)],
  number: [/^-?\d+(\.\d+)?$/, 'a number', Number],
  'whole number': [/^-?\d+$/, 'a whole number', Number],
  date: [/^\d{4}-\d{2}-\d{2}$/, 'a date such as 2027-03-04', text => text],
  time: [/^([01]\d|2[0-3]):[0-5]\d$/, 'a 24 hour time such as 18:30', text => text],
  datetime: [/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/, 'a date and time such as 2027-03-04 18:30', text => new Date(text.replace(' ', 'T')).toISOString()],
  'web address': [/^https?:\/\/\S+$/, 'a web address starting with https://', text => text],
};
const slug = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Cells are split at commas. A cell in "quotes" may hold commas, new lines and
// quote marks, which are written twice ("").
function parseCsv(text) {
  const records = [], chars = text.replace(/\r\n?/g, '\n');
  let record = [], cell = '', quoted = false;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (quoted && c === '"' && chars[i + 1] === '"') { cell += '"'; i++; }
    else if (quoted && c === '"') quoted = false;
    else if (quoted) cell += c;
    else if (c === '"' && cell === '') quoted = true;
    else if (c === ',') { record.push(cell); cell = ''; }
    else if (c === '\n') { records.push(record.concat(cell)); record = []; cell = ''; }
    else cell += c;
  }
  return cell !== '' || record.length ? records.concat([record.concat(cell)]) : records;
}

// Checks one cell against the rules of its column and gives back { value } or { error }
function readCell(text, rules) {
  const arg = word => { const rule = rules.find(r => r.startsWith(word + ' ')); return rule ? rule.slice(word.length + 1) : ''; };
  const kind = Object.keys(kinds).find(word => rules.includes(word));
  const max = arg('max'), min = arg('min'), each = arg('each max'), choices = arg('one of'), fail = error => ({ error });
  if (arg('name of')) return { value: { _type: 'reference', _ref: arg('name of') + '-' + slug(text) } };
  if (rules.includes('lines')) {
    const lines = text.split('|').map(line => line.trim()).filter(Boolean), long = lines.find(line => line.length > Number(each));
    if (lines.length > Number(max)) return fail(lines.length + ' lines, up to ' + max + ' fit');
    return long ? fail('"' + long + '" is ' + long.length + ' characters, up to ' + each + ' fit') : { value: lines };
  }
  if (choices && !choices.split('/').includes(text)) return fail('write one of: ' + choices.split('/').join(', '));
  if (kind && !kinds[kind][0].test(text)) return fail('write ' + kinds[kind][1]);
  const day = text.slice(0, 10); // the date, or the date part of a date and time
  if (/^date/.test(kind) && new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) return fail(day + ' is not a day on the calendar');
  const size = /number$/.test(kind) ? Number(text) : kind ? text : text.length; // what min and max measure
  const bound = limit => (typeof size === 'number' ? Number(limit) : limit);
  if (max !== '' && size > bound(max)) return fail(kind ? text + ' is above ' + max : size + ' characters, up to ' + max + ' fit');
  if (min !== '' && size < bound(min)) return fail(text + ' is below ' + min);
  return { value: kind ? kinds[kind][2](text) : text };
}

const docs = [], problems = [], ids = {}, refs = [];
const report = (file, row, column, message) => problems.push(path.basename(file) + ', row ' + row + ', column ' + column + ': ' + message);

// One row of a CSV becomes one document. Columns such as rows.2.text belong to
// the group rows.2, which becomes one item of the list rows.
function readRow(file, type, names, limits, record, row) {
  const cell = j => (record[j] || '').trim();
  if (record.every(text => !text.trim()) || cell(0).toUpperCase() === 'EXAMPLE') return;

  const doc = { _id: '', _type: type }, items = {}, idParts = [];
  const prefix = name => name.split('.').slice(0, 2).join('.');
  const grouped = name => name.split('.').length === 3;
  const filled = name => names.some((other, k) => grouped(other) && prefix(other) === prefix(name) && cell(k));
  names.forEach((name, j) => {
    if (j === 0) return;
    const kind = grouped(name) ? cell(names.indexOf(prefix(name) + '._type')) : ''; // the kind of block
    const mine = limits[j].filter(rule => !rule.when || rule.when === kind);
    const rules = mine.map(rule => rule.text);
    const text = cell(j) || (rules.find(rule => rule.startsWith('default ')) || '').slice(8); // what Studio fills in for a new item
    if (!text) return rules.includes('required') && (!grouped(name) || filled(name)) ? report(file, row, name, 'is needed') : null;
    if (kind && limits[j].length && !mine.length) return report(file, row, name, 'is not used by a ' + kind + ', leave it empty');
    const result = readCell(text, rules);
    if (result.error) return report(file, row, name, result.error);
    if (result.value._ref) refs.push({ file, row, name, text, id: result.value._ref });
    rules.filter(rule => rule.startsWith('id ')).forEach(rule => { idParts[Number(rule.slice(3))] = text; });
    if (grouped(name)) items[prefix(name)] = Object.assign(items[prefix(name)] || {}, { [name.split('.')[2]]: result.value });
    else doc[name] = result.value;
  });
  Object.keys(items).forEach(key => { doc[key.split('.')[0]] = (doc[key.split('.')[0]] || []).concat(items[key]); });
  doc._id = [type].concat(idParts.filter(Boolean).map(slug)).join('-');
  if (doc._id === type || ids[doc._id]) report(file, row, names[1], ids[doc._id] ? 'makes the same id as ' + ids[doc._id] : 'needs words to make an id from');
  ids[doc._id] = ids[doc._id] || path.basename(file) + ' row ' + row;
  docs.push(doc);
}

function readFile(file) {
  const records = parseCsv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const names = (records[0] || []).map(name => name.trim());
  const type = ((records[1] || [])[0] || '').match(/^type (\w+)/);
  // a rule such as "max 30 if headingBlock" only applies to that kind of block
  const limits = names.map((name, j) => ((records[1] || [])[j] || '').split(';').map(part => part.trim().split(' if ')).filter(part => part[0]).map(part => ({ text: part[0], when: part[1] })));
  if (!type) return problems.push(path.basename(file) + ': row 2 should start with the type, such as "type task". Use a template from docs/content-templates/.');
  records.slice(2).forEach((record, i) => readRow(file, type[1], names, limits, record, i + 3));
}

process.argv.slice(2).forEach(arg => {
  if (!fs.existsSync(arg)) problems.push(arg + ': there is no such file or folder');
  else if (fs.statSync(arg).isDirectory()) fs.readdirSync(arg).filter(name => /\.csv$/i.test(name)).sort().forEach(name => readFile(path.join(arg, name)));
  else readFile(arg);
});
refs.filter(ref => !ids[ref.id]).forEach(ref => report(ref.file, ref.row, ref.name, '"' + ref.text + '" is not in the ' + ref.id.split('-')[0] + ' CSV given with this one'));

if (problems.length || !docs.length) {
  console.error(problems.length ? problems.join('\n') + '\n\n' + problems.length + ' problem(s). Nothing was written. Fix the CSV and run this again.' : 'No rows to import. Give a CSV file or a folder of them. Empty rows and EXAMPLE rows are skipped.');
  process.exit(1);
}
fs.writeFileSync('import.ndjson', docs.map(doc => JSON.stringify(doc)).join('\n') + '\n');
console.log('Wrote ' + docs.length + ' documents to import.ndjson. Next: npx sanity dataset import import.ndjson --missing');
