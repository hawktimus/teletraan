// GET /control/api/log: the last 200 lines of the control service's own log. The service writes
// it through ctx.log; the file is control.log in the data folder unless ctx.logFile names another.

import fs from 'node:fs';
import path from 'node:path';
import { mount, send } from '../support/http.js';
import { lastLines } from '../support/status-parts.js';

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/log', async (req, res) => {
    if (typeof ctx.logLines === 'function') return send(res, 200, { lines: await ctx.logLines(200) });

    let text = '';
    try {
      text = fs.readFileSync(ctx.logFile || path.join(ctx.dataDir, 'control.log'), 'utf8');
    } catch (error) {
      text = '';
    }
    send(res, 200, { lines: lastLines(text, 200) });
  });
}
