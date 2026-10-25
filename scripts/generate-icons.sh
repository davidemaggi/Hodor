#!/usr/bin/env bash
# Regenerate every icon from assets/brand/*.svg. Needs ImageMagick (magick) and, on macOS, iconutil.
set -euo pipefail
cd "$(dirname "$0")/.."

SVG=assets/brand/hodor-icon.svg
TRAY=assets/brand/hodor-tray-template.svg
RES=packages/gui/resources
BUILD=packages/gui/build
mkdir -p "$RES" "$BUILD" packages/gui/src/renderer/src/assets

render() { magick -background none -density "$3" "$1" -resize "${2}x${2}" "PNG32:$4"; }

render "$SVG" 1024 1200 "$BUILD/icon.png"
# Linux: one PNG per standard hicolor size (desktops don't look in 1024x1024)
mkdir -p "$BUILD/icons"
for s in 16 24 32 48 64 128 256 512; do render "$SVG" "$s" 1200 "$BUILD/icons/${s}x${s}.png"; done
render "$SVG" 512 600 "$RES/icon.png"
magick -background none -density 1200 "$SVG" -define icon:auto-resize=256,128,64,48,32,24,16 "$BUILD/icon.ico"

if command -v iconutil >/dev/null; then
  ICONSET=$(mktemp -d)/icon.iconset
  mkdir -p "$ICONSET"
  for s in 16 32 128 256 512; do
    render "$SVG" "$s" 1200 "$ICONSET/icon_${s}x${s}.png"
    render "$SVG" $((s * 2)) 1200 "$ICONSET/icon_${s}x${s}@2x.png"
  done
  iconutil -c icns "$ICONSET" -o "$BUILD/icon.icns"
else
  echo "iconutil not found (macOS only): skipping icon.icns" >&2
fi

# Tray: the full icon on Windows/Linux, a monochrome template image for the macOS menu bar
render "$SVG" 32 1200 "$RES/tray.png"
render "$SVG" 64 1200 "$RES/tray@2x.png"
render "$TRAY" 16 2400 "$RES/trayTemplate.png"
render "$TRAY" 32 2400 "$RES/trayTemplate@2x.png"

cp "$SVG" packages/gui/src/renderer/src/assets/hodor-icon.svg
echo "Icons regenerated."
