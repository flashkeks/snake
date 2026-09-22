const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const createAccounts = require('./accounts');
const slots = require('./slots');
const createEvents = require('./events');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');

const accounts = createAccounts(DATA_DIR);

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    let file = url === '/' ? '/index.html' : url;
    file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(PUBLIC, file);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end('404');
        }

        const ext = path.extname(filePath);
        const types = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript',
            '.css': 'text/css'
        };

        res.writeHead(200, {
            'Content-Type': types[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
});

const wss = new WebSocket.Server({ server, path: '/ws', maxPayload: 4096 });

// Nur Spieler, die gerade auf dem Feld sind. Alle Verbindungen stehen in `clients`.
const players = new Map();
const clients = new Map();

// Koordinatenraum 200 x 200. Bespielt wird nur die Arena in der Mitte, deren
// Groesse sich nach der Zahl der Spieler richtet (wenige Spieler, kleines Feld).
// Der Browser zeigt davon einen Ausschnitt von VIEW x VIEW um den eigenen Kopf.
const WORLD = 200;
const VIEW = 40;
const MIN_ARENA = 50;
const arena = { lo: (WORLD - MIN_ARENA) / 2, hi: (WORLD + MIN_ARENA) / 2 };
// Ein Tick = 60 ms. Normal bewegt man sich jeden 2. Tick,
// mit Turbo jeden Tick, als Schnecke jeden 3.
const TICK = 60;
const EVERY = { fast: 1, normal: 2, slow: 3 };
const START_LEN = 6;
// Obergrenze. Koerper gehen kompakt ueber die Leitung (Kopf + Richtungsbuchstaben),
// 5000 Segmente sind damit rund 5 KB je Schlange und Tick.
const MAX_LEN = 5000;
const DUEL_MS = 4500;
const GAMBLE_MS = 4500;
const BOX_MS = 1600;
// Leertaste so lange halten, dann wird der Score in Coins ausgezahlt
const CASHOUT_MS = 5000;
// Score = Laenge + KILL_SCORE je Kill in diesem Leben
const KILL_SCORE = 5;

// Item-Dichte je Feld der Arena
const FRUIT_DENSITY = 0.006;
const BOX_DENSITY = 0.002;
const COIN_PER_CELLS = 1500;

// Fruechte: je seltener, desto mehr Laenge
const FRUIT_KINDS = [
    { kind: 'apple', icon: '🍎', value: 1, weight: 50 },
    { kind: 'banana', icon: '🍌', value: 2, weight: 24 },
    { kind: 'grapes', icon: '🍇', value: 3, weight: 14 },
    { kind: 'melon', icon: '🍉', value: 5, weight: 8 },
    { kind: 'cherry', icon: '🍒', value: 10, weight: 3 },
    { kind: 'mango', icon: '🥭', value: 20, weight: 1 },
    // Legendaer: nie im normalen Pool, eigene Zeitschaltung, auf der Minimap sichtbar
    { kind: 'pineapple', icon: '🍍', value: 50, weight: 0, legend: true, name: 'Pineapple' },
    { kind: 'dragon', icon: '🐉', value: 150, weight: 0, legend: true, name: 'Dragon Fruit' }
];
const FRUIT = Object.fromEntries(FRUIT_KINDS.map(f => [f.kind, f]));
const FRUIT_POOL = FRUIT_KINDS.filter(f => f.weight > 0);

// Farbauswahl im Startmenue. Frei gewaehlte Farben gehen auch, nur nicht zu dunkel.
const PALETTE = ['#ff4d4d', '#ff9f1a', '#ffd23f', '#b5ff3b', '#00ff88', '#18e0d0',
    '#3da5ff', '#5b6cff', '#a45bff', '#ff5bd6', '#ff8fa3', '#f2f2f2'];

// Seltenheit wie bei CS:GO: grey < blue < purple < pink < red < gold < mythic.
// `bad` und `dead` sind die Nieten.
const BOX_OUTCOMES = [
    { key: 'speed', icon: '⚡', label: 'Turbo', good: true, rarity: 'blue', weight: 10 },
    { key: 'shield', icon: '🛡️', label: 'Shield', good: true, rarity: 'blue', weight: 9 },
    { key: 'grow', icon: '🍄', label: '+5', good: true, rarity: 'blue', weight: 10 },
    { key: 'applerain', icon: '🍉', label: 'Fruit rain', good: true, rarity: 'blue', weight: 6 },
    { key: 'teleport', icon: '🌀', label: 'Teleport', good: null, rarity: 'blue', weight: 5 },
    { key: 'ghost', icon: '👻', label: 'Ghost', good: true, rarity: 'purple', weight: 7 },
    { key: 'magnet', icon: '🧲', label: 'Magnet', good: true, rarity: 'purple', weight: 6 },
    { key: 'invisible', icon: '🫥', label: 'Invisible', good: true, rarity: 'purple', weight: 5 },
    { key: 'slowall', icon: '🐢', label: 'Slow-mo for all', good: true, rarity: 'purple', weight: 5 },
    { key: 'swap', icon: '🔀', label: 'Swap', good: null, rarity: 'pink', weight: 4 },
    { key: 'bomb', icon: '💥', label: 'Shockwave', good: true, rarity: 'pink', weight: 5 },
    { key: 'ice', icon: '🧊', label: 'Ice block', good: true, rarity: 'pink', weight: 5 },
    { key: 'steal', icon: '🤏', label: 'Heist', good: true, rarity: 'red', weight: 4 },
    { key: 'star', icon: '⭐', label: 'Star', good: true, rarity: 'gold', weight: 3 },
    { key: 'jackpot', icon: '💎', label: 'Jackpot +12', good: true, rarity: 'gold', weight: 3 },
    { key: 'slow', icon: '🐌', label: 'Snail', good: false, rarity: 'bad', weight: 9 },
    { key: 'reverse', icon: '🔄', label: 'Reversed', good: false, rarity: 'bad', weight: 7 },
    { key: 'half', icon: '✂️', label: 'Halved', good: false, rarity: 'bad', weight: 6 },
    { key: 'death', icon: '💀', label: 'Unlucky', good: false, rarity: 'dead', weight: 2 }
];

// Goldmuenze: Double or Nothing
const COIN_OUTCOMES = [
    { key: 'half', icon: '÷2', label: 'Halved', good: false, rarity: 'bad', weight: 38, mul: 0.5 },
    { key: 'x2', icon: '×2', label: 'Doubled', good: true, rarity: 'blue', weight: 40, mul: 2 },
    { key: 'x3', icon: '×3', label: 'Tripled', good: true, rarity: 'purple', weight: 10, mul: 3 },
    { key: 'x5', icon: '×5', label: 'Five times', good: true, rarity: 'pink', weight: 5, mul: 5 },
    { key: 'x10', icon: '×10', label: 'TEN TIMES', good: true, rarity: 'gold', weight: 2, mul: 10 },
    { key: 'x20', icon: '×20', label: 'TWENTY TIMES', good: true, rarity: 'gold', weight: 0.8, mul: 20 },
    { key: 'x50', icon: '×50', label: 'FIFTY TIMES', good: true, rarity: 'mythic', weight: 0.3, mul: 50 },
    { key: 'x100', icon: '×100', label: 'HUNDRED TIMES', good: true, rarity: 'mythic', weight: 0.1, mul: 100 },
    { key: 'death', icon: '💀', label: 'Dead', good: false, rarity: 'dead', weight: 5, mul: 0 }
];

const DURATION = {
    speed: 8000, ghost: 6000, shield: 15000, slow: 4000, reverse: 6000, slowall: 3000,
    magnet: 10000, invisible: 7000, ice: 3000, star: 6000,
    // Wer ×10 oder mehr zieht, leuchtet so lange fuer alle
    jackpot: 8000,
    // Kurzer Schutz nach dem Muenzwurf, falls jemand gerade durch einen durchfaehrt
    afterGamble: 1500,
    // Spawnschutz
    spawn: 2000
};

const STREAKS = { 2: 'DOUBLE KILL', 3: 'TRIPLE KILL', 5: 'RAMPAGE', 8: 'GODLIKE' };

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

// ---------- Rate-Limits je IP ----------

const buckets = new Map();

// true = erlaubt. Hoechstens `max` Aufrufe je `windowMs` und Schluessel.
function allow(bucketKey, max, windowMs) {
    const now = Date.now();
    const list = (buckets.get(bucketKey) || []).filter(t => now - t < windowMs);
    if (list.length >= max) {
        buckets.set(bucketKey, list);
        return false;
    }
    list.push(now);
    buckets.set(bucketKey, list);
    return true;
}

setInterval(() => {
    const now = Date.now();
    for (const [k, list] of buckets) if (!list.some(t => now - t < 3600e3)) buckets.delete(k);
}, 600e3);

// ---------- Hilfen ----------

function cleanText(raw, max) {
    return String(raw || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
}

function uniqueName(name) {
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

// Freies Feld mit Abstand `margin` zur Wand und zu allen Koepfen
function freePos(margin) {
    margin = margin || 2;
    const taken = new Set(items.map(key));
    for (const p of players.values()) p.body.forEach(s => taken.add(key(s)));

    const lo = arena.lo + margin, hi = arena.hi - margin;
    for (let i = 0; i < 300; i++) {
        const pos = { x: rand(lo, hi), y: rand(lo, hi) };
        if (taken.has(key(pos))) continue;
        if (margin > 2 && [...players.values()].some(p => Math.abs(p.x - pos.x) < 8 && Math.abs(p.y - pos.y) < 8)) continue;
        return pos;
    }
    return { x: rand(lo, hi), y: rand(lo, hi) };
}

function spawnItem(type, extra) {
    items.push({ type, ...freePos(2), ...(extra || {}) });
}

function spawnFruit(bonus, near) {
    const kind = weighted(FRUIT_POOL).kind;
    if (near) {
        // Obstregen: in der Naehe des Spielers
        const x = Math.min(arena.hi - 1, Math.max(arena.lo, near.x + rand(-8, 9)));
        const y = Math.min(arena.hi - 1, Math.max(arena.lo, near.y + rand(-8, 9)));
        items.push({ type: 'fruit', x, y, kind, bonus: !!bonus });
        return;
    }
    spawnItem('fruit', { kind, bonus: !!bonus });
}

function spawn(player) {
    const pos = freePos(6);

    // Weg von der naechsten Wand losfahren
    const dirs = [];
    const mid = (arena.lo + arena.hi) / 2;
    if (pos.x < mid) dirs.push([1, 0]); else dirs.push([-1, 0]);
    if (pos.y < mid) dirs.push([0, 1]); else dirs.push([0, -1]);
    const [dx, dy] = dirs[rand(0, 2)];

    player.x = pos.x;
    player.y = pos.y;
    player.dx = dx;
    player.dy = dy;
    // Richtung des letzten echten Schritts; dagegen wird die 180°-Sperre geprueft
    player.mdx = dx;
    player.mdy = dy;
    player.body = [{ x: pos.x, y: pos.y }];
    player.len = START_LEN;
    player.kills = 0;
    player.streak = 0;
    player.acc = 0;
    player.fx = { ghost: Date.now() + DURATION.spawn };
    player.frozen = null;
    player.cashout = null;
    player.life = (player.life || 0) + 1;
}

function setLen(p, n) {
    p.len = Math.min(MAX_LEN, Math.max(1, Math.round(n)));
    p.body = p.body.slice(0, p.len);
}

function grow(p, n) {
    p.len = Math.min(MAX_LEN, p.len + n);
}

function scoreOf(p) {
    return p.len + KILL_SCORE * p.kills;
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

// Eingefroren laufen die Effekt-Timer nicht weiter. Beim Auftauen wird
// alles, was beim Einfrieren noch lief, um die Standzeit verlaengert.
function resumeFx(p, started) {
    const shift = Date.now() - started;
    for (const k of Object.keys(p.fx)) {
        if (p.fx[k] > started) p.fx[k] += shift;
    }
}

function send(c, obj) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(obj));
}

function broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const ws of wss.clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
}

// who: Spieler-ID, fuer den der Eintrag gilt (nur der hoert den Sound).
// big: laut fuer alle (ab ×10 an der Muenze).
function feed(text, kind, who, big) {
    broadcast({ type: 'feed', text, kind: kind || 'info', who: who || null, big: !!big });
}

function sendAccount(c) {
    const u = c.account ? accounts.get(c.account) : null;
    send(c, { type: 'account', user: u ? accounts.publicUser(u) : null });
}

// ---------- Bestenliste ----------

let lastTop = '';

function pushTop(force) {
    const top = JSON.stringify(accounts.top());
    if (!force && top === lastTop) return;
    lastTop = top;
    broadcast({ type: 'highscores', top: JSON.parse(top) });
}

setInterval(() => pushTop(false), 5000);

function recordScore(p) {
    if (!p.account) return;
    const score = scoreOf(p);
    accounts.stat(p.account, s => { s.bestScore = Math.max(s.bestScore, score); });
}

// ---------- Tod, Verlassen, Cashout ----------

// Spieler vom Feld nehmen. Der Client landet wieder im Menue.
function removeFromField(id) {
    const p = players.get(id);
    if (!p) return;
    players.delete(id);
    p.joined = false;
    p.frozen = null;
    p.cashout = null;
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
        if (killer.account) accounts.stat(killer.account, s => { s.kills++; });

        feed(`${killer.name} 🗡️ ${victim.name}`, 'kill');
        if (STREAKS[killer.streak]) feed(`${killer.name}: ${STREAKS[killer.streak]}!`, 'streak', killerId);
    } else {
        feed(`${victim.name} ${how || '☠️'}`, 'kill');
    }

    recordScore(victim);
    send(victim, { type: 'died', by: killer ? killer.name : null, how: how || null, score: scoreOf(victim) });
    removeFromField(id);
}

function finishCashout(id, p) {
    const score = scoreOf(p);
    recordScore(p);
    const balance = accounts.addCoins(p.account, score);
    accounts.stat(p.account, s => {
        s.cashouts++;
        s.totalCashout += score;
        s.bestCashout = Math.max(s.bestCashout, score);
    });

    feed(`💰 ${p.name} cashed out ${score} coins`, score >= 200 ? 'gold' : 'good', id);
    send(p, { type: 'cashedout', coins: score, balance });
    removeFromField(id);
    sendAccount(p);
}

// ---------- Duell (alle sehen die Walze) und Muenzwurf (nur der Spieler selbst) ----------

function freeze(p, f) {
    p.frozen = f;
    // Wer einfriert, verliert den laufenden Cashout
    if (p.cashout) {
        p.cashout = null;
        send(p, { type: 'cashoutCancel' });
    }
}

function startDuel(ids) {
    const winner = ids[rand(0, ids.length)];
    const f = { kind: 'duel', ids, winner, started: Date.now(), ends: Date.now() + DUEL_MS };

    ids.forEach(id => freeze(players.get(id), f));
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

    freeze(p, f);
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
            if (!winner || winner.frozen !== f) {
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
                const p = players.get(id);
                if (id !== f.winner && p && p.frozen === f) kill(id, f.winner);
            }
            winner.frozen = null;
            resumeFx(winner, f.started);
        }

        if (f.kind === 'gamble') {
            const id = f.ids[0];
            const p = players.get(id);
            if (!p || p.life !== f.life || p.frozen !== f) continue;
            p.frozen = null;
            resumeFx(p, f.started);
            p.fx.ghost = Math.max(p.fx.ghost || 0, now + DURATION.afterGamble);

            const o = f.outcome;
            if (o.key === 'death') {
                // Schild faengt auch den Muenz-Tod ab
                if (active(p, 'shield')) {
                    p.fx.shield = 0;
                    feed(`🛡️ ${p.name}'s shield blocked a 🪙💀`, 'good', id);
                    continue;
                }
                kill(id, null, 'gambled it all away 🪙💀');
                continue;
            }

            setLen(p, p.len * o.mul);

            // Ab ×10: alle sollen es sehen
            if (o.mul >= 10) {
                p.fx.jackpot = now + DURATION.jackpot;
                broadcast({ type: 'jackpot', id, name: p.name, icon: o.icon, len: p.len, rarity: o.rarity });
            }

            const kind = o.rarity === 'gold' || o.rarity === 'mythic' ? 'gold' : o.good ? 'good' : 'bad';
            feed(`${p.name} 🪙 ${o.icon} → length ${p.len}`, kind, id, o.mul >= 10);
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
            for (let i = 0; i < 10; i++) spawnFruit(true, p);
            break;
        case 'teleport': {
            // Neuer Kopf woanders, der alte Koerper laeuft hinten aus
            const pos = freePos(6);
            p.x = pos.x;
            p.y = pos.y;
            p.body.unshift({ x: pos.x, y: pos.y });
            p.body = p.body.slice(0, p.len);
            p.fx.ghost = Math.max(p.fx.ghost || 0, now + 1000);
            break;
        }
        case 'slowall':
            for (const q of others(p)) {
                q.fx.slow = now + DURATION.slowall;
                q.fx.speed = 0;
            }
            break;
        case 'ice': {
            // Der naechste Gegner friert ein
            const pool = others(p).filter(q => !q.frozen)
                .sort((a, b) => (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)));
            if (!pool.length) {
                text += ' (nobody around)';
                break;
            }
            const q = pool[0];
            q.fx.ice = now + DURATION.ice;
            text = `${p.name} 🧊 froze ${q.name}`;
            break;
        }
        case 'bomb': {
            // Wer mit irgendeinem Stueck im Umkreis 8 um den Kopf liegt, wird halbiert
            const hit = [];
            for (const q of others(p)) {
                const near = q.body.some(s => Math.abs(s.x - p.x) <= 8 && Math.abs(s.y - p.y) <= 8);
                if (near && !active(q, 'star')) {
                    setLen(q, Math.floor(q.len / 2));
                    hit.push(q.name);
                }
            }
            text = `${p.name} 💥 Shockwave` + (hit.length ? `: ${hit.join(', ')} halved` : ' hit nothing');
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
            text = `${p.name} 🤏 robbed everyone: +${loot}`;
            break;
        }
        case 'swap': {
            const pool = others(p);
            if (!pool.length) {
                text += ' (nobody around)';
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
            // Schild faengt auch den Box-Tod ab
            if (active(p, 'shield')) {
                p.fx.shield = 0;
                feed(`🛡️ ${p.name}'s shield blocked a 💀 box`, 'good', id);
                return;
            }
            kill(id, null, 'opened a 💀 box');
            return;
    }

    const kind = o.rarity === 'gold' ? 'gold' : o.good === true ? 'good' : o.good === false ? 'bad' : 'info';
    feed(text, kind, id);
}

// ---------- Nachrichten vom Browser ----------

const DIRS = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
};

async function handle(c, data) {
    switch (data.type) {
        // --- Konto ---

        case 'register': {
            if (!allow('reg:' + c.ip, 5, 3600e3)) return send(c, { type: 'authError', error: 'Too many new accounts from here, try again later' });
            const r = await accounts.register(data.name, data.password);
            if (r.error) return send(c, { type: 'authError', error: r.error });
            c.account = r.key;
            send(c, { type: 'auth', token: r.token, user: r.user });
            feed(`🎉 ${r.user.name} just signed up`);
            pushTop(true);
            return;
        }

        case 'login': {
            if (!allow('login:' + c.ip, 10, 300e3)) return send(c, { type: 'authError', error: 'Too many attempts, wait 5 minutes' });
            const r = await accounts.login(data.name, data.password);
            if (r.error) return send(c, { type: 'authError', error: r.error });
            if (c.joined) return send(c, { type: 'authError', error: 'Leave the game first' });
            c.account = r.key;
            send(c, { type: 'auth', token: r.token, user: r.user });
            return;
        }

        case 'resume': {
            const r = accounts.resume(data.token);
            if (!r) return send(c, { type: 'authExpired' });
            c.account = r.key;
            send(c, { type: 'auth', token: data.token, user: r.user });
            return;
        }

        case 'logout':
            if (c.joined) return send(c, { type: 'authError', error: 'Leave the game first' });
            accounts.logout(data.token);
            c.account = null;
            send(c, { type: 'auth', token: null, user: null });
            return;

        case 'changePassword': {
            if (!c.account) return;
            if (!allow('pw:' + c.ip, 10, 300e3)) return send(c, { type: 'authError', error: 'Too many attempts, wait 5 minutes' });
            const r = await accounts.changePassword(c.account, data.oldPassword, data.newPassword);
            if (r.error) return send(c, { type: 'authError', error: r.error });
            send(c, { type: 'auth', token: r.token, user: accounts.publicUser(accounts.get(c.account)), note: 'Password changed, other devices were logged out' });
            return;
        }

        case 'deleteAccount': {
            if (!c.account || c.joined) return;
            if (!allow('pw:' + c.ip, 10, 300e3)) return send(c, { type: 'authError', error: 'Too many attempts, wait 5 minutes' });
            const r = await accounts.deleteAccount(c.account, data.password);
            if (r.error) return send(c, { type: 'authError', error: r.error });
            c.account = null;
            send(c, { type: 'auth', token: null, user: null, note: 'Account deleted' });
            pushTop(true);
            return;
        }

        // --- Spiel ---

        case 'join': {
            if (c.joined) return;
            let name;
            if (c.account) {
                const u = accounts.get(c.account);
                if (!u) return;
                if ([...players.values()].some(p => p.account === c.account)) {
                    return send(c, { type: 'joinError', error: 'You are already playing in another window' });
                }
                name = u.name;
            } else {
                name = cleanText(data.name, 16);
                if (!name) return send(c, { type: 'joinError', error: 'Enter a name' });
                if (accounts.exists(name)) return send(c, { type: 'joinError', error: 'That name belongs to an account. Log in or pick another name' });
            }

            c.joined = true;
            c.name = uniqueName(name);
            c.guest = !c.account;
            c.color = cleanColor(data.color) || pickColor();
            if (c.account) accounts.setColor(c.account, c.color);
            spawn(c);
            players.set(c.id, c);
            send(c, { type: 'joined', name: c.name, guest: c.guest });
            feed(`${c.name}${c.guest ? ' (guest)' : ''} joined`);
            return;
        }

        case 'leave': {
            const p = players.get(c.id);
            if (!p) return;
            recordScore(p);
            feed(`${p.name} left`);
            events.leave(c.id);
            removeFromField(c.id);
            send(c, { type: 'left' });
            return;
        }

        case 'cashout': {
            const p = players.get(c.id);
            if (!p || p.guest) return;
            if (!data.on) {
                p.cashout = null;
                return;
            }
            if (p.frozen || p.cashout || paused) return;
            p.cashout = Date.now();
            return;
        }

        case 'direction': {
            const p = players.get(c.id);
            if (!p) return;
            // Beim Cashout faehrt man stur geradeaus, im Event steht alles
            if (p.cashout || paused) return;

            let dir = DIRS[data.direction];
            if (!dir) return;

            // Verdreht: alle Richtungen gespiegelt
            if (active(p, 'reverse')) dir = [-dir[0], -dir[1]];

            // Kein 180° drehen, gemessen am letzten echten Schritt
            if (dir[0] === -p.mdx && dir[1] === -p.mdy) return;

            p.dx = dir[0];
            p.dy = dir[1];
            return;
        }

        case 'chat': {
            if (!c.account && !c.joined) return;
            const now = Date.now();
            const text = cleanText(data.text, 200);
            if (!text || now - (c.lastChat || 0) < 600) return;
            c.lastChat = now;

            const u = c.account ? accounts.get(c.account) : null;
            const line = {
                name: u ? u.name : c.name,
                color: c.color || (u && u.color) || '#cccccc',
                guest: !u,
                text,
                ts: now
            };
            chatLog.push(line);
            if (chatLog.length > 50) chatLog.shift();
            broadcast({ type: 'chat', ...line });
            return;
        }

        // --- Mini-Event ---

        // Nur fuer lokale Tests (SNAKE_TEST=1): Event sofort starten
        case 'testEvent':
            if (process.env.SNAKE_TEST === '1' && !events.active()) startEvent(data.kind);
            return;

        case 'eventAction':
            if (events.active()) events.handle(c, data);
            return;

        // --- Automat ---

        case 'spin': {
            if (!c.account) return send(c, { type: 'spinError', error: 'Accounts only' });
            const now = Date.now();
            if (now - (c.lastSpin || 0) < 1200) return;
            const bet = Number(data.bet);
            if (!slots.BETS.includes(bet)) return send(c, { type: 'spinError', error: 'Invalid bet' });
            const u = accounts.get(c.account);
            if (!u || u.coins < bet) return send(c, { type: 'spinError', error: 'Not enough coins' });
            c.lastSpin = now;

            accounts.addCoins(c.account, -bet);
            const r = slots.spin(bet);
            const balance = accounts.addCoins(c.account, r.win);
            accounts.stat(c.account, s => {
                s.spins++;
                s.biggestWin = Math.max(s.biggestWin, r.win);
            });

            send(c, { type: 'spin', reels: r.reels, win: r.win, mult: r.mult, bet, balance });
            if (r.mult >= 80) feed(`🎰 ${u.name} hit ${r.reels.join('')} → ${r.win} coins`, 'gold', c.id);
            return;
        }
    }
}

wss.on('connection', (ws, req) => {
    const id = Math.random().toString(36).substring(2, 10);
    const ip = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    const c = { ws, id, ip, account: null, joined: false };
    clients.set(id, c);

    send(c, {
        type: 'welcome',
        id,
        world: WORLD,
        arena,
        view: VIEW,
        cashoutMs: CASHOUT_MS,
        durations: DURATION,
        palette: PALETTE,
        slots: { symbols: slots.SYMBOLS, bets: slots.BETS, twoCherry: slots.TWO_CHERRY }
    });
    send(c, { type: 'highscores', top: accounts.top() });
    send(c, { type: 'chatlog', list: chatLog });

    ws.on('message', msg => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }
        if (!data || typeof data.type !== 'string') return;
        handle(c, data).catch(err => console.error('handle', data.type, err));
    });

    ws.on('close', () => {
        clients.delete(id);
        const p = players.get(id);
        if (p) {
            recordScore(p);
            feed(`${p.name} disconnected`);
            events.leave(id);
            removeFromField(id);
        }
    });
});

// ---------- Arena: waechst und schrumpft mit der Spielerzahl ----------

function targetArena() {
    const n = players.size;
    return Math.max(MIN_ARENA, Math.min(WORLD, Math.round(36 + 16 * n)));
}

let lastArenaStep = 0;
let shrinkSide = 0;

function stepArena(now) {
    const size = arena.hi - arena.lo;
    const target = targetArena();

    // Wachsen schnell (alle 0,5 s um 2), schrumpfen langsam (alle 2,5 s um 1).
    // Etwas Spielraum nach unten, damit die Wand nicht bei jedem Beitritt zittert.
    if (size < target && now - lastArenaStep >= 500) {
        arena.lo = Math.max(0, arena.lo - 1);
        arena.hi = Math.min(WORLD, arena.hi + 1);
        lastArenaStep = now;
    } else if (size > target + 4 && now - lastArenaStep >= 2500) {
        if (shrinkSide++ % 2 === 0) arena.hi--; else arena.lo++;
        lastArenaStep = now;

        // Was jetzt draussen liegt, verschwindet. Wer mit dem Kopf draussen ist, wird zerquetscht.
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            const size = it.type === 'event' ? 3 : 1;
            if (it.x < arena.lo || it.y < arena.lo || it.x + size > arena.hi || it.y + size > arena.hi) items.splice(i, 1);
        }
        for (const [id, p] of [...players]) {
            if (!inArena(p.x, p.y)) kill(id, null, 'got crushed by the shrinking zone');
        }
    }
}

function inArena(x, y) {
    return x >= arena.lo && y >= arena.lo && x < arena.hi && y < arena.hi;
}

// Items nachfuellen, damit die Dichte zur Arena passt
let lastRefill = 0;
let nextLegendAt = Date.now() + rand(60000, 120000);
let nextEventAt = Date.now() + rand(45000, 75000);
let nextCoinAt = Date.now() + 2000;

function refillItems(now) {
    if (now - lastRefill < 1000) return;
    lastRefill = now;

    const cells = (arena.hi - arena.lo) ** 2;
    const count = type => items.filter(it => it.type === type).length;

    const fruits = items.filter(it => it.type === 'fruit' && !it.bonus && !FRUIT[it.kind].legend).length;
    for (let i = fruits; i < Math.round(cells * FRUIT_DENSITY); i++) spawnFruit(false);

    const boxes = count('box');
    for (let i = boxes; i < Math.max(4, Math.round(cells * BOX_DENSITY)); i++) spawnItem('box');

    if (now >= nextCoinAt) {
        if (count('coin') < Math.max(2, Math.round(cells / COIN_PER_CELLS))) spawnItem('coin');
        nextCoinAt = now + rand(3000, 6000);
    }

    // Legendaere Fruechte: selten, hoechstens eine je Sorte, fuer alle angesagt
    if (now >= nextLegendAt && players.size) {
        const kind = Math.random() < 0.8 ? 'pineapple' : 'dragon';
        if (!items.some(it => it.kind === kind)) {
            spawnItem('fruit', { kind, bonus: true, legend: true });
            const f = FRUIT[kind];
            feed(`${f.icon} A ${f.name} (+${f.value}) appeared! Check the minimap`, 'gold');
        }
        nextLegendAt = now + rand(60000, 150000);
    }

    // Event-Item: 3 x 3, hoechstens eins, nur wenn kein Event laeuft
    if (now >= nextEventAt && players.size && !events.active() && !paused && !items.some(it => it.type === 'event')) {
        const pos = freePos(8);
        items.push({ type: 'event', x: pos.x - 1, y: pos.y - 1 });
        feed('🎪 An EVENT box appeared! Grab it to start a mini event for everyone', 'gold');
        nextEventAt = Infinity;
    }
}

// Koerper kompakt: Laeufe aus Startpunkt + Richtungsbuchstaben (U D L R).
// Ein neuer Lauf beginnt nur, wo der Koerper springt (Teleport).
function encodeBody(body) {
    const runs = [];
    let run = null;
    for (let i = 0; i < body.length; i++) {
        const s = body[i];
        const prev = body[i - 1];
        const dx = prev ? s.x - prev.x : 9, dy = prev ? s.y - prev.y : 9;
        const ch = dx === 1 && dy === 0 ? 'R' : dx === -1 && dy === 0 ? 'L' : dx === 0 && dy === 1 ? 'D' : dx === 0 && dy === -1 ? 'U' : null;
        if (run && ch) run[2] += ch;
        else {
            run = [s.x, s.y, ''];
            runs.push(run);
        }
    }
    return runs;
}

// ---------- Pause fuer Mini-Events ----------

let paused = null;

const events = createEvents({
    accounts,
    broadcast,
    send,
    grow,
    feed,
    onEnd() {
        // 3 s Countdown, dann geht es weiter
        if (paused) paused.resumeAt = Date.now() + 3000;
        broadcast({ type: 'resume', in: 3000 });
    }
});

function startEvent(kind) {
    const now = Date.now();
    const members = [...players.values()];
    if (!events.start(members, kind)) return;
    paused = { started: now, resumeAt: null };
    for (const p of members) {
        if (p.cashout) {
            p.cashout = null;
            send(p, { type: 'cashoutCancel' });
        }
    }
}

function unpause(now) {
    const dur = now - paused.started;
    // Effekt-Timer, Duelle und Muenzwuerfe um die Pause verlaengern
    for (const p of players.values()) resumeFx(p, paused.started);
    for (const f of freezes) {
        f.started += dur;
        f.ends += dur;
    }
    paused = null;
    nextEventAt = now + rand(90000, 180000);
}

// ---------- Spiel-Tick ----------

function gameTick() {
    const now = Date.now();

    events.tick();

    if (paused) {
        if (paused.resumeAt && now >= paused.resumeAt) unpause(now);
        else return broadcastState(now);
    }

    resolveFreezes();
    stepArena(now);
    refillItems(now);

    // Cashout fertig?
    for (const [id, p] of players) {
        if (p.cashout && now - p.cashout >= CASHOUT_MS) finishCashout(id, p);
    }

    // Wer steht, steht. Die anderen je nach Tempo.
    const movers = [];
    for (const [id, p] of players) {
        if (still(p)) continue;
        // Beim Cashout bremst man auf Schneckentempo: 5 s geradeaus sind so ~28 Felder,
        // das passt auch in die kleine Arena, wenn man sich vorher ausrichtet
        const every = active(p, 'slow') || p.cashout ? EVERY.slow : active(p, 'speed') ? EVERY.fast : EVERY.normal;
        p.acc++;
        if (p.acc < every) continue;
        p.acc = 0;
        movers.push([id, p]);
    }

    const oldHead = new Map();
    const dead = new Map();
    const wall = new Set();

    for (const [id, player] of movers) {
        oldHead.set(id, { x: player.x, y: player.y });

        player.x += player.dx;
        player.y += player.dy;
        player.mdx = player.dx;
        player.mdy = player.dy;

        // Wand ist tot. Auch Geister und Sterne.
        if (!inArena(player.x, player.y)) {
            wall.add(id);
            continue;
        }

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

    const live = movers.filter(([id]) => !wall.has(id));

    // Zwei Koepfe, die aneinander vorbeiziehen (A auf B's altes Feld und umgekehrt),
    // zaehlen als Kopf-an-Kopf und nicht als gegenseitiger Koerpertreffer
    const swapped = new Set();
    const headGroups = [];

    for (const [a, pa] of live) {
        for (const [b, pb] of live) {
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
        if (ghost.has(id) || wall.has(id)) continue;
        p.body.forEach((s, i) => {
            if (i === 0 && !still(p)) return;
            occupied.set(key(s), id);
        });
    }

    for (const [id, p] of live) {
        if (swapped.has(id) || ghost.has(id)) continue;
        const owner = occupied.get(key(p.body[0]));
        if (owner === undefined) continue;

        // Stern: unverwundbar
        if (star.has(id)) continue;

        // Schild faengt genau einen Treffer ab
        if (active(p, 'shield')) {
            p.fx.shield = 0;
            feed(`🛡️ ${p.name}'s shield broke`, 'info');
            continue;
        }
        dead.set(id, owner === id ? null : owner);
    }

    // Kopf-an-Kopf: Koepfe auf demselben Feld, mindestens einer hat sich gerade bewegt
    const moverIds = new Set(live.map(([id]) => id));
    const heads = new Map();
    for (const [id, p] of players) {
        if (still(p) || swapped.has(id) || dead.has(id) || ghost.has(id) || wall.has(id)) continue;
        const k = key(p.body[0]);
        if (!heads.has(k)) heads.set(k, []);
        heads.get(k).push(id);
    }
    for (const ids of heads.values()) {
        if (ids.length > 1 && ids.some(id => moverIds.has(id))) headGroups.push(ids);
    }

    for (const id of wall) kill(id, null, 'hit the wall');
    for (const [id, killerId] of dead) kill(id, killerId, killerId ? null : 'ran into themselves');

    // Genau ein Stern im Kopf-an-Kopf gewinnt ohne Walze. Sonst Duell.
    const inDuel = new Set();
    for (const group of headGroups) {
        const ids = group.filter(id => players.has(id));
        if (ids.length < 2) continue;
        const stars = ids.filter(id => star.has(id));
        if (stars.length === 1) {
            for (const id of ids) if (id !== stars[0]) kill(id, stars[0]);
            continue;
        }
        ids.forEach(id => inDuel.add(id));
        startDuel(ids);
    }

    // Magnet: zieht Items im Umkreis 8 zwei Schritte je eigenem Schritt heran,
    // also schneller als man selbst faehrt. Event-Kisten bleiben liegen.
    for (const [id, p] of live) {
        if (!players.has(id) || !active(p, 'magnet')) continue;
        for (const it of items) {
            if (it.type === 'event') continue;
            for (let step = 0; step < 2; step++) {
                const dx = p.x - it.x, dy = p.y - it.y;
                if (Math.abs(dx) > 8 || Math.abs(dy) > 8 || (dx === 0 && dy === 0)) break;
                if (Math.abs(dx) >= Math.abs(dy)) it.x += Math.sign(dx);
                else it.y += Math.sign(dy);
            }
        }
    }

    // Items einsammeln. Mit Magnet auch alles direkt neben dem Kopf (ausser Muenzen).
    let eventGrab = false;
    for (const [id, p] of live) {
        if (!players.has(id) || inDuel.has(id) || p.frozen) continue;
        const magnet = active(p, 'magnet');

        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            let hit;
            if (it.type === 'event') hit = p.x >= it.x && p.x < it.x + 3 && p.y >= it.y && p.y < it.y + 3;
            else if (it.type === 'coin') hit = it.x === p.x && it.y === p.y;
            else hit = magnet ? Math.abs(it.x - p.x) <= 1 && Math.abs(it.y - p.y) <= 1 : it.x === p.x && it.y === p.y;
            if (!hit) continue;
            items.splice(i, 1);

            if (it.type === 'fruit') {
                const f = FRUIT[it.kind];
                grow(p, f.value);
                if (f.legend) feed(`${f.icon} ${p.name} ate the ${f.name}! +${f.value}`, 'gold', id);
                else if (f.value >= 10) feed(`${p.name} ${f.icon} +${f.value}`, 'gold', id);
            }
            if (it.type === 'box') openBox(id);
            if (it.type === 'coin') {
                startGamble(id);
                break;
            }
            if (it.type === 'event') {
                feed(`🎪 ${p.name} opened the EVENT box!`, 'gold');
                eventGrab = true;
                break;
            }
        }
        if (eventGrab) break;
    }

    if (eventGrab) startEvent();

    broadcastState(now);
}

function broadcastState(now) {
    // Eingefroren zeigt die Uhr die Restzeit vom Moment des Einfrierens
    const fxLeft = p => {
        const ref = paused ? paused.started : p.frozen ? p.frozen.started : now;
        const out = {};
        for (const [k, until] of Object.entries(p.fx)) {
            if (until > ref) out[k] = until - ref;
        }
        return out;
    };

    broadcast({
        type: 'state',
        arena,
        paused: !!paused,
        items,
        players: [...players.entries()].map(([id, p]) => ({
            id,
            x: p.x,
            y: p.y,
            runs: encodeBody(p.body),
            len: p.body.length,
            kills: p.kills,
            score: scoreOf(p),
            color: p.color,
            name: p.name,
            guest: p.guest,
            frozen: !!p.frozen || !!paused,
            gambling: !!(p.frozen && p.frozen.kind === 'gamble'),
            cashout: p.cashout ? Math.min(1, (now - p.cashout) / CASHOUT_MS) : 0,
            fx: fxLeft(p)
        }))
    });
}

setInterval(gameTick, TICK);

function shutdown() {
    accounts.save(true);
    process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Snake running on http://127.0.0.1:${PORT}, Daten in ${DATA_DIR}`);
});
