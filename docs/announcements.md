# Announcements

An announcement is one line on a bar under the banner of the TV. Use it for a notice that
people must see today, such as a changed meeting time. It is live between a start and an end
that you pick, and it goes away by itself.

## Two kinds of announcement

The Teletraan has two things that are called announcements. They are not the same.

- **Announcements on the bar (this page).** A thin bar under the banner. The panels stay on
  the screen and get a little smaller while the bar is up. You make one in Studio on the Today
  page, under Announcements on the bar, from the Announcements block of the Content tab of the control page, or with the box on the Display tab.
- **Full screen messages at set times.** On the Today page too, under Full screen messages at set times. A full-screen card with a title and a follow-up line
  that plays at a time of day. The Play announcements button plays them. They cover the whole
  screen. See docs/hidden-transitions.md, "Play announcements".

The Play announcement button on the Display tab of the control page plays the full-screen kind at once. The box on the same tab posts the bar kind for two hours.

## Post one from the control page

Open the control page, Content, Announcements (`#content/announcements`). Post now takes the text (up to 90 characters, with a counter), the level, the team and 5 to 120 minutes, and publishes at once an announcement that starts this minute and ends by itself. Add announcement makes one with any start and end, as a draft until Publish. Each announcement shows Live now, Waiting or Over. There is no Hide switch on an announcement: delete it, or move its end to now. With two live, the wall alternates them every 12 seconds, and the page says so.

## Post one

1. Open **Today**. Under Announcements on the bar, type the text and click **New announcement**.
   It starts now and ends at the end of the day. Its card has the other fields.
2. The **Text** is up to 90 characters. About 45 fit at full size. A longer line is drawn
   smaller, and a long one is cut with three dots, so keep it short.
3. Change **Starts at** and **Ends at** if you need to. The times are in the time zone of the TV.
4. Leave **Team** blank for both teams, or pick one team. The bar shows only while that team is
   on the banner.
5. Pick the **Level**. Notice is the color of the team. Important is red.
6. Click **Publish all** in the top bar.

The list shows each announcement with its state: live, ends in some time, starts in some time,
or past. Delete a past one when you like. Nothing else needs cleaning up.

## What the TV does

- The bar is 80 pixels tall with a thin line above and below in the accent color of the team.
  The panels under the banner get smaller by the same height for 0.3 seconds and come back when
  the bar goes.
- With two announcements live at once, the bar shows one for 12 seconds and then the other.
- A presentation, an alert and the night screen cover the bar. It is not on the boot screen.
- The bar is live from the start up to the end, and it is gone at the end time.

## For the code

- `dashboard/core/notice.js`: which announcements are live, which one is up, and the size of
  the text. It has no page in it, and `tests/notice.test.mjs` tests it.
- `dashboard/core/notice-run.js` draws the bar and makes the room. `dashboard/notice.css` styles
  it. `frame.js` has the two moves (`moveArea`, `fadeNotice`).
- The content has `notices`, from the query in `dashboard/core/sanity.js`. The sample content has
  one, which shows only with `?sample=1&notice=1`.
- The Studio type is `announcement` (`studio/schemas/announcement.js`). Its template
  `newAnnouncement` is in `studio/tools/add-templates.js`.
