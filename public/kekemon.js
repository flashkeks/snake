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
// 26.09.2026 (Max): Standard „Owned"
const kmFilter = { set: '', type: '', rarity: '', own: 'have', q: '', sort: 'num' };
// Mehrfachauswahl im Album (26.09.2026, SINTHSBen/Max): Karten-ids zum Verkaufen/Verfuettern
let kmSelMode = false;
const kmSel = new Set();
// Auswahl als [key, Anzahl], billigste Variante zuerst (bei keepOne bleibt die beste)
function kmSelItems(except) {
    const own = kmOwn(), out = [];
    for (const id of kmSel) {
        const o = own[id];
        if (!o) continue;
        for (const [v, n] of Object.entries(o.vars).sort((a, b) => kmVRank(a[0]) - kmVRank(b[0]))) if (kmKeyOf(id, v) !== except) out.push([kmKeyOf(id, v), n]);
    }
    return out;
}
function kmSelBar() {
    if (!kmSelMode) return '';
    const own = kmOwn();
    let copies = 0, all = 0, keep = 0;
    for (const id of kmSel) {
        const o = own[id], c = kmCat.byId[id];
        if (!o || !c) continue;
        copies += o.total;
        const vs = Object.entries(o.vars).sort((a, b) => kmVRank(a[0]) - kmVRank(b[0]));
        let left = o.total - 1;
        for (const [v, n] of vs) {
            all += n * kmValue(c, v);
            const k = Math.min(n, left);
            keep += k * kmValue(c, v);
            left -= k;
        }
    }
    return `<div class="km-selbar" id="km-selbar"><b>☑️ ${kmSel.size} card${kmSel.size === 1 ? '' : 's'}</b> <small>${copies} cop${copies === 1 ? 'y' : 'ies'}</small>
        <button type="button" data-kmselall="1">Select all shown</button>
        <button type="button" data-kmsellsel="keep" ${kmSel.size ? '' : 'disabled'}>💰 Sell, keep 1 each (🪙 ${keep.toLocaleString('en-US')})</button>
        <button type="button" data-kmsellsel="all" class="danger" ${kmSel.size ? '' : 'disabled'}>💰 Sell all copies (🪙 ${all.toLocaleString('en-US')})</button>
        <button type="button" data-kmselclear="1">✖ Clear</button>
        <small class="hint">🍪 To feed: open the card you want to level and press “Feed selected”.</small></div>`;
}
let kmOpening = null;        // offenes Pack { pack, cards: [{id, v}], fresh, order, idx }

const KM_PACK_COLOR = { anime: '#ff7ac8', film: '#3da5ff', waifu: '#ff4f8b', game: '#57e38a', mixed: '#ffb13d', train: '#7dffb0' };
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

// ---------- Karten-Level (6.7, Formel wie km-level.js) ----------
function kmLvOf(xp) {
    const C = (km && km.lvCurve) || { max: 50, curve: { base: 20, exp: 1.5 } };
    const need = l => l >= C.max ? 0 : Math.round(C.curve.base * Math.pow(l, C.curve.exp));
    let lv = 1, rest = Math.max(0, Math.floor(xp || 0));
    while (lv < C.max && rest >= need(lv)) { rest -= need(lv); lv++; }
    return { lv, into: rest, need: need(lv) };
}
// XP-Liste einer Variante (absteigend, je Kopie) und Level der besten Kopie
const kmXpList = key => ((km && km.xp) || {})[key] || [];
const kmBestLv = key => kmLvOf(kmXpList(key)[0] || 0).lv;
// Bestes Level ueber alle Varianten einer Karte
function kmCardLv(id) {
    let best = 1;
    const o = kmOwn()[id];
    if (o) for (const v of Object.keys(o.vars)) best = Math.max(best, kmBestLv(kmKeyOf(id, v)));
    return best;
}
const kmLvMul = lv => 1 + 0.04 * (Math.max(1, lv) - 1);

function kmValue(c, v) {
    let n = kmCat.sell[c.rarity];
    for (const ch of v || '') n *= kmCat.sellMul[ch] || 1;
    return n;
}

// Sammlung je Karte: { total, vars: {v: n}, best }
// Karten aus einem Pack, die noch verdeckt sind (26.09.2026): zaehlen noch nicht fuers Album
let kmPending = {};
function kmUnpend(g) {
    const k = kmKeyOf(g.id, g.v);
    if (kmPending[k] > 0 && !--kmPending[k]) delete kmPending[k];
    if (typeof kmHead === 'function') kmHead();
}
function kmRevealDone() {
    if (!Object.keys(kmPending).length && !(kmOpening && !kmOpening.told)) return;
    kmPending = {};
    if (kmOpening) kmOpening.told = true;
    wsSend({ type: 'kmRevealed' });
    if (typeof kmHead === 'function') kmHead();
}
function kmOwn() {
    const out = {};
    for (const [k, n0] of Object.entries((km && km.have) || {})) {
        const n = n0 - (kmPending[k] || 0);
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
            // Kampf 6.0: Stil, Werte, vier Attacken
            style: a[12][0], bst: Object.fromEntries(['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((k, i) => [k, a[12][1][i]])),
            moves: a[12][2].map(x => ({ name: x[0], type: x[1], cat: x[2], pow: x[3], acc: x[4], pp: x[5], pri: x[6], desc: x[7], eff: x[8] || null }))
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
        document.body.classList.remove('world-arena', 'world-market');
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
    // Frisch gezogene Karten zaehlen erst, wenn sie aufgedeckt sind (26.09.2026)
    if (d.opened) {
        kmPending = {};
        for (const g of d.opened.cards || []) { const k = typeof g === 'string' ? g : kmKeyOf(g.id, g.v); kmPending[k] = (kmPending[k] || 0) + 1; }
    }
    if (kb && d.frag !== undefined) kb.frag = d.frag;
    kmLoadCat(d.v).then(() => {
        if (d.opened) {
            try {
                kmShowPack(d.opened);
            } catch (e) {
                // Lieber ohne Show als gar nichts sehen (5.2b)
                console.error('pack opening', e);
                try { kmSummary(); } catch { showMsg('km-msg', 'Pack opened – check your collection', 'ok'); }
            }
        }
        if (d.sold) showMsg('km-msg', `Sold ${d.sold.n} card${d.sold.n === 1 ? '' : 's'} for 🪙 ${d.sold.coins.toLocaleString('en-US')}`, 'ok');
        if (d.teamSaved) showMsg('km-msg', `💾 Saved as „${d.teamSaved.name}"`, 'ok');
        if (d.fed) showMsg('km-msg', `🍪 Fed ${d.fed.n}× – ${d.fed.name} +${d.fed.xp.toLocaleString('en-US')} XP${d.fed.to > d.fed.from ? ` · ⬆ Lv ${d.fed.from} → ${d.fed.to}` : ''}`, 'ok');
        if (d.bought) showMsg('km-msg', `${d.bought.n > 1 ? d.bought.n + '× ' : ''}${kmCat.packs[d.bought.pack].name} added to 📦 Packs`, 'ok');
        // Daily Pack Wheel: erst drehen, dann neu zeichnen
        if (d.wheelSpin) {
            const [pid, n] = d.wheelSpin.prize;
            const P = kmCat.packs[pid];
            return pwSpin('km-wheel', kmWheelSegs(), d.wheelSpin.index, () => {
                showMsg('km-msg', `🎉 You won ${n > 1 ? n + '× ' : ''}${P.icon} ${P.name}! It's in your packs.`, 'ok');
                kmSfx('fanfare', pid === 'jackpot' ? 'bonus' : pid === 'mixed' ? 'big' : 'small');
                if (!$('kekemon').classList.contains('hidden')) kmDraw();
            });
        }
        if (!$('kekemon').classList.contains('hidden') && !pwBusy['km-wheel']) kmDraw();
        const v = $('km-view');
        if (v && !v.hidden && v.dataset.id) kmView(v.dataset.id, ((kmOwn()[v.dataset.id] || {}).vars || {})[v.dataset.v] ? v.dataset.v : undefined);
    }).catch(() => showMsg('km-msg', 'Could not load the card list', 'err'));
}

function kmHead() {
    $('km-coins').textContent = me ? me.coins.toLocaleString('en-US') : '–';
    $('km-count').textContent = kmCat ? `${Object.keys(kmOwn()).filter(id => kmCat.byId[id]).length} / ${kmCat.cards.length}` : '–';
    document.querySelectorAll('#km-tabs [data-kmtab]').forEach(b => b.classList.toggle('on', b.dataset.kmtab === kmTab));
}

// ---------- Karte zeichnen ----------

// Typen, gegen die dieser Typ schwach ist / die er aushaelt (Typ-Tabelle 6.0)
function kmWeakTo(type) {
    return Object.keys(kmCat.types).filter(t => (kmCat.chart[t] || {})[type] > 1);
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
    const atk = c.moves.map(m => `<div class="kc-atk" title="${esc(m.desc || '')}"><span class="cost">${kmCat.types[m.type].icon}</span><span class="an">${esc(m.name)}</span><span class="dmg">${m.pow || '—'}</span></div>`).join('');
    const W = kmCat.types[c.weak];
    const img = esc(c.img);
    // Bild ganz zeigen (contain), dahinter dieselbe Grafik unscharf als Fuellung
    const lvTag = opt.lv && (opt.lv > 1 || opt.showLv) ? `<span class="kc-lv ${opt.lv >= 50 ? 'max' : opt.lv >= 30 ? 'hi' : ''}">Lv ${opt.lv}</span>` : '';
    return `<div class="${cls}" style="--tc:${T.color}" data-kmcard="${esc(c.id)}">
        ${opt.count > 1 ? `<span class="kc-count">×${opt.count}</span>` : ''}
        <div class="kc-inner">
            <div class="kc-top"><span class="kc-name">${v.includes('s') ? '✦ ' : ''}${opt.missing ? '???' : esc(c.name)}</span><span class="kc-hp"><small>HP</small>${c.hp} ${T.icon}</span></div>
            <div class="kc-art"><span class="ph">${T.icon}</span><img class="bg" src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"><img class="fg" src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">${ball ? kmBall(ball) : ''}${v.includes('s') ? '<span class="kc-sparkle"></span>' : ''}${v ? `<span class="kc-vtags">${ball === 'm' ? '<i class="vm">MASTERBALL</i>' : ball === 'p' ? '<i class="vp">POKÉBALL</i>' : ''}${v.includes('s') ? '<i class="vs">✦ SHINY</i>' : ''}</span>` : ''}${lvTag}</div>
            <div class="kc-from">${opt.missing ? set.icon + ' ' + esc(set.name) : esc(c.from)}</div>
            ${atk}
            <div class="kc-stats"><span>⚔️ ${c.atk}</span><span>🛡️ ${c.def}</span><span>💨 ${c.spd}</span></div>
            <div class="kc-foot"><span>weak ${kmWeakTo(c.type).map(t => kmCat.types[t].icon).join('')}</span><span>${esc(c.num)}</span><span class="kc-gem" style="color:${R.color}">${esc(R.name)}</span></div>
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
    return keepScroll('km', kmTab, $('kekemon'), kmDrawRaw);
}
function kmDrawRaw() {
    kmHead();
    const body = $('km-body');
    if (!kmCat) {
        body.innerHTML = '<div class="km-note">Loading cards…</div>';
        return;
    }
    if (kmTab === 'shop') body.innerHTML = kmDrawPacks();
    else if (kmTab === 'packs') body.innerHTML = kmDrawInv();
    else if (kmTab === 'album') body.innerHTML = kmDrawAlbum();
    else if (kmTab === 'battle') body.innerHTML = kmDrawBattleTab();
    else if (kmTab === 'duel') body.innerHTML = kmDrawDuelTab();
    else body.innerHTML = kmDrawInv();
    if (kmTab === 'packs') pwIdle('km-wheel', kmWheelSegs());
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
    const tiles = Object.entries(P).filter(([, p]) => !p.wheel).map(([id, p]) => {
        const sets = p.sets.map(s => kmCat.sets[s].icon + ' ' + kmCat.sets[s].name).join(' · ');
        const poor = !me || me.coins < p.price;
        const have = (km && km.inv && km.inv[id]) || 0;
        return `<div class="km-pack" style="--pc:${KM_PACK_COLOR[id] || '#ffb13d'}">
            <div class="ico">${p.icon}</div>
            <h4>${esc(p.name)}</h4>
            <div class="sub">${p.size} cards · ${sets}<br><b>${p.sure} guaranteed Rare or better</b>${p.mega ? '<br>Better odds on every card' : ''}</div>
            <button type="button" class="gold" data-kmbuy="${id}" ${poor ? 'disabled' : ''}>${poor && me
                ? `🔒 🪙 ${p.price.toLocaleString('en-US')}`
                : `Buy for 🪙 ${p.price.toLocaleString('en-US')}`}</button>
            ${have ? `<small class="km-have">You have ${have} unopened – see 📦 Packs</small>` : ''}
        </div>`;
    }).join('');
    const sell = kmCat.rarities.map(r => `<b style="color:${r.color}">${r.name}</b> ${kmCat.sell[r.id].toLocaleString('en-US')}`).join(' · ');
    return `<div class="km-note" style="padding:6px 0 10px">Bought packs go to 📦 <b>Packs</b> – open them there whenever you like, or trade them.</div>
        <div class="km-packs">${tiles}</div>
        ${kmDrawOdds()}
        <div class="km-odds">Duplicates sell for coins (tap a card in your collection): ${sell}.<br>Pokéball ×${kmCat.sellMul.p}, Masterball ×${kmCat.sellMul.m}, Shiny ×${kmCat.sellMul.s} on top. You always keep one of each card.</div>
        <div class="km-odds">Card data: <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a> · <a href="https://akabab.github.io/superhero-api/" target="_blank" rel="noopener">Superhero API</a> · <a href="https://www.tvmaze.com" target="_blank" rel="noopener">TVMaze</a></div>`;
}

// ---------- Packs (6.1): ungeoeffnete Packs + Daily Pack Wheel ----------

const KM_WHEEL_COLOR = { daily: ['#3da5ff', '#2a7fd4', '#57b6ff'], mixed: '#ffb13d', jackpot: '#111' };

function kmWheelSegs() {
    const segs = (km && km.wheel && km.wheel.segs) || [];
    let k = 0;
    return segs.map(([pid, n]) => {
        const P = kmCat.packs[pid] || { icon: '?' };
        const col = KM_WHEEL_COLOR[pid];
        return { icon: P.icon, label: '×' + n, color: Array.isArray(col) ? col[k++ % col.length] : col || '#888', gold: pid === 'jackpot' };
    });
}

function kmDrawInv() {
    const inv = (km && km.inv) || {};
    const P = kmCat.packs;
    const ready = km && km.wheel && km.wheel.ready;
    const tiles = Object.entries(inv).filter(([id, n]) => n > 0 && P[id]).map(([id, n]) => {
        const p = P[id];
        return `<div class="km-pack km-invpack" style="--pc:${KM_PACK_COLOR[id] || (id === 'daily' ? '#3da5ff' : id === 'jackpot' ? '#ff5bd6' : '#ffb13d')}">
            <span class="km-invn">×${n}</span>
            <div class="ico">${p.icon}</div>
            <h4>${esc(p.name)}</h4>
            <div class="sub">${p.size} cards · ${p.sure} guaranteed Rare or better${p.mega ? '<br>Mega odds' : ''}</div>
            <button type="button" class="gold" data-kmopen="${id}">Open</button>
        </div>`;
    }).join('');
    return `<div class="km-wheelbox">
            <div class="pw-wrap"><canvas id="km-wheel" width="340" height="340"></canvas><div class="pw-pointer">▼</div></div>
            <div class="km-wheelside">
                <h3>🎡 Daily Pack Wheel</h3>
                <div>One free spin every day. Every prize is a pack for your inventory.</div>
                <button type="button" class="gold" id="km-spin" ${ready && !pwBusy['km-wheel'] ? '' : 'disabled'}>${ready ? '🎡 Spin for free' : '✔ Spun today – come back tomorrow'}</button>
            </div>
        </div>
        ${kbFragBox()}
        <h3 class="kd-h">Your packs</h3>
        <div class="km-packs">${tiles || '<div class="km-note" style="grid-column:1/-1">No unopened packs. Buy some in 🛒 Pack Shop, spin the wheel or beat a gym.</div>'}</div>
        <div class="km-odds">Packs can be traded and sold in the 🏛️ Market like cards.</div>`;
}

// ---------- Gluecksrad (6.1, fuer Daily Pack Wheel und Daily Case Wheel) ----------
// segs: [{ icon, label, color, gold }]; Feld 0 steht bei Winkel 0 oben.

const pwBusy = {};

function pwDraw(id, segs, angle) {
    const cv = $(id);
    if (!cv || !segs.length) return;
    const c = cv.getContext('2d');
    const W = cv.width, R = W / 2;
    const seg = Math.PI * 2 / segs.length;
    c.clearRect(0, 0, W, W);
    c.save();
    c.translate(R, R);
    c.fillStyle = '#2a1d3d';
    c.beginPath();
    c.arc(0, 0, R - 2, 0, Math.PI * 2);
    c.fill();
    c.rotate(angle);
    segs.forEach((sg, i) => {
        const a0 = -Math.PI / 2 + i * seg - seg / 2;
        c.fillStyle = sg.color;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, R * 0.88, a0, a0 + seg);
        c.closePath();
        c.fill();
        c.strokeStyle = sg.gold ? '#ffd23f' : 'rgba(255,255,255,.6)';
        c.lineWidth = sg.gold ? 4 : 2;
        c.stroke();
        c.save();
        c.rotate(a0 + seg / 2);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.translate(R * 0.62, 0);
        c.rotate(Math.PI / 2);
        c.font = `${Math.round(R * 0.15)}px system-ui`;
        c.fillText(sg.icon, 0, -R * 0.02);
        c.font = `900 ${Math.round(R * 0.085)}px system-ui`;
        c.fillStyle = sg.gold ? '#ffd23f' : '#fff';
        c.strokeStyle = 'rgba(0,0,0,.6)';
        c.lineWidth = 3;
        c.strokeText(sg.label, 0, R * 0.13);
        c.fillText(sg.label, 0, R * 0.13);
        c.restore();
    });
    c.restore();
    for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2;
        c.fillStyle = (i + Math.floor(performance.now() / 250)) % 2 ? '#fff6c2' : '#b8860b';
        c.beginPath();
        c.arc(R + Math.cos(a) * R * 0.94, R + Math.sin(a) * R * 0.94, R * 0.022, 0, Math.PI * 2);
        c.fill();
    }
    const g = c.createRadialGradient(R, R, 0, R, R, R * 0.14);
    g.addColorStop(0, '#fff6c2');
    g.addColorStop(1, '#b8860b');
    c.fillStyle = g;
    c.beginPath();
    c.arc(R, R, R * 0.13, 0, Math.PI * 2);
    c.fill();
}

// Stillstehend zeichnen (Lichter blinken ueber das Intervall unten)
const pwIdleSegs = {};
const pwAngle = {};          // letzter Stand, damit das Rad nach dem Drehen stehen bleibt
function pwIdle(id, segs) {
    pwIdleSegs[id] = segs;
    pwDraw(id, segs, pwAngle[id] || 0);
}
setInterval(() => {
    for (const [id, segs] of Object.entries(pwIdleSegs)) if (!pwBusy[id] && $(id)) pwDraw(id, segs, pwAngle[id] || 0);
}, 250);

// Drehen bis Feld index oben steht, dann done()
function pwSpin(id, segs, index, done) {
    const seg = Math.PI * 2 / segs.length;
    const end = Math.PI * 12 - index * seg + (Math.random() - 0.5) * seg * 0.6;
    const dur = 6000;
    const t0 = performance.now();
    let last = -1;
    pwBusy[id] = true;
    (function step() {
        const t = Math.min(1, (performance.now() - t0) / dur);
        const e = 1 - Math.pow(1 - t, 4);
        const ang = end * e;
        pwDraw(id, segs, ang);
        const k = Math.floor((ang + seg / 2) / seg);
        if (k !== last) {
            last = k;
            try { sTone(1600, { dur: .03, type: 'triangle', vol: .05 * (1 - t) + .01, rev: 0 }); } catch {}
        }
        if (t < 1 && $(id)) return requestAnimationFrame(step);
        pwAngle[id] = end % (Math.PI * 2);
        pwBusy[id] = false;
        done();
    })();
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
    else if (kmFilter.sort === 'level') list = list.slice().sort((a, b) => (own[b.id] ? kmCardLv(b.id) : 0) - (own[a.id] ? kmCardLv(a.id) : 0));
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
        <select data-kmf="sort">${opt('num', 'Sort: number', kmFilter.sort)}${opt('rarity', 'Sort: rarity', kmFilter.sort)}${opt('hp', 'Sort: HP', kmFilter.sort)}${opt('name', 'Sort: name', kmFilter.sort)}${opt('level', 'Sort: level', kmFilter.sort)}</select>
        <input data-kmf="q" placeholder="Search name or series…" value="${esc(kmFilter.q)}">
        <button type="button" id="km-selldupes">💰 Sell duplicates</button>
        <button type="button" id="km-selmode" class="${kmSelMode ? 'on' : ''}">☑️ ${kmSelMode ? 'Done selecting' : kmSel.size ? `Select (${kmSel.size} picked)` : 'Select'}</button>
    </div>${kmSelBar()}`;
    const prog = Object.entries(kmCat.sets).map(([k, s]) => {
        const all = kmCat.cards.filter(c => c.set === k);
        const n = all.filter(c => own[c.id]).length;
        return `<div>${s.icon} ${esc(s.name)} <b style="float:right">${n} / ${all.length}</b><div class="bar"><i style="width:${(n / Math.max(1, all.length) * 100).toFixed(1)}%"></i></div></div>`;
    }).join('');
    const list = kmList();
    const grid = list.slice(0, kmShown).map(c => { const o = own[c.id]; const h = kmCard(c, { mini: true, missing: !o, count: o ? o.total : 0, v: o ? o.best : '', lv: o ? kmCardLv(c.id) : 0 }); return kmSel.has(c.id) ? h.replace('class="kc ', 'class="kc km-picked ') : h; }).join('');
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
    const sb = body.querySelector('#km-selbar'), nsb = tmp.querySelector('#km-selbar');
    if (sb && nsb) sb.replaceWith(nsb);
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
    v.dataset.v = cur;
    const T = kmCat.types[c.type], R = kmCat.rarities[kmCat.ridx[c.rarity]];
    // Je Variante: Anzahl, Wert, Verkaufen (nie das letzte Exemplar der Karte)
    const vars = o ? Object.entries(o.vars).sort((a, b) => kmVRank(b[0]) - kmVRank(a[0])).map(([vv, n]) => {
        const val = kmValue(c, vv);
        // 26.09.2026: auch das letzte Exemplar (mit Rueckfrage)
        const canSell = n;
        // 6.7: Level je Kopie; die beste kaempft
        const xs = kmXpList(kmKeyOf(id, vv));
        const L = kmLvOf(xs[0] || 0);
        const lvRow = `<div class="km-lvrow"><b>Lv ${L.lv}</b>${L.need ? `<span class="km-xpbar"><i style="width:${(L.into / L.need * 100).toFixed(1)}%"></i></span><small>${L.into.toLocaleString('en-US')} / ${L.need.toLocaleString('en-US')} XP</small>` : '<small>max level</small>'}` +
            `${n > 1 ? `<small class="hint">copies: ${Array.from({ length: n }, (_, i) => 'Lv ' + kmLvOf(xs[i] || 0).lv).join(', ')} · selling gives away the lowest first</small>` : ''}</div>`;
        // Verfuettern: Kopien dieser Variante in die gewaehlte (cur) stecken
        const tKey = kmKeyOf(id, cur), sKey = kmKeyOf(id, vv);
        const canFeed = o.vars[cur] ? (vv === cur ? n - 1 : n) : 0;
        const fx = (km && km.lvCurve && km.lvCurve.feed) || {};
        const gain = (fx[c.rarity] || 180) * ((km && km.lvCurve && km.lvCurve.feedSame) || 1) + Math.round((xs[n - 1] || 0) * ((km && km.lvCurve && km.lvCurve.feedKeep) || 0.5));
        const feedBtns = canFeed > 0 ? `<button type="button" class="km-feed" data-kmfeed="${esc(sKey)}" data-to="${esc(tKey)}" data-n="1" title="Sacrifice the weakest copy">🍪 Feed 1 → ${kmVName(cur)} (+${gain} XP)</button>` +
            (canFeed > 1 ? `<button type="button" class="km-feed" data-kmfeed="${esc(sKey)}" data-to="${esc(tKey)}" data-n="${canFeed}">🍪 Feed ${canFeed}</button>` : '') : '';
        return `<div class="km-var ${vv === cur ? 'on' : ''}" data-kmshow="${vv}">
            <b>${kmVName(vv)}</b> ×${n} <small>· worth 🪙 ${val.toLocaleString('en-US')}</small>${lvRow}
            ${canSell > 0 ? `<button type="button" data-kmsell="${esc(kmKeyOf(id, vv))}" data-n="1">Sell 1</button>` : ''}
            ${canSell > 1 ? `<button type="button" data-kmsell="${esc(kmKeyOf(id, vv))}" data-n="${canSell}">Sell all ${canSell} (🪙 ${(canSell * val).toLocaleString('en-US')})</button>` : ''}
            ${feedBtns}
        </div>`;
    }).join('') : '';
    v.innerHTML = kmCard(c, { missing: !o, v: cur, lv: o ? kmBestLv(kmKeyOf(id, cur)) : 0 }) + `<div class="km-info">
        <h3>${o ? esc(c.name) : '???'}</h3>
        <div>${o ? esc(c.from) + '<br>' : ''}${kmCat.sets[c.set].icon} ${esc(kmCat.sets[c.set].name)} · ${esc(c.num)}</div>
        <div>${T.icon} ${esc(T.name)} · <b style="color:${R.color}">${esc(R.name)}</b> · weak to ${kmWeakTo(c.type).map(t => kmCat.types[t].icon + ' ' + esc(kmCat.types[t].name)).join(', ')}</div>
        ${o ? kmBattleInfo(c) : ''}
        <div style="margin-top:8px">${o ? `You own <b>${o.total}</b>` : 'You do not own this card yet'}</div>
        ${vars}
        ${o && kmSel.size ? kmFeedSelBtn(id, cur) : ''}
        <button type="button" id="km-view-close">Close</button>
    </div>`;
    v.hidden = false;
}

// Kampfwerte und Attacken in der Detailansicht (6.0)
function kmBattleInfo(c) {
    const max = 160;
    const bars = [['hp', 'HP'], ['atk', 'Atk'], ['def', 'Def'], ['spa', 'SpA'], ['spd', 'SpD'], ['spe', 'Spe']].map(([k, l]) =>
        `<div class="km-bst"><span>${l}</span><b>${c.bst[k]}</b><i style="width:${Math.min(100, c.bst[k] / (k === 'hp' ? 260 : max) * 100)}%"></i></div>`).join('');
    const moves = c.moves.map(m => {
        const T = kmCat.types[m.type];
        return `<div class="km-mv" style="--tc:${T.color}"><b>${esc(m.name)}</b><span>${T.icon} ${m.cat === 'phys' ? '💥' : m.cat === 'spec' ? '🌀' : '✨'} ${m.pow || '—'}${m.acc ? ' · ' + m.acc + '%' : ''} · PP ${m.pp}</span>${m.desc ? `<small>${esc(m.desc)}</small>` : ''}</div>`;
    }).join('');
    return `<div class="km-bt"><div class="km-bsts">${bars}</div><div class="km-mvs">${moves}</div>
        <small class="hint">${c.style === 'phys' ? '💥 Physical attacker' : '🌀 Special attacker'}</small></div>`;
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
    // Alte Antwortform (nur Ids) vertragen und Unbekanntes weglassen
    o = { ...o, cards: o.cards.map(g => typeof g === 'string' ? { id: g, v: '' } : g) };
    const keep = o.cards.map(g => !!kmCat.byId[g.id]);
    o.fresh = (o.fresh || []).filter((f, i) => keep[i]);
    o.cards = o.cards.filter((g, i) => keep[i]);
    if (!o.cards.length) return showMsg('km-msg', 'Pack opened – reload the page to see your cards', 'err');
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
    // 26.09.2026 (Max: „man sieht an den Raendern, ob eine krasse Karte dabei ist"): alle
    // Karten unter der obersten liegen verdeckt (gleiche Rueckseite), das Gesicht kommt erst in kmReveal
    const cards = o.order.map((ci, pos) => `<div class="km-sc" data-pos="${pos}" style="z-index:${100 - pos};--d:${Math.min(pos, 4)}"><div class="km-sc-back"></div></div>`).join('');
    box.innerHTML = `<div class="km-count" id="km-count2"></div>
        <div class="km-reveal"><div class="km-stack" id="km-stack">${cards}</div><div class="km-rinfo" id="km-rinfo"></div></div>
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
    // Kurzinfo rechts (6.1, Max): Seltenheit, Wert, Ball, Shiny
    const R = kmCat.rarities[kmCat.ridx[c.rarity]];
    const ball = g.v.includes('m') ? 'Masterball' : g.v.includes('p') ? 'Pokéball' : '';
    const ri = $('km-rinfo');
    if (ri) {
        ri.innerHTML = `<div class="km-ri-r" style="color:${R.color}">${esc(R.name)}</div>
            <div class="km-ri-v">🪙 ${kmValue(c, g.v).toLocaleString('en-US')}<small>value</small></div>
            ${ball ? `<div class="km-ri-t ${g.v.includes('m') ? 'vm' : 'vp'}">${kmBall(g.v.includes('m') ? 'm' : 'p')} ${ball} ×${kmCat.sellMul[g.v.includes('m') ? 'm' : 'p']}</div>` : ''}
            ${g.v.includes('s') ? `<div class="km-ri-t vs">✦ Shiny ×${kmCat.sellMul.s}</div>` : ''}
            ${o.fresh[o.order[o.idx]] ? '<div class="km-ri-t new">NEW</div>' : ''}`;
        ri.classList.remove('pop');
        void ri.offsetWidth;
        ri.classList.add('pop');
    }
    document.querySelectorAll('#km-stack .km-sc').forEach(el => el.style.setProperty('--d', Math.max(0, Math.min(Number(el.dataset.pos) - o.idx, 4))));
    const r = kmCat.ridx[c.rarity];
    const top = document.querySelector(`#km-stack .km-sc[data-pos="${o.idx}"]`);
    top.innerHTML = kmCard(c, { v: g.v }) + (o.fresh[o.order[o.idx]] ? '<span class="km-new">NEW</span>' : '');
    top.classList.add('top');
    // erst jetzt zaehlt die Karte fuers Album
    kmUnpend(g);
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
    kmRevealDone();
    const row = o.order.map(ci => {
        const g = o.cards[ci];
        return `<div class="km-sum-c">${kmCard(kmCat.byId[g.id], { mini: true, v: g.v })}${o.fresh[ci] ? '<span class="km-new2">NEW</span>' : ''}${g.v ? `<small>${kmVName(g.v)}</small>` : ''}</div>`;
    }).join('');
    $('km-open').innerHTML = `<div class="km-open-row">${row}</div>
        <div class="km-open-btns">
        ${(km && km.inv && km.inv[o.pack]) ? `<button type="button" class="gold" id="km-again">Open another ${esc(kmCat.packs[o.pack].name)} (${km.inv[o.pack]} left)</button>` : ''}
        <button type="button" id="km-done">Done</button></div>`;
}

function kmCloseOpen() {
    kmRevealDone();
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
    // Duelle: Liste (offene Duelle, wer online ist) frisch holen
    if (kmTab === 'duel' && kd) wsSend({ type: 'kdState' });
    kmDraw();
};

$('km-back').onclick = () => setWorld('snake');

$('km-body').addEventListener('click', e => {
    const buy = e.target.closest('[data-kmbuy]');
    if (buy) return wsSend({ type: 'kmBuy', pack: buy.dataset.kmbuy });
    if (e.target.closest('[data-kmfrag]')) return wsSend({ type: 'kmFragBuy', n: 1 });
    const opn = e.target.closest('[data-kmopen]');
    if (opn) return wsSend({ type: 'kmOpen', pack: opn.dataset.kmopen });
    if (e.target.closest('#km-spin')) {
        if (!km || !km.wheel || !km.wheel.ready || pwBusy['km-wheel']) return;
        pwBusy['km-wheel'] = true;
        e.target.closest('#km-spin').disabled = true;
        return wsSend({ type: 'kmWheel' });
    }
    if (e.target.id === 'km-selmode') {
        // Auswahl bleibt beim Beenden stehen – so kann man eine Karte oeffnen und „Feed selected" druecken
        kmSelMode = !kmSelMode;
        return kmDraw();
    }
    if (e.target.closest('[data-kmselclear]')) { kmSel.clear(); return kmRegrid(); }
    if (e.target.closest('[data-kmselall]')) { for (const c of kmList().slice(0, kmShown)) if (kmOwn()[c.id]) kmSel.add(c.id); return kmRegrid(); }
    const ss = e.target.closest('[data-kmsellsel]');
    if (ss) {
        const keepOne = ss.dataset.kmsellsel === 'keep', items = kmSelItems();
        if (!items.length) return;
        return uiConfirm(keepOne ? `Sell the selected cards and keep one of each?` : `Sell ALL copies of ${kmSel.size} card${kmSel.size === 1 ? '' : 's'} – including levelled ones? Cards you sell completely leave your album.`,
            { title: '💰 Sell selected', ok: 'Sell', danger: !keepOne }).then(ok => { if (ok) { wsSend({ type: 'kmSellMany', items, keepOne }); kmSel.clear(); } });
    }
    const card = e.target.closest('[data-kmcard]');
    if (card && kmSelMode) {
        if (!kmOwn()[card.dataset.kmcard]) return;
        if (kmSel.has(card.dataset.kmcard)) kmSel.delete(card.dataset.kmcard); else kmSel.add(card.dataset.kmcard);
        return kmRegrid();
    }
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
        uiConfirm(`Sell ${n} duplicate card${n === 1 ? '' : 's'} for ${coins.toLocaleString('en-US')} coins?\nYou keep one of each, Pokéball/Masterball/Shiny cards are not sold.${rare ? `\n${rare} of them are Rare or better.` : ''}`, { title: 'Sell duplicates', ok: 'Sell' }).then(ok => ok && wsSend({ type: 'kmSellDupes' }));
    }
});

$('km-body').addEventListener('input', e => {
    const f = e.target.dataset && e.target.dataset.kmf;
    if (!f) return;
    kmFilter[f] = e.target.value;
    kmShown = 60;
    kmRegrid();
});

// Ausgewaehlte Karten in diese verfuettern (26.09.2026): XP nach Seltenheit, gleiche Karte doppelt
function kmFeedSelBtn(id, cur) {
    const tKey = kmKeyOf(id, cur), fx = (km && km.lvCurve) || {};
    const items = kmSelItems(), own = kmOwn();
    let n = 0, xp = 0;
    for (const [k, cnt] of items) {
        const p = kmParse(k), c = kmCat.byId[p.id];
        const use = k === tKey ? cnt - 1 : cnt;
        if (!c || use <= 0) continue;
        n += use;
        xp += use * ((fx.feed || {})[c.rarity] || 180) * (p.id === id ? fx.feedSame || 2 : 1);
    }
    if (!n) return '';
    return `<button type="button" class="km-feed" data-kmfeedsel="${esc(tKey)}" data-n="${n}" data-xp="${xp}">🍪 Feed ${n} selected → this card (+${xp.toLocaleString('en-US')} XP or more)</button>`;
}

$('km-view').addEventListener('click', e => {
    const fs = e.target.closest('[data-kmfeedsel]');
    if (fs) {
        e.stopPropagation();
        const items = kmSelItems().map(([k, n]) => k === fs.dataset.kmfeedsel ? [k, n - 1] : [k, n]).filter(([, n]) => n > 0);
        return uiConfirm(`Feed ${fs.dataset.n} selected card${fs.dataset.n === '1' ? '' : 's'} into this one for about +${Number(fs.dataset.xp).toLocaleString('en-US')} XP? They are gone for good.`, { title: '🍪 Feed selected', ok: 'Feed', danger: true })
            .then(ok => { if (ok) { wsSend({ type: 'kmFeedMany', target: fs.dataset.kmfeedsel, items }); kmSel.clear(); } });
    }
    const fd = e.target.closest('[data-kmfeed]');
    if (fd) {
        e.stopPropagation();
        const { id, v } = kmParse(fd.dataset.kmfeed);
        const c = kmCat.byId[id];
        const n = Number(fd.dataset.n);
        const go = () => wsSend({ type: 'kmFeed', source: fd.dataset.kmfeed, target: fd.dataset.to, n });
        if (v || kmCat.ridx[c.rarity] >= 3 || n > 1) return uiConfirm(`Feed ${n}× ${kmVName(v)} ${c.name} to your ${kmVName(kmParse(fd.dataset.to).v)} copy? They are gone for good.`, { title: 'Feed cards', ok: 'Feed', danger: true }).then(ok => ok && go());
        return go();
    }
    const s = e.target.closest('[data-kmsell]');
    if (s) {
        const { id, v } = kmParse(s.dataset.kmsell);
        const c = kmCat.byId[id];
        const n = Number(s.dataset.n);
        // Teure Karten nochmal bestaetigen
        const go = () => wsSend({ type: 'kmSell', key: s.dataset.kmsell, n });
        const o = kmOwn()[id];
        if (o && n >= o.total) return uiConfirm(`Sell your last ${n > 1 ? n + ' copies' : 'copy'} of ${c.name}? It leaves your album.`, { title: 'Sell card', ok: 'Sell', danger: true }).then(ok => ok && go());
        if (v || kmCat.ridx[c.rarity] >= 3) return uiConfirm(`Sell ${n}× ${kmVName(v)} ${c.name} for ${(n * kmValue(c, v)).toLocaleString('en-US')} coins?`, { title: 'Sell card', ok: 'Sell' }).then(ok => ok && go());
        return go();
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
        return wsSend({ type: 'kmOpen', pack });
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

// ---------- Kaempfe: Arenen (5.6) und Duelle (5.10) ----------
// Der Server rechnet (km-battle.js), der Browser spielt die Ereignisse ab.
// Arena und Duell haben je einen eigenen Abspieler (kbP.gym / kbP.duel);
// gezeichnet wird beides mit demselben Kampf-Bildschirm (kbDrawBattle).
// Die eigene Seite ist immer Seite 0 – beim Duell dreht der Server Ansicht
// und Ereignisse schon passend.

let kb = null;               // letzter kbState: { gyms, battle }
let kd = null;               // letzter kdState: { me, open, mine, duel, online }
let kbPick = null;           // Team-Auswahl { gym | duel, team: [keys] }
// Sortierung der Auswahl (6.5, Wunsch Schmoggi): bleibt im Browser gemerkt
let kbSort = (() => { try { return localStorage.getItem('kbSort') || 'power'; } catch (e) { return 'power'; } })();
let kbTypeFilter = '';
// Team-Slots (6.8): gespeichert im Konto (km.teams), aktiver Slot im Browser
const KB_SLOTS = 6;
let kbSlot = (() => { try { return Number(localStorage.getItem('kbSlot')) || 0; } catch (e) { return 0; } })();
function kbTeamBar() {
    const ts = (km && km.teams) || [];
    const btns = Array.from({ length: KB_SLOTS }, (_, i) => {
        const t = ts[i];
        return `<button type="button" class="kb-tslot ${i === kbSlot ? 'on' : ''} ${t && t.keys.length ? '' : 'empty'}" data-kbslot="${i}">${esc(t ? t.name : 'Team ' + (i + 1))}<small>${t ? t.keys.length : 0}/${KB_TEAM}</small></button>`;
    }).join('');
    return `<div class="kb-teambar"><span class="lbl">Teams</span>${btns}
        <button type="button" class="gold" data-kbsave="1" ${kbPick.team.length ? '' : 'disabled'} title="Save the picked cards into the selected slot">💾 Save</button>
        <button type="button" class="ghost" data-kbrename="1" title="Rename the selected slot">✏️</button></div>`;
}
// Slot laden: nur Karten, die man noch hat, jede Karte einmal
function kbLoadSlot(i) {
    const t = ((km && km.teams) || [])[i];
    kbSlot = i;
    try { localStorage.setItem('kbSlot', String(i)); } catch (e) { /* egal */ }
    if (!t) return;
    const have = (km && km.have) || {};
    const team = [];
    for (const k of t.keys) if (have[k] > 0 && !team.some(x => kmParse(x).id === kmParse(k).id)) team.push(k);
    kbPick.team = team.slice(0, KB_TEAM);
}
// Kampfkraft wie bei den Arenaleitern (km-gyms.js), Variante als Aufschlag
const kbPower = (c, v) => (c.bst.hp + 1.3 * Math.max(c.bst.atk, c.bst.spa) + 0.8 * (c.bst.def + c.bst.spd) + 0.9 * c.bst.spe) * kmLvMul(kmBestLv(kmKeyOf(c.id, v))) *
    (1 + (v.includes('s') ? 0.1 : 0) + (v.includes('m') ? 0.08 : v.includes('p') ? 0.03 : 0));
let kdForm = { stake: 0, target: '' };
let kdTimerEnd = 0;          // Zugzeit-Ende (Duell), lokal gerechnet
let kdInvites = [];          // Herausforderungen an mich { id, from, stake, at }
const KB_WEAK = 1.5, KB_DEF = 0.4;

function kbNewPlayer() {
    return { shown: null, queue: [], busy: false, log: [], result: null, fx: [], ticker: 0 };
}
const kbP = { gym: kbNewPlayer(), duel: kbNewPlayer() };

function kbGymOf(id) {
    return kb && (kb.gyms.find(g => g.id === id) || (kb.zones || []).find(z => z.id === id));
}

// Frischer Kampf: alle voll, kein Status, volle PP, erste Karte vorne
function kbFresh(view) {
    const v = JSON.parse(JSON.stringify(view));
    for (const s of v.sides) {
        s.active = 0;
        for (const c of s.cards) {
            Object.assign(c, { hp: c.maxHp, status: null, boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
            for (const m of c.moves) m.pp = m.ppMax;
        }
    }
    Object.assign(v, { over: false, need: null, waiting: false, needSwitch: false, foeSwitch: false, turn: 1 });
    return v;
}

// Neuer Stand vom Server in einen Abspieler (Arena oder Duell)
function kbFeed(bp, kind, d, view) {
    if (d.started) {
        const last = bp.lastTeam;
        Object.assign(bp, kbNewPlayer(), { lastTeam: last });
        bp.shown = kbFresh(view);
        kbPick = null;
    }
    if (d.result) {
        bp.result = d.result;
        // 6.7: neue XP holen (Level in Sammlung und Auswahl)
        if (d.result.xp && d.result.xp.length) wsSend({ type: 'kmState' });
    }
    if (view && !bp.shown) bp.shown = view;
    if (d.ev && d.ev.length) {
        bp.queue.push(...d.ev);
        if (!bp.busy) kbPlay(bp, kind);
    } else if (view && !bp.busy) bp.shown = view;
}

function kbVisible(tab) {
    return kmTab === tab && !$('kekemon').classList.contains('hidden');
}

function onKbState(d) {
    kb = d;
    if (km && d.frag !== undefined) km.frag = d.frag;
    kbFeed(kbP.gym, 'gym', d, d.battle ? d.battle.view : null);
    if (kbVisible('battle') && !kbP.gym.busy) kmDraw();
}

function onKdState(d) {
    const prev = kd;
    kd = d;
    const duel = d.duel || d.duelDone;
    if (duel) kdTimerEnd = Date.now() + (duel.turnLeft || 0);
    // Seite neu geladen, Duell laeuft: direkt in den Kampf
    if (!prev && d.duel && !d.started) kbP.duel.shown = d.duel.view;
    kbFeed(kbP.duel, 'duel', d, duel ? duel.view : null);
    if (d.info) showMsg('km-msg', d.info, 'err');
    // Team-Auswahl fuers Duell: Gegner hat angenommen
    if (d.mine && d.mine.picking && !d.mine.ready.me && !(kbPick && kbPick.duel)) kbPick = { duel: d.mine.id, team: [] };
    if (!d.mine && kbPick && kbPick.duel) kbPick = null;
    // Herausforderungen, die es nicht mehr gibt, ausblenden
    kdInvites = kdInvites.filter(i => d.open.some(o => o.id === i.id));
    kdInviteDraw();
    const inKm = !$('kekemon').classList.contains('hidden');
    // Kampf beginnt: wer in Kekemon ist, landet im Duell-Tab
    if (d.started && inKm && kmTab !== 'duel') {
        kmTab = 'duel';
        kmDraw();
    } else if (d.started && !inKm) toast('⚔️ Your Kekémon duel started – open 🃏 Kekémon');
    // Nicht beim Tippen im Formular neu zeichnen (Fokus ginge verloren)
    else if (kbVisible('duel') && !kbP.duel.busy && !['kd-stake', 'kd-target'].includes(document.activeElement && document.activeElement.id)) kmDraw();
}

function onKdInvite(d) {
    if (!kdInvites.some(i => i.id === d.id)) kdInvites.push({ id: d.id, from: d.from, stake: d.stake, at: Date.now() });
    kmSfx('fanfare', 'small');
    kdInviteDraw();
}

function onKdInfo(d) {
    toast(d.text);
    // Gegner hat angenommen: nur umschalten, wenn man eh in Kekemon ist –
    // aus einer laufenden Snake-Runde reissen wir niemanden
    if (d.go && !$('kekemon').classList.contains('hidden')) {
        kmTab = 'duel';
        kmDraw();
    }
}

// Herausforderung als Banner, egal in welcher Welt man gerade ist
function kdInviteDraw() {
    let el = $('kd-invite');
    if (!el) {
        el = document.createElement('div');
        el.id = 'kd-invite';
        document.body.appendChild(el);
        el.addEventListener('click', e => {
            const b = e.target.closest('[data-kdinv]');
            if (!b) return;
            const id = Number(b.dataset.id);
            kdInvites = kdInvites.filter(i => i.id !== id);
            kdInviteDraw();
            if (b.dataset.kdinv === 'yes') {
                wsSend({ type: 'kdJoin', id });
                kmOpen('duel');
            } else wsSend({ type: 'kdDecline', id });
        });
    }
    el.innerHTML = kdInvites.map(i => `<div class="kd-inv">⚔️ <b>${esc(i.from)}</b> challenges you to a Kekémon duel${i.stake ? ` · stake 🪙 ${i.stake.toLocaleString('en-US')}` : ''}
        <button type="button" class="gold" data-kdinv="yes" data-id="${i.id}">Accept</button><button type="button" class="ghost" data-kdinv="no" data-id="${i.id}">Decline</button></div>`).join('');
}

// ---------- Kampf 6.0 (nach Pokemon Showdown) ----------

// Teamgroesse (6.4: 5 gegen 5, wie km-battle.js TEAM_SIZE)
const KB_TEAM = 5;
const KB_ST = { brn: ['BRN', 'burned'], par: ['PAR', 'paralyzed'], psn: ['PSN', 'poisoned'], slp: ['SLP', 'asleep'] };
const KB_STAT = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const KB_STAT_LONG = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };
const KB_CAT = { phys: ['💥', 'Physical'], spec: ['🌀', 'Special'], status: ['✨', 'Status'] };

const kbStage = n => n >= 0 ? (2 + n) / 2 : 2 / (2 - n);
const kbEff = (a, d) => a && kmCat.chart[a] && kmCat.chart[a][d] !== undefined ? kmCat.chart[a][d] : 1;

// Schaden wie auf dem Server (km-battle.js calc), als Spanne min–max
function kbDmg(att, def, m) {
    if (!m.pow) return null;
    const e = kbEff(m.type, def.type);
    if (e === 0) return { e, lo: 0, hi: 0 };
    const phys = m.cat === 'phys';
    const A = att.st[phys ? 'atk' : 'spa'] * kbStage(att.boosts[phys ? 'atk' : 'spa']);
    const D = def.st[phys ? 'def' : 'spd'] * kbStage(def.boosts[phys ? 'def' : 'spd']);
    const base = Math.floor(Math.floor(22 * m.pow * A / D) / 50) + 2;
    let mod = (m.type === att.type ? 1.5 : 1) * e;
    if (phys && att.status === 'brn') mod *= 0.5;
    return { e, lo: Math.max(1, Math.floor(base * mod * 0.85)), hi: Math.max(1, Math.floor(base * mod)) };
}

function kbNm(v, s, c) {
    const card = c || v.sides[s].cards[v.sides[s].active];
    return (s === 1 ? 'The opposing ' : '') + kmCat.byId[card.id].name;
}

// Ein Ereignis nach dem anderen, mit Pause und Effekt
function kbPlay(bp, kind) {
    const tab = kind === 'gym' ? 'battle' : 'duel';
    const redraw = () => { if (kbVisible(tab)) kmDraw(); };
    if (!bp.queue.length) {
        bp.busy = false;
        bp.fx = [];
        const src = kind === 'gym' ? kb && kb.battle && kb.battle.view : kd && (kd.duel || kd.duelDone) && (kd.duel || kd.duelDone).view;
        if (src) bp.shown = src;
        redraw();
        return;
    }
    bp.busy = true;
    const e = bp.queue.shift();
    const v = bp.shown;
    const actv = s => v.sides[s].cards[v.sides[s].active];
    const foeName = v.sides[1].name;
    let wait = 120, anim = null;
    const log = (t, cls) => {
        bp.log.push({ t, cls: cls || '' });
        if (bp.log.length > 120) bp.log.shift();
        bp.ticker++;
    };
    const who = s => kbNm(v, s);
    switch (e.k) {
        case 'start':
            log(kind === 'gym' ? `Battle started against ${foeName}!` : `Battle started: you vs ${foeName}!`, 'head');
            break;
        case 'turn':
            log(`Turn ${e.n}`, 'turn');
            v.turn = e.n;
            wait = 200;
            break;
        case 'switch': {
            const side = v.sides[e.s];
            side.active = e.to;
            const c = actv(e.s);
            c.boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
            if (e.s === 0) v.needSwitch = false; else v.foeSwitch = false;
            log(e.s === 0 ? `Go! ${kmCat.byId[c.id].name}!` : `${foeName} sent out ${kmCat.byId[c.id].name}!`);
            anim = { s: e.s, text: '', cls: 'enter' };
            wait = 650;
            break;
        }
        case 'move':
            log(`${who(e.s)} used ${e.name}!`, 'move');
            anim = { s: e.s, from: e.s, text: '', cls: '' };
            wait = 550;
            break;
        case 'dmg': {
            const c = actv(e.s);
            const pct = Math.round(e.dmg / c.maxHp * 100);
            c.hp = e.hp;
            if (e.from === 'move') {
                if (e.crit) log('A critical hit!', 'crit');
                if (e.eff > 1) log("It's super effective!", 'good');
                else if (e.eff < 1) log("It's not very effective…", 'bad');
                log(`(${who(e.s)} lost ${Math.min(100, pct)}% of its health!)`, 'small');
                anim = { s: e.s, text: '−' + Math.min(100, pct) + '%', cls: e.eff > 1 || e.crit ? 'hit big' : 'hit' };
                if (e.eff > 1 || e.crit) kmSfx('fanfare', 'small'); else kmSfx('click');
                wait = 900;
            } else {
                log(e.from === 'brn' ? `${who(e.s)} was hurt by its burn!` : e.from === 'psn' ? `${who(e.s)} was hurt by poison!` : `${who(e.s)} was damaged by the recoil!`);
                anim = { s: e.s, text: '−' + Math.min(100, pct) + '%', cls: 'hit' };
                wait = 700;
            }
            break;
        }
        case 'heal':
            actv(e.s).hp = e.hp;
            log(e.why === 'drain' ? `${who(e.s)} drained some health!` : `${who(e.s)} restored its HP.`, 'good');
            anim = { s: e.s, text: '+' + Math.round(e.n / actv(e.s).maxHp * 100) + '%', cls: 'charge' };
            wait = 650;
            break;
        case 'boost': {
            const c = actv(e.s);
            c.boosts[e.stat] = e.now;
            const how = e.n >= 2 ? 'rose sharply!' : e.n > 0 ? 'rose!' : e.n <= -2 ? 'harshly fell!' : 'fell!';
            log(`${who(e.s)}'s ${KB_STAT_LONG[e.stat]} ${how}`);
            anim = { s: e.s, text: `${e.n > 0 ? '▲' : '▼'} ${KB_STAT[e.stat]}`, cls: 'charge' };
            kmSfx('charge');
            wait = 600;
            break;
        }
        case 'status': {
            actv(e.s).status = e.st;
            const txt = { brn: 'was burned!', par: 'is paralyzed! It may be unable to move!', psn: 'was poisoned!', slp: 'fell asleep!' }[e.st];
            log(`${who(e.s)} ${txt}`);
            anim = { s: e.s, text: KB_ST[e.st][0], cls: 'stun' };
            wait = 700;
            break;
        }
        case 'cure':
            actv(e.s).status = null;
            log(`${who(e.s)} woke up!`);
            wait = 500;
            break;
        case 'cant':
            log(e.why === 'slp' ? `${who(e.s)} is fast asleep.` : `${who(e.s)} is paralyzed! It can't move!`);
            anim = { s: e.s, text: e.why === 'slp' ? '💤' : '⚡', cls: 'stun' };
            wait = 700;
            break;
        case 'protect':
            log(`${who(e.s)} protected itself!`);
            anim = { s: e.s, text: '🛡️', cls: 'charge' };
            wait = 600;
            break;
        case 'blocked':
            log(`${who(e.s)} protected itself!`);
            anim = { s: e.s, text: '🛡️', cls: 'charge' };
            wait = 600;
            break;
        case 'fail':
            log('But it failed!', 'bad');
            wait = 450;
            break;
        case 'miss':
            log(`${who(1 - e.s)} avoided the attack!`, 'bad');
            anim = { s: 1 - e.s, text: 'MISS', cls: 'stun' };
            wait = 600;
            break;
        case 'immune':
            log(`It doesn't affect ${who(e.s)}…`, 'bad');
            wait = 600;
            break;
        case 'faint':
            actv(e.s).hp = 0;
            log(`${who(e.s)} fainted!`, 'faint');
            anim = { s: e.s, text: 'K.O.', cls: 'ko' };
            wait = 950;
            break;
        case 'choose':
            if (e.s === 0) v.needSwitch = true;
            else v.foeSwitch = true;
            break;
        case 'timeout-turn':
            log(e.s === 0 ? '⏰ You ran out of time – auto move' : `⏰ ${foeName} ran out of time – auto move`, 'small');
            break;
        case 'afk':
            log(e.s === 0 ? '💤 You missed 3 turns in a row' : `💤 ${foeName} missed 3 turns in a row`, 'bad');
            break;
        case 'forfeit':
            log(e.s === 1 ? `${foeName} forfeited.` : 'You forfeited.', 'head');
            break;
        case 'timeout':
            log('Turn limit reached – the side with more HP left wins', 'head');
            break;
        case 'end':
            v.over = true;
            v.winner = e.winner;
            log(e.winner === 0 ? 'You won the battle!' : `${foeName} won the battle!`, 'head');
            wait = 400;
            break;
    }
    bp.fx = anim ? [anim] : [];
    redraw();
    setTimeout(() => kbPlay(bp, kind), wait);
}

function kbStars(g) {
    // 6.8: nach Level, dazu ein Stern fuer die Ace League
    const n = Math.min(4, Math.ceil((g.lv || 5) / 12.5)) + (g.series === 'ace' ? 1 : 0);
    return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}

const KB_RULES = `<details class="kb-rules"><summary>📖 How battles work</summary><ul>
    <li>5 vs 5, like Pokémon Showdown. Each card has <b>4 moves</b> with type, power, accuracy and PP.</li>
    <li>Both sides choose at the same time: a move or a switch. Switches go first, then moves by <b>priority</b>, then by <b>Speed</b>.</li>
    <li><b>Types:</b> super effective ×2, not very effective ×½, some attacks don't affect a type at all. Moves of the card's own type get ×1.5 (STAB).</li>
    <li>💥 Physical moves use Attack vs Defense, 🌀 special moves use Sp. Atk vs Sp. Def. ✨ Status moves raise stats, heal, protect or inflict a status.</li>
    <li><b>Status:</b> burn (hurts each turn, halves physical damage), paralysis (slower, sometimes can't move), poison (hurts each turn), sleep (1–3 turns). Fire can't be burned, Electric can't be paralyzed, Steel can't be poisoned.</li>
    <li>Stat changes (▲▼) reset when a card switches out. Critical hits deal ×1.5. Pokéball +3 %, Masterball +8 %, Shiny +10 % HP and attack.</li>
</ul></details>`;

function kbDrawGyms() {
    const T = kmCat.types;
    const tile = g => {
        const t = g.type ? T[g.type] : null;
        const weakTo = t ? kmWeakTo(g.type).map(x => T[x]) : null;
        const team = g.team.map(id => kmCard(kmCat.byId[id], { mini: true, lv: g.lv, showLv: !!g.lv })).join('');
        return `<div class="kb-gym ${g.unlocked ? '' : 'locked'} ${g.cleared ? 'cleared' : ''}" style="--gc:${t ? t.color : '#ffd23f'}">
            <div class="kb-gym-head"><span class="ico">${g.icon}</span><div><b>${esc(g.name)}</b><small>Leader ${esc(g.leader)}${g.lv ? ` · <b class="kb-glv">Lv ${g.lv}</b>` : ''} · ${t ? t.icon + ' ' + t.name : '🌈 All types'} · <span class="kb-stars">${kbStars(g)}</span></small></div>
            ${g.cleared ? '<span class="kb-badge">✔ Cleared</span>' : ''}</div>
            <div class="kb-team">${g.unlocked ? team : `<div class="km-note">🔒 Beat ${esc((kbGymOf(g.after) || {}).name || 'the previous gym')} first</div>`}</div>
            <div class="kb-gym-foot">
                <span>${g.cleared ? `🪙 ${g.repeat.toLocaleString('en-US')} per win · ${g.rewardsLeft} left today` : g.paid ? `🪙 ${g.repeat.toLocaleString('en-US')} · first-clear reward already received` : `🪙 ${g.coins.toLocaleString('en-US')} + ${kmCat.packs[g.pack].icon} free ${esc(kmCat.packs[g.pack].name)}`}</span>
                ${weakTo ? `<span class="hint">Weak to ${weakTo.map(w => w.icon + ' ' + w.name).join(', ')}</span>` : ''}
                <button type="button" class="gold" data-kbgym="${g.id}" ${g.unlocked ? '' : 'disabled'}>⚔️ Challenge</button>
            </div>
        </div>`;
    };
    const tiles = kb.gyms.filter(g => g.series !== 'ace').map(tile).join('');
    const aces = kb.gyms.filter(g => g.series === 'ace').map(tile).join('');
    return KB_RULES.replace('</ul>', `<li>First win against a gym: coins + a free pack. After that 15 % of the coins, 3 times per gym and day.</li><li>Every card in your team earns XP for each foe you knock out – more for stronger foes, a bonus for winning. Higher level = more HP, attack, defense and speed.</li></ul>`) +
        kbDrawTrain() + `<h3 class="kd-h">🏟️ Type Gyms</h3><div class="kb-gyms">${tiles}</div>` +
        (aces ? `<h3 class="kd-h">🏆 Ace League</h3><div class="hint">Mixed teams built to cover each other, and trainers that think ahead. Same levels as the type gyms – much harder. Unlocks after Sprout Gym.</div><div class="kb-gyms kb-aces">${aces}</div>` : '');
}

// Training (6.7): wilde Teams, unbegrenzt, fuer XP; Coins und Teile fallen ab
function kbFragBox() {
    const f = (kb && kb.frag) ?? (km && km.frag) ?? 0, per = (kb && kb.fragPer) || (km && km.fragPer) || 10;
    return `<div class="kb-frag"><span class="ico">🧩</span><div><b>${f} / ${per} booster pieces</b><small>${per} pieces = 1 ${kmCat.packs.train ? esc(kmCat.packs.train.name) : 'booster'}</small>
        <span class="kb-fragbar"><i style="width:${Math.min(100, f / per * 100)}%"></i></span></div>
        <button type="button" class="gold" data-kmfrag="1" ${f >= per ? '' : 'disabled'}>🎁 Get booster</button></div>`;
}

function kbDrawTrain() {
    const zs = (kb && kb.zones) || [];
    if (!zs.length) return '';
    const R = kmCat.rarities, ri = kmCat.ridx;
    const tiles = zs.map(z => `<div class="kb-zone z-${z.id}">
        <div class="kb-gym-head"><span class="ico">${z.icon}</span><div><b>${esc(z.name)}</b><small>Wild Lv ${z.lv[0]}–${z.lv[1]} · ${z.rar.map(r => `<span style="color:${R[ri[r]].color}">${esc(R[ri[r]].name)}</span>`).join(' / ')}</small></div></div>
        <div class="kb-zone-rw"><span>✨ ~${z.xp} XP per card</span><span>🪙 ${z.coins.toLocaleString('en-US')}</span><span>🧩 ${z.fragChance >= 1 ? '+' + z.frag : Math.round(z.fragChance * 100) + ' % for +' + z.frag}</span></div>
        <button type="button" class="gold" data-kbgym="${z.id}">🌿 Train</button>
    </div>`).join('');
    const full = zs[0].full;
    return `<h3 class="kd-h">🌿 Training</h3>
        <div class="hint">Unlimited fights against wild teams around your own level. XP for every foe you knock out${full ? '' : ' – coins and pieces are lower for the rest of today'}.</div>
        <div class="kb-zones">${tiles}</div>${kbFragBox()}`;
}

// Team-Auswahl, fuer Arena (mit Typ-Hinweisen) und Duell
function kbDrawPick() {
    const g = kbPick.gym ? kbGymOf(kbPick.gym) : null;
    const own = kmOwn();
    const T = kmCat.types;
    const t = g && g.type ? T[g.type] : null;
    // Jede Variante einzeln waehlbar, staerkste zuerst
    const list = [];
    for (const [id, o] of Object.entries(own)) {
        const c = kmCat.byId[id];
        if (!c) continue;
        for (const v of Object.keys(o.vars)) list.push({ c, v, key: kmKeyOf(id, v) });
    }
    // Sortieren und nach Typ filtern
    const match = x => !t ? 0 : (kbEff(x.c.type, g.type) > 1 ? 2 : 0) + (x.c.moves.some(m => m.pow && kbEff(m.type, g.type) > 1) ? 1 : 0) - (kbEff(g.type, x.c.type) > 1 ? 2 : 0);
    const byPower = (a, b) => kbPower(b.c, b.v) - kbPower(a.c, a.v);
    const sorters = {
        power: byPower,
        rarity: (a, b) => kmCat.ridx[b.c.rarity] - kmCat.ridx[a.c.rarity] || byPower(a, b),
        match: (a, b) => match(b) - match(a) || byPower(a, b),
        type: (a, b) => a.c.type.localeCompare(b.c.type) || byPower(a, b),
        name: (a, b) => a.c.name.localeCompare(b.c.name) || kmVRank(b.v) - kmVRank(a.v),
        speed: (a, b) => b.c.bst.spe - a.c.bst.spe || byPower(a, b)
    };
    const sortKey = sorters[kbSort] && (kbSort !== 'match' || t) ? kbSort : 'power';
    list.sort(sorters[sortKey]);
    const typesHave = [...new Set(list.map(x => x.c.type))].sort();
    const shown = kbTypeFilter && typesHave.includes(kbTypeFilter) ? list.filter(x => x.c.type === kbTypeFilter) : list;
    const chosen = kbPick.team;
    const slots = Array.from({ length: KB_TEAM }, (_, i) => i).map(i => {
        const k = chosen[i];
        if (!k) return '<div class="kb-slot empty">?</div>';
        const { id, v } = kmParse(k);
        return `<div class="kb-slot" data-kbunpick="${i}">${kmCard(kmCat.byId[id], { mini: true, v, lv: kmBestLv(k), showLv: true })}</div>`;
    }).join('');
    const grid = shown.map(x => {
        const on = chosen.includes(x.key);
        const blocked = !on && chosen.some(k => kmParse(k).id === x.c.id);
        // Typ-Tabelle 6.0: eigene Attacken treffen den Leiter-Typ stark / Leiter trifft uns stark
        const good = t && kbEff(x.c.type, g.type) > 1;
        const bad = t && kbEff(g.type, x.c.type) > 1;
        return `<div class="kb-cand ${on ? 'on' : ''} ${blocked ? 'off' : ''}" data-kbpick="${esc(x.key)}">${kmCard(x.c, { mini: true, v: x.v, lv: kmBestLv(x.key), showLv: true })}${good ? '<span class="kb-tag good">Strong</span>' : bad ? '<span class="kb-tag bad">Weak</span>' : ''}</div>`;
    }).join('');
    let head, go, sub;
    if (g && g.train) {
        head = `<button type="button" class="ghost" id="kb-back">← Back</button>
            <b>${g.icon} ${esc(g.name)}</b> <span class="hint">Wild teams Lv ${g.lv[0]}–${g.lv[1]}, matched to your team's level · random types</span>`;
        go = `<button type="button" class="gold" id="kb-fight" ${chosen.length === KB_TEAM ? '' : 'disabled'}>🌿 Train!</button>`;
        sub = `Pick ${KB_TEAM} different cards. All five earn XP for every foe you knock out (~${g.xp} for a full win).`;
    } else if (g && g.series === 'ace') {
        head = `<button type="button" class="ghost" id="kb-back">← Gyms</button>
            <b>${g.icon} ${esc(g.name)}</b> <span class="hint">${esc(g.leader)} · mixed team Lv ${g.lv} · plans ahead</span>`;
        go = `<button type="button" class="gold" id="kb-fight" ${chosen.length === KB_TEAM ? '' : 'disabled'}>⚔️ Fight!</button>`;
        sub = `Pick ${KB_TEAM} different cards. The first one starts.`;
    } else if (g) {
        head = `<button type="button" class="ghost" id="kb-back">← Gyms</button>
            <b>${g.icon} ${esc(g.name)}</b> <span class="hint">${t ? `Leader uses ${t.icon} ${t.name} – ${kmWeakTo(g.type).map(x => T[x].icon + ' ' + T[x].name).join(', ')} moves hit it ×2` : 'The champion uses every type'}</span>`;
        go = `<button type="button" class="gold" id="kb-fight" ${chosen.length === KB_TEAM ? '' : 'disabled'}>⚔️ Fight!</button>`;
        sub = `Pick ${KB_TEAM} different cards. The first one starts.`;
    } else {
        const l = kd && kd.mine;
        const foe = l ? (l.mine ? l.guest : l.host) : '?';
        const secs = l ? Math.ceil(l.pickLeft / 1000) : 0;
        head = `<button type="button" class="ghost" id="kd-leave">✖ Leave duel</button>
            <b>⚔️ Duel vs ${esc(foe)}</b> <span class="hint">${l && l.stake ? `Stake 🪙 ${l.stake.toLocaleString('en-US')} each – winner takes ${(l.stake * 2).toLocaleString('en-US')}` : 'No stake – just rating'} · ${secs} s to pick</span>`;
        go = `<button type="button" class="gold" id="kd-ready" ${chosen.length === KB_TEAM ? '' : 'disabled'}>✔ Ready</button>`;
        sub = `Pick ${KB_TEAM} different cards. The first one starts. You don't see ${esc(foe)}'s team until the fight.`;
    }
    return `<div class="kb-pick-head">${head}</div>
        ${kbTeamBar()}
        <div class="kb-slots">${slots}${go}</div>
        <div class="hint">${sub}</div>
        <div class="kb-sortbar">
            <label>Sort <select id="kb-sort">${[['power', '💪 Strongest'], ...(t ? [['match', '🎯 Best vs this gym']] : []), ['rarity', '💎 Rarity'], ['speed', '⚡ Speed'], ['type', '🏷️ Type'], ['name', '🔤 Name']]
        .map(([k, l]) => `<option value="${k}" ${k === sortKey ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label>Type <select id="kb-type"><option value="">All</option>${typesHave.map(k => `<option value="${k}" ${k === kbTypeFilter ? 'selected' : ''}>${T[k].icon} ${T[k].name}</option>`).join('')}</select></label>
            <span class="hint">${shown.length} cards</span>
        </div>
        <div class="km-grid">${grid || '<div class="km-note" style="grid-column:1/-1">You need cards first – open packs in 📦 Packs.</div>'}</div>`;
}

// Anzeige einer Seite: aktive Karte + Infokasten (Showdown-artig)
function kbSide(bp, s) {
    const v = bp.shown;
    const side = v.sides[s];
    const act = side.cards[side.active];
    const c = kmCat.byId[act.id];
    const T = kmCat.types;
    const fx = bp.fx.find(f => f.s === s && f.cls);
    const lunge = bp.fx.find(f => f.from === s);
    const pct = Math.max(0, act.hp / act.maxHp * 100);
    const boosts = Object.entries(act.boosts || {}).filter(([, n]) => n)
        .map(([k, n]) => `<span class="kb-chip ${n > 0 ? 'up' : 'down'}">${(n > 0 ? '+' : '') + n} ${KB_STAT[k]}</span>`).join('');
    const st = act.status ? `<span class="kb-stat st-${act.status}">${KB_ST[act.status][0]}</span>` : '';
    // Team als Punkte (wie die Baelle in Showdown)
    const dots = side.cards.map((x, i) => `<i class="${x.hp <= 0 ? 'ko' : x.status ? 'st' : ''} ${i === side.active ? 'on' : ''}" title="${esc(kmCat.byId[x.id].name)}"></i>`).join('');
    const hpTxt = s === 0 ? `${Math.max(0, act.hp)} / ${act.maxHp}` : `${Math.ceil(pct)}%`;
    const turn = !v.over && (s === 0 ? v.need : v.waiting || v.foeSwitch);
    return `<div class="kb-side s${s} ${turn ? 'turn' : ''}">
        <div class="kb-act ${act.hp <= 0 ? 'dead' : ''} ${fx ? fx.cls : ''} ${lunge ? 'lunge' : ''}">
            ${kmCard(c, { v: act.v, mini: true })}
            ${fx && fx.text ? `<span class="kb-float ${fx.cls}">${fx.text}</span>` : ''}
        </div>
        <div class="kb-info">
            <div class="kb-who">${s === 0 ? '🧑' : bp === kbP.gym ? '🏟️' : '⚔️'} ${esc(side.name)} <span class="kb-dots">${dots}</span></div>
            <div class="kb-nm"><b>${esc(c.name)}</b> <span class="kb-lvt">Lv ${act.lv || 1}</span> <span class="kb-type" style="--tc:${T[c.type].color}">${T[c.type].icon}<span class="tn"> ${T[c.type].name}</span></span> ${st}</div>
            <div class="kb-hp ${pct < 20 ? 'low' : pct < 50 ? 'mid' : ''}"><i style="width:${pct}%"></i><span>${hpTxt}</span></div>
            ${boosts ? `<div class="kb-status">${boosts}</div>` : ''}
        </div>
    </div>`;
}

// Knopf fuer eine Attacke (mit Vorschau gegen die aktive Gegnerkarte)
function kbMoveBtn(me, foe, m, i) {
    const T = kmCat.types[m.type] || { color: '#999', icon: '•', name: '???' };
    const d = kbDmg(me, foe, m);
    let hint = '';
    if (d) {
        const lo = Math.min(100, Math.round(d.lo / foe.maxHp * 100)), hi = Math.min(100, Math.round(d.hi / foe.maxHp * 100));
        const lbl = d.e === 0 ? 'No effect' : d.e > 1 ? 'Super effective' : d.e < 1 ? 'Not very effective' : '';
        hint = d.e === 0 ? `<em class="e0">No effect</em>` : `<em class="${d.e > 1 ? 'e2' : d.e < 1 ? 'e5' : ''}">${lbl ? lbl + ' · ' : ''}${lo === hi ? lo : lo + '–' + hi}%${d.lo >= foe.hp ? ' · KO' : ''}</em>`;
    } else hint = `<em>${esc(m.desc || 'Status move')}</em>`;
    const ok = m.pp > 0;
    return `<button type="button" class="kb-move ${ok ? '' : 'no'}" style="--tc:${T.color}" data-kbatk="${i}" ${ok ? '' : 'disabled'} title="${esc(m.desc || '')}">
        <b>${esc(m.name)}</b>
        <span class="meta">${T.icon} ${KB_CAT[m.cat][0]} ${m.pow ? m.pow : '—'}${m.acc ? ` · ${m.acc}%` : ''}${m.pri > 0 && m.pow ? ' · +' + m.pri : ''}</span>
        <span class="pp">${m.pp}/${m.ppMax}</span>
        ${hint}
    </button>`;
}

// Der Kampf-Bildschirm. kind: 'gym' | 'duel'
function kbDrawBattle(bp, kind) {
    const v = bp.shown;
    let title, color;
    const foeLabel = v.sides[1].name;
    if (kind === 'gym') {
        const gym = kbGymOf(kb.battle ? kb.battle.gym : bp.result ? bp.result.gym : null) || kb.gyms[0];
        const t = gym.type ? kmCat.types[gym.type] : null;
        if (gym.train) color = '#7dffb0';
        title = `${gym.icon} ${esc(gym.name)}`;
        color = color || (t ? t.color : '#ffd23f');
    } else {
        const d = kd.duel || kd.duelDone || {};
        title = `⚔️ vs ${esc(foeLabel)}${d.foeRating ? ` <small>(${d.foeRating})</small>` : ''}${d.stake ? ` · <span class="kb-pot">🪙 ${(d.stake * 2).toLocaleString('en-US')}</span>` : ''}`;
        color = '#ff5bd6';
    }
    const myTurn = !v.over && !bp.busy && !!v.need;
    let turnTxt;
    if (v.over) turnTxt = v.winner === 0 ? '🏆 You won' : '💀 You lost';
    else if (bp.busy) turnTxt = `Turn ${v.turn}`;
    else if (v.need === 'switch') turnTxt = '🔁 Choose your next card';
    else if (v.need) turnTxt = `🟢 Turn ${v.turn} – your move`;
    else turnTxt = `⏳ Waiting for ${esc(foeLabel)}…`;
    const timer = kind === 'duel' && !v.over ? `<span class="kb-timer" id="kd-timer"></span>` : '';

    const mine = v.sides[0];
    const me = mine.cards[mine.active], foe = v.sides[1].cards[v.sides[1].active];
    const switches = (label) => {
        const btns = mine.cards.map((x, i) => {
            if (i === mine.active && x.hp > 0) return '';
            const cc = kmCat.byId[x.id];
            const T = kmCat.types[cc.type];
            const ok = x.hp > 0;
            return `<button type="button" class="kb-sw" ${ok ? `data-kbsw="${i}"` : 'disabled'} style="--tc:${T.color}">
                <span class="ico">${T.icon}</span><span class="nm">${esc(cc.name)}</span>
                <span class="kb-mhp"><i style="width:${Math.max(0, x.hp) / x.maxHp * 100}%"></i></span>
                <small>${ok ? `${x.hp}/${x.maxHp}${x.status ? ' · ' + KB_ST[x.status][0] : ''}` : 'fainted'}</small></button>`;
        }).join('');
        return btns ? `<div class="kb-swrow"><span class="lbl">${label}</span>${btns}</div>` : '';
    };

    let bar = '';
    if (v.over && !bp.busy) {
        const r = bp.result || { win: v.winner === 0 };
        let line;
        if (kind === 'gym' && r.train) line = r.win ? `${r.coins ? `+🪙 ${r.coins.toLocaleString('en-US')}` : 'no coins'}${r.frag ? ` · 🧩 +${r.frag} booster piece${r.frag > 1 ? 's' : ''} (${r.fragTotal})` : ''} · win ${r.today} today` : (r.xp && r.xp.length ? 'Lost – your cards still learned from the foes they beat.' : 'Lost – no foe knocked out, no XP.');
        else if (kind === 'gym') line = r.win ? `${r.coins ? `+🪙 ${r.coins.toLocaleString('en-US')}` : 'No coins left from this gym today'}${r.first ? (r.already ? ' · gym cleared again (first-clear reward was paid before)' : ' · first clear!') : ''}` : 'Try another team – type matchups matter.';
        else line = `${r.stake ? (r.win ? `+🪙 ${r.pot.toLocaleString('en-US')}` : `−🪙 ${r.stake.toLocaleString('en-US')}`) + ' · ' : ''}rating ${r.rating || '?'} (${r.delta >= 0 ? '+' : ''}${r.delta || 0})`;
        // 6.7: XP je Karte, Level-ups hervorgehoben
        const xpLine = (r.xp || []).length ? `<div class="kb-xp">${r.xp.map(x => {
            const nm = esc((kmCat.byId[kmParse(x.key).id] || {}).name || '?');
            return `<span class="${x.to > x.from ? 'up' : ''}">${nm} +${x.xp} XP${x.to > x.from ? ` · ⬆ Lv ${x.from} → ${x.to}` : ''}</span>`;
        }).join('')}</div>` : '';
        bar = `<div class="kb-result ${r.win ? 'win' : 'lose'}">
            <div class="big">${r.win ? '🏆 VICTORY' : '💀 DEFEAT'}</div><div>${line}</div>${xpLine}
            <div class="kb-result-btns">${r.pack ? `<button type="button" class="gold" id="kb-openpack">🎁 Free ${esc(kmCat.packs[r.pack.pack].name)} added – go to 📦 Packs</button>` : ''}
            ${kind === 'gym' && r.train ? `<button type="button" class="gold" id="kb-again">🌿 Again</button>` : ''}<button type="button" id="${kind === 'gym' ? 'kb-done' : 'kd-done'}">${kind === 'gym' ? 'Back to gyms' : 'Back to duels'}</button></div>
        </div>`;
    } else if (myTurn && v.need === 'switch') {
        bar = `<div class="kb-ask">${esc(kmCat.byId[me.id].name)} fainted – who's next?</div>` + switches('Switch in:');
    } else if (myTurn) {
        const noPP = me.moves.every(m => m.pp <= 0);
        const moves = noPP ? `<button type="button" class="kb-move" data-kbatk="-1"><b>Struggle</b><span class="meta">No PP left – hurts itself</span></button>`
            : me.moves.map((m, i) => kbMoveBtn(me, foe, m, i)).join('');
        bar = `<div class="kb-ask">What will <b>${esc(kmCat.byId[me.id].name)}</b> do?</div>
            <div class="kb-moves">${moves}</div>${switches('Switch:')}`;
    } else if (!v.over) {
        bar = `<div class="kb-hintbig wait">${bp.busy ? '…' : v.foeSwitch ? `${esc(foeLabel)} is choosing the next card…` : `Waiting for ${esc(foeLabel)}…`}</div>`;
    }
    const logHtml = bp.log.slice().reverse().map(l => `<div class="${l.cls}">${esc(l.t)}</div>`).join('');
    const last = bp.log.filter(l => l.cls !== 'turn' && l.cls !== 'small').slice(-1)[0];
    return `<div class="kb-arena" style="--gc:${color}">
        <div class="kb-top"><span class="kb-title">${title}</span><span class="kb-turn ${myTurn ? 'me' : ''}">${turnTxt}${timer}</span>
            <span class="kb-round">${!v.over ? `<button type="button" class="kb-ff" data-kbff="${kind}" title="Forfeit">🏳️</button>` : ''}</span></div>
        <div class="kb-main">
            <div class="kb-field">
                ${kbSide(bp, 1)}
                <div class="kb-ticker" data-n="${bp.ticker}">${last ? esc(last.t) : ''}</div>
                ${kbSide(bp, 0)}
            </div>
            <div class="kb-logpane" id="kb-logpane">${logHtml}</div>
        </div>
        <div class="kb-bar">${bar}</div>
        <details class="kb-logbox"><summary>📜 Battle log</summary>${bp.log.slice().reverse().map(l => `<div class="${l.cls}">${esc(l.t)}</div>`).join('')}</details>
    </div>`;
}

function kmDrawBattleTab() {
    if (!kb) {
        wsSend({ type: 'kbGyms' });
        return '<div class="km-note">Loading gyms…</div>';
    }
    const bp = kbP.gym;
    if (bp.shown && (kb.battle || bp.busy || bp.result)) return kbDrawBattle(bp, 'gym');
    if (kbPick && kbPick.gym) return kbDrawPick();
    return kbDrawGyms();
}

// ---------- Duelle (5.10) ----------

function kdDrawLobby() {
    const m = kd.me;
    const lob = kd.mine;
    const games = m.wins + m.losses;
    const head = `<div class="kd-me">
        <div><b>⚔️ Kekémon duels</b><small>Fight other players with your cards. Same rules as the gyms, 45 s per turn.</small></div>
        <div class="kd-stat"><b>${m.rating}</b><small>rating</small></div>
        <div class="kd-stat"><b>${m.wins}–${m.losses}</b><small>won–lost</small></div>
        <div class="kd-stat"><b class="${(m.won || 0) >= 0 ? 'pos' : 'neg'}">${(m.won || 0) >= 0 ? '+' : ''}${(m.won || 0).toLocaleString('en-US')}</b><small>coins from duels</small></div>
    </div>`;
    let create;
    if (lob) {
        create = `<div class="kd-box mine">
            <div>⏳ <b>Your duel is open</b>${lob.target ? ` – waiting for <b>${esc(lob.target)}</b>` : ' – anyone can accept'} · ${lob.stake ? `stake 🪙 ${lob.stake.toLocaleString('en-US')}` : 'no stake'}</div>
            <button type="button" class="ghost" id="kd-cancel">Close</button></div>`;
    } else {
        const opts = kd.online.map(n => `<option value="${esc(n)}"></option>`).join('');
        create = `<div class="kd-box">
            <div class="kd-form">
                <label>Stake <input id="kd-stake" type="number" min="0" max="100000" step="500" value="${kdForm.stake}"><small>each player pays it, the winner takes both (max 100k)</small></label>
                <label>Opponent <input id="kd-target" list="kd-online" placeholder="anyone" maxlength="16" value="${esc(kdForm.target)}"><datalist id="kd-online">${opts}</datalist><small>empty = open duel for everyone</small></label>
                <button type="button" class="gold" id="kd-create">⚔️ ${kdForm.target ? 'Challenge' : 'Open duel'}</button>
            </div>
            ${kd.online.length ? `<div class="kd-online"><small>Online now:</small> ${kd.online.slice(0, 20).map(n => `<button type="button" class="kd-chip" data-kdto="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
        </div>`;
    }
    const open = kd.open.map(o => `<div class="kd-row ${o.forMe ? 'forme' : ''}">
        <span class="who"><b>${esc(o.host)}</b> <small>(${o.rating})</small>${o.forMe ? ' <span class="kb-chip boost">challenges you</span>' : ''}</span>
        <span class="stake">${o.stake ? `🪙 ${o.stake.toLocaleString('en-US')}` : 'no stake'}</span>
        <span class="btns">${o.forMe ? `<button type="button" class="ghost" data-kddecline="${o.id}">Decline</button>` : ''}<button type="button" class="gold" data-kdjoin="${o.id}" ${lob ? 'disabled' : ''}>Accept</button></span>
    </div>`).join('');
    return head + create +
        `<h3 class="kd-h">Open duels</h3><div class="kd-list">${open || '<div class="hint">No open duels right now – open one yourself!</div>'}</div>` +
        (games ? '' : '<div class="hint">Tip: gym battles are good practice. Type advantage (×1.5) wins most fights.</div>') + KB_RULES;
}

function kmDrawDuelTab() {
    if (!kd) {
        wsSend({ type: 'kdState' });
        return '<div class="km-note">Loading duels…</div>';
    }
    const bp = kbP.duel;
    if (bp.shown && (kd.duel || bp.busy || bp.result)) return kbDrawBattle(bp, 'duel');
    if (kd.mine && kd.mine.picking) {
        if (kd.mine.ready.me) {
            return `<div class="kd-box mine"><div>✔ <b>You are ready.</b> Waiting for ${esc(kd.mine.mine ? kd.mine.guest : kd.mine.host)} to pick a team… (${Math.ceil(kd.mine.pickLeft / 1000)} s)</div>
                <button type="button" class="ghost" id="kd-leave">✖ Leave duel</button></div>`;
        }
        if (!kbPick || !kbPick.duel) kbPick = { duel: kd.mine.id, team: [] };
        return kbDrawPick();
    }
    return kdDrawLobby();
}

// Lobby offen: alle 10 s frisch holen (wer ist online, offene Duelle)
setInterval(() => {
    if (kd && kbVisible('duel') && !kd.duel && !kbP.duel.shown && !(kd.mine && kd.mine.picking)) wsSend({ type: 'kdState' });
}, 10000);

// Zugzeit im Duell herunterzaehlen, ohne alles neu zu zeichnen
setInterval(() => {
    const el = $('kd-timer');
    if (!el) return;
    const s = Math.max(0, Math.ceil((kdTimerEnd - Date.now()) / 1000));
    el.textContent = ` · ${s} s`;
    el.classList.toggle('low', s <= 10);
}, 250);

// ---------- Eingaben (Arena und Duell) ----------

$('km-body').addEventListener('click', e => {
    if (kmTab !== 'battle' && kmTab !== 'duel') return;
    const t = e.target.closest('[data-kbgym],[data-kbpick],[data-kbunpick],[data-kbatk],[data-kbsw],[data-kbff],[data-kdjoin],[data-kddecline],[data-kdto],#kb-back,#kb-fight,#kb-done,#kb-again,[data-kmfrag],[data-kbslot],[data-kbsave],[data-kbrename],#kb-openpack,#kd-create,#kd-cancel,#kd-leave,#kd-ready,#kd-done');
    if (!t) return;
    e.stopPropagation();
    const ds = t.dataset;
    const duel = kmTab === 'duel';
    const bp = duel ? kbP.duel : kbP.gym;
    const act = o => wsSend({ type: duel ? 'kdAct' : 'kbAct', ...o });
    if (ds.kbgym) { kbPick = { gym: ds.kbgym, team: [] }; return kmDraw(); }
    if (t.id === 'kb-back') { kbPick = null; return kmDraw(); }
    if (ds.kbpick) {
        const k = ds.kbpick, team = kbPick.team;
        const i = team.indexOf(k);
        if (i >= 0) team.splice(i, 1);
        else if (team.length < KB_TEAM && !team.some(x => kmParse(x).id === kmParse(k).id)) team.push(k);
        return kmDraw();
    }
    if (ds.kbunpick !== undefined) { kbPick.team.splice(Number(ds.kbunpick), 1); return kmDraw(); }
    if (t.id === 'kb-fight') { kbP.gym.lastTeam = kbPick.team.slice(); return wsSend({ type: 'kbStart', gym: kbPick.gym, team: kbPick.team }); }
    if (t.id === 'kd-ready') return wsSend({ type: 'kdTeam', team: kbPick.team });
    if (t.id === 'kd-leave') { uiConfirm('Leave this duel?', { ok: 'Leave', danger: true }).then(ok => { if (ok) { kbPick = null; wsSend({ type: 'kdCancel' }); } }); return; }
    if (t.id === 'kd-cancel') return wsSend({ type: 'kdCancel' });
    if (ds.kdto) { kdForm.target = ds.kdto; return kmDraw(); }
    if (t.id === 'kd-create') {
        kdForm.stake = Math.max(0, Math.floor(Number($('kd-stake').value) || 0));
        kdForm.target = $('kd-target').value.trim();
        return wsSend({ type: 'kdCreate', stake: kdForm.stake, target: kdForm.target || undefined });
    }
    if (ds.kdjoin) return wsSend({ type: 'kdJoin', id: Number(ds.kdjoin) });
    if (ds.kddecline) return wsSend({ type: 'kdDecline', id: Number(ds.kddecline) });
    if (ds.kbff) { uiConfirm(duel && kd.duel && kd.duel.stake ? `You lose your stake of ${kd.duel.stake.toLocaleString('en-US')} coins.` : 'This battle counts as lost.', { title: 'Give up?', ok: 'Give up', danger: true }).then(ok => ok && act({ a: 'forfeit' })); return; }
    if (t.id === 'kb-openpack') {
        Object.assign(kbP.gym, kbNewPlayer());
        wsSend({ type: 'kbGyms' });
        kmTab = 'packs';
        wsSend({ type: 'kmState' });
        return kmDraw();
    }
    if (ds.kmfrag) return wsSend({ type: 'kmFragBuy', n: 1 });
    if (ds.kbslot !== undefined && kbPick) { kbLoadSlot(Number(ds.kbslot)); return kmDraw(); }
    if (ds.kbsave && kbPick) {
        const cur = ((km && km.teams) || [])[kbSlot];
        return wsSend({ type: 'kmTeamSave', slot: kbSlot, name: cur ? cur.name : 'Team ' + (kbSlot + 1), keys: kbPick.team });
    }
    if (ds.kbrename) {
        const cur = ((km && km.teams) || [])[kbSlot];
        uiPrompt('Name for this team slot:', cur ? cur.name : 'Team ' + (kbSlot + 1), { title: 'Rename team', ok: 'Save' }).then(name => {
            if (name !== null) wsSend({ type: 'kmTeamSave', slot: kbSlot, name: name.trim(), keys: cur ? cur.keys : kbPick ? kbPick.team : [] });
        });
        return;
    }
    if (t.id === 'kb-again') {
        // Gleiches Team nochmal
        const last = kbP.gym.lastTeam, zone = kbP.gym.result && kbP.gym.result.gym;
        Object.assign(kbP.gym, kbNewPlayer());
        if (last && zone) { kbP.gym.lastTeam = last; wsSend({ type: 'kbStart', gym: zone, team: last }); }
        return kmDraw();
    }
    if (t.id === 'kb-done') { Object.assign(kbP.gym, kbNewPlayer()); wsSend({ type: 'kbGyms' }); return kmDraw(); }
    if (t.id === 'kd-done') { Object.assign(kbP.duel, kbNewPlayer()); if (kd) kd.duelDone = null; wsSend({ type: 'kdState' }); return kmDraw(); }
    if (bp.busy) return;
    if (ds.kbatk !== undefined) return act({ a: 'move', i: Number(ds.kbatk) });
    if (ds.kbsw !== undefined) return act({ a: 'switch', to: Number(ds.kbsw) });
}, true);

// Eingaben im Duell-Formular merken, damit ein Neuzeichnen sie nicht verwirft
$('km-body').addEventListener('input', e => {
    if (e.target.id === 'kd-stake') kdForm.stake = e.target.value;
    if (e.target.id === 'kd-target') {
        kdForm.target = e.target.value;
        const b = $('kd-create');
        if (b) b.textContent = '⚔️ ' + (kdForm.target.trim() ? 'Challenge' : 'Open duel');
    }
});

// Sortierung/Filter der Team-Auswahl (6.5)
document.addEventListener('change', e => {
    if (e.target.id === 'kb-sort') {
        kbSort = e.target.value;
        try { localStorage.setItem('kbSort', kbSort); } catch (err) { /* egal */ }
        kmDraw();
    } else if (e.target.id === 'kb-type') {
        kbTypeFilter = e.target.value;
        kmDraw();
    }
});
