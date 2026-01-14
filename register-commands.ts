import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

config();

const commands = [];
const commandsDir = path.resolve('./services/slashCommands');
const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsDir, file);
  const fileUrl = pathToFileURL(filePath).href;

  const command = await import(fileUrl);
  if ('data' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`⚠️ Lệnh "${file}" không có 'data', bỏ qua.`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');

// Lấy CLIENT_ID từ token (phần đầu của token là bot ID)
const token = process.env.DISCORD_TOKEN || '';
const clientId = Buffer.from(token.split('.')[0], 'base64').toString('ascii');

// Lấy GUILD_ID từ .env
const guildId = process.env.GUILD_ID;

if (!guildId) {
  console.error('❌ Thiếu GUILD_ID trong file .env!');
  console.log('💡 Hãy thêm GUILD_ID="your_guild_id" vào file .env');
  process.exit(1);
}

try {
  console.log('🔃 Đăng ký Slash Commands cho guild...');
  console.log(`📝 Tổng số commands: ${commands.length}`);
  console.log(`🏠 Guild ID: ${guildId}`);
  
  // Đăng ký theo guild (xuất hiện ngay lập tức)
  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands }
  );
  
  console.log('✅ Đã đăng ký thành công tất cả slash commands!');
  console.log(`📋 Commands đã đăng ký: ${commands.map((c: any) => c.name).join(', ')}`);
} catch (error) {
  console.error('❌ Lỗi khi đăng ký:', error);
}
