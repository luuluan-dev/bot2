import { generate } from 'otplib';
import { TextChannel } from 'discord.js';
import { Command, ExecuteParams } from './types.js';

export default {
    name: 'otp',
    description: 'Lấy mã OTP từ Google Authenticator. 🔐',
    async execute({ message }: ExecuteParams): Promise<void> {
        const secret = process.env.GOOGLE_AUTHENTICATOR;

        if (!secret) {
            await message.reply('❌ Chưa cấu hình `GOOGLE_AUTHENTICATOR` trong ENV.');
            return;
        }

        try {
            await message.delete();
        } catch {
            // Bỏ qua nếu không có quyền xoá
        }

        if (!('send' in message.channel)) return;
        const channel = message.channel as TextChannel;

        try {
            const code = await generate({ secret });
            const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

            const reply = await channel.send(
                `🔐 **Mã OTP:** \`${code}\`\n⏱️ Hết hạn sau **${secondsRemaining}** giây`
            );

            setTimeout(() => {
                reply.delete().catch(() => {});
            }, secondsRemaining * 1000);
        } catch (error: any) {
            await channel.send(`❌ Lỗi khi tạo OTP: ${error.message}`);
        }
    },
} as Command;
