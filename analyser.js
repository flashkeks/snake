// Analyser (6.12, Max): im Markt eigene Sachen genau ansehen – vor allem, wie
// selten genau diese Kombination ist (z. B. Arena-Item mit 2 Effekten, einer
// davon Stufe 2) und wie viele es davon auf dem Server gibt.
//
// Ergebnis ist darstellungsneutral: { title, icon, tier, lines: [[Label, Wert]],
// sections: [{ title, rows: [[Label, Wert, Hinweis?]] }], odds (1 in N) }.
// Alle Wahrscheinlichkeiten kommen aus denselben Tabellen, mit denen das Spiel wuerfelt.

const I = require('./arena-items');
const K = require('./cards');
const shop = require('./shop');

const oneIn = p => p > 0 ? Math.max(1, Math.round(1 / p)) : Infinity;
const fmtIn = p => p >= 0.1 ? `${(p * 100).toFixed(p >= 0.995 ? 0 : 1)} %` : p > 0 ? `1 in ${oneIn(p).toLocaleString('en-US')}` : '–';

// ---------- Arena-Items ----------

// Wahrscheinlichkeit, dass pickBase genau diese Basis zieht, wenn die Stufe feststeht
function baseChance(kind, base, tierIdx) {
    const defs = kind === 'weapon' ? I.WEAPONS : kind === 'armor' ? I.ARMORS : kind === 'util' ? I.UTILS : I.PACKS;
    const all = Object.entries(defs).filter(([, b]) => b.tier <= tierIdx && (kind === 'util' || kind === 'pack' || I.maxTierOf(b) >= tierIdx));
    const w = ([, b]) => Math.pow(4, b.tier) * (b.unique ? 0.12 : 1);
    const sum = all.reduce((s, e) => s + w(e), 0);
    const me = all.find(([k]) => k === base);
    return me && sum ? w(me) / sum : 0;
}

// Genau diese Effekte (Menge) in beliebiger Zieh-Reihenfolge, ohne Zuruecklegen
function effectSetChance(defs, ids) {
    const W = Object.values(defs).reduce((s, m) => s + m.w, 0);
    const perms = [];
    const permute = (rest, acc) => { if (!rest.length) perms.push(acc); rest.forEach((x, i) => permute(rest.filter((_, j) => j !== i), [...acc, x])); };
    permute(ids, []);
    let total = 0;
    for (const order of perms) {
        let p = 1, left = W;
        for (const id of order) { p *= defs[id].w / left; left -= defs[id].w; }
        total += p;
    }
    return total;
}

function levelChance(m, lvl) {
    const sum = Array.from({ length: m.max }, (_, i) => Math.pow(m.decay, i)).reduce((a, b) => a + b, 0);
    return Math.pow(m.decay, lvl - 1) / sum;
}

function analyseItem(it, users) {
    const kind = it.kind, t = I.TIER_IDX[it.tier] || 0, tierName = I.TIERS[t].name;
    const defs = kind === 'weapon' ? I.WEAPONS : kind === 'armor' ? I.ARMORS : kind === 'util' ? I.UTILS : I.PACKS;
    const b = defs[it.base] || {};
    const mdefs = kind === 'armor' ? I.ARMOR_MODS : I.WEAPON_MODS;
    // Drop-Chance immer vom Original (vor dem ersten Fuse); was Fuse draufgelegt
    // hat, steht als eigener Abschnitt darunter
    const now = (it.mods || []).filter(m => mdefs[m.id]);
    const mods = Array.isArray(it.drop) ? it.drop.filter(m => mdefs[m.id]) : now;
    const pTier = 1 / I.TIER_ODDS[t];
    const gear = kind === 'weapon' || kind === 'armor';
    const pBase = gear ? baseChance(kind, it.base, t) : 1;
    const pN = gear ? (I.EFFECT_N[mods.length] || 0) : 1;
    const pSet = mods.length ? effectSetChance(mdefs, mods.map(m => m.id)) : 1;
    const lv = mods.map(m => levelChance(mdefs[m.id], m.lvl));
    const pLv = lv.reduce((a, b) => a * b, 1);
    const pAll = pTier * pBase * pN * pSet * pLv;

    const rows = [
        [`Rarity: ${tierName}`, fmtIn(pTier), 'the rarity itself, as shown everywhere in the game'],
        ...(gear ? [[`${b.name || it.base} among ${tierName} ${kind === 'weapon' ? 'weapons' : 'armor'}`, pBase ? fmtIn(pBase) : 'never drops', pBase ? (b.unique ? 'unique – rarer than normal bases' : '') : `cannot drop at this rarity – made by an admin or event`]] : []),
        ...(gear ? [[`Exactly ${mods.length} effect${mods.length === 1 ? '' : 's'}`, fmtIn(pN), '']] : []),
        ...(mods.length ? [[`These effects (${mods.map(m => mdefs[m.id].name).join(', ')})`, fmtIn(pSet), 'which effects were rolled']] : []),
        ...mods.map((m, i) => [`${mdefs[m.id].icon} ${mdefs[m.id].name} level ${m.lvl} (max ${mdefs[m.id].max})`, fmtIn(lv[i]), mdefs[m.id].desc(m.lvl)])
    ];

    // Was Fuse draufgelegt hat (nur Anzeige, geht nicht in die Drop-Chance ein)
    let fuseSection = null;
    if (Array.isArray(it.drop)) {
        const fr = [];
        for (const m of now) {
            const o = mods.find(x => x.id === m.id);
            const d = mdefs[m.id];
            if (!o) fr.push([`${d.icon} ${d.name} ${m.lvl}`, 'added', 'new effect from fuse']);
            else if (m.lvl !== o.lvl) fr.push([`${d.icon} ${d.name}`, `${o.lvl} → ${m.lvl}`, 'level raised by fuse']);
        }
        fuseSection = {
            title: 'Fused on top (not part of the drop chance)',
            rows: [
                ['Items fused in', (it.fused || 0).toLocaleString('en-US')],
                ...(fr.length ? fr : [['No effect changes', '–']])
            ]
        };
    }

    // Wie viele gibt es auf dem Server?
    let same = 0, sameTier = 0, sameExact = 0, sameMods = 0;
    const sig = x => (x.mods || []).map(m => m.id + m.lvl).sort().join(',');
    const mySig = sig(it);
    for (const [, u] of users) {
        const a = u.arena;
        if (!a) continue;
        for (const x of [...(a.inv || []), ...(a.overflow || [])]) {
            if (x.kind !== kind || x.base !== it.base) continue;
            same++;
            if (x.tier === it.tier) {
                sameTier++;
                if (sig(x) === mySig) sameExact++;
            }
            if (now.length && sig(x) === mySig) sameMods++;
        }
    }
    return {
        title: it.name, icon: b.icon, tier: it.tier,
        lines: [
            ['Kind', kind === 'util' ? 'Consumable' : kind === 'pack' ? 'Backpack' : kind[0].toUpperCase() + kind.slice(1)],
            ['Rarity', tierName],
            ['Effects', now.length ? now.map(m => `${mdefs[m.id].icon} ${mdefs[m.id].name} ${m.lvl}`).join(' · ') : 'none'],
            ...(fuseSection ? [['Dropped with', mods.length ? mods.map(m => `${mdefs[m.id].icon} ${mdefs[m.id].name} ${m.lvl}`).join(' · ') : 'none']] : []),
            ['Shown in game', it.odds > 1 ? `1 in ${it.odds.toLocaleString('en-US')}` : '–'],
            ['Salvage value', `${I.salvageValue(it)} ⚙️`]
        ],
        sections: [
            { title: fuseSection ? 'How rare was the original drop?' : 'How rare is exactly this item?', rows, total: [fuseSection ? 'The original drop' : 'This exact combination', pAll ? fmtIn(pAll) : 'cannot drop'] },
            ...(fuseSection ? [fuseSection] : []),
            {
                title: 'On this server', rows: [
                    [`${b.name || it.base} (any rarity)`, same.toLocaleString('en-US')],
                    [`${tierName} ${b.name || it.base}`, sameTier.toLocaleString('en-US')],
                    [`${tierName} with exactly these effects`, sameExact.toLocaleString('en-US'), sameExact <= 1 ? 'yours is the only one' : ''],
                    ...(now.length ? [['Same effects, any rarity', sameMods.toLocaleString('en-US')]] : [])
                ]
            }
        ],
        odds: oneIn(pAll)
    };
}

// ---------- Kekemon-Karten ----------

function analyseCard(key, xpList, db, users) {
    const { id, v } = K.parseKey(key);
    const c = db.byId[id];
    if (!c) return null;
    const r = K.RIDX[c.rarity];
    // Variante: Ball und Shiny unabhaengig; Mega-Packs doppelt so oft
    const vChance = f => {
        const ball = v.includes('m') ? K.VARIANTS.master * f : v.includes('p') ? K.VARIANTS.poke * f : 1 - (K.VARIANTS.master + K.VARIANTS.poke) * f;
        const shiny = v.includes('s') ? K.VARIANTS.shiny * f : 1 - K.VARIANTS.shiny * f;
        return ball * shiny;
    };
    const packRows = [];
    let best = 0;
    for (const [pid, p] of Object.entries(K.PACKS)) {
        const pools = db.pools[pid];
        const pool = pools && pools[c.rarity];
        if (!pool || !pool.includes(id)) continue;
        const slot = sure => {
            const odds = p.mega ? (sure ? K.ODDS.megaSure : K.ODDS.megaNormal) : (sure ? K.ODDS.sure : K.ODDS.normal);
            const sum = Object.values(odds).reduce((a, b) => a + b, 0);
            return (odds[c.rarity] || 0) / sum / pool.length * vChance(p.mega ? 2 : 1);
        };
        let miss = 1;
        for (let i = 0; i < p.size; i++) miss *= 1 - slot(i >= p.size - p.sure);
        const per = 1 - miss;
        best = Math.max(best, per);
        packRows.push([`${p.icon} ${p.name}${p.wheel ? ' (wheel/special)' : ''}`, fmtIn(per), `${pool.length} ${K.RARITIES[r].name} cards in this pack`]);
    }
    packRows.sort((a, b) => 0);
    let owners = 0, copies = 0, anyVar = 0;
    for (const [, u] of users) {
        const n = (u.cards || {})[key] || 0;
        if (n > 0) { owners++; copies += n; }
        for (const [k, m] of Object.entries(u.cards || {})) if (m > 0 && K.parseKey(k).id === id) anyVar += m;
    }
    const vName = (v.includes('m') ? 'Masterball ' : v.includes('p') ? 'Pokéball ' : '') + (v.includes('s') ? 'Shiny ' : '');
    const lvl = (xpList || []).length ? Math.max(...xpList) : 0;
    return {
        title: `${vName}${c.name}`, icon: '🃏', tier: c.rarity, img: c.img,
        lines: [
            ['Set', `${(K.SETS[c.set] || {}).name || c.set} #${c.num}`],
            ['Rarity', K.RARITIES[r].name],
            ['Variant', vName.trim() || 'normal'],
            ['Type', (K.TYPES[c.type] || {}).name || c.type],
            ...(lvl ? [['Card XP', lvl.toLocaleString('en-US')]] : []),
            ['Sell value', `${K.valueOf(c, v).toLocaleString('en-US')} coins`]
        ],
        sections: [
            { title: 'Chance to pull exactly this card (per pack)', rows: packRows.length ? packRows : [['Not in any pack', '–']], total: ['Best pack', fmtIn(best)] },
            { title: 'Variant', rows: [['This variant (normal pack)', fmtIn(vChance(1))], ['This variant (mega pack)', fmtIn(vChance(2))]] },
            {
                title: 'On this server', rows: [
                    ['Copies of exactly this', copies.toLocaleString('en-US')],
                    ['Players who own it', owners.toLocaleString('en-US')],
                    [`${c.name} in any variant`, anyVar.toLocaleString('en-US')]
                ]
            }
        ],
        odds: oneIn(best)
    };
}

// ---------- Cosmetics, Packs, Cases ----------

function analyseCos(id, users) {
    const it = shop.BY_ID[id];
    if (!it) return null;
    let owners = 0;
    for (const [, u] of users) if ((u.inventory || []).includes(id)) owners++;
    const cat = (shop.CATS && shop.CATS[it.cat]) || {};
    return {
        title: it.name, icon: it.icon, tier: it.rarity || 'common',
        lines: [['Category', cat.name || it.cat], ['Rarity', it.rarity || '–'], ['Shop price', `${(it.price || 0).toLocaleString('en-US')} coins`], ['Description', it.desc || '']],
        sections: [{ title: 'On this server', rows: [['Players who own it', owners.toLocaleString('en-US')], ['In the shop right now', shop.inRotation(id) ? 'yes' : 'no']] }]
    };
}

function analysePack(id) {
    const p = K.PACKS[id];
    if (!p) return null;
    const table = (odds) => { const s = Object.values(odds).reduce((a, b) => a + b, 0); return Object.entries(odds).map(([r, w]) => [K.RARITIES[K.RIDX[r]].name, fmtIn(w / s)]); };
    return {
        title: p.name, icon: p.icon, tier: p.mega ? 'epic' : 'rare',
        lines: [['Cards', `${p.size} (${p.sure} guaranteed Rare or better)`], ['Price', `${p.price.toLocaleString('en-US')} coins`], ['Variants', p.mega ? 'twice as often' : 'normal']],
        sections: [
            { title: 'Normal slot', rows: table(p.mega ? K.ODDS.megaNormal : K.ODDS.normal) },
            { title: 'Guaranteed slot', rows: table(p.mega ? K.ODDS.megaSure : K.ODDS.sure) }
        ]
    };
}

function analyseCase(id) {
    const c = I.CASES[id];
    if (!c) return null;
    const t = I.SOURCES[c.source].t;
    return {
        title: c.name, icon: c.icon, tier: 'epic',
        lines: [['Price', `${c.price.toLocaleString('en-US')} ${c.currency}`], ['Contents', c.desc]],
        sections: [{ title: 'Rarity of the item inside', rows: I.TIERS.map((x, i) => [x.name, fmtIn(t[i])]).filter(r => r[1] !== '–') }]
    };
}

// ref wie im Markt ({k:'item',uid} | {k:'card',key,xp} | {k:'cos',id} | {k:'pack',id} | {k:'case',id})
function analyse(accounts, db, key, ref) {
    const users = accounts.users();
    if (!ref || typeof ref !== 'object') return null;
    if (ref.k === 'item') {
        const a = accounts.arena(key);
        const it = a && [...a.inv, ...(a.overflow || [])].find(x => x.uid === String(ref.uid));
        return it ? analyseItem(it, users) : null;
    }
    if (ref.k === 'card') {
        const u = accounts.get(key);
        const k = String(ref.key || '');
        if (!u || !((u.cards || {})[k] > 0)) return null;
        return analyseCard(k, ref.xp ? [Number(ref.xp)] : [], db, users);
    }
    if (ref.k === 'cos') return analyseCos(String(ref.id), users);
    if (ref.k === 'pack') return analysePack(String(ref.id));
    if (ref.k === 'case') return analyseCase(String(ref.id));
    return null;
}

module.exports = { analyse, analyseItem, analyseCard, effectSetChance, levelChance, baseChance };
