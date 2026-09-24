// Kekemon-Arenen simulieren (6.0): Siegchance eines Spielers je Arena.
//
//   node tools/km-sim.js [DATA_DIR] [Kaempfe je Arena] [arena=mul,...]
//
// DATA_DIR: Ordner mit cards-raw.json (auf edge /srv/snake-data), sonst die
// kleine fixture. Seit 6.4 (echte Spieler waren viel besser als die alte
// Annahme): Spieler = KI-Stufe PLAYER_LV (Standard 2, Vorausschau), Team aus
// der Seltenheit PLAYER_RAR (Standard auto: bis Volt Rare, Dojo/Mind Rare+Epic,
// Shadow Epic, Champion Epic+Legendary – was man dort realistisch hat).
// Zwei Teams je Arena:
//   zufall  drei zufaellige Karten dieser Seltenheit
//   vorteil drei Karten dieser Seltenheit, die den Arena-Typ stark treffen
// Mit arena=mul lassen sich Staerken probieren, ohne km-gyms.js zu aendern,
// z. B. node tools/km-sim.js /srv/snake-data 400 sprout=1.1,champ=0.9:1:1.1
// 6.7: Leiter auf Gym-Level; PLAYER_CARD_LV=gym|gym-5|1 legt das Spieler-Level fest

const path = require('path');
const cards = require(path.join(__dirname, '..', 'cards.js'));
const B = require(path.join(__dirname, '..', 'km-battle.js'));
const K = require(path.join(__dirname, '..', 'km-moves.js'));
const createGyms = require(path.join(__dirname, '..', 'km-gyms.js'));

const dir = process.argv[2] || '/nonexistent';
const N = Number(process.argv[3] || 300);
const override = Object.fromEntries((process.argv[4] || '').split(',').filter(Boolean).map(x => x.split('=')));

const cardDb = cards.load(dir);
const PLAYER_LV = Number(process.env.PLAYER_LV || 2);
// 6.7: Level der Spielerkarten. 'gym' = Gym-Level, 'gym-5' = 5 darunter, Zahl = fest
const CARD_LV = process.env.PLAYER_CARD_LV || 'gym';
const cardLv = g => {
    const m = /^gym([+-]\d+)?$/.exec(CARD_LV);
    return Math.max(1, Math.min(50, m ? g.lv + Number(m[1] || 0) : Number(CARD_LV) || 1));
};
// auto: was ein Spieler bei dieser Arena realistisch hat
const AUTO_RAR = { sprout: ['rare'], tide: ['rare'], blaze: ['rare'], volt: ['rare'], dojo: ['rare', 'epic'], mind: ['rare', 'epic'], shadow: ['epic'], champ: ['epic', 'legendary'] };
const playerRar = g => process.env.PLAYER_RAR && process.env.PLAYER_RAR !== 'auto' ? process.env.PLAYER_RAR.split(',') : AUTO_RAR[g.id] || ['rare'];
const { GYMS } = createGyms({ accounts: {}, cards, cardDb, battle: B, send() {}, feed() {} });

function team(pool) {
    const ids = new Set();
    let guard = 0;
    while (ids.size < B.TEAM_SIZE && guard++ < 1000) ids.add(pool[Math.floor(Math.random() * pool.length)].id);
    return [...ids];
}

function fight(mine, g, mul) {
    const foes = g.team.map(id => B.fighter(cardDb.byId[id], '', mul, g.lv));
    const { b } = B.createBattle(mine.map(id => B.fighter(cardDb.byId[id], '', 1, cardLv(g))), foes, { smart: g.smart });
    b.sides[0].ai = true;
    b.sides[0].level = PLAYER_LV;
    const smart = b.smart;
    let guard = 0;
    while (!b.over && guard++ < 400) {
        for (const s of B.needs(b)) b.sides[s].choice = B.aiChoose(b, s, s === 0 ? PLAYER_LV : smart);
        B.step(b, []);
    }
    return { win: b.winner === 0, turns: b.turn };
}

console.log(`Karten: ${cardDb.cards.length} (${cardDb.source || 'fixture'}), ${N} Kaempfe je Arena und Team-Art, Spielerkarten-Level ${CARD_LV}`);
// Mit Vorgaben: nur diese Arenen; mehrere Werte je Arena mit ':' (Sweep)
const runs = Object.keys(override).length ? GYMS.filter(g => override[g.id] !== undefined) : GYMS;
for (const g of runs) for (const mul of String(override[g.id] || g.mul).split(':').map(Number)) {
    const pr = playerRar(g);
    const pool = cardDb.cards.filter(c => pr.includes(c.rarity));
    const strong = g.type ? pool.filter(c => K.eff(c.type, g.type) > 1 || c.bt.moves.some(m => m.pow && K.eff(m.type, g.type) > 1)) : pool;
    let w1 = 0, w2 = 0, t = 0;
    for (let i = 0; i < N; i++) {
        const r1 = fight(team(pool), g, mul);
        const r2 = fight(team(strong.length >= B.TEAM_SIZE ? strong : pool), g, mul);
        w1 += r1.win;
        w2 += r2.win;
        t += r1.turns + r2.turns;
    }
    console.log(`${g.id.padEnd(7)} Lv ${String(g.lv).padStart(2)} vs ${String(cardLv(g)).padStart(2)} mul ${mul.toFixed(2)}  zufall ${String(Math.round(w1 / N * 100)).padStart(3)} %  vorteil ${String(Math.round(w2 / N * 100)).padStart(3)} %  Zuege ${(t / N / 2).toFixed(1)}`);
}
