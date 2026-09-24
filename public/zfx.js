// Zombie-Optik (6.5): neue Zombie-Arten, die Zombie-Bosse, ihre Kugeln,
// Einschlaege, Effekte und die Boss-Vorstellung. index.html ruft die Funktionen
// an wenigen Stellen auf; jede gibt true zurueck, wenn sie gezeichnet hat.
// Gezeichnet wird in Weltkoordinaten auf dem Arena-Canvas.

const ZB_COL = {
    abomination: '184,79,255', necro: '124,255,178', brood: '255,123,58',
    inferno: '255,90,30', storm: '90,216,255', overlord: '200,107,255'
};
const ZB_NEW = ['necro', 'brood', 'inferno', 'storm', 'overlord'];

// Kleine Helfer
const zHash = id => {
    const n = parseInt(String(id).replace(/\D/g, ''), 10) || 0;
    return (n * 9301 + 49297) % 233280 / 233280;
};
function zGlow(c, x, y, r, rgb, a) {
    const g = c.createRadialGradient(x, y, r * .2, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
}
function zBolt(c, x0, y0, x1, y1, jag, segs) {
    c.moveTo(x0, y0);
    for (let j = 1; j < segs; j++) {
        c.lineTo(x0 + (x1 - x0) * j / segs + (Math.random() - .5) * jag, y0 + (y1 - y0) * j / segs + (Math.random() - .5) * jag);
    }
    c.lineTo(x1, y1);
}
function zShade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round((n >> 16) * f)), g = Math.min(255, Math.round((n >> 8 & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${g},${b})`;
}

// ---------- Normale Zombies ----------
function zDrawMob(c, mb, def, now) {
    if (!def.zombie || def.boss) return false;
    const h = zHash(mb.id);
    const kind = mb.kind;
    const a = mb.a || 0;
    const ca = Math.cos(a), sa = Math.sin(a);
    let r = def.r;
    if (def.boom) r *= 1 + .07 * Math.sin(now / 140 + h * 10);
    const bob = Math.sin(now / 110 + h * 20) * 1.6;
    const x = mb.x, y = mb.y + bob;

    // Sprung angekuendigt (Leaper): gestrichelte Bahn
    if (mb.warn) {
        const k = Math.max(0, Math.min(1, 1 - mb.warn / 600));
        c.strokeStyle = `rgba(255,170,60,${.35 + .5 * k})`;
        c.lineWidth = 3 + 4 * k;
        c.setLineDash([10, 8]);
        c.beginPath();
        c.moveTo(mb.x, mb.y);
        c.lineTo(mb.cx, mb.cy);
        c.stroke();
        c.setLineDash([]);
    }
    // Tempo-Streifen (Runner, springender Leaper)
    if (kind === 'runner' || mb.charging) {
        c.strokeStyle = `rgba(${mb.charging ? '255,190,90' : '200,255,150'},.35)`;
        c.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
            const ox = -sa * i * r * .5, oy = ca * i * r * .5;
            c.beginPath();
            c.moveTo(x - ca * r + ox, y - sa * r + oy);
            c.lineTo(x - ca * (r + 18 + (mb.charging ? 30 : 0)) + ox, y - sa * (r + 18 + (mb.charging ? 30 : 0)) + oy);
            c.stroke();
        }
    }
    // Schatten
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath();
    c.ellipse(mb.x, mb.y + r * .8, r, r * .45, 0, 0, Math.PI * 2);
    c.fill();

    c.save();
    if (def.ghost) {
        // Schemen: halb durchsichtig mit Schleier dahinter
        c.globalAlpha = .5 + .15 * Math.sin(now / 200 + h * 7);
        for (let i = 1; i <= 3; i++) {
            c.fillStyle = `rgba(159,183,255,${.18 / i})`;
            c.beginPath();
            c.arc(x - ca * i * 9, y - sa * i * 9, r * (1 - i * .12), 0, Math.PI * 2);
            c.fill();
        }
    }
    // Aura je Art
    if (def.boom) zGlow(c, x, y, r * 1.9, '166,226,46', .28);
    if (kind === 'acid') zGlow(c, x, y, r * 2, '57,255,136', .22);
    if (kind === 'screamer') {
        // Schallwellen nach vorn
        const t = (now / 700 + h) % 1;
        for (let i = 0; i < 2; i++) {
            const tt = (t + i * .5) % 1;
            c.strokeStyle = `rgba(255,107,213,${.6 * (1 - tt)})`;
            c.lineWidth = 3;
            c.beginPath();
            c.arc(x, y, r + 6 + tt * 50, a - .7, a + .7);
            c.stroke();
        }
    }
    // Arme greifen nach vorn und schwingen
    if (kind !== 'spiderling' && kind !== 'acid' && kind !== 'spitter') {
        const sw = Math.sin(now / 140 + h * 30) * .25;
        c.strokeStyle = zShade(def.color, .75);
        c.lineWidth = Math.max(3, r * .32);
        c.lineCap = 'round';
        for (const s of [-1, 1]) {
            const aa = a + s * .55;
            const bx = x + Math.cos(aa) * r * .7, by = y + Math.sin(aa) * r * .7;
            const reach = r * (0.9 + .25 * Math.sin(now / 160 + s + h * 9)) ;
            const ex = bx + Math.cos(a + s * sw) * reach, ey = by + Math.sin(a + s * sw) * reach;
            c.beginPath();
            c.moveTo(bx, by);
            c.lineTo(ex, ey);
            c.stroke();
        }
        c.lineCap = 'butt';
    }
    if (kind === 'spiderling') {
        c.strokeStyle = '#3a2618';
        c.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const s = i < 4 ? -1 : 1, j = i % 4;
            const la = a + s * (0.6 + j * .45) + Math.sin(now / 50 + i) * .2;
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + Math.cos(la) * r * 1.9, y + Math.sin(la) * r * 1.9);
            c.stroke();
        }
    }
    // Koerper
    const g = c.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
    g.addColorStop(0, zShade(def.color, 1.25));
    g.addColorStop(1, zShade(def.color, .55));
    c.fillStyle = g;
    c.strokeStyle = 'rgba(0,0,0,.55)';
    c.lineWidth = 2;
    c.beginPath();
    if (kind === 'tank' || def.armored) {
        // kantig
        for (let i = 0; i < 8; i++) {
            const t = a + i / 8 * Math.PI * 2;
            const px = x + Math.cos(t) * r, py = y + Math.sin(t) * r;
            i ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath();
    } else c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // Pusteln (Bloater), Blasen (Saeure)
    if (def.boom || kind === 'acid') {
        c.fillStyle = def.boom ? 'rgba(220,255,120,.8)' : 'rgba(150,255,190,.8)';
        for (let i = 0; i < 4; i++) {
            const t = i * 1.7 + h * 6 + (kind === 'acid' ? now / 400 : 0);
            const pr = r * (.15 + .08 * Math.sin(now / 200 + i));
            c.beginPath();
            c.arc(x + Math.cos(t) * r * .55, y + Math.sin(t) * r * .55, pr, 0, Math.PI * 2);
            c.fill();
        }
    }
    // Schild vorn (Riot)
    if (def.armored) {
        c.strokeStyle = '#dfe7f0';
        c.lineWidth = 6;
        c.beginPath();
        c.arc(x, y, r + 7, a - .85, a + .85);
        c.stroke();
        c.strokeStyle = 'rgba(90,110,140,.9)';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y, r + 10, a - .8, a + .8);
        c.stroke();
    }
    // Augen
    const eyeCol = def.ghost ? '#cfe0ff' : kind === 'screamer' ? '#ff9be6' : kind === 'acid' ? '#b6ff7a' : '#ff3b3b';
    c.fillStyle = eyeCol;
    c.shadowColor = eyeCol;
    c.shadowBlur = 8;
    for (const s of [-1, 1]) {
        c.beginPath();
        c.arc(x + ca * r * .55 - sa * s * r * .3, y + sa * r * .55 + ca * s * r * .3, Math.max(2, r * .13), 0, Math.PI * 2);
        c.fill();
    }
    c.shadowBlur = 0;
    c.restore();
    drawEmojiC(c, def.icon, x, y + 1, r * 1.05);
    // Lebensleiste
    if (mb.hp < mb.mh) {
        const bw = Math.max(26, r * 2.4);
        c.fillStyle = 'rgba(0,0,0,.7)';
        c.fillRect(mb.x - bw / 2, mb.y - r - 14, bw, 5);
        c.fillStyle = def.armored ? '#bcd0e8' : '#ffb347';
        c.fillRect(mb.x - bw / 2 + 1, mb.y - r - 13, (bw - 2) * mb.hp / mb.mh, 3);
    }
    return true;
}

// ---------- Bosse ----------
// Umgebung (Wut, Spirale, Wirbel, Strahl) + Koerper. Nur die neuen Arten;
// Abomination & Co. zeichnet index.html wie bisher (Wut-Aura kommt von hier).
function zBossAura(c, bs, BR, now) {
    const rgb = ZB_COL[bs.kind];
    if (!rgb) return;
    const def = bs.def;
    // Wirbel: Spiralarme bis zum Rand
    if (bs.vortex && def.vortexR) {
        const R = def.vortexR;
        c.save();
        c.translate(bs.x, bs.y);
        for (let arm = 0; arm < 5; arm++) {
            c.strokeStyle = `rgba(${rgb},.35)`;
            c.lineWidth = 5;
            c.beginPath();
            for (let t = 0; t <= 1; t += .04) {
                const ang = arm / 5 * Math.PI * 2 + t * 4 - now / 260;
                const rr = BR + (R - BR) * t;
                const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
                t ? c.lineTo(px, py) : c.moveTo(px, py);
            }
            c.stroke();
        }
        c.strokeStyle = `rgba(${rgb},.5)`;
        c.setLineDash([16, 14]);
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, R, -now / 900, -now / 900 + Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        c.restore();
    }
    // Spirale: Zauberkreis unter dem Boss
    if (bs.spiral) {
        c.save();
        c.translate(bs.x, bs.y);
        c.rotate(now / 400);
        c.strokeStyle = `rgba(${rgb},.8)`;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, BR * 1.9, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.arc(0, 0, BR * 1.55, 0, Math.PI * 2);
        c.stroke();
        for (let i = 0; i < 6; i++) {
            const t = i / 6 * Math.PI * 2;
            c.beginPath();
            c.moveTo(Math.cos(t) * BR * 1.9, Math.sin(t) * BR * 1.9);
            c.lineTo(Math.cos(t + Math.PI * 2 / 3) * BR * 1.9, Math.sin(t + Math.PI * 2 / 3) * BR * 1.9);
            c.stroke();
        }
        c.restore();
    }
    // Wut: pulsierender roter Ring, Funken
    if (bs.enraged) {
        const p = .5 + .5 * Math.sin(now / 90);
        zGlow(c, bs.x, bs.y, BR * 2.6, '255,40,40', .25 + .2 * p);
        c.strokeStyle = `rgba(255,60,60,${.5 + .4 * p})`;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(bs.x, bs.y, BR * (1.35 + .1 * p), 0, Math.PI * 2);
        c.stroke();
        for (let i = 0; i < 10; i++) {
            const t = (now / 900 + i / 10) % 1, ang = i * 2.4;
            c.fillStyle = `rgba(255,${120 + i * 10},60,${1 - t})`;
            c.beginPath();
            c.arc(bs.x + Math.cos(ang) * BR * (1 + t * .8), bs.y + Math.sin(ang) * BR * (1 + t * .8) - t * 30, 3.5 * (1 - t) + 1, 0, Math.PI * 2);
            c.fill();
        }
    }
    // Strahl: Vorwarnung als flackernde Linie, dann der Strahl
    if (bs.beamA !== null && bs.beamA !== undefined && def.beamLen) {
        const angs = def.beamTwin ? [bs.beamA, bs.beamA + Math.PI] : [bs.beamA];
        for (const ang of angs) {
            c.save();
            c.translate(bs.x, bs.y);
            c.rotate(ang);
            if (bs.beamWarn) {
                const k = Math.max(0, Math.min(1, 1 - bs.beamWarn / 1200));
                c.fillStyle = `rgba(${rgb},${.1 + .15 * k})`;
                c.fillRect(0, -def.beamW, def.beamLen, def.beamW * 2);
                c.strokeStyle = `rgba(255,255,255,${(.3 + .6 * k) * (.6 + .4 * Math.sin(now / 50))})`;
                c.lineWidth = 2;
                c.setLineDash([20, 12]);
                c.beginPath();
                c.moveTo(0, 0);
                c.lineTo(def.beamLen, 0);
                c.stroke();
                c.setLineDash([]);
            } else {
                const w = def.beamW;
                const g = c.createLinearGradient(0, -w * 1.6, 0, w * 1.6);
                g.addColorStop(0, `rgba(${rgb},0)`);
                g.addColorStop(.5, `rgba(${rgb},.55)`);
                g.addColorStop(1, `rgba(${rgb},0)`);
                c.fillStyle = g;
                c.fillRect(0, -w * 1.6, def.beamLen, w * 3.2);
                c.fillStyle = 'rgba(255,255,255,.9)';
                c.fillRect(0, -w * .28, def.beamLen, w * .56);
                // Blitze im Strahl
                c.strokeStyle = `rgba(${rgb},.95)`;
                c.lineWidth = 2;
                c.beginPath();
                zBolt(c, 0, 0, def.beamLen, 0, w * 1.3, 18);
                c.stroke();
                zGlow(c, def.beamLen, 0, w * 1.8, rgb, .6);
            }
            c.restore();
        }
    }
}

function zDrawBoss(c, bs, BR, now) {
    zBossAura(c, bs, BR, now);
    if (!ZB_NEW.includes(bs.kind)) return false;
    const x = bs.x, a = bs.a, rgb = ZB_COL[bs.kind];
    // Auftritt: waechst aus dem Boden
    const grow = bs.intro ? Math.max(.15, 1 - bs.intro / 2800) : 1;
    zGlow(c, x, bs.y, BR * 2.3, rgb, bs.enraged ? .55 : .35);
    c.save();
    c.translate(x, bs.y);
    c.scale(grow, grow);
    if (bs.kind === 'necro') {
        const fl = Math.sin(now / 350) * 5;
        c.translate(0, fl);
        // Seelen kreisen
        for (let i = 0; i < 4; i++) {
            const t = now / 600 + i / 4 * Math.PI * 2;
            const px = Math.cos(t) * BR * 1.5, py = Math.sin(t) * BR * 1.1;
            for (let j = 0; j < 5; j++) {
                const tt = t - j * .12;
                c.fillStyle = `rgba(124,255,178,${.5 - j * .09})`;
                c.beginPath();
                c.arc(Math.cos(tt) * BR * 1.5, Math.sin(tt) * BR * 1.1, 7 - j, 0, Math.PI * 2);
                c.fill();
            }
            c.fillStyle = '#e8fff2';
            c.beginPath();
            c.arc(px, py, 4, 0, Math.PI * 2);
            c.fill();
        }
        // Robe mit zerfetztem Saum
        c.fillStyle = '#1b1426';
        c.strokeStyle = '#7cffb2';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-BR * .55, -BR * .6);
        c.lineTo(BR * .55, -BR * .6);
        for (let i = 0; i <= 8; i++) {
            const px = BR * .9 - i / 8 * BR * 1.8;
            const py = BR * (.95 + .15 * Math.sin(now / 150 + i * 1.3)) + (i % 2 ? -BR * .15 : 0);
            c.lineTo(px, py);
        }
        c.closePath();
        c.fill();
        c.stroke();
        // Stab mit Kugel
        c.strokeStyle = '#6b4a2b';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(BR * .75, BR * .9);
        c.lineTo(BR * .95, -BR * 1.05);
        c.stroke();
        const orb = .6 + .4 * Math.sin(now / 120);
        zGlow(c, BR * .95, -BR * 1.15, 26 + 10 * orb, '124,255,178', .8);
        c.fillStyle = '#d9ffe9';
        c.beginPath();
        c.arc(BR * .95, -BR * 1.15, 8, 0, Math.PI * 2);
        c.fill();
        c.restore();
        drawEmojiC(c, '💀', x, bs.y - BR * .45 * grow + Math.sin(now / 350) * 5, BR * 1.1 * grow);
        return true;
    }
    if (bs.kind === 'brood') {
        c.rotate(a);
        // Acht Beine, laufen
        c.strokeStyle = '#2a1a10';
        c.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
            const s = i < 4 ? -1 : 1, j = i % 4;
            const ph = Math.sin(now / 90 + i * 1.7) * .25;
            const base = s * (0.55 + j * .42) + ph;
            const kx = Math.cos(base) * BR * 1.25, ky = Math.sin(base) * BR * 1.25;
            const fx = Math.cos(base + s * .5) * BR * 2, fy = Math.sin(base + s * .5) * BR * 2;
            c.lineWidth = 7;
            c.beginPath();
            c.moveTo(0, 0);
            c.lineTo(kx, ky);
            c.lineTo(fx, fy);
            c.stroke();
        }
        c.lineCap = 'butt';
        // Hinterleib mit Sanduhr
        const ab = c.createRadialGradient(-BR * .8, -BR * .2, 5, -BR * .7, 0, BR);
        ab.addColorStop(0, '#6b3a22');
        ab.addColorStop(1, '#1e110a');
        c.fillStyle = ab;
        c.beginPath();
        c.ellipse(-BR * .7, 0, BR * .95, BR * .75, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = bs.enraged ? '#ff2020' : '#e0301e';
        c.beginPath();
        c.moveTo(-BR * .95, -BR * .3); c.lineTo(-BR * .45, -BR * .3); c.lineTo(-BR * .7, 0);
        c.lineTo(-BR * .45, BR * .3); c.lineTo(-BR * .95, BR * .3); c.lineTo(-BR * .7, 0);
        c.closePath();
        c.fill();
        // Kopf mit vielen Augen
        c.fillStyle = '#2e1a10';
        c.beginPath();
        c.arc(BR * .35, 0, BR * .5, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ff4020';
        c.shadowColor = '#ff4020';
        c.shadowBlur = 10;
        for (const [ox, oy, rr] of [[.62, -.16, 6], [.62, .16, 6], [.5, -.3, 4], [.5, .3, 4], [.72, 0, 5], [.42, -.08, 3], [.42, .08, 3]]) {
            c.beginPath();
            c.arc(BR * ox, BR * oy, rr, 0, Math.PI * 2);
            c.fill();
        }
        c.shadowBlur = 0;
        // Kieferklauen
        c.strokeStyle = '#d8c0a0';
        c.lineWidth = 4;
        const bite = Math.sin(now / 110) * .2;
        for (const s of [-1, 1]) {
            c.beginPath();
            c.moveTo(BR * .75, s * BR * .15);
            c.quadraticCurveTo(BR * 1.05, s * BR * (.3 + bite), BR * 1.0, s * BR * .02);
            c.stroke();
        }
        c.restore();
        return true;
    }
    if (bs.kind === 'inferno') {
        // Glut steigt auf
        for (let i = 0; i < 14; i++) {
            const t = (now / 1300 + i / 14) % 1, ox = Math.sin(i * 7.3) * BR * 1.1;
            c.fillStyle = `rgba(255,${150 + (i % 3) * 30},40,${1 - t})`;
            c.beginPath();
            c.arc(ox + Math.sin(now / 300 + i) * 6, -t * BR * 2.2, 4 * (1 - t) + 1, 0, Math.PI * 2);
            c.fill();
        }
        // Flammenkrone
        for (let i = 0; i < 12; i++) {
            const t = i / 12 * Math.PI * 2;
            const fl = BR * (1.25 + .25 * Math.sin(now / 70 + i * 2.1));
            const g = c.createLinearGradient(Math.cos(t) * BR * .8, Math.sin(t) * BR * .8, Math.cos(t) * fl, Math.sin(t) * fl);
            g.addColorStop(0, 'rgba(255,220,80,.95)');
            g.addColorStop(1, 'rgba(255,40,0,0)');
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(Math.cos(t - .22) * BR * .85, Math.sin(t - .22) * BR * .85);
            c.lineTo(Math.cos(t) * fl, Math.sin(t) * fl);
            c.lineTo(Math.cos(t + .22) * BR * .85, Math.sin(t + .22) * BR * .85);
            c.closePath();
            c.fill();
        }
        // Lava-Koerper mit leuchtenden Rissen
        c.rotate(a);
        const body = c.createRadialGradient(-BR * .2, -BR * .2, 5, 0, 0, BR);
        body.addColorStop(0, '#5a2a18');
        body.addColorStop(1, '#1d0c06');
        c.fillStyle = body;
        c.beginPath();
        const jag = [1, .9, 1.06, .93, 1.02, .88, 1.08, .95, 1, .9];
        jag.forEach((j, i) => {
            const t = i / jag.length * Math.PI * 2;
            i ? c.lineTo(Math.cos(t) * BR * j, Math.sin(t) * BR * j) : c.moveTo(Math.cos(t) * BR * j, Math.sin(t) * BR * j);
        });
        c.closePath();
        c.fill();
        const glow = .55 + .45 * Math.sin(now / 160);
        c.strokeStyle = `rgba(255,${140 + 80 * glow},40,${.7 + .3 * glow})`;
        c.shadowColor = '#ff7a1e';
        c.shadowBlur = 14;
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(-BR * .7, -BR * .3); c.lineTo(-BR * .2, 0); c.lineTo(-BR * .45, BR * .55);
        c.moveTo(-BR * .2, 0); c.lineTo(BR * .3, -BR * .15); c.lineTo(BR * .15, -BR * .7);
        c.moveTo(BR * .3, -BR * .15); c.lineTo(BR * .6, BR * .4);
        c.stroke();
        // Augen
        c.fillStyle = '#fff2a0';
        for (const s of [-1, 1]) {
            c.beginPath();
            c.arc(BR * .55, s * BR * .25, 8, 0, Math.PI * 2);
            c.fill();
        }
        c.shadowBlur = 0;
        c.restore();
        return true;
    }
    if (bs.kind === 'storm') {
        // Nachbilder
        for (let i = 3; i >= 1; i--) {
            c.fillStyle = `rgba(90,216,255,${.08 * (4 - i)})`;
            c.beginPath();
            c.arc(-Math.cos(a) * i * 16, -Math.sin(a) * i * 16, BR * (1 - i * .08), 0, Math.PI * 2);
            c.fill();
        }
        // wirbelnder Mantel
        c.rotate(now / 500);
        for (let i = 0; i < 3; i++) {
            c.strokeStyle = `rgba(150,235,255,${.55 - i * .12})`;
            c.lineWidth = 6 - i;
            c.beginPath();
            c.arc(0, 0, BR * (1 - i * .18), i * 2, i * 2 + Math.PI * 1.4);
            c.stroke();
        }
        c.rotate(-now / 500);
        const core = c.createRadialGradient(0, 0, 2, 0, 0, BR * .8);
        core.addColorStop(0, '#ffffff');
        core.addColorStop(.35, '#9fefff');
        core.addColorStop(1, 'rgba(20,80,140,.2)');
        c.fillStyle = core;
        c.beginPath();
        c.arc(0, 0, BR * .8, 0, Math.PI * 2);
        c.fill();
        // knisternde Blitze um den Koerper
        c.strokeStyle = 'rgba(220,250,255,.95)';
        c.lineWidth = 2;
        c.beginPath();
        for (let i = 0; i < 4; i++) {
            const t = Math.random() * 6.28, t2 = t + (Math.random() - .5) * 1.5;
            zBolt(c, Math.cos(t) * BR * .6, Math.sin(t) * BR * .6, Math.cos(t2) * BR * 1.6, Math.sin(t2) * BR * 1.6, 14, 5);
        }
        c.stroke();
        // Augen
        c.fillStyle = '#fff';
        c.shadowColor = '#5ad8ff';
        c.shadowBlur = 12;
        for (const s of [-1, 1]) {
            c.beginPath();
            c.ellipse(Math.cos(a) * BR * .35 - Math.sin(a) * s * BR * .22, Math.sin(a) * BR * .35 + Math.cos(a) * s * BR * .22, 7, 4, a, 0, Math.PI * 2);
            c.fill();
        }
        c.shadowBlur = 0;
        c.restore();
        return true;
    }
    if (bs.kind === 'overlord') {
        // Tentakel
        c.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
            const base = i / 8 * Math.PI * 2 + now / 3000;
            c.strokeStyle = i % 2 ? '#3a1458' : '#52207a';
            c.lineWidth = 12;
            c.beginPath();
            c.moveTo(Math.cos(base) * BR * .8, Math.sin(base) * BR * .8);
            for (let t = 1; t <= 6; t++) {
                const ang = base + Math.sin(now / 300 + i + t * .7) * .35;
                const rr = BR * (.8 + t * .22);
                c.lineWidth = 12 - t * 1.6;
                c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
            }
            c.stroke();
        }
        c.lineCap = 'butt';
        // Leere um das Auge
        zGlow(c, 0, 0, BR * 1.4, '20,0,40', .9);
        // Augapfel mit Adern
        const sc = c.createRadialGradient(-BR * .25, -BR * .25, 5, 0, 0, BR * .95);
        sc.addColorStop(0, '#ffffff');
        sc.addColorStop(1, '#c9b3d9');
        c.fillStyle = sc;
        c.beginPath();
        c.arc(0, 0, BR * .95, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(200,30,60,.55)';
        c.lineWidth = 1.5;
        for (let i = 0; i < 9; i++) {
            const t = i * .7;
            c.beginPath();
            zBolt(c, Math.cos(t) * BR * .95, Math.sin(t) * BR * .95, Math.cos(t + .2) * BR * .5, Math.sin(t + .2) * BR * .5, 0, 1);
            c.stroke();
        }
        // Iris folgt dem Ziel
        const ix = Math.cos(a) * BR * .3, iy = Math.sin(a) * BR * .3;
        const ir = c.createRadialGradient(ix, iy, 2, ix, iy, BR * .5);
        ir.addColorStop(0, bs.enraged ? '#ff5050' : '#f0c8ff');
        ir.addColorStop(.5, bs.enraged ? '#b00020' : '#9a3fd8');
        ir.addColorStop(1, bs.enraged ? '#400010' : '#2a0a48');
        c.fillStyle = ir;
        c.beginPath();
        c.arc(ix, iy, BR * .5, 0, Math.PI * 2);
        c.fill();
        c.save();
        c.translate(ix, iy);
        c.rotate(now / 700);
        c.strokeStyle = 'rgba(255,255,255,.35)';
        c.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
            const t = i / 12 * Math.PI * 2;
            c.beginPath();
            c.moveTo(Math.cos(t) * BR * .22, Math.sin(t) * BR * .22);
            c.lineTo(Math.cos(t) * BR * .47, Math.sin(t) * BR * .47);
            c.stroke();
        }
        c.restore();
        // Pupille: schmal, weitet sich bei Wut
        c.fillStyle = '#000';
        c.beginPath();
        c.ellipse(ix + Math.cos(a) * 4, iy + Math.sin(a) * 4, BR * (bs.enraged ? .2 : .08), BR * .26, a, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,.8)';
        c.beginPath();
        c.arc(ix - BR * .12, iy - BR * .14, 5, 0, Math.PI * 2);
        c.fill();
        c.restore();
        return true;
    }
    c.restore();
    return false;
}

// ---------- Kugeln der Bosse (tier 11–15) ----------
function zDrawBullet(c, bx, by, vx, vy, sp, tier, now) {
    if (tier < 11 || tier > 15) return false;
    const ux = vx / sp, uy = vy / sp;
    if (tier === 11) {
        for (let k = 4; k >= 1; k--) {
            c.fillStyle = `rgba(124,255,178,${.28 - k * .05})`;
            c.beginPath();
            c.arc(bx - ux * k * 9 + Math.sin(now / 60 + k) * 3, by - uy * k * 9, 9 - k, 0, Math.PI * 2);
            c.fill();
        }
        zGlow(c, bx, by, 16, '124,255,178', .8);
        c.fillStyle = '#eafff3';
        c.beginPath();
        c.arc(bx, by, 5, 0, Math.PI * 2);
        c.fill();
    } else if (tier === 12) {
        c.strokeStyle = 'rgba(240,240,240,.9)';
        c.lineWidth = 1.5;
        c.beginPath();
        for (let i = 0; i < 6; i++) {
            const t = i / 6 * Math.PI * 2 + now / 300;
            c.moveTo(bx, by);
            c.lineTo(bx + Math.cos(t) * 10, by + Math.sin(t) * 10);
        }
        c.stroke();
        c.beginPath();
        c.arc(bx, by, 6, 0, Math.PI * 2);
        c.arc(bx, by, 10, 0, Math.PI * 2);
        c.stroke();
    } else if (tier === 13) {
        for (let k = 5; k >= 1; k--) {
            c.fillStyle = `rgba(255,${80 + k * 25},20,${.35 - k * .05})`;
            c.beginPath();
            c.arc(bx - ux * k * 8, by - uy * k * 8, 10 - k * 1.2, 0, Math.PI * 2);
            c.fill();
        }
        const g = c.createRadialGradient(bx, by, 1, bx, by, 11);
        g.addColorStop(0, '#fff6c0');
        g.addColorStop(.5, '#ffae30');
        g.addColorStop(1, 'rgba(255,60,0,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(bx, by, 11, 0, Math.PI * 2);
        c.fill();
    } else if (tier === 14) {
        c.strokeStyle = 'rgba(90,216,255,.5)';
        c.lineWidth = 7;
        c.beginPath();
        c.moveTo(bx - ux * 34, by - uy * 34);
        c.lineTo(bx, by);
        c.stroke();
        c.strokeStyle = '#f0fdff';
        c.lineWidth = 2.5;
        c.beginPath();
        zBolt(c, bx - ux * 34, by - uy * 34, bx, by, 8, 4);
        c.stroke();
    } else {
        zGlow(c, bx, by, 17, '200,107,255', .7);
        c.fillStyle = '#000';
        c.beginPath();
        c.arc(bx, by, 6, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#e0b0ff';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(bx, by, 8, now / 100, now / 100 + 4);
        c.stroke();
    }
    return true;
}

// ---------- Einschlaege: 1 Meteor, 2 Blitz, 3 Saeure ----------
function zDrawStrike(c, sx, sy, sr, k, look, now) {
    if (!look) return false;
    const rgb = look === 1 ? '255,90,30' : look === 2 ? '90,216,255' : '80,255,120';
    c.fillStyle = `rgba(${rgb},.1)`;
    c.beginPath();
    c.arc(sx, sy, sr, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = `rgba(${rgb},${.15 + .35 * k})`;
    c.beginPath();
    c.arc(sx, sy, sr * k, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = `rgba(${rgb},.95)`;
    c.lineWidth = 3;
    c.setLineDash(look === 2 ? [8, 6] : []);
    c.beginPath();
    c.arc(sx, sy, sr, now / 300, now / 300 + Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    if (look === 1) {
        // Meteor faellt schraeg herab
        const mx = sx - 260 * (1 - k), my = sy - 420 * (1 - k);
        for (let i = 6; i >= 1; i--) {
            c.fillStyle = `rgba(255,${100 + i * 20},30,${.3 - i * .04})`;
            c.beginPath();
            c.arc(mx - 26 * i * .6 * (1 - k * .3), my - 42 * i * .6 * (1 - k * .3), 22 - i * 2, 0, Math.PI * 2);
            c.fill();
        }
        zGlow(c, mx, my, 34, '255,160,40', .9);
        c.fillStyle = '#3a1a0a';
        c.beginPath();
        c.arc(mx, my, 13, 0, Math.PI * 2);
        c.fill();
    } else if (look === 2) {
        if (k > .75) {
            c.strokeStyle = `rgba(230,250,255,${(k - .75) * 4})`;
            c.lineWidth = 4;
            c.beginPath();
            zBolt(c, sx + (Math.random() - .5) * 40, sy - 500, sx, sy, 40, 9);
            c.stroke();
        }
        c.strokeStyle = 'rgba(200,245,255,.7)';
        c.lineWidth = 1.5;
        c.beginPath();
        for (let i = 0; i < 2; i++) {
            const t = Math.random() * 6.28;
            zBolt(c, sx, sy, sx + Math.cos(t) * sr, sy + Math.sin(t) * sr, 10, 4);
        }
        c.stroke();
    } else {
        // Saeure-Klumpen im Bogen, Blasen am Boden
        const hgt = Math.sin(k * Math.PI) * 120;
        c.fillStyle = '#6dff8e';
        c.beginPath();
        c.arc(sx, sy - hgt - (1 - k) * 60, 9, 0, Math.PI * 2);
        c.fill();
        for (let i = 0; i < 5; i++) {
            const t = (now / 500 + i / 5) % 1;
            c.fillStyle = `rgba(150,255,170,${.7 * (1 - t)})`;
            c.beginPath();
            c.arc(sx + Math.cos(i * 1.3) * sr * .5, sy + Math.sin(i * 1.3) * sr * .5 - t * 10, 4 * (1 - t) + 2, 0, Math.PI * 2);
            c.fill();
        }
    }
    return true;
}

// Saeure-Pfuetze statt Feuer
function zDrawAcid(c, x, y, r, now) {
    const p = .5 + .5 * Math.sin(now / 200 + x);
    c.fillStyle = `rgba(60,${200 + p * 40},90,.32)`;
    c.beginPath();
    for (let i = 0; i <= 16; i++) {
        const t = i / 16 * Math.PI * 2, rr = r * (1 + .08 * Math.sin(t * 3 + now / 400));
        i ? c.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr) : c.moveTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
    }
    c.closePath();
    c.fill();
    for (let i = 0; i < 6; i++) {
        const t = (now / 700 + i / 6) % 1;
        c.fillStyle = `rgba(180,255,190,${.8 * (1 - t)})`;
        c.beginPath();
        c.arc(x + Math.cos(i * 2.1) * r * .55, y + Math.sin(i * 2.1) * r * .55, 3 + 5 * t, 0, Math.PI * 2);
        c.fill();
    }
}

// ---------- Effekte ----------
const ZFX_MS = { bossin: 1600, bossdie: 2400, enrage: 1200, raise: 1000, vortex: 900, zblink: 650, acidboom: 750 };
function zFxMs(f) {
    return f.type === 'shFx' && ZFX_MS[f.kind] || 0;
}

function zDrawFx(c, f, k, now) {
    if (!zFxMs(f)) return false;
    const rgb = ZB_COL[f.boss] || '255,255,255';
    const x = f.x, y = f.y;
    if (f.kind === 'bossin') {
        // Portal: Ring waechst, Risse im Boden, dunkler Wirbel
        zGlow(c, x, y, 260 * Math.min(1, k * 2), '0,0,0', .7 * (1 - k));
        for (let i = 0; i < 3; i++) {
            const kk = Math.min(1, k * 1.5 - i * .15);
            if (kk <= 0) continue;
            c.strokeStyle = `rgba(${rgb},${1 - kk})`;
            c.lineWidth = 12 * (1 - kk) + 2;
            c.beginPath();
            c.arc(x, y, 60 + 300 * kk, 0, Math.PI * 2);
            c.stroke();
        }
        c.strokeStyle = `rgba(${rgb},${.8 * (1 - k)})`;
        c.lineWidth = 4;
        for (let i = 0; i < 10; i++) {
            const t = i / 10 * Math.PI * 2 + i;
            c.beginPath();
            c.moveTo(x, y);
            zBolt(c, x, y, x + Math.cos(t) * 200 * Math.min(1, k * 2.5), y + Math.sin(t) * 200 * Math.min(1, k * 2.5), 30, 5);
            c.stroke();
        }
        return true;
    }
    if (f.kind === 'bossdie') {
        // Blitz, viele Ringe, Splitter, Boss-Symbol waechst und verblasst
        if (k < .15) {
            c.fillStyle = `rgba(255,255,255,${.8 * (1 - k / .15)})`;
            c.beginPath();
            c.arc(x, y, 400, 0, Math.PI * 2);
            c.fill();
        }
        for (let i = 0; i < 5; i++) {
            const kk = Math.min(1, k * 1.4 - i * .12);
            if (kk <= 0) continue;
            c.strokeStyle = i % 2 ? `rgba(255,255,255,${.8 * (1 - kk)})` : `rgba(${rgb},${1 - kk})`;
            c.lineWidth = 16 * (1 - kk) + 2;
            c.beginPath();
            c.arc(x, y, 40 + 520 * kk, 0, Math.PI * 2);
            c.stroke();
        }
        for (let i = 0; i < 36; i++) {
            const t = i * 2.39996, sp = 180 + (i * 37 % 100) * 3.5;
            const px = x + Math.cos(t) * sp * k, py = y + Math.sin(t) * sp * k + 120 * k * k;
            c.fillStyle = i % 3 ? `rgba(${rgb},${1 - k})` : `rgba(255,240,200,${1 - k})`;
            c.beginPath();
            c.arc(px, py, 7 * (1 - k) + 2, 0, Math.PI * 2);
            c.fill();
        }
        c.globalAlpha = Math.max(0, 1 - k);
        const d = sh && sh.map.mobs && sh.map.mobs[f.boss];
        if (d) drawEmojiC(c, d.icon, x, y - k * 80, 80 + k * 140);
        c.globalAlpha = 1;
        return true;
    }
    if (f.kind === 'enrage') {
        for (let i = 0; i < 3; i++) {
            const kk = Math.min(1, k * 1.3 + i * .15);
            c.strokeStyle = `rgba(255,50,50,${1 - k})`;
            c.lineWidth = 8 * (1 - k) + 2;
            c.beginPath();
            c.arc(x, y, 320 * (1 - kk) + 40, 0, Math.PI * 2);
            c.stroke();
        }
        c.globalAlpha = Math.max(0, 1 - k);
        c.fillStyle = '#ff4d4d';
        c.font = `900 ${34 + k * 20}px system-ui`;
        c.textAlign = 'center';
        c.fillText('ENRAGED', x, y - 110 - k * 40);
        c.globalAlpha = 1;
        return true;
    }
    if (f.kind === 'raise') {
        c.strokeStyle = `rgba(${rgb},${1 - k})`;
        c.lineWidth = 5;
        c.beginPath();
        c.arc(x, y, 60 + 200 * k, 0, Math.PI * 2);
        c.stroke();
        for (let i = 0; i < 8; i++) {
            const t = i / 8 * Math.PI * 2;
            c.fillStyle = `rgba(${rgb},${.8 * (1 - k)})`;
            c.beginPath();
            c.arc(x + Math.cos(t) * (60 + 200 * k), y + Math.sin(t) * (60 + 200 * k) - k * 40, 8 * (1 - k) + 2, 0, Math.PI * 2);
            c.fill();
        }
        return true;
    }
    if (f.kind === 'vortex') {
        for (let i = 0; i < 3; i++) {
            const kk = (k + i / 3) % 1;
            c.strokeStyle = `rgba(${rgb},${.8 * kk})`;
            c.lineWidth = 6;
            c.beginPath();
            c.arc(x, y, 700 * (1 - kk) + 30, 0, Math.PI * 2);
            c.stroke();
        }
        return true;
    }
    if (f.kind === 'zblink') {
        zGlow(c, x, y, 70 * (1 - k) + 20, rgb, .8 * (1 - k));
        c.strokeStyle = `rgba(255,255,255,${1 - k})`;
        c.lineWidth = 2;
        c.beginPath();
        for (let i = 0; i < 6; i++) {
            const t = i / 6 * Math.PI * 2 + k * 3;
            c.moveTo(x + Math.cos(t) * 20, y + Math.sin(t) * 20);
            c.lineTo(x + Math.cos(t) * (30 + 60 * k), y + Math.sin(t) * (30 + 60 * k));
        }
        c.stroke();
        return true;
    }
    if (f.kind === 'acidboom') {
        const r = f.r || 120;
        zGlow(c, x, y, r * (.5 + k * .8), '120,255,80', .7 * (1 - k));
        for (let i = 0; i < 16; i++) {
            const t = i * 2.39996, sp = r * (.6 + (i % 4) * .2);
            c.fillStyle = `rgba(160,255,90,${1 - k})`;
            c.beginPath();
            c.arc(x + Math.cos(t) * sp * k, y + Math.sin(t) * sp * k - Math.sin(k * Math.PI) * 30, 6 * (1 - k) + 2, 0, Math.PI * 2);
            c.fill();
        }
        return true;
    }
    return false;
}

function zFxSound(d) {
    if (d.type !== 'shFx') return;
    if (d.kind === 'bossin') {
        sTone(48, { dur: 2.2, type: 'sawtooth', vol: .16, slide: 30, rev: .5, lp: 600 });
        sNoise({ dur: 1.4, vol: .22, type: 'lowpass', f: 400, f2: 60, rev: .4, a: .2 });
        shShake(18, 1400);
    } else if (d.kind === 'bossdie') {
        sNoise({ dur: 2, vol: .45, type: 'lowpass', f: 900, f2: 50, rev: .5, a: .002 });
        sTone(60, { dur: 2.4, type: 'sine', vol: .35, slide: 25, rev: .5 });
        [523, 659, 784, 1047, 1319].forEach((f, i) => sTone(f, { t: .4 + i * .1, dur: .7, type: 'triangle', vol: .07, rev: .5 }));
        shShake(36, 1600);
    } else if (d.kind === 'enrage') {
        sTone(90, { dur: 1, type: 'sawtooth', vol: .16, slide: 180, rev: .4 });
        sTone(135, { dur: 1, type: 'square', vol: .06, slide: 270, rev: .4 });
        shShake(14, 700);
    } else if (d.kind === 'raise') {
        sTone(220, { dur: .8, type: 'sine', vol: .08, slide: 110, rev: .5 });
    } else if (d.kind === 'vortex') {
        sTone(120, { dur: 3, type: 'sawtooth', vol: .08, slide: 40, rev: .6, lp: 400 });
    } else if (d.kind === 'zblink') {
        sTone(900, { dur: .15, type: 'sine', vol: .05, slide: 200, rev: .2 });
    } else if (d.kind === 'acidboom') {
        sNoise({ dur: .45, vol: .2, type: 'lowpass', f: 1400, f2: 200, rev: .3, a: .002 });
    }
}

// ---------- Vorstellung: Name im Vollbild ----------
function zBossIntro(d) {
    let el = document.getElementById('zb-intro');
    if (!el) {
        const st = document.createElement('style');
        st.textContent = `
#zb-intro{position:fixed;inset:0;z-index:60;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at center,rgba(0,0,0,.15) 0%,rgba(0,0,0,.75) 70%);opacity:0;font-family:system-ui,sans-serif}
#zb-intro.on{animation:zbIn 3.2s ease forwards}
#zb-intro .w{font:800 16px system-ui;letter-spacing:.5em;color:#fff;opacity:.8;text-transform:uppercase}
#zb-intro .i{font-size:120px;line-height:1.1;filter:drop-shadow(0 0 30px var(--zc));animation:zbIcon 3.2s ease forwards}
#zb-intro .n{font:900 clamp(36px,7vw,78px)/1 system-ui;color:#fff;text-shadow:0 0 24px var(--zc),0 0 60px var(--zc);letter-spacing:.04em;animation:zbName 3.2s ease forwards}
#zb-intro .t{font:700 clamp(14px,2.2vw,22px) system-ui;color:var(--zc);letter-spacing:.35em;text-transform:uppercase;margin-top:10px;animation:zbName 3.2s .15s ease both}
#zb-intro .bar{width:min(520px,80vw);height:4px;margin-top:18px;background:linear-gradient(90deg,transparent,var(--zc),transparent);animation:zbBar 3.2s ease forwards}
#zb-intro .h{margin-top:10px;color:#ffd0d0;font:700 14px system-ui;letter-spacing:.2em}
@keyframes zbIn{0%{opacity:0}10%{opacity:1}80%{opacity:1}100%{opacity:0}}
@keyframes zbIcon{0%{transform:scale(3) rotate(-20deg);opacity:0}18%{transform:scale(.9) rotate(4deg);opacity:1}26%{transform:scale(1.05)}100%{transform:scale(1)}}
@keyframes zbName{0%,12%{transform:translateY(30px) scale(1.3);opacity:0;filter:blur(8px)}28%{transform:none;opacity:1;filter:none}100%{opacity:1}}
@keyframes zbBar{0%,20%{transform:scaleX(0)}40%{transform:scaleX(1)}100%{transform:scaleX(1)}}`;
        document.head.appendChild(st);
        el = document.createElement('div');
        el.id = 'zb-intro';
        document.body.appendChild(el);
    }
    const rgb = ZB_COL[d.kind] || '255,60,60';
    el.style.setProperty('--zc', `rgb(${rgb})`);
    const esc2 = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    el.innerHTML = `<div class="w">Wave ${d.wave}${d.cycle ? ' · ' + '★'.repeat(Math.min(5, d.cycle)) : ''}</div><div class="i">${esc2(d.icon)}</div>` +
        `<div class="n">${esc2(d.name)}</div>${d.title ? `<div class="t">${esc2(d.title)}</div>` : ''}<div class="bar"></div>` +
        `<div class="h">${Number(d.hp).toLocaleString('en-US')} HP</div>`;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    sTone(70, { dur: 1.6, type: 'sawtooth', vol: .14, slide: 45, rev: .5, lp: 700 });
    sTone(105, { t: .1, dur: 1.4, type: 'square', vol: .05, slide: 70, rev: .5 });
    [220, 207, 196].forEach((f, i) => sBell(f, .35 + i * .25, .09, 1.2));
}

// ---------- Kek Mall: Boden, Deko, Mauern, Shops (6.5.1, Max: "deutlich schoener, mehr Leben") ----------
// Alles nur Optik: Deko blockiert nichts, Kollision bleibt wie gehabt.
const zIsMall = m => m && m.name === 'Kek Mall';
let zMallDeco = null;
function zMallBuild(m) {
    if (zMallDeco && zMallDeco.m === m) return zMallDeco;
    let seed = 4242;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const inWall = (x, y, pad) => m.walls.some(([wx, wy, ww, wh]) => x > wx - pad && x < wx + ww + pad && y > wy - pad && y < wy + wh + pad);
    const nearStation = (x, y, pad) => (m.stations || []).some(s => Math.hypot(s.x - x, s.y - y) < pad);
    const pick = (n, pad, avoidMid) => {
        const out = [];
        for (let k = 0; k < n * 20 && out.length < n; k++) {
            const x = 160 + rnd() * (m.w - 320), y = 160 + rnd() * (m.h - 320);
            if (inWall(x, y, pad) || nearStation(x, y, 110)) continue;
            if (avoidMid && Math.abs(x - m.w / 2) < 330 && Math.abs(y - m.h / 2) < 260) continue;
            out.push({ x, y, r: rnd(), s: rnd() });
        }
        return out;
    };
    zMallDeco = {
        m,
        plants: pick(14, 50, true),
        benches: pick(8, 60, true),
        carts: pick(6, 40, true),
        blood: pick(26, 10, false),
        trash: pick(30, 10, false),
        lights: pick(18, 0, false),
        // Laeden am Rand: Name, Farbe
        shops: [['KEK BURGER', '#ff7a3a'], ['PIXEL PHONES', '#3da5ff'], ['SNEAK PEAK', '#ff5bd6'], ['GAME ZONE', '#7cff6b'],
            ['COFFEE BEAN', '#c68b59'], ['KEKFLIX', '#ff3b3b'], ['BOOK NOOK', '#ffd23f'], ['TOY LAND', '#b04fff']]
    };
    return zMallDeco;
}

function zMallFloor(c, m, cam, vw, vh, now) {
    if (!zIsMall(m)) return false;
    const D = zMallBuild(m);
    // Fliesen: zwei Toene, grosse Platten
    const T = 100;
    c.fillStyle = '#1a1d24';
    c.fillRect(0, 0, m.w, m.h);
    c.fillStyle = '#20242c';
    for (let x = Math.floor(cam.x / T) * T; x <= cam.x + vw; x += T) {
        for (let y = Math.floor(cam.y / T) * T; y <= cam.y + vh; y += T) {
            if (((x + y) / T) % 2 === 0) c.fillRect(x, y, T, T);
        }
    }
    c.strokeStyle = 'rgba(255,255,255,.035)';
    c.lineWidth = 2;
    c.beginPath();
    for (let x = Math.floor(cam.x / T) * T; x <= cam.x + vw; x += T) { c.moveTo(x, cam.y); c.lineTo(x, cam.y + vh); }
    for (let y = Math.floor(cam.y / T) * T; y <= cam.y + vh; y += T) { c.moveTo(cam.x, y); c.lineTo(cam.x + vw, y); }
    c.stroke();
    // Laeufer-Teppich durch die Mitte (Kreuz)
    c.fillStyle = 'rgba(120,30,50,.28)';
    c.fillRect(0, m.h / 2 - 70, m.w, 140);
    c.fillRect(m.w / 2 - 70, 0, 140, m.h);
    c.strokeStyle = 'rgba(255,210,63,.18)';
    c.lineWidth = 3;
    c.strokeRect(-10, m.h / 2 - 62, m.w + 20, 124);
    c.strokeRect(m.w / 2 - 62, -10, 124, m.h + 20);
    // Platz in der Mitte: Mosaik-Kreis mit Brunnen
    const cx = m.w / 2, cy = m.h / 2;
    const g = c.createRadialGradient(cx, cy, 20, cx, cy, 250);
    g.addColorStop(0, '#2a3140');
    g.addColorStop(1, 'rgba(42,49,64,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 250, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,210,63,.25)';
    c.lineWidth = 3;
    for (const rr of [150, 190]) {
        c.beginPath();
        c.arc(cx, cy, rr, 0, Math.PI * 2);
        c.stroke();
    }
    for (let i = 0; i < 16; i++) {
        const t = i / 16 * Math.PI * 2;
        c.beginPath();
        c.moveTo(cx + Math.cos(t) * 150, cy + Math.sin(t) * 150);
        c.lineTo(cx + Math.cos(t) * 190, cy + Math.sin(t) * 190);
        c.stroke();
    }
    // Brunnen (flach, Wasser bewegt sich)
    c.fillStyle = '#39465a';
    c.beginPath();
    c.arc(cx, cy, 58, 0, Math.PI * 2);
    c.fill();
    const wg = c.createRadialGradient(cx, cy, 5, cx, cy, 50);
    wg.addColorStop(0, '#9fe8ff');
    wg.addColorStop(1, '#2a7fb8');
    c.fillStyle = wg;
    c.beginPath();
    c.arc(cx, cy, 48, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.5)';
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        const k = (now / 1400 + i / 3) % 1;
        c.globalAlpha = 1 - k;
        c.beginPath();
        c.arc(cx, cy, 8 + k * 40, 0, Math.PI * 2);
        c.stroke();
    }
    c.globalAlpha = 1;
    // Laeden am Rand: Schaufenster mit Leuchtschrift
    const n = D.shops.length, per = 2;
    D.shops.forEach(([name, col], i) => {
        const side = i % 4, k = Math.floor(i / 4);
        const along = (k + 1) / (per + 1);
        let x, y, w, h;
        if (side === 0) { w = 360; h = 34; x = m.w * along - w / 2 + (k ? 260 : -260); y = 8; }
        else if (side === 1) { w = 360; h = 34; x = m.w * along - w / 2 + (k ? 260 : -260); y = m.h - 42; }
        else if (side === 2) { w = 34; h = 300; x = 8; y = m.h * along - h / 2 + (k ? 160 : -160); }
        else { w = 34; h = 300; x = m.w - 42; y = m.h * along - h / 2 + (k ? 160 : -160); }
        if (x + w < cam.x || x > cam.x + vw || y + h < cam.y || y > cam.y + vh) return;
        c.fillStyle = 'rgba(160,210,255,.1)';
        c.fillRect(x, y, w, h);
        c.fillStyle = col;
        c.globalAlpha = .75 + .25 * (Math.sin(now / 90 + i * 7) > -.95 ? 1 : 0);
        c.shadowColor = col;
        c.shadowBlur = 14;
        c.font = 'bold 20px system-ui';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        if (side < 2) c.fillText(name, x + w / 2, y + h / 2 + 1);
        else {
            c.save();
            c.translate(x + w / 2, y + h / 2);
            c.rotate(side === 2 ? -Math.PI / 2 : Math.PI / 2);
            c.fillText(name, 0, 1);
            c.restore();
        }
        c.shadowBlur = 0;
        c.globalAlpha = 1;
    });
    // Blut, Muell
    for (const b of D.blood) {
        if (b.x < cam.x - 60 || b.x > cam.x + vw + 60 || b.y < cam.y - 60 || b.y > cam.y + vh + 60) continue;
        c.fillStyle = `rgba(${110 + b.s * 40},10,20,${.25 + b.r * .2})`;
        c.beginPath();
        for (let i = 0; i <= 10; i++) {
            const t = i / 10 * Math.PI * 2, rr = (14 + b.s * 22) * (0.7 + 0.5 * Math.abs(Math.sin(t * 3 + b.r * 9)));
            i ? c.lineTo(b.x + Math.cos(t) * rr, b.y + Math.sin(t) * rr * .7) : c.moveTo(b.x + Math.cos(t) * rr, b.y + Math.sin(t) * rr * .7);
        }
        c.fill();
    }
    for (const t of D.trash) {
        if (t.x < cam.x - 20 || t.x > cam.x + vw + 20 || t.y < cam.y - 20 || t.y > cam.y + vh + 20) continue;
        c.globalAlpha = .55;
        drawEmojiC(c, ['📰', '🥤', '🍔', '🧾', '🛍️'][Math.floor(t.r * 5)], t.x, t.y, 14 + t.s * 8);
        c.globalAlpha = 1;
    }
    return true;
}

// Deko ueber dem Boden, unter den Figuren: Pflanzen, Baenke, Wagen, Lichtkegel
function zMallDecor(c, m, cam, vw, vh, now) {
    if (!zIsMall(m)) return;
    const D = zMallBuild(m);
    const on = (o, p) => o.x > cam.x - p && o.x < cam.x + vw + p && o.y > cam.y - p && o.y < cam.y + vh + p;
    for (const b of D.benches) {
        if (!on(b, 60)) continue;
        c.save();
        c.translate(b.x, b.y);
        c.rotate(b.r > .5 ? Math.PI / 2 : 0);
        c.fillStyle = 'rgba(0,0,0,.3)';
        c.fillRect(-36, -8, 76, 22);
        c.fillStyle = '#7a5230';
        c.fillRect(-38, -12, 76, 8);
        c.fillRect(-38, 0, 76, 8);
        c.fillStyle = '#3b3f46';
        c.fillRect(-34, -14, 5, 24);
        c.fillRect(29, -14, 5, 24);
        c.restore();
    }
    for (const p of D.plants) {
        if (!on(p, 60)) continue;
        c.fillStyle = 'rgba(0,0,0,.3)';
        c.beginPath();
        c.ellipse(p.x + 4, p.y + 6, 24, 12, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#6b4a2b';
        c.beginPath();
        c.arc(p.x, p.y, 18, 0, Math.PI * 2);
        c.fill();
        const sway = Math.sin(now / 900 + p.r * 10) * 2;
        drawEmojiC(c, p.s > .5 ? '🪴' : '🌴', p.x + sway, p.y - 6, 40);
    }
    for (const w of D.carts) {
        if (!on(w, 40)) continue;
        c.save();
        c.translate(w.x, w.y);
        c.rotate(w.r * 6.28);
        drawEmojiC(c, '🛒', 0, 0, 34);
        c.restore();
    }
    // Deckenlichter: warme Lichtkegel, manche flackern
    c.globalCompositeOperation = 'lighter';
    for (const l of D.lights) {
        if (!on(l, 200)) continue;
        const flick = l.s > .75 ? (Math.sin(now / 37 + l.r * 50) > .2 && Math.sin(now / 211 + l.r * 9) > -.3 ? 1 : .15) : 1;
        zGlow(c, l.x, l.y, 170, l.r > .5 ? '255,220,160' : '160,200,255', .07 * flick);
    }
    c.globalCompositeOperation = 'source-over';
    // Staub in der Luft
    c.fillStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 40; i++) {
        const t = now / 9000 + i * 0.37;
        const x = cam.x + ((i * 173.7 + Math.sin(t) * 120 + now / 60) % vw + vw) % vw;
        const y = cam.y + ((i * 97.3 + Math.cos(t * 1.3) * 80 + now / 90) % vh + vh) % vh;
        c.fillRect(x, y, 2, 2);
    }
}

// Mauern: Saeulen aus Marmor, lange Mauern als Schaufenster-Trennwaende
function zMallWall(c, m, x, y, w, h) {
    if (!zIsMall(m)) return false;
    c.fillStyle = 'rgba(0,0,0,.4)';
    c.fillRect(x + 8, y + 8, w, h);
    if (w < 130 && h < 130) {
        const g = c.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, '#d9d4cc');
        g.addColorStop(.5, '#b8b1a6');
        g.addColorStop(1, '#8f877c');
        c.fillStyle = g;
        c.fillRect(x, y, w, h);
        c.strokeStyle = 'rgba(90,80,70,.5)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x + w * .2, y); c.quadraticCurveTo(x + w * .5, y + h * .4, x + w * .3, y + h);
        c.moveTo(x + w * .7, y); c.quadraticCurveTo(x + w * .9, y + h * .5, x + w * .6, y + h);
        c.stroke();
        c.strokeStyle = '#6d665d';
        c.lineWidth = 3;
        c.strokeRect(x + 2, y + 2, w - 4, h - 4);
    } else {
        // Glas mit Rahmen
        c.fillStyle = '#2d3b4f';
        c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(150,210,255,.25)';
        const hor = w > h;
        const seg = 60;
        for (let k = 0; k < (hor ? w : h); k += seg) {
            if (hor) c.fillRect(x + k + 4, y + 3, Math.min(seg, w - k) - 8, h - 6);
            else c.fillRect(x + 3, y + k + 4, w - 6, Math.min(seg, h - k) - 8);
        }
        c.fillStyle = 'rgba(255,255,255,.35)';
        if (hor) c.fillRect(x, y, w, 3);
        else c.fillRect(x, y, 3, h);
        c.strokeStyle = '#9aa7b8';
        c.lineWidth = 2;
        c.strokeRect(x, y, w, h);
    }
    return true;
}

// Shops: jede Station als eigenes kleines Geschaeft
function zDrawStation(c, m, s, L, now) {
    if (!zIsMall(m)) return false;
    const x = s.x, y = s.y, pulse = .5 + .5 * Math.sin(now / 400 + x);
    const rgb = L.rgb;
    const shadow = (w, h) => {
        c.fillStyle = 'rgba(0,0,0,.35)';
        c.fillRect(x - w / 2 + 6, y - h / 2 + 8, w, h);
    };
    zGlow(c, x, y, 80, rgb, .12 + .08 * pulse);
    if (s.kind === 'perk') {
        // Getraenkeautomat
        shadow(52, 70);
        c.fillStyle = `rgb(${rgb})`;
        c.fillRect(x - 26, y - 36, 52, 70);
        c.fillStyle = 'rgba(0,0,0,.35)';
        c.fillRect(x - 20, y - 30, 30, 44);
        c.fillStyle = `rgba(255,255,255,${.25 + .25 * pulse})`;
        c.fillRect(x - 20, y - 30, 30, 6);
        c.fillStyle = '#222';
        c.fillRect(x + 14, y - 28, 8, 20);
        c.fillStyle = '#111';
        c.fillRect(x - 20, y + 20, 40, 8);
        drawEmojiC(c, L.icon, x - 5, y - 6, 26);
    } else if (s.kind === 'box') {
        // Mystery Box: Truhe mit Lichtsaeule und ?
        const beam = c.createLinearGradient(x, y - 160, x, y);
        beam.addColorStop(0, 'rgba(184,132,255,0)');
        beam.addColorStop(1, `rgba(184,132,255,${.25 + .2 * pulse})`);
        c.fillStyle = beam;
        c.fillRect(x - 18, y - 160, 36, 160);
        shadow(72, 40);
        c.fillStyle = '#6b4a2b';
        c.fillRect(x - 36, y - 20, 72, 40);
        c.fillStyle = '#8a6238';
        c.fillRect(x - 36, y - 20, 72, 12);
        c.strokeStyle = '#ffd23f';
        c.lineWidth = 3;
        c.strokeRect(x - 36, y - 20, 72, 40);
        c.fillStyle = '#ffd23f';
        c.fillRect(x - 5, y - 8, 10, 10);
        c.font = 'bold 18px system-ui';
        c.textAlign = 'center';
        c.fillStyle = `rgba(230,210,255,${.5 + .5 * pulse})`;
        c.fillText('?', x - 24, y + 12 - pulse * 6);
        c.fillText('?', x + 24, y + 8 - (1 - pulse) * 6);
    } else if (s.kind === 'pap') {
        // Pack-a-Punch: Maschine mit Blitzen
        shadow(90, 56);
        c.fillStyle = '#3a2a4f';
        c.fillRect(x - 45, y - 28, 90, 56);
        c.fillStyle = '#5a3f7a';
        c.fillRect(x - 45, y - 28, 90, 10);
        c.fillStyle = `rgba(255,120,255,${.4 + .5 * pulse})`;
        c.fillRect(x - 30, y - 10, 60, 18);
        c.strokeStyle = 'rgba(255,200,255,.9)';
        c.lineWidth = 2;
        c.beginPath();
        zBolt(c, x - 40, y - 34, x + 40, y - 34, 10, 7);
        c.stroke();
        drawEmojiC(c, '⚡', x, y, 24);
    } else if (s.kind === 'wall') {
        // Waffe an der Wand: Kreide-Umriss auf Holzbrett
        shadow(80, 50);
        c.fillStyle = '#4a3522';
        c.fillRect(x - 40, y - 25, 80, 50);
        c.strokeStyle = 'rgba(255,255,255,.55)';
        c.setLineDash([4, 3]);
        c.strokeRect(x - 34, y - 19, 68, 38);
        c.setLineDash([]);
        drawEmojiC(c, L.icon, x, y, 30);
    } else if (s.kind === 'heal' || s.kind === 'revive') {
        // Sani-Kiosk
        shadow(64, 50);
        c.fillStyle = '#e8eef3';
        c.fillRect(x - 32, y - 25, 64, 50);
        c.fillStyle = s.kind === 'heal' ? '#e03040' : '#ff6ea0';
        c.fillRect(x - 6, y - 18, 12, 36);
        c.fillRect(x - 18, y - 6, 36, 12);
        if (s.kind === 'revive') {
            c.strokeStyle = '#23c26b';
            c.lineWidth = 2;
            c.beginPath();
            const t = (now / 12) % 64;
            for (let i = 0; i <= 64; i += 2) {
                const k = (i + t) % 64;
                const yy = y + 20 + (k > 28 && k < 34 ? -10 * Math.sin((k - 28) / 6 * Math.PI) : 0);
                i ? c.lineTo(x - 32 + i, yy) : c.moveTo(x - 32 + i, yy);
            }
            c.stroke();
        }
    } else if (s.kind === 'armor') {
        // Waffenkammer-Spind
        shadow(70, 60);
        c.fillStyle = '#4a5566';
        c.fillRect(x - 35, y - 30, 70, 60);
        c.strokeStyle = '#2b323d';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x, y - 30); c.lineTo(x, y + 30);
        c.stroke();
        for (const ox of [-25, 10]) for (let k = 0; k < 3; k++) c.fillRect(x + ox, y - 22 + k * 6, 14, 2);
        drawEmojiC(c, '🛡️', x, y + 6, 26);
    } else if (s.kind === 'nades') {
        // Munitionskiste
        shadow(66, 42);
        c.fillStyle = '#4f5a2f';
        c.fillRect(x - 33, y - 21, 66, 42);
        c.strokeStyle = '#2f361c';
        c.lineWidth = 3;
        c.strokeRect(x - 33, y - 21, 66, 42);
        c.fillStyle = '#e8d56a';
        c.font = 'bold 10px system-ui';
        c.textAlign = 'center';
        c.fillText('EXPLOSIVE', x, y - 8);
        drawEmojiC(c, '💣', x, y + 8, 22);
    } else if (s.kind === 'shrine') {
        // Altar mit kreisenden Runen
        c.save();
        c.translate(x, y);
        c.rotate(now / 1500);
        c.strokeStyle = `rgba(255,215,90,${.5 + .4 * pulse})`;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, 44, 0, Math.PI * 2);
        c.stroke();
        for (let i = 0; i < 5; i++) {
            const t = i / 5 * Math.PI * 2;
            c.beginPath();
            c.moveTo(Math.cos(t) * 44, Math.sin(t) * 44);
            c.lineTo(Math.cos(t + Math.PI * .8) * 44, Math.sin(t + Math.PI * .8) * 44);
            c.stroke();
        }
        c.restore();
        c.fillStyle = '#6d665d';
        c.fillRect(x - 22, y - 12, 44, 24);
        drawEmojiC(c, '🔮', x, y - 14 - pulse * 4, 28);
    } else {
        return false;
    }
    // Schild mit Preis
    c.font = 'bold 12px system-ui';
    c.textAlign = 'center';
    const tw = c.measureText(L.label).width + 14;
    c.fillStyle = 'rgba(0,0,0,.72)';
    c.fillRect(x - tw / 2, y + 40, tw, 18);
    c.strokeStyle = `rgba(${rgb},.9)`;
    c.lineWidth = 1.5;
    c.strokeRect(x - tw / 2, y + 40, tw, 18);
    c.fillStyle = '#fff';
    c.textBaseline = 'middle';
    c.fillText(L.label, x, y + 49);
    c.textBaseline = 'alphabetic';
    return true;
}

// ================= 6.6: Kisten, Beute, Uniques, World Ender =================

// Kisten: 1 = Vorrat (blau), 2 = golden
function zDrawCrate(c, x, y, g, ready, now) {
    if (!ready) return false;
    const p = .5 + .5 * Math.sin(now / 260 + x);
    if (g === 1) {
        zGlow(c, x, y, 48, '90,170,255', .35 + .15 * p);
        drawEmojiC(c, '🧰', x, y, 38);
    } else {
        const beam = c.createLinearGradient(x, y - 140, x, y);
        beam.addColorStop(0, 'rgba(255,210,63,0)');
        beam.addColorStop(1, `rgba(255,210,63,${.3 + .2 * p})`);
        c.fillStyle = beam;
        c.fillRect(x - 12, y - 140, 24, 140);
        zGlow(c, x, y, 64, '255,210,63', .45 + .2 * p);
        for (let i = 0; i < 5; i++) {
            const t = now / 700 + i * 1.26;
            c.fillStyle = `rgba(255,240,170,${.5 + .5 * Math.sin(now / 150 + i)})`;
            c.beginPath();
            c.arc(x + Math.cos(t) * 30, y + Math.sin(t) * 18 - 8, 2.5, 0, Math.PI * 2);
            c.fill();
        }
        drawEmojiC(c, '🎁', x, y - p * 3, 42);
    }
    return true;
}

// Gegner-Beute in drei Stufen: 3 gewoehnlich, 4 selten, 5 Boss-Pool (1 in 50)
function zDrawMobBag(c, x, y, n, kind, now) {
    const p = .5 + .5 * Math.sin(now / 220 + y);
    const bob = Math.sin(now / 250) * 3;
    if (kind === 3) drawEmojiC(c, '👝', x, y + bob, 30);
    else if (kind === 4) {
        zGlow(c, x, y, 46, '184,132,255', .35 + .15 * p);
        drawEmojiC(c, '💼', x, y + bob, 34);
    } else {
        const beam = c.createLinearGradient(x, y - 220, x, y);
        beam.addColorStop(0, 'rgba(255,90,200,0)');
        beam.addColorStop(1, `rgba(255,90,200,${.35 + .25 * p})`);
        c.fillStyle = beam;
        c.fillRect(x - 16, y - 220, 32, 220);
        zGlow(c, x, y, 80, '255,90,200', .5 + .2 * p);
        c.save();
        c.translate(x, y + bob);
        c.rotate(now / 900);
        c.strokeStyle = `rgba(255,220,255,${.6 + .4 * p})`;
        c.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const t = i / 8 * Math.PI * 2;
            c.beginPath();
            c.moveTo(Math.cos(t) * 26, Math.sin(t) * 26);
            c.lineTo(Math.cos(t) * (40 + 8 * p), Math.sin(t) * (40 + 8 * p));
            c.stroke();
        }
        c.restore();
        drawEmojiC(c, '💎', x, y + bob, 40);
    }
    c.fillStyle = '#ffd23f';
    c.font = 'bold 13px system-ui';
    c.textAlign = 'center';
    c.fillText(`${n}`, x + 18, y - 16);
    return true;
}

// Ganzkoerper-Ruestung am Spieler (in dessen Koordinaten, bereits gedreht)
function zDrawSuit(c, base, r, now) {
    if (base === 'ironman') {
        const p = .5 + .5 * Math.sin(now / 160);
        c.fillStyle = 'rgba(190,20,30,.85)';
        c.beginPath();
        c.arc(0, 0, r + 3, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#ffcf33';
        c.lineWidth = 3;
        c.stroke();
        c.fillStyle = '#ffcf33';
        c.beginPath();
        c.moveTo(r * .9, -r * .35); c.lineTo(r * .9, r * .35); c.lineTo(r * .3, r * .25); c.lineTo(r * .3, -r * .25);
        c.closePath();
        c.fill();
        zGlow(c, 0, 0, r * .75, '160,230,255', .6 + .3 * p);
        c.fillStyle = '#e8fbff';
        c.beginPath();
        c.arc(0, 0, r * .22, 0, Math.PI * 2);
        c.fill();
        // Duesen-Glimmen hinten
        zGlow(c, -r - 6, 0, 16 + 6 * p, '120,200,255', .7);
    } else if (base === 'susanoo') {
        const p = .5 + .5 * Math.sin(now / 300);
        zGlow(c, 0, 0, r * 3.2, '150,70,255', .35 + .15 * p);
        c.strokeStyle = `rgba(190,120,255,${.6 + .3 * p})`;
        c.lineWidth = 3;
        // Rippen
        for (let i = -3; i <= 3; i++) {
            c.beginPath();
            c.ellipse(-r * .2, 0, r * 1.9, r * (1.4 + i * .08), 0, -Math.PI * .45 + i * .05, Math.PI * .45 - i * .05);
            c.stroke();
        }
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, r * 2.2, -Math.PI * .7, Math.PI * .7);
        c.stroke();
    }
}

// Geschosse der Unique-Waffen
function zDrawLook(c, bx, by, vx, vy, sp, look, now) {
    const ux = vx / sp, uy = vy / sp, a = Math.atan2(vy, vx);
    if (look === 'rasen') {
        zGlow(c, bx, by, 40, '120,200,255', .8);
        c.save();
        c.translate(bx, by);
        for (let i = 0; i < 4; i++) {
            c.rotate(now / 40);
            c.strokeStyle = `rgba(220,245,255,${.8 - i * .15})`;
            c.lineWidth = 2;
            c.beginPath();
            c.arc(0, 0, 10 + i * 5, 0, Math.PI * 1.2);
            c.stroke();
        }
        c.restore();
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(bx, by, 7, 0, Math.PI * 2);
        c.fill();
    } else if (look === 'getsuga') {
        c.save();
        c.translate(bx, by);
        c.rotate(a);
        c.fillStyle = 'rgba(0,0,0,.85)';
        c.strokeStyle = '#ff2030';
        c.lineWidth = 3;
        c.shadowColor = '#ff2030';
        c.shadowBlur = 18;
        c.beginPath();
        c.arc(-40, 0, 64, -1.1, 1.1);
        c.arc(-58, 0, 58, 1.0, -1.0, true);
        c.closePath();
        c.fill();
        c.stroke();
        c.shadowBlur = 0;
        c.restore();
    } else if (look === 'amaterasu') {
        for (let k = 0; k < 6; k++) {
            const t = k / 6;
            c.fillStyle = `rgba(${k < 2 ? '60,0,40' : '10,0,10'},${.9 - t * .7})`;
            c.beginPath();
            c.arc(bx - ux * k * 8 + Math.sin(now / 50 + k) * 3, by - uy * k * 8 + Math.cos(now / 60 + k) * 3, 10 - k, 0, Math.PI * 2);
            c.fill();
        }
        c.strokeStyle = 'rgba(160,0,60,.8)';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(bx, by, 9, 0, Math.PI * 2);
        c.stroke();
    } else if (look === 'spirit') {
        c.strokeStyle = 'rgba(80,200,255,.45)';
        c.lineWidth = 14;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(bx - ux * 60, by - uy * 60);
        c.lineTo(bx, by);
        c.stroke();
        c.lineCap = 'butt';
        zGlow(c, bx, by, 28, '120,220,255', .9);
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(bx, by, 8, 0, Math.PI * 2);
        c.fill();
    } else if (look === 'gob') {
        // goldene Klinge mit Glanz
        c.save();
        c.translate(bx, by);
        c.rotate(a);
        c.strokeStyle = 'rgba(255,210,63,.35)';
        c.lineWidth = 8;
        c.beginPath();
        c.moveTo(-40, 0);
        c.lineTo(0, 0);
        c.stroke();
        c.fillStyle = '#ffe27a';
        c.beginPath();
        c.moveTo(18, 0); c.lineTo(-6, -4); c.lineTo(-14, 0); c.lineTo(-6, 4);
        c.closePath();
        c.fill();
        c.fillStyle = '#b8860b';
        c.fillRect(-20, -6, 5, 12);
        c.restore();
    } else if (look === 'cleave') {
        c.strokeStyle = 'rgba(255,255,255,.6)';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(bx - ux * 30, by - uy * 30);
        c.lineTo(bx, by);
        c.stroke();
        c.strokeStyle = 'rgba(200,40,40,.5)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(bx - ux * 46, by - uy * 46);
        c.lineTo(bx - ux * 10, by - uy * 10);
        c.stroke();
    } else if (look === 'purple') {
        // Hollow Purple: violette Kugel, rote und blaue Schlieren, verzerrt den Boden
        zGlow(c, bx, by, 150, '160,40,255', .35);
        c.save();
        c.translate(bx, by);
        for (let i = 0; i < 3; i++) {
            c.rotate(now / 120 + i);
            c.strokeStyle = i === 0 ? 'rgba(255,60,60,.7)' : i === 1 ? 'rgba(60,120,255,.7)' : 'rgba(255,255,255,.5)';
            c.lineWidth = 4;
            c.beginPath();
            c.arc(0, 0, 70 + i * 10, 0, Math.PI * 1.1);
            c.stroke();
        }
        c.restore();
        const g = c.createRadialGradient(bx, by, 4, bx, by, 60);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(.3, '#d28bff');
        g.addColorStop(1, 'rgba(90,0,160,.2)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(bx, by, 60, 0, Math.PI * 2);
        c.fill();
        for (let k = 1; k <= 5; k++) {
            c.fillStyle = `rgba(160,60,255,${.25 - k * .04})`;
            c.beginPath();
            c.arc(bx - ux * k * 40, by - uy * k * 40, 55 - k * 6, 0, Math.PI * 2);
            c.fill();
        }
    } else return false;
    return true;
}

// Strahlen der Uniques: Kamehameha (blau, riesig), Venuzdonoa (schwarz-rot, Risse)
function zDrawBeamLook(c, f, k, now) {
    const L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1) || 1;
    const a = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
    const w = (f.bw || 40) * 1.4;
    const fade = 1 - k;
    c.save();
    c.translate(f.x1, f.y1);
    c.rotate(a);
    if (f.look === 'kame') {
        const grow = Math.min(1, k * 6);
        const g = c.createLinearGradient(0, -w * 1.8, 0, w * 1.8);
        g.addColorStop(0, 'rgba(60,160,255,0)');
        g.addColorStop(.3, `rgba(80,180,255,${.5 * fade})`);
        g.addColorStop(.5, `rgba(240,250,255,${fade})`);
        g.addColorStop(.7, `rgba(80,180,255,${.5 * fade})`);
        g.addColorStop(1, 'rgba(60,160,255,0)');
        c.fillStyle = g;
        c.fillRect(0, -w * 1.8, L * grow, w * 3.6);
        // Wellen am Rand
        c.strokeStyle = `rgba(200,240,255,${.7 * fade})`;
        c.lineWidth = 3;
        for (const sgn of [-1, 1]) {
            c.beginPath();
            for (let x = 0; x < L * grow; x += 20) {
                const y = sgn * (w * 1.1 + Math.sin(x / 40 - now / 40) * 10);
                x ? c.lineTo(x, y) : c.moveTo(x, y);
            }
            c.stroke();
        }
        zGlow(c, 0, 0, w * 2.2, '140,210,255', fade);
        zGlow(c, L * grow, 0, w * 2.4, '200,240,255', .8 * fade);
    } else if (f.look === 'venuz') {
        // schwarze Klinge aus Nichts, rote Blitze, Risse quer durch den Raum
        const g = c.createLinearGradient(0, -w, 0, w);
        g.addColorStop(0, 'rgba(120,0,0,0)');
        g.addColorStop(.5, `rgba(0,0,0,${.95 * fade})`);
        g.addColorStop(1, 'rgba(120,0,0,0)');
        c.fillStyle = g;
        c.fillRect(0, -w, L, w * 2);
        c.strokeStyle = `rgba(255,30,40,${fade})`;
        c.shadowColor = '#ff1020';
        c.shadowBlur = 20;
        c.lineWidth = 3;
        c.beginPath();
        zBolt(c, 0, 0, L, 0, w, 24);
        c.stroke();
        c.lineWidth = 1.5;
        for (let i = 0; i < 10; i++) {
            const x = (i + .5) / 10 * L;
            c.beginPath();
            zBolt(c, x, 0, x + (Math.random() - .5) * 60, (Math.random() < .5 ? -1 : 1) * (w * 1.5 + Math.random() * 60), 16, 4);
            c.stroke();
        }
        c.shadowBlur = 0;
        c.fillStyle = `rgba(255,255,255,${.9 * fade})`;
        c.font = `900 ${28 + k * 20}px serif`;
        c.textAlign = 'center';
        c.globalAlpha = fade;
        c.fillText('滅', L * .5, -w * 2);
        c.globalAlpha = 1;
    } else {
        c.restore();
        return false;
    }
    c.restore();
    return true;
}

// Effekte der neuen Verbrauchsgueter und Uniques
Object.assign(ZFX_MS, { portal: 450, chidori: 700, void: 2200, genki: 1600 });
const zDrawFxOld = zDrawFx;
zDrawFx = function (c, f, k, now) {
    if (f.type !== 'shFx') return false;
    if (f.kind === 'portal') {
        zGlow(c, f.x, f.y, 30, '255,210,63', .9 * (1 - k));
        c.strokeStyle = `rgba(255,230,120,${1 - k})`;
        c.lineWidth = 3;
        c.beginPath();
        c.ellipse(f.x, f.y, 22 * (1 - k * .5), 26 * (1 - k * .5), now / 200, 0, Math.PI * 2);
        c.stroke();
        return true;
    }
    if (f.kind === 'chidori') {
        c.strokeStyle = `rgba(160,220,255,${1 - k})`;
        c.lineWidth = 6 * (1 - k) + 1;
        c.shadowColor = '#9fe8ff';
        c.shadowBlur = 20;
        for (let i = 0; i < 3; i++) {
            c.beginPath();
            zBolt(c, f.from[0], f.from[1], f.x, f.y, 40, 10);
            c.stroke();
        }
        c.shadowBlur = 0;
        zGlow(c, f.x, f.y, 90 * (1 - k) + 20, '160,220,255', 1 - k);
        return true;
    }
    if (f.kind === 'void') {
        // Domaene: Sternenfeld im Kreis, dehnt sich aus und bleibt kurz
        const r = f.r * Math.min(1, k * 4);
        const a = k < .8 ? 1 : (1 - k) / .2;
        c.save();
        c.beginPath();
        c.arc(f.x, f.y, r, 0, Math.PI * 2);
        c.clip();
        c.fillStyle = `rgba(4,0,20,${.85 * a})`;
        c.fillRect(f.x - r, f.y - r, r * 2, r * 2);
        for (let i = 0; i < 120; i++) {
            const t = i * 2.39996, d = (i * 37 % 100) / 100 * f.r;
            c.fillStyle = `rgba(${200 + (i % 3) * 20},${180 + (i % 5) * 15},255,${a * (.4 + .6 * Math.abs(Math.sin(now / 300 + i)))})`;
            c.fillRect(f.x + Math.cos(t + now / 4000) * d, f.y + Math.sin(t + now / 4000) * d, 2, 2);
        }
        c.restore();
        c.strokeStyle = `rgba(160,120,255,${a})`;
        c.lineWidth = 4;
        c.beginPath();
        c.arc(f.x, f.y, r, 0, Math.PI * 2);
        c.stroke();
        return true;
    }
    if (f.kind === 'genki') {
        // Genkidama: riesige leuchtende Kugel faellt vom Himmel
        const fall = Math.min(1, k * 2.2);
        const y = f.y - 700 * (1 - fall);
        zGlow(c, f.x, y, f.r * (.4 + .3 * fall), '150,210,255', .9 * (1 - k * .6));
        c.fillStyle = `rgba(230,245,255,${.8 * (1 - k * .5)})`;
        c.beginPath();
        c.arc(f.x, y, f.r * .28, 0, Math.PI * 2);
        c.fill();
        if (k > .45) {
            for (let i = 0; i < 3; i++) {
                const kk = Math.min(1, (k - .45) * 2 - i * .12);
                if (kk <= 0) continue;
                c.strokeStyle = `rgba(200,235,255,${1 - kk})`;
                c.lineWidth = 12 * (1 - kk) + 2;
                c.beginPath();
                c.arc(f.x, f.y, f.r * 1.6 * kk, 0, Math.PI * 2);
                c.stroke();
            }
        }
        return true;
    }
    return zDrawFxOld(c, f, k, now);
};
const zFxSoundOld = zFxSound;
zFxSound = function (d) {
    if (d.type === 'shBeam' && d.look === 'kame') {
        sTone(180, { dur: 1.2, type: 'sawtooth', vol: .12, slide: 700, rev: .5, lp: 2000 });
        sNoise({ dur: 1.2, vol: .25, type: 'bandpass', f: 1200, f2: 300, rev: .4, a: .05 });
        shShake(20, 900);
    } else if (d.type === 'shBeam' && d.look === 'venuz') {
        sTone(60, { dur: 1.4, type: 'sawtooth', vol: .2, slide: 30, rev: .6, lp: 500 });
        sNoise({ t: .05, dur: .6, vol: .3, type: 'lowpass', f: 900, f2: 60, rev: .5, a: .002 });
        shShake(26, 900);
    } else if (d.type === 'shFx' && d.kind === 'chidori') {
        sNoise({ dur: .5, vol: .2, type: 'highpass', f: 3000, f2: 1500, rev: .2, a: .01 });
        sTone(1600, { dur: .4, type: 'sawtooth', vol: .05, slide: 800, rev: .2 });
    } else if (d.type === 'shFx' && d.kind === 'void') {
        sTone(90, { dur: 2.2, type: 'sine', vol: .2, slide: 45, rev: .7 });
        [880, 1320, 1760].forEach((f, i) => sBell(f, .1 + i * .15, .05, 2));
        shShake(12, 800);
    } else if (d.type === 'shFx' && d.kind === 'genki') {
        sTone(120, { dur: 2, type: 'sine', vol: .25, slide: 40, rev: .6 });
    } else if (d.type === 'shFx' && d.kind === 'portal') {
        sTone(1400, { dur: .12, type: 'triangle', vol: .02, slide: 2000, rev: .2 });
    }
    return zFxSoundOld(d);
};

// ---------- World Ender: Countdown und Weltuntergang ----------
function zWorldEnd(d) {
    let el = document.getElementById('zw-end');
    if (!el) {
        const st = document.createElement('style');
        st.textContent = `
#zw-end{position:fixed;inset:0;z-index:70;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif}
#zw-end.arm{background:radial-gradient(ellipse at center,rgba(255,0,0,0) 40%,rgba(255,0,0,.35));animation:zwPulse .5s ease-in-out infinite alternate}
#zw-end .t{font:900 clamp(22px,4vw,44px) system-ui;color:#ff3b3b;letter-spacing:.25em;text-shadow:0 0 20px #f00}
#zw-end .n{font:900 clamp(80px,16vw,200px)/1 system-ui;color:#fff;text-shadow:0 0 40px #f00,0 0 80px #f00}
#zw-end .b{font:700 16px system-ui;color:#ffd0d0;letter-spacing:.2em;margin-top:8px}
#zw-end.boom{animation:zwBoom 3.6s ease-out forwards}
#zw-end.boom .n,#zw-end.boom .t,#zw-end.boom .b{display:none}
@keyframes zwPulse{from{opacity:.55}to{opacity:1}}
@keyframes zwBoom{0%{background:#fff;opacity:1}12%{background:#fff8d0}35%{background:radial-gradient(circle at center,#ffe9a0,#ff7a1e 40%,#5a0a00 80%)}70%{background:radial-gradient(circle at center,rgba(255,120,30,.5),rgba(40,0,0,.8));opacity:1}100%{background:rgba(0,0,0,0);opacity:0}}`;
        document.head.appendChild(st);
        el = document.createElement('div');
        el.id = 'zw-end';
        document.body.appendChild(el);
    }
    clearInterval(el._t);
    if (d.phase === 'arm') {
        const end = performance.now() + d.ms;
        el.className = 'arm';
        const draw = () => {
            const left = Math.max(0, Math.ceil((end - performance.now()) / 1000));
            el.innerHTML = `<div class="t">☢ WORLD ENDER ☢</div><div class="n">${left}</div><div class="b">thrown by ${String(d.by).replace(/[<>&"]/g, '')}</div>`;
        };
        draw();
        el._t = setInterval(() => {
            draw();
            sTone(880, { dur: .35, type: 'square', vol: .06, slide: 440, rev: .2 });
        }, 500);
        sTone(440, { dur: d.ms / 1000, type: 'sawtooth', vol: .05, slide: 880, rev: .3, lp: 1200 });
        return;
    }
    // Knall: weiss, Feuerball, Grollen, lang wackeln; auf dem Canvas grosse Ringe ueber die ganze Map
    el.className = '';
    void el.offsetWidth;
    el.className = 'boom';
    el.innerHTML = '';
    setTimeout(() => { el.className = ''; }, 3700);
    sNoise({ dur: 3.5, vol: .6, type: 'lowpass', f: 700, f2: 40, rev: .7, a: .002 });
    sTone(40, { dur: 4, type: 'sine', vol: .5, slide: 20, rev: .7 });
    sTone(80, { dur: 2, type: 'triangle', vol: .2, slide: 30, rev: .5 });
    shShake(60, 3000);
    const t0 = performance.now();
    for (let i = 0; i < 6; i++) shFx.push({ type: 'shBoom', x: d.x, y: d.y, r: 900 + i * 700, nuke: true, t: t0 - i * 120 });
}
