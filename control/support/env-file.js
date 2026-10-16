// Reads local.env, which holds keys. Values are read only for the one name that is asked for, and
// nothing here prints or logs a value. The file is mounted read only into the service.

import fs from 'node:fs';

export function envPath(ctx) {
  return ctx.envFile || process.env.TELETRAAN_ENV_FILE || '/opt/teletraan/mini/local.env';
}

function unquote(value) {
  return value.replace(/^['"]/, '').replace(/['"]$/, '');
}

export function parseEnv(text) {
  const found = new Map();
  String(text).split('\n').forEach(line => {
    const at = line.indexOf('=');
    if (at < 1 || line.startsWith('#')) return;
    found.set(line.slice(0, at), unquote(line.slice(at + 1).trim()));
  });
  return found;
}

export function readEnv(file) {
  try {
    return parseEnv(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return new Map();
  }
}

// The value of a name, or '' when it is not set or is still the placeholder that starts with [
export function envValue(file, name) {
  const value = readEnv(file).get(name) || '';
  return value.startsWith('[') ? '' : value;
}
