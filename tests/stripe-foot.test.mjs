// Tests for the foot of the large frame: Cybertron draws a row of neon slashes along it, and the last row of
// every large panel must end above them, in every style and layout, with both teams. The slashes come from
// core/plate.js (cybertron-grid1, and its turned form for a team with the other corners cut). The boxes of the
// pages are in each panel's stylesheet, with the Cybertron numbers in styles/cybertron/theme.css, and the rows of a
// box are added up here the way the page stacks them. Nothing touches the network or a browser.
//
//   node tests/stripe-foot.test.mjs
//
// What it looks like is checked by looking at the screen (docs/layouts.md, "Looking at a layout").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-stripe-foot-'));
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
['config.js', 'core/plate.js', 'core/teams.js', 'core/style.js'].forEach(file => {
  copyModule(path.join(root, 'dashboard', file), path.join(workFolder, 'dashboard', file));
});

const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const plate = await import(base + 'core/plate.js');
const teamsModule = await import(base + 'core/teams.js');
const styleModule = await import(base + 'core/style.js');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

// The declarations of the rule with exactly this selector, as { property: value }, or {} when there is none
function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|\\})\\s*' + escaped + '\\s*\\{([^}]*)\\}').exec(withoutComments(css));
  const out = {};
  if (!found) return out;
  found[1].split(';').forEach(part => {
    const at = part.indexOf(':');
    if (at > 0) out[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  });
  return out;
}

const pixels = value => (String(value).trim() === '0' ? 0 : Number(/(-?\d+(?:\.\d+)?)px/.exec(String(value))[1]));
// the line height of a font shorthand: 600 44px/48px family
const lineOf = font => Number(/\/(\d+)px/.exec(font)[1]);

const cybertron = (read('dashboard/styles/cybertron/tokens.css') + read('dashboard/styles/cybertron/theme.css'));
const panelCss = name => read('dashboard/panels/' + name + '/panel.css');
const sheets = { base: read('dashboard/base.css'), monday: read('dashboard/monday.css') };

// The value of a property for a panel in a style: the Cybertron rule when the style is Cybertron and it has
// one, and the panel's own stylesheet otherwise. selector is the one the panel's stylesheet uses.
function valueIn(style, sheet, selector, property) {
  const own = style === 'cybertron' ? rule(cybertron, 'html[data-style="cybertron"] ' + selector)[property] : undefined;
  return own !== undefined ? own : rule(sheet, selector)[property];
}

// The line height of a text: its own line-height when the style gives one, and else the sheet's, which is a
// line-height or the one in the font shorthand
function lineIn(style, sheet, selector) {
  const own = style === 'cybertron' ? rule(cybertron, 'html[data-style="cybertron"] ' + selector)['line-height'] : undefined;
  const found = rule(sheet, selector);
  if (own !== undefined) return pixels(own);
  return found['line-height'] !== undefined ? pixels(found['line-height']) : lineOf(found.font);
}

// The styles, the layouts each has with the layouts a theme can name, and the two teams of the seed file. The
// frame of each is the one the page draws (core/plate.js, frameKind).
const styles = ['original', 'cybertron', 'minimal'].map(name => ({
  name: name,
  shapes: styleModule.shapesFor(name),
  layouts: Array.from(new Set(['standard', 'sidebar'].map(theme => styleModule.layoutFor(name, theme)))),
}));
const seeded = read('docs/seed/teams.ndjson').trim().split('\n').map(line => JSON.parse(line));
const teams = seeded.map(team => ({ name: team.shortName, trim: teamsModule.frameTrim(team) }));

// The top and the sides of the slashes of a frame, or null when it has none
function stripeOf(kind) {
  const shape = plate.barShape(kind);
  if (!shape || !shape.art.slashes) return null;

  const points = shape.art.slashes.match(/[ML][\d.]+ [\d.]+/g).map(point => point.slice(1).split(' ').map(Number));
  return { left: Math.min(...points.map(point => point[0])), right: Math.max(...points.map(point => point[0])), top: Math.min(...points.map(point => point[1])), bottom: Math.max(...points.map(point => point[1])) };
}

const frameOf = (style, layout, team) => plate.frameKind('grid1', layout, style.shapes, team.trim);

const bodyHeight = 576; // the rows of the people panels are the body divided by the rows, in Original
const rowCounts = [4, 3, 2, 1];

// The bottom of the last row, or of the last line, of each large panel, in pixels down the frame, from the
// numbers of the stylesheets. The page is the frame's own size, so these are also the places in the frame.
const panels = {
  tasks: style => {
    const box = '.tasks .rows';
    const top = pixels(valueIn(style, panelCss('tasks'), box, 'top'));
    const row = pixels(valueIn(style, panelCss('tasks'), '.tasks .row', 'height'));
    return { bottom: top + 3 * row, box: top + pixels(valueIn(style, panelCss('tasks'), box, 'height')), top: top };
  },
  events: style => {
    const top = pixels(valueIn(style, panelCss('events'), '.events .rows', 'top'));
    const row = pixels(valueIn(style, panelCss('events'), '.events .row', 'height'));
    return { bottom: top + 4 * row, box: top + pixels(valueIn(style, panelCss('events'), '.events .rows', 'height')), top: top };
  },
  tonight: style => {
    const top = pixels(valueIn(style, panelCss('tonight'), '.tonight .rows', 'top'));
    const height = pixels(valueIn(style, panelCss('tonight'), '.tonight .rows', 'height'));
    return { bottom: top + height, box: top + height, top: top };
  },
  spotlight: style => {
    const top = pixels(valueIn(style, panelCss('spotlight'), '.spotlight .story', 'top'));
    const height = pixels(valueIn(style, panelCss('spotlight'), '.spotlight .story', 'height'));
    return { bottom: top + height, box: top + height, top: top };
  },
  'sponsor-feature': style => {
    const top = pixels(valueIn(style, panelCss('sponsor-feature'), '.sponsor-feature .story', 'top'));
    const height = pixels(valueIn(style, panelCss('sponsor-feature'), '.sponsor-feature .story', 'height'));
    return { bottom: top + height, box: top + height, top: top };
  },
  roster: style => {
    const top = pixels(valueIn(style, panelCss('roster'), '.roster .body', 'top'));
    const height = pixels(valueIn(style, panelCss('roster'), '.roster .body', 'height'));
    return { bottom: top + height, box: top + height, top: top };
  },
  // Drive hours draws the page of the roster board
  driveHours: style => {
    const top = pixels(valueIn(style, panelCss('roster'), '.roster .body', 'top'));
    const height = pixels(valueIn(style, panelCss('roster'), '.roster .body', 'height'));
    return { bottom: top + height, box: top + height, top: top };
  },
  custom: style => {
    const top = pixels(valueIn(style, panelCss('custom'), '.custom .blocks', 'top'));
    const height = pixels(valueIn(style, panelCss('custom'), '.custom .blocks', 'height'));
    return { bottom: top + height, box: top + height, top: top };
  },
  photo: style => {
    // the caption plate stands on a line this far above the foot of the page (708 high)
    const up = pixels(valueIn(style, panelCss('photo'), '.photo .note', 'bottom'));
    return { bottom: 708 - up, box: 708 - up, top: 0 };
  },
};

// The ten cards of the competition and the five of Monday
['alliance', 'district', 'last-season', 'matches', 'next-match', 'preview', 'rank', 'recap', 'results', 'timeline'].forEach(card => {
  const name = 'competition-' + card;
  panels[name] = style => {
    const top = pixels(valueIn(style, panelCss(name), '.' + name + ' .body', 'top'));
    const height = pixels(valueIn(style, panelCss(name), '.' + name + ' .body', 'height'));
    return { bottom: top + height, box: top + height, top: top };
  };
});

// A Monday card: the body is at the same place in every card, and the lowest thing in it is the page marker, at
// the foot of the body, or what a card puts under its rows
const mondayBody = style => {
  const top = pixels(valueIn(style, sheets.monday, '.monday .body', 'top'));
  return { top: top, height: pixels(valueIn(style, sheets.monday, '.monday .body', 'height')) };
};
const factNumber = () => lineOf(rule(sheets.monday, '.monday .fact-number').font);
// The panels of the one task board (docs/monday.md) are in the same body. The numbers of the tasks, done and overall panels are
// under their rows, the legend and the age of the status panel are at its foot, the timeline is its svg (40 over the rows, six rows of 72
// and 24 for TODAY, which is what the script draws) and its legend, and the board is its head and two cards in each column
const mondayLowest = {
  'monday-tasks': (style, body) => body.top + pixels(valueIn(style, panelCss('monday-tasks'), '.monday-tasks .facts', 'top')) + factNumber(),
  'monday-done': (style, body) => body.top + pixels(valueIn(style, panelCss('monday-done'), '.monday-done .facts', 'top')) + factNumber(),
  'monday-status-depts': (style, body) => body.top + Math.max(pixels(rule(panelCss('monday-status-depts'), '.monday-status-depts .legend').top) + lineOf(rule(sheets.monday, '.monday .legend').font), pixels(rule(panelCss('monday-status-depts'), '.monday-status-depts .age').top) + lineOf(rule(panelCss('monday-status-depts'), '.monday-status-depts .age').font)),
  'monday-overall': (style, body) => body.top + pixels(valueIn(style, panelCss('monday-overall'), '.monday-overall .facts', 'top')) + factNumber(),
  'monday-timeline': (style, body) => body.top + (40 + 6 * 72 + 24) + lineOf(rule(sheets.monday, '.monday .legend').font),
  'monday-board': (style, body) => {
    const css = panelCss('monday-board');
    return body.top + pixels(rule(css, '.monday-board .column-head').height) + pixels(rule(css, '.monday-board .column-head')['margin-bottom']) + 2 * (pixels(rule(css, '.monday-board .card').height) + 14) + lineOf(rule(css, '.monday-board .more').font);
  },
  'monday-pie': (style, body) => body.top + 440,
  'monday-milestones': (style, body) => body.top + pixels(valueIn(style, panelCss('monday-milestones'), '.monday-milestones .more', 'top')) + lineOf(rule(panelCss('monday-milestones'), '.monday-milestones .more').font),
  'monday-progress': (style, body) => body.top + pixels(valueIn(style, panelCss('monday-progress'), '.monday-progress .totals', 'top')) + lineOf(rule(panelCss('monday-progress'), '.monday-progress .totals').font),
  'monday-milestones-both': (style, body) => body.top + pixels(rule(sheets.monday, '.monday .rows-window').height),
  'monday-progress-both': (style, body) => body.top + lineOf(rule(panelCss('monday-progress-both'), '.monday-progress-both .legend').font) + pixels(rule(panelCss('monday-progress-both'), '.monday-progress-both .rows-window').height),
};
Object.keys(mondayLowest).forEach(name => {
  panels[name] = style => {
    const body = mondayBody(style);
    // the page marker is at the foot of the body
    return { bottom: Math.max(mondayLowest[name](style, body), body.top + body.height), box: body.top + body.height, top: body.top };
  };
});

// The placeholders draw the body of a Monday card and a dashed frame that fills it
['robotStatus', 'wireframe'].forEach(name => {
  panels[name] = style => {
    const body = mondayBody(style);
    return { bottom: body.top + body.height, box: body.top + body.height, top: body.top };
  };
});

// The rows of Leadership and Team leads, for a page of this many rows
const personRows = (style, count) => {
  const top = pixels(valueIn(style, sheets.base, '.person-rows', 'top'));
  const height = pixels(valueIn(style, sheets.base, '.person-rows', 'height'));
  const own = style === 'cybertron' ? rule(cybertron, 'html[data-style="cybertron"] .person-rows.rows-' + count + ' .person-row').height : undefined;
  const row = own !== undefined ? pixels(own) : bodyHeight / count;
  return { top: top, height: height, row: row, bottom: top + count * row };
};
rowCounts.forEach(count => {
  ['leadership', 'team-leads'].forEach(name => {
    panels[name + ' on pages of ' + count] = style => {
      const found = personRows(style, count);
      return { bottom: found.bottom, box: found.top + found.height, top: found.top };
    };
  });
});

// The frame is 708 high and its line is 4 in from the edge
const frameFoot = 704;

test('the slashes of the large frame stand 668 to 682 down it, at the right end for Prime and the left end for Nova, in both layouts of Cybertron', () => {
  const found = [];
  styles.forEach(style => style.layouts.forEach(layout => teams.forEach(team => {
    const stripe = stripeOf(frameOf(style, layout, team));
    if (style.name === 'cybertron') found.push(team.name + ' ' + layout + ': ' + stripe.top + '-' + stripe.bottom + ' across ' + stripe.left + ' to ' + stripe.right);
    else assert.equal(stripe, null, style.name + ' ' + layout + ' ' + team.name + ' has no slashes');
  })));

  assert.deepEqual(teams.map(team => team.name), ['PRIME', 'NOVA']);
  assert.deepEqual(found, [
    'PRIME standard: 668-682 across 848 to 1080',
    'NOVA standard: 668-682 across 72 to 304',
    'PRIME sidebar: 668-682 across 848 to 1080',
    'NOVA sidebar: 668-682 across 72 to 304',
  ]);
  assert.deepEqual(styles.map(style => style.name + ': ' + style.layouts.join()), ['original: standard,sidebar', 'cybertron: standard,sidebar', 'minimal: bar']);
});

test('the last row of every large panel ends above the slashes, in every style and layout, with both teams', () => {
  let checked = 0;
  styles.forEach(style => style.layouts.forEach(layout => teams.forEach(team => {
    const kind = frameOf(style, layout, team);
    const stripe = stripeOf(kind);

    Object.keys(panels).forEach(name => {
      const found = panels[name](style.name);
      const where = name + ' in ' + style.name + ', ' + layout + ' layout, ' + team.name + ' (' + kind + ')';

      assert.ok(found.bottom <= found.box, where + ': the last row ends at ' + found.bottom + ', past its box at ' + found.box);
      assert.ok(found.bottom <= frameFoot, where + ' ends at ' + found.bottom + ', below the foot of the frame');
      if (stripe) assert.ok(found.bottom <= stripe.top, where + ' ends at ' + found.bottom + ' and the slashes start at ' + stripe.top);
      checked += 1;
    });
  })));

  // Original and Cybertron in two layouts and Minimal in one, with two teams each, and every panel
  assert.equal(checked, (2 + 2 + 1) * 2 * Object.keys(panels).length);
});

test('the pages of Original are as they were: the boxes of the panels end at 700 or below, and the foot of Original has no stripe', () => {
  // The panels' own stylesheets are the ones of Original. Cybertron's numbers are in its own stylesheet.
  assert.equal(panels.tasks('original').bottom, 700);
  assert.equal(panels.events('original').bottom, 700);
  assert.equal(panels.tonight('original').bottom, 692);
  assert.equal(panels.spotlight('original').bottom, 692);
  assert.equal(panels['sponsor-feature']('original').bottom, 692);
  rowCounts.forEach(count => assert.equal(panels['leadership on pages of ' + count]('original').bottom, 700, count + ' rows'));
  assert.equal(panels['monday-tasks']('original').bottom, 676);

  const base = sheets.base;
  assert.equal(rule(base, '.person-rows').top, '124px');
  assert.equal(rule(base, '.person-rows').height, '576px');
  assert.equal(rule(base, '.person-row').height, 'var(--row-height, 144px)');
  assert.equal(rule(panelCss('tasks'), '.tasks .row').height, '192px');
  assert.equal(rule(panelCss('events'), '.events .row').height, '144px');
  assert.equal(rule(sheets.monday, '.monday .body').height, '544px');

  ['grid1', 'grid1-tr', 'grid1-tr-slant'].forEach(kind => assert.equal(stripeOf(kind), null, kind + ' has no slashes'));
});

test('Cybertron: the boxes end at 664, the rows start at 136, 4 under the stripe below the header, and the rows add up to the box', () => {
  const hazardBottom = 120 + 12; // the foot of the header and the stripe under it (core/plate.js, cybertron-grid1)
  const hazard = plate.barShape('cybertron-grid1').art.hazard.match(/L[\d.]+ ([\d.]+)/g).map(point => Number(point.split(' ')[1]));
  assert.equal(Math.max(...hazard), hazardBottom);

  Object.keys(panels).forEach(name => {
    const found = panels[name]('cybertron');
    assert.ok(found.bottom <= 664 && found.box <= 664, name + ' ends at ' + found.bottom + ', and its box at ' + found.box);
  });

  // the rows
  assert.deepEqual([panels.tasks('cybertron').top, panels.events('cybertron').top], [136, 136]);
  assert.equal(panels.tasks('cybertron').bottom, 664);
  assert.equal(panels.events('cybertron').bottom, 664);
  rowCounts.forEach(count => {
    const found = personRows('cybertron', count);
    assert.ok(found.top >= hazardBottom + 4, 'the rows of ' + count + ' start at ' + found.top);
    assert.equal(found.bottom, found.top + found.height, count + ' rows add up to the box: ' + found.row + ' each');
    assert.equal(found.bottom, 664);
  });
  assert.equal(panels.tonight('cybertron').bottom, 664);
  assert.equal(panels.spotlight('cybertron').bottom, 664);
  assert.equal(panels['sponsor-feature']('cybertron').bottom, 664);
  assert.equal(panels['monday-tasks']('cybertron').bottom, 664);
});

test('Cybertron: the words fit the shorter rows at their own sizes', () => {
  const tasks = panelCss('tasks');
  const events = panelCss('events');
  const tonight = panelCss('tonight');
  const spotlight = panelCss('spotlight');
  const sponsor = panelCss('sponsor-feature');
  const barOf = (css, selector, style = 'cybertron') => pixels(valueIn(style, css, selector, 'top'));

  // tasks: the label and two plain tasks of one line each fill the most a row holds, and the bar under it is
  // centred on the foot of the row, with its 20px picture starting 10 above it
  const taskRow = pixels(valueIn('cybertron', tasks, '.tasks .row', 'height'));
  const taskContent = lineIn('cybertron', tasks, '.tasks .row-label') + 2 * lineOf(rule(tasks, '.tasks .task-title').font);
  assert.ok(taskContent <= taskRow - 8, 'a row of tasks holds ' + taskContent + ' of ' + taskRow);
  assert.equal(barOf(tasks, '.tasks .row-bar'), taskRow - 10);
  assert.equal(pixels(rule(tasks, '.tasks .row-bar').top), 192 - 10, 'the bar of Original is 10 above the foot of its row');
  // a task with a contact or a place is the label and two lines of 64 and 52
  assert.ok(lineIn('cybertron', tasks, '.tasks .row-label') + lineOf(rule(tasks, '.tasks .task-title').font) + lineOf(rule(tasks, '.tasks .task-detail').font) <= taskRow - 8);

  // events: the title and the time under it, and the date column, in a row of 132
  const eventRow = pixels(valueIn('cybertron', events, '.events .row', 'height'));
  assert.ok(lineOf(rule(events, '.events .event-title').font) + lineOf(rule(events, '.events .event-when').font) <= eventRow - 8);
  assert.ok(lineIn('cybertron', events, '.events .day-name') + lineIn('cybertron', events, '.events .month-day') <= eventRow - 8);
  assert.equal(barOf(events, '.events .row-bar'), eventRow - 10);

  // the people rows: the portrait of each page and the lines beside it, in the row less its 2px rule
  const portrait = { 4: 120, 3: 166, 2: 240, 1: 264 }; // the largest portrait of each page (core/portrait.js, rowSteps)
  const nameLine = lineOf(rule(sheets.base, '.person-name').font);
  const roleLine = lineOf(rule(sheets.base, '.person-role').font);
  const thirdLine = lineOf(rule(sheets.base, '.person-line').font);
  rowCounts.forEach(count => {
    const row = personRows('cybertron', count).row;
    assert.ok(portrait[count] <= row - 2 - 8, 'the portrait of ' + count + ' rows is ' + portrait[count] + ' in a row of ' + row);
    // Team leads: the name and TEAM LEAD, and on a page of three or fewer the line as well
    assert.ok(nameLine + roleLine + (count === 4 ? 0 : thirdLine) <= row - 2, 'the lines of ' + count + ' rows');
  });

  // tonight: five rows share the box, and each holds a line of 64
  assert.ok(pixels(valueIn('cybertron', tonight, '.tonight .rows', 'height')) / 5 >= lineOf(rule(tonight, '.tonight .text').font) + 8);

  // spotlight: the name card is 128, and the headline of two lines, the text of three and the lead take the rest
  const details = pixels(valueIn('cybertron', spotlight, '.spotlight .story', 'height')) - pixels(rule(spotlight, '.spotlight .name').height);
  const gap = pixels(valueIn('cybertron', spotlight, '.spotlight .details', 'gap'));
  const stacked = 2 * lineOf(rule(spotlight, '.spotlight .headline').font) + 3 * lineOf(rule(spotlight, '.spotlight .text').font) + lineOf(rule(spotlight, '.spotlight .lead').font) + 2 * gap;
  assert.ok(stacked <= details, 'the spotlight stacks ' + stacked + ' in ' + details);

  // the sponsor: the name card is 128, and the logo card of 280 and the blurb of four lines share the rest
  const lower = pixels(valueIn('cybertron', sponsor, '.sponsor-feature .story', 'height')) - pixels(rule(sponsor, '.sponsor-feature .name').height);
  assert.ok(Math.max(pixels(rule(sponsor, '.sponsor-feature .logo-card').height), 4 * lineOf(rule(sponsor, '.sponsor-feature .blurb').font)) <= lower);
});

test('Cybertron: the cards of Monday fit a body of 532, with the numbers and the totals moved up and no word made smaller', () => {
  const tasks = panelCss('monday-tasks');
  const progress = panelCss('monday-progress');
  const milestones = panelCss('monday-milestones');

  assert.equal(pixels(valueIn('cybertron', sheets.monday, '.monday .body', 'height')), 532);
  assert.equal(pixels(rule(sheets.monday, '.monday .body').height), 544, 'the body of Original is as it was');

  // the five rows of the window end at 420, and the numbers start under them
  assert.equal(pixels(rule(sheets.monday, '.monday .rows-window').height), 420);
  assert.ok(pixels(valueIn('cybertron', tasks, '.monday-tasks .facts', 'top')) >= 420);

  // progress: six rows of 64 under the legend, then the line that says how many more, then the totals, one under the other
  const bars = pixels(rule(progress, '.monday-progress .bars').top) + 6 * pixels(rule(progress, '.monday-progress .bar-row').height);
  const more = pixels(valueIn('cybertron', progress, '.monday-progress .more', 'top'));
  const totals = pixels(valueIn('cybertron', progress, '.monday-progress .totals', 'top'));
  assert.ok(bars <= more && more + lineOf(rule(progress, '.monday-progress .more').font) <= totals, 'the rows, the line of more and the totals do not overlap: ' + [bars, more, totals].join(', '));
  assert.ok(totals + lineOf(rule(progress, '.monday-progress .totals').font) <= 532);

  // milestones: the heading row of 52, five rows of 84 and +N MORE under them
  const milestoneRows = 52 + 5 * pixels(rule(milestones, '.monday-milestones .milestone-row').height);
  assert.ok(milestoneRows <= pixels(rule(milestones, '.monday-milestones .more').top));
  assert.ok(pixels(rule(milestones, '.monday-milestones .more').top) + 48 <= 532);

  // the chart of progress is an svg 512 high at the top of the body
  assert.ok(512 <= 532);
});

test('the Cybertron rules for the foot of the large frame change no size of a letter, use no animation, shadow, blur or filter, and are for every layout', () => {
  const start = cybertron.indexOf('The foot of the large frame has the neon slashes');
  const end = cybertron.indexOf('The foot of the small frame has the neon slashes');
  assert.ok(start > 0 && end > start);
  const section = withoutComments(cybertron.slice(start, end));

  assert.ok(!/font-size|font:/.test(section), 'only the boxes, the gaps and the lines move');
  assert.ok(!/animation|transition|shadow|blur|filter|perspective|transform/.test(section));
  assert.ok(!/data-layout|mirrored|nth-child|!important/.test(section), 'one set of numbers for both teams and both layouts');
  (section.match(/line-height:\s*\d+px/g) || []).forEach(line => assert.ok(pixels(line) >= 36, line + ' keeps a 36px label or a 44px line from touching the next'));
  (section.match(/^html\[data-style="cybertron"\] [^{]*\{/gm) || []).forEach(selector => assert.ok(selector.startsWith('html[data-style="cybertron"] .'), selector));

  // the rows of the people panels have no rule for a style anywhere else
  assert.equal(/\.person-/.test(withoutComments(cybertron.slice(0, start)) + withoutComments(cybertron.slice(end))), false);
});

test('the slashes and the panels that were laid out for the foot of Original are the ones this test adds up', () => {
  // every panel of the large frame is in the list, except the ones that draw no text near the foot
  const registry = read('dashboard/registry.js');
  const large = Array.from(registry.matchAll(/\{ id: '([^']+)', region: 'grid1'/g)).map(match => match[1]);
  const covered = Object.keys(panels).map(name => name.replace(/ on pages of \d$/, ''));

  assert.ok(large.length > 20, 'the registry names ' + large.length + ' large panels');
  large.forEach(name => assert.ok(covered.includes(name), name + ' is not in the list of panels that are added up'));
});

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
