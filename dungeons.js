// Dungeons (25.09.2026, Max): verlassene Militaerbasis und Labor als eigene
// Instanz je Party, bei jedem Betreten neu gewuerfelt, verwinkelt statt
// 4-eckiger Kisten-Raeume.
//
// Aufbau auf einem Kachelraster (TS px): Raeume in verschiedenen Formen
// (Rechteck, L, Kreuz, Halle mit Saeulen), verbunden ueber einen minimalen
// Spannbaum plus ein paar Extra-Gaenge (Schleifen). Gaenge knicken ab (L oder
// Z). Aus dem Raster werden die Waende: jede feste Kachel, die an Boden grenzt,
// zeilenweise zu Rechtecken zusammengefasst. Deckung (Sandsaecke, Tanks,
// Konsolen) kommt nur dazu, wenn danach noch alles erreichbar ist.
//
// buildDungeon(kind, seed) -> Map im selben Format wie die Extraction-Map
// (walls, crates, stations, deco, regions …), dazu spawn, rooms, far.

const { circleRect } = require('./arena-under');

const TS = 80;

const THEMES = {
    bunker: {
        name: 'Abandoned military base', level: -1, w: 3840, h: 2880, rooms: [13, 17], corridor: [2, 2],
        shapes: [['rect', 4], ['hall', 3], ['L', 3], ['cross', 1]], cover: 'sandbag', crateT: 'bunker', crates: [3, 5],
        deco: ['lamp', 'lamp', 'bunk', 'barrels', 'radio', 'stain', 'stain']
    },
    lab: {
        name: 'Abandoned lab', level: -2, w: 3520, h: 2720, rooms: [12, 16], corridor: [2, 3],
        shapes: [['rect', 2], ['L', 3], ['cross', 3], ['tanks', 3]], cover: 'console', crateT: 'lab', crates: [2, 4],
        deco: ['goo', 'goo', 'papers', 'lablight', 'lablight', 'claw']
    }
};

function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function buildDungeon(kind, seed) {
    const th = THEMES[kind] || THEMES.bunker;
    const rand = rng(seed || (Date.now() & 0x7fffffff));
    const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const pick = list => { const tot = list.reduce((s, [, w]) => s + w, 0); let r = rand() * tot; for (const [k, w] of list) if ((r -= w) < 0) return k; return list[0][0]; };
    const GW = Math.floor(th.w / TS), GH = Math.floor(th.h / TS);
    const floor = new Uint8Array(GW * GH);          // 1 = Boden
    const solid = new Uint8Array(GW * GH);          // 1 = Deckung/Saeule mitten im Boden (bleibt Wand)
    const at = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH;
    const setF = (x, y) => { if (at(x, y) && x > 0 && y > 0 && x < GW - 1 && y < GH - 1) floor[y * GW + x] = 1; };
    const carveRect = (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setF(i, j); };

    // ---------- Raeume ----------
    const rooms = [];
    const want = ri(th.rooms[0], th.rooms[1]);
    for (let t = 0; t < 900 && rooms.length < want; t++) {
        const shape = pick(th.shapes);
        let w, h;
        if (shape === 'hall' || shape === 'tanks') { w = ri(8, 12); h = ri(6, 8); } else if (shape === 'cross') { w = ri(7, 9); h = ri(7, 9); } else { w = ri(5, 9); h = ri(4, 7); }
        const x = ri(2, GW - w - 3), y = ri(2, GH - h - 3);
        if (rooms.some(r => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
        rooms.push({ x, y, w, h, shape, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
    }
    for (const r of rooms) {
        if (r.shape === 'L') {
            // zwei Balken, Ecke zufaellig
            const bw = Math.max(2, Math.floor(r.w / 2)), bh = Math.max(2, Math.floor(r.h / 2));
            const top = rand() < .5, left = rand() < .5;
            carveRect(r.x, top ? r.y : r.y + r.h - bh, r.w, bh);
            carveRect(left ? r.x : r.x + r.w - bw, r.y, bw, r.h);
            r.cx = left ? r.x + Math.floor(bw / 2) : r.x + r.w - 1 - Math.floor(bw / 2);
            r.cy = top ? r.y + Math.floor(bh / 2) : r.y + r.h - 1 - Math.floor(bh / 2);
        } else if (r.shape === 'cross') {
            const aw = Math.max(3, Math.floor(r.w / 3)), ah = Math.max(3, Math.floor(r.h / 3));
            carveRect(r.x, r.y + Math.floor((r.h - ah) / 2), r.w, ah);
            carveRect(r.x + Math.floor((r.w - aw) / 2), r.y, aw, r.h);
        } else carveRect(r.x, r.y, r.w, r.h);
        // Saeulen in Hallen, Tank-Reihen im Labor (bleiben Wand)
        if (r.shape === 'hall') {
            for (let j = r.y + 2; j < r.y + r.h - 2; j += 3) for (let i = r.x + 2; i < r.x + r.w - 2; i += 3) solid[j * GW + i] = 1;
        }
        if (r.shape === 'tanks') {
            for (const j of [r.y + 2, r.y + r.h - 3]) for (let i = r.x + 2; i < r.x + r.w - 2; i += 2) solid[j * GW + i] = 2;
        }
    }

    // ---------- Gaenge: Spannbaum + Schleifen ----------
    const dist = (a, b) => Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
    const edges = [];
    const inTree = new Set([0]);
    while (inTree.size < rooms.length) {
        let best = null;
        for (const i of inTree) for (let j = 0; j < rooms.length; j++) {
            if (inTree.has(j)) continue;
            const d = dist(rooms[i], rooms[j]);
            if (!best || d < best[2]) best = [i, j, d];
        }
        edges.push(best);
        inTree.add(best[1]);
    }
    // Schleifen: ein paar kurze Extra-Verbindungen (verwinkelt, mehrere Wege)
    for (let k = 0; k < Math.ceil(rooms.length / 4); k++) {
        const i = ri(0, rooms.length - 1);
        let bj = -1, bd = Infinity;
        for (let j = 0; j < rooms.length; j++) {
            if (j === i || edges.some(e => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i))) continue;
            const d = dist(rooms[i], rooms[j]);
            if (d < bd) { bd = d; bj = j; }
        }
        if (bj >= 0) edges.push([i, bj, bd]);
    }
    const carveLine = (x0, y0, x1, y1, wd) => {
        const off = -Math.floor((wd - 1) / 2);
        if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let k = 0; k < wd; k++) setF(x, y0 + off + k);
        else for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let k = 0; k < wd; k++) setF(x0 + off + k, y);
    };
    for (const [i, j] of edges) {
        const a = rooms[i], b = rooms[j];
        const wd = ri(th.corridor[0], th.corridor[1]);
        if (rand() < 0.35) {
            // Z-Knick ueber eine Zwischenlinie
            const mx = ri(Math.min(a.cx, b.cx), Math.max(a.cx, b.cx));
            carveLine(a.cx, a.cy, mx, a.cy, wd);
            carveLine(mx, a.cy, mx, b.cy, wd);
            carveLine(mx, b.cy, b.cx, b.cy, wd);
        } else if (rand() < .5) {
            carveLine(a.cx, a.cy, b.cx, a.cy, wd);
            carveLine(b.cx, a.cy, b.cx, b.cy, wd);
        } else {
            carveLine(a.cx, a.cy, a.cx, b.cy, wd);
            carveLine(a.cx, b.cy, b.cx, b.cy, wd);
        }
    }
    // Saeulen/Tanks, die ein Gang durchquert, fliegen raus (Gaenge bleiben frei)
    const isFloor = (x, y) => at(x, y) && floor[y * GW + x] && !solid[y * GW + x];

    // ---------- Start und Erreichbarkeit ----------
    // Start: Raum am naechsten zur linken oberen Ecke
    rooms.sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy));
    const start = rooms[0];
    const reach = () => {
        const seen = new Uint8Array(GW * GH), q = [start.cy * GW + start.cx];
        seen[q[0]] = 1;
        for (let qi = 0; qi < q.length; qi++) {
            const c = q[qi], x = c % GW, y = (c / GW) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (!isFloor(nx, ny) || seen[ny * GW + nx]) continue;
                seen[ny * GW + nx] = 1;
                q.push(ny * GW + nx);
            }
        }
        return seen;
    };
    // Saeulen, die etwas abschneiden, wieder entfernen
    let seen = reach();
    for (const r of rooms) if (!seen[r.cy * GW + r.cx]) {
        for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) solid[j * GW + i] = 0;
    }
    seen = reach();
    const allReach = () => { const s2 = reach(); return rooms.every(r => s2[r.cy * GW + r.cx]); };

    // Deckung: 2x1-Bloecke in groesseren Raeumen, nur wenn danach alles erreichbar bleibt
    const coverDeco = [];
    for (const r of rooms) {
        if (r === start || r.w < 6 || r.h < 5) continue;
        const n = ri(1, 3);
        for (let k = 0; k < n; k++) {
            for (let t = 0; t < 12; t++) {
                const horiz = rand() < .5, cw = horiz ? 2 : 1, ch = horiz ? 1 : 2;
                const x = ri(r.x + 1, r.x + r.w - 1 - cw), y = ri(r.y + 1, r.y + r.h - 1 - ch);
                let okc = true;
                for (let j = y - 1; j <= y + ch && okc; j++) for (let i = x - 1; i <= x + cw; i++) if (!isFloor(i, j)) { okc = false; break; }
                if (!okc || (Math.abs(x - r.cx) < 2 && Math.abs(y - r.cy) < 2)) continue;
                for (let j = y; j < y + ch; j++) for (let i = x; i < x + cw; i++) solid[j * GW + i] = 3;
                if (!allReach()) { for (let j = y; j < y + ch; j++) for (let i = x; i < x + cw; i++) solid[j * GW + i] = 0; continue; }
                coverDeco.push([x, y, cw, ch]);
                break;
            }
        }
    }

    // ---------- Waende aus dem Raster ----------
    const wallTile = (x, y) => {
        if (!at(x, y)) return false;
        if (solid[y * GW + x] && floor[y * GW + x]) return true;
        if (floor[y * GW + x]) return false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isFloor(x + dx, y + dy)) return true;
        return false;
    };
    const walls = [];
    for (let y = 0; y < GH; y++) {
        let x = 0;
        while (x < GW) {
            if (!wallTile(x, y) || (solid[y * GW + x] && floor[y * GW + x])) { x++; continue; }
            let e = x;
            while (e + 1 < GW && wallTile(e + 1, y) && !(solid[y * GW + e + 1] && floor[y * GW + e + 1])) e++;
            walls.push([x * TS, y * TS, (e - x + 1) * TS, TS]);
            x = e + 1;
        }
    }
    // Saeulen, Tanks und Deckung als eigene, kleinere Bloecke (sehen besser aus)
    const deco = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const s = solid[y * GW + x];
        if (!s || !floor[y * GW + x]) continue;
        if (s === 1) { walls.push([x * TS + 14, y * TS + 14, TS - 28, TS - 28]); deco.push([x * TS + 14, y * TS + 14, 'pillar', TS - 28, TS - 28]); }
        if (s === 2) { walls.push([x * TS + 6, y * TS + 6, 68, 68]); deco.push([x * TS + 40, y * TS + 40, rand() < .35 ? 'tankb' : 'tank']); }
    }
    for (const [x, y, cw, ch] of coverDeco) {
        const bx = x * TS + 10, by = y * TS + 20, bw = cw * TS - 20, bh = ch * TS - 40;
        const box = cw > ch ? [bx, by, bw, bh] : [x * TS + 20, y * TS + 10, cw * TS - 40, ch * TS - 20];
        walls.push(box);
        deco.push([box[0], box[1], th.cover === 'console' ? (rand() < .5 ? 'console' : 'cryo') : 'sandbag', box[2], box[3]]);
    }

    // ---------- Stationen, Kisten, Deko, Spawnpunkte ----------
    const px = t => t * TS + TS / 2;
    const free = (x, y, r) => !walls.some(w => circleRect(x, y, r, w));
    const spawn = { x: px(start.cx), y: px(start.cy) };
    const stations = [{ kind: 'portal', dir: 'up', level: th.level, x: spawn.x, y: spawn.y, dest: 'Surface', exit: true }];
    // Entfernung ueber den Boden (Kacheln) fuer "weit weg vom Start"
    const far = new Int32Array(GW * GH).fill(-1);
    {
        const q = [start.cy * GW + start.cx];
        far[q[0]] = 0;
        for (let qi = 0; qi < q.length; qi++) {
            const c = q[qi], x = c % GW, y = (c / GW) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (!isFloor(nx, ny) || far[ny * GW + nx] >= 0) continue;
                far[ny * GW + nx] = far[c] + 1;
                q.push(ny * GW + nx);
            }
        }
    }
    for (const r of rooms) r.d = Math.max(0, far[r.cy * GW + r.cx]);
    const byFar = [...rooms].sort((a, b) => b.d - a.d);
    const crates = [];
    const nCr = ri(th.crates[0], th.crates[1]);
    for (const r of byFar) {
        if (crates.length >= nCr) break;
        for (let t = 0; t < 20; t++) {
            const x = px(ri(r.x, r.x + r.w - 1)), y = px(ri(r.y, r.y + r.h - 1));
            if (!free(x, y, 50) || crates.some(q => Math.hypot(q.x - x, q.y - y) < 500)) continue;
            crates.push({ x: Math.round(x), y: Math.round(y), t: th.crateT });
            break;
        }
    }
    for (const r of rooms) {
        for (let k = 0; k < 3; k++) {
            const x = px(ri(r.x, r.x + r.w - 1)) + (rand() - .5) * 40, y = px(ri(r.y, r.y + r.h - 1)) + (rand() - .5) * 40;
            if (free(x, y, 30)) deco.push([Math.round(x), Math.round(y), th.deco[ri(0, th.deco.length - 1)]]);
        }
    }
    // Gegner-Spawnpunkte: Bodenkacheln, mindestens 12 Kacheln (~1000 px Weg) vom Start
    const spawns = [];
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
        if (far[y * GW + x] >= 12 && isFloor(x, y) && free(px(x), px(y), 34)) spawns.push({ x: px(x), y: px(y), d: far[y * GW + x] });
    }

    return {
        kind, seed, name: th.name, w: GW * TS, h: GH * TS,
        walls: walls.map(w => w.map(Math.round)), buildings: [], doors: [], bushes: [], extracts: [],
        crates, stations, deco, town: null, outpost: null, military: null,
        regions: [{ id: kind, name: th.name, level: th.level, x: 0, y: 0, w: GW * TS, h: GH * TS }],
        spawn, spawns, rooms: rooms.map(r => ({ x: r.x * TS, y: r.y * TS, w: r.w * TS, h: r.h * TS, cx: px(r.cx), cy: px(r.cy), d: r.d, shape: r.shape })),
        farRooms: byFar.slice(0, 3).map(r => ({ x: px(r.cx), y: px(r.cy) }))
    };
}

module.exports = { buildDungeon, THEMES, TS };

// Vorschau: node dungeons.js [bunker|lab] [seed] – ASCII-Karte
if (require.main === module) {
    const d = buildDungeon(process.argv[2] || 'bunker', Number(process.argv[3]) || 1);
    const GW = d.w / TS, GH = d.h / TS, g = Array.from({ length: GH }, () => Array(GW).fill(' '));
    for (const [x, y, w, h] of d.walls) for (let j = Math.floor(y / TS); j < Math.ceil((y + h) / TS); j++) for (let i = Math.floor(x / TS); i < Math.ceil((x + w) / TS); i++) if (g[j] && g[j][i] !== undefined) g[j][i] = '#';
    for (const c of d.crates) g[Math.floor(c.y / TS)][Math.floor(c.x / TS)] = 'C';
    g[Math.floor(d.spawn.y / TS)][Math.floor(d.spawn.x / TS)] = 'S';
    console.log(g.map(r => r.join('')).join('\n'));
    console.log(`${d.name}: ${d.rooms.length} Raeume, ${d.walls.length} Waende, ${d.crates.length} Kisten, ${d.spawns.length} Spawnpunkte`);
}
