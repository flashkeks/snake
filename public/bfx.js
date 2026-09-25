// Figuren statt „Kreis mit Emoji" (25.09.2026, Max: „Bosse deutlich cooler aussehen
// lassen … der Waschbaer ist momentan lowkey ein schwarzer Kreis mit Waschbaer-Emoji").
// Raid-Bosse (king, golem, queen), die neuen Dungeon-Gegner und die Spezial-Charaktere.
// Draufsicht, Blickrichtung = +x nach rotate(a). Alles prozedural, braucht rfx.js (rHash).

function bGrad(c, r, col, dark, ox = -.25, oy = -.3) {
    const g = c.createRadialGradient(r * ox, r * oy, r * .1, 0, 0, r * 1.15);
    g.addColorStop(0, col);
    g.addColorStop(1, dark);
    return g;
}
function bEll(c, x, y, rx, ry, fill, stroke, lw = 2, rot = 0) {
    c.beginPath();
    c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function bShadow(c, x, y, r, k = 1) {
    c.fillStyle = 'rgba(0,0,0,.38)';
    c.beginPath();
    c.ellipse(x + r * .12, y + r * .82, r * 1.1 * k, r * .48 * k, 0, 0, Math.PI * 2);
    c.fill();
}
// Fell-Umriss: zottelige Kante
function bFur(c, rx, ry, n, jag, fill, stroke) {
    c.beginPath();
    for (let i = 0; i <= n * 2; i++) {
        const t = i / (n * 2) * Math.PI * 2, k = i % 2 ? 1 : 1 + jag;
        const px = Math.cos(t) * rx * k, py = Math.sin(t) * ry * k;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
    c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
}
function bCrown(c, x, y, s, now) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.ellipse(2, 3, s * 1.05, s * .75, 0, 0, Math.PI * 2); c.fill();
    // Kronreif von oben: Ring mit Zacken
    const g = c.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, '#fff1a0'); g.addColorStop(.5, '#e8b021'); g.addColorStop(1, '#9a6a05');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= 10; i++) {
        const t = i / 10 * Math.PI * 2, rr = i % 2 ? s * .72 : s * 1.05;
        const px = Math.cos(t) * rr, py = Math.sin(t) * rr * .8;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath(); c.fill();
    c.strokeStyle = '#6b4a05'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#8b1a2b'; c.beginPath(); c.ellipse(0, 0, s * .5, s * .4, 0, 0, Math.PI * 2); c.fill();
    const gems = ['#ff3b5b', '#3bd0ff', '#5bff8a', '#ff3b5b', '#3bd0ff'];
    for (let i = 0; i < 5; i++) {
        const t = i / 5 * Math.PI * 2 + .3;
        c.fillStyle = gems[i];
        c.beginPath(); c.arc(Math.cos(t) * s * .86, Math.sin(t) * s * .68, s * .13, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,.8)';
        c.fillRect(Math.cos(t) * s * .86 - 1, Math.sin(t) * s * .68 - 1.5, 1.5, 1.5);
    }
    const tw = (Math.sin(now / 260) + 1) / 2;
    c.fillStyle = `rgba(255,255,255,${.5 + .5 * tw})`;
    c.beginPath(); c.arc(-s * .5, -s * .45, 1.5 + tw * 1.5, 0, Math.PI * 2); c.fill();
    c.restore();
}
function bEye(c, x, y, r, col, glow) {
    if (glow) {
        const g = c.createRadialGradient(x, y, 0, x, y, r * 3);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(x - r * .3, y - r * .3, r * .35, 0, Math.PI * 2); c.fill();
}
function bSpeedLines(c, r, now, col = 'rgba(255,255,255,.5)') {
    c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
        const yy = (i - 2) * r * .35, off = (now / 40 + i * 13) % 20;
        c.beginPath(); c.moveTo(-r * 1.3 - off, yy); c.lineTo(-r * 2.1 - off, yy); c.stroke();
    }
    c.lineCap = 'butt';
}

// ================= Raid-Bosse =================
// true = gezeichnet (drawBoss malt dann nichts mehr)
function bDrawBoss(c, bs, BR, now) {
    const f = B_BOSS[bs.kind || 'king'];
    if (!f) return false;
    const x = bs.x, y = bs.y;
    const rgb = { king: '255,60,60', golem: '255,140,40', queen: '255,210,63' }[bs.kind || 'king'];
    // Aura am Boden
    const glow = c.createRadialGradient(x, y, BR * .5, x, y, BR * 2.3);
    glow.addColorStop(0, `rgba(${rgb},${bs.charging ? .6 : bs.enraged ? .45 : .28})`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = glow; c.beginPath(); c.arc(x, y, BR * 2.3, 0, Math.PI * 2); c.fill();
    // Runen-Ring
    c.save(); c.translate(x, y + BR * .6); c.scale(1, .45); c.rotate(now / 2500);
    c.strokeStyle = `rgba(${rgb},.45)`; c.lineWidth = 3;
    c.setLineDash([14, 10]); c.beginPath(); c.arc(0, 0, BR * 1.6, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.restore();
    bShadow(c, x, y, BR, 1.1);
    c.save();
    c.translate(x, y);
    f(c, bs, BR, now);
    c.restore();
    return true;
}

const B_BOSS = {
    // Waschbaer-Koenig: Umhang mit Hermelin, geringelter Schwanz, Maske, Krone, Zepter
    king(c, bs, R, now) {
        const a = bs.a || 0, step = Math.sin(now / (bs.charging ? 60 : 140));
        c.rotate(a);
        if (bs.charging) bSpeedLines(c, R, now, 'rgba(255,120,120,.6)');
        // Schwanz (schwingt): buschig, geringelt
        c.save(); c.translate(-R * .85, 0); c.rotate(Math.sin(now / 300) * .35);
        for (let i = 0; i < 12; i++) {
            const t = i / 12, px = -t * R * 1.45, py = Math.sin(t * 3 + now / 300) * R * .12;
            bFur(c, R * (.36 - t * .14), R * (.3 - t * .1), 7, .12, Math.floor(i / 2) % 2 ? '#26262a' : '#a4a4ac');
            c.translate(0, 0);
            if (i < 11) c.translate(-R * .12, (Math.sin((t + 1 / 12) * 3 + now / 300) - Math.sin(t * 3 + now / 300)) * R * .12);
        }
        c.restore();
        // Umhang
        const sw = Math.sin(now / 250) * .08;
        c.fillStyle = 'rgba(0,0,0,.25)';
        c.beginPath(); c.moveTo(R * .1, -R * .9); c.quadraticCurveTo(-R * 1.6, -R * (1.2 + sw), -R * 1.5, 0); c.quadraticCurveTo(-R * 1.6, R * (1.2 - sw), R * .1, R * .9); c.closePath(); c.fill();
        const cg = c.createLinearGradient(-R * 1.5, 0, R * .2, 0);
        cg.addColorStop(0, '#4a0d18'); cg.addColorStop(1, '#a3162f');
        c.fillStyle = cg;
        c.beginPath(); c.moveTo(R * .05, -R * .95); c.quadraticCurveTo(-R * 1.55, -R * (1.15 + sw), -R * 1.45, 0); c.quadraticCurveTo(-R * 1.55, R * (1.15 - sw), R * .05, R * .95); c.closePath(); c.fill();
        c.strokeStyle = '#e8b021'; c.lineWidth = 3; c.stroke();
        // Falten
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;
        for (const s of [-.5, 0, .5]) { c.beginPath(); c.moveTo(-R * .2, s * R); c.quadraticCurveTo(-R * .9, s * R * 1.1, -R * 1.35, s * R * 1.2); c.stroke(); }
        // Pfoten (laufen)
        for (const s of [-1, 1]) bEll(c, R * .2 + s * step * R * .12, s * R * .78, R * .22, R * .16, '#3a3a40');
        // Koerper (Fell)
        c.save(); c.scale(1, 1);
        bFur(c, R * .78, R * .72, 14, .08, bGrad(c, R, '#b5b5bd', '#5d5d66'), 'rgba(0,0,0,.4)');
        c.restore();
        // Hermelin-Kragen
        c.fillStyle = '#f4f0e6';
        c.beginPath(); c.ellipse(R * .12, 0, R * .42, R * .78, 0, -Math.PI / 2, Math.PI / 2); c.fill();
        c.fillStyle = '#1a1a1a';
        for (const [dx, dy] of [[.2, -.55], [.35, -.2], [.25, .2], [.38, .5], [.1, .05]]) c.fillRect(R * dx, R * dy, 3, 6);
        // Zepter in der rechten Pfote
        c.save(); c.translate(R * .55, R * .72); c.rotate(-.5 + step * .08);
        c.fillStyle = '#e8b021'; c.fillRect(0, -3, R * 1.1, 6);
        c.fillStyle = '#6b4a05'; c.fillRect(R * .3, -4, 6, 8);
        const gg = c.createRadialGradient(R * 1.15, 0, 1, R * 1.15, 0, 14);
        gg.addColorStop(0, '#ffe0f0'); gg.addColorStop(.4, '#ff3b7b'); gg.addColorStop(1, 'rgba(255,59,123,0)');
        c.fillStyle = gg; c.beginPath(); c.arc(R * 1.15, 0, 14, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ff3b7b'; c.beginPath(); c.arc(R * 1.15, 0, 6, 0, Math.PI * 2); c.fill();
        c.restore();
        // Kopf
        const hx = R * .62;
        for (const s of [-1, 1]) { // Ohren
            c.fillStyle = '#4a4a52';
            c.beginPath(); c.moveTo(hx - R * .15, s * R * .22); c.lineTo(hx - R * .42, s * R * .5); c.lineTo(hx + R * .05, s * R * .42); c.closePath(); c.fill();
            c.fillStyle = '#f0c8c8';
            c.beginPath(); c.moveTo(hx - R * .15, s * R * .26); c.lineTo(hx - R * .33, s * R * .44); c.lineTo(hx - .0 * R, s * R * .39); c.closePath(); c.fill();
        }
        bEll(c, hx, 0, R * .42, R * .4, bGrad(c, R * .5, '#c9c9d0', '#77777f'), 'rgba(0,0,0,.35)');
        // Maske
        c.fillStyle = '#18181c';
        c.beginPath(); c.ellipse(hx + R * .12, -R * .16, R * .15, R * .12, -.3, 0, Math.PI * 2); c.ellipse(hx + R * .12, R * .16, R * .15, R * .12, .3, 0, Math.PI * 2); c.fill();
        c.fillRect(hx + R * .02, -R * .1, R * .18, R * .2);
        bEye(c, hx + R * .16, -R * .15, R * .06, bs.enraged ? '#ff2020' : '#ff5b5b', true);
        bEye(c, hx + R * .16, R * .15, R * .06, bs.enraged ? '#ff2020' : '#ff5b5b', true);
        // Schnauze
        bEll(c, hx + R * .36, 0, R * .16, R * .13, '#f4f0e6');
        c.fillStyle = '#111'; c.beginPath(); c.arc(hx + R * .5, 0, R * .06, 0, Math.PI * 2); c.fill();
        // Schnurrhaare
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1;
        for (const s of [-1, 1]) for (const d of [-.08, .04]) { c.beginPath(); c.moveTo(hx + R * .42, s * R * .06); c.lineTo(hx + R * .62, s * R * (.18 + d)); c.stroke(); }
        bCrown(c, hx - R * .3, 0, R * .22, now);
    },
    // Iron Golem: Steinplatten mit Eisenbaendern, gluehender Kern, Runen, Faeuste
    golem(c, bs, R, now) {
        const a = bs.a || 0, pulse = .6 + .4 * Math.sin(now / 250);
        c.rotate(a);
        if (bs.charging) bSpeedLines(c, R, now, 'rgba(255,160,80,.6)');
        const step = Math.sin(now / 220);
        // Fuesse
        for (const s of [-1, 1]) bEll(c, -R * .35 + s * step * R * .15, s * R * .45, R * .3, R * .22, '#3e434c', 'rgba(0,0,0,.5)', 3);
        // Rumpf: Steinbloecke
        const jag = [1, .9, 1.06, .92, 1.03, .88, 1.08, .93];
        c.beginPath();
        jag.forEach((j, i) => { const t = i / jag.length * Math.PI * 2 + .2, px = Math.cos(t) * R * .88 * j, py = Math.sin(t) * R * .8 * j; i ? c.lineTo(px, py) : c.moveTo(px, py); });
        c.closePath();
        c.fillStyle = bGrad(c, R, '#8a929e', '#3b4049'); c.fill();
        c.strokeStyle = '#22262c'; c.lineWidth = 5; c.stroke();
        // Plattenfugen
        c.strokeStyle = 'rgba(20,22,26,.7)'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(-R * .8, -R * .1); c.lineTo(R * .1, -R * .2); c.lineTo(R * .75, 0);
        c.moveTo(-R * .2, -R * .75); c.lineTo(-R * .1, R * .7); c.moveTo(R * .3, -R * .6); c.lineTo(R * .35, R * .6); c.stroke();
        // Eisenbaender mit Nieten
        c.fillStyle = '#4b4f56';
        c.fillRect(-R * .55, -R * .78, R * .16, R * 1.56);
        c.fillStyle = '#9aa3ad';
        for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(-R * .47, i * R * .22, 2.5, 0, Math.PI * 2); c.fill(); }
        // Moos
        c.fillStyle = 'rgba(90,130,60,.7)';
        for (const [dx, dy, s] of [[-.6, .5, .18], [.1, -.65, .14], [.55, .45, .12]]) bEll(c, R * dx, R * dy, R * s, R * s * .6, 'rgba(90,130,60,.7)');
        // gluehender Kern + Risse
        const kg = c.createRadialGradient(0, 0, 2, 0, 0, R * .5);
        kg.addColorStop(0, `rgba(255,240,180,${pulse})`); kg.addColorStop(.4, `rgba(255,140,30,${.8 * pulse})`); kg.addColorStop(1, 'rgba(255,90,0,0)');
        c.fillStyle = kg; c.beginPath(); c.arc(0, 0, R * .5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = `rgba(255,${150 + 60 * pulse},60,${.9})`; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(0, 0); c.lineTo(-R * .35, R * .25); c.lineTo(-R * .5, R * .6);
        c.moveTo(0, 0); c.lineTo(R * .25, -R * .35); c.lineTo(R * .2, -R * .7);
        c.moveTo(0, 0); c.lineTo(R * .4, R * .15);
        c.stroke(); c.lineCap = 'butt';
        // Runen
        c.fillStyle = `rgba(255,190,90,${.5 + .5 * pulse})`; c.font = `bold ${Math.round(R * .22)}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('ᚱ', -R * .1, -R * .45); c.fillText('ᛟ', -R * .05, R * .45);
        // Faeuste
        for (const s of [-1, 1]) {
            const px = R * .55 + (bs.charging ? R * .3 : step * s * R * .1), py = s * R * 1.0;
            bEll(c, px, py, R * .36, R * .32, bGrad(c, R * .4, '#7a828e', '#3b4049'), '#22262c', 4);
            c.fillStyle = '#5b6068'; c.fillRect(px + R * .12, py - R * .26, R * .12, R * .52);
            c.fillStyle = '#b8c0ca';
            for (let k = -1; k <= 1; k++) { c.beginPath(); c.arc(px + R * .18, py + k * R * .15, 3, 0, Math.PI * 2); c.fill(); }
        }
        // Kopf
        bEll(c, R * .62, 0, R * .3, R * .28, bGrad(c, R * .35, '#9aa2ae', '#4a5058'), '#22262c', 4);
        bEye(c, R * .78, -R * .11, R * .065, `rgb(255,${150 + 80 * pulse},60)`, true);
        bEye(c, R * .78, R * .11, R * .065, `rgb(255,${150 + 80 * pulse},60)`, true);
    },
    // Hive Queen: Chitin, schlagende Fluegel mit Adern, Beine, Krone, Stachel
    queen(c, bs, R, now) {
        const a = bs.a || 0, flap = Math.sin(now / 35) * .35;
        c.rotate(a);
        if (bs.charging) bSpeedLines(c, R, now, 'rgba(255,230,120,.6)');
        // Beine
        c.strokeStyle = '#1c150c'; c.lineWidth = 3; c.lineCap = 'round';
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
            const bx = R * (.4 - i * .3), w = Math.sin(now / 90 + i * 2) * .15;
            c.beginPath(); c.moveTo(bx, s * R * .25); c.lineTo(bx + R * (.1 + w), s * R * .7); c.lineTo(bx + R * (.25 + w) - i * R * .15, s * R * .95); c.stroke();
        }
        c.lineCap = 'butt';
        // Hinterleib mit Streifen und Stachel
        c.fillStyle = '#1c150c';
        c.beginPath(); c.moveTo(-R * 1.45, 0); c.lineTo(-R * 1.2, -R * .1); c.lineTo(-R * 1.2, R * .1); c.closePath(); c.fill();
        c.save();
        c.beginPath(); c.ellipse(-R * .72, 0, R * .78, R * .56, 0, 0, Math.PI * 2); c.clip();
        c.fillStyle = bGrad(c, R, '#ffe066', '#c98a00', -.3, -.5); c.fillRect(-R * 1.6, -R, R * 1.8, R * 2);
        c.fillStyle = '#1c150c';
        for (let i = 0; i < 4; i++) {
            c.beginPath(); c.ellipse(-R * 1.25 + i * R * .32, 0, R * .08, R * .7, 0, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(-R * .75, -R * .25, R * .5, R * .12, 0, 0, Math.PI * 2); c.fill();
        c.restore();
        bEll(c, -R * .72, 0, R * .78, R * .56, null, 'rgba(0,0,0,.5)', 2);
        // Fluegel
        for (const s of [-1, 1]) for (const [ox, len, wd] of [[R * .15, R * 1.35, R * .32], [-R * .25, R * 1.05, R * .26]]) {
            c.save(); c.translate(ox, s * R * .22); c.rotate(s * (1.15 + flap));
            const wg = c.createLinearGradient(0, 0, len, 0);
            wg.addColorStop(0, 'rgba(220,240,255,.75)'); wg.addColorStop(1, 'rgba(180,220,255,.25)');
            bEll(c, len / 2, 0, len / 2, wd, wg, 'rgba(255,255,255,.8)', 1.5);
            c.strokeStyle = 'rgba(120,150,180,.55)'; c.lineWidth = 1;
            c.beginPath(); c.moveTo(4, 0); c.lineTo(len - 6, 0);
            for (let k = 1; k < 4; k++) { c.moveTo(len * k / 4, 0); c.lineTo(len * k / 4 + 10, -wd * .7); c.moveTo(len * k / 4, 0); c.lineTo(len * k / 4 + 10, wd * .7); }
            c.stroke();
            c.restore();
        }
        // Brust
        bEll(c, R * .15, 0, R * .42, R * .38, bGrad(c, R * .5, '#6b4a1c', '#2a1c08'), 'rgba(0,0,0,.5)');
        c.fillStyle = 'rgba(255,220,120,.25)';
        for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; c.fillRect(R * .15 + Math.cos(t) * R * .3, Math.sin(t) * R * .28, 2, 2); }
        // Kopf
        bEll(c, R * .72, 0, R * .3, R * .3, bGrad(c, R * .35, '#ffd84a', '#b37a00'), 'rgba(0,0,0,.5)');
        bEll(c, R * .82, -R * .16, R * .13, R * .1, '#b01020', null, 0, -.3);
        bEll(c, R * .82, R * .16, R * .13, R * .1, '#b01020', null, 0, .3);
        c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(R * .8, -R * .2, 3, 2); c.fillRect(R * .8, R * .12, 3, 2);
        // Fuehler
        c.strokeStyle = '#1c150c'; c.lineWidth = 3;
        for (const s of [-1, 1]) {
            c.beginPath(); c.moveTo(R * .92, s * R * .1); c.quadraticCurveTo(R * 1.3, s * R * .3, R * 1.3, s * R * .62); c.stroke();
            c.fillStyle = '#1c150c'; c.beginPath(); c.arc(R * 1.3, s * R * .64, 4, 0, Math.PI * 2); c.fill();
        }
        // Mandibeln
        c.strokeStyle = '#3a2408'; c.lineWidth = 3;
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(R * .98, s * R * .08); c.quadraticCurveTo(R * 1.15, s * R * .12, R * 1.08, s * R * .02); c.stroke(); }
        bCrown(c, R * .62, 0, R * .2, now);
    }
};

// ================= Dungeon-Gegner und Spezial-Charaktere =================
function bDrawMob(c, mb, def, now) {
    // Spezial-Charaktere seitlich wie die Zombie-Bosse (Max: „nicht nur von oben")
    if (B_SIDE[mb.kind]) return bDrawSide(c, mb, def, now);
    const f = B_MOB[mb.kind];
    if (!f) return false;
    const r = def.r || 20, h = rHash(String(mb.id || mb.kind));
    const bob = Math.sin(now / 140 + h * 30) * 1.2;
    bShadow(c, mb.x, mb.y, r, def.fly ? .7 : 1);
    c.save();
    c.translate(mb.x, mb.y + bob);
    // Spezial-Charaktere: farbige Aura
    if (def.special) {
        const g = c.createRadialGradient(0, 0, r * .4, 0, 0, r * 2.4);
        g.addColorStop(0, B_AURA[mb.kind] || 'rgba(255,210,63,.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 2.4, 0, Math.PI * 2); c.fill();
    }
    c.rotate(mb.a || 0);
    f(c, r, now, h, mb, def);
    c.restore();
    return true;
}
const B_AURA = { rick: 'rgba(120,255,120,.3)', gojo: 'rgba(120,190,255,.45)', tanya: 'rgba(255,220,120,.35)', mustang: 'rgba(255,120,40,.35)', meeseeks: 'rgba(90,176,255,.25)' };

// Mensch von oben: Schultern (Koerper), Arme, Kopf. col = Kleidung
function bHuman(c, r, now, h, o) {
    const step = Math.sin(now / 110 + h * 20);
    // Beine/Fuesse
    for (const s of [-1, 1]) bEll(c, -r * .15 + s * step * r * .18, s * r * .3, r * .26, r * .16, o.boots || '#222');
    // Schultern
    bEll(c, 0, 0, r * .55, r * .82, bGrad(c, r, o.col, o.dark), 'rgba(0,0,0,.45)', 2);
    if (o.belt) { c.fillStyle = o.belt; c.fillRect(-r * .1, -r * .8, r * .14, r * 1.6); }
    if (o.vest) { c.fillStyle = o.vest; c.beginPath(); c.ellipse(r * .05, 0, r * .4, r * .66, 0, 0, Math.PI * 2); c.fill(); }
    // Arme nach vorn
    c.fillStyle = o.arm || o.col;
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(r * .45, s * r * (o.armIn || .45), r * .3, r * .15, s * -.35, 0, Math.PI * 2); c.fill(); }
    for (const s of [-1, 1]) bEll(c, r * .72, s * r * (o.handIn || .3), r * .13, r * .13, o.hand || '#e8c39e');
}
function bHead(c, r, skin, hair, o = {}) {
    bEll(c, r * .05, 0, r * .36, r * .36, skin, 'rgba(0,0,0,.35)', 1.5);
    if (hair) {
        c.fillStyle = hair;
        c.beginPath(); c.arc(-r * .02, 0, r * .37, Math.PI * .45, Math.PI * 1.55); c.fill();
        c.beginPath(); c.ellipse(-r * .06, 0, r * .28, r * .34, 0, 0, Math.PI * 2); c.fill();
    }
    if (o.helmet) {
        bEll(c, 0, 0, r * .42, r * .42, bGrad(c, r * .45, o.helmet, o.helmetDark || '#222'), 'rgba(0,0,0,.5)', 2);
        c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.ellipse(-r * .1, -r * .15, r * .18, r * .08, -.4, 0, Math.PI * 2); c.fill();
    }
    if (o.visor) { c.fillStyle = o.visor; c.beginPath(); c.ellipse(r * .28, 0, r * .12, r * .26, 0, 0, Math.PI * 2); c.fill(); }
}

const B_MOB = {
    // ---- Militaerbasis ----
    heavy(c, r, now, h) {
        // Minigun mit drehenden Laeufen
        c.fillStyle = '#1d2127'; c.fillRect(r * .3, r * .05, r * 1.5, r * .42);
        const spin = now / 30;
        for (let k = 0; k < 3; k++) { c.fillStyle = k === Math.floor(spin) % 3 ? '#8a9099' : '#454b53'; c.fillRect(r * 1.1, r * .08 + k * r * .12, r * .9, r * .08); }
        c.fillStyle = '#c9a200'; c.fillRect(r * .2, r * .45, r * .35, r * .3); // Munitionsgurt
        bHuman(c, r, now, h, { col: '#6f7d5a', dark: '#39432a', vest: '#4a553a', boots: '#2a2a22', arm: '#5e6b4a', armIn: .2, handIn: .25 });
        // Panzerplatten
        c.fillStyle = '#3a4430'; for (const s of [-1, 1]) bEll(c, -r * .05, s * r * .68, r * .28, r * .2, '#3a4430', 'rgba(0,0,0,.4)');
        bHead(c, r, '#c9a27a', null, { helmet: '#556046', helmetDark: '#262c1d', visor: '#1a1a1a' });
    },
    grenadier(c, r, now, h) {
        c.fillStyle = '#2a2e24'; c.fillRect(r * .3, -r * .08, r * 1.2, r * .22);
        bEll(c, r * 1.45, r * .03, r * .18, r * .18, '#3a3f33');
        bHuman(c, r, now, h, { col: '#8a5a38', dark: '#4a2c16', belt: '#3a2a18', boots: '#2a1c10', armIn: .25, handIn: .1 });
        // Granaten am Gurt
        for (let k = -2; k <= 2; k++) bEll(c, -r * .02, k * r * .28, r * .1, r * .1, '#3e5a2a', 'rgba(0,0,0,.4)', 1);
        bHead(c, r, '#d9b08a', null, { helmet: '#6b5030', helmetDark: '#2e2010' });
        c.fillStyle = '#111'; c.fillRect(r * .25, -r * .2, r * .08, r * .4); // Brille
    },
    trooper(c, r, now, h) {
        bHuman(c, r, now, h, { col: '#4a5a78', dark: '#232c40', vest: '#2e3a52', boots: '#15181f', armIn: .5, handIn: .4 });
        bHead(c, r, '#c9a27a', null, { helmet: '#2e3a52', helmetDark: '#12161f', visor: 'rgba(160,200,255,.6)' });
        // Schutzschild vorn
        c.save(); c.translate(r * .95, 0);
        const sg = c.createLinearGradient(0, -r, 0, r);
        sg.addColorStop(0, 'rgba(180,210,255,.75)'); sg.addColorStop(1, 'rgba(90,120,170,.75)');
        c.fillStyle = sg; gRRb(c, -r * .12, -r * 1.05, r * .24, r * 2.1, 4); c.fill();
        c.strokeStyle = '#1b2233'; c.lineWidth = 3; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.8)'; c.font = `bold ${Math.round(r * .3)}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.save(); c.rotate(Math.PI / 2); c.fillText('POLICE', 0, 0); c.restore();
        c.restore();
    },
    k9(c, r, now, h) {
        const run = Math.sin(now / 60 + h * 10);
        // Beine
        c.fillStyle = '#4a3522';
        for (const [bx, s, ph] of [[.6, -1, 0], [.6, 1, Math.PI], [-.6, -1, Math.PI], [-.6, 1, 0]]) bEll(c, r * (bx + Math.sin(now / 60 + ph) * .15), s * r * .45, r * .22, r * .12, '#4a3522');
        // Schwanz
        c.strokeStyle = '#6b4a2e'; c.lineWidth = r * .18; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-r * .9, 0); c.quadraticCurveTo(-r * 1.3, run * r * .3, -r * 1.55, run * r * .15); c.stroke(); c.lineCap = 'butt';
        // Rumpf
        bEll(c, 0, 0, r * 1.0, r * .48, bGrad(c, r, '#9a7552', '#4a3320'), 'rgba(0,0,0,.4)');
        c.fillStyle = '#2a1c10'; c.beginPath(); c.ellipse(-r * .1, 0, r * .6, r * .3, 0, 0, Math.PI * 2); c.fill(); // Sattel
        c.fillStyle = '#b8302a'; c.fillRect(r * .62, -r * .38, r * .1, r * .76); // Halsband
        // Kopf
        bEll(c, r * 1.05, 0, r * .4, r * .34, bGrad(c, r * .45, '#9a7552', '#4a3320'), 'rgba(0,0,0,.4)');
        bEll(c, r * 1.42, 0, r * .22, r * .17, '#6b4a2e');
        c.fillStyle = '#111'; c.beginPath(); c.arc(r * 1.6, 0, r * .08, 0, Math.PI * 2); c.fill();
        for (const s of [-1, 1]) {
            c.fillStyle = '#3a2616'; c.beginPath(); c.moveTo(r * .9, s * r * .18); c.lineTo(r * .78, s * r * .52); c.lineTo(r * 1.08, s * r * .3); c.closePath(); c.fill();
            bEye(c, r * 1.2, s * r * .14, r * .06, '#ffcc33', false);
        }
    },
    // ---- Labor ----
    acidspit(c, r, now, h) {
        const pulse = .5 + .5 * Math.sin(now / 200 + h * 9);
        bEll(c, 0, 0, r * .85, r * .8, bGrad(c, r, '#9bd66a', '#3d6b24'), 'rgba(0,0,0,.4)');
        // Saeuresaecke
        for (const [dx, dy, s] of [[-.4, -.45, .3], [-.45, .4, .28], [-.1, 0, .22]]) {
            bEll(c, r * dx, r * dy, r * s * (1 + pulse * .15), r * s * (1 + pulse * .15), `rgba(170,255,60,${.7 + .3 * pulse})`, 'rgba(40,80,10,.6)', 1.5);
            c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(r * (dx - .08), r * (dy - .08), r * .06, 0, Math.PI * 2); c.fill();
        }
        // Maul
        bEll(c, r * .55, 0, r * .38, r * .42, bGrad(c, r * .5, '#b3e07a', '#5a8a30'), 'rgba(0,0,0,.4)');
        c.fillStyle = '#2a1a0c'; c.beginPath(); c.ellipse(r * .82, 0, r * .12, r * .26, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = `rgba(170,255,60,${pulse})`; c.beginPath(); c.arc(r * .95, 0, r * .08, 0, Math.PI * 2); c.fill();
        for (const s of [-1, 1]) bEye(c, r * .62, s * r * .28, r * .08, '#fff94a', false);
    },
    phaseshade(c, r, now, h) {
        const fl = .45 + .35 * Math.sin(now / 90 + h * 20) * Math.sin(now / 37);
        c.globalAlpha = fl + .2;
        // Schleier-Schweif
        for (let k = 4; k >= 0; k--) bEll(c, -r * (.3 + k * .28), Math.sin(now / 200 + k) * r * .15, r * (.8 - k * .12), r * (.7 - k * .1), `rgba(106,76,255,${.12 + .05 * (4 - k)})`);
        bEll(c, 0, 0, r * .75, r * .75, bGrad(c, r, '#9d86ff', '#2a1a7a'), 'rgba(200,180,255,.6)', 2);
        c.fillStyle = '#0a0520'; c.beginPath(); c.ellipse(r * .25, 0, r * .4, r * .5, 0, 0, Math.PI * 2); c.fill();
        for (const s of [-1, 1]) bEye(c, r * .42, s * r * .18, r * .09, '#e0d4ff', true);
        c.globalAlpha = 1;
    },
    leech(c, r, now, h) {
        const n = 5;
        for (let i = n - 1; i >= 0; i--) {
            const px = -i * r * .5, py = Math.sin(now / 120 - i * .9 + h * 10) * r * .35;
            bEll(c, px, py, r * (.62 - i * .06), r * (.52 - i * .05), bGrad(c, r * .6, '#ff9ac4', '#9a2a5a'), 'rgba(60,0,20,.5)', 1.5);
            c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.ellipse(px - r * .1, py - r * .15, r * .2, r * .08, 0, 0, Math.PI * 2); c.fill();
        }
        // Saugmaul
        c.fillStyle = '#3a0a1c'; c.beginPath(); c.arc(r * .35, 0, r * .22, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#ffd0e0'; c.lineWidth = 1;
        for (let k = 0; k < 6; k++) { const t = k / 6 * Math.PI * 2; c.beginPath(); c.moveTo(r * .35 + Math.cos(t) * r * .08, Math.sin(t) * r * .08); c.lineTo(r * .35 + Math.cos(t) * r * .2, Math.sin(t) * r * .2); c.stroke(); }
    },
    cryo(c, r, now, h) {
        // Frost-Kristalle rundum
        c.fillStyle = 'rgba(200,245,255,.5)';
        for (let k = 0; k < 6; k++) {
            const t = k / 6 * Math.PI * 2 + now / 1500;
            c.save(); c.translate(Math.cos(t) * r * 1.1, Math.sin(t) * r * 1.1); c.rotate(t);
            c.beginPath(); c.moveTo(r * .2, 0); c.lineTo(0, r * .08); c.lineTo(-r * .2, 0); c.lineTo(0, -r * .08); c.closePath(); c.fill();
            c.restore();
        }
        bHuman(c, r, now, h, { col: '#d8f4ff', dark: '#6aa8c8', boots: '#2a4a5a', arm: '#b8e8ff', hand: '#9fe8ff' });
        // Tank auf dem Ruecken
        c.fillStyle = '#6a8a9a'; gRRb(c, -r * .75, -r * .35, r * .4, r * .7, 5); c.fill();
        c.fillStyle = `rgba(120,230,255,${.6 + .3 * Math.sin(now / 200)})`; gRRb(c, -r * .7, -r * .28, r * .3, r * .56, 4); c.fill();
        bHead(c, r, '#bfe9ff', null, { helmet: 'rgba(220,250,255,.9)', helmetDark: 'rgba(90,160,200,.9)', visor: 'rgba(40,120,170,.9)' });
    },
    // ---- Spezial-Charaktere ----
    rick(c, r, now, h) {
        // Portal-Gun
        c.fillStyle = '#d8d8d0'; c.fillRect(r * .5, r * .1, r * .8, r * .22);
        const pg = c.createRadialGradient(r * 1.35, r * .21, 1, r * 1.35, r * .21, r * .35);
        pg.addColorStop(0, '#e8ffd0'); pg.addColorStop(.5, '#6cff4a'); pg.addColorStop(1, 'rgba(60,255,60,0)');
        c.fillStyle = pg; c.beginPath(); c.arc(r * 1.35, r * .21, r * .35, 0, Math.PI * 2); c.fill();
        bHuman(c, r, now, h, { col: '#f4f6f8', dark: '#aab4bf', vest: '#7fb8d9', boots: '#4a3a2a', arm: '#eef2f5', armIn: .4, handIn: .3 });
        // Kittel-Schoesse
        c.fillStyle = '#e8ecef'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-r * .2, s * r * .5); c.lineTo(-r * .75, s * r * .75); c.lineTo(-r * .55, s * r * .2); c.closePath(); c.fill(); }
        // Kopf mit stachligem blaugrauem Haar
        c.fillStyle = '#a8c8e0';
        c.beginPath();
        for (let k = 0; k <= 14; k++) { const t = Math.PI * .4 + k / 14 * Math.PI * 1.2, rr = k % 2 ? r * .38 : r * .62; const px = r * .02 + Math.cos(t) * rr, py = Math.sin(t) * rr; k ? c.lineTo(px, py) : c.moveTo(px, py); }
        c.closePath(); c.fill();
        bHead(c, r, '#f0d8c0', null);
        c.fillStyle = '#a8c8e0'; c.beginPath(); c.arc(r * .02, 0, r * .2, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#6a8aa0'; c.lineWidth = 2; c.beginPath(); c.moveTo(r * .3, -r * .22); c.lineTo(r * .3, r * .22); c.stroke(); // Unibrow
        // Flachmann-Glanz
        c.fillStyle = '#b8c0c8'; c.fillRect(-r * .1, r * .55, r * .2, r * .14);
    },
    meeseeks(c, r, now, h) {
        const wob = Math.sin(now / 90 + h * 20) * .1;
        bHuman(c, r, now, h, { col: '#5ab0ff', dark: '#1d6ac8', boots: '#1d6ac8', arm: '#5ab0ff', hand: '#5ab0ff', armIn: .55 + wob, handIn: .6 + wob });
        bEll(c, r * .05, 0, r * .42, r * .38, bGrad(c, r * .45, '#8ccaff', '#2a7ad8'), 'rgba(0,0,0,.3)');
        c.fillStyle = '#1d4a8a'; c.beginPath(); c.ellipse(r * .32, 0, r * .07, r * .18, 0, 0, Math.PI * 2); c.fill();
        for (const s of [-1, 1]) bEye(c, r * .22, s * r * .15, r * .07, '#fff', false);
    },
    gojo(c, r, now, h) {
        // Infinity: kreisendes Blau
        c.strokeStyle = `rgba(140,200,255,${.4 + .2 * Math.sin(now / 200)})`; c.lineWidth = 2;
        for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, 0, r * (1.25 + k * .22), now / 400 + k, now / 400 + k + Math.PI * 1.2); c.stroke(); }
        bHuman(c, r, now, h, { col: '#1c1f2a', dark: '#07080c', boots: '#07080c', arm: '#1c1f2a', armIn: .35, handIn: .12 });
        // hohe Kragen-Knoepfe
        c.fillStyle = '#c9a200'; c.beginPath(); c.arc(r * .3, 0, r * .07, 0, Math.PI * 2); c.fill();
        // weisses, nach oben stehendes Haar
        c.fillStyle = '#f4f8ff';
        c.beginPath();
        for (let k = 0; k <= 16; k++) { const t = k / 16 * Math.PI * 2, rr = k % 2 ? r * .36 : r * .56; const px = -r * .04 + Math.cos(t) * rr, py = Math.sin(t) * rr; k ? c.lineTo(px, py) : c.moveTo(px, py); }
        c.closePath(); c.fill();
        bEll(c, r * .05, 0, r * .32, r * .32, '#f0d8c0');
        c.fillStyle = '#f4f8ff'; c.beginPath(); c.ellipse(-r * .06, 0, r * .24, r * .3, 0, 0, Math.PI * 2); c.fill();
        // Augenbinde
        c.fillStyle = '#0a0a10'; c.fillRect(r * .2, -r * .3, r * .14, r * .6);
        // Hand-Zeichen: Hollow Purple glimmt
        const t = (Math.sin(now / 300) + 1) / 2;
        const hp = c.createRadialGradient(r * .75, -r * .12, 1, r * .75, -r * .12, r * .3);
        hp.addColorStop(0, `rgba(230,180,255,${.6 + .4 * t})`); hp.addColorStop(1, 'rgba(160,80,255,0)');
        c.fillStyle = hp; c.beginPath(); c.arc(r * .75, -r * .12, r * .3, 0, Math.PI * 2); c.fill();
    },
    tanya(c, r, now, h) {
        // fliegt: Mana-Fluegel
        c.fillStyle = `rgba(255,230,140,${.35 + .15 * Math.sin(now / 120)})`;
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-r * .2, s * r * .3); c.quadraticCurveTo(-r * 1.1, s * r * 1.3, -r * 1.3, s * r * .4); c.quadraticCurveTo(-r * .8, s * r * .5, -r * .2, s * r * .3); c.fill(); }
        // Gewehr mit Bajonett
        c.fillStyle = '#3a2a1c'; c.fillRect(r * .3, r * .08, r * 1.3, r * .16);
        c.fillStyle = '#c0c8d0'; c.fillRect(r * 1.6, r * .11, r * .4, r * .08);
        bHuman(c, r, now, h, { col: '#8a8a5a', dark: '#44442a', belt: '#3a2a18', boots: '#2a1c10', arm: '#7a7a4a', armIn: .3, handIn: .18 });
        // Orden: Elinium-Kristall (Anhaenger)
        const e = .6 + .4 * Math.sin(now / 150);
        c.fillStyle = `rgba(120,220,255,${e})`; c.beginPath(); c.moveTo(r * .35, -r * .08); c.lineTo(r * .45, 0); c.lineTo(r * .35, r * .08); c.lineTo(r * .25, 0); c.closePath(); c.fill();
        // blondes Haar mit Muetze
        bHead(c, r * .95, '#f4dcc4', '#f2d068');
        bEll(c, -r * .02, 0, r * .3, r * .32, '#5a5a3a', 'rgba(0,0,0,.4)', 1.5);
        c.fillStyle = '#c9a200'; c.beginPath(); c.arc(r * .12, 0, r * .07, 0, Math.PI * 2); c.fill();
    },
    mustang(c, r, now, h) {
        bHuman(c, r, now, h, { col: '#2e4ab8', dark: '#162466', belt: '#101a44', boots: '#0a0a14', arm: '#2e4ab8', hand: '#f4f6f8', armIn: .38, handIn: .18 });
        // Mantel-Schoesse
        c.fillStyle = '#233a9a'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-r * .2, s * r * .55); c.lineTo(-r * .85, s * r * .8); c.lineTo(-r * .6, s * r * .15); c.closePath(); c.fill(); }
        // Schulterstuecke
        for (const s of [-1, 1]) { c.fillStyle = '#c9a200'; c.fillRect(-r * .1, s * r * .62 - r * .06, r * .25, r * .12); }
        // Schnipp-Funken am Handschuh
        const t = (now / 500) % 1;
        if (t < .35) for (let k = 0; k < 5; k++) {
            const a2 = k / 5 * Math.PI * 2 + now / 50, d = t * r * 1.5;
            c.fillStyle = `rgba(255,${160 + k * 15},40,${1 - t * 2.5})`;
            c.beginPath(); c.arc(r * .8 + Math.cos(a2) * d, -r * .18 + Math.sin(a2) * d, 2.5, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#d23c3c'; c.beginPath(); c.arc(r * .78, -r * .18, r * .05, 0, Math.PI * 2); c.fill(); // Transmutationskreis
        bHead(c, r, '#f0d8c0', '#15151a');
    }
};

function gRRb(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
}


// ================= Spezial-Charaktere in Seitenansicht (25.09.2026) =================
// Figur steht aufrecht (Kopf oben), schaut nach links/rechts je nach Blickrichtung, Beine
// laufen, der Waffenarm zeigt auf den Winkel a. Einheit u = r/10, Figur ca. 5r hoch.
function bDrawSide(c, mb, def, now) {
    const r = (def.r || 20), u = r / 10, h = rHash(String(mb.id || mb.kind));
    const a = mb.a || 0, face = Math.cos(a) < 0 ? -1 : 1;
    const moving = mb._px !== undefined && Math.hypot(mb.x - mb._px, mb.y - mb._py) > .3;
    mb._px = mb.x; mb._py = mb.y;
    const t = now / 120 + h * 20, walk = Math.sin(t);
    const fly = mb.kind === 'tanya';
    const hover = fly ? Math.sin(now / 300 + h) * 4 * u - 10 * u : 0;
    // Schatten und Aura am Boden
    c.fillStyle = 'rgba(0,0,0,.4)';
    c.beginPath(); c.ellipse(mb.x, mb.y + r * .9, r * (fly ? .8 : 1.05), r * .3, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(mb.x, mb.y - r, r * .3, mb.x, mb.y - r, r * 2.8);
    g.addColorStop(0, B_AURA[mb.kind] || 'rgba(255,210,63,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(mb.x, mb.y - r, r * 2.8, 0, Math.PI * 2); c.fill();
    c.save();
    c.translate(mb.x, mb.y + r * .9 + hover);
    // Zielwinkel relativ zur Blickrichtung (fuer den Arm), dann spiegeln
    const aim = face > 0 ? a : Math.PI - a;
    c.scale(face, 1);
    B_SIDE[mb.kind](c, u, now, { face, walk: moving || fly ? walk : 0, aim: Math.max(-1.3, Math.min(1.3, ((aim + Math.PI) % (Math.PI * 2)) - Math.PI)), h, mb });
    c.restore();
    return true;
}

// Bausteine: Bein (Hose + Schuh), Arm mit Winkel, Kopf mit Gesicht
function sLeg(c, u, x, sw, pants, shoe, len = 16) {
    c.save(); c.translate(x, -len * u); c.rotate(sw * .45);
    c.fillStyle = pants; sRR(c, -2.4 * u, 0, 4.8 * u, len * u, 2 * u); c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(.6 * u, 0, 1.8 * u, len * u);
    c.fillStyle = shoe; sRR(c, -2.6 * u, (len - 2.2) * u, 7 * u, 3 * u, 1.4 * u); c.fill();
    c.restore();
}
function sArm(c, u, x, y, ang, sleeve, hand, len = 12, item) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.fillStyle = sleeve; sRR(c, -2.1 * u, -2.1 * u, len * u, 4.2 * u, 2 * u); c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, .6 * u, len * u - 2 * u, 1.4 * u);
    c.fillStyle = hand; c.beginPath(); c.arc(len * u, 0, 2.3 * u, 0, Math.PI * 2); c.fill();
    if (item) item(len * u);
    c.restore();
}
function sRR(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function sTorso(c, u, top, bot, w, col, dark) {
    const g = c.createLinearGradient(-w * u, 0, w * u, 0);
    g.addColorStop(0, dark); g.addColorStop(.45, col); g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-w * u, top * u); c.lineTo(w * u, top * u); c.lineTo(w * .85 * u, bot * u); c.lineTo(-w * .85 * u, bot * u); c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1; c.stroke();
}
function sHead(c, u, y, skin, rad = 6.2) {
    const g = c.createRadialGradient(1.5 * u, y - 2 * u, 1, 0, y, rad * u * 1.2);
    g.addColorStop(0, '#fff0e0'); g.addColorStop(.35, skin); g.addColorStop(1, 'rgba(120,70,40,1)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, y, rad * u, rad * 1.08 * u, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.stroke();
    // Ohr, Nase (Profil nach rechts)
    c.fillStyle = skin; c.beginPath(); c.ellipse(-1.2 * u, y + .5 * u, 1.3 * u, 1.9 * u, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = skin; c.beginPath(); c.moveTo(rad * .92 * u, y - .5 * u); c.lineTo(rad * 1.18 * u, y + 1.4 * u); c.lineTo(rad * .9 * u, y + 1.8 * u); c.closePath(); c.fill();
}
function sGlow(c, x, y, r, col, a = .7) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}

const B_SIDE = {
    // Rick Sanchez: Laborkittel, blaugraues Stachelhaar, Unibrow, Sabber, Portal-Gun, Flachmann
    rick(c, u, now, o) {
        const w = o.walk;
        sLeg(c, u, -2 * u, -w, '#6b4a2a', '#2a1a0e'); // hinteres Bein (dunkler)
        sArm(c, u, -1 * u, -38 * u, 1.6 + w * .3, '#d8dde2', '#e8cdb0', 11, L => { c.fillStyle = '#9aa3ad'; sRR(c, L - 1, -3 * u, 4 * u, 6 * u, 1 * u); c.fill(); });
        sLeg(c, u, 2 * u, w, '#7a5a38', '#3a2414');
        // Kittel (lang, offen), blaues Shirt darunter
        sTorso(c, u, -42, -12, 7, '#f4f6f8', '#b8c0c8');
        c.fillStyle = '#7fb8d9'; c.fillRect(1 * u, -41 * u, 4.5 * u, 22 * u);
        c.fillStyle = '#e8ecef'; c.beginPath(); c.moveTo(-7 * u, -14 * u); c.lineTo(-9 * u, -6 * u + w * u); c.lineTo(-2 * u, -8 * u); c.closePath(); c.fill();
        c.fillStyle = '#c8ced4'; c.beginPath(); c.moveTo(6 * u, -14 * u); c.lineTo(8 * u, -7 * u - w * u); c.lineTo(3 * u, -9 * u); c.closePath(); c.fill();
        c.strokeStyle = '#9aa3ad'; c.lineWidth = 1; c.beginPath(); c.moveTo(1 * u, -41 * u); c.lineTo(1 * u, -12 * u); c.stroke();
        // Kopf
        const hy = -49 * u;
        // Haar: Stacheln nach hinten/oben
        c.fillStyle = '#a8c8e0';
        c.beginPath();
        const sp = [[-8, -2], [-11, -7], [-7, -8], [-9, -13], [-4, -11], [-4, -16], [0, -12], [3, -15], [4, -9], [7, -8]];
        c.moveTo(6 * u, hy - 3 * u);
        for (const [x, y] of sp.reverse()) c.lineTo(x * u, hy + y * u);
        c.lineTo(-6 * u, hy + 4 * u); c.closePath(); c.fill();
        c.strokeStyle = '#6a8aa0'; c.lineWidth = 1; c.stroke();
        sHead(c, u, hy, '#f0d8c0', 6.4);
        c.fillStyle = '#a8c8e0'; c.beginPath(); c.ellipse(-3 * u, hy - 3 * u, 4 * u, 3.5 * u, -.4, 0, Math.PI * 2); c.fill();
        // Unibrow, Auge mit Ringen, Mund offen mit Sabber
        c.strokeStyle = '#7a9ab0'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(1 * u, hy - 3 * u); c.lineTo(6.5 * u, hy - 2.2 * u); c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(4.2 * u, hy - .5 * u, 1.6 * u, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#111'; c.beginPath(); c.arc(4.8 * u, hy - .4 * u, .7 * u, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(120,80,60,.6)'; c.lineWidth = .8; c.beginPath(); c.arc(4.2 * u, hy + .8 * u, 1.8 * u, .2, 2.4); c.stroke();
        c.fillStyle = '#5a2a2a'; c.beginPath(); c.ellipse(4.6 * u, hy + 3.6 * u, 1.8 * u, 1 * u, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(180,230,255,.8)'; c.fillRect(4 * u, hy + 4.2 * u, .7 * u, (2 + Math.sin(now / 300) * .8) * u);
        // Arm vorn mit Portal-Gun, zielt
        sArm(c, u, 2 * u, -38 * u, o.aim, '#eef2f5', '#e8cdb0', 11, L => {
            c.fillStyle = '#e9ecef'; sRR(c, L - 2 * u, -4 * u, 9 * u, 5 * u, 2 * u); c.fill();
            c.fillStyle = '#9cff7a'; sRR(c, L - 1 * u, -6.5 * u, 6 * u, 3 * u, 1.5 * u); c.fill();
            sGlow(c, L + 9 * u, -1.5 * u, 7 * u, 'rgba(110,255,80,A)', .9);
            c.fillStyle = '#e8ffd8'; c.beginPath(); c.arc(L + 8 * u, -1.5 * u, 1.8 * u, 0, Math.PI * 2); c.fill();
        });
    },
    meeseeks(c, u, now, o) {
        const w = o.walk, wob = Math.sin(now / 90 + o.h * 9);
        sLeg(c, u, -1.5 * u, -w, '#3a8ae0', '#3a8ae0', 18);
        sLeg(c, u, 1.5 * u, w, '#5ab0ff', '#5ab0ff', 18);
        sArm(c, u, -1 * u, -38 * u, -2.3 + wob * .4, '#4aa0f0', '#5ab0ff', 12);
        sTorso(c, u, -44, -16, 5, '#6ac0ff', '#2a7ad8');
        const hy = -52 * u;
        c.fillStyle = '#6ac0ff'; c.beginPath(); c.ellipse(0, hy, 6.5 * u, 8 * u, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(0,0,60,.4)'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.ellipse(3.5 * u, hy - 1.5 * u, 2.4 * u, 2.8 * u, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#111'; c.beginPath(); c.arc(4.2 * u, hy - 1.2 * u, 1 * u, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1d3a7a'; c.beginPath(); c.ellipse(4 * u, hy + 4 * u, 2.2 * u, 1.6 * u, 0, 0, Math.PI * 2); c.fill();
        sArm(c, u, 1.5 * u, -38 * u, -2.6 - wob * .4, '#6ac0ff', '#6ac0ff', 12);
        // Sprechblase „CAN DO!"
        if ((now / 1500 + o.h) % 3 < 1) {
            c.save(); c.scale(o.face, 1);
            c.fillStyle = '#fff'; sRR(c, 5 * u, -74 * u, 26 * u, 10 * u, 3 * u); c.fill();
            c.fillStyle = '#1d3a7a'; c.font = `bold ${Math.round(6 * u)}px system-ui`; c.textAlign = 'center'; c.fillText('CAN DO!', 18 * u, -67 * u);
            c.restore();
        }
    },
    // Satoru Gojo: schwarze Uniform mit hohem Kragen, weisses Haar, Augenbinde, Infinity-Blau
    gojo(c, u, now, o) {
        const w = o.walk;
        // Infinity: kreisende Ringe um die Figur
        c.save(); c.translate(0, -30 * u);
        for (let k = 0; k < 3; k++) {
            c.strokeStyle = `rgba(140,200,255,${.35 - k * .08})`; c.lineWidth = 2;
            c.beginPath(); c.ellipse(0, 0, (22 + k * 5) * u, (30 + k * 5) * u, 0, now / 500 + k * 2, now / 500 + k * 2 + 4); c.stroke();
        }
        c.restore();
        sLeg(c, u, -2 * u, -w, '#15161e', '#07080c', 17);
        sArm(c, u, -1 * u, -39 * u, 1.3 + w * .25, '#15161e', '#f0d8c0', 11);
        sLeg(c, u, 2 * u, w, '#1c1f2a', '#0a0a10', 17);
        sTorso(c, u, -44, -15, 6.5, '#262a38', '#0c0d12');
        // hoher Kragen, goldener Knopf
        c.fillStyle = '#0c0d12'; sRR(c, -4 * u, -47 * u, 9 * u, 5 * u, 1.5 * u); c.fill();
        c.fillStyle = '#e0b030'; c.beginPath(); c.arc(4 * u, -38 * u, 1 * u, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(4 * u, -30 * u, 1 * u, 0, Math.PI * 2); c.fill();
        const hy = -53 * u;
        sHead(c, u, hy, '#f2dcc6', 6);
        // weisses Stachelhaar nach oben
        c.fillStyle = '#f6faff';
        c.beginPath(); c.moveTo(-6.5 * u, hy + 2 * u);
        for (const [x, y] of [[-9, -2], [-7, -6], [-9, -10], [-4, -9], [-4, -15], [0, -10], [2, -16], [4, -9], [8, -12], [7, -5], [6.5, -3]]) c.lineTo(x * u, hy + y * u);
        c.lineTo(5.5 * u, hy - 2 * u); c.lineTo(-3 * u, hy - 3 * u); c.closePath(); c.fill();
        c.strokeStyle = '#b8c8e0'; c.lineWidth = 1; c.stroke();
        // Augenbinde
        c.fillStyle = '#0a0a10'; sRR(c, -6.4 * u, hy - 3 * u, 13.4 * u, 3.6 * u, 1 * u); c.fill();
        c.fillStyle = '#9a6a4a'; c.fillRect(4.5 * u, hy + 3 * u, 2.5 * u, .8 * u);
        // Hand vorn: Hollow Purple
        sArm(c, u, 2 * u, -39 * u, o.aim, '#262a38', '#f2dcc6', 10, L => {
            const p = (Math.sin(now / 250) + 1) / 2;
            sGlow(c, L + 5 * u, 0, (8 + p * 3) * u, 'rgba(190,120,255,A)', .95);
            c.fillStyle = '#fff'; c.beginPath(); c.arc(L + 5 * u, 0, 2.2 * u, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(255,90,90,.9)'; c.lineWidth = 1.5; c.beginPath(); c.arc(L + 5 * u, 0, 4.5 * u, now / 150, now / 150 + 2); c.stroke();
            c.strokeStyle = 'rgba(90,160,255,.9)'; c.beginPath(); c.arc(L + 5 * u, 0, 4.5 * u, now / 150 + Math.PI, now / 150 + Math.PI + 2); c.stroke();
        });
    },
    // Tanya Degurechaff: klein, blond, Uniform mit Muetze, Gewehr mit Bajonett, fliegt, Elinium
    tanya(c, u, now, o) {
        // Mana-Fluegel / Schweif
        for (let k = 0; k < 4; k++) {
            c.fillStyle = `rgba(255,230,140,${.28 - k * .06})`;
            c.beginPath(); c.moveTo(-3 * u, -24 * u); c.quadraticCurveTo(-(18 + k * 6) * u, -(36 + k * 4) * u, -(24 + k * 6) * u, -(12 - k * 2) * u); c.quadraticCurveTo(-14 * u, -20 * u, -3 * u, -18 * u); c.fill();
        }
        c.fillStyle = 'rgba(255,240,180,.5)';
        for (let k = 0; k < 5; k++) { const p = (now / 700 + k / 5) % 1; c.beginPath(); c.arc(-p * 20 * u, 2 * u + p * 4 * u, (1.6 - p) * u, 0, Math.PI * 2); c.fill(); }
        sLeg(c, u, -1.5 * u, .5, '#4a4a2a', '#1a1208', 13);
        sLeg(c, u, 1.5 * u, .2, '#5a5a34', '#2a1c10', 13);
        sArm(c, u, -1 * u, -30 * u, 1.2, '#6a6a40', '#f4dcc4', 9);
        sTorso(c, u, -34, -12, 5.5, '#7a7a4a', '#44442a');
        c.fillStyle = '#3a2a18'; c.fillRect(-5 * u, -20 * u, 10.5 * u, 2 * u);
        // Elinium-Kristall
        const e = .6 + .4 * Math.sin(now / 150);
        sGlow(c, 3 * u, -28 * u, 5 * u, 'rgba(120,220,255,A)', e);
        c.fillStyle = '#9fe8ff'; c.beginPath(); c.moveTo(3 * u, -31 * u); c.lineTo(4.5 * u, -28 * u); c.lineTo(3 * u, -25 * u); c.lineTo(1.5 * u, -28 * u); c.closePath(); c.fill();
        const hy = -40 * u;
        // blondes Haar hinten
        c.fillStyle = '#f2d068'; c.beginPath(); c.ellipse(-2 * u, hy + 2 * u, 6 * u, 7 * u, 0, 0, Math.PI * 2); c.fill();
        sHead(c, u, hy, '#f6e0cc', 5.4);
        c.fillStyle = '#f2d068'; c.beginPath(); c.moveTo(-5 * u, hy - 2 * u); c.quadraticCurveTo(2 * u, hy - 7 * u, 5.5 * u, hy - 1 * u); c.lineTo(3 * u, hy - 2.5 * u); c.lineTo(1 * u, hy); c.lineTo(-1 * u, hy - 2 * u); c.closePath(); c.fill();
        // Muetze
        c.fillStyle = '#5a5a3a'; sRR(c, -5.5 * u, hy - 8 * u, 11 * u, 4.5 * u, 1.5 * u); c.fill();
        c.fillStyle = '#2a2a1a'; c.fillRect(1 * u, hy - 4 * u, 7 * u, 1.3 * u);
        c.fillStyle = '#e0b030'; c.beginPath(); c.arc(2.5 * u, hy - 5.8 * u, 1 * u, 0, Math.PI * 2); c.fill();
        // blaues Auge, boeses Grinsen
        c.fillStyle = '#2a7ae0'; c.beginPath(); c.arc(3.4 * u, hy - .2 * u, 1 * u, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#6a2a1a'; c.lineWidth = .9; c.beginPath(); c.moveTo(2.4 * u, hy + 2.6 * u); c.quadraticCurveTo(3.8 * u, hy + 3.6 * u, 5 * u, hy + 2 * u); c.stroke();
        // Gewehr
        sArm(c, u, 2 * u, -30 * u, o.aim, '#7a7a4a', '#f4dcc4', 9, L => {
            c.fillStyle = '#4a3020'; sRR(c, L - 8 * u, -1.5 * u, 12 * u, 3.5 * u, 1 * u); c.fill();
            c.fillStyle = '#2a2a2e'; c.fillRect(L, -1 * u, 14 * u, 2 * u);
            c.fillStyle = '#c8d0d8'; c.beginPath(); c.moveTo(L + 14 * u, -1 * u); c.lineTo(L + 21 * u, 0); c.lineTo(L + 14 * u, 1 * u); c.closePath(); c.fill();
            sGlow(c, L + 14 * u, 0, 4 * u, 'rgba(255,220,120,A)', .6 * e);
        });
    },
    // Roy Mustang: blaue Uniform mit Goldlitzen, schwarzes Haar, weisse Handschuhe, Schnipp-Flamme
    mustang(c, u, now, o) {
        const w = o.walk;
        sLeg(c, u, -2 * u, -w, '#1a2a70', '#0a0a14');
        sArm(c, u, -1 * u, -39 * u, 1.4 + w * .25, '#223a9a', '#f8f8f8', 11);
        sLeg(c, u, 2 * u, w, '#223a8a', '#101018');
        // langer Mantel
        sTorso(c, u, -43, -10, 7.5, '#2e4ab8', '#162466');
        c.fillStyle = '#233a9a'; c.beginPath(); c.moveTo(-7 * u, -14 * u); c.lineTo(-9.5 * u, -5 * u + w * u); c.lineTo(-1 * u, -8 * u); c.closePath(); c.fill();
        c.fillStyle = '#e0b030'; for (const y of [-40, -34, -28, -22]) { c.beginPath(); c.arc(3.5 * u, y * u, .9 * u, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#e0b030'; sRR(c, -5 * u, -44 * u, 8 * u, 2.2 * u, 1 * u); c.fill(); // Schulterstueck
        c.fillStyle = '#101a44'; c.fillRect(-7 * u, -24 * u, 14.5 * u, 2 * u); // Guertel
        const hy = -50 * u;
        sHead(c, u, hy, '#f2dcc6', 6);
        // schwarzes Haar mit Strähnen ins Gesicht
        c.fillStyle = '#15151a';
        c.beginPath(); c.moveTo(-6.5 * u, hy + 3 * u); c.quadraticCurveTo(-8 * u, hy - 8 * u, 1 * u, hy - 7.5 * u); c.quadraticCurveTo(7 * u, hy - 7 * u, 7 * u, hy - 1 * u);
        c.lineTo(5 * u, hy - 3 * u); c.lineTo(4.5 * u, hy + 1 * u); c.lineTo(3 * u, hy - 3 * u); c.lineTo(1 * u, hy - 1 * u); c.lineTo(-2 * u, hy - 3 * u); c.lineTo(-4 * u, hy + 3 * u); c.closePath(); c.fill();
        c.fillStyle = '#111'; c.fillRect(3.2 * u, hy - .2 * u, 2.2 * u, .9 * u);
        c.strokeStyle = '#8a5a4a'; c.lineWidth = .9; c.beginPath(); c.moveTo(3 * u, hy + 3 * u); c.lineTo(5.2 * u, hy + 2.6 * u); c.stroke();
        // Schnipp-Hand mit Funken und Flamme
        sArm(c, u, 2 * u, -39 * u, o.aim, '#2e4ab8', '#fafafa', 11, L => {
            c.strokeStyle = '#d23c3c'; c.lineWidth = .8; c.beginPath(); c.arc(L, 0, 1.4 * u, 0, Math.PI * 2); c.stroke();
            const t = (now / 600) % 1;
            if (t < .45) {
                const k = t / .45;
                sGlow(c, L + 6 * u + k * 10 * u, 0, (6 + k * 8) * u, 'rgba(255,140,30,A)', .9 * (1 - k));
                for (let i = 0; i < 6; i++) { const aa = i / 6 * Math.PI * 2 + now / 40, d = (2 + k * 9) * u; c.fillStyle = `rgba(255,${180 + i * 12},60,${1 - k})`; c.beginPath(); c.arc(L + 3 * u + Math.cos(aa) * d, Math.sin(aa) * d, 1.2 * u, 0, Math.PI * 2); c.fill(); }
            }
        });
    }
};
