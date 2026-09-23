// Achievements (#3): werden aus der Statistik (#5) und dem Konto abgeleitet.
// accounts.js prueft sie nach jeder Aenderung der Statistik; neu erreichte
// landen in u.achievements { id: Zeitpunkt }. Viele geben einen Titel, den
// man im Konto-Dialog anlegen kann (u.title = Achievement-Id). Der Titel steht
// dann neben dem Namen: Feld, Spielerliste, Bestenliste, Chat, Tische.
//
// check(u, s): u = Konto, s = u.stats (vollstaendig, siehe newStats)

const g = (s, name) => (s.games || {})[name] || {};
const casinoPlays = s => ['slots', 'starlight', 'crossy', 'plinko', 'blackjack', 'roulette', 'poker']
    .reduce((n, k) => n + (g(s, k).plays || 0), 0);

const LIST = [
    // Snake
    { id: 'first_kill', icon: '🗡️', name: 'First blood', desc: 'Kill another snake', title: 'Hunter', check: (u, s) => s.kills >= 1 },
    { id: 'kills_100', icon: '☠️', name: 'Serial snake', desc: '100 kills', title: 'Serial Snake', check: (u, s) => s.kills >= 100 },
    { id: 'streak_10', icon: '🔥', name: 'Unstoppable', desc: '10 kills without dying', title: 'Unstoppable', check: (u, s) => (s.bestStreak || 0) >= 10 },
    { id: 'score_10k', icon: '🐍', name: 'Big snake', desc: 'Score 10,000 in one life', title: 'Big Snake', check: (u, s) => s.bestScore >= 10000 },
    { id: 'score_50k', icon: '🐉', name: 'Titanoboa', desc: 'Score 50,000 in one life', title: 'Titanoboa', check: (u, s) => s.bestScore >= 50000 },
    { id: 'cashout_5k', icon: '💰', name: 'Banker', desc: 'Cash out more than 5,000 at once', title: 'Banker', check: (u, s) => s.bestCashout > 5000 },
    { id: 'deaths_100', icon: '💥', name: 'Kamikaze', desc: 'Die 100 times', title: 'Kamikaze', check: (u, s) => s.deaths >= 100 },
    { id: 'hours_10', icon: '⏰', name: 'No life', desc: '10 hours on the snake field', title: 'No Life', check: (u, s) => s.playMs >= 10 * 3600e3 },

    // Events
    { id: 'event_win', icon: '🎪', name: 'Crowd pleaser', desc: 'Win an event', check: (u, s) => s.eventWins >= 1 },
    { id: 'event_win_10', icon: '🧠', name: 'Quiz master', desc: 'Win 10 events', title: 'Quiz Master', check: (u, s) => s.eventWins >= 10 },

    // Casino
    { id: 'daily_7', icon: '🎁', name: 'Regular', desc: 'Spin the Daily Wheel 7 days in a row', title: 'Regular', check: (u, s) => (s.dailyBestStreak || 0) >= 7 },
    { id: 'starlight_1000x', icon: '🌟', name: 'Lucky star', desc: 'Win 1,000× on Budget Starlight', title: 'Lucky Star', check: (u, s) => (g(s, 'starlight').bestX || 0) >= 1000 },
    { id: 'starlight_max', icon: '🌠', name: 'Max win', desc: 'Hit the 100,000× max win on Budget Starlight', title: 'Starlight Legend', check: (u, s) => (g(s, 'starlight').bestX || 0) >= 100000 },
    { id: 'plinko_1000x', icon: '🔻', name: 'Plinko god', desc: 'Land the ×1000 on Plinko', title: 'Plinko God', check: (u, s) => (g(s, 'plinko').bestX || 0) >= 1000 },
    { id: 'crossy_hardcore', icon: '🐔', name: 'Chicken legend', desc: 'Cross all lanes on Hardcore', title: 'Chicken Legend', check: (u, s) => (s.crossyHardcoreWins || 0) >= 1 },
    { id: 'poker_pot_10k', icon: '♠️', name: 'High roller', desc: 'Win a 10,000 pot at poker', title: 'High Roller', check: (u, s) => (g(s, 'poker').bestWin || 0) >= 10000 },
    { id: 'blackjack_100', icon: '🃏', name: 'Card counter', desc: 'Play 100 hands of blackjack', check: (u, s) => (g(s, 'blackjack').plays || 0) >= 100 },
    { id: 'degen', icon: '🎰', name: 'Degen', desc: '1,000 casino rounds', title: 'Degen', check: (u, s) => casinoPlays(s) >= 1000 },
    { id: 'millionaire', icon: '🤑', name: 'Millionaire', desc: 'Hold 1,000,000 coins', title: 'Millionaire', check: u => u.coins >= 1000000 },

    // Arena
    { id: 'arena_kill', icon: '🔫', name: 'Trigger happy', desc: 'Get a kill in the arena', check: (u, s) => (s.shooterKills || 0) >= 1 },
    { id: 'arena_kills_50', icon: '🎯', name: 'Gunslinger', desc: '50 kills in the arena', title: 'Gunslinger', check: (u, s) => (s.shooterKills || 0) >= 50 },
    { id: 'arena_extract', icon: '🚁', name: 'Survivor', desc: 'Extract from a raid', title: 'Survivor', check: (u, s) => (s.arenaExtracts || 0) >= 1 },
    { id: 'arena_extract_25', icon: '🏴‍☠️', name: 'Raider', desc: 'Extract 25 times', title: 'Raider', check: (u, s) => (s.arenaExtracts || 0) >= 25 },
    { id: 'arena_legendary', icon: '🌟', name: 'Loot goblin', desc: 'Own a Legendary item (1 in 5,000)', title: 'Loot Goblin', check: (u, s) => (s.bestOdds || 0) >= 5000 },
    { id: 'arena_ultra', icon: '✦', name: 'One in a million', desc: 'Own a one-in-a-million item', title: 'Chosen One', check: (u, s) => (s.bestOdds || 0) >= 1000000 },

    // Drumherum
    { id: 'first_ticket', icon: '💬', name: 'Feedback', desc: 'Open your first support ticket', check: (u, s) => (s.ticketsCreated || 0) >= 1 },
    { id: 'shopper', icon: '🛒', name: 'Shopper', desc: 'Buy something in the shop', check: u => (u.inventory || []).length >= 1 },
    { id: 'fashionista', icon: '👗', name: 'Fashionista', desc: 'Own the 7 classic skins (Gradient to Solid Gold)', title: 'Fashionista', check: u => ['skin_gradient', 'skin_stripes', 'skin_candy', 'skin_neon', 'skin_rainbow', 'skin_galaxy', 'skin_gold'].every(id => (u.inventory || []).includes(id)) }
];

const BY_ID = Object.fromEntries(LIST.map(a => [a.id, a]));

// Neu erreichte Achievements eines Kontos (ohne sie zu speichern)
function fresh(u) {
    const have = u.achievements || {};
    const s = u.stats || {};
    return LIST.filter(a => !have[a.id] && a.check(u, s));
}

// Titeltext eines Kontos oder null
function titleOf(u) {
    const a = u && u.title && BY_ID[u.title];
    return a && a.title && (u.achievements || {})[a.id] ? a.title : null;
}

// Fuer den Browser (ohne Pruef-Funktionen)
function catalog() {
    return LIST.map(({ id, icon, name, desc, title }) => ({ id, icon, name, desc, title: title || null }));
}

module.exports = { LIST, BY_ID, fresh, titleOf, catalog };
