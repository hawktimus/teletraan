// Measures the contrast of every piece of text on the screen from the real pixels, for the accessibility audit
// (docs/accessibility.md). It opens a page, lists every text node with its computed color, size and weight,
// hides all text and takes a picture, then compares each text color with the pixels that lay behind it.
// Playwright is loaded the way tools/screenshots.mjs loads it (NODE_PATH works).
//
//   node tools/contrast-probe.mjs                   the whole matrix, written to _outputs/a11y/contrast.json
//   node tools/contrast-probe.mjs --only monday     only the pages whose name has "monday" in it
//   node tools/contrast-probe.mjs --list            print the pages and stop
//
// The unit of the result is one line for each distinct text on one page: where it is, its color, the worst 5
// percent and the middle contrast over the pixels behind it, and its size, weight, letter spacing and line height.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planShots, serveDashboard, loadPlaywright, themes, teams } from './screenshots.mjs';
import { panels } from '../dashboard/registry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..');

const styleThemes = themes;
const packs = ['halloween', 'thanksgiving', 'christmas', 'new-years', 'valentines-day', 'competition-day', 'summer-break'];
const colorThemes = ['alternate', 'neon-prime'];
const subthemes = ['halloween', 'winter', 'kickoff'];

function withParams(url, changes) {
  const [pathPart, query] = url.split('?');
  const params = new URLSearchParams(query);
  Object.keys(changes).forEach(key => (changes[key] === '' ? params.delete(key) : params.set(key, changes[key])));
  return pathPart + '?' + params.toString();
}

// Every page of the audit: { name, url }
export function auditPages() {
  const base = planShots(panels).filter(shot => shot.kind === 'still');
  const pages = [];
  const seen = new Set();

  // Each distinct panel address, in each of the four themes with each team. Bar layout is the Minimal screen of the plan.
  base.forEach(shot => {
    const key = withParams(shot.url, { screen: '', team: '' });
    const bar = /screen=minimal/.test(shot.url) || /layout=bar/.test(shot.url);
    const tag = key + (bar ? '|bar' : '');
    if (seen.has(tag)) return;
    seen.add(tag);
    styleThemes.forEach(theme => teams.forEach(team => {
      const changes = { screen: theme, team: team };
      if (bar) changes.layout = 'bar';
      pages.push({ name: shot.name.replace(/-(original|cybertron|minimal)(-(prime|nova))?$/, '') + '|' + theme + '|' + team + (bar ? '|bar' : ''), url: withParams(shot.url, changes) });
    }));
  });

  const sample = ['tasks', 'events', 'leadership', 'monday-department'];
  const own = { 'monday-department': { dept: 'build', list: 'open' } };
  const address = (panel, extra) => withParams('/index.html?sample=1&still=1&panel=' + panel, Object.assign({}, own[panel] || {}, extra));

  packs.forEach(pack => styleThemes.forEach(theme => teams.forEach(team => sample.forEach(panel => {
    pages.push({ name: 'pack-' + pack + '|' + panel + '|' + theme + '|' + team, url: address(panel, { overlay: pack, screen: theme, team: team }) });
  }))));
  colorThemes.forEach(color => styleThemes.forEach(theme => teams.forEach(team => sample.forEach(panel => {
    pages.push({ name: 'color-' + color + '|' + panel + '|' + theme + '|' + team, url: address(panel, { theme: color, screen: theme, team: team }) });
  }))));
  // The whole screen, which has the ticker and the small frame: each view in each theme with each team, held the way the
  // screenshot tool holds it (sample settings, no still address)
  ['general', 'prime', 'nova', 'family'].forEach(view => styleThemes.forEach(theme => teams.forEach(team => {
    pages.push({ name: 'view-' + view + '|' + theme + '|' + team, url: '/index.html?sample=1&motion=none&night=off', view: view, theme: theme, team: team });
  })));

  // What takes the screen or sits on it: the alert, the plate of an announcement, the stale chip
  styleThemes.forEach(theme => teams.forEach(team => {
    pages.push({ name: 'extra-alert|' + theme + '|' + team, url: address('alert', { screen: theme, team: team }) });
    pages.push({ name: 'extra-notice|' + theme + '|' + team, url: address('tasks', { screen: theme, team: team, notice: '1' }) });
    pages.push({ name: 'extra-stale|' + theme + '|' + team, url: address('monday-department', { screen: theme, team: team }), stale: true });
  }));

  subthemes.forEach(sub => styleThemes.forEach(theme => teams.forEach(team => {
    pages.push({ name: 'subtheme-' + sub + '|tasks|' + theme + '|' + team, url: address('tasks', { subtheme: sub, screen: theme, team: team }) });
  })));
  return pages;
}

// Runs inside the page: every visible text with the facts the audit needs
function collectText() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const paint = canvas.getContext('2d', { willReadFrequently: true });
  function rgba(value) {
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = '#000';
    paint.fillStyle = value;
    paint.fillRect(0, 0, 1, 1);
    const data = paint.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2], data[3] / 255];
  }
  function describe(node) {
    const names = [];
    for (let el = node, depth = 0; el && el !== document.body && depth < 5; el = el.parentElement, depth++) {
      const id = el.id ? '#' + el.id : '';
      const classes = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(c => '.' + c).join('') : '';
      names.unshift(el.tagName.toLowerCase() + id + classes);
    }
    return names.join(' > ');
  }

  const found = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue.replace(/\s+/g, ' ').trim();
    if (text === '') continue;
    const element = node.parentElement;
    if (!element || element.closest('script,style,noscript,[hidden]')) continue;

    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none') continue;

    let opacity = 1;
    let hiddenByAncestor = false;
    for (let el = element; el; el = el.parentElement) {
      const s = getComputedStyle(el);
      opacity *= Number(s.opacity);
      if (s.display === 'none' || s.visibility === 'hidden') hiddenByAncestor = true;
    }
    if (hiddenByAncestor || opacity < 0.05) continue;

    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 1 && r.height > 1);
    if (rects.length === 0) continue;
    const box = rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 });
    if (box.right < 0 || box.bottom < 0 || box.left > 1920 || box.top > 1080) continue;

    // Text scrolled out of a clipping parent is not on the screen
    let clipped = false;
    for (let el = element.parentElement; el && !clipped; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const clip = el.getBoundingClientRect();
      const mid = [(box.left + box.right) / 2, (box.top + box.bottom) / 2];
      if (mid[0] < clip.left || mid[0] > clip.right || mid[1] < clip.top || mid[1] > clip.bottom) clipped = true;
    }
    if (clipped) continue;

    const fill = element instanceof SVGElement ? getComputedStyle(element).fill : style.color;
    let ink = rgba(element instanceof SVGElement ? fill : style.color);
    const strokeWidth = parseFloat(style.webkitTextStrokeWidth) || 0;
    let outlined = false;
    if (ink[3] === 0 && strokeWidth > 0) {
      ink = rgba(style.webkitTextStrokeColor);
      outlined = true;
    }
    found.push({
      text: text.slice(0, 40),
      where: describe(element),
      rect: [Math.round(box.left), Math.round(box.top), Math.round(box.right - box.left), Math.round(box.bottom - box.top)],
      lineRects: rects.slice(0, 6).map(r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]),
      lines: rects.length,
      ink: ink,
      alpha: opacity,
      outlined: outlined,
      fontSize: parseFloat(style.fontSize),
      weight: Number(style.fontWeight),
      stroke: strokeWidth,
      spacing: style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing),
      lineHeight: style.lineHeight === 'normal' ? 0 : parseFloat(style.lineHeight),
      upper: style.textTransform === 'uppercase',
      family: style.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    });
  }
  return found;
}

// Runs inside the page: the contrast of each text against the pixels of the picture behind it
export async function measureBehind(items, pictureBase64) {
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = 'data:image/png;base64,' + pictureBase64; });
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const paint = canvas.getContext('2d', { willReadFrequently: true });
  paint.drawImage(image, 0, 0);

  const channel = value => { const part = value / 255; return part <= 0.03928 ? part / 12.92 : Math.pow((part + 0.055) / 1.055, 2.4); };
  const lum = (r, g, b) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  return items.map(item => {
    const ratios = [];
    const colors = [];
    // Each line is read on its own, because a chip or a picture can sit between two lines of one text
    item.lineRects.forEach(([x, y, w, h]) => {
      // The line box is taller than the letters, so only the middle of it is read (plates end close above and below the caps)
      const left = Math.max(0, x), top = Math.max(0, Math.round(y + h * 0.3));
      const width = Math.max(1, Math.min(1920 - left, w)), height = Math.max(1, Math.min(1080 - top, Math.round(h * 0.4)));
      const data = paint.getImageData(left, top, width, height).data;
      const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 3000)));
      for (let row = 0; row < height; row += step) {
        for (let col = 0; col < width; col += step) {
          const at = (row * width + col) * 4;
          const alpha = item.ink[3] * item.alpha;
          const r = item.ink[0] * alpha + data[at] * (1 - alpha);
          const g = item.ink[1] * alpha + data[at + 1] * (1 - alpha);
          const b = item.ink[2] * alpha + data[at + 2] * (1 - alpha);
          const a = lum(r, g, b), c = lum(data[at], data[at + 1], data[at + 2]);
          ratios.push((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05));
          if (colors.length < 400) colors.push([data[at], data[at + 1], data[at + 2]]);
        }
      }
    });
    ratios.sort((p, q) => p - q);
    const pick = fraction => ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * fraction))];
    const mean = colors.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0]).map(v => Math.round(v / Math.max(1, colors.length)));
    return Object.assign({}, item, { low: Math.round(pick(0.05) * 100) / 100, mid: Math.round(pick(0.5) * 100) / 100, behind: mean });
  });
}

const hideText = '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke-color:transparent!important;text-shadow:none!important}svg text,svg tspan{fill:transparent!important;stroke:transparent!important}';

export async function probePage(page, base, entry) {
  // measureBehind runs in the page, so it is handed over as source text
  await page.addInitScript('window.measureBehind = ' + measureBehind.toString() + ';');

  if (entry.stale) {
    // The sample Monday status is marked as a sample, which is never late. An old read makes the amber chip.
    await page.route('**/data/sample/content.json', async route => {
      const response = await route.fetch();
      const content = await response.json();
      content.monday = Object.assign({}, content.monday, { sample: false, lastSyncAt: new Date(Date.now() - 5 * 3600000).toISOString() });
      await route.fulfill({ response: response, json: content });
    });
  }
  if (entry.view) {
    // The view and the theme are held by the sample settings, as tools/screenshots.mjs does it
    const until = new Date(Date.now() + 3600000).toISOString();
    await page.route('**/data/sample/content.json', async route => {
      const response = await route.fetch();
      const content = await response.json();
      content.settings = Object.assign({}, content.settings, { teamMode: entry.team, showView: { key: entry.view, until: until }, previewTheme: { theme: entry.theme, until: until } });
      await route.fulfill({ response: response, json: content });
    });
    await page.goto(base + entry.url, { waitUntil: 'load' });
    await page.waitForFunction(wanted => document.documentElement.dataset.view === wanted.view && document.documentElement.dataset.theme === wanted.theme, { view: entry.view, theme: entry.theme }, { timeout: 40000 });
    await page.waitForTimeout(1500);
  } else {
    await page.goto(base + entry.url, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.stillReady === '1' || Boolean(document.documentElement.dataset.stillError), null, { timeout: 20000 });
    await page.waitForTimeout(450);
  }
  const items = await page.evaluate(collectText);
  await page.addStyleTag({ content: hideText });
  const picture = (await page.screenshot()).toString('base64');
  const measured = await page.evaluate(([list, data]) => measureBehind(list, data), [items, picture]);
  return measured.map(item => Object.assign({ page: entry.name }, item));
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';
  const pages = auditPages().filter(entry => entry.name.includes(only));
  if (args.includes('--list')) return pages.forEach(entry => console.log(entry.name + '  ' + entry.url));

  const playwright = await loadPlaywright();
  if (!playwright) throw new Error('Playwright is not installed (NODE_PATH can name its folder)');
  const server = await serveDashboard(path.join(repoRoot, 'dashboard'));
  const base = 'http://127.0.0.1:' + server.port;
  const browser = await playwright.chromium.launch();
  const results = [];
  const failed = [];
  let next = 0;

  async function worker() {
    while (next < pages.length) {
      const entry = pages[next++];
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();
      try {
        results.push(...await probePage(page, base, entry));
      } catch (error) {
        failed.push({ name: entry.name, reason: error.message.split('\n')[0] });
      } finally {
        await context.close();
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  await browser.close();
  await server.close();

  const out = path.join(repoRoot, '_outputs', 'a11y');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'contrast' + (only ? '-' + only.replace(/[^a-z0-9]+/gi, '_') : '') + '.json'), JSON.stringify({ pages: pages.length, failed: failed, items: results }));
  console.log(pages.length + ' pages, ' + results.length + ' texts, ' + failed.length + ' pages failed');
  failed.slice(0, 10).forEach(item => console.log('  ' + item.name + ': ' + item.reason));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
