# Dashboard content map

One line: the Studio has 102 settings on one page, 34 of them already hidden, and about 30 content lists, while a coach changes only about 3 settings a week; this page lists what the TV shows, where each thing is changed today, and a smaller Studio built around what appears on the screen.

This is a plan to read and answer. No Studio or dashboard code was changed to write it.

Contents: 1 what the TV shows, 2 where each thing comes from, 3 the settings counted, 4 a simpler Studio, 5 questions.

How the counts were made: the settings were counted from the schema files in `studio/schemas/`. The documents in use were counted on the public dataset (project ybfqe345, dataset production) with read-only queries and no token, on 2026-10-16. Published documents only; a draft is not counted. Statements marked "judgement" are the opinion of the writer from the docs and the code, not a measurement.

## 1. What the TV shows

Who: S is students, L is leads, C is coaches. The Studio page is the sidebar line today (docs/studio-map.md). "Settings that change it" lists where its look or timing is set today.

### 1.1 Always on the screen

| What the audience sees | Who | Where it comes from | Studio page today | Settings that change it |
|---|---|---|---|---|
| Team name, number, school in the banner | C | Team document, with a fallback in Dashboard Settings | Teams; Dashboard Settings, Screen tab, Team | Team: name, number, logo, colors, metal, glow, mirror, outlined name, bolts, cut corners, header end, page grid, ticker label, countdown color |
| Logo and the hawk that flies now and then | C | Team document logo; the code | Teams; Dashboard Settings, Logo and motion tab | Logo animation switches and timings (14 fields), Banner title for Robotics |
| Clock, date, weather | nobody | The computer clock; a free weather service that needs no key | none | Time zone on the Look page. No other setting |
| Countdown (Kickoff, then Rollout) | C | Settings only | Dashboard Settings, Countdown tab | Labels and dates. Where it sits (View, Countdown) |
| Ticker: tips, news, reminders, sponsor thanks | S, L | Tips and News list typed by hand; sponsor thank-you lines | Tips and News; Sponsors | Seconds per ticker line (Screen tab); Ticker label (Team); per item Team, Order, Show, Hide after |
| Three small dots (Monday, BAND, Sanity) | nobody | The computer | none | none |
| Build number on the wall | nobody | The computer | Control page | none |

### 1.2 The big panel (the Rotation plays these)

| What the audience sees | Who | Where it comes from | Studio page today | Settings that change it |
|---|---|---|---|---|
| Daily Agenda (the plan, headed AGENDA) | S, L | Agenda items typed by hand | Daily Agenda, Agenda items | Rotation row (seconds, shown); per item Team, Show, Hide after |
| Upcoming events, two pages of four | L | BAND calendars, read by the computer | Calendars; Calendar filters | Calendars tab (name, kind, show); Group events by kind; filters; Rotation row part 1 and 2 |
| Leadership | L, C | People typed by hand | Leadership | Portrait size, shape and frame (Screen tab); per person Team, Order, Show, Hide after |
| Team leads, subteam spotlight, roster | L | Team leads typed by hand; roster from the Monday board | Team leads | Portrait size; On the Monday board switch per lead; Rotation row |
| Sponsor feature | L | Sponsors typed by hand | Sponsors | Rotation row; per item switches |
| Photos | S, L | Photos uploaded | Photos | Photo fit and Photo order (Screen tab); photo count and seconds on the Rotation row; per photo fit, Show, Hide after |
| Department tasks and the TV charts | S (on Monday) | Robotics Tasks and Completed Tasks, read by the computer | Monday (read only) | Monday tab (how often); Rotation row department, list, chart and team |
| Competition cards (ten) and the Season timeline | L | The public FRC feed, read by the computer | none (Preview competition button on Start here) | Competition tab: mode and one switch per card |
| Extra panels | L | Built from blocks by hand | Extra panels | Rotation row |
| Robot status, 3D view, Drive hours, Parts request QR code, Mini panel idea | C | Placeholders, Monday hours, a typed web address | none | Parts request address (Screen tab); Rotation row |

### 1.3 The small panel (Panel B)

| What the audience sees | Who | Where it comes from | Studio page today | Settings that change it |
|---|---|---|---|---|
| Next event | nobody | BAND calendars | Calendars | Side column of the View, or the Rotation row "Small panel beside it" |
| Task counts | nobody | Monday boards | none | Same |
| Safety days | C | Settings only | Dashboard Settings, Screen tab | Safety days start date |
| Weather forecast | nobody | Free weather service | none | Same |
| Sponsor logo | L | Sponsors | Sponsors | Same |
| Team tile (last resort) | nobody | Team document | Teams | none |

### 1.4 Things that cover the screen

| What the audience sees | Who | Where it comes from | Studio page today | Settings that change it |
|---|---|---|---|---|
| Announcement plate under the banner (90 characters) | S, L | Announcements list | Announcements | Start, end, team, level |
| Full screen announcement at a time of day | C | Settings only | Dashboard Settings, Screen tab, Announcements | Time, two lines, seconds, days. This is a second kind of announcement |
| Alert (covers everything) | C | Settings only | Dashboard Settings, Screen tab, Alert | On, headline, message, take down at |
| A booked talk (title card, slides, thank you) | S | Google Form to Sanity; slides turned to pictures by the computer | Daily Agenda, Presentations; Meeting days | Run presentations (Presentations tab) |
| Night screen | nobody | A fixed time (23:30 to 11:30) | Dashboard Settings, Advanced tab | Night mode switch, style, logo width, speed, preview |
| Hidden transitions (desktop reveal, red eyes) | C | The code | Dashboard Settings, Advanced tab | Allow, hours between, a Play button |

### 1.5 Views, look and decoration

| What the audience sees | Who | Where it comes from | Studio page today | Settings that change it |
|---|---|---|---|---|
| Robotics, Prime, Nova (and Condensed, the old Family view, which is not played) | C | View documents | Views (Robotics, Prime, Nova); Old screens (Family) | View: team, arrangement, mirror, colors, countdown place, small panels |
| Which panel plays, in which view, how long | L, C | Rotation list | Rotation | View, panel, seconds, shown, small panel beside it, part, department, photo count |
| Color theme of each weekday, and the background of Original | C | Settings | Themes and backgrounds | Theme per weekday; Look page: default theme, use now, schedule, time zone |
| Seasonal packs (holiday colors, corner art, drifting pieces) | C | The Look page schedule | Look | Schedule rules; Seasonal pieces over the panels |
| Subthemes (dated pictures at six places) | C | Subtheme documents | Subthemes | Dates, priority, preset, pictures, rules |
| Page change and view change animations | C | The code | Dashboard Settings, Logo and motion tab | Page change style, break time, frame finish, silver chance, transition length |
| Calm or full motion, speed, frame metal, glint, polish, screen glitch | C | Settings | Dashboard Settings, Screen tab | Motion, Speed, Frame metal, Glint, Polish, Screen glitch |

### 1.6 Documents in use (public dataset, published only)

| Type | Count | Reading |
|---|---|---|
| Monday tasks | 69 | In use (written by the computer) |
| Tips and News | 26 | In use |
| Team leads (subteams) | 14 | In use |
| Photos | 8 | In use |
| Events Calendar (extraEvent) | 8 | Not read by the screen; kept for old data |
| Leadership | 4 | In use |
| Places | 4 | Kept for old data; no sidebar line |
| Teams | 2 | In use (Prime and Nova) |
| Views | 2 of 4 | Two saved; the others play from the code defaults |
| Agenda items | 1 | Thin use |
| Calendar filters | 1 | In use |
| Sponsors | 1 | Thin use |
| Dashboard Settings, Look (theme) | 1 each | In use |
| Old Screens | 1 of 3 | Not played |
| Status documents (Mini, calendar, FRC, Monday) | 1 each | Written by the computer |
| Announcements, Presentations, Meeting days, Extra panels, Subthemes, Milestones, Demo | 0 | Empty today |

What this says: seven editor lists are empty (announcements, presentations, meeting days, extra panels, subthemes, milestones, demo). Two are almost empty (agenda, sponsors). The weekly content that is truly in use is Tips and News, Photos, Team leads, Leadership and the Monday Show on TV switch.

## 2. The settings, counted

Dashboard Settings is one document with 102 fields in eight tabs. 34 are hidden and marked "Not used any more" or filled in by a button. 68 can be seen.

| Tab | All | Hidden | Visible |
|---|---|---|---|
| Screen | 32 | 11 | 21 |
| Logo and motion | 31 | 14 | 17 |
| Countdown | 1 | 0 | 1 |
| Calendars | 2 | 0 | 2 |
| Presentations | 4 | 3 | 1 |
| Monday | 7 | 1 | 6 |
| Competition | 9 | 0 | 9 |
| Advanced | 16 | 5 | 11 |
| Total | 102 | 34 | 68 |

How often an editor needs the 68 visible ones (judgement):

| How often | Count | Which |
|---|---|---|
| Weekly | 3 | Alert on or off, Safety days start, the Rotation list (which has its own page) |
| Once a season | 33 | Team fallback, motion, speed, metal, glint, polish, seconds per page, ticker seconds, finished task days, photo order and fit, four portrait settings, full screen announcements, countdown, banner title, calendars and kinds, Group events by kind, Monday boards and how often, owner names, competition mode and its 8 card switches, Parts request address |
| Set once and never touched | 32 | 14 logo and page change timings, screen glitch (3 values in one), night mode (5), hidden transitions (4), Run presentations, connection text, 6 read-only status and note lines |

Other counts: the Team document has 21 fields (3 hidden); the View document has 15 (6 hidden); the Look page has 6; a Screen document has 9.

### Settings that do the same job twice

| The job | Where it is set | Why it is a pair |
|---|---|---|
| What plays and in what order | Rotation page; Rotation (full form) field in Advanced; rows inside each View; Panel order and Large and Small panels in the ticker block | Four places for one list. Only the Rotation page is read first |
| Seconds a panel stays | Seconds per page; seconds on the Rotation row; Seconds per photo; photo count and seconds on the row; minutes of a View (hidden); Transition length | Six answers to "how long" |
| Theme of the day | Theme of each weekday (Themes page); Default theme, Use now and Schedule (Look page); Preview theme (control page) | Three schedules of color |
| The team name and number | Team section of Dashboard Settings; Team documents; the team on each View | The first is only a fallback, but it is still shown |
| Colors | Team colors; View colors; theme file; seasonal pack accents | A color can come from four places |
| A message on the screen | Alert; Announcements list; full screen announcements in settings; the ticker | Four ways to say a thing |
| Small panels | Side panel rows of each View; Small panel beside it on a Rotation row; Panel order | Two live ways, one old |
| Logo and name effect timing | Logo animation fields in settings; minutes in the Screen documents | One is hidden and read from the old Screens |

### Settings kept only for the old Screens runtime

These 16 hidden fields exist so that stored values are not lost. Nothing on the wall reads them for what it plays now: Weekday schedule, Styles by day, Monday style, Team order, How the look changes, Style, Team mode, Minutes for each team, Order of the views, Name of the Robotics view, Flying hawk every, Name effect every, Seconds per photo, Photo size, Portrait size (old), and Panel order with Large and Small panels. The Screens (Original, Cybertron, Minimal, Family) and 4 more hidden fields on the View document (Show the view tag, Show the team chip, Minutes on the screen, Main panel rows) belong to the same past. Hidden, they cost editors nothing; as lines in the sidebar (Old screens) they still cost a click and a question.

## 3. The five biggest sources of confusion

1. Three pages answer "how does it look": Dashboard Settings (Logo and motion tab and Screen tab), the Look page, and Themes and backgrounds. A coach cannot tell which one holds a color, a theme or a schedule.
2. Four ways to put a message on the TV (Alert, Announcements, full screen announcements in settings, the ticker), with two of them named Announcements.
3. The same fact in more than one place: team name and number (settings, Team, View), the Rotation list (page, field, Views), seconds (six places).
4. One settings page holds everything from the weekly Alert switch to the once-ever spin timing of the logo. 102 fields, 8 tabs, and a tab called Logo and motion that also holds the banner title and the page change.
5. Things in the sidebar the wall does not use: Old screens (4 pages), the Family view, Extra panels, Subthemes, Presentations and Meeting days (all empty), with no mark of which matter.

## 4. A simpler Studio

Rule: one line in the sidebar for each thing the audience sees, and each setting sits on the thing it changes. Nothing is deleted. A hidden setting keeps its stored value.

### 4.1 The sidebar as it would read

| Line | Holds today's |
|---|---|
| Start here | Status of the computer, the buttons, the picture of the five areas |
| Today | Announcements, Alert (as one page with a switch), Daily Agenda, Presentations, Meeting days |
| Ticker | Tips and News, sponsor thank-you lines (read from Sponsors) |
| Events | Calendars, Calendar filters, Group events by kind |
| People | Leadership, Team leads, Photos, Sponsors |
| Monday | Show on TV list, Boards, how often, owner names, days finished tasks stay |
| Playlist | Rotation, with seconds, small panel, photo count and department on the row |
| Teams and views | Team documents (name, number, logo, colors, trim) and View documents (team, arrangement, mirror) |
| Look | Themes and backgrounds, Look page schedule and packs, Subthemes, motion and polish |
| Competition | The eight switches and the mode |
| Coaches only | Settings (short), Extra panels, Old screens |

Eleven lines. Start here, Today and Playlist are the three a student or lead opens in a normal week.

### 4.2 Which settings stay, move, or go out of view

| Setting | Decision | New home |
|---|---|---|
| Alert (on, words, take down at) | Move | Today, with a one-click Alert on button |
| Full screen announcements by time of day | Move | Today, as a second list under Announcements, or fold into the plate (see question 3) |
| Safety days start | Move | The Safety days row of the Playlist |
| Seconds per page, Seconds per photo, photo count | Move | The Playlist row (seconds, photo count); Seconds per page stays as the default in Settings |
| Seconds per ticker line | Move | Ticker |
| Parts request address | Move | The Parts request row of the Playlist |
| Countdown labels and dates | Move | Start here, beside the countdown picture, or a Countdown line under Today |
| Team name, number, school (settings) | Hide | Team documents already hold them |
| Banner title for Robotics | Move | The Robotics view document |
| Portrait size, shape and frame (4) | Move | The Leadership and Team leads lists, as one "Layout" item at the top |
| Photo fit and Photo order | Move | Photos list top |
| Calendars list and Group events by kind | Move | Events |
| Monday boards, columns, how often, owner names | Move | Monday (coach only) |
| Competition mode and 8 switches | Move | Competition |
| Motion, Speed, Frame metal, Glint, Polish | Keep, one short page | Look |
| Screen glitch, logo animation timings (14), page change style, break time, frame finish, silver chance, transition length | One-line Advanced item, collapsed | Look, "Animation" group |
| Night mode (5) | One-line Advanced item | Settings |
| Hidden transitions (4) | One-line Advanced item | Settings |
| Run presentations, Show connection status | Keep, in Settings | Settings |
| Rotation (full form), Panel order, Large and Small panels | Hide | Playlist is the only door |
| The 16 fields tied to the old Screens | Hide, already so | none |
| Old screens folder and the Family view | Hide from the sidebar, keep documents | Reachable by a link in Settings, "Kept data" |
| Subthemes, Events Calendar, Places, Demo | Keep out of the sidebar when empty | Look keeps Subthemes (it is a look item) |

What remains on a short Settings page: the three set-once groups (Advanced animation, Night, Hidden transitions), Run presentations, Show connection status, and read-only status. About 25 fields, none weekly.

### 4.3 Weekly jobs that become one click

| Job | Today | Proposed |
|---|---|---|
| Put up a notice for today | Announcements, New, fill 5 fields, Publish all | Today: type one line and press Put it up; the end defaults to the end of the day |
| Alert the room | Open Dashboard Settings, Screen tab, Alert, four fields | Today: one Alert switch with the words beside it |
| Hide this week's meeting | Calendars or Calendar filters, a new rule | A Skip button on the event in the Calendars page |
| Hide a Monday task | Monday Tasks, open, Show on TV off | A switch in the list row, no open |
| Add today's agenda | Agenda items, New, 5 rows | Today: copy yesterday's agenda button |
| Add a photo | Photos, New, upload | Drop several photos on the list at once |
| Skip a panel for now | Rotation, Shown off | Keep as is |
| Move to the next panel | Next look now (Start here) | Keep as is |
| Preview a team or a pack | Menu beside Publish | One Preview button on the Teams and Look pages |
| Publish | Publish all, top bar | Keep as is |

## 5. Questions to finish the design

Recommended answers are first.

1. Should Today be one page for every message (plate announcement, full screen announcement, alert), with the ticker kept separate? Recommend yes: one list with a "Where" choice of Plate, Full screen or Alert.
2. May the Team section of Dashboard Settings (name, number, school) be hidden, since the Team documents hold the same facts? Recommend yes, hide it, and keep the stored values as a fallback only.
3. Do the full screen announcements by time of day (settings) still matter to anyone? Recommend retire them from view and move any real ones into the Today list with a time field. The dataset shows no announcement documents in use.
4. Should the three look pages (Look, Themes and backgrounds, Logo and motion tab) become one Look line with groups? Recommend yes, and keep one schedule: the weekday theme plus the dated Look rules.
5. Who is allowed into Settings, Teams and Look? Recommend: everyone sees Start here, Today, Ticker, Events, People, Monday and Playlist; only coaches see the rest. Is a coach-only role possible in the Sanity plan, or is the split only by name?
6. Should Old screens and the Family view leave the sidebar completely? Recommend yes, with a "Kept data" link in Settings, so nothing is lost and nobody opens them by chance.
7. Which empty lists stay as sidebar lines: Presentations, Meeting days, Extra panels, Subthemes? Recommend: Presentations and Meeting days stay under Today (talks are real and booked by form); Extra panels moves under Coaches only; Subthemes goes under Look.
8. May seconds, photo count and the small panel beside it become the only timing controls, with Seconds per page as the single default? Recommend yes, and the other five timing fields are hidden.
