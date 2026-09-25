// Luck (Admin v2, 23.09.2026): der Admin kann einem Konto fuer die naechsten
// N Runden eines Spiels einen Mindest-Gewinn vorgeben (u.rig[game] =
// { n, min, bonus }). Der Server erzwingt ihn, ohne die Spiele selbst
// anzufassen:
//   slots     Drilling mit Quote >= min wird direkt gebaut
//   starlight Spin (oder Bonus Buy) wird neu gewuerfelt, bis er >= min zahlt
//             (bzw. die Freispiele ausloest); Zeitbudget 400 ms, sonst der
//             beste gefundene
//   plinko    Fach mit Multi >= min wird gewaehlt, der Pfad passend gebaut
//   daily     Rad wird neu gedreht, bis der Wert >= min ist
//   crossy    N Laeufe ohne Unfall
// Jede Aenderung steht im Admin-Log; der Spieler sieht davon nichts.

const GAMES = {
    slots: { name: '🎰 Slots', mins: [2, 6, 10, 20, 40, 80, 200, 1000], unit: '×' },
    starlight: { name: '🌟 Budget Starlight (spins + bonus buy)', mins: [5, 20, 50, 100, 250, 500, 1000, 5000], unit: '×', bonus: true },
    plinko: { name: '🔻 Plinko', mins: [2, 9, 26, 41, 110, 130, 1000], unit: '×' },
    daily: { name: '🎡 Daily wheel', mins: [500, 1000, 2500, 5000, 10000, 25000], unit: 'coins' },
    crossy: { name: '🐔 Crossy Road (no crash)', mins: null }
};

const BUDGET_MS = 400;

// Klassischer Automat: Drilling bauen (gewichtet unter den passenden Symbolen)
function slotsSpin(slots, bet, min) {
    let cands = slots.SYMBOLS.filter(s => s.three >= min);
    if (!cands.length) cands = [slots.SYMBOLS.reduce((a, b) => a.three > b.three ? a : b)];
    let r = Math.random() * cands.reduce((s, x) => s + x.weight, 0);
    let pick = cands[0];
    for (const x of cands) {
        r -= x.weight;
        if (r < 0) { pick = x; break; }
    }
    return { reels: [pick.s, pick.s, pick.s], mult: pick.three, win: Math.floor(bet * pick.three) };
}

// Starlight: neu wuerfeln, bis es passt; bester Versuch als Rueckfall
function starlightSpin(slots2, bet, buy, rig) {
    const t0 = Date.now();
    let best = null;
    const score = r => (rig.bonus && !r.bonus ? -1e9 : 0) + r.win;
    do {
        const r = slots2.spin(bet, buy);
        if (!best || score(r) > score(best)) best = r;
        if (r.win >= bet * rig.min && (!rig.bonus || r.bonus)) return r;
    } while (Date.now() - t0 < BUDGET_MS);
    return best;
}

// Plinko: Fach waehlen, Pfad mit genau so vielen Rechts-Schritten mischen
function plinkoDrop(plinko, bet, risk, min) {
    const mults = plinko.RISKS[risk].mults;
    let slots = mults.map((m, i) => [m, i]).filter(([m]) => m >= min).map(([, i]) => i);
    if (!slots.length) {
        const top = Math.max(...mults);
        slots = mults.map((m, i) => [m, i]).filter(([m]) => m === top).map(([, i]) => i);
    }
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const path = Array.from({ length: plinko.ROWS }, (_, i) => i < slot ? 1 : 0);
    for (let i = path.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [path[i], path[j]] = [path[j], path[i]];
    }
    const mult = mults[slot];
    return { path, slot, mult, win: Math.floor(bet * mult) };
}

// Daily Wheel: neu drehen, bis der Wert reicht
function dailySpin(casino, min) {
    let best = null;
    for (let i = 0; i < 5000; i++) {
        const r = casino.spinWheel();
        if (!best || r.value > best.value) best = r;
        if (r.value >= min) return r;
    }
    return best;
}

module.exports = { GAMES, slotsSpin, starlightSpin, plinkoDrop, dailySpin };
