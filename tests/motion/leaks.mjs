// A screen that runs for days must not grow. The large panel is moved through its rows a few dozen times
// and what the page keeps (timers, listeners, running animations, page elements, JS memory) is read after
// the first rows and after the last. The numbers of tools/perf/measure.mjs leak are the same ones, run for hundreds of rows
// (docs/performance.md). The limits are loose, so that a different panel on screen at the moment of a reading is not a failure.

const warmUpRows = 6;
const rows = 24;
const limits = { intervals: 0, timeouts: 8, listeners: 24, animations: 40, nodes: 2500, heapMB: 4 };

async function reading(page, client) {
  await client.send('Performance.enable');
  await client.send('HeapProfiler.collectGarbage');
  const metrics = (await client.send('Performance.getMetrics')).metrics;
  const get = name => (metrics.find(metric => metric.name === name) || { value: 0 }).value;
  const inPage = await page.evaluate(() => window.__leakWatch);
  return {
    intervals: inPage.intervals,
    timeouts: inPage.timeouts,
    listeners: get('JSEventListeners'),
    animations: await page.evaluate(() => document.getAnimations().length),
    nodes: get('Nodes'),
    heapMB: get('JSHeapUsedSize') / 1048576,
  };
}

// Counts the timers that are alive. Runs in the page before anything else.
function watchTimers() {
  const intervals = new Set();
  const timeouts = new Set();
  Object.defineProperty(window, '__leakWatch', { get: () => ({ intervals: intervals.size, timeouts: timeouts.size }) });

  const setI = window.setInterval.bind(window);
  const clearI = window.clearInterval.bind(window);
  window.setInterval = (...args) => {
    const id = setI(...args);
    intervals.add(id);
    return id;
  };
  window.clearInterval = id => {
    intervals.delete(id);
    clearI(id);
  };

  const setT = window.setTimeout.bind(window);
  const clearT = window.clearTimeout.bind(window);
  window.setTimeout = (callback, delay, ...rest) => {
    if (typeof callback !== 'function') return setT(callback, delay, ...rest);
    const id = setT(() => {
      timeouts.delete(id);
      callback(...rest);
    }, delay);
    timeouts.add(id);
    return id;
  };
  window.clearTimeout = id => {
    timeouts.delete(id);
    clearT(id);
  };
}

async function nextRow(page) {
  await page.evaluate(() => window.teletraanTest.play('reform-panel', {}));
  const started = Date.now();
  let sawBusy = false;
  while (Date.now() - started < 30000) {
    await page.waitForTimeout(100);
    const busy = await page.evaluate(() => window.teletraanTest.busy());
    if (busy) sawBusy = true;
    if (sawBusy && !busy) break;
  }
  await page.waitForTimeout(500);
}

async function run(ctx) {
  // Its own page: the probe of the other rules stops the animations, and here they must run
  const context = await ctx.browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const lines = [];
  try {
    const client = await context.newCDPSession(page);
    await page.route('**/control/api/**', route => route.fulfill({ status: 204 }));
    await page.addInitScript(watchTimers);
    await page.goto(ctx.base + '/index.html?sample=1&clock=fixed&motion=full&night=off', { waitUntil: 'load' });
    await page.waitForFunction(() => window.teletraanTest && document.querySelector('#region-grid1 [data-panel]'), null, { timeout: 90000 });
    await page.waitForTimeout(3000);

    for (let i = 0; i < warmUpRows; i++) await nextRow(page);
    const before = await reading(page, client);
    for (let i = 0; i < rows; i++) await nextRow(page);
    const after = await reading(page, client);

    Object.keys(limits).forEach(name => {
      const grew = after[name] - before[name];
      if (grew > limits[name]) {
        lines.push('after ' + (warmUpRows + rows) + ' row changes the page keeps ' + Math.round(grew * 10) / 10 + ' more ' + name + ' than after ' + warmUpRows + ' (limit ' + limits[name] + ', ' + Math.round(before[name]) + ' then, ' + Math.round(after[name]) + ' now)');
      }
    });
  } finally {
    await context.close();
  }
  return lines;
}

export const tests = [{ name: 'leaks/rows-do-not-grow-the-page', run: run }];
