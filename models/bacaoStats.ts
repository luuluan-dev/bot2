/**
 * Ba Cao Stats Model - Thống kê Bài Cào 3 Lá
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type HandTypeName = 'LIEN' | 'SAP' | 'BACH_THU' | 'NORMAL';

export class BaCaoStats {
    private model = prisma.bacao_stats;
    private gameModel = prisma.bacao_games;

    /**
     * Lấy hoặc tạo stats cho người chơi
     */
    async getOrCreate(userId: string, guildId: string, userName: string) {
        const odId = `${userId}-${guildId}`;
        
        let stats = await this.model.findUnique({
            where: { odId }
        });

        if (!stats) {
            stats = await this.model.create({
                data: {
                    odId,
                    odName: userName,
                    odguildId: guildId,
                }
            });
        }

        return stats;
    }

    /**
     * Cập nhật stats sau khi thắng
     */
    async recordWin(userId: string, guildId: string, userName: string, coinsWon: number, handType: HandTypeName) {
        const odId = `${userId}-${guildId}`;
        await this.getOrCreate(userId, guildId, userName);

        const updateData: any = {
            totalGames: { increment: 1 },
            totalWins: { increment: 1 },
            totalCoinsWon: { increment: coinsWon },
            currentStreak: { increment: 1 },
        };

        // Cập nhật count cho loại bài đặc biệt
        if (handType === 'LIEN') {
            updateData.lienCount = { increment: 1 };
        } else if (handType === 'SAP') {
            updateData.sapCount = { increment: 1 };
        } else if (handType === 'BACH_THU') {
            updateData.bachThuCount = { increment: 1 };
        }

        const updated = await this.model.update({
            where: { odId },
            data: updateData
        });

        // Cập nhật highest win và best streak
        if (coinsWon > updated.highestWin || updated.currentStreak > updated.bestStreak) {
            await this.model.update({
                where: { odId },
                data: {
                    highestWin: Math.max(updated.highestWin, coinsWon),
                    bestStreak: Math.max(updated.bestStreak, updated.currentStreak)
                }
            });
        }

        return updated;
    }

    /**
     * Cập nhật stats sau khi thua
     */
    async recordLoss(userId: string, guildId: string, userName: string, coinsLost: number) {
        const odId = `${userId}-${guildId}`;
        await this.getOrCreate(userId, guildId, userName);

        return await this.model.update({
            where: { odId },
            data: {
                totalGames: { increment: 1 },
                totalLosses: { increment: 1 },
                totalCoinsLost: { increment: coinsLost },
                currentStreak: 0 // Reset streak khi thua
            }
        });
    }

    /**
     * Lấy bảng xếp hạng theo số thắng
     */
    async getLeaderboardByWins(guildId: string, limit: number = 10) {
        return await this.model.findMany({
            where: { odguildId: guildId },
            orderBy: { totalWins: 'desc' },
            take: limit
        });
    }

    /**
     * Lấy bảng xếp hạng theo xu thắng
     */
    async getLeaderboardByCoins(guildId: string, limit: number = 10) {
        return await this.model.findMany({
            where: { odguildId: guildId },
            orderBy: { totalCoinsWon: 'desc' },
            take: limit
        });
    }

    /**
     * Lấy bảng xếp hạng theo streak cao nhất
     */
    async getLeaderboardByStreak(guildId: string, limit: number = 10) {
        return await this.model.findMany({
            where: { odguildId: guildId },
            orderBy: { bestStreak: 'desc' },
            take: limit
        });
    }

    /**
     * Lưu lịch sử ván đấu
     */
    async saveGame(gameData: {
        guildId: string;
        channelId: string;
        hostId: string;
        hostName: string;
        betAmount: number;
        players: any[];
        winnerId: string | null;
        winnerName: string | null;
        winnerHand: string | null;
        totalPot: number;
    }) {
        return await this.gameModel.create({
            data: {
                guildId: gameData.guildId,
                channelId: gameData.channelId,
                hostId: gameData.hostId,
                hostName: gameData.hostName,
                betAmount: gameData.betAmount,
                players: gameData.players,
                winnerId: gameData.winnerId,
                winnerName: gameData.winnerName,
                winnerHand: gameData.winnerHand,
                totalPot: gameData.totalPot,
                status: 'finished'
            }
        });
    }

    /**
     * Lấy lịch sử ván đấu gần đây
     */
    async getRecentGames(guildId: string, limit: number = 10) {
        return await this.gameModel.findMany({
            where: { guildId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    /**
     * Lấy stats của một người chơi
     */
    async getPlayerStats(userId: string, guildId: string) {
        const odId = `${userId}-${guildId}`;
        return await this.model.findUnique({ where: { odId } });
    }
}
