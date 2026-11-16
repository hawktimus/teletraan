// Tests for the menu of the Raspberry Pi copy: the two lists of systems (computer/pi/es-systems.py), the switch between
// them (computer/pi/menu.sh), the Meeting page (dashboard/core/decks-run.js) and the Lo-Fi scene script. Nothing is
// started on a screen.
//
//   node tests/pi-menu.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, finish } from './helpers/runner.mjs';

const repo = new URL('../', import.meta.url);
const root = repo.pathname;
const read = name => fs.readFileSync(new URL(name, repo), 'utf8');
const have = tool => spawnSync('sh', ['-c', 'command -v ' + tool]).status === 0;

const fixture = `<?xml version="1.0"?>
<systemList>
  <system><name>arcade</name><fullname>Arcade</fullname><path>/roms/arcade</path><extension>.zip</extension><command>run %ROM%</command><platform>arcade</platform><theme>arcade</theme></system>
  <system><name>nes</name><fullname>Nintendo Entertainment System</fullname><path>/roms/nes</path><extension>.nes</extension><command>run %ROM%</command><platform>nes</platform><theme>nes</theme></system>
  <system><name>ports</name><fullname>Ports</fullname><path>/roms/ports</path><extension>.sh</extension><command>bash %ROM%</command><platform>pc</platform><theme>ports</theme></system>
  <system><name>teletraan</name><fullname>Teletraan</fullname><path>/roms/teletraan</path><extension>.sh</extension><command>bash %ROM%</command><platform>pc</platform><theme>teletraan</theme></system>
  <system><name>lofi</name><fullname>Lo-Fi Radio</fullname><path>/roms/lofi</path><extension>.radio</extension><command>/radio.sh %ROM%</command><platform>pc</platform><theme>lofi</theme></system>
  <system><name>retropie</name><fullname>RetroPie</fullname><path>/roms/retropiemenu</path><extension>.rp</extension><command>sudo x %ROM%</command><platform>retropie</platform><theme>retropie</theme></system>
</systemList>
`;

function lists() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-menu-'));
  fs.writeFileSync(path.join(folder, 'etc.cfg'), fixture);
  const run = spawnSync('python3', ['-I', path.join(root, 'computer/pi/es-systems.py'), '--etc', path.join(folder, 'etc.cfg'), '--roms', '/home/pi/RetroPie/roms', '--out', folder], { encoding: 'utf8' });
  const names = file => [...fs.readFileSync(path.join(folder, file), 'utf8').matchAll(/<name>(.*?)<\/name>/g)].map(match => match[1]);
  return { folder, run, names };
}

test('Meeting is a page of the Pi alone: its own page, its own service, and nothing of the Teletraan computer changed', () => {
  const launch = read('computer/pi/launch.sh');
  assert.ok(launch.includes('address="$base/meeting/"') && launch.includes('page=meeting'));
  assert.ok(launch.includes('touch /var/lib/teletraan/meeting/.wake'), 'opening Meeting asks the service to look at the folder now');
  assert.ok(read('computer/pi/Presentations.sh').includes('launch.sh meeting'));
  // The dashboard files that the Teletraan computer runs have nothing of Meeting in them
  ['dashboard/core/decks-run.js', 'dashboard/core/console-keys.js', 'dashboard/decks.css'].forEach(file => assert.ok(!/meeting/i.test(read(file)), file + ' is as it was'));
  const nginx = read('computer/pi/nginx.conf');
  assert.ok(nginx.includes('alias /opt/teletraan/current/computer/pi/meeting/;') && nginx.includes('alias /var/lib/teletraan/meeting/;'));
  const unit = read('computer/pi/systemd/teletraan-pi-meeting.service');
  assert.ok(unit.includes('ExecStart=/opt/teletraan/computer/pi/meeting-sync.sh --watch') && unit.includes('WantedBy=multi-user.target') && unit.includes('Nice=19'));
  assert.ok(!read('computer/pi/systemd/teletraan-pi.target').includes('teletraan-pi-decks'), 'the watcher of the Teletraan-style list is not run on the Pi');
  assert.ok(fs.existsSync(new URL('computer/pi/systemd/teletraan-pi-decks.service', repo)) === false);
  const install = read('computer/pi/install-pi.sh');
  assert.ok(install.includes('systemctl enable teletraan-pi-meeting.service') && install.includes('/var/lib/teletraan/meeting'));
});

test('Meeting: any key goes on, Left goes back, Esc leaves for the Dashboard, Esc in the list goes home', () => {
  const page = read('computer/pi/meeting/meeting.js');
  assert.ok(page.includes("ask('/pi/go/dashboard'"), 'Esc in a presentation goes to the Dashboard directly');
  assert.ok(page.includes("ask('/pi/leave'"), 'Esc in the list goes back to the home screen');
  assert.ok(page.includes("event.key === 'ArrowLeft' || event.key === 'PageUp'"));
  assert.ok(/MODIFIERS = \['Shift', 'Control', 'Alt'/.test(page), 'a modifier alone is not a key press');
  assert.ok(page.includes("DATA = '/meeting-data/'") && !/\/dashboard\/data|decks\/manifest/.test(page), 'its own list and pictures');
  assert.ok(page.includes('?v=') && page.includes('AHEAD'), 'the slides ahead are loaded before they are needed');
  assert.ok(read('computer/pi/exit-watch.py').includes("'meeting')") || read('computer/pi/exit-watch.py').includes("'stream', 'meeting'"));
});

test('the menu is Teletraan, Meeting, Arcade, Lo-Fi, and the Arcade holds the game systems and a way back', () => {
  if (!have('python3')) return;
  const { run, names } = lists();
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(names('es_systems.menu.cfg'), ['teletraan', 'meeting', 'arcademenu', 'lofi']);
  assert.deepEqual(names('es_systems.arcade.cfg'), ['mainmenu', 'arcade', 'nes', 'ports', 'retropie']);
});

test('the lists keep the commands as they were, and the full list is not touched', () => {
  if (!have('python3')) return;
  const { folder, run } = lists();
  assert.equal(run.status, 0, run.stderr);
  const arcade = fs.readFileSync(path.join(folder, 'es_systems.arcade.cfg'), 'utf8');
  assert.ok(arcade.includes('<command>sudo x %ROM%</command>') && arcade.includes('<command>run %ROM%</command>'));
  const menu = fs.readFileSync(path.join(folder, 'es_systems.menu.cfg'), 'utf8');
  assert.ok(menu.includes('<theme>arcade</theme>') && menu.includes('/home/pi/RetroPie/roms/meeting') && menu.includes('/home/pi/RetroPie/roms/arcademenu'));
  assert.equal(fs.readFileSync(path.join(folder, 'etc.cfg'), 'utf8'), fixture, 'the full list is only read');

  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-menu-'));
  fs.writeFileSync(path.join(empty, 'etc.cfg'), '<systemList><system><name>nes</name></system></systemList>');
  const notFull = spawnSync('python3', ['-I', path.join(root, 'computer/pi/es-systems.py'), '--etc', path.join(empty, 'etc.cfg'), '--out', empty], { encoding: 'utf8' });
  assert.notEqual(notFull.status, 0, 'a list without the arcade system is not taken for the full list');
});

test('menu.sh puts one of the lists in place, takes the user list away for full, and refuses anything else', () => {
  if (!have('bash')) return;
  const { folder, run } = lists();
  assert.equal(run.status, 0, run.stderr);
  const menu = (...args) => spawnSync('bash', [path.join(root, 'computer/pi/menu.sh'), ...args], { encoding: 'utf8', env: { ...process.env, ES_HOME: folder } });
  const active = () => fs.readFileSync(path.join(folder, 'es_systems.cfg'), 'utf8');

  assert.equal(menu('menu').status, 0);
  assert.equal(active(), fs.readFileSync(path.join(folder, 'es_systems.menu.cfg'), 'utf8'));
  assert.equal(menu('arcade').status, 0);
  assert.equal(active(), fs.readFileSync(path.join(folder, 'es_systems.arcade.cfg'), 'utf8'));
  assert.equal(menu('full').status, 0);
  assert.equal(fs.existsSync(path.join(folder, 'es_systems.cfg')), false, 'without the user list EmulationStation reads the full one');
  assert.notEqual(menu('nonsense').status, 0);
  assert.notEqual(menu().status, 0);

  fs.rmSync(path.join(folder, 'es_systems.menu.cfg'));
  const missing = menu('menu');
  assert.notEqual(missing.status, 0);
  assert.ok(/install-pi\.sh/.test(missing.stderr), 'it says what to do');
  assert.equal(fs.existsSync(path.join(folder, 'es_systems.cfg')), false, 'a list that is not there changes nothing');
});

test('the entries ask menu.sh to restart EmulationStation the way its own menu does, and nothing else is stopped', () => {
  const menu = read('computer/pi/menu.sh');
  assert.ok(menu.includes('touch /tmp/es-restart') && menu.includes('pgrep -x emulationstatio') && menu.includes('/proc/$pid/exe'), 'only the program, not the wrapper that has the same name');
  assert.ok(!/pkill/.test(menu), 'pkill by name would stop the wrapper too, and the TV would stay on the terminal');
  assert.ok(!/pkill -f|killall|systemctl/.test(menu), 'no pattern that could match something else');
  assert.ok(read('computer/pi/Arcade.sh').includes('menu.sh arcade restart'));
  assert.ok(read('computer/pi/MainMenu.sh').includes('menu.sh menu restart'));
});

test('the installer makes the three folders with their themes, the entries, the two lists and the start at the menu', () => {
  const install = read('computer/pi/install-pi.sh');
  ['system_folder teletraan TELETRAAN', 'system_folder meeting MEETING', 'system_folder mainmenu "MAIN MENU"', 'Enter the Arcade.sh', 'Back to the Main Menu.sh', 'es-systems.py', 'autostart.sh'].forEach(part => assert.ok(install.includes(part), part));
  assert.ok(install.includes('cp -p "$auto" "$auto.before-teletraan"'), 'the start file of the console is kept');
  assert.ok(!/Hawktimus|themes\/hawktimus/.test(install.replace(/#.*$/gm, '')), 'the theme set is not written to');
  assert.ok(read('computer/pi/es-theme.xml').includes('<text>@TITLE@</text>'));
});

test('lofi-scene.sh will not take a clip without a source and a licence, or for a channel that is not there', () => {
  if (!have('bash')) return;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-lofi-'));
  fs.writeFileSync(path.join(folder, '08-citypop.radio'), 'https://example.invalid/stream\n');
  fs.writeFileSync(path.join(folder, 'clip.mp4'), 'not a video');
  const scene = (...args) => spawnSync('bash', [path.join(root, 'computer/pi/lofi-scene.sh'), ...args], { encoding: 'utf8', env: { ...process.env, LOFI_ROMS: folder } });

  const none = scene('08-citypop', path.join(folder, 'clip.mp4'), 'https://example.invalid/clip');
  assert.notEqual(none.status, 0);
  assert.ok(/Usage/.test(none.stderr), 'no licence, no scene');
  const nowhere = scene('09-nothing', path.join(folder, 'clip.mp4'), 'https://example.invalid/clip', 'CC0');
  assert.notEqual(nowhere.status, 0);
  assert.ok(/not a channel/.test(nowhere.stderr));
  const missing = scene('08-citypop', path.join(folder, 'nope.mp4'), 'https://example.invalid/clip', 'CC0');
  assert.ok(/is not a file/.test(missing.stderr));
  assert.ok(read('computer/pi/lofi-scene.sh').includes('LICENCES.tsv'));
});

test('the Pi writes the competition feed only while Teletraan is up, with the keys it is given by hand, and writes no status', () => {
  const service = read('computer/pi/systemd/teletraan-pi-frc.service');
  assert.ok(service.includes('ExecStart=/opt/teletraan/computer/scripts/frc-sync.sh') && service.includes('PartOf=teletraan-pi.target'));
  assert.ok(!/ExecStartPost|status-write|MONDAY_API_TOKEN|SANITY_WRITE_TOKEN=|TBA_AUTH_KEY=/.test(service.replace(/#.*$/gm, '')), 'no status writer and no key in the unit');
  assert.ok(read('computer/pi/systemd/teletraan-pi-frc.timer').includes('OnUnitActiveSec=5min'));
  assert.ok(read('computer/pi/systemd/teletraan-pi.target').includes('teletraan-pi-frc.timer'));
});

test('the Lo-Fi list is the Main Menu entry and the radio, and menu.sh can put it in place', () => {
  if (!have('python3') || !have('bash')) return;
  const { folder, run, names } = lists();
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(names('es_systems.lofi.cfg'), ['mainmenu', 'lofi']);
  const menu = (...args) => spawnSync('bash', [path.join(root, 'computer/pi/menu.sh'), ...args], { encoding: 'utf8', env: { ...process.env, ES_HOME: folder } });
  assert.equal(menu('lofi').status, 0);
  assert.equal(fs.readFileSync(path.join(folder, 'es_systems.cfg'), 'utf8'), fs.readFileSync(path.join(folder, 'es_systems.lofi.cfg'), 'utf8'));
  const script = read('computer/pi/menu.sh');
  const quitBranch = script.slice(script.indexOf('if [ "$list" = quit ]'), script.indexOf('case $list in'));
  assert.ok(quitBranch.includes('stop_program') && !quitBranch.includes('es-restart'), 'quit ends EmulationStation and does not ask for it to start again');
});

test('the home screen has a tile for each thing it can start, and every layer agrees on the names', () => {
  const html = read('computer/pi/launcher/index.html');
  const tiles = [...html.matchAll(/data-go="([a-z]+)"/g)].map(match => match[1]);
  assert.deepEqual(tiles, ['dashboard', 'meeting', 'stream', 'lofi', 'arcade']);
  const watch = read('computer/pi/exit-watch.py');
  const go = watch.match(/GO = \(([^)]*)\)/)[1].match(/'([a-z]+)'/g).map(name => name.replace(/'/g, ''));
  tiles.forEach(name => assert.ok(go.includes(name), 'exit-watch.py knows ' + name));
  go.forEach(name => assert.ok(/(dashboard \| control \| meeting \| stream|arcade \| lofi)/.test(read('computer/pi/home.sh')) && read('computer/pi/home.sh').includes(name), 'home.sh starts ' + name));
  assert.ok(watch.includes("path.startswith('/go/') and path[4:] in GO"), 'anything else is not found');
  assert.ok(read('computer/pi/launcher/launcher.js').includes("'/pi/go/' + tile.getAttribute('data-go')"));
  assert.ok(read('computer/pi/nginx.conf').includes('alias /opt/teletraan/current/computer/pi/launcher/;'));
});

test('the home screen writes colors only as variables of the theme', () => {
  const css = read('computer/pi/launcher/launcher.css');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?<![-\w])(black|white|red|blue|green|yellow|purple)(?![-\w])\s*[;,)]/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'no color written out');
  assert.ok(/var\(--yellow\)/.test(css) && /var\(--ground\)/.test(css));
});

test('the Kickoff stream address is the one in local.env when it is a web address, and the channel of FIRST when not', () => {
  const launch = read('computer/pi/launch.sh');
  assert.ok(launch.includes("sed -n 's/^KICKOFF_URL=//p' /opt/teletraan/local.env"), 'only that one line is read');
  assert.ok(launch.includes('https://*) printf'), 'only a web address is taken');
  assert.ok(launch.includes('https://www.youtube.com/firstroboticscompetition/live'));
  assert.ok(launch.includes("extra='--autoplay-policy=no-user-gesture-required'"));
  assert.ok(read('computer/pi/exit-watch.py').includes("ESC_LEAVES = ('control', 'stream')"), 'Esc leaves the stream, which is not our page');
});

test('home.sh shows the tiles, starts the choice, comes back with the last choice marked, and gives up to EmulationStation after two misses', () => {
  if (!have('bash')) return;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-home-'));
  const bin = path.join(folder, 'bin');
  const runDir = path.join(folder, 'run');
  fs.mkdirSync(bin);
  fs.mkdirSync(runDir);
  const log = path.join(folder, 'log');
  const queue = path.join(folder, 'queue');
  fs.writeFileSync(queue, 'meeting\narcade\nstream\n\n\n');
  fs.writeFileSync(path.join(bin, 'launch.sh'), `#!/bin/bash
echo "launch $*" >> "${log}"
if [ "$1" = home ]; then
  next=$(head -n 1 "${queue}"); tail -n +2 "${queue}" > "${queue}.t"; mv "${queue}.t" "${queue}"
  [ -n "$next" ] && echo "$next" > "${runDir}/teletraan-choice"
  [ -e "${runDir}/teletraan-home" ] && echo "marker there" >> "${log}"
fi
exit 0
`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'menu.sh'), `#!/bin/bash\necho "menu $*" >> "${log}"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'es'), `#!/bin/bash\necho "es" >> "${log}"\n`, { mode: 0o755 });
  const run = spawnSync('bash', [path.join(root, 'computer/pi/home.sh')], { encoding: 'utf8', timeout: 30000, env: { ...process.env, TELETRAAN_PI: bin, TELETRAAN_RUN: runDir, TELETRAAN_ES: path.join(bin, 'es') } });
  assert.equal(run.status, 0, run.stderr);
  const lines = fs.readFileSync(log, 'utf8').trim().split('\n').filter(line => line !== 'marker there');
  assert.deepEqual(lines, [
    'launch home dashboard', 'launch meeting',
    'launch home meeting', 'menu arcade', 'es',
    'launch home arcade', 'launch stream',
    'launch home stream',
    'launch home stream'
  ]);
  assert.ok(fs.readFileSync(log, 'utf8').includes('marker there'), 'the marker that MainMenu.sh looks for is there while it runs');
  assert.equal(fs.existsSync(path.join(runDir, 'teletraan-home')), false, 'and gone when it ends');
});

test('Main Menu quits EmulationStation when the home screen is up, and shows the menu list when it is not', () => {
  const entry = read('computer/pi/MainMenu.sh');
  assert.ok(entry.includes('teletraan-home') && entry.includes('menu.sh quit') && entry.includes('menu.sh menu restart'));
});

test('the installer puts the home screen before the menu list in autostart.sh and keeps the file from before', () => {
  const install = read('computer/pi/install-pi.sh');
  assert.ok(install.includes('computer/pi/home.sh') && install.includes('[ -f "$auto.before-teletraan" ] || cp -p "$auto" "$auto.before-teletraan"'));
  assert.ok(install.indexOf('home_line=') > install.indexOf('line="[ -x $root/computer/pi/menu.sh ]'), 'it goes in once the menu line is there');
});

await finish();
