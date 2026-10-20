// Tests the tests of the house rules: a copy of the dashboard that breaks each rule must fail tests/house-rules.test.mjs
// with a message that names the file, the line and what to do, and an untouched copy must pass.
//
//   node tests/house-rules-fail.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const tests = [];
const test = (name, run) => tests.push({ name: name, run: run });
const copies = [];

// A copy of the dashboard and of the two test files, in a folder of its own
function copy(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-rules-' + name + '-'));
  fs.cpSync(path.join(repo, 'dashboard'), path.join(root, 'dashboard'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tests/helpers'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'tests/house-rules.test.mjs'), path.join(root, 'tests/house-rules.test.mjs'));
  fs.copyFileSync(path.join(repo, 'tests/helpers/house-rules.mjs'), path.join(root, 'tests/helpers/house-rules.mjs'));
  copies.push(root);
  return root;
}

const add = (root, file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.appendFileSync(path.join(root, file), text);
};

function run(root) {
  const result = spawnSync(process.execPath, [path.join(root, 'tests/house-rules.test.mjs')], { encoding: 'utf8', env: Object.assign({}, process.env, { TELETRAAN_RUNNER: '' }) }); // the whole list, not the short one the runner asks for
  return { code: result.status, text: result.stdout + result.stderr };
}

test('an untouched copy passes', () => {
  const root = copy('clean');
  const result = run(root);
  assert.equal(result.code, 0, result.text);
});

test('a timer, a transition and a keyframe in a panel fail with the file and the line', () => {
  const root = copy('animation');
  add(root, 'dashboard/panels/tasks/panel.js', '\nsetTimeout(() => {}, 10);\n');
  add(root, 'dashboard/panels/tasks/panel.css', '\n.tasks .row { transition: opacity 1s; }\n@keyframes wiggle { from { opacity: 0; } }\n');
  const result = run(root);
  assert.equal(result.code, 1);
  assert.match(result.text, /FAIL {2}a panel folder holds no animation code/);
  assert.match(result.text, /dashboard\/panels\/tasks\/panel\.js line \d+: uses setTimeout, which is animation code/);
  assert.match(result.text, /dashboard\/panels\/tasks\/panel\.css line \d+: sets transition/);
  assert.match(result.text, /has @keyframes/);
  assert.match(result.text, /Do instead: .*data-slat/);
});

test('a framework, a build file, a dependency and a script from another address fail', () => {
  const root = copy('framework');
  add(root, 'dashboard/webpack.config.js', 'export default {};\n');
  add(root, 'dashboard/package-lock.json', '{}\n');
  add(root, 'dashboard/core/uses-library.js', "import React from 'react';\nexport const x = React;\n");
  add(root, 'dashboard/panels/tasks/panel.js', "\nimport('lodash');\n");
  fs.writeFileSync(path.join(root, 'dashboard/package.json'), '{ "type": "module", "dependencies": { "react": "18" } }\n');
  const page = path.join(root, 'dashboard/index.html');
  fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace('</body>', '<script src="https://cdn.example.com/lib.js"></script></body>'));
  const result = run(root);
  assert.equal(result.code, 1);
  assert.match(result.text, /FAIL {2}the dashboard folder has no framework/);
  assert.match(result.text, /dashboard\/webpack\.config\.js: is a build or package file/);
  assert.match(result.text, /dashboard\/package-lock\.json: is a build or package file/);
  assert.match(result.text, /dashboard\/package\.json: has dependencies/);
  assert.match(result.text, /uses-library\.js line 1: imports "react", which is not a file of ours/);
  assert.match(result.text, /panels\/tasks\/panel\.js line \d+: imports "lodash"/);
  assert.match(result.text, /index\.html line \d+: loads https:\/\/cdn\.example\.com\/lib\.js from another address/);
});

test('text under 44px in a panel fails, and a size the house rules name does not', () => {
  const root = copy('size');
  add(root, 'dashboard/panels/tasks/panel.css', '\n.tasks .tiny { font-size: 30px; }\n.tasks .small { font: 600 28px/32px var(--font-text); }\n.tasks .token { font-size: var(--size-stamp); }\n.tasks .relative { font-size: 2em; }\n');
  add(root, 'dashboard/panels/photo/panel.css', '\n.photo .credit-again { font-size: 30px; }\n'); // the photo credit is 30px
  const result = run(root);
  assert.equal(result.code, 1);
  assert.match(result.text, /FAIL {2}no text in a panel is smaller than 44px/);
  assert.match(result.text, /panels\/tasks\/panel\.css line \d+: sets text to 30px, under 44px/);
  assert.match(result.text, /panels\/tasks\/panel\.css line \d+: sets text to 28px, under 44px/);
  assert.match(result.text, /--size-stamp is 20px, under 44px/);
  assert.match(result.text, /sizes the text in em \(2em\)/);
  assert.equal(/panels\/photo\/panel\.css/.test(result.text), false, 'the photo credit size is allowed');
});

test('a blurred shadow, a blend mode, 3D and video fail, and a panel may not use 3D at all', () => {
  const root = copy('effects');
  add(root, 'dashboard/panels/tasks/panel.css', '\n.tasks .a { box-shadow: 0 0 20px red; mix-blend-mode: multiply; transform: rotateX(20deg); }\n');
  add(root, 'dashboard/panels/events/panel.css', '\n.events .a { transform: rotateY(5deg); }\n');
  add(root, 'dashboard/core/video-bit.js', "export const clip = '<video src=\"a.mp4\"></video>';\n");
  const result = run(root);
  assert.equal(result.code, 1);
  assert.match(result.text, /FAIL {2}the dashboard uses no shadow, blend mode, 3D or video/);
  assert.match(result.text, /tasks\/panel\.css line \d+: sets box-shadow with a blur/);
  assert.match(result.text, /sets mix-blend-mode/);
  assert.match(result.text, /uses rotateX \(3D\)/);
  assert.match(result.text, /events\/panel\.css line \d+: uses rotateY \(3D\)/);
  assert.match(result.text, /video-bit\.js line 1: refers to video/);
});

test('a panel folder with a missing file, a stray file or no registry line fails, and so does a line with no folder', () => {
  const root = copy('folders');
  add(root, 'dashboard/panels/orphan/panel.js', 'export function mount() {}\n');
  add(root, 'dashboard/panels/tasks/notes.txt', 'hello\n');
  fs.rmSync(path.join(root, 'dashboard/panels/ticker/panel.css'));
  add(root, 'dashboard/registry.js', "\npanels.push({ id: 'ghost', region: 'grid1' });\n");
  const result = run(root);
  assert.equal(result.code, 1);
  assert.match(result.text, /FAIL {2}every panel folder has panel\.js, panel\.css and a line in registry\.js/);
  assert.match(result.text, /dashboard\/panels\/orphan: has no panel\.css/);
  assert.match(result.text, /dashboard\/panels\/orphan: is not in dashboard\/registry\.js/);
  assert.match(result.text, /dashboard\/panels\/tasks\/notes\.txt: should not be here/);
  assert.match(result.text, /dashboard\/panels\/ticker: has no panel\.css/);
  assert.match(result.text, /lists the panel "ghost" but dashboard\/panels\/ghost does not exist/);
});

let failed = 0;
for (const item of tests) {
  try {
    item.run();
    console.log('ok    ' + item.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + item.name + '\n' + error.message);
  }
}
copies.forEach(root => fs.rmSync(root, { recursive: true, force: true }));
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' tests passed.');
process.exitCode = failed > 0 ? 1 : 0;
