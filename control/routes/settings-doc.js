// The All settings form: every setting the Studio has, drawn on the Control page from the Studio schemas. The Studio stays the source of
// truth: documents are read from Sanity every time and written to the draft with the stored names the Studio uses.
//
//   GET  /control/api/spec               the form spec of the live release: documents, tabs, fields, and the fields left out with the reason
//   GET  /control/api/docs               the documents that can be edited, with their titles
//   GET  /control/api/doc/<id>           the whole document (the draft when there is one), its revision, and the teams to pick from
//   POST /control/api/doc/<id>/save      { set, unset, baseRev, force } writes the changed fields to the draft
//   POST /control/api/doc/<id>/publish   { confirm, rev, force } publishes that one document
//
// Only documents the spec names are allowed, and a field that is not in the spec is refused. The write key is read from local.env at
// the moment of a write (support/sanity.js) and is never in an answer.

import { Refusal, mount, paramOf, readJson, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import {
  checkIdShape, cleanChanges, documentQuery, getSpec, pickDocument, publishMutations, publishedIdOf, saveMutations,
  specForDocument, specForFixedId, summary,
} from '../support/settings-doc.js';

const teamQuery = '*[_type == "team" && !(_id in path("drafts.**"))] | order(order asc, name asc) { _id, name, code, active }';

function listQuery(types) {
  return '*[_type in ' + JSON.stringify(types) + '] | order(_type asc, order asc, name asc, title asc) { _id, _type, name, title, code }';
}

async function readDocument(ctx, id) {
  try {
    return pickDocument(await makeSanity(ctx).queryRaw(documentQuery(id)), id);
  } catch (error) {
    throw new Refusal(502, 'The Teletraan computer could not read the settings from Sanity. Check its internet connection, then press Refresh from Sanity.');
  }
}

async function readTeams(ctx) {
  try {
    const teams = await makeSanity(ctx).query(teamQuery);
    return (Array.isArray(teams) ? teams : []).map(team => ({ id: team._id, code: team.code || '', name: team.name || team.code || team._id, active: team.active !== false }));
  } catch (error) {
    return [];
  }
}

// The document and the part of the spec that describes it, or a refusal. A document the spec does not name is never touched.
async function openDocument(ctx, id) {
  checkIdShape(id);
  const spec = await getSpec(ctx);
  const current = await readDocument(ctx, id);
  const docSpec = specForDocument(spec, id, current.source);
  if (!docSpec) throw new Refusal(404, specForFixedId(spec, id) || !current.source ? 'That settings document does not exist.' : 'That document is not one the settings form edits.');
  if (!current.source) throw new Refusal(404, docSpec.title + ' has not been published yet. Open it in the Studio, click Publish once, and come back.');
  return { spec: spec, docSpec: docSpec, current: current };
}

function conflict(res, current, words) {
  send(res, 409, { conflict: true, error: words, current: summary(current) });
}

function refuse(res, error) {
  send(res, error.status, { error: error.message, field: error.field || '' });
}

export function register(router, ctx) {
  ctx.state = ctx.state || {};

  mount(router, ctx, 'GET', '/spec', async (req, res) => {
    const spec = await getSpec(ctx);
    send(res, 200, spec);
  });

  mount(router, ctx, 'GET', '/docs', async (req, res) => {
    const spec = await getSpec(ctx);
    const out = [];
    const listTypes = spec.documents.filter(doc => doc.mode === 'list').map(doc => doc.type);
    spec.documents.forEach(doc => {
      if (doc.mode === 'singleton') out.push({ id: doc.id, type: doc.type, title: doc.title });
      if (doc.mode === 'fixed') doc.ids.forEach(id => out.push({ id: id, type: doc.type, title: doc.title + ': ' + id.replace(/^view-/, '').replace(/^./, letter => letter.toUpperCase()) }));
    });
    if (listTypes.length > 0) {
      let found = [];
      try {
        found = await makeSanity(ctx).queryRaw(listQuery(listTypes));
      } catch (error) {
        throw new Refusal(502, 'The Teletraan computer could not read the list of documents from Sanity.');
      }
      const seen = {};
      (Array.isArray(found) ? found : []).forEach(doc => {
        const id = publishedIdOf(doc._id);
        if (seen[id]) return;
        seen[id] = true;
        const kind = spec.documents.filter(entry => entry.type === doc._type)[0];
        out.push({ id: id, type: doc._type, title: (kind ? kind.title + ': ' : '') + (doc.name || doc.title || doc.code || id) });
      });
    }
    send(res, 200, { documents: out });
  });

  mount(router, ctx, 'GET', '/doc/:id', async (req, res) => {
    const id = paramOf(req, '/doc/:id', 'id');
    const { docSpec, current } = await openDocument(ctx, id);
    send(res, 200, Object.assign(summary(current), {
      type: docSpec.type,
      title: docSpec.title,
      canWrite: makeSanity(ctx).hasToken(),
      document: current.source,
      teams: await readTeams(ctx),
      serverTime: new Date().toISOString(),
    }));
  });

  mount(router, ctx, 'POST', '/doc/:id/save', async (req, res) => {
    const id = paramOf(req, '/doc/:id/save', 'id');
    const body = await readJson(req);
    const sanity = makeSanity(ctx);
    if (!sanity.hasToken()) throw new Refusal(503, 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.');

    try {
      const { docSpec, current } = await openDocument(ctx, id);
      const teams = await readTeams(ctx);
      const changes = cleanChanges(docSpec, body, current.source, teams.map(team => team.id));
      if (Object.keys(changes.set).length === 0 && changes.unset.length === 0) throw new Refusal(400, 'There is nothing to save.');

      if (body.force !== true && body.baseRev !== current.rev) {
        return conflict(res, current, docSpec.title + ' changed in the Studio after this page loaded it.');
      }
      const mutations = saveMutations(changes, current, docSpec.title);
      try {
        await sanity.mutate(mutations);
      } catch (error) {
        if (error instanceof Refusal && error.status === 409 && body.force !== true) {
          return conflict(res, (await openDocument(ctx, id)).current, docSpec.title + ' changed in the Studio while this was being saved. Nothing was written.');
        }
        throw error;
      }
      ctx.state.displayWorld = null;
      ctx.log('settings saved to the draft of ' + current.id + ': ' + Object.keys(changes.set).concat(changes.unset).join(', '));
      send(res, 200, Object.assign({ ok: true }, summary((await openDocument(ctx, id)).current)));
    } catch (error) {
      if (error instanceof Refusal && error.status === 400) return refuse(res, error);
      throw error;
    }
  });

  mount(router, ctx, 'POST', '/doc/:id/publish', async (req, res) => {
    const id = paramOf(req, '/doc/:id/publish', 'id');
    const body = await readJson(req);
    if (body.confirm !== true) throw new Refusal(400, 'Confirm to publish. Nothing was published.');
    const sanity = makeSanity(ctx);
    if (!sanity.hasToken()) throw new Refusal(503, 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.');

    const { docSpec, current } = await openDocument(ctx, id);
    const mutations = publishMutations(current, docSpec.title);
    if (body.force !== true && body.rev !== current.draft._rev) {
      return conflict(res, current, 'The draft changed in the Studio after you saved it.');
    }
    await sanity.mutate(mutations);
    ctx.state.displayWorld = null;
    ctx.log('settings published: ' + current.id);
    send(res, 200, Object.assign({ ok: true }, summary((await openDocument(ctx, id).catch(() => ({ current: Object.assign({}, current, { draft: null, isDraft: false, studioNewer: false }) }))).current)));
  });
}
