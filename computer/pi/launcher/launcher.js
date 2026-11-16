// The home screen of the Raspberry Pi: choose a tile with the arrow keys, X, Enter or a controller, and the choice goes
// to the exit watcher (/pi/go/<name>), which closes this page. home.sh then starts what was chosen.
// computer/pi/README.md, "The home screen".
(function () {
  'use strict';
  var tiles = Array.prototype.slice.call(document.querySelectorAll('.tile'));
  var status = document.getElementById('status');
  var chosen = false;
  var index = 0;

  function say(text, bad) {
    status.textContent = text;
    status.className = bad ? 'bad' : '';
  }

  function mark(next) {
    index = (next + tiles.length) % tiles.length;
    tiles.forEach(function (tile, position) { tile.classList.toggle('marked', position === index); });
    tiles[index].focus();
  }

  function choose() {
    if (chosen) return;
    var tile = tiles[index];
    chosen = true;
    say('Opening ' + tile.querySelector('.name').textContent + '...');
    // A plain request with no body: the listener only needs the name in the address
    fetch('/pi/go/' + tile.getAttribute('data-go'), { cache: 'no-store' }).then(function (reply) {
      if (!reply.ok) throw new Error('refused');
      // The browser is closed by the listener, so nothing more happens here
    }).catch(function () {
      chosen = false;
      say('The console did not answer. Try again, or press Ctrl + Alt + Backspace.', true);
    });
  }

  // The tile marked first is the one chosen last (?focus=name), so coming back from a talk lands on Meeting again
  var focus = new URLSearchParams(window.location.search).get('focus');
  tiles.forEach(function (tile, position) {
    if (tile.getAttribute('data-go') === focus) index = position;
    tile.addEventListener('click', function () { mark(position); choose(); });
    tile.addEventListener('mouseenter', function () { mark(position); });
  });
  mark(index);

  document.addEventListener('keydown', function (event) {
    if (event.repeat) return;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowDown': mark(index + 1); break;
      case 'ArrowLeft': case 'ArrowUp': mark(index - 1); break;
      case 'Enter': case ' ': case 'x': case 'X': choose(); break;
      default: return;
    }
    event.preventDefault();
  });

  // A controller: the d-pad or the left stick to choose, A to open. Polled, because the page has no events for it.
  var held = {};
  function pressed(pad, number) { return pad.buttons[number] && pad.buttons[number].pressed; }
  function edge(name, on, action) {
    if (on && !held[name]) action();
    held[name] = on;
  }
  function poll() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var i = 0; i < pads.length; i++) {
      var pad = pads[i];
      if (!pad) continue;
      var x = pad.axes[0] || 0;
      edge('left' + i, pressed(pad, 14) || x < -0.6, function () { mark(index - 1); });
      edge('right' + i, pressed(pad, 15) || x > 0.6, function () { mark(index + 1); });
      edge('a' + i, pressed(pad, 0), choose);
    }
    window.requestAnimationFrame(poll);
  }
  window.requestAnimationFrame(poll);
}());
