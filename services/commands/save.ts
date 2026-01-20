// commands/chats.ts
import '../../utils/logger.js';
import { ExecuteParams, Command } from './types.js';
import { Bookmarks } from '../../models/bookmark.js';

export default {
  name: 'save',
  description: 'lưu tin nhắn reply. 📚',
  async execute({ message, args }: ExecuteParams): Promise<void> {
    if (message.author.bot) return;
    if (!message.reference) {
      await message.reply('⚠️ Vui lòng reply tin nhắn bạn muốn lưu và thử lại.');
      return;
    }

    try {
      const replied = await message.channel.messages.fetch(message.reference.messageId!);
      const tags = args
        .filter(arg => arg.startsWith('#'))
        .map(tag => tag.replace(/^#/, '').toLowerCase());

      const bookmarkM = new Bookmarks();
      const saveData: Record<string, any> = {
        guildId: message.guildId!,
        channelId: message.channelId,
        messageId: replied.id,
        messageLink: `https://discord.com/channels/${message.guildId}/${message.channelId}/${replied.id}`,
        content: replied.content,
        attachments: replied.attachments.map(a => a.url),
        originalUserId: replied.author.id,
        originalUsername: replied.author.tag,
        savedByUserId: message.author.id,
        savedByUsername: message.author.tag,
        tags,
      };

      const result = await bookmarkM.save(saveData);

      if (!result) {
         await message.reply('❌ Không thể lưu. Có lỗi xảy ra khi ghi vào database.');
         return;
      }

      await message.reply(`✅ Đã lưu! ${tags.length ? `Tags: ${tags.join(', ')}` : ''}`);
    } catch (error: any) {
      console.error('❌ Lỗi khi lưu bookmark:', error);
      await message.reply('❌ Không thể lưu. Có lỗi xảy ra.');
    }
  },
} as Command;
