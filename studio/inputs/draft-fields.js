// Reading one document and saving some of its fields to the draft. The pages of the Studio that are not documents
// (Today, Look, Competition) use it. A page writes only the fields it shows, to the draft, and never publishes:
// Publish all in the top bar puts the change on the screen. If the document was never published and has no draft,
// the page says so, because it cannot make the whole document from nothing.

import { useEffect, useState } from 'react';

// The same version as the screen's own questions to Sanity
export const apiVersion = '2025-02-19';

export const words = {
  reading: 'Reading the settings.',
  notPublished: 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.',
  saved: 'Saved as a draft. Click Publish all in the top bar.',
  problem: 'The change was not saved. ',
};

export function draftIdOf(id) {
  return 'drafts.' + id;
}

// The document to show out of the ones found: the draft first, then the published one. Nothing when neither exists.
export function pickDocument(documents, id) {
  const found = Array.isArray(documents) ? documents : [];
  const draft = found.filter(doc => doc && doc._id === draftIdOf(id))[0];
  const published = found.filter(doc => doc && doc._id === id)[0];
  return draft || published || null;
}

// Writes the fields to the draft. The draft is made from the published document first when there is none, so every
// other field is kept. It gives back a promise.
export async function saveDraftFields(client, id, fields, missingText, unset) {
  const published = await client.getDocument(id);
  const draft = await client.getDocument(draftIdOf(id));
  if (!draft && !published) throw new Error(missingText || words.notPublished);
  if (!draft) {
    const copy = Object.assign({}, published, { _id: draftIdOf(id) });
    ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
    await client.createIfNotExists(copy);
  }
  const patch = client.patch(draftIdOf(id)).set(fields);
  return (Array.isArray(unset) && unset.length > 0 ? patch.unset(unset) : patch).commit();
}

function withoutNames(doc, names) {
  const copy = Object.assign({}, doc);
  (names || []).forEach(name => delete copy[name]);
  return copy;
}

// The page's view of one document: read once, then every save is shown at once. save(fields) gives back a promise
// that never fails: a refusal becomes the line in state.text.
export function useDraftDocument(client, id, missingText) {
  const [state, setState] = useState({ read: false, doc: null, busy: false, text: '', failed: false });

  useEffect(() => {
    let stopped = false;

    Promise.resolve()
      .then(() => client.fetch('*[_id in [$draft, $published]]', { draft: draftIdOf(id), published: id }, { perspective: 'raw' }))
      .then(found => {
        if (!stopped) setState({ read: true, doc: pickDocument(found, id), busy: false, text: '', failed: false });
      })
      .catch(() => {
        if (!stopped) setState({ read: true, doc: null, busy: false, text: '', failed: false });
      });
    return () => {
      stopped = true;
    };
  }, [id]);

  function save(fields, unset) {
    setState(previous => Object.assign({}, previous, { doc: withoutNames(Object.assign({}, previous.doc, fields), unset), busy: true, text: '', failed: false }));

    return saveDraftFields(client, id, fields, missingText, unset)
      .then(() => setState(previous => Object.assign({}, previous, { busy: false, text: words.saved, failed: false })))
      .catch(error => setState(previous => Object.assign({}, previous, { busy: false, text: words.problem + (error && error.message ? error.message : ''), failed: true })));
  }

  return { state: state, save: save };
}
