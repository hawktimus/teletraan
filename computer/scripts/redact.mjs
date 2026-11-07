// Takes keys, calendar links and the paths of addresses out of text on its way to a person. Reads standard input and
// writes standard output, so a shell script can pipe anything through it:
//
//   something-that-prints-a-lot | node computer/scripts/redact.mjs
//
// The rules are control/lib/redact.js, the same ones the log download uses, so there is one list of what counts as a
// secret and not two that can drift apart. This file is only the way a shell script reaches them.
//
// The diagnostic report (computer/scripts/diag.sh) sends every section through here before it is written, which is why
// a report can be downloaded or pasted into a message without reading it first.

import { redactLine } from '../../control/lib/redact.js';

let rest = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  const text = rest + chunk;
  const lines = text.split('\n');
  // The last piece may be half a line, so it waits for the next chunk
  rest = lines.pop();
  if (lines.length > 0) process.stdout.write(lines.map(redactLine).join('\n') + '\n');
});
process.stdin.on('end', () => {
  if (rest !== '') process.stdout.write(redactLine(rest) + '\n');
});
