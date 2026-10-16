// The Keys tab. GET /control/api/env shows each key masked (the first four characters then dots for
// a long value, dots only for a short one, "not set" for none). POST /control/api/env takes the
// changes, merges them into local.env with the rules of tools/mini/merge-env.sh, hands the whole
// merged file to the helper's write-env word, then runs the calendar sync once. A value is never
// sent back, logged or put in a message.

import fs from 'node:fs';
import { Refusal, mount, readJson, send } from '../support/http.js';
import { envPath, readEnv } from '../support/env-file.js';
import { calendarCode, incomingLines, keyNames, labels, mask, mergeEnv } from '../support/keys.js';

const calendarName = /^CALENDAR_[A-Za-z0-9_]+_URL$/;

export function describe(values) {
  return {
    keys: keyNames.map(name => ({ name: name, label: labels[name], masked: name === 'CONTROL_PIN' ? (values[name] ? '........' : 'not set') : mask(values[name]) })),
    calendars: Object.keys(values).filter(name => calendarName.test(name)).map(name => ({ name: name, code: calendarCode(name), masked: mask(values[name]) })),
  };
}

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/env', async (req, res) => {
    send(res, 200, describe(readEnv(envPath(ctx))));
  });

  mount(router, ctx, 'POST', '/env', async (req, res) => {
    const body = await readJson(req);
    const { lines, changed } = incomingLines(body);
    if (lines.length === 0) throw new Refusal(400, 'Nothing to change. Type a new value first.');

    let existing = '';
    try {
      existing = fs.readFileSync(envPath(ctx), 'utf8');
    } catch (error) {
      existing = '';
    }

    await ctx.helper('write-env', [], mergeEnv(existing, lines));
    if (typeof ctx.log === 'function') ctx.log('keys changed: ' + changed.map(item => item.name + ' ' + item.did).join(', '));

    let synced = true;
    try {
      await ctx.helper('sync-now', ['calendars']);
    } catch (error) {
      synced = false;
    }
    send(res, 200, { ok: true, changed: changed, calendarsRun: synced, ...describe(readEnv(envPath(ctx))) });
  });
}
