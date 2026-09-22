// Slot-Automat: drei Walzen, eine Gewinnlinie. Der Server wuerfelt, der
// Browser zeigt nur an. Gewichte und Quoten sind so gewaehlt, dass im Mittel
// rund 95 % zurueckfliessen (nachrechnen: node slots.js).

const SYMBOLS = [
    { s: '🍒', weight: 30, three: 6 },
    { s: '🍋', weight: 25, three: 10 },
    { s: '🍇', weight: 18, three: 20 },
    { s: '🍉', weight: 12, three: 40 },
    { s: '🔔', weight: 8, three: 80 },
    { s: '⭐', weight: 5, three: 200 },
    { s: '💎', weight: 2, three: 1000 }
];

// Zwei Kirschen irgendwo zahlen den doppelten Einsatz, eine Kirsche nichts
const TWO_CHERRY = 2;
const ONE_CHERRY = 0;

const BETS = [10, 25, 50, 100, 250, 500, 1000];

const TOTAL = SYMBOLS.reduce((s, x) => s + x.weight, 0);

function roll() {
    let r = Math.random() * TOTAL;
    for (const x of SYMBOLS) {
        r -= x.weight;
        if (r < 0) return x.s;
    }
    return SYMBOLS[0].s;
}

function payout(reels) {
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
        return SYMBOLS.find(x => x.s === reels[0]).three;
    }
    const cherries = reels.filter(s => s === '🍒').length;
    if (cherries === 2) return TWO_CHERRY;
    if (cherries === 1) return ONE_CHERRY;
    return 0;
}

function spin(bet) {
    const reels = [roll(), roll(), roll()];
    const mult = payout(reels);
    return { reels, mult, win: Math.floor(bet * mult) };
}

// Erwartete Rueckzahlung exakt ausrechnen
function rtp() {
    let e = 0;
    for (const a of SYMBOLS) for (const b of SYMBOLS) for (const c of SYMBOLS) {
        const p = a.weight * b.weight * c.weight / TOTAL ** 3;
        e += p * payout([a.s, b.s, c.s]);
    }
    return e;
}

module.exports = { SYMBOLS: SYMBOLS.map(x => ({ s: x.s, three: x.three, weight: x.weight })), BETS, TWO_CHERRY, ONE_CHERRY, spin, rtp };

if (require.main === module) console.log('RTP', (rtp() * 100).toFixed(2) + ' %');
