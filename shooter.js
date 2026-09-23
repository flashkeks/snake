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

const W = 7200, H = 5000;       // seit 4.1 (vorher 4000 × 2800)
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
const BOSS_EVERY = [2 * 60e3, 10 * 60e3];
const BOSS_LIFE = 8 * 60e3;
// Gegner (4.1): so viele laufen herum, geweckt nur in der Naehe von Spielern
const MOB_BASE = 45, MOB_PER_PLAYER = 8, MOB_MAX = 120;
const MOB_WAKE = 1700;
const MIL_RESPAWN = 5 * 60e3;
const ENFORCERS = 4, ENFORCER_RESPAWN = 3 * 60e3;
// Stationen: Sani heilt voll gegen Scrap, Haendler kauft und verkauft
const MEDIC_COST = 40, MEDIC_CD = 60e3;
const TRADER_BUY = { bandage: 12, medkit: 30, frag: 35, smoke: 25, stim: 45, molotov: 45, flash: 40 };
const TRADER_SELL = 0.6;          // Anteil des Salvage-Werts beim Verkauf im Raid
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
    const rand = rng(4242);
    const walls = [];
    const crates = [];
    const extracts = [
        { x: 300, y: 300 }, { x: W - 300, y: 300 }, { x: 300, y: H - 300 }, { x: W - 300, y: H - 300 },
        { x: W / 2, y: 260 }, { x: W / 2, y: H - 260 }
    ];
    const overlaps = (a, b, m) => a[0] < b[0] + b[2] + m && a[0] + a[2] + m > b[0] && a[1] < b[1] + b[3] + m && a[1] + a[3] + m > b[1];
    const nearExtract = r => extracts.some(e => e.x > r[0] - 200 && e.x < r[0] + r[2] + 200 && e.y > r[1] - 200 && e.y < r[1] + r[3] + 200);
    const T = WALL_T;
    const doorRects = [];
    // Freie Plaetze (4.1): Stadt in der Mitte und ein Aussenposten mit Haendler
    // und Sani-Station, dazu ein Militaerlager der Enforcer mit besseren Kisten
    const town = [W / 2 - 520, H / 2 - 360, 1040, 720];
    const outpost = [Math.round(W * 0.16), Math.round(H * 0.62), 620, 480];
    const military = [Math.round(W * 0.66), Math.round(H * 0.16), 920, 660];
    const reserved = [town, outpost, military];
    const stations = [
        { kind: 'trader', x: town[0] + 260, y: town[1] + town[3] / 2 },
        { kind: 'medic', x: town[0] + town[2] - 260, y: town[1] + town[3] / 2 },
        { kind: 'trader', x: outpost[0] + 180, y: outpost[1] + outpost[3] / 2 },
        { kind: 'medic', x: outpost[0] + outpost[2] - 180, y: outpost[1] + outpost[3] / 2 }
    ];
    // Gebaeude: Rechteck mit Tueren
    const buildings = [];
    const addBuilding = (x, y, w, hh, doorsWanted, inner) => {
        const sides = [
            { horiz: true, x, y, len: w },
            { horiz: true, x, y: y + hh - T, len: w },
            { horiz: false, x, y, len: hh },
            { horiz: false, x: x + w - T, y, len: hh }
        ];
        const doors = new Set([Math.floor(rand() * 4)]);
        while (doors.size < doorsWanted) doors.add(Math.floor(rand() * 4));
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
        buildings.push([x, y, w, hh]);
        if (inner) inner(x, y, w, hh);
    };
    // Militaerlager zuerst: grosses Gebaeude, drei Militaerkisten, zwei Trennwaende
    addBuilding(military[0], military[1], military[2], military[3], 3, (x, y, w, hh) => {
        for (let i = 0; i < 3; i++) crates.push({ x: x + 180 + i * (w - 360) / 2, y: y + hh / 2 + (i % 2 ? 90 : -90), t: 'mil' });
        walls.push([x + w / 3, y + 80, T, hh * 0.35], [x + 2 * w / 3, y + hh - 80 - hh * 0.35, T, hh * 0.35]);
    });
    for (let k = 0; k < 1500 && buildings.length < 48; k++) {
        const bw = 300 + rand() * 240, bh = 240 + rand() * 200;
        const r = [200 + rand() * (W - 400 - bw), 200 + rand() * (H - 400 - bh), bw, bh];
        if (buildings.some(b => overlaps(r, b, 160)) || reserved.some(z => overlaps(r, z, 160)) || nearExtract(r)) continue;
        addBuilding(r[0], r[1], bw, bh, 2, (x, y, w, hh) => {
            // Innen: Kisten und eine Trennwand
            const n = 1 + Math.floor(rand() * 2);
            for (let i = 0; i < n; i++) crates.push({ x: x + 60 + rand() * (w - 120), y: y + 60 + rand() * (hh - 120), t: 'crate' });
            if (rand() < 0.5) walls.push([x + w / 2 - T / 2, y + 60, T, hh * 0.45]);
        });
    }
    // Hindernisse draussen: Felsen und Mauern (Kisten-Hindernisse seit 3.1 weg)
    const obstacles = [];
    for (let k = 0; k < 6000 && obstacles.length < 280; k++) {
        const type = 0.35 + rand() * 0.65;
        const r = type < 0.7 ? [0, 0, 70 + rand() * 60, 50 + rand() * 50]              // Felsen
            : type < 0.85 ? [0, 0, 180 + rand() * 120, T]                         // Mauer quer
            : [0, 0, T, 180 + rand() * 120];                                      // Mauer laengs
        r[0] = 80 + rand() * (W - 160 - r[2]);
        r[1] = 80 + rand() * (H - 160 - r[3]);
        if (buildings.some(b => overlaps(r, b, 50)) || reserved.some(z => overlaps(r, z, 60)) || obstacles.some(o => overlaps(r, o, 70)) || nearExtract(r)) continue;
        obstacles.push(r);
    }
    walls.push(...obstacles.map(o => o.map(Math.round)));
    // Kisten draussen
    for (let k = 0; k < 3000 && crates.length < 130; k++) {
        const c = { x: 150 + rand() * (W - 300), y: 150 + rand() * (H - 300), t: 'crate' };
        if (walls.some(w => overlaps([c.x - 30, c.y - 30, 60, 60], w, 20)) || reserved.some(z => overlaps([c.x - 30, c.y - 30, 60, 60], z, 0))) continue;
        crates.push(c);
    }
    // Buesche: verstecken, blocken nicht
    const bushes = [];
    for (let k = 0; k < 9000 && bushes.length < 190; k++) {
        const r = 45 + rand() * 30;
        const b = [120 + rand() * (W - 240), 120 + rand() * (H - 240), r];
        const box = [b[0] - r, b[1] - r, 2 * r, 2 * r];
        if (walls.some(w => overlaps(box, w, 10)) || buildings.some(x => overlaps(box, x, 40)) || reserved.some(z => overlaps(box, z, 20)) || nearExtract(box)) continue;
        if (bushes.some(o => Math.hypot(o[0] - b[0], o[1] - b[1]) < o[2] + r + 30)) continue;
        bushes.push(b.map(Math.round));
    }
    return {
        walls: walls.map(w => w.map(Math.round)), crates: crates.map(c => ({ x: Math.round(c.x), y: Math.round(c.y), t: c.t })), extracts,
        buildings: buildings.map(b => b.map(Math.round)), bushes, doors: doorRects.map(d => d.map(Math.round)),
        stations: stations.map(s => ({ kind: s.kind, x: Math.round(s.x), y: Math.round(s.y) })),
        town: town.map(Math.round), outpost: outpost.map(Math.round), military: military.map(Math.round)
    };
}

const MAP = buildMap();

// Raster fuer schnelle Wandtests
const CELL = 200;

function circleRect(x, y, r, [rx, ry, rw, rh]) {
    const cx = Math.max(rx, Math.min(x, rx + rw));
    const cy = Math.max(ry, Math.min(y, ry + rh));
    return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

// Eine Welt = Map + Groesse + Wandtest (4.3: mehrere Welten, z. B. PvP-Maps)
function makeWorld(map, w, hh) {
    const grid = new Map();
    map.walls.forEach((wl, i) => {
        for (let gx = Math.floor(wl[0] / CELL); gx <= Math.floor((wl[0] + wl[2]) / CELL); gx++) {
            for (let gy = Math.floor(wl[1] / CELL); gy <= Math.floor((wl[1] + wl[3]) / CELL); gy++) {
                const k = gx + ',' + gy;
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k).push(i);
            }
        }
    });
    function blocked(x, y, r) {
        if (x < r || y < r || x > w - r || y > hh - r) return true;
        for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
            for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++) {
                const list = grid.get(gx + ',' + gy);
                if (list && list.some(i => circleRect(x, y, r, map.walls[i]))) return true;
            }
        }
        return false;
    }
    return { map, w, h: hh, blocked, slide: (x, y, dx, dy, r, isBlocked = blocked) => slideWith(x, y, dx, dy, r, isBlocked) };
}

const WORLD = makeWorld(MAP, W, H);
const blocked = WORLD.blocked;

// PvP-Maps (4.3): klein und spiegelsymmetrisch, Team A links, Team B rechts
const PVP_W = 2100, PVP_H = 1300;
function buildPvpMap(seed, name) {
    const rand = rng(seed);
    const walls = [], bushes = [], buildings = [], doors = [];
    const T = WALL_T;
    const half = [];
    const overlaps = (a, b, m) => a[0] < b[0] + b[2] + m && a[0] + a[2] + m > b[0] && a[1] < b[1] + b[3] + m && a[1] + a[3] + m > b[1];
    // Mitte: eine Deckung auf der Achse
    walls.push([PVP_W / 2 - 40, PVP_H / 2 - 110, 80, 220]);
    for (let k = 0; k < 800 && half.length < 11; k++) {
        const type = rand();
        const r = type < 0.55 ? [0, 0, 60 + rand() * 70, 50 + rand() * 60] : type < 0.78 ? [0, 0, 140 + rand() * 120, T] : [0, 0, T, 140 + rand() * 120];
        r[0] = 260 + rand() * (PVP_W / 2 - 330 - r[2]);
        r[1] = 60 + rand() * (PVP_H - 120 - r[3]);
        if (half.some(o => overlaps(r, o, 90)) || overlaps(r, [PVP_W / 2 - 40, PVP_H / 2 - 110, 80, 220], 90)) continue;
        half.push(r);
    }
    for (const r of half) walls.push(r, [PVP_W - r[0] - r[2], r[1], r[2], r[3]]);
    for (let k = 0; k < 600 && bushes.length < 6; k++) {
        const r = 40 + rand() * 20;
        const b = [260 + rand() * (PVP_W / 2 - 320), 80 + rand() * (PVP_H - 160), r];
        const box = [b[0] - r, b[1] - r, 2 * r, 2 * r];
        if (walls.some(w => overlaps(box, w, 10))) continue;
        bushes.push(b, [PVP_W - b[0], b[1], r]);
    }
    const spawns = { a: [], b: [] };
    for (let i = 0; i < 3; i++) {
        const y = PVP_H / 2 + (i - 1) * 160;
        spawns.a.push({ x: 110, y });
        spawns.b.push({ x: PVP_W - 110, y });
    }
    return {
        name, walls: walls.map(w => w.map(Math.round)), crates: [], extracts: [], buildings, bushes: bushes.map(b => b.map(Math.round)), doors,
        stations: [], town: null, outpost: null, military: null, spawns
    };
}
const PVP_WORLDS = [[101, 'Courtyard'], [202, 'Depot'], [303, 'Crossing'], [404, 'Yard']].map(([s, n]) => makeWorld(buildPvpMap(s, n), PVP_W, PVP_H));

// Bewegen mit Rutschen: in kleinen Schritten bis an die Wand heran und an
// Ecken seitlich vorbei, statt an Kanten haengenzubleiben. Dieselbe Logik
// steckt im Browser (shSlide), sonst korrigiert der Server staendig.
function slideWith(x, y, dx, dy, r, isBlocked) {
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
const M = require('./arena-mobs');

// opts: { mode: 'extract' (Standard) | 'pvp', world, ... } – siehe PvP unten
module.exports = function createArena(h, opts = {}) {
    // Die Welt dieser Instanz (ueberdeckt die Modul-Namen fuer die Extraction-Map)
    const world = opts.world || WORLD;
    const mode = opts.mode || 'extract';
    const MAP = world.map, W = world.w, H = world.h, blocked = world.blocked, slide = world.slide;
    // h: { accounts, send, feed, refresh(c), changed() }
    const players = new Map();       // client id -> Spieler im Raid
    const bullets = [];
    const crates = MAP.crates.map((c, i) => ({ id: i, x: c.x, y: c.y, t: c.t, readyAt: 0 }));
    const bags = [];
    const nades = [];                // Wurfsachen im Flug oder mit Zuender
    const smokes = [];               // Rauchwolken { id, x, y, r, until }
    const fires = [];                // Feuerflaechen { id, x, y, r, until, owner, dps }
    const holes = [];                // Schwarze Loecher { id, x, y, r, until, owner, dmg }
    let seqId = 0;
    const mobs = [];                 // Gegner und Boss (4.1), siehe arena-mobs.js
    let mobSeq = 0;
    let bossId = null;               // id des Bosses in mobs
    let lastBoss = null;
    let enforcerAt = [];             // Respawn-Zeiten der Enforcer
    let drop = null;                 // angekuendigter Versorgungsabwurf { x, y, at }
    let nextBossAt = 0, nextDropAt = 0;
    const boss = () => bossId !== null ? mobs.find(m => m.id === bossId) || null : null;
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
            scrap: a.scrap, coins: u.coins, inRaid: players.has(c.id), prog: progView(c, a), pvp: a.pvp || null, ...extra
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
            // Spieler (und Bosse) nicht im Militaerlager oder direkt neben Gegnern absetzen
            if (avoidPlayers && MAP.military && (x > MAP.military[0] - 400 && x < MAP.military[0] + MAP.military[2] + 400 && y > MAP.military[1] - 400 && y < MAP.military[1] + MAP.military[3] + 400)) continue;
            if (avoidPlayers && k < 300 && mobs.some(m => Math.hypot(m.x - x, m.y - y) < 650)) continue;
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

    // Spieler-Objekt fuer Raid und PvP
    function newPlayer(c, name, color, a, gear, util, spot) {
        const now = Date.now();
        return {
            id: c.id, c, name, account: c.account, color: color || '#ff5bd6',
            x: spot.x, y: spot.y, a: 0, mx: 0, my: 0, fire: false, lastShot: 0, seq: 0, lastMove: now,
            gear, slot: 'primary', util, lastUse: 0,
            pack: [], kills: 0, zone: null, smoke: null,
            hp: 0, maxHp: 0, speedMul: 1, regen: 0, thorns: 0, dodge: 0, dmgMul: 1, rateMul: 1, taken: 1, healMul: 1, homing: 0, phantom: false,
            burn: null, slowUntil: 0, slow: 0, lastHurt: 0, healUntil: 0, healRate: 0, stimUntil: 0, stim: 0,
            extractAt: null, joinedAt: now, protect: now + 3000 / SPEED,
            b: L.bonuses(a.prog), level: L.levelOf(a.prog.xp).level, windUsed: false, lastUsed: false, adrenCd: 0, rampUntil: 0
        };
    }

    function join(c, name, color, team) {
        if (!c.account) return 'Log in to raid';
        if (players.has(c.id)) {
            sendJoined(c);
            return null;
        }
        if (pvp) return joinPvp(c, name, team);
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
        const p = newPlayer(c, name, color, a, gear, util, freeSpot(true));
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
                extracts: MAP.extracts, extractR: EXTRACT_R, r: R, move: MOVE, view: VIEW, throwRange: I.THROW_RANGE,
                stations: MAP.stations, town: MAP.town, outpost: MAP.outpost, military: MAP.military, mobs: M.catalog(),
                trader: { buy: TRADER_BUY, sell: TRADER_SELL }, medic: { cost: MEDIC_COST, cd: MEDIC_CD }
            },
            packMax: p0PackMax(c), feed: pvp ? [] : feedLog.slice(-6), mode, team: players.get(c.id) ? players.get(c.id).team : undefined,
            mapName: MAP.name || null
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
    // by = Name eines Gegners (NPC/Boss), falls der getoetet hat
    function die(p, killer, how, by) {
        if (pvp) return how === 'left' ? pvpLeave(p) : pvpDown(p, killer);
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
        const line = { killer: killer ? killer.name : by || null, victim: p.name, how, weapon: w ? w.name : null, tier: w ? w.tier : null, loot: loot.length };
        feedLog.push(line);
        if (feedLog.length > 20) feedLog.shift();
        for (const q of players.values()) h.send(q.c, { type: 'shKill', ...line });
        h.send(p.c, { type: 'shLeft', result: how === 'left' ? 'left' : 'died', by: killer ? killer.name : by || null, lost: loot.map(brief) });
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
        } else if (d.type === 'shTrade') {
            trade(p, d);
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
        if (pvp) return;
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
        for (const s of MAP.stations) {
            const dd = Math.hypot(s.x - p.x, s.y - p.y);
            if (dd < bd + 20) { best = { s }; bd = dd; }
        }
        if (!best) return;
        if (best.s) return station(p, best.s, now);
        let got = [];
        if (best.cr && best.cr.t === 'mil') {
            best.cr.readyAt = now + MIL_RESPAWN;
            const n = 1 + (Math.random() < 0.25 + p.b.loot ? 1 : 0);
            got = Array.from({ length: n }, () => I.generate('military'));
            award(p, L.XP.crate * 4, 'military crate');
        } else if (best.cr) {
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

    // ---------- Stationen: Sani und Haendler (4.1) ----------

    function nearStation(p, kind) {
        return MAP.stations.find(s => s.kind === kind && Math.hypot(s.x - p.x, s.y - p.y) < INTERACT_R + 30);
    }

    // F an einer Station: Sani heilt sofort, Haendler oeffnet sein Angebot
    function station(p, s, now) {
        if (s.kind === 'medic') {
            if (now < (p.medicAt || 0)) return h.send(p.c, { type: 'shEvent', text: `⛑️ Medic again in ${Math.ceil((p.medicAt - now) / 1000)} s`, kind: 'self' });
            if (p.hp >= p.maxHp) return h.send(p.c, { type: 'shEvent', text: '⛑️ You are already at full health', kind: 'self' });
            const a = st(p.c);
            if (a.scrap < MEDIC_COST) return h.send(p.c, { type: 'shEvent', text: `⛑️ Healing costs ${MEDIC_COST} scrap`, kind: 'self' });
            a.scrap -= MEDIC_COST;
            h.accounts.touch();
            p.hp = p.maxHp;
            p.burn = null;
            p.medicAt = now + MEDIC_CD / SPEED;
            fxAt(p.x, p.y, { type: 'shFx', kind: 'phoenix', x: Math.round(p.x), y: Math.round(p.y) });
            return h.send(p.c, { type: 'shEvent', text: `⛑️ Fully healed (−${MEDIC_COST} scrap)`, kind: 'self' });
        }
        sendTrader(p);
    }

    function sendTrader(p) {
        const a = st(p.c);
        h.send(p.c, {
            type: 'shTrader', scrap: a.scrap,
            sell: p.pack.map(it => ({ ...brief(it), price: Math.max(1, Math.round(I.salvageValue(it) * TRADER_SELL)) }))
        });
    }

    // Kaufen (Verbrauchsgut gegen Scrap aus dem Lager) und Verkaufen (Rucksack -> Scrap)
    function trade(p, d) {
        if (!nearStation(p, 'trader')) return h.send(p.c, { type: 'shTrader', close: true });
        const a = st(p.c);
        if (d.op === 'buy') {
            const price = TRADER_BUY[d.base];
            if (!price) return;
            if (a.scrap < price) return h.send(p.c, { type: 'shEvent', text: `🏪 You need ${price} scrap`, kind: 'self' });
            const it = I.plain('util', d.base);
            const rest = pickUp(p, [it]);
            if (rest.length) return h.send(p.c, { type: 'shEvent', text: '🏪 Your backpack is full', kind: 'self' });
            a.scrap -= price;
        } else if (d.op === 'sell') {
            const i = p.pack.findIndex(x => x.uid === d.uid);
            if (i < 0) return;
            const [it] = p.pack.splice(i, 1);
            a.scrap += Math.max(1, Math.round(I.salvageValue(it) * TRADER_SELL));
        } else return;
        h.accounts.touch();
        gearStats(p);
        sendInv(p);
        sendTrader(p);
    }

    // ---------- Verbrauchsgut ----------

    function useUtil(p, si, tx, ty, now) {
        const u = p.util[si];
        if (p.dead || (pvp && pvp.phase !== 'fight')) return;
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
        if (!isMob(g.owner)) {
            for (const m of mobsNear(x, y, r + 60)) {
                const d = Math.hypot(m.x - x, m.y - y);
                if (d < r + m.def.r && (!walls || clear(x, y, m.x, m.y))) hurtMob(m, owner, dmg * (1 - d / (r + m.def.r) * 0.6), now, m.x, m.y);
            }
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
        if (t.dead) return false;
        if (v.team && v.team === t.team) return true;
        if (Math.hypot(v.x - t.x, v.y - t.y) < SEE_NEAR) return true;
        if (now - t.lastShot < REVEAL_MS * t.b.reveal) return true;
        if (stillHidden(t, now)) return false;
        if (t.smoke !== null && v.smoke !== t.smoke) return false;
        if (t.zone && v.zone !== t.zone) return false;
        return true;
    }

    // ---------- Kampf ----------

    function shoot(p, now) {
        if (p.dead || (pvp && pvp.phase !== 'fight')) return;
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
            if (q === p || q.dead || (p.team && p.team === q.team)) continue;
            const t = (q.x - p.x) * dx + (q.y - p.y) * dy;
            if (t < 0 || t > len) continue;
            const perp = Math.abs((q.x - p.x) * dy - (q.y - p.y) * dx);
            if (perp > R + 10) continue;
            hitPlayer({ owner: p.id, w, x: q.x, y: q.y, hits: new Set() }, q, now);
        }
        for (const m of [...mobs]) {
            const t = (m.x - p.x) * dx + (m.y - p.y) * dy;
            if (t >= 0 && t <= len && Math.abs((m.x - p.x) * dy - (m.y - p.y) * dx) < m.def.r + 10) hurtMob(m, p, w.dmg, now, m.x, m.y);
        }
    }

    // Schwarzes Loch der Singularity an einer Stelle
    function bulletHole(b, now) {
        holes.push({ id: ++seqId, x: b.x, y: b.y, r: 240, until: now + 1100 / SPEED, owner: b.owner, dmg: b.w.dmg * 1.8, def: {} });
        fxAt(b.x, b.y, { type: 'shFx', kind: 'hole', x: Math.round(b.x), y: Math.round(b.y) });
    }

    function near(x, y, r) {
        return [...players.values()].filter(q => !q.dead && Math.hypot(q.x - x, q.y - y) < r);
    }

    function fxAt(x, y, msg) {
        for (const q of near(x, y, VIEW)) h.send(q.c, msg);
    }

    // Schaden mit allen Folgen; true = tot
    function damage(v, attacker, dmg, now, x, y, opts = {}) {
        if (!players.has(v.id) || now < v.protect || v.dead) return false;
        // PvP: kein Schaden unter Teamkameraden
        if (attacker && attacker !== v && attacker.team && attacker.team === v.team) return false;
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
        if (killed) die(v, attacker && players.has(attacker.id) ? attacker : null, opts.how || 'shot', opts.by);
        return killed;
    }

    function hitPlayer(b, v, now) {
        const shooter = players.get(b.owner);
        const w = b.w;
        let dmg = w.dmg;
        const crit = w.crit && Math.random() < w.crit;
        if (crit) dmg *= shooter ? shooter.b.critMul : 2;
        const killed = damage(v, shooter, dmg, now, b.x, b.y, { crit, execute: w.execute, how: w.how, by: w.by });
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
        if (!isMob(b.owner)) for (const m of mobsNear(b.x, b.y, r + 60)) if (Math.hypot(m.x - b.x, m.y - b.y) < r + m.def.r) hurtMob(m, shooter, w.dmg * w.explode * (shooter ? shooter.b.expl : 1), now, m.x, m.y);
    }

    // ---------- PvP (4.3): Teams, Runden, keine Verluste ----------
    // Best of 5 (wer zuerst 3 Runden holt). Man spielt mit Kopien seines
    // Loadouts: nichts verlaesst das Lager, nichts geht verloren. Tote warten
    // auf die naechste Runde. Kein Beschuss unter Teamkameraden.
    const PVP_WIN = 3, PVP_ROUND_MS = 90000, PVP_COUNT_MS = 3000, PVP_END_MS = 3000;
    const TEAM_COLOR = { a: '#3da5ff', b: '#ff5b5b' };
    const TEAM_NAME = { a: '🔵 Blue', b: '🔴 Red' };
    const pvp = mode === 'pvp' ? { round: 0, score: [0, 0], phase: 'wait', until: 0, last: null, size: opts.size || 1, done: false, kills: new Map() } : null;

    function joinPvp(c, name, team) {
        const a = st(c);
        const copy = uid => {
            const it = uid && a.inv.find(x => x.uid === uid);
            return it ? JSON.parse(JSON.stringify(it)) : null;
        };
        const gear = { primary: copy(a.loadout.primary) || starterPistol(), secondary: copy(a.loadout.secondary) };
        for (const s of [...I.SLOTS, 'backpack']) gear[s] = copy(a.loadout[s]);
        const util = (a.loadout.util || []).map(u => u && Math.min(u.n, count(a, u.base)) > 0 ? { base: u.base, n: Math.min(u.n, count(a, u.base)) } : null);
        team = team === 'b' ? 'b' : 'a';
        const p = newPlayer(c, name, TEAM_COLOR[team], a, gear, util, MAP.spawns[team][0]);
        p.team = team;
        p.dead = false;
        p.loadUtil = util.map(u => u ? { ...u } : null);
        gearStats(p);
        players.set(c.id, p);
        pvp.kills.set(c.id, 0);
        sendJoined(c);
        sendInv(p);
        return null;
    }

    // Neue Runde: alle an ihre Seite, voll geheilt, Verbrauchsgut wieder voll
    function pvpRound(now) {
        pvp.round++;
        pvp.phase = 'countdown';
        pvp.until = now + PVP_COUNT_MS / SPEED;
        bullets.length = 0;
        nades.length = 0;
        smokes.length = 0;
        fires.length = 0;
        holes.length = 0;
        const idx = { a: 0, b: 0 };
        for (const p of players.values()) {
            const sp = MAP.spawns[p.team][idx[p.team]++ % MAP.spawns[p.team].length];
            Object.assign(p, {
                x: sp.x, y: sp.y, a: p.team === 'a' ? 0 : Math.PI, dead: false, hp: p.maxHp, burn: null, slowUntil: 0, stimUntil: 0, healUntil: 0,
                windUsed: false, lastUsed: false, fire: false, mx: 0, my: 0, protect: pvp.until, lastHurt: 0
            });
            p.util = p.loadUtil.map(u => u ? { ...u } : null);
            sendInv(p);
        }
        for (const p of players.values()) h.send(p.c, { type: 'shEvent', text: `⚔️ Round ${pvp.round} – ${pvp.score[0]} : ${pvp.score[1]}`, kind: 'drop' });
    }

    function pvpDown(p, killer) {
        if (p.dead) return;
        p.dead = true;
        p.fire = false;
        p.mx = p.my = 0;
        const a = p.account ? st(p.c) : null;
        if (a) {
            a.pvp = a.pvp || { rating: 1000, wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0 };
            a.pvp.deaths++;
        }
        if (killer && killer !== p) {
            pvp.kills.set(killer.id, (pvp.kills.get(killer.id) || 0) + 1);
            award(killer, 60, 'pvp kill');
            const ka = st(killer.c);
            ka.pvp = ka.pvp || { rating: 1000, wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0 };
            ka.pvp.kills++;
            if (killer.b.bloodlust) killer.hp = Math.min(killer.maxHp, killer.hp + killer.b.bloodlust);
            if (killer.b.rampage) killer.rampUntil = Date.now() + 4000 / SPEED;
        }
        h.accounts.touch();
        const w = killer ? (killer.gear[killer.slot] || killer.gear.primary) : null;
        const line = { killer: killer ? killer.name : null, victim: p.name, how: 'shot', weapon: w ? w.name : null, tier: w ? w.tier : null, loot: 0 };
        for (const q of players.values()) h.send(q.c, { type: 'shKill', ...line });
        h.send(p.c, { type: 'shEvent', text: '💀 You are down – wait for the next round', kind: 'self' });
    }

    function pvpTick(now) {
        if (pvp.done) return;
        if (pvp.phase === 'countdown' && now >= pvp.until) {
            pvp.phase = 'fight';
            pvp.until = now + PVP_ROUND_MS / SPEED;
        } else if (pvp.phase === 'fight') {
            const alive = t => [...players.values()].filter(p => p.team === t && !p.dead);
            const A = alive('a'), B = alive('b');
            let winner = null;
            if (!A.length || !B.length) winner = !A.length && !B.length ? 'draw' : !A.length ? 'b' : 'a';
            else if (now >= pvp.until) {
                // Zeit um: mehr Leben (anteilig) gewinnt
                const hp = l => l.reduce((s, p) => s + p.hp / p.maxHp, 0);
                const d = hp(A) - hp(B);
                winner = Math.abs(d) < 0.01 ? 'draw' : d > 0 ? 'a' : 'b';
            }
            if (winner) {
                if (winner !== 'draw') pvp.score[winner === 'a' ? 0 : 1]++;
                pvp.phase = 'end';
                pvp.last = winner;
                pvp.until = now + PVP_END_MS / SPEED;
                for (const p of players.values()) h.send(p.c, { type: 'shEvent', text: winner === 'draw' ? `Round ${pvp.round}: draw` : `${TEAM_NAME[winner]} wins round ${pvp.round} (${pvp.score[0]} : ${pvp.score[1]})`, kind: winner === p.team ? 'drop' : 'boss' });
            }
        } else if (pvp.phase === 'end' && now >= pvp.until) {
            if (pvp.score[0] >= PVP_WIN || pvp.score[1] >= PVP_WIN || pvp.round >= 9) pvpFinish();
            else pvpRound(now);
        }
    }

    // Match vorbei: Elo (K 32, Teamdurchschnitt), XP, Ergebnis an alle
    function pvpFinish(forfeit) {
        if (pvp.done) return;
        pvp.done = true;
        const win = forfeit || (pvp.score[0] > pvp.score[1] ? 'a' : pvp.score[1] > pvp.score[0] ? 'b' : null);
        const list = [...players.values()];
        const rec = p => {
            const a = st(p.c);
            a.pvp = a.pvp || { rating: 1000, wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0 };
            return a.pvp;
        };
        const avg = t => {
            const l = list.filter(p => p.team === t);
            return l.length ? l.reduce((s, p) => s + rec(p).rating, 0) / l.length : 1000;
        };
        const ra = avg('a'), rb = avg('b');
        for (const p of list) {
            const r = rec(p);
            const mine = p.team === 'a' ? ra : rb, theirs = p.team === 'a' ? rb : ra;
            const expect = 1 / (1 + Math.pow(10, (theirs - mine) / 400));
            const s = !win ? 0.5 : win === p.team ? 1 : 0;
            const delta = Math.round(32 * (s - expect));
            r.rating = Math.max(0, r.rating + delta);
            if (s === 1) r.wins++;
            else if (s === 0) r.losses++;
            else r.draws++;
            award(p, s === 1 ? 300 : s === 0 ? 80 : 150, s === 1 ? 'pvp win' : 'pvp match');
            const myScore = p.team === 'a' ? pvp.score : [pvp.score[1], pvp.score[0]];
            h.send(p.c, { type: 'shLeft', result: 'pvp', won: s === 1, draw: s === 0.5, score: myScore, kills: pvp.kills.get(p.id) || 0, rating: r.rating, delta, forfeit: !!forfeit });
        }
        h.accounts.touch();
        players.clear();
        if (opts.onDone) opts.onDone({ winner: win, score: pvp.score });
    }

    function pvpLeave(p) {
        players.delete(p.id);
        const a = st(p.c);
        a.pvp = a.pvp || { rating: 1000, wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0 };
        if (!pvp.done) {
            // Aufgeben zaehlt als Niederlage
            a.pvp.losses++;
            a.pvp.rating = Math.max(0, a.pvp.rating - 20);
            h.accounts.touch();
            h.send(p.c, { type: 'shLeft', result: 'pvp', won: false, left: true, score: p.team === 'a' ? pvp.score : [pvp.score[1], pvp.score[0]], kills: pvp.kills.get(p.id) || 0, rating: a.pvp.rating, delta: -20 });
            const left = t => [...players.values()].some(q => q.team === t);
            if (!left(p.team)) pvpFinish(p.team === 'a' ? 'b' : 'a');
        }
    }

    // ---------- Events: Boss und Versorgungsabwurf ----------

    const randIn = ([a, b]) => a + Math.random() * (b - a);

    function announce(text, kind) {
        for (const q of players.values()) h.send(q.c, { type: 'shEvent', text, kind });
    }

    const isMob = id => typeof id === 'string' && id[0] === 'm' && id[1] === '#';

    // Gegner je Tick in ein Raster (schnelle Suche fuer Kugeln und Explosionen)
    let mobGrid = new Map();
    function gridMobs() {
        mobGrid = new Map();
        for (const m of mobs) {
            const k = Math.floor(m.x / CELL) + ',' + Math.floor(m.y / CELL);
            if (!mobGrid.has(k)) mobGrid.set(k, []);
            mobGrid.get(k).push(m);
        }
    }
    function mobsNear(x, y, r) {
        const out = [];
        for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
            for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++) {
                const list = mobGrid.get(gx + ',' + gy);
                if (list) for (const m of list) if (m.hp > 0) out.push(m);
            }
        }
        return out;
    }

    function spawnMob(kind, x, y, now, home) {
        const def = M.MOBS[kind];
        const hp = def.boss ? def.hpBase + def.hpPer * Math.max(1, players.size) : def.hp;
        const m = {
            id: 'm#' + (++mobSeq), kind, def, x, y, a: Math.random() * 6.28, hp, maxHp: hp,
            home: home || { x, y }, tx: x, ty: y, tgt: null, seen: 0, nextThink: 0, nextShot: now + 800 + Math.random() * 800,
            aimAt: 0, strafe: Math.random() < 0.5 ? 1 : -1, stuck: 0, born: now, burn: null, slowUntil: 0, dmgBy: new Map(),
            nextRing: now + 6000, nextSlam: now + 8000, slamAt: 0, nextSummon: now + 6000
        };
        mobs.push(m);
        return m;
    }

    // Freier Platz weit weg von Spielern (Gegner tauchen nicht vor der Nase auf)
    function mobSpot() {
        for (let k = 0; k < 60; k++) {
            const s = freeSpot(false);
            if ([...players.values()].every(p => Math.hypot(p.x - s.x, p.y - s.y) > 1000) && !inZone(s.x, s.y, MAP.town, 150) && !inZone(s.x, s.y, MAP.outpost, 150)) return s;
        }
        return null;
    }
    const inZone = (x, y, z, m) => !!z && x > z[0] - m && x < z[0] + z[2] + m && y > z[1] - m && y < z[1] + z[3] + m;
    // Stadt und Aussenposten sind Schutzzonen: Gegner kommen nicht hinein (schiessen aber hinein)
    const mobBlocked = (x, y, r) => blocked(x, y, r) || inZone(x, y, MAP.town, r) || inZone(x, y, MAP.outpost, r);

    function spawnBoss(now, kind) {
        const pool = M.BOSSES.filter(k => k !== lastBoss);
        kind = M.MOBS[kind] && M.MOBS[kind].boss ? kind : pool[Math.floor(Math.random() * pool.length)];
        lastBoss = kind;
        const s = freeSpot(true);
        const m = spawnMob(kind, s.x, s.y, now);
        bossId = m.id;
        announce(`${m.def.icon} The ${m.def.name} is roaming the map – kill it for Sovereign loot!`, 'boss');
    }

    function spawnDrop(now) {
        const s = freeSpot(false);
        drop = { x: s.x, y: s.y, at: now + DROP_WARN / SPEED };
        announce('📦 Supply drop incoming – check the map!', 'drop');
    }

    function bossView(now) {
        const b = boss();
        return b ? [Math.round(b.x), Math.round(b.y), Math.max(0, Math.round(b.hp)), b.maxHp, Math.round(b.a * 100) / 100,
            b.slamAt ? Math.max(0, Math.round(b.slamAt - now)) : 0, b.kind] : null;
    }

    // Spieler trifft Gegner
    function hurtMob(m, attacker, dmg, now, x, y, crit, w) {
        if (!(m.hp > 0) || dmg <= 0) return;
        if (attacker && attacker.b) {
            dmg *= attacker.b.hunt;
            if (attacker.b.exec && m.hp < m.maxHp * 0.3) dmg *= 1 + attacker.b.exec;
        }
        dmg *= m.def.taken || 1;
        const real = Math.min(dmg, m.hp);
        m.hp -= dmg;
        if (attacker && attacker.account) m.dmgBy.set(attacker.id, (m.dmgBy.get(attacker.id) || 0) + real);
        // Wer schiesst, wird zum Ziel (auch von weit weg)
        if (attacker && players.has(attacker.id)) {
            m.tgt = attacker.id;
            m.seen = now;
            h.send(attacker.c, { type: 'shHit', x: Math.round(x), y: Math.round(y), dmg: Math.round(dmg), kill: m.hp <= 0, crit: !!crit });
        }
        if (m.hp > 0 && w) {
            if (w.burn) m.burn = { dps: w.burn, until: now + 3000 / SPEED, from: attacker ? attacker.id : null };
            if (w.frost) m.slowUntil = now + 1500 / SPEED;
            if (w.vamp && attacker) attacker.hp = Math.min(attacker.maxHp, attacker.hp + dmg * w.vamp);
        }
        if (m.hp <= 0) mobDies(m, attacker && players.has(attacker.id) ? attacker : null, now);
    }

    function mobDies(m, killer, now) {
        const i = mobs.indexOf(m);
        if (i < 0) return;
        mobs.splice(i, 1);
        const def = m.def;
        if (m.id === bossId) {
            bossId = null;
            nextBossAt = now + randIn(BOSS_EVERY) / SPEED;
            // drei Beutel mit je einem Item, jeder darf sie sich schnappen
            for (let k = 0; k < 3; k++) {
                const a = k / 3 * Math.PI * 2;
                const x = m.x + Math.cos(a) * 55, y = m.y + Math.sin(a) * 55;
                dropBag(blocked(x, y, 10) ? m.x : x, blocked(x, y, 10) ? m.y : y, [I.generate('boss')], 'boss');
            }
            fxAt(m.x, m.y, { type: 'shBoom', x: Math.round(m.x), y: Math.round(m.y), r: 220, nuke: false });
            const line = { killer: killer ? killer.name : null, victim: def.icon + ' ' + def.name, how: 'shot', loot: 3 };
            feedLog.push(line);
            if (feedLog.length > 20) feedLog.shift();
            for (const q of players.values()) h.send(q.c, { type: 'shKill', ...line });
            announce(`${def.icon} ${killer ? killer.name + ' killed' : 'Down goes'} the ${def.name}! 3 items dropped`, 'boss');
            if (killer && killer.account) h.accounts.stat(killer.account, s => { s.bossKills = (s.bossKills || 0) + 1; });
            if (killer) award(killer, L.XP.boss, 'boss');
            const total = [...m.dmgBy.values()].reduce((s, n) => s + n, 0);
            for (const [id, n] of m.dmgBy) {
                const q = players.get(id);
                if (q && total > 0) award(q, L.XP.bossHelp * n / total, 'boss damage');
            }
            // Brut der Koenigin faellt mit ihr
            for (const o of [...mobs]) if (o.parent === m.id) mobs.splice(mobs.indexOf(o), 1);
            return;
        }
        if (m.kind === 'enforcer') enforcerAt.push(now + ENFORCER_RESPAWN / SPEED);
        if (killer) {
            award(killer, L.XP[def.xp] * (def.xpMul || 1), def.name.toLowerCase());
            if (killer.account) h.accounts.stat(killer.account, s => { s.npcKills = (s.npcKills || 0) + 1; });
            if (killer.b.bloodlust) killer.hp = Math.min(killer.maxHp, killer.hp + killer.b.bloodlust / 2);
        }
        if (def.drop && !m.parent && Math.random() < def.drop.chance) {
            dropBag(m.x, m.y, Array.from({ length: def.drop.n }, () => I.generate(def.drop.src)));
        }
        fxAt(m.x, m.y, { type: 'shFx', kind: 'mobdie', x: Math.round(m.x), y: Math.round(m.y), icon: def.icon });
    }

    // Gegner-Kugel
    function mobShot(m, a, now) {
        const g = m.def.gun;
        bullets.push({
            id: ++seqId, owner: m.id,
            x: m.x + Math.cos(a) * (m.def.r + 6), y: m.y + Math.sin(a) * (m.def.r + 6),
            vx: Math.cos(a) * g.speed, vy: Math.sin(a) * g.speed,
            dies: now + g.life * 1000 / SPEED, pierce: 0, bounce: 0, hits: new Set(),
            w: { dmg: g.dmg, how: m.def.boss ? 'boss' : 'npc', by: m.def.icon + ' ' + m.def.name, homing: g.homing || 0, mobBoom: g.explode || 0, big: !!g.big, mob: true },
            fx: m.def.boss ? 1024 : 2048, tier: m.def.boss ? 5 : 0
        });
    }

    // Explodierende Gegner-Kugel (Golem-Fels)
    function mobBoom(b, now) {
        const r = b.w.mobBoom;
        fxAt(b.x, b.y, { type: 'shBoom', x: Math.round(b.x), y: Math.round(b.y), r, nuke: false });
        for (const q of near(b.x, b.y, r + R)) damage(q, null, b.w.dmg * (1 - Math.hypot(q.x - b.x, q.y - b.y) / (r + R) * 0.5), now, q.x, q.y, { how: b.w.how, by: b.w.by, noDodge: true });
    }

    // Sieht der Gegner den Spieler? Versteckte nur aus der Naehe
    function mobSees(m, q, now, range) {
        const d = Math.hypot(q.x - m.x, q.y - m.y);
        if (d > range || now < q.protect) return false;
        const hidden = d > SEE_NEAR && now - q.lastShot >= REVEAL_MS * q.b.reveal && (q.zone || q.smoke !== null || stillHidden(q, now));
        return !hidden && clear(m.x, m.y, q.x, q.y);
    }

    function mobMove(m, gx, gy, speed, dt) {
        const d = Math.hypot(gx - m.x, gy - m.y);
        if (d < 1) return;
        const step = Math.min(d, speed * dt * (m.slowUntil > Date.now() ? 0.5 : 1));
        const [nx, ny] = slide(m.x, m.y, (gx - m.x) / d * step, (gy - m.y) / d * step, m.def.r, mobBlocked);
        const moved = Math.hypot(nx - m.x, ny - m.y);
        m.x = nx;
        m.y = ny;
        m.stuck = moved < step * 0.3 ? m.stuck + dt : 0;
        if (m.stuck > 1.2) {
            // festgefahren: neues Ziel in der Naehe
            m.stuck = 0;
            m.tx = m.x + (Math.random() - 0.5) * 500;
            m.ty = m.y + (Math.random() - 0.5) * 500;
            m.strafe = -m.strafe;
        }
    }

    function mobTick(m, now, dt) {
        const def = m.def;
        // Brennen
        if (m.burn) {
            if (now > m.burn.until) m.burn = null;
            else {
                hurtMob(m, players.get(m.burn.from) || null, m.burn.dps * dt, now, m.x, m.y);
                if (!(m.hp > 0)) return;
            }
        }
        if (def.boss && now - m.born > BOSS_LIFE / SPEED) {
            mobs.splice(mobs.indexOf(m), 1);
            bossId = null;
            nextBossAt = now + randIn(BOSS_EVERY) / SPEED;
            announce(`${def.icon} The ${def.name} got bored and left.`, 'boss');
            return;
        }
        // Ziel pruefen/suchen, nicht jeden Tick
        let tgt = m.tgt ? players.get(m.tgt) : null;
        if (now >= m.nextThink) {
            m.nextThink = now + 250 + Math.random() * 150;
            if (tgt && mobSees(m, tgt, now, def.aggro * 1.5)) m.seen = now;
            else if (tgt && now - m.seen > 3500) tgt = m.tgt = null;
            if (!tgt) {
                let best = null, bd = def.aggro;
                for (const q of players.values()) {
                    const d = Math.hypot(q.x - m.x, q.y - m.y);
                    if (d < bd && mobSees(m, q, now, def.aggro)) {
                        best = q;
                        bd = d;
                    }
                }
                if (best) {
                    m.tgt = best.id;
                    m.seen = now;
                    tgt = best;
                    // Reaktionszeit: nicht sofort schiessen
                    m.nextShot = Math.max(m.nextShot, now + (600 + Math.random() * 300) / SPEED);
                }
            }
        }
        // Beruehrung: Nahkaempfer und Bosse
        const touch = def.melee || def.contact;
        if (touch) {
            for (const q of near(m.x, m.y, def.r + R + 4)) {
                if (Math.hypot(q.x - m.x, q.y - m.y) < def.r + R) damage(q, null, touch * dt, now, q.x, q.y, { how: def.boss ? 'boss' : 'npc', by: def.icon + ' ' + def.name, noDodge: true, dot: true });
            }
        }
        // Stampfer (Bosse): kuendigt sich an, steht dabei still
        if (def.slam) {
            if (m.slamAt) {
                if (now >= m.slamAt) {
                    m.slamAt = 0;
                    m.nextSlam = now + def.slam.ms / SPEED;
                    fxAt(m.x, m.y, { type: 'shBoom', x: Math.round(m.x), y: Math.round(m.y), r: def.slam.r, nuke: false });
                    for (const q of near(m.x, m.y, def.slam.r + R)) damage(q, null, def.slam.dmg, now, q.x, q.y, { how: 'boss', by: def.icon + ' ' + def.name, noDodge: true });
                }
                return;
            }
            if (now >= m.nextSlam && near(m.x, m.y, def.slam.r).length) {
                m.slamAt = now + 900 / SPEED;
                return;
            }
        }
        // Brut rufen (Hive Queen)
        if (def.summon && tgt && now >= m.nextSummon) {
            m.nextSummon = now + def.summon.ms / SPEED;
            const brood = mobs.filter(o => o.parent === m.id).length;
            for (let k = 0; k < def.summon.n && brood + k < def.summon.max; k++) {
                const a = Math.random() * 6.28;
                const x = m.x + Math.cos(a) * (def.r + 40), y = m.y + Math.sin(a) * (def.r + 40);
                if (blocked(x, y, 16)) continue;
                const d = spawnMob(def.summon.kind, x, y, now);
                d.parent = m.id;
                d.tgt = tgt.id;
                d.seen = now;
            }
        }
        if (tgt) {
            const d = Math.hypot(tgt.x - m.x, tgt.y - m.y);
            m.a = Math.atan2(tgt.y - m.y, tgt.x - m.x);
            if (def.melee) {
                mobMove(m, tgt.x, tgt.y, def.chase, dt);
            } else {
                const keep = def.keep || 200, range = def.range || def.aggro;
                if (d > range * 0.9) mobMove(m, tgt.x, tgt.y, def.speed * 1.1, dt);
                else if (d < keep) mobMove(m, m.x - (tgt.x - m.x), m.y - (tgt.y - m.y), def.speed, dt);
                else {
                    // seitlich ausweichen
                    const px = -(tgt.y - m.y) / d * m.strafe, py = (tgt.x - m.x) / d * m.strafe;
                    mobMove(m, m.x + px * 100, m.y + py * 100, def.speed * 0.7, dt);
                    if (Math.random() < dt * 0.4) m.strafe = -m.strafe;
                }
            }
            // Schiessen: nur mit freier Sicht; Sniper zielen erst (Laser)
            const g = def.gun;
            if (g && now >= m.nextShot && d < (def.range || def.aggro) * 1.1 && now - m.seen < 400) {
                if (g.aim && !m.aimAt) m.aimAt = now + g.aim / SPEED;
                if (!g.aim || now >= m.aimAt) {
                    m.aimAt = 0;
                    m.nextShot = now + g.ms / SPEED * (0.85 + Math.random() * 0.3);
                    // leicht vorhalten
                    const t = d / g.speed;
                    const aim = Math.atan2(tgt.y + tgt.my * 280 * t * 0.5 - m.y, tgt.x + tgt.mx * 280 * t * 0.5 - m.x);
                    for (let k = 0; k < g.burst; k++) {
                        const off = g.burst > 1 ? (g.fan ? (k / (g.burst - 1) - 0.5) * g.spread * 2 : (Math.random() - 0.5) * g.spread) : (Math.random() - 0.5) * g.spread;
                        mobShot(m, aim + off, now);
                    }
                }
            } else if (!tgt || now - m.seen >= 400) m.aimAt = 0;
            if (def.ring && now >= m.nextRing) {
                m.nextRing = now + def.ring.ms / SPEED;
                for (let k = 0; k < def.ring.n; k++) mobShot(m, k / def.ring.n * Math.PI * 2, now);
            }
        } else {
            m.aimAt = 0;
            // umherlaufen: Bosse ueber die ganze Map, andere um ihr Zuhause
            if (Math.hypot(m.tx - m.x, m.ty - m.y) < 40) {
                if (def.boss) {
                    const s = freeSpot(false);
                    m.tx = s.x;
                    m.ty = s.y;
                } else if (Math.random() < 0.02) {
                    m.tx = m.home.x + (Math.random() - 0.5) * 700;
                    m.ty = m.home.y + (Math.random() - 0.5) * 700;
                }
            } else {
                mobMove(m, m.tx, m.ty, def.speed * (def.boss ? 1 : 0.5), dt);
                m.a = Math.atan2(m.ty - m.y, m.tx - m.x);
            }
        }
    }

    // Bestand halten: Streuner nachschieben, Enforcer im Militaerlager
    function populate(now) {
        const want = Math.min(MOB_MAX, MOB_BASE + MOB_PER_PLAYER * players.size);
        let roam = mobs.filter(m => !m.def.boss && m.kind !== 'enforcer' && !m.parent).length;
        for (let k = 0; k < 3 && roam < want; k++) {
            const s = mobSpot();
            if (!s) break;
            const total = M.ROAMERS.reduce((a, [, w]) => a + w, 0);
            let r = Math.random() * total, kind = 'scav';
            for (const [kk, w] of M.ROAMERS) if ((r -= w) < 0) { kind = kk; break; }
            spawnMob(kind, s.x, s.y, now);
            roam++;
        }
        const enf = mobs.filter(m => m.kind === 'enforcer').length;
        enforcerAt = enforcerAt.filter(t => t > now);
        const z = MAP.military;
        for (let k = enf + enforcerAt.length; k < ENFORCERS; k++) {
            if ([...players.values()].some(p => inZone(p.x, p.y, z, 200))) break;
            for (let tries = 0; tries < 30; tries++) {
                const x = z[0] + 80 + Math.random() * (z[2] - 160), y = z[1] + 80 + Math.random() * (z[3] - 160);
                if (!blocked(x, y, 26)) {
                    spawnMob('enforcer', x, y, now, { x: z[0] + z[2] / 2, y: z[1] + z[3] / 2 });
                    break;
                }
            }
        }
    }

    function eventTick(now, dt) {
        if (!nextBossAt) nextBossAt = now + randIn(BOSS_EVERY) / SPEED;
        if (!nextDropAt) nextDropAt = now + randIn(DROP_EVERY) / SPEED;
        // Boss weg, ohne abgemeldet zu sein (z. B. Test-Hook): Uhr neu starten
        if (bossId !== null && !boss()) {
            bossId = null;
            nextBossAt = now + randIn(BOSS_EVERY) / SPEED;
        }
        if (bossId === null && now >= nextBossAt) spawnBoss(now);
        populate(now);
        gridMobs();
        // Nur Gegner in der Naehe von Spielern denken und laufen
        const plist = [...players.values()];
        for (const m of [...mobs]) {
            if (!(m.hp > 0) || !mobs.includes(m)) continue;
            if (!m.def.boss && !plist.some(p => Math.abs(p.x - m.x) < MOB_WAKE && Math.abs(p.y - m.y) < MOB_WAKE)) continue;
            mobTick(m, now, dt);
        }
        gridMobs();
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
            // leerer Raid: Events und Gegner weg, Uhr startet mit dem naechsten Spieler neu
            mobs.length = 0;
            bossId = null;
            enforcerAt = [];
            drop = null;
            nextBossAt = 0;
            nextDropAt = 0;
            return;
        }
        if (mode === 'extract') eventTick(now, dt);
        if (pvp) pvpTick(now);
        nadeTick(now, dt);

        for (const p of [...players.values()]) {
            if (!players.has(p.id) || p.dead) continue;
            // PvP-Countdown: alle stehen still
            if (pvp && pvp.phase !== 'fight') {
                p.fire = false;
                continue;
            }
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
                const howner = players.get(b.owner);
                for (const q of players.values()) {
                    if (q.id === b.owner || b.hits.has(q.id) || q.dead || (howner && howner.team && howner.team === q.team)) continue;
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
                    if (b.w.mobBoom) mobBoom(b, now);
                    gone = true;
                    break;
                }
                const bowner = players.get(b.owner);
                for (const q of players.values()) {
                    if (q.id === b.owner || b.hits.has(q.id) || q.dead || (bowner && bowner.team && bowner.team === q.team)) continue;
                    if (Math.hypot(q.x - b.x, q.y - b.y) < R + (b.w.big ? 14 : 4)) {
                        b.hits.add(q.id);
                        if (b.w.mobBoom) mobBoom(b, now);
                        else hitPlayer(b, q, now);
                        if (b.pierce > 0) b.pierce--;
                        else gone = true;
                        break;
                    }
                }
                if (!gone && !isMob(b.owner)) {
                    for (const m of mobsNear(b.x, b.y, 60)) {
                        if (b.hits.has(m.id) || Math.hypot(m.x - b.x, m.y - b.y) >= m.def.r + 4) continue;
                        b.hits.add(m.id);
                        const shooter = players.get(b.owner) || null;
                        const crit = b.w.crit && Math.random() < b.w.crit;
                        hurtMob(m, shooter, b.w.dmg * (crit ? (shooter ? shooter.b.critMul : 2) : 1), now, b.x, b.y, crit, b.w);
                        if (b.w.hole) bulletHole(b, now);
                        if (b.w.explode) explode(b, now, null);
                        if (b.pierce > 0) b.pierce--;
                        else gone = true;
                        break;
                    }
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
                    burn: !!p.burn || !!p.inFire, heal: now < p.healUntil, pr: now < p.protect, dead: !!p.dead, fz: !!(pvp && pvp.phase !== 'fight'),
                    hid: (!!(p.zone || p.smoke !== null) && now - p.lastShot >= REVEAL_MS * p.b.reveal) || stillHidden(p, now)
                },
                pvp: pvp ? { round: pvp.round, score: pvp.score, phase: pvp.phase, left: Math.max(0, Math.round(pvp.until - now)), last: pvp.last, team: p.team } : undefined,
                players: plist.filter(q => q === p || (inView(q.x, q.y) && canSee(p, q, now))).map(q => {
                    const qw = q.gear[q.slot] || q.gear.primary;
                    return {
                        id: q.id, n: q.name, c: q.color, lv: q.level, tm: q.team, dead: q.dead || undefined,
                        x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10, a: Math.round(q.a * 100) / 100,
                        hp: Math.max(0, Math.round(q.hp)), mh: q.maxHp, w: qw.base, wt: qw.tier, wn: qw.name,
                        ar: q.gear.vest ? I.ARMORS[q.gear.vest.base].set : null, hm: q.gear.helmet ? I.ARMORS[q.gear.helmet.base].set : null,
                        burn: !!q.burn, slow: now < q.slowUntil, pr: now < q.protect
                    };
                }),
                bullets: bullets.filter(b => inView(b.x, b.y)).map(b => [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.owner, b.fx, b.tier]),
                crates: crates.filter(cr => inView(cr.x, cr.y)).map(cr => [cr.id, cr.x, cr.y, now >= cr.readyAt ? 1 : 0, cr.t === 'mil' ? 1 : 0]),
                bags: bags.filter(b => inView(b.x, b.y)).map(b => [b.id, Math.round(b.x), Math.round(b.y), b.items.length, b.kind === 'boss' ? 2 : b.kind === 'drop' ? 1 : 0]),
                // Events sieht jeder, egal wo (Karte und Pfeil am Rand)
                boss: bossView(now),
                mobs: mobs.filter(m => !m.def.boss && inView(m.x, m.y)).map(m => [m.id, m.kind, Math.round(m.x), Math.round(m.y), Math.max(0, Math.round(m.hp)), m.maxHp, Math.round(m.a * 100) / 100, m.aimAt ? Math.max(0, Math.round(m.aimAt - now)) : 0]),
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
        startPvp: () => pvpRound(Date.now()), pvpState: () => pvp,
        has: c => players.has(c.id),
        names: () => [...players.values()].map(p => p.name),
        rooms: () => [{ id: 'raid', players: [...players.values()].map(p => p.name) }],
        _players: players, _bags: bags, _crates: crates, _damage: damage, _canSee: canSee,
        _spawnBoss: kind => spawnBoss(Date.now(), kind), _spawnDrop: () => spawnDrop(Date.now()), _boss: boss, _mobs: mobs,
        _spawnMob: (kind, x, y) => spawnMob(kind, x, y, Date.now())
    };
};

module.exports.MAP = MAP;
module.exports.blocked = blocked;
module.exports.slide = WORLD.slide;
module.exports.WORLD = WORLD;
module.exports.PVP_WORLDS = PVP_WORLDS;
module.exports.W = W;
module.exports.H = H;
