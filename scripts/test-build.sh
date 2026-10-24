#!/bin/sh
# Builds installers to try out before a release, without touching the version in the repo.
#
#   scripts/test-build.sh 1.0.1-dev.1            macOS (this machine's arch) + Windows x64
#   scripts/test-build.sh 1.0.1-dev.1 --linux    … + Linux AppImage/deb for this arch
#
# Output: ~/Hodor-test-builds/<version>/ (override with HODOR_TEST_BUILDS). Unsigned: on macOS
# open it with right-click → Open or System Settings → Privacy & Security; on Windows "Run anyway".
set -e
version="$1"
[ -n "$version" ] || { echo "usage: $0 <version, e.g. 1.0.1-dev.1> [--linux]" >&2; exit 1; }
shift
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${HODOR_TEST_BUILDS:-$HOME/Hodor-test-builds}/$version"
arch="$(uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/')"

targets="--mac dmg:$arch --win nsis:x64"
[ "$1" = "--linux" ] && targets="$targets --linux AppImage:$arch deb:$arch"

cd "$root"
pnpm --filter @hodor/core build
pnpm --filter @hodor/cli bundle
pnpm --filter @hodor/gui build

rm -rf "$out"
cd packages/gui
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder $targets --publish never \
  -c.extraMetadata.version="$version" -c.directories.output="$out"

# Keep only what you install; electron-builder also leaves unpacked folders and metadata
find "$out" -mindepth 1 -maxdepth 1 ! -name '*.dmg' ! -name '*.exe' ! -name '*.AppImage' ! -name '*.deb' \
  -exec rm -rf {} +
echo
echo "Test build $version:"
ls -1 "$out"
