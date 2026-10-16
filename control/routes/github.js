// GET github/latest (the newest commit on GitHub and whether the wall already has it) and POST github/update
// (download that commit and install it, answered as one JSON line per step like POST releases).

import { sendJson } from '../lib/router.js';
import { installRelease } from '../lib/install.js';
import { startSteps } from '../lib/stream.js';
import { latest, download } from '../lib/github.js';
import { shortCommit } from '../lib/releases.js';

// The release on the wall: its version and short commit, or nulls
function wallRelease(ctx) {
  const live = ctx.releases.list().find(release => release.current);
  return live ? { version: live.version, short: shortCommit(live.commit) } : { version: null, short: '' };
}

function onWall(wall, commit) {
  return Boolean(wall.short) && commit.startsWith(wall.short);
}

export function register(router, ctx) {
  router.get('/github/latest', async (req, res) => {
    try {
      const found = await latest(ctx);
      const wall = wallRelease(ctx);
      sendJson(res, 200, Object.assign({}, found, { onWall: onWall(wall, found.commit), wall: wall }));
    } catch (error) {
      sendJson(res, error.status || 502, { error: error.message });
    }
  });

  router.post('/github/update', async (req, res) => {
    if (ctx.state.installing || ctx.state.downloading) {
      sendJson(res, 409, { error: 'Another update is running. Wait for it to finish.' });
      return;
    }
    // Held through the download so a second press cannot start a second one
    ctx.state.downloading = true;
    const emit = startSteps(res);
    try {
      let found;
      let zip;
      emit({ step: 'download', state: 'start', message: 'Download from GitHub' });
      try {
        found = await latest(ctx);
        zip = await download(ctx, found.commit);
        emit({ step: 'download', state: 'done', message: 'Downloaded ' + found.short + ' (' + Math.round(zip.length / 1024) + ' KB)' });
      } catch (error) {
        emit({ step: 'download', state: 'fail', message: error.message });
        emit({ step: 'finish', state: 'fail', message: error.message });
        return;
      } finally {
        ctx.state.downloading = false;
      }
      const note = ('From GitHub ' + found.short + ' ' + found.message).slice(0, 200);
      try {
        await installRelease(ctx, { zip: zip, note: note, commit: found.commit, from: 'github', emit: emit });
      } catch (error) {
        // installRelease has already told the page which step failed
      }
    } finally {
      ctx.state.downloading = false;
      res.end();
    }
  });
}
