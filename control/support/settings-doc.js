// What the All settings form reads and writes: the form spec made from the Studio schemas of the live release, which documents it
// may touch, and the Sanity mutations for a save and a publish. The write goes to the draft only, with the same revision
// check as the Display tab (support/display.js); Publish is a separate call. A name that is not a field of the spec is refused,
// every value is checked against the limits of the spec, and the stored names are the ones the Studio uses.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { Refusal } from './http.js';
import { problemsIn } from '../static/settings-check.js';
import { loadSchemaTypes } from './schema-load.js';

// ----- the spec -----

// A cheap fingerprint of the schema files, so a release that changes them gets a new spec and one that does not keeps the old
function signature(root) {
  const names = [];
  const walk = folder => {
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) names.push(full + ':' + fs.statSync(full).mtimeMs + ':' + fs.statSync(full).size);
    }
  };
  ['schemas', 'tools'].forEach(name => walk(path.join(root, 'studio', name)));
  return names.join('|');
}

// The spec of the release at ctx.root, made when asked and kept in memory until the schemas change
export async function getSpec(ctx) {
  ctx.state = ctx.state || {};
  const root = fs.realpathSync(ctx.root);
  const key = root + '#' + signature(root);
  const kept = ctx.state.settingsSpec;
  if (kept && kept.key === key) return kept.value;

  const { types } = await loadSchemaTypes(root);
  const { buildSpec } = await import(pathToFileURL(path.join(root, 'studio', 'tools', 'schema-spec.js')).href);
  const { plan } = await import(pathToFileURL(path.join(root, 'studio', 'tools', 'schema-plan.js')).href);
  const value = buildSpec(types, plan);
  value.release = path.basename(root);
  ctx.state.settingsSpec = { key: key, value: value };
  return value;
}

// ----- which documents -----

export function publishedIdOf(id) {
  return String(id).replace(/^drafts\./, '');
}

export function draftIdOf(id) {
  return 'drafts.' + publishedIdOf(id);
}

const idShape = /^(drafts\.)?[A-Za-z0-9_-]{1,80}$/;

// The part of the spec that an id belongs to, or null. A document of a list type is known only by its stored type, so
// that is checked by the caller with specForDocument.
export function specForFixedId(spec, id) {
  const plain = publishedIdOf(id);
  return spec.documents.filter(doc => doc.id === plain || (doc.ids || []).includes(plain))[0] || null;
}

export function specForDocument(spec, id, doc) {
  const fixed = specForFixedId(spec, id);
  if (fixed) return !doc || doc._type === fixed.type ? fixed : null;
  if (!doc) return null;
  return spec.documents.filter(entry => entry.mode === 'list' && entry.type === doc._type)[0] || null;
}

export function checkIdShape(id) {
  if (!idShape.test(String(id))) throw new Refusal(400, 'That is not the name of a settings document.');
}

// ----- reading -----

export function pickDocument(result, id) {
  const list = Array.isArray(result) ? result : [];
  const published = list.find(doc => doc && doc._id === publishedIdOf(id)) || null;
  const draft = list.find(doc => doc && doc._id === draftIdOf(id)) || null;
  const source = draft || published;
  return {
    id: publishedIdOf(id),
    published: published,
    draft: draft,
    source: source,
    rev: source ? source._rev || '' : '',
    updatedAt: source ? source._updatedAt || '' : '',
    isDraft: Boolean(draft),
    studioNewer: Boolean(draft && published && Date.parse(draft._updatedAt) > Date.parse(published._updatedAt)) || Boolean(draft && !published),
  };
}

export function documentQuery(id) {
  return '*[_id in ["' + publishedIdOf(id) + '", "' + draftIdOf(id) + '"]]';
}

export function summary(current) {
  return { id: current.id, rev: current.rev, updatedAt: current.updatedAt, isDraft: current.isDraft, studioNewer: current.studioNewer };
}

// ----- checking what the page sent -----

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function newKey() {
  return randomBytes(6).toString('hex');
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function emptyValue(value) {
  return value === undefined || value === null || value === '';
}

// Merges what the page sent for a group over the stored group, so a sub-field the form does not draw is kept
function mergeGroup(field, sent, stored) {
  const base = plain(stored) ? Object.assign({}, stored) : {};
  Object.keys(sent).forEach(name => {
    const sub = field.fields.filter(one => one.name === name)[0];
    if (!sub) return;
    if (emptyValue(sent[name])) delete base[name];
    else base[name] = mergeValue(sub, sent[name], base[name]);
  });
  return base;
}

// The list to store. Every item keeps the sub-fields the form does not draw (matched by _key), a new item gets a key, and an
// item of a kind the form cannot draw must be exactly as it is stored.
function mergeList(field, sent, stored) {
  const keep = {};
  (Array.isArray(stored) ? stored : []).forEach(item => { if (plain(item) && typeof item._key === 'string') keep[item._key] = item; });
  const used = {};
  return sent.map((item, index) => {
    if (!plain(item)) throw new Refusal(400, field.title + ': item ' + (index + 1) + ' is not a group of settings.');
    const member = field.members.length === 1 ? field.members[0] : field.members.filter(one => one.type === item._type)[0];
    const old = typeof item._key === 'string' ? keep[item._key] : undefined;
    if (!member) {
      if (!old || !same(old, item)) throw new Refusal(400, field.title + ': item ' + (index + 1) + ' is a kind the form cannot change. Edit it in the Studio.');
      used[old._key] = true;
      return old;
    }
    let key = typeof item._key === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(item._key) && !used[item._key] ? item._key : newKey();
    while (used[key]) key = newKey();
    used[key] = true;
    const base = old ? Object.assign({}, old) : {};
    member.fields.forEach(sub => {
      if (!Object.prototype.hasOwnProperty.call(item, sub.name)) return;
      if (emptyValue(item[sub.name])) delete base[sub.name];
      else base[sub.name] = mergeValue(sub, item[sub.name], base[sub.name]);
    });
    if (field.members.length > 1 || member.type !== 'item') base._type = member.type;
    else if (old && old._type) base._type = old._type;
    base._key = key;
    return base;
  });
}

function mergeValue(field, sent, stored) {
  if (field.widget === 'group' && plain(sent)) return mergeGroup(field, sent, stored);
  if (field.widget === 'list' && Array.isArray(sent)) return mergeList(field, sent, stored);
  if (field.widget === 'team' && plain(sent)) return { _type: 'reference', _ref: sent._ref };
  return sent;
}

// What a save writes: { set, unset }, built from the fields the page sent. Throws a Refusal with the field named in
// error.field when a name is unknown or a value breaks a limit.
export function cleanChanges(docSpec, body, source, teamIds) {
  const set = {};
  const unset = [];
  const sent = plain(body.set) ? body.set : {};
  const cleared = Array.isArray(body.unset) ? body.unset : [];
  if (body.set !== undefined && !plain(body.set)) throw new Refusal(400, 'The changes should be a list of settings.');
  if (body.unset !== undefined && !Array.isArray(body.unset)) throw new Refusal(400, 'The settings to clear should be a list.');

  const top = docSpec.fields;
  const unknown = Object.keys(sent).concat(cleared).filter(name => !top.some(field => field.name === name));
  if (unknown.length > 0) throw fieldRefusal(unknown[0], 'There is no setting called ' + unknown[0] + ' on this page.');

  Object.keys(sent).forEach(name => {
    const field = top.filter(one => one.name === name)[0];
    if (field.readOnly) throw fieldRefusal(name, field.title + ' cannot be changed here.');
    if (emptyValue(sent[name])) cleared.push(name);
  });
  cleared.forEach(name => {
    const field = top.filter(one => one.name === name)[0];
    if (field.validation && field.validation.required) throw fieldRefusal(name, (field.validation.messages && field.validation.messages.required) || 'Add ' + field.title.toLowerCase() + '. It cannot be empty.');
    if (!unset.includes(name)) unset.push(name);
  });

  const given = {};
  Object.keys(sent).forEach(name => {
    if (emptyValue(sent[name])) return;
    const field = top.filter(one => one.name === name)[0];
    given[name] = sent[name];
    set[name] = mergeValue(field, sent[name], source ? source[name] : undefined);
  });

  // The values the page sent are checked, not the merged ones, so an old stored sub-field cannot stop an unrelated save
  const trouble = problemsIn(top, given, '', false).concat(teamProblems(top, given, teamIds));
  if (trouble.length > 0) throw fieldRefusal(trouble[0].path, trouble[0].message);
  return { set: set, unset: unset };
}

function fieldRefusal(field, message) {
  const refusal = new Refusal(400, message);
  refusal.field = field;
  return refusal;
}

// A team link must point at a team that exists
function teamProblems(fields, values, teamIds, trail = '') {
  const found = [];
  fields.forEach(field => {
    const value = values && values[field.name];
    if (value === undefined) return;
    const path = trail + field.name;
    if (field.widget === 'team' && value && !teamIds.includes(value._ref)) found.push({ path: path, message: field.title + ' should be Both or one of the teams.' });
    if (field.widget === 'group' && plain(value)) found.push(...teamProblems(field.fields, value, teamIds, path + '.'));
    if (field.widget === 'list' && Array.isArray(value)) {
      value.forEach((item, index) => {
        const member = field.members.length === 1 ? field.members[0] : field.members.filter(one => one.type === item._type)[0];
        if (member) found.push(...teamProblems(member.fields, item, teamIds, path + '[' + index + '].'));
      });
    }
  });
  return found;
}

// ----- the mutations -----

function withoutSystemFields(doc) {
  const copy = Object.assign({}, doc);
  ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
  return copy;
}

// Save: write to the draft. With no draft yet it is made from the published document first, as the Studio does, so every
// other field is kept. ifRevisionID makes Sanity refuse the write if the draft changed since it was read.
export function saveMutations(changes, current, title) {
  const draftId = draftIdOf(current.id);
  const patch = { id: draftId };
  if (Object.keys(changes.set).length > 0) patch.set = changes.set;
  if (changes.unset.length > 0) patch.unset = changes.unset;
  if (current.draft) {
    if (current.draft._rev) patch.ifRevisionID = current.draft._rev;
    return [{ patch: patch }];
  }
  if (!current.published) throw new Refusal(409, title + ' has not been published yet. Open it in the Studio, click Publish once, and come back.');
  return [
    { createIfNotExists: Object.assign(withoutSystemFields(current.published), { _id: draftId }) },
    { patch: patch },
  ];
}

// Publish: the draft becomes the published document and the draft is deleted, which is what the Studio Publish button does.
export function publishMutations(current, title) {
  if (!current.draft) throw new Refusal(409, 'There is nothing to publish. The Studio has no waiting changes in ' + title + '.');
  return [
    { createOrReplace: Object.assign(withoutSystemFields(current.draft), { _id: current.id }) },
    { delete: { id: draftIdOf(current.id) } },
  ];
}
