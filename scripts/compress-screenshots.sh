#!/usr/bin/env bash
# Compress and resize images in apps/web/public/plugin/
# Targets a max width suitable for web display and re-encodes as JPEG.
#
# Usage:
#   ./scripts/compress-screenshots.sh                # default: 1000px Deck / 1400px web
#   ./scripts/compress-screenshots.sh 800 1200       # custom max widths
#
# Requires: macOS (uses sips)
set -euo pipefail

cd "$(dirname "$0")/.."

DECK_MAX="${1:-1000}"   # Steam Deck screenshots are 1280×800
WEB_MAX="${2:-1400}"    # Web/desktop screenshots are wider
QUALITY=78

DIR="apps/web/public/plugin"
if [[ ! -d "$DIR" ]]; then
  echo "✗ $DIR not found" >&2
  exit 1
fi

shopt -s nullglob
files=("$DIR"/*.jpg "$DIR"/*.jpeg "$DIR"/*.png)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No images in $DIR"
  exit 0
fi

# Pick the right max width based on aspect ratio: 16:10 (Deck-ish) gets DECK_MAX,
# anything wider gets WEB_MAX.
compress() {
  local f="$1"
  local w h max
  w=$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth/ {print $2}')
  h=$(sips -g pixelHeight "$f" 2>/dev/null | awk '/pixelHeight/ {print $2}')
  if [[ -z "$w" || -z "$h" ]] || [[ "$h" -eq 0 ]]; then
    echo "  skip $f (can't read dimensions)"
    return
  fi
  # aspect ratio = w/h. 16:10 = 1.6
  local ratio
  ratio=$(awk -v w="$w" -v h="$h" 'BEGIN { printf "%.2f", w/h }')
  if awk -v r="$ratio" 'BEGIN { exit !(r <= 1.7) }'; then
    max="$DECK_MAX"
  else
    max="$WEB_MAX"
  fi

  local before after pct
  before=$(stat -f%z "$f")
  sips -s format jpeg -s formatOptions "$QUALITY" -Z "$max" "$f" --out "${f}.tmp" >/dev/null 2>&1
  mv "${f}.tmp" "${f%.png}.jpg"
  after=$(stat -f%z "${f%.png}.jpg")
  pct=$(awk -v a="$after" -v b="$before" 'BEGIN { printf "%.0f", (a-b)/b*100 }')
  echo "  ${f##*/}  $(numfmt --to=iec "$before" 2>/dev/null || echo ${before}B) → $(numfmt --to=iec "$after" 2>/dev/null || echo ${after}B) (${pct}%)"
}

echo "Compressing images in $DIR (Deck ≤ ${DECK_MAX}px, Web ≤ ${WEB_MAX}px, q=${QUALITY})…"
for f in "${files[@]}"; do
  compress "$f"
done
echo "✓ Done"