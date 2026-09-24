// KI-Stufen gegeneinander (gleiche Zufallsteams, Seiten getauscht):
//   node tools/km-ai.js [DATA_DIR] [Kaempfe]
const path = require('path');
const cards = require(path.join(__dirname, '..', 'cards.js'));
const B = require(path.join(__dirname, '..', 'km-battle.js'));
const db = cards.load(process.argv[2] || '/nonexistent');
const N = Number(process.argv[3] || 500);
const team = () => { const s = new Set(); while (s.size < 3) s.add(db.cards[Math.floor(Math.random() * db.cards.length)].id); return [...s]; };
function fight(ta, tb, la, lb) {
    const { b } = B.createBattle(ta.map(id => B.fighter(db.byId[id])), tb.map(id => B.fighter(db.byId[id])), {});
    b.sides[0].ai = b.sides[1].ai = true;
    b.sides[0].level = la;
    b.sides[1].level = lb;
    let g = 0;
    while (!b.over && g++ < 400) {
        for (const s of B.needs(b)) b.sides[s].choice = B.aiChoose(b, s, s === 0 ? la : lb);
        B.step(b, []);
    }
    return b.winner;
}
for (const [x, y] of (process.argv[4] || '-1:0,-1:2,0:1,0:2,1:2').split(',').map(p => p.split(':').map(Number))) {
    let wx = 0;
    for (let i = 0; i < N; i++) {
        const ta = team(), tb = team();
        wx += fight(ta, tb, x, y) === 0;
        wx += fight(tb, ta, x, y) === 0;
    }
    console.log(`Stufe ${x} gegen ${y}: ${Math.round(wx / N / 2 * 100)} % fuer ${x}`);
}
