// Plinko: Kugel faellt durch ein Nagelbrett mit fest 16 Reihen, je Reihe
// links oder rechts (50/50). Unten landet sie in Fach k = Anzahl "rechts",
// also binomialverteilt. Der Server wuerfelt den ganzen Pfad, der Browser
// spielt ihn nur ab.
//
// Die Faecher-Multis sind fest vorgegeben (Wunsch Max, 23.09.2026: gerade
// Zahlen, immer 16 Reihen). Rueckzahlung je Stufe ~99 %. Nachrechnen:
// node plinko.js

const ROWS = 16;
// Gewinne werden abgerundet; unter 10 Coins Einsatz zahlt ein ×0,2-Fach 0
const MIN_BET = 10;

const RISKS = {
    low: { label: 'Low', mults: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16] },
    medium: { label: 'Medium', mults: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110] },
    high: { label: 'High', mults: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000] }
};

function binom(n, k) {
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
}

function rtpOf(mults) {
    return mults.reduce((s, m, k) => s + m * binom(ROWS, k) / 2 ** ROWS, 0);
}

function valid(risk) {
    return Object.prototype.hasOwnProperty.call(RISKS, risk);
}

// Ein Drop: Pfad aus 0 (links) und 1 (rechts), Fach, Multi, Gewinn
function drop(bet, risk) {
    const path = Array.from({ length: ROWS }, () => Math.random() < 0.5 ? 1 : 0);
    const slot = path.reduce((a, b) => a + b, 0);
    const mult = RISKS[risk].mults[slot];
    return { path, slot, mult, win: Math.floor(bet * mult) };
}

// Fuer den Browser: Reihen, Stufen, Tabellen
function info() {
    const risks = {};
    const tables = {};
    for (const [k, r] of Object.entries(RISKS)) {
        risks[k] = r.label;
        tables[k] = r.mults;
    }
    return { rows: ROWS, minBet: MIN_BET, risks, tables };
}

module.exports = { ROWS, MIN_BET, RISKS, valid, drop, info, rtpOf };

if (require.main === module) {
    for (const r of Object.values(RISKS)) {
        console.log(`${r.label.padEnd(6)} RTP ${(rtpOf(r.mults) * 100).toFixed(2)} %  | ${r.mults.join(' ')}`);
    }
    // Stichprobe gegen die exakte Rechnung
    const N = Number(process.argv[2]) || 0;
    if (N) {
        let paid = 0;
        for (let i = 0; i < N; i++) paid += drop(100, 'high').win;
        console.log(`Simulation High, ${N} Drops a 100: ${(paid / N).toFixed(2)} %`);
    }
}
