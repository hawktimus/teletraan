// The Scheduled reboot card of Settings. The Studio stays the source of truth: this reads Dashboard Settings from Sanity every time,
// writes the same stored fields the Studio shows in its Scheduled reboot section, and writes them to the draft only. Publish is a
// separate call, and the page asks the owner before it sends it.
//
//   GET  /control/api/reboot           the setting, the next and the last reboot, and the revision
//   POST /control/api/reboot/save      { setting, baseRev, force } writes the draft
//   POST /control/api/reboot/publish   { rev, force, confirm: true } publishes the draft
//
// The timer on the Teletraan computer (computer/scripts/scheduled-reboot.sh) reads the published setting. The write key is read from
// local.env at the moment of a write (support/sanity.js) and is never in an answer.

import { Refusal, mount, readJson, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { pickSettings, publishMutations, saveMutations, settingsQuery } from '../support/display.js';
import { cleanSetting, rebootFieldNames, settingOf, statusOf, statusQuery } from '../support/reboot.js';

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

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/reboot', async (req, res) => {
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
      // What the timer uses is the published copy, which differs while a draft waits
      published: settingOf(current.published),
      status: status,
      serverTime: new Date().toISOString(),
    }));
  });

  mount(router, ctx, 'POST', '/reboot/save', async (req, res) => {
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
    ctx.log('reboot schedule saved to the draft of Dashboard Settings: ' + Object.keys(fields).filter(name => rebootFieldNames.includes(name)).join(', '));
    send(res, 200, Object.assign({ ok: true }, summary(await readSettings(ctx))));
  });

  mount(router, ctx, 'POST', '/reboot/publish', async (req, res) => {
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
    ctx.log('reboot schedule published with Dashboard Settings');
    send(res, 200, Object.assign({ ok: true }, summary(await readSettings(ctx))));
  });
}
