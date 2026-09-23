// Kekemon (5.0): Sammelkarten aus Anime-, Comic-/Film- und Serien-Charakteren.
//
// Rohdaten kommen aus tools/cards/build.js (DATA_DIR/cards-raw.json, im
// Backup). Hier wird daraus die eigentliche Karte gerechnet – deterministisch
// aus der Karten-Id, also bei gleichen Daten immer dieselbe Karte:
//   Typ       aus Genres (Anime/Serie) bzw. staerkstem Kampfwert (Helden)
//   Seltenheit aus dem Beliebtheitsrang innerhalb der Reihe
//   Werte     HP, ATK, DEF, SPD nach Seltenheit (Helden: aus powerstats)
//   Attacken  zwei, mit Energiekosten, Schaden und Effekt
// Gibt es keine Rohdaten (lokaler Test), nimmt es tools/cards/fixture.json.

const fs = require('fs');
const path = require('path');

const TYPES = {
    fire: { name: 'Fire', icon: '🔥', color: '#ff6b3d', weak: 'water' },
    water: { name: 'Water', icon: '💧', color: '#3da5ff', weak: 'electric' },
    electric: { name: 'Electric', icon: '⚡', color: '#ffd23f', weak: 'nature' },
    nature: { name: 'Nature', icon: '🌿', color: '#4cd964', weak: 'fire' },
    psychic: { name: 'Psychic', icon: '🔮', color: '#c77dff', weak: 'dark' },
    dark: { name: 'Dark', icon: '🌑', color: '#6b5b95', weak: 'light' },
    light: { name: 'Light', icon: '✨', color: '#fff3b0', weak: 'dark' },
    fighting: { name: 'Fighting', icon: '👊', color: '#e0823d', weak: 'psychic' },
    steel: { name: 'Steel', icon: '⚙️', color: '#a8b3c4', weak: 'fire' }
};

const RARITIES = [
    { id: 'common', name: 'Common', upTo: 0.40, color: '#cfd8e3' },
    { id: 'uncommon', name: 'Uncommon', upTo: 0.65, color: '#7dffb0' },
    { id: 'rare', name: 'Rare', upTo: 0.84, color: '#3da5ff' },
    { id: 'epic', name: 'Epic', upTo: 0.95, color: '#b884ff' },
    { id: 'legendary', name: 'Legendary', upTo: 0.99, color: '#ffd23f' },
    { id: 'secret', name: 'Secret Rare', upTo: 1, color: '#ff5bd6' }
];
const RIDX = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]));

const SETS = {
    anime: { name: 'Anime', code: 'AN', icon: '🌸' },
    hero: { name: 'Heroes & Villains', code: 'HV', icon: '🦸' },
    tv: { name: 'Series', code: 'TV', icon: '📺' }
};

// Genre -> Typ (Anime und Serien)
const GENRE_TYPE = {
    Action: 'fighting', Sports: 'fighting', Adventure: 'nature', 'Slice of Life': 'nature', Nature: 'nature',
    Comedy: 'light', Romance: 'light', 'Mahou Shoujo': 'light', Music: 'light', Family: 'light',
    Drama: 'water', Medical: 'water', Legal: 'water',
    Fantasy: 'psychic', Supernatural: 'psychic', Psychological: 'psychic',
    Horror: 'dark', Mystery: 'dark', Thriller: 'dark', Crime: 'dark', Espionage: 'dark',
    'Sci-Fi': 'electric', 'Science-Fiction': 'electric', Mecha: 'steel', War: 'steel', Western: 'steel',
    Ecchi: 'fire', 'Anime': 'fire'
};

// Attacken je Typ: [Name, Effekt]
const MOVES = {
    fire: { basic: ['Ember', 'Flame Jab', 'Heat Slash', 'Spark Kick'], big: [['Inferno Burst', 'burn'], ['Phoenix Blaze', 'burn'], ['Meteor Flame', 'pierce'], ['Solar Flare', 'none']] },
    water: { basic: ['Splash', 'Aqua Jab', 'Tide Slap', 'Bubble Shot'], big: [['Tsunami', 'none'], ['Hydro Cannon', 'pierce'], ['Healing Rain', 'heal'], ['Whirlpool', 'stun']] },
    electric: { basic: ['Zap', 'Static Punch', 'Volt Tap', 'Shock Wave'], big: [['Thunderstrike', 'stun'], ['Railgun', 'pierce'], ['Overload', 'none'], ['Plasma Storm', 'burn']] },
    nature: { basic: ['Vine Whip', 'Leaf Cut', 'Root Grab', 'Pollen Puff'], big: [['Solar Beam', 'none'], ['Gaia Force', 'heal'], ['Thorn Storm', 'drain'], ['Wild Stampede', 'stun']] },
    psychic: { basic: ['Mind Poke', 'Psy Ray', 'Foresight', 'Mental Jab'], big: [['Psychic Crush', 'pierce'], ['Mind Break', 'stun'], ['Astral Drain', 'drain'], ['Reality Warp', 'none']] },
    dark: { basic: ['Shadow Claw', 'Night Slash', 'Sucker Punch', 'Hex'], big: [['Void Eclipse', 'drain'], ['Nightmare', 'stun'], ['Dark Pulse', 'pierce'], ['Soul Reap', 'burn']] },
    light: { basic: ['Glimmer', 'Flash Hit', 'Holy Tap', 'Sparkle'], big: [['Radiant Nova', 'heal'], ['Judgement', 'pierce'], ['Starfall', 'none'], ['Blinding Halo', 'stun']] },
    fighting: { basic: ['Quick Punch', 'Low Kick', 'Chop', 'Headbutt'], big: [['Final Combo', 'none'], ['Dragon Fist', 'pierce'], ['Berserk Rush', 'boost'], ['Knockout Blow', 'stun']] },
    steel: { basic: ['Iron Tap', 'Gear Slam', 'Bolt Shot', 'Metal Claw'], big: [['Mega Cannon', 'pierce'], ['Fortress', 'heal'], ['Steel Storm', 'none'], ['Overclock', 'boost']] }
};

const EFFECTS = {
    none: '',
    burn: 'Burns the target: 10 damage at the start of each of its turns (3 turns)',
    stun: 'The target skips its next turn',
    pierce: 'Ignores defense',
    heal: 'Heals this card by 30',
    drain: 'Heals this card by half the damage dealt',
    boost: '+20 attack for the rest of the battle'
};

// kleiner Zufall aus einem Text (gleiche Karte = gleiche Werte)
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

function typeOf(raw, rnd) {
    if (raw.set === 'hero' && raw.stats) {
        const s = raw.stats;
        const top = Object.entries(s).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))[0];
        const byStat = { intelligence: 'psychic', strength: 'fighting', speed: 'electric', durability: 'steel', power: 'fire', combat: 'fighting' };
        if (raw.align === 'bad' && rnd() < 0.55) return 'dark';
        if (raw.align === 'good' && rnd() < 0.2) return 'light';
        return byStat[top && top[0]] || 'fighting';
    }
    const cands = (raw.genres || []).map(g => GENRE_TYPE[g]).filter(Boolean);
    if (!cands.length) return Object.keys(TYPES)[Math.floor(rnd() * Object.keys(TYPES).length)];
    return cands[Math.floor(rnd() * Math.min(cands.length, 3))];
}

const round10 = n => Math.max(10, Math.round(n / 10) * 10);

// Eine Karte aus Rohdaten; rankFrac: 0 = beliebteste der Reihe, 1 = letzte
function makeCard(raw, rankFrac, num) {
    const rnd = seeded(raw.id);
    const type = typeOf(raw, rnd);
    const pos = 1 - rankFrac;   // 1 = beliebteste
    const rarity = RARITIES.find(r => pos <= r.upTo) || RARITIES[RARITIES.length - 1];
    const ri = RIDX[rarity.id];
    let hp, atk, def, spd;
    if (raw.set === 'hero' && raw.stats) {
        const s = k => Number(raw.stats[k]) || 30;
        hp = round10(60 + s('durability') * 0.9 + s('strength') * 0.5 + ri * 12);
        atk = Math.round(15 + s('strength') * 0.35 + s('power') * 0.35 + ri * 5);
        def = Math.round(s('durability') * 0.25 + s('combat') * 0.1 + ri * 2);
        spd = Math.round(10 + s('speed') * 0.8);
    } else {
        const base = 0.55 + ri * 0.12 + rnd() * 0.25;
        hp = round10(70 + base * 110);
        atk = Math.round(20 + base * 60 + rnd() * 10);
        def = Math.round(3 + base * 22 + rnd() * 6);
        spd = Math.round(20 + rnd() * 70);
    }
    const mv = MOVES[type];
    const basic = mv.basic[Math.floor(rnd() * mv.basic.length)];
    const [bigName, effect] = mv.big[Math.floor(rnd() * mv.big.length)];
    const bigCost = ri >= 4 ? 3 : 2 + (rnd() < 0.5 ? 1 : 0);
    const attacks = [
        { name: basic, cost: 1, dmg: round10(atk * 0.45), effect: 'none' },
        { name: bigName, cost: bigCost, dmg: round10(atk * (bigCost === 3 ? 1.35 : 1.05) * (effect === 'none' ? 1.15 : 1)), effect }
    ];
    return {
        id: raw.id, set: raw.set, num: `${SETS[raw.set].code}-${String(num).padStart(4, '0')}`,
        name: raw.name, img: raw.img, from: raw.from || '', type, rarity: rarity.id, hp, atk, def, spd, attacks,
        weak: TYPES[type].weak
    };
}

function load(dataDir) {
    const file = [path.join(dataDir, 'cards-raw.json'), path.join(__dirname, 'tools', 'cards', 'fixture.json')].find(f => fs.existsSync(f));
    const raw = file ? JSON.parse(fs.readFileSync(file, 'utf8')).cards : [];
    const cards = [];
    for (const set of Object.keys(SETS)) {
        const list = raw.filter(r => r.set === set).sort((a, b) => b.pop - a.pop);
        list.forEach((r, i) => cards.push(makeCard(r, list.length > 1 ? i / (list.length - 1) : 0, i + 1)));
    }
    const byId = Object.fromEntries(cards.map(c => [c.id, c]));
    const byRarity = {};
    for (const c of cards) {
        const k = c.set + ':' + c.rarity;
        (byRarity[k] = byRarity[k] || []).push(c.id);
    }
    return { cards, byId, byRarity, source: file ? path.basename(file) : null };
}

// ---------- Packs ----------
const PACKS = {
    anime: { name: 'Anime Booster', icon: '🌸', sets: ['anime'], price: 2000, size: 5 },
    film: { name: 'Heroes & Series Booster', icon: '🎬', sets: ['hero', 'tv'], price: 2000, size: 5 },
    mixed: { name: 'Kek Mega Booster', icon: '🃏', sets: ['anime', 'hero', 'tv'], price: 5000, size: 8, better: true }
};
// Chance je Karte (letzte Karte eines Packs mindestens Rare)
const PULL = [['common', 50], ['uncommon', 27], ['rare', 14], ['epic', 6.5], ['legendary', 2.2], ['secret', 0.3]];

function rollRarity(minIdx, better) {
    const list = PULL.filter(([r]) => RIDX[r] >= minIdx).map(([r, w]) => [r, better && RIDX[r] >= 2 ? w * 1.6 : w]);
    let x = Math.random() * list.reduce((s, [, w]) => s + w, 0);
    for (const [r, w] of list) if ((x -= w) < 0) return r;
    return list[list.length - 1][0];
}

function openPack(db, packId) {
    const p = PACKS[packId];
    const out = [];
    for (let i = 0; i < p.size; i++) {
        let rar = rollRarity(i === p.size - 1 ? 2 : 0, p.better);
        const set = p.sets[Math.floor(Math.random() * p.sets.length)];
        // Stufe leer in dieser Reihe (kleine Testdaten): eine Stufe tiefer
        while (!db.byRarity[set + ':' + rar] && RIDX[rar] > 0) rar = RARITIES[RIDX[rar] - 1].id;
        const pool = db.byRarity[set + ':' + rar] || db.cards.filter(c => p.sets.includes(c.set)).map(c => c.id);
        out.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return out;
}

// Kompakt fuer den Browser (einmal beim Oeffnen, ~2000 Karten)
function catalog(db) {
    return {
        types: TYPES, rarities: RARITIES, sets: SETS, packs: PACKS, effects: EFFECTS,
        cards: db.cards.map(c => [c.id, c.set, c.num, c.name, c.img, c.from, c.type, c.rarity, c.hp, c.atk, c.def, c.spd,
            c.attacks.map(a => [a.name, a.cost, a.dmg, a.effect])])
    };
}

module.exports = { TYPES, RARITIES, RIDX, SETS, PACKS, EFFECTS, load, openPack, catalog, makeCard };
