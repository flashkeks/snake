// Kekemon (5.0): Sammelkarten aus Anime-, Comic-/Film- und Serien-Charakteren.
//
// Rohdaten kommen aus tools/cards/build.js (DATA_DIR/cards-raw.json, im
// Backup). Hier wird daraus die eigentliche Karte gerechnet – deterministisch
// aus der Karten-Id, also bei gleichen Daten immer dieselbe Karte:
//   Typ       aus Genres (Anime/Serie) bzw. staerkstem Kampfwert (Helden)
//   Seltenheit aus dem Beliebtheitsrang innerhalb der Reihe
//   Werte     HP, ATK, DEF, SPD nach Seltenheit (Helden: aus powerstats)
//   Kampf     seit 6.0: Kampfwerte und vier Attacken (km-moves.js)
// Gibt es keine Rohdaten (lokaler Test), nimmt es tools/cards/fixture.json.

const fs = require('fs');
const path = require('path');
const M = require('./cards-moves');
const K = require('./km-moves');

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
    const sig = M.signature(raw);
    const fran = M.franchise(raw);
    let type = typeOf(raw, rnd);
    if (sig && sig.type && TYPES[sig.type]) type = sig.type;
    // Serie mit eigenem Typ: die Haelfte ihrer Figuren traegt ihn
    else if (fran && fran.type && TYPES[fran.type] && rnd() < 0.5) type = fran.type;
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
    // Attacken: eigene (SIG) > Serie (FRAN) > Kartentyp (MOVES)
    const mv = fran || MOVES[type];
    let basic = mv.basic[Math.floor(rnd() * mv.basic.length)];
    let [bigName, effect] = mv.big[Math.floor(rnd() * mv.big.length)];
    if (sig) {
        basic = sig.basic;
        bigName = sig.big;
        effect = EFFECTS[sig.effect] !== undefined ? sig.effect : 'none';
    }
    const card = {
        id: raw.id, set: raw.set, num: `${SETS[raw.set].code}-${String(num).padStart(4, '0')}`,
        name: raw.name, img: raw.img, from: raw.from || '', type, rarity: rarity.id, hp, atk, def, spd,
        gender: /^female$/i.test(raw.gender || '') ? 'f' : /^male$/i.test(raw.gender || '') ? 'm' : '',
        weak: TYPES[type].weak
    };
    // Kampf (6.0): eigener Zufall, damit die Werte oben unveraendert bleiben
    card.bt = K.kit(card, seeded(raw.id + ':battle'), { basic, big: bigName, effect }, MOVES);
    return card;
}

function load(dataDir) {
    const file = [path.join(dataDir, 'cards-raw.json'), path.join(__dirname, 'tools', 'cards', 'fixture.json')].find(f => fs.existsSync(f));
    // Doppelte (gleicher Name in gleicher Serie) und Nicht-Figuren raus
    const seen = new Set();
    const raw = (file ? JSON.parse(fs.readFileSync(file, 'utf8')).cards : []).filter(r => {
        const k = r.set + '|' + r.name.toLowerCase() + '|' + String(r.from).toLowerCase();
        if (seen.has(k) || /^(presenter|narrator|host)$/i.test(r.name)) return false;
        seen.add(k);
        return true;
    }).map(r => ({
        ...r,
        // Helden haben keine Beliebtheit, nur Kampfwerte: bekannte Figuren
        // (eigene Attacken) zaehlen deshalb deutlich hoeher
        pop: r.pop + (r.set === 'hero' && M.signature(r) ? 350 : 0)
    }));
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
    // Pools je Pack und Seltenheit (alle Reihen des Packs zusammen, ggf. gefiltert)
    const pools = {};
    for (const [pid, p] of Object.entries(PACKS)) {
        pools[pid] = {};
        for (const c of cards) {
            if (!p.sets.includes(c.set) || (p.only && c.gender !== p.only)) continue;
            (pools[pid][c.rarity] = pools[pid][c.rarity] || []).push(c.id);
        }
    }
    return { cards, byId, byRarity, pools, source: file ? path.basename(file) : null };
}

// ---------- Packs ----------
// 5.1a (Max): teurer, echte Seltenheit, Ball-Varianten und Shiny.
// Pro Pack gibt es normale Plaetze und garantierte Plaetze (mind. Rare).
const PACKS = {
    anime: { name: 'Anime Booster', icon: '🌸', sets: ['anime'], price: 10000, size: 5, sure: 1 },
    film: { name: 'Heroes & Series Booster', icon: '🎬', sets: ['hero', 'tv'], price: 10000, size: 5, sure: 1 },
    // 5.1b (Max): nur weibliche Figuren aus Anime und Comics (Geschlecht aus AniList/Superhero-API)
    waifu: { name: 'Waifu Booster', icon: '💖', sets: ['anime', 'hero'], only: 'f', price: 10000, size: 5, sure: 1 },
    mixed: { name: 'Kek Mega Booster', icon: '🃏', sets: ['anime', 'hero', 'tv'], price: 50000, size: 8, sure: 3, mega: true },
    // 6.1 (Max): nur aus dem Daily Pack Wheel, nicht im Shop (wheel: true).
    // Daily: alles moeglich, Chancen wie die 10k-Packs. Jackpot: Chancen wie
    // der Mega Booster, 50 % mehr Karten (12 statt 8, 5 statt 3 sicher Rare+)
    daily: { name: 'Daily Booster', icon: '🎁', sets: ['anime', 'hero', 'tv'], price: 10000, size: 5, sure: 1, wheel: true },
    // 6.7: nur aus 10 Booster-Teilen (Training), nicht im Shop. Chancen wie die 10k-Packs
    train: { name: 'Trainer Booster', icon: '🧩', sets: ['anime', 'hero', 'tv'], price: 10000, size: 5, sure: 1, wheel: true },
    jackpot: { name: 'Jackpot Booster', icon: '🌟', sets: ['anime', 'hero', 'tv'], price: 75000, size: 12, sure: 5, mega: true, wheel: true }
};
// Gewichte je Platz (Summe egal, wird normiert)
const ODDS = {
    // 5.4 (Max: "16 % Legendary im Mega ist way zu hoch"): alles ab Rare deutlich seltener
    normal: { common: 64, uncommon: 27, rare: 7.5, epic: 1.3, legendary: 0.18, secret: 0.02 },
    sure: { rare: 92, epic: 7, legendary: 0.9, secret: 0.1 },
    megaNormal: { common: 60, uncommon: 28, rare: 10, epic: 1.7, legendary: 0.28, secret: 0.02 },
    megaSure: { rare: 86, epic: 11.5, legendary: 2.2, secret: 0.3 }
};
// Varianten je Karte: Ball (Pokeball selten, Masterball sehr selten) und Shiny (extrem selten).
// Im Mega-Pack doppelt so oft.
// Varianten bleiben bei 2,5 % / 0,25 % / 0,1 % (Max, 5.4: gesenkt werden nur die Karten-Seltenheiten)
const VARIANTS = { poke: 0.025, master: 0.0025, shiny: 0.001 };
// Verkaufswert: Grundwert je Seltenheit, mal Ball und Shiny
const SELL = { common: 250, uncommon: 600, rare: 1800, epic: 7000, legendary: 35000, secret: 250000 };
const SELL_MUL = { p: 3, m: 20, s: 25 };

function pick(weights) {
    const list = Object.entries(weights);
    let x = Math.random() * list.reduce((s, [, w]) => s + w, 0);
    for (const [k, w] of list) if ((x -= w) < 0) return k;
    return list[list.length - 1][0];
}

// Variante als Kuerzel: '' | 'p' | 'm' plus 's' fuer Shiny
function rollVariant(mega) {
    const f = mega ? 2 : 1;
    const r = Math.random();
    const ball = r < VARIANTS.master * f ? 'm' : r < (VARIANTS.master + VARIANTS.poke) * f ? 'p' : '';
    return ball + (Math.random() < VARIANTS.shiny * f ? 's' : '');
}

// Schluessel in der Sammlung: Id, bei Varianten mit ~Kuerzel
const keyOf = (id, v) => v ? id + '~' + v : id;
function parseKey(k) {
    const i = k.indexOf('~');
    return i < 0 ? { id: k, v: '' } : { id: k.slice(0, i), v: k.slice(i + 1) };
}

function valueOf(card, v) {
    let n = SELL[card.rarity];
    for (const ch of v || '') n *= SELL_MUL[ch] || 1;
    return n;
}

function openPack(db, packId) {
    const p = PACKS[packId];
    const out = [];
    for (let i = 0; i < p.size; i++) {
        const sure = i >= p.size - p.sure;
        let rar = pick(p.mega ? (sure ? ODDS.megaSure : ODDS.megaNormal) : (sure ? ODDS.sure : ODDS.normal));
        const pools = db.pools[packId];
        // Stufe leer (kleine Testdaten, Filter): eine Stufe tiefer, notfalls hoeher
        let r = rar;
        while (!pools[r] && RIDX[r] > 0) r = RARITIES[RIDX[r] - 1].id;
        if (!pools[r]) r = Object.keys(pools)[0];
        const pool = pools[r];
        out.push({ id: pool[Math.floor(Math.random() * pool.length)], v: rollVariant(p.mega) });
    }
    return out;
}

// Kompakt fuer den Browser (einmal beim Oeffnen, ~2000 Karten)
function catalog(db) {
    return {
        types: TYPES, rarities: RARITIES, sets: SETS, packs: PACKS, effects: EFFECTS,
        odds: ODDS, variants: VARIANTS, sell: SELL, sellMul: SELL_MUL, chart: K.CHART, immune: K.IMMUNE,
        // Kampf (6.0): [style, [hp, atk, def, spa, spd, spe], Attacken als
        // [name, type, cat, pow, acc, pp, pri, desc, eff]]
        cards: db.cards.map(c => [c.id, c.set, c.num, c.name, c.img, c.from, c.type, c.rarity, c.hp, c.atk, c.def, c.spd,
            [c.bt.style, ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(k => c.bt.stats[k]),
                c.bt.moves.map(m => [m.name, m.type, m.cat, m.pow, m.acc, m.pp, m.pri, m.desc, m.eff || 0])]])
    };
}

module.exports = { TYPES, RARITIES, RIDX, SETS, PACKS, EFFECTS, ODDS, VARIANTS, SELL, load, openPack, catalog, makeCard, keyOf, parseKey, valueOf };
