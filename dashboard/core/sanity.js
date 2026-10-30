// Talks to the content snapshot of the sync service: the query, the address, and turning what comes back
// into the content shape in data/sample/content.json. The sample is cleaned the same way.

export { contentQuery, queryUrl, contentFile, imageIndexFile, fetchLocalText, resultOf, fetchResult } from './sanity-query.js';
export { firstNameOf } from './sanity-tasks.js';
export { normalizeContent, normalizeSample } from './sanity-content.js';
