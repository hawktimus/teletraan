// Loads one picture of the hidden transitions and says what happened, and finds out which picture kinds
// this browser can read. core/hidden-run.js uses it, and the result goes into the run log
// (core/hidden-log.js) so the control page can tell why a picture did not show.

export const loadTimeoutMs = 8000;

// One tiny picture of each kind, as data. A browser that can read it can read the files of that kind.
export const tinyPictures = {
  png: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  webp: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
};

// What the web server says about a picture that would not load, as 'http 404' or 'http 200 image/png', so the log can tell
// a missing file from a file the browser cannot read. Empty when the server cannot be asked.
async function askServer(address, timeoutMs) {
  if (address.startsWith('data:') || typeof fetch !== 'function') return '';
  try {
    const answer = await Promise.race([
      fetch(address, { method: 'HEAD', cache: 'no-store' }),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error('no answer')), timeoutMs)),
    ]);
    const kind = (answer.headers.get('content-type') || '').split(';')[0];
    return 'http ' + answer.status + (kind ? ' ' + kind : '');
  } catch (error) {
    return '';
  }
}

// Resolves with { ok, image, ms, width, height, why }. why is '' when it loaded. A picture that loads with no size
// counts as failed, and so does one that does not answer in timeoutMs.
export function loadPicture(address, timeoutMs = loadTimeoutMs) {
  return new Promise(resolve => {
    const image = new Image();
    const started = performance.now();
    let finished = false;

    async function finish(ok, why) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const ms = Math.round(performance.now() - started);
      const server = ok ? '' : await askServer(address, 2000);
      resolve({ ok: ok, image: image, ms: ms, width: image.naturalWidth || 0, height: image.naturalHeight || 0, why: server ? why + ', ' + server : why });
    }

    const timer = setTimeout(() => finish(false, 'no answer in ' + Math.round(timeoutMs / 1000) + 's'), timeoutMs);
    image.onload = () => (image.naturalWidth > 0 ? finish(true, '') : finish(false, 'loaded with no size'));
    image.onerror = event => finish(false, (event && event.type ? event.type : 'error') + ' ' + (image.naturalWidth || 0));
    image.src = address;
  });
}

// { png, webp } as true or false
export async function findImageTypes(timeoutMs = 3000) {
  const kinds = Object.keys(tinyPictures);
  const results = await Promise.all(kinds.map(kind => loadPicture(tinyPictures[kind], timeoutMs)));
  const types = {};
  kinds.forEach((kind, index) => { types[kind] = results[index].ok; });
  return types;
}
