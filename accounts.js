// Konten, Sessions, Coins und Statistik.
//
// Alles liegt in einer JSON-Datei im Datenordner (DATA_DIR). Fuer ein paar
// hundert Konten reicht das, und es braucht keine nativen Abhaengigkeiten.
// Geschrieben wird gebuendelt alle paar Sekunden und atomar (.tmp + rename).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { berlinDay } = require('./casino');

const START_COINS = 100;
const SESSION_DAYS = 30;
const NAME_RE = /^[\p{L}\p{N}_.-]{3,16}$/u;

function scrypt(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => err ? reject(err) : resolve(key));
    });
}

function sha256(s) {
    return crypto.createHash('sha256').update(s).digest('hex');
}

// Woher Coins kommen (#11): snake = Cashouts, events = Quiz-Belohnungen,
// daily = Daily Wheel, don = Double or Nothing (netto, kann negativ sein),
// admin = Gutschriften/Abzuege im Admin-Interface, shooter = Kills in der
// Arena (#7). Das Casino rechnet je Spiel in stats.games (#5).
const EARN_SOURCES = ['snake', 'events', 'daily', 'don', 'admin', 'shooter'];

// Statistik je Spiel (#5): plays, wagered (Einsatz), won (Auszahlung inkl.
// Einsatz), bestWin (groesste Auszahlung), bestX (hoechster Multi). Beim
// Poker ist won der gewonnene Pot, beim Daily Wheel gibt es keinen Einsatz.
const GAMES = ['slots', 'starlight', 'crossy', 'plinko', 'daily', 'blackjack', 'roulette', 'poker', 'don'];
// Zaehlen nicht zur Casino-Bilanz (kein Einsatz bzw. kein Casino-Spiel)
const NOT_CASINO = new Set(['daily', 'don']);

function newGame() {
    return { plays: 0, wagered: 0, won: 0, bestWin: 0, bestX: 0 };
}

// Zeitraeume fuers Leaderboard (#8): heute und diese Woche (Europe/Berlin,
// ISO-Woche). Werden beim ersten Zugriff im neuen Zeitraum zurueckgesetzt.
function newPeriod(id) {
    return { id, bestScore: 0, kills: 0, bestWin: 0, bestX: {}, casinoNet: 0, eventWins: 0, arenaKills: 0 };
}

function weekId(day) {
    // day = YYYY-MM-DD (Berlin); ISO-Woche: Donnerstag der Woche bestimmt das Jahr
    const d = new Date(day + 'T12:00:00Z');
    const wd = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - wd + 3);
    const y = d.getUTCFullYear();
    const first = new Date(Date.UTC(y, 0, 4));
    const w = 1 + Math.round(((d - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
    return `${y}-W${String(w).padStart(2, '0')}`;
}

function newStats() {
    return {
        bestScore: 0,
        kills: 0,
        cashouts: 0,
        bestCashout: 0,
        totalCashout: 0,
        spins: 0,
        biggestWin: 0,
        earned: Object.fromEntries(EARN_SOURCES.map(k => [k, 0])),
        // #5: Snake-Tode, Spielzeit auf dem Feld, Events, Arena
        deaths: 0,
        playMs: 0,
        eventsPlayed: 0,
        eventWins: 0,
        shooterKills: 0,
        shooterDeaths: 0,
        games: {},
        periods: {}
    };
}

module.exports = function createAccounts(dataDir) {
    const file = path.join(dataDir, 'accounts.json');
    fs.mkdirSync(dataDir, { recursive: true });

    // users: key = Name klein geschrieben. sessions: key = sha256(Token), der Token selbst liegt nie auf der Platte.
    // Fehlt die Datei, geht es leer los. Ist sie da, aber kaputt, startet der
    // Server NICHT: sonst ueberschreibt das naechste Speichern alle Konten.
    let db = { users: {}, sessions: {} };
    if (fs.existsSync(file)) {
        try {
            db = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (err) {
            console.error(`accounts: ${file} ist kaputt (${err.message}). Aus dem Backup holen, dann neu starten.`);
            process.exit(1);
        }
    }
    db.users = db.users || {};
    db.sessions = db.sessions || {};

    // Neue Datei gleich anlegen, damit das Backup von Anfang an etwas vorfindet
    let dirty = !fs.existsSync(file);

    function save(sync) {
        if (!dirty) return;
        dirty = false;
        const tmp = file + '.tmp';
        const data = JSON.stringify(db);
        if (sync) {
            fs.writeFileSync(tmp, data, { mode: 0o600 });
            fs.renameSync(tmp, file);
            return;
        }
        fs.writeFile(tmp, data, { mode: 0o600 }, err => {
            if (err) {
                dirty = true;
                return console.error('accounts: speichern fehlgeschlagen', err.message);
            }
            fs.rename(tmp, file, () => {});
        });
    }

    setInterval(() => save(false), 3000);

    function touch() {
        dirty = true;
    }

    function publicUser(u) {
        return { name: u.name, coins: u.coins, color: u.color || null, stats: u.stats, dailyReady: u.daily !== berlinDay() };
    }

    function createSession(key) {
        const token = crypto.randomBytes(32).toString('hex');
        db.sessions[sha256(token)] = { user: key, expires: Date.now() + SESSION_DAYS * 864e5 };
        touch();
        return token;
    }

    // Abgelaufene Sessions einmal die Stunde wegraeumen
    setInterval(() => {
        const now = Date.now();
        for (const [k, s] of Object.entries(db.sessions)) {
            if (s.expires < now || !db.users[s.user]) {
                delete db.sessions[k];
                touch();
            }
        }
    }, 3600e3);

    return {
        NAME_RE,
        save,

        exists(name) {
            return !!db.users[String(name).toLowerCase()];
        },

        get(key) {
            return db.users[key] || null;
        },

        publicUser,

        async register(name, password) {
            name = String(name || '').trim();
            password = String(password || '');
            if (!NAME_RE.test(name)) return { error: 'Name: 3–16 characters, letters, digits, _ . -' };
            if (password.length < 6) return { error: 'Password: at least 6 characters' };
            if (password.length > 200) return { error: 'Password too long' };
            const key = name.toLowerCase();
            if (db.users[key]) return { error: 'Name is already taken' };

            const salt = crypto.randomBytes(16).toString('hex');
            const hash = (await scrypt(password, salt)).toString('hex');
            // Zwischen await und hier kann jemand schneller gewesen sein
            if (db.users[key]) return { error: 'Name is already taken' };

            db.users[key] = { name, salt, hash, coins: START_COINS, created: Date.now(), stats: newStats() };
            touch();
            return { key, token: createSession(key), user: publicUser(db.users[key]) };
        },

        async login(name, password) {
            const key = String(name || '').trim().toLowerCase();
            const u = db.users[key];
            // Auch ohne Konto rechnen, damit die Antwortzeit nicht verraet, ob es den Namen gibt
            const hash = await scrypt(String(password || ''), u ? u.salt : 'x'.repeat(32));
            if (!u || !crypto.timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) {
                return { error: 'Wrong name or password' };
            }
            u.lastSeen = Date.now();
            touch();
            return { key, token: createSession(key), user: publicUser(u) };
        },

        resume(token) {
            const s = db.sessions[sha256(String(token || ''))];
            if (!s || s.expires < Date.now() || !db.users[s.user]) return null;
            db.users[s.user].lastSeen = Date.now();
            touch();
            return { key: s.user, user: publicUser(db.users[s.user]) };
        },

        logout(token) {
            delete db.sessions[sha256(String(token || ''))];
            touch();
        },

        async changePassword(key, oldPw, newPw) {
            const u = db.users[key];
            if (!u) return { error: 'Account not found' };
            newPw = String(newPw || '');
            if (newPw.length < 6) return { error: 'New password: at least 6 characters' };
            if (newPw.length > 200) return { error: 'Password too long' };
            const hash = await scrypt(String(oldPw || ''), u.salt);
            if (!crypto.timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) return { error: 'Current password is wrong' };

            u.salt = crypto.randomBytes(16).toString('hex');
            u.hash = (await scrypt(newPw, u.salt)).toString('hex');
            // Alle anderen Sessions dieses Kontos fliegen raus
            for (const [k, s] of Object.entries(db.sessions)) if (s.user === key) delete db.sessions[k];
            touch();
            return { token: createSession(key) };
        },

        async deleteAccount(key, password) {
            const u = db.users[key];
            if (!u) return { error: 'Account not found' };
            const hash = await scrypt(String(password || ''), u.salt);
            if (!crypto.timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) return { error: 'Wrong password' };
            delete db.users[key];
            for (const [k, s] of Object.entries(db.sessions)) if (s.user === key) delete db.sessions[k];
            touch();
            return { ok: true };
        },

        setColor(key, color) {
            const u = db.users[key];
            if (u && u.color !== color) {
                u.color = color;
                touch();
            }
        },

        addCoins(key, n) {
            const u = db.users[key];
            if (!u) return null;
            u.coins = Math.max(0, Math.floor(u.coins + n));
            touch();
            return u.coins;
        },

        // Daily Wheel: einmal pro Kalendertag (Europe/Berlin). true = darf drehen
        claimDaily(key) {
            const u = db.users[key];
            const day = berlinDay();
            if (!u || u.daily === day) return false;
            u.daily = day;
            touch();
            return true;
        },

        stat(key, fn) {
            const u = db.users[key];
            if (!u) return;
            const base = newStats();
            u.stats = { ...base, ...u.stats };
            u.stats.earned = { ...base.earned, ...u.stats.earned };
            fn(u.stats);
            touch();
        },

        // Zeitraum-Zaehler (heute, Woche) aktualisieren; fn bekommt je einen Zeitraum
        period(key, fn) {
            const day = berlinDay();
            const week = weekId(day);
            this.stat(key, s => {
                if (!s.periods.day || s.periods.day.id !== day) s.periods.day = newPeriod(day);
                if (!s.periods.week || s.periods.week.id !== week) s.periods.week = newPeriod(week);
                fn(s.periods.day);
                fn(s.periods.week);
            });
        },

        // Eine Runde eines Spiels verbuchen (#5): wager = Einsatz, win = Auszahlung,
        // x = Multi (Auszahlung / Grundeinsatz), falls sinnvoll
        game(key, name, { wager = 0, win = 0, x = 0 } = {}) {
            this.stat(key, s => {
                const g = s.games[name] = { ...newGame(), ...s.games[name] };
                g.plays++;
                g.wagered += wager;
                g.won += win;
                g.bestWin = Math.max(g.bestWin, win);
                if (x) g.bestX = Math.max(g.bestX, Math.round(x * 100) / 100);
            });
            this.period(key, p => {
                p.bestWin = Math.max(p.bestWin, win);
                if (x) p.bestX[name] = Math.max(p.bestX[name] || 0, Math.round(x * 100) / 100);
                if (!NOT_CASINO.has(name)) p.casinoNet += win - wager;
            });
        },

        // Coins aus einer Quelle mitzaehlen (fuer das Balancing, #11)
        earn(key, source, n) {
            if (!n) return;
            this.stat(key, s => { s.earned[source] = (s.earned[source] || 0) + n; });
        },

        // ---------- Admin (nur ueber das Admin-Interface) ----------

        // Alle Konten fuer die Admin-Liste, ohne Hash und Salt
        adminList() {
            return Object.entries(db.users).map(([key, u]) => ({
                key, name: u.name, coins: u.coins, color: u.color || null,
                created: u.created || null, lastSeen: u.lastSeen || null,
                daily: u.daily || null, stats: { ...newStats(), ...u.stats },
                sessions: Object.values(db.sessions).filter(x => x.user === key && x.expires > Date.now()).length
            }));
        },

        adminSetCoins(key, n) {
            const u = db.users[key];
            if (!u) return null;
            u.coins = Math.max(0, Math.floor(n));
            touch();
            return u.coins;
        },

        adminResetDaily(key) {
            const u = db.users[key];
            if (!u) return false;
            delete u.daily;
            touch();
            return true;
        },

        // Alle Sessions eines Kontos weg; offene Verbindungen bleiben, bis sie neu laden
        adminLogoutAll(key) {
            let n = 0;
            for (const [k, s] of Object.entries(db.sessions)) {
                if (s.user === key) {
                    delete db.sessions[k];
                    n++;
                }
            }
            touch();
            return n;
        },

        adminDelete(key) {
            if (!db.users[key]) return false;
            delete db.users[key];
            for (const [k, s] of Object.entries(db.sessions)) if (s.user === key) delete db.sessions[k];
            touch();
            return true;
        },

        // Bestenlisten: nur echte Konten
        // hidden(key): Coins, die noch nicht in der Liste stehen sollen
        // (Gewinn, dessen Animation im Browser noch laeuft)
        top(hidden) {
            const all = Object.entries(db.users).map(([key, u]) => hidden && hidden(key) ? { ...u, coins: u.coins - hidden(key) } : u);
            const pick = (sortKey, n) => all
                .map(u => ({ name: u.name, value: sortKey(u) }))
                .filter(e => e.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, n);
            return {
                score: pick(u => (u.stats || {}).bestScore || 0, 10),
                coins: pick(u => u.coins, 10),
                kills: pick(u => (u.stats || {}).kills || 0, 10)
            };
        }
    };
};

module.exports.GAMES = GAMES;
module.exports.weekId = weekId;
