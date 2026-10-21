# Studio map

The sidebar of the Studio, from top to bottom, and what lives where. It goes by what is on the screen: one line for each thing the audience sees. The page you are reading is for everyone. Students need only the lines above Coaches only.

Every change has three steps: open a line in the sidebar, make the change, click Publish all in the top bar. A change you have not published is a draft, and the TV never shows a draft.

## The sidebar

| Line | What it is |
|------|------------|
| Start here | What the screen is, a picture of its five areas, the status of the Teletraan computer and the links |
| Rotation | The board the wall plays, top to bottom, like a Monday board. Each row is a view, a panel, a small panel, the time shown and a Show on screen switch. Settings for the small panel or the photos appear for the row that needs them (written by the Rotation board lane) |
| Today | Everything that puts a message on the TV today: the alert, the announcements on the bar under the banner, and the full screen messages at set times. Links to Agenda items, Presentations and Meeting days |
| Ticker | The tips, news and reminders that run along the bottom of the screen |
| Events | Calendars, which shows what each BAND calendar brings in and lets you show or hide each coming event, and Calendar filters, which are rules that hide events or keep them |
| People | Leadership, Roster, Team leads and Sponsors. Roster is the list of everyone on the team by first name, with a role and a team (docs/roster.md) |
| Photos | The pictures for the Photo panel: upload a series, or take them from a Google Drive folder |
| Monday | What the computer read from Robotics Tasks and Completed Tasks, read only. The last read and whether it worked, a Team picker (Both, Prime, Nova), and for each of the nine departments the To Do and In Progress tasks and the Done tasks with Status, Project, Contact, Priority and Estimated Completion Date and their counts. An empty department is greyed. What the TV shows draws the first page of a Department tasks row. A department goes on the TV with a Department tasks row on the Rotation board (docs/monday.md) |
| Teams and views | Hawktimus Prime and Hawktimus Nova on a plain form, and the Views folder: Robotics, Prime and Nova |
| Look | The theme of each weekday, the background, the seasonal decorations, motion, frame polish, and the logo and name effects, on one page |
| Competition | The competition cards: the mode (Before and after, Auto, Always or Off), and one switch for each of the twelve cards. Below them the FRC news section: the headlines from the FIRST blog with a Show switch each, the news switches and the categories |
| Coaches only | A heading. Under it: Dashboard Settings, Extra panels, Check the screen and Kept data |

Under Coaches only:

| Line | What it is |
|------|------------|
| Dashboard Settings | The settings that are set once, in five tabs: Timing, Countdown, Monday, Calendars and Advanced. Presentations, Night mode, Scheduled reboot and Hidden transitions are sections of Advanced. Scheduled reboot has the next and last reboot at the top, then the switch, the time, the days and the skip rule; the control page, Settings, shows the same values |
| Extra panels | A panel you build from blocks |
| Check the screen | A read only report of what would make the TV look bad or show nothing: text too long for its panel, private details in text, photos that are small or tall, missing credits, portraits or logos, items past their dates, Rotation rows that will be skipped, two panels on one topic, and team colors that are hard to read. Drafts are checked too. Each finding has a level, a plain fix and a link to the document |
| Kept data | The old Screens, the Condensed view and the old events calendar type. The wall does not use them. Do not delete them: some old values are read when a new list is empty |

## Where do I change

| I want to | Open |
|-----------|------|
| Change what plays, in what order, for how long | Rotation |
| Skip a panel for now | Rotation, turn Show on screen off |
| Put up an alert | Today, Alert |
| Add a notice for today | Today, Announcements on the bar |
| Play a card at a time of day, such as WHAT TIME IS IT? | Today, Full screen messages at set times |
| Add today's schedule | Today, Agenda items |
| Add or look at a talk | Today, Presentations |
| Add a tip or news line | Ticker |
| Hide a repeating meeting | Events, Calendars, or Calendar filters |
| Add a leader, a lead or a sponsor | People |
| Add a photo | Photos |
| Hide a task from the TV | In Monday: set Show on TV? to Hide |
| Put a department's tasks on the TV | Rotation: add a row of Monday: Department tasks and pick the Department, List and Team in Details |
| Change the team name, number, logo or metal | Teams and views, then the team |
| Put the standard colors back on a team | Teams and views, open the team, open Colors, click Use the standard colors for this team |
| Change the arrangement of a view | Teams and views, Views |
| Pick the theme for a weekday | Look, Theme by day of the week |
| Change the background of Original | Look, Background |
| Switch the holiday decorations on a date | Look, Seasonal decorations, Dated rules |
| Calm the screen, or make it lighter for the TV computer | Look, Motion (Full, Light or Calm, and Motion on the TV computer) |
| Change the logo and the name effect | Look, Logo and name effects |
| Choose which competition cards show | Competition |
| Hide an FRC news headline, or choose the news categories | Competition, FRC news |
| Change the countdown dates | Dashboard Settings, Countdown tab |
| Change how long a page stays | Dashboard Settings, Timing tab |
| See what is wrong before a meeting | Coaches only, Check the screen |
| Find an old Screen | Coaches only, Kept data |

## Things to know

- Each Team document keeps its own colors. A new default in the code never reaches a team already saved. To reset one, open the team, open Colors and click Use the standard colors for this team. The button shows what it would change and writes to the draft only. Nothing reaches the TV until you click Publish.
- A page in the sidebar that is not a document (Start here, Rotation, Today, Look, Competition, Calendars) saves what you change as a draft of the document it shows. Click Publish all to put it on the screen. The Monday page writes nothing.
- Dashboard Settings still holds every setting it ever had. The ones the pages took over (the alert, the messages, the look, the competition cards and the team fallback) are hidden there, with their stored values. The ones the old Screens left behind say Not used any more.
- Anything under Coaches only is for a coach.
- The control page, Settings, All settings shows the same settings as the Studio forms, drawn from the Studio schemas. Both write the same stored fields to the draft. See docs/control-page.md.
- Events are not typed in the Studio. They come from the BAND calendars.

## How choices look

On the pages that are not documents, a list of choices is a row of buttons, and the chosen one is filled blue with a check mark while the others are outlined. A switch is a pill with a knob and the word On or Off, blue when it is on. Both are real radios and checkboxes underneath, so Tab, the arrow keys and a screen reader work. The colors are fixed, not the Studio's, so they show on its dark and light themes. `controlStyle`, `choiceButtons` and `toggleSwitch` in `studio/inputs/field-editor.js` draw them, so a new page uses those and draws no radio or checkbox of its own.

## Where it is in the code

`studio/structure.js` holds the sidebar as one list. To move a line, move it in that list (docs/reordering-the-sidebar.md). The pages that are not documents are in `studio/inputs/`: `today-view.js`, `look-view.js`, `competition-view.js`, `kept-data-view.js`, and the others named in the table above. The rows they share are `field-editor.js`. `tests/schemas.test.mjs` checks the sidebar, so a change to it changes that test.
