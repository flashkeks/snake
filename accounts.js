// Konten, Sessions, Coins und Statistik.
//
// Alles liegt in einer JSON-Datei im Datenordner (DATA_DIR). Fuer ein paar
// hundert Konten reicht das, und es braucht keine nativen Abhaengigkeiten.
// Geschrieben wird gebuendelt alle paar Sekunden und atomar (.tmp + rename).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { berlinDay } = require('./casino');
const shop = require('./shop');
const arenaLevel = require('./arena-level');
const ach = require('./achievements');
const arenaItems = require('./arena-items');
const luck = require('./luck');

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
const EARN_SOURCES = ['snake', 'events', 'daily', 'don', 'admin', 'shooter', 'shop', 'cards'];

// Statistik je Spiel (#5): plays, wagered (Einsatz), won (Auszahlung inkl.
// Einsatz), bestWin (groesste Auszahlung), bestX (hoechster Multi). Beim
// Poker ist won der gewonnene Pot, beim Daily Wheel gibt es keinen Einsatz.
// arena = ein Leben in einer Einsatz-Arena (#12): Einsatz, erbeutete Kopfgelder
const GAMES = ['slots', 'starlight', 'crossy', 'plinko', 'daily', 'blackjack', 'roulette', 'poker', 'don', 'arena'];
// Zaehlen nicht zur Casino-Bilanz (kein Einsatz bzw. kein Casino-Spiel)
const NOT_CASINO = new Set(['daily', 'don', 'arena']);

function newGame() {
    return { plays: 0, wagered: 0, won: 0, bestWin: 0, bestX: 0 };
}

// Zeitraeume fuers Leaderboard (#8): heute und diese Woche (Europe/Berlin,
// ISO-Woche). Werden beim ersten Zugriff im neuen Zeitraum zurueckgesetzt.
function newPeriod(id) {
    return { id, bestScore: 0, kills: 0, bestWin: 0, bestX: {}, casinoNet: 0, eventWins: 0, arenaKills: 0 };
}

// Liste der besten 10 Werte (absteigend) um einen Wert ergaenzen
function topTen(arr, v) {
    return [...(arr || []), v].sort((a, b) => b - a).slice(0, 10);
}

// Wie topTen, aber eine noch fehlende Liste startet mit dem bisherigen
// Bestwert. Vorher (3.1–3.5) begann sie leer: der alte Rekord (aus der Zeit
// vor den Listen) fiel beim ersten neuen Spiel vom Leaderboard. best = Wert
// VOR diesem Spiel.
function addRun(arr, best, v) {
    return topTen(withBest(arr || [], best), v);
}

// Bestwert in die Liste, falls er dort fehlt (Reparatur, s. o.)
function withBest(arr, best) {
    if (!(best > 0) || best <= Math.max(0, ...arr)) return arr;
    return topTen(arr, best);
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
    // 3.4: Standard-Musik weg. Wer "Sunny pop" nur gratis angelegt hatte (nicht
    // gekauft), legt es ab; false (= Standard abgelegt) braucht es nicht mehr
    for (const u of Object.values(db.users)) {
        const e = u.equipped;
        if (!e || !('music' in e)) continue;
        if (e.music === false || (e.music && shop.BY_ID[e.music] && !shop.BY_ID[e.music].free && shop.BY_ID[e.music].price && !(u.inventory || []).includes(e.music))) delete e.music;
    }

    // Reparatur (3.6): Listen, denen der alte Bestwert fehlt, bekommen ihn
    // zurueck (Bug 3.1–3.5, s. addRun). Idempotent, laeuft bei jedem Start.
    let repaired = 0;
    const fix = (obj, listKey, best) => {
        if (!obj || !Array.isArray(obj[listKey])) return;
        const before = obj[listKey].length ? Math.max(...obj[listKey]) : 0;
        obj[listKey] = withBest(obj[listKey], best);
        if (Math.max(0, ...obj[listKey]) !== before) repaired++;
    };
    for (const u of Object.values(db.users)) {
        const s = u.stats;
        if (!s) continue;
        fix(s, 'topRuns', s.bestScore);
        for (const g of Object.values(s.games || {})) {
            fix(g, 'topWins', g.bestWin);
            fix(g, 'topX', g.bestX);
        }
        for (const p of Object.values(s.periods || {})) {
            fix(p, 'topRuns', p.bestScore);
            fix(p, 'topWins', p.bestWin);
            for (const [g, x] of Object.entries(p.bestX || {})) if (p.topX) fix(p.topX, g, x);
        }
    }
    if (repaired) console.log(`accounts: ${repaired} Leaderboard-Listen um den alten Bestwert ergaenzt`);

    // Kekemon-Reset (5.1a, Max): neue Preise und Chancen, darum alle
    // Sammlungen einmal leeren und die netto fuer Packs ausgegebenen Coins
    // zurueck. Laeuft genau einmal (Merker db.meta.kmReset).
    db.meta = db.meta || {};
    let kmReset = 0;
    if (!db.meta.kmReset) {
        for (const u of Object.values(db.users)) {
            const net = u.stats && u.stats.earned ? u.stats.earned.cards || 0 : 0;
            if (!u.cards && !net) continue;
            if (net < 0) u.coins += -net;
            delete u.cards;
            if (u.stats) {
                u.stats.packs = 0;
                if (u.stats.earned) u.stats.earned.cards = 0;
            }
            kmReset++;
            console.log(`accounts: Kekemon-Reset ${u.name}: ${net < 0 ? -net : 0} Coins zurueck`);
        }
        db.meta.kmReset = new Date().toISOString();
    }

    // Zweiter Kekemon-Reset (5.5, Max: "allen Spielern alle Karten weg, Stand
    // auf 0, damit fair"): diesmal OHNE Erstattung (Max' Entscheidung). Einmalig.
    if (!db.meta.kmReset2) {
        for (const u of Object.values(db.users)) {
            if (!u.cards && !(u.stats && u.stats.packs)) continue;
            const n = Object.values(u.cards || {}).reduce((a, b) => a + b, 0);
            delete u.cards;
            if (u.stats) u.stats.packs = 0;
            kmReset++;
            console.log(`accounts: Kekemon-Reset 2 ${u.name}: ${n} Karten weg (keine Erstattung)`);
        }
        db.meta.kmReset2 = new Date().toISOString();
    }

    // Neue Datei gleich anlegen, damit das Backup von Anfang an etwas vorfindet
    let dirty = !fs.existsSync(file) || repaired > 0 || kmReset > 0;

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
        return {
            name: u.name, coins: u.coins, color: u.color || null, stats: u.stats, dailyReady: u.daily !== berlinDay(),
            // Shop (#9)
            // Gratis-Items gehoeren jedem; Standard-Musik laeuft, bis man sie ablegt (dann false)
            inventory: [...new Set([...shop.FREE, ...(u.inventory || [])])], equipped: { ...shop.DEFAULTS, ...(u.equipped || {}) },
            // Achievements (#3)
            achievements: u.achievements || {}, title: u.title || null
        };
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

    // Achievements (#3): neu erreichte eintragen und melden (onUnlock setzt server.js)
    function checkAch(key, silent) {
        const u = db.users[key];
        if (!u) return;
        const got = ach.fresh(u);
        if (!got.length) return;
        u.achievements = { ...u.achievements };
        for (const a of got) u.achievements[a.id] = Date.now();
        dirty = true;
        if (!silent && api.onUnlock) for (const a of got) api.onUnlock(key, a);
    }

    // Beim Start rueckwirkend und still: wer es schon erfuellt, hat es
    for (const key of Object.keys(db.users)) checkAch(key, true);

    const api = {
        NAME_RE,
        save,
        onUnlock: null,
        checkAch,
        touch,

        // Arena (Extraction): Lager, Loadout, Scrap je Konto
        arena(key) {
            const u = db.users[key];
            if (!u) return null;
            if (!u.arena) u.arena = { inv: [], loadout: { primary: null, secondary: null, armor: null, meds: 0 }, scrap: 0 };
            return u.arena;
        },
        titleOf: key => ach.titleOf(db.users[key]),

        // Titel anlegen (Achievement-Id mit Titel) oder ablegen (null)
        setTitle(key, id) {
            const u = db.users[key];
            if (!u) return 'Unknown account';
            if (id === null) {
                delete u.title;
                touch();
                return null;
            }
            const a = ach.BY_ID[id];
            if (!a || !a.title || !(u.achievements || {})[id]) return 'Unlock that achievement first';
            u.title = id;
            touch();
            return null;
        },

        exists(name) {
            return !!db.users[String(name).toLowerCase()];
        },

        // Alle Konten als [key, user] (fuer Aufraeumen beim Start, z. B. Duell-Einsaetze)
        users() {
            return Object.entries(db.users);
        },

        get(key) {
            return db.users[key] || null;
        },

        publicUser,
        addRun,

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

        // Shop (#9): kaufen und anlegen. Rueckgabe: Fehlertext oder null
        buy(key, id) {
            const u = db.users[key];
            const item = shop.BY_ID[id];
            if (!u || !item) return 'Unknown item';
            u.inventory = u.inventory || [];
            if (u.inventory.includes(id)) return 'You already own that';
            if (!shop.inRotation(id)) return 'Not in the shop right now';
            if (u.coins < item.price) return `You need ${item.price.toLocaleString('en-US')} coins`;
            u.coins -= item.price;
            u.inventory.push(id);
            u.equipped = { ...u.equipped, [item.cat]: id };
            touch();
            this.stat(key, s => { s.shopSpent = (s.shopSpent || 0) + item.price; });
            return null;
        },

        // id = null legt die Kategorie ab
        equip(key, cat, id) {
            const u = db.users[key];
            if (!u || !shop.CATS[cat]) return 'Unknown category';
            u.equipped = { ...u.equipped };
            // Ablegen einer Kategorie mit Standard merkt sich false, sonst kaeme der Standard zurueck
            if (id === null) {
                if (shop.DEFAULTS[cat]) u.equipped[cat] = false;
                else delete u.equipped[cat];
            } else {
                const item = shop.BY_ID[id];
                if (!item || item.cat !== cat || !(item.free || (u.inventory || []).includes(id))) return 'You do not own that';
                u.equipped[cat] = id;
            }
            touch();
            return null;
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
            // Schutz (Sicherheits-Check 24.09.2026): nur endliche Zahlen buchen.
            // Ein NaN-Kontostand wuerde jede Pruefung "genug Coins?" aushebeln.
            if (typeof n !== 'number' || !Number.isFinite(n)) {
                console.error('accounts: addCoins mit ungueltigem Betrag', key, n, new Error().stack.split('\n')[2]);
                return u.coins;
            }
            if (!Number.isFinite(u.coins)) u.coins = 0;
            u.coins = Math.max(0, Math.floor(u.coins + n));
            touch();
            if (n > 0 && u.coins >= 1000000) checkAch(key);
            return u.coins;
        },

        // Daily Wheel: einmal pro Kalendertag (Europe/Berlin). true = darf drehen
        claimDaily(key) {
            const u = db.users[key];
            const day = berlinDay();
            if (!u || u.daily === day) return false;
            // Serie fuer "Regular" (#3): gestern gedreht = weiter, sonst neu
            const y = new Date(Date.parse(day + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
            const streak = u.daily === y ? (u.dailyStreak || 0) + 1 : 1;
            u.daily = day;
            u.dailyStreak = streak;
            touch();
            this.stat(key, s => { s.dailyBestStreak = Math.max(s.dailyBestStreak || 0, streak); });
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
            checkAch(key);
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
                // Beste 10 Runden fuers Leaderboard (jede Runde ein eigener
                // Eintrag) – vor dem Bestwert, damit der alte mit reinkommt
                if (win > 0) g.topWins = addRun(g.topWins, g.bestWin, win);
                if (x) g.topX = addRun(g.topX, g.bestX, Math.round(x * 100) / 100);
                g.bestWin = Math.max(g.bestWin, win);
                if (x) g.bestX = Math.max(g.bestX, Math.round(x * 100) / 100);
            });
            this.period(key, p => {
                if (win > 0) p.topWins = addRun(p.topWins, p.bestWin, win);
                if (x) {
                    p.topX = p.topX || {};
                    p.topX[name] = addRun(p.topX[name], p.bestX[name] || 0, Math.round(x * 100) / 100);
                }
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
        // Wie viel Prozent aller Konten ein Achievement haben (5.0, wie bei Steam)
        achRates() {
            const users = Object.values(db.users);
            const n = {};
            for (const u of users) for (const id of Object.keys(u.achievements || {})) n[id] = (n[id] || 0) + 1;
            const total = users.length || 1;
            return { total: users.length, rates: Object.fromEntries(Object.entries(n).map(([id, k]) => [id, Math.round(k / total * 1000) / 10])) };
        },

        adminList() {
            return Object.entries(db.users).map(([key, u]) => ({
                key, name: u.name, coins: u.coins, color: u.color || null,
                created: u.created || null, lastSeen: u.lastSeen || null,
                daily: u.daily || null, stats: { ...newStats(), ...u.stats },
                achievements: Object.keys(u.achievements || {}).length, title: ach.titleOf(u),
                sessions: Object.values(db.sessions).filter(x => x.user === key && x.expires > Date.now()).length
            }));
        },

        adminSetCoins(key, n) {
            const u = db.users[key];
            if (!u) return null;
            if (!Number.isFinite(Number(n))) return u.coins;
            u.coins = Math.max(0, Math.floor(n));
            touch();
            return u.coins;
        },

        // ---------- Admin v2: Cosmetics, Luck, Arena ----------

        adminDetail(key) {
            const u = db.users[key];
            if (!u) return null;
            const a = u.arena || { inv: [], loadout: {}, scrap: 0 };
            return {
                inventory: u.inventory || [], equipped: u.equipped || {}, rig: u.rig || {},
                arena: { inv: a.inv.map(it => ({ ...it, sv: arenaItems.salvageValue(it) })), loadout: a.loadout, scrap: a.scrap, creative: !!a.creative, prog: a.prog || null, level: a.prog ? arenaLevel.levelOf(a.prog.xp).level : 1 }
            };
        },

        // op: give | take | giveAll | takeAll | equip | unequip. Fehlertext oder null
        adminCosmetic(key, op, id) {
            const u = db.users[key];
            if (!u) return 'no such user';
            u.inventory = u.inventory || [];
            u.equipped = { ...u.equipped };
            const item = shop.BY_ID[id];
            if (op === 'giveAll') u.inventory = shop.ITEMS.map(i => i.id);
            else if (op === 'takeAll') {
                u.inventory = [];
                u.equipped = {};
            } else if (!item) return 'unknown item';
            else if (op === 'give') {
                if (!u.inventory.includes(id)) u.inventory.push(id);
            } else if (op === 'take') {
                u.inventory = u.inventory.filter(x => x !== id);
                if (u.equipped[item.cat] === id) delete u.equipped[item.cat];
            } else if (op === 'equip') {
                if (!u.inventory.includes(id)) u.inventory.push(id);
                u.equipped[item.cat] = id;
            } else if (op === 'unequip') {
                if (u.equipped[item.cat] === id) delete u.equipped[item.cat];
            } else return 'unknown op';
            touch();
            return null;
        },

        // Luck setzen (n = 0 loescht). Fehlertext oder null
        adminRig(key, game, n, min, bonus) {
            const u = db.users[key];
            if (!u) return 'no such user';
            const g = luck.GAMES[game];
            if (!g) return 'unknown game';
            n = Math.floor(Number(n));
            if (!Number.isFinite(n) || n < 0 || n > 1000) return 'bad count';
            u.rig = { ...u.rig };
            if (!n) delete u.rig[game];
            else {
                const m = g.mins ? Number(min) : 0;
                if (g.mins && (!Number.isFinite(m) || m <= 0)) return 'bad minimum';
                u.rig[game] = { n, min: m, bonus: !!(g.bonus && bonus) };
            }
            touch();
            return null;
        },

        // Eine Runde Luck verbrauchen: { min, bonus } oder null
        takeRig(key, game) {
            const u = db.users[key];
            const r = u && u.rig && u.rig[game];
            if (!r || r.n <= 0) return null;
            r.n--;
            if (r.n <= 0) delete u.rig[game];
            touch();
            return { min: r.min, bonus: r.bonus };
        },

        // Arena-Lager: give {kind, base, tier, mods, count} | delete {uid} | scrap {set} | clear
        adminArena(key, op, d) {
            const u = db.users[key];
            if (!u) return 'no such user';
            if (!u.arena) u.arena = { inv: [], loadout: { primary: null, secondary: null, armor: null, meds: 0 }, scrap: 0 };
            const a = u.arena;
            const I = arenaItems;
            if (op === 'give') {
                const kind = String(d.kind), base = String(d.base);
                const defs = kind === 'weapon' ? I.WEAPONS : kind === 'armor' ? I.ARMORS : kind === 'util' ? I.UTILS : kind === 'pack' ? I.PACKS : null;
                if (!defs || !defs[base]) return 'unknown base';
                const count = Math.max(1, Math.min(50, Math.floor(Number(d.count)) || 1));
                if (a.inv.length + count > I.invMaxOf(a)) return `stash full (${a.inv.length}/${I.invMaxOf(a)})`;
                const mdefs = kind === 'weapon' ? I.WEAPON_MODS : I.ARMOR_MODS;
                const mods = kind === 'weapon' || kind === 'armor' ? (Array.isArray(d.mods) ? d.mods : [])
                    .filter(m => mdefs[m.id]).slice(0, 6)
                    .map(m => ({ id: m.id, lvl: Math.max(1, Math.min(mdefs[m.id].max, Math.floor(Number(m.lvl)) || 1)) }))
                    .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i) : [];
                const tier = kind === 'util' || kind === 'pack' ? defs[base].tier : Math.max(0, Math.min(6, Math.floor(Number(d.tier)) || 0));
                const made = [];
                for (let i = 0; i < count; i++) made.push(I.craft(kind, base, tier, mods));
                a.inv.push(...made);
                for (const it of made) this.stat(key, s => {
                    s.bestOdds = Math.max(s.bestOdds || 0, it.odds || 0);
                    s.bestTier = Math.max(s.bestTier || 0, I.TIER_IDX[it.tier] || 0);
                });
            } else if (op === 'delete') {
                const uids = new Set((Array.isArray(d.uids) ? d.uids : [d.uid]).map(String));
                a.inv = a.inv.filter(it => !uids.has(it.uid));
            } else if (op === 'scrap') {
                const v = Math.floor(Number(d.set));
                if (!Number.isFinite(v) || v < 0 || v > 1e9) return 'bad amount';
                a.scrap = v;
            } else if (op === 'clear') {
                a.inv = [];
            } else if (op === 'creative') {
                // 25.09.2026 (Max): Creative Mode – im Raid unverwundbar, Item-Menue (Taste C)
                a.creative = !!d.on;
            } else if (op === 'skillreset') {
                // 26.09.2026 (Max): Skill-Baum im Admin-Panel zuruecksetzen – kostenlos, zaehlt
                // nicht als Reset (Preis des naechsten eigenen Resets bleibt). tree: extract, zombies,
                // stats oder all
                a.prog = a.prog || arenaLevel.fresh();
                const which = String(d.tree);
                if (!['extract', 'zombies', 'stats', 'all'].includes(which)) return 'unknown tree';
                if (which === 'extract' || which === 'all') arenaLevel.treeOf(a.prog, 'extract').skills = {};
                if (which === 'zombies' || which === 'all') arenaLevel.treeOf(a.prog, 'zombies').skills = {};
                if (which === 'stats' || which === 'all') a.prog.stats = {};
            } else if (op === 'xp') {
                // Arena-Level (4.0): Gesamt-XP setzen; Punkte ueber dem neuen Level verfallen
                const v = Math.floor(Number(d.set));
                if (!Number.isFinite(v) || v < 0 || v > 1e10) return 'bad amount';
                a.prog = a.prog || arenaLevel.fresh();
                a.prog.xp = v;
                const pts = arenaLevel.pointsOf(a.prog);
                if (pts.statFree < 0) a.prog.stats = {};
                for (const [m, free] of Object.entries(pts.skillFree)) if (free < 0) arenaLevel.treeOf(a.prog, m).skills = {};
            } else return 'unknown op';
            // Loadout zeigt nie auf Geloeschtes
            const l = a.loadout || {};
            for (const s of ['primary', 'secondary', 'armor', 'helmet', 'vest', 'pants', 'boots', 'backpack']) if (l[s] && !a.inv.some(x => x.uid === l[s])) l[s] = null;
            if (Array.isArray(l.util)) l.util = l.util.map(u => u && a.inv.some(x => x.kind === 'util' && x.base === u.base) ? u : null);
            touch();
            return null;
        },

        // Raid-Log (25.09.2026): Items eines Raids zurueck ins Lager. Was schon da ist
        // (gleiche uid), bleibt aus; ist das Lager voll, geht der Rest in die Warteschlange.
        adminRestore(key, items) {
            const u = db.users[key];
            if (!u) return { error: 'no such user' };
            if (!u.arena) u.arena = { inv: [], loadout: { primary: null, secondary: null, armor: null, meds: 0 }, scrap: 0 };
            const a = u.arena;
            a.overflow = a.overflow || [];
            const have = new Set(a.inv.concat(a.overflow).map(it => it.uid));
            let added = 0, queued = 0, skipped = 0;
            for (const src of items) {
                if (!src || src.starter) continue;
                if (src.uid && have.has(src.uid)) { skipped++; continue; }
                const it = JSON.parse(JSON.stringify(src));
                delete it.insured;
                if (a.inv.length < arenaItems.invMaxOf(a)) { a.inv.push(it); added++; } else { a.overflow.push(it); queued++; }
                if (it.uid) have.add(it.uid);
            }
            touch();
            return { added, queued, skipped };
        },

        // Alles zuruecksetzen wie ein frisches Konto: Coins, Statistik,
        // Achievements, Titel, Cosmetics, Arena, Daily, Luck. Name, Passwort,
        // Farbe, Erstellungsdatum und Sessions bleiben.
        // keep = true: Achievements (samt Titel) und Cosmetics bleiben
        adminResetAll(key, keep) {
            const u = db.users[key];
            if (!u) return null;
            const before = { coins: u.coins, items: (u.arena && u.arena.inv.length) || 0, cosmetics: (u.inventory || []).length, keep: !!keep };
            db.users[key] = {
                name: u.name, salt: u.salt, hash: u.hash, color: u.color, created: u.created, lastSeen: u.lastSeen,
                coins: START_COINS, stats: newStats(),
                ...(keep ? { achievements: u.achievements, title: u.title, inventory: u.inventory, equipped: u.equipped } : {})
            };
            touch();
            return before;
        },

        // Passwort-Reset durch den Admin (6.4): neues Passwort setzen, alle
        // Sessions weg. Ohne Vorgabe ein zufaelliges, gut abtippbares Passwort
        // (ohne 0/O/1/l/I). Es wird nur einmal an den Admin zurueckgegeben.
        async adminSetPassword(key, pw) {
            const u = db.users[key];
            if (!u) return { error: 'Account not found' };
            if (pw === undefined || pw === null || pw === '') {
                const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                pw = Array.from(crypto.randomBytes(12), b => abc[b % abc.length]).join('');
            }
            pw = String(pw);
            if (pw.length < 6) return { error: 'Password: at least 6 characters' };
            if (pw.length > 200) return { error: 'Password too long' };
            u.salt = crypto.randomBytes(16).toString('hex');
            u.hash = (await scrypt(pw, u.salt)).toString('hex');
            let sessions = 0;
            for (const [k, s] of Object.entries(db.sessions)) if (s.user === key) { delete db.sessions[k]; sessions++; }
            touch();
            return { password: pw, sessions };
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
        // Dynamisches Leaderboard (#8): cat = Kategorie, game = Spiel (nur bei
        // bestx), period = day | week | all. Coins gibt es nur fuer "all".
        // hidden(key) = Coins, die gerade versteckt sind (Animation laeuft).
        board(cat, game, period, hidden) {
            const day = berlinDay();
            const ids = { day, week: weekId(day) };
            const casinoNet = s => Object.entries(s.games || {}).filter(([k]) => !NOT_CASINO.has(k))
                .reduce((sum, [, g]) => sum + g.won - g.wagered, 0);
            const value = (u, key) => {
                const s = u.stats || {};
                if (cat === 'coins') return u.coins - (hidden ? hidden(key) : 0);
                if (period !== 'all') {
                    const p = (s.periods || {})[period];
                    if (!p || p.id !== ids[period]) return 0;
                    return {
                        score: p.bestScore, kills: p.kills, bigwin: p.bestWin, bestx: (p.bestX || {})[game] || 0,
                        casino: p.casinoNet, events: p.eventWins, arena: p.arenaKills
                    }[cat] || 0;
                }
                const games = s.games || {};
                return {
                    score: s.bestScore, kills: s.kills,
                    bigwin: Math.max(s.biggestWin || 0, ...Object.values(games).map(g => g.bestWin || 0)),
                    bestx: (games[game] || {}).bestX,
                    casino: casinoNet(s), events: s.eventWins, arena: s.shooterKills
                }[cat] || 0;
            };
            // Zombies (4.4): beste ueberlebte Welle
            if (cat === 'zwave') {
                return Object.values(db.users)
                    .filter(u => u.arena && u.arena.zombies && u.arena.zombies.bestWave > 0)
                    .map(u => ({ name: u.name, value: u.arena.zombies.bestWave, tt: ach.titleOf(u) || undefined, k: u.arena.zombies.kills }))
                    .sort((a, b) => b.value - a.value || b.k - a.k).slice(0, 10);
            }
            // PvP-Wertung (4.3): Elo, nur wer schon gespielt hat
            if (cat === 'pvp') {
                return Object.values(db.users)
                    .filter(u => u.arena && u.arena.pvp && u.arena.pvp.wins + u.arena.pvp.losses + u.arena.pvp.draws > 0)
                    .map(u => ({ name: u.name, value: u.arena.pvp.rating, tt: ach.titleOf(u) || undefined, w: u.arena.pvp.wins, l: u.arena.pvp.losses }))
                    .sort((a, b) => b.value - a.value).slice(0, 10);
            }
            // Kekemon-Duelle (5.10): Elo, nur wer schon gespielt hat
            if (cat === 'kmduel') {
                return Object.values(db.users)
                    .filter(u => u.kmDuel && u.kmDuel.wins + u.kmDuel.losses > 0)
                    .map(u => ({ name: u.name, value: u.kmDuel.rating, tt: ach.titleOf(u) || undefined, w: u.kmDuel.wins, l: u.kmDuel.losses }))
                    .sort((a, b) => b.value - a.value).slice(0, 10);
            }
            // Arena-Level (4.0): nach Gesamt-XP, nur "All time"
            if (cat === 'alevel') {
                return Object.values(db.users)
                    .map(u => ({ name: u.name, value: (u.arena && u.arena.prog && u.arena.prog.xp) || 0, tt: ach.titleOf(u) || undefined }))
                    .filter(e => e.value > 0).sort((a, b) => b.value - a.value).slice(0, 10)
                    .map(e => ({ ...e, lv: arenaLevel.levelOf(e.value).level }));
            }
            // Score, Groesster Gewinn und Bester Multi: jede Runde ein eigener
            // Eintrag, man kann mehrfach auf dem Board stehen (Max). Alte Staende
            // ohne Listen stehen mit ihrem Bestwert drin.
            if (cat === 'score' || cat === 'bigwin' || cat === 'bestx') {
                const runsOf = u => {
                    const s = u.stats || {};
                    if (period !== 'all') {
                        const p = (s.periods || {})[period];
                        if (!p || p.id !== ids[period]) return [];
                        if (cat === 'score') return p.topRuns || [p.bestScore];
                        if (cat === 'bigwin') return p.topWins || [p.bestWin];
                        return (p.topX || {})[game] || [(p.bestX || {})[game]];
                    }
                    if (cat === 'score') return s.topRuns || [s.bestScore];
                    const games = s.games || {};
                    if (cat === 'bestx') return (games[game] || {}).topX || [(games[game] || {}).bestX];
                    const all = Object.values(games).flatMap(g => g.topWins || [g.bestWin]).filter(v => v > 0);
                    // biggestWin kommt aus Stellen ohne game(); nur rein, wenn er groesser ist
                    if ((s.biggestWin || 0) > Math.max(0, ...all)) all.push(s.biggestWin);
                    return all.sort((a, b) => b - a).slice(0, 10);
                };
                return Object.values(db.users).flatMap(u => {
                    const tt = ach.titleOf(u) || undefined;
                    return runsOf(u).filter(v => v > 0).map(v => ({ name: u.name, value: v, tt }));
                }).sort((a, b) => b.value - a.value).slice(0, 10);
            }
            return Object.entries(db.users)
                .map(([key, u]) => ({ name: u.name, value: value(u, key), tt: ach.titleOf(u) || undefined }))
                // Casino-Bilanz darf negativ sein, sonst nur echte Werte
                .filter(e => cat === 'casino' ? e.value !== 0 : e.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, 10);
        },

        top(hidden) {
            const all = Object.entries(db.users).map(([key, u]) => hidden && hidden(key) ? { ...u, coins: u.coins - hidden(key) } : u);
            const pick = (sortKey, n) => all
                .map(u => ({ name: u.name, value: sortKey(u), tt: ach.titleOf(u) || undefined }))
                .filter(e => e.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, n);
            const runs = all.flatMap(u => {
                const s = u.stats || {};
                return (s.topRuns || (s.bestScore ? [s.bestScore] : [])).map(v => ({ name: u.name, value: v, tt: ach.titleOf(u) || undefined }));
            }).sort((a, b) => b.value - a.value).slice(0, 10);
            return {
                score: runs,
                coins: pick(u => u.coins, 10),
                kills: pick(u => (u.stats || {}).kills || 0, 10)
            };
        }
    };
    return api;
};

module.exports.GAMES = GAMES;
module.exports.weekId = weekId;
