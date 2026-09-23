// Poker: Texas Hold'em No-Limit, Spieler gegen Spieler, ein Dauertisch im
// Casino (Issue #1). Laeuft als dritter Tisch in tables.js; dort liegen
// Beitritt, Zuschauer und das Versenden, hier nur das Spiel.
//
// Regeln in Kurzform:
// - bis 6 Plaetze, eine Hand startet ab 2 Spielern mit Chips
// - Blinds 5/10, Buy-in 100–10.000 Coins, kein Rake (alles geht an Spieler)
// - 20 s je Zug, danach Check, wenn moeglich, sonst Fold
// - Aufstehen, Tisch verlassen oder Verbindung weg: laufende Hand ist
//   gefoldet, der Rest vom Stack geht sofort aufs Konto
// - jede Erhoehung oeffnet die Runde wieder (auch ein kurzes All-in),
//   Mindest-Raise = letzte Erhoehung, mindestens Big Blind
//
// Der Server mischt und verteilt; die eigenen Karten sieht nur man selbst,
// die der anderen erst beim Showdown.

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const SEATS = 6;
const SB = 5;
const BB = 10;
const BUYIN_MIN = 100;
const BUYIN_MAX = 10000;

const SPEED = Number(process.env.SNAKE_EVENT_SPEED) || 1;
const MS = {
    turn: 20000,
    start: 3000,       // zwischen "genug Spieler" und dem Austeilen
    street: 1200,      // Pause vor Flop/Turn/River, wenn keiner mehr setzen kann
    showdown: 7000,    // Ergebnis stehen lassen
    fold: 3500         // Ergebnis, wenn alle anderen gefoldet haben
};

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

function newDeck() {
    const cards = [];
    for (const s of ['♠', '♥', '♦', '♣']) for (const r of RANKS) cards.push(r + s);
    return shuffle(cards);
}

const rankOf = c => RANKS.indexOf(c.slice(0, -1)) + 2;
const suitOf = c => c.slice(-1);

// Fuenf Karten bewerten: [Kategorie, Tiebreaker...], groesser ist besser
function eval5(cards) {
    const ranks = cards.map(rankOf).sort((a, b) => b - a);
    const flush = cards.every(c => suitOf(c) === suitOf(cards[0]));
    const uniq = [...new Set(ranks)];
    let straightHigh = 0;
    if (uniq.length === 5) {
        if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
        else if (ranks[0] === 14 && ranks[1] === 5) straightHigh = 5;   // A-2-3-4-5
    }
    // Nach Haeufigkeit, dann Rang sortiert: [[rang, anzahl], ...]
    const counts = uniq.map(r => [r, ranks.filter(x => x === r).length]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const byCount = counts.map(x => x[0]);
    if (straightHigh && flush) return [8, straightHigh];
    if (counts[0][1] === 4) return [7, ...byCount];
    if (counts[0][1] === 3 && counts[1][1] === 2) return [6, ...byCount];
    if (flush) return [5, ...ranks];
    if (straightHigh) return [4, straightHigh];
    if (counts[0][1] === 3) return [3, ...byCount];
    if (counts[0][1] === 2 && counts[1][1] === 2) return [2, ...byCount];
    if (counts[0][1] === 2) return [1, ...byCount];
    return [0, ...ranks];
}

function cmp(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const d = (a[i] || 0) - (b[i] || 0);
        if (d) return d;
    }
    return 0;
}

// Alle Fuenfer-Kombinationen aus n Karten
function combos5(cards) {
    const out = [];
    const rec = (from, pick) => {
        if (pick.length === 5) return out.push(pick);
        for (let i = from; i <= cards.length - (5 - pick.length); i++) rec(i + 1, [...pick, cards[i]]);
    };
    rec(0, []);
    return out;
}

// Beste Hand aus 5–7 Karten: { score, cards, name }
function best(cards) {
    let top = null;
    for (const five of combos5(cards)) {
        const score = eval5(five);
        if (!top || cmp(score, top.score) > 0) top = { score, cards: five };
    }
    top.name = top.score[0] === 8 && top.score[1] === 14 ? 'Royal flush' : HAND_NAMES[top.score[0]];
    return top;
}

// Pots aus den Einsaetzen der ganzen Hand: je Stufe eines noch spielenden
// Spielers ein Pot, berechtigt sind alle Nicht-Gefoldeten, die so viel drin haben
function buildPots(seats) {
    const inHand = seats.filter(s => s && s.inHand);
    const live = inHand.filter(s => !s.folded);
    const levels = [...new Set(live.map(s => s.total))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const lvl of levels) {
        const amount = inHand.reduce((sum, s) => sum + Math.min(s.total, lvl) - Math.min(s.total, prev), 0);
        const eligible = live.filter(s => s.total >= lvl);
        if (amount > 0) pots.push({ amount, eligible });
        prev = lvl;
    }
    return pots;
}

module.exports = function createPoker(h) {
    // h: { accounts, feed, refresh(account), changed() }
    const seats = new Array(SEATS).fill(null);
    const g = {
        phase: 'waiting',   // waiting, starting, preflop, flop, turn, river, showdown
        phaseEnds: null,
        hand: 0,
        dealer: -1,
        deck: [],
        board: [],
        currentBet: 0,
        minRaise: BB,
        turn: -1,
        turnEnds: null,
        runout: false,      // keiner kann mehr setzen: Karten kommen von allein
        results: null       // [{ seat, name, amount, hand, cards }]
    };

    const at = t => (t % SEATS + SEATS) % SEATS;
    const seated = () => seats.filter(Boolean);
    // Wer mitten in der Hand aufgestanden ist, sitzt nicht mehr (Platz bleibt nur fuer den Pot)
    const seatOf = id => seats.findIndex(s => s && s.id === id && !s.gone);
    const inHand = () => seats.map((s, i) => [s, i]).filter(([s]) => s && s.inHand);
    const live = () => inHand().filter(([s]) => !s.folded);
    const canAct = () => live().filter(([s]) => !s.allIn);
    const pot = () => seats.reduce((sum, s) => sum + (s && s.inHand ? s.total : 0), 0);

    function setPhase(name, ms) {
        g.phase = name;
        g.phaseEnds = ms ? Date.now() + ms / SPEED : null;
    }

    function nextFrom(i, pred) {
        for (let k = 1; k <= SEATS; k++) {
            const j = at(i + k);
            if (seats[j] && pred(seats[j])) return j;
        }
        return -1;
    }

    // ---------- Sitzen und aufstehen ----------

    function sit(m, account, buyIn, want) {
        if (seatOf(m.id) >= 0) return 'You are already seated';
        const u = h.accounts.get(account);
        if (!u) return 'Log in to play';
        if (!Number.isInteger(buyIn) || buyIn < BUYIN_MIN || buyIn > BUYIN_MAX) return `Buy-in ${BUYIN_MIN}–${BUYIN_MAX}`;
        if (u.coins < buyIn) return 'Not enough coins';
        // gleiches Konto nur einmal am Tisch (zwei Tabs)
        if (seated().some(s => s.account === account && !s.gone)) return 'This account already has a seat';
        let i = Number.isInteger(want) && want >= 0 && want < SEATS && !seats[want] ? want : seats.findIndex(s => !s);
        if (i < 0) return 'Table is full';
        h.accounts.addCoins(account, -buyIn);
        seats[i] = {
            id: m.id, name: m.name, color: m.color, account,
            stack: buyIn, buyIn,
            inHand: false, hole: [], bet: 0, total: 0,
            folded: false, allIn: false, acted: false, last: null
        };
        h.refresh(account);
        if (g.phase === 'waiting') maybeStart();
        return null;
    }

    // Rest vom Stack aufs Konto; eine laufende Hand ist damit gefoldet,
    // was schon im Pot liegt, bleibt dort
    function standUp(id) {
        const i = seatOf(id);
        if (i < 0) return 0;
        const s = seats[i];
        const back = s.stack;
        if (back > 0) h.accounts.addCoins(s.account, back);
        h.refresh(s.account);
        s.stack = 0;
        const net = back - s.buyIn;
        if (s.inHand && isBetting()) {
            // Platz bleibt bis Handende belegt (Einsatz liegt im Pot)
            s.gone = true;
            if (!s.folded) {
                s.folded = true;
                s.last = 'left';
                if (g.turn === i) afterAction(i);
                else checkHandOver();
            }
        } else {
            seats[i] = null;
        }
        return net;
    }

    const isBetting = () => ['preflop', 'flop', 'turn', 'river'].includes(g.phase);

    // ---------- Hand ----------

    function maybeStart() {
        if (seated().filter(s => s.stack > 0).length >= 2) setPhase('starting', MS.start);
        else setPhase('waiting', null);
    }

    function startHand() {
        // Weg sind, wer gegangen ist oder nichts mehr hat
        for (let i = 0; i < SEATS; i++) {
            const s = seats[i];
            if (!s) continue;
            if (s.gone) seats[i] = null;
            else if (s.stack <= 0) {
                h.feed(`🂠 ${s.name} is out of chips at Poker`, null);
                seats[i] = null;
            }
        }
        const players = seated();
        if (players.length < 2) {
            g.results = null;
            return setPhase('waiting', null);
        }
        g.hand++;
        g.deck = newDeck();
        g.board = [];
        g.results = null;
        g.runout = false;
        for (const s of players) {
            Object.assign(s, { inHand: true, hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, last: null });
        }
        g.dealer = nextFrom(g.dealer, s => s.inHand);
        // Heads-up: Dealer ist Small Blind
        const sb = players.length === 2 ? g.dealer : nextFrom(g.dealer, s => s.inHand);
        const bb = nextFrom(sb, s => s.inHand);
        post(sb, SB, 'SB');
        post(bb, BB, 'BB');
        g.currentBet = BB;
        g.minRaise = BB;
        for (let r = 0; r < 2; r++) for (let k = 1; k <= SEATS; k++) {
            const s = seats[at(g.dealer + k)];
            if (s && s.inHand) s.hole.push(g.deck.pop());
        }
        setPhase('preflop', null);
        startTurn(nextFrom(bb, s => s.inHand && !s.folded && !s.allIn));
    }

    function post(i, amount, label) {
        const s = seats[i];
        const a = Math.min(amount, s.stack);
        s.stack -= a;
        s.bet += a;
        s.total += a;
        if (s.stack === 0) s.allIn = true;
        s.last = label;
    }

    // Zug an Sitz i geben; wenn der Einzige, der noch setzen koennte, schon
    // alles gedeckt hat, ist die Runde durch
    function startTurn(i) {
        if (i < 0) return nextStreet();
        if (roundDone()) return nextStreet();
        g.turn = i;
        g.turnEnds = Date.now() + MS.turn / SPEED;
    }

    function roundDone() {
        const actors = canAct();
        if (live().length <= 1) return true;
        // Alle, die noch setzen koennen, haben gehandelt und stehen gleich
        return actors.every(([s]) => s.acted && s.bet === g.currentBet) ||
            // Nur noch einer kann setzen und muss nichts mehr callen
            (actors.length <= 1 && actors.every(([s]) => s.bet >= g.currentBet));
    }

    function checkHandOver() {
        if (live().length <= 1) return finishFold();
        if (roundDone()) return nextStreet();
        if (g.turn < 0 || !seats[g.turn] || seats[g.turn].folded || seats[g.turn].allIn) {
            const n = nextFrom(g.turn, s => s.inHand && !s.folded && !s.allIn);
            if (n >= 0) startTurn(n);
        }
    }

    function afterAction(i) {
        if (live().length <= 1) return finishFold();
        if (roundDone()) return nextStreet();
        const n = nextFrom(i, s => s.inHand && !s.folded && !s.allIn);
        if (n < 0) return nextStreet();
        startTurn(n);
    }

    function nextStreet() {
        g.turn = -1;
        g.turnEnds = null;
        for (const [s] of inHand()) {
            s.bet = 0;
            s.acted = false;
            if (!s.folded && !s.allIn) s.last = null;
        }
        g.currentBet = 0;
        g.minRaise = BB;
        if (g.phase === 'river') return showdown();
        // Kann keiner mehr setzen: Karten mit kleiner Pause von allein
        g.runout = canAct().length <= 1;
        const next = { preflop: 'flop', flop: 'turn', turn: 'river' }[g.phase];
        if (g.runout) {
            g.nextStreet = next;
            g.phaseEnds = Date.now() + MS.street / SPEED;
            return;
        }
        deal(next);
    }

    function deal(street) {
        g.deck.pop();   // Burn
        const n = street === 'flop' ? 3 : 1;
        for (let k = 0; k < n; k++) g.board.push(g.deck.pop());
        setPhase(street, null);
        if (g.runout) {
            g.nextStreet = { flop: 'turn', turn: 'river', river: null }[street];
            g.phaseEnds = Date.now() + MS.street / SPEED;
            return;
        }
        const first = nextFrom(g.dealer, s => s.inHand && !s.folded && !s.allIn);
        startTurn(first);
    }

    // Alle anderen haben gefoldet: der Letzte bekommt alles, ohne Karten zu zeigen
    function finishFold() {
        g.turn = -1;
        g.turnEnds = null;
        const [[w, wi]] = live();
        const amount = pot();
        w.stack += amount;
        g.results = [{ seat: wi, name: w.name, amount, net: amount - w.total, hand: null, cards: null }];
        stat(w, amount - w.total);
        endHand(MS.fold);
    }

    function showdown() {
        g.turn = -1;
        g.turnEnds = null;
        // falls der River beim Runout noch fehlt
        while (g.board.length < 5) {
            g.deck.pop();
            g.board.push(g.deck.pop());
        }
        const scores = new Map();
        for (const [s] of live()) scores.set(s, best([...s.hole, ...g.board]));
        const won = new Map();
        for (const p of buildPots(seats)) {
            let top = null;
            let winners = [];
            for (const s of p.eligible) {
                const c = top ? cmp(scores.get(s).score, top) : 1;
                if (c > 0) {
                    top = scores.get(s).score;
                    winners = [s];
                } else if (c === 0) winners.push(s);
            }
            // Rest-Coin beim Split an den ersten links vom Dealer
            winners.sort((a, b) => at(seats.indexOf(a) - g.dealer - 1) - at(seats.indexOf(b) - g.dealer - 1));
            const share = Math.floor(p.amount / winners.length);
            winners.forEach((s, k) => won.set(s, (won.get(s) || 0) + share + (k === 0 ? p.amount - share * winners.length : 0)));
        }
        g.results = [];
        for (const [s, i] of live()) {
            const amount = won.get(s) || 0;
            s.stack += amount;
            const b = scores.get(s);
            g.results.push({ seat: i, name: s.name, amount, net: amount - s.total, hand: b.name, cards: b.cards });
            if (amount) stat(s, amount - s.total);
        }
        g.results.sort((a, b) => b.amount - a.amount);
        setPhase('showdown', null);
        endHand(MS.showdown);
    }

    function stat(s, net) {
        if (net > 0) h.accounts.stat(s.account, st => { st.biggestWin = Math.max(st.biggestWin, net); });
        if (net >= 2000) h.feed(`🂡 ${s.name} wins a ${net + s.total} pot at Poker`, 'gold');
    }

    function endHand(ms) {
        // Einsaetze liegen jetzt im Pot bzw. beim Gewinner
        for (const x of seated()) x.bet = 0;
        setPhase('showdown', ms);
    }

    // ---------- Aktionen ----------

    function act(id, data) {
        const i = seatOf(id);
        if (i < 0 || i !== g.turn || !isBetting()) return 'Not your turn';
        const s = seats[i];
        const toCall = g.currentBet - s.bet;
        const move = String(data.move);
        if (move === 'fold') {
            s.folded = true;
            s.last = 'fold';
        } else if (move === 'check') {
            if (toCall > 0) return 'You have to call or fold';
            s.last = 'check';
        } else if (move === 'call') {
            if (toCall <= 0) return 'Nothing to call';
            put(s, Math.min(toCall, s.stack));
            s.last = s.allIn ? 'all-in' : 'call';
        } else if (move === 'raise' || move === 'allin') {
            // raise: `to` = eigener Einsatz in dieser Runde danach
            const max = s.bet + s.stack;
            let to = move === 'allin' ? max : Math.floor(Number(data.to));
            if (!Number.isInteger(to) || to > max) return 'Invalid amount';
            if (to <= g.currentBet) {
                if (move === 'allin') {
                    // All-in fuer weniger als den Call ist ein Call
                    put(s, s.stack);
                    s.last = 'all-in';
                    s.acted = true;
                    afterAction(i);
                    return null;
                }
                return 'Raise must be higher than the current bet';
            }
            if (to < g.currentBet + g.minRaise && to < max) return `Minimum raise to ${g.currentBet + g.minRaise}`;
            const raise = to - g.currentBet;
            const label = g.currentBet > 0 ? 'raise' : 'bet';
            if (raise >= g.minRaise) g.minRaise = raise;
            g.currentBet = to;
            put(s, to - s.bet);
            s.last = s.allIn ? 'all-in' : label;
            // Runde geht fuer alle anderen wieder auf
            for (const [o] of live()) if (o !== s) o.acted = false;
        } else return 'Unknown move';
        s.acted = true;
        afterAction(i);
        return null;
    }

    function put(s, a) {
        s.stack -= a;
        s.bet += a;
        s.total += a;
        if (s.stack === 0) s.allIn = true;
    }

    // ---------- Takt ----------

    // true = etwas hat sich geaendert, neu senden
    function tick() {
        const now = Date.now();
        if (isBetting() && g.turn >= 0 && g.turnEnds && now >= g.turnEnds) {
            const s = seats[g.turn];
            act(s.id, { move: g.currentBet - s.bet > 0 ? 'fold' : 'check' });
            s.last = s.folded ? 'fold (time)' : 'check (time)';
            return true;
        }
        if (!g.phaseEnds || now < g.phaseEnds) return false;
        if (g.phase === 'starting') {
            startHand();
            return true;
        }
        if (g.phase === 'showdown') {
            for (const s of seated()) s.inHand = false;
            maybeStart();
            // direkt weiter, ohne erneut 3 s zu warten
            if (g.phase === 'starting') startHand();
            return true;
        }
        if (g.runout) {
            if (g.nextStreet) deal(g.nextStreet);
            else showdown();
            return true;
        }
        return false;
    }

    // Server faehrt herunter: Stacks und alles, was in der laufenden Hand
    // steckt, zurueck aufs Konto (die Hand gilt als nicht gespielt)
    function refundAll() {
        for (const s of seated()) {
            const back = s.stack + (s.inHand && isBetting() ? s.total : 0);
            if (back > 0) h.accounts.addCoins(s.account, back);
            s.stack = 0;
            s.total = 0;
        }
    }

    // ---------- Sicht eines Spielers ----------

    function view(forId) {
        const me = seatOf(forId);
        const showAll = g.phase === 'showdown' && g.results && g.results[0] && g.results[0].hand;
        const seatsOut = seats.map((s, i) => s && {
            id: s.id, name: s.name, color: s.color,
            stack: s.stack, bet: s.bet, folded: s.folded, allIn: s.allIn, last: s.last,
            inHand: s.inHand, gone: !!s.gone,
            cards: !s.inHand ? [] : i === me || (showAll && !s.folded) ? s.hole : s.hole.map(() => '??')
        });
        const out = {
            seats: seatsOut,
            you: me,
            dealer: g.dealer,
            turn: g.turn,
            board: g.board,
            pot: pot(),
            currentBet: g.currentBet,
            blinds: [SB, BB],
            buyIn: [BUYIN_MIN, BUYIN_MAX],
            hand: g.hand,
            results: g.phase === 'showdown' ? g.results : null
        };
        if (me >= 0 && g.turn === me && isBetting()) {
            const s = seats[me];
            const toCall = Math.min(g.currentBet - s.bet, s.stack);
            out.actions = {
                toCall,
                minTo: Math.min(g.currentBet + g.minRaise, s.bet + s.stack),
                maxTo: s.bet + s.stack,
                canRaise: s.stack > toCall
            };
        }
        if (me >= 0 && seats[me].inHand && !seats[me].folded && g.board.length >= 3) out.yourHand = best([...seats[me].hole, ...g.board]).name;
        return out;
    }

    // Kopfzeile: Phase und Restzeit (Zugzeit, wenn jemand dran ist)
    function header() {
        if (isBetting() && g.turnEnds) return { phase: g.phase, ends: g.turnEnds, total: MS.turn / SPEED };
        return { phase: g.phase, ends: g.phaseEnds, total: null };
    }

    return {
        sit, standUp, act, tick, view, header, refundAll,
        seatOf,
        // fuer die Tisch-Bilanz: was ein Spieler gerade am Tisch hat
        stackOf: id => {
            const i = seatOf(id);
            if (i < 0) return 0;
            const s = seats[i];
            return s.stack + (s.inHand && isBetting() ? s.total : 0) - s.buyIn;
        },
        players: () => seated().filter(s => !s.gone).map(s => s.name),
        // Nur fuer Tests
        _g: g, _seats: seats
    };
};

module.exports.best = best;
module.exports.eval5 = eval5;
module.exports.cmp = cmp;
module.exports.buildPots = buildPots;
module.exports.SEATS = SEATS;
module.exports.BLINDS = [SB, BB];
