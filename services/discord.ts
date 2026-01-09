import * as dotenv from 'dotenv';
import * as path from "path";
import { readdir } from "fs/promises";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from 'path';
dotenv.config();
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);
import { Client, GatewayIntentBits, Message, TextChannel, GuildMember, Guild, Role, Channel, VoiceChannel, ForumChannel, CategoryChannel, ActivityType, PartialGuildMember, EmbedBuilder, ColorResolvable, Events, Interaction, ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder } from 'discord.js';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Chat } from "../models/chat.js";
import { sendEmbedMessage } from '../utils/helpers.js';
import { scheduleNextMessage } from '../utils/schedule.js';
import { Config, config } from '../config.js';
import { buildBookmarkEmbeds, buildCombinedBookmarkEmbed, buildDeleteButtonRow, buildEmbedForBookmark, buildPaginationButtons, fetchBookmarks } from '../libs/discord.js';
import { Bookmarks } from '../models/bookmark.js';
import * as bookmarkAdd from './slashCommands/bookmark-add.js';
import * as bookmarkDelete from './slashCommands/bookmark-delete.js';
import * as bookmarks from './slashCommands/bookmarks.js';
import * as voteChoice from './slashCommands/votechoice.js';
import { agenda } from '../utils/agenda.js';
import { scheduleDailyJobs } from '../src/queues/agendaQueue.js';
import { Setting } from '../models/setting.js';


interface CommandExecuteParams {
  message: Message;
  args: string[];
  config: Config;
  logModAction: (action: string) => void;
  sendEmbedMessage: (channel: TextChannel, author: any, content: string, color: ColorResolvable) => Promise<void>;
  client: Client;
  model: GenerativeModel;
  chatM: Chat;
  createModel: (model: string) => GenerativeModel;
}

const chatM = new Chat();
const stashCommandMap = {
  bookmarks: bookmarks,
  bookmark: {
    add: bookmarkAdd,
    delete: bookmarkDelete
  },
  votechoice: voteChoice
}

class ConfigService {
  private config: Config;

  constructor(config?: Config) {
    this.config = config || {
      prefix: '!',
      mutedRole: 'Muted',
      modLogChannel: 'mod-log',
      sonId: '',
      camGif: '',
      aiChannel: '',
      repoPath: '',
      channeSpamSettingKey: '',
      electricTargetKey: ''
    };
  }

  getConfig(): Config {
    return this.config;
  }

  getPrefix(): string | undefined {
    return this.config.prefix;
  }
}

class LoggerService {
  log(message: string): void {
    console.log(message);
  }

  error(message: string, error?: any): void {
    console.error(message, error);
  }
}

class AIService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string, model: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: model });
  }

  getModel(): GenerativeModel {
    return this.model;
  }
  
  createModel(model: string): GenerativeModel {
    return this.genAI.getGenerativeModel({ model: model });
  }
}

class CommandService {
  private commands: Map<string, any>;

  constructor() {
    this.commands = new Map();
  }

  async loadCommands(commandFiles: string[]): Promise<void> {
    for (const file of commandFiles) {
      if (!file.endsWith(".js") && !file.endsWith(".ts")) continue;
      if (file.startsWith("types.ts") || file.startsWith("types.js")) continue;
  
      try {
        const absPath = path.join(__dirname, "commands", file);
        const fileUrl = pathToFileURL(absPath).toString();
  
        const { default: command } = await import(fileUrl);
        this.commands.set(command.name, command);
        console.log(`✅ Loaded command: ${command.name}`);
      } catch (error) {
        console.error(`❌ Lỗi khi load command ${file}:`, error);
      }
    }
  }

  async executeCommand(
    commandName: string,
    message: Message,
    args: string[],
    config: Config,
    logModAction: (action: string) => void,
    sendEmbedMessage: (channel: TextChannel, author: any, content: string, color: ColorResolvable) => Promise<void>,
    client: Client,
    model: GenerativeModel,
    aiService: AIService
  ): Promise<void> {
    const command = this.commands.get(commandName);
    if (!command) return;

    await command.execute({
      message,
      args,
      config,
      logModAction,
      sendEmbedMessage,
      client,
      model,
      chatM,
      createModel: (model: string) => aiService.createModel(model)
    } as CommandExecuteParams);
  }
}

class ModerationService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  logMemberJoin(member: GuildMember): void {
    const logChannel = member.guild.channels.cache.find(
      channel => channel.name === 'mod-log'
    ) as TextChannel;
    
    if (logChannel) {
      logChannel.send(
        `:inbox_tray: **${member.user.tag}** đã tham gia server. (ID: ${member.id})`
      );
    }
  }

  logMemberLeave(member: GuildMember | PartialGuildMember): void {
    const logChannel = member.guild.channels.cache.find(
      channel => channel.name === 'mod-log'
    ) as TextChannel;
    
    if (logChannel) {
      logChannel.send(
        `:outbox_tray: **${member.user?.tag}** đã rời server. (ID: ${member.id})`
      );
    }
  }

  ensureMutedRoleExists(): void {
    this.client.guilds.cache.forEach((guild: Guild) => {
      let mutedRole = guild.roles.cache.find(role => role.name === 'Muted');
      
      if (!mutedRole) {
        try {
          guild.roles.create({
            name: 'Muted',
            permissions: [],
          }).then((role: Role) => {
            console.log(`Đã tạo role ${role.name} cho server ${guild.name}`);
            guild.channels.cache.forEach((channel: Channel) => {
              if (
                channel instanceof TextChannel ||
                channel instanceof VoiceChannel ||
                channel instanceof ForumChannel ||
                channel instanceof CategoryChannel
              ) {
                channel.permissionOverwrites.create(role, {
                  SendMessages: false,
                  AddReactions: false,
                  Speak: false,
                });
              } else {
                console.error("Channel does not support permission overwrites:", channel.type);
              }
            });
          });
        } catch (error) {
          console.error(`Không thể tạo role Muted cho server ${guild.name}: ${error}`);
        }
      }
    });
  }

  logModAction(action: string): void {
    console.log(`Mod Action: ${action}`);
  }

  sendEmbedMessage(channel: TextChannel, author: any, content: string, color: ColorResolvable): Promise<void> {
    return sendEmbedMessage(channel, author, content, color);
  }
}

class ScheduleService {
  // async scheduleNextMessage(client: Client, config: Config): Promise<void> {
  //   return scheduleNextMessage(client, config);
  // }
}

class DiscordBotService {
  private client: Client;
  private configService: ConfigService;
  private loggerService: LoggerService;
  private commandService: CommandService;
  private moderationService: ModerationService;
  private scheduleService: ScheduleService;
  public aiService!: AIService;

  constructor(config?: Config) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
      ],
    });

    this.configService = new ConfigService(config);
    this.loggerService = new LoggerService();
    this.commandService = new CommandService();
    this.moderationService = new ModerationService(this.client);
    this.scheduleService = new ScheduleService();
  }

  async initialize(): Promise<void> {
    const settingM = new Setting();
    const modelAI = await settingM.getSetting(config.modelAI) || process.env.MODEL_AI || 'gemini-2.0-flash-lite-preview-02-05';
    this.aiService = new AIService(process.env.AI_API_KEY || '', modelAI);
    await this.loadCommands();
    this.setupEventListeners();
    await this.login();
  }

  async loadCommands(): Promise<void> {
    try {
      const commandFiles = await readdir(path.join(__dirname, "commands"));
      await this.commandService.loadCommands(commandFiles);
    } catch (error) {
      this.loggerService.error("Lỗi khi tải lệnh:", error);
    }
  }

  setupEventListeners(): void {
    this.client.once('ready', () => {
      this.onBotReady();
    });

    this.client.on('messageCreate', async (message: Message) => {
      await this.onMessageReceived(message);
    });

    this.client.on('guildMemberAdd', (member: GuildMember) => {
      this.moderationService.logMemberJoin(member);
    });

    this.client.on('guildMemberRemove', (member: GuildMember | PartialGuildMember) => {
      this.moderationService.logMemberLeave(member);
    });
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (!interaction.isChatInputCommand()) return;
      switch (interaction.commandName) {
        case 'bookmarks2':
          await stashCommandMap['bookmarks'].execute(interaction);
          break;
        case 'bookmark':
          const sub = interaction.options.getSubcommand();
          if (sub) {
            if (sub === 'add' || sub === 'delete') {
              await stashCommandMap.bookmark[sub].execute(interaction);
            }
          }
          break;
        case 'votechoice':
          await stashCommandMap['votechoice'].execute(interaction);
          break;
        default:
          break;
      }
    });
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (!interaction.isButton()) return;
      if (interaction.customId.startsWith('bookmark:')) {
        this.handleNextBookmarkPage(interaction);
      }
      // if (interaction.customId.startsWith('deleteBookmark:')) {
      //   this.handleDeleteBookMark(interaction);    
      // }
      if (interaction.customId.startsWith('bookmark:delete:')) {
        this.handleDeleteBookMark(interaction);    
      }
    });
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isStringSelectMenu()) return;
      switch (interaction.customId) {
        case 'bookmarks:select-tag':
          this.handleSelectTag(interaction);
          break;
      
        default:
          break;
      }
    });
  }

  async onBotReady(): Promise<void> {
    this.loggerService.log(`🤖 Bot đã sẵn sàng! Đăng nhập với tên ${this.client.user?.tag}`);
    
    this.client.user?.setActivity('!help để xem lệnh', { type: ActivityType.Watching });
    this.moderationService.ensureMutedRoleExists();
    // this.scheduleService.scheduleNextMessage(this.client, this.configService.getConfig());
    await agenda.start();
    await scheduleDailyJobs(agenda, this.client, this.configService.getConfig());
  }

  async onMessageReceived(message: Message): Promise<void> {
    if (message.author.bot || !message.content.startsWith(this.configService.getPrefix() || '')) return;

    const args = message.content.slice(this.configService.getPrefix()?.length || 0).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase() || '';

    try {
      await this.commandService.executeCommand(
        commandName,
        message,
        args,
        this.configService.getConfig(),
        this.moderationService.logModAction,
        this.moderationService.sendEmbedMessage,
        this.client,
        this.aiService.getModel(),
        this.aiService
      );
    } catch (error) {
      this.loggerService.error('Có lỗi xảy ra khi thực hiện lệnh.', error);
      console.log(error, "Lỗi");
      message.reply('Có lỗi xảy ra khi thực hiện lệnh.');
    }
  }

  async login(): Promise<void> {
    await this.client.login(process.env.DISCORD_TOKEN);
  }
  async handleNextBookmarkPage(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;
    const [, direction, currentPageStr, rawTag] = interaction.customId.split(':');
    const currentPage = parseInt(currentPageStr);
    const nextPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    const tags = rawTag ? rawTag.split(',') : null;
    if (nextPage < 1 ) {
      interaction.reply({ content: '🚫 Không còn bookmark nào ở trang này.', ephemeral: true });
      return;
    }
    const bookmarks = await fetchBookmarks(interaction.user.id, nextPage, tags);
  
    if (bookmarks.length === 0) {
      interaction.reply({ content: '🚫 Không còn bookmark nào ở trang này.', ephemeral: true });
      return;
    }
  
    const { embed, actionRows } = buildCombinedBookmarkEmbed(bookmarks);

    const paginationRow = buildPaginationButtons(nextPage, tags);

    await interaction.update({
      content: `📄 Trang ${currentPage}`,
      embeds: embed,
      components: [...actionRows, paginationRow],
    });
  }
  async handleDeleteBookMark(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;
  
    const [, , bookmarkId, page = "1"] = interaction.customId.split(':');
    const bM = new Bookmarks();
    await bM.delete(bookmarkId);
    const userId = interaction.user.id;
    const bookmarks = await fetchBookmarks(userId, parseInt(page), null);
  
    const replyData = bookmarks.length === 0
      ? {
          content: '📭 Bạn không còn bookmark nào.',
          embeds: [],
          components: [],
        }
      : (() => {
          const { embed, actionRows } = buildCombinedBookmarkEmbed(bookmarks);
          const paginationRow = buildPaginationButtons(parseInt(page), null);
          return {
            content: `📄 Trang ${page}`,
            embeds: embed,
            components: [...actionRows, paginationRow],
          };
        })();
  
    try {
      await interaction.editReply(replyData);
    } catch (error: any) {
      console.error('❌ Không thể editReply:', error);
    }
  }
  async handleSelectTag(interaction: Interaction): Promise<void> {
    if (!interaction.isStringSelectMenu()) return;
    const selected = interaction.values;
    const bM = new Bookmarks();
    const page = 1;
    let bookmarks;

    if (selected.includes('__ALL__')) {
      bookmarks = await fetchBookmarks(interaction.user.id, page, null);
    } else {
      bookmarks = await bM.findMany({
        where: {
          savedByUserId: interaction.user.id,
          guildId: interaction.guildId!,
          tags: {
            hasSome: selected,
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 4,
        take: 4,
      });
    }

    if (!bookmarks.length) {
      await interaction.update({
        content: '📭 Không tìm thấy bookmark nào.',
        embeds: [],
        components: [],
      });
      return;
    }

    const { embed, actionRows } = buildCombinedBookmarkEmbed(bookmarks);

    const paginationRow = buildPaginationButtons(page, selected.includes('__ALL__') ? null : selected);

    await interaction.update({
      content: `📄 Trang ${page}`,
      embeds: embed,
      components: [...actionRows, paginationRow],
    });
  }
}

export default DiscordBotService;