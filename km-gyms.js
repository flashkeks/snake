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

const GYMS = [
    { id: 'sprout', name: 'Sprout Gym', icon: '🌱', leader: 'Scout Mika', type: 'nature', rar: ['uncommon'], mul: 0.85, smart: 1, coins: 3000, pack: 'anime' },
    { id: 'tide', name: 'Tide Gym', icon: '💧', leader: 'Captain Ren', type: 'water', rar: ['uncommon', 'rare'], mul: 0.9, smart: 2, coins: 4000, pack: 'film' },
    { id: 'blaze', name: 'Blaze Gym', icon: '🔥', leader: 'Pyra', type: 'fire', rar: ['rare'], mul: 0.95, smart: 2, coins: 5000, pack: 'anime' },
    { id: 'volt', name: 'Volt Gym', icon: '⚡', leader: 'Sparky', type: 'electric', rar: ['rare'], mul: 1, smart: 2, coins: 6500, pack: 'waifu' },
    { id: 'dojo', name: 'Iron Dojo', icon: '👊', leader: 'Master Ken', type: 'fighting', rar: ['rare', 'epic'], mul: 0.9, smart: 2, coins: 8000, pack: 'film' },
    { id: 'mind', name: 'Mind Tower', icon: '🔮', leader: 'Oracle Lua', type: 'psychic', rar: ['epic'], mul: 1.15, smart: 2, coins: 11000, pack: 'anime' },
    { id: 'shadow', name: 'Shadow Gym', icon: '🌑', leader: 'Noct', type: 'dark', rar: ['epic', 'legendary'], mul: 1, smart: 2, coins: 15000, pack: 'waifu' },
    { id: 'champ', name: 'Kek Champion', icon: '👑', leader: 'The Kek', type: null, rar: ['legendary', 'secret'], mul: 0.9, smart: 2, coins: 30000, pack: 'mixed' }
];
// Staerke per Simulation (24.09.2026, Kampfsystem 6.0, tools/km-sim.js auf edge
// mit den echten Karten; Spieler = KI-Stufe 1, Zufallsteam der Arena-Seltenheit).
// Zielkurve ~85 % bei der ersten bis ~30 % beim Champion.
const REPEAT_SHARE = 0.15, REPEAT_PER_DAY = 3;

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
    for (const g of GYMS) {
        let pool = cardDb.cards.filter(c => g.rar.includes(c.rarity) && (!g.type || c.type === g.type));
        if (pool.length < B.TEAM_SIZE) pool = cardDb.cards.filter(c => g.rar.includes(c.rarity));
        if (pool.length < B.TEAM_SIZE) pool = cardDb.cards.slice();
        pool = pool.slice().sort((a, b) => power(b) - power(a) || a.id.localeCompare(b.id));
        const team = [];
        for (const c of pool) {
            if (team.length >= B.TEAM_SIZE) break;
            if (!g.type && team.some(id => cardDb.byId[id].type === c.type)) continue;
            team.push(c.id);
        }
        for (const c of pool) if (team.length < B.TEAM_SIZE && !team.includes(c.id)) team.push(c.id);
        g.team = team;
    }
    const byId = Object.fromEntries(GYMS.map(g => [g.id, g]));

    // Reset 6.4 (Max, einmalig): Fortschritt aller Konten leeren. Coins und
    // Karten bleiben; wo der Erstsieg schon bezahlt war, gibt es ihn nicht
    // nochmal (u.kmGymsPaid = { gymId: true } -> beim neuen Erstsieg nur die
    // Wiederholungs-Belohnung). Merker je Konto: u.kmGymsV = 2.
    if (accounts.users) {
        let n = 0;
        for (const [, u] of accounts.users()) {
            if (u.kmGymsV === 2) continue;
            const old = u.kmGyms || {};
            const paid = u.kmGymsPaid || {};
            for (const [gid, st] of Object.entries(old)) if (st && st.cleared) paid[gid] = true;
            if (Object.keys(old).length) n++;
            u.kmGymsPaid = paid;
            u.kmGyms = {};
            u.kmGymsV = 2;
        }
        if (n) {
            accounts.touch();
            if (h.log) h.log(`kekemon: Gym-Fortschritt von ${n} Konten zurueckgesetzt (6.4), Erstsieg-Belohnungen gemerkt`);
        }
    }

    function progress(u) {
        u.kmGyms = u.kmGyms || {};
        return u.kmGyms;
    }

    function list(u) {
        const p = progress(u);
        let open = true;
        return GYMS.map(g => {
            const s = p[g.id] || {};
            const today = s.day === day() ? s.today || 0 : 0;
            const row = {
                id: g.id, name: g.name, icon: g.icon, leader: g.leader, type: g.type, rar: g.rar, mul: g.mul, smart: g.smart,
                coins: g.coins, repeat: Math.round(g.coins * REPEAT_SHARE), pack: g.pack, team: g.team,
                unlocked: open, cleared: !!s.cleared, wins: s.wins || 0, rewardsLeft: s.cleared ? Math.max(0, REPEAT_PER_DAY - today) : 1,
                paid: !!(u.kmGymsPaid || {})[g.id]
            };
            if (!s.cleared) open = false;
            return row;
        });
    }

    function send(c, extra) {
        const u = accounts.get(c.account);
        h.send(c, { type: 'kbState', gyms: list(u), battle: c.kb ? { gym: c.kb.gym, view: B.view(c.kb.b) } : null, ...extra });
    }

    function start(c, d) {
        const u = accounts.get(c.account);
        const g = Object.prototype.hasOwnProperty.call(byId, d.gym) ? byId[d.gym] : null;
        if (!g) return 'Unknown gym';
        if (c.kb && !c.kb.b.over) return 'Finish your current battle first';
        const row = list(u).find(x => x.id === g.id);
        if (!row.unlocked) return 'Beat the previous gym first';
        const keys = Array.isArray(d.team) ? d.team.map(String).slice(0, B.TEAM_SIZE) : [];
        if (keys.length !== B.TEAM_SIZE) return `Pick ${B.TEAM_SIZE} cards`;
        const own = u.cards || {};
        const ids = new Set();
        const mine = [];
        for (const k of keys) {
            const { id, v } = cards.parseKey(k);
            const card = cardDb.byId[id];
            if (!card || !(own[k] > 0)) return 'You do not own one of those cards';
            if (ids.has(id)) return `Pick ${B.TEAM_SIZE} different cards`;
            ids.add(id);
            mine.push(B.fighter(card, v, 1));
        }
        const foes = g.team.map(id => B.fighter(cardDb.byId[id], '', g.mul));
        const { b, ev } = B.createBattle(mine, foes, { nameA: u.name, nameB: g.leader, smart: g.smart });
        c.kb = { b, gym: g.id };
        send(c, { ev, started: true });
        return null;
    }

    function finish(c) {
        const kb = c.kb;
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

    return { handle, GYMS };
};
