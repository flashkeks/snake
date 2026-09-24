// Kekemon-Duelle (5.10): Spieler gegen Spieler, 3 gegen 3, gleiche Regeln wie
// die Arenen (km-battle.js).
//
// Gegner finden (Max: beides):
//   - offene Duelle: jeder kann eins eroeffnen, jeder andere kann annehmen
//   - Herausforderung: direkt an einen Spieler, der gerade online ist; nur der
//     darf annehmen (oder ablehnen)
//
// Einsatz (Max: Einsatz + Rating): der Eroeffner legt 0 bis 100 000 Coins fest,
// beide zahlen ihn beim Kampfbeginn, der Sieger bekommt beide. Es entstehen
// also keine Coins aus dem Nichts. Der Einsatz liegt waehrend des Kampfes als
// u.kmDuelEscrow am Konto – stirbt der Server mitten im Kampf, zahlt der
// naechste Start ihn zurueck (siehe refundEscrows).
//
// Ablauf: Duell eroeffnen -> Gegner nimmt an -> beide waehlen drei Karten
// (90 s) -> Kampf. Seit 6.0 waehlen beide gleichzeitig (wie Showdown), 45 s je
// Zug; wer sie verstreichen laesst, bekommt eine automatische Wahl (bzw. die
// naechste Karte). Drei verpasste Zuege am Stueck = Aufgabe.
// Der Kampf haengt am Konto, nicht an der Verbindung: Seite neu laden geht.
//
// Rating: Elo, Start 1000, K = 32, in u.kmDuel = { rating, wins, losses, won }.
// Leaderboard "kmduel" (accounts.board).
//
// h: { accounts, cards, cardDb, battle, send, clientsOf(key), refresh(c), feed(text, kind), log(line) }

const STAKE_MAX = 100000;
const PICK_MS = 90000;
const TURN_MS = 45000;
const AFK_LIMIT = 3;
const OPEN_MS = 10 * 60000;     // offenes Duell verfaellt nach 10 min
const K = 32;

module.exports = function createDuels(h) {
    const { accounts, cards, cardDb, battle: B } = h;
    const lobbies = new Map();      // id -> { id, host, target, stake, at, guest, teams: {key: [cardKeys]}, pickUntil }
    const duels = new Map();        // id -> { id, keys: [a, b], b, stake, turnAt, afk: [0, 0] }
    let seq = 0;

    const nameOf = key => (accounts.get(key) || {}).name || key;
    const toAll = (key, msg) => h.clientsOf(key).forEach(c => h.send(c, msg));
    const online = key => h.clientsOf(key).length > 0;
    const lobbyOf = key => [...lobbies.values()].find(l => l.host === key || l.guest === key) || null;
    const duelOf = key => [...duels.values()].find(d => d.keys.includes(key)) || null;
    const record = u => {
        u.kmDuel = u.kmDuel || { rating: 1000, wins: 0, losses: 0, won: 0 };
        return u.kmDuel;
    };

    // Einsatz aus einem abgebrochenen Kampf (Server-Neustart) zurueck
    (function refundEscrows() {
        for (const [key, u] of accounts.users()) {
            if (u.kmDuelEscrow > 0) {
                const n = u.kmDuelEscrow;
                u.kmDuelEscrow = 0;
                accounts.addCoins(key, n);
                h.log(`kmduel: Einsatz ${n} an ${u.name} zurueck (Kampf durch Neustart abgebrochen)`);
            }
        }
    })();

    // ---------- Ansicht ----------

    function lobbyView(l, key) {
        return {
            id: l.id, host: nameOf(l.host), target: l.target ? nameOf(l.target) : null, stake: l.stake,
            guest: l.guest ? nameOf(l.guest) : null, mine: l.host === key, forMe: l.target === key,
            rating: record(accounts.get(l.host)).rating,
            picking: !!l.guest, ready: l.guest ? { me: !!l.teams[key], them: !!l.teams[l.host === key ? l.guest : l.host] } : null,
            pickLeft: l.pickUntil ? Math.max(0, l.pickUntil - Date.now()) : 0
        };
    }

    function duelView(d, key) {
        const me = d.keys.indexOf(key);
        const wait = B.waitingOn(d.b).length ? true : null;
        return {
            id: d.id, stake: d.stake, me, view: B.view(d.b, me),
            foe: nameOf(d.keys[1 - me]), foeRating: record(accounts.get(d.keys[1 - me])).rating,
            turnLeft: wait === null ? 0 : Math.max(0, d.turnAt - Date.now()),
            afk: d.afk[me]
        };
    }

    function state(key, extra) {
        const u = accounts.get(key);
        const mine = lobbyOf(key);
        const d = duelOf(key);
        return {
            type: 'kdState',
            me: { ...record(u), name: u.name },
            // offene Duelle und Herausforderungen an mich; eigene steht in mine
            open: [...lobbies.values()].filter(l => !l.guest && l.host !== key && (!l.target || l.target === key)).map(l => lobbyView(l, key)),
            mine: mine ? lobbyView(mine, key) : null,
            duel: d ? duelView(d, key) : null,
            online: [...new Set(h.onlineKeys())].filter(k => k !== key).map(nameOf).sort().slice(0, 100),
            ...extra
        };
    }

    function push(key, extra) {
        toAll(key, state(key, extra));
    }

    // Alle, die die Liste offener Duelle sehen koennten, neu versorgen
    function pushAll() {
        for (const k of new Set(h.onlineKeys())) push(k);
    }

    // ---------- Lobby ----------

    function create(c, d) {
        const key = c.account;
        const u = accounts.get(key);
        if (duelOf(key)) return 'Finish your current duel first';
        if (lobbyOf(key)) return 'You already have a duel open';
        const stake = Math.floor(Number(d.stake) || 0);
        if (stake < 0 || stake > STAKE_MAX) return `Stake: 0 to ${STAKE_MAX.toLocaleString('en-US')} coins`;
        if (u.coins < stake) return 'You do not have that many coins';
        let target = null;
        if (d.target) {
            target = String(d.target).trim().toLowerCase();
            if (!accounts.get(target)) return 'No player with that name';
            if (target === key) return 'You cannot challenge yourself';
            if (!online(target)) return `${nameOf(target)} is not online`;
        }
        const l = { id: ++seq, host: key, target, stake, at: Date.now(), guest: null, teams: {}, pickUntil: 0 };
        lobbies.set(l.id, l);
        if (target) toAll(target, { type: 'kdInvite', id: l.id, from: u.name, stake });
        h.log(`kmduel: ${u.name} eroeffnet Duell #${l.id} (Einsatz ${stake}${target ? `, an ${nameOf(target)}` : ''})`);
        pushAll();
        return null;
    }

    function cancel(l, why) {
        lobbies.delete(l.id);
        for (const k of [l.host, l.guest]) if (k) toAll(k, { type: 'kdInfo', text: why });
        pushAll();
    }

    function join(c, id) {
        const key = c.account;
        const l = lobbies.get(Number(id));
        if (!l || l.guest) return 'That duel is gone';
        if (l.host === key) return 'That is your own duel';
        if (l.target && l.target !== key) return 'That challenge is for someone else';
        if (duelOf(key) || lobbyOf(key)) return 'Finish your current duel first';
        if (accounts.get(key).coins < l.stake) return `You need ${l.stake.toLocaleString('en-US')} coins for this duel`;
        if (!online(l.host)) {
            lobbies.delete(l.id);
            pushAll();
            return `${nameOf(l.host)} went offline`;
        }
        l.guest = key;
        l.pickUntil = Date.now() + PICK_MS;
        toAll(l.host, { type: 'kdInfo', text: `⚔️ ${nameOf(key)} accepted your duel – pick your team!`, go: true });
        pushAll();
        return null;
    }

    function decline(c, id) {
        const l = lobbies.get(Number(id));
        if (!l || l.target !== c.account || l.guest) return null;
        cancel(l, `${nameOf(c.account)} declined the duel`);
        return null;
    }

    function team(c, d) {
        const key = c.account;
        const l = lobbyOf(key);
        if (!l || !l.guest) return 'No duel to pick a team for';
        const u = accounts.get(key);
        const keys = Array.isArray(d.team) ? d.team.map(String).slice(0, 3) : [];
        if (keys.length !== 3) return 'Pick three cards';
        const own = u.cards || {};
        const ids = new Set();
        for (const k of keys) {
            const { id } = cards.parseKey(k);
            if (!cardDb.byId[id] || !(own[k] > 0)) return 'You do not own one of those cards';
            if (ids.has(id)) return 'Pick three different cards';
            ids.add(id);
        }
        l.teams[key] = keys;
        if (l.teams[l.host] && l.teams[l.guest]) return start(l);
        for (const k of [l.host, l.guest]) push(k);
        return null;
    }

    // ---------- Kampf ----------

    function fightersOf(key, keys) {
        const own = accounts.get(key).cards || {};
        const out = [];
        for (const k of keys) {
            const { id, v } = cards.parseKey(k);
            // Karte kann seit der Auswahl verkauft/gehandelt worden sein
            if (!cardDb.byId[id] || !(own[k] > 0)) return null;
            out.push(B.fighter(cardDb.byId[id], v, 1));
        }
        return out;
    }

    function start(l) {
        const [a, b] = [l.host, l.guest];
        const ua = accounts.get(a), ub = accounts.get(b);
        const ta = fightersOf(a, l.teams[a]), tb = fightersOf(b, l.teams[b]);
        if (!ta || !tb) {
            // Wer seine Karte nicht mehr hat, muss neu waehlen
            if (!ta) delete l.teams[a];
            if (!tb) delete l.teams[b];
            for (const k of [a, b]) push(k, { info: 'A picked card is gone – pick again' });
            return null;
        }
        if (ua.coins < l.stake || ub.coins < l.stake) {
            cancel(l, 'Not enough coins for the stake – duel cancelled');
            return null;
        }
        lobbies.delete(l.id);
        if (l.stake) {
            for (const k of [a, b]) {
                accounts.addCoins(k, -l.stake);
                accounts.get(k).kmDuelEscrow = l.stake;
            }
            accounts.touch();
        }
        const { b: battle, ev } = B.createBattle(ta, tb, { nameA: ua.name, nameB: ub.name, ai: false });
        const d = { id: l.id, keys: [a, b], b: battle, stake: l.stake, turnAt: Date.now() + TURN_MS, afk: [0, 0], point: battle.turn + battle.phase };
        duels.set(d.id, d);
        h.log(`kmduel: #${d.id} ${ua.name} gegen ${ub.name}, Einsatz ${l.stake}`);
        for (const [i, k] of d.keys.entries()) {
            toAll(k, state(k, { ev: B.flip(ev, i), started: true }));
            h.clientsOf(k).forEach(c => h.refresh(c));
        }
        pushAll();
        return null;
    }

    // Ergebnis eines Zuges an beide
    function after(d, ev) {
        // Zugzeit neu, sobald ein neuer Entscheidungspunkt beginnt (nicht schon,
        // wenn nur eine Seite gewaehlt hat)
        const key = d.b.turn + d.b.phase;
        if (key !== d.point) {
            d.point = key;
            d.turnAt = Date.now() + TURN_MS;
        }
        let result = null;
        if (d.b.over) result = finish(d);
        for (const [i, k] of d.keys.entries()) {
            toAll(k, state(k, { ev: B.flip(ev, i), result: result ? result[i] : null, duelDone: result ? duelViewDone(d, k) : null }));
            if (result) h.clientsOf(k).forEach(c => h.refresh(c));
        }
    }

    // Endstand, nachdem der Kampf schon aus der Liste ist
    function duelViewDone(d, key) {
        return { ...duelView(d, key), turnLeft: 0 };
    }

    function finish(d) {
        duels.delete(d.id);
        const w = d.b.winner;
        const [kw, kl] = [d.keys[w], d.keys[1 - w]];
        const uw = accounts.get(kw), ul = accounts.get(kl);
        const rw = record(uw), rl = record(ul);
        // Elo
        const exp = 1 / (1 + Math.pow(10, (rl.rating - rw.rating) / 400));
        const delta = Math.max(1, Math.round(K * (1 - exp)));
        rw.rating += delta;
        rl.rating = Math.max(100, rl.rating - delta);
        rw.wins++;
        rl.losses++;
        // Einsatz: beide Anteile an den Sieger
        uw.kmDuelEscrow = 0;
        ul.kmDuelEscrow = 0;
        const pot = d.stake * 2;
        if (pot) {
            accounts.addCoins(kw, pot);
            accounts.earn(kw, 'cards', d.stake);
            accounts.earn(kl, 'cards', -d.stake);
            rw.won = (rw.won || 0) + d.stake;
            rl.won = (rl.won || 0) - d.stake;
        }
        accounts.stat(kw, s => { s.kmDuels = (s.kmDuels || 0) + 1; s.kmDuelWins = (s.kmDuelWins || 0) + 1; });
        accounts.stat(kl, s => { s.kmDuels = (s.kmDuels || 0) + 1; });
        accounts.touch();
        const forfeit = d.forfeit !== undefined;
        if (d.stake >= 10000) h.feed(`⚔️ ${uw.name} beat ${ul.name} in a Kekémon duel and won ${pot.toLocaleString('en-US')} coins`, 'gold');
        else h.feed(`⚔️ ${uw.name} beat ${ul.name} in a Kekémon duel`, 'good');
        h.log(`kmduel: #${d.id} ${uw.name} schlaegt ${ul.name}${forfeit ? ' (Aufgabe)' : ''}, Einsatz ${d.stake}, Elo +-${delta}`);
        const res = win => ({ win, pot: win ? pot : 0, stake: d.stake, delta: win ? delta : -delta, rating: (win ? rw : rl).rating });
        return w === 0 ? [res(true), res(false)] : [res(false), res(true)];
    }

    function act(c, data) {
        const key = c.account;
        const d = duelOf(key);
        if (!d) return 'No duel running';
        const s = d.keys.indexOf(key);
        const a = String(data.a);
        const r = B.play(d.b, { a, i: data.i, to: data.to }, s);
        if (r.err) return r.err;
        if (a === 'forfeit') d.forfeit = s;
        d.afk[s] = 0;
        after(d, r.ev);
        return null;
    }

    // ---------- Takt: Zugzeit, Auswahlzeit, verwaiste Duelle ----------

    function tick() {
        const now = Date.now();
        for (const d of [...duels.values()]) {
            if (now < d.turnAt) continue;
            const who = B.waitingOn(d.b);
            if (!who.length) continue;
            for (const s of who) d.afk[s]++;
            const gone = who.find(s => d.afk[s] >= AFK_LIMIT);
            let r;
            if (gone !== undefined) {
                d.forfeit = gone;
                r = B.play(d.b, { a: 'forfeit' }, gone);
                r.ev.unshift({ k: 'afk', s: gone });
            } else r = B.auto(d.b);
            // Auch ohne neuen Entscheidungspunkt nicht sofort wieder ausloesen
            d.turnAt = Date.now() + TURN_MS;
            after(d, r.ev);
        }
        let changed = false;
        for (const l of [...lobbies.values()]) {
            if (l.guest && now > l.pickUntil) {
                cancel(l, 'Time to pick a team ran out – duel cancelled');
            } else if (!l.guest && (now - l.at > OPEN_MS || !online(l.host))) {
                lobbies.delete(l.id);
                changed = true;
            }
        }
        if (changed) pushAll();
    }

    // Verbindung weg: offene (noch nicht angenommene) Duelle des Spielers
    // verschwinden, wenn er ganz offline ist; laufende Kaempfe laufen weiter
    function gone(c) {
        if (!c.account || online(c.account)) return;
        const l = lobbyOf(c.account);
        if (l && !l.guest) {
            lobbies.delete(l.id);
            pushAll();
        }
    }

    function handle(c, d) {
        if (!c.account) return h.send(c, { type: 'kmError', error: 'Log in first' });
        let err = null;
        const key = c.account;
        if (d.type === 'kdState') return h.send(c, state(key));
        if (d.type === 'kdCreate') err = create(c, d);
        else if (d.type === 'kdJoin') err = join(c, d.id);
        else if (d.type === 'kdDecline') err = decline(c, d.id);
        else if (d.type === 'kdCancel') {
            const l = lobbyOf(key);
            if (l) cancel(l, l.guest ? `${nameOf(key)} left the duel` : 'Duel closed');
        }
        else if (d.type === 'kdTeam') err = team(c, d);
        else if (d.type === 'kdAct') err = act(c, d);
        if (err) h.send(c, { type: 'kmError', error: err });
    }

    return { handle, tick, gone, busy: key => !!duelOf(key), STAKE_MAX, TURN_MS };
};
