// Kekemon-Arenen (5.6): acht KI-Arenen, eine nach der anderen freigeschaltet.
//
// Jede Arena hat einen Typ, einen Leiter und ein festes Team aus drei Karten
// dieses Typs (deterministisch aus der Arena-Id gewaehlt, also immer gleich).
// Staerke: Seltenheit der Leiter-Karten, Multiplikator auf HP/Schaden, KI-Stufe
// (0 greift nur an, 1 laedt klug auf, 2 wechselt auch bei schlechter Paarung).
//
// Belohnung: erster Sieg = Coins + Gratis-Pack (seit 6.1 ins Pack-Inventar);
// danach 15 % der Coins, hoechstens 3 belohnte Siege je Arena und Tag.
// Fortschritt je Konto in u.kmGyms = { gymId: { cleared, day, today, wins } }.
//
// h: { accounts, cards, cardDb, battle, send, kmState(c, extra), feed(text, kind), log(line) }

const LV = require('./km-level');
const K = require('./km-moves');

// series: 'type' = Typ-Gyms (eins nach dem anderen), 'ace' = Ace League (6.8,
// gleiche Level, gemischte Teams mit Typ-Abdeckung, KI-Stufe 3). after: welches
// Gym vorher geschafft sein muss. Der Champion bleibt der Abschluss der Typ-Reihe.
const GYMS = [
    { id: 'sprout', series: 'type', lv: 5, name: 'Sprout Gym', icon: '🌱', leader: 'Scout Mika', type: 'nature', rar: ['rare'], mul: 0.81, smart: 1, coins: 3000, pack: 'anime' },
    { id: 'tide', series: 'type', lv: 10, name: 'Tide Gym', icon: '💧', leader: 'Captain Ren', type: 'water', rar: ['rare', 'epic'], mul: 0.97, smart: 2, coins: 4000, pack: 'film' },
    { id: 'blaze', series: 'type', lv: 15, name: 'Blaze Gym', icon: '🔥', leader: 'Pyra', type: 'fire', rar: ['epic'], mul: 0.87, smart: 2, coins: 5000, pack: 'anime' },
    { id: 'volt', series: 'type', lv: 20, name: 'Volt Gym', icon: '⚡', leader: 'Sparky', type: 'electric', rar: ['epic'], mul: 0.94, smart: 2, coins: 6500, pack: 'game' },
    { id: 'dojo', series: 'type', lv: 26, name: 'Iron Dojo', icon: '👊', leader: 'Master Ken', type: 'fighting', rar: ['epic', 'legendary'], mul: 1.02, smart: 2, coins: 8000, pack: 'film' },
    { id: 'mind', series: 'type', lv: 33, name: 'Mind Tower', icon: '🔮', leader: 'Oracle Lua', type: 'psychic', rar: ['legendary'], mul: 1.25, smart: 2, coins: 11000, pack: 'anime' },
    { id: 'shadow', series: 'type', lv: 41, name: 'Shadow Gym', icon: '🌑', leader: 'Noct', type: 'dark', rar: ['legendary', 'secret'], mul: 0.84, smart: 2, coins: 15000, pack: 'mixed' },
    { id: 'champ', series: 'type', lv: 50, name: 'Kek Champion', icon: '👑', leader: 'The Kek', type: null, rar: ['legendary', 'secret'], mul: 0.66, smart: 2, coins: 30000, pack: 'mixed' },
    { id: 'ace1', series: 'ace', after: 'sprout', lv: 5, name: 'Rookie Cup', icon: '🥊', leader: 'Rival Kai', type: null, rar: ['rare', 'epic'], mul: 0.65, smart: 3, coins: 4500, pack: 'anime' },
    { id: 'ace2', series: 'ace', lv: 10, name: 'Ace Arena', icon: '🎯', leader: 'Ace Mira', type: null, rar: ['epic'], mul: 0.62, smart: 3, coins: 6000, pack: 'film' },
    { id: 'ace3', series: 'ace', lv: 15, name: 'Chess Club', icon: '♟️', leader: 'Tactician Rook', type: null, rar: ['epic'], mul: 0.77, smart: 3, coins: 7500, pack: 'game' },
    { id: 'ace4', series: 'ace', lv: 20, name: 'Veteran Hall', icon: '🛡️', leader: 'Veteran Sol', type: null, rar: ['epic', 'legendary'], mul: 0.58, smart: 3, coins: 10000, pack: 'mixed' },
    { id: 'ace5', series: 'ace', lv: 26, name: 'War Room', icon: '🧠', leader: 'Strategist Vex', type: null, rar: ['legendary'], mul: 0.62, smart: 3, coins: 12000, pack: 'mixed' },
    { id: 'ace6', series: 'ace', lv: 33, name: 'Elite Spire', icon: '💫', leader: 'Elite Nova', type: null, rar: ['legendary', 'secret'], mul: 0.63, smart: 3, coins: 16500, pack: 'mixed' },
    { id: 'ace7', series: 'ace', lv: 41, name: 'Grandmaster Throne', icon: '🏆', leader: 'Grandmaster Zed', type: null, rar: ['secret', 'legendary'], mul: 0.88, smart: 3, coins: 22500, pack: 'mixed' }
];
// Vorgaenger: sonst das vorige Gym derselben Reihe
GYMS.forEach((g, i) => {
    if (g.after !== undefined) return;
    const prev = GYMS.slice(0, i).reverse().find(x => x.series === g.series);
    g.after = prev ? prev.id : null;
});
// Staerke per Simulation (24.09.2026, Kampfsystem 6.0, tools/km-sim.js auf edge
// mit den echten Karten; Spieler = KI-Stufe 1, Zufallsteam der Arena-Seltenheit).
// Zielkurve ~85 % bei der ersten bis ~30 % beim Champion.
// 6.7 (Karten-Level Schritt 3): Leiter-Karten kaempfen auf dem Gym-Level lv
// (Sprout 5 … Champion 50). mul bleibt als Feinschliff; die Zielkurve gilt fuer
// ein Spielerteam auf dem Gym-Level (PLAYER_CARD_LV=gym in tools/km-sim.js).
// 6.8 (Max: deutlich staerker): Typ-Gyms eine Seltenheit hoeher, Ziel mit
// Typvorteil ~60 % (Sprout) bis ~25 % (Shadow); Ace League gemischt ~50 % bis ~15 %.
const REPEAT_SHARE = 0.15, REPEAT_PER_DAY = 3;

// Training (6.7, Karten-Level Schritt 2): wilde KI-Teams, unbegrenzt.
// Gegner-Level = Durchschnitt des eigenen Teams (+-), eingeklemmt in den
// Bereich. XP seit 6.8 je besiegtem Gegner (km-level.js battleXp); Coins und Booster-Teile fallen mit den Siegen am
// Tag ab (TRAIN_FALL). 10 Teile = 1 Trainer Booster (server.js kmFragBuy).
const ZONES = [
    { id: 'meadow', name: 'Wild Meadow', icon: '🌾', lv: [1, 10], rar: ['common', 'uncommon'], smart: 0, coins: 250, frag: 1 },
    { id: 'canyon', name: 'Wild Canyon', icon: '🏜️', lv: [10, 30], rar: ['uncommon', 'rare'], smart: 1, coins: 600, frag: 1 },
    { id: 'summit', name: 'Wild Summit', icon: '🏔️', lv: [30, 50], rar: ['rare', 'epic'], smart: 2, coins: 1200, frag: 2 }
];
// [bis Sieg Nr., Anteil Coins, Chance auf Teile]
const TRAIN_FALL = [[10, 1, 1], [30, 0.25, 0.3], [Infinity, 0.05, 0.05]];
const FRAG_PER_PACK = 10;

function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return () => {
        h += 0x6D2B79F5;
        let t = h;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const day = () => new Date().toISOString().slice(0, 10);

module.exports = function createGyms(h) {
    const { accounts, cards, cardDb, battle: B } = h;

    // Leiter-Teams einmal beim Start festlegen. Seit 6.4 (Max: "deutlich
    // schwerer") die staerksten Karten des Typs und der Seltenheit, nicht
    // zufaellige; der Champion nimmt verschiedene Typen.
    const power = c => {
        const t = c.bt.stats;
        return t.hp + 1.3 * Math.max(t.atk, t.spa) + 0.8 * (t.def + t.spd) + 0.9 * t.spe;
    };
    // Typ-Gyms: staerkste Karten des Typs in der Seltenheit; reicht die nicht,
    // fuellt die naechst-niedrigere Seltenheit desselben Typs auf (6.8)
    const RORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'secret'];
    const byPower = (a, b) => power(b) - power(a) || a.id.localeCompare(b.id);
    function typeTeam(g) {
        const pool = cardDb.cards.filter(c => g.rar.includes(c.rarity) && (!g.type || c.type === g.type)).sort(byPower);
        const team = [];
        for (const c of pool) {
            if (team.length >= B.TEAM_SIZE) break;
            if (!g.type && team.some(id => cardDb.byId[id].type === c.type)) continue;
            team.push(c.id);
        }
        for (const c of pool) if (team.length < B.TEAM_SIZE && !team.includes(c.id)) team.push(c.id);
        let r = Math.min(...g.rar.map(x => RORDER.indexOf(x))) - 1;
        while (team.length < B.TEAM_SIZE && r >= 0) {
            const more = cardDb.cards.filter(c => c.rarity === RORDER[r] && (!g.type || c.type === g.type) && !team.includes(c.id)).sort(byPower);
            for (const c of more) if (team.length < B.TEAM_SIZE) team.push(c.id);
            r--;
        }
        for (const c of cardDb.cards.slice().sort(byPower)) if (team.length < B.TEAM_SIZE && !team.includes(c.id)) team.push(c.id);
        return team;
    }
    // Ace League (6.8): Team wie ein guter Spieler es baut – stark, jeder Typ
    // nur einmal, Attacken, die moeglichst viele Typen hart treffen, und nicht
    // drei Karten mit derselben Schwaeche
    const TYPES = [...new Set(cardDb.cards.map(c => c.type))];
    const hits = c => new Set(TYPES.filter(t => (c.bt.moves || []).some(m => m.pow && K.eff(m.type, t) > 1)));
    // Jede Ace-Stufe mit eigenen Karten (sonst gleichen sich Nachbarn mit
    // derselben Seltenheit), solange die Seltenheit genug hergibt
    const aceUsed = new Set();
    function aceTeam(g) {
        let pool = cardDb.cards.filter(c => g.rar.includes(c.rarity) && !aceUsed.has(c.id)).sort(byPower).slice(0, 80);
        if (pool.length < B.TEAM_SIZE * 2) pool = cardDb.cards.filter(c => g.rar.includes(c.rarity)).sort(byPower).slice(0, 80);
        const team = [], covered = new Set(), weak = {};
        while (team.length < B.TEAM_SIZE && pool.length) {
            let best = null, bv = -1e9;
            for (const c of pool) {
                if (team.includes(c) || team.some(x => x.type === c.type)) continue;
                const neu = [...hits(c)].filter(t => !covered.has(t)).length;
                const w = TYPES.filter(t => K.eff(t, c.type) > 1).reduce((n, t) => n + (weak[t] || 0), 0);
                const v = power(c) * (1 + 0.12 * neu - 0.1 * w);
                if (v > bv) { bv = v; best = c; }
            }
            if (!best) break;
            team.push(best);
            hits(best).forEach(t => covered.add(t));
            TYPES.filter(t => K.eff(t, best.type) > 1).forEach(t => { weak[t] = (weak[t] || 0) + 1; });
        }
        const ids = team.map(c => c.id);
        for (const c of pool) if (ids.length < B.TEAM_SIZE && !ids.includes(c.id)) ids.push(c.id);
        for (const c of cardDb.cards.slice().sort(byPower)) if (ids.length < B.TEAM_SIZE && !ids.includes(c.id)) ids.push(c.id);
        ids.forEach(id => aceUsed.add(id));
        return ids;
    }
    for (const g of GYMS) g.team = g.series === 'ace' ? aceTeam(g) : typeTeam(g);
    const byId = Object.fromEntries(GYMS.map(g => [g.id, g]));

    // Reset 6.4 (Max, einmalig) und nochmal 6.7 (Gyms mit Level): Fortschritt
    // aller Konten leeren. Coins und Karten bleiben; wo der Erstsieg schon
    // bezahlt war, gibt es ihn nicht nochmal (u.kmGymsPaid = { gymId: true }
    // -> beim neuen Erstsieg nur die Wiederholungs-Belohnung).
    // Merker je Konto: u.kmGymsV = GYMS_V.
    const GYMS_V = 3;
    if (accounts.users) {
        let n = 0;
        for (const [, u] of accounts.users()) {
            if (u.kmGymsV === GYMS_V) continue;
            const old = u.kmGyms || {};
            const paid = u.kmGymsPaid || {};
            for (const [gid, st] of Object.entries(old)) if (st && st.cleared) paid[gid] = true;
            if (Object.keys(old).length) n++;
            u.kmGymsPaid = paid;
            u.kmGyms = {};
            u.kmGymsV = GYMS_V;
        }
        if (n) {
            accounts.touch();
            if (h.log) h.log(`kekemon: Gym-Fortschritt von ${n} Konten zurueckgesetzt (Stand ${GYMS_V}), Erstsieg-Belohnungen gemerkt`);
        }
    }

    function progress(u) {
        u.kmGyms = u.kmGyms || {};
        return u.kmGyms;
    }

    function list(u) {
        const p = progress(u);
        return GYMS.map(g => {
            const s = p[g.id] || {};
            const today = s.day === day() ? s.today || 0 : 0;
            return {
                id: g.id, series: g.series, lv: g.lv, name: g.name, icon: g.icon, leader: g.leader, type: g.type, rar: g.rar, mul: g.mul, smart: g.smart,
                coins: g.coins, repeat: Math.round(g.coins * REPEAT_SHARE), pack: g.pack, team: g.team,
                unlocked: !g.after || !!(p[g.after] || {}).cleared, after: g.after, cleared: !!s.cleared, wins: s.wins || 0, rewardsLeft: s.cleared ? Math.max(0, REPEAT_PER_DAY - today) : 1,
                paid: !!(u.kmGymsPaid || {})[g.id]
            };
        });
    }

    function send(c, extra) {
        const u = accounts.get(c.account);
        h.send(c, { type: 'kbState', gyms: list(u), zones: zones(u), frag: u.kmFrag || 0, fragPer: FRAG_PER_PACK, battle: c.kb ? { gym: c.kb.gym, view: B.view(c.kb.b) } : null, ...extra });
    }

    // Eigenes Team pruefen -> { mine, keys } oder { err }
    function teamOf(u, team) {
        const keys = Array.isArray(team) ? team.map(String).slice(0, B.TEAM_SIZE) : [];
        if (keys.length !== B.TEAM_SIZE) return { err: `Pick ${B.TEAM_SIZE} cards` };
        const own = u.cards || {};
        const ids = new Set();
        const mine = [];
        for (const k of keys) {
            const { id, v } = cards.parseKey(k);
            const card = cardDb.byId[id];
            if (!card || !(own[k] > 0)) return { err: 'You do not own one of those cards' };
            if (ids.has(id)) return { err: `Pick ${B.TEAM_SIZE} different cards` };
            ids.add(id);
            // 6.7: mit dem Level der besten Kopie
            mine.push(B.fighter(card, v, 1, LV.bestLv(u, k)));
        }
        return { mine, keys };
    }

    function trainDay(u) {
        if (!u.kmTrain || u.kmTrain.day !== day()) u.kmTrain = { day: day(), wins: 0 };
        return u.kmTrain;
    }
    const fallOf = n => TRAIN_FALL.find(([upTo]) => n <= upTo);

    function zones(u) {
        const t = trainDay(u);
        const [, share, chance] = fallOf(t.wins + 1);
        return ZONES.map(z => ({ id: z.id, name: z.name, icon: z.icon, lv: z.lv, rar: z.rar, train: true,
            // XP fuer einen Sieg gegen fuenf Gegner auf Bereichs-Mitte (nur Anzeige)
            xp: Math.round(B.TEAM_SIZE * LV.koXp((z.lv[0] + z.lv[1]) / 2) * 1.2 * LV.XP.train),
            coins: Math.round(z.coins * share), frag: z.frag, fragChance: chance, full: share === 1 }));
    }

    function start(c, d) {
        const u = accounts.get(c.account);
        if (c.kb && !c.kb.b.over) return 'Finish your current battle first';
        const z = ZONES.find(x => x.id === d.gym);
        const g = z ? null : Object.prototype.hasOwnProperty.call(byId, d.gym) ? byId[d.gym] : null;
        if (!g && !z) return 'Unknown gym';
        if (g && !list(u).find(x => x.id === g.id).unlocked) return 'Beat the previous gym first';
        const t = teamOf(u, d.team);
        if (t.err) return t.err;
        let foes, leader, smart;
        if (z) {
            // Zufallsteam der Bereichs-Seltenheit, Level um das eigene herum
            const avg = t.mine.reduce((n, f) => n + f.lv, 0) / t.mine.length;
            const clamp = x => Math.max(z.lv[0], Math.min(z.lv[1], Math.round(x)));
            const base = clamp(avg);
            let pool = cardDb.cards.filter(x => z.rar.includes(x.rarity));
            if (pool.length < B.TEAM_SIZE) pool = cardDb.cards.slice();
            const pick = new Set();
            while (pick.size < Math.min(B.TEAM_SIZE, pool.length)) pick.add(pool[Math.floor(Math.random() * pool.length)]);
            foes = [...pick].map(card => B.fighter(card, '', 1, clamp(base - 1 + Math.floor(Math.random() * 5))));
            leader = `Wild team (Lv ${Math.min(...foes.map(f => f.lv))}–${Math.max(...foes.map(f => f.lv))})`;
            smart = z.smart;
        } else {
            foes = g.team.map(id => B.fighter(cardDb.byId[id], '', g.mul, g.lv));
            leader = g.leader;
            smart = g.smart;
        }
        const { b, ev } = B.createBattle(t.mine, foes, { nameA: u.name, nameB: leader, smart });
        c.kb = { b, gym: (z || g).id, keys: t.keys, zone: z || null };
        send(c, { ev, started: true });
        return null;
    }

    // Training zu Ende: XP immer, Coins/Teile nur beim Sieg und abfallend
    function finishTrain(c) {
        const kb = c.kb, z = kb.zone;
        const u = accounts.get(c.account);
        const win = kb.b.winner === 0;
        const res = { win, coins: 0, frag: 0, gym: z.id, train: true };
        if (win) {
            const t = trainDay(u);
            t.wins++;
            const [, share, chance] = fallOf(t.wins);
            res.coins = Math.round(z.coins * share);
            if (Math.random() < chance) res.frag = z.frag;
            if (res.coins) {
                accounts.addCoins(c.account, res.coins);
                accounts.earn(c.account, 'cards', res.coins);
            }
            if (res.frag) u.kmFrag = (u.kmFrag || 0) + res.frag;
            res.today = t.wins;
        }
        // 6.8: XP nur fuer besiegte Gegner (km-level.js battleXp)
        const gain = LV.battleXp(kb.b, 0, LV.XP.train);
        if (gain) res.xp = kb.keys.map(k => LV.addXp(u, k, gain)).filter(Boolean);
        res.fragTotal = u.kmFrag || 0;
        accounts.touch();
        accounts.stat(c.account, st => { st.kmTrain = (st.kmTrain || 0) + 1; });
        return res;
    }

    function finish(c) {
        const kb = c.kb;
        if (kb.zone) return finishTrain(c);
        const u = accounts.get(c.account);
        const g = byId[kb.gym];
        const win = kb.b.winner === 0;
        const res = { win, coins: 0, pack: null, first: false, gym: g.id };
        if (win) {
            const p = progress(u);
            const s = p[g.id] = p[g.id] || { wins: 0 };
            s.wins = (s.wins || 0) + 1;
            if (s.day !== day()) { s.day = day(); s.today = 0; }
            const paid = !!(u.kmGymsPaid || {})[g.id];
            if (!s.cleared && paid) {
                // Nach dem Reset 6.4: freigeschaltet ja, Erstsieg-Belohnung nicht nochmal
                s.cleared = Date.now();
                res.first = true;
                res.already = true;
                s.today = (s.today || 0) + 1;
                res.coins = Math.round(g.coins * REPEAT_SHARE);
                h.feed(`🏆 ${u.name} beat ${g.icon} ${g.name}!`, g.id === 'champ' ? 'gold' : 'good');
            } else if (!s.cleared) {
                s.cleared = Date.now();
                res.first = true;
                u.kmGymsPaid = u.kmGymsPaid || {};
                u.kmGymsPaid[g.id] = true;
                res.coins = g.coins;
                // Seit 6.1 ungeoeffnet ins Pack-Inventar (Tab "Packs")
                u.packs = u.packs || {};
                u.packs[g.pack] = (u.packs[g.pack] || 0) + 1;
                res.pack = { pack: g.pack };
                h.feed(`🏆 ${u.name} beat ${g.icon} ${g.name}!`, g.id === 'champ' ? 'gold' : 'good');
            } else if ((s.today || 0) < REPEAT_PER_DAY) {
                s.today = (s.today || 0) + 1;
                res.coins = Math.round(g.coins * REPEAT_SHARE);
            }
            if (res.coins) {
                accounts.addCoins(c.account, res.coins);
                accounts.earn(c.account, 'cards', res.coins);
            }
            accounts.touch();
        }
        // Karten-XP: jede Karte im Team, seit 6.8 nur fuer besiegte Gegner
        const gain = LV.battleXp(kb.b, 0, LV.XP.gym);
        if (gain) res.xp = kb.keys.map(k => LV.addXp(u, k, gain)).filter(Boolean);
        accounts.touch();
        accounts.stat(c.account, st => { st.kmBattles = (st.kmBattles || 0) + 1; if (win) st.kmWins = (st.kmWins || 0) + 1; });
        if (h.log) h.log(`kekemon: ${u.name} ${win ? 'schlaegt' : 'verliert gegen'} ${g.name}${res.coins ? ` (+${res.coins})` : ''}`);
        return res;
    }

    function actOn(c, d) {
        if (!c.kb) return 'No battle running';
        const r = B.play(c.kb.b, { a: String(d.a), i: d.i, to: d.to });
        if (r.err) return r.err;
        let result = null;
        if (c.kb.b.over) result = finish(c);
        send(c, { ev: r.ev, result });
        if (result) {
            c.kb = null;
            h.refresh(c);
        }
        return null;
    }

    function handle(c, d) {
        if (!c.account) return h.send(c, { type: 'kmError', error: 'Log in first' });
        let err = null;
        if (d.type === 'kbGyms') return send(c);
        if (d.type === 'kbStart') err = start(c, d);
        else if (d.type === 'kbAct') err = actOn(c, d);
        else if (d.type === 'kbLeave') {
            if (c.kb && !c.kb.b.over) err = actOn(c, { a: 'forfeit' });
        }
        if (err) h.send(c, { type: 'kmError', error: err });
    }

    return { handle, GYMS, ZONES, FRAG_PER_PACK };
};
