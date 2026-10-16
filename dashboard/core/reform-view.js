// The view transition (kind reformView, docs/transitions.md): the view changes, and every panel of the page does the same at
// once. The side column and the main panel swap sides on the way (the mirror of Nova), the team name, the team plate, the
// school line and the ticker label turn over to the next team's, and the hawk turns into the other team's hawk.
//
//   1. The whole stage is copied (core/reform-bake.js) and the copy covers it. The real stage is out of sight from here to the
//      moment the edges are back, so nothing of the next view shows before it is turned to.
//   2. The look goes on under the cover (the page's swapPage, as the swap does it), and the stage is copied again.
//   3. Each region of the page (banner, side column, main panel, ticker) is drawn where it was and where it goes. Its edges
//      loosen and fold where it was, its squares turn from the old content to the new while they travel, and its edges unfold
//      where it goes. The hawk is drawn over it all (core/reform-hawk.js).

import * as frame from '../frame.js';
import { bake, rectOf, screenOrigin, slice } from './reform-bake.js';
import { drawRun, fillCover, fillSquares, revealSquares } from './reform-draw.js';
import { drawHawk, teamOfLogo } from './reform-hawk.js';
import { gridNameOf, randomOf, reformTimes } from './reform-plan.js';
import { kitNow, layerOf, markReady, mount, nextFrame, playTracks, scaleNow, takeRun, until } from './reform-run.js';

const turnMs = 4; // milliseconds of one turn of the copying, so that no frame is long
const squaresMs = 4; // milliseconds of one turn of giving the squares their content and showing them
const squaresPerFrame = 8; // and the most squares shown in one frame, shortly before the turn
const otherRegions = ['grid2', 'ticker']; // the areas that wait for the page to be changed under the cover
const regionWait = 1200; // milliseconds to wait for them to have chosen their pages
const restWait = 8000; // milliseconds to wait for the areas to stop changing page
const reloadWait = 8000; // how long the screen stays covered for a page that is about to reload

// The parts of the page that turn, by role, with the elements that can be that part in each layout
const roles = [
  ['banner', ['region-banner', 'region-strip']],
  ['side', ['region-sidebar', 'region-column', 'region-right']],
  ['main', ['region-grid1']],
  ['ticker', ['region-ticker']],
];

// Where each role is on the screen now. A role the layout does not have is left out.
export function rolesOnPage(origin) {
  const found = {};

  roles.forEach(([role, ids]) => {
    for (const id of ids) {
      const element = document.getElementById(id);
      const rect = element ? rectOf(element, origin) : null;
      if (rect && rect.w > 40 && rect.h > 30) {
        found[role] = { id: id, rect: rect };
        return;
      }
    }
  });
  return found;
}

// The regions of the run: each role the new look has, from where the old look had it (or the same place) to the new one
export function regionsOf(before, after, seed) {
  const random = randomOf(seed);
  const list = [];

  roles.forEach(([role]) => {
    const to = after[role];
    const from = before[role] || to;
    if (!to) return;

    const grid = role === 'side' ? 'side' : gridNameOf(to.id, to.rect);
    list.push({ role: role, from: from.rect, to: to.rect, grid: grid, seed: Math.floor(random() * 4294967296) });
  });
  return list;
}

function logoBox(origin) {
  const logo = Array.from(document.querySelectorAll('#stage .logo')).map(element => ({ element: element, rect: rectOf(element, origin) })).find(item => item.rect.w > 20 && item.rect.h > 20);
  return logo || null;
}

// The stage is out of sight until the edges start to go back, and is then whole under the cover, which goes after
export function stageStops() {
  return [[0, 0.001], [reformTimes.tighten[0] - 1, 0.001, 'linear'], [reformTimes.tighten[0], 1], [reformTimes.totalMs, 1]];
}

async function waitForRest(busyNow) {
  const until = performance.now() + restWait;
  while (performance.now() < until) {
    if (busyNow()) return false;
    if (!document.querySelector('.area:not([data-state="shown"])')) return true;
    await frame.wait(100);
  }
  return false;
}

export async function playView(swapPage, context) {
  const release = takeRun('reform', context.hold);
  if (!release) return 0;

  const stage = document.getElementById('stage');
  const screen = context.wholeScreen(false);
  const scale = scaleNow();
  let cleanup = () => {};
  let restore = () => {};
  let swapped = false;

  frame.setSwapPlaying(true);
  try {
    if (!await waitForRest(context.busyNow)) return 0;

    const kit = await kitNow();
    const origin = screenOrigin();
    const hide = '.logo';
    const before = await bake(stage, { origin: origin, budgetMs: turnMs, wait: nextFrame, hide: hide, edges: true });
    if (context.busyNow()) return 0;

    const rolesBefore = rolesOnPage(origin);
    const oldLogo = logoBox(origin);
    const oldTeam = oldLogo ? teamOfLogo(oldLogo.element) : 'prime';
    const hawkOld = oldLogo ? { rect: oldLogo.rect, team: oldTeam } : null;
    const seed = Math.floor(Math.random() * 4294967296);

    // The old stage covers the page, and the page is out of sight: the same frame
    const layer = layerOf();
    const camera = layer.firstElementChild;
    const cover = { from: { x: 0, y: 0, w: 1920, h: 1080 }, to: { x: 0, y: 0, w: 1920, h: 1080 }, fadeOut: true, edges: true };
    const precover = slice(before, cover.from);
    const precoverEdges = slice(before, cover.from, 'edges');
    const covers = document.createElement('div');

    covers.className = 'reform-covers';
    covers.append(precoverEdges, precover);
    camera.replaceChildren(covers);
    layer.hidden = false;
    stage.style.opacity = '0.001'; // not quite 0: what is out of sight is not drawn, and it would be drawn again all at once when it comes back

    // The look goes on under the cover, with the pages of the other areas, as the swap does it
    context.moveOn(otherRegions);
    await screen.waitForRegions(otherRegions, regionWait);
    swapPage();
    swapped = true;
    screen.apart();
    if (context.reloading()) await frame.wait(reloadWait);

    const after = await bake(stage, { origin: origin, budgetMs: turnMs, wait: nextFrame, hide: hide });
    const rolesAfter = rolesOnPage(origin);
    const newLogo = logoBox(origin);
    const newTeam = newLogo ? teamOfLogo(newLogo.element) : oldTeam;

    const drawn = drawRun(regionsOf(rolesBefore, rolesAfter, seed), cover, kit);
    const extra = [{ element: stage, property: 'opacity', stops: stageStops() }];
    if (hawkOld && newLogo) {
      const hawk = drawHawk({ x: hawkOld.rect.x, y: hawkOld.rect.y, w: hawkOld.rect.w }, { x: newLogo.rect.x, y: newLogo.rect.y, w: newLogo.rect.w }, hawkOld.team, newTeam);
      drawn.front.appendChild(hawk.element);
      hawk.tracks.forEach(track => extra.push(track));
    }
    drawn.coverOld.appendChild(precover);
    drawn.coverEdges.appendChild(precoverEdges);
    cleanup = mount(drawn);
    const clock = playTracks(drawn, scale, extra);
    drawn.animations = clock.animations;
    restore = clock.restore;

    fillCover(drawn, 'new', after);
    await fillSquares(drawn, before, after, squaresMs, nextFrame);
    // shown shortly before the turn, so that nothing is drawn under the flat copy for longer than it has to be
    await until(clock, reformTimes.turn[0] - 350, scale);
    await revealSquares(drawn, squaresPerFrame, nextFrame);
    markReady(drawn);

    await until(clock, reformTimes.totalMs, scale);
    return clock.duration;
  } catch (error) {
    console.error('The view transition failed', error);
    return 0;
  } finally {
    stage.style.removeProperty('opacity');
    cleanup();
    restore();
    layerOf().hidden = true;
    screen.together();
    screen.end();
    frame.setSwapPlaying(false);
    release();
  }
}
