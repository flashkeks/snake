// "Avalon Silver" – Cluster-Drop-Slot nach dem Vorbild von Avalon Gold (ELK Studios).
//
// 6 Walzen, 4 Reihen zu Beginn (4.096 Wege), bis zu 8 Reihen (262.144 Wege).
// Gezahlt wird ueber Wege: gleiche Symbole auf nebeneinanderliegenden Walzen ab
// der linken, mindestens 3. Anzahl Wege = Produkt der Treffer je Walze.
//
// Wie im Original:
// - Avalanche: Gewinnsymbole verschwinden, der Rest faellt, neue fallen nach –
//   und mit jeder Lawine kommt eine Reihe oben dazu (bis 8). Im Basisspiel
//   startet der naechste Spin wieder mit 4 Reihen.
// - Big Symbols (2×2, 3×3, 4×4): zaehlen wie so viele Einzelsymbole. Sie fallen
//   nicht; Luecken unter ihnen fuellen sich mit ihrem Symbol.
// - Goldrahmen: oeffnen sich ueber einem gerahmten Symbol Luecken, werden sie
//   zu Wilds (Expanding Wild).
// - Mystery Boxes: blockieren, bis 5 oder mehr im Bild sind (ein Big Box zaehlt
//   je Feld), dann oeffnen sie sich: Symbol (alle dasselbe), Wild oder ein
//   Avalon-Feature – Coin (× Einsatz), Multiplier (alle Coins im Bild ×2…×10),
//   Swiper (setzt eine 1 vor den zuletzt aufgedeckten Coin: 7 -> 17), Collect
//   (zahlt alle Coins im Bild und oeffnet die Boxen neu), Redrop (neuer Drop,
//   die Boxen oeffnen sich danach sicher noch mal). Am Ende zahlen die Coins
//   im Bild, Boxen ohne Symbol verschwinden.
// - Freispiele (Free Drops): 3/4/5/6 Excalibur = 10/15/20/25, im Bonus genauso
//   nachtriggerbar. Im Bonus bleiben Mystery Boxes liegen, bis sie aufgehen,
//   und die Safety Level steigt nach jedem Gewinn-Spin um eine Reihe – der
//   naechste Drop startet mit so vielen Reihen (bis 8).
// - Kein Bonus-Kauf (Max, 26.09.2026: „Bonus bekommen, aber nicht kaufen“),
//   also auch keine X-iter-Kaeufe.
//
// Der Server wuerfelt die ganze Runde und schickt je Spin die Abfolge der
// Zustaende (frames); der Browser spielt sie nur ab.
// Rueckzahlung nachrechnen: node avalon.js [runden]

const REELS = 6;
const MIN_ROWS = 4;
const MAX_ROWS = 8;
const MAX_WIN = 25000;
const FREE = { 3: 10, 4: 15, 5: 20, 6: 25 };
const WILD = 'W', BONUS = 'X', BOX = 'M';
const MYST_MIN = 5;

// Auszahlung je Weg (× Einsatz) fuer 3/4/5/6 gleiche. Wie im Original: die
// Buchstaben zahlen fuer sechs 0,3×, die Tiere 0,8–1×, die Hohen 2–5×.
const SYMBOLS = {
    R: { name: 'Lady of the Lake', icon: '🧝‍♀️', pay: [0.5, 1, 2, 5] },
    G: { name: 'Holy Grail', icon: '🏆', pay: [0.4, 0.8, 1.5, 3] },
    C: { name: 'Crown', icon: '👑', pay: [0.3, 0.6, 1.2, 2.5] },
    S: { name: 'Shield', icon: '🛡️', pay: [0.3, 0.5, 1, 2] },
    D: { name: 'Stag', icon: '🦌', pay: [0.15, 0.3, 0.5, 1] },
    O: { name: 'Owl', icon: '🦉', pay: [0.15, 0.25, 0.5, 0.9] },
    F: { name: 'Wolf', icon: '🐺', pay: [0.1, 0.2, 0.4, 0.8] },
    V: { name: 'Swan', icon: '🦢', pay: [0.1, 0.2, 0.4, 0.8] },
    A: { name: 'A', icon: 'A', pay: [0.05, 0.1, 0.2, 0.3] },
    K: { name: 'K', icon: 'K', pay: [0.05, 0.1, 0.2, 0.3] },
    Q: { name: 'Q', icon: 'Q', pay: [0.05, 0.1, 0.15, 0.3] },
    J: { name: 'J', icon: 'J', pay: [0.05, 0.1, 0.15, 0.3] }
};
const PAY_IDS = Object.keys(SYMBOLS);

// Die Tabelle oben ist die Anzeige wie im Original; gezahlt wird sie mal PAY_SCALE
// (sonst waeren 4.096+ Wege mit Lawinen weit ueber 100 % – abgestimmt per Simulation)
let PAY_SCALE = Number(process.env.AV_PAY) || 0.22;

// Gewichte der Einzelsymbole (Wild, Box und Excalibur extra)
const WEIGHTS = { R: 3, G: 4, C: 5, S: 6, D: 8, O: 8, F: 9, V: 9, A: 12, K: 12, Q: 13, J: 13 };
// Abgestimmt per Simulation, siehe unten (TUNE)
const TUNE = {
    wild: 0.018,        // Chance je Feld auf ein Wild
    box: { base: Number(process.env.AV_BOX) || 0.012, free: Number(process.env.AV_FBOX) || 0.04 },   // Chance je Feld auf eine Mystery Box
    bonus: { base: Number(process.env.AV_BON) || 0.036, free: 0.024 }, // Chance je Walze auf ein Excalibur (hoechstens eins je Walze)
    big: { base: 0.22, free: 0.3 },     // Chance je Drop auf ein Big Symbol
    bigSize: [[2, 70], [3, 24], [4, 6]],
    bigBox: 0.12,       // Big Symbol ist eine Mystery Box
    frame: { base: 0.16, free: Number(process.env.AV_FFR) || 0.3 },  // Chance je Drop auf einen Goldrahmen
    // Was eine Box zeigt
    reveal: [['sym', 44], ['wild', 10], ['coin', 34], ['mult', 5], ['swipe', 3], ['collect', 2.5], ['redrop', 1.5]],
    coins: [[0.2, 22], [0.5, 22], [1, 20], [2, 14], [3, 9], [5, 7], [10, 4], [25, 1.5], [50, 0.5]],
    mults: [[2, 60], [3, 25], [5, 11], [10, 4]]
};
// Rueckzahlung laut Simulation (26.09.2026): Basisspiel ~63–66 %, Bonus jede ~230. Runde
// mit Ø ~70× (10–25 Drops) = ~30 %, zusammen ~96 %. Der Bonus hat Spitzen ueber 10.000×,
// unter ~1 Mio Runden wackelt die Quote um mehrere Prozentpunkte – den Bonuswert besser
// direkt messen: play({ buy: true }) (nur Simulation, im Spiel gibt es keinen Kauf).
const RTP = 96;

const pickW = table => {
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [v, w] of table) { r -= w; if (r < 0) return v; }
    return table[table.length - 1][0];
};
const SYM_TABLE = Object.entries(WEIGHTS);
const rollSym = () => pickW(SYM_TABLE);

// ---------- Brett ----------
// Zellen: { id, s, c, r, z (Kantenlaenge, 1 = normal), f (Goldrahmen), ew (Expanding Wild),
//           box: { open, v } }  r = 0 ist die UNTERSTE Reihe, das Brett waechst nach oben.
function createBoard(h) {
    let seq = 0;
    const b = { h, cells: [], nextId: () => ++seq };
    return b;
}
function occ(b) {
    const m = new Map();
    for (const x of b.cells) for (let dc = 0; dc < x.z; dc++) for (let dr = 0; dr < x.z; dr++) m.set((x.c + dc) + ',' + (x.r + dr), x);
    return m;
}
function cell(b, s, c, r, z = 1, extra) {
    const x = { id: b.nextId(), s, c, r, z, ...extra };
    b.cells.push(x);
    return x;
}

// Luecken fuellen (mode base/free). big: ob ein Big Symbol / Rahmen erlaubt ist (nur beim frischen Drop).
function fill(b, mode, big) {
    const o = occ(b);
    const free = (c, r, z) => {
        if (c + z > REELS || r + z > b.h) return false;
        for (let dc = 0; dc < z; dc++) for (let dr = 0; dr < z; dr++) if (o.has((c + dc) + ',' + (r + dr))) return false;
        return true;
    };
    if (big && Math.random() < TUNE.big[mode]) {
        const z = pickW(TUNE.bigSize);
        const spots = [];
        for (let c = 0; c + z <= REELS; c++) for (let r = 0; r + z <= b.h; r++) if (free(c, r, z)) spots.push([c, r]);
        if (spots.length) {
            const [c, r] = spots[Math.floor(Math.random() * spots.length)];
            const s = Math.random() < TUNE.bigBox ? BOX : rollSym();
            const x = cell(b, s, c, r, z, s === BOX ? { box: { open: false } } : undefined);
            for (let dc = 0; dc < z; dc++) for (let dr = 0; dr < z; dr++) o.set((c + dc) + ',' + (r + dr), x);
        }
    }
    // Excalibur: hoechstens eins je Walze (auch ueber Lawinen hinweg)
    const hasBonus = new Set(b.cells.filter(x => x.s === BONUS).map(x => x.c));
    const fresh = [];
    for (let c = 0; c < REELS; c++) {
        for (let r = 0; r < b.h; r++) {
            if (o.has(c + ',' + r)) continue;
            let s;
            if (!hasBonus.has(c) && Math.random() < TUNE.bonus[mode] / MIN_ROWS) { s = BONUS; hasBonus.add(c); }
            else if (Math.random() < TUNE.box[mode]) s = BOX;
            else if (Math.random() < TUNE.wild) s = WILD;
            else s = rollSym();
            const x = cell(b, s, c, r, 1, s === BOX ? { box: { open: false } } : undefined);
            o.set(c + ',' + r, x);
            fresh.push(x);
        }
    }
    if (big && Math.random() < TUNE.frame[mode]) {
        const cand = fresh.filter(x => SYMBOLS[x.s] && x.r < b.h - 1);
        if (cand.length) cand[Math.floor(Math.random() * cand.length)].f = 1;
    }
}

// Schwerkraft: Big Symbols bleiben stehen, Luecken darunter fuellen sich mit ihrem Symbol.
// Einzelsymbole fallen, bis sie auf etwas stehen. Danach Goldrahmen: freie Felder ueber
// einem gerahmten Symbol werden Wilds.
function collapse(b) {
    let o = occ(b);
    for (const x of b.cells.filter(x => x.z > 1)) {
        for (let dc = 0; dc < x.z; dc++) {
            const c = x.c + dc;
            for (let r = x.r - 1; r >= 0 && !o.has(c + ',' + r); r--) {
                const y = cell(b, x.s, c, r, 1, x.s === BOX ? { box: { open: false } } : undefined);
                y.bf = 1;
                o.set(c + ',' + r, y);
            }
        }
    }
    for (let c = 0; c < REELS; c++) {
        const col = b.cells.filter(x => x.z === 1 && x.c === c).sort((a, z) => a.r - z.r);
        o = occ(b);
        for (const x of col) {
            let r = x.r;
            o.delete(c + ',' + r);
            while (r > 0 && !o.has(c + ',' + (r - 1))) r--;
            x.r = r;
            o.set(c + ',' + r, x);
        }
    }
    o = occ(b);
    for (const x of b.cells.filter(x => x.f)) {
        let any = false;
        for (let r = x.r + 1; r < b.h; r++) {
            if (o.has(x.c + ',' + r)) continue;
            const w = cell(b, WILD, x.c, r, 1, { ew: 1 });
            o.set(x.c + ',' + r, w);
            any = true;
        }
        if (any) delete x.f;
    }
}

// ---------- Gewinne ueber Wege ----------
function evalWays(b) {
    const o = occ(b);
    const wins = [];
    const hit = new Set();
    for (const s of PAY_IDS) {
        const per = [];
        const cellsOn = [];
        for (let c = 0; c < REELS; c++) {
            let n = 0;
            const xs = new Set();
            for (let r = 0; r < b.h; r++) {
                const x = o.get(c + ',' + r);
                if (x && (x.s === s || x.s === WILD)) { n++; xs.add(x); }
            }
            if (!n) break;
            per.push(n);
            cellsOn.push(xs);
        }
        const n = per.length;
        if (n < 3) continue;
        // nur Wilds zaehlen nicht als eigener Gewinn
        if (!cellsOn.some(xs => [...xs].some(x => x.s === s))) continue;
        const ways = per.reduce((p, k) => p * k, 1);
        const pay = SYMBOLS[s].pay[n - 3] * ways * PAY_SCALE;
        wins.push({ s, n, ways, pay });
        for (const xs of cellsOn) for (const x of xs) hit.add(x);
    }
    return { wins, hit, pay: wins.reduce((t, w) => t + w.pay, 0) };
}

// ---------- Mystery Boxes ----------
const boxArea = b => b.cells.filter(x => x.s === BOX).reduce((n, x) => n + x.z * x.z, 0);
const swipe = v => v < 1 ? Math.round((v + 1) * 100) / 100 : Number('1' + String(v));

// Oeffnet alle Boxen. Rueckgabe: { steps, pay, redrop }
function openBoxes(b) {
    const boxes = b.cells.filter(x => x.s === BOX).sort((a, z) => a.c - z.c || z.r - a.r);
    const sym = Math.random() < 0.5 ? pickW(SYM_TABLE.filter(([s]) => 'RGCSDOFV'.includes(s))) : rollSym();
    const steps = [];
    let pay = 0, redrop = false, lastCoin = null, rounds = 0;
    const coinState = () => boxes.filter(x => x.box.k === 'coin').map(x => [x.id, x.box.v]);
    const revealAll = list => {
        for (const x of list) {
            const k = pickW(TUNE.reveal);
            const st = { id: x.id, k };
            x.box.k = k;
            if (k === 'sym') { x.box.v = sym; st.v = sym; }
            else if (k === 'wild') { x.box.v = WILD; st.v = WILD; }
            else if (k === 'coin') {
                const v = pickW(TUNE.coins) * x.z * x.z;
                x.box.v = v; st.v = v; lastCoin = x;
            } else if (k === 'mult') {
                const m = pickW(TUNE.mults);
                st.v = m;
                for (const y of boxes) if (y.box.k === 'coin') y.box.v = Math.round(y.box.v * m * 100) / 100;
            } else if (k === 'swipe') {
                if (lastCoin && lastCoin.box.k === 'coin') { lastCoin.box.v = swipe(lastCoin.box.v); st.target = lastCoin.id; }
            } else if (k === 'collect') {
                const got = boxes.filter(y => y.box.k === 'coin').reduce((t, y) => t + y.box.v, 0);
                st.pay = got;
                pay += got;
            } else if (k === 'redrop') {
                redrop = true;
            }
            st.coins = coinState();
            steps.push(st);
            if (k === 'collect' && rounds < 3) {
                // Collect: alle schon geoeffneten Boxen noch mal oeffnen (Coins sind bezahlt)
                rounds++;
                const again = boxes.filter(y => y !== x && y.box.k && y.box.k !== 'sym' && y.box.k !== 'wild');
                if (again.length) {
                    for (const y of again) { y.box.k = null; y.box.v = undefined; }
                    steps.push({ again: again.map(y => y.id), coins: coinState() });
                    revealAll(again);
                }
            }
        }
    };
    revealAll(boxes);
    // Coins im Bild zahlen am Ende
    const end = boxes.filter(x => x.box.k === 'coin').reduce((t, x) => t + x.box.v, 0);
    pay += end;
    return { steps, pay, end, redrop, boxes };
}

// Nach dem Oeffnen: Symbol-/Wild-Boxen werden zu Symbolen, der Rest verschwindet
function settleBoxes(b, boxes) {
    for (const x of boxes) if (x.box.k === 'sym' || x.box.k === 'wild') { x.s = x.box.v; delete x.box; }
    const gone = new Set(boxes.filter(x => x.box).map(x => x.id));
    b.cells = b.cells.filter(x => !gone.has(x.id));
    return gone.size;
}

// Kompakter Zustand fuer den Browser: [id, s, c, r, z, f, ew, bf]
const snap = b => b.cells.map(x => [x.id, x.s, x.c, x.r, x.z, x.f ? 1 : 0, x.ew ? 1 : 0, x.bf ? 1 : 0]);

// ---------- Ein Spin (Drop mit allen Lawinen) ----------
// keep: Board mit liegenden Boxen (Bonus). Rueckgabe: { frames, win, bonus, board }
function playSpin(mode, h, keep) {
    const b = keep || createBoard(h);
    b.h = h;
    if (keep) b.cells = b.cells.filter(x => x.s === BOX && x.r + x.z <= h);
    fill(b, mode, true);
    const frames = [{ t: 'drop', h: b.h, cells: snap(b) }];
    let win = 0, cascades = 0, redrops = 0, forceOpen = false, guard = 0;
    while (guard++ < 60) {
        if (forceOpen || boxArea(b) >= MYST_MIN) {
            forceOpen = false;
            const m = openBoxes(b);
            win += m.pay;
            frames.push({ t: 'myst', steps: m.steps, pay: m.pay, end: m.end, redrop: m.redrop && redrops < 3 });
            if (m.redrop && redrops < 3) {
                redrops++;
                // Redrop: alles ausser den Boxen neu, danach oeffnen sie sicher wieder
                b.cells = b.cells.filter(x => x.s === BOX);
                for (const x of b.cells) x.box = { open: false };
                fill(b, mode, false);
                frames.push({ t: 'redrop', h: b.h, cells: snap(b) });
                forceOpen = true;
                continue;
            }
            if (settleBoxes(b, m.boxes)) {
                collapse(b);
                fill(b, mode, false);
                frames.push({ t: 'fill', h: b.h, cells: snap(b) });
            }
        }
        const e = evalWays(b);
        if (!e.wins.length) break;
        win += e.pay;
        cascades++;
        frames.push({ t: 'win', ids: [...e.hit].map(x => x.id), wins: e.wins, pay: e.pay });
        b.cells = b.cells.filter(x => !e.hit.has(x));
        if (b.h < MAX_ROWS) b.h++;
        collapse(b);
        fill(b, mode, false);
        frames.push({ t: 'fall', h: b.h, cells: snap(b) });
    }
    const bonus = b.cells.filter(x => x.s === BONUS).length;
    return { frames, win, bonus, cascades, board: b, h: b.h };
}

// ---------- Eine ganze Runde mit Einsatz 1 ----------
function play(opts) {
    opts = opts || {};
    const spins = [];
    let total = 0, freeLeft = 0, safety = MIN_ROWS, board = null;
    if (!opts.buy) {
        const s = playSpin('base', MIN_ROWS, null);
        const got = FREE[Math.min(6, s.bonus)] || 0;
        spins.push({ free: false, frames: s.frames, win: s.win, bonus: s.bonus, got });
        total += s.win;
        freeLeft = got;
    } else freeLeft = FREE[3];
    const trig = freeLeft > 0;
    let n = 0;
    while (freeLeft > 0 && n < 300) {
        freeLeft--;
        n++;
        const s = playSpin('free', safety, board);
        board = s.board;
        const got = FREE[Math.min(6, s.bonus)] || 0;
        freeLeft += got;
        if (s.cascades > 0 && safety < MAX_ROWS) safety++;
        spins.push({ free: true, n, frames: s.frames, win: s.win, bonus: s.bonus, got, freeLeft, safety });
        total += s.win;
        if (total >= MAX_WIN) break;
    }
    const capped = total >= MAX_WIN;
    return { spins, total: Math.min(total, MAX_WIN), capped, bonus: trig };
}

function spin(bet) {
    const r = play();
    return { ...r, cost: bet, win: Math.floor(r.total * bet) };
}

function info() {
    // Anzeige: echte Auszahlung je Weg (× Einsatz), also schon mal PAY_SCALE
    const symbols = Object.fromEntries(Object.entries(SYMBOLS).map(([id, x]) => [id, { ...x, pay: x.pay.map(p => Math.round(p * PAY_SCALE * 1000) / 1000) }]));
    return {
        symbols, free: FREE, reels: REELS, minRows: MIN_ROWS, maxRows: MAX_ROWS,
        maxWin: MAX_WIN, rtp: RTP, mystMin: MYST_MIN
    };
}

module.exports = { REELS, MIN_ROWS, MAX_ROWS, SYMBOLS, FREE, MAX_WIN, RTP, WILD, BONUS, BOX, spin, play, info, playSpin, evalWays, createBoard, collapse, fill, openBoxes };

// Simulation: node avalon.js [runden]
if (require.main === module) {
    const n = Number(process.argv[2]) || 200000;
    let paid = 0, base = 0, bonus = 0, bonusWin = 0, hit = 0, max = 0, myst = 0, mystPay = 0;
    for (let i = 0; i < n; i++) {
        const r = play();
        paid += r.total;
        base += r.spins[0].win;
        if (r.total > 0) hit++;
        if (r.bonus) { bonus++; bonusWin += r.total - r.spins[0].win; }
        for (const f of r.spins[0].frames) if (f.t === 'myst') { myst++; mystPay += f.pay; }
        max = Math.max(max, r.total);
    }
    const nb = Math.max(2000, Math.round(n / 50));
    let buyPaid = 0, buyMax = 0;
    for (let i = 0; i < nb; i++) { const t = play({ buy: true }).total; buyPaid += t; buyMax = Math.max(buyMax, t); }
    console.log(`RTP ${(100 * paid / n).toFixed(2)} % (Basis ${(100 * base / n).toFixed(2)} %, Bonus ${(100 * bonusWin / n).toFixed(2)} %), Treffer ${(100 * hit / n).toFixed(1)} %, Bonus 1 zu ${Math.round(n / Math.max(1, bonus))}, Mystery im Basisspiel 1 zu ${Math.round(n / Math.max(1, myst))} (Ø Coins ${(mystPay / Math.max(1, myst)).toFixed(2)}×), groesster ${max.toFixed(1)}×`);
    console.log(`Ein Bonus (direkt gestartet, 10 Drops): Ø ${(buyPaid / nb).toFixed(1)}×, groesster ${buyMax.toFixed(0)}×`);
}
