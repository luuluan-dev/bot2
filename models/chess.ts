import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ChessGame {
    id: string;
    guildId: string;
    channelId: string;
    whitePlayerId: string;
    whitePlayerName: string;
    blackPlayerId: string;
    blackPlayerName: string;
    isAiGame: boolean;
    board: string;
    currentTurn: string;
    moves: string[];
    status: string;
    winner: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// Initial chess board in FEN notation
const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Helper để truy cập chess_games một cách an toàn
function getChessModel() {
    const model = (prisma as any).chess_games;
    if (!model) {
        throw new Error('Model chess_games chưa được tạo! Hãy chạy: npx prisma generate && npx prisma db push');
    }
    return model;
}

export class Chess {
    // Tạo game mới
    async createGame(data: {
        guildId: string;
        channelId: string;
        whitePlayerId: string;
        whitePlayerName: string;
        blackPlayerId: string;
        blackPlayerName: string;
        isAiGame?: boolean;
    }): Promise<ChessGame> {
        return await getChessModel().create({
            data: {
                ...data,
                isAiGame: data.isAiGame || false,
                board: INITIAL_FEN,
                currentTurn: 'white',
                moves: [],
                status: 'active',
            }
        });
    }

    // Lấy game đang active của người chơi
    async getActiveGame(userId: string, guildId: string): Promise<ChessGame | null> {
        return await getChessModel().findFirst({
            where: {
                guildId,
                status: 'active',
                OR: [
                    { whitePlayerId: userId },
                    { blackPlayerId: userId }
                ]
            }
        });
    }

    // Lấy game theo ID
    async getGameById(gameId: string): Promise<ChessGame | null> {
        return await getChessModel().findUnique({
            where: { id: gameId }
        });
    }

    // Lấy game đang pending (chờ người chơi)
    async getPendingGame(challengerId: string, guildId: string): Promise<ChessGame | null> {
        return await getChessModel().findFirst({
            where: {
                guildId,
                status: 'pending',
                whitePlayerId: challengerId
            }
        });
    }

    // Cập nhật trạng thái bàn cờ
    async updateBoard(gameId: string, board: string, currentTurn: string, move: string): Promise<ChessGame> {
        const game = await this.getGameById(gameId);
        const moves = game?.moves || [];
        moves.push(move);

        return await getChessModel().update({
            where: { id: gameId },
            data: {
                board,
                currentTurn,
                moves
            }
        });
    }

    // Kết thúc game
    async endGame(gameId: string, status: string, winner: string | null): Promise<ChessGame> {
        return await getChessModel().update({
            where: { id: gameId },
            data: {
                status,
                winner
            }
        });
    }

    // Lấy lịch sử game của người chơi
    async getPlayerHistory(userId: string, limit: number = 10): Promise<ChessGame[]> {
        return await getChessModel().findMany({
            where: {
                OR: [
                    { whitePlayerId: userId },
                    { blackPlayerId: userId }
                ],
                status: {
                    in: ['checkmate', 'draw', 'resigned']
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: limit
        });
    }

    // Đếm số trận thắng/thua/hòa
    async getPlayerStats(userId: string): Promise<{ wins: number; losses: number; draws: number }> {
        const games = await getChessModel().findMany({
            where: {
                OR: [
                    { whitePlayerId: userId },
                    { blackPlayerId: userId }
                ],
                status: {
                    in: ['checkmate', 'draw', 'resigned']
                }
            }
        });

        let wins = 0, losses = 0, draws = 0;
        
        for (const game of games) {
            if (game.winner === 'draw') {
                draws++;
            } else if (
                (game.winner === 'white' && game.whitePlayerId === userId) ||
                (game.winner === 'black' && game.blackPlayerId === userId)
            ) {
                wins++;
            } else {
                losses++;
            }
        }

        return { wins, losses, draws };
    }

    // Xóa game
    async deleteGame(gameId: string): Promise<void> {
        await getChessModel().delete({
            where: { id: gameId }
        });
    }
}
