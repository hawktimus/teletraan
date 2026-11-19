#!/bin/bash
# Puts a looping clip behind a Lo-Fi Radio channel, and writes down where the clip came from and what it is licensed under.
#
#   lofi-scene.sh <channel> <video file> <where it came from> <licence> [author]
#
#   lofi-scene.sh 08-citypop ~/Downloads/night-street.mp4 https://pexels.com/video/... "Pexels licence" "Name of the artist"
#
# <channel> is the start of a file in ~/RetroPie/lofi (01-lofi-beats, 08-citypop). The clip is cut to the screen
# (1920x1080, 30 pictures a second), made without sound and written to /opt/retropie/configs/lofi/scenes/<channel>.mp4, which
# the radio plays over and over with the sound of the stream. The picture that EmulationStation shows for the channel
# is taken from it. The scene it replaces is kept once, in scenes/before/.
#
# It will not run without a source and a licence: a clip nobody can account for is not put on the TV. Download from a
# site that says what may be done with the clip (Pexels, Pixabay with "AI generated" switched off, the Internet Archive,
# Wikimedia Commons), and write down that licence. Not from YouTube. computer/pi/README.md, "Lo-Fi".
set -eu

lofi=/opt/retropie/configs/lofi
roms=${LOFI_ROMS:-$HOME/RetroPie/lofi}
channel=${1:-}
clip=${2:-}
source_url=${3:-}
licence=${4:-}
author=${5:-}

[ -n "$channel" ] && [ -n "$clip" ] && [ -n "$source_url" ] && [ -n "$licence" ] || {
  echo "Usage: $0 <channel> <video file> <where it came from> <licence> [author]" >&2
  exit 1
}
[ -f "$clip" ] || { echo "Stopped: $clip is not a file." >&2; exit 1; }
[ -f "$roms/$channel.radio" ] || { echo "Stopped: $roms/$channel.radio is not a channel. The channels are:" >&2; ls "$roms" | sed -n 's/\.radio$//p' >&2; exit 1; }
for tool in ffmpeg ffprobe; do command -v "$tool" > /dev/null 2>&1 || { echo "Stopped: $tool is not installed." >&2; exit 1; }; done
ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$clip" | grep -q '^[0-9]' || { echo "Stopped: $clip has no picture." >&2; exit 1; }

mkdir -p "$lofi/scenes/before"
scene=$lofi/scenes/$channel.mp4
[ -f "$lofi/scenes/before/$channel.mp4" ] || { [ ! -f "$scene" ] || cp -p "$scene" "$lofi/scenes/before/$channel.mp4"; }

# Made beside the old one and moved into place when it is whole, so a stop half way leaves the old scene
ffmpeg -v error -y -i "$clip" -an \
  -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30" \
  -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  "$scene.new.mp4"
mv -f "$scene.new.mp4" "$scene"

mkdir -p "$roms/media"
ffmpeg -v error -y -ss 2 -i "$scene" -frames:v 1 -vf scale=640:360 "$roms/media/$channel.jpg"

printf '%s\t%s\t%s\t%s\t%s\n' "$channel" "$(date +%Y-%m-%d)" "$licence" "$source_url" "$author" >> "$lofi/scenes/LICENCES.tsv"
echo "Done: $scene ($(du -h "$scene" | cut -f1)). Written down in $lofi/scenes/LICENCES.tsv."
