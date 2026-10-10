// What the Mini read about the competition, in one document with the fixed id
// 'frc-status'. deploy/scripts/frc-sync.sh writes it as a whole, so editors never
// open it: it is not in the sidebar or the New menu (structure.js,
// sanity.config.js). The connection block on the Competition tab of Dashboard
// Settings shows when it was last written (settingsCompetition.js), and the
// dashboard reads it to draw the competition cards (dashboard/core/frc.js).
//
// It holds team numbers, team nicknames, match numbers and times, scores, ranks,
// award names and ratings, and no person's name. The dataset is public, so anyone
// can read it. Every field is optional, because a value the Mini did not find is
// left out and never made up. The fields are described in docs/frc-feed.md.

import { defineType, defineField, defineArrayMember } from 'sanity';

function numberField(name, title, description) {
  return defineField({ name: name, title: title, type: 'number', description: description });
}

function textField(name, title, description) {
  return defineField({ name: name, title: title, type: 'string', description: description });
}

function dateField(name, title, description) {
  return defineField({ name: name, title: title, type: 'date', description: description });
}

function listOf(name, title, description, fields) {
  return defineField({
    name: name,
    title: title,
    type: 'array',
    description: description,
    of: [defineArrayMember({ type: 'object', title: title, fields: fields })],
  });
}

function objectOf(name, title, description, fields) {
  return defineField({ name: name, title: title, type: 'object', description: description, fields: fields });
}

const recordFields = [
  numberField('wins', 'Wins', 'Matches won.'),
  numberField('losses', 'Losses', 'Matches lost.'),
  numberField('ties', 'Ties', 'Matches tied.'),
];

const personFields = [
  numberField('number', 'Team number', 'The number of a team in the match or the alliance.'),
  textField('nickname', 'Team nickname', 'The short name the team uses.'),
  numberField('epa', 'EPA', 'The expected points added of this team, when it was read. Most are empty.'),
];

const eventFields = [
  textField('key', 'Event key', 'The code of the event, such as 2027ncwak.'),
  textField('name', 'Event name', 'The name of the event.'),
  textField('city', 'City', 'The city the event is in.'),
  dateField('startDate', 'First day', 'The first day of the event.'),
  dateField('endDate', 'Last day', 'The last day of the event.'),
  numberField('rank', 'Rank', 'The rank of the team at the event.'),
  numberField('teamsRanked', 'Teams ranked', 'How many teams are in the rankings of the event.'),
  numberField('matchesPlayed', 'Matches played', 'How many qualification matches the team has played.'),
  objectOf('record', 'Record', 'Wins, losses and ties of the team at the event.', recordFields),
  numberField('rankingPoints', 'Ranking points', 'The ranking score of the team at the event.'),
  numberField('epa', 'EPA', 'The expected points added of the team during the event, as last read.'),
];

const teamFields = [
  textField('team', 'Team code', 'The code of the team in Studio, such as prime.'),
  numberField('number', 'Team number', 'The FRC number of the team.'),
  textField('key', 'Team key', 'The key the sources use, such as frc3229.'),
  listOf('events', 'Events', 'The events of the team this season, earliest first.', eventFields),
  textField('focusEvent', 'Event now', 'The first event that is not over. The fields below are about it.'),
  objectOf('nextMatch', 'Next match', 'The next match the team plays.', [
    textField('match', 'Match key', 'The code of the match.'),
    textField('label', 'Match label', 'The short name of the match, such as Q12.'),
    textField('level', 'Level', 'The kind of match, such as qm for a qualification match.'),
    numberField('number', 'Match number', 'The number of the match in its kind.'),
    defineField({ name: 'time', title: 'Time', type: 'datetime', description: 'When the match is planned to start.' }),
    textField('alliance', 'Alliance colour', 'Red or blue: the colour of the team in this match.'),
    listOf('red', 'Red alliance', 'The three teams on the red alliance.', personFields),
    listOf('blue', 'Blue alliance', 'The three teams on the blue alliance.', personFields),
    numberField('redWinProbability', 'Red win chance', 'The chance that red wins, from 0 to 1. Empty when it is not known.'),
  ]),
  listOf('results', 'Results', 'The last 8 matches played, oldest first.', [
    textField('match', 'Match key', 'The code of the match.'),
    textField('label', 'Match label', 'The short name of the match, such as Q12.'),
    textField('alliance', 'Alliance colour', 'Red or blue: the colour of the team in this match.'),
    numberField('scoreFor', 'Score for', 'The score of the alliance of the team.'),
    numberField('scoreAgainst', 'Score against', 'The score of the other alliance.'),
    defineField({ name: 'won', title: 'Won', type: 'boolean', description: 'True when the team won, false when it lost, empty for a tie.' }),
  ]),
  objectOf('ranking', 'Ranking', 'The rank of the team at the event now.', [
    textField('event', 'Event key', 'The event the rank is from.'),
    numberField('rank', 'Rank', 'The rank of the team.'),
    numberField('teamsRanked', 'Teams ranked', 'How many teams are ranked.'),
    numberField('matchesPlayed', 'Matches played', 'How many qualification matches the team has played.'),
    objectOf('record', 'Record', 'Wins, losses and ties of the team.', recordFields),
    numberField('rankingPoints', 'Ranking points', 'The ranking score of the team.'),
  ]),
  objectOf('alliance', 'Alliance', 'The alliance selection, once it has been made.', [
    textField('event', 'Event key', 'The event the selection is from.'),
    numberField('number', 'Alliance number', 'The number of the alliance of the team. Empty when it was not picked.'),
    listOf('picks', 'Teams', 'The teams on that alliance.', personFields),
  ]),
  listOf('awards', 'Awards', 'The awards the team won this season.', [
    textField('name', 'Award', 'The name of the award.'),
    textField('event', 'Event key', 'The event the award was won at.'),
  ]),
  numberField('epa', 'EPA', 'The expected points added of the team this season.'),
  objectOf('districtPoints', 'District points', 'The district points of the team.', [
    numberField('total', 'Total', 'The points of the team.'),
    numberField('rank', 'Rank', 'The rank of the team in the district.'),
    numberField('cutoff', 'Cutoff', 'The points of the last team that reaches the state championship. Empty when not known.'),
  ]),
  listOf('snapshots', 'Daily snapshots', 'One entry a day, 120 at most.', [
    dateField('date', 'Date', 'The day of the snapshot.'),
    numberField('epa', 'EPA', 'The expected points added of the team that day.'),
    numberField('districtPoints', 'District points', 'The district points of the team that day.'),
  ]),
  objectOf('lastSeason', 'Last season', 'The events of the season before, kept when the year changes.', [
    numberField('season', 'Season', 'The year of that season.'),
    listOf('events', 'Events', 'The events of that season.', eventFields),
  ]),
];

export default defineType({
  name: 'frcStatus',
  title: 'FRC data from the Mini',
  type: 'document',
  readOnly: true,
  // Keeps it out of Studio's search, so it is not found by accident
  __experimental_omnisearch_visibility: false,
  fields: [
    numberField('season', 'Season', 'The year of the season that was read.'),
    defineField({ name: 'lastSyncAt', title: 'Last sync', type: 'datetime', description: 'When the Mini last wrote this. The Mini writes it.' }),
    textField('lastError', 'Last error', 'What went wrong in the last run, in plain words. Empty when nothing did.'),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'array',
      description: 'Things that are not errors, such as a source being skipped for one run.',
      of: [defineArrayMember({ type: 'string' })],
    }),
    listOf('districtEvents', 'District events', 'The events of the district, with the championship marked.', [
      textField('key', 'Event key', 'The code of the event.'),
      textField('name', 'Event name', 'The name of the event.'),
      textField('city', 'City', 'The city the event is in.'),
      dateField('startDate', 'First day', 'The first day of the event.'),
      dateField('endDate', 'Last day', 'The last day of the event.'),
      defineField({ name: 'championship', title: 'Championship', type: 'boolean', description: 'True for the district championship.' }),
    ]),
    listOf('teams', 'Teams', 'One entry for each team that was read.', teamFields),
  ],
  preview: {
    prepare: () => ({ title: 'FRC data from the Mini' }),
  },
});
