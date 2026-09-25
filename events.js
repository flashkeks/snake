// Mini-Events: ausgeloest von der grossen 3x3-Event-Kiste. Das ganze Spiel
// friert ein, alle, die auf dem Feld waren, spielen ein Quiz, dann geht es weiter.
//
// Vier Arten, alle "reward": Punkte fuer gutes Spiel, daraus Coins (Konten)
// und Laenge (alle). Gluecksspiel gibt es hier nicht mehr – Blackjack und
// Roulette sind seit 23.09.2026 Dauertische im Casino (tables.js).
//
//   flags     Flagge sehen, Land waehlen (4 Antworten)
//   trivia    Allgemeinwissen, 4 Antworten
//   geo       "Where is ...?" – auf die Weltkarte klicken, Punkte nach Entfernung
//   estimate  Zahl schaetzen (Hoehe, Laenge, Jahr ...), Punkte nach Abweichung
//   cups      Huetchenspiel: Stein unter einem von 3 Bechern, die Becher
//             werden getauscht, dann tippen. Jede Runde mehr Zuege, schneller
//   maze, coinrush, tron   Map-Events (#6): alle spielen auf einer eigenen
//             kleinen Map ein Snake-Minispiel, Logik in minigames.js
//
// Der Server ist die einzige Wahrheit. Jede Aenderung geht als eine
// `event`-Nachricht mit dem ganzen oeffentlichen Zustand an alle.

const FLAGS = require('./flags');
const TRIVIA = require('./trivia');
const PLACES = require('./places');
const ESTIMATES = require('./estimates');
const createMinigame = require('./minigames');

const KINDS = {
    flags: { title: '🏳️ Flag Quiz', rounds: 6, ask: 9000, reveal: 2500 },
    trivia: { title: '🧠 Trivia', rounds: 6, ask: 12000, reveal: 3000 },
    geo: { title: '🌍 Where is it?', rounds: 5, ask: 15000, reveal: 5000 },
    estimate: { title: '📏 Guess the number', rounds: 5, ask: 15000, reveal: 5000 },
    cups: { title: '🥤 Shell Game', rounds: 5, ask: 6000, reveal: 2800 },
    maze: { title: createMinigame.GAMES.maze.title, minigame: true },
    coinrush: { title: createMinigame.GAMES.coinrush.title, minigame: true },
    tron: { title: createMinigame.GAMES.tron.title, minigame: true }
};

// Zeitraffer nur fuer lokale Tests (SNAKE_EVENT_SPEED=10 macht alles zehnmal schneller)
const SPEED = Number(process.env.SNAKE_EVENT_SPEED) || 1;
const MAX_PTS = 200;

// Belohnung (#4, 23.09.2026): Punkte × 1,5 als Coins, Platz-Boni fuer die
// Top 3, alles mal einem Faktor fuer die Spielerzahl (1 + 0,5 je weiterem
// Spieler, hoechstens ×3). Zum Vergleich: ein Snake-Cashout brachte bis
// dahin im Schnitt ~1230 Coins. Laenge wie bisher: Punkte / 40.
// 23.09.2026 (Max: "zu op"): Coins auf ein Drittel, dafuer dreimal so viel Laenge
const COINS_PER_POINT = 0.5;
const PLACE_BONUS = [250, 120, 60];
const POINTS_PER_LENGTH = 12;

function playerFactor(n) {
    return Math.min(3, 1 + 0.5 * Math.max(0, n - 1));
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Grosskreis-Entfernung in km
function distanceKm(a, b) {
    const R = 6371;
    const rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 0 km = 200, 500 km ~ 143, 1500 km ~ 74, 3000 km ~ 27
function geoPoints(km) {
    return Math.round(MAX_PTS * Math.exp(-km / 1500));
}

// Verhaeltnis: exakt = 200, Faktor 1,5 daneben ~ 126, Faktor 3 = 0.
// Mit tol (Jahreszahlen): linear bis zur absoluten Toleranz.
function estimatePoints(q, guess) {
    if (q.tol) return Math.round(MAX_PTS * Math.max(0, 1 - Math.abs(guess - q.a) / q.tol));
    if (guess <= 0) return 0;
    const e = Math.abs(Math.log(guess / q.a));
    return Math.round(MAX_PTS * Math.max(0, 1 - e / Math.log(3)));
}

module.exports = function createEvents(h) {
    // h: { accounts, broadcast, feed, send, grow, onEnd }
    let ev = null;

    function phase(name, ms) {
        ev.phase = name;
        ev.phaseEnds = ms ? Date.now() + ms / SPEED : null;
        ev.phaseTotal = ms || null;
    }

    function participant(c) {
        return ev && ev.members.get(c.id);
    }

    function board() {
        const rows = [...ev.members.values()].map(m => ({
            id: m.id, name: m.name, color: m.color, guest: m.guest,
            value: ev.score.get(m.id) || 0
        }));
        return rows.sort((a, b) => b.value - a.value);
    }

    function push() {
        if (!ev) return;
        h.broadcast({
            type: 'event',
            kind: ev.kind,
            title: KINDS[ev.kind].title,
            eventType: 'reward',
            phase: ev.phase,
            left: ev.phaseEnds ? Math.max(0, ev.phaseEnds - Date.now()) : null,
            total: ev.phaseTotal,
            members: [...ev.members.keys()],
            board: board(),
            podium: ev.phase === 'awards' ? ev.podium : null,
            data: publicData()
        });
    }

    function publicData() {
        const q = ev.q;
        const reveal = ev.phase === 'reveal';
        if (ev.mg) {
            return {
                map: ev.map,
                rewards: ev.rewards || null,
                factor: ev.factor || playerFactor(ev.members.size)
            };
        }
        const out = {
            round: ev.round,
            total: KINDS[ev.kind].rounds,
            answered: q ? [...q.answers.keys()] : [],
            rewards: ev.rewards || null,
            factor: ev.factor || playerFactor(ev.members.size)
        };
        if (!q) return out;
        if (ev.kind === 'flags' || ev.kind === 'trivia') {
            Object.assign(out, {
                flag: q.flag || null,
                question: q.text || null,
                options: q.options,
                correct: reveal ? q.correct : null,
                right: reveal ? [...q.answers].filter(([, a]) => a.choice === q.correct).map(([id]) => id) : []
            });
        }
        if (ev.kind === 'geo') {
            Object.assign(out, {
                place: q.place.name,
                hint: q.place.hint,
                target: reveal ? { lat: q.place.lat, lon: q.place.lon } : null,
                guesses: reveal ? guessList(q, a => ({ lat: a.lat, lon: a.lon, km: Math.round(a.km) })) : []
            });
        }
        if (ev.kind === 'cups') {
            Object.assign(out, {
                ...q.cups,
                correct: reveal ? q.correct : null,
                picks: reveal ? guessList(q, a => ({ choice: a.choice })) : []
            });
        }
        if (ev.kind === 'estimate') {
            Object.assign(out, {
                question: q.item.q,
                unit: q.item.unit,
                answer: reveal ? q.item.a : null,
                guesses: reveal ? guessList(q, a => ({ value: a.value, closest: !!a.closest })) : []
            });
        }
        return out;
    }

    function guessList(q, fields) {
        return [...q.answers].map(([id, a]) => {
            const m = ev.members.get(id);
            return { id, name: m.name, color: m.color, pts: a.pts, ...fields(a) };
        }).sort((x, y) => y.pts - x.pts);
    }

    // ---------- Start / Ende ----------

    function start(players, forced) {
        if (ev || !players.length) return false;
        const kind = KINDS[forced] ? forced : shuffle(Object.keys(KINDS))[0];
        ev = {
            kind,
            members: new Map(players.map(p => [p.id, { id: p.id, name: p.name, color: p.color, guest: !p.account, account: p.account, player: p }])),
            score: new Map(),
            started: Date.now(),
            round: 0,
            q: null,
            pool: KINDS[kind].minigame || kind === 'cups' ? [] : shuffle([...{ flags: FLAGS, trivia: TRIVIA, geo: PLACES, estimate: ESTIMATES }[kind]])
        };
        if (KINDS[kind].minigame) {
            ev.mg = createMinigame(kind, [...ev.members.values()]);
            ev.map = ev.mg.statics();
            phase('intro', 5000);
        } else phase('intro', 4000);
        h.feed(`🎪 EVENT: ${KINDS[kind].title}!`, 'gold', null, true);
        push();
        // Map-Event: Startplaetze schon im Intro zeigen (6.4, Max)
        if (ev.mg) sendFrame(true);
        return true;
    }

    function nextQuestion() {
        ev.round++;
        const k = ev.kind;
        const item = ev.pool.pop();
        const q = { answers: new Map(), asked: Date.now() };
        if (k === 'flags') {
            const wrong = shuffle(FLAGS.filter(f => f.code !== item.code)).slice(0, 3);
            const options = shuffle([item, ...wrong]);
            q.flag = item.code;
            q.options = options.map(o => o.name);
            q.correct = options.indexOf(item);
        } else if (k === 'trivia') {
            q.text = item.q;
            q.options = shuffle([item.a, ...item.w]);
            q.correct = q.options.indexOf(item.a);
        } else if (k === 'geo') {
            q.place = item;
        } else if (k === 'cups') {
            // Runde 1: 5 Tausche a 560 ms, Runde 5: 13 Tausche a 280 ms
            const start = Math.floor(Math.random() * 3);
            const n = 3 + 2 * ev.round;
            const moveMs = Math.max(250, 560 - 70 * (ev.round - 1));
            const moves = [];
            let pos = start;
            for (let i = 0; i < n; i++) {
                const a = Math.floor(Math.random() * 3);
                const b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
                moves.push([a, b]);
                if (pos === a) pos = b;
                else if (pos === b) pos = a;
            }
            q.cups = { start, moves, moveMs, showMs: 1800 };
            q.correct = pos;
            ev.q = q;
            // erst zeigen und mischen, dann tippen (tick() schaltet auf 'question')
            phase('shuffle', q.cups.showMs + n * moveMs + 400);
            return;
        } else {
            q.item = item;
        }
        ev.q = q;
        phase('question', KINDS[k].ask);
    }

    function reveal() {
        const q = ev.q;
        // Schaetzen: wer am naechsten dran ist, bekommt 50 extra
        if (ev.kind === 'estimate' && q.answers.size) {
            const best = Math.min(...[...q.answers.values()].map(a => Math.abs(a.value - q.item.a)));
            for (const [id, a] of q.answers) {
                if (Math.abs(a.value - q.item.a) === best && a.pts > 0) {
                    a.pts += 50;
                    a.closest = true;
                    ev.score.set(id, (ev.score.get(id) || 0) + 50);
                }
            }
        }
        phase('reveal', KINDS[ev.kind].reveal);
    }

    // Coins fuer Konten, Laenge fuer alle. Der Beste bekommt 50 extra.
    function results() {
        const rows = board();
        const f = playerFactor(rows.length);
        ev.rewards = {};
        ev.factor = f;
        rows.forEach((r, i) => {
            const m = ev.members.get(r.id);
            const bonus = r.value > 0 ? PLACE_BONUS[i] || 0 : 0;
            if (m.account) {
                // #5: Teilnahme, Sieg (Platz 1 mit Punkten)
                const won = i === 0 && r.value > 0;
                h.accounts.stat(m.account, s => {
                    s.eventsPlayed++;
                    if (won) s.eventWins++;
                });
                if (won) h.accounts.period(m.account, x => { x.eventWins++; });
            }
            let coins = Math.floor((r.value * COINS_PER_POINT + bonus) * f);
            const length = Math.floor(r.value / POINTS_PER_LENGTH);
            if (m.account && coins > 0) {
                h.accounts.addCoins(m.account, coins);
                h.accounts.earn(m.account, 'events', coins);
            } else coins = 0;
            if (length > 0) h.grow(m.player, length);
            ev.rewards[r.id] = { coins, length };
            if (m.account) h.send(m.player, { type: 'account', user: h.accounts.publicUser(h.accounts.get(m.account)) });
        });
        if (rows[0] && rows[0].value > 0) h.feed(`${KINDS[ev.kind].title}: ${rows[0].name} wins with ${rows[0].value} points`, 'good');
        ev.q = null;
        // 6.5.1 (Max): Nachspann kuerzer – Ergebnis 8 -> 4 s, Podium 5 -> 3 s
        phase('results', 4000);
    }

    // Podium der Top 3; daraus kommt danach Double or Nothing (server.js)
    function awards() {
        ev.podium = board().slice(0, 3).map(r => ({ ...r, ...(ev.rewards[r.id] || { coins: 0, length: 0 }) }));
        phase('awards', 3000);
    }

    function end() {
        const done = ev;
        ev = null;
        h.broadcast({ type: 'eventEnd' });
        h.onEnd(done);
    }

    // ---------- Ablauf ----------

    // Map-Event: Schritte an die Mitspieler, Rangliste einmal je Sekunde
    function sendFrame(intro) {
        const f = ev.mg.frame(intro);
        for (const m of ev.members.values()) h.send(m.player, f);
    }

    function mgTick() {
        if (ev.mg.tick()) {
            sendFrame();
            ev.score = ev.mg.scores();
        }
        if (ev.mg.done) {
            ev.score = ev.mg.scores();
            results();
            push();
            return;
        }
        if (Date.now() - (ev.lastPush || 0) > 1000) {
            ev.lastPush = Date.now();
            push();
        }
    }

    function tick() {
        if (ev && ev.phase === 'play') return mgTick();
        if (!ev || !ev.phaseEnds || Date.now() < ev.phaseEnds) return;
        if (ev.phase === 'awards') return end();
        if (ev.mg && ev.phase === 'intro') {
            // Spielzeit steht im Minispiel; die Leiste oben zeigt sie an
            ev.phase = 'play';
            ev.phaseEnds = ev.mg.ends;
            ev.phaseTotal = createMinigame.GAMES[ev.kind].play;
            sendFrame();
            push();
            return;
        }
        if (ev.phase === 'results') awards();
        else if (ev.phase === 'shuffle') {
            ev.q.asked = Date.now();
            phase('question', KINDS[ev.kind].ask);
        } else if (ev.phase === 'question') reveal();
        else if (ev.phase === 'intro' || ev.phase === 'reveal') {
            if (ev.round >= KINDS[ev.kind].rounds) results();
            else nextQuestion();
        }
        push();
    }

    // ---------- Steuerung im Map-Event ----------

    // true = Richtung ging ans Minispiel (dann nicht an die Hauptwelt)
    function direction(c, dir) {
        if (!ev || !ev.mg || !participant(c)) return false;
        if (ev.phase === 'play') ev.mg.steer(c.id, dir);
        return true;
    }

    // ---------- Antworten ----------

    function handle(c, data) {
        const m = participant(c);
        if (!m) return h.send(c, { type: 'eventError', error: 'You were not on the field when the event started' });
        const q = ev.q;
        if (ev.phase !== 'question' || !q || q.answers.has(c.id)) return;
        const ms = Date.now() - q.asked;
        const ask = KINDS[ev.kind].ask / SPEED;
        let pts = 0;

        if (ev.kind === 'cups') {
            const choice = Number(data.choice);
            if (!(Number.isInteger(choice) && choice >= 0 && choice < 3)) return;
            // Richtig: 100, spaetere Runden mehr, dazu bis 50 Tempobonus
            if (choice === q.correct) pts = 100 + 20 * (ev.round - 1) + Math.round(50 * Math.max(0, ask - ms) / ask);
            q.answers.set(c.id, { choice, ms, pts });
        } else if (ev.kind === 'flags' || ev.kind === 'trivia') {
            const choice = Number(data.choice);
            if (!(Number.isInteger(choice) && choice >= 0 && choice < 4)) return;
            // Schnellere Antworten bringen mehr: 100 + bis zu 100 Tempobonus
            if (choice === q.correct) pts = 100 + Math.round(100 * Math.max(0, ask - ms) / ask);
            q.answers.set(c.id, { choice, ms, pts });
        } else if (ev.kind === 'geo') {
            const lat = Number(data.lat), lon = Number(data.lon);
            if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) return;
            const km = distanceKm({ lat, lon }, q.place);
            pts = geoPoints(km);
            q.answers.set(c.id, { lat, lon, km, pts });
        } else {
            const value = Number(data.value);
            if (!Number.isFinite(value) || value < 0 || value > 1e12) return;
            pts = estimatePoints(q.item, value);
            q.answers.set(c.id, { value, pts });
        }
        if (pts) ev.score.set(c.id, (ev.score.get(c.id) || 0) + pts);

        // Alle haben geantwortet: gleich aufloesen
        if (q.answers.size >= ev.members.size) reveal();
        push();
    }

    return {
        start,
        tick,
        handle,
        direction,
        leave() {},     // Events brauchen beim Gehen nichts aufzuraeumen
        active: () => !!ev,
        // Nur fuer Tests: interner Zustand
        _state: () => ev,
        push,
        isMember: id => !!(ev && ev.members.has(id))
    };
};

module.exports.KINDS = KINDS;
module.exports.distanceKm = distanceKm;
module.exports.geoPoints = geoPoints;
module.exports.estimatePoints = estimatePoints;

module.exports.playerFactor = playerFactor;
module.exports.PLACE_BONUS = PLACE_BONUS;
