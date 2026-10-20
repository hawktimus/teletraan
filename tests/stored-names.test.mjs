// Fails when a name that is stored in Sanity is removed or renamed in a schema.
//
// Editors have typed content under these names (a field, a type, a choice such as "in-progress"). A schema that
// renames one makes that content vanish from the screen without an error. tests/data/stored-names.txt is the list of
// every name there has been. A name may be added and may never be removed.
//
//   node tests/stored-names.test.mjs          check the schemas against the list
//   node tests/stored-names.test.mjs --add    write the names the list does not have yet (you made a new field)
//
// To retire a field, keep it in the schema with hidden: true and a description that says it is not used
// (docs/adding-a-field.md). To change what editors read, change its title and never its name.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStudio } from './helpers/studio-world.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const listFile = path.join(repo, 'tests/data/stored-names.txt');
const header = [
  '# Every name stored in Sanity: a type, a field of it, the rows inside a list, and the choices of a field.',
  '# A name is added with: node tests/stored-names.test.mjs --add',
  '# A name is never removed or renamed: content that editors typed would be lost (docs/adding-a-field.md).',
];

// The names a schema holds, one string each: type.field, type.list.<object>.field, type.field = choice
function namesIn(types) {
  const names = [];

  function visit(item, prefix) {
    const here = prefix + '.' + item.name;
    names.push(here);
    const choices = item.options && Array.isArray(item.options.list) ? item.options.list : [];
    choices.forEach(choice => names.push(here + ' = ' + (choice && typeof choice === 'object' ? choice.value : choice)));
    (item.fields || []).forEach(field => visit(field, here));

    // the rows of a list: an object with fields, or a named type. A list of plain strings or numbers has no name to keep.
    (item.of || []).forEach(row => {
      if (row.fields || row.name) visit({ name: row.name || '<object>', fields: row.fields, of: row.of, options: row.options }, here);
      else if (row.type && !['string', 'number', 'boolean', 'text', 'date', 'datetime', 'url'].includes(row.type)) names.push(here + '.<' + row.type + '>');
    });
  }

  types.forEach(type => {
    names.push(type.name);
    (type.fields || []).forEach(field => visit(field, type.name));
  });
  return Array.from(new Set(names)).sort();
}

const studio = await openStudio();
let current;
try {
  current = namesIn((await studio.load('schemas/index.js')).schemaTypes);
} finally {
  studio.close();
}

const listed = fs.existsSync(listFile) ? fs.readFileSync(listFile, 'utf8').split('\n').filter(line => line.trim() !== '' && !line.startsWith('#')) : [];

if (process.argv.includes('--add')) {
  const all = Array.from(new Set(listed.concat(current))).sort();
  fs.mkdirSync(path.dirname(listFile), { recursive: true });
  fs.writeFileSync(listFile, header.join('\n') + '\n' + all.join('\n') + '\n');
  console.log('Added ' + (all.length - listed.length) + ' names. tests/data/stored-names.txt now has ' + all.length + '.');
  process.exit(0);
}

if (listed.length === 0) {
  console.log('FAIL  tests/data/stored-names.txt is missing or empty');
  console.log('      Do instead: run node tests/stored-names.test.mjs --add');
  process.exit(1);
}

const missing = listed.filter(name => !current.includes(name));
const added = current.filter(name => !listed.includes(name));

// A guess at what a removal really is: a name of the same field that is new
function renamedTo(name) {
  const place = name.lastIndexOf('.');
  const parent = name.slice(0, place + 1);
  const sameParent = added.filter(other => other.startsWith(parent) && !other.slice(place + 1).includes('.') && !other.includes(' = '));
  return sameParent.length > 0 && !name.includes(' = ') ? sameParent : [];
}

if (missing.length === 0) {
  console.log('ok    every stored name in tests/data/stored-names.txt is still in the schemas (' + listed.length + ' names)');
  if (added.length > 0) {
    console.log('note  ' + added.length + ' names are not on the list yet, such as ' + added.slice(0, 3).join(', ') + '. Run: node tests/stored-names.test.mjs --add');
  }
  console.log('\n1 of 1 stored-names checks passed.');
  process.exit(0);
}

console.log('FAIL  a name stored in Sanity was removed or renamed in a schema');
missing.slice(0, process.env.TELETRAAN_RUNNER ? 5 : missing.length).forEach(name => {
  const guess = renamedTo(name);
  console.log('      studio/schemas: "' + name + '" is gone' + (guess.length > 0 ? ' (renamed to one of: ' + guess.slice(0, 3).join(', ') + '?)' : ''));
});
if (process.env.TELETRAAN_RUNNER && missing.length > 5) console.log('      and ' + (missing.length - 5) + ' more. Run node tests/stored-names.test.mjs by itself to see them all.');
console.log('      Why: editors already typed content under that name. If the name changes, the content is still in Sanity but the screen no longer reads it.');
console.log('      Do instead: put the old name back. To change what editors read, change the title. To stop using a field, keep it with hidden: true.');
console.log('\n0 of 1 stored-names checks passed.');
process.exit(1);
