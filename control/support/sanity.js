// Reading and writing Sanity for the control routes. Reads use the public dataset and send no key.
// Writes use SANITY_WRITE_TOKEN from local.env, which is read at the moment of the write and never
// kept, printed or logged.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { envPath, envValue } from './env-file.js';
import { Refusal } from './http.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const timeout = 15000;

export function repoRoot(ctx) {
  return ctx.root || path.resolve(here, '..', '..');
}

// projectId, dataset and apiVersion are kept in dashboard/config.js and nowhere else
function configFrom(text) {
  const read = name => {
    const match = new RegExp("^\\s*" + name + ":\\s*'([^']*)'", 'm').exec(text);
    return match ? match[1] : '';
  };
  return { projectId: read('projectId'), dataset: read('dataset'), apiVersion: read('apiVersion') };
}

export function readConfig(ctx) {
  const config = configFrom(fs.readFileSync(path.join(repoRoot(ctx), 'dashboard', 'config.js'), 'utf8'));
  if (!/^[a-z0-9]+$/.test(config.projectId) || !/^[A-Za-z0-9_-]+$/.test(config.dataset) || !/^\d{4}-\d{2}-\d{2}$/.test(config.apiVersion)) {
    throw new Refusal(500, 'The Sanity project could not be read from dashboard/config.js. Check that projectId, dataset and apiVersion are in that file.');
  }
  return config;
}

export function makeSanity(ctx) {
  const doFetch = ctx.fetch || globalThis.fetch;
  const config = readConfig(ctx);
  const host = 'https://' + config.projectId + '.api.sanity.io/v' + config.apiVersion;

  return {
    config: config,

    // The published result of a GROQ query, or throws
    async query(groq) {
      const url = host + '/data/query/' + config.dataset + '?perspective=published&query=' + encodeURIComponent(groq);
      const response = await doFetch(url, { signal: AbortSignal.timeout(timeout) });
      if (!response.ok) throw new Error('Sanity answered ' + response.status);
      const body = await response.json();
      return body.result;
    },

    // The same question with the drafts in the answer. A draft is not public, so this needs the write key; without
    // one it gives the published documents only and the caller is told so by hasToken().
    async queryRaw(groq) {
      const token = envValue(envPath(ctx), 'SANITY_WRITE_TOKEN');
      if (token === '') return this.query(groq);
      const url = host + '/data/query/' + config.dataset + '?perspective=raw&query=' + encodeURIComponent(groq);
      let response;
      try {
        response = await doFetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(timeout) });
      } catch (error) {
        throw new Error('Sanity could not be reached');
      }
      if (!response.ok) throw new Error('Sanity answered ' + response.status);
      return (await response.json()).result;
    },

    // A long question (the whole content query is over 11 KB) goes in the body, as Sanity asks
    async queryLong(groq) {
      const response = await doFetch(host + '/data/query/' + config.dataset + '?perspective=published', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: groq }),
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) throw new Error('Sanity answered ' + response.status);
      return (await response.json()).result;
    },

    hasToken() {
      return envValue(envPath(ctx), 'SANITY_WRITE_TOKEN') !== '';
    },

    // Sends one picture to the asset store of the dataset and gives back the id of the asset. The file name is not sent: the dataset
    // is public, and a name such as "Jane Smith at the pit.jpg" would be readable by anyone.
    async uploadImage(bytes, contentType) {
      const token = envValue(envPath(ctx), 'SANITY_WRITE_TOKEN');
      if (token === '') throw new Refusal(503, 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.');
      const name = 'photo.' + (contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg');
      let response;
      try {
        response = await doFetch(host + '/assets/images/' + config.dataset + '?filename=' + name, {
          method: 'POST',
          headers: { 'Content-Type': contentType, Authorization: 'Bearer ' + token },
          body: bytes,
          signal: AbortSignal.timeout(120000),
        });
      } catch (error) {
        throw new Refusal(502, 'The Teletraan computer could not reach Sanity. Check its internet connection, then add the photo again.');
      }
      if (response.status === 401 || response.status === 403) throw new Refusal(502, 'Sanity refused the picture. Check SANITY_WRITE_TOKEN in Settings, Keys.');
      if (!response.ok) throw new Refusal(502, 'Sanity could not take the picture (' + response.status + '). Try a smaller one.');
      let id = '';
      try {
        id = (await response.json()).document._id;
      } catch (error) {
        id = '';
      }
      if (!/^image-[A-Za-z0-9]+-\d+x\d+-[a-z]+$/.test(String(id))) throw new Refusal(502, 'Sanity took the picture but did not say where it is. Add it again.');
      return id;
    },

    // Applies mutations. Refused with a plain message when there is no write token.
    async mutate(mutations) {
      const token = envValue(envPath(ctx), 'SANITY_WRITE_TOKEN');
      if (token === '') throw new Refusal(503, 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.');

      let response;
      try {
        response = await doFetch(host + '/data/mutate/' + config.dataset, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ mutations: mutations }),
          signal: AbortSignal.timeout(timeout),
        });
      } catch (error) {
        throw new Refusal(502, 'The Teletraan computer could not reach Sanity. Check its internet connection, then press the button again.');
      }
      if (response.status === 401 || response.status === 403) throw new Refusal(502, 'Sanity refused the write. Check SANITY_WRITE_TOKEN in Settings, Keys.');
      if (response.status === 409) throw new Refusal(409, 'The document changed in Sanity while it was being saved.');
      if (!response.ok) {
        // Sanity says why in the body of the answer; without it a 400 cannot be told apart from another
        let reason = '';
        try {
          const failure = await response.json();
          reason = String((failure.error && (failure.error.description || failure.error.message)) || failure.message || '').slice(0, 300);
        } catch (error) {
          reason = '';
        }
        throw new Refusal(502, 'Sanity could not take the change (' + response.status + ').' + (reason ? ' It said: ' + reason : ''));
      }
      const body = await response.json();
      // Sanity answers 200 with a result for each mutation. An empty list means nothing was written.
      if (body && Array.isArray(body.results) && body.results.length === 0) throw new Refusal(502, 'Sanity took the request but changed no document. Open Dashboard Settings in the Studio and publish it once.');
      return body;
    },
  };
}
