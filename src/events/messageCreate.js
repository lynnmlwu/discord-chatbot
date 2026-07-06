import { detectLanguage } from '../services/language.js';
import { buildSystemPrompt } from '../services/prompt.js';
import { chat } from '../services/llm.js';
import { memory } from '../services/memory.js';

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;

/**
 * 偵測輸入文字的主要語言
 * 如果超過 30% 是 CJK 字元，判定為中文
 * @param {string} text
 * @returns {'zh'|'en'|null}
 */
function detectInputLanguage(text) {
  const cleaned = text.replace(/\s/g, '');
  if (cleaned.length === 0) return null; // 空訊息無法判斷語言
  // 用 split 計算 CJK 字元數（比 match+g 更可靠，無 lastIndex 狀態問題）
  const cjkCount = cleaned.split('').filter(c => CJK_REGEX.test(c)).length;
  const ratio = cjkCount / cleaned.length;
  return ratio > 0.3 ? 'zh' : 'en';
}

const DISCORD_MSG_LIMIT = 2000;

/**
 * 將過長的訊息分段
 * @param {string} text
 * @returns {string[]}
 */
function splitMessage(text) {
  if (text.length <= DISCORD_MSG_LIMIT) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= DISCORD_MSG_LIMIT) {
      chunks.push(remaining);
      break;
    }

    // 嘗試在段落、句號或換行處斷開
    let splitIndex = remaining.lastIndexOf('\n', DISCORD_MSG_LIMIT);
    if (splitIndex === -1 || splitIndex < DISCORD_MSG_LIMIT / 2) {
      splitIndex = remaining.lastIndexOf('。', DISCORD_MSG_LIMIT);
    }
    if (splitIndex === -1 || splitIndex < DISCORD_MSG_LIMIT / 2) {
      splitIndex = remaining.lastIndexOf('. ', DISCORD_MSG_LIMIT);
    }
    if (splitIndex === -1 || splitIndex < DISCORD_MSG_LIMIT / 2) {
      splitIndex = DISCORD_MSG_LIMIT;
    }

    chunks.push(remaining.slice(0, splitIndex + 1));
    remaining = remaining.slice(splitIndex + 1);
  }

  return chunks;
}

/**
 * 訊息建立事件處理
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 */
export async function onMessageCreate(message, client) {
  // 忽略 Bot 自己的訊息
  if (message.author.bot) return;

  // 只在被 @mention 時回應
  if (!message.mentions.has(client.user)) return;

  // 移除 @mention 部分，取得實際訊息內容
  const userMessage = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
    .trim();

  // 檢查營業時間 (台灣時間 週一到週五 10:00~19:00)
  const now = new Date();
  const twTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const day = twTime.getUTCDay();
  const hour = twTime.getUTCHours();
  const isWorking = (day >= 1 && day <= 5) && (hour >= 10 && hour < 19);

  if (!isWorking) {
    const lang = detectLanguage(message.channel);
    const sleepMsg = lang === 'zh' 
      ? '💤 （光芒微弱... Lumo 正在睡覺休息中，他的出沒時間是平日 10:00 ~ 19:00 喔！）'
      : '💤 (Lumo is currently resting... his active hours are Mon-Fri 10:00 ~ 19:00 Taiwan Time!)';
    await message.reply(sleepMsg);
    return;
  }

  // 如果 mention 了但沒有實際內容
  if (!userMessage) {
    const lang = detectLanguage(message.channel);
    const greeting =
      lang === 'zh'
        ? '✨ 嗨！你在叫我嗎？我聽到你的聲音了～有什麼想聊的嗎？'
        : "✨ Hey! Did you call me? I can hear your voice~ What's on your mind?";
    await message.reply(greeting);
    return;
  }

  try {
    // 顯示打字動畫
    await message.channel.sendTyping();

    // 優先依使用者實際訊息判斷語言；若無法判斷，再退回頻道預設
    const inputLang = detectInputLanguage(userMessage);
    const channelLang = detectLanguage(message.channel);
    const responseLang = inputLang || channelLang;

    // 組裝 system prompt
    const systemPrompt = buildSystemPrompt(responseLang, userMessage);

    // 取得對話歷史
    const history = memory.getHistory(message.author.id);

    // 呼叫 LLM
    const response = await chat(systemPrompt, history, userMessage);

    // 儲存對話記憶
    memory.addMessage(message.author.id, 'user', userMessage);
    memory.addMessage(message.author.id, 'model', response);

    // 分段發送（Discord 2000 字元限制）
    const chunks = splitMessage(response);
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        await message.reply(chunks[i]);
      } else {
        await message.channel.send(chunks[i]);
      }
    }
  } catch (error) {
    console.error('[LUMO] Error:', error);

    const lang = detectLanguage(message.channel);
    const errorMsg =
      lang === 'zh'
        ? '💫 嗚...我的耳朵突然聽不太清楚了...可以再說一次嗎？'
        : "💫 Mmm... my ears got a bit fuzzy for a moment... could you say that again?";
    await message.reply(errorMsg);
  }
}
