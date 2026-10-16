// monday-sync.sh, frc-sync.sh and the Mac tool teletraan-mini read their other parts (monday-*.sh, frc-*.sh,
// teletraan-mini-*.sh) from the same folder. A test that looks for a line in "the script", or runs a copy of
// it, needs those parts too.

import fs from 'node:fs';
import path from 'node:path';

function partsOf(file) {
  const base = path.basename(file);
  const match = base.match(/^(monday|frc)-sync\.sh$/) || base.match(/^(teletraan-mini)$/);
  if (!match) return [];
  const folder = path.dirname(file);
  return fs.readdirSync(folder)
    .filter(name => name.startsWith(match[1] + '-') && name !== base && name.endsWith('.sh'))
    .sort()
    .map(name => path.join(folder, name));
}

export function textOf(file) {
  return [file].concat(partsOf(file)).map(part => fs.readFileSync(part, 'utf8')).join('\n');
}

export function copyParts(file, toFolder) {
  partsOf(file).forEach(part => fs.copyFileSync(part, path.join(toFolder, path.basename(part))));
}

// Copies the script and its parts, and applies each edit [from, to] to the file that holds the text
export function copyWithEdits(file, toFolder, edits) {
  const files = [file].concat(partsOf(file));
  const texts = files.map(part => fs.readFileSync(part, 'utf8'));
  (edits || []).forEach(edit => {
    const at = texts.findIndex(text => text.includes(edit[0]));
    if (at === -1) throw new Error('the script has no ' + edit[0]);
    texts[at] = texts[at].replace(edit[0], edit[1]);
  });
  files.forEach((part, index) => {
    fs.writeFileSync(path.join(toFolder, path.basename(part)), texts[index], { mode: fs.statSync(part).mode });
  });
}
