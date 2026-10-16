// How the files of the control page are sent. A page is never kept; a script or stylesheet is kept but asked about
// before each use (ETag), so a reloaded page always gets a matching pair; a font is kept for a week. The same
// words are in computer/nginx/nginx.conf, so the two headers that reach the browser never disagree.

import crypto from 'node:crypto';
import path from 'node:path';

export const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function cacheControl(extension) {
  if (extension === '.js' || extension === '.mjs' || extension === '.css') return 'no-cache';
  if (extension === '.woff2' || extension === '.png' || extension === '.svg') return 'max-age=604800';
  return 'no-store';
}

export function etagOf(bytes) {
  return '"' + crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 20) + '"';
}

// The headers for a file, and whether the browser's copy (If-None-Match) is still the one to use
export function staticHeaders(file, bytes) {
  const extension = path.extname(file);
  const headers = {
    'Content-Type': types[extension] || 'application/octet-stream',
    'Cache-Control': cacheControl(extension),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'",
  };
  if (cacheControl(extension) !== 'no-store') headers.ETag = etagOf(bytes);
  return headers;
}

export function isFresh(requestHeaders, etag) {
  const sent = String((requestHeaders || {})['if-none-match'] || '');
  return Boolean(etag) && sent.split(',').some(value => value.trim().replace(/^W\//, '') === etag);
}
