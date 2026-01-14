import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { Bookmarks } from '../../models/bookmark.js';

export const data = new SlashCommandBuilder()
  .setName('randomchoice')
  .setDescription('🎲 Random chọn một địa điểm từ bookmarks theo tag')
  .addStringOption(option =>
    option
      .setName('tag')
      .setDescription('Tag để lọc (ví dụ: eat, drink)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const tag = interaction.options.getString('tag')?.toLowerCase() || 'eat';
    const bM = new Bookmarks();
    const bookmarks = await bM.findMany({
      where: {
        savedByUserId: interaction.user.id,
        guildId: interaction.guildId!,
        tags: {
          has: tag,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (bookmarks.length === 0) {
      return interaction.editReply(`📭 Không tìm thấy bookmark nào với tag \`${tag}\`.`);
    }

    // Random chọn một bookmark
    const randomIndex = Math.floor(Math.random() * bookmarks.length);
    const selectedBookmark = bookmarks[randomIndex];

    // Lấy link đầu tiên từ content
    const firstLink = selectedBookmark.content?.match(/https?:\/\/\S+/)?.[0] ?? null;

    // Tạo embed để hiển thị kết quả
    const embed = new EmbedBuilder()
      .setTitle(`🎲 Random Choice từ tag #${tag}`)
      .setColor(0xff6b6b)
      .setDescription(
        firstLink 
          ? `🎯 **Kết quả:** ${firstLink}\n\n${selectedBookmark.content || ''}` 
          : `🎯 **Kết quả:** ${selectedBookmark.content || 'Không có nội dung'}`
      )
      .setFooter({ text: `Đã chọn ngẫu nhiên từ ${bookmarks.length} bookmark(s)` });

    if (selectedBookmark.messageLink) {
      embed.addFields({
        name: '🔗 Link gốc',
        value: `[Xem tin nhắn gốc](${selectedBookmark.messageLink})`,
        inline: false,
      });
    }

    await interaction.editReply({
      embeds: [embed],
    });

  } catch (err) {
    console.error('❌ Lỗi khi xử lý /randomchoice:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: '❌ Có lỗi xảy ra khi random chọn.' });
    } else {
      await interaction.reply({ content: '❌ Có lỗi xảy ra khi random chọn.', ephemeral: true });
    }
  }
}
