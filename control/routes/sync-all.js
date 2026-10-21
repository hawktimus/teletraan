// POST /control/api/sync-all: runs every sync on the Teletraan computer, one after another (calendars, Monday,
// competition, FRC news, Match13, Drive photos), and answers with a line for each. An optional body { skip: [...] }
// leaves out the syncs that are switched off. The helper does the work (routes/helper.js has the same targets one by one).

import { Refusal, mount, readJson, send } from '../support/http.js';
import { runSyncAll, summaryWords, syncTargets } from '../support/sync-all.js';

export function register(router, ctx) {
  mount(router, ctx, 'POST', '/sync-all', async (req, res) => {
    const body = await readJson(req);
    const skip = body.skip === undefined ? [] : body.skip;
    const known = syncTargets.map(item => item.target);
    if (!Array.isArray(skip) || !skip.every(target => known.includes(target))) throw new Refusal(400, 'Skip only: ' + known.join(', ') + '.');

    const answer = await runSyncAll(ctx.helper, skip, ctx.log);
    send(res, 200, Object.assign({ summary: summaryWords(answer) }, answer));
  });
}
