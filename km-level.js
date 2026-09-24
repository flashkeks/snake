// Kekemon-Karten-Level (6.7, Plan im README „Karten-Level", Entscheidungen Max).
//
// Level 1–50 je KOPIE einer Karte. Gespeichert neben dem Zaehler u.cards:
//   u.cardXp = { 'id~v': [xp, xp, …] }   absteigend, hoechstens u.cards[key] Eintraege
// Kopien ohne XP stehen nicht in der Liste. Geht eine Kopie weg (Verkauf,
// Handel, Markt, Admin), faellt beim naechsten normalize() die schwaechste
// raus – das Level der besten Kopie bleibt also erhalten, solange man sie hat.
// Im Kampf kaempft immer die beste Kopie (Index 0) und bekommt die XP.
//
// Werte: +4 % je Level auf HP und Angriff (Lv 50 = x3), Verteidigung und
// Tempo +2 % je Level (Lv 50 = x2).

const MAX_LV = 50;
const CURVE = { base: 20, exp: 1.5 };        // XP fuer den Schritt L -> L+1 = base * L^exp

const need = lv => lv >= MAX_LV ? 0 : Math.round(CURVE.base * Math.pow(lv, CURVE.exp));

// Level aus Gesamt-XP: { lv, into, need }
function levelOf(xp) {
    let lv = 1, rest = Math.max(0, Math.floor(xp || 0));
    while (lv < MAX_LV && rest >= need(lv)) {
        rest -= need(lv);
        lv++;
    }
    return { lv, into: rest, need: need(lv) };
}

// Faktoren fuer die Kampfwerte
function statMul(lv) {
    const l = Math.max(1, Math.min(MAX_LV, lv || 1)) - 1;
    return { hp: 1 + 0.04 * l, atk: 1 + 0.04 * l, def: 1 + 0.02 * l, spe: 1 + 0.02 * l };
}

// Liste auf die Anzahl der Kopien kuerzen, sortieren, leere entfernen
function normalize(u, key) {
    if (!u.cardXp || !u.cardXp[key]) return [];
    const n = (u.cards && u.cards[key]) || 0;
    const list = u.cardXp[key].filter(x => x > 0).sort((a, b) => b - a).slice(0, n);
    if (list.length) u.cardXp[key] = list;
    else delete u.cardXp[key];
    return list;
}

function normalizeAll(u) {
    if (!u.cardXp) return {};
    for (const k of Object.keys(u.cardXp)) normalize(u, k);
    return u.cardXp;
}

// XP der besten Kopie
const bestXp = (u, key) => normalize(u, key)[0] || 0;
const bestLv = (u, key) => levelOf(bestXp(u, key)).lv;

// XP auf die beste Kopie buchen. Rueckgabe { key, xp, from, to } (Level vorher/nachher)
function addXp(u, key, amount) {
    if (!(amount > 0) || !((u.cards || {})[key] > 0)) return null;
    u.cardXp = u.cardXp || {};
    const list = normalize(u, key);
    const before = list[0] || 0;
    const cap = totalFor(MAX_LV);
    const after = Math.min(cap, before + Math.round(amount));
    if (list.length) list[0] = after;
    else list.push(after);
    u.cardXp[key] = list.sort((a, b) => b - a);
    return { key, xp: after - before, from: levelOf(before).lv, to: levelOf(after).lv };
}

// Gesamt-XP bis zu einem Level
function totalFor(lv) {
    let s = 0;
    for (let l = 1; l < lv; l++) s += need(l);
    return s;
}

// XP-Belohnung je Kampf und Karte
const XP = {
    // Gym: nach Nummer der Arena (0 = Sprout … 7 = Champion)
    gym: (idx, win) => Math.round((30 + 12 * idx) * (win ? 1 : 0.4)),
    duel: win => win ? 60 : 30,
    // Training: fest je Bereich, Niederlage 40 %
    train: (zone, win) => Math.round(zone.xp * (win ? 1 : 0.4))
};
// Verfuettern (Schritt 4): Grund-XP nach Seltenheit der geopferten Kopie,
// dazu die Haelfte ihrer eigenen XP
const FEED = { common: 60, uncommon: 120, rare: 250, epic: 600, legendary: 1500, secret: 4000 };
const FEED_KEEP = 0.5;

// Eine Kopie von source opfern (immer die schwaechste; ist source == target,
// nie die beste) und die XP auf die beste Kopie von target buchen.
// Rueckgabe wie addXp oder null
function feed(u, target, source, rarity) {
    const n = (u.cards || {})[source] || 0;
    if (n < (source === target ? 2 : 1) || !((u.cards || {})[target] > 0)) return null;
    const list = normalize(u, source);
    const fed = n > list.length ? 0 : list.pop();
    u.cards[source] = n - 1;
    if (!u.cards[source]) delete u.cards[source];
    if (u.cardXp && u.cardXp[source]) {
        if (list.length) u.cardXp[source] = list;
        else delete u.cardXp[source];
    }
    return addXp(u, target, (FEED[rarity] || FEED.common) + Math.round(fed * FEED_KEEP));
}

// Duelle: volle XP fuer die ersten DUEL_FULL am Tag, danach DUEL_LATE
const DUEL_FULL = 10, DUEL_LATE = 0.2;

function catalog() {
    return { max: MAX_LV, curve: CURVE, feed: FEED, feedKeep: FEED_KEEP };
}

module.exports = { MAX_LV, CURVE, need, levelOf, statMul, normalize, normalizeAll, bestXp, bestLv, addXp, feed, FEED, totalFor, XP, DUEL_FULL, DUEL_LATE, catalog };

// Nachsehen: node km-level.js
if (require.main === module) {
    for (const l of [5, 10, 20, 30, 40, 50]) console.log(`Lv ${l}: ${totalFor(l).toLocaleString('en')} XP gesamt`);
}
