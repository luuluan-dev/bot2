import { config } from "../config.js";
const repoPath = config.repoPath || 'mongodb';
import Base, { Repository } from "./base.js";
const {GlobalChatRepo} = await import(`../repo/${repoPath}/global_chat.js`);
const {GlobalChatMessageRepo} = await import(`../repo/${repoPath}/global_chat_message.js`);

export interface GlobalChatMessage {
    role: string;
    content: string;
    user_id: string;
    name: string;
}

export interface GlobalChatResult {
    id: number;
    chat_id: string;
    sequence: number;
    _count?: {
        global_chat_messages?: number;
    };
}

interface CurrentChat {
    id: number;
    chat_id: string;
    title?: string;
}

export class GlobalChat extends Base {
    private globalChatMessagesRepo: Repository;
    constructor() {
        const repo = new GlobalChatRepo();
        super(repo);
        this.globalChatMessagesRepo = new GlobalChatMessageRepo(); 
    }

    // Tạo global chat mới
    async createNewGlobalChat(senderId: string): Promise<GlobalChatResult> {
        try {
            // Lấy sequence tiếp theo
            const sequenceResult = await this.repo.findFirst(
                {},
                { chat_sequence: true },
                null,
                { chat_sequence: 'desc' }
            );

            const sequence: number = sequenceResult 
                ? sequenceResult.chat_sequence + 1 
                : 1;
            const chatId: string = `g${sequence}`;

            const newChat = await this.repo.save(
                {
                    chat_sequence: sequence,
                    chat_id: chatId,
                    title: `Cuộc trò chuyện ${sequence}`,
                    creator_id: senderId
                }
            );

            console.log(`✅ Đã tạo global chat mới: ${chatId} (ID: ${newChat.id})`);

            return {
                id: newChat.id,
                chat_id: newChat.chat_id,
                sequence: newChat.chat_sequence
            };
        } catch (error) {
            console.error('Lỗi khi tạo global chat:', error);
            throw error;
        }
    }

    // Lấy danh sách global chats
    async getGlobalChats() : Promise<GlobalChatResult[]> {
        try {
            return await this.repo.findMany({
                orderBy: { updated_at: 'desc' },
                select: {
                    id: true,
                    chat_id: true,
                    chat_sequence: true,
                    title: true,
                    updated_at: true,
                },
            });
        } catch (error) {
            console.error('Lỗi khi lấy danh sách global chats:', error);
            throw error;
        }
    }

    // Lấy global chat hiện tại
    async getCurrentGlobalChat(): Promise<CurrentChat> {
        try {
            const currentChat = await this.repo.findFirst(
                {},
                {
                    id: true,
                    chat_id: true,
                    title: true
                },
                null,
                { updated_at: 'desc' }
            );

            if (!currentChat) {
                // Nếu không có chat, tạo mới
                return this.createNewGlobalChat('system');
            }

            return currentChat;
        } catch (error) {
            console.error('Lỗi khi lấy global chat hiện tại:', error);
            throw error;
        }
    }

    // Thêm tin nhắn vào global chat
    async addGlobalChatMessage(userId: string, role: string, content: string, name: string = ""): Promise<number> {
        try {
            const currentChat = await this.getCurrentGlobalChat();

            const message = await this.globalChatMessagesRepo.save(
                {
                    chat_id: currentChat.id,
                    user_id: userId,
                    role: role,
                    content: content,
                    name: name
                }
            );

            // Cập nhật thời gian của global chat
            await this.repo.save(
                { updated_at: new Date() },
                { id: currentChat.id },
            );

            return message.id;
        } catch (error) {
            console.error('Lỗi khi thêm tin nhắn:', error);
            throw error;
        }
    }

    // Lấy tin nhắn của global chat
    async getGlobalChatMessages(chatId: number, limit: number = 10): Promise<GlobalChatMessage[]> {
        try {
            const messages = await this.globalChatMessagesRepo.findMany({
                where: { chat_id: chatId },
                orderBy: { id: 'desc' },
                take: limit * 2,
                select: {
                    role: true,
                    content: true,
                    user_id: true,
                    name: true
                }
            });

            return messages.reverse();
        } catch (error) {
            console.error('Lỗi khi lấy tin nhắn:', error);
            throw error;
        }
    }

    // Xóa global chat
    async deleteGlobalChatById(chatId: string): Promise<{ success: boolean; chat_id: string }> {
        try {
            // Xóa tin nhắn trước
            await this.globalChatMessagesRepo.deleteBy({ chat_id: chatId });

            // Xóa chat
            await this.repo.delete(chatId);

            return { 
                success: true, 
                chat_id: chatId 
            };
        } catch (error) {
            console.error('Lỗi khi xóa global chat:', error);
            throw error;
        }
    }

    // Xóa toàn bộ lịch sử global chat
    async deleteGlobalChatHistory(): Promise<{ messagesDeleted: boolean; chatsDeleted: number }> {
        try {
            // Xóa tin nhắn
            const messageDelete = await this.globalChatMessagesRepo.bulkDeleteBy({});

            // Xóa chat
            const chatDelete = await this.repo.bulkDeleteBy({});

            return {
                messagesDeleted: messageDelete.count > 0,
                chatsDeleted: chatDelete.count
            };
        } catch (error) {
            console.error('Lỗi khi xóa lịch sử global chat:', error);
            throw error;
        }
    }

    // Cập nhật tiêu đề global chat
    async updateChatTitle(chatId: number, title: string): Promise<boolean> {
        try {
            await this.repo.save(
                { 
                    title, 
                    updated_at: new Date() 
                },
                { id: chatId }
            );
            return true;
        } catch (error) {
            console.error('Lỗi khi cập nhật tiêu đề:', error);
            throw error;
        }
    }
    async getMessageCount(chatId: number): Promise<number> {
        try {
            console.log(`Đếm tin nhắn cho chat ${chatId}:`);
            
            const count = await this.globalChatMessagesRepo.count({
                where: { chat_id: chatId }
            });
            console.log(`Tổng tin nhắn: ${count}`);
            return count;
        } catch (error) {
            console.error(`Lỗi khi đếm tin nhắn cho chat ${chatId}:`, error);
            return 0;
        }
    }
    
    // Phiên bản nâng cao của getGlobalChats với số lượng tin nhắn
    async getGlobalChatsWithMessageCounts(): Promise<GlobalChatResult[]> {
        try {
            const chats = await this.getGlobalChats();
            
            const chatsWithCounts = await Promise.all(
                chats.map(async (chat) => {
                    const messageCount = await this.getMessageCount(chat.id);
                    
                    return {
                        ...chat,
                        _count: {
                            global_chat_messages: messageCount
                        }
                    };
                })
            );
            
            return chatsWithCounts;
        } catch (error) {
            console.error('Lỗi khi lấy danh sách global chats với số lượng tin nhắn:', error);
            throw error;
        }
    }
}