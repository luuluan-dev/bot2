/**
 * ♟️ Chess Command - Trò chơi cờ vua qua Discord chat
 * 
 * Commands:
 * - !chess @user       - Thách đấu người chơi khác
 * - !chess ai          - Chơi với AI
 * - !move e2 e4        - Di chuyển quân cờ
 * - !chess board       - Xem bàn cờ hiện tại
 * - !chess resign      - Đầu hàng
 * - !chess stats       - Xem thống kê
 * - !chess help        - Hướng dẫn chơi
 */

import { EmbedBuilder, Message, TextChannel } from 'discord.js';
import { ExecuteParams, Command } from './types.js';
import { Chess } from '../../models/chess.js';
import * as ChessEngine from '../../utils/chessEngine.js';

const chessM = new Chess();

// Bắt đầu game với AI
async function startAIGame(message: Message, guildId: string, userId: string): Promise<void> {
    // Kiểm tra có game đang chơi không
    const existingGame = await chessM.getActiveGame(userId, guildId);
    if (existingGame) {
        message.reply('❌ Bạn đang có một ván cờ chưa kết thúc! Dùng `!chess resign` để đầu hàng hoặc `!chess board` để xem bàn cờ.');
        return;
    }

    // Tạo game mới với AI
    const game = await chessM.createGame({
        guildId,
        channelId: message.channel.id,
        whitePlayerId: userId,
        whitePlayerName: message.author.username,
        blackPlayerId: 'AI',
        blackPlayerName: '🤖 Bot AI',
        isAiGame: true
    });

    const boardDisplay = ChessEngine.renderBoard(game.board);

    const embed = new EmbedBuilder()
        .setTitle('♟️ Ván cờ mới với AI!')
        .setDescription(`**${message.author.username}** (⚪ Trắng) VS **🤖 Bot AI** (⚫ Đen)\n\n${boardDisplay}`)
        .setColor('#2ECC71')
        .addFields(
            { name: '🎮 Lượt hiện tại', value: '⚪ Trắng (Bạn)', inline: true },
            { name: '📝 Cách đi', value: '`!move [từ] [đến]`\nVD: `!move e2 e4`', inline: true }
        )
        .setFooter({ text: 'Dùng !chess help để xem hướng dẫn chi tiết', iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

    if ('send' in message.channel) {
        (message.channel as TextChannel).send({ embeds: [embed] });
    }
}

// Thách đấu người chơi khác
async function challengePlayer(message: Message, guildId: string, challengerId: string, opponent: any): Promise<void> {
    if (opponent.bot) {
        message.reply('❌ Bạn không thể thách đấu bot! Dùng `!chess ai` để chơi với AI.');
        return;
    }

    if (opponent.id === challengerId) {
        message.reply('❌ Bạn không thể thách đấu chính mình!');
        return;
    }

    // Kiểm tra cả 2 có game đang chơi không
    const challengerGame = await chessM.getActiveGame(challengerId, guildId);
    if (challengerGame) {
        message.reply('❌ Bạn đang có một ván cờ chưa kết thúc!');
        return;
    }

    const opponentGame = await chessM.getActiveGame(opponent.id, guildId);
    if (opponentGame) {
        message.reply(`❌ **${opponent.username}** đang trong một ván cờ khác!`);
        return;
    }

    // Random ai đi trước
    const challengerIsWhite = Math.random() > 0.5;

    // Tạo game mới
    const game = await chessM.createGame({
        guildId,
        channelId: message.channel.id,
        whitePlayerId: challengerIsWhite ? challengerId : opponent.id,
        whitePlayerName: challengerIsWhite ? message.author.username : opponent.username,
        blackPlayerId: challengerIsWhite ? opponent.id : challengerId,
        blackPlayerName: challengerIsWhite ? opponent.username : message.author.username,
        isAiGame: false
    });

    const boardDisplay = ChessEngine.renderBoard(game.board);

    const embed = new EmbedBuilder()
        .setTitle('♟️ Ván cờ mới!')
        .setDescription(
            `**${game.whitePlayerName}** (⚪ Trắng) VS **${game.blackPlayerName}** (⚫ Đen)\n\n` +
            `${boardDisplay}`
        )
        .setColor('#3498DB')
        .addFields(
            { name: '🎮 Lượt hiện tại', value: `⚪ Trắng (<@${game.whitePlayerId}>)`, inline: true },
            { name: '📝 Cách đi', value: '`!move [từ] [đến]`\nVD: `!move e2 e4`', inline: true }
        )
        .setFooter({ text: 'Dùng !chess help để xem hướng dẫn chi tiết' })
        .setTimestamp();

    if ('send' in message.channel) {
        (message.channel as TextChannel).send({ content: `<@${opponent.id}> Bạn đã được thách đấu!`, embeds: [embed] });
    }
}

// Xem bàn cờ hiện tại
async function viewBoard(message: Message, guildId: string, userId: string): Promise<void> {
    const game = await chessM.getActiveGame(userId, guildId);
    if (!game) {
        message.reply('❌ Bạn không có ván cờ nào đang diễn ra! Dùng `!chess @user` hoặc `!chess ai` để bắt đầu.');
        return;
    }

    const perspective = game.whitePlayerId === userId ? 'white' : 'black';
    const boardDisplay = ChessEngine.renderBoard(game.board, perspective);
    const isYourTurn = (game.currentTurn === 'white' && game.whitePlayerId === userId) ||
                      (game.currentTurn === 'black' && game.blackPlayerId === userId);

    const embed = new EmbedBuilder()
        .setTitle('♟️ Bàn cờ hiện tại')
        .setDescription(
            `**${game.whitePlayerName}** (⚪) vs **${game.blackPlayerName}** (⚫)\n\n${boardDisplay}`
        )
        .setColor(isYourTurn ? '#2ECC71' : '#E74C3C')
        .addFields(
            { name: '🎮 Lượt hiện tại', value: game.currentTurn === 'white' ? `⚪ ${game.whitePlayerName}` : `⚫ ${game.blackPlayerName}`, inline: true },
            { name: '📊 Số nước đi', value: `${game.moves.length}`, inline: true },
            { name: '📝 Nước đi gần nhất', value: game.moves.length > 0 ? `\`${game.moves[game.moves.length - 1]}\`` : 'Chưa có', inline: true }
        )
        .setFooter({ text: isYourTurn ? '👉 Đến lượt bạn!' : '⏳ Đang chờ đối thủ...' })
        .setTimestamp();

    if ('send' in message.channel) {
        (message.channel as TextChannel).send({ embeds: [embed] });
    }
}

// Đầu hàng
async function resignGame(message: Message, guildId: string, userId: string): Promise<void> {
    const game = await chessM.getActiveGame(userId, guildId);
    if (!game) {
        message.reply('❌ Bạn không có ván cờ nào đang diễn ra!');
        return;
    }

    const isWhite = game.whitePlayerId === userId;
    const winner = isWhite ? 'black' : 'white';
    const winnerName = isWhite ? game.blackPlayerName : game.whitePlayerName;

    await chessM.endGame(game.id, 'resigned', winner);

    const embed = new EmbedBuilder()
        .setTitle('🏳️ Đầu hàng!')
        .setDescription(`**${message.author.username}** đã đầu hàng!\n\n🏆 Người thắng: **${winnerName}**`)
        .setColor('#E74C3C')
        .setTimestamp();

    if ('send' in message.channel) {
        (message.channel as TextChannel).send({ embeds: [embed] });
    }
}

// Hủy game (chưa bắt đầu)
async function cancelGame(message: Message, guildId: string, userId: string): Promise<void> {
    const game = await chessM.getActiveGame(userId, guildId);
    if (!game) {
        message.reply('❌ Bạn không có ván cờ nào đang diễn ra!');
        return;
    }

    if (game.moves.length > 0) {
        message.reply('❌ Ván cờ đã bắt đầu! Dùng `!chess resign` để đầu hàng.');
        return;
    }

    await chessM.deleteGame(game.id);
    message.reply('✅ Đã hủy ván cờ!');
}

// Xem thống kê
async function showStats(message: Message, userId: string): Promise<void> {
    const stats = await chessM.getPlayerStats(userId);
    const total = stats.wins + stats.losses + stats.draws;
    const winRate = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : '0';

    const embed = new EmbedBuilder()
        .setTitle(`📊 Thống kê cờ vua - ${message.author.username}`)
        .setColor('#9B59B6')
        .setThumbnail(message.author.displayAvatarURL())
        .addFields(
            { name: '🏆 Thắng', value: `${stats.wins}`, inline: true },
            { name: '💔 Thua', value: `${stats.losses}`, inline: true },
            { name: '🤝 Hòa', value: `${stats.draws}`, inline: true },
            { name: '📈 Tổng trận', value: `${total}`, inline: true },
            { name: '🎯 Tỷ lệ thắng', value: `${winRate}%`, inline: true }
        )
        .setTimestamp();

    if ('send' in message.channel) {
        (message.channel as TextChannel).send({ embeds: [embed] });
    }
}

// Hiển thị hướng dẫn
async function showHelp(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
        .setTitle('♟️ Hướng dẫn chơi cờ vua')
        .setColor('#F1C40F')
        .setDescription('Chơi cờ vua trực tiếp trong Discord!')
        .addFields(
            { name: '🎮 Bắt đầu game', value: '`!chess @user` - Thách đấu người chơi\n`!chess ai` - Chơi với AI', inline: false },
            { name: '♟️ Di chuyển quân', value: '`!move [từ] [đến]`\nVD: `!move e2 e4` (di chuyển quân từ e2 đến e4)', inline: false },
            { name: '📋 Các lệnh khác', value: 
                '`!chess board` - Xem bàn cờ\n' +
                '`!chess resign` - Đầu hàng\n' +
                '`!chess stats` - Xem thống kê\n' +
                '`!chess cancel` - Hủy game (nếu chưa đi)', inline: false },
            { name: '🎨 Quân cờ', value: 
                '⚪ Trắng: ♔♕♖♗♘♙\n' +
                '⚫ Đen: ♚♛♜♝♞♟', inline: false }
        )
        .setFooter({ text: 'Chúc bạn chơi vui vẻ! 🎉' })
        .setTimestamp();

    if ('send' in message.channel) {
        (message.channel as TextChannel).send({ embeds: [embed] });
    }
}

export default {
    name: 'chess',
    description: '♟️ Chơi cờ vua với người khác hoặc AI',

    async execute({ message, args, config, logModAction, sendEmbedMessage, client, model, chatM: chatModel, createModel }: ExecuteParams): Promise<void> {
        console.log('🎮 Chess command called with args:', args);
        
        try {
            const subCommand = args[0]?.toLowerCase();
            const userId = message.author.id;
            const guildId = message.guild?.id;

            if (!guildId) {
                message.reply('❌ Lệnh này chỉ hoạt động trong server!');
                return;
            }

            switch (subCommand) {
                case 'ai':
                    await startAIGame(message, guildId, userId);
                    break;
                case 'board':
                case 'view':
                case 'xem':
                    await viewBoard(message, guildId, userId);
                    break;
                case 'resign':
                case 'ff':
                case 'thua':
                    await resignGame(message, guildId, userId);
                    break;
                case 'stats':
                case 'thongke':
                    await showStats(message, userId);
                    break;
                case 'help':
                case 'huongdan':
                    await showHelp(message);
                    break;
                case 'cancel':
                case 'huy':
                    await cancelGame(message, guildId, userId);
                    break;
                default:
                    // Nếu có mention user -> thách đấu
                    const mentionedUser = message.mentions.users.first();
                    if (mentionedUser) {
                        await challengePlayer(message, guildId, userId, mentionedUser);
                    } else if (!subCommand) {
                        await showHelp(message);
                    } else {
                        message.reply('❌ Lệnh không hợp lệ! Sử dụng `!chess help` để xem hướng dẫn.');
                    }
            }
        } catch (error: any) {
            console.error('❌ Chess command error:', error);
            message.reply(`❌ Có lỗi xảy ra: ${error.message}`);
        }
    }
} as Command;
