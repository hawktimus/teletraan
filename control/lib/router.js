// A small router: a method, a path with :names in it, and a handler. Paths are written after /control/api. Handlers
// get (req, res) and req.params holds the :names.
// The helpers at the bottom send JSON and read a body with a size limit.

export function createRouter() {
  const routes = [];

  function add(method, pattern, handler) {
    const names = [];
    const source = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:([A-Za-z]+)/g, (all, name) => {
      names.push(name);
      return '([^/]+)';
    });
    routes.push({ method: method, pattern: pattern, expression: new RegExp('^' + source + '$'), names: names, handler: handler });
  }

  // The route for a method and a path, or null. Params are decoded.
  function match(method, pathname) {
    for (const route of routes) {
      if (route.method !== method) continue;
      const found = route.expression.exec(pathname);
      if (!found) continue;
      const params = {};
      route.names.forEach((name, index) => {
        try {
          params[name] = decodeURIComponent(found[index + 1]);
        } catch (error) {
          params[name] = found[index + 1];
        }
      });
      return { handler: route.handler, params: params, pattern: route.pattern };
    }
    return null;
  }

  // The methods some route accepts for this path, for a 405 answer
  function methodsFor(pathname) {
    return routes.filter(route => route.expression.test(pathname)).map(route => route.method);
  }

  return {
    add: add,
    match: match,
    methodsFor: methodsFor,
    get: (pattern, handler) => add('GET', pattern, handler),
    post: (pattern, handler) => add('POST', pattern, handler),
    put: (pattern, handler) => add('PUT', pattern, handler),
    delete: (pattern, handler) => add('DELETE', pattern, handler),
    list: () => routes.map(route => route.method + ' ' + route.pattern),
  };
}

export function sendJson(res, status, body, headers) {
  const text = JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(text);
}

// The whole body as a Buffer. Stops with an error that has .status 413 when the body is over the limit.
export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error('The upload is larger than ' + Math.round(limit / 1048576) + ' MB.');
        error.status = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req, limit = 65536) {
  const body = await readBody(req, limit);
  if (body.length === 0) return {};
  try {
    return JSON.parse(body.toString('utf8'));
  } catch (error) {
    const bad = new Error('The request was not JSON.');
    bad.status = 400;
    throw bad;
  }
}
