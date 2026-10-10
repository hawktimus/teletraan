// The alliance board: the number of the alliance the team is on and the teams on it, once the selection
// has been made. It comes from the alliance part of the team's entry in frc-status. A selection that did
// not pick the team says so in one sentence (docs/frc-feed.md).

import { cardState, chartMarkup, cut, emptyMarkup, epaOf, numberFor, pageMarkup, tagTextFor, textAt } from '../../core/competition-draw.js';

// The teams are listed to the right of the number, four at most, in rows of 100 px: the number and
// the EPA on one line and the nickname under them
const LIST_LEFT = 420;
const ROW_FIRST = 16;
const ROW_HEIGHT = 100;
const MOST = 4;
const NICKNAME_FITS = 20;
const EVENT_FITS = 36;

function eventName(entry) {
  const found = entry.events.find(event => event.key === entry.alliance.event);
  return found ? found.name || found.city : '';
}

function rowParts(person, index, entry) {
  const top = ROW_FIRST + index * ROW_HEIGHT;
  const epa = epaOf(person, entry);
  const parts = [];

  if (person.number === entry.number) parts.push(`<rect class="ours" x="${LIST_LEFT - 16}" y="${top + 2}" width="${1096 - LIST_LEFT + 16}" height="${ROW_HEIGHT - 4}"/>`);
  parts.push(textAt(LIST_LEFT, top + 56, person.number, 'team'));
  if (epa !== null) parts.push(textAt(1096 - 12, top + 54, numberFor(epa), 'epa', 'end'));
  if (person.nickname) parts.push(textAt(LIST_LEFT, top + 92, cut(person.nickname, NICKNAME_FITS), 'nickname'));
  return parts;
}

function chart(entry) {
  const alliance = entry.alliance;
  const parts = [
    textAt(0, 60, 'NUMBER', 'label'),
    textAt(0, 250, String(alliance.number), 'number'),
    textAt(0, 470, cut(eventName(entry), EVENT_FITS), 'event'),
  ];

  alliance.picks.slice(0, MOST).forEach((person, index) => parts.push.apply(parts, rowParts(person, index, entry)));
  return chartMarkup('Alliance ' + alliance.number + ': ' + alliance.picks.map(person => person.number).join(', '), parts);
}

function sentenceFor(entry) {
  if (!entry || !entry.alliance) return 'Alliance selection has not happened yet.';
  return 'The team was not picked for an alliance.';
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const picked = state.entry && state.entry.alliance && state.entry.alliance.number !== null;
  const inner = picked ? chart(state.entry) : emptyMarkup(sentenceFor(state.entry));

  return pageMarkup('competition-alliance', 'ALLIANCE', tagTextFor(state.frc, now), inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
