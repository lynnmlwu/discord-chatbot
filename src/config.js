import 'dotenv/config';

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    dungeonReminderChannelId: process.env.DUNGEON_REMINDER_CHANNEL_ID,
    dungeonReminderEnglishChannelId: process.env.DUNGEON_REMINDER_EN_CHANNEL_ID,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
  },
  memory: {
    maxMessages: 10, // 每個使用者保留的最近對話數
  },
};
