// Teletraan decks feed. A Google Apps Script that runs as the person who deploys it and hands the
// Teletraan computer the Google Slides decks of ONE Drive folder, without that folder being public.
// Setup is in docs/presentations-drive.md, "A folder that is not public".
//
// What it does, and all it does:
//   ?action=list&folder=ID&secret=WORD   the Slides decks of the folder, newest first
//   ?action=pdf&id=DECK&folder=ID&secret=WORD   one deck of the folder as a PDF, written in base64
//   ?action=skipped&id=DECK&folder=ID&secret=WORD   how many slides the deck has and which are hidden (Skip slide)
// Every request needs the secret word, and the folder must be the one named in the script's
// properties. It reads nothing else in Drive and writes nothing. Reading the hidden slides needs the
// Slides permission, which Google asks for the next time check() is run.
//
// Script Properties (Project Settings, Script Properties):
//   SECRET     a word of 16 to 100 letters, digits, - and _. The same word goes in local.env as
//              DECKS_SCRIPT_SECRET on the Teletraan computer.
//   FOLDER_ID  the id of the Drive folder, the part of its link after /folders/

function doGet(e) {
  var parameter = (e && e.parameter) || {};
  var properties = PropertiesService.getScriptProperties();
  var secret = properties.getProperty('SECRET');
  var folder = properties.getProperty('FOLDER_ID');

  if (!secret || !folder || !sameText(parameter.secret, secret)) return answer({ error: 'denied' });
  if (parameter.folder !== folder) return answer({ error: 'wrong-folder' });

  try {
    if (parameter.action === 'list') return answer({ files: listDecks(folder) });
    if (parameter.action === 'pdf') return sendPdf(folder, parameter.id);
    if (parameter.action === 'skipped') return skippedSlides(folder, parameter.id);
    return answer({ error: 'bad-action' });
  } catch (error) {
    Logger.log(String(error));
    return answer({ error: 'failed' });
  }
}

function answer(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}

// Compares two words without stopping at the first letter that differs
function sameText(given, expected) {
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  var difference = 0;
  for (var index = 0; index < expected.length; index++) {
    difference |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

// The same fields the Drive API gives, so the Teletraan computer reads both alike
function listDecks(folder) {
  var decks = [];
  var files = DriveApp.getFolderById(folder).getFilesByType(MimeType.GOOGLE_SLIDES);
  while (files.hasNext()) {
    var file = files.next();
    decks.push({
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      modifiedTime: file.getLastUpdated().toISOString(),
    });
  }
  decks.sort(function (a, b) {
    return a.modifiedTime < b.modifiedTime ? 1 : a.modifiedTime > b.modifiedTime ? -1 : 0;
  });
  return decks.slice(0, 100);
}

function inFolder(file, folder) {
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folder) return true;
  }
  return false;
}

// The Slides deck with this id when it is in the folder, else null
function deckInFolder(folder, id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{10,100}$/.test(id)) return null;
  var file;
  try {
    file = DriveApp.getFileById(id);
  } catch (error) {
    return null;
  }
  if (file.getMimeType() !== MimeType.GOOGLE_SLIDES || !inFolder(file, folder)) return null;
  return file;
}

function sendPdf(folder, id) {
  var file = deckInFolder(folder, id);
  if (!file) return answer({ error: 'not-found' });
  var pdf = file.getAs(MimeType.PDF).getBytes();
  return ContentService.createTextOutput(Utilities.base64Encode(pdf)).setMimeType(ContentService.MimeType.TEXT);
}

// The PDF of a deck holds every slide, hidden ones too. This says how many slides the deck has and which of them
// are marked Skip slide (counted from 1), so the Teletraan computer can leave those out.
function skippedSlides(folder, id) {
  var file = deckInFolder(folder, id);
  if (!file) return answer({ error: 'not-found' });
  var slides = SlidesApp.openById(id).getSlides();
  var skipped = [];
  for (var index = 0; index < slides.length; index++) {
    if (slides[index].isSkipped()) skipped.push(index + 1);
  }
  return answer({ count: slides.length, skipped: skipped });
}

// Run this from the editor (Run, check) once after setup and again after an update of this script. The first
// run asks to let the script see your Drive and your Slides decks. The log (View, Logs) then says how many
// decks the script sees in the folder and how many slides of the newest one are hidden.
function check() {
  var folder = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  var decks = listDecks(folder);
  Logger.log('Decks seen in the folder: ' + decks.length);
  if (decks.length > 0) {
    var answerText = skippedSlides(folder, decks[0].id).getContent();
    Logger.log('Newest deck, slides and hidden slides: ' + answerText);
  }
}
