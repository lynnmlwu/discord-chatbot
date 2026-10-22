/**
 * 頻道語言偵測模組
 * 優先使用 .env 指定的頻道 ID；沒有指定的頻道，再根據頻道名稱或分類名稱判斷
 */
import { config } from '../config.js';

const CJK_REGEX = /[一-鿿㐀-䶿]/;

/**
 * 判斷頻道應使用的語言
 * @param {import('discord.js').TextChannel} channel
 * @returns {'zh'|'en'|'both'} both = 雙語頻道，依玩家輸入的語言回覆
 */
export function detectLanguage(channel) {
  const { zh, en, both } = config.discord.chatChannels;
  if (both.includes(channel.id)) return 'both';
  if (zh.includes(channel.id)) return 'zh';
  if (en.includes(channel.id)) return 'en';

  const nameLower = channel.name.toLowerCase();

  // 1. 優先檢查是否為明確的英文頻道
  const enKeywords = ['english', 'en-', 'en_', 'eng'];
  if (enKeywords.some((kw) => nameLower.includes(kw))) {
    return 'en';
  }

  // 2. 檢查分類名稱（Category）是否為英文類別
  const parentNameLower = channel.parent?.name?.toLowerCase() || '';
  if (enKeywords.some((kw) => parentNameLower.includes(kw))) {
    return 'en';
  }

  // 3. 檢查頻道名稱是否含中文字
  if (CJK_REGEX.test(channel.name)) {
    return 'zh';
  }

  // 4. 檢查分類名稱（Category）是否含中文字
  if (channel.parent?.name && CJK_REGEX.test(channel.parent.name)) {
    return 'zh';
  }

  // 5. 如果都無法判斷，預設英文
  return 'en';
}

/**
 * 判斷玩家輸入的主要語言：超過 30% 是中文字就當中文，其餘當英文
 * @param {string} text
 * @returns {'zh'|'en'}
 */
export function detectInputLanguage(text) {
  const cleaned = text.replace(/\s/g, '');
  if (!cleaned) return 'zh';
  const cjkCount = [...cleaned].filter((c) => CJK_REGEX.test(c)).length;
  return cjkCount / cleaned.length > 0.3 ? 'zh' : 'en';
}

/**
 * 決定這則訊息要用哪種語言回覆
 * @param {import('discord.js').TextChannel} channel
 * @param {string} text - 玩家訊息（雙語頻道依這個判斷）
 * @returns {{ lang: 'zh'|'en', bilingual: boolean }}
 */
export function resolveReplyLanguage(channel, text) {
  const channelLang = detectLanguage(channel);
  if (channelLang === 'both') return { lang: detectInputLanguage(text), bilingual: true };
  return { lang: channelLang, bilingual: false };
}
