// Plate ids, placeholder markers and sample tags appear only with ?sample=1. The page is opened the way the wall opens it,
// with no sample and no way to reach Sanity, so it has nothing of the team's to show, and every panel is looked at for
// the three kinds of mark. With ?sample=1 the sample tag is there, which shows that the look can see one.

// The panels that can write a mark when they have no content, and the whole screen
const panels = ['', 'safety-days', 'photo', 'team-leads', 'leadership', 'roster', 'spotlight', 'sponsor-feature', 'sponsor-logo', 'tasks', 'events', 'next-event', 'task-counts', 'forecast', 'monday-tasks', 'monday-done', 'monday-board', 'competition-rank'];

// Placeholder markers are words in square brackets, and the sample tags say SAMPLE
const placeholder = /\[[^\]\n]{1,60}\]/;
const sampleTag = /\bSAMPLE\b/;

async function readMarks(ctx, address) {
  const page = await ctx.browser.newPage({ viewport: { width: 1920, height: 1080 } });
  try {
    // Nothing reaches Sanity, the control service or the weather, so the page has only its own defaults
    await page.route(url => !url.href.startsWith(ctx.base) && !url.href.startsWith('data:'), route => route.abort());
    await page.route('**/control/api/**', route => route.fulfill({ status: 204 }));
    await page.goto(ctx.base + address, { waitUntil: 'load' });
    await page.waitForFunction(() => window.teletraanStarted === true, null, { timeout: 60000 });
    // A held panel says when it is drawn. The whole screen has its first page in a few seconds.
    if (address.includes('panel=')) await page.waitForFunction(() => document.documentElement.dataset.stillReady === '1', null, { timeout: 30000 });
    await page.waitForTimeout(address.includes('panel=') ? 800 : 6000);

    return await page.evaluate(() => {
      const found = [];
      document.querySelectorAll('#stage *').forEach(element => {
        const own = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.nodeValue).join(' ').trim();
        if (own !== '') found.push({ text: own, name: (element.id ? '#' + element.id : '.' + String(element.getAttribute('class') || element.tagName).trim().split(/\s+/).join('.')) });
      });
      return {
        text: found,
        plateIds: Array.from(document.querySelectorAll('[class*="plate-id"], [data-plate-id]')).length,
        view: document.documentElement.dataset.view || '',
      };
    });
  } finally {
    await page.close();
  }
}

function addressOf(panel, extra) {
  const query = new URLSearchParams({ night: 'off', motion: 'none' });
  if (panel !== '') {
    query.set('panel', panel);
    query.set('still', '1');
  }
  Object.keys(extra).forEach(key => query.set(key, extra[key]));
  return '/index.html?' + query.toString();
}

const rules = panels.map(panel => ({
  name: 'marks/without-sample/' + (panel === '' ? 'screen' : panel),
  async run(ctx) {
    const read = await readMarks(ctx, addressOf(panel, {}));
    const failures = [];

    // A page that drew nothing would pass every rule, so it fails this one
    if (read.text.length < 10) failures.push((panel || 'screen') + ' at 6000 ms: the page drew ' + read.text.length + ' pieces of text, so there was nothing to look at');
    read.text.forEach(item => {
      if (placeholder.test(item.text)) failures.push((panel || 'screen') + ' ' + item.name + ' "' + item.text.slice(0, 40) + '": a placeholder marker on a screen with no ?sample=1');
      if (sampleTag.test(item.text)) failures.push((panel || 'screen') + ' ' + item.name + ' "' + item.text.slice(0, 40) + '": a sample tag on a screen with no ?sample=1');
    });
    if (read.plateIds > 0) failures.push((panel || 'screen') + ': ' + read.plateIds + ' stamped plate ids on the screen');
    return failures;
  },
}));

rules.push({
  name: 'marks/with-sample/the-tag-shows',
  async run(ctx) {
    const read = await readMarks(ctx, addressOf('', { sample: '1' }));
    const tagged = read.text.some(item => sampleTag.test(item.text));
    const marked = read.text.some(item => placeholder.test(item.text));
    const failures = [];

    if (!tagged) failures.push('screen at 5000 ms: ?sample=1 shows no sample tag, so the rules above cannot see one');
    if (!marked) failures.push('screen at 5000 ms: ?sample=1 shows no placeholder marker, so the rules above cannot see one');
    if (read.plateIds > 0) failures.push('screen at 5000 ms: ' + read.plateIds + ' stamped plate ids on the screen, the plates have none');
    return failures;
  },
});

export const tests = rules;
