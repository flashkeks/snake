// Markt (5.2): eigene Welt neben Snake, Arena und Kekemon.
//   🏛️ Auction Hall – Items, Karten, Cosmetics als Sofortkauf oder Auktion
//   🌆 Lobby        – Platz zum Rumlaufen, F bei einem Spieler = Handel,
//                     F an den Staenden = direkt in Arena, Kekemon, Shop …
// Dazu das Handelsfenster (ueberall, sobald ein Handel laeuft) und die
// Einladungen oben rechts. Laeuft nach dem Haupt-Script und kekemon.js und
// nutzt deren Globale ($, wsSend, me, esc, showMsg, showScreen, itemCard,
// itemIcon, COS, HEAD_ICON, kmCat, kmLoadCat, kmCard, arenaCat, sfx).

let mk = null;               // letzter mkState
let mkTab = 'hall';          // hall | lobby
let mkSub = 'browse';        // browse | sell | mine | collect
const mkF = { kind: '', type: '', q: '', sort: 'ending' };
let mkSell = null;           // { ref, label } – was gerade eingestellt wird
let mkSellSrc = 'item';      // item | card | cos
let trState = null;          // laufender Handel
let trInvites = [];          // Anfragen an mich
let trSrc = 'item';          // Quelle im Handelsfenster
let trSort = 'rarity';        // Sortierung im Handelsfenster (26.09.2026, Max)
// Sortierschluessel je Eintrag aus mkMine: Seltenheit, Wert, Level, Anzahl, Name
function trKey(x, how) {
    const a = x.asset;
    if (a.k === 'item') {
        const it = a.item;
        return how === 'rarity' ? tierIdx(it.tier) * 1e12 + (it.score || 0) : how === 'value' ? it.score || 0 : how === 'level' ? it.wxp || 0 : how === 'count' ? 1 : it.name || '';
    }
    if (a.k === 'card') {
        const p = kmParse(a.key), c = kmCat && kmCat.byId[p.id];
        if (how === 'name') return c ? c.name : a.key;
        if (how === 'rarity') return kmCat ? kmRank({ id: p.id, v: p.v }) : 0;
        if (how === 'value') return c ? kmValue(c, p.v) : 0;
        if (how === 'level') return (a.xp || [])[0] || 0;
        return x.max || 1;
    }
    if (how === 'name') return a.name || a.id || '';
    if (how === 'count') return x.max || a.n || 1;
    return a.price || 0;
}

const MK_KIND = { item: '⚔️ Arena items', card: '🃏 Cards', pack: '📦 Packs', case: '🧰 Cases', cos: '🎨 Cosmetics' };
// Arten mit Stueckzahl (6.1: Packs und Cases wie Karten)
const MK_COUNTED = new Set(['card', 'pack', 'case']);

function mkFmt(n) {
    return Math.round(n || 0).toLocaleString('en-US');
}

function mkLeft(ms) {
    if (ms <= 0) return 'ending…';
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
}

// Kleine Meldung oben rechts (Markt, Handel), egal in welcher Welt
function mkToast(text, kind) {
    const box = document.createElement('div');
    box.className = 'mk-toast ' + (kind || 'ok');
    box.textContent = text;
    $('mk-toasts').appendChild(box);
    setTimeout(() => box.classList.add('out'), 4200);
    setTimeout(() => box.remove(), 4800);
}

// ---------- Gut anzeigen (Item, Karte, Cosmetic) ----------

function mkAsset(a, opt = {}) {
    if (a.k === 'item') return itemCard(a.item);
    if (a.k === 'card') {
        if (!kmCat) return `<div class="mk-cos">🃏<b>Card</b></div>`;
        const { id, v } = kmParse(a.key);
        const c = kmCat.byId[id];
        if (!c) return '<div class="mk-cos">❔<b>Unknown card</b></div>';
        // 6.7: Level der Kopie (a.xp = XP-Liste der Kopien)
        const lv = (a.xp || []).length ? kmLvOf(a.xp[0]).lv : 0;
        return `<div class="mk-cardwrap">${kmCard(c, { mini: true, v, count: a.n, lv })}</div>`;
    }
    if (a.k === 'pack' || a.k === 'case') return `<div class="mk-cos mk-box ${a.k}"><span>${a.icon || '❔'}</span><b>${a.n > 1 ? a.n + '× ' : ''}${esc(a.name || a.id)}</b><small>${a.k === 'pack' ? 'Kekémon pack' : 'Arena case'} · unopened</small></div>`;
    const it = COS[a.id];
    if (!it) return `<div class="mk-cos">❔<b>${esc(a.id)}</b></div>`;
    return `<div class="mk-cos" style="--rc:${RAR_COLOR[it.rarity] || '#cfd8e3'}"><span>${it.icon}</span><b>${esc(it.name)}</b><small>${esc(it.cat)} · ${esc(it.rarity || '')}</small></div>`;
}

function mkAssetName(a) {
    if (a.k === 'item') return a.item.name;
    if (a.k === 'card') {
        const c = kmCat && kmCat.byId[kmParse(a.key).id];
        return (a.n > 1 ? a.n + '× ' : '') + (c ? c.name : 'Card') + ((a.xp || []).length ? ` (Lv ${kmLvOf(a.xp[0]).lv})` : '');
    }
    if (a.k === 'pack' || a.k === 'case') return (a.n > 1 ? a.n + '× ' : '') + (a.name || a.id);
    return (COS[a.id] || {}).name || a.id;
}

function mkAssetText(a) {
    if (a.k === 'item') return `${a.item.name} ${a.item.base || ''} ${a.item.tier || ''}`;
    if (a.k === 'card') {
        const c = kmCat && kmCat.byId[kmParse(a.key).id];
        return c ? `${c.name} ${c.from} ${c.rarity}` : '';
    }
    if (a.k === 'pack' || a.k === 'case') return `${a.name || a.id} ${a.k === 'pack' ? 'pack booster' : 'case'}`;
    const it = COS[a.id];
    return it ? `${it.name} ${it.cat} ${it.rarity}` : '';
}

// Meine handelbaren Sachen als Liste von { ref, asset }
function mkMine(src, have) {
    have = have || (mk && mk.have);
    if (!have) return [];
    if (src === 'item') return have.items.map(it => ({ ref: { k: 'item', uid: it.uid }, asset: { k: 'item', item: it } }));
    if (src === 'card') {
        // 6.7: jede gelevelte Kopie einzeln (ref.xp), die ungelevelten zusammen (xp 0)
        const out = [];
        for (const [key, n] of Object.entries(have.cards)) {
            if (!(n > 0)) continue;
            const xs = ((have.cardXp || {})[key] || []).filter(x => x > 0);
            const groups = {};
            for (const x of xs) groups[x] = (groups[x] || 0) + 1;
            for (const [x, m] of Object.entries(groups).sort((a, b) => b[0] - a[0])) out.push({ ref: { k: 'card', key, n: 1, xp: Number(x) }, asset: { k: 'card', key, n: m, xp: Array(m).fill(Number(x)) }, max: m });
            if (n - xs.length > 0) out.push({ ref: { k: 'card', key, n: 1, xp: 0 }, asset: { k: 'card', key, n: n - xs.length }, max: n - xs.length });
        }
        return out
            .sort((a, b) => kmCat ? (kmRank({ id: kmParse(b.ref.key).id, v: kmParse(b.ref.key).v }) - kmRank({ id: kmParse(a.ref.key).id, v: kmParse(a.ref.key).v })) : 0);
    }
    if (src === 'pack' || src === 'case') {
        return (have[src === 'pack' ? 'packs' : 'cases'] || []).map(x => ({ ref: { k: src, id: x.id, n: 1 }, asset: { k: src, ...x }, max: x.n }));
    }
    return have.cos.map(id => ({ ref: { k: 'cos', id }, asset: { k: 'cos', id } }));
}

// ---------- Oeffnen / Schliessen ----------

function mkOpen(tab) {
    unlockAudio();
    if (tab) mkTab = tab;
    showScreen('market');
    if (!me) {
        $('mk-body').innerHTML = '<div class="big-note">🔒 Log in to use the market<br><small>Switch to 🐍 Snake and log in or sign up there.</small></div>';
        return;
    }
    wsSend({ type: 'mkState' });
    wsSend({ type: 'trState' });
    mkDraw();
}

// Welt verlassen: Lobby verlassen, keine Updates mehr
function mkClose() {
    lbStop();
    wsSend({ type: 'mkLeave' });
}

function onMkState(d) {
    mk = { ...d, at: performance.now() };
    const redraw = () => {
        if (!$('market').classList.contains('hidden') && (mkTab === 'hall' || mkTab === 'ana')) {
            // Tippt jemand gerade (Preis, Gebot)? Dann erst nach dem Verlassen des Feldes
            const f = document.activeElement;
            if (f && f.closest && f.closest('#mk-body') && ['INPUT', 'SELECT'].includes(f.tagName) && f.id !== 'mk-q') mkLater = true;
            else mkDraw();
        }
        if (trState && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#tr-window input'))) trDraw();
    };
    if (d.v) kmLoadCat(d.v).then(redraw).catch(redraw);
    redraw();
    mkHead();
}

function mkHead() {
    if (!$('mk-coins')) return;
    $('mk-coins').textContent = me ? mkFmt(me.coins) : '–';
    document.querySelectorAll('#mk-tabs [data-mktab]').forEach(b => b.classList.toggle('on', b.dataset.mktab === mkTab));
}

function mkDraw() {
    return keepScroll('mk', mkTab + '|' + (typeof mkSub !== 'undefined' ? mkSub : ''), $('market'), mkDrawRaw);
}
function mkDrawRaw() {
    mkHead();
    if (mkTab === 'lobby') return lbDraw();
    lbStop();
    const body = $('mk-body');
    if (!mk) {
        body.innerHTML = '<div class="km-note">Loading the market…</div>';
        return;
    }
    if (mkTab === 'ana') { body.innerHTML = anaView(); return; }
    const claims = mk.claims.length;
    const sub = [['browse', '🔎 Browse'], ['sell', '📜 Sell'], ['mine', `🧾 My listings & bids`], ['collect', `📦 Collect${claims ? ` (${claims})` : ''}`]]
        .map(([k, n]) => `<button type="button" class="${mkSub === k ? 'on' : ''}" data-mksub="${k}">${n}</button>`).join('');
    let html = `<div class="cr-diffs mk-sub">${sub}</div>`;
    if (mkSub === 'browse') html += mkBrowse();
    else if (mkSub === 'sell') html += mkSellView();
    else if (mkSub === 'mine') html += mkMineView();
    else html += mkCollect();
    // Suchfeld behaelt Fokus und Cursor
    const q = document.activeElement && document.activeElement.id === 'mk-q' ? document.activeElement.selectionStart : null;
    body.innerHTML = html;
    if (q !== null && $('mk-q')) {
        $('mk-q').focus();
        $('mk-q').setSelectionRange(q, q);
    }
}

// ---------- Analyser (6.12, Max) ----------
// Eigene Sachen auswaehlen und genau ansehen: alle Werte, wie selten genau diese
// Kombination ist (Server rechnet, analyser.js) und wie viele es davon gibt.
let anaSrc = 'item';
let anaSel = null;              // JSON der gewaehlten ref
let anaRes = null;              // Antwort des Servers
let anaInv = null;              // alle Arena-Items (auch ausgeruestete)
// 25.09.2026 (Max): groesser, mit Suche, Filter und Sortierung
let anaQ = '', anaF = 'all', anaSort = 'rare';
const ANA_F = [['all', 'All'], ['weapon', '🔫 Weapons'], ['armor', '🛡️ Armor'], ['util', '💣 Consumables'], ['pack', '🎒 Backpacks'], ['unique', '✦ Uniques'], ['dup', '👯 Duplicates']];
function anaLv(it) { return typeof wLevel === 'function' && (it.kind === 'weapon' || it.kind === 'armor') ? wLevel(it).lv : 0; }
function anaAll() {
    if (anaSrc === 'item') return (anaInv || []).map(it => ({ ref: { k: 'item', uid: it.uid }, asset: { k: 'item', item: it } }));
    return mkMine(anaSrc).map(x => ({ ...x, ref: x.ref.k === 'card' ? { k: 'card', key: x.ref.key, xp: x.ref.xp } : x.ref }));
}
function anaFilterOk(x, f, dupKeys) {
    if (f === 'all') return true;
    if (anaSrc !== 'item') return f === 'dup' ? (x.asset.n || 1) > 1 : true;
    const it = x.asset.item, def = typeof itemDef === 'function' ? itemDef(it) : {};
    if (f === 'unique') return !!def.unique;
    if (f === 'dup') return dupKeys.has(it.base + '|' + it.tier);
    return it.kind === f;
}
function anaList() {
    const all = anaAll(), q = anaQ.trim().toLowerCase();
    const dupKeys = new Set();
    if (anaSrc === 'item') {
        const seen = {};
        for (const x of all) { const k = x.asset.item.base + '|' + x.asset.item.tier; seen[k] = (seen[k] || 0) + 1; if (seen[k] > 1) dupKeys.add(k); }
    }
    const list = all.filter(x => anaFilterOk(x, anaF, dupKeys) && (!q || mkAssetText(x.asset).toLowerCase().includes(q)));
    const it = x => x.asset.item || {};
    const S = {
        rare: (a, b) => (it(b).odds || 1) - (it(a).odds || 1),
        score: (a, b) => (it(b).score || 0) - (it(a).score || 0),
        level: (a, b) => anaLv(it(b)) - anaLv(it(a)) || (it(b).odds || 1) - (it(a).odds || 1),
        name: (a, b) => mkAssetName(a.asset).localeCompare(mkAssetName(b.asset))
    };
    return list.sort(anaSrc === 'item' ? (S[anaSort] || S.rare) : S.name);
}
function anaView() {
    if (anaSrc === 'item' && !anaInv) wsSend({ type: 'mkAnaInv' });
    const srcs = Object.entries(MK_KIND).map(([k, n]) => `<button type="button" class="${anaSrc === k ? 'on' : ''}" data-anasrc="${k}">${n}</button>`).join('');
    const list = anaList(), all = anaAll();
    const pick = list.map((x, i) => `<div class="mk-pick ${anaSel === JSON.stringify(x.ref) ? 'sel' : ''}" data-anapick="${i}">${mkAsset(x.asset)}</div>`).join('');
    const dupKeys = new Set();
    if (anaSrc === 'item') { const seen = {}; for (const x of all) { const k = x.asset.item.base + '|' + x.asset.item.tier; seen[k] = (seen[k] || 0) + 1; if (seen[k] > 1) dupKeys.add(k); } }
    const fl = (anaSrc === 'item' ? ANA_F : [['all', 'All'], ['dup', '👯 More than one']]).map(([k, n]) => {
        const c = all.filter(x => anaFilterOk(x, k, dupKeys)).length;
        return c || k === 'all' ? `<button type="button" class="${anaF === k ? 'on' : ''}" data-anaf="${k}">${n} <small>${c}</small></button>` : '';
    }).join('');
    const sorts = anaSrc === 'item' ? [['rare', 'Rarest'], ['score', 'Score'], ['level', 'Level'], ['name', 'A–Z']].map(([k, n]) => `<button type="button" class="${anaSort === k ? 'on' : ''}" data-anasort="${k}">${n}</button>`).join('') : '';
    const tools = `<div class="ana-tools"><input id="ana-q" placeholder="🔎 Search…" value="${esc(anaQ)}">${sorts ? `<span>Sort</span>${sorts}` : ''}<span class="ana-count">${list.length} of ${all.length}</span></div><div class="ana-filters">${fl}</div>`;
    let res = '<div class="hint">Pick something on the left to analyse it.</div>';
    if (anaSel && anaRes === 'wait') res = '<div class="hint">Analysing…</div>';
    else if (anaSel && anaRes === null) res = '<div class="hint">Nothing to analyse here.</div>';
    else if (anaSel && anaRes) {
        const r = anaRes;
        const row = x => `<tr><td>${esc(x[0])}${x[2] ? `<small>${esc(x[2])}</small>` : ''}</td><td>${esc(x[1])}</td></tr>`;
        res = `<h3><span>${r.icon || '🔬'}</span><span class="tier-${esc(r.tier || '')} it-tier" style="font-size:18px">${esc(r.title)}</span></h3>` +
            (r.odds && r.odds !== null && isFinite(r.odds) ? `<div class="ana-big">1 in ${Number(r.odds).toLocaleString('en-US')}</div><div class="hint">${anaSrc === 'card' ? 'chance per pack in the best pack' : 'chance for exactly this item'}</div>` : '') +
            `<table>${r.lines.map(x => row(x)).join('')}</table>` +
            r.sections.map(s => `<h4>${esc(s.title)}</h4><table>${s.rows.map(row).join('')}${s.total ? `<tr class="total"><td>${esc(s.total[0])}</td><td>${esc(s.total[1])}</td></tr>` : ''}</table>`).join('');
    }
    return `<div class="cr-diffs mk-sub2">${srcs}</div><div class="hint">🔬 Pick anything you own and see exactly how rare it is – down to the effect levels – and how many exist on this server.</div>` +
        `<div class="ana-wrap"><div class="ana-left">${tools}<div class="mk-pickgrid">${pick || '<div class="hint">Nothing matches.</div>'}</div></div><div class="ana-res">${res}</div></div>`;
}
function onMkAna(d) {
    if (JSON.stringify(d.ref) !== anaSel) return;
    anaRes = d.res || null;
    if (mkTab === 'ana') mkDraw();
}

// ---------- Auction Hall ----------

function mkTile(l) {
    const now = mk.now + (performance.now() - mk.at);
    const mine = mk.mineIds.includes(l.id);
    const top = mk.bidIds.includes(l.id);
    let deal = '';
    if (l.type === 'auction') {
        deal += `<div class="mk-bid">${l.bid ? `Bid <b>🪙 ${mkFmt(l.bid)}</b> <small>(${l.bids} · ${esc(l.bidder)})</small>` : `Start <b>🪙 ${mkFmt(l.start)}</b>`}</div>`;
        if (!mine && !top) deal += `<div class="row"><input type="number" min="${l.min}" value="${l.min}" data-bidin="${l.id}"><button type="button" class="gold" data-mkbid="${l.id}">Bid</button></div>`;
        if (top) deal += '<div class="mk-top">✔ You have the highest bid</div>';
    }
    if (l.bin) deal += `<div class="mk-bin">Buy now <b>🪙 ${mkFmt(l.bin)}</b>${mine ? '' : ` <button type="button" class="gold" data-mkbuy="${l.id}">Buy</button>`}</div>`;
    if (mine && !l.bid) deal += `<button type="button" class="ghost" data-mkcancel="${l.id}">Cancel listing</button>`;
    return `<div class="mk-tile ${mine ? 'mine' : ''} ${top ? 'top' : ''}">
        <div class="mk-what">${mkAsset(l.asset)}</div>
        <div class="mk-deal">
            <div class="mk-meta"><span class="mk-type ${l.type}">${l.type === 'bin' ? 'BUY NOW' : 'AUCTION'}</span> <span>⏳ <span data-ends="${l.ends}">${mkLeft(l.ends - now)}</span></span></div>
            <div class="mk-seller">by ${esc(l.seller)}</div>
            ${deal}
        </div>
    </div>`;
}

function mkBrowse() {
    const now = mk.now + (performance.now() - mk.at);
    const q = mkF.q.trim().toLowerCase();
    const price = l => l.type === 'bin' ? l.bin : Math.max(l.bid, l.start || 0);
    let list = mk.listings.filter(l => (!mkF.kind || l.asset.k === mkF.kind) && (!mkF.type || l.type === mkF.type) &&
        (!q || mkAssetText(l.asset).toLowerCase().includes(q) || l.seller.toLowerCase().includes(q)));
    const S = { ending: (a, b) => a.ends - b.ends, newest: (a, b) => b.created - a.created, low: (a, b) => price(a) - price(b), high: (a, b) => price(b) - price(a) };
    list = list.sort(S[mkF.sort] || S.ending);
    const opt = (v, t, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${t}</option>`;
    const bar = `<div class="km-bar">
        <select data-mkf="kind">${opt('', 'Everything', mkF.kind)}${Object.entries(MK_KIND).map(([k, t]) => opt(k, t, mkF.kind)).join('')}</select>
        <select data-mkf="type">${opt('', 'Buy now + auctions', mkF.type)}${opt('bin', 'Buy now only', mkF.type)}${opt('auction', 'Auctions only', mkF.type)}</select>
        <select data-mkf="sort">${opt('ending', 'Ending soon', mkF.sort)}${opt('newest', 'Newest', mkF.sort)}${opt('low', 'Price: low → high', mkF.sort)}${opt('high', 'Price: high → low', mkF.sort)}</select>
        <input id="mk-q" data-mkf="q" placeholder="Search item, card, seller…" value="${esc(mkF.q)}">
    </div>`;
    const sold = mk.sold.length ? `<div class="mk-sold"><b>Recent sales</b> ${mk.sold.slice(0, 8).map(s => `<span>${esc(s.what)} · 🪙 ${mkFmt(s.price)}</span>`).join('')}</div>` : '';
    return bar + `<div class="mk-grid">${list.map(mkTile).join('') || '<div class="km-note">Nothing listed yet – be the first: 📜 Sell</div>'}</div>` + sold +
        `<div class="km-odds">Sales fee ${Math.round(mk.fee * 100)} % (paid by the seller). A bid in the last minute extends the auction to one minute. Outbid? Your coins come back right away.</div>`;
}

function mkSellView() {
    const srcs = Object.entries(MK_KIND).map(([k, n]) => `<button type="button" class="${mkSellSrc === k ? 'on' : ''}" data-mksrc="${k}">${n}</button>`).join('');
    const list = mkMine(mkSellSrc);
    const pick = list.map((x, i) => {
        const sel = mkSell && JSON.stringify(MK_COUNTED.has(mkSell.ref.k) ? { ...mkSell.ref, n: 1 } : mkSell.ref) === JSON.stringify(x.ref);
        return `<div class="mk-pick ${sel ? 'sel' : ''}" data-mkpick="${i}">${mkAsset(x.asset)}</div>`;
    }).join('');
    const note = mkSellSrc === 'item' ? 'Items in your arena loadout are locked – take them off first.'
        : mkSellSrc === 'cos' ? 'Only bought cosmetics can be sold. If you wear it, it comes off.'
        : !list.length ? (mkSellSrc === 'card' ? 'You have no Kekémon cards yet – open packs in 🃏 Kekémon first.' : 'Nothing here yet.') : '';
    let form = '<div class="hint">Pick something above.</div>';
    if (mkSell) {
        const card = MK_COUNTED.has(mkSell.ref.k);
        form = `<div class="mk-form">
            <div><b>Selling:</b> ${esc(mkSell.label)}</div>
            ${card ? `<label>Amount <input type="number" id="mk-n" min="1" max="${mkSell.max}" value="${mkSell.ref.n}"> <small>of ${mkSell.max}</small></label>` : ''}
            <div class="mk-kind"><label><input type="radio" name="mk-kind" value="bin" ${mkSell.kind !== 'auction' ? 'checked' : ''}> 💰 Buy it now</label>
            <label><input type="radio" name="mk-kind" value="auction" ${mkSell.kind === 'auction' ? 'checked' : ''}> 🔨 Auction</label></div>
            ${mkSell.kind === 'auction'
                ? `<label>Starting bid 🪙 <input type="number" id="mk-start" min="1" placeholder="e.g. 1000"></label><label>Buy-it-now 🪙 <input type="number" id="mk-bin" min="0" placeholder="optional"></label>`
                : `<label>Price 🪙 <input type="number" id="mk-bin" min="1" placeholder="e.g. 5000"></label>`}
            <label>Duration <select id="mk-hours">${mk.hours.map(h => `<option value="${h}" ${h === 24 ? 'selected' : ''}>${h} h</option>`).join('')}</select></label>
            <button type="button" class="gold" id="mk-list">📜 List it</button>
            <div class="hint">It leaves your inventory now and comes back if it does not sell. Fee ${Math.round(mk.fee * 100)} % when it sells.</div>
        </div>`;
    }
    return `<div class="cr-diffs mk-sub2">${srcs}</div><div class="mk-pickgrid">${pick || '<div class="hint">Nothing here.</div>'}</div>${note ? `<div class="hint">${note}</div>` : ''}${form}`;
}

function mkMineView() {
    const mine = mk.listings.filter(l => mk.mineIds.includes(l.id));
    const bids = mk.listings.filter(l => mk.bidIds.includes(l.id));
    return `<h4>My listings (${mine.length}/${mk.max})</h4><div class="mk-grid">${mine.map(mkTile).join('') || '<div class="hint">None.</div>'}</div>` +
        `<h4>Auctions where I am the highest bidder</h4><div class="mk-grid">${bids.map(mkTile).join('') || '<div class="hint">None.</div>'}</div>`;
}

function mkCollect() {
    if (!mk.claims.length) return '<div class="km-note">📦 Nothing to collect. Things you buy go straight into your inventory – only when your arena stash is full they wait here.</div>';
    return `<div class="mk-grid">${mk.claims.map(x => `<div class="mk-tile"><div class="mk-what">${mkAsset(x.asset)}</div><div class="mk-deal"><small>${esc(x.why || '')}</small></div></div>`).join('')}</div>
        <button type="button" class="gold" id="mk-claim">📦 Collect everything</button>`;
}

// ---------- Handelsfenster ----------

function onTrade(d) {
    if (d.type === 'trInvite') {
        if (!trInvites.some(i => i.id === d.id)) trInvites.push({ id: d.id, from: d.from, at: Date.now() });
        kmSfx('chime', 3);
        setTimeout(() => { trInvites = trInvites.filter(i => i.id !== d.id); trInvDraw(); }, 60000);
        trInvDraw();
        return;
    }
    if (d.type === 'trState') {
        const first = !trState;
        trState = d;
        if (first) {
            trSrc = 'item';
            wsSend({ type: 'mkState' });
        }
        return trDraw();
    }
    if (d.type === 'trClosed') {
        trState = null;
        trDraw();
        return mkToast(d.why, 'err');
    }
    if (d.type === 'trDone') {
        trState = null;
        trDraw();
        mkToast(`🤝 Trade done! You got ${d.got.length ? d.got.join(', ') : 'no things'}${d.scrap ? ` · ${mkFmt(d.scrap)} scrap` : ''}${d.coins ? ` · ${mkFmt(d.coins)} coins` : ''}`, 'ok');
        return fanfare(true);
    }
    if (d.type === 'trInfo') mkToast(d.text, d.err ? 'err' : 'ok');
}

function trInvDraw() {
    $('tr-invites').innerHTML = trInvites.map(i => `<div class="tr-inv">📨 <b>${esc(i.from)}</b> wants to trade
        <button type="button" class="gold" data-tr="accept" data-id="${i.id}">Accept</button><button type="button" class="ghost" data-tr="decline" data-id="${i.id}">Decline</button></div>`).join('');
}

function trSend(refs, patch = {}) {
    const S = trState.me;
    wsSend({ type: 'trSet', refs, scrap: patch.scrap ?? S.scrap, coins: patch.coins ?? S.coins });
}

function trDraw() {
    return keepScroll('trade', trState ? trState.id + '|' + trSrc : '', $('tr-window'), trDrawRaw);
}
function trDrawRaw() {
    const box = $('tr-window');
    if (!trState) {
        box.hidden = true;
        box.innerHTML = '';
        return;
    }
    const S = trState;
    const side = (s, mine) => `<div class="tr-side ${s.ready ? 'ready' : ''}">
        <h4>${mine ? 'You give' : esc(s.name) + ' gives'} ${s.ready ? '<span class="tr-ok">✔ READY</span>' : ''}</h4>
        <div class="tr-assets">${s.assets.map((a, i) => `<div class="tr-a" ${mine ? `data-trrm="${i}" title="Click to take it back"` : ''}>${mkAsset(a)}</div>`).join('') || '<div class="hint">nothing yet</div>'}</div>
        ${mine ? `<div class="row tr-money"><label>⚙️ <input type="number" id="tr-scrap" min="0" value="${s.scrap}"></label><label>🪙 <input type="number" id="tr-coins" min="0" value="${s.coins}"></label></div>`
            : `<div class="tr-money">⚙️ ${mkFmt(s.scrap)} scrap · 🪙 ${mkFmt(s.coins)} coins</div>`}
    </div>`;
    const offered = S.me.refs;
    const has = r => offered.find(x => x.k === r.k && (r.k === 'item' ? x.uid === r.uid : r.k === 'card' ? x.key === r.key && (x.xp || 0) === (r.xp || 0) : x.id === r.id));
    const srcs = Object.entries(MK_KIND).map(([k, n]) => `<button type="button" class="${trSrc === k ? 'on' : ''}" data-trsrc="${k}">${n}</button>`).join('');
    // Sortiert wird eine Kopie, der Klick behaelt den Index aus mkMine (trPick)
    const list = mkMine(trSrc).map((x, i) => ({ ...x, _i: i }));
    list.sort((p, q) => {
        const a = trKey(p, trSort), b = trKey(q, trSort);
        return typeof a === 'string' ? a.localeCompare(b) : b - a;
    });
    const sorts = [['rarity', 'Rarity'], ['value', 'Value'], ['level', 'Level'], ['count', 'Count'], ['name', 'A–Z']];
    const pick = list.map(x => {
        const i = x._i;
        const o = has(x.ref);
        return `<div class="mk-pick ${o ? 'sel' : ''}" data-trpick="${i}">${mkAsset(x.asset)}${o && MK_COUNTED.has(o.k) ? `<span class="tr-n">${o.n}/${x.max}</span>` : ''}</div>`;
    }).join('');
    box.innerHTML = `<div class="tr-card">
        <div class="tr-head"><b>🤝 Trading with ${esc(S.them.name)}</b>
            <button type="button" class="${S.me.ready ? 'ghost' : 'gold'}" data-tr="ready">${S.me.ready ? '✖ Not ready' : '✔ Ready'}</button>
            <button type="button" class="danger" data-tr="cancel">Cancel</button></div>
        <div class="hint">Both press Ready to swap. Any change takes Ready away again. Items in your arena loadout are locked.</div>
        <div class="tr-sides">${side(S.me, true)}<span class="tr-arrows">⇄</span>${side(S.them, false)}</div>
        <div class="cr-diffs mk-sub2">${srcs}</div>
        <div class="tr-sort">Sort: ${sorts.map(([k, n]) => `<button type="button" class="${trSort === k ? 'on' : ''}" data-trsort="${k}">${n}</button>`).join('')}</div>
        <div class="mk-pickgrid">${pick || '<div class="hint">Nothing here.</div>'}</div>
        <div class="hint">Click to add · cards: every click adds one more · click an offered thing above to take it back.</div>
    </div>`;
    box.hidden = false;
}

function trPick(i) {
    const x = mkMine(trSrc)[i];
    if (!x) return;
    const refs = trState.me.refs.map(r => ({ ...r }));
    const j = refs.findIndex(r => r.k === x.ref.k && (r.k === 'item' ? r.uid === x.ref.uid : r.k === 'card' ? r.key === x.ref.key && (r.xp || 0) === (x.ref.xp || 0) : r.id === x.ref.id));
    if (MK_COUNTED.has(x.ref.k)) {
        if (j < 0) refs.push({ ...x.ref, n: 1 });
        else if (refs[j].n < x.max) refs[j].n++;
        else refs.splice(j, 1);
    } else if (j >= 0) refs.splice(j, 1);
    else refs.push(x.ref);
    trSend(refs);
}

// ---------- Lobby ----------
// Welt 2400 x 1500 (wie lobby.js). Hindernisse kennt nur der Browser.

const LB_W = 2400, LB_H = 1500, LB_SPEED = 240, LB_R = 18;
const LB_FOUNTAIN = { x: 1200, y: 760, r: 120 };
const LB_HALL = { x: 860, y: 40, w: 680, h: 250, door: { x: 1200, y: 300 } };
const LB_STALLS = [
    { x: 180, y: 420, w: 260, h: 130, name: '🃏 Kekémon', color: '#ffb13d', go: () => setWorld('cards') },
    { x: 180, y: 900, w: 260, h: 130, name: '🔫 Arena', color: '#ff5bd6', go: () => setWorld('arena') },
    { x: 1960, y: 420, w: 260, h: 130, name: '🎨 Cosmetics', color: '#7dffb0', go: () => { setWorld('snake'); if ($('shop-btn')) $('shop-btn').click(); } },
    { x: 1960, y: 900, w: 260, h: 130, name: '🎰 Casino', color: '#ffd23f', go: () => { setWorld('snake'); if ($('casino-btn')) $('casino-btn').click(); } }
];
// Baeume, Laternen, Baenke (nur Deko; Baeume blockieren)
const LB_TREES = [[620, 520], [620, 1040], [1780, 520], [1780, 1040], [980, 1180], [1420, 1180], [120, 1300], [2280, 1300], [120, 180], [2280, 180]];
const LB_LAMPS = [[900, 560], [1500, 560], [900, 960], [1500, 960], [560, 760], [1840, 760], [1200, 1340], [700, 320], [1700, 320]];
const LB_BENCHES = [[1040, 1000, 0], [1360, 1000, 0], [1040, 520, 0], [1360, 520, 0]];

let lb = null;               // { me:{x,y,dir}, others: Map, keys:Set, raf, lastSend, t0, fire:[], bubbles: Map, target }

function lbBlocked(x, y) {
    if (x < LB_R || y < LB_R || x > LB_W - LB_R || y > LB_H - LB_R) return true;
    if (Math.hypot(x - LB_FOUNTAIN.x, y - LB_FOUNTAIN.y) < LB_FOUNTAIN.r + LB_R) return true;
    const inRect = r => x > r.x - LB_R && x < r.x + r.w + LB_R && y > r.y - LB_R && y < r.y + r.h + LB_R;
    if (inRect(LB_HALL)) return true;
    if (LB_STALLS.some(inRect)) return true;
    if (LB_TREES.some(([tx, ty]) => Math.hypot(x - tx, y - ty) < 34 + LB_R)) return true;
    return false;
}

function lbDraw() {
    const body = $('mk-body');
    if (!lb) {
        body.innerHTML = `<div class="lb-wrap"><canvas id="lb-canvas"></canvas>
            <div class="lb-hud" id="lb-hud"></div>
            <div class="lb-help">WASD / arrows to walk · <b>F</b> next to a player: trade · <b>F</b> at a stall or the hall: go there · tap to walk on mobile</div>
            <button type="button" class="lb-f" id="lb-f">F</button></div>`;
        lbStart();
    }
}

function lbStart() {
    lb = { me: null, others: new Map(), keys: new Set(), lastSend: 0, t0: performance.now(), fire: [], bubbles: new Map(), target: null, near: null };
    for (let i = 0; i < 70; i++) lb.fire.push({ x: Math.random() * LB_W, y: Math.random() * LB_H, p: Math.random() * 6.28, s: 0.3 + Math.random() * 0.7 });
    wsSend({ type: 'lbJoin' });
    const cv = $('lb-canvas');
    cv.addEventListener('pointerdown', e => {
        if (!lb || !lb.me) return;
        const r = cv.getBoundingClientRect();
        const cam = lbCam(cv);
        lb.target = { x: cam.x + (e.clientX - r.left) * cam.s, y: cam.y + (e.clientY - r.top) * cam.s };
    });
    $('lb-f').onclick = () => lbF();
    const loop = () => {
        if (!lb) return;
        lbStep();
        lbRender();
        lb.raf = requestAnimationFrame(loop);
    };
    lb.raf = requestAnimationFrame(loop);
}

function lbStop() {
    if (!lb) return;
    cancelAnimationFrame(lb.raf);
    lb = null;
    wsSend({ type: 'lbLeave' });
}

function onLbJoined(d) {
    if (!lb) return;
    lb.myId = d.id;
    lb.me = { x: d.x, y: d.y, dir: -Math.PI / 2, moving: false };
}

function onLbState(d) {
    if (!lb) return;
    const seen = new Set();
    for (const [id, name, x, y, dir, moving, color, nc, head, tt, skin] of d.p) {
        seen.add(id);
        if (id === lb.myId) continue;
        const o = lb.others.get(id) || { x, y, dx: x, dy: y };
        Object.assign(o, { id, name, tx: x, ty: y, dir, moving: !!moving, color, nc, head, tt, skin });
        lb.others.set(id, o);
    }
    for (const id of [...lb.others.keys()]) if (!seen.has(id)) lb.others.delete(id);
}

// Chat-Zeilen als Sprechblasen ueber den Koepfen
function lbChat(m) {
    if (!lb || !m.name) return;
    lb.bubbles.set(m.name, { text: String(m.text).slice(0, 80), at: performance.now() });
}

function lbStep() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - (lb.last || now)) / 1000);
    lb.last = now;
    // Andere weich an ihre Zielposition
    for (const o of lb.others.values()) {
        o.x += (o.tx - o.x) * Math.min(1, dt * 10);
        o.y += (o.ty - o.y) * Math.min(1, dt * 10);
    }
    const m = lb.me;
    if (!m) return;
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    let vx = 0, vy = 0;
    if (!typing) {
        if (lb.keys.has('w') || lb.keys.has('arrowup')) vy--;
        if (lb.keys.has('s') || lb.keys.has('arrowdown')) vy++;
        if (lb.keys.has('a') || lb.keys.has('arrowleft')) vx--;
        if (lb.keys.has('d') || lb.keys.has('arrowright')) vx++;
    }
    if (vx || vy) lb.target = null;
    else if (lb.target) {
        const dx = lb.target.x - m.x, dy = lb.target.y - m.y;
        if (Math.hypot(dx, dy) < 6) lb.target = null;
        else { vx = dx; vy = dy; }
    }
    const len = Math.hypot(vx, vy);
    m.moving = len > 0;
    if (len) {
        vx /= len;
        vy /= len;
        m.dir = Math.atan2(vy, vx);
        const step = LB_SPEED * dt;
        // An Hindernissen entlanggleiten
        if (!lbBlocked(m.x + vx * step, m.y)) m.x += vx * step;
        else if (lb.target) lb.target = null;
        if (!lbBlocked(m.x, m.y + vy * step)) m.y += vy * step;
        else if (lb.target) lb.target = null;
    }
    if (now - lb.lastSend > 100) {
        lb.lastSend = now;
        wsSend({ type: 'lbMove', x: Math.round(m.x), y: Math.round(m.y), dir: +m.dir.toFixed(2), moving: m.moving });
    }
    // Was ist in Reichweite fuer F?
    let near = null, best = 90;
    for (const o of lb.others.values()) {
        const dd = Math.hypot(o.x - m.x, o.y - m.y);
        if (dd < best) { best = dd; near = { kind: 'player', o }; }
    }
    if (!near && Math.hypot(LB_HALL.door.x - m.x, LB_HALL.door.y - m.y) < 110) near = { kind: 'hall' };
    if (!near) {
        for (const s of LB_STALLS) {
            const cx = Math.max(s.x, Math.min(s.x + s.w, m.x)), cy = Math.max(s.y, Math.min(s.y + s.h, m.y));
            if (Math.hypot(cx - m.x, cy - m.y) < 60) { near = { kind: 'stall', s }; break; }
        }
    }
    lb.near = near;
    const hud = $('lb-hud');
    if (hud) {
        const txt = !near ? `🌆 ${lb.others.size + 1} in the lobby`
            : near.kind === 'player' ? `<b>F</b> Trade with ${esc(near.o.name)}`
            : near.kind === 'hall' ? '<b>F</b> Enter the Auction Hall' : `<b>F</b> Go to ${esc(near.s.name)}`;
        if (hud.dataset.t !== txt) {
            hud.innerHTML = txt;
            hud.dataset.t = txt;
            hud.classList.toggle('act', !!near);
            $('lb-f').classList.toggle('act', !!near);
        }
    }
}

function lbF() {
    if (!lb || !lb.near) return;
    const n = lb.near;
    if (n.kind === 'player') {
        wsSend({ type: 'trReq', name: n.o.name });
        kmSfx('click');
    } else if (n.kind === 'hall') {
        mkTab = 'hall';
        mkSub = 'browse';
        mkDraw();
    } else n.s.go();
}

// Kamera: folgt mir, Massstab passend zur Leinwand
function lbCam(cv) {
    // Etwa 1600 Weltpixel breit sichtbar, am Handy nicht zu winzig
    const s = Math.max(0.9, Math.min(2.2, 1600 / Math.max(cv.clientWidth, 1)));
    const vw = cv.clientWidth * s, vh = cv.clientHeight * s;
    const m = lb.me || { x: LB_W / 2, y: LB_H / 2 };
    return {
        s, vw, vh,
        x: Math.max(0, Math.min(LB_W - vw, m.x - vw / 2)),
        y: Math.max(0, Math.min(LB_H - vh, m.y - vh / 2))
    };
}

function lbNameColor(nc) {
    const it = nc && COS[nc];
    if (!it || !it.look) return '#ffffff';
    if (it.look.c) return it.look.c;
    const g = it.look.g || ['#fff'];
    return g[Math.floor(performance.now() / 300) % g.length];
}

function lbRender() {
    const cv = $('lb-canvas');
    if (!cv) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
    }
    const g = cv.getContext('2d');
    const cam = lbCam(cv);
    const t = (performance.now() - lb.t0) / 1000;
    g.setTransform(dpr / cam.s, 0, 0, dpr / cam.s, -cam.x * dpr / cam.s, -cam.y * dpr / cam.s);

    // Boden: dunkler Platz mit Kacheln, Wege, Mosaik in der Mitte
    g.fillStyle = '#12101c';
    g.fillRect(0, 0, LB_W, LB_H);
    g.strokeStyle = 'rgba(255,255,255,0.035)';
    g.lineWidth = 2;
    for (let x = 0; x <= LB_W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, LB_H); g.stroke(); }
    for (let y = 0; y <= LB_H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(LB_W, y); g.stroke(); }
    g.fillStyle = 'rgba(255,177,61,0.05)';
    g.fillRect(1120, 300, 160, LB_H - 300);
    g.fillRect(0, 700, LB_W, 120);
    for (let r = 420; r > 140; r -= 40) {
        g.beginPath();
        g.arc(LB_FOUNTAIN.x, LB_FOUNTAIN.y, r, 0, Math.PI * 2);
        g.strokeStyle = r % 80 ? 'rgba(255,91,214,0.07)' : 'rgba(61,165,255,0.07)';
        g.lineWidth = 14;
        g.stroke();
    }
    // Rand: Neon-Linie
    g.strokeStyle = '#ff5bd6';
    g.lineWidth = 6;
    g.shadowColor = '#ff5bd6';
    g.shadowBlur = 20;
    g.strokeRect(6, 6, LB_W - 12, LB_H - 12);
    g.shadowBlur = 0;

    // Auction Hall: Saeulen, Dach, Leuchtschrift
    const hl = LB_HALL;
    g.fillStyle = '#231c38';
    g.fillRect(hl.x, hl.y, hl.w, hl.h);
    g.fillStyle = '#2e2550';
    g.beginPath();
    g.moveTo(hl.x - 30, hl.y + 70);
    g.lineTo(hl.x + hl.w / 2, hl.y - 10);
    g.lineTo(hl.x + hl.w + 30, hl.y + 70);
    g.closePath();
    g.fill();
    g.fillStyle = '#3b3163';
    for (let i = 0; i < 6; i++) g.fillRect(hl.x + 40 + i * (hl.w - 110) / 5, hl.y + 90, 30, hl.h - 100);
    g.fillStyle = '#0d0b16';
    g.fillRect(hl.door.x - 50, hl.y + hl.h - 90, 100, 90);
    g.font = 'bold 44px system-ui, sans-serif';
    g.textAlign = 'center';
    g.shadowColor = '#ffd23f';
    g.shadowBlur = 18 + Math.sin(t * 3) * 6;
    g.fillStyle = '#ffd23f';
    g.fillText('🏛️ AUCTION HALL', hl.x + hl.w / 2, hl.y + 72);
    g.shadowBlur = 0;

    // Brunnen mit Wellen
    const fo = LB_FOUNTAIN;
    g.fillStyle = '#2a2f55';
    g.beginPath(); g.arc(fo.x, fo.y, fo.r, 0, Math.PI * 2); g.fill();
    const wg = g.createRadialGradient(fo.x, fo.y, 10, fo.x, fo.y, fo.r - 12);
    wg.addColorStop(0, '#6fd3ff');
    wg.addColorStop(1, '#1d5fa8');
    g.fillStyle = wg;
    g.beginPath(); g.arc(fo.x, fo.y, fo.r - 14, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 3; i++) {
        const rr = ((t * 30 + i * 30) % 90) + 10;
        g.strokeStyle = `rgba(255,255,255,${0.35 * (1 - rr / 100)})`;
        g.lineWidth = 3;
        g.beginPath(); g.arc(fo.x, fo.y, rr, 0, Math.PI * 2); g.stroke();
    }
    g.font = '46px system-ui, sans-serif';
    g.fillText('🍪', fo.x, fo.y + 16);

    // Staende mit Markise
    for (const s of LB_STALLS) {
        g.fillStyle = '#1e1a2e';
        g.fillRect(s.x, s.y + 30, s.w, s.h - 30);
        for (let i = 0; i < 8; i++) {
            g.fillStyle = i % 2 ? s.color : '#ffffff';
            g.fillRect(s.x + i * s.w / 8, s.y, s.w / 8 + 1, 36);
        }
        g.fillStyle = s.color;
        g.font = 'bold 26px system-ui, sans-serif';
        g.shadowColor = s.color;
        g.shadowBlur = 12;
        g.fillText(s.name, s.x + s.w / 2, s.y + s.h - 26);
        g.shadowBlur = 0;
    }

    // Baenke
    g.fillStyle = '#4a3527';
    for (const [x, y] of LB_BENCHES) g.fillRect(x - 50, y - 10, 100, 20);

    // Laternen mit Lichtkegel
    for (const [x, y] of LB_LAMPS) {
        const lg = g.createRadialGradient(x, y, 4, x, y, 150);
        lg.addColorStop(0, 'rgba(255,210,120,0.28)');
        lg.addColorStop(1, 'rgba(255,210,120,0)');
        g.fillStyle = lg;
        g.beginPath(); g.arc(x, y, 150, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffe7a8';
        g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();
    }

    // Figuren nach y sortiert (wer weiter unten steht, ist vorne)
    const figs = [...lb.others.values()].map(o => ({ ...o, me: false }));
    if (lb.me) figs.push({ ...lb.me, name: me ? me.name : '', color: me && me.color || '#00ff88', nc: me && me.equipped && me.equipped.name, head: me && me.equipped && me.equipped.head, tt: me && me.title ? (achCatalog.find(a => a.id === me.title) || {}).title : null, me: true });
    figs.sort((a, b) => a.y - b.y);
    for (const f of figs) lbFigure(g, f, t);

    // Baeume ueber den Figuren (Kronen)
    for (const [x, y] of LB_TREES) {
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.beginPath(); g.ellipse(x + 8, y + 30, 44, 16, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1f5e3a';
        g.beginPath(); g.arc(x, y, 46, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2d8a52';
        g.beginPath(); g.arc(x - 10, y - 12, 30, 0, Math.PI * 2); g.fill();
    }

    // Gluehwuermchen
    for (const f of lb.fire) {
        f.p += 0.02 * f.s;
        const x = f.x + Math.sin(f.p) * 30, y = f.y + Math.cos(f.p * 0.7) * 20;
        g.fillStyle = `rgba(255,240,150,${0.3 + 0.5 * Math.abs(Math.sin(f.p * 2))})`;
        g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill();
    }

    // Tipp-Ziel
    if (lb.target) {
        g.strokeStyle = 'rgba(255,255,255,0.6)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(lb.target.x, lb.target.y, 10 + Math.sin(t * 8) * 3, 0, Math.PI * 2); g.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
}

function lbFigure(g, f, t) {
    const bob = f.moving ? Math.abs(Math.sin(t * 12 + f.x * 0.01)) * 4 : 0;
    const x = f.x, y = f.y - bob;
    // Schatten
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(f.x, f.y + 16, 16, 6, 0, 0, Math.PI * 2); g.fill();
    // Nah genug fuer F: Ring
    if (!f.me && lb.near && lb.near.kind === 'player' && lb.near.o.id === f.id) {
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 3;
        g.beginPath(); g.arc(f.x, f.y, 28 + Math.sin(t * 6) * 2, 0, Math.PI * 2); g.stroke();
    }
    // Koerper
    g.fillStyle = f.color || '#00ff88';
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, LB_R, 0, Math.PI * 2); g.fill(); g.stroke();
    // Augen in Blickrichtung
    const ex = Math.cos(f.dir), ey = Math.sin(f.dir);
    for (const s of [-1, 1]) {
        const ox = x + ex * 7 - ey * 6 * s, oy = y + ey * 7 + ex * 6 * s;
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(ox, oy, 5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111';
        g.beginPath(); g.arc(ox + ex * 2, oy + ey * 2, 2.4, 0, Math.PI * 2); g.fill();
    }
    // Hut (Cosmetic)
    const hat = f.head && HEAD_ICON[f.head];
    g.textAlign = 'center';
    if (hat) {
        g.font = '24px system-ui, sans-serif';
        g.fillText(hat, x, y - 14);
    }
    // Name, Titel
    g.font = 'bold 16px system-ui, sans-serif';
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(0,0,0,0.75)';
    const ny = y - (hat ? 42 : 28);
    g.strokeText(f.name, x, ny);
    g.fillStyle = lbNameColor(f.nc);
    g.fillText(f.name, x, ny);
    if (f.tt) {
        g.font = 'bold 11px system-ui, sans-serif';
        g.fillStyle = '#ffd23f';
        g.strokeText(f.tt, x, ny - 16);
        g.fillText(f.tt, x, ny - 16);
    }
    // Sprechblase
    const b = lb.bubbles.get(f.name);
    if (b && performance.now() - b.at < 6000) {
        g.font = '15px system-ui, sans-serif';
        const w = Math.min(320, g.measureText(b.text).width + 20);
        const by = ny - (f.tt ? 50 : 34);
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.beginPath();
        g.roundRect(x - w / 2, by - 22, w, 30, 10);
        g.fill();
        g.beginPath(); g.moveTo(x - 6, by + 8); g.lineTo(x + 6, by + 8); g.lineTo(x, by + 16); g.fill();
        g.fillStyle = '#15121c';
        g.fillText(b.text.length > 38 ? b.text.slice(0, 37) + '…' : b.text, x, by - 2);
    }
}

document.addEventListener('keydown', e => {
    if (!lb || $('market').classList.contains('hidden')) return;
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (typing) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        lb.keys.add(k);
        e.preventDefault();
    }
    if (k === 'f') {
        e.preventDefault();
        lbF();
    }
});
document.addEventListener('keyup', e => {
    if (lb) lb.keys.delete(e.key.toLowerCase());
});
window.addEventListener('blur', () => { if (lb) lb.keys.clear(); });

// ---------- Eingaben ----------

$('mk-tabs').onclick = e => {
    const b = e.target.closest('[data-mktab]');
    if (!b) return;
    mkTab = b.dataset.mktab;
    mkDraw();
};
$('mk-back').onclick = () => setWorld('snake');

$('mk-body').addEventListener('click', e => {
    const t = e.target;
    const ds = (t.closest('[data-mksub],[data-mksrc],[data-mkpick],[data-mkbuy],[data-mkbid],[data-mkcancel]') || {}).dataset || {};
    if (ds.mksub) { mkSub = ds.mksub; return mkDraw(); }
    const an = (t.closest('[data-anasrc],[data-anapick]') || {}).dataset || {};
    if (an.anasrc) { anaSrc = an.anasrc; anaSel = null; anaRes = null; anaF = 'all'; if (anaSrc === 'item') anaInv = null; return mkDraw(); }
    const af = (t.closest('[data-anaf],[data-anasort]') || {}).dataset || {};
    if (af.anaf) { anaF = af.anaf; return mkDraw(); }
    if (af.anasort) { anaSort = af.anasort; return mkDraw(); }
    if (an.anapick !== undefined) {
        const x = anaList()[Number(an.anapick)];
        if (!x) return;
        anaSel = JSON.stringify(x.ref);
        anaRes = 'wait';
        wsSend({ type: 'mkAna', ref: x.ref });
        return mkDraw();
    }
    if (ds.mksrc) { mkSellSrc = ds.mksrc; mkSell = null; return mkDraw(); }
    if (ds.mkpick !== undefined) {
        const x = mkMine(mkSellSrc)[Number(ds.mkpick)];
        if (x) mkSell = { ref: { ...x.ref }, label: mkAssetName(x.asset), max: x.max || 1, kind: mkSell ? mkSell.kind : 'bin' };
        return mkDraw();
    }
    if (ds.mkbuy) {
        const l = mk.listings.find(x => x.id === Number(ds.mkbuy));
        if (l) uiConfirm(`Buy ${mkAssetName(l.asset)} for ${mkFmt(l.bin)} coins?`, { title: 'Buy now', ok: 'Buy' }).then(ok => ok && wsSend({ type: 'mkBuy', id: l.id }));
        return;
    }
    if (ds.mkbid) {
        const inp = document.querySelector(`[data-bidin="${ds.mkbid}"]`);
        const n = Math.floor(Number(inp && inp.value) || 0);
        const l = mk.listings.find(x => x.id === Number(ds.mkbid));
        if (l && n) uiConfirm(`Bid ${mkFmt(n)} coins on ${mkAssetName(l.asset)}? The coins are taken now and come back if someone outbids you.`, { title: 'Place bid', ok: 'Bid' }).then(ok => ok && wsSend({ type: 'mkBid', id: l.id, amount: n }));
        return;
    }
    if (ds.mkcancel) return wsSend({ type: 'mkCancel', id: Number(ds.mkcancel) });
    if (t.id === 'mk-claim') return wsSend({ type: 'mkClaim' });
    if (t.id === 'mk-list' && mkSell) {
        const num = id => Number(($(id) || {}).value) || 0;
        const ref = { ...mkSell.ref };
        if (MK_COUNTED.has(ref.k)) ref.n = Math.max(1, Math.min(mkSell.max, Math.floor(num('mk-n')) || 1));
        const kind = mkSell.kind === 'auction' ? 'auction' : 'bin';
        const msg = { type: 'mkList', ref, kind, bin: num('mk-bin'), start: num('mk-start'), hours: num('mk-hours') };
        if (kind === 'bin' && msg.bin < 1) return showMsg('mk-msg', 'Set a price', 'err');
        if (kind === 'auction' && msg.start < 1) return showMsg('mk-msg', 'Set a starting bid', 'err');
        wsSend(msg);
        mkSell = null;
        mkSub = 'mine';
    }
});

let mkLater = false;
$('mk-body').addEventListener('focusout', () => {
    setTimeout(() => {
        const f = document.activeElement;
        if (mkLater && !(f && f.closest && f.closest('#mk-body') && ['INPUT', 'SELECT'].includes(f.tagName))) {
            mkLater = false;
            mkDraw();
        }
    }, 50);
});

$('mk-body').addEventListener('change', e => {
    if (e.target.name === 'mk-kind' && mkSell) {
        mkSell.kind = e.target.value;
        mkDraw();
    }
});

$('mk-body').addEventListener('input', e => {
    const f = e.target.dataset && e.target.dataset.mkf;
    if (!f) return;
    mkF[f] = e.target.value;
    mkDraw();
});

// Handel: Fenster und Einladungen liegen am Body, also ueberall klickbar
document.addEventListener('click', e => {
    const b = e.target.closest('[data-tr],[data-trsrc],[data-trsort],[data-trpick],[data-trrm]');
    if (!b || !b.closest('#tr-window, #tr-invites')) return;
    const ds = b.dataset;
    if (ds.tr === 'accept') {
        trInvites = trInvites.filter(i => i.id !== Number(ds.id));
        trInvDraw();
        wsSend({ type: 'trAccept', id: Number(ds.id) });
    } else if (ds.tr === 'decline') {
        trInvites = trInvites.filter(i => i.id !== Number(ds.id));
        trInvDraw();
        wsSend({ type: 'trDecline', id: Number(ds.id) });
    } else if (ds.tr === 'ready') wsSend({ type: 'trReady', on: !trState.me.ready });
    else if (ds.tr === 'cancel') wsSend({ type: 'trCancel' });
    else if (ds.trsrc) { trSrc = ds.trsrc; trDraw(); }
    else if (ds.trsort) { trSort = ds.trsort; trDraw(); }
    else if (ds.trpick !== undefined) trPick(Number(ds.trpick));
    else if (ds.trrm !== undefined) {
        const refs = trState.me.refs.filter((r, i) => i !== Number(ds.trrm));
        trSend(refs);
    }
});
document.addEventListener('change', e => {
    if (!trState || !e.target.closest('#tr-window')) return;
    if (e.target.id === 'tr-scrap' || e.target.id === 'tr-coins') {
        trSend(trState.me.refs, { scrap: Number(($('tr-scrap') || {}).value) || 0, coins: Number(($('tr-coins') || {}).value) || 0 });
    }
});

// Countdowns im Auktionshaus weiterlaufen lassen (nur der Text, kein Neuzeichnen)
setInterval(() => {
    if (!mk || $('market').classList.contains('hidden')) return;
    const now = mk.now + (performance.now() - mk.at);
    document.querySelectorAll('#mk-body [data-ends]').forEach(el => { el.textContent = mkLeft(Number(el.dataset.ends) - now); });
}, 1000);

$('mk-menu-open') && ($('mk-menu-open').onclick = () => setWorld('market'));

// Analyser-Suche (25.09.2026): tippen ohne Fokusverlust
document.addEventListener('input', e => {
    if (e.target.id !== 'ana-q') return;
    anaQ = e.target.value;
    const pos = e.target.selectionStart;
    mkDraw();
    const n = document.getElementById('ana-q');
    if (n) { n.focus(); n.setSelectionRange(pos, pos); }
});
