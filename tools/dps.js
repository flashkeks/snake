// DPS-Test aller Waffen (25.09.2026, Max: „Railgun zu op … DPS-Test mit ALLEN Waffen").
//
// Echte Simulation in der Arena-Engine, keine Formel: ein Spieler (Creative, also
// unverwundbar) steht auf einer leeren Flaeche und haelt 12 s lang auf einen
// Trainings-Dummy (Brute ohne Bewegung und Angriff, 1e9 HP). Gezaehlt wird der
// Schaden am Dummy von Sekunde 2 bis 12 – Brennen, Explosionen, Tesla, Combo,
// Hochdrehen usw. sind also drin, Zielen auf bewegliche Gegner nicht.
//
// Drei Stufen je Waffe:
//   Basis   = niedrigste Stufe der Basis, Level 1, keine Effekte
//   Max     = hoechste Stufe der Basis (maxTierOf), Level 30, keine Effekte
//   Max+PaP = wie Max, dazu Pack-a-Punch 5 (Zombies: ×1,6^5 Schaden, ×1,12^5 Feuerrate)
// Abstand zum Dummy: 300 px, bei kurzer Reichweite 60 % der Reichweite.
//
// Aufruf: node tools/dps.js [--md]   (--md = Markdown-Tabelle)

process.env.SNAKE_EXTRACT_ONLY = '';
const path = require('path');
const R = path.join(__dirname, '..') + '/';
const I = require(R + 'arena-items');
const M = require(R + 'arena-mobs');
const createShooter = require(R + 'shooter');

const md = process.argv.includes('--md');
const realNow = Date.now;
let clock = realNow();
Date.now = () => clock;

// Leere Welt: PvP-Karte ohne Waende, Gebuesch und Gebaeude
const base = createShooter.PVP_WORLDS[0].map;
const map = { ...base, walls: [], buildings: [], doors: [], bushes: [], crates: [] };
const world = createShooter.makeWorld(map, 3000, 3000);

function accountsStub() {
    const arena = { v: 3, fixTier1: true, inv: [], loadout: {}, scrap: 0, creative: true, prog: null };
    return {
        arena: () => arena, touch() {}, stat() {}, period() {},
        get: () => ({ name: 'dps' }),
        _a: arena
    };
}

function run(baseId, tier, level, pap) {
    const accounts = accountsStub();
    const sh = createShooter({ accounts, send() {}, feed() {}, refresh() {}, changed() {} }, { mode: 'dungeon', world });
    const it = I.craft('weapon', baseId, tier, []);
    if (level > 1) it.wxp = Math.round(100 * Math.pow(level - 1, 1.7)) + 1;
    if (pap) it.pap = pap;
    const a = accounts._a;
    a.inv = [it];
    a.loadout = { primary: it.uid, secondary: null, helmet: null, vest: null, pants: null, boots: null, backpack: null, util: [null, null] };
    const c = { id: 'c1', account: 'dps' };
    const err = sh.join(c, 'dps', '#fff');
    if (err) throw new Error(err);
    const p = sh._players.get('c1');
    p.x = 1000; p.y = 1500;
    const def = I.WEAPONS[baseId];
    const range = def.speed * def.life;
    const dist = Math.min(300, range * 0.6);
    for (const m of sh._mobs.splice(0)) void m;
    const d = sh._spawnMob('brute', p.x + dist, p.y);
    d.def = { ...M.MOBS.brute, speed: 0, chase: 0, melee: 0, aggro: 0 };
    d.x = p.x + dist; d.y = p.y;
    d.hp = d.maxHp = 1e9;
    let dealt = 0, t = 0;
    const STEP = 33, WARM = 2000, END = 12000;
    while (t < END) {
        clock += STEP; t += STEP;
        // Nur der Dummy bleibt stehen; alles andere, was die Welt spawnt, fliegt raus
        for (let i = sh._mobs.length - 1; i >= 0; i--) if (sh._mobs[i] !== d) sh._mobs.splice(i, 1);
        if (!sh._mobs.includes(d)) sh._mobs.push(d);
        d.x = p.x + dist; d.y = p.y; d.stunUntil = 0; d.slowUntil = 0;
        p.hp = p.maxHp;
        p.x = 1000; p.y = 1500;
        sh.input(c, { mx: 0, my: 0, a: Math.atan2(d.y - p.y, d.x - p.x), f: 1 });
        const before = d.hp;
        sh.tick();
        if (t > WARM) dealt += before - d.hp;
        d.hp = 1e9;
    }
    return dealt / ((END - WARM) / 1000);
}

const paper = (baseId, tier, level, pap) => {
    const it = I.craft('weapon', baseId, tier, []);
    if (level > 1) it.wxp = Math.round(100 * Math.pow(level - 1, 1.7)) + 1;
    const w = I.weaponStats(it);
    let dmg = w.dmg, ms = w.ms;
    if (pap) { dmg *= Math.pow(1.6, pap); ms /= Math.pow(1.12, pap); }
    return dmg * w.pellets * 1000 / ms;
};

const rows = [];
for (const [id, b] of Object.entries(I.WEAPONS)) {
    const lo = b.tier, hi = I.maxTierOf(b);
    const r = {
        id, name: b.name, unique: !!b.unique, lo: I.TIERS[lo].name, hi: I.TIERS[hi].name,
        base: run(id, lo, 1, 0), max: run(id, hi, 30, 0), pap: run(id, hi, 30, 5),
        paperBase: paper(id, lo, 1, 0), paperMax: paper(id, hi, 30, 0)
    };
    rows.push(r);
    if (!md) console.error(`${id.padEnd(14)} ${r.base.toFixed(0).padStart(7)} ${r.max.toFixed(0).padStart(8)} ${r.pap.toFixed(0).padStart(9)}`);
}
Date.now = realNow;
rows.sort((x, y) => y.max - x.max);
const f = n => Math.round(n).toLocaleString('de-DE');
if (md) {
    console.log('| # | Waffe | Stufen | DPS Basis | DPS Max (Lv 30) | DPS Max + PaP 5 | Papier Basis | Papier Max |');
    console.log('|---|---|---|---:|---:|---:|---:|---:|');
    rows.forEach((r, i) => console.log(`| ${i + 1} | ${r.unique ? '★ ' : ''}${r.name} | ${r.lo}–${r.hi} | ${f(r.base)} | ${f(r.max)} | ${f(r.pap)} | ${f(r.paperBase)} | ${f(r.paperMax)} |`));
} else {
    console.log(JSON.stringify(rows, null, 1));
}
process.exit(0);
