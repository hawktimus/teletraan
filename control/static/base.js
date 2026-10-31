// Where the service's calls are, worked out from where this file was loaded. The page never writes a host name or an
// address, so it works at http://teletraan.local, at an address and over HTTPS from any other name.

export const apiBase = new URL('api/', import.meta.url).pathname;

export function apiPath(path) {
  return apiBase + String(path || '').replace(/^\//, '');
}
