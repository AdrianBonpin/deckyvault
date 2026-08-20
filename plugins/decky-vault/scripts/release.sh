#!/usr/bin/env bash
# Create a Gitea release (git.ranio.xyz/adrianbonpin/deckyvault) for the
# DeckyVault Decky plugin with the installable ZIP attached.
#
# Usage:
#   ./scripts/release.sh                 # uses version from package.json
#   ./scripts/release.sh 1.1.0           # override version (also bumps package.json)
#   ./scripts/release.sh --prerelease    # mark as pre-release
#   ./scripts/release.sh 1.1.0 --prerelease
#
# Prerequisites:
#   - tea CLI installed and authenticated (tea login) for the gitea.ranio.xyz login
#   - on the branch you want to tag (usually prod)
#
# What it does:
#   1. (optional) bumps plugins/decky-vault/package.json version
#   2. builds the plugin with rollup
#   3. packages the ZIP via scripts/build-zip.sh
#   4. creates a git tag vX.Y.Z (if missing) and pushes it
#   5. creates a GitHub release with release notes + the ZIP attached
set -euo pipefail

cd "$(dirname "$0")/.."

PLUGIN_DIR="$(pwd)"
VERSION=""
PRERELEASE=0

# ── Parse args ───────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --prerelease) PRERELEASE=1 ;;
    --help|-h)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      if [[ -z "$VERSION" ]]; then
        VERSION="$arg"
      fi
      ;;
  esac
done

# ── Resolve version ──────────────────────────────────────────
if [[ -z "$VERSION" ]]; then
  VERSION=$(node -p "require('./package.json').version")
fi

echo "› Releasing DeckyVault plugin v${VERSION}"

# ── Bump package.json if version differs ─────────────────────
CURRENT=$(node -p "require('./package.json').version")
if [[ "$VERSION" != "$CURRENT" ]]; then
  echo "› Bumping package.json ${CURRENT} → ${VERSION}"
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('package.json','utf8'));
    p.version = '${VERSION}';
    fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
  "
  git add package.json
  git commit -m "chore: bump plugin version to ${VERSION}" >/dev/null
  echo "  committed version bump"
fi

# ── Build + package ──────────────────────────────────────────
echo "› Building plugin…"
bun run build >/dev/null 2>&1

echo "› Packaging ZIP…"
./scripts/build-zip.sh --no-build >/dev/null

ZIP_NAME="plugin-v${VERSION}.zip"
ZIP_PATH="releases/${ZIP_NAME}"

if [[ ! -f "$ZIP_PATH" ]]; then
  echo "✗ ZIP not found at $ZIP_PATH" >&2
  exit 1
fi

echo "  $(du -h "$ZIP_PATH" | cut -f1) → $ZIP_PATH"

# ── Git tag ──────────────────────────────────────────────────
TAG="v${VERSION}"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "› Tag $TAG already exists (reusing)"
else
  echo "› Creating tag $TAG"
  git tag "$TAG"
  git push origin "$TAG" >/dev/null 2>&1
fi

# ── Release notes ────────────────────────────────────────────
NOTES_FILE="$(mktemp -t dv-release-notes)"
trap 'rm -f "$NOTES_FILE"' EXIT

cat > "$NOTES_FILE" <<EOF
# DeckyVault Plugin v${VERSION}

Record Steam Deck performance metrics with MangoHud and upload them straight to [DeckyVault](https://deckyvault.xyz) from the Quick Access Menu.

## Install

### From ZIP
1. Install [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) on your Steam Deck
2. Download \`${ZIP_NAME}\` below
3. Decky → Plugin Browser → **⋮** → **Install Plugin from ZIP File** → pick the zip

### From URL
1. Decky → Plugin Browser → **⋮** → **Install Plugin from URL**
2. Paste: \`https://git.ranio.xyz/adrianbonpin/deckyvault/releases/download/${TAG}/${ZIP_NAME}\`

## Setup
1. Open the plugin (QAM → DeckyVault) → **Account** → **Pair with Phone**
2. Scan the QR code with your phone and confirm on deckyvault.xyz
3. In **MangoHud Setup**, tap **Write Config** and add the launch option to your game:
   \`\`\`
   ~/deckyvault-mangohud.sh %command%
   \`\`\`
4. Launch the game, press **Start Recording** once in-game, then **Stop** when done
5. Review the stats and **Upload to DeckyVault**

Full guide: https://deckyvault.xyz/plugin
EOF

# ── Create release (Gitea via tea) ───────────────────────────
REPO="adrianbonpin/deckyvault"

RELEASE_ARGS=(
  create
  --repo "$REPO"
  --tag "$TAG"
  --title "DeckyVault Plugin v${VERSION}"
  --note-file "$NOTES_FILE"
  --target "$(git rev-parse --abbrev-ref HEAD)"
)

if [[ "$PRERELEASE" -eq 1 ]]; then
  RELEASE_ARGS+=(--prerelease)
fi

if tea release list -r "$REPO" -o simple 2>/dev/null | grep -q "^$TAG"; then
  echo "› Release $TAG exists — updating notes + asset"
  tea release edit "$TAG" --repo "$REPO" \
    --title "DeckyVault Plugin v${VERSION}" \
    --note "$(cat "$NOTES_FILE")" \
    --draft false \
    --prerelease "$([[ "$PRERELEASE" -eq 1 ]] && echo true || echo false)" >/dev/null
  tea release assets create "$TAG" "$ZIP_PATH" --repo "$REPO" >/dev/null
else
  echo "› Creating Gitea release $TAG…"
  tea release "${RELEASE_ARGS[@]}" --asset "$ZIP_PATH"
fi

echo
echo "✓ Released v${VERSION}"
echo "  Release:  https://git.ranio.xyz/adrianbonpin/deckyvault/releases/tag/${TAG}"
echo "  ZIP URL:  https://git.ranio.xyz/adrianbonpin/deckyvault/releases/download/${TAG}/${ZIP_NAME}"
echo
echo "Use the ZIP URL above with Decky's 'Install Plugin from URL'."