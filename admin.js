// Admin-Interface: admin-snake.flashkeks.com
//
// Eigener HTTP-Server, nur auf 127.0.0.1:ADMIN_PORT. Davor steht Cloudflare
// Access (Policy "Kek-Only"); zusaetzlich prueft dieser Server selbst das
// Access-JWT (Header Cf-Access-Jwt-Assertion): Signatur gegen die Zertifikate
// des Teams, Audience der App, Aussteller, Ablauf. Faellt Access mal weg oder
// ist falsch eingestellt, kommt trotzdem niemand rein. Kein eigenes Passwort,
// also auch kein neues Secret.
//
// Umgebung:
//   ADMIN_PORT            Port auf 127.0.0.1 (ohne: kein Admin-Interface)
//   SNAKE_ADMIN_TEAM      Access-Team, z. B. "flashkeks" -> flashkeks.cloudflareaccess.com
//   SNAKE_ADMIN_AUD       Audience-Tag der Access-App (kein Geheimnis)
//   SNAKE_ADMIN_EMAILS    optional: nur diese Mails (Komma-Liste)
//   SNAKE_ADMIN_INSECURE  =1 nur fuer lokale Tests: keine Pruefung. Nie auf edge.
//
// Jede aendernde Aktion landet in DATA_DIR/admin-log.jsonl.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEAM = process.env.SNAKE_ADMIN_TEAM || '';
const AUD = process.env.SNAKE_ADMIN_AUD || '';
const EMAILS = (process.env.SNAKE_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const INSECURE = process.env.SNAKE_ADMIN_INSECURE === '1';

// ---------- Access-JWT pruefen ----------

let certs = { keys: [], at: 0 };

function fetchCerts() {
    return new Promise((resolve, reject) => {
        https.get(`https://${TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`, res => {
            let body = '';
            res.on('data', d => { body += d; });
            res.on('end', () => {
                try {
                    const j = JSON.parse(body);
                    certs = { keys: j.keys || [], at: Date.now() };
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

const b64json = s => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

async function verifyAccess(token) {
    if (!token || !TEAM || !AUD) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let header, payload;
    try {
        header = b64json(parts[0]);
        payload = b64json(parts[1]);
    } catch {
        return null;
    }
    if (header.alg !== 'RS256') return null;
    // Zertifikate eine Stunde merken; unbekannter Schluessel = neu holen (Rotation)
    let jwk = certs.keys.find(k => k.kid === header.kid);
    if (!jwk || Date.now() - certs.at > 3600e3) {
        try {
            await fetchCerts();
        } catch (e) {
            console.error('admin: Access-Zertifikate nicht abrufbar', e.message);
        }
        jwk = certs.keys.find(k => k.kid === header.kid);
    }
    if (!jwk) return null;
    const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]),
        crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
    if (!ok) return null;
    const now = Date.now() / 1000;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(AUD)) return null;
    if (payload.iss !== `https://${TEAM}.cloudflareaccess.com`) return null;
    if (!(payload.exp > now) || (payload.nbf && payload.nbf > now + 60)) return null;
    const email = String(payload.email || '').toLowerCase();
    if (!email) return null;
    if (EMAILS.length && !EMAILS.includes(email)) return null;
    return email;
}

// ---------- Server ----------

module.exports = function startAdmin(h) {
    // h: { accounts, tickets, dataDir, publicDir, online(), pushAccount(key), pushTicket(key, ticket), kickAccount(key), feed }
    const port = Number(process.env.ADMIN_PORT);
    if (!port) return null;
    if (!INSECURE && (!TEAM || !AUD)) {
        console.error('admin: SNAKE_ADMIN_TEAM/SNAKE_ADMIN_AUD fehlen – Admin-Interface lehnt alles ab');
    }
    if (INSECURE) console.error('admin: SNAKE_ADMIN_INSECURE=1 – KEINE Anmeldepruefung (nur fuer Tests!)');

    const logFile = path.join(h.dataDir, 'admin-log.jsonl');
    function log(email, action, target, detail) {
        const line = JSON.stringify({ at: new Date().toISOString(), email, action, target, detail }) + '\n';
        fs.appendFile(logFile, line, { mode: 0o600 }, err => { if (err) console.error('admin-log', err.message); });
    }

    function readLog(n) {
        try {
            const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
            return lines.slice(-n).reverse().map(l => JSON.parse(l));
        } catch {
            return [];
        }
    }

    const page = path.join(h.publicDir, '..', 'public-admin', 'index.html');

    function json(res, code, obj) {
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(obj));
    }

    function body(req) {
        return new Promise((resolve, reject) => {
            let data = '';
            req.on('data', d => {
                data += d;
                if (data.length > 16384) {
                    reject(new Error('too large'));
                    req.destroy();
                }
            });
            req.on('end', () => {
                try {
                    resolve(data ? JSON.parse(data) : {});
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    // ---------- Kekemon (6.4) ----------

    function detail(key) {
        const u = h.accounts.get(key);
        return {
            ...h.accounts.adminDetail(key),
            kekemon: { cards: u.cards || {}, packs: u.packs || {}, gyms: u.kmGyms || {}, paid: u.kmGymsPaid || {}, duel: u.kmDuel || null }
        };
    }

    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const count = n => Math.max(1, Math.min(999, Math.floor(Number(n)) || 1));

    // op: giveCard | takeCard | givePack | takePack | gymsReset | gymsUnlock. Fehlertext oder null
    function kmAdmin(u, key, b) {
        const op = String(b.op || '');
        if (op === 'giveCard' || op === 'takeCard') {
            const id = String(b.id || '');
            const v = String(b.v || '');
            if (!h.cardDb || !own(h.cardDb.byId, id)) return 'unknown card';
            if (!/^[pm]?s?$/.test(v)) return 'bad variant';
            const k = h.cards.keyOf(id, v);
            const n = count(b.n);
            u.cards = u.cards || {};
            if (op === 'giveCard') u.cards[k] = (u.cards[k] || 0) + n;
            else {
                if (!(u.cards[k] > 0)) return 'player does not have that card';
                u.cards[k] -= Math.min(n, u.cards[k]);
                if (!u.cards[k]) delete u.cards[k];
            }
            return null;
        }
        if (op === 'givePack' || op === 'takePack') {
            const id = String(b.pack || '');
            if (!own(h.cards.PACKS, id)) return 'unknown pack';
            const n = count(b.n);
            u.packs = u.packs || {};
            if (op === 'givePack') u.packs[id] = (u.packs[id] || 0) + n;
            else {
                if (!(u.packs[id] > 0)) return 'player does not have that pack';
                u.packs[id] -= Math.min(n, u.packs[id]);
                if (!u.packs[id]) delete u.packs[id];
            }
            return null;
        }
        // Gyms zuruecksetzen: bezahlte Erstsiege bleiben gemerkt (kein zweites Pack)
        if (op === 'gymsReset') {
            u.kmGymsPaid = u.kmGymsPaid || {};
            for (const [gid, st] of Object.entries(u.kmGyms || {})) if (st && st.cleared) u.kmGymsPaid[gid] = true;
            u.kmGyms = {};
            return null;
        }
        // Alle freischalten (zum Testen), ohne Belohnung
        if (op === 'gymsUnlock') {
            u.kmGyms = u.kmGyms || {};
            for (const g of h.gyms || []) u.kmGyms[g.id] = { ...(u.kmGyms[g.id] || {}), cleared: (u.kmGyms[g.id] || {}).cleared || Date.now(), wins: (u.kmGyms[g.id] || {}).wins || 0 };
            return null;
        }
        return 'unknown op';
    }

    function kmLogDetail(b) {
        const x = {};
        for (const k of ['id', 'v', 'n', 'pack']) if (b[k] !== undefined && b[k] !== '') x[k] = String(b[k]).slice(0, 40);
        return Object.keys(x).length ? x : undefined;
    }

    const server = http.createServer(async (req, res) => {
        try {
            const email = INSECURE ? 'test@local' : await verifyAccess(req.headers['cf-access-jwt-assertion']);
            if (!email) return json(res, 403, { error: 'forbidden' });

            const url = new URL(req.url, 'http://x');
            const p = url.pathname;
            const m = req.method;

            if (m === 'GET' && (p === '/' || p === '/index.html')) {
                return fs.readFile(page, (err, data) => {
                    if (err) return json(res, 500, { error: 'page missing' });
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'no-store',
                        'X-Frame-Options': 'DENY',
                        'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:"
                    });
                    res.end(data);
                });
            }
            if (m === 'GET' && p === '/logo.png') {
                return fs.readFile(path.join(h.publicDir, 'img', 'logo.png'), (err, data) => {
                    if (err) return json(res, 404, { error: 'not found' });
                    res.writeHead(200, { 'Content-Type': 'image/png' });
                    res.end(data);
                });
            }

            if (!p.startsWith('/api/')) return json(res, 404, { error: 'not found' });

            // Aendernde Aufrufe brauchen einen eigenen Header: ein fremdes Formular
            // (CSRF) kann ihn nicht setzen, ohne dass der Browser vorher fragt.
            if (m !== 'GET' && req.headers['x-admin'] !== '1') return json(res, 400, { error: 'missing X-Admin header' });

            if (m === 'GET' && p === '/api/overview') {
                const users = h.accounts.adminList();
                return json(res, 200, {
                    you: email,
                    online: h.online(),
                    accounts: users.length,
                    coins: users.reduce((s, u) => s + u.coins, 0),
                    // Summe je Quelle ueber alle Konten (#11); gezaehlt ab 23.09.2026
                    earned: users.reduce((sum, u) => {
                        for (const [k, v] of Object.entries(u.stats.earned || {})) sum[k] = (sum[k] || 0) + v;
                        return sum;
                    }, {}),
                    ticketsOpen: h.tickets.openCount(),
                    ticketsUnread: h.tickets.unreadAdminCount()
                });
            }

            // Neustart-Warnung (6.7): GET Stand, POST { minutes, msg } starten, DELETE aufheben
            if (p === '/api/restart' && h.restart) {
                if (m === 'GET') return json(res, 200, { restart: h.restart.get() });
                if (m === 'DELETE') {
                    log(email, 'restart-cancel', '-');
                    return json(res, 200, { restart: h.restart.set(0, '', email) });
                }
                if (m === 'POST') {
                    const b = await body(req);
                    const min = Number(b.minutes);
                    if (!Number.isFinite(min) || min < 0.5 || min > 60) return json(res, 400, { error: 'minutes: 0.5–60' });
                    log(email, 'restart-warn', '-', { minutes: min, msg: String(b.msg || '').slice(0, 200) });
                    return json(res, 200, { restart: h.restart.set(min, b.msg, email) });
                }
            }

            // now (6.3): was der Spieler gerade macht, null = offline
            if (m === 'GET' && p === '/api/users') return json(res, 200, { users: h.accounts.adminList().map(u => ({ ...u, now: h.activity ? h.activity(u.key) : null })) });

            // Zuschauen (6.3): Einmal-Link, 60 s gueltig
            let mw = p.match(/^\/api\/users\/([^/]+)\/watch$/);
            if (m === 'POST' && mw) {
                const key = decodeURIComponent(mw[1]);
                const u = h.accounts.get(key);
                if (!u) return json(res, 404, { error: 'no such user' });
                const url = h.watchUrl ? h.watchUrl(key) : null;
                if (!url) return json(res, 400, { error: 'player is offline' });
                log(email, 'watch', u.name);
                return json(res, 200, { url });
            }

            let mm = p.match(/^\/api\/users\/([^/]+)\/(coins|reset-daily|reset-all|reset-soft|logout-all|password)$/);
            if (m === 'POST' && mm) {
                const key = decodeURIComponent(mm[1]);
                const u = h.accounts.get(key);
                if (!u) return json(res, 404, { error: 'no such user' });
                const b = await body(req);
                if (mm[2] === 'coins') {
                    const before = u.coins;
                    let after;
                    if (b.set !== undefined) {
                        const v = Number(b.set);
                        if (!Number.isFinite(v) || v < 0 || v > 1e12) return json(res, 400, { error: 'bad amount' });
                        after = h.accounts.adminSetCoins(key, v);
                    } else {
                        const d = Number(b.delta);
                        if (!Number.isInteger(d) || Math.abs(d) > 1e12) return json(res, 400, { error: 'bad amount' });
                        after = h.accounts.addCoins(key, d);
                    }
                    h.accounts.earn(key, 'admin', after - before);
                    log(email, 'coins', u.name, { before, after, note: String(b.note || '').slice(0, 200) });
                    h.pushAccount(key);
                    return json(res, 200, { coins: after });
                }
                if (mm[2] === 'reset-all' || mm[2] === 'reset-soft') {
                    // Doppelte Absicherung wie beim Loeschen: der Name muss mitkommen
                    if (b.confirm !== u.name) return json(res, 400, { error: 'confirm with the exact name' });
                    h.stopPlay(key);
                    const before = h.accounts.adminResetAll(key, mm[2] === 'reset-soft');
                    log(email, mm[2], u.name, before);
                    h.pushAccount(key);
                    return json(res, 200, { ok: true });
                }
                if (mm[2] === 'reset-daily') {
                    h.accounts.adminResetDaily(key);
                    log(email, 'reset-daily', u.name);
                    h.pushAccount(key);
                    return json(res, 200, { ok: true });
                }
                if (mm[2] === 'password') {
                    // Das Passwort selbst landet nie im Log
                    const r = await h.accounts.adminSetPassword(key, b.password);
                    if (r.error) return json(res, 400, { error: r.error });
                    h.kickAccount(key);
                    log(email, 'password', u.name, { own: !!b.password, sessions: r.sessions });
                    return json(res, 200, r);
                }
                if (mm[2] === 'logout-all') {
                    const n = h.accounts.adminLogoutAll(key);
                    h.kickAccount(key);
                    log(email, 'logout-all', u.name, { sessions: n });
                    return json(res, 200, { sessions: n });
                }
            }

            mm = p.match(/^\/api\/users\/([^/]+)$/);
            if (m === 'DELETE' && mm) {
                const key = decodeURIComponent(mm[1]);
                const u = h.accounts.get(key);
                if (!u) return json(res, 404, { error: 'no such user' });
                const b = await body(req);
                // Doppelte Absicherung gegen Fehlklick: der Name muss mitkommen
                if (b.confirm !== u.name) return json(res, 400, { error: 'confirm with the exact name' });
                h.kickAccount(key);
                h.accounts.adminDelete(key);
                h.tickets.userDeleted(key);
                log(email, 'delete', u.name, { coins: u.coins });
                return json(res, 200, { ok: true });
            }

            // ---------- Admin v2: Cosmetics, Luck, Arena ----------

            if (m === 'GET' && p === '/api/catalog') {
                const A = h.arenaItems.catalog();
                return json(res, 200, {
                    cosmetics: { cats: h.shop.CATS, items: h.shop.ITEMS.map(({ id, cat, name, icon, price, rarity }) => ({ id, cat, name, icon, price, rarity })) },
                    arena: {
                        weapons: A.weapons, armors: A.armors, sets: A.sets, utils: A.utils, packs: A.packs, tierBonus: A.tierBonus, tiers: A.tiers,
                        weaponMods: A.weaponMods, armorMods: A.armorMods, invMax: A.invMax
                    },
                    luck: h.luck.GAMES,
                    // Kekemon (6.4): alle Karten kompakt [id, name, rarity, type, set], Packs, Gyms
                    kekemon: h.cardDb ? {
                        cards: h.cardDb.cards.map(c => [c.id, c.name, c.rarity, c.type, c.set]),
                        packs: Object.fromEntries(Object.entries(h.cards.PACKS).map(([id, pk]) => [id, { name: pk.name, icon: pk.icon }])),
                        gyms: h.gyms ? h.gyms.map(g => ({ id: g.id, name: g.name, icon: g.icon })) : [],
                        rarities: h.cards.RARITIES.map(r => ({ id: r.id, name: r.name, color: r.color }))
                    } : null
                });
            }

            mm = p.match(/^\/api\/users\/([^/]+)\/(detail|cosmetics|luck|arena|kekemon)$/);
            if (mm) {
                const key = decodeURIComponent(mm[1]);
                const u = h.accounts.get(key);
                if (!u) return json(res, 404, { error: 'no such user' });
                if (m === 'GET' && mm[2] === 'detail') return json(res, 200, detail(key));
                if (m !== 'POST') return json(res, 404, { error: 'not found' });
                const b = await body(req);
                let err;
                if (mm[2] === 'cosmetics') {
                    err = h.accounts.adminCosmetic(key, String(b.op), String(b.id || ''));
                    if (!err) {
                        log(email, 'cosmetic-' + b.op, u.name, b.id ? { id: String(b.id) } : undefined);
                        h.pushAccount(key);
                    }
                } else if (mm[2] === 'luck') {
                    err = h.accounts.adminRig(key, String(b.game), b.n, b.min, b.bonus);
                    if (!err) log(email, 'luck', u.name, { game: String(b.game), n: Number(b.n) || 0, min: Number(b.min) || 0, bonus: !!b.bonus });
                } else if (mm[2] === 'kekemon') {
                    err = kmAdmin(u, key, b);
                    if (!err) {
                        log(email, 'kekemon-' + String(b.op), u.name, kmLogDetail(b));
                        h.accounts.touch();
                        if (h.pushKm) h.pushKm(key);
                    }
                } else if (mm[2] === 'arena') {
                    err = h.accounts.adminArena(key, String(b.op), b);
                    if (!err && b.op === 'creative' && h.creativeChanged) h.creativeChanged(key, !!b.on);
                    if (!err) log(email, 'arena-' + b.op, u.name, b.op === 'give'
                        ? { kind: String(b.kind), base: String(b.base), tier: Number(b.tier) || 0, mods: (b.mods || []).map(x => `${x.id}${x.lvl}`).join(' '), count: Number(b.count) || 1 }
                        : b.op === 'creative' ? { on: !!b.on } : b.op === 'skillreset' ? { tree: String(b.tree) } : b.op === 'scrap' || b.op === 'xp' ? { set: Number(b.set) } : b.op === 'delete' ? { items: (Array.isArray(b.uids) ? b.uids : [b.uid]).length } : undefined);
                }
                if (err) return json(res, 400, { error: err });
                return json(res, 200, detail(key));
            }

            // Raid-Log (25.09.2026): Raids eines Kontos, verlorene Items zurueckgeben
            mm = p.match(/^\/api\/users\/([^/]+)\/raids(?:\/([0-9a-f]{12})\/restore)?$/);
            if (mm && h.raidLog) {
                const key = decodeURIComponent(mm[1]);
                const u = h.accounts.get(key);
                if (!u) return json(res, 404, { error: 'no such user' });
                if (m === 'GET' && !mm[2]) return json(res, 200, { raids: h.raidLog.raidsOf(key, 50) });
                if (m !== 'POST' || !mm[2]) return json(res, 404, { error: 'not found' });
                const r = h.raidLog.raidsOf(key, 1e9).find(x => x.rid === mm[2]);
                if (!r) return json(res, 404, { error: 'no such raid' });
                if (r.live) return json(res, 400, { error: 'raid is still running' });
                if (r.restored) return json(res, 400, { error: 'already restored' });
                if (!r.restorable.length) return json(res, 400, { error: 'nothing to restore' });
                const out = h.accounts.adminRestore(key, r.restorable);
                if (out.error) return json(res, 400, out);
                h.raidLog.write({ ev: 'restore', rid: r.rid, user: key, by: email, n: out.added + out.queued });
                log(email, 'arena-restore', u.name, { rid: r.rid, end: r.end, ...out });
                h.pushAccount(key);
                return json(res, 200, { ...out, raids: h.raidLog.raidsOf(key, 50) });
            }

            if (m === 'GET' && p === '/api/tickets') return json(res, 200, { tickets: h.tickets.adminList() });

            mm = p.match(/^\/api\/tickets\/(\d+)$/);
            if (m === 'GET' && mm) {
                const t = h.tickets.adminGet(Number(mm[1]));
                return t ? json(res, 200, { ticket: t }) : json(res, 404, { error: 'not found' });
            }

            mm = p.match(/^\/api\/tickets\/(\d+)\/(reply|status)$/);
            if (m === 'POST' && mm) {
                const b = await body(req);
                const r = mm[2] === 'reply' ? h.tickets.adminReply(Number(mm[1]), b.text) : h.tickets.adminStatus(Number(mm[1]), b.status);
                if (r.error) return json(res, 400, r);
                h.pushTicket(r.ticket.user, r.user);
                log(email, 'ticket-' + mm[2], '#' + mm[1], mm[2] === 'status' ? { status: b.status } : { chars: String(b.text || '').length });
                return json(res, 200, { ticket: h.tickets.adminGet(Number(mm[1])) });
            }

            if (m === 'GET' && p === '/api/log') return json(res, 200, { log: readLog(200) });

            return json(res, 404, { error: 'not found' });
        } catch (err) {
            console.error('admin', err.message);
            return json(res, 500, { error: 'server error' });
        }
    });

    server.listen(port, '127.0.0.1', () => console.log(`Admin-Interface auf http://127.0.0.1:${port}`));
    return server;
};

module.exports.verifyAccess = verifyAccess;
// Nur fuer Tests: Zertifikate vorgeben statt von Cloudflare holen
module.exports._setCerts = keys => { certs = { keys, at: Date.now() }; };
