// Measures the dashboard in a real browser with the CPU slowed down, to stand in for the 2011 Mini
// (docs/performance.md). Playwright is a development dependency and is never on the Mini, so this runs on a laptop:
//
//   NODE_PATH=/path/to/node_modules node tools/perf/measure.mjs rotation --slow 4 --rows 30
//   node tools/perf/measure.mjs leak --slow 4 --rows 200
//   node tools/perf/measure.mjs startup --slow 4
//   node tools/perf/measure.mjs network --seconds 180
//   node tools/perf/measure.mjs trace --slow 4        writes _outputs/perf/trace.json for the Chrome DevTools Performance tab
//
// --slow is the CPU slowdown (1 is this computer). The page runs on the sample content with the clock fixed
// (tests/motion/README.md), and the Next look button (core/test-hook.js) moves the large panel to its next row.
// Numbers from a laptop with a throttle are a guide to where the cost is. They are not the Mini.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serveDashboard } from '../screenshots.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readOptions(argv) {
  const options = { mode: argv[0] || 'rotation', slow: 4, rows: 30, seconds: 180, look: 'original' };
  for (let i = 1; i < argv.length; i += 2) options[argv[i].replace(/^--/, '')] = isNaN(Number(argv[i + 1])) ? argv[i + 1] : Number(argv[i + 1]);
  return options;
}

// Runs in the page before anything else: the frame gaps, the slow tasks and the timers that are alive
function probe() {
  const perf = { frames: [], tasks: [], frameCallbacks: 0, intervals: new Set(), timeouts: new Set(), listeners: 0, started: performance.now() };
  window.__perf = perf;

  let last = performance.now();
  const loop = now => {
    perf.frames.push([now, now - last]);
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Long animation frames name the script that took the time. Not every browser has them.
  try {
    new PerformanceObserver(list => {
      list.getEntries().forEach(entry => {
        const scripts = (entry.scripts || []).map(script => script.sourceFunctionName + ' ' + String(script.sourceURL || '').split('/').slice(-2).join('/') + ':' + script.sourceCharPosition);
        perf.tasks.push({ at: entry.startTime, ms: entry.duration, blocking: entry.blockingDuration, scripts: scripts.slice(0, 4) });
      });
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch (error) {
    // an older browser: the long task list stays empty
  }

  const setI = window.setInterval.bind(window);
  const clearI = window.clearInterval.bind(window);
  window.setInterval = (callback, delay, ...rest) => {
    const id = setI(callback, delay, ...rest);
    if (delay === 30000) perf.reread = callback; // the sample content reader (core/content-source.js)
    perf.intervals.add(id);
    return id;
  };
  window.clearInterval = id => {
    perf.intervals.delete(id);
    clearI(id);
  };

  // Timers still waiting. A timer that has fired takes itself off the list.
  const setT = window.setTimeout.bind(window);
  const clearT = window.clearTimeout.bind(window);
  window.setTimeout = (callback, delay, ...rest) => {
    if (typeof callback !== 'function') return setT(callback, delay, ...rest);
    const id = setT(() => {
      perf.timeouts.delete(id);
      callback(...rest);
    }, delay);
    perf.timeouts.add(id);
    return id;
  };
  window.clearTimeout = id => {
    perf.timeouts.delete(id);
    clearT(id);
  };

  // Frame callbacks asked for and not yet run
  const raf = window.requestAnimationFrame.bind(window);
  perf.rafWaiting = 0;
  window.requestAnimationFrame = callback => {
    perf.rafWaiting++;
    return raf(time => {
      perf.rafWaiting--;
      callback(time);
    });
  };
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export function summarize(gaps) {
  const sorted = gaps.slice().sort((a, b) => a - b);
  const over = limit => gaps.filter(gap => gap > limit).length;
  return {
    frames: gaps.length,
    p50: Math.round(percentile(sorted, 0.5)),
    p95: Math.round(percentile(sorted, 0.95)),
    worst: Math.round(sorted[sorted.length - 1] || 0),
    over34: over(34),
    over100: over(100),
  };
}

async function openPage(browser, base, options, extra = {}) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/control/api/**', route => route.fulfill({ status: 204 }));
  if (!options.noProbe) await page.addInitScript(probe);
  if (options.slow > 1) await client.send('Emulation.setCPUThrottlingRate', { rate: options.slow });
  const query = new URLSearchParams({ sample: '1', clock: 'fixed', motion: options.motion || 'full', night: 'off' });
  Object.keys(extra).forEach(key => query.set(key, extra[key]));
  const started = Date.now();
  await page.goto(base + '/index.html?' + query.toString(), { waitUntil: 'load' });
  return { page, client, context, errors, started };
}

async function waitForScreen(page, ms = 60000) {
  await page.waitForFunction(() => document.querySelector('#region-grid1 [data-panel]') && window.teletraanTest, null, { timeout: ms, polling: 200 });
}

async function counters(client) {
  await client.send('Performance.enable');
  await client.send('HeapProfiler.collectGarbage');
  const metrics = await client.send('Performance.getMetrics');
  const get = name => (metrics.metrics.find(metric => metric.name === name) || { value: 0 }).value;
  return { heapMB: get('JSHeapUsedSize') / 1048576, nodes: get('Nodes'), listeners: get('JSEventListeners'), documents: get('Documents') };
}

async function pageCounters(page) {
  return page.evaluate(() => ({
    intervals: window.__perf.intervals.size,
    timeouts: window.__perf.timeouts.size,
    rafWaiting: window.__perf.rafWaiting,
    animations: document.getAnimations().length,
    storageKB: Math.round(Object.keys(localStorage).reduce((sum, key) => sum + key.length + (localStorage.getItem(key) || '').length, 0) / 1024),
    domNow: document.getElementsByTagName('*').length,
  }));
}

// Moves the large panel to its next row and waits for the change to finish. Returns what the page did meanwhile.
async function nextRow(page, hardLimit = 30000) {
  const before = await page.evaluate(() => {
    const panel = document.querySelector('#region-grid1 [data-panel]');
    if (window.__perf) {
      window.__perf.frames.length = 0;
      window.__perf.tasks.length = 0;
    }
    return { panel: panel ? panel.dataset.panel : '', mark: performance.now() };
  });
  await page.evaluate(() => window.teletraanTest.play('reform-panel', {}));
  const started = Date.now();
  // The change has begun when the busy flag goes up and is over when it comes down
  let sawBusy = false;
  while (Date.now() - started < hardLimit) {
    await page.waitForTimeout(100);
    const busy = await page.evaluate(() => window.teletraanTest.busy());
    if (busy) sawBusy = true;
    if (sawBusy && !busy) break;
  }
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => {
    const panel = document.querySelector('#region-grid1 [data-panel]');
    return {
      panel: panel ? panel.dataset.panel : '',
      gaps: window.__perf ? window.__perf.frames.map(frame => frame[1]) : [],
      tasks: window.__perf ? window.__perf.tasks.slice() : [],
      nodes: document.getElementsByTagName('*').length,
    };
  });
  return { from: before.panel, to: after.panel, gaps: after.gaps, tasks: after.tasks, ms: Date.now() - started, sawBusy: sawBusy };
}

async function rotation(browser, base, options) {
  const run = await openPage(browser, base, options);
  await waitForScreen(run.page);
  await run.page.waitForTimeout(4000);
  const rows = [];
  const seen = new Set();
  for (let i = 0; i < options.rows; i++) {
    const row = await nextRow(run.page);
    rows.push(row);
    seen.add(row.to);
  }
  console.log('slow ' + options.slow + 'x, ' + rows.length + ' row changes, ' + seen.size + ' different panels in the large frame');
  console.log('panel (the one that arrived)'.padEnd(34) + 'change ms  frames  p50  p95  worst  >34  >100  slow frames (>50ms)');
  const byPanel = {};
  rows.forEach(row => {
    const slowTasks = row.tasks.filter(task => task.ms > 50);
    const entry = byPanel[row.to] || { gaps: [], worst: 0, ms: [], tasks: [] };
    entry.gaps.push(...row.gaps);
    entry.ms.push(row.ms);
    entry.tasks.push(...slowTasks);
    byPanel[row.to] = entry;
  });
  Object.keys(byPanel).sort((a, b) => summarize(byPanel[b].gaps).p95 - summarize(byPanel[a].gaps).p95).forEach(name => {
    const s = summarize(byPanel[name].gaps);
    const avg = Math.round(byPanel[name].ms.reduce((a, b) => a + b, 0) / byPanel[name].ms.length);
    console.log(name.padEnd(34) + String(avg).padStart(9) + String(s.frames).padStart(8) + String(s.p50).padStart(5) + String(s.p95).padStart(5) + String(s.worst).padStart(7) + String(s.over34).padStart(5) + String(s.over100).padStart(6) + '  ' + byPanel[name].tasks.length);
  });
  const all = summarize(rows.flatMap(row => row.gaps));
  console.log('ALL changes: ' + JSON.stringify(all));
  const tasks = rows.flatMap(row => row.tasks).sort((a, b) => b.ms - a.ms).slice(0, 8);
  console.log('longest frames and who ran in them:');
  tasks.forEach(task => console.log('  ' + Math.round(task.ms) + ' ms  ' + task.scripts.join(' | ')));

  // A quiet stretch between changes, the panel only ticking
  await run.page.evaluate(() => { window.__perf.frames.length = 0; });
  await run.page.waitForTimeout(8000);
  const quiet = await run.page.evaluate(() => window.__perf.frames.map(frame => frame[1]));
  console.log('quiet 8 s: ' + JSON.stringify(summarize(quiet)));
  if (run.errors.length) console.log('page errors: ' + run.errors.slice(0, 3).join(' / '));
  await run.context.close();
}

async function leak(browser, base, options) {
  const run = await openPage(browser, base, options);
  await waitForScreen(run.page);
  await run.page.waitForTimeout(4000);
  const every = Math.max(1, Math.floor(options.rows / 10));
  const readings = [];
  const take = async label => {
    const count = await counters(run.client);
    const page = await pageCounters(run.page);
    readings.push({ label, ...count, ...page });
    const r = readings[readings.length - 1];
    console.log(String(label).padStart(5) + '  heap ' + r.heapMB.toFixed(1) + ' MB  nodes ' + r.nodes + '  listeners ' + r.listeners + '  intervals ' + r.intervals + '  timeouts ' + r.timeouts + '  raf ' + r.rafWaiting + '  anims ' + r.animations + '  storage ' + r.storageKB + ' KB');
  };
  await take(0);
  for (let i = 1; i <= options.rows; i++) {
    await nextRow(run.page);
    if (i % every === 0) await take(i);
  }
  const first = readings[1];
  const last = readings[readings.length - 1];
  console.log('growth from reading 1 to the last: heap ' + (last.heapMB - first.heapMB).toFixed(1) + ' MB, nodes ' + (last.nodes - first.nodes) + ', listeners ' + (last.listeners - first.listeners) + ', intervals ' + (last.intervals - first.intervals) + ', timeouts ' + (last.timeouts - first.timeouts));
  if (run.errors.length) console.log('page errors: ' + run.errors.slice(0, 3).join(' / '));
  await run.context.close();
  return readings;
}

// The content changes as it does when an editor publishes: the sample content is served with a different
// ticker line each time, and the page is told to read it now. A rebuild of everything the content feeds.
async function edits(browser, base, options) {
  const run = await openPage(browser, base, options);
  let version = 0;
  await run.page.route('**/data/sample/content.json', async route => {
    const response = await route.fetch();
    const content = await response.json();
    content.tipsAndNews = (content.tipsAndNews || []).map((item, index) => (index === 0 && item.text ? Object.assign({}, item, { text: 'Edit number ' + version }) : item));
    await route.fulfill({ response: response, json: content });
  });
  await waitForScreen(run.page);
  await run.page.waitForTimeout(4000);
  const readings = [];
  const take = async label => {
    const r = Object.assign({ label }, await counters(run.client), await pageCounters(run.page));
    readings.push(r);
    console.log(String(label).padStart(5) + '  heap ' + r.heapMB.toFixed(1) + ' MB  nodes ' + r.nodes + '  listeners ' + r.listeners + '  intervals ' + r.intervals + '  timeouts ' + r.timeouts + '  anims ' + r.animations);
  };
  await take(0);
  for (let i = 1; i <= options.rows; i++) {
    version++;
    await run.page.evaluate(() => window.__perf.reread && window.__perf.reread());
    await run.page.waitForTimeout(700);
    if (i % Math.max(1, Math.floor(options.rows / 8)) === 0) await take(i);
  }
  if (run.errors.length) console.log('page errors: ' + run.errors.slice(0, 3).join(' / '));
  await run.context.close();
}

// Where the script time goes: the sampling profiler of the browser runs through a quiet stretch and some row
// changes, and the self time is added up by function. The probe is left off so that it does not count itself.
async function profile(browser, base, options) {
  const run = await openPage(browser, base, Object.assign({}, options, { noProbe: true }));
  await waitForScreen(run.page);
  await run.page.waitForTimeout(3000);
  await run.client.send('Profiler.enable');
  await run.client.send('Profiler.setSamplingInterval', { interval: 500 });
  await run.client.send('Profiler.start');
  await run.page.waitForTimeout(options.seconds * 1000);
  const quiet = (await run.client.send('Profiler.stop')).profile;
  await run.client.send('Profiler.start');
  for (let i = 0; i < options.rows; i++) await nextRow(run.page);
  const moving = (await run.client.send('Profiler.stop')).profile;

  const report = (label, profileData) => {
    const byId = new Map(profileData.nodes.map(node => [node.id, node]));
    const self = {};
    let total = 0;
    profileData.samples.forEach((id, index) => {
      const node = byId.get(id);
      const delta = profileData.timeDeltas[index] / 1000;
      const name = node.callFrame.functionName || '(anonymous)';
      if (['(idle)', '(program)', '(root)'].includes(name)) return;
      total += delta;
      const key = name + ' ' + String(node.callFrame.url || '').split('/').slice(-2).join('/') + ':' + node.callFrame.lineNumber;
      self[key] = (self[key] || 0) + delta;
    });
    console.log(label + ': ' + Math.round(total) + ' ms of script in the stretch');
    Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([key, ms]) => console.log('  ' + ms.toFixed(0).padStart(6) + ' ms  ' + key));
  };
  report('quiet ' + options.seconds + ' s', quiet);
  report(options.rows + ' row changes', moving);
  await run.context.close();
}

// The screen left alone: the rotation of its own, the ticker and the small frame, read every 90 seconds
async function soak(browser, base, options) {
  const run = await openPage(browser, base, options);
  await waitForScreen(run.page);
  for (let i = 0; i <= options.seconds / 90; i++) {
    const count = await counters(run.client);
    const page = await pageCounters(run.page);
    await run.page.evaluate(() => { window.__perf.frames.length = 0; }); // the probe's own list would show as growth
    console.log(String(i * 90).padStart(5) + ' s  heap ' + count.heapMB.toFixed(1) + ' MB  nodes ' + count.nodes + '  listeners ' + count.listeners + '  intervals ' + page.intervals + '  timeouts ' + page.timeouts + '  raf ' + page.rafWaiting + '  anims ' + page.animations);
    await run.page.waitForTimeout(90000);
  }
  await run.context.close();
}

// What stays in memory: the sampling heap profiler of the browser notes where each object was made and reports only
// the ones still alive when it stops, so the sum by function is what the screen is holding on to.
async function heap(browser, base, options) {
  const run = await openPage(browser, base, Object.assign({}, options, { noProbe: true }));
  await waitForScreen(run.page);
  await run.page.waitForTimeout(5000);
  await run.client.send('HeapProfiler.enable');
  await run.client.send('HeapProfiler.collectGarbage');
  await run.client.send('HeapProfiler.startSampling', { samplingInterval: 256 });
  await run.page.waitForTimeout(options.seconds * 1000);
  await run.client.send('HeapProfiler.collectGarbage');
  const result = await run.client.send('HeapProfiler.stopSampling');
  const kept = {};
  let total = 0;
  const walk = node => {
    const self = node.selfSize;
    if (self > 0) {
      const frame = node.callFrame;
      const key = (frame.functionName || '(anonymous)') + ' ' + String(frame.url || '').split('/').slice(-2).join('/') + ':' + frame.lineNumber;
      kept[key] = (kept[key] || 0) + self;
      total += self;
    }
    node.children.forEach(walk);
  };
  walk(result.profile.head);
  console.log('still alive after ' + options.seconds + ' s: ' + Math.round(total / 1024) + ' KB');
  Object.entries(kept).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([key, bytes]) => console.log('  ' + String(Math.round(bytes / 1024)).padStart(6) + ' KB  ' + key));
  await run.context.close();
}

async function startup(browser, base, options) {
  const run = await openPage(browser, base, options);
  const times = await run.page.evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return null;
  });
  await waitForScreen(run.page, 90000);
  const result = await run.page.evaluate(() => {
    const paint = name => (performance.getEntriesByName(name)[0] || { startTime: null }).startTime;
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    return {
      firstPaint: paint('first-paint'),
      firstContentfulPaint: paint('first-contentful-paint'),
      domContentLoaded: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd,
      firstPanelAt: performance.now(),
      requests: resources.length,
      kb: Math.round(resources.reduce((sum, r) => sum + (r.transferSize || r.encodedBodySize || 0), 0) / 1024),
      scripts: resources.filter(r => r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name)).length,
    };
  });
  console.log('slow ' + options.slow + 'x  ' + JSON.stringify(Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v === null ? null : Math.round(v)]))));
  await run.context.close();
}

async function network(browser, base, options) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.route('**/control/api/**', route => route.fulfill({ status: 204 }));
  await page.addInitScript(probe);
  const log = [];
  const started = Date.now();
  page.on('response', async response => {
    let size = 0;
    try { size = (await response.body()).length; } catch (error) { /* a stream or a redirect has no body */ }
    log.push({ t: Date.now() - started, url: response.url().replace(/^https?:\/\/[^/]+/, ''), size: size, status: response.status() });
  });
  await page.goto(base + '/index.html?sample=1&clock=fixed&motion=full&night=off', { waitUntil: 'load' });
  await waitForScreen(page);
  const settled = Date.now() - started;
  await page.waitForTimeout(options.seconds * 1000);
  const after = log.filter(entry => entry.t > settled);
  const groups = {};
  after.forEach(entry => {
    const key = entry.url.split('?')[0];
    groups[key] = groups[key] || { count: 0, bytes: 0 };
    groups[key].count++;
    groups[key].bytes += entry.size;
  });
  const minutes = options.seconds / 60;
  console.log('after start: ' + Math.round(settled / 1000) + ' s (' + log.filter(e => e.t <= settled).length + ' requests, ' + Math.round(log.filter(e => e.t <= settled).reduce((s, e) => s + e.size, 0) / 1024) + ' KB). Then ' + options.seconds + ' s:');
  Object.keys(groups).forEach(key => console.log('  ' + key.padEnd(50) + (groups[key].count / minutes).toFixed(1) + ' requests/min  ' + (groups[key].bytes / 1024 / minutes).toFixed(1) + ' KB/min'));
  await context.close();
}

async function trace(browser, base, options) {
  const run = await openPage(browser, base, options);
  await waitForScreen(run.page);
  await run.page.waitForTimeout(3000);
  const folder = path.join(root, '_outputs', 'perf');
  fs.mkdirSync(folder, { recursive: true });
  await browser.startTracing(run.page, { path: path.join(folder, 'trace.json'), categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'v8.execute', 'disabled-by-default-devtools.timeline.stack'] });
  for (let i = 0; i < options.rows; i++) await nextRow(run.page);
  await browser.stopTracing();
  console.log('trace written to ' + path.join('_outputs', 'perf', 'trace.json'));
  await run.context.close();
}

const modes = { rotation, leak, edits, soak, heap, profile, startup, network, trace };

async function main() {
  const options = readOptions(process.argv.slice(2));
  if (!modes[options.mode]) {
    console.error('modes: ' + Object.keys(modes).join(', '));
    return 2;
  }
  const playwright = await loadPlaywright();
  if (!playwright) {
    console.error('Playwright is not installed here. Set NODE_PATH to a folder that has it.');
    return 2;
  }
  const server = await serveDashboard(path.join(root, 'dashboard'));
  const browser = await playwright.chromium.launch();
  try {
    await modes[options.mode](browser, 'http://127.0.0.1:' + server.port, options);
  } finally {
    await browser.close();
    await server.close();
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main());
