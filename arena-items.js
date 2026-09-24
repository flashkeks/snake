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

const PIERCE_MAX = 2;          // 6.5.1: Durchschlag hoechstens 2 (= 3 Treffer)

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
    // 6.8 (Max: "waaaaay zu op"): 55 ms/9 dmg (164 DPS, 18 Schuss/s – Treffer-Effekte
    // loesten staendig aus) -> 75 ms/9,5 dmg (~127 DPS, 13 Schuss/s), mehr Streuung
    minigun: { name: 'Minigun', icon: '⚙️', tier: 3, ms: 75, dmg: 9.5, speed: 1100, life: 0.8, spread: 0.17, pellets: 1 },
    launcher: { name: 'Launcher', icon: '🚀', tier: 3, tag: 'demo', ms: 1000, dmg: 45, speed: 700, life: 1.4, spread: 0, pellets: 1, explode: 1, rocket: true },
    flamethrower: { name: 'Flamethrower', icon: '🔥', tier: 3, tag: 'demo', ms: 60, dmg: 5, speed: 520, life: 0.42, spread: 0.35, pellets: 1, flame: true, innate: { burn: 2 } },
    stormstaff: { name: 'Storm staff', icon: '🌩️', tier: 3, tag: 'mage', ms: 500, dmg: 34, speed: 1000, life: 1.0, spread: 0.02, pellets: 1, innate: { tesla: 1 } },
    // Railgun: Strahl sofort ueber 3000, durch Waende und alle Gegner
    railgun: { name: 'Railgun', icon: '⚡', tier: 4, ms: 1300, dmg: 250, speed: 3200, life: 0.95, spread: 0, pellets: 1, beam: true },
    arcaneorb: { name: 'Arcane orb', icon: '🔮', tier: 4, tag: 'mage', ms: 300, dmg: 36, speed: 900, life: 1.4, spread: 0.02, pellets: 1, innate: { homing: 2, pierce: 1 } },
    // Fat Boy: Mini-Nuke, 300 Radius, trifft auch den direkt Getroffenen voll
    nukelauncher: { name: 'Fat Boy', icon: '☢️', tier: 5, tag: 'demo', ms: 2500, dmg: 120, speed: 650, life: 1.6, spread: 0, pellets: 1, explode: 4, nukeShell: true },
    archstaff: { name: 'Staff of the Archmage', icon: '🧙', tier: 5, tag: 'mage', ms: 380, dmg: 40, speed: 950, life: 1.3, spread: 0.02, pellets: 1, innate: { multishot: 2, homing: 2, tesla: 1 } },
    // Singularity: jeder Einschlag reisst ein kleines schwarzes Loch auf
    singularity: { name: 'Singularity', icon: '🌀', tier: 6, tag: 'demo', ms: 1600, dmg: 90, speed: 450, life: 2.0, spread: 0, pellets: 1, hole: true, innate: { homing: 2, tesla: 1 } },

    // ---------- 6.6 (Max): zehn neue Grundwaffen, nur Common bis Epic ----------
    uzi: { name: 'Micro Uzi', icon: '🔫', tier: 0, ms: 70, dmg: 7, speed: 950, life: 0.6, spread: 0.13, pellets: 1 },
    carbine: { name: 'Carbine', icon: '🪖', tier: 0, ms: 190, dmg: 19, speed: 1200, life: 0.95, spread: 0.03, pellets: 1 },
    dmr: { name: 'DMR', icon: '🎯', tier: 0, ms: 520, dmg: 48, speed: 1800, life: 1.2, spread: 0.01, pellets: 1 },
    lmg: { name: 'LMG', icon: '⚙️', tier: 0, ms: 105, dmg: 13, speed: 1100, life: 0.9, spread: 0.1, pellets: 1 },
    burst: { name: 'Burst rifle', icon: '🔫', tier: 0, ms: 430, dmg: 15, speed: 1250, life: 0.95, spread: 0.05, pellets: 3 },
    doublebarrel: { name: 'Double barrel', icon: '💥', tier: 0, ms: 950, dmg: 12, speed: 850, life: 0.35, spread: 0.42, pellets: 10 },
    slingshot: { name: 'Slingshot', icon: '🪨', tier: 0, ms: 380, dmg: 22, speed: 700, life: 0.9, spread: 0.02, pellets: 1 },
    nailgun: { name: 'Nail gun', icon: '🔩', tier: 0, ms: 125, dmg: 10, speed: 1000, life: 0.6, spread: 0.06, pellets: 1, innate: { pierce: 1 } },
    knives: { name: 'Throwing knives', icon: '🔪', tier: 0, ms: 300, dmg: 28, speed: 900, life: 0.6, spread: 0.02, pellets: 1 },
    flaregun: { name: 'Flare gun', icon: '🎇', tier: 0, ms: 700, dmg: 24, speed: 800, life: 1.0, spread: 0.02, pellets: 1, innate: { burn: 1 } },
    musket: { name: 'Musket', icon: '🪶', tier: 0, ms: 1400, dmg: 105, speed: 1600, life: 1.2, spread: 0.01, pellets: 1 },

    // ---------- 6.6: Unique-Waffen (Anime), sehr stark, eigene Optik (look) ----------
    // tier = unterste Stufe; es gibt sie nur ab dort aufwaerts (Legendary+, Mythic+, nur Ultra)
    rasengan: { name: 'Rasengan', icon: '🔵', tier: 4, unique: true, ms: 900, dmg: 150, speed: 600, life: 1.3, spread: 0, pellets: 1, explode: 2.4, look: 'rasen', desc: 'A spinning chakra sphere that grinds and bursts (Naruto)' },
    getsuga: { name: 'Zangetsu', icon: '🗡️', tier: 4, unique: true, ms: 750, dmg: 130, speed: 1000, life: 0.9, spread: 0, pellets: 1, wave: true, hitR: 55, look: 'getsuga', desc: 'Getsuga Tensho – a black crescent that cuts through everyone in its path (Bleach)' },
    amaterasu: { name: 'Amaterasu', icon: '👁️', tier: 4, unique: true, ms: 380, dmg: 32, speed: 900, life: 1.0, spread: 0.02, pellets: 1, innate: { burn: 5 }, look: 'amaterasu', desc: 'Black flames that never stop burning (Naruto)' },
    spiritgun: { name: 'Spirit Gun', icon: '👉', tier: 4, unique: true, ms: 650, dmg: 170, speed: 1600, life: 1.2, spread: 0, pellets: 1, explode: 1, look: 'spirit', desc: 'Rei Gun – a finger-shot of pure spirit energy (Yu Yu Hakusho)' },
    gob: { name: 'Gate of Babylon', icon: '🌟', tier: 5, unique: true, ms: 650, dmg: 60, speed: 1300, life: 1.2, spread: 0.5, pellets: 7, portals: true, innate: { homing: 1 }, look: 'gob', desc: 'Golden portals open behind you and rain legendary weapons (Fate)' },
    kamehameha: { name: 'Kamehameha', icon: '🌊', tier: 5, unique: true, ms: 2200, dmg: 560, speed: 3000, life: 0.4, spread: 0, pellets: 1, beam: true, beamW: 60, look: 'kame', desc: 'A massive energy wave through walls and everything in its way (Dragon Ball)' },
    dragonslayer: { name: 'Dragonslayer', icon: '⚔️', tier: 5, unique: true, ms: 1000, dmg: 115, speed: 1100, life: 0.22, spread: 1.2, pellets: 9, look: 'cleave', desc: 'Too big to be called a sword – cleaves everything in front of you (Berserk)' },
    venuzdonoa: { name: 'Venuzdonoa', icon: '⚫', tier: 6, unique: true, ms: 1400, dmg: 950, speed: 3500, life: 0.4, spread: 0, pellets: 1, beam: true, beamW: 44, rift: true, look: 'venuz', desc: 'The sword of the Demon King: destroys even the concept of what it hits (Misfit of Demon King Academy)' },
    hollowpurple: { name: 'Hollow Purple', icon: '🟣', tier: 6, unique: true, ms: 3000, dmg: 750, speed: 520, life: 3.2, spread: 0, pellets: 1, erase: true, hitR: 110, look: 'purple', desc: 'Imaginary technique: erases everything it touches, walls included (Jujutsu Kaisen)' }
};
// Obergrenze der Stufe je Basis (6.6, Max: keine legendaere Pistole). Grundware
// (tier 0) hoechstens Epic, tier 1 hoechstens Legendary, sonst offen.
const UNIQUE_W = 0.12;
const maxTierOf = b => b.max !== undefined ? b.max : b.tier === 0 ? 3 : b.tier === 1 ? 4 : 6;
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
// 6.6 (Max): Einzelteile ohne Set, dazu Anime-Uniques. fx = Extra-Werte
// (dmg/rate Faktor, regen HP/s, dodge/thorns/crit Anteil, taken Faktor).
// full = Ganzkoerper: zaehlt fuer alle vier Slots, andere Teile wirken dann nicht.
Object.assign(ARMORS, {
    kevlar: { name: 'Kevlar vest', icon: '🦺', slot: 'vest', tier: 0, hp: 32, speed: 0 },
    bikehelmet: { name: 'Bike helmet', icon: '⛑️', slot: 'helmet', tier: 0, hp: 12, speed: 0.01 },
    kneepads: { name: 'Knee pads', icon: '🦵', slot: 'pants', tier: 0, hp: 10, speed: 0.01 },
    runners: { name: 'Running shoes', icon: '👟', slot: 'boots', tier: 0, hp: 4, speed: 0.05 },
    riothelmet: { name: 'Riot helmet', icon: '🪖', slot: 'helmet', tier: 1, hp: 26, speed: -0.01, fx: { taken: 0.97 }, desc: '3% less damage taken' },
    ghillie: { name: 'Ghillie pants', icon: '🌿', slot: 'pants', tier: 1, hp: 12, speed: 0, fx: { dodge: 0.04 }, desc: '4% dodge' },
    scouter: { name: 'Scouter', icon: '🥽', slot: 'helmet', tier: 4, unique: true, hp: 22, speed: 0, fx: { crit: 0.08 }, desc: '+8% crit chance – it reads their power level (Dragon Ball)' },
    strawhat: { name: 'Straw Hat', icon: '👒', slot: 'helmet', tier: 4, unique: true, hp: 30, speed: 0.08, fx: { dodge: 0.06 }, desc: '+8% speed, 6% dodge – the hat of the future Pirate King (One Piece)' },
    odm: { name: 'ODM Gear', icon: '🪝', slot: 'boots', tier: 4, unique: true, hp: 25, speed: 0.2, desc: '+20% speed – omni-directional mobility (Attack on Titan)' },
    hokage: { name: 'Hokage Cloak', icon: '🧥', slot: 'vest', tier: 4, unique: true, hp: 90, speed: 0, fx: { regen: 3 }, desc: '+3 HP/s regeneration (Naruto)' },
    kamina: { name: "Kamina's Shades", icon: '🕶️', slot: 'helmet', tier: 5, unique: true, hp: 40, speed: 0.03, fx: { dmg: 1.15, rate: 1.1 }, desc: '+15% damage, +10% fire rate – who the hell do you think we are (Gurren Lagann)' },
    saitama: { name: "Saitama's Cape", icon: '🦸', slot: 'vest', tier: 5, unique: true, hp: 60, speed: 0.05, fx: { dmg: 1.35 }, desc: '+35% damage – just a hero for fun (One Punch Man)' },
    ironman: { name: 'Iron Man Suit', icon: '🤖', slot: 'vest', tier: 6, unique: true, full: true, hp: 420, speed: 0.12, fx: { dmg: 1.2, dodge: 0.1, thorns: 0.15 }, desc: 'Full body: +420 HP, +12% speed, +20% damage, 10% dodge, reflects 15%' },
    susanoo: { name: 'Susanoo', icon: '👹', slot: 'vest', tier: 6, unique: true, full: true, hp: 600, speed: -0.05, fx: { taken: 0.7, regen: 5 }, desc: 'Full body: +600 HP, 30% less damage, +5 HP/s – the ultimate defense (Naruto)' }
});

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
    blackhole: { name: 'Black hole', icon: '🕳️', tier: 6, tag: 'demo', use: 'throw', stack: 1, r: 300, dmg: 220, pull: 1600, desc: 'Pulls everyone in for 1.6 s, then collapses (220)' },
    // 6.6: mehr Verbrauchsgut bis Ultra; die seltenen sind absichtlich absurd stark
    energy: { name: 'Energy drink', icon: '🥫', tier: 0, use: 'heal', stack: 4, heal: 15, ms: 0, speed: 0.2, speedMs: 4000, desc: '+15 HP and 20% speed for 4 s' },
    sticky: { name: 'Sticky bomb', icon: '🧷', tier: 1, tag: 'demo', use: 'throw', stack: 3, r: 120, dmg: 115, fuse: 1800, desc: 'Sticks where it lands, explodes after 1.8 s (115)' },
    adrenaline: { name: 'Adrenaline shot', icon: '💉', tier: 2, use: 'heal', stack: 2, heal: 60, ms: 0, speed: 0.4, speedMs: 4000, desc: '+60 HP and 40% speed for 4 s' },
    chidori: { name: 'Chidori', icon: '⚡', tier: 4, use: 'self', stack: 1, range: 520, dmg: 280, desc: 'Lightning dash to the cursor – 280 damage to everything on the way (Naruto)' },
    senzu: { name: 'Senzu Bean', icon: '🫘', tier: 5, use: 'heal', stack: 1, full: true, protect: 5000, speed: 0.3, speedMs: 8000, desc: 'Full heal, 5 s invulnerable, +30% speed for 8 s (Dragon Ball)' },
    genkidama: { name: 'Spirit Bomb', icon: '🌕', tier: 5, tag: 'demo', use: 'throw', stack: 1, r: 400, dmg: 750, fuse: 2600, desc: 'Everyone lends you energy: 750 damage in a huge radius (Dragon Ball)' },
    infinitevoid: { name: 'Infinite Void', icon: '♾️', tier: 6, use: 'self', stack: 1, r: 700, stun: 6000, desc: 'Domain Expansion: every enemy around you freezes for 6 s and takes 50% more damage (Jujutsu Kaisen)' },
    worldender: { name: 'World Ender', icon: '☄️', tier: 6, tag: 'demo', use: 'throw', stack: 1, r: 99999, fuse: 4500, world: true, desc: '4.5 s countdown, then EVERYTHING on the map dies – except you and your team' }
};
// ---------- Rucksaecke: eigener Slot, bestimmen den Platz im Raid ----------
const BASE_PACK = 12;            // Plaetze ohne Rucksack
const PACKS = {
    daypack: { name: 'Daypack', icon: '🎒', tier: 0, cap: 18 },
    fieldpack: { name: 'Field pack', icon: '🎒', tier: 1, cap: 22 },
    assaultpack: { name: 'Assault pack', icon: '🎒', tier: 2, cap: 26 },
    expedition: { name: 'Expedition pack', icon: '🧳', tier: 3, cap: 32 },
    holding: { name: 'Bag of holding', icon: '👜', tier: 4, cap: 40 },
    voidsatchel: { name: 'Void satchel', icon: '🌌', tier: 5, cap: 50 }
};
const PACK_PRICES = { daypack: 500 };

// Im Shop (nur Grundware)
const UTIL_PRICES = { bandage: 80, medkit: 150, frag: 250, smoke: 150 };
const UTIL_SCRAP = { bandage: 5, medkit: 8, frag: 12, smoke: 8 };

const THROW_RANGE = 560;

// ---------- Mods (Special-Effekte) ----------
// Wie viele Effekte ein Item bekommt, ist fuer alle Quellen und Stufen gleich
// 6.6 (Max): ein Effekt 20 %, zwei ~2 %, drei ~0,1 % (vorher 9 / 0,95 / 0,05 %)
const EFFECT_N = [0.779, 0.2, 0.02, 0.001];

const WEAPON_MODS = {
    sharp: { name: 'Sharp', icon: '🗡️', w: 30, max: 5, decay: 0.3, desc: l => `+${l * 12}% damage` },
    rapid: { name: 'Rapid', icon: '⚡', w: 30, max: 5, decay: 0.3, desc: l => `+${l * 10}% fire rate` },
    velocity: { name: 'Velocity', icon: '💨', w: 22, max: 3, decay: 0.3, desc: l => `+${l * 25}% bullet speed and range` },
    crit: { name: 'Critical', icon: '🎯', w: 20, max: 3, decay: 0.25, desc: l => `${l * 12}% chance for double damage` },
    multishot: { name: 'Multishot', icon: '🔱', w: 12, max: 4, decay: 0.15, desc: l => `+${l} extra bullet${l > 1 ? 's' : ''} per shot` },
    pierce: { name: 'Piercing', icon: '📌', w: 12, max: 3, decay: 0.2, desc: l => `bullets pass through ${Math.min(l, PIERCE_MAX)} target${l > 1 ? 's' : ''} (max ${PIERCE_MAX} per bullet)` },
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
    // Kisten auf der Map: nur Granaten und Heilung (Max: Inventar lief sonst zu schnell voll)
    crate: { t: [0.62, 0.27, 0.09, 0.0189, 0.001, 0.00001, 0], kinds: { util: 1 }, uses: ['heal', 'throw'] },
    // 6.6 (Max): bessere Kisten auf der Map (selten, wechseln beim Nachfuellen)
    // 6.10 (Max: Avalon zieht ein Legendary nach dem anderen): Legendary+ gekappt.
    // Vorher 1,4 % Legendary+ je geoeffneter Kiste im Schnitt (fast ein Sovereign-
    // Item, gratis); jetzt ~0,4 %. Was wegfaellt, geht an Epic.
    //   crate2 Leg 3,7 -> 0,8 %, Myth 0,3 -> 0,03 %
    //   crate3 Leg 10 -> 3 %, Myth 1,8 -> 0,2 %, Ultra 0,2 -> 0,02 %
    // 6.10.2 (Max, Legendary+ je Ereignis): blau 0,84 -> ~0,3 %, gold 6,6 -> ~0,9 %,
    // Militaerkiste 1,2 -> ~0,75 %, Supply Drop 4,6 -> ~1,1 %; Rest jeweils an Epic
    crate2: { t: [0.15, 0.38, 0.3, 0.167037, 0.002856, 0.000107, 0], kinds: { util: 1 }, uses: ['heal', 'throw'] },
    crate3: { t: [0, 0.15, 0.4, 0.445672, 0.004032, 0.000269, 2.7e-05], kinds: { util: 0.5, weapon: 0.25, armor: 0.2, pack: 0.05 } },
    // Seltene Gegner-Beute (Stufe 2 von 3); Stufe 3 zieht aus 'boss'
    // 6.10: wie crate2 gekappt (Leg 3,7 -> 0,8 %, Myth 0,3 -> 0,03 %)
    npcrare: { t: [0.1, 0.35, 0.33, 0.2117, 0.008, 0.0003, 0], kinds: { util: 0.4, weapon: 0.3, armor: 0.25, pack: 0.05 } },
    // Versorgungsabwurf: Ausruestung, etwas besser als eine Standard-Case
    airdrop: { t: [0.3, 0.38, 0.2, 0.115232, 0.004649, 0.000119, 0], kinds: { weapon: 0.45, armor: 0.45, pack: 0.1 } },
    // Normale Gegner (4.1): meist Verbrauchsgut, selten Ausruestung
    npcdrop: { t: [0.62, 0.27, 0.09, 0.0189, 0.001, 0.00001, 0], kinds: { util: 0.55, weapon: 0.22, armor: 0.18, pack: 0.05 }, uses: null },
    // Militaerkisten im Lager der Enforcer: nur Ausruestung, wie eine Standard-Case
    military: { t: [0.45, 0.33, 0.15, 0.06386, 0.005833, 0.000307, 0], kinds: { weapon: 0.5, armor: 0.45, pack: 0.05 } },
    // Boss: Sovereign-Stufen, aber nur Ausruestung
    // 6.10.1 (Max: Boss seit 6.9 viel oefter -> Legendarys am laufenden Band):
    // Legendary+ je Item 1,78 % -> 0,4 % (etwa 1/250), Rest an Epic.
    // Gilt auch fuer die Top-Gegner-Beute (1 in 50) – die zieht aus 'boss'.
    boss: { t: [0, 0, 0.35, 0.64597, 0.0037, 0.0003, 0.00003], kinds: { weapon: 0.5, armor: 0.4, pack: 0.1 } },
    scrapcase: { t: [0.7, 0.24, 0.055, 0.0049, 0.0001, 0, 0], kinds: { weapon: 0.45, armor: 0.28, util: 0.2, pack: 0.07 } },
    standard: { t: [0.55, 0.3, 0.12, 0.0298, 0.0002, 0, 0], kinds: { weapon: 0.45, armor: 0.28, util: 0.2, pack: 0.07 } },
    mage: { t: [0.4, 0.33, 0.2, 0.069, 0.001, 0.000005, 0], kinds: { weapon: 0.45, armor: 0.25, util: 0.25, pack: 0.05 }, tag: 'mage', tagShare: 0.75 },
    demo: { t: [0.4, 0.33, 0.2, 0.069, 0.001, 0.000005, 0], kinds: { weapon: 0.45, armor: 0.15, util: 0.35, pack: 0.05 }, tag: 'demo', tagShare: 0.75 },
    elite: { t: [0, 0.4, 0.4, 0.19745, 0.0025, 0.00005, 0.000005], kinds: { weapon: 0.45, armor: 0.33, util: 0.15, pack: 0.07 } },
    // 5.2b (Max): Elite nur Waffen / nur Ruestung (samt Rucksaecken)
    elite_w: { t: [0, 0.4, 0.4, 0.19745, 0.0025, 0.00005, 0.000005], kinds: { weapon: 1 } },
    elite_a: { t: [0, 0.4, 0.4, 0.19745, 0.0025, 0.00005, 0.000005], kinds: { armor: 0.85, pack: 0.15 } },
    // Die drei als 50k-Variante: ein Viertel des Wegs von Elite (10k) zu
    // Sovereign (100k) – bewusst nicht mittig, sonst waere 50k fuer Waffen
    // mehr Meta als die 100k-Case. t = elite + 0.25 * (sovereign - elite)
    elite50: { t: [0, 0.3, 0.3875, 0.30614583, 0.00604167, 0.0002875, 0.00002875], kinds: { weapon: 0.45, armor: 0.33, util: 0.15, pack: 0.07 } },
    elite_w50: { t: [0, 0.3, 0.3875, 0.30614583, 0.00604167, 0.0002875, 0.00002875], kinds: { weapon: 1 } },
    elite_a50: { t: [0, 0.3, 0.3875, 0.30614583, 0.00604167, 0.0002875, 0.00002875], kinds: { armor: 0.85, pack: 0.15 } },
    sovereign: { t: [0, 0, 0.35, 0.6322333, 1 / 60, 0.001, 0.0001], kinds: { weapon: 0.45, armor: 0.33, util: 0.15, pack: 0.07 } },
    // 6.10.2 (Max, Legendary+ je Ereignis): Capture the Flag eigene Quelle mit
    // Sovereign-Arten, aber Legendary+ nur ~1 % je Beutel (vorher 3,9 %)
    ctf: { t: [0, 0, 0.35, 0.645446, 0.004272, 0.000256, 2.6e-05], kinds: { weapon: 0.45, armor: 0.33, util: 0.15, pack: 0.07 } },
    // Mystery Box im Zombie-Modus (6.10, Max: jetzt wo sie teuer ist): nur
    // Waffen, Legendary und hoeher doppelt so oft wie Elite/Sovereign; der
    // Aufschlag kommt aus der untersten Stufe
    zbox: { t: [0, 0.397445, 0.4, 0.19745, 0.005, 0.0001, 0.00001], kinds: { weapon: 1 } },
    zbox_s: { t: [0, 0, 0.33223337, 0.6322333, 1 / 30, 0.002, 0.0002], kinds: { weapon: 1 } },
    // Utility-Kiste im Zombie-Modus (6.10, Max): gleiche Stufen-Chancen wie die
    // Waffen-Box. `exact`: die gewuerfelte Stufe ist die Stufe des Items (sonst
    // wuerde pickBase auch alles darunter nehmen und die Chancen verwaschen)
    zubox: { t: [0, 0.397445, 0.4, 0.19745, 0.005, 0.0001, 0.00001], kinds: { util: 1 }, exact: true },
    zubox_s: { t: [0, 0, 0.33223337, 0.6322333, 1 / 30, 0.002, 0.0002], kinds: { util: 1 }, exact: true },
    // Scrap-Shop: Waffe mit garantiert einem Effekt
    modded: { t: [0.6, 0.3, 0.1, 0, 0, 0, 0], kinds: { weapon: 1 }, effects: [0, 0.9, 0.095, 0.005] }
};

const CASES = {
    standard: { name: 'Standard case', icon: '📦', price: 1000, currency: 'coins', source: 'standard', desc: 'Everything, mostly common' },
    demo: { name: 'Demolition case', icon: '🧨', price: 3000, currency: 'coins', source: 'demo', desc: 'Launchers, flamethrowers and explosives' },
    // Mage case raus (5.2b, Max); Elite gibt es jetzt allgemein, nur Waffen, nur Ruestung – je 10k und 50k
    elite: { name: 'Elite case General', icon: '💎', price: 10000, currency: 'coins', source: 'elite', desc: 'Uncommon or better – everything can drop' },
    elite_w: { name: 'Elite case Weapons', icon: '🔫', price: 10000, currency: 'coins', source: 'elite_w', desc: 'Uncommon or better – weapons only' },
    elite_a: { name: 'Elite case Armor', icon: '🛡️', price: 10000, currency: 'coins', source: 'elite_a', desc: 'Uncommon or better – armor and backpacks only' },
    elite50: { name: 'Elite+ case General', icon: '💠', price: 50000, currency: 'coins', source: 'elite50', desc: 'Better odds than Elite – everything can drop' },
    elite_w50: { name: 'Elite+ case Weapons', icon: '🎯', price: 50000, currency: 'coins', source: 'elite_w50', desc: 'Better odds than Elite – weapons only' },
    elite_a50: { name: 'Elite+ case Armor', icon: '🏰', price: 50000, currency: 'coins', source: 'elite_a50', desc: 'Better odds than Elite – armor and backpacks only' },
    sovereign: { name: 'Sovereign case', icon: '👑', price: 100000, currency: 'coins', source: 'sovereign', desc: 'Rare or better – the only real shot at Mythic and Ultra' },
    scrap: { name: 'Scrap case', icon: '🧰', price: 60, currency: 'scrap', source: 'scrapcase', desc: 'Cheap, paid with scrap' },
    // 6.1: nur aus dem Daily Case Wheel (wheel: true), Chancen wie der Sovereign case
    jackpot: { name: 'Jackpot case', icon: '🎰', price: 100000, currency: 'coins', source: 'sovereign', desc: 'Only from the Daily Case Wheel – Sovereign odds', wheel: true }
};

// Shop: Grundwaffen und Grund-Verbrauchsgut (keine Ruestung – die gibt es nur
// aus Cases und Kisten), dazu Scrap-Angebote
const SHOP = [
    ...Object.entries(WEAPON_PRICES).map(([k, p]) => ({ id: 'w_' + k, kind: 'weapon', base: k, price: p, currency: 'coins' })),
    ...Object.entries(UTIL_PRICES).map(([k, p]) => ({ id: 'u_' + k, kind: 'util', base: k, price: p, currency: 'coins' })),
    ...Object.entries(PACK_PRICES).map(([k, p]) => ({ id: 'p_' + k, kind: 'pack', base: k, price: p, currency: 'coins' })),
    ...Object.entries(UTIL_SCRAP).map(([k, p]) => ({ id: 's_' + k, kind: 'util', base: k, price: p, currency: 'scrap' }))
    // 6.11 (Max): „Weapon with a random effect" (s_modded, 600 Scrap) raus –
    // Effekte gibt es jetzt ueber Fuse; die Quelle 'modded' bleibt fuer alte Verweise
];

// 6.10 (Max): Lager 100 -> 200
const INV_MAX = 200;

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
    return kind === 'weapon' ? WEAPONS : kind === 'armor' ? ARMORS : kind === 'pack' ? PACKS : UTILS;
}

// Basis zu einer gewuerfelten Stufe: nur Basen bis zu dieser Stufe; je hoeher
// die eigene Stufe der Basis, desto wahrscheinlicher (Specials setzen sich
// oben durch). Themen-Case: tagShare aus den Basen mit Tag, wenn es welche gibt.
function pickBase(kind, tier, src) {
    let all = Object.entries(defsOf(kind)).filter(([, b]) => b.tier <= tier && (kind === 'util' || kind === 'pack' || maxTierOf(b) >= tier));
    if (src.uses) all = all.filter(([, b]) => src.uses.includes(b.use));
    if (src.exact && all.some(([, b]) => b.tier === tier)) all = all.filter(([, b]) => b.tier === tier);
    let pool = all;
    if (src.tag) {
        const tagged = all.filter(([, b]) => b.tag === src.tag);
        if (tagged.length && Math.random() < src.tagShare) pool = tagged;
    }
    // Uniques (6.6) sind auch innerhalb ihrer Stufe selten
    return pickWeighted(pool.map(([k, b]) => [k, Math.pow(4, b.tier) * (b.unique ? UNIQUE_W : 1)]));
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
    if (kind === 'weapon' || kind === 'armor') {
        const n = pickWeighted((src.effects || EFFECT_N).map((w, i) => [i, w]).filter(([, w]) => w > 0));
        const pool = { ...(kind === 'weapon' ? WEAPON_MODS : ARMOR_MODS) };
        for (let i = 0; i < n; i++) {
            const id = pickWeighted(Object.entries(pool).map(([k, m]) => [k, m.w]));
            mods.push({ id, lvl: rollLevel(pool[id]) });
            delete pool[id];
        }
        mods.sort((a, b) => b.lvl - a.lvl);
    }
    // Verbrauchsgut und Rucksaecke haben immer die Stufe ihrer Basis
    const t = kind === 'util' || kind === 'pack' ? defsOf(kind)[base].tier : tier;
    return finish({ kind, base, tier: TIERS[t].id, mods });
}

// Feste Items (Shop, Starter): Common, keine Mods
// 6.10.2 (Max: „Chidori jetzt Common?"): Verbrauchsgut und Rucksaecke haben
// immer die Stufe ihrer Basis. Vorher kam hier fest 'common' raus – und ueber
// plain() werden Verbrauchsgut-Slots nach dem Raid wieder zu Items gemacht,
// aus einem legendaeren Chidori wurde so ein „Common"-Chidori.
function plain(kind, base) {
    const tier = kind === 'util' || kind === 'pack' ? TIERS[defsOf(kind)[base].tier].id : 'common';
    return finish({ kind, base, tier, mods: [] }, true);
}

// ---------- Fuse (6.11, Max) ----------
// Eine Hauptwaffe frisst beliebig viele Waffen derselben Basis. Je gefressener
// Waffe und je Effekt darauf:
//   - Effekt hat die Hauptwaffe schon: gleiche Stufe -> garantiert +1,
//     sonst die hoehere der beiden Stufen (hoechstens das Maximum des Effekts)
//   - neuer Effekt: kommt mit FUSE_ADD[Anzahl bisher] dazu – als 2. Effekt 10 %,
//     als 3. 1 %; der 1. Effekt (Waffe ohne Effekt) 50 %. Mehr als 3 gehen nicht.
// Stufe (Seltenheit) der Hauptwaffe bleibt, Odds/Score werden neu gerechnet.
const FUSE_COST = 500, FUSE_ADD = [0.5, 0.1, 0.01], FUSE_MAX_MODS = 3;
function fuse(main, others, rnd = Math.random) {
    const mods = (main.mods || []).map(m => ({ ...m }));
    const log = [];
    for (const o of others) {
        for (const m of o.mods || []) {
            const def = WEAPON_MODS[m.id];
            if (!def) continue;
            const have = mods.find(x => x.id === m.id);
            if (have) {
                const lvl = Math.min(def.max, have.lvl === m.lvl ? have.lvl + 1 : Math.max(have.lvl, m.lvl));
                if (lvl > have.lvl) log.push({ id: m.id, from: have.lvl, to: lvl });
                have.lvl = lvl;
            } else if (mods.length < FUSE_MAX_MODS) {
                if (rnd() < FUSE_ADD[mods.length]) {
                    mods.push({ id: m.id, lvl: m.lvl });
                    log.push({ id: m.id, from: 0, to: m.lvl });
                } else log.push({ id: m.id, fail: true });
            }
        }
    }
    mods.sort((a, b) => b.lvl - a.lvl);
    const f = finish({ kind: main.kind, base: main.base, tier: main.tier, mods });
    return { item: { ...main, mods, odds: f.odds, score: f.score }, log };
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
    const bought = isPlain && (WEAPON_PRICES[item.base] || UTIL_PRICES[item.base] || PACK_PRICES[item.base]);
    const score = Math.round(bought || TIER_COST[t] * f * (item.kind === 'util' ? 0.3 : 1));
    const out = { uid: uid(), ...item, odds, score, name: defsOf(item.kind)[item.base].name, v: 3 };
    if (item.kind === 'armor') out.slot = ARMORS[item.base].slot;
    return out;
}

// Scrap beim Salvagen: nach Stufe und Effekten
function salvageValue(item) {
    if (item.starter) return 0;
    // 23.09.2026 etwa auf 40 % gesenkt (Max: zu viel Scrap)
    if (item.kind === 'util') return 1 + 2 * (TIER_IDX[item.tier] || 0);
    if (item.kind === 'pack') return 4 + 3 * Math.pow(3, TIER_IDX[item.tier] || 0);
    const t = TIER_IDX[item.tier] || 0;
    return Math.round(3 + 2.5 * Math.pow(3, t) + (item.mods || []).reduce((s, m) => s + m.lvl * 6, 0));
}

// Alte Items auf Runde 3 bringen: Verbrauchsgut wird 'util', Grade entfaellt
// (die Stufe traegt jetzt die Werte), Seltenheit und Score neu. true = geaendert
const OLD_ARMOR = { light: 'scout_vest', medium: 'soldier_vest', heavy: 'jugg_vest' };
function migrate(item) {
    // 6.10.2: durch den plain()-Fehler falsch gestufte Verbrauchsgueter/Rucksaecke reparieren
    if (item && item.v === 3 && (item.kind === 'util' || item.kind === 'pack') && defsOf(item.kind)[item.base]) {
        const want = TIERS[defsOf(item.kind)[item.base].tier].id;
        if (item.tier === want) return false;
        item.tier = want;
        const f = finish(item);
        item.odds = f.odds;
        item.score = f.score;
        return true;
    }
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
        // 6.5.1 (Max): hoechstens 3 Gegner je Kugel – Flaechenschaden gibt es ueber Explosives
        pierce: Math.min(PIERCE_MAX, L('pierce')),
        bounce: L('ricochet'),
        crit: L('crit') * 0.12,
        burn: L('burn') * 6,
        frost: L('frost') * 0.25,
        vamp: L('vampire') * 0.12,
        explode: (b.explode || 0) + L('explosive') * 0.35,
        homing: L('homing'),
        tesla: L('tesla'),
        execute: L('execute') * 0.15,
        flame: !!b.flame,
        beam: !!b.beam,
        nukeShell: !!b.nukeShell,
        hole: !!b.hole,
        rocket: !!b.rocket,
        magic: b.tag === 'mage',
        // 6.6 Uniques
        look: b.look || 0, wave: !!b.wave, erase: !!b.erase, hitR: b.hitR || 0, portals: !!b.portals, rift: !!b.rift, beamW: b.beamW || 0
    };
}

// Summe aller Ruestungsteile samt Set-Bonus; gear = { helmet, vest, pants, boots }
function armorStats(gear) {
    const s = { hp: 0, speed: 1, regen: 0, thorns: 0, dodge: 0, dmg: 1, rate: 1, taken: 1, healMul: 1, homing: 0, crit: 0, phantom: false, sets: {} };
    // Ganzkoerper-Ruestung (6.6): nur sie zaehlt
    const fullSlot = SLOTS.find(sl => gear && gear[sl] && ARMORS[gear[sl].base] && ARMORS[gear[sl].base].full);
    for (const slot of SLOTS) {
        const it = gear && gear[slot];
        if (!it) continue;
        if (fullSlot && slot !== fullSlot) continue;
        const a = ARMORS[it.base];
        if (!a) continue;
        if (a.fx) {
            s.dmg *= a.fx.dmg || 1;
            s.rate *= a.fx.rate || 1;
            s.taken *= a.fx.taken || 1;
            s.regen += a.fx.regen || 0;
            s.dodge += a.fx.dodge || 0;
            s.thorns += a.fx.thorns || 0;
            s.crit += a.fx.crit || 0;
        }
        const L = id => lvlOf(it, id);
        s.hp += a.hp * (1 + TIER_BONUS[TIER_IDX[it.tier] || 0]) + L('plating') * 8;
        s.speed += a.speed + L('swift') * 0.03;
        s.regen += L('regen');
        s.thorns += L('thorns') * 0.05;
        s.dodge += L('dodge') * 0.03;
        if (a.set) s.sets[a.set] = (s.sets[a.set] || 0) + 1;
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
        weapons: WEAPONS, armors: ARMORS, sets: SETS, slots: SLOTS, slotNames: SLOT_NAMES, utils: UTILS, packs: PACKS, basePack: BASE_PACK, tierBonus: TIER_BONUS,
        weaponMods: mods(WEAPON_MODS), armorMods: mods(ARMOR_MODS),
        cases, shop: SHOP, tiers: TIERS, invMax: INV_MAX, fuse: { cost: FUSE_COST, add: FUSE_ADD, maxMods: FUSE_MAX_MODS },
        maxTier: { weapon: Object.fromEntries(Object.entries(WEAPONS).map(([k, b]) => [k, maxTierOf(b)])), armor: Object.fromEntries(Object.entries(ARMORS).map(([k, b]) => [k, maxTierOf(b)])) }
    };
}

module.exports = {
    TIERS, TIER_IDX, TIER_ODDS, TIER_BONUS, WEAPONS, ARMORS, SETS, SLOTS, UTILS, PACKS, BASE_PACK, THROW_RANGE, WEAPON_MODS, ARMOR_MODS,
    SOURCES, CASES, SHOP, INV_MAX, fuse, FUSE_COST, FUSE_ADD, FUSE_MAX_MODS, maxTierOf, generate, plain, craft, salvageValue, weaponStats, armorStats, catalog, migrate, effectFactor
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
