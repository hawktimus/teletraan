// A place for the control route tests: a temporary data folder, a local.env with fake values, a fake
// Sanity that records what it is asked, and a fake helper that records its words. Nothing leaves the process.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRouter } from './router-stub.mjs';

export const repo = fileURLToPath(new URL('../../', import.meta.url));

// options: env (the text of local.env), answers (what fake Sanity returns for a query, by a word in the query),
// pin (what pinCheck gives)
export async function makeWorld(registers, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-control-'));
  const dataDir = path.join(root, 'data');
  const releasesDir = path.join(root, 'releases');
  fs.mkdirSync(dataDir);
  fs.mkdirSync(releasesDir);
  const envFile = path.join(root, 'local.env');
  if (options.env !== null) fs.writeFileSync(envFile, options.env === undefined ? "SANITY_WRITE_TOKEN='skFAKEtoken0123456789'\nCONTROL_PIN='123456'\n" : options.env);

  const world = { root, dataDir, releasesDir, envFile, fetched: [], helped: [], logged: [], pin: options.pin !== false };

  const ctx = {
    root: repo,
    dataDir, releasesDir, envFile,
    log: line => world.logged.push(line),
    pinCheck: () => world.pin,
    helper: async (word, args, stdin) => {
      world.helped.push({ word, args, stdin });
      if (options.helperFails && options.helperFails.includes(word)) throw new Error('the helper refused ' + word);
      return word === 'status' ? (options.hostStatus || 'kiosk: running since 08:00\ndisplay: output HDMI-1, mode 1920x1080, scale 1x1\ntailscale: 100.64.0.7\n') : 'done';
    },
    fetch: async (url, init) => {
      world.fetched.push({ url: String(url), init: init || {} });
      if (options.offline) throw new Error('the network is down');
      // A long question goes in the body (support/sanity.js queryLong), so a query is matched on its body too
      const text = decodeURIComponent(String(url)) + (String(url).includes('/data/query/') && init && init.body ? ' ' + String(init.body) : '');
      const key = Object.keys(options.answers || {}).find(word => text.includes(word));
      const body = key ? options.answers[key] : { result: null };
      return { ok: true, status: 200, json: async () => body };
    },
  };

  const router = makeRouter();
  for (const module of registers) module.register(router, ctx);
  world.router = router;
  world.ctx = ctx;
  return world;
}
