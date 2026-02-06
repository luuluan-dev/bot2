/**
 * Game Wallet Model - Quản lý ví xu người chơi
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class GameWallet {
    private model = prisma.game_wallets;

    /**
     * Lấy hoặc tạo ví cho người chơi
     */
    async getOrCreate(userId: string, guildId: string, userName: string) {
        const odId = `${userId}-${guildId}`;
        
        let wallet = await this.model.findUnique({
            where: { odId }
        });

        if (!wallet) {
            wallet = await this.model.create({
                data: {
                    odId,
                    odName: userName,
                    odguildId: guildId,
                    coins: 1000, // Xu ban đầu
                }
            });
        }

        return wallet;
    }

    /**
     * Lấy thông tin ví
     */
    async get(userId: string, guildId: string) {
        const odId = `${userId}-${guildId}`;
        return await this.model.findUnique({ where: { odId } });
    }

    /**
     * Cộng xu
     */
    async addCoins(userId: string, guildId: string, amount: number) {
        const odId = `${userId}-${guildId}`;
        return await this.model.update({
            where: { odId },
            data: {
                coins: { increment: amount },
                totalWon: { increment: amount }
            }
        });
    }

    /**
     * Trừ xu
     */
    async subtractCoins(userId: string, guildId: string, amount: number) {
        const odId = `${userId}-${guildId}`;
        return await this.model.update({
            where: { odId },
            data: {
                coins: { decrement: amount },
                totalLost: { increment: amount }
            }
        });
    }

    /**
     * Kiểm tra có đủ xu không
     */
    async hasEnoughCoins(userId: string, guildId: string, amount: number): Promise<boolean> {
        const wallet = await this.get(userId, guildId);
        return wallet ? wallet.coins >= amount : false;
    }

    /**
     * Cập nhật sau khi thắng game
     */
    async recordWin(userId: string, guildId: string, amount: number) {
        const odId = `${userId}-${guildId}`;
        return await this.model.update({
            where: { odId },
            data: {
                coins: { increment: amount },
                totalWon: { increment: amount },
                gamesPlayed: { increment: 1 },
                gamesWon: { increment: 1 }
            }
        });
    }

    /**
     * Cập nhật sau khi thua game
     */
    async recordLoss(userId: string, guildId: string, amount: number) {
        const odId = `${userId}-${guildId}`;
        return await this.model.update({
            where: { odId },
            data: {
                coins: { decrement: amount },
                totalLost: { increment: amount },
                gamesPlayed: { increment: 1 }
            }
        });
    }

    /**
     * Hoàn tiền (không track vào statistics)
     */
    async refundBet(userId: string, guildId: string, amount: number) {
        const odId = `${userId}-${guildId}`;
        return await this.model.update({
            where: { odId },
            data: {
                coins: { increment: amount }
                // Không update totalWon/totalLost vì đây chỉ là hoàn lại tiền cược
            }
        });
    }

    /**
     * Lấy top 10 người chơi giàu nhất trong guild
     */
    async getLeaderboard(guildId: string, limit: number = 10) {
        return await this.model.findMany({
            where: { odguildId: guildId },
            orderBy: { coins: 'desc' },
            take: limit
        });
    }

    /**
     * Nhận xu hàng ngày
     */
    async claimDaily(userId: string, guildId: string, userName: string): Promise<{ success: boolean; amount: number; message: string }> {
        const wallet = await this.getOrCreate(userId, guildId, userName);
        const now = new Date();
        const lastClaim = wallet.updatedAt;
        
        // Kiểm tra đã claim trong ngày chưa
        const isSameDay = lastClaim.getDate() === now.getDate() &&
                          lastClaim.getMonth() === now.getMonth() &&
                          lastClaim.getFullYear() === now.getFullYear();
        
        if (isSameDay && wallet.gamesPlayed > 0) {
            return {
                success: false,
                amount: 0,
                message: 'Bạn đã nhận xu hàng ngày rồi! Quay lại vào ngày mai nhé.'
            };
        }

        const dailyAmount = 500;
        await this.model.update({
            where: { odId: wallet.odId },
            data: { coins: { increment: dailyAmount } }
        });

        return {
            success: true,
            amount: dailyAmount,
            message: `Bạn đã nhận ${dailyAmount} xu hàng ngày!`
        };
    }
}
