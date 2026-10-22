import { config } from '../config.js';

const FETCH_LIMIT = 30; // 每個頻道讀取的最新訊息數
const MAX_CHARS = 1500; // 放進 prompt 的頻道資料總字數上限（避免吃太多 token）
const CHUNK_CHARS = 500; // 長訊息切成段落，每段的字數上限
const REFRESH_MS = 10 * 60 * 1000; // 每 10 分鐘重新整理

// [{ lang, channelId, channelName, time, date, text, grams }]
let chunks = [];

/** 所有要讀取的頻道與語言：zh / en / shared（兩種語言都會用到） */
function channelList() {
  const { zh, en, shared } = config.discord.announcementChannels;
  return [
    ...zh.map((id) => ({ id, lang: 'zh' })),
    ...en.map((id) => ({ id, lang: 'en' })),
    ...shared.map((id) => ({ id, lang: 'shared' })),
  ];
}

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

/** 長訊息依段落切開，每段不超過 CHUNK_CHARS 字 */
function splitChunks(text) {
  const result = [];
  let current = '';
  for (const para of text.split(/\n\s*\n/)) {
    if (current && current.length + para.length > CHUNK_CHARS) {
      result.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${para}` : para;
    while (current.length > CHUNK_CHARS) {
      result.push(current.slice(0, CHUNK_CHARS));
      current = current.slice(CHUNK_CHARS);
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

/** 取出文字的關鍵片段：中文用兩字一組、英文用單字，用來比對玩家問題和頻道內容 */
function toGrams(text) {
  const lower = text.toLowerCase();
  const grams = new Set();
  for (const word of lower.match(/[a-z0-9]{2,}/g) || []) grams.add(word);
  for (const run of lower.match(/[一-鿿]+/g) || []) {
    for (let i = 0; i < run.length - 1; i++) grams.add(run.slice(i, i + 2));
  }
  return grams;
}

/**
 * 讀取一個頻道的最新訊息，回傳 [{ time, text }]
 * 一般頻道讀訊息；論壇頻道（例如開發日誌）沒有訊息，要讀每篇貼文的標題和第一則內容
 */
async function fetchChannelPosts(channel) {
  if (channel.messages) {
    const messages = await channel.messages.fetch({ limit: FETCH_LIMIT });
    return [...messages.values()].map((msg) => ({ time: msg.createdTimestamp, text: messageToText(msg) }));
  }

  if (channel.threads) {
    const active = await channel.threads.fetchActive();
    const archived = await channel.threads.fetchArchived({ limit: FETCH_LIMIT });
    const threads = [...active.threads.values(), ...archived.threads.values()]
      .filter((t) => t.parentId === channel.id)
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
      .slice(0, FETCH_LIMIT);
    const posts = [];
    for (const thread of threads) {
      const starter = await thread.fetchStarterMessage().catch(() => null);
      const body = starter ? messageToText(starter) : '';
      posts.push({ time: thread.createdTimestamp, text: [thread.name, body].filter(Boolean).join('\n') });
    }
    return posts;
  }

  throw new Error('不支援的頻道類型');
}

/**
 * 從所有頻道讀取最新訊息
 * @param {import('discord.js').Client} client
 */
export async function refreshAnnouncements(client) {
  const next = [];
  for (const { id, lang } of channelList()) {
    try {
      const channel = await client.channels.fetch(id);
      const posts = await fetchChannelPosts(channel);
      for (const { time, text } of posts) {
        if (!text) continue;
        const date = new Date(time).toISOString().slice(0, 10);
        splitChunks(text).forEach((part, index) => {
          next.push({
            lang,
            channelId: id,
            channelName: channel.name,
            time,
            index,
            date,
            text: part,
            grams: toGrams(part),
          });
        });
      }
    } catch (err) {
      console.error(`[Announcements] 無法讀取頻道 ${id}：${err.message}`);
    }
  }
  next.sort((a, b) => b.time - a.time || a.index - b.index);
  chunks = next;
  console.log(`[Announcements] 已載入 ${new Set(next.map((c) => c.time + c.channelId)).size} 則頻道訊息`);
}

/**
 * 啟動頻道讀取：立即讀一次，之後定期更新，這些頻道有新訊息時也會更新
 * @param {import('discord.js').Client} client
 */
export function startAnnouncements(client) {
  const ids = channelList().map((c) => c.id);
  if (ids.length === 0) {
    console.warn('[Announcements] 未設定公告頻道，光光不會參考公告');
    return;
  }
  refreshAnnouncements(client);
  setInterval(() => refreshAnnouncements(client), REFRESH_MS);
  for (const event of ['messageCreate', 'messageUpdate', 'messageDelete']) {
    client.on(event, (msg) => {
      // 論壇貼文的訊息在貼文（thread）裡，要看它所屬的論壇頻道
      if (ids.includes(msg.channelId) || ids.includes(msg.channel?.parentId)) refreshAnnouncements(client);
    });
  }
}

/**
 * 取得要放進 prompt 的頻道資料：
 * 一定放最新一則官方公告，其餘依玩家問題挑最相關的段落，總字數不超過上限
 * @param {'zh'|'en'} lang
 * @param {string} userMessage
 * @returns {string}
 */
export function getAnnouncementsText(lang, userMessage) {
  const pool = chunks.filter((c) => c.lang === lang || c.lang === 'shared');
  const mainIds = config.discord.announcementChannels[lang === 'zh' ? 'mainZh' : 'mainEn'];
  const latestMain = pool.find((c) => mainIds.includes(c.channelId));

  const queryGrams = toGrams(userMessage);
  const scored = pool
    .map((c) => ({ c, score: [...queryGrams].filter((g) => c.grams.has(g)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.c.time - a.c.time)
    .map(({ c }) => c);

  const picked = [];
  let total = 0;
  for (const c of [latestMain, ...scored]) {
    if (!c || picked.includes(c)) continue;
    const entry = `[#${c.channelName}｜${c.date}] ${c.text}`;
    if (total + entry.length > MAX_CHARS) continue;
    picked.push(c);
    total += entry.length;
  }
  return picked.map((c) => `[#${c.channelName}｜${c.date}] ${c.text}`).join('\n\n');
}

/**
 * 官方公告頻道的 Discord 連結標記，例如 <#123>（光光說「會在公告跟大家說」時使用）
 * @param {'zh'|'en'} lang
 */
export function getAnnouncementChannelMentions(lang) {
  const ids = config.discord.announcementChannels[lang === 'zh' ? 'mainZh' : 'mainEn'];
  return ids.map((id) => `<#${id}>`).join(' ');
}
