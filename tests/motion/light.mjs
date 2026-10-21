// The Light transitions and the vocabulary of each theme (docs/transitions.md, "Full, Light and Calm"). Each theme has one scene of each
// kind (panel and view). The rules for Light read a run played with ?motion=light:
//
//   - at most 40 elements animate, every animation moves transform or opacity, and no layer is bigger than its region (the panel for a
//     panel transition, each region of the page for a view transition)
//   - the regions do not overlap and every part lies inside its region
//   - when the run ends the layer is empty and hidden, no animation of the run is left, and the page is whole again
//
// The rules of the vocabulary read a run of each theme, in Full and in Light: the elements carry the classes of the kit of that theme
// and of no other, so a theme never plays the drawing of another one.

const partsLimit = 40;
const allowedProperties = ['transform', 'opacity'];
const themes = ['original', 'cybertron', 'retro', 'foundry'];
const looksOf = { original: { panel: 'original', view: 'bar' }, cybertron: { panel: 'cybertron', view: 'cybertronBar' }, retro: { panel: 'retro', view: 'retroBar' }, foundry: { panel: 'foundry', view: 'foundry-bar' } };

// The class prefix of the drawing of each kit. A prefix that is not the theme's own is foreign to it.
const prefixOf = { original: 'rk-', cybertron: 'ck-', retro: 'rr-', foundry: 'fk-' };
// Classes of the Original panel kit that only it may have (core/reform-draw.js, cells with lock pins and hinge barrels)
const originalOnly = ['reform-cell', 'reform-pin', 'reform-barrel'];

const scenes = {};
themes.forEach(theme => {
  scenes[theme + ' panel'] = { theme: theme, kind: 'panel', play: 'reform-panel', options: {}, look: looksOf[theme].panel, name: 'the ' + theme + ' panel transition' };
  scenes[theme + ' view'] = { theme: theme, kind: 'view', play: 'reform-view', options: { view: 'nova' }, look: looksOf[theme].view, name: 'the ' + theme + ' view transition' };
});

async function idle(page) {
  await page.waitForFunction(() => { const layer = document.getElementById('reform'); return !layer || layer.hidden; }, null, { timeout: 60000, polling: 250 });
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => { const layer = document.getElementById('reform'); return !layer || layer.hidden; }, null, { timeout: 60000, polling: 250 });
}

// What a run holds, read in the page while it is on the screen
function readRun() {
  const layer = document.getElementById('reform');
  const boxOf = element => { const box = element.getBoundingClientRect(); return { x: box.left, y: box.top, w: box.width, h: box.height }; };
  const regions = Array.from(layer.querySelectorAll('.reform-light-region')).map(region => ({
    box: boxOf(region),
    plates: Array.from(region.querySelectorAll('.reform-light-plate')).map(plate => ({ w: plate.offsetWidth, h: plate.offsetHeight })),
    parts: Array.from(region.querySelectorAll('.reform-light-part')).map(part => ({ x: part.offsetLeft, y: part.offsetTop, w: part.offsetWidth, h: part.offsetHeight })),
  }));
  const pageBoxes = ['region-banner', 'region-strip', 'region-sidebar', 'region-column', 'region-grid1', 'region-right', 'region-ticker']
    .map(id => document.getElementById(id)).filter(Boolean).map(boxOf);
  const classes = new Set();
  [layer].concat(Array.from(layer.querySelectorAll('*'))).forEach(element => String(element.getAttribute('class') || '').split(/\s+/).filter(Boolean).forEach(name => classes.add(name)));
  const area = document.querySelector('#region-grid1 .area');

  return {
    weight: layer.dataset.weight || '',
    animated: Number(layer.dataset.animated || 0),
    elements: layer.querySelectorAll('*').length,
    regions: regions,
    pageBoxes: pageBoxes,
    area: area ? boxOf(area) : null,
    classes: Array.from(classes),
  };
}

async function playScene(ctx, scene, motion) {
  const page = await ctx.open(motion === 'light' ? { motion: 'light' } : {}, undefined, { look: scene.look, settleMs: 3500 });
  try {
    await idle(page);
    await page.evaluate(() => { window.__motion.collecting = true; window.__motion.created = []; });
    await page.evaluate(([name, options]) => window.teletraanTest.play(name, options), [scene.play, scene.options]);
    try {
      await page.waitForFunction(() => { const layer = document.getElementById('reform'); return layer && layer.dataset.ready === '1'; }, null, { timeout: 40000, polling: 50 });
    } catch (error) {
      return { error: scene.name + ' was not built within 40 seconds in ' + motion + ' motion' + (page.pageErrors.length > 0 ? ' (the page said: ' + page.pageErrors[0] + ')' : '') };
    }
    const run = await page.evaluate(readRun);
    if (motion === 'light') {
      await page.waitForFunction(() => { const layer = document.getElementById('reform'); return !layer || layer.hidden; }, null, { timeout: 20000, polling: 50 });
    }
    const made = await page.evaluate(() => {
      const mine = window.__motion.created.filter(item => item.animation.id === 'reform');
      const properties = new Set();
      mine.forEach(item => item.animation.effect.getKeyframes().forEach(frame => Object.keys(frame).forEach(name => { if (!['offset', 'computedOffset', 'easing', 'composite'].includes(name)) properties.add(name); })));
      return { properties: Array.from(properties), elements: new Set(mine.map(item => item.element)).size };
    });
    const end = motion === 'light' ? await page.evaluate(() => {
      const layer = document.getElementById('reform');
      return {
        hidden: !layer || layer.hidden,
        left: layer && layer.firstElementChild ? layer.firstElementChild.children.length : 0,
        running: document.getAnimations().filter(animation => animation.id === 'reform' && animation.playState === 'running').length,
        moving: 'moving' in document.documentElement.dataset,
        stageOpacity: document.getElementById('stage').style.opacity,
        area: Boolean(document.querySelector('#region-grid1 .area')),
      };
    }) : null;
    return { run: run, made: made, end: end, pageErrors: page.pageErrors };
  } finally {
    await page.close();
  }
}

const near = (a, b, by = 2) => Math.abs(a - b) <= by;

function lightRules(scene) {
  const key = 'light ' + scene.theme + ' ' + scene.kind;
  const prefix = 'light/' + scene.theme + '/' + scene.kind + '/';
  const get = ctx => ctx.scenario(key, () => playScene(ctx, scene, 'light'));

  return [
    {
      name: prefix + 'few-parts-and-no-layer-bigger-than-its-region',
      async run(ctx) {
        const found = await get(ctx);
        if (found.error) return [found.error];
        const lines = [];
        const run = found.run;

        console.log('      ' + scene.name + ' in Light: ' + run.animated + ' animated elements, ' + run.elements + ' elements in the layer');
        if (run.weight !== 'light') lines.push(scene.name + ': the run is not marked light');
        // a view draws its plates again after the page has changed, so over the whole run the elements are twice as many, and never more than the limit at once
        if (run.animated > partsLimit || found.made.elements > 2 * partsLimit) lines.push(scene.name + ': ' + run.animated + ' animated elements at once (' + found.made.elements + ' over the run), over the limit of ' + partsLimit);
        found.made.properties.filter(name => !allowedProperties.includes(name)).forEach(name => lines.push(scene.name + ': a part animates ' + name));
        if (run.regions.length === 0) lines.push(scene.name + ': no region was drawn');
        if (scene.kind === 'panel') {
          if (run.regions.length !== 1) lines.push(scene.name + ': ' + run.regions.length + ' regions, a panel transition covers one');
          else if (run.area && !(near(run.regions[0].box.w, run.area.w) && near(run.regions[0].box.h, run.area.h))) lines.push(scene.name + ': the layer is ' + Math.round(run.regions[0].box.w) + 'x' + Math.round(run.regions[0].box.h) + ' and the panel is ' + Math.round(run.area.w) + 'x' + Math.round(run.area.h));
        }
        run.regions.forEach((region, index) => {
          const home = run.pageBoxes.some(box => near(box.w, region.box.w, 3) && near(box.h, region.box.h, 3));
          if (!home) lines.push(scene.name + ': region ' + index + ' (' + Math.round(region.box.w) + 'x' + Math.round(region.box.h) + ') is not the size of any region of the page');
          region.plates.forEach(plate => { if (plate.w > region.box.w || plate.h > region.box.h + 0.5) lines.push(scene.name + ': a plate of region ' + index + ' is bigger than its region'); });
        });
        return lines.concat((found.pageErrors || []).map(error => 'the page said: ' + error));
      },
    },
    {
      name: prefix + 'no-two-regions-overlap-and-every-part-is-inside-its-region',
      async run(ctx) {
        const found = await get(ctx);
        if (found.error) return [found.error];
        const lines = [];
        const regions = found.run.regions;

        regions.forEach((region, index) => {
          regions.slice(index + 1).forEach((other, offset) => {
            const across = Math.min(region.box.x + region.box.w, other.box.x + other.box.w) - Math.max(region.box.x, other.box.x);
            const down = Math.min(region.box.y + region.box.h, other.box.y + other.box.h) - Math.max(region.box.y, other.box.y);
            if (across > 1.5 && down > 1.5) lines.push(scene.name + ': regions ' + index + ' and ' + (index + 1 + offset) + ' overlap by ' + Math.round(across) + 'x' + Math.round(down) + 'px');
          });
          region.parts.forEach((part, number) => {
            if (part.x < -0.5 || part.y < -0.5 || part.x + part.w > region.box.w + 0.5 || part.y + part.h > region.box.h + 0.5) lines.push(scene.name + ': part ' + number + ' of region ' + index + ' is outside its region');
          });
        });
        return lines;
      },
    },
    {
      name: prefix + 'all-parts-are-gone-at-the-end',
      async run(ctx) {
        const found = await get(ctx);
        if (found.error) return [found.error];
        const lines = [];
        const end = found.end;

        if (!end.hidden) lines.push(scene.name + ': the layer is still shown after the run');
        if (end.left > 0) lines.push(scene.name + ': ' + end.left + ' elements are left in the layer');
        if (end.running > 0) lines.push(scene.name + ': ' + end.running + ' animations of the run are still running');
        if (end.moving) lines.push(scene.name + ': the page still says a transition is moving (data-moving)');
        if (end.stageOpacity !== '') lines.push(scene.name + ': the stage keeps an opacity of ' + end.stageOpacity);
        if (!end.area) lines.push(scene.name + ': the large panel has no area after the run');
        return lines;
      },
    },
  ];
}

// The classes of a run, by theme: every class that is the drawing of a kit has the prefix of the theme that is playing
function vocabularyRule(scene, motion) {
  const key = (motion === 'light' ? 'light ' : 'full ') + scene.theme + ' ' + scene.kind;
  return {
    name: 'vocabulary/' + scene.theme + '/' + scene.kind + '/' + motion + '-has-no-class-of-another-theme',
    async run(ctx) {
      const found = await ctx.scenario(key, () => playScene(ctx, scene, motion));
      if (found.error) return [found.error];
      const lines = [];
      const foreign = themes.filter(theme => theme !== scene.theme).map(theme => prefixOf[theme]);

      found.run.classes.forEach(name => {
        if (foreign.some(prefix => name.startsWith(prefix))) lines.push(scene.name + ' in ' + motion + ' motion has the class ' + name + ', which belongs to another theme');
        if (originalOnly.includes(name) && !(scene.theme === 'original' && scene.kind === 'panel' && motion === 'full')) lines.push(scene.name + ' in ' + motion + ' motion has the class ' + name + ', which only the Original panel transition draws');
        if (name.startsWith('reform-light') && motion === 'full') lines.push(scene.name + ' in full motion has the Light class ' + name);
      });
      return lines;
    },
  };
}

export const tests = Object.keys(scenes).reduce((all, name) => {
  const scene = scenes[name];
  return all.concat(lightRules(scene), [vocabularyRule(scene, 'full'), vocabularyRule(scene, 'light')]);
}, []);
