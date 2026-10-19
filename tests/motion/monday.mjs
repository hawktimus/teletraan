// Department tasks, with more rows than fit, scrolls its list by one page of rows (scrollCard in dashboard/frame.js).

import { drawing } from './lib/harness.mjs';

const cards = ['monday-department'];
// Each theme, and Minimal, which is the bar layout in the Original theme
const looks = ['original', 'cybertron', 'retro', 'minimal'];
const rowsPerPage = 4;
const scrollMs = 600;
const round = value => Math.round(value * 10) / 10;

async function runScroll(ctx, panel, look) {
  const page = await ctx.open({ panel: panel, style: look });
  try {
    // A look asked for in the address is put on by a swap, and a play made during it is lost
    await page.waitForFunction(() => !window.teletraanTest.busy(), null, { timeout: 20000 }).catch(() => {});
    // On a slow computer the held card is drawn late
    await page.waitForFunction(() => document.querySelector('[data-scroll-page]'), null, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => {
      window.__motion.armScroll();
      window.teletraanTest.play('monday-scroll');
    });
    await page.waitForFunction(() => window.__motion.scroll.done, null, { timeout: 5000 });
    return await page.evaluate(() => window.__motion.scroll);
  } catch (error) {
    return { error: 'the ' + panel + ' card did not scroll within 5 seconds of the play (' + String(error.message).split('\n')[0] + ')' };
  } finally {
    await page.close();
  }
}

function distance(scroll) {
  const first = scroll.samples[0].rows;
  const last = scroll.samples[scroll.samples.length - 1].rows;
  return first.map((row, index) => row.top - last[index].top);
}

function fourRows(ctx, rule, scroll, panel) {
  const failures = [];
  const first = scroll.samples[0].rows;
  const moved = distance(scroll);
  const rowHeight = first.length > 1 ? first[1].top - first[0].top : first[0].height;

  if (Math.abs(scroll.duration - scrollMs) > 1) failures.push(panel + ' at 0 ms: the scroll lasts ' + round(scroll.duration) + ' ms, not ' + scrollMs + ' ms');
  if (scroll.properties.some(name => name !== 'transform')) failures.push(panel + ' at 0 ms: the scroll animates ' + scroll.properties.join(', ') + ', not only transform');
  moved.forEach((distanceMoved, index) => {
    const wanted = rowsPerPage * rowHeight;
    if (Math.abs(distanceMoved - wanted) > 0.5) failures.push(first[index].name + ' at ' + scrollMs + ' ms: moved ' + round(distanceMoved) + 'px, four row heights are ' + round(wanted) + 'px');
  });
  if (failures.length > 0) ctx.keep(rule, { name: 'rows-at-600ms', drawing: drawing('rows-at-600ms', scroll.samples[scroll.samples.length - 1].rows.concat([Object.assign({ kind: 'plate', name: 'clip' }, scroll.clip)]), []) });
  return failures;
}

function insideClip(ctx, rule, scroll, panel) {
  const failures = [];
  const bad = [];
  const clip = scroll.clip;
  const frame = scroll.panel;

  if (scroll.overflow !== 'hidden' && scroll.overflow !== 'clip') failures.push(panel + ' at 0 ms: the window of the rows has overflow ' + scroll.overflow + ', so rows would show outside it');
  if (clip.left < frame.left - 0.5 || clip.top < frame.top - 0.5 || clip.left + clip.width > frame.left + frame.width + 0.5 || clip.top + clip.height > frame.top + frame.height + 0.5) {
    failures.push(panel + ' at 0 ms: the window of the rows (' + round(clip.left) + ', ' + round(clip.top) + ', ' + round(clip.width) + ' x ' + round(clip.height) + ') is not inside the panel');
  }

  // At rest a row is whole in the window or not in it at all
  [scroll.samples[0], scroll.samples[scroll.samples.length - 1]].forEach(sample => {
    sample.rows.forEach(row => {
      const across = Math.min(row.top + row.height, clip.top + clip.height) - Math.max(row.top, clip.top);
      if (across > 0.5 && across < row.height - 0.5) {
        failures.push(row.name + ' at ' + sample.time + ' ms: ' + round(across) + 'px of its ' + round(row.height) + 'px show in the window, a row at rest is whole or hidden');
        bad.push(row.name);
      }
    });
  });
  if (failures.length > 0) ctx.keep(rule, { name: 'rows-at-rest', drawing: drawing('rows-at-rest', scroll.samples[0].rows.concat([Object.assign({ kind: 'plate', name: 'clip' }, clip)]), bad) });
  return failures;
}

function rule(look, panel, name, check) {
  const full = 'monday-scroll/' + look + '/' + panel + '/' + name;
  return {
    name: full,
    async run(ctx) {
      const scroll = await ctx.scenario('monday-scroll ' + look + ' ' + panel, () => runScroll(ctx, panel, look));
      if (scroll.error) return [scroll.error];
      return check(ctx, full, scroll, panel);
    },
  };
}

export const tests = looks.flatMap(look => cards.flatMap(panel => [
  rule(look, panel, 'four-row-heights-in-600ms', fourRows),
  rule(look, panel, 'rows-stay-in-the-clip', insideClip),
]));
