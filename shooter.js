// Shooter (#7, Einsaetze #12): Top-down-Arenen, eigener Bereich im Hauptmenue.
//
// Der Server ist die einzige Wahrheit: Er bewegt die Spieler nach ihren
// Eingaben (Richtung, Zielwinkel, Feuer), fliegt die Kugeln, prueft Treffer
// und zahlt aus. Der Browser rechnet die eigene Bewegung voraus (gleiche
// Waende, gleiches Tempo) und gleicht sie nur sanft an; alle anderen zeichnet
// er leicht verzoegert und interpoliert, Kugeln mit ihrer Geschwindigkeit.
//
// Drei Arenen (ROOMS):
//   free   Eintritt frei. Kill = 50 Coins, nur an anderen Konten von anderer
//          IP, derselbe Gegner hoechstens 3x je 10 Minuten (Anti-Farming).
//   s100 / s1000   Einsatz je Leben (#12). Beim Spawn zieht der Server den
//          Einsatz vom Konto und haelt ihn als Kopfgeld (Escrow). Wer einen
//          killt, bekommt dessen ganzes Kopfgeld, kein Hausanteil. Wer lebend
//          geht oder die Verbindung verliert, bekommt sein Kopfgeld zurueck.
//          Cases (Preis = 1/4 Einsatz) geben Ausruestung fuer dieses Leben.
//
// Ausruestung: Pistole ist Standard. Aus Cases bzw. Pickups: SMG, Gewehr,
// Schrotflinte, Sniper, Golden Deagle, Ruestung (+50 HP). Stirbt man, ist sie weg.

const SPEED = Number(process.env.SNAKE_EVENT_SPEED) || 1;

const W = 1600, H = 1000;
const R = 18;                 // Spieler-Radius
const MOVE = 280;             // Einheiten je Sekunde (Browser rechnet gleich)
const RESPAWN_MS = 3000;
const PROTECT_MS = 2000;
const FREE_KILL_COINS = 50;
const FARM_LIMIT = 3;
const FARM_WINDOW = 10 * 60e3;
const MAX_PLAYERS = 16;
const TICK_MS = 33;
const SEND_MS = 33;

const ROOMS = {
    free: { label: 'Free', fee: 0 },
    s100: { label: '100 per life', fee: 100 },
    s1000: { label: '1,000 per life', fee: 1000 }
};

// Waffen: ms = Schussabstand, dmg je Kugel, speed, life (s), spread (rad), pellets
const WEAPONS = {
    pistol: { name: 'Pistol', icon: '🔫', ms: 260, dmg: 20, speed: 950, life: 0.9, spread: 0.02, pellets: 1 },
    smg: { name: 'SMG', icon: '🔫', ms: 90, dmg: 10, speed: 1000, life: 0.7, spread: 0.08, pellets: 1 },
    rifle: { name: 'Rifle', icon: '🪖', ms: 150, dmg: 22, speed: 1250, life: 1.0, spread: 0.02, pellets: 1 },
    shotgun: { name: 'Shotgun', icon: '💥', ms: 650, dmg: 15, speed: 900, life: 0.45, spread: 0.3, pellets: 6 },
    sniper: { name: 'Sniper', icon: '🎯', ms: 1100, dmg: 95, speed: 2200, life: 1.2, spread: 0, pellets: 1 },
    deagle: { name: 'Golden Deagle', icon: '✨', ms: 380, dmg: 55, speed: 1500, life: 1.0, spread: 0.01, pellets: 1 }
};

// Case-Inhalt mit Gewichten; armor = +50 HP fuer dieses Leben
const CASE_ITEMS = [
    { id: 'smg', weight: 28, rarity: 'common' },
    { id: 'rifle', weight: 24, rarity: 'common' },
    { id: 'armor', weight: 18, rarity: 'rare' },
    { id: 'shotgun', weight: 16, rarity: 'rare' },
    { id: 'sniper', weight: 10, rarity: 'epic' },
    { id: 'deagle', weight: 4, rarity: 'legendary' }
];
const CASE_SHARE = 0.25;

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
    { kind: 'smg', icon: '🔫' },
    { kind: 'shotgun', icon: '💥' },
    { kind: 'armor', icon: '🛡️' }
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

function rollCase() {
    const total = CASE_ITEMS.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const it of CASE_ITEMS) {
        r -= it.weight;
        if (r < 0) return it;
    }
    return CASE_ITEMS[0];
}

function createRoom(id, h) {
    const fee = ROOMS[id].fee;
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
            if ([...players.values()].some(p => !p.dead && Math.hypot(p.x - x, p.y - y) < 220)) continue;
            return { x, y };
        }
        return { x: W / 2, y: 80 };
    }

    // Ein Leben zu Ende: in der Statistik verbuchen (Einsatz, Kopfgelder)
    function endLife(p) {
        if (!fee || !p.account || !p.lifePaid) return;
        h.accounts.game(p.account, 'arena', { wager: p.lifePaid, win: p.lifeWon, x: p.lifeWon ? p.lifeWon / p.lifePaid : 0 });
        p.lifePaid = 0;
        p.lifeWon = 0;
    }

    // Spawnen; in Einsatz-Arenen erst zahlen. false = kein Geld
    function spawn(p) {
        if (fee) {
            const u = h.accounts.get(p.account);
            if (!u || u.coins < fee) {
                p.broke = true;
                return false;
            }
            h.accounts.addCoins(p.account, -fee);
            h.accounts.earn(p.account, 'shooter', -fee);
            p.bounty = fee;
            p.lifePaid = fee;
            p.lifeWon = 0;
            h.refresh(p.c);
        }
        const s = freeSpot();
        const now = Date.now();
        Object.assign(p, {
            x: s.x, y: s.y, hp: 100, maxHp: 100, dead: false, broke: false, respawnAt: 0,
            protect: now + PROTECT_MS / SPEED, weapon: 'pistol', spawnSeq: (p.spawnSeq || 0) + 1
        });
        // Ausruestung aus einem Case, das gekauft wurde, waehrend man tot war
        if (p.pending) {
            equip(p, p.pending);
            p.pending = null;
        }
        return true;
    }

    function equip(p, item) {
        if (item === 'armor') {
            p.maxHp = 150;
            p.hp = Math.min(150, p.hp + 50);
        } else if (WEAPONS[item]) {
            p.weapon = item;
        }
    }

    // ---------- Beitreten / gehen ----------

    function join(c, name, color) {
        if (players.has(c.id)) {
            sendJoined(c);
            return null;
        }
        if (players.size >= MAX_PLAYERS) return 'Arena is full';
        if (fee) {
            if (!c.account) return 'Log in to play for coins';
            const u = h.accounts.get(c.account);
            if (!u || u.coins < fee) return `You need ${fee} coins for a life here`;
        }
        const p = {
            id: c.id, c, name, account: c.account,
            color: color || COLORS[players.size % COLORS.length],
            x: 0, y: 0, a: 0, mx: 0, my: 0, fire: false, lastShot: 0, seq: 0,
            hp: 100, maxHp: 100, dead: false, kills: 0, deaths: 0, coins: 0, streak: 0,
            bounty: 0, lifePaid: 0, lifeWon: 0, pending: null, weapon: 'pistol'
        };
        players.set(c.id, p);
        spawn(p);
        sendJoined(c);
        push();
        h.changed();
        return null;
    }

    function sendJoined(c) {
        h.send(c, {
            type: 'shJoined', id: c.id, room: id, fee,
            casePrice: Math.round(fee * CASE_SHARE),
            map: { w: W, h: H, walls: WALLS, r: R, move: MOVE },
            weapons: WEAPONS, caseItems: CASE_ITEMS.map(x => ({ id: x.id, rarity: x.rarity, weight: x.weight })),
            feed: feedLog.slice(-6)
        });
    }

    // Gehen: lebend = Kopfgeld zurueck (Leben nicht verloren)
    function leave(c) {
        const p = players.get(c.id);
        if (!p) return false;
        let refund = 0;
        if (fee && !p.dead && p.bounty) {
            refund = p.bounty;
            h.accounts.addCoins(p.account, refund);
            h.accounts.earn(p.account, 'shooter', refund);
            p.lifeWon += refund;
            p.bounty = 0;
        }
        endLife(p);
        players.delete(c.id);
        h.send(c, { type: 'shLeft', kills: p.kills, deaths: p.deaths, coins: p.coins, refund });
        if (refund) h.refresh(c);
        push();
        h.changed();
        return true;
    }

    // Eingaben: mx/my Bewegung (-1..1), a Zielwinkel, f Feuer, s Folgenummer
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
        if (Number.isInteger(d.s)) p.seq = d.s;
    }

    // Case kaufen (nur Einsatz-Arenen): wirkt sofort, tot = beim naechsten Leben
    function buyCase(c) {
        const p = players.get(c.id);
        if (!p) return;
        if (!fee) return h.send(c, { type: 'shError', error: 'Cases only in the stake arenas' });
        const price = Math.round(fee * CASE_SHARE);
        const u = h.accounts.get(p.account);
        if (!u || u.coins < price) return h.send(c, { type: 'shError', error: `A case costs ${price} coins` });
        h.accounts.addCoins(p.account, -price);
        h.accounts.earn(p.account, 'shooter', -price);
        h.accounts.stat(p.account, s => { s.casesOpened = (s.casesOpened || 0) + 1; });
        const item = rollCase();
        if (p.dead || p.broke) p.pending = item.id;
        else equip(p, item.id);
        h.refresh(c);
        h.send(c, { type: 'shCase', item: item.id, rarity: item.rarity, price, later: !!p.pending });
        if (item.rarity === 'legendary') h.feed(`✨ ${p.name} unboxed a Golden Deagle in the Arena!`, 'gold');
    }

    // Weiterspielen, nachdem das Geld fuer ein Leben fehlte
    function retry(c) {
        const p = players.get(c.id);
        if (!p || !p.broke) return;
        if (!spawn(p)) h.send(c, { type: 'shError', error: `You need ${fee} coins for a life` });
    }

    // ---------- Takt ----------

    function shoot(p, now) {
        const w = WEAPONS[p.weapon] || WEAPONS.pistol;
        if (now - p.lastShot < w.ms / SPEED) return;
        p.lastShot = now;
        for (let k = 0; k < w.pellets; k++) {
            const off = w.pellets > 1 ? (k / (w.pellets - 1) - 0.5) * w.spread : (Math.random() - 0.5) * w.spread;
            const a = p.a + off;
            bullets.push({
                id: ++bulletSeq, owner: p.id,
                x: p.x + Math.cos(a) * (R + 6), y: p.y + Math.sin(a) * (R + 6),
                vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
                dies: now + w.life * 1000 / SPEED,
                dmg: w.dmg
            });
        }
    }

    function hit(victim, shooter, dmg, now, bx, by) {
        if (victim.dead || now < victim.protect) return;
        victim.hp -= dmg;
        const killed = victim.hp <= 0;
        if (shooter) h.send(shooter.c, { type: 'shHit', x: Math.round(bx), y: Math.round(by), dmg, kill: killed });
        h.send(victim.c, { type: 'shHurt', dmg, from: shooter ? shooter.name : null });
        if (!killed) return;
        victim.hp = 0;
        victim.dead = true;
        victim.deaths++;
        victim.streak = 0;
        victim.respawnAt = now + RESPAWN_MS / SPEED;
        const bounty = victim.bounty;
        victim.bounty = 0;
        endLife(victim);
        if (victim.account) h.accounts.stat(victim.account, s => { s.shooterDeaths = (s.shooterDeaths || 0) + 1; });
        if (!shooter) return;
        shooter.kills++;
        shooter.streak++;
        let paid = 0;
        if (fee) {
            // Einsatz-Arena: das ganze Kopfgeld des Opfers
            if (bounty && shooter.account) {
                paid = bounty;
                h.accounts.addCoins(shooter.account, paid);
                h.accounts.earn(shooter.account, 'shooter', paid);
                shooter.lifeWon += paid;
            }
        } else if (shooter.account && victim.account && victim.account !== shooter.account && victim.c.ip !== shooter.c.ip) {
            // Free-Arena: Coins aus dem Nichts, deshalb Anti-Farming
            const key = shooter.account + '>' + victim.account;
            const recent = (farm.get(key) || []).filter(t => now - t < FARM_WINDOW);
            if (recent.length < FARM_LIMIT) {
                recent.push(now);
                paid = FREE_KILL_COINS;
                h.accounts.addCoins(shooter.account, paid);
                h.accounts.earn(shooter.account, 'shooter', paid);
            }
            farm.set(key, recent);
        }
        shooter.coins += paid;
        if (paid) h.refresh(shooter.c);
        if (shooter.account) {
            h.accounts.stat(shooter.account, s => { s.shooterKills = (s.shooterKills || 0) + 1; });
            h.accounts.period(shooter.account, x => { x.arenaKills++; });
        }
        const line = { killer: shooter.name, victim: victim.name, coins: paid, streak: shooter.streak, weapon: shooter.weapon };
        feedLog.push(line);
        if (feedLog.length > 20) feedLog.shift();
        for (const q of players.values()) h.send(q.c, { type: 'shKill', ...line });
        if (shooter.streak === 5) h.feed(`🔫 ${shooter.name} is on a 5 kill streak in the Arena!`, 'gold');
        if (paid >= 1000) {
            h.feed(`🔫 ${shooter.name} claimed a ${paid} coin bounty in the Arena`, 'gold');
            if (fee && shooter.account) h.accounts.stat(shooter.account, s => { s.arenaBigBounty = (s.arenaBigBounty || 0) + 1; });
        }
    }

    function tick() {
        const now = Date.now();
        if (now - lastTick < TICK_MS / SPEED) return;
        const dt = Math.min(0.1, (now - lastTick) / 1000) * SPEED;
        lastTick = now;
        if (!players.size) {
            bullets.length = 0;
            return;
        }

        for (const p of players.values()) {
            if (p.dead) {
                if (now >= p.respawnAt && !p.broke) {
                    if (!spawn(p)) h.send(p.c, { type: 'shError', error: `Not enough coins for the next life (${fee})` });
                }
                continue;
            }
            // Bewegen, an Waenden entlang gleiten (Achsen einzeln) – der Browser rechnet genauso
            const nx = p.x + p.mx * MOVE * dt;
            if (!blocked(nx, p.y, R)) p.x = nx;
            const ny = p.y + p.my * MOVE * dt;
            if (!blocked(p.x, ny, R)) p.y = ny;
            if (p.fire) shoot(p, now);
            for (let i = pickups.length - 1; i >= 0; i--) {
                const k = pickups[i];
                if (Math.hypot(k.x - p.x, k.y - p.y) > R + 18) continue;
                if (k.kind === 'heal') p.hp = Math.min(p.maxHp, p.hp + 50);
                else equip(p, k.kind);
                pickups.splice(i, 1);
                h.send(p.c, { type: 'shPickup', kind: k.kind });
            }
        }

        // Kugeln in Teilschritten, damit nichts durch Waende tunnelt
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            let gone = now >= b.dies;
            const steps = Math.max(2, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 12));
            for (let s = 0; s < steps && !gone; s++) {
                b.x += b.vx * dt / steps;
                b.y += b.vy * dt / steps;
                if (blocked(b.x, b.y, 3)) {
                    gone = true;
                    break;
                }
                for (const p of players.values()) {
                    if (p.id === b.owner || p.dead) continue;
                    if (Math.hypot(p.x - b.x, p.y - b.y) < R + 4) {
                        hit(p, players.get(b.owner), b.dmg, now, b.x, b.y);
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

        if (now - lastSend >= SEND_MS / SPEED) push();
    }

    function push() {
        lastSend = Date.now();
        const now = lastSend;
        const base = {
            type: 'sh',
            t: now,
            players: [...players.values()].map(p => ({
                id: p.id, n: p.name, c: p.color,
                x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, a: Math.round(p.a * 100) / 100,
                hp: Math.max(0, Math.round(p.hp)), mh: p.maxHp, dead: p.dead, br: !!p.broke, k: p.kills, d: p.deaths,
                pr: now < p.protect, w: p.weapon, b: p.bounty, sp: p.spawnSeq,
                rs: p.dead ? Math.max(0, p.respawnAt - now) : 0
            })),
            // Kugeln: id, x, y, vx, vy, Besitzer
            bullets: bullets.map(b => [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.owner]),
            pickups: pickups.map(k => [Math.round(k.x), Math.round(k.y), k.icon])
        };
        for (const p of players.values()) h.send(p.c, { ...base, ack: p.seq });
    }

    // Server faehrt herunter: Kopfgelder zurueck
    function refundAll() {
        for (const p of players.values()) {
            if (fee && !p.dead && p.bounty && p.account) h.accounts.addCoins(p.account, p.bounty);
            p.bounty = 0;
        }
    }

    return {
        id, fee, join, leave, input, tick, buyCase, retry, refundAll,
        has: c => players.has(c.id),
        names: () => [...players.values()].map(p => p.name),
        _players: players,
        _hit: hit
    };
}

module.exports = function createShooter(h) {
    // h: { accounts, send, feed, refresh(c), changed() }
    const rooms = {};
    for (const id of Object.keys(ROOMS)) rooms[id] = createRoom(id, h);
    const roomOf = c => Object.values(rooms).find(r => r.has(c));

    return {
        // Beitreten; wer schon in einer anderen Arena ist, wechselt
        join(c, name, color, roomId) {
            const room = rooms[roomId] || rooms.free;
            const old = roomOf(c);
            if (old && old !== room) old.leave(c);
            return room.join(c, name, color);
        },
        leave(c) {
            const r = roomOf(c);
            return r ? r.leave(c) : false;
        },
        input(c, d) {
            const r = roomOf(c);
            if (r) r.input(c, d);
        },
        buyCase(c) {
            const r = roomOf(c);
            if (r) r.buyCase(c);
        },
        retry(c) {
            const r = roomOf(c);
            if (r) r.retry(c);
        },
        tick() {
            for (const r of Object.values(rooms)) r.tick();
        },
        refundAll() {
            for (const r of Object.values(rooms)) r.refundAll();
        },
        has: c => !!roomOf(c),
        // Fuers Menue: wer ist in welcher Arena
        rooms: () => Object.entries(rooms).map(([id, r]) => ({ id, label: ROOMS[id].label, fee: r.fee, players: r.names() })),
        names: () => Object.values(rooms).flatMap(r => r.names()),
        _rooms: rooms
    };
};

module.exports.ROOMS = ROOMS;
module.exports.WEAPONS = WEAPONS;
module.exports.CASE_ITEMS = CASE_ITEMS;
module.exports.blocked = blocked;
