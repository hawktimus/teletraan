// The control page on a phone: nothing heavy loads by itself, the page paints without its stylesheet, nothing
// reloads the page on its own, and the stylesheets keep the sizes a thumb and iOS need.
//
//   node tests/control-mobile.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { previewAutoLoads, previewCardHtml } from '../control/static/tabs/render.js';
import { cacheControl, etagOf, isFresh, staticHeaders } from '../control/lib/static-files.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');
const staticFiles = ['control/static/index.html', 'control/static/login.html', 'computer/nginx/landing.html'];
const scripts = fs.readdirSync(repo + 'control/static').filter(name => name.endsWith('.js')).map(name => 'control/static/' + name)
  .concat(fs.readdirSync(repo + 'control/static/tabs').filter(name => name.endsWith('.js')).map(name => 'control/static/tabs/' + name));

test('every page has the phone viewport and keeps clear of the notch', () => {
  staticFiles.forEach(name => assert.ok(read(name).includes('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'), name));
  assert.ok(read('control/static/style.css').includes('env(safe-area-inset-left)') && read('control/static/style.css').includes('env(safe-area-inset-bottom)'));
  assert.ok(read('computer/nginx/landing.html').includes('env(safe-area-inset-top)'));
});

test('the live preview has no frame in the markup, a button of its own, and loads by itself only from 900px', () => {
  const html = previewCardHtml();
  assert.ok(!html.includes('<iframe') && !/ src=/.test(html));
  assert.ok(html.includes('Show live preview'));
  assert.equal(previewAutoLoads(390), false);
  assert.equal(previewAutoLoads(899), false);
  assert.equal(previewAutoLoads(900), true);
  assert.equal(previewAutoLoads(1920), true);
});

test('the frame is made on demand, lazy, in a 16 by 9 box, and taken out on leaving the tab and on the background', () => {
  const now = read('control/static/tabs/now.js');
  const preview = read('control/static/tabs/preview.js');
  assert.ok(preview.includes("createElement('iframe')") && preview.includes("frame.loading = 'lazy'"));
  assert.ok(preview.includes("'visibilitychange'") && preview.includes('document.hidden') && preview.includes('frame.remove()'));
  assert.ok(now.includes('return leave;'), 'the tab hands back a function that removes the frame');
  assert.ok(/aspect-ratio: 16 \/ 9/.test(read('control/static/tabs/tabs.css')));
  assert.ok(read('control/static/app.js').includes('Promise.resolve(result)'), 'an async tab is still told when it is left');
  assert.ok(read('control/static/tabs/health.js').includes('clearInterval(timer)'));
});

test('no script reloads the page on a timer, and no page has a meta refresh', () => {
  const found = scripts.filter(name => /location\.reload|location\.href\s*=|location\.assign|location\.replace/.test(read(name)));
  // a lost sign-in (401) and a good sign-in are the only reasons to reload
  assert.deepEqual(found.sort(), ['control/static/api.js', 'control/static/github-card.js', 'control/static/login.js', 'control/static/tabs/settings-update.js']);
  scripts.filter(name => (name.includes('/tabs/') || name.endsWith('app.js')) && !name.endsWith('settings-update.js')).forEach(name => assert.ok(!/location\./.test(read(name).replace(/location\.hash/g, '').replace(/location\.hash\.slice/g, '')), name));
  staticFiles.forEach(name => assert.ok(!/http-equiv=["']refresh/i.test(read(name)), name));
  scripts.forEach(name => {
    const text = read(name);
    if (/setInterval\(/.test(text)) assert.ok(!/setInterval\([^)]*(replaceChildren|location)/.test(text), name);
  });
});

test('index and login paint dark and readable before style.css, and say what to do if the script does not start', () => {
  ['control/static/index.html', 'control/static/login.html'].forEach(name => {
    const text = read(name);
    assert.ok(text.indexOf('<style>') > -1 && text.indexOf('<style>') < text.indexOf('<link rel="stylesheet" href="style.css">'), name + ': the inline style comes first, so style.css wins');
    assert.ok(text.includes('background: #1d1a24') && text.includes('background: #6c18b6') && text.includes('#faca2a'), name);
    assert.ok(text.includes('<noscript>'), name);
  });
  const index = read('control/static/index.html');
  assert.ok(index.includes('class="boot"') && index.includes('href="./">reload it</a>'));
  assert.ok(index.includes('<link id="tabs-css" rel="stylesheet" href="tabs/tabs.css">'));
});

test('the stylesheets keep 16px fields, 44px targets, wrapping text and no cut labels', () => {
  const style = read('control/static/style.css');
  const tabs = read('control/static/tabs/tabs.css');
  assert.ok(/input\[type="text"\][^{]*\{[^}]*min-height: 44px[^}]*font: 18px/.test(style));
  assert.ok(/\.tab select, \.tab input \{[^}]*min-height: 44px[^}]*font: inherit/.test(tabs));
  assert.ok(/button\.action, label\.action \{[^}]*min-height: 44px/.test(style) && /\.studio, button\.help \{[^}]*min-height: 44px/.test(style));
  assert.ok(/nav \{[^}]*flex-wrap: wrap/.test(style), 'the tabs wrap, they are not cut');
  assert.ok(/pre \{[^}]*white-space: pre-wrap/.test(style) && /\.log \{[^}]*white-space: pre-wrap/.test(tabs));
  assert.ok(style.includes('overflow-wrap: anywhere') && tabs.includes('overflow-wrap: anywhere'));
  [style, tabs].forEach(css => {
    assert.ok(!/text-overflow:\s*ellipsis/.test(css), 'no cut text');
    const sizes = [...css.matchAll(/font(?:-size)?:\s*(?:[0-9a-z-]+\s+)?(\d+)px/g)].map(found => Number(found[1]));
    assert.ok(sizes.every(size => size >= 16), 'no text under 16px: ' + sizes.filter(size => size < 16));
  });
  assert.ok(!/<table/.test(read('control/static/tabs/render.js')), 'no table to squeeze');
});

test('the placeholders of the inputs are short enough not to be cut', () => {
  const html = read('control/static/tabs/render.js');
  [...html.matchAll(/placeholder="([^"]+)"/g)].forEach(found => assert.ok(found[1].length <= 16, found[1]));
});

test('scripts and stylesheets are kept but asked about, pages are never kept, fonts last a week, and the types are right', () => {
  assert.equal(cacheControl('.html'), 'no-store');
  assert.equal(cacheControl('.js'), 'no-cache');
  assert.equal(cacheControl('.css'), 'no-cache');
  assert.equal(cacheControl('.woff2'), 'max-age=604800');
  const css = staticHeaders('x/style.css', Buffer.from('a{}'));
  assert.equal(css['Content-Type'], 'text/css; charset=utf-8');
  assert.ok(css.ETag && css['X-Content-Type-Options'] === 'nosniff');
  assert.equal(staticHeaders('x/app.js', Buffer.from('1'))['Content-Type'], 'text/javascript; charset=utf-8');
  assert.equal(staticHeaders('x/f.woff2', Buffer.from('1'))['Content-Type'], 'font/woff2');
  assert.equal(staticHeaders('x/index.html', Buffer.from('1')).ETag, undefined);
  const tag = etagOf(Buffer.from('a{}'));
  assert.equal(isFresh({ 'if-none-match': tag }, tag), true);
  assert.equal(isFresh({ 'if-none-match': 'W/' + tag }, tag), true);
  assert.equal(isFresh({ 'if-none-match': '"other"' }, tag), false);
  assert.equal(isFresh({}, tag), false);
  assert.ok(read('control/server.js').includes('isFresh(req.headers') && read('control/server.js').includes('res.writeHead(304'));
});

test('nginx adds the same words to /control/ as the service, so the two headers never disagree', () => {
  const nginx = read('computer/nginx/nginx.conf');
  assert.ok(nginx.includes('default "no-store";') && nginx.includes('~\\.(html|js|mjs|css)$ "no-cache";') && nginx.includes('max-age=604800'));
  assert.ok(nginx.includes('font/woff2 woff2;') && nginx.includes('text/css css;') && nginx.includes('text/javascript js mjs;'));
});

finish();
