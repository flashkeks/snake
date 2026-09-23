// Arena als Extraction-Shooter (Umbau 23.09.2026, vorher #7/#12).
//
// Hub (ausserhalb des Raids): Lager (u.arena.inv), Loadout (2 Waffen,
// Ruestung, bis 3 Medkits), Scrap. Kaufen im Arena-Shop, Cases oeffnen,
// Salvagen zu Scrap. Items und ihre Effekte: arena-items.js.
//
// Raid: eine grosse Map (4000 x 2800, fester Seed) mit Gebaeuden,
// Hindernissen, Loot-Kisten und vier Extraction-Punkten. Wer reingeht,
// nimmt sein Loadout mit (es verlaesst das Lager). Raus kommt man nur ueber
// einen Extraction-Punkt (6 s drin stehen): dann gehen Loadout und Rucksack
// ins Lager. Tod, Verlassen oder Verbindungsabbruch = alles weg: der Killer
// bekommt es in den Rucksack, was nicht passt, bleibt als Beutel liegen
// (ohne Killer alles als Beutel). Die Starter-Pistole ist gratis, immer da
// und geht nie verloren.
//
// Runde 2 (Feedback Max): vier Ruestungsslots mit Sets, Granaten, langsame
// Regeneration fuer alle, Raid-Inventar (ausruesten, ablegen, fallen lassen)
// und Verstecken: wer in einem Gebaeude, Busch oder Rauch steckt, ist fuer
// alle draussen unsichtbar – ausser ganz nah dran oder kurz nach einem
// eigenen Schuss (Muendungsfeuer).
// Runde 3: zwei Slots fuer Verbrauchsgut (Q und G: Heilung, Granaten,
// Zauber – Flashbang, Cluster, Nuke, Schwarzes Loch, Frost Nova, Blink …),
// Phantom-Set (unsichtbar im Stillstand), Tueren in der Karte.
//
// Der Server rechnet alles (Bewegung, Kugeln mit allen Effekten, Treffer);
// der Browser rechnet die eigene Bewegung voraus und zeichnet. Jeder bekommt
// nur, was in seiner Naehe ist (kein Map-Hack).

const I = require('./arena-items');

const SPEED = Number(process.env.SNAKE_EVENT_SPEED) || 1;

const W = 4000, H = 2800;
const R = 18;
const MOVE = 280;
const MAX_PLAYERS = 24;
const TICK_MS = 33;
const SEND_MS = 33;
const VIEW = 1400;              // so weit sieht man andere, Kugeln, Kisten
const PHANTOM_MS = 1500;         // so lange stillstehen, dann unsichtbar (4 Phantom-Teile)
const REGEN_BASE = 1;            // HP/s fuer alle ...
const REGEN_DELAY = 6000;        // ... nach so langer Zeit ohne Schaden
const REVEAL_MS = 400;           // so lange verraet ein Schuss das Versteck
const SEE_NEAR = 110;            // so nah sieht man jeden
const WALL_T = 22;
const EXTRACT_MS = 6000;
const EXTRACT_R = 95;
const CRATE_RESPAWN = 150000;
const BAG_LIFE = 5 * 60e3;
const INTERACT_R = 75;
const MED_MS = 2000;
// Events: Boss laeuft ueber die Map, Versorgungsabwurf mit Ausruestung
const BOSS_R = 44;
const BOSS_MOVE = 125;
const BOSS_EVERY = [2 * 60e3, 10 * 60e3];
const BOSS_LIFE = 8 * 60e3;
const BOSS_SLAM_R = 250;
const BOSS_NAME = 'Raccoon King';
const DROP_EVERY = [3 * 60e3, 6 * 60e3];
const DROP_WARN = 15000;

// ---------- Map (fester Seed, damit sie nach jedem Neustart gleich ist) ----------

function rng(seed) {
    return () => {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function buildMap() {
    const rand = rng(1337);
    const walls = [];
    const crates = [];
    const extracts = [
        { x: 260, y: 260 }, { x: W - 260, y: 260 }, { x: 260, y: H - 260 }, { x: W - 260, y: H - 260 }
    ];
    const overlaps = (a, b, m) => a[0] < b[0] + b[2] + m && a[0] + a[2] + m > b[0] && a[1] < b[1] + b[3] + m && a[1] + a[3] + m > b[1];
    const nearExtract = r => extracts.some(e => e.x > r[0] - 200 && e.x < r[0] + r[2] + 200 && e.y > r[1] - 200 && e.y < r[1] + r[3] + 200);
    const T = WALL_T;
    const doorRects = [];
    // Gebaeude: Rechteck mit Tueren
    const buildings = [];
    for (let k = 0; k < 400 && buildings.length < 16; k++) {
        const bw = 300 + rand() * 240, bh = 240 + rand() * 200;
        const r = [200 + rand() * (W - 400 - bw), 200 + rand() * (H - 400 - bh), bw, bh];
        if (buildings.some(b => overlaps(r, b, 160)) || nearExtract(r)) continue;
        buildings.push(r);
    }
    for (const [x, y, w, h] of buildings) {
        const sides = [
            { horiz: true, x, y, len: w },
            { horiz: true, x, y: y + h - T, len: w },
            { horiz: false, x, y, len: h },
            { horiz: false, x: x + w - T, y, len: h }
        ];
        // mindestens zwei Tueren
        const doors = new Set([Math.floor(rand() * 4)]);
        while (doors.size < 2) doors.add(Math.floor(rand() * 4));
        sides.forEach((s, i) => {
            if (doors.has(i) || rand() < 0.3) {
                const gap = 95;
                const at = 50 + rand() * (s.len - gap - 100);
                if (s.horiz) {
                    walls.push([s.x, s.y, at, T], [s.x + at + gap, s.y, s.len - at - gap, T]);
                    doorRects.push([s.x + at, s.y, gap, T]);
                } else {
                    walls.push([s.x, s.y, T, at], [s.x, s.y + at + gap, T, s.len - at - gap]);
                    doorRects.push([s.x, s.y + at, T, gap]);
                }
            } else {
                walls.push(s.horiz ? [s.x, s.y, s.len, T] : [s.x, s.y, T, s.len]);
            }
        });
        // Innen: Kisten und eine Trennwand
        const n = 1 + Math.floor(rand() * 2);
        for (let i = 0; i < n; i++) crates.push({ x: x + 60 + rand() * (w - 120), y: y + 60 + rand() * (h - 120) });
        if (rand() < 0.5) walls.push([x + w / 2 - T / 2, y + 60, T, h * 0.45]);
    }
    // Hindernisse draussen
    const obstacles = [];
    for (let k = 0; k < 2000 && obstacles.length < 90; k++) {
        // Kisten-Hindernisse entfernt (23.09.2026, Max): nur noch Felsen und Mauern
        const type = 0.35 + rand() * 0.65;
        const r = type < 0.7 ? [0, 0, 70 + rand() * 60, 50 + rand() * 50]              // Felsen
            : type < 0.85 ? [0, 0, 180 + rand() * 120, T]                         // Mauer quer
            : [0, 0, T, 180 + rand() * 120];                                      // Mauer laengs
        r[0] = 80 + rand() * (W - 160 - r[2]);
        r[1] = 80 + rand() * (H - 160 - r[3]);
        if (buildings.some(b => overlaps(r, b, 50)) || obstacles.some(o => overlaps(r, o, 70)) || nearExtract(r)) continue;
        obstacles.push(r);
    }
    walls.push(...obstacles.map(o => o.map(Math.round)));
    // Kisten draussen
    for (let k = 0; k < 500 && crates.length < 44; k++) {
        const c = { x: 150 + rand() * (W - 300), y: 150 + rand() * (H - 300) };
        if (walls.some(w => overlaps([c.x - 30, c.y - 30, 60, 60], w, 20))) continue;
        crates.push(c);
    }
    // Buesche: verstecken, blocken nicht
    const bushes = [];
    for (let k = 0; k < 3000 && bushes.length < 60; k++) {
        const r = 45 + rand() * 30;
        const b = [120 + rand() * (W - 240), 120 + rand() * (H - 240), r];
        const box = [b[0] - r, b[1] - r, 2 * r, 2 * r];
        if (walls.some(w => overlaps(box, w, 10)) || buildings.some(x => overlaps(box, x, 40)) || nearExtract(box)) continue;
        if (bushes.some(o => Math.hypot(o[0] - b[0], o[1] - b[1]) < o[2] + r + 30)) continue;
        bushes.push(b.map(Math.round));
    }
    return {
        walls: walls.map(w => w.map(Math.round)), crates: crates.map(c => ({ x: Math.round(c.x), y: Math.round(c.y) })), extracts,
        buildings: buildings.map(b => b.map(Math.round)), bushes, doors: doorRects.map(d => d.map(Math.round))
    };
}

const MAP = buildMap();

// Raster fuer schnelle Wandtests
const CELL = 200;
const GRID = new Map();
MAP.walls.forEach((w, i) => {
    for (let gx = Math.floor(w[0] / CELL); gx <= Math.floor((w[0] + w[2]) / CELL); gx++) {
        for (let gy = Math.floor(w[1] / CELL); gy <= Math.floor((w[1] + w[3]) / CELL); gy++) {
            const k = gx + ',' + gy;
            if (!GRID.has(k)) GRID.set(k, []);
            GRID.get(k).push(i);
        }
    }
});

function circleRect(x, y, r, [rx, ry, rw, rh]) {
    const cx = Math.max(rx, Math.min(x, rx + rw));
    const cy = Math.max(ry, Math.min(y, ry + rh));
    return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

function blocked(x, y, r) {
    if (x < r || y < r || x > W - r || y > H - r) return true;
    for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
        for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++) {
            const list = GRID.get(gx + ',' + gy);
            if (list && list.some(i => circleRect(x, y, r, MAP.walls[i]))) return true;
        }
    }
    return false;
}

// Bewegen mit Rutschen: in kleinen Schritten bis an die Wand heran und an
// Ecken seitlich vorbei, statt an Kanten haengenzubleiben. Dieselbe Logik
// steckt im Browser (shSlide), sonst korrigiert der Server staendig.
function slide(x, y, dx, dy, r, isBlocked = blocked) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    const sx = dx / n, sy = dy / n;
    for (let i = 0; i < n; i++) {
        if (sx) {
            if (!isBlocked(x + sx, y, r)) x += sx;
            else if (!sy) y += cornerNudge(x, y, sx, 0, r, isBlocked);
        }
        if (sy) {
            if (!isBlocked(x, y + sy, r)) y += sy;
            else if (!sx) x += cornerNudge(x, y, 0, sy, r, isBlocked);
        }
    }
    return [x, y];
}

// Steht nur eine Ecke im Weg (frei, wenn man bis 3/4 Radius ausweicht),
// einen Schritt zur freien Seite
function cornerNudge(x, y, sx, sy, r, isBlocked) {
    const step = Math.abs(sx || sy);
    for (let off = step; off <= r * 0.75; off += step) {
        for (const sgn of [1, -1]) {
            const ox = sx ? 0 : sgn * off, oy = sx ? sgn * off : 0;
            if (isBlocked(x + ox + sx, y + oy + sy, r)) continue;
            const mx = sx ? 0 : sgn * step, my = sx ? sgn * step : 0;
            if (!isBlocked(x + mx, y + my, r)) return sgn * step;
        }
    }
    return 0;
}

// Kurzform fuer den Browser
function brief(it) {
    return it ? {
        uid: it.uid, n: it.name, b: it.base, k: it.kind, t: it.tier, s: !!it.starter,
        sl: it.slot || null, o: it.odds, sc: it.score, m: it.mods && it.mods.length ? it.mods.map(m => [m.id, m.lvl]) : undefined
    } : null;
}

function starterPistol() {
    return { ...I.plain('weapon', 'pistol'), uid: 'starter', name: 'Starter pistol', starter: true };
}

const GEAR = ['primary', 'secondary', ...I.SLOTS, 'backpack'];
const L = require('./arena-level');

module.exports = function createArena(h) {
    // h: { accounts, send, feed, refresh(c), changed() }
    const players = new Map();       // client id -> Spieler im Raid
    const bullets = [];
    const crates = MAP.crates.map((c, i) => ({ id: i, x: c.x, y: c.y, readyAt: 0 }));
    const bags = [];
    const nades = [];                // Wurfsachen im Flug oder mit Zuender
    const smokes = [];               // Rauchwolken { id, x, y, r, until }
    const fires = [];                // Feuerflaechen { id, x, y, r, until, owner, dps }
    const holes = [];                // Schwarze Loecher { id, x, y, r, until, owner, dmg }
    let seqId = 0;
    let boss = null;                 // Boss auf der Map (Events weiter unten)
    let drop = null;                 // angekuendigter Versorgungsabwurf { x, y, at }
    let nextBossAt = 0, nextDropAt = 0;
    const BOSS_W = { dmg: 16, speed: 620, life: 1.5, how: 'boss' };
    let lastTick = Date.now();
    let lastSend = 0;
    const feedLog = [];

    // ---------- Hub: Lager, Loadout, Kaufen, Cases, Salvage ----------

    const EMPTY_LOADOUT = () => ({
        primary: null, secondary: null, helmet: null, vest: null, pants: null, boots: null, backpack: null, util: [null, null]
    });

    // Lager holen und alte Staende nachziehen (Runde 1/2 -> 3)
    function st(c) {
        if (!c.account) return null;
        const a = h.accounts.arena(c.account);
        if (a.v !== 3) {
            a.inv = a.inv.filter(it => { I.migrate(it); return it.v === 3; });
            const old = a.loadout || {};
            const l = EMPTY_LOADOUT();
            for (const k of ['primary', 'secondary', 'helmet', 'vest', 'pants', 'boots']) if (old[k]) l[k] = old[k];
            if (old.armor) {
                const it = a.inv.find(x => x.uid === old.armor);
                if (it) l[it.slot] = it.uid;
            }
            // Medkits und Granaten von frueher in die zwei Slots
            const cons = [];
            if (old.meds) cons.push({ base: 'medkit', n: old.meds });
            for (const [b, n] of Object.entries(old.nades || {})) if (n) cons.push({ base: b, n });
            l.util = [cons[0] || null, cons[1] || null];
            a.loadout = l;
            fixLoadout(a);
            a.v = 3;
            h.accounts.touch();
        }
        // Leveling (4.0): XP, Stat-Punkte, Skills
        if (!a.prog) {
            a.prog = L.fresh();
            h.accounts.touch();
        }
        return a;
    }

    // Fortschritt fuer den Browser (Profil)
    function progView(c, a) {
        const pr = a.prog;
        const lv = L.levelOf(pr.xp);
        const pts = L.pointsOf(pr);
        const s = (h.accounts.get(c.account).stats) || {};
        return {
            xp: pr.xp, level: lv.level, into: lv.into, need: lv.need, stats: pr.stats, skills: pr.skills, resets: pr.resets || 0,
            statFree: pts.statFree, skillFree: pts.skillFree, resetCost: L.resetCost(pr.resets),
            record: {
                raids: s.raids || 0, extracts: s.arenaExtracts || 0, kills: s.shooterKills || 0, deaths: s.shooterDeaths || 0,
                bossKills: s.bossKills || 0, npcKills: s.npcKills || 0, bestTier: s.bestTier || 0, bestScore: s.bestScore2 || 0
            }
        };
    }

    // XP gutschreiben; n schon fertig gerechnet (ohne Veteran-Bonus)
    function award(p, n, reason) {
        if (!p.account || !(n > 0)) return;
        const a = st(p.c);
        const before = L.levelOf(a.prog.xp).level;
        const got = Math.round(n * (p.b ? p.b.xp : 1));
        a.prog.xp += got;
        const after = L.levelOf(a.prog.xp).level;
        h.accounts.touch();
        h.send(p.c, { type: 'arXp', n: got, reason, level: after, up: after > before });
        if (after > before && after % 10 === 0) h.feed(`⭐ ${p.name} reached arena level ${after}!`, 'gold');
    }

    function count(a, base) {
        return a.inv.filter(it => it.kind === 'util' && it.base === base).length;
    }

    function sendHub(c, extra) {
        const a = st(c);
        if (!a) return;
        const u = h.accounts.get(c.account);
        h.send(c, {
            type: 'arHub', inv: a.inv.map(it => ({ ...it, sv: I.salvageValue(it) })), loadout: a.loadout,
            scrap: a.scrap, coins: u.coins, inRaid: players.has(c.id), prog: progView(c, a), ...extra
        });
    }

    function noteBest(key, item) {
        h.accounts.stat(key, s => {
            s.bestOdds = Math.max(s.bestOdds || 0, item.odds || 0);
            s.bestTier = Math.max(s.bestTier || 0, I.TIER_IDX[item.tier] || 0);
            s.bestScore2 = Math.max(s.bestScore2 || 0, item.score || 0);
        });
    }

    function addItems(c, items) {
        const a = st(c);
        const room = I.INV_MAX - a.inv.length;
        const kept = items.slice(0, Math.max(0, room));
        const over = items.slice(kept.length);
        a.inv.push(...kept);
        // Lager voll: der Rest wird automatisch zu Scrap
        const scrap = over.reduce((s, it) => s + I.salvageValue(it), 0);
        a.scrap += scrap;
        for (const it of kept) noteBest(c.account, it);
        h.accounts.touch();
        return { kept, over, scrap };
    }

    function pay(c, price, currency) {
        const a = st(c);
        if (currency === 'scrap') {
            if (a.scrap < price) return `You need ${price} scrap`;
            a.scrap -= price;
        } else {
            const u = h.accounts.get(c.account);
            if (u.coins < price) return `You need ${price.toLocaleString('en-US')} coins`;
            h.accounts.addCoins(c.account, -price);
            h.accounts.earn(c.account, 'shooter', -price);
            h.refresh(c);
        }
        h.accounts.touch();
        return null;
    }

    // Loadout nach Salvage/Verkauf: nichts zeigen lassen, was fehlt
    function fixLoadout(a) {
        const l = a.loadout;
        for (const s of GEAR) if (l[s] && !a.inv.some(x => x.uid === l[s])) l[s] = null;
        if (!Array.isArray(l.util)) l.util = [null, null];
        const used = {};
        l.util = l.util.map(u => {
            if (!u || !I.UTILS[u.base]) return null;
            const n = Math.min(u.n, I.UTILS[u.base].stack, count(a, u.base) - (used[u.base] || 0));
            used[u.base] = (used[u.base] || 0) + Math.max(0, n);
            return n > 0 ? { base: u.base, n } : null;
        });
    }

    function hubAction(c, d) {
        if (!c.account) return h.send(c, { type: 'arError', error: 'Log in to use the arena' });
        if (players.has(c.id) && d.type !== 'arHub') return h.send(c, { type: 'arError', error: 'You are in a raid' });
        const a = st(c);
        if (d.type === 'arHub') return sendHub(c);
        if (d.type === 'arBuy') {
            const offer = I.SHOP.find(x => x.id === d.id);
            if (!offer) return;
            const n = Math.max(1, Math.min(10, Math.floor(Number(d.n)) || 1));
            if (a.inv.length + n > I.INV_MAX) return h.send(c, { type: 'arError', error: 'Your stash is full – salvage something first' });
            const err = pay(c, offer.price * n, offer.currency);
            if (err) return h.send(c, { type: 'arError', error: err });
            const items = Array.from({ length: n }, () => offer.kind === 'gen' ? I.generate(offer.source) : I.plain(offer.kind, offer.base));
            addItems(c, items);
            return sendHub(c, { got: { ...items[0], n } });
        }
        if (d.type === 'arCase') {
            const cs = I.CASES[d.id];
            if (!cs) return;
            if (a.inv.length >= I.INV_MAX) return h.send(c, { type: 'arError', error: 'Your stash is full – salvage something first' });
            const err = pay(c, cs.price, cs.currency);
            if (err) return h.send(c, { type: 'arError', error: err });
            const item = I.generate(cs.source);
            addItems(c, [item]);
            h.accounts.stat(c.account, s => { s.casesOpened = (s.casesOpened || 0) + 1; });
            // Band fuer die Animation: Zufallsware aus demselben Case
            const reel = Array.from({ length: 34 }, () => brief(I.generate(cs.source)));
            reel[29] = brief(item);
            // Feed erst, wenn das Band im Browser steht (4 s)
            if (I.TIER_IDX[item.tier] >= 4) {
                const line = `${cs.icon} ${h.accounts.get(c.account).name} unboxed a ${I.TIERS[I.TIER_IDX[item.tier]].name} ${item.name}!`;
                setTimeout(() => h.feed(line, 'gold'), 4300);
            }
            return sendHub(c, { caseItem: { ...item, sv: I.salvageValue(item) }, reel });
        }
        if (d.type === 'arProg') {
            const pr = a.prog;
            if (d.op === 'apply') {
                const stats = {}, skills = {};
                for (const [k, n] of Object.entries(d.stats || {})) stats[k] = Math.floor(Number(n));
                for (const [k, n] of Object.entries(d.skills || {})) skills[k] = Math.floor(Number(n));
                const err = L.validate(pr, stats, skills);
                if (err) return h.send(c, { type: 'arError', error: err });
                pr.stats = Object.fromEntries(Object.entries(stats).filter(([, n]) => n > 0));
                pr.skills = Object.fromEntries(Object.entries(skills).filter(([, n]) => n > 0));
                h.accounts.touch();
                return sendHub(c, { progSaved: true });
            }
            if (d.op === 'reset') {
                const cost = L.resetCost(pr.resets);
                const u = h.accounts.get(c.account);
                if (u.coins < cost.coins) return h.send(c, { type: 'arError', error: `A reset costs ${cost.coins.toLocaleString('en-US')} coins` });
                if (a.scrap < cost.scrap) return h.send(c, { type: 'arError', error: `A reset costs ${cost.scrap.toLocaleString('en-US')} scrap` });
                if (!Object.keys(pr.stats).length && !Object.keys(pr.skills).length) return h.send(c, { type: 'arError', error: 'Nothing to reset' });
                h.accounts.addCoins(c.account, -cost.coins);
                h.accounts.earn(c.account, 'shooter', -cost.coins);
                a.scrap -= cost.scrap;
                pr.stats = {};
                pr.skills = {};
                pr.resets = (pr.resets || 0) + 1;
                h.accounts.touch();
                h.refresh(c);
                return sendHub(c, { progReset: true });
            }
            return;
        }
        if (d.type === 'arSalvage') {
            const uids = new Set((Array.isArray(d.uids) ? d.uids : []).slice(0, 300).map(String));
            const out = a.inv.filter(it => uids.has(it.uid));
            if (!out.length) return;
            const scrap = Math.round(out.reduce((s, it) => s + I.salvageValue(it), 0) * L.bonuses(a.prog).scrap);
            a.inv = a.inv.filter(it => !uids.has(it.uid));
            fixLoadout(a);
            a.scrap += scrap;
            h.accounts.touch();
            return sendHub(c, { salvaged: { count: out.length, scrap } });
        }
        if (d.type === 'arEquip') {
            const slot = String(d.slot);
            if (slot === 'util0' || slot === 'util1') {
                const i = slot === 'util0' ? 0 : 1;
                const b = d.base === null ? null : String(d.base);
                if (b === null) a.loadout.util[i] = null;
                else {
                    if (!I.UTILS[b]) return;
                    const other = a.loadout.util[1 - i];
                    const free = count(a, b) - (other && other.base === b ? other.n : 0);
                    const n = Math.max(0, Math.min(I.UTILS[b].stack, free, Math.floor(Number(d.n)) || 0));
                    a.loadout.util[i] = n ? { base: b, n } : null;
                }
            } else if (GEAR.includes(slot)) {
                if (d.uid === null) a.loadout[slot] = null;
                else {
                    const it = a.inv.find(x => x.uid === d.uid);
                    const ok = it && (slot === 'primary' || slot === 'secondary' ? it.kind === 'weapon' : slot === 'backpack' ? it.kind === 'pack' : it.kind === 'armor' && it.slot === slot);
                    if (!ok) return h.send(c, { type: 'arError', error: 'That does not fit there' });
                    // dieselbe Waffe nicht in beiden Slots
                    for (const s of ['primary', 'secondary']) if (a.loadout[s] === it.uid) a.loadout[s] = null;
                    a.loadout[slot] = it.uid;
                }
            } else return;
            h.accounts.touch();
            return sendHub(c);
        }
    }

    // ---------- Raid: rein, raus, sterben ----------

    function freeSpot(avoidPlayers) {
        for (let k = 0; k < 400; k++) {
            const x = 100 + Math.random() * (W - 200), y = 100 + Math.random() * (H - 200);
            if (blocked(x, y, R + 12)) continue;
            if (MAP.extracts.some(e => Math.hypot(e.x - x, e.y - y) < 500)) continue;
            if (avoidPlayers && [...players.values()].some(p => Math.hypot(p.x - x, p.y - y) < 700)) continue;
            return { x, y };
        }
        return { x: W / 2, y: H / 2 };
    }

    // Werte aus allen Ruestungsteilen samt Set-Bonus
    function gearStats(p) {
        const s = I.armorStats(p.gear);
        const ratio = p.maxHp ? p.hp / p.maxHp : 1;
        p.maxHp = 100 + s.hp;
        p.hp = p.hp ? Math.min(p.maxHp, Math.max(1, ratio * p.maxHp)) : p.maxHp;
        p.speedMul = s.speed;
        p.regen = s.regen;
        p.thorns = s.thorns;
        p.dodge = s.dodge;
        p.dmgMul = s.dmg;
        p.rateMul = s.rate;
        p.taken = s.taken;
        p.healMul = s.healMul;
        p.homing = s.homing;
        p.phantom = s.phantom;
        p.sets = s.sets;
        p.packMax = p.gear.backpack ? I.PACKS[p.gear.backpack.base].cap : I.BASE_PACK;
        // Level: Stats und Skills (4.0)
        const b = p.b;
        if (b) {
            const mh = Math.round((100 + s.hp + b.hp) * b.hpMul);
            p.hp = p.maxHp ? Math.min(mh, Math.max(1, p.hp / p.maxHp * mh)) : mh;
            p.maxHp = mh;
            p.speedMul *= b.speed;
            p.regen += b.regen;
            p.dmgMul *= b.dmg;
            p.rateMul *= b.rate;
            p.taken *= b.taken;
            p.healMul *= b.heal;
            p.packMax += b.pack;
        }
    }

    function join(c, name, color) {
        if (!c.account) return 'Log in to raid';
        if (players.has(c.id)) {
            sendJoined(c);
            return null;
        }
        if (players.size >= MAX_PLAYERS) return 'The raid is full';
        const a = st(c);
        const take = uid => {
            const i = uid ? a.inv.findIndex(x => x.uid === uid) : -1;
            return i >= 0 ? a.inv.splice(i, 1)[0] : null;
        };
        const takeUtil = base => {
            const i = a.inv.findIndex(x => x.kind === 'util' && x.base === base);
            return i >= 0 ? a.inv.splice(i, 1)[0] : null;
        };
        // Loadout verlaesst das Lager
        const gear = { primary: take(a.loadout.primary) || starterPistol(), secondary: take(a.loadout.secondary) };
        for (const s of [...I.SLOTS, 'backpack']) gear[s] = take(a.loadout[s]);
        const util = a.loadout.util.map(u => {
            if (!u) return null;
            let n = 0;
            for (let i = 0; i < u.n && takeUtil(u.base); i++) n++;
            return n ? { base: u.base, n } : null;
        });
        a.loadout = EMPTY_LOADOUT();
        h.accounts.touch();
        const s = freeSpot(true);
        const now = Date.now();
        const p = {
            id: c.id, c, name, account: c.account, color: color || '#ff5bd6',
            x: s.x, y: s.y, a: 0, mx: 0, my: 0, fire: false, lastShot: 0, seq: 0, lastMove: now,
            gear, slot: 'primary', util, lastUse: 0,
            pack: [], kills: 0, zone: null, smoke: null,
            hp: 0, maxHp: 0, speedMul: 1, regen: 0, thorns: 0, dodge: 0, dmgMul: 1, rateMul: 1, taken: 1, healMul: 1, homing: 0, phantom: false,
            burn: null, slowUntil: 0, slow: 0, lastHurt: 0, healUntil: 0, healRate: 0, stimUntil: 0, stim: 0,
            extractAt: null, joinedAt: now, protect: now + 3000 / SPEED,
            b: L.bonuses(a.prog), level: L.levelOf(a.prog.xp).level, windUsed: false, lastUsed: false, adrenCd: 0, rampUntil: 0
        };
        gearStats(p);
        players.set(c.id, p);
        h.accounts.stat(c.account, st2 => { st2.raids = (st2.raids || 0) + 1; });
        sendJoined(c);
        sendInv(p);
        h.changed();
        return null;
    }

    function sendJoined(c) {
        h.send(c, {
            type: 'shJoined', id: c.id,
            map: {
                w: W, h: H, walls: MAP.walls, buildings: MAP.buildings, doors: MAP.doors, bushes: MAP.bushes, wallT: WALL_T,
                extracts: MAP.extracts, extractR: EXTRACT_R, r: R, move: MOVE, view: VIEW, throwRange: I.THROW_RANGE
            },
            packMax: p0PackMax(c), feed: feedLog.slice(-6)
        });
    }

    function p0PackMax(c) {
        const p = players.get(c.id);
        return p ? p.packMax : I.BASE_PACK;
    }

    // Rucksack und Ausruestung an den Spieler (Raid-Inventar)
    function sendInv(p) {
        const gear = {};
        for (const s of GEAR) gear[s] = brief(p.gear[s]);
        h.send(p.c, { type: 'shInv', gear, pack: p.pack.map(brief), util: p.util, packMax: p.packMax, sets: p.sets });
    }

    // Verbrauchsgut stapelt sich in die Slots, alles andere in den Rucksack.
    // Rueckgabe: was nicht passte
    function pickUp(p, items) {
        const rest = [];
        for (const it of items) {
            if (it.kind === 'util') {
                const def = I.UTILS[it.base];
                const same = p.util.findIndex(u => u && u.base === it.base && u.n < def.stack);
                if (same >= 0) { p.util[same].n++; continue; }
                const empty = p.util.findIndex(u => !u);
                if (empty >= 0) { p.util[empty] = { base: it.base, n: 1 }; continue; }
            }
            if (p.pack.length < p.packMax) p.pack.push(it);
            else rest.push(it);
        }
        return rest;
    }

    function utilItems(p) {
        const out = [];
        for (const u of p.util) if (u) for (let i = 0; i < u.n; i++) out.push(I.plain('util', u.base));
        return out;
    }

    // Was jemand am Leib und im Rucksack hat (ohne Starter-Pistole)
    function lootOf(p) {
        const items = GEAR.map(s => p.gear[s]).filter(it => it && !it.starter);
        return items.concat(utilItems(p), p.pack);
    }

    // kind: undefined = Beutel eines Toten, 'drop' = Versorgungsabwurf, 'boss' = Boss-Beute
    function dropBag(x, y, items, kind) {
        if (!items.length) return;
        bags.push({ id: ++seqId, x, y, items, kind, expires: Date.now() + BAG_LIFE });
    }

    // Tod, Verlassen, Abbruch: Raid vorbei, alles weg
    function die(p, killer, how) {
        if (!players.has(p.id)) return;
        players.delete(p.id);
        const loot = lootOf(p);
        let rest = loot;
        award(p, L.XP.minute * Math.floor((Date.now() - p.joinedAt) / 60000), 'time in raid');
        if (killer && players.has(killer.id)) {
            award(killer, L.XP.kill + 10 * Math.max(0, (p.level || 1) - (killer.level || 1)), 'kill');
            if (killer.b.bloodlust) killer.hp = Math.min(killer.maxHp, killer.hp + killer.b.bloodlust);
            if (killer.b.rampage) killer.rampUntil = Date.now() + 4000 / SPEED;
            rest = pickUp(killer, loot);
            killer.kills++;
            const got = loot.filter(it => !rest.includes(it));
            if (got.length) h.send(killer.c, { type: 'shLoot', from: p.name, items: got.map(brief), full: rest.length > 0 });
            sendInv(killer);
        }
        dropBag(p.x, p.y, rest);
        if (p.account) {
            h.accounts.stat(p.account, s => { s.shooterDeaths = (s.shooterDeaths || 0) + 1; });
            if (killer && killer.account) {
                h.accounts.stat(killer.account, s => { s.shooterKills = (s.shooterKills || 0) + 1; });
                h.accounts.period(killer.account, x => { x.arenaKills++; });
            }
        }
        const w = killer ? (killer.gear[killer.slot] || killer.gear.primary) : null;
        const line = { killer: killer ? killer.name : how === 'boss' ? '🦝 ' + BOSS_NAME : null, victim: p.name, how, weapon: w ? w.name : null, tier: w ? w.tier : null, loot: loot.length };
        feedLog.push(line);
        if (feedLog.length > 20) feedLog.shift();
        for (const q of players.values()) h.send(q.c, { type: 'shKill', ...line });
        h.send(p.c, { type: 'shLeft', result: how === 'left' ? 'left' : 'died', by: killer ? killer.name : how === 'boss' ? BOSS_NAME : null, lost: loot.map(brief) });
        h.changed();
    }

    function extract(p, silent) {
        if (!players.has(p.id)) return;
        players.delete(p.id);
        const r = addItems(p.c, lootOf(p));
        // Mitgebrachtes wieder ins Loadout, soweit noch da
        const a = st(p.c);
        a.loadout = EMPTY_LOADOUT();
        for (const s of GEAR) {
            const it = p.gear[s];
            if (it && !it.starter && a.inv.some(x => x.uid === it.uid)) a.loadout[s] = it.uid;
        }
        a.loadout.util = p.util.map(u => u ? { ...u } : null);
        fixLoadout(a);
        h.accounts.stat(p.account, s => { s.arenaExtracts = (s.arenaExtracts || 0) + 1; });
        if (!silent) {
            award(p, L.XP.extract + L.XP.extractItem * p.pack.length + L.XP.minute * Math.floor((Date.now() - p.joinedAt) / 60000), 'extracted');
            h.send(p.c, { type: 'shLeft', result: 'extracted', items: p.pack.map(brief), scrap: r.scrap });
            const best = p.pack.reduce((b, it) => !b || (it.score || 0) > (b.score || 0) ? it : b, null);
            if (best && I.TIER_IDX[best.tier] >= 4) h.feed(`🚁 ${p.name} extracted with a ${I.TIERS[I.TIER_IDX[best.tier]].name} ${best.name}`, 'gold');
        }
        h.changed();
    }

    function leave(c) {
        const p = players.get(c.id);
        if (!p) return false;
        die(p, null, 'left');
        return true;
    }

    // Server faehrt herunter: alle gelten als extrahiert
    function refundAll() {
        for (const p of [...players.values()]) extract(p, true);
    }

    function input(c, d) {
        const p = players.get(c.id);
        if (!p) return;
        const mx = Number(d.mx), my = Number(d.my), a = Number(d.a);
        if (Number.isFinite(mx) && Number.isFinite(my)) {
            const len = Math.hypot(mx, my);
            p.mx = len > 1 ? mx / len : mx;
            p.my = len > 1 ? my / len : my;
        }
        if (Number.isFinite(a)) p.a = a;
        p.fire = !!d.f;
        if (Number.isInteger(d.s)) p.seq = d.s;
    }

    function action(c, d) {
        const p = players.get(c.id);
        if (!p) return;
        const now = Date.now();
        if (d.type === 'shSlot') {
            const s = d.slot === 'secondary' ? 'secondary' : 'primary';
            if (p.gear[s]) p.slot = s;
        } else if (d.type === 'shUse') {
            useUtil(p, d.slot === 1 ? 1 : 0, Number(d.x), Number(d.y), now);
        } else if (d.type === 'shInteract') {
            interact(p);
        } else if (d.type === 'shInv') {
            invOp(p, d);
        }
    }

    // Raid-Inventar: ausruesten, ablegen, fallen lassen, Verbrauchsgut in Slots
    function invOp(p, d) {
        const slots = GEAR;
        if (d.op === 'equip') {
            const i = p.pack.findIndex(x => x.uid === d.uid);
            if (i < 0) return;
            const it = p.pack[i];
            if (it.kind === 'util') {
                // ganzen Stapel aus dem Rucksack in einen Slot
                const si = d.slot === 1 || d.slot === '1' ? 1 : 0;
                const def = I.UTILS[it.base];
                const old = p.util[si];
                if (old && old.base !== it.base) for (let k = 0; k < old.n; k++) p.pack.push(I.plain('util', old.base));
                let n = old && old.base === it.base ? old.n : 0;
                for (let k = p.pack.length - 1; k >= 0 && n < def.stack; k--) {
                    if (p.pack[k].kind === 'util' && p.pack[k].base === it.base) {
                        p.pack.splice(k, 1);
                        n++;
                    }
                }
                p.util[si] = { base: it.base, n };
            } else {
                const slot = it.kind === 'armor' ? it.slot : it.kind === 'pack' ? 'backpack' : (d.slot === 'secondary' ? 'secondary' : 'primary');
                const old = p.gear[slot];
                // Rucksack tauschen: der neue muss alles fassen (samt dem alten)
                if (slot === 'backpack' && I.PACKS[it.base].cap < p.pack.length - 1 + (old ? 1 : 0)) return h.send(p.c, { type: 'shLoot', items: [], full: true });
                p.pack.splice(i, 1);
                if (old && !old.starter) p.pack.push(old);
                p.gear[slot] = it;
                if (slot === 'primary' || slot === 'secondary') p.slot = slot;
            }
        } else if (d.op === 'unequip') {
            const slot = String(d.slot);
            if (slot === 'util0' || slot === 'util1') {
                const si = slot === 'util0' ? 0 : 1;
                const u = p.util[si];
                if (!u) return;
                if (p.pack.length + u.n > p.packMax) return h.send(p.c, { type: 'shLoot', items: [], full: true });
                for (let k = 0; k < u.n; k++) p.pack.push(I.plain('util', u.base));
                p.util[si] = null;
            } else {
                if (!slots.includes(slot) || !p.gear[slot] || p.gear[slot].starter) return;
                const cap = slot === 'backpack' ? I.BASE_PACK : p.packMax;
                if (p.pack.length >= cap) return h.send(p.c, { type: 'shLoot', items: [], full: true });
                p.pack.push(p.gear[slot]);
                p.gear[slot] = slot === 'primary' ? starterPistol() : null;
                if (slot === 'secondary' && p.slot === 'secondary') p.slot = 'primary';
            }
        } else if (d.op === 'drop') {
            const i = p.pack.findIndex(x => x.uid === d.uid);
            if (i < 0) return;
            dropBag(p.x + Math.cos(p.a) * 30, p.y + Math.sin(p.a) * 30, p.pack.splice(i, 1));
        } else return;
        gearStats(p);
        sendInv(p);
    }

    // Naechste Kiste oder naechster Beutel in Reichweite
    function interact(p) {
        const now = Date.now();
        let best = null, bd = INTERACT_R;
        for (const cr of crates) {
            const dd = Math.hypot(cr.x - p.x, cr.y - p.y);
            if (now >= cr.readyAt && dd < bd) { best = { cr }; bd = dd; }
        }
        for (const b of bags) {
            const dd = Math.hypot(b.x - p.x, b.y - p.y);
            if (dd < bd) { best = { b }; bd = dd; }
        }
        if (!best) return;
        let got = [];
        if (best.cr) {
            best.cr.readyAt = now + CRATE_RESPAWN;
            const n = 1 + Math.floor(Math.random() * 2) + (Math.random() < p.b.loot ? 1 : 0);
            got = Array.from({ length: n }, () => I.generate('crate'));
            award(p, L.XP.crate, 'crate');
        } else {
            got = best.b.items;
            bags.splice(bags.indexOf(best.b), 1);
        }
        const rest = pickUp(p, got);
        if (rest.length) dropBag(p.x + 20, p.y + 20, rest);
        h.send(p.c, { type: 'shLoot', items: got.filter(it => !rest.includes(it)).map(brief), full: rest.length > 0 });
        sendInv(p);
    }

    // ---------- Verbrauchsgut ----------

    function useUtil(p, si, tx, ty, now) {
        const u = p.util[si];
        if (!u || now - p.lastUse < 600 * p.b.utilCd / SPEED) return;
        const def = I.UTILS[u.base];
        if (def.use === 'heal') {
            if (def.full) {
                p.hp = p.maxHp;
                p.protect = now + def.protect / SPEED;
            } else {
                if (p.hp >= p.maxHp && !def.speed) return;
                const amount = def.heal * p.healMul;
                if (def.ms) {
                    p.healUntil = now + def.ms / SPEED;
                    p.healRate = amount / (def.ms / 1000);
                } else p.hp = Math.min(p.maxHp, p.hp + amount);
                if (def.speed) {
                    p.stimUntil = now + def.speedMs / SPEED;
                    p.stim = def.speed;
                }
            }
            fxAt(p.x, p.y, { type: 'shFx', kind: def.full ? 'phoenix' : 'heal', x: Math.round(p.x), y: Math.round(p.y) });
        } else if (def.use === 'throw') {
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
            throwNade(p, u.base, tx, ty, now);
        } else if (u.base === 'frostnova') {
            fxAt(p.x, p.y, { type: 'shFx', kind: 'nova', x: Math.round(p.x), y: Math.round(p.y), r: def.r });
            for (const q of near(p.x, p.y, def.r)) {
                if (q === p) continue;
                q.slow = Math.max(now < q.slowUntil ? q.slow : 0, def.slow);
                q.slowUntil = now + def.slowMs / SPEED;
                damage(q, p, def.dmg, now, q.x, q.y, { how: 'frost', noDodge: true });
            }
        } else if (u.base === 'blink') {
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
            let dx = tx - p.x, dy = ty - p.y;
            const d = Math.hypot(dx, dy) || 1;
            let dist = Math.min(def.range, d);
            dx /= d;
            dy /= d;
            while (dist > 20 && blocked(p.x + dx * dist, p.y + dy * dist, R)) dist -= 15;
            if (dist <= 20) return;
            const from = [Math.round(p.x), Math.round(p.y)];
            p.x += dx * dist;
            p.y += dy * dist;
            p.lastMove = now;
            fxAt(p.x, p.y, { type: 'shFx', kind: 'blink', x: Math.round(p.x), y: Math.round(p.y), from });
        }
        p.lastUse = now;
        u.n--;
        if (u.n <= 0) p.util[si] = null;
        sendInv(p);
    }

    function throwNade(p, base, tx, ty, now) {
        const def = I.UTILS[base];
        let dx = tx - p.x, dy = ty - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const dist = Math.min(I.THROW_RANGE, d);
        dx /= d;
        dy /= d;
        const flight = Math.max(250, dist / 800 * 1000) / SPEED;
        nades.push({
            id: ++seqId, owner: p.id, base, def, x: p.x + dx * (R + 8), y: p.y + dy * (R + 8),
            vx: dx * dist / (flight / 1000), vy: dy * dist / (flight / 1000),
            landAt: now + flight, fuseAt: def.fuse ? now + def.fuse / SPEED : 0, landed: false
        });
    }

    // Freie Sicht zwischen zwei Punkten
    function clear(x1, y1, x2, y2) {
        const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 20);
        for (let i = 1; i < n; i++) if (blocked(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, 2)) return false;
        return true;
    }

    // Explosion mit Abfall nach aussen; walls = Waende schirmen ab
    function blast(g, x, y, r, dmg, now, walls, how) {
        const owner = players.get(g.owner) || null;
        if (owner && how !== 'fire') dmg *= owner.b.expl;
        fxAt(x, y, { type: 'shBoom', x: Math.round(x), y: Math.round(y), r, nuke: !!g.def.nuke, hole: how === 'blackhole' });
        for (const q of near(x, y, r + R)) {
            if (walls && !clear(x, y, q.x, q.y)) continue;
            const k = 1 - Math.hypot(q.x - x, q.y - y) / (r + R) * 0.6;
            damage(q, q === owner ? null : owner, dmg * k, now, q.x, q.y, { how, noDodge: true });
        }
        if (boss && Math.hypot(boss.x - x, boss.y - y) < r + BOSS_R && (!walls || clear(x, y, boss.x, boss.y))) {
            hurtBoss(owner, dmg * (1 - Math.hypot(boss.x - x, boss.y - y) / (r + BOSS_R) * 0.6), now, boss.x, boss.y);
        }
    }

    function nadeTick(now, dt) {
        for (let i = nades.length - 1; i >= 0; i--) {
            const g = nades[i];
            if (!g.landed) {
                const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
                if (blocked(nx, ny, 6) || now >= g.landAt) g.landed = true;
                else {
                    g.x = nx;
                    g.y = ny;
                }
            }
            const def = g.def;
            // mit Zuender: erst wenn er abgelaufen ist (auch im Flug), sonst bei Landung
            if (def.fuse ? now < g.fuseAt : !g.landed) continue;
            if (g.base === 'frag' || g.base === 'cluster' || g.bit) {
                blast(g, g.x, g.y, def.r, def.dmg, now, true, 'grenade');
                if (g.base === 'cluster') {
                    for (let k = 0; k < def.bits; k++) {
                        const a = Math.random() * Math.PI * 2, rr = 60 + Math.random() * 90;
                        nades.push({
                            id: ++seqId, owner: g.owner, base: 'frag', bit: true, def: { r: 80, dmg: 45, fuse: 1 }, x: g.x, y: g.y,
                            vx: Math.cos(a) * rr * 2.5, vy: Math.sin(a) * rr * 2.5, landAt: now + 400 / SPEED, fuseAt: now + (450 + k * 90) / SPEED, landed: false
                        });
                    }
                }
            } else if (g.base === 'nuke') {
                blast(g, g.x, g.y, def.r, def.dmg, now, false, 'nuke');
            } else if (g.base === 'flash') {
                fxAt(g.x, g.y, { type: 'shFx', kind: 'flash', x: Math.round(g.x), y: Math.round(g.y), r: def.r });
                for (const q of near(g.x, g.y, def.r)) {
                    if (!clear(g.x, g.y, q.x, q.y)) continue;
                    h.send(q.c, { type: 'shFlash', ms: Math.round(def.blind * (1 - Math.hypot(q.x - g.x, q.y - g.y) / def.r * 0.5)) });
                }
            } else if (g.base === 'smoke') {
                smokes.push({ id: g.id, x: g.x, y: g.y, r: def.r, until: now + def.dur / SPEED });
            } else if (g.base === 'molotov' || g.base === 'fireball') {
                if (def.dmg) blast(g, g.x, g.y, def.r * 0.6, def.dmg, now, true, 'fire');
                fires.push({ id: g.id, x: g.x, y: g.y, r: def.r, until: now + def.dur / SPEED, owner: g.owner, dps: def.dps });
            } else if (g.base === 'blackhole') {
                holes.push({ id: g.id, x: g.x, y: g.y, r: def.r, until: now + def.pull / SPEED, owner: g.owner, dmg: def.dmg, def });
                fxAt(g.x, g.y, { type: 'shFx', kind: 'hole', x: Math.round(g.x), y: Math.round(g.y) });
            }
            nades.splice(i, 1);
        }
        for (let i = smokes.length - 1; i >= 0; i--) if (now > smokes[i].until) smokes.splice(i, 1);
        for (let i = fires.length - 1; i >= 0; i--) if (now > fires[i].until) fires.splice(i, 1);
        // Schwarze Loecher ziehen an und fallen dann zusammen
        for (let i = holes.length - 1; i >= 0; i--) {
            const o = holes[i];
            if (now > o.until) {
                holes.splice(i, 1);
                blast(o, o.x, o.y, o.r, o.dmg, now, false, 'blackhole');
                continue;
            }
            for (const q of near(o.x, o.y, o.r * 1.4)) {
                const d = Math.hypot(o.x - q.x, o.y - q.y);
                if (d < 8) continue;
                const pull = 240 * dt;
                const nx = q.x + (o.x - q.x) / d * pull, ny = q.y + (o.y - q.y) / d * pull;
                if (!blocked(nx, q.y, R)) q.x = nx;
                if (!blocked(q.x, ny, R)) q.y = ny;
            }
        }
    }

    // ---------- Sichtbarkeit: Gebaeude, Buesche, Rauch, Phantom ----------

    function zoneOf(x, y) {
        for (let i = 0; i < MAP.buildings.length; i++) {
            const [bx, by, bw, bh] = MAP.buildings[i];
            if (x > bx + WALL_T && x < bx + bw - WALL_T && y > by + WALL_T && y < by + bh - WALL_T) return 'b' + i;
        }
        for (let i = 0; i < MAP.bushes.length; i++) {
            const [ux, uy, ur] = MAP.bushes[i];
            if (Math.hypot(x - ux, y - uy) < ur) return 'u' + i;
        }
        return null;
    }

    function stillHidden(t, now) {
        return t.phantom && now - t.lastMove > PHANTOM_MS && now - t.lastShot > PHANTOM_MS;
    }

    // Sieht v den Spieler t? Versteckt ist, wer in einem Gebaeude, Busch oder
    // Rauch steckt, in dem v nicht auch steckt, oder mit 4 Phantom-Teilen
    // stillsteht. Ganz nah dran oder kurz nach einem eigenen Schuss sieht man jeden.
    function canSee(v, t, now) {
        if (v === t) return true;
        if (Math.hypot(v.x - t.x, v.y - t.y) < SEE_NEAR) return true;
        if (now - t.lastShot < REVEAL_MS * t.b.reveal) return true;
        if (stillHidden(t, now)) return false;
        if (t.smoke !== null && v.smoke !== t.smoke) return false;
        if (t.zone && v.zone !== t.zone) return false;
        return true;
    }

    // ---------- Kampf ----------

    function shoot(p, now) {
        const item = p.gear[p.slot] || p.gear.primary;
        const w = { ...I.weaponStats(item) };
        w.dmg *= p.dmgMul;
        w.ms /= p.rateMul;
        w.homing += p.homing;
        w.crit = (w.crit || 0) + p.b.crit;
        if (now < p.rampUntil) w.ms /= 1.25;
        if (now - p.lastShot < w.ms / SPEED) return;
        p.lastShot = now;
        if (w.beam) return railBeam(p, w, now);
        for (let k = 0; k < w.pellets; k++) {
            const off = w.pellets > 1 ? (k / (w.pellets - 1) - 0.5) * Math.max(w.spread, 0.08 * w.pellets) : (Math.random() - 0.5) * w.spread;
            const a = p.a + off;
            bullets.push({
                id: ++seqId, owner: p.id,
                x: p.x + Math.cos(a) * (R + 6), y: p.y + Math.sin(a) * (R + 6),
                vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
                dies: now + w.life * 1000 / SPEED, w, pierce: w.pierce, bounce: w.bounce, hits: new Set(),
                fx: (w.explode ? 1 : 0) | (w.burn ? 2 : 0) | (w.frost ? 4 : 0) | (w.tesla ? 8 : 0) | (w.homing ? 16 : 0) | (w.flame ? 32 : 0) | (w.nukeShell ? 64 : 0) | (w.hole ? 128 : 0) |
                    (w.rocket ? 256 : 0) | (w.magic ? 512 : 0),
                tier: I.TIER_IDX[item.tier] || 0
            });
        }
    }

    // Railgun: sofortiger Strahl durch Waende und alle Gegner auf der Linie
    function railBeam(p, w, now) {
        const len = w.speed * w.life;
        const dx = Math.cos(p.a), dy = Math.sin(p.a);
        const x1 = p.x + dx * (R + 6), y1 = p.y + dy * (R + 6);
        const x2 = p.x + dx * len, y2 = p.y + dy * len;
        fxAt(p.x, p.y, { type: 'shBeam', x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2), owner: p.id });
        for (const q of [...players.values()]) {
            if (q === p) continue;
            const t = (q.x - p.x) * dx + (q.y - p.y) * dy;
            if (t < 0 || t > len) continue;
            const perp = Math.abs((q.x - p.x) * dy - (q.y - p.y) * dx);
            if (perp > R + 10) continue;
            hitPlayer({ owner: p.id, w, x: q.x, y: q.y, hits: new Set() }, q, now);
        }
        if (boss) {
            const t = (boss.x - p.x) * dx + (boss.y - p.y) * dy;
            if (t >= 0 && t <= len && Math.abs((boss.x - p.x) * dy - (boss.y - p.y) * dx) < BOSS_R + 10) hurtBoss(p, w.dmg, now, boss.x, boss.y);
        }
    }

    // Schwarzes Loch der Singularity an einer Stelle
    function bulletHole(b, now) {
        holes.push({ id: ++seqId, x: b.x, y: b.y, r: 240, until: now + 1100 / SPEED, owner: b.owner, dmg: b.w.dmg * 1.8, def: {} });
        fxAt(b.x, b.y, { type: 'shFx', kind: 'hole', x: Math.round(b.x), y: Math.round(b.y) });
    }

    function near(x, y, r) {
        return [...players.values()].filter(q => Math.hypot(q.x - x, q.y - y) < r);
    }

    function fxAt(x, y, msg) {
        for (const q of near(x, y, VIEW)) h.send(q.c, msg);
    }

    // Schaden mit allen Folgen; true = tot
    function damage(v, attacker, dmg, now, x, y, opts = {}) {
        if (!players.has(v.id) || now < v.protect) return false;
        if (!opts.noDodge && v.dodge && Math.random() < v.dodge) {
            if (attacker) h.send(attacker.c, { type: 'shHit', x: Math.round(x), y: Math.round(y), dmg: 0, dodge: true });
            return false;
        }
        if (attacker && attacker.b && attacker.b.exec && v.hp < v.maxHp * 0.3) dmg *= 1 + attacker.b.exec;
        if (opts.how === 'fire') dmg *= v.b.fire;
        if (v.b.iron && v.hp < v.maxHp / 2) dmg *= 0.85;
        dmg *= v.taken;
        v.hp -= dmg;
        v.lastHurt = now;
        v.extractAt = null;
        let killed = v.hp <= 0 || (opts.execute && v.hp <= v.maxHp * opts.execute);
        // Last stand: einmal je Raid bleibt man mit 1 HP stehen
        if (killed && v.b.last && !v.lastUsed) {
            v.lastUsed = true;
            v.hp = 1;
            v.protect = now + 2000 / SPEED;
            killed = false;
            h.send(v.c, { type: 'shEvent', text: '🛐 Last stand!', kind: 'self' });
        }
        if (!killed && v.b.wind && !v.windUsed && v.hp < v.maxHp * 0.2) {
            v.windUsed = true;
            v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.4);
            h.send(v.c, { type: 'shEvent', text: '🌬️ Second wind!', kind: 'self' });
        }
        if (!killed && v.b.adren && now > v.adrenCd && !opts.dot) {
            v.adrenCd = now + 15000 / SPEED;
            v.stim = Math.max(now < v.stimUntil ? v.stim : 0, 0.3);
            v.stimUntil = now + 3000 / SPEED;
        }
        // Schaden ueber Zeit (Brennen, Feuer) meldet sich nur beim Getroffenen als Rand
        if (attacker && (!opts.dot || killed)) h.send(attacker.c, { type: 'shHit', x: Math.round(x), y: Math.round(y), dmg: Math.round(dmg), kill: killed, crit: !!opts.crit });
        if (!opts.dot && (dmg >= 1 || killed)) h.send(v.c, { type: 'shHurt', dmg: Math.round(dmg) });
        // Dornen: Teil des Schadens zurueck
        if (attacker && v.thorns && !opts.thorns && players.has(attacker.id)) damage(attacker, v, dmg * v.thorns, now, attacker.x, attacker.y, { thorns: true, noDodge: true });
        if (killed) die(v, attacker && players.has(attacker.id) ? attacker : null, opts.how || 'shot');
        return killed;
    }

    function hitPlayer(b, v, now) {
        const shooter = players.get(b.owner);
        const w = b.w;
        let dmg = w.dmg;
        const crit = w.crit && Math.random() < w.crit;
        if (crit) dmg *= shooter ? shooter.b.critMul : 2;
        const killed = damage(v, shooter, dmg, now, b.x, b.y, { crit, execute: w.execute, how: w.how });
        if (shooter && w.vamp) shooter.hp = Math.min(shooter.maxHp, shooter.hp + dmg * w.vamp);
        if (!killed && players.has(v.id)) {
            if (w.burn) v.burn = { dps: w.burn, until: now + 3000 / SPEED, from: b.owner };
            if (w.frost) {
                v.slow = Math.max(now < v.slowUntil ? v.slow : 0, w.frost);
                v.slowUntil = now + 1500 / SPEED;
            }
        }
        if (w.tesla) {
            const others = near(v.x, v.y, 260).filter(q => q.id !== b.owner && q.id !== v.id).slice(0, 2);
            if (others.length) fxAt(v.x, v.y, { type: 'shZap', pts: [[v.x, v.y], ...others.map(q => [Math.round(q.x), Math.round(q.y)])] });
            for (const q of others) damage(q, shooter, w.dmg * 0.5, now, q.x, q.y, { how: 'tesla' });
        }
        if (w.hole) bulletHole(b, now);
        // Mini-Nuke trifft auch den direkt Getroffenen voll
        if (w.explode) explode(b, now, w.nukeShell ? null : v.id);
    }

    function explode(b, now, skipId) {
        const w = b.w;
        const r = w.nukeShell ? 300 : 70 + w.explode * 40;
        fxAt(b.x, b.y, { type: 'shBoom', x: Math.round(b.x), y: Math.round(b.y), r: Math.round(r), nuke: !!w.nukeShell });
        const shooter = players.get(b.owner);
        for (const q of near(b.x, b.y, r + R)) {
            if (q.id === b.owner || q.id === skipId) continue;
            damage(q, shooter, w.dmg * w.explode * (shooter ? shooter.b.expl : 1), now, q.x, q.y, { how: 'explosion' });
        }
        if (boss && b.owner !== 'boss' && Math.hypot(boss.x - b.x, boss.y - b.y) < r + BOSS_R) hurtBoss(shooter, w.dmg * w.explode, now, boss.x, boss.y);
    }

    // ---------- Events: Boss und Versorgungsabwurf ----------

    const randIn = ([a, b]) => a + Math.random() * (b - a);

    function announce(text, kind) {
        for (const q of players.values()) h.send(q.c, { type: 'shEvent', text, kind });
    }

    function spawnBoss(now) {
        const s = freeSpot(true);
        const hp = 5000 + 2500 * players.size;
        boss = {
            x: s.x, y: s.y, a: 0, hp, maxHp: hp, tx: s.x, ty: s.y, stuck: 0, born: now,
            nextShot: now + 1500, nextRing: now + 6000, nextSlam: now + 8000, slamAt: 0, dmgBy: new Map()
        };
        announce(`👑 The ${BOSS_NAME} is roaming the map – kill it for Sovereign loot!`, 'boss');
    }

    function spawnDrop(now) {
        const s = freeSpot(false);
        drop = { x: s.x, y: s.y, at: now + DROP_WARN / SPEED };
        announce('📦 Supply drop incoming – check the map!', 'drop');
    }

    function hurtBoss(attacker, dmg, now, x, y, crit) {
        if (!boss || dmg <= 0) return;
        if (attacker && attacker.b) dmg *= attacker.b.hunt;
        boss.hp -= dmg;
        if (attacker && attacker.account) boss.dmgBy.set(attacker.id, (boss.dmgBy.get(attacker.id) || 0) + Math.min(dmg, boss.hp + dmg));
        const dead = boss.hp <= 0;
        if (attacker && players.has(attacker.id)) h.send(attacker.c, { type: 'shHit', x: Math.round(x), y: Math.round(y), dmg: Math.round(dmg), kill: dead, crit: !!crit });
        if (dead) bossDies(attacker && players.has(attacker.id) ? attacker : null);
    }

    function bossDies(killer) {
        const b = boss;
        boss = null;
        nextBossAt = Date.now() + randIn(BOSS_EVERY) / SPEED;
        // drei Beutel mit je einem Item, jeder darf sie sich schnappen
        for (let i = 0; i < 3; i++) {
            const a = i / 3 * Math.PI * 2;
            const x = b.x + Math.cos(a) * 55, y = b.y + Math.sin(a) * 55;
            dropBag(blocked(x, y, 10) ? b.x : x, blocked(x, y, 10) ? b.y : y, [I.generate('boss')], 'boss');
        }
        fxAt(b.x, b.y, { type: 'shBoom', x: Math.round(b.x), y: Math.round(b.y), r: 220, nuke: false });
        const line = { killer: killer ? killer.name : null, victim: '🦝 ' + BOSS_NAME, how: 'shot', loot: 3 };
        feedLog.push(line);
        if (feedLog.length > 20) feedLog.shift();
        for (const q of players.values()) h.send(q.c, { type: 'shKill', ...line });
        announce(`👑 ${killer ? killer.name + ' killed' : 'Down goes'} the ${BOSS_NAME}! 3 items dropped`, 'boss');
        if (killer && killer.account) h.accounts.stat(killer.account, s => { s.bossKills = (s.bossKills || 0) + 1; });
        // XP: Todesstoss, dazu Anteil nach Schaden fuer alle, die mitgemacht haben
        if (killer) award(killer, L.XP.boss, 'boss');
        const total = [...b.dmgBy.values()].reduce((s, n) => s + n, 0);
        for (const [id, n] of b.dmgBy) {
            const q = players.get(id);
            if (q && total > 0) award(q, L.XP.bossHelp * n / total, 'boss damage');
        }
    }

    function bossBullet(a, now) {
        bullets.push({
            id: ++seqId, owner: 'boss',
            x: boss.x + Math.cos(a) * (BOSS_R + 6), y: boss.y + Math.sin(a) * (BOSS_R + 6),
            vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
            dies: now + 1500 / SPEED, w: BOSS_W, pierce: 0, bounce: 0, hits: new Set(), fx: 1024, tier: 5
        });
    }

    function bossTick(now, dt) {
        const b = boss;
        if (now - b.born > BOSS_LIFE / SPEED) {
            boss = null;
            nextBossAt = now + randIn(BOSS_EVERY) / SPEED;
            announce(`👑 The ${BOSS_NAME} got bored and left.`, 'boss');
            return;
        }
        // Ziel: naechster Spieler in 700 mit freier Sicht, der sich nicht versteckt
        let tgt = null, td = 700;
        for (const q of players.values()) {
            if (now < q.protect) continue;
            const d = Math.hypot(q.x - b.x, q.y - b.y);
            if (d >= td) continue;
            const hidden = d > SEE_NEAR && now - q.lastShot >= REVEAL_MS * q.b.reveal && (q.zone || q.smoke !== null || stillHidden(q, now));
            if (!hidden && clear(b.x, b.y, q.x, q.y)) {
                tgt = q;
                td = d;
            }
        }
        // Stampfer: kuendigt sich an, steht dabei still
        if (b.slamAt) {
            if (now >= b.slamAt) {
                b.slamAt = 0;
                b.nextSlam = now + 7000 / SPEED;
                fxAt(b.x, b.y, { type: 'shBoom', x: Math.round(b.x), y: Math.round(b.y), r: BOSS_SLAM_R, nuke: false });
                for (const q of near(b.x, b.y, BOSS_SLAM_R + R)) damage(q, null, 70, now, q.x, q.y, { how: 'boss', noDodge: true });
            }
            return;
        }
        if (now >= b.nextSlam && near(b.x, b.y, BOSS_SLAM_R).length) {
            b.slamAt = now + 900 / SPEED;
            return;
        }
        // Laufen: auf das Ziel zu (Abstand halten) oder zum naechsten Wegpunkt
        let gx = b.tx, gy = b.ty;
        if (tgt) {
            gx = tgt.x;
            gy = tgt.y;
        }
        const d = Math.hypot(gx - b.x, gy - b.y);
        if (!tgt && d < 60) {
            const s = freeSpot(false);
            b.tx = s.x;
            b.ty = s.y;
        } else if (d > (tgt ? 170 : 0)) {
            const step = BOSS_MOVE * (tgt ? 1.2 : 1) * dt;
            const [nx, ny] = slide(b.x, b.y, (gx - b.x) / d * step, (gy - b.y) / d * step, BOSS_R);
            const moved = Math.hypot(nx - b.x, ny - b.y);
            b.x = nx;
            b.y = ny;
            if (moved < step * 0.3) b.stuck += dt;
            else b.stuck = 0;
            if (b.stuck > 1.2) {
                const s = freeSpot(false);
                b.tx = s.x;
                b.ty = s.y;
                b.stuck = 0;
            }
            if (!tgt) b.a = Math.atan2(gy - b.y, gx - b.x);
        }
        if (tgt) b.a = Math.atan2(tgt.y - b.y, tgt.x - b.x);
        // Schiessen: Dreier-Salve aufs Ziel, ab und zu ein Ring rundum
        if (tgt && now >= b.nextShot) {
            b.nextShot = now + 850 / SPEED;
            for (const off of [-0.12, 0, 0.12]) bossBullet(b.a + off, now);
        }
        if (now >= b.nextRing && near(b.x, b.y, 600).length) {
            b.nextRing = now + 9000 / SPEED;
            for (let k = 0; k < 20; k++) bossBullet(k / 20 * Math.PI * 2, now);
        }
    }

    function eventTick(now, dt) {
        if (!nextBossAt) nextBossAt = now + randIn(BOSS_EVERY) / SPEED;
        if (!nextDropAt) nextDropAt = now + randIn(DROP_EVERY) / SPEED;
        if (!boss && now >= nextBossAt) spawnBoss(now);
        if (boss) bossTick(now, dt);
        if (!drop && now >= nextDropAt) spawnDrop(now);
        if (drop && now >= drop.at) {
            const n = 2 + (Math.random() < 0.4 ? 1 : 0);
            dropBag(drop.x, drop.y, Array.from({ length: n }, () => I.generate('airdrop')), 'drop');
            fxAt(drop.x, drop.y, { type: 'shBoom', x: Math.round(drop.x), y: Math.round(drop.y), r: 90, nuke: false });
            announce('📦 The supply drop has landed!', 'drop');
            drop = null;
            nextDropAt = now + randIn(DROP_EVERY) / SPEED;
        }
    }

    function tick() {
        const now = Date.now();
        if (now - lastTick < TICK_MS / SPEED) return;
        const dt = Math.min(0.1, (now - lastTick) / 1000) * SPEED;
        lastTick = now;

        // Beutel laufen ab
        for (let i = bags.length - 1; i >= 0; i--) if (now > bags[i].expires) bags.splice(i, 1);
        if (!players.size) {
            bullets.length = 0;
            nades.length = 0;
            smokes.length = 0;
            fires.length = 0;
            holes.length = 0;
            // leerer Raid: Events weg, Uhr startet mit dem naechsten Spieler neu
            boss = null;
            drop = null;
            nextBossAt = 0;
            nextDropAt = 0;
            return;
        }
        eventTick(now, dt);
        nadeTick(now, dt);

        for (const p of [...players.values()]) {
            if (!players.has(p.id)) continue;
            // Brennen, Feuerflaechen, Heilen, Regeneration
            if (p.burn) {
                if (now > p.burn.until) p.burn = null;
                else if (damage(p, players.get(p.burn.from) || null, p.burn.dps * dt, now, p.x, p.y, { how: 'fire', noDodge: true, dot: true })) continue;
            }
            const fire = fires.find(f => Math.hypot(f.x - p.x, f.y - p.y) < f.r);
            p.inFire = !!fire;
            if (fire) {
                const owner = players.get(fire.owner);
                if (damage(p, owner && owner !== p ? owner : null, fire.dps * dt, now, p.x, p.y, { how: 'fire', noDodge: true, dot: true })) continue;
            }
            if (now < p.healUntil) p.hp = Math.min(p.maxHp, p.hp + p.healRate * dt);
            // Alle regenerieren langsam; Ruestung (Mod, Medic-Set) legt drauf
            if (now - p.lastHurt > p.b.regenDelay / SPEED) p.hp = Math.min(p.maxHp, p.hp + (REGEN_BASE + p.regen) * dt);
            else if (p.regen && now - p.lastHurt > 3000 / SPEED) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
            const sp = MOVE * p.speedMul * (now < p.slowUntil ? 1 - p.slow : 1) * (now < p.stimUntil ? 1 + p.stim : 1);
            const ox = p.x, oy = p.y;
            if (p.mx || p.my) [p.x, p.y] = slide(p.x, p.y, p.mx * sp * dt, p.my * sp * dt, R);
            if (p.x !== ox || p.y !== oy) p.lastMove = now;
            // Beruehrt den Boss: Schaden ueber Zeit
            if (boss && Math.hypot(boss.x - p.x, boss.y - p.y) < BOSS_R + R && damage(p, null, 45 * dt, now, p.x, p.y, { how: 'boss', noDodge: true, dot: true })) continue;
            p.zone = zoneOf(p.x, p.y);
            const sm = smokes.find(s => Math.hypot(s.x - p.x, s.y - p.y) < s.r);
            p.smoke = sm ? sm.id : null;
            if (p.fire) shoot(p, now);
            // Extraction: lange genug in einer Zone stehen
            const zone = MAP.extracts.find(e => Math.hypot(e.x - p.x, e.y - p.y) < EXTRACT_R);
            if (!zone) p.extractAt = null;
            else if (!p.extractAt) p.extractAt = now + p.b.extractMs / SPEED;
            else if (now >= p.extractAt) extract(p);
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            let gone = now >= b.dies;
            const steps = Math.max(2, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 12));
            // Zielsuchend: Richtung langsam zum naechsten Gegner drehen
            if (b.w.homing && !gone) {
                let tgt = null, td = 380;
                for (const q of players.values()) {
                    if (q.id === b.owner || b.hits.has(q.id)) continue;
                    const d = Math.hypot(q.x - b.x, q.y - b.y);
                    if (d < td) { tgt = q; td = d; }
                }
                if (tgt) {
                    const cur = Math.atan2(b.vy, b.vx), want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
                    let da = want - cur;
                    while (da > Math.PI) da -= Math.PI * 2;
                    while (da < -Math.PI) da += Math.PI * 2;
                    const turn = Math.max(-1, Math.min(1, da)) * b.w.homing * 3 * dt;
                    const sp = Math.hypot(b.vx, b.vy);
                    b.vx = Math.cos(cur + turn) * sp;
                    b.vy = Math.sin(cur + turn) * sp;
                }
            }
            for (let s = 0; s < steps && !gone; s++) {
                const px = b.x, py = b.y;
                b.x += b.vx * dt / steps;
                b.y += b.vy * dt / steps;
                if (blocked(b.x, b.y, 3)) {
                    if (b.bounce > 0) {
                        b.bounce--;
                        const hx = blocked(b.x, py, 3), hy = blocked(px, b.y, 3);
                        if (hx || !hy) b.vx = -b.vx;
                        if (hy || !hx) b.vy = -b.vy;
                        b.x = px;
                        b.y = py;
                        continue;
                    }
                    if (b.w.explode) explode(b, now, null);
                    if (b.w.hole) bulletHole(b, now);
                    gone = true;
                    break;
                }
                for (const q of players.values()) {
                    if (q.id === b.owner || b.hits.has(q.id)) continue;
                    if (Math.hypot(q.x - b.x, q.y - b.y) < R + 4) {
                        b.hits.add(q.id);
                        hitPlayer(b, q, now);
                        if (b.pierce > 0) b.pierce--;
                        else gone = true;
                        break;
                    }
                }
                if (!gone && boss && b.owner !== 'boss' && !b.hits.has('boss') && Math.hypot(boss.x - b.x, boss.y - b.y) < BOSS_R + 4) {
                    b.hits.add('boss');
                    const shooter = players.get(b.owner) || null;
                    const crit = b.w.crit && Math.random() < b.w.crit;
                    hurtBoss(shooter, b.w.dmg * (crit ? (shooter ? shooter.b.critMul : 2) : 1), now, b.x, b.y, crit);
                    if (boss && b.w.hole) bulletHole(b, now);
                    if (b.w.explode) explode(b, now, null);
                    if (b.pierce > 0) b.pierce--;
                    else gone = true;
                }
            }
            if (gone) bullets.splice(i, 1);
        }

        if (now - lastSend >= SEND_MS / SPEED) push(now);
    }

    function push(now) {
        lastSend = now;
        const plist = [...players.values()];
        for (const p of plist) {
            const inView = (x, y) => Math.abs(x - p.x) < VIEW && Math.abs(y - p.y) < VIEW * 0.75;
            const w = p.gear[p.slot] || p.gear.primary;
            h.send(p.c, {
                type: 'sh', t: now, ack: p.seq,
                me: {
                    hp: Math.max(0, Math.round(p.hp)), mh: p.maxHp, slot: p.slot, pack: p.pack.length, packMax: p.packMax, util: p.util,
                    gear: { primary: brief(p.gear.primary), secondary: brief(p.gear.secondary) },
                    ms: Math.round(I.weaponStats(w).ms / p.rateMul),
                    spd: Math.round(p.speedMul * (now < p.slowUntil ? 1 - p.slow : 1) * (now < p.stimUntil ? 1 + p.stim : 1) * 100) / 100,
                    ex: p.extractAt ? Math.max(0, p.extractAt - now) : null,
                    burn: !!p.burn || !!p.inFire, heal: now < p.healUntil, pr: now < p.protect,
                    hid: (!!(p.zone || p.smoke !== null) && now - p.lastShot >= REVEAL_MS * p.b.reveal) || stillHidden(p, now)
                },
                players: plist.filter(q => q === p || (inView(q.x, q.y) && canSee(p, q, now))).map(q => {
                    const qw = q.gear[q.slot] || q.gear.primary;
                    return {
                        id: q.id, n: q.name, c: q.color, lv: q.level,
                        x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10, a: Math.round(q.a * 100) / 100,
                        hp: Math.max(0, Math.round(q.hp)), mh: q.maxHp, w: qw.base, wt: qw.tier, wn: qw.name,
                        ar: q.gear.vest ? I.ARMORS[q.gear.vest.base].set : null, hm: q.gear.helmet ? I.ARMORS[q.gear.helmet.base].set : null,
                        burn: !!q.burn, slow: now < q.slowUntil, pr: now < q.protect
                    };
                }),
                bullets: bullets.filter(b => inView(b.x, b.y)).map(b => [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.owner, b.fx, b.tier]),
                crates: crates.filter(cr => inView(cr.x, cr.y)).map(cr => [cr.id, cr.x, cr.y, now >= cr.readyAt ? 1 : 0]),
                bags: bags.filter(b => inView(b.x, b.y)).map(b => [b.id, Math.round(b.x), Math.round(b.y), b.items.length, b.kind === 'boss' ? 2 : b.kind === 'drop' ? 1 : 0]),
                // Events sieht jeder, egal wo (Karte und Pfeil am Rand)
                boss: boss ? [Math.round(boss.x), Math.round(boss.y), Math.max(0, Math.round(boss.hp)), boss.maxHp, Math.round(boss.a * 100) / 100, boss.slamAt ? Math.max(0, Math.round(boss.slamAt - now)) : 0] : null,
                drop: drop ? [Math.round(drop.x), Math.round(drop.y), Math.max(0, Math.round(drop.at - now))] : null,
                nades: nades.filter(g => inView(g.x, g.y)).map(g => [g.id, Math.round(g.x), Math.round(g.y), g.base, g.landed ? 1 : 0, g.fuseAt ? Math.max(0, Math.round(g.fuseAt - now)) : 0]),
                smokes: smokes.filter(s => inView(s.x, s.y)).map(s => [s.id, Math.round(s.x), Math.round(s.y), s.r, Math.round(s.until - now)]),
                fires: fires.filter(f => inView(f.x, f.y)).map(f => [f.id, Math.round(f.x), Math.round(f.y), f.r, Math.round(f.until - now)]),
                holes: holes.filter(o => inView(o.x, o.y)).map(o => [o.id, Math.round(o.x), Math.round(o.y), o.r, Math.round(o.until - now)])
            });
        }
    }

    return {
        join, leave, input, action, tick, refundAll, hubAction,
        has: c => players.has(c.id),
        names: () => [...players.values()].map(p => p.name),
        rooms: () => [{ id: 'raid', players: [...players.values()].map(p => p.name) }],
        _players: players, _bags: bags, _crates: crates, _damage: damage, _canSee: canSee,
        _spawnBoss: () => spawnBoss(Date.now()), _spawnDrop: () => spawnDrop(Date.now()), _boss: () => boss
    };
};

module.exports.MAP = MAP;
module.exports.blocked = blocked;
module.exports.slide = slide;
module.exports.W = W;
module.exports.H = H;
