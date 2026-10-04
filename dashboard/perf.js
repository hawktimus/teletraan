// A readout for the hardware test. Add ?perf to the address to show it,
// and press P to hide or show it while you look at the screen.
//
// It watches how long each screen refresh takes. On a 60 Hz TV a good
// refresh is about 16.7 ms. A refresh over 25 ms was visibly late.
// Everything is counted from 3 seconds after the page starts until now,
// so it can run for hours. The text is smaller than the dashboard's 44px
// minimum because this is a test tool and never part of the real screen.

const LATE_MS = 25;
const WARM_UP_MS = 3000; // fonts and content are still loading at the start, so ignore it
const LONGEST_MS = 100; // anything slower than this is counted as this

export function start() {
  const box = document.createElement('div');
  box.style.cssText = [
    'position: fixed',
    'right: 8px',
    'bottom: 8px',
    'padding: 10px 16px',
    'background: #000',
    'border: 4px solid var(--gold, #faca2a)',
    'color: #fff',
    'font: 28px/36px monospace',
    'white-space: pre',
    'z-index: 10',
  ].join(';');
  document.body.appendChild(box);

  document.addEventListener('keydown', event => {
    if (event.key === 'p' || event.key === 'P') box.hidden = !box.hidden;
  });

  // counts[n] is how many refreshes took about n milliseconds
  const counts = new Array(LONGEST_MS + 1).fill(0);
  const startedAt = performance.now();
  let lastFrame = startedAt;
  let total = 0;
  let lateFrames = 0;
  let worst = 0;

  function onFrame(now) {
    const gap = now - lastFrame;
    lastFrame = now;

    if (now - startedAt > WARM_UP_MS) {
      counts[Math.min(Math.round(gap), LONGEST_MS)]++;
      total++;
      if (gap > LATE_MS) lateFrames++;
      if (gap > worst) worst = gap;
    }
    requestAnimationFrame(onFrame);
  }
  requestAnimationFrame(onFrame);

  // the refresh time that this share of refreshes were at or under
  function percentile(fraction) {
    let seen = 0;
    for (let ms = 0; ms <= LONGEST_MS; ms++) {
      seen += counts[ms];
      if (seen >= total * fraction) return ms;
    }
    return LONGEST_MS;
  }

  let latest = '';

  function report() {
    if (total === 0) return;
    const page = document.documentElement.dataset;

    const lines = [
      'motion ' + page.motion + '  speed ' + page.speed + '  draw ' + page.draw,
      'frame ms  typical ' + percentile(0.5) + '  p95 ' + percentile(0.95),
      'worst ' + worst.toFixed(1) + '  late ' + lateFrames,
      'animations running ' + document.getAnimations().length,
    ];
    if (performance.memory) {
      lines.push('memory ' + Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB');
    }

    box.textContent = lines.join('\n');
    latest = lines.join(' | ');
  }

  setInterval(report, 1000);

  // also write a line to the console every 10 seconds, for copying out later
  setInterval(() => console.log(latest), 10000);
}
