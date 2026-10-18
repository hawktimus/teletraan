// What every motion test shares: opening the dashboard with the test hook, remembering the answer of a
// scenario so that several rules can read one run, and writing the frames of a rule that failed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(here, '..', '..', '..');
const probeFile = path.join(here, 'probe.js');

export const canvas = { width: 1920, height: 1080 };

// The looks the rules run in. A theme is held the way the control page holds it (previewTheme in the settings, which
// is for an hour of the fixed clock), and a view that has the bar layout is held the way showView holds it.
// The fixed clock of the page starts at 14:00 on 14 October 2026 (dashboard/core/test-hook.js).
export const looks = {
  original: { theme: 'original', view: 'general' },
  cybertron: { theme: 'cybertron', view: 'general' },
  cybertronBar: { theme: 'cybertron', view: 'prime' },
  cybertronNova: { theme: 'cybertron', view: 'nova' },
  retro: { theme: 'retro', view: 'general' },
  bar: { theme: 'original', view: 'prime' },
};

function holdLook(content, look) {
  const until = new Date(2026, 9, 14, 15, 30).toISOString();
  content.settings = Object.assign({}, content.settings, {
    previewTheme: { theme: looks[look].theme, until: until },
    showView: { key: looks[look].view, until: until },
  });
}

// The address every test opens: the sample content, the clock fixed, full motion and no night screen
export function addressFor(extra = {}) {
  const query = new URLSearchParams({ sample: '1', clock: 'fixed', motion: 'full', night: 'off' });
  Object.keys(extra).forEach(key => query.set(key, extra[key]));
  return '/index.html?' + query.toString();
}

// A run of the tests. base is the address of the dashboard server, browser is a Playwright browser.
export function makeContext(browser, base) {
  const scenarios = {};
  const kept = {};

  async function open(extra = {}, size = canvas, options = {}) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // The page tells the control service what it shows. There is none here.
    await page.route('**/control/api/**', route => route.fulfill({ status: 204 }));
    if (options.content || options.look) {
      await page.route('**/data/sample/content.json', async route => {
        const response = await route.fetch();
        const content = await response.json();
        if (options.look) holdLook(content, options.look);
        if (options.content) options.content(content);
        await route.fulfill({ response: response, json: content });
      });
    }
    await page.addInitScript({ path: probeFile });
    await page.goto(base + addressFor(extra), { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => window.teletraanTest && window.teletraanStarted && document.querySelector('#stage .page, #stage .panel'), null, { timeout: 90000 });
    } catch (error) {
      const state = await page.evaluate(() => [Boolean(window.teletraanTest), document.documentElement.dataset.view, window.teletraanStarted, document.title]).catch(() => ['no page']);
      throw new Error('the dashboard did not start in 90 seconds (' + JSON.stringify(state) + '). ' + (errors.length > 0 ? 'The page said: ' + errors[0] : 'The page said nothing.'));
    }
    await page.waitForTimeout(options.settleMs === undefined ? 2500 : options.settleMs);
    // A held still page says when it has drawn its panel (dashboard/core/still-run.js)
    if (extra.still === '1') await page.waitForFunction(() => document.documentElement.dataset.stillReady === '1', null, { timeout: 30000 });
    if (extra.style) {
      const style = await page.evaluate(() => document.documentElement.dataset.style);
      if (style !== extra.style) throw new Error('the look ' + extra.style + ' did not go on, the page has ' + style);
    }
    page.pageErrors = errors;
    return page;
  }

  // A run that several rules read: the first rule to ask makes it, the others get the same answer
  function scenario(name, make) {
    if (!scenarios[name]) scenarios[name] = Promise.resolve().then(make);
    return scenarios[name];
  }

  // Remembers a picture for a rule. It is written only if the rule fails. A picture is { name, png } for a screenshot
  // or { name, drawing } for the pieces drawn as boxes (see drawing below).
  function keep(rule, picture) {
    (kept[rule] = kept[rule] || []).push(picture);
  }

  return { browser: browser, base: base, open: open, scenario: scenario, keep: keep, kept: kept };
}

// The pieces of the screen drawn as boxes on a 1920 x 1080 canvas, as an SVG text. Pieces named in bad are red.
export function drawing(title, pieces, bad = []) {
  const color = { plate: '#4a7bd0', box: '#4a7bd0', content: '#999999', bolt: '#d09a2a', text: '#2a9d5c', hawk: '#e07020' };
  const boxes = pieces.map(piece => {
    const wrong = bad.some(name => name === piece.name);
    const stroke = wrong ? '#e02020' : color[piece.kind] || '#555555';
    const fill = wrong ? 'rgba(224,32,32,0.25)' : 'none';
    const opacity = piece.opacity === undefined ? 1 : Math.max(0.15, piece.opacity);
    return '<rect x="' + piece.left.toFixed(1) + '" y="' + piece.top.toFixed(1) + '" width="' + Math.max(piece.width, 1).toFixed(1) + '" height="' + Math.max(piece.height, 1).toFixed(1) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (wrong ? 4 : 2) + '" opacity="' + opacity + '"/>';
  });
  const label = '<text x="24" y="1060" font-family="monospace" font-size="36" fill="#222">' + title.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#fff"/><rect x="0.5" y="0.5" width="1919" height="1079" fill="none" stroke="#000"/>' + boxes.join('') + label + '</svg>';
}

// Writes the frames of a failed rule to _outputs/motion/<rule>/ : a PNG for each picture and the lines of the failure
export async function writeFrames(ctx, rule, lines) {
  const folder = path.join(repoRoot, '_outputs', 'motion', rule.replace(/[^a-z0-9-]+/gi, '-'));
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'failure.txt'), lines.join('\n') + '\n');

  const pictures = ctx.kept[rule] || [];
  if (pictures.length === 0) return folder;

  const page = await ctx.browser.newPage({ viewport: { width: canvas.width / 2, height: canvas.height / 2 } });
  try {
    for (const picture of pictures) {
      const file = path.join(folder, picture.name.replace(/[^a-z0-9.-]+/gi, '-') + '.png');
      if (picture.png) {
        fs.writeFileSync(file, picture.png);
      } else {
        await page.setContent('<body style="margin:0"><div style="width:960px;height:540px;overflow:hidden"><div style="transform:scale(0.5);transform-origin:0 0">' + picture.drawing + '</div></div></body>');
        await page.screenshot({ path: file });
      }
    }
  } finally {
    await page.close();
  }
  return folder;
}
