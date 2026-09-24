// Arena-Leveling (seit 4.0, Wunsch Max: "man hat nix, worauf man grinden kann").
//
// XP aus Raids (Kills, Boss, Extraction, Zeit, Kisten) -> Level. Die Kurve ist
// absichtlich steil: Level 10 nach grob 50 guten Raids, Level 50 ist ein
// Langzeitziel. Je Level 2 Stat-Punkte (frei verteilbar, je Stat hoechstens 50)
// und ab Level 2 je Level 1 Skill-Punkt fuer den Skill Tree (3 Aeste, 30
// Knoten). Zuruecksetzen kostet viel Coins und Scrap und wird jedes Mal teurer.
//
// Alles hier ist reine Rechnerei ohne Zustand; shooter.js wendet bonuses() im
// Raid an, der Hub verteilt und setzt zurueck.

const MAX_LEVEL = 100;
const STAT_POINTS_PER_LEVEL = 2;
const STAT_MAX = 50;

// XP fuer den Schritt von Level L auf L+1
function xpNeed(level) {
    return Math.round(250 * Math.pow(level, 1.85));
}

// Level und Fortschritt aus der Gesamt-XP
function levelOf(xp) {
    let level = 1, rest = Math.max(0, Math.floor(xp || 0));
    while (level < MAX_LEVEL && rest >= xpNeed(level)) {
        rest -= xpNeed(level);
        level++;
    }
    return { level, into: rest, need: level < MAX_LEVEL ? xpNeed(level) : 0 };
}

// Was es an XP gibt (shooter.js ruft award() mit diesen Schluesseln)
const XP = {
    kill: 90,           // Spieler getoetet (+10 je Level, das der Gegner ueber einem liegt)
    npc: 12,            // normaler Gegner (Runde Extraction-Ausbau)
    elite: 60,          // starker Gegner
    boss: 1200,         // Todesstoss am Boss
    bossHelp: 500,      // Boss-Schaden, anteilig nach Schaden
    extract: 150,       // rausgekommen
    extractItem: 15,    // je mitgebrachtem Item
    crate: 6,           // Kiste geoeffnet
    minute: 20          // je Minute im Raid (am Ende verbucht)
};

// ---------- Stats: Punkte frei verteilen ----------
const STATS = {
    vit: { name: 'Vitality', icon: '❤️', per: 4, unit: 'max HP', desc: '+4 max HP per point' },
    def: { name: 'Defense', icon: '🛡️', per: 0.6, unit: '% less damage', desc: '−0.6% damage taken per point' },
    carry: { name: 'Carry weight', icon: '🎒', per: 0.34, unit: 'backpack slots', desc: '+1 backpack slot per 3 points' },
    agi: { name: 'Agility', icon: '👟', per: 0.4, unit: '% speed', desc: '+0.4% movement speed per point' },
    pow: { name: 'Power', icon: '💪', per: 0.6, unit: '% damage', desc: '+0.6% damage per point' },
    dex: { name: 'Dexterity', icon: '🎯', per: 0.5, unit: '% fire rate', desc: '+0.5% fire rate per point' },
    rec: { name: 'Recovery', icon: '💚', per: 0.06, unit: 'HP/s', desc: '+0.06 HP/s regeneration per point' },
    luck: { name: 'Luck', icon: '🍀', per: 0.6, unit: '% extra loot', desc: '+0.6% chance of an extra item from crates per point' }
};

// ---------- Skill Tree: drei Aeste ----------
// max = Raenge, req = [Knoten, Rang] Voraussetzungen, lvl = Mindest-Level,
// row = Stufe im Ast (nur Darstellung)
const SKILLS = {
    // Assault: Schaden
    a_marks: { tree: 'assault', row: 0, name: 'Marksman', icon: '🎯', max: 3, desc: '+3% weapon damage per rank' },
    a_hands: { tree: 'assault', row: 0, name: 'Quick hands', icon: '✋', max: 3, desc: '+3% fire rate per rank' },
    a_eye: { tree: 'assault', row: 1, name: 'Deadeye', icon: '👁️', max: 2, req: [['a_marks', 2]], desc: '+4% crit chance per rank' },
    a_blood: { tree: 'assault', row: 1, name: 'Bloodlust', icon: '🩸', max: 2, req: [['a_marks', 1]], desc: 'Heal 10 HP per kill per rank' },
    a_demo: { tree: 'assault', row: 1, name: 'Demolition', icon: '💣', max: 3, req: [['a_hands', 1]], desc: '+8% explosive damage per rank' },
    a_hollow: { tree: 'assault', row: 2, name: 'Hollow points', icon: '💥', max: 1, lvl: 12, req: [['a_eye', 2]], desc: 'Crits deal 2.5× instead of 2×' },
    a_hunt: { tree: 'assault', row: 2, name: 'Boss hunter', icon: '👑', max: 3, lvl: 12, req: [['a_demo', 1]], desc: '+7% damage against bosses and enemies per rank' },
    a_exec: { tree: 'assault', row: 3, name: 'Executioner', icon: '🪓', max: 1, lvl: 22, req: [['a_hollow', 1]], desc: '+20% damage against targets below 30% HP' },
    a_ramp: { tree: 'assault', row: 3, name: 'Rampage', icon: '🔥', max: 1, lvl: 30, req: [['a_blood', 2]], desc: '+25% fire rate for 4 s after a kill' },
    a_apex: { tree: 'assault', row: 4, name: 'Apex predator', icon: '🦈', max: 1, lvl: 50, req: [['a_exec', 1], ['a_ramp', 1], ['a_hunt', 2]], desc: '+12% all damage' },
    // Survival: aushalten
    s_tough: { tree: 'survival', row: 0, name: 'Tough', icon: '🧱', max: 3, desc: '+10 max HP per rank' },
    s_skin: { tree: 'survival', row: 0, name: 'Thick skin', icon: '🦏', max: 3, desc: '−3% damage taken per rank' },
    s_medic: { tree: 'survival', row: 1, name: 'Field medic', icon: '💉', max: 2, req: [['s_tough', 1]], desc: '+20% healing from items per rank' },
    s_regen: { tree: 'survival', row: 1, name: 'Regeneration', icon: '🌿', max: 3, req: [['s_tough', 2]], desc: '+0.3 HP/s regeneration per rank' },
    s_fire: { tree: 'survival', row: 1, name: 'Fireproof', icon: '🧯', max: 2, req: [['s_skin', 1]], desc: '−25% fire and burn damage per rank' },
    s_wind: { tree: 'survival', row: 2, name: 'Second wind', icon: '🌬️', max: 1, lvl: 12, req: [['s_regen', 2]], desc: 'Once per raid: below 20% HP, heal 40% of max HP' },
    s_iron: { tree: 'survival', row: 2, name: 'Iron will', icon: '⚙️', max: 1, lvl: 18, req: [['s_skin', 3]], desc: '−15% damage taken while below 50% HP' },
    s_adren: { tree: 'survival', row: 3, name: 'Adrenaline', icon: '⚡', max: 1, lvl: 25, req: [['s_iron', 1]], desc: 'Getting hit: +30% speed for 3 s (every 15 s)' },
    s_last: { tree: 'survival', row: 3, name: 'Last stand', icon: '🛐', max: 1, lvl: 35, req: [['s_wind', 1]], desc: 'Once per raid: a lethal hit leaves you at 1 HP and 2 s invulnerable' },
    s_immortal: { tree: 'survival', row: 4, name: 'Unkillable', icon: '♾️', max: 1, lvl: 50, req: [['s_last', 1], ['s_adren', 1], ['s_medic', 2]], desc: '+15% max HP, regeneration starts after 3 s instead of 6 s' },
    // Tactics: Beute, Tempo, Heimlichkeit
    t_scav: { tree: 'tactics', row: 0, name: 'Scavenger', icon: '🧺', max: 3, desc: '+1 backpack slot per rank' },
    t_sprint: { tree: 'tactics', row: 0, name: 'Sprinter', icon: '🏃', max: 3, desc: '+3% movement speed per rank' },
    t_loot: { tree: 'tactics', row: 1, name: 'Looter', icon: '📦', max: 2, req: [['t_scav', 1]], desc: '+12% chance of an extra item from crates per rank' },
    t_scrap: { tree: 'tactics', row: 1, name: 'Scrapper', icon: '♻️', max: 3, req: [['t_scav', 1]], desc: '+10% scrap from salvaging per rank' },
    t_ghost: { tree: 'tactics', row: 1, name: 'Ghost', icon: '👻', max: 2, req: [['t_sprint', 1]], desc: 'Your shots reveal you 40% shorter per rank' },
    t_extract: { tree: 'tactics', row: 2, name: 'Extractor', icon: '🚁', max: 1, lvl: 12, req: [['t_sprint', 2]], desc: 'Extraction takes 4 s instead of 6 s' },
    t_mule: { tree: 'tactics', row: 2, name: 'Pack mule', icon: '🐴', max: 2, lvl: 18, req: [['t_scav', 3]], desc: '+2 backpack slots per rank' },
    t_nade: { tree: 'tactics', row: 3, name: 'Grenadier', icon: '🧨', max: 2, lvl: 25, req: [['t_loot', 1]], desc: '−20% cooldown between consumables per rank' },
    t_xp: { tree: 'tactics', row: 3, name: 'Veteran', icon: '🎖️', max: 2, lvl: 30, req: [['t_extract', 1]], desc: '+5% XP per rank' },
    t_master: { tree: 'tactics', row: 4, name: 'Mastermind', icon: '🧠', max: 1, lvl: 50, req: [['t_xp', 2], ['t_nade', 1], ['t_mule', 1]], desc: '+10% speed and +25% extra loot chance' }
};

const TREES = { assault: { name: 'Assault', color: '#ff5b5b' }, survival: { name: 'Survival', color: '#00d67a' }, tactics: { name: 'Tactics', color: '#3da5ff' } };

// ---------- 6.5: eigener Baum fuer Zombies ----------
// Max: Skill Tree je Modus getrennt, Level geteilt. Extraction und PvP nutzen
// die drei Aeste oben (je eigene Punkte), Zombies diesen Baum. Punkte je Baum
// = Level − 1, Stats (oben) gelten ueberall.
const ZSKILLS = {
    // Slayer: toeten
    z_head: { tree: 'slayer', row: 0, name: 'Headhunter', icon: '🎯', max: 3, desc: '+5% damage against zombies per rank' },
    z_tap: { tree: 'slayer', row: 0, name: 'Double tap', icon: '🔫', max: 3, desc: '+4% fire rate per rank' },
    z_crit: { tree: 'slayer', row: 1, name: 'Weak spots', icon: '🩻', max: 2, req: [['z_head', 2]], desc: '+5% crit chance per rank' },
    z_boss: { tree: 'slayer', row: 1, name: 'Boss slayer', icon: '👑', max: 3, lvl: 6, req: [['z_head', 1]], desc: '+10% damage against bosses per rank' },
    z_blast: { tree: 'slayer', row: 1, name: 'Demolition', icon: '💣', max: 2, req: [['z_tap', 1]], desc: '+12% explosive damage per rank' },
    z_cull: { tree: 'slayer', row: 2, name: 'Culling', icon: '🪓', max: 1, lvl: 12, req: [['z_crit', 2]], desc: 'Zombies below 25% HP take +30% damage' },
    z_chain: { tree: 'slayer', row: 2, name: 'Chain reaction', icon: '💥', max: 2, lvl: 15, req: [['z_blast', 1]], desc: 'Kills have a 10% chance per rank to explode (80 dmg, small radius)' },
    z_bane: { tree: 'slayer', row: 3, name: 'Undead bane', icon: '☠️', max: 1, lvl: 25, req: [['z_cull', 1], ['z_boss', 2]], desc: '+15% damage against everything undead' },
    // Survivor: durchhalten
    z_tough: { tree: 'survivor', row: 0, name: 'Tough', icon: '🧱', max: 3, desc: '+15 max HP per rank' },
    z_hide: { tree: 'survivor', row: 0, name: 'Thick hide', icon: '🦏', max: 3, desc: '−5% damage from zombie hits per rank' },
    z_regen: { tree: 'survivor', row: 1, name: 'Regeneration', icon: '🌿', max: 2, req: [['z_tough', 1]], desc: '+0.5 HP/s regeneration per rank' },
    z_dodge: { tree: 'survivor', row: 1, name: 'Sidestep', icon: '💨', max: 2, req: [['z_hide', 2]], desc: '4% chance per rank to dodge a zombie hit' },
    z_second: { tree: 'survivor', row: 2, name: 'Second chance', icon: '💖', max: 1, lvl: 10, req: [['z_regen', 2]], desc: 'Once per game: when you go down, get back up after 10 s with half HP' },
    z_jugg: { tree: 'survivor', row: 2, name: 'Juggernaut', icon: '🛡️', max: 1, lvl: 18, req: [['z_hide', 3]], desc: '−20% damage from bosses and their attacks' },
    z_undying: { tree: 'survivor', row: 3, name: 'Undying', icon: '♾️', max: 1, lvl: 30, req: [['z_second', 1], ['z_jugg', 1]], desc: '+20% max HP, regeneration starts after 3 s' },
    // Economist: Punkte und Coins
    z_cash: { tree: 'economist', row: 0, name: 'Salvager', icon: '💰', max: 3, desc: '+8% points per rank' },
    z_start: { tree: 'economist', row: 0, name: 'Head start', icon: '🏁', max: 2, desc: '+300 starting points per rank' },
    z_disc: { tree: 'economist', row: 1, name: 'Bargain', icon: '🏷️', max: 3, req: [['z_cash', 1]], desc: '−7% prices at all stations per rank' },
    z_box: { tree: 'economist', row: 1, name: 'Lucky box', icon: '🎁', max: 2, lvl: 8, req: [['z_start', 1]], desc: '+15% chance per rank that the mystery box rolls a sovereign weapon' },
    z_perk: { tree: 'economist', row: 2, name: 'Perk-aholic', icon: '🥤', max: 1, lvl: 14, req: [['z_disc', 2]], desc: 'Perks cost 25% less' },
    z_bounty: { tree: 'economist', row: 2, name: 'Bounty', icon: '🪙', max: 3, lvl: 18, req: [['z_cash', 3]], desc: '+10% coins at the end of a game per rank' },
    z_king: { tree: 'economist', row: 3, name: 'Zombie tycoon', icon: '🤑', max: 1, lvl: 35, req: [['z_bounty', 2], ['z_perk', 1], ['z_box', 1]], desc: '+15% points, +10% coins, start with 1000 extra points' }
};
const ZTREES = { slayer: { name: 'Slayer', color: '#ff5b5b' }, survivor: { name: 'Survivor', color: '#00d67a' }, economist: { name: 'Economist', color: '#ffd23f' } };
const MODES = ['extract', 'pvp', 'zombies'];
const skillsFor = mode => mode === 'zombies' ? ZSKILLS : SKILLS;

// Alte Konten: ein Baum fuer alles -> Extraction und PvP bekommen ihn (keiner verliert etwas)
function ensureTrees(pr) {
    if (!pr.trees) {
        const old = pr.skills || {};
        pr.trees = { extract: { skills: { ...old }, resets: 0 }, pvp: { skills: { ...old }, resets: 0 }, zombies: { skills: {}, resets: 0 } };
    }
    for (const m of MODES) pr.trees[m] = pr.trees[m] || { skills: {}, resets: 0 };
    delete pr.skills;
    return pr.trees;
}
const treeOf = (pr, mode) => ensureTrees(pr)[MODES.includes(mode) ? mode : 'extract'];

// Zuruecksetzen: 50k Coins + 2.500 Scrap, jedes weitere Mal +50 %
function resetCost(resets) {
    const k = Math.pow(1.5, resets || 0);
    return { coins: Math.round(50000 * k), scrap: Math.round(2500 * k) };
}

function fresh() {
    return { xp: 0, stats: {}, resets: 0, trees: { extract: { skills: {}, resets: 0 }, pvp: { skills: {}, resets: 0 }, zombies: { skills: {}, resets: 0 } } };
}

function pointsOf(p, mode) {
    const { level } = levelOf(p.xp);
    const statTotal = (level - 1) * STAT_POINTS_PER_LEVEL;
    const skillTotal = level - 1;
    const statUsed = Object.values(p.stats || {}).reduce((s, n) => s + n, 0);
    const skillFree = {};
    for (const m of MODES) skillFree[m] = skillTotal - Object.values(treeOf(p, m).skills).reduce((s, n) => s + n, 0);
    return { level, statFree: statTotal - statUsed, skillFree: mode ? skillFree[mode] : skillFree };
}

// Neue Verteilung pruefen (komplett, nicht nur die Aenderung). Nur Erhoehen
// ist erlaubt, Senken geht nur ueber den Reset. Rueckgabe: Fehlertext oder null
function validate(p, stats, skills, mode) {
    const SK = skillsFor(mode);
    const cur = treeOf(p, mode).skills;
    const { level } = levelOf(p.xp);
    for (const [k, n] of Object.entries(stats)) {
        if (!Object.prototype.hasOwnProperty.call(STATS, k) || !Number.isInteger(n) || n < 0 || n > STAT_MAX) return 'Invalid stat';
        if (n < ((p.stats || {})[k] || 0)) return 'Points can only be removed with a reset';
    }
    for (const k of Object.keys(p.stats || {})) if (!(k in stats) && p.stats[k] > 0) return 'Points can only be removed with a reset';
    const statUsed = Object.values(stats).reduce((s, n) => s + n, 0);
    if (statUsed > (level - 1) * STAT_POINTS_PER_LEVEL) return 'Not enough stat points';
    for (const [k, n] of Object.entries(skills)) {
        const d = Object.prototype.hasOwnProperty.call(SK, k) ? SK[k] : null;
        if (!d || !Number.isInteger(n) || n < 0 || n > d.max) return 'Invalid skill';
        if (n < (cur[k] || 0)) return 'Skills can only be removed with a reset';
        if (!n) continue;
        if (d.lvl && level < d.lvl) return `${d.name} needs level ${d.lvl}`;
        for (const [r, rank] of d.req || []) if ((skills[r] || 0) < rank) return `${d.name} needs ${SK[r].name} ${rank}`;
    }
    for (const k of Object.keys(cur)) if (!(k in skills) && cur[k] > 0) return 'Skills can only be removed with a reset';
    const skillUsed = Object.values(skills).reduce((s, n) => s + n, 0);
    if (skillUsed > level - 1) return 'Not enough skill points';
    return null;
}

// Was Stats und Skills im Raid bewirken (mode: welcher Baum gilt)
function bonuses(p, mode) {
    const st = k => (p.stats || {})[k] || 0;
    const tree = treeOf(p, mode).skills;
    const sk = k => tree[k] || 0;
    const b = {
        hp: STATS.vit.per * st('vit') + 10 * sk('s_tough'),
        hpMul: 1 + (sk('s_immortal') ? 0.15 : 0),
        taken: (1 - Math.min(0.3, STATS.def.per / 100 * st('def'))) * (1 - 0.03 * sk('s_skin')),
        pack: Math.floor(st('carry') / 3) + sk('t_scav') + 2 * sk('t_mule'),
        speed: 1 + STATS.agi.per / 100 * st('agi') + 0.03 * sk('t_sprint') + (sk('t_master') ? 0.1 : 0),
        dmg: (1 + STATS.pow.per / 100 * st('pow') + 0.03 * sk('a_marks')) * (sk('a_apex') ? 1.12 : 1),
        rate: 1 + STATS.dex.per / 100 * st('dex') + 0.03 * sk('a_hands'),
        regen: STATS.rec.per * st('rec') + 0.3 * sk('s_regen'),
        regenDelay: sk('s_immortal') ? 3000 : 6000,
        crit: 0.04 * sk('a_eye'),
        critMul: sk('a_hollow') ? 2.5 : 2,
        expl: 1 + 0.08 * sk('a_demo'),
        hunt: 1 + 0.07 * sk('a_hunt'),
        heal: 1 + 0.2 * sk('s_medic'),
        bloodlust: 10 * sk('a_blood'),
        exec: sk('a_exec') ? 0.2 : 0,
        rampage: !!sk('a_ramp'),
        fire: Math.max(0, 1 - 0.25 * sk('s_fire')),
        wind: !!sk('s_wind'),
        iron: !!sk('s_iron'),
        adren: !!sk('s_adren'),
        last: !!sk('s_last'),
        loot: STATS.luck.per / 100 * st('luck') + 0.12 * sk('t_loot') + (sk('t_master') ? 0.25 : 0),
        scrap: 1 + 0.1 * sk('t_scrap'),
        reveal: Math.max(0.2, 1 - 0.4 * sk('t_ghost')),
        extractMs: sk('t_extract') ? 4000 : 6000,
        utilCd: Math.max(0.4, 1 - 0.2 * sk('t_nade')),
        xp: 1 + 0.05 * sk('t_xp'),
        // Zombie-Baum (6.5); ausserhalb von Zombies alles neutral
        zDmg: (1 + 0.05 * sk('z_head')) * (sk('z_bane') ? 1.15 : 1),
        zBoss: 1 + 0.1 * sk('z_boss'),
        zCull: sk('z_cull') ? 0.3 : 0,
        zChain: 0.1 * sk('z_chain'),
        zTaken: 1 - 0.05 * sk('z_hide'),
        zBossTaken: sk('z_jugg') ? 0.8 : 1,
        zDodge: 0.04 * sk('z_dodge'),
        zSecond: !!sk('z_second'),
        zPts: (1 + 0.08 * sk('z_cash')) * (sk('z_king') ? 1.15 : 1),
        zStart: 300 * sk('z_start') + (sk('z_king') ? 1000 : 0),
        zDisc: 1 - 0.07 * sk('z_disc'),
        zPerk: sk('z_perk') ? 0.75 : 1,
        zBox: 0.15 * sk('z_box'),
        zCoins: 1 + 0.1 * sk('z_bounty') + (sk('z_king') ? 0.1 : 0)
    };
    if (mode === 'zombies') {
        // Allgemeine Werte aus dem Zombie-Baum
        b.hp += 15 * sk('z_tough');
        b.hpMul *= sk('z_undying') ? 1.2 : 1;
        b.regen += 0.5 * sk('z_regen');
        if (sk('z_undying')) b.regenDelay = 3000;
        b.rate *= 1 + 0.04 * sk('z_tap');
        b.crit += 0.05 * sk('z_crit');
        b.expl *= 1 + 0.12 * sk('z_blast');
    }
    return b;
}

// Fuer den Browser
function catalog() {
    return {
        maxLevel: MAX_LEVEL, statPer: STAT_POINTS_PER_LEVEL, statMax: STAT_MAX, stats: STATS, skills: SKILLS, trees: TREES, xp: XP,
        modes: { extract: { skills: SKILLS, trees: TREES }, pvp: { skills: SKILLS, trees: TREES }, zombies: { skills: ZSKILLS, trees: ZTREES } }
    };
}

module.exports = { MAX_LEVEL, XP, STATS, SKILLS, ZSKILLS, TREES, ZTREES, MODES, skillsFor, ensureTrees, treeOf, xpNeed, levelOf, pointsOf, validate, bonuses, resetCost, fresh, catalog };

// Nachsehen: node arena-level.js – XP bis zu einigen Leveln
if (require.main === module) {
    let sum = 0;
    for (let l = 1; l < MAX_LEVEL; l++) {
        sum += xpNeed(l);
        if ([2, 5, 10, 20, 30, 50, 75, 99].includes(l + 1)) console.log(`Level ${l + 1}: ${xpNeed(l).toLocaleString('en')} for this step, ${sum.toLocaleString('en')} total`);
    }
    console.log('skill ranks in total:', Object.values(SKILLS).reduce((s, d) => s + d.max, 0));
}
