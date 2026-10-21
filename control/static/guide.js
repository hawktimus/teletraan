// The words that explain the control page to the people who use it: one plain sentence under every tab and section heading, the
// short "What do I do here?" note at the top of each tab, and the More tools disclosure that folds the rarely used cards. The
// sentences are all here, in one place, so a student can read them in a row and change one without hunting through the tabs.
// Each says what the section does and what happens when you press its main button.
//
// The note of a tab shows the first time a browser opens it and is remembered in that browser (localStorage). The Help link in
// the header brings every note back. The same goes for the open state of More tools. A browser that will not keep anything
// just shows the notes every time, and More tools starts closed.

function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const sentences = {
  status: 'This tab only shows what the wall is doing. Nothing on it changes the wall.',
  'status.preview': 'A picture of the TV. Show live preview loads it and the same button hides it again. It changes nothing on the wall.',
  'status.now': 'What the TV says about itself every 10 seconds. It is read only.',
  'status.health': 'Whether the Teletraan computer and its services are working. A red or amber line says what to check.',
  'status.links': 'These links take you to the tab where the wall can be changed.',
  'health.dots': 'The three small dots drawn on the TV. Green means up to date, amber means late and red means failed.',
  'health.reads': 'When the Teletraan computer last read each outside source. Old times mean a sync has stopped.',
  'health.running': 'Which version is on the wall and whether the screen has been starting over.',
  'health.computer': 'How the Teletraan computer itself is doing: how long it has been on, its disk, its memory and its temperature.',
  'health.errors': 'The last problems the control service wrote down. An empty list is good news.',

  display: 'Choose what the wall plays. The four cards at the top act at once. Changes to the rows and the themes reach the wall only after you press Save to draft and then Publish to the wall.',
  'display.onwall': 'What the wall plays now. Pause, Next and Back to schedule move the rotation, and Show on the wall holds a view or a panel for the minutes you choose.',
  'display.theme-card': 'The theme on the wall now. Pick another and press Switch to this theme to hold it for the minutes you choose, then the wall goes back to its schedule.',
  'display.announce': 'A short announcement under the banner, the announcements and the test talk, and the hidden transitions. You will not need them every day.',
  'display.preview': 'A picture of the row you pick. It changes nothing on the wall. The buttons under it save and publish this page.',
  'display.rotation': 'The list the wall plays, top to bottom. Change it here, then press Save to draft and Publish to the wall.',
  'display.rows': 'Each card is one row of the loop. Up and Down move a row. Nothing reaches the wall until you publish.',
  'display.add': 'Add row at the end puts a new row at the bottom of the list. Press Save to draft to keep it.',
  'display.more': 'Quick hide and motion. You will rarely need them.',
  'display.quick': 'Switches Show on screen off for many rows at once, and on again later. Press Save to draft to keep the change.',
  'display.motion': 'How much the wall moves. Press Save to draft and then Publish to the wall to change it.',
  'display.theme': 'Which theme the wall uses on each day. Press Save to draft and then Publish to the wall to change it.',

  content: 'This is what the wall says. Every change is saved as a draft first, and it reaches the wall only after you press Publish to the wall.',
  'content.ticker': 'The tips, news and reminders on the ticker. Add line makes a draft. Publish to the wall puts the drafts on the wall.',
  'content.calendar': 'The coming BAND events. Hide stops the wall showing one. Publish to the wall puts your choices on the wall.',
  'content.roster': 'Everyone on the team. Edit changes a person. Publish to the wall puts the change on the wall.',
  'content.announcements': 'The bar under the banner for a notice people must see. Post now puts it on the wall at once for the time you choose.',
  'content.photos': 'The pictures of the Photo panel. Add photo uploads a picture as a draft. Publish to the wall puts it on the wall.',

  settings: 'Keys, updates and the settings of the Teletraan computer. Open one section at a time.',
  'settings.update': 'Shows the version on the wall. Update from GitHub installs the newest version and restarts the screen. Roll back goes to an older one.',
  'update.github': 'Update from GitHub downloads the newest version, checks it and puts it on the wall.',
  'update.folder': 'Push to the wall sends the folder you pick from this computer to the wall, the same way.',
  'update.back': 'Switch to this version puts an older version back on the wall.',
  'settings.keys': 'The secret keys and calendar links the computer uses. They are never shown. Save keeps what you typed.',
  'settings.monday': 'Shows how well the computer is reading the Monday boards. It changes nothing.',
  'settings.sync': 'Sync all reads every outside source now. The Restart buttons restart the screen or the computer.',
  'settings.competition': 'The competition data the wall shows. Read again checks it now. It changes nothing.',
  'settings.screen': 'How the picture fits the TV window. Fit the dashboard to the screen works it out and publishes it for you.',
  'settings.reboot': 'When the Teletraan computer restarts by itself. Save to draft and Publish to the wall change the schedule.',
  'settings.cleanup': 'Clears out old expired items each night. Show what would be deleted now lists them and deletes nothing.',
  'settings.log': 'What the control service and the helper wrote down. Refresh reads the newest lines.',
  'settings.all': 'Every setting from the Studio in one place. Save to draft keeps your changes. Publish to the wall puts them on the wall.',
  'settings.more-log': 'Download the verbose log to send to a coach or keep with a bug report.',
};

export const helpNotes = {
  status: ['Status shows what the TV is doing right now.', 'Nothing here changes the wall. To change it, use Display or Content.', 'If a line is red or amber, open Health and read what it says.'],
  display: ['Display decides what the wall plays and in what order.', 'The cards at the top act at once and end by themselves.', 'The rows and the theme days are different. Change them, press Save to draft, then press Publish to the wall. Undo takes back your last change.'],
  content: ['Content is the words and pictures on the wall: the ticker, the calendar, the roster, announcements and photos.', 'Open one block, change something, then press Publish to the wall.', 'Nothing reaches the TV until you publish.'],
  settings: ['Settings is for coaches and for fixing the Teletraan computer.', 'Open one section at a time. Most sections have a button that does what the section is named after.', 'If you are not sure, leave it alone and ask a coach.'],
};

export const helpTitle = 'What do I do here?';

// <p class="lead"> with the sentence of an id
export function leadIdOf(id) {
  return 'lead-' + id.replace(/[^a-z0-9]+/g, '-');
}

export function lead(id) {
  return '<p class="lead" id="' + esc(leadIdOf(id)) + '">' + esc(sentences[id] || '') + '</p>';
}

// ----- what a browser remembers -----

const prefix = 'teletraan.control.';

function readStored(name) {
  try { return window.localStorage.getItem(prefix + name); } catch (error) { return null; }
}

function writeStored(name, value) {
  try {
    if (value === null) window.localStorage.removeItem(prefix + name);
    else window.localStorage.setItem(prefix + name, value);
  } catch (error) { /* the note then shows again next time, which is harmless */ }
}

export function helpSeen(tab) {
  return readStored('help.' + tab) === 'seen';
}

export function markHelpSeen(tab) {
  writeStored('help.' + tab, 'seen');
}

// Brings every note back (the Help link in the header)
export function resetHelp() {
  Object.keys(helpNotes).forEach(tab => writeStored('help.' + tab, null));
}

export function helpNoteHtml(tab) {
  const lines = helpNotes[tab] || [];
  return '<section class="help-note" data-help="' + esc(tab) + '" aria-label="' + esc(helpTitle) + '"><h2>' + esc(helpTitle) + '</h2>' +
    '<ul>' + lines.map(line => '<li>' + esc(line) + '</li>').join('') + '</ul>' +
    '<button type="button" class="act" data-help-done>Got it</button></section>';
}

// Draws the note of a tab at the start of box when this browser has not dismissed it
export function mountHelpNote(box, tab) {
  if (helpSeen(tab) || !helpNotes[tab]) return;
  const holder = document.createElement('div');
  holder.innerHTML = helpNoteHtml(tab);
  const note = holder.firstElementChild;
  note.querySelector('[data-help-done]').addEventListener('click', () => {
    markHelpSeen(tab);
    note.remove();
  });
  box.prepend(note);
}

// ----- More tools -----

export function moreOpen(id) {
  return readStored('more.' + id) === 'open';
}

export function moreToolsHtml(id, inner, says) {
  return '<details class="more-tools" data-more="' + esc(id) + '"><summary aria-describedby="lead-' + esc(id) + '-more">More tools</summary>' +
    '<p class="lead" id="lead-' + esc(id) + '-more">' + esc(says) + '</p><div class="more-body">' + inner + '</div></details>';
}

// Opens the More tools of this browser's last visit and remembers each change
export function wireMoreTools(root) {
  root.querySelectorAll('details[data-more]').forEach(details => {
    const id = details.dataset.more;
    details.open = moreOpen(id);
    details.addEventListener('toggle', () => writeStored('more.' + id, details.open ? 'open' : null));
  });
}
