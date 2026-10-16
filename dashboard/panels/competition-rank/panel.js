// The live rank: the rank of the team at the event that is on, as a big number, with its record and
// its ranking points under it. It comes from the ranking part of the team's entry in frc-status, which
// the Mini keeps up to date every 5 minutes while an event is on (docs/frc-feed.md).

import { cardState, chartMarkup, cut, emptyMarkup, numberFor, pageMarkup, tagTextFor, textAt } from '../../core/competition-draw.js';
import { recordText } from '../../core/frc.js';

const NAME_FITS = 36;

// The name of the event the rank is from, or nothing when the entry does not have it
function eventName(entry) {
  const found = entry.events.find(event => event.key === entry.ranking.event);
  return found ? found.name || found.city : '';
}

function chart(entry) {
  const ranking = entry.ranking;
  const of = ranking.teamsRanked === null ? '' : 'OF ' + ranking.teamsRanked;
  const record = recordText(ranking.record);
  const parts = [
    textAt(0, 44, cut(eventName(entry), NAME_FITS), 'event'),
    textAt(0, 112, 'RANK', 'label'),
    textAt(0, 290, String(ranking.rank), 'rank'),
    textAt(0, 372, 'RECORD', 'label'),
    textAt(0, 470, record || '-', 'stat'),
    textAt(566, 372, 'RANKING POINTS', 'label'),
    textAt(566, 470, numberFor(ranking.rankingPoints), 'stat'),
  ];
  if (of) parts.push(textAt(420, 290, of, 'of'));

  return chartMarkup('Rank ' + ranking.rank + (of ? ' ' + of.toLowerCase() : '') + ', record ' + (record || 'not known') + ', ranking points ' + numberFor(ranking.rankingPoints), parts);
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const entry = state.entry && state.entry.ranking ? state.entry : null;
  const inner = entry ? chart(entry) : emptyMarkup('There is no rank yet. Rankings start after the first match.');

  return pageMarkup('competition-rank', 'RANK', tagTextFor(state.frc, now), inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
