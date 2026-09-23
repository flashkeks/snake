// Cosmetic Shop (#9, Umbau 23.09.2026): Kosmetik fuer Coins. Rein optisch,
// kein Spielvorteil. Gekauftes liegt im Konto (u.inventory), angelegt ist je
// Kategorie hoechstens ein Teil (u.equipped). Andere Spieler sehen Skin, Kopf,
// Trail, Namensfarbe und Todes-Effekt; Musik hoert nur man selbst.
//
// Kaufen kann man nur, was gerade im Angebot ist: taeglich 8 Teile (Daily),
// woechentlich 4 Premium-Teile (Weekly). Die Auswahl ist fest aus dem Datum
// abgeleitet (Europe/Berlin, ISO-Woche), also fuer alle gleich und ohne
// Speicher. Gekauftes bleibt fuer immer und laesst sich jederzeit anlegen.
//
// Aussehen steht als Daten im Katalog (`look`), der Browser deutet es:
//   Skins:  fade {c: [Farben], end (Anteil am Schwanz)}, cycle {c, w (Segmente je Farbe), mv (Segmente/s)},
//           hue {h, step, sp (Grad/ms), s, l, span}, glint {h, s, l, g}, flash {c, ms};
//           dazu out (Rand, 'self' = Spielerfarbe), stars (Funkeln)
//           'self' in Farben = Spielerfarbe
//   Trails: emoji {e: [..], up}, dot {h: [von, bis] | c | hue: true, up}, ring {c, up}
//   Tod:    rise {e}, boom {e, c, big}, confetti {}, burst {e: [..], n}, implode {c, e}
//   Namen:  c (eine Farbe) oder g (Verlauf, laeuft durch)
//   Musik:  mode arp|pad, bpm, type, vol, steps, chords, bass, lp
// Die Preise sind die Coin-Senke fuer die Wirtschaft (#11).

const CATS = {
    skin: 'Snake skins',
    head: 'Heads',
    trail: 'Trails',
    death: 'Death effects',
    name: 'Name colors',
    music: 'Music'
};

// Seltenheit nach Preis
// Schwellen mit den Preisen verdoppelt (5.2b), damit die Seltenheit gleich bleibt
const RARITIES = [
    { id: 'common', name: 'Common', min: 0 },
    { id: 'rare', name: 'Rare', min: 20000 },
    { id: 'epic', name: 'Epic', min: 50000 },
    { id: 'legendary', name: 'Legendary', min: 120000 }
];

const RAINBOW = ['#ff5b5b', '#ffd23f', '#7dffb0', '#3da5ff', '#a970ff'];

const ITEMS = [
    // ---------- Skins ----------
    { id: 'skin_gradient', cat: 'skin', name: 'Gradient', icon: '🌈', price: 16000, desc: 'Your color fades towards the tail', look: { k: 'fade', c: ['self', '#000000'], end: 0.7 } },
    { id: 'skin_stripes', cat: 'skin', name: 'Stripes', icon: '🦓', price: 20000, desc: 'Every third segment in white', look: { k: 'cycle', c: ['self', 'self', '#ffffff'] } },
    { id: 'skin_candy', cat: 'skin', name: 'Candy', icon: '🍬', price: 24000, desc: 'Pink and white candy cane', look: { k: 'cycle', c: ['#ff4fa3', '#ffffff'], w: 2 } },
    { id: 'skin_neon', cat: 'skin', name: 'Neon', icon: '💡', price: 32000, desc: 'Glowing outline in your color', look: { k: 'cycle', c: ['rgba(10,10,20,.9)'], out: 'self' } },
    { id: 'skin_rainbow', cat: 'skin', name: 'Rainbow', icon: '🏳️‍🌈', price: 60000, desc: 'Moving rainbow along the body', look: { k: 'hue', h: 0, step: 24, sp: -0.125, s: 95, l: 60 } },
    { id: 'skin_galaxy', cat: 'skin', name: 'Galaxy', icon: '🌌', price: 80000, desc: 'Deep space with twinkling stars', look: { k: 'cycle', c: ['#2a1650', '#1b1033'], stars: '#ffffff' } },
    { id: 'skin_gold', cat: 'skin', name: 'Solid Gold', icon: '🥇', price: 100000, desc: 'Shiny gold with a running glint', look: { k: 'glint', h: 45, s: 100, l: 45, g: 40 } },
    { id: 'skin_tiger', cat: 'skin', name: 'Tiger', icon: '🐯', price: 18000, desc: 'Orange with black stripes', look: { k: 'cycle', c: ['#ff8c1a', '#ff8c1a', '#1a1a1a'] } },
    { id: 'skin_bee', cat: 'skin', name: 'Bumblebee', icon: '🐝', price: 14000, desc: 'Yellow and black, buzz buzz', look: { k: 'cycle', c: ['#ffd21a', '#1a1a1a'], w: 2 } },
    { id: 'skin_coral', cat: 'skin', name: 'Coral snake', icon: '🪸', price: 24000, desc: 'Red touches yellow…', look: { k: 'cycle', c: ['#e8312f', '#e8312f', '#ffd21a', '#111111', '#ffd21a'] } },
    { id: 'skin_zebra', cat: 'skin', name: 'Zebra', icon: '🦓', price: 12000, desc: 'Black and white, strictly', look: { k: 'cycle', c: ['#f5f5f5', '#111111'] } },
    { id: 'skin_checker', cat: 'skin', name: 'Checkered flag', icon: '🏁', price: 18000, desc: 'Race day', look: { k: 'cycle', c: ['#ffffff', '#111111'], mv: 3 } },
    { id: 'skin_watermelon', cat: 'skin', name: 'Watermelon', icon: '🍉', price: 16000, desc: 'Green rind, red inside', look: { k: 'fade', c: ['#1f9e3a', '#ff4d6d', '#ff4d6d'], out: '#1f9e3a' } },
    { id: 'skin_ocean', cat: 'skin', name: 'Ocean', icon: '🌊', price: 22000, desc: 'From shallow to deep', look: { k: 'fade', c: ['#7df9ff', '#1e90ff', '#0a1a5c'] } },
    { id: 'skin_sunset', cat: 'skin', name: 'Sunset', icon: '🌅', price: 22000, desc: 'Warm evening colors', look: { k: 'fade', c: ['#ffd23f', '#ff7a3d', '#d6336c', '#4b1d6b'] } },
    { id: 'skin_vapor', cat: 'skin', name: 'Vaporwave', icon: '📼', price: 28000, desc: 'A E S T H E T I C', look: { k: 'fade', c: ['#ff71ce', '#b967ff', '#01cdfe'] } },
    { id: 'skin_forest', cat: 'skin', name: 'Forest', icon: '🌲', price: 12000, desc: 'Deep greens', look: { k: 'fade', c: ['#7bc043', '#2e7d32', '#1b3d1f'] } },
    { id: 'skin_camo', cat: 'skin', name: 'Camo', icon: '🪖', price: 20000, desc: 'You cannot see me', look: { k: 'cycle', c: ['#4b5320', '#6b8e23', '#3b2f1e', '#6b8e23', '#4b5320', '#8a7f5a'] } },
    { id: 'skin_arctic', cat: 'skin', name: 'Arctic camo', icon: '🏔️', price: 24000, desc: 'Winter warfare', look: { k: 'cycle', c: ['#e8eef2', '#b0bec5', '#ffffff', '#78909c', '#e8eef2'] } },
    { id: 'skin_lava', cat: 'skin', name: 'Lava', icon: '🌋', price: 56000, desc: 'Molten rock that keeps flowing', look: { k: 'hue', h: 0, step: 5, sp: 0.06, s: 100, l: 48, span: 40 } },
    { id: 'skin_toxic', cat: 'skin', name: 'Toxic', icon: '☣️', price: 52000, desc: 'Glowing green sludge', look: { k: 'glint', h: 100, s: 100, l: 35, g: 30, out: '#b6ff00' } },
    { id: 'skin_ice', cat: 'skin', name: 'Ice', icon: '🧊', price: 26000, desc: 'Frozen solid', look: { k: 'glint', h: 195, s: 90, l: 70, g: 25 } },
    { id: 'skin_sakura', cat: 'skin', name: 'Sakura', icon: '🌸', price: 30000, desc: 'Cherry blossom pink', look: { k: 'cycle', c: ['#ffc0d9', '#ffb3c6', '#ffffff', '#ff8fab'], stars: '#ffffff' } },
    { id: 'skin_police', cat: 'skin', name: 'Police', icon: '🚓', price: 70000, desc: 'Flashing red and blue', look: { k: 'flash', c: ['#ff2d2d', '#2d6bff'], ms: 250 } },
    { id: 'skin_matrix', cat: 'skin', name: 'Matrix', icon: '💻', price: 60000, desc: 'Wake up, Neo', look: { k: 'glint', h: 130, s: 100, l: 18, g: 45, out: '#00ff41' } },
    { id: 'skin_diamond', cat: 'skin', name: 'Diamond', icon: '💎', price: 180000, desc: 'Brilliant cut, blinding glint', look: { k: 'glint', h: 190, s: 100, l: 65, g: 35, stars: '#ffffff' } },
    { id: 'skin_ruby', cat: 'skin', name: 'Ruby', icon: '♦️', price: 90000, desc: 'Deep red gem', look: { k: 'glint', h: 350, s: 90, l: 38, g: 35 } },
    { id: 'skin_emerald', cat: 'skin', name: 'Emerald', icon: '💚', price: 90000, desc: 'Polished green gem', look: { k: 'glint', h: 145, s: 85, l: 35, g: 35 } },
    { id: 'skin_amethyst', cat: 'skin', name: 'Amethyst', icon: '🔮', price: 90000, desc: 'Purple crystal', look: { k: 'glint', h: 275, s: 75, l: 42, g: 35 } },
    { id: 'skin_chrome', cat: 'skin', name: 'Chrome', icon: '🪞', price: 110000, desc: 'Mirror finish', look: { k: 'glint', h: 210, s: 10, l: 60, g: 38 } },
    { id: 'skin_aurora', cat: 'skin', name: 'Aurora', icon: '🌠', price: 130000, desc: 'Northern lights, always moving', look: { k: 'hue', h: 120, step: 9, sp: 0.05, s: 85, l: 55, span: 160 } },
    { id: 'skin_plasma', cat: 'skin', name: 'Plasma', icon: '⚡', price: 150000, desc: 'Very fast rainbow with a white edge', look: { k: 'hue', h: 0, step: 40, sp: -0.5, s: 100, l: 55, out: '#ffffff' } },
    { id: 'skin_void', cat: 'skin', name: 'Void', icon: '🕳️', price: 140000, desc: 'Pure darkness with a purple rim', look: { k: 'cycle', c: ['#050008'], out: '#a970ff', stars: '#a970ff' } },
    { id: 'skin_bloodmoon', cat: 'skin', name: 'Blood moon', icon: '🌑', price: 70000, desc: 'Dark red with a running shine', look: { k: 'glint', h: 0, s: 100, l: 22, g: 30 } },
    { id: 'skin_pastel', cat: 'skin', name: 'Pastel', icon: '🧁', price: 14000, desc: 'Soft colors, softer snake', look: { k: 'cycle', c: ['#ffd1dc', '#c1e1c1', '#aec6cf', '#fdfd96', '#cbaacb'] } },
    { id: 'skin_mint', cat: 'skin', name: 'Mint choc chip', icon: '🍨', price: 16000, desc: 'Controversial flavor', look: { k: 'cycle', c: ['#98ff98', '#98ff98', '#4a2c2a'] } },
    { id: 'skin_pride', cat: 'skin', name: 'Pride', icon: '🏳️‍🌈', price: 36000, desc: 'Six stripes', look: { k: 'cycle', c: ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'], w: 2 } },
    { id: 'skin_disco', cat: 'skin', name: 'Disco', icon: '🪩', price: 76000, desc: 'Every segment its own party', look: { k: 'cycle', c: RAINBOW, mv: 8, stars: '#ffffff' } },
    { id: 'skin_cosmic', cat: 'skin', name: 'Cosmic', icon: '🪐', price: 240000, desc: 'A whole universe with a golden rim', look: { k: 'hue', h: 250, step: 6, sp: 0.03, s: 70, l: 22, span: 80, out: '#ffd23f', stars: '#ffffff' } },
    { id: 'skin_phoenix', cat: 'skin', name: 'Phoenix', icon: '🐦‍🔥', price: 300000, desc: 'Burning gold into red, reborn every second', look: { k: 'hue', h: 0, step: 4, sp: 0.2, s: 100, l: 55, span: 55, out: '#ffd23f' } },

    // ---------- Koepfe ----------
    { id: 'head_cool', cat: 'head', name: 'Cool', icon: '😎', price: 8000 },
    { id: 'head_alien', cat: 'head', name: 'Alien', icon: '👽', price: 12000 },
    { id: 'head_robot', cat: 'head', name: 'Robot', icon: '🤖', price: 12000 },
    { id: 'head_skull', cat: 'head', name: 'Skull', icon: '💀', price: 16000 },
    { id: 'head_fire', cat: 'head', name: 'On fire', icon: '🔥', price: 24000 },
    { id: 'head_dragon', cat: 'head', name: 'Dragon', icon: '🐉', price: 32000 },
    { id: 'head_crown', cat: 'head', name: 'Crown', icon: '👑', price: 48000 },
    { id: 'head_frog', cat: 'head', name: 'Frog', icon: '🐸', price: 8000 },
    { id: 'head_cat', cat: 'head', name: 'Cat', icon: '🐱', price: 8000 },
    { id: 'head_fox', cat: 'head', name: 'Fox', icon: '🦊', price: 10000 },
    { id: 'head_panda', cat: 'head', name: 'Panda', icon: '🐼', price: 10000 },
    { id: 'head_clown', cat: 'head', name: 'Clown', icon: '🤡', price: 10000 },
    { id: 'head_pumpkin', cat: 'head', name: 'Pumpkin', icon: '🎃', price: 14000 },
    { id: 'head_unicorn', cat: 'head', name: 'Unicorn', icon: '🦄', price: 24000 },
    { id: 'head_octopus', cat: 'head', name: 'Octopus', icon: '🐙', price: 12000 },
    { id: 'head_ninja', cat: 'head', name: 'Ninja', icon: '🥷', price: 20000 },
    { id: 'head_cowboy', cat: 'head', name: 'Cowboy', icon: '🤠', price: 14000 },
    { id: 'head_wizard', cat: 'head', name: 'Wizard', icon: '🧙', price: 28000 },
    { id: 'head_oni', cat: 'head', name: 'Oni', icon: '👹', price: 22000 },
    { id: 'head_devil', cat: 'head', name: 'Devil', icon: '😈', price: 18000 },
    { id: 'head_shark', cat: 'head', name: 'Shark', icon: '🦈', price: 20000 },
    { id: 'head_pizza', cat: 'head', name: 'Pizza', icon: '🍕', price: 8000 },
    { id: 'head_invader', cat: 'head', name: 'Invader', icon: '👾', price: 16000 },
    { id: 'head_gem', cat: 'head', name: 'Gem', icon: '💎', price: 60000 },
    { id: 'head_moon', cat: 'head', name: 'Moon', icon: '🌚', price: 12000 },
    { id: 'head_trex', cat: 'head', name: 'T-Rex', icon: '🦖', price: 24000 },
    { id: 'head_penguin', cat: 'head', name: 'Penguin', icon: '🐧', price: 10000 },
    { id: 'head_cold', cat: 'head', name: 'Freezing', icon: '🥶', price: 12000 },
    { id: 'head_money', cat: 'head', name: 'Money face', icon: '🤑', price: 50000 },
    { id: 'head_vampire', cat: 'head', name: 'Vampire', icon: '🧛', price: 22000 },
    { id: 'head_ghost', cat: 'head', name: 'Ghost', icon: '👻', price: 14000 },
    { id: 'head_donut', cat: 'head', name: 'Donut', icon: '🍩', price: 8000 },
    { id: 'head_eye', cat: 'head', name: 'All-seeing eye', icon: '👁️', price: 70000 },
    { id: 'head_star', cat: 'head', name: 'Star', icon: '🌟', price: 40000 },
    { id: 'head_goat', cat: 'head', name: 'GOAT', icon: '🐐', price: 160000, desc: 'Greatest of all time' },
    { id: 'head_trophy', cat: 'head', name: 'Trophy', icon: '🏆', price: 120000 },

    // ---------- Trails ----------
    { id: 'trail_bubbles', cat: 'trail', name: 'Bubbles', icon: '🫧', price: 20000, look: { k: 'ring', c: '#9ae6ff', up: true } },
    { id: 'trail_hearts', cat: 'trail', name: 'Hearts', icon: '💖', price: 24000, look: { k: 'emoji', e: ['💖'] } },
    { id: 'trail_sparkles', cat: 'trail', name: 'Sparkles', icon: '✨', price: 28000, look: { k: 'emoji', e: ['✨'] } },
    { id: 'trail_fire', cat: 'trail', name: 'Fire', icon: '🔥', price: 36000, look: { k: 'dot', h: [30, 0], up: true } },
    { id: 'trail_blossom', cat: 'trail', name: 'Cherry blossoms', icon: '🌸', price: 28000, look: { k: 'emoji', e: ['🌸', '🌺'] } },
    { id: 'trail_stars', cat: 'trail', name: 'Stars', icon: '⭐', price: 24000, look: { k: 'emoji', e: ['⭐', '🌟'] } },
    { id: 'trail_money', cat: 'trail', name: 'Money rain', icon: '💸', price: 80000, look: { k: 'emoji', e: ['💸', '💵'] } },
    { id: 'trail_snow', cat: 'trail', name: 'Snow', icon: '❄️', price: 22000, look: { k: 'emoji', e: ['❄️'] } },
    { id: 'trail_notes', cat: 'trail', name: 'Music notes', icon: '🎵', price: 20000, look: { k: 'emoji', e: ['🎵', '🎶'], up: true } },
    { id: 'trail_leaves', cat: 'trail', name: 'Leaves', icon: '🍃', price: 16000, look: { k: 'emoji', e: ['🍃', '🍂'] } },
    { id: 'trail_bolt', cat: 'trail', name: 'Lightning', icon: '⚡', price: 44000, look: { k: 'emoji', e: ['⚡'] } },
    { id: 'trail_coins', cat: 'trail', name: 'Coins', icon: '🪙', price: 60000, look: { k: 'emoji', e: ['🪙'] } },
    { id: 'trail_skulls', cat: 'trail', name: 'Skulls', icon: '💀', price: 32000, look: { k: 'emoji', e: ['💀'], up: true } },
    { id: 'trail_rainbow', cat: 'trail', name: 'Rainbow dust', icon: '🌈', price: 52000, look: { k: 'dot', hue: true } },
    { id: 'trail_smoke', cat: 'trail', name: 'Smoke', icon: '💨', price: 12000, look: { k: 'dot', c: '#8a8f98', up: true } },
    { id: 'trail_toxic', cat: 'trail', name: 'Toxic bubbles', icon: '🧪', price: 24000, look: { k: 'ring', c: '#b6ff00', up: true } },
    { id: 'trail_butterflies', cat: 'trail', name: 'Butterflies', icon: '🦋', price: 40000, look: { k: 'emoji', e: ['🦋'], up: true } },
    { id: 'trail_ghosts', cat: 'trail', name: 'Ghosts', icon: '👻', price: 36000, look: { k: 'emoji', e: ['👻'], up: true } },
    { id: 'trail_diamonds', cat: 'trail', name: 'Diamonds', icon: '💎', price: 140000, look: { k: 'emoji', e: ['💎'] } },
    { id: 'trail_clover', cat: 'trail', name: 'Lucky clover', icon: '🍀', price: 30000, look: { k: 'emoji', e: ['🍀'] } },
    { id: 'trail_ice', cat: 'trail', name: 'Frost', icon: '🌨️', price: 18000, look: { k: 'dot', c: '#bff4ff' } },
    { id: 'trail_plasma', cat: 'trail', name: 'Plasma', icon: '🟣', price: 56000, look: { k: 'dot', h: [280, 200], up: true } },
    { id: 'trail_crowns', cat: 'trail', name: 'Crowns', icon: '👑', price: 200000, look: { k: 'emoji', e: ['👑'], up: true } },

    // ---------- Todes-Effekte ----------
    { id: 'death_ghost', cat: 'death', name: 'Ghost', icon: '👻', price: 16000, desc: 'A ghost floats up where you die', look: { k: 'rise', e: '👻' } },
    { id: 'death_confetti', cat: 'death', name: 'Confetti', icon: '🎉', price: 20000, desc: 'Confetti burst for everyone to see', look: { k: 'confetti' } },
    { id: 'death_boom', cat: 'death', name: 'Explosion', icon: '💥', price: 28000, desc: 'Big boom with a shockwave', look: { k: 'boom', e: '💥', c: '#ffb347' } },
    { id: 'death_tomb', cat: 'death', name: 'Tombstone', icon: '🪦', price: 14000, desc: 'Rest in peace', look: { k: 'rise', e: '🪦' } },
    { id: 'death_angel', cat: 'death', name: 'Angel', icon: '😇', price: 24000, desc: 'Off to snake heaven', look: { k: 'rise', e: '😇' } },
    { id: 'death_money', cat: 'death', name: 'Money burst', icon: '💸', price: 70000, desc: 'Cash flies everywhere', look: { k: 'burst', e: ['💸', '💵', '🪙'], n: 14 } },
    { id: 'death_nuke', cat: 'death', name: 'Nuke', icon: '☢️', price: 130000, desc: 'Massive green shockwave', look: { k: 'boom', e: '☢️', c: '#b6ff00', big: true } },
    { id: 'death_bolt', cat: 'death', name: 'Lightning strike', icon: '🌩️', price: 40000, desc: 'Struck from above', look: { k: 'boom', e: '⚡', c: '#c78bff' } },
    { id: 'death_hearts', cat: 'death', name: 'Heartbreak', icon: '💔', price: 18000, desc: 'Broken hearts everywhere', look: { k: 'burst', e: ['💔', '💖'], n: 10 } },
    { id: 'death_skull', cat: 'death', name: 'Skull', icon: '💀', price: 16000, desc: 'A skull rises', look: { k: 'rise', e: '💀' } },
    { id: 'death_stars', cat: 'death', name: 'Seeing stars', icon: '💫', price: 24000, desc: 'Stars fly out', look: { k: 'burst', e: ['⭐', '💫', '✨'], n: 12 } },
    { id: 'death_blackhole', cat: 'death', name: 'Black hole', icon: '🕳️', price: 90000, desc: 'Everything collapses into a point', look: { k: 'implode', c: '#a970ff', e: '🕳️' } },
    { id: 'death_freeze', cat: 'death', name: 'Shatter', icon: '🧊', price: 32000, desc: 'Frozen and shattered', look: { k: 'burst', e: ['🧊', '❄️'], n: 12 } },
    { id: 'death_fireworks', cat: 'death', name: 'Fireworks', icon: '🎆', price: 56000, desc: 'A proper show', look: { k: 'burst', e: ['🎆', '🎇', '✨'], n: 16 } },
    { id: 'death_wasted', cat: 'death', name: 'Wasted', icon: '🍷', price: 110000, desc: 'Collapses into a red point', look: { k: 'implode', c: '#ff2d2d', e: '🍷' } },

    // ---------- Namensfarben ----------
    { id: 'name_gold', cat: 'name', name: 'Gold name', icon: '🟡', price: 12000, desc: 'On the field and in the chat', look: { c: '#ffd700' } },
    { id: 'name_ice', cat: 'name', name: 'Ice name', icon: '🧊', price: 12000, desc: 'On the field and in the chat', look: { c: '#9ae6ff' } },
    { id: 'name_rainbow', cat: 'name', name: 'Rainbow name', icon: '🌈', price: 32000, desc: 'On the field and in the chat', look: { g: RAINBOW } },
    { id: 'name_red', cat: 'name', name: 'Blood name', icon: '🔴', price: 10000, desc: 'On the field and in the chat', look: { c: '#ff3b3b' } },
    { id: 'name_toxic', cat: 'name', name: 'Toxic name', icon: '🟢', price: 10000, desc: 'On the field and in the chat', look: { c: '#b6ff00' } },
    { id: 'name_pink', cat: 'name', name: 'Pink name', icon: '🩷', price: 10000, desc: 'On the field and in the chat', look: { c: '#ff71ce' } },
    { id: 'name_purple', cat: 'name', name: 'Royal name', icon: '🟣', price: 14000, desc: 'On the field and in the chat', look: { c: '#b884ff' } },
    { id: 'name_mint', cat: 'name', name: 'Mint name', icon: '🍃', price: 10000, desc: 'On the field and in the chat', look: { c: '#7dffb0' } },
    { id: 'name_fire', cat: 'name', name: 'Fire name', icon: '🔥', price: 28000, desc: 'Flowing flames', look: { g: ['#ffd23f', '#ff7a3d', '#ff2d2d'] } },
    { id: 'name_ocean', cat: 'name', name: 'Ocean name', icon: '🌊', price: 28000, desc: 'Flowing waves', look: { g: ['#7df9ff', '#1e90ff', '#3d5afe'] } },
    { id: 'name_vapor', cat: 'name', name: 'Vapor name', icon: '📼', price: 36000, desc: 'Pink to cyan', look: { g: ['#ff71ce', '#b967ff', '#01cdfe'] } },
    { id: 'name_sunset', cat: 'name', name: 'Sunset name', icon: '🌅', price: 28000, desc: 'Warm glow', look: { g: ['#ffd23f', '#ff7a3d', '#d6336c'] } },
    { id: 'name_diamond', cat: 'name', name: 'Diamond name', icon: '💎', price: 120000, desc: 'White-blue shimmer', look: { g: ['#ffffff', '#9ae6ff', '#3da5ff', '#ffffff'] } },

    // ---------- Musik ----------
    { id: 'music_chip', cat: 'music', name: 'Chiptune loop', icon: '🎮', price: 32000, desc: 'Plays while you are on the field (only you hear it)', look: { mode: 'arp', bpm: 132, type: 'square', vol: .03, steps: 16, chords: [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]], bass: [131, 110, 87, 98] } },
    { id: 'music_lofi', cat: 'music', name: 'Lo-fi loop', icon: '🎧', price: 32000, desc: 'Plays while you are on the field (only you hear it)', look: { mode: 'pad', bpm: 78, type: 'triangle', vol: .035, steps: 8, chords: [[262, 330, 392, 494], [220, 262, 330, 392], [175, 220, 262, 330], [196, 247, 294, 349]], bass: [65, 55, 44, 49], lp: 1400 } },
    { id: 'music_synth', cat: 'music', name: 'Synthwave', icon: '🌆', price: 44000, desc: 'Night drive (only you hear it)', look: { mode: 'arp', bpm: 104, type: 'sawtooth', vol: .018, steps: 16, chords: [[220, 262, 330], [175, 220, 262], [262, 330, 392], [196, 247, 294]], bass: [110, 87, 131, 98], lp: 1800 } },
    { id: 'music_spooky', cat: 'music', name: 'Spooky', icon: '🦇', price: 36000, desc: 'Haunted field (only you hear it)', look: { mode: 'pad', bpm: 60, type: 'triangle', vol: .035, steps: 8, chords: [[294, 349, 440], [233, 294, 349], [196, 233, 294], [220, 277, 330]], bass: [73, 58, 49, 55], lp: 900 } },
    { id: 'music_happy', cat: 'music', name: 'Happy hop', icon: '🐰', price: 28000, desc: 'Bouncy and cheerful (only you hear it)', look: { mode: 'arp', bpm: 150, type: 'square', vol: .025, steps: 16, chords: [[262, 330, 392], [196, 247, 294], [220, 262, 330], [175, 220, 262]], bass: [131, 98, 110, 87] } },
    { id: 'music_lounge', cat: 'music', name: 'Casino lounge', icon: '🍸', price: 52000, desc: 'Smooth jazz chords (only you hear it)', look: { mode: 'pad', bpm: 90, type: 'sine', vol: .04, steps: 8, chords: [[262, 330, 392, 494], [220, 262, 330, 392], [294, 349, 440, 523], [196, 247, 294, 349]], bass: [65, 55, 73, 49], lp: 2200 } },
    // Kurz (3.1–3.3) gratis und ab Werk angelegt, seit 3.4 normal im Shop (Max).
    // I–V–vi–IV, Beat, pumpender Bass, Offbeat-Akkorde, Ohrwurm-Melodie.
    {
        id: 'music_sunny', cat: 'music', name: 'Sunny pop', icon: '☀️', price: 36000, desc: 'Happy upbeat pop (only you hear it)',
        look: {
            mode: 'pop', bpm: 112, vol: .02, steps: 8,
            // C – G – Am – F, zweimal
            chords: [[262, 330, 392], [247, 294, 392], [262, 330, 440], [262, 349, 440],
                [262, 330, 392], [247, 294, 392], [262, 330, 440], [262, 349, 440]],
            bass: [131, 98, 110, 87, 131, 98, 110, 87],
            // Melodie in Achteln, 0 = Pause (eine Zeile je Takt)
            mel: [659, 784, 659, 784, 880, 784, 659, 0,
                587, 587, 0, 494, 587, 784, 0, 0,
                523, 659, 880, 784, 659, 0, 523, 0,
                523, 587, 659, 0, 698, 659, 587, 0,
                659, 784, 1047, 0, 988, 880, 784, 0,
                784, 880, 784, 587, 0, 494, 587, 0,
                880, 784, 659, 523, 659, 0, 784, 0,
                698, 659, 587, 523, 0, 0, 523, 0]
        }
    },
    { id: 'music_boss', cat: 'music', name: 'Boss fight', icon: '👹', price: 60000, desc: 'Final level energy (only you hear it)', look: { mode: 'arp', bpm: 170, type: 'square', vol: .025, steps: 16, chords: [[330, 392, 494], [262, 330, 392], [294, 370, 440], [247, 311, 370]], bass: [82, 65, 73, 62] } }
];

for (const it of ITEMS) {
    let r = RARITIES[0];
    for (const x of RARITIES) if (it.price >= x.min) r = x;
    it.rarity = r.id;
}

const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
// Gehoert jedem, ohne im Inventar zu stehen (free: true); DEFAULTS ist ab Werk
// angelegt, bis man es ablegt. Beides derzeit leer (Standard-Musik 3.4 entfernt)
const FREE = ITEMS.filter(i => i.free).map(i => i.id);
const DEFAULTS = {};

// Was andere sehen (kompakt fuer den Zustand): Kategorie -> Item-Id, ohne Musik
function visible(equipped) {
    const out = {};
    for (const [cat, id] of Object.entries(equipped || {})) {
        if (cat !== 'music' && BY_ID[id]) out[cat] = id;
    }
    return Object.keys(out).length ? out : null;
}

// ---------- Rotation ----------

function berlin(now) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short'
    }).formatToParts(new Date(now)).map(p => [p.type, p.value]));
    return {
        day: `${parts.year}-${parts.month}-${parts.day}`,
        secs: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
        wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday)
    };
}

function weekId(day) {
    const d = new Date(day + 'T12:00:00Z');
    const wd = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - wd + 3);
    const y = d.getUTCFullYear();
    const first = new Date(Date.UTC(y, 0, 4));
    const w = 1 + Math.round(((d - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
    return `${y}-W${String(w).padStart(2, '0')}`;
}

// Zufall aus einem Text (fuer alle gleich)
function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return () => {
        h = (h + 0x6D2B79F5) | 0;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pick(rng, list, n, taken) {
    const pool = list.filter(it => !taken.has(it.id));
    const out = [];
    while (out.length < n && pool.length) {
        const it = pool.splice(Math.floor(rng() * pool.length), 1)[0];
        taken.add(it.id);
        out.push(it.id);
    }
    return out;
}

const cache = { key: null, value: null };

// { day: {id, ids, ends}, week: {id, ids, ends} }, ends = Zeitpunkt (ms)
function rotation(now = Date.now()) {
    const b = berlin(now);
    if (cache.key !== b.day) {
        const week = weekId(b.day);
        const taken = new Set();
        // Weekly: ein Legendary-Skin + drei weitere Epic/Legendary
        const wr = seeded('W' + week);
        const premium = ITEMS.filter(it => !it.free && (it.rarity === 'epic' || it.rarity === 'legendary'));
        const weekIds = [
            ...pick(wr, premium.filter(it => it.cat === 'skin' && it.rarity === 'legendary'), 1, taken),
            ...pick(wr, premium, 3, taken)
        ];
        // Daily: 2 Skins, 2 Koepfe, Trail, Tod, Name, dazu ein beliebiges (ohne Legendary)
        const dr = seeded('D' + b.day);
        const daily = ITEMS.filter(it => !it.free && it.rarity !== 'legendary');
        const of = cat => daily.filter(it => it.cat === cat);
        const dayIds = [
            ...pick(dr, of('skin'), 2, taken), ...pick(dr, of('head'), 2, taken),
            ...pick(dr, of('trail'), 1, taken), ...pick(dr, of('death'), 1, taken),
            ...pick(dr, of('name'), 1, taken), ...pick(dr, daily, 1, taken)
        ];
        cache.key = b.day;
        cache.value = { dayId: b.day, weekId: week, dayIds, weekIds };
    }
    const endDay = now + (86400 - b.secs) * 1000;
    return {
        day: { id: cache.value.dayId, ids: cache.value.dayIds, ends: endDay },
        week: { id: cache.value.weekId, ids: cache.value.weekIds, ends: endDay + (6 - b.wd) * 864e5 }
    };
}

function inRotation(id, now) {
    const r = rotation(now);
    return r.day.ids.includes(id) || r.week.ids.includes(id);
}

module.exports = { CATS, RARITIES, ITEMS, BY_ID, FREE, DEFAULTS, visible, rotation, inRotation };

// Nachsehen: node shop.js [Tage] – Rotation der naechsten Tage
if (require.main === module) {
    const days = Number(process.argv[2]) || 7;
    const count = {};
    for (let d = 0; d < days; d++) {
        cache.key = null;
        const r = rotation(Date.now() + d * 864e5);
        if (days <= 14) console.log(r.day.id, r.week.id, '| daily:', r.day.ids.join(' '), '| weekly:', r.week.ids.join(' '));
        for (const id of [...r.day.ids, ...r.week.ids]) count[id] = (count[id] || 0) + 1;
    }
    const never = ITEMS.filter(it => !count[it.id]).map(it => it.id);
    console.log(ITEMS.length, 'items,', Object.keys(count).length, 'seen in', days, 'days; never:', never.length ? never.join(' ') : '-');
}
