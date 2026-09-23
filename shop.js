// Shop (#9): Kosmetik fuer Coins. Rein optisch, kein Spielvorteil.
// Gekauftes liegt im Konto (u.inventory), angelegt ist je Kategorie
// hoechstens ein Teil (u.equipped). Andere Spieler sehen Skin, Kopf, Trail,
// Namensfarbe und Todes-Effekt; Musik hoert nur man selbst.
// Die Preise sind die Coin-Senke fuer die Wirtschaft (#11).

const CATS = {
    skin: 'Snake skins',
    head: 'Heads',
    trail: 'Trails',
    death: 'Death effects',
    name: 'Name colors',
    music: 'Music'
};

const ITEMS = [
    { id: 'skin_gradient', cat: 'skin', name: 'Gradient', icon: '🌈', price: 4000, desc: 'Your color fades towards the tail' },
    { id: 'skin_stripes', cat: 'skin', name: 'Stripes', icon: '🦓', price: 5000, desc: 'Every third segment in white' },
    { id: 'skin_candy', cat: 'skin', name: 'Candy', icon: '🍬', price: 6000, desc: 'Pink and white candy cane' },
    { id: 'skin_neon', cat: 'skin', name: 'Neon', icon: '💡', price: 8000, desc: 'Glowing outline in your color' },
    { id: 'skin_rainbow', cat: 'skin', name: 'Rainbow', icon: '🏳️‍🌈', price: 15000, desc: 'Moving rainbow along the body' },
    { id: 'skin_galaxy', cat: 'skin', name: 'Galaxy', icon: '🌌', price: 20000, desc: 'Deep space with twinkling stars' },
    { id: 'skin_gold', cat: 'skin', name: 'Solid Gold', icon: '🥇', price: 25000, desc: 'Shiny gold with a running glint' },

    { id: 'head_cool', cat: 'head', name: 'Cool', icon: '😎', price: 2000 },
    { id: 'head_alien', cat: 'head', name: 'Alien', icon: '👽', price: 3000 },
    { id: 'head_robot', cat: 'head', name: 'Robot', icon: '🤖', price: 3000 },
    { id: 'head_skull', cat: 'head', name: 'Skull', icon: '💀', price: 4000 },
    { id: 'head_fire', cat: 'head', name: 'On fire', icon: '🔥', price: 6000 },
    { id: 'head_dragon', cat: 'head', name: 'Dragon', icon: '🐉', price: 8000 },
    { id: 'head_crown', cat: 'head', name: 'Crown', icon: '👑', price: 12000 },

    { id: 'trail_bubbles', cat: 'trail', name: 'Bubbles', icon: '🫧', price: 5000 },
    { id: 'trail_hearts', cat: 'trail', name: 'Hearts', icon: '💖', price: 6000 },
    { id: 'trail_sparkles', cat: 'trail', name: 'Sparkles', icon: '✨', price: 7000 },
    { id: 'trail_fire', cat: 'trail', name: 'Fire', icon: '🔥', price: 9000 },

    { id: 'death_ghost', cat: 'death', name: 'Ghost', icon: '👻', price: 4000, desc: 'A ghost floats up where you die' },
    { id: 'death_confetti', cat: 'death', name: 'Confetti', icon: '🎉', price: 5000, desc: 'Confetti burst for everyone to see' },
    { id: 'death_boom', cat: 'death', name: 'Explosion', icon: '💥', price: 7000, desc: 'Big boom with a shockwave' },

    { id: 'name_gold', cat: 'name', name: 'Gold name', icon: '🟡', price: 3000, desc: 'On the field and in the chat' },
    { id: 'name_ice', cat: 'name', name: 'Ice name', icon: '🧊', price: 3000, desc: 'On the field and in the chat' },
    { id: 'name_rainbow', cat: 'name', name: 'Rainbow name', icon: '🌈', price: 8000, desc: 'On the field and in the chat' },

    { id: 'music_chip', cat: 'music', name: 'Chiptune loop', icon: '🎮', price: 8000, desc: 'Plays while you are on the field (only you hear it)' },
    { id: 'music_lofi', cat: 'music', name: 'Lo-fi loop', icon: '🎧', price: 8000, desc: 'Plays while you are on the field (only you hear it)' }
];

const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// Was andere sehen (kompakt fuer den Zustand): Kategorie -> Item-Id, ohne Musik
function visible(equipped) {
    const out = {};
    for (const [cat, id] of Object.entries(equipped || {})) {
        if (cat !== 'music' && BY_ID[id]) out[cat] = id;
    }
    return Object.keys(out).length ? out : null;
}

module.exports = { CATS, ITEMS, BY_ID, visible };
