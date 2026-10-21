// Makes a page that was opened with ?rowpreview= (core/row-preview.js) read only. shell.js imports this file first, so
// the guard is on before any other code asks for the network or the storage. A page without ?rowpreview= is not touched.
//
// The page is on the same address as the control page, so a call to /control/ would carry the PIN cookie. Nothing in the
// dashboard makes such a call except the report of the wall, which a preview never starts. The guard makes sure of it.

import { rowPreviewName } from './row-preview.js';

// A request the preview may make: a read, and not to the control service
export function allowRequest(url, method, base) {
  const verb = String(method || 'GET').toUpperCase();
  if (verb !== 'GET' && verb !== 'HEAD') return false;

  try {
    return !new URL(String(url), base).pathname.startsWith('/control/');
  } catch (error) {
    return false;
  }
}

// win is the window. Returns true when the guard was put on.
export function installGuard(win) {
  if (!new URLSearchParams(win.location.search).has(rowPreviewName)) return false;

  const realFetch = win.fetch.bind(win);
  win.fetch = (input, init) => {
    const url = input && typeof input === 'object' && 'url' in input ? input.url : input;
    const method = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
    if (!allowRequest(url, method, win.location.href)) return Promise.reject(new TypeError('A row preview only reads. This request was stopped.'));
    return realFetch(input, init);
  };

  // Nothing is saved in the browser by a preview: the saved copy of the content, the heartbeat and the notes of the effects
  if (win.Storage && win.Storage.prototype) {
    ['setItem', 'removeItem', 'clear'].forEach(name => { win.Storage.prototype[name] = function nothing() {}; });
  }
  return true;
}

if (typeof window !== 'undefined' && window.location) installGuard(window);
