// Pixel-Sprites fuer alle Gegner und Raid-Bosse (25.09.2026, Max: „ich LIEBE den Pixel-Style,
// mach bitte alle Mobs so"). Ergaenzt PX aus bfx.js (Spezial-Charaktere): menschliche Gegner
// und Zombies kommen aus einem Baukasten (Kopf + Koerper + Waffe + Palette), Tiere,
// Viecher und Bosse haben eigene Raster. Blick nach rechts, zwei Bein-Frames.

(function () {
    // ---------- Baukasten ----------
    const HEAD = {
        cap: ['....HHHHH.......', '...HHHHHHH......', '...HHHHHHHHH....', '...Hssssss......', '...ssssesss.....', '...sssssss......', '....ssmss.......', '.....sss........'],
        helmet: ['....HHHHH.......', '...HHHHHHH......', '..HHHHHHHHH.....', '..HHVVVVVVH.....', '...HVVVVVV......', '...Hsssss.......', '....ssmss.......', '.....sss........'],
        hood: ['....HHHHH.......', '...HHHHHHH......', '..HHHHHHHHH.....', '..HHXXXXXX......', '..HHXeXXeX......', '..HHXXXXXX......', '...HHXXXX.......', '....HHHH........'],
        bald: ['................', '....sssss.......', '...sssssss......', '...ssssssss.....', '...sssesess.....', '...ssssssss.....', '....smmmss......', '.....ssss.......'],
        zombie: ['....H.H.H.......', '...HHHHHHH......', '...HsssssHH.....', '...ssssssss.....', '...sssessss.....', '...ssssssss.....', '....smmms.......', '.....sss........'],
        gasmask: ['....HHHHH.......', '...HHHHHHH......', '..HHHHHHHHH.....', '..HHVVssVV......', '...HVVssVV......', '...Hssggss......', '....sggggg......', '.....ggg........'],
        scream: ['...H.H.H........', '...HHHHHHH......', '...HsssssH......', '...ssssssss.....', '...sssessss.....', '...ssssmmm......', '....ssmmm.......', '.....sss........']
    };
    const TORSO = {
        normal: ['...CCCCCCC......', '..CCCCCCCWWWWWWW', '..CcCCCCCcwwwwww', '..CcCCCCCc......', '..CcBBBBBc......', '..CcCCCCCc......', '...PPPPPP.......', '...PP..PP.......'],
        fat: ['..CCCCCCCCC.....', '.CCCCCCCCCCWWWWW', '.CcCCCCCCCcwwwww', '.CcCCCCCCCCc....', '.CcCCCCCCCCc....', '..CcCCCCCCc.....', '...PPPPPPP......', '...PP...PP......']
    };
    // Waffen-Zeilen (ersetzen W/w im Oberkoerper): [Zeile 1, Zeile 2]
    const WEAPON = {
        rifle: ['AAhGGGG', '...G...'], longrifle: ['AhGGGGG', '..Gg...'], pistol: ['AAhGg..', '.......'],
        shotgun: ['AAhGGGg', '..GG...'], minigun: ['AhGGGGG', 'hgGGGGG'], launcher: ['AhGGGGg', '..GGg..'],
        fist: ['AAAh...', '.......'], claws: ['AAAAh..', 'AAAAh..'], none: ['.......', '.......'], cane: ['AAAh...', '...G...']
    };
    const LEGS = [['....PP..PP......', '....PP..PP......', '....Pp..Pp......', '...KKK..KKK.....'],
                  ['...PP....PP.....', '...PP....PP.....', '..Pp......Pp....', '..KKK.....KKK...']];
    function human(o) {
        const head = HEAD[o.head || 'cap'], torso = TORSO[o.torso || 'normal'], w = WEAPON[o.weapon || 'rifle'];
        const body = ['................', '................', ...head, ...torso.map((r, i) => {
            const wr = i === 1 ? w[0] : i === 2 ? w[1] : null;
            if (!wr) return r;
            const at = r.search(/[Ww]/);
            return at < 0 ? r : (r.slice(0, at) + wr + '................').slice(0, 16);
        })];
        if (o.shield) for (let y = 9; y < 18; y++) body[y] = (body[y].slice(0, 12) + 'QQ' + body[y].slice(14)).slice(0, 16);
        return { pal: Object.assign({ K: '#18181c', m: '#5a1a1a', e: '#111', h: o.pal && o.pal.s || '#e8c39e', Q: '#9ab8e8', g: '#6a7078', G: '#2a2e34' }, o.pal), body, legs: LEGS, k: o.k || 1, glow: o.glow };
    }
    const skin = '#e8c39e', zskin = '#8fb07a';
    const S = {
        scav: human({ head: 'hood', weapon: 'rifle', pal: { H: '#6b5a3a', X: '#1c1a14', e: '#ffd23f', C: '#7a7a5a', c: '#5a5a40', A: '#6a6a4a', s: skin, B: '#3a2a18', P: '#4a4a38', p: '#3a3a2c' } }),
        sniper: human({ head: 'hood', weapon: 'longrifle', pal: { H: '#4e6b36', X: '#141c0e', e: '#ff4040', C: '#56733a', c: '#3e5a28', A: '#4e6b36', s: skin, B: '#2a3a1a', P: '#3e5a28', p: '#2e4a1e' }, glow: { x: 15, y: 11.5, col: '255,60,60' } }),
        enforcer: human({ head: 'helmet', weapon: 'shotgun', pal: { H: '#8a2020', V: '#ffcc40', C: '#9a2a2a', c: '#6a1a1a', A: '#7a2020', s: skin, B: '#2a2a2e', P: '#3a1a1a', p: '#2a1010' } }),
        brute: human({ head: 'bald', weapon: 'fist', k: .95, pal: { s: '#c98a5a', h: '#c98a5a', C: '#b9743f', c: '#8a5028', A: '#c98a5a', B: '#3a2a18', P: '#3a3a44', p: '#2a2a32', e: '#ff3b3b' } }),
        mutant: human({ head: 'zombie', weapon: 'claws', pal: { H: '#3a4a3a', s: '#9ad07a', h: '#9ad07a', C: '#cfd8d8', c: '#9aa8a8', A: '#9ad07a', B: '#6a7a7a', P: '#6a7a7a', p: '#4a5a5a', e: '#ff3b3b', m: '#3a0a0a' } }),
        hulk: human({ head: 'bald', torso: 'fat', weapon: 'claws', k: .8, pal: { s: '#7ab05a', h: '#7ab05a', C: '#7ab05a', c: '#5a8a3a', A: '#7ab05a', B: '#cfd8d8', P: '#cfd8d8', p: '#9aa8a8', e: '#ffec4a', m: '#2a0a0a' } }),
        heavy: human({ head: 'helmet', weapon: 'minigun', pal: { H: '#556046', V: '#1a1a1a', C: '#6f7d5a', c: '#4a553a', A: '#5e6b4a', s: skin, B: '#c9a200', P: '#39432a', p: '#2a3220', g: '#8a9099' } }),
        grenadier: human({ head: 'gasmask', weapon: 'launcher', pal: { H: '#6b5030', V: '#1a1a1a', g: '#3e5a2a', C: '#8a5a38', c: '#5a3a20', A: '#7a4a28', s: skin, B: '#3e5a2a', P: '#4a2c16', p: '#3a2010' } }),
        trooper: human({ head: 'helmet', weapon: 'pistol', shield: true, pal: { H: '#2e3a52', V: '#9fc8ff', C: '#4a5a78', c: '#2e3a52', A: '#3a4a68', s: skin, B: '#15181f', P: '#232c40', p: '#161c2a', Q: '#b8d0f0' } }),
        cryo: human({ head: 'helmet', weapon: 'none', pal: { H: '#e0f4ff', V: '#2a88b8', C: '#d8f4ff', c: '#9fd0e8', A: '#b8e8ff', s: '#bfe9ff', B: '#6a8a9a', P: '#9fd0e8', p: '#7ab0c8' }, glow: { x: 6, y: 13, col: '120,230,255' } }),
        zombie: human({ head: 'zombie', weapon: 'claws', pal: { H: '#3a2a1a', s: zskin, h: zskin, C: '#5a6a8a', c: '#3a4a6a', A: zskin, B: '#3a2a1a', P: '#3a3a4a', p: '#2a2a3a', e: '#ff3b3b', m: '#3a0a0a' } }),
        runner: human({ head: 'zombie', weapon: 'claws', k: .95, pal: { H: '#1a1a1a', s: '#a0b88a', h: '#a0b88a', C: '#8a4a3a', c: '#6a3a2a', A: '#a0b88a', B: '#2a1a1a', P: '#4a3a3a', p: '#3a2a2a', e: '#ffec4a', m: '#3a0a0a' } }),
        tank: human({ head: 'bald', torso: 'fat', weapon: 'fist', k: .85, pal: { s: '#7a8a7a', h: '#7a8a7a', C: '#4a4a4a', c: '#2a2a2a', A: '#7a8a7a', B: '#2a2a2a', P: '#3a3a3a', p: '#2a2a2a', e: '#ff3b3b', m: '#1a0a0a' } }),
        spitter: human({ head: 'zombie', weapon: 'claws', pal: { H: '#2a3a1a', s: '#9ac870', h: '#9ac870', C: '#6a8a3a', c: '#4a6a2a', A: '#9ac870', B: '#3a4a1a', P: '#3a4a2a', p: '#2a3a1a', e: '#e0ff4a', m: '#6aff3a' } }),
        bloater: human({ head: 'zombie', torso: 'fat', weapon: 'claws', k: .9, pal: { H: '#3a3a1a', s: '#b0c07a', h: '#b0c07a', C: '#8aa05a', c: '#6a8040', A: '#b0c07a', B: '#5a6a3a', P: '#5a6a3a', p: '#4a5a2a', e: '#ff3b3b', m: '#6aff3a' } }),
        riot: human({ head: 'helmet', weapon: 'claws', shield: true, pal: { H: '#1a1a22', V: '#6a7078', s: zskin, h: zskin, C: '#2a2a34', c: '#1a1a22', A: '#2a2a34', B: '#3a3a44', P: '#22222c', p: '#18181e', Q: '#8a98a8' } }),
        acid: human({ head: 'gasmask', weapon: 'claws', pal: { H: '#c8b020', V: '#1a1a1a', g: '#4a4a4a', s: zskin, h: zskin, C: '#d8c030', c: '#a89020', A: '#d8c030', B: '#4a4a4a', P: '#a89020', p: '#887010' }, glow: { x: 7, y: 8, col: '150,255,60' } }),
        screamer: human({ head: 'scream', weapon: 'claws', pal: { H: '#e8e8e8', s: '#c0c8b0', h: '#c0c8b0', C: '#6a3a6a', c: '#4a2a4a', A: '#c0c8b0', B: '#3a1a3a', P: '#3a2a3a', p: '#2a1a2a', e: '#ff3b3b', m: '#1a0000' } })
    };
    // ---------- eigene Raster ----------
    const drone = {
        pal: { D: '#3a4048', d: '#252a30', L: '#9aa3ad', R: '#ff3b3b', P: '#c9ced4', G: '#1a1a1a' },
        body: ['................', '................', '................', '................', '................', '................', '................', '................',
            'PPPP........PPPP', '..L..........L..', '..LDDDDDDDDDDL..', '..DDddddddddDD..', '...DDdRRdddDD...', '....DDDDDDDD....', '.....G....G.....', '.....G....G.....', '................', '................'],
        legs: [['................', '................', '................', '................'], ['................', '................', '................', '................']],
        fly: true, k: 1.1, glow: { x: 7.5, y: 12, col: '255,60,60' }
    };
    const dog = {
        pal: { B: '#8b6b4a', b: '#5a4028', D: '#3a2616', k: '#111', w: '#fff', R: '#c0302a', y: '#ffcc33' },
        body: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................',
            '...........DD...', '..........BBBD..', 'b........BBykBB.', '.bBBBBBBBBBBBBBk', '..BBBBBBBBRBB...', '..bBBBBBBBBB....', '..bbBBBBBBbb....', '...b.......b....'],
        legs: [['..BB..BB.BB.....', '..BB..BB.BB.....', '..DD..DD.DD.....', '................'], ['.BB..BB...BB....', '.BB...BB..BB....', '.DD...DD..DD....', '................']],
        k: 1.25
    };
    const frog = {
        pal: { G: '#9bd66a', g: '#5a8a30', A: '#c8ff5a', a: '#e8ffb0', k: '#2a1a0c', y: '#fff94a' },
        body: ['................', '................', '................', '................', '................', '................', '................', '................', '................',
            '........GGGG....', '......GGyGGyG...', '...GGGGGGGGGGG..', '..AAGGGGGGGkkG..', '.AaAGGGGGGGGGGk.', '..AAGgGGGGGGGG..', '...GggGGGGGGG...', '...gg.GGGGgg....', '..gg.........gg.'],
        legs: [['................', '................', '................', '................'], ['................', '................', '................', '................']],
        k: 1.15, glow: { x: 2, y: 13, col: '170,255,60' }
    };
    const ghost = (c1, c2, eye) => ({
        pal: { G: c1, g: c2, e: eye, k: '#0a0520' },
        body: ['................', '................', '................', '.....GGGGGG.....', '....GGGGGGGG....', '...GGGGGGGGGG...', '...GGkkGGkkGG...', '...GGkeGGkeGG...', '...GGkkGGkkGG...', '...GGGGGGGGGG...', '...GGGkkkkGGG...', '...GGGGGGGGGG...', '...GGGGGGGGGG...', '..gGGGGGGGGGGg..', '..gGGGGGGGGGGg..', '..gGGGgGGgGGGg..', '..g.gG.gg.Gg.g..', '....g..g...g....'],
        legs: [['................', '................', '................', '................'], ['................', '................', '................', '................']],
        fly: true, ghost: true, k: 1.05
    });
    const worm = {
        pal: { P: '#ff9ac4', p: '#c04a7a', k: '#3a0a1c', w: '#ffd0e0' },
        body: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................',
            '.........pPPp...', '..pPPp..pPPPPk..', '.pPPPPppPPPPkwk.', '.pPPPPPPPPPPPk..', '..ppppppppppp...'],
        legs: [['................', '................', '................', '................'], ['................', '................', '................', '................']],
        k: 1.4
    };
    const wolf = {
        pal: { B: '#6a6a78', b: '#48485a', D: '#2a2a36', k: '#111', y: '#ffec4a', w: '#fff', R: '#8a1a1a' },
        body: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '..........D.D...',
            '..........BBBB..', 'b........BBByBB.', 'bb.......BBBBBBk', '.bBBBBBBBBBBBRww', '..BBBBBBBBBBB...', '..bBBBBBBBBB....', '..bbBBBBBBbb....', '...b.......b....'],
        legs: [['..BB..BB.BB.....', '..BB..BB.BB.....', '..DD..DD.DD.....', '................'], ['.BB..BB...BB....', '.BB...BB..BB....', '.DD...DD..DD....', '................']],
        k: 1.3
    };
    const lizard = {
        pal: { G: '#5a8a4a', g: '#3a6a2a', y: '#ffec4a', k: '#111', R: '#c0302a', w: '#fff' },
        body: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................',
            '..........GGG...', '.........GGyGG..', 'g.......GGGGGRw.', 'gg.GGGGGGGGGG...', '.gGGgGGgGGGG....', '..GGGGGGGGG.....', '...g.......g....'],
        legs: [['..GG..GG.GG.....', '..gg..gg.gg.....', '.gg..gg.gg......', '................'], ['.GG..GG...GG....', '.gg...gg..gg....', 'gg....gg..gg....', '................']],
        k: 1.25
    };
    const blob = {
        pal: { A: '#7ad04a', a: '#4a9a2a', L: '#c8ff5a', k: '#1a2a0a', y: '#fff94a', R: '#8a1a1a' },
        body: ['................', '................', '................', '................', '................', '.....AAAAA......', '...AAAAAAAAA....', '..AALAAAAAAAA...', '..ALLAAyAAyAA...', '.AAAAAAAAAAAAA..', '.AAAAARRRRRAAA..', '.AAaAAAAAAAAAA..', '.aAAAAAAAaAAAa..', '.aaAAAAAAAAAaa..', '..aaAAaAAAaaa...', '...aa.aa.aa.....', '....a..a..a.....', '................'],
        legs: [['................', '................', '................', '................'], ['................', '................', '................', '................']],
        k: 1, ghost: false, glow: { x: 4, y: 8, col: '170,255,60' }
    };
    const spider = {
        pal: { B: '#2a1a2a', b: '#4a2a4a', R: '#ff3b3b', k: '#111' },
        body: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................',
            '.....bBBBb......', '....BBBBBBBBB...', '.b.BBBBBBBBRBR..', 'b.b.BBBBBBBB.b..', '.b.b.b.b..b.b.b.', 'b.b.b.b.b..b.b.b', '................'],
        legs: [['................', '................', '................', '................'], ['................', '................', '................', '................']],
        k: 1.5
    };
    Object.assign(S, { drone, k9: dog, acidspit: frog, phaseshade: ghost('#8a70ff', '#5a3ad0', '#e0d4ff'), shade: ghost('#c8d0e8', '#8a94b0', '#ff3b3b'), leech: worm, leaper: wolf, stalker: lizard, horror: blob, spiderling: spider });

    // ---------- Raid-Bosse (24 breit) ----------
    const L2 = n => [Array(4).fill('.'.repeat(n)), Array(4).fill('.'.repeat(n))];
    S.king = {
        pal: { G: '#9a9aa2', g: '#6a6a72', D: '#2a2a2e', w: '#f4f0e6', k: '#111', R: '#ff3b3b', C: '#a3162f', c: '#6a0a1a', Y: '#f2c230', y: '#b38a10', J: '#3bd0ff', P: '#ff3b7b', s: '#3a3a40' },
        body: [
            '...........Y.Y.Y........',
            '..........YYYYYYY.......',
            '..........YJYYYJY.......',
            '.........DGGGGGGGD......',
            '........GGGGGGGGGGG.....',
            '........GDDDGGDDDG......',
            '........GDRDGGDRDGw.....',
            '........GDDGGGGDDwwk....',
            '.........GGGwwwwwww.....',
            '..........GwwwwwG.......',
            '.....CCCCCwwwwwwCC......',
            '....CCCCCCGGGGGGGCC..P..',
            '...CCCcCCCGGGGGGGGssYP..',
            '..CCCcCCCCGGwGGGGG..Y...',
            '..CCcCCCCCGGGGGGGG..Y...',
            'DGCCcCCCCCGGGGGGGG..Y...',
            'GDCCcCCCCCGGGwGGGG..Y...',
            'DGCcCCCCCCGGGGGGGG......',
            'GDCcCCCCCCYYYYYYYY......',
            '.DGCCCCCCCGGGGGGGG......',
            '..DGCCCCCCGGGGGGGG......',
            '...CCCCCCC.gg...gg......'],
        legs: [['...........gg...gg......', '...........gg...gg......', '...........ss...ss......', '..........sss...sss.....'], ['..........gg.....gg.....', '..........gg.....gg.....', '.........ss.......ss....', '.........sss......sss...']],
        k: .62, glow: { x: 21, y: 11, col: '255,60,120' }
    };
    S.golem = {
        pal: { S: '#8a929e', s: '#5b6270', D: '#3b4049', k: '#22262c', O: '#ff8a2a', o: '#ffd080', M: '#5a8a3a', I: '#4b4f56', n: '#b8c0ca' },
        body: [
            '........................',
            '.........SSSSSS.........',
            '........SSSSSSSSS.......',
            '........SSkSSSOkS.......',
            '........SSSSSSOSS.......',
            '........sSSSSSSSs.......',
            '...ssSSSSSSSSSSSSSSss...',
            '..sSSSSSSSSSSSSSSSSSSs..',
            '..SSSSSMSSSSOOSSSSSSSS..',
            '.sSSSSSSSSSOooOSSSMSSSs.',
            '.SSSnSSSSSSOooOSSSSnSSS.',
            '.SSIISSSSSSSOOSSSSSIISS.',
            '.SSSSSSSOSSSSSSSOSSSSSS.',
            'sSSSSS.SSOSSSSSOSS.SSSSs',
            'SSSSSS.SSSSSSSSSSS.SSSSS',
            'SSnSSS.SSSSSMSSSSS.SSnSS',
            'sSSSSs.sSSSSSSSSSs.sSSSs',
            '.ssss...SSSSSSSSS...ssss',
            '........SSS...SSS.......'],
        legs: [['........SSS...SSS.......', '........SSS...SSS.......', '.......sSSS...SSSs......', '.......DDDD...DDDD......'], ['.......SSS.....SSS......', '.......SSS.....SSS......', '......sSSS.....SSSs.....', '......DDDD.....DDDD.....']],
        k: .55, glow: { x: 12, y: 9, col: '255,140,40' }
    };
    S.queen = {
        pal: { Y: '#ffd84a', y: '#c98a00', K: '#1c150c', W: '#dcf0ff', w: '#a8d0f0', R: '#d01020', C: '#f2c230', J: '#ff3bd0' },
        body: [
            '........................',
            '...............C.C.C....',
            '...............CCCCC....',
            '..............YYYYYYY...',
            '..............YRRYRRYK..',
            '.........WWW..YYYYYYY.K.',
            '.......WWWWWW.YYYKYY..K.',
            '......WWwWWWWW.YYYY.....',
            '.....WWwWWWWWW.KKK......',
            '....WWwWWWWWWKKKKKK.....',
            '....WwWWWWWKKKKKKKKK....',
            '.YYKYYKYYKYYKKKKKKKK....',
            'KYYKYYKYYKYYYKKKKKK.....',
            '.YYKYYKYYKYYYK.K..K.....',
            '..YKYYKYYKYYK.K..K......',
            '...KYYKYYKY..K..K.......',
            '....KKKKKK..............'],
        legs: [['........................', '........................', '........................', '........................'], ['........................', '........................', '........................', '........................']],
        fly: true, k: .62
    };
    S.titan = {
        pal: { M: '#8a929e', m: '#5a626e', D: '#2a2e36', O: '#ff8a3a', o: '#ffd080', R: '#ff3b3b', G: '#1a1c20', Y: '#e8c030' },
        body: [
            '........................',
            '..........MMMMM.........',
            '.........MMMMMMM........',
            '.........MDDRRDM........',
            '.........MMMMMMM........',
            '......MMMMMMMMMMMM......',
            '....MMMMMMMMMMMMMMMM....',
            '...MMMYMMMMMMMMMMYMMM...',
            '...MMMMMMMMOOMMMMMMMM...',
            '...mMMMMMMOooOMMMMMMGGGG',
            '...mMMMMMMOooOMMMMMMGGGG',
            '...mMM.MMMMOOMMMMM.GGGGG',
            '...MM..MMMMMMMMMMM..GG..',
            '...MM..mMMMMMMMMMm......',
            '...DD..mMMMYYMMMMm......',
            '........MMMMMMMMM.......',
            '........MMM...MMM.......'],
        legs: [['........MMM...MMM.......', '........MMM...MMM.......', '.......mMMM...MMMm......', '.......DDDD...DDDD......'], ['.......MMM.....MMM......', '.......MMM.....MMM......', '......mMMM.....MMMm.....', '......DDDD.....DDDD.....']],
        k: .55, glow: { x: 11.5, y: 9, col: '255,140,60' }
    };
    S.reaper = {
        pal: { C: '#2a1a3a', c: '#170d22', B: '#e8e4d8', k: '#000', V: '#9d6bff', S: '#cfd6de', s: '#8a9098', W: '#5a3a20' },
        body: [
            '..............SSSSSS....',
            '.............S.....SS...',
            '........CCCC........S...',
            '.......CCCCCC.......W...',
            '......CCccccCC......W...',
            '......CcBBBBcC......W...',
            '......CcBkBkC.......W...',
            '......CcBBBBc.......W...',
            '.......cBkkB........W...',
            '......CCCCCCCC......W...',
            '.....CCCCCCCCCBBBBBBW...',
            '....CCcCCCCCCC......W...',
            '....CcCCCCCCCC......W...',
            '....CcCCCCCCCC......W...',
            '...CCcCCCCCCCCC.....W...',
            '...CcCCCCCCCCCC.........',
            '..CCcCCCCCCCCCCC........',
            '..C.C.C.C.C.C.C.........'],
        legs: [['........................', '........................', '........................', '........................'], ['........................', '........................', '........................', '........................']],
        fly: true, k: .7, glow: { x: 9, y: 6.5, col: '157,107,255' }
    };
    // ---------- Zombie-Bosse (25.09.2026, Max: „Zombie-Modus fertig im Pixel-Design", Issue #16) ----------
    // 24 breit wie die Raid-Bosse; Faehigkeiten-Optik (Strahl, Wirbel, Wut) kommt weiter aus zfx.js (zBossAura)
    S.abomination = {
        pal: { P: '#b04fff', p: '#7a2ab8', k: '#1a0020', R: '#ff3b3b', m: '#3a0a1a', W: '#f4f0e6', s: '#ff9ad0', H: '#9aa0aa' },
        body: [
            '........................',
            '.........PPPPP..........',
            '.......PPPPPPPPP........',
            '......PPpPPPPPPPP.......',
            '.....PPPPPkRkPPPPP......',
            '.....PPPPPPPPPPkRkP.....',
            '....PPPPmmmmmPPPPPPP....',
            '...PPPPPmWmWmPPPPPPPP...',
            '..PPsPPPPmmmPPPPsPPPPH..',
            '..PPPsPPPPPPPPPsPPPPPHH.',
            '.PPPPPsPPPPPPPsPPPPPPPH.',
            '.PPpPPPPPPPPPPPPPPpPPPH.',
            'PPPPPPPPPmmmPPPPPPPPPPP.',
            'PPPpPPPPmWmWmPPPPPPpPPP.',
            '.PPPPPPPPmmmPPPPPPPPPP..',
            '..PPPPPPPPPPPPPPPPPPP...',
            '...PPPPPPPP..PPPPPPP....'],
        legs: [['.....ppp.......ppp......', '.....ppp.......ppp......', '....pppp.......pppp.....', '....kkkk.......kkkk.....'], ['....ppp.........ppp.....', '....ppp.........ppp.....', '...pppp.........pppp....', '...kkkk.........kkkk....']],
        k: .5, glow: { x: 16, y: 5, col: '255,60,60' }
    };
    S.necro = {
        pal: { R: '#1f3a2e', r: '#0f2018', H: '#2a4a3a', B: '#e8e4d8', k: '#111', G: '#7cffb2', g: '#2aff80', S: '#6a4a28', m: '#333', A: '#d8d4c8' },
        body: [
            '.....G..................',
            '....GgG.......BBBB......',
            '.....S.......BBBBBB.....',
            '.....S......BkkBBkkB....',
            '.....S......BkGBBkGB....',
            '.....S.......BBmBBB.....',
            '.....S......HHBBBBHH....',
            '.....S.....HHRRRRRRHH...',
            '....AS....HRRRRRRRRRRH..',
            '.....SAA.HRRrRRRRRrRRH..',
            '.....S.AARRRRRRRRRRRRH..',
            '.....S..HRRRrRRRRRrRRRH.',
            '.....S..HRRRRRRRRRRRRRH.',
            '.....S.HRRRrRRRRRRrRRRH.',
            '.....S.HRRRRRRRRRRRRRRH.',
            '.......RrRrRrRrRrRrRrRr.',
            '........r.r.r.r.r.r.r...'],
        legs: L2(24), fly: true, k: .52, glow: { x: 5, y: 1, col: '124,255,178' }
    };
    S.brood = {
        pal: { R: '#ff7b3a', r: '#8a3010', Y: '#ffd23f', D: '#3a1a0a', e: '#ff2020', F: '#f4f0e6', L: '#2a1208' },
        body: [
            '........................',
            '...........RRRR.........',
            '.........RRRRRRRR.......',
            '........RRrRRRRrRR......',
            '.......RRRRRRRRRRRR.....',
            '.......RRrRRYYRRrRRR....',
            '.......RRRRYRRYRRRRR....',
            '........RRRRYYRRRRRDDD..',
            '.........RRRRRRRRDDDDDD.',
            '..L...L....RRRR..DeDeDD.',
            '...L.L.L..L.....DDDDDDF.',
            '....L...LL.L...L..DDD.F.',
            '...L...L..L.L.L.L.......',
            '..L...L...L..L...L......',
            '.L...L....L...L...L.....'],
        legs: [['.L..L.....L....L...L....', 'L...L.....L.....L...L...', '........................', '........................'], ['..L..L....L...L....L....', '.L...L.....L...L....L...', '........................', '........................']],
        k: .56, glow: { x: 18, y: 9, col: '255,40,40' }
    };
    S.inferno = {
        pal: { F: '#ff9a2a', Y: '#ffe070', R: '#3a1a10', k: '#ff3a00', L: '#4a2418', O: '#ff5a1e', m: '#ff8a2a', l: '#2a120a' },
        body: [
            '.........F.F.F..........',
            '........FFFFFFF.........',
            '.......FFYYYYYFF........',
            '.......RRRRRRRRR........',
            '.......RkYRRkYRR........',
            '.......RRRRRRRRR........',
            '........RRmmmRR.........',
            '....LLLLRRRRRRRLLLL.....',
            '...LLLLLLLLLLLLLLLLL....',
            '..LLLOLLLLLOLLLLLOLLL...',
            '..LLOOLLLLOOOLLLOOLLL...',
            '..LLLLLLLLLOLLLLLLLLLL..',
            '.LLL.LLLOLLLLLLOLLL.LLL.',
            '.LLL.LLLLLLOLLLLLLL.LLL.',
            '.YYY.LLLLLLLLLLLLLL.YYY.',
            '.YY...LLLLL..LLLLL...YY.'],
        legs: [['.......LLL....LLL.......', '.......LOL....LLL.......', '......lLLL....LLLl......', '......llll....llll......'], ['......LLL......LLL......', '......LLL......LOL......', '.....lLLL......LLLl.....', '.....llll......llll.....']],
        k: .5, glow: { x: 11, y: 10, col: '255,120,30' }
    };
    S.storm = {
        pal: { Z: '#fff27a', H: '#1a3a5a', e: '#5ad8ff', C: '#2a6a9a', c: '#5ad8ff' },
        body: [
            '.......Z.......Z........',
            '........Z.....Z.........',
            '.........HHHHH..........',
            '........HHHHHHH.........',
            '........HeHHHeH.........',
            '........HHHHHHH.........',
            '.........HHHHH..........',
            '.......CCCCCCCCC........',
            '.....ZCCCcCCCcCCCZ......',
            '....Z.CCCCCCCCCCC.Z.....',
            '......CCCcCCCcCCC..Z....',
            '.....CCCCCCCCCCCCC......',
            '.....CCcCCCCCCcCCCC.....',
            '....CCCCCCCCCCCCCCCC....',
            '....C.C.C.C.C.C.C.C.....',
            '...Z...Z...Z...Z...Z....'],
        legs: L2(24), fly: true, k: .55, glow: { x: 11, y: 4, col: '90,216,255' }
    };
    S.overlord = {
        pal: { V: '#6a2a9a', W: '#f4eaff', I: '#c86bff', P: '#1a001a', r: '#ff3b5a', T: '#8a3ab8' },
        body: [
            '........................',
            '.........VVVVVV.........',
            '.......VVWWWWWWVV.......',
            '......VWWWWWWWWWWV......',
            '.....VWWWWIIIIWWWWV.....',
            '.....VWWWIIPPIIWWWV.....',
            '....VWWWIIPPPPIIWWWV....',
            '....VWrWIIPPPPIIWrWV....',
            '.....VWWWIIPPIIWWWV.....',
            '.....VWWWWIIIIWWWWV.....',
            '......VWWrWWWWrWWV......',
            '.......VVWWWWWWVV.......',
            '.........VVVVVV.........',
            '.......T..T..T..T.......',
            '......T..T...T...T......',
            '.....T...T...T....T.....',
            '....T...T.....T....T....'],
        legs: L2(24), fly: true, k: .48, glow: { x: 11.5, y: 6.5, col: '200,107,255' }
    };
    S.judge = {
        pal: { B: '#e8e4d8', k: '#111', E: '#7fd8ff', m: '#333', R: '#141418', r: '#2a2a34', W: '#f4f0e6', G: '#8a5a2a', S: '#5a3a20', A: '#e8e4d8' },
        body: [
            '.........BBBBBB.........',
            '........BBBBBBBB........',
            '........BkkBBkkB........',
            '........BkEBBkkB........',
            '........BBBBBBBB........',
            '.........BmmmmB.........',
            '..........BBBB..........',
            '.......RRRWWWWRRR.......',
            '......RRRRRWWRRRRR......',
            '.....RRRRRRRRRRRRRR.GGG.',
            '.....RRrRRRRRRRRrRRAGGG.',
            '.....RRRRRRRRRRRRRRA.S..',
            '....RRRrRRRRRRRRrRRRR...',
            '....RRRRRRRRRRRRRRRRR...',
            '....RRRRRRRRRRRRRRRRR...',
            '.....RRRRRR...RRRRRR....'],
        legs: [['.......BB......BB.......', '.......BB......BB.......', '......BBB......BBB......', '......kkk......kkk......'], ['......BB........BB......', '......BB........BB......', '.....BBB........BBB.....', '.....kkk........kkk.....']],
        k: .56, glow: { x: 10, y: 3, col: '127,216,255' }
    };
    S.seraph = {
        pal: { Y: '#ffe070', O: '#ffcf3a', k: '#6a3a00', m: '#ff8a2a', F: '#fff4c0', W: '#fffae8', w: '#e8d8a0', R: '#ffcf3a' },
        body: [
            '..........YYYY..........',
            '...F....YYYYYYYY....F...',
            '..FF...YYOOOOOOYY...FF..',
            '.FFF..YYOkOOOOkOYY..FFF.',
            'FFFF..YOOOOOOOOOOY..FFFF',
            'FFFFF.YOOOOmmOOOOY.FFFFF',
            'FFFFFFYYOOOOOOOOYYFFFFFF',
            '.FFFFFFYYOOOOOOYYFFFFFF.',
            '..FFFFFFYYYYYYYYFFFFFF..',
            '...FFFFF..WWWW..FFFFF...',
            '....FFF..WWWWWW..FFF....',
            '.........WWWWWW.........',
            '........WWWWWWWW........',
            '........WwWWWWwW........',
            '.......WWWWWWWWWW.......',
            '.........R.R.R..........'],
        legs: L2(24), fly: true, k: .46, glow: { x: 11.5, y: 4, col: '255,207,58' }
    };
    S.omega = {
        pal: { H: '#ffd23f', V: '#1a0a2e', s: '#ffffff', e: '#b06bff', E: '#d8a8ff' },
        body: [
            '.......H.H.H.H.H........',
            '........HHHHHHHH........',
            '.........VVVVVV.........',
            '........VVVVVVVV........',
            '.......VVeVVVVeVV.......',
            '.......VVVVVVVVVV.......',
            '........VVEEEEVV........',
            '...VV....VVVVVV....VV...',
            '....VVVVVVVVVVVVVVVV....',
            '.....VVsVVVVVVVVsVVV....',
            '......VVVVVsVVVVVVV.....',
            '......VVVVVVVVVVsVV.....',
            '.....VVVsVVVVVVVVVVV....',
            '....VVVVVVVVVVsVVVVVV...',
            '...VVVVVVVsVVVVVVVVVVV..',
            '..V.V..V.V..V..V.V..V...'],
        legs: L2(24), fly: true, k: .47, glow: { x: 11.5, y: 6, col: '176,107,255' }
    };
    // Phasen-Adds (Kek Eye: Waechter, Titan: Reaktor)
    S.watcher = {
        pal: { V: '#6a2a9a', W: '#f4eaff', I: '#c86bff', P: '#1a001a', T: '#8a3ab8' },
        body: ['................', '.....VVVVVV.....', '...VVWWWWWWVV...', '..VWWWIIIIWWWV..', '..VWWIIPPIIWWV..', '..VWWIIPPIIWWV..',
            '..VWWWIIIIWWWV..', '...VVWWWWWWVV...', '.....VVVVVV.....', '......T..T......', '.....T...T......', '.....T....T.....'],
        legs: L2(16), fly: true, k: 1.3, glow: { x: 7.5, y: 4.5, col: '200,107,255' }
    };
    S.reactor = {
        pal: { M: '#8a929e', m: '#5a626e', G: '#3a4a5a', O: '#ff8a3a', o: '#ffe0a0', D: '#2a2e36' },
        body: ['................', '.....MMMMMM.....', '....MmmmmmmM....', '....MGGGGGGM....', '....MGOOOOGM....', '....MGOooOGM....',
            '....MGOooOGM....', '....MGOOOOGM....', '....MGGGGGGM....', '....MmmmmmmM....', '...MMMMMMMMMM...', '...DDDDDDDDDD...'],
        legs: L2(16), k: 1.3, glow: { x: 7.5, y: 5.5, col: '255,138,58' }
    };
    if (typeof B_AURA !== 'undefined') Object.assign(B_AURA, {
        abomination: 'rgba(176,79,255,.35)', necro: 'rgba(124,255,178,.35)', brood: 'rgba(255,123,58,.3)', inferno: 'rgba(255,90,30,.4)',
        storm: 'rgba(90,216,255,.35)', overlord: 'rgba(200,107,255,.4)', judge: 'rgba(127,216,255,.3)', seraph: 'rgba(255,207,58,.45)',
        omega: 'rgba(176,107,255,.45)', watcher: 'rgba(200,107,255,.3)', reactor: 'rgba(255,138,58,.35)'
    });
    Object.assign(PX, S);
    // Spieler (25.09.2026): Figur in Spielerfarbe, Waffe zeichnet index.html frei drehend dazu
    const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join(''); };
    window.pxPlayerKind = function (col) {
        col = /^#[0-9a-f]{6}$/i.test(col || '') ? col.toLowerCase() : '#ff5bd6';
        const key = 'pl-' + col;
        if (!PX[key]) PX[key] = human({ head: 'cap', weapon: 'none', pal: { H: shade(col, .45), C: col, c: shade(col, .7), A: shade(col, .85), s: '#f0cfb0', B: '#2a2a32', P: '#2e3444', p: '#222836', e: '#111', m: '#9a4a3a' } });
        return key;
    };
})();
