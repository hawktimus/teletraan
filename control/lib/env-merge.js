// Reads and changes the text of local.env without losing its comments or the order of its lines.
// A value is written between single quotes, the way the scripts on the Mini read it. This file
// never logs a value.

const namePattern = /^[A-Z][A-Z0-9_]{0,63}$/;

// { NAME: 'value' } for every NAME=value line. A value that still starts with [ is a placeholder and is left out.
export function parseEnv(text) {
  const values = {};
  for (const line of String(text).split('\n')) {
    const found = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!found) continue;
    let value = found[2].trim();
    if (value.length >= 2 && (value[0] === "'" || value[0] === '"') && value[value.length - 1] === value[0]) value = value.slice(1, -1);
    if (value.startsWith('[')) continue;
    values[found[1]] = value;
  }
  return values;
}

// The reason a name and value cannot go in the file, or '' when they can. The reason never holds the value.
export function envProblem(name, value) {
  if (!namePattern.test(name)) return 'A key name uses capital letters, digits and underscores.';
  if (typeof value !== 'string') return 'A value is text.';
  if (value.length > 2000) return 'A value is at most 2000 characters.';
  if (/[\u0000-\u001f\u007f']/.test(value)) return 'A value has no quote mark or line break in it.';
  return '';
}

// The text with the changes made. A value of null removes the line. A name not in the file is added at the end.
// Throws on a name or value that envProblem refuses.
export function mergeEnv(text, changes) {
  const names = Object.keys(changes);
  for (const name of names) {
    if (changes[name] !== null) {
      const reason = envProblem(name, changes[name]);
      if (reason) throw new Error(reason);
    } else if (!namePattern.test(name)) {
      throw new Error('A key name uses capital letters, digits and underscores.');
    }
  }

  const lines = String(text).split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const done = {};
  const out = [];
  for (const line of lines) {
    const found = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line.trim());
    if (found && Object.prototype.hasOwnProperty.call(changes, found[1])) {
      done[found[1]] = true;
      if (changes[found[1]] !== null) out.push(found[1] + "='" + changes[found[1]] + "'");
    } else {
      out.push(line);
    }
  }
  for (const name of names) {
    if (!done[name] && changes[name] !== null) out.push(name + "='" + changes[name] + "'");
  }
  return out.join('\n') + '\n';
}
