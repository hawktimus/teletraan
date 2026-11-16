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
import { consoleKeysOn, meetingOn } from '../dashboard/core/console-keys.js';

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

test('the meeting page is asked for only by the Pi launcher, and only with the console keys on', () => {
  assert.equal(meetingOn('?keys=console&meeting=1'), true);
  ['', '?meeting=1', '?keys=console', '?keys=console&meeting=0', '?keys=other&meeting=1', undefined, null].forEach(search => assert.equal(meetingOn(search), false, String(search)));
  assert.equal(consoleKeysOn('?keys=console&meeting=1'), true);
  assert.ok(read('computer/pi/launch.sh').includes('address="$base/dashboard/?keys=console&meeting=1"'));
  assert.ok(read('computer/pi/Presentations.sh').includes('launch.sh meeting'));
});

test('in the meeting page Esc leaves, the list opens by itself and does not time out, and nothing else changes', () => {
  const run = read('dashboard/core/decks-run.js');
  assert.ok(run.includes("if (meeting && event.key === 'Escape') {"), 'Esc leaves');
  assert.ok(run.includes('fetch(leaveAddress, { cache: \'no-store\', keepalive: true })'), 'with a plain address, no body');
  assert.ok(run.includes('(!meeting && pickerTimedOut(picker, now))'), 'no time out in the meeting page');
  assert.ok(run.includes('if (meeting && getContent() && !takeoverRunning() && !talkOnScreen() && now.getTime() - closedAt >= reopenAfterMs) open(now);'), 'it opens again after a talk or an alert');
  assert.ok(run.includes("meeting = meetingOn(window.location.search);"), 'the page decides from its own address');
  assert.ok(!/method:/.test(run), 'nothing is sent');
  assert.ok(read('dashboard/decks.css').includes('#decks[data-meeting="yes"] { background: var(--pure-black); }'));
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
  assert.ok(menu.includes('touch /tmp/es-restart') && menu.includes('pkill -x emulationstatio'));
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

await finish();
