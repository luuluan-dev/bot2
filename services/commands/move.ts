/**
 * ♟️ Move Command - Di chuyển quân cờ trong game cờ vua
 * 
 * Usage: !move [từ] [đến]
 * Example: !move e2 e4
 */

import { EmbedBuilder, Message, TextChannel } from 'discord.js';
import { ExecuteParams, Command } from './types.js';
import { Chess } from '../../models/chess.js';
import * as ChessEngine from '../../utils/chessEngine.js';
import { GenerativeModel } from '@google/generative-ai';

const chessM = new Chess();

// AI system prompt cho việc tính nước đi
const AI_CHESS_PROMPT = `Bạn là một AI chơi cờ vua mạnh mẽ. Nhiệm vụ của bạn là phân tích bàn cờ (FEN notation) và đưa ra nước đi tốt nhất cho quân ĐEN.

QUY TẮC QUAN TRỌNG:
1. Bạn PHẢI trả lời CHÍNH XÁC theo format: FROM TO (ví dụ: e7 e5)
2. Nước đi phải hợp lệ theo luật cờ vua cho quân ĐEN
3. CHỈ trả lời 2 vị trí cách nhau bởi dấu cách, KHÔNG có gì khác
4. Ưu tiên các nước đi chiến thuật, tấn công, hoặc phòng thủ tốt

VÍ DỤ TRẢ LỜI ĐÚNG:
e7 e5
d7 d5
g8 f6

KHÔNG được trả lời như thế này:
- "Tôi đề xuất e7 e5"
- "Nước đi tốt nhất là e7 e5"  
- "e7e5" (thiếu dấu cách)
`;

// Helper function để send message an toàn
function sendToChannel(channel: Message['channel'], options: any): void {
    if ('send' in channel) {
        (channel as TextChannel).send(options);
    }
}

// Lấy nước đi random hợp lệ
function getRandomValidMove(fen: string, color: string): { from: string; to: string } | null {
    const board = ChessEngine.fenToBoard(fen);
    const validMoves: { from: string; to: string }[] = [];

    for (let fromRow = 0; fromRow < 8; fromRow++) {
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            const piece = board[fromRow][fromCol];
            if (piece && ChessEngine.getPieceColor(piece) === color) {
                const fromNotation = ChessEngine.positionToNotation({ row: fromRow, col: fromCol });
                const moves = ChessEngine.getValidMoves(fen, fromNotation);
                
                for (const toNotation of moves) {
                    validMoves.push({ from: fromNotation, to: toNotation });
                }
            }
        }
    }

    if (validMoves.length === 0) return null;
    
    return validMoves[Math.floor(Math.random() * validMoves.length)];
}

// Thực hiện nước đi của AI
async function executeAIMove(message: Message, gameId: string, currentFen: string, fromNotation: string, toNotation: string, thinkingMsg: Message): Promise<void> {
    const moveResult = ChessEngine.makeMove(currentFen, fromNotation, toNotation, 'black');

    if (!moveResult.success) {
        // Nếu nước đi không hợp lệ, thử random
        const randomMove = getRandomValidMove(currentFen, 'black');
        if (randomMove) {
            await executeAIMove(message, gameId, currentFen, randomMove.from, randomMove.to, thinkingMsg);
        } else {
            await thinkingMsg.edit('❌ AI không tìm được nước đi hợp lệ!');
        }
        return;
    }

    const moveNotation = `${fromNotation}→${toNotation}`;
    
    // Cập nhật database
    await chessM.updateBoard(gameId, moveResult.fen!, 'white', moveNotation);

    // Xóa tin nhắn đang suy nghĩ
    await thinkingMsg.delete().catch(() => {});

    // Lấy game mới nhất
    const game = await chessM.getGameById(gameId);
    if (!game) return;

    // Kiểm tra kết thúc game
    if (moveResult.isCheckmate) {
        await chessM.endGame(gameId, 'checkmate', 'black');
        
        const embed = new EmbedBuilder()
            .setTitle('♟️ CHIẾU BÍ! 🤖')
            .setDescription(
                `${ChessEngine.renderBoard(moveResult.fen!, 'white')}\n\n` +
                `**🤖 Bot AI** đã thắng bằng chiếu bí!`
            )
            .setColor('#E74C3C')
            .addFields(
                { name: '🎯 Nước đi cuối', value: `\`${moveNotation}\``, inline: true },
                { name: '📊 Tổng nước đi', value: `${game.moves.length}`, inline: true }
            )
            .setTimestamp();

        sendToChannel(message.channel, { embeds: [embed] });
        return;
    }

    if (moveResult.isStalemate) {
        await chessM.endGame(gameId, 'draw', 'draw');
        
        const embed = new EmbedBuilder()
            .setTitle('♟️ HÒA CỜ!')
            .setDescription(
                `${ChessEngine.renderBoard(moveResult.fen!, 'white')}\n\n` +
                `Ván cờ kết thúc với kết quả hòa!`
            )
            .setColor('#95A5A6')
            .setTimestamp();

        sendToChannel(message.channel, { embeds: [embed] });
        return;
    }

    // Tạo embed cho nước đi của AI
    let description = ChessEngine.renderBoard(moveResult.fen!, 'white');
    
    if (moveResult.capturedPiece) {
        description += `\n\n💥 AI đã ăn quân!`;
    }
    if (moveResult.promotion) {
        description += `\n\n👑 AI phong hậu!`;
    }
    if (moveResult.isCheck) {
        description += `\n\n⚠️ **CHIẾU!**`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🤖 AI đã đi!')
        .setDescription(
            `**${game.whitePlayerName}** (⚪) vs **🤖 Bot AI** (⚫)\n\n${description}`
        )
        .setColor(moveResult.isCheck ? '#E74C3C' : '#3498DB')
        .addFields(
            { name: '🎯 Nước đi AI', value: `\`${moveNotation}\``, inline: true },
            { name: '🎮 Lượt tiếp', value: `⚪ ${game.whitePlayerName} (Bạn)`, inline: true }
        )
        .setTimestamp();

    sendToChannel(message.channel, { embeds: [embed] });
}

// AI di chuyển
async function makeAIMove(message: Message, gameId: string, currentFen: string, model: GenerativeModel): Promise<void> {
    try {
        // Hiển thị đang suy nghĩ
        let thinkingMsg: Message | null = null;
        if ('send' in message.channel) {
            thinkingMsg = await (message.channel as TextChannel).send('🤔 AI đang suy nghĩ...');
        }
        
        if (!thinkingMsg) return;

        // Hỏi AI nước đi
        const prompt = `${AI_CHESS_PROMPT}\n\nTrạng thái bàn cờ (FEN): ${currentFen}\n\nBạn chơi quân ĐEN. Đưa ra nước đi:`;
        
        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text().trim();

        // Parse nước đi từ AI
        const moveMatch = aiResponse.match(/([a-h][1-8])\s+([a-h][1-8])/i);
        
        if (!moveMatch) {
            // Fallback: random nước đi hợp lệ
            console.error('AI không trả về nước đi hợp lệ:', aiResponse);
            await thinkingMsg.edit('🤖 AI đang tính toán nước đi...');
            
            const randomMove = getRandomValidMove(currentFen, 'black');
            if (randomMove) {
                await executeAIMove(message, gameId, currentFen, randomMove.from, randomMove.to, thinkingMsg);
            } else {
                await thinkingMsg.edit('❌ AI không tìm được nước đi hợp lệ!');
            }
            return;
        }

        const fromNotation = moveMatch[1].toLowerCase();
        const toNotation = moveMatch[2].toLowerCase();

        await executeAIMove(message, gameId, currentFen, fromNotation, toNotation, thinkingMsg);

    } catch (error: any) {
        console.error('Lỗi khi AI di chuyển:', error);
        sendToChannel(message.channel, '❌ AI gặp lỗi! Vui lòng thử lại.');
    }
}

export default {
    name: 'move',
    description: '♟️ Di chuyển quân cờ',

    async execute({ message, args, config, logModAction, sendEmbedMessage, client, model, chatM: chatModel, createModel }: ExecuteParams): Promise<void> {
        const userId = message.author.id;
        const guildId = message.guild?.id;

        if (!guildId) {
            message.reply('❌ Lệnh này chỉ hoạt động trong server!');
            return;
        }

        // Kiểm tra có đang trong game không
        const game = await chessM.getActiveGame(userId, guildId);
        if (!game) {
            message.reply('❌ Bạn không có ván cờ nào đang diễn ra! Dùng `!chess @user` hoặc `!chess ai` để bắt đầu.');
            return;
        }

        // Kiểm tra có phải lượt của người chơi không
        const isWhite = game.whitePlayerId === userId;
        const isBlack = game.blackPlayerId === userId;
        const isYourTurn = (game.currentTurn === 'white' && isWhite) || (game.currentTurn === 'black' && isBlack);

        if (!isYourTurn) {
            const currentPlayerName = game.currentTurn === 'white' ? game.whitePlayerName : game.blackPlayerName;
            message.reply(`❌ Không phải lượt của bạn! Lượt hiện tại: **${currentPlayerName}** (${game.currentTurn === 'white' ? '⚪' : '⚫'})`);
            return;
        }

        // Kiểm tra arguments
        if (args.length < 2) {
            message.reply('❌ Sử dụng: `!move [từ] [đến]`\nVí dụ: `!move e2 e4`');
            return;
        }

        const fromNotation = args[0].toLowerCase();
        const toNotation = args[1].toLowerCase();

        // Validate notation format
        const notationRegex = /^[a-h][1-8]$/;
        if (!notationRegex.test(fromNotation) || !notationRegex.test(toNotation)) {
            message.reply('❌ Vị trí không hợp lệ! Sử dụng format: `a1` đến `h8`');
            return;
        }

        // Thực hiện nước đi
        const moveResult = ChessEngine.makeMove(game.board, fromNotation, toNotation, game.currentTurn);

        if (!moveResult.success) {
            message.reply(moveResult.message || '❌ Nước đi không hợp lệ!');
            return;
        }

        const moveNotationStr = `${fromNotation}→${toNotation}`;
        const nextTurn = game.currentTurn === 'white' ? 'black' : 'white';

        // Cập nhật database
        await chessM.updateBoard(game.id, moveResult.fen!, nextTurn, moveNotationStr);

        // Kiểm tra kết thúc game
        if (moveResult.isCheckmate) {
            await chessM.endGame(game.id, 'checkmate', game.currentTurn);
            const winnerName = game.currentTurn === 'white' ? game.whitePlayerName : game.blackPlayerName;
            
            const embed = new EmbedBuilder()
                .setTitle('♟️ CHIẾU BÍ! 🏆')
                .setDescription(
                    `${ChessEngine.renderBoard(moveResult.fen!, isWhite ? 'white' : 'black')}\n\n` +
                    `**${winnerName}** đã thắng bằng chiếu bí!`
                )
                .setColor('#FFD700')
                .addFields(
                    { name: '🎯 Nước đi cuối', value: `\`${moveNotationStr}\``, inline: true },
                    { name: '📊 Tổng nước đi', value: `${game.moves.length + 1}`, inline: true }
                )
                .setTimestamp();

            sendToChannel(message.channel, { embeds: [embed] });
            return;
        }

        if (moveResult.isStalemate) {
            await chessM.endGame(game.id, 'draw', 'draw');
            
            const embed = new EmbedBuilder()
                .setTitle('♟️ HÒA CỜ!')
                .setDescription(
                    `${ChessEngine.renderBoard(moveResult.fen!, isWhite ? 'white' : 'black')}\n\n` +
                    `Ván cờ kết thúc với kết quả hòa (hết nước đi)!`
                )
                .setColor('#95A5A6')
                .setTimestamp();

            sendToChannel(message.channel, { embeds: [embed] });
            return;
        }

        // Tạo embed cho nước đi thường
        const perspective = isWhite ? 'white' : 'black';
        let description = ChessEngine.renderBoard(moveResult.fen!, perspective);
        
        if (moveResult.capturedPiece) {
            description += `\n\n💥 Đã ăn quân!`;
        }
        if (moveResult.promotion) {
            description += `\n\n👑 Phong hậu!`;
        }
        if (moveResult.isCheck) {
            description += `\n\n⚠️ **CHIẾU!**`;
        }

        const nextPlayerName = nextTurn === 'white' ? game.whitePlayerName : game.blackPlayerName;

        const embed = new EmbedBuilder()
            .setTitle('♟️ Nước đi thành công!')
            .setDescription(
                `**${game.whitePlayerName}** (⚪) vs **${game.blackPlayerName}** (⚫)\n\n${description}`
            )
            .setColor(moveResult.isCheck ? '#E74C3C' : '#2ECC71')
            .addFields(
                { name: '🎯 Nước đi', value: `\`${moveNotationStr}\``, inline: true },
                { name: '🎮 Lượt tiếp', value: `${nextTurn === 'white' ? '⚪' : '⚫'} ${nextPlayerName}`, inline: true }
            )
            .setFooter({ text: `${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        sendToChannel(message.channel, { embeds: [embed] });

        // Nếu đang chơi với AI và đến lượt AI
        if (game.isAiGame && nextTurn === 'black') {
            await makeAIMove(message, game.id, moveResult.fen!, model);
        }
    }
} as Command;
