import { Message, User, GuildMember, Collection } from 'discord.js';
import { Command, ExecuteParams } from './types.js';
interface Warning {
    moderator: string;
    timestamp: number;
    reason: string;
}


export default {
    name: 'info',
    description: 'Get user information. 🕵️‍♂️',
    async execute({message, args, config, logModAction}: ExecuteParams): Promise<void> {
        let user: User | undefined;

        if (message.mentions.users.size) {
            user = message.mentions.users.first();
        } else if (args[0]) {
            try {
                user = await message.client.users.fetch(args[0]);
            } catch (error) {
                message.reply('Không tìm thấy người dùng với ID này. 🙈');
                return;
            }
        }

        if (!user) {
            message.reply('Không thể tìm thấy người dùng. 🙈');
            return;
        }

        const member: GuildMember | undefined = message.guild?.members.cache.get(user.id);
        let infoText: string = `**💁 Thông tin người dùng: ${user.tag}**\nID: ${user.id}\nTạo tài khoản: ${new Date(user.createdAt).toLocaleString()}\nAvatar: ${user.displayAvatarURL({ size: 2048 })}`;

        if (member) {
            const joinedAt = member.joinedAt ? new Date(member.joinedAt).toLocaleString() : "Không xác định";
            infoText += `\n**💁 Thông tin thành viên Server 💁‍♀️:**\nBiệt danh: ${member.nickname || 'Không có'}\nTham gia server: ${joinedAt}\nVai trò: ${member.roles.cache.map(r => r.name).join(', ')}`;
        }
        

        const warnings: Collection<string, Warning[]> | undefined = (message.client as any).warnings;
        if (warnings && warnings.has(user.id)) {
            const userWarnings: Warning[] = warnings.get(user.id) || [];
            infoText += `\n**🆘 Cảnh cáo:** ${userWarnings.length}`;
            userWarnings.forEach((warn: Warning, index: number) => {
                const moderator: User | undefined = message.client.users.cache.get(warn.moderator);
                infoText += `\n${index + 1}. Bởi: ${moderator ? moderator.tag : 'Unknown'} - ${new Date(warn.timestamp).toLocaleString()} - ${warn.reason}`;
            });
        }
        if ('send' in message.channel) {
            message.channel.send(infoText);
        }
    },
} as Command;
