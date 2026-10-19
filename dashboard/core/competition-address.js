// ?competition=1&event=<TBA event key> in the address: the competition cards on, with that event's
// data, whatever the Competition cards setting says and whatever the date is. The plain functions;
// core/competition-address-run.js gives them the page. It is for the screenshot tool and for trying
// a card by hand (docs/frc-feed.md, "Try a card on a past event"). It uses the same hold as the
// Preview competition button (previewCompetition in core/competition.js).
//
//   competition=1   on. Without event, the data is the frc-status document, or in ?sample=1 the fixture
//   event=<key>     keep only that event: the frc-status document is cut down to it, and in ?sample=1
//                   the fixture of data/sample/frc-event.json is used when it is that event
//   phase=<name>    move the dates of the data so that the first event of each team is in a phase of Before and after:
//                   preview (it starts in 6 days), matches (tomorrow, with the schedule posted), nomatches (tomorrow, with
//                   the schedule not posted yet) or recap (it ended 2 days ago). It is for trying the newer cards on any day.
//
// The fixture is made by tools/frc-fixture.mjs from computer/scripts/frc-sync.sh --event <key> --to <file>.
// Until the owner makes one, the file holds a placeholder that says so.

import { isRecord } from './text.js';
import { addDays, daysFromTo } from './frc.js';

export const fixtureFile = 'frc-event.json';

const eventKey = /^[0-9]{4}[a-z0-9]{1,20}$/;

export const phaseNames = ['preview', 'matches', 'nomatches', 'recap'];

// What the address asks for: { event } with event a key or '', and phase when one of phaseNames is asked for, or null when
// competition=1 is not there.
// search is the part after the ? and may be a URLSearchParams.
export function readCompetitionAsk(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
  if (params.get('competition') !== '1') return null;

  const event = (params.get('event') || '').trim().toLowerCase();
  const ask = { event: eventKey.test(event) ? event : '' };
  const phase = (params.get('phase') || '').trim().toLowerCase();
  if (phaseNames.includes(phase)) ask.phase = phase;
  return ask;
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

// Moves a date and time by some days
function shiftTime(text, days) {
  const moment = Date.parse(text);
  return typeof text === 'string' && !isNaN(moment) ? new Date(moment + days * 86400000).toISOString().replace('.000Z', 'Z') : text;
}

function shiftDate(text, days) {
  return typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text) ? addDays(text, days) : text;
}

function shiftEvent(event, days) {
  return Object.assign({}, event, { startDate: shiftDate(event.startDate, days), endDate: shiftDate(event.endDate, days) });
}

// The frc data with the dates of each team moved so that its first event is in a phase, as of today (a plain date). Everything
// that is dated moves by the same number of days, so the data keeps its shape. 'nomatches' also empties the schedule.
// Data that has no event is left as it is.
export function frcInPhase(frc, phase, today) {
  if (!isRecord(frc) || !Array.isArray(frc.teams) || !phaseNames.includes(phase)) return frc;

  let districtDays = 0; // the first team's move, which the district events follow
  const teams = frc.teams.map((team, index) => {
    const first = (team.events || []).filter(event => event.startDate)[0];
    if (!first) return team;

    // preview: the first day is 6 days away. matches: tomorrow. recap: the last day was 2 days ago.
    const days = phase === 'preview' ? daysFromTo(first.startDate, addDays(today, 6))
      : phase === 'recap' ? daysFromTo(first.endDate || first.startDate, addDays(today, -2))
      : daysFromTo(first.startDate, addDays(today, 1));
    if (index === 0) districtDays = days;

    const schedule = team.schedule && Array.isArray(team.schedule.matches)
      ? Object.assign({}, team.schedule, { matches: phase === 'nomatches' ? [] : team.schedule.matches.map(match => Object.assign({}, match, { time: shiftTime(match.time, days) })) })
      : team.schedule;

    return Object.assign({}, team, {
      events: team.events.map(event => shiftEvent(event, days)),
      snapshots: (team.snapshots || []).map(snapshot => Object.assign({}, snapshot, { date: shiftDate(snapshot.date, days) })),
      nextMatch: team.nextMatch ? Object.assign({}, team.nextMatch, { time: shiftTime(team.nextMatch.time, days) }) : team.nextMatch,
      schedule: schedule,
    });
  });
  const districtEvents = (frc.districtEvents || []).map(event => shiftEvent(event, districtDays));

  return Object.assign({}, frc, { teams: teams, districtEvents: districtEvents });
}
