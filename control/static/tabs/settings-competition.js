// The Competition data section of Settings: what the wall reads for its competition cards, the TBA ranks (the frc-status document)
// and the Match13 matches. It moved here from the foot of the Display tab. Nothing here writes. The data comes with the Display
// answer of the control service, which reads Sanity and the local Match13 file.

import { api, useStyles } from './api.js';
import { agoText, esc } from './render.js';

export function extrasHtml(extras, now = new Date()) {
  if (!extras || (!extras.tba && !extras.match13)) return '<section class="card"><h2>Competition data</h2><p class="word">No competition data was read.</p></section>';
  let html = '<section class="card"><h2>Competition data</h2><p class="word">The wall adds the competition cards by itself, so they are not rows. This is the data behind them.</p>';

  if (extras.tba) {
    const teams = extras.tba.teams.map(team => '<li>' + esc(team.team + (team.number ? ' ' + team.number : '')) + ': ' +
      esc(team.rank === null ? 'no rank yet' : 'rank ' + team.rank + (team.of ? ' of ' + team.of : '')) + (team.nextMatch ? ', next match ' + esc(team.nextMatch) : '') + '</li>').join('');
    html += '<h3>TBA (the frc-status document)</h3><p class="word">Read ' + esc(agoText(extras.tba.lastSyncAt, now)) + '.' + (extras.tba.lastError ? ' Last problem: ' + esc(extras.tba.lastError) : '') + '</p>' + (teams ? '<ul class="items">' + teams + '</ul>' : '');
  }
  if (extras.match13) {
    html += '<h3>Match13</h3><p class="word">Read ' + esc(agoText(extras.match13.generatedAt, now)) + (extras.match13.stale ? '. This is old.' : '.') + ' This stays on the Teletraan computer and is not saved to Sanity.</p>';
    html += extras.match13.events.map(event => '<h4>' + esc(event.key) + '</h4>' + (event.matches.length ? '<ul class="items">' + event.matches.map(match =>
      '<li>' + esc(match.key) + (match.redWin === null ? '' : ': red wins ' + match.redWin + ' percent') + (match.redScore === null ? '' : ', expected ' + Math.round(match.redScore) + ' to ' + Math.round(match.blueScore)) + (match.played ? ', played' : '') + '</li>').join('') + '</ul>' : '<p class="word">No matches yet.</p>')).join('');
  }
  return html + '</section>';
}

export async function mountCompetition(container) {
  useStyles();
  container.innerHTML = '<div class="competition-section"><p class="word" data-reading>Reading the competition data.</p><div data-extras></div>' +
    '<div class="buttons"><button type="button" class="act quiet" data-read>Read again</button></div></div>';
  const line = container.querySelector('[data-reading]');
  const box = container.querySelector('[data-extras]');
  let gone = false;

  async function read() {
    line.textContent = 'Reading the competition data.';
    const answer = await api('GET', '/display?fresh=1');
    if (gone) return;
    if (!answer.ok) {
      line.textContent = answer.error;
      return;
    }
    line.textContent = '';
    box.innerHTML = extrasHtml(answer.data.wall && answer.data.wall.extras);
  }

  container.querySelector('[data-read]').addEventListener('click', read);
  await read();
  return () => { gone = true; };
}
