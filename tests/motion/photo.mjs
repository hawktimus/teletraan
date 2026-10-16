// The Photo panel: the photos of one turn change by opacity only, and two of them are never both nearly opaque
// (core/photos.js, and the section "The Photo panel" in dashboard/frame.css).

const looks = ['original', 'cybertron', 'retro', 'minimal'];
const photos = 3;
const secondsEach = 5;
const solid = 0.9;
const round = value => Math.round(value * 100) / 100;

async function runPhotos(ctx, look) {
  const page = await ctx.open({ panel: 'photo', photos: String(photos), each: String(secondsEach), style: look }, undefined, { settleMs: 500 });
  try {
    // The photos come in when they have loaded, which takes longer on a busy computer
    await page.waitForFunction(() => document.querySelectorAll('.photo .shot').length >= 2, null, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => window.teletraanTest.play('photo-cross'));
    const found = await page.evaluate(seconds => window.__motion.photos(seconds), photos * secondsEach);
    if (found.shots < 2) return { error: 'the photo panel has ' + found.shots + ' photo on the screen, a cross needs two' };
    return found;
  } finally {
    await page.close();
  }
}

function opacityOnly(ctx, rule, found) {
  const other = found.properties.filter(name => name !== 'opacity');
  return other.map(name => 'photo panel at 0 ms: the photos animate ' + name + ', only opacity is allowed');
}

function neverTwoSolid(ctx, rule, found) {
  const failures = [];
  let last = '';

  found.samples.forEach(sample => {
    const solidOnes = sample.opacity.map((value, index) => ({ value: value, index: index })).filter(shot => shot.value > solid);
    if (solidOnes.length < 2) return;

    const text = solidOnes.map(shot => 'photo ' + (shot.index + 1) + ' at ' + round(shot.value)).join(' and ');
    if (text === last) return; // one line for as long as the same two stay solid
    last = text;
    failures.push(text + ' at ' + sample.time + ' ms: two photos are above ' + solid);
  });
  return failures;
}

function rule(look, name, check) {
  const full = 'photo-cross/' + look + '/' + name;
  return {
    name: full,
    async run(ctx) {
      const found = await ctx.scenario('photo-cross ' + look, () => runPhotos(ctx, look));
      if (found.error) return [found.error];
      return check(ctx, full, found);
    },
  };
}

export const tests = looks.flatMap(look => [
  rule(look, 'opacity-only', opacityOnly),
  rule(look, 'never-two-photos-above-0.9', neverTwoSolid),
]);
