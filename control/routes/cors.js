// GET cors: whether Sanity lets the address of this page read the dataset. The Status tab shows the answer.

import { sendJson } from '../lib/router.js';

export function register(router, ctx) {
  router.get('/control/api/cors', async (req, res) => {
    const host = String(req.headers.host || '').replace(/[^A-Za-z0-9.:\-\[\]]/g, '');
    const origin = 'http://' + (host || 'teletraan.local:3229');
    sendJson(res, 200, await ctx.cors.check(origin));
  });
}
