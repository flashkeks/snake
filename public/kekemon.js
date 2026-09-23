// Kekemon (5.0): Sammelkarten. Laeuft nach dem Haupt-Script und nutzt dessen
// Globale ($, wsSend, me, esc, showMsg, showScreen, sfx, unlockAudio).
//
// Der Katalog (~2000 Karten) kommt einmal per HTTP (/cards.json?v=HASH, gzip,
// vom Browser gecacht); die Sammlung ({id: Anzahl}) per Socket ('kmState').

let km = null;               // letzter kmState vom Server
let kmCat = null;            // Katalog: { types, rarities, sets, packs, effects, cards: [..], byId }
let kmCatLoading = null;
let kmTab = 'packs';
let kmShown = 60;            // Album: so viele Karten gerade sichtbar
const kmFilter = { set: '', type: '', rarity: '', own: '', q: '', sort: 'num' };
let kmOpening = null;        // offenes Pack { cards, fresh, up: Set }

// Klang nie das Oeffnen blockieren lassen
function kmSfx(name, ...a) {
    try {
        if (sfx[name]) sfx[name](...a);
    } catch {}
}

const KM_PACK_COLOR = { anime: '#ff7ac8', film: '#3da5ff', mixed: '#ffb13d' };

function kmLoadCat(v) {
    if (kmCat && kmCat.v === v) return Promise.resolve(kmCat);
    if (kmCatLoading) return kmCatLoading;
    kmCatLoading = fetch('/cards.json?v=' + encodeURIComponent(v)).then(r => r.json()).then(d => {
        const cards = d.cards.map(a => ({
            id: a[0], set: a[1], num: a[2], name: a[3], img: a[4], from: a[5], type: a[6], rarity: a[7],
            hp: a[8], atk: a[9], def: a[10], spd: a[11], weak: d.types[a[6]].weak, attacks: a[12].map(x => ({ name: x[0], cost: x[1], dmg: x[2], effect: x[3] }))
        }));
        const ridx = Object.fromEntries(d.rarities.map((r, i) => [r.id, i]));
        kmCat = { ...d, v, cards, ridx, byId: Object.fromEntries(cards.map(c => [c.id, c])) };
        kmCatLoading = null;
        return kmCat;
    }).catch(e => {
        kmCatLoading = null;
        throw e;
    });
    return kmCatLoading;
}

function kmOpen(tab) {
    unlockAudio();
    if (tab) kmTab = tab;
    if (world !== 'cards') {
        world = 'cards';
        document.body.classList.remove('world-arena');
        document.body.classList.add('world-cards');
        document.querySelectorAll('#world-switch [data-world]').forEach(b => b.classList.toggle('on', b.dataset.world === 'cards'));
    }
    showScreen('kekemon');
    if (!me) {
        $('km-body').innerHTML = '<div class="big-note">🔒 Log in to collect cards<br><small>Switch to 🐍 Snake and log in or sign up there.</small></div>';
        return;
    }
    kmDraw();
    wsSend({ type: 'kmState' });
}

function onKmState(d) {
    km = d;
    kmLoadCat(d.v).then(() => {
        if (d.opened) kmShowPack(d.opened);
        if (d.sold) showMsg('km-msg', `Sold ${d.sold.n} duplicate${d.sold.n === 1 ? '' : 's'} for 🪙 ${d.sold.coins.toLocaleString('en-US')}`, 'ok');
        if (!$('kekemon').classList.contains('hidden')) kmDraw();
        const v = $('km-view');
        if (v && !v.hidden && v.dataset.id) kmView(v.dataset.id);
    }).catch(() => showMsg('km-msg', 'Could not load the card list', 'err'));
}

function kmOwned() {
    const have = (km && km.have) || {};
    return kmCat ? kmCat.cards.filter(c => have[c.id] > 0).length : 0;
}

function kmHead() {
    $('km-coins').textContent = me ? me.coins.toLocaleString('en-US') : '–';
    $('km-count').textContent = kmCat ? `${kmOwned()} / ${kmCat.cards.length}` : '–';
    document.querySelectorAll('#km-tabs [data-kmtab]').forEach(b => b.classList.toggle('on', b.dataset.kmtab === kmTab));
}

// ---------- Karte zeichnen ----------

function kmCost(n, type) {
    return kmCat.types[type].icon.repeat(n);
}

function kmCard(c, opt = {}) {
    const T = kmCat.types[c.type];
    const R = kmCat.rarities[kmCat.ridx[c.rarity]];
    const holo = kmCat.ridx[c.rarity] >= 3 && !opt.missing;
    const cls = ['kc', 'r-' + c.rarity, opt.mini ? 'mini' : '', opt.missing ? 'missing' : '', holo ? 'holo' : ''].filter(Boolean).join(' ');
    const set = kmCat.sets[c.set];
    const atk = c.attacks.map(a => `<div class="kc-atk"><span class="cost">${kmCost(a.cost, c.type)}</span><span class="an">${esc(a.name)}</span><span class="dmg">${a.dmg}</span>${a.effect !== 'none' ? `<span class="fx">${esc(kmCat.effects[a.effect])}</span>` : ''}</div>`).join('');
    const W = kmCat.types[c.weak];
    return `<div class="${cls}" style="--tc:${T.color}" data-kmcard="${esc(c.id)}">
        ${opt.count > 1 ? `<span class="kc-count">×${opt.count}</span>` : ''}
        <div class="kc-inner">
            <div class="kc-top"><span class="kc-name">${opt.missing ? '???' : esc(c.name)}</span><span class="kc-hp"><small>HP</small>${c.hp} ${T.icon}</span></div>
            <div class="kc-art"><span class="ph">${T.icon}</span><img src="${esc(c.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"></div>
            <div class="kc-from">${opt.missing ? set.icon + ' ' + esc(set.name) : esc(c.from)}</div>
            ${atk}
            <div class="kc-stats"><span>⚔️ ${c.atk}</span><span>🛡️ ${c.def}</span><span>💨 ${c.spd}</span></div>
            <div class="kc-foot"><span>weak ${W.icon}×1.5</span><span>${esc(c.num)}</span><span class="kc-gem" style="color:${R.color}">${esc(R.name)}</span></div>
        </div>
    </div>`;
}

// Holo folgt der Maus
document.addEventListener('pointermove', e => {
    const el = e.target.closest && e.target.closest('.kc.holo');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
});

// ---------- Tabs ----------

function kmDraw() {
    kmHead();
    const body = $('km-body');
    if (!kmCat) {
        body.innerHTML = '<div class="km-note">Loading cards…</div>';
        return;
    }
    if (kmTab === 'packs') body.innerHTML = kmDrawPacks();
    else if (kmTab === 'album') body.innerHTML = kmDrawAlbum();
    else body.innerHTML = `<div class="km-note">${kmTab === 'battle'
        ? '⚔️ <b>Battles are coming in 5.1</b><br>Build a team of three cards and fight AI gyms for coins and packs.'
        : '🤝 <b>PvP duels and card trading are coming in 5.2</b>'}</div>`;
}

function kmDrawPacks() {
    const P = kmCat.packs;
    const tiles = Object.entries(P).map(([id, p]) => {
        const sets = p.sets.map(s => kmCat.sets[s].icon + ' ' + kmCat.sets[s].name).join(' · ');
        const poor = !me || me.coins < p.price;
        return `<div class="km-pack" style="--pc:${KM_PACK_COLOR[id] || '#ffb13d'}">
            <div class="ico">${p.icon}</div>
            <h4>${esc(p.name)}</h4>
            <div class="sub">${p.size} cards · ${sets}${p.better ? '<br><b>Better odds for Rare and up</b>' : ''}</div>
            <button type="button" class="gold" data-kmbuy="${id}" ${poor ? 'disabled' : ''}>Open for 🪙 ${p.price.toLocaleString('en-US')}</button>
        </div>`;
    }).join('');
    const sell = km && km.sell ? kmCat.rarities.map(r => `<b style="color:${r.color}">${r.name}</b> ${km.sell[r.id].toLocaleString('en-US')}`).join(' · ') : '';
    return `<div class="km-packs">${tiles}</div>
        <div class="km-odds">Every pack: the last card is <b>Rare or better</b>. Holo shine from <b>Epic</b> up.<br>
        Duplicates sell for coins (tap a card in your collection): ${sell}</div>
        <div class="km-odds">Card data: <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a> · <a href="https://akabab.github.io/superhero-api/" target="_blank" rel="noopener">Superhero API</a> · <a href="https://www.tvmaze.com" target="_blank" rel="noopener">TVMaze</a></div>`;
}

function kmList() {
    const have = (km && km.have) || {};
    const q = kmFilter.q.trim().toLowerCase();
    let list = kmCat.cards.filter(c =>
        (!kmFilter.set || c.set === kmFilter.set) &&
        (!kmFilter.type || c.type === kmFilter.type) &&
        (!kmFilter.rarity || c.rarity === kmFilter.rarity) &&
        (!kmFilter.own || (kmFilter.own === 'have' ? have[c.id] > 0 : kmFilter.own === 'missing' ? !have[c.id] : have[c.id] > 1)) &&
        // Namen fehlender Karten nicht per Suche verraten, die Herkunft schon
        (!q || c.from.toLowerCase().includes(q) || (have[c.id] > 0 && c.name.toLowerCase().includes(q))));
    if (kmFilter.sort === 'rarity') list = list.slice().sort((a, b) => kmCat.ridx[b.rarity] - kmCat.ridx[a.rarity]);
    else if (kmFilter.sort === 'name') list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    else if (kmFilter.sort === 'hp') list = list.slice().sort((a, b) => b.hp - a.hp);
    return list;
}

function kmDrawAlbum() {
    const have = (km && km.have) || {};
    const opt = (v, t, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${t}</option>`;
    const bar = `<div class="km-bar">
        <select data-kmf="set">${opt('', 'All sets', kmFilter.set)}${Object.entries(kmCat.sets).map(([k, s]) => opt(k, s.icon + ' ' + s.name, kmFilter.set)).join('')}</select>
        <select data-kmf="type">${opt('', 'All types', kmFilter.type)}${Object.entries(kmCat.types).map(([k, t]) => opt(k, t.icon + ' ' + t.name, kmFilter.type)).join('')}</select>
        <select data-kmf="rarity">${opt('', 'All rarities', kmFilter.rarity)}${kmCat.rarities.map(r => opt(r.id, r.name, kmFilter.rarity)).join('')}</select>
        <select data-kmf="own">${opt('', 'Owned + missing', kmFilter.own)}${opt('have', 'Owned', kmFilter.own)}${opt('missing', 'Missing', kmFilter.own)}${opt('dupes', 'Duplicates', kmFilter.own)}</select>
        <select data-kmf="sort">${opt('num', 'Sort: number', kmFilter.sort)}${opt('rarity', 'Sort: rarity', kmFilter.sort)}${opt('hp', 'Sort: HP', kmFilter.sort)}${opt('name', 'Sort: name', kmFilter.sort)}</select>
        <input data-kmf="q" placeholder="Search name or series…" value="${esc(kmFilter.q)}">
        <button type="button" id="km-selldupes">💰 Sell duplicates</button>
    </div>`;
    const prog = Object.entries(kmCat.sets).map(([k, s]) => {
        const all = kmCat.cards.filter(c => c.set === k);
        const n = all.filter(c => have[c.id] > 0).length;
        return `<div>${s.icon} ${esc(s.name)} <b style="float:right">${n} / ${all.length}</b><div class="bar"><i style="width:${(n / Math.max(1, all.length) * 100).toFixed(1)}%"></i></div></div>`;
    }).join('');
    const list = kmList();
    const grid = list.slice(0, kmShown).map(c => kmCard(c, { mini: true, missing: !have[c.id], count: have[c.id] || 0 })).join('');
    return `<div class="km-prog">${prog}</div>${bar}
        <div class="km-grid">${grid || '<div class="km-note" style="grid-column:1/-1">No cards match.</div>'}</div>
        ${list.length > kmShown ? `<button type="button" class="km-more" id="km-more">Show more (${(list.length - kmShown).toLocaleString('en-US')} left)</button>` : ''}`;
}

// Nur das Raster neu (Suchfeld behaelt den Fokus)
function kmRegrid() {
    const tmp = document.createElement('div');
    tmp.innerHTML = kmDrawAlbum();
    const body = $('km-body');
    body.querySelector('.km-grid').replaceWith(tmp.querySelector('.km-grid'));
    const old = body.querySelector('#km-more'), neu = tmp.querySelector('#km-more');
    if (old) old.remove();
    if (neu) body.appendChild(neu);
}

// ---------- Grosse Ansicht ----------

function kmView(id) {
    const c = kmCat.byId[id];
    if (!c) return;
    const have = (km && km.have) || {};
    const n = have[id] || 0;
    const v = $('km-view');
    v.dataset.id = id;
    const T = kmCat.types[c.type], R = kmCat.rarities[kmCat.ridx[c.rarity]];
    const val = km && km.sell ? km.sell[c.rarity] : 0;
    v.innerHTML = kmCard(c, { missing: !n }) + `<div class="km-info">
        <h3>${n ? esc(c.name) : '???'}</h3>
        <div>${n ? esc(c.from) + '<br>' : ''}${kmCat.sets[c.set].icon} ${esc(kmCat.sets[c.set].name)} · ${esc(c.num)}</div>
        <div>${T.icon} ${esc(T.name)} · <b style="color:${R.color}">${esc(R.name)}</b> · weak to ${kmCat.types[c.weak].icon} ${esc(kmCat.types[c.weak].name)}</div>
        <div style="margin-top:6px">${n ? `You own <b>${n}</b>` : 'You do not own this card yet'}</div>
        ${n > 1 ? `<button type="button" data-kmsell="${esc(id)}" data-n="1">Sell 1 for 🪙 ${val.toLocaleString('en-US')}</button>` : ''}
        ${n > 2 ? `<button type="button" data-kmsell="${esc(id)}" data-n="${n - 1}">Sell ${n - 1} (keep 1) for 🪙 ${((n - 1) * val).toLocaleString('en-US')}</button>` : ''}
        <button type="button" id="km-view-close">Close</button>
    </div>`;
    v.hidden = false;
}

// ---------- Pack oeffnen ----------

function kmShowPack(o) {
    const p = kmCat.packs[o.pack];
    kmOpening = { ...o, up: new Set() };
    const box = $('km-open');
    box.innerHTML = `<div class="km-open-pack" id="km-rip" title="Open">${p.icon}</div><div class="km-note" style="padding:0">Tap the pack to open</div>`;
    box.hidden = false;
    kmSfx('charge');
}

function kmDeal() {
    const o = kmOpening;
    const box = $('km-open');
    const row = o.cards.map((id, i) => {
        const c = kmCat.byId[id];
        return `<div class="km-flip" data-i="${i}" data-r="${c.rarity}" style="animation-delay:${i * 90}ms">
            <div class="km-flip-in"><div class="km-back"></div>${kmCard(c)}${o.fresh[i] ? '<span class="km-new">NEW</span>' : ''}</div></div>`;
    }).join('');
    box.innerHTML = `<div class="km-open-row">${row}</div>
        <div class="km-open-btns"><button type="button" id="km-flipall">Reveal all</button>
        <button type="button" class="gold" id="km-again">Open another (🪙 ${kmCat.packs[o.pack].price.toLocaleString('en-US')})</button>
        <button type="button" id="km-done">Done</button></div>`;
}

function kmFlip(el) {
    const o = kmOpening;
    const i = Number(el.dataset.i);
    if (!o || o.up.has(i)) return;
    o.up.add(i);
    el.classList.add('up');
    const r = kmCat.ridx[el.dataset.r];
    if (r >= 4) kmSfx('fanfare', r >= 5 ? 'bonus' : 'big');
    else if (r >= 3) kmSfx('win', 3);
    else kmSfx('click');
}

function kmCloseOpen() {
    $('km-open').hidden = true;
    $('km-open').innerHTML = '';
    kmOpening = null;
}

// ---------- Eingaben ----------

$('km-tabs').onclick = e => {
    const b = e.target.closest('[data-kmtab]');
    if (!b || b.disabled) return;
    kmTab = b.dataset.kmtab;
    kmShown = 60;
    kmDraw();
};

$('km-back').onclick = () => setWorld('snake');

$('km-body').addEventListener('click', e => {
    const buy = e.target.closest('[data-kmbuy]');
    if (buy) return wsSend({ type: 'kmBuy', pack: buy.dataset.kmbuy });
    const card = e.target.closest('[data-kmcard]');
    if (card) return kmView(card.dataset.kmcard);
    if (e.target.id === 'km-more') {
        kmShown += 120;
        return kmRegrid();
    }
    if (e.target.id === 'km-selldupes') {
        const have = (km && km.have) || {};
        let n = 0, coins = 0, rare = 0;
        for (const [id, k] of Object.entries(have)) {
            const c = kmCat.byId[id];
            if (!c || k < 2) continue;
            n += k - 1;
            coins += (k - 1) * km.sell[c.rarity];
            if (kmCat.ridx[c.rarity] >= 2) rare += k - 1;
        }
        if (!n) return showMsg('km-msg', 'No duplicates to sell', 'err');
        if (confirm(`Sell ${n} duplicate card${n === 1 ? '' : 's'} for ${coins.toLocaleString('en-US')} coins?\nYou keep one of each.${rare ? `\n${rare} of them are Rare or better.` : ''}`)) wsSend({ type: 'kmSellDupes' });
    }
});

$('km-body').addEventListener('input', e => {
    const f = e.target.dataset && e.target.dataset.kmf;
    if (!f) return;
    kmFilter[f] = e.target.value;
    kmShown = 60;
    kmRegrid();
});

$('km-view').addEventListener('click', e => {
    const s = e.target.closest('[data-kmsell]');
    if (s) return wsSend({ type: 'kmSell', id: s.dataset.kmsell, n: Number(s.dataset.n) });
    if (e.target.id === 'km-view-close' || e.target === $('km-view')) {
        $('km-view').hidden = true;
        $('km-view').dataset.id = '';
    }
});

$('km-open').addEventListener('click', e => {
    if (e.target.id === 'km-rip') {
        e.target.classList.add('burst');
        kmSfx('fanfare', 'small');
        return setTimeout(kmDeal, 420);
    }
    const f = e.target.closest('.km-flip');
    if (f) return kmFlip(f);
    if (e.target.id === 'km-flipall') {
        const all = [...document.querySelectorAll('#km-open .km-flip:not(.up)')];
        all.forEach((el, i) => setTimeout(() => kmFlip(el), i * 160));
        return;
    }
    if (e.target.id === 'km-again') {
        const pack = kmOpening.pack;
        kmCloseOpen();
        return wsSend({ type: 'kmBuy', pack });
    }
    if (e.target.id === 'km-done') kmCloseOpen();
});

document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('km-view').hidden) $('km-view').hidden = true;
});

$('km-menu-open').onclick = () => setWorld('cards');
