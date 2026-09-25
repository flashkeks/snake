// Dungeon-Optik (25.09.2026, Max: „Labor haesslich, deutlich krassere Grafik,
// keine Minimap, nur sehen, was wirklich um einen rum ist").
//
// Der Server schickt fuer Dungeons das Kachelraster (m.tiles, m.ts, m.gw, m.gh),
// Lampen (m.lights) und je Raum einen Stil (m.rooms[].style). Daraus wird pro
// Abschnitt (CH Kacheln) ein Bild gebacken: Boden je Stil, Gang-Gitter, Waende
// mit Oberseite und Vorderkante (2.5D), Schatten an den Wandfuessen, Schmutz.
// Pro Bild kommen Licht (dunkles Grundlicht, Lichtkegel der Lampen, flackernd)
// und das Sichtfeld (Raycast ueber das Raster) als Bildschirm-Ebenen darueber.
//
// Zeichen im Raster: 0 nichts/Wand, 1 Raumboden, 2 Gang, 3 Saeule, 4 Tank, 5 Deckung

const DFX = { key: null };
const dRand = (x, y, k = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); };

function dPrep(m) {
    const key = m.kind + ':' + m.seed;
    if (DFX.key === key) return DFX;
    DFX.key = key;
    DFX.m = m;
    DFX.ts = m.ts;
    DFX.gw = m.gw;
    DFX.gh = m.gh;
    DFX.t = m.tiles;
    DFX.lab = m.kind === 'lab';
    DFX.chunks = new Map();
    DFX.seen = new Uint8Array(m.gw * m.gh);
    // Raum je Kachel (fuer den Bodenstil)
    DFX.room = new Int16Array(m.gw * m.gh).fill(-1);
    (m.rooms || []).forEach((r, i) => {
        for (let y = Math.floor(r.y / m.ts); y < Math.ceil((r.y + r.h) / m.ts); y++) for (let x = Math.floor(r.x / m.ts); x < Math.ceil((r.x + r.w) / m.ts); x++) if (x >= 0 && y >= 0 && x < m.gw && y < m.gh) DFX.room[y * m.gw + x] = i;
    });
    return DFX;
}
const dTile = (x, y) => (x < 0 || y < 0 || x >= DFX.gw || y >= DFX.gh) ? '0' : DFX.t[y * DFX.gw + x];
const dFloor = (x, y) => { const t = dTile(x, y); return t !== '0'; };
// blockiert die Sicht? Wand und Saeulen ja, Tanks und Deckung nicht (man sieht drueber)
const dOpaque = (x, y) => { const t = dTile(x, y); return t === '0' || t === '3'; };
function dIsWall(x, y) {
    if (dTile(x, y) !== '0') return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dFloor(x + dx, y + dy)) return true;
    return false;
}

// ---------- Boeden ----------
function dFloorTile(g, x, y, S, style, tx, ty) {
    const r = (k) => dRand(tx, ty, k);
    if (style === 'clean' || style === 'cryo') {
        // Laborfliesen 2x2 je Kachel, Fugen, Glanz; Kryo blaeulich mit Frost
        const base = style === 'cryo' ? [118, 146, 166] : [112, 128, 124];
        for (let i = 0; i < 4; i++) {
            const qx = x + (i % 2) * S / 2, qy = y + Math.floor(i / 2) * S / 2, v = (r(i) - .5) * 14;
            g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
            g.fillRect(qx + 1, qy + 1, S / 2 - 2, S / 2 - 2);
            const gr = g.createLinearGradient(qx, qy, qx + S / 2, qy + S / 2);
            gr.addColorStop(0, 'rgba(255,255,255,.18)');
            gr.addColorStop(.5, 'rgba(255,255,255,0)');
            g.fillStyle = gr;
            g.fillRect(qx + 1, qy + 1, S / 2 - 2, S / 2 - 2);
        }
        g.fillStyle = 'rgba(40,60,58,.9)';
        g.fillRect(x, y + S / 2 - 1, S, 2);
        g.fillRect(x + S / 2 - 1, y, 2, S);
        if (style === 'cryo') for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(230,250,255,${.2 + r(k + 9) * .3})`; g.fillRect(x + r(k + 20) * S, y + r(k + 40) * S, 2 + r(k) * 3, 2); }
        if (r(7) < .12) { // Abfluss
            g.fillStyle = '#3c4a48';
            g.beginPath(); g.arc(x + S / 2, y + S / 2, 9, 0, Math.PI * 2); g.fill();
            g.strokeStyle = '#27302f'; g.lineWidth = 2;
            for (let k = -6; k <= 6; k += 4) { g.beginPath(); g.moveTo(x + S / 2 + k, y + S / 2 - 6); g.lineTo(x + S / 2 + k, y + S / 2 + 6); g.stroke(); }
        }
        return;
    }
    if (style === 'office') {
        g.fillStyle = '#3a4250';
        g.fillRect(x, y, S, S);
        for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${r(k) < .5 ? '255,255,255' : '0,0,0'},.05)`; g.fillRect(x + r(k + 1) * S, y + r(k + 2) * S, 2, 2); }
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, S - 1, S - 1);
        return;
    }
    if (style === 'bio') {
        g.fillStyle = '#1f3a2c';
        g.fillRect(x, y, S, S);
        // Waben
        g.strokeStyle = 'rgba(120,255,170,.12)'; g.lineWidth = 2;
        const hs = S / 4;
        for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
            const cx = x + col * hs * 1.5 + (row % 2 ? hs * .75 : 0), cy = y + row * hs * .87;
            g.beginPath();
            for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const px = cx + Math.cos(a) * hs * .5, py = cy + Math.sin(a) * hs * .5; k ? g.lineTo(px, py) : g.moveTo(px, py); }
            g.closePath(); g.stroke();
        }
        return;
    }
    if (style === 'hangar') {
        g.fillStyle = '#26272a';
        g.fillRect(x, y, S, S);
        for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(0,0,0,${.1 + r(k) * .15})`; g.fillRect(x + r(k + 1) * S, y + r(k + 2) * S, 3, 3); }
        if ((tx + ty) % 5 === 0) { g.fillStyle = 'rgba(230,190,40,.55)'; g.fillRect(x, y + S / 2 - 4, S, 8); }
        return;
    }
    if (style === 'barracks') {
        g.fillStyle = '#4a3a28';
        g.fillRect(x, y, S, S);
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
        for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x, y + k * S / 5); g.lineTo(x + S, y + k * S / 5); g.stroke(); }
        g.strokeStyle = 'rgba(0,0,0,.2)';
        for (let k = 0; k < 5; k++) { const off = r(k) * S; g.beginPath(); g.moveTo(x + off, y + k * S / 5); g.lineTo(x + off, y + (k + 1) * S / 5); g.stroke(); }
        return;
    }
    if (style === 'armory') {
        g.fillStyle = '#50565c';
        g.fillRect(x, y, S, S);
        g.fillStyle = 'rgba(255,255,255,.14)';
        for (let yy = 4; yy < S; yy += 10) for (let xx = (yy / 10 % 2) * 5 + 3; xx < S; xx += 10) { g.save(); g.translate(x + xx, y + yy); g.rotate(.7); g.fillRect(-3, -1, 6, 2); g.restore(); }
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(x + .5, y + .5, S - 1, S - 1);
        return;
    }
    // concrete (Standard Militaer)
    g.fillStyle = '#3b3d40';
    g.fillRect(x, y, S, S);
    for (let k = 0; k < 70; k++) { const v = r(k); g.fillStyle = `rgba(${v < .5 ? '255,255,255' : '0,0,0'},${.04 + v * .05})`; g.fillRect(x + r(k + 1) * S, y + r(k + 2) * S, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, S - 2, S - 2);
    if (r(5) < .15) { const gr = g.createRadialGradient(x + S / 2, y + S / 2, 2, x + S / 2, y + S / 2, S * .45); gr.addColorStop(0, 'rgba(10,8,6,.55)'); gr.addColorStop(1, 'rgba(10,8,6,0)'); g.fillStyle = gr; g.fillRect(x, y, S, S); }
}
function dCorridorTile(g, x, y, S, tx, ty) {
    if (DFX.lab) {
        // Metallgitter mit gruenem Licht darunter
        g.fillStyle = '#0d1715';
        g.fillRect(x, y, S, S);
        const gr = g.createLinearGradient(x, y, x, y + S);
        gr.addColorStop(0, 'rgba(40,255,160,.10)'); gr.addColorStop(.5, 'rgba(40,255,160,.22)'); gr.addColorStop(1, 'rgba(40,255,160,.10)');
        g.fillStyle = gr; g.fillRect(x, y, S, S);
        g.fillStyle = '#39443f';
        for (let k = 0; k <= S; k += 8) { g.fillRect(x + k - 1, y, 3, S); }
        g.fillStyle = '#4a5752';
        for (let k = 0; k <= S; k += 20) g.fillRect(x, y + k - 2, S, 4);
        return;
    }
    g.fillStyle = '#34363a';
    g.fillRect(x, y, S, S);
    for (let k = 0; k < 50; k++) { g.fillStyle = `rgba(0,0,0,${.08 + dRand(tx, ty, k) * .12})`; g.fillRect(x + dRand(tx, ty, k + 1) * S, y + dRand(tx, ty, k + 2) * S, 3, 2); }
    // Warnstreifen an Kanten zur Wand
    const stripe = (sx, sy, w, h) => { g.save(); g.beginPath(); g.rect(sx, sy, w, h); g.clip(); g.fillStyle = '#1b1b1b'; g.fillRect(sx, sy, w, h); g.fillStyle = '#d8a820'; for (let k = -S; k < S * 2; k += 16) { g.beginPath(); g.moveTo(sx + k, sy); g.lineTo(sx + k + 8, sy); g.lineTo(sx + k + 8 - h, sy + h); g.lineTo(sx + k - h, sy + h); g.fill(); } g.restore(); };
    if (!dFloor(tx, ty - 1)) stripe(x, y, S, 7);
    if (!dFloor(tx, ty + 1)) stripe(x, y + S - 7, S, 7);
    if (!dFloor(tx - 1, ty)) stripe(x, y, 7, S);
    if (!dFloor(tx + 1, ty)) stripe(x + S - 7, y, 7, S);
}

// ---------- Waende (2.5D: Oberseite + Vorderkante, wenn darunter Boden ist) ----------
const FACE = 26;
function dWallTile(g, x, y, S, tx, ty) {
    const front = dFloor(tx, ty + 1);
    const lab = DFX.lab;
    // Oberseite (durchgehend, leichtes Rauschen)
    g.fillStyle = lab ? '#1a2627' : '#242527';
    g.fillRect(x, y, S, S);
    for (let k = 0; k < 18; k++) { g.fillStyle = `rgba(255,255,255,${dRand(tx, ty, k) * .035})`; g.fillRect(x + dRand(tx, ty, k + 30) * S, y + dRand(tx, ty, k + 60) * S, 3, 3); }
    // Kanten zur Bodenseite hell
    g.fillStyle = lab ? '#5c7c7a' : '#6a6d70';
    if (dFloor(tx, ty - 1)) g.fillRect(x, y, S, 3);
    if (dFloor(tx - 1, ty)) g.fillRect(x, y, 3, S);
    if (dFloor(tx + 1, ty)) g.fillRect(x + S - 3, y, 3, S);
    // Nieten entlang der Kanten
    g.fillStyle = lab ? 'rgba(140,200,190,.35)' : 'rgba(200,200,200,.18)';
    if (dFloor(tx, ty - 1)) for (let k = 10; k < S; k += 20) g.fillRect(x + k, y + 7, 3, 3);
    if (front) {
        // Vorderkante (senkrechte Wandflaeche) ragt in die Kachel darunter
        const fy = y + S - FACE;
        const gr = g.createLinearGradient(0, fy, 0, y + S);
        if (lab) { gr.addColorStop(0, '#b9c9c6'); gr.addColorStop(1, '#6f8481'); } else { gr.addColorStop(0, '#6c6f72'); gr.addColorStop(1, '#3f4245'); }
        g.fillStyle = gr;
        g.fillRect(x, fy, S, FACE);
        if (lab) {
            g.fillStyle = '#2fe6b0';
            g.fillRect(x, fy + 9, S, 3);
            g.fillStyle = 'rgba(47,230,176,.25)';
            g.fillRect(x, fy + 6, S, 9);
            g.fillStyle = 'rgba(0,0,0,.3)';
            for (let k = 10; k < S; k += 26) g.fillRect(x + k, fy + 18, 3, 3);
        } else {
            g.fillStyle = 'rgba(0,0,0,.35)';
            for (let k = 8; k < S; k += 20) g.fillRect(x + k, fy + 4, 2, FACE - 8);
            // Warnband unten
            g.save(); g.beginPath(); g.rect(x, y + S - 6, S, 6); g.clip();
            g.fillStyle = '#1b1b1b'; g.fillRect(x, y + S - 6, S, 6); g.fillStyle = '#d8a820';
            for (let k = -10; k < S + 10; k += 14) { g.beginPath(); g.moveTo(x + k, y + S - 6); g.lineTo(x + k + 7, y + S - 6); g.lineTo(x + k + 1, y + S); g.lineTo(x + k - 6, y + S); g.fill(); }
            g.restore();
        }
        g.fillStyle = 'rgba(255,255,255,.2)';
        g.fillRect(x, fy, S, 2);
    }
}
function dVoidTile(g, x, y, S) {
    g.fillStyle = '#050607';
    g.fillRect(x, y, S, S);
}
// Schatten von Waenden auf den Boden (Wandfuss)
function dFloorShade(g, x, y, S, tx, ty) {
    const sh = (x0, y0, x1, y1, w, h) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x0 < x1 ? x0 : x1, y0 < y1 ? y0 : y1, w, h); };
    if (DFX.lab && dTile(tx, ty) === '1') {
        // Leuchtleiste am Wandfuss
        g.fillStyle = 'rgba(47,230,176,.55)';
        if (!dFloor(tx - 1, ty)) g.fillRect(x + 2, y, 3, S);
        if (!dFloor(tx + 1, ty)) g.fillRect(x + S - 5, y, 3, S);
        if (!dFloor(tx, ty + 1)) g.fillRect(x, y + S - 5, S, 3);
    }
    if (!DFX.lab && dRand(tx, ty, 77) < .2) {
        // Patronenhuelsen
        for (let k = 0; k < 4; k++) { g.save(); g.translate(x + dRand(tx, ty, k + 80) * S, y + dRand(tx, ty, k + 90) * S); g.rotate(dRand(tx, ty, k + 95) * 6); g.fillStyle = '#b8902a'; g.fillRect(-3, -1, 6, 2.5); g.restore(); }
    }
    if (!dFloor(tx - 1, ty)) sh(x, y, x + 22, y, 22, S);
    if (!dFloor(tx + 1, ty)) sh(x + S, y, x + S - 14, y, 14, S);
    if (!dFloor(tx, ty + 1)) sh(x, y + S, x, y + S - 14, S, 14);
}
function dPillar(g, x, y, S) {
    const p = 14, w = S - 2 * p;
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.fillRect(x + p + 8, y + p + 10, w, w);
    g.fillStyle = DFX.lab ? '#9fb3b0' : '#5b5e61';
    g.fillRect(x + p, y + p + FACE * .5, w, w - FACE * .5);
    g.fillStyle = DFX.lab ? '#2a3a3a' : '#35373a';
    g.fillRect(x + p, y + p, w, w - FACE * .5 + 2);
    g.fillStyle = DFX.lab ? '#2fe6b0' : '#d8a820';
    g.fillRect(x + p, y + p + w - FACE * .5 - 2, w, 3);
}

// Schmutz, Kabel, Pfuetzen (auf dem Boden, fest je Kachel)
function dDecal(g, x, y, S, tx, ty) {
    const v = dRand(tx, ty, 99);
    if (v > .9) {
        const gr = g.createRadialGradient(x + S / 2, y + S / 2, 2, x + S / 2, y + S / 2, S * .6);
        gr.addColorStop(0, DFX.lab ? 'rgba(80,255,120,.35)' : 'rgba(20,14,8,.5)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x - S * .2, y - S * .2, S * 1.4, S * 1.4);
    } else if (v < .06) {
        g.strokeStyle = DFX.lab ? 'rgba(30,30,30,.8)' : 'rgba(20,20,20,.8)';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(x, y + dRand(tx, ty, 3) * S);
        g.bezierCurveTo(x + S * .3, y + dRand(tx, ty, 4) * S, x + S * .7, y + dRand(tx, ty, 5) * S, x + S, y + dRand(tx, ty, 6) * S);
        g.stroke();
    } else if (v < .1 && !DFX.lab) {
        g.fillStyle = 'rgba(0,0,0,.35)';
        for (let k = 0; k < 5; k++) g.fillRect(x + dRand(tx, ty, k + 10) * S, y + dRand(tx, ty, k + 20) * S, 6, 2);
    }
}

// ---------- Abschnitt backen ----------
const CH = 8;
function dChunk(cx, cy) {
    const key = cx + ',' + cy;
    let cv = DFX.chunks.get(key);
    if (cv) return cv;
    const S = DFX.ts, px = CH * S;
    cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const g = cv.getContext('2d');
    const rooms = DFX.m.rooms || [];
    // Reihenfolge: Boeden, Schatten/Schmutz, Waende (Vorderkanten ueberlappen nach unten)
    for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
            const tx = cx * CH + i, ty = cy * CH + j, x = i * S, y = j * S, t = dTile(tx, ty);
            if (pass === 0) {
                if (t === '0') { if (!dIsWall(tx, ty)) dVoidTile(g, x, y, S); continue; }
                const ri = DFX.room[ty * DFX.gw + tx];
                if (t === '2' || ri < 0) dCorridorTile(g, x, y, S, tx, ty);
                else dFloorTile(g, x, y, S, (rooms[ri] || {}).style || (DFX.lab ? 'clean' : 'concrete'), tx, ty);
                dDecal(g, x, y, S, tx, ty);
                dFloorShade(g, x, y, S, tx, ty);
            } else {
                if (t === '0' && dIsWall(tx, ty)) dWallTile(g, x, y, S, tx, ty);
                if (t === '3') dPillar(g, x, y, S);
            }
        }
    }
    // Schablonen-Beschriftung der Raeume (Mittelpunkt im Abschnitt)
    rooms.forEach((r, i) => {
        const rx = r.x + r.w / 2, ry = r.y + r.h / 2;
        if (rx < cx * px || rx >= (cx + 1) * px || ry < cy * px || ry >= (cy + 1) * px) return;
        const lx = rx - cx * px, ly = ry - cy * px;
        const names = DFX.lab ? { clean: 'LAB', office: 'OFFICE', cryo: 'CRYO', bio: '☣ BIO' } : { concrete: 'SECTOR', hangar: 'HANGAR', barracks: 'BARRACKS', armory: 'ARMORY' };
        const txt = `${names[r.style] || (DFX.lab ? 'LAB' : 'SECTOR')}-${String(i + 1).padStart(2, '0')}`;
        g.save();
        g.font = `bold ${Math.min(64, r.w / 6)}px system-ui`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.globalAlpha = DFX.lab ? .16 : .22;
        g.fillStyle = DFX.lab ? '#9fffe0' : '#e8c060';
        g.fillText(txt, lx, ly + r.h * .28);
        g.restore();
        // Militaer: Bodenmarkierung (Pfeil zum naechsten Ausgang ist zu teuer – Rahmenlinie)
        if (!DFX.lab && r.style !== 'barracks') {
            g.save();
            g.strokeStyle = 'rgba(230,190,50,.28)';
            g.lineWidth = 6;
            g.setLineDash([30, 18]);
            g.strokeRect(r.x - cx * px + 40, r.y - cy * px + 40, r.w - 80, r.h - 80);
            g.restore();
        }
    });
    DFX.chunks.set(key, cv);
    return cv;
}

// Boden + Waende fuer den sichtbaren Ausschnitt (Weltkoordinaten, Transform gesetzt)
function dDraw(c, m, cam, vw, vh) {
    if (!m.tiles) return false;
    dPrep(m);
    const cs = CH * DFX.ts;
    for (let cy = Math.floor(cam.y / cs); cy <= Math.floor((cam.y + vh) / cs); cy++) {
        for (let cx = Math.floor(cam.x / cs); cx <= Math.floor((cam.x + vw) / cs); cx++) {
            if (cx < 0 || cy < 0 || cx * CH >= DFX.gw || cy * CH >= DFX.gh) continue;
            c.drawImage(dChunk(cx, cy), cx * cs, cy * cs);
        }
    }
    return true;
}

// ---------- Sichtfeld: Raycast ueber das Raster ----------
const VIS_R = 1150, RAYS = 540;
function dVision(px, py) {
    const S = DFX.ts, pts = [];
    for (let k = 0; k < RAYS; k++) {
        const a = k / RAYS * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        // DDA ueber die Kacheln
        let tx = Math.floor(px / S), ty = Math.floor(py / S);
        const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
        const tdx = Math.abs(S / (dx || 1e-9)), tdy = Math.abs(S / (dy || 1e-9));
        let tmx = ((dx > 0 ? (tx + 1) * S - px : px - tx * S)) / Math.abs(dx || 1e-9);
        let tmy = ((dy > 0 ? (ty + 1) * S - py : py - ty * S)) / Math.abs(dy || 1e-9);
        let d = 0;
        DFX.seen[ty * DFX.gw + tx] = 1;
        while (d < VIS_R) {
            if (tmx < tmy) { d = tmx; tmx += tdx; tx += stepX; } else { d = tmy; tmy += tdy; ty += stepY; }
            if (tx < 0 || ty < 0 || tx >= DFX.gw || ty >= DFX.gh) break;
            DFX.seen[ty * DFX.gw + tx] = 1;
            if (dOpaque(tx, ty)) { d += 18; break; }   // ein Stueck in die Wand, damit die Kante sichtbar bleibt
        }
        d = Math.min(d, VIS_R);
        pts.push(px + dx * d, py + dy * d);
    }
    return pts;
}

// Licht und Sicht als Bildschirm-Ebenen (nach allem in der Welt, vor dem HUD).
// c ist der Hauptkontext, Transform wird hier selbst gesetzt.
const dLayer = { light: null, fog: null };
function dOverlay(c, m, cam, s, cw, ch, px, py, now) {
    if (!m.tiles) return;
    dPrep(m);
    const mk = k => { let cv = dLayer[k]; if (!cv) cv = dLayer[k] = document.createElement('canvas'); if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; } return cv; };
    const toS = (x, y) => [(x - cam.x) * s, (y - cam.y) * s];
    // Licht: dunkles Grundlicht, Lampen stanzen Licht heraus
    const L = mk('light'), lg = L.getContext('2d');
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, cw, ch);
    lg.fillStyle = DFX.lab ? 'rgba(2,10,10,.80)' : 'rgba(8,6,3,.76)';
    lg.fillRect(0, 0, cw, ch);
    lg.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => { const [sx, sy] = toS(x, y), sr = r * s; if (sx < -sr || sy < -sr || sx > cw + sr || sy > ch + sr) return; const gr = lg.createRadialGradient(sx, sy, sr * .1, sx, sy, sr); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(.6, `rgba(0,0,0,${a * .55})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); lg.fillStyle = gr; lg.beginPath(); lg.arc(sx, sy, sr, 0, Math.PI * 2); lg.fill(); };
    for (const [x, y, r, fl] of m.lights || []) {
        // flackernde Lampen gehen kurz aus
        const on = !fl || Math.sin(now / 90 + x) + Math.sin(now / 37 + y) > -1.2;
        if (on) hole(x, y, r, .95);
    }
    hole(px, py, 360, .85);  // eigene Lampe
    // farbiger Schimmer der Lampen
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(L, 0, 0);
    c.globalCompositeOperation = 'lighter';
    for (const [x, y, r, fl] of m.lights || []) {
        const [sx, sy] = toS(x, y), sr = r * s * .8;
        if (sx < -sr || sy < -sr || sx > cw + sr || sy > ch + sr) continue;
        const gr = c.createRadialGradient(sx, sy, 0, sx, sy, sr);
        gr.addColorStop(0, DFX.lab ? 'rgba(60,255,190,.10)' : 'rgba(255,170,70,.10)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr;
        c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    // Sicht: alles schwarz, schon Gesehenes abgedunkelt, aktuelles Sichtfeld frei
    const pts = dVision(px, py);
    const F = mk('fog'), fg = F.getContext('2d');
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.globalCompositeOperation = 'source-over';
    fg.fillStyle = '#000';
    fg.fillRect(0, 0, cw, ch);
    fg.globalCompositeOperation = 'destination-out';
    // Erinnerung: gesehene Kacheln nur halb dunkel
    const S = DFX.ts, tx0 = Math.max(0, Math.floor(cam.x / S)), ty0 = Math.max(0, Math.floor(cam.y / S));
    const tx1 = Math.min(DFX.gw - 1, Math.floor((cam.x + cw / s) / S)), ty1 = Math.min(DFX.gh - 1, Math.floor((cam.y + ch / s) / S));
    fg.fillStyle = 'rgba(0,0,0,.45)';
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (DFX.seen[ty * DFX.gw + tx]) { const [sx, sy] = toS(tx * S, ty * S); fg.fillRect(sx, sy, S * s + 1, S * s + 1); }
    fg.fillStyle = 'rgba(0,0,0,1)';
    if ('filter' in fg) fg.filter = `blur(${Math.round(6 * s)}px)`;
    fg.beginPath();
    for (let k = 0; k < pts.length; k += 2) { const [sx, sy] = toS(pts[k], pts[k + 1]); k ? fg.lineTo(sx, sy) : fg.moveTo(sx, sy); }
    fg.closePath();
    fg.fill();
    if ('filter' in fg) fg.filter = 'none';
    c.drawImage(F, 0, 0);
    // Vignette
    const vg = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * .35, cw / 2, ch / 2, Math.max(cw, ch) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = vg;
    c.fillRect(0, 0, cw, ch);
}
