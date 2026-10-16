// The logic behind the Publish all tool (publish-all-tool.js). Nothing in this
// file needs Sanity or React, so tools/test-publish-all.mjs runs it with node.
//
// A draft is a document whose id starts with "drafts.". Publishing one is what
// the Publish button on the document does: write a copy under the id without
// that prefix, and delete the draft, in one transaction. Documents are
// published one at a time, so one bad document never stops the others.

const draftPrefix = 'drafts.';

// Which documents to look at: every draft, whatever its type
export const draftQuery = '*[_id in path("drafts.**")]';

// The Content Lake sets these itself, so a copy must not carry the old values
const systemFields = ['_rev', '_updatedAt'];

export function isDraftId(id) {
  return typeof id === 'string' && id.indexOf(draftPrefix) === 0;
}

export function publishedIdOf(id) {
  return isDraftId(id) ? id.slice(draftPrefix.length) : id;
}

// "Task: Wire the robot", the way the tool names a document. A page
// that is its own title, such as Look, is named once.
export function labelOf(item) {
  return item.title === item.typeTitle ? item.title : item.typeTitle + ': ' + item.title;
}

// A value from a document by a path such as "name" or "subteam.name"
function valueAt(doc, path) {
  return String(path).split('.').reduce((value, key) => (value === null || value === undefined ? undefined : value[key]), doc);
}

function nonEmptyText(value) {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

// What to call a document in the list. First the type's own preview, which is
// what the sidebar shows (a select and a prepare function in the schema). If
// that gives nothing, the first of these fields that has text. Then the name of
// the type, which suits a page that exists once, such as Look.
const usefulFields = ['title', 'name', 'heading', 'headline', 'label', 'text'];

export function titleOf(doc, type) {
  const preview = type && type.preview;

  // A page such as Dashboard Settings has a prepare function and nothing to select
  if (preview && (preview.select || typeof preview.prepare === 'function')) {
    try {
      const select = preview.select || {};
      const selected = {};
      Object.keys(select).forEach(key => {
        selected[key] = valueAt(doc, select[key]);
      });
      const prepared = typeof preview.prepare === 'function' ? preview.prepare(selected) : selected;
      const fromPreview = nonEmptyText(prepared && prepared.title);
      if (fromPreview) return fromPreview;
    } catch (error) {
      // a preview that cannot read this document falls through to the fields
    }
  }

  for (let i = 0; i < usefulFields.length; i += 1) {
    const text = nonEmptyText(doc[usefulFields[i]]);
    if (text) return text;
  }
  return (type && type.title) || 'Untitled';
}

// Why a draft cannot be published at all, or '' when it can be tried.
// singletonIds is { type: fixed id } for the pages that exist once.
function problemWith(doc, type, singletonIds) {
  if (!type) return 'This Studio has no content type called "' + doc._type + '", so the document cannot be checked.';

  const fixedId = Object.prototype.hasOwnProperty.call(singletonIds, doc._type) ? singletonIds[doc._type] : '';
  if (fixedId && doc._id !== draftPrefix + fixedId) {
    return 'This page exists once, with the id "' + fixedId + '". A draft with the id "' + doc._id + '" is not that page, so it was left alone.';
  }
  return '';
}

// The list the tool shows. documents are what draftQuery found, and schema is
// the Studio's (schema.get(name) gives a type). Sorted by type, then title.
export function chooseDrafts(documents, schema, singletonIds) {
  const fixedIds = singletonIds || {};
  const items = [];

  documents.forEach(doc => {
    if (!doc || !isDraftId(doc._id) || typeof doc._type !== 'string') return;

    const type = schema.get(doc._type);
    items.push({
      id: doc._id,
      // For a page that exists once this is its fixed id, because its draft is "drafts." and that id
      publishedId: publishedIdOf(doc._id),
      typeName: doc._type,
      typeTitle: (type && type.title) || doc._type,
      title: titleOf(doc, type),
      type: type,
      doc: doc,
      problem: problemWith(doc, type, fixedIds),
    });
  });

  return items.sort((a, b) => a.typeTitle.localeCompare(b.typeTitle) || a.title.localeCompare(b.title));
}

// The ticked boxes are an object of { draft id: true or false }

// Every item ticked, or every item unticked
export function pickAll(items, on) {
  const picked = {};
  items.forEach(item => {
    picked[item.id] = on;
  });
  return picked;
}

// After the list is loaded again: a draft that was in the list keeps its box,
// and a new one starts ticked
export function pickedAfterReload(items, previous) {
  const picked = {};
  items.forEach(item => {
    picked[item.id] = Object.prototype.hasOwnProperty.call(previous, item.id) ? previous[item.id] : true;
  });
  return picked;
}

export function pickedItems(items, picked) {
  return items.filter(item => picked[item.id] === true);
}

// A reference points at another document by id. A document that another
// selected document points at goes first, so a new place is published before
// the task that uses it.
function referencedIds(value, found) {
  if (Array.isArray(value)) {
    value.forEach(entry => referencedIds(entry, found));
  } else if (value !== null && typeof value === 'object') {
    if (typeof value._ref === 'string') found.push(value._ref);
    Object.keys(value).forEach(key => referencedIds(value[key], found));
  }
  return found;
}

export function orderForPublishing(items) {
  const byPublishedId = {};
  items.forEach(item => {
    byPublishedId[item.publishedId] = item;
  });

  const ordered = [];
  const visited = {};

  function visit(item) {
    if (visited[item.id]) return;
    visited[item.id] = true;
    referencedIds(item.doc, []).forEach(id => {
      if (Object.prototype.hasOwnProperty.call(byPublishedId, id)) visit(byPublishedId[id]);
    });
    ordered.push(item);
  }

  items.forEach(visit);
  return ordered;
}

// A reference made with "Create new" inside a field starts weak and marked to
// be strengthened. Publishing makes it an ordinary reference, as the Publish
// button does.
function strengthen(value) {
  if (Array.isArray(value)) return value.map(strengthen);
  if (value === null || typeof value !== 'object') return value;

  if (typeof value._ref === 'string') {
    if (!value._strengthenOnPublish) return value;
    const reference = Object.assign({}, value);
    delete reference._strengthenOnPublish;
    if (!value._strengthenOnPublish.weak) delete reference._weak;
    return reference;
  }

  const copy = {};
  Object.keys(value).forEach(key => {
    copy[key] = strengthen(value[key]);
  });
  return copy;
}

// The one transaction that publishes a draft: check that the draft is still the
// one that was listed, write the published copy, delete the draft. If somebody
// changed the draft after the list was loaded, the first step fails and nothing
// is written, so their change is not lost. The only thing ever deleted is the
// draft itself.
export function publishMutations(item) {
  if (!isDraftId(item.id) || isDraftId(item.publishedId)) {
    throw new Error('Only a draft can be published, and ' + item.id + ' is not one.');
  }

  const copy = strengthen(item.doc);
  systemFields.forEach(name => {
    delete copy[name];
  });
  copy._id = item.publishedId;

  const mutations = [];
  if (item.doc._rev) {
    mutations.push({ patch: { id: item.id, ifRevisionID: item.doc._rev, unset: ['_revision_lock_pseudo_field_'] } });
  }
  mutations.push({ createOrReplace: copy });
  mutations.push({ delete: { id: item.id } });
  return mutations;
}

// A field of the document's type by name, to show its title instead of its name
function fieldOf(type, name) {
  const fields = (type && type.fields) || [];
  for (let i = 0; i < fields.length; i += 1) {
    if (fields[i].name === name) return fields[i];
  }
  return null;
}

// "Rows, item 3, Time": where in the document a message is about. A path is a
// list of field names, array positions and { _key } objects.
function wordsForPath(path, doc, type) {
  const parts = [];
  let value = doc;

  (path || []).forEach((step, position) => {
    if (typeof step === 'string') {
      const field = position === 0 ? fieldOf(type, step) : null;
      parts.push(field && field.title ? field.title : step);
      value = value === null || value === undefined ? undefined : value[step];
      return;
    }

    let index = typeof step === 'number' ? step : -1;
    if (index < 0 && Array.isArray(value)) {
      index = value.findIndex(entry => entry && step && entry._key === step._key);
    }
    parts.push('item ' + (index + 1));
    value = Array.isArray(value) && index >= 0 ? value[index] : undefined;
  });

  return parts.join(', ');
}

// What stops a publish. Only errors do: a warning or a note does not stop the
// Publish button either. markers are what Studio's validation gives back.
export function reasonsFor(markers, doc, type) {
  return (markers || [])
    .filter(marker => marker.level === 'error')
    .map(marker => {
      const where = wordsForPath(marker.path, doc, type);
      const message = marker.message || (marker.item && marker.item.message) || 'This is not valid.';
      return where ? where + ': ' + message : message;
    });
}

// The words of an error, with the detail Sanity sometimes adds
export function messageOf(error) {
  const message = (error && error.message) || String(error);
  const detail = error && error.details && error.details.description;
  return detail && message.indexOf(detail) === -1 ? message + ' ' + detail : message;
}

// The one failure with a plain explanation: the draft changed after the list was loaded
function explainFailure(error) {
  const message = messageOf(error);
  if (/revision/i.test(message)) {
    return 'The draft was changed after this list was loaded, so it was not published. Refresh the list and try again. (' + message + ')';
  }
  return message;
}

// Publishes the items one after another. helpers:
//   validate(item)    gives back what Studio's validation found (a promise of a list of markers)
//   commit(mutations) sends one transaction (a promise)
//   onProgress(number, total, item)  optional, called before each document
// Gives back one result for each item, in the order they were published:
//   { item, status: 'published' }
//   { item, status: 'skipped', reasons: [text] }   it would fail the Publish button, or cannot be published
//   { item, status: 'failed', error: text }        the check or the write itself went wrong
export async function publishSelected(items, helpers) {
  const ordered = orderForPublishing(items);
  const results = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const item = ordered[i];
    if (helpers.onProgress) helpers.onProgress(i + 1, ordered.length, item);
    results.push(await publishOne(item, helpers));
  }
  return results;
}

// Each document is checked just before it is published, so a task that points
// at a place published a moment ago sees that place as published.
async function publishOne(item, helpers) {
  if (item.problem) return { item: item, status: 'skipped', reasons: [item.problem] };

  let markers;
  try {
    markers = await helpers.validate(item);
  } catch (error) {
    return { item: item, status: 'failed', error: 'The document could not be checked. ' + messageOf(error) };
  }

  const reasons = reasonsFor(markers, item.doc, item.type);
  if (reasons.length > 0) return { item: item, status: 'skipped', reasons: reasons };

  try {
    await helpers.commit(publishMutations(item));
  } catch (error) {
    return { item: item, status: 'failed', error: explainFailure(error) };
  }
  return { item: item, status: 'published' };
}

function countOf(number, word) {
  return number + ' ' + word + (number === 1 ? '' : 's');
}

// The summary the tool shows at the end: three lists and one sentence
export function buildSummary(results) {
  const summary = { published: [], skipped: [], failed: [], headline: '' };

  results.forEach(result => {
    const line = { id: result.item.id, label: labelOf(result.item) };
    if (result.status === 'published') {
      summary.published.push(line);
    } else if (result.status === 'skipped') {
      summary.skipped.push(Object.assign(line, { reasons: result.reasons }));
    } else {
      summary.failed.push(Object.assign(line, { error: result.error }));
    }
  });

  if (results.length === 0) {
    summary.headline = 'Nothing was selected.';
    return summary;
  }

  const parts = ['Published ' + summary.published.length + ' of ' + countOf(results.length, 'document') + '.'];
  if (summary.skipped.length > 0) parts.push(summary.skipped.length + ' skipped.');
  if (summary.failed.length > 0) parts.push(summary.failed.length + ' failed.');
  summary.headline = parts.join(' ');
  return summary;
}
