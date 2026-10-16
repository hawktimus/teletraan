// Tests for docs/laptop-setup.md and the docs about shipping: the steps are all
// there and in order, each command sits in a code block of its own, the commands
// and files the guide names exist, the docs agree with tools/mac/ship.sh, and the
// words are plain. Nothing here runs a command from a guide.
//
//   node tests/laptop-docs.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { textOf } from './helpers/script-parts.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

const laptop = read('docs/laptop-setup.md');
const shipping = read('docs/shipping-from-the-mac.md');
const updating = read('docs/updating-the-computer.md');
const shipScript = read('tools/mac/ship.sh');
const computerTool = textOf(path.join(repo, 'tools/teletraan/teletraan-tool'));

// Every fenced block of a doc, with the lines in it
function codeBlocks(text) {
  const blocks = [];
  const found = text.matchAll(/^```[^\n]*\n([\s\S]*?)^```$/gm);
  for (const match of found) blocks.push(match[1].split('\n').filter(line => line.trim() !== ''));
  return blocks;
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('the laptop guide has the eleven steps in order, then what is not in GitHub', () => {
  const headings = laptop.split('\n').filter(line => line.startsWith('## '));
  const expected = [
    '## What you need',
    '## 1. Install git and Node',
    '## 2. Get the code',
    '## 3. Sign in to GitHub',
    '## 4. Install the Studio\'s packages',
    '## 5. Sign in to Sanity',
    '## 6. Make the Ship app',
    '## 7. Run the Mac tool once',
    '## 8. Keys and calendars (only if this laptop will change them)',
    '## 9. What the app does',
    '## 10. When a step stops',
    '## 11. Check that it works',
    '## What is not in GitHub',
  ];
  assert.deepEqual(headings, expected);
});

test('every command of the laptop guide is in a code block of its own, with one line and no comment', () => {
  const blocks = codeBlocks(laptop);
  assert.ok(blocks.length >= 18, 'the guide has its commands in code blocks: ' + blocks.length);
  blocks.forEach(block => {
    assert.equal(block.length, 1, 'a code block holds one command: ' + block.join(' | '));
    assert.ok(!block[0].startsWith('#') && !block[0].startsWith('$'), 'a command has no prompt or comment: ' + block[0]);
  });
  assert.equal((laptop.match(/```/g) || []).length % 2, 0, 'every code block is closed');
});

test('the guide names the commands in the order a coach needs them', () => {
  const commands = codeBlocks(laptop).map(block => block[0]);
  const wanted = [
    'git --version',
    'node --version',
    'git clone https://github.com/Hawktimus/teletraan.git',
    'git pull',
    'gh auth setup-git',
    'git config --global user.name "Your Name"',
    'git config --global user.email "you@example.com"',
    'npm ci',
    'npx sanity login',
    'npx sanity projects list',
    'tools/mac/make-app.sh',
    'tools/teletraan/teletraan-tool',
    'ssh-copy-id hawktimus@teletraan.local',
    'ssh-keygen -t ed25519',
  ];
  let at = 0;
  const firstOrder = ['git --version', 'node --version', 'git clone https://github.com/Hawktimus/teletraan.git', 'npm ci', 'npx sanity login', 'tools/mac/make-app.sh', 'tools/teletraan/teletraan-tool'];
  firstOrder.forEach(command => {
    const found = commands.indexOf(command, at);
    assert.ok(found !== -1, 'comes in this order: ' + command);
    at = found + 1;
  });
  wanted.forEach(command => assert.ok(commands.includes(command), 'the guide has the command: ' + command));
  const cloneIndex = commands.indexOf('git clone https://github.com/Hawktimus/teletraan.git');
  assert.equal(commands[cloneIndex + 1], 'cd teletraan', 'the clone is followed by a move into the repository folder');
  assert.ok(commands.filter(command => command === 'cd studio').length >= 2, 'the Studio steps move into studio');
});

test('the guide covers what a coach needs: both ways to install, no silent install, the two sign-ins, the app, the Teletraan computer, the keys, and what stays out of GitHub', () => {
  [
    'Homebrew', 'official sites', 'No step in this guide installs them for you',
    'git pull', 'first push', 'credential helper', 'gh auth login', 'team mentor',
    'studio/node_modules', 'npm run deploy',
    'Ship Teletraan.app', 'holds the path', 'make the app again',
    '~/.teletraan/config', 'user@host', 'ssh-copy-id', 'school network', 'Tailscale',
    'choose 3', '~/.teletraan/secrets.env', 'Never send them by email or chat',
    'Screen\nstarted', 'went black for about ten seconds', 'Already up to date',
    'AirDrop', 'USB drive', 'parent folder', 'project notes', 'reference pictures',
    'Never copy that folder by email or chat',
  ].forEach(phrase => assert.ok(laptop.includes(phrase) || laptop.replace(/\s+/g, ' ').includes(phrase.replace(/\s+/g, ' ')), 'the guide says: ' + phrase));
});

test('the three steps of choice 1 are named in order, with the command each one runs', () => {
  const where = ['1. **Push.**', '2. **Studio.**', '3. **Teletraan computer.**'].map(marker => laptop.indexOf(marker));
  assert.ok(where.every(index => index !== -1) && where[0] < where[1] && where[1] < where[2], where.join());
  ['`git push`', '`npm run deploy`', '`tools/teletraan/teletraan-tool update --yes`'].forEach(command => assert.ok(laptop.includes(command), command));
});

test('the commands and files the docs name exist', () => {
  const made = new Set(['studio/node_modules', 'studio/dist', 'studio/.sanity', 'computer/local.env']);
  [laptop, shipping, updating].forEach(text => {
    for (const match of text.matchAll(/`((?:docs|mini|tools|studio)\/[A-Za-z0-9_.\/-]+)`/g)) {
      const file = match[1].replace(/[.,]$/, '');
      if (made.has(file) || file.endsWith('/') || file.includes('*')) continue;
      assert.ok(fs.existsSync(path.join(repo, file)), 'the docs name ' + file + ' and it does not exist');
    }
  });
  ['tools/mac/make-app.sh', 'tools/mac/ship.sh', 'tools/teletraan/teletraan-tool'].forEach(file => assert.ok((fs.statSync(path.join(repo, file)).mode & 0o111) !== 0, file + ' is executable'));
  const manifest = JSON.parse(read('studio/package.json'));
  assert.equal(manifest.scripts.deploy, 'sanity deploy', 'npm run deploy is the Studio deploy');
  assert.ok(Number(/>=(\d+)/.exec(manifest.engines.node)[1]) === 22 && manifest.engines.node.includes('22.12'), 'the guide says Node 22.12 and so does the Studio');
  assert.ok(laptop.includes('22.12'));
});

test('the shipping doc agrees with ship.sh: the menu, the action words, the old words and the steps', () => {
  const menu = shipScript.slice(shipScript.indexOf('menu() {'), shipScript.indexOf('[ -n "$action" ] || menu'));
  const choices = Array.from(menu.matchAll(/^\s+([1-5]) ?\) action=(\w+) ;;$/gm)).map(match => [match[1], match[2]]);
  assert.deepEqual(choices, [['1', 'all'], ['2', 'push'], ['3', 'studio'], ['4', 'computer'], ['5', 'status']]);
  choices.forEach(([number, word]) => assert.ok(shipping.includes('| ' + number + ' | `' + word + '` |'), 'the shipping doc has choice ' + number + ' with `' + word + '`'));
  ['`all-restart`', '`restart`', '`--dry-run`', 'tools/teletraan/teletraan-tool update --yes', 'sudo systemctl disable --now teletraan-pull.timer', 'deployment: { appId: ... }', 'git pull --no-rebase', '`git fetch`', '~/.teletraan/config', 'COMPUTER_REPO', 'COMPUTER_KIOSK'].forEach(text => assert.ok(shipping.includes(text), 'the shipping doc says: ' + text));
  ['Ship everything', 'Push only', 'Studio only', 'Update the Teletraan computer only', 'Status of the computer'].forEach(name => {
    assert.ok(shipScript.includes(name), 'ship.sh has the menu entry ' + name);
    assert.ok(laptop.includes(name), 'the laptop guide has ' + name);
  });
  assert.ok(shipping.includes('only opens Terminal') && shipping.includes('updates by itself') && shipping.includes('makes its own app'), 'the doc says the app on a Mac updates by itself and a laptop makes its own');
  ['tells the Teletraan computer to pull', 'Mini pulls only', 'Why the pull is not run with sudo', 'COMPUTER_ADDRESS'].forEach(old => {
    assert.ok(!shipping.includes(old) && !laptop.includes(old) && !updating.includes(old), 'the old Mini pulls step is gone: ' + old);
  });
});

test('the doc of the Mac tool names the words, the options and the exit codes the tool has', () => {
  ['teletraan-tool update', 'teletraan-tool status', 'teletraan-tool restart', '--yes', '--computer NAME', 'exit code'].forEach(text => assert.ok(updating.includes(text), 'docs/updating-the-computer.md says: ' + text));
  assert.ok(computerTool.includes('Usage: teletraan-tool [--computer NAME] [--yes] [update | status | restart]'));
  ['update', 'status', 'restart'].forEach(word => assert.ok(computerTool.includes('  ' + word + ' '), 'the tool lists ' + word));
  assert.ok(updating.includes('tests/teletraan-tool-commands.test.mjs'));
});

test('the other docs point to the new guide and no longer say the Teletraan computer pulls after a ship', () => {
  ['README.md', 'computer/README.md', 'docs/where-things-are.md'].forEach(file => {
    const text = read(file);
    assert.ok(text.includes('docs/laptop-setup.md'), file + ' points to docs/laptop-setup.md');
    assert.ok(text.includes('shipping-from-the-mac.md'), file + ' points to docs/shipping-from-the-mac.md');
    assert.ok(!/tells the Teletraan computer to pull|and tells the computer/.test(text), file + ' still says ship tells the computer to pull');
  });
  assert.ok(read('README.md').includes('Ship Teletraan.app') && read('README.md').includes('update, status and restart'));
  assert.ok(read('computer/README.md').includes('teletraan-tool update --yes'));
  const places = read('docs/where-things-are.md');
  ['teletraan-tool-commands.test.mjs', 'ship.test.mjs', 'laptop-docs.test.mjs'].forEach(name => assert.ok(places.includes(name), 'where-things-are.md lists ' + name));
  assert.ok(laptop.includes('docs/shipping-from-the-mac.md') && laptop.includes('docs/updating-the-computer.md'));
});

test('the docs are plain: no em or en dash, no exclamation mark, no emoji, no filler word, no mention of a tool', () => {
  const dashes = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
  const emoji = new RegExp('[' + String.fromCharCode(0x2600) + '-' + String.fromCharCode(0x27bf) + ']|[\\uD83C-\\uD83E][\\uDC00-\\uDFFF]');
  const filler = /\b(simply|just|basically|really|very|actually|easily|seamless|robust|leverage|ensure|comprehensive)\b/i;
  // the words are joined from pieces so that this file does not hold them
  const traces = new RegExp('\\b(' + ['cla' + 'ude', 'anthr' + 'opic', 'ope' + 'nai', 'chat' + 'gpt', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'assis' + 'tant'].join('|') + ')\\b|\\bA' + 'I\\b', 'i');
  const written = ['docs/laptop-setup.md', 'docs/shipping-from-the-mac.md', 'docs/updating-the-computer.md'];
  written.forEach(file => {
    const text = read(file);
    assert.ok(!dashes.test(text), file + ' has an em or en dash');
    assert.ok(!emoji.test(text), file + ' has an emoji');
    assert.ok(!text.includes('!'), file + ' has an exclamation mark');
    assert.ok(!filler.test(text), file + ' has a filler word');
    assert.ok(!traces.test(text), file + ' mentions a tool');
  });
  ['README.md', 'computer/README.md', 'docs/where-things-are.md'].forEach(file => {
    const text = read(file);
    assert.ok(!dashes.test(text), file + ' has an em or en dash');
    assert.ok(!traces.test(text), file + ' mentions a tool');
  });
  assert.ok(!filler.test(read('computer/README.md')), 'computer/README.md has a filler word');
  const self = fs.readFileSync(new URL(import.meta.url), 'utf8');
  assert.ok(!dashes.test(self), 'this test has an em or en dash');
  assert.ok(!traces.test(self), 'this test mentions a tool');
});

test('the guide keeps no secret: no key, token or calendar address is written in the docs or ship.sh', () => {
  const text = [laptop, shipping, updating, shipScript].join('\n');
  assert.ok(!/https:\/\/api\.band\.us\/[^\s`]*token=[A-Za-z0-9]{8,}/.test(text), 'a calendar address');
  assert.ok(!/\b(sk[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(text), 'a key or token');
  assert.ok(!/(SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY)\s*=\s*['"]?[A-Za-z0-9]{8,}/.test(text), 'a key written with a value');
  assert.ok(laptop.includes('computer/local.env'), 'the guide says where the keys live');
});

let failures = 0;
for (const entry of tests) {
  try {
    entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name);
    console.log(error);
  }
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
