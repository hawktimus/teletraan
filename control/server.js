// The control service. It uses only what Node ships with. nginx proxies /control/ to it; it listens on the
// Docker network and nowhere else. Pages and calls need the PIN cookie (lib/auth.js), except the sign-in
// itself and the dashboard's own report from this computer (POST /control/api/now through the local nginx).

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter, sendJson, readJson } from './lib/router.js';
import { createAuth, clientAddress, sameOrigin } from './lib/auth.js';
import { parseEnv } from './lib/env-merge.js';
import { createReleases } from './lib/releases.js';
import { createHelper } from './lib/helper-client.js';
import { createCorsCheck } from './lib/cors.js';
import { run } from './lib/run.js';
import { isFresh, staticHeaders } from './lib/static-files.js';
import { register as registerRoutes } from './routes/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const staticFolder = path.join(here, 'static');

// What anyone may fetch before signing in
const openFiles = ['login.html', 'login.js', 'style.css'];

export function readConfig(env = process.env) {
  const root = env.CONTROL_ROOT || '/opt/teletraan';
  return {
    port: Number(env.CONTROL_PORT) || 3230,
    host: env.CONTROL_HOST || '0.0.0.0',
    rootDir: root,
    releasesDir: env.CONTROL_RELEASES || path.join(root, 'releases'),
    dataDir: env.CONTROL_DATA || '/var/lib/teletraan/data',
    envFile: env.CONTROL_ENV_FILE || path.join(root, 'local.env'),
    secretFile: env.CONTROL_SECRET_FILE || path.join(root, 'control-secret'),
    lockoutFile: env.CONTROL_LOCKOUT_FILE || path.join(root, 'control-lockout.json'),
    socket: env.CONTROL_SOCKET || '/run/teletraan/control.sock',
    logFile: env.CONTROL_LOG_FILE || path.join(root, 'logs', 'control.log'),
  };
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    return '';
  }
}

// The project, dataset and API version the dashboard reads, taken from its config file
function readProject(rootDir) {
  const text = readText(path.join(rootDir, 'current', 'dashboard', 'config.js'));
  const pick = name => (new RegExp(name + ":\\s*'([^']+)'").exec(text) || [])[1] || '';
  return { projectId: pick('projectId') || 'ybfqe345', dataset: pick('dataset') || 'production', apiVersion: pick('apiVersion') || '2025-02-19' };
}

// The folder that holds dashboard/ and computer/: the live release when there is one, else the folder this
// service itself runs from. rootDir holds releases, local.env and the cache, and has no dashboard/ of its own.
function releaseRoot(rootDir) {
  const live = path.join(rootDir, 'current');
  return fs.existsSync(path.join(live, 'dashboard', 'config.js')) ? live : path.resolve(here, '..');
}

export async function createService(config, overrides = {}) {
  const router = createRouter();
  const releases = createReleases(config.releasesDir);

  const log = line => {
    const text = new Date().toISOString() + ' ' + String(line).replace(/[\u0000-\u001f]/g, ' ');
    try {
      fs.mkdirSync(path.dirname(config.logFile), { recursive: true });
      fs.appendFileSync(config.logFile, text + '\n');
    } catch (error) {
      // a log that cannot be written must not stop the service
    }
  };

  const env = () => parseEnv(readText(config.envFile));
  const auth = createAuth({ getOverride: () => env().CONTROL_PIN, secretFile: config.secretFile, stateFile: config.lockoutFile });
  const project = readProject(config.rootDir);

  const ctx = {
    dataDir: config.dataDir,
    releasesDir: config.releasesDir,
    rootDir: config.rootDir,
    envFile: config.envFile,
    logFile: config.logFile,
    releases: releases,
    state: {},
    auth: auth,
    env: env,
    log: log,
    run: run,
    helper: createHelper(config.socket),
    root: releaseRoot(config.rootDir),
    logLines: async count => {
      const lines = readText(config.logFile).split('\n').filter(Boolean);
      return lines.slice(-count);
    },
    listReleases: () => {
      const list = releases.list();
      return { releases: list.map(item => Object.assign({ number: item.version }, item)), current: releases.currentNumber() || null };
    },
    corsResult: () => ctx.state.cors || null,
    cors: createCorsCheck({ projectId: project.projectId, dataset: project.dataset, apiVersion: project.apiVersion }),
    pinCheck: req => auth.isAuthed(req),
  };
  Object.assign(ctx, overrides);

  // The Status tab reads the last answer; it is asked again every five minutes
  ctx.refreshCors = async () => {
    ctx.state.cors = await ctx.cors.check(process.env.CONTROL_ORIGIN || 'http://teletraan.local:3229');
  };

  // The build the install waits for: the dashboard posts it every 10 seconds (routes/now.js keeps ctx.state.now)
  ctx.waitForBuild = overrides.waitForBuild || (async (build, milliseconds) => {
    const end = Date.now() + milliseconds;
    while (Date.now() < end) {
      const now = ctx.state.now;
      if (now && now.build === build) return true;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return false;
  });

  // The tab files in static/: tab-*.js here and the tabs of the other pages in tabs/. A file that calls registerTab adds a tab and
  // one that calls extendTab adds a block to a tab (static/tabs.js).
  function tabFiles() {
    const found = fs.readdirSync(staticFolder).filter(name => /^tab-[a-z-]+\.js$/.test(name) && fs.readFileSync(path.join(staticFolder, name), 'utf8').includes('registerTab('));
    const folder = path.join(staticFolder, 'tabs');
    if (fs.existsSync(folder)) {
      fs.readdirSync(folder).filter(name => name.endsWith('.js')).forEach(name => {
        const text = fs.readFileSync(path.join(folder, name), 'utf8');
        if (text.includes('registerTab(') || text.includes('extendTab(')) found.push('tabs/' + name);
      });
    }
    return found.sort();
  }

  router.get('/session', (req, res) => {
    sendJson(res, 200, { signedIn: auth.isAuthed(req) });
  });

  router.post('/login', async (req, res) => {
    const body = await readJson(req);
    const result = auth.attempt(clientAddress(req), body.pin);
    if (result.ok) {
      sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieHeader(result.cookie) });
    } else if (result.blockedSeconds) {
      log('sign-in blocked for ' + clientAddress(req));
      sendJson(res, 429, { error: 'Too many wrong tries. Try again in ' + Math.ceil(result.blockedSeconds / 60) + ' minutes.', blockedSeconds: result.blockedSeconds });
    } else {
      sendJson(res, 401, { error: 'That PIN is not right.', triesLeft: result.triesLeft });
    }
  });

  router.post('/logout', (req, res) => {
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieHeader('gone').replace(/Max-Age=\d+/, 'Max-Age=0') });
  });

  router.get('/tabs', (req, res) => {
    sendJson(res, 200, { tabs: tabFiles() });
  });

  await registerRoutes(router, ctx);

  function serveStatic(req, res, pathname) {
    let name = pathname === '/control/' || pathname === '/control' ? 'index.html' : pathname.replace(/^\/control\//, '');
    const signedIn = auth.isAuthed(req);
    if (!signedIn && !(openFiles.includes(name) || name.startsWith('fonts/'))) {
      // A page asks for the sign-in form; a script or stylesheet gets a plain refusal, not a page in its place
      if (/\.(js|mjs|css|woff2|json)$/.test(name)) {
        sendJson(res, 401, { error: 'Sign in with the PIN first.' });
        return;
      }
      name = 'login.html';
    }
    const file = path.join(staticFolder, name);
    const inside = path.relative(staticFolder, file);
    if (inside.startsWith('..') || path.isAbsolute(inside) || inside.split(path.sep).some(part => part.startsWith('.'))) {
      sendJson(res, 404, { error: 'Not found.' });
      return;
    }
    fs.readFile(file, (error, bytes) => {
      if (error) {
        sendJson(res, 404, { error: 'Not found.' });
        return;
      }
      const headers = staticHeaders(file, bytes);
      if (isFresh(req.headers, headers.ETag)) {
        res.writeHead(304, headers);
        res.end();
        return;
      }
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : bytes);
    });
  }

  const server = http.createServer(async (req, res) => {
    const pathname = req.url.split('?')[0];
    try {
      if (pathname.startsWith('/control/api/')) {
        // The routes are written after /control/api. The dashboard's own report (POST /now) carries no PIN; its
        // route accepts it only when nginx says it came from this computer (X-Real-IP).
        const route = pathname.slice('/control/api'.length);
        if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
          sendJson(res, 403, { error: 'That call did not come from this page.' });
          return;
        }
        const open = (req.method === 'GET' && route === '/session') || (req.method === 'POST' && (route === '/login' || route === '/logout' || route === '/now'));
        if (!open && !(await ctx.pinCheck(req))) {
          sendJson(res, 401, { error: 'Sign in with the PIN first.' });
          return;
        }
        const found = router.match(req.method, route);
        if (!found) {
          const allowed = router.methodsFor(route);
          sendJson(res, allowed.length ? 405 : 404, { error: allowed.length ? 'That method is not allowed here.' : 'Not found.' });
          return;
        }
        req.params = found.params;
        await found.handler(req, res, found.params);
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: 'That method is not allowed here.' });
        return;
      }
      if (pathname === '/control' || pathname.startsWith('/control/')) {
        serveStatic(req, res, pathname);
        return;
      }
      sendJson(res, 404, { error: 'Not found.' });
    } catch (error) {
      log('error on ' + req.method + ' ' + pathname + ': ' + error.message);
      if (!res.headersSent) sendJson(res, error.status || 500, { error: error.message });
      else res.end();
    }
  });

  return { server: server, ctx: ctx, router: router };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = readConfig();
  const { server, ctx } = await createService(config);
  server.requestTimeout = 0;
  // Docker starts the service again, now on the code of the release that current points at
  ctx.restartSelf = () => setTimeout(() => process.exit(0), 5000);
  ctx.refreshCors().catch(() => {});
  setInterval(() => ctx.refreshCors().catch(() => {}), 5 * 60 * 1000).unref();
  server.listen(config.port, config.host, () => ctx.log('control service listening on port ' + config.port));
}
