// The Tasks panel built the "Full Plate" way (Full Plate is the name of design
// direction 2 in the brand sheet), for comparing against the real
// dashboard on the TV. Same size, same place on the screen, same animation
// module. The difference is how it is made: solid plates cut with clip-path,
// moved only by transform and opacity, and no drawn lines.
//
// Compare it with   dashboard/index.html?only=tasks
// Add ?perf for the readout, ?motion=calm or ?motion=none, ?stress for shorter holds.
//
// ?finish=metal (the default, as on the dashboard) paints the plates with
// gradients, edge lines and brushed streaks. ?finish=flat is the plain
// colours the page started with. Run both for the same time and compare the
// numbers to see what the metal costs.

import * as frame from '../../dashboard/frame.js';
import { doubleSlash, statusMark } from '../../dashboard/core/marks.js';
import { escapeHtml } from '../../dashboard/core/text.js';

// How this panel arrives. Same format as the tables in frame.js. The
// comparison page registers its own because it is a throwaway test. A real
// panel adds its table to frame.js.
frame.sequences.stack = {
  'header-gold': ['hinge', 0],
  'header-strip': ['slide-right', 150],
  'tab': ['slide-left', 300, 100],
  'plate': ['slide-right', 500, 80],
};

// the same groups as dashboard/panels/tasks, without blocked
const groups = [
  { status: 'in-progress', label: 'IN PROGRESS' },
  { status: 'up-next', label: 'UP NEXT' },
  { status: 'done', label: 'RECENTLY DONE' },
];

const params = new URLSearchParams(location.search);
const holdSeconds = params.has('stress') ? 3 : 12;

run();

async function run() {
  fitToScreen();
  window.addEventListener('resize', fitToScreen);
  document.documentElement.dataset.finish = params.get('finish') === 'flat' ? 'flat' : 'metal';
  frame.start({ motion: params.get('motion') || 'full', draw: 'stroke' });

  await Promise.all([
    document.fonts.load('800 116px "Saira Condensed"'),
    document.fonts.load('500 60px "Barlow Semi Condensed"'),
  ]);
  const content = await (await fetch('../../dashboard/data/sample/content.json')).json();

  if (params.has('perf')) {
    const perf = await import('../../dashboard/perf.js');
    perf.start();
  }

  const region = document.getElementById('region');
  while (true) {
    region.innerHTML = panelMarkup(content.tasks);
    const panel = region.firstElementChild;
    await frame.enter(panel);
    await frame.wait(holdSeconds * 1000);
    await frame.exit(panel);
    panel.remove();
  }
}

function panelMarkup(tasks) {
  const rows = groups.map((group, index) => rowMarkup(group, index, tasks)).join('');

  return `
    <section class="panel stack" data-sequence="stack">
      <div class="header">
        <div class="gold-plate" data-part="header-gold">TASKS</div>
        <div class="strip" data-part="header-strip">${doubleSlash()}</div>
      </div>
      <div class="body">${rows}</div>
    </section>`;
}

function rowMarkup(group, rowIndex, tasks) {
  const plates = tasks
    .filter(task => task.status === group.status)
    .slice(0, 2)
    .map((task, position) => {
      const index = rowIndex * 2 + position;
      return `<div class="task-plate plate-${position + 1}" data-part="plate" data-index="${index}">
        ${escapeHtml(task.title)} · ${escapeHtml(task.subteam)}
      </div>`;
    })
    .join('');

  return `
    <div class="stack-row status-${group.status}">
      <div class="tab" data-part="tab" data-index="${rowIndex}">
        <span>${group.label}</span>
        ${statusMark(group.status)}
      </div>
      <div class="plates">${plates}</div>
    </div>`;
}

// the same as fitToScreen in dashboard/shell.js
function fitToScreen() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  document.getElementById('stage').style.transform = scale === 1 ? '' : 'scale(' + scale + ')';
}
