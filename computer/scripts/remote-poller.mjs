// The remote action poller, started by teletraan-remote.service (computer/systemd). Every 30 seconds it asks Sanity
// for the document remoteControl, which the Studio buttons Restart dashboard, Restart services and Reboot computer
// fill in, and runs the action once. It only makes outbound requests, so it works behind a school firewall as long as
// Sanity itself can be reached.
//
// Order of work, and why:
//   1. remote-plan.mjs decides: is the request new, fresh (10 minutes), allowed, and is a reboot permitted now.
//   2. The answer is written to Sanity first (lastHandledAt, lastResult). If that write fails nothing runs, so a
//      request can never run twice.
//   3. Then the fixed word goes to the host helper (control-helper.sh) through its socket. A reboot waits 5 seconds
//      after the write, and its time is saved before it is asked for, so a reboot loop is not possible.
// After each round it also keeps the read only document remote-status up to date for the Studio (every 5 minutes, or
// at once when it changed).
//
// The token is SANITY_WRITE_TOKEN from local.env. It is read here, used in one header and never logged.

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logEvent } from './jsonlog.mjs';
import { decide, firstNameOf, statusOf, statusDue, wordOf, rebootDelaySeconds } from './remote-plan.mjs';

const service = 'remote';
const pollSeconds = 30;
const documentId = 'remoteControl';

// The poll loop. Everything that touches the outside is in deps, so a test can fake it:
//   fetch, now() in milliseconds, readJson(file), writeJson(file, value), helper(word), notify(text), sleep(ms),
//   log(event, detail), and config { project, dataset, version, token, stateFile, syncFile, netwatchFile }
export function createPoller(deps) {
  const config = deps.config;
  let written = null;

  const base = 'https://' + config.project + '.api.sanity.io/v' + config.version + '/data';
  const headers = { Authorization: 'Bearer ' + config.token, 'Content-Type': 'application/json' };

  async function readDocument() {
    const query = '*[_id == "' + documentId + '"][0]{_rev, action, requestedAt, requestedBy, lastHandledAt, lastResult}';
    const answer = await deps.fetch(base + '/query/' + config.dataset + '?query=' + encodeURIComponent(query), { headers: headers });
    if (!answer.ok) throw new Error('Sanity answered ' + answer.status);
    const body = await answer.json();
    return body.result || null;
  }

  async function mutate(mutations) {
    const answer = await deps.fetch(base + '/mutate/' + config.dataset, { method: 'POST', headers: headers, body: JSON.stringify({ mutations: mutations }) });
    if (!answer.ok) throw new Error('Sanity answered ' + answer.status);
  }

  // ifRevisionID makes a second writer fail instead of overwrite
  function markHandled(doc, handledAt, result) {
    return mutate([{ patch: { id: documentId, ifRevisionID: doc._rev, set: { lastHandledAt: handledAt, lastResult: result } } }]);
  }

  function saySomething(text) {
    try {
      deps.notify(text);
    } catch (error) {
      // The push is optional
    }
  }

  async function runAction(doc, plan) {
    // The reboot time is saved before the reboot is asked for
    if (plan.word === 'reboot') deps.writeJson(config.stateFile, { lastRebootAt: new Date(deps.now()).toISOString() });
    saySomething('remote action received: ' + plan.action);

    if (plan.word === 'reboot') await deps.sleep(rebootDelaySeconds * 1000);
    try {
      await deps.helper(plan.word);
    } catch (error) {
      deps.log('action', { action: plan.action, result: 'failed', reason: String(error.message).slice(0, 120) });
      return 'failed';
    }
    deps.log('action', { action: plan.action, result: 'done' });
    return 'done';
  }

  // One round: handle a request if there is one, then keep the status document fresh
  async function pollOnce() {
    let doc;
    try {
      doc = await readDocument();
    } catch (error) {
      deps.log('poll', { result: 'cannot read Sanity', reason: String(error.message).slice(0, 120) });
      return 'unreachable';
    }

    const state = deps.readJson(config.stateFile) || {};
    const plan = decide(doc, deps.now(), state.lastRebootAt || null);
    let outcome = plan.kind;

    if (plan.kind === 'skip' || plan.kind === 'run') {
      const first = plan.kind === 'run' ? 'accepted: ' + plan.action : plan.result;
      try {
        await markHandled(doc, plan.handledAt, first);
      } catch (error) {
        deps.log('poll', { result: 'cannot write the answer, nothing was run', reason: String(error.message).slice(0, 120) });
        return 'unwritten';
      }
      doc = Object.assign({}, doc, { lastHandledAt: plan.handledAt, lastResult: first });
      if (plan.kind === 'skip') {
        deps.log('action', { action: Object.hasOwn(wordOf, doc.action) ? doc.action : 'unknown', result: plan.result });
        saySomething('remote action received: ' + (Object.hasOwn(wordOf, doc.action) ? doc.action : 'unknown') + ', not run');
      } else {
        const result = await runAction(doc, plan);
        if (plan.word !== 'reboot') {
          const last = result === 'done' ? 'done: ' + plan.action : 'failed: ' + plan.action;
          // The revision changed with the first write, so this one is unconditional
          await mutate([{ patch: { id: documentId, set: { lastResult: last } } }]).catch(() => {});
          doc.lastResult = last;
        }
        outcome = result;
      }
    } else {
      deps.log('poll', { result: 'nothing to do' });
    }

    await keepStatus(doc);
    return outcome;
  }

  async function keepStatus(doc) {
    try {
      const lastRequest = doc && doc.lastHandledAt
        ? { action: Object.hasOwn(wordOf, doc.action) ? doc.action : '', requestedBy: firstNameOf(doc.requestedBy), handledAt: doc.lastHandledAt, result: String(doc.lastResult || '').slice(0, 120) }
        : null;
      const status = statusOf(deps.readJson(config.syncFile), deps.readJson(config.netwatchFile), lastRequest);
      const now = deps.now();
      if (!statusDue(status, written, now)) return;
      await mutate([{ createOrReplace: Object.assign({}, status, { updatedAt: new Date(now).toISOString() }) }]);
      written = { at: now, text: JSON.stringify(status) };
      deps.log('status', { result: 'written', sources: status.sources.length });
    } catch (error) {
      deps.log('status', { result: 'not written', reason: String(error.message).slice(0, 120) });
    }
  }

  return { pollOnce: pollOnce };
}

// The helper socket: one line out (a fixed word), the answer ends with ok, refused or failed <code>
export function helperOver(socketPath, connect = net.createConnection) {
  return function helper(word) {
    return new Promise((resolve, reject) => {
      let answer = '';
      const socket = connect(socketPath);
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('the helper did not answer')); }, 60000);
      socket.on('connect', () => socket.end(word + '\n'));
      socket.on('data', chunk => { answer += chunk; });
      socket.on('error', () => { clearTimeout(timer); reject(new Error('the helper could not be reached')); });
      socket.on('close', () => {
        clearTimeout(timer);
        const last = answer.trimEnd().split('\n').pop() || '';
        if (last === 'ok') resolve();
        else reject(new Error('the helper said: ' + (last || 'nothing')));
      });
    });
  };
}

// The value of NAME=value in local.env, the way lib.sh reads it. Only the names asked for are looked at.
export function settingFrom(text, name) {
  const lines = text.split('\n').filter(line => line.startsWith(name + '='));
  if (lines.length === 0) return '';
  return lines[lines.length - 1].slice(name.length + 1).replace(/^['"]/, '').replace(/['"]\s*$/, '').trim();
}

function configValue(text, name) {
  const found = text.match(new RegExp('^\\s*' + name + ":\\s*'([^']*)'", 'm'));
  return found ? found[1] : '';
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return null;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value) + '\n');
}

function main() {
  const scripts = path.dirname(fileURLToPath(import.meta.url));
  const computer = path.resolve(scripts, '..');
  const envText = (() => { try { return fs.readFileSync(process.env.TELETRAAN_ENV_FILE || path.join(computer, 'local.env'), 'utf8'); } catch (error) { return ''; } })();
  const configText = fs.readFileSync(path.join(computer, '..', 'dashboard', 'config.js'), 'utf8');
  const data = settingFrom(envText, 'TELETRAAN_DATA') || '/var/lib/teletraan/data';
  const token = settingFrom(envText, 'SANITY_WRITE_TOKEN');
  const log = (event, detail) => logEvent(service, 'poller', event, detail);

  if (!/^[A-Za-z0-9]{20,}$/.test(token)) {
    log('start', { result: 'no usable SANITY_WRITE_TOKEN in local.env' });
    console.error('SANITY_WRITE_TOKEN in local.env is missing or does not look like a token.');
    process.exit(1);
  }

  const notifyScript = path.join(scripts, 'notify.sh');
  const poller = createPoller({
    fetch: fetch,
    now: () => Date.now(),
    readJson: readJson,
    writeJson: writeJson,
    helper: helperOver(process.env.CONTROL_SOCKET || '/run/teletraan/control.sock'),
    // notify.sh is written by another part of the system and is optional. It takes one text and never fails.
    notify: text => { if (fs.existsSync(notifyScript)) execFile(notifyScript, [text], { timeout: 15000 }, () => {}); },
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    log: log,
    config: {
      project: configValue(configText, 'projectId'),
      dataset: configValue(configText, 'dataset'),
      version: configValue(configText, 'apiVersion'),
      token: token,
      stateFile: path.join(data, 'remote-state.json'),
      syncFile: path.join(data, 'sync-status.json'),
      netwatchFile: '/var/lib/teletraan/netwatch.json',
    },
  });

  log('start', { result: 'running', everySeconds: pollSeconds });
  (async () => {
    for (;;) {
      try {
        await poller.pollOnce();
      } catch (error) {
        log('poll', { result: 'error', reason: String(error.message).slice(0, 120) });
      }
      await new Promise(resolve => setTimeout(resolve, pollSeconds * 1000));
    }
  })();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
