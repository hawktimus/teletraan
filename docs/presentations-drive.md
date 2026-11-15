# Presentations from a Google Drive folder

For the coaches and the students who run a meeting. Put a Google Slides deck or a PowerPoint file in one Google Drive folder, and it can be played on the TV: pick it from a list on the TV or on the control page, and the clicker does the rest. Nothing is booked and nothing is typed in Studio for a deck. A booked talk still works as before (docs/presentations.md), and the two use the same title card, slides and keys.

The names of the files show on the TV, so name a file the way you want it read.

## Set it up once

1. The Google key. The folder is read with the same key as the Drive photos, `GOOGLE_API_KEY` in `local.env` on the Teletraan computer. If the Drive photos work, there is nothing to do. If not, follow steps 1 to 6 of docs/photos-drive.md.
2. Make the folder. In Google Drive make a folder for the presentations. Right click it, then Share. Under General access choose Anyone with the link, with the role Viewer. Click Copy link. Anyone who has the link can open what is in the folder, so keep private files out of it.
3. Tell Studio. Open Dashboard Settings, the Presentations section, paste the link under Google Drive folder of presentations and click Publish.
4. Check that Run presentations is on, in the same section. Off, the TV starts no deck and no booked talk.

The Teletraan computer takes up the new link within 5 minutes. The watcher is installed by the update from the Mac tool, or once by hand: `sudo /opt/teletraan/computer/scripts/install-decks.sh`. It needs the packages poppler-utils, curl and jq, which are there if the slides of booked talks work.

## What goes in the folder

- Google Slides decks, and PowerPoint files ending in .pptx. Other files are left out of the list. A folder inside the folder is not read.
- A file dropped in the folder is in the list within 20 seconds, as Getting ready. It can be played when its line shows its number of slides, which takes about as long again for a short deck and a minute or two for a long one.
- A deck that is changed in Google Slides is made again by itself. The old pictures stay until the new ones are done, and the line says a newer version is on its way.
- A file taken out of the folder leaves the list within 20 seconds.
- The 30 files changed last are listed, newest first. A deck longer than 120 slides is cut at 120.
- Animations, videos and sounds do not play. Each slide is one still picture, as in a PDF. Google makes the pictures, so a PowerPoint file can look a little different from PowerPoint, most often in its fonts. Open it once in Google Drive to see what the TV will show.

## Play one from the TV

1. Press the play button of the clicker, or F5 or P on a keyboard. The list comes up over the dashboard. It does not open while a talk or an alert has the screen.
2. Move with the Next and Back keys of the clicker (Page Down and Page Up, or the arrows).
3. Start the marked deck with Enter, Space, or the black screen key of the clicker (B or the full stop). On a touch screen, tap the deck. The play button of some clickers sends F5 one time and Esc the next, which is why the black screen key starts a deck as well.
4. The title card comes up with the name of the deck. From there everything is as in a booked talk (docs/presentations.md, "On the day"): the first forward key starts it, Esc twice ends it, and the Thank you card closes it.

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

`computer/scripts/decks-sync.sh --watch` runs as the service `teletraan-decks`. Every 20 seconds it asks Google for the list of the folder and writes `decks/manifest.json` in the data folder. Beside that it downloads each deck that is new or changed as a PDF and cuts it into pictures in `decks/<id of the file>/`, the way `slides-sync.sh` does for a booked talk. The folder link is read from Dashboard Settings in Sanity every 5 minutes. When Sanity or Google cannot be reached, the list and the pictures from before stay.

The screen reads the list only while the list is open, every 5 seconds. A picked deck becomes a talk that starts now (`deckTalk` in `dashboard/core/decks.js`) and is played by the same code as a booked talk. It has no slot, so only the speaker ends it, or 4 hours. The address of each picture ends with the time the pictures were made, so a deck that was edited is never shown from what the browser kept of the old one.

| What | Where |
| --- | --- |
| The watcher, its service and its installer | `computer/scripts/decks-sync.sh`, `computer/systemd/teletraan-decks.service`, `computer/scripts/install-decks.sh` |
| The list on the TV | `dashboard/core/decks.js`, `dashboard/core/decks-run.js`, `dashboard/decks.css` |
| The control page | `control/routes/decks.js`, `control/support/decks.js`, `control/static/tabs/decks.js` |
| The Studio field | `studio/schemas/settingsPresentations.js` |
| The checks | `tests/decks.test.mjs`, `tests/decks-sync.test.mjs` |
