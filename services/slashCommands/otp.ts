import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { generate } from 'otplib';
import { OtpSecret } from '../../models/otpSecret.js';

export const data = new SlashCommandBuilder()
    .setName('otp')
    .setDescription('🔐 Lấy mã OTP từ Authenticator')
    .addStringOption(option =>
        option
            .setName('name')
            .setDescription('Tên OTP secret')
            .setRequired(true)
            .setAutocomplete(true)
    );

export async function autocomplete(interaction: any): Promise<void> {
    const focused = interaction.options.getFocused().toLowerCase();
    const otpModel = new OtpSecret();
    const secrets = await otpModel.getAll();

    const choices = secrets
        .filter(s => s.name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(s => ({ name: s.name, value: s.name }));

    await interaction.respond(choices);
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.options.getString('name', true);
    const otpModel = new OtpSecret();
    const record = await otpModel.getByName(name);

    if (!record) {
        await interaction.reply({ content: `❌ Không tìm thấy OTP secret \`${name}\`.`, ephemeral: true });
        return;
    }

    try {
        const cleanSecret = record.value.replace(/\s/g, '').toUpperCase();
        const code = await generate({ secret: cleanSecret });
        const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

        await interaction.reply({ content: `🔐 **[${name}] Mã OTP:** \`${code}\`\n⏱️ Hết hạn sau **${secondsRemaining}** giây`, ephemeral: true });

        setTimeout(async () => {
            try { await interaction.deleteReply(); } catch {}
        }, secondsRemaining * 1000);
    } catch (error: any) {
        await interaction.reply({ content: `❌ Lỗi: ${error.message}`, ephemeral: true });
    }
}
