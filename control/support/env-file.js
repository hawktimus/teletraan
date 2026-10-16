// Reads local.env, which holds keys. Values are read only for the one name that is asked for, and
// nothing here prints or logs a value. The file is mounted read only into the service.

import fs from 'node:fs';
import { parseEnv } from '../lib/env-merge.js';

export function envPath(ctx) {
  return ctx.envFile || process.env.TELETRAAN_ENV_FILE || '/opt/teletraan/computer/local.env';
}

// { NAME: 'value' } of the file, or nothing when it cannot be read. A placeholder that starts with [ is left out.
export function readEnv(file) {
  try {
    return parseEnv(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return {};
  }
}

// The value of a name, or '' when it is not set
export function envValue(file, name) {
  return readEnv(file)[name] || '';
}
