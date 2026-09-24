// Raid-Optik (6.12, Max): Boden oben nicht mehr nur grau, Untergrund
// (Militaerstuetzpunkt, Labor), neue Figuren fuer alle Raid-Gegner.
// Alles prozedural auf dem Canvas, keine Bilddateien.

function rHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return ((h >>> 0) % 10000) / 10000;
}
const rNoise = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
};

// Ebene an einer Stelle (Karten ohne Ebenen: die ganze Map)
function rRegion(m, x, y) {
    const g = (m.regions || []).find(q => x >= q.x && y >= q.y && x <= q.x + q.w && y <= q.y + q.h);
    return g || { id: 'surface', x: 0, y: 0, w: m.w, h: m.h, level: 0 };
}

// ---------- Boden ----------
const rPat = {};
function rTile(key, size, draw) {
    if (rPat[key]) return rPat[key];
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    draw(cv.getContext('2d'), size);
    rPat[key] = cv;
    return cv;
}
function rPattern(c, key, size, draw) {
    const cv = rTile(key, size, draw);
    if (!cv._p || cv._c !== c) { cv._p = c.createPattern(cv, 'repeat'); cv._c = c; }
    return cv._p;
}

// Oberflaeche: Wiese mit Erdflecken, Kies und Grasbueschel
function rGrassTile(g, S) {
    g.fillStyle = '#1c2a1d';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
        const x = rNoise(i, 1) * S, y = rNoise(i, 2) * S, v = rNoise(i, 3);
        g.fillStyle = v < .5 ? `rgba(46,78,44,${.25 + v * .4})` : v < .8 ? `rgba(28,52,30,${.35})` : 'rgba(70,96,52,.35)';
        g.fillRect(x, y, 2 + v * 3, 2 + v * 3);
    }
    g.strokeStyle = 'rgba(96,140,72,.35)';
    g.lineWidth = 1;
    for (let i = 0; i < 160; i++) {
        const x = rNoise(i, 7) * S, y = rNoise(i, 8) * S;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rNoise(i, 9) - .5) * 5, y - 5 - rNoise(i, 10) * 5);
        g.stroke();
    }
}
function rConcreteTile(g, S) {
    g.fillStyle = '#23262b';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 1400; i++) {
        const v = rNoise(i, 21);
        g.fillStyle = `rgba(${v < .5 ? '255,255,255' : '0,0,0'},${.03 + v * .04})`;
        g.fillRect(rNoise(i, 22) * S, rNoise(i, 23) * S, 2, 2);
    }
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255,255,255,.04)';
    g.lineWidth = 1;
    g.strokeRect(3, 3, S - 6, S - 6);
    // Risse
    g.strokeStyle = 'rgba(0,0,0,.4)';
    g.beginPath();
    let x = S * .2, y = S * .7;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += 12 + rNoise(k, 31) * 10; y -= rNoise(k, 32) * 14 - 4; g.lineTo(x, y); }
    g.stroke();
}
function rLabTile(g, S) {
    g.fillStyle = '#16211f';
    g.fillRect(0, 0, S, S);
    const h = S / 2;
    for (let i = 0; i < 4; i++) {
        const x = (i % 2) * h, y = Math.floor(i / 2) * h;
        g.fillStyle = (i === 0 || i === 3) ? '#1b2826' : '#18231f';
        g.fillRect(x + 2, y + 2, h - 4, h - 4);
    }
    g.strokeStyle = 'rgba(80,255,200,.10)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, S - 2, S - 2);
    for (let i = 0; i < 300; i++) {
        g.fillStyle = `rgba(160,255,220,${rNoise(i, 41) * .04})`;
        g.fillRect(rNoise(i, 42) * S, rNoise(i, 43) * S, 2, 2);
    }
}

function rFloor(c, m, g, cam, vw, vh, now) {
    const x0 = Math.max(g.x, cam.x), y0 = Math.max(g.y, cam.y);
    const x1 = Math.min(g.x + g.w, cam.x + vw), y1 = Math.min(g.y + g.h, cam.y + vh);
    if (x1 <= x0 || y1 <= y0) return;
    if (g.id === 'bunker') {
        c.fillStyle = rPattern(c, 'concrete', 160, rConcreteTile);
        c.fillRect(x0, y0, x1 - x0, y1 - y0);
        // Warnstreifen am Rand
        c.save();
        c.beginPath();
        c.rect(g.x, g.y, g.w, g.h);
        c.rect(g.x + 34, g.y + 34, g.w - 68, g.h - 68);
        c.clip('evenodd');
        for (let k = -g.h; k < g.w + g.h; k += 60) {
            c.fillStyle = '#d8a820';
            c.beginPath();
            c.moveTo(g.x + k, g.y);
            c.lineTo(g.x + k + 30, g.y);
            c.lineTo(g.x + k + 30 + g.h, g.y + g.h);
            c.lineTo(g.x + k + g.h, g.y + g.h);
            c.fill();
        }
        c.restore();
        c.fillStyle = 'rgba(12,12,14,.35)';
        c.fillRect(x0, y0, x1 - x0, y1 - y0);
        return;
    }
    if (g.id === 'lab') {
        c.fillStyle = rPattern(c, 'labtile', 120, rLabTile);
        c.fillRect(x0, y0, x1 - x0, y1 - y0);
        // pulsierende Leitungen im Boden
        const p = .5 + .5 * Math.sin(now / 700);
        c.strokeStyle = `rgba(60,255,170,${.10 + .08 * p})`;
        c.lineWidth = 6;
        for (let y = g.y + 240; y < g.y + g.h; y += 480) {
            if (y < y0 - 10 || y > y1 + 10) continue;
            c.beginPath();
            c.moveTo(x0, y);
            c.lineTo(x1, y);
            c.stroke();
        }
        return;
    }
    // Oberflaeche
    c.fillStyle = rPattern(c, 'grass', 256, rGrassTile);
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Erdflecken und Pfuetzen je 400er Zelle (fest pro Zelle)
    const C = 400;
    for (let cx = Math.floor(x0 / C); cx <= Math.floor(x1 / C); cx++) {
        for (let cy = Math.floor(y0 / C); cy <= Math.floor(y1 / C); cy++) {
            const v = rNoise(cx, cy);
            if (v > .55) {
                const x = cx * C + rNoise(cx, cy + 9) * C, y = cy * C + rNoise(cx + 9, cy) * C, r = 60 + v * 120;
                const gr = c.createRadialGradient(x, y, r * .2, x, y, r);
                gr.addColorStop(0, v > .9 ? 'rgba(40,58,70,.55)' : 'rgba(74,58,36,.55)');
                gr.addColorStop(1, 'rgba(74,58,36,0)');
                c.fillStyle = gr;
                c.beginPath();
                c.ellipse(x, y, r, r * (.6 + rNoise(cx, cy + 3) * .4), rNoise(cy, cx) * 3, 0, Math.PI * 2);
                c.fill();
            } else if (v < .12) {
                // Blumen
                for (let k = 0; k < 7; k++) {
                    const x = cx * C + rNoise(cx * 7 + k, cy) * C, y = cy * C + rNoise(cx, cy * 7 + k) * C;
                    c.fillStyle = ['#e8d86a', '#f0f0f0', '#d88ad8'][k % 3];
                    c.fillRect(x, y, 3, 3);
                }
            }
        }
    }
}

// Gebaeude-Boden oben (Holzdielen) – ueber dem Gras, unter den Waenden
function rBuildingFloor(c, x, y, w, h) {
    c.fillStyle = '#3a2d22';
    c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(0,0,0,.28)';
    c.lineWidth = 2;
    c.beginPath();
    for (let yy = y + 22; yy < y + h; yy += 22) { c.moveTo(x, yy); c.lineTo(x + w, yy); }
    c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.18)';
    c.beginPath();
    for (let yy = y, r = 0; yy < y + h; yy += 22, r++) {
        for (let xx = x + ((r * 37) % 90); xx < x + w; xx += 90) { c.moveTo(xx, yy); c.lineTo(xx, Math.min(y + h, yy + 22)); }
    }
    c.stroke();
}

// ---------- Waende ----------
function rWall(c, g, x, y, w, h) {
    if (g.id === 'bunker') {
        c.fillStyle = 'rgba(0,0,0,.45)';
        c.fillRect(x + 7, y + 7, w, h);
        c.fillStyle = '#4a4d52';
        c.fillRect(x, y, w, h);
        c.fillStyle = '#5e6268';
        c.fillRect(x, y, w, 5);
        c.fillStyle = 'rgba(0,0,0,.35)';
        const step = 46;
        if (w > h) for (let xx = x + 12; xx < x + w - 6; xx += step) c.fillRect(xx, y + h / 2 - 2, 4, 4);
        else for (let yy = y + 12; yy < y + h - 6; yy += step) c.fillRect(x + w / 2 - 2, yy, 4, 4);
        return true;
    }
    if (g.id === 'lab') {
        // DNA-Tanks (68 × 68) sind Waende, gemalt werden sie als Deko (rTank)
        if (w === 68 && h === 68) return true;
        c.fillStyle = 'rgba(0,0,0,.4)';
        c.fillRect(x + 6, y + 6, w, h);
        c.fillStyle = '#c9d6d3';
        c.fillRect(x, y, w, h);
        c.fillStyle = '#29c6a0';
        if (w > h) c.fillRect(x, y + h / 2 - 2, w, 4);
        else c.fillRect(x + w / 2 - 2, y, 4, h);
        c.fillStyle = 'rgba(255,255,255,.5)';
        c.fillRect(x, y, w, 3);
        return true;
    }
    // Oberflaeche: kleine Bloecke = Felsen, lange = Mauern (Ziegel)
    if (w < 150 && h < 150 && w > 40 && h > 40) {
        const cx = x + w / 2, cy = y + h / 2, n = 9, sd = rNoise(x, y);
        c.fillStyle = 'rgba(0,0,0,.35)';
        c.beginPath();
        c.ellipse(cx + 7, cy + 9, w / 2, h / 2, 0, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        for (let k = 0; k < n; k++) {
            const a = k / n * Math.PI * 2, rr = .86 + rNoise(k, sd * 100) * .18;
            const px = cx + Math.cos(a) * w / 2 * rr, py = cy + Math.sin(a) * h / 2 * rr;
            k ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath();
        const gr = c.createLinearGradient(x, y, x + w, y + h);
        gr.addColorStop(0, '#8a8f88');
        gr.addColorStop(1, '#4b504d');
        c.fillStyle = gr;
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,.35)';
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = 'rgba(92,120,70,.55)';
        c.beginPath();
        c.ellipse(cx - w * .12, cy - h * .18, w * .18, h * .1, -.4, 0, Math.PI * 2);
        c.fill();
        return true;
    }
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.fillRect(x + 6, y + 6, w, h);
    c.fillStyle = '#7a4a36';
    c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(40,20,14,.55)';
    c.lineWidth = 1.5;
    c.beginPath();
    if (w >= h) {
        for (let yy = y + 11; yy < y + h; yy += 11) { c.moveTo(x, yy); c.lineTo(x + w, yy); }
        for (let yy = y, r = 0; yy < y + h; yy += 11, r++) for (let xx = x + (r % 2 ? 14 : 0); xx < x + w; xx += 28) { c.moveTo(xx, yy); c.lineTo(xx, Math.min(y + h, yy + 11)); }
    } else {
        for (let xx = x + 11; xx < x + w; xx += 11) { c.moveTo(xx, y); c.lineTo(xx, y + h); }
        for (let xx = x, r = 0; xx < x + w; xx += 11, r++) for (let yy = y + (r % 2 ? 14 : 0); yy < y + h; yy += 28) { c.moveTo(xx, yy); c.lineTo(Math.min(x + w, xx + 11), yy); }
    }
    c.stroke();
    c.fillStyle = 'rgba(255,220,190,.18)';
    c.fillRect(x, y, w, 3);
    return true;
}

// ---------- Deko im Untergrund ----------
function rDeco(c, m, cam, vw, vh, now) {
    for (const d of m.deco || []) {
        const [x, y, kind, w, h] = d;
        if (x < cam.x - 200 || x > cam.x + vw + 200 || y < cam.y - 200 || y > cam.y + vh + 200) continue;
        const p = .5 + .5 * Math.sin(now / 400 + x * .01 + y * .013);
        if (kind === 'sandbag') {
            c.fillStyle = 'rgba(0,0,0,.35)';
            c.fillRect(x + 5, y + 6, w, h);
            const horiz = w >= h, n = Math.max(2, Math.round((horiz ? w : h) / 34));
            for (let k = 0; k < n; k++) {
                const bx = horiz ? x + k * w / n : x, by = horiz ? y : y + k * h / n, bw = horiz ? w / n : w, bh = horiz ? h : h / n;
                c.fillStyle = k % 2 ? '#7b6e4a' : '#8a7c54';
                c.beginPath();
                c.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
                c.fill();
                c.strokeStyle = 'rgba(0,0,0,.3)';
                c.lineWidth = 1.5;
                c.stroke();
            }
        } else if (kind === 'lamp' || kind === 'lablight') {
            const col = kind === 'lamp' ? '255,196,110' : '90,255,200';
            const flick = kind === 'lamp' && rNoise(Math.floor(now / 120), x) < .06 ? .2 : 1;
            const gr = c.createRadialGradient(x, y, 4, x, y, 170);
            gr.addColorStop(0, `rgba(${col},${.22 * flick})`);
            gr.addColorStop(1, `rgba(${col},0)`);
            c.fillStyle = gr;
            c.beginPath();
            c.arc(x, y, 170, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = `rgba(${col},${.9 * flick})`;
            c.beginPath();
            c.arc(x, y, 5, 0, Math.PI * 2);
            c.fill();
        } else if (kind === 'bunk') {
            c.fillStyle = '#3d4a3a';
            c.fillRect(x - 40, y - 16, 80, 32);
            c.fillStyle = '#6d7a62';
            c.fillRect(x - 36, y - 12, 72, 24);
            c.fillStyle = '#c9c1a8';
            c.fillRect(x - 36, y - 12, 18, 24);
        } else if (kind === 'barrels') {
            for (const [dx, dy] of [[-14, -8], [12, -10], [0, 12]]) {
                c.fillStyle = '#2f5d3a';
                c.beginPath();
                c.arc(x + dx, y + dy, 13, 0, Math.PI * 2);
                c.fill();
                c.strokeStyle = '#1b2f20';
                c.lineWidth = 2;
                c.stroke();
                c.fillStyle = '#d8a820';
                c.fillRect(x + dx - 3, y + dy - 3, 6, 6);
            }
        } else if (kind === 'radio') {
            c.fillStyle = '#2c3328';
            c.fillRect(x - 22, y - 14, 44, 28);
            c.fillStyle = `rgba(120,255,120,${.4 + .5 * p})`;
            c.fillRect(x - 16, y - 8, 14, 8);
            c.strokeStyle = '#555';
            c.beginPath();
            c.moveTo(x + 14, y - 14);
            c.lineTo(x + 24, y - 34);
            c.stroke();
        } else if (kind === 'stain') {
            c.fillStyle = 'rgba(10,10,12,.45)';
            c.beginPath();
            c.ellipse(x, y, 48, 30, x % 3, 0, Math.PI * 2);
            c.fill();
        } else if (kind === 'goo') {
            c.fillStyle = `rgba(80,255,120,${.14 + .06 * p})`;
            c.beginPath();
            c.ellipse(x, y, 46, 28, y % 3, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = 'rgba(160,255,160,.25)';
            c.beginPath();
            c.arc(x - 10, y - 4, 4 + p * 2, 0, Math.PI * 2);
            c.fill();
        } else if (kind === 'papers') {
            for (let k = 0; k < 4; k++) {
                c.save();
                c.translate(x + (rNoise(k, x) - .5) * 40, y + (rNoise(y, k) - .5) * 30);
                c.rotate(rNoise(k, y) * 3);
                c.fillStyle = 'rgba(220,226,220,.7)';
                c.fillRect(-8, -11, 16, 22);
                c.restore();
            }
        } else if (kind === 'claw') {
            c.strokeStyle = 'rgba(0,0,0,.55)';
            c.lineWidth = 3;
            for (let k = 0; k < 3; k++) {
                c.beginPath();
                c.moveTo(x - 20 + k * 10, y - 22);
                c.lineTo(x - 6 + k * 10, y + 22);
                c.stroke();
            }
        } else if (kind === 'console' || kind === 'cryo') {
            c.fillStyle = 'rgba(0,0,0,.35)';
            c.fillRect(x + 5, y + 6, w, h);
            c.fillStyle = kind === 'console' ? '#2b3236' : '#b8c6c6';
            c.fillRect(x, y, w, h);
            if (kind === 'console') {
                for (let k = 0; k < 3; k++) {
                    const on = rNoise(Math.floor(now / 300) + k, x) > .25;
                    c.fillStyle = on ? `rgba(80,255,190,${.55 + .3 * p})` : 'rgba(40,60,60,.9)';
                    c.fillRect(x + 8 + k * 34, y + 8, 26, 16);
                }
                c.fillStyle = '#ff4f4f';
                c.fillRect(x + w - 12, y + h - 10, 5, 5);
            } else {
                c.fillStyle = 'rgba(160,230,255,.55)';
                c.fillRect(x + 8, y + 7, w - 16, h - 14);
                c.fillStyle = 'rgba(40,60,70,.6)';
                c.beginPath();
                c.ellipse(x + w / 2, y + h / 2, w * .3, h * .22, 0, 0, Math.PI * 2);
                c.fill();
            }
        } else if (kind === 'tank' || kind === 'tankb') {
            rTank(c, x, y, kind === 'tankb', now);
        }
    }
}

// DNA-Tank: Glaszylinder mit gruener Fluessigkeit, Blasen, Umriss eines Wesens
function rTank(c, x, y, broken, now) {
    const R = 40;
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.beginPath();
    c.arc(x + 6, y + 8, R + 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#39443f';
    c.beginPath();
    c.arc(x, y, R + 4, 0, Math.PI * 2);
    c.fill();
    if (broken) {
        c.fillStyle = 'rgba(20,40,30,.9)';
        c.beginPath();
        c.arc(x, y, R - 2, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(200,255,240,.7)';
        c.lineWidth = 2;
        for (let k = 0; k < 7; k++) {
            const a = k / 7 * Math.PI * 2 + .3;
            c.beginPath();
            c.moveTo(x + Math.cos(a) * (R - 2), y + Math.sin(a) * (R - 2));
            c.lineTo(x + Math.cos(a + .2) * (R - 14 - (k % 3) * 5), y + Math.sin(a + .2) * (R - 14 - (k % 3) * 5));
            c.stroke();
        }
        c.fillStyle = 'rgba(80,255,120,.22)';
        c.beginPath();
        c.ellipse(x + 30, y + 44, 60, 24, .3, 0, Math.PI * 2);
        c.fill();
        return;
    }
    const lv = .5 + .5 * Math.sin(now / 900 + x);
    const gr = c.createRadialGradient(x - 10, y - 12, 4, x, y, R);
    gr.addColorStop(0, `rgba(150,255,190,${.85})`);
    gr.addColorStop(1, `rgba(20,160,90,${.75 + .1 * lv})`);
    c.fillStyle = gr;
    c.beginPath();
    c.arc(x, y, R - 2, 0, Math.PI * 2);
    c.fill();
    // Wesen im Tank (dunkler Umriss) und DNA-Spirale
    c.fillStyle = 'rgba(10,40,24,.55)';
    c.beginPath();
    c.ellipse(x, y + 3, 12, 18, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x, y - 16, 8, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(220,255,240,.55)';
    c.lineWidth = 1.5;
    for (const ph of [0, Math.PI]) {
        c.beginPath();
        for (let k = 0; k <= 20; k++) {
            const yy = y - 30 + k * 3, xx = x + 22 + Math.sin(k * .6 + ph + now / 500) * 6;
            k ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
        }
        c.stroke();
    }
    for (let k = 0; k < 4; k++) {
        const t = ((now / 1200 + k * .27 + rNoise(x, k)) % 1);
        c.fillStyle = `rgba(230,255,240,${.7 * (1 - t)})`;
        c.beginPath();
        c.arc(x - 18 + k * 12, y + R - 8 - t * (2 * R - 16), 2 + (k % 2), 0, Math.PI * 2);
        c.fill();
    }
    c.strokeStyle = 'rgba(230,255,250,.7)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y, R - 2, -2.4, -1.2);
    c.stroke();
}

// ---------- Kisten im Untergrund ----------
function rCrate(c, x, y, type, ready, now) {
    if (type === 2) {
        // Munitionskiste, oliv mit Schablonenschrift
        c.fillStyle = 'rgba(0,0,0,.4)';
        c.fillRect(x - 26, y - 14, 58, 36);
        c.fillStyle = '#4c5a34';
        c.fillRect(x - 30, y - 20, 60, 38);
        c.fillStyle = '#3b4728';
        c.fillRect(x - 30, y - 20, 60, 9);
        c.fillStyle = '#c8b870';
        c.font = 'bold 10px system-ui';
        c.textAlign = 'center';
        c.fillText('AMMO', x, y + 6);
        if (ready) {
            c.strokeStyle = `rgba(255,210,90,${.35 + .3 * Math.sin(now / 250)})`;
            c.lineWidth = 3;
            c.strokeRect(x - 33, y - 23, 66, 44);
        }
        return true;
    }
    if (type === 3) {
        // Bio-Container: weiss, Biohazard, gruen leuchtend
        if (ready) {
            const gr = c.createRadialGradient(x, y, 4, x, y, 56);
            gr.addColorStop(0, `rgba(60,255,150,${.35 + .2 * Math.sin(now / 230)})`);
            gr.addColorStop(1, 'rgba(60,255,150,0)');
            c.fillStyle = gr;
            c.beginPath();
            c.arc(x, y, 56, 0, Math.PI * 2);
            c.fill();
        }
        c.fillStyle = '#dfe8e6';
        c.fillRect(x - 26, y - 22, 52, 44);
        c.fillStyle = '#29c6a0';
        c.fillRect(x - 26, y - 22, 52, 7);
        drawEmojiC(c, '☣️', x, y + 4, 26);
        return true;
    }
    return false;
}

// ---------- Treppen ----------
function rPortal(c, s, now) {
    const x = s.x, y = s.y, p = .5 + .5 * Math.sin(now / 300 + x);
    if (s.dir === 'down') {
        const lab = s.level <= -1;
        c.fillStyle = 'rgba(0,0,0,.5)';
        c.fillRect(x - 44, y - 34, 88, 68);
        c.fillStyle = lab ? '#1f2a28' : '#3b3f45';
        c.fillRect(x - 40, y - 30, 80, 60);
        // Stufen nach unten, immer dunkler
        for (let k = 0; k < 5; k++) {
            c.fillStyle = `rgb(${60 - k * 11},${64 - k * 11},${70 - k * 11})`;
            c.fillRect(x - 32, y - 24 + k * 10, 64, 9);
        }
        c.strokeStyle = lab ? `rgba(60,255,170,${.5 + .4 * p})` : `rgba(255,190,60,${.5 + .4 * p})`;
        c.lineWidth = 4;
        c.strokeRect(x - 40, y - 30, 80, 60);
    } else {
        c.fillStyle = 'rgba(0,0,0,.4)';
        c.fillRect(x - 30, y - 42, 64, 84);
        c.strokeStyle = '#a9b0b8';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(x - 18, y - 40);
        c.lineTo(x - 18, y + 40);
        c.moveTo(x + 18, y - 40);
        c.lineTo(x + 18, y + 40);
        for (let k = -32; k <= 32; k += 16) { c.moveTo(x - 18, y + k); c.lineTo(x + 18, y + k); }
        c.stroke();
        const gr = c.createRadialGradient(x, y - 40, 2, x, y - 40, 70);
        gr.addColorStop(0, `rgba(255,255,220,${.35 + .2 * p})`);
        gr.addColorStop(1, 'rgba(255,255,220,0)');
        c.fillStyle = gr;
        c.beginPath();
        c.arc(x, y - 40, 70, 0, Math.PI * 2);
        c.fill();
    }
    c.font = 'bold 13px system-ui';
    c.textAlign = 'center';
    const label = `${s.dir === 'down' ? '⬇' : '⬆'} ${s.dest || ''}`;
    const tw = c.measureText(label).width + 14;
    c.fillStyle = 'rgba(0,0,0,.72)';
    c.fillRect(x - tw / 2, y + 46, tw, 18);
    c.fillStyle = s.dir === 'down' ? '#ffcf6a' : '#d8f0ff';
    c.fillText(label, x, y + 59);
}

// ---------- Gegner ----------
// Figuren von oben: Schatten, Koerper, Schultern, Kopf, Waffe in Blickrichtung.
function rDrawMob(c, mb, def, now) {
    if (def.zombie || def.boss) return false;
    const k = mb.kind, a = mb.a || 0, r = def.r, h = rHash(mb.id || k);
    const bob = Math.sin(now / 140 + h * 30) * 1.2;
    const x = mb.x, y = mb.y + bob;
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath();
    c.ellipse(mb.x, mb.y + r * .85, r * 1.05, r * .45, 0, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.translate(x, y);
    c.rotate(a);
    const body = (col, dark, w = 1, hh = 1) => {
        const g = c.createRadialGradient(-r * .2, -r * .3, r * .2, 0, 0, r * 1.1);
        g.addColorStop(0, col);
        g.addColorStop(1, dark);
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(0, 0, r * .8 * w, r * hh, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,.45)';
        c.lineWidth = 2;
        c.stroke();
    };
    const gun = (len, wid, col = '#1d2127') => {
        c.fillStyle = col;
        c.fillRect(r * .3, r * .15, len, wid);
        c.fillStyle = 'rgba(255,255,255,.12)';
        c.fillRect(r * .3, r * .15, len, 2);
    };
    const head = (col, rr = .42) => {
        c.fillStyle = col;
        c.beginPath();
        c.arc(r * .05, 0, r * rr, 0, Math.PI * 2);
        c.fill();
    };
    if (k === 'scav') {
        gun(r * 1.4, 5);
        body('#8a8f7a', '#4a4f3d');
        head('#3c3f36', .45);
        c.fillStyle = '#c9a26b';
        c.fillRect(r * .22, -r * .18, r * .2, r * .36);
    } else if (k === 'brute') {
        body('#b9743f', '#5e3418', 1.35, 1.05);
        c.fillStyle = '#6d6f73';
        for (const s of [-1, 1]) {
            c.beginPath();
            c.arc(r * .55, s * r * .72, r * .34, 0, Math.PI * 2);
            c.fill();
        }
        head('#4b2a14', .38);
        c.fillStyle = '#ff5b3b';
        c.fillRect(r * .28, -r * .2, 4, 4);
        c.fillRect(r * .28, r * .12, 4, 4);
    } else if (k === 'sniper') {
        gun(r * 2.4, 4, '#2a2e24');
        c.fillStyle = '#10140e';
        c.fillRect(r * 1.1, r * .05, 10, 7);
        // Ghillie: zottelige Kanten
        c.fillStyle = '#4e6b36';
        for (let i = 0; i < 12; i++) {
            const t = i / 12 * Math.PI * 2;
            c.beginPath();
            c.arc(Math.cos(t) * r * .75, Math.sin(t) * r * .85, r * .32, 0, Math.PI * 2);
            c.fill();
        }
        body('#6b8a45', '#34462a');
        head('#2c3a20', .38);
        if (!mb.aim && Math.sin(now / 300 + h * 9) > .92) {
            c.fillStyle = 'rgba(255,255,255,.9)';
            c.beginPath();
            c.arc(r * 1.25, r * .1, 3, 0, Math.PI * 2);
            c.fill();
        }
    } else if (k === 'drone') {
        c.restore();
        c.save();
        c.translate(x, y - 6);
        const spin = now / 30;
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            c.strokeStyle = '#3d4652';
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(0, 0);
            c.lineTo(dx * r * .9, dy * r * .9);
            c.stroke();
            c.fillStyle = 'rgba(180,220,255,.25)';
            c.beginPath();
            c.ellipse(dx * r * .9, dy * r * .9, r * .55, r * .18, spin + dx, 0, Math.PI * 2);
            c.fill();
        }
        c.fillStyle = '#2b333d';
        c.beginPath();
        c.arc(0, 0, r * .55, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = `rgba(127,211,255,${.6 + .4 * Math.sin(now / 150)})`;
        c.beginPath();
        c.arc(Math.cos(a) * r * .3, Math.sin(a) * r * .3, r * .2, 0, Math.PI * 2);
        c.fill();
    } else if (k === 'enforcer') {
        gun(r * 1.3, 9, '#3a3f47');
        body('#8c3b3b', '#401818', 1.25, 1.1);
        c.fillStyle = '#b8c0c8';
        c.fillRect(-r * .5, -r * .95, r * .8, r * .3);
        c.fillRect(-r * .5, r * .65, r * .8, r * .3);
        head('#2a2d33', .4);
        c.fillStyle = `rgba(255,70,70,${.7 + .3 * Math.sin(now / 200)})`;
        c.fillRect(r * .2, -r * .25, r * .22, r * .5);
    } else if (k === 'mutant') {
        body('#5fd14a', '#1f5a18', 1.2, 1.05);
        c.fillStyle = '#2f7a26';
        for (let i = 0; i < 5; i++) {
            c.beginPath();
            c.arc(-r * .3 + (i % 3) * r * .3, (i - 2) * r * .3, r * .16, 0, Math.PI * 2);
            c.fill();
        }
        // Klauen
        c.strokeStyle = '#e8ffd8';
        c.lineWidth = 2;
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
            c.beginPath();
            c.moveTo(r * .55, s * r * (.55 + i * .12));
            c.lineTo(r * 1.1, s * r * (.4 + i * .14));
            c.stroke();
        }
        head('#3a8a2e', .36);
        c.fillStyle = '#fff36a';
        c.fillRect(r * .22, -r * .16, 3, 3);
        c.fillRect(r * .22, r * .1, 3, 3);
    } else if (k === 'stalker') {
        // lang, flach, mit Schwanz
        const wig = Math.sin(now / 90 + h * 20) * .35;
        c.strokeStyle = '#6f9a1c';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(-r * .6, 0);
        c.quadraticCurveTo(-r * 1.4, wig * r * 2, -r * 2.1, wig * r * 3);
        c.stroke();
        body('#b6ff3a', '#4d7a10', 1.5, .7);
        c.strokeStyle = '#4d7a10';
        c.lineWidth = 3;
        for (const s of [-1, 1]) for (const fx of [.4, -.3]) {
            c.beginPath();
            c.moveTo(r * fx, s * r * .5);
            c.lineTo(r * (fx + .3), s * r * 1.1);
            c.stroke();
        }
        c.fillStyle = '#ff3b3b';
        c.fillRect(r * .9, -r * .22, 3, 3);
        c.fillRect(r * .9, r * .14, 3, 3);
    } else if (k === 'horror') {
        const pul = 1 + .08 * Math.sin(now / 160 + h * 10);
        c.fillStyle = 'rgba(53,255,192,.25)';
        c.beginPath();
        c.arc(0, 0, r * 1.35 * pul, 0, Math.PI * 2);
        c.fill();
        body('#35ffc0', '#0d6e52', pul, pul);
        c.fillStyle = 'rgba(10,60,40,.8)';
        for (let i = 0; i < 6; i++) {
            const t = i / 6 * Math.PI * 2 + now / 900;
            c.beginPath();
            c.arc(Math.cos(t) * r * .5, Math.sin(t) * r * .5, r * .14, 0, Math.PI * 2);
            c.fill();
        }
        c.fillStyle = '#eaffef';
        c.beginPath();
        c.arc(r * .35, 0, r * .22, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#0d3b2c';
        c.beginPath();
        c.arc(r * .42, 0, r * .1, 0, Math.PI * 2);
        c.fill();
    } else if (k === 'hulk') {
        body('#c64fb0', '#521846', 1.3, 1.15);
        // Schlaeuche aus dem Tank, Stahlplatten
        c.strokeStyle = '#7de0ff';
        c.lineWidth = 3;
        for (const s of [-1, 1]) {
            c.beginPath();
            c.moveTo(-r * .2, s * r * .4);
            c.quadraticCurveTo(-r * .9, s * r * 1.1, -r * 1.3, s * r * .6);
            c.stroke();
        }
        c.fillStyle = '#8a8f96';
        c.fillRect(-r * .6, -r * .3, r * .5, r * .6);
        c.fillStyle = '#e06ad0';
        for (const s of [-1, 1]) {
            c.beginPath();
            c.arc(r * .7, s * r * .75, r * .38, 0, Math.PI * 2);
            c.fill();
        }
        head('#6e2461', .34);
        c.fillStyle = `rgba(255,255,120,${.7 + .3 * Math.sin(now / 120)})`;
        c.fillRect(r * .2, -r * .12, 5, 5);
        c.fillRect(r * .2, r * .06, 5, 5);
    } else {
        c.restore();
        return false;
    }
    c.restore();
    return true;
}
