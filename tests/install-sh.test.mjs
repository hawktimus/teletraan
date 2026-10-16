// computer/install.sh: it refuses a tree that still has deploy/, moves an old /opt/teletraan into releases/1 with its
// local.env at the root, installs the helper socket, the service and the sudoers file with the login user filled
// in, runs the release install in the Node image, and starts the containers. docker, systemctl, visudo, chown and
// sudo are fakes in a temporary folder; the root, the unit folder, the sudoers folder and the git folder are
// temporary too, so nothing on this computer changes.
//
//   node tests/install-sh.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-install-'));
const account = os.userInfo().username;
let count = 0;

function put(file, text, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, mode ? { mode: mode } : undefined);
}

// A staging tree: the files of this repository the installer reads
function staging(base, options = {}) {
  const tree = path.join(base, 'staging');
  for (const name of ['computer/install.sh', 'computer/local.example.env', 'computer/systemd/teletraan-control.socket', 'computer/systemd/teletraan-control@.service', 'computer/systemd/teletraan-kiosk.service', 'computer/systemd/teletraan-pull.timer', 'computer/sudoers/teletraan-control', 'computer/git/post-receive']) {
    put(path.join(tree, name), fs.readFileSync(path.join(repo, name)));
  }
  put(path.join(tree, 'dashboard/index.html'), '<html></html>');
  put(path.join(tree, 'computer/scripts/kiosk.sh'), '#!/bin/sh\n');
  put(path.join(tree, 'control/server.js'), '//\n');
  if (options.old) put(path.join(tree, 'deploy/scripts/pull.sh'), '#!/bin/sh\n');
  return tree;
}

function setup(options = {}) {
  const base = path.join(work, 'case' + count++);
  const bin = path.join(base, 'bin');
  const log = path.join(base, 'calls.log');
  fs.mkdirSync(bin, { recursive: true });
  const logger = name => `#!/bin/sh\necho "${name} $*" >> "${log}"\n`;
  put(path.join(bin, 'docker'), logger('docker') + (options.noImage ? '[ "$1 $2" = "image inspect" ] && exit 1\n' : '') + (options.pullFails ? '[ "$1" = pull ] && exit 1\n' : '') + '# the release install, as far as the script can tell: a new release that current points at\n[ "$1" = run ] && { mkdir -p "$TELETRAAN_ROOT/releases/9/computer" && ln -sfn releases/9 "$TELETRAAN_ROOT/current"; }\nexit 0\n', 0o755);
  put(path.join(bin, 'systemctl'), logger('systemctl') + 'exit 0\n', 0o755);
  put(path.join(bin, 'visudo'), logger('visudo') + (options.badSudoers ? 'exit 1\n' : 'exit 0\n'), 0o755);
  put(path.join(bin, 'chown'), logger('chown') + 'exit 0\n', 0o755);
  put(path.join(bin, 'sudo'), logger('sudo') + 'shift 2\nexec "$@"\n', 0o755);
  put(path.join(bin, 'id'), '#!/bin/sh\n[ "$1" = -u ] && [ -z "${2:-}" ] && { echo 0; exit 0; }\nexec /usr/bin/id "$@"\n', 0o755);
  const root = path.join(base, 'opt-teletraan');
  const tree = staging(base, options);
  const places = { root: root, systemd: path.join(base, 'systemd'), sudoers: path.join(base, 'sudoers'), git: path.join(base, 'teletraan.git') };
  return {
    base: base, root: root, tree: tree, places: places,
    run(args = ['--yes'], input = '') {
      const result = spawnSync('bash', [path.join(tree, 'computer/install.sh'), ...args], {
        input: input, encoding: 'utf8',
        env: { PATH: bin + ':/usr/bin:/bin:/usr/local/bin', TELETRAAN_ROOT: root, TELETRAAN_SYSTEMD: places.systemd, TELETRAAN_SUDOERS: places.sudoers, TELETRAAN_GIT: places.git, TELETRAAN_ACCOUNT: account, HOME: base },
      });
      return { status: result.status, text: result.stdout, errors: result.stderr, calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '' };
    },
  };
}

// An /opt/teletraan from before: a tree with deploy/ or computer/, and its local.env
function oldTree(root, folder) {
  put(path.join(root, 'dashboard/index.html'), '<html>old</html>');
  put(path.join(root, folder + '/scripts/kiosk.sh'), '#!/bin/sh\n');
  put(path.join(root, folder + '/local.env'), "SANITY_WRITE_TOKEN='abc'\n", 0o600);
  put(path.join(root, 'README.md'), 'old');
}

test('a tree that still has deploy/ is refused with the plain sentence and nothing is changed', () => {
  const s = setup({ old: true });
  const result = s.run();
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('This copy is older than round 6; update it.'), result.errors);
  assert.ok(!fs.existsSync(s.root));
  assert.equal(result.calls, '');
});

test('a missing image is pulled as root and the line says it is a download; a failed pull says what to check', () => {
  const noImage = setup({ noImage: true });
  const result = noImage.run();
  assert.equal(result.status, 0, result.errors + result.text);
  assert.ok(result.text.includes('The image node:22-alpine is not on this computer') && result.text.includes('a download'), result.text);
  assert.ok(result.calls.includes('docker pull node:22-alpine') && result.calls.includes('docker pull nginx:1.28-alpine'), result.calls);
  assert.ok(!/^sudo /m.test(result.calls), 'docker is called as root, not through sudo');

  const failing = setup({ noImage: true, pullFails: true });
  const failed = failing.run();
  assert.equal(failed.status, 1);
  assert.ok(failed.text.includes('Check that this computer is online') && failed.errors.includes('node:22-alpine is missing'), failed.text + failed.errors);
});

test('inside the root the installer stops and says what to do', () => {

  const inside = setup();
  const moved = path.join(inside.root, 'staging');
  fs.mkdirSync(path.dirname(moved), { recursive: true });
  fs.cpSync(inside.tree, moved, { recursive: true });
  const bad = spawnSync('bash', [path.join(moved, 'computer/install.sh'), '--yes'], { encoding: 'utf8', env: { PATH: path.join(inside.base, 'bin') + ':/usr/bin:/bin', TELETRAAN_ROOT: inside.root, TELETRAAN_ACCOUNT: account } });
  assert.ok(bad.stderr.includes('cannot be inside'), bad.stderr);
});

test('an old /opt/teletraan becomes releases/1, local.env moves to the root and is linked back, the pull timer goes off', () => {
  const s = setup();
  oldTree(s.root, 'deploy');
  const result = s.run();
  assert.equal(result.status, 0, result.errors + result.text);

  assert.ok(fs.existsSync(path.join(s.root, 'releases/1/dashboard/index.html')));
  assert.ok(fs.existsSync(path.join(s.root, 'releases/1/README.md')));
  assert.equal(fs.readFileSync(path.join(s.root, 'releases/COUNTER'), 'utf8'), '1\n');
  assert.equal(fs.readlinkSync(path.join(s.root, 'current')), 'releases/9', 'the fake install switched it; before that it pointed at releases/1');
  assert.equal(fs.readlinkSync(path.join(s.root, 'dashboard')), 'current/dashboard', 'the old name still reaches the live tree');
  assert.match(fs.readFileSync(path.join(s.root, 'local.env'), 'utf8'), /SANITY_WRITE_TOKEN='abc'/);
  assert.equal(fs.statSync(path.join(s.root, 'local.env')).mode & 0o777, 0o600);
  assert.equal(fs.readlinkSync(path.join(s.root, 'releases/1/deploy/local.env')), path.join(s.root, 'local.env'));
  const release = JSON.parse(fs.readFileSync(path.join(s.root, 'releases/1/RELEASE.json'), 'utf8'));
  assert.equal(release.version, 1);
  assert.ok(result.calls.includes('systemctl disable --now teletraan-pull.timer'), result.calls);
});

test('a computer that already has releases is not moved again', () => {
  const s = setup();
  put(path.join(s.root, 'releases/COUNTER'), '4\n');
  put(path.join(s.root, 'releases/4/dashboard/index.html'), 'x');
  put(path.join(s.root, 'local.env'), "CONTROL_PIN='123456'\n", 0o600);
  const result = s.run();
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('Already on the releases layout.'));
  assert.ok(!fs.existsSync(path.join(s.root, 'releases/1')));
  assert.match(fs.readFileSync(path.join(s.root, 'local.env'), 'utf8'), /CONTROL_PIN='123456'/, 'the PIN stays');
});

test('local.env gets the login user ids and the root, once, and is made from the example when it is missing', () => {
  const s = setup();
  assert.equal(s.run().status, 0);
  const text = fs.readFileSync(path.join(s.root, 'local.env'), 'utf8');
  assert.equal((text.match(/^TELETRAAN_UID=/gm) || []).length, 1);
  assert.equal((text.match(/^TELETRAAN_GID=/gm) || []).length, 1);
  assert.match(text, new RegExp("^TELETRAAN_ROOT='" + s.root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'$", 'm'));
  assert.equal(s.run().status, 0);
  assert.equal((fs.readFileSync(path.join(s.root, 'local.env'), 'utf8').match(/^TELETRAAN_UID=/gm) || []).length, 1, 'a second run adds nothing');
});

test('the screen unit is written again with the new folders and the account, and the pull timer is not', () => {
  const s = setup();
  const result = s.run();
  assert.equal(result.status, 0, result.errors);
  const kiosk = fs.readFileSync(path.join(s.places.systemd, 'teletraan-kiosk.service'), 'utf8');
  assert.ok(kiosk.includes('/opt/teletraan/computer/scripts/kiosk.sh') && !kiosk.includes('/deploy/'));
  assert.match(kiosk, new RegExp('User=' + account));
  assert.ok(!kiosk.includes('ACCOUNT'));
  assert.ok(!fs.existsSync(path.join(s.places.systemd, 'teletraan-pull.timer')));
});

test('the socket, its service and the sudoers file are installed with the login user, and visudo checks the file first', () => {
  const s = setup();
  const result = s.run();
  assert.equal(result.status, 0, result.errors);
  const socket = fs.readFileSync(path.join(s.places.systemd, 'teletraan-control.socket'), 'utf8');
  assert.match(socket, /ListenStream=\/run\/teletraan\/control\.sock/);
  assert.match(socket, /SocketMode=0660/);
  assert.match(socket, new RegExp('SocketUser=' + account));
  assert.ok(!socket.includes('ACCOUNT'));
  assert.match(fs.readFileSync(path.join(s.places.systemd, 'teletraan-control@.service'), 'utf8'), new RegExp('User=' + account));
  const sudoers = fs.readFileSync(path.join(s.places.sudoers, 'teletraan-control'), 'utf8');
  assert.ok(sudoers.includes(account + ' ALL=(root) NOPASSWD:'));
  assert.ok(sudoers.includes('/usr/bin/systemctl restart teletraan-*') && sudoers.includes('/sbin/reboot'));
  assert.ok(sudoers.includes('/usr/bin/docker restart teletraan-web,') && !sudoers.includes('restart nginx') && !/docker restart \S*\*/.test(sudoers), sudoers);
  assert.equal(fs.statSync(path.join(s.places.sudoers, 'teletraan-control')).mode & 0o777, 0o440);
  assert.ok(result.calls.includes('visudo -cf'));
  assert.ok(result.calls.includes('systemctl enable --now teletraan-control.socket'));

  const bad = setup({ badSudoers: true });
  const failed = bad.run();
  assert.equal(failed.status, 1);
  assert.ok(failed.errors.includes('did not pass visudo'));
  assert.ok(!fs.existsSync(path.join(bad.places.sudoers, 'teletraan-control')));
});

test('the release is installed by the Node image with the root and the tree mounted, then the containers are made again', () => {
  const s = setup();
  const result = s.run(['--yes', '--commit', 'abc1234', '--note', 'From the test']);
  assert.equal(result.status, 0, result.errors);
  const lines = result.calls.trim().split('\n');
  const run = lines.findIndex(line => line.startsWith('docker run '));
  const up = lines.findIndex(line => line.startsWith('docker compose '));
  assert.ok(run !== -1, result.calls);
  assert.ok(lines[run].includes('node:22-alpine') && lines[run].includes(s.root + ':/opt/teletraan') && lines[run].includes(s.tree + ':/staging:ro'), lines[run]);
  assert.ok(lines[run].includes('control/bin/install-tree.js /staging') && lines[run].includes('--commit abc1234') && lines[run].includes('--no-restart'), lines[run]);
  assert.ok(up > run, 'compose runs as root, after the release install');
  assert.ok(lines[up].includes('up -d --force-recreate') && !lines.some(line => line.startsWith('sudo ')), result.calls);
  assert.ok(lines.some(line => line === 'systemctl restart teletraan-kiosk.service'), 'the screen starts again');
});

test('the bare repository gets a post-receive hook that names the root and the image', () => {
  const s = setup();
  assert.equal(s.run().status, 0);
  const hook = path.join(s.places.git, 'hooks/post-receive');
  const text = fs.readFileSync(hook, 'utf8');
  assert.ok(text.includes('root=' + s.root) && text.includes('image=node:22-alpine'), text);
  assert.ok(!/ROOT$|UID_GID$|IMAGE$/m.test(text));
  assert.ok(fs.statSync(hook).mode & 0o100);
});

fs.rmSync(work, { recursive: true, force: true });
await finish();
