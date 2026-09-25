// Support-Tickets: Spieler mit Konto schreiben aus dem Spielmenue, Max
// antwortet im Admin-Interface (admin-snake.flashkeks.com). Gedacht vor allem
// fuer Verbesserungsvorschlaege.
//
// Eine JSON-Datei im Datenordner, geschrieben wie accounts.json: gebuendelt,
// atomar (.tmp + rename). Ist die Datei kaputt, startet der Server nicht.

const fs = require('fs');
const path = require('path');

const MAX_OPEN = 5;          // offene Tickets je Konto
const MAX_TEXT = 1500;
const MAX_SUBJECT = 80;
const MAX_MESSAGES = 200;    // je Ticket

function clean(s, max) {
    return String(s || '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
}

module.exports = function createTickets(dataDir) {
    const file = path.join(dataDir, 'tickets.json');
    let db = { nextId: 1, tickets: {} };
    if (fs.existsSync(file)) {
        try {
            db = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (err) {
            console.error(`tickets: ${file} ist kaputt (${err.message}). Aus dem Backup holen, dann neu starten.`);
            process.exit(1);
        }
    }
    db.tickets = db.tickets || {};
    db.nextId = db.nextId || 1;
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
                return console.error('tickets: speichern fehlgeschlagen', err.message);
            }
            fs.rename(tmp, file, () => {});
        });
    }
    setInterval(() => save(false), 3000);
    const touch = () => { dirty = true; };

    // Was der Spieler sieht (ohne interne Felder)
    function forUser(t) {
        return {
            id: t.id, subject: t.subject, status: t.status, created: t.created, updated: t.updated,
            unread: t.unreadUser, messages: t.messages
        };
    }

    function summary(t) {
        const last = t.messages[t.messages.length - 1];
        return {
            id: t.id, user: t.user, name: t.name, subject: t.subject, status: t.status,
            created: t.created, updated: t.updated, count: t.messages.length,
            unread: t.unreadAdmin, last: last ? { from: last.from, text: last.text.slice(0, 120) } : null
        };
    }

    return {
        save,
        MAX_TEXT,

        // ---------- Spieler ----------

        listFor(key) {
            return Object.values(db.tickets).filter(t => t.user === key).sort((a, b) => b.updated - a.updated).map(forUser);
        },

        unreadFor(key) {
            return Object.values(db.tickets).filter(t => t.user === key && t.unreadUser).length;
        },

        create(key, name, subject, text) {
            subject = clean(subject, MAX_SUBJECT);
            text = clean(text, MAX_TEXT);
            if (!subject) return { error: 'Please enter a subject' };
            if (!text) return { error: 'Please write a message' };
            const open = Object.values(db.tickets).filter(t => t.user === key && t.status === 'open').length;
            if (open >= MAX_OPEN) return { error: `You already have ${MAX_OPEN} open tickets` };
            const now = Date.now();
            const t = {
                id: db.nextId++, user: key, name, subject, status: 'open', created: now, updated: now,
                unreadUser: false, unreadAdmin: true,
                messages: [{ from: 'user', text, at: now }]
            };
            db.tickets[t.id] = t;
            touch();
            return { ticket: forUser(t) };
        },

        userReply(key, id, text) {
            const t = db.tickets[id];
            if (!t || t.user !== key) return { error: 'Ticket not found' };
            if (t.status !== 'open') return { error: 'This ticket is closed' };
            text = clean(text, MAX_TEXT);
            if (!text) return { error: 'Empty message' };
            if (t.messages.length >= MAX_MESSAGES) return { error: 'Ticket is full, please open a new one' };
            t.messages.push({ from: 'user', text, at: Date.now() });
            t.updated = Date.now();
            t.unreadAdmin = true;
            touch();
            return { ticket: forUser(t) };
        },

        markRead(key, id) {
            const t = db.tickets[id];
            if (!t || t.user !== key || !t.unreadUser) return;
            t.unreadUser = false;
            touch();
        },

        // ---------- Admin ----------

        adminList() {
            return Object.values(db.tickets).sort((a, b) =>
                (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.updated - a.updated).map(summary);
        },

        adminGet(id) {
            const t = db.tickets[id];
            if (!t) return null;
            if (t.unreadAdmin) {
                t.unreadAdmin = false;
                touch();
            }
            return { ...summary(t), messages: t.messages };
        },

        adminReply(id, text) {
            const t = db.tickets[id];
            if (!t) return { error: 'not found' };
            text = clean(text, MAX_TEXT);
            if (!text) return { error: 'empty' };
            t.messages.push({ from: 'admin', text, at: Date.now() });
            t.updated = Date.now();
            t.unreadUser = true;
            touch();
            return { ticket: t, user: forUser(t) };
        },

        adminStatus(id, status) {
            const t = db.tickets[id];
            if (!t || !['open', 'closed'].includes(status)) return { error: 'bad request' };
            t.status = status;
            t.updated = Date.now();
            t.unreadUser = true;
            touch();
            return { ticket: t, user: forUser(t) };
        },

        // Konto geloescht: seine Tickets bleiben lesbar, der Name bekommt einen Vermerk
        userDeleted(key) {
            for (const t of Object.values(db.tickets)) {
                if (t.user === key && !t.name.endsWith(' (deleted)')) {
                    t.name += ' (deleted)';
                    touch();
                }
            }
        },

        openCount() {
            return Object.values(db.tickets).filter(t => t.status === 'open').length;
        },
        unreadAdminCount() {
            return Object.values(db.tickets).filter(t => t.unreadAdmin).length;
        }
    };
};
