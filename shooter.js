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
// 6.9 (Max: oefter Bosse): 2–10 min -> 1–4 min
const BOSS_EVERY = [60e3, 4 * 60e3];
const BOSS_LIFE = 8 * 60e3;
// 6.9 (Max: Boss fast tot und dann weg): gegangen wird erst, wenn er seit
// BOSS_CALM keinen Treffer bekommen hat und kein Spieler in BOSS_NEAR ist
const BOSS_CALM = 60e3, BOSS_NEAR = 1100;
// 25.09.2026 (Max: Boss von ganz weit weg abschiessen, er macht nix): wer einen
// Raid-Boss von ausserhalb seiner Reichweite trifft, provoziert ihn fuer
// BOSS_PROVOKE ms – er sprintet (x BOSS_SPRINT) auf den Schuetzen zu und legt
// alle BOSS_RETAL ms eine Salve Einschlaege auf ihn (mit Vorwarnung, ausweichbar)
const BOSS_PROVOKE = 8000, BOSS_SPRINT = 2.2, BOSS_RETAL = 2600;
// Leerer Raid mit lebendem Boss: so lange bleibt alles stehen (6.10, Max)
const EMPTY_KEEP = 30e3;
// 6.12 (Max: bei Disconnect Items droppen): kommt so lange nichts mehr vom
// Browser (Handy im Standby, Tunnel weg, ohne sauberes Schliessen), gilt der
// Spieler als weg – wie Verlassen, die Items fallen als Beutel. Grosszuegig,
// weil Browser Timer in Hintergrund-Tabs drosseln (App-Ping alle 5 s).
const SILENT_MS = 90e3;
// Beutel eines Verlassenen/Getrennten liegen mindestens so lange (Max: min. 2 min)
const BAG_LIFE_LEFT = Math.max(BAG_LIFE, 2 * 60e3);
// Gegner (4.1): so viele laufen herum, geweckt nur in der Naehe von Spielern
const MOB_BASE = 45, MOB_PER_PLAYER = 8, MOB_MAX = 120;
// 25.09.2026 (Max: Gegner droppen zu viel, mit Railgun zu einfach): Dropchance
// aller normalen Gegner halbiert, Seltenheiten bleiben. Dazu Gegner-Level je
// Ebene: HP/Schaden steigen innerhalb der Ebene mit dem Level (zusaetzlich zu den
// Ebenen-Faktoren in UNDER_MOBS), XP steigen mit dem Level. Oberflaeche und Keller
// wuerfeln Epic und hoeher bei Gegner-Beute nur halb so oft, das Labor wie bisher.
const MOB_DROP_MUL = 0.5;
const MOB_LEVELS = { surface: [1, 10], bunker: [20, 30], lab: [40, 50] };
const MOB_LV_HP = 0.06, MOB_LV_DMG = 0.04, MOB_LV_XP = 0.05;
const MOB_EPIC_MUL = { surface: 0.5, bunker: 0.5, lab: 1 };
const MOB_WAKE = 1700;
const MIL_RESPAWN = 5 * 60e3;
// Untergrund (6.12, Max: Gegner dort „gerne deutlich staerker")
// n = so viele leben gleichzeitig, hp/dmg/spd = Faktoren auf die Grundwerte
const UNDER_MOBS = {
    bunker: { n: 16, hp: 2.5, dmg: 1.7, spd: 1.1, kinds: [['scav', 40], ['brute', 22], ['sniper', 16], ['drone', 12], ['enforcer', 10]], max: { enforcer: 3 } },
    lab: { n: 13, hp: 1, dmg: 1, spd: 1, kinds: [['mutant', 40], ['stalker', 26], ['horror', 24], ['hulk', 10]], max: { hulk: 2 } }
};
const UNDER_CRATE_RESPAWN = 4 * 60e3;
// Untergrund-Events (6.12.3, Max): Labor – ein Tank bricht auf und Monster kommen
// raus; Keller – ein Trupp Soldaten patrouilliert durch die Raeume
const BREACH_EVERY = [150e3, 300e3], BREACH_WARN = 3500, BREACH_REFILL = 6 * 60e3;
const PATROL_EVERY = [180e3, 300e3], PATROL_LIFE = 6 * 60e3;
const PORTAL_CD = 1500;
const ENFORCERS = 4, ENFORCER_RESPAWN = 3 * 60e3;
// Stationen: Sani heilt voll gegen Scrap, Haendler kauft und verkauft
const MEDIC_COST = 40, MEDIC_CD = 60e3;
const TRADER_BUY = { bandage: 12, medkit: 30, frag: 35, smoke: 25, stim: 45, molotov: 45, flash: 40 };
const TRADER_SELL = 0.6;          // Anteil des Salvage-Werts beim Verkauf im Raid
const DROP_EVERY = [3 * 60e3, 6 * 60e3];
const DROP_WARN = 15000;
// Capture the Flag (6.9, Max): Flagge taucht auf, ins Ziel tragen = Beute (Quelle 'ctf', seit 6.10.2 ~1 % Leg+)
const CTF_EVERY = [4 * 60e3, 9 * 60e3], CTF_LIFE = 6 * 60e3, CTF_PICK = 50, CTF_GOAL = 120, CTF_MIN_DIST = 1600;

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
    // 4.6 (Max): Haendler, Sani, Stadt und Aussenposten wieder raus, nur das Lager bleibt
    void town;
    void outpost;
    const reserved = [military];
    const stations = [];
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
            // 6.10 (Max: man buggt an Waenden in Haeusern): die Trennwand begann
            // 60 px unter der Oberkante -> 38 px Schlitz zur Aussenwand, Spieler
            // ist 36 px breit und quetschte sich durch. Jetzt an die Aussenwand
            // angesetzt, unteres Ende wie vorher (rand()-Folge unveraendert).
            // Liegt oben eine Tuer davor, bleibt stattdessen ein breiter Gang (80 px),
            // sonst teilt die Wand die Tuer in zwei Schlitze.
            if (rand() < 0.5) {
                const wx = x + w / 2 - T / 2, end = y + 60 + hh * 0.45;
                const door = doorRects.some(d => d[3] === T && Math.abs(d[1] - y) < 1 && d[0] < wx + T + 2 * R + 10 && d[0] + d[2] > wx - 2 * R - 10);
                const top = door ? y + T + 80 : y;
                walls.push([wx, top, T, end - top]);
            }
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
        town: null, outpost: null, military: military.map(Math.round)
    };
}

const MAP = buildMap();
// 6.12 (Max): Keller (Militaerstuetzpunkt) und Labor darunter, siehe arena-under.js
{
    const UNDER = require('./arena-under').buildUnder({ w: W, h: H, walls: MAP.walls });
    MAP.regions = [{ id: 'surface', name: 'Surface', level: 0, x: 0, y: 0, w: W, h: H }, ...UNDER.regions];
    MAP.walls.push(...UNDER.walls);
    MAP.crates.push(...UNDER.crates);
    MAP.stations.push(...UNDER.stations);
    MAP.deco = UNDER.deco;
}

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
    // 6.12: Karten mit Ebenen (Untergrund) – stehen darf man nur innerhalb einer Ebene
    const outside = (x, y, r = 0) => map.regions
        ? !map.regions.some(g => x >= g.x + r && y >= g.y + r && x <= g.x + g.w - r && y <= g.y + g.h - r)
        : x < r || y < r || x > w - r || y > hh - r;
    function blocked(x, y, r) {
        if (outside(x, y, r)) return true;
        for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
            for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++) {
                const list = grid.get(gx + ',' + gy);
                if (list && list.some(i => circleRect(x, y, r, map.walls[i]))) return true;
            }
        }
        return false;
    }
    return { map, w, h: hh, blocked, outside, slide: (x, y, dx, dy, r, isBlocked = blocked) => slideWith(x, y, dx, dy, r, isBlocked) };
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
// Zombie-Map (4.4): offen (Zombies laufen direkt auf Spieler zu), Saeulen und
// kurze Mauern als Deckung, Stationen wie in COD Zombies am Rand
const ZMB_W = 2600, ZMB_H = 1800;
const ZMB_PERKS = {
    jug: { name: 'Juggernaut', icon: '🥤', price: 2500, desc: '+100 max HP' },
    speed: { name: 'Rapid Fire', icon: '🧃', price: 3000, desc: '+25% fire rate' },
    stamina: { name: 'Stamina', icon: '🍹', price: 2000, desc: '+15% movement speed' },
    quick: { name: 'Regeneration', icon: '🧋', price: 1500, desc: 'Regeneration after 2 s, +2 HP/s' },
    // 6.5.1 (Max: mehr mit dem Geld machen)
    deadshot: { name: 'Deadshot', icon: '🎯', price: 3500, desc: '+12% crit chance' },
    vulture: { name: 'Vulture', icon: '🦅', price: 4000, desc: '+25% points' }
};
// Weitere Stationen (6.5.1): Ruestung (bis 4x +25 max HP), Granaten, Power-up-Altar, Wiederbeleben
const ZMB_ARMOR = 1200, ZMB_ARMOR_MAX = 4, ZMB_NADES = 800, ZMB_REVIVE = 1500;
// 6.10 (Max, schmoggi Welle 11 Waffe voll + Box-Spam): Altar und Box werden
// mit jedem Kauf teurer. Altar zaehlt je Runde (Effekt gilt fuers Team),
// Box je Spieler. Altar 6000, 9000, 12000 ... · Box 2000, 2500, 3000 ...
const ZMB_SHRINE = 6000, ZMB_SHRINE_STEP = 3000;
const ZMB_BOX_STEP = 500;
// Utility-Kiste (6.10, Max): wie die Box, aber Verbrauchsgut. 1500 + 400 je eigenem Kauf
const ZMB_UBOX = 1500, ZMB_UBOX_STEP = 400;
const zUboxPrice = n => ZMB_UBOX + ZMB_UBOX_STEP * n;
const zShrinePrice = n => ZMB_SHRINE + ZMB_SHRINE_STEP * n;
const zBoxPrice = n => ZMB_BOX + ZMB_BOX_STEP * n;
const ZMB_POWERUPS = {
    double: { name: 'Double Points', icon: '✖️2', ms: 30000, desc: 'double points for the whole team' },
    insta: { name: 'Insta-Kill', icon: '💀', ms: 15000, desc: 'every zombie dies in one hit (not bosses)' },
    nuke: { name: 'Nuke', icon: '☢️', ms: 0, desc: 'all zombies on the map die (not bosses)' },
    sale: { name: 'Fire Sale', icon: '🏷️', ms: 30000, desc: 'mystery box and wall weapons half price' }
};
const ZMB_WALL = { smg: 750, shotgun: 1000, rifle: 1400, sniper: 1500 };
// Pack-a-Punch seit 6.5.1 bis Stufe 5. 6.10: jede Stufe +5000 (5k..25k,
// voll 75k statt 50k); Box 950 -> 2000 plus Aufschlag je Kauf (oben)
const ZMB_BOX = 2000, ZMB_PAP = 5000, ZMB_PAP_MAX = 5;
const zPapPrice = lvl => Math.round(ZMB_PAP * (1 + lvl));
const ZMB_HEAL = 600, ZMB_HEAL_CD = 25000;
// 6.12.2 (Max: Heilen pro Runde und pro Kauf teurer): +60 je Welle, +300 je eigenem Kauf
// Welle 1 erster Kauf 660, Welle 10 erster 1200, dritter 1800, Welle 20 fuenfter 3000
const ZMB_HEAL_WAVE = 60, ZMB_HEAL_STEP = 300;
const zHealPrice = (wave, n) => ZMB_HEAL + ZMB_HEAL_WAVE * wave + ZMB_HEAL_STEP * n;
function buildZombieMap() {
    const rand = rng(777);
    const walls = [];
    const overlaps = (a, b, m) => a[0] < b[0] + b[2] + m && a[0] + a[2] + m > b[0] && a[1] < b[1] + b[3] + m && a[1] + a[3] + m > b[1];
    const center = [ZMB_W / 2 - 260, ZMB_H / 2 - 200, 520, 400];
    for (let k = 0; k < 2000 && walls.length < 26; k++) {
        const type = rand();
        const r = type < 0.6 ? [0, 0, 60 + rand() * 50, 60 + rand() * 50] : type < 0.8 ? [0, 0, 160 + rand() * 120, WALL_T] : [0, 0, WALL_T, 160 + rand() * 120];
        r[0] = 200 + rand() * (ZMB_W - 400 - r[2]);
        r[1] = 200 + rand() * (ZMB_H - 400 - r[3]);
        if (walls.some(o => overlaps(r, o, 150)) || overlaps(r, center, 60)) continue;
        walls.push(r.map(Math.round));
    }
    const st = (kind, x, y, extra) => ({ kind, x: Math.round(x), y: Math.round(y), ...extra });
    const stations = [
        st('wall', 90, ZMB_H * 0.3, { base: 'smg', price: ZMB_WALL.smg }),
        st('wall', 90, ZMB_H * 0.7, { base: 'shotgun', price: ZMB_WALL.shotgun }),
        st('wall', ZMB_W - 90, ZMB_H * 0.3, { base: 'rifle', price: ZMB_WALL.rifle }),
        st('wall', ZMB_W - 90, ZMB_H * 0.7, { base: 'sniper', price: ZMB_WALL.sniper }),
        st('box', ZMB_W / 2, ZMB_H - 110, { price: ZMB_BOX }),
        st('pap', ZMB_W / 2, 110, { price: ZMB_PAP }),
        st('ubox', ZMB_W / 2 + 220, ZMB_H - 110, { price: ZMB_UBOX }),
        st('perk', 150, 150, { perk: 'jug', price: ZMB_PERKS.jug.price }),
        st('perk', ZMB_W - 150, 150, { perk: 'speed', price: ZMB_PERKS.speed.price }),
        st('perk', 150, ZMB_H - 150, { perk: 'stamina', price: ZMB_PERKS.stamina.price }),
        st('perk', ZMB_W - 150, ZMB_H - 150, { perk: 'quick', price: ZMB_PERKS.quick.price }),
        // 4.6: Heilen fuer Punkte (Max: sonst keine Chance auf Leben)
        st('heal', ZMB_W / 2 - 360, ZMB_H / 2, { price: ZMB_HEAL }),
        st('heal', ZMB_W / 2 + 360, ZMB_H / 2, { price: ZMB_HEAL }),
        // 6.5.1: mehr zum Ausgeben
        st('perk', ZMB_W * 0.3, 110, { perk: 'deadshot', price: ZMB_PERKS.deadshot.price }),
        st('perk', ZMB_W * 0.7, 110, { perk: 'vulture', price: ZMB_PERKS.vulture.price }),
        st('armor', ZMB_W / 2 - 200, ZMB_H / 2 + 170, { price: ZMB_ARMOR }),
        st('nades', ZMB_W / 2 + 200, ZMB_H / 2 + 170, { price: ZMB_NADES }),
        st('shrine', ZMB_W / 2, ZMB_H / 2 - 170, { price: ZMB_SHRINE }),
        st('revive', ZMB_W / 2, ZMB_H / 2 + 170, { price: ZMB_REVIVE })
    ];
    const zspawns = [];
    for (let i = 0; i < 12; i++) {
        const edge = i % 4, t = 0.15 + (Math.floor(i / 4) * 0.35);
        zspawns.push(edge === 0 ? { x: ZMB_W * t, y: 40 } : edge === 1 ? { x: ZMB_W * t, y: ZMB_H - 40 } : edge === 2 ? { x: 40, y: ZMB_H * t } : { x: ZMB_W - 40, y: ZMB_H * t });
    }
    const spawns = { a: [0, 1, 2, 3].map(i => ({ x: ZMB_W / 2 - 90 + (i % 2) * 180, y: ZMB_H / 2 - 60 + Math.floor(i / 2) * 120 })) };
    return {
        name: 'Kek Mall', walls, crates: [], extracts: [], buildings: [], bushes: [], doors: [], stations,
        town: null, outpost: null, military: null, spawns, zspawns, arena: [0, 0, ZMB_W, ZMB_H]
    };
}
const ZOMBIE_WORLD = makeWorld(buildZombieMap(), ZMB_W, ZMB_H);

// Zombie-Coins (5.9, Wunsch Max: zweite Coin-Quelle neben Snake). Ausgezahlt
// am Spielende je Spieler: eigene Kills (Tank/Boss mehr) plus Wellenbonus,
// der mit jeder ueberlebten Welle waechst (Welle n bringt 50·n).
// Richtwerte solo: Welle 5 ~1,2k, Welle 10 ~4k, Welle 20 ~15k Coins.
// 6.5.1 (Max: zu viel Geld): Kill 5 -> 3, Welle 50 -> 30 (Welle 20 vorher ~15k Coins, jetzt ~8k)
const Z_COINS = { kill: 3, tank: 12, boss: 200, wave: 30 };

// Schwierigkeit (6.10, Max): waehlt der Host beim Erstellen der Lobby.
// Normal = bisheriges Spiel. Punkte je Zombie bleiben gleich (Schaden wird
// durch die HP geteilt), Coins und XP am Ende werden mit `reward` skaliert.
// Easy zaehlt nicht fuer die beste Welle, sonst waere die nichts mehr wert.
const Z_DIFF = {
    easy: { name: 'Easy', icon: '🟢', hp: 0.65, dmg: 0.6, spd: 0.92, count: 0.8, reward: 0.5 },
    normal: { name: 'Normal', icon: '🟡', hp: 1, dmg: 1, spd: 1, count: 1, reward: 1 },
    hard: { name: 'Hard', icon: '🔴', hp: 1.5, dmg: 1.35, spd: 1.08, count: 1.2, reward: 1.75 }
};

// 6.5 (Max: bis Welle 10 viel zu einfach, auch mit Level 3 und Mystery-Box-
// Waffen): Zombies werden je Welle zaeher, staerker und schneller.
//   HP     Welle 5 ×2,4 · 10 ×5,3 · 15 ×8,1 · 20 ×12 · 25 ×17
//   Schaden Welle 10 ×1,5 · 25 ×2,4
//   Tempo  +1,5 % je Welle, hoechstens +40 %
const zHp = w => 1 + 0.3 * (w - 1) + 0.015 * (w - 1) * (w - 1);
const zDmg = w => 1 + 0.06 * (w - 1);
// 6.5.1: halbiert (Punkte fuer Waffen/Perks kamen zu schnell)
// 6.8 (Max, Bens Runde bis Welle 24): Schaden zaehlt geteilt durch zHp(Welle).
// Vorher wuchsen die Punkte je Zombie mit seinen HP (Welle 20: x12), die
// Preise aber nicht – normaler Zombie Welle 1 ~90, Welle 20 ~420 Punkte.
// Jetzt ist ein Zombie auf jeder Welle gleich viel wert (~80); mehr Punkte
// gibt es nur ueber mehr Zombies. Solo je Welle: W10 ~12k -> ~4,6k, W20 ~46k -> ~8,6k.
// 6.10 (Max: immer noch zu viel, schmoggi Welle 11 Waffe voll): 0,5/50 -> 0,35/30,
// normaler Zombie ~80 -> ~51 Punkte (-36 %).
// 6.12.2 (Max: „knapp 60 % weniger Geld"): alle Punkte ×0,4 – Zombie ~51 -> ~20,
// dazu Tank/Boss-Kill und Nuke-Bonus ueber Z_PTS_MUL
const Z_PTS_MUL = 0.4;
// Schaden an Zombie-Bossen nach Entfernung des Schuetzen (6.12.3)
const Z_BOSS_NEAR = 500, Z_BOSS_FAR = 1400, Z_BOSS_MIN = 0.3;
const zBossFalloff = d => d <= Z_BOSS_NEAR ? 1 : Math.max(Z_BOSS_MIN, 1 - (1 - Z_BOSS_MIN) * (d - Z_BOSS_NEAR) / (Z_BOSS_FAR - Z_BOSS_NEAR));
const Z_PTS_PER_DMG = 0.35 * Z_PTS_MUL, Z_PTS_KILL = 30 * Z_PTS_MUL;
// Kugel-Optik der Zombie-Bosse (tier-Feld der Kugel, 1024 = Boss-Kugel)
const BOSS_LOOK = { abomination: 5, necro: 11, brood: 12, inferno: 13, storm: 14, overlord: 15, judge: 11, seraph: 13, omega: 15 };
const HZ = require('./arena-hazards');
const RAID_HZ_BOX = 2000;         // Kampf-Box der Raid-Bosse mit Gefahrenzonen
// 6.5.1: von Anfang an 12 % schneller
const zSpd = w => Math.min(1.5, 1.12 + 0.015 * (w - 1));
// Pause zwischen Wellen: am Anfang kurz, spaeter mehr Zeit zum Einkaufen
const zBreak = w => Math.min(12000, 4000 + 600 * w);
function zCoins(reached, killCoins) {
    return Math.floor(killCoins + Z_COINS.wave * reached * (reached + 1) / 2);
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
        sl: it.slot || null, o: it.odds, sc: it.score, m: it.mods && it.mods.length ? it.mods.map(m => [m.id, m.lvl]) : undefined,
        wxp: it.wxp || undefined
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
    // Ebene eines Punkts (6.12): 'surface' | 'bunker' | 'lab'; Karten ohne Ebenen -> 'surface'
    const regionAt = (x, y) => { const g = (MAP.regions || []).find(q => x >= q.x && y >= q.y && x <= q.x + q.w && y <= q.y + q.h); return g ? g.id : 'surface'; };
    // h: { accounts, send, feed, refresh(c), changed() }
    const players = new Map();       // client id -> Spieler im Raid
    const bullets = [];
    // 6.6: Kisten haben eine Stufe (0 normal, 1 Vorrat, 2 golden), neu gewuerfelt beim Nachfuellen
    const crateGrade = () => { const r = Math.random(); return r < 0.02 ? 2 : r < 0.13 ? 1 : 0; };
    const crates = MAP.crates.map((c, i) => ({ id: i, x: c.x, y: c.y, t: c.t, readyAt: 0, g: c.t === 'mil' ? 0 : crateGrade() }));
    const bags = [];
    const nades = [];                // Wurfsachen im Flug oder mit Zuender
    const smokes = [];               // Rauchwolken { id, x, y, r, until }
    const fires = [];                // Feuerflaechen { id, x, y, r, until, owner, dps }
    const holes = [];                // Schwarze Loecher { id, x, y, r, until, owner, dmg }
    // 25.09.2026 Uniques Welle 2
    const kqBombs = [];              // Killer Queen { owner, mob, pid, x, y, until }
    const turrets = [];              // Hoi-Poi { id, owner, x, y, until, next, a }
    const decoys = [];               // Kyoka Suigetsu { id, pid, x, y, a, until }
    // Welle 3
    const portals = new Map();       // Portal Gun: owner -> { a, b, next, until }
    const clones = [];               // Kage Bunshin { id, owner, k, x, y, a, until, next }
    let zw = null;                   // Za Warudo { by, until }
    let seqId = 0;
    const mobs = [];                 // Gegner und Boss (4.1), siehe arena-mobs.js
    const strikes = [];              // angekuendigte Einschlaege der Bosse (4.6)
    // Gefahrenzonen der Bullet-Hell-Bosse (6.9, arena-hazards.js)
    const hz = HZ.createHazards({
        W, H, R, speed: SPEED, players: () => players.values(),
        damage: (p, dmg, now, by) => damage(p, null, dmg, now, p.x, p.y, { how: 'boss', by, noDodge: true })
    });
    let mobSeq = 0;
    let bossId = null;               // id des Bosses in mobs
    let lastBoss = null;
    let enforcerAt = [];             // Respawn-Zeiten der Enforcer
    let drop = null;                 // angekuendigter Versorgungsabwurf { x, y, at }
    let nextBossAt = 0, nextDropAt = 0;
    let emptySince = 0;              // leer seit (Boss-Schonfrist, EMPTY_KEEP)
    let ctf = null, nextCtfAt = 0;    // { x, y, carrier, bx, by, until }
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
        // 6.10.2: einmal alle Verbrauchsgueter/Rucksaecke auf die Stufe ihrer Basis ziehen
        // (plain()-Fehler machte aus legendaeren Utils nach dem Raid „Common")
        if (a.v === 3 && !a.fixTier1) {
            for (const it of [...(a.inv || []), ...(a.overflow || [])]) I.migrate(it);
            a.fixTier1 = true;
        }
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
            xp: pr.xp, level: lv.level, into: lv.into, need: lv.need, stats: pr.stats, resets: pr.resets || 0,
            // 6.5: je Modus ein Baum (Level und Stats geteilt)
            trees: Object.fromEntries(L.MODES.map(m => [m, { skills: L.treeOf(pr, m).skills, resets: L.treeOf(pr, m).resets || 0, resetCost: L.resetCost(L.treeOf(pr, m).resets) }])),
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

    // Waffen-Level: XP an die gehaltene Waffe; in PvP/Zombies (Kopien) auch ans Original im Lager
    function weaponXp(p, n) {
        const it = p && (p.gear[p.slot] || p.gear.primary);
        if (!it || it.starter || it.kind !== 'weapon' || !(n > 0) || !p.account) return;
        const before = I.weaponLevel(it).level;
        const got = Math.round(n);
        it.wxp = (it.wxp || 0) + got;
        if (mode !== 'extract') {
            const orig = st(p.c).inv.find(x => x.uid === it.uid);
            if (orig && orig !== it) orig.wxp = (orig.wxp || 0) + got;
        }
        h.accounts.touch();
        const after = I.weaponLevel(it).level;
        if (after > before) {
            const ms = I.WLV.milestones.includes(after);
            h.send(p.c, { type: 'shEvent', text: `🔫 ${it.name} reached level ${after}!${ms ? ' +5% fire rate' : ''}`, kind: 'self' });
            if (after === I.WLV.max) h.feed(`🔫 ${p.name} maxed out a ${it.name} (level ${after})!`, 'gold');
        }
    }

    function count(a, base) {
        return a.inv.filter(it => it.kind === 'util' && it.base === base).length;
    }

    function sendHub(c, extra) {
        const a = st(c);
        if (!a) return;
        flushOverflow(a);
        const u = h.accounts.get(c.account);
        h.send(c, {
            type: 'arHub', inv: a.inv.map(it => ({ ...it, sv: I.salvageValue(it) })), loadout: a.loadout,
            overflow: (a.overflow || []).map(it => ({ ...it, sv: I.salvageValue(it) })),
            invMax: I.invMaxOf(a), invUp: a.invUp || 0,
            loadouts: { extract: a.loadout, pvp: loadoutOf(a, 'pvp'), zombies: loadoutOf(a, 'zombies') },
            presets: Object.fromEntries(L.MODES.map(m => [m, presetsOf(a, m).map(x => ({ name: x.name, l: x.l }))])),
            scrap: a.scrap, coins: u.coins, inRaid: players.has(c.id), prog: progView(c, a), pvp: a.pvp || null, zombies: a.zombies || null,
            // 6.1: ungeoeffnete Cases und Daily Case Wheel
            cases: a.cases || {}, wheel: h.wheels ? { ready: h.wheels.ready('case', u), segs: h.wheels.segments('case') } : null, ...extra
        });
    }

    function noteBest(key, item) {
        h.accounts.stat(key, s => {
            s.bestOdds = Math.max(s.bestOdds || 0, item.odds || 0);
            s.bestTier = Math.max(s.bestTier || 0, I.TIER_IDX[item.tier] || 0);
            s.bestScore2 = Math.max(s.bestScore2 || 0, item.score || 0);
        });
    }

    // 6.6 (Max): Lager voll -> nichts mehr automatisch zu Scrap (Avalon verlor so
    // seine erste goldene Waffe). Was nicht passt, wartet in a.overflow und
    // rutscht nach, sobald Platz frei wird (flushOverflow bei jedem sendHub).
    const OVERFLOW_MAX = 200;
    function addItems(c, items) {
        const a = st(c);
        const room = I.invMaxOf(a) - a.inv.length;
        const kept = items.slice(0, Math.max(0, room));
        const over = items.slice(kept.length);
        a.inv.push(...kept);
        a.overflow = a.overflow || [];
        a.overflow.push(...over);
        // Notbremse: nur wenn auch die Warteschlange ueberlaeuft, geht das Schlechteste zu Scrap
        let scrap = 0;
        if (a.overflow.length > OVERFLOW_MAX) {
            a.overflow.sort((x, y) => (y.score || 0) - (x.score || 0));
            for (const it of a.overflow.splice(OVERFLOW_MAX)) scrap += I.salvageValue(it);
            a.scrap += scrap;
        }
        for (const it of kept.concat(over)) noteBest(c.account, it);
        h.accounts.touch();
        return { kept, over, scrap };
    }

    function flushOverflow(a) {
        if (!a.overflow || !a.overflow.length) return;
        const room = I.invMaxOf(a) - a.inv.length;
        if (room > 0) a.inv.push(...a.overflow.splice(0, room));
        h.accounts.touch();
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
    function fixLoadout(a, only) {
        for (const l of only ? [only] : [a.loadout, ...Object.values(a.loadouts || {})]) {
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
    }

    // 6.5 (Max): je Modus ein eigenes Loadout. Extraction nutzt a.loadout (die
    // Sachen gehen mit in den Raid), PvP und Zombies eigene (dort nur Kopien).
    // Dazu je Modus bis zu PRESET_MAX gespeicherte Loadouts zum Umschalten.
    const PRESET_MAX = 5;
    function loadoutOf(a, mode) {
        if (mode !== 'pvp' && mode !== 'zombies') return a.loadout;
        a.loadouts = a.loadouts || {};
        if (!a.loadouts[mode]) a.loadouts[mode] = JSON.parse(JSON.stringify(a.loadout));
        return a.loadouts[mode];
    }
    function presetsOf(a, mode) {
        a.presets = a.presets || {};
        const m = L.MODES.includes(mode) ? mode : 'extract';
        a.presets[m] = a.presets[m] || [];
        return a.presets[m];
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
            if (a.inv.length + n > I.invMaxOf(a)) return h.send(c, { type: 'arError', error: 'Your stash is full – salvage something first' });
            const err = pay(c, offer.price * n, offer.currency);
            if (err) return h.send(c, { type: 'arError', error: err });
            const items = Array.from({ length: n }, () => offer.kind === 'gen' ? I.generate(offer.source) : I.plain(offer.kind, offer.base));
            addItems(c, items);
            return sendHub(c, { got: { ...items[0], n } });
        }
        // Kaufen (6.1): landet ungeoeffnet bei "Your cases"
        if (d.type === 'arCase') {
            const cs = Object.prototype.hasOwnProperty.call(I.CASES, d.id) ? I.CASES[d.id] : null;
            if (!cs || cs.wheel) return;
            const n = Math.max(1, Math.min(10, Math.floor(Number(d.n)) || 1));
            const err = pay(c, cs.price * n, cs.currency);
            if (err) return h.send(c, { type: 'arError', error: err });
            a.cases = a.cases || {};
            a.cases[d.id] = (a.cases[d.id] || 0) + n;
            h.accounts.touch();
            return sendHub(c, { caseBought: { id: d.id, n } });
        }
        // Daily Case Wheel (6.1)
        if (d.type === 'arWheel') {
            const r = h.wheels ? h.wheels.spin('case', c.account) : { err: 'No wheel' };
            if (r.err) return h.send(c, { type: 'arError', error: r.err });
            const [cid, n] = r.prize;
            a.cases = a.cases || {};
            a.cases[cid] = (a.cases[cid] || 0) + n;
            h.accounts.stat(c.account, s => { s.caseWheels = (s.caseWheels || 0) + 1; });
            h.accounts.touch();
            if (r.slot === 'jackpot') h.feed(`🎰 ${h.accounts.get(c.account).name} hit the JACKPOT on the Daily Case Wheel!`, 'gold');
            return sendHub(c, { wheelSpin: { index: r.index, prize: r.prize } });
        }
        // Oeffnen aus dem Inventar (6.1)
        if (d.type === 'arCaseOpen') {
            const cs = Object.prototype.hasOwnProperty.call(I.CASES, d.id) ? I.CASES[d.id] : null;
            a.cases = a.cases || {};
            if (!cs || !(a.cases[d.id] > 0)) return h.send(c, { type: 'arError', error: 'You have no such case' });
            if (a.inv.length >= I.invMaxOf(a)) return h.send(c, { type: 'arError', error: 'Your stash is full – salvage something first' });
            a.cases[d.id]--;
            if (!a.cases[d.id]) delete a.cases[d.id];
            const item = I.generate(cs.source);
            addItems(c, [item]);
            h.accounts.stat(c.account, s => { s.casesOpened = (s.casesOpened || 0) + 1; });
            // Band fuer die Animation: Zufallsware aus demselben Case
            // 6.2: laengeres Band (vorher 34, Gewinner auf 29 – auf breiten
            // Schirmen endete es rechts sichtbar)
            const REEL = 70, WIN = 55;
            const reel = Array.from({ length: REEL }, () => brief(I.generate(cs.source)));
            reel[WIN] = brief(item);
            // Feed erst, wenn das Band im Browser steht (6.2: bis ~7,5 s)
            if (I.TIER_IDX[item.tier] >= 4) {
                const line = `${cs.icon} ${h.accounts.get(c.account).name} unboxed a ${I.TIERS[I.TIER_IDX[item.tier]].name} ${item.name}!`;
                setTimeout(() => h.feed(line, 'gold'), 8000);
            }
            return sendHub(c, { caseItem: { ...item, sv: I.salvageValue(item) }, reel, reelWin: WIN, caseId: d.id });
        }
        if (d.type === 'arProg') {
            const pr = a.prog;
            // 6.5: Baum je Modus; Stats sind fuer alle gleich
            const mode = L.MODES.includes(d.mode) ? d.mode : 'extract';
            const tree = L.treeOf(pr, mode);
            if (d.op === 'apply') {
                const stats = {}, skills = {};
                for (const [k, n] of Object.entries(d.stats || {})) stats[k] = Math.floor(Number(n));
                for (const [k, n] of Object.entries(d.skills || {})) skills[k] = Math.floor(Number(n));
                const err = L.validate(pr, stats, skills, mode);
                if (err) return h.send(c, { type: 'arError', error: err });
                pr.stats = Object.fromEntries(Object.entries(stats).filter(([, n]) => n > 0));
                tree.skills = Object.fromEntries(Object.entries(skills).filter(([, n]) => n > 0));
                h.accounts.touch();
                return sendHub(c, { progSaved: true });
            }
            if (d.op === 'reset') {
                // what: 'stats' = nur Stats (alle Modi), sonst nur der Baum dieses Modus
                const stats = d.what === 'stats';
                const cost = L.resetCost(stats ? pr.resets : tree.resets);
                const u = h.accounts.get(c.account);
                if (u.coins < cost.coins) return h.send(c, { type: 'arError', error: `A reset costs ${cost.coins.toLocaleString('en-US')} coins` });
                if (a.scrap < cost.scrap) return h.send(c, { type: 'arError', error: `A reset costs ${cost.scrap.toLocaleString('en-US')} scrap` });
                if (stats ? !Object.keys(pr.stats).length : !Object.keys(tree.skills).length) return h.send(c, { type: 'arError', error: 'Nothing to reset' });
                h.accounts.addCoins(c.account, -cost.coins);
                h.accounts.earn(c.account, 'shooter', -cost.coins);
                a.scrap -= cost.scrap;
                if (stats) {
                    pr.stats = {};
                    pr.resets = (pr.resets || 0) + 1;
                } else {
                    tree.skills = {};
                    tree.resets = (tree.resets || 0) + 1;
                }
                h.accounts.touch();
                h.refresh(c);
                return sendHub(c, { progReset: true });
            }
            return;
        }
        // Lager-Upgrade (25.09.2026): naechste Stufe gegen Coins UND Scrap
        if (d.type === 'arInvUp') {
            const n = (a.invUp || 0) + 1, cost = I.invUpCost(n);
            if (!cost) return h.send(c, { type: 'arError', error: 'Your stash is fully upgraded' });
            const u = h.accounts.get(c.account);
            if (u.coins < cost.coins || a.scrap < cost.scrap) return h.send(c, { type: 'arError', error: `Upgrade ${n} costs ${cost.coins.toLocaleString('en-US')} coins and ${cost.scrap.toLocaleString('en-US')} scrap` });
            pay(c, cost.coins, 'coins');
            pay(c, cost.scrap, 'scrap');
            a.invUp = n;
            h.accounts.touch();
            return sendHub(c, { invUpped: { n, max: I.invMaxOf(a) } });
        }
        // Schutz (6.9, Max): geschuetzte Items (it.fav) lassen sich nicht verschrotten
        if (d.type === 'arFav') {
            const it = a.inv.find(x => x.uid === String(d.uid)) || (a.overflow || []).find(x => x.uid === String(d.uid));
            if (!it) return;
            if (d.on) it.fav = true;
            else delete it.fav;
            h.accounts.touch();
            return sendHub(c, {});
        }
        // Fuse (6.11, Max): Hauptwaffe frisst Waffen derselben Basis, je Waffe FUSE_COST Scrap
        if (d.type === 'arFuse') {
            const main = a.inv.find(it => it.uid === String(d.main));
            // 6.11.1 (Max): auch Ruestung
            if (!main || (main.kind !== 'weapon' && main.kind !== 'armor')) return h.send(c, { type: 'arError', error: 'Pick a weapon or armor piece to fuse into' });
            const uids = [...new Set((Array.isArray(d.with) ? d.with : []).slice(0, 50).map(String))].filter(u => u !== main.uid);
            const others = uids.map(u => a.inv.find(it => it.uid === u)).filter(Boolean);
            if (!others.length || others.length !== uids.length) return h.send(c, { type: 'arError', error: 'Pick at least one item to fuse in' });
            if (others.some(it => it.kind !== main.kind || it.base !== main.base)) return h.send(c, { type: 'arError', error: 'You can only fuse the same item' });
            if (others.some(it => it.fav)) return h.send(c, { type: 'arError', error: '⭐ Protected items cannot be fused in – unprotect them first' });
            if (!(main.mods || []).length) return h.send(c, { type: 'arError', error: 'The main item needs at least one effect' });
            const bad = I.fuseUseless(main, others);
            if (bad >= 0) return h.send(c, { type: 'arError', error: `${others[bad].name} would not improve anything – take it out` });
            const err = pay(c, I.FUSE_COST * others.length, 'scrap');
            if (err) return h.send(c, { type: 'arError', error: err });
            const { item, log } = I.fuse(main, others);
            Object.assign(main, item);
            // Achievements (25.09.2026): gefuste Items, Effekt auf Maximum gebracht
            const mdefs = main.kind === 'armor' ? I.ARMOR_MODS : I.WEAPON_MODS;
            const maxed = log.some(l => !l.fail && mdefs[l.id] && l.to >= mdefs[l.id].max);
            h.accounts.stat(c.account, s => { s.fuses = (s.fuses || 0) + others.length; if (maxed) s.fuseMaxed = (s.fuseMaxed || 0) + 1; });
            const gone = new Set(uids);
            a.inv = a.inv.filter(it => !gone.has(it.uid));
            fixLoadout(a);
            h.accounts.touch();
            return sendHub(c, { fused: { uid: main.uid, kind: main.kind, n: others.length, log, cost: I.FUSE_COST * others.length } });
        }
        if (d.type === 'arSalvage') {
            const uids = new Set((Array.isArray(d.uids) ? d.uids : []).slice(0, 300).map(String));
            const out = a.inv.filter(it => uids.has(it.uid) && !it.fav).concat((a.overflow || []).filter(it => uids.has(it.uid) && !it.fav));
            if (!out.length && [...a.inv, ...(a.overflow || [])].some(it => uids.has(it.uid) && it.fav)) return h.send(c, { type: 'arError', error: '⭐ Protected items cannot be salvaged – unprotect them first' });
            out.forEach(it => uids.delete(it.uid));
            for (const u of [...uids]) uids.delete(u);
            out.forEach(it => uids.add(it.uid));
            if (!out.length) return;
            const scrap = Math.round(out.reduce((s, it) => s + I.salvageValue(it), 0) * L.bonuses(a.prog, 'extract').scrap);
            a.inv = a.inv.filter(it => !uids.has(it.uid));
            if (a.overflow) a.overflow = a.overflow.filter(it => !uids.has(it.uid));
            fixLoadout(a);
            a.scrap += scrap;
            h.accounts.touch();
            return sendHub(c, { salvaged: { count: out.length, scrap } });
        }
        if (d.type === 'arPreset') {
            const mode = L.MODES.includes(d.mode) ? d.mode : 'extract';
            const list = presetsOf(a, mode);
            const i = Math.floor(Number(d.i));
            if (d.op === 'save') {
                const name = String(d.name || '').replace(/[<>]/g, '').trim().slice(0, 24) || `Loadout ${list.length + 1}`;
                const copy = JSON.parse(JSON.stringify(loadoutOf(a, mode)));
                if (Number.isInteger(i) && list[i]) list[i] = { name, l: copy };
                else if (list.length >= PRESET_MAX) return h.send(c, { type: 'arError', error: `At most ${PRESET_MAX} saved loadouts per mode` });
                else list.push({ name, l: copy });
            } else if (d.op === 'load') {
                if (!list[i]) return;
                const l = JSON.parse(JSON.stringify(list[i].l));
                if (mode === 'extract') a.loadout = l;
                else a.loadouts[mode] = l;
                fixLoadout(a, l);
            } else if (d.op === 'delete') {
                if (!list[i]) return;
                list.splice(i, 1);
            } else if (d.op === 'copy') {
                // Loadout eines anderen Modus uebernehmen
                const from = L.MODES.includes(d.from) ? d.from : null;
                if (!from || from === mode) return;
                const l = JSON.parse(JSON.stringify(loadoutOf(a, from)));
                if (mode === 'extract') a.loadout = l;
                else a.loadouts[mode] = l;
                fixLoadout(a, l);
            } else return;
            h.accounts.touch();
            return sendHub(c);
        }
        if (d.type === 'arEquip') {
            const lo = loadoutOf(a, d.mode);
            const slot = String(d.slot);
            if (slot === 'util0' || slot === 'util1') {
                const i = slot === 'util0' ? 0 : 1;
                const b = d.base === null ? null : String(d.base);
                if (b === null) lo.util[i] = null;
                else {
                    if (!Object.prototype.hasOwnProperty.call(I.UTILS, b)) return;
                    const other = lo.util[1 - i];
                    const free = count(a, b) - (other && other.base === b ? other.n : 0);
                    const n = Math.max(0, Math.min(I.UTILS[b].stack, free, Math.floor(Number(d.n)) || 0));
                    lo.util[i] = n ? { base: b, n } : null;
                }
            } else if (GEAR.includes(slot)) {
                if (d.uid === null) lo[slot] = null;
                else {
                    const it = a.inv.find(x => x.uid === d.uid);
                    const ok = it && (slot === 'primary' || slot === 'secondary' ? it.kind === 'weapon' : slot === 'backpack' ? it.kind === 'pack' : it.kind === 'armor' && it.slot === slot);
                    if (!ok) return h.send(c, { type: 'arError', error: 'That does not fit there' });
                    // dieselbe Waffe nicht in beiden Slots
                    for (const s of ['primary', 'secondary']) if (lo[s] === it.uid) lo[s] = null;
                    lo[slot] = it.uid;
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
        p.critArmor = s.crit || 0;
        p.sets = s.sets;
        // 25.09.2026 Unique-Ruestung mit Mechanik
        p.see = s.see;
        p.killHeal = s.killHeal;
        p.geppo = s.geppo;
        p.plusUltra = s.plusUltra;
        p.counter = s.counter;
        p.weights = s.weights;
        p.geass = s.geass;
        p.flashstep = s.flashstep;
        p.mirror = s.mirror;
        p.titanSuit = s.titan;
        if (s.weights && p.weightsOff) {
            p.speedMul += 0.4;
            p.rateMul *= 1.25;
        }
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
        // Ruestungsplatten (Zombie-Station, 6.5.1)
        if (p.armorN) {
            p.hp = p.hp / p.maxHp * (p.maxHp + 25 * p.armorN);
            p.maxHp += 25 * p.armorN;
        }
        // Zombie-Perks
        if (p.perks && p.perks.length) {
            if (p.perks.includes('jug')) {
                p.hp = p.hp / p.maxHp * (p.maxHp + 100);
                p.maxHp += 100;
            }
            if (p.perks.includes('speed')) p.rateMul *= 1.25;
            if (p.perks.includes('stamina')) p.speedMul *= 1.15;
            if (p.perks.includes('deadshot')) p.critBonus = 0.12;
            if (p.perks.includes('quick')) {
                p.regen += 2;
                p.b.regenDelay = 2000;
            }
        }
        // Titan Shift: Extra-HP bleiben, auch wenn waehrenddessen umgeruestet wird
        if (p.titanHp) {
            p.maxHp += p.titanHp;
            p.hp = Math.min(p.hp + p.titanHp, p.maxHp);
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
            b: L.bonuses(a.prog, mode), level: L.levelOf(a.prog.xp).level, windUsed: false, lastUsed: false, adrenCd: 0, rampUntil: 0
        };
    }

    function join(c, name, color, team) {
        if (!c.account) return 'Log in to raid';
        if (players.has(c.id)) {
            sendJoined(c);
            return null;
        }
        if (pvp) return joinPvp(c, name, team);
        if (zb) return joinZombies(c, name);
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
        h.send(c, joinedMsg(c));
    }

    // Auch fuer Zuschauer (Admin, 6.3): Einstiegsdaten des Raids ohne Senden
    function joinedMsg(c) {
        return {
            type: 'shJoined', id: c.id,
            map: {
                w: W, h: H, walls: MAP.walls, buildings: MAP.buildings, doors: MAP.doors, bushes: MAP.bushes, wallT: WALL_T,
                extracts: MAP.extracts, extractR: EXTRACT_R, r: R, move: MOVE, view: VIEW, throwRange: I.THROW_RANGE,
                stations: MAP.stations, town: MAP.town, outpost: MAP.outpost, military: MAP.military, mobs: M.catalog(),
                trader: { buy: TRADER_BUY, sell: TRADER_SELL }, medic: { cost: MEDIC_COST, cd: MEDIC_CD },
                perks: ZMB_PERKS, arena: MAP.arena || null, name: MAP.name || null, regions: MAP.regions || null, deco: MAP.deco || null
            },
            packMax: p0PackMax(c), feed: pvp ? [] : feedLog.slice(-6), mode, team: players.get(c.id) ? players.get(c.id).team : undefined,
            mapName: MAP.name || null
        };
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
        if (zb) return how === 'left' ? zLeave(p) : zDown(p);
        if (!players.has(p.id)) return;
        players.delete(p.id);
        const loot = lootOf(p);
        let rest = loot;
        award(p, L.XP.minute * Math.floor((Date.now() - p.joinedAt) / 60000), 'time in raid');
        if (killer && players.has(killer.id)) {
            onKill(killer, Date.now());
            award(killer, L.XP.kill + 10 * Math.max(0, (p.level || 1) - (killer.level || 1)), 'kill');
            weaponXp(killer, L.XP.kill);
            if (killer.b.bloodlust) killer.hp = Math.min(killer.maxHp, killer.hp + killer.b.bloodlust);
            if (killer.b.rampage) killer.rampUntil = Date.now() + 4000 / SPEED;
            rest = pickUp(killer, loot);
            killer.kills++;
            const got = loot.filter(it => !rest.includes(it));
            if (got.length) h.send(killer.c, { type: 'shLoot', from: p.name, items: got.map(brief), full: rest.length > 0 });
            sendInv(killer);
        }
        dropBag(p.x, p.y, rest);
        if (how === 'left' && bags.length && bags[bags.length - 1].items === rest) bags[bags.length - 1].expires = Date.now() + BAG_LIFE_LEFT;
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
        h.send(p.c, {
            type: 'shLeft', result: how === 'left' ? 'left' : 'died', by: killer ? killer.name : by || null, lost: loot.map(brief),
            kills: p.kills, secs: Math.round((Date.now() - p.joinedAt) / 1000), weapon: line.weapon, wtier: line.tier
        });
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
            h.send(p.c, { type: 'shLeft', result: 'extracted', items: p.pack.map(brief), scrap: r.scrap, waiting: r.over.length, kills: p.kills, secs: Math.round((Date.now() - p.joinedAt) / 1000) });
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
        } else if (d.type === 'shAbility') {
            ability(p, now);
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
            const at = [p.x + Math.cos(p.a) * 30, p.y + Math.sin(p.a) * 30];
            // Ausgeruestetes direkt fallen lassen (5.1b, per Drag & Drop aus dem Fenster)
            // 6.11 (Max): auch Q/G-Verbrauchsgut direkt aus der Hotbar, ganzer Stapel
            if (d.slot === 'util0' || d.slot === 'util1') {
                const k = d.slot === 'util0' ? 0 : 1, u = p.util[k];
                if (!u) return;
                p.util[k] = null;
                dropBag(at[0], at[1], Array.from({ length: u.n }, () => I.plain('util', u.base)));
            } else if (d.slot) {
                const slot = String(d.slot);
                const slots = ['primary', 'secondary', 'helmet', 'vest', 'pants', 'boots', 'backpack'];
                if (!slots.includes(slot) || !p.gear[slot] || p.gear[slot].starter) return;
                // Rucksack nur, wenn der Inhalt in den Grundrucksack passt
                if (slot === 'backpack' && p.pack.length > I.BASE_PACK) return h.send(p.c, { type: 'shLoot', items: [], full: true });
                const it = p.gear[slot];
                p.gear[slot] = slot === 'primary' ? starterPistol() : null;
                if (slot === 'secondary' && p.slot === 'secondary') p.slot = 'primary';
                dropBag(at[0], at[1], [it]);
            } else {
                const i = p.pack.findIndex(x => x.uid === d.uid);
                if (i < 0) return;
                // 6.9 (Max): per Drag & Drop der ganze Stapel (gleiches Verbrauchsgut)
                const it = p.pack[i];
                if (d.all && it.kind === 'util') {
                    const out = p.pack.filter(x => x.kind === 'util' && x.base === it.base);
                    for (const x of out) p.pack.splice(p.pack.indexOf(x), 1);
                    dropBag(at[0], at[1], out);
                } else dropBag(at[0], at[1], p.pack.splice(i, 1));
            }
        } else return;
        gearStats(p);
        sendInv(p);
    }

    // Naechste Kiste oder naechster Beutel in Reichweite
    function interact(p) {
        if (pvp) return;
        if (zb) {
            const s = MAP.stations.find(x => Math.hypot(x.x - p.x, x.y - p.y) < INTERACT_R + 30);
            if (s && !p.dead) zStation(p, s);
            return;
        }
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
        if (best.cr && (best.cr.t === 'bunker' || best.cr.t === 'lab')) {
            // 6.12: Untergrund-Kisten – Keller wie das Militaerlager, Labor besser
            const lab = best.cr.t === 'lab';
            best.cr.readyAt = now + (lab ? UNDER_CRATE_RESPAWN * 1.5 : UNDER_CRATE_RESPAWN);
            const n = 1 + (Math.random() < (lab ? 0.3 : 0.15) + p.b.loot ? 1 : 0);
            got = Array.from({ length: n }, () => I.generate(lab ? 'labcrate' : 'bunkercrate'));
            award(p, L.XP.crate * (lab ? 6 : 4), lab ? 'lab crate' : 'bunker crate');
        } else if (best.cr && best.cr.t === 'mil') {
            best.cr.readyAt = now + MIL_RESPAWN;
            const n = 1 + (Math.random() < 0.25 + p.b.loot ? 1 : 0);
            got = Array.from({ length: n }, () => I.generate('military'));
            award(p, L.XP.crate * 4, 'military crate');
        } else if (best.cr) {
            best.cr.readyAt = now + CRATE_RESPAWN;
            const g = best.cr.g || 0;
            const n = 1 + Math.floor(Math.random() * 2) + (Math.random() < p.b.loot ? 1 : 0) + (g === 2 ? 1 : 0);
            got = Array.from({ length: n }, () => I.generate(['crate', 'crate2', 'crate3'][g]));
            award(p, L.XP.crate * (1 + 2 * g), 'crate');
            best.cr.g = crateGrade();
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
        // 6.12: Treppe/Luke in den Untergrund und zurueck
        if (s.kind === 'portal') {
            if (!s.to) return;
            if (ctf && ctf.carrier === p.id) return h.send(p.c, { type: 'shEvent', text: '🚩 The flag stays on the surface', kind: 'self' });
            if (now < (p.portalAt || 0)) return;
            p.portalAt = now + PORTAL_CD / SPEED;
            // nicht direkt auf die Gegen-Treppe stellen, sonst geht F gleich wieder zurueck
            let spot = null;
            for (const [dx, dy] of [[0, 95], [95, 0], [-95, 0], [0, -95]]) if (!blocked(s.to.x + dx, s.to.y + dy, R + 4)) { spot = { x: s.to.x + dx, y: s.to.y + dy }; break; }
            spot = spot || freeNear(s.to.x, s.to.y + 95, R + 4) || { x: s.to.x, y: s.to.y };
            fxAt(p.x, p.y, { type: 'shFx', kind: 'nova', x: Math.round(p.x), y: Math.round(p.y), r: 90 });
            p.x = spot.x;
            p.y = spot.y;
            p.exAt = 0;
            p.protect = Math.max(p.protect || 0, now + PORTAL_CD / SPEED);
            fxAt(p.x, p.y, { type: 'shFx', kind: 'nova', x: Math.round(p.x), y: Math.round(p.y), r: 90 });
            const g = (MAP.regions || []).find(q => q.id === regionAt(p.x, p.y));
            h.send(p.c, { type: 'shEvent', text: s.dir === 'down' ? `🕳️ You climb down: ${g ? g.name : s.dest}${g && g.level <= -2 ? ' – something moves in the dark…' : ' – watch out, it is dangerous down here'}` : `🪜 You climb up: ${g ? g.name : s.dest}`, kind: 'self' });
            return;
        }
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
            sell: p.pack.map(it => ({ ...brief(it), fav: !!it.fav, price: Math.max(1, Math.round(I.salvageValue(it) * TRADER_SELL)) }))
        });
    }

    // Kaufen (Verbrauchsgut gegen Scrap aus dem Lager) und Verkaufen (Rucksack -> Scrap)
    function trade(p, d) {
        if (!nearStation(p, 'trader')) return h.send(p.c, { type: 'shTrader', close: true });
        const a = st(p.c);
        if (d.op === 'buy') {
            const price = Object.prototype.hasOwnProperty.call(TRADER_BUY, d.base) ? TRADER_BUY[d.base] : 0;
            if (!price) return;
            if (a.scrap < price) return h.send(p.c, { type: 'shEvent', text: `🏪 You need ${price} scrap`, kind: 'self' });
            const it = I.plain('util', d.base);
            const rest = pickUp(p, [it]);
            if (rest.length) return h.send(p.c, { type: 'shEvent', text: '🏪 Your backpack is full', kind: 'self' });
            a.scrap -= price;
        } else if (d.op === 'sell') {
            const i = p.pack.findIndex(x => x.uid === d.uid);
            if (i < 0) return;
            if (p.pack[i].fav) return h.send(p.c, { type: 'shEvent', text: '⭐ Protected item – unprotect it first', kind: 'self' });
            const [it] = p.pack.splice(i, 1);
            a.scrap += Math.max(1, Math.round(I.salvageValue(it) * TRADER_SELL));
        } else return;
        h.accounts.touch();
        gearStats(p);
        sendInv(p);
        sendTrader(p);
    }

    // ---------- Verbrauchsgut ----------

    // Taste R (25.09.2026): Faehigkeit der angelegten Ausruestung
    function ability(p, now) {
        if (p.dead || (pvp && pvp.phase !== 'fight')) return;
        if (p.weights && !p.weightsOff) {
            p.weightsOff = true;
            gearStats(p);
            fxAt(p.x, p.y, { type: 'shFx', kind: 'weights', x: Math.round(p.x), y: Math.round(p.y) });
            h.send(p.c, { type: 'shEvent', text: '🏋️ Weights off – full speed!', kind: 'self' });
        }
        if (zwFrozen(p, now)) return;
        // Titan Shift: einmal je Raid 15 s Titan
        if (p.titanSuit && !p.titanUsed) {
            p.titanUsed = true;
            p.titanUntil = now + 15000 / SPEED;
            p.titanHp = 1500;
            p.maxHp += 1500;
            p.hp += 1500;
            fxAt(p.x, p.y, { type: 'shBoom', x: Math.round(p.x), y: Math.round(p.y), r: 260, nuke: false });
            fxAt(p.x, p.y, { type: 'shFx', kind: 'titan', x: Math.round(p.x), y: Math.round(p.y) });
            for (const q of players.values()) h.send(q.c, { type: 'shEvent', text: `🦖 ${p.name} turned into a Titan!`, kind: q === p ? 'self' : 'boss' });
        }
        // Killer Queen: alle eigenen Bomben hochgehen lassen
        const mine = kqBombs.filter(k => k.owner === p.id);
        if (mine.length) {
            for (const k of mine) {
                kqBombs.splice(kqBombs.indexOf(k), 1);
                const [bx, by] = kqPos(k);
                kqBlast(p, bx, by, now);
            }
        }
        // Flash Step: kurzer Sprung in Laufrichtung, dabei unantastbar
        if (p.flashstep && now >= (p.stepCd || 0) && now >= (p.jailUntil || 0)) {
            let dx = p.mx, dy = p.my;
            if (!dx && !dy) { dx = Math.cos(p.a); dy = Math.sin(p.a); }
            const d = Math.hypot(dx, dy) || 1;
            dx /= d;
            dy /= d;
            let dist = 0;
            while (dist < 260 && !blocked(p.x + dx * (dist + 15), p.y + dy * (dist + 15), R)) dist += 15;
            if (dist >= 30) {
                const from = [Math.round(p.x), Math.round(p.y)];
                p.x += dx * dist;
                p.y += dy * dist;
                p.lastMove = now;
                p.stepCd = now + 3000 / SPEED;
                p.protect = Math.max(p.protect || 0, now + 300 / SPEED);
                fxAt(p.x, p.y, { type: 'shFx', kind: 'blink', x: Math.round(p.x), y: Math.round(p.y), from });
            }
        }
    }

    // Killer Queen: Bombe an Gegner, Spieler oder Wand
    function plantBomb(b, tgt, x, y, now) {
        const own = kqBombs.filter(k => k.owner === b.owner);
        if (own.length >= 8) kqBombs.splice(kqBombs.indexOf(own[0]), 1);
        kqBombs.push({ owner: b.owner, mob: tgt && tgt.def ? tgt.id : null, pid: tgt && !tgt.def ? tgt.id : null, x, y, until: now + 20000 / SPEED });
    }
    function kqPos(k) {
        const m = k.mob && mobs.find(o => o.id === k.mob);
        if (m) return [m.x, m.y];
        const q = k.pid && players.get(k.pid);
        if (q && !q.dead) return [q.x, q.y];
        return [k.x, k.y];
    }
    function kqBlast(p, x, y, now) {
        const r = 110, dmg = 95 * p.dmgMul;
        fxAt(x, y, { type: 'shBoom', x: Math.round(x), y: Math.round(y), r, nuke: false });
        for (const q of near(x, y, r + R)) if (q !== p && !(p.team && p.team === q.team)) damage(q, p, dmg, now, q.x, q.y, { how: 'explosion', noDodge: true });
        for (const m of mobsNear(x, y, r + 60)) if (Math.hypot(m.x - x, m.y - y) < r + m.def.r) hurtMob(m, p, dmg, now, m.x, m.y);
    }

    // Gum-Gum: Spieler wird zum Punkt gezogen (30 px davor)
    function startGrapple(p, tx, ty, now) {
        if (!p || p.dead) return;
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        if (d < 50) return;
        p.grap = { x: tx - dx / d * 30, y: ty - dy / d * 30, until: now + 700 / SPEED };
        fxAt(p.x, p.y, { type: 'shFx', kind: 'gomu', x: Math.round(tx), y: Math.round(ty), from: [Math.round(p.x), Math.round(p.y)] });
    }

    // Tesla (Mod, Innate) und Mjoelnir: Blitz vom getroffenen Gegner auf die zwei
    // naechsten in 260 px, halber Schaden. 25.09.2026 (Max): vorher sprang Tesla
    // nur zwischen Spielern (hitPlayer), gegen Raid-Gegner und Zombies passierte nichts.
    function teslaArc(m, shooter, w, now) {
        const others = mobs.filter(o => o !== m && o.hp > 0 && Math.hypot(o.x - m.x, o.y - m.y) < 260).sort((x, y) => Math.hypot(x.x - m.x, x.y - m.y) - Math.hypot(y.x - m.x, y.y - m.y)).slice(0, 2);
        if (!others.length) return;
        fxAt(m.x, m.y, { type: 'shZap', pts: [[Math.round(m.x), Math.round(m.y)], ...others.map(o => [Math.round(o.x), Math.round(o.y)])] });
        for (const o of others) hurtMob(o, shooter, w.dmg * 0.5, now, o.x, o.y, false, { dot: true });
    }

    // Kugel eines Spielers von beliebiger Stelle (Hoi-Poi-Turm)
    const TURRET_W = { dmg: 30, ms: 330, speed: 1400, life: 0.5, spread: 0.04, pellets: 1, pierce: 0, bounce: 0, crit: 0, burn: 0, frost: 0, vamp: 0, explode: 0, homing: 0, tesla: 0, execute: 0, look: 0, hitR: 0 };
    function turretTick(now) {
        for (let i = turrets.length - 1; i >= 0; i--) {
            const t = turrets[i];
            const o = players.get(t.owner);
            if (o && zwFrozen(o, now)) { t.until += TICK_MS / SPEED; continue; }
            if (!o || o.dead || now >= t.until) {
                turrets.splice(i, 1);
                fxAt(t.x, t.y, { type: 'shFx', kind: 'mobdie', x: Math.round(t.x), y: Math.round(t.y), icon: '💊' });
                continue;
            }
            if (now < t.next) continue;
            let tgt = null, td = 620;
            for (const m of mobs) {
                const d = Math.hypot(m.x - t.x, m.y - t.y) - m.def.r;
                if (m.hp > 0 && !m.charm && d < td && clear(t.x, t.y, m.x, m.y)) { tgt = m; td = d; }
            }
            for (const q of players.values()) {
                if (q === o || q.dead || (o.team && o.team === q.team) || !canSee(o, q, now)) continue;
                const d = Math.hypot(q.x - t.x, q.y - t.y);
                if (d < td && clear(t.x, t.y, q.x, q.y)) { tgt = q; td = d; }
            }
            if (!tgt) continue;
            t.next = now + TURRET_W.ms / SPEED;
            t.a = Math.atan2(tgt.y - t.y, tgt.x - t.x) + (Math.random() - 0.5) * TURRET_W.spread;
            const w = { ...TURRET_W, dmg: TURRET_W.dmg * o.dmgMul };
            bullets.push({
                id: ++seqId, owner: o.id, x: t.x + Math.cos(t.a) * 22, y: t.y + Math.sin(t.a) * 22,
                vx: Math.cos(t.a) * w.speed, vy: Math.sin(t.a) * w.speed, dies: now + w.life * 1000 / SPEED, w, pierce: 0, bounce: 0, hits: new Set(), fx: 0, tier: 5
            });
        }
    }

    // Geass: 1 s auf einen Gegner schauen -> er kaempft 8 s fuer einen
    function geassTick(p, now) {
        if (!p.geass || now < (p.geassCd || 0)) { p.gaze = null; return; }
        let best = null, bd = 650;
        for (const m of mobs) {
            if (m.def.boss || m.charm || !(m.hp > 0)) continue;
            const d = Math.hypot(m.x - p.x, m.y - p.y);
            if (d > bd) continue;
            let da = Math.atan2(m.y - p.y, m.x - p.x) - p.a;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            if (Math.abs(da) < 0.08 + m.def.r / Math.max(d, 1) && clear(p.x, p.y, m.x, m.y)) { best = m; bd = d; }
        }
        if (!best) { p.gaze = null; return; }
        if (!p.gaze || p.gaze.id !== best.id) { p.gaze = { id: best.id, since: now }; return; }
        if (now - p.gaze.since < 1000 / SPEED) return;
        best.charm = { by: p.id, until: now + 8000 / SPEED };
        best.tgt = null;
        p.gaze = null;
        p.geassCd = now + 3000 / SPEED;
        fxAt(best.x, best.y, { type: 'shFx', kind: 'charm', x: Math.round(best.x), y: Math.round(best.y) });
    }

    // Verzauberter Gegner: greift andere Gegner an, sonst folgt er seinem Herrn
    function charmTick(m, now, dt) {
        const def = m.def, lord = players.get(m.charm.by);
        let o = null, od = 700;
        for (const x of mobs) {
            if (x === m || x.charm || !(x.hp > 0)) continue;
            const d = Math.hypot(x.x - m.x, x.y - m.y);
            if (d < od) { o = x; od = d; }
        }
        const speed = def.chase || def.speed || 100;
        if (o) {
            m.a = Math.atan2(o.y - m.y, o.x - m.x);
            if (od > 180) mobMove(m, o.x, o.y, speed, dt);
            if (now >= (m.charmHit || 0) && od < 450 && clear(m.x, m.y, o.x, o.y)) {
                m.charmHit = now + 700 / SPEED;
                const g = def.gun;
                const dmg = g ? g.dmg * (g.burst || 1) * 2.5 : (def.melee || def.contact || 20) * 1.5;
                fxAt(m.x, m.y, { type: 'shZap', pts: [[Math.round(m.x), Math.round(m.y)], [Math.round(o.x), Math.round(o.y)]] });
                hurtMob(o, lord, dmg, now, o.x, o.y);
            }
        } else if (lord && Math.hypot(lord.x - m.x, lord.y - m.y) > 160) mobMove(m, lord.x, lord.y, speed, dt);
    }

    // Gegner, der dem Mauszeiger am naechsten ist (Chain Jail, Death Note):
    // hoechstens 160 px neben dem Zeiger, in Reichweite und mit freier Sicht
    function enemyAtCursor(p, tx, ty, range) {
        let best = null, bd = 160;
        for (const q of players.values()) {
            if (q === p || q.dead || (p.team && p.team === q.team) || !canSee(p, q, Date.now())) continue;
            const d = Math.hypot(q.x - tx, q.y - ty);
            if (d < bd && Math.hypot(q.x - p.x, q.y - p.y) < range && clear(p.x, p.y, q.x, q.y)) { best = { p: q }; bd = d; }
        }
        for (const m of mobs) {
            if (!(m.hp > 0)) continue;
            const d = Math.hypot(m.x - tx, m.y - ty) - m.def.r;
            if (d < bd && Math.hypot(m.x - p.x, m.y - p.y) < range + m.def.r && clear(p.x, p.y, m.x, m.y)) { best = { m }; bd = d; }
        }
        return best;
    }

    // Kaneki's Mask: jeder Kill heilt und gibt Tempo
    function onKill(killer, now) {
        if (!killer || !killer.killHeal || killer.dead) return;
        killer.hp = Math.min(killer.maxHp, killer.hp + killer.maxHp * 0.25);
        killer.stim = Math.max(now < killer.stimUntil ? killer.stim : 0, 0.25);
        killer.stimUntil = now + 3000 / SPEED;
        fxAt(killer.x, killer.y, { type: 'shFx', kind: 'heal', x: Math.round(killer.x), y: Math.round(killer.y) });
    }

    // Nichirin Blade: Treffer innerhalb 1,5 s stapeln
    function comboHit(attacker, w, now) {
        if (!attacker || !w || !w.combo || w.dragon || !players.has(attacker.id)) return;
        attacker.combo = now - (attacker.comboAt || 0) > 1500 / SPEED ? 1 : Math.min(10, (attacker.combo || 0) + 1);
        attacker.comboAt = now;
    }

    // All Might: Schockwelle um den Spieler, schiebt weg
    function plusUltra(v, now) {
        fxAt(v.x, v.y, { type: 'shFx', kind: 'nova', x: Math.round(v.x), y: Math.round(v.y), r: 300 });
        fxAt(v.x, v.y, { type: 'shBoom', x: Math.round(v.x), y: Math.round(v.y), r: 300, nuke: false });
        for (const q of near(v.x, v.y, 300)) {
            if (q === v || (v.team && v.team === q.team)) continue;
            const d = Math.hypot(q.x - v.x, q.y - v.y) || 1;
            [q.x, q.y] = slide(q.x, q.y, (q.x - v.x) / d * 160, (q.y - v.y) / d * 160, R);
            damage(q, v, 150, now, q.x, q.y, { how: 'explosion', noDodge: true });
        }
        for (const m of [...mobs]) {
            const d = Math.hypot(m.x - v.x, m.y - v.y) || 1;
            if (d > 300 + m.def.r) continue;
            if (!m.def.boss) [m.x, m.y] = slide(m.x, m.y, (m.x - v.x) / d * 160, (m.y - v.y) / d * 160, m.def.r, mobBlocked);
            hurtMob(m, v, 150, now, m.x, m.y);
        }
        for (const q of players.values()) h.send(q.c, { type: 'shEvent', text: `💪 ${v.name}: PLUS ULTRA!`, kind: q === v ? 'self' : 'boss' });
    }

    // Za Warudo: steht die Zeit fuer diesen Spieler still?
    function zwFrozen(p, now) {
        return !!(zw && now < zw.until && p.id !== zw.by);
    }

    // Portal Gun: Portal an eine freie Stelle (von der Wand weg zurueckziehen)
    function placePortal(b, x, y, now) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        for (let k = 0; k < 20 && blocked(x, y, R); k++) { x -= b.vx / sp * 4; y -= b.vy / sp * 4; }
        if (blocked(x, y, R)) return;
        const pr = portals.get(b.owner) || { a: null, b: null, next: 'a', until: 0 };
        pr[pr.next] = { x, y };
        pr.next = pr.next === 'a' ? 'b' : 'a';
        pr.until = now + 30000 / SPEED;
        portals.set(b.owner, pr);
        fxAt(x, y, { type: 'shFx', kind: 'portal', x: Math.round(x), y: Math.round(y) });
    }
    function portalTick(now) {
        for (const [owner, pr] of portals) {
            if (now > pr.until || !players.has(owner)) { portals.delete(owner); continue; }
            if (!pr.a || !pr.b) continue;
            const pairs = [[pr.a, pr.b], [pr.b, pr.a]];
            for (const [from, to] of pairs) {
                for (const q of players.values()) {
                    if (q.dead || now < (q.portCd || 0) || Math.hypot(q.x - from.x, q.y - from.y) > 28) continue;
                    q.x = to.x;
                    q.y = to.y;
                    q.portCd = now + 900 / SPEED;
                    q.lastMove = now;
                    fxAt(to.x, to.y, { type: 'shFx', kind: 'portal', x: Math.round(to.x), y: Math.round(to.y) });
                }
                for (const m of mobs) {
                    if (m.def.boss || now < (m.portCd || 0) || Math.hypot(m.x - from.x, m.y - from.y) > 28 + m.def.r * 0.5 || mobBlocked(to.x, to.y, m.def.r)) continue;
                    m.x = to.x;
                    m.y = to.y;
                    m.portCd = now + 900 / SPEED;
                }
                for (const b of bullets) {
                    if (b.w.portal || now < (b.portCd || 0) || Math.hypot(b.x - from.x, b.y - from.y) > 24) continue;
                    const sp = Math.hypot(b.vx, b.vy) || 1;
                    b.x = to.x + b.vx / sp * 30;
                    b.y = to.y + b.vy / sp * 30;
                    b.portCd = now + 250 / SPEED;
                }
            }
        }
    }

    // Senbonzakura: Klingen um den Spieler, solange der Schwarm nicht draussen ist
    function orbitTick(p, now, dt) {
        const cw = p.gear[p.slot];
        const on = !!(cw && I.WEAPONS[cw.base] && I.WEAPONS[cw.base].orbit && !bullets.some(b => b.owner === p.id && b.w.orbit));
        p.orbitOn = on;
        if (!on) return;
        const dps = 130 * p.dmgMul, rr = 110;
        for (const q of near(p.x, p.y, rr + R)) {
            if (q === p || (p.team && p.team === q.team)) continue;
            damage(q, p, dps * dt, now, q.x, q.y, { how: 'shot', dot: true, noDodge: true });
        }
        for (const m of mobsNear(p.x, p.y, rr + 60)) if (Math.hypot(m.x - p.x, m.y - p.y) < rr + m.def.r) hurtMob(m, p, dps * dt, now, m.x, m.y, false, { dot: true });
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (b.owner === p.id || Math.hypot(b.x - p.x, b.y - p.y) > rr - 10) continue;
            const o = players.get(b.owner);
            if (o && p.team && o.team === p.team) continue;
            bullets.splice(i, 1);
        }
    }

    // Titan: Stampfer statt Schuss
    function titanStomp(p, now) {
        if (now - (p.lastStomp || 0) < 700 / SPEED) return;
        p.lastStomp = now;
        p.lastShot = now;
        const x = p.x + Math.cos(p.a) * 70, y = p.y + Math.sin(p.a) * 70, r = 170, dmg = 200 * p.dmgMul;
        fxAt(x, y, { type: 'shBoom', x: Math.round(x), y: Math.round(y), r, nuke: false });
        for (const q of near(x, y, r + R)) if (q !== p && !(p.team && p.team === q.team)) damage(q, p, dmg, now, q.x, q.y, { how: 'explosion', noDodge: true });
        for (const m of mobsNear(x, y, r + 60)) if (Math.hypot(m.x - x, m.y - y) < r + m.def.r) hurtMob(m, p, dmg, now, m.x, m.y);
    }

    // Kage Bunshin: Klone laufen im Dreieck um den Spieler und schiessen mit
    function cloneTick(now, dt) {
        for (let i = clones.length - 1; i >= 0; i--) {
            const k = clones[i];
            const o = players.get(k.owner);
            if (!o || o.dead || now >= k.until) {
                clones.splice(i, 1);
                fxAt(k.x, k.y, { type: 'shFx', kind: 'poof', x: Math.round(k.x), y: Math.round(k.y) });
                continue;
            }
            if (zwFrozen(o, now)) continue;
            const ang = o.a + Math.PI + (k.k - 1) * 0.9;
            const gx = o.x + Math.cos(ang) * 75, gy = o.y + Math.sin(ang) * 75;
            const d = Math.hypot(gx - k.x, gy - k.y);
            if (d > 300) { k.x = o.x; k.y = o.y; }
            else if (d > 6) [k.x, k.y] = slide(k.x, k.y, (gx - k.x) / d * Math.min(d, MOVE * 1.3 * dt), (gy - k.y) / d * Math.min(d, MOVE * 1.3 * dt), R);
            let tgt = null, td = 600;
            for (const m of mobs) {
                const dd = Math.hypot(m.x - k.x, m.y - k.y) - m.def.r;
                if (m.hp > 0 && !(m.charm && m.charm.by === o.id) && dd < td && clear(k.x, k.y, m.x, m.y)) { tgt = m; td = dd; }
            }
            for (const q of players.values()) {
                if (q === o || q.dead || (o.team && o.team === q.team) || !canSee(o, q, now)) continue;
                const dd = Math.hypot(q.x - k.x, q.y - k.y);
                if (dd < td && clear(k.x, k.y, q.x, q.y)) { tgt = q; td = dd; }
            }
            k.a = tgt ? Math.atan2(tgt.y - k.y, tgt.x - k.x) : o.a;
            if (!tgt || now < k.next) continue;
            const item = o.gear[o.slot] || o.gear.primary;
            const ws = I.weaponStats(item);
            const w = { ...TURRET_W, dmg: ws.dmg * o.dmgMul * 0.35, speed: ws.beam ? 1600 : ws.speed, life: ws.beam ? 0.6 : Math.min(ws.life, 1.2), spread: ws.spread, burn: ws.burn, frost: ws.frost, ms: Math.max(150, ws.ms / o.rateMul) };
            k.next = now + w.ms / SPEED;
            const a = k.a + (Math.random() - 0.5) * w.spread;
            bullets.push({ id: ++seqId, owner: o.id, x: k.x + Math.cos(a) * (R + 6), y: k.y + Math.sin(a) * (R + 6), vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, dies: now + w.life * 1000 / SPEED, w, pierce: 0, bounce: 0, hits: new Set(), fx: 0, tier: I.TIER_IDX[item.tier] || 0 });
        }
    }

    function useUtil(p, si, tx, ty, now) {
        const u = p.util[si];
        if (p.dead || (pvp && pvp.phase !== 'fight')) return;
        if (!u || now - p.lastUse < 600 * p.b.utilCd / SPEED) return;
        if (zwFrozen(p, now)) return;
        const def = I.UTILS[u.base];
        if (def.use === 'heal') {
            if (def.full) {
                p.hp = p.maxHp;
                p.protect = now + def.protect / SPEED;
                if (def.speed) {
                    p.stimUntil = now + def.speedMs / SPEED;
                    p.stim = def.speed;
                }
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
        } else if (u.base === 'chidori') {
            // Blitz-Sprint zum Mauszeiger, Schaden an allem auf der Strecke
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
            let dx = tx - p.x, dy = ty - p.y;
            const d = Math.hypot(dx, dy) || 1;
            dx /= d;
            dy /= d;
            let dist = 0;
            while (dist < Math.min(def.range, d) && !blocked(p.x + dx * (dist + 15), p.y + dy * (dist + 15), R)) dist += 15;
            const x0 = p.x, y0 = p.y, x1 = p.x + dx * dist, y1 = p.y + dy * dist;
            const onPath = (x, y, r) => {
                const t = Math.max(0, Math.min(dist, (x - x0) * dx + (y - y0) * dy));
                return Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t)) < r + 40;
            };
            for (const q of [...players.values()]) if (q !== p && !q.dead && !(p.team && p.team === q.team) && onPath(q.x, q.y, R)) damage(q, p, def.dmg, now, q.x, q.y, { how: 'tesla', noDodge: true });
            for (const m of [...mobs]) if (onPath(m.x, m.y, m.def.r)) hurtMob(m, p, def.dmg * (p.b.expl || 1), now, m.x, m.y);
            p.x = x1;
            p.y = y1;
            p.lastMove = now;
            p.protect = Math.max(p.protect || 0, now + 400 / SPEED);
            fxAt(x1, y1, { type: 'shFx', kind: 'chidori', x: Math.round(x1), y: Math.round(y1), from: [Math.round(x0), Math.round(y0)] });
        } else if (u.base === 'infinitevoid') {
            // Domaene: alle Gegner im Umkreis erstarren, nehmen mehr Schaden
            fxAt(p.x, p.y, { type: 'shFx', kind: 'void', x: Math.round(p.x), y: Math.round(p.y), r: def.r });
            for (const m of mobs) if (Math.hypot(m.x - p.x, m.y - p.y) < def.r + m.def.r) m.stunUntil = now + def.stun / SPEED;
            for (const q of near(p.x, p.y, def.r)) {
                if (q === p || (p.team && p.team === q.team)) continue;
                q.slow = 0.95;
                q.slowUntil = now + def.stun / SPEED;
                if (!q.see) h.send(q.c, { type: 'shFlash', ms: 1500 });
            }
        } else if (u.base === 'hiraishin') {
            // Zweiter Einsatz: zum Kunai springen, kostet nichts
            if (p.kunai && now < p.kunai.until) {
                const from = [Math.round(p.x), Math.round(p.y)];
                p.x = p.kunai.x;
                p.y = p.kunai.y;
                p.kunai = null;
                p.lastMove = now;
                p.lastUse = now;
                fxAt(p.x, p.y, { type: 'shFx', kind: 'blink', x: Math.round(p.x), y: Math.round(p.y), from });
                return sendInv(p);
            }
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
            let dx = tx - p.x, dy = ty - p.y;
            const d = Math.hypot(dx, dy) || 1;
            dx /= d;
            dy /= d;
            let dist = 0;
            while (dist < Math.min(def.range, d) && !blocked(p.x + dx * (dist + 15), p.y + dy * (dist + 15), R)) dist += 15;
            if (dist < 30) return;
            p.kunai = { x: p.x + dx * dist, y: p.y + dy * dist, until: now + def.keep / SPEED };
        } else if (u.base === 'chainjail') {
            const t = Number.isFinite(tx) && enemyAtCursor(p, tx, ty, def.range);
            if (!t) return h.send(p.c, { type: 'shEvent', text: '⛓️ No enemy near your cursor', kind: 'self' });
            const o = t.p || t.m;
            fxAt(p.x, p.y, { type: 'shZap', pts: [[Math.round(p.x), Math.round(p.y)], [Math.round(o.x), Math.round(o.y)]], chain: true });
            if (t.p) {
                t.p.jailUntil = now + def.ms / SPEED;
                h.send(t.p.c, { type: 'shEvent', text: `⛓️ ${p.name} chained you!`, kind: 'boss' });
            } else if (t.m.def.boss) t.m.slowUntil = now + def.ms / SPEED;
            else t.m.stunUntil = now + def.ms / SPEED;
        } else if (u.base === 'deathnote') {
            const t = Number.isFinite(tx) && enemyAtCursor(p, tx, ty, def.range);
            if (!t) return h.send(p.c, { type: 'shEvent', text: '📓 No enemy near your cursor', kind: 'self' });
            const o = t.p || t.m;
            o.doom = { at: now + def.ms / SPEED, by: p.id };
            fxAt(o.x, o.y, { type: 'shFx', kind: 'doom', x: Math.round(o.x), y: Math.round(o.y) });
            h.send(p.c, { type: 'shEvent', text: `📓 You wrote ${t.p ? t.p.name : 'the ' + o.def.name}'s name – 40 s`, kind: 'self' });
            if (t.p) h.send(t.p.c, { type: 'shEvent', text: `📓 ${p.name} wrote your name in the Death Note – you die in 40 s unless you kill them or extract!`, kind: 'boss' });
        } else if (u.base === 'doordoor') {
            p.phaseUntil = now + def.ms / SPEED;
            p.phased = true;
            fxAt(p.x, p.y, { type: 'shFx', kind: 'door', x: Math.round(p.x), y: Math.round(p.y) });
        } else if (u.base === 'shinra') {
            fxAt(p.x, p.y, { type: 'shFx', kind: 'nova', x: Math.round(p.x), y: Math.round(p.y), r: def.r });
            fxAt(p.x, p.y, { type: 'shFx', kind: 'shinra', x: Math.round(p.x), y: Math.round(p.y), r: def.r });
            const push = (x, y, r, far, isB) => {
                const d = Math.hypot(x - p.x, y - p.y) || 1;
                const [nx, ny] = slide(x, y, (x - p.x) / d * far, (y - p.y) / d * far, r, isB);
                return [nx, ny, Math.hypot(nx - x, ny - y) < far * 0.75];
            };
            for (const q of near(p.x, p.y, def.r)) {
                if (q === p || (p.team && p.team === q.team)) continue;
                const [nx, ny, wall] = push(q.x, q.y, R, 320, blocked);
                q.x = nx;
                q.y = ny;
                damage(q, p, def.dmg + (wall ? 120 : 0), now, q.x, q.y, { how: 'explosion', noDodge: true });
            }
            for (const m of [...mobs]) {
                if (Math.hypot(m.x - p.x, m.y - p.y) > def.r + m.def.r) continue;
                const [nx, ny, wall] = push(m.x, m.y, m.def.r, m.def.boss ? 80 : 320, mobBlocked);
                m.x = nx;
                m.y = ny;
                hurtMob(m, p, def.dmg + (wall ? 120 : 0), now, m.x, m.y);
            }
            // gegnerische Kugeln im Umkreis loeschen
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                if (b.owner === p.id || Math.hypot(b.x - p.x, b.y - p.y) > def.r) continue;
                const o = players.get(b.owner);
                if (o && p.team && o.team === p.team) continue;
                bullets.splice(i, 1);
            }
        } else if (u.base === 'hoipoi') {
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
            let dx = tx - p.x, dy = ty - p.y;
            const d = Math.hypot(dx, dy) || 1;
            dx /= d;
            dy /= d;
            let dist = Math.min(def.range, d);
            while (dist > 30 && blocked(p.x + dx * dist, p.y + dy * dist, 20)) dist -= 15;
            const x = dist > 30 ? p.x + dx * dist : p.x, y = dist > 30 ? p.y + dy * dist : p.y;
            turrets.push({ id: ++seqId, owner: p.id, x, y, until: now + def.ms / SPEED, next: now + 400 / SPEED, a: p.a });
            fxAt(x, y, { type: 'shBoom', x: Math.round(x), y: Math.round(y), r: 60, nuke: false });
        } else if (u.base === 'zawarudo') {
            if (zw && now < zw.until) return;
            zw = { by: p.id, until: now + def.ms / SPEED };
            for (const q of players.values()) {
                h.send(q.c, { type: 'shEvent', text: `⏱️ ${p.name}: ZA WARUDO! Time has stopped.`, kind: q === p ? 'self' : 'boss' });
                h.send(q.c, { type: 'shFx', kind: 'zawarudo', x: Math.round(p.x), y: Math.round(p.y), ms: def.ms });
            }
        } else if (u.base === 'bunshin') {
            for (const c of clones.filter(c => c.owner === p.id)) clones.splice(clones.indexOf(c), 1);
            for (let k = 0; k < 3; k++) clones.push({ id: 'kb' + p.id + '_' + k + '_' + now, owner: p.id, k, x: p.x, y: p.y, a: p.a, until: now + def.ms / SPEED, next: now + 300 / SPEED });
            fxAt(p.x, p.y, { type: 'shFx', kind: 'poof', x: Math.round(p.x), y: Math.round(p.y) });
        } else if (u.base === 'philosopher') {
            p.stoneUntil = now + def.ms / SPEED;
            fxAt(p.x, p.y, { type: 'shFx', kind: 'phoenix', x: Math.round(p.x), y: Math.round(p.y) });
        } else if (u.base === 'hollowmask') {
            p.hollowUntil = now + def.ms / SPEED;
            fxAt(p.x, p.y, { type: 'shFx', kind: 'enrage', x: Math.round(p.x), y: Math.round(p.y) });
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

    // World Ender (6.6): alles auf der Karte stirbt, ausser dem Werfer und seinem Team
    function worldEnd(g, now) {
        const owner = players.get(g.owner) || null;
        for (const q of players.values()) h.send(q.c, { type: 'shWorldEnd', phase: 'boom', x: Math.round(g.x), y: Math.round(g.y), by: owner ? owner.name : '?' });
        for (const m of [...mobs]) {
            if (!(m.hp > 0)) continue;
            hurtMob(m, owner, m.hp * 10 + 1e6, now, m.x, m.y);
        }
        for (const q of [...players.values()]) {
            if (q === owner || q.dead || (owner && owner.team && owner.team === q.team)) continue;
            q.protect = 0;
            q.lastUsed = q.windUsed = true;
            damage(q, owner, 1e7, now, q.x, q.y, { how: 'nuke', noDodge: true });
        }
    }

    function throwNade(p, base, tx, ty, now) {
        const def = I.UTILS[base];
        let dx = tx - p.x, dy = ty - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const dist = Math.min(I.THROW_RANGE, d);
        dx /= d;
        dy /= d;
        const flight = Math.max(250, dist / 800 * 1000) / SPEED;
        if (def.world) for (const q of players.values()) h.send(q.c, { type: 'shWorldEnd', phase: 'arm', ms: def.fuse, by: p.name });
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
            } else if (g.base === 'sticky') {
                blast(g, g.x, g.y, def.r, def.dmg, now, true, 'grenade');
            } else if (g.base === 'genkidama') {
                fxAt(g.x, g.y, { type: 'shFx', kind: 'genki', x: Math.round(g.x), y: Math.round(g.y), r: def.r });
                blast(g, g.x, g.y, def.r, def.dmg, now, false, 'nuke');
            } else if (g.base === 'worldender') {
                worldEnd(g, now);
            } else if (g.base === 'flash') {
                fxAt(g.x, g.y, { type: 'shFx', kind: 'flash', x: Math.round(g.x), y: Math.round(g.y), r: def.r });
                for (const q of near(g.x, g.y, def.r)) {
                    if (!clear(g.x, g.y, q.x, q.y)) continue;
                    if (!q.see) h.send(q.c, { type: 'shFlash', ms: Math.round(def.blind * (1 - Math.hypot(q.x - g.x, q.y - g.y) / def.r * 0.5)) });
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
        if (v.see) return true;
        if (now < (t.invisUntil || 0)) return false;
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
        w.crit = (w.crit || 0) + p.b.crit + (p.critBonus || 0) + (p.critArmor || 0);
        // Pack-a-Punch (Zombies): je Stufe ×1,6 Schaden, ×1,12 Feuerrate
        if (item && item.pap) {
            w.dmg *= Math.pow(1.6, item.pap);
            w.ms /= Math.pow(1.12, item.pap);
        }
        if (now < p.rampUntil) w.ms /= 1.25;
        // Hollow Mask
        if (now < (p.hollowUntil || 0)) {
            w.dmg *= 1.6;
            w.ms /= 1.3;
            w.vamp = (w.vamp || 0) + 0.15;
        }
        // Kagune: fehlende HP -> Schaden und Lifesteal
        if (w.berserk) {
            const miss = Math.max(0, Math.min(1, (1 - p.hp / p.maxHp) / 0.9));
            w.dmg *= 1 + 1.5 * miss;
            w.vamp = (w.vamp || 0) + 0.08 + 0.2 * miss;
        }
        if (now < (p.jailUntil || 0) || zwFrozen(p, now)) return;
        if (now < (p.titanUntil || 0)) return titanStomp(p, now);
        if (now - p.lastShot < w.ms / SPEED) return;
        // Kettensaege: Dauerfeuer dreht hoch, heilt
        if (w.rev) {
            if (now - (p.revLast || 0) > 400 / SPEED) p.revStart = now;
            p.revLast = now;
            w.dmg *= 1 + 2 * Math.min(1, (now - p.revStart) / (3000 / SPEED));
            w.vamp = (w.vamp || 0) + 0.25;
        }
        p.lastShot = now;
        // Nichirin Blade: Combo, bei 10 Stacks ein Wasserdrache
        if (w.combo) {
            if (now - (p.comboAt || 0) > 1500 / SPEED) p.combo = 0;
            w.dmg *= 1 + 0.1 * (p.combo || 0);
            if ((p.combo || 0) >= 10) {
                p.combo = 0;
                Object.assign(w, { dragon: true, wave: true, hitR: 70, life: w.life * 3, speed: w.speed * 1.2, look: 'getsuga' });
                w.dmg *= 2.5;
                fxAt(p.x, p.y, { type: 'shFx', kind: 'dragon', x: Math.round(p.x), y: Math.round(p.y) });
            }
        }
        if (w.beam) return railBeam(p, w, now);
        for (let k = 0; k < w.pellets; k++) {
            const off = w.pellets > 1 ? (k / (w.pellets - 1) - 0.5) * Math.max(w.spread, 0.08 * w.pellets) : (Math.random() - 0.5) * w.spread;
            let a = p.a + off;
            let ox = p.x + Math.cos(a) * (R + 6), oy = p.y + Math.sin(a) * (R + 6);
            // Gate of Babylon (6.6): Portale hinter dem Spieler, alle zielen auf den Punkt vor ihm
            if (w.portals) {
                const side = (k / Math.max(1, w.pellets - 1) - 0.5) * 220 + (Math.random() - 0.5) * 30;
                ox = p.x - Math.cos(p.a) * (50 + Math.random() * 40) - Math.sin(p.a) * side;
                oy = p.y - Math.sin(p.a) * (50 + Math.random() * 40) + Math.cos(p.a) * side;
                if (blocked(ox, oy, 4)) { ox = p.x; oy = p.y; }
                const tx = p.x + Math.cos(p.a) * 520, ty = p.y + Math.sin(p.a) * 520;
                a = Math.atan2(ty - oy, tx - ox) + (Math.random() - 0.5) * 0.06;
                fxAt(ox, oy, { type: 'shFx', kind: 'portal', x: Math.round(ox), y: Math.round(oy) });
            }
            const b = {
                id: ++seqId, owner: p.id,
                x: ox, y: oy,
                vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
                dies: now + w.life * 1000 / SPEED, w, pierce: w.wave || w.erase ? 999 : w.pierce, bounce: w.bounce, hits: new Set(),
                fx: (w.explode ? 1 : 0) | (w.burn ? 2 : 0) | (w.frost ? 4 : 0) | (w.tesla ? 8 : 0) | (w.homing ? 16 : 0) | (w.flame ? 32 : 0) | (w.nukeShell ? 64 : 0) | (w.hole ? 128 : 0) |
                    (w.rocket ? 256 : 0) | (w.magic ? 512 : 0),
                tier: I.TIER_IDX[item.tier] || 0
            };
            // Mjoelnir: fliegt hin, kehrt um, kommt zurueck
            if (w.boomerang) {
                b.pierce = 999;
                b.turnAt = now + w.life * 1000 / SPEED;
                b.dies = now + w.life * 4000 / SPEED;
            }
            // 6.12.1 (Max: Stalker kann man nicht treffen, wenn er an einem dran ist):
            // Kugeln starten vor dem Lauf – wer schon am Spieler klebt, steht dahinter
            // und wurde nie getroffen. Solche Gegner trifft der Schuss sofort.
            if (!w.portals) {
                const dx = Math.cos(a), dy = Math.sin(a);
                const close = mobs.find(m => m.hp > 0 && Math.hypot(m.x - p.x, m.y - p.y) < R + m.def.r + 8 && (m.x - p.x) * dx + (m.y - p.y) * dy > -m.def.r);
                if (close) {
                    b.hits.add(close.id);
                    const crit = w.crit && Math.random() < w.crit;
                    hurtMob(close, p, w.dmg * (crit ? p.b.critMul : 1), now, close.x, close.y, crit, w);
                    if (w.tesla || w.chain) teslaArc(close, p, w, now);
                    if (w.explode) explode({ ...b, x: close.x, y: close.y }, now, null);
                    if (w.grapple) startGrapple(p, close.x, close.y, now);
                    if (w.stick) plantBomb(b, close, close.x, close.y, now);
                    if (!(w.wave || w.erase || w.boomerang)) {
                        if (b.pierce > 0) b.pierce--;
                        else continue;
                    }
                }
            }
            bullets.push(b);
        }
    }

    // Railgun: sofortiger Strahl durch Waende und alle Gegner auf der Linie
    function railBeam(p, w, now) {
        const len = w.speed * w.life;
        const dx = Math.cos(p.a), dy = Math.sin(p.a);
        const x1 = p.x + dx * (R + 6), y1 = p.y + dy * (R + 6);
        const x2 = p.x + dx * len, y2 = p.y + dy * len;
        fxAt(p.x, p.y, { type: 'shBeam', x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2), owner: p.id, look: w.look || undefined, bw: w.beamW || undefined });
        // Breite (6.6): Kamehameha und Venuzdonoa treffen einen breiten Streifen
        const bw = w.beamW || 10;
        for (const q of [...players.values()]) {
            if (q === p || q.dead || (p.team && p.team === q.team)) continue;
            const t = (q.x - p.x) * dx + (q.y - p.y) * dy;
            if (t < 0 || t > len) continue;
            const perp = Math.abs((q.x - p.x) * dy - (q.y - p.y) * dx);
            if (perp > R + bw) continue;
            hitPlayer({ owner: p.id, w, x: q.x, y: q.y, hits: new Set() }, q, now);
        }
        let rifts = 0;
        for (const m of [...mobs]) {
            const t = (m.x - p.x) * dx + (m.y - p.y) * dy;
            if (t >= 0 && t <= len && Math.abs((m.x - p.x) * dy - (m.y - p.y) * dx) < m.def.r + bw) {
                // Venuzdonoa: Risse ins Nichts an bis zu drei Getroffenen
                if (w.rift && rifts < 3 && m.hp > 0) {
                    rifts++;
                    bulletHole({ x: m.x, y: m.y, owner: p.id, w: { dmg: w.dmg * 0.3 } }, now);
                }
                hurtMob(m, p, w.dmg, now, m.x, m.y);
                if (w.tesla) teslaArc(m, p, w, now);
            }
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
        // Geppo: Feuer und Saeure (beides 'fire') tun nichts
        if (v.geppo && opts.how === 'fire') return false;
        if (!opts.noDodge && !opts.pure && v.dodge && Math.random() < v.dodge) {
            if (attacker) h.send(attacker.c, { type: 'shHit', x: Math.round(x), y: Math.round(y), dmg: 0, dodge: true });
            // Killua: jeder Dodge schlaegt mit einem Blitz zurueck
            if (v.counter && now >= (v.counterCd || 0)) {
                const src = attacker && players.has(attacker.id) ? attacker : opts.src && opts.src.hp > 0 ? opts.src : null;
                if (src) {
                    v.counterCd = now + 300 / SPEED;
                    fxAt(v.x, v.y, { type: 'shZap', pts: [[Math.round(v.x), Math.round(v.y)], [Math.round(src.x), Math.round(src.y)]] });
                    if (src.def) hurtMob(src, v, 120, now, src.x, src.y);
                    else damage(src, v, 120, now, src.x, src.y, { how: 'tesla', noDodge: true });
                }
            }
            return false;
        }
        if (attacker && attacker.b && attacker.b.exec && v.hp < v.maxHp * 0.3) dmg *= 1 + attacker.b.exec;
        // Zombie-Baum (6.5): Treffer von Zombies und Bossen
        if (zb && !attacker) {
            if (opts.melee && v.b.zDodge && !opts.dot && Math.random() < v.b.zDodge) return false;
            if (opts.melee) dmg *= v.b.zTaken;
            if (opts.how === 'boss') dmg *= v.b.zBossTaken;
        }
        if (opts.how === 'fire') dmg *= v.b.fire;
        if (!opts.pure) {
            if (v.b.iron && v.hp < v.maxHp / 2) dmg *= 0.85;
            dmg *= v.taken;
        }
        v.hp -= dmg;
        v.lastHurt = now;
        v.extractAt = null;
        let killed = v.hp <= 0 || (opts.execute && v.hp <= v.maxHp * opts.execute);
        // Stein der Weisen: ein toedlicher Treffer laesst einen mit halben HP stehen
        if (killed && now < (v.stoneUntil || 0)) {
            v.stoneUntil = 0;
            v.hp = v.maxHp * 0.5;
            v.protect = now + 1000 / SPEED;
            killed = false;
            fxAt(v.x, v.y, { type: 'shFx', kind: 'phoenix', x: Math.round(v.x), y: Math.round(v.y) });
            h.send(v.c, { type: 'shEvent', text: "💎 The Philosopher's Stone saved you!", kind: 'self' });
        }
        // All Might: unter 25 % (auch toedlich) Schockwelle und 3 s unverwundbar, einmal je Minute
        if (v.plusUltra && v.hp < v.maxHp * 0.25 && now >= (v.plusUltraCd || 0)) {
            v.plusUltraCd = now + 60000 / SPEED;
            if (killed) v.hp = 1;
            killed = false;
            v.protect = now + 3000 / SPEED;
            plusUltra(v, now);
        }
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
        // Kyoka Suigetsu: Trugbild bleibt stehen, man selbst verschwindet
        if (!killed && v.mirror && !opts.dot && dmg >= 1 && now >= (v.mirrorCd || 0)) {
            v.mirrorCd = now + 12000 / SPEED;
            v.invisUntil = now + 2000 / SPEED;
            decoys.push({ id: 'dc' + v.id + '_' + now, pid: v.id, x: v.x, y: v.y, a: v.a, until: now + 3000 / SPEED });
            for (const m of mobs) if (m.tgt === v.id) { m.tgt = null; m.seen = 0; }
            fxAt(v.x, v.y, { type: 'shFx', kind: 'mirror', x: Math.round(v.x), y: Math.round(v.y) });
        }
        // Schaden ueber Zeit (Brennen, Feuer) meldet sich nur beim Getroffenen als Rand
        if (attacker && (!opts.dot || killed)) h.send(attacker.c, { type: 'shHit', x: Math.round(x), y: Math.round(y), dmg: Math.round(dmg), kill: killed, crit: !!opts.crit });
        if (!opts.dot && (dmg >= 1 || killed)) h.send(v.c, { type: 'shHurt', dmg: Math.round(dmg) });
        // Nahkampf/Beruehrung kommt je Tick: gesammelt alle 350 ms anzeigen (4.6)
        if (opts.melee) {
            v.meleeAcc = (v.meleeAcc || 0) + dmg;
            if (killed || now - (v.meleeSent || 0) > 350) {
                h.send(v.c, { type: 'shHurt', dmg: Math.round(v.meleeAcc), melee: true });
                v.meleeAcc = 0;
                v.meleeSent = now;
            }
        }
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
        const src = !shooter && isMob(b.owner) ? mobs.find(m => m.id === b.owner) : null;
        const killed = damage(v, shooter, dmg, now, b.x, b.y, { crit, execute: w.execute, how: w.how, by: w.by, pure: w.pure, src });
        if (shooter && w.vamp) shooter.hp = Math.min(shooter.maxHp, shooter.hp + dmg * w.vamp);
        comboHit(shooter, w, now);
        if (!killed && w.pin && players.has(v.id)) {
            v.slow = 0.9;
            v.slowUntil = now + 1500 / SPEED;
        }
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
        const lo = loadoutOf(a, mode);
        const gear = { primary: copy(lo.primary) || starterPistol(), secondary: copy(lo.secondary) };
        for (const s of [...I.SLOTS, 'backpack']) gear[s] = copy(lo[s]);
        const util = (lo.util || []).map(u => u && Math.min(u.n, count(a, u.base)) > 0 ? { base: u.base, n: Math.min(u.n, count(a, u.base)) } : null);
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
            weaponXp(killer, 60);
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

    // ---------- Zombies (4.4): Wellen, Punkte, Stationen ----------
    // Bis 4 Spieler in einem Team. Punkte fuer Treffer (10) und Kills (60,
    // Tank 150, Boss 1000). Damit: Wandwaffen, Mystery Box, Pack-a-Punch,
    // Perks. Wer stirbt, ist bis zum Ende der Welle raus; sind alle tot, ist
    // Schluss. Wie im PvP mit Kopien des Loadouts: nichts geht verloren.
    // Coins (5.9): am Ende je Spieler Kill-Coins + Wellenbonus -> zCoins().
    const zd = Z_DIFF[opts.diff] || Z_DIFF.normal;
    const zdId = Z_DIFF[opts.diff] ? opts.diff : 'normal';
    const zb = mode === 'zombies' ? { wave: 0, phase: 'wait', until: 0, toSpawn: 0, spawnAt: 0, over: false, kills: new Map(), kc: new Map(), dt: 0, fx: {}, shrineN: 0 } : null;
    const zfx = (k, now) => zb && now < (zb.fx[k] || 0);

    function joinZombies(c, name) {
        const a = st(c);
        const copy = uid => {
            const it = uid && a.inv.find(x => x.uid === uid);
            return it ? JSON.parse(JSON.stringify(it)) : null;
        };
        const lo = loadoutOf(a, mode);
        const gear = { primary: copy(lo.primary) || starterPistol(), secondary: copy(lo.secondary) };
        for (const s of [...I.SLOTS, 'backpack']) gear[s] = copy(lo[s]);
        const util = (lo.util || []).map(u => u && Math.min(u.n, count(a, u.base)) > 0 ? { base: u.base, n: Math.min(u.n, count(a, u.base)) } : null);
        const spot = MAP.spawns.a[players.size % MAP.spawns.a.length];
        const p = newPlayer(c, name, null, a, gear, util, spot);
        p.team = 'a';
        p.dead = false;
        p.pts = 500 + p.b.zStart;
        p.perks = [];
        p.boxN = 0;
        p.uboxN = 0;
        gearStats(p);
        players.set(c.id, p);
        zb.kills.set(c.id, 0);
        zb.kc.set(c.id, 0);
        sendJoined(c);
        sendInv(p);
        return null;
    }

    function zStart() {
        zb.phase = 'break';
        zb.until = Date.now() + 4000 / SPEED;
        for (const p of players.values()) h.send(p.c, { type: 'shEvent', text: '🧟 The dead are coming – first wave in 4 s', kind: 'boss' });
    }

    function zWave(now) {
        zb.wave++;
        zb.phase = 'wave';
        const bossWave = zb.wave % 5 === 0;
        // Bosswellen: weniger Fussvolk, der Boss ist die Welle
        zb.toSpawn = Math.round((8 + 5 * zb.wave) * (1 + 0.6 * (players.size - 1)) * (bossWave ? 0.5 : 1) * zd.count);
        zb.spawnAt = now + (bossWave ? 3500 / SPEED : 0);
        if (bossWave) {
            // Feste Reihenfolge (Max): 5 Abomination, 10 Necromancer, 15 Brood Mother,
            // 20 Inferno Titan, 25 Storm Wraith, 30 Void Overlord, dann von vorn und staerker
            const idx = zb.wave / 5 - 1;
            const kind = M.ZBOSSES[idx % M.ZBOSSES.length];
            const cycle = Math.floor(idx / M.ZBOSSES.length);
            const alive = [...players.values()].filter(p => !p.dead);
            // Weit weg von den Spielern auftauchen
            const spots = MAP.zspawns.slice().sort((a, b) => Math.min(...alive.map(p => Math.hypot(p.x - b.x, p.y - b.y))) - Math.min(...alive.map(p => Math.hypot(p.x - a.x, p.y - a.y))));
            const s = spots[0] || MAP.zspawns[0];
            const m = spawnMob(kind, s.x, s.y, now);
            // Bullet-Hell-Bosse (6.9, Max): keine kleinen Mobs, nur der Boss
            if (m.def.pattern) zb.toSpawn = 0;
            m.hp = m.maxHp = Math.round(m.maxHp * (1 + 1.2 * cycle) * zd.hp);
            m.dm = zDmg(zb.wave) * zd.dmg;
            m.sp = (1 + 0.1 * cycle) * zd.spd;
            m.bossIdx = idx;
            // Auftritt: erst nach der Vorstellung loslegen
            m.nextThink = m.nextShot = m.nextSlam = m.nextCharge = m.nextStrike = m.nextSummon = m.nextRing = now + 3000 / SPEED;
            m.nextBlink = m.nextSpiral = m.nextVortex = m.nextBeam = now + 6000 / SPEED;
            m.patNext = now + 3600 / SPEED;
            m.introUntil = now + 2800 / SPEED;
            bossId = m.id;
            const d = m.def;
            fxAt(m.x, m.y, { type: 'shFx', kind: 'bossin', x: Math.round(m.x), y: Math.round(m.y), boss: kind });
            for (const p of players.values()) h.send(p.c, { type: 'shBossIntro', kind, icon: d.icon, name: d.name, title: d.title || '', wave: zb.wave, hp: m.maxHp, cycle });
        }
        for (const p of players.values()) h.send(p.c, { type: 'shEvent', text: `🧟 Wave ${zb.wave}${bossWave ? ` – ${M.MOBS[M.ZBOSSES[(zb.wave / 5 - 1) % M.ZBOSSES.length]].icon} ${M.MOBS[M.ZBOSSES[(zb.wave / 5 - 1) % M.ZBOSSES.length]].name} is here!` : ''}`, kind: 'boss' });
    }

    function zSpawn(now) {
        const alive = [...players.values()].filter(p => !p.dead);
        const spots = MAP.zspawns.filter(s => alive.every(p => Math.hypot(p.x - s.x, p.y - s.y) > 350));
        const s = (spots.length ? spots : MAP.zspawns)[Math.floor(Math.random() * (spots.length || MAP.zspawns.length))];
        const w = zb.wave;
        // 6.5: je spaeter, desto mehr Runner, Spitter und Tanks
        const pool = [['zombie', 60], ['runner', w >= 2 ? Math.min(45, 18 + 2 * w) : 0], ['spitter', w >= 3 ? Math.min(25, 8 + w) : 0], ['tank', w >= 4 ? Math.min(30, 3 + 1.3 * w) : 0],
            ['bloater', w >= 5 ? Math.min(14, 6 + 0.5 * w) : 0], ['leaper', w >= 6 ? Math.min(18, 8 + 0.6 * w) : 0], ['shade', w >= 8 ? Math.min(14, 5 + 0.5 * w) : 0],
            ['riot', w >= 9 ? Math.min(12, 4 + 0.5 * w) : 0], ['acid', w >= 10 ? Math.min(10, 4 + 0.4 * w) : 0], ['screamer', w >= 12 ? Math.min(6, 2 + 0.2 * w) : 0]].filter(([, n]) => n > 0);
        let r = Math.random() * pool.reduce((a, [, n]) => a + n, 0), kind = 'zombie';
        for (const [k, n] of pool) if ((r -= n) < 0) { kind = k; break; }
        const m = spawnMob(kind, s.x + (Math.random() - 0.5) * 60, s.y + (Math.random() - 0.5) * 60, now);
        m.hp = m.maxHp = Math.round(m.maxHp * zHp(w) * zd.hp);
        m.dm = zDmg(w) * zd.dmg;
        m.sp = zSpd(w) * zd.spd;
    }

    function zTick(now, dt) {
        if (zb.over || zb.phase === 'wait') return;
        if (players.size && ![...players.values()].some(p => !p.dead || p.reviveAt)) return zFinish();
        for (const p of players.values()) {
            if (p.dead && p.reviveAt && now >= p.reviveAt) {
                p.reviveAt = 0;
                Object.assign(p, { dead: false, hp: p.maxHp / 2, burn: null, protect: now + 2000 / SPEED });
                fxAt(p.x, p.y, { type: 'shFx', kind: 'phoenix', x: Math.round(p.x), y: Math.round(p.y) });
                h.send(p.c, { type: 'shEvent', text: '💖 Back on your feet!', kind: 'drop' });
            }
        }
        if (zb.phase === 'break' && now >= zb.until) zWave(now);
        else if (zb.phase === 'wave') {
            const cap = 24 + 5 * players.size;
            if (zb.toSpawn > 0 && now >= zb.spawnAt && mobs.length < cap) {
                zSpawn(now);
                zb.toSpawn--;
                zb.spawnAt = now + Math.max(160, 750 - 45 * zb.wave) / SPEED;
            }
            if (zb.toSpawn === 0 && !mobs.length) {
                zb.phase = 'break';
                zb.until = now + zBreak(zb.wave) / SPEED;
                bossId = null;
                for (const p of players.values()) {
                    award(p, 20 * zb.wave, `wave ${zb.wave}`);
                    // Welle geschafft: alle wieder voll (4.6); wer gefallen ist, kommt zurueck
                    if (!p.dead) p.hp = p.maxHp;
                    if (p.dead) {
                        const sp = MAP.spawns.a[0];
                        Object.assign(p, { dead: false, x: sp.x, y: sp.y, hp: p.maxHp, burn: null, protect: now + 3000 / SPEED });
                    }
                    h.send(p.c, { type: 'shEvent', text: `✅ Wave ${zb.wave} survived – fully healed, next one in ${Math.round(zBreak(zb.wave) / 1000)} s`, kind: 'drop' });
                }
            }
        }
        gridMobs();
        for (const m of [...mobs]) if (m.hp > 0 && mobs.includes(m)) mobTick(m, now, dt);
        zSeparate();
        gridMobs();
    }

    // 6.5.1 (Max): Zombies haben untereinander Hitboxen. Vorher liefen alle auf
    // einen Punkt und eine Armbrust (Durchschlag) erledigte die ganze Traube.
    // Ueberlappende Paare werden auseinandergeschoben, schwere (grosser Radius,
    // Bosse) bewegen sich dabei weniger. Geister (Shade) zaehlen nicht.
    function zSeparate() {
        const n = mobs.length;
        for (let i = 0; i < n; i++) {
            const a = mobs[i];
            if (!(a.hp > 0) || a.def.ghost) continue;
            for (let j = i + 1; j < n; j++) {
                const b = mobs[j];
                if (!(b.hp > 0) || b.def.ghost) continue;
                const min = (a.def.r + b.def.r) * 0.92;
                const dx = b.x - a.x, dy = b.y - a.y;
                if (dx > min || dx < -min || dy > min || dy < -min) continue;
                const d = Math.hypot(dx, dy);
                if (d >= min) continue;
                const ux = d > 0.01 ? dx / d : Math.cos(i * 2.4 + j), uy = d > 0.01 ? dy / d : Math.sin(i * 2.4 + j);
                const ma = a.def.boss ? 1e4 : a.def.r * a.def.r, mb = b.def.boss ? 1e4 : b.def.r * b.def.r;
                const push = min - d;
                [a.x, a.y] = slide(a.x, a.y, -ux * push * mb / (ma + mb), -uy * push * mb / (ma + mb), a.def.r, mobBlocked);
                [b.x, b.y] = slide(b.x, b.y, ux * push * ma / (ma + mb), uy * push * ma / (ma + mb), b.def.r, mobBlocked);
            }
        }
    }

    function zDown(p) {
        if (p.dead) return;
        p.dead = true;
        p.fire = false;
        p.mx = p.my = 0;
        for (const q of players.values()) h.send(q.c, { type: 'shKill', killer: '🧟', victim: p.name, how: 'npc', loot: 0 });
        // Second chance (Zombie-Baum): einmal je Spiel nach 10 s wieder hoch
        if (p.b.zSecond && !p.secondUsed) {
            p.secondUsed = true;
            p.reviveAt = Date.now() + 10000 / SPEED;
            return h.send(p.c, { type: 'shEvent', text: '💖 Second chance – back up in 10 s!', kind: 'self' });
        }
        h.send(p.c, { type: 'shEvent', text: '💀 You are down – survive, team! You are back after this wave', kind: 'self' });
    }

    function zLeave(p) {
        zResult(p);
        players.delete(p.id);
        if (!players.size) zFinish();
    }

    // Ergebnis fuer einen Spieler: XP nach Welle, Bestwert
    function zResult(p) {
        const a = st(p.c);
        a.zombies = a.zombies || { bestWave: 0, games: 0, kills: 0 };
        const reached = Math.max(0, zb.wave - (zb.phase === 'wave' ? 1 : 0));
        if (zdId !== 'easy') a.zombies.bestWave = Math.max(a.zombies.bestWave, reached);
        a.zombies.bestBy = a.zombies.bestBy || {};
        a.zombies.bestBy[zdId] = Math.max(a.zombies.bestBy[zdId] || 0, reached);
        a.zombies.games++;
        a.zombies.kills += zb.kills.get(p.id) || 0;
        const xp = Math.round(40 * Math.pow(reached, 1.35) * zd.reward);
        award(p, xp, `survived ${reached} wave${reached === 1 ? '' : 's'}`);
        // Coins (5.9): erst jetzt, am Ende des Spiels (alle tot oder verlassen)
        const coins = Math.floor(zCoins(reached, zb.kc.get(p.id) || 0) * (p.b ? p.b.zCoins : 1) * zd.reward);
        if (coins > 0 && p.account) {
            h.accounts.addCoins(p.account, coins);
            h.accounts.earn(p.account, 'shooter', coins);
            a.zombies.coins = (a.zombies.coins || 0) + coins;
            if (coins >= 5000) h.feed(`🧟 ${p.name} survived ${reached} waves${zdId === 'normal' ? '' : ` (${zd.name})`} and earned ${coins.toLocaleString('en-US')} coins`, 'gold');
            h.refresh(p.c);
        }
        h.accounts.touch();
        h.send(p.c, { type: 'shLeft', result: 'zombies', wave: reached, kills: zb.kills.get(p.id) || 0, best: a.zombies.bestWave, xp, coins, diff: zdId });
    }

    function zFinish() {
        if (zb.over) return;
        zb.over = true;
        for (const p of [...players.values()]) zResult(p);
        players.clear();
        mobs.length = 0;
        if (opts.onDone) opts.onDone({ wave: zb.wave });
    }

    // F an einer Station: kaufen mit Punkten
    function zStation(p, s) {
        const say = text => h.send(p.c, { type: 'shEvent', text, kind: 'self' });
        const pay = price => {
            // Bargain (Zombie-Baum): alle Stationen billiger
            price = Math.round(price * p.b.zDisc * (s.kind === 'perk' ? p.b.zPerk : 1) * ((s.kind === 'box' || s.kind === 'wall') && zfx('sale', Date.now()) ? 0.5 : 1));
            if (p.pts < price) {
                say(`💰 You need ${price} points`);
                return false;
            }
            p.pts -= price;
            return true;
        };
        const giveWeapon = it => {
            if (!p.gear.secondary) {
                p.gear.secondary = it;
                p.slot = 'secondary';
            } else p.gear[p.slot] = it;
            gearStats(p);
            sendInv(p);
        };
        if (s.kind === 'wall') {
            if (!pay(s.price)) return;
            giveWeapon(I.plain('weapon', s.base));
            return say(`🔫 ${I.WEAPONS[s.base].name} bought`);
        }
        if (s.kind === 'box') {
            if (!pay(zBoxPrice(p.boxN || 0))) return;
            p.boxN = (p.boxN || 0) + 1;
            let it = null;
            const src = Math.random() < p.b.zBox ? 'zbox_s' : 'zbox';
            for (let k = 0; k < 30 && (!it || it.kind !== 'weapon'); k++) it = I.generate(src);
            if (!it || it.kind !== 'weapon') it = I.plain('weapon', 'rifle');
            giveWeapon(it);
            fxAt(s.x, s.y, { type: 'shFx', kind: 'phoenix', x: s.x, y: s.y });
            return say(`🎁 Mystery box: ${it.name}`);
        }
        if (s.kind === 'ubox') {
            // Erst Platz pruefen, dann zahlen: einen der zwei Verbrauchsgut-Slots
            // braucht es frei (oder denselben Gegenstand mit Luft im Stapel)
            if (!p.util.some(u => !u)) return say('🧪 Free one of your two consumable slots first');
            if (!pay(zUboxPrice(p.uboxN || 0))) return;
            p.uboxN = (p.uboxN || 0) + 1;
            const it = I.generate(Math.random() < p.b.zBox ? 'zubox_s' : 'zubox');
            const d = I.UTILS[it.base];
            const n = Math.max(1, Math.ceil(d.stack / 2));
            const have = p.util.findIndex(u => u && u.base === it.base && u.n < d.stack);
            if (have >= 0) p.util[have].n = Math.min(d.stack, p.util[have].n + n);
            else p.util[p.util.findIndex(u => !u)] = { base: it.base, n };
            sendInv(p);
            fxAt(s.x, s.y, { type: 'shFx', kind: 'phoenix', x: s.x, y: s.y });
            return say(`🧪 Utility box: ${n}× ${d.icon || ''} ${d.name} (${it.tier})`);
        }
        if (s.kind === 'pap') {
            const it = p.gear[p.slot];
            if (!it || it.starter && false) return;
            if ((it.pap || 0) >= ZMB_PAP_MAX) return say('⚡ That weapon is fully upgraded');
            if (!pay(zPapPrice(it.pap || 0))) return;
            it.pap = (it.pap || 0) + 1;
            it.name = it.name.replace(/ ⚡+$/, '') + ' ' + '⚡'.repeat(it.pap);
            sendInv(p);
            fxAt(s.x, s.y, { type: 'shFx', kind: 'nova', x: s.x, y: s.y, r: 160 });
            return say(`⚡ Pack-a-Punch level ${it.pap}: ×${Math.pow(1.6, it.pap).toFixed(1)} damage`);
        }
        if (s.kind === 'heal') {
            const now = Date.now();
            if (now < (p.healAt || 0)) return say(`💉 Again in ${Math.ceil((p.healAt - now) / 1000)} s`);
            if (p.hp >= p.maxHp) return say('💉 You are at full health');
            if (!pay(zHealPrice(zb.wave, p.healN || 0))) return;
            p.healN = (p.healN || 0) + 1;
            p.hp = p.maxHp;
            p.burn = null;
            p.healAt = now + ZMB_HEAL_CD / SPEED;
            fxAt(p.x, p.y, { type: 'shFx', kind: 'phoenix', x: Math.round(p.x), y: Math.round(p.y) });
            return say('💉 Fully healed');
        }
        if (s.kind === 'armor') {
            if ((p.armorN || 0) >= ZMB_ARMOR_MAX) return say('🛡️ You already wear all armor plates');
            if (!pay(Math.round(s.price * (1 + 0.5 * (p.armorN || 0))))) return;
            p.armorN = (p.armorN || 0) + 1;
            gearStats(p);
            p.hp = Math.min(p.maxHp, p.hp + 25);
            return say(`🛡️ Armor plate ${p.armorN}/${ZMB_ARMOR_MAX}: +25 max HP`);
        }
        if (s.kind === 'nades') {
            const have = p.util.findIndex(u => u && u.base === 'frag');
            const slot = have >= 0 ? have : p.util.findIndex(u => !u);
            if (slot < 0) return say('💣 Both consumable slots are full');
            if (have >= 0 && p.util[have].n >= I.UTILS.frag.stack) return say('💣 You carry as many grenades as you can');
            if (!pay(s.price)) return;
            p.util[slot] = { base: 'frag', n: Math.min(I.UTILS.frag.stack, (have >= 0 ? p.util[have].n : 0) + 2) };
            sendInv(p);
            return say('💣 +2 frag grenades');
        }
        if (s.kind === 'shrine') {
            if (!pay(zShrinePrice(zb.shrineN))) return;
            zb.shrineN++;
            const keys = Object.keys(ZMB_POWERUPS);
            const k = keys[Math.floor(Math.random() * keys.length)];
            const d = ZMB_POWERUPS[k];
            const now = Date.now();
            if (k === 'nuke') {
                for (const m of [...mobs]) if (!m.def.boss) {
                    fxAt(m.x, m.y, { type: 'shFx', kind: 'mobdie', x: Math.round(m.x), y: Math.round(m.y), icon: m.def.icon, col: m.def.color });
                    mobs.splice(mobs.indexOf(m), 1);
                }
                p.pts += 400 * Z_PTS_MUL;
                fxAt(p.x, p.y, { type: 'shBoom', x: Math.round(p.x), y: Math.round(p.y), r: 900, nuke: true });
            } else zb.fx[k] = now + d.ms / SPEED;
            fxAt(s.x, s.y, { type: 'shFx', kind: 'nova', x: s.x, y: s.y, r: 220 });
            for (const q of players.values()) h.send(q.c, { type: 'shEvent', text: `${d.icon} ${d.name}! ${d.desc}`, kind: 'drop' });
            return;
        }
        if (s.kind === 'revive') {
            const down = [...players.values()].filter(q => q.dead);
            if (!down.length) return say('💖 Nobody is down');
            if (!pay(s.price)) return;
            const now = Date.now();
            for (const q of down) {
                Object.assign(q, { dead: false, hp: q.maxHp / 2, burn: null, protect: now + 2000 / SPEED, reviveAt: 0 });
                fxAt(q.x, q.y, { type: 'shFx', kind: 'phoenix', x: Math.round(q.x), y: Math.round(q.y) });
                h.send(q.c, { type: 'shEvent', text: `💖 ${p.name} brought you back!`, kind: 'drop' });
            }
            return say(`💖 Revived ${down.length} teammate${down.length > 1 ? 's' : ''}`);
        }
        if (s.kind === 'perk') {
            const d = ZMB_PERKS[s.perk];
            if (p.perks.includes(s.perk)) return say(`${d.icon} You already have ${d.name}`);
            if (!pay(s.price)) return;
            p.perks.push(s.perk);
            gearStats(p);
            return say(`${d.icon} ${d.name}: ${d.desc}`);
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

    // Naechste freie Stelle fuer Radius r, spiralfoermig nach aussen (5.4, Max:
    // Zombies und Boss spawnten teils in der Wand und hingen dort fest)
    function freeNear(x, y, r) {
        if (!mobBlocked(x, y, r)) return { x, y };
        for (let d = 12; d <= 480; d += 12) {
            const n = Math.max(8, Math.round(d / 6));
            const off = Math.random() * Math.PI * 2;
            for (let i = 0; i < n; i++) {
                const a = off + i / n * Math.PI * 2;
                const nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d;
                if (!mobBlocked(nx, ny, r)) return { x: nx, y: ny };
            }
        }
        return null;
    }

    function spawnMob(kind, x, y, now, home) {
        const def = M.MOBS[kind];
        // Nie in eine Wand setzen: Platz nach dem eigenen Radius suchen
        const spot = freeNear(x, y, def.r + 4) || freeSpot(false);
        x = spot.x;
        y = spot.y;
        const hp = def.boss ? def.hpBase + def.hpPer * Math.max(1, players.size) : def.hp;
        const m = {
            id: 'm#' + (++mobSeq), kind, def, x, y, a: Math.random() * 6.28, hp, maxHp: hp,
            home: home || { x, y }, tx: x, ty: y, tgt: null, seen: 0, nextThink: 0, nextShot: now + 800 + Math.random() * 800,
            aimAt: 0, strafe: Math.random() < 0.5 ? 1 : -1, stuck: 0, born: now, burn: null, slowUntil: 0, dmgBy: new Map(),
            nextRing: now + 6000, nextSlam: now + 8000, slamAt: 0, nextSummon: now + 6000,
            nextCharge: now + 4000, chargeAt: 0, charging: false, chargeEnd: 0, cx: 0, cy: 0, nextStrike: now + 5000
        };
        // Level (nur Extraction, keine Bosse): Ebene bestimmt den Bereich
        if (mode === 'extract' && !def.boss && !def.zombie) {
            const [lo, hi] = MOB_LEVELS[regionAt(x, y)] || MOB_LEVELS.surface;
            m.lv = lo + Math.floor(Math.random() * (hi - lo + 1));
            const k = m.lv - lo;
            m.hp = m.maxHp = Math.round(m.maxHp * (1 + MOB_LV_HP * k));
            m.dm = 1 + MOB_LV_DMG * k;
        }
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
        announce(`${m.def.icon} The ${m.def.name} is roaming the map – kill it for big loot!`, 'boss');
    }

    function spawnDrop(now) {
        const s = freeSpot(false);
        drop = { x: s.x, y: s.y, at: now + DROP_WARN / SPEED };
        announce('📦 Supply drop incoming – check the map!', 'drop');
    }

    function bossView(now) {
        const b = boss();
        return b ? [Math.round(b.x), Math.round(b.y), Math.max(0, Math.round(b.hp)), b.maxHp, Math.round(b.a * 100) / 100,
            b.slamAt ? Math.max(0, Math.round(b.slamAt - now)) : 0, b.kind,
            b.chargeAt ? Math.max(0, Math.round(b.chargeAt - now)) : 0, Math.round(b.cx), Math.round(b.cy), b.charging ? 1 : 0,
            // 6.5: Zustand der neuen Faehigkeiten fuer die Optik
            b.enraged ? 1 : 0, now < (b.spiralUntil || 0) ? 1 : 0, now < (b.vortexUntil || 0) ? 1 : 0,
            b.beamAt ? Math.max(0, Math.round(b.beamAt - now)) : 0, b.beamAt || now < (b.beamUntil || 0) ? Math.round(b.beamA * 100) / 100 : null,
            b.introUntil && now < b.introUntil ? Math.round(b.introUntil - now) : 0] : null;
    }

    // Spieler trifft Gegner
    // Punkte-Faktor im Zombie-Modus: Baum, Vulture-Perk, Double Points
    function zPtsMul(p, now) {
        return p.b.zPts * (p.perks && p.perks.includes('vulture') ? 1.25 : 1) * (zfx('double', now) ? 2 : 1);
    }

    function hurtMob(m, attacker, dmg, now, x, y, crit, w) {
        if (!(m.hp > 0) || dmg <= 0) return;
        if (attacker) m.hitAt = now;
        // Insta-Kill (Power-up): normale Zombies fallen mit einem Treffer
        if (zb && attacker && !m.def.boss && zfx('insta', now)) dmg = Math.max(dmg, m.hp / (m.def.taken || 1) + 1);
        if (attacker && attacker.b) {
            dmg *= attacker.b.hunt;
            if (attacker.b.exec && m.hp < m.maxHp * 0.3) dmg *= 1 + attacker.b.exec;
            // Zombie-Baum (6.5)
            if (zb) {
                dmg *= attacker.b.zDmg;
                if (m.def.boss) dmg *= attacker.b.zBoss;
                if (attacker.b.zCull && m.hp < m.maxHp * 0.25) dmg *= 1 + attacker.b.zCull;
            }
        }
        if (!(w && w.pure)) dmg *= m.def.taken || 1;
        comboHit(attacker, w, now);
        // Longinus: festnageln (Bosse nur verlangsamen, sonst waeren sie dauerhaft betaeubt)
        if (w && w.pin && attacker) {
            if (m.def.boss) m.slowUntil = now + 1500 / SPEED;
            else m.stunUntil = Math.max(m.stunUntil || 0, now + 2000 / SPEED);
        }
        // 6.12.3 (Max: Railgun macht Bosse von ultra weit weg platt): im Zombie-Modus
        // weniger Schaden an Bossen, je weiter der Schuetze weg ist – bis 500 px voll,
        // dann linear runter bis 30 % ab 1400 px
        if (zb && m.def.boss && attacker && attacker.x !== undefined && !(w && w.nofall)) {
            const d = Math.hypot(attacker.x - m.x, attacker.y - m.y);
            dmg *= zBossFalloff(d);
        }
        if (now < (m.stunUntil || 0)) dmg *= 1.5;
        const real = Math.min(dmg, m.hp);
        m.hp -= dmg;
        if (attacker && attacker.account) m.dmgBy.set(attacker.id, (m.dmgBy.get(attacker.id) || 0) + real);
        // Wer schiesst, wird zum Ziel (auch von weit weg)
        if (attacker && players.has(attacker.id)) {
            m.tgt = attacker.id;
            m.seen = now;
            if (m.def.boss && !m.def.zombie && Math.hypot(attacker.x - m.x, attacker.y - m.y) > (m.def.range || m.def.aggro)) {
                if (!(now < (m.provoked || 0))) h.send(attacker.c, { type: 'shEvent', text: `${m.def.icon} ${m.def.name} is coming for you!`, kind: 'boss' });
                m.provoked = now + BOSS_PROVOKE / SPEED;
            }
            // 6.10 (Max: Amaterasu-Brand zu laut): Brand-Ticks kamen je Server-Tick
            // als Treffer an und piepten im Dauerfeuer – wie bei Spielern nur noch der Kill
            if (!(w && w.dot) || m.hp <= 0) h.send(attacker.c, { type: 'shHit', x: Math.round(x), y: Math.round(y), dmg: Math.round(dmg), kill: m.hp <= 0, crit: !!crit });
        }
        if (m.hp > 0 && w) {
            if (w.burn) m.burn = { dps: w.burn, until: now + 3000 / SPEED, from: attacker ? attacker.id : null };
            if (w.frost) m.slowUntil = now + 1500 / SPEED;
            if (w.vamp && attacker) attacker.hp = Math.min(attacker.maxHp, attacker.hp + dmg * w.vamp);
        }
        // Punkte nach Schaden statt je Treffer (6.5, Feedback Schmoggi: mit der SMG
        // liess sich Geld farmen, mit allem anderen nicht). Nur echter Schaden zaehlt.
        if (zb && attacker && players.has(attacker.id)) attacker.pts += real / (zHp(zb.wave) * zd.hp) * Z_PTS_PER_DMG * zPtsMul(attacker, now);
        if (m.hp <= 0) mobDies(m, attacker && players.has(attacker.id) ? attacker : null, now);
    }

    function mobDies(m, killer, now) {
        const i = mobs.indexOf(m);
        if (i < 0) return;
        mobs.splice(i, 1);
        onKill(killer, now);
        const def = m.def;
        if (def.pattern) hz.clear();
        if (zb) {
            if (m.id === bossId) bossId = null;
            if (killer) {
                const bi = def.boss ? (m.bossIdx || 0) + 1 : 0;
                killer.pts += (def.boss ? 1000 * bi * Z_PTS_MUL : m.kind === 'tank' ? 150 * Z_PTS_MUL : def.pts ? def.pts * Z_PTS_MUL : Z_PTS_KILL) * zPtsMul(killer, now);
                // Kettenreaktion (Zombie-Baum): der Tote explodiert
                if (killer.b.zChain && !def.boss && Math.random() < killer.b.zChain) {
                    fxAt(m.x, m.y, { type: 'shBoom', x: Math.round(m.x), y: Math.round(m.y), r: 90, nuke: false });
                    for (const o of [...mobs]) if (o !== m && o.hp > 0 && Math.hypot(o.x - m.x, o.y - m.y) < 90 + o.def.r) hurtMob(o, killer, 80 * killer.b.expl, now, o.x, o.y, false, { dot: true });
                }
                zb.kills.set(killer.id, (zb.kills.get(killer.id) || 0) + 1);
                zb.kc.set(killer.id, (zb.kc.get(killer.id) || 0) + (def.boss ? Z_COINS.boss * bi : m.kind === 'tank' ? Z_COINS.tank : def.coins || Z_COINS.kill));
                award(killer, L.XP[def.xp || 'npc'] * (def.boss ? 20 * bi : def.xpMul || 1), def.name.toLowerCase());
                weaponXp(killer, L.XP[def.xp || 'npc'] * (def.boss ? 20 * bi : def.xpMul || 1));
            }
            if (def.boss) {
                // Alle, die mitgeschossen haben: Punkte und XP anteilig (Boss zaehlt fuer das Team)
                const total = [...m.dmgBy.values()].reduce((a, n) => a + n, 0);
                for (const [id, n] of m.dmgBy) {
                    const q = players.get(id);
                    if (q && total > 0) award(q, L.XP.bossHelp * ((m.bossIdx || 0) + 1) * n / total, 'boss damage');
                }
                fxAt(m.x, m.y, { type: 'shFx', kind: 'bossdie', x: Math.round(m.x), y: Math.round(m.y), boss: m.kind });
                for (const q of players.values()) h.send(q.c, { type: 'shEvent', text: `${def.icon} ${killer ? killer.name + ' killed' : 'Down goes'} ${def.name}!`, kind: 'drop' });
            }
            for (const o of [...mobs]) if (o.parent === m.id) mobs.splice(mobs.indexOf(o), 1);
            fxAt(m.x, m.y, { type: 'shFx', kind: 'mobdie', x: Math.round(m.x), y: Math.round(m.y), icon: def.icon, col: def.color });
            // Bloater platzt: Saeure-Explosion, danach eine Pfuetze
            if (def.boom) {
                fxAt(m.x, m.y, { type: 'shFx', kind: 'acidboom', x: Math.round(m.x), y: Math.round(m.y), r: def.boom.r });
                for (const q of near(m.x, m.y, def.boom.r + R)) damage(q, null, def.boom.dmg * (m.dm || 1), now, q.x, q.y, { how: 'npc', by: def.icon + ' ' + def.name, noDodge: true });
                if (def.boom.acid) fires.push({ id: ++seqId, x: m.x, y: m.y, r: def.boom.r * 0.6, until: now + 4000 / SPEED, owner: null, dps: 14 * (m.dm || 1), acid: true });
            }
            return;
        }
        if (m.id === bossId) {
            bossId = null;
            nextBossAt = now + randIn(BOSS_EVERY) / SPEED;
            // je ein Beutel pro Item, jeder darf sie sich schnappen. 6.12.3 (Max): Anzahl
            // nach Schwierigkeit (def.loot), leichte Bosse 1–2, schwere bis 5
            const [lo, hi] = def.loot || [3, 3];
            const nLoot = lo + Math.floor(Math.random() * (hi - lo + 1));
            for (let k = 0; k < nLoot; k++) {
                const a = k / nLoot * Math.PI * 2;
                const x = m.x + Math.cos(a) * 55, y = m.y + Math.sin(a) * 55;
                dropBag(blocked(x, y, 10) ? m.x : x, blocked(x, y, 10) ? m.y : y, [I.generate('boss')], 'boss');
            }
            fxAt(m.x, m.y, { type: 'shBoom', x: Math.round(m.x), y: Math.round(m.y), r: 220, nuke: false });
            const line = { killer: killer ? killer.name : null, victim: def.icon + ' ' + def.name, how: 'shot', loot: nLoot };
            feedLog.push(line);
            if (feedLog.length > 20) feedLog.shift();
            for (const q of players.values()) h.send(q.c, { type: 'shKill', ...line });
            announce(`${def.icon} ${killer ? killer.name + ' killed' : 'Down goes'} the ${def.name}! ${nLoot} item${nLoot > 1 ? 's' : ''} dropped`, 'boss');
            if (killer && killer.account) h.accounts.stat(killer.account, s => { s.bossKills = (s.bossKills || 0) + 1; });
            if (killer) award(killer, L.XP.boss, 'boss');
            if (killer) weaponXp(killer, L.XP.boss);
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
            const mxp = L.XP[def.xp] * (def.xpMul || 1) * (1 + MOB_LV_XP * ((m.lv || 1) - 1));
            award(killer, mxp, m.lv ? `${def.name.toLowerCase()} lv ${m.lv}` : def.name.toLowerCase());
            weaponXp(killer, mxp);
            if (killer.account) h.accounts.stat(killer.account, s => { s.npcKills = (s.npcKills || 0) + 1; });
            if (killer.b.bloodlust) killer.hp = Math.min(killer.maxHp, killer.hp + killer.b.bloodlust / 2);
        }
        if (def.drop && !m.parent && Math.random() < def.drop.chance * (mode === 'extract' ? MOB_DROP_MUL : 1)) {
            const em = mode === 'extract' ? MOB_EPIC_MUL[regionAt(m.x, m.y)] || 1 : 1;
            // 6.6 (Max): drei Stufen, die oberste (1 in 50) aus dem Boss-Pool
            if (def.drop.src === 'npcdrop') {
                const r = Math.random();
                const g = r < 1 / 50 ? 3 : r < 1 / 50 + 1 / 8 ? 2 : 1;
                dropBag(m.x, m.y, Array.from({ length: def.drop.n }, () => I.generate(g === 3 ? 'boss' : g === 2 ? 'npcrare' : 'npcdrop', em)), 'mob' + g);
            } else dropBag(m.x, m.y, Array.from({ length: def.drop.n }, () => I.generate(def.drop.src, em)));
        }
        fxAt(m.x, m.y, { type: 'shFx', kind: 'mobdie', x: Math.round(m.x), y: Math.round(m.y), icon: def.icon });
    }

    // Gegner-Kugel
    function mobShot(m, a, now, speedMul) {
        const g = m.def.gun;
        bullets.push({
            id: ++seqId, owner: m.id,
            x: m.x + Math.cos(a) * (m.def.r + 6), y: m.y + Math.sin(a) * (m.def.r + 6),
            vx: Math.cos(a) * g.speed * (speedMul || 1), vy: Math.sin(a) * g.speed * (speedMul || 1),
            dies: now + g.life * 1000 / SPEED, pierce: 0, bounce: 0, hits: new Set(),
            w: { dmg: g.dmg * (m.dm || 1), how: m.def.boss ? 'boss' : 'npc', by: m.def.icon + ' ' + m.def.name, homing: g.homing || 0, mobBoom: g.explode || 0, big: !!g.big, mob: true, frost: g.slow || 0, burn: g.burn || 0 },
            // 6.5: Zombie-Bosse haben eigene Kugel-Optik (tier = Art, Browser zeichnet danach)
            fx: m.def.boss ? 1024 : 2048, tier: m.def.boss ? (BOSS_LOOK[m.kind] || 5) : 0
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
        if (d > range || now < q.protect || now < (q.invisUntil || 0)) return false;
        const hidden = d > SEE_NEAR && now - q.lastShot >= REVEAL_MS * q.b.reveal && (q.zone || q.smoke !== null || stillHidden(q, now));
        return !hidden && clear(m.x, m.y, q.x, q.y);
    }

    function mobMove(m, gx, gy, speed, dt) {
        const d = Math.hypot(gx - m.x, gy - m.y);
        if (d < 1) return;
        const step = Math.min(d, speed * (m.sp || 1) * (m.enraged ? 1.25 : 1) * dt * (m.slowUntil > Date.now() ? 0.5 : 1));
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

    // ---------- Wegfeld fuer Zombies (6.5.1) ----------
    // Max: Zombies blieben an Ecken haengen, weil sie stur geradeaus liefen.
    // Raster aus NAV_CELL-Feldern, frei = Mittelpunkt mit NAV_R Abstand zu
    // Waenden. Alle NAV_MS eine Breitensuche von allen lebenden Spielern aus
    // (8 Richtungen, keine Diagonale durch Ecken); jeder Zombie geht zum
    // Nachbarfeld mit kleinerem Abstand. Nah und mit freier Bahn: direkt.
    // 6.6: zwei Raster – klein (Zombies, r <= 30) und gross (Bosse im Raid,
    // die sonst an Tueren und Ecken haengen blieben). Frei = mobBlocked, also
    // auch keine Wege durch Stadt und Aussenposten.
    const NAV_CELL = 40, NAV_MS = 250;
    const NAV_W = Math.ceil(W / NAV_CELL), NAV_H = Math.ceil(H / NAV_CELL);
    const NAVS = { small: { r: 20 }, big: { r: 44 } };
    let navFree = null, navDist = null;
    const NAV_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    function navBuild(now, size) {
        const N = NAVS[size || 'small'];
        if (!N.free) {
            N.free = new Uint8Array(NAV_W * NAV_H);
            for (let y = 0; y < NAV_H; y++) for (let x = 0; x < NAV_W; x++) {
                N.free[y * NAV_W + x] = mobBlocked((x + 0.5) * NAV_CELL, (y + 0.5) * NAV_CELL, N.r) ? 0 : 1;
            }
            N.dist = new Float32Array(NAV_W * NAV_H);
            N.at = 0;
        }
        navFree = N.free;
        navDist = N.dist;
        if (now - N.at < NAV_MS) return;
        N.at = now;
        navDist.fill(Infinity);
        // Dijkstra-light: Warteschlange nach Kosten (1 gerade, 1,41 schraeg), klein genug fuer ein Array
        const q = [];
        for (const p of players.values()) {
            if (p.dead) continue;
            const cx = Math.floor(p.x / NAV_CELL), cy = Math.floor(p.y / NAV_CELL);
            if (cx < 0 || cy < 0 || cx >= NAV_W || cy >= NAV_H) continue;
            navDist[cy * NAV_W + cx] = 0;
            q.push(cy * NAV_W + cx);
            // Steht der Spieler nah an einer Wand, ist seine Zelle fuer grosse
            // Koerper gesperrt: freie Zellen im Umkreis mit einsaeen (6.6)
            if (!navFree[cy * NAV_W + cx]) {
                for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
                    const nx = cx + dx, ny = cy + dy;
                    if (nx < 0 || ny < 0 || nx >= NAV_W || ny >= NAV_H || !navFree[ny * NAV_W + nx]) continue;
                    const j = ny * NAV_W + nx, dd = Math.hypot(dx, dy);
                    if (dd < navDist[j]) {
                        navDist[j] = dd;
                        q.push(j);
                    }
                }
            }
        }
        for (let head = 0; head < q.length; head++) {
            const i = q[head], x = i % NAV_W, y = (i - x) / NAV_W, d0 = navDist[i];
            for (const [dx, dy] of NAV_DIRS) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= NAV_W || ny >= NAV_H) continue;
                const j = ny * NAV_W + nx;
                if (!navFree[j]) continue;
                if (dx && dy && (!navFree[y * NAV_W + nx] || !navFree[ny * NAV_W + x])) continue;
                const nd = d0 + (dx && dy ? 1.414 : 1);
                if (nd < navDist[j] - 0.01) {
                    navDist[j] = nd;
                    q.push(j);
                }
            }
        }
    }
    // Wegpunkt fuer einen Zombie: direkt, wenn nah und frei, sonst das beste Nachbarfeld
    function zNav(m, tgt, d) {
        if (d < 160 || (d < 500 && clearFor(m.x, m.y, tgt.x, tgt.y, m.def.r))) return tgt;
        navBuild(Date.now(), m.def.r > 30 ? 'big' : 'small');
        const cx = Math.floor(m.x / NAV_CELL), cy = Math.floor(m.y / NAV_CELL);
        if (cx < 0 || cy < 0 || cx >= NAV_W || cy >= NAV_H) return tgt;
        let best = navDist[cy * NAV_W + cx], bx = -1, by = -1;
        for (const [dx, dy] of NAV_DIRS) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= NAV_W || ny >= NAV_H) continue;
            if (dx && dy && (!navFree[cy * NAV_W + nx] || !navFree[ny * NAV_W + cx])) continue;
            const v = navDist[ny * NAV_W + nx];
            if (v < best) {
                best = v;
                bx = nx;
                by = ny;
            }
        }
        if (bx < 0) return tgt;
        // ein Feld weiter vorausschauen, damit die Bahn weicher wird
        let fx = bx, fy = by;
        for (const [dx, dy] of NAV_DIRS) {
            const nx = bx + dx, ny = by + dy;
            if (nx < 0 || ny < 0 || nx >= NAV_W || ny >= NAV_H) continue;
            if (navDist[ny * NAV_W + nx] < navDist[fy * NAV_W + fx] && clearFor(m.x, m.y, (nx + 0.5) * NAV_CELL, (ny + 0.5) * NAV_CELL, m.def.r)) {
                fx = nx;
                fy = ny;
            }
        }
        return { x: (fx + 0.5) * NAV_CELL, y: (fy + 0.5) * NAV_CELL };
    }
    // Freie Bahn fuer einen Koerper mit Radius r (nicht nur fuer einen Strahl)
    function clearFor(x1, y1, x2, y2, r) {
        const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 16);
        const rr = Math.max(4, r - 4);
        for (let i = 1; i <= n; i++) if (blocked(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, rr)) return false;
        return true;
    }

    // Faehigkeiten der Zombie-Bosse (6.5). true = Boss ist beschaeftigt (steht,
    // feuert Spirale oder Strahl), der Rest von mobTick entfaellt dann.
    // Bullet-Hell (6.9): naechster Angriff aus dem Skript, nie zweimal derselbe
    function patternTick(m, now) {
        const def = m.def, P = HZ.PATTERNS[def.pattern];
        if (!P || now < (m.patNext || 0)) return;
        // Raid (6.9): Kampf-Box um den Boss, nur wenn jemand in der Naehe ist
        let box = null;
        if (!def.zombie) {
            const half = RAID_HZ_BOX / 2;
            box = { x0: Math.max(0, m.x - half), y0: Math.max(0, m.y - half), x1: Math.min(W, m.x + half), y1: Math.min(H, m.y + half) };
            if (![...players.values()].some(p => !p.dead && Math.hypot(p.x - m.x, p.y - m.y) < half * 0.75)) return;
        }
        const names = Object.keys(P).filter(k => k !== m.patLast && (k !== 'supernova' || m.enraged));
        const name = names[Math.floor(Math.random() * names.length)];
        m.patLast = name;
        const by = def.icon + ' ' + def.name;
        const api = {
            hz: { add: z => hz.add({ ...z, by }, now) }, W, H, m, now, enraged: !!m.enraged, box,
            players: () => [...players.values()].filter(p => !box || (p.x > box.x0 && p.x < box.x1 && p.y > box.y0 && p.y < box.y1)),
            dmg: base => Math.round(base * (1 + ((m.dm || 1) - 1) * 0.5)),
            say: text => { for (const q of players.values()) h.send(q.c, { type: 'shEvent', text, kind: 'boss' }); }
        };
        const dur = P[name](api);
        m.patNext = now + (dur + (def.gap || 700) * (m.enraged ? 0.6 : 1)) / SPEED;
    }

    function bossSkills(m, now, dt, cd) {
        const def = m.def;
        if (def.pattern) patternTick(m, now);
        if (!def.zombie) return false;
        const by = def.icon + ' ' + def.name;
        const dm = m.dm || 1;
        // Feuerspur hinter sich her
        if (def.trail && now >= (m.nextTrail || 0) && Math.hypot(m.x - (m.trailX || 0), m.y - (m.trailY || 0)) > 30) {
            m.nextTrail = now + def.trail.every / SPEED;
            m.trailX = m.x;
            m.trailY = m.y;
            fires.push({ id: ++seqId, x: m.x, y: m.y, r: def.trail.r, until: now + def.trail.dur / SPEED, owner: null, dps: def.trail.dps * dm });
        }
        // Spirale: steht und dreht einen Kugelkranz
        if (now < (m.spiralUntil || 0)) {
            if (now >= m.spiralShot) {
                m.spiralShot = now + def.spiral.every / SPEED;
                const arms = def.spiral.arms + (m.enraged ? 1 : 0);
                for (let k = 0; k < arms; k++) mobShot(m, m.spA + k / arms * Math.PI * 2, now, 0.7);
                m.spA += def.spiral.turn;
            }
            return true;
        }
        // Strahl: erst Vorwarnung (Linie), dann dreht er sich; Wände halten ihn nicht auf
        if (m.beamAt) {
            if (now >= m.beamAt) {
                m.beamAt = 0;
                m.beamUntil = now + def.beam.dur / SPEED;
            }
            return true;
        }
        if (now < (m.beamUntil || 0)) {
            const B = def.beam;
            m.beamA += B.turn * m.beamDir * (m.enraged ? 1.3 : 1) * dt;
            const angles = B.twin ? [m.beamA, m.beamA + Math.PI] : [m.beamA];
            for (const q of players.values()) {
                if (q.dead) continue;
                for (const a of angles) {
                    const dx = q.x - m.x, dy = q.y - m.y, ca = Math.cos(a), sa = Math.sin(a);
                    const along = dx * ca + dy * sa, side = Math.abs(-dx * sa + dy * ca);
                    if (along > 0 && along < B.len && side < B.width + R) {
                        damage(q, null, B.dps * dm * dt, now, q.x, q.y, { how: 'boss', by, noDodge: true, dot: true, melee: true });
                        break;
                    }
                }
            }
            return true;
        }
        // Wirbel: zieht alle Spieler zu sich und brennt leicht
        if (now < (m.vortexUntil || 0)) {
            const V = def.vortex;
            for (const q of players.values()) {
                if (q.dead) continue;
                const dx = m.x - q.x, dy = m.y - q.y, d = Math.hypot(dx, dy);
                if (d > V.r || d < def.r + R + 20) continue;
                const pull = V.pull * (1 - d / V.r * 0.5) * dt;
                [q.x, q.y] = slide(q.x, q.y, dx / d * pull, dy / d * pull, R);
                damage(q, null, V.dps * dm * dt, now, q.x, q.y, { how: 'boss', by, noDodge: true, dot: true });
            }
        }
        const tgt = m.tgt ? players.get(m.tgt) : null;
        if (!tgt || tgt.dead) return false;
        if (def.beam && now >= (m.nextBeam || 0)) {
            m.nextBeam = now + cd(def.beam.ms);
            m.beamAt = now + def.beam.warn / SPEED;
            m.beamA = Math.atan2(tgt.y - m.y, tgt.x - m.x);
            m.beamDir = Math.random() < 0.5 ? 1 : -1;
            return true;
        }
        if (def.spiral && now >= (m.nextSpiral || 0)) {
            m.nextSpiral = now + cd(def.spiral.ms);
            m.spiralUntil = now + def.spiral.dur / SPEED;
            m.spiralShot = now;
            m.spA = Math.random() * 6.28;
            return true;
        }
        if (def.vortex && now >= (m.nextVortex || 0)) {
            m.nextVortex = now + cd(def.vortex.ms);
            m.vortexUntil = now + def.vortex.dur / SPEED;
            fxAt(m.x, m.y, { type: 'shFx', kind: 'vortex', x: Math.round(m.x), y: Math.round(m.y), boss: m.kind });
        }
        // Teleport: taucht neben dem Ziel wieder auf
        if (def.blink && now >= (m.nextBlink || 0)) {
            m.nextBlink = now + cd(def.blink.ms);
            for (let k = 0; k < 12; k++) {
                const [dmin, dmax] = def.blink.dist || [220, 360];
                const a = Math.random() * 6.28, r = dmin + Math.random() * (dmax - dmin);
                const x = tgt.x + Math.cos(a) * r, y = tgt.y + Math.sin(a) * r;
                if (mobBlocked(x, y, def.r)) continue;
                fxAt(m.x, m.y, { type: 'shFx', kind: 'zblink', x: Math.round(m.x), y: Math.round(m.y), boss: m.kind });
                m.x = x;
                m.y = y;
                fxAt(x, y, { type: 'shFx', kind: 'zblink', x: Math.round(x), y: Math.round(y), boss: m.kind });
                m.nextShot = now + 400 / SPEED;
                break;
            }
        }
        return false;
    }

    function mobTick(m, now, dt) {
        const def = m.def;
        // Steckt trotzdem einer fest (alte Spawns, Rueckstoss): rausschieben, hoechstens alle 0,5 s pruefen
        if (!m.wallCheck || now >= m.wallCheck) {
            m.wallCheck = now + 500;
            if (mobBlocked(m.x, m.y, def.r)) {
                const s = freeNear(m.x, m.y, def.r + 2);
                if (s) { m.x = s.x; m.y = s.y; }
            }
        }
        // Brennen
        if (m.burn) {
            if (now > m.burn.until) m.burn = null;
            else {
                hurtMob(m, players.get(m.burn.from) || null, m.burn.dps * dt, now, m.x, m.y, false, { dot: true });
                if (!(m.hp > 0)) return;
            }
        }
        // Infinite Void (6.6): wer drin ist, steht still
        if (now < (m.stunUntil || 0)) return;
        // Za Warudo: alles steht
        if (zw && now < zw.until) return;
        // Geass: verzauberte Gegner kaempfen fuer den Spieler
        if (m.charm) {
            if (now >= m.charm.until || !players.has(m.charm.by)) { m.charm = null; m.tgt = null; }
            else { charmTick(m, now, dt); return; }
        }
        // Zombie-Boss (6.5): Auftritt abwarten, ab halber HP Wut
        if (m.introUntil && now < m.introUntil) return;
        if (def.enrage && !m.enraged && m.hp < m.maxHp * def.enrage) {
            m.enraged = true;
            fxAt(m.x, m.y, { type: 'shFx', kind: 'enrage', x: Math.round(m.x), y: Math.round(m.y), boss: m.kind });
            for (const q of players.values()) h.send(q.c, { type: 'shEvent', text: `${def.icon} ${def.name} is ENRAGED!`, kind: 'boss' });
        }
        const cd = ms => ms / SPEED * (m.enraged ? 0.65 : 1);
        if (bossSkills(m, now, dt, cd)) return;
        if (def.boss && !def.zombie && now - m.born > BOSS_LIFE / SPEED && now - (m.hitAt || 0) > BOSS_CALM / SPEED
            && ![...players.values()].some(p => !p.dead && Math.hypot(p.x - m.x, p.y - m.y) < BOSS_NEAR)) {
            mobs.splice(mobs.indexOf(m), 1);
            bossId = null;
            if (def.pattern) hz.clear();
            nextBossAt = now + randIn(BOSS_EVERY) / SPEED;
            announce(`${def.icon} The ${def.name} got bored and left.`, 'boss');
            return;
        }
        // Ziel pruefen/suchen, nicht jeden Tick
        let tgt = m.tgt ? players.get(m.tgt) : null;
        if (def.zombie) {
            if (now >= m.nextThink || !tgt || tgt.dead) {
                m.nextThink = now + 300 + Math.random() * 200;
                let best = null, bd = Infinity;
                for (const q of players.values()) {
                    if (q.dead || now < (q.invisUntil || 0)) continue;
                    const d = Math.hypot(q.x - m.x, q.y - m.y);
                    if (d < bd) { best = q; bd = d; }
                }
                tgt = best;
                m.tgt = best ? best.id : null;
                if (best && clear(m.x, m.y, best.x, best.y)) m.seen = now;
            }
        } else if (now >= m.nextThink) {
            m.nextThink = now + 250 + Math.random() * 150;
            if (tgt && mobSees(m, tgt, now, def.aggro * 1.5)) m.seen = now;
            // Bosse (6.6) verfolgen laenger und laufen per Wegfeld um Ecken statt aufzugeben
            else if (tgt && now - m.seen > (def.boss ? 9000 : 3500)) tgt = m.tgt = null;
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
        // Provozierter Raid-Boss: Einschlaege auf Fernschuetzen ausserhalb der Reichweite
        const provoked = def.boss && !def.zombie && now < (m.provoked || 0);
        if (provoked && tgt && !tgt.dead && now >= (m.nextRetal || 0)
            && Math.hypot(tgt.x - m.x, tgt.y - m.y) > (def.range || def.aggro)) {
            m.nextRetal = now + cd(BOSS_RETAL);
            // Vorhalten: der erste Einschlag dahin, wo der Schuetze gleich ist
            const lead = 0.6 * 280;
            for (let k = 0; k < 3; k++) {
                const a = Math.random() * 6.28, rr = k ? 60 + Math.random() * 120 : 0;
                const bx = tgt.x + (k ? 0 : tgt.mx * lead), by = tgt.y + (k ? 0 : tgt.my * lead);
                strikes.push({ id: ++seqId, x: bx + Math.cos(a) * rr, y: by + Math.sin(a) * rr, r: 110, dmg: 55 * (m.dm || 1), at: now + (1100 + k * 150) / SPEED, total: 1100 + k * 150, by: def.icon + ' ' + def.name, how: 'boss', look: 1, fire: false, acid: false });
            }
        }
        // Beruehrung: Nahkaempfer und Bosse
        if (def.boom && players.size && near(m.x, m.y, def.r + R + 12).length) {
            m.hp = 0;
            mobDies(m, null, now);
            return;
        }
        const touch = def.melee || def.contact;
        if (touch) {
            for (const q of near(m.x, m.y, def.r + R + 4)) {
                if (Math.hypot(q.x - m.x, q.y - m.y) < def.r + R) damage(q, null, touch * (m.dm || 1) * (m.charging ? 2.5 : 1) * dt, now, q.x, q.y, { how: def.boss ? 'boss' : 'npc', by: def.icon + ' ' + def.name, noDodge: true, dot: true, melee: true });
            }
        }
        // Stampfer (Bosse): kuendigt sich an, steht dabei still
        if (def.slam) {
            if (m.slamAt) {
                if (now >= m.slamAt) {
                    m.slamAt = 0;
                    m.nextSlam = now + cd(def.slam.ms);
                    fxAt(m.x, m.y, { type: 'shBoom', x: Math.round(m.x), y: Math.round(m.y), r: def.slam.r, nuke: false });
                    if (def.slam.fire) fires.push({ id: ++seqId, x: m.x, y: m.y, r: def.slam.r * 0.6, until: now + 4000 / SPEED, owner: null, dps: 25 * (m.dm || 1) });
                    for (const q of near(m.x, m.y, def.slam.r + R)) damage(q, null, def.slam.dmg * (m.dm || 1), now, q.x, q.y, { how: 'boss', by: def.icon + ' ' + def.name, noDodge: true });
                }
                return;
            }
            if (now >= m.nextSlam && near(m.x, m.y, def.slam.r).length) {
                m.slamAt = now + 900 / SPEED;
                return;
            }
        }
        // Ansturm (4.6): kurz anzeigen (Linie), dann schnell auf die Stelle zu
        if (m.charging) {
            mobMove(m, m.cx, m.cy, def.charge.speed, dt);
            if (now >= m.chargeEnd || Math.hypot(m.cx - m.x, m.cy - m.y) < 20) m.charging = false;
            return;
        }
        if (m.chargeAt) {
            if (now >= m.chargeAt) {
                m.chargeAt = 0;
                m.charging = true;
                m.chargeEnd = now + def.charge.dur / SPEED;
            }
            return;
        }
        if (def.charge && tgt && now >= m.nextCharge) {
            const d = Math.hypot(tgt.x - m.x, tgt.y - m.y);
            if (d > 160 && d < 750) {
                m.nextCharge = now + cd(def.charge.ms);
                m.chargeAt = now + def.charge.warn / SPEED;
                m.cx = tgt.x + (tgt.x - m.x) / d * 160;
                m.cy = tgt.y + (tgt.y - m.y) / d * 160;
                m.a = Math.atan2(tgt.y - m.y, tgt.x - m.x);
                return;
            }
        }
        // Einschlaege (4.6): Warnkreise, dann Schaden – der erste genau aufs Ziel
        if (def.strikes && tgt && now >= m.nextStrike) {
            m.nextStrike = now + cd(def.strikes.ms);
            const s = def.strikes;
            for (let k = 0; k < s.n + (m.enraged ? 3 : 0); k++) {
                const a = Math.random() * 6.28, rr = k ? Math.random() * s.spread : 0;
                strikes.push({ id: ++seqId, x: tgt.x + Math.cos(a) * rr, y: tgt.y + Math.sin(a) * rr, r: s.r, dmg: s.dmg * (m.dm || 1), at: now + (s.warn + k * 120) / SPEED, total: s.warn + k * 120, by: def.icon + ' ' + def.name, how: def.boss ? 'boss' : 'npc', look: s.fire ? 1 : s.zap ? 2 : s.acid ? 3 : 0, fire: !!s.fire, acid: !!s.acid });
            }
        }
        // Brut rufen (Hive Queen)
        if (def.summon && tgt && now >= m.nextSummon) {
            m.nextSummon = now + cd(def.summon.ms);
            const brood = mobs.filter(o => o.parent === m.id).length;
            if (def.summon.ring) fxAt(m.x, m.y, { type: 'shFx', kind: 'raise', x: Math.round(m.x), y: Math.round(m.y), boss: m.kind });
            for (let k = 0; k < def.summon.n && brood + k < def.summon.max; k++) {
                const a = def.summon.ring ? k / def.summon.n * Math.PI * 2 : Math.random() * 6.28;
                const x = m.x + Math.cos(a) * (def.r + 40), y = m.y + Math.sin(a) * (def.r + 40);
                if (blocked(x, y, 16)) continue;
                const d = spawnMob(def.summon.kind, x, y, now);
                // Im Zombie-Modus waechst die Brut mit der Welle (etwas schwaecher als normal)
                if (zb) {
                    d.hp = d.maxHp = Math.round(d.maxHp * (1 + (zHp(zb.wave) - 1) * 0.6) * zd.hp);
                    d.dm = zDmg(zb.wave) * zd.dmg;
                    d.sp = zSpd(zb.wave) * zd.spd;
                }
                d.parent = m.id;
                d.tgt = tgt.id;
                d.seen = now;
            }
        }
        if (tgt) {
            const d = Math.hypot(tgt.x - m.x, tgt.y - m.y);
            m.a = Math.atan2(tgt.y - m.y, tgt.x - m.x);
            // Zombies (6.5.1): um Ecken herum ueber das Wegfeld statt geradeaus
            const goal = (zb && def.zombie) || def.boss ? zNav(m, tgt, d) : tgt;
            if (def.melee) {
                mobMove(m, goal.x, goal.y, def.chase, dt);
            } else {
                const keep = def.keep || 200, range = def.range || def.aggro;
                if (d > range * 0.9 || goal !== tgt) mobMove(m, goal.x, goal.y, def.speed * 1.1 * (provoked ? BOSS_SPRINT : 1), dt);
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
                m.nextRing = now + cd(def.ring.ms);
                for (let k = 0; k < def.ring.n; k++) mobShot(m, k / def.ring.n * Math.PI * 2, now);
            }
        } else {
            m.aimAt = 0;
            // 6.12.3: Patrouille im Keller laeuft ihre Route
            if (m.patrol && patrolStep(m, def, now, dt)) return;
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
        let roam = mobs.filter(m => !m.def.boss && m.kind !== 'enforcer' && !m.parent && !m.under).length;
        populateUnder(now);
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

    // 6.12: Untergrund-Bestand. Keller: bekannte Gegner, deutlich staerker;
    // Labor: Monster aus den Tanks. Nachschub nie in Sichtweite von Spielern.
    function populateUnder(now) {
        for (const g of MAP.regions || []) {
            const U = UNDER_MOBS[g.id];
            if (!U) continue;
            const have = mobs.filter(m => m.under === g.id);
            if (have.length >= U.n) continue;
            const total = U.kinds.reduce((a, [, w]) => a + w, 0);
            let r = Math.random() * total, kind = U.kinds[0][0];
            for (const [kk, w] of U.kinds) if ((r -= w) < 0) { kind = kk; break; }
            if (U.max && U.max[kind] && have.filter(m => m.kind === kind).length >= U.max[kind]) continue;
            for (let t = 0; t < 20; t++) {
                const x = g.x + 120 + Math.random() * (g.w - 240), y = g.y + 120 + Math.random() * (g.h - 240);
                const def = M.MOBS[kind];
                if (blocked(x, y, def.r + 6)) continue;
                if ([...players.values()].some(p => Math.hypot(p.x - x, p.y - y) < 900)) continue;
                if ((MAP.stations || []).some(s => s.kind === 'portal' && Math.hypot(s.x - x, s.y - y) < 400)) continue;
                const m = spawnMob(kind, x, y, now);
                m.under = g.id;
                m.hp = m.maxHp = Math.round(m.maxHp * U.hp);
                m.dm = (m.dm || 1) * U.dmg;
                m.sp = U.spd;
                break;
            }
        }
    }

    // ---------- Untergrund-Events (6.12.3) ----------
    const labTanks = (MAP.deco || []).map((d, i) => d[2] === 'tank' ? i : -1).filter(i => i >= 0);
    const tankState = new Map();     // deco-Index -> { warnUntil, brokenUntil }
    let nextBreachAt = 0, nextPatrolAt = 0, patrolSeq = 0;
    const inRegion = id => [...players.values()].filter(p => !p.dead && regionAt(p.x, p.y) === id);
    const tellRegion = (id, text, kind) => { for (const p of inRegion(id)) h.send(p.c, { type: 'shEvent', text, kind }); };
    function underEvents(now) {
        if (!MAP.regions) return;
        // Labor: Tank reisst auf
        const lab = inRegion('lab');
        for (const [i, t] of tankState) {
            if (t.warnUntil && now >= t.warnUntil) {
                t.warnUntil = 0;
                t.brokenUntil = now + BREACH_REFILL / SPEED;
                const [x, y] = MAP.deco[i];
                fxAt(x, y, { type: 'shBoom', x, y, r: 110, nuke: false });
                const n = 2 + (Math.random() < 0.45 ? 1 : 0);
                for (let k = 0; k < n; k++) {
                    const r = Math.random();
                    const kind = r < 0.1 ? 'hulk' : r < 0.45 ? 'mutant' : r < 0.75 ? 'stalker' : 'horror';
                    const a = k / n * Math.PI * 2 + Math.random();
                    const m = spawnMob(kind, x + Math.cos(a) * 85, y + Math.sin(a) * 85, now);
                    m.under = 'lab';
                    m.breach = true;
                }
                tellRegion('lab', '🧬 The tank burst open!', 'boss');
            } else if (t.brokenUntil && now >= t.brokenUntil) tankState.delete(i);
        }
        if (lab.length) {
            if (!nextBreachAt) nextBreachAt = now + randIn(BREACH_EVERY) / SPEED;
            if (now >= nextBreachAt) {
                const cand = labTanks.filter(i => !tankState.has(i) && lab.some(p => { const d = Math.hypot(p.x - MAP.deco[i][0], p.y - MAP.deco[i][1]); return d > 250 && d < 900; }));
                if (cand.length) {
                    const i = cand[Math.floor(Math.random() * cand.length)];
                    tankState.set(i, { warnUntil: now + BREACH_WARN / SPEED, brokenUntil: 0 });
                    tellRegion('lab', '⚠️ CONTAINMENT BREACH – a tank is cracking!', 'boss');
                    nextBreachAt = now + randIn(BREACH_EVERY) / SPEED;
                } else nextBreachAt = now + 20e3 / SPEED;
            }
        }
        // Keller: Patrouille
        const bunker = inRegion('bunker');
        const B = MAP.regions.find(g => g.id === 'bunker');
        const active = mobs.some(m => m.patrol && m.hp > 0);
        if (bunker.length && B && B.route && !active) {
            if (!nextPatrolAt) nextPatrolAt = now + randIn(PATROL_EVERY) / SPEED;
            if (now >= nextPatrolAt) {
                const starts = B.route.map((pt, i) => i).filter(i => bunker.every(p => Math.hypot(p.x - B.route[i].x, p.y - B.route[i].y) > 1000));
                if (starts.length) {
                    const i0 = starts[Math.floor(Math.random() * starts.length)];
                    const U = UNDER_MOBS.bunker, id = ++patrolSeq, dir = Math.random() < 0.5 ? 1 : -1;
                    ['enforcer', 'scav', 'scav', Math.random() < 0.5 ? 'sniper' : 'scav'].forEach((kind, k) => {
                        const pt = B.route[i0];
                        const m = spawnMob(kind, pt.x + (k % 2 ? 28 : -28), pt.y + Math.floor(k / 2) * 30, now);
                        m.under = 'bunker';
                        m.hp = m.maxHp = Math.round(m.maxHp * U.hp);
                        m.dm = (m.dm || 1) * U.dmg;
                        m.sp = U.spd;
                        m.patrol = { id, i: i0, dir, off: (k - 1.5) * 26, t: now, until: now + PATROL_LIFE / SPEED };
                    });
                    tellRegion('bunker', '🎖️ A patrol is sweeping the base – stay out of sight!', 'boss');
                    nextPatrolAt = now + randIn(PATROL_EVERY) / SPEED;
                } else nextPatrolAt = now + 20e3 / SPEED;
            }
        }
    }
    // Patrouille laufen lassen (aus mobTick, wenn der Gegner niemanden jagt)
    function patrolStep(m, def, now, dt) {
        const B = MAP.regions.find(g => g.id === 'bunker');
        const P = m.patrol;
        if (now > P.until) { m.patrol = null; m.home = { x: m.x, y: m.y }; return false; }
        const pt = B.route[P.i];
        const tx = pt.x + P.off * 0.6, ty = pt.y + P.off * 0.3;
        if (Math.hypot(tx - m.x, ty - m.y) < 45 || now - P.t > 12000 / SPEED) {
            if (P.i + P.dir < 0 || P.i + P.dir >= B.route.length) P.dir = -P.dir;
            P.i += P.dir;
            P.t = now;
        }
        mobMove(m, tx, ty, def.speed * 0.7, dt);
        m.a = Math.atan2(ty - m.y, tx - m.x);
        return true;
    }

    // Capture the Flag (6.9)
    function ctfTick(now) {
        if (!nextCtfAt) nextCtfAt = now + randIn(CTF_EVERY) / SPEED;
        if (!ctf) {
            if (now < nextCtfAt) return;
            const f = freeSpot(true);
            let g = null;
            for (let k = 0; k < 40 && !g; k++) {
                const s = freeSpot(false);
                if (Math.hypot(s.x - f.x, s.y - f.y) >= CTF_MIN_DIST) g = s;
            }
            if (!g) { nextCtfAt = now + 60e3 / SPEED; return; }
            ctf = { x: f.x, y: f.y, carrier: null, bx: g.x, by: g.y, until: now + CTF_LIFE / SPEED };
            announce('🚩 Capture the Flag! Grab the flag and carry it to the 🏁 goal for top loot', 'drop');
            return;
        }
        if (now > ctf.until) {
            announce('🚩 Nobody captured the flag – it vanished.', 'drop');
            ctf = null;
            nextCtfAt = now + randIn(CTF_EVERY) / SPEED;
            return;
        }
        const c = ctf.carrier ? players.get(ctf.carrier) : null;
        if (ctf.carrier && (!c || c.dead)) {
            // Traeger tot oder weg: Flagge faellt, wo er zuletzt war
            ctf.carrier = null;
            announce('🚩 The flag was dropped!', 'drop');
        }
        if (c && !c.dead) {
            ctf.x = c.x;
            ctf.y = c.y;
            if (Math.hypot(c.x - ctf.bx, c.y - ctf.by) < CTF_GOAL) {
                const n = 2 + (Math.random() < 0.35 ? 1 : 0);
                dropBag(ctf.bx, ctf.by, Array.from({ length: n }, () => I.generate('ctf')), 'ctf');
                fxAt(ctf.bx, ctf.by, { type: 'shBoom', x: Math.round(ctf.bx), y: Math.round(ctf.by), r: 160, nuke: false });
                announce(`🏁 ${c.name} captured the flag – top loot at the goal!`, 'boss');
                h.feed(`🏁 ${c.name} captured the flag in the raid`, 'good');
                ctf = null;
                nextCtfAt = now + randIn(CTF_EVERY) / SPEED;
            }
            return;
        }
        for (const p of players.values()) {
            if (p.dead || Math.hypot(p.x - ctf.x, p.y - ctf.y) > CTF_PICK) continue;
            ctf.carrier = p.id;
            announce(`🚩 ${p.name} has the flag!`, 'drop');
            break;
        }
    }

    function eventTick(now, dt) {
        ctfTick(now);
        if (!nextBossAt) nextBossAt = now + randIn(BOSS_EVERY) / SPEED;
        if (!nextDropAt) nextDropAt = now + randIn(DROP_EVERY) / SPEED;
        // Boss weg, ohne abgemeldet zu sein (z. B. Test-Hook): Uhr neu starten
        if (bossId !== null && !boss()) {
            bossId = null;
            nextBossAt = now + randIn(BOSS_EVERY) / SPEED;
        }
        if (bossId === null && now >= nextBossAt) spawnBoss(now);
        populate(now);
        underEvents(now);
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
        // 6.9 (Max: gelandet war er von der Karte weg): Markierung bleibt als
        // "gelandet", bis der Beutel leer geraeumt oder abgelaufen ist
        if (drop && drop.landed && !bags.some(b => b.id === drop.bag)) drop = null;
        if (drop && !drop.landed && now >= drop.at) {
            const n = 2 + (Math.random() < 0.4 ? 1 : 0);
            dropBag(drop.x, drop.y, Array.from({ length: n }, () => I.generate('airdrop')), 'drop');
            fxAt(drop.x, drop.y, { type: 'shBoom', x: Math.round(drop.x), y: Math.round(drop.y), r: 90, nuke: false });
            announce('📦 The supply drop has landed!', 'drop');
            drop = { x: drop.x, y: drop.y, at: drop.at, landed: true, bag: bags[bags.length - 1].id };
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
        // 6.10 (Max): wer allein spielt und stirbt, findet den Boss noch vor,
        // wenn er binnen 30 s wieder reingeht. Solange steht die Welt still
        // (keine Gegner-KI, keine Timer), erst danach wird geraeumt.
        if (!players.size && !zb && !pvp && bossId && mobs.some(m => m.id === bossId)) {
            if (!emptySince) emptySince = now;
            if (now - emptySince < EMPTY_KEEP / SPEED) {
                bullets.length = 0;
                nades.length = 0;
                hz.clear();
                return;
            }
        }
        if (players.size && emptySince) {
            // Pause nicht als "lange kein Treffer" zaehlen, sonst geht der Boss sofort
            const pause = now - emptySince;
            for (const m of mobs) if (m.hitAt) m.hitAt += pause;
            if (nextBossAt) nextBossAt += pause;
            if (nextDropAt) nextDropAt += pause;
            if (nextCtfAt) nextCtfAt += pause;
            if (ctf) ctf.until += pause;
            emptySince = 0;
        }
        if (!players.size) {
            emptySince = 0;
            bullets.length = 0;
            nades.length = 0;
            smokes.length = 0;
            fires.length = 0;
            holes.length = 0;
            kqBombs.length = 0;
            turrets.length = 0;
            decoys.length = 0;
            portals.clear();
            clones.length = 0;
            zw = null;
            // leerer Raid: Events und Gegner weg, Uhr startet mit dem naechsten Spieler neu
            mobs.length = 0;
            strikes.length = 0;
            hz.clear();
            bossId = null;
            enforcerAt = [];
            drop = null;
            nextBossAt = 0;
            nextDropAt = 0;
            ctf = null;
            nextCtfAt = 0;
            return;
        }
        // Za Warudo: Uhren anhalten (Einschlaege, Granaten, Gefahrenzonen)
        const frozen = zw && now < zw.until;
        if (zw && (!frozen || !players.has(zw.by))) zw = null;
        if (frozen) {
            for (const s2 of strikes) s2.at += dt * 1000 / SPEED;
            for (const g of nades) { g.landAt += dt * 1000 / SPEED; if (g.fuseAt) g.fuseAt += dt * 1000 / SPEED; }
        } else if (hz.list.length) hz.tick(now, dt);
        portalTick(now);
        cloneTick(now, dt);
        turretTick(now);
        for (let i = kqBombs.length - 1; i >= 0; i--) if (now > kqBombs[i].until || !players.has(kqBombs[i].owner)) kqBombs.splice(i, 1);
        for (let i = decoys.length - 1; i >= 0; i--) if (now > decoys[i].until) decoys.splice(i, 1);
        // Death Note an Gegnern: normale sterben, Bosse verlieren 30 %
        for (const m of [...mobs]) {
            if (!m.doom || now < m.doom.at) continue;
            const wr = players.get(m.doom.by) || null;
            m.doom = null;
            fxAt(m.x, m.y, { type: 'shFx', kind: 'doom', x: Math.round(m.x), y: Math.round(m.y) });
            hurtMob(m, wr, m.def.boss ? m.maxHp * 0.3 : m.hp + 99999, now, m.x, m.y, false, { pure: true, nofall: true });
        }
        for (let i = strikes.length - 1; i >= 0; i--) {
            const s = strikes[i];
            if (now < s.at) continue;
            strikes.splice(i, 1);
            fxAt(s.x, s.y, { type: 'shBoom', x: Math.round(s.x), y: Math.round(s.y), r: s.r, nuke: false });
            for (const q of near(s.x, s.y, s.r + R)) damage(q, null, s.dmg, now, q.x, q.y, { how: s.how, by: s.by, noDodge: true });
            if (s.fire || s.acid) fires.push({ id: ++seqId, x: s.x, y: s.y, r: s.r * 0.8, until: now + 3500 / SPEED, owner: null, dps: s.acid ? 12 : 18, acid: !!s.acid });
        }
        if (mode === 'extract') eventTick(now, dt);
        if (pvp) pvpTick(now);
        if (zb) zTick(now, dt);
        if (!(zw && now < zw.until)) nadeTick(now, dt);

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
            // Hollow Mask zehrt (toetet aber nicht)
            if (now < (p.hollowUntil || 0)) p.hp = Math.max(1, p.hp - 5 * dt);
            // Death Note: faellig, solange der Schreiber noch lebt
            // (Schutzzeit schiebt auf; rettet einen etwas anderes – Stein, All Might –, ist der Name verbraucht)
            if (p.doom && now >= p.doom.at && now >= p.protect) {
                const wr = players.get(p.doom.by);
                p.doom = null;
                if (wr && !wr.dead && damage(p, wr, p.hp + 99999, now, p.x, p.y, { how: 'deathnote', by: '📓 Death Note', noDodge: true, pure: true })) continue;
                if (!players.has(p.id)) continue;
                if (!wr || wr.dead) h.send(p.c, { type: 'shEvent', text: '📓 The writer is gone – your name fades from the Death Note', kind: 'self' });
            }
            // Titan vorbei: Extra-HP wieder weg
            if (p.titanHp && now >= p.titanUntil) {
                p.maxHp -= p.titanHp;
                p.titanHp = 0;
                p.hp = Math.min(p.hp, p.maxHp);
            }
            const sp = now < (p.jailUntil || 0) || zwFrozen(p, now) ? 0 : MOVE * p.speedMul * (now < p.slowUntil && !p.geppo ? 1 - p.slow : 1) * (now < p.stimUntil ? 1 + p.stim : 1);
            const ox = p.x, oy = p.y;
            const phase = now < (p.phaseUntil || 0);
            if (p.grap) {
                // Gum-Gum: schnell zum Punkt, bricht an Hindernissen ab
                const gx = p.grap.x - p.x, gy = p.grap.y - p.y, gd = Math.hypot(gx, gy), st = Math.min(gd, 1700 * dt);
                if (gd < 20 || now > p.grap.until) p.grap = null;
                else {
                    const [nx, ny] = slide(p.x, p.y, gx / gd * st, gy / gd * st, R);
                    if (Math.hypot(nx - p.x, ny - p.y) < st * 0.3) p.grap = null;
                    p.x = nx;
                    p.y = ny;
                }
            } else if (phase) {
                // Door-Door: Waende zaehlen nicht, nur der Kartenrand
                if (p.mx || p.my) [p.x, p.y] = slide(p.x, p.y, p.mx * sp * dt, p.my * sp * dt, R, (x, y, r) => world.outside(x, y, r));
            } else if (p.mx || p.my) [p.x, p.y] = slide(p.x, p.y, p.mx * sp * dt, p.my * sp * dt, R);
            // Door-Door vorbei, aber in einer Wand: zur naechsten freien Stelle
            if (!phase && p.phased) {
                p.phased = false;
                if (blocked(p.x, p.y, R)) {
                    search: for (let d = 10; d <= 600; d += 10) for (let k = 0; k < 16; k++) {
                        const a = k / 16 * Math.PI * 2, nx = p.x + Math.cos(a) * d, ny = p.y + Math.sin(a) * d;
                        if (!blocked(nx, ny, R)) { p.x = nx; p.y = ny; break search; }
                    }
                }
            }
            geassTick(p, now);
            if (!zwFrozen(p, now)) orbitTick(p, now, dt);
            if (p.x !== ox || p.y !== oy) p.lastMove = now;
            p.zone = zoneOf(p.x, p.y);
            const sm = smokes.find(s => Math.hypot(s.x - p.x, s.y - p.y) < s.r);
            p.smoke = sm ? sm.id : null;
            if (p.fire) shoot(p, now);
            if (!pvp && !zb && p.c.lastMsg && now - p.c.lastMsg > SILENT_MS) {
                die(p, null, 'left', 'lost connection');
                continue;
            }
            // Extraction: lange genug in einer Zone stehen
            const zone = MAP.extracts.find(e => Math.hypot(e.x - p.x, e.y - p.y) < EXTRACT_R);
            if (!zone) p.extractAt = null;
            else if (!p.extractAt) p.extractAt = now + p.b.extractMs / SPEED;
            else if (now >= p.extractAt) extract(p);
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            // Za Warudo: fremde Kugeln haengen in der Luft
            if (zw && now < zw.until && b.owner !== zw.by) { b.dies += dt * 1000 / SPEED; continue; }
            let gone = now >= b.dies;
            // Portal Gun: Schuss ohne Treffer -> Portal am Ende der Reichweite
            if (gone && b.w.portal && !b.hitAny && !blocked(b.x, b.y, 3)) placePortal(b, b.x, b.y, now);
            const steps = Math.max(2, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 12));
            // Mjoelnir: nach der halben Zeit (oder an der Wand) zurueck zur Hand, dann durch Waende
            if (b.w.boomerang && !gone) {
                const bo = players.get(b.owner);
                if (!bo || bo.dead) gone = true;
                else {
                    if (!b.back && now >= b.turnAt) { b.back = true; b.hits.clear(); }
                    if (b.back) {
                        const dx = bo.x - b.x, dy = bo.y - b.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(b.vx, b.vy);
                        b.vx = dx / d * sp;
                        b.vy = dy / d * sp;
                        if (d < R + 24) gone = true;
                    }
                }
            }
            // Zielsuchend: Richtung langsam zum naechsten Gegner drehen
            if (b.w.homing && !gone) {
                let tgt = null, td = 380;
                const howner = players.get(b.owner);
                for (const q of players.values()) {
                    if (q.id === b.owner || b.hits.has(q.id) || q.dead || (howner && howner.team && howner.team === q.team)) continue;
                    const d = Math.hypot(q.x - b.x, q.y - b.y);
                    if (d < td) { tgt = q; td = d; }
                }
                // 6.12 (Max: Homing geht nicht): Spieler-Kugeln suchen auch Gegner
                // (Raid-Gegner, Zombies, Bosse) – vorher nur Spieler, im PvE also nie
                if (!b.w.mob) for (const m of mobs) {
                    if (!(m.hp > 0) || b.hits.has(m.id)) continue;
                    const d = Math.hypot(m.x - b.x, m.y - b.y) - m.def.r;
                    if (d < td) { tgt = m; td = d; }
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
                if (b.w.erase && world.outside(b.x, b.y)) { gone = true; break; }
                if (!b.w.erase && !b.back && blocked(b.x, b.y, 3)) {
                    if (b.w.boomerang) {
                        b.back = true;
                        b.hits.clear();
                        b.x = px;
                        b.y = py;
                        continue;
                    }
                    if (b.bounce > 0) {
                        b.bounce--;
                        const hx = blocked(b.x, py, 3), hy = blocked(px, b.y, 3);
                        if (hx || !hy) b.vx = -b.vx;
                        if (hy || !hx) b.vy = -b.vy;
                        b.x = px;
                        b.y = py;
                        // Revy's Cutlasses: +50 % je Abpraller, springt zum naechsten Gegner
                        if (b.w.smart) {
                            b.w = { ...b.w, dmg: b.w.dmg * 1.5 };
                            b.hits.clear();
                            b.dies = Math.max(b.dies, now + 500 / SPEED);
                            const bo = players.get(b.owner);
                            let tgt = null, td = 650;
                            for (const q of players.values()) {
                                if (q.id === b.owner || q.dead || (bo && bo.team && bo.team === q.team) || (bo && !canSee(bo, q, now))) continue;
                                const dd = Math.hypot(q.x - b.x, q.y - b.y);
                                if (dd < td && clear(b.x, b.y, q.x, q.y)) { tgt = q; td = dd; }
                            }
                            for (const m of mobs) {
                                const dd = Math.hypot(m.x - b.x, m.y - b.y);
                                if (m.hp > 0 && dd < td && clear(b.x, b.y, m.x, m.y)) { tgt = m; td = dd; }
                            }
                            if (tgt) {
                                const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(tgt.y - b.y, tgt.x - b.x);
                                b.vx = Math.cos(a) * sp;
                                b.vy = Math.sin(a) * sp;
                            }
                        }
                        continue;
                    }
                    if (b.w.grapple) startGrapple(players.get(b.owner), px, py, now);
                    if (b.w.stick) plantBomb(b, null, px, py, now);
                    if (b.w.portal) placePortal(b, px, py, now);
                    if (b.w.explode) explode(b, now, null);
                    if (b.w.hole) bulletHole(b, now);
                    if (b.w.mobBoom) mobBoom(b, now);
                    gone = true;
                    break;
                }
                const bowner = players.get(b.owner);
                // Kage Bunshin: ein Klon faengt eine fremde Kugel ab und verpufft
                if (clones.length) {
                    const ci = clones.findIndex(k => k.owner !== b.owner && !(bowner && players.get(k.owner) && bowner.team && bowner.team === players.get(k.owner).team) && Math.hypot(k.x - b.x, k.y - b.y) < R);
                    if (ci >= 0) {
                        const k = clones.splice(ci, 1)[0];
                        fxAt(k.x, k.y, { type: 'shFx', kind: 'poof', x: Math.round(k.x), y: Math.round(k.y) });
                        gone = true;
                        break;
                    }
                }
                for (const q of players.values()) {
                    if (q.id === b.owner || b.hits.has(q.id) || q.dead || (bowner && bowner.team && bowner.team === q.team)) continue;
                    if (Math.hypot(q.x - b.x, q.y - b.y) < R + Math.max(b.w.big ? 14 : 4, b.w.hitR || 0)) {
                        b.hits.add(q.id);
                        b.hitAny = true;
                        if (b.w.mobBoom) mobBoom(b, now);
                        else hitPlayer(b, q, now);
                        if (b.w.grapple) startGrapple(bowner, q.x, q.y, now);
                        if (b.w.stick) plantBomb(b, q, q.x, q.y, now);
                        if (b.w.wave || b.w.erase || b.w.boomerang) continue;
                        if (b.pierce > 0) b.pierce--;
                        else gone = true;
                        break;
                    }
                }
                if (!gone && !isMob(b.owner)) {
                    const hitR = b.w.hitR || 4;
                    for (const m of mobsNear(b.x, b.y, 60 + hitR)) {
                        if (b.hits.has(m.id) || Math.hypot(m.x - b.x, m.y - b.y) >= m.def.r + hitR) continue;
                        b.hits.add(m.id);
                        b.hitAny = true;
                        const shooter = players.get(b.owner) || null;
                        const crit = b.w.crit && Math.random() < b.w.crit;
                        // jeder durchschlagene Gegner vorher kostet 20 % Schaden (6.5.1)
                        const sweep = b.w.wave || b.w.erase || b.w.boomerang;
                        const fall = sweep ? 1 : Math.pow(0.8, b.hits.size - 1);
                        hurtMob(m, shooter, b.w.dmg * fall * (crit ? (shooter ? shooter.b.critMul : 2) : 1), now, b.x, b.y, crit, b.w);
                        if (b.w.hole) bulletHole(b, now);
                        if (b.w.explode) explode(b, now, null);
                        if (b.w.grapple) startGrapple(shooter, m.x, m.y, now);
                        if (b.w.stick) plantBomb(b, m, m.x, m.y, now);
                        if (b.w.tesla || b.w.chain) teslaArc(m, shooter, b.w, now);
                        // Getsuga / Hollow Purple: schneiden durch alles, ohne Grenze
                        if (sweep) continue;
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
                    spd: now < (p.jailUntil || 0) ? 0 : Math.round(p.speedMul * (now < p.slowUntil && !p.geppo ? 1 - p.slow : 1) * (now < p.stimUntil ? 1 + p.stim : 1) * 100) / 100,
                    // 25.09.2026 Uniques: Kunai-Marke, Combo, Death-Note-Uhr, Faehigkeit bereit
                    kunai: p.kunai && now < p.kunai.until ? [Math.round(p.kunai.x), Math.round(p.kunai.y)] : undefined,
                    combo: p.combo && now - (p.comboAt || 0) < 1500 / SPEED ? p.combo : undefined,
                    doom: p.doom ? Math.max(0, Math.round(p.doom.at - now)) : undefined,
                    abil: [p.titanSuit && !p.titanUsed ? 'titan' : '', p.weights && !p.weightsOff ? 'weights' : '', p.flashstep ? (now >= (p.stepCd || 0) ? 'step' : 'step-cd') : '', kqBombs.some(k => k.owner === p.id) ? 'kq' : ''].filter(Boolean).join(',') || undefined,
                    kq: kqBombs.some(k => k.owner === p.id) ? kqBombs.filter(k => k.owner === p.id).map(k => kqPos(k).map(Math.round)) : undefined,
                    phase: now < (p.phaseUntil || 0) ? 1 : undefined,
                    gaze: p.gaze ? Math.min(1, Math.round((now - p.gaze.since) / (1000 / SPEED) * 100) / 100) : undefined,
                    inv: now < (p.invisUntil || 0) ? 1 : undefined,
                    zw: zw && now < zw.until ? Math.round(zw.until - now) : undefined,
                    zwMe: zw && zw.by === p.id ? 1 : undefined,
                    titan: now < (p.titanUntil || 0) ? Math.round(p.titanUntil - now) : undefined,
                    buff: [now < (p.hollowUntil || 0) ? 'hollow' : '', now < (p.stoneUntil || 0) ? 'stone' : '', now < (p.jailUntil || 0) ? 'jail' : ''].filter(Boolean).join(',') || undefined,
                    ex: p.extractAt ? Math.max(0, p.extractAt - now) : null,
                    burn: !!p.burn || !!p.inFire, heal: now < p.healUntil, pr: now < p.protect, dead: !!p.dead, fz: !!(pvp && pvp.phase !== 'fight'),
                    hid: (!!(p.zone || p.smoke !== null) && now - p.lastShot >= REVEAL_MS * p.b.reveal) || stillHidden(p, now)
                },
                pvp: pvp ? { round: pvp.round, score: pvp.score, phase: pvp.phase, left: Math.max(0, Math.round(pvp.until - now)), last: pvp.last, team: p.team } : undefined,
                zmb: zb ? { diff: zdId, wave: zb.wave, phase: zb.phase, left: Math.max(0, Math.round(zb.until - now)), zombies: mobs.length + zb.toSpawn, pts: Math.floor(p.pts), perks: p.perks,
                    disc: p.b.zDisc, perkDisc: p.b.zDisc * p.b.zPerk,
                    fx: Object.fromEntries(Object.entries(zb.fx).filter(([, t]) => t > now).map(([k, t]) => [k, Math.round(t - now)])),
                    pap: zPapPrice((p.gear[p.slot] && p.gear[p.slot].pap) || 0), box: zBoxPrice(p.boxN || 0), heal: zHealPrice(zb.wave, p.healN || 0), ubox: zUboxPrice(p.uboxN || 0), shrine: zShrinePrice(zb.shrineN), armor: p.armorN || 0,
                    team: plist.map(q => [q.name, Math.floor(q.pts), zb.kills.get(q.id) || 0, q.dead ? 1 : 0]) } : undefined,
                players: [...plist.filter(q => q === p || (inView(q.x, q.y) && canSee(p, q, now))), ...decoys.filter(d => d.pid !== p.id && inView(d.x, d.y) && players.has(d.pid)).map(d => ({ ...players.get(d.pid), id: d.id, x: d.x, y: d.y, a: d.a })),
                    ...clones.filter(k => inView(k.x, k.y) && players.has(k.owner)).map(k => ({ ...players.get(k.owner), id: k.id, x: k.x, y: k.y, a: k.a, clone: true, orbitOn: false, titanUntil: 0 }))].map(q => {
                    const qw = q.gear[q.slot] || q.gear.primary;
                    return {
                        id: q.id, n: q.name, c: q.color, lv: q.level, tm: q.team, dead: q.dead || undefined,
                        x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10, a: Math.round(q.a * 100) / 100,
                        hp: Math.max(0, Math.round(q.hp)), mh: q.maxHp, w: qw.base, wt: qw.tier, wn: qw.name,
                        ar: q.gear.vest ? I.ARMORS[q.gear.vest.base].set : null, hm: q.gear.helmet ? I.ARMORS[q.gear.helmet.base].set : null,
                        fb: ['helmet', 'vest', 'pants', 'boots'].map(sl => q.gear[sl] && I.ARMORS[q.gear[sl].base] && I.ARMORS[q.gear[sl].base].full ? q.gear[sl].base : null).find(Boolean) || undefined,
                        burn: !!q.burn, slow: now < q.slowUntil, pr: now < q.protect,
                        ob: q.orbitOn ? 1 : undefined, ti: now < (q.titanUntil || 0) ? 1 : undefined, cl: q.clone ? 1 : undefined
                    };
                }),
                bullets: bullets.filter(b => inView(b.x, b.y)).map(b => b.w.look ? [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.owner, b.fx, b.tier, b.w.look] : [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.owner, b.fx, b.tier]),
                tanks: tankState.size && regionAt(p.x, p.y) === 'lab' ? [...tankState].map(([i, t]) => [i, t.warnUntil ? 1 : 2]) : undefined,
                crates: crates.filter(cr => inView(cr.x, cr.y)).map(cr => [cr.id, cr.x, cr.y, now >= cr.readyAt ? 1 : 0, cr.t === 'mil' ? 1 : cr.t === 'bunker' ? 2 : cr.t === 'lab' ? 3 : 0, cr.g || 0]),
                bags: bags.filter(b => inView(b.x, b.y)).map(b => [b.id, Math.round(b.x), Math.round(b.y), b.items.length, b.kind === 'boss' ? 2 : b.kind === 'drop' ? 1 : b.kind === 'mob1' ? 3 : b.kind === 'mob2' ? 4 : b.kind === 'mob3' || b.kind === 'ctf' ? 5 : 0]),
                // Events sieht jeder, egal wo (Karte und Pfeil am Rand)
                boss: bossView(now),
                // Gefahrenzonen (6.9): alle, sie sind riesig und gehen ueber den Bildschirm hinaus
                hz: hz.list.length ? hz.view(now) : undefined,
                strikes: strikes.filter(s => inView(s.x, s.y)).map(s => [s.id, Math.round(s.x), Math.round(s.y), s.r, Math.max(0, Math.round(s.at - now)), s.total, s.look || 0]),
                mobs: mobs.filter(m => !m.def.boss && inView(m.x, m.y)).map(m => [m.id, m.kind, Math.round(m.x), Math.round(m.y), Math.max(0, Math.round(m.hp)), m.maxHp, Math.round(m.a * 100) / 100, m.aimAt ? Math.max(0, Math.round(m.aimAt - now)) : 0,
                    m.chargeAt ? Math.max(0, Math.round(m.chargeAt - now)) : 0, m.charging ? 1 : 0, Math.round(m.cx || 0), Math.round(m.cy || 0), m.charm ? 1 : 0, m.lv || 0]),
                portals: portals.size ? [...portals.values()].flatMap(pr => [pr.a ? [Math.round(pr.a.x), Math.round(pr.a.y), 0, pr.b ? 1 : 0] : null, pr.b ? [Math.round(pr.b.x), Math.round(pr.b.y), 1, pr.a ? 1 : 0] : null]).filter(x => x && inView(x[0], x[1])) : undefined,
                turrets: turrets.length ? turrets.filter(t => inView(t.x, t.y)).map(t => [t.id, Math.round(t.x), Math.round(t.y), Math.round(t.a * 100) / 100, Math.max(0, Math.round(t.until - now))]) : undefined,
                drop: drop ? [Math.round(drop.x), Math.round(drop.y), Math.max(0, Math.round(drop.at - now)), drop.landed ? 1 : 0] : null,
                // Capture the Flag (6.9): [Flagge x, y, Traeger-Id|0, Ziel x, y, ms uebrig]
                ctf: ctf ? [Math.round(ctf.x), Math.round(ctf.y), ctf.carrier || 0, Math.round(ctf.bx), Math.round(ctf.by), Math.max(0, Math.round(ctf.until - now))] : undefined,
                nades: nades.filter(g => inView(g.x, g.y)).map(g => [g.id, Math.round(g.x), Math.round(g.y), g.base, g.landed ? 1 : 0, g.fuseAt ? Math.max(0, Math.round(g.fuseAt - now)) : 0]),
                smokes: smokes.filter(s => inView(s.x, s.y)).map(s => [s.id, Math.round(s.x), Math.round(s.y), s.r, Math.round(s.until - now)]),
                fires: fires.filter(f => inView(f.x, f.y)).map(f => [f.id, Math.round(f.x), Math.round(f.y), f.r, Math.round(f.until - now), f.acid ? 1 : 0]),
                holes: holes.filter(o => inView(o.x, o.y)).map(o => [o.id, Math.round(o.x), Math.round(o.y), o.r, Math.round(o.until - now)])
            });
        }
    }

    return {
        join, leave, input, action, tick, refundAll, hubAction, joinedMsg,
        startPvp: () => pvpRound(Date.now()), pvpState: () => pvp,
        startZombies: () => zStart(), zState: () => zb,
        has: c => players.has(c.id),
        names: () => [...players.values()].map(p => p.name),
        rooms: () => [{ id: 'raid', players: [...players.values()].map(p => p.name) }],
        _players: players, _bags: bags, _crates: crates, _damage: damage, _canSee: canSee,
        _spawnBoss: kind => spawnBoss(Date.now(), kind), _spawnDrop: () => spawnDrop(Date.now()), _boss: boss, _mobs: mobs, _strikes: strikes,
        _spawnMob: (kind, x, y) => spawnMob(kind, x, y, Date.now()),
        _ctf: () => ctf, _startCtf: () => { nextCtfAt = 1; ctfTick(Date.now()); return ctf; }
    };
};

module.exports.MAP = MAP;
module.exports.blocked = blocked;
module.exports.slide = WORLD.slide;
module.exports.WORLD = WORLD;
module.exports.PVP_WORLDS = PVP_WORLDS;
module.exports.ZOMBIE_WORLD = ZOMBIE_WORLD;
module.exports.zCoins = zCoins;
module.exports.W = W;
module.exports.H = H;
