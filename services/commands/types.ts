import { GenerativeModel } from "@google/generative-ai";
import { Message } from "discord.js";
import { Chat } from "../../models/chat.js";
import { GlobalChat } from "../../models/global_chat.js";

export interface ExecuteParams {
    message: Message;
    args: string[];
    config: any;
    logModAction: Function;
    sendEmbedMessage: Function;
    client: any;
    model: GenerativeModel;
    chatM: Chat;
    gchatM: GlobalChat;
    createModel: (model: string) => GenerativeModel;
}
export interface ChatMessage {
    role: string;
    content: string;
}
export interface GChatMessage {
    role: string;
    content: string;
    name?: string;
}
export interface GChat {
    id: string;
    chat_id: string;
    title?: string;
    messageCount?: number;
}

export interface ChatHistory {
    role: string;
    parts: { text: string }[];
}
export interface Command {
    name: string;
    description: string;
    execute: (params: ExecuteParams) => Promise<void | Message>;
}