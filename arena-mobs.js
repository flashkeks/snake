// Gegner in der Extraction (seit 4.1): normale Gegner zum Farmen und Bosse.
// Nur Daten; die KI steht in shooter.js (mobTick).
//
// Felder: r Radius, hp Leben (Bosse: hpBase + hpPer je Spieler im Raid),
// speed Tempo, aggro so weit sieht er Spieler, range/keep Wunschabstand
// (Fernkampf), chase Tempo beim Nachsetzen (Nahkampf), gun Waffe
// (dmg, speed, ms zwischen Schuessen, burst Kugeln je Schuss, spread,
// life Sekunden, aim Zielzeit mit Laser, homing, explode), melee/contact
// Schaden je Sekunde bei Beruehrung, taken Schadensfaktor (Panzerung),
// xp Schluessel aus arena-level XP (mal xpMul), drop Beute
// (chance, src Quelle in arena-items, n Items).

const MOBS = {
    scav: {
        name: 'Scav', icon: '🥷', color: '#9aa4b1', r: 17, hp: 90, speed: 150, aggro: 520, range: 480, keep: 260,
        gun: { dmg: 9, speed: 700, ms: 900, burst: 1, spread: 0.12, life: 0.9 },
        xp: 'npc', xpMul: 1, drop: { chance: 0.35, src: 'npcdrop', n: 1 }
    },
    brute: {
        name: 'Brute', icon: '👹', color: '#c97a3a', r: 24, hp: 280, speed: 115, chase: 235, aggro: 460,
        melee: 40, xp: 'npc', xpMul: 2, drop: { chance: 0.5, src: 'npcdrop', n: 1 }
    },
    sniper: {
        name: 'Sniper', icon: '🎯', color: '#6bbf59', r: 16, hp: 70, speed: 110, aggro: 950, range: 900, keep: 600,
        gun: { dmg: 34, speed: 1600, ms: 2600, burst: 1, spread: 0, life: 0.75, aim: 800 },
        xp: 'npc', xpMul: 1.5, drop: { chance: 0.45, src: 'npcdrop', n: 1 }
    },
    drone: {
        name: 'Drone', icon: '🛸', color: '#7fd3ff', r: 14, hp: 50, speed: 250, aggro: 620, range: 340, keep: 170,
        gun: { dmg: 5, speed: 650, ms: 230, burst: 1, spread: 0.22, life: 0.7 },
        xp: 'npc', xpMul: 0.8, drop: { chance: 0.2, src: 'npcdrop', n: 1 }
    },
    enforcer: {
        name: 'Enforcer', icon: '🤖', color: '#ff5b5b', r: 22, hp: 650, speed: 120, aggro: 600, range: 400, keep: 200, taken: 0.8, elite: true,
        gun: { dmg: 8, speed: 820, ms: 1250, burst: 6, spread: 0.4, life: 0.6 },
        xp: 'elite', xpMul: 1, drop: { chance: 1, src: 'elite', n: 1 }
    },
    // ---------- Labor (6.12, Max): Monster aus den DNA-Tanks, Ebene -2 ----------
    mutant: {
        name: 'Mutant', icon: '🧬', color: '#7dff6a', r: 21, hp: 520, speed: 150, chase: 300, aggro: 620,
        melee: 60, lab: true, xp: 'npc', xpMul: 3, drop: { chance: 0.55, src: 'npcdrop', n: 1 }
    },
    // 6.12.1 (Max: zu op): HP 300 -> 220, Nachsetzen 390 -> 300, Biss 48 -> 30/s, Sicht 560 -> 460
    stalker: {
        name: 'Stalker', icon: '🦎', color: '#b6ff3a', r: 16, hp: 220, speed: 190, chase: 300, aggro: 460,
        melee: 30, lab: true, xp: 'npc', xpMul: 2.5, drop: { chance: 0.45, src: 'npcdrop', n: 1 }
    },
    horror: {
        name: 'Acid Horror', icon: '🦠', color: '#35ffc0', r: 23, hp: 460, speed: 120, aggro: 700, range: 560, keep: 330, lab: true,
        gun: { dmg: 20, speed: 540, ms: 1400, burst: 3, spread: 0.28, life: 1.4, burn: 4 },
        xp: 'npc', xpMul: 3, drop: { chance: 0.55, src: 'npcdrop', n: 1 }
    },
    hulk: {
        name: 'Failed Experiment', icon: '🧟‍♂️', color: '#ff4fd8', r: 34, hp: 2400, speed: 105, chase: 200, aggro: 680, taken: 0.85, elite: true,
        melee: 95, lab: true, xp: 'elite', xpMul: 2, drop: { chance: 1, src: 'npcrare', n: 2 }
    },
    // ---------- Zombies (4.4): jagen immer den naechsten Spieler, HP wachsen je Welle ----------
    zombie: {
        zombie: true, name: 'Zombie', icon: '🧟', color: '#7fbf5f', r: 17, hp: 60, speed: 95, chase: 95, aggro: 99999,
        melee: 30, xp: 'npc', xpMul: 0.5
    },
    runner: {
        zombie: true, name: 'Runner', icon: '🧟‍♂️', color: '#b5e36b', r: 15, hp: 40, speed: 190, chase: 190, aggro: 99999,
        melee: 22, xp: 'npc', xpMul: 0.5
    },
    tank: {
        zombie: true, name: 'Tank', icon: '🧌', color: '#5f8f4f', r: 27, hp: 420, speed: 70, chase: 75, aggro: 99999, taken: 0.85,
        melee: 55, xp: 'npc', xpMul: 2
    },
    spitter: {
        zombie: true, name: 'Spitter', icon: '🤢', color: '#9fdf3f', r: 16, hp: 55, speed: 100, aggro: 99999, range: 520, keep: 260,
        gun: { dmg: 14, speed: 420, ms: 2000, burst: 1, spread: 0.05, life: 1.5 },
        xp: 'npc', xpMul: 0.8
    },
    abomination: {
        zombie: true, boss: true, name: 'Abomination', title: 'The Flesh Heap', icon: '🦠', color: '#b04fff', r: 46, hpBase: 2500, hpPer: 1200, speed: 90, chase: 110, aggro: 99999,
        slam: { r: 230, dmg: 60, ms: 6000 }, contact: 50, summon: { kind: 'runner', n: 3, ms: 9000, max: 9 }, melee: 50,
        charge: { ms: 9000, warn: 900, dur: 700, speed: 560 }, strikes: { n: 4, r: 100, dmg: 45, warn: 1200, ms: 11000, spread: 220 }
    },
    // 6.5: mehr Arten mit Faehigkeiten (Max). Ab welcher Welle: shooter.js zSpawn
    bloater: {
        zombie: true, name: 'Bloater', icon: '🤮', color: '#a6e22e', r: 24, hp: 140, speed: 70, chase: 78, aggro: 99999,
        melee: 10, boom: { r: 130, dmg: 55, acid: true }, pts: 90, coins: 8, xp: 'npc', xpMul: 1
    },
    leaper: {
        zombie: true, name: 'Leaper', icon: '🐺', color: '#d9a066', r: 14, hp: 45, speed: 150, chase: 165, aggro: 99999,
        melee: 22, charge: { ms: 4500, warn: 600, dur: 450, speed: 720 }, pts: 70, coins: 6, xp: 'npc', xpMul: 0.7
    },
    shade: {
        zombie: true, name: 'Shade', icon: '👻', color: '#9fb7ff', r: 15, hp: 55, speed: 120, chase: 135, aggro: 99999,
        melee: 28, blink: { ms: 4500, dist: [90, 170] }, ghost: true, pts: 80, coins: 7, xp: 'npc', xpMul: 0.8
    },
    riot: {
        zombie: true, name: 'Riot', icon: '🪖', color: '#8aa0b8', r: 22, hp: 220, speed: 80, chase: 88, aggro: 99999,
        melee: 38, taken: 0.55, armored: true, pts: 120, coins: 12, xp: 'npc', xpMul: 1.5
    },
    acid: {
        zombie: true, name: 'Acid Spewer', icon: '🧪', color: '#39ff88', r: 17, hp: 75, speed: 95, aggro: 99999, range: 620, keep: 300,
        strikes: { n: 2, r: 80, dmg: 30, warn: 1000, ms: 5000, spread: 90, acid: true }, pts: 90, coins: 8, xp: 'npc', xpMul: 1
    },
    screamer: {
        zombie: true, name: 'Screamer', icon: '😱', color: '#ff6bd5', r: 18, hp: 95, speed: 110, chase: 118, aggro: 99999,
        melee: 20, summon: { kind: 'runner', n: 2, ms: 9000, max: 4, ring: true }, pts: 110, coins: 10, xp: 'npc', xpMul: 1.2
    },
    spiderling: {
        zombie: true, name: 'Spiderling', icon: '🕷️', color: '#8a5a3c', r: 11, hp: 30, speed: 230, chase: 230, aggro: 99999,
        melee: 12, xp: 'npc', xpMul: 0.2
    },
    // ---------- Zombie-Bosse (6.5): feste Reihenfolge, je 5 Wellen einer ----------
    // Neue Faehigkeiten (shooter.js mobTick): blink (Teleport), spiral (Kugel-
    // Spirale), trail (Feuerspur), vortex (zieht Spieler an), beam (drehender
    // Strahl), enrage (ab halber HP schneller). strikes.fire/zap aendern nur
    // Wirkung und Optik der Einschlaege, gun.slow/burn die der Kugeln.
    necro: {
        zombie: true, boss: true, name: 'Lord Morvath', title: 'The Necromancer', icon: '💀', color: '#7cffb2', r: 40, hpBase: 5000, hpPer: 2200,
        speed: 85, aggro: 99999, range: 650, keep: 280, contact: 40,
        gun: { dmg: 18, speed: 380, ms: 1600, burst: 3, spread: 0.5, life: 3, homing: 1.1 },
        summon: { kind: 'zombie', n: 5, ms: 11000, max: 12, ring: true }, blink: { ms: 7000 },
        strikes: { n: 5, r: 90, dmg: 50, warn: 1100, ms: 9000, spread: 240 },
        spiral: { ms: 16000, dur: 3200, every: 110, arms: 3, turn: 0.33 }, enrage: 0.5
    },
    brood: {
        zombie: true, boss: true, name: 'Arachna', title: 'The Brood Mother', icon: '🕷️', color: '#ff7b3a', r: 52, hpBase: 8000, hpPer: 3200,
        speed: 130, chase: 150, aggro: 99999, melee: 60, contact: 50,
        gun: { dmg: 10, speed: 520, ms: 2600, burst: 5, spread: 0.35, life: 1.4, fan: true, slow: 0.45 },
        charge: { ms: 6000, warn: 700, dur: 600, speed: 900 },
        summon: { kind: 'spiderling', n: 4, ms: 7000, max: 14 }, enrage: 0.5
    },
    inferno: {
        zombie: true, boss: true, name: 'Ignis', title: 'The Inferno Titan', icon: '🔥', color: '#ff5a1e', r: 58, hpBase: 12000, hpPer: 4500,
        speed: 75, chase: 85, aggro: 99999, melee: 70, contact: 60, taken: 0.9,
        slam: { r: 300, dmg: 85, ms: 6500, fire: true }, trail: { every: 350, r: 55, dur: 5000, dps: 22 },
        ring: { n: 16, ms: 5500 }, gun: { dmg: 16, speed: 360, ms: 99999, burst: 1, spread: 0, life: 2.4, burn: 10 },
        strikes: { n: 6, r: 115, dmg: 70, warn: 1400, ms: 9000, spread: 320, fire: true }, enrage: 0.5
    },
    storm: {
        zombie: true, boss: true, name: 'Voltra', title: 'The Storm Wraith', icon: '⚡', color: '#5ad8ff', r: 44, hpBase: 16000, hpPer: 6000,
        speed: 170, aggro: 99999, range: 600, keep: 260, contact: 45,
        gun: { dmg: 22, speed: 950, ms: 1100, burst: 2, spread: 0.12, life: 1.2 },
        blink: { ms: 4500 }, strikes: { n: 8, r: 85, dmg: 60, warn: 800, ms: 7000, spread: 300, zap: true },
        beam: { ms: 12000, warn: 1100, dur: 3500, len: 900, width: 30, dps: 95, turn: 1.1 }, enrage: 0.5
    },
    overlord: {
        zombie: true, boss: true, name: 'The Kek Eye', title: 'Void Overlord', icon: '👁️', color: '#c86bff', r: 66, hpBase: 24000, hpPer: 8000,
        speed: 65, aggro: 99999, range: 700, keep: 320, contact: 70, taken: 0.9,
        gun: { dmg: 20, speed: 420, ms: 1800, burst: 4, spread: 0.6, life: 2.6, homing: 0.7 },
        spiral: { ms: 11000, dur: 4000, every: 90, arms: 5, turn: 0.21 },
        vortex: { ms: 15000, dur: 3500, r: 700, pull: 170, dps: 12 },
        beam: { ms: 17000, warn: 1200, dur: 4000, len: 1000, width: 34, dps: 110, turn: 0.9, twin: true },
        summon: { kind: 'runner', n: 4, ms: 12000, max: 10, ring: true },
        strikes: { n: 7, r: 110, dmg: 75, warn: 1300, ms: 10000, spread: 320 }, enrage: 0.5
    },
    // ---------- 6.9: Bullet-Hell-Bosse (Max: wie Undertale, keine Minions) ----------
    // pattern: Angriffs-Skript aus arena-hazards.js (riesige Zonen, erst rot
    // angekuendigt); gap = Pause zwischen zwei Angriffen (ms)
    judge: {
        zombie: true, boss: true, name: 'Judge Bones', title: 'The Last Judgement', icon: '🦴', color: '#7fd8ff', r: 42, hpBase: 20000, hpPer: 7000,
        speed: 75, aggro: 99999, range: 99999, keep: 420, contact: 40, blink: { ms: 5200 }, pattern: 'judge', gap: 700, enrage: 0.5
    },
    seraph: {
        zombie: true, boss: true, name: 'Solaris', title: 'The Sun Eater', icon: '☀️', color: '#ffcf3a', r: 60, hpBase: 28000, hpPer: 9000,
        speed: 55, aggro: 99999, range: 99999, keep: 400, contact: 60, taken: 0.9, pattern: 'seraph', gap: 650, enrage: 0.5
    },
    omega: {
        zombie: true, boss: true, name: 'Omega', title: 'The End of All', icon: '🌌', color: '#b06bff', r: 64, hpBase: 36000, hpPer: 12000,
        speed: 50, aggro: 99999, range: 99999, keep: 380, contact: 70, taken: 0.85, pattern: 'omega', gap: 550, enrage: 0.5
    },
    // ---------- Bosse (einer zur Zeit, reihum zufaellig) ----------
    // 6.9 (Max: neue extrem krasse Bosse): nutzen die Gefahrenzonen aus
    // arena-hazards.js in einer Box um sich, dazu eigene Waffen
    titan: {
        boss: true, name: 'Titan Mk-IV', title: 'War Machine', icon: '🤖', color: '#ff8a3a', r: 58, hpBase: 14000, hpPer: 5000, speed: 95, aggro: 900, keep: 260, taken: 0.85,
        gun: { dmg: 20, speed: 700, ms: 900, burst: 4, spread: 0.18, life: 1.6 }, charge: { ms: 9000, warn: 800, dur: 650, speed: 760 },
        contact: 60, pattern: 'titan', gap: 900, enrage: 0.5
    },
    reaper: {
        boss: true, name: 'The Reaper', title: 'Harvester of Raids', icon: '☠️', color: '#9d6bff', r: 46, hpBase: 12000, hpPer: 4500, speed: 150, aggro: 950, keep: 200,
        gun: { dmg: 14, speed: 480, ms: 1300, burst: 3, spread: 0.4, life: 2.2, homing: 1 }, blink: { ms: 6000 },
        contact: 50, pattern: 'reaper', gap: 800, enrage: 0.5
    },
    king: {
        boss: true, name: 'Raccoon King', icon: '🦝', crown: true, color: '#ff3b3b', r: 44, hpBase: 5000, hpPer: 2500, speed: 125, aggro: 700, keep: 170,
        gun: { dmg: 16, speed: 620, ms: 850, burst: 3, spread: 0.12, life: 1.5, fan: true },
        ring: { n: 20, ms: 9000 }, slam: { r: 250, dmg: 70, ms: 7000 }, contact: 45,
        charge: { ms: 8000, warn: 800, dur: 650, speed: 720 }, summon: { kind: 'scav', n: 2, ms: 22000, max: 4 }
    },
    golem: {
        boss: true, name: 'Iron Golem', icon: '🗿', color: '#a0a8b8', r: 52, hpBase: 8000, hpPer: 3500, speed: 85, aggro: 650, keep: 110, taken: 0.85,
        gun: { dmg: 45, speed: 430, ms: 2100, burst: 1, spread: 0, life: 2.2, explode: 110, big: true },
        slam: { r: 320, dmg: 90, ms: 5500 }, contact: 60,
        strikes: { n: 6, r: 120, dmg: 75, warn: 1300, ms: 8500, spread: 300 }
    },
    queen: {
        boss: true, name: 'Hive Queen', icon: '🐝', color: '#ffd23f', r: 40, hpBase: 4200, hpPer: 2000, speed: 150, aggro: 800, keep: 340,
        gun: { dmg: 12, speed: 520, ms: 620, burst: 2, spread: 0.25, life: 1.9, homing: 0.9 },
        ring: { n: 14, ms: 7000 }, summon: { kind: 'drone', n: 3, ms: 10000, max: 8 }, contact: 35,
        charge: { ms: 6500, warn: 600, dur: 500, speed: 820 }
    }
};

const BOSSES = Object.keys(MOBS).filter(k => MOBS[k].boss && !MOBS[k].zombie);
// Zombie-Bosse in fester Reihenfolge: Welle 5, 10, 15, 20, 25, dann (6.9, Max)
// 30 Judge Bones, 35 Solaris, 40 Omega, 45 Kek Eye – danach von vorn (staerker)
const ZBOSSES = ['abomination', 'necro', 'brood', 'inferno', 'storm', 'judge', 'seraph', 'omega', 'overlord'];
// Wer normal auf der Map herumlaeuft (Gewichte); Enforcer bewachen das Militaerlager
const ROAMERS = [['scav', 55], ['brute', 18], ['sniper', 14], ['drone', 13]];

// Fuer den Browser: was er zum Zeichnen braucht
function catalog() {
    return Object.fromEntries(Object.entries(MOBS).map(([k, m]) => [k, { name: m.name, icon: m.icon, color: m.color, r: m.r, boss: !!m.boss, zombie: !!m.zombie, crown: !!m.crown, elite: !!m.elite || (!!m.boss && !!m.zombie), slamR: m.slam ? m.slam.r : 0, title: m.title || '', ghost: !!m.ghost, armored: !!m.armored, boom: m.boom ? m.boom.r : 0, beamLen: m.beam ? m.beam.len : 0, beamW: m.beam ? m.beam.width : 0, beamTwin: !!(m.beam && m.beam.twin), vortexR: m.vortex ? m.vortex.r : 0, pattern: m.pattern || '' }]));
}

module.exports = { MOBS, BOSSES, ZBOSSES, ROAMERS, catalog };
