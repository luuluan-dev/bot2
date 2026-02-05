import { promises as fs } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { Command, ExecuteParams } from "./types.js";

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default {
  name: "logs",
  description: "Lấy file log theo loại và ngày từ thư mục logs 📝\nCách dùng: !logs <app|error> [YYYY-MM-DD]",
  async execute({ message, args }: ExecuteParams): Promise<void> {
    const logType = args[0]?.toLowerCase();
    const inputDate = args[1];

    // 📌 Kiểm tra loại log
    if (!logType || (logType !== "app" && logType !== "error")) {
      await message.reply(
        `❌ Vui lòng chọn loại log:\n` +
        `📱 \`!logs app [ngày]\` - Lấy app logs\n` +
        `🚨 \`!logs error [ngày]\` - Lấy error logs\n\n` +
        `Ví dụ: \`!logs app 2026-02-05\` hoặc \`!logs error\` (hôm nay)`
      );
      return;
    }

    let date: string;

    // 📌 Nếu nhập ngày, kiểm tra định dạng trước
    if (inputDate) {
      if (!isValidDateFormat(inputDate)) {
        await message.reply(
          `❌ Định dạng ngày không đúng. Vui lòng dùng dạng \`YYYY-MM-DD\`.\n` +
          `Ví dụ: \`!logs ${logType} ${getTodayDate()}\``
        );
        return;
      }
      date = inputDate;
    } else {
      date = getTodayDate();
    }

    const logFileName = `${logType}-${date}.log`;
    const logFilePath = path.join(__dirname, "../../../logs", logFileName);

    try {
      await fs.access(logFilePath);

      if ("send" in message.channel) {
        const emoji = logType === "error" ? "🚨" : "📱";
        await message.channel.send({
          content: `${emoji} **${logType.toUpperCase()} Log** - \`${logFileName}\`:`,
          files: [logFilePath],
        });
      }
    } catch (error) {
      await message.reply(
        `❌ Không tìm thấy file log \`${logFileName}\` trong thư mục logs.\n` +
        `💡 Tip: Dùng \`!logs ${logType}\` để xem log hôm nay.`
      );
    }
  },
} as Command;
