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
        zombie: true, boss: true, name: 'Abomination', icon: '🦠', color: '#b04fff', r: 46, hpBase: 2500, hpPer: 1200, speed: 90, chase: 110, aggro: 99999,
        slam: { r: 230, dmg: 60, ms: 6000 }, contact: 50, summon: { kind: 'runner', n: 3, ms: 9000, max: 9 }, melee: 50,
        charge: { ms: 9000, warn: 900, dur: 700, speed: 560 }, strikes: { n: 4, r: 100, dmg: 45, warn: 1200, ms: 11000, spread: 220 }
    },
    // ---------- Bosse (einer zur Zeit, reihum zufaellig) ----------
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
// Wer normal auf der Map herumlaeuft (Gewichte); Enforcer bewachen das Militaerlager
const ROAMERS = [['scav', 55], ['brute', 18], ['sniper', 14], ['drone', 13]];

// Fuer den Browser: was er zum Zeichnen braucht
function catalog() {
    return Object.fromEntries(Object.entries(MOBS).map(([k, m]) => [k, { name: m.name, icon: m.icon, color: m.color, r: m.r, boss: !!m.boss, crown: !!m.crown, elite: !!m.elite || (!!m.boss && !!m.zombie), slamR: m.slam ? m.slam.r : 0 }]));
}

module.exports = { MOBS, BOSSES, ROAMERS, catalog };
