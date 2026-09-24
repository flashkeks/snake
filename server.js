const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const createAccounts = require('./accounts');
const kmLevel = require('./km-level');
const slots = require('./slots');
const slots2 = require('./slots2');

// Freier Einsatz: ganze Coins, mindestens 1, Obergrenze nur als Sicherung
const MAX_BET = 1000000;
function validBet(n) {
    return Number.isInteger(n) && n >= 1 && n <= MAX_BET;
}
const createEvents = require('./events');
const createTables = require('./tables');
const casino = require('./casino');
const plinko = require('./plinko');
const createTickets = require('./tickets');
const startAdmin = require('./admin');
const createShooter = require('./shooter');
const createRooms = require('./arena-rooms');
const createTrade = require('./trade');
const createAssets = require('./assets');
const createMarket = require('./market');
const createLobby = require('./lobby');
const kmBattle = require('./km-battle');
const createGyms = require('./km-gyms');
const createDuels = require('./km-duels');
const createWheels = require('./wheels');
const shop = require('./shop');
const arenaItems = require('./arena-items');
const arenaLevel = require('./arena-level');
const luck = require('./luck');
const cards = require('./cards');
const zlib = require('zlib');
const crypto = require('crypto');

// Cosmetic Shop: aktuelle Rotation mit Restzeit (der Browser rechnet selbst weiter)
function shopRot() {
    const now = Date.now(), r = shop.rotation(now);
    return { day: { ids: r.day.ids, left: r.day.ends - now }, week: { ids: r.week.ids, left: r.week.ends - now } };
}
const achievements = require('./achievements');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');

const accounts = createAccounts(DATA_DIR);
const wheels = createWheels({ accounts });
const tickets = createTickets(DATA_DIR);

// Kekemon (5.0): Karten einmal beim Start rechnen. Der Katalog (~2000 Karten)
// geht per HTTP (gzip, lange cachebar ueber ?v=HASH), nicht ueber den Socket.
const cardDb = cards.load(DATA_DIR);
const cardJson = JSON.stringify(cards.catalog(cardDb));
const cardHash = crypto.createHash('sha1').update(cardJson).digest('hex').slice(0, 10);
const cardGz = zlib.gzipSync(cardJson);
console.log(`Kekemon: ${cardDb.cards.length} Karten aus ${cardDb.source || 'nichts'}`);

// Achievement erreicht (#3): allen Fenstern des Kontos zeigen, Feed-Zeile
accounts.onUnlock = (key, a) => {
    for (const c of clients.values()) {
        if (c.account !== key) continue;
        send(c, { type: 'achievement', id: a.id, icon: a.icon, name: a.name, desc: a.desc, title: a.title || null });
        sendAccount(c);
    }
    const u = accounts.get(key);
    if (u) feed(`🏆 ${u.name} unlocked ${a.icon} ${a.name}`, 'good');
};

// Umzug snake.flashkeks.com -> game.flashkeks.com (23.09.2026): steht
// SNAKE_CANONICAL_HOST, leiten alle anderen Hosts (ausser localhost) dorthin
// weiter. Erst setzen, wenn der neue Name im DNS und im Tunnel steht.
const CANONICAL = process.env.SNAKE_CANONICAL_HOST || '';

// Event-Loop-Verzoegerung messen: haengt der Server, merkt es jeder als Lag.
// Jede Minute eine Zeile: p99/Max der Verzoegerung, Verbindungen, Top-Nachrichten.
const loopLag = require('perf_hooks').monitorEventLoopDelay({ resolution: 20 });
loopLag.enable();
setInterval(() => {
    const ms = x => (x / 1e6).toFixed(0);
    const top = [...netStat.entries()].sort((a, b) => b[1][1] - a[1][1]).slice(0, 5)
        .map(([t, [n, b]]) => `${t} ${n}x ${(b / 1024).toFixed(0)}KB`).join(', ');
    const total = [...netStat.values()].reduce((s, [, b]) => s + b, 0);
    console.log(`perf: loop p99 ${ms(loopLag.percentile(99))} ms, max ${ms(loopLag.max)} ms · ${clients.size} Verbindungen · raus ${(total / 1024 / 60).toFixed(1)} KB/s · ${top}`);
    loopLag.reset();
    netStat.clear();
}, 60000).unref();

// index.html einmal je Start bauen: jede eingebundene Datei bekommt ?v=Inhalts-Hash
let indexCache = null;
function indexHtml() {
    if (indexCache) return indexCache;
    const ver = f => {
        try {
            return crypto.createHash('md5').update(fs.readFileSync(path.join(PUBLIC, f))).digest('hex').slice(0, 10);
        } catch {
            return String(Date.now());
        }
    };
    indexCache = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
        .replace(/(src|href)="\/([\w.-]+\.(?:js|css))"/g, (m, attr, f) => `${attr}="/${f}?v=${ver(f)}"`)
        .replace("fetch('patchnotes.json')", `fetch('patchnotes.json?v=${ver('patchnotes.json')}')`);
    return indexCache;
}

const server = http.createServer((req, res) => {
    const host = String(req.headers.host || '').split(':')[0];
    if (CANONICAL && host && host !== CANONICAL && !/^(localhost|127\.0\.0\.1)$/.test(host)) {
        res.writeHead(301, { Location: `https://${CANONICAL}${req.url}` });
        return res.end();
    }
    const url = req.url.split('?')[0];
    if (url === '/cards.json') {
        const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': /[?&]v=/.test(req.url) ? 'public, max-age=86400' : 'no-cache',
            ...(gz ? { 'Content-Encoding': 'gzip' } : {})
        });
        return res.end(gz ? cardGz : cardJson);
    }
    // index.html mit Versions-Hash an CSS/JS (5.3b): Cloudflare setzt fuer
    // .css/.js 4 h Browser-Cache – ohne ?v= liefen nach einem Deploy alter und
    // neuer Code gemischt (Pack-Oeffnen blieb haengen, Markt-Karten tot)
    if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        return res.end(indexHtml());
    }
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
            '.css': 'text/css',
            '.png': 'image/png',
            '.svg': 'image/svg+xml',
            '.json': 'application/json'
        };

        res.writeHead(200, {
            'Content-Type': types[ext] || 'application/octet-stream',
            // Mit ?v= (aus indexHtml) aendert sich die Adresse bei jedem Deploy
            'Cache-Control': /[?&]v=/.test(req.url) ? 'public, max-age=31536000, immutable' : 'no-cache'
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
// Laenge (und damit Score) ist unbegrenzt; gezeichnet werden hoechstens
// MAX_BODY Felder, sonst verstopft eine Riesenschlange Arena und Leitung.
const MAX_BODY = 5000;
const MAX_LEN = 1e9;
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
    { key: 'jackpot', icon: '💎', label: 'Jackpot +50', good: true, rarity: 'gold', weight: 3 },
    // Kleine Coins (5.0, Max): meist 10–100, 10k extrem selten (~1 von 30 000 Boxen)
    { key: 'coins', icon: '🪙', label: 'Coins', good: true, rarity: 'blue', weight: 8 },
    { key: 'slow', icon: '🐌', label: 'Snail', good: false, rarity: 'bad', weight: 9 },
    { key: 'reverse', icon: '🔄', label: 'Reversed', good: false, rarity: 'bad', weight: 7 },
    { key: 'half', icon: '✂️', label: 'Halved', good: false, rarity: 'bad', weight: 6 },
    { key: 'death', icon: '💀', label: 'Unlucky', good: false, rarity: 'dead', weight: 2 }
];

// Heist: so viel Laenge nimmt man jedem anderen weg
const HEIST_PCT = 0.10;

// Betrag der Coin-Box: [Coins, Gewicht]
const BOX_COINS = [[10, 40], [25, 25], [50, 15], [100, 10], [250, 5], [500, 3], [1000, 1.5], [2500, 0.45], [10000, 0.05]];

function boxCoins() {
    let x = Math.random() * BOX_COINS.reduce((s, [, w]) => s + w, 0);
    for (const [n, w] of BOX_COINS) if ((x -= w) < 0) return n;
    return BOX_COINS[0][0];
}

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
    // Schutz nach einem Mini-Event (und nach dem Double or Nothing danach)
    afterEvent: 3000,
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
    p.body = p.body.slice(0, Math.min(p.len, MAX_BODY));
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

// Fuer andere nicht da: Geist, am Muenzwurf oder beim Double-or-Nothing nach einem Event
function intangible(p) {
    return active(p, 'ghost') || (p.frozen && (p.frozen.kind === 'gamble' || p.frozen.kind === 'offer'));
}

// Eingefroren laufen die Effekt-Timer nicht weiter. Beim Auftauen wird
// alles, was beim Einfrieren noch lief, um die Standzeit verlaengert.
function resumeFx(p, started) {
    const shift = Date.now() - started;
    if (shift <= 0) return;
    for (const k of Object.keys(p.fx)) {
        if (p.fx[k] > started) p.fx[k] += shift;
    }
}

// Messung (5.3b, Lag-Meldungen): Nachrichten und Bytes je Typ, pro Minute im Journal
const netStat = new Map();      // type -> [Anzahl, Bytes]
function count(type, bytes, n = 1) {
    const e = netStat.get(type) || [0, 0];
    e[0] += n;
    e[1] += bytes * n;
    netStat.set(type, e);
}

function send(c, obj) {
    if (c.ws.readyState !== WebSocket.OPEN) return;
    const msg = JSON.stringify(obj);
    count(obj.type, msg.length);
    c.ws.send(msg);
    if (c.watchers && c.watchers.size) mirror(c, obj, msg);
}

// ---------- Zuschauen (Admin, 6.3) ----------
// Das Admin-Interface erzeugt einen Einmal-Link (/?watch=TOKEN, 60 s gueltig).
// Die Zuschauer-Verbindung bekommt dann alles, was der Server dem Spieler
// schickt (send), dazu dessen Bildschirm/Tab ('ui' vom Spieler-Client). Sie
// ist nur lesend: der Server ignoriert alles von ihr ausser 'watch'.
// Das Snake-Feld bekommt sie ohnehin (geht an alle), der Browser zentriert
// auf die Id des Spielers.

const watchTokens = new Map();      // token -> { key, exp }

function createWatch(key) {
    for (const [t, w] of watchTokens) if (w.exp < Date.now()) watchTokens.delete(t);
    const token = crypto.randomBytes(24).toString('hex');
    watchTokens.set(token, { key, exp: Date.now() + 60000 });
    return token;
}

// Session-Token des Spielers nie weitergeben; Abmelde-Nachrichten nicht spiegeln
function mirror(c, obj, msg) {
    let out = msg;
    if (obj.type === 'auth') out = JSON.stringify({ type: 'watchAuth', user: obj.user });
    else if (obj.type === 'authExpired' || obj.type === 'kicked') out = JSON.stringify({ type: 'watchEnd', reason: 'Player was logged out' });
    for (const w of c.watchers) if (w.ws.readyState === WebSocket.OPEN) w.ws.send(out);
}

function watchStart(c, token) {
    const t = watchTokens.get(String(token || ''));
    watchTokens.delete(String(token || ''));
    if (!t || t.exp < Date.now()) return send(c, { type: 'watchError', error: 'Link expired – start watching again from the admin page' });
    // Mehrere Tabs: der zuletzt aktive
    const target = [...clients.values()].filter(x => x.account === t.key && !x.watching).sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))[0];
    if (!target) return send(c, { type: 'watchError', error: 'Player is offline' });
    c.watching = target;
    c.where = 'watch';
    target.watchers = target.watchers || new Set();
    target.watchers.add(c);
    const u = accounts.get(t.key);
    send(c, { type: 'watchStart', name: u.name, id: target.id, user: accounts.publicUser(u), ui: target.ui || null, joined: !!target.joined, guest: !!target.guest });
    // Laufender Raid/Match: Einstiegsdaten nur an den Zuschauer
    const ar = rooms.arenaOf(target) || (shooter.has(target) ? shooter : null);
    if (ar && ar.joinedMsg) send(c, ar.joinedMsg(target));
    // Frische Staende (Konto, Kekemon, Markt, Arena) – gehen an den Spieler und werden gespiegelt
    if (target.account) mkRefresh(target);
    console.log(`watch: Admin schaut ${u.name} zu`);
}

// Was macht ein Konto gerade? (Admin-Liste)
function activityOf(key) {
    const conns = [...clients.values()].filter(x => x.account === key && !x.watching);
    if (!conns.length) return null;
    const c = conns.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))[0];
    const p = players.get(c.id);
    let what = whereOf(c);
    if (p) what = `🐍 Snake · length ${p.len} · score ${scoreOf(p).toLocaleString("en-US")}`;
    const ui = c.ui || {};
    if (!what) {
        const tab = { kekemon: ui.kmTab, arenahub: ui.hubTab, market: ui.mkTab }[ui.screen];
        const SCREEN = { menu: '🏠 Menu', casino: '🎰 Casino', daily: '🎡 Daily Wheel', cross: '🐔 Crossy Road', plinko: '🔻 Plinko', slots: '🎰 Slots', slots2: '🌟 Starlight', kekemon: '🃏 Kekémon', arenahub: '🔫 Arena', market: '🏛️ Market', shop: '🎨 Shop', support: '💬 Support', konto: '👤 Account', pokerlobby: '♠️ Poker lobby', event: '🎪 Event', offer: '🎲 Offer' };
        what = (SCREEN[ui.screen] || ui.screen || '…') + (tab ? ' · ' + tab : '');
    }
    return { what, tabs: conns.length, idle: Math.round((Date.now() - (c.lastActive || Date.now())) / 1000), watchers: c.watchers ? c.watchers.size : 0 };
}

function broadcast(obj) {
    const msg = JSON.stringify(obj);
    let n = 0;
    for (const ws of wss.clients) {
        if (ws.readyState === WebSocket.OPEN) { ws.send(msg); n++; }
    }
    count(obj.type, msg.length, n);
}

// who: Spieler-ID, fuer den der Eintrag gilt (nur der hoert den Sound).
// big: laut fuer alle (ab ×10 an der Muenze).
function feed(text, kind, who, big) {
    broadcast({ type: 'feed', text, kind: kind || 'info', who: who || null, big: !!big });
}

// Nur fuer bestimmte Spieler (6.4, Max: nicht jede Box und jede Kirsche von
// allen im Feed). ids: der Ausloeser und wen es trifft.
function feedTo(ids, text, kind, who) {
    const msg = { type: 'feed', text, kind: kind || 'info', who: who || null, big: false };
    for (const id of new Set(ids)) {
        const c = clients.get(id);
        if (c) send(c, msg);
    }
}

let achRatesCache = null;

// ---------- In game (5.0): wer spielt gerade wo ----------

// Schirm -> Anzeige. Menue, Konto, Support usw. zaehlen nicht als "spielt".
const WHERE = {
    casino: '🎰 Casino', daily: '🎁 Daily Wheel', cross: '🐔 Crossy Road', plinko: '🔻 Plinko',
    pokerlobby: '♠️ Poker', slots: '🎰 Slots', slots2: '🌟 Starlight', arenahub: '🔫 Arena',
    shooter: '🔫 Arena', kekemon: '🃏 Kekémon', shop: '🎨 Shop', event: '🎪 Event', market: '🏛️ Market'
};
const TABLE_WHERE = { blackjack: '🃏 Blackjack', roulette: '🎡 Roulette', poker: '♠️ Poker' };

function whereOf(c) {
    if (players.has(c.id)) return null;           // steht schon als Snake-Spieler in der Liste
    const k = rooms.kindOf(c);
    if (k) return k === 'zombies' ? '🧟 Zombies' : '⚔️ PvP';
    if (shooter.has(c)) return '🪂 Raid';
    const t = tables.tableOf(c);
    if (t) return TABLE_WHERE[t.kind] || '🎰 Casino';
    return WHERE[c.where] || null;
}

let lastWhere = '';
setInterval(() => {
    const seen = new Map();
    const online = new Set();
    for (const c of clients.values()) {
        const u = c.account ? accounts.get(c.account) : null;
        const name = u ? u.name : null;
        if (!name) continue;
        online.add(name);
        const w = whereOf(c);
        // Mehrere Tabs: der spannendere Ort gewinnt (Match vor Hub)
        if (w && (!seen.has(name) || /Raid|PvP|Zombies/.test(w))) seen.set(name, w);
    }
    const list = [...seen].map(([name, w]) => ({ name, w })).sort((a, b) => a.w.localeCompare(b.w) || a.name.localeCompare(b.name)).slice(0, 40);
    // online: alle eingeloggten Namen, fuer die @-Vervollstaendigung im Chat
    const msg = { type: 'where', list, online: [...online].sort().slice(0, 200) };
    const j = JSON.stringify(msg);
    if (j === lastWhere) return;
    lastWhere = j;
    broadcast(msg);
}, 3000);

// ---------- Kekemon (5.0) ----------

// Sammlung: u.cards = { Schluessel: Anzahl }, Schluessel = Karten-Id oder
// Id~Variante ('p' Pokeball, 'm' Masterball, 's' Shiny, z. B. 'a123~ms').
function kmState(c, extra) {
    const u = accounts.get(c.account);
    // inv (6.1): ungeoeffnete Packs { packId: Anzahl }; wheel: Daily Pack Wheel
    send(c, {
        type: 'kmState', v: cardHash, have: u.cards || {}, packs: (u.stats && u.stats.packs) || 0,
        // 6.7: XP je Kopie { key: [xp, …] } und die Kurve
        xp: kmLevel.normalizeAll(u), lvCurve: kmLevel.catalog(), frag: u.kmFrag || 0, fragPer: gyms.FRAG_PER_PACK,
        inv: u.packs || {}, wheel: { ready: wheels.ready('pack', u), segs: wheels.segments('pack') }, ...extra
    });
}

const KM_VNAME = { p: 'Pokeball', m: 'Masterball', s: 'Shiny' };

function kmHandle(c, d) {
    if (!c.account) return send(c, { type: 'kmError', error: 'Log in to collect cards' });
    const u = accounts.get(c.account);
    u.cards = u.cards || {};
    if (d.type === 'kmState') return kmState(c);
    u.packs = u.packs || {};
    // Kaufen (6.1): landet ungeoeffnet im Inventar (Tab "Packs")
    if (d.type === 'kmBuy') {
        if (!Object.prototype.hasOwnProperty.call(cards.PACKS, d.pack)) return send(c, { type: 'kmError', error: 'Unknown pack' });
        const p = cards.PACKS[d.pack];
        if (p.wheel) return send(c, { type: 'kmError', error: 'This pack is not for sale' });
        const n = Math.max(1, Math.min(10, Math.floor(Number(d.n)) || 1));
        if (u.coins < p.price * n) return send(c, { type: 'kmError', error: 'Not enough coins' });
        accounts.addCoins(c.account, -p.price * n);
        accounts.earn(c.account, 'cards', -p.price * n);
        u.packs[d.pack] = (u.packs[d.pack] || 0) + n;
        accounts.touch();
        sendAccount(c);
        return kmState(c, { bought: { pack: d.pack, n } });
    }
    // Verfuettern (6.7): Kopien derselben Karte opfern, XP fuer die beste Kopie von target
    if (d.type === 'kmFeed') {
        const target = String(d.target || ''), source = String(d.source || '');
        const a = cards.parseKey(target), b = cards.parseKey(source);
        const card = cardDb.byId[a.id];
        if (!card || a.id !== b.id) return send(c, { type: 'kmError', error: 'You can only feed copies of the same card' });
        if (!(u.cards[target] > 0) || !(u.cards[source] > 0)) return send(c, { type: 'kmError', error: 'You do not own that card' });
        const want = Math.max(1, Math.min(99, Math.floor(Number(d.n)) || 1));
        let res = null, n = 0;
        for (let i = 0; i < want; i++) {
            const r = kmLevel.feed(u, target, source, card.rarity);
            if (!r) break;
            n++;
            res = res ? { ...r, xp: res.xp + r.xp, from: res.from } : r;
        }
        if (!n) return send(c, { type: 'kmError', error: 'Nothing to feed – you keep the card you feed into' });
        accounts.stat(c.account, st => { st.kmFed = (st.kmFed || 0) + n; });
        accounts.touch();
        return kmState(c, { fed: { ...res, n, name: card.name } });
    }
    // Booster-Teile einloesen (6.7): 10 Teile = 1 Trainer Booster
    if (d.type === 'kmFragBuy') {
        const per = gyms.FRAG_PER_PACK;
        const n = Math.max(1, Math.min(99, Math.floor(Number(d.n)) || 1));
        if ((u.kmFrag || 0) < per * n) return send(c, { type: 'kmError', error: `You need ${per * n} booster pieces` });
        u.kmFrag -= per * n;
        u.packs.train = (u.packs.train || 0) + n;
        accounts.touch();
        return kmState(c, { bought: { pack: 'train', n } });
    }
    // Daily Pack Wheel (6.1)
    if (d.type === 'kmWheel') {
        const r = wheels.spin('pack', c.account);
        if (r.err) return send(c, { type: 'kmError', error: r.err });
        const [pid, n] = r.prize;
        u.packs[pid] = (u.packs[pid] || 0) + n;
        accounts.stat(c.account, st => { st.packWheels = (st.packWheels || 0) + 1; });
        accounts.touch();
        if (r.slot === 'jackpot') feed(`🌟 ${u.name} hit the JACKPOT on the Daily Pack Wheel!`, 'gold', c.id);
        return kmState(c, { wheelSpin: { index: r.index, prize: r.prize } });
    }
    // Oeffnen aus dem Inventar (6.1)
    if (d.type === 'kmOpen') {
        if (!Object.prototype.hasOwnProperty.call(cards.PACKS, d.pack)) return send(c, { type: 'kmError', error: 'Unknown pack' });
        if (!(u.packs[d.pack] > 0)) return send(c, { type: 'kmError', error: 'You have no such pack' });
        if (!cardDb.cards.length) return send(c, { type: 'kmError', error: 'No cards loaded' });
        const got = cards.openPack(cardDb, d.pack);
        // Nur fuer lokale Tests: Varianten erzwingen
        if (process.env.SNAKE_TEST === '1' && Array.isArray(d.testV)) got.forEach((g, i) => { if (typeof d.testV[i] === 'string') g.v = d.testV[i]; });
        u.packs[d.pack]--;
        if (!u.packs[d.pack]) delete u.packs[d.pack];
        // Neu = diese Karte (egal welche Variante) noch gar nicht im Album
        const ownsBase = id => Object.keys(u.cards).some(k => cards.parseKey(k).id === id && u.cards[k] > 0);
        const fresh = [];
        for (const g of got) {
            fresh.push(!ownsBase(g.id));
            const k = cards.keyOf(g.id, g.v);
            u.cards[k] = (u.cards[k] || 0) + 1;
        }
        accounts.stat(c.account, st => { st.packs = (st.packs || 0) + 1; });
        accounts.touch();
        // Grosse Zuege in den Feed: ab Legendary, jeder Masterball, jedes Shiny
        for (const g of got) {
            const card = cardDb.byId[g.id];
            const r = cards.RIDX[card.rarity];
            if (r < cards.RIDX.legendary && !/[ms]/.test(g.v)) continue;
            const tags = [...g.v].map(ch => KM_VNAME[ch]).join(' ');
            const mega = card.rarity === 'secret' && g.v.includes('m') && g.v.includes('s');
            feed(`🃏 ${u.name} pulled ${mega ? '🌈 SUPER MEGA ' : ''}${tags ? tags + ' ' : ''}${cards.RARITIES[r].name} ${card.name}!`, 'gold', c.id, mega || card.rarity === 'secret');
        }
        sendAccount(c);
        return kmState(c, { opened: { pack: d.pack, cards: got, fresh } });
    }
    if (d.type === 'kmSell' || d.type === 'kmSellDupes') {
        // Von jeder Karte bleibt immer mindestens ein Exemplar (egal welche Variante)
        const total = id => Object.keys(u.cards).reduce((n, k) => n + (cards.parseKey(k).id === id ? u.cards[k] : 0), 0);
        let list;
        if (d.type === 'kmSell') list = [[String(d.key), Math.max(1, Math.floor(Number(d.n) || 1))]];
        // Doppelte verkaufen: nur normale Exemplare, Ball/Shiny bleiben
        else list = Object.keys(u.cards).filter(k => !k.includes('~')).map(k => [k, u.cards[k]]);
        let n = 0, coins = 0;
        for (const [key, want] of list) {
            const { id, v } = cards.parseKey(key);
            const card = cardDb.byId[id];
            if (!card || !(u.cards[key] > 0)) continue;
            // 6.7: "Doppelte verkaufen" laesst gelevelte Kopien in Ruhe
            const lvl = d.type === 'kmSellDupes' ? kmLevel.normalize(u, key).length : 0;
            const k = Math.min(want, u.cards[key] - lvl, total(id) - 1);
            if (k <= 0) continue;
            u.cards[key] -= k;
            if (!u.cards[key]) delete u.cards[key];
            n += k;
            coins += k * cards.valueOf(card, v);
        }
        if (!n) return send(c, { type: 'kmError', error: 'Nothing to sell – you always keep one of each card' });
        accounts.addCoins(c.account, coins);
        accounts.earn(c.account, 'cards', coins);
        accounts.touch();
        sendAccount(c);
        return kmState(c, { sold: { n, coins } });
    }
}

function sendAccount(c) {
    const u = c.account ? accounts.get(c.account) : null;
    send(c, { type: 'account', user: u ? accounts.publicUser(u) : null });
}

// ---------- Bestenliste ----------

let lastTop = '';

// Gewinne aus Budget Starlight bleiben aus der Bestenliste (und die Gold-Zeile
// aus dem Feed), bis der Browser die Animation fertig hat ('spin2Done') –
// sonst sieht man direkt nach dem Bonus-Kauf, was rauskommt.
// Rueckfall: Timer nach geschaetzter Animationsdauer, oder Verbindungsende.
// Die Statistik je Spiel (#5) wird ebenfalls erst hier verbucht (onReveal),
// damit das Leaderboard (#8) keinen Ausgang vorab verraet.
const pendingWins = new Map();  // Konto -> { amount, feed, timer, onReveal }

// Leaderboard (#8): Kategorien und Spiele mit sinnvollem Multi
const BOARD_CATS = ['score', 'coins', 'kills', 'bigwin', 'bestx', 'casino', 'events', 'arena', 'alevel', 'pvp', 'zwave', 'kmduel'];
const BOARD_X_GAMES = ['starlight', 'slots', 'plinko', 'crossy', 'roulette', 'blackjack', 'poker'];

function hideWin(key, amount, feedLine, ms, onReveal) {
    revealWin(key);
    const timer = setTimeout(() => revealWin(key), ms);
    pendingWins.set(key, { amount, feed: feedLine, timer, onReveal });
}

function revealWin(key) {
    const w = pendingWins.get(key);
    if (!w) return;
    clearTimeout(w.timer);
    pendingWins.delete(key);
    if (w.onReveal) w.onReveal();
    if (w.feed) feed(...w.feed);
    pushTop(false);
}

function topNow() {
    return accounts.top(key => pendingWins.has(key) ? pendingWins.get(key).amount : 0);
}

function pushTop(force) {
    const top = JSON.stringify(topNow());
    if (!force && top === lastTop) return;
    lastTop = top;
    broadcast({ type: 'highscores', top: JSON.parse(top) });
}

setInterval(() => pushTop(false), 5000);

function recordScore(p) {
    if (!p.account) return;
    const score = scoreOf(p);
    // Jede Runde zaehlt einzeln (Max): die besten 10 Runden je Konto und Zeitraum,
    // damit man mehrfach auf dem Score-Leaderboard stehen kann
    // Liste zuerst (startet mit dem alten Bestwert, sonst faellt der vom Board), dann Bestwert
    accounts.stat(p.account, s => { if (score > 0) s.topRuns = accounts.addRun(s.topRuns, s.bestScore, score); s.bestScore = Math.max(s.bestScore, score); });
    accounts.period(p.account, x => { if (score > 0) x.topRuns = accounts.addRun(x.topRuns, x.bestScore, score); x.bestScore = Math.max(x.bestScore, score); });
}

// ---------- Tod, Verlassen, Cashout ----------

// Spieler vom Feld nehmen. Der Client landet wieder im Menue.
function removeFromField(id) {
    const p = players.get(id);
    if (!p) return;
    players.delete(id);
    // Spielzeit auf dem Feld (#5)
    if (p.account && p.joinedAt) accounts.stat(p.account, s => { s.playMs += Date.now() - p.joinedAt; });
    p.joinedAt = null;
    p.joined = false;
    p.frozen = null;
    p.cashout = null;
}

// cause: wall, self, body, duel, star, gamble, box – der Browser macht daraus den Text
function kill(id, killerId, how, cause) {
    const victim = players.get(id);
    if (!victim) return;

    const killer = killerId ? players.get(killerId) : null;

    if (killer) {
        // Killer waechst um die halbe Laenge des Opfers (aufgerundet)
        grow(killer, Math.ceil(victim.len / 2));
        killer.kills++;
        killer.streak++;
        if (killer.account) accounts.stat(killer.account, s => { s.bestStreak = Math.max(s.bestStreak || 0, killer.streak); });
        if (killer.account) {
            accounts.stat(killer.account, s => { s.kills++; });
            accounts.period(killer.account, x => { x.kills++; });
        }

        feed(`${killer.name} 🗡️ ${victim.name}`, 'kill');
        if (STREAKS[killer.streak]) feed(`${killer.name}: ${STREAKS[killer.streak]}!`, 'streak', killerId);
    } else {
        feed(`${victim.name} ${how || '☠️'}`, 'kill');
    }

    recordScore(victim);
    if (victim.account) accounts.stat(victim.account, s => { s.deaths++; });
    const head = victim.body[0];
    // Todes-Effekt aus dem Shop (#9): alle sehen ihn
    if (victim.cos && victim.cos.death && head) broadcast({ type: 'deathfx', fx: victim.cos.death, x: head.x, y: head.y });
    send(victim, {
        type: 'died',
        by: killer ? killer.name : null,
        byId: killer ? killerId : null,
        how: how || null,
        cause: cause || null,
        at: head ? { x: head.x, y: head.y } : null,
        score: scoreOf(victim)
    });
    removeFromField(id);
}

// Score -> Coins (5.5, Max): bis 10 000 eins zu eins, danach immer flacher.
// Stuetzpunkte 10k -> 10k, 100k -> 30k, 1 Mio -> 100k; dazwischen und darueber
// als Potenzkurve (glatt, keine Spruenge). Der Score selbst bleibt unbegrenzt.
// Gleiche Formel im Browser (cashCoins in index.html) fuer die Anzeige.
function cashCoins(score) {
    if (score <= 10000) return Math.max(0, Math.floor(score));
    if (score <= 100000) return Math.floor(10000 * Math.pow(score / 10000, Math.log10(3)));
    return Math.floor(30000 * Math.pow(score / 100000, Math.log10(10 / 3)));
}

function finishCashout(id, p) {
    const score = scoreOf(p);
    const coins = cashCoins(score);
    recordScore(p);
    const balance = accounts.addCoins(p.account, coins);
    accounts.earn(p.account, 'snake', coins);
    accounts.stat(p.account, s => {
        s.cashouts++;
        s.totalCashout += coins;
        s.bestCashout = Math.max(s.bestCashout, coins);
    });

    feed(`💰 ${p.name} cashed out ${coins.toLocaleString('en-US')} coins${coins < score ? ` (score ${score.toLocaleString('en-US')})` : ''}`, coins >= 200 ? 'gold' : 'good', id);
    send(p, { type: 'cashedout', coins, score, balance });
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

    // Die Walze sehen nur die Beteiligten. Alle anderen sehen zwei blinkende
    // Schlangen und das Ergebnis im Feed.
    const msg = {
        type: 'duel',
        fighters: ids.map(id => ({ id, color: players.get(id).color, name: players.get(id).name })),
        winner,
        ms: DUEL_MS
    };
    ids.forEach(id => send(players.get(id), msg));
    feed(`⚔️ Head to head: ${ids.map(id => players.get(id).name).join(' vs ')}`, 'info');
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

        if (f.kind === 'offer') {
            const p = players.get(f.pid);
            if (!p || p.frozen !== f) continue;
            p.frozen = null;
            resumeFx(p, f.started);
            p.fx.ghost = Math.max(p.fx.ghost || 0, now + DURATION.afterEvent);
            continue;
        }

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
                if (id !== f.winner && p && p.frozen === f) kill(id, f.winner, null, 'duel');
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
                    feedTo([id], `🛡️ ${p.name}'s shield blocked a 🪙💀`, 'good', id);
                    continue;
                }
                kill(id, null, 'gambled it all away 🪙💀', 'gamble');
                continue;
            }

            setLen(p, p.len * o.mul);

            // Ab ×10: alle sollen es sehen
            if (o.mul >= 10) {
                p.fx.jackpot = now + DURATION.jackpot;
                broadcast({ type: 'jackpot', id, name: p.name, icon: o.icon, len: p.len, rarity: o.rarity });
            }

            const kind = o.rarity === 'gold' || o.rarity === 'mythic' ? 'gold' : o.good ? 'good' : 'bad';
            // Ab ×10 fuer alle, sonst nur fuer einen selbst
            if (o.mul >= 10) feed(`${p.name} 🪙 ${o.icon} → length ${p.len}`, kind, id, true);
            else feedTo([id], `${p.name} 🪙 ${o.icon} → length ${p.len}`, kind, id);
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
    // Wen die Box ausser dem Oeffner trifft; die sehen die Zeile auch
    const hitIds = [];

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
            grow(p, 50);
            break;
        case 'coins': {
            // Gaeste haben kein Konto: fuer die gibt es Laenge statt Coins
            if (!p.account) {
                grow(p, 5);
                text = `${p.name} ❓ 🪙 +5 (log in for coins)`;
                break;
            }
            const n = boxCoins();
            accounts.addCoins(p.account, n);
            accounts.earn(p.account, 'snake', n);
            sendAccount(p);
            text = `${p.name} ❓ 🪙 found ${n.toLocaleString('en-US')} coins`;
            if (n >= 10000) {
                feed(text + '!', 'gold', id, true);
                return;
            }
            if (n >= 1000) text += '!';
            break;
        }
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
            p.body = p.body.slice(0, Math.min(p.len, MAX_BODY));
            p.fx.ghost = Math.max(p.fx.ghost || 0, now + 1000);
            break;
        }
        case 'slowall':
            for (const q of others(p)) {
                q.fx.slow = now + DURATION.slowall;
                q.fx.speed = 0;
                hitIds.push(q.id);
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
            hitIds.push(q.id);
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
                    hitIds.push(q.id);
                }
            }
            text = `${p.name} 💥 Shockwave` + (hit.length ? `: ${hit.join(', ')} halved` : ' hit nothing');
            break;
        }
        case 'steal': {
            let loot = 0;
            for (const q of others(p)) {
                // 10 % der Laenge (mind. 1), seit 5.0 statt flat 3 (Max); Stern schuetzt
                if (active(q, 'star')) continue;
                const take = Math.min(Math.max(1, Math.round(q.len * HEIST_PCT)), q.len - 1);
                if (take > 0) {
                    setLen(q, q.len - take);
                    loot += take;
                    hitIds.push(q.id);
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
            hitIds.push(q.id);
            text = `${p.name} 🔀 ${q.name}: ${a} ⇄ ${b}`;
            // Alle sehen den Strahl zwischen den Koepfen, die zwei bekommen ein Banner
            broadcast({ type: 'swapfx', a: p.id, b: q.id, an: p.name, bn: q.name, al: a, bl: b });
            break;
        }
        case 'death':
            // Schild faengt auch den Box-Tod ab
            if (active(p, 'shield')) {
                p.fx.shield = 0;
                feedTo([id], `🛡️ ${p.name}'s shield blocked a 💀 box`, 'good', id);
                return;
            }
            kill(id, null, 'opened a 💀 box', 'box');
            return;
    }

    const kind = o.rarity === 'gold' ? 'gold' : o.good === true ? 'good' : o.good === false ? 'bad' : 'info';
    feedTo([id, ...hitIds], text, kind, id);
}

// ---------- Nachrichten vom Browser ----------

const DIRS = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
};

async function handle(c, data) {
    // Zuschauer (6.3): nur lesen
    if (data.type === 'watch') return c.watching ? null : watchStart(c, data.token);
    if (c.watching) return;
    switch (data.type) {
        // --- Konto ---

        case 'register': {
            if (!allow('reg:' + c.ip, 5, 3600e3)) return send(c, { type: 'authError', error: 'Too many new accounts from here, try again later' });
            const r = await accounts.register(data.name, data.password);
            if (r.error) return send(c, { type: 'authError', error: r.error });
            c.account = r.key;
            send(c, { type: 'auth', token: r.token, user: r.user });
            sendTickets(c);
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
            sendTickets(c);
            return;
        }

        case 'resume': {
            const r = accounts.resume(data.token);
            if (!r) return send(c, { type: 'authExpired' });
            c.account = r.key;
            send(c, { type: 'auth', token: data.token, user: r.user });
            sendTickets(c);
            return;
        }

        case 'logout':
            if (c.joined) return send(c, { type: 'authError', error: 'Leave the game first' });
            if (c.cross) return send(c, { type: 'authError', error: 'Finish your Crossy Road run first' });
            tables.leave(c);
            shooter.leave(c);
            rooms.leave(c);
            trade.gone(c);
            lobby.leave(c);
            c.mkWatch = false;
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
            tables.leave(c);
            shooter.leave(c);
            rooms.leave(c);
            c.account = null;
            send(c, { type: 'auth', token: null, user: null, note: 'Account deleted' });
            pushTop(true);
            return;
        }

        // --- Spiel ---

        case 'join': {
            if (c.joined) return;
            tables.leave(c);
            shooter.leave(c);
            rooms.leave(c);
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
            c.joinedAt = Date.now();
            c.name = uniqueName(name);
            c.guest = !c.account;
            c.color = cleanColor(data.color) || pickColor();
            if (c.account) accounts.setColor(c.account, c.color);
            // Shop (#9): was andere von einem sehen
            c.cos = c.account ? shop.visible(accounts.get(c.account).equipped) : null;
            c.title = c.account ? accounts.titleOf(c.account) : null;
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
            // Map-Event (#6): Steuerung geht an das Minispiel
            if (events.direction(c, data.direction)) return;
            const p = players.get(c.id);
            if (!p) return;
            // Beim Cashout faehrt man stur geradeaus, im Event steht alles
            if (p.cashout || paused) return;

            let dir = Object.prototype.hasOwnProperty.call(DIRS, data.direction) ? DIRS[data.direction] : null;
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
                // Namensfarbe aus dem Shop (#9)
                nc: u && u.equipped && u.equipped.name ? u.equipped.name : undefined,
                tt: (u && accounts.titleOf(c.account)) || undefined,
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

        // Nur fuer lokale Tests (SNAKE_TEST=1): Box-Ergebnis direkt anwenden
        case 'testBox': {
            const o = BOX_OUTCOMES.find(x => x.key === data.key);
            if (process.env.SNAKE_TEST === '1' && o && players.has(c.id)) applyBox(c.id, c, o);
            return;
        }

        // Nur fuer lokale Tests (SNAKE_TEST=1): Event sofort starten
        case 'testEvent':
            if (process.env.SNAKE_TEST === '1' && !events.active()) {
                startEvent(data.kind);
            }
            return;

        // --- Support-Tickets ---

        case 'tickets':
            if (c.account) sendTickets(c);
            return;

        case 'ticketNew': {
            if (!c.account) return send(c, { type: 'ticketError', error: 'Accounts only' });
            if (!allow('ticket:' + c.account, 5, 3600e3)) return send(c, { type: 'ticketError', error: 'Too many new tickets, try again later' });
            const u = accounts.get(c.account);
            const r = tickets.create(c.account, u.name, data.subject, data.text);
            if (r.error) return send(c, { type: 'ticketError', error: r.error });
            accounts.stat(c.account, s => { s.ticketsCreated = (s.ticketsCreated || 0) + 1; });
            sendTickets(c, r.ticket.id);
            return;
        }

        case 'ticketReply': {
            if (!c.account) return;
            const now = Date.now();
            if (now - (c.lastTicketMsg || 0) < 2000) return send(c, { type: 'ticketError', error: 'Slow down a little' });
            c.lastTicketMsg = now;
            const r = tickets.userReply(c.account, Number(data.id), data.text);
            if (r.error) return send(c, { type: 'ticketError', error: r.error });
            sendTickets(c, r.ticket.id);
            return;
        }

        case 'ticketRead':
            if (c.account) {
                tickets.markRead(c.account, Number(data.id));
                sendTickets(c);
            }
            return;

        // --- Casino: Tische (Blackjack, Roulette) ---

        case 'tableJoin':
            if (c.joined) return send(c, { type: 'tableError', error: 'Leave the snake field first' });
            shooter.leave(c);
            rooms.leave(c);
            tables.join(c, String(data.kind));
            return;

        case 'pokerCreate':
            if (c.joined) return send(c, { type: 'tableError', error: 'Leave the snake field first' });
            shooter.leave(c);
            rooms.leave(c);
            tables.create(c, data);
            return;

        // --- Arena: Raid (Extraction) ---

        case 'shJoin': {
            if (!c.account) return send(c, { type: 'shError', error: 'Log in to raid' });
            if (c.joined) return send(c, { type: 'shError', error: 'Leave the snake field first' });
            if (c.cross) return send(c, { type: 'shError', error: 'Finish your Crossy Road run first' });
            if (rooms.inLobby(c)) return send(c, { type: 'shError', error: 'Leave your PvP lobby first' });
            const u = accounts.get(c.account);
            if (!u) return;
            tables.leave(c);
            const err = shooter.join(c, u.name, cleanColor(data.color) || u.color || null);
            if (err) send(c, { type: 'shError', error: err });
            return;
        }

        // Leaderboard (#8): eine Liste nach Kategorie, Spiel und Zeitraum
        case 'board': {
            const cat = String(data.cat);
            const period = String(data.period);
            const game = String(data.game || '');
            if (!BOARD_CATS.includes(cat) || !['day', 'week', 'all'].includes(period)) return;
            if (cat === 'bestx' && !BOARD_X_GAMES.includes(game)) return;
            if (!allow('board:' + c.id, 30, 60e3)) return;
            const list = accounts.board(cat, game, ['coins', 'alevel', 'pvp', 'zwave', 'kmduel'].includes(cat) ? 'all' : period, key => pendingWins.has(key) ? pendingWins.get(key).amount : 0);
            send(c, { type: 'board', cat, game, period, list });
            return;
        }

        // --- Achievements (#3): Titel anlegen/ablegen ---
        case 'setTitle': {
            if (!c.account) return;
            const err = accounts.setTitle(c.account, data.id === null ? null : String(data.id));
            if (err) return send(c, { type: 'authError', error: err });
            if (players.has(c.id)) c.title = accounts.titleOf(c.account);
            sendAccount(c);
            pushTop(true);
            return;
        }

        // --- Shop (#9) ---

        case 'shopRot':
            return send(c, { type: 'shopRot', rot: shopRot() });

        case 'shopBuy':
        case 'shopEquip': {
            if (!c.account) return send(c, { type: 'shopError', error: 'Accounts only' });
            const err = data.type === 'shopBuy'
                ? accounts.buy(c.account, String(data.id))
                : accounts.equip(c.account, String(data.cat), data.id === null ? null : String(data.id));
            if (err) return send(c, { type: 'shopError', error: err });
            if (data.type === 'shopBuy') {
                const it = shop.BY_ID[data.id];
                accounts.earn(c.account, 'shop', -it.price);
                if (it.rarity === 'epic' || it.rarity === 'legendary') feed(`🛒 ${accounts.get(c.account).name} bought ${it.icon} ${it.name}`, 'good', c.id);
            }
            // Auf dem Feld sofort sichtbar
            if (players.has(c.id)) c.cos = shop.visible(accounts.get(c.account).equipped);
            sendAccount(c);
            send(c, { type: 'shopOk', id: data.id || null, cat: data.cat || null, bought: data.type === 'shopBuy' });
            return;
        }

        // Achievements (5.0): Anteil aller Spieler je Achievement, 60 s zwischengespeichert
        case 'achRates':
            if (!achRatesCache || Date.now() - achRatesCache.at > 60000) achRatesCache = { at: Date.now(), ...accounts.achRates() };
            send(c, { type: 'achRates', total: achRatesCache.total, rates: achRatesCache.rates });
            return;

        // Kekemon-Kaempfe (5.6)
        case 'kbGyms':
        case 'kbStart':
        case 'kbAct':
        case 'kbLeave':
            gyms.handle(c, data);
            return;

        // Kekemon-Duelle (5.10)
        case 'kdState':
        case 'kdCreate':
        case 'kdJoin':
        case 'kdDecline':
        case 'kdCancel':
        case 'kdTeam':
        case 'kdAct':
            duels.handle(c, data);
            return;

        // In game (5.0): der Browser meldet seinen Schirm
        case 'where':
            c.where = String(data.w || '').slice(0, 20);
            return;

        // Bildschirm und Tabs (6.3, fuer Admin-Liste und Zuschauer)
        case 'ui': {
            const str = v => typeof v === 'string' ? v.slice(0, 20) : null;
            c.ui = { world: str(data.world), screen: str(data.screen), joined: !!data.joined, kmTab: str(data.kmTab), hubTab: str(data.hubTab), mkTab: str(data.mkTab), mkSub: str(data.mkSub), csTab: str(data.csTab) };
            if (c.watchers && c.watchers.size) for (const w of c.watchers) send(w, { type: 'watchUi', ui: c.ui });
            return;
        }

        // Kekemon (5.0): Sammlung, Packs, Doppelte verkaufen
        case 'kmState':
        case 'kmBuy':
        case 'kmOpen':
        case 'kmWheel':
        case 'kmFragBuy':
        case 'kmFeed':
        case 'kmSell':
        case 'kmSellDupes':
            kmHandle(c, data);
            return;

        // Konto-Seite: aktuelle Statistik holen (#5)
        case 'me':
            if (c.account) sendAccount(c);
            return;

        case 'shInput':
            (rooms.arenaOf(c) || shooter).input(c, data);
            return;

        // Arena-Hub (Extraction): Lager, Kaufen, Cases, Salvage, Loadout
        case 'arHub':
        case 'arBuy':
        case 'arCase':
        case 'arCaseOpen':
        case 'arWheel':
        case 'arSalvage':
        case 'arEquip':
        case 'arProg':
        case 'arPreset':
            shooter.hubAction(c, data);
            return;

        // Im Raid: Waffe wechseln, Verbrauchsgut (Q/G), Kiste/Beutel oeffnen, Inventar
        case 'shSlot':
        case 'shUse':
        case 'shInteract':
        case 'shInv':
        case 'shTrade':
            (rooms.arenaOf(c) || shooter).action(c, data);
            return;

        // Laufzeit messen, damit der Browser seine Vorhersage abgleichen kann
        case 'shPing':
            send(c, { type: 'shPong', t: Number(data.t) || 0 });
            return;

        case 'shLeave':
            if (rooms.arenaOf(c)) rooms.leave(c);
            else shooter.leave(c);
            return;

        // PvP-Lobbys (4.3)
        case 'pvpList':
        case 'pvpCreate':
        case 'pvpJoin':
        case 'pvpLeave':
        case 'pvpSwitch':
        case 'pvpStart':
            rooms.handle(c, data);
            return;

        // Markt (5.2): Auktionshaus und Lobby
        case 'mkState':
        case 'mkList':
        case 'mkBuy':
        case 'mkBid':
        case 'mkCancel':
        case 'mkClaim':
            market.handle(c, data);
            return;
        case 'mkLeave':
            c.mkWatch = false;
            return;

        case 'lbJoin':
        case 'lbLeave':
        case 'lbMove':
            lobby.handle(c, data);
            return;

        // Handel zwischen Spielern (4.5, seit 5.2 ueber den Markt)
        case 'trReq':
        case 'trAccept':
        case 'trDecline':
        case 'trSet':
        case 'trReady':
        case 'trCancel':
        case 'trState':
            trade.handle(c, data);
            return;

        case 'tableLeave':
            tables.leave(c);
            return;

        case 'tableAction':
            tables.handle(c, data);
            return;

        // Nur fuer lokale Tests (SNAKE_TEST=1): Raid-Figur versetzen
        case 'shTp': {
            const p = (rooms.arenaOf(c) || shooter)._players.get(c.id);
            if (process.env.SNAKE_TEST === '1' && p) {
                p.x = Number(data.x) || p.x;
                p.y = Number(data.y) || p.y;
                p.protect = 0;
            }
            return;
        }

        // Nur fuer lokale Tests (SNAKE_TEST=1): Boss oder Abwurf sofort
        case 'shTestEvent':
            if (process.env.SNAKE_TEST === '1') {
                if (data.boss) shooter._spawnBoss(data.boss === true ? undefined : String(data.boss));
                if (data.mob && shooter._players.get(c.id)) {
                    const p = shooter._players.get(c.id);
                    shooter._spawnMob(String(data.mob), p.x + (Number(data.dx) || 300), p.y + (Number(data.dy) || 0));
                }
                if (data.drop) shooter._spawnDrop();
                if (data.bossHp && shooter._boss()) shooter._boss().hp = Number(data.bossHp);
                if (data.clearMobs) shooter._mobs.length = 0;
                // Zombies: naechste Welle vorgeben (z. B. 10 = Boss-Welle), god = unverwundbar
                const za = rooms.arenaOf(c);
                if (za && za.zState() && data.zwave) {
                    const zb = za.zState();
                    za._mobs.length = 0;
                    zb.toSpawn = 0;
                    zb.wave = Number(data.zwave) - 1;
                    zb.phase = 'break';
                    zb.until = 0;
                }
                if (za && data.zmob && za._players.get(c.id)) {
                    const p = za._players.get(c.id);
                    String(data.zmob).split(',').forEach((k, i) => za._spawnMob(k, p.x + 160 + (i % 4) * 90, p.y - 150 + Math.floor(i / 4) * 110));
                }
                // Waffe/Verbrauchsgut direkt geben (Test der Unique-Optik)
                const tp = za ? za._players.get(c.id) : shooter._players.get(c.id);
                if (tp && data.give && arenaItems.WEAPONS[data.give]) {
                    tp.gear.primary = arenaItems.craft('weapon', String(data.give), 'ultra', []);
                    tp.slot = 'primary';
                }
                if (tp && data.giveUtil && arenaItems.UTILS[data.giveUtil]) tp.util[0] = { base: String(data.giveUtil), n: 3 };
                if (tp && data.giveArmor && arenaItems.ARMORS[data.giveArmor]) {
                    const it = arenaItems.craft('armor', String(data.giveArmor), 'ultra', []);
                    tp.gear[it.slot] = it;
                }
                if (za && data.god) for (const q of za._players.values()) q.protect = Date.now() + 3600e3;
                if (za && data.zBossHp && za._boss()) za._boss().hp = za._boss().maxHp * Number(data.zBossHp);
            }
            return;

        // Nur fuer lokale Tests (SNAKE_TEST=1): naechste Roulette-Zahl vorgeben
        case 'testTable':
            if (process.env.SNAKE_TEST === '1') tables._tables().roulette.forceResult = Number(data.result);
            return;

        // --- Casino: Daily Wheel ---

        case 'daily': {
            if (!c.account) return send(c, { type: 'dailyError', error: 'Accounts only' });
            if (!accounts.claimDaily(c.account)) return send(c, { type: 'dailyError', error: 'Already spun today – come back tomorrow' });
            // Luck (Admin v2): vorgegebener Mindestwert
            const rig = accounts.takeRig(c.account, 'daily');
            const r = rig ? luck.dailySpin(casino, rig.min) : casino.spinWheel();
            const u = accounts.get(c.account);
            const balance = accounts.addCoins(c.account, r.value);
            accounts.earn(c.account, 'daily', r.value);
            send(c, { type: 'daily', index: r.index, value: r.value, balance, user: accounts.publicUser(u) });
            // Erst nach dem Dreh (~7 s) in Bestenliste und Feed
            const line = r.value >= 10000 ? [`🎡 ${u.name} hit ${r.value} coins on the Daily Wheel!`, 'gold', c.id] : null;
            hideWin(c.account, r.value, line, 12000, () => accounts.game(c.account, 'daily', { win: r.value }));
            return;
        }

        case 'dailyDone':
            if (c.account) revealWin(c.account);
            return;

        // --- Casino: Crossy Road ---

        case 'crossStart': {
            if (!c.account) return send(c, { type: 'crossError', error: 'Accounts only' });
            if (c.cross) return;
            const bet = Number(data.bet);
            const diff = String(data.diff);
            // Nur echte Schwierigkeiten (Object.prototype.hasOwnProperty.call: '__proto__' waere sonst ein Treffer)
            if (!validBet(bet) || !Object.prototype.hasOwnProperty.call(casino.DIFFS, diff)) return send(c, { type: 'crossError', error: 'Invalid bet' });
            const u = accounts.get(c.account);
            if (!u || u.coins < bet) return send(c, { type: 'crossError', error: 'Not enough coins' });
            const balance = accounts.addCoins(c.account, -bet);
            c.cross = { bet, diff, step: 0, last: 0, safe: !!accounts.takeRig(c.account, 'crossy') };
            accounts.stat(c.account, s => { s.spins++; });
            send(c, { type: 'cross', state: 'run', step: 0, bet, diff, balance });
            return;
        }

        case 'crossStep': {
            const g = c.cross;
            if (!g) return;
            const now = Date.now();
            if (now - g.last < 250) return;
            g.last = now;
            const d = casino.DIFFS[g.diff];
            if (!g.safe && Math.random() < d.p) {
                c.cross = null;
                accounts.game(c.account, 'crossy', { wager: g.bet, win: 0 });
                return send(c, { type: 'cross', state: 'dead', step: g.step + 1, bet: g.bet, diff: g.diff, balance: accounts.get(c.account).coins });
            }
            g.step++;
            if (g.step >= d.lanes) {
                if (g.diff === 'hardcore') accounts.stat(c.account, s => { s.crossyHardcoreWins = (s.crossyHardcoreWins || 0) + 1; });
                return crossCash(c, true);
            }
            send(c, { type: 'cross', state: 'run', step: g.step, bet: g.bet, diff: g.diff, mult: casino.crossMult(g.diff, g.step) });
            return;
        }

        case 'crossCash':
            if (c.cross && c.cross.step > 0) crossCash(c, false);
            return;

        // --- Casino: Plinko ---
        // Ein Drop = eine Nachricht. Mehrere Kugeln duerfen gleichzeitig fallen,
        // der Server rechnet jede sofort ab; der Browser zieht den Gewinn erst
        // bei der Landung auf die Anzeige.

        case 'plinko': {
            if (!c.account) return send(c, { type: 'plinkoError', error: 'Accounts only' });
            const now = Date.now();
            if (now - (c.lastPlinko || 0) < 120) return send(c, { type: 'plinkoError', error: 'Too fast', quiet: true });
            const bet = Number(data.bet);
            const risk = String(data.risk);
            // Mindestens 10: darunter frisst das Abrunden die kleinen Multis auf
            if (!validBet(bet) || bet < plinko.MIN_BET || !plinko.valid(risk)) return send(c, { type: 'plinkoError', error: `Invalid bet (min ${plinko.MIN_BET})` });
            const u = accounts.get(c.account);
            if (!u || u.coins < bet) return send(c, { type: 'plinkoError', error: 'Not enough coins' });
            c.lastPlinko = now;

            accounts.addCoins(c.account, -bet);
            const rig = accounts.takeRig(c.account, 'plinko');
            const r = rig ? luck.plinkoDrop(plinko, bet, risk, rig.min) : plinko.drop(bet, risk);
            const balance = accounts.addCoins(c.account, r.win);
            accounts.stat(c.account, s => {
                s.spins++;
                s.biggestWin = Math.max(s.biggestWin, r.win);
            });
            send(c, { type: 'plinko', bet, risk, path: r.path, slot: r.slot, mult: r.mult, win: r.win, balance });
            // Bis die Kugel unten ist (~0,13 s je Reihe) nicht in Bestenliste und Feed
            const line = r.mult >= 100 && r.win >= 1000 ? [`🔻 ${u.name} hit ×${r.mult} on Plinko: ${r.win} coins`, 'gold', c.id] : null;
            hideWin(c.account, r.win, line, 1000 + plinko.ROWS * 150, () => accounts.game(c.account, 'plinko', { wager: bet, win: r.win, x: r.mult }));
            return;
        }

        // Nur fuer lokale Tests (SNAKE_TEST=1): Schlange wachsen lassen
        case 'testCashout': {
            const p = players.get(c.id);
            if (process.env.SNAKE_TEST === '1' && p && p.account) finishCashout(c.id, p);
            return;
        }

        case 'testGrow': {
            const p = players.get(c.id);
            if (process.env.SNAKE_TEST === '1' && p) grow(p, Number(data.n) || 0);
            return;
        }

        case 'eventAction':
            if (events.active()) events.handle(c, data);
            return;

        case 'offerAnswer': {
            const p = players.get(c.id);
            if (p) answerOffer(p, !!data.accept);
            return;
        }

        // --- Zweiter Automat: Budget Starlight (frueher Sweet Kek) (Tumble, Kugeln, Freispiele) ---

        case 'spin2': {
            if (!c.account) return send(c, { type: 'spin2Error', error: 'Accounts only' });
            const now = Date.now();
            if (now - (c.lastSpin2 || 0) < 800) return;
            const bet = Number(data.bet);
            if (!validBet(bet)) return send(c, { type: 'spin2Error', error: 'Invalid bet' });
            const buy = !!data.buy;
            const cost = buy ? bet * slots2.BUY_COST : bet;
            const u = accounts.get(c.account);
            if (!u || u.coins < cost) return send(c, { type: 'spin2Error', error: 'Not enough coins' });
            c.lastSpin2 = now;

            accounts.addCoins(c.account, -cost);
            const rig = accounts.takeRig(c.account, 'starlight');
            const r = rig ? luck.starlightSpin(slots2, bet, buy, rig) : slots2.spin(bet, buy);
            const balance = accounts.addCoins(c.account, r.win);
            accounts.stat(c.account, s => {
                s.spins++;
                s.biggestWin = Math.max(s.biggestWin, r.win);
            });

            send(c, {
                type: 'spin2',
                bet,
                buy,
                cost,
                win: r.win,
                capped: r.capped,
                bonus: r.bonus,
                balance,
                // Gewinne je Spin schon in Coins, fuer die Anzeige waehrend der Animation
                spins: r.spins.map(sp => ({
                    ...sp,
                    win: Math.round(sp.win * bet * 100) / 100,
                    tw: Math.round(sp.tw * bet * 100) / 100,
                    scatterWin: Math.round(sp.scatterWin * bet * 100) / 100
                }))
            });
            // Grob so lang wie die Animation im Browser, grosszuegig
            const steps = r.spins.reduce((n, sp) => n + sp.steps.length, 0);
            const ms = Math.min(15 * 60e3, 20e3 + r.spins.length * 6e3 + steps * 3e3);
            const line = r.win >= bet * 100 ? [`🌟 ${u.name} won ${r.win} coins (${Math.round(r.win / bet)}x) on Budget Starlight`, 'gold', c.id] : null;
            hideWin(c.account, r.win, line, ms, () => accounts.game(c.account, 'starlight', { wager: cost, win: r.win, x: r.win / bet }));
            return;
        }

        case 'spin2Done':
            if (c.account) revealWin(c.account);
            return;

        // --- Automat ---

        case 'spin': {
            if (!c.account) return send(c, { type: 'spinError', error: 'Accounts only' });
            const now = Date.now();
            if (now - (c.lastSpin || 0) < 1200) return;
            const bet = Number(data.bet);
            if (!validBet(bet)) return send(c, { type: 'spinError', error: 'Invalid bet' });
            const u = accounts.get(c.account);
            if (!u || u.coins < bet) return send(c, { type: 'spinError', error: 'Not enough coins' });
            c.lastSpin = now;

            accounts.addCoins(c.account, -bet);
            const rig = accounts.takeRig(c.account, 'slots');
            const r = rig ? luck.slotsSpin(slots, bet, rig.min) : slots.spin(bet);
            const balance = accounts.addCoins(c.account, r.win);
            accounts.stat(c.account, s => {
                s.spins++;
                s.biggestWin = Math.max(s.biggestWin, r.win);
            });

            send(c, { type: 'spin', reels: r.reels, win: r.win, mult: r.mult, bet, balance });
            // Feed und Bestenliste erst, wenn die Walzen im Browser stehen (~1,8 s)
            const line = r.mult >= 80 ? [`🎰 ${u.name} hit ${r.reels.join('')} → ${r.win} coins`, 'gold', c.id] : null;
            hideWin(c.account, r.win, line, 2000, () => accounts.game(c.account, 'slots', { wager: bet, win: r.win, x: r.mult }));
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
        slots: { symbols: slots.SYMBOLS, bets: slots.BETS, twoCherry: slots.TWO_CHERRY },
        shop: { cats: shop.CATS, items: shop.ITEMS, rarities: shop.RARITIES, rot: shopRot() },
        achievements: achievements.catalog(),
        arenaItems: arenaItems.catalog(),
        arenaLevel: arenaLevel.catalog(),
        slots2: { pays: slots2.PAYS, scatterPays: slots2.SCATTER_PAYS, buyCost: slots2.BUY_COST, freeSpins: slots2.FREE_SPINS, retrigger: slots2.RETRIGGER, maxWin: slots2.MAX_WIN, rtp: slots2.RTP },
        wheel: casino.WHEEL,
        cross: casino.crossTable(),
        plinko: plinko.info(),
        lobby: tables.lobby()
    });
    send(c, { type: 'highscores', top: topNow() });
    send(c, { type: 'shRooms', rooms: shooter.rooms() });
    send(c, { type: 'chatlog', list: chatLog });

    ws.on('message', msg => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }
        if (!data || typeof data.type !== 'string') return;
        if (data.type !== 'ui' && data.type !== 'where' && data.type !== 'shPing') c.lastActive = Date.now();
        handle(c, data).catch(err => console.error('handle', data.type, err));
    });

    ws.on('close', () => {
        // Zuschauen (6.3): aufraeumen bzw. Zuschauern Bescheid geben
        if (c.watching && c.watching.watchers) c.watching.watchers.delete(c);
        if (c.watchers) for (const w of c.watchers) {
            send(w, { type: 'watchEnd', reason: 'Player went offline or closed the tab' });
            w.watching = { watchers: new Set() };
        }
        trade.gone(c);
        duels.gone(c);
        lobby.leave(c);
        tables.leave(c);
        shooter.leave(c);
        rooms.leave(c);
        crossClose(c);
        if (c.account) revealWin(c.account);
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
        // Die Zone toetet nie: eine Kante rueckt nur nach innen, wenn auf der
        // aeussersten Reihe gerade kein Schlangenstueck liegt. Sonst wartet sie.
        const sides = shrinkSide++ % 2 === 0 ? ['hi', 'lo'] : ['lo', 'hi'];
        const occupied = side => {
            const line = side === 'hi' ? arena.hi - 1 : arena.lo;
            for (const p of players.values()) {
                if (p.body.some(s => s.x === line || s.y === line)) return true;
            }
            return false;
        };
        const side = sides.find(sd => !occupied(sd));
        if (!side) return;
        if (side === 'hi') arena.hi--; else arena.lo++;
        lastArenaStep = now;

        // Items, die jetzt draussen liegen, verschwinden
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            const size = it.type === 'event' ? 3 : 1;
            if (it.x < arena.lo || it.y < arena.lo || it.x + size > arena.hi || it.y + size > arena.hi) items.splice(i, 1);
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
    onEnd(done) {
        // 3 s Countdown, dann geht es weiter
        const now = Date.now();
        if (paused) paused.resumeAt = now + 3000;
        broadcast({ type: 'resume', in: 3000 });

        // Wer etwas gewonnen hat, bekommt ein persoenliches Double or Nothing.
        // Bis er sich entscheidet, bleibt er eingefroren und ist ein Geist.
        for (const m of done.members.values()) {
            const r = (done.rewards || {})[m.id];
            const p = players.get(m.id);
            if (!p || !r || (r.coins <= 0 && r.length <= 0)) continue;
            const f = { kind: 'offer', pid: p.id, coins: r.coins, length: r.length, started: now + 3000, ends: Infinity };
            freeze(p, f);
            send(p, { type: 'offer', coins: r.coins, length: r.length, ms: OFFER_MS });
            setTimeout(() => {
                // Keine Antwort: behalten
                if (p.frozen === f && !f.answered) endOffer(p, f);
            }, OFFER_MS + 3000);
        }
    }
});

const OFFER_MS = 10000;   // 6.5.1: 15 -> 10 s

// ---------- Casino ----------

const tables = createTables({
    accounts,
    send,
    feed,
    onChange: () => broadcast({ type: 'lobby', lobby: tables.lobby() })
});

// ---------- Shooter-Arena (#7) ----------

const shooter = createShooter({
    accounts, send, feed, wheels,
    refresh: c => sendAccount(c),
    // Wer ist in welcher Arena: fuers Menue an alle
    changed: () => broadcast({ type: 'shRooms', rooms: shooter.rooms() })
});
// PvP-Lobbys: jedes Match eine eigene Arena-Instanz auf einer kleinen Map
const rooms = createRooms({
    accounts, send, broadcast, feed, refresh: c => sendAccount(c), worlds: createShooter.PVP_WORLDS, zombieWorld: createShooter.ZOMBIE_WORLD,
    createArena: o => createShooter({ accounts, send, feed, refresh: c => sendAccount(c), changed: () => {} }, o),
    busy: c => shooter.has(c) || !!c.joined || !!c.cross
});

// Handel: nur Hub-Aktion, kein eigener Takt
// Markt (5.2): handelbare Gueter, direkter Handel, Auktionshaus, Lobby
const assets = createAssets({ accounts, cards, cardDb, shop, I: arenaItems });

// Nach einem Tausch/Kauf: alles frisch, was der Browser gerade zeigt
function mkRefresh(c) {
    sendAccount(c);
    if (c.mkWatch) send(c, market.state(c));
    if (c.account) kmState(c);
    lobby.refresh(c);
    if (!shooter.has(c)) shooter.hubAction(c, { type: 'arHub' });
}

const trade = createTrade({
    accounts, assets, send, clientsOf, refresh: mkRefresh,
    log: line => console.log('trade:', line)
});

// Aenderungen im Auktionshaus an alle schicken, die es offen haben (gebremst)
let mkPushT = null;
const market = createMarket({
    dataDir: DATA_DIR, accounts, assets, send, clientsOf, feed, refresh: mkRefresh, cardV: cardHash,
    log: line => console.log(line),
    onChange: () => {
        if (mkPushT) return;
        mkPushT = setTimeout(() => {
            mkPushT = null;
            for (const c of clients.values()) if (c.mkWatch && c.account) send(c, market.state(c));
        }, 400);
    }
});

const lobby = createLobby({ accounts, send, titleOf: key => accounts.titleOf(key) });

// Kekemon-Kaempfe gegen KI-Arenen (5.6)
const gyms = createGyms({
    accounts, cards, cardDb, battle: kmBattle, send, feed, refresh: mkRefresh,
    log: line => console.log(line)
});

const duels = createDuels({
    accounts, cards, cardDb, battle: kmBattle, send, clientsOf, feed, refresh: mkRefresh,
    onlineKeys: () => [...clients.values()].filter(c => c.account).map(c => c.account),
    log: line => console.log(line)
});
setInterval(() => duels.tick(), 1000);

// Eigener, schnellerer Takt als das Snake-Feld (33 ms)
setInterval(() => {
    shooter.tick();
    rooms.tick();
}, 16);

// ---------- Support-Tickets ----------

function sendTickets(c, open) {
    if (!c.account) return;
    send(c, { type: 'tickets', list: tickets.listFor(c.account), unread: tickets.unreadFor(c.account), open: open || null });
}

// ---------- Admin-Interface (admin-snake.flashkeks.com) ----------

function clientsOf(key) {
    return [...clients.values()].filter(c => c.account === key);
}

startAdmin({
    // Zuschauen (6.3)
    watchUrl: key => {
        if (!clientsOf(key).some(x => !x.watching)) return null;
        const base = CANONICAL ? `https://${CANONICAL}` : `http://127.0.0.1:${PORT}`;
        return `${base}/?watch=${createWatch(key)}`;
    },
    activity: key => activityOf(key),
    // Kekemon (6.4)
    cards, cardDb, gyms: gyms.GYMS,
    pushKm: key => clientsOf(key).forEach(c => { kmState(c); gyms.handle(c, { type: 'kbGyms' }); }),
    accounts,
    shop,
    arenaItems,
    luck,
    tickets,
    dataDir: DATA_DIR,
    publicDir: PUBLIC,
    online: () => ({
        connections: clients.size,
        playing: players.size,
        loggedIn: new Set([...clients.values()].filter(c => c.account).map(c => c.account)).size,
        tables: tables.lobby(),
        shooter: shooter.names().length
    }),
    pushAccount: key => clientsOf(key).forEach(c => sendAccount(c)),
    pushTicket: key => clientsOf(key).forEach(c => sendTickets(c)),
    // Konto abmelden (Logout ueberall, Loeschen): raus aus Feld, Tisch und Crossy
    // Reset (Admin v2): raus aus Feld, Tisch, Raid und Crossy, aber angemeldet bleiben
    stopPlay: key => clientsOf(key).forEach(c => {
        const p = players.get(c.id);
        if (p) {
            recordScore(p);
            events.leave(c.id);
            removeFromField(c.id);
            send(c, { type: 'left' });
        }
        tables.leave(c);
        shooter.leave(c);
        rooms.leave(c);
        crossClose(c);
    }),
    kickAccount: key => clientsOf(key).forEach(c => {
        const p = players.get(c.id);
        if (p) {
            recordScore(p);
            events.leave(c.id);
            removeFromField(c.id);
            send(c, { type: 'left' });
        }
        tables.leave(c);
        shooter.leave(c);
        rooms.leave(c);
        crossClose(c);
        c.account = null;
        send(c, { type: 'authExpired' });
    })
});

function crossCash(c, auto) {
    const g = c.cross;
    c.cross = null;
    const mult = casino.crossMult(g.diff, g.step);
    const win = Math.floor(g.bet * mult);
    const balance = accounts.addCoins(c.account, win);
    accounts.stat(c.account, s => { s.biggestWin = Math.max(s.biggestWin, win); });
    accounts.game(c.account, 'crossy', { wager: g.bet, win, x: mult });
    send(c, { type: 'cross', state: 'cashed', auto, step: g.step, bet: g.bet, diff: g.diff, mult, win, balance });
    if (mult >= 20 && win >= 1000) {
        const u = accounts.get(c.account);
        feed(`🐔 ${u.name} crossed ${g.step} lanes on ${casino.DIFFS[g.diff].label}: ${win} coins (${mult}x)`, 'gold', c.id);
    }
}

// Verbindung weg mitten im Lauf: was schon geschafft ist, wird ausgezahlt,
// ohne einen Schritt gibt es den Einsatz zurueck
function crossClose(c) {
    const g = c.cross;
    if (!g) return;
    if (g.step > 0) return crossCash(c, true);
    c.cross = null;
    accounts.addCoins(c.account, g.bet);
}

// Entscheidung gefallen: noch 3 s eingefroren mit Countdown, dann geht es los
// (bis 23.09.2026 fuhr man sofort weiter, waehrend der Countdown noch lief).
// Laeuft die globale Event-Pause noch, zaehlt der Countdown ab deren Ende.
const OFFER_COUNTDOWN = 3000;

function endOffer(p, f) {
    if (p.frozen !== f || f.releasing) return;
    const now = Date.now();
    f.releasing = true;
    f.ends = Math.max(now, (paused && paused.resumeAt) || 0) + OFFER_COUNTDOWN;
    freezes.push(f);
    send(p, { type: 'offerDone', countdown: f.ends - now });
}

function answerOffer(p, accept) {
    const f = p.frozen;
    if (!f || f.kind !== 'offer' || f.answered) return;
    f.answered = true;
    if (!accept) return endOffer(p, f);

    const win = Math.random() < 0.5;
    send(p, { type: 'offerResult', win, coins: f.coins, length: f.length });

    // Erst nach der Muenz-Animation wirken lassen
    setTimeout(() => {
        if (players.get(p.id) !== p) return;
        const sign = win ? 1 : -1;
        if (f.coins > 0 && p.account) {
            accounts.addCoins(p.account, sign * f.coins);
            accounts.earn(p.account, 'don', sign * f.coins);
            accounts.game(p.account, 'don', { wager: f.coins, win: win ? 2 * f.coins : 0, x: win ? 2 : 0 });
            sendAccount(p);
        }
        if (f.length > 0) {
            if (win) grow(p, f.length);
            else setLen(p, p.len - f.length);
        }
        const what = [f.coins > 0 ? `${f.coins} coins` : null, f.length > 0 ? `${f.length} length` : null].filter(Boolean).join(' + ');
        feed(win ? `🪙 ${p.name} doubled ${what}!` : `🪙 ${p.name} lost ${what} on double or nothing`, win ? 'good' : 'bad', p.id);
        endOffer(p, f);
    }, 2800);
}

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
        // Das Angebot rechnet seinen Countdown schon ab Pausenende
        if (f.kind === 'offer') continue;
        f.started += dur;
        f.ends += dur;
    }
    paused = null;
    nextEventAt = now + rand(90000, 180000);
    // Nach dem Event kurz unverwundbar, damit niemand beim Weiterfahren sofort stirbt
    for (const p of players.values()) {
        if (!p.frozen) p.fx.ghost = Math.max(p.fx.ghost || 0, now + DURATION.afterEvent);
    }
}

// ---------- Spiel-Tick ----------

function gameTick() {
    const now = Date.now();

    events.tick();
    tables.tick();

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

        player.body = player.body.slice(0, Math.min(player.len, MAX_BODY));
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

    for (const id of wall) kill(id, null, 'hit the wall', 'wall');
    for (const [id, killerId] of dead) kill(id, killerId, killerId ? null : 'ran into themselves', killerId ? 'body' : 'self');

    // Genau ein Stern im Kopf-an-Kopf gewinnt ohne Walze. Sonst Duell.
    const inDuel = new Set();
    for (const group of headGroups) {
        const ids = group.filter(id => players.has(id));
        if (ids.length < 2) continue;
        const stars = ids.filter(id => star.has(id));
        if (stars.length === 1) {
            for (const id of ids) if (id !== stars[0]) kill(id, stars[0], null, 'star');
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
                else if (f.value >= 10) feedTo([id], `${p.name} ${f.icon} +${f.value}`, 'gold', id);
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

    // Nur an Browser in der Snake-Welt (5.4): wer in Arena, Kekemon oder Markt
    // ist, sieht das Feld nicht – vorher gingen 16 Zustaende/s trotzdem raus
    // (95 % des Traffics, in der Arena doppelt zu den Raid-Snapshots)
    const msg = JSON.stringify({
        type: 'state',
        arena,
        paused: !!paused,
        items,
        players: [...players.entries()].map(([id, p]) => ({
            id,
            x: p.x,
            y: p.y,
            runs: encodeBody(p.body),
            len: p.len,
            kills: p.kills,
            score: scoreOf(p),
            color: p.color,
            sk: p.cos || undefined,
            tt: p.title || undefined,
            name: p.name,
            guest: p.guest,
            frozen: !!p.frozen || !!paused,
            gambling: !!(p.frozen && (p.frozen.kind === 'gamble' || p.frozen.kind === 'offer')),
            deciding: !!(p.frozen && p.frozen.kind === 'offer' && !p.frozen.releasing),
            cashout: p.cashout ? Math.min(1, (now - p.cashout) / CASHOUT_MS) : 0,
            fx: fxLeft(p)
        }))
    });
    let n = 0;
    for (const c of clients.values()) {
        if (!c.joined && SNAKE_OFF.has(c.where)) continue;
        if (c.ws.readyState === WebSocket.OPEN) { c.ws.send(msg); n++; }
    }
    count('state', msg.length, n);
}

// Schirme, auf denen das Snake-Feld nicht zu sehen ist
const SNAKE_OFF = new Set(['arenahub', 'shooter', 'kekemon', 'market']);

setInterval(gameTick, TICK);

function shutdown() {
    // Noch versteckte Gewinne jetzt verbuchen (Statistik/Leaderboard haengen an
    // onReveal), laufende Snake-Runden als Runde zaehlen – sonst fehlen sie
    // nach einem Deploy
    for (const k of [...pendingWins.keys()]) revealWin(k);
    for (const p of players.values()) recordScore(p);
    tables.shutdown();
    shooter.refundAll();
    accounts.save(true);
    tickets.save(true);
    market.save();
    process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Snake running on http://127.0.0.1:${PORT}, Daten in ${DATA_DIR}`);
});
