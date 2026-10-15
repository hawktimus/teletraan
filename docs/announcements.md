# Announcements

An announcement is one line on a bar under the banner of the TV. Use it for a notice that
people must see today, such as a changed meeting time. It is live between a start and an end
that you pick, and it goes away by itself.

## Two kinds of announcement

The Teletraan has two things that are called announcements. They are not the same.

- **Announcements in the sidebar (this page).** A thin bar under the banner. The panels stay on
  the screen and get a little smaller while the bar is up. You make one in Studio under TASKS,
  Announcements, or with Post an announcement on Start here.
- **Announcements in Dashboard Settings.** A full-screen card with a title and a follow-up line
  that plays at a time of day. The Play announcements button plays them. They cover the whole
  screen. See docs/hidden-transitions.md, "Play announcements".

## Post one

1. On Start here click **Post an announcement**. A new announcement opens that starts now and
   ends in two hours. You can also open TASKS, Announcements and click the plus button.
2. Write the **Text**. Up to 90 characters. About 45 fit at full size. A longer line is drawn
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
  the text. It has no page in it, and `tools/test-notice.mjs` tests it.
- `dashboard/core/notice-run.js` draws the bar and makes the room. `dashboard/notice.css` styles
  it. `frame.js` has the two moves (`moveArea`, `fadeNotice`).
- The content has `notices`, from the query in `dashboard/core/sanity.js`. The sample content has
  one, which shows only with `?sample=1&notice=1`.
- The Studio type is `announcement` (`studio/schemas/announcement.js`). Its template
  `newAnnouncement` is in `studio/add-templates.js`.
