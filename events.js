// Mini events: triggered by the big 3x3 event item. The whole game freezes,
// everyone who was on the field plays one round, then the game continues.
//
// Two kinds:
//   gamble  - bet your own coins (Roulette, Blackjack). Accounts only.
//   reward  - flat coins for playing well (Flag Quiz). Guests play too,
//             they just get length instead of coins.
//
// The server is the only source of truth: it deals, spins and pays out.
// Every change is broadcast as one `event` message with the full public state.

const FLAGS = require('./flags');

const BETS = [10, 25, 50, 100, 250, 500, 1000];

const KINDS = {
    flags: { title: '🏳️ Flag Quiz', type: 'reward' },
    roulette: { title: '🎡 Roulette', type: 'gamble' },
    blackjack: { title: '🃏 Blackjack', type: 'gamble' }
};

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// Zeitraffer nur fuer lokale Tests (SNAKE_EVENT_SPEED=10 macht alles zehnmal schneller)
const SPEED = Number(process.env.SNAKE_EVENT_SPEED) || 1;

const FLAG_ROUNDS = 6;
const FLAG_MS = 9000;
const REVEAL_MS = 2500;

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ---------- Blackjack helpers ----------

function newShoe() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const shoe = [];
    for (let d = 0; d < 6; d++) for (const s of suits) for (const r of ranks) shoe.push(r + s);
    return shuffle(shoe);
}

function handValue(cards) {
    let total = 0, aces = 0;
    for (const c of cards) {
        const r = c.slice(0, -1);
        if (r === 'A') {
            aces++;
            total += 11;
        } else if ('JQK'.includes(r) || r === '10') {
            total += 10;
        } else {
            total += Number(r);
        }
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return { total, soft: aces > 0 };
}

function isBlackjack(cards) {
    return cards.length === 2 && handValue(cards).total === 21;
}

// ---------- Roulette helpers ----------

function rouletteColor(n) {
    return n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
}

// Returns the payout multiplier (stake included) or 0
function rouletteWin(bet, n) {
    switch (bet.type) {
        case 'red': return n !== 0 && RED.has(n) ? 2 : 0;
        case 'black': return n !== 0 && !RED.has(n) ? 2 : 0;
        case 'even': return n !== 0 && n % 2 === 0 ? 2 : 0;
        case 'odd': return n % 2 === 1 ? 2 : 0;
        case 'low': return n >= 1 && n <= 18 ? 2 : 0;
        case 'high': return n >= 19 ? 2 : 0;
        case 'number': return bet.n === n ? 36 : 0;
        // Dutzend 1 = 1-12, 2 = 13-24, 3 = 25-36
        case 'dozen': return n !== 0 && Math.ceil(n / 12) === bet.n ? 3 : 0;
        // Spalte 1 = 1, 4, ... 34; Spalte 3 = 3, 6, ... 36 (die "2 to 1"-Felder am Board)
        case 'column': return n !== 0 && ((n - 1) % 3) + 1 === bet.n ? 3 : 0;
    }
    return 0;
}

const ROULETTE_TYPES = new Set(['red', 'black', 'even', 'odd', 'low', 'high', 'number', 'dozen', 'column']);

module.exports = function createEvents(h) {
    // h: { accounts, broadcast, feed, send, grow, onEnd }
    let ev = null;

    function phase(name, ms) {
        ev.phase = name;
        ev.phaseEnds = ms ? Date.now() + ms / SPEED : null;
    }

    function participant(c) {
        return ev && ev.members.get(c.id);
    }

    function board() {
        const rows = [...ev.members.values()].map(m => ({
            id: m.id, name: m.name, color: m.color, guest: m.guest,
            value: ev.score.get(m.id) || 0
        }));
        return rows.sort((a, b) => b.value - a.value);
    }

    function push() {
        if (!ev) return;
        const base = {
            type: 'event',
            kind: ev.kind,
            title: KINDS[ev.kind].title,
            eventType: KINDS[ev.kind].type,
            phase: ev.phase,
            left: ev.phaseEnds ? Math.max(0, ev.phaseEnds - Date.now()) : null,
            members: [...ev.members.keys()],
            board: board(),
            bets: BETS,
            podium: ev.phase === 'awards' ? ev.podium : null
        };
        h.broadcast({ ...base, data: publicData() });
    }

    function publicData() {
        if (ev.kind === 'flags') {
            const q = ev.q;
            return {
                round: ev.round,
                total: FLAG_ROUNDS,
                flag: q ? q.code : null,
                options: q ? q.options : [],
                answered: q ? [...q.answers.keys()] : [],
                correct: ev.phase === 'reveal' || ev.phase === 'results' ? (q ? q.correct : null) : null,
                right: ev.phase === 'reveal' && q ? [...q.answers].filter(([, a]) => a.choice === q.correct).map(([id]) => id) : [],
                rewards: ev.rewards || null
            };
        }
        if (ev.kind === 'roulette') {
            return {
                bets: ev.bets,
                result: ev.phase === 'spinning' || ev.phase === 'results' ? ev.result : null,
                color: ev.result === null ? null : rouletteColor(ev.result)
            };
        }
        if (ev.kind === 'blackjack') {
            const hands = {};
            for (const [id, seat] of ev.hands) hands[id] = seat;
            return {
                hands,
                dealer: ev.dealer.hidden
                    ? { cards: [ev.dealer.cards[0], '??'], total: null }
                    : { cards: ev.dealer.cards, total: ev.dealer.cards.length ? handValue(ev.dealer.cards).total : null }
            };
        }
        return {};
    }

    // ---------- Start / End ----------

    function start(players, forced) {
        if (ev || !players.length) return false;
        const kind = KINDS[forced] ? forced : ['flags', 'roulette', 'blackjack'][Math.floor(Math.random() * 3)];
        ev = {
            kind,
            members: new Map(players.map(p => [p.id, { id: p.id, name: p.name, color: p.color, guest: !p.account, account: p.account, player: p }])),
            score: new Map(),
            started: Date.now()
        };

        if (kind === 'flags') {
            ev.round = 0;
            ev.pool = shuffle([...FLAGS]);
            ev.q = null;
        }
        if (kind === 'roulette') {
            ev.bets = [];
            ev.result = null;
        }
        if (kind === 'blackjack') {
            ev.shoe = newShoe();
            ev.hands = new Map();
            ev.dealer = { cards: [], hidden: true };
        }

        phase('intro', 4000);
        h.feed(`🎪 EVENT: ${KINDS[kind].title}!`, 'gold', null, true);
        push();
        return true;
    }

    // Gewinne je Mitglied: Coins (bei Roulette/Blackjack der Reingewinn) und Laenge.
    // Daraus werden Podium und das Double-or-Nothing-Angebot.
    function awards() {
        if (!ev.rewards) {
            ev.rewards = {};
            for (const m of ev.members.values()) {
                const net = ev.score.get(m.id) || 0;
                ev.rewards[m.id] = { coins: m.account ? Math.max(0, net) : 0, length: 0 };
            }
        }
        ev.podium = board().slice(0, 3).map(r => ({ ...r, ...(ev.rewards[r.id] || { coins: 0, length: 0 }) }));
        phase('awards', 5000);
    }

    function end() {
        const done = ev;
        ev = null;
        h.broadcast({ type: 'eventEnd' });
        h.onEnd(done);
    }

    // ---------- Flag Quiz ----------

    function nextFlag() {
        ev.round++;
        const right = ev.pool.pop();
        const wrong = shuffle(FLAGS.filter(f => f.code !== right.code)).slice(0, 3);
        const options = shuffle([right, ...wrong]);
        ev.q = {
            code: right.code,
            options: options.map(o => o.name),
            correct: options.indexOf(right),
            answers: new Map(),
            asked: Date.now()
        };
        phase('question', FLAG_MS);
    }

    function flagsResults() {
        const rows = board();
        ev.rewards = {};
        rows.forEach((r, i) => {
            const m = ev.members.get(r.id);
            // Coins for accounts, length for everyone. Winner gets a bonus.
            let coins = Math.floor(r.value / 10) + (i === 0 && r.value > 0 ? 50 : 0);
            const length = Math.floor(r.value / 40);
            if (m.account && coins > 0) h.accounts.addCoins(m.account, coins);
            else coins = 0;
            if (length > 0) h.grow(m.player, length);
            ev.rewards[r.id] = { coins, length };
            if (m.account) h.send(m.player, { type: 'account', user: h.accounts.publicUser(h.accounts.get(m.account)) });
        });
        if (rows[0] && rows[0].value > 0) h.feed(`🏳️ ${rows[0].name} wins the Flag Quiz with ${rows[0].value} points`, 'good');
        phase('results', 8000);
    }

    // ---------- Roulette ----------

    function rouletteResults() {
        const net = new Map();
        for (const b of ev.bets) {
            const m = ev.members.get(b.id);
            const mult = rouletteWin(b, ev.result);
            const win = b.amount * mult;
            if (win > 0 && m && m.account) h.accounts.addCoins(m.account, win);
            b.win = win;
            net.set(b.id, (net.get(b.id) || 0) + win - b.amount);
        }
        for (const [id, v] of net) ev.score.set(id, v);
        for (const m of ev.members.values()) {
            if (m.account) h.send(m.player, { type: 'account', user: h.accounts.publicUser(h.accounts.get(m.account)) });
        }
        const best = [...net].sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] >= 500) h.feed(`🎡 ${ev.members.get(best[0]).name} wins ${best[1]} coins at Roulette`, 'gold');
        phase('results', 8000);
    }

    // ---------- Blackjack ----------

    function draw() {
        if (!ev.shoe.length) ev.shoe = newShoe();
        return ev.shoe.pop();
    }

    function cardValue(c) {
        const r = c.slice(0, -1);
        return r === 'A' ? 11 : 'JQK'.includes(r) || r === '10' ? 10 : Number(r);
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

    function bjDeal() {
        if (!ev.hands.size) {
            ev.score.clear();
            phase('results', 5000);
            return;
        }
        for (const seat of ev.hands.values()) {
            seat.hands = [newHand(seat.bet, [draw(), draw()])];
            seat.active = 0;
            bjAdvance(seat);
        }
        ev.dealer.cards = [draw(), draw()];
        ev.dealer.hidden = true;
        phase('playing', 30000);
        bjMaybeDealer();
    }

    function bjMaybeDealer() {
        if ([...ev.hands.values()].every(seat => seat.done)) {
            phase('dealer', null);
            ev.dealer.hidden = false;
            ev.nextStep = Date.now() + 1000 / SPEED;
        }
    }

    function bjDealerStep() {
        const v = handValue(ev.dealer.cards);
        const anyAlive = [...ev.hands.values()].some(seat => seat.hands.some(hd => hd.total <= 21 && !(isBlackjack(hd.cards) && !hd.split)));
        // Dealer zieht bis 17, bleibt bei Soft 17 stehen. Sind alle raus, zieht er nicht.
        if (anyAlive && v.total < 17) {
            ev.dealer.cards.push(draw());
            ev.nextStep = Date.now() + 1000 / SPEED;
            return;
        }
        bjResults();
    }

    function bjResults() {
        const d = handValue(ev.dealer.cards).total;
        const dealerBj = isBlackjack(ev.dealer.cards);
        for (const [id, seat] of ev.hands) {
            const m = ev.members.get(id);
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
                if (pay > 0 && m && m.account) h.accounts.addCoins(m.account, pay);
                hd.net = pay - hd.bet;
                net += hd.net;
            }
            seat.net = net;
            ev.score.set(id, net);
            if (m && m.account) h.send(m.player, { type: 'account', user: h.accounts.publicUser(h.accounts.get(m.account)) });
        }
        phase('results', 8000);
    }

    // ---------- Phase machine ----------

    function tick() {
        if (!ev) return;
        const now = Date.now();

        if (ev.phase === 'dealer') {
            if (now >= ev.nextStep) {
                bjDealerStep();
                push();
            }
            return;
        }

        if (!ev.phaseEnds || now < ev.phaseEnds) return;

        if (ev.phase === 'results') {
            awards();
            return push();
        }
        if (ev.phase === 'awards') return end();

        if (ev.kind === 'flags') {
            if (ev.phase === 'intro' || ev.phase === 'reveal') {
                if (ev.round >= FLAG_ROUNDS) flagsResults();
                else nextFlag();
            } else if (ev.phase === 'question') {
                phase('reveal', REVEAL_MS);
            }
        }

        if (ev.kind === 'roulette') {
            if (ev.phase === 'intro') phase('betting', 20000);
            else if (ev.phase === 'betting') {
                // forceResult setzt nur der Test-Hook (SNAKE_TEST=1)
                ev.result = ev.forceResult !== undefined ? ev.forceResult : Math.floor(Math.random() * 37);
                phase('spinning', 6500);
            } else if (ev.phase === 'spinning') rouletteResults();
        }

        if (ev.kind === 'blackjack') {
            if (ev.phase === 'intro') phase('betting', 15000);
            else if (ev.phase === 'betting') bjDeal();
            else if (ev.phase === 'playing') {
                // Time is up: everyone still playing stands
                for (const seat of ev.hands.values()) {
                    for (const hd of seat.hands) hd.done = true;
                    bjAdvance(seat);
                }
                bjMaybeDealer();
            }
        }

        push();
    }

    // ---------- Actions from players ----------

    function refreshAccount(c) {
        h.send(c, { type: 'account', user: h.accounts.publicUser(h.accounts.get(c.account)) });
    }

    function handle(c, data) {
        const m = participant(c);
        if (!m) return h.send(c, { type: 'eventError', error: 'You were not on the field when the event started' });

        if (ev.kind === 'flags') {
            if (ev.phase !== 'question' || ev.q.answers.has(c.id)) return;
            const choice = Number(data.choice);
            if (!(choice >= 0 && choice < 4)) return;
            const ms = Date.now() - ev.q.asked;
            ev.q.answers.set(c.id, { choice, ms });
            if (choice === ev.q.correct) {
                // Faster answers score more: 100 + up to 100 time bonus
                const pts = 100 + Math.round(100 * Math.max(0, FLAG_MS / SPEED - ms) / (FLAG_MS / SPEED));
                ev.score.set(c.id, (ev.score.get(c.id) || 0) + pts);
            }
            // Everybody answered: reveal right away
            if (ev.q.answers.size >= ev.members.size) phase('reveal', REVEAL_MS);
            return push();
        }

        if (!c.account) return h.send(c, { type: 'eventError', error: 'Log in to bet coins' });
        const u = h.accounts.get(c.account);
        if (!u) return;

        if (ev.kind === 'roulette') {
            if (ev.phase !== 'betting') return;
            if (data.clear) {
                const mine = ev.bets.filter(b => b.id === c.id);
                const refund = mine.reduce((s, b) => s + b.amount, 0);
                if (refund) h.accounts.addCoins(c.account, refund);
                ev.bets = ev.bets.filter(b => b.id !== c.id);
                refreshAccount(c);
                return push();
            }
            const bet = data.bet || {};
            const amount = Number(bet.amount);
            if (!ROULETTE_TYPES.has(bet.type) || !BETS.includes(amount)) return;
            const n = Number(bet.n);
            if (bet.type === 'number' && !(Number.isInteger(n) && n >= 0 && n <= 36)) return;
            if ((bet.type === 'dozen' || bet.type === 'column') && !(n >= 1 && n <= 3)) return;
            if (ev.bets.filter(b => b.id === c.id).length >= 12) return h.send(c, { type: 'eventError', error: 'Max 12 bets' });
            if (u.coins < amount) return h.send(c, { type: 'eventError', error: 'Not enough coins' });
            h.accounts.addCoins(c.account, -amount);
            ev.bets.push({ id: c.id, name: m.name, color: m.color, type: bet.type, n: ['number', 'dozen', 'column'].includes(bet.type) ? n : null, amount });
            refreshAccount(c);
            return push();
        }

        if (ev.kind === 'blackjack') {
            if (ev.phase === 'betting') {
                const amount = Number(data.bet);
                const old = ev.hands.get(c.id);
                if (data.clear) {
                    if (old) h.accounts.addCoins(c.account, old.bet);
                    ev.hands.delete(c.id);
                    refreshAccount(c);
                    return push();
                }
                if (!BETS.includes(amount)) return;
                if (u.coins + (old ? old.bet : 0) < amount) return h.send(c, { type: 'eventError', error: 'Not enough coins' });
                if (old) h.accounts.addCoins(c.account, old.bet);
                h.accounts.addCoins(c.account, -amount);
                ev.hands.set(c.id, { bet: amount, hands: [], active: 0, done: false, net: 0 });
                refreshAccount(c);
                return push();
            }
            if (ev.phase === 'playing') {
                const seat = ev.hands.get(c.id);
                if (!seat || seat.done) return;
                const hd = seat.hands[seat.active];
                if (data.move === 'hit') {
                    hd.cards.push(draw());
                } else if (data.move === 'stand') {
                    hd.done = true;
                } else if (data.move === 'double') {
                    if (hd.cards.length !== 2 || u.coins < hd.bet) return;
                    h.accounts.addCoins(c.account, -hd.bet);
                    hd.bet *= 2;
                    hd.doubled = true;
                    hd.cards.push(draw());
                    hd.done = true;
                } else if (data.move === 'split') {
                    // Einmal teilen, zwei Karten gleichen Werts, gleicher Einsatz nochmal
                    if (seat.hands.length !== 1 || hd.cards.length !== 2 || cardValue(hd.cards[0]) !== cardValue(hd.cards[1]) || u.coins < hd.bet) return;
                    h.accounts.addCoins(c.account, -hd.bet);
                    const aces = hd.cards[0].startsWith('A');
                    const a = newHand(hd.bet, [hd.cards[0], draw()], true);
                    const b = newHand(hd.bet, [hd.cards[1], draw()], true);
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
                refreshAccount(c);
                bjMaybeDealer();
                return push();
            }
        }
    }

    // A participant left the game: an open blackjack hand stands automatically
    function leave(id) {
        if (!ev) return;
        const seat = ev.hands && ev.hands.get(id);
        if (seat && ev.phase === 'playing') {
            for (const hd of seat.hands) hd.done = true;
            bjAdvance(seat);
            bjMaybeDealer();
        }
    }

    return {
        start,
        tick,
        handle,
        leave,
        active: () => !!ev,
        // Nur fuer Tests: interner Zustand (z. B. um einen Kartenstapel vorzugeben)
        _state: () => ev,
        push,
        isMember: id => !!(ev && ev.members.has(id))
    };
};

module.exports.KINDS = KINDS;
module.exports.handValue = handValue;
module.exports.rouletteWin = rouletteWin;
