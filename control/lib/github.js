// Reads the public Teletraan repository on GitHub. No login and no key: the repository is public, and no
// Authorization header is ever sent. ctx.github can replace any constant below, and ctx.github.fetch replaces fetch.

export const repo = 'Hawktimus/teletraan';
export const branch = 'main';
export const apiBase = 'https://api.github.com';
export const codeloadBase = 'https://codeload.github.com';
export const downloadLimit = 100 * 1024 * 1024;
export const downloadSeconds = 120;
export const apiSeconds = 20;

function stop(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function settings(ctx) {
  const given = (ctx && ctx.github) || {};
  return {
    fetch: given.fetch || fetch,
    repo: given.repo || repo,
    branch: given.branch || branch,
    apiBase: given.apiBase || apiBase,
    codeloadBase: given.codeloadBase || codeloadBase,
    maxBytes: given.maxBytes || downloadLimit,
    downloadMs: given.downloadMs || downloadSeconds * 1000,
    apiMs: given.apiMs || apiSeconds * 1000,
  };
}

// One request with a time limit. Only an Accept header goes out.
async function get(use, url, accept, milliseconds) {
  const timer = new AbortController();
  const clock = setTimeout(() => timer.abort(), milliseconds);
  try {
    const response = await use.fetch(url, { headers: { Accept: accept, 'User-Agent': 'teletraan-control' }, signal: timer.signal });
    if (response.status === 403 || response.status === 429) throw stop('GitHub is limiting requests. Try again in a few minutes.', 429);
    if (!response.ok) throw stop('GitHub answered with ' + response.status + '. Try again in a few minutes.', 502);
    return { response: response, clock: clock };
  } catch (error) {
    clearTimeout(clock);
    if (error.status) throw error;
    if (error.name === 'AbortError') throw stop('GitHub took too long to answer. Try again in a few minutes.', 504);
    throw stop('The Teletraan computer could not reach GitHub. Check that it is online.', 502);
  }
}

// The newest commit of the branch: { commit, short, message, date }
export async function latest(ctx) {
  const use = settings(ctx);
  const { response, clock } = await get(use, use.apiBase + '/repos/' + use.repo + '/commits/' + use.branch, 'application/vnd.github+json', use.apiMs);
  try {
    const body = await response.json();
    const commit = String(body.sha || '').toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(commit)) throw stop('GitHub sent an answer this page does not understand.', 502);
    const info = body.commit || {};
    const message = String(info.message || '').split('\n')[0].replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 90);
    const date = String((info.committer && info.committer.date) || (info.author && info.author.date) || '');
    return { commit: commit, short: commit.slice(0, 7), message: message, date: date };
  } finally {
    clearTimeout(clock);
  }
}

// The zip of one commit as a Buffer, refused above the size cap. The sha in the address makes the commit exact.
export async function download(ctx, sha) {
  const use = settings(ctx);
  if (!/^[0-9a-f]{40}$/.test(String(sha))) throw stop('That is not a full commit hash.', 400);
  const tooBig = () => stop('The download is larger than ' + Math.round(use.maxBytes / 1048576) + ' MB.', 413);
  const { response, clock } = await get(use, use.codeloadBase + '/' + use.repo + '/zip/' + sha, 'application/zip', use.downloadMs);
  try {
    const declared = Number(response.headers && response.headers.get ? response.headers.get('content-length') : 0);
    if (declared > use.maxBytes) throw tooBig();
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const parts = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > use.maxBytes) {
          reader.cancel().catch(() => {});
          throw tooBig();
        }
        parts.push(Buffer.from(value));
      }
      return Buffer.concat(parts);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > use.maxBytes) throw tooBig();
    return bytes;
  } catch (error) {
    if (error.status) throw error;
    if (error.name === 'AbortError') throw stop('The download from GitHub took too long. Try again in a few minutes.', 504);
    throw stop('The download from GitHub stopped. Try again.', 502);
  } finally {
    clearTimeout(clock);
  }
}
