// Lists of content documents for the Display tab: the ticker lines and the roster. The same drafts-then-Publish rules as the
// Studio and as the All settings routes (settings-doc.js), for a kind of document that has many copies.
//
//   GET  /control/api/docs/<type>                       every document of that type, the draft when there is one
//   POST /control/api/docs/<type>                       { set } makes a new draft with a new id
//   POST /control/api/docs/<type>/check                 { set } the warnings of the schema for those values; writes nothing
//   GET  /control/api/docs/<type>/<id>                  one document
//   POST /control/api/docs/<type>/<id>/save             { set, unset, baseRev, force } writes the changed fields to the draft
//   POST /control/api/docs/<type>/<id>/publish          { confirm, rev, force } publishes that one document
//   POST /control/api/docs/<type>/<id>/delete           { confirm, rev, force, draftOnly } removes it
//
// Only the types the plan names as collections are allowed, a field outside the spec is refused, and every value is held to the
// limits of the Studio schema. The write key is read from local.env at the moment of a write and is never in an answer.

import { Refusal, mount, paramOf, readJson, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { checkIdShape, cleanChanges, documentQuery, getSpec, pickDocument, publishMutations, publishedIdOf, saveMutations, summary } from '../support/settings-doc.js';
import { collectionOf, deleteMutations, itemsFrom, listQuery, newDraft, warningsFor } from '../support/collection-doc.js';
import { conflict, readTeams, refuse } from './settings-doc.js';

const noToken = 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.';

// The document and its part of the spec, or a refusal. A document of another type is never touched.
async function openItem(ctx, type, id) {
  checkIdShape(id);
  const docSpec = collectionOf(await getSpec(ctx), type);
  let current;
  try {
    current = pickDocument(await makeSanity(ctx).queryRaw(documentQuery(id)), id);
  } catch (error) {
    throw new Refusal(502, 'The Teletraan computer could not read this from Sanity. Check its internet connection, then press Refresh.');
  }
  if (!current.source || current.source._type !== type) throw new Refusal(404, 'That item does not exist. It may have been deleted in the Studio.');
  return { docSpec: docSpec, current: current };
}

function need(sanity) {
  if (!sanity.hasToken()) throw new Refusal(503, noToken);
}

export function register(router, ctx) {
  mount(router, ctx, 'GET', '/docs/:type', async (req, res) => {
    const type = paramOf(req, '/docs/:type', 'type');
    const docSpec = collectionOf(await getSpec(ctx), type);
    const sanity = makeSanity(ctx);
    let raw;
    try {
      raw = await sanity.queryRaw(listQuery(type));
    } catch (error) {
      throw new Refusal(502, 'The Teletraan computer could not read the list from Sanity. Check its internet connection, then press Refresh.');
    }
    send(res, 200, {
      type: type,
      title: docSpec.title,
      canWrite: sanity.hasToken(),
      teams: await readTeams(ctx),
      items: itemsFrom(raw, type, sanity.config),
      serverTime: new Date().toISOString(),
    });
  });

  mount(router, ctx, 'POST', '/docs/:type', async (req, res) => {
    const type = paramOf(req, '/docs/:type', 'type');
    const body = await readJson(req);
    const docSpec = collectionOf(await getSpec(ctx), type);
    const sanity = makeSanity(ctx);
    need(sanity);
    try {
      const teams = await readTeams(ctx);
      const made = newDraft(docSpec, body, teams.map(team => team.id));
      await sanity.mutate(made.mutations);
      ctx.log('new ' + type + ' draft made on the Control page: ' + made.id);
      send(res, 200, Object.assign({ ok: true }, summary((await openItem(ctx, type, made.id)).current)));
    } catch (error) {
      if (error instanceof Refusal && error.status === 400) return refuse(res, error);
      throw error;
    }
  });

  mount(router, ctx, 'POST', '/docs/:type/check', async (req, res) => {
    const type = paramOf(req, '/docs/:type/check', 'type');
    const body = await readJson(req);
    const docSpec = collectionOf(await getSpec(ctx), type);
    send(res, 200, { warnings: warningsFor(docSpec, body && typeof body.set === 'object' && body.set ? body.set : {}) });
  });

  mount(router, ctx, 'GET', '/docs/:type/:id', async (req, res) => {
    const type = paramOf(req, '/docs/:type/:id', 'type');
    const id = paramOf(req, '/docs/:type/:id', 'id');
    const { current } = await openItem(ctx, type, id);
    send(res, 200, Object.assign(summary(current), { type: type, published: Boolean(current.published), document: current.source }));
  });

  mount(router, ctx, 'POST', '/docs/:type/:id/save', async (req, res) => {
    const type = paramOf(req, '/docs/:type/:id/save', 'type');
    const id = paramOf(req, '/docs/:type/:id/save', 'id');
    const body = await readJson(req);
    const sanity = makeSanity(ctx);
    need(sanity);
    try {
      const { docSpec, current } = await openItem(ctx, type, id);
      const teams = await readTeams(ctx);
      const changes = cleanChanges(docSpec, body, current.source, teams.map(team => team.id));
      if (Object.keys(changes.set).length === 0 && changes.unset.length === 0) throw new Refusal(400, 'There is nothing to save.');
      if (body.force !== true && body.baseRev !== current.rev) return conflict(res, current, 'This changed in the Studio after this page loaded it.');

      try {
        await sanity.mutate(saveMutations(changes, current, docSpec.title));
      } catch (error) {
        if (error instanceof Refusal && error.status === 409 && body.force !== true) {
          return conflict(res, (await openItem(ctx, type, id)).current, 'This changed in the Studio while it was being saved. Nothing was written.');
        }
        throw error;
      }
      ctx.log(type + ' saved to the draft of ' + current.id + ': ' + Object.keys(changes.set).concat(changes.unset).join(', '));
      send(res, 200, Object.assign({ ok: true, warnings: warningsFor(docSpec, changes.set) }, summary((await openItem(ctx, type, id)).current)));
    } catch (error) {
      if (error instanceof Refusal && error.status === 400) return refuse(res, error);
      throw error;
    }
  });

  mount(router, ctx, 'POST', '/docs/:type/:id/publish', async (req, res) => {
    const type = paramOf(req, '/docs/:type/:id/publish', 'type');
    const id = paramOf(req, '/docs/:type/:id/publish', 'id');
    const body = await readJson(req);
    if (body.confirm !== true) throw new Refusal(400, 'Confirm to publish. Nothing was published.');
    const sanity = makeSanity(ctx);
    need(sanity);

    const { docSpec, current } = await openItem(ctx, type, id);
    const mutations = publishMutations(current, docSpec.title);
    if (body.force !== true && body.rev !== current.draft._rev) return conflict(res, current, 'The draft changed in the Studio after you saved it.');
    await sanity.mutate(mutations);
    ctx.log(type + ' published: ' + current.id);
    send(res, 200, Object.assign({ ok: true }, summary((await openItem(ctx, type, id).catch(() => ({ current: Object.assign({}, current, { draft: null, isDraft: false, studioNewer: false }) }))).current)));
  });

  mount(router, ctx, 'POST', '/docs/:type/:id/delete', async (req, res) => {
    const type = paramOf(req, '/docs/:type/:id/delete', 'type');
    const id = paramOf(req, '/docs/:type/:id/delete', 'id');
    const body = await readJson(req);
    const sanity = makeSanity(ctx);
    need(sanity);

    const { current } = await openItem(ctx, type, id);
    const mutations = deleteMutations(current, body);
    if (body.force !== true && body.rev !== undefined && body.rev !== current.rev) return conflict(res, current, 'This changed in the Studio after this page loaded it.');
    await sanity.mutate(mutations);
    ctx.log(type + (body.draftOnly === true ? ' draft dropped: ' : ' deleted: ') + publishedIdOf(id));
    send(res, 200, { ok: true, deleted: body.draftOnly !== true, id: publishedIdOf(id) });
  });
}
