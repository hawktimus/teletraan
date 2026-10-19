// The sums behind the preview, matches and recap cards: how strong the field at an event is, the chance of winning each
// qualification match, the expected record, and the EPA over the season. Plain functions that know nothing about the page,
// so tests/competition-phases.test.mjs can run them. docs/frc-feed.md says what each card shows and what is an estimate.
//
// Nothing here is made up. A value the Teletraan computer did not find stays empty, and a chance worked out from EPA and not
// read from Statbotics is marked estimate: true, and the card writes ESTIMATE beside it.

import { competitionEstimateSpread } from '../config.js';
import { fieldStrengthFor, matchForecastFor } from './match13.js';

// 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st
export function ordinal(number) {
  const lastTwo = number % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return number + 'th';
  const word = { 1: 'st', 2: 'nd', 3: 'rd' }[number % 10];
  return number + (word || 'th');
}

// The field at an event

// The attending teams, best EPA first. A team with no EPA comes after every team with one, in the order it was given.
function ranked(field) {
  const rated = field.teams.filter(team => team.epa !== null).sort((first, second) => second.epa - first.epa);
  return rated.concat(field.teams.filter(team => team.epa === null));
}

// The strength of the field as the card draws it:
//   count     how many teams attend
//   rated     how many of them have an EPA
//   average   the mean EPA of the rated teams, or null
//   top       the best 8, each { rank, number, nickname, epa, code } with code the team of the screen it is ('prime',
//             'nova') or empty
//   lines     one for each of our teams at the event: { code, name, number, rank, count, epa, text }
// frc is the frc-status data, which says which of the numbers are ours. The team entry of the screen is not enough:
// both teams are marked in the top list when both come.
export function fieldStrength(frc, entry, eventKey) {
  const real = eventKey ? fieldStrengthFor(eventKey) : null;
  if (real) return match13Strength(frc, entry, real);

  const field = entry && entry.field ? entry.field : null;
  if (!field) return null;

  const order = ranked(field);
  const ours = (frc && Array.isArray(frc.teams) ? frc.teams : []).map(team => ({ code: team.team, number: String(team.number), name: team.team.charAt(0).toUpperCase() + team.team.slice(1) }));
  const codeOf = number => (ours.filter(team => team.number === String(number))[0] || { code: '' }).code;
  const rated = order.filter(team => team.epa !== null);
  const average = rated.length === 0 ? null : Math.round(rated.reduce((sum, team) => sum + team.epa, 0) / rated.length * 10) / 10;

  const lines = ours.map(team => {
    const place = order.findIndex(item => String(item.number) === team.number);
    if (place === -1) return null;

    const epa = order[place].epa;
    const rank = epa === null ? null : 1 + rated.filter(item => item.epa > epa).length;
    const text = rank === null
      ? team.name + ' has no EPA yet'
      : team.name + ' would rank ' + ordinal(rank) + ' of ' + order.length + ' by EPA';
    return { code: team.code, name: team.name, number: team.number, rank: rank, count: order.length, epa: epa, text: text };
  }).filter(line => line !== null);

  return {
    source: 'Statbotics',
    unit: 'EPA',
    event: field.event,
    count: order.length,
    rated: rated.length,
    average: average,
    top: order.slice(0, 8).map((team, index) => ({ rank: index + 1, number: String(team.number), nickname: team.nickname, epa: team.epa, code: codeOf(team.number) })),
    lines: lines,
  };
}

// The field as Match13 has it (core/match13.js): its rating for every team of the event, xP. Match13 gives the best 16 and the
// average, so a team of ours that is not among them has no place, and the line says so.
function match13Strength(frc, entry, real) {
  const nicknames = {};
  ((entry && entry.field) ? entry.field.teams : []).forEach(team => { nicknames[String(team.number)] = team.nickname; });
  const ours = (frc && Array.isArray(frc.teams) ? frc.teams : []).map(team => ({ code: team.team, number: String(team.number), name: team.team.charAt(0).toUpperCase() + team.team.slice(1) }));
  const codeOf = number => (ours.filter(team => team.number === String(number))[0] || { code: '' }).code;
  const rated = real.top.filter(row => row.xp !== null).sort((first, second) => second.xp - first.xp);
  const count = real.teamCount === null ? rated.length : real.teamCount;

  const lines = ours.map(team => {
    const at = rated.findIndex(row => String(row.teamNumber) === team.number);
    if (at === -1) return null;
    const rank = rated[at].rank === null ? at + 1 : rated[at].rank;
    return { code: team.code, name: team.name, number: team.number, rank: rank, count: count, epa: rated[at].xp, text: team.name + ' would rank ' + ordinal(rank) + ' of ' + count + ' by xP' };
  }).filter(line => line !== null);

  return {
    source: 'Match13',
    unit: 'xP',
    event: real.eventKey,
    count: count,
    rated: rated.length,
    average: real.average,
    top: rated.slice(0, 8).map((row, index) => ({ rank: row.rank === null ? index + 1 : row.rank, number: String(row.teamNumber), nickname: nicknames[String(row.teamNumber)] || '', epa: row.xp, code: codeOf(row.teamNumber) })),
    lines: lines,
  };
}

// Our matches

// The normal curve, by the Abramowitz and Stegun series for the error function (the largest error is 1.5e-7)
function curve(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}

// What Match13 forecasts for a match, from the side of our alliance: the chance, the two scores and our three ranking point chances.
// The file does not say which alliance is which, so the colour comes from the schedule in frc-status (match.alliance).
export function forecastOf(match) {
  const found = matchForecastFor(match.match);
  if (!found || (match.alliance !== 'red' && match.alliance !== 'blue')) return null;

  const red = match.alliance === 'red';
  return {
    chance: red ? found.redWin : found.blueWin,
    ourScore: red ? found.redScore : found.blueScore,
    theirScore: red ? found.blueScore : found.redScore,
    rp: red ? found.redRp : found.blueRp,
  };
}

function sumOf(people) {
  if (people.length === 0 || people.some(person => person.epa === null)) return null;
  return people.reduce((total, person) => total + person.epa, 0);
}

// The chance that our alliance wins a match, as { chance, estimate } or null when it cannot be told. Statbotics' chance
// is used when the Teletraan computer read one. Otherwise it is worked out from the EPA of the two alliances, and
// marked as an estimate.
export function winChance(match) {
  const forecast = forecastOf(match);
  if (forecast && forecast.chance !== null) return { chance: forecast.chance, estimate: false, source: 'Match13' };
  if (match.winProbability !== null) return { chance: match.winProbability, estimate: false, source: 'Statbotics' };

  const ours = sumOf(match.partners);
  const theirs = sumOf(match.opponents);
  if (ours === null || theirs === null || match.partners.length < 2 || match.opponents.length < 3) return null;

  return { chance: Math.round(curve((ours - theirs) / competitionEstimateSpread) * 10000) / 10000, estimate: true, source: 'estimate' };
}

// 7 wins, 5 losses, from the chances. The wins are the sum of the chances, rounded.
export function expectedRecord(chances) {
  if (chances.length === 0) return null;

  const wins = Math.round(chances.reduce((total, chance) => total + chance, 0));
  return { wins: wins, losses: chances.length - wins };
}

function percent(chance) {
  return Math.round(chance * 100);
}

// The best opponent of a match, by EPA, and what is known of the team: its record and which way its rating is going.
// The line is empty when nothing is known beyond the number.
function noteOf(match) {
  const rated = match.opponents.filter(person => person.epa !== null).sort((first, second) => second.epa - first.epa);
  const best = rated[0] || match.opponents.filter(person => person.record !== null || person.trend !== '')[0];
  if (!best) return '';

  const parts = [];
  if (best.record) parts.push((best.record.wins === null ? '?' : best.record.wins) + '-' + (best.record.losses === null ? '?' : best.record.losses));
  if (best.trend) parts.push(best.trend);
  return parts.length === 0 ? '' : best.number + ': ' + parts.join(', ');
}

// Our qualification matches in time order, with everything the card writes about each:
//   chance (0 to 1 or null), percent, estimate, ourEpa, theirEpa, note
// plus the countdown target (the first match with a time), the hardest and the easiest match (the lowest and the highest
// chance, only when two matches have one), and the expected record. now is a Date.
export function matchesView(entry) {
  const schedule = entry && entry.schedule ? entry.schedule : null;
  if (!schedule || schedule.matches.length === 0) return null;

  const timed = match => (match.time === '' ? Infinity : Date.parse(match.time));
  const ordered = schedule.matches.slice().sort((first, second) => timed(first) - timed(second) || (first.number || 0) - (second.number || 0));

  const rows = ordered.map(match => {
    const odds = winChance(match);
    return {
      match: match,
      label: match.label,
      time: match.time,
      chance: odds ? odds.chance : null,
      percent: odds ? percent(odds.chance) : null,
      estimate: odds ? odds.estimate : false,
      source: odds ? odds.source : '',
      forecast: forecastOf(match),
      ourEpa: sumOf(match.partners),
      theirEpa: sumOf(match.opponents),
      note: noteOf(match),
    };
  });

  const known = rows.filter(row => row.chance !== null);
  const hardest = known.length >= 2 ? known.reduce((low, row) => (row.chance < low.chance ? row : low)) : null;
  const easiest = known.length >= 2 ? known.reduce((high, row) => (row.chance > high.chance ? row : high)) : null;
  const first = rows.filter(row => row.time !== '')[0] || null;

  return {
    event: schedule.event,
    rows: rows,
    first: first,
    hardest: hardest,
    easiest: easiest,
    record: known.length === rows.length ? expectedRecord(known.map(row => row.chance)) : null,
    anyEstimate: known.some(row => row.estimate),
    source: known.some(row => row.source === 'Match13') ? 'Match13' : known.some(row => row.source === 'Statbotics') ? 'Statbotics' : known.length > 0 ? 'estimate' : '',
  };
}

// The season

// The EPA of the daily snapshots that have one, oldest first
export function epaSeries(snapshots) {
  return snapshots.filter(snapshot => snapshot.epa !== null).map(snapshot => ({ date: snapshot.date, epa: snapshot.epa }));
}

// What the EPA did over an event: the last snapshot up to the last day of the event less the last snapshot before its first
// day. It is null when either is missing. The district points gained are worked out the same way.
export function changeOver(snapshots, event, field) {
  const before = snapshots.filter(snapshot => snapshot.date < event.startDate && snapshot[field] !== null).slice(-1)[0];
  const after = snapshots.filter(snapshot => snapshot.date <= event.endDate && snapshot[field] !== null).slice(-1)[0];
  if (!before || !after || after.date < event.startDate) return null;

  return Math.round((after[field] - before[field]) * 10) / 10;
}

// The sign for a change in a number: +2.4, -1.1, 0
export function signed(value) {
  if (value === null) return '-';
  const rounded = Math.round(value * 10) / 10;
  return (rounded > 0 ? '+' : '') + rounded;
}
