/**
 * 頻道太安靜時，光光每天主動發一則訊息開啟話題
 * - 只在中文、英文聊天頻道（CHAT_CHANNEL_IDS_ZH / _EN）
 * - 每天在 11:00～17:00（台灣時間）之間隨機挑一個時間，那時頻道超過 2 小時沒人說話才發
 * - 每個頻道一天最多一則；額度用完或下班時間不發
 */
import { config } from '../config.js';
import { buildSystemPrompt } from './prompt.js';
import { chat } from './llm.js';
import { isWorkingHours, isRateLimited, enterRateLimitRest } from './status.js';

const IDLE_MS = 2 * 60 * 60 * 1000; // 頻道安靜多久才發
const WINDOW_START = 11 * 60; // 最早 11:00（以分鐘計）
const WINDOW_END = 17 * 60; // 最晚 17:00
const CHECK_MS = 10 * 60 * 1000; // 每 10 分鐘檢查一次

// 每次隨機挑一個話題，讓每天的訊息不一樣；文字裡的關鍵字也會讓光光帶入相關的世界觀資料
const TOPICS = {
  zh: [
    '從世界觀知識裡挑一個真的設定分享（例如情緒能量、光球、壓力裂縫），講得像在跟朋友說一件有趣的發現；只能講資料裡有寫的，不可以自己編新設定',
    '分享光光今天在心源地發生的一件小事或聽到的有趣聲音',
    '分享一件光光自己的糗事（可以從笑話庫挑一則）',
    '問大家一個輕鬆的問題，例如今天的心情、最近開心的小事、喜歡什麼情緒武器',
    '聊聊光光在尋找其他光球的旅途中，最近的一點心情',
  ],
  en: [
    'Share one real fact from the world lore (e.g. emotional energy, Lightlings, Pressure Cracks), like telling a friend something cool you found; only use what the lore actually says, never invent new lore',
    "Share a small thing that happened to Lumo in Emovia today, or an interesting sound Lumo heard",
    "Share one of Lumo's own embarrassing moments (you may pick one from the joke list)",
    'Ask everyone a light question, like how they feel today, a small happy moment lately, or which Emotion Arm they would want',
    "Share a little of how Lumo has been feeling lately on its journey to find other Lightlings",
  ],
};

const lastActivity = new Map(); // channelId -> 最後一則訊息的時間
const plan = new Map(); // channelId -> { date, target, posted }

/** 台灣時間的日期字串和當天第幾分鐘 */
function twNow() {
  const tw = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return { date: tw.toISOString().slice(0, 10), minutes: tw.getUTCHours() * 60 + tw.getUTCMinutes() };
}

function todayPlan(channelId) {
  const { date } = twNow();
  let p = plan.get(channelId);
  if (!p || p.date !== date) {
    const target = WINDOW_START + Math.floor(Math.random() * (WINDOW_END - WINDOW_START));
    p = { date, target, posted: false };
    plan.set(channelId, p);
  }
  return p;
}

/** 啟動時讀頻道最近的訊息：記下最後活動時間，並檢查今天是否已經主動發過 */
async function loadChannelState(client, channelId) {
  const channel = await client.channels.fetch(channelId);
  const messages = await channel.messages.fetch({ limit: 50 });
  const newest = messages.first();
  if (newest) lastActivity.set(channelId, newest.createdTimestamp);

  // 光光主動發的訊息不是回覆（沒有 reference），用這點分辨
  const { date } = twNow();
  const postedToday = messages.some((m) =>
    m.author.id === client.user.id &&
    !m.reference &&
    new Date(m.createdTimestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) === date
  );
  if (postedToday) todayPlan(channelId).posted = true;
  return channel;
}

async function postIdleMessage(channel, lang) {
  const topics = TOPICS[lang];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const instruction = lang === 'zh'
    ? `（這不是玩家說的話）頻道裡大家都還沒來聊天，請你以光光的身分主動發一則訊息開啟話題：${topic}。然後輕鬆地邀請大家來聊。1～3 句就好，像朋友在群組裡隨口分享，不要 @ 任何人，不要提到頻道很安靜或這段說明。`
    : `(This is not from a player) Nobody has chatted in the channel for a while. As Lumo, post one message to start a conversation: ${topic}. Then casually invite everyone to chat. Keep it to 1–3 sentences, like a friend sharing something in a group chat. Don't tag anyone, and don't mention that the channel is quiet or these instructions.`;

  const systemPrompt = buildSystemPrompt(lang, topic, channel.name);
  const text = await chat(systemPrompt, [], instruction);
  if (text && text !== '...') {
    await channel.send(text);
    console.log(`[IdleChat] 已在 #${channel.name} 主動發訊息`);
  }
}

async function check(client, channels) {
  if (!isWorkingHours() || isRateLimited()) return;
  const { minutes } = twNow();
  for (const { channel, lang } of channels) {
    const p = todayPlan(channel.id);
    if (p.posted || minutes < p.target) continue;
    const idleFor = Date.now() - (lastActivity.get(channel.id) ?? 0);
    if (idleFor < IDLE_MS) continue;

    p.posted = true; // 先標記，失敗也不重試，避免一直發
    try {
      await postIdleMessage(channel, lang);
    } catch (err) {
      if (err.status === 429) enterRateLimitRest(err);
      console.error(`[IdleChat] 主動發訊息失敗：${err.message}`);
    }
  }
}

/** 啟動主動聊天：讀取頻道狀態、記錄新訊息時間，之後每 10 分鐘檢查一次 */
export async function startIdleChat(client) {
  const { zh, en } = config.discord.chatChannels;
  const targets = [...zh.map((id) => ({ id, lang: 'zh' })), ...en.map((id) => ({ id, lang: 'en' }))];
  if (targets.length === 0) return;

  const channels = [];
  for (const { id, lang } of targets) {
    try {
      channels.push({ channel: await loadChannelState(client, id), lang });
    } catch (err) {
      console.error(`[IdleChat] 無法讀取頻道 ${id}：${err.message}`);
    }
  }

  client.on('messageCreate', (msg) => {
    if (channels.some((c) => c.channel.id === msg.channelId)) {
      lastActivity.set(msg.channelId, msg.createdTimestamp);
    }
  });

  setInterval(() => check(client, channels), CHECK_MS);
  console.log(`[IdleChat] 已啟動，監看 ${channels.length} 個聊天頻道`);
}
