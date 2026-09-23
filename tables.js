// Casino-Tische: Blackjack, Roulette und Poker laufen dauerhaft im Casino-Bereich.
// Poker (Spieler gegen Spieler) hat seine Spiellogik in poker.js; hier nur
// Beitritt, Zuschauen und Versenden. Pokertische sind Lobbys, die Spieler
// selbst anlegen (`create`), mit eigenem Buy-in; Schluessel `poker:ID`.
// Eine Lobby ohne Zuschauer und ohne Sitzende verschwindet von allein.
//
// Jeder Tisch dreht Runden, solange jemand daran sitzt: Einsaetze, Spiel,
// Ergebnis, naechste Runde. Wer dazukommt, spielt ab der naechsten
// Einsatzphase mit. Alle am Tisch sehen alle Einsaetze und Haende.
// Nur Konten koennen setzen; Gaeste duerfen zuschauen.
//
// Der Server ist die einzige Wahrheit: er mischt, dreht und zahlt aus.
// Jede Aenderung geht als `table`-Nachricht mit dem ganzen Zustand an alle
// am Tisch (und nur an die).

const BETS = [10, 25, 50, 100, 250, 500, 1000];
const MAX_BET = 1000000;
const validBet = n => Number.isInteger(n) && n >= 1 && n <= MAX_BET;

const createPoker = require('./poker');
const POKER_MAX_TABLES = 20;

const KINDS = {
    blackjack: { title: '🃏 Blackjack' },
    roulette: { title: '🎡 Roulette' },
    poker: { title: '♠️ Poker' }
};

// Zeitraffer nur fuer lokale Tests (SNAKE_EVENT_SPEED=10 macht alles zehnmal schneller)
const SPEED = Number(process.env.SNAKE_EVENT_SPEED) || 1;

const MS = {
    rlBetting: 20000,
    rlSpinning: 6500,
    bjBetting: 15000,
    bjPlaying: 30000,
    results: 6000
};

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROULETTE_TYPES = new Set(['red', 'black', 'even', 'odd', 'low', 'high', 'number', 'dozen', 'column']);

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// 6 Decks, Karten als Text: "A♠", "10♥", ...
function newShoe() {
    const cards = [];
    for (let d = 0; d < 6; d++) {
        for (const s of ['♠', '♥', '♦', '♣']) {
            for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) cards.push(r + s);
        }
    }
    return shuffle(cards);
}

function cardValue(c) {
    const r = c.slice(0, -1);
    return r === 'A' ? 11 : 'JQK'.includes(r) || r === '10' ? 10 : Number(r);
}

function handValue(cards) {
    let total = 0, aces = 0;
    for (const c of cards) {
        total += cardValue(c);
        if (c.startsWith('A')) aces++;
    }
    while (total > 21 && aces) {
        total -= 10;
        aces--;
    }
    return { total, soft: aces > 0 };
}

function isBlackjack(cards) {
    return cards.length === 2 && handValue(cards).total === 21;
}

// ---------- Blackjack-Sidebets ----------
// Beide werden direkt nach dem Austeilen abgerechnet, unabhaengig davon, wie
// die Hand ausgeht. Quoten X:1, also Auszahlung Einsatz × (X + 1).

const RANK_ORDER = { A: 1, J: 11, Q: 12, K: 13 };
const rankNum = c => RANK_ORDER[c.slice(0, -1)] || Number(c.slice(0, -1));
const isRedCard = c => c.endsWith('♥') || c.endsWith('♦');

// Perfect Pairs auf die ersten zwei eigenen Karten
const PP_PAYS = { perfect: 25, colored: 12, mixed: 6 };
function perfectPairs(a, b) {
    if (a.slice(0, -1) !== b.slice(0, -1)) return null;
    if (a.slice(-1) === b.slice(-1)) return 'perfect';
    return isRedCard(a) === isRedCard(b) ? 'colored' : 'mixed';
}

// 21+3: eigene zwei Karten + offene Dealer-Karte als Poker-Dreier
const T3_PAYS = { suitedTrips: 100, straightFlush: 40, trips: 30, straight: 10, flush: 5 };
function twentyOnePlus3(cards) {
    const flush = cards.every(c => c.slice(-1) === cards[0].slice(-1));
    const trips = cards.every(c => c.slice(0, -1) === cards[0].slice(0, -1));
    const r = cards.map(rankNum).sort((x, y) => x - y);
    // A zaehlt unten (A-2-3) und oben (Q-K-A)
    const straight = (r[1] === r[0] + 1 && r[2] === r[1] + 1) || (r[0] === 1 && r[1] === 12 && r[2] === 13);
    if (trips && flush) return 'suitedTrips';
    if (straight && flush) return 'straightFlush';
    if (trips) return 'trips';
    if (straight) return 'straight';
    if (flush) return 'flush';
    return null;
}

const SIDE_NAMES = {
    perfect: 'Perfect pair', colored: 'Colored pair', mixed: 'Mixed pair',
    suitedTrips: 'Suited trips', straightFlush: 'Straight flush', trips: 'Three of a kind', straight: 'Straight', flush: 'Flush'
};

function rouletteColor(n) {
    return n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
}

// Auszahlung inkl. Einsatz als Vielfaches (0 = verloren)
function rouletteWin(bet, n) {
    switch (bet.type) {
        case 'red': return n !== 0 && RED.has(n) ? 2 : 0;
        case 'black': return n !== 0 && !RED.has(n) ? 2 : 0;
        case 'even': return n !== 0 && n % 2 === 0 ? 2 : 0;
        case 'odd': return n % 2 === 1 ? 2 : 0;
        case 'low': return n >= 1 && n <= 18 ? 2 : 0;
        case 'high': return n >= 19 ? 2 : 0;
        case 'number': return bet.n === n ? 36 : 0;
        case 'dozen': return n !== 0 && Math.ceil(n / 12) === bet.n ? 3 : 0;
        case 'column': return n !== 0 && ((n - 1) % 3) + 1 === bet.n ? 3 : 0;
    }
    return 0;
}

module.exports = function createTables(h) {
    // h: { accounts, send, feed, onChange }
    const tables = {};
    for (const kind of ['blackjack', 'roulette']) {
        tables[kind] = {
            kind,
            members: new Map(),     // client id -> { id, c, name, color, account, net }
            phase: 'waiting',
            phaseEnds: null,
            round: 0,
            // Roulette
            bets: [],
            result: null,
            history: [],
            // Blackjack
            shoe: newShoe(),
            hands: new Map(),
            dealer: { cards: [], hidden: true },
            nextStep: 0
        };
    }
    let pokerSeq = 0;
    const pokerTables = () => Object.values(tables).filter(t => t.kind === 'poker');

    function newPokerTable(cfg, name) {
        const key = 'poker:' + (++pokerSeq).toString(36);
        const t = { key, kind: 'poker', name, members: new Map(), phase: 'waiting', phaseEnds: null, round: 0, lastPush: 0 };
        t.game = createPoker({
            accounts: h.accounts,
            feed: h.feed,
            refresh: account => {
                for (const m of t.members.values()) if (m.account === account) refreshAccount(m);
            }
        }, cfg);
        tables[key] = t;
        return t;
    }

    // Leere Lobby weg: keiner schaut zu, keiner sitzt (auch keiner, der mitten
    // in der Hand gegangen ist und noch im Pot steckt)
    function cleanup(t) {
        if (t.kind === 'poker' && !t.members.size && !t.game.busy()) {
            delete tables[t.key];
            h.onChange();
        }
    }

    function phase(t, name, ms) {
        t.phase = name;
        t.phaseEnds = ms ? Date.now() + ms / SPEED : null;
    }

    function tableOf(c) {
        for (const t of Object.values(tables)) if (t.members.has(c.id)) return t;
        return null;
    }

    function board(t) {
        // Poker: Bilanz inkl. dem, was gerade am Tisch liegt
        const live = id => t.kind === 'poker' ? t.game.stackOf(id) : 0;
        return [...t.members.values()]
            .map(m => ({ id: m.id, name: m.name, color: m.color, guest: !m.account, value: m.net + live(m.id) }))
            .sort((a, b) => b.value - a.value);
    }

    function publicData(t) {
        if (t.kind === 'roulette') {
            return {
                bets: t.bets,
                result: t.phase === 'spinning' || t.phase === 'results' ? t.result : null,
                color: t.result === null ? null : rouletteColor(t.result),
                history: t.history
            };
        }
        const hands = {};
        for (const [id, seat] of t.hands) hands[id] = seat;
        return {
            hands,
            dealer: t.dealer.hidden
                ? { cards: t.dealer.cards.length ? [t.dealer.cards[0], '??'] : [], total: null }
                : { cards: t.dealer.cards, total: t.dealer.cards.length ? handValue(t.dealer.cards).total : null }
        };
    }

    function push(t) {
        if (t.kind === 'poker') return pushPoker(t);
        const base = {
            type: 'table',
            kind: t.kind,
            title: KINDS[t.kind].title,
            eventType: 'gamble',
            phase: t.phase,
            round: t.round,
            left: t.phaseEnds ? Math.max(0, t.phaseEnds - Date.now()) : null,
            members: [...t.members.keys()],
            board: board(t),
            bets: BETS,
            data: publicData(t)
        };
        for (const m of t.members.values()) h.send(m.c, { ...base, you: m.id });
    }

    // Poker: jeder bekommt seine eigene Sicht (eigene Karten offen)
    function pushPoker(t) {
        const hd = t.game.header();
        const base = {
            type: 'table',
            kind: 'poker',
            key: t.key,
            title: `♠️ ${t.name}`,
            eventType: 'gamble',
            phase: hd.phase,
            round: t.game._g.hand,
            left: hd.ends ? Math.max(0, hd.ends - Date.now()) : null,
            total: hd.total,
            members: [...t.members.keys()],
            board: board(t),
            bets: BETS
        };
        for (const m of t.members.values()) h.send(m.c, { ...base, you: m.id, data: t.game.view(m.id) });
    }

    function refreshAccount(m) {
        if (m && m.account) h.send(m.c, { type: 'account', user: h.accounts.publicUser(h.accounts.get(m.account)) });
    }

    // Wer im Moment an welchem Tisch sitzt, fuer die Casino-Lobby.
    // Poker: Liste der Lobbys mit Buy-in und wer sitzt (nicht, wer zuschaut)
    function lobby() {
        const out = { poker: [] };
        for (const t of Object.values(tables)) {
            if (t.kind !== 'poker') {
                out[t.kind] = [...t.members.values()].map(m => m.name);
                continue;
            }
            const g = t.game;
            out.poker.push({
                key: t.key, name: t.name,
                buyIn: g.cfg.buyIn, sb: g.cfg.sb, bb: g.cfg.bb, seats: g.cfg.seats,
                seated: g.players(), watching: t.members.size,
                playing: g._g.phase !== 'waiting' && g._g.phase !== 'starting'
            });
        }
        return out;
    }

    // Neue Poker-Lobby: wer sie anlegt, setzt sich direkt mit dem Buy-in hin
    function create(c, data) {
        if (!c.account) return h.send(c, { type: 'tableError', error: 'Log in to create a table' });
        const u = h.accounts.get(c.account);
        if (!u) return;
        const cfg = createPoker.config(Number(data.buyIn), Number(data.seats));
        if (!cfg) return h.send(c, { type: 'tableError', error: `Buy-in ${createPoker.BUYIN_MIN}–${createPoker.BUYIN_MAX.toLocaleString('en-US')}, 2/4/6 seats` });
        if (u.coins < cfg.buyIn) return h.send(c, { type: 'tableError', error: `Not enough coins for a ${cfg.buyIn} buy-in` });
        if (pokerTables().length >= POKER_MAX_TABLES) return h.send(c, { type: 'tableError', error: 'Too many open tables, join one of them' });
        // Nur Steuerzeichen raus; der Browser escaped beim Anzeigen
        const name = String(data.name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || `${u.name}'s table`;
        const t = newPokerTable(cfg, name);
        join(c, t.key);
        const m = t.members.get(c.id);
        const err = t.game.sit({ id: c.id, name: u.name, color: u.color || m.color }, c.account);
        if (err) h.send(c, { type: 'tableError', error: err });
        push(t);
        h.onChange();
    }

    // ---------- Sitzen und gehen ----------

    function join(c, kind) {
        const t = tables[kind];
        if (!t) return;
        const old = tableOf(c);
        if (old === t) return push(t);
        if (old) leave(c);
        const u = c.account ? h.accounts.get(c.account) : null;
        t.members.set(c.id, {
            id: c.id, c,
            name: u ? u.name : 'Guest',
            color: (u && u.color) || '#00ff88',
            account: c.account,
            net: 0
        });
        if (t.phase === 'waiting' && t.kind !== 'poker') startBetting(t);
        push(t);
        h.onChange();
    }

    // Einsaetze bleiben liegen und werden ausgezahlt, auch wenn man geht.
    // Eine offene Blackjack-Hand bleibt automatisch stehen.
    function leave(c) {
        const t = tableOf(c);
        if (!t) return;
        if (t.kind === 'poker') {
            const m = t.members.get(c.id);
            m.net += t.game.standUp(c.id);
            t.members.delete(c.id);
            h.send(c, { type: 'tableLeft' });
            push(t);
            h.onChange();
            cleanup(t);
            return;
        }
        const seat = t.hands.get(c.id);
        if (t.kind === 'blackjack' && seat && t.phase === 'playing') {
            for (const hd of seat.hands) hd.done = true;
            bjAdvance(seat);
            bjMaybeDealer(t);
        }
        // In der Einsatzphase gibt es das Geld zurueck
        if (t.phase === 'betting') {
            const m = t.members.get(c.id);
            if (t.kind === 'roulette') {
                const refund = t.bets.filter(b => b.id === c.id).reduce((s, b) => s + b.amount, 0);
                if (refund && m.account) h.accounts.addCoins(m.account, refund);
                t.bets = t.bets.filter(b => b.id !== c.id);
            } else if (seat) {
                if (m.account) h.accounts.addCoins(m.account, seat.bet + seat.pp + seat.t3);
                t.hands.delete(c.id);
            }
            refreshAccount(m);
        }
        t.members.delete(c.id);
        h.send(c, { type: 'tableLeft' });
        push(t);
        h.onChange();
    }

    function startBetting(t) {
        if (!t.members.size) {
            phase(t, 'waiting', null);
            return;
        }
        t.round++;
        if (t.kind === 'roulette') {
            t.bets = [];
            t.result = null;
            phase(t, 'betting', MS.rlBetting);
        } else {
            t.hands = new Map();
            t.dealer = { cards: [], hidden: true };
            if (t.shoe.length < 60) t.shoe = newShoe();
            phase(t, 'betting', MS.bjBetting);
        }
    }

    // ---------- Roulette ----------

    function rouletteResults(t) {
        const net = new Map();
        for (const b of t.bets) {
            const win = b.amount * rouletteWin(b, t.result);
            if (win > 0 && b.account) h.accounts.addCoins(b.account, win);
            b.win = win;
            net.set(b.id, (net.get(b.id) || 0) + win - b.amount);
        }
        for (const [id, v] of net) {
            const m = t.members.get(id);
            if (m) m.net += v;
        }
        for (const m of t.members.values()) refreshAccount(m);
        const best = [...net].sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] >= 500) {
            const b = t.bets.find(x => x.id === best[0]);
            h.feed(`🎡 ${b.name} wins ${best[1]} coins at Roulette`, 'gold');
        }
        t.history = [t.result, ...t.history].slice(0, 12);
        phase(t, 'results', MS.results);
    }

    // ---------- Blackjack ----------

    function draw(t) {
        if (!t.shoe.length) t.shoe = newShoe();
        return t.shoe.pop();
    }

    function newHand(bet, cards, split) {
        const hd = { bet, cards, split: !!split, doubled: false, done: false, result: null, net: 0, total: handValue(cards).total };
        if (!split && isBlackjack(cards)) hd.done = true;
        if (hd.total >= 21) hd.done = true;
        return hd;
    }

    // Naechste offene Hand eines Spielers; fertig, wenn keine mehr offen ist
    function bjAdvance(seat) {
        while (seat.active < seat.hands.length && seat.hands[seat.active].done) seat.active++;
        seat.done = seat.active >= seat.hands.length;
    }

    function bjDeal(t) {
        for (const seat of t.hands.values()) {
            seat.hands = [newHand(seat.bet, [draw(t), draw(t)])];
            seat.active = 0;
            bjAdvance(seat);
        }
        t.dealer.cards = [draw(t), draw(t)];
        t.dealer.hidden = true;
        for (const seat of t.hands.values()) bjSideBets(t, seat);
        phase(t, 'playing', MS.bjPlaying);
        bjMaybeDealer(t);
    }

    function bjSideBets(t, seat) {
        const [a, b] = seat.hands[0].cards;
        seat.side = [];
        seat.sideNet = 0;
        const settle = (key, stake, hit, pays) => {
            if (!stake) return;
            const win = hit ? stake * (pays[hit] + 1) : 0;
            if (win && seat.account) h.accounts.addCoins(seat.account, win);
            seat.sideNet += win - stake;
            seat.side.push({ bet: key, stake, hit: hit ? SIDE_NAMES[hit] : null, odds: hit ? pays[hit] : 0, win });
            if (win >= 1000) h.feed(`🃏 ${seat.name} hits ${SIDE_NAMES[hit]} (${pays[hit]}:1) for ${win} coins`, 'gold');
        };
        settle('Perfect Pairs', seat.pp, perfectPairs(a, b), PP_PAYS);
        settle('21+3', seat.t3, twentyOnePlus3([a, b, t.dealer.cards[0]]), T3_PAYS);
    }

    function bjMaybeDealer(t) {
        if (t.phase !== 'playing') return;
        if ([...t.hands.values()].every(seat => seat.done)) {
            phase(t, 'dealer', null);
            t.dealer.hidden = false;
            t.nextStep = Date.now() + 1000 / SPEED;
        }
    }

    function bjDealerStep(t) {
        const v = handValue(t.dealer.cards);
        const anyAlive = [...t.hands.values()].some(seat => seat.hands.some(hd => hd.total <= 21 && !(isBlackjack(hd.cards) && !hd.split)));
        // Dealer zieht bis 17, bleibt bei Soft 17 stehen. Sind alle raus, zieht er nicht.
        if (anyAlive && v.total < 17) {
            t.dealer.cards.push(draw(t));
            t.nextStep = Date.now() + 1000 / SPEED;
            return;
        }
        bjResults(t);
    }

    function bjResults(t) {
        const d = handValue(t.dealer.cards).total;
        const dealerBj = isBlackjack(t.dealer.cards);
        for (const [id, seat] of t.hands) {
            let net = 0;
            for (const hd of seat.hands) {
                const p = hd.total;
                const bj = isBlackjack(hd.cards) && !hd.split;
                let pay = 0;
                if (p > 21) hd.result = 'bust';
                else if (bj && !dealerBj) { hd.result = 'blackjack'; pay = Math.floor(hd.bet * 2.5); }
                else if (dealerBj && !bj) hd.result = 'lose';
                else if (d > 21 || p > d) { hd.result = 'win'; pay = hd.bet * 2; }
                else if (p === d) { hd.result = 'push'; pay = hd.bet; }
                else hd.result = 'lose';
                if (pay > 0 && seat.account) h.accounts.addCoins(seat.account, pay);
                hd.net = pay - hd.bet;
                net += hd.net;
            }
            // Sidebets sind schon beim Austeilen bezahlt, zaehlen aber zur Bilanz der Runde
            net += seat.sideNet || 0;
            seat.net = net;
            const m = t.members.get(id);
            if (m) {
                m.net += net;
                refreshAccount(m);
            }
            if (net >= 1000) h.feed(`🃏 ${seat.name} wins ${net} coins at Blackjack`, 'gold');
        }
        phase(t, 'results', MS.results);
    }

    // ---------- Ablauf ----------

    function tickTable(t) {
        const now = Date.now();
        if (t.phase === 'waiting') return;

        if (t.phase === 'dealer') {
            if (now >= t.nextStep) {
                bjDealerStep(t);
                push(t);
            }
            return;
        }
        if (!t.phaseEnds || now < t.phaseEnds) return;

        if (t.phase === 'results') {
            startBetting(t);
            return push(t);
        }

        if (t.kind === 'roulette') {
            if (t.phase === 'betting') {
                // Ohne Einsaetze wird nicht gedreht, einfach weiter setzen
                if (!t.bets.length) {
                    phase(t, 'betting', MS.rlBetting);
                    if (!t.members.size) phase(t, 'waiting', null);
                    return push(t);
                }
                // forceResult setzt nur der Test-Hook (SNAKE_TEST=1)
                t.result = t.forceResult !== undefined ? t.forceResult : Math.floor(Math.random() * 37);
                t.forceResult = undefined;
                phase(t, 'spinning', MS.rlSpinning);
            } else if (t.phase === 'spinning') {
                rouletteResults(t);
            }
        } else {
            if (t.phase === 'betting') {
                if (!t.hands.size) {
                    phase(t, 'betting', MS.bjBetting);
                    if (!t.members.size) phase(t, 'waiting', null);
                    return push(t);
                }
                bjDeal(t);
            } else if (t.phase === 'playing') {
                // Zeit um: wer noch spielt, bleibt stehen
                for (const seat of t.hands.values()) {
                    for (const hd of seat.hands) hd.done = true;
                    bjAdvance(seat);
                }
                bjMaybeDealer(t);
            }
        }
        push(t);
    }

    function tick() {
        for (const t of Object.values(tables)) {
            if (t.kind !== 'poker') {
                tickTable(t);
                continue;
            }
            const before = t.game._g.phase;
            const seatedBefore = t.game.seatedCount();
            if (t.game.tick()) {
                push(t);
                t.lastPush = Date.now();
                if (t.game._g.phase !== before || t.game.seatedCount() !== seatedBefore) h.onChange();
            } else if (t.members.size && Date.now() - t.lastPush > 1000) {
                // Restzeit einmal je Sekunde nachschieben
                push(t);
                t.lastPush = Date.now();
            }
            cleanup(t);
        }
    }

    // ---------- Aktionen ----------

    function handle(c, data) {
        const t = tableOf(c);
        if (!t) return;
        const m = t.members.get(c.id);
        if (!c.account) return h.send(c, { type: 'tableError', error: 'Log in to bet coins' });
        const u = h.accounts.get(c.account);
        if (!u) return;

        if (t.kind === 'poker') {
            let err = null;
            // Name und Farbe vom Konto: wer als Gast kam und sich erst am Tisch anmeldet, heisst sonst "Guest"
            if (data.sit) err = t.game.sit({ id: c.id, name: u.name, color: u.color || m.color }, c.account, Number(data.seat));
            else if (data.stand) m.net += t.game.standUp(c.id);
            else if (data.move) err = t.game.act(c.id, data);
            else return;
            if (err) h.send(c, { type: 'tableError', error: err });
            push(t);
            h.onChange();
            return;
        }

        if (t.kind === 'roulette') {
            if (t.phase !== 'betting') return;
            if (data.clear) {
                const refund = t.bets.filter(b => b.id === c.id).reduce((s, b) => s + b.amount, 0);
                if (refund) h.accounts.addCoins(c.account, refund);
                t.bets = t.bets.filter(b => b.id !== c.id);
                refreshAccount(m);
                return push(t);
            }
            const bet = data.bet || {};
            const amount = Number(bet.amount);
            if (!ROULETTE_TYPES.has(bet.type) || !validBet(amount)) return;
            const n = Number(bet.n);
            if (bet.type === 'number' && !(Number.isInteger(n) && n >= 0 && n <= 36)) return;
            if ((bet.type === 'dozen' || bet.type === 'column') && !(n >= 1 && n <= 3)) return;
            if (t.bets.filter(b => b.id === c.id).length >= 12) return h.send(c, { type: 'tableError', error: 'Max 12 bets' });
            if (u.coins < amount) return h.send(c, { type: 'tableError', error: 'Not enough coins' });
            h.accounts.addCoins(c.account, -amount);
            t.bets.push({
                id: c.id, name: m.name, color: m.color, account: c.account,
                type: bet.type, n: ['number', 'dozen', 'column'].includes(bet.type) ? n : null, amount
            });
            refreshAccount(m);
            return push(t);
        }

        // Blackjack
        if (t.phase === 'betting') {
            const amount = Number(data.bet);
            // Sidebets optional, 0 = keine
            const pp = Number(data.pp) || 0;
            const t3 = Number(data.t3) || 0;
            const old = t.hands.get(c.id);
            const oldCost = old ? old.bet + old.pp + old.t3 : 0;
            if (data.clear) {
                if (old) h.accounts.addCoins(c.account, oldCost);
                t.hands.delete(c.id);
                refreshAccount(m);
                return push(t);
            }
            if (!validBet(amount) || !(pp === 0 || validBet(pp)) || !(t3 === 0 || validBet(t3))) return;
            const cost = amount + pp + t3;
            if (u.coins + oldCost < cost) return h.send(c, { type: 'tableError', error: 'Not enough coins' });
            if (old) h.accounts.addCoins(c.account, oldCost);
            h.accounts.addCoins(c.account, -cost);
            t.hands.set(c.id, { name: m.name, account: c.account, bet: amount, pp, t3, side: null, sideNet: 0, hands: [], active: 0, done: false, net: 0 });
            refreshAccount(m);
            return push(t);
        }
        if (t.phase === 'playing') {
            const seat = t.hands.get(c.id);
            if (!seat || seat.done) return;
            const hd = seat.hands[seat.active];
            if (data.move === 'hit') {
                hd.cards.push(draw(t));
            } else if (data.move === 'stand') {
                hd.done = true;
            } else if (data.move === 'double') {
                if (hd.cards.length !== 2 || u.coins < hd.bet) return;
                h.accounts.addCoins(c.account, -hd.bet);
                hd.bet *= 2;
                hd.doubled = true;
                hd.cards.push(draw(t));
                hd.done = true;
            } else if (data.move === 'split') {
                // Einmal teilen, zwei Karten gleichen Werts, gleicher Einsatz nochmal
                if (seat.hands.length !== 1 || hd.cards.length !== 2 || cardValue(hd.cards[0]) !== cardValue(hd.cards[1]) || u.coins < hd.bet) return;
                h.accounts.addCoins(c.account, -hd.bet);
                const aces = hd.cards[0].startsWith('A');
                const a = newHand(hd.bet, [hd.cards[0], draw(t)], true);
                const b = newHand(hd.bet, [hd.cards[1], draw(t)], true);
                // Geteilte Asse bekommen nur je eine Karte
                if (aces) a.done = b.done = true;
                seat.hands = [a, b];
                seat.active = 0;
            } else return;
            const cur = seat.hands[seat.active];
            if (cur) {
                cur.total = handValue(cur.cards).total;
                if (cur.total >= 21) cur.done = true;
            }
            bjAdvance(seat);
            refreshAccount(m);
            bjMaybeDealer(t);
            return push(t);
        }
    }

    return {
        join,
        leave,
        tick,
        handle,
        lobby,
        tableOf,
        create,
        // Herunterfahren: Poker-Stacks zurueck aufs Konto
        shutdown: () => pokerTables().forEach(t => t.game.refundAll()),
        // Nur fuer Tests
        _tables: () => tables
    };
};

module.exports.KINDS = KINDS;
module.exports.perfectPairs = perfectPairs;
module.exports.twentyOnePlus3 = twentyOnePlus3;
module.exports.PP_PAYS = PP_PAYS;
module.exports.T3_PAYS = T3_PAYS;
module.exports.handValue = handValue;
module.exports.rouletteWin = rouletteWin;
module.exports.newShoe = newShoe;
module.exports.shuffle = shuffle;
