# Photos from Google Drive

For the coaches and the students who look after the Teletraan computer. The Photo panel can play the pictures of one Google Drive folder, next to the photos uploaded in Studio, or instead of them. This page says how to set it up once, what the screen does with the folder, and what to do when it stops.

The key in step 3 is a login and a secret, so a coach or mentor makes it. A student never needs it.

## The two ways to get photos

On the Photos page in Studio (PEOPLE, Photos) three buttons pick where the Photo panel gets its pictures.

- Upload photos. Pick many pictures at once on the page. Each one becomes a photo with no caption and no credit, switched on. This is how the panel always worked.
- Google Drive folder. The Teletraan computer copies the pictures of one shared Drive folder. Good for a whole event: drop the pictures in the folder and they play.
- Both. The two lists play together.

The choice is saved as Photo source in Dashboard Settings. Click Publish all in the top bar after a change.

## Set it up once

1. Open the Google Cloud console (console.cloud.google.com) and sign in with the team's Google account. Ask the mentor which one.
2. Make a project. Click the project name at the top, then New project. Call it Teletraan photos and click Create. Make sure the new project is the one named at the top.
3. Turn on the Google Drive API. Open the menu, then APIs and services, then Library. Search for Google Drive API, open it and click Enable.
4. Make the API key. Open APIs and services, then Credentials. Click Create credentials, then API key. Copy the key. It starts with AIza. Do not paste it anywhere except step 6.
5. Restrict the key. On the key, click Edit API key. Under API restrictions choose Restrict key, tick Google Drive API only, and click Save. Leave Application restrictions on None, because the Teletraan computer has no fixed address.
6. Put the key on the Teletraan computer. Open the control page (http://teletraan.local:3229/control/), the Keys tab, the line Google key for the photo folder. Type the key (the typing is hidden) and save. The same line is in the Mac tool, Keys and calendars. The key lives in `local.env` on the Teletraan computer as `GOOGLE_API_KEY` and nowhere else.
7. Share the folder. In Google Drive, right click the folder, then Share. Under General access choose Anyone with the link, with the role Viewer. Click Copy link.
8. Tell Studio. Open Photos in the sidebar, pick Google Drive folder (or Both), paste the link under Folder link and click Save folder. Then click Publish all in the top bar.
9. Wait up to 15 minutes, or open the control page, the Status tab, and click Copy Drive photos now. The Photos page then says, for example, Last read 6 minutes ago, 34 photos.

The Teletraan computer needs the packages curl and jq. They are already there if the calendars and the slides work. The timer is installed by the update from the Mac tool, or once by hand: `sudo /opt/teletraan/computer/scripts/install-photos-drive.sh`.

## What the screen does with the folder

- Every 15 minutes `photos-drive-sync.sh` asks Sanity for Photo source and Folder link, and asks Google for the list of the pictures in the folder.
- It copies new and changed pictures to `photos/` in the data folder of the Teletraan computer, as they are. It skips a picture over 15 MB, keeps at most 200 (the newest), and removes a picture that left the folder.
- It writes `photos/manifest.json`, which the screen reads, and tells Studio when it looked and how many photos it has.
- Only JPEG, PNG, WebP and GIF pictures are used. Other files in the folder are ignored, and so are folders inside it.
- A file named `Firstname - caption.jpg` shows that first name as the credit and the caption on the photo. Any other name shows no text. The caption is cut to 36 characters and the first name to 14. Last names never go on the screen, so name files with care.
- The pictures play with the same rules as the others: one at a time, Fill the frame or Show the whole photo from Photo fit, Photo order, and the count and the seconds of the Photos row in the Rotation.
- If the manifest is missing or broken, or the Teletraan computer is offline, the Drive photos simply do not play and the others carry on. The panel is never taken down by the Drive side. With the source Google Drive folder alone and no pictures, the Photo panel is left out of the rotation until there are some.

The Photos page shows how many pictures were found, not their names. Studio cannot reach the Teletraan computer, and a file name can hold a last name.

## Privacy

- The folder link and the state of the last read are written to the Sanity dataset, which anyone can read. A folder shared with Anyone with the link can be opened by anyone who has the link, so put only pictures that may be seen by anyone in it.
- The key is never in the repository, never in Studio, never in a message and never in a command line. The script gives it to curl on standard input.

## If the Photos page says something is wrong

| The page says | What to do |
|---------------|------------|
| No folder is named yet | Paste the folder link and click Save folder, then Publish all. |
| The Teletraan computer has no Google key yet | Add `GOOGLE_API_KEY` on the control page, Keys tab (step 6). |
| Google did not accept the key | Paste the key again on the Keys tab. Check that it was copied whole. |
| The Google Drive API is not turned on | Do step 3 in the project the key belongs to. |
| Google would not open the folder | Share the folder with Anyone with the link as Viewer (step 7) and check the link on the Photos page. |
| The last read happened while the source was Upload photos | Click Publish all. The next read is within 15 minutes. |
| The Teletraan computer has not read the folder yet | Wait up to 15 minutes. If it stays, run the timer install (see above) and check `systemctl status teletraan-photos-drive.service`. |

To run it by hand on the Teletraan computer: `/opt/teletraan/computer/scripts/photos-drive-sync.sh`. It prints one line: how many photos, how many were downloaded, removed or skipped.

## Where things are

| Thing | File |
|-------|------|
| The copy script | `computer/scripts/photos-drive-sync.sh` |
| The timer and its installer | `computer/systemd/teletraan-photos-drive.*`, `computer/scripts/install-photos-drive.sh` |
| The status the Photos page shows | `status-write.sh photos-drive`, fields `photosDriveAt`, `photosDriveCount`, `photosDriveState` of the document `status-mini` |
| The Photos page | `studio/inputs/photos-view.js`, `studio/inputs/photos-parts.js` |
| The two settings | `photoSource` and `photoDriveFolder` in `studio/schemas/settingsPhotos.js` |
| The screen side | `dashboard/core/photos-drive.js`, joined in `rebuild()` in `dashboard/shell-content.js` |
| The tests | `tests/photos-drive.test.mjs`, `tests/photos-source.test.mjs`, `tests/photos-page.test.mjs` |
