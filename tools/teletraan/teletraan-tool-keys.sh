# Read by teletraan-tool, never run. The menus for keys, calendar links and the PIN.
show_keys() {
  local i=0
  while [ "$i" -lt "$form_key_count" ]; do
    case ${key_states[$i]} in
      1) printf '  %-24s %s\n' "${key_labels[$i]}" "$(mask "${key_values[$i]}")" ;;
      2) printf '  %-24s %s\n' "${key_labels[$i]}" "cleared, not sent yet" ;;
      *) printf '  %-24s %s\n' "${key_labels[$i]}" "not set" ;;
    esac
    i=$((i + 1))
  done
}

note_change() {
  change_notes[$change_count]=$1
  change_count=$((change_count + 1))
}

edit_key() {
  local i=$1
  say ""
  say "${key_labels[$i]} (${key_names[$i]}) ${key_uses[$i]}."
  case ${key_states[$i]} in
    1) say "  Now: $(mask "${key_values[$i]}")" ;;
    2) say "  Now: cleared, not sent yet" ;;
    *) say "  Now: not set" ;;
  esac
  if [ "${key_states[$i]}" = 0 ]; then
    prompt "  Add it? [e adds it, Return leaves it unset] "
  else
    prompt "  Edit, keep or clear? [e/k/c, Return keeps] "
  fi
  case $(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]') in
    e|edit)
      prompt_hidden "  New value (the typing is hidden): "
      if [ -z "$answer" ]; then
        say "  Nothing typed, so it is kept."
      elif [ "${key_names[$i]}" = CONTROL_PIN ] && ! printf '%s' "$answer" | grep -Eq '^[0-9]{6,12}$'; then
        say "  Not saved. A PIN is 6 to 12 digits. It is kept as it was."
      elif check_key "$answer"; then
        set_key "${key_names[$i]}" "$clean_value"
        say "  Now: $(mask "$clean_value")"
        note_change "${key_labels[$i]}: new value"
      else
        say "  Not saved. $clean_reason It is kept as it was."
      fi
      ;;
    c|clear)
      if [ "${key_states[$i]}" != 0 ]; then
        key_values[$i]=''
        key_states[$i]=2
        note_change "${key_labels[$i]}: cleared"
      fi
      say "  Cleared."
      ;;
    *) ;;
  esac
}

show_calendars() {
  local i=0 n=0
  visible=()
  while [ "$i" -lt "$cal_count" ]; do
    if [ -n "${cal_values[$i]}" ]; then
      visible[$n]=$i
      n=$((n + 1))
      printf '  %s  %-22s %s\n' "$n" "$(calendar_code "${cal_names[$i]}")" "$(mask "${cal_values[$i]}")"
    fi
    i=$((i + 1))
  done
  visible_count=$n
  if [ "$n" = 0 ]; then say "  No calendars yet."; fi
}

# Asks for a link until it can be used, or until nothing is typed. Sets
# clean_value, and returns 1 when nothing was typed.
ask_link() {
  while true; do
    prompt_hidden "  Link (https:// or webcal://, the typing is hidden): "
    [ -n "$answer" ] || return 1
    if check_link "$answer"; then
      say "  Link: $(mask "$clean_value")"
      return 0
    fi
    say "  $clean_reason"
  done
}

ask_calendar_number() {
  prompt "  Which number? "
  case $answer in
    ''|*[!0-9]*) say "  That is not a number in the list."; return 1 ;;
  esac
  if [ "$answer" -lt 1 ] || [ "$answer" -gt "$visible_count" ]; then
    say "  That is not a number in the list."
    return 1
  fi
  return 0
}

edit_calendars() {
  local id place number name
  while true; do
    say ""
    say "Calendars: the name Studio uses, then the first 4 characters of the link."
    show_calendars
    prompt "Add, edit or remove one? [a/e/r, Return when done] "
    case $(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]') in
      a|add)
        prompt "  Name (such as team or build season): "
        id=$(calendar_id "$answer")
        if [ -z "$id" ] || [ "${#id}" -gt 20 ]; then
          say "  A name has letters and digits, up to 20 of them."
          continue
        fi
        place=$(find_calendar "$id")
        if [ -n "$place" ]; then
          say "  There is a calendar called $(calendar_code "$id") already. Its link will be replaced."
        fi
        if ask_link; then
          set_calendar "CALENDAR_${id}_URL" "$clean_value"
          note_change "calendar $(calendar_code "$id"): saved"
          say "  In Studio, Dashboard Settings, Calendars needs a row with the code $(calendar_code "$id") so the screen shows it."
        fi
        ;;
      e|edit)
        ask_calendar_number || continue
        number=$((answer - 1))
        place=${visible[$number]}
        name=$(calendar_code "${cal_names[$place]}")
        say "  Calendar $name"
        if ask_link; then
          cal_values[$place]=$clean_value
          note_change "calendar $name: new link"
        fi
        ;;
      r|remove)
        ask_calendar_number || continue
        number=$((answer - 1))
        place=${visible[$number]}
        name=$(calendar_code "${cal_names[$place]}")
        if ask_yes "  Remove the calendar $name?" no; then
          cal_values[$place]=''
          note_change "calendar $name: removed"
          say "  Removed. Take its row out of Dashboard Settings, Calendars in Studio too."
        fi
        ;;
      '') return 0 ;;
      *) say "  Type a, e or r, or press Return." ;;
    esac
  done
}

# 2. The form for the keys and the calendars
keys_and_calendars() {
  local i=0
  step "Keys and calendars for the Teletraan computer $computer_name"
  load_secrets
  change_notes=()
  change_count=0

  say "Each value is shown as its first 4 characters and dots. For a key, press e to edit it, k to keep it or c to clear it."
  say "A Mac that has no saved values yet should use choice 3 first, so the Teletraan computer's values are shown here."

  while [ "$i" -lt "$form_key_count" ]; do
    edit_key "$i"
    i=$((i + 1))
  done
  edit_calendars

  say ""
  if [ "$change_count" = 0 ]; then
    say "Nothing changed."
    ask_yes "Send the saved values to the Teletraan computer anyway?" no || return 0
  else
    say "Changes:"
    i=0
    while [ "$i" -lt "$change_count" ]; do
      say "  ${change_notes[$i]}"
      i=$((i + 1))
    done
    ask_yes "Save these on this Mac and send them to the Teletraan computer $computer_name?" yes || { say "Nothing was saved."; return 0; }
  fi

  if ! write_secrets; then
    problem "could not save $secrets_file."
    return 1
  fi
  say "Saved on this Mac in $secrets_file."
  send_to_computer || return 1
  forget_cleared
  write_secrets || problem "could not tidy $secrets_file."
  say "Done. The Teletraan computer has the new values."
}

# 8. The PIN of the control page. It travels like a key and is shown as dots.
set_pin() {
  local last=$((${#key_names[@]} - 1))
  step "PIN of the control page on the Teletraan computer $computer_name"
  load_secrets
  change_notes=()
  change_count=0
  edit_key "$last"
  if [ "$change_count" = 0 ]; then
    say "Nothing changed."
    return 0
  fi
  if ! write_secrets; then
    problem "could not save $secrets_file."
    return 1
  fi
  send_to_computer || return 1
  forget_cleared
  write_secrets || problem "could not tidy $secrets_file."
  say "Done. Open the control page and sign in with the PIN."
}
