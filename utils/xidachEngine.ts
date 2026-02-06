/**
 * Xì Dách Engine - Xử lý logic trò chơi Xì Dách (Blackjack)
 * 
 * Luật chơi:
 * - Mục tiêu: Có tổng điểm gần 21 nhất mà không vượt quá
 * - Quắc (Bust): Tổng > 21 → Thua ngay
 * - Xì Dách (Blackjack): A + lá 10 điểm = 21 điểm tự nhiên
 * - Ngũ Linh: 5 lá bài có tổng ≤ 21 = Thắng cao nhất
 * 
 * Tính điểm:
 * - A = 1 hoặc 11 (tự động chọn có lợi nhất)
 * - 2-10 = Đúng số
 * - J/Q/K = 10 điểm
 */

// ================== TYPES & INTERFACES ==================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
    suit: Suit;
    rank: Rank;
}

export enum HandType {
    NGU_LINH = 5,      // 5 lá bài tổng ≤ 21 (cao nhất)
    XI_DACH = 4,       // A + lá 10 điểm = 21 tự nhiên
    XI_BANG = 3,       // 2 lá A (đặc biệt)
    NORMAL = 1         // Bài thường
}

export interface Hand {
    cards: Card[];
    score: number;
    softScore: number;  // Điểm khi tính A = 11
    handType: HandType;
    isBusted: boolean;
}

export interface XiDachPlayer {
    id: string;
    name: string;
    hand: Hand | null;
    currentBet: number;
    isDealer: boolean;      // Là nhà cái
    isStanding: boolean;    // Đã dừng rút bài
    isBusted: boolean;      // Đã quắc (>21)
    isDoubled: boolean;     // Đã nhân đôi
    hasInsurance: boolean;  // Đã mua bảo hiểm
    isRevealed: boolean;    // Đã bị nhà cái khui bài (xét điểm)
    result: 'win' | 'lose' | 'push' | 'blackjack' | null;  // Kết quả
}

// ... cắt bớt phần không thay đổi cho ngắn view_file nếu cần ...


export interface XiDachGame {
    id: string;
    guildId: string;
    channelId: string;
    hostId: string;
    hostName: string;
    players: XiDachPlayer[];
    dealer: XiDachPlayer;   // (Deprecated) Giữ lại để minimize refactor, trỏ tới player làm cái
    deck: Card[];
    status: 'waiting' | 'betting' | 'playing' | 'dealer_turn' | 'finished';
    currentPlayerIndex: number;
    betAmount: number;      // Mức cược tối thiểu
    gamesPlayed: number;    // Số ván đã chơi (để xoay cái)
    dealerIndex: number;    // Vị trí người làm cái trong mảng players
    createdAt: Date;
}

// ================== CONSTANTS ==================

// Giá trị các lá bài cho Xì Dách
const RANK_VALUES: Record<Rank, number> = {
    'A': 1,   // A có thể = 1 hoặc 11
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 10, 'Q': 10, 'K': 10
};

// Thứ tự các lá bài
const RANK_ORDER: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Tất cả các chất bài
const ALL_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

// Emoji cho các chất bài
const SUIT_EMOJI: Record<Suit, string> = {
    'hearts': '♥️',
    'diamonds': '♦️',
    'clubs': '♣️',
    'spades': '♠️'
};

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
 * Rút 1 lá bài từ bộ bài
 */
export function drawCard(deck: Card[]): { card: Card, remainingDeck: Card[] } {
    const card = deck[0];
    const remainingDeck = deck.slice(1);
    return { card, remainingDeck };
}

// ================== SCORING FUNCTIONS ==================

/**
 * Tính điểm của hand (tự động chọn A = 1 hoặc 11 có lợi nhất)
 */
export function calculateScore(cards: Card[]): { score: number, softScore: number } {
    let score = 0;
    let aceCount = 0;
    
    for (const card of cards) {
        if (card.rank === 'A') {
            aceCount++;
            score += 1;  // Tạm tính A = 1
        } else {
            score += RANK_VALUES[card.rank];
        }
    }
    
    // Tính soft score (nếu có A có thể tính = 11)
    let softScore = score;
    for (let i = 0; i < aceCount; i++) {
        if (softScore + 10 <= 21) {
            softScore += 10;  // Đổi A từ 1 -> 11
        }
    }
    
    return { score, softScore };
}

/**
 * Lấy điểm tốt nhất (không quắc)
 */
export function getBestScore(cards: Card[]): number {
    const { score, softScore } = calculateScore(cards);
    // Ưu tiên soft score nếu không quắc
    if (softScore <= 21) return softScore;
    return score;
}

/**
 * Kiểm tra có phải Xì Dách (Blackjack) không - 2 lá đầu = 21
 */
export function isBlackjack(cards: Card[]): boolean {
    if (cards.length !== 2) return false;
    const score = getBestScore(cards);
    return score === 21;
}

/**
 * Kiểm tra có phải Xì Bàng (2 lá A) không
 */
export function isXiBang(cards: Card[]): boolean {
    if (cards.length !== 2) return false;
    return cards[0].rank === 'A' && cards[1].rank === 'A';
}

/**
 * Kiểm tra có phải Ngũ Linh (5 lá ≤ 21) không
 */
export function isNguLinh(cards: Card[]): boolean {
    if (cards.length !== 5) return false;
    const score = getBestScore(cards);
    return score <= 21;
}

/**
 * Kiểm tra có quắc (bust) không
 */
export function isBusted(cards: Card[]): boolean {
    const { score } = calculateScore(cards);
    return score > 21;
}

/**
 * Đánh giá hand
 */
export function evaluateHand(cards: Card[]): Hand {
    const { score, softScore } = calculateScore(cards);
    const bestScore = getBestScore(cards);
    const busted = isBusted(cards);
    
    let handType = HandType.NORMAL;
    if (isNguLinh(cards)) {
        handType = HandType.NGU_LINH;
    } else if (isXiBang(cards)) {
        handType = HandType.XI_BANG;
    } else if (isBlackjack(cards)) {
        handType = HandType.XI_DACH;
    }
    
    return {
        cards,
        score: bestScore,
        softScore,
        handType,
        isBusted: busted
    };
}

// ================== DISPLAY FUNCTIONS ==================

/**
 * Chuyển lá bài thành string hiển thị
 */
export function cardToString(card: Card): string {
    return `${card.rank}${SUIT_EMOJI[card.suit]}`;
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
export function renderHand(hand: Hand, hideSecond: boolean = false): string {
    if (hideSecond && hand.cards.length >= 2) {
        return `${cardToString(hand.cards[0])} ${hiddenCard()}`;
    }
    return hand.cards.map(c => cardToString(c)).join(' ');
}

/**
 * Hiển thị loại bài đặc biệt
 */
export function getHandTypeName(handType: HandType): string {
    switch (handType) {
        case HandType.NGU_LINH: return '🐉 NGŨ LINH';
        case HandType.XI_DACH: return '🎰 XÌ DÁCH';
        case HandType.XI_BANG: return '👑 XÌ BÀNG';
        default: return '';
    }
}

/**
 * Render trạng thái game đang chờ
 */
export function renderWaitingRoom(game: XiDachGame): string {
    let text = `**💰 Mức cược:** ${game.betAmount.toLocaleString()} xu\n`;
    text += `**👥 Người chơi (${game.players.length}/6):**\n`;
    
    for (const player of game.players) {
        const hostBadge = player.id === game.hostId ? ' 👑' : '';
        text += `• ${player.name}${hostBadge}\n`;
    }
    
    if (game.players.length < 2) {
        text += `\n⏳ *Cần ít nhất 2 người chơi để bắt đầu*`;
    } else {
        text += `\n✅ *Sẵn sàng! Chủ phòng có thể bắt đầu*`;
    }
    
    return text;
}

/**
 * Render bàn chơi
 * @param viewerId - ID của người đang xem (để chỉ hiển thị bài của họ - deprecated, giờ dùng followUp)
 */
export function renderTable(game: XiDachGame, viewerId?: string, showDealerHand: boolean = false): string {
    let text = '';
    
    // Dealer hand (PvP: Dealer là một trong các players)
    const dealer = game.players[game.dealerIndex];
    text += `**🏦 Nhà Cái: ${dealer.name}**\n`;
    if (dealer.hand) {
        // Dealer luôn ẩn bài trong lượt chơi, trừ khi finished hoặc showDealerHand
        if (showDealerHand || game.status === 'finished' || game.status === 'dealer_turn') {
            const dealerScore = getBestScore(dealer.hand.cards);
            const handTypeName = getHandTypeName(dealer.hand.handType);
            text += `${renderHand(dealer.hand)} = **${dealerScore}** ${handTypeName}\n`;
        } else {
            text += `${renderHand(dealer.hand, true)} = **?**\n`;
        }
    }
    
    text += `\n**👥 Người Chơi:**\n`;
    
    for (let i = 0; i < game.players.length; i++) {
        const player = game.players[i];
        
        // Skip dealer trong danh sách player (đã hiển thị ở trên)
        if (player.id === dealer.id) continue;
        
        const isCurrentTurn = (game.status === 'playing' || game.status === 'dealer_turn') && i === game.currentPlayerIndex;
        const turnIndicator = isCurrentTurn ? '👉 ' : '';
        
        // Chỉ hiển thị status nếu: (1) Đã revealed, (2) Game finished
        let status = '';
        const canShowStatus = player.isRevealed || game.status === 'finished';
        
        if (canShowStatus) {
            if (player.isBusted) {
                status = ' ❌ QUẮC';
            } else if (player.isStanding) {
                status = ' ✅ Dừng';
            } else if (player.result === 'blackjack') {
                status = ' 🎰 XÌ DÁCH!';
            } else if (player.result === 'win') {
                status = ' 🎉 THẮNG';
            } else if (player.result === 'lose') {
                status = ' 💸 THUA';
            } else if (player.result === 'push') {
                status = ' 🤝 HÒA';
            }
        }
        
        let handDisplay = '';
        if (player.hand) {
            // Hiển thị đầy đủ nếu: (1) Đã revealed, (2) Game finished
            if (canShowStatus) {
                const score = getBestScore(player.hand.cards);
                const handTypeName = getHandTypeName(player.hand.handType);
                handDisplay = `${renderHand(player.hand)} = **${score}** ${handTypeName}`;
            } else {
                // Đang chơi và chưa revealed: Ẩn bài (chỉ hiện số lượng)
                const cardCount = player.hand.cards.length;
                handDisplay = `🎴 ${cardCount} lá`;
            }
        }
        
        const betInfo = player.isDoubled ? `(x2 ${player.currentBet.toLocaleString()} xu)` : `(${player.currentBet.toLocaleString()} xu)`;
        
        text += `${turnIndicator}**${player.name}** ${betInfo}: ${handDisplay}${status}\n`;
    }
    
    return text;
}

/**
 * Render bài của một người chơi cụ thể (dùng cho xem riêng)
 */
export function renderPlayerHand(game: XiDachGame, playerId: string): string {
    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.hand) return 'Bạn chưa có bài.';
    
    const score = getBestScore(player.hand.cards);
    const handTypeName = getHandTypeName(player.hand.handType);
    
    return `🃏 **Bài của bạn:** ${renderHand(player.hand)}\n🎯 **Điểm:** ${score} ${handTypeName}`;
}

/**
 * Render kết quả game
 */
export function renderGameResult(game: XiDachGame): string {
    let text = `**🏦 Nhà Cái:** `;
    
    if (game.dealer.hand) {
        const dealerScore = getBestScore(game.dealer.hand.cards);
        const handTypeName = getHandTypeName(game.dealer.hand.handType);
        const busted = game.dealer.isBusted ? ' ❌ QUẮC' : '';
        text += `${renderHand(game.dealer.hand)} = **${dealerScore}** ${handTypeName}${busted}\n`;
    }
    
    text += `\n**📊 Kết Quả:**\n`;
    
    for (const player of game.players) {
        let resultEmoji = '';
        let resultText = '';
        
        switch (player.result) {
            case 'blackjack':
                resultEmoji = '🎰';
                resultText = `THẮNG +${Math.floor(player.currentBet * 1.5).toLocaleString()} xu`;
                break;
            case 'win':
                resultEmoji = '✅';
                resultText = `THẮNG +${player.currentBet.toLocaleString()} xu`;
                break;
            case 'lose':
                resultEmoji = '❌';
                resultText = `THUA -${player.currentBet.toLocaleString()} xu`;
                break;
            case 'push':
                resultEmoji = '🔄';
                resultText = 'HÒA (hoàn xu)';
                break;
        }
        
        const score = player.hand ? getBestScore(player.hand.cards) : 0;
        text += `${resultEmoji} **${player.name}** (${score} điểm): ${resultText}\n`;
    }
    
    return text;
}

// ================== GAME MANAGEMENT ==================

// Lưu trữ các game đang chạy (in-memory)
const activeGames: Map<string, XiDachGame> = new Map();

/**
 * Tạo key cho game
 */
function getGameKey(guildId: string, channelId: string): string {
    return `${guildId}-${channelId}`;
}

/**
 * Lấy game theo guild và channel
 */
export function getGame(guildId: string, channelId: string): XiDachGame | null {
    return activeGames.get(getGameKey(guildId, channelId)) || null;
}

/**
 * Tạo game mới
 */
/**
 * Tạo game mới
 */
export function createGame(guildId: string, channelId: string, hostId: string, hostName: string, betAmount: number): XiDachGame {
    const key = getGameKey(guildId, channelId);
    
    if (activeGames.has(key)) {
        throw new Error('Đã có phòng chơi trong kênh này!');
    }
    
    const host: XiDachPlayer = {
        id: hostId,
        name: hostName,
        hand: null,
        currentBet: betAmount,
        isDealer: true, // Host làm cái đầu tiên
        isStanding: false,
        isBusted: false,
        isDoubled: false,
        hasInsurance: false,
        isRevealed: false,
        result: null
    };

    // Placeholder dealer object (giữ để backward compatible, thực tế logic dùng players[dealerIndex])
    const dealer: XiDachPlayer = { ...host };

    const game: XiDachGame = {
        id: `xidach_${Date.now()}`,
        guildId,
        channelId,
        hostId,
        hostName,
        players: [host],
        dealer: dealer,
        deck: shuffleDeck(createDeck()),
        status: 'waiting',
        currentPlayerIndex: 0,
        betAmount,
        gamesPlayed: 0,
        dealerIndex: 0,
        createdAt: new Date()
    };
    
    activeGames.set(key, game);
    return game;
}

/**
 * Tham gia game
 */
export function joinGame(guildId: string, channelId: string, playerId: string, playerName: string): XiDachGame {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.status !== 'waiting') {
        throw new Error('Game đã bắt đầu, không thể tham gia!');
    }
    
    if (game.players.length >= 6) {
        throw new Error('Phòng đã đầy (tối đa 6 người)!');
    }
    
    if (game.players.find(p => p.id === playerId)) {
        throw new Error('Bạn đã ở trong phòng này rồi!');
    }
    
    game.players.push({
        id: playerId,
        name: playerName,
        hand: null,
        currentBet: game.betAmount,
        isDealer: false,
        isStanding: false,
        isBusted: false,
        isDoubled: false,
        hasInsurance: false,
        isRevealed: false,
        result: null
    });
    
    return game;
}

/**
 * Rời game
 */
export function leaveGame(guildId: string, channelId: string, playerId: string): XiDachGame | null {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.status !== 'waiting') {
        throw new Error('Không thể rời khi game đang diễn ra!');
    }
    
    // Nếu host rời, xóa phòng
    if (playerId === game.hostId) {
        activeGames.delete(getGameKey(guildId, channelId));
        return null;
    }
    
    game.players = game.players.filter(p => p.id !== playerId);
    return game;
}

/**
 * Bắt đầu game - Chia bài
 */
/**
 * Bắt đầu game - Chia bài
 */
export function startGame(guildId: string, channelId: string, hostId: string): XiDachGame {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.hostId !== hostId) {
        throw new Error('Chỉ chủ phòng mới có thể bắt đầu!');
    }
    
    if (game.players.length < 2) {
        throw new Error('Cần ít nhất 2 người chơi để bắt đầu (1 Cái, 1 Con)!');
    }
    
    if (game.status !== 'waiting') {
        throw new Error('Game đã bắt đầu rồi!');
    }
    
    // Reset deck
    game.deck = shuffleDeck(createDeck());
    
    // Reset players state & hands
    game.players.forEach((player, index) => {
        // Dealer không cần đặt cược (hoặc cược = 0 để hiển thị)
        const isDealer = index === game.dealerIndex;
        
        player.isDealer = isDealer;
        player.currentBet = isDealer ? 0 : game.betAmount;
        
        // Chia 2 lá cho mỗi người
        const card1 = game.deck.shift()!;
        const card2 = game.deck.shift()!;
        player.hand = evaluateHand([card1, card2]);
        
        player.isStanding = false;
        player.isBusted = false;
        player.isDoubled = false;
        player.hasInsurance = false;
        player.isRevealed = false;
        player.result = null;

        // Check Xì Dách từ đầu
        if (player.hand.handType === HandType.XI_DACH || player.hand.handType === HandType.XI_BANG) {
            // Nếu là cái có xì dách -> Thắng hết (xử lý sau)
            // Nếu là con -> chờ xét
            // Tạm thời chưa auto-stand để người chơi tự sướng :D hoặc auto-stand
            player.isStanding = true; 
        }
    });

    // Reset bot dealer (không dùng nữa nhưng reset cho sạch)
    game.dealer.hand = null; 
    
    game.status = 'playing';
    
    // Người đi đầu tiên là người kế tiếp sau cái
    game.currentPlayerIndex = (game.dealerIndex + 1) % game.players.length;
    
    // Bỏ qua những người đã xong (ví dụ có xì dách ngay từ đầu)
    skipFinishedPlayers(game);
    
    return game;
}

/**
 * Bỏ qua người chơi đã xong (busted hoặc standing)
 */
function skipFinishedPlayers(game: XiDachGame): void {
    const startRoundIndex = (game.dealerIndex + 1) % game.players.length;
    
    // Nếu đang lượt chơi của nhà con
    if (game.status === 'playing') {
        let loopCount = 0;
        while (loopCount < game.players.length) {
            // Nếu pointer trỏ trúng dealer -> Hết lượt nhà con -> Chuyển sang cái
            if (game.currentPlayerIndex === game.dealerIndex) {
                 game.status = 'dealer_turn';
                 // Không cần break, để logic dealer_turn xử lý tiếp (nếu dealer đã có xì dách chẳng hạn)
                 break; 
            }

            const currentPlayer = game.players[game.currentPlayerIndex];
            if (!currentPlayer.isStanding && !currentPlayer.isBusted) {
                return; // Đến lượt người này
            }

            // Next player
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
            loopCount++;
        }
        
        // Nếu loop hết mà không ai chơi (hoặc trúng dealer), chuyển sang dealer
        game.status = 'dealer_turn';
        game.currentPlayerIndex = game.dealerIndex;
    }
    
    // Nếu lượt nhà cái
    if (game.status === 'dealer_turn') {
        const dealer = game.players[game.dealerIndex];
        // Nếu dealer đã dừng/quắc -> Kết thúc game
        if (dealer.isStanding || dealer.isBusted) {
            finishGame(game);
        }
    }
}

/**
 * Rút bài (Hit)
 */
export function hit(guildId: string, channelId: string, playerId: string): XiDachGame {
    const game = getGame(guildId, channelId);
    if (!game) throw new Error('Không tìm thấy phòng chơi!');
    
    if (game.status !== 'playing' && game.status !== 'dealer_turn') {
        throw new Error('Không phải lượt chơi!');
    }
    
    const player = game.players[game.currentPlayerIndex];
    if (player.id !== playerId) {
        throw new Error('Chưa đến lượt của bạn!');
    }
    
    if (player.isStanding || player.isBusted) {
        throw new Error('Bạn đã dừng hoặc quắc rồi!');
    }
    
    // Rút 1 lá
    const newCard = game.deck.shift()!;
    player.hand!.cards.push(newCard);
    player.hand = evaluateHand(player.hand!.cards);
    
    // Kiểm tra quắc
    if (player.hand.isBusted) {
        player.isBusted = true;
        player.isStanding = true;
        player.result = 'lose';
    }
    
    // Kiểm tra Ngũ Linh
    if (player.hand.handType === HandType.NGU_LINH) {
        player.isStanding = true;
    }
    
    // Skip người đã xong (busted hoặc standing)
    skipFinishedPlayers(game);
    
    return game;
}

/**
 * Dừng (Stand)
 */
export function stand(guildId: string, channelId: string, playerId: string): XiDachGame {
    const game = getGame(guildId, channelId);
    if (!game) throw new Error('Không tìm thấy phòng chơi!');
    
    if (game.status !== 'playing' && game.status !== 'dealer_turn') {
        throw new Error('Không phải lượt chơi!');
    }
    
    const player = game.players[game.currentPlayerIndex];
    if (player.id !== playerId) {
         throw new Error('Chưa đến lượt của bạn!');
    }
    
    player.isStanding = true;
    
    // Skip người kể tiếp hoặc chuyển sang dealer_turn
    skipFinishedPlayers(game);
    
    return game;
}

/**
 * Xét bài từng người (Khui bài)
 */
export function revealPlayer(guildId: string, channelId: string, dealerId: string, targetId: string): { game: XiDachGame, result: string } {
    const game = getGame(guildId, channelId);
    if (!game) throw new Error('Không tìm thấy phòng chơi!');
    if (game.status !== 'dealer_turn') throw new Error('Chưa đến lượt Nhà Cái!');
    
    // Check dealer ownership
    const dealer = game.players[game.dealerIndex];
    if (dealer.id !== dealerId) throw new Error('Bạn không phải Nhà Cái!');
    
    // Check target
    const target = game.players.find(p => p.id === targetId);
    if (!target) throw new Error('Không tìm thấy người chơi này trong phòng!');
    if (target.isRevealed) throw new Error('Người chơi này đã bị xét bài rồi!');
    if (target.id === dealer.id) throw new Error('Không thể tự xét bài mình!');
    
    // So bài và cập nhật result cho target player
    calculateOneVsOne(dealer, target);
    target.isRevealed = true;
    
    return { game, result: target.result || 'push' };
}

/**
 * Nhân đôi (Double Down)
 */
export function doubleDown(guildId: string, channelId: string, playerId: string): XiDachGame {
    const game = getGame(guildId, channelId);
    if (!game) throw new Error('Không tìm thấy phòng chơi!');
    
    if (game.status !== 'playing') {
        throw new Error('Chỉ nhà con mới được nhân đôi trong lượt chơi!');
    }
    
    const player = game.players[game.currentPlayerIndex];
    if (player.id !== playerId) {
        throw new Error('Chưa đến lượt của bạn!');
    }
    
    if (player.hand!.cards.length !== 2) {
        throw new Error('Chỉ có thể nhân đôi khi có 2 lá bài!');
    }
    
    // Nhân đôi cược
    player.currentBet *= 2;
    player.isDoubled = true;
    
    // Rút 1 lá và dừng
    const newCard = game.deck.shift()!;
    player.hand!.cards.push(newCard);
    player.hand = evaluateHand(player.hand!.cards);
    
    if (player.hand.isBusted) {
        player.isBusted = true;
        player.result = 'lose';
    }
    
    player.isStanding = true;
    
    // Skip người kể tiếp
    skipFinishedPlayers(game);
    
    return game;
}

/**
 * Kết thúc game (Khi Dealer Stand/Bust)
 */
export function finishGame(game: XiDachGame): void {
    calculateResults(game);
    game.status = 'finished';
}

/**
 * Hàm dealerPlay cũ (để tương thích ngược nếu còn gọi sót)
 * Thực tế bây giờ Dealer là người chơi nên dùng hit/stand/finishGame
 */
export function dealerPlay(guildId: string, channelId: string): XiDachGame {
    const game = getGame(guildId, channelId);
    if (!game) throw new Error('Không tìm thấy game!');
    finishGame(game);
    return game;
}

/**
 * Tính kết quả PvE (Player vs Player-Dealer) cho những người chưa xét bài
 */
function calculateResults(game: XiDachGame): void {
    const dealer = game.players[game.dealerIndex];

    for (let i = 0; i < game.players.length; i++) {
        if (i === game.dealerIndex) continue; // Bỏ qua dealer

        const player = game.players[i];
        
        // Nếu đã xét bài rồi -> Bỏ qua
        if (player.isRevealed) continue;
        
        // Tính kết quả 1vs1
        calculateOneVsOne(dealer, player);
        player.isRevealed = true;
    }
}

/**
 * Logic so bài 1vs1 giữa Dealer và Player
 * Cập nhật trực tiếp kết quả vào player.result
 */
export function calculateOneVsOne(dealer: XiDachPlayer, player: XiDachPlayer) {
    const dealerScore = getBestScore(dealer.hand!.cards);
    const dealerBusted = dealer.isBusted;
    const dealerBlackjack = dealer.hand!.handType === HandType.XI_DACH || dealer.hand!.handType === HandType.XI_BANG;
    const dealerNguLinh = dealer.hand!.handType === HandType.NGU_LINH;

    // Player Quắc -> Thua (bất kể Dealer ra sao)
    if (player.isBusted) {
        player.result = 'lose';
        return;
    }
    
    // --- So bài ---
    const playerScore = getBestScore(player.hand!.cards);
    const playerBlackjack = player.hand!.handType === HandType.XI_DACH || player.hand!.handType === HandType.XI_BANG;
    const playerNguLinh = player.hand!.handType === HandType.NGU_LINH;
    
    // Dealer Quắc -> Player thắng (vì player chưa quắc)
    if (dealerBusted) {
        player.result = playerBlackjack ? 'blackjack' : 'win'; 
        return;
    }
    
    // Ngũ Linh vs Ngũ Linh
    if (playerNguLinh) {
        if (dealerNguLinh) player.result = 'push';
        else player.result = 'win';
        return;
    }
    if (dealerNguLinh) { 
            player.result = 'lose';
            return;
    }

    // Xì Dách vs Xì Dách
    if (playerBlackjack) {
        if (dealerBlackjack) player.result = 'push';
        else player.result = 'blackjack';
        return;
    }
    if (dealerBlackjack) {
        player.result = 'lose';
        return;
    }
    
    // So điểm thường
    if (playerScore > dealerScore) {
        player.result = 'win';
    } else if (playerScore < dealerScore) {
        player.result = 'lose';
    } else {
        player.result = 'push';
    }
}

/**
 * Chơi lại (Restart)
 */
export function restartGame(guildId: string, channelId: string, userId: string): XiDachGame {
    const game = getGame(guildId, channelId);
    if (!game) throw new Error('Không tìm thấy phòng chơi!');
    
    // Tăng số ván
    game.gamesPlayed++;
    
    // Xoay tua cái sau mỗi 5 ván
    if (game.gamesPlayed > 0 && game.gamesPlayed % 5 === 0) {
        // Tìm người tiếp theo làm cái
        game.dealerIndex = (game.dealerIndex + 1) % game.players.length;
    }
    
    return startGame(guildId, channelId, userId);
}

/**
 * Lấy người chơi hiện tại
 */
export function getCurrentPlayer(game: XiDachGame): XiDachPlayer | null {
    if (game.status !== 'playing' && game.status !== 'dealer_turn') return null;
    if (game.currentPlayerIndex >= game.players.length) return null;
    return game.players[game.currentPlayerIndex];
}

/**
 * Restart game (chơi lại)
 */
/**
 * Restart game (chơi lại) - DEPRECATED: Duplicate removed
 */
/*
export function restartGame(guildId: string, channelId: string, hostId: string): XiDachGame {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.hostId !== hostId) {
        throw new Error('Chỉ chủ phòng mới có thể restart!');
    }
    
    // Reset game state
    game.deck = shuffleDeck(createDeck());
    game.status = 'waiting';
    game.currentPlayerIndex = 0;
    
    // Reset dealer
    game.dealer.hand = null;
    game.dealer.isStanding = false;
    game.dealer.isBusted = false;
    game.dealer.result = null;
    
    // Reset players
    for (const player of game.players) {
        player.hand = null;
        player.currentBet = game.betAmount;
        player.isStanding = false;
        player.isBusted = false;
        player.isDoubled = false;
        player.hasInsurance = false;
        player.result = null;
    }
    
    return game;
}
*/

/**
 * Kết thúc game (xóa phòng)
 */
export function endGame(guildId: string, channelId: string, hostId: string): void {
    const game = getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.hostId !== hostId) {
        throw new Error('Chỉ chủ phòng mới có thể đóng phòng!');
    }
    
    activeGames.delete(getGameKey(guildId, channelId));
}
