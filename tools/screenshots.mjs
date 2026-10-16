// Takes a picture of every panel in every Screen, so the work can be seen without a TV.
//
//   node tools/screenshots.mjs                  every picture
//   node tools/screenshots.mjs --only monday    only the pictures whose file name has "monday" in it
//   node tools/screenshots.mjs --only "large-tasks-*-nova,swap"   several, split by commas, * is any text
//
// It serves dashboard/ from this repository on a free local port, opens each address with
// ?sample=1&still=1 in a 1920 by 1080 browser and writes one PNG for each combination to
// _outputs/screens/<date>/ (ignored by git). It reads no live data.
//
//   large-<panel>-<screen>-<team>.png      every large panel, three Screens, both teams
//   small-<panel>-<screen>.png             every small panel, three Screens
//   monday-...-<screen>[-<team>].png       every Monday panel (the panel id starts the name), with a team where it takes one
//   competition-...-<screen>-<team>.png    the competition cards, with ?competition=1
//   countdown-<screen>.png                 the countdown in the three Screens
//   swap-team-200ms.png (and 400, 800)     one frame of the swap from Prime to Nova
//   swap-style-200ms.png (and 400, 800)    one frame of the swap from Original to Cybertron
//   announcement-plate-<screen>.png        the plate of an announcement, in the three Screens (skipped when the page draws none)
//   photos-row-<screen>.png                a Photos row of three photos of eight seconds, in the three Screens
//   view-<view>-<theme>-<team>.png         each of the four views in each of the three themes with each team (24 pictures)
//
// Playwright is a development dependency of tools/ only (tools/package.json). It is loaded with
// import() when the run starts, so the plan and the run can be tested with a stand-in
// (tests/screenshots.test.mjs). Install it on a laptop, never on the Teletraan computer.

import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const screens = ['original', 'cybertron', 'minimal'];
export const teams = ['prime', 'nova'];
export const swapTimes = [200, 400, 800];
export const views = ['general', 'prime', 'nova', 'family'];
export const themes = ['original', 'cybertron', 'retro'];

// A Monday panel that is for both teams has no team in its address
const mondayWithoutTeam = ['monday-status-depts', 'monday-overall'];

// The announcement plate of the page (core/notice-run.js): the element #notice, which has the attribute hidden
// until an announcement is live. ?notice=1 makes the sample announcement live. The picture is skipped when the
// address shows no plate.
export const announcement = {
  address: '?sample=1&still=1&panel=tasks&notice=1',
  selector: '#notice:not([hidden]) .notice-text',
  seconds: 6,
};

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..');

function takesTeam(id) {
  return !id.endsWith('-both') && !mondayWithoutTeam.includes(id);
}

function address(parts) {
  const query = ['sample=1', 'still=1'].concat(Object.keys(parts).filter(key => parts[key] !== '').map(key => key + '=' + encodeURIComponent(parts[key])));
  return '/index.html?' + query.join('&');
}

// A panel id as a file name: robotStatus is robot-status
function fileId(id) {
  return id.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
}

// The list of pictures to take, from the panels of dashboard/registry.js. Each is { name, kind, url }.
// kind is still (a panel held by ?panel=), swap, view or announcement.
export function planShots(panels) {
  const usable = panels.filter(panel => !panel.testOnly);
  const shots = [];

  usable.filter(panel => panel.region === 'grid1' && !panel.monday && !panel.competition).forEach(panel => {
    screens.forEach(screen => teams.forEach(team => {
      shots.push({ name: 'large-' + fileId(panel.id) + '-' + screen + '-' + team, kind: 'still', url: address({ panel: panel.id, screen: screen, team: team }) });
    }));
  });

  usable.filter(panel => panel.region === 'grid2').forEach(panel => {
    screens.forEach(screen => shots.push({ name: 'small-' + fileId(panel.id) + '-' + screen, kind: 'still', url: address({ panel: panel.id, screen: screen }) }));
  });

  usable.filter(panel => panel.monday).forEach(panel => {
    screens.forEach(screen => {
      if (!takesTeam(panel.id)) {
        shots.push({ name: fileId(panel.id) + '-' + screen, kind: 'still', url: address({ panel: panel.id, screen: screen }) });
        return;
      }
      teams.forEach(team => shots.push({ name: fileId(panel.id) + '-' + screen + '-' + team, kind: 'still', url: address({ panel: panel.id, screen: screen, team: team }) }));
    });
  });

  usable.filter(panel => panel.competition).forEach(panel => {
    screens.forEach(screen => teams.forEach(team => {
      shots.push({ name: fileId(panel.id) + '-' + screen + '-' + team, kind: 'still', url: address({ panel: panel.id, screen: screen, team: team, competition: '1' }) });
    }));
  });

  screens.forEach(screen => shots.push({ name: 'countdown-' + screen, kind: 'still', url: address({ panel: 'countdown', screen: screen }) }));

  // The swaps run on the moving screen, so these two have no still=1. previewRequest (core/preview.js) starts them
  // They have no team or style in the address, because those win over a preview (takeSwap puts Prime and Original in the sample settings), and night=off because the wall clock may be inside the night hours
  const moving = '/index.html?sample=1&motion=full&night=off';
  shots.push({ name: 'swap-team', kind: 'swap', url: moving, request: 'nova', frames: swapTimes });
  shots.push({ name: 'swap-style', kind: 'swap', url: moving, request: 'cybertron', frames: swapTimes });

  screens.forEach(screen => shots.push({ name: 'announcement-plate-' + screen, kind: 'announcement', url: '/index.html' + announcement.address + '&screen=' + screen }));

  // A Photos row of three photos of eight seconds, in the three Screens
  screens.forEach(screen => shots.push({ name: 'photos-row-' + screen, kind: 'still', url: address({ panel: 'photo', screen: screen, photos: '3', each: '8' }) }));

  // The views run on the moving page, held by the same requests the control page writes (showView, previewTheme).
  // ?team= and ?style= would stop the views, so the team comes from the sample settings.
  views.forEach(view => themes.forEach(theme => teams.forEach(team => {
    shots.push({ name: 'view-' + view + '-' + theme + '-' + team, kind: 'view', url: '/index.html?sample=1&motion=none&night=off', view: view, theme: theme, team: team });
  })));
  return shots;
}

// Turns --only text into a test for a file name. Several patterns are split by commas, * is any text,
// and a name matches when it has the pattern anywhere in it.
export function onlyFilter(text) {
  if (!text) return () => true;

  const tests = text.split(',').map(part => part.trim()).filter(Boolean).map(part => {
    const source = part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(source, 'i');
  });
  return name => tests.some(test => test.test(name));
}

export function todayText(now = new Date()) {
  const pad = number => String(number).padStart(2, '0');
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

function mime(file) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain' };
  return types[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

// A small server for dashboard/ on this computer only. Resolves to { port, close() }.
export function serveDashboard(folder) {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent((request.url || '/').split('?')[0]);
    const file = path.join(folder, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));

    if (!file.startsWith(folder) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, close: () => new Promise(done => server.close(done)) }));
  });
}

// Plays a still shot: opens the address, waits for the page to say it drew the panel, and takes the picture
async function takeStill(page, base, shot, file, limits) {
  const problems = [];
  page.on('pageerror', error => problems.push(error.message));

  await page.goto(base + shot.url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.stillReady === '1' || Boolean(document.documentElement.dataset.stillError), null, { timeout: limits.drawMs });

  const failed = await page.evaluate(() => document.documentElement.dataset.stillError || '');
  if (failed) throw new Error('the panel threw: ' + failed);
  if (problems.length > 0) throw new Error('the page threw: ' + problems[0]);

  await page.waitForTimeout(limits.settleMs);
  await page.screenshot({ path: file });
  return [file];
}

// The swap: the page runs as it does on the wall, and a preview request in the sample content makes it swap.
// The frames are taken at wall clock times after the pieces start to move, so each is near its time and the
// real time of each is written in the log.
async function takeSwap(page, base, shot, folder, limits, log) {
  const request = { kind: shot.request, requestedAt: new Date().toISOString() };

  await page.route('**/data/sample/content.json', async route => {
    const response = await route.fetch();
    const content = await response.json();
    const allOriginal = { monday: 'original', tuesday: 'original', wednesday: 'original', thursday: 'original', friday: 'original', saturday: 'original', sunday: 'original' };
    content.settings = Object.assign({}, content.settings, { teamMode: 'prime', screenSchedule: allOriginal, previewRequest: request });
    await route.fulfill({ response: response, json: content });
  });
  await page.addInitScript(() => {
    // A timer and not an observer: this script runs before the page has a root element to watch
    window.__swapStartedAt = 0;
    setInterval(() => {
      const world = document.getElementById('world');
      if (world && world.hasAttribute('data-pieces') && !window.__swapStartedAt) window.__swapStartedAt = performance.now();
    }, 20);
  });

  await page.goto(base + shot.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__swapStartedAt > 0, null, { timeout: limits.swapMs });

  const files = [];
  for (const ms of shot.frames) {
    await page.waitForFunction(wanted => performance.now() - window.__swapStartedAt >= wanted, ms, { timeout: limits.swapMs });
    const at = await page.evaluate(() => Math.round(performance.now() - window.__swapStartedAt));
    const file = path.join(folder, shot.name + '-' + ms + 'ms.png');

    await page.screenshot({ path: file });
    log('  ' + path.basename(file) + ' taken ' + at + ' ms after the pieces started to move');
    files.push(file);
  }
  return files;
}

// One view in one theme with one team. The sample content is changed on its way to the page so that the
// view is held for an hour and the theme is previewed. The page says which view and theme it drew in
// data-view and data-theme, and the picture waits for both.
async function takeView(page, base, shot, file, limits) {
  const until = new Date(Date.now() + 3600000).toISOString();

  await page.route('**/data/sample/content.json', async route => {
    const response = await route.fetch();
    const content = await response.json();
    content.settings = Object.assign({}, content.settings, {
      teamMode: shot.team,
      showView: { key: shot.view, until: until },
      previewTheme: { theme: shot.theme, until: until },
    });
    await route.fulfill({ response: response, json: content });
  });

  await page.goto(base + shot.url, { waitUntil: 'load' });
  await page.waitForFunction(wanted => document.documentElement.dataset.view === wanted.view && document.documentElement.dataset.theme === wanted.theme, { view: shot.view, theme: shot.theme }, { timeout: limits.swapMs });
  await page.waitForTimeout(limits.settleMs);
  await page.screenshot({ path: file });
  return [file];
}

// The plate of an announcement. Skipped, with the reason, when the page does not draw it.
async function takePlate(page, base, shot, file, limits) {
  await page.goto(base + shot.url, { waitUntil: 'load' });
  try {
    await page.waitForSelector(announcement.selector, { timeout: announcement.seconds * 1000 });
  } catch (error) {
    return { skipped: 'the dashboard draws no announcement plate yet (nothing matches ' + announcement.selector + ')' };
  }

  await page.waitForTimeout(limits.settleMs);
  await page.screenshot({ path: file });
  return [file];
}

// Runs the plan. playwright is the module (or a stand-in): { chromium: { launch() } }. Resolves to
// { written: [file], skipped: [{ name, reason }], failed: [{ name, reason }] }.
export async function runShots(options) {
  const limits = Object.assign({ drawMs: 20000, settleMs: 500, swapMs: 90000 }, options.limits);
  const log = options.log || (() => {});
  const result = { written: [], skipped: [], failed: [] };

  fs.mkdirSync(options.outFolder, { recursive: true });
  const browser = await options.playwright.chromium.launch();
  try {
    for (const shot of options.shots) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();

      try {
        const file = path.join(options.outFolder, shot.name + '.png');
        let made;
        if (shot.kind === 'swap') made = await takeSwap(page, options.base, shot, options.outFolder, limits, log);
        else if (shot.kind === 'view') made = await takeView(page, options.base, shot, file, limits);
        else if (shot.kind === 'announcement') made = await takePlate(page, options.base, shot, file, limits);
        else made = await takeStill(page, options.base, shot, file, limits);

        if (made.skipped) {
          result.skipped.push({ name: shot.name, reason: made.skipped });
          log('skipped ' + shot.name + ': ' + made.skipped);
        } else {
          result.written.push(...made);
          log('wrote ' + shot.name);
        }
      } catch (error) {
        result.failed.push({ name: shot.name, reason: error.message });
        log('FAILED ' + shot.name + ': ' + error.message);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return result;
}

// The last line: the count, what was skipped and every panel that threw
export function summaryLine(result) {
  const parts = [result.written.length + ' pictures written'];

  if (result.skipped.length > 0) parts.push(result.skipped.length + ' skipped (' + result.skipped.map(item => item.name).join(', ') + ')');
  if (result.failed.length > 0) parts.push(result.failed.length + ' failed (' + result.failed.map(item => item.name).join(', ') + ')');
  return parts.join(', ');
}

function readOptions(argv) {
  const options = { only: '' };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only' && argv[i + 1] !== undefined) options.only = argv[++i];
    else if (argv[i].startsWith('--only=')) options.only = argv[i].slice('--only='.length);
    else {
      console.error('Usage: node tools/screenshots.mjs [--only <pattern>]');
      process.exit(2);
    }
  }
  return options;
}

// Playwright, loaded only now. import() does not read NODE_PATH, so a folder named there is tried through require
export async function loadPlaywright(load = specifier => import(specifier), requireIt = createRequire(import.meta.url)) {
  try {
    const module = await load('playwright');
    return module.chromium ? module : module.default || module;
  } catch (error) {
    try {
      return requireIt('playwright');
    } catch (second) {
      return null;
    }
  }
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  const { panels } = await import(pathToFileURL(path.join(repoRoot, 'dashboard', 'registry.js')).href);
  const wanted = onlyFilter(options.only);
  const chosen = planShots(panels).filter(shot => wanted(shot.name));

  if (chosen.length === 0) {
    console.error('Nothing matches --only "' + options.only + '".');
    process.exit(2);
  }

  const playwright = await loadPlaywright();
  if (!playwright) {
    console.error('Playwright is not installed. In tools/ it is a development dependency: run npm install in tools/ on a laptop, or set NODE_PATH to a folder that has it.');
    process.exit(2);
  }

  const server = await serveDashboard(path.join(repoRoot, 'dashboard'));
  const outFolder = path.join(repoRoot, '_outputs', 'screens', todayText());
  try {
    const result = await runShots({ playwright: playwright, shots: chosen, base: 'http://127.0.0.1:' + server.port, outFolder: outFolder, log: line => console.log(line) });
    console.log('\n' + summaryLine(result) + '. Folder: ' + outFolder);
    process.exitCode = result.failed.length > 0 ? 1 : 0;
  } finally {
    await server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
