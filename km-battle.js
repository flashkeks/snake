// Kekemon-Kaempfe (5.6): 3 gegen 3 gegen KI-Arenen.
//
// Regeln (auch im Browser unter "How battles work"):
//   - Jede Seite hat eine aktive Karte und zwei auf der Bank.
//   - Zu Beginn des eigenen Zuges bekommt die aktive Karte +1 Energie. Energie
//     bleibt an der Karte (wer auswechselt, faengt mit der neuen bei ihrer
//     eigenen Energie an).
//   - Pro Zug genau eine Aktion: angreifen (kostet die Energie der Attacke –
//     seit 5.7, Max: vorher blieb sie liegen und die grosse Attacke ging jede
//     Runde), aufladen (+1 Energie extra), auswechseln, aufgeben.
//   - Schaden = Attacke (+20 je Boost) × 1,5 bei Schwaeche − 40 % der
//     Verteidigung (ausser Pierce), mindestens 10.
//   - Effekte: burn 15 Schaden zu Beginn der naechsten 3 Zuege des Ziels,
//     stun Ziel setzt den naechsten Zug aus, heal +30, drain +50 % des
//     Schadens, boost +20 Schaden fuer den Rest des Kampfes, pierce ohne Abwehr.
//   - K.o.: naechste lebende Karte kommt (Spieler waehlt, KI nimmt die beste).
//   - Wer zuerst beginnt: die schnellere aktive Karte.
//
// Reine Logik ohne Netz – server.js haelt je Spieler einen Kampf.

const BURN_DMG = 15, BURN_TURNS = 3, HEAL = 30, BOOST = 20, DEF_FACTOR = 0.4, WEAK = 1.5;
// Varianten machen Karten ein bisschen staerker (HP und Schaden)
const VAR_MUL = { p: 1.03, m: 1.08, s: 1.10 };

function varMul(v) {
    let m = 1;
    for (const ch of v || '') m *= VAR_MUL[ch] || 1;
    return m;
}

// Kampfkarte aus einer Katalogkarte
function fighter(card, v, mul = 1) {
    const m = varMul(v) * mul;
    const hp = Math.round(card.hp * m);
    return {
        id: card.id, v: v || '', name: card.name, type: card.type, weak: card.weak, rarity: card.rarity,
        hp, maxHp: hp, def: Math.round(card.def * (0.8 + 0.2 * mul)), spd: card.spd,
        attacks: card.attacks.map(a => ({ ...a, dmg: Math.round(a.dmg * m) })),
        energy: 0, burn: 0, stun: false, boost: 0
    };
}

function createBattle(teamA, teamB, opts = {}) {
    const b = {
        sides: [
            { name: opts.nameA || 'You', cards: teamA, active: 0, ai: false },
            { name: opts.nameB || 'Leader', cards: teamB, active: 0, ai: true }
        ],
        turn: 0, round: 1, over: false, winner: null, smart: opts.smart || 0, needSwitch: false
    };
    b.turn = teamA[0].spd >= teamB[0].spd ? 0 : 1;
    const ev = [{ k: 'start', first: b.turn }];
    startTurn(b, ev);
    // KI faengt an: gleich ziehen
    runAi(b, ev);
    return { b, ev };
}

const act = (b, s) => b.sides[s].cards[b.sides[s].active];
const alive = side => side.cards.filter(c => c.hp > 0);

function damage(att, def, atk) {
    let d = atk.dmg + att.boost;
    const weak = def.weak === att.type;
    if (weak) d *= WEAK;
    if (atk.effect !== 'pierce') d -= def.def * DEF_FACTOR;
    return { dmg: Math.max(10, Math.round(d)), weak };
}

// Zugbeginn: Energie, Brennen, Betaeubung
function startTurn(b, ev) {
    const s = b.turn;
    const c = act(b, s);
    c.energy++;
    ev.push({ k: 'energy', s, n: c.energy });
    if (c.burn > 0) {
        c.burn--;
        c.hp = Math.max(0, c.hp - BURN_DMG);
        ev.push({ k: 'burn', s, dmg: BURN_DMG, hp: c.hp });
        if (c.hp <= 0) return knockout(b, s, ev);
    }
    if (c.stun) {
        c.stun = false;
        // Kein Dauer-Betaeuben: bis nach der naechsten eigenen Aktion immun
        c.stunImmune = true;
        ev.push({ k: 'stunned', s });
        return endTurn(b, ev);
    }
}

// Heilen gegen Heilen soll nicht ewig dauern: nach MAX_ROUNDS gewinnt,
// wer anteilig mehr Leben uebrig hat
const MAX_ROUNDS = 40;
function hpShare(side) {
    const max = side.cards.reduce((a, c) => a + c.maxHp, 0);
    return side.cards.reduce((a, c) => a + Math.max(0, c.hp), 0) / max;
}

function endTurn(b, ev) {
    if (b.over) return;
    b.turn = 1 - b.turn;
    if (b.turn === 0) b.round++;
    if (b.round > MAX_ROUNDS) {
        b.over = true;
        b.winner = hpShare(b.sides[0]) >= hpShare(b.sides[1]) ? 0 : 1;
        ev.push({ k: 'timeout', winner: b.winner }, { k: 'end', winner: b.winner });
        return;
    }
    startTurn(b, ev);
}

// Aktive Karte von Seite s ist k.o.
function knockout(b, s, ev) {
    ev.push({ k: 'ko', s, id: act(b, s).id });
    const side = b.sides[s];
    if (!alive(side).length) {
        b.over = true;
        b.winner = 1 - s;
        ev.push({ k: 'end', winner: b.winner });
        return;
    }
    // Danach ist immer die andere Seite dran als die, deren Zug gerade lief
    // (Angriff haut um -> Getroffener ist dran; Brennen im eigenen Zug -> Gegner)
    const next = 1 - b.turn;
    if (side.ai) {
        side.active = bestSwitch(b, s, -1);
        ev.push({ k: 'switch', s, to: side.active, forced: true });
        b.turn = next;
        if (next === 0) b.round++;
        startTurn(b, ev);
    } else {
        // Spieler waehlt die naechste Karte
        b.needSwitch = true;
        b.nextTurn = next;
        ev.push({ k: 'choose', s });
    }
}

function attack(b, s, i, ev) {
    const me = act(b, s), foe = act(b, 1 - s);
    const atk = me.attacks[i];
    if (!atk || me.energy < atk.cost) return false;
    const { dmg, weak } = damage(me, foe, atk);
    me.energy -= atk.cost;
    foe.hp = Math.max(0, foe.hp - dmg);
    const e = { k: 'atk', s, i, name: atk.name, dmg, weak, eff: atk.effect, hp: foe.hp, en: me.energy };
    if (atk.effect === 'burn' && foe.hp > 0) foe.burn = BURN_TURNS;
    if (atk.effect === 'stun' && foe.hp > 0 && !foe.stunImmune) foe.stun = true;
    else if (atk.effect === 'stun' && foe.hp > 0) e.resist = true;
    me.stunImmune = false;
    if (atk.effect === 'heal') { me.hp = Math.min(me.maxHp, me.hp + HEAL); e.heal = HEAL; e.myHp = me.hp; }
    if (atk.effect === 'drain') { const hl = Math.round(dmg / 2); me.hp = Math.min(me.maxHp, me.hp + hl); e.heal = hl; e.myHp = me.hp; }
    if (atk.effect === 'boost') { me.boost += BOOST; e.boost = me.boost; }
    ev.push(e);
    if (foe.hp <= 0) {
        knockout(b, 1 - s, ev);
        // Spieler muss nach seinem K.o. erst waehlen; hat der Spieler die KI
        // umgehauen, wechselt die KI selbst (knockout macht den Zugwechsel)
        return true;
    }
    endTurn(b, ev);
    return true;
}

// ---------- KI ----------

// Wert einer Karte gegen den Gegner (fuer Wechsel)
function matchScore(me, foe) {
    let v = me.hp / me.maxHp * 40 + me.energy * 8;
    if (foe.weak === me.type) v += 30;
    if (me.weak === foe.type) v -= 30;
    return v;
}

function bestSwitch(b, s, skip) {
    const side = b.sides[s], foe = act(b, 1 - s);
    let best = -1, bv = -1e9;
    side.cards.forEach((c, i) => {
        if (c.hp <= 0 || i === skip) return;
        const v = matchScore(c, foe);
        if (v > bv) { bv = v; best = i; }
    });
    return best;
}

function aiChoose(b, s) {
    const me = act(b, s), foe = act(b, 1 - s);
    const opts = me.attacks.map((a, i) => ({ a, i, ...damage(me, foe, a) })).filter(o => me.energy >= o.a.cost);
    // Umhauen, wenn moeglich
    const kill = opts.filter(o => o.dmg >= foe.hp).sort((x, y) => x.a.cost - y.a.cost)[0];
    if (kill) return { a: 'atk', i: kill.i };
    // Schlaue Leiter wechseln bei schlechter Paarung
    if (b.smart >= 2 && me.weak === foe.type && Math.random() < 0.5) {
        const to = bestSwitch(b, s, b.sides[s].active);
        if (to !== b.sides[s].active && to >= 0 && b.sides[s].cards[to].weak !== foe.type) return { a: 'switch', to };
    }
    const big = me.attacks[1], small = me.attacks[0];
    const bigDmg = damage(me, foe, big).dmg, smallDmg = damage(me, foe, small).dmg;
    // Grosse Attacke geht: nehmen
    if (me.energy >= big.cost) return { a: 'atk', i: 1 };
    // Energie wird verbraucht (5.7): sparen lohnt, wenn die grosse pro Energie
    // mehr bringt als die kleine. Stufe 0 haut einfach drauf.
    const worth = bigDmg / big.cost > smallDmg / small.cost * 1.1;
    if (b.smart >= 1 && worth && me.hp > me.maxHp * 0.3) {
        // Aufladen, wenn die grosse dadurch naechsten Zug geht; sonst sparen (auch Aufladen)
        return { a: 'charge' };
    }
    if (me.energy >= small.cost) return { a: 'atk', i: 0 };
    return { a: 'charge' };
}

function runAi(b, ev) {
    let guard = 0;
    while (!b.over && !b.needSwitch && b.sides[b.turn].ai && guard++ < 200) {
        const s = b.turn;
        const c = aiChoose(b, s);
        // Sicherheitsnetz: ungueltiger Zug -> aufladen
        if (!doAct(b, s, c, ev)) doAct(b, s, { a: 'charge' }, ev);
    }
}

function doAct(b, s, c, ev) {
    const side = b.sides[s];
    if (c.a === 'atk') return attack(b, s, Number(c.i), ev);
    if (c.a === 'charge') {
        act(b, s).stunImmune = false;
        act(b, s).energy++;
        ev.push({ k: 'charge', s, n: act(b, s).energy });
        endTurn(b, ev);
        return true;
    }
    if (c.a === 'switch') {
        const to = Number(c.to);
        if (!side.cards[to] || side.cards[to].hp <= 0 || to === side.active) return false;
        act(b, s).stunImmune = false;
        side.active = to;
        ev.push({ k: 'switch', s, to });
        endTurn(b, ev);
        return true;
    }
    return false;
}

// Aktion des Spielers; danach zieht die KI. Liefert Ereignisse oder Fehlertext.
function play(b, c) {
    if (b.over) return { err: 'The battle is over' };
    const ev = [];
    if (c.a === 'forfeit') {
        b.over = true;
        b.winner = 1;
        ev.push({ k: 'forfeit' }, { k: 'end', winner: 1 });
        return { ev };
    }
    if (b.needSwitch) {
        const side = b.sides[0], to = Number(c.to);
        if (c.a !== 'switch' || !side.cards[to] || side.cards[to].hp <= 0) return { err: 'Pick your next card' };
        side.active = to;
        b.needSwitch = false;
        ev.push({ k: 'switch', s: 0, to, forced: true });
        b.turn = b.nextTurn;
        if (b.turn === 0) b.round++;
        startTurn(b, ev);
        runAi(b, ev);
        return { ev };
    }
    if (b.turn !== 0) return { err: 'Not your turn' };
    if (!doAct(b, 0, c, ev)) return { err: 'You cannot do that now' };
    runAi(b, ev);
    return { ev };
}

// Ansicht fuer den Browser
function view(b) {
    return {
        turn: b.turn, round: b.round, over: b.over, winner: b.winner, needSwitch: b.needSwitch,
        sides: b.sides.map(s => ({
            name: s.name, active: s.active,
            cards: s.cards.map(c => ({ id: c.id, v: c.v, hp: c.hp, maxHp: c.maxHp, energy: c.energy, burn: c.burn, stun: c.stun, boost: c.boost, def: c.def, attacks: c.attacks }))
        }))
    };
}

module.exports = { fighter, createBattle, play, view, damage, VAR_MUL, BURN_DMG, BURN_TURNS, HEAL, BOOST };
