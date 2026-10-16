// Installs a release from an uploaded zip or from a folder. Each step is reported through emit({ step, state,
// message }) where state is start, done, info or fail. Before the switch any failure removes the half-built folder
// and leaves current alone. The steps are in this order and the page shows one line for each.

import fs from 'node:fs';
import path from 'node:path';
import { extractZip } from './zip.js';
import { treeHash, listFiles } from './tree-hash.js';
import { writeReleaseFiles, buildName, shortCommit } from './releases.js';
import { buildStudio } from './studio-build.js';
import { tail } from './run.js';

export const steps = ['unpack', 'files', 'schemas', 'studio', 'release', 'switch', 'restart', 'wait'];

const oldTreeMessage = 'This copy is older than round 6; update it.';
const waitSeconds = 90;

function copyFolder(from, to) {
  for (const relative of listFiles(from)) {
    const target = path.join(to, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(from, relative), target);
    fs.chmodSync(target, fs.statSync(path.join(from, relative)).mode & 0o777);
  }
}

function stop(message, status) {
  const error = new Error(message);
  error.status = status || 400;
  return error;
}

// options: { zip: Buffer } or { dir }, note, commit, from ('upload' or 'git'), emit, restart (default true), studio (default true)
export async function installRelease(ctx, options) {
  const emit = options.emit || (() => {});
  const releases = ctx.releases;
  if (ctx.state.installing) throw stop('Another update is running. Wait for it to finish.', 409);
  ctx.state.installing = true;

  let number = 0;
  let temporary = '';
  let switched = false;

  async function step(name, text, work) {
    emit({ step: name, state: 'start', message: text });
    try {
      const result = await work();
      emit({ step: name, state: 'done', message: typeof result === 'string' && result ? result : text });
      return result;
    } catch (error) {
      emit({ step: name, state: 'fail', message: error.message });
      throw error;
    }
  }

  try {
    number = releases.takeNumber();
    temporary = path.join(ctx.releasesDir, number + '.tmp');
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.mkdirSync(temporary, { recursive: true });

    await step('unpack', 'Unpack the files', () => {
      if (options.zip) return 'Unpacked ' + extractZip(options.zip, temporary) + ' files';
      copyFolder(options.dir, temporary);
      return 'Copied the files';
    });

    await step('files', 'Check the files', () => {
      if (fs.existsSync(path.join(temporary, 'deploy', 'scripts'))) throw stop(oldTreeMessage);
      for (const needed of ['dashboard/index.html', 'computer/scripts/kiosk.sh']) {
        if (!fs.existsSync(path.join(temporary, needed))) throw stop('The folder has no ' + needed + '. Pick the Teletraan repository folder.');
      }
    });

    await step('schemas', 'Check the schemas', async () => {
      const check = path.join(temporary, 'tests', 'schemas.test.mjs');
      if (!fs.existsSync(check)) return 'The folder has no schema check, so it was skipped';
      const result = await ctx.run('node', [check], { cwd: temporary, timeout: 3 * 60 * 1000 });
      if (result.code !== 0) throw stop('The schema check failed:\n' + tail(result.output, 12));
    });

    await step('studio', 'Build the Studio', async () => {
      // The web server mounts this folder, so it has to exist even when nothing was built
      fs.mkdirSync(path.join(temporary, 'studio-dist'), { recursive: true });
      // The data folder of the computer is mounted inside the read-only dashboard, and Docker cannot make that mount point itself
      fs.mkdirSync(path.join(temporary, 'dashboard', 'data', 'live'), { recursive: true });
      if (options.studio === false || process.env.CONTROL_SKIP_STUDIO === '1') return 'The Studio build was skipped';
      return buildStudio(ctx, temporary);
    });

    const info = await step('release', 'Write the release files', () => {
      const keys = path.join(ctx.rootDir, 'local.env');
      if (fs.existsSync(keys)) {
        const link = path.join(temporary, 'computer', 'local.env');
        fs.rmSync(link, { force: true });
        fs.symlinkSync(keys, link);
      }
      const written = writeReleaseFiles(temporary, {
        version: number,
        commit: options.commit,
        date: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
        from: options.from,
        note: options.note,
        treeHash: treeHash(temporary),
      });
      fs.renameSync(temporary, path.join(ctx.releasesDir, String(number)));
      temporary = '';
      return written;
    });

    const build = buildName(info.version, info.commit);
    await step('switch', 'Switch the wall to version ' + number, () => {
      releases.flip(number);
      switched = true;
      releases.prune();
    });

    if (options.restart !== false) {
      await step('restart', 'Restart the screen', async () => {
        try {
          await ctx.helper('restart-services');
          await ctx.helper('restart-kiosk');
        } catch (error) {
          throw stop('The helper did not restart the screen: ' + error.message);
        }
      }).catch(() => {});

      await step('wait', 'Wait for the screen to report', async () => {
        const seen = ctx.waitForBuild ? await ctx.waitForBuild(build, waitSeconds * 1000) : false;
        if (!seen) throw stop('The screen has not reported version ' + number + ' yet. Look at the Now showing tab in a minute.');
        return 'On the wall: v' + number;
      }).catch(() => {});
    }

    emit({ step: 'finish', state: 'done', message: 'Version ' + number + (shortCommit(info.commit) ? ' · ' + shortCommit(info.commit) : '') + ' is installed.', release: info });
    // The service runs the code of the release it started in; docker starts it again on the new one
    if (ctx.restartSelf) ctx.restartSelf();
    ctx.log('installed release ' + number + ' from ' + (options.from || 'upload'));
    return info;
  } catch (error) {
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
    if (!switched) emit({ step: 'finish', state: 'fail', message: error.message });
    ctx.log('install of release ' + number + ' failed: ' + error.message.split('\n')[0]);
    throw error;
  } finally {
    ctx.state.installing = false;
  }
}
