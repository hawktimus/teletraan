// Tests that docs/monday.md says what the Monday sync and the two Monday panels do, in the numbers and ids that the
// script, the settings and the registry use, and that no other document still sends people to the pages and the settings
// that are gone. Nothing is drawn and nothing touches the network.
//
//   node tests/monday-docs.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { textOf } from './helpers/script-parts.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const doc = read('docs/monday.md');
const flat = doc.replace(/\s+/g, ' ');
const script = textOf(path.join(repo, 'computer/scripts/monday-sync.sh'));

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

function section(title) {
  const start = doc.indexOf('\n## ' + title + '\n');
  assert.ok(start !== -1, 'docs/monday.md should have the section ' + title);
  const next = doc.indexOf('\n## ', start + 5);
  return doc.slice(start, next === -1 ? doc.length : next);
}

test('the page has the sections it should, in plain words, and is short', () => {
  ['The two boards', 'How a task gets onto the TV', 'What the computer reads from each task', 'The two panels', 'Which view plays which tasks', 'Putting a department on the TV', 'The Monday page', 'How often it reads', 'What it writes', 'If nothing shows up', 'Setting it up'].forEach(title => section(title));
  assert.ok(!/[—–!]/.test(doc), 'no em dash, en dash or exclamation mark');
  assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(doc), 'no emoji');
  doc.split('\n').forEach(line => assert.ok(!/\s+$/.test(line), 'no space at the end of a line: ' + line));
  assert.ok(doc.split('\n').length < 170, 'the page is short');
});

test('the boards, the columns and the label numbers are the ones of the contract', () => {
  ['18435126893', '18435131682'].forEach(id => assert.ok(section('The two boards').includes(id) && script.includes(id), id));
  ['color_mkv6tatz', 'color_mm82nvea', 'color_mm82jgxg', 'multiple_person_mm82cqbx', 'color_mm82wfy', 'timerange_mkyp8kx7', 'date_mm82kn5v', 'numeric_mm82pw1a', 'color_mm83p12x'].forEach(id => {
    assert.ok(doc.includes('`' + id + '`') && script.includes(id), id);
  });
  assert.ok(/To Do 5, In Progress 0, Done 1, Stuck 2, In Review 3/.test(doc));
  assert.ok(/Prime 1, Nova 0, General 5/.test(doc) && /High 2, Medium 0, Low 1/.test(doc));
  assert.ok(!/18435272887/.test(doc + script), 'the milestones board is not read');
});

test('the rules of a task are the ones of the sync: the group, the Done list, Hide, the first person and the empty words', () => {
  const rules = section('How a task gets onto the TV');
  assert.ok(/parent item/.test(rules) && /Hide/.test(rules) && /group/.test(rules) && /Department column/.test(rules));
  assert.ok(/Done, when its Status is Done, when it sits in the Done group, or when it is on Completed Tasks/.test(flat));
  assert.ok(/first name of the first person, else Unassigned/.test(flat) && /No Priority/.test(doc) && /No Date/.test(doc));
});

test('the panels, the rows and the retired ids are the ones of the registry and the rotation', () => {
  const panels = section('The two panels');
  ['monday-department', 'monday-charts'].forEach(id => assert.ok(panels.includes('`' + id + '`') && read('dashboard/registry.js').includes("id: '" + id + "'"), id));
  assert.ok(panels.includes('| Status | Project | Contact | Priority | Estimated Completion Date |'));
  const rows = section('Putting a department on the TV');
  assert.ok(/Department: one of the nine/.test(rows) && /List: Open or Done/.test(rows) && /Team: Both, Prime or Nova/.test(rows));
  assert.ok(rows.includes('Retired, use Department tasks') && read('dashboard/config-lists.js').includes("'Retired, use Department tasks.'"));
});

test('the read interval, the budget, the force file and the debug are the ones of the script', () => {
  const how = section('How often it reads').replace(/\s+/g, ' ');
  assert.ok(how.includes('mondayEveryMinutes') && /5 to 120/.test(how) && /every 5 minutes/.test(how) && how.includes('starting at 30'));
  assert.ok(script.includes('daily_limit=900') && how.includes('900'));
  assert.ok(how.includes('Daily read limit reached. Reads start again at midnight.') && script.includes('Daily read limit reached. Reads start again at midnight.'));
  assert.ok(how.includes('Sync Monday now') && script.includes('/tmp/teletraan-monday-force'));
  assert.ok(section('If nothing shows up').includes('Monday debug') && doc.includes('--debug') && doc.includes('--check'));
  assert.ok(doc.includes('install-monday.sh') && /again/.test(section('Setting it up')));
});

test('what it writes names the fields of the schemas', () => {
  const written = section('What it writes');
  ['lastSyncAt', 'lastError', 'callsToday', 'readings', 'departments'].forEach(name => assert.ok(written.includes('`' + name + '`') && read('studio/schemas/mondayStatus.js').includes("'" + name + "'"), name));
  assert.ok(written.includes('task-monday-') && /deleted/.test(written));
});

test('no other document still sends people to the Monday pages and settings that are gone', () => {
  ['docs/coaches-guide.md', 'docs/editing-content.md', 'docs/students.md', 'docs/studio-map.md', 'README.md', 'computer/README.md', 'docs/monday-one-pager.md'].forEach(file => {
    const text = read(file);
    ['Monday Boards', 'Items tab', 'Choose boards', 'milestones board', 'The eleven panels'].forEach(words => assert.ok(!text.includes(words), file + ' still says ' + words));
  });
  assert.ok(read('docs/coaches-guide.md').includes('docs/monday.md'));
  assert.ok(!read('computer/systemd/teletraan-monday.timer').includes('10min'));
});

let failures = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name);
    console.log(error);
  }
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
