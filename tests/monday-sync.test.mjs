// Tests for computer/scripts/monday-sync.sh (the two boards Robotics Tasks and Completed Tasks)
// and computer/scripts/install-monday.sh. The tools they use
// on the Teletraan computer (curl, date, flock, id, systemctl) are replaced with small fake ones in a
// temporary folder, so nothing touches the network or the machine. jq is the real one,
// because the scripts depend on what it does, so this test needs jq installed. The
// answers of Monday and Sanity are made up here, in the shape of the typed fragments the
// script asks for. The boards, the items, the names, the token and the key are made up too.
//
//   node tests/monday-sync.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { textOf, copyWithEdits } from './helpers/script-parts.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const syncFile = path.join(repo, 'computer/scripts/monday-sync.sh');
const installFile = path.join(repo, 'computer/scripts/install-monday.sh');
const unitFiles = ['teletraan-monday.service', 'teletraan-monday.timer'];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-monday-'));

// The tools the scripts need that are not the ones being faked
const ordinaryTools = ['sed', 'tail', 'head', 'grep', 'mktemp', 'mv', 'rm', 'mkdir', 'dirname', 'basename', 'cat', 'cp', 'cmp', 'tr', 'stat', 'sleep', 'wc', 'find'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

// A fake curl. It writes each call it gets to calls.log, but never what comes in
// on standard input: that is a token, and it goes to configs.txt in the stub
// folder, which the tests look at. Sanity answers a question from sanity.json and
// keeps what is written in mutations/<number>.json. Monday answers from
// monday/<name>.json, where the name comes from the question: boards, me,
// items-<board> for the first page of a board and more-<cursor> for the next
// ones. A .code file gives another status, and an .exit file makes curl fail
// with that exit code. The line "monday <name>" after the call says which answer
// was asked for.
const fakeCurl = `#!/bin/sh
printf '%s\\n' "$(printf 'curl %s' "$*" | tr '\\n' ' ')" >> "$STUB_LOG"
output=""
body=""
write_out=""
address=""
previous=""
for argument in "$@"; do
  case $previous in
    --output) output=$argument ;;
    --data-binary) body=\${argument#@} ;;
    --write-out) write_out=$argument ;;
  esac
  case $argument in
    https://*) address=$argument ;;
  esac
  previous=$argument
done
case " $* " in
  *" --config - "*)
    cat >> "$STUB_DIR/configs.txt"
    echo "--" >> "$STUB_DIR/configs.txt"
    ;;
esac

case $address in
  https://*.api.sanity.io/*/data/query/*)
    [ -f "$STUB_DIR/sanity.exit" ] && exit "$(cat "$STUB_DIR/sanity.exit")"
    cp "$STUB_DIR/sanity.json" "$output"
    exit 0
    ;;
  https://*.api.sanity.io/*/data/mutate/*)
    count=$(cat "$STUB_DIR/mutations.count" 2> /dev/null || echo 0)
    count=$((count + 1))
    echo "$count" > "$STUB_DIR/mutations.count"
    mkdir -p "$STUB_DIR/mutations"
    cp "$body" "$STUB_DIR/mutations/$count.json"
    echo "$address" >> "$STUB_DIR/addresses.txt"
    [ -f "$STUB_DIR/mutate.exit" ] && exit "$(cat "$STUB_DIR/mutate.exit")"
    if [ -f "$STUB_DIR/mutate.fail-at" ] && [ "$count" = "$(cat "$STUB_DIR/mutate.fail-at")" ]; then exit 22; fi
    exit 0
    ;;
  https://api.monday.com/v2)
    query=$(jq -r '.query' "$body")
    case $query in
      'query { me { name } }') name=me ;;
      'query ($ids'*) name=users ;;
      'query ($board'*) name="items-$(jq -r '.variables.board[0]' "$body")" ;;
      'query ($cursor'*) name="more-$(jq -r '.variables.cursor' "$body")" ;;
      *) name=unknown ;;
    esac
    echo "monday $name" >> "$STUB_LOG"
    jq -c '.variables // {}' "$body" >> "$STUB_DIR/variables.txt"
    printf '%s %s\\n' "$name" "$(printf '%s' "$query" | grep -c BatteryValue)" >> "$STUB_DIR/shapes.txt"
    base="$STUB_DIR/monday/$name"
    [ -f "$base.exit" ] && exit "$(cat "$base.exit")"
    code=200
    [ -f "$base.code" ] && code=$(cat "$base.code")
    if [ -f "$base.json" ]; then cp "$base.json" "$output"; else echo '{"errors":[{"message":"stub has no answer"}]}' > "$output"; fi
    [ -n "$write_out" ] && printf '%s' "$code"
    exit 0
    ;;
  *) exit 6 ;;
esac
`;

// A fake date. The script asks for two things, and each is answered from the
// clock the test has set. The time zone the script asks in is written to the log.
const fakeDate = `#!/bin/sh
echo "date TZ=\${TZ:-none} $*" >> "$STUB_LOG"
for argument in "$@"; do
  format=$argument
done
case $format in
  +%Y-%m-%d) echo "$STUB_TODAY" ;;
  +%Y-%m-%dT%H:%M:%SZ) echo "$STUB_UTC" ;;
  *) exit 1 ;;
esac
`;

// status-write.sh is tested in status-write.test.mjs. Here it only has to say it
// was called.
const fakeStatusWrite = `#!/bin/sh
echo "status-write.sh $*" >> "$STUB_LOG"
exit 0
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

const mondayToken = 'eyJTESTmondaytoken0123456789abcdef.sig-_';
const writeToken = 'skTESTtoken0123456789abcdef';
const secret = 'https://band.example/SECRET-FEED-TOKEN';

// Makes a copy of the computer folder and config.js to run in, a folder of tools
// to run with, and returns how to run the scripts.
function setup(name, options) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  const temp = path.join(root, 'tmp');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'computer/systemd'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  [bin, stub, temp, path.join(stub, 'monday')].forEach(folder => fs.mkdirSync(folder));
  if (!options.noData) fs.mkdirSync(data);

  const scriptCopy = path.join(root, 'computer/scripts/monday-sync.sh');
  copyWithEdits(syncFile, path.join(root, 'computer/scripts'), options.edits);
  const installCopy = path.join(root, 'computer/scripts/install-monday.sh');
  fs.copyFileSync(installFile, installCopy);
  fs.chmodSync(installCopy, fs.statSync(installFile).mode);
  writeTool(path.join(root, 'computer/scripts'), 'status-write.sh', fakeStatusWrite);
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  unitFiles.forEach(unit => fs.copyFileSync(path.join(repo, 'computer/systemd', unit), path.join(root, 'computer/systemd', unit)));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));

  if (!options.noEnv) {
    const env = options.env !== undefined ? options.env : "TELETRAAN_DATA='" + data + "'\nMONDAY_API_TOKEN='" + mondayToken + "'\nSANITY_WRITE_TOKEN='" + writeToken + "'\nCALENDAR_TEAM_URL='" + secret + "'\n";
    fs.writeFileSync(path.join(root, 'computer/local.env'), env.replace('<data>', data));
  }

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));

  if (options.tools) {
    fs.symlinkSync(findTool('jq'), path.join(bin, 'jq'));
    writeTool(bin, 'curl', fakeCurl);
    writeTool(bin, 'date', fakeDate);
    writeTool(bin, 'flock', '#!/bin/sh\necho "flock $*" >> "$STUB_LOG"\n[ "$STUB_LOCKED" != yes ]\n');
  }
  if (options.install) {
    writeTool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && echo "$STUB_UID"\nexit 0\n');
    writeTool(bin, 'systemctl', '#!/bin/sh\necho "systemctl $*" >> "$STUB_LOG"\n');
    writeTool(bin, 'apt', '#!/bin/sh\necho "apt $*" >> "$STUB_LOG"\n');
    writeTool(bin, 'apt-get', '#!/bin/sh\necho "apt-get $*" >> "$STUB_LOG"\n');
  }

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  const folder = path.join(data, 'monday');

  const place = {
    root: root,
    data: data,
    folder: folder,
    temp: temp,
    log: log,
    stub: stub,
    clock: {},
    // The time the fake date tells: a moment in UTC, and the date it is in the
    // time zone of the screen
    at(utc, today) {
      this.clock = { STUB_UTC: utc, STUB_TODAY: today || utc.slice(0, 10) };
    },
    run(args, extra, shell) {
      fs.writeFileSync(log, '');
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, TMPDIR: temp, STUB_UID: '1000' }, this.clock, extra || {});
      const result = spawnSync(shell || '/bin/sh', [scriptCopy].concat(args || []), { env: env, encoding: 'utf8', input: '', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    install(extra) {
      fs.writeFileSync(log, '');
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, TMPDIR: temp, STUB_UID: '1000' }, extra || {});
      const result = spawnSync('/bin/sh', [installCopy], { env: env, encoding: 'utf8', input: '\n', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    // What Sanity answers to the one question the script asks
    sanity(answer) {
      fs.writeFileSync(path.join(stub, 'sanity.json'), JSON.stringify({ ms: 1, query: 'stub', result: answer }));
    },
    // The answer of Monday to one question. options.code is another status and
    // options.exit a curl failure.
    answer(name, body, options) {
      const base = path.join(stub, 'monday', name);
      const given = options || {};
      ['.json', '.code', '.exit'].forEach(ending => fs.rmSync(base + ending, { force: true }));
      if (body !== undefined) fs.writeFileSync(base + '.json', JSON.stringify(body));
      if (given.code) fs.writeFileSync(base + '.code', String(given.code));
      if (given.exit) fs.writeFileSync(base + '.exit', String(given.exit));
    },
    // The items of one board as the pages Monday would give, size items to a page
    pages(board, items, size, name, extra) {
      const count = Math.max(1, Math.ceil(items.length / size));
      for (let index = 0; index < count; index += 1) {
        const cursor = index + 1 < count ? 'cursor' + board + 'n' + (index + 1) : null;
        const page = { cursor: cursor, items: items.slice(index * size, (index + 1) * size) };
        if (index === 0) this.answer('items-' + board, { data: { boards: [Object.assign({ name: name || 'Board', items_page: page }, extra || {})] } });
        else this.answer('more-cursor' + board + 'n' + index, { data: { next_items_page: page } });
      }
    },
    writes() {
      const folderOfWrites = path.join(stub, 'mutations');
      if (!fs.existsSync(folderOfWrites)) return [];
      return fs.readdirSync(folderOfWrites).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map(file => JSON.parse(fs.readFileSync(path.join(folderOfWrites, file), 'utf8')));
    },
    // Every mutation but the ones of the last write, which is monday-status
    taskMutations() {
      const all = this.writes();
      return all.slice(0, -1).reduce((list, body) => list.concat(body.mutations), []);
    },
    // The document monday-status that the last write made
    document() {
      const all = this.writes();
      return all[all.length - 1].mutations[0].createOrReplace;
    },
    configs() {
      const file = path.join(stub, 'configs.txt');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    },
    // Which questions asked for the multi-level shape (BatteryValue), as 'name' lines
    battery() {
      const file = path.join(stub, 'shapes.txt');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(line => !line.endsWith(' 0')).map(line => line.split(' ')[0]) : [];
    },
    variables() {
      const file = path.join(stub, 'variables.txt');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
    },
  };
  return place;
}

// The API version of the contract block, so a test does not repeat the number
function versionOf(file) {
  return (textOf(file).match(/\nmonday_version='([0-9-]+)'\n/) || [])[1];
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// Every request the fake curl got, as 'sanity-query', 'sanity-write', 'monday <name>' or 'status-write <job>'
function requestsOf(calls) {
  const list = [];
  calls.split('\n').forEach(line => {
    if (line.startsWith('monday ')) return list.push(line);
    if (line.startsWith('status-write.sh ')) return list.push('status-write ' + line.slice('status-write.sh '.length));
    if (!line.startsWith('curl ')) return;
    const address = (line.match(/(https:\/\/\S+)$/) || [])[1] || '';
    if (address.includes('/data/query/')) list.push('sanity-query');
    else if (address.includes('/data/mutate/')) list.push('sanity-write');
    else if (!address.includes('api.monday.com')) list.push('other ' + address);
  });
  return list;
}

function filesUnder(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).reduce((files, entry) => {
    const full = path.join(folder, entry.name);
    return entry.isDirectory() ? files.concat(filesUnder(full)) : files.concat(full);
  }, []);
}



// The made-up world: the two boards of docs/monday.md, with their real numbers, column ids and label
// numbers, and made-up items in the multi-level shape (a status is a BatteryValue, a person is an id).
const taskBoardId = '18435126893';
const doneBoardId = '18435131682';
const todayText = '2027-01-12';
const nowText = '2027-01-12T15:00:00Z';

function value(id, type, text, extra) {
  return Object.assign({ id: id, type: type, text: text }, extra || {});
}
// A status column of a multi-level board: the number of the label as the key, with one item under it
function battery(id, index) {
  return value(id, 'status', '', { battery_value: index === null ? [] : [{ key: String(index), count: 1 }] });
}
function item(id, name, values, group, parent) {
  return { id: id, name: name, parent_item: parent ? { id: parent } : null, group: group ? { id: 'group_' + group.toLowerCase(), title: group } : null, column_values: values };
}

const col = {
  department: index => battery('color_mm82nvea', index),
  state: index => battery('color_mkv6tatz', index),
  team: index => battery('color_mm82jgxg', index),
  priority: index => battery('color_mm82wfy', index),
  show: index => battery('color_mm83p12x', index),
  assigned: (ids, text) => value('multiple_person_mm82cqbx', 'people', text || '', { persons_and_teams: ids.map(id => ({ id: id, kind: 'person' })) }),
  timeline: (from, to) => value('timerange_mkyp8kx7', 'timeline', from + ' - ' + to, { from: from, to: to }),
  hours: text => value('numeric_mm82pw1a', 'numbers', text),
  completed: day => value('date_mm82kn5v', 'date', day, { date: day }),
};

// Robotics Tasks: one item for each rule of docs/monday.md
function taskItems() {
  return [
    // the group is the department, whatever the Department column says
    item('1001', 'Wire the robot', [col.department(0), col.state(0), col.team(1), col.priority(2), col.show(5), col.assigned([71, 72]), col.timeline('2026-10-01', '2026-10-20'), col.hours('12.5')], 'Build'),
    // the Done group puts a task in the done list, and the Department column gives its department
    item('1002', 'Pick up parts', [col.department(1), col.state(5), col.team(0), col.priority(1), col.show(5), col.completed('2026-10-10')], 'Done'),
    // Status Done is done in any group
    item('1003', 'Mount the camera', [col.state(1), col.team(5), col.completed('2027-01-05')], 'Electrical'),
    // Stuck, In Review, no priority, nobody assigned
    item('1004', 'Waiting on a part', [col.state(2), col.priority(5), col.show(5)], 'Programming'),
    item('1005', 'Check the bumpers', [col.state(3), col.team(1), col.assigned([73])], 'Design'),
    // Hide keeps it off the TV
    item('1006', 'Hidden from the TV', [col.state(0), col.show(2)], 'CNC'),
    // a group that is not a department and no Department column: left out
    item('1007', 'Nobody owns this', [col.department(5), col.state(5)], 'Ideas'),
    // a subitem is never a task
    item('1008', 'A step of the wiring', [col.state(0)], 'Build', '1001'),
    // nothing set but the group
    item('1009', 'Nothing set', [], 'Marketing'),
  ];
}

// Completed Tasks: every item is done, and its group is its department
function doneItems() {
  return [
    item('2001', 'Old gearbox', [col.state(5), col.team(1), col.assigned([71]), col.hours('6')], 'Build'),
    item('2002', 'Old dashboard', [col.state(1)], 'Strategy'),
  ];
}

const leads = [{ _id: 'subteam-build', name: ' Build ' }, { _id: 'subteam-design', name: 'Design' }];

function world(place, options) {
  const given = options || {};
  place.at(nowText, todayText);
  place.sanity({
    zone: given.zone || 'America/New_York',
    every: given.every === undefined ? null : given.every,
    teams: [{ _id: 'team-prime', code: 'prime' }, { _id: 'team-nova', code: 'nova' }],
    subteams: leads,
    tasks: given.tasks || [],
    known: given.known === undefined ? null : given.known,
    snapshots: given.snapshots === undefined ? null : given.snapshots,
    readings: null,
  });
  place.answer('me', { data: { me: { name: 'Jordan Example' } } });
  place.answer('users', { data: { users: [{ id: '71', name: 'Pat Kim' }, { id: 72, name: 'Jo Ray' }, { id: '73', name: 'sam@example.com' }] } });
  place.pages(taskBoardId, given.items || taskItems(), given.size || 200, 'Robotics Tasks');
  place.pages(doneBoardId, given.doneItems || doneItems(), 200, 'Completed Tasks');
}

const sequence = ['sanity-query', 'monday items-' + taskBoardId, 'monday items-' + doneBoardId, 'monday users', 'sanity-write', 'sanity-write', 'status-write monday'];

// The documents the run made, patched or deleted, by id
function documentsOf(place) {
  const found = {};
  place.taskMutations().forEach(mutation => {
    if (mutation.createIfNotExists) found[mutation.createIfNotExists._id] = Object.assign(found[mutation.createIfNotExists._id] || {}, { created: mutation.createIfNotExists });
    if (mutation.delete) found[mutation.delete.id] = { deleted: true };
    if (mutation.patch) {
      const entry = found[mutation.patch.id] || {};
      entry.set = Object.assign(entry.set || {}, mutation.patch.set);
      entry.unset = (entry.unset || []).concat(mutation.patch.unset || []);
      found[mutation.patch.id] = entry;
    }
  });
  return found;
}

function statusOf(place) {
  const all = place.writes();
  const last = all[all.length - 1].mutations;
  assert.equal(last[0].createIfNotExists._id, 'monday-status');
  return last[1].patch;
}

function refOf(reference) {
  return reference ? reference._ref : undefined;
}

test('a read asks Sanity, the two boards and the names of the people, writes the tasks, then the status, then tells status-mini', () => {
  const place = setup('sequence', { tools: true });
  world(place);
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.equal(result.errors, '');
  assert.deepEqual(requestsOf(result.calls), sequence);
  assert.ok(result.text.includes('monday: 9 task(s) read'), result.text);
  assert.ok(result.text.includes('monday: 9 task(s), 9 new, 0 changed, 0 deleted'), result.text);
  assert.deepEqual(fs.readdirSync(place.folder).sort(), ['.lock']);
});

test('the boards are read by their numbers only, with the multi-level question, and no board list is asked for', () => {
  const place = setup('questions', { tools: true });
  world(place);
  place.run();
  const variables = place.variables();
  assert.deepEqual(variables[0].board, [taskBoardId]);
  assert.deepEqual(variables[0].columns, ['color_mm82nvea', 'color_mkv6tatz', 'color_mm82jgxg', 'multiple_person_mm82cqbx', 'color_mm82wfy', 'timerange_mkyp8kx7', 'numeric_mm82pw1a', 'date_mm82kn5v', 'color_mm83p12x']);
  assert.deepEqual(variables[1].board, [doneBoardId]);
  assert.deepEqual(variables[1].columns, ['color_mkv6tatz', 'color_mm82jgxg', 'multiple_person_mm82cqbx', 'color_mm82wfy', 'timerange_mkyp8kx7', 'numeric_mm82pw1a'], 'Completed Tasks has fewer columns');
  assert.deepEqual(variables[2].ids.sort(), ['71', '73'], 'the first person of each item, once');
  assert.deepEqual(place.battery(), ['items-' + taskBoardId, 'items-' + doneBoardId], 'both boards ask for BatteryValue');

  const text = textOf(syncFile);
  assert.ok(text.includes('capabilities: [CALCULATED]'));
  assert.ok(!/boards\(limit/.test(text), 'the list of every board is not asked for');
  assert.ok(!/18435272887/.test(text), 'the milestones board is not read');
  assert.equal(text.split("task_board='18435126893'").length, 2, 'the board numbers are written once');
  assert.equal(text.split("done_board='18435131682'").length, 2);
});

test('department: the group when it is a department, else the Department column, else the task is left out', () => {
  const place = setup('department', { tools: true });
  world(place);
  place.run();
  const docs = documentsOf(place);
  assert.equal(docs['task-monday-1001'].set.department, 'build', 'the group wins over the column (Electrical)');
  assert.equal(docs['task-monday-1002'].set.department, 'build', 'the Done group takes the column');
  assert.equal(docs['task-monday-1009'].set.department, 'marketing');
  assert.equal(docs['task-monday-2002'].set.department, 'strategy', 'Completed Tasks takes the group');
  assert.equal(docs['task-monday-1007'], undefined, 'no department, no task');
  assert.equal(docs['task-monday-1008'], undefined, 'a subitem is not a task');
  assert.equal(refOf(docs['task-monday-1001'].set.subteam), 'subteam-build', 'the Team lead with the name of the department');
  assert.equal(docs['task-monday-1004'].set.subteam, undefined, 'no Team lead named Programming');
});

test('list: done for status Done, the Done group and Completed Tasks; open for the rest', () => {
  const place = setup('list', { tools: true });
  world(place);
  place.run();
  const docs = documentsOf(place);
  const list = id => docs['task-monday-' + id].set.list;
  assert.equal(list('1001'), 'open');
  assert.equal(list('1002'), 'done', 'the Done group, though the status is To Do');
  assert.equal(list('1003'), 'done', 'status Done');
  assert.equal(list('1004'), 'open');
  assert.equal(list('2001'), 'done', 'Completed Tasks, though the status is To Do');
  assert.equal(list('2002'), 'done');
});

test('status, team, priority, contact, dates, hours and Show on TV come from the label numbers and the columns', () => {
  const place = setup('fields', { tools: true });
  world(place);
  place.run();
  const docs = documentsOf(place);
  const first = docs['task-monday-1001'];
  assert.deepEqual(first.created, { _id: 'task-monday-1001', _type: 'task', source: 'monday', mondayId: '1001' });
  assert.equal(first.set.title, 'Wire the robot');
  assert.equal(first.set.status, 'in-progress');
  assert.equal(refOf(first.set.team), 'team-prime');
  assert.equal(first.set.priority, 'high');
  assert.equal(first.set.contact, 'Pat', 'the first word of the first person in Assigned');
  assert.equal(first.set.startDate, '2026-10-01');
  assert.equal(first.set.dueDate, '2026-10-20', 'the end of the Timeline is the estimated completion date');
  assert.equal(first.set.estHours, 12.5);
  assert.equal(first.set.showOnBoard, true);
  assert.equal(first.set.show, true);
  assert.equal(first.set.mondayBoardId, taskBoardId);
  assert.equal(first.set.mondayBoardName, 'Robotics Tasks');

  assert.equal(refOf(docs['task-monday-1002'].set.team), 'team-nova');
  assert.equal(docs['task-monday-1002'].set.priority, 'low');
  assert.equal(docs['task-monday-1002'].set.completedOn, '2026-10-10');
  assert.equal(docs['task-monday-1003'].set.team, undefined, 'General is both teams');
  assert.equal(docs['task-monday-1004'].set.status, 'blocked', 'Stuck');
  assert.equal(docs['task-monday-1005'].set.status, 'in-review');
  assert.equal(docs['task-monday-1004'].set.priority, undefined, 'label 5 is no priority');
  assert.equal(docs['task-monday-1006'].set.showOnBoard, false, 'Hide keeps it off the TV');
  assert.equal(docs['task-monday-1009'].set.status, 'up-next', 'no status is To Do');
  assert.equal(docs['task-monday-1009'].set.showOnBoard, true, 'no Show on TV is Show');
});

test('empty values are left out: no contact, no priority, no dates, no hours; an email is never a contact', () => {
  const place = setup('empty', { tools: true });
  world(place);
  place.run();
  const docs = documentsOf(place);
  const bare = docs['task-monday-1009'];
  ['contact', 'priority', 'startDate', 'dueDate', 'completedOn', 'estHours', 'team', 'subteam'].forEach(name => assert.equal(bare.set[name], undefined, name));
  assert.ok(bare.unset.includes('contact') && bare.unset.includes('dueDate'));
  assert.equal(docs['task-monday-1005'].set.contact, undefined, 'an email as a name gives no contact');
  assert.ok(!JSON.stringify(place.writes()).includes('example.com'));
  assert.ok(!JSON.stringify(place.writes()).includes('Kim'), 'no last name reaches a document');
});

test('a contact falls back to the text of Assigned when the names question gives nothing', () => {
  const place = setup('contact-text', { tools: true });
  world(place, { items: [item('1', 'One', [col.assigned([99], 'Robin Hale, Ash Lee')], 'Build')], doneItems: [] });
  place.run();
  assert.equal(documentsOf(place)['task-monday-1'].set.contact, 'Robin');
});

test('a task whose item has gone is deleted with its draft, and one that is up to date is left alone', () => {
  const place = setup('gone', { tools: true });
  const same = { _id: 'task-monday-2002', title: 'Old dashboard', department: 'strategy', list: 'done', status: 'done', team: null, subteam: null, contact: null, priority: null, startDate: null, dueDate: null, completedOn: null, estHours: null, showOnBoard: true, show: true, mondayBoardId: doneBoardId, mondayBoardName: 'Completed Tasks', old: false };
  world(place, { tasks: [same, { _id: 'task-monday-9999', title: 'Gone', old: false }, { _id: 'task-other', title: 'Not ours', old: false }] });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  const mutations = place.taskMutations();
  assert.ok(mutations.some(mutation => mutation.delete && mutation.delete.id === 'task-monday-9999'));
  assert.ok(mutations.some(mutation => mutation.delete && mutation.delete.id === 'drafts.task-monday-9999'));
  assert.ok(!mutations.some(mutation => (mutation.delete && mutation.delete.id === 'task-other') || (mutation.patch && mutation.patch.id === 'task-other')), 'only task-monday-* is deleted');
  assert.ok(!mutations.some(mutation => mutation.patch && mutation.patch.id === 'task-monday-2002'), 'an up to date task is not touched');
  assert.ok(result.text.includes('1 deleted'), result.text);
  assert.ok(!JSON.stringify(mutations).includes('showOnTv'), 'the editor switch is never sent');
});

test('a task the older sync wrote loses its older fields once', () => {
  const place = setup('older', { tools: true });
  world(place, { tasks: [{ _id: 'task-monday-2002', title: 'Old dashboard', department: 'strategy', list: 'done', status: 'done', showOnBoard: true, show: true, mondayBoardId: doneBoardId, mondayBoardName: 'Completed Tasks', old: true }] });
  place.run();
  const unset = documentsOf(place)['task-monday-2002'].unset;
  ['owners', 'milestoneIds', 'hiddenReason'].forEach(name => assert.ok(unset.includes(name), name));
});

test('nothing is deleted when a board was not read to its end', () => {
  const place = setup('partial', { tools: true });
  world(place, { tasks: [{ _id: 'task-monday-9999', title: 'Gone', old: false }] });
  place.answer('items-' + doneBoardId, { errors: [{ message: 'Board not found' }] });
  const result = place.run();
  assert.equal(result.status, 1);
  assert.ok(!place.taskMutations().some(mutation => mutation.delete), 'no delete');
  assert.ok(documentsOf(place)['task-monday-1001'], 'the tasks that were read are written');
  const set = statusOf(place).set;
  assert.ok(!('lastSyncAt' in set), 'the read did not work');
  assert.equal(set.lastError, 'Monday said: Board not found. Press Monday debug on the control page and send the answer to a coach.');
  assert.ok(!requestsOf(result.calls).includes('status-write monday'));
});

test('a board of 450 items is read in pages', () => {
  const many = [];
  for (let index = 0; index < 450; index += 1) many.push(item(String(5000 + index), 'Task ' + index, [col.state(5)], 'Build'));
  const place = setup('pages', { tools: true });
  world(place, { items: many, doneItems: [] });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(requestsOf(result.calls).filter(line => line.startsWith('monday ')), ['monday items-' + taskBoardId, 'monday more-cursor' + taskBoardId + 'n1', 'monday more-cursor' + taskBoardId + 'n2', 'monday items-' + doneBoardId]);
  assert.ok(result.text.includes('monday: 450 task(s) read'), result.text);
});

test('monday-status: last read, the error in plain words or none, the reads, the readings and the counts of each department', () => {
  const place = setup('status', { tools: true });
  world(place, { known: { lastSyncAt: '2027-01-12T14:00:00Z', callsToday: 6, callsDate: todayText } });
  place.run();
  const patch = statusOf(place);
  assert.equal(patch.set.lastSyncAt, nowText);
  assert.equal(patch.set.callsToday, 9, 'six before and three now');
  assert.equal(patch.set.callsDate, todayText);
  assert.equal(patch.set.taskCount, 9);
  assert.deepEqual(patch.unset, ['boards', 'hiddenUnassigned', 'connectedAs', 'lastError']);
  assert.deepEqual(patch.set.readings.map(reading => [reading.boardId, reading.boardName, reading.itemsRead]), [[taskBoardId, 'Robotics Tasks', 9], [doneBoardId, 'Completed Tasks', 2]]);
  const build = patch.set.departments.find(entry => entry.name === 'build');
  assert.deepEqual(build, { _key: 'build', name: 'build', open: 1, done: 2 });
  assert.deepEqual(patch.set.departments.map(entry => entry.name), ['build', 'electrical', 'programming', 'design', 'cnc', 'strategy', 'operations', 'business', 'marketing']);
  assert.equal(patch.set.departments.find(entry => entry.name === 'cnc').open, 0, 'a hidden task is not counted');
  assert.deepEqual(patch.set.snapshots, [{ _key: todayText, date: todayText, open: 4 }], 'the open tasks on the TV');
});

test('how often: a run before the setting ends without a word; the Sync Monday now file reads at once', () => {
  // The file of the control page is moved into the folder of this test, so another test that writes the real one changes nothing here
  const force = path.join(work, 'every-force');
  const place = setup('every', { tools: true, edits: [['/tmp/teletraan-monday-force', force]] });
  const known = { lastSyncAt: '2027-01-12T14:50:00Z', callsToday: 3, callsDate: todayText };
  world(place, { every: 30, known: known });
  const early = place.run();
  assert.equal(early.status, 0);
  assert.equal(early.text, '');
  assert.deepEqual(requestsOf(early.calls), ['sanity-query']);
  assert.ok(textOf(syncFile).includes('/tmp/teletraan-monday-force -mmin -2'), 'the force file of the control page');

  fs.writeFileSync(force, '');
  world(place, { every: 30, known: known });
  assert.deepEqual(requestsOf(place.run().calls), sequence, 'Sync Monday now reads at once');
  fs.rmSync(force);

  world(place, { every: 5, known: known });
  assert.deepEqual(requestsOf(place.run().calls), sequence, 'ten minutes old with a setting of 5 reads');
});

test('the daily budget: at 900 reads the run waits for midnight and says so', () => {
  const place = setup('budget', { tools: true });
  world(place, { known: { lastSyncAt: '2027-01-12T10:00:00Z', callsToday: 900, callsDate: todayText } });
  const result = place.run();
  assert.equal(result.status, 0);
  assert.deepEqual(requestsOf(result.calls), ['sanity-query', 'sanity-write']);
  assert.equal(place.writes()[0].mutations[1].patch.set.lastError, 'Daily read limit reached. Reads start again at midnight.');
});

test('a refused token stops the run, says in one sentence what to do, and never says the token', () => {
  const place = setup('refused', { tools: true });
  world(place);
  place.answer('items-' + taskBoardId, { error_message: 'Not Authenticated' }, { code: 401 });
  const result = place.run();
  assert.equal(result.status, 1);
  assert.deepEqual(requestsOf(result.calls), ['sanity-query', 'monday items-' + taskBoardId, 'sanity-write']);
  assert.equal(statusOf(place).set.lastError, 'Monday refused the token; paste a new MONDAY_API_TOKEN in Settings, Keys on the control page.');
  assert.ok(!(result.text + result.errors + result.calls).includes(mondayToken));
});

test('every failure says what to do in one sentence', () => {
  const offline = setup('offline', { tools: true });
  world(offline);
  offline.answer('items-' + taskBoardId, undefined, { exit: 6 });
  offline.run();
  assert.match(statusOf(offline).set.lastError, /^Monday did not answer \(could not find the server, so the network may be down\); check that the Teletraan computer is online, and the next run tries again\./);

  const unseen = setup('unseen', { tools: true });
  world(unseen);
  unseen.answer('items-' + taskBoardId, { data: { boards: [] } });
  unseen.run();
  assert.match(statusOf(unseen).set.lastError, /Monday gave no items for board 18435126893\. Share the board with the account of the Monday token, then press Sync Monday now\./);

  const refused = setup('write-refused', { tools: true });
  world(refused);
  fs.writeFileSync(path.join(refused.stub, 'mutate.exit'), '22');
  const result = refused.run();
  assert.ok(result.errors.includes('Could not write to Sanity (Sanity refused it, so the token may be wrong or may not have Editor access); check SANITY_WRITE_TOKEN in Settings, Keys on the control page.'), result.errors);
});

test('text from Monday never reaches the shell or breaks the JSON', () => {
  const place = setup('hostile', { tools: true });
  world(place, { items: [item('1', 'Say "hi" $(touch x) `id`\tnow', [col.assigned([71])], 'Build')], doneItems: [] });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.equal(documentsOf(place)['task-monday-1'].set.title, 'Say "hi" $(touch x) `id` now');
  assert.ok(!fs.existsSync(path.join(place.root, 'x')));
});

test('the tokens are never printed, never an argument of curl, never in a file or a document', () => {
  const place = setup('secrets', { tools: true });
  world(place);
  const result = place.run();
  [mondayToken, writeToken, secret, 'SECRET-FEED-TOKEN'].forEach(word => {
    assert.ok(!(result.text + result.errors + result.calls).includes(word), word);
    assert.ok(!JSON.stringify(place.writes()).includes(word), word);
    filesUnder(place.data).forEach(file => assert.ok(!fs.readFileSync(file, 'utf8').includes(word), file));
  });
  assert.ok(place.configs().includes('header = "Authorization: ' + mondayToken + '"'));
  assert.ok(place.configs().includes('header = "Authorization: Bearer ' + writeToken + '"'));
});

test('without a token the run says so in one line and asks for nothing', () => {
  const place = setup('no-token', { tools: true, env: "TELETRAAN_DATA='<data>'\nSANITY_WRITE_TOKEN='" + writeToken + "'\n" });
  world(place);
  const result = place.run();
  assert.equal(result.status, 0);
  assert.equal(result.text.trim(), 'MONDAY_API_TOKEN is not in local.env yet, so nothing was read. See docs/monday.md.');
  assert.equal(requestsOf(result.calls).length, 0);
});

test('--check asks who the token belongs to and writes nothing', () => {
  const place = setup('check', { tools: true });
  world(place);
  const result = place.run(['--check']);
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(result.text.trim().split('\n'), ['OK    Monday accepts the token (connected as Jordan)', 'OK    SANITY_WRITE_TOKEN is in local.env']);
  assert.deepEqual(requestsOf(result.calls), ['monday me']);
  assert.equal(place.writes().length, 0);
});

test('--debug prints the kind of board and the shape of two items, with no names of people', () => {
  const place = setup('debug', { tools: true });
  world(place);
  place.answer('items-' + taskBoardId, { data: { boards: [{ name: 'Robotics Tasks', hierarchy_type: 'multi_level', items_page: { items: taskItems().slice(0, 2) } }] } });
  const result = place.run(['--debug', taskBoardId]);
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('Board: Robotics Tasks') && result.text.includes('Hierarchy: multi_level'), result.text);
  assert.ok(result.text.includes('"battery_value"'), result.text);
  assert.ok(result.text.includes('{"count":2}'), 'a people column says how many');
  assert.equal(place.writes().length, 0);
  assert.equal(place.run(['--debug', 'x']).status, 1);
});

test('a run that finds the lock taken stops at once', () => {
  const place = setup('locked', { tools: true });
  world(place);
  const result = place.run([], { STUB_LOCKED: 'yes' });
  assert.equal(result.status, 0);
  assert.ok(result.text.includes('still going'));
  assert.equal(requestsOf(result.calls).length, 0);
});

test('the script also works under bash, with the same writes', () => {
  if (!fs.existsSync('/bin/bash')) return;
  const reference = setup('bash-reference', { tools: true });
  world(reference);
  reference.run();
  const place = setup('bash', { tools: true });
  world(place);
  const result = place.run([], {}, '/bin/bash');
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(place.writes(), reference.writes());
});

test('the scripts have valid sh syntax, are executable, and secrets only go to curl on standard input', () => {
  [syncFile, installFile].forEach(file => {
    assert.equal(spawnSync('/bin/sh', ['-n', file], { encoding: 'utf8' }).status, 0);
    assert.ok((fs.statSync(file).mode & 0o111) !== 0);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(/^set -euo pipefail$/m.test(text));
    assert.ok(!/\bcat\b[^\n]*local\.env/.test(text));
    assert.ok(!/CALENDAR_|TBA_/.test(text));
  });
  const text = textOf(syncFile);
  assert.ok(!/--header[^\n]*Authorization/.test(text));
  assert.ok(!/set -x|--verbose|--trace/.test(text));
});

test('the limits: a title of 40 and a first name of 12 as in the task schema, 900 reads a day, 120 counts', () => {
  const text = textOf(syncFile);
  const task = fs.readFileSync(path.join(repo, 'studio/schemas/task.js'), 'utf8');
  assert.ok(text.includes('\ntitle_limit=40\n') && /tooLong\(Rule, 40\)/.test(task));
  assert.ok(text.includes('\ncontact_limit=12\n') && /name: 'contact'[\s\S]*?tooLong\(Rule, 12\)/.test(task));
  assert.ok(text.includes('\ndaily_limit=900\n'));
  assert.ok(text.includes('\nsnapshots_kept=120\n'));
  assert.ok(text.includes("monday_version='2026-01'"));
});

test('the unit files run the script every 5 minutes as ACCOUNT, and status-write knows the job monday', () => {
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-monday.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-monday.timer'), 'utf8');
  assert.deepEqual(service.match(/^User=.*$/gm), ['User=ACCOUNT']);
  assert.deepEqual(service.match(/^ExecStart=.*$/gm), ['ExecStart=/opt/teletraan/computer/scripts/monday-sync.sh']);
  assert.ok(/^OnUnitActiveSec=5min$/m.test(timer));
  assert.ok(fs.readFileSync(path.join(repo, 'computer/scripts/status-write.sh'), 'utf8').includes('monday) field=lastMondaySyncAt ;;'));
});

test('install-monday.sh needs sudo and the repository at /opt/teletraan before it changes anything', () => {
  const place = setup('install-checks', { tools: true, install: true });
  const plain = place.install({ STUB_UID: '1000' });
  assert.equal(plain.status, 1);
  assert.ok(plain.errors.includes('it has to run with sudo'), plain.errors);
  assert.ok(!plain.calls.includes('systemctl'));
});

test('local.example.env has a MONDAY_API_TOKEN line with a placeholder', () => {
  const example = fs.readFileSync(path.join(repo, 'computer/local.example.env'), 'utf8');
  assert.ok(/^MONDAY_API_TOKEN='\[[^\n]*\]'$/m.test(example));
});


let failures = 0;
try {
  for (const entry of tests) {
    if (process.env.ONLY && !entry.name.includes(process.env.ONLY)) continue;
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
