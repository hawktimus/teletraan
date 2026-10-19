// Tests for the FRC news section of the Competition page (studio/inputs/news-section.js, news-parts.js) and the two
// types behind it (schemas/frcNews.js, schemas/settingsNews.js): the headlines listed with a Show switch each, the
// switches and the categories written to the draft of Dashboard Settings and nothing else, and the words. The
// headlines and the addresses are made up.
//
//   node tests/studio-news.test.mjs

import assert from 'node:assert/strict';
import { openStudio, nodesWhere, wordsIn, fakeClient } from './helpers/studio-world.mjs';
import { defaultSettings } from '../dashboard/config.js';

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const studio = await openStudio();
const view = await studio.load('inputs/competition-view.js');
const parts = await studio.load('inputs/news-parts.js');
const section = await studio.load('inputs/news-section.js');
const settingsType = (await studio.load('schemas/dashboardSettings.js')).default;
const newsType = (await studio.load('schemas/frcNews.js')).default;
const newsFields = await studio.load('schemas/settingsNews.js');
const structure = await studio.load('structure.js');
const config = (await studio.load('sanity.config.js')).default;

const item = (name, date, extra) => Object.assign({ title: '[' + name + ']', link: 'https://news.example.test/' + name, date: date, categories: ['FRC'], systemcore: false, source: 'FIRST' }, extra);
const feed = {
  _id: 'frc-news',
  _type: 'frcNews',
  lastSyncAt: new Date(Date.now() - 5 * 60000).toISOString(),
  items: [item('older', '2026-09-23T19:17:55Z', { systemcore: true }), item('newest', '2026-10-09T14:00:02Z'), item('middle', '2026-09-30T13:00:00Z')],
  hiddenItems: [item('hidden-one', '2026-10-01T10:00:00Z')],
};

// A client with the settings draft and the news document. The news question gets its own answer.
function clientWith(settings, news, failNews) {
  const client = fakeClient(settings ? [settings] : []);
  const ask = client.fetch;
  client.fetch = async (query, params, options) => {
    if (query === parts.newsQuestion) {
      if (failNews) throw new Error('offline');
      return news === undefined ? null : news;
    }
    return ask(query, params, options);
  };
  return client;
}

const published = extra => Object.assign({ _id: 'dashboardSettings', _type: 'dashboardSettings', competitionMode: 'auto', motion: 'calm' }, extra || {});

async function pageWith(settings, news, failNews) {
  globalThis.studioClient = clientWith(settings, news, failNews);
  const page = studio.mount(view.CompetitionView);
  await page.settle();
  return page;
}

const switchOf = (page, name) => nodesWhere(page.tree(), node => node.props && node.props['data-news'] === name)[0];
const lastPatch = () => globalThis.studioClient.calls.filter(call => call.patch).pop();

test('the section lists the headlines and the hidden ones, newest first, with a Show switch each and the note', async () => {
  const page = await pageWith(published({ newsHiddenLinks: ['https://news.example.test/hidden-one'] }), feed);
  const rows = nodesWhere(page.tree(), node => node.props && node.props['data-headline']);
  assert.deepEqual(rows.map(row => row.props['data-headline'].split('/').pop()), ['newest', 'hidden-one', 'middle', 'older']);
  const checks = rows.map(row => nodesWhere(row, node => node.type === 'input')[0].props.checked);
  assert.deepEqual(checks, [true, false, true, true], 'the draft says which one is hidden');
  const words = wordsIn(page.tree());
  assert.match(words, /Headlines only\. The text stays on FIRST's site\./);
  assert.match(words, /Oct 9/);
  assert.match(words, /SystemCore/);
  assert.match(words, /Hidden/);
  assert.match(words, /Last read 5 minutes ago/);
  assert.match(words, /Last error None/);
});

test('the Competition page keeps its own rows, and the news rows are not among them', async () => {
  const page = await pageWith(published(), feed);
  const rows = nodesWhere(page.tree(), node => node.props && node.props['data-field']).map(node => node.props['data-field']);
  assert.ok(rows.every(name => name.indexOf('news') === -1));
  assert.ok(nodesWhere(page.tree(), node => node.props && node.props['data-block'] === 'news').length === 1);
});

test('turning a headline off writes only the hidden list to the draft, and turning it on takes it out', async () => {
  const page = await pageWith(published(), feed);
  const row = nodesWhere(page.tree(), node => node.props && node.props['data-headline'] === 'https://news.example.test/middle')[0];
  nodesWhere(row, node => node.type === 'input')[0].props.onChange({ target: { checked: false } });
  await page.settle();
  const patch = lastPatch();
  assert.equal(patch.patch, 'drafts.dashboardSettings');
  assert.deepEqual(patch.set, { newsHiddenLinks: ['https://news.example.test/middle'] });
  assert.equal(globalThis.studioClient.stored['drafts.dashboardSettings'].motion, 'calm', 'the draft keeps every other value');
  assert.equal(globalThis.studioClient.calls.filter(call => call.publish).length, 0);

  const again = nodesWhere(page.tree(), node => node.props && node.props['data-headline'] === 'https://news.example.test/middle')[0];
  assert.equal(nodesWhere(again, node => node.type === 'input')[0].props.checked, false, 'the switch shows the change at once');
  nodesWhere(again, node => node.type === 'input')[0].props.onChange({ target: { checked: true } });
  await page.settle();
  assert.deepEqual(lastPatch().unset, ['newsHiddenLinks'], 'an empty list is taken out of the draft');
});

test('the switches write one field each, and Read FRC news off says what happens', async () => {
  const page = await pageWith(published(), feed);
  nodesWhere(switchOf(page, 'newsInTicker'), node => node.type === 'input')[0].props.onChange({ target: { checked: true } });
  await page.settle();
  assert.deepEqual(lastPatch().set, { newsInTicker: true });
  nodesWhere(switchOf(page, 'newsEnabled'), node => node.type === 'input')[0].props.onChange({ target: { checked: false } });
  await page.settle();
  assert.deepEqual(lastPatch().set, { newsEnabled: false });
  assert.match(wordsIn(page.tree()), /Read FRC news is off, so the TV shows no headlines and the computer reads nothing\./);
  const on = nodesWhere(switchOf(page, 'newsInTicker'), node => node.type === 'input')[0];
  assert.equal(on.props.checked, true);
});

test('categories: the starting two show, one is added and removed, and the last removed goes back to the starting two', async () => {
  const page = await pageWith(published(), feed);
  const chips = () => nodesWhere(page.tree(), node => node.props && node.props['data-category']).map(node => node.props['data-category']);
  assert.deepEqual(chips(), ['FRC', 'Control System']);
  assert.match(wordsIn(page.tree()), /the starting two are used/);

  const box = nodesWhere(page.tree(), node => node.type === 'input' && node.props.id === 'news-new-category')[0];
  box.props.onChange({ target: { value: ' Kickoff ' } });
  await page.settle();
  nodesWhere(page.tree(), node => node.props && node.props['data-news-add'] === 'category')[0].props.onClick();
  await page.settle();
  assert.deepEqual(lastPatch().set, { newsCategories: ['FRC', 'Control System', 'Kickoff'] });
  assert.deepEqual(chips(), ['FRC', 'Control System', 'Kickoff']);

  const remove = name => nodesWhere(page.tree(), node => node.type === 'button' && node.props['aria-label'] === 'Remove ' + name)[0].props.onClick();
  remove('Kickoff');
  await page.settle();
  remove('FRC');
  await page.settle();
  remove('Control System');
  await page.settle();
  assert.deepEqual(lastPatch().unset, ['newsCategories']);
});

test('a category that is empty, repeated, too long or one too many is refused with a plain line', async () => {
  const page = await pageWith(published({ newsCategories: ['FRC'] }), feed);
  const add = text => {
    nodesWhere(page.tree(), node => node.type === 'input' && node.props.id === 'news-new-category')[0].props.onChange({ target: { value: text } });
    return page.settle().then(() => {
      nodesWhere(page.tree(), node => node.props && node.props['data-news-add'] === 'category')[0].props.onClick();
      return page.settle();
    });
  };
  const patches = () => globalThis.studioClient.calls.filter(call => call.patch).length;
  await add('   ');
  assert.match(wordsIn(page.tree()), /Type a category first\./);
  await add('frc');
  assert.match(wordsIn(page.tree()), /already in the list/);
  await add('x'.repeat(31));
  assert.match(wordsIn(page.tree()), /up to 30 characters/);
  assert.equal(patches(), 0, 'nothing was written');
  assert.deepEqual(parts.addedCategory(Array.from({ length: 12 }, (_, at) => 'c' + at), 'one more').problem, parts.words.categoryProblems.many);
});

test('the hidden list keeps at most 100 and refuses another', () => {
  const full = Array.from({ length: 100 }, (_, at) => 'https://news.example.test/' + at);
  assert.equal(parts.changedHidden(full, 'https://news.example.test/new', true).problem, parts.words.tooManyHidden);
  assert.equal(parts.changedHidden(full, 'https://news.example.test/5', false).list.length, 99);
  assert.deepEqual(parts.changedHidden(['a'], 'b', true).list, ['a', 'b']);
  assert.deepEqual(parts.changedHidden(['a', 'b'], 'a', true).list, ['b', 'a'], 'hiding twice does not repeat it');
});

test('the rows come from both lists, once each, and a headline with no address cannot be hidden', () => {
  const rows = parts.rowsOf({ items: [item('a', '2026-10-01T00:00:00Z'), { title: '[No address]', date: '2026-10-02T00:00:00Z' }, item('a', '2026-10-01T00:00:00Z')], hiddenItems: [item('b', '2026-10-03T00:00:00Z')] }, { newsHiddenLinks: ['https://news.example.test/b'] });
  assert.deepEqual(rows.map(row => [row.link.split('/').pop(), row.hidden]), [['b', true], ['a', false]]);
  assert.deepEqual(parts.rowsOf(null, null), []);
  assert.deepEqual(parts.rowsOf({ items: 'x' }, {}), []);
});

test('no document, a document with no headlines and a read that fails each say so, and the page still opens', async () => {
  const none = await pageWith(published(), undefined);
  assert.match(wordsIn(none.tree()), /No headlines yet\./);
  assert.match(wordsIn(none.tree()), /Last read Not yet/);
  const empty = await pageWith(published(), { lastSyncAt: feed.lastSyncAt, items: [], hiddenItems: [] });
  assert.match(wordsIn(empty.tree()), /No headlines yet\./);
  const failed = await pageWith(published(), feed, true);
  assert.match(wordsIn(failed.tree()), /The headlines could not be read\. Refresh the page to try again\./);
  assert.ok(nodesWhere(failed.tree(), node => node.props && node.props['data-block'] === 'cards').length === 1, 'the cards are still there');
});

test('the last error is shown in the words the computer wrote', async () => {
  const page = await pageWith(published(), Object.assign({}, feed, { lastError: 'Could not read the FIRST community blog, the server took too long to answer.' }));
  assert.match(wordsIn(page.tree()), /Last error Could not read the FIRST community blog, the server took too long to answer\./);
});

test('Dashboard Settings that was never published says to publish it first', async () => {
  const page = await pageWith(null, feed);
  assert.match(wordsIn(page.tree()), /Open it, click Publish once, and come back\./);
});

test('the four settings fields have starting values that match config.js, one line descriptions, and are hidden in Dashboard Settings', () => {
  const fields = Object.fromEntries(newsFields.newsFields().map(field => [field.name, field]));
  assert.deepEqual(Object.keys(fields), parts.newsNames);
  assert.equal(fields.newsEnabled.initialValue, true);
  assert.equal(defaultSettings.newsEnabled, true);
  assert.equal(fields.newsInTicker.initialValue, false);
  assert.equal(defaultSettings.newsInTicker, false);
  assert.deepEqual(fields.newsCategories.initialValue, defaultSettings.newsCategories);
  assert.deepEqual(parts.startingCategories, defaultSettings.newsCategories);
  assert.deepEqual(newsFields.startingNewsCategories, defaultSettings.newsCategories);
  Object.values(fields).forEach(field => {
    assert.ok(field.description && field.description.indexOf('\n') === -1 && !/[–—!]/.test(field.description), field.name);
    assert.equal(typeof field.validation === 'function' || field.type === 'boolean', true);
  });
  parts.newsNames.forEach(name => {
    const stored = settingsType.fields.find(field => field.name === name);
    assert.ok(stored && stored.hidden === true && stored.group === 'advanced', name + ' is hidden in Advanced');
  });
});

test('frcNews is written by the computer: read only, out of search, the sidebar and the New menu, no field required, no article text field', () => {
  assert.equal(newsType.name, 'frcNews');
  assert.equal(newsType.readOnly, true);
  assert.equal(newsType.__experimental_omnisearch_visibility, false);
  assert.deepEqual(newsType.fields.map(field => field.name), ['lastSyncAt', 'lastError', 'items', 'hiddenItems']);
  const itemFields = newsType.fields.find(field => field.name === 'items').of[0].fields.map(field => field.name);
  assert.deepEqual(itemFields, ['title', 'link', 'date', 'categories', 'systemcore', 'source']);
  assert.ok(!JSON.stringify(newsType.fields).includes('required'));
  const lines = [];
  const walk = list => list.forEach(entry => { lines.push(entry); if (entry.entries) walk(entry.entries); });
  walk(structure.sidebarEntries);
  assert.ok(lines.every(entry => entry.type !== 'frcNews'));
  const offered = config.document.newDocumentOptions([{ templateId: 'frcNews' }, { templateId: 'plan' }], {}).map(entry => entry.templateId);
  assert.deepEqual(offered, ['plan']);
});

test('the section keeps the phone rules and its words have no dash, exclamation mark or filler word', () => {
  ['news-section.js', 'news-parts.js'].forEach(file => {
    const text = studio.source('inputs/' + file);
    (text.match(/minHeight: \d+/g) || []).forEach(found => assert.ok(Number(found.replace(/\D/g, '')) >= 44, file + ' ' + found));
    assert.ok(!/\bwidth: [3-9]\d\d\b/.test(text), file + ' has a fixed width');
  });
  const said = JSON.stringify(parts.words) + ' ' + studio.source('schemas/frcNews.js') + studio.source('schemas/settingsNews.js');
  assert.ok(!/[–—]/.test(said), 'no em or en dash');
  assert.ok(!/!['"]|!\s/.test(JSON.stringify(parts.words)), 'no exclamation mark');
  assert.ok(!/\b(simply|just|basically|really|very|actually|easily)\b/i.test(JSON.stringify(parts.words)), 'no filler word');
});

let passed = 0;
for (const entry of tests) {
  try {
    await entry.run();
    passed += 1;
    console.log('PASS  ' + entry.name);
  } catch (error) {
    console.log('FAIL  ' + entry.name);
    console.log(error && error.stack ? error.stack : String(error));
  }
}
studio.close();
console.log('\n' + passed + ' of ' + tests.length + ' passed');
process.exitCode = passed === tests.length ? 0 : 1;
