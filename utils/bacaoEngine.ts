/**
 * Bài Cào 3 Lá Engine - Xử lý logic trò chơi bài cào
 * Còn gọi là: Tay 3 lá, 3 cây, Ba cào
 * 
 * Luật chơi:
 * - Mỗi người chơi được chia 3 lá bài
 * - Tính điểm: J, Q, K, 10 = 0 điểm, các lá còn lại = giá trị số (Ách = 1)
 * - Tổng điểm = (Tổng điểm 3 lá) % 10
 * - Ai có điểm cao hơn thắng
 * - Trường hợp đặc biệt:
 *   + Sáp: 3 lá giống nhau về số → Thắng tất cả
 *   + Liêng: 3 lá liên tiếp cùng chất → Thắng sáp
 *   + Bạch thủ: 3 lá đều không phải J, Q, K, 10 và tổng < 10
 */

// ================== TYPES & INTERFACES ==================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
    suit: Suit;
    rank: Rank;
}

export interface Hand {
    cards: Card[];
    score: number;
    handType: HandType;
}

export interface BaCaoPlayer {
    id: string;
    name: string;
    hand: Hand | null;
    isRevealed: boolean;
    isReady: boolean;
    currentBet: number;    // Số xu đã cược trong ván này
    hasFolded: boolean;    // Đã bỏ bài chưa
    hasCalledRaise: boolean; // Đã theo cược mới nhất chưa
    hasActedThisRound: boolean; // Đã hành động trong vòng cược này chưa (raise/call/fold/reveal)
}

export interface BaCaoGame {
    id: string;
    guildId: string;
    channelId: string;
    hostId: string;
    hostName: string;
    players: BaCaoPlayer[];
    deck: Card[];
    status: 'waiting' | 'playing' | 'revealing' | 'finished';
    winnerId: string | null;
    winnerName: string | null;
    betAmount: number;      // Mức cược ban đầu
    currentRaise: number;   // Mức cược hiện tại (có thể tăng sau raise)
    raiseById: string | null;     // Người vừa raise
    raiseByName: string | null;
    totalPot: number;       // Tổng tiền trong pot
    bettingRound: number;   // Vòng cược hiện tại (0 = chưa bắt đầu, 1 = vòng 1...)
    createdAt: Date;
}

export enum HandType {
    LIEN = 4,      // 3 lá liên tiếp cùng chất (cao nhất)
    SAP = 3,       // 3 lá giống nhau về số
    BACH_THU = 2,  // 3 lá J/Q/K và tổng = 0
    NORMAL = 1     // Bài thường
}

// ================== CONSTANTS ==================

// Emoji cho các chất bài
export const SUIT_EMOJI: Record<Suit, string> = {
    hearts: '♥️',
    diamonds: '♦️',
    clubs: '♣️',
    spades: '♠️'
};

// Emoji màu cho các chất (đỏ/đen)
export const SUIT_COLOR: Record<Suit, 'red' | 'black'> = {
    hearts: 'red',
    diamonds: 'red',
    clubs: 'black',
    spades: 'black'
};

// Giá trị điểm của từng lá
export const RANK_VALUES: Record<Rank, number> = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5,
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 0,
    'J': 0, 'Q': 0, 'K': 0
};

// Thứ tự rank để kiểm tra liên tiếp
const RANK_ORDER: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Tất cả các chất bài
const ALL_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

// ================== DECK FUNCTIONS ==================

/**
 * Tạo bộ bài 52 lá
 */
export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of ALL_SUITS) {
        for (const rank of RANK_ORDER) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}

/**
 * Xáo trộn bài (Fisher-Yates shuffle)
 */
export function shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Chia 3 lá bài từ bộ bài
 */
export function dealCards(deck: Card[], count: number = 3): { cards: Card[], remainingDeck: Card[] } {
    const cards = deck.slice(0, count);
    const remainingDeck = deck.slice(count);
    return { cards, remainingDeck };
}

// ================== SCORING FUNCTIONS ==================

/**
 * Tính điểm của 3 lá bài
 */
export function calculateScore(cards: Card[]): number {
    const total = cards.reduce((sum, card) => sum + RANK_VALUES[card.rank], 0);
    return total % 10;
}

/**
 * Kiểm tra có phải Sáp (3 lá cùng số) không
 */
export function isSap(cards: Card[]): boolean {
    if (cards.length !== 3) return false;
    return cards[0].rank === cards[1].rank && cards[1].rank === cards[2].rank;
}

/**
 * Kiểm tra có phải Liêng (3 lá liên tiếp cùng chất) không
 */
export function isLien(cards: Card[]): boolean {
    if (cards.length !== 3) return false;
    
    // Phải cùng chất
    if (cards[0].suit !== cards[1].suit || cards[1].suit !== cards[2].suit) {
        return false;
    }
    
    // Lấy index của các rank
    const indices = cards.map(c => RANK_ORDER.indexOf(c.rank)).sort((a, b) => a - b);
    
    // Kiểm tra liên tiếp
    if (indices[1] - indices[0] === 1 && indices[2] - indices[1] === 1) {
        return true;
    }
    
    // Trường hợp đặc biệt: Q-K-A
    if (indices[0] === 0 && indices[1] === 11 && indices[2] === 12) {
        return true;
    }
    
    return false;
}

/**
 * Kiểm tra có phải Bạch Thủ (3 lá J/Q/K và tổng = 0)
 */
export function isBachThu(cards: Card[]): boolean {
    if (cards.length !== 3) return false;
    const allFaceCards = cards.every(c => ['J', 'Q', 'K'].includes(c.rank));
    return allFaceCards;
}

/**
 * Xác định loại bài và điểm
 */
export function evaluateHand(cards: Card[]): Hand {
    const score = calculateScore(cards);
    let handType: HandType;
    
    if (isLien(cards)) {
        handType = HandType.LIEN;
    } else if (isSap(cards)) {
        handType = HandType.SAP;
    } else if (isBachThu(cards)) {
        handType = HandType.BACH_THU;
    } else {
        handType = HandType.NORMAL;
    }
    
    return { cards, score, handType };
}

// ================== GAME COMPARISON ==================

/**
 * So sánh 2 hand để xác định người thắng
 * Trả về: >0 nếu hand1 thắng, <0 nếu hand2 thắng, 0 nếu hòa
 */
export function compareHands(hand1: Hand, hand2: Hand): number {
    // So sánh loại bài trước (Liêng > Sáp > Bạch Thủ > Normal)
    if (hand1.handType !== hand2.handType) {
        return hand1.handType - hand2.handType;
    }
    
    // Cùng loại thì so sánh điểm
    if (hand1.handType === HandType.NORMAL) {
        return hand1.score - hand2.score;
    }
    
    // Nếu cùng là Sáp, so sánh rank
    if (hand1.handType === HandType.SAP) {
        const rank1 = RANK_ORDER.indexOf(hand1.cards[0].rank);
        const rank2 = RANK_ORDER.indexOf(hand2.cards[0].rank);
        return rank1 - rank2;
    }
    
    // Nếu cùng là Liêng hoặc Bạch Thủ, so sánh lá cao nhất
    const max1 = Math.max(...hand1.cards.map(c => RANK_ORDER.indexOf(c.rank)));
    const max2 = Math.max(...hand2.cards.map(c => RANK_ORDER.indexOf(c.rank)));
    return max1 - max2;
}

/**
 * Tìm người thắng cuộc từ danh sách người chơi
 */
export function findWinner(players: BaCaoPlayer[]): BaCaoPlayer | null {
    const playersWithHands = players.filter(p => p.hand !== null);
    if (playersWithHands.length === 0) return null;
    
    let winner = playersWithHands[0];
    for (let i = 1; i < playersWithHands.length; i++) {
        if (compareHands(playersWithHands[i].hand!, winner.hand!) > 0) {
            winner = playersWithHands[i];
        }
    }
    
    return winner;
}

// ================== DISPLAY FUNCTIONS ==================

/**
 * Chuyển lá bài thành string hiển thị
 */
export function cardToString(card: Card): string {
    return `${SUIT_EMOJI[card.suit]}${card.rank}`;
}

/**
 * Hiển thị bài ẩn
 */
export function hiddenCard(): string {
    return '🎴';
}

/**
 * Hiển thị hand của người chơi
 */
export function renderHand(hand: Hand, hidden: boolean = false): string {
    if (hidden) {
        return `${hiddenCard()} ${hiddenCard()} ${hiddenCard()}`;
    }
    
    return hand.cards.map(c => cardToString(c)).join(' ');
}

/**
 * Hiển thị loại bài
 */
export function getHandTypeName(handType: HandType): string {
    switch (handType) {
        case HandType.LIEN:
            return '🌟 **LIÊNG** 🌟';
        case HandType.SAP:
            return '💎 **SÁP** 💎';
        case HandType.BACH_THU:
            return '👑 **BẠCH THỦ** 👑';
        case HandType.NORMAL:
            return '🎯 Bài thường';
    }
}

/**
 * Render bảng kết quả game
 */
export function renderGameResult(players: BaCaoPlayer[]): string {
    // Sắp xếp theo điểm
    const sorted = [...players]
        .filter(p => p.hand !== null)
        .sort((a, b) => compareHands(b.hand!, a.hand!));
    
    let result = '```\n';
    result += '╔══════════════════════════════════════════════╗\n';
    result += '║           🎴 KẾT QUẢ BÀICIO 3 LÁ 🎴          ║\n';
    result += '╠══════════════════════════════════════════════╣\n';
    result += '║  # │ Người chơi       │ Bài            │ Điểm ║\n';
    result += '╠══════════════════════════════════════════════╣\n';
    
    sorted.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        const name = player.name.padEnd(16).slice(0, 16);
        const handStr = renderHand(player.hand!).padEnd(14).slice(0, 14);
        const score = player.hand!.handType !== HandType.NORMAL 
            ? getHandTypeName(player.hand!.handType).slice(0, 4)
            : player.hand!.score.toString();
        
        result += `║ ${medal}│ ${name} │ ${handStr} │ ${score.padStart(4)} ║\n`;
    });
    
    result += '╚══════════════════════════════════════════════╝\n';
    result += '```';
    
    return result;
}

/**
 * Render trạng thái game đang chờ người chơi
 */
export function renderWaitingRoom(game: BaCaoGame): string {
    let output = '## 🎴 Phòng Chờ - Bài Cào 3 Lá\n\n';
    output += `**Chủ phòng:** ${game.hostName}\n`;
    output += `**Số người chơi:** ${game.players.length}/6\n`;
    output += `**💰 Tiền cược:** ${game.betAmount.toLocaleString()} xu/người\n`;
    output += `**🏆 Tổng thưởng:** ${(game.betAmount * game.players.length).toLocaleString()} xu\n\n`;
    
    output += '### 👥 Danh sách người chơi:\n';
    game.players.forEach((player, index) => {
        const readyIcon = player.isReady ? '✅' : '⏳';
        output += `${index + 1}. ${readyIcon} **${player.name}**\n`;
    });
    
    output += '\n### 📜 Hướng dẫn:\n';
    output += '- `/bacao join` - Tham gia phòng\n';
    output += '- `/bacao ready` - Sẵn sàng chơi\n';
    output += '- `/bacao start` - Bắt đầu ván (chủ phòng)\n';
    output += '- `/bacao leave` - Rời phòng\n';
    
    return output;
}

/**
 * Render bài của mình (chỉ người chơi thấy)
 */
export function renderMyHand(hand: Hand): string {
    let output = '## 🎴 Bài Của Bạn\n\n';
    output += `**Bài:** ${renderHand(hand)}\n\n`;
    output += `**Loại bài:** ${getHandTypeName(hand.handType)}\n`;
    if (hand.handType === HandType.NORMAL) {
        output += `**Điểm:** ${hand.score} điểm\n`;
    }
    
    return output;
}

/**
 * Render trạng thái game đang diễn ra
 * @param game - Game state
 * @param currentUserId - ID của người đang xem
 * @param isPublic - Nếu true: tin nhắn public (không hiển thị bài chưa lật của ai cả), false: tin nhắn private (hiển thị bài của mình)
 */
export function renderPlayingGame(game: BaCaoGame, currentUserId: string, isPublic: boolean = true): string {
    let output = '## 🎴 Bài Cào 3 Lá - Đang Chơi\n\n';
    
    // Hiển thị thông tin betting
    output += `💰 **Pot:** ${game.totalPot.toLocaleString()} xu\n`;
    output += `📊 **Mức cược:** ${game.currentRaise.toLocaleString()} xu`;
    if (game.bettingRound > 1) {
        output += ` (Vòng ${game.bettingRound})`;
    }
    output += '\n';
    if (game.raiseByName) {
        output += `🔥 **${game.raiseByName}** vừa raise!\n`;
    }
    output += '\n';
    
    output += '### 👥 Bàn chơi:\n';
    game.players.forEach((player, index) => {
        const isMe = player.id === currentUserId;
        const badge = isMe ? '(Bạn) ' : '';
        
        // Status icons
        let statusIcon = '🎴';
        if (player.hasFolded) {
            statusIcon = '❌'; // Đã fold
        } else if (player.isRevealed) {
            statusIcon = '👁️'; // Đã lật
        } else if (!player.hasCalledRaise && game.raiseById) {
            statusIcon = '⏳'; // Cần call
        }
        
        output += `${index + 1}. ${statusIcon} **${badge}${player.name}**`;
        
        // Hiển thị số xu đã cược
        output += ` (${player.currentBet.toLocaleString()} xu)`;
        
        if (player.hasFolded) {
            output += ' - *BỎ BÀI*';
        } else if (player.hand) {
            // Chỉ hiển thị bài nếu:
            // 1. Người chơi đã lật bài (ai cũng thấy)
            // 2. HOẶC đây là tin nhắn private VÀ là bài của chính mình
            if (player.isRevealed) {
                output += ` - ${renderHand(player.hand)}`;
            } else if (!isPublic && isMe) {
                output += ` - ${renderHand(player.hand)} *(Chỉ bạn thấy)*`;
            } else {
                output += ` - ${hiddenCard()} ${hiddenCard()} ${hiddenCard()}`;
            }
        }
        output += '\n';
    });
    
    output += '\n### 📋 Hành động:\n';
    output += '- `/bacao reveal` - Lật bài\n';
    output += '- `/bacao raise [xu]` - Tăng cược\n';
    output += '- `/bacao call` - Theo cược\n';
    output += '- `/bacao fold` - Bỏ bài\n';
    
    return output;
}


// ================== GAME MANAGEMENT ==================

// Lưu trữ các game đang chạy (in-memory)
const activeGames: Map<string, BaCaoGame> = new Map();

/**
 * Tìm game mà người chơi đang tham gia trong guild
 */
export function findPlayerGame(guildId: string, playerId: string): BaCaoGame | null {
    for (const game of activeGames.values()) {
        if (game.guildId === guildId && game.players.some(p => p.id === playerId)) {
            return game;
        }
    }
    return null;
}

/**
 * Tự động rời tất cả game trong guild
 * Trả về game đã rời (nếu có)
 */
export function leaveAllGamesInGuild(guildId: string, playerId: string): BaCaoGame | null {
    const existingGame = findPlayerGame(guildId, playerId);
    if (existingGame) {
        // Nếu game đang waiting, có thể rời
        if (existingGame.status === 'waiting') {
            // Xóa người chơi khỏi game
            existingGame.players = existingGame.players.filter(p => p.id !== playerId);
            
            // Nếu không còn ai, xóa game
            if (existingGame.players.length === 0) {
                activeGames.delete(existingGame.id);
            } else if (existingGame.hostId === playerId) {
                // Nếu host rời, chuyển host cho người đầu tiên
                existingGame.hostId = existingGame.players[0].id;
                existingGame.hostName = existingGame.players[0].name;
            }
            return existingGame;
        }
        // Nếu game đang chơi, không thể rời
        return existingGame;
    }
    return null;
}

/**
 * Tạo game mới
 */
export function createGame(guildId: string, channelId: string, hostId: string, hostName: string, betAmount: number = 100): BaCaoGame {
    const gameId = `${guildId}-${channelId}`;
    
    // Kiểm tra đã có game chưa
    if (activeGames.has(gameId)) {
        throw new Error('Đã có một phòng chơi trong kênh này rồi! Dùng `/bacao join` để tham gia.');
    }
    
    // Kiểm tra người chơi có đang ở phòng khác không
    const existingGame = findPlayerGame(guildId, hostId);
    if (existingGame) {
        if (existingGame.status === 'playing') {
            throw new Error(`Bạn đang trong ván chơi ở kênh khác! Hãy hoàn thành hoặc dùng \`/bacao fold\` để bỏ bài.`);
        }
        // Tự động rời phòng cũ nếu đang chờ
        leaveAllGamesInGuild(guildId, hostId);
    }
    
    const game: BaCaoGame = {
        id: gameId,
        guildId,
        channelId,
        hostId,
        hostName,
        players: [{
            id: hostId,
            name: hostName,
            hand: null,
            isRevealed: false,
            isReady: true,
            currentBet: 0,
            hasFolded: false,
            hasCalledRaise: true,
            hasActedThisRound: false
        }],
        deck: [],
        status: 'waiting',
        winnerId: null,
        winnerName: null,
        betAmount,
        currentRaise: betAmount,
        raiseById: null,
        raiseByName: null,
        totalPot: 0,
        bettingRound: 0,
        createdAt: new Date()
    };
    
    activeGames.set(gameId, game);
    return game;
}

/**
 * Lấy game theo channel
 */
export function getGame(guildId: string, channelId: string): BaCaoGame | null {
    const gameId = `${guildId}-${channelId}`;
    return activeGames.get(gameId) || null;
}

/**
 * Thêm người chơi vào game
 */
export function joinGame(guildId: string, channelId: string, playerId: string, playerName: string): BaCaoGame {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi! Dùng `/bacao create` để tạo phòng mới.');
    }
    
    if (game.status !== 'waiting') {
        throw new Error('Phòng này đang trong ván chơi, không thể tham gia!');
    }
    
    if (game.players.length >= 6) {
        throw new Error('Phòng đã đầy (tối đa 6 người)!');
    }
    
    // Kiểm tra đã ở trong phòng này chưa
    if (game.players.some(p => p.id === playerId)) {
        throw new Error('Bạn đã ở trong phòng này rồi!');
    }
    
    // Kiểm tra người chơi có đang ở phòng khác không
    const existingGame = findPlayerGame(guildId, playerId);
    if (existingGame && existingGame.id !== game.id) {
        if (existingGame.status === 'playing') {
            throw new Error(`Bạn đang trong ván chơi ở kênh khác! Hãy hoàn thành hoặc dùng \`/bacao fold\` để bỏ bài.`);
        }
        // Tự động rời phòng cũ nếu đang chờ
        leaveAllGamesInGuild(guildId, playerId);
    }
    
    game.players.push({
        id: playerId,
        name: playerName,
        hand: null,
        isRevealed: false,
        isReady: false,
        currentBet: 0,
        hasFolded: false,
        hasCalledRaise: true,
        hasActedThisRound: false
    });
    
    return game;
}

/**
 * Rời khỏi game
 */
export function leaveGame(guildId: string, channelId: string, playerId: string): BaCaoGame | null {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
        throw new Error('Bạn không ở trong phòng này!');
    }
    
    game.players.splice(playerIndex, 1);
    
    // Nếu chủ phòng rời, chuyển cho người khác hoặc đóng phòng
    if (playerId === game.hostId) {
        if (game.players.length > 0) {
            game.hostId = game.players[0].id;
            game.hostName = game.players[0].name;
        } else {
            // Đóng phòng
            activeGames.delete(game.id);
            return null;
        }
    }
    
    return game;
}

/**
 * Đặt trạng thái sẵn sàng
 */
export function setReady(guildId: string, channelId: string, playerId: string): BaCaoGame {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
        throw new Error('Bạn không ở trong phòng này!');
    }
    
    player.isReady = !player.isReady;
    return game;
}

/**
 * Bắt đầu game
 */
export function startGame(guildId: string, channelId: string, hostId: string): BaCaoGame {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.hostId !== hostId) {
        throw new Error('Chỉ chủ phòng mới có thể bắt đầu!');
    }
    
    if (game.players.length < 2) {
        throw new Error('Cần ít nhất 2 người chơi để bắt đầu!');
    }
    
    const notReady = game.players.filter(p => !p.isReady);
    if (notReady.length > 0) {
        throw new Error(`Còn ${notReady.length} người chưa sẵn sàng!`);
    }
    
    // Tạo và xáo bài
    game.deck = shuffleDeck(createDeck());
    game.status = 'playing';
    game.currentRaise = game.betAmount;
    game.raiseById = null;
    game.raiseByName = null;
    game.totalPot = 0;
    game.bettingRound = 1;
    
    // Chia bài và khởi tạo bet cho mỗi người
    for (const player of game.players) {
        const { cards, remainingDeck } = dealCards(game.deck, 3);
        game.deck = remainingDeck;
        player.hand = evaluateHand(cards);
        player.isRevealed = false;
        player.currentBet = game.betAmount;
        player.hasFolded = false;
        player.hasCalledRaise = true;
        player.hasActedThisRound = false;
        game.totalPot += game.betAmount;
    }
    
    return game;
}

/**
 * Lật bài
 */
export function revealHand(guildId: string, channelId: string, playerId: string): BaCaoGame {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.status !== 'playing') {
        throw new Error('Game chưa bắt đầu hoặc đã kết thúc!');
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
        throw new Error('Bạn không ở trong phòng này!');
    }
    
    if (player.hasFolded) {
        throw new Error('Bạn đã bỏ bài rồi!');
    }
    
    if (player.isRevealed) {
        throw new Error('Bạn đã lật bài rồi!');
    }
    
    // Kiểm tra có ai đang raise mà chưa call không
    if (!player.hasCalledRaise && game.raiseById) {
        throw new Error(`Bạn cần theo cược (call) hoặc bỏ bài (fold) trước khi lật! Dùng \`/bacao call\` hoặc \`/bacao fold\``);
    }
    
    player.isRevealed = true;
    
    // Kiểm tra tất cả đã lật chưa (trừ người fold)
    const activePlayers = game.players.filter(p => !p.hasFolded);
    const allRevealed = activePlayers.every(p => p.isRevealed);
    
    if (allRevealed) {
        game.status = 'finished';
        const winner = findWinner(activePlayers);
        if (winner) {
            game.winnerId = winner.id;
            game.winnerName = winner.name;
        }
    }
    
    return game;
}

/**
 * Kết thúc và xóa game
 */
export function endGame(guildId: string, channelId: string): void {
    const gameId = `${guildId}-${channelId}`;
    activeGames.delete(gameId);
}

/**
 * Force kết thúc game (admin)
 */
export function forceEndGame(guildId: string, channelId: string, requesterId: string): void {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (requesterId !== game.hostId) {
        throw new Error('Chỉ chủ phòng mới có thể kết thúc game!');
    }
    
    endGame(guildId, channelId);
}

/**
 * Chơi lại với cùng người chơi
 */
export function restartGame(guildId: string, channelId: string, hostId: string): BaCaoGame {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.hostId !== hostId) {
        throw new Error('Chỉ chủ phòng mới có thể bắt đầu lại!');
    }
    
    // Reset game state
    game.status = 'waiting';
    game.deck = [];
    game.winnerId = null;
    game.winnerName = null;
    game.currentRaise = game.betAmount;
    game.raiseById = null;
    game.raiseByName = null;
    game.totalPot = 0;
    game.bettingRound = 0;
    
    for (const player of game.players) {
        player.hand = null;
        player.isRevealed = false;
        player.isReady = player.id === game.hostId;
        player.currentBet = 0;
        player.hasFolded = false;
        player.hasCalledRaise = true;
        player.hasActedThisRound = false;
    }
    
    return game;
}

/**
 * Tăng cược (Raise)
 * @returns Số xu cần thêm để raise
 */
export function raiseGame(guildId: string, channelId: string, playerId: string, playerName: string, raiseAmount: number): { game: BaCaoGame; additionalBet: number } {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.status !== 'playing') {
        throw new Error('Game chưa bắt đầu hoặc đã kết thúc!');
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
        throw new Error('Bạn không ở trong phòng này!');
    }
    
    if (player.hasFolded) {
        throw new Error('Bạn đã bỏ bài, không thể raise!');
    }
    
    if (player.isRevealed) {
        throw new Error('Bạn đã lật bài, không thể raise!');
    }
    
    // Kiểm tra đã hành động trong vòng này chưa
    if (player.hasActedThisRound) {
        throw new Error('Bạn đã hành động trong vòng cược này rồi! Chờ người khác hoàn thành.');
    }
    
    // Kiểm tra có ai đang pending call không (trừ người đang raise)
    const pendingPlayers = game.players.filter(p => 
        !p.hasFolded && !p.isRevealed && !p.hasCalledRaise && p.id !== playerId
    );
    if (pendingPlayers.length > 0) {
        const names = pendingPlayers.map(p => p.name).join(', ');
        throw new Error(`Còn người chưa theo cược: ${names}. Chờ họ call/fold trước!`);
    }
    
    // Kiểm tra mức raise hợp lệ
    const minRaise = game.currentRaise + game.betAmount; // Raise phải cao hơn mức hiện tại ít nhất 1 betAmount
    const maxRaise = game.betAmount * 10; // Tối đa 10x mức cược ban đầu
    
    if (raiseAmount <= game.currentRaise) {
        throw new Error(`Mức raise phải cao hơn ${game.currentRaise} xu!`);
    }
    
    if (raiseAmount > maxRaise) {
        throw new Error(`Mức raise tối đa là ${maxRaise} xu!`);
    }
    
    // Tính số xu cần thêm
    const additionalBet = raiseAmount - player.currentBet;
    
    // Bắt đầu vòng cược mới
    game.bettingRound += 1;
    game.currentRaise = raiseAmount;
    game.raiseById = playerId;
    game.raiseByName = playerName;
    
    // Reset tất cả hasActedThisRound cho vòng mới
    for (const p of game.players) {
        p.hasActedThisRound = false;
    }
    
    // Cập nhật player đã raise
    player.currentBet = raiseAmount;
    player.hasCalledRaise = true;
    player.hasActedThisRound = true;
    game.totalPot += additionalBet;
    
    // Đánh dấu tất cả người chơi khác cần call
    for (const p of game.players) {
        if (p.id !== playerId && !p.hasFolded && !p.isRevealed) {
            p.hasCalledRaise = false;
        }
    }
    
    return { game, additionalBet };
}

/**
 * Theo cược (Call)
 * @returns Số xu cần thêm để call
 */
export function callGame(guildId: string, channelId: string, playerId: string): { game: BaCaoGame; additionalBet: number } {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.status !== 'playing') {
        throw new Error('Game chưa bắt đầu hoặc đã kết thúc!');
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
        throw new Error('Bạn không ở trong phòng này!');
    }
    
    if (player.hasFolded) {
        throw new Error('Bạn đã bỏ bài rồi!');
    }
    
    if (player.isRevealed) {
        throw new Error('Bạn đã lật bài rồi!');
    }
    
    if (player.hasCalledRaise) {
        throw new Error('Bạn đã theo cược rồi! Không có cược mới cần theo.');
    }
    
    // Tính số xu cần thêm
    const additionalBet = game.currentRaise - player.currentBet;
    
    // Cập nhật player
    player.currentBet = game.currentRaise;
    player.hasCalledRaise = true;
    player.hasActedThisRound = true;
    game.totalPot += additionalBet;
    
    return { game, additionalBet };
}

/**
 * Bỏ bài (Fold)
 */
export function foldGame(guildId: string, channelId: string, playerId: string): BaCaoGame {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.status !== 'playing') {
        throw new Error('Game chưa bắt đầu hoặc đã kết thúc!');
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
        throw new Error('Bạn không ở trong phòng này!');
    }
    
    if (player.hasFolded) {
        throw new Error('Bạn đã bỏ bài rồi!');
    }
    
    if (player.isRevealed) {
        throw new Error('Bạn đã lật bài, không thể bỏ!');
    }
    
    // Đánh dấu fold
    player.hasFolded = true;
    player.hasCalledRaise = true; // Không cần call nữa
    player.hasActedThisRound = true;
    
    // Kiểm tra còn bao nhiêu người chơi active
    const activePlayers = game.players.filter(p => !p.hasFolded);
    
    // Nếu chỉ còn 1 người, người đó thắng
    if (activePlayers.length === 1) {
        game.status = 'finished';
        game.winnerId = activePlayers[0].id;
        game.winnerName = activePlayers[0].name;
        activePlayers[0].isRevealed = true;
    }
    
    return game;
}

/**
 * Lấy tổng pot hiện tại
 */
export function getTotalPot(game: BaCaoGame): number {
    return game.totalPot;
}

/**
 * Kiểm tra có ai đang cần call không
 */
export function hasPendingCalls(game: BaCaoGame): boolean {
    return game.players.some(p => !p.hasFolded && !p.isRevealed && !p.hasCalledRaise);
}

/**
 * Lấy danh sách người chơi cần call
 */
export function getPlayersNeedingCall(game: BaCaoGame): BaCaoPlayer[] {
    return game.players.filter(p => !p.hasFolded && !p.isRevealed && !p.hasCalledRaise);
}
