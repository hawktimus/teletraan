// Tests for computer/scripts/news-sync.sh, news-rss.awk, install-news.sh and the news job of status-write.sh. The tools they use
// on the Teletraan computer (curl, date, flock, id, systemctl) are replaced with small fake ones in a
// temporary folder, so nothing touches the network or the machine. jq and awk are the real
// ones, because the reading of the feed depends on what they do. The feeds are made up
// (tests/data/news-feed.xml and news-odd-feed.xml, and some built here). The token is made up too.
//
//   node tests/news-sync.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const scripts = ['news-sync.sh', 'news-rss.awk', 'install-news.sh', 'status-write.sh', 'lib.sh'];
const unitFiles = ['teletraan-news.service', 'teletraan-news.timer'];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-news-'));
const token = 'skTESTtoken0123456789abcdef';
const feedAddress = 'https://community.firstinspires.org/rss.xml';

const ordinaryTools = ['sed', 'tail', 'head', 'grep', 'mktemp', 'mv', 'rm', 'mkdir', 'dirname', 'basename', 'cat', 'cp', 'tr', 'stat', 'cut', 'sort'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// A fake curl. Every call goes to calls.log, but never what comes in on standard input: that is the
// token, and it goes to configs.txt in the stub folder. Sanity answers a question from sanity.json
// and keeps what is written in mutations/<number>.json. The feed comes from feed.xml, with the
// status from feed.code, and feed.exit makes curl fail with that exit code.
const fakeCurl = `#!/bin/sh
printf '%s\\n' "$(printf 'curl %s' "$*" | tr '\\n' ' ')" >> "$STUB_LOG"
output=""
body=""
body_text=""
write_out=""
address=""
previous=""
for argument in "$@"; do
  case $previous in
    --output) output=$argument ;;
    --data-binary) body=\${argument#@} ;;
    --data) body_text=$argument ;;
    --write-out) write_out=$argument ;;
  esac
  case $argument in
    https://*) address=$argument ;;
  esac
  previous=$argument
done
case " $* " in
  *" --config - "*)
    cat >> "$STUB_DIR/configs.txt"
    echo "--" >> "$STUB_DIR/configs.txt"
    ;;
esac
case $address in
  https://*.api.sanity.io/*/data/query/*)
    [ -f "$STUB_DIR/sanity.exit" ] && exit "$(cat "$STUB_DIR/sanity.exit")"
    if [ -n "$output" ]; then cp "$STUB_DIR/sanity.json" "$output"; else cat "$STUB_DIR/sanity.json"; fi
    exit 0
    ;;
  https://*.api.sanity.io/*/data/mutate/*)
    count=$(cat "$STUB_DIR/mutations.count" 2> /dev/null || echo 0)
    count=$((count + 1))
    echo "$count" > "$STUB_DIR/mutations.count"
    mkdir -p "$STUB_DIR/mutations"
    if [ -n "$body" ]; then cp "$body" "$STUB_DIR/mutations/$count.json"; else printf '%s' "$body_text" > "$STUB_DIR/mutations/$count.json"; fi
    [ -f "$STUB_DIR/mutate.exit" ] && exit "$(cat "$STUB_DIR/mutate.exit")"
    exit 0
    ;;
  ${feedAddress})
    [ -f "$STUB_DIR/feed.exit" ] && exit "$(cat "$STUB_DIR/feed.exit")"
    code=200
    [ -f "$STUB_DIR/feed.code" ] && code=$(cat "$STUB_DIR/feed.code")
    cp "$STUB_DIR/feed.xml" "$output"
    [ -n "$write_out" ] && printf '%s' "$code"
    exit 0
    ;;
  *) exit 6 ;;
esac
`;

const fakeDate = `#!/bin/sh
echo "date $*" >> "$STUB_LOG"
for argument in "$@"; do
  format=$argument
done
case $format in
  +%s) echo "$STUB_EPOCH" ;;
  *) echo "$STUB_UTC" ;;
esac
`;

function setup(name, options) {
  const settings = options || {};
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  const temp = path.join(root, 'tmp');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'computer/systemd'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  [bin, stub, temp].forEach(folder => fs.mkdirSync(folder));
  fs.mkdirSync(data);

  scripts.forEach(file => {
    const from = path.join(repo, 'computer/scripts', file);
    fs.copyFileSync(from, path.join(root, 'computer/scripts', file));
    fs.chmodSync(path.join(root, 'computer/scripts', file), fs.statSync(from).mode);
  });
  unitFiles.forEach(unit => fs.copyFileSync(path.join(repo, 'computer/systemd', unit), path.join(root, 'computer/systemd', unit)));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));

  const env = settings.env !== undefined ? settings.env : "TELETRAAN_DATA='" + data + "'\nSANITY_WRITE_TOKEN='" + token + "'\n";
  fs.writeFileSync(path.join(root, 'computer/local.env'), env);

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  ['jq', 'awk'].forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  writeTool(bin, 'curl', fakeCurl);
  writeTool(bin, 'date', fakeDate);
  writeTool(bin, 'flock', '#!/bin/sh\necho "flock $*" >> "$STUB_LOG"\n[ "$STUB_LOCKED" != yes ]\n');
  writeTool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && echo "$STUB_UID"\nexit 0\n');
  writeTool(bin, 'systemctl', '#!/bin/sh\necho "systemctl $*" >> "$STUB_LOG"\n');
  writeTool(bin, 'apt', '#!/bin/sh\necho "apt $*" >> "$STUB_LOG"\n');

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');

  const place = {
    root, data, stub, log,
    news: path.join(data, 'news'),
    feed(text, code) {
      fs.writeFileSync(path.join(stub, 'feed.xml'), text);
      if (code) fs.writeFileSync(path.join(stub, 'feed.code'), String(code));
    },
    // What Sanity answers to the one question about the settings
    settings(answer) {
      fs.writeFileSync(path.join(stub, 'sanity.json'), JSON.stringify({ ms: 1, query: 'stub', result: answer }));
    },
    run(args, extra) {
      fs.writeFileSync(log, '');
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, TMPDIR: temp, STUB_UID: '1000', STUB_UTC: '2026-10-19T12:00:00Z', STUB_EPOCH: String(Date.parse('2026-10-19T12:00:00Z') / 1000) }, extra || {});
      const result = spawnSync('/bin/sh', [path.join(root, 'computer/scripts/news-sync.sh')].concat(args || []), { env, encoding: 'utf8', input: '', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    status(args, extra) {
      fs.writeFileSync(log, '');
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, TMPDIR: temp, STUB_UTC: '2026-10-19T12:00:00Z', STUB_EPOCH: String(Date.parse('2026-10-19T12:00:00Z') / 1000) }, extra || {});
      const result = spawnSync('/bin/sh', [path.join(root, 'computer/scripts/status-write.sh')].concat(args), { env, encoding: 'utf8', input: '', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    install(extra) {
      fs.writeFileSync(log, '');
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, TMPDIR: temp, STUB_UID: '1000' }, extra || {});
      const result = spawnSync('/bin/sh', [path.join(root, 'computer/scripts/install-news.sh')], { env, encoding: 'utf8', input: '\n', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    mutations() {
      const folder = path.join(stub, 'mutations');
      return fs.existsSync(folder) ? fs.readdirSync(folder).length : 0;
    },
    mutation(number) {
      return JSON.parse(fs.readFileSync(path.join(stub, 'mutations', (number || this.mutations()) + '.json'), 'utf8')).mutations;
    },
    document(number) {
      return this.mutation(number)[0].createOrReplace;
    },
    configs() {
      const file = path.join(stub, 'configs.txt');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    },
  };
  place.feed(fs.readFileSync(path.join(repo, 'tests/data/news-feed.xml'), 'utf8'));
  place.settings({});
  return place;
}

function awkRows(file) {
  const result = spawnSync('awk', ['-f', path.join(repo, 'computer/scripts/news-rss.awk')], { input: fs.readFileSync(file, 'utf8'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function feedOf(items) {
  return '<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>' + items.join('') + '</channel></rss>';
}

function itemOf(title, date, categories) {
  const when = new Date(date).toUTCString();
  return '<item><title>' + title + '</title><link>https://news.example.test/' + encodeURIComponent(title.slice(0, 20)) + date + '</link>' +
    categories.map(name => '<category>' + name + '</category>').join('') + '<pubDate>' + when + '</pubDate></item>';
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test('the reader takes only the children of an item and decodes the text', () => {
  const rows = awkRows(path.join(repo, 'tests/data/news-odd-feed.xml'));
  assert.ok(rows.includes('title\tCDATA title with <b>tag</b> & ampersand\n'), 'a CDATA title is kept as written');
  assert.ok(!rows.includes('Channel title is not an item'), 'the channel title is not an item title');
  assert.ok(!rows.includes('Hidden in a comment'), 'a comment is skipped');
  assert.ok(!rows.includes('Fake title inside a description'), 'a title inside CDATA of a description is not read');
  assert.ok(rows.includes('link\thttps://news.example.test/cdata\n'), 'a link is trimmed');
  assert.ok(rows.includes('category\tcontrol system\n'), 'spaces inside a category are folded');
  assert.ok(rows.includes('&unknown;'), 'an unknown entity stays as written');
  assert.ok(rows.includes('&#8217;\n'), 'an escaped ampersand is decoded once and not twice');
  assert.equal(rows.split('\n').filter(line => line === 'item').length, 5, 'five items, the comment one left out');
});

test('a dry run prints the headlines of the feed, newest first, without the text', () => {
  const place = setup('dry');
  const result = place.run(['--dry-run']);
  assert.equal(result.status, 0, result.errors);
  const document = JSON.parse(result.text);
  assert.equal(document._id, 'frc-news');
  assert.equal(document._type, 'frcNews');
  assert.equal(document.lastSyncAt, '2026-10-19T12:00:00Z');
  assert.deepEqual(document.items.map(item => item.title), ['Sample Systemcore item two', 'Sample feed item three']);
  assert.ok(!result.text.includes('MARKER'), 'no description and no article text');
  assert.equal(place.mutations(), 0, 'a dry run writes nothing');
  assert.equal(place.configs(), '', 'a dry run sends no token');
});

test('the default categories keep FRC and Control System and leave out the rest', () => {
  const place = setup('default');
  const document = JSON.parse(place.run(['--dry-run']).text);
  assert.deepEqual(document.items.map(item => item.link), ['https://news.example.test/two', 'https://news.example.test/three']);
  assert.deepEqual(document.hiddenItems, []);
});

test('an item has a title, link, ISO date, categories, systemcore and source', () => {
  const place = setup('shape');
  const document = JSON.parse(place.run(['--dry-run']).text);
  const second = document.items.find(item => item.link.endsWith('/two'));
  assert.deepEqual(second, {
    title: 'Sample Systemcore item two',
    link: 'https://news.example.test/two',
    date: '2026-09-23T19:17:55Z',
    categories: ['Control System', 'FRC', 'FTC'],
    systemcore: true,
    source: 'FIRST',
  });
  const third = document.items.find(item => item.link.endsWith('/three'));
  assert.equal(third.systemcore, false);
  assert.deepEqual(document.items.map(item => item.date), ['2026-09-23T19:17:55Z', '2026-09-22T20:20:25Z']);
});

test('systemcore is found in the categories and in two words, in any case', () => {
  const place = setup('systemcore');
  place.feed(feedOf([
    itemOf('SYSTEM CORE news', '2026-10-01T00:00:00Z', ['FRC']),
    itemOf('Nothing about it', '2026-10-02T00:00:00Z', ['FRC', 'Systemcore']),
    itemOf('Plain headline', '2026-10-03T00:00:00Z', ['FRC']),
  ]));
  const items = JSON.parse(place.run(['--dry-run']).text).items;
  assert.deepEqual(items.map(item => item.systemcore), [false, true, true]);
});

test('settings choose the categories, case does not matter, and an empty list means the default', () => {
  const place = setup('categories');
  place.settings({ newsCategories: ['featured', ' KICKOFF '] });
  const chosen = JSON.parse(place.run(['--dry-run']).text).items.map(item => item.link.split('/').pop());
  assert.deepEqual(chosen, ['one', 'four']);
  place.settings({ newsCategories: [] });
  const empty = JSON.parse(place.run(['--dry-run']).text).items.map(item => item.link.split('/').pop());
  assert.deepEqual(empty, ['two', 'three']);
  place.settings({ newsCategories: 'FRC' });
  assert.deepEqual(JSON.parse(place.run(['--dry-run']).text).items.map(item => item.link.split('/').pop()), ['two', 'three']);
});

test('hidden links leave items and go to hiddenItems, and the next ones fill the list', () => {
  const place = setup('hidden');
  place.settings({ newsHiddenLinks: ['https://news.example.test/two', 7, null] });
  const document = JSON.parse(place.run(['--dry-run']).text);
  assert.deepEqual(document.items.map(item => item.link.split('/').pop()), ['three']);
  assert.deepEqual(document.hiddenItems.map(item => item.link.split('/').pop()), ['two']);
});

test('the newest ten are kept and the feed is read for no more than sixty items', () => {
  const place = setup('many');
  const items = [];
  for (let day = 1; day <= 75; day += 1) items.push(itemOf('Headline number ' + day, '2026-09-' + String((day % 28) + 1).padStart(2, '0') + 'T' + String(day % 24).padStart(2, '0') + ':00:00Z', ['FRC']));
  place.feed(feedOf(items));
  const document = JSON.parse(place.run(['--dry-run']).text);
  assert.equal(document.items.length, 10);
  const dates = document.items.map(item => item.date);
  assert.deepEqual(dates, dates.slice().sort().reverse());
});

test('a title is cut to 140 characters at a word, and tags and entities are tidied', () => {
  const place = setup('title');
  const long = Array.from({ length: 40 }, (_, index) => 'word' + index).join(' ');
  place.feed(feedOf([
    itemOf(long, '2026-10-01T00:00:00Z', ['FRC']),
    itemOf('Plain &amp; &lt;i&gt;tidy&lt;/i&gt; &#8217;s &#x2014; end', '2026-10-02T00:00:00Z', ['FRC']),
  ]));
  const items = JSON.parse(place.run(['--dry-run']).text).items;
  const cut = items.find(item => item.title.startsWith('word0'));
  assert.ok(cut.title.length <= 140, 'length ' + cut.title.length);
  assert.ok(cut.title.endsWith('...'));
  assert.ok(/ word\d+\.\.\.$/.test(cut.title), 'the cut is at a word: ' + cut.title);
  const tidy = items.find(item => item.title.startsWith('Plain'));
  assert.equal(tidy.title, 'Plain & tidy ’s — end');
});

test('odd feeds: CDATA, CRLF, offsets, a missing date or link, numeric entities', () => {
  const place = setup('odd');
  place.feed(fs.readFileSync(path.join(repo, 'tests/data/news-odd-feed.xml'), 'utf8'));
  const items = JSON.parse(place.run(['--dry-run']).text).items;
  assert.deepEqual(items.map(item => item.title), [
    'CDATA title with tag & ampersand',
    'Entities & things: \u2019quoted\u2019 \u2014 dash gap &unknown; &#8217;',
    'Only a date line, with a fraction',
  ]);
  const byLink = Object.fromEntries(items.map(item => [item.link.split('/').pop(), item]));
  assert.equal(byLink.cdata.date, '2026-10-05T06:30:00Z', 'an offset of +0200 is taken off');
  assert.equal(byLink.entities.date, '2026-10-05T04:10:00Z', 'EST is five hours behind');
  assert.equal(byLink.fraction.date, '2026-10-03T10:00:00Z', 'a fraction of a second is dropped');
  assert.equal(byLink.entities.title, 'Entities & things: ’quoted’ — dash gap &unknown; &#8217;');
  assert.equal(byLink.cdata.title, 'CDATA title with tag & ampersand');
  assert.deepEqual(byLink.cdata.categories, ['FRC', 'control system']);
  assert.ok(!byLink.nodate && !('' in byLink), 'an item with no date or no link is left out');
  assert.equal(items.length, 3);
});

test('a feed with no matching category writes an empty list and no error', () => {
  const place = setup('empty');
  place.feed(feedOf([itemOf('Only FTC', '2026-10-01T00:00:00Z', ['FTC'])]));
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  const document = place.document();
  assert.deepEqual(document.items, []);
  assert.ok(!('lastError' in document));
  assert.equal(place.mutations(), 1);
});

test('a run writes one frc-news document with the token on standard input only', () => {
  const place = setup('write');
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.equal(place.mutations(), 1);
  const mutations = place.mutation();
  assert.equal(mutations.length, 1);
  const document = mutations[0].createOrReplace;
  assert.equal(document._id, 'frc-news');
  assert.equal(document._type, 'frcNews');
  assert.equal(document.lastSyncAt, '2026-10-19T12:00:00Z');
  assert.deepEqual(Object.keys(document).sort(), ['_id', '_type', 'hiddenItems', 'items', 'lastSyncAt']);
  document.items.forEach(item => assert.deepEqual(Object.keys(item).sort(), ['categories', 'date', 'link', 'source', 'systemcore', 'title']));
  assert.ok(place.configs().includes('Bearer ' + token), 'the token goes in on standard input');
  assert.ok(!result.calls.includes(token) && !result.text.includes(token) && !result.errors.includes(token), 'the token is never on a command line or printed');
  assert.ok(!JSON.stringify(document).includes('MARKER'), 'no description and no article text');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(place.news, 'status.json'), 'utf8')), { at: '2026-10-19T12:00:00Z', count: 2 });
  assert.match(result.calls, /--proto =https/);
  assert.match(result.calls, /--user-agent Teletraan-I/);
});

test('a feed that cannot be reached keeps the old list and writes lastError in plain words', () => {
  const place = setup('down');
  fs.writeFileSync(path.join(place.stub, 'feed.exit'), '6');
  const result = place.run();
  assert.equal(result.status, 1);
  assert.equal(place.mutations(), 1);
  const mutations = place.mutation();
  assert.ok(!mutations.some(mutation => mutation.createOrReplace), 'the list is not replaced');
  assert.ok(mutations[0].createIfNotExists);
  assert.equal(mutations[1].patch.id, 'frc-news');
  assert.deepEqual(Object.keys(mutations[1].patch.set), ['lastError']);
  assert.match(mutations[1].patch.set.lastError, /Could not read the FIRST community blog, could not find the server/);
  assert.match(mutations[1].patch.set.lastError, /last good one/);
  assert.ok(!fs.existsSync(path.join(place.news, 'status.json')), 'no time is reported for a failed run');
});

test('an answer that is not 200, an HTML page and an empty feed all keep the old list', () => {
  const cases = [
    ['code', '<rss/>', 503, /answered with 503/],
    ['html', '<!doctype html><html><body>Maintenance</body></html>', 200, /had no items/],
    ['channel', '<rss><channel><title>x</title></channel></rss>', 200, /had no items/],
    ['cut', '<rss><channel><item><title>Cut off', 200, /none with a headline/],
  ];
  cases.forEach(([name, body, code, pattern]) => {
    const place = setup('bad-' + name);
    place.feed(body, code);
    const result = place.run();
    assert.equal(result.status, 1, name);
    const mutations = place.mutation();
    assert.ok(!mutations.some(mutation => mutation.createOrReplace), name);
    assert.match(mutations[1].patch.set.lastError, pattern, name);
  });
});

test('news turned off in Settings reads nothing and writes nothing', () => {
  const place = setup('off');
  place.settings({ newsEnabled: false });
  const result = place.run();
  assert.equal(result.status, 0);
  assert.match(result.text, /turned off/);
  assert.equal(place.mutations(), 0);
  assert.ok(!result.calls.includes(feedAddress));
});

test('with no token, a placeholder or a bad token it stops before any request', () => {
  const none = setup('no-token', { env: "TELETRAAN_DATA='x'\n" });
  const first = none.run();
  assert.equal(first.status, 0);
  assert.match(first.text, /SANITY_WRITE_TOKEN is not in local.env/);
  assert.equal(first.calls, '');
  const placeholder = setup('placeholder-token', { env: "SANITY_WRITE_TOKEN='[paste it here]'\n" });
  assert.equal(placeholder.run().status, 0);
  const bad = setup('bad-token', { env: "SANITY_WRITE_TOKEN='has space and \"quote'\n" });
  const third = bad.run();
  assert.equal(third.status, 1);
  assert.match(third.errors, /does not look like a token/);
  assert.equal(third.calls, '');
});

test('when Sanity cannot be asked, nothing is read or written', () => {
  const place = setup('sanity-down');
  fs.writeFileSync(path.join(place.stub, 'sanity.exit'), '7');
  const result = place.run();
  assert.equal(result.status, 1);
  assert.match(result.errors, /Could not get the settings from Sanity/);
  assert.ok(!result.calls.includes(feedAddress));
  assert.equal(place.mutations(), 0);
});

test('a refused write says the token may be wrong, and a second run at the same time stops', () => {
  const place = setup('refused');
  fs.writeFileSync(path.join(place.stub, 'mutate.exit'), '22');
  const result = place.run();
  assert.equal(result.status, 1);
  assert.match(result.errors, /Sanity refused the list, so the token may be wrong/);
  assert.ok(!fs.existsSync(path.join(place.news, 'status.json')));
  const busy = setup('busy');
  const second = busy.run([], { STUB_LOCKED: 'yes' });
  assert.equal(second.status, 0);
  assert.match(second.text, /still going/);
  assert.equal(busy.mutations(), 0);
});

test('status-write.sh news sends the time and the count of the last good run, and only those', () => {
  const place = setup('status');
  const quiet = place.status(['news']);
  assert.equal(quiet.status, 0, 'no run has reported yet');
  assert.equal(place.mutations(), 0);
  place.run();
  const result = place.status(['news']);
  assert.equal(result.status, 0, result.errors);
  const mutations = place.mutation();
  assert.equal(mutations[0].createIfNotExists._id, 'status-mini');
  assert.deepEqual(mutations[1].patch.set, { newsAt: '2026-10-19T12:00:00Z', newsCount: 2 });
  assert.ok(!result.calls.includes(token));
  fs.writeFileSync(path.join(place.news, 'status.json'), '{"at":"yesterday","count":"many"}\n');
  const damaged = place.status(['news']);
  assert.equal(damaged.status, 1);
  assert.match(damaged.errors, /not the line news-sync\.sh writes/);
});

test('status-write.sh --print shows the last news read, the usage names news, and the news document is not a content update', () => {
  const place = setup('status-print');
  place.settings({ lastContentSeenAt: '2026-10-19T11:00:00Z', newsAt: '2026-10-19T10:00:00Z' });
  const printed = place.status(['--print']);
  assert.equal(printed.status, 0, printed.errors);
  assert.match(printed.text, /Last news read\s+2 hours ago/);
  assert.match(place.status(['wrong']).errors, /photos-drive\|news\|reboot\|restart N/);
  const text = fs.readFileSync(path.join(repo, 'computer/scripts/status-write.sh'), 'utf8');
  assert.ok(text.includes('"frcStatus", "frcNews"]'), 'the news document is left out of the newest change');
});

test('the script has a Usage line, strict mode and an argument check', () => {
  const place = setup('usage');
  const result = place.run(['--wrong']);
  assert.equal(result.status, 1);
  assert.match(result.errors, /Usage: .*news-sync\.sh \[--dry-run\]/);
  const text = fs.readFileSync(path.join(repo, 'computer/scripts/news-sync.sh'), 'utf8');
  assert.match(text, /^#!\/bin\/bash\n# Usage: news-sync\.sh/);
  assert.match(text, /\nset -euo pipefail\n/);
  assert.ok(!/--header ['"]?Authorization/.test(text.replace(/printf 'header = "Authorization: Bearer %s"/, '')), 'the token is not in a curl argument');
});

test('the unit files run the script every 2 hours and report to Studio afterwards', () => {
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-news.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-news.timer'), 'utf8');
  assert.match(service, /^User=ACCOUNT$/m);
  assert.match(service, /^ExecStart=\/opt\/teletraan\/computer\/scripts\/news-sync\.sh$/m);
  assert.match(service, /^ExecStartPost=-\/opt\/teletraan\/computer\/scripts\/status-write\.sh news$/m);
  assert.match(timer, /^OnUnitActiveSec=2h$/m);
  assert.match(timer, /^OnBootSec=/m);
  assert.match(timer, /WantedBy=timers\.target/);
});

test('install-news.sh copies the units, turns the timer on and installs no package', () => {
  const place = setup('install');
  fs.mkdirSync(path.join(place.root, 'opt'), { recursive: true });
  const refused = place.install({ STUB_UID: '1000' });
  assert.equal(refused.status, 1);
  assert.match(refused.errors, /has to run with sudo|expects the repository at/);
  assert.ok(!/apt/.test(refused.calls));
  const text = fs.readFileSync(path.join(repo, 'computer/scripts/install-news.sh'), 'utf8');
  assert.match(text, /teletraan-news\.service/);
  assert.match(text, /systemctl enable --now teletraan-news\.timer/);
  assert.match(text, /sudo apt install curl jq/);
  assert.ok(!/^\s*(apt|apt-get)\s+install/m.test(text), 'it prints the apt line and never runs it');
});

let failed = 0;
for (const entry of tests) {
  try {
    entry.run();
    console.log('ok   ' + entry.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL ' + entry.name + '\n     ' + String(error.message).split('\n').join('\n     '));
  }
}
fs.rmSync(work, { recursive: true, force: true });
if (failed) {
  console.log(failed + ' of ' + tests.length + ' failed');
  process.exit(1);
}
console.log('news-sync.test.mjs: ' + tests.length + ' checks passed');
