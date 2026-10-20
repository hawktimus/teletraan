// Fails when a key, a token or a private calendar address is in a file of the repository.
//
// The dataset is public and so is the repository. Keys live only in local.env on the Teletraan computer and in
// ~/.teletraan/secrets.env on the owner's Mac. This test looks at every file git tracks (and every new file that is
// not ignored) for:
//   - text that has the shape of a key: a Sanity token, a Monday token, a GitHub token, a private key block
//   - a name of a key (SANITY_WRITE_TOKEN, MONDAY_API_TOKEN, TBA_AUTH_KEY, CALENDAR_<ID>_URL and the others) set to a real looking value
//   - an address with a secret in it, such as ...?token=<long string>
//   - the real values of local.env and secrets.env, when those files are on this computer. The values are read
//     in memory, compared and forgotten. Only the NAME of a key is ever written out, never its value.
//
//   node tests/no-secrets.test.mjs
//
// HOUSE_RULES_ENV_FILES=none skips the comparison with the real files. A list of paths (separated by :) replaces them.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo, lineOf, trackedFiles, makeChecker } from './helpers/house-rules.mjs';

const { check, finish } = makeChecker('tests/no-secrets.test.mjs');
const files = trackedFiles().filter(file => !file.startsWith('control/static/vendor/'));

// The text of a file, or null for a binary file or a file that is gone
function textOf(file) {
  const full = path.join(repo, file);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  const buffer = fs.readFileSync(full);
  return buffer.includes(0) ? null : buffer.toString('utf8');
}

const keyNames = '(?:SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|CONTROL_PIN|GOOGLE_API_KEY|MATCH13_API_KEY|CALENDAR_[A-Z0-9_]+_URL)';

// A value that is plainly not a key: empty, a placeholder in brackets, something the shell fills in, or a made up word
function isPlaceholder(value) {
  const bare = value.replace(/^['"]|['"]$/g, '').trim();
  return bare === '' || /^[[<{$%]/.test(bare) || /^(\.\.\.|x+|changeme|example|none|todo)$/i.test(bare) || /example|placeholder|paste|replace|your[-_ ]|fake|secret-|dummy|sample/i.test(bare);
}

// Shapes that only a real key has. They are long, so ordinary words never match. A test may use a made up web token
// or an address with a made up token to try a script, so those two shapes are not looked for in tests/.
const shapes = [
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, what: 'a private key block' },
  { pattern: /\bsk[A-Za-z0-9]{45,}\b/g, what: 'a string shaped like a Sanity token' },
  { pattern: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g, what: 'a string shaped like a Monday or JSON web token', madeUpInTests: true },
  { pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, what: 'a string shaped like a GitHub token' },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, what: 'a string shaped like an Amazon key' },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, what: 'a string shaped like a Google key' },
  { pattern: /[?&](?:token|key|secret|auth|api_key|apikey)=[A-Za-z0-9_%-]{20,}/gi, what: 'an address with a long token in it', madeUpInTests: true },
];

check({
  name: 'no key, token or private address is written in a file of the repository',
  why: 'The repository and the dataset are public. A key that is committed is a key everyone can read, even after it is deleted (the history keeps it).',
  instead: 'Delete the value from the file. Put real keys only in local.env on the Teletraan computer or in ~/.teletraan/secrets.env. If a real key was committed, tell a mentor now so they replace the key. In a doc or an example write a placeholder in brackets, such as [paste it here].',
}, () => {
  const problems = [];
  const assignment = new RegExp('\\b(' + keyNames + ')\\b\\s*=\\s*(\'[^\'\\n]*\'|"[^"\\n]*"|[^\\s,;)}\\]]*)', 'g');

  for (const file of files) {
    const text = textOf(file);
    if (text === null) continue;

    for (const shape of shapes.filter(item => !(item.madeUpInTests && file.startsWith('tests/')))) {
      for (const match of text.matchAll(shape.pattern)) {
        if (isPlaceholder(match[0])) continue;
        problems.push({ file: file, line: lineOf(text, match.index), what: 'has ' + shape.what + ' (' + match[0].slice(0, 6) + '..., ' + match[0].length + ' characters)' });
      }
    }

    // A test may set a key name to a made up value to try a script; the shapes above still apply to tests
    if (file.startsWith('tests/')) continue;
    for (const match of text.matchAll(assignment)) {
      const value = match[2].replace(/^['"]|['"]$/g, '');
      if (isPlaceholder(match[2]) || value.length < 12) continue;
      problems.push({ file: file, line: lineOf(text, match.index), what: match[1] + ' is set to a value of ' + value.length + ' characters' });
    }
  }
  return problems;
});

// The values of the real files on this computer, by key name. Never written to the screen.
function realValues() {
  const given = process.env.HOUSE_RULES_ENV_FILES;
  if (given === 'none') return [];

  const paths = given ? given.split(':') : [path.join(repo, 'computer/local.env'), path.join(os.homedir(), '.teletraan/secrets.env')];
  const found = [];
  for (const envFile of paths) {
    if (!fs.existsSync(envFile)) continue;
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
      if (!match) continue;
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      // short values (a port, a path, a word) are in the repository for good reasons
      const secretName = /(URL|TOKEN|KEY|SECRET)$/.test(match[1]);
      if (value.length >= 16 && !isPlaceholder(value) && (secretName || !/^(\/|https?:\/\/)/.test(value))) found.push({ name: match[1], value: value });
    }
  }
  return found;
}

check({
  name: 'no value from local.env or secrets.env is copied into a file of the repository',
  why: 'Those files hold the real keys and the private calendar addresses. If one of their values is in the repository, it is public.',
  instead: 'Delete the value from the file and write its name only, such as SANITY_WRITE_TOKEN. Tell a mentor so the key is replaced, because it has been written somewhere public.',
}, () => {
  const problems = [];
  const values = realValues();

  for (const file of files) {
    const text = textOf(file);
    if (text === null) continue;
    for (const item of values) {
      const at = text.indexOf(item.value);
      if (at !== -1) problems.push({ file: file, line: lineOf(text, at), what: 'holds the value of ' + item.name + ' from your key file (the value is not written here)' });
    }
  }
  return problems;
});

await finish();
