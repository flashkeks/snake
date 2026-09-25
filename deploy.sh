#!/bin/sh
# Neuesten Stand holen und das Spiel neu starten. Als root auf edge:
#   /srv/snake/deploy.sh
set -e
cd "$(dirname "$0")"

before=$(sudo -u deploy git rev-parse HEAD)
sudo -u deploy git pull -q --ff-only
after=$(sudo -u deploy git rev-parse HEAD)

# Abhaengigkeiten nur nachziehen, wenn package.json sich geaendert hat oder ws fehlt
if [ ! -d node_modules/ws ] || ! sudo -u deploy git diff --quiet "$before" "$after" -- package.json; then
    sudo -u deploy npm install --omit=dev --no-audit --no-fund
fi

node --check server.js

systemctl restart snake
sleep 2

if systemctl is-active --quiet snake; then
    echo "OK: $(sudo -u deploy git log -1 --format='%h %s') laeuft"
else
    echo "FEHLER: snake.service laeuft nicht:" >&2
    journalctl -u snake -n 20 --no-pager >&2
    exit 1
fi
