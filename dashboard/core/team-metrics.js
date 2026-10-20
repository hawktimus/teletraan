// The numbers of one team for the two metrics cards (panels/competition-team-metrics for the team on the screen,
// panels/competition-compare for both teams side by side). Plain functions that know nothing about the page, so
// tests/team-metrics.test.mjs can run them.
//
// Two sources are joined here and nothing is made up:
//   frc-status (The Blue Alliance and Statbotics, core/frc.js): the record, the rank, the ranking points, the
//     results, the district points, the next match and the schedule.
//   match13.json (core/match13.js): the rating xP, how it splits into auto, teleop and endgame, OPR, DPR, the place
//     among all teams, the place at the event and the chance of each match.
// A number that a source did not give stays null, and the card then says NOT YET in its place. Alliance members
// come from frc-status only: the Match13 file does not say which alliance a team is on.

import { currentMatch13, fieldStrengthFor, matchForecastFor } from './match13.js';
import { forecastOf, matchesView, ordinal as lowerOrdinal } from './competition-scouting.js';
import { eventName, recordText } from './frc.js';

export const notYet = 'NOT YET';

function ordinal(value) {
  return lowerOrdinal(Math.round(value)).toUpperCase();
}

function oneDecimal(value) {
  return typeof value === 'number' && isFinite(value) ? String(Math.round(value * 10) / 10) : null;
}

function percentOf(chance) {
  return chance === null ? null : Math.round(chance * 100) + '%';
}

function byStart(first, second) {
  return first.startDate < second.startDate ? -1 : first.startDate > second.startDate ? 1 : 0;
}

// The entry of a team in frc-status by its code (prime, nova), or null
export function entryOf(frc, code) {
  const teams = frc && Array.isArray(frc.teams) ? frc.teams : [];
  return teams.find(team => team.team === code) || null;
}

// The record over every event of the season that has one, or null when none has
function seasonRecord(events) {
  const played = events.filter(event => event.record !== null);
  if (played.length === 0) return null;

  const total = { wins: 0, losses: 0, ties: 0 };
  played.forEach(event => {
    total.wins += event.record.wins || 0;
    total.losses += event.record.losses || 0;
    total.ties += event.record.ties || 0;
  });
  return total;
}

// The rank at the event that is on, and otherwise at the latest event that has one
function standingOf(entry) {
  const events = entry.events.slice().sort(byStart);
  if (entry.ranking) {
    const event = events.find(item => item.key === entry.ranking.event);
    return { rank: entry.ranking.rank, of: entry.ranking.teamsRanked, rankingPoints: entry.ranking.rankingPoints, event: event ? eventName(event) : '' };
  }
  const last = events.filter(event => event.rank !== null).slice(-1)[0];
  return last ? { rank: last.rank, of: last.teamsRanked, rankingPoints: last.rankingPoints, event: eventName(last) } : null;
}

// The score and the streak of the results kept (the last 8 matches of the event)
function resultsOf(entry) {
  const scored = entry.results.filter(result => result.scoreFor !== null);
  const average = scored.length === 0 ? null : scored.reduce((sum, result) => sum + result.scoreFor, 0) / scored.length;

  let streak = null;
  const last = entry.results.slice(-1)[0];
  if (last && last.won !== null) {
    let length = 0;
    for (let at = entry.results.length - 1; at >= 0 && entry.results[at].won === last.won; at--) length += 1;
    streak = { won: last.won, length: length };
  }

  const lastThree = entry.results.slice(-3).reverse().map(result => ({
    label: result.label,
    won: result.won,
    scoreFor: result.scoreFor,
    scoreAgainst: result.scoreAgainst,
    margin: result.scoreFor !== null && result.scoreAgainst !== null ? result.scoreFor - result.scoreAgainst : null,
  }));
  return { average: average, count: scored.length, streak: streak, lastThree: lastThree };
}

// The place at the event by xP, from the best teams Match13 sent and ours. It looks at the event of the team first.
function placeAtEvent(data, entry, number) {
  const keys = [entry.focusEvent, entry.ranking ? entry.ranking.event : ''].concat(data ? Object.keys(data.events) : []).filter(key => key !== '');
  for (const key of keys) {
    const field = fieldStrengthFor(key, data);
    const row = field ? field.ours.find(item => item.teamNumber === number) : null;
    if (row && row.rank !== null) return { rank: row.rank, of: field.teamCount, eventKey: key };
  }
  return null;
}

function ratingsOf(data, number, entry) {
  const row = data && data.teams[String(number)];
  if (!row || row.xp === null) return null;

  return {
    xp: row.xp,
    topPercent: row.percentile === null ? null : Math.min(99, Math.max(1, Math.round(100 - row.percentile))),
    seasonRank: row.rank,
    auto: row.xAuto,
    tele: row.xTele,
    end: row.xEnd,
    epa: row.epa,
    opr: row.opr,
    dpr: row.dpr,
    place: placeAtEvent(data, entry, number),
  };
}

// The average rating of the partners and of the opponents over some matches. Each match is { partners, opponents, ratings }
// with ratings the xP of the teams (matchForecastFor). It uses xP when every team has one, and otherwise EPA when every team
// has one, and says which. It gives null when neither is complete, because two sources must not be mixed.
function averages(matches) {
  const people = side => matches.reduce((all, match) => all.concat(match[side]), []);
  const partners = people('partners');
  const opponents = people('opponents');
  if (partners.length === 0 || opponents.length === 0) return null;

  const average = (list, value) => list.reduce((sum, person) => sum + value(person), 0) / list.length;
  const xp = (match, person) => (match.ratings && typeof match.ratings[person.number] === 'number' ? match.ratings[person.number] : null);

  const sources = [
    { unit: 'xP', value: (match, person) => xp(match, person) },
    { unit: 'EPA', value: (match, person) => person.epa },
  ];
  for (const source of sources) {
    const taken = side => matches.reduce((all, match) => all.concat(match[side].map(person => source.value(match, person))), []);
    const ours = taken('partners');
    const theirs = taken('opponents');
    if (ours.every(value => value !== null) && theirs.every(value => value !== null)) {
      return { unit: source.unit, partners: average(ours, value => value), opponents: average(theirs, value => value) };
    }
  }
  return null;
}

// The next match of the team: when, the chance, the expected score and how the two sides rate. The schedule of frc-status
// has qualification matches only, so a playoff match is read from the next match itself.
function nextOf(entry, number) {
  const next = entry.nextMatch;
  if (!next || next.match === '') return null;

  const view = matchesView(entry);
  const row = view ? view.rows.find(item => item.match.match === next.match) : null;
  const ours = next.alliance === 'red' ? next.red : next.alliance === 'blue' ? next.blue : [];
  const theirs = next.alliance === 'red' ? next.blue : next.alliance === 'blue' ? next.red : [];
  const partners = row ? row.match.partners : ours.filter(person => person.number !== String(number));
  const opponents = row ? row.match.opponents : theirs;
  const ratings = (matchForecastFor(next.match) || { ratings: {} }).ratings;

  let chance = null;
  let estimate = false;
  let forecast = null;
  if (row) {
    chance = row.chance;
    estimate = row.estimate;
    forecast = row.forecast;
  } else if (next.alliance !== '') {
    forecast = forecastOf({ match: next.match, alliance: next.alliance });
    if (forecast && forecast.chance !== null) chance = forecast.chance;
    else if (next.redWinProbability !== null) chance = next.alliance === 'red' ? next.redWinProbability : 1 - next.redWinProbability;
  }

  return {
    label: next.label,
    time: next.time,
    chance: chance,
    estimate: estimate,
    ourScore: forecast ? forecast.ourScore : null,
    theirScore: forecast ? forecast.theirScore : null,
    sides: averages([{ partners: partners, opponents: opponents, ratings: ratings }]),
  };
}

// The matches still to play: how many, the expected record, the hardest and the easiest, and how the partners and the
// opponents rate over all of them
function aheadOf(entry) {
  const view = matchesView(entry);
  if (!view) return null;

  const rated = view.rows.map(row => ({ partners: row.match.partners, opponents: row.match.opponents, ratings: (matchForecastFor(row.match.match) || { ratings: {} }).ratings }));
  return {
    count: view.rows.length,
    record: view.record,
    hardest: view.hardest ? { label: view.hardest.label, chance: view.hardest.chance } : null,
    easiest: view.easiest ? { label: view.easiest.label, chance: view.easiest.chance } : null,
    sides: averages(rated),
  };
}

// What Match13 says of each event of the season, with the name and the rank from frc-status where it has them
function historyOf(data, entry, number) {
  const row = data && data.teams[String(number)];
  const kept = row ? row.history : [];
  const events = entry.events.concat(entry.lastSeason ? entry.lastSeason.events : []);

  const rows = kept.map(item => {
    const event = events.find(candidate => candidate.key === item.eventKey);
    return {
      name: event ? eventName(event) : item.eventKey.slice(4).toUpperCase(),
      rank: event ? event.rank : null,
      record: event ? event.record : null,
      xpStart: item.xpStart,
      xpEnd: item.xpEnd,
      districtPoints: item.districtPoints,
    };
  });
  return rows.slice(-3);
}

// Everything about one team, or null when frc-status has no entry for the code
export function metricsFor(frc, code) {
  const entry = entryOf(frc, code);
  if (!entry) return null;

  const data = currentMatch13();
  const number = Number(entry.number);
  const results = resultsOf(entry);
  return {
    code: entry.team,
    number: entry.number,
    record: seasonRecord(entry.events),
    standing: standingOf(entry),
    results: results,
    district: entry.districtPoints,
    ratings: ratingsOf(data, number, entry),
    next: nextOf(entry, number),
    ahead: aheadOf(entry),
    history: historyOf(data, entry, number),
  };
}

// The pages

function row(label, value, short, tag) {
  return { label: label, value: value, short: short === undefined ? value : short, tag: tag || label };
}

function signed(value) {
  return value === null ? null : (value > 0 ? '+' : '') + value;
}

function sidesRows(sides) {
  const unit = sides ? ' ' + sides.unit : '';
  return [
    row('PARTNERS AVG', sides ? oneDecimal(sides.partners) + unit : null, sides ? oneDecimal(sides.partners) : null),
    row('OPPONENTS AVG', sides ? oneDecimal(sides.opponents) + unit : null, sides ? oneDecimal(sides.opponents) : null),
  ];
}

function seasonPage(metrics) {
  const standing = metrics.standing;
  const results = metrics.results;
  const streak = results.streak;
  const district = metrics.district;

  return {
    id: 'season',
    sub: standing && standing.event ? standing.event : 'THE SEASON',
    both: true,
    rows: [
      row('SEASON RECORD', metrics.record ? recordText(metrics.record) : null),
      row('EVENT RANK', standing && standing.rank !== null ? ordinal(standing.rank) + (standing.of === null ? '' : ' OF ' + standing.of) : null, standing && standing.rank !== null ? ordinal(standing.rank) : null),
      row('RANKING POINTS', standing ? oneDecimal(standing.rankingPoints) : null),
      row('AVG SCORE, LAST ' + results.count, results.average === null ? null : String(Math.round(results.average)), undefined, 'AVG SCORE'),
      row('STREAK', streak ? (streak.won ? 'WON ' : 'LOST ') + streak.length : null, streak ? (streak.won ? 'W' : 'L') + streak.length : null),
      row('DISTRICT POINTS', district ? district.total + (district.rank === null ? '' : ', RANK ' + district.rank) : null, district ? String(district.total) : null),
    ],
  };
}

function ratingsPages(metrics) {
  const ratings = metrics.ratings;
  const place = ratings ? ratings.place : null;
  const text = value => (ratings ? oneDecimal(value) : null);

  return [
    {
      id: 'ratings',
      sub: 'MATCH13 RATINGS',
      both: true,
      rows: [
        row('xP RATING', text(ratings && ratings.xp)),
        row('AMONG ALL TEAMS', ratings && ratings.topPercent !== null ? 'TOP ' + ratings.topPercent + '%' : null, undefined, 'ALL TEAMS'),
        row('SEASON RANK', ratings && ratings.seasonRank !== null ? ordinal(ratings.seasonRank) : null),
        row('AT THE EVENT', place ? ordinal(place.rank) + (place.of === null ? '' : ' OF ' + place.of) : null, place ? ordinal(place.rank) : null),
        row('EPA', text(ratings && ratings.epa)),
      ],
    },
    {
      id: 'phases',
      sub: 'MATCH13 PER MATCH',
      both: true,
      rows: [
        row('AUTO', text(ratings && ratings.auto)),
        row('TELEOP', text(ratings && ratings.tele)),
        row('ENDGAME', text(ratings && ratings.end)),
        row('OPR', text(ratings && ratings.opr)),
        row('DPR', text(ratings && ratings.dpr)),
      ],
    },
  ];
}

function nextPage(metrics) {
  const next = metrics.next;
  if (!next) return null;

  const chance = percentOf(next.chance);
  const score = next.ourScore !== null && next.theirScore !== null ? Math.round(next.ourScore) + ' TO ' + Math.round(next.theirScore) : null;
  return {
    id: 'next',
    sub: 'NEXT MATCH',
    time: next.time,
    both: true,
    rows: [
      row('MATCH', next.label === '' ? null : next.label),
      row('WIN CHANCE', chance === null ? null : chance + (next.estimate ? ' ESTIMATE' : ''), chance, undefined),
      row('EXPECTED SCORE', score, score === null ? null : Math.round(next.ourScore) + '-' + Math.round(next.theirScore), 'EXPECTED'),
    ].concat(sidesRows(next.sides)),
  };
}

function aheadPage(metrics) {
  const ahead = metrics.ahead;
  if (!ahead) return null;

  const pick = found => (found ? found.label + ', ' + percentOf(found.chance) : null);
  return {
    id: 'ahead',
    sub: 'MATCHES TO PLAY',
    both: true,
    rows: [row('MATCHES LEFT', String(ahead.count)), row('EXPECTED RECORD', ahead.record ? ahead.record.wins + '-' + ahead.record.losses : null)].concat(
      sidesRows(ahead.sides),
      [row('HARDEST', pick(ahead.hardest), ahead.hardest ? percentOf(ahead.hardest.chance) : null), row('EASIEST', pick(ahead.easiest), ahead.easiest ? percentOf(ahead.easiest.chance) : null)]
    ),
  };
}

function lastPage(metrics) {
  const last = metrics.results.lastThree;
  if (last.length === 0) return null;

  return {
    id: 'last',
    sub: 'LAST ' + last.length + (last.length === 1 ? ' MATCH' : ' MATCHES') + ', NEWEST FIRST',
    both: false,
    rows: last.map(item => row(item.label, (item.won === null ? 'TIE' : item.won ? 'WON' : 'LOST') + (item.scoreFor === null ? '' : ' ' + item.scoreFor + ' TO ' + item.scoreAgainst) + (item.margin === null ? '' : '  ' + signed(item.margin)))),
  };
}

function historyPage(metrics) {
  if (metrics.history.length === 0) return null;

  return {
    id: 'events',
    sub: 'THE SEASON, EVENT BY EVENT',
    both: false,
    rows: metrics.history.map(item => {
      const parts = [];
      if (item.xpStart !== null && item.xpEnd !== null) parts.push('xP ' + oneDecimal(item.xpStart) + ' TO ' + oneDecimal(item.xpEnd));
      if (item.districtPoints !== null) parts.push(item.districtPoints + ' DISTRICT PTS');
      return Object.assign(row(item.name, item.rank === null ? (item.record ? recordText(item.record) : 'NO RESULT') : 'RANK ' + item.rank + (item.record ? ', ' + recordText(item.record) : '')), { note: parts.join(', ') });
    }),
  };
}

// Whether a page has a number in any row
function hasNumber(page) {
  return page.rows.some(item => item.value !== null);
}

// The pages for one team, in order, without the pages that have nothing at all
export function pagesOf(metrics) {
  if (!metrics) return [];

  return [seasonPage(metrics)].concat(ratingsPages(metrics), [nextPage(metrics), aheadPage(metrics), lastPage(metrics), historyPage(metrics)])
    .filter(page => page !== null && hasNumber(page));
}

// The pages the two teams share, in the order of the first team's pages. A page is kept when either team has a number on it.
export function comparePages(first, second) {
  const other = pagesOf(second);
  const ours = pagesOf(first);
  const ids = ours.concat(other).filter(page => page.both).map(page => page.id);
  const order = ['season', 'ratings', 'phases', 'next', 'ahead'].filter(id => ids.includes(id));

  const blank = id => ({ id: id, rows: [] });
  return order.map(id => ({ id: id, first: ours.find(page => page.id === id) || blank(id), second: other.find(page => page.id === id) || blank(id) }));
}

// Whether the team has anything to show on a card
export function hasMetrics(frc, code) {
  return pagesOf(metricsFor(frc, code)).length > 0;
}

// The two teams of the comparison, in the order of frc-status (Prime and then Nova), or none when it holds fewer than two
export function compareTeams(frc) {
  const teams = frc && Array.isArray(frc.teams) ? frc.teams : [];
  return teams.length >= 2 ? teams.slice(0, 2) : [];
}
