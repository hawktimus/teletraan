# Presentations

For the coaches who run the talks. A student books a short talk in a Google
Form. A script saves the booking into Sanity, the talk appears in Studio, and at
its time the TV shows the student's slides. The script is
`tools/presentation-booking/presentation-booking.gs`. The talks of the day also
show in the Up Next panel (docs/up-next.md).

Talk titles and first names are public. The Sanity dataset can be read by anyone
(studio/README.md), so anything a student types as a title or a name can be read
by anyone. Tell students to use a first name only and a title they are happy for
anyone to read.

## 1. Which Google account owns the Form

The Form, the sheet behind it and the booking script all belong to one Google
account. Use a team or coach account: [Google account, added when it is chosen].
Do not use a student's school account. A school account is closed when the
student leaves, and the booking stops with it.

## 2. Add a Meeting day

Add one for each meeting that has talks.

1. In Studio open Presentations, then Meeting days, and click the plus button.
2. Fill in First talk starts, Last talk starts, Length of each talk and Booking
   closes this long before a slot. The last talk is a slot too, and the talks
   start one length apart from the first to the last. A first talk at 2:45 PM,
   a last talk at 4:15 PM and 15 minutes for each talk make 7 talks.
3. Click Publish.

The Form lists the free slots within 5 minutes. A day with no Meeting day has no
slots. Turn off Open for booking to close a day without deleting it.

Leave a gap after the announcement. If it plays at 2:30 PM, start the first talk
at 2:45 PM, so the first title card does not wait behind it. The times of the
announcements are in the Announcements tab of Dashboard Settings.

## 3. The Sanity token

A token is a long secret text that lets a program use a Sanity project. The
booking script runs on Google's servers, not in Studio. Anyone can read the
dataset, but saving a booking needs permission, and the token is that
permission.

1. Go to sanity.io/manage and open the Teletraan project.
2. Choose API, then Tokens, then Add API token.
3. Name it, such as Presentation booking, give it Editor access and save. Sanity
   shows the token once, so copy it before you leave the page.

Put the token in one place only: in the Apps Script project, under Project
Settings, then Script Properties, as `sanityToken`. The project is made in step
4, so paste it there. Never put it in the repository, the Form, the script or
Studio, and do not send it in a message. An Editor token can change anything in
the project, so treat it like a password.

If the token leaks, delete it in Sanity (API, Tokens), create a new one and
replace the value of `sanityToken`.

## 4. Set up the script

1. Sign in to the account from step 1, go to script.google.com and click New
   project.
2. Delete the code in the editor and paste in the whole of
   `tools/presentation-booking/presentation-booking.gs`.
3. Add the token as in step 3.
4. Pick `setup` in the function list at the top and click Run. Google asks for
   permission. Approve it. Google may warn that the app is not verified, because
   the script is the team's own: choose Advanced and carry on.
5. Open the Execution log. It prints the link to the Form. Send that link to the
   students.

## 5. Cancel or move a talk

Talks are in Studio under Presentations, then Upcoming talks.

1. Open the talk.
2. To cancel it, set Status to Cancelled. To move it, change Starts at to a time
   no one else has booked.
3. Click Publish, or use Publish all in the top bar (docs/publish-all.md). The
   TV and the script only see published talks.

The sheet follows within 5 minutes and the slot reopens. Only a talk with the
status Scheduled runs on the TV.

## 6. On the day

At the start time of a talk the TV shows a title card with the subteam, the first
name and the title, and the words "Press the clicker to begin". If the
announcement is playing, the card waits until it ends. If the talk before is still
going, it is ended when its slot and the overrun are used up, and then the next
card comes up.

The first forward key starts the talk. The slides fill the screen, with a gold
line along the bottom that shows how far through the deck the talk is. For 3
seconds after each key, a small box at the bottom right shows the first name and
the slide number, such as 7 / 24. Most clickers send Page Down and Page Up. These
keys work:

- Next slide, and start the talk: Page Down, Right arrow, Down arrow, Space,
  Enter, N or F5.
- Slide before: Page Up, Left arrow, Up arrow or P.
- Black screen, on and off: B or the full stop.
- First slide: Home. Last slide: End.
- End the talk: Esc twice within 2 seconds. One Esc does nothing.

One more forward key on the last slide shows the Thank you card for 5 seconds, and
then the TV goes back to what it was doing. A talk also ends by itself when its
slot and the overrun are used up, on whatever slide it is.

While a talk is on, the TV holds everything else: the pages, the effects, night
mode and the announcements. What came due during the talk happens after it.

If nobody presses a key while the title card is up, the talk is skipped and the TV
goes back. A skipped talk does not come back by itself. To run it again, change
Starts at on the talk to a time that is now or a few minutes ahead and publish.

The three settings are in the Presentations tab of Dashboard Settings:

- Run presentations: on to start with. Off, the TV never takes over for a talk, and
  a talk that is on the screen ends at once. The talks stay in Studio.
- Wait for the speaker (minutes): how long the title card waits for the first key.
  From 1 to 15, and 5 to start with.
- Overrun allowed (minutes): how long a talk may run past its slot before it is
  ended. From 0 to 10, and 5 to start with.

## 7. Try it before the day

1. In Dashboard Settings open the menu next to Publish (the three dots) and click
   Run presentation test. The TV starts a sample talk with six sample slides, and
   you press the clicker as at a real talk. It needs no internet and no booked
   talk (docs/hidden-transitions.md, "Run presentation test").
2. To try a real deck, share it with Anyone with the link, then run
   `slides-sync.sh --test` on the Mini with the deck's link. It prints OK and the
   number of pages, or FAIL and the reason (docs/rebuilding-the-mini.md, step 11).

## 8. Troubleshooting

- The TV says "Slides are not ready. Ask a coach." The Mini downloads each deck
  once the talk is less than 36 hours away, and again when the talk is 20
  minutes away, so a late edit is included. A failed download is tried again
  2 minutes later. The usual cause is a deck that is not shared, see the next
  point. If it is shared and the slides are still not ready after 10 minutes,
  tell the team mentor: the Mini may be off the internet or its slides service
  may not be running (docs/rebuilding-the-mini.md).
- The deck is not shared. Open the deck in Google Slides and click Share. Under
  General access pick Anyone with the link, and set it to Viewer. If that choice
  is not offered, the account blocks it: ask the team mentor. The Slides link
  in Studio must also start with `https://docs.google.com/presentation/d/`.
- The Form has no free slots. Check that the Meeting day exists and is
  published, not a draft, that Open for booking is on, and that its date is the
  right one. A slot closes for booking the number of minutes before it that the
  Meeting day says. If every slot is taken, move Last talk starts later. After
  any change, wait 5 minutes for the Form.
