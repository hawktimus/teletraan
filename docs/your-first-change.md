# Your first change

For a student who knows Java and has not written a web page. This page walks you through the
changes you will make most often, with the real files and the real commands. Every step was
tried on a Mac with a copy of this repository. Do them in order the first time. Each one ends
with what you should see, so you know it worked.

## Words you need

- **HTML, CSS and JavaScript.** HTML says what is on the page. CSS says how it looks. JavaScript
  says what it does. Each panel on the TV is one folder with a `panel.js` and a `panel.css`.
- **A module** is a JavaScript file with `import` and `export` lines. Think of it as a Java class
  file: `export function mount(...)` is a public method, and `import { escapeHtml } from
  '../../core/text.js'` is an import.
- **A token** is a named value in CSS, written `--lilac: #c7b1ec;` and used as
  `color: var(--lilac);`. Think of it as a `static final` constant. A color is written once, as
  a token, and everything else says `var(--name)`.
- **A panel** is one box on the TV, such as Events or Sponsor. `dashboard/registry.js` lists them all.
- **Sample content** is made up text in `dashboard/data/sample/content.json`. It lets you see the
  screen without the Studio. Every piece of it is in [square brackets].
- **There is no build step.** You save a file, refresh the browser and see the change.

## Before you start

Open a terminal in the repository folder. On a Mac, type `cd ` (with a space), drag the folder
from Finder into the terminal window and press Enter. Then check two things:

    python3 --version
    node --version

Both must print a version number. Node should be 20 or newer. If one is missing, ask the mentor
who holds the team's accounts before you install anything (docs/where-things-are.md, the top).

Work on a copy of the files you can undo. To see what you changed so far, and to undo one file:

    git status
    git diff
    git restore dashboard/themes/hawktimus.css

`git restore <file>` puts a file back as it was at the last commit. Use it freely while you learn.

## 1. See the screen

Start the small web server and leave that terminal open:

    python3 tools/serve.py

It prints `Serving HTTP on 127.0.0.1 port 8080`. If it says the address is already in use, give it
another port: `python3 tools/serve.py 8081`, and use 8081 below. Press Ctrl+C to stop it.

Open this address in Chrome or Firefox:

    http://localhost:8080/dashboard/?sample=1&night=off

What the address says:

| Part | What it does |
|------|--------------|
| `?sample=1` | Shows the sample content, so you need no Studio and no internet for the content. |
| `&night=off` | Keeps the night screen away. The TV is dark from 11:30 pm to 11:30 am, so without this you see a black page in the morning. |
| `&show=events` | Shows only one panel in its frame. Use the folder name of the panel, such as `ticker`, `events` or `sponsor-feature`. |
| `&motion=none` | Stops all movement, so you can look at a page that keeps turning over. |

You should see the screen of the TV, with SAMPLE CONTENT in the banner. The browser console
(Chrome on a Mac: Cmd+Option+J) shows red lines about `build.js`, `data/live/version.txt` and a
`POST` to `control/api/now`. They are normal on your own computer, because the Teletraan
computer makes those files and answers that call. Any other red line is worth reading: it says
what is wrong and in which file.

After each change below, save the file and refresh the page (Cmd+R). If nothing changed, the
file did not save, the address is different, or the change is somewhere the screen does not
read. The step says where.

## 2. Change a color

Colors are tokens. The default look keeps them in `dashboard/themes/hawktimus.css`. Open it and
find this line:

    --lilac: #c7b1ec;

Change it to a pink and save:

    --lilac: #ffb3d9;

Open `http://localhost:8080/dashboard/?sample=1&night=off&show=events`. The place and time under
each event, which were light purple, are now pink.

Two things to know:

- Four colors of the default look are not set here. `--purple`, `--yellow`, `--ground` and
  `--white` come from the team (Teams in the Studio, and `primeTeam` in `dashboard/config-more.js`;
  `dashboard/teams.css` joins them). Changing `--yellow` in this file changes nothing on screen.
- Text must stay readable from 20 feet. A test checks the contrast of every pair of text and
  background. Run it now:

      node tests/run.mjs check-themes

  It prints `ok` for your pink. To see it fail, set `--lilac: #3a2a55;`, which is too dark, and run
  it again. The line that starts with FAIL says which pair is too dark and how far under the limit
  it is. Put the pink back.

A color is never written anywhere else. A hex code such as `#ffb3d9` in a panel's own stylesheet
is refused by `node tests/run.mjs graphics` and tells you to add a token.

## 3. Change the text of a ticker line

The ticker is the line at the bottom. The real lines are typed in the Studio, under Tips and
News. The sample lines are in `dashboard/data/sample/content.json`. Find `tipsAndNews`:

    "tipsAndNews": [
      { "kind": "tip", "text": "[A tip for the team.]" },

Change the text, keep the quotes and keep the square brackets:

    { "kind": "tip", "text": "[Charge the batteries before every meeting.]" },

Open `http://localhost:8080/dashboard/?sample=1&night=off&show=ticker`. The ticker shows your
line after a TIP label. A JSON file has no comments and no trailing comma, so a missing quote or
comma after an entry breaks the whole file. The console then says it could not read the sample
content. `git diff` shows what you changed.

The words TIP, NEWS, REMINDER and THANKS on the label are in `dashboard/panels/ticker/panel.js`,
in the list called `tags`. A label that is longer than the others needs a larger `width` there.

## 4. Change a panel's seconds

The screen plays one list, the rotation, from top to bottom. The default list is
`defaultRotationRows` in `dashboard/config-rotation.js`. Find the first row:

    pair('leadership', 'sponsor-logo', { seconds: 20 }),

The first word is the large panel, the second is the small panel beside it, and `seconds` is how
long the row stays. Change `20` to `10`.

The same list is written a second time for the Studio, in `studio/tools/default-rotation.js`.
Change the same row there. Then run:

    node tests/run.mjs default-rotation

If you change only one file the test fails and names the row and both values:

    Row 1 (leadership) is different in the two files. dashboard/config-rotation.js says {...}
    and studio/tools/default-rotation.js says {...}. Change both files so they match

Refresh `http://localhost:8080/dashboard/?sample=1&night=off` (with no `show`). Leadership now
stays 10 seconds, and then Events comes up.

This only changes the default. When the editors have saved their own rotation in the Studio
(Rotation, in the sidebar), that list wins, and the seconds are changed there
(docs/rotation-board.md).

## 5. Add a field to a panel

Example: a "Sponsor since" year on a sponsor, shown beside the tier on the Sponsor panel. A new
field touches six places. Do them in this order.

**a. The Studio form.** Open `studio/schemas/sponsor.js`. Add this after the `tier` field. Every
field has a name that the screen reads, a title and a description that editors read, and a limit
on its length:

    defineField({
      name: 'since',
      title: 'Sponsor since',
      type: 'string',
      description: 'The year the sponsor joined the team, such as 2019. Optional. Up to 4 characters fit.',
      validation: Rule => tooLong(Rule, 4),
    }),

The `name` is stored in the editors' data for good. Never rename it later: content already saved
stays under the old name. Change the `title` if the words need to change.

**b. The sample content.** In `dashboard/data/sample/content.json`, find the sponsor and add a
line after `"tier"`:

    "since": "[Year]",

**c. The panel.** Open `dashboard/panels/sponsor-feature/panel.js`. Find these lines:

    const tier = sponsor.tier ? `<span class="tag-text">${escapeHtml(sponsor.tier)}</span>` : '';

Replace that line with these three. The year joins the tier when there is one:

    // the tier and the year the sponsor joined, with a space between them when both are there
    const tierText = [sponsor.tier, sponsor.since].filter(hasText).join(' ');
    const tier = tierText ? `<span class="tag-text">${escapeHtml(tierText)}</span>` : '';

A few lines down, change `textWidth(sponsor.tier || '', 600, 44)` to `textWidth(tierText, 600, 44)`.
Anything an editor typed goes through `escapeHtml` before it goes in a template, and a field
nobody filled in is missing, so the panel must work without it.

**d. The check.** `tests/schemas.test.mjs` holds the shape of every kind of content. Find the
line that starts `sponsor: withFlags({` and add `since: text(4),` after `tier: text(12),`.

**e. The list of stored names.** Run this once. It records the new name, so that nobody can
remove it by accident later:

    node tests/stored-names.test.mjs --add

**f. The CSV templates.** The templates in `docs/content-templates/` are made from the schemas:

    node studio/scripts/make-templates.mjs

Now look at `http://localhost:8080/dashboard/?sample=1&night=off&show=sponsor-feature`. The tag
at the right end of the header says `[Tier] [Year]`. Run `node tests/run.mjs --quick` (step 7).
The new field reaches the editors when the Studio is deployed, which the Ship app does (step 8).
docs/adding-a-field.md has the full list, and what to do for a status, a picture or a setting.

## 6. Add a new small panel from a copy

The small panel sits under the countdown. The easiest start is a copy of `next-event`. The
example is called `hello-tile`. Use lowercase words with dashes for an id.

**a. Copy the folder and rename it.** In the terminal, in the repository folder:

    cp -R dashboard/panels/next-event dashboard/panels/hello-tile
    perl -pi -e 's/next-event/hello-tile/g; s/NEXT EVENT/HELLO/' dashboard/panels/hello-tile/panel.js dashboard/panels/hello-tile/panel.css

`cp -R` copies a folder with everything in it. The second command changes the class name in
both files, so the stylesheet cannot touch another panel, and the label to HELLO.

**b. Register it.** Open `dashboard/registry.js` and add a line to the list, next to the other
small panels:

    { id: 'hello-tile', region: 'grid2', topic: 'hello', rotationOnly: true },

`grid2` is the small panel. The `topic` is what it is about: the large and the small panel never
show the same topic at the same time, so a new panel gets a topic of its own.
`rotationOnly` means the panel is drawn only when a row of the rotation names it. That is the safe
way to add a panel: it cannot change what the TV plays until an editor chooses it. A panel without it
is also a spare for the small frame, which changes several tests and needs more lists
(docs/adding-a-panel.md, steps 7 and 8).

**c. Offer it in the Studio.** Editors pick a small panel for a row from a list. In
`studio/inputs/screen-panels.js`, in `pairedPanels`, add a line after the last one:

    { title: 'Hello tile', value: 'hello-tile' },

The title is the plain name editors read. If you forget this line, the test in step 7 names the
list that is missing the panel.

**d. Look at it.** Open `http://localhost:8080/dashboard/?sample=1&night=off&show=hello-tile`.
You see your panel in its frame, with HELLO on it. It is a copy, so it still shows the next
event. To make it your own, change `mount` in `dashboard/panels/hello-tile/panel.js`. Keep the
`data-slat` marks, which let the frame turn the page over. A panel never holds a timer or an
animation: `docs/adding-a-panel.md` says how a panel is built and what it may not do.

**e. Run the tests** (step 7). The panel is on the TV only when a row of the rotation names it. An
editor opens Rotation in the Studio, picks Hello tile as the Small panel of a Robotics row, and clicks
Publish all (docs/rotation-board.md).

When you are done trying, remove it again: delete `dashboard/panels/hello-tile`, and the two
lines you added.

## 7. Run the tests

Every test is a Node file in `tests/`. The runner runs them three at a time and prints one line
for each file.

    node tests/run.mjs --quick

This is the one for your edit loop. It leaves out the tests that build a fake Teletraan
computer, which take minutes and do not look at the files you edit. It finishes in under a minute
on a Mac that is doing nothing else, and prints `Quick run` at the end to say what it left out.

    node tests/run.mjs

This runs everything, including the motion tests when Playwright is installed. It takes several
minutes. Run it before you ship, or let the Ship app do it.

    node tests/run.mjs sponsor

This runs only the files whose name has `sponsor` in it. Run one file by itself to see all of
its output: `node tests/house-rules.test.mjs`.

Reading a failure: the line that starts with `FAIL` is the one to read. The lines under it say what
is wrong, in which file and on which line, and what to do instead. For example, a timer in a panel:

    FAIL  a panel folder holds no animation code
          dashboard/panels/hello-tile/panel.js line 12: uses setTimeout, which is animation code
          Why: Everything that moves goes through the shared frame module, so one place decides the speed and the calm mode.
          Do instead: Delete the timer or the animation from the panel. Mark the piece with data-slat="item" ...

The tests that guard the house rules, and what each one stops:

| Test | It fails when |
|------|---------------|
| `tests/house-rules.test.mjs` | a panel has a timer, `animate()`, `transition` or `animation`; the dashboard has a framework, a build file, a package or a script from another address; text in a panel is under 44px; there is a shadow, a blend mode, 3D or a video; a panel folder lacks `panel.js`, `panel.css` or its line in `registry.js`; a file that configures a code writing tool is in the repository |
| `tests/graphics.test.mjs` | a hex color is written outside the token files; there is a blur, a filter or a drop shadow |
| `tests/stored-names.test.mjs` | a field, a type or a choice that is stored in Sanity is renamed or removed |
| `tests/no-secrets.test.mjs` | a key, a token, a private calendar address or a value from `local.env` is in a file of the repository |
| `tests/check-themes.test.mjs` | a color pair is too faint to read, or a keyframe is outside `frame.css` |
| `tests/schemas.test.mjs` | a field has no description or no limit, or the lists of panels disagree |
| `tools/sweep.sh` | a file holds a name from tools/sweep-words.txt, which does not belong in the repository (run by the push hook) |

If a rule is in your way, ask a mentor before you add an exception. An exception is a line in a
list in the test, with the reason written beside it.

## 8. Send it with the Ship app

You do not need to know git to ship, but ask a mentor before the first time. The Ship app is on
the owner's Mac (docs/shipping-from-the-mac.md). It runs the tests, asks for a short description
of what you changed, commits, pushes to GitHub, deploys the Studio and updates the Teletraan
computer, which restarts the screen.

Start it with a double click on `Ship Teletraan.command` in `tools/mac/`, or in a terminal:

    tools/mac/ship.sh

To see every command it would run without running any of them, try it first with:

    tools/mac/ship.sh --dry-run all

It checks the Mac first and lists what is missing, for example that the Studio's packages are not
installed, and stops before anything is sent. Write the description in plain words: "Make
Leadership stay 10 seconds", not "changes". If the tests fail, ship lists them and asks whether
to go on. Say no, fix them first and start again. If you are not sure, stop and ask.

## If something goes wrong

| What you see | What to do |
|--------------|------------|
| A black page | It is night. Add `&night=off` to the address. |
| The page is blank and the console has a red line with a file name | Open that file at that line. A missing bracket, quote or comma is the usual cause. |
| The change does not show | Save the file. Refresh. Look at the address: `show=` needs the folder name of a panel. Check the file is the one the step names. |
| `Address already in use` | Another server is running. Close that terminal, or use another port: `python3 tools/serve.py 8081`. |
| A test says `FAIL` | Read the lines under it. They name the file and say what to do. Fix that and run the same command again. |
| You want to start over on one file | `git restore <file>`. For a whole copied folder, delete the folder. |
| You are stuck for more than 15 minutes | Ask a mentor. Show them the exact FAIL lines. |
