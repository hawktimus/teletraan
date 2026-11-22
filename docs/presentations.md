# Presentations

For the coaches and the students who run a meeting. A deck is played on the TV
from the Google Drive folder of presentations: it is picked on the TV or on the
control page, and the clicker or the mouse moves the slides. The folder, the list
and how to set them up are in docs/presentations-drive.md.

Talks are not booked in the Studio any more. There is no Google Form, no booking
script, no Presentations or Meeting days list, and the screen does not read talks
from Sanity. The old Presentation and Meeting day documents stay in the dataset
and are ignored.

Deck names show on the TV, so name a file the way you want it read. A deck is not
stored in Sanity: its pictures are made and kept on the Teletraan computer.

## On the day

1. Pick the deck: press the play button of the clicker (or F5 or P on a keyboard)
   to open the list on the TV, or press Play on the TV on the control page,
   Show, Presentations.
2. The deck fills the screen on its first slide. While the pictures are not ready
   yet, a title card says so and waits.
3. Move with the clicker or the mouse. Most clickers send Page Down and Page Up.
   These keys work:

- Next slide: Page Down, Right arrow, Down arrow, Space, Enter, N or F5.
- Slide before: Page Up, Left arrow, Up arrow or P.
- Black screen, on and off: B or the full stop.
- First slide: Home. Last slide: End.
- End the deck: Esc. After the last slide the deck ends by itself and the
  dashboard comes back.

The mouse works too, for a speaker with no clicker. A left click, or a tap on a
touch screen, does what Page Down does. A right click does what Page Up does. The
middle button does nothing. A double click moves one slide, not two, because a
second left click within half a second of the one before is left out. While a
deck is on the screen the right click does not open the browser menu, and the
mouse pointer stays hidden.

While a deck is on, the TV holds everything else: the pages, the effects, night
mode and the announcements. What came due during the deck happens after it.

## The setting

The one setting is in the Presentations section of Dashboard Settings (Advanced
tab):

- Run presentations: on to start with. Off, the TV starts no deck, and a deck
  that is on the screen ends at once.

Two numbers are fixed in the code and are not settings: the title card waits 5
minutes for the first key, and a talk with a slot may run 5 minutes past it
(`noShowMinutes` and `graceMinutes` in `dashboard/core/constants.js`). A picked
deck has no slot, so only the speaker ends it, or 4 hours. Dashboard Settings
still has the two fields (Wait for the speaker and Overrun allowed), hidden, so a
page saved before they were hidden opens and publishes as it did. The screen does
not read what they hold.

## If it does not work

The list on the TV and the Presentations section of the control page say what is
wrong in one line. The table of messages is in docs/presentations-drive.md.

- The TV says "Slides are not ready. Ask a coach." The deck has not been turned
  into pictures yet, or it is not shared. Any click on the card ends it and the TV
  starts its pages again from the first one. Wait a minute and pick the deck
  again. If it is still not ready after 10 minutes, tell the team mentor: the
  Teletraan computer may be off the internet or the decks service may not be
  running.
- The deck is not shared. Share the folder, or the file, with Anyone with the
  link, as Viewer. If that choice is not offered, the account blocks it: ask the
  team mentor.
