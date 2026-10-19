// Tests for the Match13 block of the Competition page (studio/inputs/match13-status-input.js): the words for each
// state of the last read, and that the page has the block and reads only the three status fields.
//
//   node tests/match13-studio.test.mjs

import assert from 'node:assert/strict';
import { openStudio, nodesWhere, wordsIn, fakeClient } from './helpers/studio-world.mjs';

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

const studio = await openStudio();
const input = await studio.load('inputs/match13-status-input.js');
const view = await studio.load('inputs/competition-view.js');
const now = new Date('2026-10-19T12:00:00Z');
const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();

test('with no status, no read or the no-key state, the block says how to add the key', () => {
  const words = 'No Match13 key yet. Add it on the control page, Settings, Keys.';
  assert.equal(input.noKey, words);
  [null, undefined, {}, { match13At: 'soon' }, { match13At: ago(5), match13State: 'no-key' }].forEach(doc => assert.equal(input.match13Words(doc, now), words));
});

test('a good read says how long ago it was and how many teams it holds', () => {
  assert.equal(input.match13Words({ match13At: ago(12), match13State: 'ok', match13Count: 2 }, now), 'Last read 12 minutes ago. It holds 2 teams.');
  assert.equal(input.match13Words({ match13At: ago(1), match13State: 'ok', match13Count: 1 }, now), 'Last read 1 minute ago. It holds 1 team.');
  assert.equal(input.match13Words({ match13At: ago(180), match13State: 'ok', match13Count: 0 }, now), 'Last read 3 hours ago.');
});

test('a refused key, a limit and a server that does not answer each have plain words', () => {
  assert.equal(input.match13Words({ match13At: ago(3), match13State: 'bad-key' }, now), 'Match13 did not accept the key. Check it on the control page, Settings, Keys. Last tried 3 minutes ago.');
  assert.ok(input.match13Words({ match13At: ago(3), match13State: 'limit' }, now).startsWith('Match13 asked the Teletraan computer to wait.'));
  assert.ok(input.match13Words({ match13At: ago(3), match13State: 'down' }, now).startsWith('Match13 did not answer.'));
  ['bad-key', 'limit', 'down', 'ok', 'no-key'].forEach(state => {
    const text = input.match13Words({ match13At: ago(3), match13State: state }, now);
    assert.ok(!/[—–!]/.test(text), state);
  });
});

test('the block reads only the status fields, from the published document, and survives a client that fails', async () => {
  let asked = null;
  const client = { fetch: async (query, params, options) => { asked = { query, params, options }; return { match13At: ago(2), match13State: 'ok', match13Count: 2 }; } };
  const read = await input.readMatch13Status(client);
  assert.equal(asked.params.id, 'status-mini');
  assert.equal(asked.options.perspective, 'published');
  assert.ok(asked.query.includes('match13At') && asked.query.includes('match13State') && asked.query.includes('match13Count'));
  assert.equal(read.unreadable, false);
  const failed = await input.readMatch13Status({ fetch: async () => { throw new Error('offline'); } });
  assert.deepEqual(failed, { doc: null, unreadable: true });
  assert.ok(wordsIn(input.match13View(failed, now)).includes('could not be read'));
  assert.ok(wordsIn(input.match13View(null, now)).includes('Reading the Match13 status'));
});

test('the Competition page has the Match13 block between the connection and the cards', async () => {
  globalThis.studioClient = fakeClient([]);
  const page = studio.mount(view.CompetitionView);
  await page.settle();
  const blocks = nodesWhere(page.tree(), node => node.props && node.props['data-block']).map(node => node.props['data-block']);
  assert.deepEqual(blocks, ['connection', 'modes', 'match13', 'cards', 'news']);
  assert.ok(wordsIn(page.tree()).includes('Match13'));
});

let failures = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name + '\n      ' + String(error && error.stack).split('\n').slice(0, 8).join('\n      '));
  }
}
studio.close();
console.log(failures === 0 ? 'all ' + tests.length + ' passed' : failures + ' of ' + tests.length + ' failed');
process.exit(failures === 0 ? 0 : 1);
