// Runs inside the dashboard page (the tests add it before the page loads). It does the looking, and the
// tests in Node read what it wrote in window.__motion and judge it.
//
// The swap and the hidden transitions move their pieces with element.animate(). This file wraps that call
// to learn about every animation at the moment it is made, and then looks at the screen at exact times by
// pausing the animations and setting their time. So "at 200 ms" is the screen at 200 ms, whatever the
// computer is doing, and not the frame that happened to come near 200 ms.

(function () {
  const motion = window.__motion = { animations: [], swap: null, properties: [], recording: false, collecting: false, created: [] };
  const realAnimate = Element.prototype.animate;
  const canvas = { width: 1920, height: 1080 };

  // Every animation made while recording is on, with the element, the keyframes and the options
  let flushing = false;
  let batch = [];
  motion.onBatch = null;

  Element.prototype.animate = function (keyframes, options) {
    const animation = realAnimate.call(this, keyframes, options);
    if (motion.collecting) motion.created.push({ animation: animation, element: this, at: performance.now() });
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

  // A Monday card scrolls its rows (scrollCard in frame.js): the list moves up by one page of rows in 600 ms. It is
  // looked at every 100 ms of that.
  motion.armScroll = function () {
    const scroll = motion.scroll = { done: false, samples: [] };

    motion.recording = true;
    motion.onBatch = made => {
      const item = made.find(entry => entry.element.hasAttribute('data-scroll-list'));
      if (!item) return;

      try {
        const list = item.element;
        const clip = list.parentElement;
        const panel = list.closest('.panel') || clip;
        const where = place();
        const timing = item.animation.effect.getComputedTiming();

        scroll.duration = timing.duration;
        scroll.properties = Array.from(new Set(item.animation.effect.getKeyframes().flatMap(keyframe => Object.keys(keyframe)).filter(name => !['offset', 'computedOffset', 'easing', 'composite'].includes(name))));
        scroll.overflow = window.getComputedStyle(clip).overflow;
        scroll.clip = rectOf(clip, where);
        scroll.panel = rectOf(panel, where);
        item.animation.pause();
        for (let time = 0; time <= 600; time += 100) {
          item.animation.currentTime = time;
          scroll.samples.push({ time: time, rows: Array.from(list.children).map((row, index) => Object.assign({ name: nameOf(row) + ' ' + (index + 1), kind: 'content' }, rectOf(row, where))) });
        }
        item.animation.currentTime = 600;
        scroll.done = true;
        motion.recording = false;
      } catch (error) {
        scroll.error = String(error && error.stack || error);
        scroll.done = true;
      }
    };
  };

  // The photos of one turn lie on top of each other and fade in one after the other with CSS animations. They are
  // paused and looked at every 50 ms of the whole turn: the opacity of each photo, and what each one animates.
  motion.photos = function (seconds) {
    const shots = Array.from(document.querySelectorAll('.photo .shot'));
    const animations = shots.flatMap(shot => shot.getAnimations());
    const found = { shots: shots.length, properties: [], samples: [] };

    found.properties = Array.from(new Set(animations.flatMap(animation => animation.effect.getKeyframes().flatMap(keyframe => Object.keys(keyframe))).filter(name => !['offset', 'computedOffset', 'easing', 'composite'].includes(name))));
    animations.forEach(animation => animation.pause());
    for (let time = 0; time <= seconds * 1000; time += 50) {
      animations.forEach(animation => { animation.currentTime = time; });
      found.samples.push({ time: time, opacity: shots.map(shot => Number(window.getComputedStyle(shot).opacity)) });
    }
    return found;
  };

  // The name effect (the letters of the team name split, class "splitting") and the acts of the hawk are watched every
  // frame, together with the busy flag of core/busy.js. A line is written each time one of the three changes.
  motion.armEffects = function () {
    const log = motion.effects = { events: [], started: performance.now() };
    const hawkActs = ['robot', 'hawk-in', 'flight', 'hawk-out'];
    let last = '';

    const loop = () => {
      const name = Boolean(document.querySelector('[data-name-effect].splitting'));
      const logo = document.querySelector('#region-banner .logo, .logo');
      const act = logo ? logo.dataset.act || '' : '';
      const state = { busy: window.teletraanTest.busy(), name: name, hawk: hawkActs.includes(act) ? act : '' };
      const text = JSON.stringify(state);
      if (text !== last) {
        last = text;
        log.events.push(Object.assign({ at: performance.now() - log.started }, state));
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  // Every animation that runs, by the CSS or by a script, with the properties it animates. For an element that is
  // animated, the box and the effects of its computed style are read each time it is seen: they must not change.
  const ignored = ['offset', 'computedOffset', 'easing', 'composite'];
  const watchedStyle = ['filter', 'backdropFilter', 'boxShadow', 'textShadow', 'width', 'height'];

  motion.collect = function () {
    const seen = motion.seen = { animations: {}, changes: [] };
    const looked = new WeakSet();
    motion.collecting = true;

    function see(animation, now) {
      const effect = animation.effect;
      if (!effect || !effect.target || !effect.target.isConnected) return;

      const kind = animation.animationName ? 'css ' + animation.animationName : animation.transitionProperty ? 'transition ' + animation.transitionProperty : 'script';
      const target = effect.target;
      const names = Array.from(new Set(effect.getKeyframes().flatMap(keyframe => Object.keys(keyframe)).filter(name => !ignored.includes(name))));
      const key = kind + ' on ' + nameOf(target);
      if (!seen.animations[key]) seen.animations[key] = { kind: kind, name: nameOf(target), properties: names, at: Math.round(now) };

      // The style is read with the animation held at five moments of its run, the last just before its end, one after the other with nothing else
      // happening between them, so that a change is the animation's own and not new text or a font that came in.
      // Each animation is looked at once.
      if (looked.has(animation)) return;
      looked.add(animation);

      const timing = effect.getComputedTiming();
      const length = timing.activeDuration;
      if (!(length > 0) || !isFinite(length)) return;

      const saved = animation.currentTime;
      const running = animation.playState === 'running';
      let first = null;
      animation.pause();
      [0, 0.25, 0.5, 0.75, 0.99].forEach(share => {
        animation.currentTime = timing.delay + length * share;
        const style = window.getComputedStyle(target);
        const reading = {};
        watchedStyle.forEach(name => { reading[name] = style[name]; });
        if (first === null) {
          first = reading;
          ['filter', 'backdropFilter'].forEach(name => {
            if (reading[name] !== 'none' && reading[name] !== '') seen.changes.push({ name: nameOf(target), kind: kind, at: Math.round(now), what: name + ' is ' + reading[name] });
          });
          return;
        }
        watchedStyle.forEach(name => {
          if (first[name] !== reading[name] && !seen.changes.some(change => change.name === nameOf(target) && change.what.startsWith(name))) {
            seen.changes.push({ name: nameOf(target), kind: kind, at: Math.round(now + length * share), what: name + ' changed from ' + first[name] + ' to ' + reading[name] });
          }
        });
      });
      animation.currentTime = saved;
      if (running) animation.play();
    }

    setInterval(() => {
      const now = performance.now();
      document.getAnimations().forEach(animation => see(animation, now));
      motion.created.splice(0).forEach(item => see(item.animation, item.at));
    }, 30);
  };

  // The seams of the frames. With the pieces shown (#world has data-pieces) each piece is painted on a canvas as it is on
  // the screen at this window size: plates as filled polygons, and edges as lines with their width. Where the pieces
  // meet the paint has to be solid. A pixel that is not solid, with solid pixels on both sides of it within two pixels,
  // is a seam: the pieces touch, or leave a gap, and do not overlap by a pixel.
  const solid = 250;

  function paint(context, shapes) {
    shapes.forEach(shape => {
      context.setTransform(shape.matrix);
      context.fillStyle = '#000';
      context.strokeStyle = '#000';
      if (shape.fill) context.fill(shape.path);
      if (shape.width > 0) {
        context.lineWidth = shape.width;
        context.lineCap = shape.cap;
        context.lineJoin = shape.join;
        context.stroke(shape.path);
      }
    });
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  // What a piece paints, as paths in the space of their own elements with the matrix that puts them in the window: the
  // fill of each polygon and path, and the line of each stroke. A shadow, a glint, a glow or a layer under half strong
  // is not paint that covers a seam.
  function shapesOf(piece) {
    const shapes = [];
    const strong = style => Number(style.opacity) * (style.strokeOpacity === '' ? 1 : Number(style.strokeOpacity)) >= 0.9;
    const lineOf = (element, path, matrix) => {
      const style = window.getComputedStyle(element);
      const width = style.stroke !== 'none' && strong(style) && !/shadow|glint|neon|glow|wear|rust/.test(String(element.getAttribute('class'))) ? parseFloat(style.strokeWidth) : 0;
      const filled = style.fill !== 'none' && Number(style.opacity) >= 0.9 && Number(style.fillOpacity) >= 0.9 && !/shadow|glint|neon|glow|wear|rust/.test(String(element.getAttribute('class')));
      if (!filled && !(width > 0)) return;
      shapes.push({ path: path, matrix: matrix, fill: filled, width: width, cap: style.strokeLinecap, join: style.strokeLinejoin });
    };
    const pathOfPoints = (points, close) => {
      const path = new Path2D();
      Array.from(points).forEach((point, index) => (index === 0 ? path.moveTo(point.x, point.y) : path.lineTo(point.x, point.y)));
      if (close) path.closePath();
      return path;
    };

    piece.querySelectorAll('polygon').forEach(element => lineOf(element, pathOfPoints(element.points, true), element.getScreenCTM()));
    piece.querySelectorAll('polyline').forEach(element => lineOf(element, pathOfPoints(element.points, false), element.getScreenCTM()));
    piece.querySelectorAll('path').forEach(element => lineOf(element, new Path2D(element.getAttribute('d')), element.getScreenCTM()));
    piece.querySelectorAll('use').forEach(use => {
      const target = document.querySelector(use.getAttribute('href'));
      if (!target || !target.points) return;
      lineOf(use, pathOfPoints(target.points, target.tagName === 'polygon'), use.getScreenCTM());
    });
    return shapes;
  }

  motion.seams = function () {
    const world = document.getElementById('world');
    const width = window.innerWidth;
    const height = window.innerHeight;
    const had = world.hasAttribute('data-pieces');
    world.dataset.pieces = '';

    try {
      const where = place();
      window.teletraanTest.sample(); // marks the areas whose frames are cut up, as the swap does, so that their pieces show
      const pieces = Array.from(document.querySelectorAll('#stage svg.plate.piece')).filter(piece => piece.getBoundingClientRect().width > 0);
      const canvasOf = () => {
        const element = document.createElement('canvas');
        element.width = width;
        element.height = height;
        return element.getContext('2d', { willReadFrequently: true });
      };
      const all = canvasOf();
      const own = pieces.map(piece => ({ piece: piece, shapes: shapesOf(piece) }));
      own.forEach(item => paint(all, item.shapes));

      motion.union = all.canvas;
      const alpha = all.getImageData(0, 0, width, height).data;
      const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : alpha[(y * width + x) * 4 + 3]);
      const inside = (x, y) => at(x, y) >= solid;
      const seam = new Uint8Array(width * height);

      // Only where the pieces are
      const room = pieces.map(piece => piece.getBoundingClientRect());
      const from = { x: Math.max(2, Math.floor(Math.min(...room.map(box => box.left))) - 4), y: Math.max(2, Math.floor(Math.min(...room.map(box => box.top))) - 4) };
      const to = { x: Math.min(width - 2, Math.ceil(Math.max(...room.map(box => box.right))) + 4), y: Math.min(height - 2, Math.ceil(Math.max(...room.map(box => box.bottom))) + 4) };

      for (let y = from.y; y < to.y; y++) {
        for (let x = from.x; x < to.x; x++) {
          if (inside(x, y)) continue;
          const crossing = [[1, 0], [0, 1], [1, 1], [1, -1]].some(([dx, dy]) => [1, 2].some(near => [1, 2].some(far => inside(x - dx * near, y - dy * near) && inside(x + dx * far, y + dy * far))));
          if (crossing) seam[y * width + x] = 1;
        }
      }

      // Seam pixels that touch each other are one seam
      const found = [];
      for (let start = 0; start < seam.length; start++) {
        if (seam[start] !== 1) continue;
        const stack = [start];
        const box = { left: width, top: height, right: 0, bottom: 0, count: 0 };
        seam[start] = 2;
        while (stack.length > 0) {
          const index = stack.pop();
          const x = index % width;
          const y = (index - x) / width;
          box.left = Math.min(box.left, x);
          box.right = Math.max(box.right, x);
          box.top = Math.min(box.top, y);
          box.bottom = Math.max(box.bottom, y);
          box.count++;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const next = (y + dy) * width + (x + dx);
              if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height && seam[next] === 1) {
                seam[next] = 2;
                stack.push(next);
              }
            }
          }
        }
        found.push(box);
      }

      // The pieces whose paint reaches the seam are the ones that meet there
      // A seam is a run along an edge. A pinhole of a few pixels where three pieces meet at a corner is not one.
      return found.filter(box => Math.max(box.right - box.left, box.bottom - box.top) + 1 >= 8).map(box => {
        const names = own.filter(item => {
          const bounds = item.piece.getBoundingClientRect();
          return bounds.left <= box.right + 3 && bounds.right >= box.left - 3 && bounds.top <= box.bottom + 3 && bounds.bottom >= box.top - 3;
        }).map(item => (item.piece.closest('[id^="region-"]') ? '#' + item.piece.closest('[id^="region-"]').id + ' ' : '') + (item.piece.dataset.piece || 'piece'));
        return { left: (box.left - where.left) / where.scale, top: (box.top - where.top) / where.scale, width: (box.right - box.left + 1) / where.scale, height: (box.bottom - box.top + 1) / where.scale, count: box.count, pieces: names };
      });
    } finally {
      if (!had) delete world.dataset.pieces;
    }
  };

  // Chips, labels and headers: does the text fit its box with room to spare. The width of the text is measured with the
  // font that draws it (the advance of each letter at its size, and the letter spacing). The box is the room the layout
  // gives the element: its max-width when it has one, the width it was given when it clips or cuts with dots, and
  // for the rest, the element must at least stay inside its parent.
  const chipLike = '[class*="chip"]';
  const labelLike = '[class*="label"], .tag-text, .view-tag, .unit';
  const headerLike = 'h1, h2, h3, .title, .headline, .heading, .block-heading';

  function ownText(element) {
    return Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.nodeValue).join(' ').replace(/\s+/g, ' ').trim();
  }

  // options: spare (px), clearance (extra room a header title has before the metal of its line), only (a selector: look
  // at those elements and not at chips, labels and headers)
  motion.textFits = function (options) {
    const spare = options.spare;
    const where = place();
    const found = [];
    const checked = new Set();
    const groups = options.only ? [['text', options.only]] : [['chip', chipLike], ['label', labelLike + ', [class*="department"]'], ['header', headerLike]];

    groups.forEach(([kind, selector]) => {
      document.querySelectorAll('#stage ' + selector.split(', ').join(', #stage ')).forEach(element => {
        if (checked.has(element) || element.closest('svg, [hidden]')) return;
        checked.add(element);

        const text = ownText(element);
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (text === '' || rect.width === 0 || style.display === 'none' || shown(element) < 0.5) return;

        measuring.font = style.fontStyle + ' ' + style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
        measuring.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
        const advance = measuring.measureText(style.textTransform === 'uppercase' ? text.toUpperCase() : text).width;
        const paddings = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        const clipping = style.overflow !== 'visible' || style.textOverflow === 'ellipsis';
        const limited = style.maxWidth !== 'none';
        const wraps = style.whiteSpace !== 'nowrap' && style.whiteSpace !== 'pre';

        // How much room the text has in this box. null when the layout sets no box for it.
        let room = null;
        if (limited) room = parseFloat(style.maxWidth) - (style.boxSizing === 'border-box' ? paddings : 0) + (kind === 'header' ? options.clearance : 0);
        else if (clipping && !wraps) room = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        // A box that is as wide as its text and nothing more is the box of an element that shrinks to its text
        if (!limited && room !== null && Math.abs(room - advance) <= 1) room = null;
        if (wraps && room === null) return;

        const parent = element.parentElement.getBoundingClientRect();
        // A slanted chip is wider than its box by the slant, so only an element that is not moved is held to its parent
        const outside = style.transform !== 'none' ? 0 : Math.max(0, rect.right - parent.right, parent.left - rect.left);
        const cut = element.scrollWidth > element.clientWidth + 1;
        const base = { kind: kind, name: nameOf(element), text: text.slice(0, 30), size: style.fontSize, width: advance };

        if (room !== null && room - advance < spare) found.push(Object.assign(base, { kind: 'room', amount: room - advance, problem: 'the text is ' + Math.round(advance * 10) / 10 + 'px wide in a box of ' + Math.round(room * 10) / 10 + 'px, which leaves ' + Math.round((room - advance) * 10) / 10 + 'px (needs ' + spare + ')' }, rectOf(element, where)));
        else if (cut && style.overflow === 'visible') found.push(Object.assign(base, { kind: 'cut', amount: element.scrollWidth - element.clientWidth, problem: 'the text runs ' + (element.scrollWidth - element.clientWidth) + 'px past its box' }, rectOf(element, where)));
        else if (outside > 1 / where.scale) found.push(Object.assign(base, { kind: 'parent', amount: outside / where.scale, problem: 'the box runs ' + Math.round(outside / where.scale * 10) / 10 + 'px past its parent' }, rectOf(element, where)));
      });
    });
    return found;
  };

  // The title of the countdown in whichever clock is on the screen: what it says on each line, at what size, how its box
  // is placed (data-title), and whether any of it is cut off
  motion.countdownTitle = function () {
    const clock = document.querySelector('#stage .war-clock, #stage .countdown');
    if (!clock) return null;

    const label = clock.querySelector('.label');
    const date = clock.querySelector('.date');
    const style = window.getComputedStyle(label);
    const group = label.closest('.label-group, .war-lines') || label.parentElement;
    const lines = label.textContent.split('\n');

    measuring.font = style.fontStyle + ' ' + style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    measuring.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
    return {
      form: clock.classList.contains('war-wide') ? 'wide' : clock.classList.contains('war-clock') ? 'narrow' : 'original',
      mode: clock.dataset.title || '',
      lines: lines,
      date: date ? date.textContent : '',
      size: parseFloat(style.fontSize),
      widest: Math.max(...lines.map(line => measuring.measureText(line).width)),
      cutWidth: label.scrollWidth - label.clientWidth,
      cutHeight: group.scrollHeight - group.clientHeight,
      name: nameOf(label),
    };
  };

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
