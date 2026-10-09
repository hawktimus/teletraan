// Tests for deploy/scripts/status-write.sh, the way the services and kiosk.sh run
// it, and that the dashboard never reads the status document. curl is replaced
// with a small fake one in a temporary folder, so nothing touches the network.
// The token and the project in the test are made up.
//
//   node tools/test-status-write.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const scriptFile = path.join(repo, 'deploy/scripts/status-write.sh');
const kioskFile = path.join(repo, 'deploy/scripts/kiosk.sh');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-status-'));

// The tools the script needs that are not the ones being faked
const ordinaryTools = ['sed', 'tail', 'head', 'grep', 'date', 'dirname', 'cat'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

// A fake curl. It writes each call it gets to calls.log, but never what comes in
// on standard input: that is the token. The address is the https:// argument.
// A question (a query) is answered from query.json in the stub folder, or fails
// with the code in query.exit. A write (a mutate) saves its body in last-body.json
// and its standard input in last-config.txt, and fails with the code in mutate.exit.
const fakeCurl = `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
address=""
body=""
previous=""
for argument in "$@"; do
  case $argument in https://*) address=$argument ;; esac
  [ "$previous" = --data ] && body=$argument
  previous=$argument
done

case $address in
  */data/query/*)
    [ -f "$STUB_DIR/query.exit" ] && exit "$(cat "$STUB_DIR/query.exit")"
    cat "$STUB_DIR/query.json"
    ;;
  */data/mutate/*)
    case " $* " in *" --config - "*) cat > "$STUB_DIR/last-config.txt" ;; esac
    printf '%s' "$body" > "$STUB_DIR/last-body.json"
    echo "address $address" >> "$STUB_DIR/mutate-addresses.txt"
    [ -f "$STUB_DIR/mutate.exit" ] && exit "$(cat "$STUB_DIR/mutate.exit")"
    exit 0
    ;;
  *) exit 6 ;;
esac
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

const token = 'skTESTtoken0123456789abcdef';
const goodEnv = "TELETRAAN_PORT='8080'\nSANITY_WRITE_TOKEN='" + token + "'\n";

// Makes a copy of the script and config.js to run in, a folder of tools to run
// with, and returns how to run the script.
function setup(name, options) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  fs.mkdirSync(path.join(root, 'deploy/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(stub);

  fs.copyFileSync(scriptFile, path.join(root, 'deploy/scripts/status-write.sh'));
  if (!options.noConfig) fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));
  if (options.config) fs.writeFileSync(path.join(root, 'dashboard/config.js'), options.config);
  if (options.localEnv !== undefined) fs.writeFileSync(path.join(root, 'deploy/local.env'), options.localEnv);

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  writeTool(bin, 'curl', fakeCurl);

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  fs.writeFileSync(path.join(stub, 'query.json'), JSON.stringify({ ms: 4, query: 'the query', result: '2026-10-08T21:15:30Z' }));

  return {
    root: root,
    stub: stub,
    run(args) {
      const env = { PATH: bin, STUB_LOG: log, STUB_DIR: stub };
      const result = spawnSync('/bin/sh', [path.join(root, 'deploy/scripts/status-write.sh')].concat(args), { env: env, encoding: 'utf8', input: '' });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    answer(body) {
      fs.writeFileSync(path.join(stub, 'query.json'), typeof body === 'string' ? body : JSON.stringify(body));
    },
    failQuery(code) {
      fs.writeFileSync(path.join(stub, 'query.exit'), String(code));
    },
    failMutate(code) {
      fs.writeFileSync(path.join(stub, 'mutate.exit'), String(code));
    },
    body() {
      return JSON.parse(fs.readFileSync(path.join(stub, 'last-body.json'), 'utf8'));
    },
    config() {
      return fs.readFileSync(path.join(stub, 'last-config.txt'), 'utf8');
    },
    hasBody() {
      return fs.existsSync(path.join(stub, 'last-body.json'));
    },
    addresses() {
      const file = path.join(stub, 'mutate-addresses.txt');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map(line => line.replace('address ', '')) : [];
    },
  };
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// The project, the dataset and the version, as dashboard/config.js has them
const config = fs.readFileSync(path.join(repo, 'dashboard/config.js'), 'utf8');
const project = config.match(/projectId: '([^']*)'/)[1];
const dataset = config.match(/dataset: '([^']*)'/)[1];
const version = config.match(/apiVersion: '([^']*)'/)[1];
const mutateAddress = 'https://' + project + '.api.sanity.io/v' + version + '/data/mutate/' + dataset;

// The field each job writes, which is also the field of the status document in the Studio
const fieldOf = {
  content: 'lastContentSeenAt',
  calendar: 'lastCalendarSyncAt',
  slides: 'lastSlidesFetchAt',
  monday: 'lastMondaySyncAt',
  frc: 'lastFrcSyncAt',
  kiosk: 'kioskStartedAt',
};

function assertNoToken(result, label) {
  assert.ok(!result.text.includes(token) && !result.errors.includes(token), 'the token is in the output ' + label);
  assert.ok(!result.calls.includes(token), 'the token is in the arguments of curl ' + label);
}

test('with no token the script exits quietly and curl is never called', () => {
  const example = fs.readFileSync(path.join(repo, 'deploy/local.example.env'), 'utf8').match(/^SANITY_WRITE_TOKEN=.*$/m)[0];
  const cases = {
    'no local.env': undefined,
    'no token line': "TELETRAAN_PORT='8080'\n",
    'an empty token': "SANITY_WRITE_TOKEN=''\n",
    'a token with nothing after the sign': 'SANITY_WRITE_TOKEN=\n',
    'the placeholder in local.example.env': example + '\n',
  };

  Object.keys(cases).forEach(name => {
    ['content', 'calendar', 'slides', 'kiosk'].forEach(job => {
      const place = setup('none-' + job + '-' + name.replace(/\W+/g, '-'), { localEnv: cases[name] });
      const result = place.run([job]);
      const label = name + ', ' + job;
      assert.equal(result.status, 0, label);
      assert.equal(result.text, '', label);
      assert.equal(result.errors, '', label);
      assert.equal(result.calls, '', label);
    });
  });
});

test('a job writes the time now into its own field of status-mini: the document is made if it is missing, then the field is set', () => {
  ['calendar', 'slides', 'monday', 'frc', 'kiosk'].forEach(job => {
    const place = setup('write-' + job, { localEnv: goodEnv });
    const before = Date.now() - 2000;
    const result = place.run([job]);
    const after = Date.now() + 2000;

    assert.equal(result.status, 0, result.errors);
    assert.equal(result.errors, '');
    assert.ok(result.text.includes(fieldOf[job]), result.text);
    assert.deepEqual(place.addresses(), [mutateAddress], job);
    assert.equal(result.calls.trim().split('\n').length, 1, 'one call to curl, no question first: ' + job);

    const body = place.body();
    assert.deepEqual(Object.keys(body), ['mutations']);
    assert.equal(body.mutations.length, 2);
    assert.deepEqual(body.mutations[0], { createIfNotExists: { _id: 'status-mini', _type: 'status' } });
    assert.deepEqual(Object.keys(body.mutations[1]), ['patch']);
    assert.equal(body.mutations[1].patch.id, 'status-mini');
    assert.deepEqual(Object.keys(body.mutations[1].patch), ['id', 'set']);
    assert.deepEqual(Object.keys(body.mutations[1].patch.set), [fieldOf[job]]);

    const written = body.mutations[1].patch.set[fieldOf[job]];
    assert.match(written, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, job);
    assert.ok(Date.parse(written) >= before - 1000 && Date.parse(written) <= after, job + ' writes the time now, not ' + written);
  });
});

test('the write is a POST with the token as a bearer header and a short time limit, and the token goes in on standard input', () => {
  const place = setup('request', { localEnv: goodEnv });
  const result = place.run(['calendar']);
  assert.equal(result.status, 0, result.errors);

  const call = result.calls.trim();
  assert.ok(call.includes('--request POST'), call);
  assert.ok(call.includes('Content-Type: application/json'), call);
  assert.ok(call.includes('--config -'), 'the settings with the token come in on standard input: ' + call);
  assert.ok(call.includes('--fail'), 'a refusal is a failure: ' + call);
  const seconds = Number((call.match(/--max-time (\d+)/) || [])[1]);
  assert.ok(seconds > 0 && seconds <= 30, 'a short limit, not ' + seconds);
  assert.ok(Number((call.match(/--connect-timeout (\d+)/) || [])[1]) > 0, 'a short time to connect: ' + call);
  assert.equal(place.config().trim(), 'header = "Authorization: Bearer ' + token + '"');
});

test('content asks the dataset for the newest change to a published document, leaves out what the Mini writes, and writes that time', () => {
  const place = setup('content', { localEnv: goodEnv });
  const result = place.run(['content']);
  assert.equal(result.status, 0, result.errors);

  const lines = result.calls.trim().split('\n');
  assert.equal(lines.length, 2, 'a question and then the write');
  assert.ok(lines[0].includes('https://' + project + '.api.sanity.io/v' + version + '/data/query/' + dataset), lines[0]);
  assert.ok(lines[0].includes('perspective=published'), 'only published documents: ' + lines[0]);
  assert.ok(lines[0].includes('order(_updatedAt desc)[0]._updatedAt'), lines[0]);
  ['"status"', '"calendarStatus"', '"mondayStatus"', '"frcStatus"', 'task-monday-'].forEach(word => {
    assert.ok(lines[0].includes(word), 'the question leaves out ' + word + ': ' + lines[0]);
  });
  assert.ok(!lines[0].includes('--config'), 'the dataset is public, so the question sends no token');
  assert.ok(lines[1].includes('/data/mutate/'), lines[1]);
  assert.equal(place.body().mutations[1].patch.set.lastContentSeenAt, '2026-10-08T21:15:30Z');

  const exact = setup('content-milliseconds', { localEnv: goodEnv });
  exact.answer({ ms: 1, query: 'q', result: '2026-10-08T21:15:30.123Z' });
  assert.equal(exact.run(['content']).status, 0);
  assert.equal(exact.body().mutations[1].patch.set.lastContentSeenAt, '2026-10-08T21:15:30.123Z');
});

test('content writes nothing when Sanity gives no time, and says so in plain words', () => {
  const answers = {
    'no document': { ms: 1, query: 'q', result: null },
    'a result that is not a time': { ms: 1, query: 'q', result: 'yesterday' },
    'a number': { ms: 1, query: 'q', result: 42 },
    'an error': { error: { description: 'no' } },
    'text that is not json': 'not json at all',
  };

  Object.keys(answers).forEach(name => {
    const place = setup('content-' + name.replace(/\W+/g, '-'), { localEnv: goodEnv });
    place.answer(answers[name]);
    const result = place.run(['content']);
    assert.equal(result.status, 1, name);
    assert.ok(result.errors.includes('could not find the newest change'), name + ': ' + result.errors);
    assert.equal(place.hasBody(), false, name + ' wrote anyway');
    assertNoToken(result, name);
  });

  const down = setup('content-down', { localEnv: goodEnv });
  down.failQuery(28);
  const result = down.run(['content']);
  assert.equal(result.status, 1);
  assert.equal(down.hasBody(), false, 'a question that failed wrote anyway');
});

test('a write that fails is reported in plain words with the exit code explained, and nothing secret is printed', () => {
  const words = { 22: 'Sanity refused it', 28: 'took too long', 6: 'network may be down', 7: 'could not connect', 35: 'secure connection failed', 99: 'curl failed with exit code 99' };

  Object.keys(words).forEach(code => {
    const place = setup('failed-' + code, { localEnv: goodEnv });
    place.failMutate(code);
    const result = place.run(['slides']);

    assert.equal(result.status, 1, code);
    assert.ok(result.errors.includes('could not write lastSlidesFetchAt'), result.errors);
    assert.ok(result.errors.includes(words[code]), code + ': ' + result.errors);
    assert.equal(result.text, '', code);
    assertNoToken(result, 'when curl exits ' + code);
    assert.ok(!result.errors.includes(project), 'the project is not printed either');
  });
});

test('the token is never in the output or the arguments of curl, and only the settings on standard input carry it', () => {
  const runs = [
    { job: 'kiosk' },
    { job: 'content' },
    { job: 'calendar', failMutate: 22 },
    { job: 'calendar', failMutate: 28 },
  ];

  runs.forEach((run, index) => {
    const place = setup('secret-' + index, { localEnv: goodEnv });
    if (run.failMutate) place.failMutate(run.failMutate);
    const result = place.run([run.job]);
    assertNoToken(result, run.job + ' ' + (run.failMutate || 'ok'));
    assert.ok(place.config().includes(token), 'the token reached curl on standard input');
  });
});

test('a token with odd characters is refused before curl is called, without being printed', () => {
  ['abc"def', 'abc def', 'abc;rm', "ab'c", 'a$(id)b'].forEach((odd, index) => {
    const place = setup('odd-' + index, { localEnv: 'SANITY_WRITE_TOKEN=' + odd + '\n' });
    const result = place.run(['calendar']);

    assert.equal(result.status, 1, odd);
    assert.ok(result.errors.includes('does not look like a token'), result.errors);
    assert.equal(result.calls, '', 'curl was called for ' + odd);
    assert.ok(!result.errors.includes(odd) && !result.text.includes(odd), 'the odd token was printed');
  });
});

test('quotes around the token in local.env are not part of it, and the last token line wins', () => {
  [`SANITY_WRITE_TOKEN='${token}'\n`, `SANITY_WRITE_TOKEN="${token}"\n`, `SANITY_WRITE_TOKEN=${token}\n`, `SANITY_WRITE_TOKEN='skOLD'\nSANITY_WRITE_TOKEN='${token}'\n`].forEach((env, index) => {
    const place = setup('quotes-' + index, { localEnv: env });
    assert.equal(place.run(['kiosk']).status, 0);
    assert.equal(place.config().trim(), 'header = "Authorization: Bearer ' + token + '"', env);
  });
});

test('an unknown job, no job, or more than one gives the usage and exit code 2, and curl is never called', () => {
  [[], ['tv'], ['Calendar'], ['calendar', 'slides'], ['']].forEach((args, index) => {
    const place = setup('usage-' + index, { localEnv: goodEnv });
    const result = place.run(args);

    assert.equal(result.status, 2, JSON.stringify(args));
    assert.ok(result.errors.includes('Usage: status-write.sh content|calendar|slides|monday|frc|kiosk'), result.errors);
    assert.equal(result.calls, '', JSON.stringify(args));
  });
});

test('the project, the dataset and the API version come from dashboard/config.js, and bad ones stop the script before curl is called', () => {
  const changed = config.replace(project, 'abc123xyz').replace("dataset: '" + dataset + "'", "dataset: 'staging'").replace(version, '2030-01-02');
  const place = setup('other-config', { localEnv: goodEnv, config: changed });
  assert.equal(place.run(['frc']).status, 0);
  assert.deepEqual(place.addresses(), ['https://abc123xyz.api.sanity.io/v2030-01-02/data/mutate/staging']);

  const bad = {
    'no config.js': { noConfig: true },
    'a project with a space': { config: config.replace(project, 'bad project') },
    'a project in capitals': { config: config.replace(project, 'ABC') },
    'a dataset with a slash': { config: config.replace("dataset: '" + dataset + "'", "dataset: 'a/b'") },
    'a version that is not a date': { config: config.replace(version, 'latest') },
  };
  Object.keys(bad).forEach(name => {
    const options = Object.assign({ localEnv: goodEnv }, bad[name]);
    const broken = setup('config-' + name.replace(/\W+/g, '-'), options);
    const result = broken.run(['calendar']);

    assert.equal(result.status, 1, name);
    assert.ok(result.errors.includes('Could not read the project ID, dataset and API version'), name + ': ' + result.errors);
    assert.equal(result.calls, '', name);
  });
});

test('the script has valid sh syntax, is executable, and local.env is never printed', () => {
  const syntax = spawnSync('/bin/sh', ['-n', scriptFile], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);

  const text = fs.readFileSync(scriptFile, 'utf8');
  assert.ok(text.startsWith('#!/bin/sh\n'));
  assert.ok((fs.statSync(scriptFile).mode & 0o111) !== 0, 'the script should be executable');
  assert.ok(!/\bcat\b[^\n]*local\.env/.test(text), 'local.env is never printed');
  assert.ok(!/\becho\b[^\n]*\$token/.test(text) && !/\bprintf\b[^\n]*\$token[^\n]*>&2/.test(text), 'the token is never echoed');
  assert.ok(!/--header[^\n]*Authorization|-H [^\n]*Authorization/.test(text), 'the token is not put in an argument of curl');
});

test('the status document and the fields in the script are the ones the Studio has', () => {
  const schema = fs.readFileSync(path.join(repo, 'studio/schemas/status.js'), 'utf8');
  const studioFields = Array.from(schema.matchAll(/timeField\('(\w+)'/g)).map(match => match[1]);
  assert.deepEqual(studioFields.slice().sort(), Object.values(fieldOf).sort());

  const input = fs.readFileSync(path.join(repo, 'studio/status-input.js'), 'utf8');
  assert.ok(input.includes("export const statusId = 'status-mini';"));
  assert.ok(fs.readFileSync(scriptFile, 'utf8').includes('document=status-mini'));
  assert.ok(schema.includes("name: 'status'"));
});

test('the calendar and slides services run it after their job, and a failure of it is ignored', () => {
  const jobs = {
    'teletraan-calendars.service': ['fetch-calendars.sh', ['calendar', 'content']],
    'teletraan-slides.service': ['slides-sync.sh', ['slides']],
  };

  Object.keys(jobs).forEach(unit => {
    const text = fs.readFileSync(path.join(repo, 'deploy/systemd', unit), 'utf8');
    const lines = text.split('\n');
    const start = lines.indexOf('ExecStart=/opt/teletraan/deploy/scripts/' + jobs[unit][0]);
    const posts = lines.filter(line => line.startsWith('ExecStartPost='));

    assert.ok(start !== -1, unit + ' still runs its job');
    assert.deepEqual(posts, jobs[unit][1].map(job => 'ExecStartPost=-/opt/teletraan/deploy/scripts/status-write.sh ' + job), unit + ' runs status-write.sh with a minus in front, so that a failure is ignored');
    assert.ok(lines.indexOf(posts[0]) > start, unit + ' runs it after the job');
    assert.equal(lines.filter(line => line.startsWith('ExecStart=')).length, 1, unit);
    assert.deepEqual(text.match(/^User=.*$/gm), ['User=ACCOUNT']);
  });
});

test('kiosk.sh starts it at the beginning, in the background with its output thrown away, so it never holds the screen back', () => {
  const text = fs.readFileSync(kioskFile, 'utf8');
  const call = '"$deploy/scripts/status-write.sh" kiosk > /dev/null 2>&1 &';

  assert.equal(text.split(call).length, 2, 'kiosk.sh has the call once');
  assert.ok(text.indexOf(call) < text.indexOf('curl --fail --silent --output /dev/null --retry'), 'before the wait for the dashboard');
  assert.ok(text.indexOf(call) < text.indexOf('exec chromium'), 'before the browser starts');
  assert.ok(text.indexOf(call) > text.indexOf('data=${data:-/var/lib/teletraan/data}'), 'after the settings are read');
  const syntax = spawnSync('/bin/sh', ['-n', kioskFile], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
});

test('docs/rebuilding-the-mini.md says how to make the token, where it goes, and which scripts need it', () => {
  const doc = fs.readFileSync(path.join(repo, 'docs/rebuilding-the-mini.md'), 'utf8');
  ['SANITY_WRITE_TOKEN', 'sanity.io/manage', 'Editor', 'status-write.sh', 'install-calendars.sh', 'install-slides.sh', 'No status yet'].forEach(word => {
    assert.ok(doc.includes(word), 'docs/rebuilding-the-mini.md should mention ' + word);
  });
});

function filesUnder(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).reduce((files, entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return files.concat(filesUnder(full));
    return /\.(js|mjs|html|css|json|svg|txt|md)$/.test(entry.name) ? files.concat(full) : files;
  }, []);
}

test('the dashboard never reads the status document: its id, its fields and its type are nowhere in the dashboard folder', () => {
  const files = filesUnder(path.join(repo, 'dashboard'));
  assert.ok(files.length > 50, 'the scan found the dashboard files');

  const words = ['status-mini'].concat(Object.values(fieldOf), ['_type == "status"', "_type == 'status'", '_type=="status"']);
  files.forEach(file => {
    const text = fs.readFileSync(file, 'utf8');
    words.forEach(word => assert.ok(!text.includes(word), path.relative(repo, file) + ' mentions ' + word));
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
