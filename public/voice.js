// Echte Voicelines und Sound-Effekte (25.09.2026, Max). Slots stehen in /sfx.json, die
// mp3 liefert der Server aus DATA_DIR/sfx (auf edge per tools/fetch-sfx.sh geholt).
// Fehlt eine Datei, bleibt es beim bisherigen Synth-Sound. Nutzt audio/sfxBus/sfxMuted
// aus index.html (gemeinsamer Lautstaerke-Regler und Stummschalter).
const VOX = { cfg: null, buf: {}, miss: {}, last: {}, lastAny: 0 };
fetch('/sfx.json').then(r => r.json()).then(j => { VOX.cfg = j; }).catch(() => {});

function voxHas(slot) { return !!(VOX.cfg && VOX.cfg[slot] && !VOX.miss[slot]); }

function voxLoad(slot) {
    if (VOX.buf[slot] || VOX.miss[slot] || !VOX.cfg || !VOX.cfg[slot]) return null;
    VOX.buf[slot] = fetch('/sfx/' + slot + '.mp3')
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(b => audio.decodeAudioData(b))
        .then(d => (VOX.buf[slot] = d))
        .catch(() => { VOX.miss[slot] = true; delete VOX.buf[slot]; });
    return null;
}

// Spielt einen Slot; true, wenn er (gleich) laeuft. Stimmen ueberlappen sich nicht zu sehr.
function vox(slot, gain = 1) {
    if (!voxHas(slot) || typeof sfxOk !== 'function' || !sfxOk()) return false;
    const c = VOX.cfg[slot], now = performance.now();
    if (now - (VOX.last[slot] || -1e9) < Math.max(.5, c.cd || 0) * 1000) return false;
    const voice = (c.max || 3) > 2;
    if (voice && now - VOX.lastAny < 900) return false;
    VOX.last[slot] = now;
    if (voice) VOX.lastAny = now;
    const b = VOX.buf[slot];
    if (!b) { voxLoad(slot); const p = VOX.buf[slot]; if (p && p.then) p.then(d => d && d.duration && voxPlay(d, c, gain)); return true; }
    if (b.then) return true;
    voxPlay(b, c, gain);
    return true;
}
function voxPlay(buf, c, gain) {
    const t = audio.currentTime, src = audio.createBufferSource(), g = audio.createGain();
    src.buffer = buf;
    // 25.09.2026 (Max: alle Clips bissl leiser): Gesamtfaktor .9 -> .55
    const max = Math.min(buf.duration, c.max || 3), v = Math.max(.02, (c.vol || .8) * gain * .55);
    g.gain.setValueAtTime(v, t);
    g.gain.setValueAtTime(v, t + Math.max(0, max - .25));
    g.gain.linearRampToValueAtTime(.0001, t + max);
    src.connect(g).connect(sfxBus.master);
    src.start(t);
    src.stop(t + max + .05);
}
// Vorladen, was man gerade in der Hand hat (kein Ruckler beim ersten Schuss)
function voxWarm(slots) { for (const s of slots) if (s && VOX.cfg && VOX.cfg[s]) voxLoad(s); }

// Spezial-Charaktere: Auftritt, Tod, gelegentlich ein Spruch
const VOX_SEEN = new Map();
function voxMobs(mobs, map) {
    if (!VOX.cfg) return;
    const now = performance.now(), cur = new Set();
    for (const mb of mobs) {
        const def = map.mobs && map.mobs[mb.kind];
        if (!def || !def.special) continue;
        cur.add(mb.id);
        if (!VOX_SEEN.has(mb.id)) { VOX_SEEN.set(mb.id, { kind: mb.kind, hp: mb.hp / mb.mh }); vox(mb.kind + '-spawn'); }
        else VOX_SEEN.get(mb.id).hp = mb.hp / mb.mh;
        if (Math.random() < .002) vox(mb.kind + '-line');
    }
    for (const [id, s] of VOX_SEEN) if (!cur.has(id)) { if (s.hp < .25) vox(s.kind + '-death'); VOX_SEEN.delete(id); }
}
