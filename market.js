// Auktionshaus (5.2, Markt): Arena-Items, Kekemon-Karten, Cosmetics einstellen,
// als Sofortkauf (BIN, Buy it Now) oder als Auktion (Startgebot, optional mit
// Sofortkauf-Preis, Laufzeit 1–48 h).
//
// Treuhand: Eingestelltes ist sofort beim Verkaeufer weg und liegt hier.
// Gebote werden sofort abgebucht; wer ueberboten wird, bekommt sein Gebot
// zurueck. Verkauf: Kaeufer bekommt das Gut, Verkaeufer den Preis minus 5 %
// Gebuehr (Coin-Senke). Passt ein Arena-Item nicht mehr ins Lager (voll),
// landet es im Abholfach ("Collect"), genauso alles bei Offline-Spielern ohne Platz.
//
// Gespeichert in DATA_DIR/market.json (atomar, kurz nach jeder Aenderung und
// beim Beenden) – liegt damit wie accounts.json im Backup.
//
// h: { dataDir, accounts, assets, send, clientsOf(key), feed(text, kind), refresh(c), log(line), onChange(), cardV }

const fs = require('fs');
const path = require('path');

const FEE = 0.05;
const MAX_LISTINGS = 20;          // je Spieler gleichzeitig
const HOURS = [1, 6, 12, 24, 48];
const MIN_STEP = 0.05;            // naechstes Gebot mind. +5 %
const SNIPE_MS = 60000;           // Gebot in der letzten Minute verlaengert auf 1 Minute
const MAX_PRICE = 1e10;

module.exports = function createMarket(h) {
    const A = h.assets;
    const file = path.join(h.dataDir, 'market.json');
    let st = { seq: 0, listings: [], claims: {}, sold: [] };
    if (fs.existsSync(file)) {
        try {
            st = { ...st, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
        } catch (err) {
            // Kaputt: nicht ueberschreiben, sonst sind verwahrte Sachen weg
            console.error(`market: ${file} ist kaputt (${err.message}). Aus dem Backup holen, dann neu starten.`);
            process.exit(1);
        }
    }

    // Kekemon-Reset 2 (5.5): Karten im Auktionshaus und im Abholfach verfallen,
    // Hoechstgebote gehen zurueck. Einmalig (Merker in market.json).
    const resetCards = !st.kmReset2;

    let dirty = false, timer = null;
    function save(sync) {
        if (!dirty && !sync) return;
        dirty = false;
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(st));
        fs.renameSync(tmp, file);
    }
    function changed() {
        dirty = true;
        if (!timer) timer = setTimeout(() => { timer = null; save(); }, 500);
        if (h.onChange) h.onChange();
    }

    const nameOf = key => (h.accounts.get(key) || {}).name || key;
    if (resetCards) {
        for (const l of st.listings.filter(x => x.asset.k === 'card')) {
            if (l.bidder && l.bid) h.accounts.addCoins(l.bidder, l.bid);
            console.log(`market: Kekemon-Reset 2 – Angebot ${l.id} von ${l.sellerName} entfernt`);
        }
        st.listings = st.listings.filter(x => x.asset.k !== 'card');
        for (const k of Object.keys(st.claims)) {
            st.claims[k] = st.claims[k].filter(x => x.asset.k !== 'card');
            if (!st.claims[k].length) delete st.claims[k];
        }
        st.kmReset2 = new Date().toISOString();
        dirty = true;
        save(true);
    }
    const toAll = (key, msg) => h.clientsOf(key).forEach(c => h.send(c, msg));
    const note = (key, text, kind) => toAll(key, { type: 'mkNote', text, kind: kind || 'ok' });

    // Gut abliefern: direkt, wenn Platz ist, sonst ins Abholfach
    function deliver(key, asset, why) {
        if (A.room(key, [asset])) A.give(key, asset);
        else (st.claims[key] = st.claims[key] || []).push({ asset, why, at: Date.now() });
    }

    function pay(key, coins) {
        if (coins > 0) h.accounts.addCoins(key, coins);
    }

    function nextMin(l) {
        return l.bid ? Math.max(l.bid + 1, Math.ceil(l.bid * (1 + MIN_STEP))) : l.start;
    }

    function pub(l) {
        return {
            id: l.id, seller: l.sellerName, asset: A.view(l.asset), type: l.type, bin: l.bin || null,
            start: l.start || null, bid: l.bid || 0, bidder: l.bidderName || null, bids: l.bids || 0,
            min: l.type === 'auction' ? nextMin(l) : null, created: l.created, ends: l.ends
        };
    }

    function state(c) {
        const key = c.account;
        return {
            type: 'mkState', now: Date.now(), fee: FEE, hours: HOURS, max: MAX_LISTINGS, v: h.cardV,
            listings: st.listings.map(pub),
            mineIds: st.listings.filter(l => l.seller === key).map(l => l.id),
            bidIds: st.listings.filter(l => l.bidder === key).map(l => l.id),
            claims: (st.claims[key] || []).map(x => ({ asset: A.view(x.asset), why: x.why })),
            sold: st.sold.slice(-20).reverse(),
            have: A.mine(key)
        };
    }

    // Verkauf abschliessen (Sofortkauf oder Auktionsende mit Gebot)
    function settle(l, buyer, price) {
        st.listings = st.listings.filter(x => x !== l);
        const fee = Math.floor(price * FEE);
        pay(l.seller, price - fee);
        deliver(buyer, l.asset, `Bought from ${l.sellerName}`);
        const what = A.label(l.asset);
        st.sold.push({ what, price, buyer: nameOf(buyer), seller: l.sellerName, at: Date.now() });
        if (st.sold.length > 100) st.sold.shift();
        h.accounts.stat(l.seller, s => { s.mkSold = (s.mkSold || 0) + 1; });
        h.accounts.stat(buyer, s => { s.mkBought = (s.mkBought || 0) + 1; });
        note(l.seller, `💰 Sold ${what} to ${nameOf(buyer)} for ${price.toLocaleString('en-US')} coins (−${fee.toLocaleString('en-US')} fee)`);
        note(buyer, `📦 You got ${what} for ${price.toLocaleString('en-US')} coins`);
        if (price >= 100000) h.feed(`🏛️ ${nameOf(buyer)} bought ${what} for ${price.toLocaleString('en-US')} coins`, 'good');
        if (h.log) h.log(`market: ${l.sellerName} -> ${nameOf(buyer)}: ${what} fuer ${price} (${fee} Gebuehr)`);
        for (const k of [l.seller, buyer]) h.clientsOf(k).forEach(c => h.refresh(c));
    }

    function list(c, d) {
        const key = c.account;
        if (st.listings.filter(l => l.seller === key).length >= MAX_LISTINGS) return `You can have at most ${MAX_LISTINGS} listings`;
        const ref = A.clean(d.ref);
        if (!ref) return 'Pick something to sell';
        const err = A.check(key, ref);
        if (err) return err;
        const type = d.kind === 'auction' ? 'auction' : 'bin';
        const hours = HOURS.includes(Number(d.hours)) ? Number(d.hours) : 24;
        const num = x => Math.floor(Number(x) || 0);
        const bin = num(d.bin), start = num(d.start);
        if (type === 'bin' && (bin < 1 || bin > MAX_PRICE)) return 'Set a price';
        if (type === 'auction') {
            if (start < 1 || start > MAX_PRICE) return 'Set a starting bid';
            if (bin && bin <= start) return 'Buy-it-now price must be above the starting bid';
        }
        const asset = A.take(key, ref);
        const u = h.accounts.get(key);
        const l = {
            id: ++st.seq, seller: key, sellerName: u.name, asset, type,
            bin: type === 'bin' ? bin : bin || null, start: type === 'auction' ? start : null,
            bid: 0, bidder: null, bidderName: null, bids: 0, created: Date.now(), ends: Date.now() + hours * 3600e3
        };
        st.listings.push(l);
        h.accounts.touch();
        if (h.log) h.log(`market: ${u.name} stellt ein: ${A.label(asset)} (${type}, ${type === 'bin' ? bin : start})`);
        changed();
        h.clientsOf(key).forEach(x => h.refresh(x));
        note(key, `📜 Listed ${A.label(asset)}`);
        return null;
    }

    function buy(c, id) {
        const key = c.account;
        const l = st.listings.find(x => x.id === Number(id));
        if (!l || !l.bin) return 'That listing is gone';
        if (l.seller === key) return 'That is your own listing';
        const u = h.accounts.get(key);
        if (u.coins < l.bin) return 'Not enough coins';
        if (!A.room(key, [l.asset])) note(key, 'Your stash is full – it waits in 📦 Collect', 'err');
        h.accounts.addCoins(key, -l.bin);
        // Laufende Auktion: Hoechstbietenden auszahlen
        if (l.bidder) {
            pay(l.bidder, l.bid);
            note(l.bidder, `↩️ ${A.label(l.asset)} was bought out – your bid of ${l.bid.toLocaleString('en-US')} is back`);
        }
        settle(l, key, l.bin);
        changed();
        return null;
    }

    function bid(c, id, amount) {
        const key = c.account;
        const l = st.listings.find(x => x.id === Number(id));
        if (!l || l.type !== 'auction') return 'That auction is gone';
        if (l.seller === key) return 'That is your own auction';
        if (l.bidder === key) return 'You already have the highest bid';
        const n = Math.floor(Number(amount) || 0);
        const min = nextMin(l);
        if (n < min) return `Bid at least ${min.toLocaleString('en-US')}`;
        if (n > MAX_PRICE) return 'Too high';
        // Gebot ueber Sofortkauf: dann eben Sofortkauf
        if (l.bin && n >= l.bin) return buy(c, id);
        const u = h.accounts.get(key);
        if (u.coins < n) return 'Not enough coins';
        h.accounts.addCoins(key, -n);
        if (l.bidder) {
            pay(l.bidder, l.bid);
            note(l.bidder, `⚠️ You were outbid on ${A.label(l.asset)} (${n.toLocaleString('en-US')}) – your coins are back`, 'err');
        }
        l.bid = n;
        l.bidder = key;
        l.bidderName = u.name;
        l.bids = (l.bids || 0) + 1;
        if (l.ends - Date.now() < SNIPE_MS) l.ends = Date.now() + SNIPE_MS;
        note(l.seller, `🔨 New bid on ${A.label(l.asset)}: ${n.toLocaleString('en-US')} by ${u.name}`);
        h.accounts.touch();
        changed();
        h.clientsOf(key).forEach(x => h.refresh(x));
        return null;
    }

    function cancel(c, id) {
        const l = st.listings.find(x => x.id === Number(id));
        if (!l || l.seller !== c.account) return 'That listing is gone';
        if (l.bidder) return 'There is already a bid – you cannot cancel anymore';
        st.listings = st.listings.filter(x => x !== l);
        deliver(c.account, l.asset, 'Cancelled listing');
        changed();
        h.clientsOf(c.account).forEach(x => h.refresh(x));
        note(c.account, `↩️ ${A.label(l.asset)} is back`);
        return null;
    }

    function claim(c) {
        const key = c.account;
        const list = st.claims[key] || [];
        const left = [];
        let n = 0;
        for (const x of list) {
            if (A.room(key, [x.asset])) { A.give(key, x.asset); n++; } else left.push(x);
        }
        if (left.length) st.claims[key] = left;
        else delete st.claims[key];
        changed();
        h.clientsOf(key).forEach(x => h.refresh(x));
        if (!n && left.length) return 'Your arena stash is full – salvage something first';
        note(key, `📦 Collected ${n} thing${n === 1 ? '' : 's'}`);
        return null;
    }

    // Abgelaufene Auktionen und Angebote
    function tick() {
        const now = Date.now();
        for (const l of st.listings.filter(x => x.ends <= now)) {
            if (l.type === 'auction' && l.bidder) settle(l, l.bidder, l.bid);
            else {
                st.listings = st.listings.filter(x => x !== l);
                deliver(l.seller, l.asset, 'Not sold');
                note(l.seller, `⌛ ${A.label(l.asset)} did not sell and is back`);
                h.clientsOf(l.seller).forEach(x => h.refresh(x));
            }
            changed();
        }
    }
    setInterval(tick, 5000);

    function handle(c, d) {
        if (!c.account) return h.send(c, { type: 'mkNote', text: 'Log in first', kind: 'err' });
        let err = null;
        if (d.type === 'mkState') {
            c.mkWatch = true;
            return h.send(c, state(c));
        }
        if (d.type === 'mkList') err = list(c, d);
        else if (d.type === 'mkBuy') err = buy(c, d.id);
        else if (d.type === 'mkBid') err = bid(c, d.id, d.amount);
        else if (d.type === 'mkCancel') err = cancel(c, d.id);
        else if (d.type === 'mkClaim') err = claim(c);
        if (err) h.send(c, { type: 'mkNote', text: err, kind: 'err' });
    }

    return { handle, state, save: () => save(true), tick };
};
