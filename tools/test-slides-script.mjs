// Tests for deploy/scripts/slides-sync.sh and deploy/scripts/install-slides.sh.
// The tools they use on the Mini (curl, pdftoppm, flock, timeout, id,
// systemctl) are replaced with small fake ones in a temporary folder, so
// nothing touches the network or the machine. jq is the real one, because the
// scripts depend on what it does, so this test needs jq installed.
//
//   node tools/test-slides-script.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const syncFile = path.join(repo, 'deploy/scripts/slides-sync.sh');
const installFile = path.join(repo, 'deploy/scripts/install-slides.sh');
const unitFiles = ['teletraan-slides.service', 'teletraan-slides.timer'];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-slides-'));

// The tools the scripts need that are not the ones being faked
const ordinaryTools = ['sed', 'tail', 'head', 'grep', 'find', 'mktemp', 'mv', 'rm', 'mkdir', 'date', 'dirname', 'basename', 'cat', 'cp', 'wc', 'tr', 'ls'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

// A fake curl. It writes each call it gets to calls.log, then answers by the
// address: the list of talks from the stub folder for Sanity, and for a deck
// the file <deck>.body, or the exit code in <deck>.exit.
const fakeCurl = `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
output=""
previous=""
for argument in "$@"; do
  [ "$previous" = --output ] && output=$argument
  previous=$argument
done

case $argument in
  https://*.api.sanity.io/*)
    [ -f "$STUB_DIR/sanity.exit" ] && exit "$(cat "$STUB_DIR/sanity.exit")"
    cp "$STUB_DIR/sanity.json" "$output"
    ;;
  https://docs.google.com/presentation/d/*/export/pdf)
    deck=\${argument#https://docs.google.com/presentation/d/}
    deck=\${deck%/export/pdf}
    [ -f "$STUB_DIR/$deck.exit" ] && exit "$(cat "$STUB_DIR/$deck.exit")"
    cp "$STUB_DIR/$deck.body" "$output"
    ;;
  *) exit 6 ;;
esac
`;

// A fake pdftoppm. It makes STUB_PAGES pictures, or fewer if it is told a last
// page, and numbers them the way the real one does: with as many digits as
// the deck has pages, so page-1.jpg or page-01.jpg or page-001.jpg.
const fakePdftoppm = `#!/bin/sh
echo "pdftoppm $*" >> "$STUB_LOG"
[ "$STUB_PDFTOPPM" = fail ] && exit 1

total=\${STUB_PAGES:-3}
last=$total
previous=""
for argument in "$@"; do
  [ "$previous" = -l ] && last=$argument
  previous=$argument
done
[ "$last" -gt "$total" ] && last=$total

width=\${#total}
number=1
while [ "$number" -le "$last" ]; do
  printf 'picture %s' "$number" > "$argument-$(printf "%0\${width}d" "$number").jpg"
  number=$((number + 1))
done
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// Makes a copy of the deploy folder and config.js to run in, a folder of tools
// to run with, and returns how to run the scripts.
function setup(name, options) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  const temp = path.join(root, 'tmp');
  fs.mkdirSync(path.join(root, 'deploy/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'deploy/systemd'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  [bin, stub, temp].forEach(folder => fs.mkdirSync(folder));
  if (!options.noData) fs.mkdirSync(data);

  [syncFile, installFile].forEach(file => {
    const copy = path.join(root, 'deploy/scripts', path.basename(file));
    fs.copyFileSync(file, copy);
    fs.chmodSync(copy, fs.statSync(file).mode);
  });
  unitFiles.forEach(unit => fs.copyFileSync(path.join(repo, 'deploy/systemd', unit), path.join(root, 'deploy/systemd', unit)));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));
  if (!options.noEnv) {
    fs.writeFileSync(path.join(root, 'deploy/local.env'), "TELETRAAN_DATA='" + data + "'\nCALENDAR_TEAM_URL='" + secret + "'\n");
  }

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));

  if (options.tools) {
    fs.symlinkSync(findTool('jq'), path.join(bin, 'jq'));
    writeTool(bin, 'curl', fakeCurl);
    writeTool(bin, 'pdftoppm', fakePdftoppm);
    writeTool(bin, 'flock', '#!/bin/sh\necho "flock $*" >> "$STUB_LOG"\n[ "$STUB_LOCKED" != yes ]\n');
    writeTool(bin, 'timeout', '#!/bin/sh\necho "timeout $1" >> "$STUB_LOG"\nshift\nexec "$@"\n');
  }
  if (options.install) {
    writeTool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && echo "$STUB_UID"\nexit 0\n');
    writeTool(bin, 'systemctl', '#!/bin/sh\necho "systemctl $*" >> "$STUB_LOG"\n');
    writeTool(bin, 'apt', '#!/bin/sh\necho "apt $*" >> "$STUB_LOG"\n');
    writeTool(bin, 'apt-get', '#!/bin/sh\necho "apt-get $*" >> "$STUB_LOG"\n');
  }

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  const slides = path.join(data, 'slides');

  const place = {
    root: root,
    slides: slides,
    temp: temp,
    log: log,
    run(args, extra) {
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, TMPDIR: temp, STUB_UID: '1000' }, extra || {});
      const result = spawnSync('/bin/sh', [path.join(root, 'deploy/scripts/slides-sync.sh')].concat(args || []), { env: env, encoding: 'utf8', input: '', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    install(extra) {
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, TMPDIR: temp, STUB_UID: '1000' }, extra || {});
      const result = spawnSync('/bin/sh', [path.join(root, 'deploy/scripts/install-slides.sh')], { env: env, encoding: 'utf8', input: '\n', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    // What Sanity answers: the list of talks
    sanity(talks) {
      fs.writeFileSync(path.join(stub, 'sanity.json'), JSON.stringify({ query: 'stub', result: talks }));
      fs.rmSync(path.join(stub, 'sanity.exit'), { force: true });
    },
    // What Google answers for a deck: 'pdf' for a PDF, 'page' for a web page
    // to sign in, or the exit code curl gives
    deck(id, kind) {
      fs.rmSync(path.join(stub, id + '.exit'), { force: true });
      if (typeof kind === 'number') {
        fs.writeFileSync(path.join(stub, id + '.exit'), String(kind));
        return;
      }
      const body = kind === 'pdf' ? '%PDF-1.7\nthe deck\n' : '<!doctype html><title>Sign in</title>';
      fs.writeFileSync(path.join(stub, id + '.body'), body);
    },
    stub: stub,
    folder(id) {
      return path.join(slides, id);
    },
    files(id) {
      return fs.existsSync(this.folder(id)) ? fs.readdirSync(this.folder(id)).sort() : null;
    },
    manifest(id) {
      return JSON.parse(fs.readFileSync(path.join(this.folder(id), 'manifest.json'), 'utf8'));
    },
    downloads() {
      return (fs.readFileSync(log, 'utf8').match(/export\/pdf/g) || []).length;
    },
  };
  return place;
}

const secret = 'https://band.example/SECRET-FEED-TOKEN';
const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const deckA = 'ABCDEFGHIJ123';
const deckB = 'KLMNOPQRST456';

// A talk as the query in slides-sync.sh answers it
function talk(id, deck, startsIn, extra) {
  return Object.assign({
    _id: id,
    status: 'scheduled',
    minutes: 15,
    deckLink: 'https://docs.google.com/presentation/d/' + deck + '/edit?usp=sharing',
    startsIn: startsIn,
  }, extra || {});
}

function pageNames(count) {
  return Array.from({ length: count }, (item, index) => String(index + 1).padStart(3, '0') + '.jpg');
}

function agePastRetry(place, id) {
  const old = new Date(Date.now() - 10 * 60 * 1000);
  fs.utimesSync(path.join(place.folder(id), 'manifest.json'), old, old);
}

test('a talk that is due gets its pictures numbered 001, 002 and 003, and a manifest', () => {
  const place = setup('due', { tools: true });
  place.sanity([talk('talk-a', deckA, 3600)]);
  place.deck(deckA, 'pdf');
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(place.files('talk-a'), ['.deck', '001.jpg', '002.jpg', '003.jpg', 'manifest.json']);
  assert.equal(fs.readFileSync(path.join(place.folder('talk-a'), '.deck'), 'utf8'), deckA + '\n');

  const manifest = place.manifest('talk-a');
  assert.deepEqual(Object.keys(manifest), ['ok', 'pages', 'fetchedAt', 'refreshed']);
  assert.equal(manifest.ok, true);
  assert.deepEqual(manifest.pages, ['001.jpg', '002.jpg', '003.jpg']);
  assert.match(manifest.fetchedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(manifest.refreshed, false);
  assert.ok(result.text.includes('talk talk-a: 3 slides saved'), result.text);

  assert.deepEqual(fs.readdirSync(place.slides).sort(), ['.lock', 'talk-a'], 'no work folder is left behind');
  assert.ok((fs.statSync(place.folder('talk-a')).mode & 0o055) === 0o055, 'the web server must be able to read the folder');
  assert.ok((fs.statSync(path.join(place.folder('talk-a'), 'manifest.json')).mode & 0o044) === 0o044);
});

test('the pictures keep the order of the pages when the deck has 12 or 80 pages', () => {
  const twelve = setup('twelve', { tools: true });
  twelve.sanity([talk('talk-a', deckA, 3600)]);
  twelve.deck(deckA, 'pdf');
  twelve.run([], { STUB_PAGES: '12' });

  assert.deepEqual(twelve.manifest('talk-a').pages, pageNames(12));
  assert.equal(fs.readFileSync(path.join(twelve.folder('talk-a'), '001.jpg'), 'utf8'), 'picture 1');
  assert.equal(fs.readFileSync(path.join(twelve.folder('talk-a'), '010.jpg'), 'utf8'), 'picture 10');
  assert.equal(fs.readFileSync(path.join(twelve.folder('talk-a'), '012.jpg'), 'utf8'), 'picture 12');

  const eighty = setup('eighty', { tools: true });
  eighty.sanity([talk('talk-a', deckA, 3600)]);
  eighty.deck(deckA, 'pdf');
  const result = eighty.run([], { STUB_PAGES: '80' });

  assert.ok(result.calls.includes('-f 1 -l 60 '), 'pdftoppm is told the last page');
  assert.deepEqual(eighty.manifest('talk-a').pages, pageNames(60));
  assert.deepEqual(eighty.files('talk-a').filter(name => name.endsWith('.jpg')), pageNames(60));
  assert.ok(eighty.files('talk-a').every(name => !name.startsWith('page-')), 'no picture keeps its first name');
});

test('only scheduled talks from 30 minutes ago to 36 hours ahead are downloaded, and a bad id or link is skipped', () => {
  const place = setup('window', { tools: true });
  place.sanity([
    talk('inside', deckA, 3600),
    talk('far-end', deckA, 129500),
    talk('just-started', deckA, -1700),
    talk('too-far', deckA, 129700),
    talk('long-started', deckA, -1900),
    talk('cancelled', deckA, 3600, { status: 'cancelled' }),
    talk('done', deckA, 3600, { status: 'done' }),
    talk('no-start', deckA, null),
    talk('not-slides', deckA, 3600, { deckLink: 'https://example.org/deck/' + deckA }),
    talk('no-link', deckA, 3600, { deckLink: null }),
    talk('../evil', deckA, 3600),
    talk('drafts.inside', deckA, 3600),
    talk('has space', deckA, 3600),
  ]);
  place.deck(deckA, 'pdf');
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(fs.readdirSync(place.slides).sort(), ['.lock', 'far-end', 'inside', 'just-started']);
  assert.equal(place.downloads(), 3);
  assert.ok(result.text.includes('talk not-slides: the slides link is not a Google Slides link, skipped'), result.text);
  assert.ok(result.text.includes('talk no-link: the slides link is not a Google Slides link, skipped'), result.text);
  assert.ok(!fs.existsSync(path.join(place.root, 'data/evil')) && !fs.existsSync(path.join(place.root, 'evil')));
});

test('only a strict deck id reaches a download: nothing from a link is ever run or used as a path', () => {
  const place = setup('strict', { tools: true });
  const prefix = 'https://docs.google.com/presentation/d/';
  place.sanity([
    talk('ok-edit', deckA, 3600),
    talk('ok-plain', deckA, 3600, { deckLink: prefix + deckA }),
    talk('ok-slide', deckA, 3600, { deckLink: prefix + deckA + '/edit#slide=id.p' }),
    talk('shell', deckA, 3600, { deckLink: prefix + 'abc$(touch PWNED)defghijkl/edit' }),
    talk('shell-two', deckA, 3600, { deckLink: prefix + 'ABCDEFGHIJ123;touch PWNED/edit' }),
    talk('short', deckA, 3600, { deckLink: prefix + 'short/edit' }),
    talk('published', deckA, 3600, { deckLink: prefix + 'e/2PACX-1vTabcdefghij/pub' }),
    talk('plain-http', deckA, 3600, { deckLink: 'http://docs.google.com/presentation/d/' + deckA }),
    talk('other-host', deckA, 3600, { deckLink: 'https://docs.google.com.example.org/presentation/d/' + deckA }),
    talk('inside-text', deckA, 3600, { deckLink: 'https://example.org/?x=' + prefix + deckA }),
    talk('dots', deckA, 3600, { deckLink: prefix + 'ABCDEFGHIJ..123/edit' }),
    talk('line-break', deckA, 3600, { deckLink: prefix + deckA + '\n/edit' }),
  ]);
  place.deck(deckA, 'pdf');
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(fs.readdirSync(place.slides).sort().filter(name => name !== '.lock'), ['ok-edit', 'ok-plain', 'ok-slide']);
  assert.equal(place.downloads(), 3);
  assert.ok(!result.calls.includes('PWNED') && !result.calls.includes('$('), 'no unchecked text reaches a command');
  assert.ok(!fs.existsSync(path.join(place.root, 'PWNED')));
  const addresses = result.calls.match(/https:\/\/docs\.google\.com\/\S*/g);
  assert.deepEqual(new Set(addresses), new Set(['https://docs.google.com/presentation/d/' + deckA + '/export/pdf']));
});

test('the download is https only, follows redirects, gives up after 90 seconds and 40 MB, and keeps no cookies or login', () => {
  const place = setup('flags', { tools: true });
  place.sanity([talk('talk-a', deckA, 3600)]);
  place.deck(deckA, 'pdf');
  const result = place.run();
  const download = result.calls.split('\n').filter(line => line.includes('export/pdf'))[0];

  assert.ok(download.includes('https://docs.google.com/presentation/d/' + deckA + '/export/pdf'));
  ['--location', '--max-redirs 5', "--proto =https", '--proto-redir =https', '--max-time 90', '--max-filesize 40000000'].forEach(flag => {
    assert.ok(download.includes(flag), 'the download should use ' + flag + '\n' + download);
  });
  assert.ok(download.startsWith('curl --disable '), 'curl ignores the settings file of the account');
  assert.ok(!/cookie|authorization|bearer|token|--user/i.test(result.calls), 'no cookie or login is sent');
  assert.ok(!result.calls.includes('SECRET') && !result.text.includes('SECRET'), 'the calendar address is never read');

  assert.ok(result.calls.includes('timeout 120'), 'the conversion has a time limit');
  assert.ok(result.calls.includes('pdftoppm -jpeg -jpegopt quality=85 -scale-to-x 1920 -scale-to-y -1 '), result.calls);
});

test('the talks are asked from the project, dataset and version in config.js, without a login and without drafts', () => {
  const place = setup('sanity', { tools: true });
  place.sanity([]);
  const result = place.run();
  const config = fs.readFileSync(path.join(repo, 'dashboard/config.js'), 'utf8');
  const project = config.match(/projectId: '([^']*)'/)[1];
  const dataset = config.match(/dataset: '([^']*)'/)[1];
  const version = config.match(/apiVersion: '([^']*)'/)[1];

  assert.equal(result.status, 0, result.errors);
  assert.ok(result.calls.includes('https://' + project + '.api.sanity.io/v' + version + '/data/query/' + dataset), 'the ordinary host, not the cached one');
  assert.ok(result.calls.includes('perspective=published'));
  assert.ok(result.calls.includes('query=*[_type == "presentation" && !(_id in path("drafts.**"))]'), result.calls);
  assert.ok(result.calls.includes('--data-urlencode'), 'curl does the encoding of the query');
  assert.ok(result.calls.includes('--proto =https'));
  assert.ok(!/authorization|bearer|token/i.test(result.calls), 'no login is sent');

  const script = fs.readFileSync(syncFile, 'utf8');
  [project, dataset, version].forEach(value => {
    assert.ok(!script.includes(value), 'the script should not contain ' + value);
  });
});

test('a deck that is not shared, too slow, too big, or will not convert leaves a failed manifest and no pictures', () => {
  const cases = [
    { name: 'sign-in page', set: place => place.deck(deckA, 'page'), error: 'not shared' },
    { name: 'timeout', set: place => place.deck(deckA, 28), error: 'the download took too long' },
    { name: 'too-big', set: place => place.deck(deckA, 63), error: 'the deck is too big' },
    { name: 'no-network', set: place => place.deck(deckA, 6), error: 'could not reach Google' },
    { name: 'other-code', set: place => place.deck(deckA, 56), error: 'the download failed' },
    { name: 'convert', set: place => place.deck(deckA, 'pdf'), env: { STUB_PDFTOPPM: 'fail' }, error: 'could not make pictures' },
    { name: 'empty', set: place => place.deck(deckA, 'pdf'), env: { STUB_PAGES: '0' }, error: 'the deck has no pages' },
  ];

  cases.forEach(item => {
    const place = setup('failed-' + item.name, { tools: true });
    place.sanity([talk('talk-a', deckA, 3600)]);
    item.set(place);
    const result = place.run([], item.env);

    assert.equal(result.status, 1, item.name);
    assert.deepEqual(place.files('talk-a'), ['.deck', 'manifest.json'], item.name);
    const manifest = place.manifest('talk-a');
    assert.deepEqual(Object.keys(manifest), ['ok', 'error', 'fetchedAt'], item.name);
    assert.equal(manifest.ok, false);
    assert.equal(manifest.error, item.error, item.name);
    assert.match(manifest.fetchedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.ok(result.text.includes('talk talk-a: no slides, ' + item.error), item.name + '\n' + result.text);
  });
});

test('one bad deck does not stop the others', () => {
  const place = setup('one-bad', { tools: true });
  place.sanity([talk('bad', deckA, 3600), talk('good', deckB, 3600)]);
  place.deck(deckA, 'page');
  place.deck(deckB, 'pdf');
  const result = place.run();

  assert.equal(result.status, 1, 'the failing exit shows in systemctl status');
  assert.equal(place.manifest('bad').ok, false);
  assert.equal(place.manifest('good').ok, true);
});

test('a deck is downloaded once, a failed one is tried again after a minute, and a recovered one replaces the failed manifest', () => {
  const place = setup('retry', { tools: true });
  place.sanity([talk('talk-a', deckA, 7200)]);
  place.deck(deckA, 'page');

  place.run();
  assert.equal(place.downloads(), 1);

  place.run();
  assert.equal(place.downloads(), 1, 'a failure from the last minute is left alone');

  agePastRetry(place, 'talk-a');
  place.deck(deckA, 28);
  place.run();
  assert.equal(place.downloads(), 2, 'an older failure is tried again');
  assert.equal(place.manifest('talk-a').error, 'the download took too long');

  agePastRetry(place, 'talk-a');
  place.deck(deckA, 'pdf');
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.equal(place.downloads(), 3);
  assert.deepEqual(place.files('talk-a'), ['.deck', '001.jpg', '002.jpg', '003.jpg', 'manifest.json']);
  assert.equal(place.manifest('talk-a').ok, true);

  place.run();
  place.run();
  assert.equal(place.downloads(), 3, 'a good deck is not downloaded again');
});

test('a good deck is downloaded once more when the talk is 20 minutes away or less, and then marked refreshed', () => {
  const place = setup('refresh', { tools: true });
  place.deck(deckA, 'pdf');

  place.sanity([talk('talk-a', deckA, 7200)]);
  place.run();
  assert.equal(place.manifest('talk-a').refreshed, false);

  place.sanity([talk('talk-a', deckA, 1300)]);
  place.run();
  assert.equal(place.downloads(), 1, 'at 21 minutes it is too early');

  place.sanity([talk('talk-a', deckA, 1100)]);
  place.run();
  assert.equal(place.downloads(), 2);
  assert.equal(place.manifest('talk-a').refreshed, true);

  place.sanity([talk('talk-a', deckA, 600)]);
  place.run();
  place.sanity([talk('talk-a', deckA, -300)]);
  place.run();
  assert.equal(place.downloads(), 2, 'once is enough');
});

test('a deck is not replaced once its talk has started', () => {
  const place = setup('started', { tools: true });
  place.sanity([talk('talk-a', deckA, 7200)]);
  place.deck(deckA, 'pdf');
  place.run();

  place.sanity([talk('talk-a', deckA, -60)]);
  place.run();
  assert.equal(place.downloads(), 1);
  assert.equal(place.manifest('talk-a').refreshed, false);
});

test('a first download made less than 20 minutes before the talk counts as the refresh', () => {
  const place = setup('late-first', { tools: true });
  place.sanity([talk('talk-a', deckA, 600)]);
  place.deck(deckA, 'pdf');

  place.run();
  assert.equal(place.manifest('talk-a').refreshed, true);
  place.run();
  assert.equal(place.downloads(), 1);
});

test('when the second download fails the deck from before stays, and a corrected link brings the new deck', () => {
  const place = setup('keep', { tools: true });
  place.sanity([talk('talk-a', deckA, 7200)]);
  place.deck(deckA, 'pdf');
  place.run();
  const before = place.manifest('talk-a');

  place.sanity([talk('talk-a', deckA, 600)]);
  place.deck(deckA, 28);
  const failed = place.run();
  assert.equal(failed.status, 1);
  assert.deepEqual(place.manifest('talk-a'), before, 'the manifest from before is untouched');
  assert.deepEqual(place.files('talk-a'), ['.deck', '001.jpg', '002.jpg', '003.jpg', 'manifest.json']);
  assert.ok(failed.text.includes('Keeping the ones from before'), failed.text);

  place.sanity([talk('talk-a', deckB, 7200)]);
  place.deck(deckB, 'pdf');
  const corrected = place.run([], { STUB_PAGES: '5' });
  assert.equal(corrected.status, 0, corrected.errors);
  assert.equal(fs.readFileSync(path.join(place.folder('talk-a'), '.deck'), 'utf8'), deckB + '\n');
  assert.deepEqual(place.manifest('talk-a').pages, pageNames(5));
  assert.ok(corrected.calls.includes('/d/' + deckB + '/export/pdf'));
});

test('folders of talks that ended over 24 hours ago, or are not in Sanity any more, are removed, and the rest stay', () => {
  const place = setup('cleanup', { tools: true });
  place.sanity([
    talk('ended-long-ago', deckA, -88000),
    talk('ended-yesterday', deckA, -86000),
    talk('ended-cancelled', deckA, -7200, { status: 'cancelled' }),
    talk('no-start', deckA, null),
    talk('next-month', deckA, 2600000),
    talk('longer-talk', deckA, -87000, { minutes: 30 }),
  ]);
  ['ended-long-ago', 'ended-yesterday', 'ended-cancelled', 'no-start', 'next-month', 'longer-talk', 'deleted-talk', 'gone with space'].forEach(id => {
    fs.mkdirSync(place.folder(id), { recursive: true });
    fs.writeFileSync(path.join(place.folder(id), 'manifest.json'), '{}');
  });
  fs.mkdirSync(path.join(place.slides, '.work.interrupted'));
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(fs.readdirSync(place.slides).sort(), ['.lock', 'ended-cancelled', 'ended-yesterday', 'longer-talk', 'next-month', 'no-start']);
  assert.ok(result.text.includes('talk deleted-talk: slides removed'), result.text);
  assert.ok(result.text.includes('talk ended-long-ago: slides removed'), result.text);
});

test('nothing is deleted or changed when Sanity cannot be asked or does not answer with a list of talks', () => {
  const answers = [
    { name: 'no-network', set: place => fs.writeFileSync(path.join(place.stub, 'sanity.exit'), '6') },
    { name: 'error', set: place => fs.writeFileSync(path.join(place.stub, 'sanity.json'), JSON.stringify({ error: { description: 'query problem' } })) },
    { name: 'web-page', set: place => fs.writeFileSync(path.join(place.stub, 'sanity.json'), '<html>Sorry</html>') },
    { name: 'no-list', set: place => fs.writeFileSync(path.join(place.stub, 'sanity.json'), JSON.stringify({ result: null })) },
  ];

  answers.forEach(item => {
    const place = setup('no-list-' + item.name, { tools: true });
    place.sanity([]);
    item.set(place);
    fs.mkdirSync(place.folder('old-talk'), { recursive: true });
    fs.writeFileSync(path.join(place.folder('old-talk'), 'manifest.json'), '{}');
    const result = place.run();

    assert.equal(result.status, 1, item.name);
    assert.ok(result.errors.includes('Nothing was changed'), item.name);
    assert.deepEqual(place.files('old-talk'), ['manifest.json'], item.name);
    assert.equal(place.downloads(), 0, item.name);
  });
});

test('a run that finds the lock taken stops at once and changes nothing', () => {
  const place = setup('locked', { tools: true });
  place.sanity([talk('talk-a', deckA, 3600)]);
  place.deck(deckA, 'pdf');
  const result = place.run([], { STUB_LOCKED: 'yes' });

  assert.equal(result.status, 0);
  assert.ok(result.text.includes('still going'), result.text);
  assert.ok(result.calls.includes('flock -n 9'), 'the lock is asked for without waiting');
  assert.ok(!result.calls.includes('curl'), 'nothing is downloaded');
  assert.deepEqual(fs.readdirSync(place.slides), ['.lock']);
});

test('--test downloads one deck into a temporary folder, prints pages and sizes, and deletes everything', () => {
  const place = setup('try', { tools: true, noData: true, noEnv: true });
  place.deck(deckA, 'pdf');
  const link = 'https://docs.google.com/presentation/d/' + deckA + '/edit?usp=sharing';
  const result = place.run(['--test', link], { STUB_PAGES: '4' });

  assert.equal(result.status, 0, result.errors);
  assert.match(result.text, /^OK {4}4 pages, \d+ KB as a PDF, \d+ KB as pictures\n$/);
  assert.deepEqual(fs.readdirSync(place.temp), [], 'the temporary folder is gone');
  assert.ok(!fs.existsSync(path.join(place.root, 'data')), 'the data folder is not used');
  assert.ok(!result.calls.includes('flock') && !result.calls.includes('sanity'), 'no lock, and Sanity is not asked');
  assert.equal(place.downloads(), 1);
});

test('--test says why a deck failed, rejects a link that is not a deck, and always cleans up', () => {
  const place = setup('try-fail', { tools: true, noData: true, noEnv: true });
  const link = 'https://docs.google.com/presentation/d/' + deckA + '/edit';

  place.deck(deckA, 'page');
  const notShared = place.run(['--test', link]);
  assert.equal(notShared.status, 1);
  assert.equal(notShared.text, 'FAIL  not shared\n');

  place.deck(deckA, 28);
  const slow = place.run(['--test', link]);
  assert.equal(slow.status, 1);
  assert.equal(slow.text, 'FAIL  the download took too long\n');

  place.deck(deckA, 'pdf');
  const convert = place.run(['--test', link], { STUB_PDFTOPPM: 'fail' });
  assert.equal(convert.text, 'FAIL  could not make pictures\n');

  const downloads = place.downloads();
  ['https://example.org/' + deckA, 'https://docs.google.com/presentation/d/short', 'https://docs.google.com/presentation/d/' + deckA + ';touch PWNED', 'nonsense'].forEach(bad => {
    const result = place.run(['--test', bad]);
    assert.equal(result.status, 1, bad);
    assert.ok(result.text.startsWith('FAIL  that is not a Google Slides link'), bad + '\n' + result.text);
  });
  assert.equal(place.downloads(), downloads, 'nothing is downloaded for a bad link');
  assert.ok(!fs.existsSync(path.join(place.root, 'PWNED')));

  assert.deepEqual(fs.readdirSync(place.temp), [], 'the temporary folder is gone after every try');
});

test('--test without a link, or any other word, prints how to use it and changes nothing', () => {
  const place = setup('usage', { tools: true });
  const bare = place.run(['--test']);
  assert.equal(bare.status, 1);
  assert.ok(bare.errors.includes('Give the link of the deck after --test.'));

  const other = place.run(['--now']);
  assert.equal(other.status, 1);
  assert.ok(other.errors.includes('Usage:'));
  assert.ok(!fs.existsSync(place.slides));
  assert.equal(fs.readFileSync(place.log, 'utf8'), '');
});

test('with a tool missing the script says which, prints the apt line and changes nothing', () => {
  const place = setup('bare', { tools: false });
  const result = place.run();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('The curl command is missing'), result.errors);
  assert.ok(result.errors.includes('  sudo apt install poppler-utils curl jq\n'));
  assert.ok(!fs.existsSync(place.slides));
});

test('with no data folder the script stops with a plain line and downloads nothing', () => {
  const place = setup('no-data', { tools: true, noData: true });
  place.sanity([talk('talk-a', deckA, 3600)]);
  const result = place.run();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('The data folder ' + path.join(place.root, 'data') + ' does not exist'), result.errors);
  assert.equal(fs.readFileSync(place.log, 'utf8'), '');
});

test('the scripts have valid sh syntax, are executable, and never print or read the calendar addresses', () => {
  [syncFile, installFile].forEach(file => {
    const syntax = spawnSync('/bin/sh', ['-n', file], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
    if (fs.existsSync('/bin/dash')) {
      const dash = spawnSync('/bin/dash', ['-n', file], { encoding: 'utf8' });
      assert.equal(dash.status, 0, dash.stderr);
    }

    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith('#!/bin/sh\n'));
    assert.ok(/^set -eu$/m.test(text), 'the script stops at the first error');
    assert.ok((fs.statSync(file).mode & 0o111) !== 0, path.basename(file) + ' should be executable');
    assert.ok(!/\bcat\b[^\n]*local\.env/.test(text), 'local.env is never printed');
    assert.ok(!/\beval\b/.test(text), 'nothing is run from text');
    assert.ok(!/CALENDAR_/.test(text), 'the calendar addresses are not read');
  });
});

test('the unit files name the account ACCOUNT, run the script, and the timer runs every 2 minutes and 1 minute after boot', () => {
  const service = fs.readFileSync(path.join(repo, 'deploy/systemd/teletraan-slides.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'deploy/systemd/teletraan-slides.timer'), 'utf8');

  assert.deepEqual(service.match(/^User=.*$/gm), ['User=ACCOUNT']);
  assert.ok(/^Type=oneshot$/m.test(service));
  assert.ok(/^ExecStart=\/opt\/teletraan\/deploy\/scripts\/slides-sync\.sh$/m.test(service));
  assert.ok(fs.existsSync(syncFile), 'the script the unit runs exists');
  assert.ok(/^OnBootSec=1min$/m.test(timer));
  assert.ok(/^OnUnitActiveSec=2min$/m.test(timer));
  assert.ok(/^WantedBy=timers\.target$/m.test(timer));
  assert.ok(!/hawktimus/i.test(service + timer), 'no account name is written in the unit files');
});

test('install-slides.sh stops, naming the file, when a unit file is missing or empty', () => {
  const missing = setup('install-missing', { tools: true, install: true });
  fs.rmSync(path.join(missing.root, 'deploy/systemd/teletraan-slides.service'));
  const first = missing.install();
  assert.equal(first.status, 1);
  assert.ok(first.errors.includes('teletraan-slides.service is missing or empty'), first.errors);

  const empty = setup('install-empty', { tools: true, install: true });
  fs.writeFileSync(path.join(empty.root, 'deploy/systemd/teletraan-slides.timer'), '');
  const second = empty.install();
  assert.equal(second.status, 1);
  assert.ok(second.errors.includes('teletraan-slides.timer is missing or empty'), second.errors);

  [first, second].forEach(result => assert.ok(!result.calls.includes('systemctl'), 'nothing was changed'));
});

test('install-slides.sh prints the apt line when a package is missing, and never runs apt', () => {
  const place = setup('install-packages', { tools: false, install: true });
  fs.symlinkSync(findTool('jq'), path.join(place.root, 'bin/jq'));
  const result = place.install();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('These packages are not installed: poppler-utils curl'), result.errors);
  assert.ok(result.errors.includes('  sudo apt install poppler-utils curl jq\n'));
  assert.ok(!result.calls.includes('apt') && !result.calls.includes('systemctl'), result.calls);
});

test('install-slides.sh with everything in place still needs sudo and the repository at /opt/teletraan before it changes anything', () => {
  const place = setup('install-checks', { tools: true, install: true });
  const plain = place.install({ STUB_UID: '1000' });
  assert.equal(plain.status, 1);
  assert.ok(plain.errors.includes('it has to run with sudo'), plain.errors);

  const root = place.install({ STUB_UID: '0' });
  assert.equal(root.status, 1);
  assert.ok(root.errors.includes('The unit files expect the repository at /opt/teletraan'), root.errors);
  assert.ok(!root.calls.includes('systemctl') && !root.calls.includes('apt'));
});

let failures = 0;
try {
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
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
