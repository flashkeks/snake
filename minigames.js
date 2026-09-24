// Map-Events (#6): alle, die auf dem Feld waren, landen auf einer eigenen
// kleinen Map und spielen dort als Schlange ein Minispiel. Die Hauptwelt
// steht solange (Event-Pause wie bei den Quiz-Events).
//
//   maze      Labyrinth: wer zuerst am Ziel ist. Waende blocken nur, andere
//             Schlangen faehrt man durch. Wer in eine Sackgasse faehrt (Feld
//             mit nur einem freien Nachbarn), muss zurueck an den Start.
//   coinrush  Coin Rush: in der Zeit die meisten Muenzen. Crash = 2 s Pause,
//             dann neu, gesammelte Muenzen bleiben.
//   tron      Last Snake Standing: jeder zieht eine Spur, die nie kuerzer
//             wird. Wer irgendwo reinfaehrt, ist raus. Der Letzte gewinnt.
//
// Der Server rechnet alles; der Browser bekommt je Schritt eine kompakte
// `mg`-Nachricht und zeichnet nur. Punkte liegen in derselben Groessenordnung
// wie bei den Quiz-Events (Sieger ~800–900), die Belohnung rechnet events.js.

const SPEED = Number(process.env.SNAKE_EVENT_SPEED) || 1;

const GAMES = {
    maze: { title: '🌀 Labyrinth', w: 21, h: 21, step: 130, play: 90000 },
    coinrush: { title: '🪙 Coin Rush', w: 36, h: 26, step: 115, play: 60000 },
    tron: { title: '⚡ Last Snake Standing', w: 40, h: 28, step: 110, play: 90000 }
};

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Labyrinth per Backtracking auf den ungeraden Feldern; true = Wand
function makeMaze(w, h) {
    const wall = Array.from({ length: h }, () => new Array(w).fill(true));
    const stack = [[1, 1]];
    wall[1][1] = false;
    while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const next = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]])
            .map(([dx, dy]) => [x + dx, y + dy, dx, dy])
            .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && wall[ny][nx]);
        if (!next.length) {
            stack.pop();
            continue;
        }
        const [nx, ny, dx, dy] = next[0];
        wall[y + dy / 2][x + dx / 2] = false;
        wall[ny][nx] = false;
        stack.push([nx, ny]);
    }
    // Ein paar Extra-Durchbrueche, damit es mehr als einen Weg gibt
    for (let k = 0; k < Math.floor(w * h / 40); k++) {
        const x = 1 + Math.floor(Math.random() * (w - 2));
        const y = 1 + Math.floor(Math.random() * (h - 2));
        if ((x + y) % 2 === 1) wall[y][x] = false;
    }
    return wall;
}

// Offenes Feld mit Rand und ein paar Bloecken
function makeArena(w, h, blocks) {
    const wall = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => x === 0 || y === 0 || x === w - 1 || y === h - 1));
    for (let k = 0; k < blocks; k++) {
        const bw = 2 + Math.floor(Math.random() * 3), bh = 2 + Math.floor(Math.random() * 3);
        const x = 4 + Math.floor(Math.random() * (w - 8 - bw));
        const y = 4 + Math.floor(Math.random() * (h - 8 - bh));
        for (let yy = y; yy < y + bh; yy++) for (let xx = x; xx < x + bw; xx++) wall[yy][xx] = true;
    }
    return wall;
}

// Abstand jedes Felds zum Ziel (Breitensuche), -1 = unerreichbar
function distances(wall, gx, gy) {
    const h = wall.length, w = wall[0].length;
    const d = Array.from({ length: h }, () => new Array(w).fill(-1));
    const q = [[gx, gy]];
    d[gy][gx] = 0;
    while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of Object.values(DIRS)) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && !wall[ny][nx] && d[ny][nx] < 0) {
                d[ny][nx] = d[y][x] + 1;
                q.push([nx, ny]);
            }
        }
    }
    return d;
}

module.exports = function createMinigame(kind, members) {
    // members: [{ id, name, color }]
    const G = GAMES[kind];
    const W = G.w, H = G.h;
    const started = Date.now();
    const ends = started + G.play / SPEED;
    let lastStep = started;
    let done = false;
    let stepNo = 0;
    const wall = kind === 'maze' ? makeMaze(W, H) : makeArena(W, H, kind === 'coinrush' ? 6 : 3);
    const goal = kind === 'maze' ? { x: W - 2, y: H - 2 } : null;
    const dist = goal ? distances(wall, goal.x, goal.y) : null;
    const coins = [];
    const finished = [];     // maze: Reihenfolge am Ziel
    const eliminated = [];   // tron: [[ids], ...] in der Reihenfolge des Ausscheidens

    const snakes = new Map();
    const free = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && !wall[y][x];
    // Sackgasse: nur ein freier Nachbar (Start und Ziel ausgenommen)
    const deadEnd = (x, y) => !(x === 1 && y === 1) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => free(x + dx, y + dy)).length === 1;

    function occupied() {
        const set = new Set();
        for (const s of snakes.values()) if (s.alive) for (const [x, y] of s.body) set.add(y * W + x);
        return set;
    }

    function randomFree(margin) {
        const occ = occupied();
        for (let k = 0; k < 500; k++) {
            const x = margin + Math.floor(Math.random() * (W - 2 * margin));
            const y = margin + Math.floor(Math.random() * (H - 2 * margin));
            if (free(x, y) && !occ.has(y * W + x) && !coins.some(c => c.x === x && c.y === y)) return { x, y };
        }
        return { x: Math.floor(W / 2), y: Math.floor(H / 2) };
    }

    // Wie viele Felder geradeaus frei sind (Waende, Koerper, Koepfe im Umkreis)
    function runway(x, y, d, occ, max) {
        let n = 0;
        for (let k = 1; k <= max; k++) {
            const nx = x + d[0] * k, ny = y + d[1] * k;
            if (!free(nx, ny) || occ.has(ny * W + nx)) break;
            n++;
        }
        return n;
    }

    // Spawnplatz mit Auslauf (6.4, Max: bei Coin Rush spawnte man oft vor
    // einer Wand und war sofort wieder tot). Nimmt die Richtung mit dem
    // laengsten freien Weg, bevorzugt zur Mitte; kein anderer Kopf in der Naehe.
    function safeSpawn(margin, prefer) {
        const occ = occupied();
        const heads = [...snakes.values()].filter(s => s.alive).map(s => s.body[0]);
        let best = null;
        for (let k = 0; k < 300; k++) {
            const p = k === 0 && prefer ? prefer : {
                x: margin + Math.floor(Math.random() * (W - 2 * margin)),
                y: margin + Math.floor(Math.random() * (H - 2 * margin))
            };
            if (!free(p.x, p.y) || occ.has(p.y * W + p.x)) continue;
            if (heads.some(([hx, hy]) => Math.abs(hx - p.x) + Math.abs(hy - p.y) < 4)) continue;
            const toMid = Math.abs(p.x - W / 2) > Math.abs(p.y - H / 2) ? (p.x > W / 2 ? 'left' : 'right') : (p.y > H / 2 ? 'up' : 'down');
            for (const name of [toMid, ...Object.keys(DIRS).filter(n => n !== toMid)]) {
                const r = runway(p.x, p.y, DIRS[name], occ, 8);
                if (!best || r > best.r) best = { x: p.x, y: p.y, dir: name, r };
                if (r >= 6) return best;
            }
        }
        return best || { x: Math.floor(W / 2), y: Math.floor(H / 2), dir: 'right' };
    }

    // Startplaetze: Labyrinth alle oben links, sonst im Kreis verteilt mit Blick zur Mitte
    members.forEach((m, i) => {
        let x, y, dir;
        if (kind === 'maze') {
            x = 1; y = 1; dir = 'right';
        } else {
            const a = i / members.length * Math.PI * 2;
            x = Math.round(W / 2 + Math.cos(a) * (W / 2 - 4));
            y = Math.round(H / 2 + Math.sin(a) * (H / 2 - 4));
            // Richtung zur Mitte
            dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'left' : 'right') : (Math.sin(a) > 0 ? 'up' : 'down');
            // Start auf/vor einer Wand (Bloecke): sicheren Platz suchen
            if (!free(x, y) || runway(x, y, DIRS[dir], occupied(), 6) < 6) ({ x, y, dir } = safeSpawn(3, free(x, y) ? { x, y } : null));
        }
        const len = kind === 'tron' ? 1 : kind === 'maze' ? 3 : 4;
        snakes.set(m.id, {
            id: m.id, name: m.name, color: m.color,
            body: Array.from({ length: len }, () => [x, y]),
            dir: DIRS[dir], next: DIRS[dir], moved: DIRS[dir],
            alive: true, respawnAt: 0, coins: 0, finishedAt: null, grow: 0, resets: 0
        });
    });

    function spawnCoins() {
        while (kind === 'coinrush' && coins.length < 10 + snakes.size * 2) coins.push(randomFree(2));
    }
    spawnCoins();

    // Richtung setzen (kein 180°-Wenden, gemessen am letzten echten Schritt)
    function steer(id, name) {
        const s = snakes.get(id);
        const d = DIRS[name];
        if (!s || !d || done) return false;
        if (s.body.length > 1 && d[0] === -s.moved[0] && d[1] === -s.moved[1]) return true;
        s.next = d;
        return true;
    }

    function kill(s, now) {
        s.alive = false;
        s.diedAt = now;
        // 6.4: 1 s statt 2 s (Max: dauerte zu lange)
        if (kind === 'coinrush') s.respawnAt = now + 1000 / SPEED;
    }

    function step(now) {
        stepNo++;
        const moving = [...snakes.values()].filter(s => s.alive && s.finishedAt === null);
        // Neue Kopfpositionen
        const heads = new Map();
        for (const s of moving) {
            s.dir = s.next;
            const [hx, hy] = s.body[0];
            heads.set(s, [hx + s.dir[0], hy + s.dir[1]]);
        }

        if (kind === 'maze') {
            for (const s of moving) {
                const [nx, ny] = heads.get(s);
                if (!free(nx, ny)) continue;   // Wand: stehen bleiben
                s.body.unshift([nx, ny]);
                s.body.pop();
                s.moved = s.dir;
                if (nx === goal.x && ny === goal.y) {
                    s.finishedAt = now;
                    finished.push(s.id);
                } else if (deadEnd(nx, ny)) {
                    // Sackgasse: zurueck an den Start (Wunsch Max)
                    s.body = s.body.map(() => [1, 1]);
                    s.dir = s.next = s.moved = DIRS.right;
                    s.resets++;
                }
            }
            if (finished.length === snakes.size) done = true;
            return;
        }

        // coinrush / tron: Crash an Wand, Koerpern (auch dem eigenen) und Kopf an Kopf
        const occ = new Set();
        for (const s of snakes.values()) {
            if (!s.alive) continue;
            // Das Schwanzende ruecket weiter, ausser die Schlange waechst
            const tailMoves = kind === 'coinrush' && s.grow === 0 && moving.includes(s);
            const body = tailMoves ? s.body.slice(0, -1) : s.body;
            for (const [x, y] of body) occ.add(y * W + x);
        }
        const headCount = new Map();
        for (const [nx, ny] of heads.values()) headCount.set(ny * W + nx, (headCount.get(ny * W + nx) || 0) + 1);
        const dying = [];
        for (const s of moving) {
            const [nx, ny] = heads.get(s);
            const k = ny * W + nx;
            if (!free(nx, ny) || occ.has(k) || headCount.get(k) > 1) dying.push(s);
        }
        for (const s of moving) {
            if (dying.includes(s)) continue;
            const [nx, ny] = heads.get(s);
            s.body.unshift([nx, ny]);
            s.moved = s.dir;
            if (kind === 'tron') continue;   // Spur bleibt
            const ci = coins.findIndex(c => c.x === nx && c.y === ny);
            if (ci >= 0) {
                coins.splice(ci, 1);
                s.coins++;
                s.grow++;
            }
            if (s.grow > 0) s.grow--;
            else s.body.pop();
        }
        for (const s of dying) kill(s, now);
        if (kind === 'tron' && dying.length) eliminated.push(dying.map(s => s.id));
        if (kind === 'coinrush') spawnCoins();
        if (kind === 'tron') {
            const alive = [...snakes.values()].filter(s => s.alive);
            if (snakes.size > 1 ? alive.length <= 1 : alive.length === 0) done = true;
        }
    }

    function respawns(now) {
        if (kind !== 'coinrush') return;
        for (const s of snakes.values()) {
            if (s.alive || now < s.respawnAt) continue;
            const p = safeSpawn(3);
            s.body = Array.from({ length: 4 }, () => [p.x, p.y]);
            s.alive = true;
            s.grow = 0;
            s.dir = s.next = s.moved = DIRS[p.dir];
        }
    }

    // true = neuer Schritt, neu senden
    function tick() {
        if (done) return false;
        const now = Date.now();
        if (now >= ends) {
            done = true;
            return true;
        }
        if (now - lastStep < G.step / SPEED) return false;
        lastStep = now;
        respawns(now);
        step(now);
        return true;
    }

    // Punkte je Spieler (Map id -> pts), am Ende und live fuer die Rangliste
    function scores() {
        const out = new Map();
        const secs = s => Math.round(((s.diedAt || Math.min(Date.now(), ends)) - started) / 1000 * SPEED);
        if (kind === 'maze') {
            const d0 = dist[1][1];
            for (const s of snakes.values()) {
                const i = finished.indexOf(s.id);
                if (i >= 0) out.set(s.id, Math.max(300, 900 - 150 * i));
                else {
                    const [x, y] = s.body[0];
                    const d = dist[y][x] < 0 ? d0 : dist[y][x];
                    out.set(s.id, Math.max(0, Math.round(300 * (1 - d / d0))));
                }
            }
        } else if (kind === 'coinrush') {
            for (const s of snakes.values()) out.set(s.id, s.coins * 25);
        } else {
            // Rang: wer zuletzt noch lebt bzw. zuletzt rausflog, ist vorn
            const groups = [...eliminated];
            const alive = [...snakes.values()].filter(s => s.alive).map(s => s.id);
            if (alive.length) groups.push(alive);
            groups.reverse().forEach((ids, r) => {
                for (const id of ids) {
                    const s = snakes.get(id);
                    out.set(id, snakes.size > 1 ? Math.max(100, 800 - 200 * r) + 5 * secs(s) : Math.min(800, 15 * secs(s)));
                }
            });
        }
        return out;
    }

    // Einmal je Phase (Map, Ziel) – gross, aber nur beim Start
    function statics() {
        const walls = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (wall[y][x]) walls.push(y * W + x);
        return { game: kind, title: G.title, w: W, h: H, walls, goal };
    }

    // Je Schritt, kompakt
    // intro: vor dem Start, damit jeder seinen Startplatz und die Richtung sieht
    function frame(intro) {
        return {
            type: 'mg',
            intro: !!intro,
            left: Math.max(0, ends - Date.now()),
            snakes: [...snakes.values()].map(s => ({
                id: s.id, n: s.name, c: s.color, a: s.alive, f: s.finishedAt !== null,
                b: s.body.flat(), k: s.coins, r: s.resets, d: s.dir
            })),
            coins: coins.flatMap(c => [c.x, c.y]),
            fin: finished
        };
    }

    return {
        tick, steer, scores, statics, frame,
        get done() { return done; },
        ends
    };
};

module.exports.GAMES = GAMES;
