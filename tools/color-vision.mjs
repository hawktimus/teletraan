// Simulates the three kinds of color blindness on the colors that carry meaning on the screen, for the accessibility
// audit (docs/accessibility.md). It reads the real values from the page (the status colors, the priority colors, the team
// colors, the chart parts), turns each into what a person with protanopia, deuteranopia or tritanopia sees (Machado 2009,
// full severity), and prints every pair that comes closer than the limit. A pair that is close needs a cue that is not a color.
//
//   node tools/color-vision.mjs            the table for every theme and team
//   node tools/color-vision.mjs --json     the same as JSON on one line
//
// The distance is CIEDE2000. 11 or more is two clear colors, under 11 can be taken for one at a distance.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDashboard, loadPlaywright, themes, teams } from './screenshots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const limit = 11;

const matrices = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};

const toLinear = value => { const part = value / 255; return part <= 0.04045 ? part / 12.92 : Math.pow((part + 0.055) / 1.055, 2.4); };
const toSrgb = value => { const clamped = Math.min(1, Math.max(0, value)); return 255 * (clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055); };

export function simulate(rgb, kind) {
  if (kind === 'normal') return rgb;
  const linear = rgb.map(toLinear);
  return matrices[kind].map(row => toSrgb(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]));
}

function lab(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

// CIEDE2000
export function distance(first, second) {
  const [L1, a1, b1] = lab(first), [L2, a2, b2] = lab(second);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b, a) => { const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const h1p = C1p === 0 ? 0 : hue(b1, a1p), h2p = C2p === 0 ? 0 : hue(b2, a2p);
  const dL = L2 - L1, dC = C2p - C1p;
  let dh = 0;
  if (C1p * C2p !== 0) {
    dh = h2p - h1p;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * rad / 2);
  const Lbar = (L1 + L2) / 2, Cpbar = (C1p + C2p) / 2;
  let hbar = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbar += h1p + h2p < 360 ? 360 : -360;
    hbar /= 2;
  }
  const T = 1 - 0.17 * Math.cos((hbar - 30) * rad) + 0.24 * Math.cos(2 * hbar * rad) + 0.32 * Math.cos((3 * hbar + 6) * rad) - 0.2 * Math.cos((4 * hbar - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hbar - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cpbar, 7) / (Math.pow(Cpbar, 7) + Math.pow(25, 7)));
  const Sl = 1 + 0.015 * Math.pow(Lbar - 50, 2) / Math.sqrt(20 + Math.pow(Lbar - 50, 2));
  const Sc = 1 + 0.045 * Cpbar, Sh = 1 + 0.015 * Cpbar * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
}

// What carries meaning: a name, and the token (or custom property) that holds its color
export const groups = {
  status: { Done: '--status-done', 'In progress': '--status-progress', 'To do': '--status-next', Blocked: '--status-blocked', 'In review': '--prime-tag', Stale: '--stale' },
  priority: { High: '--danger', Medium: '--yellow', 'Low or none': '--lilac' },
  tag: { 'Prime tag': '--prime-tag', 'Nova tag': '--nova-tag' },
  alliance: { Red: '--alliance-red', Blue: '--alliance-blue' },
  team: { 'Team main': '--team-primary', 'Team accent': '--team-accent', 'Team plate': '--team-plate' },
};

// Runs in the page: the colors of every group as [r, g, b]
function readColors(spec) {
  const probe = document.createElement('i');
  document.body.appendChild(probe);
  const out = {};
  Object.keys(spec).forEach(group => {
    out[group] = {};
    Object.keys(spec[group]).forEach(name => {
      probe.style.color = '';
      probe.style.color = 'var(' + spec[group][name] + ')';
      const match = /rgba?\(([^)]+)\)/.exec(getComputedStyle(probe).color);
      out[group][name] = match ? match[1].split(',').slice(0, 3).map(Number) : null;
    });
  });
  probe.remove();
  return out;
}

export function closePairs(colors) {
  const found = [];
  Object.keys(colors).forEach(group => {
    const names = Object.keys(colors[group]).filter(name => colors[group][name]);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      ['normal', 'protanopia', 'deuteranopia', 'tritanopia'].forEach(kind => {
        const gap = distance(simulate(colors[group][names[i]], kind), simulate(colors[group][names[j]], kind));
        if (gap < limit) found.push({ group: group, first: names[i], second: names[j], kind: kind, gap: Math.round(gap * 10) / 10 });
      });
    }
  });
  return found;
}

async function main() {
  const playwright = await loadPlaywright();
  const server = await serveDashboard(path.join(here, '..', 'dashboard'));
  const browser = await playwright.chromium.launch();
  const rows = [];
  const looks = [{ label: 'default', extra: '' }, { label: 'color theme neon-prime', extra: '&theme=neon-prime' }, { label: 'color theme alternate', extra: '&theme=alternate' }];

  for (const look of looks) for (const theme of themes) for (const team of teams) {
    if (look.extra && theme !== 'original') continue;
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://127.0.0.1:' + server.port + '/index.html?sample=1&still=1&panel=tasks&screen=' + theme + '&team=' + team + look.extra);
    await page.waitForFunction(() => document.documentElement.dataset.stillReady === '1', null, { timeout: 20000 });
    const colors = await page.evaluate(readColors, groups);
    rows.push({ look: look.label, theme: theme, team: team, close: closePairs(colors), colors: colors });
    await page.close();
  }
  await browser.close();
  await server.close();

  if (process.argv.includes('--json')) return console.log(JSON.stringify(rows));
  rows.forEach(row => {
    console.log(row.look + ' / ' + row.theme + ' / ' + row.team);
    row.close.forEach(pair => console.log('   ' + pair.group + ': ' + pair.first + ' vs ' + pair.second + ' under ' + pair.kind + ' = ' + pair.gap));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
