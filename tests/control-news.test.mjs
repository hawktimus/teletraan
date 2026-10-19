// The control page and the helper for the FRC news: the sync-now word news in the helper script and the route, the Last reads
// line, and the Sync news now button with a result (control/routes/helper.js, control/support/status-parts.js, control/static/tabs,
// computer/scripts/control-helper.sh).
//
//   node tests/control-news.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { makeWorld } from './helpers/control-world.mjs';
import * as helperRoute from '../control/routes/helper.js';
import { buildStatus } from '../control/support/status-parts.js';
import { doneWords, outcome, statusHtml } from '../control/static/tabs/render.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(path.join(repo, name), 'utf8');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-control-news-'));

// The helper script with sudo, systemctl and docker replaced by fakes that write down what they were asked
function helper() {
  const root = path.join(work, 'root');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(root, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  const log = path.join(root, 'calls.log');
  const fake = `#!/bin/sh\necho "$(basename "$0") $*" >> "${log}"\n[ "$(basename "$0")" = sudo ] && { "$@" 2>/dev/null; exit 0; }\nexit 0\n`;
  for (const name of ['sudo', 'systemctl', 'docker']) fs.writeFileSync(path.join(bin, name), fake, { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'local.env'), "CONTROL_PIN='123456'\n", { mode: 0o600 });
  return line => {
    fs.writeFileSync(log, '');
    const env = { PATH: bin + ':/usr/bin:/bin', TELETRAAN_ROOT: root, TELETRAAN_SYSTEMCTL: path.join(bin, 'systemctl'), TELETRAAN_DOCKER: path.join(bin, 'docker') };
    const result = spawnSync('sh', [path.join(repo, 'computer/scripts/control-helper.sh')], { input: line + '\n', encoding: 'utf8', env });
    const lines = result.stdout.trimEnd().split('\n');
    return { status: lines[lines.length - 1], calls: fs.readFileSync(log, 'utf8') };
  };
}

test('the helper starts the news service for sync-now news, and still refuses what it did before', () => {
  const ask = helper();
  const answer = ask('sync-now news');
  assert.equal(answer.status, 'ok');
  assert.ok(answer.calls.includes('start teletraan-news.service'), answer.calls);
  ['sync-now newz', 'sync-now news frc', 'sync-now news;reboot', 'sync-now NEWS', 'sync-now slides'].forEach(line => assert.equal(ask(line).status, 'refused', line));
});

test('the route accepts news as a target, and the old targets still work', async () => {
  const world = await makeWorld([helperRoute]);
  const call = body => world.router.call('POST', '/helper/sync-now', { body });
  assert.equal((await call({ target: 'news' })).status, 200);
  assert.equal((await call({ target: 'frc' })).status, 200);
  assert.equal((await call({ target: 'photos-drive' })).status, 200);
  assert.equal((await call({ target: 'new' })).status, 400);
  assert.deepEqual(world.helped.map(item => [item.word, ...item.args]), [['sync-now', 'news'], ['sync-now', 'frc'], ['sync-now', 'photos-drive']]);
});

test('the status has the news time and count from the status document', () => {
  const at = new Date('2026-10-19T12:00:00Z');
  const built = buildStatus({ data: { mini: { newsAt: '2026-10-19T11:30:00Z', newsCount: 4, lastFrcSyncAt: '2026-10-19T11:00:00Z' } } }, at);
  assert.equal(built.mini.news, '2026-10-19T11:30:00Z');
  assert.equal(built.mini.newsCount, 4);
  const none = buildStatus({ data: { mini: {} } }, at);
  assert.equal(none.mini.news, '');
  assert.equal(none.mini.newsCount, null);
});

test('Last reads shows FRC news with how long ago and how many headlines, and not yet when it never ran', () => {
  const at = new Date('2026-10-19T12:00:00Z');
  const withNews = statusHtml(buildStatus({ data: { mini: { newsAt: '2026-10-19T11:30:00Z', newsCount: 4 } } }, at), at);
  assert.match(withNews, /FRC news<\/dt><dd>30 minutes ago, 4 headlines</);
  const one = statusHtml(buildStatus({ data: { mini: { newsAt: '2026-10-19T11:59:00Z', newsCount: 1 } } }, at), at);
  assert.match(one, /1 headline</);
  const never = statusHtml(buildStatus({ data: { mini: {} } }, at), at);
  assert.match(never, /FRC news<\/dt><dd>not yet</);
});

test('there is a Sync news now button that sends sync-now with the target news, and its result is Done in words', () => {
  const tab = read('control/static/tabs/health.js');
  assert.match(tab, /\{ target: 'news', label: 'Sync news now' \}/);
  assert.match(tab, /run\(button, 'sync-now', \{ target: item\.target \}/);
  assert.equal(doneWords('sync-now', { target: 'news' }), 'The FRC news sync has started.');
  assert.deepEqual(outcome({ ok: true }, 'sync-now', { target: 'news' }), { state: 'done', words: 'Done. The FRC news sync has started.' });
  assert.equal(outcome({ ok: false, error: 'The helper refused sync-now' }, 'sync-now', { target: 'news' }).state, 'bad');
});

finish();
