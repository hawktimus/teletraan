// Tests that docs/monday.md says what the rebuilt Monday reading does, in the numbers and ids
// that the script, the settings and the registry use, and that no other document still says the
// Mini reads every 10 minutes or from board rows. Nothing is drawn and nothing touches the network.
//
//   node tests/monday-docs.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { textOf } from './helpers/script-parts.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const doc = read('docs/monday.md');
const flat = doc.replace(/\s+/g, ' ');

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

test('the page has the sections it should, in plain words', () => {
  ['The one-board setup', 'What each column does on the screen', 'The Show on TV rule', 'Why status is the column and not the group', 'How often it reads', 'The daily read budget', 'The settings', 'What it writes', 'The preview', 'The eleven panels', 'If nothing shows up'].forEach(title => section(title));
  assert.ok(!/[—–!]/.test(doc), 'no em dash, en dash or exclamation mark');
  assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(doc), 'no emoji');
  doc.split('\n').forEach(line => assert.ok(!/\s+$/.test(line), 'no space at the end of a line: ' + line));
});

test('the one-board setup lists every column of the contract by id, and the ids of the milestones board', () => {
  ['color_mm82nvea', 'color_mkv6tatz', 'color_mm82jgxg', 'color_mm82wfy', 'color_mm83p12x', 'multiple_person_mm82cqbx', 'multiple_person_mm8331h1', 'timerange_mkyp8kx7', 'numeric_mm82pw1a', 'date_mm82kn5v', 'text_mm82s03v', 'board_relation_mm83phwy', 'subtasks_mkps8zm9', '18435126893', '18435272887', 'date_mm83y6zw', 'color_mm83be52', 'color_mm83f77w', 'color_mm83ndkf'].forEach(id => {
    assert.ok(section('The one-board setup').includes(id), 'the setup should name ' + id);
  });
  ['18435141525', '18435131682', '18435141092', '18415964745', '18415830886', '18415830249'].forEach(id => assert.ok(doc.includes(id), 'the page should say that ' + id + ' is never read'));
});

test('the page says the index tables and the numbers that the settings start with', async () => {
  const { defaultSettings } = await import(pathToFileURL(path.join(repo, 'dashboard/config.js')).href);
  const task = defaultSettings.mondayTaskBoard;
  assert.ok(/Electrical 0, Build 1, Programming 2, Design 3, CNC 4, Unassigned 5/.test(doc));
  assert.ok(/In Progress 0, Done 1, Stuck 2, In Review 3, To Do 5/.test(doc));
  assert.ok(/Prime 109, Nova 8, Both Teams 5/.test(doc));
  assert.ok(/Not\s+Started 5, On Track 1, At Risk 2, Done 3/.test(flat));
  assert.equal(task.statusIndexes.inReview, 3);
  assert.ok(/High 2, Medium 0, Low 1/.test(doc) && /To Do 5, In Progress 0, In Review 3, Stuck 2, Done 1/.test(doc));
  assert.ok(section('The settings').includes('Hide label text') && section('The settings').includes('Never shown'));
});

test('the numbers of the read interval and the daily budget are the ones in the script and the settings', () => {
  const script = textOf(path.join(repo, 'mini/scripts/monday-sync.sh'));
  const how = section('How often it reads');
  const budget = section('The daily read budget');
  assert.ok(how.includes('mondayEveryMinutes') && /5 to 120/.test(how) && /every 5 minutes/.test(how) && how.includes('starting at 30'));
  assert.ok(script.includes('daily_limit=900') && budget.includes('900') && budget.includes('callsToday') && budget.includes('callsDate'));
  assert.ok(budget.includes('Daily read limit reached; reads resume at midnight.') && script.includes('Daily read limit reached; reads resume at midnight.'));
  assert.ok(script.includes('max_requests=4') && /at most 4/.test(budget));
  assert.ok(/about 1,000/.test(how) && /about 150/.test(how));
  assert.ok(doc.includes('install-monday.sh') && /again/.test(section('Setting it up')), 'the page should say to run install-monday.sh again');
});

test('the Show on TV rule has the sentence for students, both switches, and the cases of the acceptance list', () => {
  const rule = section('The Show on TV rule');
  assert.ok(/your task shows on the TV when it has a department, a team or General, Show on TV is Show, and it is not a subitem\./i.test(flat));
  assert.ok(rule.includes('showOnBoard') && rule.includes('showOnTv') && rule.includes('hiddenUnassigned') && rule.includes('General') && rule.includes('Hide'));
  const why = section('Why status is the column and not the group');
  assert.ok(/stays in Done/.test(why) && /Date\s+Completed/.test(why.replace(/\s+/g, ' ')) && /reads\s+To Do/.test(why.replace(/\s+/g, ' ')));
});

test('the table of the eleven panels has every registry id, the picker rows, and the older ids that stay', () => {
  const table = section('The eleven panels');
  ['monday-tasks', 'monday-done', 'monday-status-depts', 'monday-overall', 'monday-timeline', 'monday-board'].forEach(id => assert.ok(table.includes('`' + id + '`'), 'the table should list ' + id));
  for (let number = 1; number <= 11; number += 1) {
    const label = 'MQ' + String(number).padStart(2, '0');
    assert.ok(table.includes(label) || (number <= 4 && table.includes('MQ01 to MQ04')) || ([6, 11].includes(number) && table.includes('MQ0' + (number - 1) + ' and ' + label)) || (number === 11 && table.includes('MQ10 and MQ11')), 'the table should cover ' + label);
  }
  ['monday-team', 'monday-milestones', 'monday-progress'].forEach(id => assert.ok(table.includes('`' + id + '`')));
  assert.ok(/team and department/.test(table) && /first department/.test(table));
});

test('the preview is described the way the order has it: the address, the Preview button, the 960 by 540 frame and the tab', () => {
  const preview = section('The preview');
  ['?panel=', 'team=', 'dept=', 'screen=', 'still=1', 'Preview button', '960 by 540', 'Preview the panels', 'Monday Boards', 'published'].forEach(word => assert.ok(preview.includes(word), 'the preview section should mention ' + word));
});

test('the fields that the page says a task and a milestone have are the fields of the schemas', () => {
  const written = section('What it writes');
  const task = read('studio/schemas/task.js');
  ['title', 'team', 'subteam', 'status', 'priority', 'showOnBoard', 'contact', 'owners', 'startDate', 'dueDate', 'estHours', 'completedOn', 'milestoneIds', 'hiddenReason', 'mondayBoardId', 'mondayBoardName'].forEach(name => {
    assert.ok(written.includes('`' + name + '`'), 'the page should name the task field ' + name);
    assert.ok(name === 'team' || task.includes("name: '" + name + "'"), 'the task should have the field ' + name);
  });
  const milestone = read('studio/schemas/milestone.js');
  ['name', 'targetDate', 'team', 'subteam', 'status', 'show'].forEach(name => assert.ok(written.includes('`' + name + '`') && /name: '(name|targetDate|status|show)'|teamField|name: 'subteam'/.test(milestone), 'the page should name the milestone field ' + name));
  ['taskCount', 'hiddenUnassigned', 'callsToday', 'callsDate'].forEach(name => assert.ok(written.includes('`' + name + '`') && read('studio/schemas/mondayStatus.js').includes("'" + name + "'"), 'monday-status should have ' + name));
  assert.ok(/N tasks, M hidden \(no department\)/.test(written) && /Reads every N minutes/.test(written));
});

test('no other document still says the Mini reads every 10 minutes from board rows', () => {
  ['docs/coaches-guide.md', 'docs/editing-content.md', 'README.md', 'mini/README.md'].forEach(file => {
    const text = read(file);
    text.split('\n').forEach(line => {
      if (/monday/i.test(line)) assert.ok(!/every 10 minutes/i.test(line), file + ' still says every 10 minutes: ' + line);
    });
    assert.ok(!/Under Boards click Add item/.test(text), file + ' still tells people to add a board row');
  });
  assert.ok(read('docs/coaches-guide.md').includes('docs/monday.md'));
  assert.ok(!read('mini/systemd/teletraan-monday.timer').includes('10min'));
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
