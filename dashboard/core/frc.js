// The FRC data: the plain functions that clean the frc-status document and read it.
// They know nothing about the page, so tests/competition.test.mjs can run them.
//
// The Teletraan computer writes the document with computer/scripts/frc-sync.sh (docs/frc-feed.md), and
// the screen reads it with the rest of the content (core/sanity.js). tidyFrc() turns it
// into the shape the competition cards use, always complete: a value the Teletraan computer did not find
// is null, an empty text or an empty list, and nothing is ever filled in with a made up
// number. Cleaning an already clean document changes nothing, so the sample content in
// data/sample/content.json, which is written in this shape, goes through the same function.
//
// A team number is kept as text, because a number from the Teletraan computer and a made up one in the
// sample, such as [1234], are both just what the card writes.

import { visibleItems } from './content.js';
import { isRecord } from './text.js';

const plainDate = /^\d{4}-\d{2}-\d{2}$/;
const teamCode = /^[a-z0-9]+$/;

// How many of each the cards can draw. The Teletraan computer keeps at most these as well.
const most = { events: 12, districtEvents: 30, results: 8, people: 4, picks: 4, awards: 20, snapshots: 120, notes: 5, scheduled: 16, scouts: 3, field: 80 };

function listOf(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

// A number that can be used, or null
function numberOrNull(value) {
  return typeof value === 'number' && isFinite(value) ? value : null;
}

function textOf(value, longest) {
  return typeof value === 'string' ? value.trim().slice(0, longest) : '';
}

// A team number is digits from the Teletraan computer, or a few characters of text in the sample
function numberText(value) {
  if (typeof value === 'number' && isFinite(value)) return String(Math.round(value));
  return textOf(value, 8);
}

function dateOrEmpty(value) {
  return typeof value === 'string' && plainDate.test(value) ? value : '';
}

function timeOrEmpty(value) {
  return typeof value === 'string' && !isNaN(Date.parse(value)) ? value : '';
}

function colorOf(value) {
  return value === 'red' || value === 'blue' ? value : '';
}

function tidyRecord(raw) {
  if (!isRecord(raw)) return null;

  const record = { wins: numberOrNull(raw.wins), losses: numberOrNull(raw.losses), ties: numberOrNull(raw.ties) };
  return record.wins === null && record.losses === null && record.ties === null ? null : record;
}

function tidyPerson(raw) {
  return { number: numberText(raw.number), nickname: textOf(raw.nickname, 24), epa: numberOrNull(raw.epa) };
}

function tidyPeople(list, longest) {
  return listOf(list).map(tidyPerson).filter(person => person.number !== '').slice(0, longest);
}

// A team in a scouting list (the schedule of the team): the same as a person, with the record of the season and a
// trend when the Teletraan computer found them. Both are left empty otherwise.
function tidyScout(raw) {
  const trend = raw.trend === 'rising' || raw.trend === 'falling' ? raw.trend : '';
  return Object.assign(tidyPerson(raw), { record: tidyRecord(raw.record), trend: trend });
}

function tidyEvent(raw) {
  return {
    key: textOf(raw.key, 30),
    name: textOf(raw.name, 80),
    shortName: textOf(raw.shortName, 60),
    city: textOf(raw.city, 40),
    startDate: dateOrEmpty(raw.startDate),
    endDate: dateOrEmpty(raw.endDate),
    rank: numberOrNull(raw.rank),
    teamsRanked: numberOrNull(raw.teamsRanked),
    matchesPlayed: numberOrNull(raw.matchesPlayed),
    record: tidyRecord(raw.record),
    rankingPoints: numberOrNull(raw.rankingPoints),
    epa: numberOrNull(raw.epa),
  };
}

// An event needs a first day. One without it could not be placed on the timeline or in a window.
function tidyEvents(list) {
  return listOf(list).map(tidyEvent).filter(event => event.startDate !== '').slice(0, most.events);
}

function tidyNextMatch(raw) {
  if (!isRecord(raw)) return null;

  const odds = numberOrNull(raw.redWinProbability);
  return {
    match: textOf(raw.match, 40),
    label: textOf(raw.label, 12),
    level: textOf(raw.level, 4),
    number: numberOrNull(raw.number),
    time: timeOrEmpty(raw.time),
    alliance: colorOf(raw.alliance),
    red: tidyPeople(raw.red, most.people),
    blue: tidyPeople(raw.blue, most.people),
    redWinProbability: odds === null ? null : Math.min(1, Math.max(0, odds)),
  };
}

// One qualification match the team has still to play: the time, the partners and the opponents with their
// EPA, and the chance that the team's alliance wins when Statbotics has one (0 to 1, or null)
function tidyScheduled(raw) {
  const odds = numberOrNull(raw.winProbability);
  return {
    match: textOf(raw.match, 40),
    label: textOf(raw.label, 12),
    number: numberOrNull(raw.number),
    time: timeOrEmpty(raw.time),
    alliance: colorOf(raw.alliance),
    partners: listOf(raw.partners).map(tidyScout).filter(person => person.number !== '').slice(0, most.scouts),
    opponents: listOf(raw.opponents).map(tidyScout).filter(person => person.number !== '').slice(0, most.scouts),
    winProbability: odds === null ? null : Math.min(1, Math.max(0, odds)),
  };
}

// The qualification matches still to play at the event now. A schedule with no matches is the schedule that is not posted yet.
function tidySchedule(raw) {
  if (!isRecord(raw)) return null;

  return { event: textOf(raw.event, 30), matches: listOf(raw.matches).map(tidyScheduled).filter(match => match.label !== '').slice(0, most.scheduled) };
}

// The teams that come to the event, with the EPA of each when it was read, best first
function tidyField(raw) {
  if (!isRecord(raw)) return null;

  const teams = listOf(raw.teams).map(tidyPerson).filter(person => person.number !== '').slice(0, most.field);
  return teams.length === 0 ? null : { event: textOf(raw.event, 30), teams: teams };
}

function tidyResult(raw) {
  return {
    match: textOf(raw.match, 40),
    label: textOf(raw.label, 12),
    alliance: colorOf(raw.alliance),
    scoreFor: numberOrNull(raw.scoreFor),
    scoreAgainst: numberOrNull(raw.scoreAgainst),
    won: typeof raw.won === 'boolean' ? raw.won : null,
  };
}

function tidyRanking(raw) {
  if (!isRecord(raw) || numberOrNull(raw.rank) === null) return null;

  return {
    event: textOf(raw.event, 30),
    rank: numberOrNull(raw.rank),
    teamsRanked: numberOrNull(raw.teamsRanked),
    matchesPlayed: numberOrNull(raw.matchesPlayed),
    record: tidyRecord(raw.record),
    rankingPoints: numberOrNull(raw.rankingPoints),
  };
}

// The alliance of the team. A number of null is a selection that did not pick the team.
function tidyAlliance(raw) {
  if (!isRecord(raw)) return null;

  return { event: textOf(raw.event, 30), number: numberOrNull(raw.number), picks: tidyPeople(raw.picks, most.picks) };
}

function tidyDistrictPoints(raw) {
  if (!isRecord(raw) || numberOrNull(raw.total) === null) return null;

  return { total: numberOrNull(raw.total), rank: numberOrNull(raw.rank), cutoff: numberOrNull(raw.cutoff) };
}

function tidySnapshots(list) {
  return listOf(list)
    .filter(raw => dateOrEmpty(raw.date) !== '')
    .map(raw => ({ date: raw.date, epa: numberOrNull(raw.epa), districtPoints: numberOrNull(raw.districtPoints) }))
    .slice(-most.snapshots);
}

function tidyLastSeason(raw) {
  if (!isRecord(raw)) return null;

  const events = tidyEvents(raw.events);
  return events.length === 0 ? null : { season: numberOrNull(raw.season), events: events };
}

// A team entry needs the code of its team, which is how it is found for the team on the screen
function tidyTeam(raw) {
  const code = textOf(raw.team, 20).toLowerCase();
  if (!teamCode.test(code)) return null;

  return {
    team: code,
    number: numberText(raw.number),
    events: tidyEvents(raw.events),
    focusEvent: textOf(raw.focusEvent, 30),
    nextMatch: tidyNextMatch(raw.nextMatch),
    results: listOf(raw.results).map(tidyResult).slice(-most.results),
    ranking: tidyRanking(raw.ranking),
    alliance: tidyAlliance(raw.alliance),
    awards: listOf(raw.awards).map(award => ({ name: textOf(award.name, 60), event: textOf(award.event, 30) })).filter(award => award.name !== '').slice(0, most.awards),
    epa: numberOrNull(raw.epa),
    districtPoints: tidyDistrictPoints(raw.districtPoints),
    snapshots: tidySnapshots(raw.snapshots),
    lastSeason: tidyLastSeason(raw.lastSeason),
    schedule: tidySchedule(raw.schedule),
    field: tidyField(raw.field),
  };
}

function tidyDistrictEvent(raw) {
  const event = tidyEvent(raw);
  return { key: event.key, name: event.name, shortName: event.shortName, city: event.city, startDate: event.startDate, endDate: event.endDate, championship: raw.championship === true };
}

// The name of an event as a card writes it: the short name TBA gives when it has one, and the name otherwise,
// without a year at the front, because the season is on the card already. A name that is only a year is kept.
export function eventName(event) {
  const name = (event.shortName || event.name || '').trim();
  const stripped = name.replace(/^(19|20)\d{2}(?!\d)\s*[-:.,]?\s*/, '');
  return stripped === '' ? name : stripped;
}

// The frc-status document as the cards use it, or null when there is none. A sample may
// say sample: true, which the cards then write in their header so that nobody takes
// made up numbers for real ones.
export function tidyFrc(raw) {
  if (!isRecord(raw)) return null;

  const frc = {
    season: numberOrNull(raw.season),
    lastSyncAt: timeOrEmpty(raw.lastSyncAt),
    lastError: textOf(raw.lastError, 300),
    notes: (Array.isArray(raw.notes) ? raw.notes : []).filter(note => typeof note === 'string' && note.trim() !== '').map(note => note.trim().slice(0, 200)).slice(0, most.notes),
    districtEvents: listOf(raw.districtEvents).map(tidyDistrictEvent).filter(event => event.startDate !== '').slice(0, most.districtEvents),
    teams: listOf(raw.teams).map(tidyTeam).filter(team => team !== null),
  };
  if (raw.sample === true) frc.sample = true;
  return frc;
}

// The entry for the team on the screen (core/teams.js), or null. Like every list of content it goes
// through visibleItems, so the team is judged in that one place.
export function teamEntry(frc) {
  if (!isRecord(frc) || !Array.isArray(frc.teams)) return null;

  return visibleItems(frc.teams)[0] || null;
}

// Dates. The Teletraan computer writes the days of an event as plain dates, in the time zone of the
// screen, so the cards compare plain dates and never clock times. These work on text
// such as 2027-03-12 and are the same on every computer.

const dayMs = 24 * 60 * 60 * 1000;

function dayNumber(text) {
  const parts = text.split('-').map(Number);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]) / dayMs;
}

// The date some days after (or before, with a negative number) a date
export function addDays(text, days) {
  return new Date((dayNumber(text) + days) * dayMs).toISOString().slice(0, 10);
}

// Whole days from the first date to the second. Negative when the second is earlier.
export function daysFromTo(first, second) {
  return Math.round(dayNumber(second) - dayNumber(first));
}

// 2027-03-12 as MAR 12
const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function shortDate(text) {
  if (typeof text !== 'string' || !plainDate.test(text)) return '';
  return monthNames[Number(text.slice(5, 7)) - 1] + ' ' + Number(text.slice(8, 10));
}

// 2027-03-12 as FRI
export function weekdayName(text) {
  if (typeof text !== 'string' || !plainDate.test(text)) return '';
  return dayNames[new Date(dayNumber(text) * dayMs).getUTCDay()];
}

// 5-2-0, or nothing when the record is not known. A part that is missing is a question mark.
export function recordText(record) {
  if (!record) return '';

  const part = value => (value === null ? '?' : String(value));
  return part(record.wins) + '-' + part(record.losses) + '-' + part(record.ties);
}
