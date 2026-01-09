import { EmbedBuilder, Message } from 'discord.js';
import { GlobalChat, GlobalChatMessage, GlobalChatResult } from '../../models/global_chat.js';
import '../../utils/logger.js';
import { ExecuteParams, Command } from './types.js';
import { GenerativeModel } from '@google/generative-ai';

const FALLBACK_MODELS = [
    'gemini-2.0-flash-lite-preview',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-lite-001',
    'gemini-flash-lite-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-exp',
    'gemini-flash-latest',
    'gemini-pro-latest'
];

interface GlobalChatCommand extends Command {
    showGlobalChatList(message: Message): Promise<void>;
    startNewGlobalChat(message: Message): Promise<void>;
    continueGlobalChat(message: Message, chatId: string): Promise<void>;
    deleteGlobalChatHistory(message: Message, chatId: string | null): Promise<void>;
    processGlobalChatMessage(message: Message, args: string[], model: GenerativeModel, sendEmbedMessage: Function, createModel: (model: string) => GenerativeModel): Promise<void>;
    summarizeAndUpdateGlobalChatTitle(model: any): Promise<void>;
}

export default {
    name: 'gai',
    description: 'Trò chuyện AI trong chat toàn cục với các cuộc trò chuyện riêng biệt',

    async execute({ message, args, config, logModAction, sendEmbedMessage, client, model, gchatM, createModel }: ExecuteParams): Promise<void> {
        const subCommand: string | null = args[0] ? args[0].toLowerCase() : null;

        switch (subCommand) {
            case 'history':
                return await this.showGlobalChatList(message);

            case 'newchat.js':
                return await this.startNewGlobalChat(message);

            case 'continue':
                return await this.continueGlobalChat(message, args[1]);

            case 'deletehistory':
                return await this.deleteGlobalChatHistory(message, args[1]);

            default:
                return await this.processGlobalChatMessage(message, args, model, sendEmbedMessage, createModel);
        }
    },

    async deleteGlobalChatHistory(message: Message, chatId: string | null = null): Promise<void> {
        try {
            const userId: string = message.author.id;
            let processingMsg;
            const gChatModel = new GlobalChat();
            if (chatId) {
                if (!chatId.match(/^g\d+$/)) {
                    message.reply('❌ ID cuộc trò chuyện không hợp lệ. ID phải có định dạng "g" theo sau là một số, ví dụ: a1, a2, a3, ...');
                    return;
                }
                if ('send' in message.channel) {
                    processingMsg = await message.channel.send(`🗑️ Đang xóa cuộc trò chuyện ${chatId}...`);
                }
                try {
                    await gChatModel.deleteGlobalChatById(chatId);
                    await processingMsg?.delete().catch(() => {});
                    await message.reply(`✅ Đã xóa cuộc trò chuyện ${chatId}.`);
                    console.log(`User ${message.author.tag} (${userId}) đã xóa cuộc trò chuyện ${chatId}.`);
                } catch (error: any) {
                    await processingMsg?.delete().catch(() => {});
                    await message.reply(`❌ ${error.message}`);
                }
            } else {
                if ('send' in message.channel) {
                    processingMsg = await message.channel.send('🗑️ Đang xóa toàn bộ lịch sử trò chuyện...');    
                }
                await gChatModel.deleteGlobalChatHistory();
                await gChatModel.createNewGlobalChat(userId);
                await processingMsg?.delete().catch(() => {});
                await message.reply('✅ Đã xóa tất cả lịch sử trò chuyện của bạn với AI. Một cuộc trò chuyện mới đã được tạo.');
                console.log(`User ${message.author.tag} (${userId}) đã xóa toàn bộ lịch sử trò chuyện AI.`);
                return;
            }
        } catch (error: any) {
            console.error(`Lỗi khi xóa lịch sử trò chuyện: ${error.message}`);
            message.reply('❌ Có lỗi xảy ra khi xóa lịch sử trò chuyện. Vui lòng thử lại sau.');
        }
    },
    async showGlobalChatList(message: Message): Promise<void> {
        try {
            const globalChatM = new GlobalChat();
            const chatList: GlobalChatResult[] = await globalChatM.getGlobalChatsWithMessageCounts();

            if (chatList.length === 0) {
                message.reply('Chưa có cuộc trò chuyện nào. 🪹');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('Danh Sách Chat Toàn Cục')
                .setColor('#00FF00')
                .setDescription('Các cuộc trò chuyện hiện có:')
                .setFooter({
                    text: `Yêu cầu bởi ${message.author.tag}`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTimestamp();

            for (const chat of chatList) {
                embed.addFields({
                    name: `Chat ID: ${chat.chat_id}`,
                    value: `Số tin nhắn: ${chat?._count?.global_chat_messages || 0}`,
                    inline: false
                });
            }
            if ('send' in message.channel) {
                await message.channel.send({ embeds: [embed] });
                return;
            }

        } catch (error: any) {
            console.error(`❌ Lỗi khi xem danh sách chat: ${error.message}`);
            message.reply('❌ Có lỗi xảy ra khi lấy danh sách chat.');
        }
    },

    async startNewGlobalChat(message: Message): Promise<void> {
        const senderId: string = message.author.id;
        try {
            const globalChatM = new GlobalChat();
            await globalChatM.createNewGlobalChat(senderId);
            await message.reply('Đã tạo cuộc trò chuyện mới. Bạn có thể bắt đầu trò chuyện với lệnh `!gai`.');
            console.log(`User ${message.author.tag} (${senderId}) đã tạo cuộc trò chuyện mới.`);
        } catch (error: any) {
            console.error(`Lỗi khi tạo cuộc trò chuyện mới: ${error.message}`);
            message.reply('Có lỗi xảy ra khi tạo cuộc trò chuyện mới. Vui lòng thử lại sau.');
        }
    },

    async continueGlobalChat(message: Message, chatId: string): Promise<void> {
        if (!chatId || !chatId.startsWith('g')) {
            message.reply('💁 Vui lòng cung cấp Chat ID hợp lệ (ví dụ: g1, g2).');
            return;
        }
        try {
            const globalChatM = new GlobalChat();
            const chats: GlobalChatResult[] = await globalChatM.getGlobalChats();
            const targetChat = chats.find(chat => chat.chat_id === chatId);
            if (!targetChat) {
                message.reply(`Không tìm thấy cuộc trò chuyện với ID "${chatId}". Vui lòng kiểm tra lại hoặc sử dụng lệnh \`!chats\` để xem danh sách cuộc trò chuyện của bạn.`);
                return;
            }
            
            await globalChatM.save({id: targetChat.id, updated_at: new Date()});
            const messages: GlobalChatMessage[] = await globalChatM.getGlobalChatMessages(targetChat.id, 5);
            if (messages.length === 0) {
                message.reply(`Không tìm thấy tin nhắn trong chat ${chatId}. 🙈`);
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`Tiếp tục Chat: ${chatId}`)
                .setColor('#0099ff')
                .setDescription('Các tin nhắn gần đây:')
                .setFooter({
                    text: `Yêu cầu bởi ${message.author.tag}`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTimestamp();

            messages.forEach(msg => {
                const roleName = msg.role === 'user' ? '👤' : '🤖';
                const uid = msg.role === 'user' ? msg.name : "";
                embed.addFields({
                    name: `${roleName} ${uid}`,
                    value: msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''),
                    inline: false
                });
            });
            if ('send' in message.channel) {
                await message.channel.send({ embeds: [embed] });
            }
            message.reply(`Đã chuyển đến chat ${chatId}. Bạn có thể tiếp tục trò chuyện. 💬`);
            
        } catch (error: any) {
            console.error(`❌ Lỗi khi tiếp tục chat: ${error.message}`);
            message.reply('❌ Có lỗi xảy ra khi tiếp tục chat.');
        }
    },

    async processGlobalChatMessage(message: Message, args: string[], model: GenerativeModel, sendEmbedMessage: Function, createModel: (model: string) => GenerativeModel): Promise<void> {
        if (!args.length) {
            message.reply('Vui lòng nhập nội dung để trò chuyện với AI. 💬');
            return;
        }

        const userId: string = message.author.id;
        const userName: string = message.author.displayName;
        const prompt: string = args.join(' ');
        let processingMsg;
        try {
            const globalChatM = new GlobalChat();
            if ('send' in message.channel) {
                processingMsg = await message.channel.send('🤔 Chờ bố mài 1 tý ...');
            }
            const currentChat = await globalChatM.getCurrentGlobalChat();
            let historyRows = await globalChatM.getGlobalChatMessages(currentChat.id, 5);
            let conversation = historyRows.map(row => ({
                role: row.role,
                parts: [{ text: row.content }]
            }));

            const models = [model, ...FALLBACK_MODELS.map(m => createModel(m))];
            let content = '';
            let usedModel = model;
            let success = false;

            for (let i = 0; i < models.length; i++) {
                const currentModel = models[i];
                try {
                    if (conversation.length === 0) {
                        const result = await currentModel.generateContent(prompt);
                        content = result.response.text();
                    } else {
                        try {
                            const chat = currentModel.startChat({
                                history: conversation,
                                generationConfig: { maxOutputTokens: 1000 }
                            });
                            const result = await chat.sendMessage(prompt);
                            content = result.response.text();
                        } catch (chatError: any) {
                            if (chatError.message?.includes('429') || chatError.status === 429) {
                                throw chatError;
                            }
                            console.error(`⚠️ Lỗi startChat (non-quota): ${chatError.message}. Đang thử fallback sang generateContent (không history)...`);
                            const result = await currentModel.generateContent(prompt);
                            content = result.response.text();
                        }
                    }
                    usedModel = currentModel;
                    success = true;
                    break;
                } catch (error: any) {
                    const isQuota = error.message?.includes('429') || error.status === 429;
                    if (isQuota && i < models.length - 1) {
                        console.log(`⚠️ Model limit reached, switching to backup model... (${i + 1}/${models.length})`);
                        continue;
                    }
                    if (i === models.length - 1) {
                         // Last attempt failed
                         if (error.message?.includes('429')) {
                             message.reply('❌ Tất cả các model đều đang bận hoặc hết hạn mức. Vui lòng thử lại sau.');
                             await processingMsg?.delete();
                             return;
                         }
                        // Handle other errors normally or try new chat logic
                         console.error(`Lỗi khi gọi AI: ${error.message}`);
                         if (!isQuota) {
                             await processingMsg?.delete();
                             message.reply('❌ Có lỗi xảy ra khi gọi AI.');
                             return;
                         }
                    }
                }
            }

            if (success) {
                await globalChatM.addGlobalChatMessage(userId, 'user', prompt, userName);
                await globalChatM.addGlobalChatMessage(userId, 'model', content, userName);
                // Chạy ngầm việc tóm tắt, không await
                this.summarizeAndUpdateGlobalChatTitle(usedModel).catch(e => console.error("Lỗi tóm tắt ngầm:", e));
                await processingMsg?.delete();
                await sendEmbedMessage(message.channel, message.author, content);
            }

        } catch (error: any) {
            console.log(`❌ Lỗi trong chat toàn cục: ${error.message}`);
            message.reply('❌ Có lỗi xảy ra khi gọi AI. Vui lòng thử lại sau.');
        }
    },
    async summarizeAndUpdateGlobalChatTitle(model: any): Promise<void> {
        try {
            const globalChatM = new GlobalChat();
            const currentChat = await globalChatM.getCurrentGlobalChat();
            
            if (currentChat.title && !currentChat.title.startsWith(`[${currentChat.chat_id}]`)) {
                // If title already exists and is not just the ID, skip
                return;
            }
            
            // Lấy 5 tin nhắn gần đây
            const messages = await globalChatM.getGlobalChatMessages(currentChat.id, 5);

            if (messages.length === 0) {
                return;
            }

            // Tạo context cho AI
            let context = messages.map(msg => 
                `${msg.role === 'user' ? 'Người dùng' : 'AI'}: ${msg.content}`
            ).reverse().join('\n');

            // Prompt để tóm tắt
            const prompt = `Dựa vào đoạn hội thoại sau, hãy tạo một tiêu đề ngắn gọn (dưới 50 ký tự) cho cuộc trò chuyện này:\n\n${context}\n\nTiêu đề:`;

            // Gọi AI để tóm tắt với giới hạn token thấp
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 100 }
            });
            let title = result.response.text().trim();

            // Đảm bảo tiêu đề không quá dài
            if (title.length > 50) {
                title = title.substring(0, 47) + '...';
            }

            // Thêm chat_id vào tiêu đề
            title = `[${currentChat.chat_id}] ${title}`;

            // Cập nhật tiêu đề
            await globalChatM.updateChatTitle(currentChat.id, title);

            console.log(`✅ Đã cập nhật tiêu đề cho cuộc trò chuyện ${currentChat.id}: ${title}`);

        } catch (error) {
            console.error('Lỗi khi tóm tắt cuộc trò chuyện:', error);
        }
    }
} as GlobalChatCommand;