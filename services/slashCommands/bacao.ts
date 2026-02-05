/**
 * Slash Command: /bacao
 * Trò chơi Bài Cào 3 Lá (Tay 3 lá) với hệ thống điểm
 */

import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    Interaction,
    RepliableInteraction,
    ModalSubmitInteraction,
    ButtonInteraction
} from 'discord.js';
import * as BaCao from '../../utils/bacaoEngine.js';
import { GameWallet } from '../../models/gameWallet.js';
import { BaCaoStats, HandTypeName } from '../../models/bacaoStats.js';

const walletModel = new GameWallet();
const statsModel = new BaCaoStats();

// ================== BUTTON HELPERS ==================

function getWaitingButtons(game: BaCao.BaCaoGame): ActionRowBuilder<ButtonBuilder> {
    const joinBtn = new ButtonBuilder()
        .setCustomId('bacao_join')
        .setLabel('Tham gia')
        .setStyle(ButtonStyle.Success)
        .setDisabled(game.players.length >= 6);

    const readyBtn = new ButtonBuilder()
        .setCustomId('bacao_ready')
        .setLabel('Sẵn sàng')
        .setStyle(ButtonStyle.Primary);

    const leaveBtn = new ButtonBuilder()
        .setCustomId('bacao_leave')
        .setLabel('Rời phòng')
        .setStyle(ButtonStyle.Danger);

    const startBtn = new ButtonBuilder()
        .setCustomId('bacao_start')
        .setLabel('Bắt đầu')
        .setStyle(ButtonStyle.Success)
        .setEmoji('▶️');

    return new ActionRowBuilder<ButtonBuilder>().addComponents(joinBtn, readyBtn, leaveBtn, startBtn);
}

function getPlayingButtons(game: BaCao.BaCaoGame, playerId: string): ActionRowBuilder<ButtonBuilder> {
    const player = game.players.find(p => p.id === playerId);
    
    // Nút Xem Bài luôn hiện
    const handBtn = new ButtonBuilder()
        .setCustomId('bacao_hand')
        .setLabel('Xem Bài')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👀');

    // Các nút hành động
    const callBtn = new ButtonBuilder()
        .setCustomId('bacao_call')
        .setLabel('Theo')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!!player?.hasFolded || !!player?.isRevealed);

    const raiseBtn = new ButtonBuilder()
        .setCustomId('bacao_raise_modal')
        .setLabel('Tố')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!!player?.hasFolded || !!player?.isRevealed);

    const foldBtn = new ButtonBuilder()
        .setCustomId('bacao_fold')
        .setLabel('Bỏ')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!!player?.hasFolded || !!player?.isRevealed);
        
    const revealBtn = new ButtonBuilder()
        .setCustomId('bacao_reveal')
        .setLabel('Lật Bài')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!!player?.hasFolded || (!player?.hasCalledRaise && !!game.raiseById));

    return new ActionRowBuilder<ButtonBuilder>().addComponents(handBtn, callBtn, raiseBtn, foldBtn, revealBtn);
}

// Định nghĩa slash command
export const data = new SlashCommandBuilder()
    .setName('bacao')
    .setDescription('🎴 Trò chơi Bài Cào 3 Lá (Tay 3 lá)')
    .addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Tạo phòng chơi mới')
            .addIntegerOption(option =>
                option
                    .setName('bet')
                    .setDescription('Số xu đặt cược (mặc định: 100)')
                    .setMinValue(10)
                    .setMaxValue(10000)
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('join')
            .setDescription('Tham gia phòng chơi')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('leave')
            .setDescription('Rời khỏi phòng')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('ready')
            .setDescription('Sẵn sàng chơi / Hủy sẵn sàng')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('start')
            .setDescription('Bắt đầu ván chơi (chủ phòng)')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('reveal')
            .setDescription('Lật bài của bạn')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('hand')
            .setDescription('Xem bài của bạn (tin nhắn riêng)')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Xem trạng thái phòng chơi')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('end')
            .setDescription('Kết thúc/Đóng phòng (chủ phòng)')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('restart')
            .setDescription('Chơi lại ván mới (chủ phòng)')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('rules')
            .setDescription('Xem luật chơi')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('wallet')
            .setDescription('Xem ví xu của bạn')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('daily')
            .setDescription('Nhận xu hàng ngày')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('leaderboard')
            .setDescription('Xem bảng xếp hạng')
            .addStringOption(option =>
                option
                    .setName('type')
                    .setDescription('Loại xếp hạng')
                    .setRequired(false)
                    .addChoices(
                        { name: '💰 Xu nhiều nhất', value: 'coins' },
                        { name: '🏆 Thắng nhiều nhất', value: 'wins' },
                        { name: '🔥 Streak cao nhất', value: 'streak' }
                    )
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('stats')
            .setDescription('Xem thống kê của bạn')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('raise')
            .setDescription('🔥 Tăng cược')
            .addIntegerOption(option =>
                option
                    .setName('amount')
                    .setDescription('Số xu muốn raise lên')
                    .setRequired(true)
                    .setMinValue(10)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('call')
            .setDescription('📞 Theo cược (call)')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('fold')
            .setDescription('❌ Bỏ bài (fold)')
    );

// Hàm tạo embed thông báo
function createEmbed(title: string, description: string, color: number = 0x2F3136): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
}

// Thực thi command
export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const userName = interaction.user.displayName || interaction.user.username;

    try {
        switch (subcommand) {
            case 'create':
                await handleCreate(interaction, guildId, channelId, userId, userName);
                break;
            case 'join':
                await handleJoin(interaction, guildId, channelId, userId, userName);
                break;
            case 'leave':
                await handleLeave(interaction, guildId, channelId, userId);
                break;
            case 'ready':
                await handleReady(interaction, guildId, channelId, userId);
                break;
            case 'start':
                await handleStart(interaction, guildId, channelId, userId);
                break;
            case 'reveal':
                await handleReveal(interaction, guildId, channelId, userId, userName);
                break;
            case 'hand':
                await handleViewHand(interaction, guildId, channelId, userId);
                break;
            case 'status':
                await handleStatus(interaction, guildId, channelId, userId);
                break;
            case 'end':
                await handleEnd(interaction, guildId, channelId, userId);
                break;
            case 'restart':
                await handleRestart(interaction, guildId, channelId, userId);
                break;
            case 'rules':
                await handleRules(interaction);
                break;
            case 'wallet':
                await handleWallet(interaction, guildId, userId, userName);
                break;
            case 'daily':
                await handleDaily(interaction, guildId, userId, userName);
                break;
            case 'leaderboard':
                await handleLeaderboard(interaction, guildId);
                break;
            case 'stats':
                await handleStats(interaction, guildId, userId, userName);
                break;
            case 'raise':
                await handleRaise(interaction, guildId, channelId, userId, userName);
                break;
            case 'call':
                await handleCall(interaction, guildId, channelId, userId, userName);
                break;
            case 'fold':
                await handleFold(interaction, guildId, channelId, userId, userName);
                break;
            default:
                await interaction.reply({ content: '❌ Lệnh không hợp lệ!', ephemeral: true });
        }
    } catch (error: any) {
        console.error('Lỗi bacao command:', error.message || error);
        
        // Cố gắng reply lỗi, nhưng ignore nếu interaction đã expired
        try {
            const embed = createEmbed('❌ Lỗi', error.message || 'Có lỗi xảy ra!', 0xFF0000);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        } catch (replyError: any) {
            // Ignore errors when trying to reply (e.g., interaction expired)
            console.error('Không thể reply lỗi:', replyError.message);
        }
    }
}

// ================== HANDLERS ==================

async function handleCreate(interaction: ChatInputCommandInteraction, guildId: string, channelId: string, userId: string, userName: string) {
    const betAmount = interaction.options.getInteger('bet') || 100;
    
    // Kiểm tra ví và số dư
    const wallet = await walletModel.getOrCreate(userId, guildId, userName);
    if (wallet.coins < betAmount) {
        throw new Error(`Bạn không đủ xu! Cần ${betAmount} xu nhưng chỉ có ${wallet.coins} xu.`);
    }
    
    const game = BaCao.createGame(guildId, channelId, userId, userName, betAmount);
    
    const embed = new EmbedBuilder()
        .setTitle('🎴 Phòng Bài Cào 3 Lá Đã Được Tạo!')
        .setDescription(BaCao.renderWaitingRoom(game))
        .setColor(0x00FF00)
        .setFooter({ text: 'Chờ người chơi khác tham gia...' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], components: [getWaitingButtons(game)] });
}

async function handleJoin(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string, userName: string) {
    const existingGame = BaCao.getGame(guildId, channelId);
    if (!existingGame) {
        throw new Error('Không tìm thấy phòng chơi! Dùng `/bacao create` để tạo phòng mới.');
    }
    
    // Kiểm tra ví và số dư
    const wallet = await walletModel.getOrCreate(userId, guildId, userName);
    if (wallet.coins < existingGame.betAmount) {
        throw new Error(`Bạn không đủ xu! Cần ${existingGame.betAmount} xu nhưng chỉ có ${wallet.coins} xu.`);
    }
    
    const game = BaCao.joinGame(guildId, channelId, userId, userName);
    
    const embed = new EmbedBuilder()
        .setTitle('🎴 Có Người Chơi Mới!')
        .setDescription(`**${userName}** đã tham gia phòng!\n\n${BaCao.renderWaitingRoom(game)}`)
        .setColor(0x00FF00)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], components: [getWaitingButtons(game)] });
}

async function handleLeave(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const game = BaCao.leaveGame(guildId, channelId, userId);
    
    if (game === null) {
        const embed = createEmbed('🚪 Phòng Đã Đóng', 'Chủ phòng đã rời đi và phòng đã được đóng.', 0xFFA500);
        await interaction.reply({ embeds: [embed], components: [] });
    } else {
        const embed = createEmbed(
            '👋 Rời Phòng',
            `Bạn đã rời khỏi phòng.\n\n${BaCao.renderWaitingRoom(game)}`,
            0xFFA500
        );
        await interaction.reply({ embeds: [embed], components: [getWaitingButtons(game)] });
    }
}

async function handleReady(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const game = BaCao.setReady(guildId, channelId, userId);
    const player = game.players.find(p => p.id === userId);
    const readyStatus = player?.isReady ? '✅ đã sẵn sàng' : '⏳ hủy sẵn sàng';
    
    const embed = createEmbed(
        '🎴 Cập Nhật Trạng Thái',
        `**${player?.name}** ${readyStatus}!\n\n${BaCao.renderWaitingRoom(game)}`,
        player?.isReady ? 0x00FF00 : 0xFFFF00
    );
    
    await interaction.reply({ embeds: [embed], components: [getWaitingButtons(game)] });
}

async function handleStart(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const existingGame = BaCao.getGame(guildId, channelId);
    if (!existingGame) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    // Trừ xu của tất cả người chơi trước khi bắt đầu
    for (const player of existingGame.players) {
        const wallet = await walletModel.get(player.id, guildId);
        if (!wallet || wallet.coins < existingGame.betAmount) {
            throw new Error(`**${player.name}** không đủ xu để chơi!`);
        }
    }
    
    // Trừ xu
    for (const player of existingGame.players) {
        await walletModel.subtractCoins(player.id, guildId, existingGame.betAmount);
    }
    
    const game = BaCao.startGame(guildId, channelId, userId);
    
    // Lấy số xu còn lại của người gọi lệnh
    const myWallet = await walletModel.get(userId, guildId);
    const myCoins = myWallet?.coins || 0;
    
    const embed = new EmbedBuilder()
        .setTitle('🎴 VÁN CHƠI BẮT ĐẦU!')
        .setDescription(
            `Bài đã được chia! Mỗi người có 3 lá bài.\n\n` +
            `${BaCao.renderPlayingGame(game, userId, true)}\n\n` +
            `⚠️ **Dùng \`/bacao hand\` để xem bài của bạn (tin nhắn riêng)**\n` +
            `⚠️ **Dùng \`/bacao reveal\` để lật bài khi sẵn sàng**`
        )
        .setColor(0xFF6B6B)
        .setFooter({ text: `💰 Xu của bạn: ${myCoins.toLocaleString()} xu` })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], components: [getPlayingButtons(game, userId)] });
    
    // Gửi tin nhắn riêng cho mỗi người chơi với bài của họ
    for (const player of game.players) {
        try {
            const user = await interaction.client.users.fetch(player.id);
            if (player.hand) {
                const handEmbed = new EmbedBuilder()
                    .setTitle('🎴 Bài Của Bạn - Bài Cào 3 Lá')
                    .setDescription(BaCao.renderMyHand(player.hand))
                    .setColor(0x00BFFF)
                    .setFooter({ text: 'Dùng /bacao reveal khi bạn muốn lật bài!' });
                
                await user.send({ embeds: [handEmbed] });
            }
        } catch (e) {
            console.log(`Không thể gửi DM cho ${player.name}`);
        }
    }
}

async function handleReveal(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string, userName: string) {
    const game = BaCao.revealHand(guildId, channelId, userId);
    const player = game.players.find(p => p.id === userId);
    
    if (game.status === 'finished') {
        // Tất cả đã lật, xử lý thưởng
        const totalPot = game.totalPot;
        const activePlayers = game.players.filter(p => !p.hasFolded);
        const winner = activePlayers.find(p => p.id === game.winnerId);
        
        if (winner && winner.hand) {
            // Cộng xu cho người thắng
            await walletModel.addCoins(winner.id, guildId, totalPot);
            
            // Xác định loại bài để thống kê
            const handTypeName: HandTypeName = 
                winner.hand.handType === BaCao.HandType.LIEN ? 'LIEN' :
                winner.hand.handType === BaCao.HandType.SAP ? 'SAP' :
                winner.hand.handType === BaCao.HandType.BACH_THU ? 'BACH_THU' : 'NORMAL';
            
            // Cập nhật stats cho người thắng
            await statsModel.recordWin(winner.id, guildId, winner.name, totalPot, handTypeName);
            
            // Cập nhật stats cho người thua
            for (const loser of game.players) {
                if (loser.id !== winner.id) {
                    await statsModel.recordLoss(loser.id, guildId, loser.name, loser.currentBet);
                }
            }
            
            // Lưu lịch sử ván đấu
            await statsModel.saveGame({
                guildId,
                channelId,
                hostId: game.hostId,
                hostName: game.hostName,
                betAmount: game.betAmount,
                players: game.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    hand: p.hand ? {
                        cards: p.hand.cards,
                        score: p.hand.score,
                        handType: p.hand.handType
                    } : null
                })),
                winnerId: winner.id,
                winnerName: winner.name,
                winnerHand: handTypeName !== 'NORMAL' ? handTypeName : winner.hand.score.toString(),
                totalPot
            });
        }
        
        // Lấy số xu còn lại của người thắng
        const winnerWallet = await walletModel.get(winner!.id, guildId);
        const winnerCoins = winnerWallet?.coins || 0;

        // Hiển thị kết quả
        const resultEmbed = new EmbedBuilder()
            .setTitle('🏆 KẾT QUẢ VÁN CHƠI')
            .setDescription(
                `**${player?.name}** đã lật bài!\n\n` +
                `🎉 **Người thắng: ${game.winnerName}** 🎉\n` +
                `💰 **Nhận được: ${totalPot.toLocaleString()} xu**\n\n` +
                BaCao.renderGameResult(game.players) + '\n\n' +
                `💡 Dùng \`/bacao restart\` để chơi lại!`
            )
            .setColor(0xFFD700)
            .setFooter({ text: `💰 Xu của người thắng: ${winnerCoins.toLocaleString()} xu` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [resultEmbed], components: [] });
    } else {
        // Vẫn còn người chưa lật
        // Lấy số xu còn lại của người gọi lệnh
        const myWallet = await walletModel.get(userId, guildId);
        const myCoins = myWallet?.coins || 0;

        const embed = new EmbedBuilder()
            .setTitle('👁️ Lật Bài')
            .setDescription(
                `**${player?.name}** đã lật bài: ${player?.hand ? BaCao.renderHand(player.hand) : ''}\n\n` +
                `${BaCao.renderPlayingGame(game, userId, true)}`
            )
            .setColor(0x00BFFF)
            .setFooter({ text: `💰 Xu của bạn: ${myCoins.toLocaleString()} xu` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], components: [getPlayingButtons(game, userId)] });
    }
}

async function handleViewHand(interaction: ChatInputCommandInteraction, guildId: string, channelId: string, userId: string) {
    const game = BaCao.getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    if (game.status !== 'playing') {
        throw new Error('Game chưa bắt đầu hoặc đã kết thúc!');
    }
    
    const player = game.players.find(p => p.id === userId);
    if (!player) {
        throw new Error('Bạn không ở trong phòng này!');
    }
    
    if (!player.hand) {
        throw new Error('Bạn chưa được chia bài!');
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🎴 Bài Của Bạn')
        .setDescription(BaCao.renderMyHand(player.hand))
        .setColor(0x00BFFF)
        .setFooter({ text: 'Chỉ bạn nhìn thấy tin nhắn này' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleStatus(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const game = BaCao.getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi trong kênh này!');
    }
    
    // Lấy số xu còn lại của người gọi lệnh
    const myWallet = await walletModel.get(userId, guildId);
    const myCoins = myWallet?.coins || 0;
    
    let embed: EmbedBuilder;
    let components: ActionRowBuilder<ButtonBuilder>[] = [];
    
    if (game.status === 'waiting') {
        embed = new EmbedBuilder()
            .setTitle('🎴 Trạng Thái Phòng')
            .setDescription(BaCao.renderWaitingRoom(game))
            .setColor(0x00BFFF)
            .setFooter({ text: `💰 Xu của bạn: ${myCoins.toLocaleString()} xu` })
            .setTimestamp();
        components = [getWaitingButtons(game)];
    } else if (game.status === 'playing') {
        embed = new EmbedBuilder()
            .setTitle('🎴 Trạng Thái Ván Chơi')
            .setDescription(BaCao.renderPlayingGame(game, userId, false))
            .setColor(0xFF6B6B)
            .setFooter({ text: `💰 Xu của bạn: ${myCoins.toLocaleString()} xu` })
            .setTimestamp();
        components = [getPlayingButtons(game, userId)];
    } else {
        embed = new EmbedBuilder()
            .setTitle('🏆 Kết Quả Ván Chơi')
            .setDescription(
                `**Người thắng: ${game.winnerName}**\n\n` +
                BaCao.renderGameResult(game.players)
            )
            .setColor(0xFFD700)
            .setFooter({ text: `💰 Xu của bạn: ${myCoins.toLocaleString()} xu` })
            .setTimestamp();
        // Không hiện buttons khi kết thúc
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true, components });
}

async function handleEnd(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    BaCao.forceEndGame(guildId, channelId, userId);
    
    const embed = createEmbed(
        '🚪 Phòng Đã Đóng',
        'Chủ phòng đã kết thúc và đóng phòng chơi.',
        0xFF0000
    );
    
    await interaction.reply({ embeds: [embed], components: [] });
}

async function handleRestart(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const game = BaCao.restartGame(guildId, channelId, userId);
    
    const embed = new EmbedBuilder()
        .setTitle('🔄 Ván Mới')
        .setDescription(
            `Chủ phòng đã bắt đầu ván mới!\n\n${BaCao.renderWaitingRoom(game)}`
        )
        .setColor(0x00FF00)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], components: [getWaitingButtons(game)] });
}

async function handleRules(interaction: ChatInputCommandInteraction) {
    const rulesEmbed = new EmbedBuilder()
        .setTitle('📜 LUẬT CHƠI BÀI CÀO 3 LÁ')
        .setDescription(`
## 🎴 Giới Thiệu
Bài Cào 3 Lá (còn gọi là Tay 3 lá, 3 Cây, Ba Cào) là trò chơi bài đơn giản và thú vị!

## 📋 Cách Tính Điểm
- **A** = 1 điểm
- **2-9** = đúng số điểm
- **10, J, Q, K** = 0 điểm
- **Tổng điểm** = (Tổng 3 lá) mod 10

## 🏆 Xếp Hạng Bài (Cao → Thấp)
1. 🌟 **LIÊNG** - 3 lá liên tiếp cùng chất (VD: ♠️A ♠️2 ♠️3)
2. 💎 **SÁP** - 3 lá cùng số (VD: K K K)
3. 👑 **BẠCH THỦ** - 3 lá J/Q/K
4. 🎯 **Bài thường** - So điểm (0-9)

## 💰 Hệ Thống Xu
- Mới chơi: **1,000 xu**
- Nhận hàng ngày: **500 xu** (\`/bacao daily\`)
- Cược từ 10 - 10,000 xu/ván

## 🎮 Cách Chơi
1. \`/bacao create [bet]\` - Tạo phòng (bet mặc định: 100)
2. \`/bacao join\` - Tham gia phòng
3. \`/bacao ready\` - Sẵn sàng
4. \`/bacao start\` - Bắt đầu (chủ phòng)
5. \`/bacao hand\` - Xem bài của mình
6. \`/bacao reveal\` - Lật bài

## ⚡ Lệnh Khác
- \`/bacao wallet\` - Xem ví xu
- \`/bacao daily\` - Nhận xu hàng ngày
- \`/bacao leaderboard\` - Bảng xếp hạng
- \`/bacao stats\` - Thống kê cá nhân
        `)
        .setColor(0x9B59B6)
        .setFooter({ text: 'Chúc bạn chơi vui vẻ! 🎉' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [rulesEmbed], ephemeral: true });
}

async function handleWallet(interaction: ChatInputCommandInteraction, guildId: string, userId: string, userName: string) {
    const wallet = await walletModel.getOrCreate(userId, guildId, userName);
    
    const embed = new EmbedBuilder()
        .setTitle('💰 Ví Xu Của Bạn')
        .setDescription(`
**👤 ${userName}**

💵 **Số dư:** ${wallet.coins.toLocaleString()} xu

📊 **Thống kê:**
- 🎮 Số ván đã chơi: ${wallet.gamesPlayed}
- 🏆 Số ván thắng: ${wallet.gamesWon}
- 📈 Tổng xu thắng: ${wallet.totalWon.toLocaleString()}
- 📉 Tổng xu thua: ${wallet.totalLost.toLocaleString()}
- ⚖️ Lãi/Lỗ: ${(wallet.totalWon - wallet.totalLost).toLocaleString()} xu
        `)
        .setColor(0xFFD700)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDaily(interaction: ChatInputCommandInteraction, guildId: string, userId: string, userName: string) {
    const result = await walletModel.claimDaily(userId, guildId, userName);
    
    const embed = new EmbedBuilder()
        .setTitle(result.success ? '🎁 Nhận Xu Hàng Ngày' : '⏰ Đã Nhận Rồi')
        .setDescription(result.message)
        .setColor(result.success ? 0x00FF00 : 0xFFA500)
        .setTimestamp();
    
    if (result.success) {
        const wallet = await walletModel.get(userId, guildId);
        embed.addFields({ name: '💰 Số dư hiện tại', value: `${wallet?.coins.toLocaleString()} xu`, inline: true });
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction, guildId: string) {
    const type = interaction.options.getString('type') || 'coins';
    
    let leaderboard;
    let title: string;
    let icon: string;
    
    switch (type) {
        case 'wins':
            leaderboard = await statsModel.getLeaderboardByWins(guildId, 10);
            title = '🏆 Bảng Xếp Hạng - Thắng Nhiều Nhất';
            icon = '🏆';
            break;
        case 'streak':
            leaderboard = await statsModel.getLeaderboardByStreak(guildId, 10);
            title = '🔥 Bảng Xếp Hạng - Streak Cao Nhất';
            icon = '🔥';
            break;
        default:
            leaderboard = await walletModel.getLeaderboard(guildId, 10);
            title = '💰 Bảng Xếp Hạng - Giàu Nhất';
            icon = '💰';
    }
    
    if (!leaderboard || leaderboard.length === 0) {
        const embed = createEmbed('📊 Bảng Xếp Hạng', 'Chưa có dữ liệu! Hãy chơi vài ván để được lên bảng.', 0x00BFFF);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }
    
    let description = '';
    leaderboard.forEach((entry: any, index: number) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const name = entry.odName || 'Unknown';
        
        let value: string;
        switch (type) {
            case 'wins':
                value = `${entry.totalWins} thắng`;
                break;
            case 'streak':
                value = `${entry.bestStreak} streak`;
                break;
            default:
                value = `${entry.coins?.toLocaleString()} xu`;
        }
        
        description += `${medal} **${name}** - ${icon} ${value}\n`;
    });
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0xFFD700)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleStats(interaction: ChatInputCommandInteraction, guildId: string, userId: string, userName: string) {
    const stats = await statsModel.getOrCreate(userId, guildId, userName);
    const wallet = await walletModel.getOrCreate(userId, guildId, userName);
    
    const winRate = stats.totalGames > 0 
        ? ((stats.totalWins / stats.totalGames) * 100).toFixed(1) 
        : '0';
    
    const embed = new EmbedBuilder()
        .setTitle('📊 Thống Kê Bài Cào 3 Lá')
        .setDescription(`**👤 ${userName}**`)
        .addFields(
            { name: '💰 Số dư', value: `${wallet.coins.toLocaleString()} xu`, inline: true },
            { name: '🎮 Tổng ván', value: stats.totalGames.toString(), inline: true },
            { name: '📈 Tỷ lệ thắng', value: `${winRate}%`, inline: true },
            { name: '🏆 Thắng', value: stats.totalWins.toString(), inline: true },
            { name: '❌ Thua', value: stats.totalLosses.toString(), inline: true },
            { name: '🔥 Streak hiện tại', value: stats.currentStreak.toString(), inline: true },
            { name: '⭐ Streak cao nhất', value: stats.bestStreak.toString(), inline: true },
            { name: '💎 Xu thắng', value: stats.totalCoinsWon.toLocaleString(), inline: true },
            { name: '📉 Xu thua', value: stats.totalCoinsLost.toLocaleString(), inline: true },
            { name: '🌟 Liêng', value: stats.lienCount.toString(), inline: true },
            { name: '💎 Sáp', value: stats.sapCount.toString(), inline: true },
            { name: '👑 Bạch Thủ', value: stats.bachThuCount.toString(), inline: true }
        )
        .setColor(0x9B59B6)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function executeRaise(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string, userName: string, raiseAmount: number) {
    // Kiểm tra ví và số dư
    const game = BaCao.getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    const player = game.players.find(p => p.id === userId);
    if (!player) {
        throw new Error('Bạn không ở trong phòng này!');
    }
    
    // Tính số xu cần thêm
    const additionalNeeded = raiseAmount - player.currentBet;
    
    // Kiểm tra đủ xu không
    const wallet = await walletModel.get(userId, guildId);
    if (!wallet || wallet.coins < additionalNeeded) {
        throw new Error(`Bạn không đủ xu để raise! Cần thêm ${additionalNeeded.toLocaleString()} xu.`);
    }
    
    // Trừ xu và raise
    await walletModel.subtractCoins(userId, guildId, additionalNeeded);
    const { game: updatedGame, additionalBet } = BaCao.raiseGame(guildId, channelId, userId, userName, raiseAmount);
    
    // Lấy danh sách người cần call
    const pendingPlayers = BaCao.getPlayersNeedingCall(updatedGame);
    const pendingNames = pendingPlayers.map(p => `**${p.name}**`).join(', ');
    
    // Lấy số xu còn lại của người gọi lệnh
    const myWallet = await walletModel.get(userId, guildId);
    const myCoins = myWallet?.coins || 0;
    
    const embed = new EmbedBuilder()
        .setTitle('🔥 RAISE!')
        .setDescription(
            `**${userName}** đã raise lên **${raiseAmount.toLocaleString()} xu**!\n\n` +
            `💰 **Pot hiện tại:** ${updatedGame.totalPot.toLocaleString()} xu\n` +
            `📊 **Mức cược mới:** ${raiseAmount.toLocaleString()} xu\n\n` +
            (pendingPlayers.length > 0 
                ? `⏳ **Chờ:** ${pendingNames} theo cược hoặc bỏ bài`
                : '✅ Tất cả đã theo cược') +
            `\n\n${BaCao.renderPlayingGame(updatedGame, userId, true)}`
        )
        .setColor(0xFF4500)
        .setFooter({ text: `💰 Xu còn lại của bạn: ${myCoins.toLocaleString()} xu` })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], components: [getPlayingButtons(updatedGame, userId)] });
}

async function handleRaise(interaction: ChatInputCommandInteraction, guildId: string, channelId: string, userId: string, userName: string) {
    const raiseAmount = interaction.options.getInteger('amount', true);
    await executeRaise(interaction, guildId, channelId, userId, userName, raiseAmount);
}


async function handleCall(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string, userName: string) {
    const game = BaCao.getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    const player = game.players.find(p => p.id === userId);
    if (!player) {
        throw new Error('Bạn không ở trong phòng này!');
    }
    
    // Tính số xu cần thêm
    const additionalNeeded = game.currentRaise - player.currentBet;
    
    if (additionalNeeded <= 0) {
        throw new Error('Bạn đã theo cược rồi!');
    }
    
    // Kiểm tra đủ xu không
    const wallet = await walletModel.get(userId, guildId);
    if (!wallet || wallet.coins < additionalNeeded) {
        throw new Error(`Bạn không đủ xu để call! Cần ${additionalNeeded.toLocaleString()} xu.`);
    }
    
    // Trừ xu và call
    await walletModel.subtractCoins(userId, guildId, additionalNeeded);
    const { game: updatedGame, additionalBet } = BaCao.callGame(guildId, channelId, userId);
    
    // Lấy danh sách người cần call
    const pendingPlayers = BaCao.getPlayersNeedingCall(updatedGame);
    
    // Lấy số xu còn lại của người gọi lệnh
    const myWallet = await walletModel.get(userId, guildId);
    const myCoins = myWallet?.coins || 0;
    
    const embed = new EmbedBuilder()
        .setTitle('📞 CALL!')
        .setDescription(
            `**${userName}** đã theo cược **${additionalBet.toLocaleString()} xu**!\n\n` +
            `💰 **Pot hiện tại:** ${updatedGame.totalPot.toLocaleString()} xu\n\n` +
            (pendingPlayers.length > 0 
                ? `⏳ **Chờ:** ${pendingPlayers.map(p => `**${p.name}**`).join(', ')} theo cược hoặc bỏ bài`
                : '✅ Tất cả đã theo cược! Có thể lật bài.')
        )
        .setColor(0x00FF00)
        .setFooter({ text: `💰 Xu còn lại của bạn: ${myCoins.toLocaleString()} xu` })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], components: [getPlayingButtons(updatedGame, userId)] });
}

async function handleFold(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string, userName: string) {
    const game = BaCao.foldGame(guildId, channelId, userId);
    
    // Kiểm tra game đã kết thúc chưa (chỉ còn 1 người)
    if (game.status === 'finished') {
        const winner = game.players.find(p => p.id === game.winnerId);
        
        if (winner) {
            // Cộng xu cho người thắng
            await walletModel.addCoins(winner.id, guildId, game.totalPot);
            
            // Cập nhật stats
            await statsModel.recordWin(winner.id, guildId, winner.name, game.totalPot, 'NORMAL');
            
            // Cập nhật stats cho người thua (đã fold)
            for (const loser of game.players) {
                if (loser.id !== winner.id) {
                    await statsModel.recordLoss(loser.id, guildId, loser.name, loser.currentBet);
                }
            }
        }
        
        // Lấy số xu còn lại của người thắng (đã được cộng tiền)
        const winnerWallet = await walletModel.get(winner!.id, guildId);
        const winnerCoins = winnerWallet?.coins || 0;

        const embed = new EmbedBuilder()
            .setTitle('🏆 GAME KẾT THÚC!')
            .setDescription(
                `**${userName}** đã bỏ bài!\n\n` +
                `🎉 **${game.winnerName}** thắng cuộc vì tất cả người khác đã fold!\n` +
                `💰 **Nhận được:** ${game.totalPot.toLocaleString()} xu\n\n` +
                `💡 Dùng \`/bacao restart\` để chơi lại!`
            )
            .setColor(0xFFD700)
            .setFooter({ text: `💰 Xu của người thắng: ${winnerCoins.toLocaleString()} xu` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    } else {
        const activePlayers = game.players.filter(p => !p.hasFolded);
        
        // Lấy số xu còn lại của người gọi lệnh
        const myWallet = await walletModel.get(userId, guildId);
        const myCoins = myWallet?.coins || 0;

        const embed = new EmbedBuilder()
            .setTitle('❌ FOLD!')
            .setDescription(
                `**${userName}** đã bỏ bài!\n\n` +
                `👥 **Còn lại:** ${activePlayers.map(p => `**${p.name}**`).join(', ')}\n` +
                `💰 **Pot:** ${game.totalPot.toLocaleString()} xu`
            )
            .setColor(0xFF0000)
            .setFooter({ text: `💰 Xu còn lại của bạn: ${myCoins.toLocaleString()} xu` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], components: [getPlayingButtons(game, userId)] });
    }
}

export async function handleInteraction(interaction: Interaction) {
    if (!interaction.guildId || !interaction.channelId || !interaction.member) return;

    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    // @ts-ignore
    const userName = interaction.user.displayName || interaction.user.username; 

    try {
        if (interaction.isButton()) {
            switch (interaction.customId) {
                case 'bacao_join':
                    await handleJoin(interaction as RepliableInteraction, guildId, channelId, userId, userName);
                    break;
                case 'bacao_leave':
                    await handleLeave(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'bacao_ready':
                    await handleReady(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'bacao_start':
                    await handleStart(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'bacao_hand':
                    await handleStatus(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'bacao_call':
                    await handleCall(interaction as RepliableInteraction, guildId, channelId, userId, userName);
                    break;
                case 'bacao_fold':
                    await handleFold(interaction as RepliableInteraction, guildId, channelId, userId, userName);
                    break;
                case 'bacao_reveal':
                    await handleReveal(interaction as RepliableInteraction, guildId, channelId, userId, userName);
                    break;
                case 'bacao_raise_modal':
                    const modal = new ModalBuilder()
                        .setCustomId('bacao_raise_submit')
                        .setTitle('Tố Thêm (Raise)');
                    const amountInput = new TextInputBuilder()
                        .setCustomId('amount')
                        .setLabel("Số xu muốn tố thêm")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Nhập số xu (VD: 100)')
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput));
                    await interaction.showModal(modal);
                    break;
            }
        } else if (interaction.isModalSubmit()) {
             if (interaction.customId === 'bacao_raise_submit') {
                const amountStr = interaction.fields.getTextInputValue('amount');
                const amount = parseInt(amountStr);
                
                if (isNaN(amount) || amount <= 0) {
                     await interaction.reply({ content: '❌ Số xu không hợp lệ!', ephemeral: true });
                     return;
                }
                
                await executeRaise(interaction as RepliableInteraction, guildId, channelId, userId, userName, amount);
             }
        }
    } catch (error: any) {
         console.error('Lỗi interaction bacao:', error.message || error);
         const embed = createEmbed('❌ Lỗi', error.message || 'Có lỗi xảy ra!', 0xFF0000);
         if (interaction.isRepliable()) {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
         }
    }
}
