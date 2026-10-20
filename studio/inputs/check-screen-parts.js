// The parts of the Check the screen page that need no Studio: the words and the way a finding is shown. check-screen-view.js
// draws them. The checks themselves are in ../tools/content-check.js. tests/content-check.test.mjs reads this with node.

export const words = {
  title: 'Check the screen',
  intro: 'This page reads everything you have typed and lists what would make the TV look bad or show nothing. It changes nothing.',
  drafts: 'It checks the draft when an item has one, because the draft is what Publish all puts on the TV.',
  button: 'Check again',
  reading: 'Reading the content.',
  failed: 'The content could not be read. Check the connection and click Check again.',
  allGood: 'Nothing to fix. Every check passed.',
  open: 'Open',
  fix: 'Fix:',
  draft: 'Draft',
  published: 'Published',
  problem: 'Problem',
  warning: 'Warning',
  legend: 'A problem means the TV shows nothing, shows the wrong thing, or shows something private. A warning means it shows, but looks bad.',
};

// The words in front of a finding, so the level is never only a color
export function levelWords(level) {
  return level === 'problem' ? words.problem : words.warning;
}

export function stateWords(state) {
  return state === 'draft' ? words.draft : words.published;
}

// The line under the heading of an area: how many of each
export function countWords(group) {
  const parts = [];
  if (group.problems > 0) parts.push(group.problems + (group.problems === 1 ? ' problem' : ' problems'));
  if (group.warnings > 0) parts.push(group.warnings + (group.warnings === 1 ? ' warning' : ' warnings'));
  return parts.join(' and ');
}

// The key of a finding in a list: the same finding keeps its key between two checks
export function keyOf(item, index) {
  return [item.doc.id, item.code, item.field, index].join('|');
}
