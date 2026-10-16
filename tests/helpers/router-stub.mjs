// A tiny router for trying the control routes without the control service. A route file exports
// register(router, ctx); the stub keeps what it registers and answers call(). It has the same shape the
// routes use: router.get(path, handler) and router.post(path, handler), with :name in a path.
// call() gives the handler a fake request (headers, url, method, params, a body that can be read
// as a stream) and collects what the handler sends.

import { Readable } from 'node:stream';

export function makeRouter() {
  const routes = [];

  function add(method) {
    return (path, handler) => {
      const names = [];
      const source = path.replace(/:([a-z]+)/g, (all, name) => {
        names.push(name);
        return '([^/]+)';
      });
      routes.push({ method: method, path: path, names: names, pattern: new RegExp('^' + source + '$'), handler: handler });
    };
  }

  return {
    routes: routes,
    get: add('GET'),
    post: add('POST'),

    // options: { body (object or string), headers }. Gives { status, json, text, headers }.
    async call(method, url, options = {}) {
      const path = url.split('?')[0];
      const route = routes.find(item => item.method === method && item.pattern.test(path));
      if (!route) return { status: 404, json: null, text: '', headers: {} };

      const found = route.pattern.exec(path);
      const params = {};
      route.names.forEach((name, index) => { params[name] = decodeURIComponent(found[index + 1]); });

      const text = options.body === undefined ? '' : typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      const req = Readable.from(text === '' ? [] : [Buffer.from(text)]);
      req.method = method;
      req.url = '/control/api' + url;
      req.headers = Object.assign({}, options.headers);
      req.params = params;

      const out = { status: 0, headers: {}, text: '' };
      const done = new Promise(resolve => {
        const res = {
          writeHead(status, headers) { out.status = status; out.headers = headers || {}; },
          write(chunk) { out.text += chunk; return true; },
          end(chunk) { out.text += chunk === undefined ? '' : chunk; resolve(); },
        };
        Promise.resolve(route.handler(req, res)).catch(error => { out.status = 599; out.text = String(error && error.stack); resolve(); });
      });
      await done;
      let json = null;
      try { json = JSON.parse(out.text); } catch (error) { json = null; }
      return { status: out.status, json: json, text: out.text, headers: out.headers };
    },
  };
}
