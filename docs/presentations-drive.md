# Presentations from a Google Drive folder

For the coaches and the students who run a meeting. Put a Google Slides deck or a PowerPoint file in one Google Drive folder, and it can be played on the TV: pick it from a list on the TV or on the control page, and the clicker does the rest. Nothing is booked and nothing is typed in Studio for a deck. This is the only way a talk is played now. The keys, the mouse and the settings are in docs/presentations.md.

The names of the files show on the TV, so name a file the way you want it read.

## Set it up once

1. The Google key. The folder is read with the same key as the Drive photos, `GOOGLE_API_KEY` in `local.env` on the Teletraan computer. If the Drive photos work, there is nothing to do. If not, follow steps 1 to 6 of docs/photos-drive.md.
2. Make the folder. In Google Drive make a folder for the presentations. Right click it, then Share. Under General access choose Anyone with the link, with the role Viewer. Click Copy link. Anyone who has the link can open what is in the folder, so keep private files out of it.
3. Tell Studio. Open Dashboard Settings, the Presentations section, paste the link under Google Drive folder of presentations and click Publish.
4. Check that Run presentations is on, in the same section. Off, the TV starts no deck.

The Teletraan computer takes up the new link within 5 minutes. The watcher is installed by the update from the Mac tool, or once by hand: `sudo /opt/teletraan/computer/scripts/install-decks.sh`. It needs the packages poppler-utils, curl and jq.

## A folder that is not public

The steps above need a folder shared with Anyone with the link. When the folder belongs to someone else, or may not be made public, a small Google Apps Script can read it instead. The script runs as one person who can already open the folder, and it hands the Teletraan computer the decks of that one folder and nothing else in Drive. The Teletraan computer asks it by a long web address and a secret word. Only Google Slides decks come this way. A PowerPoint file has to be opened in Google Slides and saved as a Google Slides deck first.

1. Open script.google.com signed in as the Google account that can open the folder. Choose New project and name it Teletraan decks feed.
2. Open computer/apps-script/decks-feed.gs from this repository, copy all of it, and paste it over everything in Code.gs. Save.
3. Click Project Settings (the gear), then Script Properties, then Add script property. Add two. SECRET is a word of 16 to 100 letters, digits, - and _, which you make up. FOLDER_ID is the part of the folder's link after /folders/ and before any ?. Save.
4. Go back to the editor, choose the function check in the bar at the top and click Run. Google asks to review permissions. Choose the account, then Advanced, then Go to Teletraan decks feed (unsafe), then Allow. This is your own script, which is why Google says unsafe. Then open Execution log: it says Decks seen in the folder and a number. If the number is 0 the account cannot open the folder, or FOLDER_ID is wrong.
5. Click Deploy, then New deployment. For the type choose Web app. Set Execute as to Me and Who has access to Anyone. Click Deploy and copy the Web app address, which ends in /exec.
6. On the Teletraan computer add two lines to computer/local.env, with your own values, and nothing else needs a restart:

```
DECKS_SCRIPT_URL='the Web app address'
DECKS_SCRIPT_SECRET='the same word as SECRET'
```

7. Paste the folder link in Dashboard Settings, Presentations, as before. The FOLDER_ID in the script has to be that same folder.

The list on the TV says what is wrong when it is not working: the address is wrong or the script is not open to Anyone, the secret does not match, or the script is set up for another folder. The same table below applies.

- Anyone who has the web address still needs the secret, and the script only ever lists and sends the Slides decks of FOLDER_ID. Keep the secret out of chat, notes and the repository.
- The script runs as you. If you are taken out of the folder, the decks stop updating, and the decks already made stay on the TV.
- After a change to the script code, choose Deploy, Manage deployments, the pencil, Version: New version, Deploy. The address does not change.
- Hidden slides: a slide marked Skip slide in Google Slides is left out of the TV. The PDF that Google makes holds every slide, so the script also tells the Teletraan computer which slides are hidden (decks-feed.gs, action skipped) and the computer drops those pictures. To get this into a script that was set up earlier, paste the new decks-feed.gs over Code.gs, Save, run check once and allow the Slides permission when Google asks, then deploy a New version as in the line above. Until then a deck that has to be made again shows as could not be made (the script cannot name the hidden slides), and the pictures from before stay on the TV. A public folder (the Google key way, without the script) cannot tell which slides are hidden, so it shows every slide.
- Hiding or showing a slide changes the deck, so its pictures are made again within a few minutes.
- To move to another Google account, do steps 1 to 5 again in that account and put its new address and secret in local.env.
- A deck needs to fit in one answer from the script, so a very large deck (about 30 MB as a PDF or more) can fail. The list then shows the deck as could not be read.

## What goes in the folder

- Google Slides decks, and PowerPoint files ending in .pptx. Other files are left out of the list. A folder inside the folder is not read.
- A file dropped in the folder is in the list within 20 seconds, as Getting ready. It can be played when its line shows its number of slides, which takes about as long again for a short deck and a minute or two for a long one.
- A deck that is changed in Google Slides is made again by itself. The old pictures stay until the new ones are done, and the line says a newer version is on its way.
- A file taken out of the folder leaves the list within 20 seconds.
- The 30 files changed last are listed, newest first. A deck longer than 120 slides is cut at 120.
- Animations, videos and sounds do not play. Each slide is one still picture, as in a PDF. Google makes the pictures, so a PowerPoint file can look a little different from PowerPoint, most often in its fonts. Open it once in Google Drive to see what the TV will show.

## Play one from the TV

1. Press the play button of the clicker, or F5 or P on a keyboard. The list comes up over the dashboard. It does not open while a talk or an alert has the screen.
2. Move with the Next and Back keys of the clicker (Page Down and Page Up, or the arrows). With a mouse, move it: the row under it is marked. The pointer itself stays hidden on the wall, so the marked row is the sign of where the mouse is.
3. Start the marked deck with Enter, Space, or the black screen key of the clicker (B or the full stop). With a mouse, left click the row. On a touch screen, tap the deck. The play button of some clickers sends F5 one time and Esc the next, which is why the black screen key starts a deck as well.
4. The deck fills the screen on its first slide, with no title card. The keys are in docs/presentations.md, "On the day": any forward key, or a left click, goes on, Left arrow, Page Up or a right click goes back, and after the last slide the deck ends and the dashboard comes back at once, with no Thank you card. No slide number is drawn. One Esc ends the deck at once and gives the screen back to the dashboard. If the play button of a clicker sends Esc, it ends the deck, so use the Next key of the clicker to move.

Esc closes the list. It also closes by itself a minute after the last key.

## Play one from the control page

Open the control page, Show, Presentations. Each deck has a Play on the TV button. The title card is on the TV within 10 seconds, and the clicker starts the slides. The pick goes to the screen of that computer only: it does not go through Sanity, so a second screen that reads the same Studio does not play it.

## When it does not work

The list on the TV and the Presentations section of the control page say what is wrong in one line.

| What it says | What to do |
| --- | --- |
| No Google Drive folder is named | Paste the folder link in Dashboard Settings, Presentations, and publish. |
| The Google key is missing, or Google did not accept the key | Set `GOOGLE_API_KEY` in the Keys section of the control page (docs/photos-drive.md, step 6). |
| The Google Drive API is not turned on | docs/photos-drive.md, step 3. |
| Google would not list the folder | Share the folder with Anyone with the link as Viewer, and check the link. |
| Google Drive cannot be reached right now | The internet is down. The decks that were made before can still be played. |
| The list is not ready yet | The watcher is not running. On the Teletraan computer: `systemctl status teletraan-decks`. |
| A deck says Could not be read: not shared | The file has its own sharing that is tighter than the folder. Share the file with Anyone with the link too. |
| Run presentations is switched off | Switch it on in Dashboard Settings, Presentations, and publish. |

To see what the watcher last did: `journalctl -u teletraan-decks -n 30`. To look at the folder once by hand, with every step printed: `/opt/teletraan/computer/scripts/decks-sync.sh`.

## How it works

`computer/scripts/decks-sync.sh --watch` runs as the service `teletraan-decks`. Every 20 seconds it asks Google for the list of the folder and writes `decks/manifest.json` in the data folder. Beside that it downloads each deck that is new or changed as a PDF and cuts it into pictures in `decks/<id of the file>/`, the way `slides-sync.sh` did for a booked talk. The folder link is read from Dashboard Settings in Sanity every 5 minutes. When Sanity or Google cannot be reached, the list and the pictures from before stay.

The screen reads the list only while the list is open, every 5 seconds. A picked deck becomes a talk that starts now (`deckTalk` in `dashboard/core/decks.js`) and is played by the talk code of the screen (`core/presentation-run.js`). It has no slot, so only the speaker ends it, or 4 hours. The address of each picture ends with the time the pictures were made, so a deck that was edited is never shown from what the browser kept of the old one.

| What | Where |
| --- | --- |
| The watcher, its service and its installer | `computer/scripts/decks-sync.sh`, `computer/systemd/teletraan-decks.service`, `computer/scripts/install-decks.sh` |
| The list on the TV | `dashboard/core/decks.js`, `dashboard/core/decks-run.js`, `dashboard/decks.css` |
| The control page | `control/routes/decks.js`, `control/support/decks.js`, `control/static/tabs/decks.js` |
| The Studio field | `studio/schemas/settingsPresentations.js` |
| The checks | `tests/decks.test.mjs`, `tests/decks-sync.test.mjs` |
