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

# One ssh connection for the whole run. The first login (and its password, when the computer asks for one) happens
# once, and every later ssh, scp and rsync rides on it. The socket lives in a private folder made at the start of
# the run and removed at the end. ssh_options is always set, so a test that loads the functions can call ssh.
ssh_options=(-o ConnectTimeout=10)
session_dir=''

session_open() {
  # A short base path, because a socket path longer than about 100 characters does not work
  session_dir=$(mktemp -d "${TELETRAAN_SESSION_BASE:-/tmp}/tt.XXXXXX" 2> /dev/null) || return 0
  chmod 700 "$session_dir"
  ssh_options=(-o ConnectTimeout=10 -o ControlMaster=auto -o ControlPersist=300 -o "ControlPath=$session_dir/%C")
}

session_close() {
  local i=0
  sudo_password=''
  sudo_mode=''
  if [ -n "$session_dir" ] && [ -d "$session_dir" ]; then
    [ -z "$address" ] || ssh -O exit "${ssh_options[@]}" "$address" > /dev/null 2>&1
    while [ "$i" -lt "$computer_count" ]; do
      ssh -O exit "${ssh_options[@]}" "${computer_addresses[$i]}" > /dev/null 2>&1
      i=$((i + 1))
    done
    rm -rf "$session_dir"
  fi
  session_dir=''
}

# Runs one command on the Teletraan computer. A first word of -t gives the command a terminal.
# Without it ssh gets no input (-n), so it cannot take the next lines of the menu for itself.
computer_run() {
  if [ "$1" = -t ]; then
    ssh -t "${ssh_options[@]}" "$address" "$2"
  else
    ssh -n "${ssh_options[@]}" "$address" "$1"
  fi
}

# The password of the login user on the Teletraan computer, asked once for the whole run. It is held in this
# variable only: it goes to the computer through the input of ssh, never on a command line and never in a file.
# sudo_mode is empty before the first question, none when sudo needs no password, password after one was accepted.
sudo_password=''
sudo_mode=''

ensure_sudo() {
  local status
  [ -z "$sudo_mode" ] || return 0
  computer_run "sudo -n true" > /dev/null 2>&1
  status=$?
  if [ "$status" = 0 ]; then
    sudo_mode=none
    return 0
  fi
  if [ "$status" = 255 ]; then
    explain_failure 255
    return 1
  fi
  prompt_hidden "Password of $address for the changes that need it. It is asked once and the typing is hidden: "
  sudo_password=$answer
  answer=''
  if [ -n "$sudo_password" ] && printf '%s\n' "$sudo_password" | ssh "${ssh_options[@]}" "$address" "sudo -S -p '' -v" > /dev/null 2>&1; then
    sudo_mode=password
    return 0
  fi
  sudo_password=''
  say "That password was wrong. Choose the same thing again to try another."
  return 1
}

# Puts single quotes around text so the shell on the other side takes it as one word
quote_word() {
  local text=$1 quote="'"
  printf "'%s'" "${text//$quote/$quote\\$quote$quote}"
}

# Runs a script on the Teletraan computer as root, in one remote shell, so a run of many steps asks for the
# password once. The words after the script become $1, $2 and so on in it; they are given as the other side
# should read them (for example "$HOME/staging"). The script's own input is empty.
computer_sudo() {
  local script=$1 remote
  shift
  ensure_sudo || return 1
  remote="sudo -S -p '' bash -c $(quote_word "$script") bash $*"
  if [ "$sudo_mode" = password ]; then
    printf '%s\n' "$sudo_password" | ssh "${ssh_options[@]}" "$address" "$remote"
  else
    ssh -n "${ssh_options[@]}" "$address" "$remote"
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
  if ssh -n "${ssh_options[@]}" "$1" true; then
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
