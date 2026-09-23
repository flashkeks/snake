// Kleine Casino-Spiele ohne Tisch: Daily Wheel und Crossy Road.
// Beides wuerfelt nur der Server; der Browser zeigt an.

// ---------- Daily Wheel ----------
// Einmal pro Kalendertag (Europe/Berlin) pro Konto. 16 gleich grosse Felder
// fuers Auge, gewuerfelt wird nach Gewicht je Wert: im Mittel ~1000 Coins.

const WHEEL = [100, 1000, 250, 5000, 100, 500, 250, 2500, 100, 10000, 250, 500, 100, 1000, 250, 25000];
const WHEEL_WEIGHTS = { 100: 30, 250: 25, 500: 18, 1000: 12, 2500: 8, 5000: 4.5, 10000: 2, 25000: 0.5 };

function berlinDay(t) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(t || new Date());
}

function spinWheel() {
    const values = Object.keys(WHEEL_WEIGHTS).map(Number);
    let r = Math.random() * values.reduce((s, v) => s + WHEEL_WEIGHTS[v], 0);
    let value = values[values.length - 1];
    for (const v of values) {
        r -= WHEEL_WEIGHTS[v];
        if (r < 0) {
            value = v;
            break;
        }
    }
    // Eines der Felder mit diesem Wert, damit das Rad auch dort stehen bleibt
    const slots = WHEEL.map((v, i) => v === value ? i : -1).filter(i => i >= 0);
    return { value, index: slots[Math.floor(Math.random() * slots.length)] };
}

// ---------- Crossy Road ----------
// Ein Huhn ueber die Strasse: jede Spur ueberlebt man mit (1 - p).
// Multiplikator nach k Spuren = RTP / (1 - p)^k, also zahlt jede
// Cashout-Strategie im Mittel RTP (99 %). Letzte Spur = automatisch Cashout.

const CROSS_RTP = 0.99;
const DIFFS = {
    easy: { p: 0.08, lanes: 24, label: 'Easy' },
    medium: { p: 0.14, lanes: 22, label: 'Medium' },
    hard: { p: 0.22, lanes: 20, label: 'Hard' },
    hardcore: { p: 0.4, lanes: 15, label: 'Hardcore' }
};

function crossMult(diff, k) {
    if (k <= 0) return 1;
    const d = DIFFS[diff];
    return Math.floor(100 * CROSS_RTP / Math.pow(1 - d.p, k)) / 100;
}

function crossTable() {
    const out = {};
    for (const [k, d] of Object.entries(DIFFS)) {
        out[k] = { label: d.label, lanes: d.lanes, p: d.p, mults: Array.from({ length: d.lanes }, (_, i) => crossMult(k, i + 1)) };
    }
    return out;
}

module.exports = { WHEEL, WHEEL_WEIGHTS, berlinDay, spinWheel, DIFFS, crossMult, crossTable, CROSS_RTP };

// Nachrechnen: node casino.js
if (require.main === module) {
    const ev = Object.entries(WHEEL_WEIGHTS).reduce((s, [v, w]) => s + v * w, 0) / Object.values(WHEEL_WEIGHTS).reduce((a, b) => a + b, 0);
    console.log(`Daily Wheel: im Mittel ${ev.toFixed(0)} Coins`);
    for (const [k, d] of Object.entries(DIFFS)) {
        // Strategie "immer bis Spur n": RTP = (1-p)^n * mult(n)
        const rtps = [1, 3, d.lanes].map(n => (Math.pow(1 - d.p, n) * crossMult(k, n) * 100).toFixed(2));
        console.log(`${d.label}: max ${crossMult(k, d.lanes)}x, RTP bei 1/3/alle Spuren: ${rtps.join(' / ')} %`);
    }
}
