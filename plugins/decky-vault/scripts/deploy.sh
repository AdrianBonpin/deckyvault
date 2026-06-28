#!/usr/bin/env bash
# Deploy the built plugin dist/ + main.py to the Steam Deck and restart the
# plugin loader. The build step is handled separately (bun run plugin:build
# calls rollup first, then this script runs).
set -euo pipefail

DECK_IP="${DECK_IP:-192.168.254.112}"
DECK_USER="${DECK_USER:-deck}"
DECK_PASS="${DECK_PASS:-22122012003}"
PLUGIN_DIR="/home/deck/homebrew/plugins/decky-vault"

cd "$(dirname "$0")/.."

echo "› Deploying to ${DECK_USER}@${DECK_IP}…"

sshpass -p "$DECK_PASS" ssh -o StrictHostKeyChecking=no "${DECK_USER}@${DECK_IP}" \
  "mkdir -p /tmp/dv-deploy && rm -rf /tmp/dv-deploy/*"

sshpass -p "$DECK_PASS" scp -o StrictHostKeyChecking=no -r dist main.py \
  "${DECK_USER}@${DECK_IP}:/tmp/dv-deploy/"

sshpass -p "$DECK_PASS" ssh -o StrictHostKeyChecking=no "${DECK_USER}@${DECK_IP}" \
  "echo '${DECK_PASS}' | sudo -S cp /tmp/dv-deploy/dist/index.js ${PLUGIN_DIR}/dist/index.js && \
   echo '${DECK_PASS}' | sudo -S cp /tmp/dv-deploy/main.py ${PLUGIN_DIR}/main.py && \
   echo '${DECK_PASS}' | sudo -S systemctl restart plugin_loader.service && \
   sleep 1 && echo 'restarted'"

echo "✓ Deployed — plugin loaded:"
sshpass -p "$DECK_PASS" ssh -o StrictHostKeyChecking=no "${DECK_USER}@${DECK_IP}" \
  "ls -t /home/deck/homebrew/logs/decky-vault/ | head -1 | xargs -I{} tail -1 '/home/deck/homebrew/logs/decky-vault/{}'"