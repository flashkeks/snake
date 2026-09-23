// Arena-Items (Extraction, 23.09.2026; Runde 3 am selben Tag).
//
// Runde 3 (Feedback Max): Die Seltenheitsstufe wird je Quelle direkt
// gewuerfelt (Common ... Ultra) – z. B. Elite-Case Legendary 1 in 400,
// Sovereign-Case (100k) Legendary 1 in 60, Mythic 1 in 1.000, Ultra 1 in
// 10.000. Jede Stufe gibt einen Werte-Aufschlag, und ab Epic gibt es
// besondere Basen, die es darunter nicht gibt (Flammenwerfer, Railgun,
// Nuke-Werfer, Singularity, Staebe, Phantom- und Titan-Set, Nuke-Granate …).
// Special-Effekte (Mods) sind unabhaengig von der Stufe gleich selten
// (~10 % einer, ~1 % zwei); sie erhoehen "1 in X" und den Item-Score, nicht
// die Stufe. Verbrauchsgut (Heilung, Granaten, Zauber) liegt in zwei Slots.
//
// "1 in X" = Stufen-Seltenheit (TIER_ODDS) × Effekt-Seltenheit.
// Item-Score = so viele Coins muesste man im Mittel ausgeben, um etwas
// mindestens so Seltenes zu ziehen (guenstigster Case) × Effekt-Seltenheit.

const TIERS = [
    { id: 'common', name: 'Common' },
    { id: 'uncommon', name: 'Uncommon' },
    { id: 'rare', name: 'Rare' },
    { id: 'epic', name: 'Epic' },
    { id: 'legendary', name: 'Legendary' },
    { id: 'mythic', name: 'Mythic' },
    { id: 'ultra', name: '✦ Ultra rare' }
];
const TIER_IDX = Object.fromEntries(TIERS.map((t, i) => [t.id, i]));
// Anzeige "1 in X" je Stufe (ohne Effekte)
const TIER_ODDS = [1, 3, 10, 50, 2500, 100000, 1000000];
// Aufschlag auf Schaden bzw. HP je Stufe
const TIER_BONUS = [0, 0.05, 0.1, 0.16, 0.24, 0.34, 0.5];

// ---------- Waffen ----------
// ms = Schussabstand, dmg je Kugel, speed, life (s), spread (rad), pellets,
// tier = ab welcher Stufe es sie gibt, tag = Themen-Case, innate = eingebaute Effekte
const WEAPONS = {
    pistol: { name: 'Pistol', icon: '🔫', tier: 0, ms: 260, dmg: 20, speed: 950, life: 0.9, spread: 0.03, pellets: 1, price: 0 },
    smg: { name: 'SMG', icon: '🔫', tier: 0, ms: 90, dmg: 10, speed: 1000, life: 0.7, spread: 0.09, pellets: 1, price: 600 },
    shotgun: { name: 'Shotgun', icon: '💥', tier: 0, ms: 650, dmg: 14, speed: 900, life: 0.45, spread: 0.3, pellets: 6, price: 900 },
    rifle: { name: 'Rifle', icon: '🪖', tier: 0, ms: 150, dmg: 22, speed: 1250, life: 1.0, spread: 0.02, pellets: 1, price: 1400 },
    sniper: { name: 'Sniper', icon: '🎯', tier: 0, ms: 1100, dmg: 90, speed: 2200, life: 1.3, spread: 0, pellets: 1, price: 2500 },
    wand: { name: 'Apprentice wand', icon: '🪄', tier: 0, tag: 'mage', ms: 330, dmg: 18, speed: 800, life: 1.0, spread: 0.02, pellets: 1, innate: { homing: 1 } },
    revolver: { name: 'Revolver', icon: '🤠', tier: 1, ms: 420, dmg: 42, speed: 1300, life: 1.0, spread: 0.01, pellets: 1 },
    deagle: { name: 'Golden Deagle', icon: '✨', tier: 2, ms: 380, dmg: 55, speed: 1500, life: 1.0, spread: 0.01, pellets: 1 },
    crossbow: { name: 'Crossbow', icon: '🏹', tier: 2, ms: 800, dmg: 70, speed: 1100, life: 1.2, spread: 0, pellets: 1, innate: { pierce: 2 } },
    firestaff: { name: 'Fire staff', icon: '☄️', tier: 2, tag: 'mage', ms: 450, dmg: 28, speed: 850, life: 1.0, spread: 0.02, pellets: 1, innate: { burn: 2 } },
    froststaff: { name: 'Frost staff', icon: '🧊', tier: 2, tag: 'mage', ms: 450, dmg: 26, speed: 850, life: 1.0, spread: 0.02, pellets: 1, innate: { frost: 2 } },
    minigun: { name: 'Minigun', icon: '⚙️', tier: 3, ms: 55, dmg: 9, speed: 1100, life: 0.8, spread: 0.14, pellets: 1 },
    launcher: { name: 'Launcher', icon: '🚀', tier: 3, tag: 'demo', ms: 1000, dmg: 45, speed: 700, life: 1.4, spread: 0, pellets: 1, explode: 1 },
    flamethrower: { name: 'Flamethrower', icon: '🔥', tier: 3, tag: 'demo', ms: 60, dmg: 5, speed: 520, life: 0.42, spread: 0.35, pellets: 1, flame: true, innate: { burn: 2 } },
    stormstaff: { name: 'Storm staff', icon: '🌩️', tier: 3, tag: 'mage', ms: 500, dmg: 34, speed: 1000, life: 1.0, spread: 0.02, pellets: 1, innate: { tesla: 1 } },
    railgun: { name: 'Railgun', icon: '⚡', tier: 4, ms: 1400, dmg: 140, speed: 3200, life: 1.2, spread: 0, pellets: 1, innate: { pierce: 5 } },
    arcaneorb: { name: 'Arcane orb', icon: '🔮', tier: 4, tag: 'mage', ms: 300, dmg: 36, speed: 900, life: 1.4, spread: 0.02, pellets: 1, innate: { homing: 2, pierce: 1 } },
    nukelauncher: { name: 'Fat Boy', icon: '☢️', tier: 5, tag: 'demo', ms: 2500, dmg: 120, speed: 600, life: 1.6, spread: 0, pellets: 1, explode: 2.5 },
    archstaff: { name: 'Staff of the Archmage', icon: '🧙', tier: 5, tag: 'mage', ms: 380, dmg: 40, speed: 950, life: 1.3, spread: 0.02, pellets: 1, innate: { multishot: 2, homing: 2, tesla: 1 } },
    singularity: { name: 'Singularity', icon: '🌀', tier: 6, tag: 'demo', ms: 1600, dmg: 90, speed: 450, life: 2.0, spread: 0, pellets: 1, explode: 2, innate: { homing: 2, tesla: 1 } }
};
// Im Shop fuer Coins (nur Grundwaffen, immer Common)
const WEAPON_PRICES = { smg: 600, shotgun: 900, rifle: 1400, sniper: 2500 };

// ---------- Ruestung: vier Slots, Sets mit Bonus ab 2 und 4 Teilen ----------
const SLOTS = ['helmet', 'vest', 'pants', 'boots'];
const SLOT_NAMES = { helmet: 'Helmet', vest: 'Vest', pants: 'Pants', boots: 'Boots' };
const SLOT_SHARE = { helmet: 0.25, vest: 0.4, pants: 0.2, boots: 0.15 };

const SETS = {
    scout: {
        name: 'Scout', color: '#7dffb0', tier: 0, hp: 30, speed: 0.08,
        pieces: { helmet: ['Scout cap', '🧢'], vest: ['Scout vest', '🦺'], pants: ['Scout pants', '👖'], boots: ['Scout sneakers', '👟'] },
        bonus: ['2: +6% move speed', '4: +12% move speed, 10% dodge']
    },
    soldier: {
        name: 'Soldier', color: '#3da5ff', tier: 0, hp: 60, speed: 0,
        pieces: { helmet: ['Combat helmet', '🪖'], vest: ['Plate carrier', '🛡️'], pants: ['Cargo pants', '👖'], boots: ['Combat boots', '🥾'] },
        bonus: ['2: +8% damage', '4: +15% damage, +10% fire rate']
    },
    medic: {
        name: 'Medic', color: '#ff5b8a', tier: 1, hp: 45, speed: 0.02,
        pieces: { helmet: ['Medic cap', '⛑️'], vest: ['Medic vest', '🦺'], pants: ['Medic pants', '👖'], boots: ['Medic shoes', '👟'] },
        bonus: ['2: +2 HP/s regeneration', '4: +4 HP/s, healing items twice as strong']
    },
    jugg: {
        name: 'Juggernaut', color: '#ffd23f', tier: 2, hp: 110, speed: -0.13,
        pieces: { helmet: ['Jugg helmet', '⛑️'], vest: ['Jugg armor', '🦾'], pants: ['Jugg greaves', '🦿'], boots: ['Jugg boots', '🥾'] },
        bonus: ['2: +20 HP', '4: +50 HP, 15% less damage taken']
    },
    mage: {
        name: 'Archmage', color: '#b884ff', tier: 2, tag: 'mage', hp: 40, speed: 0.04,
        pieces: { helmet: ['Wizard hat', '🎩'], vest: ['Arcane robe', '🥻'], pants: ['Mystic leggings', '👖'], boots: ['Enchanted boots', '🥾'] },
        bonus: ['2: +10% fire rate', '4: +10% damage, every bullet curves towards enemies']
    },
    phantom: {
        name: 'Phantom', color: '#8fe9ff', tier: 4, hp: 70, speed: 0.1,
        pieces: { helmet: ['Phantom mask', '🎭'], vest: ['Phantom cloak', '🧥'], pants: ['Phantom pants', '👖'], boots: ['Phantom boots', '👢'] },
        bonus: ['2: 15% dodge', '4: invisible after standing still for 1.5 s']
    },
    titan: {
        name: 'Titan', color: '#ff5b5b', tier: 5, hp: 220, speed: -0.05,
        pieces: { helmet: ['Titan crown', '👑'], vest: ['Titan plate', '🛡️'], pants: ['Titan greaves', '🦿'], boots: ['Titan boots', '🥾'] },
        bonus: ['2: +60 HP', '4: +150 HP, reflects 25% of damage']
    }
};

// Basis-Id = set_slot, z. B. jugg_vest
const ARMORS = {};
for (const [sid, s] of Object.entries(SETS)) {
    for (const slot of SLOTS) {
        ARMORS[`${sid}_${slot}`] = {
            name: s.pieces[slot][0], icon: s.pieces[slot][1], set: sid, slot, tier: s.tier, tag: s.tag,
            hp: Math.round(s.hp * SLOT_SHARE[slot]), speed: s.speed * SLOT_SHARE[slot]
        };
    }
}

// ---------- Verbrauchsgut: zwei Slots im Loadout (Q und G) ----------
// use: heal (sofort/ueber Zeit), throw (auf den Mauszeiger), self (um sich herum)
const UTILS = {
    bandage: { name: 'Bandage', icon: '🩹', tier: 0, use: 'heal', stack: 5, heal: 25, ms: 0, desc: 'Heals 25 HP instantly' },
    medkit: { name: 'Medkit', icon: '💉', tier: 0, use: 'heal', stack: 3, heal: 50, ms: 2000, desc: 'Heals 50 HP over 2 s' },
    frag: { name: 'Frag grenade', icon: '💣', tier: 0, tag: 'demo', use: 'throw', stack: 4, r: 140, dmg: 85, fuse: 1300, desc: 'Explodes after 1.3 s, walls block it' },
    smoke: { name: 'Smoke grenade', icon: '💨', tier: 0, use: 'throw', stack: 3, r: 180, dur: 9000, desc: 'Cloud for 9 s – nobody outside sees you inside' },
    stim: { name: 'Stim', icon: '💊', tier: 1, use: 'heal', stack: 3, heal: 25, ms: 0, speed: 0.3, speedMs: 5000, desc: '+25 HP and 30% speed for 5 s' },
    molotov: { name: 'Molotov', icon: '🍾', tier: 1, tag: 'demo', use: 'throw', stack: 3, r: 115, dur: 5000, dps: 22, desc: 'Fire zone for 5 s, 22 damage per second' },
    flash: { name: 'Flashbang', icon: '🔆', tier: 1, use: 'throw', stack: 3, r: 240, fuse: 900, blind: 2600, desc: 'Blinds everyone who sees it for up to 2.6 s' },
    trauma: { name: 'Trauma kit', icon: '🧰', tier: 2, use: 'heal', stack: 2, heal: 100, ms: 3000, desc: 'Heals 100 HP over 3 s' },
    fireball: { name: 'Fireball scroll', icon: '📜', tier: 2, tag: 'mage', use: 'throw', stack: 2, r: 150, dur: 4000, dps: 30, dmg: 40, desc: 'Impact for 40, then fire for 4 s' },
    cluster: { name: 'Cluster bomb', icon: '🧨', tier: 3, tag: 'demo', use: 'throw', stack: 2, r: 110, dmg: 60, fuse: 1200, bits: 5, desc: 'Explodes and scatters 5 more bombs' },
    frostnova: { name: 'Frost nova', icon: '❄️', tier: 3, tag: 'mage', use: 'self', stack: 2, r: 260, dmg: 30, slow: 0.7, slowMs: 3000, desc: 'Freezes everyone around you (−70% speed, 3 s)' },
    blink: { name: 'Blink scroll', icon: '✴️', tier: 3, tag: 'mage', use: 'self', stack: 2, range: 420, desc: 'Teleports you towards the cursor (420)' },
    phoenix: { name: 'Phoenix elixir', icon: '🐦‍🔥', tier: 4, use: 'heal', stack: 1, full: true, protect: 3000, desc: 'Full heal and 3 s invulnerable' },
    nuke: { name: 'Tactical nuke', icon: '☢️', tier: 5, tag: 'demo', use: 'throw', stack: 1, r: 420, dmg: 320, fuse: 3000, nuke: true, desc: '3 s fuse, 320 damage in a huge radius, walls do not help' },
    blackhole: { name: 'Black hole', icon: '🕳️', tier: 6, tag: 'demo', use: 'throw', stack: 1, r: 300, dmg: 220, pull: 1600, desc: 'Pulls everyone in for 1.6 s, then collapses (220)' }
};
// Im Shop (nur Grundware)
const UTIL_PRICES = { bandage: 80, medkit: 150, frag: 250, smoke: 150 };
const UTIL_SCRAP = { bandage: 5, medkit: 8, frag: 12, smoke: 8 };

const THROW_RANGE = 560;

// ---------- Mods (Special-Effekte) ----------
// Wie viele Effekte ein Item bekommt, ist fuer alle Quellen und Stufen gleich
const EFFECT_N = [0.9, 0.09, 0.0095, 0.0005];

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
// t = Wahrscheinlichkeit je Stufe (Common..Ultra), kinds = Anteil der Arten,
// tag = Themen-Case: so viel Anteil geht an Basen mit diesem Tag
const SOURCES = {
    crate: { t: [0.62, 0.27, 0.09, 0.0189, 0.001, 0.00001, 0], kinds: { weapon: 0.3, armor: 0.3, util: 0.4 } },
    scrapcase: { t: [0.7, 0.24, 0.055, 0.0049, 0.0001, 0, 0], kinds: { weapon: 0.45, armor: 0.35, util: 0.2 } },
    standard: { t: [0.55, 0.3, 0.12, 0.0298, 0.0002, 0, 0], kinds: { weapon: 0.45, armor: 0.35, util: 0.2 } },
    mage: { t: [0.4, 0.33, 0.2, 0.069, 0.001, 0.000005, 0], kinds: { weapon: 0.45, armor: 0.3, util: 0.25 }, tag: 'mage', tagShare: 0.75 },
    demo: { t: [0.4, 0.33, 0.2, 0.069, 0.001, 0.000005, 0], kinds: { weapon: 0.45, armor: 0.2, util: 0.35 }, tag: 'demo', tagShare: 0.75 },
    elite: { t: [0, 0.4, 0.4, 0.19745, 0.0025, 0.00005, 0.000005], kinds: { weapon: 0.45, armor: 0.4, util: 0.15 } },
    sovereign: { t: [0, 0, 0.35, 0.6322333, 1 / 60, 0.001, 0.0001], kinds: { weapon: 0.45, armor: 0.4, util: 0.15 } },
    // Scrap-Shop: Waffe mit garantiert einem Effekt
    modded: { t: [0.6, 0.3, 0.1, 0, 0, 0, 0], kinds: { weapon: 1 }, effects: [0, 0.9, 0.095, 0.005] }
};

const CASES = {
    standard: { name: 'Standard case', icon: '📦', price: 1000, currency: 'coins', source: 'standard', desc: 'Everything, mostly common' },
    mage: { name: 'Mage case', icon: '🔮', price: 3000, currency: 'coins', source: 'mage', desc: 'Mostly staffs, robes and spell scrolls' },
    demo: { name: 'Demolition case', icon: '🧨', price: 3000, currency: 'coins', source: 'demo', desc: 'Launchers, flamethrowers and explosives' },
    elite: { name: 'Elite case', icon: '💎', price: 10000, currency: 'coins', source: 'elite', desc: 'Uncommon or better' },
    sovereign: { name: 'Sovereign case', icon: '👑', price: 100000, currency: 'coins', source: 'sovereign', desc: 'Rare or better – the only real shot at Mythic and Ultra' },
    scrap: { name: 'Scrap case', icon: '🧰', price: 60, currency: 'scrap', source: 'scrapcase', desc: 'Cheap, paid with scrap' }
};

// Shop: Grundwaffen und Grund-Verbrauchsgut (keine Ruestung – die gibt es nur
// aus Cases und Kisten), dazu Scrap-Angebote
const SHOP = [
    ...Object.entries(WEAPON_PRICES).map(([k, p]) => ({ id: 'w_' + k, kind: 'weapon', base: k, price: p, currency: 'coins' })),
    ...Object.entries(UTIL_PRICES).map(([k, p]) => ({ id: 'u_' + k, kind: 'util', base: k, price: p, currency: 'coins' })),
    ...Object.entries(UTIL_SCRAP).map(([k, p]) => ({ id: 's_' + k, kind: 'util', base: k, price: p, currency: 'scrap' })),
    { id: 's_modded', kind: 'gen', source: 'modded', price: 600, currency: 'scrap' }
];

const INV_MAX = 100;

function pickWeighted(entries) {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of entries) {
        r -= w;
        if (r < 0) return k;
    }
    return entries[entries.length - 1][0];
}

let seq = 0;
function uid() {
    return Date.now().toString(36) + (++seq).toString(36) + Math.random().toString(36).slice(2, 6);
}

function defsOf(kind) {
    return kind === 'weapon' ? WEAPONS : kind === 'armor' ? ARMORS : UTILS;
}

// Basis zu einer gewuerfelten Stufe: nur Basen bis zu dieser Stufe; je hoeher
// die eigene Stufe der Basis, desto wahrscheinlicher (Specials setzen sich
// oben durch). Themen-Case: tagShare aus den Basen mit Tag, wenn es welche gibt.
function pickBase(kind, tier, src) {
    const all = Object.entries(defsOf(kind)).filter(([, b]) => b.tier <= tier);
    let pool = all;
    if (src.tag) {
        const tagged = all.filter(([, b]) => b.tag === src.tag);
        if (tagged.length && Math.random() < src.tagShare) pool = tagged;
    }
    return pickWeighted(pool.map(([k, b]) => [k, Math.pow(4, b.tier)]));
}

// Stufe 1..max mit P(L) ~ decay^(L-1)
function rollLevel(m) {
    return pickWeighted(Array.from({ length: m.max }, (_, i) => [i + 1, Math.pow(m.decay, i)]));
}

// Ein neues Item aus einer Quelle
function generate(sourceId) {
    const src = SOURCES[sourceId];
    const kind = pickWeighted(Object.entries(src.kinds));
    const tier = pickWeighted(src.t.map((w, i) => [i, w]).filter(([, w]) => w > 0));
    const base = pickBase(kind, tier, src);
    const mods = [];
    if (kind !== 'util') {
        const n = pickWeighted((src.effects || EFFECT_N).map((w, i) => [i, w]).filter(([, w]) => w > 0));
        const pool = { ...(kind === 'weapon' ? WEAPON_MODS : ARMOR_MODS) };
        for (let i = 0; i < n; i++) {
            const id = pickWeighted(Object.entries(pool).map(([k, m]) => [k, m.w]));
            mods.push({ id, lvl: rollLevel(pool[id]) });
            delete pool[id];
        }
        mods.sort((a, b) => b.lvl - a.lvl);
    }
    return finish({ kind, base, tier: TIERS[tier].id, mods });
}

// Feste Items (Shop, Starter): Common, keine Mods
function plain(kind, base) {
    return finish({ kind, base, tier: 'common', mods: [] }, true);
}

// Vom Admin gebaut: beliebige Basis, Stufe und Mods
function craft(kind, base, tier, mods) {
    return finish({ kind, base, tier: TIERS[tier] ? TIERS[tier].id : TIER_IDX[tier] !== undefined ? tier : 'common', mods: (mods || []).slice().sort((a, b) => b.lvl - a.lvl) });
}

// Effekt-Seltenheit: 1 / P(mindestens so viele Effekte) × 1,5 je Stufe ueber I
function effectFactor(mods) {
    if (!mods || !mods.length) return 1;
    const k = Math.min(mods.length, EFFECT_N.length - 1);
    const p = EFFECT_N.slice(k).reduce((a, b) => a + b, 0);
    return mods.reduce((f, m) => f * Math.pow(1.5, m.lvl - 1), 1 / p);
}

// Coins, die man im Mittel ausgibt, bis etwas mindestens dieser Stufe kommt
const TIER_COST = TIERS.map((_, t) => {
    let best = Infinity;
    for (const c of Object.values(CASES)) {
        if (c.currency !== 'coins') continue;
        const p = SOURCES[c.source].t.slice(t).reduce((a, b) => a + b, 0);
        if (p > 0) best = Math.min(best, c.price / p);
    }
    return best;
});

function finish(item, isPlain) {
    const t = TIER_IDX[item.tier] || 0;
    const f = effectFactor(item.mods);
    const odds = Math.max(1, Math.round(TIER_ODDS[t] * f));
    const bought = isPlain && (WEAPON_PRICES[item.base] || UTIL_PRICES[item.base]);
    const score = Math.round(bought || TIER_COST[t] * f * (item.kind === 'util' ? 0.3 : 1));
    const out = { uid: uid(), ...item, odds, score, name: defsOf(item.kind)[item.base].name, v: 3 };
    if (item.kind === 'armor') out.slot = ARMORS[item.base].slot;
    return out;
}

// Scrap beim Salvagen: nach Stufe und Effekten
function salvageValue(item) {
    if (item.starter) return 0;
    if (item.kind === 'util') return 3 + 4 * (TIER_IDX[item.tier] || 0);
    const t = TIER_IDX[item.tier] || 0;
    return Math.round(8 + 6 * Math.pow(3, t) + (item.mods || []).reduce((s, m) => s + m.lvl * 15, 0));
}

// Alte Items auf Runde 3 bringen: Verbrauchsgut wird 'util', Grade entfaellt
// (die Stufe traegt jetzt die Werte), Seltenheit und Score neu. true = geaendert
const OLD_ARMOR = { light: 'scout_vest', medium: 'soldier_vest', heavy: 'jugg_vest' };
function migrate(item) {
    if (!item || item.v === 3) return false;
    if (item.kind === 'med') { item.kind = 'util'; item.base = 'medkit'; }
    if (item.kind === 'throw') item.kind = 'util';
    if (item.kind === 'armor' && OLD_ARMOR[item.base]) item.base = OLD_ARMOR[item.base];
    if (!defsOf(item.kind)[item.base]) return false;
    if (item.kind === 'armor') item.slot = ARMORS[item.base].slot;
    if (TIER_IDX[item.tier] === undefined) item.tier = 'common';
    if (item.kind === 'util') item.tier = TIERS[UTILS[item.base].tier].id;
    delete item.grade;
    item.mods = item.mods || [];
    const f = finish(item);
    item.odds = f.odds;
    item.score = f.score;
    item.name = f.name;
    item.v = 3;
    return true;
}

// ---------- Werte im Spiel ----------

function lvlOf(item, id) {
    const m = item && item.mods && item.mods.find(x => x.id === id);
    return m ? m.lvl : 0;
}

function weaponStats(item) {
    const b = WEAPONS[item.base] || WEAPONS.pistol;
    const inn = b.innate || {};
    const L = id => lvlOf(item, id) + (inn[id] || 0);
    const bonus = TIER_BONUS[TIER_IDX[item.tier] || 0];
    return {
        ms: b.ms / (1 + L('rapid') * 0.1),
        dmg: b.dmg * (1 + bonus) * (1 + L('sharp') * 0.12),
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
        execute: L('execute') * 0.15,
        flame: !!b.flame
    };
}

// Summe aller Ruestungsteile samt Set-Bonus; gear = { helmet, vest, pants, boots }
function armorStats(gear) {
    const s = { hp: 0, speed: 1, regen: 0, thorns: 0, dodge: 0, dmg: 1, rate: 1, taken: 1, healMul: 1, homing: 0, phantom: false, sets: {} };
    for (const slot of SLOTS) {
        const it = gear && gear[slot];
        if (!it) continue;
        const a = ARMORS[it.base];
        if (!a) continue;
        const L = id => lvlOf(it, id);
        s.hp += a.hp * (1 + TIER_BONUS[TIER_IDX[it.tier] || 0]) + L('plating') * 8;
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
    if (n('medic') >= 4) { s.regen += 4; s.healMul = 2; } else if (n('medic') >= 2) s.regen += 2;
    if (n('mage') >= 4) { s.rate *= 1.1; s.dmg *= 1.1; s.homing = 1; } else if (n('mage') >= 2) s.rate *= 1.1;
    if (n('phantom') >= 2) s.dodge += 0.15;
    if (n('phantom') >= 4) s.phantom = true;
    if (n('titan') >= 4) { s.hp += 150; s.thorns += 0.25; } else if (n('titan') >= 2) s.hp += 60;
    s.hp = Math.round(s.hp);
    return s;
}

// Fuer den Browser: Namen, Icons, Texte, Case-Chancen
function catalog() {
    const mods = (defs) => Object.fromEntries(Object.entries(defs).map(([k, m]) => [k, {
        name: m.name, icon: m.icon, max: m.max, desc: Array.from({ length: m.max }, (_, i) => m.desc(i + 1))
    }]));
    const cases = Object.fromEntries(Object.entries(CASES).map(([k, c]) => [k, { ...c, tiers: SOURCES[c.source].t }]));
    return {
        weapons: WEAPONS, armors: ARMORS, sets: SETS, slots: SLOTS, slotNames: SLOT_NAMES, utils: UTILS, tierBonus: TIER_BONUS,
        weaponMods: mods(WEAPON_MODS), armorMods: mods(ARMOR_MODS),
        cases, shop: SHOP, tiers: TIERS, invMax: INV_MAX
    };
}

module.exports = {
    TIERS, TIER_IDX, TIER_ODDS, TIER_BONUS, WEAPONS, ARMORS, SETS, SLOTS, UTILS, THROW_RANGE, WEAPON_MODS, ARMOR_MODS,
    SOURCES, CASES, SHOP, INV_MAX, generate, plain, craft, salvageValue, weaponStats, armorStats, catalog, migrate, effectFactor
};

// Nachrechnen: node arena-items.js [N] – Verteilung je Quelle
if (require.main === module) {
    const N = Number(process.argv[2]) || 200000;
    console.log('Score je Stufe (Coins):', TIER_COST.map(Math.round).join(' / '));
    for (const src of Object.keys(SOURCES)) {
        const count = {}, bases = {};
        let withMods = 0, two = 0;
        for (let i = 0; i < N; i++) {
            const it = generate(src);
            count[it.tier] = (count[it.tier] || 0) + 1;
            if (TIER_IDX[it.tier] >= 3) bases[it.name] = (bases[it.name] || 0) + 1;
            if (it.mods.length) withMods++;
            if (it.mods.length >= 2) two++;
        }
        console.log(src.padEnd(10), TIERS.map(t => `${t.id} ${count[t.id] ? '1 in ' + Math.round(N / count[t.id]) : '-'}`).join(' · '),
            `| Effekt ${(withMods / N * 100).toFixed(1)}%, zwei ${(two / N * 100).toFixed(2)}%`);
        console.log('   ab Epic:', Object.entries(bases).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', '));
    }
}
