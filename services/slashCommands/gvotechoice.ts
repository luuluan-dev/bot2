import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { Bookmarks } from '../../models/bookmark.js';

export const data = new SlashCommandBuilder()
  .setName('gvotechoice')
  .setDescription('🥡 Vote chọn địa điểm ăn uống từ bookmarks của TẤT CẢ mọi người')
  .addStringOption(option =>
    option
      .setName('tag')
      .setDescription('Tag để lọc (ví dụ: eat, drink)')
      .setAutocomplete(true)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const tag = interaction.options.getString('tag') || 'eat';
    const bM = new Bookmarks();

    const whereCondition: any = {
      guildId: interaction.guildId!,
      tags: {
        has: tag,
      },
      // Không filter theo savedByUserId để lấy global
    };

    const bookmarks = await bM.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
    });

    if (bookmarks.length === 0) {
      return interaction.editReply(`📭 Không tìm thấy bookmark nào với tag \`${tag}\` từ bất kỳ ai.`);
    }

    const options = bookmarks.slice(0, 25);
    const embed = new EmbedBuilder()
    .setTitle(`📋 Global Vote từ tag #${tag}`)
    .setColor(0x00bfff)
    .setDescription(
      options
        .map((b, i) => {
          const firstLink = b.content?.match(/https?:\/\/\S+/)?.[0] ?? null;
          return `**${i + 1}.**${firstLink ? `${firstLink}` : 'Không có link nào trong tin bookmark này.'}`;
        })
        .join('\n\n')
    )
    .setFooter({ text: `Bạn có 5 phút để vote (${options.length} lựa chọn)` });


    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < options.length; i++) {
      if (i % 5 === 0) rows.push(new ActionRowBuilder<ButtonBuilder>());
      rows[rows.length - 1].addComponents(
        new ButtonBuilder()
          .setCustomId(`gvotechoice_${i}`)
          .setLabel(`Vote ${i + 1}`)
          .setStyle(ButtonStyle.Primary)
      );
    }

    const plainLinks = options
      .map((b, i) => {
        const firstLink = b.content?.match(/https?:\/\/\S+/)?.[0];
        return firstLink ? `**${i + 1}.** ${firstLink}` : null;
      })
      .filter(Boolean)
      .join('\n');

    const voteMessage = await interaction.editReply({
      content: plainLinks || undefined,
      embeds: [embed],
      components: rows,
    });

    const voteCounts = new Map<number, Set<string>>();
    const collector = voteMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000,
    });

    collector.on('collect', async (btnInteraction) => {
      const index = parseInt(btnInteraction.customId.split('_')[1]);
      const userId = btnInteraction.user.id;

      for (const voters of voteCounts.values()) {
        if (voters.has(userId)) {
          await btnInteraction.reply({ content: '❗ Bạn chỉ được vote một lần.', ephemeral: true });
          return;
        }
      }

      if (!voteCounts.has(index)) voteCounts.set(index, new Set());
      voteCounts.get(index)!.add(userId);

      await btnInteraction.reply({ content: `✅ Bạn đã vote cho lựa chọn #${index + 1}`, ephemeral: true });
    });

    collector.on('end', async () => {
      let maxVotes = 0;
      let winners: number[] = [];

      // Tìm số vote cao nhất
      for (const voters of voteCounts.values()) {
        if (voters.size > maxVotes) {
          maxVotes = voters.size;
        }
      }

      // Tìm tất cả các index có số vote bằng maxVotes
      if (maxVotes > 0) {
        for (const [i, voters] of voteCounts.entries()) {
          if (voters.size === maxVotes) {
            winners.push(i);
          }
        }
      }

      if (winners.length === 0) {
        await interaction.followUp('📭 Không có ai vote cả...');
      } else {
        // Random chọn 1 người chiến thắng trong số những người có vote cao nhất
        const winnerIndex = winners[Math.floor(Math.random() * winners.length)];
        const winner = options[winnerIndex];
        
        const tieMsg = winners.length > 1 ? `\n(Random từ ${winners.length} lựa chọn có cùng ${maxVotes} vote)` : '';

        await interaction.followUp(
          `🥇 **Kết quả vote (Global)**:${tieMsg}\n🏆 [Link](${winner.messageLink}) - ${winner.content || 'Không có mô tả'}\n🗳️ Số vote: ${maxVotes}`
        );
      }
    });
  } catch (err) {
    console.error('❌ Lỗi khi xử lý /gvotechoice:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ Có lỗi xảy ra khi xử lý vote.' });
      } else {
        await interaction.reply({ content: '❌ Có lỗi xảy ra khi xử lý vote.', ephemeral: true });
      }
    } catch (ignored) {
      // Bỏ qua lỗi khi báo lỗi
    }
  }
}
