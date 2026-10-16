// Runs inside the dashboard page (the tests add it before the page loads). It does the looking, and the
// tests in Node read what it wrote in window.__motion and judge it.
//
// The swap and the hidden transitions move their pieces with element.animate(). This file wraps that call
// to learn about every animation at the moment it is made, and then looks at the screen at exact times by
// pausing the animations and setting their time. So "at 200 ms" is the screen at 200 ms, whatever the
// computer is doing, and not the frame that happened to come near 200 ms.

(function () {
  const motion = window.__motion = { animations: [], swap: null, properties: [], recording: false };
  const realAnimate = Element.prototype.animate;
  const canvas = { width: 1920, height: 1080 };

  // Every animation made while recording is on, with the element, the keyframes and the options
  let flushing = false;
  let batch = [];
  motion.onBatch = null;

  Element.prototype.animate = function (keyframes, options) {
    const animation = realAnimate.call(this, keyframes, options);
    if (motion.recording) {
      batch.push({ animation: animation, element: this, keyframes: keyframes, options: options, at: performance.now() });
      if (!flushing) {
        flushing = true;
        queueMicrotask(() => {
          flushing = false;
          const made = batch;
          batch = [];
          if (motion.onBatch) motion.onBatch(made);
        });
      }
    }
    return animation;
  };

  // Where an element is on the 1920 x 1080 canvas, whatever size the window is
  function place() {
    const box = document.getElementById('screen').getBoundingClientRect();
    return { left: box.left, top: box.top, scale: box.width / canvas.width };
  }

  function rectOf(element, where) {
    const box = element.getBoundingClientRect();
    return { left: (box.left - where.left) / where.scale, top: (box.top - where.top) / where.scale, width: box.width / where.scale, height: box.height / where.scale };
  }

  function nameOf(element) {
    const own = element.id ? '#' + element.id : String(element.getAttribute('class') || element.tagName).trim().split(/\s+/).join('.');
    const holder = element.closest('[id^="region-"]');
    return (holder && holder !== element ? '#' + holder.id + ' ' : '') + (element.id ? own : '.' + own);
  }
  motion.nameOf = nameOf;

  // How much of an element shows: its opacity times the opacity of everything it sits in
  function shown(element) {
    let value = 1;
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      value *= Number(style.opacity);
      if (style.visibility === 'hidden' || style.display === 'none') return 0;
    }
    return value;
  }
  motion.shown = shown;

  // The room that the letters of a text really take, not the box of the line: for each line of the text, a
  // rectangle from the top of the tallest letter to the bottom of the lowest, measured with the font that draws it.
  const measuring = document.createElement('canvas').getContext('2d');

  function ink(element, textNode, where) {
    const style = window.getComputedStyle(element);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const lines = Array.from(range.getClientRects()).filter(box => box.width > 0 && box.height > 0);
    if (lines.length === 0) return [];

    let text = textNode.nodeValue.trim().replace(/\s+/g, ' ');
    if (style.textTransform === 'uppercase') text = text.toUpperCase();
    measuring.font = style.fontStyle + ' ' + style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    measuring.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
    const metrics = measuring.measureText(text);
    const first = lines[0];
    const grow = metrics.width > 0 ? Math.min(1, first.width / metrics.width) : 1;
    const zoom = parseFloat(style.fontSize) > 0 ? first.height / (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent) : 1;

    return lines.map(box => {
      const baseline = box.top + metrics.fontBoundingBoxAscent * zoom;
      const top = baseline - metrics.actualBoundingBoxAscent * zoom;
      const bottom = baseline + metrics.actualBoundingBoxDescent * zoom;
      return {
        left: (box.left - where.left) / where.scale,
        top: (top - where.top) / where.scale,
        width: Math.min(box.width, metrics.width * zoom * (lines.length === 1 ? 1 : 10)) / where.scale,
        height: (bottom - top) / where.scale,
        grow: grow,
      };
    });
  }

  // The leaf elements that hold text of their own, in the stage, with the ink of their lines and how much they show
  function textBlocks(where) {
    const found = [];
    const walker = document.createTreeWalker(document.getElementById('stage'), NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue.trim() === '') continue;
      const element = node.parentElement;
      if (element.closest('svg, [hidden]')) continue;

      const opacity = shown(element);
      if (opacity <= 0.05) continue;
      ink(element, node, where).forEach(box => {
        if (box.width >= 1 && box.height >= 1) found.push(Object.assign({ element: element, name: nameOf(element), text: node.nodeValue.trim().slice(0, 24), opacity: opacity }, box));
      });
    }
    return found;
  }

  // The pieces and the text blocks and the hawk at this moment, as plain numbers
  function look() {
    const where = place();
    const hawk = document.querySelector('.swap-hawk');
    const blocks = textBlocks(where);

    // Two blocks of text that cover each other, where neither holds the other
    const overlaps = [];
    for (let first = 0; first < blocks.length; first++) {
      for (let second = first + 1; second < blocks.length; second++) {
        const a = blocks[first];
        const b = blocks[second];
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue;

        const across = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
        const down = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
        // Letters of one word sit in the same parent and touch by their kerning. A bracket may graze the line under it.
        if (a.element.parentElement === b.element.parentElement) continue;
        if (across > 4 && down > 4) overlaps.push({ first: a.name + ' "' + a.text + '"', second: b.name + ' "' + b.text + '"', across: across, down: down });
      }
    }

    const regions = Array.from(document.querySelectorAll('[id^="region-"]')).map(region => Object.assign({ kind: 'region', name: '#' + region.id }, rectOf(region, where))).filter(box => box.width > 0 && box.height > 0);

    // The middle of every bolt on the frames, which is where a copy of it has to land
    const screws = Array.from(document.querySelectorAll('.screw')).map(screw => rectOf(screw, where)).filter(box => box.width > 0 && box.height > 0).map(box => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 }));

    return {
      pieces: window.teletraanTest.sample(),
      regions: regions,
      screws: screws,
      blocks: blocks,
      overlaps: overlaps,
      hawk: hawk ? Object.assign({ opacity: shown(hawk) }, rectOf(hawk, where)) : null,
    };
  }

  function plain(snapshot) {
    return Object.assign({}, snapshot, { blocks: snapshot.blocks.map(block => Object.assign({}, block, { element: undefined })) });
  }
  motion.look = look;

  // Where the pieces and the bolts belong, with nothing moving
  motion.rest = function () {
    return { pieces: window.teletraanTest.rest(), screws: look().screws };
  };

  // With the animations paused, the screen at each of these times
  function seek(animations, times) {
    animations.forEach(item => item.animation.pause());
    return times.map(time => {
      animations.forEach(item => { item.animation.currentTime = time; });
      return { time: time, view: plain(look()) };
    });
  }

  // The screen with the animations taken off: where everything belongs
  function withoutAnimations(animations, run) {
    const saved = animations.map(item => item.animation.effect.getKeyframes());
    animations.forEach(item => item.animation.effect.setKeyframes([]));
    try {
      return run();
    } finally {
      animations.forEach((item, index) => item.animation.effect.setKeyframes(saved[index]));
    }
  }

  // The finish time of an animation, counted from when it was made
  function endOf(item) {
    const timing = item.animation.effect.getComputedTiming();
    return timing.delay + timing.activeDuration + timing.endDelay;
  }

  // The swap (core/swap-run.js): the pull apart is the first batch of animations, the re-form is the batch that has
  // the animation of the copy of the hawk. Each is looked at the moment it is made.
  motion.armSwap = function (times) {
    const world = document.getElementById('world');
    const swap = motion.swap = { phase: 'waiting', startedAt: 0, pull: null, reform: null, errors: [] };

    motion.recording = true;
    motion.onBatch = made => {
      try {
        const reform = made.some(item => item.element.classList.contains('swap-hawk'));
        if (!reform && swap.phase === 'waiting' && world.hasAttribute('data-pieces')) {
          swap.phase = 'pull';
          const pulling = made.filter(item => item.element.closest('#pile, #stage'));
          swap.startedAt = Math.min(...pulling.map(item => item.at));
          swap.pull = {
            natural: withoutAnimations(pulling, () => plain(look())),
            samples: seek(pulling, times),
            count: pulling.length,
          };
        } else if (reform && swap.phase === 'pull') {
          swap.phase = 'reform';
          const moving = made.filter(item => item.element.closest('#pile, #stage'));
          const pieceMoves = moving.filter(item => !item.element.classList.contains('swap-hawk') && !item.element.closest('.swap-hawk'));
          const finish = Math.max(...pieceMoves.map(endOf));
          const hawks = moving.filter(item => item.element.classList.contains('swap-hawk'));
          const hawkEnd = Math.max(...hawks.map(endOf));
          const path = [];

          // The hawk's path first, because seeking the pieces changes nothing about it
          hawks.forEach(item => item.animation.pause());
          for (let step = 0; step <= 40; step++) {
            hawks.forEach(item => { item.animation.currentTime = hawkEnd * step / 40; });
            const clone = document.querySelector('.swap-hawk');
            path.push(Object.assign({ time: hawkEnd * step / 40 }, rectOf(clone, place())));
          }
          const logos = Array.from(document.querySelectorAll('.logo')).map(logo => rectOf(logo, place())).filter(box => box.width > 0 && box.height > 0);

          swap.reform = {
            startedAt: Math.min(...moving.map(item => item.at)) - swap.startedAt,
            finish: finish,
            natural: withoutAnimations(moving, () => plain(look())),
            landed: seek(pieceMoves, [finish]).map(sample => sample.view)[0],
            path: path,
            logo: logos[0] || null,
            count: moving.length,
          };
          motion.recording = false;
        }
      } catch (error) {
        swap.errors.push(String(error && error.stack || error));
      }
    };
  };

  motion.swapDone = () => motion.swap && motion.swap.phase === 'reform';

  // A hidden transition (core/hidden-run.js): the state of the screen at each change of it, and where the pieces are at
  // the moments that matter. The pieces of the rise are seen at the end of their animation.
  function state() {
    const world = document.getElementById('world');
    const cube = document.getElementById('cube');
    const backdrop = document.getElementById('backdrop');
    const picture = backdrop ? backdrop.querySelector('img.picture[data-state]') : null;
    return {
      hidden: world.dataset.hidden || '',
      tint: world.dataset.tint || '',
      pieces: world.hasAttribute('data-pieces'),
      lift: world.hasAttribute('data-lift'),
      cube: Boolean(cube) && !cube.hidden,
      backdrop: Boolean(backdrop) && !backdrop.hidden,
      picture: picture ? picture.dataset.state + ' ' + shown(picture).toFixed(2) : '',
    };
  }

  motion.armHidden = function () {
    const world = document.getElementById('world');
    const hidden = motion.hidden = { events: [], apart: null, lift: null, cubeSeen: null, cube: [], ended: false, startedAt: 0 };
    let last = '';

    const note = reason => {
      const now = state();
      const text = JSON.stringify(now);
      if (text === last) return;
      last = text;
      hidden.events.push(Object.assign({ at: performance.now() - hidden.startedAt, reason: reason }, now));
      return now;
    };

    hidden.startedAt = performance.now();
    new MutationObserver(() => {
      const now = note('world');
      if (!now) return;
      try {
        if (now.hidden === 'apart' && !hidden.apart) {
          const content = Array.from(document.querySelectorAll('[data-pile="content"]'));
          hidden.apart = { at: performance.now() - hidden.startedAt, view: plain(look()), contentShown: content.map(node => ({ name: nameOf(node), opacity: shown(node) })) };
        }
        if (now.lift && !hidden.lift) {
          // The pieces rise by their own animations. Each is looked at at its end.
          const rising = document.getAnimations().filter(animation => animation.effect && animation.effect.target && animation.effect.target.dataset && animation.effect.target.dataset.pile === 'piece');
          rising.forEach(animation => animation.pause());
          const end = Math.max(0, ...rising.map(animation => { const timing = animation.effect.getComputedTiming(); return timing.delay + timing.activeDuration; }));
          rising.forEach(animation => { animation.currentTime = end; });
          hidden.lift = { at: performance.now() - hidden.startedAt, animations: rising.length, end: end, view: plain(look()) };
        }
        if (!now.hidden && !now.pieces && hidden.lift) {
          hidden.ended = true;
          hidden.natural = null;
        }
      } catch (error) {
        hidden.error = String(error && error.stack || error);
      }
    }).observe(world, { attributes: true });

    const loop = () => {
      const now = state();
      note('frame');
      if (now.cube) {
        const mark = document.querySelector('#cube .cube-art');
        const rect = rectOf(mark, place());
        if (!hidden.cubeSeen) hidden.cubeSeen = { at: performance.now() - hidden.startedAt };
        hidden.cube.push(Object.assign({ at: performance.now() - hidden.startedAt }, rect));
      }
      if (!hidden.ended) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
})();
