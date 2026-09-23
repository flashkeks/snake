// Arena-Items (Extraction-Umbau, 23.09.2026): Waffen, Ruestungen, Medkits,
// ihre Special-Effekte (Mods), die Erzeugung aus Cases und Kisten, die echte
// Seltenheit ("1 in X") und der Wert beim Salvagen.
//
// Mods haben Stufen; jede hoehere Stufe ist exponentiell seltener (Faktor
// `decay` je Stufe). Wie viele Mods ein Item bekommt, haengt von der Quelle
// ab (Kiste < Standard-Case < Elite-Case). "1 in X" ist kalibriert: nur jede
// X-te Ziehung aus dem Standard-Case ist mindestens so selten (siehe
// CALIBRATION). Daraus entsteht die Stufe Common ... One in a million.

// ---------- Basen ----------

// ms = Schussabstand, dmg je Kugel, speed, life (s), spread (rad), pellets
const WEAPONS = {
    pistol: { name: 'Pistol', icon: '🔫', ms: 260, dmg: 20, speed: 950, life: 0.9, spread: 0.03, pellets: 1, price: 0 },
    smg: { name: 'SMG', icon: '🔫', ms: 90, dmg: 10, speed: 1000, life: 0.7, spread: 0.09, pellets: 1, price: 600 },
    shotgun: { name: 'Shotgun', icon: '💥', ms: 650, dmg: 14, speed: 900, life: 0.45, spread: 0.3, pellets: 6, price: 900 },
    rifle: { name: 'Rifle', icon: '🪖', ms: 150, dmg: 22, speed: 1250, life: 1.0, spread: 0.02, pellets: 1, price: 1400 },
    sniper: { name: 'Sniper', icon: '🎯', ms: 1100, dmg: 90, speed: 2200, life: 1.3, spread: 0, pellets: 1, price: 2500 },
    // nur aus Cases und Kisten
    deagle: { name: 'Golden Deagle', icon: '✨', ms: 380, dmg: 55, speed: 1500, life: 1.0, spread: 0.01, pellets: 1, price: 0, special: true },
    minigun: { name: 'Minigun', icon: '⚙️', ms: 55, dmg: 9, speed: 1100, life: 0.8, spread: 0.14, pellets: 1, price: 0, special: true },
    launcher: { name: 'Launcher', icon: '🚀', ms: 1000, dmg: 45, speed: 700, life: 1.4, spread: 0, pellets: 1, price: 0, special: true, explode: 1 }
};

const ARMORS = {
    light: { name: 'Light vest', icon: '🦺', hp: 25, speed: 1.0, price: 500 },
    medium: { name: 'Plate carrier', icon: '🛡️', hp: 50, speed: 0.95, price: 1100 },
    heavy: { name: 'Juggernaut', icon: '🦾', hp: 100, speed: 0.87, price: 2500 }
};

// ---------- Mods ----------
// w = Gewicht bei der Auswahl, max = hoechste Stufe, decay = Faktor je Stufe
const WEAPON_MODS = {
    sharp: { name: 'Sharp', icon: '🗡️', w: 30, max: 5, decay: 0.3, desc: l => `+${l * 12}% damage` },
    rapid: { name: 'Rapid', icon: '⚡', w: 30, max: 5, decay: 0.3, desc: l => `+${l * 10}% fire rate` },
    velocity: { name: 'Velocity', icon: '💨', w: 22, max: 3, decay: 0.3, desc: l => `+${l * 25}% bullet speed and range` },
    crit: { name: 'Critical', icon: '🎯', w: 20, max: 3, decay: 0.25, desc: l => `${l * 12}% chance for double damage` },
    multishot: { name: 'Multishot', icon: '🔱', w: 12, max: 4, decay: 0.15, desc: l => `+${l} extra bullet${l > 1 ? 's' : ''} per shot` },
    pierce: { name: 'Piercing', icon: '📌', w: 12, max: 3, decay: 0.2, desc: l => `bullets pass through ${l} target${l > 1 ? 's' : ''}` },
    ricochet: { name: 'Ricochet', icon: '🔁', w: 10, max: 3, decay: 0.2, desc: l => `bullets bounce off walls ${l}×` },
    burn: { name: 'Incendiary', icon: '🔥', w: 10, max: 3, decay: 0.25, desc: l => `sets targets on fire (${l * 6} dmg/s for 3 s)` },
    frost: { name: 'Frost', icon: '❄️', w: 8, max: 2, decay: 0.2, desc: l => `slows targets by ${l * 25}% for 1.5 s` },
    vampire: { name: 'Vampire', icon: '🩸', w: 6, max: 3, decay: 0.2, desc: l => `heals you for ${l * 12}% of damage dealt` },
    explosive: { name: 'Explosive', icon: '💣', w: 4, max: 2, decay: 0.15, desc: l => `hits explode (${l * 35}% damage around)` },
    homing: { name: 'Homing', icon: '🧲', w: 1.5, max: 2, decay: 0.15, desc: l => `bullets curve towards enemies${l > 1 ? ' (strongly)' : ''}` },
    tesla: { name: 'Tesla', icon: '🌩️', w: 0.8, max: 1, decay: 1, desc: () => 'hits arc to 2 nearby enemies' },
    execute: { name: 'Executioner', icon: '☠️', w: 0.5, max: 2, decay: 0.1, desc: l => `kills targets below ${l * 15}% HP instantly` }
};

const ARMOR_MODS = {
    plating: { name: 'Plating', icon: '🔩', w: 30, max: 4, decay: 0.3, desc: l => `+${l * 15} HP` },
    swift: { name: 'Swift', icon: '👟', w: 22, max: 3, decay: 0.25, desc: l => `+${l * 6}% move speed` },
    regen: { name: 'Regeneration', icon: '💚', w: 15, max: 3, decay: 0.2, desc: l => `+${l * 3} HP/s after 3 s without damage` },
    thorns: { name: 'Thorns', icon: '🌵', w: 10, max: 3, decay: 0.2, desc: l => `reflects ${l * 12}% of damage taken` },
    dodge: { name: 'Dodge', icon: '🌀', w: 5, max: 3, decay: 0.15, desc: l => `${l * 7}% chance to ignore a bullet` }
};

// ---------- Quellen ----------
// n = Verteilung der Mod-Anzahl, kinds = Anteil Waffe/Ruestung/Medkit,
// special = Anteil der Case-only-Waffen unter den Waffen
const SOURCES = {
    crate: { n: [0.55, 0.30, 0.11, 0.03, 0.009, 0.001], kinds: { weapon: 0.45, armor: 0.2, med: 0.35 }, special: 0.03 },
    scrapcase: { n: [0.35, 0.40, 0.17, 0.06, 0.018, 0.002], kinds: { weapon: 0.6, armor: 0.3, med: 0.1 }, special: 0.05 },
    standard: { n: [0.25, 0.40, 0.22, 0.09, 0.03, 0.008, 0.002], kinds: { weapon: 0.75, armor: 0.25 }, special: 0.08 },
    elite: { n: [0, 0.35, 0.33, 0.19, 0.09, 0.03, 0.01], kinds: { weapon: 0.75, armor: 0.25 }, special: 0.2 },
    // Scrap-Shop: Waffe mit mindestens einem Effekt
    modded: { n: [0, 0.7, 0.24, 0.05, 0.01], kinds: { weapon: 1 }, special: 0.05 }
};

const CASES = {
    standard: { name: 'Standard case', icon: '📦', price: 1000, currency: 'coins', source: 'standard' },
    elite: { name: 'Elite case', icon: '💎', price: 10000, currency: 'coins', source: 'elite' },
    scrap: { name: 'Scrap case', icon: '🧰', price: 60, currency: 'scrap', source: 'scrapcase' }
};

// Shop: feste Items ohne Mods (Coins) und Scrap-Angebote
const SHOP = [
    ...Object.entries(WEAPONS).filter(([, w]) => w.price > 0).map(([k, w]) => ({ id: 'w_' + k, kind: 'weapon', base: k, price: w.price, currency: 'coins' })),
    ...Object.entries(ARMORS).map(([k, a]) => ({ id: 'a_' + k, kind: 'armor', base: k, price: a.price, currency: 'coins' })),
    { id: 'med', kind: 'med', base: 'medkit', price: 150, currency: 'coins' },
    { id: 's_med', kind: 'med', base: 'medkit', price: 8, currency: 'scrap' },
    { id: 's_modded', kind: 'gen', source: 'modded', price: 150, currency: 'scrap' }
];

// Stufe nach "1 in X" (X = so viele Standard-Case-Ziehungen braucht es im
// Mittel fuer etwas mindestens so Seltenes)
const TIERS = [
    { id: 'common', name: 'Common', min: 0 },
    { id: 'uncommon', name: 'Uncommon', min: 3 },
    { id: 'rare', name: 'Rare', min: 20 },
    { id: 'epic', name: 'Epic', min: 200 },
    { id: 'legendary', name: 'Legendary', min: 5000 },
    { id: 'mythic', name: 'Mythic', min: 100000 },
    { id: 'ultra', name: '✦ One in a million', min: 1000000 }
];

const INV_MAX = 60;
const MEDKIT_HEAL = 50;

function pickWeighted(entries) {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of entries) {
        r -= w;
        if (r < 0) return [k, w / total];
    }
    const last = entries[entries.length - 1];
    return [last[0], last[1] / total];
}

// Stufe 1..max mit P(L) ~ decay^(L-1)
function rollLevel(m) {
    const ws = Array.from({ length: m.max }, (_, i) => [i + 1, Math.pow(m.decay, i)]);
    return pickWeighted(ws);
}

function tierOf(odds) {
    let t = TIERS[0];
    for (const x of TIERS) if (odds >= x.min) t = x;
    return t.id;
}

let seq = 0;
function uid() {
    return Date.now().toString(36) + (++seq).toString(36) + Math.random().toString(36).slice(2, 6);
}

// P(Stufe >= L) fuer einen Mod
function atLeast(m, L) {
    let tot = 0, hit = 0;
    for (let i = 1; i <= m.max; i++) {
        const w = Math.pow(m.decay, i - 1);
        tot += w;
        if (i >= L) hit += w;
    }
    return hit / tot;
}

// Seltenheit als "1 in X": Wahrscheinlichkeit, aus dieser Quelle ein Item mit
// MINDESTENS diesen Mods auf MINDESTENS diesen Stufen zu ziehen (egal welche
// Mods sonst noch dran sind), bei Case-only-Waffen zusaetzlich deren Anteil.
// Die exakte Kombination waere immer winzig und saehe bei jedem Item mit
// drei Mods nach "one in a million" aus.
function rarityOdds(sourceId, item) {
    const src = SOURCES[sourceId];
    let p = 1;
    if (item.kind === 'weapon' && WEAPONS[item.base].special) {
        const nSpecial = Object.values(WEAPONS).filter(w => w.special).length;
        p *= src.special / nSpecial;
    }
    const k = item.mods.length;
    if (k) {
        const pAtLeastK = src.n.slice(k).reduce((a, b) => a + b, 0);
        const defs = item.kind === 'weapon' ? WEAPON_MODS : ARMOR_MODS;
        const W = Object.values(defs).reduce((a, m) => a + m.w, 0);
        p *= pAtLeastK;
        for (let i = 2; i <= k; i++) p *= i;
        for (const m of item.mods) p *= Math.min(1, defs[m.id].w / W * (1 + k * 0.15)) * atLeast(defs[m.id], m.lvl);
    }
    return Math.max(1, Math.round(1 / Math.min(1, p)));
}

// Ein neues Item aus einer Quelle
function generate(sourceId) {
    const src = SOURCES[sourceId];
    const [kind] = pickWeighted(Object.entries(src.kinds));
    if (kind === 'med') return finish({ kind: 'med', base: 'medkit', mods: [] }, 1);
    let base;
    if (kind === 'weapon') {
        const normal = Object.keys(WEAPONS).filter(k => !WEAPONS[k].special);
        const special = Object.keys(WEAPONS).filter(k => WEAPONS[k].special);
        base = Math.random() < src.special
            ? special[Math.floor(Math.random() * special.length)]
            : normal[Math.floor(Math.random() * normal.length)];
    } else {
        const ks = Object.keys(ARMORS);
        base = ks[Math.floor(Math.random() * ks.length)];
    }
    const [n] = pickWeighted(src.n.map((w, i) => [i, w]).filter(([, w]) => w > 0));
    const pool = { ...(kind === 'weapon' ? WEAPON_MODS : ARMOR_MODS) };
    const mods = [];
    for (let i = 0; i < n && Object.keys(pool).length; i++) {
        const [id] = pickWeighted(Object.entries(pool).map(([k, m]) => [k, m.w]));
        const [lvl] = rollLevel(pool[id]);
        mods.push({ id, lvl });
        delete pool[id];
    }
    mods.sort((a, b) => b.lvl - a.lvl);
    const item = { kind, base, mods };
    return finish(item, null);
}

// Feste Items (Shop, Starter): keine Mods
function plain(kind, base) {
    return finish({ kind, base, mods: [] }, null);
}

// Kalibrierung "1 in X" (node arena-items.js calibrate): Punktzahl =
// log10(rarityOdds) gegen den Standard-Case; Tabelle [Punktzahl, log10(1/Anteil
// aller Standard-Ziehungen mit mindestens dieser Punktzahl)]. "1 in X" heisst
// also: nur jede X-te Ziehung aus dem Standard-Case ist mindestens so selten.
const CALIBRATION = [[0,0],[1.892,0.5],[2.56,0.75],[3.167,1],[3.71,1.25],[4.225,1.5],[4.707,1.75],[5.156,2],[5.58,2.25],[5.981,2.5],[6.377,2.75],[6.753,3],[7.122,3.25],[7.48,3.5],[7.809,3.75],[8.138,4],[8.44,4.25],[8.773,4.5],[9.073,4.75],[9.293,5],[9.459,5.25],[9.637,5.5],[9.875,5.75],[10.093,6]];

function calibrated(score) {
    const t = CALIBRATION;
    if (score <= t[0][0]) return 1;
    for (let i = 1; i < t.length; i++) {
        if (score <= t[i][0]) {
            const [s0, l0] = t[i - 1], [s1, l1] = t[i];
            return Math.pow(10, l0 + (l1 - l0) * (score - s0) / (s1 - s0 || 1));
        }
    }
    // Jenseits der Tabelle mit der Steigung des letzten Stuecks weiter
    const [s0, l0] = t[t.length - 2], [s1, l1] = t[t.length - 1];
    return Math.pow(10, l1 + (l1 - l0) / (s1 - s0 || 1) * (score - s1));
}

function finish(item) {
    const score = item.mods.length || (item.kind === 'weapon' && WEAPONS[item.base].special)
        ? Math.log10(rarityOdds('standard', item)) : 0;
    const odds = Math.max(1, Math.round(calibrated(score)));
    return { uid: uid(), ...item, odds, tier: tierOf(odds), name: nameOf(item) };
}

function nameOf(item) {
    if (item.kind === 'med') return 'Medkit';
    const base = item.kind === 'weapon' ? WEAPONS[item.base].name : ARMORS[item.base].name;
    if (!item.mods.length) return base;
    const defs = item.kind === 'weapon' ? WEAPON_MODS : ARMOR_MODS;
    const top = item.mods[0];
    const suffix = item.mods.length >= 4 ? ' of Doom' : item.mods.length === 3 ? ' of Havoc' : '';
    return `${defs[top.id].name} ${base}${suffix}`;
}

// Scrap beim Salvagen: nach Seltenheit, Mods und Basis
function salvageValue(item) {
    if (item.starter) return 0;
    if (item.kind === 'med') return 3;
    const t = TIERS.findIndex(x => x.id === item.tier);
    const baseVal = item.kind === 'weapon' ? (WEAPONS[item.base].special ? 25 : 8) : 8;
    return Math.round(baseVal + 6 * Math.pow(3, t) + item.mods.reduce((s, m) => s + m.lvl * 4, 0));
}

// ---------- Werte im Spiel ----------

function modLvl(item, id) {
    const m = item && item.mods.find(x => x.id === id);
    return m ? m.lvl : 0;
}

function weaponStats(item) {
    const b = WEAPONS[item.base] || WEAPONS.pistol;
    const L = id => modLvl(item, id);
    return {
        ms: b.ms / (1 + L('rapid') * 0.1),
        dmg: b.dmg * (1 + L('sharp') * 0.12),
        speed: b.speed * (1 + L('velocity') * 0.25),
        life: b.life * (1 + L('velocity') * 0.15),
        spread: b.spread,
        pellets: b.pellets + L('multishot'),
        pierce: L('pierce'),
        bounce: L('ricochet'),
        crit: L('crit') * 0.12,
        burn: L('burn') * 6,
        frost: L('frost') * 0.25,
        vamp: L('vampire') * 0.12,
        explode: (b.explode || 0) + L('explosive') * 0.35,
        homing: L('homing'),
        tesla: L('tesla'),
        execute: L('execute') * 0.15
    };
}

function armorStats(item) {
    if (!item) return { hp: 0, speed: 1, regen: 0, thorns: 0, dodge: 0 };
    const a = ARMORS[item.base];
    const L = id => modLvl(item, id);
    return {
        hp: a.hp + L('plating') * 15,
        speed: a.speed * (1 + L('swift') * 0.06),
        regen: L('regen') * 3,
        thorns: L('thorns') * 0.12,
        dodge: L('dodge') * 0.07
    };
}

// Fuer den Browser: Namen, Icons, Texte
function catalog() {
    const mods = (defs) => Object.fromEntries(Object.entries(defs).map(([k, m]) => [k, {
        name: m.name, icon: m.icon, max: m.max, desc: Array.from({ length: m.max }, (_, i) => m.desc(i + 1))
    }]));
    return {
        weapons: WEAPONS, armors: ARMORS, weaponMods: mods(WEAPON_MODS), armorMods: mods(ARMOR_MODS),
        cases: CASES, shop: SHOP, tiers: TIERS, invMax: INV_MAX, medkitHeal: MEDKIT_HEAL
    };
}

module.exports = {
    WEAPONS, ARMORS, WEAPON_MODS, ARMOR_MODS, SOURCES, CASES, SHOP, TIERS, INV_MAX, MEDKIT_HEAL,
    generate, plain, salvageValue, weaponStats, armorStats, catalog, tierOf
};

// Kalibrieren: node arena-items.js calibrate [N] – druckt die Tabelle
if (require.main === module && process.argv[2] === 'calibrate') {
    const N = Number(process.argv[3]) || 4000000;
    const scores = new Float64Array(N);
    for (let i = 0; i < N; i++) {
        const it = generate('standard');
        scores[i] = it.mods.length || (it.kind === 'weapon' && WEAPONS[it.base].special) ? Math.log10(rarityOdds('standard', it)) : 0;
    }
    scores.sort();
    const rows = [[0, 0]];
    for (let k = 0.5; k <= Math.log10(N) - 0.5; k += 0.25) {
        const idx = Math.floor(N - N / Math.pow(10, k));
        rows.push([Math.round(scores[idx] * 1000) / 1000, k]);
    }
    // gleiche Punktzahlen zusammenfassen
    const out = rows.filter((r, i) => i === 0 || r[0] > rows[i - 1][0]);
    console.log(JSON.stringify(out));
    process.exit(0);
}

// Nachrechnen: node arena-items.js [N] – Verteilung der Stufen je Quelle
if (require.main === module) {
    const N = Number(process.argv[2]) || 200000;
    for (const src of ['crate', 'standard', 'elite']) {
        const count = {};
        let best = null;
        for (let i = 0; i < N; i++) {
            const it = generate(src);
            count[it.tier] = (count[it.tier] || 0) + 1;
            if (!best || it.odds > best.odds) best = it;
        }
        console.log(src.padEnd(9), TIERS.map(t => `${t.id} ${((count[t.id] || 0) / N * 100).toFixed(3)}%`).join(' · '));
        console.log('   seltenstes:', best.name, JSON.stringify(best.mods), '1 in', best.odds.toLocaleString('en-US'));
    }
}
