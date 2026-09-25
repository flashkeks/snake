// Achievements (#3): werden aus der Statistik (#5) und dem Konto abgeleitet.
// accounts.js prueft sie nach jeder Aenderung der Statistik; neu erreichte
// landen in u.achievements { id: Zeitpunkt }. Viele geben einen Titel, den
// man im Konto-Dialog anlegen kann (u.title = Achievement-Id). Der Titel steht
// dann neben dem Namen: Feld, Spielerliste, Bestenliste, Chat, Tische.
//
// check(u, s): u = Konto, s = u.stats (vollstaendig, siehe newStats)

const L = require('./arena-level');
const K = require('./cards');
const { GYM_IDS } = require('./km-gyms');

const g = (s, name) => (s.games || {})[name] || {};
// Arena-Zustand liegt am Konto, nicht in der Statistik
const ar = u => u.arena || {};
const arenaLevel = u => ar(u).prog ? L.levelOf(ar(u).prog.xp || 0).level : 1;
const zomb = u => ar(u).zombies || {};
const pvp = u => ar(u).pvp || {};
// Kekemon: verschiedene Karten (egal welche Variante), Varianten im Besitz
const ownedKeys = u => Object.keys(u.cards || {}).filter(k => u.cards[k] > 0);
const distinctCards = u => new Set(ownedKeys(u).map(k => K.parseKey(k).id)).size;
const hasVariant = (u, ch) => ownedKeys(u).some(k => (K.parseKey(k).v || '').includes(ch));
const gymsCleared = u => GYM_IDS.filter(id => ((u.kmGyms || {})[id] || {}).cleared).length;
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
    // 25.09.2026 (Max: mehr Achievements, Titel fuer den neuen Kram)
    { id: 'kills_500', icon: '🦈', name: 'Apex predator', desc: '500 kills', title: 'Apex Predator', check: (u, s) => s.kills >= 500 },
    { id: 'kills_2500', icon: '👑', name: 'Snake god', desc: '2,500 kills', title: 'Snake God', check: (u, s) => s.kills >= 2500 },
    { id: 'streak_25', icon: '⚡', name: 'Godlike', desc: '25 kills without dying', title: 'Godlike', check: (u, s) => (s.bestStreak || 0) >= 25 },
    { id: 'score_100k', icon: '🌍', name: 'World serpent', desc: 'Score 100,000 in one life', title: 'Jörmungandr', check: (u, s) => s.bestScore >= 100000 },
    { id: 'cashout_50k', icon: '🏦', name: 'Vault', desc: 'Cash out more than 50,000 at once', title: 'The Vault', check: (u, s) => s.bestCashout > 50000 },
    { id: 'deaths_1000', icon: '🧪', name: 'Crash test dummy', desc: 'Die 1,000 times', title: 'Crash Test Dummy', check: (u, s) => s.deaths >= 1000 },
    { id: 'hours_50', icon: '🌱', name: 'Touch grass', desc: '50 hours on the snake field', title: 'Grass Toucher', check: (u, s) => s.playMs >= 50 * 3600e3 },

    // Events
    { id: 'event_win', icon: '🎪', name: 'Crowd pleaser', desc: 'Win an event', check: (u, s) => s.eventWins >= 1 },
    { id: 'event_win_10', icon: '🧠', name: 'Quiz master', desc: 'Win 10 events', title: 'Quiz Master', check: (u, s) => s.eventWins >= 10 },
    { id: 'event_play_50', icon: '🥳', name: 'Party animal', desc: 'Take part in 50 events', title: 'Party Animal', check: (u, s) => (s.eventsPlayed || 0) >= 50 },
    { id: 'event_win_50', icon: '🏆', name: 'Champion', desc: 'Win 50 events', title: 'Champion', check: (u, s) => s.eventWins >= 50 },

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
    { id: 'tycoon', icon: '🏝️', name: 'Tycoon', desc: 'Hold 10,000,000 coins', title: 'Tycoon', check: u => u.coins >= 10000000 },
    { id: 'daily_30', icon: '📅', name: 'Devoted', desc: 'Spin the Daily Wheel 30 days in a row', title: 'Devoted', check: (u, s) => (s.dailyBestStreak || 0) >= 30 },
    { id: 'win_100k', icon: '💎', name: 'Jackpot', desc: 'Win 100,000 in a single round', title: 'Jackpot', check: (u, s) => (s.biggestWin || 0) >= 100000 },
    { id: 'win_1m', icon: '🐋', name: 'Whale', desc: 'Win 1,000,000 in a single round', title: 'Whale', check: (u, s) => (s.biggestWin || 0) >= 1000000 },
    { id: 'degen_10k', icon: '🎲', name: 'Casino addict', desc: '10,000 casino rounds', title: 'Casino Addict', check: (u, s) => casinoPlays(s) >= 10000 },
    { id: 'don_100', icon: '🪙', name: 'Double trouble', desc: 'Play Double or Nothing 100 times', title: 'Double Trouble', check: (u, s) => (g(s, 'don').plays || 0) >= 100 },
    { id: 'roulette_500', icon: '🎡', name: 'Red or black', desc: 'Play 500 rounds of roulette', title: 'Croupier', check: (u, s) => (g(s, 'roulette').plays || 0) >= 500 },
    { id: 'slots_100x', icon: '🍒', name: 'Cherry bomb', desc: 'Win 100× on the slots', title: 'Cherry Bomb', check: (u, s) => (g(s, 'slots').bestX || 0) >= 100 },
    { id: 'spender_1m', icon: '🛍️', name: 'Big spender', desc: 'Spend 1,000,000 coins in the shop', title: 'Big Spender', check: (u, s) => (s.shopSpent || 0) >= 1000000 },

    // Arena
    { id: 'arena_kill', icon: '🔫', name: 'Trigger happy', desc: 'Get a kill in the arena', check: (u, s) => (s.shooterKills || 0) >= 1 },
    { id: 'arena_kills_50', icon: '🎯', name: 'Gunslinger', desc: '50 kills in the arena', title: 'Gunslinger', check: (u, s) => (s.shooterKills || 0) >= 50 },
    { id: 'arena_extract', icon: '🚁', name: 'Survivor', desc: 'Extract from a raid', title: 'Survivor', check: (u, s) => (s.arenaExtracts || 0) >= 1 },
    { id: 'arena_extract_25', icon: '🏴‍☠️', name: 'Raider', desc: 'Extract 25 times', title: 'Raider', check: (u, s) => (s.arenaExtracts || 0) >= 25 },
    { id: 'arena_legendary', icon: '🌟', name: 'Loot goblin', desc: 'Own a Legendary item', title: 'Loot Goblin', check: (u, s) => (s.bestTier || 0) >= 4 },
    { id: 'arena_mythic', icon: '🔴', name: 'Mythical', desc: 'Own a Mythic item', title: 'Myth', check: (u, s) => (s.bestTier || 0) >= 5 },
    { id: 'arena_ultra', icon: '✦', name: 'One in a million', desc: 'Own an Ultra rare item', title: 'Chosen One', check: (u, s) => (s.bestTier || 0) >= 6 },
    { id: 'arena_kills_500', icon: '💀', name: 'Warlord', desc: '500 kills in the arena', title: 'Warlord', check: (u, s) => (s.shooterKills || 0) >= 500 },
    { id: 'npc_1000', icon: '🧹', name: 'Exterminator', desc: 'Kill 1,000 enemies in raids', title: 'Exterminator', check: (u, s) => (s.npcKills || 0) >= 1000 },
    { id: 'boss_1', icon: '🐲', name: 'Boss slayer', desc: 'Land the killing blow on a raid boss', title: 'Boss Slayer', check: (u, s) => (s.bossKills || 0) >= 1 },
    { id: 'boss_25', icon: '⚔️', name: 'Kingslayer', desc: 'Kill 25 raid bosses', title: 'Kingslayer', check: (u, s) => (s.bossKills || 0) >= 25 },
    { id: 'raids_100', icon: '🎖️', name: 'Veteran', desc: 'Go on 100 raids', title: 'Veteran', check: (u, s) => (s.raids || 0) >= 100 },
    { id: 'arena_extract_100', icon: '👻', name: 'Ghost', desc: 'Extract 100 times', title: 'Ghost', check: (u, s) => (s.arenaExtracts || 0) >= 100 },
    { id: 'cases_100', icon: '📦', name: 'Case addict', desc: 'Open 100 cases', title: 'Case Addict', check: (u, s) => (s.casesOpened || 0) >= 100 },
    { id: 'case_wheel_30', icon: '🎠', name: 'Spin doctor', desc: 'Spin the Daily Case Wheel 30 times', check: (u, s) => (s.caseWheels || 0) >= 30 },
    { id: 'odds_1m', icon: '🪡', name: 'Needle in a haystack', desc: 'Own an item rarer than 1 in 1,000,000', title: 'The Needle', check: (u, s) => (s.bestOdds || 0) >= 1000000 },
    { id: 'arena_lvl_25', icon: '🥉', name: 'Seasoned', desc: 'Reach arena level 25', title: 'Seasoned', check: u => arenaLevel(u) >= 25 },
    { id: 'arena_lvl_50', icon: '🥈', name: 'Elite', desc: 'Reach arena level 50', title: 'Elite', check: u => arenaLevel(u) >= 50 },
    { id: 'arena_lvl_100', icon: '🥇', name: 'Maxed out', desc: 'Reach arena level 100', title: 'Maxed Out', check: u => arenaLevel(u) >= 100 },
    { id: 'fuse_1', icon: '⚗️', name: 'Alchemist', desc: 'Fuse an item', title: 'Alchemist', check: (u, s) => (s.fuses || 0) >= 1 },
    { id: 'fuse_100', icon: '🔨', name: 'Blacksmith', desc: 'Fuse 100 items into others', title: 'Master Smith', check: (u, s) => (s.fuses || 0) >= 100 },
    { id: 'fuse_max', icon: '💯', name: 'Perfectionist', desc: 'Fuse an effect up to its max level', title: 'Perfectionist', check: (u, s) => (s.fuseMaxed || 0) >= 1 },

    // Zombies und PvP
    { id: 'zombie_10', icon: '🧟', name: 'Zombie slayer', desc: 'Reach wave 10 in Zombies (not Easy)', title: 'Zombie Slayer', check: u => (zomb(u).bestWave || 0) >= 10 },
    { id: 'zombie_25', icon: '🧠', name: 'Last one standing', desc: 'Reach wave 25 in Zombies (not Easy)', title: 'Last Survivor', check: u => (zomb(u).bestWave || 0) >= 25 },
    { id: 'zombie_50', icon: '☣️', name: 'Undying', desc: 'Reach wave 50 in Zombies (not Easy)', title: 'Undying', check: u => (zomb(u).bestWave || 0) >= 50 },
    { id: 'zombie_kills_1000', icon: '🪓', name: 'Zombie hunter', desc: 'Kill 1,000 zombies', title: 'Zombie Hunter', check: u => (zomb(u).kills || 0) >= 1000 },
    { id: 'pvp_win', icon: '🤺', name: 'First duel', desc: 'Win a PvP match', check: u => (pvp(u).wins || 0) >= 1 },
    { id: 'pvp_25', icon: '🛡️', name: 'Gladiator', desc: 'Win 25 PvP matches', title: 'Gladiator', check: u => (pvp(u).wins || 0) >= 25 },
    { id: 'pvp_1500', icon: '🏟️', name: 'Pit champion', desc: 'Reach a PvP rating of 1,500', title: 'Pit Champion', check: u => (pvp(u).rating || 0) >= 1500 },

    // Markt und Handel
    { id: 'market_sell_10', icon: '🏪', name: 'Merchant', desc: 'Sell 10 things on the market', title: 'Merchant', check: (u, s) => (s.mkSold || 0) >= 10 },
    { id: 'market_sell_100', icon: '📈', name: 'Market mogul', desc: 'Sell 100 things on the market', title: 'Market Mogul', check: (u, s) => (s.mkSold || 0) >= 100 },
    { id: 'market_buy_10', icon: '🧺', name: 'Bargain hunter', desc: 'Buy 10 things on the market', check: (u, s) => (s.mkBought || 0) >= 10 },
    { id: 'trade_10', icon: '🤝', name: 'Dealer', desc: 'Complete 10 trades with other players', title: 'Dealer', check: (u, s) => (s.trades || 0) >= 10 },

    // Kekemon
    { id: 'km_pack', icon: '🎴', name: 'Booster', desc: 'Open a Kekemon pack', check: (u, s) => (s.packs || 0) >= 1 },
    { id: 'km_packs_100', icon: '🐀', name: 'Pack rat', desc: 'Open 100 Kekemon packs', title: 'Pack Rat', check: (u, s) => (s.packs || 0) >= 100 },
    { id: 'km_cards_50', icon: '📚', name: 'Collector', desc: 'Own 50 different Kekemon', title: 'Collector', check: u => distinctCards(u) >= 50 },
    { id: 'km_cards_200', icon: '📖', name: 'Kekedex', desc: 'Own 200 different Kekemon', title: 'Kekedex Master', check: u => distinctCards(u) >= 200 },
    { id: 'km_shiny', icon: '✨', name: 'Shiny hunter', desc: 'Own a Shiny card', title: 'Shiny Hunter', check: u => hasVariant(u, 's') },
    { id: 'km_master', icon: '🟣', name: 'Master ball', desc: 'Own a Masterball card', title: 'Ball Master', check: u => hasVariant(u, 'm') },
    { id: 'km_gym_1', icon: '🏅', name: 'First badge', desc: 'Clear a Kekemon gym', check: u => gymsCleared(u) >= 1 },
    { id: 'km_gym_8', icon: '🎗️', name: 'Badge collector', desc: 'Clear 8 Kekemon gyms', title: 'Gym Hopper', check: u => gymsCleared(u) >= 8 },
    { id: 'km_gym_all', icon: '🏆', name: 'Kekemon master', desc: 'Clear every Kekemon gym', title: 'Kekemon Master', check: u => gymsCleared(u) >= GYM_IDS.length },
    { id: 'km_wins_100', icon: '🎓', name: 'Trainer', desc: 'Win 100 gym battles', title: 'Trainer', check: (u, s) => (s.kmWins || 0) >= 100 },
    { id: 'km_duels_10', icon: '🥊', name: 'Card duelist', desc: 'Win 10 Kekemon duels against players', title: 'Duelist', check: (u, s) => (s.kmDuelWins || 0) >= 10 },
    { id: 'km_fed_100', icon: '🍖', name: 'Caretaker', desc: 'Feed 100 cards to your Kekemon', check: (u, s) => (s.kmFed || 0) >= 100 },

    // Drumherum
    { id: 'tickets_10', icon: '📝', name: 'Critic', desc: 'Open 10 support tickets', title: 'Critic', check: (u, s) => (s.ticketsCreated || 0) >= 10 },
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
