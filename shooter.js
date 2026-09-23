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
const PACK_MAX = 20;            // Rucksack im Raid
const MEDS_MAX = 3;
const EXTRACT_MS = 6000;
const EXTRACT_R = 95;
const CRATE_RESPAWN = 150000;
const BAG_LIFE = 5 * 60e3;
const INTERACT_R = 75;
const MED_MS = 2000;

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
    const T = 22;
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
                } else {
                    walls.push([s.x, s.y, T, at], [s.x, s.y + at + gap, T, s.len - at - gap]);
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
        const type = rand();
        const r = type < 0.35 ? [0, 0, 50 + rand() * 20, 50 + rand() * 20]        // Kisten
            : type < 0.7 ? [0, 0, 70 + rand() * 60, 50 + rand() * 50]              // Felsen
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
    return { walls: walls.map(w => w.map(Math.round)), crates: crates.map(c => ({ x: Math.round(c.x), y: Math.round(c.y) })), extracts };
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

// Kurzform fuer den Browser
function brief(it) {
    return it ? { uid: it.uid, n: it.name, b: it.base, k: it.kind, t: it.tier, s: !!it.starter } : null;
}

function starterPistol() {
    return { ...I.plain('weapon', 'pistol'), uid: 'starter', name: 'Starter pistol', starter: true };
}

module.exports = function createArena(h) {
    // h: { accounts, send, feed, refresh(c), changed() }
    const players = new Map();       // client id -> Spieler im Raid
    const bullets = [];
    const crates = MAP.crates.map((c, i) => ({ id: i, x: c.x, y: c.y, readyAt: 0 }));
    const bags = [];
    let bagSeq = 0;
    let bulletSeq = 0;
    let lastTick = Date.now();
    let lastSend = 0;
    const feedLog = [];

    // ---------- Hub: Lager, Loadout, Kaufen, Cases, Salvage ----------

    function st(c) {
        return c.account ? h.accounts.arena(c.account) : null;
    }

    function sendHub(c, extra) {
        const a = st(c);
        if (!a) return;
        const u = h.accounts.get(c.account);
        h.send(c, { type: 'arHub', inv: a.inv, loadout: a.loadout, scrap: a.scrap, coins: u.coins, inRaid: players.has(c.id), ...extra });
    }

    function noteOdds(key, item) {
        h.accounts.stat(key, s => { s.bestOdds = Math.max(s.bestOdds || 0, item.odds || 0); });
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
        for (const it of kept) noteOdds(c.account, it);
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

    function hubAction(c, d) {
        if (!c.account) return h.send(c, { type: 'arError', error: 'Log in to use the arena' });
        if (players.has(c.id) && d.type !== 'arHub') return h.send(c, { type: 'arError', error: 'You are in a raid' });
        const a = st(c);
        if (d.type === 'arHub') return sendHub(c);
        if (d.type === 'arBuy') {
            const offer = I.SHOP.find(x => x.id === d.id);
            if (!offer) return;
            if (a.inv.length >= I.INV_MAX) return h.send(c, { type: 'arError', error: 'Your stash is full – salvage something first' });
            const err = pay(c, offer.price, offer.currency);
            if (err) return h.send(c, { type: 'arError', error: err });
            const item = offer.kind === 'gen' ? I.generate(offer.source) : I.plain(offer.kind, offer.base);
            addItems(c, [item]);
            return sendHub(c, { got: item });
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
            if (item.odds >= 100000) h.feed(`${cs.icon} ${h.accounts.get(c.account).name} unboxed ${item.name} (1 in ${item.odds.toLocaleString('en-US')})`, 'gold');
            return sendHub(c, { caseItem: item, reel });
        }
        if (d.type === 'arSalvage') {
            const uids = new Set((Array.isArray(d.uids) ? d.uids : []).map(String));
            const out = a.inv.filter(it => uids.has(it.uid));
            if (!out.length) return;
            const scrap = out.reduce((s, it) => s + I.salvageValue(it), 0);
            a.inv = a.inv.filter(it => !uids.has(it.uid));
            for (const slot of ['primary', 'secondary', 'armor']) if (uids.has(a.loadout[slot])) a.loadout[slot] = null;
            a.loadout.meds = Math.min(a.loadout.meds, a.inv.filter(it => it.kind === 'med').length);
            a.scrap += scrap;
            h.accounts.touch();
            return sendHub(c, { salvaged: { count: out.length, scrap } });
        }
        if (d.type === 'arEquip') {
            const slot = String(d.slot);
            if (slot === 'meds') {
                const have = a.inv.filter(it => it.kind === 'med').length;
                a.loadout.meds = Math.max(0, Math.min(MEDS_MAX, have, Math.floor(Number(d.n)) || 0));
            } else if (['primary', 'secondary', 'armor'].includes(slot)) {
                if (d.uid === null) a.loadout[slot] = null;
                else {
                    const it = a.inv.find(x => x.uid === d.uid);
                    const kind = slot === 'armor' ? 'armor' : 'weapon';
                    if (!it || it.kind !== kind) return h.send(c, { type: 'arError', error: 'That does not fit there' });
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

    function gearStats(p) {
        const arm = I.armorStats(p.gear.armor);
        p.maxHp = 100 + arm.hp;
        p.speedMul = arm.speed;
        p.regen = arm.regen;
        p.thorns = arm.thorns;
        p.dodge = arm.dodge;
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
            const i = a.inv.findIndex(x => x.uid === uid);
            return i >= 0 ? a.inv.splice(i, 1)[0] : null;
        };
        // Loadout verlaesst das Lager
        const gear = {
            primary: take(a.loadout.primary) || starterPistol(),
            secondary: take(a.loadout.secondary),
            armor: take(a.loadout.armor)
        };
        let meds = 0;
        for (let i = 0; i < a.loadout.meds; i++) {
            const idx = a.inv.findIndex(x => x.kind === 'med');
            if (idx < 0) break;
            a.inv.splice(idx, 1);
            meds++;
        }
        a.loadout = { primary: null, secondary: null, armor: null, meds: 0 };
        h.accounts.touch();
        const s = freeSpot(true);
        const p = {
            id: c.id, c, name, account: c.account, color: color || '#ff5bd6',
            x: s.x, y: s.y, a: 0, mx: 0, my: 0, fire: false, lastShot: 0, seq: 0,
            gear, slot: 'primary', meds, pack: [], kills: 0,
            hp: 0, maxHp: 100, speedMul: 1, regen: 0, thorns: 0, dodge: 0,
            burn: null, slowUntil: 0, slow: 0, lastHurt: 0, healUntil: 0, healRate: 0,
            extractAt: null, joinedAt: Date.now(), protect: Date.now() + 3000 / SPEED
        };
        gearStats(p);
        p.hp = p.maxHp;
        players.set(c.id, p);
        h.accounts.stat(c.account, st2 => { st2.raids = (st2.raids || 0) + 1; });
        sendJoined(c);
        h.changed();
        return null;
    }

    function sendJoined(c) {
        h.send(c, {
            type: 'shJoined', id: c.id,
            map: { w: W, h: H, walls: MAP.walls, extracts: MAP.extracts, extractR: EXTRACT_R, r: R, move: MOVE, view: VIEW },
            packMax: PACK_MAX, feed: feedLog.slice(-6)
        });
    }

    // Was jemand am Leib und im Rucksack hat (ohne Starter-Pistole)
    function lootOf(p) {
        const items = [p.gear.primary, p.gear.secondary, p.gear.armor].filter(it => it && !it.starter);
        for (let i = 0; i < p.meds; i++) items.push(I.plain('med', 'medkit'));
        return items.concat(p.pack);
    }

    function dropBag(x, y, items) {
        if (!items.length) return;
        bags.push({ id: ++bagSeq, x, y, items, expires: Date.now() + BAG_LIFE });
    }

    // Tod, Verlassen, Abbruch: Raid vorbei, alles weg
    function die(p, killer, how) {
        if (!players.has(p.id)) return;
        players.delete(p.id);
        const loot = lootOf(p);
        let toKiller = [];
        if (killer && players.has(killer.id)) {
            const room = PACK_MAX - killer.pack.length;
            toKiller = loot.slice(0, Math.max(0, room));
            killer.pack.push(...toKiller);
            killer.kills++;
            if (toKiller.length) h.send(killer.c, { type: 'shLoot', from: p.name, items: toKiller.map(brief) });
        }
        dropBag(p.x, p.y, loot.slice(toKiller.length));
        if (p.account) {
            h.accounts.stat(p.account, s => { s.shooterDeaths = (s.shooterDeaths || 0) + 1; });
            if (killer && killer.account) {
                h.accounts.stat(killer.account, s => { s.shooterKills = (s.shooterKills || 0) + 1; });
                h.accounts.period(killer.account, x => { x.arenaKills++; });
            }
        }
        const w = killer ? (killer.gear[killer.slot] || killer.gear.primary) : null;
        const line = { killer: killer ? killer.name : null, victim: p.name, how, weapon: w ? w.name : null, tier: w ? w.tier : null, loot: loot.length };
        feedLog.push(line);
        if (feedLog.length > 20) feedLog.shift();
        for (const q of players.values()) h.send(q.c, { type: 'shKill', ...line });
        h.send(p.c, { type: 'shLeft', result: how === 'left' ? 'left' : 'died', by: killer ? killer.name : null, lost: loot.map(brief) });
        h.changed();
    }

    function extract(p, silent) {
        if (!players.has(p.id)) return;
        players.delete(p.id);
        const items = [p.gear.primary, p.gear.secondary, p.gear.armor].filter(it => it && !it.starter);
        for (let i = 0; i < p.meds; i++) items.push(I.plain('med', 'medkit'));
        items.push(...p.pack);
        const r = addItems(p.c, items);
        // Mitgebrachtes wieder ins Loadout, soweit noch da
        const a = st(p.c);
        a.loadout = {
            primary: p.gear.primary && !p.gear.primary.starter ? p.gear.primary.uid : null,
            secondary: p.gear.secondary ? p.gear.secondary.uid : null,
            armor: p.gear.armor ? p.gear.armor.uid : null,
            meds: Math.min(MEDS_MAX, p.meds)
        };
        for (const s of ['primary', 'secondary', 'armor']) if (a.loadout[s] && !a.inv.some(x => x.uid === a.loadout[s])) a.loadout[s] = null;
        h.accounts.stat(p.account, s => { s.arenaExtracts = (s.arenaExtracts || 0) + 1; });
        if (!silent) {
            h.send(p.c, { type: 'shLeft', result: 'extracted', items: p.pack.map(brief), scrap: r.scrap });
            const best = p.pack.reduce((b, it) => !b || it.odds > b.odds ? it : b, null);
            if (best && best.odds >= 5000) h.feed(`🚁 ${p.name} extracted with ${best.name}`, 'gold');
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
        if (d.type === 'shSlot') {
            const s = d.slot === 'secondary' ? 'secondary' : 'primary';
            if (p.gear[s]) p.slot = s;
        } else if (d.type === 'shMed') {
            if (p.meds > 0 && p.hp < p.maxHp && Date.now() > p.healUntil) {
                p.meds--;
                p.healUntil = Date.now() + MED_MS / SPEED;
                p.healRate = I.MEDKIT_HEAL / (MED_MS / 1000);
            }
        } else if (d.type === 'shInteract') {
            interact(p);
        }
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
            const n = 1 + Math.floor(Math.random() * 3);
            got = Array.from({ length: n }, () => I.generate('crate'));
        } else {
            got = best.b.items;
            bags.splice(bags.indexOf(best.b), 1);
        }
        const room = PACK_MAX - p.pack.length;
        const take = got.slice(0, Math.max(0, room));
        p.pack.push(...take);
        if (got.length > take.length) dropBag(p.x + 20, p.y + 20, got.slice(take.length));
        h.send(p.c, { type: 'shLoot', items: take.map(brief), full: got.length > take.length });
    }

    // ---------- Kampf ----------

    function shoot(p, now) {
        const item = p.gear[p.slot] || p.gear.primary;
        const w = I.weaponStats(item);
        if (now - p.lastShot < w.ms / SPEED) return;
        p.lastShot = now;
        for (let k = 0; k < w.pellets; k++) {
            const off = w.pellets > 1 ? (k / (w.pellets - 1) - 0.5) * Math.max(w.spread, 0.08 * w.pellets) : (Math.random() - 0.5) * w.spread;
            const a = p.a + off;
            bullets.push({
                id: ++bulletSeq, owner: p.id,
                x: p.x + Math.cos(a) * (R + 6), y: p.y + Math.sin(a) * (R + 6),
                vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
                dies: now + w.life * 1000 / SPEED, w, pierce: w.pierce, bounce: w.bounce, hits: new Set(),
                fx: (w.explode ? 1 : 0) | (w.burn ? 2 : 0) | (w.frost ? 4 : 0) | (w.tesla ? 8 : 0) | (w.homing ? 16 : 0)
            });
        }
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
        v.hp -= dmg;
        v.lastHurt = now;
        v.extractAt = null;
        const killed = v.hp <= 0 || (opts.execute && v.hp <= v.maxHp * opts.execute);
        if (attacker) h.send(attacker.c, { type: 'shHit', x: Math.round(x), y: Math.round(y), dmg: Math.round(dmg), kill: killed, crit: !!opts.crit });
        h.send(v.c, { type: 'shHurt', dmg: Math.round(dmg) });
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
        if (crit) dmg *= 2;
        const killed = damage(v, shooter, dmg, now, b.x, b.y, { crit, execute: w.execute });
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
        if (w.explode) explode(b, now, v.id);
    }

    function explode(b, now, skipId) {
        const w = b.w;
        const r = 70 + w.explode * 40;
        fxAt(b.x, b.y, { type: 'shBoom', x: Math.round(b.x), y: Math.round(b.y), r: Math.round(r) });
        const shooter = players.get(b.owner);
        for (const q of near(b.x, b.y, r + R)) {
            if (q.id === b.owner || q.id === skipId) continue;
            damage(q, shooter, w.dmg * w.explode, now, q.x, q.y, { how: 'explosion' });
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
            return;
        }

        for (const p of [...players.values()]) {
            // Brennen, Heilen, Regeneration
            if (p.burn) {
                if (now > p.burn.until) p.burn = null;
                else if (damage(p, players.get(p.burn.from) || null, p.burn.dps * dt, now, p.x, p.y, { how: 'fire', noDodge: true })) continue;
            }
            if (now < p.healUntil) p.hp = Math.min(p.maxHp, p.hp + p.healRate * dt);
            if (p.regen && now - p.lastHurt > 3000 / SPEED) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
            const sp = MOVE * p.speedMul * (now < p.slowUntil ? 1 - p.slow : 1);
            const nx = p.x + p.mx * sp * dt;
            if (!blocked(nx, p.y, R)) p.x = nx;
            const ny = p.y + p.my * sp * dt;
            if (!blocked(p.x, ny, R)) p.y = ny;
            if (p.fire) shoot(p, now);
            // Extraction: lange genug in einer Zone stehen
            const zone = MAP.extracts.find(e => Math.hypot(e.x - p.x, e.y - p.y) < EXTRACT_R);
            if (!zone) p.extractAt = null;
            else if (!p.extractAt) p.extractAt = now + EXTRACT_MS / SPEED;
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
                    hp: Math.max(0, Math.round(p.hp)), mh: p.maxHp, slot: p.slot, meds: p.meds, pack: p.pack.length,
                    gear: { primary: brief(p.gear.primary), secondary: brief(p.gear.secondary), armor: brief(p.gear.armor) },
                    ms: Math.round(I.weaponStats(w).ms),
                    spd: Math.round(p.speedMul * (now < p.slowUntil ? 1 - p.slow : 1) * 100) / 100,
                    ex: p.extractAt ? Math.max(0, p.extractAt - now) : null,
                    burn: !!p.burn, heal: now < p.healUntil, pr: now < p.protect
                },
                players: plist.filter(q => q === p || inView(q.x, q.y)).map(q => {
                    const qw = q.gear[q.slot] || q.gear.primary;
                    return {
                        id: q.id, n: q.name, c: q.color,
                        x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10, a: Math.round(q.a * 100) / 100,
                        hp: Math.max(0, Math.round(q.hp)), mh: q.maxHp, w: qw.base, wt: qw.tier, wn: qw.name,
                        ar: q.gear.armor ? q.gear.armor.base : null, burn: !!q.burn, slow: now < q.slowUntil, pr: now < q.protect
                    };
                }),
                bullets: bullets.filter(b => inView(b.x, b.y)).map(b => [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.owner, b.fx]),
                crates: crates.filter(cr => inView(cr.x, cr.y)).map(cr => [cr.id, cr.x, cr.y, now >= cr.readyAt ? 1 : 0]),
                bags: bags.filter(b => inView(b.x, b.y)).map(b => [b.id, Math.round(b.x), Math.round(b.y), b.items.length])
            });
        }
    }

    return {
        join, leave, input, action, tick, refundAll, hubAction,
        has: c => players.has(c.id),
        names: () => [...players.values()].map(p => p.name),
        rooms: () => [{ id: 'raid', players: [...players.values()].map(p => p.name) }],
        _players: players, _bags: bags, _crates: crates, _damage: damage
    };
};

module.exports.MAP = MAP;
module.exports.blocked = blocked;
module.exports.W = W;
module.exports.H = H;
