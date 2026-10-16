// GET releases, POST releases (a zip and a note, answered as one JSON line per install step), and
// POST releases/<n>/activate for a rollback or a roll forward.

import { sendJson, readBody } from '../lib/router.js';
import { parseMultipart } from '../lib/multipart.js';
import { installRelease } from '../lib/install.js';
import { limits } from '../lib/zip.js';
import { shortCommit } from '../lib/releases.js';

export function register(router, ctx) {
  router.get('/control/api/releases', (req, res) => {
    sendJson(res, 200, { current: ctx.releases.currentNumber(), releases: ctx.releases.list() });
  });

  router.post('/control/api/releases', async (req, res) => {
    const body = await readBody(req, limits.zipBytes + 1024 * 1024);
    const form = parseMultipart(body, req.headers['content-type']);
    const file = form.files.zip;
    if (!file || file.data.length === 0) {
      sendJson(res, 400, { error: 'The upload has no zip file.' });
      return;
    }
    if (file.data.length > limits.zipBytes) {
      sendJson(res, 413, { error: 'The zip is larger than 100 MB.' });
      return;
    }
    const note = String(form.fields.note || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
    const commit = shortCommit(form.fields.commit);

    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    const emit = event => res.write(JSON.stringify(event) + '\n');
    try {
      await installRelease(ctx, { zip: file.data, note: note, commit: commit, from: 'upload', emit: emit });
    } catch (error) {
      // installRelease has already told the page which step failed
    }
    res.end();
  });

  router.post('/control/api/releases/:n/activate', async (req, res, params) => {
    const n = Number(params.n);
    const release = ctx.releases.activate(n);
    ctx.log('activated release ' + n);
    if (ctx.restartSelf) ctx.restartSelf();
    const services = await ctx.helper('restart-services');
    const kiosk = await ctx.helper('restart-kiosk');
    sendJson(res, 200, { ok: true, release: release, restarted: services.ok && kiosk.ok, message: services.ok && kiosk.ok ? '' : 'The wall switched, but the helper did not restart the screen.' });
  });
}
