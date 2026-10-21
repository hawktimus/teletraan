// A Sanity that remembers. It answers the three kinds of question the All settings routes ask (documents by id, the teams, a list
// of documents by type) and applies the mutations they send (create, createIfNotExists, patch with set and unset and ifRevisionID,
// createOrReplace, delete), so a test can save, read back, and change a document "in the Studio" in between. Nothing leaves the
// process.
//
//   const sanity = makeFakeSanity([doc, doc]);
//   ctx.fetch = sanity.fetch;
//   sanity.touch('dashboardSettings', { pageSeconds: 33 });   a change made in the Studio

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

export function makeFakeSanity(documents) {
  const stored = {};
  let counter = 0;
  const log = [];

  const stamp = doc => {
    counter += 1;
    doc._rev = 'rev-' + counter;
    doc._updatedAt = new Date(Date.UTC(2026, 9, 18, 10, 0, counter)).toISOString();
    return doc;
  };
  (documents || []).forEach(doc => { stored[doc._id] = stamp(copy(doc)); });

  function answerFor(query, perspective) {
    const visible = Object.values(stored).filter(doc => perspective === 'raw' || !doc._id.startsWith('drafts.'));
    const ids = /_id in \[([^\]]*)\]/.exec(query);
    if (ids && !query.includes('path(')) {
      const wanted = ids[1].split(',').map(part => part.trim().replace(/"/g, ''));
      return visible.filter(doc => wanted.includes(doc._id)).map(copy);
    }
    if (query.includes('_type == "team"')) {
      return Object.values(stored).filter(doc => doc._type === 'team' && !doc._id.startsWith('drafts.')).map(doc => ({ _id: doc._id, name: doc.name, code: doc.code, active: doc.active }));
    }
    const types = /_type in (\[[^\]]*\])/.exec(query);
    if (types) {
      const wanted = JSON.parse(types[1]);
      return visible.filter(doc => wanted.includes(doc._type)).map(doc => ({ _id: doc._id, _type: doc._type, name: doc.name, title: doc.title, code: doc.code }));
    }
    // every document of one type, whole (the lists of the Display tab)
    const one = /_type == "([A-Za-z]+)"/.exec(query);
    if (one) return visible.filter(doc => doc._type === one[1]).map(copy);
    return [];
  }

  function apply(mutation) {
    if (mutation.create) {
      const doc = mutation.create;
      if (stored[doc._id]) throw Object.assign(new Error('exists'), { status: 409 });
      stored[doc._id] = stamp(copy(doc));
      return { id: doc._id, operation: 'create' };
    }
    if (mutation.createIfNotExists) {
      const doc = mutation.createIfNotExists;
      if (!stored[doc._id]) stored[doc._id] = stamp(copy(doc));
      return { id: doc._id, operation: 'create' };
    }
    if (mutation.createOrReplace) {
      const doc = mutation.createOrReplace;
      stored[doc._id] = stamp(copy(doc));
      return { id: doc._id, operation: 'update' };
    }
    if (mutation.delete) {
      delete stored[mutation.delete.id];
      return { id: mutation.delete.id, operation: 'delete' };
    }
    if (mutation.patch) {
      const patch = mutation.patch;
      const doc = stored[patch.id];
      if (!doc) throw Object.assign(new Error('no such document'), { status: 404 });
      if (patch.ifRevisionID && patch.ifRevisionID !== doc._rev) throw Object.assign(new Error('revision'), { status: 409 });
      Object.assign(doc, copy(patch.set || {}));
      (patch.unset || []).forEach(name => { delete doc[name]; });
      stamp(doc);
      return { id: patch.id, operation: 'update' };
    }
    throw new Error('the fake Sanity does not know this mutation');
  }

  return {
    stored: stored,
    log: log,

    fetch: async (url, init) => {
      const address = new URL(String(url));
      if (address.pathname.includes('/data/mutate/')) {
        const mutations = JSON.parse(init.body).mutations;
        log.push(mutations);
        try {
          const results = mutations.map(apply);
          return { ok: true, status: 200, json: async () => ({ results: results }) };
        } catch (error) {
          return { ok: false, status: error.status || 400, json: async () => ({ error: { description: error.message } }) };
        }
      }
      const query = address.searchParams.get('query') || (init && init.body ? JSON.parse(init.body).query : '');
      return { ok: true, status: 200, json: async () => ({ result: answerFor(query, address.searchParams.get('perspective')) }) };
    },

    // A change made in the Studio: into the draft when there is one, else a draft is made from the published document
    touch(id, fields) {
      const draftId = 'drafts.' + id;
      if (!stored[draftId]) stored[draftId] = stamp(Object.assign(copy(stored[id]), { _id: draftId }));
      Object.assign(stored[draftId], copy(fields));
      stamp(stored[draftId]);
    },
  };
}
