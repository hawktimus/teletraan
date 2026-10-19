// Tests for the FRC news on the screen: the document frc-news cleaned in core/news.js, the settings, the headlines picked
// for the panel and the ticker, the panel panels/frc-news and its place in the registry and the Rotation lists. The
// headlines are made up, in brackets, and the clock is fixed.
//
//   node tests/news.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { config, contentOf, dashboardFolder, load, now, read, registry, runTests, test, wordsOf } from './helpers/monday-world.mjs';

// The metal bars under the rows are defined in a hidden element of the page. This stands in for it, so node can draw a row.
globalThis.document = { getElementById: () => ({ insertAdjacentHTML() {} }) };

const news = await load('core/news.js');
const panel = await load('panels/frc-news/panel.js');
const ticker = await load('panels/ticker/panel.js');
const query = await load('core/sanity-query.js');
const content = await load('core/content.js');
const studioList = await import(new URL('../studio/inputs/screen-panels.js', import.meta.url).href);
const studioPreview = await import(new URL('../studio/inputs/preview-panels.js', import.meta.url).href);
const defaultRotation = await import(new URL('../studio/tools/default-rotation.js', import.meta.url).href);

const hoursAgo = hours => new Date(now.getTime() - hours * 3600000).toISOString();
const daysAgo = days => hoursAgo(days * 24);
const headline = (title, days, extra) => Object.assign({ title: title, link: 'https://news.example.test/' + encodeURIComponent(title), date: daysAgo(days), categories: ['FRC'], systemcore: false, source: 'FIRST' }, extra);

// The sample content with this document and these settings in place of its own
function contentWith(items, settings, extra) {
  return contentOf([], raw => {
    raw.news = Object.assign({ lastSyncAt: hoursAgo(1), items: items }, extra || {});
    Object.assign(raw.settings, { newsEnabled: true, newsInTicker: false, newsHiddenLinks: [] }, settings || {});
  });
}

test('the panel is a large panel only a row of the rotation names, and the Studio lists offer it', () => {
  const entry = registry.panels.find(item => item.id === 'frc-news');
  assert.ok(entry && entry.region === 'grid1' && entry.rotationOnly === true && entry.topic === 'news');
  assert.ok(fs.existsSync(path.join(dashboardFolder, 'panels/frc-news/panel.js')) && fs.existsSync(path.join(dashboardFolder, 'panels/frc-news/panel.css')));
  assert.ok(registry.panels.filter(item => item.region === 'grid2').every(item => item.topic !== 'news'), 'Grid 1 and Grid 2 never show the same topic');
  assert.ok(studioList.rotationPanels.some(item => item.value === 'frc-news' && item.title === 'FRC news'));
  assert.equal(studioList.panelTitle('frc-news'), 'FRC news');
  assert.ok(studioPreview.previewPanels.some(item => item.panel === 'frc-news'));
});

test('the default rotation does not play it, and a row that names it is a plain row', () => {
  assert.ok(!config.defaultRotationRows().some(row => row.panel === 'frc-news'));
  assert.ok(!defaultRotation.defaultRotationRows().some(row => row.panel === 'frc-news'));
  assert.ok(!config.defaultSettings.rotation.grid1.some(step => step.panel === 'frc-news'), 'the older Panel order does not hold it');
});

test('the document is cleaned: a title, a date and the categories, with defaults and nothing else', () => {
  assert.deepEqual(news.tidyNews(null), news.emptyNews());
  assert.deepEqual(news.tidyNews('text'), news.emptyNews());
  assert.deepEqual(news.tidyNews({}), { lastSyncAt: '', lastError: '', items: [] });
  const tidy = news.tidyNews({
    lastSyncAt: hoursAgo(2),
    lastError: '  It broke  ',
    items: [
      headline('[Systemcore news]', 1, { description: 'ARTICLE TEXT', body: 'ARTICLE TEXT', categories: ['Control System', '', 7, 'FRC'] }),
      { title: '', date: daysAgo(1) },
      { title: '[No date]' },
      { title: '[Bad date]', date: 'soon' },
      'text',
      headline('x'.repeat(200), 2),
    ],
  });
  assert.equal(tidy.lastError, 'It broke');
  assert.equal(tidy.items.length, 2);
  assert.deepEqual(Object.keys(tidy.items[0]).sort(), ['categories', 'date', 'link', 'source', 'systemcore', 'title']);
  assert.deepEqual(tidy.items[0].categories, ['Control System', 'FRC']);
  assert.equal(tidy.items[0].systemcore, true, 'a title that says Systemcore is a SystemCore headline');
  assert.equal(tidy.items[1].title.length, 140);
  assert.ok(!JSON.stringify(tidy).includes('ARTICLE TEXT'), 'no article text is kept');
});

test('the settings are always complete, and a value that does not fit is the starting value', () => {
  const settings = { newsEnabled: 'yes', newsInTicker: 1, newsCategories: 'FRC', newsHiddenLinks: ['a', 7, '', ' b '] };
  news.tidyNewsSettings(settings, config.defaultSettings);
  assert.deepEqual(settings, { newsEnabled: true, newsInTicker: false, newsCategories: ['FRC', 'Control System'], newsHiddenLinks: ['a', 'b'] });
  assert.equal(config.defaultSettings.newsEnabled, true);
  assert.equal(config.defaultSettings.newsInTicker, false);
  assert.deepEqual(config.defaultSettings.newsHiddenLinks, []);
  const whole = contentWith([headline('[One]', 1)], { newsEnabled: false, newsCategories: ['Kickoff'] });
  assert.equal(whole.settings.newsEnabled, false);
  assert.deepEqual(whole.settings.newsCategories, ['Kickoff']);
  assert.deepEqual(content.withDefaults({}).news, news.emptyNews());
  assert.equal(content.withDefaults({}).settings.newsInTicker, false);
});

test('the newest five show, newest first, and nothing older than 60 days or hidden or from the future', () => {
  const items = [1, 2, 3, 4, 5, 6, 7].map(day => headline('[Day ' + day + ']', day));
  items.push(headline('[Old]', 61), headline('[Just in time]', 59), headline('[Tomorrow]', -3));
  const shown = news.newsItems(contentWith(items), now);
  assert.deepEqual(shown.map(item => item.title), ['[Day 1]', '[Day 2]', '[Day 3]', '[Day 4]', '[Day 5]']);
  const all = news.newsItems(contentWith(items), now, 50).map(item => item.title);
  assert.ok(all.includes('[Just in time]') && !all.includes('[Old]') && !all.includes('[Tomorrow]'));

  const hidden = news.newsItems(contentWith(items, { newsHiddenLinks: [items[0].link, items[2].link] }), now);
  assert.deepEqual(hidden.map(item => item.title), ['[Day 2]', '[Day 4]', '[Day 5]', '[Day 6]', '[Day 7]'], 'a hidden headline is replaced by the next one');
  assert.deepEqual(news.newsItems(contentWith(items, { newsEnabled: false }), now), [], 'news switched off shows nothing');
  assert.deepEqual(news.newsItems(contentOf([], raw => { delete raw.news; }), now), [], 'no document shows nothing');
});

test('the panel has content only when there are headlines and news is on', () => {
  assert.equal(panel.hasContent(contentWith([headline('[One]', 1)])), true);
  assert.equal(panel.hasContent(contentWith([])), false);
  assert.equal(panel.hasContent(contentWith([headline('[Old]', 90)])), false);
  assert.equal(panel.hasContent(contentWith([headline('[One]', 1)], { newsEnabled: false })), false);
  const none = contentOf([], raw => { delete raw.news; });
  assert.deepEqual(none.news, news.emptyNews());
  assert.equal(panel.hasContent(none), false);
});

test('a list not written for 12 hours is stale, and one never written is not', () => {
  assert.equal(news.newsIsStale(contentWith([], {}, { lastSyncAt: hoursAgo(11) }), now), false);
  assert.equal(news.newsIsStale(contentWith([], {}, { lastSyncAt: hoursAgo(13) }), now), true);
  assert.equal(news.newsIsStale(contentWith([], {}, { lastSyncAt: '' }), now), false);
  assert.equal(news.newsIsStale(contentOf([]), now), false);
});

test('the date reads Sep 23, in the time zone of the screen', () => {
  assert.equal(news.newsDateLabel('2026-09-23T19:17:55Z', 'America/New_York'), 'Sep 23');
  assert.equal(news.newsDateLabel('2026-10-01T02:00:00Z', 'America/New_York'), 'Sep 30');
  assert.equal(news.newsDateLabel('2026-10-01T02:00:00Z', 'UTC'), 'Oct 1');
  assert.equal(news.newsDateLabel('2026-12-05T12:00:00Z', 'Not/AZone'), 'Dec 5');
  assert.equal(news.newsDateLabel('soon'), '');
});

test('the panel draws FRC NEWS, FROM FIRST, the date, the first headline bigger and a chip for SystemCore only', () => {
  const html = panel.markupFor(contentWith([headline('[Systemcore pricing]', 2, { systemcore: true }), headline('[Season resources]', 5), headline('[Events]', 9)]), now);
  const words = wordsOf(html);
  assert.match(words, /FRC NEWS/);
  assert.match(words, /FROM FIRST/);
  assert.match(words, /Oct 13 \[Systemcore pricing\] SYSTEMCORE/);
  assert.match(words, /Oct 10 \[Season resources\]/);
  assert.equal((html.match(/class="chip"/g) || []).length, 1);
  assert.equal((html.match(/class="row row-big"/g) || []).length, 1);
  assert.ok(html.indexOf('row-big') < html.indexOf('[Season resources]'), 'the first row is the big one');
  assert.ok(!html.includes('stale-chip'), 'the list is fresh');
  assert.ok(!/<a |<img|news\.example\.test|description/.test(html), 'a headline is text only: no link, no picture and no description');
});

test('the panel shows five headlines at most, escapes the text and says STALE after 12 hours', () => {
  const six = [1, 2, 3, 4, 5, 6].map(day => headline('[H' + day + ']', day));
  assert.equal((panel.markupFor(contentWith(six), now).match(/data-slat="item"/g) || []).length, 5);
  const tricky = panel.markupFor(contentWith([headline('<b>[Bold]</b> & "quotes"', 1)]), now);
  assert.ok(!tricky.includes('<b>[Bold]') && tricky.includes('&lt;b&gt;'));
  const stale = panel.markupFor(contentWith([headline('[One]', 1)], {}, { lastSyncAt: hoursAgo(20) }), now);
  assert.match(stale, /<span class="stale-chip">STALE<\/span>/);
});

test('with no headlines the panel says No FRC news yet.', () => {
  assert.match(wordsOf(panel.markupFor(contentWith([]), now)), /No FRC news yet\./);
});

test('every headline fits the window: a long one wraps to three lines and is cut at a word, and rows are left out before they overflow', () => {
  const long = 'Word '.repeat(60).trim();
  const rows = news.fitHeadlines([headline(long, 1, { systemcore: true }), headline(long, 2), headline(long, 3), headline('[Short]', 4), headline('[Short two]', 5)].map(item => news.tidyHeadline(item)));
  assert.ok(rows.length >= 1 && rows.length < 5);
  rows.forEach(row => assert.ok(row.lines <= news.newsLayout.mostLines, row.lines + ' lines'));
  assert.ok(rows.reduce((sum, row) => sum + row.height, 0) <= news.newsLayout.window || rows.length === 1);
  assert.equal(news.newsLayout.window, 528, 'the window ends at 664, above the slashes of the foot of the frame');
  assert.ok(rows[0].title.endsWith('...') && rows[0].big && !rows[1].big);
  assert.equal(news.fitHeadlines([]).length, 0);
  const short = news.fitHeadlines([1, 2, 3, 4, 5].map(day => news.tidyHeadline(headline('[Short ' + day + ']', day))));
  assert.equal(short.length, 5, 'five short headlines all fit');
  assert.equal(news.linesFor('[Short]', 44, 824), 1);
  assert.ok(news.linesFor('[Sample headline about the season with a long title that wraps onto a second line on the screen]', 44, 824) >= 2);
});

test('text is cut at a word with three dots', () => {
  assert.equal(news.cutAtWord('short', 90), 'short');
  const cut = news.cutAtWord('FIRST: ' + 'alpha beta gamma '.repeat(10).trim(), 40);
  assert.ok(cut.length <= 40 && cut.endsWith('...') && !/\w\.\.\.$/.test(cut.replace(/(alpha|beta|gamma)\.\.\.$/, '')));
  assert.match(cut, / (alpha|beta|gamma)\.\.\.$/);
});

test('with Show news in the ticker on, the newest three join the ticker as FIRST: and the title, at most 90 characters', () => {
  const items = [headline('[One]', 1), headline('[Two ' + 'long '.repeat(30) + ']', 2), headline('[Three]', 3), headline('[Four]', 4)];
  assert.deepEqual(news.newsTickerLines(contentWith(items), now), [], 'off to start with');
  const lines = news.newsTickerLines(contentWith(items, { newsInTicker: true }), now);
  assert.equal(lines.length, 3);
  lines.forEach(line => assert.ok(line.kind === 'news' && line.text.startsWith('FIRST: ') && line.text.length <= 90, line.text));
  assert.equal(lines[0].text, 'FIRST: [One]');
  assert.ok(lines[1].text.endsWith('...'));
  assert.deepEqual(news.newsTickerLines(contentWith(items, { newsInTicker: true, newsEnabled: false }), now), []);
  assert.deepEqual(news.newsTickerLines(contentWith(items, { newsInTicker: true, newsHiddenLinks: [items[0].link] }), now).map(line => line.text.slice(0, 11)), ['FIRST: [Two ', 'FIRST: [Thr', 'FIRST: [Fou'].map(text => text.slice(0, 11)));
});

test('the ticker plays the notes and thanks as before and the news lines after them', () => {
  const plain = ticker.items(contentWith([headline('[One]', 1)]));
  assert.ok(!plain.some(line => line.text.startsWith('FIRST:')));
  const withNews = ticker.items(contentWith([headline('[One]', 1)], { newsInTicker: true }));
  assert.equal(withNews.length, plain.length + 1);
  assert.deepEqual(withNews.slice(0, plain.length), plain);
  assert.equal(withNews[withNews.length - 1].text, 'FIRST: [One]');
});

test('the content query reads the document frc-news for the headline fields only', () => {
  assert.match(query.contentQuery, /"news": \*\[_id == "frc-news"\]\[0\] \{ lastSyncAt, lastError, "items": coalesce\(items, \[\]\) \[\] \{ title, link, date, categories, systemcore \} \}/);
  assert.ok(!/description|content:encoded|body/.test(query.contentQuery.split('"news"')[1].split('"monday"')[0]));
});

test('the content stays whole when the document is odd', () => {
  [null, 'text', 5, [], { items: 'x' }, { items: [null, 3, {}] }, { items: { a: 1 } }, { lastSyncAt: 7, items: [headline('[One]', 1, { categories: 'FRC' })] }].forEach(value => {
    const whole = contentOf([], raw => { raw.news = value; });
    assert.doesNotThrow(() => panel.markupFor(whole, now));
    assert.doesNotThrow(() => news.newsTickerLines(whole, now));
  });
});

test('the sample has three headlines marked as samples, with dates that never age out', () => {
  const raw = JSON.parse(read('data/sample/content.json'));
  assert.equal(raw.news.sample, true);
  assert.equal(raw.news.items.length, 3);
  raw.news.items.forEach(item => assert.ok(item.title.startsWith('[') && typeof item.daysAgo === 'number' && item.daysAgo < news.newsMaxAgeDays));
  const sample = contentOf([]);
  assert.equal(news.newsItems(sample, new Date()).length, 3);
  assert.equal(news.newsItems(sample, new Date(Date.now() + 30 * 86400000)).length >= 1, true);
});

test('the stylesheet keeps the text at 44px or more, except the 30px chips, and uses no animation, shadow or filter', () => {
  const css = read('panels/frc-news/panel.css');
  const sizes = Array.from(css.matchAll(/font:[^;]*?(\d+)px\//g)).map(match => Number(match[1]));
  assert.ok(sizes.length > 0);
  sizes.filter(size => size < 44).forEach(size => assert.equal(size, 30, 'only chips are smaller than 44px'));
  const uses = Array.from(css.matchAll(/font:[^;]*var\(--size-([a-z-]+)\)/g)).map(match => match[1]);
  uses.forEach(name => assert.ok(['label', 'body', 'body-large', 'heading'].includes(name), name));
  assert.ok(!/animation|transition|box-shadow|text-shadow|filter|blur|transform|#[0-9a-fA-F]{3,6}\b/.test(css), 'tokens only, and no motion of its own');
  assert.ok(!/\bwidth: [3-9]\d\d\b/.test(css.replace(/width: (1152|824|240)px/g, '')), 'the widths are the ones of the panel');
});

await runTests();
