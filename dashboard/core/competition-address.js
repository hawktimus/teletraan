// ?competition=1&event=<TBA event key> in the address: the competition cards on, with that event's
// data, whatever the Competition cards setting says and whatever the date is. The plain functions;
// core/competition-address-run.js gives them the page. It is for the screenshot tool and for trying
// a card by hand (docs/frc-feed.md, "Try a card on a past event"). It uses the same hold as the
// Preview competition button (previewCompetition in core/competition.js).
//
//   competition=1   on. Without event, the data is the frc-status document, or in ?sample=1 the fixture
//   event=<key>     keep only that event: the frc-status document is cut down to it, and in ?sample=1
//                   the fixture of data/sample/frc-event.json is used when it is that event
//
// The fixture is made by tools/frc-fixture.mjs from computer/scripts/frc-sync.sh --event <key> --to <file>.
// Until the owner makes one, the file holds a placeholder that says so.

import { isRecord } from './text.js';

export const fixtureFile = 'frc-event.json';

const eventKey = /^[0-9]{4}[a-z0-9]{1,20}$/;

// What the address asks for: { event } with event a key or '', or null when competition=1 is not there.
// search is the part after the ? and may be a URLSearchParams.
export function readCompetitionAsk(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
  if (params.get('competition') !== '1') return null;

  const event = (params.get('event') || '').trim().toLowerCase();
  return { event: eventKey.test(event) ? event : '' };
}

// The frc-status data cut down to one event. A team's event list keeps that event; the ranking, the alliance, the next
// match and the results stay only when they belong to it. A key that no team has leaves the data as it was.
export function frcForEvent(frc, key) {
  if (!isRecord(frc) || !Array.isArray(frc.teams) || key === '') return frc;
  if (!frc.teams.some(team => Array.isArray(team.events) && team.events.some(event => event.key === key))) return frc;

  const belongs = text => typeof text === 'string' && text.indexOf(key + '_') === 0;
  const teams = frc.teams.map(team => {
    const events = (team.events || []).filter(event => event.key === key);

    return Object.assign({}, team, {
      events: events,
      focusEvent: events.length > 0 ? key : '',
      nextMatch: team.nextMatch && belongs(team.nextMatch.match) ? team.nextMatch : null,
      results: (team.results || []).filter(result => belongs(result.match)),
      ranking: team.ranking && team.ranking.event === key ? team.ranking : null,
      alliance: team.alliance && team.alliance.event === key ? team.alliance : null,
      awards: (team.awards || []).filter(award => award.event === key),
    });
  });
  const districtEvents = (frc.districtEvents || []).filter(event => event.key === key);

  return Object.assign({}, frc, { teams: teams, districtEvents: districtEvents.length > 0 ? districtEvents : frc.districtEvents });
}

// The frc data of a fixture file { placeholder, event, frc }, for an event key (or '' for any), or null when the
// file is not a fixture or is for another event
export function fixtureFrc(fixture, key) {
  if (!isRecord(fixture) || !isRecord(fixture.frc)) return null;
  if (key !== '' && fixture.event !== key) return null;

  return fixture.frc;
}
