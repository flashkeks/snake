// Unique-Items im Original-Look (25.09.2026, Max: „Bei den Unique Items gerne Design so,
// wie sie tatsaechlich aussehen"). Handgezeichnete Farb-SVGs, viewBox 0 0 64 64.
// itemIcon (index.html) nimmt diese vor den einfarbigen game-icons.
// Gradient-IDs sind je Icon eindeutig (u-KEY-…), gleiche Icons teilen sich dieselbe Definition.
const UNIQUE_SVG = {
    // ---------- Waffen ----------
    rasengan: `<defs><radialGradient id="u-ras" cx=".42" cy=".4"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#9fdcff"/><stop offset=".8" stop-color="#2a7cf0"/><stop offset="1" stop-color="#1848b0"/></radialGradient></defs>
        <circle cx="32" cy="32" r="22" fill="#2a7cf0" opacity=".25"/><circle cx="32" cy="32" r="18" fill="url(#u-ras)"/>
        <g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"><path d="M18 30c4-10 22-12 27-2"/><path d="M46 36c-5 9-22 11-27 1"/><path d="M24 22c9-3 17 1 19 8"/><path d="M40 43c-9 3-17-1-19-8"/></g>
        <circle cx="32" cy="32" r="5" fill="#fff"/>`,
    getsuga: `<g transform="rotate(-40 32 32)"><rect x="27" y="4" width="11" height="40" rx="2" fill="#111" stroke="#8a9098" stroke-width="1.2"/><path d="M38 4v40" stroke="#cfd6de" stroke-width="2"/><rect x="26" y="44" width="13" height="3" fill="#333"/><rect x="29.5" y="47" width="6" height="12" fill="#eee"/><path d="M29.5 49l6 2M29.5 53l6 2M29.5 57l6 2" stroke="#999" stroke-width="1"/><path d="M32.5 59c-4 3-8 1-9-2" fill="none" stroke="#bbb" stroke-width="1.5"/></g>
        <path d="M8 44c10-3 20 0 28-8" fill="none" stroke="#6ad0ff" stroke-width="2" opacity=".7"/>`,
    amaterasu: `<path d="M32 60c-12 0-19-8-18-18 1-8 7-11 6-19 6 4 7 9 7 13 2-7 6-14 5-24 9 6 13 16 12 24 2-3 3-6 2-9 6 6 8 12 7 17 0 9-8 16-21 16z" fill="#0b0b0d" stroke="#4a1a6a" stroke-width="1.5"/>
        <circle cx="32" cy="44" r="9" fill="#c8101c"/><circle cx="32" cy="44" r="2.6" fill="#000"/><circle cx="32" cy="44" r="5.6" fill="none" stroke="#000" stroke-width=".8"/>
        <g fill="#000"><circle cx="32" cy="38.4" r="1.6"/><circle cx="36.9" cy="46.8" r="1.6"/><circle cx="27.1" cy="46.8" r="1.6"/></g>`,
    spiritgun: `<defs><radialGradient id="u-spg"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#8fe6ff"/><stop offset="1" stop-color="#20a0ff" stop-opacity="0"/></radialGradient></defs>
        <circle cx="50" cy="16" r="13" fill="url(#u-spg)"/><circle cx="50" cy="16" r="4.5" fill="#fff"/>
        <path d="M10 50l14-10 8-1 12-18c2-3 6-1 4 2l-9 15 6 1c2 0 3 3 1 4l-10 5-2 6H18z" fill="#f1c7a0" stroke="#8a5a3a" stroke-width="1.5"/>
        <path d="M10 50l8 9" stroke="#1d3a8a" stroke-width="7"/>`,
    gob: `<defs><radialGradient id="u-gob"><stop offset="0" stop-color="#fff6c0"/><stop offset=".6" stop-color="#f2c230"/><stop offset="1" stop-color="#b37a00" stop-opacity="0"/></radialGradient></defs>
        <circle cx="32" cy="32" r="28" fill="url(#u-gob)"/><g fill="none" stroke="#ffe27a" stroke-width="1.5"><circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="13"/></g>
        <g><path d="M32 30L10 8l3-1 22 21z" fill="#dfe6ee" stroke="#6a5010"/><path d="M34 32L56 10l1 3-21 21z" fill="#dfe6ee" stroke="#6a5010"/><path d="M32 34L32 60h-3V34z" fill="#dfe6ee" stroke="#6a5010"/></g>
        <circle cx="32" cy="32" r="5" fill="#ffe27a" stroke="#b37a00"/>`,
    kamehameha: `<defs><linearGradient id="u-kam" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#9fe8ff"/><stop offset="1" stop-color="#1e8cff" stop-opacity=".2"/></linearGradient></defs>
        <path d="M24 22L62 12v40L24 42z" fill="url(#u-kam)"/><circle cx="24" cy="32" r="11" fill="#dff8ff"/><circle cx="24" cy="32" r="6" fill="#fff"/>
        <path d="M4 22c6-2 12 0 14 6l-2 4 2 4c-2 6-8 8-14 6z" fill="#f1c7a0" stroke="#8a5a3a" stroke-width="1.5"/><path d="M2 20h7v26H2z" fill="#f06a1a"/>`,
    dragonslayer: `<g transform="rotate(-38 32 32)"><rect x="24" y="2" width="16" height="44" rx="1" fill="#4b4f55"/><path d="M24 2h16v6H24z" fill="#5b6067"/><path d="M26 10l12 8M27 26l9 6" stroke="#6b3a20" stroke-width="2" opacity=".7"/><path d="M40 2v44" stroke="#8a9098" stroke-width="1.5"/>
        <rect x="21" y="46" width="22" height="3" fill="#2a2c30"/><rect x="29" y="49" width="6" height="13" fill="#3a2414"/><path d="M29 52h6M29 56h6M29 60h6" stroke="#5a3a20"/></g>`,
    venuzdonoa: `<defs><linearGradient id="u-ven" x1="0" x2="1"><stop offset="0" stop-color="#2a0a3a"/><stop offset=".5" stop-color="#7a2ac0"/><stop offset="1" stop-color="#2a0a3a"/></linearGradient></defs>
        <g transform="rotate(-40 32 32)"><path d="M32 2l7 10v34h-14V12z" fill="url(#u-ven)" stroke="#c070ff" stroke-width="1.2"/><path d="M20 46h24l-4 4H24z" fill="#1a1a1a" stroke="#c070ff"/><rect x="29" y="50" width="6" height="11" fill="#2a1a2a"/><circle cx="32" cy="62" r="2.5" fill="#c070ff"/>
        <ellipse cx="32" cy="24" rx="3.5" ry="2" fill="#ff3050"/><circle cx="32" cy="24" r="1" fill="#000"/></g>`,
    hollowpurple: `<defs><radialGradient id="u-hp" cx=".45" cy=".42"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#e2a8ff"/><stop offset=".8" stop-color="#8a20e0"/><stop offset="1" stop-color="#3a0a70"/></radialGradient></defs>
        <circle cx="32" cy="32" r="26" fill="#8a20e0" opacity=".25"/><circle cx="32" cy="32" r="19" fill="url(#u-hp)"/>
        <path d="M14 30c6-8 14-8 18-2" fill="none" stroke="#ff4a4a" stroke-width="3" stroke-linecap="round"/><path d="M50 34c-6 8-14 8-18 2" fill="none" stroke="#4aa0ff" stroke-width="3" stroke-linecap="round"/>`,
    nichirin: `<g transform="rotate(-42 32 32)"><path d="M30 2c3 6 4 18 4 40h-5c0-20 0-32 1-40z" fill="#15161a" stroke="#7a848e" stroke-width="1"/><path d="M33.6 8c.4 10 .4 22 .4 34" stroke="#b8c2cc" stroke-width="1.2"/>
        <circle cx="31.5" cy="43.5" r="5" fill="#111" stroke="#4a4a4a"/><rect x="29.5" y="46" width="4" height="15" fill="#1a1a1a"/><path d="M29.5 48l4 2.5M29.5 52l4 2.5M29.5 56l4 2.5" stroke="#2a8a5a" stroke-width="1.4"/></g>`,
    cutlasses: `<g><g transform="rotate(-28 32 32)"><rect x="8" y="22" width="34" height="8" rx="1.5" fill="#cfd6de" stroke="#5a6068"/><rect x="36" y="22" width="8" height="3" fill="#8a9098"/><path d="M14 30h9l-3 16h-8z" fill="#2a2a2e"/><path d="M22 30h4l-1 4h-3z" fill="#5a6068"/><text x="14" y="28.5" font-size="4" font-family="serif" fill="#6a4a10">SWORD</text></g>
        <g transform="rotate(28 32 32) translate(-4 10)"><rect x="22" y="22" width="34" height="8" rx="1.5" fill="#cfd6de" stroke="#5a6068"/><path d="M41 30h9l1 16h-8z" fill="#2a2a2e"/></g></g>`,
    kagune: `<g fill="none" stroke-linecap="round"><path d="M14 58C10 40 20 28 12 8" stroke="#8a0a14" stroke-width="7"/><path d="M26 60C24 40 30 26 26 6" stroke="#b01020" stroke-width="7"/><path d="M38 60c2-20 10-32 8-54" stroke="#b01020" stroke-width="7"/><path d="M50 58c4-18 12-26 8-46" stroke="#8a0a14" stroke-width="7"/></g>
        <g stroke="#1a0004" stroke-width="1.5" fill="none"><path d="M10 44h8M14 28h8M22 46h8M24 26h8M36 44h8M40 24h8M48 42h8M52 26h8"/></g>`,
    longinus: `<g transform="rotate(-38 32 32)"><path d="M31 18v44h3V18z" fill="#a0101a"/><path d="M29 18c-1 8 1 16 3 44M36 18c1 8-1 16-3 44" fill="none" stroke="#e02030" stroke-width="2"/>
        <path d="M24 2c2 8 6 12 8 16 2-4 6-8 8-16-3 6-6 8-8 8s-5-2-8-8z" fill="#d01424" stroke="#600008"/></g>`,
    gomu: `<path d="M4 44h14v12H4z" fill="#d6242c"/><path d="M18 46c10-2 16 0 26-4" fill="none" stroke="#f1c7a0" stroke-width="8" stroke-linecap="round"/>
        <path d="M16 46c8 0 10-6 18-4" fill="none" stroke="#d8a882" stroke-width="1" opacity=".7"/>
        <g transform="translate(42 26)"><rect x="0" y="4" width="20" height="18" rx="6" fill="#f1c7a0" stroke="#8a5a3a" stroke-width="1.5"/><path d="M5 5v8M10 4v9M15 5v8" stroke="#8a5a3a" stroke-width="1.2"/></g>
        <path d="M40 18l4-6M50 16l2-8M58 20l4-4" stroke="#ffd23f" stroke-width="2"/>`,
    chainsaw: `<rect x="4" y="24" width="24" height="18" rx="4" fill="#f07a10" stroke="#8a3a00" stroke-width="1.5"/><path d="M8 20h12v4H8z" fill="#333"/><rect x="26" y="27" width="34" height="12" rx="6" fill="#b8c0c8" stroke="#555"/>
        <path d="M28 27l3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3M28 39l3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3" fill="none" stroke="#333" stroke-width="1.5"/><circle cx="14" cy="33" r="3" fill="#333"/>`,
    mjolnir: `<defs><linearGradient id="u-mj" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e6ea"/><stop offset=".5" stop-color="#9aa3ad"/><stop offset="1" stop-color="#5a626c"/></linearGradient></defs>
        <g transform="rotate(-30 32 32)"><rect x="12" y="6" width="40" height="22" rx="2" fill="url(#u-mj)" stroke="#3a4048" stroke-width="1.5"/><path d="M12 12h40M12 22h40" stroke="#6a727c" stroke-width="1"/>
        <path d="M26 14l3 3 3-3 3 3 3-3" fill="none" stroke="#4a5058" stroke-width="1.2"/><rect x="28.5" y="28" width="7" height="24" fill="#6b4424"/><path d="M28.5 31l7 3M28.5 36l7 3M28.5 41l7 3M28.5 46l7 3" stroke="#3a2414" stroke-width="1.2"/>
        <rect x="27.5" y="52" width="9" height="4" rx="1" fill="#8a929c"/><path d="M32 56c-5 3-5 7 0 7s5-4 0-7" fill="none" stroke="#6b4424" stroke-width="2"/></g>
        <path d="M54 6l-4 8h4l-4 8" fill="none" stroke="#9fe8ff" stroke-width="1.8"/>`,
    killerqueen: `<path d="M16 16l6 10M48 16l-6 10" stroke="#e98ab8" stroke-width="6" stroke-linecap="round"/><ellipse cx="32" cy="34" rx="17" ry="18" fill="#f2a6c8" stroke="#8a3a60" stroke-width="1.5"/>
        <path d="M18 30h28" stroke="#fff" stroke-width="2.5"/><circle cx="25" cy="31" r="3.2" fill="#fff"/><circle cx="39" cy="31" r="3.2" fill="#fff"/><circle cx="25" cy="31" r="1.4" fill="#5a1a3a"/><circle cx="39" cy="31" r="1.4" fill="#5a1a3a"/>
        <path d="M26 42h12" stroke="#8a3a60" stroke-width="1.5"/><g transform="translate(32 54)"><circle r="6" fill="#fff" stroke="#8a3a60"/><circle cx="-2" cy="-1" r="1.3"/><circle cx="2" cy="-1" r="1.3"/><path d="M-2 3h4" stroke="#000"/></g>`,
    portalgun: `<defs><radialGradient id="u-pg"><stop offset="0" stop-color="#eaffd0"/><stop offset=".5" stop-color="#6cff4a"/><stop offset="1" stop-color="#1cb000" stop-opacity="0"/></radialGradient></defs>
        <rect x="8" y="26" width="36" height="16" rx="6" fill="#e9ecef" stroke="#6a7078" stroke-width="1.5"/><rect x="14" y="16" width="22" height="10" rx="5" fill="#9cff7a" stroke="#3a8a2a" stroke-width="1.5"/>
        <path d="M18 21h14" stroke="#e8ffd8" stroke-width="2"/><path d="M14 42h10l-2 14h-8z" fill="#c6ccd2" stroke="#6a7078"/><circle cx="52" cy="34" r="12" fill="url(#u-pg)"/><rect x="42" y="28" width="6" height="12" rx="2" fill="#5a6068"/><circle cx="20" cy="34" r="2.5" fill="#d23c3c"/>`,
    senbon: `<g transform="rotate(-42 32 32)"><path d="M31 6c2 6 3 18 3 32h-4c0-14 0-26 1-32z" fill="#dfe6ee" opacity=".8"/><rect x="28" y="38" width="8" height="3" fill="#6a4a10"/><rect x="30" y="41" width="4" height="18" fill="#2a1a2a"/></g>
        <g fill="#ff9ec8" stroke="#d05088" stroke-width=".6"><path d="M40 8c3-1 4 2 2 3 2 1 1 4-1 3-1 2-4 1-3-1-2 0-2-3 0-3-1-2 1-3 2-2z"/><path d="M50 18c2 0 3 2 1 3 1 1 0 3-1 2-1 1-3 0-2-1-1-1 0-3 1-2 0-2 1-2 1-2z"/><path d="M46 28c2-1 3 1 2 2 1 1 0 3-1 2-1 1-3 0-2-1-1-1 0-2 1-2 0-1 0-1 0-1z"/><path d="M56 30c2 0 2 2 1 2 1 1 0 2-1 2 0 1-2 0-2-1-1 0 0-2 1-2 0-1 1-1 1-1z"/><path d="M36 16c2 0 2 2 1 2 1 1 0 2-1 2 0 1-2 0-2-1-1 0 0-2 1-2z"/></g>`,
    // ---------- Ruestung ----------
    scouter: `<path d="M44 14c8 4 10 14 6 22" fill="none" stroke="#c9ced4" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="30" r="7" fill="#d6dbe0" stroke="#6a7078" stroke-width="1.5"/>
        <path d="M8 18h30l4 16-8 10H12z" fill="#38e070" fill-opacity=".75" stroke="#1a8a3a" stroke-width="2"/><path d="M12 22h20" stroke="#caffd8" stroke-width="1.5"/><text x="14" y="36" font-size="7" font-family="monospace" fill="#0a4a1a">9000</text>`,
    strawhat: `<ellipse cx="32" cy="38" rx="28" ry="12" fill="#f2cf5a" stroke="#9a7420" stroke-width="1.5"/><path d="M16 36c0-14 7-22 16-22s16 8 16 22z" fill="#f5d86a" stroke="#9a7420" stroke-width="1.5"/>
        <path d="M16.5 32c10 4 21 4 31 0v5c-10 4-21 4-31 0z" fill="#d6242c"/><g stroke="#c9a53a" stroke-width=".8" opacity=".8"><path d="M8 38c8 4 40 4 48 0M22 20c6-3 14-3 20 0M18 26c8-3 20-3 28 0"/></g>`,
    odm: `<rect x="6" y="18" width="10" height="30" rx="4" fill="#9aa3ad" stroke="#4a5058" stroke-width="1.5"/><rect x="48" y="18" width="10" height="30" rx="4" fill="#9aa3ad" stroke="#4a5058" stroke-width="1.5"/>
        <rect x="16" y="28" width="32" height="8" rx="2" fill="#5a3a20"/><circle cx="32" cy="32" r="7" fill="#c9ced4" stroke="#4a5058" stroke-width="1.5"/><circle cx="32" cy="32" r="2.5" fill="#4a5058"/>
        <path d="M11 18V8M53 18V8" stroke="#dfe6ee" stroke-width="3"/><path d="M11 8l-4-4M53 8l4-4" stroke="#8a9098" stroke-width="2"/><path d="M4 56l10-6M60 56l-10-6" stroke="#6a7078" stroke-width="2"/>`,
    hokage: `<path d="M16 8h32l8 50H8z" fill="#f4f4f0" stroke="#9a9a90" stroke-width="1.5"/><path d="M22 8l10 12 10-12" fill="none" stroke="#c9c9c0" stroke-width="2"/>
        <path d="M8 58l3-14c2 4 4 4 6 0 2 5 4 5 6 0 2 5 4 5 6 0 2 5 4 5 6 0 2 5 4 5 6 0 2 4 4 4 6 0l3 14z" fill="#e0301a"/><path d="M32 26c4 4 5 8 2 12 3-1 4-3 4-5 2 3 2 8-2 11s-11 2-12-4c-1-4 2-6 3-9 1 3 2 4 3 4-1-4 0-7 2-9z" fill="#e0301a"/>`,
    kamina: `<path d="M4 24l24 4 4 6 4-6 24-4-6 18-18-6h-8L10 42z" fill="#ff7a1a" stroke="#8a3000" stroke-width="1.5"/><path d="M8 27l16 3-2 7-9 3zM56 27l-16 3 2 7 9 3z" fill="#ffb060" opacity=".6"/>
        <path d="M4 24L0 16M60 24l4-8" stroke="#8a3000" stroke-width="2"/>`,
    saitama: `<path d="M14 8h36l10 50H4z" fill="#f4f4f0" stroke="#9a9a90" stroke-width="1.5"/><path d="M20 8c4 6 20 6 24 0" fill="#ffd23f"/><circle cx="18" cy="12" r="3" fill="#c9c9c0"/><circle cx="46" cy="12" r="3" fill="#c9c9c0"/>
        <g transform="translate(22 30)"><rect width="20" height="18" rx="6" fill="#d6242c" stroke="#7a0a10" stroke-width="1.5"/><path d="M5 1v8M10 0v9M15 1v8" stroke="#7a0a10" stroke-width="1.2"/></g>`,
    ironman: `<path d="M12 22C12 8 22 4 32 4s20 4 20 18v18c0 10-8 20-20 20S12 50 12 40z" fill="#c8141e" stroke="#5a0008" stroke-width="1.5"/>
        <path d="M18 22h28v16c0 8-6 14-14 14s-14-6-14-14z" fill="#f2c230" stroke="#8a6a00" stroke-width="1.2"/><path d="M21 28h9l-1 4h-8zM43 28h-9l1 4h8z" fill="#dffaff"/><path d="M26 44h12" stroke="#8a6a00" stroke-width="1.5"/>
        <path d="M21 28h9M34 28h9" stroke="#fff" stroke-width=".8"/>`,
    susanoo: `<defs><radialGradient id="u-sus"><stop offset="0" stop-color="#e2b0ff"/><stop offset="1" stop-color="#6a20c0" stop-opacity=".2"/></radialGradient></defs>
        <circle cx="32" cy="34" r="28" fill="url(#u-sus)"/><path d="M14 30C14 16 22 10 32 10s18 6 18 20v10l-6 14H20l-6-14z" fill="#9a4ae8" fill-opacity=".85" stroke="#e8c8ff" stroke-width="1.5"/>
        <path d="M14 22l-8-14 14 8M50 22l8-14-14 8" fill="#9a4ae8" stroke="#e8c8ff"/><path d="M22 30h8M34 30h8" stroke="#fff" stroke-width="3"/><path d="M20 42h24M22 48h20" stroke="#e8c8ff" stroke-width="1.5"/>`,
    byakugan: `<path d="M4 32c8-12 18-16 28-16s20 4 28 16c-8 12-18 16-28 16S12 44 4 32z" fill="#f4f0ff" stroke="#8a86a0" stroke-width="1.5"/><circle cx="32" cy="32" r="11" fill="#e6e0f4" stroke="#b8b0d0"/>
        <g stroke="#6a5a8a" stroke-width="1.2" fill="none"><path d="M4 32c-2-6-2-10 0-14M60 32c2-6 2-10 0-14M10 22c-3-4-4-8-4-12M54 22c3-4 4-8 4-12M20 16c-1-4 0-8 2-10M44 16c1-4 0-8-2-10"/></g>`,
    kaneki: `<path d="M10 20C10 10 20 6 32 6s22 4 22 14v14c0 14-10 24-22 24S10 48 10 34z" fill="#18181c" stroke="#555" stroke-width="1.5"/>
        <path d="M18 26c3-3 9-3 12 0l-2 5h-8z" fill="#18181c" stroke="#777"/><circle cx="41" cy="28" r="5" fill="#fff"/><circle cx="41" cy="28" r="3" fill="#c8101c"/><circle cx="41" cy="28" r="1.2" fill="#000"/>
        <path d="M18 42h28" stroke="#ddd" stroke-width="3"/><path d="M20 39v6M24 39v6M28 39v6M32 39v6M36 39v6M40 39v6M44 39v6" stroke="#ddd" stroke-width="1.5"/><path d="M12 20l6-8" stroke="#666" stroke-width="2"/>`,
    rocklee: `<path d="M8 8h16v32H8zM40 8h16v32H40z" fill="#3a9a3a" stroke="#1a5a1a" stroke-width="1.5"/><path d="M6 36h20v10H6zM38 36h20v10H38z" fill="#ff8a1a" stroke="#8a4000" stroke-width="1.5"/>
        <g fill="#c9a26b" stroke="#6a4a20" stroke-width="1.2"><rect x="7" y="46" width="18" height="10" rx="2"/><rect x="39" y="46" width="18" height="10" rx="2"/></g><text x="16" y="54" font-size="6" text-anchor="middle" fill="#3a2410" font-weight="700">500</text><text x="48" y="54" font-size="6" text-anchor="middle" fill="#3a2410" font-weight="700">500</text>`,
    geppo: `<path d="M18 20c4-8 14-8 16 0l2 18c8 2 14 6 14 12H14c-2-10 2-20 4-30z" fill="#1a1a2a" stroke="#5a5a70" stroke-width="1.5"/>
        <g fill="none" stroke="#dff4ff" stroke-width="2.5" stroke-linecap="round" opacity=".9"><ellipse cx="32" cy="56" rx="20" ry="4"/><ellipse cx="32" cy="61" rx="12" ry="2.5"/></g><path d="M8 44c-4-2-4-6 0-8M56 44c4-2 4-6 0-8" stroke="#dff4ff" stroke-width="2" fill="none"/>`,
    allmight: `<path d="M20 10l-8-6 4 14zM44 10l8-6-4 14z" fill="#ffd23f" stroke="#8a6a00"/><path d="M12 22c0-8 8-12 20-12s20 4 20 12v24c0 8-8 14-20 14s-20-6-20-14z" fill="#1c4ac8" stroke="#0a2060" stroke-width="1.5"/>
        <path d="M12 26l20 10 20-10v8L32 44 12 34z" fill="#f4f4f0"/><path d="M12 34l20 10 20-10v4L32 48 12 38z" fill="#d6242c"/><path d="M26 16h12l-6 8z" fill="#ffd23f"/>`,
    killua: `<path d="M36 2L14 34h14L20 62l30-38H34L44 2z" fill="#bfe8ff" stroke="#2a8aff" stroke-width="2"/><path d="M36 6L20 30h12L26 52" fill="none" stroke="#fff" stroke-width="2"/>
        <g stroke="#6ad0ff" stroke-width="1.5"><path d="M6 20l6 4M54 42l6 4M8 48l6-2"/></g>`,
    geass: `<path d="M4 32c8-12 18-16 28-16s20 4 28 16c-8 12-18 16-28 16S12 44 4 32z" fill="#2a0a1a" stroke="#6a2a4a" stroke-width="1.5"/><circle cx="32" cy="32" r="12" fill="#c8101c"/>
        <path d="M32 24c-6 2-10 6-12 10 4-2 8-2 10 0l2 6 2-6c2-2 6-2 10 0-2-4-6-8-12-10z" fill="#ff8ab0" stroke="#fff" stroke-width=".8"/>`,
    flashstep: `<g><path d="M44 12a6 6 0 1 1 0 .1zM38 20h12l4 20-4 16h-4l-2-14-4 14h-4l2-18z" fill="#111" /><path d="M40 22l6 8" stroke="#fff" stroke-width="2"/>
        <path d="M28 12a6 6 0 1 1 0 .1zM22 20h12l4 20-4 16h-4l-2-14-4 14h-4l2-18z" fill="#111" opacity=".45"/><path d="M12 12a6 6 0 1 1 0 .1zM6 20h12l4 20-4 16h-4l-2-14-4 14H4l2-18z" fill="#111" opacity=".2"/></g>`,
    kyoka: `<defs><linearGradient id="u-kyo" x1="0" x2="1"><stop offset="0" stop-color="#dfe6ee"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#c8a8ff"/></linearGradient></defs>
        <g transform="rotate(-42 32 32)"><path d="M30.5 2c2.5 6 3.5 18 3.5 38h-4.5c0-20 0-32 1-38z" fill="url(#u-kyo)" stroke="#8a7aa8" stroke-width=".8"/><ellipse cx="32" cy="41.5" rx="7" ry="3" fill="#6a4aa8" stroke="#e0d0ff"/><rect x="30" y="44" width="4.5" height="16" fill="#e8e0f8"/><path d="M30 47l4.5 2.5M30 51l4.5 2.5M30 55l4.5 2.5" stroke="#6a4aa8" stroke-width="1.2"/></g>
        <g fill="#e0d0ff" opacity=".8"><circle cx="48" cy="14" r="2"/><circle cx="54" cy="22" r="1.5"/><circle cx="44" cy="8" r="1.2"/></g>`,
    titan: `<path d="M12 20c0-12 8-18 20-18s20 6 20 18v10c0 14-8 28-20 28S12 44 12 30z" fill="#c98a6a" stroke="#6a3a20" stroke-width="1.5"/><path d="M12 22c2-12 10-16 20-16s18 4 20 16c-4-6-10-6-20-6s-16 0-20 6z" fill="#2a1a10"/>
        <path d="M22 30h8M34 30h8" stroke="#4a2a18" stroke-width="3"/><circle cx="26" cy="33" r="2.5" fill="#3aff9a"/><circle cx="38" cy="33" r="2.5" fill="#3aff9a"/>
        <path d="M16 44l6-4v14M48 44l-6-4v14" stroke="#9a2a20" stroke-width="2"/><path d="M22 48h20" stroke="#fff" stroke-width="3"/><path d="M24 46v5M28 46v5M32 46v5M36 46v5M40 46v5" stroke="#9a5a40"/>`,
    // ---------- Verbrauchsgut ----------
    hiraishin: `<g transform="rotate(-35 32 32)"><path d="M32 2l4 20h-8z" fill="#cfd6de" stroke="#5a6068"/><path d="M28 18L18 8l6 14zM36 18l10-10-6 14z" fill="#cfd6de" stroke="#5a6068"/><rect x="29.5" y="22" width="5" height="22" fill="#2a2a2e"/><path d="M29.5 25l5 2M29.5 30l5 2M29.5 35l5 2M29.5 40l5 2" stroke="#6a6a70"/><circle cx="32" cy="48" r="4" fill="none" stroke="#5a6068" stroke-width="2"/></g>
        <rect x="40" y="36" width="10" height="22" fill="#f4ecd0" stroke="#8a7a5a" transform="rotate(12 45 47)"/><text x="45" y="50" font-size="7" text-anchor="middle" fill="#1a1a1a" transform="rotate(12 45 47)">式</text>`,
    chainjail: `<g fill="none" stroke="#e8c030" stroke-width="3.5"><ellipse cx="10" cy="14" rx="5" ry="3.5" transform="rotate(35 10 14)"/><ellipse cx="18" cy="21" rx="5" ry="3.5" transform="rotate(35 18 21)" stroke="#c9a020"/><ellipse cx="26" cy="28" rx="5" ry="3.5" transform="rotate(35 26 28)"/><ellipse cx="34" cy="35" rx="5" ry="3.5" transform="rotate(35 34 35)" stroke="#c9a020"/></g>
        <path d="M38 38l14 14-4 4-6-6-2 8-4-4 2-8-6-2z" fill="#e8c030" stroke="#8a6a00"/><path d="M50 44c6-2 10 2 8 8" fill="none" stroke="#e8c030" stroke-width="3"/>`,
    hollowmask: `<path d="M10 22C10 10 20 4 32 4s22 6 22 18v10c0 14-10 26-22 26S10 46 10 32z" fill="#f4f4f0" stroke="#8a8a80" stroke-width="1.5"/>
        <path d="M12 12l6 28M16 8l8 34" stroke="#c8101c" stroke-width="3"/><path d="M18 26c3-3 9-3 12 1l-3 4h-7zM46 26c-3-3-9-3-12 1l3 4h7z" fill="#000"/><circle cx="24" cy="28" r="1.5" fill="#ffd23f"/><circle cx="40" cy="28" r="1.5" fill="#ffd23f"/>
        <path d="M20 44h24" stroke="#222" stroke-width="2"/><path d="M22 41v6M26 41v6M30 41v6M34 41v6M38 41v6M42 41v6" stroke="#222" stroke-width="1.5"/>`,
    deathnote: `<rect x="12" y="6" width="40" height="52" rx="2" fill="#0d0d10" stroke="#3a3a44" stroke-width="1.5"/><rect x="12" y="6" width="5" height="52" fill="#1d1d24"/>
        <text x="34" y="28" font-size="9" text-anchor="middle" fill="#f4f4f0" font-family="serif" font-style="italic" font-weight="700">DEATH</text><text x="34" y="40" font-size="9" text-anchor="middle" fill="#f4f4f0" font-family="serif" font-style="italic" font-weight="700">NOTE</text>`,
    philosopher: `<defs><radialGradient id="u-phi" cx=".4" cy=".35"><stop offset="0" stop-color="#ffb0b0"/><stop offset=".5" stop-color="#e01020"/><stop offset="1" stop-color="#600008"/></radialGradient></defs>
        <circle cx="32" cy="32" r="28" fill="none" stroke="#d05050" stroke-width="1.2" opacity=".7"/><path d="M32 6l22 38H10z" fill="none" stroke="#d05050" stroke-width="1" opacity=".6"/>
        <path d="M32 14l14 12-4 20H22l-4-20z" fill="url(#u-phi)" stroke="#ff8080" stroke-width="1"/><path d="M32 14l-4 12h8zM18 26h28M28 26l-6 20M36 26l6 20" fill="none" stroke="#ff9a9a" stroke-width=".8" opacity=".7"/>`,
    doordoor: `<circle cx="32" cy="36" r="22" fill="#9a4ac8" stroke="#4a1a6a" stroke-width="1.5"/><g fill="none" stroke="#5a1a8a" stroke-width="2"><path d="M20 30c2-4 6-4 8 0s-2 6-4 4"/><path d="M36 26c2-4 6-4 8 0s-2 6-4 4"/><path d="M22 46c2-4 6-4 8 0s-2 6-4 4"/><path d="M38 44c2-4 6-4 8 0s-2 6-4 4"/></g>
        <path d="M32 14c0-6 4-10 8-10" fill="none" stroke="#3a8a2a" stroke-width="3"/><path d="M36 8c6-4 12 0 12 4-6 2-10 0-12-4z" fill="#4aaa3a"/>`,
    shinra: `<circle cx="32" cy="32" r="28" fill="#c8b8e8"/><g fill="none" stroke="#3a2a5a" stroke-width="2"><circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="12"/><circle cx="32" cy="32" r="6"/></g><circle cx="32" cy="32" r="2.5" fill="#1a1030"/>`,
    hoipoi: `<rect x="10" y="22" width="44" height="20" rx="10" fill="#f4f4f0" stroke="#8a8a90" stroke-width="1.5"/><path d="M32 22h12a10 10 0 0 1 0 20H32z" fill="#e0301a"/>
        <circle cx="46" cy="32" r="3" fill="#ffd23f" stroke="#8a6a00"/><text x="21" y="36" font-size="9" font-weight="800" fill="#1c4ac8" font-family="sans-serif">CC</text>`,
    zawarudo: `<circle cx="32" cy="36" r="22" fill="#f2c230" stroke="#8a6a00" stroke-width="2"/><circle cx="32" cy="36" r="17" fill="#fffbe8" stroke="#b38a10"/><rect x="28" y="6" width="8" height="8" rx="2" fill="#f2c230" stroke="#8a6a00"/>
        <g stroke="#3a2a10" stroke-width="1.5"><path d="M32 22v3M32 47v3M18 36h3M43 36h3"/></g><path d="M32 36V24M32 36l7 5" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M44 20l6-6M50 26h6" stroke="#ffe27a" stroke-width="2"/>`,
    bunshin: `<circle cx="32" cy="36" r="24" fill="#e8e8e8" opacity=".6"/><g><circle cx="18" cy="30" r="8" fill="#f1c7a0"/><path d="M10 26l2-8 3 5 3-7 3 7 3-5 2 8z" fill="#ffd23f"/><rect x="10" y="38" width="16" height="16" rx="4" fill="#f07a10"/>
        <circle cx="46" cy="30" r="8" fill="#f1c7a0"/><path d="M38 26l2-8 3 5 3-7 3 7 3-5 2 8z" fill="#ffd23f"/><rect x="38" y="38" width="16" height="16" rx="4" fill="#f07a10"/>
        <circle cx="32" cy="34" r="9" fill="#f1c7a0" stroke="#8a5a3a"/><path d="M23 30l2-9 3 5 4-8 4 8 3-5 2 9z" fill="#ffd23f" stroke="#b38a10"/><rect x="23" y="43" width="18" height="17" rx="4" fill="#f07a10" stroke="#8a3a00"/><rect x="24" y="30" width="16" height="3" fill="#1c3a8a"/></g>`,
    chidori: `<defs><radialGradient id="u-chi"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#9fe8ff"/><stop offset="1" stop-color="#2a8aff" stop-opacity="0"/></radialGradient></defs>
        <circle cx="32" cy="30" r="24" fill="url(#u-chi)"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M32 30l-14-10 4-2-8-6M32 30l16-8-2 6 10-2M32 30l-6 16 4-2-2 10M32 30l14 10-4 2 8 6"/></g>
        <path d="M22 50c4-6 16-6 20 0v12H22z" fill="#f1c7a0" stroke="#8a5a3a" stroke-width="1.5"/>`,
    senzu: `<ellipse cx="32" cy="34" rx="14" ry="20" fill="#7ac84a" stroke="#3a6a1a" stroke-width="2" transform="rotate(25 32 34)"/><path d="M26 22c4 4 6 12 4 22" fill="none" stroke="#4a8a2a" stroke-width="2"/><ellipse cx="26" cy="26" rx="3" ry="6" fill="#c8f0a0" opacity=".7" transform="rotate(25 26 26)"/>`,
    genkidama: `<defs><radialGradient id="u-gen" cx=".45" cy=".4"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#8fd8ff"/><stop offset="1" stop-color="#2a8aff"/></radialGradient></defs>
        <circle cx="32" cy="24" r="21" fill="#9fe8ff" opacity=".35"/><circle cx="32" cy="24" r="17" fill="url(#u-gen)"/>
        <path d="M16 56l4-14 4 2 2-6 3 18zM48 56l-4-14-4 2-2-6-3 18z" fill="#f1c7a0" stroke="#8a5a3a" stroke-width="1.5"/><path d="M14 58h36v6H14z" fill="#f07a10"/>`,
    infinitevoid: `<defs><radialGradient id="u-iv"><stop offset="0" stop-color="#3a2a8a"/><stop offset=".6" stop-color="#10082a"/><stop offset="1" stop-color="#000"/></radialGradient></defs>
        <circle cx="32" cy="32" r="28" fill="url(#u-iv)" stroke="#6aa8ff" stroke-width="1.5"/><g fill="#fff"><circle cx="16" cy="20" r="1"/><circle cx="46" cy="14" r="1.2"/><circle cx="50" cy="44" r=".9"/><circle cx="18" cy="46" r="1.1"/><circle cx="28" cy="10" r=".7"/><circle cx="54" cy="30" r=".8"/></g>
        <path d="M12 32c8-10 32-10 40 0-8 10-32 10-40 0z" fill="#f4f8ff"/><circle cx="32" cy="32" r="7" fill="#4ab0ff"/><circle cx="32" cy="32" r="3" fill="#0a1a4a"/><circle cx="30" cy="30" r="1.2" fill="#fff"/>`
};
