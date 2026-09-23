// Plinko: Kugel faellt durch ein Nagelbrett, je Reihe links oder rechts
// (50/50). Nach n Reihen landet sie in Fach k = Anzahl "rechts", also
// binomialverteilt. Der Server wuerfelt den ganzen Pfad, der Browser spielt
// ihn nur ab.
//
// Die Faecher-Multis werden nicht von Hand gepflegt, sondern aus einer Kurve
// je Stufe erzeugt und dann so skaliert, dass die Rueckzahlung knapp unter
// RTP liegt. Nachrechnen: node plinko.js

const RTP = 0.99;
const ROWS_MIN = 8;
const ROWS_MAX = 16;
// Gewinne werden abgerundet; unter 10 Coins Einsatz zahlt ein ×0,4-Fach 0
const MIN_BET = 10;

// Kurve je Stufe: Mitte `mid`, Rand `edge` (bei 8 bzw. 16 Reihen,
// dazwischen geometrisch), `p` = wie spaet es zum Rand hin steigt. Danach
// wird die ganze Kurve skaliert, zaehlen tut also nur das Verhaeltnis
// edge/mid. Ergebnis (node plinko.js): Low bis ×5–14, Medium bis ×20–223,
// High bis ×44–2062.
const RISKS = {
    low: { label: 'Low', mid: 0.7, edge: [5.6, 16], p: 1.4 },
    medium: { label: 'Medium', mid: 0.3, edge: [13, 110], p: 2.2 },
    high: { label: 'High', mid: 0.2, edge: [29, 1000], p: 2.4 }
};

function binom(n, k) {
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
}

function probs(n) {
    return Array.from({ length: n + 1 }, (_, k) => binom(n, k) / 2 ** n);
}

function rtpOf(n, mults) {
    return probs(n).reduce((s, p, k) => s + p * mults[k], 0);
}

// Runden wie auf dem Brett angezeigt: unter 10 auf 0,1 (unter 1 auf 0,01), sonst ganze
function nice(x) {
    if (x < 1) return Math.round(x * 100) / 100;
    if (x < 10) return Math.round(x * 10) / 10;
    return Math.round(x);
}

function build(risk, n) {
    const r = RISKS[risk];
    const t = (n - ROWS_MIN) / (ROWS_MAX - ROWS_MIN);
    const edge = r.edge[0] * Math.pow(r.edge[1] / r.edge[0], t);
    const shape = Array.from({ length: n + 1 }, (_, k) => {
        const d = Math.abs(k - n / 2) / (n / 2);
        return r.mid * Math.pow(edge / r.mid, Math.pow(d, r.p));
    });
    // Ganze Kurve so skalieren, dass die gerundeten Multis knapp unter RTP liegen
    const pr = probs(n);
    let lo = 0, hi = 4;
    for (let i = 0; i < 60; i++) {
        const s = (lo + hi) / 2;
        const m = shape.map((v, k) => nice(Math.max(0.1, v * s)));
        if (rtpOf(n, m) > RTP) hi = s;
        else lo = s;
    }
    const mults = shape.map(v => nice(Math.max(0.1, v * lo)));
    // Feinschliff: die Faecher nahe der Mitte in 0,01-Schritten anheben,
    // solange die Rueckzahlung unter RTP bleibt (symmetrisch)
    const order = Array.from({ length: Math.floor(n / 2) + 1 }, (_, i) => Math.floor(n / 2) - i);
    for (const k of order) {
        const k2 = n - k;
        while (true) {
            const step = mults[k] < 1 ? 0.01 : mults[k] < 10 ? 0.1 : 1;
            const next = [...mults];
            next[k] = Math.round((next[k] + step) * 100) / 100;
            next[k2] = next[k];
            // Monoton bleiben: nie hoeher als das Fach weiter aussen
            if (k > 0 && next[k] > mults[k - 1]) break;
            if (rtpOf(n, next) > RTP) break;
            mults[k] = next[k];
            mults[k2] = next[k2];
        }
        // Nur so weit nach aussen, wie es noch Wirkung hat
        if (pr[k] < 0.01) break;
    }
    return mults;
}

const TABLES = {};
for (const risk of Object.keys(RISKS)) {
    TABLES[risk] = {};
    for (let n = ROWS_MIN; n <= ROWS_MAX; n++) TABLES[risk][n] = build(risk, n);
}

function valid(risk, rows) {
    return !!RISKS[risk] && Number.isInteger(rows) && rows >= ROWS_MIN && rows <= ROWS_MAX;
}

// Ein Drop: Pfad aus 0 (links) und 1 (rechts), Fach, Multi, Gewinn
function drop(bet, risk, rows) {
    const path = Array.from({ length: rows }, () => Math.random() < 0.5 ? 1 : 0);
    const slot = path.reduce((a, b) => a + b, 0);
    const mult = TABLES[risk][rows][slot];
    return { path, slot, mult, win: Math.floor(bet * mult) };
}

// Fuer den Browser: Stufen, Reihen, alle Tabellen
function info() {
    const risks = {};
    for (const [k, r] of Object.entries(RISKS)) risks[k] = r.label;
    return { rtp: RTP, minBet: MIN_BET, rowsMin: ROWS_MIN, rowsMax: ROWS_MAX, risks, tables: TABLES };
}

module.exports = { RTP, MIN_BET, ROWS_MIN, ROWS_MAX, RISKS, TABLES, valid, drop, info, rtpOf };

if (require.main === module) {
    for (const risk of Object.keys(RISKS)) {
        for (let n = ROWS_MIN; n <= ROWS_MAX; n++) {
            const m = TABLES[risk][n];
            console.log(`${RISKS[risk].label.padEnd(6)} ${String(n).padStart(2)} Reihen  RTP ${(rtpOf(n, m) * 100).toFixed(2)} %  max ×${m[0]}  | ${m.join(' ')}`);
        }
    }
    // Stichprobe gegen die exakte Rechnung
    const N = Number(process.argv[2]) || 0;
    if (N) {
        let paid = 0;
        for (let i = 0; i < N; i++) paid += drop(100, 'high', 16).win;
        console.log(`Simulation High/16, ${N} Drops a 100: ${(paid / N).toFixed(2)} %`);
    }
}
