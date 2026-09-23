// Arena-Items (Extraction, Umbau 23.09.2026, Runde 2 am selben Tag):
// Waffen, Ruestungsteile (Helm, Weste, Hose, Schuhe) in vier Sets, Medkits,
// Granaten; dazu Qualitaet (Grade I-V), sehr seltene Special-Effekte (Mods),
// die Erzeugung aus Cases und Kisten, die echte Seltenheit ("1 in X") und der
// Wert beim Salvagen.
//
// Runde 2 (Feedback Max): Items heissen nur noch nach ihrer Basis ("Sniper",
// nicht "Rapid Sniper"). Die Seltenheit kommt vor allem aus dem Grade (+0 bis
// +32 % auf die Werte); Effekte sind ein seltener Zusatz – im Standard-Case
// hat nur etwa jedes 25. Item ueberhaupt einen, zwei sind eine Sensation.
//
// "1 in X" ist kalibriert: nur jede X-te Ziehung aus dem Standard-Case ist
// mindestens so selten (siehe CALIBRATION, `node arena-items.js calibrate`).

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

// Ruestung: vier Slots, vier Sets. hp und speed je Set verteilen sich nach
// SLOT_SHARE auf die Teile; der Set-Bonus greift ab 2 und ab 4 Teilen.
const SLOTS = ['helmet', 'vest', 'pants', 'boots'];
const SLOT_NAMES = { helmet: 'Helmet', vest: 'Vest', pants: 'Pants', boots: 'Boots' };
const SLOT_SHARE = { helmet: 0.25, vest: 0.4, pants: 0.2, boots: 0.15 };

const SETS = {
    scout: {
        name: 'Scout', color: '#7dffb0', hp: 30, speed: 0.08, price: 900,
        pieces: { helmet: ['Scout cap', '🧢'], vest: ['Scout vest', '🦺'], pants: ['Scout pants', '👖'], boots: ['Scout sneakers', '👟'] },
        bonus: ['2: +6% move speed', '4: +12% move speed, 10% dodge']
    },
    soldier: {
        name: 'Soldier', color: '#3da5ff', hp: 60, speed: 0, price: 1800,
        pieces: { helmet: ['Combat helmet', '🪖'], vest: ['Plate carrier', '🛡️'], pants: ['Cargo pants', '👖'], boots: ['Combat boots', '🥾'] },
        bonus: ['2: +8% damage', '4: +15% damage, +10% fire rate']
    },
    jugg: {
        name: 'Juggernaut', color: '#ffd23f', hp: 110, speed: -0.13, price: 3500,
        pieces: { helmet: ['Jugg helmet', '⛑️'], vest: ['Jugg armor', '🦾'], pants: ['Jugg greaves', '🦿'], boots: ['Jugg boots', '🥾'] },
        bonus: ['2: +20 HP', '4: +50 HP, 15% less damage taken']
    },
    medic: {
        name: 'Medic', color: '#ff5b8a', hp: 45, speed: 0.02, price: 1600,
        pieces: { helmet: ['Medic cap', '⛑️'], vest: ['Medic vest', '🦺'], pants: ['Medic pants', '👖'], boots: ['Medic shoes', '👟'] },
        bonus: ['2: +2 HP/s regeneration', '4: +4 HP/s, medkits heal twice as fast and 25 HP more']
    }
};

// Basis-Id = set_slot, z. B. jugg_vest
const ARMORS = {};
for (const [sid, s] of Object.entries(SETS)) {
    for (const slot of SLOTS) {
        ARMORS[`${sid}_${slot}`] = {
            name: s.pieces[slot][0], icon: s.pieces[slot][1], set: sid, slot,
            hp: Math.round(s.hp * SLOT_SHARE[slot]), speed: s.speed * SLOT_SHARE[slot],
            price: Math.round(s.price * SLOT_SHARE[slot] / 50) * 50
        };
    }
}

// Granaten: Taste G wirft die gewaehlte, T wechselt
const THROWS = {
    frag: { name: 'Frag grenade', icon: '💣', r: 140, dmg: 85, fuse: 1300, price: 250, desc: 'Explodes after 1.3 s' },
    smoke: { name: 'Smoke grenade', icon: '💨', r: 180, dur: 9000, price: 150, desc: 'Cloud for 9 s – nobody outside sees you inside' },
    molotov: { name: 'Molotov', icon: '🔥', r: 115, dur: 5000, dps: 22, price: 300, desc: 'Fire zone for 5 s, 22 damage per second' }
};
const THROW_RANGE = 560;
const NADES_MAX = 4;             // je Sorte im Raid

// Qualitaet: Aufschlag auf Schaden bzw. HP
const GRADES = [0, 0.06, 0.12, 0.2, 0.32];

// ---------- Mods (Special-Effekte) ----------
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
    plating: { name: 'Plating', icon: '🔩', w: 30, max: 4, decay: 0.3, desc: l => `+${l * 8} HP` },
    swift: { name: 'Swift', icon: '👟', w: 22, max: 3, decay: 0.25, desc: l => `+${l * 3}% move speed` },
    regen: { name: 'Regeneration', icon: '💚', w: 15, max: 3, decay: 0.2, desc: l => `+${l} HP/s after 3 s without damage` },
    thorns: { name: 'Thorns', icon: '🌵', w: 10, max: 3, decay: 0.2, desc: l => `reflects ${l * 5}% of damage taken` },
    dodge: { name: 'Dodge', icon: '🌀', w: 5, max: 3, decay: 0.15, desc: l => `${l * 3}% chance to ignore a bullet` }
};

// ---------- Quellen ----------
// n = Verteilung der Mod-Anzahl (Effekte sind sehr selten), g = Verteilung
// des Grades, kinds = Anteil der Arten, special = Anteil der Case-only-Waffen
const SOURCES = {
    crate: { n: [0.985, 0.0135, 0.0014, 0.0001], g: [0.62, 0.26, 0.09, 0.025, 0.005], kinds: { weapon: 0.3, armor: 0.3, med: 0.22, throw: 0.18 }, special: 0.03 },
    scrapcase: { n: [0.97, 0.027, 0.0028, 0.0002], g: [0.5, 0.3, 0.14, 0.05, 0.01], kinds: { weapon: 0.5, armor: 0.5 }, special: 0.05 },
    standard: { n: [0.96, 0.035, 0.0045, 0.0005], g: [0.5, 0.3, 0.14, 0.05, 0.01], kinds: { weapon: 0.55, armor: 0.45 }, special: 0.08 },
    elite: { n: [0.85, 0.13, 0.018, 0.0018, 0.0002], g: [0, 0.45, 0.33, 0.17, 0.05], kinds: { weapon: 0.55, armor: 0.45 }, special: 0.2 },
    // Scrap-Shop: Waffe mit garantiert einem Effekt
    modded: { n: [0, 0.95, 0.045, 0.005], g: [0.6, 0.3, 0.1, 0, 0], kinds: { weapon: 1 }, special: 0.05 }
};

const CASES = {
    standard: { name: 'Standard case', icon: '📦', price: 1000, currency: 'coins', source: 'standard' },
    elite: { name: 'Elite case', icon: '💎', price: 10000, currency: 'coins', source: 'elite' },
    scrap: { name: 'Scrap case', icon: '🧰', price: 60, currency: 'scrap', source: 'scrapcase' }
};

// Shop: feste Items ohne Mods, Grade I (Coins) und Scrap-Angebote
const SHOP = [
    ...Object.entries(WEAPONS).filter(([, w]) => w.price > 0).map(([k, w]) => ({ id: 'w_' + k, kind: 'weapon', base: k, price: w.price, currency: 'coins' })),
    ...Object.entries(ARMORS).map(([k, a]) => ({ id: 'a_' + k, kind: 'armor', base: k, price: a.price, currency: 'coins' })),
    { id: 'med', kind: 'med', base: 'medkit', price: 150, currency: 'coins' },
    ...Object.entries(THROWS).map(([k, t]) => ({ id: 't_' + k, kind: 'throw', base: k, price: t.price, currency: 'coins' })),
    { id: 's_med', kind: 'med', base: 'medkit', price: 8, currency: 'scrap' },
    { id: 's_frag', kind: 'throw', base: 'frag', price: 12, currency: 'scrap' },
    { id: 's_smoke', kind: 'throw', base: 'smoke', price: 8, currency: 'scrap' },
    { id: 's_molotov', kind: 'throw', base: 'molotov', price: 15, currency: 'scrap' },
    { id: 's_modded', kind: 'gen', source: 'modded', price: 600, currency: 'scrap' }
];

// Stufe nach "1 in X"
const TIERS = [
    { id: 'common', name: 'Common', min: 0 },
    { id: 'uncommon', name: 'Uncommon', min: 3 },
    { id: 'rare', name: 'Rare', min: 20 },
    { id: 'epic', name: 'Epic', min: 200 },
    { id: 'legendary', name: 'Legendary', min: 5000 },
    { id: 'mythic', name: 'Mythic', min: 100000 },
    { id: 'ultra', name: '✦ One in a million', min: 1000000 }
];

const INV_MAX = 80;
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
    return pickWeighted(Array.from({ length: m.max }, (_, i) => [i + 1, Math.pow(m.decay, i)]));
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

// Seltenheit als "1 in X": Wahrscheinlichkeit, aus dem Standard-Case etwas
// mit MINDESTENS diesem Grade und MINDESTENS diesen Mods zu ziehen, bei
// Case-only-Waffen zusaetzlich deren Anteil.
function rarityOdds(sourceId, item) {
    const src = SOURCES[sourceId];
    let p = 1;
    if (item.kind === 'weapon' && WEAPONS[item.base].special) {
        const nSpecial = Object.values(WEAPONS).filter(w => w.special).length;
        p *= src.special / nSpecial;
    }
    p *= src.g.slice(item.grade || 0).reduce((a, b) => a + b, 0);
    const k = item.mods.length;
    if (k) {
        p *= src.n.slice(k).reduce((a, b) => a + b, 0);
        const defs = item.kind === 'weapon' ? WEAPON_MODS : ARMOR_MODS;
        const W = Object.values(defs).reduce((a, m) => a + m.w, 0);
        for (let i = 2; i <= k; i++) p *= i;
        for (const m of item.mods) p *= Math.min(1, defs[m.id].w / W * (1 + k * 0.15)) * atLeast(defs[m.id], m.lvl);
    }
    return Math.max(1, Math.round(1 / Math.max(1e-12, Math.min(1, p))));
}

// Ein neues Item aus einer Quelle
function generate(sourceId) {
    const src = SOURCES[sourceId];
    const [kind] = pickWeighted(Object.entries(src.kinds));
    if (kind === 'med') return plain('med', 'medkit');
    if (kind === 'throw') {
        const [base] = pickWeighted([['frag', 0.45], ['smoke', 0.3], ['molotov', 0.25]]);
        return plain('throw', base);
    }
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
    const [grade] = pickWeighted(src.g.map((w, i) => [i, w]).filter(([, w]) => w > 0));
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
    return finish({ kind, base, grade, mods });
}

// Vom Admin gebaut: beliebige Basis, Grade und Mods; Seltenheit wie gewuerfelt
function craft(kind, base, grade, mods) {
    return finish({ kind, base, grade: grade || 0, mods: (mods || []).slice().sort((a, b) => b.lvl - a.lvl) });
}

// Feste Items (Shop, Starter): Grade I, keine Mods
function plain(kind, base) {
    return finish({ kind, base, grade: 0, mods: [] });
}

// Kalibrierung "1 in X" (node arena-items.js calibrate): Punktzahl =
// log10(rarityOdds) gegen den Standard-Case; Tabelle [Punktzahl, log10(1/Anteil
// aller Standard-Ziehungen mit mindestens dieser Punktzahl)].
const CALIBRATION = [[0,0],[0.301,0.5],[0.699,0.75],[1.23,1],[1.875,1.25],[2.272,1.5],[2.796,1.75],[3.382,2],[3.867,2.25],[4.355,2.5],[4.781,2.75],[5.238,3],[5.663,3.25],[6.062,3.5],[6.507,3.75],[6.861,4],[7.289,4.25],[7.636,4.5],[8,4.75],[8.311,5],[8.607,5.25],[8.768,5.5],[9.082,5.75]];

function calibrated(score) {
    const t = CALIBRATION;
    if (score <= t[0][0]) return 1;
    for (let i = 1; i < t.length; i++) {
        if (score <= t[i][0]) {
            const [s0, l0] = t[i - 1], [s1, l1] = t[i];
            return Math.pow(10, l0 + (l1 - l0) * (score - s0) / (s1 - s0 || 1));
        }
    }
    const [s0, l0] = t[t.length - 2], [s1, l1] = t[t.length - 1];
    return Math.pow(10, l1 + (l1 - l0) / (s1 - s0 || 1) * (score - s1));
}

function rawScore(item) {
    if (item.kind !== 'weapon' && item.kind !== 'armor') return 0;
    return Math.log10(rarityOdds('standard', item));
}

function finish(item) {
    const odds = Math.max(1, Math.round(calibrated(rawScore(item))));
    const out = { uid: uid(), ...item, odds, tier: tierOf(odds), name: nameOf(item), v: 2 };
    if (item.kind === 'armor') out.slot = ARMORS[item.base].slot;
    return out;
}

function nameOf(item) {
    if (item.kind === 'med') return 'Medkit';
    if (item.kind === 'throw') return THROWS[item.base].name;
    return item.kind === 'weapon' ? WEAPONS[item.base].name : ARMORS[item.base].name;
}

// Scrap beim Salvagen: nach Seltenheit, Mods und Basis
function salvageValue(item) {
    if (item.starter) return 0;
    if (item.kind === 'med' || item.kind === 'throw') return 3;
    const t = TIERS.findIndex(x => x.id === item.tier);
    const baseVal = item.kind === 'weapon' ? (WEAPONS[item.base].special ? 25 : 8) : Math.max(3, Math.round(ARMORS[item.base].price / 100));
    return Math.round(baseVal + 6 * Math.pow(3, t) + item.mods.reduce((s, m) => s + m.lvl * 15, 0));
}

// Alte Items (Runde 1) auf den neuen Stand bringen: Namen ohne Effekt,
// Ruestung light/medium/heavy -> Weste des passenden Sets. true = geaendert
const OLD_ARMOR = { light: 'scout_vest', medium: 'soldier_vest', heavy: 'jugg_vest' };
function migrate(item) {
    if (!item || item.v === 2) return false;
    if (item.kind === 'armor' && OLD_ARMOR[item.base]) item.base = OLD_ARMOR[item.base];
    if (item.kind === 'armor') item.slot = ARMORS[item.base].slot;
    if (item.grade === undefined) item.grade = 0;
    item.name = nameOf(item);
    item.v = 2;
    return true;
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
        dmg: b.dmg * (1 + GRADES[item.grade || 0]) * (1 + L('sharp') * 0.12),
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

// Summe aller Ruestungsteile samt Set-Bonus
// gear = { helmet, vest, pants, boots } (Items oder null)
function armorStats(gear) {
    const s = { hp: 0, speed: 1, regen: 0, thorns: 0, dodge: 0, dmg: 1, rate: 1, taken: 1, medRate: 1, medExtra: 0, sets: {} };
    for (const slot of SLOTS) {
        const it = gear && gear[slot];
        if (!it) continue;
        const a = ARMORS[it.base];
        if (!a) continue;
        const L = id => modLvl(it, id);
        s.hp += a.hp * (1 + GRADES[it.grade || 0]) + L('plating') * 8;
        s.speed += a.speed + L('swift') * 0.03;
        s.regen += L('regen');
        s.thorns += L('thorns') * 0.05;
        s.dodge += L('dodge') * 0.03;
        s.sets[a.set] = (s.sets[a.set] || 0) + 1;
    }
    const n = id => s.sets[id] || 0;
    if (n('scout') >= 4) { s.speed += 0.12; s.dodge += 0.1; } else if (n('scout') >= 2) s.speed += 0.06;
    if (n('soldier') >= 4) { s.dmg *= 1.15; s.rate *= 1.1; } else if (n('soldier') >= 2) s.dmg *= 1.08;
    if (n('jugg') >= 4) { s.hp += 50; s.taken = 0.85; } else if (n('jugg') >= 2) s.hp += 20;
    if (n('medic') >= 4) { s.regen += 4; s.medRate = 2; s.medExtra = 25; } else if (n('medic') >= 2) s.regen += 2;
    s.hp = Math.round(s.hp);
    return s;
}

// Fuer den Browser: Namen, Icons, Texte
function catalog() {
    const mods = (defs) => Object.fromEntries(Object.entries(defs).map(([k, m]) => [k, {
        name: m.name, icon: m.icon, max: m.max, desc: Array.from({ length: m.max }, (_, i) => m.desc(i + 1))
    }]));
    return {
        weapons: WEAPONS, armors: ARMORS, sets: SETS, slots: SLOTS, slotNames: SLOT_NAMES, throws: THROWS, grades: GRADES,
        weaponMods: mods(WEAPON_MODS), armorMods: mods(ARMOR_MODS),
        cases: CASES, shop: SHOP, tiers: TIERS, invMax: INV_MAX, medkitHeal: MEDKIT_HEAL, nadesMax: NADES_MAX
    };
}

module.exports = {
    WEAPONS, ARMORS, SETS, SLOTS, THROWS, THROW_RANGE, NADES_MAX, GRADES, WEAPON_MODS, ARMOR_MODS, SOURCES, CASES, SHOP, TIERS,
    INV_MAX, MEDKIT_HEAL, generate, plain, craft, salvageValue, weaponStats, armorStats, catalog, tierOf, migrate
};

// Kalibrieren: node arena-items.js calibrate [N] – druckt die Tabelle
if (require.main === module && process.argv[2] === 'calibrate') {
    const N = Number(process.argv[3]) || 4000000;
    const scores = new Float64Array(N);
    for (let i = 0; i < N; i++) scores[i] = rawScore(generate('standard'));
    scores.sort();
    const rows = [[0, 0]];
    for (let k = 0.25; k <= Math.log10(N) - 0.5; k += 0.25) {
        const idx = Math.floor(N - N / Math.pow(10, k));
        rows.push([Math.round(scores[idx] * 1000) / 1000, k]);
    }
    const out = rows.filter((r, i) => i === 0 || r[0] > rows[i - 1][0]);
    console.log(JSON.stringify(out));
    process.exit(0);
}

// Nachrechnen: node arena-items.js [N] – Verteilung der Stufen je Quelle
if (require.main === module) {
    const N = Number(process.argv[2]) || 200000;
    for (const src of ['crate', 'standard', 'elite', 'modded']) {
        const count = {};
        let best = null, withMods = 0;
        for (let i = 0; i < N; i++) {
            const it = generate(src);
            count[it.tier] = (count[it.tier] || 0) + 1;
            if (it.mods.length) withMods++;
            if (!best || it.odds > best.odds) best = it;
        }
        console.log(src.padEnd(9), TIERS.map(t => `${t.id} ${((count[t.id] || 0) / N * 100).toFixed(3)}%`).join(' · '), `| mit Effekt ${(withMods / N * 100).toFixed(2)}%`);
        console.log('   seltenstes:', best.name, 'Grade', best.grade + 1, JSON.stringify(best.mods), '1 in', best.odds.toLocaleString('en-US'));
    }
}
