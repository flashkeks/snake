// Handel zwischen Spielern (seit 4.5): Items aus dem Lager, Scrap, Coins.
//
// Ablauf: A schickt B eine Anfrage (B muss online sein), B nimmt an. Beide
// stellen ihr Angebot zusammen; jede Aenderung nimmt beiden "Ready" wieder
// weg (kein Tausch in letzter Sekunde). Sind beide ready, tauscht der Server
// in einem Schritt – vorher prueft er nochmal alles (Besitz, nicht im
// Loadout, genug Coins/Scrap, Platz im Lager).
//
// h: { accounts, send, clientsOf(key), refresh(c), hubRefresh(c), log(line) }

const I = require('./arena-items');

const INVITE_MS = 60000;
const MAX_ITEMS = 20;

module.exports = function createTrade(h) {
    const invites = new Map();      // id -> { id, from: key, to: key, at }
    const trades = new Map();       // id -> { id, sides: { [key]: side }, keys: [a, b] }
    let seq = 0;

    const nameOf = key => (h.accounts.get(key) || {}).name || key;
    const tradeOf = key => [...trades.values()].find(t => t.keys.includes(key)) || null;
    const toAll = (key, msg) => h.clientsOf(key).forEach(c => h.send(c, msg));
    const fresh = () => ({ items: [], scrap: 0, coins: 0, ready: false });

    function inLoadout(a, uid) {
        const l = a.loadout || {};
        return Object.entries(l).some(([k, v]) => k !== 'util' && v === uid);
    }

    // Ansicht fuer eine Seite: eigenes und fremdes Angebot mit allen Details
    function view(t, key) {
        const other = t.keys.find(k => k !== key);
        const side = k => {
            const s = t.sides[k];
            const a = h.accounts.arena(k);
            return {
                name: nameOf(k), ready: s.ready, scrap: s.scrap, coins: s.coins,
                items: s.items.map(uid => a.inv.find(x => x.uid === uid)).filter(Boolean).map(it => ({ ...it, sv: I.salvageValue(it) }))
            };
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
        const uids = [...new Set((Array.isArray(d.items) ? d.items : []).map(String))].slice(0, MAX_ITEMS);
        for (const uid of uids) {
            const it = a.inv.find(x => x.uid === uid);
            if (!it) return 'You do not own that item anymore';
            if (inLoadout(a, uid)) return 'Take it out of your loadout first';
        }
        const scrap = Math.max(0, Math.floor(Number(d.scrap) || 0));
        const coins = Math.max(0, Math.floor(Number(d.coins) || 0));
        if (scrap > a.scrap) return 'Not enough scrap';
        if (coins > u.coins) return 'Not enough coins';
        const s = t.sides[c.account];
        s.items = uids;
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
        const A = { key: ka, a: h.accounts.arena(ka), u: h.accounts.get(ka), s: t.sides[ka] };
        const B = { key: kb, a: h.accounts.arena(kb), u: h.accounts.get(kb), s: t.sides[kb] };
        const fail = why => {
            for (const k of t.keys) t.sides[k].ready = false;
            for (const k of t.keys) toAll(k, { type: 'trInfo', text: `Trade failed: ${why}`, err: true });
            push(t);
        };
        for (const X of [A, B]) {
            for (const uid of X.s.items) {
                if (!X.a.inv.some(x => x.uid === uid)) return fail(`${X.u.name} no longer has an item`);
                if (inLoadout(X.a, uid)) return fail(`${X.u.name} has an item in the loadout`);
            }
            if (X.a.scrap < X.s.scrap) return fail(`${X.u.name} lacks scrap`);
            if (X.u.coins < X.s.coins) return fail(`${X.u.name} lacks coins`);
        }
        for (const [X, Y] of [[A, B], [B, A]]) {
            if (X.a.inv.length - X.s.items.length + Y.s.items.length > I.INV_MAX) return fail(`${X.u.name}'s stash would be full`);
        }
        const take = X => {
            const out = X.a.inv.filter(x => X.s.items.includes(x.uid));
            X.a.inv = X.a.inv.filter(x => !X.s.items.includes(x.uid));
            return out;
        };
        const fromA = take(A), fromB = take(B);
        A.a.inv.push(...fromB);
        B.a.inv.push(...fromA);
        A.a.scrap += B.s.scrap - A.s.scrap;
        B.a.scrap += A.s.scrap - B.s.scrap;
        if (A.s.coins) h.accounts.addCoins(ka, -A.s.coins);
        if (B.s.coins) h.accounts.addCoins(kb, -B.s.coins);
        if (A.s.coins) h.accounts.addCoins(kb, A.s.coins);
        if (B.s.coins) h.accounts.addCoins(ka, B.s.coins);
        for (const X of [A, B]) h.accounts.stat(X.key, st => { st.trades = (st.trades || 0) + 1; });
        h.accounts.touch();
        if (h.log) h.log(`${A.u.name} ↔ ${B.u.name}: ${fromA.length} items, ${A.s.scrap} scrap, ${A.s.coins} coins ↔ ${fromB.length} items, ${B.s.scrap} scrap, ${B.s.coins} coins`);
        trades.delete(t.id);
        for (const [X, got] of [[A, fromB], [B, fromA]]) {
            h.clientsOf(X.key).forEach(c => {
                h.send(c, { type: 'trDone', got: got.map(it => it.name), scrap: (X === A ? B : A).s.scrap, coins: (X === A ? B : A).s.coins });
                h.refresh(c);
                h.hubRefresh(c);
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

    return { handle, gone };
};
