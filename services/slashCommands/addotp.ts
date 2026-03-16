import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { OtpSecret } from '../../models/otpSecret.js';

export const data = new SlashCommandBuilder()
    .setName('addotp')
    .setDescription('➕ Thêm hoặc cập nhật OTP secret')
    .addStringOption(option =>
        option.setName('name').setDescription('Tên định danh (vd: gmail, github)').setRequired(true)
    )
    .addStringOption(option =>
        option.setName('key').setDescription('Secret key Base32 từ Google Authenticator').setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.options.getString('name', true).trim();
    const key = interaction.options.getString('key', true).trim();

    try {
        const otpModel = new OtpSecret();
        const existing = await otpModel.getByName(name);
        const saved = existing
            ? await otpModel.save({ value: key }, { id: existing.id })
            : await otpModel.save({ name, value: key });

        if (!saved) {
            await interaction.reply({ content: '❌ Lưu thất bại, thử lại sau.', ephemeral: true });
            return;
        }

        await interaction.reply({
            content: `✅ **${existing ? 'Cập nhật' : 'Thêm'}** OTP secret \`${name}\` thành công!`,
            ephemeral: true
        });
    } catch (error: any) {
        await interaction.reply({ content: `❌ Lỗi: ${error.message}`, ephemeral: true });
    }
}
