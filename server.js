const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3000;
const PUBLIC = path.join(__dirname, 'public');
const SCORES_FILE = path.join(__dirname, 'highscores.json');

const server = http.createServer((req, res) => {
    let file = req.url === '/' ? '/index.html' : req.url;
    file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(PUBLIC, file);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end('404');
        }

        const ext = path.extname(filePath);
        const types = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css'
        };

        res.writeHead(200, {
            'Content-Type': types[ext] || 'application/octet-stream'
        });
        res.end(data);
    });
});

const wss = new WebSocket.Server({ server, path: '/ws' });

// Nur Spieler, die ueber das Namensmenue beigetreten sind. Zuschauer stehen in `clients`.
const players = new Map();
const clients = new Map();

const SIZE = 40;
// Ein Tick = 60 ms. Normal bewegt man sich jeden 2. Tick (wie frueher alle 120 ms),
// mit Turbo jeden Tick, als Schnecke jeden 3.
const TICK = 60;
const EVERY = { fast: 1, normal: 2, slow: 3 };
const START_LEN = 6;
// Obergrenze, damit ×100 nicht das ganze Feld (1600 Zellen) und die Leitung sprengt
const MAX_LEN = 600;
const DUEL_MS = 4500;
const GAMBLE_MS = 4500;
const BOX_MS = 1600;

const FRUITS = 8;
const BOXES = 4;
const COINS = 2;

// Fruechte: je seltener, desto mehr Laenge
const FRUIT_KINDS = [
    { kind: 'apple', icon: '🍎', value: 1, weight: 50 },
    { kind: 'banana', icon: '🍌', value: 2, weight: 24 },
    { kind: 'grapes', icon: '🍇', value: 3, weight: 14 },
    { kind: 'melon', icon: '🍉', value: 5, weight: 8 },
    { kind: 'cherry', icon: '🍒', value: 10, weight: 3 },
    { kind: 'mango', icon: '🥭', value: 20, weight: 1 }
];
const FRUIT = Object.fromEntries(FRUIT_KINDS.map(f => [f.kind, f]));

// Farbauswahl im Startmenue. Frei gewaehlte Farben gehen auch, nur nicht zu dunkel.
const PALETTE = ['#ff4d4d', '#ff9f1a', '#ffd23f', '#b5ff3b', '#00ff88', '#18e0d0',
    '#3da5ff', '#5b6cff', '#a45bff', '#ff5bd6', '#ff8fa3', '#f2f2f2'];

// Seltenheit wie bei CS:GO: grey < blue < purple < pink < red < gold.
// `bad` und `dead` sind die Nieten.
const BOX_OUTCOMES = [
    { key: 'speed', icon: '⚡', label: 'Turbo', good: true, rarity: 'blue', weight: 10 },
    { key: 'shield', icon: '🛡️', label: 'Schild', good: true, rarity: 'blue', weight: 9 },
    { key: 'grow', icon: '🍄', label: '+5', good: true, rarity: 'blue', weight: 10 },
    { key: 'applerain', icon: '🍉', label: 'Obstregen', good: true, rarity: 'blue', weight: 6 },
    { key: 'teleport', icon: '🌀', label: 'Teleport', good: null, rarity: 'blue', weight: 5 },
    { key: 'ghost', icon: '👻', label: 'Geist', good: true, rarity: 'purple', weight: 7 },
    { key: 'magnet', icon: '🧲', label: 'Magnet', good: true, rarity: 'purple', weight: 6 },
    { key: 'invisible', icon: '🫥', label: 'Unsichtbar', good: true, rarity: 'purple', weight: 5 },
    { key: 'slowall', icon: '🐢', label: 'Zeitlupe fuer alle', good: true, rarity: 'purple', weight: 5 },
    { key: 'swap', icon: '🔀', label: 'Tausch', good: null, rarity: 'pink', weight: 4 },
    { key: 'bomb', icon: '💥', label: 'Schockwelle', good: true, rarity: 'pink', weight: 5 },
    { key: 'ice', icon: '🧊', label: 'Eisblock', good: true, rarity: 'pink', weight: 5 },
    { key: 'steal', icon: '🤏', label: 'Diebstahl', good: true, rarity: 'red', weight: 4 },
    { key: 'star', icon: '⭐', label: 'Stern', good: true, rarity: 'gold', weight: 3 },
    { key: 'jackpot', icon: '💎', label: 'Jackpot +12', good: true, rarity: 'gold', weight: 3 },
    { key: 'slow', icon: '🐌', label: 'Schnecke', good: false, rarity: 'bad', weight: 9 },
    { key: 'reverse', icon: '🔄', label: 'Verdreht', good: false, rarity: 'bad', weight: 7 },
    { key: 'half', icon: '✂️', label: 'Halbiert', good: false, rarity: 'bad', weight: 6 },
    { key: 'death', icon: '💀', label: 'Pech', good: false, rarity: 'dead', weight: 2 }
];

// Goldmuenze: Double or Nothing
const COIN_OUTCOMES = [
    { key: 'half', icon: '÷2', label: 'Halbiert', good: false, rarity: 'bad', weight: 38, mul: 0.5 },
    { key: 'x2', icon: '×2', label: 'Verdoppelt', good: true, rarity: 'blue', weight: 40, mul: 2 },
    { key: 'x3', icon: '×3', label: 'Verdreifacht', good: true, rarity: 'purple', weight: 10, mul: 3 },
    { key: 'x5', icon: '×5', label: 'Fuenffach', good: true, rarity: 'pink', weight: 5, mul: 5 },
    { key: 'x10', icon: '×10', label: 'ZEHNFACH', good: true, rarity: 'gold', weight: 2, mul: 10 },
    { key: 'x20', icon: '×20', label: 'ZWANZIGFACH', good: true, rarity: 'gold', weight: 0.8, mul: 20 },
    { key: 'x50', icon: '×50', label: 'FUENFZIGFACH', good: true, rarity: 'mythic', weight: 0.3, mul: 50 },
    { key: 'x100', icon: '×100', label: 'HUNDERTFACH', good: true, rarity: 'mythic', weight: 0.1, mul: 100 },
    { key: 'death', icon: '💀', label: 'Tot', good: false, rarity: 'dead', weight: 5, mul: 0 }
];

const DURATION = {
    speed: 8000, ghost: 6000, shield: 15000, slow: 4000, reverse: 6000, slowall: 3000,
    magnet: 10000, invisible: 7000, ice: 3000, star: 6000,
    // Wer ×10 oder mehr zieht, leuchtet so lange fuer alle
    jackpot: 8000,
    // Kurzer Schutz nach dem Muenzwurf, falls jemand gerade durch einen durchfaehrt
    afterGamble: 1500
};

const STREAKS = { 2: 'DOPPELKILL', 3: 'TRIPLEKILL', 5: 'RAMPAGE', 8: 'GODLIKE' };

const items = [];
const freezes = [];
const chatLog = [];

const key = p => p.x + ',' + p.y;

function rand(min, max) {
    return min + Math.floor(Math.random() * (max - min));
}

function weighted(list) {
    let r = Math.random() * list.reduce((s, o) => s + o.weight, 0);
    for (const o of list) {
        r -= o.weight;
        if (r < 0) return o;
    }
    return list[list.length - 1];
}

function publicOptions(list) {
    return list.map(({ key, icon, label, good, rarity, weight }) => ({ key, icon, label, good, rarity, weight }));
}

// ---------- Ewige Bestenliste ----------

let scores = {};
let scoresDirty = false;

try {
    scores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
} catch {}

function record(name) {
    if (!scores[name]) scores[name] = { best: 0, kills: 0, streak: 0 };
    return scores[name];
}

function topScores() {
    return Object.entries(scores)
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.best - a.best || b.kills - a.kills)
        .slice(0, 10);
}

function saveScores() {
    if (!scoresDirty) return;
    scoresDirty = false;
    const tmp = SCORES_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(scores), err => {
        if (!err) fs.rename(tmp, SCORES_FILE, () => {});
    });
    broadcast({ type: 'highscores', list: topScores() });
}

setInterval(saveScores, 5000);

// ---------- Spieler ----------

function cleanName(raw) {
    let name = String(raw || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16);
    if (!name) name = 'Snake' + rand(100, 999);

    // Doppelte Namen im laufenden Spiel bekommen eine Nummer
    const taken = new Set([...players.values()].map(p => p.name));
    let out = name;
    for (let i = 2; taken.has(out); i++) out = name.slice(0, 13) + ' ' + i;
    return out;
}

function pickColor() {
    const used = new Map(PALETTE.map(c => [c, 0]));
    for (const p of players.values()) if (used.has(p.color)) used.set(p.color, used.get(p.color) + 1);
    const min = Math.min(...used.values());
    const free = PALETTE.filter(c => used.get(c) === min);
    return free[rand(0, free.length)];
}

// Nur #rrggbb, und nicht so dunkel, dass man auf dem schwarzen Feld verschwindet
function cleanColor(raw) {
    const c = String(raw || '').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(c)) return null;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum < 0.2 ? null : c;
}

function freePos() {
    const taken = new Set(items.map(key));
    for (const p of players.values()) p.body.forEach(s => taken.add(key(s)));

    for (let i = 0; i < 200; i++) {
        const pos = { x: rand(0, SIZE), y: rand(0, SIZE) };
        if (!taken.has(key(pos))) return pos;
    }
    return { x: rand(0, SIZE), y: rand(0, SIZE) };
}

function spawnItem(type, extra) {
    items.push({ type, ...freePos(), ...(extra || {}) });
}

function randomDir() {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]][rand(0, 4)];
}

function spawn(player) {
    const pos = freePos();
    const [dx, dy] = randomDir();

    player.x = pos.x;
    player.y = pos.y;
    player.dx = dx;
    player.dy = dy;
    // Richtung des letzten echten Schritts; dagegen wird die 180°-Sperre geprueft
    player.mdx = dx;
    player.mdy = dy;
    player.body = [{ x: pos.x, y: pos.y }];
    player.len = START_LEN;
    player.streak = 0;
    player.acc = 0;
    player.fx = {};
    player.frozen = null;
    player.life = (player.life || 0) + 1;
}

function setLen(p, n) {
    p.len = Math.min(MAX_LEN, Math.max(1, Math.round(n)));
    p.body = p.body.slice(0, p.len);
}

function grow(p, n) {
    p.len = Math.min(MAX_LEN, p.len + n);
}

function spawnFruit(bonus) {
    spawnItem('fruit', { kind: weighted(FRUIT_KINDS).kind, bonus: !!bonus });
}

// Eingefroren laufen die Effekt-Timer nicht weiter. Beim Auftauen wird
// alles, was beim Einfrieren noch lief, um die Standzeit verlaengert.
function resumeFx(p, started) {
    const shift = Date.now() - started;
    for (const k of Object.keys(p.fx)) {
        if (p.fx[k] > started) p.fx[k] += shift;
    }
}

function active(p, fx) {
    return (p.fx[fx] || 0) > Date.now();
}

// Steht still: im Duell, beim Muenzwurf oder im Eisblock
function still(p) {
    return !!p.frozen || active(p, 'ice');
}

// Fuer andere nicht da: Geist, oder gerade am Muenzwurf
function intangible(p) {
    return active(p, 'ghost') || (p.frozen && p.frozen.kind === 'gamble');
}

function send(p, obj) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify(obj));
}

function broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const ws of wss.clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
}

function feed(text, kind) {
    broadcast({ type: 'feed', text, kind: kind || 'info' });
}

function kill(id, killerId, how) {
    const victim = players.get(id);
    if (!victim) return;

    const killer = killerId ? players.get(killerId) : null;

    if (killer) {
        // Killer waechst um die halbe Laenge des Opfers (aufgerundet)
        grow(killer, Math.ceil(victim.body.length / 2));
        killer.kills++;
        killer.streak++;

        const r = record(killer.name);
        r.kills++;
        r.streak = Math.max(r.streak, killer.streak);
        scoresDirty = true;

        feed(`${killer.name} 🗡️ ${victim.name}`, 'kill');
        if (STREAKS[killer.streak]) feed(`${killer.name}: ${STREAKS[killer.streak]}!`, 'streak');
    } else {
        feed(`${victim.name} ${how || '☠️'}`, 'kill');
    }

    send(victim, { type: 'died', by: killer ? killer.name : null });

    spawn(victim);
}

// ---------- Duell (alle sehen die Walze) und Muenzwurf (nur der Spieler selbst) ----------

function startDuel(ids) {
    const winner = ids[rand(0, ids.length)];
    const f = { kind: 'duel', ids, winner, started: Date.now(), ends: Date.now() + DUEL_MS };

    ids.forEach(id => players.get(id).frozen = f);
    freezes.push(f);

    broadcast({
        type: 'duel',
        fighters: ids.map(id => ({ id, color: players.get(id).color, name: players.get(id).name })),
        winner,
        ms: DUEL_MS
    });
}

function startGamble(id) {
    const p = players.get(id);
    const outcome = weighted(COIN_OUTCOMES);
    const f = { kind: 'gamble', ids: [id], outcome, life: p.life, started: Date.now(), ends: Date.now() + GAMBLE_MS };

    p.frozen = f;
    freezes.push(f);

    send(p, {
        type: 'gamble',
        options: publicOptions(COIN_OUTCOMES),
        result: outcome.key,
        len: p.len,
        ms: GAMBLE_MS
    });
}

function resolveFreezes() {
    const now = Date.now();

    for (let i = freezes.length - 1; i >= 0; i--) {
        const f = freezes[i];
        if (f.ends > now) continue;
        freezes.splice(i, 1);

        if (f.kind === 'duel') {
            const winner = players.get(f.winner);

            // Gewinner hat das Spiel verlassen: niemand stirbt, alle machen weiter
            if (!winner) {
                f.ids.forEach(id => {
                    const p = players.get(id);
                    if (p && p.frozen === f) {
                        p.frozen = null;
                        resumeFx(p, f.started);
                    }
                });
                continue;
            }

            for (const id of f.ids) {
                if (id !== f.winner && players.get(id)) kill(id, f.winner);
            }
            winner.frozen = null;
            resumeFx(winner, f.started);
        }

        if (f.kind === 'gamble') {
            const id = f.ids[0];
            const p = players.get(id);
            if (!p || p.life !== f.life) continue;
            p.frozen = null;
            resumeFx(p, f.started);
            p.fx.ghost = Math.max(p.fx.ghost || 0, now + DURATION.afterGamble);

            const o = f.outcome;
            if (o.key === 'death') {
                kill(id, null, 'hat sich verzockt 🪙💀');
                continue;
            }

            setLen(p, p.len * o.mul);

            // Ab ×10: alle sollen es sehen
            if (o.mul >= 10) {
                p.fx.jackpot = now + DURATION.jackpot;
                broadcast({ type: 'jackpot', id, name: p.name, icon: o.icon, len: p.len, rarity: o.rarity });
            }

            const kind = o.rarity === 'gold' || o.rarity === 'mythic' ? 'gold' : o.good ? 'good' : 'bad';
            feed(`${p.name} 🪙 ${o.icon} → Laenge ${p.len}`, kind);
        }
    }
}

// ---------- Mystery-Box ----------

function openBox(id) {
    const p = players.get(id);
    const outcome = weighted(BOX_OUTCOMES);
    const life = p.life;

    send(p, {
        type: 'box',
        options: publicOptions(BOX_OUTCOMES),
        result: outcome.key,
        ms: BOX_MS
    });

    // Wirkung erst, wenn die kleine Walze steht
    setTimeout(() => {
        const q = players.get(id);
        if (!q || q.life !== life) return;
        applyBox(id, q, outcome);
    }, BOX_MS);
}

function others(p) {
    return [...players.values()].filter(q => q !== p);
}

function applyBox(id, p, o) {
    const now = Date.now();
    let text = `${p.name} ❓ ${o.icon} ${o.label}`;

    switch (o.key) {
        case 'speed':
            p.fx.speed = now + DURATION.speed;
            p.fx.slow = 0;
            break;
        case 'slow':
            p.fx.slow = now + DURATION.slow;
            p.fx.speed = 0;
            break;
        case 'ghost':
        case 'shield':
        case 'reverse':
        case 'magnet':
        case 'invisible':
        case 'star':
            p.fx[o.key] = now + DURATION[o.key];
            break;
        case 'grow':
            grow(p, 5);
            break;
        case 'jackpot':
            grow(p, 12);
            break;
        case 'half':
            setLen(p, Math.floor(p.len / 2));
            break;
        case 'applerain':
            for (let i = 0; i < 8; i++) spawnFruit(true);
            break;
        case 'teleport': {
            // Neuer Kopf woanders, der alte Koerper laeuft hinten aus
            const pos = freePos();
            p.x = pos.x;
            p.y = pos.y;
            p.body.unshift({ x: pos.x, y: pos.y });
            p.body = p.body.slice(0, p.len);
            break;
        }
        case 'slowall':
            for (const q of others(p)) {
                q.fx.slow = now + DURATION.slowall;
                q.fx.speed = 0;
            }
            break;
        case 'ice': {
            const pool = others(p).filter(q => !q.frozen);
            if (!pool.length) {
                text += ' (niemand da)';
                break;
            }
            const q = pool[rand(0, pool.length)];
            q.fx.ice = now + DURATION.ice;
            text = `${p.name} 🧊 friert ${q.name} ein`;
            break;
        }
        case 'bomb': {
            // Wer mit irgendeinem Stueck im Umkreis 6 um den Kopf liegt, wird halbiert
            const hit = [];
            for (const q of others(p)) {
                const near = q.body.some(s => Math.abs(s.x - p.x) <= 6 && Math.abs(s.y - p.y) <= 6);
                if (near && !active(q, 'star')) {
                    setLen(q, Math.floor(q.len / 2));
                    hit.push(q.name);
                }
            }
            text = `${p.name} 💥 Schockwelle` + (hit.length ? `: ${hit.join(', ')} halbiert` : ' ins Leere');
            break;
        }
        case 'steal': {
            let loot = 0;
            for (const q of others(p)) {
                const take = Math.min(3, q.len - 1);
                if (take > 0) {
                    setLen(q, q.len - take);
                    loot += take;
                }
            }
            grow(p, loot);
            text = `${p.name} 🤏 klaut allen was: +${loot}`;
            break;
        }
        case 'swap': {
            const pool = others(p);
            if (!pool.length) {
                text += ' (niemand da)';
                break;
            }
            const q = pool[rand(0, pool.length)];
            const a = p.len, b = q.len;
            setLen(p, b);
            setLen(q, a);
            text = `${p.name} 🔀 ${q.name}: ${a} ⇄ ${b}`;
            break;
        }
        case 'death':
            kill(id, null, 'hat die Box 💀 gezogen');
            return;
    }

    const kind = o.rarity === 'gold' ? 'gold' : o.good === true ? 'good' : o.good === false ? 'bad' : 'info';
    feed(text, kind);
}

// ---------- Verbindungen ----------

wss.on('connection', ws => {
    const id = Math.random().toString(36).substring(2, 10);
    const client = { ws, id, joined: false, lastChat: 0 };
    clients.set(id, client);

    ws.send(JSON.stringify({ type: 'welcome', id, size: SIZE }));
    ws.send(JSON.stringify({ type: 'highscores', list: topScores() }));
    ws.send(JSON.stringify({ type: 'chatlog', list: chatLog }));

    ws.on('message', msg => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        if (data.type === 'join' && !client.joined) {
            client.joined = true;
            const player = client;
            player.name = cleanName(data.name);
            player.color = cleanColor(data.color) || pickColor();
            player.kills = 0;
            spawn(player);
            players.set(id, player);
            send(player, { type: 'joined', name: player.name });
            feed(`${player.name} ist beigetreten`);
            return;
        }

        if (!client.joined) return;
        const player = client;

        if (data.type === 'chat') {
            const now = Date.now();
            const text = String(data.text || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
            if (!text || now - player.lastChat < 600) return;
            player.lastChat = now;

            const line = { name: player.name, color: player.color, text, ts: now };
            chatLog.push(line);
            if (chatLog.length > 50) chatLog.shift();
            broadcast({ type: 'chat', ...line });
            return;
        }

        if (data.type !== 'direction') return;

        const dirs = {
            up: [0, -1],
            down: [0, 1],
            left: [-1, 0],
            right: [1, 0]
        };

        let dir = dirs[data.direction];
        if (!dir) return;

        // Verdreht: alle Richtungen gespiegelt
        if (active(player, 'reverse')) dir = [-dir[0], -dir[1]];

        // Kein 180° drehen, gemessen am letzten echten Schritt
        if (dir[0] === -player.mdx && dir[1] === -player.mdy) return;

        player.dx = dir[0];
        player.dy = dir[1];
    });

    ws.on('close', () => {
        clients.delete(id);
        if (players.has(id)) {
            feed(`${client.name} ist weg`);
            players.delete(id);
        }
    });
});

// ---------- Spiel-Tick ----------

function gameTick() {
    resolveFreezes();

    const now = Date.now();

    // Wer steht, steht. Die anderen je nach Tempo.
    const movers = [];
    for (const [id, p] of players) {
        if (still(p)) continue;
        const every = active(p, 'slow') ? EVERY.slow : active(p, 'speed') ? EVERY.fast : EVERY.normal;
        p.acc++;
        if (p.acc < every) continue;
        p.acc = 0;
        movers.push([id, p]);
    }

    const oldHead = new Map();

    for (const [id, player] of movers) {
        oldHead.set(id, { x: player.x, y: player.y });

        player.x += player.dx;
        player.y += player.dy;
        player.mdx = player.dx;
        player.mdy = player.dy;

        if (player.x < 0) player.x = SIZE - 1;
        if (player.x >= SIZE) player.x = 0;
        if (player.y < 0) player.y = SIZE - 1;
        if (player.y >= SIZE) player.y = 0;

        player.body.unshift({
            x: player.x,
            y: player.y
        });

        player.body = player.body.slice(0, player.len);
    }

    const ghost = new Set();
    const star = new Set();
    for (const [id, p] of players) {
        if (intangible(p)) ghost.add(id);
        if (active(p, 'star')) star.add(id);
    }

    // Zwei Koepfe, die aneinander vorbeiziehen (A auf B's altes Feld und umgekehrt),
    // zaehlen als Kopf-an-Kopf und nicht als gegenseitiger Koerpertreffer
    const swapped = new Set();
    const headGroups = [];

    for (const [a, pa] of movers) {
        for (const [b, pb] of movers) {
            if (a >= b || ghost.has(a) || ghost.has(b) || swapped.has(a) || swapped.has(b)) continue;
            if (key(pa.body[0]) === key(oldHead.get(b)) && key(pb.body[0]) === key(oldHead.get(a))) {
                swapped.add(a);
                swapped.add(b);
                headGroups.push([a, b]);
            }
        }
    }

    // Koerper-Kollision: jedes Segment ausser den Koepfen der Beweglichen.
    // Wer steht (Duell, Eis), ist komplett massiv. Geister und Zocker sind nicht da.
    const occupied = new Map();
    for (const [id, p] of players) {
        if (ghost.has(id)) continue;
        p.body.forEach((s, i) => {
            if (i === 0 && !still(p)) return;
            occupied.set(key(s), id);
        });
    }

    const dead = new Map();
    for (const [id, p] of movers) {
        if (swapped.has(id) || ghost.has(id)) continue;
        const owner = occupied.get(key(p.body[0]));
        if (owner === undefined) continue;

        // Stern: unverwundbar
        if (star.has(id)) continue;

        // Schild faengt genau einen Treffer ab
        if (active(p, 'shield')) {
            p.fx.shield = 0;
            feed(`🛡️ Schild von ${p.name} geplatzt`, 'info');
            continue;
        }
        dead.set(id, owner === id ? null : owner);
    }

    // Kopf-an-Kopf: Koepfe auf demselben Feld, mindestens einer hat sich gerade bewegt
    const moverIds = new Set(movers.map(([id]) => id));
    const heads = new Map();
    for (const [id, p] of players) {
        if (still(p) || swapped.has(id) || dead.has(id) || ghost.has(id)) continue;
        const k = key(p.body[0]);
        if (!heads.has(k)) heads.set(k, []);
        heads.get(k).push(id);
    }
    for (const ids of heads.values()) {
        if (ids.length > 1 && ids.some(id => moverIds.has(id))) headGroups.push(ids);
    }

    for (const [id, killerId] of dead) kill(id, killerId, killerId ? null : 'ist in sich selbst gefahren');

    // Genau ein Stern im Kopf-an-Kopf gewinnt ohne Walze. Sonst Duell.
    const inDuel = new Set();
    for (const ids of headGroups) {
        const stars = ids.filter(id => star.has(id));
        if (stars.length === 1) {
            for (const id of ids) if (id !== stars[0]) kill(id, stars[0]);
            continue;
        }
        ids.forEach(id => inDuel.add(id));
        startDuel(ids);
    }

    // Magnet: Items im Umkreis 7 ruecken einen Schritt auf den Kopf zu
    for (const [id, p] of movers) {
        if (!active(p, 'magnet') || dead.has(id)) continue;
        for (const it of items) {
            const dx = p.x - it.x, dy = p.y - it.y;
            if (Math.abs(dx) > 7 || Math.abs(dy) > 7) continue;
            if (Math.abs(dx) >= Math.abs(dy)) it.x += Math.sign(dx);
            else it.y += Math.sign(dy);
        }
    }

    // Items einsammeln
    for (const [id, p] of movers) {
        if (dead.has(id) || inDuel.has(id) || p.frozen) continue;
        const k = key(p.body[0]);
        const idx = items.findIndex(it => key(it) === k);
        if (idx === -1) continue;
        const [item] = items.splice(idx, 1);

        if (item.type === 'fruit') {
            const f = FRUIT[item.kind];
            grow(p, f.value);
            if (!item.bonus) spawnFruit(false);
            if (f.value >= 10) feed(`${p.name} ${f.icon} +${f.value}`, 'gold');
        }
        if (item.type === 'box') {
            openBox(id);
            setTimeout(() => spawnItem('box'), rand(3000, 6000));
        }
        if (item.type === 'coin') {
            startGamble(id);
        }
    }

    // Muenzen: bis zu COINS Stueck, alle 8–15 s eine neue
    if (players.size && now >= nextCoinAt) {
        if (items.filter(it => it.type === 'coin').length < COINS) spawnItem('coin');
        nextCoinAt = now + rand(8000, 15000);
    }

    // Rekorde der Bestenliste mitziehen
    for (const p of players.values()) {
        const r = record(p.name);
        if (p.body.length > r.best) {
            r.best = p.body.length;
            scoresDirty = true;
        }
    }

    // Eingefroren zeigt die Uhr die Restzeit vom Moment des Einfrierens
    const fxLeft = p => {
        const ref = p.frozen ? p.frozen.started : now;
        const out = {};
        for (const [k, until] of Object.entries(p.fx)) {
            if (until > ref) out[k] = until - ref;
        }
        return out;
    };

    const state = {
        type: 'state',
        items,
        players: [...players.entries()].map(([id, p]) => ({
            id,
            x: p.x,
            y: p.y,
            body: p.body,
            len: p.len,
            kills: p.kills,
            color: p.color,
            name: p.name,
            frozen: !!p.frozen,
            gambling: !!(p.frozen && p.frozen.kind === 'gamble'),
            fx: fxLeft(p)
        }))
    };

    broadcast(state);
}

let nextCoinAt = Date.now() + 5000;

for (let i = 0; i < FRUITS; i++) spawnFruit(false);
for (let i = 0; i < BOXES; i++) spawnItem('box');

setInterval(gameTick, TICK);

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Snake running on http://127.0.0.1:${PORT}`);
});
