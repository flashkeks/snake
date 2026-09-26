// "Book of Rah" – Linien-Slot im Stil von Book of Ra Deluxe.
//
// 5 Walzen x 3 Reihen, 10 feste Gewinnlinien, Einsatz = Gesamteinsatz
// (Linieneinsatz = Einsatz / 10). Gezahlt wird von links nach rechts.
//
// 📖 Das Buch ist Wild (ersetzt jedes Symbol auf einer Linie) und Scatter
// (3/4/5 irgendwo zahlen 2/20/200 × Einsatz). 3+ Buecher = 10 Freispiele mit
// einem zufaelligen Spezialsymbol: landet es in einem Freispiel auf genug
// Walzen, klappt es ueber die ganzen Walzen auf und zahlt auf allen 10 Linien,
// auch ohne dass die Walzen nebeneinander liegen. 3+ Buecher im Bonus = +10.
//
// Der Server wuerfelt alles, der Browser spielt nur ab. Das Risikospiel
// (Rot/Schwarz) laeuft in server.js, es ist fair (50 %) und aendert die
// Rueckzahlung nicht.
// Rueckzahlung nachrechnen: node bookofrah.js [spins]

const REELS = 5;
const ROWS = 3;
const LINES = [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [1, 2, 2, 2, 1],
    [1, 0, 0, 0, 1],
    [2, 2, 1, 0, 0],
    [0, 0, 1, 2, 2],
    [2, 1, 1, 1, 0]
];
const MAX_WIN = 50000;      // hoechstens das 50.000-fache des Einsatzes je Runde (inkl. Bonus)
const FREE_SPINS = 10;
const BOOK = 'B';

// Symbole: id -> Anzeige und Auszahlung je Anzahl (× Linieneinsatz)
const SYMBOLS = {
    E: { name: 'Explorer', icon: '🤠', pay: { 2: 10, 3: 100, 4: 1000, 5: 5000 } },
    H: { name: 'Horus', icon: '🦅', pay: { 2: 5, 3: 40, 4: 400, 5: 2000 } },
    U: { name: 'Urn', icon: '🏺', pay: { 2: 5, 3: 30, 4: 100, 5: 750 } },
    S: { name: 'Scarab', icon: '🪲', pay: { 2: 5, 3: 30, 4: 100, 5: 750 } },
    A: { name: 'A', icon: 'A', pay: { 3: 5, 4: 40, 5: 150 } },
    K: { name: 'K', icon: 'K', pay: { 3: 5, 4: 40, 5: 150 } },
    Q: { name: 'Q', icon: 'Q', pay: { 3: 5, 4: 25, 5: 100 } },
    J: { name: 'J', icon: 'J', pay: { 3: 5, 4: 25, 5: 100 } },
    T: { name: '10', icon: '10', pay: { 3: 5, 4: 25, 5: 100 } }
};
const BOOK_PAYS = { 3: 2, 4: 20, 5: 200 };   // × Gesamteinsatz

// Gewichte je Walzenfeld (getrennt fuer Basis und Freispiele, wie eigene
// Walzensaetze). Hoechstens ein Buch je Walze (wie auf den echten
// Walzenstreifen), BOOK_W ist die Chance je Walze. Die Buchstaben sind gleich
// schwer – ein schweres 10/J/Q zahlt sonst ueber Fuenfer den Grossteil.
// Im Bonus weniger Buchstaben, damit das Spezialsymbol oefter aufklappt.
// Abgestimmt per Simulation (26.09.2026, je 2–3 Mio Runden): Basisspiel
// ~63 % + Bonus ~32–33 % (jede ~185. Runde, Ø ~59× samt Retriggern) = ~96 %.
// Der Bonus schwankt stark (Spitzen ueber 5000×), unter ~2 Mio Runden wackelt
// die Quote um +-1,5 Prozentpunkte.
const WEIGHTS = {
    base: { E: 2, H: 3, U: 5, S: 5, A: 12, K: 12, Q: 12, J: 12, T: 12 },
    free: { E: 3, H: 4, U: 5, S: 5, A: 7.25, K: 7.25, Q: 7.25, J: 7.25, T: 7.25 }
};
const BOOK_W = { base: 0.085, free: 0.1 };

// Bonus kaufen gibt es im Spiel nicht (Max, 26.09.2026), play({ buy: true })
// dient nur der Simulation: was ist ein Bonus im Mittel wert (~59×)?
const BUY_COST = 61;
// Rueckzahlung laut Simulation, wird im Spiel in der Info angezeigt
const RTP = 96;

function roller(mode) {
    const table = Object.entries(WEIGHTS[mode]);
    const total = table.reduce((s, [, w]) => s + w, 0);
    return () => {
        let r = Math.random() * total;
        for (const [s, w] of table) {
            r -= w;
            if (r < 0) return s;
        }
        return table[table.length - 1][0];
    };
}
const ROLL = { base: roller('base'), free: roller('free') };

// Raster als Walzen: grid[c][r], r = 0 oben
function rollGrid(mode) {
    return Array.from({ length: REELS }, () => {
        const col = Array.from({ length: ROWS }, ROLL[mode]);
        if (Math.random() < BOOK_W[mode]) col[Math.floor(Math.random() * ROWS)] = BOOK;
        return col;
    });
}

// Liniengewinne (× Gesamteinsatz). Buecher ersetzen alles; eine reine
// Buch-Linie zahlt nichts extra, die Buecher zahlen als Scatter.
function lineWins(grid) {
    const wins = [];
    LINES.forEach((line, li) => {
        const syms = line.map((r, c) => grid[c][r]);
        const first = syms.find(s => s !== BOOK);
        if (!first) return;
        let n = 0;
        while (n < REELS && (syms[n] === first || syms[n] === BOOK)) n++;
        const p = SYMBOLS[first].pay[n];
        if (p) wins.push({ line: li, sym: first, n, pay: p / LINES.length });
    });
    return wins;
}

const books = grid => grid.reduce((n, col) => n + col.filter(s => s === BOOK).length, 0);

// Spezialsymbol im Bonus: auf wie vielen Walzen liegt es, reicht das?
function expand(grid, special) {
    const reels = [];
    grid.forEach((col, c) => { if (col.includes(special)) reels.push(c); });
    const p = SYMBOLS[special].pay[reels.length];
    return p ? { reels, pay: p } : null;
}

function evalSpin(grid, special) {
    const wins = lineWins(grid);
    const lw = wins.reduce((s, w) => s + w.pay, 0);
    const nb = books(grid);
    const scatterWin = BOOK_PAYS[Math.min(5, nb)] || 0;
    const ex = special ? expand(grid, special) : null;
    return { grid, wins, lw, books: nb, scatterWin, expand: ex, win: lw + scatterWin + (ex ? ex.pay : 0) };
}

// Eine ganze Runde mit Einsatz 1. Freispiele laufen direkt mit.
function play(opts) {
    opts = opts || {};
    const spins = [];
    let total = 0;
    let freeLeft = 0;
    let special = null;

    if (!opts.buy) {
        const s = evalSpin(rollGrid('base'), null);
        spins.push({ ...s, free: false });
        total += s.win;
        if (s.books >= 3) freeLeft = FREE_SPINS;
    } else {
        freeLeft = FREE_SPINS;
    }
    if (freeLeft) {
        const ids = Object.keys(SYMBOLS);
        special = ids[Math.floor(Math.random() * ids.length)];
    }

    let played = 0;
    while (freeLeft > 0 && played < 200) {
        freeLeft--;
        played++;
        const s = evalSpin(rollGrid('free'), special);
        const retrig = s.books >= 3;
        if (retrig) freeLeft += FREE_SPINS;
        spins.push({ ...s, free: true, retrig, freeLeft, n: played });
        total += s.win;
    }

    const capped = total > MAX_WIN;
    return { spins, special, total: Math.min(total, MAX_WIN), capped, bonus: !!special };
}

// Einsatz anwenden (auf ganze Coins, abgerundet)
function spin(bet, buy) {
    const r = play({ buy });
    return { ...r, cost: buy ? bet * BUY_COST : bet, win: Math.floor(r.total * bet) };
}

function info() {
    return {
        symbols: SYMBOLS, bookPays: BOOK_PAYS, lines: LINES, freeSpins: FREE_SPINS,
        maxWin: MAX_WIN, rtp: RTP
    };
}

module.exports = { REELS, ROWS, LINES, SYMBOLS, BOOK, BOOK_PAYS, FREE_SPINS, BUY_COST, MAX_WIN, RTP, spin, play, info, lineWins };

// Simulation: node bookofrah.js [spins]
if (require.main === module) {
    const n = Number(process.argv[2]) || 1000000;
    let paid = 0, bonus = 0, bonusWin = 0, hit = 0, max = 0, lineOnly = 0;
    for (let i = 0; i < n; i++) {
        const r = play();
        paid += r.total;
        if (r.total > 0) hit++;
        if (r.bonus) {
            bonus++;
            bonusWin += r.total - r.spins[0].win;
        }
        lineOnly += r.spins[0].win;
        max = Math.max(max, r.total);
    }
    let buyPaid = 0, buyMax = 0;
    const nb = Math.max(5000, Math.round(n / 20));
    for (let i = 0; i < nb; i++) { const t = play({ buy: true }).total; buyPaid += t; buyMax = Math.max(buyMax, t); }
    console.log(`Basis: RTP ${(100 * paid / n).toFixed(2)} % (Basisspiel ${(100 * lineOnly / n).toFixed(2)} %, Bonus ${(100 * bonusWin / n).toFixed(2)} %), Trefferquote ${(100 * hit / n).toFixed(1)} %, Bonus 1 zu ${Math.round(n / Math.max(1, bonus))}, groesster Gewinn ${max.toFixed(1)}x`);
    console.log(`Ein Bonus (simuliert direkt gestartet): Ø ${(buyPaid / nb).toFixed(1)}x Einsatz, groesster ${buyMax.toFixed(0)}x`);
}
