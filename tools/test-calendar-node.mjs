// Tests that the calendar scripts on the Mini run on the Node that apt installs. The scripts
// (deploy/scripts/calendar-status.mjs and check-calendars.mjs) import the dashboard's own files. Those
// are modules, and Node 18 treats a .js file as a module only when a package.json beside it or above it
// says "type": "module". dashboard/package.json says so. This file shows what it does, and reads every
// file the two scripts import to look for anything that Node 18 does not have.
//
// Node 18 itself is not run here. This Node can be told not to guess that a .js file is a module, which
// is how Node 18 behaves, and the tests run the scripts that way.
//
//   node tools/test-calendar-node.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-calendar-node-'));
const entries = ['deploy/scripts/calendar-status.mjs', 'deploy/scripts/check-calendars.mjs'];

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// The files a script imports, and the files those import, as paths from the repository folder
function importGraph(entry) {
  const found = [];

  function visit(file) {
    if (found.includes(file)) return;
    found.push(file);

    const text = fs.readFileSync(path.join(repo, file), 'utf8');
    const fromImports = Array.from(text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/g)).map(match => match[1]);
    const fromCalls = Array.from(text.matchAll(/import\(\s*'([^']+)'\s*\)/g)).map(match => match[1]);
    fromImports.concat(fromCalls).filter(name => name.startsWith('.')).forEach(name => visit(path.relative(repo, path.resolve(path.dirname(path.join(repo, file)), name))));
  }

  visit(entry);
  return found;
}

// Things that Node 18 does not have, each with a pattern that finds it in the text of a file
const missingInNode18 = {
  'Array.prototype.toSorted': /\.toSorted\(/,
  'Array.prototype.toReversed': /\.toReversed\(/,
  'Array.prototype.toSpliced': /\.toSpliced\(/,
  'Array.prototype.with': /\.with\(/,
  'Object.groupBy or Map.groupBy': /\b(?:Object|Map)\.groupBy\(/,
  'Promise.withResolvers': /Promise\.withResolvers/,
  'Array.fromAsync': /Array\.fromAsync/,
  'a method of Set such as union': /\.(?:union|intersection|difference|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(/,
  'String.prototype.isWellFormed': /\.(?:isWellFormed|toWellFormed)\(/,
  'an iterator helper': /\bIterator\.(?:from|prototype)|\.(?:drop|take)\(\d/,
  'the v flag of a regular expression': /\/[dgimsuy]*v[dgimsuy]*(?=[;,).\s]|$)/m,
  'an import attribute': /\bimport\b[^;\n]*\bwith\s*\{|\bassert\s*\{\s*type/,
  'top level await in a file that is not a module': /(?:^|\n)await\s/,
  'RegExp.escape': /RegExp\.escape/,
  'Promise.try': /Promise\.try\(/,
  'Error.isError': /Error\.isError/,
  'Math.sumPrecise': /Math\.sumPrecise/,
};

function problemsIn(text) {
  return Object.keys(missingInNode18).filter(name => missingInNode18[name].test(text));
}

test('dashboard/package.json says only that the files are modules, and what that is for', () => {
  const text = fs.readFileSync(path.join(repo, 'dashboard/package.json'), 'utf8');
  const found = JSON.parse(text);

  assert.deepEqual(Object.keys(found), ['private', 'type', 'description']);
  assert.equal(found.private, true);
  assert.equal(found.type, 'module');
  assert.match(found.description, /ES modules/);
  assert.match(found.description, /calendar scripts in deploy\/scripts/);
  assert.match(found.description, /Browsers do not use this file/);
  assert.ok(!/calendar-status|calendar-sync/.test(text), 'nothing in the dashboard folder names the document the Mini writes (tools/test-calendar-status.mjs)');
});

test('the search for what Node 18 lacks finds each one of them, and finds nothing in plain code that Node 18 runs', () => {
  const samples = {
    'Array.prototype.toSorted': 'list.toSorted()',
    'Array.prototype.toReversed': 'list.toReversed()',
    'Array.prototype.toSpliced': 'list.toSpliced(1, 1)',
    'Array.prototype.with': 'list.with(0, 1)',
    'Object.groupBy or Map.groupBy': 'Object.groupBy(list, item => item.kind)',
    'Promise.withResolvers': 'const { promise } = Promise.withResolvers();',
    'Array.fromAsync': 'const all = Array.fromAsync(stream);',
    'a method of Set such as union': 'first.union(second)',
    'String.prototype.isWellFormed': 'text.isWellFormed()',
    'an iterator helper': 'Iterator.from(list)',
    'the v flag of a regular expression': 'const pattern = /[\\p{L}--[a-z]]/v;',
    'an import attribute': "import data from './data.json' with { type: 'json' };",
    'top level await in a file that is not a module': 'const a = 1;\nawait run();',
    'RegExp.escape': 'RegExp.escape(text)',
    'Promise.try': 'Promise.try(run)',
    'Error.isError': 'Error.isError(value)',
    'Math.sumPrecise': 'Math.sumPrecise(list)',
  };
  assert.deepEqual(Object.keys(samples), Object.keys(missingInNode18), 'a sample for every search');
  Object.keys(samples).forEach(name => assert.deepEqual(problemsIn(samples[name]), [name], name));

  const plain = "const sorted = list.slice().sort(); const found = list.find(item => item.id === 1); const text = value.replace(/a/g, 'b'); const ok = list.includes(1) && Object.entries(object).length > 0; const moment = new Date(); const first = list.at(0); const key = Object.hasOwn(object, 'id'); const copy = structuredClone(object); const all = text.replaceAll('a', 'b'); const flat = list.flatMap(item => item);";
  assert.deepEqual(problemsIn(plain), [], 'Node 18 has these');
});

test('the files that the two calendar scripts import need nothing that Node 18 lacks', () => {
  entries.forEach(entry => {
    const files = importGraph(entry);
    assert.ok(files.length > 40, entry + ' imports many files: ' + files.length);
    assert.ok(files.includes('dashboard/core/events.js') && files.includes('dashboard/core/calendar.js') && files.includes('dashboard/core/sanity.js') && files.includes('dashboard/config.js'), 'the graph of ' + entry + ' has the files it is known to import');
    assert.ok(files.every(file => file === entry || file.startsWith('dashboard/')), 'the scripts import only the dashboard');

    files.forEach(file => assert.deepEqual(problemsIn(fs.readFileSync(path.join(repo, file), 'utf8')), [], file + ' uses something that Node 18 does not have'));
  });
});

// A copy of the files the script imports, in the same folders, with or without dashboard/package.json
function copyOf(name, entry, withPackage, packageText) {
  const folder = path.join(work, name);
  importGraph(entry).forEach(file => {
    fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true });
    fs.copyFileSync(path.join(repo, file), path.join(folder, file));
  });
  if (withPackage) fs.writeFileSync(path.join(folder, 'dashboard/package.json'), packageText || fs.readFileSync(path.join(repo, 'dashboard/package.json'), 'utf8'));
  return folder;
}

// Runs the script in a copy. With noDetection Node does not guess that a .js file is a module, which is how
// Node 18 behaves and how Node 20.18 and 22.6 behave, so only a package.json can make the files modules.
function run(folder, entry, noDetection) {
  const flags = noDetection ? ['--no-experimental-detect-module'] : [];
  const result = spawnSync(process.execPath, flags.concat([path.join(folder, entry), 'address']), { encoding: 'utf8', cwd: folder });
  return { status: result.status, text: result.stdout, errors: result.stderr };
}

const canTurnDetectionOff = spawnSync(process.execPath, ['--no-experimental-detect-module', '-e', '0']).status === 0;

test('without dashboard/package.json a Node that does not guess cannot read the dashboard files, and with it the scripts run', () => {
  entries.forEach((entry, index) => {
    // A Node that has no flag for it does not guess either, unless it is new enough to, so a package.json that says
    // commonjs stands in for the missing one: it is the other way to make the files not modules
    const without = copyOf('without-' + index, entry, !canTurnDetectionOff, '{ "type": "commonjs" }\n');
    const refused = run(without, entry, true);
    assert.notEqual(refused.status, 0, entry + ' must stop when the dashboard files are not modules');
    assert.match(refused.errors, /SyntaxError|Cannot use import statement|Unexpected token 'export'|ERR_REQUIRE_ESM/, refused.errors);

    const withPackage = copyOf('with-' + index, entry, true);
    const asked = run(withPackage, entry, true);
    assert.equal(asked.status, 0, asked.errors);
    assert.match(asked.text.trim(), /^https:\/\/[a-z0-9]+\.api\.sanity\.io\/v[0-9-]+\/data\/query\/[A-Za-z0-9_-]+\?query=/, 'it prints the address that asks Sanity for the content');
    assert.match(asked.text, /perspective=published/);

    const usual = run(withPackage, entry, false);
    assert.equal(usual.status, 0, usual.errors);
    assert.equal(usual.text, asked.text, 'a Node that guesses reads the same files the same way');
  });
});

test('a package.json that says something else is what breaks it, so the file is what makes it work', () => {
  const entry = entries[0];
  const folder = copyOf('other', entry, true, '{ "type": "commonjs" }\n');
  const result = run(folder, entry, false);
  assert.notEqual(result.status, 0, 'the files are not modules when the package.json says they are not');
  assert.match(result.errors, /SyntaxError|Cannot use import statement|Unexpected token 'export'|ERR_REQUIRE_ESM/);
});

// A Node 18 is not here to run, so the built-ins it lacks are taken away from this one before the script starts: a script that
// uses one then stops with a TypeError or a ReferenceError, as it would on Node 18. Syntax cannot be taken away, so the files are
// also searched above for the newer syntax.
const withoutNewerBuiltins = [
  "const removeFrom = (owner, names) => names.forEach(name => { delete owner[name]; });",
  "removeFrom(Array.prototype, ['toSorted', 'toReversed', 'toSpliced', 'with', 'group', 'groupToMap']);",
  "removeFrom(Object, ['groupBy']);",
  "removeFrom(Map, ['groupBy']);",
  "removeFrom(Promise, ['withResolvers', 'try']);",
  "removeFrom(Array, ['fromAsync']);",
  "removeFrom(Set.prototype, ['union', 'intersection', 'difference', 'symmetricDifference', 'isSubsetOf', 'isSupersetOf', 'isDisjointFrom']);",
  "removeFrom(String.prototype, ['isWellFormed', 'toWellFormed']);",
  "removeFrom(URL, ['canParse']);",
  "removeFrom(RegExp, ['escape']);",
  "removeFrom(Error, ['isError']);",
  "removeFrom(Math, ['sumPrecise']);",
  "removeFrom(Intl, ['DurationFormat']);",
  "removeFrom(Intl.Locale.prototype, ['getWeekInfo', 'weekInfo']);",
  "removeFrom(globalThis, ['Iterator', 'navigator', 'Navigator', 'localStorage', 'sessionStorage', 'Storage', 'CustomEvent', 'File', 'WebSocket', 'EventSource', 'crypto', 'Float16Array']);",
].join('\n') + '\n';

function calendarText() {
  const day = date => date.toISOString().slice(0, 10).replace(/-/g, '');
  const stamp = date => day(date) + 'T' + date.toISOString().slice(11, 19).replace(/:/g, '') + 'Z';
  const noon = daysFromToday => {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysFromToday, 12));
  };
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Teletraan test//EN',
    'BEGIN:VEVENT', 'UID:daily', 'DTSTART:' + stamp(noon(1)), 'DTEND:' + stamp(new Date(noon(1).getTime() + 3600000)), 'RRULE:FREQ=DAILY;COUNT=12', 'SUMMARY:Daily check', 'LOCATION:Shop', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:weekly', 'DTSTART;TZID=America/New_York:' + day(noon(1)) + 'T180000', 'DTEND;TZID=America/New_York:' + day(noon(1)) + 'T193000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=8', 'SUMMARY:Pre-Season meeting', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:allday', 'DTSTART;VALUE=DATE:' + day(noon(3)), 'DTEND;VALUE=DATE:' + day(noon(5)), 'SUMMARY:Kickoff weekend', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';
}

test('both scripts list real events with the newer built-ins taken away, as Node 18 would have them', () => {
  const folder = path.join(work, 'older-node');
  fs.mkdirSync(path.join(folder, 'calendars'), { recursive: true });
  fs.writeFileSync(path.join(folder, 'older.mjs'), withoutNewerBuiltins);
  fs.writeFileSync(path.join(folder, 'calendars', 'team.ics'), calendarText());
  fs.writeFileSync(path.join(folder, 'sync.txt'), 'team|2026-10-09T15:00:02Z|\n');
  const rules = [{ name: 'Hide pre-season on Monday', action: 'hide', words: ['pre-season'], days: [1] }];
  fs.writeFileSync(path.join(folder, 'answer.json'), JSON.stringify({ result: { calendarFilters: rules, settings: { calendars: [{ id: 'team', name: 'Team', show: true, kind: 'meetings' }] } } }));

  const olderNode = (script, args) => spawnSync(process.execPath, ['--import', pathToFileURL(path.join(folder, 'older.mjs')).href, path.join(repo, script)].concat(args), { encoding: 'utf8', cwd: folder });

  const probe = spawnSync(process.execPath, ['--import', pathToFileURL(path.join(folder, 'older.mjs')).href, '-e', 'console.log([typeof [].toSorted, typeof Object.groupBy, typeof Promise.withResolvers, typeof localStorage, typeof new Set().union].join())'], { encoding: 'utf8' });
  assert.equal(probe.stdout.trim(), 'undefined,undefined,undefined,undefined,undefined', 'the built-ins are gone: ' + probe.stderr);

  const built = olderNode('deploy/scripts/calendar-status.mjs', ['build', path.join(folder, 'answer.json'), path.join(folder, 'sync.txt'), path.join(folder, 'calendars')]);
  assert.equal(built.status, 0, built.stderr);
  const [calendar] = JSON.parse(built.stdout).calendars;
  assert.ok(calendar.eventCount > 12 && calendar.occurrences.length === calendar.eventCount, 'the events are listed: ' + calendar.eventCount);
  assert.ok(calendar.occurrences.every(event => /^\d{4}-\d{2}-\d{2}$/.test(event.day)), 'each has its day');
  assert.ok(calendar.occurrences.some(event => event.shown === false && event.rule === 'Hide pre-season on Monday') && calendar.occurrences.some(event => event.shown === true), 'the rules are applied');
  assert.ok(calendar.occurrences.some(event => event.time === ''), 'an event that lasts all day has no time');

  const checked = olderNode('deploy/scripts/check-calendars.mjs', [path.join(folder, 'answer.json'), 'team', path.join(folder, 'calendars', 'team.ics'), path.join(folder, 'calendars')]);
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /SHOWN\s+team/);
  assert.match(checked.stdout, /HIDDEN\s+team/);
  assert.match(checked.stdout, /TOTAL\s+team\s+\d+ shown, \d+ hidden/);
});

test('calendar-status.sh uses Node from version 18 and says so, and nothing in the repository still asks for 20.19 or 22.7', () => {
  const script = fs.readFileSync(path.join(repo, 'deploy/scripts/calendar-status.sh'), 'utf8');
  assert.ok(script.includes('[ "$major" -ge 18 ]'), 'the check is for version 18 and newer');
  assert.ok(script.includes('It needs version 18 or newer'), 'and the note in the document says 18');
  assert.ok(script.includes('dashboard/package.json'), 'and the comment says why');
  assert.ok(!script.includes('minor'), 'the minor number is not used any more');

  const found = [];
  (function walk(folder) {
    fs.readdirSync(path.join(repo, folder), { withFileTypes: true }).forEach(entry => {
      if (entry.name.startsWith('.')) return;

      const relative = path.join(folder, entry.name);
      if (entry.isDirectory()) return walk(relative);
      if (/\.(md|sh|yml|txt|env)$/.test(entry.name) && /20\.19|22\.7\b/.test(fs.readFileSync(path.join(repo, relative), 'utf8'))) found.push(relative);
    });
  })('deploy');
  (function walk(folder) {
    fs.readdirSync(path.join(repo, folder), { withFileTypes: true }).forEach(entry => {
      const relative = path.join(folder, entry.name);
      if (entry.isDirectory()) return walk(relative);
      if (entry.name.endsWith('.md') && /20\.19|22\.7\b/.test(fs.readFileSync(path.join(repo, relative), 'utf8'))) found.push(relative);
    });
  })('docs');
  assert.deepEqual(found, [], 'a doc or a script on the Mini still names the old versions');
});

test('the web server shows the whole dashboard folder as it is, so one more file there is only one more file to show', () => {
  const compose = fs.readFileSync(path.join(repo, 'deploy/docker-compose.yml'), 'utf8');
  assert.ok(compose.includes('- ../dashboard:/srv/web/dashboard:ro'), 'the folder is mounted whole, read only');

  const nginx = fs.readFileSync(path.join(repo, 'deploy/nginx.conf'), 'utf8');
  assert.ok(/application\/json\s+json;/.test(nginx), 'a .json file has a type');
  assert.ok(!/try_files|rewrite|\ballow\b|\bdeny\b/.test(nginx), 'no rule limits the files to a list');
  assert.deepEqual(nginx.match(/^\s*location [^{]+\{/gm).map(line => line.trim()), ['location ~ /\\. {', 'location = / {', 'location ~ ^/dashboard/data/live/slides/[^/]+/manifest\\.json$ {']);
});

test('the Mini document says how to install Node as a numbered step, with the checks and the page', () => {
  const text = fs.readFileSync(path.join(repo, 'docs/rebuilding-the-mini.md'), 'utf8');
  const step = text.slice(text.indexOf('\n19. **'), text.indexOf('\n## Burn-in'));
  assert.ok(step.startsWith('\n19. **Install Node for the Calendars page.**'), 'step 19 is about Node');
  ['sudo apt install nodejs', 'node --version', 'v18', 'package.json', 'apt policy nodejs', 'sudo systemctl start teletraan-calendars.service', 'sudo journalctl -u teletraan-calendars.service -n 20', 'Calendars under Events', 'team mentor'].forEach(words => assert.ok(step.replace(/\s+/g, ' ').includes(words), 'step 19 should say: ' + words));
  assert.ok(!/\b(simply|just|basically|really|very|actually|easily)\b/i.test(step), 'step 19 has a filler word');
  assert.ok(!/[\u2014\u2013]/.test(step) && !/\p{Extended_Pictographic}/u.test(step) && !/[a-z)]!(\s|$)/.test(step), 'step 19 has a dash, an emoji or an exclamation mark');

  const flat = text.replace(/\s+/g, ' ');
  assert.ok(flat.includes('| `nodejs`, optional, version 18 or newer: `sudo apt install nodejs` |') && /Calendars page in Studio \| 19 \|/.test(flat), 'the table at the top lists Node for step 19');
  assert.ok(flat.includes('step 19 below'), 'step 11 points to step 19');
  assert.ok(!/\n20\. \*\*/.test(text), 'step 19 is the last step');
});

let failures = 0;
for (const entry of tests) {
  try {
    entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name);
    console.log(error);
  }
}

fs.rmSync(work, { recursive: true, force: true });
console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed' + (canTurnDetectionOff ? '' : ' (this Node has no flag for module detection, so a package.json that says commonjs stood in)'));
if (failures > 0) process.exitCode = 1;
