/**
 * Slash Command: /xidach
 * Trò chơi Xì Dách (Blackjack) với hệ thống cược
 */

import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    Interaction,
    RepliableInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import * as XiDach from '../../utils/xidachEngine.js';
import { GameWallet } from '../../models/gameWallet.js';

const walletModel = new GameWallet();

// ================== BUTTON HELPERS ==================

function getWaitingButtons(game: XiDach.XiDachGame): ActionRowBuilder<ButtonBuilder> {
    const joinBtn = new ButtonBuilder()
        .setCustomId('xidach_join')
        .setLabel('Tham gia')
        .setStyle(ButtonStyle.Success)
        .setDisabled(game.players.length >= 6);

    const leaveBtn = new ButtonBuilder()
        .setCustomId('xidach_leave')
        .setLabel('Rời phòng')
        .setStyle(ButtonStyle.Secondary);

    const startBtn = new ButtonBuilder()
        .setCustomId('xidach_start')
        .setLabel('Bắt đầu')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('▶️')
        .setDisabled(game.players.length < 1); // Cần ít nhất 1 người chơi (Host + 0 là vô lý, cần host + 1?) -> Logic cũ host+0 thì host tự kỷ? PvP cần >=2

    return new ActionRowBuilder<ButtonBuilder>().addComponents(joinBtn, leaveBtn, startBtn);
}

function getPlayingButtons(game: XiDach.XiDachGame): (ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>)[] {
    const currentPlayer = XiDach.getCurrentPlayer(game);
    const canDouble = currentPlayer?.hand?.cards.length === 2 && !currentPlayer?.isBusted;
    const isBusted = currentPlayer?.isBusted || false;
    
    // Nút Xem Bài luôn hiện
    const handBtn = new ButtonBuilder()
        .setCustomId('xidach_hand')
        .setLabel('Xem Bài')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👀');

    // Nút rút/dừng
    const hitBtn = new ButtonBuilder()
        .setCustomId('xidach_hit')
        .setLabel('Rút Bài')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🃏')
        .setDisabled(isBusted); // Disable nếu đã quắc

    const standBtn = new ButtonBuilder()
        .setCustomId('xidach_stand')
        .setLabel(game.status === 'dealer_turn' ? 'Chốt Sổ (Xét Hết)' : 'Dằn Non')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✋')
        .setDisabled(isBusted); // Disable nếu đã quắc

    // Nếu là lượt Dealer
    if (game.status === 'dealer_turn' && currentPlayer?.isDealer) {
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(hitBtn, standBtn, handBtn);
        const rows: any[] = [row1];

        // Menu chọn người xét bài (ngoại trừ dealer và người đã xét)
        const unrevealedPlayers = game.players.filter(p => !p.isRevealed && p.id !== currentPlayer.id);
        
        if (unrevealedPlayers.length > 0) {
            const options = unrevealedPlayers.map(p => new StringSelectMenuOptionBuilder()
                .setLabel(`Xét: ${p.name}`)
                .setDescription(`Đang cược: ${p.currentBet.toLocaleString()} xu`)
                .setValue(p.id)
                .setEmoji('🔍')
            );
            
            const revealSelect = new StringSelectMenuBuilder()
                .setCustomId('xidach_reveal')
                .setPlaceholder('🔍 Chọn người để khui bài ngay...')
                .addOptions(options);
            
            const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(revealSelect);
            rows.push(row2);
        }
        
        return rows;
    }

    // Lượt nhà con
    const doubleBtn = new ButtonBuilder()
        .setCustomId('xidach_double')
        .setLabel('Nhân Đôi')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💰')
        .setDisabled(!canDouble || isBusted); // Disable nếu không đủ điều kiện hoặc đã quắc

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(hitBtn, standBtn, doubleBtn, handBtn);
    
    return [row1];
}

function getFinishedButtons(): ActionRowBuilder<ButtonBuilder> {
    const restartBtn = new ButtonBuilder()
        .setCustomId('xidach_restart')
        .setLabel('Chơi Lại')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔄');

    const endBtn = new ButtonBuilder()
        .setCustomId('xidach_end')
        .setLabel('Đóng Phòng')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚪');

    return new ActionRowBuilder<ButtonBuilder>().addComponents(restartBtn, endBtn);
}

// Hàm tạo embed thông báo
function createEmbed(title: string, description: string, color: number = 0x2F3136): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
}

// ================== SLASH COMMAND DEFINITION ==================

export const data = new SlashCommandBuilder()
    .setName('xidach')
    .setDescription('🃏 Trò chơi Xì Dách (Blackjack)')
    .addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Tạo phòng chơi mới')
            .addIntegerOption(option =>
                option
                    .setName('bet')
                    .setDescription('Số xu cược (mặc định: 100)')
                    .setMinValue(10)
                    .setMaxValue(10000)
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
            .setName('start')
            .setDescription('Bắt đầu game (chủ phòng)')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('hit')
            .setDescription('Rút thêm bài')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('stand')
            .setDescription('Dừng rút bài')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('double')
            .setDescription('Nhân đôi cược và rút 1 lá')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('hand')
            .setDescription('Xem bài của bạn (riêng tư)')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Xem trạng thái bàn chơi')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('end')
            .setDescription('Đóng phòng (chủ phòng)')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('wallet')
            .setDescription('Xem ví xu của bạn')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('rules')
            .setDescription('Xem luật chơi')
    );

// ================== COMMAND HANDLERS ==================

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
            case 'start':
                await handleStart(interaction, guildId, channelId, userId);
                break;
            case 'hit':
                await handleHit(interaction, guildId, channelId, userId);
                break;
            case 'stand':
                await handleStand(interaction, guildId, channelId, userId);
                break;
            case 'double':
                await handleDouble(interaction, guildId, channelId, userId);
                break;
            case 'hand':
                await handleHand(interaction, guildId, channelId, userId);
                break;
            case 'status':
                await handleStatus(interaction, guildId, channelId, userId);
                break;
            case 'end':
                await handleEnd(interaction, guildId, channelId, userId);
                break;
            case 'wallet':
                await handleWallet(interaction, guildId, userId, userName);
                break;
            case 'rules':
                await handleRules(interaction);
                break;
            default:
                await interaction.reply({ content: 'Lệnh không hợp lệ!', ephemeral: true });
        }
    } catch (error: any) {
        console.error('Lỗi xidach command:', error.message || error);
        const embed = createEmbed('❌ Lỗi', error.message || 'Có lỗi xảy ra!', 0xFF0000);
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        } catch (e) {
            console.error('Không thể reply lỗi:', (e as Error).message);
        }
    }
}

// ================== HANDLER FUNCTIONS ==================

async function handleCreate(interaction: ChatInputCommandInteraction, guildId: string, channelId: string, userId: string, userName: string) {
    const betAmount = interaction.options.getInteger('bet') || 100;
    
    // Kiểm tra ví và số dư
    const wallet = await walletModel.getOrCreate(userId, guildId, userName);
    if (wallet.coins < betAmount) {
        throw new Error(`Bạn không đủ xu! Cần ${betAmount} xu nhưng chỉ có ${wallet.coins} xu.`);
    }
    
    const game = XiDach.createGame(guildId, channelId, userId, userName, betAmount);
    
    const embed = new EmbedBuilder()
        .setTitle('🃏 Phòng Xì Dách Đã Được Tạo!')
        .setDescription(XiDach.renderWaitingRoom(game))
        .setColor(0x00FF00)
        .setFooter({ text: 'Chờ người chơi khác tham gia...' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], components: [getWaitingButtons(game)] });
}

async function handleJoin(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string, userName: string) {
    const existingGame = XiDach.getGame(guildId, channelId);
    if (!existingGame) {
        throw new Error('Không tìm thấy phòng chơi! Dùng `/xidach create` để tạo phòng mới.');
    }
    
    // Kiểm tra ví và số dư
    const wallet = await walletModel.getOrCreate(userId, guildId, userName);
    if (wallet.coins < existingGame.betAmount) {
        throw new Error(`Bạn không đủ xu! Cần ${existingGame.betAmount} xu nhưng chỉ có ${wallet.coins} xu.`);
    }
    
    const game = XiDach.joinGame(guildId, channelId, userId, userName);
    
    const embed = new EmbedBuilder()
        .setTitle('🃏 Có Người Chơi Mới!')
        .setDescription(`**${userName}** đã tham gia phòng!\n\n${XiDach.renderWaitingRoom(game)}`)
        .setColor(0x00FF00)
        .setTimestamp();
    
    if (interaction.isButton()) {
        await (interaction as any).update({ embeds: [embed], components: [getWaitingButtons(game)] });
    } else {
        await interaction.reply({ embeds: [embed], components: [getWaitingButtons(game)] });
    }
}

async function handleLeave(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const game = XiDach.leaveGame(guildId, channelId, userId);
    
    if (game === null) {
        const embed = createEmbed('🚪 Phòng Đã Đóng', 'Chủ phòng đã rời đi và phòng đã được đóng.', 0xFFA500);
        if (interaction.isButton()) {
            await (interaction as any).update({ embeds: [embed], components: [] });
        } else {
            await interaction.reply({ embeds: [embed], components: [] });
        }
    } else {
        const embed = createEmbed(
            '👋 Rời Phòng',
            `Bạn đã rời khỏi phòng.\n\n${XiDach.renderWaitingRoom(game)}`,
            0xFFA500
        );
        if (interaction.isButton()) {
            await (interaction as any).update({ embeds: [embed], components: [getWaitingButtons(game)] });
        } else {
            await interaction.reply({ embeds: [embed], components: [getWaitingButtons(game)] });
        }
    }
}

async function handleStart(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const existingGame = XiDach.getGame(guildId, channelId);
    if (!existingGame) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    // Trừ xu cho tất cả người chơi (TRỪ DEALER)
    for (let i = 0; i < existingGame.players.length; i++) {
        const player = existingGame.players[i];
        
        // Nếu là Dealer (host hoặc người đến lượt làm cái) thì không trừ tiền cược
        if (i === existingGame.dealerIndex) continue;
        
        const wallet = await walletModel.get(player.id, guildId);
        if (!wallet || wallet.coins < existingGame.betAmount) {
            throw new Error(`${player.name} không đủ xu để chơi!`);
        }
        await walletModel.subtractCoins(player.id, guildId, existingGame.betAmount);
    }
    
    const game = XiDach.startGame(guildId, channelId, userId);
    
    const currentPlayer = XiDach.getCurrentPlayer(game);
    // renderTable bây giờ ẩn bài người chơi
    let description = XiDach.renderTable(game);
    
    if (currentPlayer) {
        description += `\n👉 **Lượt của ${currentPlayer.name}**`;
    }
    
    description += `\n\n💡 *Dùng nút "Xem Bài" để kiểm tra bài của bạn!*`;
    
    const embed = new EmbedBuilder()
        .setTitle('🃏 XÌ DÁCH - Game Bắt Đầu!')
        .setDescription(description)
        .setColor(0x2ECC71)
        .setTimestamp();
    
    if (interaction.isButton()) {
        await (interaction as any).update({ embeds: [embed], components: getPlayingButtons(game) });
    } else {
        await interaction.reply({ embeds: [embed], components: getPlayingButtons(game) });
    }
}

async function handleHit(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const game = XiDach.hit(guildId, channelId, userId);
    
    // Update public board
    await updateGameState(interaction, game, guildId, channelId);
    
    // Gửi bài mới cho người chơi (private)
    try {
        const handInfo = XiDach.renderPlayerHand(game, userId);
        await (interaction as any).followUp({ 
            content: `✨ Bạn vừa rút bài!\n${handInfo}`, 
            ephemeral: true 
        });
    } catch (e) {
        console.error('Không thể gửi private hand info:', e);
    }
}

async function handleStand(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const game = XiDach.stand(guildId, channelId, userId);
    
    await updateGameState(interaction, game, guildId, channelId);
}

async function handleDouble(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    // Kiểm tra đủ xu để nhân đôi
    const beforeGame = XiDach.getGame(guildId, channelId);
    if (!beforeGame) throw new Error('Không tìm thấy phòng chơi!');
    
    const player = beforeGame.players.find(p => p.id === userId);
    if (!player) throw new Error('Bạn không ở trong phòng này!');
    
    // Nếu không phải cái thì kiểm tra tiền
    if (!player.isDealer) {
        const wallet = await walletModel.get(userId, guildId);
        if (!wallet || wallet.coins < player.currentBet) {
            throw new Error(`Bạn không đủ xu để nhân đôi! Cần thêm ${player.currentBet.toLocaleString()} xu.`);
        }
        
        // Trừ thêm xu
        await walletModel.subtractCoins(userId, guildId, player.currentBet);
    }
    
    const game = XiDach.doubleDown(guildId, channelId, userId);
    
    // Update public board
    await updateGameState(interaction, game, guildId, channelId);
    
    // Gửi bài mới cho người chơi (private)
    try {
        const handInfo = XiDach.renderPlayerHand(game, userId);
        await (interaction as any).followUp({ 
            content: `💰 Bạn đã nhân đôi!\n${handInfo}`, 
            ephemeral: true 
        });
    } catch (e) {
        console.error('Không thể gửi private hand info:', e);
    }
}

async function handleHand(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const game = XiDach.getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi!');
    }
    
    // Không cần check lượt, ai cũng xem được bài mình
    const handInfo = XiDach.renderPlayerHand(game, userId);
    
    await interaction.reply({ content: handInfo, ephemeral: true });
}

async function updateGameState(interaction: RepliableInteraction, game: XiDach.XiDachGame, guildId: string, channelId: string) {
    // Nếu game đã kết thúc (do dealer stand/bust)
    if (game.status === 'finished') {
        await processGameResult(interaction, game, guildId, channelId);
        return;
    }
    
    const currentPlayer = XiDach.getCurrentPlayer(game);
    let description = XiDach.renderTable(game);
    
    if (currentPlayer) {
        description += `\n👉 **Lượt của ${currentPlayer.name}**`;
        if (game.status === 'dealer_turn') {
            description += ` (Nhà Cái)`;
        }
    }
    
    description += `\n\n💡 *Dùng nút "Xem Bài" để kiểm tra bài của bạn!*`;
    
    const embed = new EmbedBuilder()
        .setTitle('🃏 XÌ DÁCH')
        .setDescription(description)
        .setColor(0x2ECC71)
        .setTimestamp();
    
    if (interaction.isButton()) {
        await (interaction as any).update({ embeds: [embed], components: getPlayingButtons(game) });
    } else {
        await interaction.reply({ embeds: [embed], components: getPlayingButtons(game) });
    }
}

async function processGameResult(interaction: RepliableInteraction, game: XiDach.XiDachGame, guildId: string, channelId: string) {
    // Logic tính tiền PvP
    const dealer = game.players[game.dealerIndex];
    
    for (const player of game.players) {
        if (player.id === dealer.id) continue; // Skip dealer loop

        // Logic luồng tiền:
        // - Start: Player bị trừ Bet (subtractCoins -> track totalLost).
        // - End:
        //   - Player Win: refundBet(betAmount) + addCoins(winAmount) -> Dealer subtractCoins(winAmount)
        //   - Player Lose: Không làm gì với Player (đã trừ) -> Dealer addCoins(betAmount)
        //   - Push: refundBet(betAmount)

        let moneyChange = 0;
        
        if (player.result === 'blackjack') {
            // Thắng blackjack: x1.5
            const winAmount = Math.floor(player.currentBet * 1.5);
            
            // Hoàn vốn cho Player (không track statistics)
            await walletModel.refundBet(player.id, guildId, player.currentBet);
            // Cộng tiền thắng (track vào totalWon)
            await walletModel.addCoins(player.id, guildId, winAmount);
            
            // Dealer mất tiền (track vào totalLost)
            await walletModel.subtractCoins(dealer.id, guildId, winAmount);
            
            moneyChange = winAmount;
            
        } else if (player.result === 'win') {
            // Thắng thường: x1
            const winAmount = player.currentBet;
            
            await walletModel.refundBet(player.id, guildId, player.currentBet);
            await walletModel.addCoins(player.id, guildId, winAmount);
            await walletModel.subtractCoins(dealer.id, guildId, winAmount);
            
            moneyChange = winAmount;
            
        } else if (player.result === 'push') {
            // Hòa: Hoàn cược (không track statistics)
            await walletModel.refundBet(player.id, guildId, player.currentBet);
            
            moneyChange = 0;
            
        } else if (player.result === 'lose') {
             // Thua: Player đã bị trừ tiền. Dealer nhận tiền (track vào totalWon)
             await walletModel.addCoins(dealer.id, guildId, player.currentBet);
             
             moneyChange = -player.currentBet;
        }
        
        // Gửi DM cho người chơi về kết quả
        try {
            const playerUser = await (interaction as any).client.users.fetch(player.id);
            let dmMessage = `🎴 **Xì Dách - Kết quả ván chơi**\n\n`;
            
            if (player.result === 'blackjack') {
                dmMessage += `🎰 **XÌ DÁCH!** Bạn thắng!\n`;
            } else if (player.result === 'win') {
                dmMessage += `🎉 **THẮNG!**\n`;
            } else if (player.result === 'lose') {
                dmMessage += `💸 **THUA!**\n`;
            } else if (player.result === 'push') {
                dmMessage += `🤝 **HÒA!**\n`;
            }
            
            if (moneyChange > 0) {
                dmMessage += `💰 **+${moneyChange.toLocaleString()} xu**\n`;
            } else if (moneyChange < 0) {
                dmMessage += `💸 **${moneyChange.toLocaleString()} xu**\n`;
            } else {
                dmMessage += `🤝 **±0 xu** (Hoàn cược)\n`;
            }
            
            // Thêm thông tin số dư mới
            const wallet = await walletModel.get(player.id, guildId);
            if (wallet) {
                dmMessage += `\n💼 **Số dư hiện tại:** ${wallet.coins.toLocaleString()} xu`;
            }
            
            await playerUser.send(dmMessage);
        } catch (dmError) {
            // Người chơi tắt DM, bỏ qua
            console.log(`Không thể gửi DM cho ${player.name}:`, (dmError as Error).message);
        }
    }
    
    // Gửi DM cho Dealer về tổng kết
    try {
        const dealerUser = await (interaction as any).client.users.fetch(dealer.id);
        const wallet = await walletModel.get(dealer.id, guildId);
        
        let dmMessage = `🏦 **Xì Dách - Kết quả làm Nhà Cái**\n\n`;
        dmMessage += `Ván chơi đã kết thúc!\n`;
        
        if (wallet) {
            dmMessage += `💼 **Số dư hiện tại:** ${wallet.coins.toLocaleString()} xu`;
        }
        
        await dealerUser.send(dmMessage);
    } catch (dmError) {
        console.log(`Không thể gửi DM cho Dealer ${dealer.name}:`, (dmError as Error).message);
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🏆 XÌ DÁCH - Kết Quả!')
        .setDescription(XiDach.renderTable(game)) // Engine sẽ implement hàm này hoặc dùng renderTable với status finished? check lại
        .setColor(0xFFD700)
        .setTimestamp();
        
    // Cần đảm bảo renderGameResult/renderTable hiển thị đúng
    // Ở Engine hiện tại chưa có renderGameResult, mà dùng chung renderTable?
    // Check lại code cũ: Có renderGameResult không? -> Có vẻ chưa thấy trong file view.
    // Thường dùng renderTable(game) khi status='finished' sẽ hiện full bài.
    // Mình sẽ sửa đoạn này dùng renderTable(game).
    
    embed.setDescription(XiDach.renderTable(game));

    if (interaction.isButton()) {
        await (interaction as any).update({ embeds: [embed], components: [getFinishedButtons()] });
    } else {
        await interaction.reply({ embeds: [embed], components: [getFinishedButtons()] });
    }
}

async function handleStatus(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const game = XiDach.getGame(guildId, channelId);
    if (!game) {
        throw new Error('Không tìm thấy phòng chơi trong kênh này!');
    }
    
    const wallet = await walletModel.get(userId, guildId);
    const myCoins = wallet?.coins || 0;
    
    let embed: EmbedBuilder;
    let components: (ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>)[] = [];
    
    if (game.status === 'waiting') {
        embed = new EmbedBuilder()
            .setTitle('🃏 Trạng Thái Phòng')
            .setDescription(XiDach.renderWaitingRoom(game))
            .setColor(0x00BFFF)
            .setFooter({ text: `💰 Xu của bạn: ${myCoins.toLocaleString()} xu` })
            .setTimestamp();
        components = [getWaitingButtons(game)];
    } else if (game.status === 'playing' || game.status === 'dealer_turn') {
        embed = new EmbedBuilder()
            .setTitle('🃏 Bàn Chơi')
            .setDescription(XiDach.renderTable(game))
            .setColor(0x2ECC71)
            .setFooter({ text: `💰 Xu của bạn: ${myCoins.toLocaleString()} xu` })
            .setTimestamp();
        components = getPlayingButtons(game);
    } else {
        embed = new EmbedBuilder()
            .setTitle('🏆 Kết Quả')
            .setDescription(XiDach.renderGameResult(game))
            .setColor(0xFFD700)
            .setFooter({ text: `💰 Xu của bạn: ${myCoins.toLocaleString()} xu` })
            .setTimestamp();
        components = [getFinishedButtons()];
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true, components });
}

async function handleEnd(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    XiDach.endGame(guildId, channelId, userId);
    
    const embed = createEmbed(
        '🚪 Phòng Đã Đóng',
        'Chủ phòng đã kết thúc và đóng phòng chơi.',
        0xFF0000
    );
    
    if (interaction.isButton()) {
        await (interaction as any).update({ embeds: [embed], components: [] });
    } else {
        await interaction.reply({ embeds: [embed], components: [] });
    }
}

async function handleRestart(interaction: RepliableInteraction, guildId: string, channelId: string, userId: string) {
    const game = XiDach.restartGame(guildId, channelId, userId);
    
    const embed = new EmbedBuilder()
        .setTitle('🔄 Ván Mới')
        .setDescription(`Chủ phòng đã bắt đầu ván mới!\n\n${XiDach.renderWaitingRoom(game)}`)
        .setColor(0x00FF00)
        .setTimestamp();
    
    if (interaction.isButton()) {
        try {
            // Update tin nhắn kết quả cũ: Xóa hết nút để tránh bấm lại, giữ nguyên nội dung
            await (interaction as any).update({ components: [] });
            
            // Gửi tin nhắn mới cho ván tiếp theo
            await (interaction as any).followUp({ 
                embeds: [embed], 
                components: [getWaitingButtons(game)] 
            });
        } catch (e) {
            // Fallback nếu lỗi
            await interaction.reply({ 
                embeds: [embed], 
                components: [getWaitingButtons(game)] 
            });
        }
    } else {
        await interaction.reply({ embeds: [embed], components: [getWaitingButtons(game)] });
    }
}

async function handleWallet(interaction: ChatInputCommandInteraction, guildId: string, userId: string, userName: string) {
    const wallet = await walletModel.getOrCreate(userId, guildId, userName);
    
    const embed = new EmbedBuilder()
        .setTitle('💰 Ví Xu Của Bạn')
        .setDescription(`**Số dư:** ${wallet.coins.toLocaleString()} xu`)
        .addFields(
            { name: '📈 Tổng thắng', value: wallet.totalWon.toLocaleString() + ' xu', inline: true },
            { name: '📉 Tổng thua', value: wallet.totalLost.toLocaleString() + ' xu', inline: true }
        )
        .setColor(0xF1C40F)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRules(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
        .setTitle('📜 LUẬT CHƠI XÌ DÁCH')
        .setDescription(`
## 🎯 Mục Tiêu
Có tổng điểm **gần 21 nhất** mà không vượt quá.

## 🃏 Tính Điểm
• **A (Át)**: 1 hoặc 11 điểm (tự động chọn có lợi)
• **2-10**: Đúng số
• **J, Q, K**: 10 điểm

## 🏆 Các Tay Đặc Biệt
• **🐉 Ngũ Linh**: 5 lá có tổng ≤ 21 → Thắng cao nhất
• **🎰 Xì Dách**: A + lá 10 điểm (10/J/Q/K) = 21 tự nhiên → Thắng x1.5
• **👑 Xì Bàng**: 2 lá A → Tương đương Xì Dách

## 🎮 Các Hành Động
• **Rút (Hit)**: Lấy thêm 1 lá bài
• **Dừng (Stand)**: Không rút thêm
• **Nhân Đôi (Double)**: Cược x2, rút 1 lá rồi dừng

## ❌ Quắc (Bust)
Nếu tổng điểm > 21 → **Thua ngay!**

## 🏦 Nhà Cái (PvP)
• **Khui Bài**: Nhà cái được quyền chọn xét bài người chơi bất kỳ trong lượt của mình.
• **So Bài Ngay**: Thắng rút tiền, thua trả tiền ngay.
• **Xoay Vòng**: Sau 5 ván, người làm Cái sẽ được chuyển cho người kế tiếp.
        `)
        .setColor(0x9B59B6)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleReveal(interaction: RepliableInteraction & { values: string[] }, guildId: string, channelId: string, userId: string) {
    const targetId = interaction.values[0];
    
    try {
        // Gọi engine
        const { game, result } = XiDach.revealPlayer(guildId, channelId, userId, targetId);
    
        // Xử lý tiền ngay lập tức
        const dealer = game.players[game.dealerIndex];
        const target = game.players.find(p => p.id === targetId)!;
        
        const betAmount = target.currentBet;
        let resultText = '';
        let moneyChange = 0;

        if (result === 'blackjack') {
             // Thắng blackjack: x1.5
             const winAmount = Math.floor(betAmount * 1.5);
             
             await walletModel.refundBet(target.id, guildId, betAmount);
             await walletModel.addCoins(target.id, guildId, winAmount);
             await walletModel.subtractCoins(dealer.id, guildId, winAmount);
             
             resultText = 'Thắng Xì Dách (x1.5)! 🎉';
             moneyChange = winAmount; // Lời thuần
             
        } else if (result === 'win') {
             // Thắng thường
             const winAmount = betAmount;
             
             await walletModel.refundBet(target.id, guildId, betAmount);
             await walletModel.addCoins(target.id, guildId, winAmount);
             await walletModel.subtractCoins(dealer.id, guildId, winAmount);
             
             resultText = 'Thắng! 🎉';
             moneyChange = winAmount;
             
        } else if (result === 'push') {
              // Hòa: Hoàn cược
              await walletModel.refundBet(target.id, guildId, betAmount);
              resultText = 'Hòa! 🤝';
              moneyChange = 0;
              
        } else if (result === 'lose') {
              // Thua: Dealer nhận cược
              await walletModel.addCoins(dealer.id, guildId, betAmount);
              resultText = 'Thua! 💸';
              moneyChange = -betAmount;
        }
        
        // Gửi DM cho người bị khui bài
        try {
            const targetUser = await (interaction as any).client.users.fetch(targetId);
            let dmMessage = `🎴 **Xì Dách - Kết quả của bạn**\n\n`;
            dmMessage += `Nhà cái **${dealer.name}** đã khui bài bạn!\n`;
            dmMessage += `Kết quả: **${resultText}**\n\n`;
            
            if (moneyChange > 0) {
                dmMessage += `💰 **+${moneyChange.toLocaleString()} xu** (Thắng)\n`;
            } else if (moneyChange < 0) {
                dmMessage += `💸 **${moneyChange.toLocaleString()} xu** (Thua)\n`;
            } else {
                dmMessage += `🤝 **±0 xu** (Hòa - Hoàn cược)\n`;
            }
            
            await targetUser.send(dmMessage);
        } catch (dmError) {
            // Người chơi tắt DM, bỏ qua
            console.log(`Không thể gửi DM cho ${target.name}:`, (dmError as Error).message);
        }
        
        // Reply ephemeral báo kết quả cho Dealer
        await (interaction as any).reply({ 
            content: `🔍 Khui bài **${target.name}**: Người chơi **${resultText}**`, 
            ephemeral: true 
        });

        // Update table message manually because interaction is already replied
        if ((interaction as any).message) {
             const currentPlayer = XiDach.getCurrentPlayer(game);
             let description = XiDach.renderTable(game);
             if (currentPlayer) {
                description += `\n👉 **Lượt của ${currentPlayer.name}** (Nhà Cái)`;
             }
             description += `\n\n💡 *Dùng nút "Xem Bài" để kiểm tra bài của bạn!*`;

             const embed = new EmbedBuilder()
                .setTitle('🃏 XÌ DÁCH')
                .setDescription(description)
                .setColor(0x2ECC71)
                .setTimestamp();
             
             // Gọi getPlayingButtons để lấy components mới (loại bỏ người vừa khui khỏi list)
             const components = getPlayingButtons(game);
             
             await (interaction as any).message.edit({ embeds: [embed], components });
        }
        
    } catch (e: any) {
        if (!(interaction as any).replied) {
            await (interaction as any).reply({ content: `Lỗi: ${e.message}`, ephemeral: true });
        }
    }
}

// ================== BUTTON INTERACTION HANDLER ==================

export async function handleInteraction(interaction: Interaction) {
    if (!interaction.guildId || !interaction.channelId || !interaction.member) return;

    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const userName = (interaction.member as any).displayName || interaction.user.username;

    try {
        if (interaction.isButton()) {
            const game = XiDach.getGame(guildId, channelId);
            
            // Check game existence for playing actions
            if (!game && !['xidach_create'].includes(interaction.customId)) {
                if (interaction.customId === 'xidach_join') {
                     // Join có thể xử lý riêng nếu game null
                } else {
                    const embed = createEmbed(
                        '⚠️ Phòng Không Tồn Tại',
                        'Phòng chơi đã hết hạn hoặc bot vừa restart.\n\nDùng `/xidach create` để tạo phòng mới!',
                        0xFFA500
                    );
                    await (interaction as any).update({ embeds: [embed], components: [] });
                    return;
                }
            }

            switch (interaction.customId) {
                case 'xidach_join':
                    await handleJoin(interaction as RepliableInteraction, guildId, channelId, userId, userName);
                    break;
                case 'xidach_leave':
                    await handleLeave(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'xidach_start':
                    await handleStart(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'xidach_hit':
                    await handleHit(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'xidach_stand':
                    await handleStand(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'xidach_double':
                    await handleDouble(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'xidach_hand':
                    await handleHand(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'xidach_restart':
                    await handleRestart(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
                case 'xidach_end':
                    await handleEnd(interaction as RepliableInteraction, guildId, channelId, userId);
                    break;
            }
        } else if (interaction.isStringSelectMenu()) {
             if (interaction.customId === 'xidach_reveal') {
                 await handleReveal(interaction as any, guildId, channelId, userId);
             }
        }
    } catch (error: any) {
        console.error('Lỗi interaction xidach:', error.message || error);
        const embed = createEmbed('❌ Lỗi', error.message || 'Có lỗi xảy ra!', 0xFF0000);
        try {
            if ((interaction as any).isRepliable() && !(interaction as any).replied && !(interaction as any).deferred) {
                await (interaction as any).reply({ embeds: [embed], ephemeral: true });
            }
        } catch (e) {
            console.error('Không thể reply lỗi:', (e as Error).message);
        }
    }
}
