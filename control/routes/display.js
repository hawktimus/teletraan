// The Display tab. The Studio stays the source of truth: this reads Dashboard Settings from Sanity every time, writes the same
// stored fields the Studio board writes, and writes them to the draft only. Publish is a separate call.
//
//   GET  /control/api/display          the rotation rows, the theme settings, the choices and what the wall would do with each row
//   GET  /control/api/display/rev      only the revision, so the page can say when the Studio copy is newer
//   POST /control/api/display/check    what the wall would do with the rows as they are now on the page
//   POST /control/api/display/save     { rows, theme, baseRev, force } writes the draft
//   POST /control/api/display/publish  { rev, force } publishes the draft
//
// The write key is read from local.env at the moment of a write (support/sanity.js) and is never in an answer.

import { Refusal, mount, readJson, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { cleanRows, cleanTheme, pickSettings, publishMutations, saveMutations, settingsQuery, themeOf } from '../support/display.js';
import { checkRows, extrasOf, loadWorld } from '../support/display-wall.js';
import { withKeys } from '../static/display-rows.js';
import { defaultRotationRows } from '../../dashboard/config-rotation.js';
import { mondayCharts, mondayDepartments, mondayLists, mondayTeams, scheduledThemeIds, weekdays } from '../../dashboard/config-lists.js';
import { themeNames } from '../support/requests.js';
import { panelGroups, sidePanelGroups, viewTable } from '../../studio/tools/rotation-titles.js';

const defaultPageSeconds = 20;

async function readSettings(ctx) {
  try {
    return pickSettings(await makeSanity(ctx).queryRaw(settingsQuery));
  } catch (error) {
    throw new Refusal(502, 'The Teletraan computer could not read Dashboard Settings from Sanity. Check its internet connection, then press Refresh from Sanity.');
  }
}

function summary(current) {
  return { rev: current.rev, updatedAt: current.updatedAt, isDraft: current.isDraft, studioNewer: current.studioNewer };
}

function choices() {
  const titled = list => list.map(group => ({ title: group.title, panels: group.panels.map(panel => ({ value: panel.value, title: panel.title })) }));
  return {
    views: viewTable.map(view => ({ value: view.value, title: view.title })),
    panelGroups: titled(panelGroups),
    sideGroups: titled(sidePanelGroups),
    themes: scheduledThemeIds.map(id => ({ value: id, title: themeNames[id] || id })),
    weekdays: weekdays,
    monday: { departments: mondayDepartments, lists: mondayLists, charts: mondayCharts, teams: mondayTeams },
  };
}

// The refusal for a document that moved on since the page loaded it. The page asks before it overwrites.
function conflict(res, current, words) {
  send(res, 409, { conflict: true, error: words, current: summary(current) });
}

export function register(router, ctx) {
  ctx.state = ctx.state || {};

  mount(router, ctx, 'GET', '/display', async (req, res) => {
    const fresh = new URL(req.url || '/', 'http://local').searchParams.get('fresh') === '1';
    const sanity = makeSanity(ctx);
    const current = await readSettings(ctx);
    const source = current.source || {};
    const rows = withKeys(source.rotationRows);
    const world = await loadWorld(ctx, sanity, new Date(), fresh);

    send(res, 200, Object.assign(summary(current), {
      canWrite: sanity.hasToken(),
      hasDocument: Boolean(current.source),
      rows: rows,
      pageSeconds: typeof source.pageSeconds === 'number' && source.pageSeconds > 0 ? source.pageSeconds : defaultPageSeconds,
      theme: themeOf(source),
      choices: choices(),
      standardRows: withKeys(defaultRotationRows()),
      wall: { problem: world.problem, rows: await checkRows(rows, world), extras: extrasOf(world), checkedAt: world.now.toISOString() },
      serverTime: new Date().toISOString(),
    }));
  });

  mount(router, ctx, 'GET', '/display/rev', async (req, res) => {
    send(res, 200, summary(await readSettings(ctx)));
  });

  mount(router, ctx, 'POST', '/display/check', async (req, res) => {
    const body = await readJson(req);
    if (!Array.isArray(body.rows) || body.rows.length > 300) throw new Refusal(400, 'The rows should be a list of at most 300.');
    const world = await loadWorld(ctx, makeSanity(ctx), new Date(), body.fresh === true);
    send(res, 200, { problem: world.problem, rows: await checkRows(body.rows, world), checkedAt: world.now.toISOString() });
  });

  mount(router, ctx, 'POST', '/display/save', async (req, res) => {
    const body = await readJson(req);
    const sanity = makeSanity(ctx);
    if (!sanity.hasToken()) throw new Refusal(503, 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.');

    const current = await readSettings(ctx);
    const fields = {};
    if (body.rows !== undefined) fields.rotationRows = cleanRows(body.rows, current.source && current.source.rotationRows);
    Object.assign(fields, cleanTheme(body.theme));
    if (Object.keys(fields).length === 0) throw new Refusal(400, 'There is nothing to save.');

    if (body.force !== true && body.baseRev !== current.rev) {
      return conflict(res, current, 'Dashboard Settings changed in the Studio after this page loaded it.');
    }
    const mutations = saveMutations(fields, current);
    try {
      await sanity.mutate(mutations);
    } catch (error) {
      if (error instanceof Refusal && error.status === 409 && body.force !== true) return conflict(res, await readSettings(ctx), 'Dashboard Settings changed in the Studio while this was being saved. Nothing was written.');
      throw error;
    }
    ctx.state.displayWorld = null;
    ctx.log('display saved to the draft of Dashboard Settings: ' + Object.keys(fields).join(', '));
    send(res, 200, Object.assign({ ok: true }, summary(await readSettings(ctx))));
  });

  mount(router, ctx, 'POST', '/display/publish', async (req, res) => {
    const body = await readJson(req);
    const sanity = makeSanity(ctx);
    if (!sanity.hasToken()) throw new Refusal(503, 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.');

    const current = await readSettings(ctx);
    const mutations = publishMutations(current);
    if (body.force !== true && body.rev !== current.draft._rev) {
      return conflict(res, current, 'The draft changed in the Studio after you saved it.');
    }
    await sanity.mutate(mutations);
    ctx.state.displayWorld = null;
    ctx.log('display published Dashboard Settings');
    send(res, 200, Object.assign({ ok: true }, summary(await readSettings(ctx))));
  });
}
