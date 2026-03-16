import { totp } from 'otplib';
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

        try {
            const code = totp.generate(secret);
            const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

            const reply = await message.channel.send(
                `🔐 **Mã OTP:** \`${code}\`\n⏱️ Hết hạn sau **${secondsRemaining}** giây`
            );

            setTimeout(() => {
                reply.delete().catch(() => {});
            }, secondsRemaining * 1000);
        } catch (error: any) {
            await message.channel.send(`❌ Lỗi khi tạo OTP: ${error.message}`);
        }
    },
} as Command;
