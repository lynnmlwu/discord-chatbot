import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const zhChannelId = process.env.DUNGEON_REMINDER_CHANNEL_ID;
const enChannelId = process.env.DUNGEON_REMINDER_EN_CHANNEL_ID || '1511298349242912869';

if (!token) throw new Error('DISCORD_TOKEN is missing');
if (!zhChannelId) throw new Error('DUNGEON_REMINDER_CHANNEL_ID is missing');
if (!enChannelId) throw new Error('English channel id is missing');

const messages = [
  {
    label: 'zh',
    channelId: zhChannelId,
    message: [
      '\u2728 **\u3010\u91d1\u5e63\u79d8\u7a9f\u63d0\u9192\u3011** \u2728',
      '\u5149\u5149 \u807d\u5230\u4eca\u5929\u5feb\u8981\u7d50\u675f\u7684\u8072\u97f3\u4e86\uff01\uff01🌙',
      '\u5927\u5bb6\u8a18\u5f97\u628a\u4eca\u5929\u7684\u526f\u672c\u6b21\u6578\u7528\u5b8c\u5594\uff01\u4e0d\u7136\u6703\u767d\u767d\u6d6a\u8cbb\u6389\u7684\uff5e\uff01💛',
    ].join('\n'),
  },
  {
    label: 'en',
    channelId: enChannelId,
    message: [
      '\u2728 **[Coin Cave Reminder]** \u2728',
      'Lumo heard the sound of today coming to an end! 🌙',
      'Everyone remember to finish today\'s dungeon runs! Don\'t let them go to waste! 💛',
    ].join('\n'),
  },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(token);

try {
  const results = [];
  for (const item of messages) {
    const channel = await client.channels.fetch(item.channelId);
    if (!channel?.isTextBased()) {
      results.push({ label: item.label, ok: false, reason: 'target channel is not text-based' });
      continue;
    }

    const sent = await channel.send(item.message);
    results.push({ label: item.label, ok: true, channelId: item.channelId, messageId: sent.id });
  }

  console.log(JSON.stringify({ ok: true, results }));
} finally {
  client.destroy();
}
