import { config } from "../config.js";
const repoPath = config.repoPath || 'mongodb';
import Base, { Repository } from "./base.js";
const {ChatRepo} = await import(`../repo/${repoPath}/chat.js`);
const {ChatMessageRepo} = await import(`../repo/${repoPath}/chat_message.js`);
const {UserSequenceRepo} = await import(`../repo/${repoPath}/usequence.js`);

interface ChatMessage {
    id: string;
    role: string;
    content: string;
}

export interface ChatInterface {
    id: number;
    chat_id: string;
    chat_sequence?: number;
    title?: string;
    updated_at?: Date;
}

interface DeleteResult {
    count: number;
}

export class Chat extends Base {
    private chatMessagesRepo: Repository;
    private userSequenceRepo: Repository;
    constructor() {
        super(new ChatRepo());
        this.chatMessagesRepo = new ChatMessageRepo();
        this.userSequenceRepo = new UserSequenceRepo();
    }
    async getNextSequence(userId: string): Promise<number> {
        try {
            const last_sequence = await this.userSequenceRepo.findFirst(
                { user_id: userId },
                { last_sequence: true }
            );
            const nextSequence = last_sequence?.last_sequence ? last_sequence.last_sequence + 1 : 1;
            const userSequence = await this.userSequenceRepo.save(
                { last_sequence: nextSequence, user_id: userId },
                { user_id: userId },
            );
            return userSequence.last_sequence;
        } catch (error) {
            console.error('Lỗi khi lấy sequence:', error);
            throw error;
        }
    }

    // Tạo chat mới
    async createNewChat(userId: string): Promise<{id: number; chat_id: string; sequence: number}> {
        try {
            const sequence = await this.getNextSequence(userId);
            const chatId = `a${sequence}`;

            const newChat = await this.repo.save(
                {
                    chat_sequence: sequence,
                    chat_id: chatId,
                    title: `Cuộc trò chuyện ${sequence}`,
                    user_id: userId
                },
                {
                    user_id_chat_sequence: {
                        user_id: userId,
                        chat_sequence: sequence
                  }
                },
            );

            console.log(`✅ Đã tạo cuộc trò chuyện mới cho user ${userId}: ${chatId} (ID: ${newChat.id})`);

            return {
                id: newChat.id,
                chat_id: newChat.chat_id,
                sequence: sequence
            };
        } catch (error) {
            console.error('Lỗi khi tạo chat mới:', error);
            throw error;
        }
    }

    // Lấy danh sách chat của user
    async getUserChats(userId: string): Promise<ChatInterface[]> {
        try {
            return await this.repo.findMany({
                where: { user_id: userId },
                orderBy: { updated_at: 'desc' },
                select: {
                    id: true,
                    chat_id: true,
                    chat_sequence: true,
                    title: true,
                    updated_at: true
                }
            });
        } catch (error) {
            console.error('Lỗi khi lấy danh sách chat:', error);
            throw error;
        }
    }

    // Lấy chat hiện tại của user
    async getCurrentChat(userId: string): Promise<ChatInterface> {
        try {
            const currentChat = await this.repo.findFirst(
                { user_id: userId },
                {
                    id: true,
                    chat_id: true,
                    title: true
                },
                null,
                { updated_at: 'desc' }
            );

            if (!currentChat) {
                return this.createNewChat(userId);
            }
            
            return currentChat;
        } catch (error) {
            console.error('Lỗi khi lấy chat hiện tại:', error);
            throw error;
        }
    }

    // Thêm tin nhắn vào chat
    async addChatMessage(userId: string, role: string, content: string): Promise<number> {
        try {
            const currentChat = await this.getCurrentChat(userId);

            const message = await this.chatMessagesRepo.save({
                chat_id: currentChat.id,
                user_id: userId,
                role: role,
                content: content,
            });

            await this.repo.save({ updated_at: new Date(), user_id: userId }, { id: currentChat.id });

            return message.id;
        } catch (error) {
            console.error('Lỗi khi thêm tin nhắn:', error);
            throw error;
        }
    }

    // Lấy tin nhắn của chat
    async getChatMessages(chatId: number, limit: number = 10): Promise<ChatMessage[]> {
        try {
            const messages = await this.chatMessagesRepo.findMany({
                where: { chat_id: chatId },
                orderBy: { id: 'desc' },
                take: limit * 2,
                select: {
                    role: true,
                    content: true,
                    id: true
                }
            });
            
            return messages.reverse();
        } catch (error) {
            console.error('Lỗi khi lấy tin nhắn:', error);
            throw error;
        }
    }

    // Xóa chat
    async deleteChatById(userId: string, chatId: string): Promise<{success: boolean; chatId: string}> {
        try {
            const chat = await this.repo.findFirst({ 
                user_id: userId,
                chat_id: chatId 
            });

            if (!chat) {
                throw new Error('Không tìm thấy chat hoặc bạn không có quyền xóa');
            }

            await this.chatMessagesRepo.deleteBy({ chat_id: chat.id });
            await this.repo.delete(chat.id);

            return { 
                success: true, 
                chatId: chatId 
            };
        } catch (error) {
            console.error('Lỗi khi xóa chat:', error);
            throw error;
        }
    }

    // Xóa toàn bộ lịch sử chat của user
    async deleteUserChatHistory(userId: string): Promise<{messagesDeleted: boolean; chatsDeleted: number}> {
        try {
            const messageDelete = await this.chatMessagesRepo.deleteBy({ user_id: userId });
            const chatDelete = await this.repo.deleteBy({ user_id: userId });

            await this.userSequenceRepo.save(
                { last_sequence: 0 },
                { user_id: userId }
            );

            return {
                messagesDeleted: messageDelete.count > 0,
                chatsDeleted: chatDelete.count
            };
        } catch (error) {
            console.error('Lỗi khi xóa lịch sử chat:', error);
            throw error;
        }
    }

    async getUserChatHistory(userId: string, limit: number = 5): Promise<ChatMessage[]> {
        try {
            const chat = await this.getCurrentChat(userId);
            return await this.getChatMessages(chat.id, limit);
        } catch (error) {
            console.error('Lỗi khi lấy lịch sử chat:', error);
            throw error;
        }
    }
}