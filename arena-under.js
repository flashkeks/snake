// Untergrund der Extraction (6.12, Max): unter der Map ein verlassener
// Militaerstuetzpunkt (Keller, Ebene -1) und darunter ein verlassenes
// DNA-Labor (Ebene -2) mit Tanks, in denen geforscht wurde – jetzt laufen
// dort Monster rum.
//
// Technik: beide Ebenen liegen in derselben Welt wie die Oberflaeche, nur weit
// rechts daneben (Abstand > Sichtweite, also sieht man sich nicht). Zu Fuss
// kommt man nicht hin: `regions` begrenzt, wo man stehen darf. Treppen sind
// Stationen (kind 'portal'), F teleportiert zum Gegenstueck.
//
// Alles ist deterministisch (fester Seed), Server und Client sehen dieselbe Map.

const T = 26;                       // Wandstaerke unten (dicker Beton)
const GAP = 2600;                   // Abstand zwischen den Ebenen

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

const circleRect = (x, y, r, [rx, ry, rw, rh]) => {
    const cx = Math.max(rx, Math.min(x, rx + rw)), cy = Math.max(ry, Math.min(y, ry + rh));
    return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
};

// surface: { w, h, walls } – liefert Ebenen, Waende, Kisten, Treppen und Deko
function buildUnder(surface) {
    const rand = rng(9191);
    const walls = [], crates = [], stations = [], deco = [];
    const B = { id: 'bunker', name: 'Abandoned military base', level: -1, x: surface.w + GAP, y: 0, w: 3200, h: 2400 };
    const L = { id: 'lab', name: 'Abandoned lab', level: -2, x: B.x + B.w + GAP, y: 0, w: 2800, h: 2200 };
    const free = (x, y, r) => !walls.some(w => circleRect(x, y, r, w));

    // ---------- Ebene -1: Militaerstuetzpunkt, 4 × 3 Raeume, jeder mit jedem Nachbarn verbunden ----------
    const cols = 4, rows = 3, cw = B.w / cols, rh = B.h / rows, DOOR = 120;
    // Tuermitten (fuer die Patrouillen-Route, 6.12.3): dv[c][r] zwischen Spalte c-1|c, dh[r][c] zwischen Zeile r-1|r
    const dv = {}, dh = {};
    for (let c = 1; c < cols; c++) {
        const x = B.x + c * cw - T / 2;
        for (let r = 0; r < rows; r++) {
            const y0 = B.y + r * rh, at = y0 + 120 + rand() * (rh - 240 - DOOR);
            walls.push([x, y0, T, at - y0], [x, at + DOOR, T, y0 + rh - at - DOOR]);
            dv[c + ',' + r] = { x: Math.round(x + T / 2), y: Math.round(at + DOOR / 2) };
        }
    }
    for (let r = 1; r < rows; r++) {
        const y = B.y + r * rh - T / 2;
        for (let c = 0; c < cols; c++) {
            const x0 = B.x + c * cw, at = x0 + 120 + rand() * (cw - 240 - DOOR);
            walls.push([x0, y, at - x0, T], [at + DOOR, y, x0 + cw - at - DOOR, T]);
            dh[r + ',' + c] = { x: Math.round(at + DOOR / 2), y: Math.round(y + T / 2) };
        }
    }
    const room = (c, r) => ({ x: B.x + c * cw, y: B.y + r * rh, w: cw, h: rh, cx: B.x + (c + .5) * cw, cy: B.y + (r + .5) * rh });
    // Treppen: drei nach oben (je eine Luke oben), eine nach unten ins Labor
    const upRooms = [[0, 0], [3, 0], [0, 2]], downRoom = [3, 2];
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        const R = room(c, r);
        const stairs = upRooms.some(([a, b]) => a === c && b === r) || (downRoom[0] === c && downRoom[1] === r);
        // Deckung: Sandsaecke und Kistenstapel, nicht in der Raummitte (dort Treppe/Platz)
        const n = stairs ? 1 : 2 + Math.floor(rand() * 2);
        for (let k = 0; k < n; k++) {
            for (let t = 0; t < 30; t++) {
                const horiz = rand() < .5, w = horiz ? 120 + rand() * 80 : 36, h = horiz ? 36 : 120 + rand() * 80;
                const x = R.x + 90 + rand() * (R.w - 180 - w), y = R.y + 90 + rand() * (R.h - 180 - h);
                if (Math.hypot(x + w / 2 - R.cx, y + h / 2 - R.cy) < 170) continue;
                const box = [x, y, w, h];
                if (walls.some(o => o[0] < x + w + 90 && o[0] + o[2] + 90 > x && o[1] < y + h + 90 && o[1] + o[3] + 90 > y)) continue;
                walls.push(box);
                deco.push([Math.round(x), Math.round(y), 'sandbag', Math.round(w), Math.round(h)]);
                break;
            }
        }
        // Kisten (Militaer-Beute) und Deko
        // 6.12.1 (Max: weniger Ammo-Kisten): hoechstens eine, nur in gut der Haelfte der Raeume ohne Treppe
        for (let k = 0; k < (!stairs && rand() < 0.55 ? 1 : 0); k++) {
            for (let t = 0; t < 40; t++) {
                const x = R.x + 80 + rand() * (R.w - 160), y = R.y + 80 + rand() * (R.h - 160);
                if (!free(x, y, 50) || crates.some(q => Math.hypot(q.x - x, q.y - y) < 160) || Math.hypot(x - R.cx, y - R.cy) < 150) continue;
                crates.push({ x: Math.round(x), y: Math.round(y), t: 'bunker' });
                break;
            }
        }
        for (const kind of ['lamp', 'lamp', rand() < .5 ? 'bunk' : 'barrels', rand() < .4 ? 'radio' : 'stain']) {
            const x = R.x + 60 + rand() * (R.w - 120), y = R.y + 60 + rand() * (R.h - 120);
            if (free(x, y, 30)) deco.push([Math.round(x), Math.round(y), kind]);
        }
    }

    // ---------- Ebene -2: Labor ----------
    // Mittelhalle mit zwei Reihen DNA-Tanks, links und rechts je ein Fluegel mit
    // Konsolen, oben ein Gang. Tanks blockieren (Wand) und werden als Deko gemalt.
    const lx = L.x, ly = L.y;
    const wingW = 700;
    // Fluegelwaende mit je zwei Durchgaengen
    for (const x of [lx + wingW, lx + L.w - wingW - T]) {
        walls.push([x, ly, T, 420], [x, ly + 420 + 150, T, 700], [x, ly + 420 + 150 + 700 + 150, T, L.h - (420 + 150 + 700 + 150)]);
    }
    // Querwaende in den Fluegeln (kleine Labore)
    for (const [x0, x1] of [[lx, lx + wingW], [lx + L.w - wingW, lx + L.w]]) {
        const y = ly + 1100;
        walls.push([x0, y, (x1 - x0) / 2 - 70, T], [x0 + (x1 - x0) / 2 + 70, y, (x1 - x0) / 2 - 70, T]);
    }
    // Tanks in der Halle: 2 Reihen × 5, ein paar zerbrochen (Monster sind raus)
    const hallX = lx + wingW + T, hallW = L.w - 2 * wingW - 2 * T;
    for (let row = 0; row < 2; row++) {
        for (let k = 0; k < 5; k++) {
            const x = hallX + 110 + k * (hallW - 220) / 4 - 34, y = ly + (row ? L.h - 620 : 520) - 34;
            walls.push([x, y, 68, 68]);
            deco.push([Math.round(x + 34), Math.round(y + 34), rand() < .35 ? 'tankb' : 'tank']);
        }
    }
    // Konsolen und Kryo-Liegen in den Fluegeln
    for (const [x0] of [[lx], [lx + L.w - wingW]]) {
        for (let k = 0; k < 4; k++) {
            for (let t = 0; t < 30; t++) {
                const x = x0 + 100 + rand() * (wingW - 300), y = ly + 120 + rand() * (L.h - 240);
                const box = [x, y, 110, 40];
                if (walls.some(o => o[0] < x + 110 + 70 && o[0] + o[2] + 70 > x && o[1] < y + 40 + 70 && o[1] + o[3] + 70 > y)) continue;
                walls.push(box);
                deco.push([Math.round(x), Math.round(y), k % 2 ? 'console' : 'cryo', 110, 40]);
                break;
            }
        }
    }
    // 6.12.1 (Max: weniger Labor-Kisten): 3 statt 7, weit auseinander
    for (let k = 0; k < 3; k++) {
        for (let t = 0; t < 60; t++) {
            const x = lx + 90 + rand() * (L.w - 180), y = ly + 90 + rand() * (L.h - 180);
            if (!free(x, y, 55) || crates.some(q => Math.hypot(q.x - x, q.y - y) < 700)) continue;
            crates.push({ x: Math.round(x), y: Math.round(y), t: 'lab' });
            break;
        }
    }
    for (let k = 0; k < 26; k++) {
        const x = lx + 60 + rand() * (L.w - 120), y = ly + 60 + rand() * (L.h - 120);
        if (free(x, y, 30)) deco.push([Math.round(x), Math.round(y), ['goo', 'goo', 'papers', 'lablight', 'claw'][Math.floor(rand() * 5)]]);
    }

    // ---------- Treppen ----------
    // Oben: drei Luken auf freien Plaetzen der Oberflaeche
    const surfFree = (x, y) => !surface.walls.some(w => circleRect(x, y, 70, w));
    const hatchWish = [[surface.w * 0.3, surface.h * 0.5], [surface.w * 0.72, surface.h * 0.62], [surface.w * 0.52, surface.h * 0.2]];
    const hatches = hatchWish.map(([hx, hy]) => {
        for (let k = 0; k < 400; k++) {
            const a = k * 2.399, d = 8 * Math.sqrt(k) * 6;
            const x = hx + Math.cos(a) * d, y = hy + Math.sin(a) * d;
            if (surfFree(x, y)) return { x: Math.round(x), y: Math.round(y) };
        }
        return { x: Math.round(hx), y: Math.round(hy) };
    });
    const link = (a, b) => {
        a.to = { x: b.x, y: b.y };
        b.to = { x: a.x, y: a.y };
    };
    upRooms.forEach(([c, r], i) => {
        const R = room(c, r);
        const up = { kind: 'portal', dir: 'up', level: -1, x: Math.round(R.cx), y: Math.round(R.cy) };
        const hatch = { kind: 'portal', dir: 'down', level: 0, x: hatches[i].x, y: hatches[i].y, dest: B.name };
        link(hatch, up);
        up.dest = 'Surface';
        stations.push(hatch, up);
    });
    const DR = room(...downRoom);
    const down = { kind: 'portal', dir: 'down', level: -1, x: Math.round(DR.cx), y: Math.round(DR.cy), dest: L.name };
    const labUp = { kind: 'portal', dir: 'up', level: -2, x: Math.round(lx + L.w / 2), y: Math.round(ly + L.h / 2), dest: B.name };
    link(down, labUp);
    stations.push(down, labUp);

    // Patrouillen-Route im Keller (6.12.3): Schlange durch alle Raeume, ueber die
    // Tueren (davor/dahinter je ein Punkt, damit keiner an der Wand klebt)
    const snake = [];
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) snake.push([r % 2 ? cols - 1 - k : k, r]);
    const route = [];
    snake.forEach(([c, r], i) => {
        const R = room(c, r);
        route.push({ x: Math.round(R.cx + (c % 2 ? 60 : -60)), y: Math.round(R.cy + (r % 2 ? -110 : 110)) });
        const nx = snake[i + 1];
        if (!nx) return;
        if (nx[1] === r) {
            const d = dv[Math.max(c, nx[0]) + ',' + r], s = nx[0] > c ? 1 : -1;
            route.push({ x: d.x - s * 70, y: d.y }, { x: d.x + s * 70, y: d.y });
        } else {
            const d = dh[nx[1] + ',' + c];
            route.push({ x: d.x, y: d.y - 70 }, { x: d.x, y: d.y + 70 });
        }
    });
    B.route = route;
    // Sandsaecke, die auf der Route liegen, fliegen raus (sonst bleibt der Trupp haengen)
    const onRoute = (x, y, w, h) => route.some((p, i) => {
        const q = route[i + 1];
        if (!q) return false;
        const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 10);
        for (let k = 0; k <= n; k++) if (circleRect(p.x + (q.x - p.x) * k / n, p.y + (q.y - p.y) * k / n, 34, [x, y, w, h])) return true;
        return false;
    });
    for (let i = deco.length - 1; i >= 0; i--) {
        const d = deco[i];
        if (d[2] !== 'sandbag' || !onRoute(d[0], d[1], d[3], d[4])) continue;
        deco.splice(i, 1);
        const wi = walls.findIndex(w => Math.round(w[0]) === d[0] && Math.round(w[1]) === d[1] && Math.round(w[2]) === d[3] && Math.round(w[3]) === d[4]);
        if (wi >= 0) walls.splice(wi, 1);
    }

    return {
        regions: [B, L],
        walls: walls.map(w => w.map(Math.round)),
        crates, stations, deco
    };
}

module.exports = { buildUnder, circleRect };
