// The Competition tab of Dashboard Settings: the competition cards that show the
// season, the next match, the rank and the results (docs/frc-feed.md). It has:
//
//   frcConnection      a read only block that says when the Teletraan computer last read the competition
//                      data (../frc-status-input.js). It stores nothing
//   competitionMode    auto (the cards come two days before a team event and take priority
//                      during it), always, off, or around (Before and after: a preview for the
//                      14 days before an event, nothing while it is on, a recap for the 7 days after).
//                      around is the starting value. A document that already stores a mode keeps it
//   one switch for each card, all on to start with
//
// The mode and the switches are the same names, choices and starting values as the
// competitionModes list, competitionSwitches and defaultSettings in dashboard/config.js.
// tests/schemas.test.mjs fails if they differ.
//
// None of the fields is required. Dashboard Settings published before these fields existed
// has none, and the screen reads that as Auto with every card on. A required field would
// stop that page being published until somebody filled it in.
//
// To take the whole section out later: delete this file, remove its import and the line that
// uses competitionFields in dashboardSettings.js, and remove the same names from
// tests/schemas.test.mjs and config.js. The dashboard uses the starting values for anything
// missing from the published settings.

import { defineField } from 'sanity';
import { FrcStatusInput } from '../inputs/frc-status-input.js';

// The values are the names in competitionModes in dashboard/config.js
const modes = [
  { title: 'Auto', value: 'auto' },
  { title: 'Always', value: 'always' },
  { title: 'Off', value: 'off' },
  { title: 'Before and after (recommended)', value: 'around' },
];

// One for each card, in the order the cards are listed in dashboard/core/competition.js
const cards = [
  { name: 'competitionTimeline', title: 'Season timeline', description: 'A line from today to the next dates, each with the days left. In Auto it runs all season.' },
  { name: 'competitionLastSeason', title: 'Last season at a glance', description: 'Record, rank at each event and the EPA line of last season. In Auto it shows until the first event starts.' },
  { name: 'competitionRank', title: 'Live rank', description: 'Rank, record and ranking points. In Auto it shows from two days before an event to its last day.' },
  { name: 'competitionNextMatch', title: 'Next match', description: 'The next match, its partners, opponents and win chance. In Auto it is the first card during an event.' },
  { name: 'competitionResults', title: 'Results strip', description: 'The last 8 matches as red or blue chips with the score. In Auto it shows from two days before an event to its last day.' },
  { name: 'competitionAlliance', title: 'Alliance board', description: 'The alliance number and its partners. In Auto it shows during an event, once the selection is made.' },
  { name: 'competitionDistrict', title: 'District points', description: 'Points against the cutoff for the state championship. In Auto it shows all season once the first event has started.' },
  { name: 'competitionPreview', title: 'Event preview', description: 'The next event, the days left, the strength of the field by EPA and the season trend. In Before and after it shows from 14 days before an event.' },
  { name: 'competitionMatches', title: 'Our matches', description: 'Our qualification matches with the chance of winning each. In Before and after it shows once the schedule is posted, usually the evening before.' },
  { name: 'competitionRecap', title: 'Event recap', description: 'The final rank, record, awards and the change in EPA. In Before and after it shows for 7 days after an event.' },
  { name: 'competitionForecast', title: 'Event forecast (Match13)', description: 'Where Match13 expects each team to finish the event. Needs the Match13 key. In Auto it shows from two days before an event.' },
  { name: 'competitionQualify', title: 'Championship chances (Match13)', description: 'The chance of the District and World Championship. Needs the Match13 key. In Auto it shows once the first event has started.' },
  { name: 'competitionTeamMetrics', title: 'Team metrics (Match13 and TBA)', description: 'Record, rank, Match13 rating, next match and last matches of the team on screen. Needs the Match13 key. In Before and after and in Always, not in Auto.' },
  { name: 'competitionCompare', title: 'Both teams side by side', description: 'Prime and Nova next to each other, each in its own color: record, rank, rating and next match. In Before and after and in Always, not in Auto.' },
];

export function competitionFields() {
  const fields = [
    defineField({
      name: 'frcConnection',
      title: 'Competition data from the Teletraan computer',
      type: 'string',
      group: 'competition',
      readOnly: true,
      description: 'When the Teletraan computer last read the competition data. The computer writes this by itself, so there is nothing to type here.',
      components: { input: FrcStatusInput },
    }),

    defineField({
      name: 'competitionMode',
      title: 'Competition cards',
      type: 'string',
      group: 'competition',
      description: 'Before and after: preview, then nothing during the event, then a recap. Auto: older cards from 2 days before. Always: every card with data. Off: none.',
      options: { list: modes, layout: 'radio', direction: 'horizontal' },
      initialValue: 'around',
      validation: Rule => Rule.valid(modes.map(mode => mode.value)).error('Pick Auto, Always, Off or Before and after.'),
    }),
  ];

  cards.forEach(card => {
    fields.push(defineField({
      name: card.name,
      title: card.title,
      type: 'boolean',
      group: 'competition',
      description: card.description,
      initialValue: true,
    }));
  });
  return fields;
}
