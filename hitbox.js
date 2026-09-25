// Hitboxen passend zu den Pixel-Figuren (25.09.2026, Max: „man kann bei vielen durch
// Oberkoerper oder Koepfe schiessen"). Der Server kannte nur einen Kreis um die Fuesse
// (Radius r), die Sprites ragen aber bis zu ~5 r nach oben. Hier wird einmal beim Start
// aus denselben Sprite-Daten, die der Browser zeichnet (public/bfx.js + pfx.js), die Hoehe
// jeder Figur ausgerechnet: top(kind) = wie viele r ueber dem Mittelpunkt der Kopf endet.
// Geprueft wird dann gegen eine senkrechte Kapsel (Radius r) vom Mittelpunkt bis zum Kopf.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOP = {};
let PLAYER_TOP = 0;

try {
    const noop = () => {};
    const ctx = {
        console, Math,
        performance: { now: () => 0 },
        document: { createElement: () => ({ getContext: () => new Proxy({}, { get: () => noop }) }) }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    const dir = path.join(__dirname, 'public');
    for (const f of ['bfx.js', 'pfx.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
    const PX = vm.runInContext('PX', ctx), pxTop = vm.runInContext('pxTop', ctx), pxScale = vm.runInContext('pxScale', ctx);
    const M = require('./arena-mobs');
    // pxTop ist linear in r (ohne Pixel-Raster); mit r = 100 rechnen und auf r = 1 umlegen.
    // Leere Zeilen oben im Raster zaehlen nicht zum Koerper.
    const topOf = (k, special) => {
        const blank = PX[k].body.findIndex(row => /[^.]/.test(row));
        return Math.max(0, (-pxTop(k, 100, special) - Math.max(0, blank) * pxScale(k, 100, special)) / 100);
    };
    for (const [k, d] of Object.entries(M.MOBS)) if (PX[k]) TOP[k] = topOf(k, !!(d.special || d.boss));
    const pk = ctx.window.pxPlayerKind ? ctx.window.pxPlayerKind('#ff5bd6') : null;
    if (pk) PLAYER_TOP = topOf(pk, true);
} catch (e) {
    console.error('hitbox: Sprites nicht lesbar, bleibe bei Kreisen', e.message);
}

// Abstand eines Punkts zur Kapsel (negativ = drin). x0/y0 = Mittelpunkt, r = Radius, top = Kopf in r
function gap(x0, y0, r, top, x, y) {
    const hi = y0 - Math.max(0, top - 1) * r;          // oberster Mittelpunkt der Kapsel
    const cy = Math.max(hi, Math.min(y0, y));
    return Math.hypot(x - x0, y - cy) - r;
}

// Punkte auf der Achse (fuer Strahlen: Fuss, Mitte, Kopf)
function axis(x0, y0, r, top) {
    const hi = y0 - Math.max(0, top - 1) * r;
    return hi < y0 ? [[x0, y0], [x0, (y0 + hi) / 2], [x0, hi]] : [[x0, y0]];
}

module.exports = {
    TOP,
    mobTop: kind => TOP[kind] || 1,
    playerTop: () => PLAYER_TOP || 1,
    // groesste Hoehe, fuer die Umkreissuche (mobsNear)
    maxReach: r => r * Math.max(1, ...Object.values(TOP), PLAYER_TOP),
    gap, axis
};
