// Shooter (#7): Top-down-Arena, eigener Bereich im Hauptmenue.
//
// Der Server ist die einzige Wahrheit: Er bewegt die Spieler nach ihren
// Eingaben (Richtung, Zielwinkel, Feuer), fliegt die Kugeln, prueft Treffer
// und zahlt Kills. Der Browser schickt nur Eingaben und zeichnet die
// Zustaende (20 je Sekunde) mit Interpolation.
//
// - Kill = 50 Coins fuer Konten, aber nur fuer Kills an anderen Konten von
//   einer anderen IP. Gegen Farming zaehlt derselbe Gegner hoechstens 3x je
//   10 Minuten.
// - 100 HP, Pistole 20 Schaden, 4 Schuss/s. Pickups: 🩹 +50 HP, ⚡ 8 s
//   Schnellfeuer, 🔫 8 s Schrotflinte (5 Kugeln im Faecher).
// - Tod: 3 s warten, dann neu an einem freien Platz, 2 s unverwundbar.
// - Gaeste spielen mit, bekommen aber keine Coins.

const SPEED = Number(process.env.SNAKE_EVENT_SPEED) || 1;

const W = 1600, H = 1000;
const R = 18;                 // Spieler-Radius
const MOVE = 260;             // Einheiten je Sekunde
const BULLET = { speed: 900, life: 0.9, dmg: 20, r: 4 };
const FIRE_MS = 250;
const RAPID_MS = 110;
const RESPAWN_MS = 3000;
const PROTECT_MS = 2000;
const KILL_COINS = 50;
const FARM_LIMIT = 3;
const FARM_WINDOW = 10 * 60e3;
const MAX_PLAYERS = 16;
const TICK_MS = 33;
const SEND_MS = 50;

// Waende als Rechtecke [x, y, w, h]; Rand ist implizit
const WALLS = [
    [300, 180, 220, 40], [1080, 180, 220, 40], [300, 780, 220, 40], [1080, 780, 220, 40],
    [760, 300, 80, 400],
    [150, 440, 40, 120], [1410, 440, 40, 120],
    [540, 460, 120, 80], [940, 460, 120, 80],
    [620, 120, 40, 120], [940, 760, 40, 120]
];

const PICKUPS = [
    { kind: 'heal', icon: '🩹' },
    { kind: 'rapid', icon: '⚡' },
    { kind: 'shotgun', icon: '🔫' }
];

const COLORS = ['#ff5bd6', '#3da5ff', '#ffd23f', '#00d67a', '#a970ff', '#ff8a3d', '#22d3ee', '#f43f5e'];

function circleRect(x, y, r, [rx, ry, rw, rh]) {
    const cx = Math.max(rx, Math.min(x, rx + rw));
    const cy = Math.max(ry, Math.min(y, ry + rh));
    return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

function blocked(x, y, r) {
    if (x < r || y < r || x > W - r || y > H - r) return true;
    return WALLS.some(w => circleRect(x, y, r, w));
}

module.exports = function createShooter(h) {
    // h: { accounts, send, feed, refresh(c) }
    const players = new Map();   // client id -> Spieler
    const bullets = [];
    const pickups = [];
    const farm = new Map();      // "killer>opfer" -> [Zeitpunkte]
    let lastTick = Date.now();
    let lastSend = 0;
    let nextPickup = Date.now() + 5000;
    let bulletSeq = 0;
    const feedLog = [];

    function freeSpot() {
        for (let k = 0; k < 200; k++) {
            const x = 60 + Math.random() * (W - 120);
            const y = 60 + Math.random() * (H - 120);
            if (blocked(x, y, R + 10)) continue;
            // nicht direkt neben anderen
            if ([...players.values()].some(p => !p.dead && Math.hypot(p.x - x, p.y - y) < 200)) continue;
            return { x, y };
        }
        return { x: W / 2, y: 80 };
    }

    function spawn(p) {
        const s = freeSpot();
        Object.assign(p, { x: s.x, y: s.y, hp: 100, dead: false, respawnAt: 0, protect: Date.now() + PROTECT_MS / SPEED, rapid: 0, shotgun: 0 });
    }

    // ---------- Beitreten / gehen ----------

    function join(c, name, color) {
        // Schon drin (z. B. zweiter Klick): Map einfach nochmal schicken
        if (players.has(c.id)) {
            h.send(c, { type: 'shJoined', id: c.id, map: { w: W, h: H, walls: WALLS, r: R }, feed: feedLog.slice(-6) });
            return null;
        }
        if (players.size >= MAX_PLAYERS) return 'Arena is full';
        const p = {
            id: c.id, c, name, account: c.account,
            color: color || COLORS[players.size % COLORS.length],
            x: 0, y: 0, a: 0, mx: 0, my: 0, fire: false, lastShot: 0,
            hp: 100, dead: false, kills: 0, deaths: 0, coins: 0, streak: 0
        };
        spawn(p);
        players.set(c.id, p);
        h.send(c, { type: 'shJoined', id: c.id, map: { w: W, h: H, walls: WALLS, r: R }, feed: feedLog.slice(-6) });
        push(true);
        return null;
    }

    function leave(c) {
        const p = players.get(c.id);
        if (!p) return false;
        players.delete(c.id);
        h.send(c, { type: 'shLeft', kills: p.kills, deaths: p.deaths, coins: p.coins });
        push(true);
        return true;
    }

    // Eingaben: mx/my Bewegung (-1..1), a Zielwinkel, f Feuer
    function input(c, d) {
        const p = players.get(c.id);
        if (!p) return;
        const mx = Number(d.mx), my = Number(d.my), a = Number(d.a);
        if (Number.isFinite(mx) && Number.isFinite(my)) {
            const len = Math.hypot(mx, my);
            p.mx = len > 1 ? mx / len : mx;
            p.my = len > 1 ? my / len : my;
        }
        if (Number.isFinite(a)) p.a = a;
        p.fire = !!d.f;
    }

    // ---------- Takt ----------

    function shoot(p, now) {
        const every = (now < p.rapid ? RAPID_MS : FIRE_MS) / SPEED;
        if (now - p.lastShot < every) return;
        p.lastShot = now;
        const angles = now < p.shotgun ? [-0.24, -0.12, 0, 0.12, 0.24] : [0];
        for (const off of angles) {
            const a = p.a + off;
            bullets.push({
                id: ++bulletSeq, owner: p.id,
                x: p.x + Math.cos(a) * (R + 6), y: p.y + Math.sin(a) * (R + 6),
                vx: Math.cos(a) * BULLET.speed, vy: Math.sin(a) * BULLET.speed,
                dies: now + BULLET.life * 1000 / SPEED,
                dmg: angles.length > 1 ? 14 : BULLET.dmg
            });
        }
    }

    function hit(victim, shooter, dmg, now) {
        if (victim.dead || now < victim.protect) return;
        victim.hp -= dmg;
        if (victim.hp > 0) return;
        victim.hp = 0;
        victim.dead = true;
        victim.deaths++;
        victim.streak = 0;
        victim.respawnAt = now + RESPAWN_MS / SPEED;
        if (!shooter) return;
        shooter.kills++;
        shooter.streak++;
        let paid = 0;
        // Coins nur fuer Kills an anderen Konten von anderer IP (Gaeste lassen
        // sich beliebig oft aufmachen, Zweitkonten im selben Netz auch)
        if (shooter.account && victim.account && victim.account !== shooter.account && victim.c.ip !== shooter.c.ip) {
            // Anti-Farming: gleicher Gegner hoechstens FARM_LIMIT mal je Fenster
            const key = shooter.account + '>' + victim.account;
            const recent = (farm.get(key) || []).filter(t => now - t < FARM_WINDOW);
            if (recent.length < FARM_LIMIT) {
                recent.push(now);
                paid = KILL_COINS;
                h.accounts.addCoins(shooter.account, paid);
                h.accounts.earn(shooter.account, 'shooter', paid);
                shooter.coins += paid;
                h.refresh(shooter.c);
            }
            farm.set(key, recent);
        }
        if (shooter.account) h.accounts.stat(shooter.account, s => { s.shooterKills = (s.shooterKills || 0) + 1; });
        if (victim.account) h.accounts.stat(victim.account, s => { s.shooterDeaths = (s.shooterDeaths || 0) + 1; });
        const line = { killer: shooter.name, victim: victim.name, coins: paid, streak: shooter.streak };
        feedLog.push(line);
        if (feedLog.length > 20) feedLog.shift();
        for (const q of players.values()) h.send(q.c, { type: 'shKill', ...line });
        if (shooter.streak === 5) h.feed(`🔫 ${shooter.name} is on a 5 kill streak in the Arena!`, 'gold');
    }

    function tick() {
        const now = Date.now();
        const dt = Math.min(0.1, (now - lastTick) / 1000) * SPEED;
        if (now - lastTick < TICK_MS / SPEED) return;
        lastTick = now;
        if (!players.size) {
            bullets.length = 0;
            return;
        }

        for (const p of players.values()) {
            if (p.dead) {
                if (now >= p.respawnAt) spawn(p);
                continue;
            }
            // Bewegen, an Waenden entlang gleiten (Achsen einzeln)
            const nx = p.x + p.mx * MOVE * dt;
            if (!blocked(nx, p.y, R)) p.x = nx;
            const ny = p.y + p.my * MOVE * dt;
            if (!blocked(p.x, ny, R)) p.y = ny;
            if (p.fire) shoot(p, now);
            // Pickups einsammeln
            for (let i = pickups.length - 1; i >= 0; i--) {
                const k = pickups[i];
                if (Math.hypot(k.x - p.x, k.y - p.y) > R + 16) continue;
                if (k.kind === 'heal') p.hp = Math.min(100, p.hp + 50);
                if (k.kind === 'rapid') p.rapid = now + 8000 / SPEED;
                if (k.kind === 'shotgun') p.shotgun = now + 8000 / SPEED;
                pickups.splice(i, 1);
            }
        }

        // Kugeln: in kleinen Schritten, damit nichts durch Waende tunnelt
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            let gone = now >= b.dies;
            const steps = 3;
            for (let s = 0; s < steps && !gone; s++) {
                b.x += b.vx * dt / steps;
                b.y += b.vy * dt / steps;
                if (blocked(b.x, b.y, BULLET.r)) {
                    gone = true;
                    break;
                }
                for (const p of players.values()) {
                    if (p.id === b.owner || p.dead) continue;
                    if (Math.hypot(p.x - b.x, p.y - b.y) < R + BULLET.r) {
                        hit(p, players.get(b.owner), b.dmg, now);
                        gone = true;
                        break;
                    }
                }
            }
            if (gone) bullets.splice(i, 1);
        }

        if (now >= nextPickup && pickups.length < 4) {
            const s = freeSpot();
            const kind = PICKUPS[Math.floor(Math.random() * PICKUPS.length)];
            pickups.push({ x: s.x, y: s.y, kind: kind.kind, icon: kind.icon });
            nextPickup = now + (6000 + Math.random() * 6000) / SPEED;
        }

        if (now - lastSend >= SEND_MS / SPEED) push(false);
    }

    function push() {
        lastSend = Date.now();
        const now = lastSend;
        const msg = {
            type: 'sh',
            t: now,
            players: [...players.values()].map(p => ({
                id: p.id, n: p.name, c: p.color,
                x: Math.round(p.x), y: Math.round(p.y), a: Math.round(p.a * 100) / 100,
                hp: p.hp, dead: p.dead, k: p.kills, d: p.deaths,
                pr: now < p.protect, rf: now < p.rapid, sg: now < p.shotgun,
                rs: p.dead ? Math.max(0, p.respawnAt - now) : 0
            })),
            bullets: bullets.flatMap(b => [Math.round(b.x), Math.round(b.y)]),
            pickups: pickups.map(k => [Math.round(k.x), Math.round(k.y), k.icon])
        };
        for (const p of players.values()) h.send(p.c, msg);
    }

    return {
        join, leave, input, tick,
        has: c => players.has(c.id),
        names: () => [...players.values()].map(p => p.name),
        // Nur fuer Tests
        _players: players,
        _hit: hit
    };
};

module.exports.KILL_COINS = KILL_COINS;
