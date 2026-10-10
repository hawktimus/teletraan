// Tests for deploy/scripts/monday-sync.sh and deploy/scripts/install-monday.sh. The
// tools they use on the Mini (curl, date, flock, id, systemctl) are replaced with
// small fake ones in a temporary folder, so nothing touches the network or the
// machine. jq is the real one, because the scripts depend on what it does, so
// this test needs jq installed. The answers of Monday and Sanity are made up here,
// from the shape the public documentation of Monday gives. The boards, the items,
// the names, the token and the key are made up too.
//
//   node tools/test-monday-script.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const syncFile = path.join(repo, 'deploy/scripts/monday-sync.sh');
const installFile = path.join(repo, 'deploy/scripts/install-monday.sh');
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

// status-write.sh is tested in test-status-write.mjs. Here it only has to say it
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

// Makes a copy of the deploy folder and config.js to run in, a folder of tools
// to run with, and returns how to run the scripts.
function setup(name, options) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  const temp = path.join(root, 'tmp');
  fs.mkdirSync(path.join(root, 'deploy/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'deploy/systemd'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  [bin, stub, temp, path.join(stub, 'monday')].forEach(folder => fs.mkdirSync(folder));
  if (!options.noData) fs.mkdirSync(data);

  const scriptCopy = path.join(root, 'deploy/scripts/monday-sync.sh');
  let text = fs.readFileSync(syncFile, 'utf8');
  (options.edits || []).forEach(edit => {
    assert.ok(text.includes(edit[0]), 'the script has no ' + edit[0]);
    text = text.replace(edit[0], edit[1]);
  });
  fs.writeFileSync(scriptCopy, text, { mode: fs.statSync(syncFile).mode });
  const installCopy = path.join(root, 'deploy/scripts/install-monday.sh');
  fs.copyFileSync(installFile, installCopy);
  fs.chmodSync(installCopy, fs.statSync(installFile).mode);
  writeTool(path.join(root, 'deploy/scripts'), 'status-write.sh', fakeStatusWrite);
  unitFiles.forEach(unit => fs.copyFileSync(path.join(repo, 'deploy/systemd', unit), path.join(root, 'deploy/systemd', unit)));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));

  if (!options.noEnv) {
    const env = options.env !== undefined ? options.env : "TELETRAAN_DATA='" + data + "'\nMONDAY_API_TOKEN='" + mondayToken + "'\nSANITY_WRITE_TOKEN='" + writeToken + "'\nCALENDAR_TEAM_URL='" + secret + "'\n";
    fs.writeFileSync(path.join(root, 'deploy/local.env'), env.replace('<data>', data));
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
    pages(board, items, size) {
      const count = Math.max(1, Math.ceil(items.length / size));
      for (let index = 0; index < count; index += 1) {
        const cursor = index + 1 < count ? 'cursor' + board + 'n' + (index + 1) : null;
        const page = { cursor: cursor, items: items.slice(index * size, (index + 1) * size) };
        if (index === 0) this.answer('items-' + board, { data: { boards: [{ items_page: page }] } });
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

// The made-up world. The team board has columns for the status, the priority, the
// due date and the owner. It has six items: three that the screen shows with
// different statuses, one with a label that is none of the three, one in a group
// that no Team lead has, and one with a title that is too long.
const boardEntry = {
  boardId: '111',
  team: 'team-prime',
  statusColumn: 'status',
  backlogLabel: 'Backlog',
  progressLabel: 'Working on it',
  doneLabel: 'Done',
  priorityColumn: 'priority',
  priorityHigh: 'High',
  priorityMedium: 'Medium',
  priorityLow: 'Low',
  dueColumn: 'date4',
  ownerColumn: 'person',
  teamColumn: null,
};

function item(id, name, group, values) {
  return {
    id: id,
    name: name,
    group: { title: group },
    column_values: Object.keys(values).map(column => ({ id: column, text: values[column] })),
  };
}

function items111() {
  return [
    item('1001', 'Wire the robot', 'Build', { status: 'Backlog', priority: 'High', date4: '2027-01-20', person: 'Sam Lee' }),
    item('1002', 'Code the arm', 'Programming', { status: 'Working on it', priority: 'medium', date4: '2027-01-14 18:00', person: 'Pat Kim, Jo Ray' }),
    item('1003', 'Pick up parts', 'Build', { status: 'Done', priority: 'Low', date4: '', person: '' }),
    item('1004', 'Waiting on a part', 'Build', { status: 'Stuck', priority: '', date4: '', person: '' }),
    item('1005', 'Order the pizza', 'Food', { status: 'Backlog', priority: 'Critical', date4: '2027-02-30', person: 'sam@example.com' }),
    item('1006', 'Plan the whole season of outreach events', 'Build', { status: 'Working on it', priority: '', date4: '', person: 'Ana' }),
  ];
}

function boardsAnswer(extra) {
  const columns = [
    { id: 'name', title: 'Name', type: 'name' },
    { id: 'status', title: 'Status', type: 'status' },
    { id: 'priority', title: 'Priority', type: 'status' },
    { id: 'date4', title: 'Due', type: 'date' },
    { id: 'person', title: 'Owner', type: 'people' },
  ];
  return {
    data: {
      me: { name: 'Jordan Example' },
      boards: [
        { id: '111', name: '[Build board]', type: 'board', items_count: 6, columns: columns },
        { id: '222', name: '[Outreach board]', type: 'board', items_count: 3, columns: columns.slice(0, 2) },
        { id: '333', name: '[Sub items]', type: 'sub_items_board', items_count: 2, columns: columns.slice(0, 1) },
      ].concat(extra || []),
    },
    account_id: 1,
  };
}

// What the task of an item is when it is up to date, as Sanity gives it back to the script
function stored(id, fields) {
  const known = {
    1001: { title: 'Wire the robot', subteam: 'subteam-build', team: 'team-prime', status: 'up-next', priority: 'high', dueDate: '2027-01-20', contact: null, show: true },
    1002: { title: 'Code the arm', subteam: 'subteam-programming', team: 'team-prime', status: 'in-progress', priority: 'medium', dueDate: '2027-01-14', contact: null, show: true },
    1003: { title: 'Pick up parts', subteam: 'subteam-build', team: 'team-prime', status: 'done', priority: 'low', dueDate: null, contact: null, show: true },
    1005: { title: 'Order the pizza', subteam: 'subteam-unmatched', team: 'team-prime', status: 'up-next', priority: null, dueDate: null, contact: null, show: true },
    1006: { title: 'Plan the whole season', subteam: 'subteam-build', team: 'team-prime', status: 'in-progress', priority: null, dueDate: null, contact: null, show: true },
  };
  return Object.assign({ _id: 'task-monday-' + id }, known[id], fields || {});
}

// The Team leads of the made-up team. A lead may be written with capitals or spaces that the group is not.
const leads = [{ _id: 'subteam-build', name: 'Build' }, { _id: 'subteam-programming', name: ' programming ' }, { _id: 'subteam-electrical', name: 'Electrical' }];

function world(place, options) {
  const given = options || {};
  place.at('2027-01-12T15:00:00Z');
  place.sanity({
    zone: given.zone || 'America/New_York',
    owners: given.owners === true,
    boards: given.boards === undefined ? [boardEntry] : given.boards,
    teams: [{ _id: 'team-prime' }, { _id: 'team-nova' }],
    subteams: given.subteams || leads.concat(given.tasks ? [{ _id: 'subteam-unmatched', name: '[Unmatched]' }] : []),
    tasks: given.tasks || [],
    snapshots: given.snapshots === undefined ? null : given.snapshots,
  });
  place.answer('boards', boardsAnswer());
  place.answer('me', { data: { me: { name: 'Jordan Example' } } });
  place.pages('111', given.items || items111(), 100);
}

const firstSequence = [
  'sanity-query',
  'monday boards',
  'monday items-111',
  'sanity-write',
  'sanity-write',
  'status-write monday',
];

test('one board: the requests go in the order of the work, the tasks are written, then the status, then the time goes to status-mini', () => {
  const place = setup('sequence', { tools: true });
  world(place);
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.equal(result.errors, '');
  assert.deepEqual(requestsOf(result.calls), firstSequence);
  assert.ok(result.text.includes('monday: 1 board(s) chosen in Dashboard Settings'), result.text);
  assert.ok(result.text.includes('monday: 6 item(s) read'), result.text);
  assert.ok(result.text.includes('monday: 5 task(s) wanted, 5 new, 0 changed, 0 switched off'), result.text);
  assert.ok(result.text.includes('monday: status written'), result.text);
  assert.equal(place.writes().length, 2);
  assert.deepEqual(fs.readdirSync(place.folder).sort(), ['.lock']);
});

test('the requests go to the address and version of the block at the top, https only, with a time limit, and ask for the chosen columns only', () => {
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
  assert.equal(monday.length, 2);
  monday.forEach(line => {
    assert.ok(line.endsWith('https://api.monday.com/v2'), line);
    assert.ok(line.includes('--header API-Version: 2025-07'), line);
    assert.ok(line.includes('--header Content-Type: application/json'), line);
    assert.ok(line.includes('--config -'), 'the token comes in on standard input: ' + line);
  });
  assert.deepEqual(place.variables()[1], { board: ['111'], columns: ['date4', 'person', 'priority', 'status'], limit: 100 });
  assert.deepEqual(place.variables()[0], {});
});

test('Sanity is asked for the settings, the teams, the Team leads, the earlier tasks and the counts without a login, and the writes go to the project in config.js', () => {
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
  assert.ok(question.includes('mondayBoards') && question.includes('mondayShowOwners') && question.includes('source == "monday"'), question);
  assert.ok(question.includes('_type == "subteam"') && question.includes('_type == "team"') && question.includes('monday-status'), question);
  assert.ok(!question.includes('--config'), 'the dataset is public, so the question sends no login');

  const writes = result.calls.split('\n').filter(line => line.includes('/data/mutate/'));
  assert.equal(writes.length, 2);
  writes.forEach(write => {
    assert.ok(write.includes('--request POST') && write.includes('Content-Type: application/json') && write.includes('--fail'), write);
    assert.ok(write.includes('--config -'), 'the token comes in on standard input: ' + write);
  });
  const addresses = fs.readFileSync(path.join(place.stub, 'addresses.txt'), 'utf8').trim().split('\n');
  assert.deepEqual(addresses, ['https://' + project + '.api.sanity.io/v' + version + '/data/mutate/' + dataset, 'https://' + project + '.api.sanity.io/v' + version + '/data/mutate/' + dataset]);

  const script = fs.readFileSync(syncFile, 'utf8');
  [project, dataset, version].forEach(value => assert.ok(!script.includes(value), 'the script should not contain ' + value));
});

test('a board with the mapped statuses and priorities: Backlog, Working on it and Done become up-next, in-progress and done, and a label that is none of them is left out', () => {
  const place = setup('mapping', { tools: true });
  world(place);
  const result = place.run();
  assert.equal(result.status, 0, result.errors);

  const mutations = place.taskMutations();
  const made = mutations.filter(mutation => mutation.createIfNotExists && mutation.createIfNotExists._type === 'task').map(mutation => mutation.createIfNotExists);
  assert.deepEqual(made.map(doc => doc._id), ['task-monday-1001', 'task-monday-1002', 'task-monday-1003', 'task-monday-1005', 'task-monday-1006'], 'the Stuck item has no task');
  made.forEach(doc => assert.deepEqual(Object.keys(doc), ['_id', '_type', 'source', 'mondayId']));
  assert.equal(made[0].source, 'monday');
  assert.equal(made[0].mondayId, '1001');

  const patch = id => mutations.filter(mutation => mutation.patch && mutation.patch.id === id).map(mutation => mutation.patch)[0];
  const ref = id => ({ _type: 'reference', _ref: id });

  assert.deepEqual(patch('task-monday-1001'), {
    id: 'task-monday-1001',
    set: { title: 'Wire the robot', subteam: ref('subteam-build'), team: ref('team-prime'), status: 'up-next', show: true, priority: 'high', dueDate: '2027-01-20' },
    unset: ['contact'],
  });
  assert.deepEqual(patch('task-monday-1002').set, { title: 'Code the arm', subteam: ref('subteam-programming'), team: ref('team-prime'), status: 'in-progress', show: true, priority: 'medium', dueDate: '2027-01-14' });
  assert.deepEqual(patch('task-monday-1003').set, { title: 'Pick up parts', subteam: ref('subteam-build'), team: ref('team-prime'), status: 'done', show: true, priority: 'low' });
  assert.deepEqual(patch('task-monday-1003').unset, ['dueDate', 'contact']);
  assert.deepEqual(patch('task-monday-1005').set, { title: 'Order the pizza', subteam: ref('subteam-unmatched'), team: ref('team-prime'), status: 'up-next', show: true });
  assert.deepEqual(patch('task-monday-1005').unset, ['priority', 'dueDate', 'contact'], 'an unknown priority label and a date that is not a day are no values');
  assert.equal(patch('task-monday-1006').set.title, 'Plan the whole season', 'the title is cut at 22 characters and the space at the cut goes');
  assert.ok(patch('task-monday-1006').set.title.length <= 22);

  mutations.forEach(mutation => {
    if (mutation.patch) {
      assert.deepEqual(Object.keys(mutation.patch.set), Object.keys(mutation.patch.set).filter(name => ['title', 'subteam', 'team', 'status', 'show', 'priority', 'dueDate', 'contact'].includes(name)));
    }
  });
  assert.ok(!JSON.stringify(mutations).includes('"status":"blocked"'), 'blocked is never written');
});

test('owner names: off, no contact is written. On, only the first word of the first owner, and an email gives none', () => {
  const off = setup('owners-off', { tools: true });
  world(off, { owners: false });
  off.run();
  assert.ok(!JSON.stringify(off.taskMutations()).includes('"contact"') || !/"set":\{[^}]*"contact"/.test(JSON.stringify(off.taskMutations())), 'no contact is set while the switch is off');
  assert.ok(!off.taskMutations().some(mutation => mutation.patch && mutation.patch.set && 'contact' in mutation.patch.set));

  const on = setup('owners-on', { tools: true });
  world(on, { owners: true });
  on.run();
  const contacts = {};
  on.taskMutations().filter(mutation => mutation.patch && mutation.patch.set).forEach(mutation => {
    contacts[mutation.patch.id] = mutation.patch.set.contact || null;
  });
  assert.deepEqual(contacts, { 'task-monday-1001': 'Sam', 'task-monday-1002': 'Pat', 'task-monday-1003': null, 'task-monday-1005': null, 'task-monday-1006': 'Ana' });

  const longName = setup('owners-long', { tools: true });
  world(longName, { owners: true, items: [item('1001', 'Wire the robot', 'Build', { status: 'Backlog', priority: '', date4: '', person: 'Maximilian-Bartholomew Lee' })] });
  longName.run();
  const set = longName.taskMutations().filter(mutation => mutation.patch)[0].patch.set;
  assert.equal(set.contact, 'Maximilian-B', 'a first name is cut at 12 characters');
});

test('owner names turned off later: the contact of a task that has one is unset, and a task with none is left alone', () => {
  const place = setup('owners-later', { tools: true });
  world(place, { owners: false, tasks: [stored(1001, { contact: 'Sam' }), stored(1002), stored(1003), stored(1005), stored(1006)] });
  place.run();
  const mutations = place.taskMutations();
  assert.equal(mutations.length, 1);
  assert.deepEqual(mutations[0].patch.id, 'task-monday-1001');
  assert.deepEqual(mutations[0].patch.unset, ['contact']);
});

test('the subteam is the Team lead with the name of the group, capitals and spaces ignored, and [Unmatched] is made once, hidden, with the fixed id', () => {
  const first = setup('unmatched-first', { tools: true });
  world(first);
  first.run();
  const groups = first.writes()[0].mutations;
  assert.deepEqual(groups[0], { createIfNotExists: { _id: 'subteam-unmatched', _type: 'subteam', name: '[Unmatched]', show: false } }, 'the subteam comes before the first task that points to it');
  assert.equal(first.taskMutations().filter(mutation => mutation.createIfNotExists && mutation.createIfNotExists._type === 'subteam').length, 1);
  const programming = first.taskMutations().filter(mutation => mutation.patch && mutation.patch.id === 'task-monday-1002')[0].patch.set.subteam._ref;
  assert.equal(programming, 'subteam-programming', 'Programming matches a lead named " programming "');

  const second = setup('unmatched-second', { tools: true });
  world(second, { subteams: [{ _id: 'subteam-build', name: 'Build' }, { _id: 'subteam-programming', name: 'Programming' }, { _id: 'subteam-unmatched', name: '[Unmatched]' }] });
  second.run();
  assert.ok(!JSON.stringify(second.writes()).includes('"createIfNotExists":{"_id":"subteam-unmatched"'), 'the next run does not make it again');
  assert.ok(JSON.stringify(second.taskMutations()).includes('"_ref":"subteam-unmatched"'), 'the tasks still point to it');

  const none = setup('unmatched-none', { tools: true });
  world(none, { items: [item('1001', 'Wire the robot', 'Build', { status: 'Backlog' })] });
  none.run();
  assert.ok(!JSON.stringify(none.writes()).includes('subteam-unmatched'), 'with every item matched, nothing is made');
});

test('a team column, when one is chosen, is used before the group, and the group when the cell is empty', () => {
  const entry = Object.assign({}, boardEntry, { teamColumn: 'team_label' });
  const place = setup('team-column', { tools: true });
  world(place, {
    boards: [entry],
    items: [
      item('2001', 'First', 'Food', { status: 'Backlog', team_label: 'ELECTRICAL' }),
      item('2002', 'Second', 'Build', { status: 'Backlog', team_label: '' }),
      item('2003', 'Third', 'Build', { status: 'Backlog', team_label: 'Nobody' }),
    ],
  });
  place.run();
  const subteams = {};
  place.taskMutations().filter(mutation => mutation.patch && mutation.patch.set).forEach(mutation => { subteams[mutation.patch.id] = mutation.patch.set.subteam._ref; });
  assert.deepEqual(subteams, { 'task-monday-2001': 'subteam-electrical', 'task-monday-2002': 'subteam-build', 'task-monday-2003': 'subteam-unmatched' });
  assert.deepEqual(place.variables()[1].columns, ['priority', 'date4', 'person', 'status', 'team_label'].sort());
});

test('Show on TV is never sent: a task that exists keeps it, a new one gets none, and a task that is up to date is not touched at all', () => {
  const place = setup('show-on-tv', { tools: true });
  world(place, {
    tasks: [stored(1001, { showOnTv: false, priority: 'low' }), stored(1002), stored(1003), stored(1005), stored(1006)],
  });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);

  const text = JSON.stringify(place.writes());
  assert.ok(!text.includes('showOnTv'), 'the name of the switch is nowhere in what is written');
  const mutations = place.taskMutations();
  assert.equal(mutations.length, 1, 'only the task that differs is written');
  assert.equal(mutations[0].patch.id, 'task-monday-1001');
  assert.equal(mutations[0].patch.set.priority, 'high');
  assert.ok(!mutations.some(mutation => mutation.createIfNotExists), 'a task that exists is not made again');
  assert.ok(result.text.includes('5 task(s) wanted, 0 new, 1 changed, 0 switched off'), result.text);

  const clean = setup('up-to-date', { tools: true });
  world(clean, { tasks: [stored(1001), stored(1002), stored(1003), stored(1005), stored(1006)] });
  clean.run();
  assert.equal(clean.writes().length, 1, 'with nothing changed, only the status is written');
  assert.equal(clean.taskMutations().length, 0);
});

test('a task whose item has gone is switched off and never deleted, and one that is already off is left alone', () => {
  const place = setup('vanished', { tools: true });
  world(place, {
    tasks: [stored(1001), stored(1002), stored(1003), stored(1005), stored(1006), stored(9001, { title: 'Gone', show: true }), stored(9002, { title: 'Gone for good', show: false })],
  });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);

  const mutations = place.taskMutations();
  assert.deepEqual(mutations, [{ patch: { id: 'task-monday-9001', set: { show: false } } }]);
  assert.ok(!JSON.stringify(place.writes()).includes('delete'), 'nothing is deleted');
  assert.ok(result.text.includes('1 switched off'), result.text);
});

test('a task whose status is no longer one of the three labels is switched off, and comes back when the label does', () => {
  const place = setup('stuck', { tools: true });
  world(place, { tasks: [stored(1001), stored(1002), stored(1003), stored(1005), stored(1006), stored(1004, { title: 'Waiting on a part', status: 'in-progress', subteam: 'subteam-build', team: 'team-prime' })] });
  place.run();
  assert.deepEqual(place.taskMutations(), [{ patch: { id: 'task-monday-1004', set: { show: false } } }]);

  const back = setup('stuck-back', { tools: true });
  world(back, { tasks: [stored(1001), stored(1002), stored(1003, { show: false }), stored(1005), stored(1006)] });
  back.run();
  const mutations = back.taskMutations();
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].patch.id, 'task-monday-1003');
  assert.equal(mutations[0].patch.set.show, true);
});

test('when a board cannot be read to its end, nothing is switched off and no count is kept', () => {
  const entry = Object.assign({}, boardEntry, { boardId: '222' });
  const place = setup('incomplete', { tools: true });
  world(place, {
    boards: [boardEntry, entry],
    tasks: [stored(1001), stored(1002), stored(1003), stored(1005), stored(1006), stored(9001, { title: 'On the other board', show: true })],
  });
  place.answer('items-222', undefined, { exit: 28 });
  const result = place.run();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('monday: Monday did not answer, the server took too long to answer.'), result.errors);
  assert.equal(place.taskMutations().length, 0, 'task-monday-9001 stays on');
  const document = place.document();
  assert.equal(document.lastError, 'Monday did not answer, the server took too long to answer.');
  assert.deepEqual(document.snapshots, [], 'a count from a run that missed a board could be too low');
  assert.ok(!result.calls.includes('status-write.sh') || result.calls.includes('status-write.sh monday'), 'the boards were read, so the time still goes to status-mini');
});

test('a board entry that cannot be used is skipped and said so, and the others are read', () => {
  const place = setup('bad-entries', { tools: true });
  world(place, {
    boards: [
      { boardId: 'abc', team: 'team-prime', statusColumn: 'status' },
      { boardId: '777', team: 'team-gone', statusColumn: 'status' },
      { boardId: '888', team: 'team-prime', statusColumn: '' },
      boardEntry,
      Object.assign({}, boardEntry, { team: 'team-nova' }),
    ],
  });
  const result = place.run();

  assert.equal(result.status, 1);
  ['A board in Dashboard Settings has no usable board number, so it was skipped.', 'Board 777 has no team that exists, so it was skipped.', 'Board 888 has no status column, so it was skipped.'].forEach(line => {
    assert.ok(result.errors.includes('monday: ' + line), line);
  });
  assert.deepEqual(requestsOf(result.calls).filter(line => line.startsWith('monday ')), ['monday boards', 'monday items-111'], 'a board that is in the list twice is read once');
  assert.ok(place.document().lastError.startsWith('A board in Dashboard Settings'));
  assert.ok(place.taskMutations().length > 0, 'the good entry still wrote its tasks');
  assert.ok(!JSON.stringify(place.taskMutations()).includes('"status":"blocked"'));
});

test('the label fields have the defaults when empty, and a label is matched whatever its capitals and spaces', () => {
  const entry = Object.assign({}, boardEntry, { backlogLabel: '', progressLabel: null, doneLabel: undefined, priorityHigh: '  HIGH ', priorityMedium: '', priorityLow: '' });
  const place = setup('labels', { tools: true });
  world(place, {
    boards: [entry],
    items: [
      item('3001', 'One', 'Build', { status: ' backlog ', priority: 'high' }),
      item('3002', 'Two', 'Build', { status: 'WORKING ON IT', priority: 'Medium' }),
      item('3003', 'Three', 'Build', { status: 'done', priority: 'Low' }),
    ],
  });
  place.run();
  const sets = {};
  place.taskMutations().filter(mutation => mutation.patch && mutation.patch.set).forEach(mutation => { sets[mutation.patch.id] = [mutation.patch.set.status, mutation.patch.set.priority || null]; });
  assert.deepEqual(sets, { 'task-monday-3001': ['up-next', 'high'], 'task-monday-3002': ['in-progress', null], 'task-monday-3003': ['done', null] }, 'empty priority labels map nothing');
});

test('a date is a day or nothing: a day and a time give the day, and a day that is not on the calendar gives none', () => {
  const place = setup('dates', { tools: true });
  world(place, {
    items: [
      item('4001', 'A', 'Build', { status: 'Backlog', date4: '2027-03-01 09:30' }),
      item('4002', 'B', 'Build', { status: 'Backlog', date4: '2027-02-29' }),
      item('4003', 'C', 'Build', { status: 'Backlog', date4: '2028-02-29' }),
      item('4004', 'D', 'Build', { status: 'Backlog', date4: 'next week' }),
      item('4005', 'E', 'Build', { status: 'Backlog', date4: '12/03/2027' }),
      item('4006', 'F', 'Build', { status: 'Backlog', date4: '2027-3-1' }),
    ],
  });
  place.run();
  const days = {};
  place.taskMutations().filter(mutation => mutation.patch && mutation.patch.set).forEach(mutation => { days[mutation.patch.id.slice(-4)] = mutation.patch.set.dueDate || null; });
  assert.deepEqual(days, { 4001: '2027-03-01', 4002: null, 4003: '2028-02-29', 4004: null, 4005: null, 4006: null });
});

test('the snapshot: one count a day of the items that are not done, over the chosen boards, and the first run of a day makes the entry', () => {
  const place = setup('snapshot', { tools: true });
  world(place);
  place.run();
  assert.deepEqual(place.document().snapshots, [{ _key: '2027-01-12', date: '2027-01-12', open: 5 }], 'five of the six are not done, the Stuck item too');
});

test('the snapshot is kept once a day: a second run on the same day replaces the day, and the next day adds one', () => {
  const place = setup('snapshot-days', { tools: true });
  world(place, { snapshots: [{ date: '2027-01-10', open: 9 }, { date: '2027-01-12', open: 7 }] });
  place.run();
  assert.deepEqual(place.document().snapshots.map(entry => [entry.date, entry.open]), [['2027-01-10', 9], ['2027-01-12', 5]]);

  const next = setup('snapshot-next', { tools: true });
  world(next, { snapshots: [{ date: '2027-01-10', open: 9 }, { date: '2027-01-12', open: 7 }] });
  next.at('2027-01-13T15:00:00Z');
  next.run();
  assert.deepEqual(next.document().snapshots.map(entry => [entry.date, entry.open]), [['2027-01-10', 9], ['2027-01-12', 7], ['2027-01-13', 5]]);
});

test('the snapshots stop at 120 entries and the oldest go first, and rows in the old list that are not a day and a number are dropped', () => {
  const old = [];
  for (let day = 0; day < 120; day += 1) old.push({ date: new Date(Date.UTC(2026, 8, 1 + day)).toISOString().slice(0, 10), open: day });
  old.push({ date: 'yesterday', open: 3 });
  old.push({ date: '2026-12-31', open: 'many' });
  const place = setup('snapshot-cap', { tools: true });
  world(place, { snapshots: old });
  place.run();

  const list = place.document().snapshots;
  assert.equal(list.length, 120);
  assert.equal(list[0].date, '2026-09-02', 'the oldest day went');
  assert.deepEqual(list[119], { _key: '2027-01-12', date: '2027-01-12', open: 5 });
  list.forEach(entry => assert.deepEqual(Object.keys(entry), ['_key', 'date', 'open']));
  assert.deepEqual(list.map(entry => entry.date), list.map(entry => entry.date).slice().sort());
});

test('the day is the day in the time zone of the screen, not in UTC', () => {
  const place = setup('zone', { tools: true });
  world(place, { zone: 'America/Los_Angeles' });
  place.at('2027-01-13T03:00:00Z', '2027-01-12');
  const result = place.run();
  assert.equal(place.document().snapshots[0].date, '2027-01-12');
  assert.ok(result.calls.includes('date TZ=America/Los_Angeles +%Y-%m-%d'), result.calls);
  assert.equal(place.document().lastSyncAt, '2027-01-13T03:00:00Z');

  const odd = setup('zone-odd', { tools: true });
  world(odd, { zone: 'Not a zone; rm -rf /' });
  const second = odd.run();
  assert.ok(second.calls.includes('date TZ=America/New_York +%Y-%m-%d'), 'a time zone that is not one is replaced');
});

test('the status document has the fixed id, the first name, the visible boards with their columns, and nothing that is empty', () => {
  const place = setup('status-shape', { tools: true });
  world(place);
  place.run();
  const document = place.document();

  assert.deepEqual(Object.keys(document), ['_id', '_type', 'connectedAs', 'lastSyncAt', 'boards', 'snapshots']);
  assert.equal(document._id, 'monday-status');
  assert.equal(document._type, 'mondayStatus');
  assert.equal(document.connectedAs, 'Jordan');
  assert.equal(document.lastSyncAt, '2027-01-12T15:00:00Z');
  assert.ok(!('lastError' in document), 'no error means no lastError');
  assert.deepEqual(document.boards.map(board => [board.id, board.name, board.itemCount, board.columns.length]), [['111', '[Build board]', 6, 5], ['222', '[Outreach board]', 3, 2]], 'a board that is not chosen is listed, a sub items board is not');
  assert.deepEqual(document.boards[0], {
    _key: '111',
    id: '111',
    name: '[Build board]',
    itemCount: 6,
    columns: [
      { _key: 'name', id: 'name', title: 'Name', type: 'name' },
      { _key: 'status', id: 'status', title: 'Status', type: 'status' },
      { _key: 'priority', id: 'priority', title: 'Priority', type: 'status' },
      { _key: 'date4', id: 'date4', title: 'Due', type: 'date' },
      { _key: 'person', id: 'person', title: 'Owner', type: 'people' },
    ],
  });
  const body = place.writes()[1];
  assert.deepEqual(Object.keys(body), ['mutations']);
  assert.deepEqual(Object.keys(body.mutations[0]), ['createOrReplace']);
  assert.equal(JSON.stringify(document).includes('Example'), false, 'only the first name of the account is kept');
});

test('no board chosen, or no list at all: the visible boards are written, nothing else is asked of Monday, and no task is touched', () => {
  [undefined, null, []].forEach((boards, index) => {
    const place = setup('none-' + index, { tools: true });
    world(place, { boards: boards === undefined ? undefined : boards, tasks: [stored(1001)] });
    if (boards === undefined) {
      place.sanity({ zone: 'America/New_York', owners: null, boards: null, teams: [], subteams: [], tasks: [stored(1001)], snapshots: [{ date: '2027-01-10', open: 4 }] });
    }
    const result = place.run();

    assert.equal(result.status, 0, result.errors);
    assert.deepEqual(requestsOf(result.calls), ['sanity-query', 'monday boards', 'sanity-write', 'status-write monday']);
    assert.equal(place.writes().length, 1);
    const document = place.document();
    assert.equal(document.boards.length, 2);
    assert.equal(document.connectedAs, 'Jordan');
    assert.ok(!('lastError' in document));
    assert.ok(result.text.includes('0 board(s) chosen'), result.text);
    assert.ok(!JSON.stringify(place.writes()).includes('task-monday'), 'the task stays as it was');
  });
});

test('with no board chosen the counts of earlier days are kept and no new one is added', () => {
  const place = setup('none-snapshots', { tools: true });
  world(place, { boards: [], snapshots: [{ date: '2027-01-10', open: 4 }] });
  place.run();
  assert.deepEqual(place.document().snapshots, [{ _key: '2027-01-10', date: '2027-01-10', open: 4 }]);
});

test('more than 500 items on a board: 500 are read in 5 pages of 100, the sixth page is not asked for, and it is said', () => {
  const many = [];
  for (let number = 1; number <= 650; number += 1) many.push(item(String(5000 + number), 'Task ' + number, 'Build', { status: 'Backlog', priority: '', date4: '', person: '' }));
  const place = setup('cap-items', { tools: true });
  world(place, { items: many, tasks: [stored(9001, { title: 'Old', show: true })] });
  const result = place.run();

  const monday = requestsOf(result.calls).filter(line => line.startsWith('monday '));
  assert.deepEqual(monday, ['monday boards', 'monday items-111', 'monday more-cursor111n1', 'monday more-cursor111n2', 'monday more-cursor111n3', 'monday more-cursor111n4']);
  assert.ok(result.text.includes('monday: 500 item(s) read'), result.text);
  assert.ok(result.text.includes('500 task(s) wanted, 500 new'), result.text);
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('Board 111 has more than 500 items, so only the first 500 were read.'), result.errors);
  assert.equal(place.document().lastError, 'Board 111 has more than 500 items, so only the first 500 were read.');
  assert.ok(!JSON.stringify(place.writes()).includes('task-monday-9001'), 'a board that was not read to its end switches nothing off');
  assert.deepEqual(place.document().snapshots, []);

  const writes = place.writes();
  assert.equal(writes.length, 6, 'five requests of 100 tasks and the status');
  writes.slice(0, 5).forEach(body => assert.equal(body.mutations.length, 200, 'a task made new is made and filled in by the same request'));
  const ids = place.taskMutations().filter(mutation => mutation.createIfNotExists).map(mutation => mutation.createIfNotExists._id);
  assert.equal(new Set(ids).size, 500);
});

test('exactly 500 items on a board, with nothing after them, is a board that was read to its end', () => {
  const some = [];
  for (let number = 1; number <= 500; number += 1) some.push(item(String(6000 + number), 'Task ' + number, 'Build', { status: 'Backlog', priority: '', date4: '', person: '' }));
  const place = setup('cap-exact', { tools: true });
  world(place, { items: some, tasks: [stored(9001, { title: 'Old', show: true })] });
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.ok(JSON.stringify(place.writes()).includes('task-monday-9001'), 'the task that is gone is switched off');
  assert.equal(place.document().snapshots[0].open, 500);
});

test('the request limit stops the run, says so, and keeps what was read', () => {
  const place = setup('cap-requests', { tools: true, edits: [['max_requests=60', 'max_requests=2']] });
  world(place);
  place.pages('111', items111().concat(Array.from({ length: 150 }, (_, number) => item(String(7000 + number), 'T' + number, 'Build', { status: 'Backlog' }))), 100);
  const result = place.run();

  assert.deepEqual(requestsOf(result.calls).filter(line => line.startsWith('monday ')), ['monday boards', 'monday items-111']);
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('This run stopped after 2 requests to Monday and goes on at the next run.'), result.errors);
  assert.equal(place.document().lastError, 'This run stopped after 2 requests to Monday and goes on at the next run.');
  assert.ok(place.taskMutations().length > 0, 'the first page was written');
  assert.ok(!place.taskMutations().some(mutation => mutation.patch && mutation.patch.set && mutation.patch.set.show === false), 'nothing is switched off by a run that stopped');
});

test('a GraphQL error is recorded in lastError in plain characters, the run stops without touching a task, and the time does not go to status-mini', () => {
  const place = setup('graphql-error', { tools: true });
  world(place, { tasks: [stored(1001), stored(9001, { title: 'Old', show: true })] });
  place.answer('boards', { errors: [{ message: 'Field "boards" is not allowed <b>here</b>\nline two', extensions: { code: 'BAD' } }], account_id: 1 });
  const result = place.run();

  assert.equal(result.status, 1);
  assert.deepEqual(requestsOf(result.calls), ['sanity-query', 'monday boards', 'sanity-write']);
  const body = place.writes()[0];
  assert.deepEqual(body.mutations[0], { createIfNotExists: { _id: 'monday-status', _type: 'mondayStatus' } });
  assert.equal(body.mutations[1].patch.id, 'monday-status');
  assert.deepEqual(Object.keys(body.mutations[1].patch.set), ['lastError']);
  assert.equal(body.mutations[1].patch.set.lastError, 'Monday said: Field boards is not allowed b here b line two');
  assert.ok(!result.calls.includes('status-write.sh'), 'the boards were not read, so the time stays as it was');
  assert.ok(result.errors.includes('monday: Monday said: Field boards is not allowed b here b line two'), result.errors);
});

test('the older error shape of Monday is read too, and an error on one page keeps the other boards', () => {
  const place = setup('graphql-old-error', { tools: true });
  world(place);
  place.answer('boards', { error_message: 'Complexity budget exhausted', error_code: 'ComplexityException', status_code: 429 });
  const result = place.run();
  assert.equal(result.status, 1);
  assert.equal(place.writes()[0].mutations[1].patch.set.lastError, 'Monday said: Complexity budget exhausted');

  const second = setup('graphql-page-error', { tools: true });
  world(second, { boards: [boardEntry, Object.assign({}, boardEntry, { boardId: '222' })] });
  second.answer('items-222', { errors: [{ message: 'Board not found' }] });
  const answer = second.run();
  assert.equal(answer.status, 1);
  assert.deepEqual(requestsOf(answer.calls).filter(line => line.startsWith('monday ')), ['monday boards', 'monday items-111', 'monday items-222']);
  assert.equal(second.document().lastError, 'Monday said: Board not found');
  assert.ok(second.taskMutations().length > 0, 'the board that worked wrote its tasks');
});

test('a refused token stops the run at once, says what to check, and never says the token', () => {
  [401, 403].forEach(code => {
    const place = setup('refused-' + code, { tools: true });
    world(place);
    place.answer('boards', { error_message: 'Not Authenticated' }, { code: code });
    const result = place.run();

    assert.equal(result.status, 1);
    assert.deepEqual(requestsOf(result.calls), ['sanity-query', 'monday boards', 'sanity-write']);
    assert.equal(place.writes()[0].mutations[1].patch.set.lastError, 'Monday refused the token. Check MONDAY_API_TOKEN in local.env.');
    assert.ok(!(result.text + result.errors + result.calls).includes(mondayToken));
  });
});

test('too many requests from Monday stops the run and says it carries on later', () => {
  const place = setup('limit', { tools: true });
  world(place, { boards: [boardEntry, Object.assign({}, boardEntry, { boardId: '222' })] });
  place.answer('items-111', { error_message: 'Rate limit' }, { code: 429 });
  const result = place.run();
  assert.equal(result.status, 1);
  assert.deepEqual(requestsOf(result.calls).filter(line => line.startsWith('monday ')), ['monday boards', 'monday items-111'], 'the second board is not asked');
  assert.equal(place.document().lastError, 'Monday says there were too many requests, so this run stopped. It goes on at the next run.');
});

test('Monday not answering, or sending something that is not data, is recorded and keeps what was written before', () => {
  const place = setup('offline', { tools: true });
  world(place);
  place.answer('boards', undefined, { exit: 6 });
  const result = place.run();
  assert.equal(result.status, 1);
  assert.equal(place.writes()[0].mutations[1].patch.set.lastError, 'Monday did not answer, could not find the server, so the network may be down.');
  assert.deepEqual(Object.keys(place.writes()[0].mutations[1].patch.set), ['lastError'], 'the boards and the counts written before stay');

  const page = setup('web-page', { tools: true });
  world(page);
  fs.writeFileSync(path.join(page.stub, 'monday/boards.json'), '<html>Sorry</html>');
  page.run();
  assert.equal(page.writes()[0].mutations[1].patch.set.lastError, 'Monday sent an answer that is not data.');

  const other = setup('odd-code', { tools: true });
  world(other);
  other.answer('boards', {}, { code: 500 });
  other.run();
  assert.equal(other.writes()[0].mutations[1].patch.set.lastError, 'Monday answered with code 500.');

  const nothing = setup('no-boards-in-answer', { tools: true });
  world(nothing);
  nothing.answer('boards', { data: { me: { name: 'Jordan' } } });
  nothing.run();
  assert.equal(nothing.writes()[0].mutations[1].patch.set.lastError, 'Monday sent no list of boards.');
});

test('a board the account cannot see gives a plain message, and the other boards go on', () => {
  const place = setup('unseen', { tools: true });
  world(place, { boards: [boardEntry, Object.assign({}, boardEntry, { boardId: '222' })] });
  place.answer('items-222', { data: { boards: [] } });
  const result = place.run();
  assert.equal(result.status, 1);
  assert.equal(place.document().lastError, 'Monday gave no items for board 222, so the account of the token may not be able to see it.');
  assert.ok(place.taskMutations().length > 0);
});

test('Sanity refusing a write is recorded, stops the writes, and nothing is switched off by a run that did not finish', () => {
  const place = setup('sanity-refuses', { tools: true });
  world(place, { tasks: [stored(9001, { title: 'Old', show: true })] });
  fs.writeFileSync(path.join(place.stub, 'mutate.fail-at'), '1');
  const result = place.run();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('monday: Could not write to Sanity, Sanity refused it, so the token may be wrong or may not have Editor access.'), result.errors);
  assert.equal(place.writes().length, 2, 'the first write failed, and the status is still tried');
  assert.ok(!result.calls.includes('status-write.sh') || place.writes().length === 2);
});

test('when Sanity cannot be asked or gives no answer the run stops and nothing is changed', () => {
  const answers = {
    'no-network': place => fs.writeFileSync(path.join(place.stub, 'sanity.exit'), '6'),
    'error': place => fs.writeFileSync(path.join(place.stub, 'sanity.json'), JSON.stringify({ error: { description: 'query problem' } })),
    'web-page': place => fs.writeFileSync(path.join(place.stub, 'sanity.json'), '<html>Sorry</html>'),
    'no-result': place => fs.writeFileSync(path.join(place.stub, 'sanity.json'), JSON.stringify({ result: null })),
  };

  Object.keys(answers).forEach(name => {
    const place = setup('sanity-down-' + name, { tools: true });
    world(place);
    answers[name](place);
    const result = place.run();

    assert.equal(result.status, 1, name);
    assert.ok(result.errors.includes('Could not get the settings from Sanity. Nothing was changed.'), name);
    assert.deepEqual(requestsOf(result.calls), ['sanity-query'], name);
    assert.equal(place.writes().length, 0, name);
  });
});

test('text from Monday never reaches the shell or breaks the JSON: quotes, dollar signs, backticks, newlines and control characters are made safe', () => {
  const place = setup('hostile', { tools: true });
  const hostile = [
    item('8001', '$(touch HACKED)', 'Build', { status: 'Backlog', priority: '`touch HACKED`', person: '"; touch HACKED; "' }),
    item('8002', 'Line one\nline two\ttab\u0007bell', 'Build', { status: 'Backlog' }),
    item('8003', '\\"} ; echo > HACKED', 'Build', { status: 'Backlog' }),
    item('8004', '   ', 'Build', { status: 'Backlog' }),
    item('8005; touch HACKED', 'Not a number', 'Build', { status: 'Backlog' }),
    item('8006', '  Padded   name  ', 'Build', { status: 'Backlog', person: 'O\'Brien-Lee; touch HACKED' }),
  ];
  world(place, { owners: true, items: hostile });
  const answer = boardsAnswer([{ id: '444', name: 'Board "quoted" $(touch HACKED) \\ end', type: 'board', items_count: 1, columns: [{ id: 'bad id; touch HACKED', title: 'No', type: 'text' }, { id: 'ok_1', title: 'Fine\nTitle', type: 'Text; bad' }] }]);
  place.answer('boards', answer);
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(filesUnder(place.root).filter(file => path.basename(file) === 'HACKED'), [], 'nothing ran');
  const titles = {};
  place.taskMutations().filter(mutation => mutation.patch).forEach(mutation => { titles[mutation.patch.id] = mutation.patch.set; });
  assert.equal(titles['task-monday-8001'].title, '$(touch HACKED)', 'text is data, kept as it is');
  assert.equal(titles['task-monday-8002'].title, 'Line one line two tab', 'control characters become spaces, the title is cut at 22 and the space at the cut goes');
  assert.ok(!titles['task-monday-8004'] && !titles['task-monday-8005; touch HACKED'], 'an empty title and an item number that is not digits are left out');
  assert.equal(titles['task-monday-8006'].title, 'Padded name');
  assert.equal(titles['task-monday-8006'].contact, 'O\'Brien-Lee', 'only letters, hyphens, dots and apostrophes remain in a first name');
  assert.ok(!('contact' in titles['task-monday-8001']), 'the first word is only signs, so there is no first name');
  const board = place.document().boards.filter(item => item.id === '444')[0];
  assert.equal(board.name, 'Board "quoted" $(touch HACKED) \\ end', 'a name is data in the document, cut at 60');
  assert.deepEqual(board.columns.map(column => column.id), ['ok_1'], 'a column id with spaces or signs is left out');
  assert.equal(board.columns[0].title, 'Fine Title');
  assert.ok(!('type' in board.columns[0]), 'a type that is not plain words is left out');
});

test('answers of an odd shape do not stop the run: missing names, groups and cells, numbers for texts, an account with no name', () => {
  const place = setup('odd-shapes', { tools: true });
  world(place, {
    owners: true,
    items: [
      { id: 9001, name: 'Number id', group: null, column_values: null },
      { id: '9002', name: null, group: { title: null }, column_values: [] },
      { id: '9003', name: 'Fine', group: { title: null }, column_values: [null, 'x', { id: 'status', text: null }, { id: 'status', text: 'Backlog' }, { id: 'person', text: 7 }] },
      { id: '9004', name: 'Texty', group: 'Build', column_values: [{ id: 'status', text: 5 }] },
      null,
      'text',
    ],
  });
  place.answer('boards', {
    data: {
      me: null,
      boards: [
        { id: 111, name: null, type: null, items_count: null, columns: null },
        { id: '222', name: 5, items_count: -3, columns: [null, 'text', { id: 'ok', title: null, type: 7 }, { id: 'ok', title: 'Twice', type: 'text' }] },
        null,
        'text',
        { name: 'No id' },
      ],
    },
  });
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.equal(result.errors, '');
  const document = place.document();
  assert.ok(!('connectedAs' in document), 'an account with no name has no first name');
  assert.deepEqual(document.boards, [
    { _key: '111', id: '111', name: '', itemCount: 0, columns: [] },
    { _key: '222', id: '222', name: '', itemCount: 0, columns: [{ _key: 'ok', id: 'ok', title: '' }] },
  ]);
  const made = place.taskMutations().filter(mutation => mutation.createIfNotExists).map(mutation => mutation.createIfNotExists._id);
  assert.deepEqual(made.filter(id => id.startsWith('task-monday-')), ['task-monday-9003']);
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

test('two boards with two teams: each task has the team of its own board, and the count adds the boards together', () => {
  const second = Object.assign({}, boardEntry, { boardId: '222', team: 'team-nova', ownerColumn: null, dueColumn: null, priorityColumn: null });
  const place = setup('two-boards', { tools: true });
  world(place, { boards: [boardEntry, second] });
  place.pages('222', [item('2001', 'Nova task', 'Build', { status: 'Backlog' }), item('2002', 'Nova done', 'Build', { status: 'Done' })], 100);
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(requestsOf(result.calls).filter(line => line.startsWith('monday ')), ['monday boards', 'monday items-111', 'monday items-222']);
  const teams = {};
  place.taskMutations().filter(mutation => mutation.patch).forEach(mutation => { teams[mutation.patch.id] = mutation.patch.set.team._ref; });
  assert.equal(teams['task-monday-1001'], 'team-prime');
  assert.equal(teams['task-monday-2001'], 'team-nova');
  assert.equal(place.document().snapshots[0].open, 6, 'five open on the first board and one on the second');
});

test('the script also works under dash, with the same requests and the same documents', () => {
  if (!fs.existsSync('/bin/dash')) return;
  const reference = setup('dash-reference', { tools: true });
  world(reference, { owners: true });
  reference.run();

  const place = setup('dash', { tools: true });
  world(place, { owners: true });
  const result = place.run([], {}, '/bin/dash');

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
    assert.ok(text.startsWith('#!/bin/sh\n'));
    assert.ok(/^set -eu$/m.test(text), 'the script stops at the first error');
    assert.ok((fs.statSync(file).mode & 0o111) !== 0, path.basename(file) + ' should be executable');
    assert.ok(!/\bcat\b[^\n]*local\.env/.test(text), 'local.env is never printed');
    assert.ok(!/\beval\b/.test(text), 'nothing is run from text');
    assert.ok(!/CALENDAR_|TBA_/.test(text), 'the other secrets are not read');
  });

  const text = fs.readFileSync(syncFile, 'utf8');
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
  const text = fs.readFileSync(syncFile, 'utf8');
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
  ['items_page', 'next_items_page', 'items_count', 'column_values', 'group { title }'].forEach(word => {
    assert.ok(block.includes(word), 'the block has ' + word);
    assert.ok(!rest.includes(word), 'the rest of the script does not have ' + word);
  });
  ['.data.me.name', '.data.boards', '.items_count', '.column_values', '.data.next_items_page', '.cursor', '.errors[]?.message', '.error_message', '.group.title', '.text'].forEach(place => {
    assert.ok(block.includes(place), 'the block has ' + place);
    assert.ok(!rest.includes(place), 'the rest of the script does not have ' + place);
  });
});

test('the limits of the script are the limits of the Studio fields: a title of 22, a first name of 12, 500 items, 120 snapshots', () => {
  const text = fs.readFileSync(syncFile, 'utf8');
  const task = fs.readFileSync(path.join(repo, 'studio/schemas/task.js'), 'utf8');

  assert.ok(text.includes('\ntitle_limit=22\n') && task.includes("name: 'title'") && /tooLong\(Rule, 22\)/.test(task), 'the title');
  assert.ok(text.includes('\ncontact_limit=12\n') && /name: 'contact'[\s\S]*?tooLong\(Rule, 12\)/.test(task), 'the contact');
  assert.ok(text.includes('\nitems_per_board=500\n'));
  assert.ok(text.includes('\nsnapshots_kept=120\n'));
  assert.ok(text.includes('\nunmatched_id=subteam-unmatched\n') && text.includes("\nunmatched_name='[Unmatched]'\n"));
});

test('the unit files name the account ACCOUNT, run the script, and the timer wakes it 2 minutes after boot and every 10 minutes', () => {
  const service = fs.readFileSync(path.join(repo, 'deploy/systemd/teletraan-monday.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'deploy/systemd/teletraan-monday.timer'), 'utf8');

  assert.deepEqual(service.match(/^User=.*$/gm), ['User=ACCOUNT']);
  assert.ok(/^Type=oneshot$/m.test(service));
  assert.deepEqual(service.match(/^ExecStart=.*$/gm), ['ExecStart=/opt/teletraan/deploy/scripts/monday-sync.sh']);
  assert.ok(!/^ExecStartPost=/m.test(service), 'the script tells status-mini itself, and only after a run that worked');
  assert.ok(fs.existsSync(syncFile), 'the script the unit runs exists');
  assert.ok(/^OnBootSec=2min$/m.test(timer));
  assert.ok(/^OnUnitActiveSec=10min$/m.test(timer));
  assert.ok(/^WantedBy=timers\.target$/m.test(timer));
  assert.ok(!/hawktimus/i.test(service + timer), 'no account name is written in the unit files');
  assert.ok(!/^OnCalendar=/m.test(timer), 'one timer, every 10 minutes after the last run');
  unitFiles.forEach(unit => assert.ok(fs.statSync(path.join(repo, 'deploy/systemd', unit)).size > 100, unit + ' is not empty'));
});

test('the script tells status-mini through status-write.sh, which knows the job monday', () => {
  const status = fs.readFileSync(path.join(repo, 'deploy/scripts/status-write.sh'), 'utf8');
  assert.ok(status.includes('monday) field=lastMondaySyncAt ;;'));
  assert.ok(fs.readFileSync(syncFile, 'utf8').includes('"$deploy/scripts/status-write.sh" monday || true'));
});

test('install-monday.sh stops, naming the file, when a unit file is missing or empty', () => {
  const missing = setup('install-missing', { tools: true, install: true });
  fs.rmSync(path.join(missing.root, 'deploy/systemd/teletraan-monday.service'));
  const first = missing.install();
  assert.equal(first.status, 1);
  assert.ok(first.errors.includes('teletraan-monday.service is missing or empty'), first.errors);

  const empty = setup('install-empty', { tools: true, install: true });
  fs.writeFileSync(path.join(empty.root, 'deploy/systemd/teletraan-monday.timer'), '');
  const second = empty.install();
  assert.equal(second.status, 1);
  assert.ok(second.errors.includes('teletraan-monday.timer is missing or empty'), second.errors);

  const noScript = setup('install-no-script', { tools: true, install: true });
  fs.chmodSync(path.join(noScript.root, 'deploy/scripts/monday-sync.sh'), 0o644);
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
  assert.ok(text.includes('(every 10 minutes)'));
  assert.ok(!/frc|slides|poppler/i.test(text), 'nothing is left of the other installers');
});

test('local.example.env has a MONDAY_API_TOKEN line with a placeholder, and the docs say where it goes', () => {
  const example = fs.readFileSync(path.join(repo, 'deploy/local.example.env'), 'utf8');
  assert.ok(/^MONDAY_API_TOKEN='\[[^\n]*\]'$/m.test(example), 'a placeholder that starts with [');

  const mini = fs.readFileSync(path.join(repo, 'docs/rebuilding-the-mini.md'), 'utf8');
  ['MONDAY_API_TOKEN', 'install-monday.sh', 'monday-sync.sh --check', 'monday-sync.sh', 'sudo apt install curl jq', 'docs/monday.md', '18. **Turn on the Monday board.**'].forEach(word => {
    assert.ok(mini.includes(word), 'docs/rebuilding-the-mini.md should mention ' + word);
  });

  const feed = fs.readFileSync(path.join(repo, 'docs/monday.md'), 'utf8');
  ['monday-status', 'MONDAY_API_TOKEN', 'SANITY_WRITE_TOKEN', 'public', 'None of it has been tried', 'every 10 minutes', 'If an answer looks different', 'teletraan-monday.timer', 'task-monday-', 'Show on TV', 'subteam-unmatched', '500', '120', 'install-monday.sh'].forEach(word => {
    assert.ok(feed.includes(word), 'docs/monday.md should mention ' + word);
  });
});

let failures = 0;
try {
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
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
