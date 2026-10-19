# Reads an RSS feed on standard input and prints what news-sync.sh needs, one line for each
# thing: the word "item" when an item starts, then a word, a tab and a value for each of its
# title, link, pubDate, dc:date and category. Only the direct children of an item are read, so
# a CDATA block or an escaped description never gives a false title. The description and the
# article text are never printed.
#
# Plain awk on purpose: the Teletraan computer is only promised curl and jq, and this must run
# in mawk, gawk and the awk of a Mac. A number written as &#8217; or &#x2019; is not turned into
# bytes here, because awk differs on that. It is printed as a marker (\001d8217; or \001x2019;)
# and news-sync.sh turns the marker into the character with jq.

BEGIN {
  depth = 0
  items = 0
  max_items = 60
  named["nbsp"] = 32
  named["rsquo"] = 8217
  named["lsquo"] = 8216
  named["rdquo"] = 8221
  named["ldquo"] = 8220
  named["ndash"] = 8211
  named["mdash"] = 8212
  named["hellip"] = 8230
  named["copy"] = 169
  named["reg"] = 174
  named["trade"] = 8482
}

{ whole = whole " " $0 }

END {
  gsub(/\001/, " ", whole)
  gsub(/\r/, " ", whole)
  read_all(whole)
}

# Entities in text that is not CDATA. The five names XML defines become the character, a number
# or a known name becomes a marker, anything else is left as it was written.
function decode(s,   out, amp, semi, name) {
  out = ""
  while ((amp = index(s, "&")) > 0) {
    out = out substr(s, 1, amp - 1)
    s = substr(s, amp)
    semi = index(s, ";")
    if (semi == 0 || semi > 10) {
      out = out "&"
      s = substr(s, 2)
      continue
    }
    name = substr(s, 2, semi - 2)
    if (name == "amp") out = out "&"
    else if (name == "lt") out = out "<"
    else if (name == "gt") out = out ">"
    else if (name == "quot") out = out "\""
    else if (name == "apos") out = out "'"
    else if (name ~ /^#[0-9]+$/) out = out "\001d" substr(name, 2) ";"
    else if (name ~ /^#[xX][0-9A-Fa-f]+$/) out = out "\001x" substr(name, 3) ";"
    else if (name in named) out = out "\001d" named[name] ";"
    else out = out substr(s, 1, semi)
    s = substr(s, semi + 1)
  }
  return out s
}

function add_text(chunk) {
  if (depth > 0) texts[depth] = texts[depth] decode(chunk)
}

function add_raw(chunk) {
  if (depth > 0) texts[depth] = texts[depth] chunk
}

function open_element(name) {
  depth++
  names[depth] = name
  texts[depth] = ""
  if (name == "item") {
    items++
    print "item"
  }
}

function emit(name, value) {
  gsub(/[ \t\n]+/, " ", value)
  sub(/^ /, "", value)
  sub(/ $/, "", value)
  if (value != "") printf "%s\t%s\n", name, value
}

# Closes the nearest open element with this name. A closing tag with no open one is ignored.
function close_element(name,   at) {
  for (at = depth; at > 0; at--) {
    if (names[at] == name) break
  }
  if (at == 0) return
  depth = at
  if (depth > 1 && names[depth - 1] == "item") {
    if (name == "title" || name == "link" || name == "pubDate" || name == "dc:date" || name == "category") {
      emit(name, texts[depth])
    }
  }
  depth--
}

function handle_tag(tag,   closing, name) {
  closing = (substr(tag, 1, 1) == "/")
  if (closing) tag = substr(tag, 2)
  name = tag
  sub(/[ \t\n].*/, "", name)
  sub(/\/$/, "", name)
  if (closing) {
    close_element(name)
    return
  }
  open_element(name)
  if (substr(tag, length(tag), 1) == "/") close_element(name)
}

function read_all(s,   lt, gt, end, chunk) {
  while (items <= max_items) {
    lt = index(s, "<")
    if (lt == 0) break
    add_text(substr(s, 1, lt - 1))
    s = substr(s, lt)
    if (substr(s, 1, 9) == "<![CDATA[") {
      end = index(s, "]]>")
      if (end == 0) {
        chunk = substr(s, 10)
        s = ""
      } else {
        chunk = substr(s, 10, end - 10)
        s = substr(s, end + 3)
      }
      add_raw(chunk)
      continue
    }
    if (substr(s, 1, 4) == "<!--") {
      end = index(s, "-->")
      s = (end == 0) ? "" : substr(s, end + 3)
      continue
    }
    if (substr(s, 1, 2) == "<?") {
      end = index(s, "?>")
      s = (end == 0) ? "" : substr(s, end + 2)
      continue
    }
    gt = index(s, ">")
    if (gt == 0) break
    chunk = substr(s, 2, gt - 2)
    s = substr(s, gt + 1)
    if (substr(chunk, 1, 1) == "!") continue
    handle_tag(chunk)
  }
}
