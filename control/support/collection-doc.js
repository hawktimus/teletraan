// What the content blocks of the Content tab read and write: a list of documents of one type (the ticker lines, the roster), each
// kept as a draft and a published copy exactly as the Studio keeps them. The form spec (settings-doc.js) says which types are
// allowed and what each field may hold; this file lists them, makes a new draft, and works out the delete. A save and a publish
// use the mutations of settings-doc.js, so a revision conflict, a refused field and a limit behave the same on every page.

import { randomUUID } from 'node:crypto';
import { Refusal } from './http.js';
import { problemsIn } from '../static/settings-check.js';
import { cleanChanges, draftIdOf, pickDocument, publishedIdOf } from './settings-doc.js';

const typeShape = /^[A-Za-z][A-Za-z0-9]{0,40}$/;

export function collectionOf(spec, type) {
  if (!typeShape.test(String(type))) throw new Refusal(400, 'That is not the name of a kind of content.');
  const found = spec.documents.filter(doc => doc.mode === 'collection' && doc.type === type)[0];
  if (!found) throw new Refusal(404, 'The Control page does not edit that kind of content.');
  return found;
}

export function listQuery(type) {
  return '*[_type == "' + type + '"] | order(order asc, _createdAt asc)';
}

// A picture of a document as a small square address on Sanity's image server, or ''. The page only shows it.
export function pictureUrl(config, doc) {
  const image = doc && (doc.portrait || doc.photo);
  const ref = image && image.asset && typeof image.asset._ref === 'string' ? image.asset._ref : '';
  const match = /^image-([A-Za-z0-9]+)-(\d+x\d+)-([a-z]+)$/.exec(ref);
  if (!match) return '';
  return 'https://cdn.sanity.io/images/' + config.projectId + '/' + config.dataset + '/' + match[1] + '-' + match[2] + '.' + match[3] + '?w=96&h=96&fit=crop&auto=format';
}

// A photo for the grid: no wider than 480 pixels, never enlarged, in a small format. The page never asks for the original.
export const gridWidth = 480;

export function photoUrl(config, doc) {
  const ref = doc && doc.image && doc.image.asset && typeof doc.image.asset._ref === 'string' ? doc.image.asset._ref : '';
  const match = /^image-([A-Za-z0-9]+)-(\d+x\d+)-([a-z]+)$/.exec(ref);
  if (!match) return '';
  return 'https://cdn.sanity.io/images/' + config.projectId + '/' + config.dataset + '/' + match[1] + '-' + match[2] + '.' + match[3] + '?w=' + gridWidth + '&fit=max&auto=format';
}

// One entry for each document: the draft when there is one, else the published copy
export function itemsFrom(raw, type, config) {
  const groups = {};
  (Array.isArray(raw) ? raw : []).filter(doc => doc && doc._type === type && typeof doc._id === 'string').forEach(doc => {
    const id = publishedIdOf(doc._id);
    groups[id] = groups[id] || [];
    groups[id].push(doc);
  });
  return Object.keys(groups).map(id => {
    const current = pickDocument(groups[id], id);
    return {
      id: id,
      rev: current.rev,
      updatedAt: current.updatedAt,
      createdAt: groups[id].map(doc => doc._createdAt).filter(Boolean).sort()[0] || '',
      isDraft: current.isDraft,
      studioNewer: current.studioNewer,
      published: Boolean(current.published),
      document: current.source,
      picture: type === 'photo' ? photoUrl(config, current.source) : pictureUrl(config, current.source),
    };
  });
}

// The first draft of a new document: what the page sent, checked like a save, the starting values of the schema for what it did
// not send, and the required fields present. Throws a Refusal that names the field.
export function newDraft(docSpec, body, teamIds) {
  const sent = {};
  const given = body && typeof body.set === 'object' && body.set && !Array.isArray(body.set) ? body.set : {};
  Object.keys(given).forEach(name => { if (given[name] !== undefined && given[name] !== null && given[name] !== '') sent[name] = given[name]; });

  const changes = cleanChanges(docSpec, { set: sent }, null, teamIds);
  const set = Object.assign({}, changes.set);
  docSpec.fields.forEach(field => {
    if (set[field.name] === undefined && field.initialValue !== undefined && !field.readOnly) set[field.name] = JSON.parse(JSON.stringify(field.initialValue));
  });
  const trouble = problemsIn(docSpec.fields, set, '', true)[0];
  if (trouble) {
    const refusal = new Refusal(400, trouble.message);
    refusal.field = trouble.path;
    throw refusal;
  }
  const id = randomUUID();
  return { id: id, mutations: [{ create: Object.assign({ _id: draftIdOf(id), _type: docSpec.type }, set) }] };
}

// Delete: a draft alone goes without a question. A published document is removed only after confirm, with its draft, which is the
// same as publishing the delete. draftOnly drops the waiting changes and keeps the published copy.
export function deleteMutations(current, body) {
  if (body.draftOnly === true) {
    if (!current.draft) throw new Refusal(409, 'There are no waiting changes to drop.');
    return [{ delete: { id: draftIdOf(current.id) } }];
  }
  if (current.published && body.confirm !== true) throw new Refusal(400, 'Confirm to delete. The item leaves the wall and the Studio. Nothing was deleted.');
  const mutations = [];
  if (current.published) mutations.push({ delete: { id: current.id } });
  if (current.draft) mutations.push({ delete: { id: draftIdOf(current.id) } });
  return mutations;
}
