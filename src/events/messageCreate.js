import { resolveReplyLanguage } from '../services/language.js';
import { buildSystemPrompt } from '../services/prompt.js';
import { chat } from '../services/llm.js';
import { memory } from '../services/memory.js';
import { isWorkingHours, isRateLimited, enterRateLimitRest } from '../services/status.js';

/** 額度用完時的回覆 */
function tiredMessage(lang) {
  return lang === 'zh'
    ? '💤 （耳朵慢慢垂下）光光今天聊太多了，有點累……讓我休息一下，等等再來找我好嗎？'
    : "💤 (ears slowly droop) Lumo has chatted a lot today and needs a little rest... come find me again in a bit?";
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

  // 這則訊息要用的語言：中文頻道回中文、英文頻道回英文、雙語頻道依玩家輸入的語言
  const { lang: replyLang, bilingual } = resolveReplyLanguage(message.channel, userMessage);

  // 檢查營業時間 (台灣時間 週一到週五 10:00~19:00)
  if (!isWorkingHours()) {
    const lang = replyLang;
    const sleepMsg = lang === 'zh' 
      ? '💤 （光芒微弱... Lumo 正在睡覺休息中，他的出沒時間是平日 10:00 ~ 19:00 喔！）'
      : '💤 (Lumo is currently resting... his active hours are Mon-Fri 10:00 ~ 19:00 Taiwan Time!)';
    await message.reply(sleepMsg);
    return;
  }

  // 額度用完休息中：直接回覆，不呼叫 API
  if (isRateLimited()) {
    await message.reply(tiredMessage(replyLang));
    return;
  }

  // 如果 mention 了但沒有實際內容
  if (!userMessage) {
    const lang = replyLang;
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

    // 以頻道語言為主導，保持中文頻道只回中文、英文頻道只回英文
    const responseLang = replyLang;
    const channelName = message.channel.name || 'unknown';

    // 組裝 system prompt
    const systemPrompt = buildSystemPrompt(responseLang, userMessage, channelName, { bilingual });

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

    const lang = replyLang;
    // 429 = Groq 免費額度用完（每日 token 上限），切換成休息狀態，時間到自動恢復
    if (error.status === 429) enterRateLimitRest(error);
    const errorMsg = error.status === 429
      ? tiredMessage(lang)
      : lang === 'zh'
        ? '💫 嗚...我的耳朵突然聽不太清楚了...可以再說一次嗎？'
        : "💫 Mmm... my ears got a bit fuzzy for a moment... could you say that again?";
    await message.reply(errorMsg);
  }
}
