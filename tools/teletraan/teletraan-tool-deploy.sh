# Read by teletraan-tool, never run. Copying to the Teletraan computer, installing, status and restart.
# 1. Install everything: copy the repository to a staging folder on the Teletraan computer, let the installer there make
# it the next release, install the services and timers, and restart the screen, all in one run with one password.
# The installer (computer/install.sh) also does the one-time move to the releases layout, so this is the way in
# for a computer that has no control page yet, and for one whose page cannot be reached. The live tree is never
# written to: the releases keep the last five versions.
update_computer() {
  local status commit
  step "Update the Teletraan computer ($computer_name)"

  # An old tree would carry the old folders to the Teletraan computer
  if [ -d "$repo/deploy/scripts" ]; then
    problem "This copy is older than round 6; update it."
    return 1
  fi

  if [ ! -f "$repo/dashboard/index.html" ] || [ ! -f "$repo/computer/install.sh" ] || [ ! -f "$repo/control/server.js" ]; then
    problem "$repo does not look like the Teletraan repository, so nothing was copied."
    return 1
  fi

  say "This copies the files in this repository to $address:$COMPUTER_STAGING and runs the installer there as root. The installer"
  say "makes them the next release, builds the Studio, starts the containers and turns on the nightly timer. Then the services run:"
  say "calendars, slides, Monday, competition, boot and shutdown screens (/etc/issue), watchdog, backup and nightly restart."
  say "They install no packages. If one needs a package, it stops and says which, and the rest go on."
  say "The screen restarts at the end and is black for about ten seconds. The Teletraan computer keeps its local.env,"
  say "and the last five releases stay on it for a rollback (docs/control-page.md)."
  say "The password of the login user is asked once, only if the computer needs it."

  computer_run "true"
  status=$?
  if [ "$status" = 255 ]; then
    explain_failure "$status"
    return 1
  fi

  if [ "$assume_yes" = yes ]; then
    say "Going ahead (--yes)."
  else
    ask_yes "Go ahead?" yes || { say "Nothing was copied."; return "$declined_status"; }
  fi

  # Ask for the password before anything is copied, so a wrong one costs nothing
  ensure_sudo || return 1

  rsync -a --delete \
    --exclude .git --exclude local.env --exclude .env --exclude node_modules \
    --exclude .DS_Store --exclude studio/dist --exclude studio/.sanity --exclude _inputs --exclude _outputs \
    -e "ssh ${ssh_options[*]}" "$repo/" "$address:$COMPUTER_STAGING/"
  status=$?
  if [ "$status" -ne 0 ]; then
    explain_failure "$status"
    say "The staging folder may have some of the new files and not others. Run this again."
    return 1
  fi
  say "The files are copied."

  commit=$(git -C "$repo" rev-parse --short HEAD 2> /dev/null)
  printf '%s' "$commit" | grep -Eq '^[0-9a-f]{4,40}$' || commit=''
  if [ -z "$commit" ]; then
    say "This folder has no git history, so the release has no hash."
  fi

  computer_sudo "$(install_script)" "~/$COMPUTER_STAGING" "'$commit'" "$(quote_word "$COMPUTER_REPO/computer/scripts")" "$(quote_word "$COMPUTER_KIOSK")"
  status=$?
  if [ "$status" -ne 0 ]; then
    explain_failure "$status"
    say "The files are in the staging folder on the Teletraan computer. The lines above say which step stopped. $(words 'Choose 1' 'Run teletraan-tool update') to try again."
    return 1
  fi
  say "Done. The control page is at http://${address#*@}:3229/control/."
}

# Sends ~/.teletraan/secrets.env to the Teletraan computer and merges it into computer/local.env
# there. The values travel in a file with scp; the merge script and the file are
# copied to a private folder first so they land with fixed names, and are removed
# on the Teletraan computer when the merge is done.
send_to_computer() {
  local stage=$state_dir/stage status remote
  rm -rf "$stage"
  if ! mkdir -p "$stage" || ! chmod 700 "$stage" ||
    ! cp "$secrets_file" "$stage/teletraan-incoming.env" || ! cp "$here/merge-env.sh" "$stage/teletraan-merge.sh"; then
    rm -rf "$stage"
    problem "could not prepare the files to send."
    return 1
  fi

  scp -q "${ssh_options[@]}" "$stage/teletraan-incoming.env" "$stage/teletraan-merge.sh" "$address:"
  status=$?
  rm -rf "$stage"
  if [ "$status" -ne 0 ]; then
    problem "could not send the values to $address (exit $status). Nothing on the Teletraan computer changed."
    return 1
  fi

  remote="COMPUTER_REPO='$COMPUTER_REPO'
$(cat <<'EOF'
sh teletraan-merge.sh "$COMPUTER_REPO/computer/local.env" teletraan-incoming.env
status=$?
rm -f teletraan-merge.sh teletraan-incoming.env
exit "$status"
EOF
)"
  computer_run "$remote"
  status=$?
  if [ "$status" = 0 ]; then
    if computer_sudo 'systemctl start teletraan-calendars.service'; then
      say "The calendar service ran once, so the Calendars page in Studio is up to date."
    else
      say "The calendar service did not run. If it is not installed on this computer, run the install again (Install everything)."
    fi
  fi
  if [ "$status" -ne 0 ]; then
    explain_failure "$status"
    say "The values are saved on this Mac. Choose 3, then 1, and save again when the Teletraan computer can be reached."
    return 1
  fi
  return 0
}

# Copy what the Teletraan computer holds to this Mac, for a second computer
pull_from_computer() {
  local raw=$state_dir/pulled.tmp status names
  step "Copy the Teletraan computer's keys and calendars to this Mac"
  say "This replaces the values saved on this Mac with the ones in computer/local.env on the Teletraan computer. Nothing is printed."
  ask_yes "Go ahead?" no || { say "Nothing changed."; return 0; }

  names='SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|GOOGLE_API_KEY|CALENDAR_[A-Za-z0-9_]+_URL'
  (umask 077; computer_run "grep -E '^($names)=' '$COMPUTER_REPO/computer/local.env'" > "$raw")
  status=$?
  if [ "$status" = 255 ]; then
    rm -f "$raw"
    explain_failure "$status"
    return 1
  fi
  if [ "$status" -ne 0 ]; then
    rm -f "$raw"
    say "The Teletraan computer has no keys or calendar links in its local.env, or the file could not be read. Nothing changed."
    return 1
  fi

  local line
  reset_secrets
  skipped=''
  while IFS= read -r line || [ -n "$line" ]; do
    take_line "$line"
  done < "$raw"
  rm -f "$raw"
  forget_cleared

  if ! write_secrets; then
    problem "could not save $secrets_file."
    return 1
  fi
  say "Saved in $secrets_file:"
  show_keys
  show_calendars
  if [ -n "$skipped" ]; then
    say "These lines on the Teletraan computer did not look like a key or a link and were left out:$skipped"
  fi
}

# The text that runs on the Teletraan computer as root. $1 is the staging folder, $2 the commit hash (may be empty),
# $3 the folder of the install scripts and $4 the name of the screen service. Each install script waits for Enter, so it
# is given one. A script that stops is named at the end and the loop goes on.
install_script() {
  cat <<'EOF'
stage=$1; commit=$2; dir=$3; kiosk=$4
echo "== the installer"
bash "$stage/computer/install.sh" --from "$stage" --yes --note "From the Mac tool" ${commit:+--commit "$commit"} || exit $?
stopped=''
for name in calendars slides photos-drive monday frc console watchdog backup nightly; do
  echo
  echo "== install-$name.sh"
  echo | "$dir/install-$name.sh" || { echo "install-$name.sh stopped (exit $?)."; stopped="$stopped $name"; }
done
echo
echo "== the screen"
systemctl restart "$kiosk" || exit $?
[ -z "$stopped" ] || { echo "These did not install:$stopped. The lines above say why."; exit 1; }
EOF
}

# What the Teletraan computer last did, and what the screen does with each calendar
computer_status() {
  local status result=0
  step "Status of the Teletraan computer $computer_name"
  computer_run "$COMPUTER_REPO/computer/scripts/status-write.sh --print" 2>&1 | hide_secrets
  status=${PIPESTATUS[0]}
  if [ "$status" = 255 ]; then
    explain_failure "$status"
    return 1
  elif [ "$status" = 2 ]; then
    say "The Teletraan computer has an older status-write.sh. $(words 'Choose 1 to update it.' 'Run teletraan-tool update.')"
    result=1
  elif [ "$status" -ne 0 ]; then
    result=1
  fi

  say ""
  say "Calendars:"
  computer_run "$COMPUTER_REPO/computer/scripts/check-calendars.sh" 2>&1 | hide_secrets
  if [ "${PIPESTATUS[0]}" = 255 ]; then
    explain_failure 255
    return 1
  fi
  return "$result"
}

# Restart the browser that fills the TV
restart_screen() {
  local status
  step "Restart the screen on the Teletraan computer $computer_name"
  computer_sudo 'systemctl restart "$1"' "$(quote_word "$COMPUTER_KIOSK")"
  status=$?
  if [ "$status" -ne 0 ]; then
    explain_failure "$status"
    return 1
  fi
  say "The screen restarted. It is black for about ten seconds."
}
