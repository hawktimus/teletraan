# Read by teletraan-mini, never run. Copying to the Mini, installing, status and restart.
# 1. Copy the repository to a staging folder on the Mini and let the installer there make it the next release.
# The installer (mini/install.sh) also does the one-time move to the releases layout, so this is the way in
# for a Mini that has no control page yet, and for one whose page cannot be reached. The live tree is never
# written to: the releases keep the last five versions.
update_mini() {
  local status commit
  step "Update the Mini ($mini_name)"

  # An old tree would carry the old folders to the Mini
  if [ -d "$repo/deploy/scripts" ]; then
    problem "This copy is older than round 6; update it."
    return 1
  fi

  if [ ! -f "$repo/dashboard/index.html" ] || [ ! -f "$repo/mini/install.sh" ] || [ ! -f "$repo/control/server.js" ]; then
    problem "$repo does not look like the Teletraan repository, so nothing was copied."
    return 1
  fi

  say "This copies the files in this repository to $address:$MINI_STAGING and runs the installer there with sudo."
  say "The installer makes them the next release, builds the Studio and restarts the screen, which is black for about ten seconds."
  say "The Mini keeps its local.env, and the last five releases stay on it for a rollback (docs/control-page.md)."

  mini_run "true"
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

  rsync -a --delete \
    --exclude .git --exclude local.env --exclude .env --exclude node_modules \
    --exclude .DS_Store --exclude studio/dist --exclude studio/.sanity --exclude _inputs --exclude _outputs \
    -e "ssh -o ConnectTimeout=10" "$repo/" "$address:$MINI_STAGING/"
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

  mini_run -t "sudo bash ~/$MINI_STAGING/mini/install.sh --from ~/$MINI_STAGING --yes --note 'From the Mac tool'${commit:+ --commit $commit}"
  status=$?
  if [ "$status" -ne 0 ]; then
    explain_failure "$status"
    say "The files are in the staging folder on the Mini. The lines above say which step stopped. $(words 'Choose 1' 'Run teletraan-mini update') to try again."
    return 1
  fi
  say "Done. The control page is at http://${address#*@}:3229/control/."
}

# Sends ~/.teletraan/secrets.env to the Mini and merges it into mini/local.env
# there. The values travel in a file with scp; the merge script and the file are
# copied to a private folder first so they land with fixed names, and are removed
# on the Mini when the merge is done.
send_to_mini() {
  local stage=$state_dir/stage status remote
  rm -rf "$stage"
  if ! mkdir -p "$stage" || ! chmod 700 "$stage" ||
    ! cp "$secrets_file" "$stage/teletraan-incoming.env" || ! cp "$here/merge-env.sh" "$stage/teletraan-merge.sh"; then
    rm -rf "$stage"
    problem "could not prepare the files to send."
    return 1
  fi

  scp -q -o ConnectTimeout=10 "$stage/teletraan-incoming.env" "$stage/teletraan-merge.sh" "$address:"
  status=$?
  rm -rf "$stage"
  if [ "$status" -ne 0 ]; then
    problem "could not send the values to $address (exit $status). Nothing on the Mini changed."
    return 1
  fi

  remote="MINI_REPO='$MINI_REPO'
$(cat <<'EOF'
sh teletraan-merge.sh "$MINI_REPO/mini/local.env" teletraan-incoming.env
status=$?
rm -f teletraan-merge.sh teletraan-incoming.env
[ "$status" -eq 0 ] || exit "$status"
if sudo systemctl start teletraan-calendars.service; then
  echo "The calendar service ran once, so the Calendars page in Studio is up to date."
else
  echo "The calendar service did not run. If it is not installed on this Mini, choose 4 in the menu."
fi
EOF
)"
  mini_run -t "$remote"
  status=$?
  if [ "$status" -ne 0 ]; then
    explain_failure "$status"
    say "The values are saved on this Mac. Choose 2 and save again when the Mini can be reached."
    return 1
  fi
  return 0
}

# 3. Copy what the Mini holds to this Mac, for a second computer
pull_from_mini() {
  local raw=$state_dir/pulled.tmp status names
  step "Copy the Mini's keys and calendars to this Mac"
  say "This replaces the values saved on this Mac with the ones in mini/local.env on the Mini. Nothing is printed."
  ask_yes "Go ahead?" no || { say "Nothing changed."; return 0; }

  names='SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|CONTROL_PIN|CALENDAR_[A-Za-z0-9_]+_URL'
  (umask 077; mini_run "grep -E '^($names)=' '$MINI_REPO/mini/local.env'" > "$raw")
  status=$?
  if [ "$status" = 255 ]; then
    rm -f "$raw"
    explain_failure "$status"
    return 1
  fi
  if [ "$status" -ne 0 ]; then
    rm -f "$raw"
    say "The Mini has no keys or calendar links in its local.env, or the file could not be read. Nothing changed."
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
    say "These lines on the Mini did not look like a key or a link and were left out:$skipped"
  fi
}

# 4. The install scripts on the Mini
install_services() {
  local status remote
  step "Install the services on the Mini $mini_name"
  say "This runs install-calendars.sh, install-slides.sh, install-monday.sh, install-frc.sh, install-console.sh, install-watchdog.sh, install-backup.sh and install-nightly.sh on the Mini. They turn on the timers (the watchdog, the nightly backup and the nightly restart too) and the boot and shutdown screens, and install no packages."
  say "Each one says what it will do and waits for Enter. install-console.sh changes /etc/issue, and a missing package stops its script with the apt line to run."
  ask_yes "Has the team mentor said yes?" no || { say "Nothing was installed."; return 0; }

  remote="dir='$MINI_REPO/mini/scripts'
$(cat <<'EOF'
for name in calendars slides monday frc console watchdog backup nightly; do
  echo
  echo "== install-$name.sh"
  sudo "$dir/install-$name.sh" || echo "install-$name.sh stopped (exit $?)."
done
EOF
)"
  mini_run -t "$remote"
  status=$?
  if [ "$status" -ne 0 ]; then
    explain_failure "$status"
    return 1
  fi
}

# 5. What the Mini last did, and what the screen does with each calendar
mini_status() {
  local status result=0
  step "Status of the Mini $mini_name"
  mini_run "$MINI_REPO/mini/scripts/status-write.sh --print" 2>&1 | hide_secrets
  status=${PIPESTATUS[0]}
  if [ "$status" = 255 ]; then
    explain_failure "$status"
    return 1
  elif [ "$status" = 2 ]; then
    say "The Mini has an older status-write.sh. $(words 'Choose 1 to update it.' 'Run teletraan-mini update.')"
    result=1
  elif [ "$status" -ne 0 ]; then
    result=1
  fi

  say ""
  say "Calendars:"
  mini_run "$MINI_REPO/mini/scripts/check-calendars.sh" 2>&1 | hide_secrets
  if [ "${PIPESTATUS[0]}" = 255 ]; then
    explain_failure 255
    return 1
  fi
  return "$result"
}

# 6. Restart the browser that fills the TV
restart_screen() {
  local status
  step "Restart the screen on the Mini $mini_name"
  mini_run -t "sudo systemctl restart $MINI_KIOSK"
  status=$?
  if [ "$status" -ne 0 ]; then
    explain_failure "$status"
    return 1
  fi
  say "The screen restarted. It is black for about ten seconds."
}
