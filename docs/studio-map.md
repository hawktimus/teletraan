# Studio map

The sidebar of the Studio, from top to bottom, and what lives where. It goes by what you do. The page you are reading is for everyone. Students need only the first four groups.

Every change has three steps: open a line in the sidebar, make the change, click Publish all in the top bar. A change you have not published is a draft, and the TV never shows a draft.

## The sidebar

| Group | Line | What it is |
|-------|------|------------|
| (top) | Start here | What the screen is, a picture of its five areas, the status of the Teletraan computer and the links |
| SCREEN | Rotation | The list the wall plays, top to bottom. Drag a row, or use Up and Down. Turn Shown off to skip a row. Seconds is how long it stays |
| SCREEN | Views | Robotics, Prime and Nova: the arrangement, the team, the colors and the small panels of each |
| SCREEN | Themes and backgrounds | The theme of each weekday, and the background of the Original theme |
| SCREEN | Subthemes | Small pictures drawn over a theme between two dates |
| SCREEN | Announcements | A short notice in a bar under the banner |
| SCREEN | Extra panels | A panel you build from blocks |
| TASKS | Daily Agenda | Agenda items, Presentations (Upcoming and Past) and Meeting days |
| TASKS | Monday Tasks | Tasks from the Monday board. On the TV and Hidden. The one thing to change is Show on TV |
| TASKS | Monday Boards | The boards the Teletraan computer can see, and the milestones |
| TASKS | Tips and News | The lines that run along the bottom of the screen |
| EVENTS | Calendars | What each BAND calendar brings in, and whether the TV shows each event |
| EVENTS | Calendar filters | Rules that hide events or keep them on the screen |
| PEOPLE | Leadership | Coaches, captains and mentors |
| PEOPLE | Team leads | Each subteam, its lead and its students |
| PEOPLE | Sponsors | Name, tier, a short line and the logo address |
| PEOPLE | Photos | The pictures for the Photo panel |
| COACHES ONLY | Dashboard Settings | The settings of the whole screen, in eight tabs |
| COACHES ONLY | Teams | Hawktimus Prime and Hawktimus Nova: name, number, logo, colors and trim |
| COACHES ONLY | Look | Color themes, seasonal packs and the time zone |
| COACHES ONLY | Old screens (not used) | Original, Cybertron, Minimal and Family. The wall does not play them. They are kept so nothing is lost |

## Where do I change

| I want to | Open |
|-----------|------|
| Change what plays, in what order, for how long | Rotation |
| Skip a panel for now | Rotation, turn Shown off |
| Pick the theme for a weekday | Themes and backgrounds |
| Change the background of Original | Themes and backgrounds |
| Add today's schedule | Daily Agenda, Agenda items |
| Hide a task from the TV | Monday Tasks |
| Hide a repeating meeting | Calendars, or Calendar filters |
| Add a notice for today | Announcements |
| Add a tip or news line | Tips and News |
| Add a leader, a lead or a sponsor | Leadership, Team leads, Sponsors |
| Add a photo | Photos |
| Change the team name, number or colors | Teams |
| Put the standard colors back on a team | Teams, open the team, the menu beside Publish, Use the standard colors for this team |
| Change the countdown dates | Dashboard Settings, Countdown tab |
| Change the logo and the page change | Dashboard Settings, Logo and motion tab |

## Things to know

- Each Team document keeps its own colors. A new default in the code never reaches a team already saved. To reset one, open it and choose Use the standard colors for this team from the menu beside Publish. It changes the draft only. Nothing reaches the TV until you click Publish.
- The Rotation list is one list for the whole wall. Its full form is also a field in Dashboard Settings, Advanced tab. Use the Rotation page.
- A page in the sidebar that is not a document (Start here, Rotation, Themes and backgrounds, Calendars, Monday Boards) saves what you change as a draft of Dashboard Settings. Click Publish all to put it on the screen.
- Anything under Coaches only is for a coach.
- Events are not typed in the Studio. They come from the BAND calendars.

## Where it is in the code

`studio/structure.js` holds the sidebar as one list. To move a line, move it in that list (docs/reordering-the-sidebar.md). The pages that are not documents are in `studio/inputs/`. `tests/schemas.test.mjs` checks the sidebar, so a change to it changes that test.
