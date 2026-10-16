// Asks Sanity whether the origin of the control page may read the dataset from a browser. The Studio on the Mini
// needs it: the owner adds the address under CORS origins at sanity.io/manage once. The answer is kept for a
// few minutes.

const keepFor = 5 * 60 * 1000;

export function createCorsCheck(options) {
  const fetchFn = options.fetch || globalThis.fetch;
  const now = options.now || Date.now;
  let last = null;

  async function check(origin) {
    if (last && last.origin === origin && now() - last.at < keepFor) return last.result;
    let result;
    try {
      const url = 'https://' + options.projectId + '.api.sanity.io/v' + options.apiVersion + '/data/query/' + options.dataset + '?query=' + encodeURIComponent('count(*[_type == "status"])');
      const response = await fetchFn(url, { headers: { Origin: origin }, signal: AbortSignal.timeout(8000) });
      const allowed = response.headers.get('access-control-allow-origin');
      const credentials = response.headers.get('access-control-allow-credentials');
      if (allowed === origin || allowed === '*') {
        result = { ok: true, origin: origin, credentials: credentials === 'true', message: 'The origin is allowed.' };
      } else {
        result = { ok: false, origin: origin, missing: true, message: 'CORS origin missing', link: 'https://www.sanity.io/manage/project/' + options.projectId + '/api#cors-origins' };
      }
    } catch (error) {
      result = { ok: false, origin: origin, unreachable: true, message: 'Sanity could not be reached to check the origin.' };
    }
    last = { origin: origin, at: now(), result: result };
    return result;
  }

  return { check: check };
}
