// What the pictures of a row in the Display tab cost the computer that opens the page (docs/control-page.md, "Pictures of a row").
// It starts the real control service on a fake address (tests/helpers/display-world.mjs), opens the Display tab in Chromium
// in four ways and prints one line of numbers for each: memory of the whole browser, CPU over 10 seconds, the frame rate of
// the page. The memory of the browser (rssMB) changes by 50 MB or more from one run to the next on a Mac, so read the heap
// and the number of documents and nodes first. Playwright is a laptop tool, so this is not run by tests/run.mjs.
//
//   node tools/measure-display-pictures.mjs

import { execFileSync } from 'node:child_process';
import { loadPlaywright } from './screenshots.mjs';
import { startDisplayWorld } from '../tests/helpers/display-world.mjs';

const playwright = await loadPlaywright();
if (!playwright) {
  console.log('Playwright is not installed here.');
  process.exit(0);
}
const chromium = playwright.chromium;

const world = await startDisplayWorld();
const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP teletraan.test 127.0.0.1', '--teletraan-measure=1'] });
const kioskBase = world.url.replace('127.0.0.1', 'localhost');
const base = world.url.replace('127.0.0.1', 'teletraan.test');

// Every process of this browser: rss in MB and cpu seconds
function processes() {
  const out = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,rss=,cputime=,command=']).toString().split('\n').filter(Boolean);
  const rows = out.map(line => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
    return m ? { pid: +m[1], ppid: +m[2], rss: +m[3], cpu: m[4], command: m[5] } : null;
  }).filter(Boolean);
  const root = rows.find(r => r.command.includes('--teletraan-measure=1') && !r.command.includes('--type='));
  const mine = new Set([root.pid]);
  let grew = true;
  while (grew) {
    grew = false;
    rows.forEach(r => { if (!mine.has(r.pid) && mine.has(r.ppid)) { mine.add(r.pid); grew = true; } });
  }
  const seconds = text => { const parts = text.split(/[:.]/).map(Number); return parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 100 : parts[0]; };
  const all = rows.filter(r => mine.has(r.pid));
  return { mb: all.reduce((t, r) => t + r.rss, 0) / 1024, cpu: all.reduce((t, r) => t + seconds(r.cpu), 0), count: all.length };
}

async function scenario(name, { base: address, width, height, thumbs }) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(address + '/control/login.html');
  await page.evaluate(() => fetch('/control/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) }));
  await page.evaluate(on => localStorage.setItem('teletraan-display-thumbs', on ? 'on' : 'off'), thumbs);
  await page.goto(address + '/control/#display');
  await page.waitForSelector('.drow');
  await page.evaluate(() => document.querySelector('.display-split').scrollIntoView());

  await page.waitForTimeout(12000); // load and settle
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const frames = await page.evaluate(() => ({ thumbs: document.querySelectorAll('.thumb-frame').length, large: document.querySelectorAll('.large-frame').length }));
  const before = processes();
  const m0 = await metric();
  const fps = await page.evaluate(() => new Promise(resolve => {
    let n = 0; const start = performance.now();
    const tick = now => { n += 1; if (now - start < 10000) requestAnimationFrame(tick); else resolve(n / ((now - start) / 1000)); };
    requestAnimationFrame(tick);
  }));
  const m1 = await metric();
  const after = processes();
  const heap = m1.JSHeapUsedSize / 1048576;
  const result = {
    name, frames, rssMB: Math.round(after.mb), processes: after.count, jsHeapMB: Math.round(heap * 10) / 10, documents: m1.Documents, domNodes: m1.Nodes,
    cpuPercentOfOneCore: Math.round(((after.cpu - before.cpu) / 10) * 100),
    mainThreadBusyPercent: Math.round(((m1.TaskDuration - m0.TaskDuration) / 10) * 100), fps: Math.round(fps),
  };
  console.log(JSON.stringify(result));
  await context.close();
  return result;
}

const idle = processes();
console.log('browser with no page:', Math.round(idle.mb), 'MB');
await scenario('1 baseline: no pictures (kiosk host, nothing drawn)', { base: kioskBase, width: 1600, height: 2400, thumbs: false });
await scenario('2 large picture only', { base, width: 1600, height: 2400, thumbs: false });
await scenario('3 laptop 1440x900: large + thumbnails (visible ones)', { base, width: 1440, height: 900, thumbs: true });
await scenario('4 tall screen: large + 6 thumbnails', { base, width: 1600, height: 2400, thumbs: true });
await browser.close();
await world.close();
