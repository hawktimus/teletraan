// Text fits. Every chip, label and header is measured with the font that draws it, and has to fit its box with 8px to
// spare. The countdown title wraps by its own rule and is never cut off, and the department labels of the Monday panels
// fit the longest department name.

import { titleLines } from '../../dashboard/core/countdown-title.js';
import { titleRooms, titleSpacing } from '../../dashboard/core/countdown-title.js';

const spare = 8;
// The title of a panel has titleRoom (dashboard/core/header-room.js) and then 16px before the metal of the line that
// ends its tab. LEADERSHIP at 96px is 650.6 wide in 656, so it keeps 5.4px of its box and 21.4px to the metal.
const titleClearance = 16;
const round = value => Math.round(value * 10) / 10;

const looks = ['original', 'cybertron', 'retro', 'minimal'];
// The panels of the large and small areas and the Monday cards. The other looks see the ones that differ most.
const panels = ['tasks', 'events', 'leadership', 'team-leads', 'roster', 'spotlight', 'sponsor-feature', 'photo', 'next-event', 'task-counts', 'forecast', 'safety-days', 'monday-tasks', 'monday-done', 'monday-status-depts', 'monday-overall', 'monday-timeline', 'monday-board', 'monday-milestones-both', 'monday-progress-both'];
const otherLooks = ['tasks', 'events', 'leadership', 'monday-tasks', 'monday-board', 'monday-status-depts'];
const mondayPanels = panels.filter(panel => panel.startsWith('monday-'));
// The widest department there is, according to dashboard/core/header-room.js
const longestDepartment = 'Programming';

// A panel in a look, read for chips, labels and headers, or for the labels of departments. The department labels are read
// with the widest department name in place of the first one.
async function readPanel(ctx, panel, look, departments) {
  const page = await ctx.open({ panel: panel, style: look, still: '1' }, undefined, {
    settleMs: 300,
    content: content => { if (departments && content.subteams && content.subteams[0]) content.subteams[0].name = longestDepartment; },
  });
  try {
    return await page.evaluate(read => window.__motion.textFits(read), { spare: spare, clearance: titleClearance, only: departments ? '[class*="department"]' : '' });
  } catch (error) {
    return { error: 'the ' + panel + ' panel in ' + look + ' could not be measured: ' + String(error.message).split('\n')[0] };
  } finally {
    await page.close();
  }
}

// What the order sets and the rule cannot both have. Each one is a line in the README and the report, and it holds only
// up to the amount, so that it cannot grow unseen.
const knownTight = [
  { panel: 'monday-tasks', name: '.chip-overdue', kind: 'parent', most: 24, reason: 'the order sets the due column at 290px and OVERDUE with the date needs 313px' },
];

function fitLines(found, panel) {
  return found
    .filter(item => !knownTight.some(known => known.panel === panel && item.name.includes(known.name) && item.kind === known.kind && item.amount <= known.most))
    .map(item => panel + ' ' + item.name + ' "' + item.text + '" at ' + item.size + ': ' + item.problem);
}

function panelRules() {
  const rules = [];
  looks.forEach(look => {
    (look === 'original' ? panels : otherLooks).forEach(panel => {
      rules.push({
        name: 'text-fits/' + look + '/' + panel,
        async run(ctx) {
          const found = await ctx.scenario('text ' + look + ' ' + panel, () => readPanel(ctx, panel, look, false));
          return found.error ? [found.error] : fitLines(found, panel);
        },
      });
      // The labels of departments are the elements with the word department in their class
      if (panel.startsWith('monday-')) {
        rules.push({
          name: 'monday-departments/' + look + '/' + panel,
          async run(ctx) {
            const found = await ctx.scenario('departments ' + look + ' ' + panel, () => readPanel(ctx, panel, look, true));
            return found.error ? [found.error] : fitLines(found, panel);
          },
        });
      }
    });
  });
  return rules;
}

// A title as short as one word, and ones too long for the first line and for the second
const countdownTitles = ['KICKOFF', 'COMPETITION SEASON KICKOFF', 'KICKOFF OF THE COMPETITION SEASON AT THE SCHOOL', 'THE VERY LONG TITLE OF THE KICKOFF EVENT OF THE 2027 SEASON IN THE GYM'];
const clocks = [{ look: 'original', form: 'original' }, { look: 'cybertron', form: 'wide' }, { look: 'bar', form: 'narrow' }];

async function readTitle(ctx, clock, title) {
  const page = await ctx.open({}, undefined, {
    settleMs: 800,
    look: clock.look,
    content: content => { content.settings = Object.assign({}, content.settings, { kickoffLabel: title }); },
  });
  try {
    return await page.evaluate(() => window.__motion.countdownTitle());
  } finally {
    await page.close();
  }
}

function countdownRules() {
  return clocks.map(clock => ({
    name: 'countdown-title/' + clock.look,
    async run(ctx) {
      const failures = [];
      const room = titleRooms[clock.form === 'original' ? 'original' : clock.form];
      const spacing = titleSpacing[clock.form === 'original' ? 'original' : clock.form];

      for (const title of countdownTitles) {
        const read = await readTitle(ctx, clock, title);
        if (!read) {
          failures.push('countdown at 0 ms: the ' + clock.look + ' look draws no countdown');
          continue;
        }
        const shown = read.lines.join(' ');
        const rule = titleLines(title, read.date, room, spacing);

        if (read.cutWidth > 1) failures.push(read.name + ' "' + shown + '": the title is cut off, ' + round(read.cutWidth) + 'px of its width show nothing');
        if (read.cutHeight > 1) failures.push(read.name + ' "' + shown + '": the title is cut off, ' + round(read.cutHeight) + 'px of its height show nothing');
        if (read.widest > room - 0.5) failures.push(read.name + ' "' + shown + '": a line is ' + round(read.widest) + 'px wide, the room of the ' + clock.form + ' clock is ' + room + 'px');
        if (read.form !== 'original' && read.lines.length !== rule.lines.length) failures.push(read.name + ' "' + shown + '": it has ' + read.lines.length + ' lines, the rule gives ' + rule.lines.length);
        if (read.form !== 'original' && read.size !== rule.size) failures.push(read.name + ' "' + shown + '": it is ' + read.size + 'px, the rule gives ' + rule.size + 'px');
      }
      return failures;
    },
  }));
}

export const tests = panelRules().concat(countdownRules());
