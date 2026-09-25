// Unique-Items als eigene Grafik (25.09.2026, Max: „nur custom Dinger fuer die Unique Items …
// nimm bessere Grafiken, z. B. Rasengan" – Referenz: leuchtende Energiekugel mit Wirbeln).
// Bilder aus dem Netz gehen aus dem Container nicht (Bild-Hosts gesperrt), deshalb SVG mit
// echten Filtern: Bloom (Blur + Merge), Turbulenz fuer Energie/Feuer, Metall-Verlaeufe.
// viewBox 0 0 64 64. Filter/Verlaeufe liegen einmal im Dokument (UNIQUE_DEFS, unten).

(function () {
    // Pseudo-Zufall mit festem Seed, damit jedes Icon immer gleich aussieht
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const f = n => Math.round(n * 10) / 10;

    // Energiekugel: Halo, Wirbel-Ellipsen in zufaelligen Winkeln, heller Kern
    function orb(cx, cy, r, c1, c2, c3, n = 14, s = 3) {
        seed = s * 7919;
        let o = `<circle cx="${cx}" cy="${cy}" r="${f(r * 1.5)}" fill="${c3}" opacity=".45" filter="url(#ug-halo)"/>` +
            `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ug-orb-${c1.slice(1)})" filter="url(#ug-soft)"/>`;
        let rings = '';
        for (let i = 0; i < n; i++) {
            const a = f(rnd() * 180), rx = f(r * (.55 + rnd() * .5)), ry = f(r * (.15 + rnd() * .45)), w = f(.4 + rnd() * .9);
            rings += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${cx} ${cy})" fill="none" stroke="${i % 3 ? c2 : '#fff'}" stroke-width="${w}" opacity="${f(.5 + rnd() * .5)}"/>`;
        }
        // Ausreisser-Wirbel ueber den Rand (wie im Referenzbild)
        for (let i = 0; i < 5; i++) {
            const a = rnd() * Math.PI * 2, r1 = r * 1.05, r2 = r * (1.3 + rnd() * .35);
            const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1, x2 = cx + Math.cos(a + .9) * r2, y2 = cy + Math.sin(a + .9) * r2;
            rings += `<path d="M${f(x1)} ${f(y1)}Q${f(cx + Math.cos(a + .4) * r2 * 1.1)} ${f(cy + Math.sin(a + .4) * r2 * 1.1)} ${f(x2)} ${f(y2)}" fill="none" stroke="${c2}" stroke-width=".7" opacity=".7"/>`;
        }
        o += `<g filter="url(#ug-glow)">${rings}</g>`;
        o += `<circle cx="${cx}" cy="${cy}" r="${f(r * .42)}" fill="#fff" opacity=".85" filter="url(#ug-halo)"/><circle cx="${cx}" cy="${cy}" r="${f(r * .2)}" fill="#fff"/>`;
        return o;
    }
    // Blitz: gezackter Pfad, doppelt (Glow + weisser Kern)
    function bolt(x1, y1, x2, y2, col, jag = 5, s = 1, w = 2) {
        seed = s * 104729;
        const n = 7;
        let d = `M${x1} ${y1}`;
        for (let i = 1; i < n; i++) {
            const t = i / n, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t, nx = -(y2 - y1), ny = x2 - x1, L = Math.hypot(nx, ny) || 1, k = (rnd() - .5) * 2 * jag;
            d += `L${f(px + nx / L * k)} ${f(py + ny / L * k)}`;
        }
        d += `L${x2} ${y2}`;
        return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w * 2.2}" stroke-linejoin="round" opacity=".7" filter="url(#ug-glow)"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${w * .7}" stroke-linejoin="round"/>`;
    }
    // Klinge (Katana-Form) mit Metallverlauf, Hamon-Linie und Glanzkante; Winkel in Grad
    function blade(x, y, len, w, ang, opt = {}) {
        const steel = opt.steel || 'url(#ug-steel)';
        const tip = `M0 0 C ${f(len * .3)} ${f(-w * .2)} ${f(len * .75)} ${f(-w * .9)} ${len} ${f(-w * 1.9)} L ${f(len * .96)} ${f(-w * .2)} C ${f(len * .7)} ${f(w * .6)} ${f(len * .3)} ${f(w * 1.05)} 0 ${w} Z`;
        return `<g transform="translate(${x} ${y}) rotate(${ang})">` +
            (opt.glow ? `<path d="${tip}" fill="${opt.glow}" opacity=".55" filter="url(#ug-halo)"/>` : '') +
            `<path d="${tip}" fill="${steel}" stroke="${opt.edge || '#2a2e34'}" stroke-width=".6"/>` +
            `<path d="M2 ${f(w * .55)} C ${f(len * .35)} ${f(w * .6)} ${f(len * .72)} ${f(-w * .1)} ${f(len * .95)} ${f(-w * 1.4)}" fill="none" stroke="${opt.hamon || 'rgba(255,255,255,.75)'}" stroke-width=".7"/>` +
            `<path d="M1 .5 C ${f(len * .3)} ${f(w * .2)} ${f(len * .7)} ${f(-w * .5)} ${f(len * .98)} ${f(-w * 1.75)}" fill="none" stroke="#fff" stroke-width=".5" opacity=".9"/>` +
            (opt.guard ? opt.guard : `<ellipse cx="-1" cy="${f(w / 2)}" rx="2" ry="${f(w * 1.1)}" fill="#1a1a1a" stroke="#c9a53a" stroke-width=".6"/>`) +
            `<rect x="${-(opt.hilt || 14)}" y="${f(w * .1)}" width="${opt.hilt || 14}" height="${f(w * .8)}" rx="1" fill="${opt.hiltCol || '#1a1a22'}"/>` +
            `<path d="${Array.from({ length: Math.floor((opt.hilt || 14) / 3) }, (_, i) => `M${-(opt.hilt || 14) + 1.5 + i * 3} ${f(w * .1)}l1.5 ${f(w * .8)}`).join('')}" stroke="${opt.wrap || '#c9c9d0'}" stroke-width=".8"/>` +
            `</g>`;
    }
    // Flammen aus Turbulenz (Farbe per Verlauf-ID)
    function flame(cx, base, h, w, grad) {
        return `<path d="M${cx - w} ${base}C${cx - w * 1.1} ${base - h * .45} ${cx - w * .3} ${base - h * .55} ${cx - w * .2} ${base - h}C${cx + w * .25} ${base - h * .6} ${cx + w * .5} ${base - h * .75} ${cx + w * .45} ${base - h * .95}C${cx + w * 1.05} ${base - h * .5} ${cx + w * 1.1} ${base - h * .2} ${cx + w} ${base}Z" fill="url(#${grad})" filter="url(#ug-fire)"/>`;
    }

    const U = {};
    // ================= Waffen =================
    U.rasengan = orb(32, 32, 17, '#6fc8ff', '#bfe9ff', '#2a8cff', 16, 3);
    U.hollowpurple = `<circle cx="18" cy="30" r="9" fill="#ff3b3b" opacity=".35" filter="url(#ug-halo)"/><circle cx="46" cy="34" r="9" fill="#3b8cff" opacity=".35" filter="url(#ug-halo)"/>` + orb(32, 32, 16, '#c77dff', '#f0d0ff', '#8a20e0', 15, 5);
    U.spiritgun = orb(49, 15, 9, '#8fe6ff', '#e0fbff', '#20a0ff', 9, 11) +
        `<path d="M6 54l12-10 7-2 11-17c2-3 6-1 4 2l-7 12 6 .5c3 .3 3 3.5.5 4.5l-9 4-2 6H14z" fill="url(#ug-skin)" stroke="#6a3e22" stroke-width="1"/><path d="M5 52l8 9" stroke="#1d3a8a" stroke-width="8"/><path d="M27 36c3-1 5-2 7-4" stroke="#b07a55" stroke-width=".8" fill="none"/>`;
    U.kamehameha = `<path d="M26 20L64 8v48L26 44z" fill="url(#ug-beam)" filter="url(#ug-glow)"/><path d="M26 27L64 22v20L26 37z" fill="#fff" opacity=".8" filter="url(#ug-soft)"/>` + orb(24, 32, 11, '#8fe6ff', '#e0fbff', '#1e8cff', 10, 13) +
        `<path d="M2 23c6-2 12 0 14 5l-2 4 2 4c-2 5-8 7-14 5z" fill="url(#ug-skin)" stroke="#6a3e22" stroke-width="1"/><path d="M0 21h6v22H0z" fill="#f07a10"/>`;
    U.getsuga = `<path d="M6 50C20 44 34 36 44 16" fill="none" stroke="#000" stroke-width="7" opacity=".85" filter="url(#ug-soft)"/><path d="M8 52C22 46 36 38 46 18" fill="none" stroke="#e8203a" stroke-width="2" filter="url(#ug-glow)"/>` +
        blade(20, 46, 42, 6, -52, { steel: 'url(#ug-dark)', hamon: '#8a95a0', edge: '#8a95a0', hilt: 11, guard: '<rect x="-2" y="-1" width="3" height="8" fill="#333"/>', wrap: '#e8e8e8', hiltCol: '#2a2a2a' });
    U.nichirin = blade(16, 50, 44, 4.5, -45, { steel: 'url(#ug-dark)', hamon: '#6ae0a0', edge: '#3a8a5a', glow: '#2ae08a', guard: '<circle cx="-1" cy="2.2" r="4.2" fill="#111" stroke="#6a6a6a" stroke-width=".6"/>', wrap: '#2a8a5a' });
    U.kyoka = blade(16, 50, 44, 4.5, -45, { hamon: '#c8a8ff', glow: '#b48cff', guard: '<ellipse cx="-1" cy="2.2" rx="2.4" ry="5.5" fill="#6a4aa8" stroke="#e0d0ff" stroke-width=".6"/>', wrap: '#6a4aa8', hiltCol: '#e8e0f8' }) +
        `<g filter="url(#ug-glow)" fill="#e0d0ff"><circle cx="50" cy="12" r="1.6"/><circle cx="56" cy="22" r="1.2"/><circle cx="44" cy="7" r="1"/><circle cx="58" cy="10" r=".8"/></g>`;
    U.senbon = blade(14, 52, 40, 4, -45, { steel: 'url(#ug-steel)', hamon: '#ffc0dc', guard: '<rect x="-2" y="-1.5" width="3" height="7" rx="1" fill="#b8963a"/>', wrap: '#e0d0e8', hiltCol: '#2a1a2a' }) +
        (() => { seed = 99; let p = ''; for (let i = 0; i < 16; i++) { const x = 30 + rnd() * 32, y = 2 + rnd() * 36, r = 1.3 + rnd() * 1.6, a = rnd() * 360; p += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 1.4)}" ry="${f(r)}" transform="rotate(${f(a)} ${f(x)} ${f(y)})" fill="${i % 3 ? '#ff9ec8' : '#ffd0e4'}"/>`; } return `<g filter="url(#ug-glow)">${p}</g>`; })();
    U.dragonslayer = `<g transform="rotate(-40 32 32)"><rect x="23" y="-2" width="18" height="46" rx="1" fill="url(#ug-iron)" stroke="#1a1c20" stroke-width="1"/><path d="M23 -2h18v5H23z" fill="#6a7078"/>` +
        `<path d="M26 8l4 3M34 16l5 4M27 26l7 4M36 34l3 2" stroke="#5a1a10" stroke-width="2.2" opacity=".75" stroke-linecap="round"/><path d="M40.5 -2v46" stroke="#b8c0c8" stroke-width="1"/>` +
        `<rect x="19" y="44" width="26" height="4" fill="#222428" stroke="#000" stroke-width=".5"/><rect x="29" y="48" width="6" height="15" fill="#3a2414"/><path d="M29 51h6M29 55h6M29 59h6" stroke="#6a4424" stroke-width="1"/></g>`;
    U.venuzdonoa = `<g transform="rotate(-42 32 32)"><path d="M32 -2l7 12v36h-14V10z" fill="#7a2ac0" opacity=".5" filter="url(#ug-halo)"/><path d="M32 -2l7 12v36h-14V10z" fill="url(#ug-void)" stroke="#e0a0ff" stroke-width=".8"/>` +
        `<path d="M32 2v42" stroke="#1a0028" stroke-width="1.5"/><path d="M19 46h26l-5 5H24z" fill="#1a1a1a" stroke="#c070ff" stroke-width=".8"/><rect x="29" y="51" width="6" height="11" fill="#2a1a2a"/><circle cx="32" cy="63" r="2.8" fill="#c070ff" filter="url(#ug-glow)"/>` +
        `<ellipse cx="32" cy="22" rx="4" ry="2.2" fill="#ff3050" filter="url(#ug-glow)"/><ellipse cx="32" cy="22" rx="1" ry="2" fill="#000"/></g>`;
    U.amaterasu = `<ellipse cx="32" cy="40" rx="24" ry="26" fill="#8a20ff" opacity=".55" filter="url(#ug-halo)"/>` + flame(32, 60, 50, 20, 'ug-blackfire') + flame(24, 60, 32, 10, 'ug-blackfire') + flame(42, 60, 36, 11, 'ug-blackfire') +
        `<circle cx="32" cy="42" r="10" fill="#e0101c" filter="url(#ug-glow)"/><circle cx="32" cy="42" r="9" fill="url(#ug-sharingan)"/><circle cx="32" cy="42" r="2.6" fill="#000"/><circle cx="32" cy="42" r="5.8" fill="none" stroke="#000" stroke-width=".7"/>` +
        `<g fill="#000"><path d="M32 36.2a1.8 1.8 0 1 1 -.1 0c1 1 1.5 2 .8 3"/><path d="M37.1 45a1.8 1.8 0 1 1 0 .1c-1.4 0-2.4-.6-2.6-1.4"/><path d="M26.9 45a1.8 1.8 0 1 1 0 .1c.4-1.3 1.3-2 2.4-2"/></g>`;
    U.gob = `<circle cx="32" cy="32" r="26" fill="#f2c230" opacity=".35" filter="url(#ug-halo)"/>` +
        `<g filter="url(#ug-glow)" fill="none" stroke="#ffe27a"><circle cx="32" cy="32" r="21" stroke-width="1.2"/><circle cx="32" cy="32" r="15" stroke-width=".8" stroke-dasharray="2 2"/></g>` +
        [0, 60, 120, 180, 240, 300].map((a, i) => `<g transform="rotate(${a} 32 32)"><path d="M32 30V6l2-3 2 3v24z" fill="url(#ug-steel)" stroke="#6a5010" stroke-width=".5"/><rect x="30" y="29" width="8" height="2" fill="#c9a53a"/></g>`).join('') +
        `<circle cx="32" cy="32" r="6" fill="#fff6c0" filter="url(#ug-glow)"/><circle cx="32" cy="32" r="3" fill="#fff"/>`;
    U.cutlasses = `<g transform="rotate(-18 32 32)"><rect x="8" y="18" width="36" height="9" rx="2" fill="url(#ug-steel)" stroke="#3a4048" stroke-width=".8"/><rect x="38" y="19.5" width="10" height="3" fill="#6a7078"/><path d="M14 27h10l-3 17h-9z" fill="#2a2a2e"/><path d="M9 21h28" stroke="#fff" stroke-width=".6" opacity=".8"/></g>` +
        `<g transform="rotate(18 32 32) translate(-2 16)"><rect x="20" y="18" width="36" height="9" rx="2" fill="url(#ug-steel)" stroke="#3a4048" stroke-width=".8"/><rect x="16" y="19.5" width="10" height="3" fill="#6a7078"/><path d="M40 27h10l1 17h-9z" fill="#2a2a2e"/><path d="M27 21h28" stroke="#fff" stroke-width=".6" opacity=".8"/></g>` +
        `<circle cx="54" cy="12" r="4" fill="#ffb040" filter="url(#ug-glow)"/><circle cx="10" cy="46" r="3.5" fill="#ffb040" filter="url(#ug-glow)"/>`;
    U.kagune = `<g filter="url(#ug-glow)" fill="none" stroke-linecap="round" opacity=".6"><path d="M12 60C8 40 20 26 10 4" stroke="#ff2030" stroke-width="10"/><path d="M52 60c4-20 12-30 6-54" stroke="#ff2030" stroke-width="10"/></g>` +
        `<g fill="none" stroke-linecap="round"><path d="M12 60C8 40 20 26 10 4" stroke="url(#ug-kagune)" stroke-width="7"/><path d="M25 62C22 42 30 26 24 3" stroke="url(#ug-kagune)" stroke-width="7"/><path d="M39 62c2-20 10-34 6-58" stroke="url(#ug-kagune)" stroke-width="7"/><path d="M52 60c4-20 12-30 6-54" stroke="url(#ug-kagune)" stroke-width="7"/></g>` +
        `<g stroke="#2a0004" stroke-width="1.2"><path d="M8 44h8M13 26h7M20 46h8M22 24h8M35 44h8M40 22h8M48 42h8M53 24h8"/></g>`;
    U.longinus = `<g transform="rotate(-40 32 32)"><path d="M32 16v48" stroke="#ff2030" stroke-width="6" opacity=".45" filter="url(#ug-halo)"/>` +
        `<path d="M29.5 16c-1.5 10 1 22 2.5 48M35 16c1.5 10-1 22-2.5 48" fill="none" stroke="#c0101c" stroke-width="2.4"/><path d="M29.5 16c-1.5 10 1 22 2.5 48" fill="none" stroke="#ff6a70" stroke-width=".7"/>` +
        `<path d="M22 -2c3 9 7 14 10 18 3-4 7-9 10-18-3 6-6 9-10 9s-7-3-10-9z" fill="url(#ug-blood)" stroke="#500006" stroke-width=".8"/></g>`;
    U.gomu = `<path d="M4 42h13v14H4z" fill="#d6242c" stroke="#7a0a10"/><path d="M4 46h13" stroke="#ff6a60" stroke-width=".8"/>` +
        `<path d="M17 49c8-2 14 1 20-2 6-3 6-9 10-12" fill="none" stroke="url(#ug-skin)" stroke-width="7" stroke-linecap="round"/>` +
        `<g transform="translate(40 18) rotate(-20)"><rect x="0" y="4" width="21" height="19" rx="7" fill="url(#ug-skin)" stroke="#6a3e22" stroke-width="1"/><path d="M5 5v8M10.5 4v9M16 5v8" stroke="#8a5a3a" stroke-width="1"/></g>` +
        `<g filter="url(#ug-glow)" stroke="#ffd23f" stroke-width="2" stroke-linecap="round"><path d="M40 12l3-7M50 10l1-8M60 16l3-5M62 28h2"/></g>`;
    U.chainsaw = `<rect x="3" y="24" width="24" height="18" rx="4" fill="url(#ug-orange)" stroke="#6a2a00" stroke-width="1"/><path d="M7 20h13v4H7z" fill="#222"/><circle cx="13" cy="33" r="3.5" fill="#222"/>` +
        `<rect x="25" y="27" width="37" height="12" rx="6" fill="url(#ug-steel)" stroke="#333" stroke-width=".8"/>` +
        `<path d="M27 27l3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3M27 39l3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3" fill="none" stroke="#1a1a1a" stroke-width="1.4"/>` +
        `<path d="M52 20l3-5M58 22l5-3M56 44l4 4" stroke="#c8101c" stroke-width="1.5" filter="url(#ug-soft)"/>`;
    U.mjolnir = bolt(52, 2, 44, 20, '#6ad0ff', 3, 2, 1.1) + bolt(60, 14, 50, 26, '#6ad0ff', 2.5, 5, .9) +
        `<g transform="rotate(-32 32 32)"><rect x="11" y="5" width="42" height="23" rx="2.5" fill="url(#ug-mjol)" stroke="#2a3038" stroke-width="1"/>` +
        `<path d="M11 11h42M11 22h42" stroke="#6a727c" stroke-width=".8"/><path d="M12 6h40" stroke="#fff" stroke-width=".8" opacity=".8"/><path d="M26 14l3 3 3-3 3 3 3-3" fill="none" stroke="#3a4048" stroke-width="1.2"/>` +
        `<rect x="28.5" y="28" width="7" height="25" fill="url(#ug-leather)"/><path d="M28.5 31l7 3M28.5 36l7 3M28.5 41l7 3M28.5 46l7 3" stroke="#2a1a0c" stroke-width="1.1"/>` +
        `<rect x="27" y="53" width="10" height="4" rx="1" fill="url(#ug-steel)"/><path d="M32 57c-5 3-5 7 0 7s5-4 0-7" fill="none" stroke="#6b4424" stroke-width="2"/></g>`;
    U.killerqueen = `<circle cx="32" cy="34" r="24" fill="#ff7ab8" opacity=".3" filter="url(#ug-halo)"/><path d="M15 14l7 11M49 14l-7 11" stroke="#e98ab8" stroke-width="6" stroke-linecap="round"/>` +
        `<ellipse cx="32" cy="33" rx="17" ry="18" fill="url(#ug-pink)" stroke="#8a3a60" stroke-width="1.2"/><path d="M17 29h30" stroke="#fff" stroke-width="2.4"/>` +
        `<circle cx="25" cy="30" r="3.3" fill="#fff"/><circle cx="39" cy="30" r="3.3" fill="#fff"/><circle cx="25" cy="30" r="1.5" fill="#5a1a3a"/><circle cx="39" cy="30" r="1.5" fill="#5a1a3a"/><path d="M26 42h12" stroke="#8a3a60" stroke-width="1.4"/>` +
        `<g transform="translate(32 54)"><circle r="6.5" fill="#fff" stroke="#8a3a60"/><circle cx="-2.2" cy="-1.2" r="1.4"/><circle cx="2.2" cy="-1.2" r="1.4"/><path d="M-2.2 3h4.4" stroke="#000"/></g>`;
    U.portalgun = `<circle cx="52" cy="34" r="12" fill="#6cff4a" opacity=".55" filter="url(#ug-halo)"/><g filter="url(#ug-fire2)"><circle cx="52" cy="34" r="9" fill="url(#ug-portal)"/></g>` +
        `<rect x="6" y="26" width="38" height="16" rx="7" fill="url(#ug-white)" stroke="#5a6068" stroke-width="1"/><rect x="12" y="15" width="24" height="11" rx="5.5" fill="#8cff6a" stroke="#2a7a1a" stroke-width="1" filter="url(#ug-soft)"/>` +
        `<rect x="14" y="17" width="20" height="3" rx="1.5" fill="#e8ffd8"/><path d="M12 42h11l-2 15h-8z" fill="url(#ug-white)" stroke="#5a6068"/><rect x="42" y="28" width="6" height="12" rx="2" fill="#4a5058"/><circle cx="18" cy="34" r="2.6" fill="#e03c3c"/>`;
    // ================= Ruestung =================
    U.scouter = `<path d="M44 12c9 4 11 15 6 24" fill="none" stroke="url(#ug-steel)" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="30" r="7" fill="url(#ug-steel)" stroke="#4a5058" stroke-width="1"/>` +
        `<path d="M6 16h32l4 17-8 11H10z" fill="#28f070" opacity=".35" filter="url(#ug-halo)"/><path d="M6 16h32l4 17-8 11H10z" fill="#28e068" fill-opacity=".75" stroke="#127a32" stroke-width="1.5"/><path d="M10 20h22" stroke="#caffd8" stroke-width="1.2"/>` +
        `<text x="10" y="36" font-size="8" font-family="monospace" font-weight="700" fill="#023a10">9000</text>`;
    U.strawhat = `<ellipse cx="32" cy="40" rx="29" ry="12" fill="#000" opacity=".3" filter="url(#ug-soft)"/><ellipse cx="32" cy="37" rx="29" ry="12" fill="url(#ug-straw)" stroke="#8a6410" stroke-width="1"/>` +
        `<path d="M15 35c0-15 8-23 17-23s17 8 17 23z" fill="url(#ug-straw)" stroke="#8a6410" stroke-width="1"/><path d="M15.5 31c10 4 22 4 33 0v5.5c-11 4-23 4-33 0z" fill="#d6242c"/><path d="M16 32c10 3.5 21 3.5 32 0" stroke="#ff6a60" stroke-width=".7" fill="none"/>` +
        `<g stroke="#b8902a" stroke-width=".6" opacity=".8" fill="none"><path d="M6 37c10 5 42 5 52 0M8 41c10 4 38 4 48 0M22 18c6-3 14-3 20 0M18 24c8-3 20-3 28 0"/></g>`;
    U.odm = `<rect x="4" y="18" width="11" height="32" rx="5" fill="url(#ug-steel)" stroke="#3a4048" stroke-width="1"/><rect x="49" y="18" width="11" height="32" rx="5" fill="url(#ug-steel)" stroke="#3a4048" stroke-width="1"/>` +
        `<rect x="15" y="28" width="34" height="8" rx="2" fill="url(#ug-leather)"/><circle cx="32" cy="32" r="8" fill="url(#ug-steel)" stroke="#3a4048" stroke-width="1"/><circle cx="32" cy="32" r="3" fill="#3a4048"/>` +
        `<path d="M9.5 18V6M54.5 18V6" stroke="#dfe6ee" stroke-width="3"/><path d="M9.5 6L4 1M54.5 6L60 1" stroke="#8a9098" stroke-width="2"/><path d="M4 60l10-7M60 60l-10-7" stroke="#6a7078" stroke-width="2"/>` +
        `<path d="M2 58c6-3 10-2 14 0" fill="none" stroke="#fff" stroke-width="2" opacity=".6" filter="url(#ug-soft)"/>`;
    U.hokage = `<path d="M15 6h34l9 52H6z" fill="url(#ug-white)" stroke="#8a8a80" stroke-width="1"/><path d="M22 6l10 12 10-12" fill="none" stroke="#b8b8b0" stroke-width="2"/>` +
        `<path d="M6 58l3-14c2 4 4 4 6 0 2 5 4 5 6 0 2 5 4 5 6 0 2 5 4 5 6 0 2 5 4 5 6 0 2 4 4 4 6 0l3 14z" fill="url(#ug-red)"/>` +
        flame(32, 42, 14, 5, 'ug-redfire');
    U.kamina = `<path d="M3 24l25 4 4 6 4-6 25-4-6 19-19-7h-8L9 43z" fill="#ff7a1a" opacity=".45" filter="url(#ug-halo)"/><path d="M3 24l25 4 4 6 4-6 25-4-6 19-19-7h-8L9 43z" fill="url(#ug-shades)" stroke="#6a2400" stroke-width="1.2"/>` +
        `<path d="M8 27l15 3-2 7-8 3z" fill="#ffd0a0" opacity=".6"/><path d="M3 24L0 15M61 24l3-9" stroke="#6a2400" stroke-width="2"/>`;
    U.saitama = `<path d="M13 6h38l11 52H2z" fill="url(#ug-white)" stroke="#8a8a80" stroke-width="1"/><path d="M19 6c4 6 22 6 26 0" fill="#ffd23f"/><circle cx="17" cy="11" r="3" fill="#c9c9c0"/><circle cx="47" cy="11" r="3" fill="#c9c9c0"/>` +
        `<g transform="translate(21 28)"><rect width="22" height="20" rx="7" fill="#ff2030" opacity=".4" filter="url(#ug-halo)"/><rect width="22" height="20" rx="7" fill="url(#ug-red)" stroke="#6a0a10" stroke-width="1"/><path d="M5.5 1v8M11 0v9M16.5 1v8" stroke="#6a0a10" stroke-width="1"/></g>`;
    U.ironman = `<path d="M11 22C11 7 21 3 32 3s21 4 21 19v18c0 11-9 21-21 21S11 51 11 40z" fill="url(#ug-red)" stroke="#4a0006" stroke-width="1.2"/>` +
        `<path d="M17 22h30v16c0 9-7 15-15 15s-15-6-15-15z" fill="url(#ug-gold)" stroke="#7a5a00" stroke-width="1"/><path d="M20 28h10l-1 4h-8zM44 28H34l1 4h8z" fill="#dffaff" filter="url(#ug-glow)"/>` +
        `<path d="M26 45h12" stroke="#7a5a00" stroke-width="1.4"/><path d="M14 10c4-4 10-6 18-6" fill="none" stroke="#fff" stroke-width="1.2" opacity=".5"/>`;
    U.susanoo = `<circle cx="32" cy="34" r="28" fill="#9a4ae8" opacity=".45" filter="url(#ug-halo)"/>` +
        `<path d="M13 30C13 15 21 9 32 9s19 6 19 21v10l-6 15H19l-6-15z" fill="url(#ug-susa)" stroke="#f0d8ff" stroke-width="1.2" filter="url(#ug-glow)"/>` +
        `<path d="M13 22L4 6l15 9M51 22l9-16-15 9" fill="#9a4ae8" stroke="#f0d8ff" stroke-width="1"/><path d="M21 30h9M34 30h9" stroke="#fff" stroke-width="3" filter="url(#ug-glow)"/><path d="M19 42h26M21 48h22" stroke="#f0d8ff" stroke-width="1.2"/>`;
    U.byakugan = `<path d="M3 32c8-12 19-16 29-16s21 4 29 16c-8 12-19 16-29 16S11 44 3 32z" fill="url(#ug-white)" stroke="#7a76a0" stroke-width="1"/><circle cx="32" cy="32" r="11" fill="#e8e2f8" stroke="#b0a8d0"/>` +
        `<circle cx="32" cy="32" r="7" fill="#f8f6ff" filter="url(#ug-soft)"/><g stroke="#5a4a8a" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M3 32c-2-6-2-10 0-14M61 32c2-6 2-10 0-14M9 22c-3-4-4-8-4-12M55 22c3-4 4-8 4-12M19 16c-1-4 0-8 2-10M45 16c1-4 0-8-2-10"/></g>`;
    U.kaneki = `<path d="M9 20C9 9 20 5 32 5s23 4 23 15v14c0 15-10 25-23 25S9 49 9 34z" fill="url(#ug-leatherdk)" stroke="#555" stroke-width="1"/>` +
        `<path d="M17 26c3-3 10-3 13 0l-2 5h-9z" fill="#0a0a0c" stroke="#777" stroke-width=".8"/><circle cx="42" cy="28" r="6" fill="#ff1020" opacity=".6" filter="url(#ug-halo)"/><circle cx="42" cy="28" r="5" fill="#fff"/><circle cx="42" cy="28" r="3.2" fill="#e0101c"/><circle cx="42" cy="28" r="1.3" fill="#000"/>` +
        `<path d="M17 43h30" stroke="#e8e8e8" stroke-width="3.4"/><path d="M19 40v6M23 40v6M27 40v6M31 40v6M35 40v6M39 40v6M43 40v6" stroke="#e8e8e8" stroke-width="1.4"/><path d="M11 20l6-9" stroke="#666" stroke-width="2"/>`;
    U.rocklee = `<path d="M7 6h17v34H7zM40 6h17v34H40z" fill="url(#ug-green)" stroke="#124a12" stroke-width="1"/><path d="M5 35h21v11H5zM38 35h21v11H38z" fill="url(#ug-orange)" stroke="#6a3000" stroke-width="1"/>` +
        `<g fill="url(#ug-leather)" stroke="#4a2a10" stroke-width="1"><rect x="6" y="46" width="19" height="11" rx="2"/><rect x="39" y="46" width="19" height="11" rx="2"/></g>` +
        `<text x="15.5" y="54.5" font-size="6" text-anchor="middle" fill="#f3e0b0" font-weight="800">500</text><text x="48.5" y="54.5" font-size="6" text-anchor="middle" fill="#f3e0b0" font-weight="800">500</text>`;
    U.geppo = `<path d="M17 18c4-9 15-9 17 0l2 19c9 2 15 6 15 12H13c-2-10 2-21 4-31z" fill="url(#ug-leatherdk)" stroke="#5a5a70" stroke-width="1"/>` +
        `<g fill="none" stroke="#e6f8ff" stroke-width="2.4" stroke-linecap="round" filter="url(#ug-glow)"><ellipse cx="32" cy="56" rx="22" ry="4.5"/><ellipse cx="32" cy="61" rx="13" ry="2.5"/></g><path d="M6 44c-4-2-4-7 0-9M58 44c4-2 4-7 0-9" stroke="#e6f8ff" stroke-width="2" fill="none" filter="url(#ug-glow)"/>`;
    U.allmight = `<path d="M19 9l-9-7 5 15zM45 9l9-7-5 15z" fill="url(#ug-gold)" stroke="#7a5a00" stroke-width=".8"/><path d="M11 22c0-9 8-13 21-13s21 4 21 13v24c0 9-8 15-21 15s-21-6-21-15z" fill="url(#ug-blue)" stroke="#081a50" stroke-width="1.2"/>` +
        `<path d="M11 26l21 10 21-10v8L32 44 11 34z" fill="#f4f4f0"/><path d="M11 34l21 10 21-10v4L32 48 11 38z" fill="#d6242c"/><path d="M25 15h14l-7 8z" fill="url(#ug-gold)"/><path d="M14 18c4-4 10-6 18-6" fill="none" stroke="#fff" stroke-width="1" opacity=".4"/>`;
    U.killua = bolt(40, 2, 22, 62, '#4ab0ff', 7, 21, 2.2) + bolt(20, 8, 44, 56, '#9fe0ff', 5, 33, 1.2) + `<circle cx="32" cy="32" r="10" fill="#4ab0ff" opacity=".35" filter="url(#ug-halo)"/>`;
    U.geass = `<path d="M3 32c8-12 19-16 29-16s21 4 29 16c-8 12-19 16-29 16S11 44 3 32z" fill="#1a0610" stroke="#6a2a4a" stroke-width="1"/><circle cx="32" cy="32" r="13" fill="#ff2040" opacity=".55" filter="url(#ug-halo)"/><circle cx="32" cy="32" r="12" fill="url(#ug-geass)"/>` +
        `<path d="M32 23c-6 2-11 6-13 11 4-2 8-2 11 0l2 7 2-7c3-2 7-2 11 0-2-5-7-9-13-11z" fill="#ffb0c8" stroke="#fff" stroke-width=".8" filter="url(#ug-glow)"/>`;
    U.flashstep = `<g><path d="M44 10a6 6 0 1 1 0 .1zM38 18h12l4 20-4 17h-4l-2-14-4 14h-4l2-19z" fill="#0a0a10"/><path d="M40 20l6 9" stroke="#fff" stroke-width="2"/>` +
        `<path d="M28 10a6 6 0 1 1 0 .1zM22 18h12l4 20-4 17h-4l-2-14-4 14h-4l2-19z" fill="#0a0a10" opacity=".4" filter="url(#ug-soft)"/><path d="M12 10a6 6 0 1 1 0 .1zM6 18h12l4 20-4 17h-4l-2-14-4 14H4l2-19z" fill="#0a0a10" opacity=".18" filter="url(#ug-halo)"/></g>` +
        `<path d="M4 40h26M8 46h22" stroke="#fff" stroke-width="1" opacity=".5"/>`;
    U.titan = `<path d="M11 20c0-13 8-19 21-19s21 6 21 19v10c0 15-8 29-21 29S11 45 11 30z" fill="url(#ug-titan)" stroke="#5a2a14" stroke-width="1.2"/><path d="M11 22c2-13 11-17 21-17s19 4 21 17c-4-6-11-6-21-6s-17 0-21 6z" fill="#2a1a10"/>` +
        `<path d="M21 30h9M34 30h9" stroke="#3a1a0c" stroke-width="3"/><circle cx="26" cy="33" r="2.8" fill="#3aff9a" filter="url(#ug-glow)"/><circle cx="38" cy="33" r="2.8" fill="#3aff9a" filter="url(#ug-glow)"/>` +
        `<path d="M15 44l6-4v15M49 44l-6-4v15" stroke="#9a2a20" stroke-width="2"/><path d="M21 49h22" stroke="#fff" stroke-width="3.2"/><path d="M23 47v5M27 47v5M31 47v5M35 47v5M39 47v5" stroke="#9a5a40"/>` +
        `<path d="M8 50c2-4 6-6 4-12M56 50c-2-4-6-6-4-12" stroke="#fff" stroke-width="2" opacity=".5" fill="none" filter="url(#ug-soft)"/>`;
    // ================= Verbrauchsgut =================
    U.chidori = `<circle cx="32" cy="30" r="22" fill="#4ab0ff" opacity=".5" filter="url(#ug-halo)"/>` +
        bolt(32, 30, 8, 12, '#6ad0ff', 4, 1, 1.2) + bolt(32, 30, 58, 14, '#6ad0ff', 4, 2, 1.2) + bolt(32, 30, 12, 50, '#6ad0ff', 4, 3, 1) + bolt(32, 30, 56, 46, '#6ad0ff', 4, 4, 1) + bolt(32, 30, 34, 4, '#6ad0ff', 3, 5, .9) +
        `<circle cx="32" cy="30" r="7" fill="#fff" filter="url(#ug-glow)"/><path d="M22 52c4-6 16-6 20 0v12H22z" fill="url(#ug-skin)" stroke="#6a3e22" stroke-width="1"/>`;
    U.genkidama = orb(32, 24, 17, '#8fd8ff', '#e0f8ff', '#3a9aff', 18, 17) +
        `<path d="M15 58l4-14 4 2 2-6 3 18zM49 58l-4-14-4 2-2-6-3 18z" fill="url(#ug-skin)" stroke="#6a3e22" stroke-width="1"/><path d="M13 58h38v6H13z" fill="#f07a10"/>`;
    U.infinitevoid = `<circle cx="32" cy="32" r="29" fill="#2a4aff" opacity=".4" filter="url(#ug-halo)"/><circle cx="32" cy="32" r="27" fill="url(#ug-voidbg)" stroke="#8ac0ff" stroke-width="1"/>` +
        (() => { seed = 55; let p = ''; for (let i = 0; i < 28; i++) { const a = rnd() * Math.PI * 2, r = 4 + rnd() * 22; p += `<circle cx="${f(32 + Math.cos(a) * r)}" cy="${f(32 + Math.sin(a) * r)}" r="${f(.3 + rnd() * .9)}" fill="#fff"/>`; } return `<g filter="url(#ug-glow)">${p}</g>`; })() +
        `<path d="M10 32c9-11 35-11 44 0-9 11-35 11-44 0z" fill="#f4f8ff" filter="url(#ug-soft)"/><circle cx="32" cy="32" r="8" fill="url(#ug-gojoeye)"/><circle cx="32" cy="32" r="3" fill="#061a4a"/><circle cx="29.5" cy="29.5" r="1.5" fill="#fff"/>`;
    U.shinra = `<circle cx="32" cy="32" r="29" fill="#d8c8ff" opacity=".4" filter="url(#ug-halo)"/><circle cx="32" cy="32" r="27" fill="url(#ug-rinne)"/>` +
        `<g fill="none" stroke="#2a1a4a" stroke-width="1.8"><circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="17.5"/><circle cx="32" cy="32" r="12"/><circle cx="32" cy="32" r="6.5"/></g><circle cx="32" cy="32" r="2.5" fill="#12082a"/>`;
    U.hiraishin = `<g transform="rotate(-35 32 32)"><path d="M32 0l4.5 21h-9z" fill="url(#ug-steel)" stroke="#3a4048" stroke-width=".6"/><path d="M27.5 17L17 7l6 15zM36.5 17L47 7l-6 15z" fill="url(#ug-steel)" stroke="#3a4048" stroke-width=".6"/>` +
        `<rect x="29.5" y="21" width="5" height="22" fill="#1a1a1e"/><path d="M29.5 24l5 2M29.5 29l5 2M29.5 34l5 2M29.5 39l5 2" stroke="#5a5a60"/><circle cx="32" cy="47" r="4" fill="none" stroke="url(#ug-steel)" stroke-width="2"/></g>` +
        `<g transform="rotate(12 46 47)"><rect x="40" y="35" width="11" height="24" fill="#f4ecd0" stroke="#8a7a5a" stroke-width=".6"/><path d="M42 40h7M42 44h7M45.5 40v14M42 50l7 4" stroke="#1a1a1a" stroke-width="1"/></g>` +
        `<circle cx="16" cy="14" r="5" fill="#ffd23f" opacity=".6" filter="url(#ug-halo)"/>`;
    U.chainjail = `<g filter="url(#ug-glow)" opacity=".7">` + [0, 1, 2, 3].map(i => `<ellipse cx="${9 + i * 8}" cy="${13 + i * 7}" rx="5" ry="3.5" transform="rotate(35 ${9 + i * 8} ${13 + i * 7})" fill="none" stroke="#ffd23f" stroke-width="3"/>`).join('') + `</g>` +
        [0, 1, 2, 3].map(i => `<ellipse cx="${9 + i * 8}" cy="${13 + i * 7}" rx="5" ry="3.5" transform="rotate(35 ${9 + i * 8} ${13 + i * 7})" fill="none" stroke="url(#ug-gold)" stroke-width="3"/>`).join('') +
        `<path d="M38 38l15 15-4 4-6-6-2 8-4-4 2-8-6-2z" fill="url(#ug-gold)" stroke="#6a4a00" stroke-width=".8"/><path d="M50 44c6-2 10 2 8 8" fill="none" stroke="url(#ug-gold)" stroke-width="3"/>`;
    U.hollowmask = `<path d="M9 22C9 9 20 3 32 3s23 6 23 19v10c0 15-10 27-23 27S9 47 9 32z" fill="url(#ug-bone)" stroke="#7a7a70" stroke-width="1"/>` +
        `<path d="M11 11l6 29M15 7l8 35" stroke="#c8101c" stroke-width="3"/><path d="M17 26c3-3 10-3 13 1l-3 4h-8zM47 26c-3-3-10-3-13 1l3 4h8z" fill="#000"/><circle cx="24" cy="28" r="1.8" fill="#ffd23f" filter="url(#ug-glow)"/><circle cx="40" cy="28" r="1.8" fill="#ffd23f" filter="url(#ug-glow)"/>` +
        `<path d="M19 45h26" stroke="#222" stroke-width="2"/><path d="M21 42v6M25 42v6M29 42v6M33 42v6M37 42v6M41 42v6" stroke="#222" stroke-width="1.4"/>`;
    U.deathnote = `<rect x="13" y="7" width="40" height="52" rx="2" fill="#000" opacity=".4" filter="url(#ug-soft)"/><rect x="11" y="5" width="40" height="52" rx="2" fill="url(#ug-book)" stroke="#3a3a44" stroke-width="1"/><rect x="11" y="5" width="5" height="52" fill="#16161c"/>` +
        `<text x="33" y="27" font-size="9" text-anchor="middle" fill="#f4f4f0" font-family="Georgia,serif" font-style="italic" font-weight="700">DEATH</text><text x="33" y="39" font-size="9" text-anchor="middle" fill="#f4f4f0" font-family="Georgia,serif" font-style="italic" font-weight="700">NOTE</text>` +
        `<path d="M14 8h36" stroke="#fff" stroke-width=".6" opacity=".25"/>`;
    U.philosopher = `<circle cx="32" cy="32" r="28" fill="none" stroke="#ff5050" stroke-width="1" opacity=".7" filter="url(#ug-glow)"/><path d="M32 5l23 40H9z" fill="none" stroke="#ff5050" stroke-width=".8" opacity=".6" filter="url(#ug-glow)"/>` +
        `<circle cx="32" cy="32" r="16" fill="#ff1020" opacity=".5" filter="url(#ug-halo)"/><path d="M32 13l15 12-4 21H21l-4-21z" fill="url(#ug-ruby)" stroke="#ff9090" stroke-width=".8"/>` +
        `<path d="M32 13l-4 12h8zM17 25h30M28 25l-7 21M36 25l7 21" fill="none" stroke="#ffb0b0" stroke-width=".7" opacity=".7"/><path d="M26 17l-3 6" stroke="#fff" stroke-width="1.5" opacity=".8"/>`;
    U.doordoor = `<circle cx="32" cy="37" r="23" fill="#b050e0" opacity=".35" filter="url(#ug-halo)"/><circle cx="32" cy="37" r="22" fill="url(#ug-fruit)" stroke="#3a1060" stroke-width="1"/>` +
        `<g fill="none" stroke="#4a1080" stroke-width="2"><path d="M19 31c2-4 6-4 8 0s-2 6-4 4"/><path d="M36 26c2-4 6-4 8 0s-2 6-4 4"/><path d="M21 47c2-4 6-4 8 0s-2 6-4 4"/><path d="M38 45c2-4 6-4 8 0s-2 6-4 4"/></g>` +
        `<path d="M32 15c0-6 4-10 8-10" fill="none" stroke="#2a7a1a" stroke-width="3"/><path d="M36 9c6-4 12 0 12 4-6 2-10 0-12-4z" fill="url(#ug-green)"/><ellipse cx="24" cy="26" rx="5" ry="3" fill="#fff" opacity=".35" transform="rotate(-30 24 26)"/>`;
    U.hoipoi = `<rect x="9" y="22" width="46" height="20" rx="10" fill="#000" opacity=".3" filter="url(#ug-soft)"/><rect x="9" y="21" width="46" height="20" rx="10" fill="url(#ug-white)" stroke="#7a7a80" stroke-width="1"/><path d="M32 21h13a10 10 0 0 1 0 20H32z" fill="url(#ug-red)"/>` +
        `<circle cx="46" cy="31" r="3.2" fill="url(#ug-gold)" stroke="#6a4a00"/><text x="20" y="35" font-size="9" font-weight="800" fill="#1c4ac8" font-family="sans-serif">CC</text><path d="M14 24h36" stroke="#fff" stroke-width="1" opacity=".7"/>`;
    U.zawarudo = `<circle cx="32" cy="36" r="26" fill="#ffd23f" opacity=".35" filter="url(#ug-halo)"/><circle cx="32" cy="36" r="22" fill="url(#ug-gold)" stroke="#6a4a00" stroke-width="1.5"/><circle cx="32" cy="36" r="17" fill="#fffbe8" stroke="#a07a10"/>` +
        `<rect x="28" y="5" width="8" height="8" rx="2" fill="url(#ug-gold)" stroke="#6a4a00"/><g stroke="#3a2a10" stroke-width="1.4"><path d="M32 22v3M32 47v3M18 36h3M43 36h3"/></g>` +
        `<path d="M32 36V24M32 36l7 5" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="36" r="1.8" fill="#1a1a1a"/><path d="M45 19l6-6M51 26h7M44 13l3-7" stroke="#ffe27a" stroke-width="2" filter="url(#ug-glow)"/>`;
    U.bunshin = `<circle cx="32" cy="36" r="26" fill="#fff" opacity=".35" filter="url(#ug-halo)"/>` +
        [[16, .55], [48, .55], [32, 1]].map(([x, o]) => `<g opacity="${o}"><circle cx="${x}" cy="30" r="${o === 1 ? 9 : 7.5}" fill="url(#ug-skin)" stroke="#6a3e22" stroke-width=".8"/><path d="M${x - 9} 27l2-9 3 5 4-8 4 8 3-5 2 9z" fill="#ffd23f" stroke="#a07a10" stroke-width=".6"/><rect x="${x - 8}" y="26" width="16" height="3" fill="#1c3a8a"/><rect x="${x - 9}" y="39" width="18" height="18" rx="4" fill="url(#ug-orange)" stroke="#6a2a00" stroke-width=".8"/></g>`).join('') +
        `<g filter="url(#ug-soft)" fill="#fff" opacity=".7"><circle cx="8" cy="50" r="4"/><circle cx="56" cy="50" r="4"/><circle cx="12" cy="56" r="3"/><circle cx="52" cy="56" r="3"/></g>`;
    U.senzu = `<ellipse cx="32" cy="34" rx="16" ry="22" fill="#7ac84a" opacity=".35" filter="url(#ug-halo)" transform="rotate(25 32 34)"/><ellipse cx="32" cy="34" rx="14" ry="20" fill="url(#ug-bean)" stroke="#2a5a10" stroke-width="1.5" transform="rotate(25 32 34)"/>` +
        `<path d="M26 22c4 4 6 12 4 22" fill="none" stroke="#3a7a1a" stroke-width="1.6"/><ellipse cx="25" cy="25" rx="3" ry="6" fill="#e0ffc0" opacity=".6" transform="rotate(25 25 25)"/>`;

    window.UNIQUE_SVG = U;

    // Filter und Verlaeufe, einmal ins Dokument
    const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
    const rg = (id, stops, cx = .4, cy = .35) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".65">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
    const orbG = hex => rg('ug-orb-' + hex.slice(1), [[0, '#ffffff'], [.35, hex], [1, '#0a2a80', .9]], .5, .5);
    const defs = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="ug-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="ug-halo" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="ug-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1"/></filter>
<filter id="ug-fire" x="-40%" y="-40%" width="180%" height="180%"><feTurbulence type="fractalNoise" baseFrequency=".09 .05" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation=".6"/></filter>
<filter id="ug-fire2" x="-40%" y="-40%" width="180%" height="180%"><feTurbulence type="turbulence" baseFrequency=".12" numOctaves="2" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>
${orbG('#6fc8ff')}${orbG('#c77dff')}${orbG('#8fe6ff')}${orbG('#8fd8ff')}
${lg('ug-steel', [[0, '#f4f7fa'], [.45, '#b8c2cc'], [.55, '#8a95a0'], [1, '#dfe6ee']])}
${lg('ug-dark', [[0, '#3a3e46'], [.5, '#0e0f12'], [1, '#2a2e34']])}
${lg('ug-iron', [[0, '#7a828c'], [.5, '#4a5058'], [1, '#6a727c']], 1, 0)}
${lg('ug-mjol', [[0, '#eef2f5'], [.4, '#aab3bd'], [1, '#4a525c']])}
${lg('ug-leather', [[0, '#8a5a30'], [1, '#4a2c14']], 1, 0)}
${lg('ug-leatherdk', [[0, '#3a3a44'], [1, '#0e0e12']])}
${lg('ug-gold', [[0, '#fff3a0'], [.45, '#f2c230'], [1, '#9a6a05']])}
${lg('ug-red', [[0, '#ff5a5a'], [.5, '#c8141e'], [1, '#6a0008']])}
${lg('ug-blue', [[0, '#5a8aff'], [1, '#0e2a8a']])}
${lg('ug-green', [[0, '#6ade5a'], [1, '#1a6a1a']])}
${lg('ug-orange', [[0, '#ffae4a'], [1, '#c85a00']])}
${lg('ug-white', [[0, '#ffffff'], [1, '#c8ccd0']])}
${lg('ug-skin', [[0, '#ffe0c0'], [1, '#d09a70']])}
${lg('ug-straw', [[0, '#ffe98a'], [1, '#d8a830']])}
${lg('ug-shades', [[0, '#ffb060'], [1, '#e04a00']])}
${lg('ug-pink', [[0, '#ffd0e4'], [1, '#e080b0']])}
${lg('ug-titan', [[0, '#e0a888'], [1, '#8a5030']])}
${lg('ug-bone', [[0, '#ffffff'], [1, '#d0d0c4']])}
${lg('ug-book', [[0, '#26262e'], [1, '#08080a']], 1, 1)}
${lg('ug-blood', [[0, '#ff5060'], [1, '#6a0008']])}
${lg('ug-kagune', [[0, '#ff4050'], [.5, '#b00818'], [1, '#5a0008']])}
${lg('ug-void', [[0, '#1a0028'], [.5, '#8a3ae0'], [1, '#1a0028']], 1, 0)}
${lg('ug-beam', [[0, '#ffffff'], [.25, '#aef0ff'], [1, '#1e8cff']], 1, 0)}
${lg('ug-susa', [[0, '#d8a8ff'], [1, '#6a20c0']])}
${lg('ug-redfire', [[0, '#ffe080'], [.4, '#ff5010'], [1, '#c01008']])}
${lg('ug-blackfire', [[0, '#b060ff'], [.18, '#3a1060'], [.5, '#0a0510'], [1, '#000']])}
${rg('ug-sharingan', [[0, '#ff4040'], [1, '#8a0008']])}
${rg('ug-geass', [[0, '#ff6080'], [1, '#8a0020']])}
${rg('ug-portal', [[0, '#f0ffe0'], [.4, '#8cff5a'], [1, '#1a9a00']], .5, .5)}
${rg('ug-voidbg', [[0, '#3a2a9a'], [.6, '#0e0830'], [1, '#000']], .5, .5)}
${rg('ug-gojoeye', [[0, '#bfe8ff'], [1, '#1a7ae0']], .5, .5)}
${rg('ug-rinne', [[0, '#f0e8ff'], [1, '#a890d8']], .5, .5)}
${rg('ug-ruby', [[0, '#ffc0c0'], [.5, '#e01020'], [1, '#500008']])}
${rg('ug-fruit', [[0, '#e0a0ff'], [.6, '#9a3ad0'], [1, '#4a1070']])}
${rg('ug-bean', [[0, '#c8f090'], [1, '#4a9a2a']])}
</defs></svg>`;
    const add = () => document.body.insertAdjacentHTML('afterbegin', defs);
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
