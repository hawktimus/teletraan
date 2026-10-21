// What every route of the control service needs: reading a JSON body, sending JSON, and putting a
// handler on the router with the PIN check and one place for errors. The router is
// router.get(path, handler) and router.post(path, handler); a handler is (request, response).
// Paths are written the way the page asks for them, after /control/api.

const largestBody = 64 * 1024;

export class Refusal extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

// The body of a request as an object. Anything that is not a JSON object is refused.
export async function readJson(req, limit = largestBody) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Refusal(413, 'That request is too big.');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return {};

  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Refusal(400, 'The request was not JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Refusal(400, 'The request should be a JSON object.');
  return value;
}

// The whole body as bytes, for the one upload. A body over the limit is refused as soon as it is seen to be over, and the
// rest is not read.
export async function readBytes(req, limit) {
  const declared = Number(req.headers && req.headers['content-length']);
  if (declared > limit) throw new Refusal(413, 'That file is too big.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Refusal(413, 'That file is too big.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// The text of a request body, for the one route that takes plain text
export async function readText(req, limit = largestBody) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Refusal(413, 'That request is too big.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// The part of the path that a pattern such as /helper/:word names
export function paramOf(req, pattern, name) {
  if (req.params && req.params[name] !== undefined) return String(req.params[name]);

  const path = String(req.url || '').split('?')[0].replace(/^\/control\/api/, '').replace(/\/+$/, '');
  const names = [];
  const source = pattern.replace(/:([a-z]+)/g, (all, found) => {
    names.push(found);
    return '([^/]+)';
  });
  const match = new RegExp('^' + source + '$').exec(path);
  return match && names.includes(name) ? decodeURIComponent(match[names.indexOf(name) + 1]) : '';
}

// Puts a handler on the router. options.open skips the PIN check, for the one call that the
// dashboard makes from the Teletraan computer itself.
export function mount(router, ctx, method, path, handler, options = {}) {
  router[method.toLowerCase()](path, async (req, res) => {
    try {
      if (!options.open && typeof ctx.pinCheck === 'function') {
        const allowed = await ctx.pinCheck(req);
        if (!allowed) return send(res, 401, { error: 'Enter the PIN first.' });
      }
      await handler(req, res, ctx);
    } catch (error) {
      if (error instanceof Refusal) return send(res, error.status, { error: error.message });
      if (typeof ctx.log === 'function') ctx.log('error in ' + method + ' ' + path + ': ' + String(error && error.message).slice(0, 200));
      send(res, 500, { error: 'Something went wrong on the Teletraan computer. Settings, Log has the reason.' });
    }
  });
}
