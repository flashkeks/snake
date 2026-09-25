// Guild Houses und Stationen als richtige Objekte (25.09.2026, Max: „DEUTLICHE
// Grafikverbesserungen, vor allem die Gilden-Haeuser … nie so komische runde Dinger,
// sondern schoen ein Quest Board usw.").
// Alles prozedural auf dem Canvas, keine Bilddateien. Braucht rfx.js (rNoise, rPattern).
// Einstieg aus index.html: gGuildFloor (vor den Waenden), gWall / gDoor (statt der
// Standard-Wand/-Tuer im Guild House), gGuildTop (nach den Waenden: Fackeln, Banner,
// Schild), gStation (Quest Board, Lager, Versicherung, Haendler, Sani).

const G_T = 22;
const gIn = (g, x, y, m = 0) => x >= g[0] - m && y >= g[1] - m && x <= g[0] + g[2] + m && y <= g[1] + g[3] + m;
const gGuildAt = (m, x, y, mm = 0) => (m.guilds || []).find(g => gIn(g, x, y, mm));

function gRR(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
}
function gShadow(c, x, y, w, h, a = .35) {
    c.fillStyle = `rgba(0,0,0,${a})`;
    gRR(c, x + 6, y + 8, w, h, 6);
    c.fill();
}

// ---------- Boden ----------
function gPlankTile(g, S) {
    const cols = ['#6b4a2f', '#634329', '#72502f', '#5d3f27'];
    for (let r = 0; r < 4; r++) {
        const y = r * S / 4;
        let x = -((r * 37) % 60);
        let k = r;
        while (x < S) {
            const len = 90 + ((k * 53) % 70);
            g.fillStyle = cols[(k + r) % cols.length];
            g.fillRect(x, y, len, S / 4);
            // Maserung
            g.strokeStyle = 'rgba(40,24,12,.25)';
            g.lineWidth = 1;
            for (let q = 0; q < 3; q++) {
                g.beginPath();
                const yy = y + 5 + q * (S / 4 - 10) / 2 + rNoise(k, q) * 3;
                g.moveTo(x + 4, yy);
                g.bezierCurveTo(x + len * .3, yy + 2, x + len * .6, yy - 2, x + len - 4, yy + 1);
                g.stroke();
            }
            g.fillStyle = 'rgba(0,0,0,.45)';
            g.fillRect(x, y, 2, S / 4);
            g.fillStyle = 'rgba(30,18,8,.8)';
            g.fillRect(x + 6, y + S / 8 - 1.5, 3, 3);
            g.fillRect(x + len - 9, y + S / 8 - 1.5, 3, 3);
            x += len;
            k++;
        }
        g.fillStyle = 'rgba(0,0,0,.5)';
        g.fillRect(0, y, S, 2);
        g.fillStyle = 'rgba(255,220,170,.06)';
        g.fillRect(0, y + 2, S, 2);
    }
}
function gStoneTile(g, S) {
    g.fillStyle = '#3b3934';
    g.fillRect(0, 0, S, S);
    const n = 4, s = S / n;
    for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
        const v = 70 + Math.floor(rNoise(q * 3.1, r * 7.7) * 26);
        g.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
        g.fillRect(q * s + 2, r * s + 2, s - 4, s - 4);
        g.fillStyle = 'rgba(255,255,255,.06)';
        g.fillRect(q * s + 2, r * s + 2, s - 4, 3);
        g.fillStyle = 'rgba(0,0,0,.18)';
        g.fillRect(q * s + 2, r * s + s - 5, s - 4, 3);
    }
}

function gGuildFloor(c, g, now) {
    const [x, y, w, h] = g;
    // Steinrand, innen Dielen
    c.fillStyle = rPattern(c, 'g-stone', 128, gStoneTile);
    c.fillRect(x, y, w, h);
    const ix = x + 60, iy = y + 60, iw = w - 120, ih = h - 120;
    c.fillStyle = rPattern(c, 'g-plank', 256, gPlankTile);
    c.fillRect(ix, iy, iw, ih);
    c.strokeStyle = '#2a1a0e';
    c.lineWidth = 6;
    c.strokeRect(ix, iy, iw, ih);
    c.strokeStyle = 'rgba(210,170,90,.35)';
    c.lineWidth = 2;
    c.strokeRect(ix + 5, iy + 5, iw - 10, ih - 10);
    // Laeufer vom Tor unten bis zum Quest Board
    const cx = x + w / 2;
    gRug(c, cx - 95, y + 205, 190, h - 205 - G_T, '#7a1f2b', '#d8a84a');
    // Rundteppich unter dem Kamin
    const fy = y + h / 2 + 40;
    c.save();
    c.translate(cx, fy);
    c.fillStyle = '#233a5a';
    c.beginPath(); c.ellipse(0, 0, 190, 120, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#d8a84a'; c.lineWidth = 5;
    c.beginPath(); c.ellipse(0, 0, 176, 108, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(216,168,74,.55)'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, 0, 150, 90, 0, 0, Math.PI * 2); c.stroke();
    for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        c.fillStyle = k % 2 ? '#8a2b37' : '#d8a84a';
        c.beginPath(); c.arc(Math.cos(a) * 163, Math.sin(a) * 99, 5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    // Moebel am Boden (Kamin, Tische, Faesser, Regale)
    gHearth(c, cx, fy, now);
    for (const [tx, ty] of [[x + 250, y + h - 170], [x + w - 250, y + h - 170]]) gTable(c, tx, ty, now);
    gBarrels(c, x + 70, y + h - 90);
    gBarrels(c, x + w - 150, y + h - 90);
    gRack(c, x + 40, y + h / 2 + 110);
    gRack(c, x + w - 64, y + h / 2 + 110, true);
    gPlant(c, x + 80, y + h / 2 - 150);
    gPlant(c, x + w - 80, y + h / 2 - 150);
    gPlant(c, cx - 150, y + h - 60);
    gPlant(c, cx + 150, y + h - 60);
    // warmes Licht
    const lp = (lx, ly, r, a) => {
        const gr = c.createRadialGradient(lx, ly, 10, lx, ly, r);
        gr.addColorStop(0, `rgba(255,180,90,${a})`);
        gr.addColorStop(1, 'rgba(255,180,90,0)');
        c.fillStyle = gr;
        c.fillRect(lx - r, ly - r, r * 2, r * 2);
    };
    const fl = .8 + .2 * Math.sin(now / 90) * Math.sin(now / 37);
    lp(cx, fy, 330, .22 * fl);
    for (const [tx, ty] of gTorchSpots(g)) lp(tx, ty + 20, 170, .14 * (.85 + .15 * Math.sin(now / 70 + tx)));
}

function gRug(c, x, y, w, h, base, trim) {
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.fillRect(x + 4, y + 6, w, h);
    c.fillStyle = base;
    c.fillRect(x, y, w, h);
    c.strokeStyle = trim; c.lineWidth = 5;
    c.strokeRect(x + 10, y + 10, w - 20, h - 20);
    c.strokeStyle = 'rgba(216,168,74,.5)'; c.lineWidth = 2;
    c.strokeRect(x + 20, y + 20, w - 40, h - 40);
    c.fillStyle = 'rgba(216,168,74,.45)';
    for (let yy = y + 60; yy < y + h - 40; yy += 70) {
        c.beginPath();
        c.moveTo(x + w / 2, yy - 18); c.lineTo(x + w / 2 + 22, yy); c.lineTo(x + w / 2, yy + 18); c.lineTo(x + w / 2 - 22, yy);
        c.closePath(); c.fill();
    }
    // Fransen
    c.strokeStyle = '#e8d3a0'; c.lineWidth = 2;
    c.beginPath();
    for (let xx = x + 4; xx < x + w; xx += 8) { c.moveTo(xx, y); c.lineTo(xx, y - 7); }
    c.stroke();
}

function gHearth(c, x, y, now) {
    // Steinring
    c.fillStyle = 'rgba(0,0,0,.4)';
    c.beginPath(); c.arc(x + 5, y + 8, 50, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2, v = 95 + Math.floor(rNoise(k, 3) * 40);
        c.fillStyle = `rgb(${v},${v - 5},${v - 12})`;
        c.beginPath(); c.ellipse(x + Math.cos(a) * 40, y + Math.sin(a) * 40, 14, 11, a, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,.12)';
        c.beginPath(); c.ellipse(x + Math.cos(a) * 40 - 3, y + Math.sin(a) * 40 - 4, 6, 4, a, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#1b120c';
    c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.fill();
    // Holzscheite
    c.strokeStyle = '#4a2c16'; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - 20, y + 10); c.lineTo(x + 18, y - 8); c.moveTo(x - 18, y - 10); c.lineTo(x + 20, y + 8); c.stroke();
    c.lineCap = 'butt';
    // Glut
    const gr = c.createRadialGradient(x, y, 2, x, y, 30);
    gr.addColorStop(0, 'rgba(255,230,120,.95)');
    gr.addColorStop(.5, 'rgba(255,120,30,.6)');
    gr.addColorStop(1, 'rgba(255,60,0,0)');
    c.fillStyle = gr;
    c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.fill();
    // Flammen
    for (let k = 0; k < 7; k++) {
        const t = now / 160 + k * 1.7, fx = x + Math.sin(k * 2.3) * 12, hgt = 26 + 12 * Math.sin(t) + k % 3 * 5;
        c.fillStyle = k % 2 ? 'rgba(255,200,60,.85)' : 'rgba(255,110,20,.8)';
        c.beginPath();
        c.moveTo(fx - 8, y + 4);
        c.quadraticCurveTo(fx - 7 + Math.sin(t * 1.3) * 4, y - hgt * .5, fx + Math.sin(t) * 5, y - hgt);
        c.quadraticCurveTo(fx + 7 + Math.sin(t * 1.3) * 4, y - hgt * .5, fx + 8, y + 4);
        c.closePath(); c.fill();
    }
    // Funken
    for (let k = 0; k < 5; k++) {
        const p = ((now / 1400 + k / 5) % 1);
        c.fillStyle = `rgba(255,${180 + k * 10},80,${1 - p})`;
        c.fillRect(x + Math.sin(k * 7 + p * 6) * 14, y - 20 - p * 60, 2.5, 2.5);
    }
}

function gTable(c, x, y) {
    // Baenke
    for (const by of [y - 52, y + 40]) {
        gShadow(c, x - 85, by, 170, 14, .3);
        c.fillStyle = '#5a3a20'; c.fillRect(x - 85, by, 170, 14);
        c.fillStyle = 'rgba(255,220,170,.12)'; c.fillRect(x - 85, by, 170, 3);
    }
    gShadow(c, x - 100, y - 32, 200, 64, .4);
    c.fillStyle = '#7a5230';
    gRR(c, x - 100, y - 32, 200, 64, 6); c.fill();
    c.strokeStyle = 'rgba(40,22,10,.55)'; c.lineWidth = 1.5;
    c.beginPath();
    for (let yy = y - 16; yy < y + 32; yy += 16) { c.moveTo(x - 98, yy); c.lineTo(x + 98, yy); }
    c.stroke();
    c.fillStyle = 'rgba(255,220,170,.14)';
    c.fillRect(x - 100, y - 32, 200, 4);
    // Krueglein, Teller, Kerze
    const mug = (mx, my) => {
        c.fillStyle = '#b9b2a4'; c.beginPath(); c.arc(mx, my, 7, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e9b74a'; c.beginPath(); c.arc(mx, my, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(mx - 1, my - 1, 2.5, 0, Math.PI * 2); c.fill();
    };
    mug(x - 60, y - 10); mug(x + 55, y + 12); mug(x + 20, y - 14);
    c.fillStyle = '#d9d2c2'; c.beginPath(); c.arc(x - 25, y + 10, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#a0522d'; c.beginPath(); c.arc(x - 25, y + 10, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#efe6cf'; c.fillRect(x + 78, y - 6, 6, 10);
    c.fillStyle = '#ffd36a'; c.beginPath(); c.arc(x + 81, y - 9, 3, 0, Math.PI * 2); c.fill();
}

function gBarrel(c, x, y, r) {
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.arc(x + 4, y + 6, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6d4526';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#2d2b2a'; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, r - 2, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(x, y, r * .62, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(30,16,6,.5)'; c.lineWidth = 1;
    c.beginPath(); for (let k = -2; k <= 2; k++) { c.moveTo(x + k * r * .3, y - r * .55); c.lineTo(x + k * r * .3, y + r * .55); } c.stroke();
    c.fillStyle = 'rgba(255,220,170,.15)';
    c.beginPath(); c.arc(x - r * .3, y - r * .3, r * .3, 0, Math.PI * 2); c.fill();
}
function gBarrels(c, x, y) {
    gBarrel(c, x + 20, y + 20, 22);
    gBarrel(c, x + 62, y + 24, 20);
    gBarrel(c, x + 38, y - 16, 19);
    // Kiste daneben
    gCrate(c, x + 90, y - 30, 36);
}
function gCrate(c, x, y, s) {
    gShadow(c, x, y, s, s, .35);
    c.fillStyle = '#8a6036'; c.fillRect(x, y, s, s);
    c.strokeStyle = '#4a2f18'; c.lineWidth = 3; c.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
    c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + s - 3, y + s - 3); c.stroke();
    c.fillStyle = 'rgba(255,220,170,.15)'; c.fillRect(x, y, s, 3);
}
function gRack(c, x, y, flip) {
    // Waffenstaender an der Wand
    gShadow(c, x, y, 24, 120, .3);
    c.fillStyle = '#5a3a20'; c.fillRect(x, y, 24, 120);
    c.fillStyle = 'rgba(255,220,170,.12)'; c.fillRect(x, y, 24, 3);
    for (let k = 0; k < 3; k++) {
        const yy = y + 18 + k * 38;
        c.strokeStyle = '#9aa3ad'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(x + (flip ? 20 : 4), yy); c.lineTo(x + (flip ? -30 : 54), yy + 6); c.stroke();
        c.fillStyle = '#3b2616'; c.fillRect(x + (flip ? 14 : 2), yy - 4, 8, 10);
    }
}
function gPlant(c, x, y) {
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(x + 3, y + 5, 16, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8b4a2b'; c.beginPath(); c.arc(x, y, 15, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5f311c'; c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 + x;
        c.fillStyle = k % 2 ? '#3f8a46' : '#2e6e37';
        c.beginPath(); c.ellipse(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 12, 5, a, 0, Math.PI * 2); c.fill();
    }
}

// ---------- Mauern und Tore ----------
// Stein mit Fachwerk-Balken, Zinnen-Kante oben
function gWall(c, m, x, y, w, h) {
    const g = gGuildAt(m, x + w / 2, y + h / 2, 4);
    if (!g) return false;
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.fillRect(x + 8, y + 10, w, h);
    c.fillStyle = '#6f6a61';
    c.fillRect(x, y, w, h);
    const horiz = w >= h, L = horiz ? w : h, D = horiz ? h : w;
    // Quader
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    const bl = 34;
    for (let row = 0; row < 2; row++) for (let k = -1; k * bl < L; k++) {
        const off = row ? bl / 2 : 0, a = k * bl + off, v = 96 + Math.floor(rNoise(k + x, row + y) * 34);
        c.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
        if (horiz) c.fillRect(x + a + 1, y + row * D / 2 + 1, bl - 2, D / 2 - 2);
        else c.fillRect(x + row * D / 2 + 1, y + a + 1, D / 2 - 2, bl - 2);
    }
    // Balken alle 140 px
    c.fillStyle = '#4a2e18';
    for (let a = 60; a < L - 20; a += 140) {
        if (horiz) c.fillRect(x + a, y - 1, 12, h + 2);
        else c.fillRect(x - 1, y + a, w + 2, 12);
    }
    c.restore();
    // Kappe
    c.fillStyle = '#8d877c';
    if (horiz) c.fillRect(x, y, w, 5); else c.fillRect(x, y, 5, h);
    c.fillStyle = 'rgba(255,240,210,.22)';
    if (horiz) c.fillRect(x, y, w, 2); else c.fillRect(x, y, 2, h);
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    return true;
}

function gDoor(c, m, x, y, w, h, now) {
    const g = gGuildAt(m, x + w / 2, y + h / 2, 4);
    if (!g) return false;
    const horiz = w >= h;
    // Schwelle aus Stein
    c.fillStyle = '#8a8478'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(0,0,0,.25)';
    for (let a = 0; a < (horiz ? w : h); a += 30) horiz ? c.fillRect(x + a, y, 2, h) : c.fillRect(x, y + a, w, 2);
    // offene Torfluegel nach innen
    const leaf = (px, py, ang, len) => {
        c.save(); c.translate(px, py); c.rotate(ang);
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(4, 4, len, 12);
        c.fillStyle = '#6b4424'; c.fillRect(0, 0, len, 12);
        c.fillStyle = '#2f2f33'; c.fillRect(8, -1, 6, 14); c.fillRect(len - 14, -1, 6, 14);
        c.fillStyle = 'rgba(255,220,170,.15)'; c.fillRect(0, 0, len, 2);
        c.restore();
    };
    const cxg = g[0] + g[2] / 2, cyg = g[1] + g[3] / 2;
    if (horiz) {
        const inside = y + h / 2 < cyg ? 1 : -1, len = w / 2 - 4;
        leaf(x, y + (inside > 0 ? h : 0), inside * 1.25, len);
        leaf(x + w, y + (inside > 0 ? h : 0), Math.PI - inside * 1.25, len);
    } else {
        // Scharniere oben und unten an der Innenkante, Fluegel stehen schraeg in den Raum
        const inside = x + w / 2 < cxg ? 1 : -1, len = h / 2 - 8, hx = inside > 0 ? x + w : x;
        leaf(hx, y + 4, inside > 0 ? 0.55 : Math.PI - 0.55, len);
        leaf(hx, y + h - 4, inside > 0 ? -0.55 : Math.PI + 0.55, len);
    }
    // Pfosten mit Fackel-Halter
    c.fillStyle = '#4a2e18';
    if (horiz) { c.fillRect(x - 10, y - 6, 14, h + 12); c.fillRect(x + w - 4, y - 6, 14, h + 12); }
    else { c.fillRect(x - 6, y - 10, w + 12, 14); c.fillRect(x - 6, y + h - 4, w + 12, 14); }
    return true;
}

// Fackel-Plaetze an den Innenwaenden
function gTorchSpots(g) {
    const [x, y, w, h] = g;
    return [[x + 300, y + 30], [x + w - 300, y + 30], [x + 30, y + 170], [x + w - 30, y + 170], [x + 30, y + h - 150], [x + w - 30, y + h - 150], [x + w / 2 - 170, y + h - 30], [x + w / 2 + 170, y + h - 30]];
}

function gGuildTop(c, g, now) {
    const [x, y, w, h] = g;
    // Banner an der Rueckwand
    for (const bx of [x + 190, x + w / 2 - 250, x + w / 2 + 250, x + w - 190]) gBanner(c, bx, y + G_T, now);
    for (const [tx, ty] of gTorchSpots(g)) gTorch(c, tx, ty, now);
    // Schild ueber dem Tor unten (aussen)
    gSign(c, x + w / 2, y + h + 34, '🏰 GUILD HOUSE', '#f3d38a', 1.3);
}

function gBanner(c, x, y, now) {
    const sw = Math.sin(now / 700 + x) * 2;
    c.fillStyle = '#3b2616'; c.fillRect(x - 30, y - 4, 60, 6);
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath(); c.moveTo(x - 22, y + 4); c.lineTo(x + 26, y + 4); c.lineTo(x + 26, y + 78); c.lineTo(x + 2, y + 64 + sw); c.lineTo(x - 22, y + 78); c.closePath(); c.fill();
    c.fillStyle = '#8a1f2d';
    c.beginPath(); c.moveTo(x - 24, y); c.lineTo(x + 24, y); c.lineTo(x + 24, y + 72); c.lineTo(x, y + 58 + sw); c.lineTo(x - 24, y + 72); c.closePath(); c.fill();
    c.strokeStyle = '#d8a84a'; c.lineWidth = 3; c.stroke();
    // Wappen: Keks
    c.fillStyle = '#d8a84a'; c.beginPath(); c.arc(x, y + 28, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a3016';
    for (const [dx, dy] of [[-4, -4], [4, -2], [-2, 5], [5, 5]]) { c.beginPath(); c.arc(x + dx, y + 28 + dy, 2.2, 0, Math.PI * 2); c.fill(); }
}

function gTorch(c, x, y, now) {
    c.fillStyle = '#2f2f33'; c.fillRect(x - 5, y - 5, 10, 10);
    c.fillStyle = '#5a3a20'; c.fillRect(x - 3, y - 2, 6, 16);
    const f = Math.sin(now / 60 + x) * 2;
    const gr = c.createRadialGradient(x, y - 6, 1, x, y - 6, 26);
    gr.addColorStop(0, 'rgba(255,220,120,.9)');
    gr.addColorStop(1, 'rgba(255,120,20,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y - 6, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffb02e';
    c.beginPath(); c.moveTo(x - 5, y - 2); c.quadraticCurveTo(x + f, y - 22, x + 5, y - 2); c.closePath(); c.fill();
    c.fillStyle = '#fff1a8';
    c.beginPath(); c.moveTo(x - 2, y - 2); c.quadraticCurveTo(x + f * .5, y - 13, x + 2, y - 2); c.closePath(); c.fill();
}

// Holzschild mit Schrift
function gSign(c, x, y, text, col = '#f3d38a', k = 1) {
    c.save();
    c.font = `bold ${Math.round(13 * k)}px system-ui`;
    const tw = c.measureText(text).width + 22 * k, th = 24 * k;
    c.fillStyle = 'rgba(0,0,0,.4)'; gRR(c, x - tw / 2 + 3, y - th / 2 + 4, tw, th, 5 * k); c.fill();
    const gr = c.createLinearGradient(0, y - th / 2, 0, y + th / 2);
    gr.addColorStop(0, '#6e4727'); gr.addColorStop(1, '#4a2e18');
    c.fillStyle = gr; gRR(c, x - tw / 2, y - th / 2, tw, th, 5 * k); c.fill();
    c.strokeStyle = '#2a190c'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#9aa3ad';
    c.beginPath(); c.arc(x - tw / 2 + 6 * k, y, 2 * k, 0, Math.PI * 2); c.arc(x + tw / 2 - 6 * k, y, 2 * k, 0, Math.PI * 2); c.fill();
    c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, x, y + 1);
    c.restore();
}

// ---------- Stationen ----------
// near: Spieler steht nah dran (Umriss leuchtet)
function gStation(c, s, L, now, near) {
    const f = G_ST[s.kind];
    if (!f) return false;
    f(c, s, now, near);
    gSign(c, s.x, s.y + (G_SIGN_Y[s.kind] || 60), G_SIGN_TXT[s.kind] || L.label, near ? '#fff2b8' : '#f3d38a');
    return true;
}
const G_SIGN_TXT = { missions: 'QUEST BOARD', stash: 'GUILD STASH', insure: 'INSURANCE', trader: 'TRADER' };
const G_SIGN_Y = { missions: 72, stash: 58, insure: 66, trader: 70, medic: 64 };

function gGlow(c, x, y, r, rgb, now) {
    const a = .18 + .1 * Math.sin(now / 300);
    const gr = c.createRadialGradient(x, y, 4, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
}

const G_ST = {
    // Quest Board: Holztafel auf zwei Pfosten mit Dach, angepinnte Zettel
    missions(c, s, now, near) {
        const x = s.x, y = s.y - 20, w = 190, h = 104;
        if (near) gGlow(c, x, y, 150, '255,200,90', now);
        gShadow(c, x - w / 2, y - h / 2, w, h + 20, .4);
        // Pfosten
        c.fillStyle = '#3f2614';
        c.fillRect(x - w / 2 - 6, y - h / 2 - 10, 14, h + 36);
        c.fillRect(x + w / 2 - 8, y - h / 2 - 10, 14, h + 36);
        // Tafel
        c.fillStyle = '#7a5230'; gRR(c, x - w / 2, y - h / 2, w, h, 4); c.fill();
        c.strokeStyle = '#3f2614'; c.lineWidth = 5; c.stroke();
        c.strokeStyle = 'rgba(40,22,10,.4)'; c.lineWidth = 1;
        c.beginPath(); for (let yy = y - h / 2 + 20; yy < y + h / 2; yy += 20) { c.moveTo(x - w / 2 + 3, yy); c.lineTo(x + w / 2 - 3, yy); } c.stroke();
        // Dach
        c.fillStyle = '#5a2a1c';
        c.beginPath(); c.moveTo(x - w / 2 - 20, y - h / 2 - 6); c.lineTo(x, y - h / 2 - 34); c.lineTo(x + w / 2 + 20, y - h / 2 - 6); c.closePath(); c.fill();
        c.strokeStyle = '#2f140c'; c.lineWidth = 3; c.stroke();
        // Zettel
        const notes = [[-68, -24, -.12, '#efe0bb'], [-22, -30, .06, '#f3e7c6'], [26, -22, -.05, '#e9d6a8'], [66, -28, .1, '#f0e2bd'], [-50, 18, .08, '#f3e7c6'], [4, 16, -.1, '#efe0bb'], [54, 20, .04, '#e5cf9c']];
        notes.forEach(([dx, dy, a, col], k) => {
            const wob = near ? Math.sin(now / 220 + k) * .03 : 0;
            c.save(); c.translate(x + dx, y + dy); c.rotate(a + wob);
            c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-15, -17, 32, 38);
            c.fillStyle = col; c.fillRect(-17, -19, 32, 38);
            c.fillStyle = 'rgba(80,50,20,.55)';
            for (let l = 0; l < 4; l++) c.fillRect(-12, -9 + l * 7, l === 3 ? 12 : 22, 2);
            if (k === 1 || k === 5) { c.fillStyle = '#a3262f'; c.beginPath(); c.arc(8, 11, 5, 0, Math.PI * 2); c.fill(); }
            c.fillStyle = ['#d23c3c', '#3c78d2', '#e0b030'][k % 3];
            c.beginPath(); c.arc(-1, -15, 3.2, 0, Math.PI * 2); c.fill();
            c.restore();
        });
        // Laterne
        gTorch(c, x + w / 2 + 24, y - h / 2 + 4, now);
    },
    // Lager: Truhen vor einer Schrankwand
    stash(c, s, now, near) {
        const x = s.x, y = s.y;
        if (near) gGlow(c, x, y, 140, '120,190,255', now);
        // Schrankwand dahinter
        gShadow(c, x - 95, y - 88, 190, 42, .35);
        c.fillStyle = '#4a3222'; c.fillRect(x - 95, y - 88, 190, 42);
        for (let k = 0; k < 4; k++) {
            c.fillStyle = '#5d4130'; c.fillRect(x - 91 + k * 47, y - 84, 43, 34);
            c.fillStyle = '#c9a55a'; c.fillRect(x - 72 + k * 47, y - 70, 5, 6);
        }
        const chest = (cx, cy, open) => {
            gShadow(c, cx - 30, cy - 18, 60, 40, .4);
            c.fillStyle = '#7a4c28'; gRR(c, cx - 30, cy - 18, 60, 40, 5); c.fill();
            c.fillStyle = '#6a3f20'; c.fillRect(cx - 30, cy - 18, 60, 14);
            c.fillStyle = '#3b3a3d';
            c.fillRect(cx - 30, cy - 5, 60, 4); c.fillRect(cx - 22, cy - 18, 5, 40); c.fillRect(cx + 17, cy - 18, 5, 40);
            c.fillStyle = '#d8b04a'; c.fillRect(cx - 5, cy - 6, 10, 10);
            c.fillStyle = '#3b2616'; c.fillRect(cx - 1.5, cy - 3, 3, 4);
            if (open) {
                const gr = c.createRadialGradient(cx, cy - 18, 2, cx, cy - 18, 40);
                gr.addColorStop(0, 'rgba(255,230,120,.7)'); gr.addColorStop(1, 'rgba(255,230,120,0)');
                c.fillStyle = gr; c.fillRect(cx - 40, cy - 58, 80, 60);
            }
        };
        chest(x - 64, y, false);
        chest(x, y + 4, near);
        chest(x + 64, y, false);
    },
    // Versicherung: Tresen mit Schreiber, Wappen-Schild
    insure(c, s, now, near) {
        const x = s.x, y = s.y;
        if (near) gGlow(c, x, y, 140, '140,255,170', now);
        // Schreiber hinter dem Tresen
        c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(x + 4, y - 40, 20, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2e4a7a'; c.beginPath(); c.arc(x, y - 44, 20, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e8c39e'; c.beginPath(); c.arc(x, y - 50, 11, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#4a2e18'; c.beginPath(); c.arc(x, y - 54, 9, Math.PI, 0); c.fill();
        c.strokeStyle = '#111'; c.lineWidth = 1.5; c.beginPath(); c.arc(x - 4, y - 49, 3, 0, Math.PI * 2); c.arc(x + 4, y - 49, 3, 0, Math.PI * 2); c.stroke();
        // Tresen
        gShadow(c, x - 90, y - 26, 180, 40, .4);
        const gr = c.createLinearGradient(0, y - 26, 0, y + 14);
        gr.addColorStop(0, '#8a5d34'); gr.addColorStop(1, '#5d3c20');
        c.fillStyle = gr; gRR(c, x - 90, y - 26, 180, 40, 5); c.fill();
        c.strokeStyle = '#2f1a0c'; c.lineWidth = 3; c.stroke();
        c.fillStyle = 'rgba(255,220,170,.18)'; c.fillRect(x - 88, y - 25, 176, 4);
        // Buch, Feder, Stempel
        c.fillStyle = '#6b1e24'; c.fillRect(x - 60, y - 20, 42, 26);
        c.fillStyle = '#f1e6c8'; c.fillRect(x - 57, y - 18, 17, 22); c.fillRect(x - 38, y - 18, 17, 22);
        c.strokeStyle = '#eee'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 30, y - 16); c.lineTo(x - 14, y - 34); c.stroke();
        c.fillStyle = '#3b3a3d'; c.fillRect(x + 28, y - 18, 16, 12); c.fillStyle = '#b82a2a'; c.fillRect(x + 30, y - 8, 12, 5);
        // Schild-Wappen
        const sx = x + 60, sy = y - 58;
        c.fillStyle = 'rgba(0,0,0,.35)';
        c.beginPath(); c.moveTo(sx - 18, sy - 18); c.lineTo(sx + 22, sy - 18); c.lineTo(sx + 22, sy + 4); c.quadraticCurveTo(sx + 22, sy + 22, sx + 2, sy + 30); c.quadraticCurveTo(sx - 18, sy + 22, sx - 18, sy + 4); c.closePath(); c.fill();
        c.fillStyle = '#2f8a5a';
        c.beginPath(); c.moveTo(sx - 20, sy - 20); c.lineTo(sx + 20, sy - 20); c.lineTo(sx + 20, sy + 2); c.quadraticCurveTo(sx + 20, sy + 20, sx, sy + 28); c.quadraticCurveTo(sx - 20, sy + 20, sx - 20, sy + 2); c.closePath(); c.fill();
        c.strokeStyle = '#d8a84a'; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#d8a84a'; c.font = 'bold 18px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✓', sx, sy + 2);
    },
    // Haendler: Marktstand mit gestreifter Markise
    trader(c, s, now, near) {
        const x = s.x, y = s.y;
        if (near) gGlow(c, x, y, 150, '255,210,63', now);
        gShadow(c, x - 80, y - 30, 160, 50, .35);
        c.fillStyle = '#7a5230'; c.fillRect(x - 80, y - 30, 160, 44);
        c.strokeStyle = '#3f2614'; c.lineWidth = 3; c.strokeRect(x - 80, y - 30, 160, 44);
        // Ware
        const good = (gx, gy, col) => { c.fillStyle = col; c.beginPath(); c.arc(gx, gy, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(gx - 2, gy - 2, 2.5, 0, Math.PI * 2); c.fill(); };
        [[-60, -12, '#d23c3c'], [-45, -4, '#e0b030'], [-30, -14, '#3c9c4a'], [-10, -6, '#9aa3ad'], [10, -12, '#3c78d2'], [30, -4, '#d23c3c'], [52, -12, '#e0b030']].forEach(([dx, dy, col]) => good(x + dx, y + dy, col));
        gCrate(c, x + 88, y - 22, 30);
        // Markise
        const aw = y - 74;
        for (let k = 0; k < 8; k++) {
            c.fillStyle = k % 2 ? '#f1e6c8' : '#c0392b';
            c.beginPath(); c.moveTo(x - 96 + k * 24, aw); c.lineTo(x - 72 + k * 24, aw); c.lineTo(x - 72 + k * 24, aw + 30); c.quadraticCurveTo(x - 84 + k * 24, aw + 40, x - 96 + k * 24, aw + 30); c.closePath(); c.fill();
        }
        c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.strokeRect(x - 96, aw, 192, 30);
        c.fillStyle = '#3f2614'; c.fillRect(x - 98, aw - 2, 6, 78); c.fillRect(x + 92, aw - 2, 6, 78);
    },
    // Sani: Feldbett unter Zeltplane, rotes Kreuz
    medic(c, s, now, near) {
        const x = s.x, y = s.y;
        if (near) gGlow(c, x, y, 140, '0,214,122', now);
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x - 76, y - 60, 160, 90);
        c.fillStyle = '#d9d6cb'; c.fillRect(x - 80, y - 64, 160, 90);
        c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(x, y - 64, 80, 90);
        c.strokeStyle = '#8b887d'; c.lineWidth = 2; c.strokeRect(x - 80, y - 64, 160, 90);
        c.beginPath(); c.moveTo(x, y - 64); c.lineTo(x, y + 26); c.stroke();
        // Kreuz
        c.fillStyle = '#d23c3c'; c.fillRect(x - 10, y - 50, 20, 56); c.fillRect(x - 28, y - 32, 56, 20);
        // Liege und Koffer
        c.fillStyle = '#3d5a3a'; c.fillRect(x - 70, y + 30, 90, 22);
        c.fillStyle = '#e8e4d8'; c.fillRect(x - 68, y + 32, 22, 18);
        c.fillStyle = '#b82a2a'; gRR(c, x + 34, y + 30, 34, 24, 4); c.fill();
        c.fillStyle = '#fff'; c.fillRect(x + 48, y + 34, 6, 16); c.fillRect(x + 43, y + 39, 16, 6);
    }
};
