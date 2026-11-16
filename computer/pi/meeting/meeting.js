// Presentations on the Raspberry Pi.
//   List:    Up and Down choose, Enter opens, Esc goes back to the home screen.
//   Slides:  any key goes to the next slide, Left (or Page Up) to the one before, Esc leaves for the Dashboard. After the
//            last slide, the next key shows the list again.
// The pictures are on the disk of the Pi (meeting-sync.sh makes them as soon as a deck is in the Drive folder), and the page
// keeps the slides around the one on screen already loaded, so a key press shows the next slide with no wait.
// computer/pi/README.md, "Meeting".
(function () {
  'use strict';
  var DATA = '/meeting-data/';
  var AHEAD = 4;
  var BEHIND = 2;
  var list = document.getElementById('list');
  var show = document.getElementById('show');
  var rows = document.getElementById('decks');
  var count = document.getElementById('count');
  var note = document.getElementById('note');
  var frames = document.getElementById('frames');
  var counter = document.getElementById('counter');

  var decks = [];
  var marked = 0;
  var markedId = '';
  var view = 'list';
  var current = null;
  var slide = 0;
  var loaded = {};
  var counterTimer = 0;
  var leaving = false;

  function say(text, bad) {
    note.textContent = text;
    note.className = bad ? 'bad' : '';
  }

  // ---- the list ------------------------------------------------------------------------------------------------

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function added(text) {
    var date = new Date(text);
    if (isNaN(date.getTime())) return '';
    return 'Added ' + MONTHS[date.getMonth()] + ' ' + date.getDate();
  }

  function stateOf(deck) {
    if (deck.state === 'ready') return { text: deck.pages + (deck.pages === 1 ? ' slide' : ' slides') + (deck.updating ? ', newer one on its way' : ''), wait: false, bad: false };
    if (deck.state === 'failed') return { text: 'Could not be made' + (deck.error ? ': ' + deck.error : ''), wait: true, bad: true };
    return { text: 'Getting ready...', wait: true, bad: false };
  }

  var REASONS = {
    'no-folder': 'No Google Drive folder is named. Put MEETING_DRIVE_FOLDER in local.env on the Pi.',
    'no-key': 'There is no Google key yet. Put GOOGLE_API_KEY in local.env on the Pi.',
    'bad-key': 'Google did not accept the key.',
    'api-off': 'The Google Drive API is not turned on for the key.',
    'not-shared': 'Google would not list the folder. Share it with Anyone with the link.',
    'offline': 'Google cannot be reached right now. The decks that are here can still be shown.'
  };

  function draw() {
    rows.textContent = '';
    count.textContent = decks.length ? decks.length + (decks.length === 1 ? ' presentation' : ' presentations') : '';
    decks.forEach(function (deck, position) {
      var info = stateOf(deck);
      var item = document.createElement('li');
      item.className = 'deck' + (position === marked ? ' marked' : '') + (info.wait ? ' wait' : '') + (info.bad ? ' bad' : '');
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = deck.name;
      var meta = document.createElement('span');
      meta.className = 'meta';
      var stateLine = document.createElement('span');
      stateLine.className = 'state';
      stateLine.textContent = info.text;
      meta.appendChild(stateLine);
      meta.appendChild(document.createTextNode(added(deck.created)));
      item.appendChild(name);
      item.appendChild(meta);
      rows.appendChild(item);
    });
    var marker = rows.querySelector('.marked');
    if (marker && marker.scrollIntoView) marker.scrollIntoView({ block: 'nearest' });
  }

  function warm(deck) {
    // The first slides of the marked deck, so that opening it shows the title at once
    if (!deck || deck.state !== 'ready') return;
    var keep = [];
    for (var number = 1; number <= Math.min(2, deck.pages); number++) {
      keep.push(deck.id + ':' + (number - 1));
      frame(deck, number - 1);
    }
    forget(keep);
  }

  function refresh() {
    fetch(DATA + 'manifest.json', { cache: 'no-store' }).then(function (reply) {
      if (!reply.ok) throw new Error('none');
      return reply.json();
    }).then(function (manifest) {
      if (view !== 'list') return;
      decks = manifest.decks || [];
      var keep = decks.map(function (deck) { return deck.id; }).indexOf(markedId);
      marked = keep >= 0 ? keep : Math.min(marked, Math.max(decks.length - 1, 0));
      markedId = decks[marked] ? decks[marked].id : '';
      draw();
      warm(decks[marked]);
      if (manifest.state && manifest.state !== 'ok') say(REASONS[manifest.state] || '', manifest.state !== 'offline' || !decks.length);
      else if (!decks.length) say('There are no presentations in the folder yet.', false);
      else say('', false);
    }).catch(function () {
      if (view !== 'list') return;
      say('The list is not ready yet. The presentation service of the Pi is not running.', true);
    });
  }

  function mark(next) {
    if (!decks.length) return;
    marked = Math.max(0, Math.min(decks.length - 1, next));
    markedId = decks[marked].id;
    draw();
    warm(decks[marked]);
    say('', false);
  }

  // ---- the slides ----------------------------------------------------------------------------------------------

  function address(deck, index) {
    // The number of the picture is three digits, and the version of the deck keeps the browser from showing an old one
    return DATA + deck.id + '/' + ('00' + (index + 1)).slice(-3) + '.jpg?v=' + encodeURIComponent(deck.modified || '');
  }

  function frame(deck, index) {
    var key = deck.id + ':' + index;
    if (loaded[key]) return loaded[key];
    var picture = document.createElement('img');
    picture.decoding = 'async';
    picture.alt = '';
    picture.src = address(deck, index);
    frames.appendChild(picture);
    loaded[key] = picture;
    if (picture.decode) picture.decode().catch(function () { });
    return picture;
  }

  function forget(keep) {
    Object.keys(loaded).forEach(function (key) {
      if (keep.indexOf(key) >= 0) return;
      frames.removeChild(loaded[key]);
      delete loaded[key];
    });
  }

  function showSlide(index) {
    var deck = current;
    var keep = [];
    for (var number = index - BEHIND; number <= index + AHEAD; number++) {
      if (number >= 0 && number < deck.pages) {
        keep.push(deck.id + ':' + number);
        frame(deck, number);
      }
    }
    forget(keep);
    Object.keys(loaded).forEach(function (key) { loaded[key].classList.remove('on'); });
    loaded[deck.id + ':' + index].classList.add('on');
    slide = index;
    counter.textContent = (index + 1) + ' / ' + deck.pages + (index === deck.pages - 1 ? '  ·  any key for the list' : '');
    counter.classList.add('up');
    window.clearTimeout(counterTimer);
    counterTimer = window.setTimeout(function () { counter.classList.remove('up'); }, 1800);
  }

  function present(deck) {
    current = deck;
    view = 'show';
    list.hidden = true;
    show.hidden = false;
    showSlide(0);
  }

  function toList() {
    view = 'list';
    show.hidden = true;
    list.hidden = false;
    forget([]);
    current = null;
    refresh();
  }

  // ---- leaving -------------------------------------------------------------------------------------------------

  // Both go through the listener of the exit watcher (/pi/...), which closes this page. home.sh then starts what is next.
  function ask(address, failed) {
    if (leaving) return;
    leaving = true;
    fetch(address, { cache: 'no-store' }).then(function (reply) {
      if (!reply.ok) throw new Error('refused');
    }).catch(function () {
      leaving = false;
      failed();
    });
  }

  // ---- keys ----------------------------------------------------------------------------------------------------

  var MODIFIERS = ['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'FnLock', 'Dead'];

  document.addEventListener('keydown', function (event) {
    if (event.repeat || MODIFIERS.indexOf(event.key) >= 0) return;
    event.preventDefault();

    if (view === 'show') {
      if (event.key === 'Escape') {
        ask('/pi/go/dashboard', function () { counter.textContent = 'The console did not answer. Press Ctrl + Alt + Backspace.'; counter.classList.add('up'); });
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        if (slide > 0) showSlide(slide - 1);
      } else if (slide < current.pages - 1) {
        showSlide(slide + 1);
      } else {
        toList();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown': mark(marked + 1); break;
      case 'ArrowUp': mark(marked - 1); break;
      case 'PageDown': mark(marked + 5); break;
      case 'PageUp': mark(marked - 5); break;
      case 'Home': mark(0); break;
      case 'End': mark(decks.length - 1); break;
      case 'Enter': case ' ': case 'x': case 'X':
        if (!decks.length) break;
        if (decks[marked].state === 'ready' && decks[marked].pages > 0) present(decks[marked]);
        else say(decks[marked].state === 'failed' ? 'That one could not be made.' : 'That one is still getting ready.', decks[marked].state === 'failed');
        break;
      case 'Escape':
        ask('/pi/leave', function () { say('The console did not answer. Press Ctrl + Alt + Backspace.', true); });
        break;
      default: break;
    }
  });

  refresh();
  window.setInterval(function () { if (view === 'list') refresh(); }, 3000);
}());
