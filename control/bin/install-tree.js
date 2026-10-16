// Installs a folder as the next release, with the same steps as the Update tab. mini/install.sh runs it for the
// first install and for the Mac tool, and the post-receive hook of the git path runs it for a push.
//
//   node control/bin/install-tree.js <folder> [--note "text"] [--commit abc1234] [--from git] [--no-restart] [--no-studio]
//
// The root comes from CONTROL_ROOT (default /opt/teletraan). The helper is not asked for anything with --no-restart.

import fs from 'node:fs';
import path from 'node:path';
import { readConfig, createService } from '../server.js';
import { installRelease } from '../lib/install.js';

const args = process.argv.slice(2);
const options = { from: 'upload', note: '', commit: '', restart: true, studio: true };
let folder = '';
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--note') options.note = args[++i] || '';
  else if (arg === '--commit') options.commit = args[++i] || '';
  else if (arg === '--from') options.from = args[++i] === 'git' ? 'git' : 'upload';
  else if (arg === '--no-restart') options.restart = false;
  else if (arg === '--no-studio') options.studio = false;
  else if (!folder) folder = arg;
}

if (!folder || !fs.existsSync(path.join(folder, 'dashboard'))) {
  console.error('Give the folder of the repository to install.');
  process.exit(2);
}

const { ctx } = await createService(readConfig());
try {
  await installRelease(ctx, Object.assign({}, options, {
    dir: path.resolve(folder),
    emit: event => console.log((event.state === 'fail' ? 'FAILED  ' : '') + event.message),
  }));
} catch (error) {
  console.error('The install stopped: ' + error.message.split('\n')[0]);
  process.exit(1);
}
process.exit(0);
