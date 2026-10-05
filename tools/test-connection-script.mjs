// Tests for deploy/scripts/check-connection.sh. The tools it uses on the Mini
// (curl, getent, systemctl, timedatectl, docker) are replaced with small fake
// ones in a temporary folder, so nothing touches the network or the machine.
//
//   node tools/test-connection-script.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const scriptFile = path.join(repo, 'deploy/scripts/check-connection.sh');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-connection-'));

// The tools the script needs that are not the ones being faked
const ordinaryTools = ['awk', 'sed', 'tr', 'sort', 'uniq', 'grep', 'head', 'tail', 'date', 'dirname', 'cat'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

// A fake curl. It writes each call it gets to calls.log, then answers by the
// address and the query. What it answers for the CORS question comes from the
// STUB_CORS variable: ok, missing or 403.
const fakeCurl = `#!/bin/sh
echo "$*" >> "$STUB_LOG"
query=""
headers=no
for argument in "$@"; do
  case $argument in
    query=*) query=\${argument#query=} ;;
    -D) headers=yes ;;
  esac
done
for last in "$@"; do :; done

if [ "$headers" = yes ]; then
  case $STUB_CORS in
    ok) printf 'HTTP/2 200 \\r\\ncontent-type: application/json\\r\\naccess-control-allow-origin: %s\\r\\n\\r\\n' "$STUB_ORIGIN" ;;
    missing) printf 'HTTP/2 200 \\r\\ncontent-type: application/json\\r\\n\\r\\n' ;;
    *) printf 'HTTP/2 403 \\r\\ncontent-type: application/json\\r\\n\\r\\n' ;;
  esac
  exit 0
fi

case $query in
  'count(*)') echo '{"query":"count(*)","result":15,"syncTags":["s1:abc"],"ms":2}' ;;
  '*[]._type') echo '{"query":"*[]._type","result":["task","task","person","sanity.imageAsset","theme","task"],"syncTags":["s1:abc"],"ms":3}' ;;
  '') case $last in
        *apicdn.sanity.io*) printf 200 ;;
        *api.band.us*) printf 404 ;;
        *) printf 000 ;;
      esac ;;
esac
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// Makes a copy of the deploy folder and config.js to run in, a folder of tools
// to run with, and returns how to run the script.
function setup(name, options) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  fs.mkdirSync(path.join(root, 'deploy/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  fs.mkdirSync(bin);

  fs.copyFileSync(scriptFile, path.join(root, 'deploy/scripts/check-connection.sh'));
  fs.copyFileSync(path.join(repo, 'deploy/docker-compose.yml'), path.join(root, 'deploy/docker-compose.yml'));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));
  if (options.localEnv) fs.writeFileSync(path.join(root, 'deploy/local.env'), options.localEnv);

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));

  if (options.tools) {
    writeTool(bin, 'curl', fakeCurl);
    writeTool(bin, 'getent', '#!/bin/sh\necho "203.0.113.5 api.sanity.io"\n');
    writeTool(bin, 'systemctl', '#!/bin/sh\n[ "$1" = is-active ] && echo "${STUB_KIOSK:-active}"\n[ "${STUB_KIOSK:-active}" = active ]\n');
    writeTool(bin, 'timedatectl', '#!/bin/sh\necho "NTPSynchronized=${STUB_SYNC:-yes}"\n');
    writeTool(bin, 'docker', '#!/bin/sh\n[ "$STUB_DOCKER" = running ] && echo "teletraan-web: Up 3 hours"\nexit 0\n');
  }

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');

  return {
    log: log,
    run(extra) {
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_CORS: 'ok', STUB_DOCKER: 'running' }, extra || {});
      const result = spawnSync('/bin/sh', [path.join(root, 'deploy/scripts/check-connection.sh')], { env: env, encoding: 'utf8', input: '' });
      const lines = result.stdout.split('\n').filter(line => line !== '');
      return { lines: lines, text: result.stdout, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
  };
}

const secret = 'https://band.example/SECRET-FEED-TOKEN';
const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

function lineFor(result, word) {
  return result.lines.filter(line => line.indexOf(word) !== -1)[0] || '';
}

test('every check passes: each line says OK, the types are counted, and the last line is OK', () => {
  const place = setup('all-good', { tools: true, localEnv: "TELETRAAN_PORT='4321'\nCALENDAR_TEAM_URL='" + secret + "'\n" });
  const result = place.run({ STUB_ORIGIN: 'http://localhost:4321' });

  assert.equal(result.status, 0);
  assert.equal(result.lines[result.lines.length - 1], 'OK');
  assert.equal(result.lines.filter(line => line.indexOf('FAIL') === 0).length, 0, result.text);

  ['DNS', 'Sanity', 'Dataset', 'CORS', 'BAND', 'Web container', 'Kiosk', 'Time', 'Documents'].forEach(word => {
    assert.ok(lineFor(result, word).indexOf('OK') === 0, 'no OK line for ' + word + '\n' + result.text);
  });

  assert.ok(lineFor(result, 'Sanity:').includes('HTTP 200'));
  assert.ok(lineFor(result, 'BAND').includes('HTTP 404'), 'any answer from BAND is reachable');
  assert.ok(lineFor(result, 'CORS').includes('http://localhost:4321'), 'the port comes from local.env');
  assert.ok(lineFor(result, 'Documents').includes('5 published'), 'five documents, the Sanity picture left out');
  assert.ok(result.lines.includes('        task: 3'));
  assert.ok(result.lines.includes('        person: 1'));
  assert.ok(result.lines.includes('        theme: 1'));
  assert.ok(!result.text.includes('imageAsset'), 'Sanity own documents are not listed');
});

test('the project, dataset, version and port come from the config files, and no secret is ever printed or sent', () => {
  const place = setup('config', { tools: true, localEnv: "TELETRAAN_PORT='4321'\nCALENDAR_TEAM_URL='" + secret + "'\n" });
  const result = place.run({ STUB_ORIGIN: 'http://localhost:4321' });
  const config = fs.readFileSync(path.join(repo, 'dashboard/config.js'), 'utf8');
  const project = config.match(/projectId: '([^']*)'/)[1];
  const dataset = config.match(/dataset: '([^']*)'/)[1];
  const version = config.match(/apiVersion: '([^']*)'/)[1];

  assert.ok(result.calls.includes('https://' + project + '.apicdn.sanity.io/'), 'the reachable check asks the project host');
  assert.ok(result.calls.includes('https://' + project + '.api.sanity.io/v' + version + '/data/query/' + dataset), 'the queries use the dataset and version');
  assert.ok(result.calls.includes('Origin: http://localhost:4321'));
  assert.ok(!/authorization|bearer|token/i.test(result.calls.replace('SECRET-FEED-TOKEN', '')), 'no login is sent');
  assert.ok(!result.text.includes('SECRET') && !result.calls.includes('SECRET'), 'the calendar address is never read');

  // none of the values are written into the script
  const script = fs.readFileSync(scriptFile, 'utf8');
  [project, dataset, version, '3229'].forEach(value => {
    assert.ok(!script.includes(value), 'the script should not contain ' + value);
  });
});

test('with no local.env the port is the default in docker-compose.yml', () => {
  const compose = fs.readFileSync(path.join(repo, 'deploy/docker-compose.yml'), 'utf8');
  const port = compose.match(/TELETRAAN_PORT:-(\d+)/)[1];

  const place = setup('no-env', { tools: true });
  const result = place.run({ STUB_ORIGIN: 'http://localhost:' + port });
  assert.ok(lineFor(result, 'CORS').includes('http://localhost:' + port), result.text);
  assert.equal(result.lines[result.lines.length - 1], 'OK');
});

test('CORS fails when Sanity leaves out the allow-origin line, or answers 403, and the other checks still run', () => {
  ['missing', '403'].forEach(kind => {
    const place = setup('cors-' + kind, { tools: true, localEnv: "TELETRAAN_PORT='4321'\n" });
    const result = place.run({ STUB_ORIGIN: 'http://localhost:4321', STUB_CORS: kind });

    assert.equal(result.status, 1, kind);
    assert.equal(result.lines[result.lines.length - 1], 'FAIL', kind);
    assert.ok(lineFor(result, 'CORS').indexOf('FAIL') === 0, kind + '\n' + result.text);
    assert.ok(lineFor(result, 'CORS').includes('http://localhost:4321'), kind);
    assert.ok(lineFor(result, 'Documents').indexOf('OK') === 0, 'the checks after CORS still run');
  });
});

test('a stopped container, a kiosk that is not active and a clock out of sync each fail their own line', () => {
  const place = setup('down', { tools: true, localEnv: "TELETRAAN_PORT='4321'\n" });
  const result = place.run({ STUB_ORIGIN: 'http://localhost:4321', STUB_DOCKER: 'stopped', STUB_KIOSK: 'inactive', STUB_SYNC: 'no' });

  assert.equal(result.lines[result.lines.length - 1], 'FAIL');
  assert.ok(lineFor(result, 'Web container').indexOf('FAIL') === 0);
  assert.ok(lineFor(result, 'Kiosk').indexOf('FAIL') === 0 && lineFor(result, 'Kiosk').includes('inactive'));
  assert.ok(lineFor(result, 'Time').indexOf('FAIL') === 0);
  assert.ok(lineFor(result, 'DNS').indexOf('OK') === 0);
  assert.ok(lineFor(result, 'Dataset').indexOf('OK') === 0);
});

test('with none of the tools installed every line fails by itself and the script still reaches its last line', () => {
  const place = setup('bare', { tools: false, localEnv: "TELETRAAN_PORT='4321'\n" });
  const result = place.run();

  assert.equal(result.status, 1);
  assert.equal(result.lines[result.lines.length - 1], 'FAIL');
  ['DNS', 'Sanity', 'Dataset', 'CORS', 'BAND', 'Web container', 'Kiosk', 'Time', 'Documents'].forEach(word => {
    assert.ok(lineFor(result, word).indexOf('FAIL') === 0, 'no FAIL line for ' + word + '\n' + result.text);
  });
});

test('with no config.js to read, the Sanity checks fail with a plain line and nothing crashes', () => {
  const place = setup('no-config', { tools: true, localEnv: "TELETRAAN_PORT='4321'\n" });
  fs.rmSync(path.join(work, 'no-config/dashboard/config.js'));
  const result = place.run({ STUB_ORIGIN: 'http://localhost:4321' });

  assert.equal(result.lines[result.lines.length - 1], 'FAIL');
  assert.ok(lineFor(result, 'config:').indexOf('FAIL') === 0);
  assert.ok(lineFor(result, 'Dataset').indexOf('FAIL') === 0);
  assert.ok(lineFor(result, 'Documents').indexOf('FAIL') === 0);
  assert.ok(lineFor(result, 'Kiosk').indexOf('OK') === 0, 'the checks that do not need the config still run');
});

test('the script has valid sh syntax, is executable, and does not stop at the first failure', () => {
  const syntax = spawnSync('/bin/sh', ['-n', scriptFile], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);

  const text = fs.readFileSync(scriptFile, 'utf8');
  assert.ok(text.startsWith('#!/bin/sh\n'));
  assert.ok(!/^\s*set -[a-z]*e/m.test(text), 'set -e would stop the script at the first failing check');
  assert.ok((fs.statSync(scriptFile).mode & 0o111) !== 0, 'the script should be executable');
  assert.ok(!/\bcat\b[^\n]*local\.env/.test(text), 'local.env is never printed');
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
