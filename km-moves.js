// Kekemon-Kampfsystem 6.0 (Max: "orientier dich an Pokemon Showdown"):
// Typ-Tabelle, Kampfwerte und die vier Attacken jeder Karte.
//
// Jede Karte bekommt deterministisch aus ihrer Id (eigener Zufall, die
// sichtbaren Kartenwerte HP/ATK/DEF/SPD bleiben wie sie waren):
//   style   'phys' oder 'spec' – womit die Karte angreift
//   stats   hp, atk, def, spa, spd, spe (Showdown-artig, Level 50)
//   moves   1. kleine eigene Attacke (Kartentyp, 65 Staerke)
//           2. grosse eigene Attacke (Kartentyp, Staerke/Effekt aus dem alten Effekt)
//           3. Abdeckung: Attacke eines anderen Typs
//           4. Hilfsattacke aus dem Pool des Kartentyps (Status, Aufbau,
//              Heilung, Schutz oder Prioritaet)
//
// Attacke: { name, type, cat: 'phys'|'spec'|'status', pow, acc, pp, pri, eff }
// eff (alles optional):
//   st: 'brn'|'par'|'psn'|'slp', ch: Chance in % (ohne ch: sicher, Status-Attacke)
//   self: { atk|def|spa|spd|spe|off: Stufen }  (off = je nach style atk oder spa)
//   heal: % der max. HP (Status-Attacke) bzw. nach dem Treffer
//   drain: % des Schadens
//   crit: 1 = hohe Volltrefferchance (1/8 statt 1/24)
//   protect: 1

const TYPE_IDS = ['fire', 'water', 'electric', 'nature', 'psychic', 'dark', 'light', 'fighting', 'steel'];

// Angreifer -> Verteidiger -> Faktor (fehlt = 1)
const CHART = {
    fire: { nature: 2, steel: 2, fire: 0.5, water: 0.5 },
    water: { fire: 2, water: 0.5, nature: 0.5 },
    electric: { water: 2, electric: 0.5, nature: 0.5 },
    nature: { electric: 2, water: 2, fire: 0.5, nature: 0.5, steel: 0.5 },
    psychic: { fighting: 2, psychic: 0.5, steel: 0.5, dark: 0 },
    dark: { psychic: 2, light: 2, dark: 0.5, fighting: 0.5 },
    light: { dark: 2, fighting: 2, fire: 0.5, steel: 0.5 },
    fighting: { steel: 2, dark: 2, psychic: 0.5, light: 0.5 },
    steel: { light: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 }
};
const eff = (atk, def) => atk && CHART[atk] && CHART[atk][def] !== undefined ? CHART[atk][def] : 1;

// Status-Immunitaeten wie im Vorbild: Feuer brennt nicht, Elektro wird nicht
// paralysiert, Stahl nicht vergiftet
const IMMUNE = { brn: 'fire', par: 'electric', psn: 'steel' };

// Eher physisch angreifende Typen
const PHYS_LEAN = new Set(['fighting', 'steel', 'dark', 'nature']);

// Hilfsattacken je Typ (Slot 4)
const U = {
    burn: n => ({ name: n, cat: 'status', pow: 0, acc: 85, pp: 15, eff: { st: 'brn' } }),
    para: n => ({ name: n, cat: 'status', pow: 0, acc: 90, pp: 20, eff: { st: 'par' } }),
    poison: n => ({ name: n, cat: 'status', pow: 0, acc: 90, pp: 20, eff: { st: 'psn' } }),
    sleep: n => ({ name: n, cat: 'status', pow: 0, acc: 65, pp: 15, eff: { st: 'slp' } }),
    setup: n => ({ name: n, cat: 'status', pow: 0, acc: 0, pp: 20, eff: { self: { off: 2 } } }),
    calm: n => ({ name: n, cat: 'status', pow: 0, acc: 0, pp: 20, eff: { self: { off: 1, spd: 1 } } }),
    bulk: n => ({ name: n, cat: 'status', pow: 0, acc: 0, pp: 20, eff: { self: { off: 1, def: 1 } } }),
    wall: n => ({ name: n, cat: 'status', pow: 0, acc: 0, pp: 15, eff: { self: { def: 2 } } }),
    speed: n => ({ name: n, cat: 'status', pow: 0, acc: 0, pp: 20, eff: { self: { spe: 2 } } }),
    recover: n => ({ name: n, cat: 'status', pow: 0, acc: 0, pp: 8, eff: { heal: 50 } }),
    protect: n => ({ name: n, cat: 'status', pow: 0, acc: 0, pp: 10, pri: 4, eff: { protect: 1 } }),
    prio: n => ({ name: n, cat: null, pow: 40, acc: 100, pp: 30, pri: 1 })
};
const UTIL = {
    fire: [U.burn('Will-O-Wisp'), U.setup('Heat Up'), U.protect('Fire Shield')],
    water: [U.recover('Aqua Ring'), U.calm('Calm Waters'), U.protect('Bubble Shield')],
    electric: [U.para('Thunder Wave'), U.speed('Overcharge'), U.prio('Quick Spark')],
    nature: [U.poison('Poison Powder'), U.recover('Photosynthesis'), U.sleep('Sleep Spores')],
    psychic: [U.sleep('Hypnosis'), U.calm('Calm Mind'), U.recover('Mind Mend')],
    dark: [U.poison('Toxic'), U.setup('Nasty Plot'), U.prio('Sucker Punch')],
    light: [U.recover('Moonlight'), U.para('Dazzle'), U.calm('Starlight Focus')],
    fighting: [U.setup('Swords Dance'), U.bulk('Bulk Up'), U.prio('Mach Punch')],
    steel: [U.wall('Iron Defense'), U.protect("King's Shield"), U.prio('Bullet Punch')]
};

// Grosse Attacke aus dem alten Effekt
const BIG = {
    none: { pow: 110, acc: 90, pp: 8 },
    burn: { pow: 90, acc: 100, pp: 10, eff: { st: 'brn', ch: 30 } },
    stun: { pow: 85, acc: 100, pp: 10, eff: { st: 'par', ch: 30 } },
    pierce: { pow: 90, acc: 100, pp: 10, eff: { crit: 1 } },
    heal: { pow: 80, acc: 100, pp: 10, eff: { heal: 25 } },
    drain: { pow: 80, acc: 100, pp: 10, eff: { drain: 50 } },
    boost: { pow: 85, acc: 100, pp: 10, eff: { self: { off: 1 } } }
};

const STAT_NAME = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };
const ST_NAME = { brn: 'burn', par: 'paralyze', psn: 'poison', slp: 'put to sleep' };

// Kurzer Text fuer die Knoepfe und die Karte
function describe(m, style) {
    const e = m.eff || {};
    const out = [];
    if (e.st) out.push(e.ch ? `${e.ch} % chance to ${ST_NAME[e.st]}` : `${ST_NAME[e.st][0].toUpperCase() + ST_NAME[e.st].slice(1)}s the target`);
    if (e.self) {
        for (const [k, n] of Object.entries(e.self)) {
            const s = k === 'off' ? (style === 'spec' ? 'spa' : 'atk') : k;
            out.push(`${n > 0 ? 'Raises' : 'Lowers'} ${STAT_NAME[s]} by ${Math.abs(n)}`);
        }
    }
    if (e.heal) out.push(m.cat === 'status' ? `Heals ${e.heal} % of max HP` : `Heals ${e.heal} % of max HP after hitting`);
    if (e.drain) out.push('Heals half the damage dealt');
    if (e.crit) out.push('High critical-hit ratio');
    if (e.protect) out.push('Blocks all moves this turn (fails more often in a row)');
    if (m.pri > 0 && !e.protect) out.push(`Goes first (priority +${m.pri})`);
    return out.join(' · ');
}

// Kampf-Ausruestung einer Karte. rnd: eigener, fester Zufall der Karte.
// moveNames: { basic, big, effect } aus cards.js (SIG/FRAN/MOVES),
// pools: MOVES aus cards.js (fuer Namen der Abdeckungs-Attacke)
function kit(card, rnd, moveNames, pools) {
    const type = card.type;
    const style = rnd() < (PHYS_LEAN.has(type) ? 0.75 : 0.3) ? 'phys' : 'spec';
    const A = 30 + card.atk;
    const D = 45 + card.def * 2.2;
    const stats = {
        hp: card.hp,
        atk: Math.round(style === 'phys' ? A : A * 0.75),
        spa: Math.round(style === 'spec' ? A : A * 0.75),
        def: Math.round(D * (0.85 + rnd() * 0.3)),
        spd: Math.round(D * (0.85 + rnd() * 0.3)),
        spe: card.spd
    };
    const moves = [];
    moves.push({ name: moveNames.basic, type, cat: style, pow: 65, acc: 100, pp: 20, pri: 0 });
    const big = BIG[moveNames.effect] || BIG.none;
    moves.push({ name: moveNames.big, type, cat: style, pow: big.pow, acc: big.acc, pp: big.pp, pri: 0, eff: big.eff });
    // Abdeckung: ein anderer Typ, der moeglichst etwas trifft, was diesem Typ gefaehrlich wird
    const threats = TYPE_IDS.filter(t => eff(t, type) > 1);
    let cover = TYPE_IDS.filter(t => t !== type && threats.some(x => eff(t, x) > 1));
    if (!cover.length) cover = TYPE_IDS.filter(t => t !== type);
    const ct = cover[Math.floor(rnd() * cover.length)];
    const cn = pools[ct].basic[Math.floor(rnd() * pools[ct].basic.length)];
    moves.push({ name: cn, type: ct, cat: style, pow: 75, acc: 100, pp: 15, pri: 0 });
    const u = UTIL[type][Math.floor(rnd() * UTIL[type].length)];
    moves.push({ ...u, type, cat: u.cat || style, pri: u.pri || 0 });
    for (const m of moves) m.desc = describe(m, style);
    return { style, stats, moves };
}

module.exports = { TYPE_IDS, CHART, eff, IMMUNE, STAT_NAME, kit, describe };
