// Dungeon-Instanzen (25.09.2026, Max): Militaerbasis und Labor als eigene
// createArena-Instanz je Party, Karte bei jedem Betreten neu (dungeons.js).
//
// Rein: Luke auf der Oberflaeche (Station mit `dungeon`). Wer innerhalb von
// JOIN_MS nach dem Ersten durch dieselbe Luke steigt, landet in derselben
// Instanz (bis PARTY_MAX) – bis es Missionen und Partys gibt (Phase 3).
// Raus: Ausgang im Dungeon (Station mit `exit`) -> zurueck an die Luke, mit
// allem, was man traegt. Tod im Dungeon wie im Raid: Beutel bleibt unten.
//
// h: { createArena(opts), makeWorld(map), surface, send }

const { buildDungeon } = require('./dungeons');

const JOIN_MS = 20000, PARTY_MAX = 4;

module.exports = function createDungeons(h) {
    const insts = new Map();         // id -> { id, kind, hatch, created, members: Map(cid -> { back }), arena, map }
    let seq = 0;

    function of(c) {
        for (const d of insts.values()) if (d.members.has(c.id)) return d;
        return null;
    }

    function enter(c, kind, from) {
        if (of(c) || !h.surface.has(c)) return;
        const now = Date.now();
        let d = [...insts.values()].find(x => x.kind === kind && x.hatch === from.key && now - x.created < JOIN_MS && x.members.size < PARTY_MAX);
        if (!d) {
            const map = buildDungeon(kind, (now ^ (++seq * 7919)) >>> 0);
            d = { id: seq, kind, hatch: from.key, created: now, members: new Map(), map, arena: null };
            d.arena = h.createArena({ mode: 'dungeon', world: h.makeWorld(map), kind, leaveDungeon: c2 => leave(c2) });
            insts.set(d.id, d);
        }
        const p = h.surface.detach(c);
        if (!p) return;
        d.members.set(c.id, { back: { x: from.x, y: from.y + 110 } });
        d.arena.attach(c, p, d.map.spawn);
        h.send(c, { type: 'shEvent', text: kind === 'lab' ? '🧬 You climb down into the abandoned lab – something moves in the dark…' : '🎖️ You climb down into the abandoned military base – stay sharp', kind: 'self' });
        if (d.members.size > 1) for (const [cid] of d.members) if (cid !== c.id) { const m = d.arena._players.get(cid); if (m) h.send(m.c, { type: 'shEvent', text: `👥 ${p.name} joined your run`, kind: 'self' }); }
    }

    // Mission (25.09.2026): Party aus dem Guild House in eine eigene Instanz, Ziel-Boss drin
    function startMission(cs, kind, diff, back) {
        const now = Date.now();
        const map = buildDungeon(kind, (now ^ (++seq * 7919)) >>> 0);
        for (const st of map.stations) if (st.exit) st.dest = 'Guild House';
        const d = { id: seq, kind, hatch: 'mission' + seq, created: now, members: new Map(), map, arena: null, mission: diff };
        d.arena = h.createArena({ mode: 'dungeon', world: h.makeWorld(map), kind, mission: { diff }, leaveDungeon: c2 => leave(c2) });
        insts.set(d.id, d);
        for (const c of cs) {
            if (of(c) || !h.surface.has(c)) continue;
            const p = h.surface.detach(c);
            if (!p) continue;
            // 25.09.2026 (Max): wer auf dieser Stufe noch keine Mission geschafft hat, verliert beim Tod nichts
            const u = p.account && h.accounts.get && h.accounts.get(p.account);
            p.safeRun = !!u && !((u.stats || {})['missions_' + diff] > 0);
            if (p.safeRun) h.send(c, { type: 'shEvent', text: '🛡️ First mission on this difficulty – if you fall, you keep all your gear', kind: 'drop' });
            d.members.set(c.id, { back });
            c.missionBack = back; // Tod in der Mission: Respawn im naechsten Guild House
            d.arena.attach(c, p, map.spawn);
        }
        cleanup(d);
    }

    // Ausgang: zurueck an die Luke bzw. ins Guild House
    function leave(c) {
        const d = of(c);
        if (!d) return;
        const p = d.arena.detach(c);
        const back = d.members.get(c.id).back;
        d.members.delete(c.id);
        if (p) {
            // Mission: Tokens, wenn der Boss liegt; Versicherung ist verbraucht
            if (d.mission) {
                const a = h.accounts.arena(p.account);
                for (const sl of ['primary', 'secondary', 'helmet', 'vest', 'pants', 'boots', 'backpack']) if (p.gear[sl]) delete p.gear[sl].insured;
                if (d.arena.missionDone()) {
                    const n = d.arena.missionReward();
                    a.tokens = (a.tokens || 0) + n;
                    h.accounts.stat(p.account, s2 => { s2.missions = (s2.missions || 0) + 1; s2['missions_' + d.mission] = (s2['missions_' + d.mission] || 0) + 1; });
                    h.send(c, { type: 'shEvent', text: `🎟️ +${n} Mission Tokens (now ${a.tokens})`, kind: 'drop' });
                } else h.send(c, { type: 'shEvent', text: '🏃 Mission aborted – no tokens', kind: 'self' });
                h.accounts.touch();
            }
            h.surface.attach(c, p, back);
            h.send(c, { type: 'shEvent', text: d.mission ? '🏰 Back in the Guild House' : '🪜 Back on the surface', kind: 'self' });
        }
        cleanup(d);
    }

    // Verbindung weg oder Aufgeben: zaehlt wie Sterben im Dungeon
    function drop(c) {
        const d = of(c);
        if (!d) return false;
        d.arena.leave(c);
        d.members.delete(c.id);
        cleanup(d);
        return true;
    }

    function cleanup(d) {
        if (!d.members.size) insts.delete(d.id);
    }

    function tick() {
        for (const d of [...insts.values()]) {
            d.arena.tick();
            // im Dungeon gestorben: Mitglied austragen
            for (const [cid] of [...d.members]) if (!d.arena._players.has(cid)) d.members.delete(cid);
            cleanup(d);
        }
    }

    function arenaOf(c) {
        const d = of(c);
        return d && d.arena.has(c) ? d.arena : null;
    }

    return {
        enter, leave, drop, tick, arenaOf, startMission,
        has: c => !!of(c),
        refundAll: () => { for (const d of insts.values()) d.arena.refundAll(); },
        list: () => [...insts.values()].map(d => ({ id: d.id, kind: d.kind, players: d.arena.names() }))
    };
};
