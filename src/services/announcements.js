import { config } from '../config.js';

const FETCH_LIMIT = 30; // 每個頻道讀取的最新訊息數
const MAX_CHARS = 1500; // 放進 prompt 的公告總字數上限（避免吃太多 token）
const REFRESH_MS = 10 * 60 * 1000; // 每 10 分鐘重新整理

let cached = []; // [{ date, text }]，新的在前

/**
 * 把一則 Discord 訊息轉成純文字（含 embed 內容）
 * @param {import('discord.js').Message} msg
 */
function messageToText(msg) {
  const parts = [msg.content];
  for (const embed of msg.embeds) {
    parts.push(embed.title, embed.description, ...embed.fields.map((f) => `${f.name}: ${f.value}`));
  }
  return parts.filter(Boolean).join('\n').trim();
}

/**
 * 從公告頻道讀取最新訊息
 * @param {import('discord.js').Client} client
 */
export async function refreshAnnouncements(client) {
  const items = [];
  for (const id of config.discord.announcementChannelIds) {
    try {
      const channel = await client.channels.fetch(id);
      const messages = await channel.messages.fetch({ limit: FETCH_LIMIT });
      for (const msg of messages.values()) {
        const text = messageToText(msg);
        if (text) items.push({ time: msg.createdTimestamp, text });
      }
    } catch (err) {
      console.error(`[Announcements] 無法讀取頻道 ${id}：${err.message}`);
    }
  }
  items.sort((a, b) => b.time - a.time);
  cached = items.map((i) => ({ date: new Date(i.time).toISOString().slice(0, 10), text: i.text }));
  console.log(`[Announcements] 已載入 ${cached.length} 則公告`);
}

/**
 * 啟動公告讀取：立即讀一次，之後定期更新，公告頻道有新訊息時也會更新
 * @param {import('discord.js').Client} client
 */
export function startAnnouncements(client) {
  const ids = config.discord.announcementChannelIds;
  if (ids.length === 0) {
    console.warn('[Announcements] 未設定 ANNOUNCEMENT_CHANNEL_IDS，光光不會參考公告');
    return;
  }
  refreshAnnouncements(client);
  setInterval(() => refreshAnnouncements(client), REFRESH_MS);
  for (const event of ['messageCreate', 'messageUpdate', 'messageDelete']) {
    client.on(event, (msg) => {
      if (ids.includes(msg.channelId)) refreshAnnouncements(client);
    });
  }
}

/**
 * 取得要放進 prompt 的公告文字（從最新的開始，超過字數上限就截斷）
 * @returns {string}
 */
export function getAnnouncementsText() {
  const lines = [];
  let total = 0;
  for (const { date, text } of cached) {
    const entry = `[${date}] ${text}`;
    if (total + entry.length > MAX_CHARS) break;
    lines.push(entry);
    total += entry.length;
  }
  return lines.join('\n\n');
}

/** 公告頻道的 Discord 連結標記，例如 <#123> */
export function getAnnouncementChannelMentions() {
  return config.discord.announcementChannelIds.map((id) => `<#${id}>`).join(' ');
}
