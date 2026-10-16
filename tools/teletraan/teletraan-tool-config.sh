# Read by teletraan-tool, never run. The saved computers, and the connection to the one in use.
load_config() {
  local key value
  computer_names=()
  computer_addresses=()
  computer_count=0
  current_name=''
  [ -f "$config_file" ] || return 0
  while IFS='=' read -r key value || [ -n "$key" ]; do
    case $key in
      current) current_name=$value ;;
      mini.*)
        if printf '%s' "${key#mini.}" | grep -Eq "$name_pattern" && printf '%s' "$value" | grep -Eq "$address_pattern"; then
          computer_names[$computer_count]=${key#mini.}
          computer_addresses[$computer_count]=$value
          computer_count=$((computer_count + 1))
        fi
        ;;
    esac
  done < "$config_file"
  return 0
}

save_config() {
  local temp=$config_file.new i=0
  {
    printf '# Written by tools/teletraan/teletraan-tool. One mini.NAME=user@host line for each computer.\n'
    printf 'current=%s\n' "$current_name"
    while [ "$i" -lt "$computer_count" ]; do
      printf 'mini.%s=%s\n' "${computer_names[$i]}" "${computer_addresses[$i]}"
      i=$((i + 1))
    done
  } > "$temp" && chmod 600 "$temp" && mv -f "$temp" "$config_file"
}

use_computer() {
  computer_name=${computer_names[$1]}
  address=${computer_addresses[$1]}
  current_name=$computer_name
}

# Runs one command on the Teletraan computer. A first word of -t gives the command a terminal,
# which sudo needs to ask for the password here in this window. Without it ssh
# gets no input (-n), so it cannot take the next lines of the menu for itself.
computer_run() {
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
    problem "could not reach $address. Is the Teletraan computer on, and is this Mac on its network or on Tailscale?"
  else
    problem "the Teletraan computer reported a problem (exit $1). The lines above say what."
  fi
}

check_ssh() {
  say "Checking that ssh works..."
  if ssh -n -o ConnectTimeout=10 "$1" true; then
    say "Connected."
    return 0
  fi
  problem "could not connect to $1 with ssh. Check the address, that the Teletraan computer is on, and that this Mac is on its network or on Tailscale. Nothing was saved."
  return 1
}

add_computer() {
  local new_address new_name suggestion=main i=0
  say "Type the Teletraan computer's address as user@host. A Tailscale name works from anywhere, for example hawktimus@teletraan."
  prompt "Address: "
  new_address=$answer
  if ! printf '%s' "$new_address" | grep -Eq "$address_pattern"; then
    problem "that is not an address like user@host."
    return 1
  fi
  check_ssh "$new_address" || return 1

  if [ "$computer_count" -gt 0 ]; then suggestion=spare; fi
  prompt "A short name for this computer [$suggestion]: "
  new_name=$answer
  [ -n "$new_name" ] || new_name=$suggestion
  if ! printf '%s' "$new_name" | grep -Eq "$name_pattern"; then
    problem "a name has lowercase letters, digits, dashes and underscores, up to 20 characters."
    return 1
  fi
  while [ "$i" -lt "$computer_count" ]; do
    if [ "${computer_names[$i]}" = "$new_name" ]; then
      problem "there is a computer called $new_name already. Pick another name."
      return 1
    fi
    i=$((i + 1))
  done

  computer_names[$computer_count]=$new_name
  computer_addresses[$computer_count]=$new_address
  computer_count=$((computer_count + 1))
  use_computer $((computer_count - 1))
  save_config || { problem "could not save $config_file."; return 1; }
  say "Saved. The Teletraan computer in use is $computer_name."
}

first_run() {
  step "First run"
  say "This tool needs to know where the Teletraan computer is. The address is saved in $config_file, which is not part of the repository."
  while ! add_computer; do
    ask_yes "Try again?" yes || return 1
  done
}

choose_computer() {
  local i=0 marker
  step "Choose a computer"
  while [ "$i" -lt "$computer_count" ]; do
    marker=''
    if [ "${computer_names[$i]}" = "$computer_name" ]; then marker='  (in use)'; fi
    printf '  %s  %s (%s)%s\n' "$((i + 1))" "${computer_names[$i]}" "${computer_addresses[$i]}" "$marker"
    i=$((i + 1))
  done
  say "  a  Add another computer"
  prompt "Choose, or press Return to stay with $computer_name: "
  case $answer in
    '') ;;
    a|A) add_computer ;;
    *[!0-9]*) say "That is not one of the choices." ;;
    *)
      if [ "$answer" -ge 1 ] && [ "$answer" -le "$computer_count" ]; then
        use_computer $((answer - 1))
        save_config || problem "could not save $config_file."
        say "The Teletraan computer in use is $computer_name."
      else
        say "That is not one of the choices."
      fi
      ;;
  esac
}
