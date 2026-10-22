import 'dotenv/config';

/** 把「id1, id2」轉成 ['id1', 'id2'] */
function idList(value) {
  return (value || '').split(',').map((id) => id.trim()).filter(Boolean);
}

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    dungeonReminderChannelId: process.env.DUNGEON_REMINDER_CHANNEL_ID,
    dungeonReminderEnglishChannelId: process.env.DUNGEON_REMINDER_EN_CHANNEL_ID,
    // 聊天頻道的語言（逗號分隔多個）：zh 只回中文、en 只回英文、both 依玩家輸入的語言回覆
    // 沒有列在這裡的頻道，會依頻道名稱判斷語言
    chatChannels: {
      zh: idList(process.env.CHAT_CHANNEL_IDS_ZH),
      en: idList(process.env.CHAT_CHANNEL_IDS_EN),
      both: idList(process.env.CHAT_CHANNEL_IDS_BOTH),
    },
    // 光光會讀取的官方頻道（逗號分隔多個）：中文、英文、兩種語言共用
    // mainZh / mainEn 是「官方公告」頻道，光光說「之後會在公告跟大家說」時會標出這個頻道
    announcementChannels: {
      zh: idList(process.env.ANNOUNCEMENT_CHANNEL_IDS_ZH),
      en: idList(process.env.ANNOUNCEMENT_CHANNEL_IDS_EN),
      shared: idList(process.env.ANNOUNCEMENT_CHANNEL_IDS),
      mainZh: idList(process.env.MAIN_ANNOUNCEMENT_CHANNEL_ZH),
      mainEn: idList(process.env.MAIN_ANNOUNCEMENT_CHANNEL_EN),
    },
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: 'openai/gpt-oss-120b', // llama-3.3-70b-versatile 已於 2026/8/16 下架
  },
  memory: {
    maxMessages: 10, // 每個使用者保留的最近對話數
  },
};
