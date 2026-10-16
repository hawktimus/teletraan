# Read by teletraan-tool, never run. Printing, asking and checking what was typed.
say() { printf '%s\n' "$*"; }

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

problem() { printf '\nStopped: %s\n' "$*" >&2; }

# The menu ends quietly when the input does, so a closed terminal cannot loop. A
# command has nobody to ask, so it stops, and says why.
input_ended() {
  printf '\n'
  if [ "$command_mode" = yes ]; then
    problem "a question needed an answer and none came, so nothing more was done."
    exit 1
  fi
  exit 0
}

# Asks a question and reads one line into $answer
prompt() {
  printf '%s' "$1"
  IFS= read -r answer || input_ended
}

# The same, with the typing hidden, for a key or a link
prompt_hidden() {
  printf '%s' "$1"
  IFS= read -rs answer || input_ended
  printf '\n'
}

# The second word is the answer for pressing Return, so a risky question can
# default to no.
ask_yes() {
  local reply
  if [ "$2" = yes ]; then prompt "$1 [Y/n] "; else prompt "$1 [y/N] "; fi
  reply=$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')
  [ -n "$reply" ] || reply=$2
  [ "$reply" = y ] || [ "$reply" = yes ]
}

# A hint names another step as a menu choice in the menu and as a command word on
# the command line
words() {
  if [ "$command_mode" = yes ]; then printf '%s' "$2"; else printf '%s' "$1"; fi
}

# The first 4 characters, then dots. A value too short to show 4 characters of
# safely is all dots, and a placeholder or nothing is "not set".
mask() {
  local value=$1
  case $value in
    ''|'['*) printf 'not set'; return 0 ;;
  esac
  if [ "${#value}" -ge 12 ]; then
    printf '%s........' "${value:0:4}"
  else
    printf '........'
  fi
}

# Checks a key. The reason never holds the key.
check_key() {
  clean_value=$1
  clean_reason=''
  if ! printf '%s' "$clean_value" | grep -Eq "$key_pattern"; then
    clean_reason='A key has letters, digits, dots, dashes and underscores only, with nothing else on the line.'
    return 1
  fi
  return 0
}

# Checks a calendar link. On success clean_value is the link to store, and a
# webcal:// link has become an https:// one. The reason never holds the link.
check_link() {
  clean_value=$1
  clean_reason=''
  case $clean_value in
    webcal://*) clean_value="https://${clean_value#webcal://}" ;;
    http://*)
      clean_reason='The link starts with http://, which is not secure. Use the https:// link.'
      return 1
      ;;
  esac
  case $clean_value in
    https://*) ;;
    *)
      clean_reason='A calendar link starts with https:// or webcal://.'
      return 1
      ;;
  esac
  if ! printf '%s' "$clean_value" | grep -Eq "$link_pattern"; then
    clean_reason='The link has a space, a quote or another character a calendar link does not have.'
    return 1
  fi
  return 0
}
