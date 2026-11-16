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

export const steps = ['unpack', 'files', 'schemas', 'syntax', 'tests', 'studio', 'release', 'switch', 'restart', 'wait', 'units'];

const oldTreeMessage = 'This copy is older than round 6; update it.';
const waitSeconds = 90;
// The quick suite of the new tree is run before the switch (it is the gate of an update), at most this long
const quickTestsMinutes = 12;
// How many node --check processes run at the same time. The computer is a 2011 Mac Mini.
const syntaxAtOnce = 3;

// Every JavaScript file of the dashboard that the screen loads, as paths relative to the tree. The data folder and the
// vendored libraries are not ours to judge.
function dashboardModules(tree) {
  const base = path.join(tree, 'dashboard');
  if (!fs.existsSync(base)) return [];
  return listFiles(base).filter(name => /\.(m?js)$/.test(name) && !name.startsWith('data/') && !name.startsWith('vendor/')).map(name => path.join('dashboard', name));
}

// node --check on each module: a syntax error in any file the screen loads would leave the wall on a blank page, and it
// is cheaper to find that here than after the switch. Returns the first lines of every file that does not parse.
export async function checkModules(ctx, tree) {
  const files = dashboardModules(tree);
  const bad = [];
  let next = 0;
  async function worker() {
    while (next < files.length) {
      const file = files[next++];
      const result = await ctx.run('node', ['--check', file], { cwd: tree, timeout: 60 * 1000 });
      if (result.code !== 0) bad.push(file + ': ' + String(result.output || '').split('\n').filter(Boolean).slice(0, 3).join(' '));
    }
  }
  await Promise.all(Array.from({ length: syntaxAtOnce }, worker));
  return { count: files.length, bad: bad.sort() };
}

function copyFolder(from, to) {
  for (const relative of listFiles(from)) {
    const target = path.join(to, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(from, relative), target);
    // The web server runs as another user, so every file must be readable by anyone: a folder copied from a Mac can hold files only the owner may read
    fs.chmodSync(target, fs.statSync(path.join(from, relative)).mode & 0o777 | 0o444);
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

  // The new release did not come up: current goes back to the one before, the screen is restarted on it, and the page is
  // told in so many words. The release that failed is kept in the list, so it can be looked at.
  async function rollBack(failure) {
    const back = releases.currentNumber() === number ? before : null;
    emit({ step: 'rollback', state: 'start', message: 'Go back to the version before' });
    if (!back) {
      emit({ step: 'rollback', state: 'fail', message: 'There is no earlier version to go back to.' });
      emit({ step: 'finish', state: 'fail', message: 'Update failed: ' + failure.message + ' There was no earlier version to go back to. Look at the Now tab.' });
      return failure;
    }
    try {
      releases.flip(back);
      await ctx.helper('restart-services');
      await ctx.helper('restart-kiosk');
      emit({ step: 'rollback', state: 'done', message: 'The wall is back on version ' + back + '.' });
    } catch (error) {
      emit({ step: 'rollback', state: 'fail', message: 'Going back did not finish: ' + error.message });
    }
    const said = 'Update rolled back. Version ' + number + ' did not come up: ' + failure.message;
    emit({ step: 'finish', state: 'fail', message: said });
    // The service runs the code of the release it started in
    if (ctx.restartSelf) ctx.restartSelf();
    ctx.log('release ' + number + ' rolled back to ' + back + ': ' + String(failure.message).split('\n')[0]);
    failed = true;
    return stop(said, 500);
  }

  let before = null;
  let failed = false;

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

    await step('syntax', 'Check that every dashboard file reads', async () => {
      const found = await checkModules(ctx, temporary);
      if (found.bad.length > 0) throw stop('These dashboard files have a syntax error, so nothing was switched:\n' + found.bad.slice(0, 8).join('\n'));
      return 'All ' + found.count + ' dashboard files read';
    });

    // The quick suite of the new tree. The control service runs in a small container, and the shell tests need bash and jq,
    // which it may not have: then the step says it was skipped and why, and the checks above and the ones after the
    // switch still stand. It is never skipped without a word.
    await step('tests', 'Run the quick tests', async () => {
      const check = path.join(temporary, 'tests', 'run.mjs');
      if (!fs.existsSync(check)) return 'The folder has no test runner, so the tests were skipped';
      const tools = await ctx.run('sh', ['-c', 'command -v bash && command -v jq'], { cwd: temporary, timeout: 10 * 1000 });
      if (tools.code !== 0) return 'Skipped: bash or jq is missing in this service, so the shell tests cannot run here';
      const result = await ctx.run('node', [check, '--quick'], { cwd: temporary, timeout: quickTestsMinutes * 60 * 1000 });
      if (result.code !== 0) throw stop('The quick tests failed, so nothing was switched:\n' + tail(result.output, 14));
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
    // The release the wall was on, so a switch that does not work can be undone
    before = releases.currentNumber();
    await step('switch', 'Switch the wall to version ' + number, () => {
      releases.flip(number);
      switched = true;
      releases.prune();
    });

    if (options.restart !== false) {
      try {
        await step('restart', 'Restart the screen', async () => {
          try {
            await ctx.helper('restart-services');
            await ctx.helper('restart-kiosk');
          } catch (error) {
            throw stop('The helper did not restart the screen: ' + error.message);
          }
        });

        await step('wait', 'Wait for the screen to report', async () => {
          const seen = ctx.waitForBuild ? await ctx.waitForBuild(build, waitSeconds * 1000) : false;
          if (!seen) throw stop('The screen has not reported version ' + number + ' yet.');
          return 'On the wall: v' + number;
        });
      } catch (failure) {
        throw await rollBack(failure);
      }

      await step('units', 'Check the services of this computer', async () => {
        try {
          const answer = String(await ctx.helper('units-check') || '').trim();
          return answer ? answer.split('\n')[0].slice(0, 200) : 'The services of this computer were not checked';
        } catch (error) {
          return 'The services of this computer could not be checked';
        }
      });
    }

    emit({ step: 'finish', state: 'done', message: 'Version ' + number + (shortCommit(info.commit) ? ' · ' + shortCommit(info.commit) : '') + ' is installed.', release: info });
    // The service runs the code of the release it started in; docker starts it again on the new one
    if (ctx.restartSelf) ctx.restartSelf();
    ctx.log('installed release ' + number + ' from ' + (options.from || 'upload'));
    return info;
  } catch (error) {
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
    if (!switched && !failed) emit({ step: 'finish', state: 'fail', message: error.message });
    ctx.log('install of release ' + number + ' failed: ' + error.message.split('\n')[0]);
    throw error;
  } finally {
    ctx.state.installing = false;
  }
}
