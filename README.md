# omaPi

An 8-bit, omarchy-native face for [pi](https://pi.dev).

![omaPi booting](https://raw.githubusercontent.com/matheusmedrado/omaPi/main/docs/boot.gif)

The boot sequence above, captured from a real session with `scripts/capture.sh`. Still frame:

![omaPi](https://raw.githubusercontent.com/matheusmedrado/omaPi/main/docs/preview.png)

```
   █▌    █▌
██████████████   ██████  ██  ██  ██████  ██████  ██████
   ██    ██      ██  ██  ██████  ██  ██  ██  ██    ██
   ██    ██      ██  ██  ██████  ██████  ██████    ██
   ██    ██      ██  ██  ██  ██  ██  ██  ██        ██
   ██    ██      ██████  ██  ██  ██  ██  ██      ██████
   ▀▀    ▀▀      ▀▀▀▀▀▀  ▀▀  ▀▀  ▀▀  ▀▀  ▀▀      ▀▀▀▀▀▀

オマパイ ▪ v0.1.0 ▪ inkypinky
```

- **Animated boot logo** — block mascot + pixel wordmark, revealed by a CRT scanline sweep, a dithered raster fill (`░▒▓█`), and a short glitch before it settles. Replay any time with `/omapi logo`.
- **Dense status strip** — model, thinking level, git branch, a dithered context meter, the active omarchy theme, plus statuses published by other extensions.
- **8-bit working indicator** — a dither pulse instead of the default spinner.
- **Three hand-tuned themes** — all 53 color tokens, syntax hues picked for separability rather than decoration.
- **Omarchy integration** — pi follows `omarchy theme set` live, and omaPi can install its own `pi.json` theme template so *every* omarchy theme generates an omaPi-grade pi theme.

Everything is drawn with block and box-drawing glyphs that ship in every monospace font. No Nerd Font glyphs, no emoji, no broken boxes.

## Install

```bash
pi install npm:pi-omapi
# or straight from the repo
pi install git:github.com/matheusmedrado/omaPi
```

Then restart pi. To try it for a single run without installing:

```bash
pi -e git:github.com/matheusmedrado/omaPi
```

## Themes

| Theme | Mood |
|-------|------|
| `omapi-famicom` | Dark. Cool ink, hot magenta accent, CRT phosphor green, amber numbers. The signature look. |
| `omapi-denshi` | Dark. Cold steel and teal with amber highlights — analog lab equipment. |
| `omapi-washi` | Light. Washi paper, sumi ink, vermilion accent, indigo functions. |

Pick one with `/omapi theme omapi-famicom`, or let pi follow omarchy with `/omapi theme follow`.

## Commands

```
/omapi                      show current settings
/omapi logo                 replay the boot animation
/omapi theme <name>         pin an omaPi theme
/omapi theme follow         follow the active omarchy theme
/omapi omarchy install      install omaPi's pi.json.tpl for omarchy
/omapi header on|off        toggle the logo header
/omapi animate on|off       toggle the boot animation
/omapi kana on|off          toggle the katakana tagline
/omapi footer on|off        toggle the status strip
/omapi indicator on|off     toggle the 8-bit working indicator
/omapi followOmarchy on|off toggle omarchy theme following
```

Settings persist in `~/.config/omapi/config.json`.

## Omarchy integration

Omarchy generates each app's theme from the active theme's `colors.toml` through templates in
`/usr/share/omarchy/default/themed/`, and a file at `~/.config/omarchy/themed/<name>.tpl` overrides
the built-in one. omaPi ships an improved `pi.json.tpl`:

```
/omapi omarchy install
omarchy theme set <your-theme>
```

The result is still called `omarchy-system` in pi, so nothing else changes — but the generated theme
now separates syntax hues properly, tints panels and borders with the theme accent, and fills in the
search-match, scrollbar and `thinkingMax` tokens the stock template leaves blank.

omaPi also watches `~/.local/state/omarchy/current/theme.name`, so `omarchy theme set` retints a
running pi session.

## Font

omaPi is designed for **Departure Mono Nerd** — a pixel monospace with a lo-fi technical vibe that
matches the 8-bit mark:

```bash
yay -S otf-departure-mono-nerd
omarchy font set "DepartureMono Nerd Font"
```

It works fine in JetBrains Mono, Iosevka, or anything else — the art only uses block glyphs.

## Development

```bash
bun install
bun run typecheck
bun run preview   # render header + footer
bun run frames    # dump every animation frame
```

`OMAPI_FRAME_MS` overrides the animation frame duration (default `45`), which is how the
demo GIF above is recorded at a slower, capturable rate.

Regenerate the screenshots (Hyprland + kitty + grim + ffmpeg + magick):

```bash
scripts/capture.sh [theme]   # writes docs/preview.png and docs/boot.gif
```

Note: pi installs packages with `npm install` regardless — bun is only this repo's
development workflow.

## License

MIT
