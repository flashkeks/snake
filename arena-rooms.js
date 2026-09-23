// Arena-Lobbys (seit 4.3): PvP 1v1 / 2v2 / 3v3. Spaeter auch Zombies.
//
// Jede Lobby hat zwei Teams (a, b). Sind beide voll, startet nach 5 s ein
// eigenes Match: eine eigene createArena-Instanz im Modus 'pvp' auf einer
// zufaelligen PvP-Map. Wer in einer Lobby oder einem Match ist, kann nicht in
// die Extraction (und umgekehrt, das prueft server.js).
//
// h: { accounts, send, broadcast, feed, refresh, createArena, worlds }

const START_MS = 5000;
const MAX_LOBBIES = 30;

module.exports = function createRooms(h) {
    const lobbies = new Map();       // id -> Lobby
    let seq = 0;

    function lobbyOf(c) {
        for (const l of lobbies.values()) if (l.members.has(c.id)) return l;
        return null;
    }

    function view(l) {
        const team = t => [...l.members.values()].filter(m => m.team === t).map(m => ({ id: m.c.id, name: m.name, lv: m.level, rating: m.rating }));
        return {
            id: l.id, size: l.size, host: l.hostName, state: l.state, a: team('a'), b: team('b'),
            startIn: l.state === 'starting' ? Math.max(0, l.startAt - Date.now()) : null, map: l.mapName || null
        };
    }

    function list() {
        return [...lobbies.values()].map(view);
    }

    function changed() {
        h.broadcast({ type: 'pvpLobbies', lobbies: list() });
    }

    function member(c) {
        const u = h.accounts.get(c.account);
        const a = h.accounts.arena(c.account);
        const L = require('./arena-level');
        return {
            c, name: u.name, team: 'a',
            level: a.prog ? L.levelOf(a.prog.xp).level : 1,
            rating: a.pvp ? a.pvp.rating : 1000
        };
    }

    function free(l, t) {
        return [...l.members.values()].filter(m => m.team === t).length < l.size;
    }

    // Beide Teams voll: Countdown, sonst zurueck auf offen
    function check(l) {
        if (l.state === 'playing') return;
        const full = !free(l, 'a') && !free(l, 'b');
        if (full && l.state !== 'starting') {
            l.state = 'starting';
            l.startAt = Date.now() + START_MS;
        } else if (!full) l.state = 'open';
    }

    function create(c, size) {
        size = [1, 2, 3].includes(Number(size)) ? Number(size) : 1;
        if (lobbies.size >= MAX_LOBBIES) return 'Too many lobbies right now';
        const l = { id: ++seq, size, members: new Map(), state: 'open', startAt: 0, arena: null, hostName: '' };
        const m = member(c);
        l.hostName = m.name;
        l.members.set(c.id, m);
        lobbies.set(l.id, l);
        changed();
        return null;
    }

    function join(c, id, team) {
        const l = lobbies.get(Number(id));
        if (!l) return 'That lobby is gone';
        if (l.state === 'playing') return 'That match already started';
        const m = member(c);
        const want = team === 'b' ? 'b' : team === 'a' ? 'a' : (free(l, 'a') ? 'a' : 'b');
        if (!free(l, want)) return 'That team is full';
        m.team = want;
        l.members.set(c.id, m);
        check(l);
        changed();
        return null;
    }

    function switchTeam(c) {
        const l = lobbyOf(c);
        if (!l || l.state === 'playing') return;
        const m = l.members.get(c.id);
        const other = m.team === 'a' ? 'b' : 'a';
        if (!free(l, other)) return h.send(c, { type: 'pvpError', error: 'The other team is full' });
        m.team = other;
        check(l);
        changed();
    }

    // Lobby verlassen oder im Match aufgeben
    function leave(c) {
        const l = lobbyOf(c);
        if (!l) return false;
        if (l.arena) l.arena.leave(c);
        l.members.delete(c.id);
        if (!l.members.size) lobbies.delete(l.id);
        else {
            if (l.hostName === (h.accounts.get(c.account) || {}).name) l.hostName = [...l.members.values()][0].name;
            check(l);
        }
        changed();
        return true;
    }

    function start(l) {
        const world = h.worlds[Math.floor(Math.random() * h.worlds.length)];
        l.state = 'playing';
        l.mapName = world.map.name;
        l.arena = h.createArena({
            mode: 'pvp', world, size: l.size,
            onDone: () => {
                // Match vorbei: Lobby weg (die Spieler landen wieder im Hub)
                lobbies.delete(l.id);
                changed();
            }
        });
        for (const m of l.members.values()) {
            const err = l.arena.join(m.c, m.name, null, m.team);
            if (err) h.send(m.c, { type: 'pvpError', error: err });
        }
        l.arena.startPvp();
        changed();
    }

    function tick() {
        const now = Date.now();
        for (const l of [...lobbies.values()]) {
            if (l.state === 'starting' && now >= l.startAt) start(l);
            else if (l.arena) l.arena.tick();
        }
    }

    // Nachrichten aus dem Browser
    function handle(c, d) {
        if (d.type === 'pvpList') return h.send(c, { type: 'pvpLobbies', lobbies: list() });
        if (!c.account) return h.send(c, { type: 'pvpError', error: 'Log in first' });
        let err = null;
        if (d.type === 'pvpCreate' || d.type === 'pvpJoin') {
            if (h.busy(c)) err = 'Leave your raid or game first';
            else if (lobbyOf(c)) err = 'You are already in a lobby';
            else err = d.type === 'pvpCreate' ? create(c, d.size) : join(c, d.id, d.team);
        } else if (d.type === 'pvpLeave') leave(c);
        else if (d.type === 'pvpSwitch') switchTeam(c);
        if (err) h.send(c, { type: 'pvpError', error: err });
    }

    // Laeuft der Browser in einem Match? Dann gehen Raid-Nachrichten dorthin
    function arenaOf(c) {
        const l = lobbyOf(c);
        return l && l.arena && l.arena.has(c) ? l.arena : null;
    }

    return {
        handle, tick, leave, list, arenaOf,
        inLobby: c => !!lobbyOf(c),
        // Browser fragt beim Start: in welcher Lobby bin ich?
        mine: c => { const l = lobbyOf(c); return l ? l.id : null; }
    };
};
