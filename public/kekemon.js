// Kekemon (5.0, Umbau 5.1a): Sammelkarten. Laeuft nach dem Haupt-Script und
// nutzt dessen Globale ($, wsSend, me, esc, showMsg, showScreen, sfx, unlockAudio).
//
// Der Katalog (~2000 Karten) kommt einmal per HTTP (/cards.json?v=HASH, gzip,
// vom Browser gecacht); die Sammlung per Socket ('kmState'):
//   have = { Schluessel: Anzahl }, Schluessel = Id oder Id~Variante
//   Variante: 'p' Pokeball, 'm' Masterball, dazu 's' Shiny (z. B. 'ms')

let km = null;               // letzter kmState vom Server
let kmCat = null;            // Katalog: { types, rarities, sets, packs, effects, odds, variants, cards, byId }
let kmCatLoading = null;
let kmTab = 'packs';
let kmShown = 60;            // Album: so viele Karten gerade sichtbar
const kmFilter = { set: '', type: '', rarity: '', own: '', q: '', sort: 'num' };
let kmOpening = null;        // offenes Pack { pack, cards: [{id, v}], fresh, order, idx }

const KM_PACK_COLOR = { anime: '#ff7ac8', film: '#3da5ff', mixed: '#ffb13d' };
const KM_VLABEL = { p: 'Pokéball', m: 'Masterball', s: 'Shiny' };

// Klang nie das Oeffnen blockieren lassen
function kmSfx(name, ...a) {
    try {
        if (sfx[name]) sfx[name](...a);
    } catch {}
}

const kmKeyOf = (id, v) => v ? id + '~' + v : id;
function kmParse(k) {
    const i = k.indexOf('~');
    return i < 0 ? { id: k, v: '' } : { id: k.slice(0, i), v: k.slice(i + 1) };
}

// Rang einer Variante (fuer "beste zuerst"): Masterball > Pokeball, Shiny zaehlt am meisten
const kmVRank = v => (v.includes('s') ? 4 : 0) + (v.includes('m') ? 2 : v.includes('p') ? 1 : 0);

function kmValue(c, v) {
    let n = kmCat.sell[c.rarity];
    for (const ch of v || '') n *= kmCat.sellMul[ch] || 1;
    return n;
}

// Sammlung je Karte: { total, vars: {v: n}, best }
function kmOwn() {
    const out = {};
    for (const [k, n] of Object.entries((km && km.have) || {})) {
        if (!(n > 0)) continue;
        const { id, v } = kmParse(k);
        const o = out[id] = out[id] || { total: 0, vars: {}, best: '' };
        o.total += n;
        o.vars[v] = (o.vars[v] || 0) + n;
        if (kmVRank(v) > kmVRank(o.best)) o.best = v;
    }
    return out;
}

function kmLoadCat(v) {
    if (kmCat && kmCat.v === v) return Promise.resolve(kmCat);
    if (kmCatLoading) return kmCatLoading;
    kmCatLoading = fetch('/cards.json?v=' + encodeURIComponent(v)).then(r => r.json()).then(d => {
        const cards = d.cards.map(a => ({
            id: a[0], set: a[1], num: a[2], name: a[3], img: a[4], from: a[5], type: a[6], rarity: a[7],
            hp: a[8], atk: a[9], def: a[10], spd: a[11], weak: d.types[a[6]].weak,
            attacks: a[12].map(x => ({ name: x[0], cost: x[1], dmg: x[2], effect: x[3] }))
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
        if (d.sold) showMsg('km-msg', `Sold ${d.sold.n} card${d.sold.n === 1 ? '' : 's'} for 🪙 ${d.sold.coins.toLocaleString('en-US')}`, 'ok');
        if (!$('kekemon').classList.contains('hidden')) kmDraw();
        const v = $('km-view');
        if (v && !v.hidden && v.dataset.id) kmView(v.dataset.id);
    }).catch(() => showMsg('km-msg', 'Could not load the card list', 'err'));
}

function kmHead() {
    $('km-coins').textContent = me ? me.coins.toLocaleString('en-US') : '–';
    $('km-count').textContent = kmCat ? `${Object.keys(kmOwn()).filter(id => kmCat.byId[id]).length} / ${kmCat.cards.length}` : '–';
    document.querySelectorAll('#km-tabs [data-kmtab]').forEach(b => b.classList.toggle('on', b.dataset.kmtab === kmTab));
}

// ---------- Karte zeichnen ----------

function kmCost(n, type) {
    return kmCat.types[type].icon.repeat(n);
}

// Kleine Baelle als SVG (Pokeball rot, Masterball lila mit M)
function kmBall(kind) {
    const top = kind === 'm' ? '#7b3fe4' : '#e3263b';
    const m = kind === 'm' ? '<text x="12" y="9.5" font-size="6" font-weight="900" text-anchor="middle" fill="#fff">M</text><circle cx="6.5" cy="7" r="1.6" fill="#ff5bd6"/><circle cx="17.5" cy="7" r="1.6" fill="#ff5bd6"/>' : '';
    return `<svg class="kc-ball" viewBox="0 0 24 24" aria-label="${KM_VLABEL[kind]}"><circle cx="12" cy="12" r="11" fill="#fff" stroke="#15121c" stroke-width="1.6"/>` +
        `<path d="M1 12a11 11 0 0 1 22 0z" fill="${top}" stroke="#15121c" stroke-width="1.6"/>${m}` +
        `<rect x="1" y="11" width="22" height="2" fill="#15121c"/><circle cx="12" cy="12" r="3.4" fill="#fff" stroke="#15121c" stroke-width="1.6"/></svg>`;
}

function kmCard(c, opt = {}) {
    const T = kmCat.types[c.type];
    const R = kmCat.rarities[kmCat.ridx[c.rarity]];
    const v = opt.missing ? '' : (opt.v || '');
    const holo = kmCat.ridx[c.rarity] >= 3 && !opt.missing;
    const ball = v.includes('m') ? 'm' : v.includes('p') ? 'p' : '';
    const cls = ['kc', 'r-' + c.rarity, opt.mini ? 'mini' : '', opt.missing ? 'missing' : '', holo ? 'holo' : '',
        ball ? 'ball-' + ball : '', v.includes('s') ? 'shiny' : ''].filter(Boolean).join(' ');
    const set = kmCat.sets[c.set];
    const atk = c.attacks.map(a => `<div class="kc-atk"><span class="cost">${kmCost(a.cost, c.type)}</span><span class="an">${esc(a.name)}</span><span class="dmg">${a.dmg}</span>${a.effect !== 'none' ? `<span class="fx">${esc(kmCat.effects[a.effect])}</span>` : ''}</div>`).join('');
    const W = kmCat.types[c.weak];
    const img = esc(c.img);
    // Bild ganz zeigen (contain), dahinter dieselbe Grafik unscharf als Fuellung
    return `<div class="${cls}" style="--tc:${T.color}" data-kmcard="${esc(c.id)}">
        ${opt.count > 1 ? `<span class="kc-count">×${opt.count}</span>` : ''}
        <div class="kc-inner">
            <div class="kc-top"><span class="kc-name">${v.includes('s') ? '✦ ' : ''}${opt.missing ? '???' : esc(c.name)}</span><span class="kc-hp"><small>HP</small>${c.hp} ${T.icon}</span></div>
            <div class="kc-art"><span class="ph">${T.icon}</span><img class="bg" src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"><img class="fg" src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">${ball ? kmBall(ball) : ''}${v.includes('s') ? '<span class="kc-sparkle"></span>' : ''}</div>
            <div class="kc-from">${opt.missing ? set.icon + ' ' + esc(set.name) : esc(c.from)}</div>
            ${atk}
            <div class="kc-stats"><span>⚔️ ${c.atk}</span><span>🛡️ ${c.def}</span><span>💨 ${c.spd}</span></div>
            <div class="kc-foot"><span>weak ${W.icon}×1.5</span><span>${esc(c.num)}</span><span class="kc-gem" style="color:${R.color}">${esc(R.name)}</span></div>
        </div>
    </div>`;
}

// Holo und Shiny folgen der Maus
document.addEventListener('pointermove', e => {
    const el = e.target.closest && e.target.closest('.kc.holo, .kc.shiny');
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
        ? '⚔️ <b>Battles are coming in 5.2</b><br>Build a team of three cards and fight AI gyms for coins and packs.'
        : '🤝 <b>PvP duels and card trading are coming in 5.3</b>'}</div>`;
}

// "1 in 12,345" oder Prozent, je nachdem was lesbarer ist
function kmChance(p) {
    if (p <= 0) return '–';
    if (p >= 0.01) return (p * 100).toFixed(p >= 0.1 ? 0 : 1) + '%';
    const n = 1 / p;
    return '1 in ' + (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + ' M' : Math.round(n).toLocaleString('en-US'));
}

// Chancen je Pack: pro Karte (normaler / garantierter Platz) und "mindestens eine im Pack"
function kmOdds(id) {
    const p = kmCat.packs[id];
    const norm = w => { const s = Object.values(w).reduce((a, b) => a + b, 0); return Object.fromEntries(Object.entries(w).map(([k, x]) => [k, x / s])); };
    const N = norm(p.mega ? kmCat.odds.megaNormal : kmCat.odds.normal);
    const S = norm(p.mega ? kmCat.odds.megaSure : kmCat.odds.sure);
    const nn = p.size - p.sure;
    const pack = r => 1 - Math.pow(1 - (N[r] || 0), nn) * Math.pow(1 - (S[r] || 0), p.sure);
    const f = p.mega ? 2 : 1;
    const V = kmCat.variants;
    const perCard = { poke: V.poke * f, master: V.master * f, shiny: V.shiny * f };
    const anyCard = q => 1 - Math.pow(1 - q, p.size);
    // Secret + Masterball + Shiny auf irgendeinem Platz
    const megaCard = r => r * perCard.master * perCard.shiny;
    const superMega = 1 - Math.pow(1 - megaCard(N.secret || 0), nn) * Math.pow(1 - megaCard(S.secret || 0), p.sure);
    return { p, N, S, nn, pack, perCard, anyCard, superMega };
}

function kmDrawOdds() {
    const ids = Object.keys(kmCat.packs);
    const O = Object.fromEntries(ids.map(id => [id, kmOdds(id)]));
    const head = ids.map(id => `<th>${kmCat.packs[id].icon} ${esc(kmCat.packs[id].name)}<br><small>${kmCat.packs[id].size} cards · ${kmCat.packs[id].sure} guaranteed Rare+</small></th>`).join('');
    const rows = kmCat.rarities.map(r => `<tr><td><b style="color:${r.color}">${esc(r.name)}</b></td>` +
        ids.map(id => { const o = O[id]; return `<td>${kmChance(o.N[r.id] || 0)} <small>/ ${kmChance(o.S[r.id] || 0)}</small><br><b>${kmChance(o.pack(r.id))}</b> <small>per pack</small></td>`; }).join('') + '</tr>').join('');
    const vrow = (label, k) => `<tr><td>${label}</td>` + ids.map(id => { const o = O[id]; return `<td>${kmChance(o.perCard[k])} <small>per card</small><br><b>${kmChance(o.anyCard(o.perCard[k]))}</b> <small>per pack</small></td>`; }).join('') + '</tr>';
    return `<details class="km-oddsbox" open>
        <summary>📊 Drop chances</summary>
        <div class="km-oddswrap"><table class="km-oddst">
            <tr><th></th>${head}</tr>
            ${rows}
            ${vrow(kmBall('p') + ' Pokéball', 'poke')}
            ${vrow(kmBall('m') + ' Masterball', 'master')}
            ${vrow('✦ Shiny', 'shiny')}
            <tr class="km-mega"><td>🌈 <b>SUPER MEGA</b><br><small>Secret Rare + Masterball + Shiny</small></td>${ids.map(id => `<td><b>${kmChance(O[id].superMega)}</b> <small>per pack</small></td>`).join('')}</tr>
        </table></div>
        <div class="km-odds">Per card: normal slot <small>/ guaranteed slot</small>. The Mega Booster has better odds on every slot and doubles Pokéball, Masterball and Shiny chances.</div>
    </details>`;
}

function kmDrawPacks() {
    const P = kmCat.packs;
    const tiles = Object.entries(P).map(([id, p]) => {
        const sets = p.sets.map(s => kmCat.sets[s].icon + ' ' + kmCat.sets[s].name).join(' · ');
        const poor = !me || me.coins < p.price;
        return `<div class="km-pack" style="--pc:${KM_PACK_COLOR[id] || '#ffb13d'}">
            <div class="ico">${p.icon}</div>
            <h4>${esc(p.name)}</h4>
            <div class="sub">${p.size} cards · ${sets}<br><b>${p.sure} guaranteed Rare or better</b>${p.mega ? '<br>Better odds on every card' : ''}</div>
            <button type="button" class="gold" data-kmbuy="${id}" ${poor ? 'disabled' : ''}>Open for 🪙 ${p.price.toLocaleString('en-US')}</button>
        </div>`;
    }).join('');
    const sell = kmCat.rarities.map(r => `<b style="color:${r.color}">${r.name}</b> ${kmCat.sell[r.id].toLocaleString('en-US')}`).join(' · ');
    return `<div class="km-packs">${tiles}</div>
        ${kmDrawOdds()}
        <div class="km-odds">Duplicates sell for coins (tap a card in your collection): ${sell}.<br>Pokéball ×${kmCat.sellMul.p}, Masterball ×${kmCat.sellMul.m}, Shiny ×${kmCat.sellMul.s} on top. You always keep one of each card.</div>
        <div class="km-odds">Card data: <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a> · <a href="https://akabab.github.io/superhero-api/" target="_blank" rel="noopener">Superhero API</a> · <a href="https://www.tvmaze.com" target="_blank" rel="noopener">TVMaze</a></div>`;
}

function kmList() {
    const own = kmOwn();
    const q = kmFilter.q.trim().toLowerCase();
    let list = kmCat.cards.filter(c => {
        const o = own[c.id];
        return (!kmFilter.set || c.set === kmFilter.set) &&
            (!kmFilter.type || c.type === kmFilter.type) &&
            (!kmFilter.rarity || c.rarity === kmFilter.rarity) &&
            (!kmFilter.own || (kmFilter.own === 'have' ? o : kmFilter.own === 'missing' ? !o : kmFilter.own === 'special' ? o && o.best : o && o.total > 1)) &&
            // Namen fehlender Karten nicht per Suche verraten, die Herkunft schon
            (!q || c.from.toLowerCase().includes(q) || (o && c.name.toLowerCase().includes(q)));
    });
    if (kmFilter.sort === 'rarity') list = list.slice().sort((a, b) => kmCat.ridx[b.rarity] - kmCat.ridx[a.rarity]);
    else if (kmFilter.sort === 'name') list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    else if (kmFilter.sort === 'hp') list = list.slice().sort((a, b) => b.hp - a.hp);
    return list;
}

function kmDrawAlbum() {
    const own = kmOwn();
    const opt = (v, t, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${t}</option>`;
    const bar = `<div class="km-bar">
        <select data-kmf="set">${opt('', 'All sets', kmFilter.set)}${Object.entries(kmCat.sets).map(([k, s]) => opt(k, s.icon + ' ' + s.name, kmFilter.set)).join('')}</select>
        <select data-kmf="type">${opt('', 'All types', kmFilter.type)}${Object.entries(kmCat.types).map(([k, t]) => opt(k, t.icon + ' ' + t.name, kmFilter.type)).join('')}</select>
        <select data-kmf="rarity">${opt('', 'All rarities', kmFilter.rarity)}${kmCat.rarities.map(r => opt(r.id, r.name, kmFilter.rarity)).join('')}</select>
        <select data-kmf="own">${opt('', 'Owned + missing', kmFilter.own)}${opt('have', 'Owned', kmFilter.own)}${opt('missing', 'Missing', kmFilter.own)}${opt('dupes', 'Duplicates', kmFilter.own)}${opt('special', 'Pokéball / Masterball / Shiny', kmFilter.own)}</select>
        <select data-kmf="sort">${opt('num', 'Sort: number', kmFilter.sort)}${opt('rarity', 'Sort: rarity', kmFilter.sort)}${opt('hp', 'Sort: HP', kmFilter.sort)}${opt('name', 'Sort: name', kmFilter.sort)}</select>
        <input data-kmf="q" placeholder="Search name or series…" value="${esc(kmFilter.q)}">
        <button type="button" id="km-selldupes">💰 Sell duplicates</button>
    </div>`;
    const prog = Object.entries(kmCat.sets).map(([k, s]) => {
        const all = kmCat.cards.filter(c => c.set === k);
        const n = all.filter(c => own[c.id]).length;
        return `<div>${s.icon} ${esc(s.name)} <b style="float:right">${n} / ${all.length}</b><div class="bar"><i style="width:${(n / Math.max(1, all.length) * 100).toFixed(1)}%"></i></div></div>`;
    }).join('');
    const list = kmList();
    const grid = list.slice(0, kmShown).map(c => { const o = own[c.id]; return kmCard(c, { mini: true, missing: !o, count: o ? o.total : 0, v: o ? o.best : '' }); }).join('');
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

function kmVName(v) {
    return [...v].map(ch => KM_VLABEL[ch]).join(' + ') || 'Normal';
}

function kmView(id, showV) {
    const c = kmCat.byId[id];
    if (!c) return;
    const o = kmOwn()[id];
    const v = $('km-view');
    v.dataset.id = id;
    const cur = showV !== undefined ? showV : o ? o.best : '';
    const T = kmCat.types[c.type], R = kmCat.rarities[kmCat.ridx[c.rarity]];
    // Je Variante: Anzahl, Wert, Verkaufen (nie das letzte Exemplar der Karte)
    const vars = o ? Object.entries(o.vars).sort((a, b) => kmVRank(b[0]) - kmVRank(a[0])).map(([vv, n]) => {
        const val = kmValue(c, vv);
        const canSell = Math.min(n, o.total - 1);
        return `<div class="km-var ${vv === cur ? 'on' : ''}" data-kmshow="${vv}">
            <b>${kmVName(vv)}</b> ×${n} <small>· worth 🪙 ${val.toLocaleString('en-US')}</small>
            ${canSell > 0 ? `<button type="button" data-kmsell="${esc(kmKeyOf(id, vv))}" data-n="1">Sell 1</button>` : ''}
            ${canSell > 1 ? `<button type="button" data-kmsell="${esc(kmKeyOf(id, vv))}" data-n="${canSell}">Sell ${canSell} (🪙 ${(canSell * val).toLocaleString('en-US')})</button>` : ''}
        </div>`;
    }).join('') : '';
    v.innerHTML = kmCard(c, { missing: !o, v: cur }) + `<div class="km-info">
        <h3>${o ? esc(c.name) : '???'}</h3>
        <div>${o ? esc(c.from) + '<br>' : ''}${kmCat.sets[c.set].icon} ${esc(kmCat.sets[c.set].name)} · ${esc(c.num)}</div>
        <div>${T.icon} ${esc(T.name)} · <b style="color:${R.color}">${esc(R.name)}</b> · weak to ${kmCat.types[c.weak].icon} ${esc(kmCat.types[c.weak].name)}</div>
        <div style="margin-top:8px">${o ? `You own <b>${o.total}</b>` : 'You do not own this card yet'}</div>
        ${vars}
        <button type="button" id="km-view-close">Close</button>
    </div>`;
    v.hidden = false;
}

// ---------- Pack oeffnen ----------
// Ablauf: Pack antippen -> Karten verdeckt aufgefaechert -> Kartentrick
// (mischen, zum Stapel) -> Stapel dreht sich um -> Karte fuer Karte wegwischen
// (die beste zuletzt) -> Uebersicht.

function kmRank(g) {
    return kmCat.ridx[kmCat.byId[g.id].rarity] * 10 + kmVRank(g.v);
}

function kmShowPack(o) {
    const p = kmCat.packs[o.pack];
    // Aufdeck-Reihenfolge: schwaechste zuerst, beste zuletzt
    const order = o.cards.map((g, i) => i).sort((a, b) => kmRank(o.cards[a]) - kmRank(o.cards[b]));
    kmOpening = { ...o, order, idx: 0, busy: false };
    const box = $('km-open');
    box.innerHTML = `<div class="km-open-pack" id="km-rip" title="Open">${p.icon}</div><div class="km-note" style="padding:0">Tap the pack to open</div>`;
    box.hidden = false;
    kmSfx('charge');
}

// Kartentrick: verdeckt auffaechern, mischen, zum Stapel schieben, umdrehen
function kmTrick() {
    const o = kmOpening;
    o.busy = true;
    const box = $('km-open');
    const n = o.cards.length;
    const backs = o.cards.map((g, i) => `<div class="km-tb" style="--i:${i};--n:${n}"></div>`).join('');
    box.innerHTML = `<div class="km-trick" id="km-trick">${backs}</div><div class="km-note" style="padding:0">Shuffling…</div>`;
    const t = $('km-trick');
    const step = (cls, ms) => new Promise(r => setTimeout(() => { t.className = 'km-trick ' + cls; r(); }, ms));
    // Faecher -> Riffle links/rechts -> Stapel -> Umdrehen
    step('fan', 60)
        .then(() => step('fan riffle', 650))
        .then(() => { kmSfx('tick', 1); return step('fan riffle r2', 380); })
        .then(() => { kmSfx('tick', 2); return step('stack', 380); })
        .then(() => step('stack flip', 520))
        .then(() => new Promise(r => setTimeout(r, 330)))
        .then(() => { if (kmOpening === o) kmStack(); });
}

// Aufgedeckter Stapel: oberste Karte = aktuelle, wegwischen zeigt die naechste
function kmStack() {
    const o = kmOpening;
    o.busy = false;
    const box = $('km-open');
    const cards = o.order.map((ci, pos) => {
        const g = o.cards[ci];
        return `<div class="km-sc" data-pos="${pos}" style="z-index:${100 - pos};--d:${Math.min(pos, 4)}">${kmCard(kmCat.byId[g.id], { v: g.v })}${o.fresh[ci] ? '<span class="km-new">NEW</span>' : ''}</div>`;
    }).join('');
    box.innerHTML = `<div class="km-count" id="km-count2"></div>
        <div class="km-stack" id="km-stack">${cards}</div>
        <div class="km-note" style="padding:0">Swipe or tap the card · → / Space</div>
        <div class="km-open-btns"><button type="button" id="km-skip">Skip to summary</button></div>`;
    kmReveal();
}

// Aktuelle Karte zeigen (Klang, Effekt je Seltenheit)
function kmReveal() {
    const o = kmOpening;
    const g = o.cards[o.order[o.idx]];
    const c = kmCat.byId[g.id];
    $('km-count2').textContent = `${o.idx + 1} / ${o.cards.length}`;
    document.querySelectorAll('#km-stack .km-sc').forEach(el => el.style.setProperty('--d', Math.max(0, Math.min(Number(el.dataset.pos) - o.idx, 4))));
    const r = kmCat.ridx[c.rarity];
    const top = document.querySelector(`#km-stack .km-sc[data-pos="${o.idx}"]`);
    top.classList.add('top');
    const big = r >= 4 || /[ms]/.test(g.v);
    if (big || r >= 3) {
        top.classList.add(big ? 'burst-big' : 'burst');
        const st = $('km-stack');
        st.classList.remove('shake');
        void st.offsetWidth;
        if (big) st.classList.add('shake');
    }
    if (g.v.includes('s') || (r >= 5 && g.v.includes('m'))) kmSfx('fanfare', 'bonus');
    else if (r >= 4 || g.v.includes('m')) kmSfx('fanfare', 'big');
    else if (r >= 3 || g.v.includes('p')) kmSfx('win', 3);
    else kmSfx('click');
}

// Oberste Karte wegwischen (dir: -1 links, 1 rechts)
function kmNext(dir) {
    const o = kmOpening;
    if (!o || o.busy || o.done) return;
    const top = document.querySelector(`#km-stack .km-sc[data-pos="${o.idx}"]`);
    if (!top) return;
    o.busy = true;
    top.style.transition = 'transform .35s ease-in, opacity .35s';
    top.style.transform = `translate(${dir * 130}vw, -40px) rotate(${dir * 30}deg)`;
    top.style.opacity = '0';
    setTimeout(() => {
        top.remove();
        o.busy = false;
        o.idx++;
        if (o.idx >= o.cards.length) kmSummary();
        else kmReveal();
    }, 280);
}

function kmSummary() {
    const o = kmOpening;
    o.busy = false;
    o.done = true;
    const row = o.order.map(ci => {
        const g = o.cards[ci];
        return `<div class="km-sum-c">${kmCard(kmCat.byId[g.id], { mini: true, v: g.v })}${o.fresh[ci] ? '<span class="km-new2">NEW</span>' : ''}${g.v ? `<small>${kmVName(g.v)}</small>` : ''}</div>`;
    }).join('');
    $('km-open').innerHTML = `<div class="km-open-row">${row}</div>
        <div class="km-open-btns">
        <button type="button" class="gold" id="km-again">Open another (🪙 ${kmCat.packs[o.pack].price.toLocaleString('en-US')})</button>
        <button type="button" id="km-done">Done</button></div>`;
}

function kmCloseOpen() {
    $('km-open').hidden = true;
    $('km-open').innerHTML = '';
    kmOpening = null;
}

// Wischen mit Maus/Finger auf der obersten Karte
let kmDrag = null;
$('km-open').addEventListener('pointerdown', e => {
    const top = e.target.closest('#km-stack .km-sc.top');
    if (!top || !kmOpening || kmOpening.busy || Number(top.dataset.pos) !== kmOpening.idx) return;
    kmDrag = { el: top, x: e.clientX, y: e.clientY, dx: 0 };
    try { top.setPointerCapture(e.pointerId); } catch {}
    top.style.transition = 'none';
});
$('km-open').addEventListener('pointermove', e => {
    if (!kmDrag) return;
    kmDrag.dx = e.clientX - kmDrag.x;
    const dy = (e.clientY - kmDrag.y) * 0.3;
    kmDrag.el.style.transform = `translate(${kmDrag.dx}px, ${dy}px) rotate(${kmDrag.dx / 14}deg)`;
});
$('km-open').addEventListener('pointerup', () => {
    if (!kmDrag) return;
    const { el, dx } = kmDrag;
    kmDrag = null;
    if (Math.abs(dx) > 70) return kmNext(dx > 0 ? 1 : -1);
    // Kaum bewegt = Tippen: naechste Karte; sonst zurueckschnappen
    el.style.transition = 'transform .2s';
    el.style.transform = '';
    if (Math.abs(dx) < 8) kmNext(-1);
});

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
        // Nur normale Doppelte; Ball/Shiny bleiben, eins je Karte bleibt immer
        const own = kmOwn();
        let n = 0, coins = 0, rare = 0;
        for (const [id, o] of Object.entries(own)) {
            const c = kmCat.byId[id];
            const plain = o.vars[''] || 0;
            const k = Math.min(plain, o.total - 1);
            if (!c || k <= 0) continue;
            n += k;
            coins += k * kmValue(c, '');
            if (kmCat.ridx[c.rarity] >= 2) rare += k;
        }
        if (!n) return showMsg('km-msg', 'No duplicates to sell', 'err');
        if (confirm(`Sell ${n} duplicate card${n === 1 ? '' : 's'} for ${coins.toLocaleString('en-US')} coins?\nYou keep one of each, Pokéball/Masterball/Shiny cards are not sold.${rare ? `\n${rare} of them are Rare or better.` : ''}`)) wsSend({ type: 'kmSellDupes' });
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
    if (s) {
        const { id, v } = kmParse(s.dataset.kmsell);
        const c = kmCat.byId[id];
        const n = Number(s.dataset.n);
        // Teure Karten nochmal bestaetigen
        if ((v || kmCat.ridx[c.rarity] >= 3) && !confirm(`Sell ${n}× ${kmVName(v)} ${c.name} for ${(n * kmValue(c, v)).toLocaleString('en-US')} coins?`)) return;
        return wsSend({ type: 'kmSell', key: s.dataset.kmsell, n });
    }
    const sh = e.target.closest('[data-kmshow]');
    if (sh) return kmView($('km-view').dataset.id, sh.dataset.kmshow);
    if (e.target.id === 'km-view-close' || e.target === $('km-view')) {
        $('km-view').hidden = true;
        $('km-view').dataset.id = '';
    }
});

$('km-open').addEventListener('click', e => {
    if (e.target.id === 'km-rip' && kmOpening && !kmOpening.busy) {
        e.target.classList.add('burst');
        kmSfx('fanfare', 'small');
        kmOpening.busy = true;
        return setTimeout(kmTrick, 420);
    }
    if (e.target.id === 'km-skip') return kmSummary();
    if (e.target.id === 'km-again') {
        const pack = kmOpening.pack;
        kmCloseOpen();
        return wsSend({ type: 'kmBuy', pack });
    }
    if (e.target.id === 'km-done') kmCloseOpen();
});

document.addEventListener('keydown', e => {
    if (kmOpening && !$('km-open').hidden && !kmOpening.done) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if ($('km-rip')) return $('km-rip').click();
            return kmNext(1);
        }
        if (e.key === 'ArrowLeft') return kmNext(-1);
    }
    if (e.key !== 'Escape') return;
    if (!$('km-view').hidden) $('km-view').hidden = true;
});

$('km-menu-open').onclick = () => setWorld('cards');
