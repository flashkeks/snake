#!/bin/sh
# Holt die Sound-Slots aus public/sfx.json von myinstants.com nach DATA_DIR/sfx/SLOT.mp3.
# Laeuft auf edge (dort gibt es Internet): /srv/snake/tools/fetch-sfx.sh [DATA_DIR]
# Vorhandene Dateien bleiben, ausser mit FORCE=1.
set -e
DIR="${1:-/srv/snake-data}/sfx"
mkdir -p "$DIR"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
python3 - "$(dirname "$0")/../public/sfx.json" "$DIR" "$UA" "${FORCE:-0}" <<'PY'
import json, sys, os, urllib.request
cfg, out, ua, force = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == '1'
ok = bad = 0
for slot, d in json.load(open(cfg)).items():
    if slot == '_': continue
    dst = os.path.join(out, slot + '.mp3')
    if os.path.exists(dst) and not force: ok += 1; continue
    try:
        req = urllib.request.Request('https://www.myinstants.com/media/sounds/' + d['src'], headers={'User-Agent': ua})
        data = urllib.request.urlopen(req, timeout=20).read()
        if len(data) < 2000 or len(data) > 3_000_000: raise Exception(f'size {len(data)}')
        open(dst, 'wb').write(data); ok += 1
    except Exception as e:
        bad += 1; print('FAIL', slot, d['src'], e)
print(f'{ok} ok, {bad} fail -> {out}')
PY
