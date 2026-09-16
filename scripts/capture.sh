#!/usr/bin/env bash
# Capture omaPi running in a real pi session: a still PNG and an animated GIF
# of the boot sequence. Needs Hyprland + foot + grim + ffmpeg + magick.
#
#   scripts/capture.sh [theme]
#
# Notes:
# - The window is found by app-id, because pi rewrites the terminal title.
# - Runtime window rules are skipped: Hyprland's Lua config rejects
#   `hyprctl keyword`, so the window tiles where it lands and only its own
#   rectangle is captured.
# - Geometry is resolved once per phase; calling hyprctl per frame costs more
#   than grim itself and starves the capture rate.
# - Windows are closed by killing the process this script started, never with
#   `hl.dsp.window.close("address:...")`: if that address has already gone,
#   Hyprland closes the FOCUSED window instead, which is somebody else's.

set -euo pipefail

THEME="${1:-omapi-famicom}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$ROOT/.capture"
OUT="$ROOT/docs"
PI="${PI_BIN:-$HOME/.local/bin/pi}"
APP_ID="omapi-capture"
SOCKET="/tmp/omapi-capture.sock"
GIF_FRAMES=75

rm -rf "$WORK"
mkdir -p "$WORK" "$OUT"

TERM_PID=""

launch() {
	local frame_ms="$1"
	# kitty, not the default terminal: it takes a reliable opaque background on
	# the command line, so the wallpaper cannot bleed into the screenshot, and
	# its remote control lets us trigger the animation instead of racing it.
	kitty --class="$APP_ID" -o background_opacity=1.0 -o window_padding_width=12 \
		-o allow_remote_control=yes --listen-on "unix:$SOCKET" \
		bash -lc "cd '$ROOT' && OMAPI_FRAME_MS=$frame_ms '$PI' --use-theme '$THEME'" \
		>/dev/null 2>&1 &
	TERM_PID=$!
}

# Type a slash command into the running pi session.
send() {
	kitty @ --to "unix:$SOCKET" send-text "$1"$'\r' >/dev/null 2>&1
}

client_field() {
	hyprctl clients -j | python3 -c '
import json, sys
field, app_id = sys.argv[1], sys.argv[2]
for client in json.load(sys.stdin):
    if client["class"] == app_id:
        if field == "geometry":
            x, y = client["at"]
            w, h = client["size"]
            print(f"{x},{y} {w}x{h}")
        else:
            print(client[field])
        break
' "$1" "$APP_ID"
}

window_count() {
	hyprctl clients -j | python3 -c '
import json, sys
print(sum(1 for client in json.load(sys.stdin) if client["class"] == sys.argv[1]))
' "$APP_ID"
}

wait_for_window() {
	for _ in $(seq 1 60); do
		local geometry
		geometry="$(client_field geometry)"
		if [ -n "$geometry" ]; then
			echo "$geometry"
			return 0
		fi
		sleep 0.2
	done
	echo "capture window (app-id $APP_ID) not found" >&2
	return 1
}

# Kill the terminal this script started and wait until its window is gone. A
# window left behind from an earlier run would be picked up first by
# client_field and screenshotted instead of the fresh one.
close() {
	# Kill the window's own process (reported by Hyprland) as well as the job we
	# started: the terminal may re-exec itself, leaving the job PID stale.
	local window_pid
	window_pid="$(client_field pid)"
	[ -n "$window_pid" ] && kill "$window_pid" 2>/dev/null
	if [ -n "$TERM_PID" ]; then
		kill "$TERM_PID" 2>/dev/null || true
		wait "$TERM_PID" 2>/dev/null || true
	fi
	TERM_PID=""
	for _ in $(seq 1 15); do
		[ "$(window_count)" = "0" ] && return 0
		sleep 0.4
	done
	echo "a capture window from an earlier run is still open; close it first" >&2
	return 1
}

trap close EXIT

if [ "$(window_count)" != "0" ]; then
	echo "a window with app-id $APP_ID is already open; close it first" >&2
	exit 1
fi

# --- still: let the boot animation settle first ---
launch 45
GEOMETRY="$(wait_for_window)"
# pi itself takes a couple of seconds to boot after the window appears.
sleep 7
grim -g "$GEOMETRY" "$WORK/still.png"
close
# Trim the empty transcript below the footer.
magick "$WORK/still.png" -crop "x340+0+0" +repage "$OUT/preview.png"

# --- animation: slowed down so grim resolves distinct frames. The replay is
# triggered over kitty's remote control once the capture loop is already
# running, so the take never races pi's startup ---
launch 100
GEOMETRY="$(wait_for_window)"
sleep 7
send "/omapi logo"
for index in $(seq -w 1 "$GIF_FRAMES"); do
	grim -g "$GEOMETRY" "$WORK/frame_${index}.png"
done
close

# mpdecimate drops the duplicate frames captured before and after the
# animation, so the GIF starts on the first scanline and ends when it settles.
ffmpeg -y -loglevel error -framerate 12 -pattern_type glob -i "$WORK/frame_*.png" \
	-vf "crop=in_w:340:0:0,mpdecimate=hi=64:lo=24:frac=0.0005,setpts=N/12/TB,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
	-loop 0 "$OUT/boot.gif"

echo "still: $OUT/preview.png"
echo "gif:   $OUT/boot.gif"
