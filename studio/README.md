# Teletraan I Studio

The editing screen for the dashboard, built with Sanity Studio. About ten team
members use it to change the tasks, plans, sponsors and other content on the
TV. The dashboard reads what they publish.

## What is here

    project.js            the project ID and dataset
    sanity.config.js      the Studio's main settings
    sanity.cli.js         settings for the command line tool
    structure.js          the sidebar, in plain words
    schemas/              one file per kind of content
    check-schemas.mjs     a check that needs nothing installed
    package.json          the packages the Studio needs

Each file in schemas/ describes one kind of content: its fields, the text
shown beside each field, and the limits on length. See
docs/adding-a-field.md for how to change one.

## Setting it up on a Mac

The Sanity project already exists. Its ID is `ybfqe345` and its dataset is
called `production`. The ID is in project.js and in dashboard/config.js, and
`node check-schemas.mjs` fails if the two differ. A project ID is public (it
is part of every address the dashboard asks for), so it is fine to keep it in
the repository.

Do these once, in order. Steps 3 and 4 install packages and sign in to the
team's Sanity account, so they need the team mentor's yes first (see
docs/where-things-are.md).

1. Open the Terminal app: press Command+Space, type Terminal and press
   Enter.
2. Go to this folder. Type `cd ` with a space after it, drag the `studio`
   folder from Finder into the Terminal window, and press Enter. Check that
   Node.js is new enough with `node --version`. It must print v22.12 or
   higher. If it does not, install the current LTS version from nodejs.org
   (again, ask first).
3. Install the packages. This takes a few minutes the first time.

       npm install

4. Sign in to Sanity. A browser window opens. Sign in with the account that
   owns the project.

       npx sanity login

5. Start the Studio on this Mac. Open http://localhost:3333 in a browser. Leave
   the Terminal window open while you use it, and press Control+C in it to
   stop.

       npm run dev

6. Let the dashboard read from Sanity. In a browser go to sanity.io/manage,
   open the Teletraan project, choose API, then CORS origins, then Add CORS
   origin. Type `http://localhost:8080`, leave "Allow credentials" off, and
   save. CORS is the browser rule that lets a web page read data from another
   website only when that website has listed the page's address. This one
   address covers both this Mac and the Mini, because the web server on the
   Mini answers at `http://localhost:8080` too. If you ever change the port
   (`TELETRAAN_PORT` in deploy/local.env), add the new address as well.
7. Type some content into the Studio. Open Dashboard Settings first and click
   Publish. Then check the Announcements tab: the two starting rows, 14:30 and
   17:00, must be there, because a settings page saved without them plays no
   announcements. The Screen tab should show Frame metal on Gold, with Glint
   and Name effect on, and the Panels tab should show Seconds per page at 20.
   Add a few tasks, a sponsor and some tips, and click Publish on each.
   Studio keeps what you type as a draft, and the dashboard only reads what is
   published.
8. Switch the dashboard over from the sample content. In dashboard/config.js
   change this line, save, and reload the dashboard:

       export const useSampleContent = false;

   The [square bracket] sample text is replaced by what you published. A
   change you publish after this shows on the screen within a few seconds.
9. Put the Studio online so the other editors can sign in from anywhere. The
   first time, it asks you to choose the Studio's address.

       npm run deploy

   Then invite each editor: on sanity.io/manage open the project and choose
   Members. Put the Studio's address into docs/editing-content.md.

The dataset has to stay public. The dashboard reads it without a key, so
nothing secret may be typed into Studio. Do not change the dataset to private.

Commands for later, run in this folder:

    npm run dev       opens the Studio on this computer, at http://localhost:3333
    npm run build     builds the Studio into a folder called dist
    npm run deploy    puts the latest Studio on the web (do this after changing a schema)

## If the screen cannot read the content

After step 8, the banner says OFFLINE when the dashboard has not managed to read
Sanity yet. It keeps showing the last copy it saved. Open the browser's console
to see why.

- A message that mentions CORS: the origin from step 6 is missing, or was typed
  differently from the address in the browser's address bar, for example
  `localhost` against `127.0.0.1`.
- The screen is up but empty: nothing is published yet (step 7).
- Anything else: go back to useSampleContent = true to get the screen working
  again, then ask the team mentor.

## The packages

`npm install` adds these four packages.

- sanity: the Studio itself, and the `sanity` command
- react and react-dom: the Studio is built on React. There is no React code to
  write here.
- styled-components: the Studio uses it for its look. It has to be installed
  next to sanity and is not used directly.

## Checking the schemas

    node check-schemas.mjs

This needs no install. It loads every schema and checks it against what the
dashboard reads: every field exists with the right name and limit, every field
has a description, the starting values match dashboard/config.js, and the
project ID in project.js is the one in dashboard/config.js. It prints PASS or
FAIL for each check and exits with an error if any fails. Run it after every
change to a schema.
