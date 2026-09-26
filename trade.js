// Direkter Handel zwischen zwei Spielern (5.2, vorher arena-trade.js).
// Seit dem Markt: Arena-Items, Kekemon-Karten, Cosmetics, Scrap, Coins.
// Gestartet wird er in der Markt-Lobby (F bei einem Spieler) oder per Name.
//
// Ablauf wie gehabt: A schickt B eine Anfrage (B muss online sein), B nimmt
// an. Beide stellen ihr Angebot zusammen; jede Aenderung nimmt beiden "Ready"
// wieder weg. Sind beide ready, prueft der Server alles nochmal und tauscht in
// einem Schritt.
//
// h: { accounts, assets, send, clientsOf(key), refresh(c), log(line) }

const INVITE_MS = 60000;
const MAX_REFS = 20;

module.exports = function createTrade(h) {
    const A = h.assets;
    const invites = new Map();      // id -> { id, from: key, to: key, at }
    const trades = new Map();       // id -> { id, sides: { [key]: side }, keys: [a, b] }
    let seq = 0;

    const nameOf = key => (h.accounts.get(key) || {}).name || key;
    const tradeOf = key => [...trades.values()].find(t => t.keys.includes(key)) || null;
    const toAll = (key, msg) => h.clientsOf(key).forEach(c => h.send(c, msg));
    const fresh = () => ({ refs: [], scrap: 0, coins: 0, ready: false });

    // Angebot als Gueter (nur zum Anzeigen, nichts wird bewegt)
    function preview(key, refs) {
        const u = h.accounts.get(key);
        const a = h.accounts.arena(key);
        return refs.map(r => {
            if (r.k === 'item') {
                const it = a.inv.find(x => x.uid === r.uid);
                return it ? A.view({ k: 'item', item: it }) : null;
            }
            if (r.k === 'card') return A.check(key, r) ? null : { k: 'card', key: r.key, n: r.n, ...(r.xp ? { xp: Array(r.n).fill(r.xp) } : {}) };
            if (r.k === 'pack' || r.k === 'case') return A.check(key, r) ? null : A.view({ k: r.k, id: r.id, n: r.n });
            return { k: 'cos', id: r.id };
        }).filter(Boolean);
    }

    function view(t, key) {
        const other = t.keys.find(k => k !== key);
        const side = k => {
            const s = t.sides[k];
            return { name: nameOf(k), ready: s.ready, scrap: s.scrap, coins: s.coins, refs: s.refs, assets: preview(k, s.refs) };
        };
        return { type: 'trState', id: t.id, me: side(key), them: side(other) };
    }

    function push(t) {
        for (const k of t.keys) toAll(k, view(t, k));
    }

    function close(t, why) {
        trades.delete(t.id);
        for (const k of t.keys) toAll(k, { type: 'trClosed', why });
    }

    function request(c, name) {
        const from = c.account;
        const to = String(name || '').trim().toLowerCase();
        if (!to || !h.accounts.get(to)) return 'No player with that name';
        if (to === from) return 'You cannot trade with yourself';
        if (!h.clientsOf(to).length) return `${nameOf(to)} is not online`;
        if (tradeOf(from)) return 'Finish your current trade first';
        if (tradeOf(to)) return `${nameOf(to)} is already trading`;
        // 26.09.2026 (Max): beide druecken F aufeinander -> Handel geht direkt auf
        for (const inv of invites.values()) {
            if (inv.from === to && inv.to === from && Date.now() - inv.at <= INVITE_MS) return accept(c, inv.id);
        }
        for (const [id, inv] of invites) if (inv.from === from && inv.to === to) invites.delete(id);
        const id = ++seq;
        invites.set(id, { id, from, to, at: Date.now() });
        toAll(to, { type: 'trInvite', id, from: nameOf(from) });
        h.send(c, { type: 'trInfo', text: `Trade request sent to ${nameOf(to)}` });
        return null;
    }

    function accept(c, id) {
        const inv = invites.get(Number(id));
        if (!inv || inv.to !== c.account || Date.now() - inv.at > INVITE_MS) return 'That request is gone';
        invites.delete(inv.id);
        if (tradeOf(inv.from) || tradeOf(inv.to)) return 'One of you is already trading';
        if (!h.clientsOf(inv.from).length) return `${nameOf(inv.from)} went offline`;
        const t = { id: ++seq, keys: [inv.from, inv.to], sides: { [inv.from]: fresh(), [inv.to]: fresh() } };
        trades.set(t.id, t);
        push(t);
        return null;
    }

    function decline(c, id) {
        const inv = invites.get(Number(id));
        if (!inv || inv.to !== c.account) return;
        invites.delete(inv.id);
        toAll(inv.from, { type: 'trInfo', text: `${nameOf(inv.to)} declined your trade request` });
    }

    // Eigenes Angebot setzen (komplett, nicht als Aenderung)
    function set(c, d) {
        const t = tradeOf(c.account);
        if (!t) return 'No open trade';
        const a = h.accounts.arena(c.account);
        const u = h.accounts.get(c.account);
        const refs = [];
        for (const raw of (Array.isArray(d.refs) ? d.refs : []).slice(0, MAX_REFS)) {
            const r = A.clean(raw);
            if (!r || refs.some(x => A.same(x, r))) continue;
            const err = A.check(c.account, r);
            if (err) return err;
            refs.push(r);
        }
        const scrap = Math.max(0, Math.floor(Number(d.scrap) || 0));
        const coins = Math.max(0, Math.floor(Number(d.coins) || 0));
        if (scrap > a.scrap) return 'Not enough scrap';
        if (coins > u.coins) return 'Not enough coins';
        const s = t.sides[c.account];
        s.refs = refs;
        s.scrap = scrap;
        s.coins = coins;
        // Jede Aenderung: beide muessen neu bestaetigen
        for (const k of t.keys) t.sides[k].ready = false;
        push(t);
        return null;
    }

    function ready(c, on) {
        const t = tradeOf(c.account);
        if (!t) return;
        t.sides[c.account].ready = !!on;
        if (t.keys.every(k => t.sides[k].ready)) return execute(t);
        push(t);
    }

    // Tauschen: erst alles pruefen, dann alles auf einmal
    function execute(t) {
        const [ka, kb] = t.keys;
        const X = k => ({ key: k, a: h.accounts.arena(k), u: h.accounts.get(k), s: t.sides[k] });
        const P = X(ka), Q = X(kb);
        const fail = why => {
            for (const k of t.keys) t.sides[k].ready = false;
            for (const k of t.keys) toAll(k, { type: 'trInfo', text: `Trade failed: ${why}`, err: true });
            push(t);
        };
        for (const S of [P, Q]) {
            for (const r of S.s.refs) {
                const err = A.check(S.key, r);
                if (err) return fail(`${S.u.name}: ${err}`);
            }
            if (S.a.scrap < S.s.scrap) return fail(`${S.u.name} lacks scrap`);
            if (S.u.coins < S.s.coins) return fail(`${S.u.name} lacks coins`);
        }
        const items = s => s.refs.filter(r => r.k === 'item').map(() => ({ k: 'item' }));
        if (!A.room(P.key, items(Q.s), items(P.s).length)) return fail(`${P.u.name}'s stash would be full`);
        if (!A.room(Q.key, items(P.s), items(Q.s).length)) return fail(`${Q.u.name}'s stash would be full`);
        const fromP = P.s.refs.map(r => A.take(P.key, r));
        const fromQ = Q.s.refs.map(r => A.take(Q.key, r));
        fromQ.forEach(x => A.give(P.key, x));
        fromP.forEach(x => A.give(Q.key, x));
        P.a.scrap += Q.s.scrap - P.s.scrap;
        Q.a.scrap += P.s.scrap - Q.s.scrap;
        if (P.s.coins) h.accounts.addCoins(ka, -P.s.coins);
        if (Q.s.coins) h.accounts.addCoins(kb, -Q.s.coins);
        if (P.s.coins) h.accounts.addCoins(kb, P.s.coins);
        if (Q.s.coins) h.accounts.addCoins(ka, Q.s.coins);
        for (const S of [P, Q]) h.accounts.stat(S.key, st => { st.trades = (st.trades || 0) + 1; });
        h.accounts.touch();
        const lbl = list => list.map(A.label).join(', ') || '–';
        if (h.log) h.log(`${P.u.name} ↔ ${Q.u.name}: ${lbl(fromP)} + ${P.s.scrap} scrap + ${P.s.coins} coins ↔ ${lbl(fromQ)} + ${Q.s.scrap} scrap + ${Q.s.coins} coins`);
        trades.delete(t.id);
        for (const [S, got, O] of [[P, fromQ, Q], [Q, fromP, P]]) {
            h.clientsOf(S.key).forEach(c => {
                h.send(c, { type: 'trDone', got: got.map(A.label), scrap: O.s.scrap, coins: O.s.coins });
                h.refresh(c);
            });
        }
    }

    function cancel(c) {
        const t = tradeOf(c.account);
        if (t) close(t, `${nameOf(c.account)} cancelled the trade`);
    }

    // Verbindung weg: offene Anfragen und Handel beenden, wenn kein Tab mehr offen ist
    function gone(c) {
        if (!c.account || h.clientsOf(c.account).some(x => x !== c)) return;
        const t = tradeOf(c.account);
        if (t) close(t, `${nameOf(c.account)} went offline`);
        for (const [id, inv] of invites) if (inv.from === c.account || inv.to === c.account) invites.delete(id);
    }

    function handle(c, d) {
        if (!c.account) return h.send(c, { type: 'trInfo', text: 'Log in first', err: true });
        let err = null;
        if (d.type === 'trReq') err = request(c, d.name);
        else if (d.type === 'trAccept') err = accept(c, d.id);
        else if (d.type === 'trDecline') decline(c, d.id);
        else if (d.type === 'trSet') err = set(c, d);
        else if (d.type === 'trReady') ready(c, d.on);
        else if (d.type === 'trCancel') cancel(c);
        else if (d.type === 'trState') {
            const t = tradeOf(c.account);
            if (t) h.send(c, view(t, c.account));
            for (const inv of invites.values()) if (inv.to === c.account && Date.now() - inv.at < INVITE_MS) h.send(c, { type: 'trInvite', id: inv.id, from: nameOf(inv.from) });
        }
        if (err) h.send(c, { type: 'trInfo', text: err, err: true });
    }

    // Laeuft ein Handel? (dann kein Einstellen ins Auktionshaus mit denselben Sachen noetig –
    // execute prueft ohnehin nochmal)
    return { handle, gone, busy: key => !!tradeOf(key) };
};
