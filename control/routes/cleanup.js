// The Clean up expired items card of Settings. The Studio stays the source of truth: this reads Dashboard Settings from Sanity every
// time, writes the same stored fields the Studio shows in its Clean up expired items section, and writes them to the draft only.
// Publish is a separate call, and the page asks the owner before it sends it.
//
//   GET  /control/api/cleanup           the setting, the last run, and the revision
//   POST /control/api/cleanup/save      { setting, baseRev, force } writes the draft
//   POST /control/api/cleanup/publish   { rev, force, confirm: true } publishes the draft
//   POST /control/api/cleanup/preview   asks the helper for the list of what would be deleted now; deletes nothing
//   POST /control/api/cleanup/delete    { confirmed: true, expected: N } deletes the list, only when the published Mode is Delete
//                                       and the list still has N documents
//
// The job on the Teletraan computer (computer/scripts/expired-cleanup.sh) reads the published setting, makes the list, saves a
// backup before it deletes and has its own limits. The write key is read from local.env at the moment of a write
// (support/sanity.js) and is never in an answer.

import { Refusal, mount, readJson, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { pickSettings, publishMutations, saveMutations, settingsQuery } from '../support/display.js';
import { cleanSetting, cleanupFieldNames, parseLines, settingOf, statusOf, statusQuery } from '../support/cleanup.js';

async function readSettings(ctx) {
  try {
    return pickSettings(await makeSanity(ctx).queryRaw(settingsQuery));
  } catch (error) {
    throw new Refusal(502, 'The Teletraan computer could not read Dashboard Settings from Sanity. Check its internet connection, then press Refresh.');
  }
}

function summary(current) {
  return { rev: current.rev, updatedAt: current.updatedAt, isDraft: current.isDraft, studioNewer: current.studioNewer };
}

function conflict(res, current, words) {
  send(res, 409, { conflict: true, error: words, current: summary(current) });
}

async function askHelper(ctx, word) {
  try {
    return String(await ctx.helper(word, []));
  } catch (error) {
    if (typeof ctx.log === 'function') ctx.log('helper ' + word + ' failed' + (error && error.code ? ' (' + error.code + ')' : '') + ': ' + String(error && error.message).slice(0, 200));
    throw new Refusal(502, String((error && error.message) || 'The helper did not answer.'));
  }
}

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/cleanup', async (req, res) => {
    const sanity = makeSanity(ctx);
    const current = await readSettings(ctx);
    let status = statusOf(null);
    try {
      status = statusOf(await sanity.query(statusQuery));
    } catch (error) {
      status = Object.assign(statusOf(null), { unreadable: true });
    }
    send(res, 200, Object.assign(summary(current), {
      canWrite: sanity.hasToken(),
      hasDocument: Boolean(current.source),
      setting: settingOf(current.source),
      // What the nightly job uses is the published copy, which differs while a draft waits
      published: settingOf(current.published),
      status: status,
      serverTime: new Date().toISOString(),
    }));
  });

  mount(router, ctx, 'POST', '/cleanup/save', async (req, res) => {
    const body = await readJson(req);
    const sanity = makeSanity(ctx);
    if (!sanity.hasToken()) throw new Refusal(503, 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.');

    const fields = cleanSetting(body.setting);
    const current = await readSettings(ctx);
    if (body.force !== true && body.baseRev !== current.rev) {
      return conflict(res, current, 'Dashboard Settings changed in the Studio after this page loaded it.');
    }
    try {
      await sanity.mutate(saveMutations(fields, current));
    } catch (error) {
      if (error instanceof Refusal && error.status === 409 && body.force !== true) return conflict(res, await readSettings(ctx), 'Dashboard Settings changed in the Studio while this was being saved. Nothing was written.');
      throw error;
    }
    ctx.log('clean up settings saved to the draft of Dashboard Settings: ' + Object.keys(fields).filter(name => cleanupFieldNames.includes(name)).join(', '));
    send(res, 200, Object.assign({ ok: true }, summary(await readSettings(ctx))));
  });

  mount(router, ctx, 'POST', '/cleanup/publish', async (req, res) => {
    const body = await readJson(req);
    const sanity = makeSanity(ctx);
    if (!sanity.hasToken()) throw new Refusal(503, 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.');
    // Publishing puts every waiting change of Dashboard Settings on the wall, so the owner has to say yes first
    if (body.confirm !== true) throw new Refusal(400, 'Confirm the publish first. Nothing was published.');

    const current = await readSettings(ctx);
    const mutations = publishMutations(current);
    if (body.force !== true && body.rev !== current.draft._rev) {
      return conflict(res, current, 'The draft changed in the Studio after you saved it.');
    }
    await sanity.mutate(mutations);
    ctx.log('clean up settings published with Dashboard Settings');
    send(res, 200, Object.assign({ ok: true }, summary(await readSettings(ctx))));
  });

  mount(router, ctx, 'POST', '/cleanup/preview', async (req, res) => {
    await readJson(req);
    const answer = parseLines(await askHelper(ctx, 'cleanup-preview'));
    if (answer.error) throw new Refusal(502, answer.error);
    ctx.log('clean up preview: ' + answer.items.length + ' documents on the list');
    send(res, 200, Object.assign({ ok: true }, answer));
  });

  mount(router, ctx, 'POST', '/cleanup/delete', async (req, res) => {
    const body = await readJson(req);
    if (body.confirmed !== true) throw new Refusal(400, 'Confirm first, then press the button again. Nothing was deleted.');
    if (!Number.isInteger(body.expected) || body.expected < 1) throw new Refusal(400, 'Show what would be deleted first, then press Delete these now.');

    // The published Mode has to be Delete. The job checks this too; this saves a round trip and a confusing answer.
    const current = await readSettings(ctx);
    if (settingOf(current.published).cleanupMode !== 'delete') {
      throw new Refusal(409, 'Mode is Only show in the published Dashboard Settings, so nothing is deleted. Choose Delete, save, publish, and try again.');
    }

    // The list must still be the one the owner agreed to
    const before = parseLines(await askHelper(ctx, 'cleanup-preview'));
    if (before.error) throw new Refusal(502, before.error);
    if (before.stop) throw new Refusal(409, before.stop);
    if (before.items.length !== body.expected) {
      throw new Refusal(409, 'The list changed: it has ' + before.items.length + ' documents now, not ' + body.expected + '. Show what would be deleted again.');
    }

    const answer = parseLines(await askHelper(ctx, 'cleanup-delete'));
    if (answer.error) throw new Refusal(502, answer.error);
    ctx.log('clean up deleted: ' + (answer.result || 'no result line'));
    send(res, 200, Object.assign({ ok: true }, answer));
  });
}
