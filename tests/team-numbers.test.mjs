// Tests for the team numbers on the plate (docs/views.md, docs/layouts.md): the Prime view shows the number of Prime, the
// Nova view the number of Nova and the Robotics view both, in the standard layout and in the bar layout. The plate follows
// the view from the stylesheet, so a change of view cannot leave it stale, and the side column is drawn again with the banners.
//
//   node tests/team-numbers.test.mjs

import assert from 'node:assert/strict';
import { config, read, runTests, teams, test } from './helpers/monday-world.mjs';

const prime = Object.assign({}, config.primeTeam, { code: 'prime', number: '3229' });
const nova = Object.assign({}, config.primeTeam, { code: 'nova', name: 'Hawktimus Nova', number: '3426' });

function numbersWith(list) {
  teams.useTeams({ teams: list, settings: { teamMode: 'prime', alternateMinutes: 5 } });
  try {
    return teams.teamNumbersOf({ teams: list });
  } finally {
    teams.useTeams(null);
  }
}

test('the numbers come from the Team documents, Prime first and then Nova', () => {
  assert.deepEqual(numbersWith([prime, nova]), ['3229', '3426']);
  assert.deepEqual(numbersWith([nova, prime]), ['3229', '3426'], 'the order of the documents does not matter');
});

test('one Team document gives one number and none invented', () => {
  assert.deepEqual(numbersWith([prime]), ['3229']);
  assert.deepEqual(numbersWith([nova]), ['3426']);
  assert.deepEqual(numbersWith([Object.assign({}, nova, { active: false }), prime]), ['3229']);
});

test('both panels write the numbers and the count, and neither reads the view to decide', () => {
  ['panels/banner/panel.js', 'panels/bar-column/panel.js'].forEach(file => {
    const code = read(file);
    assert.ok(code.includes('teamNumbersOf(content)'), file + ' reads the numbers of the teams');
    assert.ok(code.includes('number-first') && code.includes('number-second'), file + ' has a place for each number');
    assert.ok(code.includes("'two' : 'one'"), file + ' writes how many numbers there are');
    assert.ok(!/data-plate|dataset\.plate[^\n]*viewNow|viewNow\(\)[^\n]*(family|plate)/.test(code.replace(/dataset\.plate/g, 'x')), file + ' does not choose the plate from the view');
  });
});

test('the stylesheet shows both numbers on the Robotics and Condensed views only, in both layouts', () => {
  const css = read('family-line.css');
  assert.ok(/html:is\(\[data-view="general"\], \[data-view="family"\]\) \.banner\[data-plate="two"\] \.team-plate \{ width: 940px; \}/.test(css), 'the wide plate on the standard layout');
  assert.ok(/html:is\(\[data-view="general"\], \[data-view="family"\]\) \.banner\[data-plate="two"\] \.team-plate \.team-both \{ display: flex; \}/.test(css), 'both numbers on the standard layout');
  assert.ok(/html:is\(\[data-view="general"\], \[data-view="family"\]\) \.bar-column\[data-plate="two"\] \.bar-team \.team-both \{[^}]*display: flex;[^}]*flex-direction: column/.test(css), 'two lines in the side column');
  assert.ok(/\.bar-column \.bar-team \.team-both em \{[^}]*font: 700 30px\/24px/.test(css), 'the lines are 30px');
  assert.ok(/em \+ em \{ color: var\(--team-pink\); \}/.test(css) && /em \{[^}]*color: var\(--team-label\)/.test(css), 'the first number is in the label color and the second in the accent');
  assert.ok(/\.team-both,[^{]*\{ display: none; \}/.test(css), 'both numbers are hidden on every other view');
  assert.ok(!/data-plate="family"/.test(css), 'no plate is hidden any more');
});

test('a change of view draws the banners and the side column again', () => {
  const shell = read('shell-extras.js');
  const body = shell.slice(shell.indexOf('function useView(look)'), shell.indexOf('export function writeViewLabels'));
  ['banner', 'bar-banner', 'bar-column'].forEach(id => assert.ok(body.includes("updatePanel('" + id + "'"), id + ' is drawn again'));
});

await runTests();
