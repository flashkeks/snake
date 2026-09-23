// Markt-Lobby (5.2): ein Platz zum Rumlaufen, kein Kampf. Wer nah bei jemand
// anderem steht, startet mit F einen Handel (der laeuft ueber trade.js).
//
// Der Browser bewegt seine Figur selbst (Hindernisse kennt nur er) und meldet
// die Position; der Server prueft nur Tempo und Kartengrenzen und verteilt
// alle Positionen zehnmal pro Sekunde an die Leute in der Lobby.
//
// h: { accounts, send, shop, titleOf(key) }

const W = 2400, H = 1500;           // muss zu public/market.js (LB_W, LB_H) passen
const SPEED = 260;                  // px/s, mit Luft fuer Netz-Ruckler
const SPAWN = { x: W / 2, y: H - 220 };

module.exports = function createLobby(h) {
    const members = new Map();      // c.id -> { c, key, name, x, y, dir, moving, at, color, nc, head, tt }

    function look(c) {
        const u = h.accounts.get(c.account);
        const eq = (u && u.equipped) || {};
        return {
            name: u.name,
            color: u.color || '#00ff88',
            nc: eq.name || null,
            head: eq.head || null,
            skin: eq.skin || null,
            tt: h.titleOf(c.account) || null
        };
    }

    function join(c) {
        if (!c.account) return 'Log in first';
        const m = members.get(c.id);
        if (m) return null;
        members.set(c.id, {
            c, key: c.account, ...look(c),
            x: SPAWN.x + (Math.random() - 0.5) * 160, y: SPAWN.y + (Math.random() - 0.5) * 60,
            dir: -Math.PI / 2, moving: false, at: Date.now()
        });
        h.send(c, { type: 'lbJoined', id: c.id, w: W, h: H, x: members.get(c.id).x, y: members.get(c.id).y });
        return null;
    }

    function leave(c) {
        members.delete(c.id);
    }

    function move(c, d) {
        const m = members.get(c.id);
        if (!m) return;
        const now = Date.now();
        const dt = Math.min(1, (now - m.at) / 1000);
        m.at = now;
        let x = Number(d.x), y = Number(d.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        // Zu weit gesprungen? Dann nur bis zur erlaubten Strecke
        const dx = x - m.x, dy = y - m.y, dist = Math.hypot(dx, dy);
        const max = SPEED * 1.6 * Math.max(dt, 0.05) + 20;
        if (dist > max) {
            x = m.x + dx / dist * max;
            y = m.y + dy / dist * max;
        }
        m.x = Math.max(20, Math.min(W - 20, x));
        m.y = Math.max(20, Math.min(H - 20, y));
        m.dir = Number(d.dir) || 0;
        m.moving = !!d.moving;
    }

    // Aussehen neu (Cosmetic gewechselt, Titel angelegt)
    function refresh(c) {
        const m = members.get(c.id);
        if (m && c.account) Object.assign(m, look(c));
    }

    function tick() {
        if (!members.size) return;
        const list = [...members.values()].map(m => [m.c.id, m.name, Math.round(m.x), Math.round(m.y), +m.dir.toFixed(2), m.moving ? 1 : 0, m.color, m.nc, m.head, m.tt, m.skin]);
        const msg = { type: 'lbState', p: list };
        for (const m of members.values()) h.send(m.c, msg);
    }
    setInterval(tick, 100);

    function handle(c, d) {
        if (d.type === 'lbJoin') {
            const err = join(c);
            if (err) h.send(c, { type: 'mkNote', text: err, kind: 'err' });
        } else if (d.type === 'lbLeave') leave(c);
        else if (d.type === 'lbMove') move(c, d);
    }

    return { handle, leave, refresh, has: c => members.has(c.id), count: () => members.size };
};
