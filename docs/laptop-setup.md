# Setting up a laptop

How a coach with a new Mac gets the Teletraan code onto it and ships a change
to the screen from it. Allow an hour, most of it waiting for downloads.

The laptop does the same job as the Mac in the room. It pushes the code to
GitHub, updates the Studio and copies the files to the Mini. The Mini needs
nothing new, and nothing here installs anything on it.

## What you need

- A Mac that runs macOS, with internet.
- The team's GitHub sign-in and the team's Sanity sign-in. The team mentor holds
  both and does the two sign-in steps (3 and 5).
- The Mini's address as `user@host`, and the Mini's password. The school
  network or Tailscale must reach the Mini (`docs/rebuilding-the-mini.md`,
  "Finding the Mini on the network").

## 1. Install git and Node

Check what the laptop has:

```
git --version
```

```
node --version
```

A version number means it is installed. If git is missing, macOS offers to
install the command line tools. Say yes. Node must be 22.12 or newer, because
the Studio needs it.

If either one is missing or too old, install it yourself. Both ways work:

- Homebrew (brew.sh), if the laptop has it. `brew install git node` installs
  both.
- The installers from the official sites: git-scm.com and nodejs.org (take
  the newest LTS release).

No step in this guide installs them for you. Open a new Terminal window
afterwards and run the two checks again. `ssh` and `rsync` come with macOS.

## 2. Get the code

Pick a folder for the project. This one is only an example:

```
mkdir -p ~/Projects/teletraan-build
```

```
cd ~/Projects/teletraan-build
```

```
git clone https://github.com/Hawktimus/teletraan.git
```

```
cd teletraan
```

The `teletraan` folder is the repository folder. Every command below runs in
it unless the step says otherwise.

To get the newest code later, do this before each work session and before you
ship. It brings in everything the other computer pushed:

```
cd ~/Projects/teletraan-build/teletraan
```

```
git pull
```

## 3. Sign in to GitHub

The first time git needs GitHub, it asks you to sign in. That is the first
push, and the clone as well if the repository is private. GitHub does not take
an account password for git. The team mentor signs in, in one of two ways.

With GitHub's command line app, `gh` (cli.github.com), run `gh auth login` and
choose GitHub.com, HTTPS and the browser. Then run:

```
gh auth setup-git
```

Or with git's own credential helper. When git asks for a password, give a
personal access token that the team mentor made on github.com. The macOS
Keychain remembers it.

Never paste a token into a chat, an email or a file in the repository.

Git also needs a name and an email for the commits. They show in the history on
GitHub:

```
git config --global user.name "Your Name"
```

```
git config --global user.email "you@example.com"
```

## 4. Install the Studio's packages

Once, and it takes a few minutes. It downloads the Studio's packages into
`studio/node_modules`, which git leaves out. Use `npm ci` and not `npm install`:
`npm ci` installs exactly what the lock file lists and leaves the lock file as
it is, while `npm install` can rewrite it on a different version of npm, and
then git shows the file as changed:

```
cd studio
```

```
npm ci
```

```
cd ..
```

## 5. Sign in to Sanity

Once. The browser opens and the team mentor signs in with the account that
belongs to the team's Sanity project:

```
cd studio
```

```
npx sanity login
```

Check that it worked. The command lists the team's project:

```
npx sanity projects list
```

```
cd ..
```

## 6. Make the Ship app

```
tools/mac/make-app.sh
```

It writes `Ship Teletraan.app` to the Desktop. To put it somewhere else, give
the folder after the command, for example `tools/mac/make-app.sh ~/Applications`.
Drag the app into the Dock. The first time, macOS may say it cannot check the
app. Right-click it, choose Open, and choose Open again.

Make the app on the laptop. Do not copy it from another Mac: it holds the path
to `Ship Teletraan.command` in the folder that made it, so a copy would look for
a folder this laptop does not have. If you move the repository folder, make the
app again. A change to `ship.sh` reaches the app by itself, because the app only
holds that path.

## 7. Run the Mac tool once

The Mac tool keeps the Mini's address, and the Ship app needs it:

```
tools/mini/teletraan-mini
```

It asks for the Mini's address as `user@host`, checks that ssh works and asks
for a short name for the Mini, such as `main`. It saves both in
`~/.teletraan/config`. Nothing is saved if ssh cannot connect. Press `q` to quit
the menu afterwards.

To stop typing the Mini's password for every ssh call, send the laptop's key to
the Mini once. It asks for the Mini's password this one time. Use the address
you gave the tool:

```
ssh-copy-id hawktimus@teletraan.local
```

If it says there is no key to send, make one, press Return at the questions
(the team mentor decides about a passphrase), and run `ssh-copy-id` again:

```
ssh-keygen -t ed25519
```

`sudo` on the Mini still asks for its password when the screen restarts. That
is on purpose. Nothing stores a password.

## 8. Keys and calendars (only if this laptop will change them)

The three keys and the calendar links live on the Mini, in `mini/local.env`.
They are not in GitHub, and shipping never touches them. This laptop needs them
only to change a key or a calendar with choice 2 of the Mac tool. To bring
them over, start the tool, choose 3, and answer `y`:

```
tools/mini/teletraan-mini
```

The tool copies them from the Mini into `~/.teletraan/secrets.env`, readable by
you only, and prints none of them. Never send them by email or chat, and never
paste one into a file. Skip this step if the laptop will only ship.

## 9. What the app does

Open `Ship Teletraan.app`. It opens Terminal and shows a menu:

| Choice | What it does |
|--------|--------------|
| 1 | Ship everything: the three steps below, in order, after a look at this Mac and at GitHub |
| 2 | Push only: runs the checks, commits and pushes to GitHub |
| 3 | Studio only: puts the Studio's forms on sanity.io |
| 4 | Update the Mini only: copies the files and restarts the screen |
| 5 | Status of the Mini: what it last did |

Choice 1 does these in order. Each step stops the whole run when it fails:

1. **Push.** Runs the checks, asks for a short description of the change,
   commits it and pushes it to GitHub (`git push`).
2. **Studio.** Runs `npm run deploy` in `studio/`. It asks nothing about a
   hostname, because `studio/sanity.cli.js` names the team's Studio.
3. **Mini.** Runs `tools/mini/teletraan-mini update --yes`. It copies this
   folder to the Mini and restarts the screen. It asks for the Mini's password
   here in the window.

`docs/shipping-from-the-mac.md` explains each step.

## 10. When a step stops

The last lines say what had worked and which step stopped. Run the app again
after you fix the cause. A step that has nothing to do says so.

| What you see | What to do |
|--------------|------------|
| This Mac is not ready, with lines under it | Run the command in each line, then start again. Nothing was changed. |
| GitHub has newer commits that this folder does not have | Run `git pull --no-rebase` in the repository folder, then start again. Shipping from an old folder would put old files on the Mini. |
| The push was refused | The other computer pushed first. Run `git pull --no-rebase`, fix any conflict it reports, and start again. |
| The Studio did not deploy | If it is a login, run `npx sanity login` in `studio/`. Otherwise the lines above say why. |
| could not reach the Mini | Is the Mini on? Is the laptop on the school network or on Tailscale? Try `ssh user@host` by hand. |
| The Mini asks Copy anyway | The Mini also pulls from GitHub by itself. `docs/updating-the-mini.md` says how to turn that off. |
| A check failed | Run it by itself, for example `node tests/content.test.mjs`, and read why. You may go on anyway, but look first. |

## 11. Check that it works

- `git pull` ends with "Already up to date" or brings in new files.
- Choice 5 of the app shows the times of the Mini's last jobs.
- Choice 1 ends with "Done: checks, commit and push, Studio, Mini update and
  restart".
- In Studio, Dashboard Settings, the Screen tab shows a new time for Screen
  started at the top.
- The TV went black for about ten seconds and came back with the change.
- The commit is on the main branch on github.com.

A harmless first test is choice 4. It copies the files that are already here
and restarts the screen.

## What is not in GitHub

Only the `teletraan` folder is on GitHub. These are not, and a fresh clone does
not have them:

- `mini/local.env`, the keys and calendar links. They stay on the Mini. Step 8
  brings them to the laptop when needed.
- `~/.teletraan/`, the Mini's address and the saved keys. Each Mac makes its
  own with steps 7 and 8. Never copy that folder by email or chat.
- `studio/node_modules`, which step 4 makes, and `studio/dist` and `studio/.sanity`,
  which a deploy makes.
- The files in the parent folder around the repository (`teletraan-build` on the
  Mac in the room): the project notes, the reference pictures and the Ship app
  made on that Mac. Copy the notes and the pictures with AirDrop or a USB drive
  if you want them on the laptop. Do not copy the `teletraan` folder inside it
  or the app. Clone the code again (step 2) and make a new app (step 6).
