# Switch the look

For the students who edit the Studio. The look of the TV has four parts, and each is its own setting: the theme (the frames and the drawing), the view (what plays and in which arrangement), the team (the name, the number, the colors and whether the screen is flipped left to right) and the seasonal pack (a holiday overlay). The theme is the theme of the day, and the team is the team of the view that is playing (docs/views-and-themes.md). Do the four steps in order. Nothing here needs a change to the code.

## 1. Pick the theme of each day

In Studio open Look. The first section, Theme by day of the week, has a picker for each day, Monday to Sunday. The theme of a day goes on at the next change of view after midnight. The themes are:

- Original is the screen as it has always been.
- Cybertron has the same arrangement as Original: the banner, the large frame, the countdown over the small frame and the ticker. The frames are plates in the team's body color with the team's metal for the edge, a neon line inside the edge, bolts at the joints and a hazard stripe under each header. The countdown is the war clock in place of the red frame.
- Retro is a marked copy of Original until it is designed.

A theme draws every view. The arrangement belongs to the view, not to the theme: General has the standard arrangement, and Prime, Nova and Family have the bar arrangement, a banner across the top with the team name at one end and the war clock at the other, a thin side column, one main panel and the ticker across the bottom. The bar arrangement has no small frame, so the next event, task counts, safety days and sponsor logo show only in General. When the next view has another arrangement than the one on the TV, it changes in the same move as the swap: the frames pull apart and re-form in the new arrangement. The screen does not reload.

## 2. Pick the view and the team

Open Rotation. The rows are what the main panel plays, top to bottom, and each row names its view. The view is tied to a team: Robotics has none, Prime plays as Prime and Nova as Nova. Move a row to change the order. Views, under Teams and views, holds the arrangement and the small panels of each view.

- A view stays for its minutes (1 to 30), then the next view in the order that has something to show comes. A view with nothing to show is skipped.
- While a Monday row plays, the screen takes the Monday style of the Screen documents, which is the bar arrangement to start with, and goes back to the theme of the day when the Monday rows are over.
- The screen goes from one view to the next in one move: the frames pull apart, the new view goes on while they are apart, and they re-form, with the icon of the logo going to its new place. The move is the same for every change, so there is nothing to pick (docs/layouts.md, "The swap").

The team sets the name, the number, the logo, the colors, the mirror and the trim (the bolts, the cut corners and a few more small things, docs/add-the-nova-team.md). A team with Mirror the layout on has the whole screen flipped left to right: the columns, the banner and the tag on the ticker change sides. Everything changes together in one swap, so nothing changes in the middle of a panel.

Items that have a Team show only for that team. Items with Both, the countdown, the weather, the BAND events and the photos show for every team (docs/team-on-an-item.md). The teams are edited under Teams and views, in the sidebar (docs/add-the-nova-team.md).

## 3. Pick the seasonal pack

Open Look, then Seasonal decorations, then Dated rules, default theme and time zone. There are two ways to turn a pack on.

- Use a theme now, under Advanced in that form, with Seasonal pack picked, shows the pack at once. Set Until, so it ends by itself.
- A Schedule rule with the Kind Seasonal pack shows the pack on set dates. Pick the pack, a Start date and an End date. Turn on Repeats every year to use the same days every year.

A rule has three more fields that only a pack uses. Ticker prefix is a word before each ticker line, up to 12 characters. Banner line is one short line in the banner, up to 40 characters. Corner art is line art in the cut corners: leaves, snowflakes, gears, fireworks or None. Leave one empty and the pack's own is used, if it has one.

A pack lies over every theme and every team. Its accent colors, its header mark and its slow pieces drifting over the screen show with all of them. The decorations along the edges and the corner art draw only in Original with the standard arrangement, when the screen is not flipped.

A subtheme is a different thing: a dated layer of pictures on the frames (docs/subthemes.md). Halloween and Winter come with their packs, and a rule of a pack has a Subtheme field to change that.

## 4. Publish and look at the TV

Click Publish. A change of view, row or pack does not happen in front of people. It waits for the next page change of the large panel, which takes up to a minute.

To see a look first, open the menu next to Publish on Dashboard Settings (the three dots) and click Preview Prime, Preview Nova, Preview Cybertron, Preview Minimal (the bar arrangement) or Preview next pack. The TV shows that look for 2 minutes and then goes back to the saved settings. No setting is changed, so there is nothing to put back. The Now showing tab of the control page can also show a view or try a theme for a few minutes (docs/control-page.md).

On a computer, `?style=cybertron`, `?team=nova` and `?overlay=christmas` on the end of the address show a look for that one page, with the sample content, which has both teams (docs/try-it-on-the-computer.md lists every switch).

## Afterwards

- To go back to the screen as it was, pick Original for every day on the Look page, and turn the pack rule off, or pick No seasonal pack under Use a theme now.
- The team gives its main, accent, background and text colors to the color file Hawktimus. The other color files keep their own colors. The plate, neon and second bright colors of a team are read by Cybertron only.
- Every setting is explained in docs/editing-content.md, and the layouts and the frames are in docs/layouts.md.
