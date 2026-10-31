// Draws the control page in a browser (Playwright) at three sizes, in light and dark, in six states, and writes one PNG for each
// to docs/reference/control-page/. The service is the real one with a fake computer around it (tests/helpers/control-page-harness.mjs),
// so the pictures come from made-up data and nothing leaves this machine.
//
//   node tools/control-screens.mjs                   the whole set
//   node tools/control-screens.mjs --only syncing    one state
//   node tools/control-screens.mjs --out some/folder
//
// A file is named <state>-<area>-<phone|tablet|desktop>-<light|dark>.png. Which areas are drawn in a state is in `plan`: a state that
// is about the computer says nothing new on Show, so it is drawn only where it changes the page.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startControl } from '../tests/helpers/control-page-harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sizes = [['phone', 390, 844], ['tablet', 768, 1024], ['desktop', 1440, 900]];
const allAreas = ['now', 'show', 'update', 'computer', 'details'];

// state: [the scenario of the fake computer, the areas to draw, what to do on the page before the picture]
const plan = {
  'all-good': { scenario: 'good', areas: allAreas },
  'calendar-failed': { scenario: 'calendar-failed', areas: ['now', 'update'] },
  syncing: { scenario: 'good', areas: ['now', 'update'], busy: true },
  unreachable: { scenario: 'good', areas: ['now', 'computer'], away: true },
  'publish-in-progress': { scenario: 'good', areas: ['update/publish'], publish: true },
  empty: { scenario: 'empty', areas: allAreas },
};

const releases = {
  current: 14,
  releases: [
    { version: 14, number: 14, current: true, legacy: false, commit: '9f8e7d6', date: new Date(Date.now() - 3 * 3600000).toISOString(), note: 'Agenda page fix' },
    { version: 13, number: 13, current: false, legacy: false, commit: '4c2b1a0', date: new Date(Date.now() - 30 * 3600000).toISOString(), note: 'Roster update' },
  ],
};

// A publish that has downloaded and unpacked, is checking the files, and has not finished: the page of the install stream
const publishScript = `
  const real = window.fetch;
  window.fetch = (url, options) => {
    const text = String(url);
    const json = body => Promise.resolve(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }));
    if (text.includes('api/github/latest')) return json({ short: 'a1b2c3d', message: 'Fix the agenda page', onWall: false, wall: { version: 14, short: '9f8e7d6' } });
    if (text.includes('api/github/update')) {
      const lines = [{ step: 'download', state: 'done', message: 'Downloaded the files.' }, { step: 'unpack', state: 'done', message: 'Unpacked the files.' }, { step: 'files', state: 'start', message: 'Checking the files' }];
      const stream = new ReadableStream({ start(controller) { const encoder = new TextEncoder(); lines.forEach(line => controller.enqueue(encoder.encode(JSON.stringify(line) + '\\n'))); } });
      return Promise.resolve(new Response(stream, { status: 200 }));
    }
    return real(url, options);
  };
`;

function options() {
  const args = process.argv.slice(2);
  const pick = name => (args.includes(name) ? args[args.indexOf(name) + 1] : '');
  return { only: pick('--only'), out: pick('--out') || path.join(here, '..', 'docs', 'reference', 'control-page') };
}

async function draw(world, state, area, size, dark, out) {
  const [label, width, height] = size;
  const settings = plan[state];
  const { context, page } = await world.open(width, height, area, { dark: dark });
  if (settings.publish) await page.addInitScript(publishScript);
  await page.route('**/api/releases', route => (route.request().method() === 'GET' && state !== 'empty' ? route.fulfill({ json: releases }) : route.continue()));
  await page.reload();
  await page.waitForSelector('#tabs a');
  await page.waitForTimeout(1800);

  if (settings.busy) {
    world.set({ helperDelay: 60000 });
    await page.click('main button[data-action="sync-everything"]');
    await page.waitForTimeout(700);
  }
  if (settings.away) {
    await page.route('**/api/overview', route => route.abort());
    await page.evaluate(() => import('./poll.js').then(module => module.refreshNow()));
    await page.waitForSelector('#offline:not([hidden])');
  }
  if (settings.publish) {
    await page.waitForSelector('button:has-text("Update from GitHub"):not([disabled])');
    await page.click('button:has-text("Update from GitHub")');
    await page.click('dialog.ask [data-ask="yes"]');
    await page.waitForSelector('.flow li[data-state="working"]');
  }
  const file = state + '-' + area.replace('/', '-') + '-' + label + '-' + (dark ? 'dark' : 'light') + '.png';
  await page.screenshot({ path: path.join(out, file) });
  await context.close();
  world.set({ helperDelay: 0 });
  return file;
}

const { only, out } = options();
fs.mkdirSync(out, { recursive: true });
const world = await startControl({ scenario: 'good' });
if (!world) {
  console.error('Playwright is not installed. In tools/ it is a development dependency: run npm install in tools/ on a laptop, or set NODE_PATH to a folder that has it.');
  process.exit(2);
}
let total = 0;
let bytes = 0;
try {
  for (const state of Object.keys(plan)) {
    if (only && state !== only) continue;
    world.set({ scenario: plan[state].scenario });
    for (const area of plan[state].areas) {
      for (const size of sizes) {
        for (const dark of [false, true]) {
          const file = await draw(world, state, area, size, dark, out);
          total += 1;
          bytes += fs.statSync(path.join(out, file)).size;
        }
      }
    }
    console.log(state + ': done');
  }
} finally {
  await world.close();
}
console.log(total + ' pictures, ' + (bytes / 1048576).toFixed(1) + ' MB, in ' + out);
process.exit(0);
