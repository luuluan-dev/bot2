import { promises as fs } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { EmbedBuilder } from "discord.js";
import { Command, ExecuteParams } from "./types.js";

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

const DISCORD_FILE_SIZE_LIMIT = 8 * 1024 * 1024; // 8MB in bytes

function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

async function listLogFiles(logsDir: string): Promise<string> {
  try {
    const files = await fs.readdir(logsDir);
    const logFiles = files.filter((f) => f.endsWith(".log"));

    if (logFiles.length === 0) {
      return "📂 Thư mục logs trống.";
    }

    // Get file stats and sort by date (newest first)
    const fileStats = await Promise.all(
      logFiles.map(async (file) => {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          size: stats.size,
          mtime: stats.mtime,
        };
      }),
    );

    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    let result = "📋 **Danh sách log files:**\n\n";
    for (const file of fileStats) {
      const emoji = file.name.startsWith("error") ? "❌" : "📝";
      result += `${emoji} \`${file.name}\` - ${formatFileSize(file.size)}\n`;
    }

    return result;
  } catch (error) {
    return "❌ Không thể đọc thư mục logs.";
  }
}

function getUsageHelp(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📖 Hướng dẫn sử dụng lệnh !logs")
    .setDescription("Lấy file log theo ngày từ thư mục logs")
    .addFields(
      {
        name: "📋 Liệt kê tất cả logs",
        value: "`!logs` hoặc `!logs list`",
        inline: false,
      },
      {
        name: "📅 Lấy log theo ngày",
        value:
          "`!logs YYYY-MM-DD` - Lấy app log\n`!logs YYYY-MM-DD error` - Lấy error log",
        inline: false,
      },
      {
        name: "⏰ Ngày tương đối",
        value: "`!logs today` - Log hôm nay\n`!logs yesterday` - Log hôm qua",
        inline: false,
      },
      {
        name: "📌 Ví dụ",
        value: "`!logs 2026-02-05`\n`!logs 2026-02-05 error`\n`!logs today`",
        inline: false,
      },
    )
    .setFooter({ text: "Định dạng ngày: YYYY-MM-DD" })
    .setTimestamp();
}

export default {
  name: "logs",
  description: "Lấy file log theo ngày từ thư mục logs 📝",
  async execute({ message, args }: ExecuteParams): Promise<void> {
    const logsDir = path.join(__dirname, "../../../logs");

    // Check if logs directory exists
    try {
      await fs.access(logsDir);
    } catch (error) {
      await message.reply("❌ Thư mục logs không tồn tại.");
      return;
    }

    // No arguments or "list" command - show all log files
    if (!args[0] || args[0].toLowerCase() === "list") {
      const listResult = await listLogFiles(logsDir);

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("📂 Log Files")
        .setDescription(listResult)
        .setFooter({ text: "Sử dụng !logs [ngày] để lấy file cụ thể" })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // Show help if requested
    if (args[0].toLowerCase() === "help" || args[0] === "?") {
      await message.reply({ embeds: [getUsageHelp()] });
      return;
    }

    let date: string;
    const logType = args[1] === "error" ? "error" : "app";

    // Handle relative dates
    if (args[0].toLowerCase() === "today") {
      date = getTodayDate();
    } else if (args[0].toLowerCase() === "yesterday") {
      date = getYesterdayDate();
    } else if (isValidDateFormat(args[0])) {
      date = args[0];
    } else {
      // Invalid format - show help
      const errorEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("❌ Định dạng ngày không hợp lệ")
        .setDescription(
          `Bạn đã nhập: \`${args[0]}\`\n\nVui lòng sử dụng định dạng **YYYY-MM-DD** hoặc **today**/**yesterday**`,
        )
        .addFields({
          name: "💡 Ví dụ đúng",
          value: "`!logs 2026-02-05`\n`!logs today`\n`!logs yesterday`",
        })
        .setFooter({ text: "Gõ !logs help để xem hướng dẫn đầy đủ" });

      await message.reply({ embeds: [errorEmbed] });
      return;
    }

    const logFileName = `${logType}-${date}.log`;
    const logFilePath = path.join(logsDir, logFileName);

    try {
      // Check if file exists
      await fs.access(logFilePath);

      // Check file size
      const stats = await fs.stat(logFilePath);
      const fileSize = stats.size;

      if (fileSize > DISCORD_FILE_SIZE_LIMIT) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle("⚠️ File quá lớn")
          .setDescription(
            `File log **${logFileName}** có kích thước ${formatFileSize(fileSize)}, vượt quá giới hạn ${formatFileSize(DISCORD_FILE_SIZE_LIMIT)} của Discord.`,
          )
          .addFields({
            name: "💡 Giải pháp",
            value:
              "• Sử dụng lệnh `!clearLogs` để dọn log cũ\n• Truy cập trực tiếp vào server để tải file",
          });

        await message.reply({ embeds: [errorEmbed] });
        return;
      }

      // Send file with embed
      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("📝 Log File")
        .setDescription(`**${logFileName}**`)
        .addFields(
          { name: "📅 Ngày", value: date, inline: true },
          {
            name: "📊 Loại",
            value: logType === "error" ? "Error" : "App",
            inline: true,
          },
          {
            name: "📏 Kích thước",
            value: formatFileSize(fileSize),
            inline: true,
          },
        )
        .setTimestamp();

      if ("send" in message.channel) {
        await message.channel.send({
          embeds: [successEmbed],
          files: [{ attachment: logFilePath, name: logFileName }],
        });
      }
    } catch (error) {
      const notFoundEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("❌ Không tìm thấy file log")
        .setDescription(
          `File **${logFileName}** không tồn tại trong thư mục logs.`,
        )
        .addFields({
          name: "💡 Gợi ý",
          value:
            "• Kiểm tra lại ngày (định dạng YYYY-MM-DD)\n• Sử dụng `!logs` để xem danh sách logs có sẵn\n• Log có thể đã bị xóa do quá cũ (>14 ngày)",
        })
        .setFooter({ text: "Gõ !logs help để xem hướng dẫn" });

      await message.reply({ embeds: [notFoundEmbed] });
    }
  },
} as Command;
