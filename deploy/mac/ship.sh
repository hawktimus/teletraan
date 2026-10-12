#!/bin/bash
# Ships a change from this Mac to the screen: checks the code, commits and
# pushes it to GitHub, updates the Studio, then has the Mac tool copy the files
# to the Mini and restart the screen. docs/shipping-from-the-mac.md explains each
# step and what to do when one stops.
#
# Run it by double-clicking "Ship Teletraan.command" in Finder, from
# "Ship Teletraan.app" (deploy/mac/make-app.sh makes it), or in a terminal:
#
#   deploy/mac/ship.sh             a menu
#   deploy/mac/ship.sh all         check, commit, push, Studio, update the Mini and restart the screen
#   deploy/mac/ship.sh push        check, commit and push only
#   deploy/mac/ship.sh studio      update the Studio only
#   deploy/mac/ship.sh mini        update the Mini and restart the screen only
#   deploy/mac/ship.sh status      show the status of the Mini
#
# Older words still work: all-restart is the same as all, and restart restarts
# the screen without copying anything.
#
# Add --dry-run to any of them to see what would run without running it.
# Every step stops the whole run when it fails, so nothing later runs on top of
# a broken step, and the last lines say what had worked. No password is stored
# anywhere: git, Sanity, ssh and sudo ask you in this window.
#
# The Mini's address is not here. The Mac tool keeps it in ~/.teletraan/config
# (tools/mini/teletraan-mini, docs/updating-the-mini.md).

set -u

here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
mini_tool=$repo/tools/mini/teletraan-mini
mini_config=$HOME/.teletraan/config

dry_run=no
action=''
for argument in "$@"; do
  if [ "$argument" = "--dry-run" ]; then dry_run=yes; else action=$argument; fi
done

finished=''  # the steps that worked, for the summary at the end
problems=''  # what this Mac is missing, one line each

say() { printf '%s\n' "$*"; }

step() {
  printf '\n\033[1m==> %s\033[0m\n' "$*"
}

fail() {
  printf '\n\033[1mStopped: %s\033[0m\n' "$*" >&2
  if [ -n "$finished" ]; then
    say "Done before it stopped:$finished" | sed 's/,$//' >&2
  else
    say "Nothing had been done before it stopped." >&2
  fi
  exit 1
}

# Asks a yes or no question. The second word is the answer for pressing Return,
# so a risky question can default to no.
ask() {
  local reply
  if [ "$2" = yes ]; then read -r -p "$1 [Y/n] " reply; else read -r -p "$1 [y/N] " reply; fi
  reply=$(printf '%s' "$reply" | tr '[:upper:]' '[:lower:]')
  if [ -z "$reply" ]; then reply=$2; fi
  [ "$reply" = y ] || [ "$reply" = yes ]
}

# Runs a command, or only shows it on a dry run
run() {
  if [ "$dry_run" = yes ]; then
    say "  [dry run] $*"
    return 0
  fi
  "$@"
}

missing() {
  problems="$problems  - $*"$'\n'
}

need_tool() {
  command -v "$1" >/dev/null 2>&1 || missing "$1 is not installed. $2"
}

# The Studio needs Node 22.12 or newer (studio/package.json)
node_is_new_enough() {
  local version major minor
  version=$(node --version 2>/dev/null) || return 1
  version=${version#v}
  major=${version%%.*}
  minor=${version#*.}
  minor=${minor%%.*}
  case "$major$minor" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$major" -gt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -ge 12 ]; }
}

# Step 0: everything the run needs, looked at before anything is committed or
# sent, so a missing piece cannot leave the run half done. All the gaps are
# listed together, each with the one command that fills it.
preflight() {
  local tools='' modules=no identity=no mini=no tool
  case $1 in
    all)            tools='git node npm ssh rsync'; modules=yes; identity=yes; mini=yes ;;
    push)           tools='git node'; identity=yes ;;
    studio)         tools='node npm'; modules=yes ;;
    mini|status|restart) tools='ssh rsync'; mini=yes ;;
  esac

  step "Checking this Mac"
  for tool in $tools; do
    case $tool in
      git)   need_tool git "Install it first (docs/laptop-setup.md, step 1)." ;;
      node)  need_tool node "Install Node first (docs/laptop-setup.md, step 1)." ;;
      npm)   need_tool npm "It comes with Node (docs/laptop-setup.md, step 1)." ;;
      *)     need_tool "$tool" "It comes with macOS, so something is wrong with this Mac." ;;
    esac
  done

  if [ "$modules" = yes ]; then
    if command -v node >/dev/null 2>&1 && ! node_is_new_enough; then
      missing "the Studio needs Node 22.12 or newer, and this Mac has $(node --version 2>/dev/null). Install a newer Node (docs/laptop-setup.md, step 1)."
    fi
    [ -d "$repo/studio/node_modules" ] || missing "the Studio's packages are not installed. Run once: cd \"$repo/studio\" && npm install"
  fi

  if [ "$identity" = yes ] && command -v git >/dev/null 2>&1; then
    [ -n "$(git -C "$repo" config user.name 2>/dev/null)" ] || missing "git does not know your name. Run once: git config --global user.name \"Your Name\""
    [ -n "$(git -C "$repo" config user.email 2>/dev/null)" ] || missing "git does not know your email. Run once: git config --global user.email \"you@example.com\""
  fi

  if [ "$mini" = yes ]; then
    if [ ! -x "$mini_tool" ]; then
      missing "the Mac tool is missing or cannot run: $mini_tool"
    elif ! grep -Eq '^mini\.[a-z0-9_-]+=' "$mini_config" 2>/dev/null; then
      missing "this Mac has no saved Mini yet. Run once, and give it the Mini's address: \"$mini_tool\""
    fi
  fi

  if [ -n "$problems" ]; then
    say "This Mac is not ready:"
    printf '%s' "$problems"
    fail "fix the lines above and run this again. Nothing was changed."
  fi
  say "  ready"
}

# The Mac tool copies this folder as it is, so a folder that is behind GitHub
# (the other computer pushed since the last git pull) would put older files on
# the Mini. This looks first and stops before anything is sent.
check_up_to_date() {
  step "Comparing this folder with GitHub"
  command -v git >/dev/null 2>&1 || return 0
  if ! run git -C "$repo" fetch --quiet; then
    say "GitHub could not be reached, so this folder was not compared with it."
    return 0
  fi
  local behind
  behind=$(git -C "$repo" rev-list --count 'HEAD..@{u}' 2>/dev/null || echo 0)
  if [ "$behind" != 0 ]; then
    say "GitHub has $behind newer commit(s) that this folder does not have. Shipping now would put older files on the Mini. Run:"
    say "  cd \"$repo\" && git pull --no-rebase"
    say "and then run this again."
    fail "this folder is behind GitHub."
  fi
  say "  up to date"
}

# Step 1: the same checks a student can run by hand (docs/where-things-are.md).
# They take a few seconds. A failing check is a warning you can overrule.
run_checks() {
  step "Checking the code"

  local failed='' file name count=0
  for file in "$repo"/tools/test-*.mjs "$repo"/tools/check-*.mjs "$repo"/studio/check-schemas.mjs; do
    [ -f "$file" ] || continue
    name=${file#"$repo"/}
    count=$((count + 1))
    if [ "$dry_run" = yes ]; then continue; fi
    if (cd "$repo" && node "$file" >/dev/null 2>&1); then
      say "  ok      $name"
    else
      say "  FAILED  $name"
      failed="$failed $name"
    fi
  done

  if [ "$dry_run" = yes ]; then
    say "  [dry run] would run $count checks with node"
  elif [ -n "$failed" ]; then
    say ""
    say "To see why one failed, run it in a terminal, for example: node $(printf '%s' "$failed" | awk '{print $1}')"
    ask "Some checks failed. Go on anyway?" no || fail "a check failed. Fix it and run this again."
  fi
  finished="$finished checks,"
}

# Step 2: commit what changed and push it. GitHub's main is the copy the
# laptop and any other computer start from.
commit_and_push() {
  step "Commit and push"
  cd "$repo" || fail "the repository folder is missing: $repo"

  local branch
  branch=$(git branch --show-current)
  [ -n "$branch" ] || fail "git is not on a branch. Check out main first."
  if [ "$branch" != main ]; then
    say "You are on the branch '$branch'. Other computers start from main, so this will not reach them."
    if [ "$dry_run" = no ]; then
      ask "Push '$branch' anyway?" no || fail "switch to main first (git checkout main)."
    fi
  fi

  local committed=no
  if [ -n "$(git status --porcelain)" ]; then
    say "Changes since the last commit:"
    git status --short
    say ""

    # The settings file with the calendar addresses must never reach GitHub.
    # .gitignore already skips it; this is the second lock on the door.
    local risky
    risky=$({ git diff --name-only HEAD; git ls-files --others --exclude-standard; } |
      grep -E '(^|/)(local\.env[^/]*|[^/]*\.env|\.env[^/]*|[^/]*\.pem|[^/]*\.key|id_(rsa|ed25519)[^/]*)$' |
      grep -v 'example\.env$')
    if [ -n "$risky" ]; then
      say "These look like secrets and will not be committed:"
      say "$risky"
      fail "remove them from the repository folder, or add them to .gitignore."
    fi

    local message=${SHIP_MESSAGE:-}
    if [ -z "$message" ] && [ "$dry_run" = yes ]; then
      message='(you would be asked for a short description)'
    elif [ -z "$message" ]; then
      read -r -p "Describe the change in a few words: " message
    fi
    [ -n "$message" ] || fail "a commit needs a short description."

    run git add -A || fail "git add failed."
    run git commit -q -m "$message" || fail "git commit failed."
    committed=yes
  else
    say "Nothing new to commit."
  fi

  local waiting=0
  waiting=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
  if [ "$committed" = no ] && [ "$waiting" = 0 ]; then
    say "GitHub already has everything. Nothing to push."
    finished="$finished commit,"
    return 0
  fi

  say "Pushing to GitHub..."
  if ! run git push; then
    say ""
    say "The push was refused. Most often GitHub has a change this Mac does not have"
    say "(an edit made on github.com, or a push from the other computer). Nothing was forced. Run:"
    say "  cd \"$repo\" && git pull --no-rebase"
    say "then fix any conflict it reports, and run this again."
    fail "the push did not go through."
  fi
  finished="$finished commit and push,"
}

# Step 3: the Studio's own page on sanity.io. Editors see new fields after this.
# studio/sanity.cli.js names the hosted Studio, so Sanity asks nothing.
update_studio() {
  step "Updating the Studio"
  if ! grep -q 'appId' "$repo/studio/sanity.cli.js" 2>/dev/null; then
    say "studio/sanity.cli.js has no appId, so Sanity will ask which hostname to use. Pick teletraan (docs/shipping-from-the-mac.md)."
  fi
  say "If it says you are not logged in, stop, run 'npx sanity login' in the studio folder, and start again."
  if ! (cd "$repo/studio" && run npm run deploy); then
    fail "the Studio did not deploy. The lines above say why. If it is a login, run: cd \"$repo/studio\" && npx sanity login"
  fi
  finished="$finished Studio,"
}

# Step 4: the Mac tool copies this folder to the Mini and restarts the screen.
# It asks for the Mini's passwords here, in this window, and stores none.
update_mini() {
  step "Updating the Mini and restarting the screen"
  if ! run "$mini_tool" update --yes; then
    fail "the Mini was not updated. The lines above say why."
  fi
  finished="$finished Mini update and restart,"
}

status_mini() {
  step "Status of the Mini"
  run "$mini_tool" status || fail "the status could not be read. The lines above say why."
  finished="$finished Mini status,"
}

# Only the restart, for a screen that looks wrong
restart_mini() {
  step "Restarting the screen on the Mini"
  run "$mini_tool" restart || fail "the screen was not restarted. The lines above say why."
  finished="$finished restart,"
}

menu() {
  say "Ship Teletraan I"
  say ""
  say "  1  Ship everything: check the code, commit, push, deploy the Studio,"
  say "     update the Mini and restart the screen"
  say "  2  Push only: check the code, commit and push"
  say "  3  Studio only"
  say "  4  Update the Mini only, and restart the screen"
  say "  5  Status of the Mini"
  say "  q  Quit"
  say ""
  local choice
  read -r -p "Choose: " choice
  case "$choice" in
    1) action=all ;;
    2) action=push ;;
    3) action=studio ;;
    4) action=mini ;;
    5) action=status ;;
    *) say "Nothing done."; exit 0 ;;
  esac
}

[ -n "$action" ] || menu
if [ "$action" = all-restart ]; then action=all; fi
case "$action" in
  all|push|studio|mini|status|restart) ;;
  *) fail "I do not know that word. Use all, push, studio, mini or status." ;;
esac
if [ "$dry_run" = yes ]; then say "Dry run: nothing below is run."; fi

preflight "$action"
case "$action" in
  all)     check_up_to_date; run_checks; commit_and_push; update_studio; update_mini ;;
  push)    run_checks; commit_and_push ;;
  studio)  update_studio ;;
  mini)    check_up_to_date; update_mini ;;
  status)  status_mini ;;
  restart) restart_mini ;;
esac

step "Finished"
if [ "$dry_run" = yes ]; then
  say "Dry run: these steps would run:$finished" | sed 's/,$//'
else
  say "Done:$finished" | sed 's/,$//'
  case "$action" in
    all|mini|restart) say "The screen was restarted, so it shows the new files." ;;
  esac
fi
