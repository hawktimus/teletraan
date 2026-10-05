#!/bin/bash
# Ships a change from this Mac to the screen: checks the code, commits and
# pushes it to GitHub, updates the Studio, and tells the Mini to pull (and,
# if you ask, to restart the screen). docs/shipping-from-the-mac.md explains
# each step and what to do when one stops.
#
# Run it by double-clicking "Ship Teletraan.command" in Finder, or in a terminal:
#
#   deploy/mac/ship.sh             a menu
#   deploy/mac/ship.sh all         check, commit, push, Studio, Mini pull
#   deploy/mac/ship.sh all-restart the same, then restart the screen
#   deploy/mac/ship.sh push        check, commit and push only
#   deploy/mac/ship.sh studio      update the Studio only
#   deploy/mac/ship.sh mini        the Mini pulls only
#   deploy/mac/ship.sh restart     restart the screen on the Mini only
#
# Add --dry-run to any of them to see what would run without running it.
# Every step stops the whole run when it fails, so nothing later runs on top
# of a broken step. No password is stored anywhere: ssh and sudo ask you.

set -u

# The Mini. These are not secrets; change them here if the Mini changes.
MINI_ADDRESS=${MINI_ADDRESS:-hawktimus@teletraan.local}
MINI_REPO=${MINI_REPO:-/opt/teletraan}
MINI_KIOSK=${MINI_KIOSK:-teletraan-kiosk.service}

here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)

dry_run=no
action=''
for argument in "$@"; do
  if [ "$argument" = "--dry-run" ]; then dry_run=yes; else action=$argument; fi
done

finished=''  # the steps that worked, for the summary at the end

say() { printf '%s\n' "$*"; }

step() {
  printf '\n\033[1m==> %s\033[0m\n' "$*"
}

fail() {
  printf '\n\033[1mStopped: %s\033[0m\n' "$*" >&2
  if [ -n "$finished" ]; then say "Done before it stopped:$finished" | sed 's/,$//' >&2; fi
  exit 1
}

# Asks a yes or no question. The second word is the answer for just pressing
# Return, so a risky question can default to no.
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

# Step 1: the same checks a student can run by hand (docs/where-things-are.md).
# They take a few seconds. A failing check is a warning you can overrule.
run_checks() {
  step "Checking the code"
  command -v node >/dev/null 2>&1 || fail "node is not installed on this Mac, so the checks cannot run."

  local failed='' file name
  for file in "$repo"/tools/test-*.mjs "$repo"/tools/check-*.mjs "$repo"/studio/check-schemas.mjs; do
    [ -f "$file" ] || continue
    name=${file#"$repo"/}
    if (cd "$repo" && node "$file" >/dev/null 2>&1); then
      say "  ok      $name"
    else
      say "  FAILED  $name"
      failed="$failed $name"
    fi
  done

  if [ -n "$failed" ]; then
    say ""
    say "To see why one failed, run it in a terminal, for example: node $(printf '%s' "$failed" | awk '{print $1}')"
    ask "Some checks failed. Go on anyway?" no || fail "a check failed. Fix it and run this again."
  fi
  finished="$finished checks,"
}

# Step 2: commit what changed and push it. The Mini follows GitHub's main.
commit_and_push() {
  step "Commit and push"
  cd "$repo" || fail "the repository folder is missing: $repo"

  local branch
  branch=$(git branch --show-current)
  [ -n "$branch" ] || fail "git is not on a branch. Check out main first."
  if [ "$branch" != main ]; then
    say "You are on the branch '$branch'. The Mini follows main, so this will not reach the screen."
    ask "Push '$branch' anyway?" no || fail "switch to main first (git checkout main)."
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
    if [ -z "$message" ]; then
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
    say "(an edit made on github.com, for example). Nothing was forced. Run:"
    say "  cd $repo && git pull --no-rebase"
    say "then fix any conflict it reports, and run this again."
    fail "the push did not go through."
  fi
  finished="$finished commit and push,"
}

# Step 3: the Studio's own page on sanity.io. Editors see new fields after this.
update_studio() {
  step "Updating the Studio"
  if [ "$dry_run" = no ] && [ ! -d "$repo/studio/node_modules" ]; then
    fail "the Studio's packages are not installed. Run once: cd $repo/studio && npm install"
  fi

  say "If it asks you to log in, stop it, run 'npx sanity login' in the studio folder, and start again."
  if ! (cd "$repo/studio" && run npm run deploy); then
    fail "the Studio did not deploy. The lines above say why. If it is a login, run: cd $repo/studio && npx sanity login"
  fi
  finished="$finished Studio,"
}

# Step 4: the Mini pulls the repository, as its own user. The pull is run
# without sudo on purpose: a pull run as root leaves root-owned files in the
# repository, and the Mini's own timer (which runs as hawktimus) could then
# no longer update them. Only the restart needs sudo, and ssh -t lets sudo ask
# for the password here in this window.
update_mini() {
  local restart=$1
  step "Updating the Mini ($MINI_ADDRESS)"

  # What GitHub has now, so the Mini can be compared with it afterwards
  local branch expected
  branch=$(git -C "$repo" branch --show-current)
  expected=$(git -C "$repo" ls-remote origin "refs/heads/$branch" 2>/dev/null | cut -f1)

  local restart_line=''
  if [ "$restart" = yes ]; then
    restart_line="echo 'Restarting the screen. It is black for about ten seconds.'; sudo systemctl restart $MINI_KIOSK"
  fi

  local remote
  remote=$(cat <<EOF
set -e
$MINI_REPO/deploy/scripts/pull.sh
now=\$(git -C $MINI_REPO rev-parse HEAD)
echo "The Mini is at \$(echo "\$now" | cut -c1-7)."
if [ -n "$expected" ] && [ "\$now" != "$expected" ]; then
  echo "That is not the commit on GitHub ($(printf '%s' "$expected" | cut -c1-7)). The pull may have stopped; see Recovering in docs/rebuilding-the-mini.md." >&2
  exit 1
fi
$restart_line
EOF
)

  if [ "$dry_run" = yes ]; then
    say "  [dry run] ssh -t -o ConnectTimeout=10 $MINI_ADDRESS '...'"
    say "$remote" | sed 's/^/            /'
    finished="$finished Mini pull,"
    return 0
  fi

  ssh -t -o ConnectTimeout=10 "$MINI_ADDRESS" "$remote"
  local status=$?
  if [ "$status" = 255 ]; then
    fail "could not reach $MINI_ADDRESS. Is the Mini on, and on the same network as this Mac? You can use its IP address instead: MINI_ADDRESS=hawktimus@<ip address> deploy/mac/ship.sh"
  elif [ "$status" != 0 ]; then
    fail "the Mini reported a problem (exit $status). The lines above say what."
  fi

  if [ "$restart" = yes ]; then finished="$finished Mini pull and restart,"; else finished="$finished Mini pull,"; fi
}

# Only the restart, for a screen that looks wrong
restart_mini() {
  step "Restarting the screen on the Mini ($MINI_ADDRESS)"
  if [ "$dry_run" = yes ]; then
    say "  [dry run] ssh -t $MINI_ADDRESS sudo systemctl restart $MINI_KIOSK"
    finished="$finished restart,"
    return 0
  fi

  ssh -t -o ConnectTimeout=10 "$MINI_ADDRESS" "sudo systemctl restart $MINI_KIOSK"
  local status=$?
  if [ "$status" = 255 ]; then fail "could not reach $MINI_ADDRESS."; fi
  if [ "$status" != 0 ]; then fail "the restart failed (exit $status)."; fi
  finished="$finished restart,"
}

menu() {
  say "Ship Teletraan I"
  say ""
  say "  1  Everything: check, commit, push, update the Studio, Mini pulls"
  say "  2  Everything, then restart the screen on the Mini"
  say "  3  Commit and push only"
  say "  4  Update the Studio only"
  say "  5  Mini pulls only"
  say "  6  Restart the screen on the Mini only"
  say "  q  Quit"
  say ""
  local choice
  read -r -p "Choose: " choice
  case "$choice" in
    1) action=all ;;
    2) action=all-restart ;;
    3) action=push ;;
    4) action=studio ;;
    5) action=mini ;;
    6) action=restart ;;
    *) say "Nothing done."; exit 0 ;;
  esac
}

[ -n "$action" ] || menu
if [ "$dry_run" = yes ]; then say "Dry run: nothing below is really run."; fi

case "$action" in
  all)          run_checks; commit_and_push; update_studio; update_mini no ;;
  all-restart)  run_checks; commit_and_push; update_studio; update_mini yes ;;
  push)         run_checks; commit_and_push ;;
  studio)       update_studio ;;
  mini)         update_mini no ;;
  restart)      restart_mini ;;
  *)            fail "I do not know '$action'. Use all, all-restart, push, studio, mini or restart." ;;
esac

step "Finished"
say "Done:$finished" | sed 's/,$//'
say "The screen reloads itself within a minute of a pull."
