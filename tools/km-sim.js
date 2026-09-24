// Kekemon-Arenen simulieren (6.0): Siegchance eines Spielers je Arena.
//
//   node tools/km-sim.js [DATA_DIR] [Kaempfe je Arena] [arena=mul,...]
//
// DATA_DIR: Ordner mit cards-raw.json (auf edge /srv/snake-data), sonst die
// kleine fixture. Der "Spieler" ist die KI-Stufe 1 (rechnet Schaden, nutzt
// Status und Aufbau) – ein aufmerksamer Mensch spielt etwas besser.
// Zwei Teams je Arena:
//   zufall  drei zufaellige Karten der Arena-Seltenheit
//   vorteil drei Karten dieser Seltenheit, deren Typ den Arena-Typ stark trifft
// Mit arena=mul lassen sich Staerken probieren, ohne km-gyms.js zu aendern,
// z. B. node tools/km-sim.js /srv/snake-data 400 sprout=1.1,champ=0.9:1:1.1

const path = require('path');
const cards = require(path.join(__dirname, '..', 'cards.js'));
const B = require(path.join(__dirname, '..', 'km-battle.js'));
const K = require(path.join(__dirname, '..', 'km-moves.js'));
const createGyms = require(path.join(__dirname, '..', 'km-gyms.js'));

const dir = process.argv[2] || '/nonexistent';
const N = Number(process.argv[3] || 300);
const override = Object.fromEntries((process.argv[4] || '').split(',').filter(Boolean).map(x => x.split('=')));

const cardDb = cards.load(dir);
const { GYMS } = createGyms({ accounts: {}, cards, cardDb, battle: B, send() {}, feed() {} });

function team(pool) {
    const ids = new Set();
    let guard = 0;
    while (ids.size < 3 && guard++ < 1000) ids.add(pool[Math.floor(Math.random() * pool.length)].id);
    return [...ids];
}

function fight(mine, g, mul) {
    const foes = g.team.map(id => B.fighter(cardDb.byId[id], '', mul));
    const { b } = B.createBattle(mine.map(id => B.fighter(cardDb.byId[id], '', 1)), foes, { smart: g.smart });
    b.sides[0].ai = true;
    b.sides[0].level = 1;
    // Seite 0 spielt wie KI-Stufe 1
    const smart = b.smart;
    let guard = 0;
    while (!b.over && guard++ < 400) {
        for (const s of B.needs(b)) b.sides[s].choice = B.aiChoose(b, s, s === 0 ? 1 : smart);
        B.step(b, []);
    }
    return { win: b.winner === 0, turns: b.turn };
}

console.log(`Karten: ${cardDb.cards.length} (${cardDb.source || 'fixture'}), ${N} Kaempfe je Arena und Team-Art`);
// Mit Vorgaben: nur diese Arenen; mehrere Werte je Arena mit ':' (Sweep)
const runs = Object.keys(override).length ? GYMS.filter(g => override[g.id] !== undefined) : GYMS;
for (const g of runs) for (const mul of String(override[g.id] || g.mul).split(':').map(Number)) {
    const pool = cardDb.cards.filter(c => g.rar.includes(c.rarity));
    const strong = g.type ? pool.filter(c => K.eff(c.type, g.type) > 1 || c.bt.moves.some(m => m.pow && K.eff(m.type, g.type) > 1)) : pool;
    let w1 = 0, w2 = 0, t = 0;
    for (let i = 0; i < N; i++) {
        const r1 = fight(team(pool), g, mul);
        const r2 = fight(team(strong.length >= 3 ? strong : pool), g, mul);
        w1 += r1.win;
        w2 += r2.win;
        t += r1.turns + r2.turns;
    }
    console.log(`${g.id.padEnd(7)} mul ${mul.toFixed(2)}  zufall ${String(Math.round(w1 / N * 100)).padStart(3)} %  vorteil ${String(Math.round(w2 / N * 100)).padStart(3)} %  Zuege ${(t / N / 2).toFixed(1)}`);
}
