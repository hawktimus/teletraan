// Turns one past event, read by deploy/scripts/frc-sync.sh --event <key> --to <file>, into the fixture
// the competition cards draw in ?sample=1 (dashboard/data/sample/frc-event.json). Team numbers are kept
// and team names are left as The Blue Alliance has them: both are public.
//
//   node tools/frc-fixture.mjs <event.json> [--prime <number>] [--nova <number>] [--out <file>]
//
// The two teams of the screen take the places of two teams at the event: --prime and --nova say which,
// and without them the two best ranked teams at the event are used. The answer holds no ratings, so the
// ratings and the win chance stay empty, as they do on the Mini before Statbotics answers.
//
// The shape is the one core/frc.js reads, with { placeholder, event, source, frc } around it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const levels = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };
const labelPrefix = { qm: 'Q', ef: 'EF', qf: 'QF', sf: 'SF', f: 'F' };

function list(value) {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

function numberOf(teamKey) {
  const match = /^frc([1-9][0-9]{0,4})$/.exec(String(teamKey));
  return match ? Number(match[1]) : null;
}

function plainDate(text) {
  return typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function isoTime(seconds) {
  return typeof seconds === 'number' && isFinite(seconds) ? new Date(seconds * 1000).toISOString().replace('.000Z', 'Z') : '';
}

function matchLabel(match) {
  const prefix = labelPrefix[match.comp_level] || String(match.comp_level || '').toUpperCase();
  if (match.comp_level === 'qm') return prefix + match.match_number;
  return prefix + match.set_number + '-' + match.match_number;
}

function orderOf(match) {
  return [levels[match.comp_level] === undefined ? 5 : levels[match.comp_level], match.set_number || 0, match.match_number || 0];
}

function byOrder(first, second) {
  const a = orderOf(first);
  const b = orderOf(second);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function played(match) {
  const red = match.alliances && match.alliances.red;
  const blue = match.alliances && match.alliances.blue;
  return Boolean(red && blue) && red.score >= 0 && blue.score >= 0;
}

function sideOf(match, key) {
  if (match.alliances.red.team_keys.includes(key)) return 'red';
  return match.alliances.blue.team_keys.includes(key) ? 'blue' : '';
}

// The two teams that play the parts of Prime and Nova: the numbers asked for, else the best ranked
export function chooseTeams(answer, options = {}) {
  const ranked = list((answer.rankings || {}).rankings).sort((first, second) => first.rank - second.rank).map(row => numberOf(row.team_key)).filter(Boolean);
  const known = list(answer.teams).map(team => team.team_number).filter(Boolean);
  const fallback = ranked.concat(known.filter(number => !ranked.includes(number)));

  const prime = options.prime || fallback[0];
  const nova = options.nova || fallback.filter(number => number !== prime)[0];
  if (!prime || !nova) throw new Error('The event has fewer than two teams, so the fixture has nobody to play Prime and Nova.');
  return { prime: Number(prime), nova: Number(nova) };
}

function personOf(teamKey, nicknames) {
  const number = numberOf(teamKey);
  return { number: number, nickname: nicknames[number] || '', epa: null };
}

function eventShape(event, ranking) {
  const shape = {
    key: event.key,
    name: event.name || '',
    city: event.city || '',
    startDate: plainDate(event.start_date),
    endDate: plainDate(event.end_date),
  };
  if (event.short_name) shape.shortName = event.short_name;
  if (ranking) {
    shape.rank = ranking.rank;
    shape.teamsRanked = ranking.teamsRanked;
    shape.matchesPlayed = ranking.matchesPlayed;
    shape.record = ranking.record;
    shape.rankingPoints = ranking.rankingPoints;
    shape.epa = null;
  }
  return shape;
}

function entryFor(role, number, answer, nicknames) {
  const key = 'frc' + number;
  const event = answer.event;
  const rows = list((answer.rankings || {}).rankings);
  const row = rows.find(item => item.team_key === key);
  const ranking = row ? {
    event: event.key,
    rank: row.rank,
    teamsRanked: rows.length,
    matchesPlayed: row.matches_played,
    record: { wins: row.record.wins, losses: row.record.losses, ties: row.record.ties },
    rankingPoints: Array.isArray(row.sort_orders) && typeof row.sort_orders[0] === 'number' ? row.sort_orders[0] : null,
  } : null;

  const mine = list(answer.matches).filter(match => match.alliances && sideOf(match, key)).sort(byOrder);
  const done = mine.filter(played);
  const results = done.slice(-8).map(match => {
    const side = sideOf(match, key);
    const other = side === 'red' ? 'blue' : 'red';
    const won = match.winning_alliance === '' || !match.winning_alliance ? null : match.winning_alliance === side;
    return { match: match.key, label: matchLabel(match), alliance: side, scoreFor: match.alliances[side].score, scoreAgainst: match.alliances[other].score, won: won };
  });

  // The event is over, so the match that stands in for the next one is the last the team played
  const last = done[done.length - 1];
  const nextMatch = last ? {
    match: last.key,
    label: matchLabel(last),
    level: last.comp_level,
    number: last.match_number,
    time: isoTime(last.time || last.actual_time || last.predicted_time),
    alliance: sideOf(last, key),
    red: last.alliances.red.team_keys.map(item => personOf(item, nicknames)),
    blue: last.alliances.blue.team_keys.map(item => personOf(item, nicknames)),
    redWinProbability: null,
  } : null;

  const allianceIndex = list(answer.alliances).findIndex(alliance => Array.isArray(alliance.picks) && alliance.picks.includes(key));
  const alliance = allianceIndex === -1 ? null : { event: event.key, number: allianceIndex + 1, picks: answer.alliances[allianceIndex].picks.map(item => personOf(item, nicknames)) };

  const awards = list(answer.awards)
    .filter(award => list(award.recipient_list).some(recipient => recipient.team_key === key))
    .map(award => ({ name: award.name, event: event.key }));

  const points = list(answer.districtRankings).find(item => item.team_key === key);
  const districtPoints = points ? { total: points.point_total, rank: points.rank, cutoff: null } : null;

  const entry = eventShape(event, ranking);
  return {
    team: role,
    number: number,
    events: [entry],
    focusEvent: event.key,
    nextMatch: nextMatch,
    results: results,
    ranking: ranking,
    alliance: alliance,
    awards: awards,
    epa: null,
    districtPoints: districtPoints,
    snapshots: [],
    // The same event is last season for a fixture of a past year, so that card has something to draw
    lastSeason: { season: Number(String(event.key).slice(0, 4)), events: [entry] },
  };
}

// answer is the file frc-sync.sh --event wrote. options: { prime, nova }.
export function buildFixture(answer, options = {}) {
  if (!answer || typeof answer !== 'object' || !answer.event || typeof answer.event.key !== 'string') {
    throw new Error('This is not a file from frc-sync.sh --event: it has no event.');
  }

  const nicknames = {};
  list(answer.teams).forEach(team => { nicknames[team.team_number] = team.nickname || ''; });

  const chosen = chooseTeams(answer, options);
  const event = answer.event;
  const season = Number(event.key.slice(0, 4));

  return {
    placeholder: false,
    event: event.key,
    source: 'The Blue Alliance',
    frc: {
      sample: true,
      season: season,
      lastSyncAt: isoTime(Math.floor(new Date(plainDate(event.end_date) + 'T23:00:00Z').getTime() / 1000)),
      notes: [],
      districtEvents: [Object.assign(eventShape(event, null), { championship: event.event_type === 2 || event.event_type === 5 })],
      teams: [entryFor('prime', chosen.prime, answer, nicknames), entryFor('nova', chosen.nova, answer, nicknames)],
    },
  };
}

function readArguments(argv) {
  const options = { file: '', out: '' };

  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (name === '--prime' || name === '--nova' || name === '--out') {
      const value = argv[++i];
      if (value === undefined) throw new Error(name + ' needs a value.');
      if (name === '--out') options.out = value;
      else options[name.slice(2)] = Number(value);
    } else if (!name.startsWith('--') && options.file === '') {
      options.file = name;
    } else {
      throw new Error('Usage: node tools/frc-fixture.mjs <event.json> [--prime <number>] [--nova <number>] [--out <file>]');
    }
  }
  if (options.file === '') throw new Error('Usage: node tools/frc-fixture.mjs <event.json> [--prime <number>] [--nova <number>] [--out <file>]');
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = readArguments(process.argv.slice(2));
    const out = options.out || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard', 'data', 'sample', 'frc-event.json');
    const fixture = buildFixture(JSON.parse(fs.readFileSync(options.file, 'utf8')), options);

    fs.writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n');
    console.log('Wrote ' + fixture.event + ' to ' + out + ' (Prime is ' + fixture.frc.teams[0].number + ', Nova is ' + fixture.frc.teams[1].number + ').');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
