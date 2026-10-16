// GET /control/api/status: what the Mini is running and how fresh its reads are, with the reason
// behind each of the three dots. Anything that cannot be found out shows as not known.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mount, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { buildStatus, lineStarting, statusQuery } from '../support/status-parts.js';

// The releases that are kept, newest first, and the one that runs. The release code (lane CA)
// may offer them as ctx.listReleases(); otherwise the folders under releasesDir are read.
async function releaseFacts(ctx) {
  if (typeof ctx.listReleases === 'function') {
    const found = await ctx.listReleases();
    return { releases: found.releases || [], current: found.current };
  }

  const releases = [];
  try {
    fs.readdirSync(ctx.releasesDir, { withFileTypes: true }).forEach(entry => {
      if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) return;
      releases.push({ number: Number(entry.name) });
    });
  } catch (error) {
    // no releases folder yet
  }
  releases.sort((a, b) => b.number - a.number);

  let current = null;
  try {
    const link = fs.readlinkSync(path.join(ctx.releasesDir, 'current'));
    current = Number(path.basename(link));
  } catch (error) {
    // not a link
  }
  return { releases: releases, current: Number.isFinite(current) ? current : null };
}

function diskFacts(ctx) {
  try {
    const stat = fs.statfsSync(ctx.dataDir);
    return { freeBytes: stat.bavail * stat.bsize, totalBytes: stat.blocks * stat.bsize };
  } catch (error) {
    return null;
  }
}

function corsFacts(ctx) {
  if (typeof ctx.corsResult === 'function') return ctx.corsResult();
  try {
    return JSON.parse(fs.readFileSync(path.join(ctx.dataDir, 'cors-check.json'), 'utf8'));
  } catch (error) {
    return null;
  }
}

function tailscaleFrom(hostText) {
  const told = lineStarting(hostText, 'tailscale');
  if (told) return told;
  const found = Object.entries(os.networkInterfaces()).find(([name]) => name.startsWith('tailscale'));
  const address = found ? found[1].find(item => item.family === 'IPv4') : null;
  return address ? address.address : '';
}

export async function gather(ctx) {
  let host = '';
  try {
    host = String(await ctx.helper('status', [])).slice(0, 4000);
  } catch (error) {
    host = '';
  }

  let data = null;
  let sanity = { ok: true, error: '' };
  try {
    data = await makeSanity(ctx).query(statusQuery);
  } catch (error) {
    sanity = { ok: false, error: String(error && error.message).slice(0, 150) };
  }

  const found = await releaseFacts(ctx);
  return buildStatus({
    releases: found.releases,
    current: found.current,
    host: host,
    sanity: sanity,
    data: data,
    cors: corsFacts(ctx),
    disk: diskFacts(ctx),
    tailscale: tailscaleFrom(host),
  }, new Date());
}

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/status', async (req, res) => {
    send(res, 200, await gather(ctx));
  });
}
