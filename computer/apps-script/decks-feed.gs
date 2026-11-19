// Teletraan decks feed. A Google Apps Script that runs as the person who deploys it and hands the
// Teletraan computer the Google Slides decks of ONE Drive folder, without that folder being public.
// Setup is in docs/presentations-drive.md, "A folder that is not public".
//
// What it does, and all it does:
//   ?action=list&folder=ID&secret=WORD   the Slides decks of the folder, newest first
//   ?action=pdf&id=DECK&folder=ID&secret=WORD   one deck of the folder as a PDF, written in base64
// Every request needs the secret word, and the folder must be the one named in the script's
// properties. It reads nothing else in Drive and writes nothing.
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

function sendPdf(folder, id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{10,100}$/.test(id)) return answer({ error: 'not-found' });
  var file;
  try {
    file = DriveApp.getFileById(id);
  } catch (error) {
    return answer({ error: 'not-found' });
  }
  if (file.getMimeType() !== MimeType.GOOGLE_SLIDES || !inFolder(file, folder)) return answer({ error: 'not-found' });
  var pdf = file.getAs(MimeType.PDF).getBytes();
  return ContentService.createTextOutput(Utilities.base64Encode(pdf)).setMimeType(ContentService.MimeType.TEXT);
}

// Run this once from the editor (Run, check). The first run asks to let the script see your Drive.
// The log (View, Logs) then says how many decks the script sees in the folder.
function check() {
  var folder = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  Logger.log('Decks seen in the folder: ' + listDecks(folder).length);
}
