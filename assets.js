// Handelbare Gueter (5.2, Markt): Arena-Items, Kekemon-Karten, Cosmetics.
// Gemeinsam fuer Auktionshaus (market.js) und direkten Handel (trade.js).
//
// Verweis (ref) aus dem Browser -> Gut (asset), das der Server verwahrt:
//   { k: 'item', uid }          -> { k: 'item', item: {...volles Item} }
//   { k: 'card', key, n, xp }   -> { k: 'card', key, n, xp: [..] }  (key = Id oder Id~Variante)
//       6.7 (Karten-Level): ref.xp waehlt die Kopien – n Kopien mit genau diesen
//       XP (0 = ungelevelt). Das Gut traegt die XP der Kopien mit (xp, nur > 0),
//       der Empfaenger bekommt sie in u.cardXp.
//   { k: 'cos', id }            -> { k: 'cos', id }
//   { k: 'pack', id, n }        -> { k: 'pack', id, n }      (6.1: ungeoeffnete Kekemon-Packs, u.packs)
//   { k: 'case', id, n }        -> { k: 'case', id, n }      (6.1: ungeoeffnete Arena-Cases, arena.cases)
// Ein Gut, das eingestellt oder getauscht wird, ist in dem Moment beim Konto
// weg (take) und kommt beim Empfaenger an (give) – nie doppelt.
//
// h: { accounts, cards, cardDb, shop, I }

const LV = require('./km-level');

// Wie viele Kopien eines Schluessels haben genau xp XP?
function copiesWith(u, key, xp) {
    const n = (u.cards || {})[key] || 0;
    const list = LV.normalize(u, key);
    return xp > 0 ? list.filter(x => x === xp).length : n - list.length;
}

module.exports = function createAssets(h) {
    const { accounts, shop, I } = h;

    function inLoadout(a, uid) {
        const l = a.loadout || {};
        return Object.entries(l).some(([k, v]) => k !== 'util' && v === uid);
    }

    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const packDef = id => own(h.cards.PACKS, id) ? h.cards.PACKS[id] : null;
    const caseDef = id => own(I.CASES, id) ? I.CASES[id] : null;

    // Cosmetics: nur gekaufte, nie die Gratis-Sachen
    const cosOwned = u => (u.inventory || []).filter(id => shop.BY_ID[id] && !shop.BY_ID[id].free && !shop.FREE.includes(id));

    // Fehlertext oder null
    function check(key, ref) {
        const u = accounts.get(key);
        if (!u || !ref) return 'Unknown';
        if (ref.k === 'item') {
            const a = accounts.arena(key);
            if (!a.inv.some(x => x.uid === ref.uid)) return 'You do not own that item anymore';
            if (inLoadout(a, ref.uid)) return 'Take it out of your loadout first';
            return null;
        }
        if (ref.k === 'card') {
            const n = Math.floor(Number(ref.n) || 0);
            const { id } = h.cards.parseKey(String(ref.key || ''));
            if (!h.cardDb.byId[id]) return 'Unknown card';
            if (n < 1 || !u.cards || (u.cards[ref.key] || 0) < n) return 'You do not have that many of this card';
            if (copiesWith(u, ref.key, ref.xp || 0) < n) return ref.xp ? 'You do not have that copy anymore' : 'Pick which copy (level) you want to give';
            return null;
        }
        if (ref.k === 'cos') {
            if (!cosOwned(u).includes(ref.id)) return 'You do not own that cosmetic';
            return null;
        }
        if (ref.k === 'pack') {
            if (!packDef(ref.id)) return 'Unknown pack';
            if (ref.n < 1 || ((u.packs || {})[ref.id] || 0) < ref.n) return 'You do not have that many of this pack';
            return null;
        }
        if (ref.k === 'case') {
            if (!caseDef(ref.id)) return 'Unknown case';
            if (ref.n < 1 || ((accounts.arena(key).cases || {})[ref.id] || 0) < ref.n) return 'You do not have that many of this case';
            return null;
        }
        return 'Unknown';
    }

    // Aus dem Besitz nehmen (vorher check!)
    function take(key, ref) {
        const u = accounts.get(key);
        if (ref.k === 'item') {
            const a = accounts.arena(key);
            const i = a.inv.findIndex(x => x.uid === ref.uid);
            const [item] = a.inv.splice(i, 1);
            return { k: 'item', item };
        }
        if (ref.k === 'card') {
            const n = Math.floor(Number(ref.n));
            const xp = ref.xp || 0;
            // Gelevelte Kopien aus der XP-Liste nehmen, dann den Zaehler senken
            if (xp > 0) {
                const list = LV.normalize(u, ref.key);
                for (let i = 0; i < n; i++) list.splice(list.indexOf(xp), 1);
                if (list.length) u.cardXp[ref.key] = list;
                else delete u.cardXp[ref.key];
            }
            u.cards[ref.key] -= n;
            if (!u.cards[ref.key]) delete u.cards[ref.key];
            return xp > 0 ? { k: 'card', key: ref.key, n, xp: Array(n).fill(xp) } : { k: 'card', key: ref.key, n };
        }
        if (ref.k === 'pack' || ref.k === 'case') {
            const store = ref.k === 'pack' ? u.packs : accounts.arena(key).cases;
            store[ref.id] -= ref.n;
            if (!store[ref.id]) delete store[ref.id];
            return { k: ref.k, id: ref.id, n: ref.n };
        }
        u.inventory = u.inventory.filter(x => x !== ref.id);
        const cat = shop.BY_ID[ref.id].cat;
        if (u.equipped && u.equipped[cat] === ref.id) delete u.equipped[cat];
        return { k: 'cos', id: ref.id };
    }

    // Passt das ins Lager? (nur Arena-Items haben eine Grenze)
    function room(key, assets, leaving = 0) {
        const n = assets.filter(x => x.k === 'item').length;
        if (!n) return true;
        const a = accounts.arena(key);
        return a.inv.length - leaving + n <= I.invMaxOf(a);
    }

    // Einbuchen. Cosmetic, das man schon hat: zaehlt nicht doppelt – dann
    // gibt es den Shop-Preis als Coins (kommt nur bei Randfaellen vor)
    function give(key, asset) {
        const u = accounts.get(key);
        if (!u) return;
        if (asset.k === 'item') accounts.arena(key).inv.push(asset.item);
        else if (asset.k === 'card') {
            u.cards = u.cards || {};
            u.cards[asset.key] = (u.cards[asset.key] || 0) + asset.n;
            const xs = (asset.xp || []).filter(x => x > 0);
            if (xs.length) {
                u.cardXp = u.cardXp || {};
                u.cardXp[asset.key] = (u.cardXp[asset.key] || []).concat(xs).sort((a, b) => b - a);
                LV.normalize(u, asset.key);
            }
        } else if (asset.k === 'pack') {
            u.packs = u.packs || {};
            u.packs[asset.id] = (u.packs[asset.id] || 0) + asset.n;
        } else if (asset.k === 'case') {
            const a = accounts.arena(key);
            a.cases = a.cases || {};
            a.cases[asset.id] = (a.cases[asset.id] || 0) + asset.n;
        } else if (asset.k === 'cos') {
            u.inventory = u.inventory || [];
            if (u.inventory.includes(asset.id)) accounts.addCoins(key, (shop.BY_ID[asset.id] || {}).price || 0);
            else u.inventory.push(asset.id);
        }
        accounts.touch();
    }

    // Fuer den Browser
    // Name und Icon fuer Packs/Cases gleich mitgeben (der Browser hat den
    // Kekemon-Katalog nicht immer geladen)
    function meta(k, id) {
        const d = k === 'pack' ? packDef(id) : caseDef(id);
        return d ? { name: d.name, icon: d.icon, price: d.price } : { name: id, icon: '❔' };
    }

    function view(asset) {
        if (asset.k === 'item') return { k: 'item', item: { ...asset.item, sv: I.salvageValue(asset.item) } };
        if (asset.k === 'pack' || asset.k === 'case') return { ...asset, ...meta(asset.k, asset.id) };
        return { ...asset };
    }

    function label(asset) {
        if (asset.k === 'item') return asset.item.name;
        if (asset.k === 'pack' || asset.k === 'case') {
            const def = asset.k === 'pack' ? packDef(asset.id) : caseDef(asset.id);
            return `${asset.n > 1 ? asset.n + '× ' : ''}${def ? def.name : asset.id}`;
        }
        if (asset.k === 'card') {
            const { id, v } = h.cards.parseKey(asset.key);
            const c = h.cardDb.byId[id];
            const lv = (asset.xp || []).length ? ` (Lv ${LV.levelOf(asset.xp[0]).lv})` : '';
            return `${asset.n > 1 ? asset.n + '× ' : ''}${v ? '[' + v + '] ' : ''}${c ? c.name : id}${lv}`;
        }
        const it = shop.BY_ID[asset.id];
        return it ? it.name : asset.id;
    }

    // Suchtext (Auktionshaus)
    function text(asset) {
        if (asset.k === 'card') {
            const c = h.cardDb.byId[h.cards.parseKey(asset.key).id];
            return c ? `${c.name} ${c.from} ${c.rarity}` : '';
        }
        if (asset.k === 'item') return `${asset.item.name} ${asset.item.base || ''}`;
        if (asset.k === 'pack') return `${(packDef(asset.id) || {}).name || ''} pack booster`;
        if (asset.k === 'case') return `${(caseDef(asset.id) || {}).name || ''} case`;
        const it = shop.BY_ID[asset.id];
        return it ? `${it.name} ${it.cat} ${it.rarity}` : '';
    }

    // Was ich handeln kann
    function mine(key) {
        const u = accounts.get(key);
        const a = accounts.arena(key);
        return {
            items: a.inv.filter(x => !inLoadout(a, x.uid)).map(it => ({ ...it, sv: I.salvageValue(it) })),
            cards: u.cards || {},
            cardXp: LV.normalizeAll(u),
            cos: cosOwned(u),
            packs: Object.entries(u.packs || {}).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, ...meta('pack', id) })),
            cases: Object.entries(a.cases || {}).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, ...meta('case', id) })),
            coins: u.coins, scrap: a.scrap, invMax: I.invMaxOf(a), invUsed: a.inv.length
        };
    }

    // Verweis aus dem Browser saeubern
    function clean(r) {
        if (!r || typeof r !== 'object') return null;
        if (r.k === 'item') return { k: 'item', uid: String(r.uid || '') };
        if (r.k === 'card') return { k: 'card', key: String(r.key || '').slice(0, 40), n: Math.max(1, Math.min(999, Math.floor(Number(r.n) || 1))), xp: Math.max(0, Math.floor(Number(r.xp) || 0)) };
        if (r.k === 'cos') return { k: 'cos', id: String(r.id || '').slice(0, 40) };
        if (r.k === 'pack' || r.k === 'case') return { k: r.k, id: String(r.id || '').slice(0, 40), n: Math.max(1, Math.min(99, Math.floor(Number(r.n) || 1))) };
        return null;
    }

    const same = (a, b) => a.k === b.k && (a.k === 'item' ? a.uid === b.uid : a.k === 'card' ? a.key === b.key && (a.xp || 0) === (b.xp || 0) : a.id === b.id);

    return { check, take, give, room, view, label, text, mine, clean, same };
};
