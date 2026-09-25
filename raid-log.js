// Raid-Log (25.09.2026, Max): was ein Spieler in einen Raid mitnahm und was er
// dort verlor – mit vollen Item-Objekten, damit das Admin-Panel nach einem
// Lag-Tod oder einem Absturz genau diese Items zurueckgeben kann.
//
// Eine Zeile je Ereignis in DATA_DIR/raid-log.jsonl:
//   join     Items verlassen das Lager (items = was genommen wurde)
//   died     Tod im Raid (items = was verloren ging, saved = versichert zurueck)
//   left     Raid verlassen / Verbindung weg – zaehlt wie Tod
//   extract  heil raus (items = was mitkam; shutdown = Server-Neustart)
//   restore  Admin hat die Items eines Raids zurueckgegeben
// rid verbindet join und Ende. Ein join ohne Ende und ohne laufenden Raid heisst:
// der Server ist mittendrin abgestuerzt, die Items sind weder im Lager noch im Beutel.
//
// Synchron geschrieben, damit die Zeile auch dann auf der Platte steht, wenn der
// Prozess gleich danach stirbt. Ab 20 MB wird eine Generation (.1) aufgehoben.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_BYTES = 20 * 1024 * 1024;

let file = null;
// Raids, die in diesem Prozess gerade laufen – nur die sind nicht wiederherstellbar
const live = new Set();

function init(dataDir) {
    file = path.join(dataDir, 'raid-log.jsonl');
}

const copy = items => JSON.parse(JSON.stringify(items || []));

function write(e) {
    if (!file) return;
    if (e.ev === 'join') live.add(e.rid);
    else if (e.ev !== 'restore') live.delete(e.rid);
    const line = JSON.stringify({ at: new Date().toISOString(), ...e, items: e.items ? copy(e.items) : undefined }) + '\n';
    try {
        try {
            if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, file + '.1');
        } catch { /* noch keine Datei */ }
        fs.appendFileSync(file, line, { mode: 0o600 });
    } catch (err) {
        console.error('raid-log', err.message);
    }
}

const newRid = () => crypto.randomBytes(6).toString('hex');

function lines() {
    const out = [];
    if (!file) return out;
    for (const f of [file + '.1', file]) {
        let text;
        try {
            text = fs.readFileSync(f, 'utf8');
        } catch {
            continue;
        }
        for (const l of text.split('\n')) {
            if (!l) continue;
            try {
                out.push(JSON.parse(l));
            } catch { /* halbe Zeile nach Absturz */ }
        }
    }
    return out;
}

// Raids eines Kontos, neueste zuerst. restorable = Items, die ein Admin
// zurueckgeben kann (verloren bzw. bei Absturz alles Mitgenommene)
function raidsOf(user, n = 50) {
    const by = new Map();
    for (const e of lines()) {
        if (e.user !== user || !e.rid) continue;
        let r = by.get(e.rid);
        if (!r) by.set(e.rid, r = { rid: e.rid });
        if (e.ev === 'join') Object.assign(r, { at: e.at, mode: e.mode, map: e.map, mission: e.mission, took: e.items || [] });
        else if (e.ev === 'restore') r.restored = { at: e.at, by: e.by, n: e.n };
        else Object.assign(r, { end: e.ev, endAt: e.at, lost: e.items || [], killer: e.killer, saved: e.saved, shutdown: e.shutdown, secs: e.secs });
    }
    const out = [...by.values()].map(r => {
        r.live = live.has(r.rid);
        if (r.end === 'died' || r.end === 'left') r.restorable = r.lost;
        else if (!r.end && !r.live) { r.end = 'crash'; r.restorable = r.took || []; }
        else r.restorable = [];
        return r;
    });
    out.sort((a, b) => String(b.at || b.endAt).localeCompare(String(a.at || a.endAt)));
    return out.slice(0, n);
}

module.exports = { init, write, newRid, raidsOf };
