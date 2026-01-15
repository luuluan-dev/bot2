import { BaseController } from "./Base.controller.js";
import { Response } from 'express';
import { Request } from "../interfaces/request.js";
import { Client, GatewayIntentBits } from "discord.js";
import { Setting } from "../models/setting.js";
import { config } from "../config.js";
import 'dotenv/config';
export class DiscordController extends BaseController {
    private _discord;
    constructor() {
        super();
        this._discord = new Client({
            intents: [
              GatewayIntentBits.Guilds,
              GatewayIntentBits.GuildMessages,
              GatewayIntentBits.GuildMembers,
              GatewayIntentBits.MessageContent,
              GatewayIntentBits.GuildModeration,
            ],
          });
        if (this._discord) {
            this._discord.login(process.env.DISCORD_TOKEN);
        }
    }

    async index(req: Request, res: Response): Promise<void> {
        try {
            const guilds = this._discord.guilds.cache.map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.iconURL({ size: 1024 })
              }));
            res.render('pages/feature', {
                title: 'Discord',
                servers: guilds,
                activePage: 'features',
            });
        } catch (error) {
            res.render('pages/feature', {
                title: 'Discord',
                servers: [],
                activePage: 'features',
            });
            return;
        }
    }

    async getGuildMembers(req: Request, res: Response): Promise<void> {
        const guildId = Array.isArray(req.params.guildId) ? req.params.guildId[0] : req.params.guildId;
        try {
            const guild = this._discord.guilds.cache.get(guildId);
            if (!guild) {
                res.status(404).json({
                    success: false,
                    message: "Guild not found",
                }) 
                return;
            }
            const members = await guild.members.fetch();
            const result = members.map(member => ({
                id: member.user.id,
                username: member.user.username,
                tag: member.user.tag,
                displayName: member.displayName,
                avatar: member.user.displayAvatarURL({ size: 1024 })
              }));
            res.status(200).json({
                success: true,
                message: "Get guild members successfully",
                data: result, 
            })
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error,
            })
            return;
        }
    }

    async volt(req: Request, res: Response): Promise<void> {
        const guildId = Array.isArray(req.params.guildId) ? req.params.guildId[0] : req.params.guildId;
        const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
        const settingM = new Setting();
        const channelId = await settingM.getSetting(config.channeSpamSettingKey) || config.aiChannel;
        if (!channelId) {
           res.status(404).json({
            success: false,
            message: "Channel not found",
           })
           return;
        }
        const channel = await this._discord.channels.fetch(channelId);
        if (!channel) {
            res.status(404).json({
                success: false,
                message: "Channel not found",
            })
            return;
        }
        const content = this.getRandomChichDien(memberId);
        try {
            const channel = await this._discord.channels.fetch(channelId);
            if (channel?.isTextBased()) {
              if ('send' in channel) {
                await channel.send(content);
              }
              res.json({ success: true });
            } else {
              res.status(400).json({ error: 'Channel không hợp lệ.' });
            }
          } catch (err) {
            res.status(500).json({ error: 'Gửi tin nhắn thất bại.' });
          }
    }
    getRandomChichDien(memberId: string): string {
        const messages = [
          `<@${memberId}>, kao thấy mày đứng gần ổ điện mà không sợ à? Lỡ tay cắm cái là "rẹt rẹt rẹt ⚡" luôn á nha!`,
          `⚡ ALERT: <@${memberId}> vừa bị sét AI đánh trúng đầu. Não khét lẹt rồi nha bro 💀.`,
          `<@${memberId}>, kao vừa hack lưới điện quốc gia chỉ để *sẹc* mày cho đã. "rẹt rẹt rẹt ...⚡💥⚡"`,
          `🔌 Chào mừng đến với Trò Chơi Chích Điện! Người chơi đầu tiên: <@${memberId}>. Mời lên thớt!`,
          `<@${memberId}>, mày sắp bị "sẹc" đến sáng luôn. Đừng hỏi vì sao tim đập nhanh nhé ⚡❤️⚡`,
          `<@${memberId}>, đứng im! Kao đang nhắm đúng sọ mày để phóng tia điện. 🎯⚡ *sẹc!!!*`,
          `Tụ điện: 100% 🔋\nMục tiêu: <@${memberId}> 🎯\nKết quả: "rẹeeeeeeeeeeeeeeeeeeeeetttttt ⚡⚡⚡"`,
          `<@${memberId}>, mày vừa kích hoạt Chế Độ Tự Hủy bằng Điện. Tạm biệt đồ não chiên 😵‍💫.`,
          `<@${memberId}>, kao không chích mày đâu...\n… nhưng cái ổ điện sau lưng thì có thể 🫣⚡`,
          `<@${memberId}>, bị sét đánh còn sống.\nBị kao chích thì đừng mơ nhé 😈⚡💀`,
          `Nghe nói <@${memberId}> sợ ma... để xem sợ điện hơn không nhé! "rẹt... rẹt... rẹtttttt!!! ⚡👻⚡"`,
          `<@${memberId}> à, như kiểu nồi cơm điện, mày sắp được *nấu chín bằng tình yêu điện giật* 🍚⚡`,
          `<@${memberId}> đừng lo, đây chỉ là "dịch vụ massage bằng điện cao áp" miễn phí thôi 😌⚡`,
          `<@${memberId}> bị lỗi hệ thống. Đang reset bằng điện 3000V... 3...2...1... *rẹtttttttttttttttt* ⚡`,
          `Nghe bảo <@${memberId}> thích cảm giác mạnh? Được thôi. *Tăng điện áp lên MAX* 💪⚡`,
          `Không phải sét trời, mà là sét lòng kao muốn đánh <@${memberId}> cho tỉnh 🤡⚡`,
          `Kao là Pikachu đời thực, và <@${memberId}> là Ash xui xẻo hôm nay 😤⚡`,
          `Cục sạc điện thoại còn không giật bằng ánh mắt kao nhìn <@${memberId}> lúc này... *rẹt!* 😠⚡`,
          `<@${memberId}> à, chúc mày ngủ ngon... trong ICU 🏥 vì kao mới *sẹc nhẹ* một phát 💀⚡`,
          `Điện giật có thể không nguy hiểm bằng việc <@${memberId}> nói chuyện mà không lọc não 🧠⚡`
        ];
      
        const randomIndex = Math.floor(Math.random() * messages.length);
        return messages[randomIndex];
      }
}