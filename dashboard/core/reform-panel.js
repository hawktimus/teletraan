// The panel transition (kind reform, docs/transitions.md): the large panel changes to the next row of the same view. The page
// stays where it is, and only the main panel comes apart and goes together again with the next panel in it.
//
//   1. The old panel is copied (core/reform-bake.js). The copy covers the panel, and the edges loosen and fold over it.
//   2. The page changes underneath, where nobody sees it, and the new panel is copied the same way.
//   3. The squares turn over from the old content to the new, the edges unfold and tighten, and the real panel is shown.

import { bake, rectOf, screenOrigin } from './reform-bake.js';
import { drawRun, fillCover, fillSquares } from './reform-draw.js';
import { hiddenStops, reformTimes, windowOf } from './reform-plan.js';
import { kitNow, markReady, mount, nextFrame, playTracks, scaleNow, takeRun, until } from './reform-run.js';

const turnMs = 4; // milliseconds of one turn of the copying, so that no frame is long

export async function playPanel(swapPage, context) {
  const area = document.querySelector('#region-grid1 .area');
  const release = area ? takeRun('reform', context.hold) : null;
  if (!release) return 0;

  let cleanup = () => {};
  const scale = scaleNow();

  try {
    const kit = await kitNow();
    const origin = screenOrigin();
    const before = await bake(area, { origin: origin, budgetMs: turnMs, wait: nextFrame });
    if (context.busyNow()) return 0;

    const rect = before.rect;
    const drawn = drawRun([{ role: 'main', from: rect, to: rect, grid: 'main', seed: Math.floor(Math.random() * 4294967296) }], { from: windowOf(rect), to: windowOf(rect) }, kit);
    fillCover(drawn, 'old', before);
    cleanup = mount(drawn);
    const clock = playTracks(drawn, scale, [{ element: area, property: 'opacity', stops: hiddenStops() }]);
    drawn.animations = clock.animations;

    swapPage();
    const after = await bake(area, { origin: origin, budgetMs: turnMs, wait: nextFrame });
    fillCover(drawn, 'new', after);
    await fillSquares(drawn, 'old', before, turnMs, nextFrame);
    await fillSquares(drawn, 'new', after, turnMs, nextFrame);
    markReady(drawn);

    await until(clock, reformTimes.totalMs, scale);
    return clock.duration;
  } catch (error) {
    console.error('The panel transition failed', error);
    return 0;
  } finally {
    cleanup();
    release();
  }
}
