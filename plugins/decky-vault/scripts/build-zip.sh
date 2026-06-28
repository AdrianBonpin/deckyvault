#!/usr/bin/env bash
# Build a Decky Loader plugin ZIP ready for "Install Plugin from ZIP File".
#
# The ZIP must contain the plugin files at the ROOT (no enclosing folder):
#   plugin.json, main.py, package.json, dist/index.js [, dist/index.js.map]
#
# Usage:
#   ./scripts/build-zip.sh          # builds + packages, output in releases/
#   ./scripts/build-zip.sh --no-build  # package only (skip rollup build)
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "require('./package.json').name")
# Strip any @scope/ prefix for the zip filename
ZIP_NAME=$(echo "$NAME" | sed 's#.*/##')

OUT_DIR="releases"
ZIP_PATH="$OUT_DIR/${ZIP_NAME}-v${VERSION}.zip"

if [[ "${1:-}" != "--no-build" ]]; then
  echo "› Building plugin with rollup…"
  bun run build
fi

echo "› Packaging $ZIP_PATH …"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# Create the zip with files at the root. We cd into the plugin dir so paths
# are relative (no enclosing folder in the archive).
zip -r -X "$PWD/$ZIP_PATH" \
  plugin.json \
  main.py \
  package.json \
  dist/index.js \
  dist/index.js.map \
  >/dev/null

echo "✓ Built $ZIP_PATH ($(du -h "$ZIP_PATH" | cut -f1))"
echo
echo "Install options:"
echo "  • Decky → Plugin Browser → ⋮ → Install Plugin from ZIP File → pick $ZIP_PATH"
echo "  • Or host $ZIP_PATH anywhere and use 'Install Plugin from URL'"