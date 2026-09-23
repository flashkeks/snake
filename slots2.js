// "Sweet Kek" – Tumble-Slot im Stil von Starlight Princess / Gates of Olympus.
//
// 6 Walzen x 5 Reihen. Gezahlt wird ueberall: 8 oder mehr gleiche Symbole
// irgendwo auf dem Raster. Gewinnsymbole platzen, der Rest faellt nach unten,
// oben kommt Neues nach (Tumble), bis nichts mehr gewinnt.
//
// Multiplikator-Kugeln (🔮 ×2 bis ×500) bleiben liegen. Endet eine Tumble-Folge
// mit Gewinn, werden alle Kugeln auf dem Raster addiert und mit dem Gewinn
// multipliziert. In den Freispielen sammeln sie sich zu einem Gesamt-
// multiplikator, der fuer den Rest des Bonus gilt.
//
// 4+ Scatter (⭐) irgendwo loesen 10 Freispiele aus, 3+ im Bonus geben +5.
// Der Server wuerfelt alles, der Browser spielt die Schritte nur ab.
// Rueckzahlung nachrechnen: node slots2.js

const COLS = 6;
const ROWS = 5;
const MAX_WIN = 100000;     // hoechstens das 100.000-fache des Einsatzes je Spin (inkl. Bonus)
const FREE_SPINS = 10;
const RETRIGGER = 5;

// Auszahlung (× Einsatz) fuer 8–9, 10–11, 12+ gleiche Symbole
const PAYS = {
    '👑': [6.93, 17.32, 34.65],
    '💎': [1.73, 6.93, 17.32],
    '🌙': [1.39, 3.46, 10.4],
    '🍪': [1.04, 1.39, 8.32],
    '🧁': [0.69, 1.04, 6.93],
    '🍩': [0.56, 0.83, 5.54],
    '🍭': [0.35, 0.69, 3.46],
    '🍬': [0.27, 0.62, 2.77]
};
const SCATTER = 'S';
const SCATTER_PAYS = { 4: 3, 5: 5, 6: 100 };

// Symbol-Gewichte je Modus (wie getrennte Walzensaetze): in beiden Modi viele
// kleine Suessigkeiten, also oft kleine Tumble-Gewinne. Kugeln sind im
// Basisspiel selten (~5 % der Spins zeigen eine), im Bonus kommen sie staendig.
// Abgestimmt per Simulation (23.09.2026, je 1,6 Mio Basis-Spins und 100.000
// gekaufte Boni): Basis ~65,8 % + Bonus ~33,7 % (jeder ~280. Spin, Ø ~95x)
// = ~99,5 % Rueckzahlung. Der Scatter ist extrem empfindlich: 1,72 gibt
// 99,2 %, 1,735 schon ~100,5 %. Unter ~1 Mio Spins schwankt die Quote um
// +-1 Prozentpunkt.
const WEIGHTS = {
    base: { '👑': 8, '💎': 9, '🌙': 9, '🍪': 10, '🧁': 10, '🍩': 14, '🍭': 18, '🍬': 21 },
    free: { '👑': 8, '💎': 9, '🌙': 9, '🍪': 10, '🧁': 10, '🍩': 13, '🍭': 16, '🍬': 19 }
};
const SCATTER_W = { base: 1.725, free: 1.3 };
const ORB_W = { base: 0.15, free: 6 };

// Kugelwerte und wie oft sie kommen
const ORBS = [
    [2, 300], [3, 200], [4, 150], [5, 120], [6, 80], [8, 60], [10, 50], [12, 30],
    [15, 25], [20, 18], [25, 12], [50, 6], [100, 3], [250, 1], [500, 0.4]
];

// Bonus kaufen: so viel mal der Einsatz. Ein Bonus bringt im Mittel ~95x,
// bei 96x Preis sind das ~99 %.
const BUY_COST = 96;

function pick(list) {
    let r = Math.random() * list.reduce((s, [, w]) => s + w, 0);
    for (const [v, w] of list) {
        r -= w;
        if (r < 0) return v;
    }
    return list[list.length - 1][0];
}

function makeRoller(mode) {
    const table = [
        ...Object.entries(WEIGHTS[mode]),
        [SCATTER, SCATTER_W[mode]],
        ['ORB', ORB_W[mode]]
    ];
    return () => {
        const s = pick(table);
        return s === 'ORB' ? 'x' + pick(ORBS) : s;
    };
}

// Raster als Spalten: grid[c][r], r = 0 oben
function fill(roll) {
    return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, roll));
}

function copy(grid) {
    return grid.map(col => col.slice());
}

const isOrb = s => typeof s === 'string' && s[0] === 'x';

function payFor(sym, n) {
    const p = PAYS[sym];
    if (!p || n < 8) return 0;
    return n >= 12 ? p[2] : n >= 10 ? p[1] : p[0];
}

function countScatters(grid) {
    let n = 0;
    for (const col of grid) for (const s of col) if (s === SCATTER) n++;
    return n;
}

// Eine komplette Tumble-Folge. Liefert die Zwischenschritte fuer die Animation.
function tumble(roll) {
    let grid = fill(roll);
    const steps = [{ grid: copy(grid), wins: [] }];
    let win = 0;

    for (let guard = 0; guard < 50; guard++) {
        const counts = {};
        for (const col of grid) for (const s of col) if (PAYS[s]) counts[s] = (counts[s] || 0) + 1;
        const wins = Object.entries(counts).filter(([, n]) => n >= 8).map(([sym, n]) => ({ sym, n, pay: payFor(sym, n) }));
        if (!wins.length) break;

        const hit = new Set(wins.map(w => w.sym));
        const cells = [];
        grid.forEach((col, c) => col.forEach((s, r) => { if (hit.has(s)) cells.push([c, r]); }));
        win += wins.reduce((s, w) => s + w.pay, 0);
        steps[steps.length - 1].wins = wins;
        steps[steps.length - 1].pop = cells;

        // Platzen lassen, nachrutschen, oben auffuellen
        grid = grid.map(col => {
            const keep = col.filter(s => !hit.has(s));
            const fresh = Array.from({ length: ROWS - keep.length }, roll);
            return fresh.concat(keep);
        });
        steps.push({ grid: copy(grid), wins: [] });
    }

    const orbs = [];
    for (const col of grid) for (const s of col) if (isOrb(s)) orbs.push(Number(s.slice(1)));
    return { steps, win, orbs, scatters: countScatters(grid), grid };
}

// Ein ganzer Spin mit Einsatz 1. Freispiele laufen direkt mit.
function play(opts) {
    opts = opts || {};
    const baseRoll = makeRoller('base');
    const freeRoll = makeRoller('free');
    const spins = [];
    let total = 0;
    let freeLeft = 0;

    // Je Spin fuer die Anzeige: tw = Tumble-Gewinn ohne Multi, orbSum = Kugeln,
    // die in diesem Spin gezaehlt haben (nur mit Gewinn), multBefore/mult =
    // Multiplikator vor und nach dem Spin, scatterWin = Scatter-Auszahlung.
    if (!opts.buy) {
        const t = tumble(baseRoll);
        const tw = t.win;
        const orbSum = tw > 0 ? t.orbs.reduce((a, b) => a + b, 0) : 0;
        const mult = orbSum;
        const scatterWin = SCATTER_PAYS[Math.min(6, t.scatters)] || 0;
        const win = tw * (mult || 1) + scatterWin;
        spins.push({ steps: t.steps, tw, orbSum, multBefore: 0, mult, scatterWin, win, scatters: t.scatters, free: false });
        total += win;
        if (t.scatters >= 4) freeLeft = FREE_SPINS;
    } else {
        // Gekaufter Bonus: startet direkt mit den Freispielen
        freeLeft = FREE_SPINS;
    }

    // Im Bonus bleibt der Multiplikator fuer alle restlichen Freispiele stehen
    let totalMult = 0;
    let played = 0;
    while (freeLeft > 0 && played < 100) {
        freeLeft--;
        played++;
        const t = tumble(freeRoll);
        const tw = t.win;
        const orbSum = tw > 0 ? t.orbs.reduce((a, b) => a + b, 0) : 0;
        const multBefore = totalMult;
        totalMult += orbSum;
        const win = tw * (totalMult || 1);
        const retrig = t.scatters >= 3;
        if (retrig) freeLeft += RETRIGGER;
        spins.push({ steps: t.steps, tw, orbSum, multBefore, mult: totalMult, scatterWin: 0, win, scatters: t.scatters, free: true, retrig, freeLeft, n: played });
        total += win;
    }

    const capped = total > MAX_WIN;
    return { spins, total: Math.min(total, MAX_WIN), capped, bonus: spins.some(s => s.free) };
}

// Einsatz anwenden (auf ganze Coins, abgerundet)
function spin(bet, buy) {
    const r = play({ buy });
    return {
        ...r,
        cost: buy ? bet * BUY_COST : bet,
        win: Math.floor(r.total * bet)
    };
}

module.exports = {
    COLS, ROWS, PAYS, SCATTER_PAYS, FREE_SPINS, RETRIGGER, BUY_COST, MAX_WIN,
    WEIGHTS, SCATTER_W, ORB_W,
    spin, play
};

// Simulation: node slots2.js [spins]
if (require.main === module) {
    const n = Number(process.argv[2]) || 200000;
    let paid = 0, bonus = 0, bonusWin = 0, hit = 0, max = 0;
    for (let i = 0; i < n; i++) {
        const r = play();
        paid += r.total;
        if (r.total > 0) hit++;
        if (r.bonus) {
            bonus++;
            bonusWin += r.total;
        }
        max = Math.max(max, r.total);
    }
    let buyPaid = 0;
    const nb = Math.max(2000, Math.round(n / 50));
    for (let i = 0; i < nb; i++) buyPaid += play({ buy: true }).total;
    console.log(`Basis: RTP ${(100 * paid / n).toFixed(2)} %, Trefferquote ${(100 * hit / n).toFixed(1)} %, Bonus 1 zu ${Math.round(n / Math.max(1, bonus))}, groesster Gewinn ${max.toFixed(1)}x`);
    console.log(`Bonus-Kauf: Ø ${(buyPaid / nb).toFixed(1)}x Einsatz, RTP bei ${BUY_COST}x: ${(100 * buyPaid / nb / BUY_COST).toFixed(2)} %`);
}
