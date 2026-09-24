// Gefahrenzonen (6.9, Max: "Bosse wie Undertale – keine kleinen Mobs, man muss
// RIESIGE Sachen dodgen, vorher rot markiert").
//
// Eine Zone wird erst angekuendigt (rot, total ms), dann aktiv (bis until):
// Sofortschaden (dmg, je Spieler einmal) und/oder Dauerschaden (dps). Sie kann
// sich bewegen (vx, vy) und drehen (va) – so entstehen fegende Knochenwaende
// und rotierende Strahlen.
//
// Formen (sh):
//   c  Kreis        r
//   r  Rechteck     w (Laenge), h (Breite), a (Winkel), Mittelpunkt x/y
//   g  Ring         r, r2, optional Luecke ga (Winkel) / gs (Breite)
//   k  Sektor       r, a, span  (Kegel vom Punkt aus)
//   s  "sicher"     alles trifft ausser den Kreisen safe [[x, y, r], …]
// blue: trifft nur, wer sich bewegt (Undertale: blaue Knochen – stillstehen!)
//
// Die Angriffs-Skripte der Bosse (PATTERNS) liefern, wie lange sie dauern.

const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = xs => xs[Math.floor(Math.random() * xs.length)];

// look: Optik im Browser (zfx.js zDrawHazard)
const LOOK = { bone: 1, gaster: 2, blue: 3, sun: 4, meteor: 5, void: 6, blade: 7, karma: 8 };

function hits(z, px, py, R) {
    const dx = px - z.x, dy = py - z.y;
    if (z.sh === 'c') return dx * dx + dy * dy < (z.r + R * 0.7) ** 2;
    if (z.sh === 'r') {
        const ca = Math.cos(z.a), sa = Math.sin(z.a);
        const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
        return Math.abs(lx) <= z.w / 2 + R * 0.6 && Math.abs(ly) <= z.h / 2 + R * 0.6;
    }
    const d = Math.hypot(dx, dy);
    if (z.sh === 'g') {
        if (d < z.r - R * 0.6 || d > z.r2 + R * 0.6) return false;
        return !(z.gs && angDiff(Math.atan2(dy, dx), z.ga) < z.gs / 2);
    }
    if (z.sh === 'k') return d < z.r + R * 0.5 && d > 20 && angDiff(Math.atan2(dy, dx), z.a) < z.span / 2;
    if (z.sh === 's') return !(z.safe || []).some(([sx, sy, sr]) => Math.hypot(px - sx, py - sy) < sr - R * 0.3);
    return false;
}

// h: { W, H, R, players(), damage(p, dmg, now, by), fx(x, y, msg), say(text) }
function createHazards(h) {
    const list = [];
    let seq = 0;

    function add(z, now) {
        z.id = ++seq;
        z.total = z.total || 1000;
        z.at = now + z.total / h.speed;
        z.until = z.at + (z.dur || 400) / h.speed;
        z.hit = new Set();
        list.push(z);
        return z;
    }

    function tick(now, dt) {
        for (let i = list.length - 1; i >= 0; i--) {
            const z = list[i];
            if (now >= z.until) {
                list.splice(i, 1);
                continue;
            }
            if (now < z.at) continue;
            if (z.vx || z.vy) {
                z.x += (z.vx || 0) * dt;
                z.y += (z.vy || 0) * dt;
            }
            if (z.va) z.a += z.va * dt;
            for (const p of h.players()) {
                if (p.dead) continue;
                if (z.blue && !(p.mx || p.my)) continue;
                if (!hits(z, p.x, p.y, h.R)) continue;
                if (z.dmg && !z.hit.has(p.id)) {
                    z.hit.add(p.id);
                    h.damage(p, z.dmg, now, z.by);
                }
                if (z.dps) h.damage(p, z.dps * dt, now, z.by);
            }
        }
    }

    function clear() {
        list.length = 0;
    }

    // Fuer den Browser: [id, sh, x, y, p1, p2, p3, p4, bisAktiv, bisEnde, total, look, vx, vy, va, blue, safe]
    function view(now) {
        const code = { c: 0, r: 1, g: 2, k: 3, s: 4 };
        return list.map(z => {
            const p = z.sh === 'c' ? [z.r, 0, 0, 0] : z.sh === 'r' ? [z.w, z.h, z.a, 0] : z.sh === 'g' ? [z.r, z.r2, z.ga || 0, z.gs || 0]
                : z.sh === 'k' ? [z.r, z.a, z.span, 0] : [0, 0, 0, 0];
            return [z.id, code[z.sh], Math.round(z.x || 0), Math.round(z.y || 0), ...p.map(v => Math.round(v * 100) / 100),
                Math.max(0, Math.round(z.at - now)), Math.max(0, Math.round(z.until - now)), z.total, z.look || 0,
                Math.round(z.vx || 0), Math.round(z.vy || 0), Math.round((z.va || 0) * 100) / 100, z.blue ? 1 : 0,
                z.safe ? z.safe.map(s => s.map(Math.round)) : 0];
        });
    }

    return { add, tick, clear, view, list };
}

// ---------- Angriffs-Skripte ----------
// api: { hz, W, H, players(), boss m, now, dmg(base), say(text), enraged }
// Rueckgabe: Dauer in ms bis zum naechsten Angriff (ohne Pause)

const alive = api => api.players().filter(p => !p.dead);
const target = api => pick(alive(api)) || { x: api.W / 2, y: api.H / 2 };
const clampIn = (api, x, y, m) => [Math.max(m, Math.min(api.W - m, x)), Math.max(m, Math.min(api.H - m, y))];

// Fegende Wand mit Luecke. dir: 0 → rechts, 1 → links, 2 → unten, 3 → oben
function wall(api, dir, delay, look, dmg) {
    const { W, H } = api;
    const horiz = dir < 2;
    const span = horiz ? H : W, travel = horiz ? W : H;
    const speed = api.enraged ? 700 : 560;
    const gap = api.enraged ? 170 : 210;
    // Luecke in der Naehe eines Spielers, damit sie erreichbar ist
    const t = target(api);
    const g = Math.max(gap, Math.min(span - gap, (horiz ? t.y : t.x) + rnd(-260, 260)));
    const start = dir === 0 || dir === 2 ? -40 : travel + 40;
    const v = (dir === 0 || dir === 2 ? 1 : -1) * speed;
    const dur = (travel + 80) / speed * 1000;
    const parts = [[0, g - gap / 2], [g + gap / 2, span]];
    for (const [a, b] of parts) {
        if (b - a < 10) continue;
        const mid = (a + b) / 2, len = b - a;
        api.hz.add(horiz
            ? { sh: 'r', x: start, y: mid, w: 56, h: len, a: 0, vx: v, total: 1000 + delay, dur, dmg, look }
            : { sh: 'r', x: mid, y: start, w: len, h: 56, a: 0, vy: v, total: 1000 + delay, dur, dmg, look }, api.now);
    }
    return 1000 + delay + dur;
}

// Riesiger Strahl durch einen Punkt
function beam(api, x, y, a, delay, look, dmg, width = 170) {
    api.hz.add({ sh: 'r', x, y, w: 4200, h: width, a, total: 1000 + delay, dur: 550, dmg, look }, api.now);
    return 1000 + delay + 550;
}

// Schachbrett aus Feldern, erst die eine Haelfte, dann die andere
function checker(api, size, look, dmg, circles) {
    const { W, H } = api;
    let n = 0;
    for (const half of [0, 1]) {
        for (let gx = 0; gx * size < W; gx++) {
            for (let gy = 0; gy * size < H; gy++) {
                if ((gx + gy) % 2 !== half) continue;
                const x = gx * size + size / 2, y = gy * size + size / 2;
                api.hz.add(circles
                    ? { sh: 'c', x, y, r: size * 0.52, total: 1100 + half * 1500, dur: 450, dmg, look }
                    : { sh: 'r', x, y, w: size, h: size, a: 0, total: 1100 + half * 1500, dur: 450, dmg, look }, api.now);
                n++;
            }
        }
    }
    return 1100 + 1500 + 450;
}

// Ueberall Schaden ausser auf sicheren Inseln
function islands(api, n, r, look, dmg, warn) {
    const safe = [];
    for (let k = 0; k < n; k++) {
        const t = k === 0 ? target(api) : { x: rnd(300, api.W - 300), y: rnd(300, api.H - 300) };
        const [x, y] = clampIn(api, t.x + rnd(-450, 450), t.y + rnd(-350, 350), 260);
        safe.push([x, y, r]);
    }
    api.hz.add({ sh: 's', x: 0, y: 0, safe, total: warn, dur: 500, dmg, look }, api.now);
    return warn + 500;
}

const PATTERNS = {
    // ---------- Welle 30: Judge Bones (Sans-Anspielung) ----------
    judge: {
        boneWall(api) {
            const d = Math.floor(Math.random() * 4);
            let t = wall(api, d, 0, LOOK.bone, api.dmg(55));
            if (api.enraged) t = Math.max(t, wall(api, d ^ 1, 900, LOOK.bone, api.dmg(55)));
            return t;
        },
        blasters(api) {
            const n = api.enraged ? 6 : 4;
            let t = 0;
            for (let k = 0; k < n; k++) {
                const p = target(api);
                t = Math.max(t, beam(api, p.x, p.y, rnd(0, Math.PI), k * 280, LOOK.gaster, api.dmg(75)));
            }
            api.say('💀 GASTER BLASTERS');
            return t;
        },
        boneGrid(api) {
            return checker(api, 300, LOOK.bone, api.dmg(60), true);
        },
        blue(api) {
            api.say('🔵 DON\'T MOVE');
            api.hz.add({ sh: 's', x: 0, y: 0, safe: [], blue: true, total: 1400, dur: 1600, dps: api.dmg(55), look: LOOK.blue }, api.now);
            return 3000;
        },
        karma(api) {
            api.say('💀 Find a safe spot!');
            return islands(api, api.enraged ? 2 : 3, 170, LOOK.karma, api.dmg(95), 1800);
        }
    },
    // ---------- Welle 35: Solaris, the Sun Eater ----------
    seraph: {
        nova(api) {
            const m = api.m;
            let ga = rnd(0, TAU);
            const n = api.enraged ? 7 : 6;
            for (let k = 0; k < n; k++) {
                const r = 180 + k * 240;
                api.hz.add({ sh: 'g', x: m.x, y: m.y, r, r2: r + 130, ga, gs: 1.0, total: 1100 + k * 260, dur: 380, dmg: api.dmg(65), look: LOOK.sun }, api.now);
                ga += rnd(0.45, 0.8) * (Math.random() < 0.5 ? -1 : 1);
            }
            return 1100 + n * 260 + 380;
        },
        sunbeams(api) {
            const m = api.m, n = api.enraged ? 6 : 5, a0 = rnd(0, TAU), dir = Math.random() < 0.5 ? -1 : 1;
            for (let k = 0; k < n; k++) api.hz.add({ sh: 'k', x: m.x, y: m.y, r: 2000, a: a0 + k / n * TAU, span: 0.24, va: dir * (api.enraged ? 0.7 : 0.5), total: 1200, dur: 3400, dps: api.dmg(95), look: LOOK.sun }, api.now);
            return 1200 + 3400;
        },
        meteors(api) {
            const ps = alive(api);
            const n = api.enraged ? 16 : 12;
            for (let k = 0; k < n; k++) {
                const on = ps[k % Math.max(1, ps.length)];
                const [x, y] = k < ps.length && on ? [on.x, on.y] : clampIn(api, rnd(0, api.W), rnd(0, api.H), 120);
                api.hz.add({ sh: 'c', x, y, r: rnd(170, 240), total: 1200 + k * 150, dur: 350, dmg: api.dmg(80), look: LOOK.meteor }, api.now);
            }
            return 1200 + n * 150 + 350;
        },
        cross(api) {
            const m = api.m, a = rnd(0, Math.PI), va = (Math.random() < 0.5 ? -1 : 1) * (api.enraged ? 0.5 : 0.35);
            for (const off of [0, Math.PI / 2]) api.hz.add({ sh: 'r', x: m.x, y: m.y, w: 4400, h: 190, a: a + off, va, total: 1300, dur: 3200, dps: api.dmg(110), look: LOOK.sun }, api.now);
            return 1300 + 3200;
        },
        supernova(api) {
            api.say('☀️ SUPERNOVA – get close to the sun!');
            const m = api.m;
            api.hz.add({ sh: 's', x: 0, y: 0, safe: [[m.x, m.y, 280]], total: 2000, dur: 600, dmg: api.dmg(100), look: LOOK.sun }, api.now);
            return 2600;
        }
    },
    // ---------- Welle 40: Omega, the End of All ----------
    omega: {
        checker(api) {
            return checker(api, 325, LOOK.void, api.dmg(85), false);
        },
        lances(api) {
            const n = api.enraged ? 9 : 6;
            let t = 0;
            for (let k = 0; k < n; k++) {
                const p = target(api);
                t = Math.max(t, beam(api, p.x + rnd(-80, 80), p.y + rnd(-80, 80), rnd(0, Math.PI), k * 190, LOOK.void, api.dmg(80), 140));
            }
            return t;
        },
        blades(api) {
            const m = api.m, a = rnd(0, Math.PI), va = (Math.random() < 0.5 ? -1 : 1) * (api.enraged ? 1.05 : 0.8);
            for (const off of [0, Math.PI / 2]) api.hz.add({ sh: 'r', x: m.x, y: m.y, w: 3200, h: 95, a: a + off, va, total: 1200, dur: 4200, dps: api.dmg(120), look: LOOK.blade }, api.now);
            return 1200 + 4200;
        },
        collapse(api) {
            api.say('🌌 COLLAPSE – reach an island!');
            return islands(api, 2, 150, LOOK.void, api.dmg(110), 1700);
        },
        twinWalls(api) {
            const t1 = wall(api, Math.floor(Math.random() * 2), 0, LOOK.void, api.dmg(70));
            const t2 = wall(api, 2 + Math.floor(Math.random() * 2), 600, LOOK.void, api.dmg(70));
            return Math.max(t1, t2);
        },
        freeze(api) {
            api.say('🌌 THE VOID WATCHES – don\'t move');
            api.hz.add({ sh: 's', x: 0, y: 0, safe: [], blue: true, total: 1200, dur: 1400, dps: api.dmg(70), look: LOOK.blue }, api.now);
            return 2600;
        }
    }
};

module.exports = { createHazards, PATTERNS, LOOK, hits };
