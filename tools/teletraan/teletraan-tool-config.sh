# Read by teletraan-mini, never run. The saved Minis, and the connection to the one in use.
load_config() {
  local key value
  mini_names=()
  mini_addresses=()
  mini_count=0
  current_name=''
  [ -f "$config_file" ] || return 0
  while IFS='=' read -r key value || [ -n "$key" ]; do
    case $key in
      current) current_name=$value ;;
      mini.*)
        if printf '%s' "${key#mini.}" | grep -Eq "$name_pattern" && printf '%s' "$value" | grep -Eq "$address_pattern"; then
          mini_names[$mini_count]=${key#mini.}
          mini_addresses[$mini_count]=$value
          mini_count=$((mini_count + 1))
        fi
        ;;
    esac
  done < "$config_file"
  return 0
}

save_config() {
  local temp=$config_file.new i=0
  {
    printf '# Written by tools/mini/teletraan-mini. One mini.NAME=user@host line for each Mini.\n'
    printf 'current=%s\n' "$current_name"
    while [ "$i" -lt "$mini_count" ]; do
      printf 'mini.%s=%s\n' "${mini_names[$i]}" "${mini_addresses[$i]}"
      i=$((i + 1))
    done
  } > "$temp" && chmod 600 "$temp" && mv -f "$temp" "$config_file"
}

use_mini() {
  mini_name=${mini_names[$1]}
  address=${mini_addresses[$1]}
  current_name=$mini_name
}

# Runs one command on the Mini. A first word of -t gives the command a terminal,
# which sudo needs to ask for the password here in this window. Without it ssh
# gets no input (-n), so it cannot take the next lines of the menu for itself.
mini_run() {
  if [ "$1" = -t ]; then
    ssh -t -o ConnectTimeout=10 "$address" "$2"
  else
    ssh -n -o ConnectTimeout=10 "$address" "$1"
  fi
}

# A failed ssh, scp or rsync in plain words. 255 is ssh's own code for "could
# not connect".
explain_failure() {
  if [ "$1" = 255 ]; then
    problem "could not reach $address. Is the Mini on, and is this Mac on its network or on Tailscale?"
  else
    problem "the Mini reported a problem (exit $1). The lines above say what."
  fi
}

check_ssh() {
  say "Checking that ssh works..."
  if ssh -n -o ConnectTimeout=10 "$1" true; then
    say "Connected."
    return 0
  fi
  problem "could not connect to $1 with ssh. Check the address, that the Mini is on, and that this Mac is on its network or on Tailscale. Nothing was saved."
  return 1
}

add_mini() {
  local new_address new_name suggestion=main i=0
  say "Type the Mini's address as user@host. A Tailscale name works from anywhere, for example hawktimus@teletraan."
  prompt "Address: "
  new_address=$answer
  if ! printf '%s' "$new_address" | grep -Eq "$address_pattern"; then
    problem "that is not an address like user@host."
    return 1
  fi
  check_ssh "$new_address" || return 1

  if [ "$mini_count" -gt 0 ]; then suggestion=spare; fi
  prompt "A short name for this Mini [$suggestion]: "
  new_name=$answer
  [ -n "$new_name" ] || new_name=$suggestion
  if ! printf '%s' "$new_name" | grep -Eq "$name_pattern"; then
    problem "a name has lowercase letters, digits, dashes and underscores, up to 20 characters."
    return 1
  fi
  while [ "$i" -lt "$mini_count" ]; do
    if [ "${mini_names[$i]}" = "$new_name" ]; then
      problem "there is a Mini called $new_name already. Pick another name."
      return 1
    fi
    i=$((i + 1))
  done

  mini_names[$mini_count]=$new_name
  mini_addresses[$mini_count]=$new_address
  mini_count=$((mini_count + 1))
  use_mini $((mini_count - 1))
  save_config || { problem "could not save $config_file."; return 1; }
  say "Saved. The Mini in use is $mini_name."
}

first_run() {
  step "First run"
  say "This tool needs to know where the Mini is. The address is saved in $config_file, which is not part of the repository."
  while ! add_mini; do
    ask_yes "Try again?" yes || return 1
  done
}

choose_mini() {
  local i=0 marker
  step "Choose a Mini"
  while [ "$i" -lt "$mini_count" ]; do
    marker=''
    if [ "${mini_names[$i]}" = "$mini_name" ]; then marker='  (in use)'; fi
    printf '  %s  %s (%s)%s\n' "$((i + 1))" "${mini_names[$i]}" "${mini_addresses[$i]}" "$marker"
    i=$((i + 1))
  done
  say "  a  Add another Mini"
  prompt "Choose, or press Return to stay with $mini_name: "
  case $answer in
    '') ;;
    a|A) add_mini ;;
    *[!0-9]*) say "That is not one of the choices." ;;
    *)
      if [ "$answer" -ge 1 ] && [ "$answer" -le "$mini_count" ]; then
        use_mini $((answer - 1))
        save_config || problem "could not save $config_file."
        say "The Mini in use is $mini_name."
      else
        say "That is not one of the choices."
      fi
      ;;
  esac
}
