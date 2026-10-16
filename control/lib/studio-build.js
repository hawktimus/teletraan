// Builds the Studio for a release: npm ci in studio/ (the node_modules folder is kept by the hash of the lockfile and
// reused by the next release when the lockfile has not changed), the dashboard copied in for the panel preview, then
// sanity build into studio-dist/, which nginx serves at /studio/.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tail } from './run.js';

const minutes = 60 * 1000;

function lockHash(studio) {
  const lock = path.join(studio, 'package-lock.json');
  const bytes = fs.existsSync(lock) ? fs.readFileSync(lock) : Buffer.from('');
  const own = fs.readFileSync(path.join(studio, 'package.json'));
  return crypto.createHash('sha256').update(bytes).update(own).digest('hex').slice(0, 16);
}

// Copies a folder as hard links when the system can, so a second copy costs almost nothing
async function copyFolder(ctx, from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  const linked = await ctx.run('cp', ['-al', from, to], { timeout: 10 * minutes });
  if (linked.code !== 0) {
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(from, to, { recursive: true });
  }
}

// Returns a message for the page. Throws an Error with the reason when the build fails.
export async function buildStudio(ctx, dir) {
  const studio = path.join(dir, 'studio');
  if (!fs.existsSync(path.join(studio, 'package.json'))) return 'There is no studio folder, so the Studio was not built.';

  const cache = path.join(ctx.rootDir, 'cache', 'studio-modules');
  const hash = lockHash(studio);
  const cached = path.join(cache, hash);
  const modules = path.join(studio, 'node_modules');
  const env = Object.assign({}, process.env, { SANITY_STUDIO_BASE_PATH: '/studio', DO_NOT_TRACK: '1', CI: '1' });

  let message;
  if (fs.existsSync(cached)) {
    await copyFolder(ctx, cached, modules);
    message = 'The packages are the same as before.';
  } else {
    const install = await ctx.run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: studio, env: env, timeout: 25 * minutes });
    if (install.code !== 0) throw new Error('npm ci failed:\n' + tail(install.output));
    fs.mkdirSync(cache, { recursive: true });
    await copyFolder(ctx, modules, cached);
    // Older caches are not needed once a newer lockfile is in use
    const old = fs.readdirSync(cache).filter(name => name !== hash).sort((a, b) => fs.statSync(path.join(cache, b)).mtimeMs - fs.statSync(path.join(cache, a)).mtimeMs);
    old.slice(1).forEach(name => fs.rmSync(path.join(cache, name), { recursive: true, force: true }));
    message = 'The packages were installed.';
  }

  const copied = await ctx.run('node', ['scripts/copy-dashboard.mjs'], { cwd: studio, env: env, timeout: 2 * minutes });
  if (copied.code !== 0) throw new Error('Copying the dashboard into the Studio failed:\n' + tail(copied.output));

  const output = path.join(dir, 'studio-dist');
  const built = await ctx.run('npx', ['--no-install', 'sanity', 'build', output, '--yes'], { cwd: studio, env: env, timeout: 30 * minutes });
  if (built.code !== 0) throw new Error('sanity build failed:\n' + tail(built.output));

  // The packages are not needed in the release itself once the Studio is built
  fs.rmSync(modules, { recursive: true, force: true });
  return message + ' The Studio is built.';
}
