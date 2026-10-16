// Tests for computer/scripts/monday-sync.sh (the task board and the milestones board of
// the rebuilt Monday workspace) and computer/scripts/install-monday.sh. The tools they use
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
const ordinaryTools = ['sed', 'tail', 'head', 'grep', 'mktemp', 'mv', 'rm', 'mkdir', 'dirname', 'basename', 'cat', 'cp', 'cmp', 'tr', 'stat', 'sleep', 'wc'];

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
      'query { me { name } boards'*) name=boards ;;
      'query ($board'*) name="items-$(jq -r '.variables.board[0]' "$body")" ;;
      'query ($cursor'*) name="more-$(jq -r '.variables.cursor' "$body")" ;;
      *) name=unknown ;;
    esac
    echo "monday $name" >> "$STUB_LOG"
    jq -c '.variables // {}' "$body" >> "$STUB_DIR/variables.txt"
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

// Makes a copy of the mini folder and config.js to run in, a folder of tools
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
    pages(board, items, size, name) {
      const count = Math.max(1, Math.ceil(items.length / size));
      for (let index = 0; index < count; index += 1) {
        const cursor = index + 1 < count ? 'cursor' + board + 'n' + (index + 1) : null;
        const page = { cursor: cursor, items: items.slice(index * size, (index + 1) * size) };
        if (index === 0) this.answer('items-' + board, { data: { boards: [{ name: name || 'Board', items_page: page }] } });
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
    variables() {
      const file = path.join(stub, 'variables.txt');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
    },
  };
  return place;
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


// The made-up world. The ids of the columns and the indexes are the ones of the rebuilt workspace
// (the contract of docs/monday.md), because they are the starting values of Dashboard Settings.
const taskBoardId = '18435126893';
const milestoneBoardId = '18435272887';
const todayText = '2027-01-12';
const nowText = '2027-01-12T15:00:00Z';

// One value of a column, as the typed fragments give it
function value(id, type, text, extra) {
  return Object.assign({ id: id, type: type, text: text }, extra || {});
}
function status(id, label, index) {
  return value(id, 'status', label, { label: label, index: index });
}
function item(id, name, values, parent) {
  const answer = { id: id, name: name, parent_item: parent ? { id: parent } : null, column_values: values };
  return answer;
}

// The columns of a task, by what they hold
const col = {
  department: (label, index) => status('color_mm82nvea', label, index),
  state: (label, index) => status('color_mkv6tatz', label, index),
  team: (label, index) => status('color_mm82jgxg', label, index),
  priority: (label, index) => status('color_mm82wfy', label, index),
  show: (label, index) => status('color_mm83p12x', label, index),
  assigned: text => value('multiple_person_mm82cqbx', 'people', text, { persons_and_teams: [{ id: 1 }] }),
  poc: text => value('multiple_person_mm8331h1', 'people', text, { persons_and_teams: [{ id: 1 }] }),
  timeline: (from, to) => value('timerange_mkyp8kx7', 'timeline', from + ' - ' + to, { from: from, to: to }),
  hours: text => value('numeric_mm82pw1a', 'numbers', text),
  completed: day => value('date_mm82kn5v', 'date', day, { date: day }),
  milestone: ids => value('board_relation_mm83phwy', 'board_relation', ids.length + ' linked', { linked_item_ids: ids }),
};

// One item for each kind the contract lists: a status of each index, a General item, an Unassigned item, a Hide item
// and a subitem, and an item with nothing set but its department
function taskItems() {
  return [
    item('1001', 'Wire the robot', [
      col.department('Build', 1), col.state('In Progress', 0), col.team('Prime', 1), col.priority('High', 2), col.show('Show', 5),
      col.assigned('Pat Kim, Jo Ray'), col.poc('Sam Lee'), col.timeline('2026-10-01', '2026-10-20'), col.hours('12.5'), col.milestone(['2001', '2004']),
      value('text_mm82s03v', 'text', 'Sam Lee, sam@example.com, call 555 0100'),
    ]),
    item('1002', 'Pick up parts', [
      col.department('Build', 1), col.state('Done', 1), col.team('Prime', 1), col.priority('Low', 1), col.show('Show', 5),
      col.poc('Ana Diaz'), col.completed('2026-10-10'), col.hours('4'),
    ]),
    item('1003', 'Waiting on a part', [
      col.department('Electrical', 0), col.state('Stuck', 2), col.team('Nova', 0), col.priority('Medium', 0), col.show('Show', 5),
      col.timeline('2027-01-05', '2027-01-30'),
    ]),
    item('1004', 'Check the bumpers', [
      col.department('Design', 3), col.state('In Review', 3), col.team('Prime', 1), col.show('Show', 5), col.poc('Lee'),
    ]),
    // Done is the group of this item, and its status is To Do, so it reads To Do
    item('1005', 'Reopened task', [
      col.department('Programming', 2), col.state('To Do', 5), col.team('General', 5), col.priority('', 5), col.show('Show', 5),
    ]),
    item('1006', 'Plan the outreach', [
      col.department('Strategy', 6), col.state('In Progress', 0), col.team('General', 5), col.show('Show', 5), col.hours('0'),
    ]),
    item('1007', 'Nobody owns this', [
      col.department('Unassigned', 5), col.state('To Do', 5), col.team('Prime', 1), col.show('Show', 5),
    ]),
    item('1008', 'Hidden from the TV', [
      col.department('Build', 1), col.state('In Progress', 0), col.team('Prime', 1), col.show('Hide', 6),
    ]),
    item('1009', 'A subitem of the wiring', [
      col.department('Build', 1), col.state('In Progress', 0), col.team('Prime', 1), col.show('Show', 5),
    ], '1001'),
    // Nothing is set but the department: every unset column reports 5, or is not in the answer
    item('1010', 'Nothing set', [col.department('Build', 1)]),
  ];
}

function milestoneItems() {
  const date = day => value('date_mm83y6zw', 'date', day, { date: day });
  const team = (label, index) => status('color_mm83be52', label, index);
  const department = (label, index) => status('color_mm83f77w', label, index);
  const state = (label, index) => status('color_mm83ndkf', label, index);
  return [
    item('2001', 'First robot test', [date('2026-12-01'), team('Prime', 109), department('Build', 107), state('On Track', 1)]),
    item('2002', 'Kickoff', [date('2027-01-09'), team('Both Teams', 5), department('All Departments', 5), state('Not Started', 5)]),
    item('2003', 'Wiring done', [date('2026-11-15'), team('Nova', 8), department('Electrical', 9), state('At Risk', 2)]),
    item('2004', 'Bumpers done', [date('2026-10-01'), team('Prime', 109), department('Design', 1), state('Done', 3)]),
    item('2005', 'EXAMPLE - edit or delete me (Robot reveal)', [team('Both Teams', 5), department('All Departments', 5), state('Not Started', 5)]),
    item('2006', 'No date yet', [team('Prime', 109), department('Build', 107), state('Not Started', 5)]),
    item('2007', 'EXAMPLE with a date', [date('2026-12-24'), team('Both Teams', 5), department('All Departments', 5), state('Not Started', 5)]),
  ];
}

// The Team leads of the made-up team. A lead may be written with capitals or spaces that the label is not.
const leads = [
  { _id: 'subteam-electrical', name: 'Electrical' }, { _id: 'subteam-build', name: ' build ' }, { _id: 'subteam-programming', name: 'Programming' },
  { _id: 'subteam-design', name: 'Design' }, { _id: 'subteam-cnc', name: 'CNC' }, { _id: 'subteam-strategy', name: 'Strategy' },
  { _id: 'subteam-business', name: 'Business' }, { _id: 'subteam-marketing', name: 'Marketing' }, { _id: 'subteam-operations', name: 'Operations' },
];

function world(place, options) {
  const given = options || {};
  place.at(nowText, todayText);
  place.sanity({
    zone: given.zone || 'America/New_York',
    owners: given.owners === true,
    every: given.every === undefined ? null : given.every,
    taskBoard: given.taskBoard === undefined ? null : given.taskBoard,
    milestoneBoard: given.milestoneBoard === undefined ? null : given.milestoneBoard,
    teams: [{ _id: 'team-prime' }, { _id: 'team-nova' }],
    subteams: given.subteams || leads,
    tasks: given.tasks || [],
    milestones: given.milestones || [],
    known: given.known === undefined ? null : given.known,
    snapshots: given.snapshots === undefined ? null : given.snapshots,
    readings: given.readings === undefined ? null : given.readings,
  });
  place.answer('boards', boardsAnswer());
  place.answer('me', { data: { me: { name: 'Jordan Example' } } });
  place.pages(taskBoardId, given.items || taskItems(), 200, 'Robotics Tasks');
  place.pages(milestoneBoardId, given.milestoneItems || milestoneItems(), 200, 'Milestones');
}

function boardsAnswer() {
  const columns = [
    { id: 'name', title: 'Name', type: 'name' },
    { id: 'color_mkv6tatz', title: 'Status', type: 'status' },
    { id: 'timerange_mkyp8kx7', title: 'Timeline', type: 'timeline' },
  ];
  return {
    data: {
      me: { name: 'Jordan Example' },
      boards: [
        { id: taskBoardId, name: 'Robotics Tasks', type: 'board', items_count: 10, columns: columns },
        { id: milestoneBoardId, name: 'Milestones', type: 'board', items_count: 7, columns: columns.slice(0, 2) },
        { id: '333', name: 'Subitems of Robotics Tasks', type: 'sub_items_board', items_count: 2, columns: columns.slice(0, 1) },
      ],
    },
    account_id: 1,
  };
}

// A first read of a day: the list of boards, the task board, the milestones board
const firstSequence = ['sanity-query', 'monday boards', 'monday items-' + taskBoardId, 'monday items-' + milestoneBoardId, 'sanity-write', 'sanity-write', 'status-write monday'];

// The reads that a day already had, so the list of boards is not asked for again
const laterRead = { lastSyncAt: '2027-01-12T14:00:00Z', callsToday: 6, callsDate: todayText, lastError: null, boards: 3 };
const laterSequence = ['sanity-query', 'monday items-' + taskBoardId, 'monday items-' + milestoneBoardId, 'sanity-write', 'sanity-write', 'status-write monday'];

// The documents the run made or patched, by id
function documentsOf(place) {
  const patches = {};
  place.taskMutations().forEach(mutation => {
    if (mutation.createIfNotExists) patches[mutation.createIfNotExists._id] = Object.assign(patches[mutation.createIfNotExists._id] || {}, { created: mutation.createIfNotExists });
    if (mutation.patch) {
      const entry = patches[mutation.patch.id] || {};
      entry.set = Object.assign(entry.set || {}, mutation.patch.set);
      entry.unset = (entry.unset || []).concat(mutation.patch.unset || []);
      patches[mutation.patch.id] = entry;
    }
  });
  return patches;
}

// The patch to monday-status that the last write made
function statusOf(place) {
  const all = place.writes();
  const last = all[all.length - 1].mutations;
  assert.equal(last[0].createIfNotExists._id, 'monday-status');
  return last[1].patch;
}

test('a first read of a day: the list of boards, the task board, the milestones board, the writes, then the status, then the time goes to status-mini', () => {
  const place = setup('sequence', { tools: true });
  world(place);
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.equal(result.errors, '');
  assert.deepEqual(requestsOf(result.calls), firstSequence);
  assert.ok(requestsOf(result.calls).filter(line => line.startsWith('monday ')).length <= 4, 'at most four requests to Monday');
  assert.ok(result.text.includes('monday: 9 task(s) and 4 milestone(s) read'), result.text);
  assert.ok(result.text.includes('monday: 9 task(s) wanted, 9 new, 0 changed, 0 switched off, 4 milestone(s)'), result.text);
  assert.ok(result.text.includes('monday: status written'), result.text);
  assert.equal(place.writes().length, 2);
  assert.deepEqual(fs.readdirSync(place.folder).sort(), ['.lock']);
});

test('a later read of the same day does not ask for the list of boards again', () => {
  const place = setup('later', { tools: true });
  world(place, { known: Object.assign({}, laterRead, { lastSyncAt: '2027-01-12T14:00:00Z' }) });
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(requestsOf(result.calls), laterSequence);
  assert.equal(statusOf(place).set.callsToday, 8, 'six reads before and two now');
  assert.equal(statusOf(place).set.callsDate, todayText);
  assert.ok(!('boards' in statusOf(place).set), 'the list of boards is left as it was');

  const noList = setup('no-list', { tools: true });
  world(noList, { known: Object.assign({}, laterRead, { boards: 0 }) });
  assert.deepEqual(requestsOf(noList.run().calls), firstSequence, 'a status with no list of boards asks for it');
});

test('the requests go to the address and version of the block at the top, https only, with a time limit, and ask for the typed values of the chosen columns only', () => {
  const place = setup('flags', { tools: true });
  world(place);
  const result = place.run();
  const lines = result.calls.split('\n').filter(line => line.startsWith('curl '));

  lines.forEach(line => {
    assert.ok(line.startsWith('curl --disable '), 'curl ignores the settings file of the account: ' + line);
    assert.ok(line.includes('--proto =https'), line);
    assert.ok(line.includes('--max-time '), line);
    assert.ok(!line.includes('--location'), 'no redirect is followed: ' + line);
  });
  const monday = lines.filter(line => line.includes('api.monday.com'));
  assert.equal(monday.length, 3);
  monday.forEach(line => {
    assert.ok(line.endsWith('https://api.monday.com/v2'), line);
    assert.ok(line.includes('--header API-Version: 2025-07'), line);
    assert.ok(line.includes('--config -'), 'the token comes in on standard input: ' + line);
  });
  const variables = place.variables();
  assert.deepEqual(variables[0], {});
  assert.deepEqual(variables[1].board, [taskBoardId]);
  assert.equal(variables[1].limit, 200);
  assert.deepEqual(variables[1].columns, ['color_mkv6tatz', 'color_mm82jgxg', 'color_mm82nvea', 'color_mm82wfy', 'color_mm83p12x', 'date_mm82kn5v', 'multiple_person_mm82cqbx', 'multiple_person_mm8331h1', 'numeric_mm82pw1a', 'timerange_mkyp8kx7', 'board_relation_mm83phwy'].sort());
  assert.deepEqual(variables[2], { board: [milestoneBoardId], columns: ['color_mm83be52', 'color_mm83f77w', 'color_mm83ndkf', 'date_mm83y6zw'], limit: 200 });

  const script = textOf(syncFile);
  ['... on StatusValue { label index }', '... on BoardRelationValue { linked_item_ids }', '... on DateValue { date }', '... on TimelineValue { from to }', '... on PeopleValue { persons_and_teams { id } }'].forEach(fragment => {
    assert.ok(script.split(fragment).length >= 3, 'both item questions use the typed fragment ' + fragment);
  });
  assert.ok(!/subitems\s*\{/.test(script), 'subitems are never asked for');
});

test('Sanity is asked for the settings, the teams, the Team leads, what the Teletraan computer wrote earlier and its own last read, without a login, and the writes go to the project in config.js', () => {
  const place = setup('sanity', { tools: true });
  world(place);
  const result = place.run();
  const config = fs.readFileSync(path.join(repo, 'dashboard/config.js'), 'utf8');
  const project = config.match(/projectId: '([^']*)'/)[1];
  const dataset = config.match(/dataset: '([^']*)'/)[1];
  const version = config.match(/apiVersion: '([^']*)'/)[1];

  const question = result.calls.split('\n').filter(line => line.includes('/data/query/'))[0];
  assert.ok(question.includes('https://' + project + '.api.sanity.io/v' + version + '/data/query/' + dataset), 'the ordinary host, not the cached one: ' + question);
  assert.ok(question.includes('perspective=published'));
  ['mondayTaskBoard', 'mondayMilestoneBoard', 'mondayEveryMinutes', 'mondayShowOwners', 'source == "monday"', '_type == "milestone"', '_type == "subteam"', '_type == "team"', 'monday-status'].forEach(word => {
    assert.ok(question.includes(word), 'the question has ' + word);
  });
  assert.ok(!question.includes('mondayBoards'), 'the old board rows are ignored');
  assert.ok(!question.includes('--config'), 'the dataset is public, so the question sends no login');

  const writes = result.calls.split('\n').filter(line => line.includes('/data/mutate/'));
  assert.equal(writes.length, 2);
  writes.forEach(write => {
    assert.ok(write.includes('--request POST') && write.includes('Content-Type: application/json') && write.includes('--fail'), write);
    assert.ok(write.includes('--config -'), 'the token comes in on standard input: ' + write);
  });
  const addresses = fs.readFileSync(path.join(place.stub, 'addresses.txt'), 'utf8').trim().split('\n');
  addresses.forEach(address => assert.equal(address, 'https://' + project + '.api.sanity.io/v' + version + '/data/mutate/' + dataset));

  const script = textOf(syncFile);
  [project, dataset, version].forEach(value => assert.ok(!script.includes(value), 'the script should not contain ' + value));
});

function refOf(reference) {
  return reference && reference._ref ? reference._ref : null;
}

// The tasks and milestones of a run as Sanity would give them back on the next run
function storedFrom(place) {
  const stored = { tasks: [], milestones: [] };
  const all = documentsOf(place);
  Object.keys(all).forEach(id => {
    const set = all[id].set;
    const document = Object.assign({ _id: id }, set, { subteam: refOf(set.subteam), team: refOf(set.team) });
    ['subteam', 'team'].forEach(name => { if (document[name] === null) delete document[name]; });
    (id.startsWith('task-') ? stored.tasks : stored.milestones).push(document);
  });
  return stored;
}

test('a task is made from the columns by index: department to the Team lead, status, priority, team, dates, hours and milestones', () => {
  const place = setup('mapping', { tools: true });
  world(place);
  assert.equal(place.run().status, 0);
  const documents = documentsOf(place);

  assert.deepEqual(Object.keys(documents).filter(id => id.startsWith('task-')).sort(), ['task-monday-1001', 'task-monday-1002', 'task-monday-1003', 'task-monday-1004', 'task-monday-1005', 'task-monday-1006', 'task-monday-1007', 'task-monday-1008', 'task-monday-1010']);
  assert.deepEqual(documents['task-monday-1001'].created, { _id: 'task-monday-1001', _type: 'task', source: 'monday', mondayId: '1001' });
  assert.deepEqual(documents['task-monday-1001'].set, {
    title: 'Wire the robot',
    subteam: { _type: 'reference', _ref: 'subteam-build' },
    team: { _type: 'reference', _ref: 'team-prime' },
    status: 'in-progress',
    priority: 'high',
    showOnBoard: true,
    contact: 'Sam',
    startDate: '2026-10-01',
    dueDate: '2026-10-20',
    estHours: 12.5,
    milestoneIds: ['2001', '2004'],
    show: true,
    mondayBoardId: taskBoardId,
    mondayBoardName: 'Robotics Tasks',
  });

  // one item for each status index
  const statusOf = id => documents['task-monday-' + id].set.status;
  assert.equal(statusOf(1001), 'in-progress', 'index 0');
  assert.equal(statusOf(1002), 'done', 'index 1');
  assert.equal(statusOf(1003), 'blocked', 'Stuck, index 2');
  assert.equal(statusOf(1004), 'in-review', 'index 3');
  assert.equal(statusOf(1005), 'up-next', 'index 5 is To Do, whatever group the item is in');
  assert.equal(statusOf(1010), 'up-next', 'a status that nobody set');

  // the done task keeps the day it was completed, and the others have none
  assert.equal(documents['task-monday-1002'].set.completedOn, '2026-10-10');
  assert.ok(documents['task-monday-1001'].unset.includes('completedOn'));
  assert.equal(documents['task-monday-1002'].set.priority, 'low');
  assert.equal(documents['task-monday-1003'].set.priority, 'medium');
  assert.equal(documents['task-monday-1005'].set.priority, undefined, 'the unset priority, index 5');
  assert.deepEqual(documents['task-monday-1003'].set.team, { _type: 'reference', _ref: 'team-nova' });

  // General: the team index 5, or a team that nobody set, gives no team
  assert.equal(documents['task-monday-1005'].set.team, undefined);
  assert.ok(documents['task-monday-1005'].unset.includes('team'));
  assert.equal(documents['task-monday-1006'].set.team, undefined);
  assert.equal(documents['task-monday-1010'].set.team, undefined);

  // the department is the index and not the label, and a label that is written with other capitals still finds its lead
  assert.equal(refOf(documents['task-monday-1003'].set.subteam), 'subteam-electrical');
  assert.equal(refOf(documents['task-monday-1004'].set.subteam), 'subteam-design');
  assert.equal(refOf(documents['task-monday-1002'].set.subteam), 'subteam-build', 'the lead is called " build " and the row is Build');
});

test('a task with no department is written hidden with the reason, an item with Show on TV set to Hide is written with showOnBoard false, and a subitem is not written', () => {
  const place = setup('hidden', { tools: true });
  world(place);
  place.run();
  const documents = documentsOf(place);

  const unassigned = documents['task-monday-1007'].set;
  assert.equal(unassigned.show, false);
  assert.equal(unassigned.hiddenReason, 'unassigned');
  assert.equal(unassigned.subteam, undefined);
  assert.ok(documents['task-monday-1007'].unset.includes('subteam'));
  assert.equal(documents['task-monday-1001'].set.hiddenReason, undefined, 'a task with a department has no reason');

  assert.equal(documents['task-monday-1008'].set.showOnBoard, false);
  assert.equal(documents['task-monday-1008'].set.show, true, 'the editor switch and the screen switch are other things');
  assert.equal(documents['task-monday-1001'].set.showOnBoard, true);
  assert.equal(documents['task-monday-1010'].set.showOnBoard, true, 'Show is the default');

  assert.equal(documents['task-monday-1009'], undefined, 'a subitem is never a task');
  place.taskMutations().forEach(mutation => assert.ok(!JSON.stringify(mutation).includes('A subitem of the wiring')));

  const status = statusOf(place).set;
  assert.equal(status.taskCount, 9);
  assert.equal(status.hiddenUnassigned, 1);
});

test('Hide is read by its label text, whatever its capitals, and the text is a setting', () => {
  const place = setup('hide-label', { tools: true });
  world(place, { items: [item('1', 'Lower case hide', [col.department('Build', 1), col.show('hide', 6)]), item('2', 'Other word', [col.department('Build', 1), col.show('Hide', 6)])], taskBoard: { hideLabel: 'Hidden' } });
  place.run();
  const documents = documentsOf(place);
  assert.equal(documents['task-monday-1'].set.showOnBoard, true, 'the label is now Hidden, so hide is a label like any other');
  assert.equal(documents['task-monday-2'].set.showOnBoard, true);

  const other = setup('hide-label-default', { tools: true });
  world(other, { items: [item('1', 'Lower case hide', [col.department('Build', 1), col.show('hide', 6)])] });
  other.run();
  assert.equal(documentsOf(other)['task-monday-1'].set.showOnBoard, false);
});

test('the contact is the first name of the POC, and owners are the first names of Assigned only when the setting is on; an email gives none', () => {
  const off = setup('owners-off', { tools: true });
  world(off);
  off.run();
  assert.equal(documentsOf(off)['task-monday-1001'].set.contact, 'Sam');
  assert.equal(documentsOf(off)['task-monday-1001'].set.owners, undefined);
  assert.ok(documentsOf(off)['task-monday-1001'].unset.includes('owners'));

  const on = setup('owners-on', { tools: true });
  world(on, { owners: true });
  on.run();
  assert.deepEqual(documentsOf(on)['task-monday-1001'].set.owners, ['Pat', 'Jo']);
  assert.equal(documentsOf(on)['task-monday-1001'].set.contact, 'Sam');

  const odd = setup('owners-odd', { tools: true });
  world(odd, {
    owners: true,
    items: [item('1', 'Odd names', [col.department('Build', 1), col.poc('sam@example.com'), col.assigned('sam@example.com, Mary-Anne Smith, Pat Kim, Pat Lee, , Jo Ray, Al, Bo, Cy, Di')])],
  });
  odd.run();
  const set = documentsOf(odd)['task-monday-1'].set;
  assert.equal(set.contact, undefined);
  assert.deepEqual(set.owners, ['Mary-Anne', 'Pat', 'Jo', 'Al', 'Bo', 'Cy'], 'first names only, each once, six at most');
  assert.ok(!JSON.stringify(odd.writes()).includes('Smith'), 'no last name is written');
});

test('no last name, email or note of an item reaches a document, and a title is cut to 22 characters', () => {
  const place = setup('private', { tools: true });
  world(place, { owners: true, items: taskItems().concat([item('1011', 'A title that is much longer than twenty two characters', [col.department('Build', 1)])]) });
  place.run();
  const written = JSON.stringify(place.writes());
  ['Sam Lee', 'Pat Kim', 'Jo Ray', 'Ana Diaz', 'sam@example.com', '555 0100', 'Notes'].forEach(word => {
    assert.ok(!written.includes(word), 'the documents have ' + word);
  });
  assert.equal(documentsOf(place)['task-monday-1011'].set.title, 'A title that is much l');
});

test('dates: the Timeline from and to, the text of the column when the typed values are missing, and a day that is not on the calendar gives none', () => {
  const place = setup('dates', { tools: true });
  world(place, {
    items: [
      item('1', 'Typed', [col.department('Build', 1), col.timeline('2026-10-01', '2026-10-20')]),
      item('2', 'Text only', [col.department('Build', 1), value('timerange_mkyp8kx7', 'timeline', '2026-10-12 - 2026-10-20')]),
      item('3', 'Not a day', [col.department('Build', 1), col.timeline('2026-02-30', '2026-13-01')]),
      item('4', 'Completed with a time', [col.department('Build', 1), col.state('Done', 1), value('date_mm82kn5v', 'date', '2026-10-10 09:30', { date: '2026-10-10' })]),
      item('5', 'Hours', [col.department('Build', 1), col.hours('1,250.256')]),
      item('6', 'Words for hours', [col.department('Build', 1), col.hours('a few')]),
      item('7', 'Negative hours', [col.department('Build', 1), col.hours('-3')]),
    ],
  });
  place.run();
  const documents = documentsOf(place);

  assert.equal(documents['task-monday-1'].set.startDate, '2026-10-01');
  assert.equal(documents['task-monday-1'].set.dueDate, '2026-10-20');
  assert.equal(documents['task-monday-2'].set.startDate, '2026-10-12');
  assert.equal(documents['task-monday-2'].set.dueDate, '2026-10-20');
  assert.equal(documents['task-monday-3'].set.startDate, undefined);
  assert.equal(documents['task-monday-3'].set.dueDate, undefined);
  assert.equal(documents['task-monday-4'].set.completedOn, '2026-10-10');
  assert.equal(documents['task-monday-5'].set.estHours, 1250.26);
  assert.equal(documents['task-monday-6'].set.estHours, undefined);
  assert.equal(documents['task-monday-7'].set.estHours, undefined);
});

test('the settings of the Monday tab win over the starting values: team labels, department rows with a Team lead, columns, and the status indexes', () => {
  const place = setup('settings', { tools: true });
  world(place, {
    items: [
      item('1', 'Team label one', [col.department('Build', 1), col.team('Prime', 1)]),
      item('2', 'Team label seven', [col.department('Build', 1), col.team('Orion', 7)]),
      item('3', 'Lead by reference', [col.department('Electrical', 0)]),
      item('4', 'Moved department', [col.department('Build', 42)]),
      item('5', 'Own status', [col.department('Build', 1), col.state('Parked', 8), value('own_state', 'status', 'Parked', { label: 'Parked', index: 8 })]),
      item('6', 'Not shown row', [col.department('Build', 1)]),
    ],
    taskBoard: {
      teamLabels: [{ index: 1, team: 'team-nova' }, { index: 7, team: 'team-prime' }],
      departmentLabels: [{ index: 0, name: 'Spark', subteam: 'subteam-programming' }, { index: 1, name: 'Build' }, { index: 42, name: 'Wood' }, { index: 5, name: 'Unassigned', neverShown: true }],
      statusIndexes: { done: 8 },
    },
  });
  place.run();
  const documents = documentsOf(place);

  assert.equal(refOf(documents['task-monday-1'].set.team), 'team-nova', 'index 1 is now Nova');
  assert.equal(refOf(documents['task-monday-2'].set.team), 'team-prime');
  assert.equal(refOf(documents['task-monday-3'].set.subteam), 'subteam-programming', 'a Team lead on the row wins over the name');
  assert.equal(documents['task-monday-4'].set.hiddenReason, 'unassigned', 'a department that has no Team lead named Wood is hidden');
  assert.equal(documents['task-monday-5'].set.status, 'done', 'the done index is a setting');
  assert.equal(documents['task-monday-5'].set.status, 'done');
  assert.equal(documents['task-monday-6'].set.status, 'up-next');
});

test('a setting that cannot be used skips its board and says so, and the other board is still read', () => {
  const place = setup('bad-settings', { tools: true });
  world(place, { taskBoard: { boardId: 'not a number' } });
  const result = place.run();
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('monday: The task board in Dashboard Settings has no usable board number, so it was skipped.'), result.errors);
  assert.deepEqual(requestsOf(result.calls).filter(line => line.startsWith('monday ')), ['monday boards', 'monday items-' + milestoneBoardId]);
  assert.equal(Object.keys(documentsOf(place)).filter(id => id.startsWith('task-')).length, 0);
  assert.ok(Object.keys(documentsOf(place)).some(id => id.startsWith('milestone-')));
  assert.ok(!('lastSyncAt' in statusOf(place).set), 'no task board was read, so the screen is not told it is up to date');
  assert.match(statusOf(place).set.lastError, /no usable board number/);

  const noColumn = setup('no-status-column', { tools: true });
  world(noColumn, { taskBoard: { statusColumn: 'a b c' } });
  const second = noColumn.run();
  assert.ok(second.errors.includes('has no Department or Status column'), second.errors);
});

test('milestones: a name, a target date, the team and department by index, the status, and one with no date or a name that starts with EXAMPLE is skipped', () => {
  const place = setup('milestones', { tools: true });
  world(place);
  place.run();
  const documents = documentsOf(place);

  assert.deepEqual(Object.keys(documents).filter(id => id.startsWith('milestone-')).sort(), ['milestone-monday-2001', 'milestone-monday-2002', 'milestone-monday-2003', 'milestone-monday-2004']);
  assert.deepEqual(documents['milestone-monday-2001'].created, { _id: 'milestone-monday-2001', _type: 'milestone' });
  assert.deepEqual(documents['milestone-monday-2001'].set, { name: 'First robot test', targetDate: '2026-12-01', team: { _type: 'reference', _ref: 'team-prime' }, subteam: { _type: 'reference', _ref: 'subteam-build' }, status: 'on-track', show: true });
  assert.deepEqual(documents['milestone-monday-2002'].set, { name: 'Kickoff', targetDate: '2027-01-09', status: 'not-started', show: true }, 'Both Teams and All Departments are empty');
  assert.equal(documents['milestone-monday-2003'].set.status, 'at-risk');
  assert.equal(refOf(documents['milestone-monday-2003'].set.team), 'team-nova');
  assert.equal(documents['milestone-monday-2004'].set.status, 'done');
  assert.equal(refOf(documents['milestone-monday-2004'].set.subteam), 'subteam-design');
  assert.ok(!documents['milestone-monday-2005'] && !documents['milestone-monday-2006'] && !documents['milestone-monday-2007']);
  assert.equal(JSON.stringify(place.writes()).includes('EXAMPLE'), false);
});

test('a milestone that is gone, or has lost its date, is switched off and never deleted; one that is up to date is left alone', () => {
  const first = setup('milestones-first', { tools: true });
  world(first);
  first.run();
  const stored = storedFrom(first);
  const gone = stored.milestones.concat([{ _id: 'milestone-monday-2099', name: 'Vanished', targetDate: '2026-12-31', show: true }, { _id: 'milestone-monday-2006', name: 'No date yet', targetDate: '2026-12-01', show: true }]);

  const place = setup('milestones-second', { tools: true });
  world(place, { milestones: gone, tasks: stored.tasks, known: laterRead });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(place.taskMutations(), [
    { patch: { id: 'milestone-monday-2099', set: { show: false } } },
    { patch: { id: 'milestone-monday-2006', set: { show: false } } },
  ]);
  assert.ok(!JSON.stringify(place.writes()).includes('delete'));
});

test('a task that is up to date is not touched, Show on TV is never sent, and an item that gone is switched off, never deleted', () => {
  const first = setup('uptodate-first', { tools: true });
  world(first);
  first.run();
  const stored = storedFrom(first);

  const same = setup('uptodate', { tools: true });
  world(same, { tasks: stored.tasks, milestones: stored.milestones, known: laterRead });
  const result = same.run();
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(same.taskMutations(), [], 'nothing is written for tasks that did not change');
  assert.ok(result.text.includes('monday: 9 task(s) wanted, 0 new, 0 changed, 0 switched off, 4 milestone(s)'), result.text);
  assert.ok(!JSON.stringify(first.writes()).includes('showOnTv'), 'the editor switch is never sent');

  // one task changed on the board, one is gone, and one that was switched off comes back
  const changed = stored.tasks.map(task => (task._id === 'task-monday-1001' ? Object.assign({}, task, { status: 'up-next' }) : task));
  const withGone = changed.concat([{ _id: 'task-monday-3000', title: 'Gone', show: true, source: 'monday' }, { _id: 'task-monday-3001', title: 'Gone already', show: false, source: 'monday' }]);
  withGone[withGone.findIndex(task => task._id === 'task-monday-1002')].show = false;
  const second = setup('uptodate-changes', { tools: true });
  world(second, { tasks: withGone, milestones: stored.milestones, known: laterRead });
  second.run();
  const mutations = second.taskMutations();
  const ids = mutations.map(mutation => mutation.patch.id).sort();
  assert.deepEqual(ids, ['task-monday-1001', 'task-monday-1002', 'task-monday-3000']);
  assert.equal(mutations.find(mutation => mutation.patch.id === 'task-monday-1001').patch.set.status, 'in-progress');
  assert.equal(mutations.find(mutation => mutation.patch.id === 'task-monday-1002').patch.set.show, true);
  assert.deepEqual(mutations.find(mutation => mutation.patch.id === 'task-monday-3000').patch, { id: 'task-monday-3000', set: { show: false } });
  mutations.forEach(mutation => assert.ok(!mutation.delete && !mutation.createOrReplace));
});

test('a task from the older boards, made before the rebuilt workspace, is switched off once and then left alone', () => {
  const place = setup('old-board-tasks', { tools: true });
  world(place, { tasks: [{ _id: 'task-monday-555', title: 'From an old board', show: true, source: 'monday', mondayBoardId: '111' }], known: laterRead });
  place.run();
  assert.ok(place.taskMutations().some(mutation => mutation.patch && mutation.patch.id === 'task-monday-555' && mutation.patch.set.show === false));
});

function manyItems(count, first) {
  const many = [];
  for (let number = 0; number < count; number += 1) many.push(item(String(first + number), 'Task ' + number, [col.department('Build', 1)]));
  return many;
}

test('at most four requests go to Monday in a run: a board of 800 items is read to its end in four pages, and more is said and switches nothing off', () => {
  const fits = setup('four-pages', { tools: true });
  world(fits, { items: manyItems(800, 10000), tasks: [{ _id: 'task-monday-3000', title: 'Elsewhere', show: true, source: 'monday' }], known: laterRead });
  const done = fits.run();
  assert.deepEqual(requestsOf(done.calls).filter(line => line.startsWith('monday ')), ['monday items-' + taskBoardId, 'monday more-cursor' + taskBoardId + 'n1', 'monday more-cursor' + taskBoardId + 'n2', 'monday more-cursor' + taskBoardId + 'n3']);
  assert.ok(fits.taskMutations().some(mutation => mutation.patch && mutation.patch.id === 'task-monday-3000'), 'the board was read to its end, so a task that is not on it is switched off');
  assert.equal(statusOf(fits).set.callsToday, 10);

  const over = setup('five-pages', { tools: true });
  world(over, { items: manyItems(850, 10000), tasks: [{ _id: 'task-monday-3000', title: 'Elsewhere', show: true, source: 'monday' }], known: laterRead });
  const capped = over.run();
  assert.equal(requestsOf(capped.calls).filter(line => line.startsWith('monday ')).length, 4, 'four requests and no more');
  assert.ok(capped.errors.includes('This run stopped after 4 requests to Monday and goes on at the next run.'), capped.errors);
  assert.ok(!over.taskMutations().some(mutation => mutation.patch && mutation.patch.id === 'task-monday-3000'), 'nothing is switched off');
  assert.ok(!('snapshots' in statusOf(over).set), 'no count of a board that was not read');
  assert.ok(!('lastSyncAt' in statusOf(over).set));
  assert.equal(statusOf(over).set.callsToday, 10, 'the reads still count');

  // the list of boards is one of the four on the first read of a day
  const first = setup('capped-first', { tools: true });
  world(first, { items: manyItems(650, 10000) });
  const second = first.run();
  assert.deepEqual(requestsOf(second.calls).filter(line => line.startsWith('monday ')), ['monday boards', 'monday items-' + taskBoardId, 'monday more-cursor' + taskBoardId + 'n1', 'monday more-cursor' + taskBoardId + 'n2']);
  assert.equal(statusOf(first).set.callsToday, 4);
  assert.deepEqual(statusOf(first).set.readings.map(entry => entry.boardId), [taskBoardId, milestoneBoardId]);
  const readings = statusOf(first).set.readings;
  assert.match(readings[0].note, /stopped after 4 requests/);
  assert.match(readings[1].note, /stopped before it read this board/);
  readings.forEach(entry => assert.ok(!entry.readAt, 'a board that was not read to its end keeps the time of the run before'));
});

// How old the last read is, as a moment before the clock of the test
function readAgo(seconds) {
  const moment = new Date(Date.parse(nowText) - seconds * 1000).toISOString().replace('.000Z', 'Z');
  return Object.assign({}, laterRead, { lastSyncAt: moment });
}

test('how often: a run before the setting says so ends without a word, without asking Monday and without a write; a run after it reads', () => {
  const cases = [
    // [every setting, seconds since the last read, whether the run reads]
    [30, 600, false],
    [30, 1700, false],
    [30, 1720, true],
    [30, 3600, true],
    [5, 200, false],
    [5, 215, true],
    [120, 7000, false],
    [120, 7120, true],
    [null, 1700, false],
    [null, 1720, true],
    [3, 1700, false],
    [200, 1700, false],
    [200, 1720, true],
    [7.5, 300, false],
    [7.5, 360, true],
  ];
  cases.forEach(entry => {
    const place = setup('gate-' + entry.join('-'), { tools: true });
    world(place, { every: entry[0], known: readAgo(entry[1]) });
    const result = place.run();
    const label = 'every ' + entry[0] + ', ' + entry[1] + ' seconds ago';
    assert.equal(result.status, 0, label);
    assert.equal(result.text + result.errors, entry[2] ? result.text + result.errors : '', label);
    if (entry[2]) {
      assert.ok(requestsOf(result.calls).includes('monday items-' + taskBoardId), label);
    } else {
      assert.deepEqual(requestsOf(result.calls), ['sanity-query'], label);
      assert.equal(place.writes().length, 0, label);
    }
  });
});

test('how often: the first run ever, a last read in the future, and a last read that is not a time all read', () => {
  [null, '2027-01-12T16:00:00Z', 'yesterday', '2027-01-12T14:00:00.123Z'].forEach((moment, index) => {
    const place = setup('gate-odd-' + index, { tools: true });
    world(place, { known: Object.assign({}, laterRead, { lastSyncAt: moment }) });
    assert.ok(requestsOf(place.run().calls).includes('monday items-' + taskBoardId), String(moment));
  });
});

test('how often: the setting is read from Sanity on every run, so a change needs no new timer', () => {
  const slow = setup('every-slow', { tools: true });
  world(slow, { every: 60, known: readAgo(1800) });
  assert.deepEqual(requestsOf(slow.run().calls), ['sanity-query']);
  const fast = setup('every-fast', { tools: true });
  world(fast, { every: 5, known: readAgo(1800) });
  assert.ok(requestsOf(fast.run().calls).includes('monday items-' + taskBoardId));
});

test('the daily budget: reads are counted for the day of the screen, and at 900 the run waits for midnight and says so', () => {
  const place = setup('budget', { tools: true });
  world(place, { known: Object.assign({}, laterRead, { callsToday: 899 }) });
  const result = place.run();
  assert.equal(statusOf(place).set.callsToday, 901, 'a run that starts under the limit finishes');
  assert.ok(requestsOf(result.calls).includes('monday items-' + taskBoardId));

  const full = setup('budget-full', { tools: true });
  world(full, { known: Object.assign({}, laterRead, { callsToday: 901, lastError: null }) });
  const stopped = full.run();
  assert.equal(stopped.status, 0, stopped.errors);
  assert.deepEqual(requestsOf(stopped.calls), ['sanity-query', 'sanity-write']);
  assert.deepEqual(full.writes()[0].mutations[1].patch.set, { lastError: 'Daily read limit reached; reads resume at midnight.', callsToday: 901, callsDate: todayText });
  assert.ok(!full.writes()[0].mutations[1].patch.set.lastSyncAt, 'the screen is not told it is up to date');
  assert.ok(stopped.text.includes('Daily read limit reached; reads resume at midnight.'));

  const exactly = setup('budget-exactly', { tools: true });
  world(exactly, { known: Object.assign({}, laterRead, { callsToday: 900 }) });
  assert.deepEqual(requestsOf(exactly.run().calls), ['sanity-query', 'sanity-write']);

  const midnight = setup('budget-next-day', { tools: true });
  world(midnight, { known: Object.assign({}, laterRead, { callsToday: 950, callsDate: '2027-01-11' }) });
  const next = midnight.run();
  assert.ok(requestsOf(next.calls).includes('monday boards'), 'a new day starts with the list of boards');
  assert.equal(statusOf(midnight).set.callsToday, 3);
  assert.equal(statusOf(midnight).set.callsDate, todayText);
});

test('the day is the day in the time zone of the screen, not in UTC', () => {
  const place = setup('zone', { tools: true });
  world(place, { zone: 'Pacific/Auckland' });
  const result = place.run();
  assert.ok(result.calls.includes('date TZ=Pacific/Auckland +%Y-%m-%d'), result.calls);
  const odd = setup('zone-odd', { tools: true });
  world(odd, { zone: 'Not/A zone; rm' });
  assert.ok(odd.run().calls.includes('date TZ=America/New_York +%Y-%m-%d'));
});

test('monday-status: the first name of the account, the boards with their columns, when, how many tasks and how many were hidden, the reads, and nothing that is empty', () => {
  const place = setup('status', { tools: true });
  world(place);
  place.run();
  const patch = statusOf(place);

  assert.deepEqual(Object.keys(patch.set).sort(), ['boards', 'callsDate', 'callsToday', 'connectedAs', 'hiddenUnassigned', 'lastSyncAt', 'readings', 'snapshots', 'taskCount']);
  assert.equal(patch.set.connectedAs, 'Jordan');
  assert.equal(patch.set.lastSyncAt, nowText);
  assert.equal(patch.set.taskCount, 9);
  assert.equal(patch.set.hiddenUnassigned, 1);
  assert.equal(patch.set.callsToday, 3);
  assert.equal(patch.set.callsDate, todayText);
  assert.deepEqual(patch.set.boards.map(board => board.id), [taskBoardId, milestoneBoardId], 'a board that is not a board, like the board of subitems, is not offered');
  assert.deepEqual(patch.unset, ['lastError']);
  assert.deepEqual(patch.set.readings.map(entry => [entry.boardId, entry.boardName, entry.itemsRead]), [[taskBoardId, 'Robotics Tasks', 10], [milestoneBoardId, 'Milestones', 7]]);
});

test('the count of open tasks is kept once a day, a second run on the same day replaces the day, and 120 entries are kept', () => {
  const place = setup('snapshots', { tools: true });
  world(place, { snapshots: [{ date: '2027-01-12', open: 99 }, { date: '2027-01-11', open: 12 }, { date: 'not a day', open: 1 }, { date: '2027-01-10', open: 'many' }] });
  place.run();
  const snapshots = statusOf(place).set.snapshots;
  assert.deepEqual(snapshots.map(entry => [entry.date, entry.open]), [['2027-01-11', 12], ['2027-01-12', 7]], 'open tasks that a person could see: not done, and not hidden');

  const long = setup('snapshots-long', { tools: true });
  const earlier = [];
  for (let day = 0; day < 130; day += 1) earlier.push({ date: new Date(Date.UTC(2026, 8, 1 + day)).toISOString().slice(0, 10), open: day });
  world(long, { snapshots: earlier });
  long.run();
  const kept = statusOf(long).set.snapshots;
  assert.equal(kept.length, 120);
  assert.equal(kept[119].date, todayText);
  assert.ok(kept[0].date > earlier[0].date, 'the oldest go first');
});

test('a refused token stops the run at once, says what to check, and never says the token', () => {
  [401, 403].forEach(code => {
    const place = setup('refused-' + code, { tools: true });
    world(place);
    place.answer('boards', { error_message: 'Not Authenticated' }, { code: code });
    const result = place.run();

    assert.equal(result.status, 1);
    assert.deepEqual(requestsOf(result.calls), ['sanity-query', 'monday boards', 'sanity-write']);
    const set = statusOf(place).set;
    assert.equal(set.lastError, 'Monday refused the token. Check MONDAY_API_TOKEN in local.env.');
    assert.equal(set.callsToday, 1, 'the request counts');
    assert.ok(!('lastSyncAt' in set));
    assert.ok(!requestsOf(result.calls).includes('status-write monday'));
    assert.ok(!(result.text + result.errors + result.calls).includes(mondayToken));
  });
});

test('too many requests from Monday stops the run and says it carries on later', () => {
  const place = setup('limit', { tools: true });
  world(place, { known: laterRead });
  place.answer('items-' + taskBoardId, { error_message: 'Rate limit' }, { code: 429 });
  const result = place.run();
  assert.equal(result.status, 1);
  assert.deepEqual(requestsOf(result.calls).filter(line => line.startsWith('monday ')), ['monday items-' + taskBoardId], 'the milestones board is not asked');
  assert.equal(statusOf(place).set.lastError, 'Monday says there were too many requests, so this run stopped. It goes on at the next run.');
  assert.equal(place.taskMutations().length, 0);
});

test('Monday not answering, or sending something that is not data, or a GraphQL error, is recorded in plain characters and the run does not touch a task', () => {
  const offline = setup('offline', { tools: true });
  world(offline, { known: laterRead, tasks: [{ _id: 'task-monday-3000', title: 'Elsewhere', show: true, source: 'monday' }] });
  offline.answer('items-' + taskBoardId, undefined, { exit: 6 });
  const first = offline.run();
  assert.equal(first.status, 1);
  assert.match(statusOf(offline).set.lastError, /Monday did not answer, could not find the server/);
  assert.ok(!offline.taskMutations().some(mutation => mutation.patch && mutation.patch.id.startsWith('task-')), 'a task is not switched off by a read that did not happen');

  const notData = setup('not-data', { tools: true });
  world(notData, { known: laterRead });
  fs.writeFileSync(path.join(notData.stub, 'monday', 'items-' + taskBoardId + '.json'), '<html>bad gateway</html>');
  notData.run();
  assert.match(statusOf(notData).set.lastError, /Monday sent an answer that is not data/);

  const oddError = setup('graphql', { tools: true });
  world(oddError, { known: laterRead });
  oddError.answer('items-' + taskBoardId, { errors: [{ message: 'Field "x" <not> `known` $(rm -rf) "quoted"\nnew line' }] });
  oddError.run();
  const said = statusOf(oddError).set.lastError;
  assert.equal(said, 'Monday said: Field x not known (rm -rf) quoted new line');
  assert.ok(!/[`$<>"\n]/.test(said));

  const older = setup('older-error', { tools: true });
  world(older, { known: laterRead });
  older.answer('items-' + taskBoardId, { error_message: 'Complexity budget exhausted' });
  older.run();
  assert.equal(statusOf(older).set.lastError, 'Monday said: Complexity budget exhausted');
});

test('the milestones board failing keeps the tasks: they are written and the time is told, and the error is kept', () => {
  const place = setup('milestones-fail', { tools: true });
  world(place, { known: laterRead, milestones: [{ _id: 'milestone-monday-2001', name: 'First robot test', targetDate: '2026-12-01', show: true }] });
  place.answer('items-' + milestoneBoardId, { errors: [{ message: 'Board not found' }] });
  const result = place.run();
  assert.equal(result.status, 1);
  assert.ok(Object.keys(documentsOf(place)).filter(id => id.startsWith('task-')).length > 0);
  assert.equal(documentsOf(place)['milestone-monday-2001'], undefined, 'a milestone is not switched off by a read that did not happen');
  assert.equal(statusOf(place).set.lastSyncAt, nowText);
  assert.match(statusOf(place).set.lastError, /Board not found/);
  assert.ok(requestsOf(result.calls).includes('status-write monday'));
});

test('a board the account cannot see gives a plain message, and the other board goes on', () => {
  const place = setup('no-board', { tools: true });
  world(place, { known: laterRead });
  place.answer('items-' + taskBoardId, { data: { boards: [] } });
  const result = place.run();
  assert.ok(result.errors.includes('Monday gave no items for board ' + taskBoardId + ', so the account of the token may not be able to see it.'), result.errors);
  assert.ok(requestsOf(result.calls).includes('monday items-' + milestoneBoardId));
  assert.equal(place.taskMutations().filter(mutation => mutation.patch && mutation.patch.id.startsWith('task-')).length, 0);
});

test('Sanity refusing a write is recorded, stops the writes, and nothing is switched off by a run that did not finish', () => {
  const place = setup('sanity-refuses', { tools: true });
  world(place, { known: laterRead });
  fs.writeFileSync(path.join(place.stub, 'mutate.exit'), '22');
  const result = place.run();
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('Could not write to Sanity, Sanity refused it'), result.errors);
  assert.ok(!requestsOf(result.calls).includes('status-write monday'));
});

test('when Sanity cannot be asked or gives no answer the run stops and nothing is changed', () => {
  const down = setup('sanity-down', { tools: true });
  world(down);
  fs.writeFileSync(path.join(down.stub, 'sanity.exit'), '6');
  const first = down.run();
  assert.equal(first.status, 1);
  assert.ok(first.errors.includes('Could not get the settings from Sanity. Nothing was changed.'), first.errors);
  assert.deepEqual(requestsOf(first.calls), ['sanity-query']);

  const empty = setup('sanity-empty', { tools: true });
  world(empty);
  fs.writeFileSync(path.join(empty.stub, 'sanity.json'), JSON.stringify({ result: null }));
  assert.equal(empty.run().status, 1);
});

test('text from Monday never reaches the shell or breaks the JSON: quotes, dollar signs, backticks, newlines and control characters are made safe', () => {
  const place = setup('hostile', { tools: true });
  world(place, {
    owners: true,
    items: [item('1', 'Say "hi" $(touch x) `id`\tnow', [col.department('Build', 1), col.poc('O\'Neil\u0007 Sam'), col.assigned('Zoë Ray, "Quote" Mark')])],
    milestoneItems: [item('2', 'Name with \\ and "quotes" $HOME', [value('date_mm83y6zw', 'date', '2027-01-09', { date: '2027-01-09' })])],
  });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  const set = documentsOf(place)['task-monday-1'].set;
  assert.equal(set.title, 'Say "hi" $(touch x) `id` now'.slice(0, 22));
  assert.equal(set.contact, "O'Neil");
  assert.deepEqual(set.owners, ['Zoë', 'Quote']);
  assert.ok(!fs.existsSync(path.join(place.root, 'x')));
  assert.equal(documentsOf(place)['milestone-monday-2'].set.name, 'Name with \\ and "quotes" $HOME');
});

test('answers of an odd shape do not stop the run: missing names, values and columns, numbers for texts, an account with no name', () => {
  const place = setup('odd', { tools: true });
  world(place, {
    items: [
      { id: '1', name: 'No values at all', parent_item: null },
      { id: '2', name: 'Null values', column_values: null },
      item('3', 'Odd values', [{ id: 'color_mm82nvea', type: 'status', text: 5, label: 7, index: '1' }, { id: 'timerange_mkyp8kx7', text: null, from: 5, to: {} }, null, 'nothing']),
      { id: 4, name: 'Number id', column_values: [col.department('Build', 1)] },
      { id: '5', name: '', column_values: [col.department('Build', 1)] },
      { id: 'x y', name: 'Bad id', column_values: [col.department('Build', 1)] },
    ],
  });
  place.answer('boards', { data: { me: null, boards: [{ id: 5, name: null, type: 'board', columns: null }, 'text', null] } });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  const ids = Object.keys(documentsOf(place)).filter(id => id.startsWith('task-')).sort();
  assert.deepEqual(ids, ['task-monday-1', 'task-monday-2', 'task-monday-3', 'task-monday-4'], 'an item with no usable id or no name is left out');
  ['1', '2', '3'].forEach(id => assert.equal(documentsOf(place)['task-monday-' + id].set.hiddenReason, 'unassigned', 'a department that cannot be read is no department'));
  assert.equal(documentsOf(place)['task-monday-4'].set.hiddenReason, undefined);
});

test('the token of Monday and the token of Sanity are never printed, never in an argument of curl, never written to a file or a document, and the other secrets are never read', () => {
  const place = setup('secrets', { tools: true });
  world(place);
  const result = place.run();

  [mondayToken, writeToken, secret, 'SECRET-FEED-TOKEN'].forEach(value => {
    assert.ok(!result.text.includes(value), 'standard output has ' + value);
    assert.ok(!result.errors.includes(value), 'standard error has ' + value);
    assert.ok(!result.calls.includes(value), 'an argument of a call has ' + value);
    assert.ok(!JSON.stringify(place.writes()).includes(value), 'a document has ' + value);
    filesUnder(place.data).forEach(file => assert.ok(!fs.readFileSync(file, 'utf8').includes(value), file + ' has ' + value));
  });
  const configs = place.configs();
  assert.ok(configs.includes('header = "Authorization: ' + mondayToken + '"'), 'Monday gets the token in a header on standard input');
  assert.ok(configs.includes('header = "Authorization: Bearer ' + writeToken + '"'), 'Sanity gets the write token in a header on standard input');
  assert.ok(!configs.includes('SECRET-FEED-TOKEN'), 'the calendar address is never read');
  assert.deepEqual(fs.readdirSync(place.temp), [], 'no work folder is left');

  const failing = setup('secrets-failing', { tools: true });
  world(failing);
  failing.answer('boards', { error_message: 'Not Authenticated' }, { code: 401 });
  const refused = failing.run();
  [mondayToken, writeToken].forEach(value => {
    assert.ok(!(refused.text + refused.errors + refused.calls + JSON.stringify(failing.writes())).includes(value), 'a failed run has ' + value);
  });
});

test('without the token of Monday, or the token of Sanity, or with the placeholder, the run says so in one line, asks for nothing and ends without an error', () => {
  const cases = [
    ['no-env', { noEnv: true }, 'MONDAY_API_TOKEN'],
    ['no-monday', { env: "TELETRAAN_DATA='<data>'\nSANITY_WRITE_TOKEN='" + writeToken + "'\n" }, 'MONDAY_API_TOKEN'],
    ['placeholder', { env: "TELETRAAN_DATA='<data>'\nMONDAY_API_TOKEN='[paste the Monday token here]'\nSANITY_WRITE_TOKEN='" + writeToken + "'\n" }, 'MONDAY_API_TOKEN'],
    ['no-sanity', { env: "TELETRAAN_DATA='<data>'\nMONDAY_API_TOKEN='" + mondayToken + "'\n" }, 'SANITY_WRITE_TOKEN'],
    ['sanity-placeholder', { env: "TELETRAAN_DATA='<data>'\nMONDAY_API_TOKEN='" + mondayToken + "'\nSANITY_WRITE_TOKEN='[paste the Sanity write token here]'\n" }, 'SANITY_WRITE_TOKEN'],
  ];
  cases.forEach(item => {
    const place = setup('not-set-up-' + item[0], Object.assign({ tools: true }, item[1]));
    world(place);
    const result = place.run();

    assert.equal(result.status, 0, item[0]);
    assert.equal(result.text.trim(), item[2] + ' is not in local.env yet, so nothing was read. See docs/monday.md.', item[0]);
    assert.equal(result.errors, '', item[0]);
    assert.equal(requestsOf(result.calls).length, 0, item[0]);
    assert.ok(!fs.existsSync(place.folder), item[0]);
  });

  const odd = setup('odd-token', { tools: true, env: "TELETRAAN_DATA='<data>'\nMONDAY_API_TOKEN='has a space \"'\nSANITY_WRITE_TOKEN='" + writeToken + "'\n" });
  world(odd);
  const result = odd.run();
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('MONDAY_API_TOKEN in local.env does not look like a token'), result.errors);
  assert.ok(!result.errors.includes('has a space'), 'the odd value is not repeated');
  assert.equal(requestsOf(result.calls).length, 0);
});

test('--check asks Monday one question and writes nothing: OK for a token that works, FAIL with the reason when it does not', () => {
  const good = setup('check-good', { tools: true });
  world(good);
  const result = good.run(['--check']);
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(result.text.trim().split('\n'), ['OK    Monday accepts the token (connected as Jordan)', 'OK    SANITY_WRITE_TOKEN is in local.env']);
  assert.deepEqual(requestsOf(result.calls), ['monday me']);
  assert.equal(good.writes().length, 0);
  assert.ok(!fs.existsSync(good.folder), 'the data folder is not touched');

  const refused = setup('check-refused', { tools: true });
  world(refused);
  refused.answer('me', { error_message: 'Not Authenticated' }, { code: 401 });
  const second = refused.run(['--check']);
  assert.equal(second.status, 1);
  assert.ok(second.text.includes('FAIL  Monday refused the token. Check MONDAY_API_TOKEN in local.env.'), second.text);

  const missing = setup('check-missing', { tools: true, noEnv: true });
  world(missing);
  const third = missing.run(['--check']);
  assert.equal(third.status, 1);
  assert.ok(third.text.includes('FAIL  MONDAY_API_TOKEN is not in local.env') && third.text.includes('FAIL  SANITY_WRITE_TOKEN is not in local.env'), third.text);
  assert.equal(requestsOf(third.calls).length, 0);
});

test('a word the script does not know, or two, prints how to use it and changes nothing', () => {
  const place = setup('usage', { tools: true });
  world(place);
  [['--now'], ['--check', '--check'], ['check']].forEach(args => {
    const result = place.run(args);
    assert.equal(result.status, 1, args.join(' '));
    assert.ok(result.errors.includes('Usage:'), result.errors);
  });
  assert.equal(fs.readFileSync(place.log, 'utf8'), '');
  assert.ok(!fs.existsSync(place.folder));
});

test('without curl or jq the script prints the apt line and stops', () => {
  const place = setup('no-curl', { tools: false });
  const result = place.run();
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('The curl command is missing'), result.errors);
  assert.ok(result.errors.includes('  sudo apt install curl jq\n'));
  assert.ok(!fs.existsSync(place.folder));
});

test('with no data folder the script stops with a plain line and asks Monday for nothing', () => {
  const place = setup('no-data', { tools: true, noData: true });
  world(place);
  const result = place.run();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('The data folder ' + path.join(place.root, 'data') + ' does not exist'), result.errors);
  assert.equal(requestsOf(result.calls).length, 0);
});

test('a run that finds the lock taken stops at once and changes nothing', () => {
  const place = setup('locked', { tools: true });
  world(place);
  const result = place.run([], { STUB_LOCKED: 'yes' });

  assert.equal(result.status, 0);
  assert.ok(result.text.includes('still going'), result.text);
  assert.ok(result.calls.includes('flock -n 9'), 'the lock is asked for without waiting');
  assert.equal(requestsOf(result.calls).length, 0);
  assert.deepEqual(fs.readdirSync(place.folder), ['.lock']);
});

test('the work folder is removed after every run, and one a stopped run left behind is cleaned up', () => {
  const place = setup('leftovers', { tools: true });
  world(place);
  fs.mkdirSync(path.join(place.folder, '.work.interrupted'), { recursive: true });
  place.run();
  assert.deepEqual(fs.readdirSync(place.folder).sort(), ['.lock']);
  assert.deepEqual(fs.readdirSync(place.temp), []);
});

test('the script also works under bash, with the same requests and the same documents', () => {
  if (!fs.existsSync('/bin/bash')) return;
  const reference = setup('bash-reference', { tools: true });
  world(reference, { owners: true });
  reference.run();

  const place = setup('bash', { tools: true });
  world(place, { owners: true });
  const result = place.run([], {}, '/bin/bash');

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(requestsOf(result.calls), firstSequence);
  assert.deepEqual(place.writes(), reference.writes());
});

test('the scripts have valid sh syntax, are executable, and local.env and the secrets are never printed', () => {
  [syncFile, installFile].forEach(file => {
    const syntax = spawnSync('/bin/sh', ['-n', file], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
    if (fs.existsSync('/bin/dash')) {
      const dash = spawnSync('/bin/dash', ['-n', file], { encoding: 'utf8' });
      assert.equal(dash.status, 0, dash.stderr);
    }

    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith('#!/bin/bash\n'));
    assert.ok(/^set -euo pipefail$/m.test(text), 'the script stops at the first error');
    assert.ok((fs.statSync(file).mode & 0o111) !== 0, path.basename(file) + ' should be executable');
    assert.ok(!/\bcat\b[^\n]*local\.env/.test(text), 'local.env is never printed');
    assert.ok(!/\beval\b/.test(text), 'nothing is run from text');
    assert.ok(!/CALENDAR_|TBA_/.test(text), 'the other secrets are not read');
  });

  const text = textOf(syncFile);
  assert.ok(!/\becho\b[^\n]*\$(monday_token|write_token)/.test(text), 'a secret is never echoed');
  assert.ok(!/\bprintf\b[^\n]*\$(monday_token|write_token)[^\n]*>&2/.test(text), 'a secret is never printed as an error');
  assert.ok(!/--header[^\n]*(Authorization)|-H [^\n]*(Authorization)/.test(text), 'a secret is not an argument of curl');
  assert.ok(!/set -x|--verbose|--trace/.test(text), 'curl and the shell do not trace what they send');
  text.split('\n').filter(line => line.includes('$monday_token') || line.includes('$write_token')).forEach(line => {
    const handed = line.includes("printf 'header = \"Authorization: %s\"\\n' \"$monday_token\"") || line.includes("printf 'header = \"Authorization: Bearer %s\"\\n' \"$write_token\"");
    const checked = /^\s*(case \$(monday_token|write_token) in|looks_like_key (MONDAY_API_TOKEN|SANITY_WRITE_TOKEN) "\$(monday_token|write_token)")$/.test(line);
    assert.ok(handed || checked, 'a token is only checked or handed to curl on standard input: ' + line);
  });
  assert.ok(!/\$\(([^)]*)\)\s*\|\s*sh\b/.test(text), 'nothing is piped into a shell');
});

test('every address, version, question and place in an answer is in the block at the top, and nowhere else', () => {
  const text = textOf(syncFile);
  const start = text.indexOf("monday_address='");
  const end = text.indexOf("\n'\n", start) + 3;
  const block = text.slice(start, end);
  const rest = text.slice(0, start) + text.slice(end);

  assert.equal(text.split('api.monday.com').length, 2, 'one address in the whole script');
  assert.ok(block.includes("monday_address='https://api.monday.com/v2'"));
  assert.ok(block.includes("monday_version='2025-07'"));
  ['monday_query_me=', 'monday_query_boards=', 'monday_query_items=', 'monday_query_more='].forEach(name => {
    assert.equal(text.split(name).length, 2, name + ' is written once');
    assert.ok(block.includes(name), name);
  });
  ['items_page', 'next_items_page', 'items_count', 'column_values', 'parent_item', 'linked_item_ids'].forEach(word => {
    assert.ok(block.includes(word), 'the block has ' + word);
    assert.ok(!rest.includes(word), 'the rest of the script does not have ' + word);
  });
  ['.data.me.name', '.data.boards', '.items_count', '.column_values', '.data.next_items_page', '.cursor', '.errors[]?.message', '.error_message', '.parent_item.id', '.linked_item_ids'].forEach(place => {
    assert.ok(block.includes(place), 'the block has ' + place);
    assert.ok(!rest.includes(place), 'the rest of the script does not have ' + place);
  });
});

test('the limits of the script are the limits of the Studio fields and the contract: a title of 22, a first name of 12, a milestone name of 40, four requests, 900 reads a day, 120 snapshots', () => {
  const text = textOf(syncFile);
  const task = fs.readFileSync(path.join(repo, 'studio/schemas/task.js'), 'utf8');
  const milestone = fs.readFileSync(path.join(repo, 'studio/schemas/milestone.js'), 'utf8');

  assert.ok(text.includes('\ntitle_limit=22\n') && task.includes("name: 'title'") && /tooLong\(Rule, 22\)/.test(task), 'the title');
  assert.ok(text.includes('\ncontact_limit=12\n') && /name: 'contact'[\s\S]*?tooLong\(Rule, 12\)/.test(task), 'the contact');
  assert.ok(text.includes('\nmilestone_limit=40\n') && /name: 'name'[\s\S]*?tooLong\(Rule, 40\)/.test(milestone), 'the milestone name');
  assert.ok(text.includes('\nmax_requests=4\n'));
  assert.ok(text.includes('\npage_size=200\n'));
  assert.ok(text.includes('\ndaily_limit=900\n'));
  assert.ok(text.includes('\nsnapshots_kept=120\n'));
});

test('the starting values of the script are the starting values of Dashboard Settings: the same boards, columns, indexes and every', async () => {
  const text = textOf(syncFile);
  const block = text.slice(text.indexOf("defaults='") + "defaults='".length, text.indexOf("\n}'\n", text.indexOf("defaults='")) + 2);
  const script = JSON.parse(block);
  const { defaultSettings } = await import(pathToFileURL(path.join(repo, 'dashboard/config.js')).href);

  // a team is its document id in the script, and a reference in the settings
  function plain(value) {
    return JSON.parse(JSON.stringify(value, (key, found) => (found && found._ref ? found._ref : found)));
  }
  assert.equal(defaultSettings.mondayEveryMinutes, script.every);
  assert.deepEqual(plain(defaultSettings.mondayTaskBoard), script.taskBoard);
  assert.deepEqual(plain(defaultSettings.mondayMilestoneBoard), script.milestoneBoard);
});

test('the unit files name the account ACCOUNT, run the script, and the timer wakes it 2 minutes after boot and every 5 minutes', () => {
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-monday.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-monday.timer'), 'utf8');

  assert.deepEqual(service.match(/^User=.*$/gm), ['User=ACCOUNT']);
  assert.ok(/^Type=oneshot$/m.test(service));
  assert.deepEqual(service.match(/^ExecStart=.*$/gm), ['ExecStart=/opt/teletraan/computer/scripts/monday-sync.sh']);
  assert.ok(!/^ExecStartPost=/m.test(service), 'the script tells status-mini itself, and only after a run that worked');
  assert.ok(fs.existsSync(syncFile), 'the script the unit runs exists');
  assert.ok(/^OnBootSec=2min$/m.test(timer));
  assert.ok(/^OnUnitActiveSec=5min$/m.test(timer));
  assert.ok(/^WantedBy=timers\.target$/m.test(timer));
  assert.ok(!/hawktimus/i.test(service + timer), 'no account name is written in the unit files');
  assert.ok(!/^OnCalendar=/m.test(timer), 'one timer, every 5 minutes after the last run');
  assert.ok(/every 5 minutes/.test(timer) && /Dashboard Settings/.test(timer), 'the timer says that the setting decides how often Monday is read');
  unitFiles.forEach(unit => assert.ok(fs.statSync(path.join(repo, 'computer/systemd', unit)).size > 100, unit + ' is not empty'));
});

test('the script tells status-mini through status-write.sh, which knows the job monday', () => {
  const status = fs.readFileSync(path.join(repo, 'computer/scripts/status-write.sh'), 'utf8');
  assert.ok(status.includes('monday) field=lastMondaySyncAt ;;'));
  assert.ok(textOf(syncFile).includes('"$computer/scripts/status-write.sh" monday || true'));
});

test('install-monday.sh stops, naming the file, when a unit file is missing or empty', () => {
  const missing = setup('install-missing', { tools: true, install: true });
  fs.rmSync(path.join(missing.root, 'computer/systemd/teletraan-monday.service'));
  const first = missing.install();
  assert.equal(first.status, 1);
  assert.ok(first.errors.includes('teletraan-monday.service is missing or empty'), first.errors);

  const empty = setup('install-empty', { tools: true, install: true });
  fs.writeFileSync(path.join(empty.root, 'computer/systemd/teletraan-monday.timer'), '');
  const second = empty.install();
  assert.equal(second.status, 1);
  assert.ok(second.errors.includes('teletraan-monday.timer is missing or empty'), second.errors);

  const noScript = setup('install-no-script', { tools: true, install: true });
  fs.chmodSync(path.join(noScript.root, 'computer/scripts/monday-sync.sh'), 0o644);
  const third = noScript.install();
  assert.equal(third.status, 1);
  assert.ok(third.errors.includes('monday-sync.sh is missing or cannot be run'), third.errors);

  [first, second, third].forEach(result => assert.ok(!result.calls.includes('systemctl'), 'nothing was changed'));
});

test('install-monday.sh prints the apt line when a package is missing, and never runs apt', () => {
  const place = setup('install-packages', { tools: false, install: true });
  const result = place.install();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('These packages are not installed: curl jq'), result.errors);
  assert.ok(result.errors.includes('  sudo apt install curl jq\n'));
  assert.ok(!result.calls.includes('apt') && !result.calls.includes('systemctl'), result.calls);
});

test('install-monday.sh with everything in place still needs sudo and the repository at /opt/teletraan before it changes anything', () => {
  const place = setup('install-checks', { tools: true, install: true });
  const plain = place.install({ STUB_UID: '1000' });
  assert.equal(plain.status, 1);
  assert.ok(plain.errors.includes('it has to run with sudo'), plain.errors);

  const root = place.install({ STUB_UID: '0' });
  assert.equal(root.status, 1);
  assert.ok(root.errors.includes('The unit files expect the repository at /opt/teletraan'), root.errors);
  assert.ok(!root.calls.includes('systemctl') && !root.calls.includes('apt'));
});

test('install-monday.sh copies the two monday units only, with ACCOUNT filled in, and writes no account name of its own', () => {
  const text = fs.readFileSync(installFile, 'utf8');
  assert.deepEqual(text.match(/teletraan-[a-z]+\.(service|timer)/g).filter((name, index, all) => all.indexOf(name) === index).sort(), ['teletraan-monday.service', 'teletraan-monday.timer']);
  assert.ok(text.includes('sed "s/^User=ACCOUNT\\$/User=$account/"'));
  assert.ok(!/hawktimus/.test(text.split('\n').filter(line => !line.includes('called hawktimus') && !line.includes('chown')).join('\n')), 'the account name is only in the hint');
  assert.ok(text.includes('systemctl enable --now teletraan-monday.timer') && text.includes('systemctl restart teletraan-monday.timer'));
  assert.ok(text.includes('(every 5 minutes)'), 'the installer says what the timer does');
  assert.ok(!/frc|slides|poppler/i.test(text), 'nothing is left of the other installers');
});

test('local.example.env has a MONDAY_API_TOKEN line with a placeholder', () => {
  const example = fs.readFileSync(path.join(repo, 'computer/local.example.env'), 'utf8');
  assert.ok(/^MONDAY_API_TOKEN='\[[^\n]*\]'$/m.test(example), 'a placeholder that starts with [');
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
