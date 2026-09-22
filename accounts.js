// Konten, Sessions, Coins und Statistik.
//
// Alles liegt in einer JSON-Datei im Datenordner (DATA_DIR). Fuer ein paar
// hundert Konten reicht das, und es braucht keine nativen Abhaengigkeiten.
// Geschrieben wird gebuendelt alle paar Sekunden und atomar (.tmp + rename).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function newStats() {
    return {
        bestScore: 0,
        kills: 0,
        cashouts: 0,
        bestCashout: 0,
        totalCashout: 0,
        spins: 0,
        biggestWin: 0
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

    let dirty = false;

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
        return { name: u.name, coins: u.coins, color: u.color || null, stats: u.stats };
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
            if (!NAME_RE.test(name)) return { error: 'Name: 3–16 Zeichen, Buchstaben, Zahlen, _ . -' };
            if (password.length < 6) return { error: 'Passwort: mindestens 6 Zeichen' };
            if (password.length > 200) return { error: 'Passwort zu lang' };
            const key = name.toLowerCase();
            if (db.users[key]) return { error: 'Name ist schon vergeben' };

            const salt = crypto.randomBytes(16).toString('hex');
            const hash = (await scrypt(password, salt)).toString('hex');
            // Zwischen await und hier kann jemand schneller gewesen sein
            if (db.users[key]) return { error: 'Name ist schon vergeben' };

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
                return { error: 'Name oder Passwort falsch' };
            }
            return { key, token: createSession(key), user: publicUser(u) };
        },

        resume(token) {
            const s = db.sessions[sha256(String(token || ''))];
            if (!s || s.expires < Date.now() || !db.users[s.user]) return null;
            return { key: s.user, user: publicUser(db.users[s.user]) };
        },

        logout(token) {
            delete db.sessions[sha256(String(token || ''))];
            touch();
        },

        async changePassword(key, oldPw, newPw) {
            const u = db.users[key];
            if (!u) return { error: 'Konto weg' };
            newPw = String(newPw || '');
            if (newPw.length < 6) return { error: 'Neues Passwort: mindestens 6 Zeichen' };
            if (newPw.length > 200) return { error: 'Passwort zu lang' };
            const hash = await scrypt(String(oldPw || ''), u.salt);
            if (!crypto.timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) return { error: 'Altes Passwort falsch' };

            u.salt = crypto.randomBytes(16).toString('hex');
            u.hash = (await scrypt(newPw, u.salt)).toString('hex');
            // Alle anderen Sessions dieses Kontos fliegen raus
            for (const [k, s] of Object.entries(db.sessions)) if (s.user === key) delete db.sessions[k];
            touch();
            return { token: createSession(key) };
        },

        async deleteAccount(key, password) {
            const u = db.users[key];
            if (!u) return { error: 'Konto weg' };
            const hash = await scrypt(String(password || ''), u.salt);
            if (!crypto.timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) return { error: 'Passwort falsch' };
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

        stat(key, fn) {
            const u = db.users[key];
            if (!u) return;
            u.stats = { ...newStats(), ...u.stats };
            fn(u.stats);
            touch();
        },

        // Bestenlisten: nur echte Konten
        top() {
            const all = Object.values(db.users);
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
