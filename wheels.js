// Tages-Raeder (6.1, Max): einmal je Kalendertag (Europe/Berlin) gratis drehen.
//
//   pack  Daily Pack Wheel (Kekemon): 1–3 Daily Booster, 20 % Kek Mega
//         Booster, 5 % Jackpot Booster (gibt es nur hier)
//   case  Daily Case Wheel (Arena): 1–3 Elite cases, 20 % Elite+ case,
//         5 % Jackpot case (gibt es nur hier)
//
// Gewinne landen im Inventar (u.packs bzw. u.arena.cases) und werden dort
// geoeffnet – oder gehandelt. Die Felder des Rads sind nur Optik; gezogen wird
// nach WEIGHTS, danach ein passendes Feld fuer die Animation gesucht.

const casino = require('./casino');

const WEIGHTS = { small1: 40, small2: 25, small3: 10, big: 20, jackpot: 5 };
// 12 Felder in dieser Reihenfolge auf dem Rad
const LAYOUT = ['small1', 'small2', 'small1', 'big', 'small1', 'small3', 'small2', 'big', 'small1', 'jackpot', 'small2', 'big'];

const WHEELS = {
    pack: { field: 'dailyPackDay', prizes: { small1: ['daily', 1], small2: ['daily', 2], small3: ['daily', 3], big: ['mixed', 1], jackpot: ['jackpot', 1] } },
    case: { field: 'dailyCaseDay', prizes: { small1: ['elite', 1], small2: ['elite', 2], small3: ['elite', 3], big: ['elite50', 1], jackpot: ['jackpot', 1] } }
};

function roll() {
    const keys = Object.keys(WEIGHTS);
    let r = Math.random() * keys.reduce((s, k) => s + WEIGHTS[k], 0);
    for (const k of keys) {
        r -= WEIGHTS[k];
        if (r < 0) return k;
    }
    return keys[0];
}

module.exports = function createWheels(h) {
    // h: { accounts }

    const today = () => casino.berlinDay();

    // Felder fuer den Browser: [id, anzahl]
    function segments(kind) {
        const w = WHEELS[kind];
        return LAYOUT.map(slot => w.prizes[slot]);
    }

    function ready(kind, u) {
        return !!u && u[WHEELS[kind].field] !== today();
    }

    // Drehen: { err } oder { index, prize: [id, n] }. Das Einbuchen macht der
    // Aufrufer (Packs am Konto, Cases im Arena-Teil).
    function spin(kind, key) {
        if (!Object.prototype.hasOwnProperty.call(WHEELS, kind)) return { err: 'Unknown wheel' };
        const u = h.accounts.get(key);
        if (!u) return { err: 'Log in first' };
        if (!ready(kind, u)) return { err: 'Already spun today – come back tomorrow' };
        u[WHEELS[kind].field] = today();
        const slot = roll();
        const idx = LAYOUT.map((s, i) => s === slot ? i : -1).filter(i => i >= 0);
        const index = idx[Math.floor(Math.random() * idx.length)];
        h.accounts.touch();
        return { index, prize: WHEELS[kind].prizes[slot], slot };
    }

    return { segments, ready, spin, WEIGHTS };
};
