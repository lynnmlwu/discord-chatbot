import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { onReady } from './events/ready.js';
import { onMessageCreate } from './events/messageCreate.js';
import { startDungeonReminder } from './services/reminder.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// 事件綁定
client.once('clientReady', () => {
  onReady(client);
  // startDungeonReminder(client, {
  //   zh: config.discord.dungeonReminderChannelId,
  //   en: config.discord.dungeonReminderEnglishChannelId,
  // });
});
client.on('messageCreate', (message) => onMessageCreate(message, client));

// 登入
client.login(config.discord.token).catch((err) => {
  console.error('❌ 登入失敗！請確認 DISCORD_TOKEN 是否正確：', err.message);
  process.exit(1);
});

// 優雅關閉
process.on('SIGINT', () => {
  console.log('\n🌙 Lumo 準備休息了...');
  client.destroy();
  process.exit(0);
});
