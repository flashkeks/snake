// Kekemon-Karten 6.8: Videospiel-Set „Game" (Wunsch Max: Mario usw.).
//
//   node tools/cards/games.js /srv/snake-data/cards-games.json
//
// Eigene Datei neben cards-raw.json, damit die bestehenden Sets unangetastet
// bleiben (Seltenheit wird je Set gerechnet, neue Karten verschieben also
// nichts). cards.js laedt beide.
//
// Quellen (alle ohne Schluessel, 24.09.2026 von edge erreichbar):
//   amiiboapi.org     Nintendo & Smash-Gaeste (Mario, Zelda, Metroid, Sonic …),
//                     Animal Crossing nur die bekanntesten
//   PokeAPI           Gen 1 und beliebte spaetere Pokemon, offizielle Artworks
//   Data Dragon       League of Legends (Riot), Ladebild je Champion
//   OpenDota          Dota 2, Beliebtheit aus pub_pick
//   overfast-api      Overwatch
//   valorant-api.com  Valorant
//   brawlapi.com      Brawl Stars
//   genshin.jmp.blue  Genshin Impact
//
// Jede Figur bekommt ktype (Kartentyp aus Element/Rolle/Serie) und pop
// (Beliebtheit: Quelle + bekannte Figuren aus STARS). cards.js macht daraus
// wie gewohnt Seltenheit, Werte und Attacken.

const fs = require('fs');

const OUT = process.argv[2] || 'cards-games.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function json(url, tries = 4) {
    for (let i = 0; i < tries; i++) {
        try {
            const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'kek-game-cards/1.0' } });
            if (r.status === 429) { await sleep(4000 * (i + 1)); continue; }
            if (!r.ok) throw new Error(url + ' -> ' + r.status);
            return await r.json();
        } catch (e) {
            if (i === tries - 1) throw e;
            await sleep(1500 * (i + 1));
        }
    }
}

// Bekannte Figuren: pop direkt (hoechster Wert = Secret Rare). Kleinschreibung.
const STARS = {
    mario: 1000, link: 990, pikachu: 985, sonic: 980, kirby: 960, samus: 950, 'donkey kong': 940, cloud: 930,
    mewtwo: 925, charizard: 920, bowser: 915, zelda: 900, sephiroth: 895, ganondorf: 890, luigi: 885, peach: 880,
    yoshi: 875, 'pac-man': 870, 'mega man': 860, ryu: 850, snake: 845, steve: 840, sora: 835, mew: 830, fox: 820,
    wario: 815, jinx: 812, tracer: 810, ahri: 808, 'raiden shogun': 806, yasuo: 804, ness: 800, 'd.va': 798,
    isabelle: 790, 'tom nook': 785, inkling: 780, marth: 770, lucario: 768, gengar: 765, eevee: 762, rayquaza: 760,
    'meta knight': 758, bulbasaur: 756, squirtle: 755, charmander: 757, ike: 750, jigglypuff: 745, pudge: 744,
    invoker: 742, mercy: 741, genji: 740, 'king dedede': 735, ridley: 732, bayonetta: 730, lux: 728, zed: 726,
    zhongli: 725, 'hu tao': 724, venti: 723, nahida: 722, furina: 721, jett: 720, 'lee sin': 718, teemo: 716,
    ekko: 714, vi: 712, 'simon': 710, banjo: 708, joker: 706, 'diddy kong': 704, rosalina: 702, snorlax: 700,
    'chun-li': 700, 'captain falcon': 698, waluigi: 695, daisy: 694, blastoise: 693, venusaur: 692, gyarados: 690,
    dragonite: 689, lugia: 688, greninja: 687, mimikyu: 686, umbreon: 685, garchomp: 684, blaziken: 683,
    reinhardt: 682, widowmaker: 681, 'kazuha': 680, ganyu: 679, reyna: 678, sage: 676, toad: 675, ken: 674,
    'kaedehara kazuha': 680, spike: 660, leon: 658, shelly: 656, crow: 654, 'crystal maiden': 652, juggernaut: 650,
    'terry': 648, hero: 640, 'shovel knight': 638, olimar: 636, 'k.k. slider': 634, sheik: 632, 'dark samus': 630,
    'king k. rool': 628, 'little mac': 626, 'min min': 620, pyra: 618, mythra: 617, 'wii fit trainer': 560
};

// Kartentyp aus Pokemon-Typ, Genshin-Element, Rollen und Serien
const POKE_T = { fire: 'fire', water: 'water', ice: 'water', electric: 'electric', grass: 'nature', bug: 'nature', psychic: 'psychic', fairy: 'light',
    dark: 'dark', ghost: 'dark', poison: 'dark', fighting: 'fighting', steel: 'steel', rock: 'steel', ground: 'steel', normal: 'light', flying: 'light', dragon: 'fire' };
const GEN_T = { Pyro: 'fire', Hydro: 'water', Cryo: 'water', Electro: 'electric', Dendro: 'nature', Anemo: 'psychic', Geo: 'steel' };
const LOL_T = { Fighter: 'fighting', Tank: 'steel', Mage: 'psychic', Assassin: 'dark', Marksman: 'electric', Support: 'light' };
const DOTA_T = { str: 'fighting', agi: 'electric', int: 'psychic', all: 'steel' };
const OW_T = { tank: 'steel', damage: 'fire', support: 'light' };
const VAL_T = { Duelist: 'fire', Controller: 'dark', Initiator: 'electric', Sentinel: 'steel' };
const SERIES_T = {
    'Super Mario': 'fire', 'The Legend of Zelda': 'light', Metroid: 'steel', Kirby: 'psychic', Splatoon: 'water', 'Fire Emblem': 'fighting',
    'Street Fighter': 'fighting', 'Monster Hunter': 'nature', 'Star Fox': 'electric', 'Kid Icarus': 'light', Xenoblade: 'psychic',
    'Animal Crossing': 'nature', Sonic: 'electric', Megaman: 'steel', 'Pac-man': 'light', Castlevania: 'dark', 'Resident Evil': 'dark',
    'Metal Gear Solid': 'steel', Minecraft: 'nature', 'Dark Souls': 'dark', 'Final Fantasy': 'fighting', Earthbound: 'psychic',
    Pikmin: 'nature', 'Donkey Kong': 'fighting', 'Shovel Knight': 'steel', 'Fatal Fury': 'fighting', Tekken: 'fighting',
    'Banjo Kazooie': 'nature', 'Kingdom Hearts': 'light', Persona: 'dark', Bayonetta: 'dark', 'Dragon Quest': 'light', ARMS: 'fighting',
    'Punch Out': 'fighting', 'F-Zero': 'electric', Diablo: 'dark', 'Classic Nintendo': 'steel', 'Chibi Robo': 'steel', 'BoxBoy!': 'light'
};
const CHAR_T = { bowser: 'fire', ganondorf: 'dark', 'dark samus': 'dark', ridley: 'dark', 'king boo': 'dark', luigi: 'nature', zelda: 'psychic',
    'king dedede': 'fighting', 'meta knight': 'dark', wario: 'dark', waluigi: 'dark', rosalina: 'light', peach: 'light', daisy: 'nature' };
// Diese amiibo-Reihen nicht (Pokemon kommen aus PokeAPI, Rest keine Spielfiguren/Doppelte)
const AMIIBO_SKIP = new Set(['Pokemon', 'Kellogs', 'Power Pros', 'Yu-Gi-Oh!', 'Mii', 'Pragmata', "Yoshi's Woolly World", 'Mario Sports Superstars']);
// Animal Crossing: nur die bekanntesten (477 sonst)
const AC_KEEP = ['Isabelle', 'Tom Nook', 'K.K. Slider', 'Raymond', 'Marshal', 'Judy', 'Sherb', 'Ankha', 'Audie', 'Zucker', 'Stitches', 'Bob',
    'Lolly', 'Diana', 'Fauna', 'Beau', 'Coco', 'Lucky', 'Molly', 'Ketchup', 'Dom', 'Sasha', 'Merengue', 'Rosie', 'Punchy', 'Apollo', 'Tangy',
    'Ione', 'Maple', 'Bunnie', 'Shino', 'Chief', 'Kid Cat', 'Julian', 'Whitney', 'Pietro', 'Hamlet', 'Poppy', 'Marina', 'Genji', 'Kabuki',
    'Blathers', 'Celeste', 'Mabel', 'Sable', 'Label', 'Timmy', 'Tommy', 'Resetti', 'Gulliver', 'Wisp', 'Pascal', "Kapp'n", 'Redd', 'Brewster',
    'Daisy Mae', 'Flick', 'C.J.', 'Harvey', 'Leif', 'Saharah', 'Katrina', 'Lyle', 'Digby', 'Pelly', 'Phyllis', 'Pete', 'Cyrus', 'Reese', 'Kicks',
    'Luna', 'Katie', 'Joan', 'Lottie', 'Wilbur', 'Orville', 'Gracie', 'Porter', 'Copper', 'Booker', 'Tortimer', 'Don Resetti', 'Rover', 'Nat'];
// Pokemon: Gen 1 plus Lieblinge spaeterer Generationen (Nationaldex-Nummern)
const POKE_EXTRA = [152, 155, 158, 157, 160, 154, 175, 181, 196, 197, 212, 214, 229, 243, 244, 245, 248, 249, 250, 251, 254, 257, 260, 282, 302, 334,
    350, 359, 373, 376, 380, 381, 382, 383, 384, 385, 386, 392, 395, 405, 445, 448, 461, 468, 471, 472, 475, 483, 484, 487, 491, 493, 571, 609,
    635, 643, 644, 658, 700, 717, 724, 727, 730, 778, 785, 800, 815, 818, 887, 888, 890, 908, 1007, 1008];
const POKE_LEGEND = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 380, 381, 382, 383, 384, 385, 386, 483, 484, 487, 491, 493,
    643, 644, 717, 785, 800, 888, 890, 1007, 1008]);

const cap = s => s.split(/[-\s]/).map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
const star = name => STARS[name.toLowerCase()] || 0;

async function nintendo() {
    const d = await json('https://www.amiiboapi.org/api/amiibo/');
    const by = new Map();
    for (const x of d.amiibo) {
        if (AMIIBO_SKIP.has(x.gameSeries) || !x.image) continue;
        if (x.gameSeries === 'Animal Crossing' && !AC_KEEP.includes(x.character)) continue;
        const k = x.character.toLowerCase();
        const cur = by.get(k);
        // Figur aus der Smash-Reihe bevorzugen, sonst die erste
        const good = x.type === 'Figure' && /Smash/.test(x.amiiboSeries);
        if (!cur) by.set(k, { x, n: 1, good });
        else {
            cur.n++;
            if (good && !cur.good) Object.assign(cur, { x, good });
        }
    }
    return [...by.values()].map(({ x, n }) => {
        const k = x.character.toLowerCase();
        const ac = x.gameSeries === 'Animal Crossing';
        return {
            id: 'gn' + x.head + x.tail, set: 'game', name: x.character, img: x.image, from: x.gameSeries,
            ktype: CHAR_T[k] || SERIES_T[x.gameSeries] || 'fighting',
            pop: star(x.character) || (ac ? 230 - AC_KEEP.indexOf(x.character) : 420 + Math.min(8, n) * 12)
        };
    });
}

async function pokemon() {
    const ids = [...Array.from({ length: 151 }, (_, i) => i + 1), ...POKE_EXTRA];
    const out = [];
    for (const id of ids) {
        const [p, sp] = await Promise.all([json(`https://pokeapi.co/api/v2/pokemon/${id}`), json(`https://pokeapi.co/api/v2/pokemon-species/${id}`)]);
        const en = (sp.names || []).find(n => n.language.name === 'en');
        const name = en ? en.name : cap(p.name);
        const t = (p.types || []).sort((a, b) => a.slot - b.slot).map(x => x.type.name);
        // Normal/Flug zuerst? Dann lieber den zweiten Typ
        const main = t[0] === 'normal' && t[1] ? t[1] : t[0];
        out.push({
            id: 'gp' + id, set: 'game', name, from: 'Pokémon',
            img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
            ktype: POKE_T[main] || 'light',
            pop: star(name) || (POKE_LEGEND.has(id) ? 560 : 360) + Math.round((p.base_experience || 60) / 4)
        });
        if (out.length % 25 === 0) process.stdout.write(`pokemon ${out.length}\r`);
        await sleep(120);
    }
    return out;
}

async function lol() {
    const v = (await json('https://ddragon.leagueoflegends.com/api/versions.json'))[0];
    const d = await json(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`);
    return Object.values(d.data).map(c => ({
        id: 'gl' + c.key, set: 'game', name: c.name, from: 'League of Legends',
        img: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${c.id}_0.jpg`,
        ktype: LOL_T[(c.tags || [])[0]] || 'fighting',
        pop: star(c.name) || 300 + (c.info ? (c.info.attack + c.info.magic) * 4 : 0)
    }));
}

async function dota() {
    const d = await json('https://api.opendota.com/api/heroStats');
    const max = Math.max(...d.map(h => h.pub_pick || 0)) || 1;
    return d.map(h => ({
        id: 'gd' + h.id, set: 'game', name: h.localized_name, from: 'Dota 2',
        img: 'https://cdn.cloudflare.steamstatic.com' + String(h.img || '').replace(/\?$/, ''),
        ktype: DOTA_T[h.primary_attr] || 'fighting',
        pop: star(h.localized_name) || 250 + Math.round((h.pub_pick || 0) / max * 180)
    }));
}

async function overwatch() {
    const d = await json('https://overfast-api.tekrop.fr/heroes');
    return d.filter(h => h.portrait).map(h => ({
        id: 'go' + h.key, set: 'game', name: h.name, img: h.portrait, from: 'Overwatch',
        ktype: OW_T[h.role] || 'fighting', pop: star(h.name) || 400
    }));
}

async function valorant() {
    const d = await json('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
    return d.data.filter(a => a.fullPortrait || a.displayIcon).map(a => ({
        id: 'gv' + a.uuid.slice(0, 8), set: 'game', name: a.displayName, img: a.fullPortrait || a.displayIcon, from: 'Valorant',
        ktype: VAL_T[a.role && a.role.displayName] || 'fighting', pop: star(a.displayName) || 380
    }));
}

async function brawl() {
    const d = await json('https://api.brawlapi.com/v1/brawlers');
    const cls = n => /Tank/i.test(n) ? 'steel' : /Support/i.test(n) ? 'light' : /Marksman|Sniper/i.test(n) ? 'electric' : /Assassin/i.test(n) ? 'dark'
        : /Controller/i.test(n) ? 'psychic' : /Artillery|Thrower/i.test(n) ? 'fire' : 'fighting';
    return d.list.filter(b => b.released && (b.imageUrl2 || b.imageUrl)).map(b => ({
        id: 'gb' + b.id, set: 'game', name: b.name, img: b.imageUrl2 || b.imageUrl, from: 'Brawl Stars',
        ktype: cls((b.class && b.class.name) || ''), pop: star(b.name) || 250 + ((b.rarity && b.rarity.id) || 1) * 30
    }));
}

async function genshin() {
    const names = await json('https://genshin.jmp.blue/characters');
    const out = [];
    for (const n of names) {
        if (/traveler/.test(n)) continue;
        let c;
        try { c = await json(`https://genshin.jmp.blue/characters/${n}`); } catch (e) { continue; }
        out.push({
            id: 'gg' + n, set: 'game', name: c.name, from: 'Genshin Impact', img: `https://genshin.jmp.blue/characters/${n}/card`,
            ktype: GEN_T[c.vision] || 'psychic', gender: c.gender || null,
            pop: star(c.name) || (c.rarity === 5 ? 470 : 330)
        });
        await sleep(80);
    }
    return out;
}

(async () => {
    const all = [];
    const seen = new Set();
    for (const [name, fn] of [['nintendo', nintendo], ['pokemon', pokemon], ['lol', lol], ['dota', dota], ['overwatch', overwatch], ['valorant', valorant], ['brawl', brawl], ['genshin', genshin]]) {
        let list = [];
        try { list = await fn(); } catch (e) { console.error(name, 'FEHLER', e.message); }
        let n = 0;
        for (const c of list) {
            const k = c.name.toLowerCase();
            if (!c.name || !c.img || seen.has(k)) continue;
            seen.add(k);
            all.push(c);
            n++;
        }
        console.log(name.padEnd(10), n);
    }
    fs.writeFileSync(OUT + '.tmp', JSON.stringify({ built: new Date().toISOString(), sources: ['amiiboapi', 'pokeapi', 'ddragon', 'opendota', 'overfast', 'valorant-api', 'brawlapi', 'genshin.jmp.blue'], cards: all }));
    fs.renameSync(OUT + '.tmp', OUT);
    console.log('written', OUT, all.length);
})().catch(e => {
    console.error(e);
    process.exit(1);
});
