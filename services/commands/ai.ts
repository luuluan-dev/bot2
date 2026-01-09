import { GenerativeModel } from '@google/generative-ai';
import { GuildMember, NewsChannel, TextChannel } from 'discord.js';
import { Chat as ChatModel } from '../../models/chat.js';
import '../../utils/logger.js';

import { ChatHistory, ChatMessage, ExecuteParams, Command } from './types.js';

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
interface AiCommand extends Command {
    summarizeAndUpdateChatTitle: (userId: string, model: GenerativeModel) => Promise<void>;
    generateChatTitle: (userId: string, model: GenerativeModel) => Promise<string>;
}

export default {
    name: 'ai',
    description: 'Talk to the AI with persistent conversation history using the current chat. 🤖',
    
    async execute({ message, args, config, logModAction, sendEmbedMessage, client, model, chatM, createModel }: ExecuteParams): Promise<void> {
        if (!args.length) {
            message.reply('⚠️ Bạn cần nhập nội dung để gọi AI.');
            return;
        }

        let userId: string = message.author.id;
        const member: GuildMember | undefined = message.mentions.members?.first();
        if (member) {
            userId = member.id;
            args.shift();
        }
        const prompt: string = args.join(' ');

        try {
            let processingMsg;
            if (message.channel instanceof TextChannel || message.channel instanceof NewsChannel) {
                processingMsg = await message.channel.send('🤔 Đang xử lý...');
            }
            
            let historyRows = await chatM.getUserChatHistory(userId, 5);
            
            let conversation: ChatHistory[] = historyRows.map(row => ({
                role: row.role,
                parts: [{ text: row.content }]
            }));
            
            console.log(`🗣️ Lịch sử cuộc trò chuyện của ${userId}: ${JSON.stringify(conversation)}`);
            
            const models = [model, ...FALLBACK_MODELS.map(m => createModel(m))];
            let success = false;
            let usedModel = model;

            for (let i = 0; i < models.length; i++) {
                const currentModel = models[i];
                try {
                    if (conversation.length === 0) {
                        const result = await currentModel.generateContent(prompt);
                        const content = result.response.text();
                        await chatM.addChatMessage(userId, 'user', prompt);
                        await chatM.addChatMessage(userId, 'model', content);
                        this.summarizeAndUpdateChatTitle(userId, currentModel).catch(e => console.error("Lỗi tóm tắt ngầm:", e));
                        await processingMsg?.delete();
                        await sendEmbedMessage(message.channel, message.author, content);
                        success = true;
                        usedModel = currentModel;
                        break;
                    } 
                    
                    try {
                        const chat = currentModel.startChat({
                            history: conversation,
                            generationConfig: { maxOutputTokens: 1000 }
                        });
                        const result = await chat.sendMessage(prompt);
                        const content = result.response.text();
                        await chatM.addChatMessage(userId, 'user', prompt);
                        await chatM.addChatMessage(userId, 'model', content);
                        this.summarizeAndUpdateChatTitle(userId, currentModel).catch(e => console.error("Lỗi tóm tắt ngầm:", e));
                        await processingMsg?.delete();
                        await sendEmbedMessage(message.channel, message.author, content);
                        success = true;
                        usedModel = currentModel;
                        break;
                    } catch (chatError: any) {
                         // Check if this inner error is quota
                         if (chatError.message?.includes('429') || chatError.status === 429) {
                             throw chatError; // Rethrow to outer fallback loop
                         }
                         
                         // Not quota, try new chat fallback logic with CURRENT model
                        console.error(`Lỗi khi gọi startChat: ${chatError.message}`);
                        await processingMsg?.delete();
                        message.reply('🔄 Đang thử lại với cuộc trò chuyện mới...');
                        
                        await chatM.createNewChat(userId);
                        const result = await currentModel.generateContent(prompt); 
                        const content = result.response.text();
                        
                        await chatM.addChatMessage(userId, 'user', prompt);
                        await chatM.addChatMessage(userId, 'model', content);
                        this.summarizeAndUpdateChatTitle(userId, currentModel).catch(e => console.error("Lỗi tóm tắt ngầm:", e));
                        await sendEmbedMessage(message.channel, message.author, content);
                        success = true; // Fallback succeeded
                        usedModel = currentModel;
                        break;
                    }
                } catch (error: any) {
                     const isQuota = error.message?.includes('429') || error.status === 429;
                     if (isQuota && i < models.length - 1) {
                         console.log(`⚠️ Model limit reached, switching to backup model... (${i + 1}/${models.length})`);
                         continue;
                     }
                     
                     if (i === models.length - 1) {
                         console.error(`❌ Lỗi cuối cùng khi gọi AI: ${error.message}`);
                         await processingMsg?.delete();
                         if (isQuota) {
                            message.reply('❌ Tất cả các model đều đang bận hoặc hết hạn mức. Vui lòng thử lại sau.');
                         } else {
                            message.reply('❌ Có lỗi xảy ra khi gọi AI.');
                         }
                     }
                }
            }
        } catch (error: any) {
            console.error(`❌ Lỗi chung khi gọi AI: ${error.message}`);
            message.reply('❌ Có lỗi xảy ra khi gọi AI. Vui lòng thử lại sau.');
        }
    },

    async summarizeAndUpdateChatTitle(userId: string, model: GenerativeModel): Promise<void> {
        try {
            const currentChat = await (new ChatModel()).getCurrentChat(userId);
    
            if (currentChat.title && !currentChat.title.startsWith(`[${currentChat.chat_id}] Cuộc trò chuyện`)) {
                // If title already exists and is not just the default, skip
                return;
            }

            const messages: ChatMessage[] = await (new ChatModel()).getChatMessages(currentChat.id, 5);
    
            if (messages.length === 0) {
                return;
            }
    
            let context: string = messages.map(msg => 
                `${msg.role === 'user' ? 'Người dùng' : 'AI'}: ${msg.content}`
            ).reverse().join('\n');
    
            const prompt: string = `Dựa vào đoạn hội thoại sau, hãy tạo một tiêu đề ngắn gọn (dưới 50 ký tự) cho cuộc trò chuyện này:\n\n${context}\n\nTiêu đề:`;
    
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 100 }
            });
            let title: string = result.response.text().trim();
    
            if (title.length > 50) {
                title = title.substring(0, 47) + '...';
            }
    
            title = `[${currentChat.chat_id}] ${title}`;
    
            await (new ChatModel()).save({ title }, { id: currentChat.id });
    
            console.log(`✅ Đã cập nhật tiêu đề cho cuộc trò chuyện ${currentChat.id}: ${title}`);
    
        } catch (error: any) {
            console.error(`❌ Lỗi khi tóm tắt cuộc trò chuyện: ${error.message}`);
        }
    }
} as AiCommand;