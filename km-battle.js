// Kekemon-Kaempfe 6.0 (Max: "orientier dich an Pokemon Showdown"): seit 6.4
// 5 gegen 5 (Max: mit 3 Karten zu sehr von der Seltenheit abhaengig).
//
// Ablauf wie im Vorbild:
//   - Beide Seiten waehlen gleichzeitig: Attacke (eine von vier) oder Wechsel.
//     Erst wenn beide gewaehlt haben, wird der Zug aufgeloest.
//   - Reihenfolge: Wechsel zuerst, dann Attacken nach Prioritaet, dann nach
//     Initiative (Speed; Paralyse halbiert), Gleichstand per Zufall.
//   - Schaden (Level 50): ((22 · Staerke · A / D) / 50 + 2) · Zufall 0,85–1
//     · STAB 1,5 · Typ-Faktor (×2 / ×½ / ×0) · Volltreffer 1,5 (1/24, hohe
//     Chance 1/8) · Verbrennung halbiert physische Attacken.
//     A/D nach Kategorie: physisch Atk gegen Def, speziell SpA gegen SpD.
//   - Werte-Stufen −6..+6 (Faktor (2+n)/2 bzw. 2/(2−n)), weg beim Auswechseln.
//   - Status: brn (1/16 je Zug, Atk halbiert), par (Speed halbiert, 25 %
//     bewegungsunfaehig), psn (1/8 je Zug), slp (1–3 Zuege). Einer zur Zeit.
//   - Protect: blockt alles in diesem Zug, hintereinander immer seltener.
//   - PP je Attacke; ohne PP bleibt nur Verzweifler (Struggle).
//   - Faellt die aktive Karte, waehlt die Seite am Zugende die naechste.
//   - Nach 60 Zuegen gewinnt, wer anteilig mehr HP hat.
//
// Reine Logik ohne Netz. Arena: Seite 1 ist KI. Duell: createBattle(..., { ai:
// false }), dann play(b, c, s) je Seite. view(b, me) / flip(ev, me) drehen
// alles so, dass die eigene Seite Seite 0 ist.
//
// Wahl c: { a: 'move', i } | { a: 'switch', to } | { a: 'forfeit' }

const K = require('./km-moves');
const LV = require('./km-level');

const TEAM_SIZE = 5;
const LEVEL_F = 22;           // floor(2 · 50 / 5 + 2)
const MAX_TURNS = 60;
const STRUGGLE = { name: 'Struggle', type: null, cat: 'phys', pow: 50, acc: 0, pp: 1, pri: 0, struggle: true };
// Varianten machen Karten ein bisschen staerker (HP und Angriff)
const VAR_MUL = { p: 1.03, m: 1.08, s: 1.10 };

function varMul(v) {
    let m = 1;
    for (const ch of v || '') m *= VAR_MUL[ch] || 1;
    return m;
}

const stage = n => n >= 0 ? (2 + n) / 2 : 2 / (2 - n);
const freshBoosts = () => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

// Kampfkarte aus einer Katalogkarte. mul: Staerke (Arenen)
// lv (6.7): Karten-Level, siehe km-level.js
function fighter(card, v, mul = 1, lv = 1) {
    const L = LV.statMul(lv);
    const m = varMul(v) * mul;
    const st = card.bt.stats;
    const hp = Math.round(st.hp * m * L.hp);
    const dm = (0.8 + 0.2 * mul) * L.def;
    return {
        id: card.id, v: v || '', name: card.name, type: card.type, style: card.bt.style, lv: Math.max(1, lv || 1),
        hp, maxHp: hp,
        st: { atk: Math.round(st.atk * m * L.atk), spa: Math.round(st.spa * m * L.atk), def: Math.round(st.def * dm), spd: Math.round(st.spd * dm), spe: Math.round(st.spe * L.spe) },
        moves: card.bt.moves.map(x => ({ ...x, ppLeft: x.pp })),
        status: null, slp: 0, boosts: freshBoosts(), protecting: false, protectCount: 0
    };
}

function createBattle(teamA, teamB, opts = {}) {
    const b = {
        sides: [
            { name: opts.nameA || 'You', cards: teamA, active: 0, ai: false, choice: null, need: false },
            { name: opts.nameB || 'Leader', cards: teamB, active: 0, ai: opts.ai !== false, choice: null, need: false }
        ],
        turn: 1, phase: 'move', over: false, winner: null, smart: opts.smart || 0,
        rnd: opts.rnd || Math.random
    };
    const ev = [{ k: 'start' }, { k: 'switch', s: 0, to: 0 }, { k: 'switch', s: 1, to: 0 }, { k: 'turn', n: 1 }];
    return { b, ev };
}

const act = (b, s) => b.sides[s].cards[b.sides[s].active];
const alive = side => side.cards.filter(c => c.hp > 0);
const speedOf = c => c.st.spe * stage(c.boosts.spe) * (c.status === 'par' ? 0.5 : 1);

// Wer muss gerade waehlen (Menschen und KI)?
function needs(b) {
    if (b.over) return [];
    if (b.phase === 'move') return [0, 1].filter(s => !b.sides[s].choice);
    return [0, 1].filter(s => b.sides[s].need && !b.sides[s].choice);
}

// Nur menschliche Seiten, auf die gewartet wird (fuer Zugzeit im Duell)
function waitingOn(b) {
    return needs(b).filter(s => !b.sides[s].ai);
}

// ---------- Schaden ----------

function calc(att, def, m, crit, roll) {
    if (m.struggle) {
        const base = Math.floor(Math.floor(LEVEL_F * m.pow * att.st.atk / def.st.def) / 50) + 2;
        return { dmg: Math.max(1, Math.floor(base * roll)), e: 1 };
    }
    const e = K.eff(m.type, def.type);
    if (e === 0) return { dmg: 0, e };
    const phys = m.cat === 'phys';
    let ab = att.boosts[phys ? 'atk' : 'spa'], db = def.boosts[phys ? 'def' : 'spd'];
    if (crit) {
        ab = Math.max(0, ab);
        db = Math.min(0, db);
    }
    const A = att.st[phys ? 'atk' : 'spa'] * stage(ab);
    const D = def.st[phys ? 'def' : 'spd'] * stage(db);
    const base = Math.floor(Math.floor(LEVEL_F * m.pow * A / D) / 50) + 2;
    let mod = roll * (m.type === att.type ? 1.5 : 1) * e * (crit ? 1.5 : 1);
    if (phys && att.status === 'brn') mod *= 0.5;
    return { dmg: Math.max(1, Math.floor(base * mod)), e };
}

// Erwarteter Schaden (KI und Vorschau): mittlerer Zufall, kein Volltreffer
function estimate(att, def, m) {
    if (!m.pow) return { dmg: 0, e: K.eff(m.type, def.type) };
    return calc(att, def, m, false, 0.925);
}

// ---------- Auswahl ----------

function validate(b, s, c) {
    const side = b.sides[s];
    const me = act(b, s);
    if (b.phase === 'switch') {
        if (!side.need) return 'Wait for your opponent';
        if (c.a !== 'switch') return 'Pick your next card';
    }
    if (c.a === 'switch') {
        const to = Number(c.to);
        if (!side.cards[to] || side.cards[to].hp <= 0) return 'That card cannot fight';
        if (to === side.active) return 'That card is already fighting';
        return null;
    }
    if (c.a === 'move' || c.a === 'atk') {
        const i = Number(c.i);
        if (i === -1) return me.moves.every(m => m.ppLeft <= 0) ? null : 'You still have PP left';
        if (!me.moves[i]) return 'Unknown move';
        if (me.moves[i].ppLeft <= 0) return 'No PP left for that move';
        return null;
    }
    return 'Unknown action';
}

// Aktion einer Seite. Loest den Zug auf, sobald alle gewaehlt haben.
function play(b, c, s = 0) {
    if (b.over) return { err: 'The battle is over' };
    const ev = [];
    if (c.a === 'forfeit') {
        end(b, 1 - s, ev, { k: 'forfeit', s });
        return { ev };
    }
    if (!needs(b).includes(s)) return { err: b.phase === 'switch' ? 'Wait for your opponent' : 'You already chose – waiting for your opponent' };
    const err = validate(b, s, c);
    if (err) return { err };
    b.sides[s].choice = c.a === 'switch' ? { a: 'switch', to: Number(c.to) } : { a: 'move', i: Number(c.i) };
    step(b, ev);
    return { ev };
}

// KI waehlt, dann wird aufgeloest, solange niemand Menschliches fehlt
function step(b, ev) {
    let guard = 0;
    while (!b.over && guard++ < 10) {
        for (const s of needs(b)) if (b.sides[s].ai) b.sides[s].choice = aiChoose(b, s);
        if (needs(b).length) return;
        if (b.phase === 'move') resolveTurn(b, ev);
        else resolveSwitches(b, ev);
    }
}

// Zeit abgelaufen (Duelle): fuer alle Wartenden automatisch waehlen
function auto(b) {
    const who = waitingOn(b);
    if (!who.length) return null;
    const ev = [];
    for (const s of who) {
        ev.push({ k: 'timeout-turn', s });
        b.sides[s].choice = aiChoose(b, s, 1);
    }
    step(b, ev);
    return { ev, who };
}

// ---------- Zug ----------

function doSwitch(b, s, to, ev, forced) {
    const side = b.sides[s];
    const old = act(b, s);
    old.boosts = freshBoosts();
    old.protectCount = 0;
    side.active = to;
    ev.push({ k: 'switch', s, to, forced: !!forced });
}

function resolveTurn(b, ev) {
    const acts = [0, 1].map(s => ({ s, c: b.sides[s].choice }));
    for (const side of b.sides) side.choice = null;
    // Wechsel zuerst (schnellere Seite zuerst)
    acts.filter(x => x.c.a === 'switch')
        .sort((x, y) => speedOf(act(b, y.s)) - speedOf(act(b, x.s)))
        .forEach(x => doSwitch(b, x.s, x.c.to, ev));
    // Attacken nach Prioritaet, dann Speed, Gleichstand Zufall
    const moves = acts.filter(x => x.c.a === 'move').map(x => {
        const me = act(b, x.s);
        const m = x.c.i === -1 ? STRUGGLE : me.moves[x.c.i];
        return { ...x, m, pri: m.pri || 0, spe: speedOf(me), tie: b.rnd() };
    }).sort((x, y) => y.pri - x.pri || y.spe - x.spe || x.tie - y.tie);
    for (const x of moves) {
        if (b.over) return;
        const me = act(b, x.s);
        if (me.hp <= 0) continue;
        useMove(b, x.s, x.m, ev);
    }
    if (b.over) return;
    // Zugende: Verbrennung, Gift
    for (const s of [0, 1]) {
        const c = act(b, s);
        c.protecting = false;
        if (c.hp <= 0 || b.over) continue;
        const frac = c.status === 'brn' ? 16 : c.status === 'psn' ? 8 : 0;
        if (frac) {
            const d = Math.max(1, Math.floor(c.maxHp / frac));
            c.hp = Math.max(0, c.hp - d);
            ev.push({ k: 'dmg', s, dmg: d, hp: c.hp, from: c.status });
            if (c.hp <= 0) faint(b, s, ev);
        }
    }
    if (b.over) return;
    afterTurn(b, ev);
}

// Nach dem Zug: wer braucht eine neue Karte? Sonst naechster Zug
function afterTurn(b, ev) {
    let any = false;
    for (const s of [0, 1]) {
        const side = b.sides[s];
        side.need = act(b, s).hp <= 0 && alive(side).length > 0;
        if (side.need) {
            any = true;
            ev.push({ k: 'choose', s });
        }
    }
    if (any) {
        b.phase = 'switch';
        return;
    }
    nextTurn(b, ev);
}

function nextTurn(b, ev) {
    b.phase = 'move';
    b.turn++;
    if (b.turn > MAX_TURNS) {
        const share = side => side.cards.reduce((a, c) => a + Math.max(0, c.hp), 0) / side.cards.reduce((a, c) => a + c.maxHp, 0);
        end(b, share(b.sides[0]) >= share(b.sides[1]) ? 0 : 1, ev, { k: 'timeout' });
        return;
    }
    ev.push({ k: 'turn', n: b.turn });
}

function resolveSwitches(b, ev) {
    for (const s of [0, 1]) {
        const side = b.sides[s];
        if (!side.need) continue;
        doSwitch(b, s, side.choice.to, ev, true);
        side.choice = null;
        side.need = false;
    }
    nextTurn(b, ev);
}

function faint(b, s, ev) {
    ev.push({ k: 'faint', s, id: act(b, s).id });
    // Wer zuerst keine Karte mehr hat, verliert
    if (!alive(b.sides[s]).length && !b.over) end(b, 1 - s, ev);
}

function end(b, winner, ev, pre) {
    if (b.over) return;
    b.over = true;
    b.winner = winner;
    b.phase = 'over';
    for (const side of b.sides) side.choice = null;
    if (pre) ev.push(pre);
    ev.push({ k: 'end', winner });
}

function applyBoosts(me, self, ev, s) {
    let changed = false;
    for (const [k0, n] of Object.entries(self)) {
        const k = k0 === 'off' ? (me.style === 'spec' ? 'spa' : 'atk') : k0;
        const before = me.boosts[k];
        me.boosts[k] = Math.max(-6, Math.min(6, before + n));
        if (me.boosts[k] !== before) {
            changed = true;
            ev.push({ k: 'boost', s, stat: k, n: me.boosts[k] - before, now: me.boosts[k] });
        }
    }
    return changed;
}

function setStatus(b, s, st, ev) {
    const c = act(b, s);
    if (c.hp <= 0 || c.status || K.IMMUNE[st] === c.type) return false;
    c.status = st;
    if (st === 'slp') c.slp = 1 + Math.floor(b.rnd() * 3);
    ev.push({ k: 'status', s, st });
    return true;
}

function useMove(b, s, m, ev) {
    const me = act(b, s), foe = act(b, 1 - s);
    // Schlaf und Paralyse
    if (me.status === 'slp') {
        me.slp--;
        if (me.slp > 0) {
            ev.push({ k: 'cant', s, why: 'slp' });
            return;
        }
        me.status = null;
        ev.push({ k: 'cure', s, st: 'slp' });
    }
    if (me.status === 'par' && b.rnd() < 0.25) {
        ev.push({ k: 'cant', s, why: 'par' });
        return;
    }
    if (!m.struggle) m.ppLeft = Math.max(0, m.ppLeft - 1);
    ev.push({ k: 'move', s, name: m.name, type: m.type, cat: m.cat });
    const e = m.eff || {};
    if (e.protect) {
        const chance = 1 / Math.pow(3, me.protectCount);
        if (b.rnd() < chance) {
            me.protecting = true;
            me.protectCount++;
            ev.push({ k: 'protect', s });
        } else {
            me.protectCount = 0;
            ev.push({ k: 'fail', s });
        }
        return;
    }
    me.protectCount = 0;
    const hitsFoe = m.cat !== 'status' || !!e.st;
    if (hitsFoe) {
        if (foe.hp <= 0) {
            ev.push({ k: 'fail', s });
            return;
        }
        if (foe.protecting) {
            ev.push({ k: 'blocked', s: 1 - s });
            return;
        }
        if (m.acc && b.rnd() * 100 >= m.acc) {
            ev.push({ k: 'miss', s });
            return;
        }
    }
    if (m.cat === 'status') {
        if (e.st) {
            if (foe.status || K.IMMUNE[e.st] === foe.type) ev.push({ k: 'fail', s, why: foe.status ? 'status' : 'immune' });
            else setStatus(b, 1 - s, e.st, ev);
            return;
        }
        let ok = false;
        if (e.heal) {
            if (me.hp >= me.maxHp) ev.push({ k: 'fail', s, why: 'fullhp' });
            else {
                const h = Math.min(me.maxHp - me.hp, Math.floor(me.maxHp * e.heal / 100));
                me.hp += h;
                ev.push({ k: 'heal', s, n: h, hp: me.hp });
            }
            ok = true;
        }
        if (e.self && !applyBoosts(me, e.self, ev, s) && !ok) ev.push({ k: 'fail', s, why: 'maxed' });
        return;
    }
    // Angriff
    const crit = !m.struggle && b.rnd() < (e.crit ? 1 / 8 : 1 / 24);
    const roll = 0.85 + b.rnd() * 0.15;
    const r = calc(me, foe, m, crit, roll);
    if (r.e === 0) {
        ev.push({ k: 'immune', s: 1 - s });
        return;
    }
    foe.hp = Math.max(0, foe.hp - r.dmg);
    ev.push({ k: 'dmg', s: 1 - s, dmg: r.dmg, hp: foe.hp, eff: r.e, crit, from: 'move' });
    if (e.drain && me.hp < me.maxHp) {
        const h = Math.min(me.maxHp - me.hp, Math.max(1, Math.floor(r.dmg * e.drain / 100)));
        me.hp += h;
        ev.push({ k: 'heal', s, n: h, hp: me.hp, why: 'drain' });
    }
    if (e.heal && me.hp < me.maxHp) {
        const h = Math.min(me.maxHp - me.hp, Math.floor(me.maxHp * e.heal / 100));
        me.hp += h;
        ev.push({ k: 'heal', s, n: h, hp: me.hp });
    }
    if (e.self) applyBoosts(me, e.self, ev, s);
    if (e.st && foe.hp > 0 && b.rnd() * 100 < (e.ch || 100)) setStatus(b, 1 - s, e.st, ev);
    if (m.struggle) {
        const d = Math.max(1, Math.floor(me.maxHp / 4));
        me.hp = Math.max(0, me.hp - d);
        ev.push({ k: 'dmg', s, dmg: d, hp: me.hp, from: 'recoil' });
    }
    if (foe.hp <= 0) faint(b, 1 - s, ev);
    if (!b.over && me.hp <= 0) faint(b, s, ev);
}

// ---------- KI ----------
// smart 0: haut mit starken Attacken drauf (etwas Zufall)
// smart 1: gierig mit echter Schadensrechnung; K.o. zuerst, Status/Aufbau/
//          Heilung, wenn es passt
// smart 2: Vorausschau – jede eigene Option wird mehrfach zwei Zuege weit
//          gegen gierige Antworten durchgespielt, die beste gewinnt

function bestDamage(att, def) {
    let best = 0;
    for (const m of att.moves) if (m.ppLeft > 0 && m.pow) best = Math.max(best, estimate(att, def, m).dmg * (m.acc ? m.acc / 100 : 1));
    return best;
}

function bestSwitch(b, s, skip) {
    const side = b.sides[s], foe = act(b, 1 - s);
    let best = -1, bv = -1e9;
    side.cards.forEach((c, i) => {
        if (c.hp <= 0 || i === skip) return;
        // eigener Schaden gegen den Gegner minus sein Schaden gegen uns, anteilig
        const v = bestDamage(c, foe) / Math.max(1, foe.hp) - bestDamage(foe, c) / Math.max(1, c.hp) + c.hp / c.maxHp * 0.3;
        if (v > bv) { bv = v; best = i; }
    });
    return best;
}

// Gierige Wahl (Stufe 0 und 1)
function greedy(b, s, smart) {
    const me = act(b, s), foe = act(b, 1 - s);
    const usable = me.moves.map((m, i) => ({ m, i })).filter(x => x.m.ppLeft > 0);
    if (!usable.length) return { a: 'move', i: -1 };
    const threat = bestDamage(foe, me);
    const faster = speedOf(me) >= speedOf(foe);
    const opts = usable.map(({ m, i }) => {
        const e = m.eff || {};
        let v;
        if (m.pow) {
            const est = estimate(me, foe, m).dmg * (m.acc ? m.acc / 100 : 1);
            if (smart === 0) v = m.pow * K.eff(m.type, foe.type) * (0.6 + b.rnd() * 0.8);
            // K.o.: bevorzugt, wenn wir zuerst dran sind (oder Prioritaet haben)
            else v = est >= foe.hp ? 200 + (faster || m.pri > 0 ? 60 : 0) + (m.acc || 100) / 10 : est / foe.maxHp * 100;
        } else if (smart === 0) v = -1;
        else if (e.st) {
            if (foe.status || K.IMMUNE[e.st] === foe.type || foe.hp < foe.maxHp * 0.5) v = -1;
            else v = { slp: 48, par: faster ? 26 : 42, brn: foe.style === 'phys' ? 40 : 24, psn: 30 }[e.st] * (m.acc || 100) / 100;
        } else if (e.heal) v = me.hp / me.maxHp < 0.45 && threat < me.hp ? 58 : -1;
        else if (e.protect) v = me.protectCount > 0 ? -1 : (foe.status === 'brn' || foe.status === 'psn') ? 22 : 3;
        else if (e.self) {
            const k0 = Object.keys(e.self)[0];
            const k = k0 === 'off' ? (me.style === 'spec' ? 'spa' : 'atk') : k0;
            v = me.boosts[k] >= 2 || threat >= me.hp * 0.4 || me.hp / me.maxHp < 0.7 ? -1 : 44;
        } else v = -1;
        return { i, v: v + b.rnd() * 5 };
    });
    opts.sort((x, y) => y.v - x.v);
    return { a: 'move', i: opts[0].i };
}

// Bewertung aus Sicht von Seite s: eigene HP/Karten minus die des Gegners
function evalSide(b, s) {
    const score = side => side.cards.reduce((a, c) => a + (c.hp > 0 ? 0.45 + 0.55 * c.hp / c.maxHp - (c.status ? 0.08 : 0) : 0), 0);
    if (b.over) return b.winner === s ? 100 : -100;
    const me = act(b, s);
    const boost = Math.max(0, me.boosts.atk, me.boosts.spa) * 0.06 + Math.max(0, me.boosts.spe) * 0.04;
    return score(b.sides[s]) - score(b.sides[1 - s]) + (me.hp > 0 ? boost : 0);
}

function cloneBattle(b) {
    return {
        ...b,
        sides: b.sides.map(side => ({
            ...side, choice: null, ai: true, level: 1,
            cards: side.cards.map(c => ({ ...c, st: { ...c.st }, boosts: { ...c.boosts }, moves: c.moves.map(m => ({ ...m })) }))
        })),
        smart: 1
    };
}

const LOOK_SAMPLES = 8, LOOK_TURNS = 3;

function lookahead(b, s) {
    const me = act(b, s);
    const side = b.sides[s];
    const cands = [];
    me.moves.forEach((m, i) => { if (m.ppLeft > 0) cands.push({ a: 'move', i }); });
    if (!cands.length) cands.push({ a: 'move', i: -1 });
    side.cards.forEach((c, i) => { if (i !== side.active && c.hp > 0) cands.push({ a: 'switch', to: i }); });
    let best = null, bv = -1e9;
    for (const c of cands) {
        let sum = 0;
        for (let k = 0; k < LOOK_SAMPLES; k++) {
            const x = cloneBattle(b);
            x.sides[s].choice = c;
            x.sides[1 - s].choice = greedy(x, 1 - s, 1);
            const start = x.turn;
            let g = 0;
            while (!x.over && x.turn < start + LOOK_TURNS && g++ < 20) {
                if (x.phase === 'move' && !x.sides[0].choice && !x.sides[1].choice && x.turn === start) break;
                step(x, []);
            }
            sum += evalSide(x, s);
        }
        const v = sum / LOOK_SAMPLES;
        if (v > bv) { bv = v; best = c; }
    }
    return best;
}

// level: fest vorgegeben (Auto-Zug), sonst Stufe der Seite (Tests) oder des Kampfes
function aiChoose(b, s, level) {
    const lv = b.sides[s].level;
    const smart = level !== undefined ? level : lv !== undefined ? lv : b.smart;
    if (b.phase === 'switch') return { a: 'switch', to: bestSwitch(b, s, -1) };
    if (smart < 0) {
        // nur fuer Tests: rein zufaellig
        const ok = act(b, s).moves.map((m, i) => i).filter(i => act(b, s).moves[i].ppLeft > 0);
        return { a: 'move', i: ok.length ? ok[Math.floor(b.rnd() * ok.length)] : -1 };
    }
    if (smart >= 2) return lookahead(b, s);
    return greedy(b, s, smart);
}

// ---------- Ansicht ----------

// Aus Sicht von Seite me (die steht dann vorne)
function view(b, me = 0) {
    const sides = b.sides.map(side => ({
        name: side.name, active: side.active,
        cards: side.cards.map(c => ({
            id: c.id, v: c.v, lv: c.lv || 1, type: c.type, hp: c.hp, maxHp: c.maxHp, status: c.status, boosts: c.boosts, st: c.st,
            moves: c.moves.map(m => ({ name: m.name, type: m.type, cat: m.cat, pow: m.pow, acc: m.acc, pp: m.ppLeft, ppMax: m.pp, pri: m.pri || 0, desc: m.desc }))
        }))
    }));
    const fl = x => x === null || x === undefined ? x : x ^ me;
    const mine = b.sides[me], foe = b.sides[1 - me];
    const n = needs(b);
    return {
        turn: b.turn, phase: b.phase, over: b.over, winner: fl(b.winner),
        // Muss ich waehlen? Oder habe ich schon und warte?
        need: n.includes(me) ? (b.phase === 'switch' ? 'switch' : 'move') : null,
        waiting: !b.over && !n.includes(me) && n.includes(1 - me),
        needSwitch: b.phase === 'switch' && mine.need && !mine.choice,
        foeSwitch: b.phase === 'switch' && foe.need,
        sides: me ? [sides[1], sides[0]] : sides
    };
}

// Ereignisse aus Sicht von Seite me
function flip(ev, me) {
    if (!me) return ev;
    return ev.map(e => {
        const o = { ...e };
        for (const k of ['s', 'winner']) if (typeof o[k] === 'number') o[k] ^= 1;
        return o;
    });
}

module.exports = { TEAM_SIZE, step, fighter, createBattle, play, auto, needs, waitingOn, view, flip, calc, estimate, aiChoose, VAR_MUL, MAX_TURNS };
