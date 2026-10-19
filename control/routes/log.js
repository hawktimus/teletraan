// GET /control/api/log: the last 200 lines of the control service's own log and of the helper's log (1000 with
// ?verbose=1). The service writes its log through ctx.log; the file is control.log in the data folder unless
// ctx.logFile names another, and the helper log is helper.log in the same folder.
//
// GET /control/api/log/download: one text file for a coach, teletraan-log-<date>.txt. It holds a header (release, uptime,
// disk), both logs, and what the helper reads from the computer (python3, docker, the journal of each teletraan unit).
// Every line goes through the redactor, so no key and no calendar link is in it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mount, send } from '../support/http.js';
import { lastLines } from '../support/status-parts.js';
import { redactLine, redactText } from '../lib/redact.js';

export const normalLines = 200;
export const verboseLines = 1000;
export const bundleWords = 'Keys and calendar links are hidden in this file. It is safe to send to a coach.';

function readFile(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    return '';
  }
}

function logFileOf(ctx) {
  return ctx.logFile || path.join(ctx.dataDir, 'control.log');
}

function helperLogOf(ctx) {
  return ctx.helperLogFile || path.join(path.dirname(logFileOf(ctx)), 'helper.log');
}

async function controlLines(ctx, count) {
  if (typeof ctx.logLines === 'function') return (await ctx.logLines(count)).map(redactLine);
  return lastLines(readFile(logFileOf(ctx)), count).map(redactLine);
}

function helperLines(ctx, count) {
  return lastLines(readFile(helperLogOf(ctx)), count).map(redactLine);
}

function gigabytes(bytes) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function header(ctx, now) {
  const lines = ['Teletraan I log bundle', 'Made: ' + now.toISOString(), bundleWords];
  try {
    const found = typeof ctx.listReleases === 'function' ? ctx.listReleases() : null;
    const live = found && found.releases ? found.releases.find(release => release.current || release.version === found.current) : null;
    lines.push('Release: ' + (live ? 'v' + live.version + (live.commit ? ' ' + live.commit : '') + (live.date ? ' ' + live.date : '') : 'not known'));
  } catch (error) {
    lines.push('Release: not known');
  }
  lines.push('Uptime of this computer: ' + Math.round(os.uptime() / 60) + ' minutes');
  try {
    const stat = fs.statfsSync(ctx.dataDir);
    lines.push('Disk: ' + gigabytes(stat.bavail * stat.bsize) + ' free of ' + gigabytes(stat.blocks * stat.bsize));
  } catch (error) {
    lines.push('Disk: not known');
  }
  lines.push('Control service runs on Node ' + process.version);
  return lines;
}

// The whole text of the download. The helper is asked last; when it cannot answer the bundle says so and is still made.
export async function makeBundle(ctx, now = new Date()) {
  let fromComputer = '';
  try {
    fromComputer = String(await ctx.helper('log-bundle'));
  } catch (error) {
    fromComputer = 'The computer could not be read: ' + String(error && error.message);
  }
  const parts = [
    header(ctx, now).join('\n'),
    '==== control log (last ' + verboseLines + ' lines) ====\n' + (await controlLines(ctx, verboseLines)).join('\n'),
    '==== helper log (last ' + verboseLines + ' lines) ====\n' + helperLines(ctx, verboseLines).join('\n'),
    '==== from the computer ====\n' + fromComputer,
  ];
  return redactText(parts.join('\n\n')) + '\n';
}

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/log', async (req, res) => {
    const verbose = /[?&]verbose=1(?:&|$)/.test(String(req.url || ''));
    const count = verbose ? verboseLines : normalLines;
    send(res, 200, { lines: await controlLines(ctx, count), helperLines: helperLines(ctx, count), verbose: verbose, count: count });
  });

  mount(router, ctx, 'GET', '/log/download', async (req, res) => {
    const now = new Date();
    const text = await makeBundle(ctx, now);
    const name = 'teletraan-log-' + now.toISOString().slice(0, 10) + '.txt';
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + name + '"', 'Cache-Control': 'no-store' });
    res.end(text);
  });
}
