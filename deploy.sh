#!/bin/sh
# Neuesten Stand holen und das Spiel neu starten.
# Laeuft im Calibre-Container: cd /config/snake && ./deploy.sh
set -e
cd "$(dirname "$0")"

before=$(git rev-parse HEAD)
git pull -q --ff-only
after=$(git rev-parse HEAD)

# Abhaengigkeiten nur nachziehen, wenn package.json sich geaendert hat oder ws fehlt
if [ ! -d node_modules/ws ] || ! git diff --quiet "$before" "$after" -- package.json; then
    npm install --omit=dev --no-audit --no-fund
fi

node --check server.js

# s6 (custom-svc-snake) startet den Prozess von selbst neu
pkill -f 'node /config/snake/server.js' || true
sleep 2

if pgrep -f 'node /config/snake/server.js' >/dev/null; then
    echo "OK: $(git log -1 --format='%h %s') laeuft"
else
    echo "FEHLER: server.js laeuft nicht. Log: node /config/snake/server.js von Hand starten" >&2
    exit 1
fi
