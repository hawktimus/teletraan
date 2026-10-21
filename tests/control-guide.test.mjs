// The words that explain the control page (control/static/guide.js): a sentence under every tab and section heading, the What do I
// do here note of each tab and how a browser remembers it, More tools, the labels and keys of the tab bar, and that no string a
// person reads shows a stored name such as general or rotationRows. Also the plain-wording rules for the files of this round.
//
//   node tests/control-guide.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { helpNoteHtml, helpNotes, helpSeen, lead, markHelpSeen, moreOpen, moreToolsHtml, resetHelp, sentences } from '../control/static/guide.js';
import { sections } from '../control/static/tabs/settings.js';
import { blocks } from '../control/static/tabs/content-blocks.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');

function walk(folder, found = []) {
  for (const entry of fs.readdirSync(repo + folder, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!['vendor', 'fonts'].includes(entry.name)) walk(folder + '/' + entry.name, found); } else if (/\.(js|html|css)$/.test(entry.name)) found.push(folder + '/' + entry.name);
  }
  return found;
}
const pageFiles = walk('control/static');
const scripts = pageFiles.filter(file => file.endsWith('.js'));

test('every tab, every Settings section and every Content block has one plain sentence', () => {
  ['status', 'display', 'content', 'settings'].forEach(id => assert.ok(sentences[id], id));
  sections.forEach(section => assert.ok(sentences['settings.' + section.id], 'settings.' + section.id));
  blocks.forEach(block => assert.ok(sentences['content.' + block.id], 'content.' + block.id));
  ['display.onwall', 'display.theme-card', 'display.announce', 'display.preview', 'display.rotation', 'display.rows', 'display.add', 'display.more', 'display.quick', 'display.motion', 'display.theme',
    'status.preview', 'status.now', 'status.health', 'health.dots', 'health.reads', 'health.running', 'health.computer', 'health.errors'].forEach(key => assert.ok(sentences[key], key));
  Object.keys(sentences).forEach(key => {
    const words = sentences[key];
    assert.ok(words.length > 20 && words.length <= 260, key + ' is one sentence of a sensible length');
    assert.ok(/[.]$/.test(words), key + ' ends with a full stop');
  });
});

test('every sentence is used by some page, and the main ones say what the button does', () => {
  const all = scripts.map(read).join('\n');
  Object.keys(sentences).forEach(key => {
    const used = all.includes("'" + key + "'") || all.includes("'" + key.split('.')[0] + ".' + ") || all.includes("sentences['" + key + "']") || (key.startsWith('settings.') && all.includes("'settings.' + ")) || (key.startsWith('content.') && all.includes("'content.' + "));
    assert.ok(used, key + ' is never shown');
  });
  assert.match(sentences.display, /Publish to the wall/);
  assert.match(sentences.content, /Publish to the wall/);
  assert.match(sentences['settings.reboot'], /Publish to the wall/);
  assert.match(sentences.status, /Nothing on it changes the wall/);
});

test('the sentence is a paragraph with an id a section can point to', () => {
  const html = lead('display.rows');
  assert.match(html, /^<p class="lead" id="lead-display-rows">/);
  assert.ok(html.includes(sentences['display.rows']));
});

test('each tab has a short note for a student, with a button that dismisses it', () => {
  assert.deepEqual(Object.keys(helpNotes), ['status', 'display', 'content', 'settings']);
  ['status', 'display', 'content', 'settings'].forEach(id => {
    assert.ok(helpNotes[id].length >= 2 && helpNotes[id].length <= 4, id);
    const html = helpNoteHtml(id);
    assert.ok(html.includes('What do I do here?') && html.includes('data-help-done') && html.includes('Got it'), id);
  });
});

test('a browser remembers a dismissed note, the Help link brings them back, and a browser with no storage still works', () => {
  const store = {};
  globalThis.window = { localStorage: { getItem: key => (key in store ? store[key] : null), setItem: (key, value) => { store[key] = String(value); }, removeItem: key => { delete store[key]; } } };
  assert.equal(helpSeen('display'), false, 'the first visit shows the note');
  markHelpSeen('display');
  assert.equal(helpSeen('display'), true);
  assert.equal(helpSeen('status'), false, 'each tab is remembered on its own');
  resetHelp();
  assert.equal(helpSeen('display'), false, 'Help shows every note again');
  assert.equal(moreOpen('display'), false, 'More tools starts closed');
  store['teletraan.control.more.display'] = 'open';
  assert.equal(moreOpen('display'), true);

  globalThis.window = { get localStorage() { throw new Error('blocked'); } };
  assert.equal(helpSeen('display'), false);
  markHelpSeen('display');
  assert.equal(moreOpen('display'), false);
  delete globalThis.window;
});

test('More tools is a closed disclosure with its sentence and a name a screen reader can read', () => {
  const html = moreToolsHtml('display', '<p>inner</p>', sentences['display.more']);
  assert.match(html, /^<details class="more-tools" data-more="display"><summary aria-describedby="lead-display-more">More tools<\/summary>/);
  assert.ok(!html.includes(' open'));
  assert.ok(html.includes('<p>inner</p>'));
  const display = read('control/static/tabs/display.js');
  ['data-quick-box', 'data-motion-box'].forEach(box => assert.ok(display.indexOf(box) > display.indexOf("moreToolsHtml('display'"), box + ' is inside More tools'));
  assert.ok(read('control/static/tabs/settings-log.js').includes("moreToolsHtml('log'"), 'the log download is under More tools');
});

test('the tab bar is a tablist with labelled tabs, a roving tab stop and arrow keys, and the header has a Help button', () => {
  const html = read('control/static/index.html');
  assert.ok(html.includes('role="tablist" aria-label="Pages of the control page"'));
  assert.ok(html.includes('<button type="button" class="help" id="help">Help</button>'));
  assert.ok(html.includes('<main id="page" role="tabpanel"'));
  const app = read('control/static/app.js');
  ["button.role = 'tab'", "setAttribute('aria-controls', 'page')", "setAttribute('aria-selected'", 'button.tabIndex = on ? 0 : -1', "page.setAttribute('aria-labelledby'", 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'resetHelp()', 'mountHelpNote(page, tab.id)'].forEach(word => assert.ok(app.includes(word), word));
  const style = read('control/static/style.css');
  assert.ok(/:focus-visible \{[^}]*outline: 3px solid/.test(style), 'every control has a focus ring');
  const guide = read('control/static/tabs/settings.js') + read('control/static/tabs/content-blocks.js');
  assert.equal((guide.match(/aria-describedby/g) || []).length, 2, 'the section disclosures point at their sentence');
});

test('no string a person reads shows a stored name such as general, family, rotationRows or holdPanel', () => {
  const stored = /\b(general|family|rotationRows|holdPanel|themeByWeekday|viewOrder|dashboardSettings|generalViewTitle)\b/;
  scripts.forEach(file => {
    const literals = read(file).match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g) || [];
    literals.forEach(literal => {
      const body = literal.slice(1, -1);
      // a table or a path in the code has no space in it; a sentence for a person does
      if (body.includes(' ')) assert.ok(!stored.test(body), file + ' shows: ' + body.slice(0, 80));
    });
  });
  ['Robotics', 'Condensed'].forEach(word => assert.ok(read('control/support/requests.js').includes(word), word));
});

test('the nine department names are capitalised the same everywhere the page shows them', () => {
  const rows = read('control/static/tabs/display-parts.js');
  assert.ok(rows.includes('department ? department.title : row.department'), 'a department is shown by its title, not its stored id');
  const lists = read('dashboard/config-lists.js');
  ['Build', 'Electrical', 'Programming', 'Design', 'CNC', 'Strategy', 'Operations', 'Business', 'Marketing'].forEach(name => assert.ok(lists.includes("title: '" + name + "'"), name));
});

test('the words are plain: no em or en dash, no exclamation mark, no emoji', () => {
  const files = pageFiles.concat(['control/support/names.js', 'tests/control-choice.test.mjs', 'tests/control-guide.test.mjs', 'tests/control-actions.test.mjs']);
  files.forEach(file => {
    const text = read(file);
    assert.ok(!new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']').test(text), file + ' has a dash');
    assert.ok(!/[A-Za-z0-9.)'"]!(?!=)/.test(text.replace(/<!doctype|<!--/gi, '')), file + ' has an exclamation mark');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text.replace(/\\u2713|\\2713/g, '')), file + ' has an emoji');
  });
});

await finish();
