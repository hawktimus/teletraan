// The pieces of a frame meet without a seam. Every frame is cut into pieces for the swap and the pile, and for the
// moment before it moves each piece has to cover the edge of the next one by a pixel. The probe (lib/probe.js, seams)
// paints the pieces as the browser does at the size of the window and looks for pixels that are not solid between
// solid ones. It runs at 1920 x 1080 and at 3840 x 2160, which is a window the page scales to twice the size.

import { drawing } from './lib/harness.mjs';

// Each theme, and Minimal, which is the bar layout in the Original theme
const looks = ['original', 'cybertron', 'retro', 'minimal'];
// A large panel, a Monday card, the photo panel, a small panel and the countdown
const panels = ['tasks', 'monday-tasks', 'photo', 'task-counts', 'countdown'];
const sizes = [{ name: '1920', width: 1920, height: 1080 }, { name: '3840', width: 3840, height: 2160 }];
const round = value => Math.round(value * 10) / 10;

async function runSeams(ctx, look, panel) {
  const page = await ctx.open({ panel: panel, style: look }, undefined, { settleMs: 800 });
  try {
    // A frame that is still being drawn or swapped has pieces that are not yet in place
    await page.waitForFunction(() => !window.teletraanTest.busy(), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    const found = {};
    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.waitForTimeout(600);
      found[size.name] = await page.evaluate(() => window.__motion.seams());
    }
    return found;
  } catch (error) {
    return { error: 'the ' + panel + ' panel in ' + look + ' could not be looked at: ' + String(error.message).split('\n')[0] };
  } finally {
    await page.close();
  }
}

function rule(look, panel, size) {
  const full = 'seams/' + look + '/' + panel + '/' + size.name;
  return {
    name: full,
    async run(ctx) {
      const found = await ctx.scenario('seams ' + look + ' ' + panel, () => runSeams(ctx, look, panel));
      if (found.error) return [found.error];

      const seams = found[size.name];
      const failures = seams.map(seam => seam.pieces.slice(0, 3).join(' and ') + ' at ' + size.name + ' wide: a seam of ' + seam.count + ' pixels at x ' + round(seam.left) + ', y ' + round(seam.top) + ' (' + round(seam.width) + ' x ' + round(seam.height) + '), the pieces must overlap by 1px');
      if (seams.length > 0) ctx.keep(full, { name: 'seams', drawing: drawing(full, seams.map((seam, index) => Object.assign({ kind: 'plate', name: 'seam ' + index }, seam)), seams.map((seam, index) => 'seam ' + index)) });
      return failures;
    },
  };
}

export const tests = looks.flatMap(look => panels.flatMap(panel => sizes.map(size => rule(look, panel, size))));
